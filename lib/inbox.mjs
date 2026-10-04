import {ImapFlow} from 'imapflow';
import {simpleParser} from 'mailparser';
import {publicText,parseLumaEvent} from './sources.mjs';
export const inboxConfigured=env=>!!(env.WTM_INBOX_EMAIL&&env.WTM_INBOX_APP_PASSWORD);
export function eventLinks(text){
  return [...new Set((String(text).match(/https:\/\/(?:luma\.com|lu\.ma)\/[\w-]+/gi)||[]).filter(u=>!['sf','signin','login','pricing','discover'].includes(new URL(u).pathname.slice(1))))].slice(0,40);
}
export async function scanInbox({env=process.env,now=Date.now(),Client=ImapFlow,fetcher=fetch,previousLinks=[]}={}){
  if(!inboxConfigured(env))return {enabled:false,events:[],links:[],updatedAt:null,error:null};
  const email=env.WTM_INBOX_EMAIL.trim();if(!/^[^\s@]+@gmail\.com$/i.test(email))return {enabled:true,events:[],links:previousLinks,updatedAt:null,error:'Use the dedicated Gmail address in WTM_INBOX_EMAIL.'};
  const client=new Client({host:'imap.gmail.com',port:993,secure:true,auth:{user:email,pass:env.WTM_INBOX_APP_PASSWORD.replace(/\s/g,'')},logger:false,disableAutoIdle:true,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});
  client.on('error',()=>{});
  const deadline=setTimeout(()=>client.close(),20000);let lock,scanned=0,skipped=0;const links=new Set(previousLinks.slice(0,100));
  try{
    await client.connect();lock=await client.getMailboxLock('INBOX',{readOnly:true});
    const ids=await client.search({since:new Date(now-14*86400000)},{uid:true});
    for(const uid of ids.slice(-50).reverse()){
      const message=await client.fetchOne(uid,{source:{maxLength:262144},size:true},{uid:true});
      if(!message?.source||message.size>262144){skipped++;continue;}
      const mail=await simpleParser(message.source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:262144});
      for(const url of eventLinks((mail.text||'')+'\n'+(mail.html||'')))links.add(url);
      scanned++;
    }
    lock.release();lock=null;await client.logout();clearTimeout(deadline);
    const events=[],kept=[];let next=0,unverified=0;const urls=[...links].slice(-100);const signal=AbortSignal.timeout(20000);
    await Promise.all(Array.from({length:Math.min(6,urls.length)},async()=>{while(next<urls.length&&!signal.aborted){const url=urls[next++];try{
      const e=parseLumaEvent(await publicText(url,fetcher,signal),{sourceName:'WTM inbox · Luma',sourceId:'wtm-inbox'},now);
      if(Date.parse(e.end||e.start)<now)continue;kept.push(url);
      if(Date.parse(e.start)<=now+7*86400000){e.region=/San Francisco|Oakland|Berkeley|Alameda/i.test(e.location)?'sf':'campus';events.push(e);}
    }catch{kept.push(url);unverified++;}}}));
    // Preserve unprocessed links for the next bounded scan.
    kept.push(...urls.slice(next));
    return {enabled:true,events,links:kept.slice(-100),updatedAt:new Date(now).toISOString(),scanned,skipped,unverified,error:null};
  }catch{return {enabled:true,events:[],links:[...links].slice(-100),updatedAt:null,error:'Inbox scan failed. Check the Gmail address and app password in Vercel.'};}
  finally{clearTimeout(deadline);lock?.release();client.close();}
}
