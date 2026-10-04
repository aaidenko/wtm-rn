import ICAL from 'ical.js';
import {stanfordTime} from '../public/model.mjs';
import {admission,studentAccess} from '../public/eligibility.mjs';
import {lumaData,publicText,enrichLuma} from './sources.mjs';
export const DEFAULT_CALENDARS=[
  {id:'ai-club-speakers',name:'Stanford AI Club · speaker host',url:'https://api.luma.com/ics/get?entity=calendar&id=cal-op77VYlbqcFMFa4',region:'campus'},
  {id:'bases',name:'BASES',url:'https://api.luma.com/ics/get?entity=calendar&id=cal-ojoAmEYmoppvMZc',region:'campus'},
  {id:'saga',name:'SAGA',url:'https://calendar.google.com/calendar/ical/2f2e750929407305cd05164ad3c3edbc74743102ac7afc90dfaeca11c1a4edee%40group.calendar.google.com/public/basic.ics',region:'campus'},
  {id:'hai',name:'Stanford HAI',url:'https://events.stanford.edu/department/hai/calendar.ics',region:'campus'},
  {id:'stanford-builders',name:'Stanford xBuilders',url:'https://api.luma.com/ics/get?entity=calendar&id=cal-DfxdbGjId7tPUia',region:'campus'},
  {id:'luma-sf',name:'Luma · San Francisco',url:'https://api.luma.com/ics/get?entity=discover&id=discplace-BDj7GNbGlsF7Cka',region:'sf'}
];
export function validateCalendar(p){
  if(typeof p?.name!=='string'||p.name.trim().length<2||p.name.length>80)throw new Error('Give your calendar a name (2–80 characters).');
  if(!['campus','sf'].includes(p.region))throw new Error('Choose Stanford & nearby or SF.');
  if(typeof p.url!=='string'||p.url.length>2000)throw new Error('Enter a calendar subscription link.');
  let u;try{u=new URL(p.url.trim().replace(/^webcal:\/\//i,'https://'));}catch{throw new Error('Enter a valid calendar subscription link.');}
  const luma=['api.luma.com','api.lu.ma'].includes(u.hostname)&&u.pathname==='/ics/get'&&['calendar','discover'].includes(u.searchParams.get('entity'))&&u.searchParams.has('id');
  const lumaPage=['luma.com','lu.ma'].includes(u.hostname)&&/^\/[\w-]+\/?$/.test(u.pathname)&&!u.search;
  const google=u.hostname==='calendar.google.com'&&u.pathname.startsWith('/calendar/ical/')&&u.pathname.endsWith('.ics');
  const stanford=u.hostname==='events.stanford.edu'&&(u.pathname.endsWith('.ics')||u.searchParams.get('format')==='ics');
  const outlook=['outlook.office365.com','outlook.live.com','outlook.office.com'].includes(u.hostname)&&u.pathname.endsWith('.ics');
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(luma||lumaPage||google||stanford||outlook))throw new Error('Use a Luma, Google, Stanford, or Outlook iCal subscription link. You can also paste a public Luma calendar or event page.');
  return {name:p.name.trim(),url:u.href,region:p.region,source:(luma||lumaPage)?'luma':'calendar',page:lumaPage};
}
export const tags = ['Startups','Trading','CS','AI','Research','Food & drinks','Hangout'];
export function safeLink(value) {
  if(!value) return '';
  try {const u=new URL(value); return u.protocol==='https:' ? u.href : '';} catch {return '';}
}
export function validatePlan(p, now=Date.now()) {
  if(!p || typeof p!=='object') throw new Error('Check your plan.');
  for(const [key,min,max] of [['title',2,120],['host',1,50],['location',2,180],['description',0,1500]]) if(typeof p[key]!=='string'||p[key].trim().length<min||p[key].length>max) throw new Error(`Check ${key}.`);
  const start=Date.parse(p.start),end=Date.parse(p.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<now-3600000||start>now+90*86400000||end<=start||end-start>86400000) throw new Error('Choose a future start and an end within 24 hours.');
  if(!Array.isArray(p.tags)||p.tags.length>tags.length||p.tags.some(t=>!tags.includes(t))) throw new Error('Check your tags.');
  if(p.free!==true||p.accessible!==true)throw new Error('Plans must be free and open to Stanford students. Confirm both before posting.');
  if(p.url && !safeLink(p.url)) throw new Error('Use an HTTPS event link.');
  if(p.region && !['campus','sf'].includes(p.region))throw new Error('Choose a valid location category.');
  return {...p,start:new Date(start).toISOString(),end:new Date(end).toISOString(),url:safeLink(p.url),tags:[...new Set(p.tags)]};
}
export function parseFeed(text, sourceName, now=Date.now(),source='luma',region='campus',sourceId='') {
  const root=new ICAL.Component(ICAL.parse(text));
  if(root.name!=='vcalendar') throw new Error('Invalid calendar');
  for(const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
  const results=[];
  for(const c of root.getAllSubcomponents('vevent')) {
    const e=new ICAL.Event(c);
    if(c.getFirstPropertyValue('status')==='CANCELLED') continue;
    // Recurring public feeds are expanded for the next week, with a bounded iteration.
    const it=e.isRecurring()?e.iterator():null;
    for(let i=0;i<(it?10000:1);i++) {
      const time=it?it.next():e.startDate; if(!time) break;
      const detail=it?e.getOccurrenceDetails(time):{startDate:e.startDate,endDate:e.endDate};
      const iso=t=>t.isDate?stanfordTime(`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}T00:00`):t.toJSDate().toISOString();
      const start=iso(detail.startDate),end=iso(detail.endDate);
      if(Date.parse(start)>now+7*86400000) break;
      if(Date.parse(end)<now-86400000) continue;
      const description=(e.description||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'');
      const eligibility=admission(description);const access=studentAccess(description,{publicRegistration:source==='luma'});
      const eventURL=safeLink(c.getFirstPropertyValue('url'))||safeLink(description.match(/https:\/\/(?:luma\.com|lu\.ma)\/[^\s<>]+/)?.[0]);
      results.push({id:`${source}:${e.uid}:${start}`,title:e.summary||'Calendar event',description,location:e.location||'See event page',start,end,allDay:detail.startDate.isDate,url:eventURL,source,sourceId,region,sourceName,...eligibility,...access, timeTBD:/time[: ]*TBD/i.test(description)});
    }
  }
  return results;
}
export async function fetchCalendar(feed,fetcher=fetch,now=Date.now()){
  let p=validateCalendar(typeof feed==='string'?{url:feed,name:'Luma calendar',region:'campus'}:feed);
  if(p.page){
    const html=await publicText(p.url,fetcher),data=lumaData(html);
    if(data.kind==='event'){
      const {parseLumaEvent}=await import('./sources.mjs');
      return [parseLumaEvent(html,{sourceName:p.name,region:p.region,sourceId:feed.id||''},now)];
    }
    if(data.kind!=='calendar'||!data.data.calendar?.api_id)throw new Error('Use a public Luma calendar or event page.');
    p={...p,url:'https://api.luma.com/ics/get?entity=calendar&id='+encodeURIComponent(data.data.calendar.api_id)};
  }
  const text=await publicText(p.url,fetcher);
  const events=parseFeed(text,p.name,now,p.source,p.region,feed.id||'');
  if(p.source==='luma')return (await enrichLuma(events,fetcher,now,AbortSignal.timeout(35000))).events;
  return events;
}
export async function collect(fetcher=fetch, feeds=[], now=Date.now()) {
  const get=async page=>{
    const r=await fetcher(`https://events.stanford.edu/api/2/events?days=7&pp=100&page=${page}`,{signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error(`Stanford returned ${r.status}`);
    const d=await r.json(); if(!Array.isArray(d.events)||!d.page) throw new Error('Unexpected Stanford format');return d;
  };
  const first=await get(1),total=Number(first.page.total)||1;
  if(total>10) throw new Error('Too many Stanford pages');
  const pages=[first,...await Promise.all(Array.from({length:total-1},(_,i)=>get(i+2)))];
  const external=[],warnings=[];
  await Promise.all(feeds.slice(0,8).map(async feed=>{
    try {
      external.push(...await fetchCalendar(feed,fetcher,now));
    }catch {warnings.push('A Luma calendar could not refresh. Check the source calendar for updates.');}
  }));
  return {pages,external,warnings,updatedAt:new Date(now).toISOString()};
}
