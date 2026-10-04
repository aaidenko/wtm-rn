import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,parseFeed,collect,validateCalendar} from '../lib/core.mjs';
import {classify,select,stanfordTime,stanfordLocalTime,planTimes,eventOnDay,dateKey,normalize} from '../public/model.mjs';
const now=Date.parse('2026-10-03T19:00:00Z');
test('interest classification avoids AI and CS substrings',()=>{
  assert.deepEqual(classify({title:'Fair paintings and classics'}),[]);
  assert.ok(classify({title:'AI startup founder lunch'}).includes('AI'));
  assert.ok(classify({title:'Quant trading seminar'}).includes('Trading'));
});
test('Stanford times work across daylight saving and day boundaries',()=>{
  assert.equal(stanfordTime('2026-10-03T18:30'),'2026-10-04T01:30:00.000Z');
  assert.equal(stanfordTime('2026-12-03T18:30'),'2026-12-04T02:30:00.000Z');
  assert.equal(dateKey('2026-10-04T02:00:00Z'),'2026-10-03');
  assert.throws(()=>stanfordTime('2027-03-14T02:30'));
});
test('plans reject unsafe links, backwards times and oversized content',()=>{
  const p={free:true,accessible:true,title:'AI coffee',host:'Sam',location:'Coupa',description:'',start:'2026-10-03T22:00:00Z',end:'2026-10-03T23:00:00Z',tags:['AI'],url:'https://partiful.com/e/example'};
  assert.equal(validatePlan(p,now).url,p.url);
  assert.throws(()=>validatePlan({...p,url:'javascript:alert(1)'},now));
  assert.throws(()=>validatePlan({...p,end:p.start},now));
  assert.throws(()=>validatePlan({...p,title:'x'.repeat(121)},now));
});
test('multi-day plans accept the October 17–18 range and appear on both dates',()=>{
 const start=stanfordTime('2026-10-17T00:00'),end=stanfordTime('2026-10-18T23:59');
 assert.deepEqual(planTimes(start,end,now),{start,end});
 const e={title:'Weekend plan',description:'',location:'Campus',start,end,source:'friends',topics:[],free:true,accessible:true};
 assert.equal(eventOnDay(e,'2026-10-17'),true);assert.equal(eventOnDay(e,'2026-10-18'),true);assert.equal(eventOnDay(e,'2026-10-19'),false);
 assert.equal(select([e],{day:'2026-10-18',now,matched:false}).length,1);
 assert.equal(select([e],{day:'week',today:'2026-10-18',now:Date.parse(stanfordTime('2026-10-18T10:00')),matched:false}).length,1);
 assert.equal(eventOnDay({...e,end:stanfordTime('2026-10-18T00:00')},'2026-10-18'),false);
});
test('plan date errors identify the field and defaults use Stanford time',()=>{
 assert.throws(()=>planTimes('invalid','2026-10-05T00:00:00Z',now),/valid start/);
 assert.throws(()=>planTimes('2026-10-05T00:00:00Z','invalid',now),/valid end/);
 assert.throws(()=>planTimes('2026-10-01T00:00:00Z','2026-10-05T00:00:00Z',now),/start time is in the past/);
 assert.throws(()=>planTimes('2026-10-05T00:00:00Z','2026-10-04T00:00:00Z',now),/end must be after/);
 assert.throws(()=>planTimes('2026-10-03T18:30:00Z','2026-10-03T18:45:00Z',now),/already ended/);
 assert.equal(stanfordLocalTime('2026-10-18T07:00:00Z'),'2026-10-18T00:00');
});
test('iCal feed handles folded text, timezones, recurrence and cancellations',()=>{
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20261003T220000Z\r\nDTEND:20261003T230000Z\r\nSUMMARY:AI builders\r\nDESCRIPTION:Hello\\,\r\n+ friends\r\nURL:https://luma.com/example\r\nRRULE:FREQ=DAILY;COUNT=2\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nDTSTART:20261003T220000Z\r\nDTEND:20261003T230000Z\r\nSUMMARY:Canceled\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR'.replace('\r\n+ ','\r\n ');
  const events=parseFeed(ics,'Builders',now);assert.equal(events.length,2);assert.equal(events[0].title,'AI builders');assert.equal(events[0].description,'Hello,friends');
});
test('import fetches every Stanford page and reports failed Luma feeds',async()=>{
  const calls=[];
  const data=await collect(async url=>{calls.push(url);if(url.includes('luma'))throw new Error('Down');const page=Number(new URL(url).searchParams.get('page'));return Response.json({events:[{event:{id:page}}],page:{total:3}});},['https://api.luma.com/ics/get?entity=calendar&id=test'],now);
  assert.equal(data.pages.length,3);assert.equal(data.warnings.length,1);assert.equal(calls.length,4);
});
test('date and free filters do not invent free entry',()=>{
  const events=[{id:'1',title:'AI talk',location:'Gates',description:'',start:'2026-10-03T22:00:00Z',end:'2026-10-03T23:00:00Z',topics:['AI'],source:'campus',free:true,accessible:true},{id:'2',title:'Food',location:'Coupa',description:'',start:'2026-10-04T22:00:00Z',end:'2026-10-04T23:00:00Z',topics:['Food & drinks'],source:'friends',free:false,accessible:true}];
  assert.equal(select(events,{now,day:'2026-10-03'}).length,1);
  assert.equal(select(events,{now,day:'week',today:'2026-10-03',free:true}).length,1);
  assert.equal(select(events,{now,day:'week',today:'2026-10-03',source:'friends'}).length,0);
});
test('normalization deduplicates instances and removes canceled events',()=>{
  const e={free:true,filters:{event_audience:[{name:'Students'}]},id:1,title:'AI seminar',status:'live',description_text:'',event_instances:[{event_instance:{id:2,start:'2026-10-03T22:00:00Z'}}]};
  assert.equal(normalize({pages:[{events:[{event:e},{event:e},{event:{...e,status:'canceled'}}]}]}).length,1);
});
test('SF stays separate from Stanford and nearby',()=>{
  const e={free:true,accessible:true,id:'1',title:'AI builders',description:'',location:'SF',start:'2026-10-03T22:00:00Z',topics:['AI'],region:'sf',source:'luma'};
  assert.equal(select([e],{now,today:'2026-10-03',region:'campus'}).length,0);
  assert.equal(select([e],{now,today:'2026-10-03',region:'sf'}).length,1);
});
test('calendar inputs allow official feeds and reject internal hosts and webpages',()=>{
  assert.equal(validateCalendar({name:'SF events',region:'sf',url:'webcal://api.luma.com/ics/get?entity=discover&id=test'}).source,'luma');
  assert.equal(validateCalendar({name:'Lab',region:'campus',url:'https://calendar.google.com/calendar/ical/test/public/basic.ics'}).source,'calendar');
  for(const url of ['https://127.0.0.1/feed.ics','https://luma.com/user/sf','https://api.luma.com.evil.com/ics/get?entity=calendar&id=x','http://api.luma.com/ics/get?entity=calendar&id=x'])assert.throws(()=>validateCalendar({name:'Bad feed',region:'campus',url}));
});
test('all-day iCal dates stay on the correct Stanford day',()=>{
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:all-day\r\nDTSTART;VALUE=DATE:20261004\r\nDTEND;VALUE=DATE:20261005\r\nSUMMARY:Hackathon\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [e]=parseFeed(ics,'Builders',now);assert.equal(dateKey(e.start),'2026-10-04');assert.equal(e.allDay,true);
});
