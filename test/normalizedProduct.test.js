import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct,checkSourcingEligibility } from '../src/domain/normalizedProduct.js';
const url='https://detail.1688.com/offer/123456.html',observedAt='2026-10-13T06:00:00.000Z',now=Date.parse(observedAt);
const evidence=(value,unit,extra={})=>({value,unit,sourceUrl:url,observedAt,kind:'observed',confirmed:true,scope:{skuId:'vendor-sku-1',quantity:1,level:'sku'},...extra});
const raw=()=>({offerId:'123456',title:'포장표 있는 상품',sourceUrl:url,observedAt,moq:evidence(1,'piece'),skus:[{skuId:'vendor-sku-1',label:'검정',price:evidence(16.5,'CNY'),moq:evidence(1,'piece'),stock:evidence(13,'piece'),grossWeight:evidence(0.446,'kg',{semantic:'packed_gross'}),dimensions:evidence([185,140,45],'mm',{semantic:'packed_dimensions'})}]});
test('same-SKU unit packaging, MOQ1, price and available stock produce an eligible observation',()=>{
 const observation=normalizeProduct(raw());
 assert.equal(checkSourcingEligibility(observation,{now}).status,'ELIGIBLE');
 assert.equal(observation.skuObservations[0].package.grossWeightG,446);
 assert.deepEqual(observation.skuObservations[0].package.dimensionsCm,[18.5,14,4.5]);
 assert.equal(observation.skuObservations[0].evidence.grossWeight.originalUnit,'kg');
});
test('net/carton/other-SKU/estimated/missing/stale evidence and conflicting MOQ never pass',()=>{
 for(const edit of [
  r=>r.skus[0].grossWeight.semantic='net',r=>r.skus[0].grossWeight.scope.quantity=12,
  r=>r.skus[0].dimensions.scope.skuId='other',r=>r.skus[0].grossWeight.kind='estimated',
  r=>r.skus[0].grossWeight.confirmed=false,r=>r.skus[0].dimensions.value[2]=null,
  r=>r.skus[0].skuId=null,r=>r.moq.value=2,r=>r.skus[0].stock.value=0,
  r=>r.skus[0].price.value='',r=>r.skus[0].grossWeight.sourceUrl='https://detail.1688.com/offer/999.html',
  r=>r.skus[0].grossWeight.observedAt='2026-09-01T00:00:00Z',
 ]){const r=raw();edit(r);const result=checkSourcingEligibility(normalizeProduct(r),{now});assert.equal(result.status,'HOLD');assert.ok(result.reasons.length);}
});
test('one incomplete option or duplicate SKU rejects the whole offer instead of dropping that option',()=>{
 const r=raw();r.skus.push({...r.skus[0],skuId:'vendor-sku-2',label:'흰색'});
 assert.equal(checkSourcingEligibility(normalizeProduct(r),{now}).status,'HOLD');
 const duplicated=raw();duplicated.skus.push(structuredClone(duplicated.skus[0]));
 assert.equal(checkSourcingEligibility(normalizeProduct(duplicated),{now}).status,'HOLD');
});
test('P2013-style packaging weight without gross distinction stays unknown and held',()=>{
 const r=raw();r.skus[0].grossWeight.semantic='unspecified';
 const o=normalizeProduct(r);assert.equal(o.skuObservations[0].package.grossWeightG,null);
 assert.equal(checkSourcingEligibility(o,{now}).status,'HOLD');
});
