import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkflowStore } from '../server/workflowStore.js';
import { executeAgencyAction } from '../server/agencyWorkflow.js';
import { seedP2013Research } from '../server/p2013Research.js';
import { researchMargins, reviewCandidate } from '../src/researchReview.js';

async function fixture(fn) {
  const dir=await mkdtemp(join(tmpdir(),'research-review-'));
  try { await fn(new WorkflowStore(dir),dir); }
  finally { await rm(dir,{recursive:true,force:true}); }
}

test('research seed persists HOLD with evidence, preserves other candidates and never overwrites edits',()=>fixture(async(store,dir)=>{
  store.create({offerId:'123',title:'기존 후보'});
  const c=seedP2013Research(store);
  assert.equal(c.id,'816692570613');
  assert.equal(c.review.status,'HOLD');
  assert.ok(c.review.reasons.length>0);
  assert.equal(c.product.minOrderQty,1);
  assert.equal(c.research.package.weightG,446);
  assert.deepEqual(c.research.package.dimensionsCm,[18.5,14,4.5]);
  assert.equal(c.research.package.measured,false);
  assert.ok(c.research.sources.every(s=>s.url.startsWith('https://')));
  assert.equal(c.market.competitors.filter(x=>x.comparable).length,0);
  const edited=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,review:{status:'HOLD',reasons:['사용자 보류 사유'],note:'검토 메모'}},{store});
  const reloaded=new WorkflowStore(dir);
  seedP2013Research(reloaded);
  assert.equal(reloaded.list().length,2);
  assert.equal(reloaded.get(c.id).revision,edited.revision);
  assert.equal(reloaded.get(c.id).review.note,'검토 메모');
  assert.equal(reloaded.get(c.id).publication.status,'NOT_PUBLISHED');
}));

test('scenario calculations reproduce recorded contribution, separate assumptions, and reject missing or invalid input',()=>fixture(async store=>{
  const c=seedP2013Research(store);
  const rows=researchMargins(c.research);
  assert.deepEqual(rows.map(r=>r.profitKrw),[3237,1317,-1517]);
  assert.deepEqual(rows.map(r=>r.minSalePriceKrw),[14640,17242,22272]);
  assert.deepEqual(researchMargins({...c.research,salePriceKrw:17900}).map(r=>r.profitKrw),[5967,4047,913]);
  for(const value of ['',null,-1,0,'NaN',Infinity]) {
    assert.ok(researchMargins({...c.research,salePriceKrw:value}).every(r=>r.profitKrw===null));
  }
  assert.ok(researchMargins({...c.research,platformFeePercent:100}).every(r=>r.profitKrw===null));
  assert.ok(researchMargins({...c.research,fxKrwPerCny:null}).every(r=>r.profitKrw===null));
}));

test('seed fills missing research on an existing P2013 without overwriting user product, costs or draft',()=>fixture(async store=>{
  const original=store.create({offerId:'816692570613',title:'사용자 수집 상품'}, {terms:{purchasePriceCny:18}});
  const edited=store.update(original.id,original.revision,{listing:{name:'사용자 초안'}});
  const seeded=seedP2013Research(store);
  assert.equal(seeded.research.package.weightG,446);
  assert.equal(seeded.review.status,'HOLD');
  assert.deepEqual(seeded.product,edited.product);
  assert.deepEqual(seeded.terms,edited.terms);
  assert.deepEqual(seeded.listing,edited.listing);
  assert.equal(seeded.publication.status,'NOT_PUBLISHED');
  assert.equal(seedP2013Research(store).revision,seeded.revision);
}));

test('saved price change recalculates, invalidates review and approvals, and stale writes cannot overwrite it',()=>fixture(async(store,dir)=>{
  let c=seedP2013Research(store);
  const original=c;
  c=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,research:{salePriceKrw:17900},review:{status:'HOLD',reasons:['동시 재승인 금지'],note:'메모'}},{store});
  assert.equal(c.review.status,'REVIEW_REQUIRED');
  assert.equal(c.review.stale,true);
  assert.equal(c.terms.costsConfirmed,false);
  assert.equal(researchMargins(new WorkflowStore(dir).get(c.id).research)[1].profitKrw,4047);
  await assert.rejects(()=>executeAgencyAction({action:'update',id:c.id,revision:original.revision,research:{salePriceKrw:1}},{store}),/변경/);
  c=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,terms:{...c.terms,costsConfirmed:true}},{store});
  assert.equal(c.review.stale,true);
  assert.equal(c.review.reviewedAt,null);
  c=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,review:{status:'HOLD',reasons:['차별성 부족'],note:'재검토함'}},{store});
  assert.equal(c.review.stale,false);
  assert.equal(reviewCandidate(c).status,'HOLD');
  assert.ok(reviewCandidate(c).blockers.includes('차별성 부족'));
  const packet=await executeAgencyAction({action:'export',id:c.id},{store});
  assert.equal(packet.analysis.status,'HOLD');
  assert.equal(packet.status,'PREPARATION_ONLY');
  assert.equal(packet.researchMargins[1].profitKrw,4047);
}));

test('review API rejects forged pass, empty hold reasons, fabricated scenarios and external actions',()=>fixture(async store=>{
  const c=seedP2013Research(store);
  for(const patch of [
    {review:{status:'READY',reasons:[],note:''}},
    {review:{status:'HOLD',reasons:[],note:''}},
    {review:{status:'HOLD',reasons:['사유'],note:'',stale:false}},
    {research:{salePriceKrw:''}},
    {research:{salePriceKrw:14900,scenarios:[]}},
  ]) await assert.rejects(()=>executeAgencyAction({action:'update',id:c.id,revision:c.revision,...patch},{store}));
  for(const action of ['publish','ship','pay']) await assert.rejects(()=>executeAgencyAction({action,id:c.id},{store}),/지원/);
  assert.equal(store.get(c.id).revision,c.revision);
  assert.equal(store.get(c.id).publication.status,'NOT_PUBLISHED');
}));

test('recollection invalidates research assessment without erasing its dated evidence',()=>fixture(async store=>{
  const c=seedP2013Research(store);
  const refreshed=await executeAgencyAction({action:'collect',url:c.product.canonicalUrl},{store,providers:{collect:async()=>({...c.product,title:'갱신 상품'})}});
  assert.equal(refreshed.review.status,'REVIEW_REQUIRED');
  assert.equal(refreshed.review.stale,true);
  assert.equal(refreshed.research.observedAt,c.research.observedAt);
}));
