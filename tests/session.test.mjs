import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('an eight-character group code can sign in without a database request',async()=>{
  const previous=process.env.GROUP_CODE;process.env.GROUP_CODE='group123';
  try{
    const res=response();await handler({url:'/api/session',method:'POST',query:{path:'session'},headers:{host:'example.vercel.app',origin:'https://example.vercel.app'},body:{code:'group123'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
  }finally{if(previous===undefined)delete process.env.GROUP_CODE;else process.env.GROUP_CODE=previous;}
});
test('incorrect codes and cross-origin submissions are rejected',async()=>{
  const previous=process.env.GROUP_CODE;process.env.GROUP_CODE='group123';
  try{
    const wrong=response();await handler({url:'/api/session',method:'POST',query:{path:'session'},headers:{host:'example.vercel.app',origin:'https://example.vercel.app'},body:{code:'wrong123'}},wrong);assert.equal(wrong.statusCode,401);
    const origin=response();await handler({url:'/api/session',method:'POST',query:{path:'session'},headers:{host:'example.vercel.app',origin:'https://another.example'},body:{code:'group123'}},origin);assert.equal(origin.statusCode,403);
  }finally{if(previous===undefined)delete process.env.GROUP_CODE;else process.env.GROUP_CODE=previous;}
});
