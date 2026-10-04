import {parseDocument,DomUtils} from 'htmlparser2';
import {admission,studentAccess} from '../public/eligibility.mjs';
import {safeURL,horizonEnd} from '../public/model.mjs';
import {publicText,readLumaEvent} from './sources.mjs';

export const CARDS_URL='https://ose.stanford.edu/cards';
// The current edition is embedded by ASSU's official In The Cards page.
export const CARDS_EDITION='https://itc.joshuabahk.workers.dev/';
const hosts=new Set(['luma.com','lu.ma','partiful.com','events.stanford.edu','arborlive.stanford.edu','www.hoover.org','hoover.org','monarchonstage.com','dancebreak.stanford.edu']);
const text=n=>DomUtils.textContent(n).replace(/\s+/g,' ').trim();
export function cardsEventURL(value){
  try{
    let u=new URL(value);
    if(u.hostname==='www.google.com'&&u.pathname==='/url')u=new URL(u.searchParams.get('q')||u.searchParams.get('url'));
    if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname))return '';
    if(['luma.com','lu.ma'].includes(u.hostname)&&!/^\/[\w-]+\/?$/.test(u.pathname))return '';
    if(u.hostname==='partiful.com'&&!/^\/e\/[\w-]+\/?$/.test(u.pathname))return '';
    if(u.hostname==='events.stanford.edu'&&!u.pathname.startsWith('/event/'))return '';
    if(['luma.com','lu.ma','partiful.com','events.stanford.edu'].includes(u.hostname))u.search='';
    u.hash='';return u.href;
  }catch{return '';}
}
export function cardsLinks(html){
  const root=parseDocument(html),main=DomUtils.findOne(n=>n.name==='main',root.children)||root;
  const links=DomUtils.findAll(n=>n.name==='a'&&!!n.attribs?.href,main.children);
  const supported=[],unsupported=new Set();
  for(const a of links){
    const url=cardsEventURL(a.attribs.href);
    if(url&&!supported.includes(url))supported.push(url);
    else if(!url&&/^https:\/\/(?:drive\.google\.com|docs\.google\.com|forms\.gle|tinyurl\.com|formlimit\.)/.test(a.attribs.href))unsupported.add(a.attribs.href);
  }
  return {links:supported,unsupported:unsupported.size};
}
export function structuredCardsEvents(html,url,now=Date.now()){
  const root=parseDocument(html),scripts=DomUtils.findAll(n=>n.name==='script'&&n.attribs?.type==='application/ld+json',root.children);
  const objects=[];
  const visit=(x,depth=0)=>{if(depth>12||!x)return;if(Array.isArray(x)){for(const v of x)visit(v,depth+1);return;}if(typeof x!=='object')return;
    if([].concat(x['@type']||[]).some(t=>/(?:^|\/)\w*Event$/.test(t)))objects.push(x);
    for(const key of ['@graph','mainEntity','itemListElement','item','subEvent'])visit(x[key],depth+1);
  };
  for(const s of scripts){try{visit(JSON.parse(DomUtils.textContent(s)));}catch{}}
  const result=[],lastStart=horizonEnd(now);
  for(const e of objects){
    const start=Date.parse(e.startDate),end=e.endDate?Date.parse(e.endDate):start;
    // Missing/ambiguous dates and stale weekly headings never become invented events.
    if(typeof e.startDate!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(e.startDate)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||end<now||start>=lastStart||/cancel|postpon/i.test(e.eventStatus||''))continue;
    const title=typeof e.name==='string'?e.name.trim():'';if(!title)continue;
    const description=typeof e.description==='string'?text(parseDocument(e.description)):'';
    const offers=[].concat(e.offers||[]),prices=offers.filter(o=>o.price!==undefined&&o.price!==null&&o.price!=='').map(o=>Number(o.price));
    const unavailable=offers.length&&offers.every(o=>/SoldOut|Discontinued|OutOfStock/i.test(o.availability||''));
    const paid=prices.some(p=>!Number.isFinite(p)||p>0);
    const eligible=admission(description,'',!paid&&prices.length>0&&prices.every(p=>p===0));
    const audiences=[].concat(e.audience||[]).map(a=>typeof a==='string'?a:(a.audienceType||a.name||''));
    const access=studentAccess(description,{audiences});
    const loc=e.location||{},address=typeof loc.address==='string'?loc.address:[loc.address?.streetAddress,loc.address?.addressLocality,loc.address?.addressRegion].filter(Boolean).join(', ');
    result.push({id:`cards:${url}:${new Date(start).toISOString()}`,title,description,start:new Date(start).toISOString(),end:e.endDate?new Date(end).toISOString():null,url,location:typeof loc==='string'?loc:[loc.name,address].filter(Boolean).join(', ')||'See event page',image:safeURL([].concat(e.image||[])[0]?.url||[].concat(e.image||[])[0]),source:'cards',sourceId:'the-cards',sourceName:'The Cards · linked event',region:'campus',...eligible,free:eligible.free&&!paid&&!unavailable,...access,verifiedAt:new Date(now).toISOString()});
  }
  return result;
}
export async function scanCards(fetcher=fetch,now=Date.now(),cache){
  const report={id:'the-cards',name:'The Cards',url:CARDS_URL,updated_at:null,count:0,checked:0,unsupported:0,unverified:0,last_error:null};
  const events=[],seen=new Set(),signal=AbortSignal.timeout(25000),lastStart=horizonEnd(now);
  try{
    const pages=await Promise.allSettled([CARDS_EDITION,CARDS_URL].map(u=>publicText(u,fetcher,signal)));
    if(pages.every(p=>p.status==='rejected'))throw new Error('The Cards pages could not be reached.');
    const links=[];
    for(const page of pages){if(page.status!=='fulfilled')continue;const parsed=cardsLinks(page.value);report.unsupported+=parsed.unsupported;for(const u of parsed.links)if(!links.includes(u))links.push(u);}
    report.discovered=links.length;report.skipped=Math.max(0,links.length-32);let next=0;
    async function check(url,follow=true){
      if(seen.has(url)||signal.aborted)return;seen.add(url);
      try{
        const luma=['luma.com','lu.ma'].includes(new URL(url).hostname);
        const html=luma?'':await publicText(url,fetcher,signal);report.checked++;
        const found=luma?[await readLumaEvent(url,{sourceName:'The Cards · Luma',sourceId:'the-cards',region:'campus'},fetcher,now,signal,cache)]:structuredCardsEvents(html,url,now);
        events.push(...found.filter(e=>Date.parse(e.end||e.start)>=now&&Date.parse(e.start)<lastStart));
        if(!luma&&follow){const targets=cardsLinks(html).links.filter(u=>u!==url&&['luma.com','lu.ma','partiful.com','events.stanford.edu'].includes(new URL(u).hostname)).slice(0,2);for(const target of targets)await check(target,false);}
        if(!found.some(e=>e.free&&e.accessible))report.unverified++;
      }catch{report.unverified++;}
    }
    await Promise.all(Array.from({length:Math.min(4,links.length)},async()=>{while(next<Math.min(32,links.length)&&!signal.aborted)await check(links[next++]);}));
    report.skipped+=Math.max(0,Math.min(32,links.length)-next);
    report.updated_at=new Date(now).toISOString();report.count=events.filter(e=>e.free&&e.accessible).length;
    if(signal.aborted)report.last_error='The Cards scan reached its time limit; some event links need another scan.';
  }catch(e){report.last_error=e.message;}
  return {events,reports:[report]};
}
