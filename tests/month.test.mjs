import test from 'node:test';
import assert from 'node:assert/strict';
import {dateDays,horizonEnd,normalize,select} from '../public/model.mjs';
import {parseFeed,collect} from '../lib/core.mjs';
import {structuredCardsEvents} from '../lib/cards.mjs';
import {admissionCache} from '../lib/admission-cache.mjs';
import {readLumaEvent} from '../lib/sources.mjs';
import {verifyStanfordAdmission} from '../lib/stanford.mjs';
const now=Date.parse('2026-10-04T09:00:00Z');
test('month filters include day 30 but exclude the next day in Stanford time',()=>{
  const base={title:'AI talk',description:'',location:'Gates',free:true,accessible:true,topics:['AI'],source:'campus'};
  const events=[{...base,id:'near',start:'2026-10-07T12:00:00-07:00',end:'2026-10-07T13:00:00-07:00'},{...base,id:'last',start:'2026-11-02T23:00:00-08:00',end:'2026-11-02T23:30:00-08:00'},{...base,id:'outside',start:'2026-11-03T00:00:00-08:00',end:'2026-11-03T01:00:00-08:00'}];
  assert.deepEqual(select(events,{day:'month',today:'2026-10-04',now}).map(e=>e.id),['near','last']);
  assert.deepEqual(select(events,{day:'week',today:'2026-10-04',now}).map(e=>e.id),['near']);
  assert.equal(horizonEnd(now),Date.parse('2026-11-03T00:00:00-08:00'));
  const days=dateDays('2026-10-04',30);assert.equal(days.length,30);assert.equal(new Set(days).size,30);assert.equal(days.at(-1),'2026-11-02');
});
test('recurring and Cards imports include events beyond a week, within 30 days',()=>{
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:weekly\r\nDTSTART:20261007T190000Z\r\nDTEND:20261007T200000Z\r\nRRULE:FREQ=WEEKLY;COUNT=6\r\nSUMMARY:AI talk\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert.deepEqual(parseFeed(ics,'Lab',now).map(e=>e.start.slice(0,10)),['2026-10-07','2026-10-14','2026-10-21','2026-10-28']);
  const e={'@type':'Event',name:'AI research talk',description:'Free admission for Stanford students.',startDate:'2026-10-28T12:00:00-07:00',endDate:'2026-10-28T13:00:00-07:00'};
  assert.equal(structuredCardsEvents(`<script type="application/ld+json">${JSON.stringify(e)}</script>`,'https://partiful.com/e/talk',now).length,1);
});
test('month collection requests all Stanford pages beyond the old ten-page cap',async()=>{
  const calls=[];const d=await collect(async url=>{const u=new URL(url);calls.push(u);return Response.json({events:[],page:{total:12}});},[],now);
  assert.equal(d.pages.length,12);assert.equal(calls.length,12);assert.ok(calls.every(u=>u.searchParams.get('days')==='30'));
});
test('admission cache shares concurrent checks, persists and refreshes nearby or expired checks',async()=>{
  const url='https://luma.com/ai-talk',start='2026-10-20T12:00:00-07:00';let checks=0;
  const check=async()=>{checks++;return true;};const cache=admissionCache([],now);
  await Promise.all([cache.read('stanford',url,start,check),cache.read('stanford',url,start,check)]);assert.equal(checks,1);
  const next=admissionCache(cache.snapshot(),now+24*3600000);await next.read('stanford',url,start,check);assert.equal(checks,1);
  await next.read('stanford',url,'2026-10-05T12:00:00-07:00',check);assert.equal(checks,2);
  const expired=admissionCache(cache.snapshot(),now+73*3600000);await expired.read('stanford',url,start,check);assert.equal(checks,3);
  const near=admissionCache([],now);await near.read('stanford',url,'2026-10-06T12:00:00-07:00',check);
  await admissionCache(near.snapshot(),now+24*3600000).read('stanford',url,'2026-10-06T12:00:00-07:00',check);assert.equal(checks,5);
  const failed=admissionCache([],now);await assert.rejects(failed.read('stanford',url,start,async()=>{throw new Error('Offline');}));assert.equal(failed.snapshot().length,0);
});
test('cached Luma data re-evaluates ticket expiration without another request',async()=>{
  const data={event:{api_id:'evt-test',url:'ai-talk',name:'AI talk',start_at:'2026-10-20T19:00:00Z',end_at:'2026-10-20T20:00:00Z',visibility:'public'},ticket_info:{is_free:true},ticket_types:[{type:'free',cents:0,valid_end_at:new Date(now+12*3600000).toISOString()}],registration_availability:'open'};
  let calls=0;const fetcher=async()=>{calls++;return new Response(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{initialData:{kind:'event',data}}}})}</script>`);};
  const cache=admissionCache([],now);const e=await readLumaEvent('https://luma.com/ai-talk',{},fetcher,now,undefined,cache);assert.equal(e.free,true);
  const later=await readLumaEvent('https://luma.com/ai-talk',{},fetcher,now+24*3600000,undefined,admissionCache(cache.snapshot(),now+24*3600000));assert.equal(later.free,false);assert.equal(calls,1);assert.equal(later.verifiedAt,e.verifiedAt);
});
test('cached free Stanford checks never override new paid prices or restricted audiences',async()=>{
  const e={id:1,title:'AI talk',free:false,description_text:'',ticket_cost:null,localist_url:'https://events.stanford.edu/event/talk',filters:{event_audience:[{name:'Everyone'}]},event_instances:[{event_instance:{start:'2026-10-20T12:00:00-07:00'}}]};
  const cache=admissionCache([],now);await cache.read('stanford',e.localist_url,e.event_instances[0].event_instance.start,async()=>true);
  const pages=[{events:[{event:{...e,ticket_cost:'$20'}},{event:{...e,filters:{event_audience:[{name:'Faculty'}]}}}]}];
  await verifyStanfordAdmission(pages,async()=>{throw new Error('Unexpected request');},cache);assert.equal(normalize({pages}).length,0);
});
