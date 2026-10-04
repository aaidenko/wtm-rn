import test from 'node:test';
import assert from 'node:assert/strict';
import {admission,studentAccess} from '../public/eligibility.mjs';
import {parseLumaEvent,lumaData} from '../lib/sources.mjs';
import {normalize,select} from '../public/model.mjs';
import {validatePlan,validateCalendar} from '../lib/core.mjs';
const now=Date.parse('2026-10-03T20:00:00Z');
const data={event:{api_id:'evt-test',name:'AI club talk',url:'test-talk',start_at:'2026-10-06T00:30:00Z',end_at:'2026-10-06T01:30:00Z',visibility:'public',geo_address_info:{address:'Bishop Auditorium'}},ticket_types:[{type:'free',cents:null,require_approval:true}],ticket_info:{is_free:true,require_approval:true},registration_availability:'open',description_mirror:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Open only to currently enrolled Stanford students.'}]}]}};
const html=d=>`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{initialData:{kind:'event',data:d}}}})}</script>`;
test('free admission requires evidence, not free snacks or omitted cost',()=>{
  for(const s of ['Free boba!','Free pizza and drinks','Feel free to register','Price not listed'])assert.equal(admission(s).free,false);
  assert.equal(admission('Admission is free.').free,true);
  assert.equal(admission('Free and open to the public').free,true);
  assert.equal(admission('','Free').free,true);
  assert.equal(admission('','$20',true).free,false);
});
test('student restrictions are honored and approval is not a paid ticket',()=>{
  assert.equal(studentAccess('Investors only',{publicRegistration:true}).accessible,false);
  assert.equal(studentAccess('Members only',{publicRegistration:true}).accessible,false);
  assert.equal(studentAccess('For ages 21+',{publicRegistration:true}).accessible,false);
  assert.equal(studentAccess('Currently enrolled Stanford students').accessible,true);
  assert.equal(studentAccess('',{audiences:['Faculty/Staff']}).accessible,false);
});
test('Luma public registration verifies free ticket and Stanford access',()=>{
  const e=parseLumaEvent(html(data),{sourceName:'AI Club'},now);
  assert.equal(e.free,true);assert.equal(e.accessible,true);assert.equal(e.approvalRequired,true);assert.match(e.access,/approval required/);assert.equal(e.title,'AI club talk');
});
test('paid, expired, hidden, disabled, sold-out and membership tickets stay hidden',()=>{
  for(const patch of [{ticket_info:{is_free:false}},{ticket_types:[{type:'paid',cents:2000}]},{ticket_types:[{type:'free',cents:0,is_hidden:true}]},{ticket_types:[{type:'free',cents:0,is_disabled:true}]},{ticket_types:[{type:'free',cents:0,membership_restriction:'members'}]},{ticket_types:[{type:'free',cents:0,valid_end_at:'2026-10-01'}]},{ticket_types:[{type:'free',cents:0,spots_remaining:0}]},{sold_out:true},{registration_availability:'closed'}]){
    assert.equal(parseLumaEvent(html({...data,...patch}),{},now).free,false);
  }
});
test('public page format failures do not invent free status',()=>{
  assert.throws(()=>lumaData('<html>No public data</html>'));
  assert.equal(parseLumaEvent(html({...data,ticket_types:[]}),{},now).free,false);
});
test('all views and saved events enforce eligibility even with free filter disabled',()=>{
  const e=parseLumaEvent(html(data),{},now);const candidates=[e,{...e,id:'paid',free:false},{...e,id:'private',accessible:false}];
  assert.equal(select(candidates,{now,today:'2026-10-03',free:false,matched:false}).length,1);
  assert.equal(normalize({external:candidates}).length,1);
});
test('friends must explicitly confirm free attendance and student access',()=>{
  const p={title:'Free AI talk',host:'Sam',location:'Gates',description:'',tags:['AI'],start:'2026-10-06T00:30:00Z',end:'2026-10-06T01:30:00Z'};
  assert.throws(()=>validatePlan(p,now));assert.throws(()=>validatePlan({...p,free:true},now));assert.equal(validatePlan({...p,free:true,accessible:true},now).free,true);
});
test('public Luma event and calendar pages are accepted without arbitrary scraping',()=>{
  assert.equal(validateCalendar({name:'AI Club',region:'campus',url:'https://luma.com/r01e3zn0'}).page,true);
  assert.equal(validateCalendar({name:'BASES',region:'campus',url:'https://luma.com/bases26_27'}).page,true);
  assert.throws(()=>validateCalendar({name:'Bad',region:'campus',url:'https://luma.com@127.0.0.1/event'}));
});
