export async function registerPhoton(env=process.env,fetcher=fetch){
  if(env.SPECTRUM_WEBHOOK_SECRET)return {alreadyConfigured:true};
  const id=env.SPECTRUM_PROJECT_ID?.trim(),secret=env.SPECTRUM_PROJECT_SECRET?.trim();
  if(!id||!secret)throw new Error('Save SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET in Production first.');
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('SPECTRUM_PROJECT_ID should be the project UUID from Photon Settings.');
  const url=`https://spectrum.photon.codes/projects/${id}/webhooks/`,webhookUrl='https://wtm-rn.vercel.app/api/photon';
  const headers={Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),'Content-Type':'application/json'};
  const list=await fetcher(url,{headers,signal:AbortSignal.timeout(15000)});
  if(!list.ok)throw new Error(list.status===401?'Photon rejected the project credentials. Check the two Production values.':'Photon could not list webhooks. Please try again.');
  const existing=await list.json();if(!Array.isArray(existing.data))throw new Error('Photon returned an unexpected webhook list.');
  if(existing.data.some(w=>w.webhookUrl===webhookUrl))throw new Error('This webhook is already registered. Its signing secret must be saved before it can be connected.');
  const result=await fetcher(url,{method:'POST',headers,body:JSON.stringify({webhookUrl}),signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw new Error('Photon could not register the webhook. Please check the project settings.');
  const data=(await result.json()).data;
  if(typeof data?.signingSecret!=='string'||!data.signingSecret||data.signingSecret.length>256)throw new Error('Photon did not return a signing secret. Check the registered webhook before retrying.');
  return {webhookId:data.id,signingSecret:data.signingSecret};
}
