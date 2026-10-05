import {writeFile} from 'node:fs/promises';
import {dateDays,dateKey,stanfordTime} from '../public/model.mjs';

// Synthetic examples only. Generated locally; excluded from Git and deployments.
const now=Date.now(),days=dateDays(dateKey(now),7);
const specs=[
  ['AI research + coffee','Campus demo venue','AI','Research','Food & drinks'],
  ['Startup builders meetup','Campus demo venue','Startups','CS'],
  ['Quant trading seminar','Campus demo venue','Trading','Research'],
  ['SF software + pizza night','SF demo venue','CS','Food & drinks']
];
const external=specs.map(([title,location,...tags],i)=>{
  const day=days[i+1];
  return {id:`demo-${i+1}`,title:`[Demo] ${title}`,description:'Fictional event for exploring the interface. This is not a real invitation.',location,tags,start:stanfordTime(day+'T18:00'),end:stanfordTime(day+'T19:30'),region:i===3?'sf':'campus',source:'campus',sourceName:'Synthetic demo',free:true,accessible:true,freeEvidence:'Fictional example',access:'Demo only',url:'',image:''};
});
await writeFile('public/preview-data.json',JSON.stringify({pages:[],external,updatedAt:new Date(now).toISOString()},null,2)+'\n');
console.log('Created four fictional preview events. Serve public/ and open ?preview=1 on localhost.');
