import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPhoton} from '../lib/photon-setup.mjs';
import handler from '../api/index.mjs';
const env={SPECTRUM_PROJECT_ID:'12345678-1234-1234-1234-123456789abc',SPECTRUM_PROJECT_SECRET:'fake-secret'};
test('Protected setup registers only the fixed WTM webhook and never duplicates it',async()=>{
 const calls=[];
 const result=await registerPhoton(env,async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>calls.length===1?{data:[]}:{data:{id:'webhook',signingSecret:'fake-signing-secret'}}};});
 assert.equal(result.webhookId,'webhook');assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].opts.body).webhookUrl,'https://wtm-rn.vercel.app/api/photon');
 let attempts=0;await assert.rejects(()=>registerPhoton(env,async()=>{attempts++;return {ok:true,json:async()=>({data:[{webhookUrl:'https://wtm-rn.vercel.app/api/photon'}]})};}),/already registered/);assert.equal(attempts,1);
});
test('Configured setup avoids provider calls and errors do not expose credentials',async()=>{
 assert.deepEqual(await registerPhoton({...env,SPECTRUM_WEBHOOK_SECRET:'configured'},()=>{throw new Error('unexpected');}),{alreadyConfigured:true});
 await assert.rejects(()=>registerPhoton(env,async()=>({ok:false,status:401})),e=>!e.message.includes(env.SPECTRUM_PROJECT_SECRET)&&/rejected/.test(e.message));
});
test('Setup endpoint requires the operator bearer secret, independent of friend login',async()=>{
 const req={method:'POST',url:'/api?path=photon-setup',query:{path:'photon-setup'},headers:{host:'wtm-rn.vercel.app',origin:'https://wtm-rn.vercel.app'},body:{}};
 const res={setHeader(){},status(s){this.statusCode=s;return this;},json(data){this.data=data;return this;}};
 await handler(req,res);assert.equal(res.statusCode,401);assert.equal(res.data.error,'Unauthorized');
});
