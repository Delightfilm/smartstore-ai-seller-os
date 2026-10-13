import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../src/domain/normalizedProduct.js';
import { researchOperation } from '../server/cloud/researchJobs.js';
import { savedCandidateViews } from '../src/dashboard/discoveryView.js';
import { createDiscoveryController } from '../src/dashboard/discoveryController.js';
import { discoveryEstimate } from '../src/domain/discoveryEstimate.js';
const url='https://detail.1688.com/offer/675246155709.html';
const raw=()=>{
 const observedAt=new Date().toISOString();
 const e=(value,unit)=>({value,unit,sourceUrl:url,observedAt,kind:'observed',confirmed:true,scope:{skuId:'4855892641767',quantity:1,level:'sku'}});
 return {offerId:'675246155709',sourceUrl:url,title:'fixture',observedAt,skuSetComplete:true,skus:[{skuId:'4855892641767',label:'long',price:e(3.5,'CNY'),moq:e(1,'piece'),stock:e(1810,'piece')}]};
};
const profile={salePriceKrw:9900,fxKrwPerCny:211,chinaShippingCny:5,shippingLowKrw:3000,shippingBaseKrw:5000,shippingHighKrw:8000,otherCostKrw:500,feePercent:6,returnPercent:3,minProfitKrw:1000,minMarginPercent:10,basis:'Operator scenario, not a verified quote or comparable.'};
const identity={workerId:'00000000-0000-4000-8000-000000000001',jobId:'00000000-0000-4000-8000-000000000002',leaseId:'00000000-0000-4000-8000-000000000003'};
test('main button captures its explicit estimate profile in the actual enqueue request',async()=>{
 const calls=[];const controller=createDiscoveryController({localAvailable:false,onState:()=>{},onCandidates:()=>{},client:{request:async input=>{calls.push(input);return input.action==='list'?[]:{jobs:[]};}}});
 await controller.start('box',profile);
 assert.deepEqual(calls.find(c=>c.action==='researchEnqueue').estimateProfile,profile);
});
test('server saves a promising MOQ1 observation as provisional without fabricating packaging',()=>{
 const result=researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:raw()},{estimateProfile:profile}).data.result;
 assert.equal(result.status,'PROVISIONAL');
 assert.equal(result.estimate.status,'PROFITABILITY_PENDING');
 assert.equal(result.estimate.options[0].scenarios[1].profitKrw,1715);
 assert.equal(result.estimate.options[0].scenarios[2].profitKrw,-1285);
 assert.equal(result.estimate.confidence,'LOW');
 assert.equal(result.observation.skuObservations[0].package.grossWeightG,null);
 assert.match(result.estimate.profile.basis,/not a verified/);
});
test('provisional gate still rejects MOQ conflicts, incomplete SKUs, unknown prices and stale trade evidence',()=>{
 for(const change of [r=>r.skus[0].moq.value=2,r=>r.skuSetComplete=false,r=>r.skus[0].price=null,r=>r.skus[0].stock.observedAt='2020-01-01']){
  const r=raw();change(r);assert.equal(researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:r},{estimateProfile:profile}).data.result.status,'HOLD');
 }
 const r=raw();r.skus[0].price.value=100;
 assert.equal(researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:r},{estimateProfile:profile}).data.result.status,'HOLD');
});
test('estimate enqueue validates ranges and preserves the captured assumptions',()=>{
 const result=researchOperation({action:'researchEnqueue',requestId:identity.jobId,kind:'search',query:'box',estimateProfile:profile});
 assert.deepEqual(result.data.estimateProfile,profile);
 for(const p of [{...profile,shippingHighKrw:1},{...profile,feePercent:100},{...profile,fxKrwPerCny:''},{...profile,basis:''},{...profile,salePriceKrw:Infinity}])assert.throws(()=>researchOperation({action:'researchEnqueue',requestId:identity.jobId,kind:'search',query:'box',estimateProfile:p}));
});
test('stored estimates render independently from unconfirmed terms and stay pending after a review save',()=>{
 const result=researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:raw()},{estimateProfile:profile}).data.result;
 const c={id:'675246155709',revision:1,product:{title:'actual source',discoveryEstimate:result.estimate,variants:[],minOrderQty:1},terms:{},review:{status:'HOLD',reasons:[]}};
 const view=savedCandidateViews([c])[0];
 assert.equal(view.estimate.options[0].scenarios[1].profitKrw,1715);
 assert.equal(view.profitKrw,null);
 assert.ok(view.reasons.some(r=>r.includes('수익성 확정 보류')));
 c.review.status='REVIEW_REQUIRED';assert.ok(savedCandidateViews([c])[0].reasons.some(r=>r.includes('수익성 확정 보류')));
});
test('decimal economics do not lose one won through binary floating-point floor',()=>{
 const r=raw();r.skus[0].price.value=1;
 const e=discoveryEstimate(normalizeProduct(r),{...profile,salePriceKrw:8000,feePercent:4,returnPercent:3,shippingLowKrw:1000,shippingBaseKrw:3000,shippingHighKrw:5000});
 assert.equal(e.options[0].scenarios[1].profitKrw,2674);
});
test('a newer rejected source refresh makes previous promising estimates visibly historical',()=>{
 const result=researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:raw()},{estimateProfile:profile}).data.result;
 const c={id:'675246155709',revision:2,product:{discoveryEstimate:result.estimate,latestSourcingCheck:{status:'HOLD',observedAt:new Date(Date.now()+1000).toISOString()}},terms:{},review:{status:'HOLD',reasons:[]}};
 assert.equal(savedCandidateViews([c])[0].estimate.stale,true);
});
test('unconfirmed or wrong-SKU packaging never becomes a factual provisional package value',()=>{
 for(const change of [e=>e.confirmed=false,e=>e.scope.skuId='other',e=>e.observedAt='2020-01-01']){
  const r=raw();const e={...r.skus[0].price,unit:'g',value:999,semantic:'packed_gross',scope:{...r.skus[0].price.scope}};change(e);r.skus[0].grossWeight=e;
  const result=researchOperation({action:'workerComplete',...identity,kind:'refresh',observation:r},{estimateProfile:profile}).data.result;
  assert.equal(result.observation.skuObservations[0].package.grossWeightG,null);
  assert.equal(result.estimate.options[0].package.grossWeightG,null);
 }
});
test('real source evidence table renders missing packaging and provenance without crashing',async()=>{
 const {default:SourceEvidenceTable}=await import('../src/dashboard/SourceEvidenceTable.js');
 const {default:React}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const html=renderToStaticMarkup(React.createElement(SourceEvidenceTable,{observation:normalizeProduct(raw())}));
 assert.match(html,/미확인/);assert.match(html,/675246155709/);assert.ok(!html.includes('nullg'));
});
