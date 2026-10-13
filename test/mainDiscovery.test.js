import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoveryController } from '../src/dashboard/discoveryController.js';
import { discoveryProgress, savedCandidateViews } from '../src/dashboard/discoveryView.js';
import { createWorkflowClient } from '../src/data/workflowClient.js';
import { createResearchWorker } from '../server/researchWorker.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('main discovery enqueues the captured query once while a double click is pending',async()=>{
 const queued=deferred(),calls=[];let state,records;
 const client={localWorker:async action=>{calls.push(action);return {enabled:true};},request:async input=>{
  calls.push(input);if(input.action==='researchEnqueue')return queued.promise;
  return input.action==='list'?[{id:'1',revision:2}]:{jobs:[{id:'job1',kind:'search',status:'QUEUED',input:{query:'收纳盒'}}],workerOnline:true};
 }};
 const controller=createDiscoveryController({client,localAvailable:true,onState:next=>state=next,onCandidates:rows=>records=rows});
 const first=controller.start(' 收纳盒 ');await Promise.resolve();
 assert.equal(await controller.start('different'),false);
 queued.resolve({id:'job1'});assert.equal(await first,true);
 assert.deepEqual(calls.filter(c=>c?.action==='researchEnqueue'),[{action:'researchEnqueue',kind:'search',query:'收纳盒'}]);
 assert.equal(state.busy,false);assert.equal(state.jobs[0].id,'job1');assert.equal(records[0].revision,2);
});
test('uncertain enqueue retries preserve the existing authenticated client request identity',async()=>{
 const bodies=[];let fail=true;
 const client=createWorkflowClient({config:{mode:'cloud',url:'https://example.supabase.co',publishableKey:'public'},workspaceId:'workspace',getAccessToken:async()=> 'fixture-token',fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);bodies.push(body);
  if(body.action==='researchEnqueue'&&fail){fail=false;throw new Error('transport lost');}
  return {ok:true,json:async()=>body.action==='list'?[]:body.action==='researchList'?{jobs:[],workerOnline:false}:{id:'job1'}};
 }});
 let state;const controller=createDiscoveryController({client,localAvailable:false,onState:next=>state=next,onCandidates:()=>{}});
 assert.equal(await controller.start('收纳盒'),false);assert.match(state.message,/transport lost/);
 assert.equal(await controller.start('收纳盒'),true);
 const enqueues=bodies.filter(b=>b.action==='researchEnqueue');assert.equal(enqueues.length,2);assert.equal(enqueues[0].requestId,enqueues[1].requestId);
 assert.equal(bodies.some(b=>['market','collect','register','shipment'].includes(b.action)),false);
});
test('disposal ignores a delayed authenticated poll and candidate load',async()=>{
 const waiting=deferred();let writes=0;
 const controller=createDiscoveryController({client:{request:async()=>waiting.promise},localAvailable:false,onState:()=>writes++,onCandidates:()=>writes++});
 const poll=controller.poll();controller.dispose();const before=writes;waiting.resolve({jobs:[],workerOnline:false});await poll;
 assert.equal(writes,before);
});
test('a new queue operation invalidates an older in-flight progress response',async()=>{
 const waiting=deferred();let first=true,state;
 const client={request:async input=>input.action==='list'?[]:input.action==='researchEnqueue'?{id:'new'}:first?(first=false,waiting.promise):{jobs:[{id:'new'}],workerOnline:false}};
 const controller=createDiscoveryController({client,localAvailable:false,onState:next=>state=next,onCandidates:()=>{}});
 const old=controller.poll(),start=controller.start('收纳盒');waiting.resolve({jobs:[{id:'old'}],workerOnline:false});await Promise.all([old,start]);
 assert.equal(state.jobs[0].id,'new');
});
test('progress is scoped to the latest research root, not fabricated full-pipeline counts',()=>{
 const jobs=[
  {id:'old',kind:'search',created_at:'2026-10-12',status:'SUCCEEDED'},
  {id:'root',kind:'search',created_at:'2026-10-13',status:'SUCCEEDED',input:{query:'收纳盒'},result:{urls:['a','b','c']}},
  {id:'child1',kind:'refresh',status:'QUEUED',input:{parentJobId:'root'}},
  {id:'child2',kind:'refresh',status:'WAITING_HUMAN',input:{parentJobId:'root'},result:{code:'BROWSER_VERIFY_REQUIRED'}},
  {id:'child3',kind:'refresh',status:'SUCCEEDED',input:{parentJobId:'root'},result:{status:'HOLD'}},
 ];
 const progress=discoveryProgress(jobs);assert.equal(progress.target,'收纳盒');assert.equal(progress.total,4);
 assert.deepEqual(progress.counts,{queued:1,running:0,human:1,failed:0,completed:2,saved:0,rejected:1});
 assert.equal(progress.jobs.length,4);assert.equal(progress.jobs.some(j=>j.id==='old'),false);
});
test('stored candidate views retain HOLD and unknown economics without generated recommendation scores',()=>{
 const rows=[{id:'816692570613',revision:8,updatedAt:'2026-10-13',product:{title:'P2013',minOrderQty:1,variants:[],canonicalUrl:'https://detail.1688.com/offer/816692570613.html'},terms:{},market:{},review:{status:'HOLD',reasons:['gross unverified']}}];
 const views=savedCandidateViews(rows,{status:'전체'});assert.equal(views.length,1);assert.equal(views[0].status,'HOLD');assert.equal(views[0].revision,8);
 assert.equal(views[0].profitKrw,null);assert.equal(views[0].score,undefined);assert.ok(views[0].reasons.includes('gross unverified'));
 assert.equal(savedCandidateViews(rows,{status:'REVIEW_REQUIRED'}).length,0);
});
test('explicit retry resumes the real foreground worker stopped by a human verification error',async()=>{
 let jobStatus='QUEUED',challenge=true;
 const job={id:'job1',kind:'refresh',lease_id:'lease',input:{url:'https://detail.1688.com/offer/123456.html'}};
 const worker=createResearchWorker({call:async input=>{
  if(input.action==='workerClaim'){if(jobStatus!=='QUEUED')return null;jobStatus='RUNNING';return job;}
  if(input.action==='workerFail')jobStatus='WAITING_HUMAN';
  if(input.action==='workerComplete')jobStatus='SUCCEEDED';
 },collect:async()=>{if(challenge){challenge=false;throw Object.assign(new Error('captcha'),{code:'BROWSER_VERIFY_REQUIRED'});}return {researchRaw:{offerId:'123456'}};}});
 await worker.connect('fixture-token');await worker.tick();assert.equal(worker.status().enabled,false);
 const client={localWorker:action=>action==='connect'?worker.connect('fixture-token'):Promise.resolve(worker.status()),request:async input=>{
  if(input.action==='researchRetry'){jobStatus='QUEUED';return {};}
  return input.action==='list'?[]:{jobs:[{...job,status:jobStatus}],workerOnline:worker.status().enabled};
 }};
 const controller=createDiscoveryController({client,localAvailable:true,onState:()=>{},onCandidates:()=>{}});
 await controller.retry(job.id);await worker.tick();
 assert.equal(jobStatus,'SUCCEEDED');assert.equal(worker.status().enabled,true);
});
test('a recovered successful poll clears its stale connection failure message',async()=>{
 let offline=true,state;
 const client={request:async input=>{if(offline)throw new Error('offline');return input.action==='list'?[]:{jobs:[],workerOnline:false};}};
 const controller=createDiscoveryController({client,localAvailable:false,onState:next=>state=next,onCandidates:()=>{}});
 await controller.poll();assert.match(state.message,/조회 실패/);offline=false;await controller.poll();
 assert.equal(state.fresh,true);assert.doesNotMatch(state.message,/조회 실패/);
});
