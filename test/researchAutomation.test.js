import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { researchOperation,researchJobsService } from '../server/cloud/researchJobs.js';
import { researchObservation } from '../server/research1688.js';
import { normalizeProduct,checkSourcingEligibility } from '../src/domain/normalizedProduct.js';
import { createResearchWorker } from '../server/researchWorker.js';
import { readResearchState,chooseResearchHtml } from '../server/research1688.js';
import { runInNewContext } from 'node:vm';
const url='https://detail.1688.com/offer/123456.html';
const identity={workerId:randomUUID(),jobId:randomUUID(),leaseId:randomUUID()};
const fixture=()=>researchObservation({html:`<script>window.__INIT_DATA__=${JSON.stringify({product:{offerId:'123456',minOrderQuantity:1,skuModel:{skuInfoMap:{'黑色':{skuId:'vendor1',price:'16.5',canBookCount:13}}}}})}</script>`,product:{canonicalUrl:url,title:'fixture only',images:[],supplier:null},packingRows:[{skuId:'vendor1',quantity:1,grossWeight:446,weightUnit:'g',dimensions:[18.5,14,4.5],lengthUnit:'cm'}]});

test('collector keeps vendor SKU, explicit per-unit gross dimensions and incomplete values stay held',()=>{
 const raw=fixture();assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'ELIGIBLE');
 assert.equal(raw.skus[0].skuId,'vendor1');
 raw.skus[0].grossWeight=null;assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
 const missing=researchObservation({html:'<p>商品净重446g</p>',product:{canonicalUrl:url,title:'not enough',minOrderQty:1}});
 assert.equal(missing.skus.length,0);assert.equal(checkSourcingEligibility(normalizeProduct(missing)).status,'HOLD');
});

test('server derives eligibility rather than accepting a worker verdict and canonicalizes job URLs',()=>{
 const input={action:'workerComplete',...identity,kind:'refresh',observation:fixture()};
 assert.equal(researchOperation(input).data.result.status,'ELIGIBLE');
 input.observation.skus[0].dimensions.value[2]=null;
 assert.equal(researchOperation(input).data.result.status,'HOLD');
 assert.equal(researchOperation({action:'researchEnqueue',requestId:randomUUID(),kind:'refresh',url:url+'?a=1'}).data.url,url);
 for(const bad of ['https://evil.test/offer/123456.html','https://user@detail.1688.com/offer/123456.html','https://detail.1688.com:999/offer/123456.html'])assert.throws(()=>researchOperation({action:'researchEnqueue',requestId:randomUUID(),kind:'refresh',url:bad}));
 assert.throws(()=>researchOperation({action:'workerComplete',...identity,kind:'search',urls:Array(4).fill(url)}));
});

test('worker is serial, submits exact leased result once and keeps its user token off status',async()=>{
 const calls=[];let claims=0,resolveRead;
 const job={id:identity.jobId,lease_id:identity.leaseId,kind:'refresh',input:{url}};
 const worker=createResearchWorker({call:async(input,token)=>{assert.equal(token,'private-test-token');calls.push(input);if(input.action==='workerClaim')return claims++===0?job:null;return {};},collect:()=>new Promise(resolve=>{resolveRead=resolve;})});
 await worker.connect('private-test-token');const running=worker.tick();await new Promise(resolve=>setImmediate(resolve));
 await worker.tick();assert.equal(claims,1);assert.equal(worker.status().busy,true);assert.ok(!JSON.stringify(worker.status()).includes('token'));
 resolveRead({researchRaw:fixture()});await running;
 assert.equal(calls.filter(c=>c.action==='workerComplete').length,1);await worker.stop();
});

test('captcha has no automatic retry and stop discards an in-flight collection',async()=>{
 const calls=[];let reads=0;
 const job={id:identity.jobId,lease_id:identity.leaseId,kind:'refresh',input:{url}};
 const worker=createResearchWorker({call:async input=>{calls.push(input);return input.action==='workerClaim'?job:{};},collect:async()=>{reads++;throw Object.assign(new Error('captcha'),{code:'BROWSER_VERIFY_REQUIRED'});}});
 await worker.connect('test');await worker.tick();await worker.tick();assert.equal(reads,1);assert.equal(worker.status().enabled,false);assert.equal(calls.find(c=>c.action==='workerFail').code,'BROWSER_VERIFY_REQUIRED');
 let finish;const stopped=createResearchWorker({call:async input=>{calls.push(input);return input.action==='workerClaim'?job:{};},collect:()=>new Promise(r=>{finish=r;})});
 await stopped.connect('test');const task=stopped.tick();await new Promise(r=>setImmediate(r));await stopped.stop();finish({researchRaw:fixture()});await task;
 assert.equal(calls.filter(c=>c.action==='workerComplete').length,0);
});

test('stop during pending claim never begins a browser read',async()=>{
 let resolveClaim,reads=0;
 const worker=createResearchWorker({call:async input=>input.action==='workerClaim'?new Promise(r=>{resolveClaim=r;}):{},collect:async()=>{reads++;return {researchRaw:fixture()};}});
 await worker.connect('test');const task=worker.tick();await new Promise(r=>setImmediate(r));await worker.stop();
 resolveClaim({id:identity.jobId,lease_id:identity.leaseId,kind:'refresh',input:{url}});await task;
 assert.equal(reads,0);assert.equal(worker.status().enabled,false);
});

test('three consecutive read failures stop the worker instead of consuming more jobs',async()=>{
 let claims=0,reads=0;
 const worker=createResearchWorker({call:async input=>input.action==='workerClaim'?{id:randomUUID(),lease_id:randomUUID(),kind:'refresh',input:{url},number:claims++}:{},collect:async()=>{reads++;throw new Error('read failed');}});
 await worker.connect('test');for(let n=0;n<5;n++)await worker.tick();
 assert.equal(claims,3);assert.equal(reads,3);assert.equal(worker.status().enabled,false);
});

test('unrelated structured offer identity never yields a scoped eligible observation',()=>{
 const raw=researchObservation({html:`<script type="application/json">${JSON.stringify({product:{offerId:'999999',minOrderQuantity:1,skuModel:{skuInfoMap:{'黑色':{skuId:'vendor1',price:16.5,canBookCount:13}}}}})}</script>`,product:{canonicalUrl:url,title:'requested'},packingRows:[{skuId:'vendor1',quantity:1,grossWeight:446,weightUnit:'g',dimensions:[18.5,14,4.5],lengthUnit:'cm'}]});
 assert.equal(raw.skus.length,0);assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
});

test('known search-card MOQ conflicts are held, and card provenance is server-owned',()=>{
 const input={action:'workerComplete',...identity,kind:'refresh',observation:fixture()};
 input.observation.cardMoq={value:1};
 const cardMoq={value:2,unit:'piece',sourceUrl:url,observedAt:new Date().toISOString(),kind:'observed',confirmed:true,scope:{quantity:1,level:'offer',skuId:null}};
 assert.equal(researchOperation(input,{cardMoq}).data.result.status,'HOLD');
 assert.equal(researchOperation(input).data.result.status,'ELIGIBLE');
});

test('search completion normalization is deterministic for a response-loss replay',()=>{
 const input={action:'workerComplete',...identity,kind:'search',offers:[{url,cardMoq:2}],observedAt:'2026-10-13T06:00:00Z'};
 const first=researchOperation(input);const second=researchOperation(structuredClone(input));
 assert.deepEqual(first,second);assert.equal(first.data.result.observedAt,input.observedAt);
 assert.throws(()=>researchOperation({...input,observedAt:undefined}));
});

test('live-state roots with conflicting same-offer SKU observations stay unknown',async()=>{
 const model=price=>({offerId:'123456',minOrderQuantity:1,skuModel:{skuInfoMap:{black:{skuId:'vendor1',price,canBookCount:13}}}});
 const evaluate=(fn,arg)=>runInNewContext(`(${fn.toString()})(input)`,{input:arg,window:{__INIT_DATA__:{product:model(16.5)},__GLOBAL_DATA__:{product:model(18)}},document:{querySelectorAll:()=>[],querySelector:()=>null}});
 const state=await readResearchState({evaluate},'123456');
 assert.equal(state.product,null);assert.equal(state.conflict,true);
 const html=`<script type="application/json">${JSON.stringify({product:model(16.5)})}</script>`;
 const product={canonicalUrl:url,title:'fixture'},packingRows=[{skuId:'vendor1',label:'black',quantity:1,grossWeight:446,weightUnit:'g',dimensions:[18.5,14,4.5],lengthUnit:'cm'}];
 assert.equal(checkSourcingEligibility(normalizeProduct(researchObservation({html,product,packingRows}))).status,'ELIGIBLE');
 assert.equal(checkSourcingEligibility(normalizeProduct(researchObservation({html:chooseResearchHtml(html,state),product,packingRows}))).status,'HOLD');
});

test('a committed refresh replays its original normalized verdict after evidence freshness expires',async()=>{
 const observation=fixture();
 for(const key of ['moq'])observation[key].observedAt='2026-01-01T00:00:00Z';
 for(const s of observation.skus)for(const e of Object.values(s))if(e&&typeof e==='object'&&e.observedAt)e.observedAt='2026-01-01T00:00:00Z';
 const normalized=normalizeProduct(observation);
 const committed={kind:'refresh',status:'ELIGIBLE',reasons:[],observation:normalized};
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{input:{url},completion_input:{result:committed}}};}};
 let sent;
 const service=researchJobsService({workspaceId:randomUUID(),actorId:randomUUID(),writer:{from:()=>query,rpc:async(name,args)=>{sent=args.p_input;return {data:{replayed:true}};}}});
 await service({action:'workerComplete',...identity,kind:'refresh',observation});
 assert.equal(sent.result.status,'ELIGIBLE');
 assert.equal(checkSourcingEligibility(normalized).status,'HOLD');
});
test('normalized research size is checked before the bounded database RPC, without dropping SKUs',async()=>{
 const observation=fixture(),first=observation.skus[0];
 observation.skus=Array.from({length:32},(_,i)=>{const s=structuredClone(first);s.skuId=`vendor${i}`;s.label='公开商品选项'.repeat(12);for(const key of ['price','stock','grossWeight','dimensions'])s[key].scope.skuId=s.skuId;return s;});
 assert.ok(Buffer.byteLength(JSON.stringify(observation))<60000);
 const writer={from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:{input:{url},completion_input:null}};}}),rpc:async()=>{throw new Error('RPC should not receive oversized normalized data');}};
 const service=researchJobsService({writer,workspaceId:randomUUID(),actorId:randomUUID()});
 await assert.rejects(()=>service({action:'workerComplete',...identity,kind:'refresh',observation}),e=>e.code==='RESULT_TOO_LARGE'&&e.status===400);
});
test('a definitive server completion rejection becomes a failed job rather than a silently running lease',async()=>{
 let storedStatus='QUEUED',storedCode=null;
 const worker=createResearchWorker({collect:async()=>({researchRaw:fixture()}),call:async input=>{
  if(input.action==='workerClaim'){storedStatus='RUNNING';return {id:identity.jobId,lease_id:identity.leaseId,kind:'refresh',input:{url}};}
  if(input.action==='workerComplete')throw Object.assign(new Error('oversized normalized result'),{code:'RESULT_TOO_LARGE',status:400});
  if(input.action==='workerFail'){storedStatus='FAILED';storedCode=input.code;}
 }});
 await worker.connect('fixture-token');await worker.tick();assert.equal(storedStatus,'FAILED');assert.equal(storedCode,'RESULT_TOO_LARGE');
});
