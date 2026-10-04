import test from 'node:test';
import assert from 'node:assert/strict';
import {cardsLinks,cardsEventURL,structuredCardsEvents,scanCards,CARDS_URL,CARDS_EDITION} from '../lib/cards.mjs';
const now=Date.parse('2026-10-04T07:00:00Z');
const event={ '@type':'Event',name:'AI research talk',description:'Free admission for Stanford students.',startDate:'2026-10-06T17:00:00-07:00',endDate:'2026-10-06T18:00:00-07:00',location:{name:'Bishop Auditorium'}};
const html=e=>`<script type="application/ld+json">${JSON.stringify(e)}</script>`;
test('Cards links decode Google wrappers, deduplicate and reject unsafe destinations',()=>{
 const d=cardsLinks('<main><a href="https://www.google.com/url?q=https%3A%2F%2Fluma.com%2Fai-talk">RSVP</a><a href="https://luma.com/ai-talk?ref=cards">Again</a><a href="https://drive.google.com/file/flyer">Flyer</a><a href="https://127.0.0.1/event">Local</a></main>');
 assert.deepEqual(d,{links:['https://luma.com/ai-talk'],unsupported:1});
 for(const u of ['https://events.stanford.edu.evil.com/event/a','https://user:pass@luma.com/talk','http://luma.com/talk','https://luma.com:8443/talk','https://partiful.com/u/profile','https://evil.com'])assert.equal(cardsEventURL(u),'');
});
test('linked event dates override stale headings and preserve explicit admission proof',()=>{
 const [e]=structuredCardsEvents('<h1>Thursday 9/24</h1>'+html({'@graph':[event]}),'https://partiful.com/e/talk',now);
 assert.equal(e.start,'2026-10-07T00:00:00.000Z');assert.equal(e.free,true);assert.equal(e.accessible,true);
 assert.equal(e.sourceId,'the-cards');
});
test('paid offers, free food, sold-out offers and restricted audiences stay hidden',()=>{
 const url='https://partiful.com/e/talk';
 assert.equal(structuredCardsEvents(html({...event,offers:{price:'25'}}),url,now)[0].free,false);
 assert.equal(structuredCardsEvents(html({...event,description:'Free pizza for Stanford students.'}),url,now)[0].free,false);
 assert.equal(structuredCardsEvents(html({...event,offers:{price:0,availability:'https://schema.org/SoldOut'}}),url,now)[0].free,false);
 assert.equal(structuredCardsEvents(html({...event,description:'Free admission. Invitation-only.'}),url,now)[0].accessible,false);
});
test('ambiguous, expired, cancelled and distant linked events are not imported',()=>{
 const url='https://partiful.com/e/talk';
 for(const patch of [{startDate:'2026-10-06T17:00:00'},{startDate:'2025-10-06T17:00:00Z',endDate:'2025-10-06T18:00:00Z'},{eventStatus:'https://schema.org/EventCancelled'},{startDate:'2026-11-06T17:00:00Z',endDate:'2026-11-06T18:00:00Z'}])assert.deepEqual(structuredCardsEvents(html({...event,...patch}),url,now),[]);
});
test('Cards scan reads both editions and only follows supported public event links',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{calls.push(url);assert.equal(opts.redirect,'error');if([CARDS_URL,CARDS_EDITION].includes(url))return new Response('<a href="https://partiful.com/e/talk">Talk</a><a href="https://drive.google.com/flyer">Flyer</a>');return new Response(html(event));};
 const r=await scanCards(fetcher,now);
 assert.equal(r.events.length,1);assert.equal(r.reports[0].count,1);assert.equal(r.reports[0].checked,1);assert.equal(r.reports[0].last_error,null);
 assert.deepEqual(new Set(calls),new Set([CARDS_URL,CARDS_EDITION,'https://partiful.com/e/talk']));
});
