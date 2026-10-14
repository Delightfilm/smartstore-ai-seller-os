import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowClient } from '../src/data/workflowClient.js';
import { summarizeCandidates } from '../src/dashboard/operatingSummary.js';

test('external dashboards never request a token or call the PC-only worker endpoint',async()=>{
 for(const applicationOrigin of ['https://seller-os.pages.dev','http://127.0.0.1:5173.example.com','http://localhost:5174',undefined]){
  let tokens=0,requests=0;
  const client=createWorkflowClient({applicationOrigin,config:{mode:'cloud'},getAccessToken:async()=>{tokens++;return 'fixture-token';},fetchImpl:async()=>{requests++;return Response.json({enabled:true});}});
  for(const action of ['connect','status','stop'])await assert.rejects(()=>client.localWorker(action),e=>e.code==='LOCAL_WORKER_UNAVAILABLE');
  assert.equal(tokens,0);assert.equal(requests,0);
 }
});

test('exact local dashboard origins retain authenticated worker access',async()=>{
 for(const applicationOrigin of ['http://127.0.0.1:5173','http://localhost:5173']){
  let request;
  const client=createWorkflowClient({applicationOrigin,config:{mode:'cloud'},getAccessToken:async()=> 'fixture-token',fetchImpl:async(url,options)=>{request={url,options};return Response.json({enabled:true});}});
  for(const action of ['connect','status','stop']){
   assert.deepEqual(await client.localWorker(action),{enabled:true});
   assert.equal(request.url,'/api/research-worker');assert.equal(request.options.headers.authorization,'Bearer fixture-token');assert.deepEqual(JSON.parse(request.options.body),{action});
  }
 }
});

test('the browser origin default enforces the same local-only boundary',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'location');
 try{
  for(const origin of ['http://127.0.0.1:5173','https://seller-os.pages.dev']){
   Object.defineProperty(globalThis,'location',{configurable:true,value:{origin}});
   let calls=0;
   const client=createWorkflowClient({config:{mode:'cloud'},getAccessToken:async()=> 'fixture-token',fetchImpl:async()=>{calls++;return Response.json({enabled:true});}});
   if(origin==='http://127.0.0.1:5173'){await client.localWorker('status');assert.equal(calls,1);}
   else{await assert.rejects(()=>client.localWorker('status'),e=>e.code==='LOCAL_WORKER_UNAVAILABLE');assert.equal(calls,0);}
  }
 }finally{
  if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;
 }
});

test('operating counts do not invent orders or revenue',()=>{
 assert.deepEqual(summarizeCandidates([]),{candidateCount:0,holdCount:0,reviewRequiredCount:0});
 assert.deepEqual(summarizeCandidates([{review:{status:'HOLD'}},{review:{status:'REVIEW_REQUIRED'}}]),{candidateCount:2,holdCount:1,reviewRequiredCount:1});
});
test('cloud requests require token and logout discards pending response',async()=>{
 let token=null,release,calls=[];
 const client=createWorkflowClient({config:{mode:'cloud',url:'https://abcdefghijabcdefghij.supabase.co',publishableKey:'sb_publishable_test'},workspaceId:'ccb5017e-7c70-414d-b103-38e17e48e799',getAccessToken:async()=>token,fetchImpl:async(url,options)=>{calls.push({url,options});return new Promise(r=>{release=r;});}});
 await assert.rejects(()=>client.request({action:'list'}));assert.equal(calls.length,0);
 token='valid';const pending=client.request({action:'list'});await new Promise(r=>setImmediate(r));
 token=null;client.invalidate();release(Response.json([]));await assert.rejects(()=>pending,e=>e.code==='SESSION_CHANGED');
});
test('network-uncertain write retry reuses request identity without automatic retry',async()=>{
 const requests=[];
 const client=createWorkflowClient({config:{mode:'cloud',url:'https://abcdefghijabcdefghij.supabase.co',publishableKey:'sb_publishable_test'},workspaceId:'ccb5017e-7c70-414d-b103-38e17e48e799',getAccessToken:async()=>'valid',fetchImpl:async(url,options)=>{
  requests.push(JSON.parse(options.body));if(requests.length===1)throw new TypeError('connection lost');return Response.json({revision:2});
 }});
 const input={action:'update',id:'123',revision:1,terms:{}};
 await assert.rejects(()=>client.request(input));assert.equal(requests.length,1);
 assert.deepEqual(await client.request(input),{revision:2});
 assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId);
 assert.match(requests[0].requestId,/^[0-9a-f-]{36}$/);
});
