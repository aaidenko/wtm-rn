import {parseDocument,DomUtils} from 'htmlparser2';
import {admission,studentAccess} from '../public/eligibility.mjs';
import {publicText} from './sources.mjs';

export function stanfordPageFree(html){
  const root=parseDocument(html);
  return DomUtils.findAll(n=>n.type==='tag'&&n.name==='strong'&&DomUtils.textContent(n).trim()==='Free Event',root.children).some(n=>{
    for(let p=n.parent;p;p=p.parent){
      if((p.attribs?.class||'').split(/\s+/).includes('em-confirm-buttons-wrapper'))return true;
    }
    return false;
  });
}

export async function verifyStanfordAdmission(pages,fetcher=fetch){
  const candidates=new Map();
  for(const page of pages)for(const {event:e} of page.events||[]){
    if(!e||admission(e.description_text||'',e.ticket_cost,e.free).free||!studentAccess(e.description_text||'',{audiences:(e.filters?.event_audience||[]).map(a=>a.name)}).accessible)continue;
    // A known price must never be overridden by a conflicting page label.
    if(String(e.ticket_cost||'').trim())continue;
    try{
      const u=new URL(e.localist_url);
      if(u.protocol!=='https:'||u.hostname!=='events.stanford.edu'||u.port||u.username||u.password||!/^\/event\/[\w-]+\/?$/.test(u.pathname))continue;
      if(!candidates.has(u.href))candidates.set(u.href,[]);
      candidates.get(u.href).push(e);
    }catch{}
  }
  const entries=[...candidates],signal=AbortSignal.timeout(30000);let next=0,failed=0;
  await Promise.all(Array.from({length:Math.min(6,entries.length)},async()=>{
    while(next<entries.length&&!signal.aborted){
      const [url,events]=entries[next++];
      try{
        if(stanfordPageFree(await publicText(url,fetcher,AbortSignal.any([signal,AbortSignal.timeout(8000)]))))for(const e of events){e.free=true;e.wtm_free_evidence='Stanford event page explicitly lists Free Event';}
      }catch{failed++;}
    }
  }));
  failed+=entries.length-next;
  return failed?[`${failed} Stanford event pages could not verify admission; unverified events stay hidden.`]:[];
}
