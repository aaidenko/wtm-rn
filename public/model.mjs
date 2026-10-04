import {admission,studentAccess} from './eligibility.mjs';
export const TOPICS={
  'Startups':/\b(startups?|founders|founder (?:meetup|networking|dinner|pitch)|entrepreneur\w*|venture capital|pitch competition|startup accelerator|VC)\b/i,
  'Trading':/\b(trading|quantitative finance|quants?|financial markets?|hedge funds?|stock markets?|fintech|market microstructure|portfolio management|asset pricing)\b/i,
  'CS':/\b(computer science|computing|software|programming|algorithms?|hackathon|cybersecurity|distributed systems|CS\s?\d*)\b/i,
  'AI':/\b(AI|artificial intelligence|machine learning|deep learning|LLMs?|language models?|neural networks?|robotics)\b/i,
  'Research':/\b(research|seminar|colloquium|symposium|scientific|doctoral|lab meeting)\b/i,
  'Food & drinks':/\b(food|drinks?|coffee|dinner|lunch|breakfast|brunch|pizza|refreshments|boba|beer|wine|cocktails?|tasting)\b/i
};
export const zone='America/Los_Angeles';
export const SCAN_DAYS=30;
export function dateDays(start,days){const noon=Date.parse(stanfordTime(start+'T12:00'));return Array.from({length:days},(_,i)=>dateKey(noon+i*86400000));}
export function horizonEnd(now=Date.now()){return Date.parse(stanfordTime(dateDays(dateKey(now),SCAN_DAYS+1).at(-1)+'T00:00'));}
export function timeContext(now=Date.now()){
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',hourCycle:'h23'}).format(new Date(now)));
  return hour>=5&&hour<12?'this morning':hour>=12&&hour<17?'this afternoon':'tonight';
}
export function dateKey(date) {return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));}
export function classify(event) {const text=[event.title,event.description,...(event.tags||[])].join(' ');return Object.keys(TOPICS).filter(k=>TOPICS[k].test(text));}
export function safeURL(value) {try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function normalize(data) {
  const result=[],seen=new Set();
  for(const page of data.pages||[]) for(const wrapper of page.events||[]) {
    const e=wrapper.event;
    if(!e || /cancel|postpon/i.test(e.status||'')) continue;
    for(const instance of e.event_instances||[]) {
      const t=instance.event_instance;
      if(!t?.start||!Number.isFinite(Date.parse(t.start))) continue;
      const id=`stanford:${e.id}:${t.id||t.start}`;if(seen.has(id))continue;seen.add(id);
      const tags=Object.values(e.filters||{}).flat().map(f=>f.name).filter(Boolean);
      const eligible=admission(e.description_text||'',e.ticket_cost,e.free);
      if(eligible.free&&e.wtm_free_evidence)eligible.freeEvidence=e.wtm_free_evidence;
      const access=studentAccess(e.description_text||'',{audiences:(e.filters?.event_audience||[]).map(a=>a.name)});
      const department=(e.departments||[]).find(d=>/Human-Centered|Computer Science|HAI/i.test(d.name));
      result.push({id,title:e.title,description:e.description_text||'',location:e.location_name||e.location||'See event page',start:t.start,end:t.end,allDay:!!t.all_day,...eligible,...access,url:safeURL(e.localist_url),image:safeURL(e.photo_url),tags,source:'campus',region:'campus',sourceName:department?.name||'Stanford Events',price:e.ticket_cost||''});
    }
  }
  for(const e of data.external||[]){const key=e.id+':'+(e.region||'campus');if(seen.has(key))continue;seen.add(key);result.push({...e,url:safeURL(e.url),image:safeURL(e.image)});}
  for(const p of data.plans||[])result.push({...p,id:`friend:${p.id}`,source:'friends',sourceName:`${p.host}’s plan`,free:p.free===true,accessible:p.accessible===true,access:'Stanford students · confirmed by friend',freeEvidence:'Confirmed by friend',image:'',url:safeURL(p.url)});
  return result.filter(e=>e.free===true&&e.accessible===true).filter((e,i,all)=>all.findIndex(x=>x.url&&x.url===e.url&&x.start===e.start)===i||!e.url).map(e=>({...e,topics:classify(e)}));
}
export function select(events,{day='week',today=dateKey(Date.now()),interests=Object.keys(TOPICS),matched=true,source='all',region='all',search='',free=false,saved=[],sort='match',now=Date.now()}) {
  const range=['week','month'].includes(day),lastDay=range?dateDays(today,(day==='month'?SCAN_DAYS:7)+1).at(-1):null;
  return events.filter(e=>{
    if(e.free!==true||e.accessible!==true)return false;
    const eventDay=dateKey(e.start),end=e.end?Date.parse(e.end):Date.parse(e.start)+(e.allDay?86400000:7200000);
    if(end<now && !(e.allDay&&eventDay===today))return false;
    if(!range&&!eventOnDay(e,day))return false;
    if(range&&(dateKey(Math.max(Date.parse(e.start),end-1))<today||eventDay>=lastDay))return false;
    if(source==='saved'&&!saved.includes(e.id))return false;
    if(region!=='all'&&(e.region||'campus')!==region)return false;
    if(source==='campus'&&e.source==='friends')return false;
    if(source==='friends'&&e.source!=='friends')return false;
    if(free&&!e.free)return false;
    if(matched&&e.source!=='friends'&&!e.topics.some(t=>interests.includes(t)))return false;
    return `${e.title} ${e.location} ${e.description}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a,b)=>{
    if(sort==='match'){
      const score=e=>e.topics.filter(t=>interests.includes(t)).length;
      const diff=score(b)-score(a);if(diff)return diff;
    }
    return Date.parse(a.start)-Date.parse(b.start);
  });
}
export function eventOnDay(event,day){
  const start=Date.parse(event.start),parsedEnd=Date.parse(event.end);
  const end=Number.isFinite(parsedEnd)&&parsedEnd>start?parsedEnd:start+(event.allDay?86400000:7200000);
  return dateKey(start)<=day&&dateKey(end-1)>=day;
}
export function stanfordTime(value) {
  // Convert datetime-local in Stanford's timezone, independent of the viewer's timezone.
  const guess=Date.parse(value+'Z');if(!Number.isFinite(guess))throw new Error('Choose a valid time.');
  let utc=guess;
  for(let i=0;i<3;i++) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const local=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const delta=guess-local;if(delta===0)return new Date(utc).toISOString();utc+=delta;
  }
  throw new Error('That time falls in a daylight-saving clock change. Choose another time.');
}
export function planTimes(startValue,endValue,now=Date.now()) {
  const start=Date.parse(startValue),end=Date.parse(endValue);
  if(!Number.isFinite(start))throw new Error('Choose a valid start date and time.');
  if(!Number.isFinite(end))throw new Error('Choose a valid end date and time.');
  if(start<now-3600000)throw new Error('The start time is in the past. Choose a future start, or one within the past hour for a plan already underway.');
  if(start>now+90*86400000)throw new Error('Choose a start date within the next 90 days.');
  if(end<=start)throw new Error('The end must be after the start. For a plan past midnight, choose the next day as the end date.');
  if(end<=now)throw new Error('This plan has already ended. Choose an end time in the future.');
  if(end>now+90*86400000)throw new Error('Choose an end date within the next 90 days.');
  return {start:new Date(start).toISOString(),end:new Date(end).toISOString()};
}
export function stanfordLocalTime(value) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
