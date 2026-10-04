import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyPhoton,incomingMessage,explicitCommand,interpret,findEvents,validateIntent} from '../lib/agent.mjs';
const now=Date.parse('2026-10-04T20:00:00Z'),secret='test-secret',raw=Buffer.from('{ "event": "messages" }'),timestamp=String(now/1000);
const headers={'x-spectrum-timestamp':timestamp,'x-spectrum-signature':'v0='+createHmac('sha256',secret).update(`v0:${timestamp}:`).update(raw).digest('hex')};
test('Photon verifies exact bytes and rejects forged, stale and malformed signatures',()=>{
 assert.equal(verifyPhoton(raw,headers,secret,now),true);
 assert.equal(verifyPhoton(Buffer.from('{"event":"messages"}'),headers,secret,now),false);
 assert.equal(verifyPhoton(raw,headers,'wrong',now),false);
 assert.equal(verifyPhoton(raw,headers,secret,now+301000),false);
 for(const value of ['v0=é','wrong','',null])assert.equal(verifyPhoton(raw,{...headers,'x-spectrum-signature':value},secret,now),false);
});
const delivery={event:'messages',space:{id:'opaque-space',type:'dm',platform:'imessage',phone:'shared'},message:{id:'opaque-message',direction:'inbound',sender:{id:'+15550000000'},content:{type:'text',text:'saved'}}};
test('Only inbound text DMs can trigger the agent',()=>{
 assert.equal(incomingMessage(delivery).text,'saved');
 assert.equal(incomingMessage({...delivery,space:{...delivery.space,type:'group'}}),null);
 assert.equal(incomingMessage({...delivery,message:{...delivery.message,direction:'outbound'}}),null);
 assert.equal(incomingMessage({...delivery,message:{...delivery.message,content:{type:'reaction'}}}),null);
});
test('Numbered actions only resolve existing results and never fabricate an event ID',()=>{
 assert.equal(explicitCommand('save 2',['one','two']).eventId,'two');assert.equal(explicitCommand('attend 5',['one']),null);
 assert.equal(explicitCommand('saved').action,'moves');assert.equal(explicitCommand('delete everything'),null);
});
const base={action:'find',eventId:'',query:'',day:'tomorrow',region:'campus',topics:['AI'],message:'',plan:null};
const events=[{id:'one',title:'AI meetup',location:'Gates',topics:['AI'],region:'campus',free:true,accessible:true,start:'2026-10-05T19:00:00Z',end:'2026-10-05T20:00:00Z'}];
test('Search uses Pacific days and excludes paid, inaccessible and wrong region events',()=>{
 const all=[...events,{...events[0],id:'paid',free:false},{...events[0],id:'restricted',accessible:false},{...events[0],id:'sf',region:'sf'}];
 assert.deepEqual(findEvents(all,base,now).map(e=>e.id),['one']);assert.deepEqual(findEvents(all,{...base,day:'2026-12-01'},now),[]);
});
test('Model results are validated and private context is omitted from the request',async()=>{
 let request,modelURL;
 const result=await interpret('AI events tomorrow',{events,last:['one'],now},{GEMINI_API_KEY:'fake'},async(url,opts)=>{modelURL=url;request=JSON.parse(opts.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(base)}]}}]})};});
 assert.equal(result.action,'find');assert.match(modelURL,/models\/gemini-3\.5-flash-lite:generateContent$/);assert.equal(request.generationConfig.responseMimeType,'application/json');assert.equal(JSON.stringify(request).includes('fake'),false);
 assert.throws(()=>validateIntent({...base,action:'delete'}));assert.throws(()=>validateIntent({...base,region:'elsewhere'}));
 await assert.rejects(()=>interpret('something',{events,now},{GEMINI_API_KEY:'fake'},async()=>({ok:false,status:429,json:async()=>({error:{message:'Quota exhausted'}})})),/quota/);
});
test('Basic commands work without a model subscription or API key',async()=>{
 assert.equal((await interpret('save 1',{events,last:['one'],now},{},()=>{throw new Error('unexpected API call');})).action,'save');
 assert.equal((await interpret('casual prompt',{events,now},{})).action,'help');
});
import {processJob} from '../lib/agent-service.mjs';
import {moveKey} from '../lib/group.mjs';
function serviceStore(text){
 const event={...events[0],start:'2099-10-05T19:00:00Z',end:'2099-10-05T20:00:00Z',source:'campus',url:'https://events.stanford.edu/event/test',description:''};
 const state={status:'pending',reply:null,writes:[],sent:[],lock:false};
 const query=(strings,...values)=>({text:strings.join('?'),values,then(resolve,reject){return execute(this).then(resolve,reject);}});
 async function execute(q){
  const s=q.text,v=q.values;
  if(s.includes('SELECT sender_key FROM agent_jobs'))return [{sender_key:'sender'}];
  if(s.includes('SELECT sender_key FROM agent_links'))return [{sender_key:'sender'}];
  if(s.includes('SET busy_until=NOW()')){if(state.lock)return [];state.lock=true;return [{sender_key:'sender'}];}
  if(s.includes('SET busy_until=NULL')){state.lock=false;return [];}
  if(s.includes("SET status='processing'")){if(state.status!=='pending'&&state.status!=='failed')return [];state.status='processing';return [{id:'job',sender_key:'sender',payload:{text},reply:state.reply}];}
  if(s.includes('SELECT l.member_id'))return [{member_id:'only-this-member',name:'Test friend',last_results:['one']}];
  if(s.includes('COUNT(*)'))return [{count:1}];
  if(s.includes('SELECT data FROM snapshots'))return [{data:{baseEvents:[event],updatedAt:'2099-10-01T00:00:00Z'}}];
  if(s.includes('SELECT * FROM plans')||s.includes('SELECT events,last_error,name FROM calendars'))return [];
  if(s.includes('SELECT event_key FROM group_moves'))return [{event_key:moveKey(event)}];
  if(s.includes('SELECT a.event_key'))return [];
  if(s.includes('INSERT INTO attendees')||s.includes('DELETE FROM attendees')){state.writes.push(q);return [];}
  if(s.includes('UPDATE agent_jobs SET reply=')){state.reply=v[0];return [];}
  if(s.includes('SET last_results='))return [];
  if(s.includes("SET status='sent'")){state.status='sent';return [];}
  if(s.includes("SET status='failed'")){state.status='failed';return [];}
  if(s.includes('SELECT id FROM agent_jobs'))return [];
  throw new Error('Unexpected test query: '+s);
 }
 query.transaction=async statements=>{const results=[];for(const q of statements)results.push(await execute(q));return results;};
 return {sql:query,state};
}
test('Attendance only writes the linked member and repeated deliveries do not repeat changes',async()=>{
 const {sql,state}=serviceStore('attend 1'),send=async(payload,reply)=>state.sent.push(reply);
 await processJob('job',{sql,send});await processJob('job',{sql,send});
 assert.equal(state.writes.length,1);assert.equal(state.writes[0].values[1],'only-this-member');assert.equal(state.sent.length,1);assert.match(state.reply,/you’re attending/);
});
test('A failed reply retries its stored answer without repeating the website mutation',async()=>{
 const {sql,state}=serviceStore('unattend 1');
 await processJob('job',{sql,send:async()=>{throw new Error('network');}});assert.equal(state.status,'failed');
 await processJob('job',{sql,send:async(payload,reply)=>state.sent.push(reply)});
 assert.equal(state.status,'sent');assert.equal(state.writes.length,1);assert.equal(state.sent.length,1);
});

test('Provider diagnostics retain the failure status and redact API keys',async()=>{
 const key='AIza-secret-test';
 await assert.rejects(()=>interpret('AI tomorrow',{events,now},{GEMINI_API_KEY:key},async()=>({ok:false,status:403,json:async()=>({error:{message:'Invalid key '+key}})})),error=>error.providerStatus===403&&!error.providerDiagnostic.includes(key)&&error.providerDiagnostic.includes('[redacted]'));
});
