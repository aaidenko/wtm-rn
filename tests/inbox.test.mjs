import test from 'node:test';
import assert from 'node:assert/strict';
import {eventLinks,scanInbox} from '../lib/inbox.mjs';
test('email link extraction accepts only direct Luma URLs and deduplicates',()=>{
 assert.deepEqual(eventLinks('https://luma.com/ai-talk?utm_source=mail https://luma.com/ai-talk https://evil.com/event https://luma.com/sf'),['https://luma.com/ai-talk']);
 assert.equal(eventLinks(Array.from({length:60},(_,i)=>`https://luma.com/event${i}`).join(' ')).length,40);
});
test('no inbox credentials means no mailbox connection',async()=>{
 class Client{constructor(){throw new Error('Must not connect');}}
 assert.equal((await scanInbox({env:{},Client})).enabled,false);
});
test('mailbox reads are bounded, read-only and do not expose email content',async()=>{
 const calls=[];class Client{
  constructor(opts){calls.push(opts);}
  on(){} async connect(){} async getMailboxLock(path,opts){calls.push({path,...opts});return {release(){}};}
  async search(){return [1,2];}
  async fetchOne(uid,q){assert.equal(q.source.maxLength,262144);return uid===2?{size:400000,source:Buffer.from('too big')}:{size:150,source:Buffer.from('From: friend@example.com\r\nSubject: Private announcement\r\nContent-Type: text/plain\r\n\r\nRSVP https://luma.com/ai-talk')};}
  async logout(){} close(){}
 }
 const d={event:{api_id:'evt-test',url:'ai-talk',name:'AI talk',start_at:'2026-10-20T00:30:00Z',end_at:'2026-10-20T01:30:00Z',visibility:'public'},ticket_info:{is_free:true},ticket_types:[{type:'free',cents:null}],registration_availability:'open',description_mirror:{type:'doc',content:[]}};
 const html=`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{initialData:{kind:'event',data:d}}}})}</script>`;
 const result=await scanInbox({env:{WTM_INBOX_EMAIL:'dedicated@gmail.com',WTM_INBOX_APP_PASSWORD:'dummy'},now:Date.parse('2026-10-04T07:00:00Z'),Client,fetcher:async()=>new Response(html)});
 assert.equal(calls[0].host,'imap.gmail.com');assert.equal(calls[0].secure,true);assert.equal(calls[0].logger,false);assert.deepEqual(calls[1],{path:'INBOX',readOnly:true});
 assert.equal(result.scanned,1);assert.equal(result.skipped,1);assert.equal(result.events[0].free,true);assert.equal(result.events[0].sourceName,'WTM inbox · Luma');assert.ok(!JSON.stringify(result).includes('Private announcement'));
});
