import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize1688Dom } from '../server/browser1688.js';
import { normalizeProduct,checkSourcingEligibility } from '../src/domain/normalizedProduct.js';
import { researchObservation,readResearchState,chooseResearchHtml } from '../server/research1688.js';
import { runInNewContext } from 'node:vm';
const sourceUrl='https://detail.1688.com/offer/123456.html',observedAt=new Date().toISOString();
test('displayed purchase threshold is read from scoped trade text, not unrelated price or sales numbers',()=>{
 assert.equal(normalize1688Dom({tradeText:'新人价¥4.23起\n3件预估到手单价¥4.90\n¥15.80\n3个起批\n已售100+个'}).minOrderQty,3);
 assert.equal(normalize1688Dom({tradeText:'¥16.50 1件起批 已售1000件'}).minOrderQty,1);
 assert.equal(normalize1688Dom({tradeText:'1件起批 3个起批'}).minOrderQty,null);
 assert.equal(normalize1688Dom({tradeText:'¥15.803个起批'}).minOrderQty,null);
 assert.equal(normalize1688Dom({tradeText:'¥15.80\n최소 3개부터 구매 가능\n이미 판매됨100+개'}).minOrderQty,3);
 assert.equal(normalize1688Dom({scale:'起批1件',tradeText:'3件起批'}).minOrderQty,null);
 assert.equal(normalize1688Dom({tradeText:'¥6.90\n1개부터 도매 가능\n이미 판매됨40+개'}).minOrderQty,1);
});
test('structured MOQ cannot override a conflicting displayed purchase threshold',()=>{
 const html=`<script type="application/json">${JSON.stringify({product:{offerId:'123456',minOrderQuantity:1,skuModel:{skuInfoMap:{single:{skuId:'vendor1',price:12,canBookCount:10,minOrderQuantity:1}}}}})}</script>`;
 const raw=researchObservation({html,product:{canonicalUrl:sourceUrl,title:'fixture',minOrderQty:3},observedAt,packingRows:[{skuId:'vendor1',quantity:1,grossWeight:200,weightUnit:'g',dimensions:[10,10,3],lengthUnit:'cm'}]});
 assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
});
test('a displayed MOQ conflict survives the collector provenance merge',()=>{
 const dom=normalize1688Dom({scale:'起批1件',tradeText:'3件起批'});
 const product={canonicalUrl:sourceUrl,title:'fixture',minOrderQty:1,minOrderQtyConflict:dom.minOrderQtyConflict};
 for(const key of Object.keys(dom.provenance))product[key]=dom[key];
 const html=`<script type="application/json">${JSON.stringify({product:{offerId:'123456',minOrderQuantity:1,skuModel:{skuInfoMap:{single:{skuId:'vendor1',price:12,canBookCount:10}}}}})}</script>`;
 const raw=researchObservation({html,product,observedAt,packingRows:[{skuId:'vendor1',quantity:1,grossWeight:200,weightUnit:'g',dimensions:[10,10,3],lengthUnit:'cm'}]});
 assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
});
test('complete-looking selected rows cannot pass when the full vendor SKU set is unconfirmed',()=>{
 const evidence=(value,unit,semantic=null)=>({value,unit,semantic,sourceUrl,observedAt,kind:'observed',confirmed:true,scope:{skuId:'vendor1',quantity:1,level:'sku'}});
 const raw={offerId:'123456',title:'fixture',sourceUrl,observedAt,skuSetComplete:false,skus:[{skuId:'vendor1',label:'selected color only',price:evidence(12,'CNY'),moq:evidence(1,'piece'),stock:evidence(10,'piece'),grossWeight:evidence(200,'g','packed_gross'),dimensions:evidence([10,10,3],'cm','packed_dimensions')}]};
 assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
});
test('live source coverage checks all declared axes rather than only selected rows',async()=>{
 const read=async sizes=>{
  const list=Array.from({length:sizes.at(-1)},(_,i)=>({skuId:String(i+1),specAttrs:`option ${i}`,price:12,canBookCount:10}));
  const options=list.map(()=>({getAttributeNames:()=>[],__reactFiber$fixture:{memoizedProps:{dataList:list}}}));
  const axes=sizes.map(n=>({querySelectorAll:s=>s==='.sku-filter-button'?Array(n).fill({}):[]}));
  const document={querySelector:()=>null,querySelectorAll:s=>s.endsWith('.expand-view-item')?options:s.endsWith('.feature-item')?axes:[]};
  const page={evaluate:async(fn,arg)=>runInNewContext(`(${fn.toString()})(offerId)`,{document,window:{},offerId:arg})};
  return readResearchState(page,'123456');
 };
 assert.equal((await read([2,3])).skuSetComplete,false);
 assert.equal((await read([1,1])).skuSetComplete,true);
 assert.equal((await read([3])).skuSetComplete,true);
});
test('sanitizing source state preserves supported MOQ aliases and their conflicts',async()=>{
 const product={offerId:'123456',moq:3,skuModel:{skuInfoMap:{single:{skuId:'vendor1',price:12,canBookCount:10,minOrderQuantity:1}}}};
 const document={querySelector:()=>null,querySelectorAll:()=>[]};
 const page={evaluate:async(fn,arg)=>runInNewContext(`(${fn.toString()})(offerId)`,{document,window:{__INIT_DATA__:{product}},offerId:arg})};
 const state=await readResearchState(page,'123456');
 const raw=researchObservation({html:chooseResearchHtml('',state),product:{canonicalUrl:sourceUrl,title:'fixture',minOrderQty:1},observedAt,packingRows:[{skuId:'vendor1',quantity:1,grossWeight:200,weightUnit:'g',dimensions:[10,10,3],lengthUnit:'cm'}]});
 assert.equal(checkSourcingEligibility(normalizeProduct(raw)).status,'HOLD');
});
