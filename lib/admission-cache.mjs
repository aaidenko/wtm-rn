// Store public admission data only. Nearby events are rechecked every daily scan;
// distant events reuse checks for up to three days. Failures are never cached.
export function admissionCache(previous=[],now=Date.now()){
  const entries=new Map(previous.filter(e=>e&&Number.isFinite(e.checkedAt)&&now-e.checkedAt<72*3600000&&e.checkedAt<=now).map(e=>[e.kind+':'+e.url,e]));
  const pending=new Map();let hits=0,checks=0;
  return {
    async read(kind,url,start,loader){
      const key=kind+':'+url,cached=entries.get(key),hint=Date.parse(start);
      const near=Math.min(hint||Infinity,Date.parse(cached?.start)||Infinity)<now+3*86400000;
      const ttl=(near?20:72)*3600000;
      if(cached&&now-cached.checkedAt<ttl&&(!start||cached.start===start)){hits++;return cached;}
      if(pending.has(key))return pending.get(key);
      const task=(async()=>{checks++;const value=await loader();const entry={kind,url,start:start||value?.event?.start_at||null,checkedAt:now,value};entries.set(key,entry);return entry;})();
      pending.set(key,task);
      try{return await task;}finally{pending.delete(key);}
    },
    snapshot(){return [...entries.values()].sort((a,b)=>b.checkedAt-a.checkedAt).slice(0,1200);},
    stats(){return {reused:hits,checked:checks};}
  };
}
