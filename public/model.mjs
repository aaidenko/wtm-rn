export const TOPICS={
  'Startups':/\b(startups?|founders|founder (?:meetup|networking|dinner|pitch)|entrepreneur\w*|venture capital|pitch competition|startup accelerator|VC)\b/i,
  'Trading':/\b(trading|quantitative finance|quants?|financial markets?|hedge funds?|stock markets?|fintech|market microstructure|portfolio management|asset pricing)\b/i,
  'CS':/\b(computer science|computing|software|programming|algorithms?|hackathon|cybersecurity|distributed systems|CS\s?\d*)\b/i,
  'AI':/\b(AI|artificial intelligence|machine learning|deep learning|LLMs?|language models?|neural networks?|robotics)\b/i,
  'Research':/\b(research|seminar|colloquium|symposium|scientific|doctoral|lab meeting)\b/i,
  'Food & drinks':/\b(food|drinks?|coffee|dinner|lunch|breakfast|brunch|pizza|refreshments|boba|beer|wine|cocktails?|tasting)\b/i
};
export const zone='America/Los_Angeles';
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
      result.push({id,title:e.title,description:e.description_text||'',location:e.location_name||e.location||'See event page',start:t.start,end:t.end,allDay:!!t.all_day,free:e.free===true,url:safeURL(e.localist_url),image:safeURL(e.photo_url),tags,source:'campus',region:'campus',sourceName:'Stanford Events',price:e.ticket_cost||''});
    }
  }
  for(const e of data.external||[]){const key=e.id+':'+(e.region||'campus');if(seen.has(key))continue;seen.add(key);result.push({...e,url:safeURL(e.url),image:safeURL(e.image)});}
  for(const p of data.plans||[])result.push({...p,id:`friend:${p.id}`,source:'friends',sourceName:`${p.host}’s plan`,free:false,image:'',url:safeURL(p.url)});
  return result.map(e=>({...e,topics:classify(e)}));
}
export function select(events,{day='week',today=dateKey(Date.now()),interests=Object.keys(TOPICS),matched=true,source='all',region='all',search='',free=false,saved=[],sort='match',now=Date.now()}) {
  return events.filter(e=>{
    const eventDay=dateKey(e.start),end=e.end?Date.parse(e.end):Date.parse(e.start)+(e.allDay?86400000:7200000);
    if(end<now && !(e.allDay&&eventDay===today))return false;
    if(day!=='week'&&eventDay!==day)return false;
    if(day==='week'&&(eventDay<today||Date.parse(e.start)>now+7*86400000))return false;
    if(source==='saved'&&!saved.includes(e.id))return false;
    if(region!=='all'&&(e.region||'campus')!==region)return false;
    if(source==='campus'&&e.source==='friends')return false;
    if(source==='friends'&&e.source!=='friends')return false;
    if(free&&!e.free)return false;
    if(matched&&e.source!=='friends'&&!e.topics.some(t=>interests.includes(t)))return false;
    return `${e.title} ${e.location} ${e.description}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a,b)=>{
    if(sort==='match'){
      const score=e=>e.topics.filter(t=>interests.includes(t)).reduce((sum,t)=>sum+(t==='Research'?1:t==='Food & drinks'?2:4),0)+(e.source==='friends'?3:0);
      const diff=score(b)-score(a);if(diff)return diff;
    }
    return Date.parse(a.start)-Date.parse(b.start);
  });
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
