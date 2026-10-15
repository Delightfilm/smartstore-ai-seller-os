import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgencyHandler } from '../server/cloud/handler.js';
import { authenticateRequest } from '../server/cloud/auth.js';
import { validateCandidateUpdate } from '../server/candidateUpdate.js';

const workspace='ccb5017e-7c70-414d-b103-38e17e48e799';
const requestId='00000000-0000-4000-8000-000000000041';
const candidate={id:'123',revision:1,product:{offerId:'123'},terms:{},listing:{},market:null,research:{salePriceKrw:14900},review:{status:'HOLD',reasons:['근거 확인'],note:'',stale:false},publication:{status:'NOT_PUBLISHED'}};
const request=(body,headers={})=>new Request('https://project.supabase.co/functions/v1/seller-os-agency',{method:'POST',headers:{origin:'http://127.0.0.1:5173','content-type':'application/json',authorization:'Bearer user-token',...headers},body:JSON.stringify(body)});

test('commerce read and publish require identity exact fields and sanitize reports before storage',async()=>{
 let writes=0;const handler=createAgencyHandler({allowedOrigins:['http://127.0.0.1:5173'],authenticate:async({authorization,workspaceId})=>{
  if(authorization!=='Bearer user-token')throw Object.assign(new Error('SIGN_IN_REQUIRED'),{code:'SIGN_IN_REQUIRED',status:401});
  if(workspaceId!==workspace)throw Object.assign(new Error('WORKSPACE_FORBIDDEN'),{code:'WORKSPACE_FORBIDDEN',status:403});return {userId:'actor',workspaceId};
 },storeFor:()=>({}),commerceFor:()=>({read:async()=>null,publish:async()=>{writes++;return {revision:1};}})});
 const read={action:'commerceRead',workspaceId:workspace};const response=await handler(request(read));assert.equal(response.status,200);assert.deepEqual(await response.json(),{actorId:'actor',snapshot:null});
 assert.equal((await handler(request(read,{authorization:'Bearer fake'}))).status,401);
 assert.equal((await handler(request({...read,workspaceId:requestId}))).status,403);
 const write={action:'commercePublish',workspaceId:workspace,expectedRevision:0,report:{status:'FAILED',channel:null,errorCode:'AUTH_FAILED'}};
 assert.equal((await handler(request({...write,report:{...write.report,token:'secret'}}))).status,400);assert.equal(writes,0);
 assert.equal((await handler(request(write))).status,200);assert.equal(writes,1);
});

test('auth requires a verified user and workspace membership, never user_metadata roles',async()=>{
 const deps={getUser:async()=>({id:'user',user_metadata:{role:'owner'}}),getMembership:async()=>null};
 await assert.rejects(()=>authenticateRequest({authorization:'',workspaceId:workspace},deps),e=>e.status===401);
 await assert.rejects(()=>authenticateRequest({authorization:'Bearer bad',workspaceId:workspace},{...deps,getUser:async()=>null}),e=>e.status===401);
 await assert.rejects(()=>authenticateRequest({authorization:'Bearer valid',workspaceId:workspace},deps),e=>e.status===403);
 assert.deepEqual(await authenticateRequest({authorization:'Bearer valid',workspaceId:workspace},{...deps,getMembership:async()=>({role:'owner'})}),{userId:'user',workspaceId:workspace});
});

test('candidate edits reject stale state, forged approval and unknown fields; changed evidence invalidates confirmation',()=>{
 assert.throws(()=>validateCandidateUpdate(candidate,{revision:0,terms:{}}));
 assert.throws(()=>validateCandidateUpdate(candidate,{revision:1,terms:{role:'owner'}}));
 assert.throws(()=>validateCandidateUpdate(candidate,{revision:1,review:{status:'READY',reasons:[],note:''}}));
 const patch=validateCandidateUpdate(candidate,{revision:1,research:{salePriceKrw:17900},terms:{costsConfirmed:true}});
 assert.equal(patch.research.salePriceKrw,17900);
 assert.equal(patch.terms.costsConfirmed,false);
 assert.equal(patch.review.stale,true);
 assert.equal(patch.review.reviewedAt,null);
});

test('HTTP handler scopes data, blocks external actions, invalid origins/fields and oversized input',async()=>{
 const handler=createAgencyHandler({allowedOrigins:['http://127.0.0.1:5173'],authenticate:async()=>({userId:'user',workspaceId:workspace}),storeFor:()=>({list:async()=>[candidate]})});
 assert.equal((await handler(request({action:'list',workspaceId:workspace}))).status,200);
 for(const body of [{action:'publish',workspaceId:workspace},{action:'list',workspaceId:workspace,actorId:'other'}])assert.equal((await handler(request(body))).status,400);
 assert.equal((await handler(request({action:'list',workspaceId:workspace},{origin:'https://evil.example'}))).status,403);
 assert.equal((await handler(request({action:'update',workspaceId:workspace,id:'123',revision:1,terms:{},requestId:'bad'}))).status,400);
 assert.equal((await handler(request({action:'list',workspaceId:workspace,padding:'x'.repeat(66000)}))).status,413);
});

test('HTTP retry returns stored result before revalidation and mismatched body is rejected',async()=>{
 let saved=null;
 const store={get:async()=>saved?.result || candidate,replay:async(id,input)=>{
  if(!saved)return null;
  if(JSON.stringify(input)!==JSON.stringify(saved.input))throw Object.assign(new Error('REQUEST_REUSED'),{status:409});
  return saved.result;
 },update:async(id,revision,patch,input)=>{saved={input,result:{...candidate,...patch,revision:2}};return saved.result;}};
 const handler=createAgencyHandler({allowedOrigins:['http://127.0.0.1:5173'],authenticate:async()=>({userId:'user',workspaceId:workspace}),storeFor:()=>store});
 const input={action:'update',workspaceId:workspace,requestId,id:'123',revision:1,review:{status:'HOLD',reasons:['근거 대기'],note:'저장 확인'}};
 const first=await handler(request(input));assert.equal(first.status,200);
 const repeated=await handler(request(input));assert.equal(repeated.status,200);
 assert.deepEqual(await repeated.json(),await first.json());
 assert.equal((await handler(request({...input,review:{...input.review,note:'다른 본문'}}))).status,409);
});
test('retry that commits between replay lookup and candidate read returns the original successful result',async()=>{
 let replayReads=0;
 const saved={...candidate,revision:2};
 const store={replay:async()=>++replayReads===1?null:saved,get:async()=>saved,update:async()=>{throw new Error('Should not write twice');}};
 const handler=createAgencyHandler({allowedOrigins:['http://127.0.0.1:5173'],authenticate:async()=>({userId:'user',workspaceId:workspace}),storeFor:()=>store});
 const response=await handler(request({action:'update',workspaceId:workspace,requestId,id:'123',revision:1,terms:{}}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),saved);
});
