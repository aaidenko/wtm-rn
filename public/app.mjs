import {TOPICS,dateKey,zone,normalize,select,stanfordTime,safeURL} from './model.mjs';
const $=id=>document.getElementById(id);
const preview=new URL(location.href).searchParams.get('preview')==='1'&&['localhost','127.0.0.1'].includes(location.hostname);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const state={day:'week',view:read('wtm-view','list'),today:dateKey(Date.now()),interests:read('wtm-interests',Object.keys(TOPICS)),saved:read('wtm-saved',[]),section:'discover',source:'all',region:'campus',matched:true,free:true,search:'',sort:'match'};
let events=[],tagSelection=[],ready=false;
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,2800);}
async function api(path,method='GET',body) {
  const r=await fetch(`api/${path}`,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({error:'The feed couldn’t be reached.'}));
  if(!r.ok){const e=new Error(data.error||'Please try again.');e.status=r.status;throw e;}return data;
}
function topics(){
  $("filter-summary").textContent=state.interests.length+" interests ▾";
  $('topics').innerHTML=Object.keys(TOPICS).map(t=>`<button class="chip ${state.interests.includes(t)?'active':''}" data-topic="${escape(t)}" aria-pressed="${state.interests.includes(t)}">${escape(t)}</button>`).join('');
  $('topics').querySelectorAll('button').forEach(b=>b.onclick=()=>{const t=b.dataset.topic;state.interests=state.interests.includes(t)?state.interests.filter(x=>x!==t):[...state.interests,t];write('wtm-interests',state.interests);topics();render();});
}
function dates(){
  const noon=stanfordTime(state.today+'T12:00');
  $('dates').innerHTML=[['Today',state.today],['Tomorrow',dateKey(Date.parse(noon)+86400000)],['This week','week']].map(([label,day])=>`<button data-day="${day}" class="${state.day===day?'active':''}">${label}</button>`).join('');
  $('dates').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.day=b.dataset.day;dates();render();});
}
const time=d=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(d));
const shortDate=d=>new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'}).format(new Date(d));
function render(){
  const moving=state.section==='moves';
  const shortlist=select(events,{saved:state.saved,source:'saved',matched:false,region:'all',sort:'time',today:state.today});
  $('moves-nav-count').textContent=shortlist.length;
  document.querySelectorAll('[data-section]').forEach(b=>{const active=b.dataset.section===state.section;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('hero-eyebrow').textContent=moving?'THE PLANS YOU’VE PICKED.':'LESS SCROLLING. MORE SHOWING UP.';
  $('hero-title').innerHTML=moving?'Your <em>moves.</em>':'What’s the <em>move?</em>';
  $('hero-intro').textContent=moving?'Your saved talks, meetups, and plans. All in one place.':'Free events for Stanford students. Find something worth showing up for.';
  $('hero-note').innerHTML=moving?`<span>YOUR WEEK, SORTED</span><strong>${shortlist.length} saved ${shortlist.length===1?'move.':'moves.'}</strong><p>Pick a plan. Bring your people.</p><div class="spark">★</div>`:'<span>YOUR KIND OF CAMPUS</span><strong>Big ideas.<br>Small group chats.</strong><p>Startups, CS, AI & everything after.</p><div class="spark">↗</div>';
  $('moves-preview').hidden=moving||!ready;
  $('moves-preview-empty').hidden=!!shortlist.length;
  $('moves-preview-events').innerHTML=shortlist.slice(0,3).map(e=>`<button class="move-tile" data-move-detail="${escape(e.id)}"><span>${escape(shortDate(e.start))} · ${escape(e.timeTBD?'Time TBD':e.allDay?'All day':time(e.start))}</span><strong>${escape(e.title)}</strong><span>⌖ ${escape(e.location)}</span></button>`).join('');
  $('moves-preview-events').querySelectorAll('[data-move-detail]').forEach(b=>b.onclick=()=>showDetail(b.dataset.moveDetail));
  $('moves-note').hidden=!moving;
  $('filters-panel').hidden=moving;
  $('hero-title').closest('.hero').classList.toggle('moves-hero',moving);
  const list=select(events,moving?{...state,source:'saved',matched:false,sort:'time'}:state);
  $('dates').hidden=state.view==='calendar';
  $('sort').hidden=state.view==='calendar';
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('cards').className=state.view==='cards'?'cards':state.view==='calendar'?'calendar':'event-list';
  $('heading').textContent=state.source==='friends'?'From the group chat':moving?'Your Moves':state.region==='sf'?'Around San Francisco':'Your next move';
  $('count').textContent=`${list.length} ${list.length===1?'plan':'plans'} · Stanford time`;
  if(!list.length&&state.view!=='calendar'){$('cards').innerHTML=moving?'<div class="empty"><strong>Your next move starts with a ☆.</strong>Save events in Discover and find them here.<br>If you’ve saved something already, try This week or Everywhere.</div>':'<div class="empty"><strong>No moves here yet.</strong>Try This week, clear your search, or turn off “My interests only”.<br>Have something in mind? Drop a plan for the crew.</div>';return;}
  if(state.view==='list') {
    $('cards').innerHTML=list.map(e=>`<article class="event-row"><div class="row-when"><strong>${escape(shortDate(e.start))}</strong><span>${escape(e.timeTBD?'Time TBD':e.allDay?'All day':time(e.start))}</span></div><button class="row-main" data-detail="${escape(e.id)}"><strong>${escape(e.title)}</strong><span>⌖ ${escape(e.location)}${e.source==='friends'?' · '+escape(e.host):''}</span></button><div class="row-tags">${e.topics.slice(0,3).map(t=>`<span>${escape(t)}</span>`).join('')}</div><span class="row-source">${escape(e.sourceName||e.source)}${e.approvalRequired?' · Approval':''}</span>${saveButton(e)}${e.source==='friends'?`<button class="remove" data-remove="${escape(e.id)}">Remove</button>`:''}</article>`).join('');
  } else if(state.view==='calendar') {
    const start=stanfordTime((state.day==='week'?state.today:state.day)+'T12:00');
    const days=Array.from({length:7},(_,i)=>dateKey(Date.parse(start)+i*86400000));
    $('cards').innerHTML=`<div class="calendar-scroll"><div class="calendar-grid">${days.map(day=>{
      const entries=list.filter(e=>dateKey(e.start)===day).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
      return `<section class="calendar-day ${day===state.today?'is-today':''}"><div class="calendar-day-heading"><strong>${escape(shortDate(stanfordTime(day+'T12:00')))}</strong><span>${entries.length} ${entries.length===1?'event':'events'}</span></div>${entries.length?entries.map(e=>`<button class="calendar-event topic-${Object.keys(TOPICS).indexOf(e.topics[0])}" data-detail="${escape(e.id)}"><span class="calendar-time">${escape(e.timeTBD?'Time TBD':e.allDay?'All day':time(e.start))}${e.approvalRequired?' · Approval':''}</span><strong>${escape(e.title)}</strong><span class="calendar-location">${escape(e.location)}</span><span class="calendar-source">${escape(e.sourceName||e.source)}${e.topics[0]?' · '+escape(e.topics[0]):''}</span></button>`).join(''):'<p class="calendar-none">No matching events</p>'}</section>`;
    }).join('')}</div></div><p class="calendar-help">Select an event for details. On your phone, swipe across the days. All times are at Stanford.</p>`;
  } else $('cards').innerHTML=list.map(e=>{
    const matched=e.topics.filter(t=>state.interests.includes(t));
    const when=(state.day==='week'?shortDate(e.start)+' · ':'')+(e.timeTBD?'Time TBD':e.allDay?'All day':time(e.start)+(e.end?' – '+time(e.end):''));
    const source=e.source==='friends'?'FRIENDS':e.source==='luma'?'LUMA':e.source==='calendar'?'CALENDAR':'STANFORD';
    const link=e.url?`<a href="${escape(e.url)}" target="_blank" rel="noopener noreferrer">${e.source==='friends'?'Event link':e.source==='luma'?'Details & RSVP':'Details & registration'} ↗</a>`:'<span>Ask the host for details</span>';
    return `<article class="card"><div class="card-top ${e.image?'':'placeholder'}">${e.image?`<img src="${escape(e.image)}" alt="" loading="lazy">`:escape(e.source==='friends'?'Your people.':e.topics[0]||'Good plans.')}<span class="source-badge">${source}</span><button class="save" data-save="${escape(e.id)}" aria-label="${state.saved.includes(e.id)?'Unsave':'Save'} ${escape(e.title)}" aria-pressed="${state.saved.includes(e.id)}">${state.saved.includes(e.id)?'★':'☆'}</button></div><div class="card-body"><div class="when">${escape(when)}</div><h3>${escape(e.title)}</h3><div class="location">⌖ ${escape(e.location)}${e.source==='friends'?' · '+escape(e.host):''}</div><p class="description">${escape(e.description.slice(0,175))}${e.description.length>175?'…':''}</p><div class="tags" aria-label="Matching interests">${(matched.length?matched:e.topics).map(t=>`<span>${escape(t)}</span>`).join('')}${e.source==='friends'&&!e.topics.length?'<span>Hangout</span>':''}</div><div class="card-bottom">${link}<span class="price">${e.free?'Free entry':escape(e.price||'Cost not listed')}</span></div>${e.source==='friends'?`<div class="card-bottom"><span>Shared by ${escape(e.host)}</span><button class="remove" data-remove="${escape(e.id)}">Remove plan</button></div>`:''}</div></article>`;
  }).join('');
  $('cards').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>showDetail(b.dataset.detail));
  $('cards').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.save;state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];write('wtm-saved',state.saved);render();});
  $('cards').querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.remove;const confirmed=await removalConfirmation();if(!confirmed)return;
    try{if(preview){write('wtm-preview-plans',read('wtm-preview-plans',[]).filter(p=>`friend:${p.id}`!==id));}else{await api(`plans/${encodeURIComponent(id.slice(7))}`,'DELETE');}await load();toast('Plan removed.');}catch(e){toast(e.message);}
  });
}
function setSection(section){
  state.section=section;state.day='week';state.search='';$('search').value='';state.region=section==='moves'?'all':'campus';state.source='all';
  document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===state.region));
  document.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('active',b.dataset.source==='all'));dates();render();
}
document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>setSection(b.dataset.section));
$('open-moves').onclick=()=>setSection('moves');
function saveButton(e){return `<button class="row-save" data-save="${escape(e.id)}" aria-label="${state.saved.includes(e.id)?'Unsave':'Save'} ${escape(e.title)}" aria-pressed="${state.saved.includes(e.id)}">${state.saved.includes(e.id)?'★':'☆'}</button>`;}
function showDetail(id){
  const e=events.find(e=>e.id===id);if(!e)return;
  $('detail-source').textContent=e.sourceName||e.source;
  $('detail-title').textContent=e.title;
  $('detail-when').textContent=shortDate(e.start)+' · '+(e.timeTBD?'Time TBD':e.allDay?'All day':time(e.start)+(e.end?' – '+time(e.end):''))+' · Stanford time';
  $('detail-location').textContent='⌖ '+e.location;
  $('detail-eligibility').textContent='Free admission · '+e.access+' · '+e.freeEvidence;
  $('detail-tags').innerHTML=e.topics.map(t=>`<span>${escape(t)}</span>`).join('');
  $('detail-description').textContent=e.description||'Ask the host or check the event page for more details.';
  $('detail-link').innerHTML=e.url?`<a class="primary detail-rsvp" href="${escape(e.url)}" target="_blank" rel="noopener noreferrer">Event details & RSVP ↗</a>`:'<p>Ask the host for details.</p>';
  const save=$('detail-save');
  const updateSave=()=>{save.textContent=state.saved.includes(id)?'★ Saved':'☆ Save event';save.setAttribute('aria-pressed',String(state.saved.includes(id)));};
  updateSave();save.onclick=()=>{state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];write('wtm-saved',state.saved);updateSave();render();};
  $('event-dialog').showModal();
}
$('close-event').onclick=()=>$('event-dialog').close();
function removalConfirmation(){return new Promise(resolve=>{
  const dialog=$('remove-dialog');let confirmed=false;
  $('confirm-remove').onclick=()=>{confirmed=true;dialog.close();};
  $('cancel-remove').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>resolve(confirmed),{once:true});dialog.showModal();
});}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;if(state.view==='calendar'){state.day='week';dates();}write('wtm-view',state.view);render();});
async function load(){
  try {
    const data=preview?await fetch('preview-data.json').then(r=>r.json()):await api('events');
    if(preview){data.plans=read('wtm-preview-plans',[]);$('preview').hidden=false;}
    events=data.events||normalize(data);ready=true;
    const stale=!data.updatedAt||Date.now()-Date.parse(data.updatedAt)>30*3600000;
    $('freshness').classList.toggle('stale',stale);
    $('freshness').textContent=data.updatedAt?`Daily feed · Last Stanford refresh: ${shortDate(data.updatedAt)}, ${time(data.updatedAt)}${stale?' · Feed is overdue; check event links for updates.':''}${data.warnings?.length?' · '+data.warnings.join(' '):''}`:'Campus feed unavailable. Friends’ plans still work. Check Stanford Events for current listings.';
    $('logout').hidden=preview;
    if($('login').open)$('login').close();render();
  }catch(e){
    if(e.status===401){ready=false;$('freshness').textContent='An invite code keeps this feed for your crew.';if(!$('login').open)$('login').showModal();}
    else{$('freshness').textContent=e.message;$('cards').innerHTML='<div class="empty"><strong>The feed needs a little setup.</strong>'+escape(e.message)+'</div>';}
  }
}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await api('session','POST',{code:new FormData(e.target).get('code')});$('login-error').textContent='';await load();}catch(error){$('login-error').textContent=error.message;}};
$('login').addEventListener('cancel',e=>e.preventDefault());
$('logout').onclick=async()=>{try{await api('logout','POST');events=[];ready=false;render();$('cards').replaceChildren();$('logout').hidden=true;await load();}catch(e){toast(e.message);}};
$('add').onclick=()=>{if(!ready){toast('Join your group before posting a plan.');return;}$('plan-form').elements.region.value=state.region==='sf'?'sf':'campus';$('plan-dialog').showModal();};
$('close-plan').onclick=()=>$('plan-dialog').close();
function planTags(){const names=[...Object.keys(TOPICS),'Hangout'];$('plan-tags').innerHTML=names.map(t=>`<button type="button" data-tag="${escape(t)}" class="chip ${tagSelection.includes(t)?'active':''}">${escape(t)}</button>`).join('');$('plan-tags').querySelectorAll('button').forEach(b=>b.onclick=()=>{const t=b.dataset.tag;tagSelection=tagSelection.includes(t)?tagSelection.filter(x=>x!==t):[...tagSelection,t];planTags();});}
$('plan-form').onsubmit=async e=>{
  e.preventDefault();$('submit-plan').disabled=true;
  try{
    const p=Object.fromEntries(new FormData(e.target));p.start=stanfordTime(p.start);p.end=stanfordTime(p.end);p.tags=tagSelection;p.url=safeURL(p.url);p.free=p.free==='on';p.accessible=p.accessible==='on';
    if(Date.parse(p.end)<=Date.parse(p.start))throw new Error('End time needs to be after start time.');
    if(preview){p.id=crypto.randomUUID();write('wtm-preview-plans',[...read('wtm-preview-plans',[]),p]);}else{await api('plans','POST',p);}
    $('plan-dialog').close();e.target.reset();tagSelection=[];planTags();$('plan-error').textContent='';state.section='discover';state.day=dateKey(p.start);state.source='friends';state.region=p.region||'campus';document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===state.region));document.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('active',b.dataset.source==='friends'));dates();await load();toast(preview?'Preview plan saved in this browser.':'Plan posted to the crew.');
  }catch(error){$('plan-error').textContent=error.message;}finally{$('submit-plan').disabled=false;}
};
document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{state.source=b.dataset.source;document.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('active',x===b));render();});
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{state.region=b.dataset.region;document.querySelectorAll('[data-region]').forEach(x=>x.classList.toggle('active',x===b));render();});
const previewCalendars=[{id:'stanford',name:'Stanford Events',region:'campus',builtin:true},{id:'stanford-builders',name:'Stanford xBuilders',region:'campus'},{id:'luma-sf',name:'Luma · San Francisco',region:'sf'}];
async function calendarSettings(){
  const data=preview?{calendars:read('wtm-preview-calendars',previewCalendars)}:await api('calendars');
  $('source-directory').innerHTML=(data.sources||[]).map(s=>`<div class="source-entry"><a href="${escape(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a><span>${escape(s.mode)}</span>${s.newsletter?`<a href="${escape(safeURL(s.newsletter))}" target="_blank" rel="noopener noreferrer">Join / updates ↗</a>`:''}</div>`).join('');
  $('calendar-settings').innerHTML=data.calendars.map(c=>`<div class="calendar-setting"><div><strong>${escape(c.name)}</strong><span>${c.region==='sf'?'SF':'Stanford & nearby'} · ${c.updated_at?'Last scanned '+shortDate(c.updated_at)+', '+time(c.updated_at):preview?'Preview calendar':'Waiting for first scan'}${c.eligible_count!==undefined?' · '+c.eligible_count+' eligible free events':''}${c.unverified_count?' · '+c.unverified_count+' prices could not be verified':''}${c.last_error?' · Scan failed; keeping saved events.':''}</span></div>${c.builtin?'<span>Always on</span>':`<button class="quiet" data-remove-calendar="${escape(c.id)}">Remove</button>`}</div>`).join('');
  $('calendar-settings').querySelectorAll('[data-remove-calendar]').forEach(b=>b.onclick=async()=>{
    try{if(preview){write('wtm-preview-calendars',data.calendars.filter(c=>c.id!==b.dataset.removeCalendar));}else{await api('calendars/'+encodeURIComponent(b.dataset.removeCalendar),'DELETE');}await calendarSettings();await load();toast('Calendar removed from the group feed.');}catch(e){$('calendar-error').textContent=e.message;}
  });
}
$('manage-calendars').onclick=async()=>{if(!ready){toast('Join your group to manage calendars.');return;}$('calendars-dialog').showModal();try{await calendarSettings();}catch(e){$('calendar-error').textContent=e.message;}};
$('close-calendars').onclick=()=>$('calendars-dialog').close();
$('calendar-form').onsubmit=async e=>{
  e.preventDefault();$('submit-calendar').disabled=true;$('calendar-error').textContent='';
  try{const c=Object.fromEntries(new FormData(e.target));
    if(preview){new URL(c.url.replace(/^webcal:\/\//,'https://'));c.id=crypto.randomUUID();write('wtm-preview-calendars',[...read('wtm-preview-calendars',previewCalendars),c]);toast('Preview saved. Production scans the feed when added.');}
    else{const result=await api('calendars','POST',c);toast(`Calendar added · ${result.count} events in the next week.`);}
    e.target.reset();await calendarSettings();await load();
  }catch(error){$('calendar-error').textContent=error.message;}finally{$('submit-calendar').disabled=false;}
};
$('search').oninput=e=>{state.search=e.target.value;render();};
for(const id of ['matched'])$(id).onchange=e=>{state[id]=e.target.checked;render();};
$('sort').onchange=e=>{state.sort=e.target.value;render();};
$("filters-panel").open=!matchMedia("(max-width:650px)").matches;
dates();topics();planTags();load();
setInterval(()=>{const today=dateKey(Date.now());if(today!==state.today){state.today=today;state.day=today;dates();load();}},60000);
