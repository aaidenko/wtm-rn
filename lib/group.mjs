import {createHmac,timingSafeEqual} from 'node:crypto';
export const moveKey=e=>`${e.url||e.id}|${new Date(e.start).toISOString()}`;
export function memberName(value){
  if(typeof value!=='string')throw new Error('Enter your name.');
  const name=value.normalize('NFKC').replace(/\s+/g,' ').trim();
  if(!name||name.length>40||/[\u0000-\u001f<>]/.test(name))throw new Error('Use a name between 1 and 40 characters.');return name;
}
const sign=(id,secret)=>createHmac('sha256',secret).update('wtm-member:'+id).digest('hex');
export const memberCookie=(id,secret)=>`wtm_member=${id}.${sign(id,secret)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`;
export function readMember(cookie,secret){
  const value=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('wtm_member='))?.slice(11);
  const [id,sig]=String(value||'').split('.');if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(sig||''))return null;
  const expected=sign(id,secret);return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?id:null;
}
export function mergeGroup(events,moves,attendees,member){
  const saved=new Map(moves.map(m=>[m.event_key,m]));
  return events.map(e=>{const key=moveKey(e),move=saved.get(key);return {...e,groupSaved:!!move,going:move?attendees.filter(a=>a.event_key===key).map(a=>({name:a.name,me:a.member_id===member})):[]};});
}
