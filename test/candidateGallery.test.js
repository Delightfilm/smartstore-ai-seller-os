import test from 'node:test';
import assert from 'node:assert/strict';
import { savedCandidateViews } from '../src/dashboard/discoveryView.js';

const record = overrides => ({id:'123456',revision:2,product:{title:'원본 상품',minOrderQty:1,images:['https://cbu01.alicdn.com/example.jpg'],variants:[]},listing:{name:'운영자 상품명'},terms:{},market:{},review:{status:'HOLD',reasons:['수요 확인 필요']},...overrides});

test('gallery uses saved names and source imagery without fabricating missing economics',()=>{
 const [view]=savedCandidateViews([record()]);
 assert.equal(view.title,'운영자 상품명');
 assert.equal(view.sourceTitle,'원본 상품');
 assert.equal(view.imageUrl,'https://cbu01.alicdn.com/example.jpg');
 assert.equal(view.salePriceKrw,null);
 assert.deepEqual(view.profitRange,null);
 assert.equal(view.status,'HOLD');
 assert.ok(view.reasons.includes('수요 확인 필요'));
});

test('gallery rejects unsafe image locations and preserves missing MOQ',()=>{
 const [view]=savedCandidateViews([record({listing:{},product:{title:'사진 없음',images:['javascript:alert(1)','http://127.0.0.1/private'],variants:[]}})]);
 assert.equal(view.imageUrl,null);
 assert.equal(view.moq,null);
 assert.equal(view.title,'사진 없음');
});

test('gallery preserves negative and stale provisional option ranges, not a fabricated confirmed margin',()=>{
 const estimate={observedAt:'2026-10-13',profile:{salePriceKrw:13900},options:[{scenarios:[{level:'Base',profitKrw:-200}]},{scenarios:[{level:'Base',profitKrw:1300}]}]};
 const [view]=savedCandidateViews([record({product:{title:'추정 후보',variants:[],discoveryEstimate:estimate,latestSourcingCheck:{status:'HOLD',observedAt:'2026-10-14'}}})]);
 assert.equal(view.salePriceKrw,13900);
 assert.deepEqual(view.profitRange,[-200,1300]);
 assert.equal(view.economicsLabel,'이전 추정치 · 만료');
 assert.equal(view.profitKrw,null);
 assert.equal(view.estimate.stale,true);
});
