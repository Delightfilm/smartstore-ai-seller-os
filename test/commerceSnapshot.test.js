import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommerceReport, projectCommerceStatus } from '../server/commerce/snapshot.js';
import { createCommerceStore } from '../server/cloud/commerceStore.js';
const channel={channelNo:'123',name:'Test Store',url:'https://smartstore.naver.com/test'};
test('strict report rejects unknown nested data actor timestamps and invalid states',()=>{
 const good={status:'VERIFIED',channel,errorCode:null};assert.deepEqual(validateCommerceReport(good),good);
 for(const bad of [{...good,actorId:'forged'},{...good,channel:{...channel,token:'secret'}},{...good,errorCode:'AUTH_FAILED'},{...good,channel:null},{status:'FAILED',channel,errorCode:'FORBIDDEN'},{status:'FAILED',channel:null,errorCode:'private error'},{...good,channel:{...channel,url:'https://evil.example/'}}])assert.throws(()=>validateCommerceReport(bad),{code:'COMMERCE_REPORT_INVALID'});
});
test('status projects absent stale and failed over prior success honestly',()=>{
 const s={status:'VERIFIED',succeededAt:'2026-10-15T00:00:00.000Z'};const now=Date.parse(s.succeededAt);
 assert.equal(projectCommerceStatus(null,now),'UNVERIFIED');assert.equal(projectCommerceStatus(s,now+899999),'VERIFIED');
 assert.equal(projectCommerceStatus(s,now+900001),'STALE');assert.equal(projectCommerceStatus({...s,status:'FAILED'},now+900001),'FAILED');
});
test('store scopes read and validated CAS writes to fixed workspace and actor',async()=>{
 const calls=[];const chain={select(x){calls.push(['select',x]);return this;},eq(...x){calls.push(['eq',...x]);return this;},maybeSingle:async()=>({data:null,error:null})};
 const client={from:t=>(calls.push(['from',t]),chain)};let args;
 const writer={rpc:async(name,input)=>{args={name,input};return {data:{revision:1},error:null};}};
 const store=createCommerceStore({client,writer,workspaceId:'workspace',actorId:'actor'});
 assert.equal(await store.read(),null);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='workspace_id'&&c[2]==='workspace'));
 await store.publish({expectedRevision:0,report:{status:'VERIFIED',channel,errorCode:null}});
 assert.equal(args.name,'seller_os_publish_commerce_connection');assert.equal(args.input.p_workspace_id,'workspace');assert.equal(args.input.p_actor_id,'actor');
 await assert.rejects(store.publish({expectedRevision:-1,report:{}}),{code:'COMMERCE_REPORT_INVALID'});
 const conflict=createCommerceStore({client,writer:{rpc:async()=>({error:{code:'40001',message:'PRIVATE'}})},workspaceId:'workspace',actorId:'actor'});
 await assert.rejects(conflict.publish({expectedRevision:1,report:{status:'FAILED',channel:null,errorCode:'AUTH_FAILED'}}),e=>e.status===409&&e.code==='COMMERCE_REVISION_CONFLICT'&&!e.message.includes('PRIVATE'));
});
