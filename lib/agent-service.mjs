import {Spectrum} from 'spectrum-ts';
import {imessage} from 'spectrum-ts/providers/imessage';
import {database,eventData} from '../api/index.mjs';
import {digest,interpret,findEvents,eventSummary,agentHelp} from './agent.mjs';
import {moveKey,mergeGroup} from './group.mjs';
import {validatePlan} from './core.mjs';
export const senderKey=sender=>digest(`${process.env.SPECTRUM_PROJECT_ID}:${sender}`);
export async function sendPhoton(message,reply){
  const app=await Spectrum({projectId:process.env.SPECTRUM_PROJECT_ID,projectSecret:process.env.SPECTRUM_PROJECT_SECRET,providers:[imessage.config()]});
  try{const space=await imessage(app).space.get(message.space,{phone:message.phone});const sent=await space.send(reply);if(!sent)throw new Error('Photon did not confirm the reply.');}
  finally{await app.stop();}
}
async function buildReply(sql,job){
  const key=job.sender_key,text=job.payload.text;
  const link=text.match(/^link\s+([a-f0-9]{12})$/i);
  if(link){
    // Consuming the one-use code, binding the sender, and storing the reply are atomic.
    const [result]=await sql`WITH paired AS (DELETE FROM agent_pairings WHERE code_hash=${digest(link[1].toUpperCase())} AND expires_at>NOW() RETURNING member_id),connected AS (INSERT INTO agent_links(sender_key,member_id) SELECT ${key},member_id FROM paired ON CONFLICT(sender_key) DO UPDATE SET member_id=EXCLUDED.member_id,last_results='[]' RETURNING member_id) UPDATE agent_jobs SET reply=CASE WHEN EXISTS(SELECT 1 FROM connected) THEN ${'Connected to your WTM name. '+agentHelp} ELSE 'That code has expired or was already used. Generate another at https://wtm-rn.vercel.app/agent.html' END WHERE id=${job.id} RETURNING reply`;
    return {reply:result.reply,writes:[]};
  }
  const [actor]=await sql`SELECT l.member_id,l.last_results,m.name FROM agent_links l JOIN members m ON m.id=l.member_id WHERE l.sender_key=${key}`;
  if(!actor)return {reply:'Connect your WTM name first: https://wtm-rn.vercel.app/agent.html\nGenerate a code there and text me the link command.',writes:[]};
  if(/^disconnect$/i.test(text))return {reply:'Your phone is disconnected from WTM.',writes:[sql`DELETE FROM agent_links WHERE sender_key=${key}`]};
  const [{count}]=await sql`SELECT COUNT(*)::int AS count FROM agent_jobs WHERE sender_key=${key} AND created_at>NOW()-INTERVAL '1 hour'`;
  if(count>30)return {reply:'You’ve reached 30 prompts this hour. Please use the website or try again later.',writes:[]};
  const data=await eventData(sql),moves=await sql`SELECT event_key FROM group_moves`,going=await sql`SELECT a.event_key,a.member_id,m.name FROM attendees a JOIN members m ON m.id=a.member_id ORDER BY lower(m.name)`;
  const events=mergeGroup(data.events,moves,going,actor.member_id),intent=await interpret(text,{events,last:actor.last_results});
  if(intent.action==='help')return {reply:intent.message||agentHelp,writes:[]};
  if(['find','moves'].includes(intent.action)){
    const list=findEvents(intent.action==='moves'?events.filter(e=>e.groupSaved):events,intent).slice(0,6);
    return {reply:list.length?list.map((e,i)=>eventSummary(e,i+1)).join('\n\n')+'\n\nAll times Pacific. Text “save 1”, “details 1”, or “attend 1”.':'No matching free events in the current WTM feed. Try another date or SF.',last:list.map(e=>e.id),writes:[]};
  }
  if(intent.action==='create_plan'){
    let p;try{p=validatePlan({...intent.plan,host:actor.name,free:true,accessible:true});}catch(e){return {reply:'I need a valid free friend plan: '+e.message+' Please include title, location, start and end time.',writes:[]};}
    const id='agent-'+digest(job.id).slice(0,32);
    return {reply:`Added “${p.title.trim()}” to WTM.\nhttps://wtm-rn.vercel.app`,writes:[sql`INSERT INTO plans(id,title,host,location,start,"end",description,tags,url,region,free,accessible,created_at) VALUES(${id},${p.title.trim()},${actor.name},${p.location.trim()},${p.start},${p.end},${p.description.trim()},${JSON.stringify(p.tags)},${p.url},${p.region||'campus'},TRUE,TRUE,NOW()) ON CONFLICT(id) DO NOTHING`]};
  }
  const event=events.find(e=>e.id===intent.eventId&&Date.parse(e.end||e.start)>=Date.now());
  if(!event)return {reply:'Which event? Ask for a list first, then use its number—for example “save 2”.',writes:[]};
  const keyEvent=moveKey(event),last=[event.id];
  if(intent.action==='details')return {reply:eventSummary(event)+'\n'+(event.description?.slice(0,900)||'Ask the host for details.')+'\nAttending: '+(event.going?.map(p=>p.name).join(', ')||'No one yet.'),last,writes:[]};
  if(intent.action==='save')return {reply:`Saved “${event.title}” for the group.`,last,writes:[sql`INSERT INTO group_moves(event_key,event) VALUES(${keyEvent},${JSON.stringify(event)}) ON CONFLICT(event_key) DO UPDATE SET event=EXCLUDED.event`]};
  if(intent.action==='unsave')return {reply:`Removed “${event.title}” from the group’s saved events.`,last,writes:[sql`DELETE FROM group_moves WHERE event_key=${keyEvent}`]};
  if(!event.groupSaved)return {reply:'Save this event for the group first, then mark yourself attending.',last,writes:[]};
  return {reply:intent.action==='attend'?`${actor.name}, you’re attending “${event.title}”.`:`Removed your attendance for “${event.title}”.`,last,writes:[intent.action==='attend'?sql`INSERT INTO attendees(event_key,member_id) VALUES(${keyEvent},${actor.member_id}) ON CONFLICT DO NOTHING`:sql`DELETE FROM attendees WHERE event_key=${keyEvent} AND member_id=${actor.member_id}`]};
}
export async function processJob(id,{send=sendPhoton,sql:providedSql,remaining=6}={}){
  const sql=providedSql||await database();
  const [identity]=await sql`SELECT sender_key FROM agent_jobs WHERE id=${id}`;if(!identity)return;
  const [linked]=await sql`SELECT sender_key FROM agent_links WHERE sender_key=${identity.sender_key}`;
  if(linked){const locked=await sql`UPDATE agent_links SET busy_until=NOW()+INTERVAL '3 minutes' WHERE sender_key=${identity.sender_key} AND (busy_until IS NULL OR busy_until<NOW()) RETURNING sender_key`;if(!locked.length)return;}
  const [job]=await sql`UPDATE agent_jobs SET status='processing' WHERE id=${id} AND status IN ('pending','failed') RETURNING *`;
  if(!job){if(linked)await sql`UPDATE agent_links SET busy_until=NULL WHERE sender_key=${identity.sender_key}`;return;}
  try{
    if(!job.reply){
      let result;try{result=await buildReply(sql,job);}catch(e){result={reply:e.message?.startsWith('The free AI')||e.message?.startsWith('I couldn’t')||e.message?.startsWith('Please clarify')?e.message:'WTM couldn’t complete that request. Please try again.',writes:[]};}
      const writes=[...result.writes,sql`UPDATE agent_jobs SET reply=${result.reply},last_results=${JSON.stringify(result.last||null)} WHERE id=${id}`];
      if(result.last)writes.push(sql`UPDATE agent_links SET last_results=${JSON.stringify(result.last)} WHERE sender_key=${job.sender_key}`);
      await sql.transaction(writes);job.reply=result.reply;
    }
    await send(job.payload,job.reply);
    await sql`UPDATE agent_jobs SET status='sent' WHERE id=${id}`;
  }catch{await sql`UPDATE agent_jobs SET status='failed' WHERE id=${id}`;console.error('WTM agent reply failed; retained for retry.');}
  finally{if(linked)await sql`UPDATE agent_links SET busy_until=NULL WHERE sender_key=${identity.sender_key}`;}
  const [next]=await sql`SELECT id FROM agent_jobs WHERE sender_key=${identity.sender_key} AND status='pending' ORDER BY created_at LIMIT 1`;
  if(next&&remaining>1)await processJob(next.id,{send,sql,remaining:remaining-1});
}
export async function recoverAgent(){
  if(!process.env.SPECTRUM_PROJECT_ID||!process.env.SPECTRUM_PROJECT_SECRET)return;
  const sql=await database();
  await sql`UPDATE agent_jobs SET status='failed' WHERE status='processing' AND created_at<NOW()-INTERVAL '5 minutes'`;
  const jobs=await sql`SELECT id FROM agent_jobs WHERE status IN ('failed','pending') AND created_at>NOW()-INTERVAL '24 hours' ORDER BY created_at LIMIT 2`;
  for(const job of jobs)await processJob(job.id);
}
