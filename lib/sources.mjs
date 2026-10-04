import {studentAccess} from '../public/eligibility.mjs';
import {safeURL} from '../public/model.mjs';

export const SOURCE_DIRECTORY=[
  {name:'Stanford Events · HAI, CS, research & campus',url:'https://events.stanford.edu',mode:'Daily university calendar scan'},
  {name:'Stanford AI Club · speaker series',url:'https://luma.com/r01e3zn0',mode:'Daily host calendar + free-ticket checks',newsletter:'https://mailman.stanford.edu/mailman/listinfo/saic-members'},
  {name:'BASES',url:'https://luma.com/bases26_27',mode:'Daily Luma calendar + free-ticket checks',newsletter:'https://forms.gle/GtdRAYSKeAafjvqi7'},
  {name:'SAGA',url:'https://saga.stanford.edu/events',mode:'Daily public Google calendar',newsletter:'https://mngrv.one/saga'},
  {name:'Stanford HAI',url:'https://events.stanford.edu/department/hai/calendar',mode:'Daily public department calendar',newsletter:'https://hai.stanford.edu/subscribe-hai-mailing-list'},
  {name:'ASES',url:'https://ases.stanford.edu/',mode:'Daily public website: follows linked Luma events'},
  {name:'The Cards · OSE + ASSU edition',url:'https://ose.stanford.edu/cards',mode:'Daily linked event pages · unverified admission and image flyers stay hidden',newsletter:'https://forms.gle/SD7SmT3xv9Ew2M1i8'},
  {name:'Stanford xBuilders',url:'https://luma.com/StanfordAI',mode:'Daily Luma calendar + free-ticket checks'},
  {name:'Luma · San Francisco',url:'https://luma.com/sf',mode:'Daily SF discovery feed + free-ticket checks'}
];
export const PUBLIC_PAGES=[{id:'ases-public',name:'ASES public website',url:'https://ases.stanford.edu/'}];
const headers={'User-Agent':'Mozilla/5.0 (compatible; WTM Stanford event reader)','Accept':'text/html,application/json,text/calendar'};
export async function publicText(url,fetcher=fetch,signal){
  const r=await fetcher(url,{headers,signal:signal||AbortSignal.timeout(8000),redirect:'error'});
  if(!r.ok)throw new Error(`Source returned HTTP ${r.status}`);
  const text=await r.text();if(text.length>2000000)throw new Error('Source page is too large.');return text;
}
export function lumaData(html){
  const match=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!match)throw new Error('Luma page format changed; unable to verify registration.');
  const initial=JSON.parse(match[1])?.props?.pageProps?.initialData;
  if(!initial?.data)throw new Error('Luma page has no public event data.');return initial;
}
const plain=n=>typeof n?.text==='string'?n.text:(n?.content||[]).map(plain).join(n?.type==='doc'?'\n\n':'');
export function parseLumaEvent(html,{sourceName='Luma',region='campus',sourceId=''}={},now=Date.now()){
  const initial=lumaData(html);if(initial.kind!=='event')throw new Error('Use a public Luma event page.');
  const d=initial.data,e=d.event;if(!e?.start_at||!e.api_id)throw new Error('Missing event details.');
  const description=plain(d.description_mirror),tickets=(d.ticket_types||[]).filter(t=>!t.is_hidden&&!t.is_disabled&&!t.membership_restriction);
  const eligible=tickets.filter(t=>t.type==='free'&&(t.cents===null||t.cents===0)&&(!t.valid_start_at||Date.parse(t.valid_start_at)<=now)&&(!t.valid_end_at||Date.parse(t.valid_end_at)>now)&&t.spots_remaining!==0&&!(t.ethereum_token_requirements||[]).length);
  const free=d.ticket_info?.is_free===true&&eligible.length>0;
  const approval=eligible.some(t=>t.require_approval)||d.ticket_info?.require_approval===true;
  const access=studentAccess(description,{publicRegistration:e.visibility==='public'});
  const available=d.registration_availability==='open'&&!d.sold_out&&!d.ticket_info?.is_sold_out;
  return {id:`luma:${e.api_id}:${e.start_at}`,title:e.name,description,start:e.start_at,end:e.end_at,url:`https://luma.com/${e.url}`,location:e.geo_address_info?.full_address||e.geo_address_info?.address||(e.location_type==='online'?'Online':'See event page'),image:safeURL(e.cover_url),source:'luma',sourceName,sourceId,region,free:free&&available,freeEvidence:free?'Luma: available free ticket':'',accessible:access.accessible&&available,access:access.access+(approval?' · approval required':''),approvalRequired:approval,verifiedAt:new Date(now).toISOString()};
}
export async function enrichLuma(events,fetcher=fetch,now=Date.now(),signal){
  const urls=[...new Set(events.map(e=>e.url).filter(u=>/^https:\/\/(?:luma\.com|lu\.ma)\/[\w-]+\/?$/.test(u)))];
  const details=new Map();let next=0,failed=0;
  // Six workers and a shared request deadline keep daily scans within Vercel's limit.
  await Promise.all(Array.from({length:Math.min(6,urls.length)},async()=>{
    while(next<urls.length&&!signal?.aborted){const url=urls[next++];try{const html=await publicText(url,fetcher,signal);details.set(url,parseLumaEvent(html,{},now));}catch{failed++;}}
  }));
  const verified=events.map(e=>details.has(e.url)?{...e,...details.get(e.url),sourceName:e.sourceName,sourceId:e.sourceId,region:e.region}:{...e,free:false,verificationError:!!e.url});
  return {events:verified,warnings:failed?[`${failed} Luma pages could not verify free tickets; unverified events stay hidden.`]:[]};
}
export async function scanPublicPages(fetcher=fetch,now=Date.now()){
  const events=[],reports=[];
  await Promise.all(PUBLIC_PAGES.map(async s=>{try{
    const html=await publicText(s.url,fetcher),urls=[...new Set((html.match(/https:\/\/(?:luma\.com|lu\.ma)\/[\w-]+/g)||[]))].slice(0,12);
    await Promise.all(urls.map(async url=>{try{events.push(parseLumaEvent(await publicText(url,fetcher),{sourceName:s.name,sourceId:s.id,region:'campus'},now));}catch{}}));
    reports.push({...s,updated_at:new Date(now).toISOString(),count:events.filter(e=>e.sourceId===s.id).length,last_error:null});
  }catch(e){reports.push({...s,updated_at:null,count:0,last_error:e.message});}}));
  return {events,reports};
}
