import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createCommerceReader, normalizeChannels } from '../server/commerce/naverReader.js';

const salt='$2a$04$abcdefghijklmnopqrstuu'; // synthetic, never a real credential
const channel={channelNo:123,channelType:'STOREFARM',name:'Test Store',url:'https://smartstore.naver.com/test-store',talkTalkAccountId:'PII_SENTINEL'};
const account={accountId:'ACCOUNT_SENTINEL',accountUid:'UID_SENTINEL',grade:'SEED'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function fixture(respond){
 let time=1800000000000; const calls=[];
 const reader=createCommerceReader({clientId:'synthetic-client',clientSecret:salt,now:()=>time,fetchImpl:async(url,init)=>{
  calls.push({url,...init}); if(respond){const result=await respond(url,init,calls);if(result)return result;}
  return json(url.endsWith('/token')?{access_token:'TOKEN_SENTINEL',token_type:'Bearer',expires_in:3600}:url.endsWith('/account')?account:channel);
 }});
 return {reader,calls,setTime:t=>time=t};
}
test('SELF signature and exact three request allowlist with minimized output',async()=>{
 const f=fixture();const result=await f.reader.read({});
 const body=f.calls[0].body;assert.equal(body.get('grant_type'),'client_credentials');assert.equal(body.get('type'),'SELF');
 assert.equal(body.get('timestamp'),'1800000000000');
 assert.equal(body.get('client_secret_sign'),Buffer.from(bcrypt.hashSync('synthetic-client_1800000000000',salt)).toString('base64'));
 assert.deepEqual(f.calls.map(c=>[c.method,new URL(c.url).pathname]),[['POST','/external/v1/oauth2/token'],['GET','/external/v1/seller/account'],['GET','/external/v1/seller/channels']]);
 assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://api.commerce.naver.com'&&c.redirect==='error'));
 assert.deepEqual(result,{channels:[{channelNo:'123',name:'Test Store',url:channel.url}]});
 assert.doesNotMatch(JSON.stringify(result),/SENTINEL|\$2a\$/);
});
test('memory cache expires early and clear forces fresh authentication',async()=>{
 const f=fixture();await f.reader.read({});await f.reader.read({});assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 f.setTime(1800003540000);await f.reader.read({});assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
 f.reader.clear();await f.reader.read({});assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
});
test('401 reauthentication budget is shared by whole read',async()=>{
 const f=fixture(url=>url.endsWith('/token')?null:json({code:'GW.AUTHN'},401));
 await assert.rejects(f.reader.read({}),{code:'AUTH_FAILED'});assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
 assert.equal(f.calls.filter(c=>c.method==='GET').length,2);
});
for(const [status,body,code] of [[429,{},'RATE_LIMITED'],[403,{code:'ROLE_NOT_FOUND'},'FORBIDDEN'],[403,{code:'GW.AUTHN.IP'},'IP_REJECTED'],[302,{},'UPSTREAM_INVALID']]){
 test(`HTTP ${status} ${code} sanitized without retries`,async()=>{const f=fixture(()=>json(body,status));await assert.rejects(f.reader.read({}),e=>e.code===code&&e.message===code);assert.equal(f.calls.length,1);});
}
test('invalid account shape prevents channels request',async()=>{const f=fixture(url=>url.endsWith('/account')?json({accountId:null}):null);await assert.rejects(f.reader.read({}),{code:'UPSTREAM_INVALID'});assert.equal(f.calls.length,2);});
test('response body limit enforces streamed bytes without content length',async()=>{
 const f=fixture(()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));c.close();}})));
 await assert.rejects(f.reader.read({}),{code:'UPSTREAM_INVALID'});assert.equal(f.calls.length,1);
});
test('remaining overall deadline bounds slow fetch and body',async()=>{
 for(const phase of ['fetch','body']){const f=fixture(()=>phase==='fetch'?new Promise(()=>{}):new Response(new ReadableStream({start(){}})));
  await assert.rejects(f.reader.read({deadlineAt:1800000000020}),{code:'TIMEOUT'});assert.equal(f.calls.length,1);}
});
test('expired overall deadline makes zero requests',async()=>{const f=fixture();await assert.rejects(f.reader.read({deadlineAt:1799999999999}),{code:'TIMEOUT'});assert.equal(f.calls.length,0);});
test('abort between account and channel prevents later GET',async()=>{
 const controller=new AbortController();const f=fixture(url=>{if(url.endsWith('/account'))controller.abort();});
 await assert.rejects(f.reader.read({signal:controller.signal}),{code:'TIMEOUT'});assert.equal(f.calls.length,2);
});
test('clear during in-flight authentication cannot refill cache or issue GET',async()=>{
 let release;const f=fixture(url=>url.endsWith('/token')?new Promise(resolve=>release=resolve):null);
 const pending=f.reader.read({});await new Promise(r=>setImmediate(r));f.reader.clear();release(json({access_token:'TOKEN_SENTINEL',token_type:'Bearer',expires_in:3600}));
 await assert.rejects(pending,{code:'TIMEOUT'});assert.equal(f.calls.length,1);
});
test('normalization rejects ambiguous unsafe IDs non-store channels and untrusted URLs',()=>{
 for(const raw of [null,[],{},[{...channel,channelNo:9007199254740992}],[channel,channel],{...channel,channelType:'WINDOW'},{...channel,url:'https://user:pass@smartstore.naver.com/a'},{...channel,url:'https://evil.example/x'},{...channel,url:channel.url+'?secret=1'}])assert.throws(()=>normalizeChannels(raw),{code:'UPSTREAM_INVALID'});
 assert.deepEqual(normalizeChannels({...channel,channelNo:'9007199254740993'}),[{channelNo:'9007199254740993',name:channel.name,url:channel.url}]);
});
