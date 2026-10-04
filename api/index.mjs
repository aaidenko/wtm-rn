import {scanInbox,inboxConfigured} from '../lib/inbox.mjs';
import {scanCards} from '../lib/cards.mjs';
import {moveKey,memberName,memberCookie,readMember,mergeGroup} from '../lib/group.mjs';
import {scanPublicPages,SOURCE_DIRECTORY} from '../lib/sources.mjs';
import {normalize} from '../public/model.mjs';
import {admissionCache} from '../lib/admission-cache.mjs';
import {neon} from '@neondatabase/serverless';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {collect,validatePlan,validateCalendar,fetchCalendar,DEFAULT_CALENDARS} from '../lib/core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
let initialized=false;
async function database() {
  const sql=neon(process.env.DATABASE_URL);
  if(!initialized) {
    await sql`CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, title TEXT NOT NULL, host TEXT NOT NULL, location TEXT NOT NULL, start TIMESTAMPTZ NOT NULL, "end" TIMESTAMPTZ NOT NULL, description TEXT NOT NULL, tags JSONB NOT NULL, url TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT 'campus', created_at TIMESTAMPTZ NOT NULL)`;
    await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS free BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE plans ADD COLUMN IF NOT EXISTS accessible BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`CREATE INDEX IF NOT EXISTS plans_end ON plans("end")`;
    await sql`CREATE TABLE IF NOT EXISTS calendars (id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT UNIQUE NOT NULL,region TEXT NOT NULL,events JSONB NOT NULL DEFAULT '[]',updated_at TIMESTAMPTZ,last_error TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT UNIQUE NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS group_moves (event_key TEXT PRIMARY KEY,event JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS attendees (event_key TEXT NOT NULL REFERENCES group_moves(event_key) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,PRIMARY KEY(event_key,member_id))`;
    await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)`;
    const [seed]=await sql`SELECT value FROM settings WHERE key='club_sources_v2'`;
    if(!seed){
      const [legacy]=await sql`SELECT value FROM settings WHERE key='calendars_seeded'`;
      const additions=legacy?DEFAULT_CALENDARS.filter(c=>!['stanford-builders','luma-sf'].includes(c.id)):DEFAULT_CALENDARS;
      for(const c of additions)await sql`INSERT INTO calendars(id,name,url,region) VALUES(${c.id},${c.name},${c.url},${c.region}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO settings(key,value) VALUES('club_sources_v2','true') ON CONFLICT DO NOTHING`;
    }
    initialized=true;
  }
  return sql;
}
async function refresh(sql) {
  const calendars=await sql`SELECT id,name,url,region FROM calendars ORDER BY id LIMIT 12`;
  const [oldSnapshot]=await sql`SELECT data FROM snapshots WHERE id=1`;
  const now=Date.now(),cache=admissionCache(oldSnapshot?.data?.admissionCache||[],now);
  const campusPromise=collect(fetch,[],now,cache);
  const publicPromise=scanPublicPages(fetch,now,cache);
  const cardsPromise=scanCards(fetch,now,cache);
  const inboxPromise=scanInbox({previousLinks:oldSnapshot?.data?.inbox?.links||[],now,cache});
  const scans=Promise.all(calendars.map(async c=>{
    try{const events=await fetchCalendar(c,fetch,now,cache);await sql`UPDATE calendars SET events=${JSON.stringify(events)},updated_at=NOW(),last_error=NULL WHERE id=${c.id}`;}
    catch(e){await sql`UPDATE calendars SET last_error=${e.message} WHERE id=${c.id}`;}
  }));
  let data;try{data=await campusPromise;}catch(e){await scans;await publicPromise;await inboxPromise;await cardsPromise;throw e;}
  await scans;
  const publicSources=await publicPromise;data.external=publicSources.events;data.sourceReports=publicSources.reports;
  const cards=await cardsPromise;data.external.push(...cards.events);data.sourceReports.push(...cards.reports);
  if(cards.reports[0]?.last_error)data.external.push(...(oldSnapshot?.data?.external||[]).filter(e=>e.sourceId==='the-cards'&&Date.parse(e.end||e.start)>=Date.now()));
  const inbox=await inboxPromise;data.inbox=inbox;if(inbox.enabled)data.sourceReports.push({id:'wtm-inbox',name:'WTM inbox',updated_at:inbox.updatedAt,last_error:inbox.error});data.external.push(...inbox.events);
  if(inbox.error)data.external.push(...(oldSnapshot?.data?.inbox?.events||[]));
  data.baseEvents=normalize(data);data.admissionCache=cache.snapshot();data.scanStats={...cache.stats(),durationMs:Date.now()-now};
  await sql`INSERT INTO snapshots(id,data,updated_at) VALUES(1,${JSON.stringify(data)},${data.updatedAt}) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at`;
  await sql`DELETE FROM plans WHERE "end" < ${new Date(Date.now()-30*86400000).toISOString()}`;
  return data;
}
async function eventData(sql){
  const [row]=await sql`SELECT data FROM snapshots WHERE id=1`;
  let data=row?.data;
  if(!data){try{data=await refresh(sql);}catch{data={pages:[],external:[],updatedAt:null};}}
  const plans=await sql`SELECT * FROM plans WHERE "end" >= NOW() ORDER BY start LIMIT 500`;
  const calendars=await sql`SELECT events,last_error,name FROM calendars ORDER BY id`;
  const external=[...(data.external||[]),...calendars.flatMap(c=>c.events)];
  const feed=data.baseEvents?{external:[...data.baseEvents,...calendars.flatMap(c=>c.events)],plans}:{...data,external,plans};
  return {events:normalize(feed),updatedAt:data.updatedAt,sourceReports:data.sourceReports||[],warnings:[...(data.warnings||[]),...calendars.filter(c=>c.last_error).map(c=>`${c.name} couldn’t refresh; showing its last saved events.`),...(data.sourceReports||[]).filter(s=>s.last_error).map(s=>`${s.name} scan failed.`)]};
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  const send=(data,status=200)=>res.status(status).json(data);
  try {
    const path=String(req.query.path||'').replace(/^\//,'');
    const origin=new URL(req.url,`https://${req.headers.host}`).origin;
    if(req.method==='POST' || req.method==='DELETE') {
      if(req.headers.origin!==origin) return send({error:'Please submit through WTM.'},403);
    }
    if(path==='refresh' && req.method==='GET') {
      if(!process.env.CRON_SECRET || !eq(req.headers.authorization,`Bearer ${process.env.CRON_SECRET}`)) return send({error:'Unauthorized'},401);
      if(!process.env.DATABASE_URL) return send({error:'Connect a free Neon database in Vercel Storage.'},503);
      const data=await refresh(await database());return send({ok:true,updatedAt:data.updatedAt,warnings:data.warnings});
    }
    const code=process.env.GROUP_CODE;
    if(!code || code.length<8) return send({error:'The owner needs to set GROUP_CODE in Vercel (at least 8 characters).'},503);
    if(path==='session' && req.method==='POST') {
      if(!eq(req.body?.code,code)) return send({error:'That invite code didn’t match.'},401);
      res.setHeader('Set-Cookie',`wtm=${hash(code)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`);return send({ok:true});
    }
    const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('wtm='))?.slice(4);
    if(!eq(cookie,hash(code))) return send({error:'Enter your group’s invite code.'},401);
    if(path==='logout' && req.method==='POST') {res.setHeader('Set-Cookie','wtm=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return send({ok:true});}
    if(!process.env.DATABASE_URL) return send({error:'The owner needs to connect a free Neon database in Vercel Storage.'},503);
    const sql=await database();
    const currentMember=readMember(req.headers.cookie,code);
    if(path==='identity'&&req.method==='POST'){
      let name;try{name=memberName(req.body?.name);}catch(e){return send({error:e.message},400);}
      const id=currentMember||randomUUID();
      const [taken]=await sql`SELECT id FROM members WHERE name_key=${name.toLowerCase()}`;
      if(taken&&taken.id!==id)return send({error:'That name is already being used. Add your last name or an initial.'},409);
      await sql`INSERT INTO members(id,name,name_key) VALUES(${id},${name},${name.toLowerCase()}) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,name_key=EXCLUDED.name_key`;
      res.setHeader('Set-Cookie',memberCookie(id,code));return send({name});
    }
    if(path==='events'&&req.method==='GET'){
      const data=await eventData(sql);
      const moves=await sql`SELECT event_key FROM group_moves`;
      const going=await sql`SELECT a.event_key,a.member_id,m.name FROM attendees a JOIN members m ON m.id=a.member_id ORDER BY lower(m.name)`;
      const [member]=currentMember?await sql`SELECT name FROM members WHERE id=${currentMember}`:[];
      return send({...data,events:mergeGroup(data.events,moves,going,currentMember),member:member?.name||null});
    }
    if(path==='group-moves'&&req.method==='POST'){
      const data=await eventData(sql),event=data.events.find(e=>e.id===req.body?.eventId);
      if(!event||Date.parse(event.end||event.start)<Date.now())return send({error:'This event is no longer in the current free feed.'},409);
      await sql`INSERT INTO group_moves(event_key,event) VALUES(${moveKey(event)},${JSON.stringify(event)}) ON CONFLICT(event_key) DO UPDATE SET event=EXCLUDED.event`;
      return send({ok:true},201);
    }
    if(path==='group-moves'&&req.method==='DELETE'){
      const data=await eventData(sql),event=data.events.find(e=>e.id===req.body?.eventId);
      if(event)await sql`DELETE FROM group_moves WHERE event_key=${moveKey(event)}`;
      return send({ok:true});
    }
    if(path==='attendance'&&(req.method==='POST'||req.method==='DELETE')){
      if(!currentMember)return send({error:'Add your name before marking Going.'},409);
      const [member]=await sql`SELECT id FROM members WHERE id=${currentMember}`;if(!member)return send({error:'Add your name before marking Going.'},409);
      const data=await eventData(sql),event=data.events.find(e=>e.id===req.body?.eventId);
      if(!event)return send({error:'This event is no longer in the current free feed.'},409);
      const key=moveKey(event),[move]=await sql`SELECT event_key FROM group_moves WHERE event_key=${key}`;
      if(!move)return send({error:'Save this event to the group first.'},409);
      if(req.method==='POST')await sql`INSERT INTO attendees(event_key,member_id) VALUES(${key},${currentMember}) ON CONFLICT DO NOTHING`;
      else await sql`DELETE FROM attendees WHERE event_key=${key} AND member_id=${currentMember}`;
      return send({ok:true});
    }
    if(path==='calendars' && req.method==='GET'){
      const calendars=await sql`SELECT id,name,region,updated_at,last_error,events FROM calendars ORDER BY name`;
      const [snapshot]=await sql`SELECT updated_at,data FROM snapshots WHERE id=1`;
      return send({inbox:{enabled:inboxConfigured(process.env),updatedAt:snapshot?.data?.inbox?.updatedAt||null,error:snapshot?.data?.inbox?.error||null},sources:SOURCE_DIRECTORY,reports:snapshot?.data?.sourceReports||[],calendars:[{id:'stanford',name:'Stanford Events',region:'campus',updated_at:snapshot?.updated_at||null,builtin:true},...calendars.map(({events,...c})=>({...c,eligible_count:events.filter(e=>e.free&&e.accessible).length,unverified_count:events.filter(e=>e.verificationError).length}))]});
    }
    if(path==='calendars' && req.method==='POST'){
      const [{count}]=await sql`SELECT COUNT(*)::int AS count FROM calendars`;if(count>=12)return send({error:'You can follow up to 12 additional calendars. Remove one first.'},400);
      let c,events;try{c=validateCalendar(req.body);events=await fetchCalendar(c);}catch(e){return send({error:e.message},400);}
      const id=randomUUID();
      const inserted=await sql`INSERT INTO calendars(id,name,url,region,events,updated_at) VALUES(${id},${c.name},${c.url},${c.region},${JSON.stringify(events)},NOW()) ON CONFLICT(url) DO NOTHING RETURNING id`;
      if(!inserted.length)return send({error:'This calendar is already in your feed.'},409);
      // Stable source IDs let removing a calendar remove its imported events immediately.
      await sql`UPDATE calendars SET events=${JSON.stringify(events.map(e=>({...e,sourceId:id})))} WHERE id=${id}`;
      return send({id,count:events.length},201);
    }
    if(path.startsWith('calendars/') && req.method==='DELETE'){
      await sql`DELETE FROM calendars WHERE id=${path.slice(10)}`;return send({ok:true});
    }
    if(path==='plans' && req.method==='POST') {
      if(Number(req.headers['content-length']||0)>10000) return send({error:'Plan is too long'},413);
      let p;try{p=validatePlan(req.body);}catch(e){return send({error:e.message},400);}
      const id=randomUUID();
      await sql`INSERT INTO plans(id,title,host,location,start,"end",description,tags,url,region,free,accessible,created_at) VALUES(${id},${p.title.trim()},${p.host.trim()},${p.location.trim()},${p.start},${p.end},${p.description.trim()},${JSON.stringify(p.tags)},${p.url},${p.region||"campus"},TRUE,TRUE,NOW())`;
      return send({id},201);
    }
    if(path.startsWith('plans/') && req.method==='DELETE') {await sql`DELETE FROM plans WHERE id=${path.slice(6)}`;return send({ok:true});}
    return send({error:'Not found'},404);
  }catch(e){console.error('WTM error:',e.message);return send({error:'WTM couldn’t complete that request. Please try again.'},503);}
}
