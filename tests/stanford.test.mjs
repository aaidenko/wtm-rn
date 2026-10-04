import test from 'node:test';
import assert from 'node:assert/strict';
import {stanfordPageFree,verifyStanfordAdmission} from '../lib/stanford.mjs';
import {normalize} from '../public/model.mjs';
const html='<div class="em-confirm-buttons-wrapper su-info-group__text"><strong>Free Event</strong><br><a>Register</a></div>';
const event=()=>({id:53861040222429,title:'HAI Seminar with Tim de Silva',free:false,ticket_cost:null,description_text:'AI Financial Advice',localist_url:'https://events.stanford.edu/event/hai-seminar-with-tim-de-silva',filters:{event_audience:[{name:'Everyone'}]},event_instances:[{event_instance:{start:'2026-10-07T12:00:00-07:00',end:'2026-10-07T13:15:00-07:00'}}]});
test('official ticket label fixes a false API free flag and survives normalization',async()=>{
  const pages=[{events:[{event:event()}]}];
  await verifyStanfordAdmission(pages,async()=>new Response(html));
  const [e]=normalize({pages});assert.equal(e.title,'HAI Seminar with Tim de Silva');assert.equal(e.free,true);assert.match(e.freeEvidence,/event page/);
});
test('free language outside the ticket section does not establish admission',()=>{
  assert.equal(stanfordPageFree('<article><strong>Free Event</strong></article>'),false);
  assert.equal(stanfordPageFree('<div class="em-confirm-buttons-wrapper"><strong>Free pizza</strong></div>'),false);
});
test('paid, restricted, failed and nonofficial pages remain excluded',async()=>{
  let calls=0;const events=[{...event(),ticket_cost:'$20'},{...event(),filters:{event_audience:[{name:'Faculty'}]}},{...event(),localist_url:'https://example.com/event/test'},event()];
  const pages=[{events:events.map(event=>({event}))}];
  const warnings=await verifyStanfordAdmission(pages,async()=>{calls++;throw new Error('Offline');});
  assert.equal(calls,1);assert.equal(warnings.length,1);assert.equal(normalize({pages}).length,0);
});
