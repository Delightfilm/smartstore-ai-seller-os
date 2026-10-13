import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkflowStore } from '../server/workflowStore.js';
import { executeAgencyAction, checkAgencyRequest } from '../server/agencyWorkflow.js';

test('local workflow enforces origin, JSON and body bounds',()=>{
  const headers={host:'127.0.0.1:5173',origin:'http://127.0.0.1:5173','content-type':'application/json'};
  assert.doesNotThrow(()=>checkAgencyRequest(headers,'{}'));
  for(const h of [{...headers,origin:'https://evil.test'},{...headers,host:'evil.test'},{...headers,'content-type':'text/plain'},{...headers,origin:undefined}]) assert.throws(()=>checkAgencyRequest(h,'{}'));
  assert.throws(()=>checkAgencyRequest(headers,'x'.repeat(65537)));
});

test('workflow collects, compares, persists and exports preparation only',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agency-test-'));
  try{
    const store=new WorkflowStore(dir);
    const providers={collect:async()=>({offerId:'123',title:'수집 상품'}),market:async()=>({observedAt:new Date().toISOString(),competitors:[{id:'a',title:'경쟁 상품',priceKrw:10000,shippingKrw:null,url:'https://smartstore.naver.com/a/products/1'}]}),search:async()=>({offers:[]})};
    const run=input=>executeAgencyAction(input,{store,providers});
    const c=await run({action:'collect',url:'https://detail.1688.com/offer/123.html'});
    const m=await run({action:'market',id:c.id,revision:c.revision,query:'케이블'});
    await assert.rejects(()=>run({action:'update',id:c.id,revision:c.revision,terms:{}}),/변경/);
    const u=await run({action:'update',id:c.id,revision:m.revision,terms:{salePriceKrw:10000},listing:{name:'<script>안전</script>'},comparisons:[{id:'a',comparable:true,shippingKrw:3000}]});
    assert.equal(u.market.competitors[0].priceKrw,10000);
    assert.equal(u.market.competitors[0].shippingKrw,3000);
    const packet=await run({action:'export',id:c.id});
    assert.equal(packet.status,'PREPARATION_ONLY');
    assert.equal(packet.analysis.status,'REVIEW_REQUIRED');
    assert.ok(!packet.detail.html.includes('<script>'));
    assert.equal(new WorkflowStore(dir).get(c.id).publication.status,'NOT_PUBLISHED');
    await assert.rejects(()=>run({action:'publish',id:c.id}),/지원/);
    await assert.rejects(()=>run({action:'update',id:c.id,revision:u.revision,product:{minOrderQty:1}}),/필드/);
    await run({action:'update',id:c.id,revision:u.revision,terms:{costsConfirmed:true,supplierQuoteConfirmed:true}});
    providers.collect=async()=>({offerId:'123',title:'갱신된 상품'});
    const refreshed=await run({action:'collect',url:'https://detail.1688.com/offer/123.html'});
    assert.equal(refreshed.product.title,'갱신된 상품');
    assert.equal(refreshed.terms.supplierQuoteConfirmed,false);
    assert.equal(refreshed.terms.costsConfirmed,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('changed evidence cannot reuse approvals or confirm in the same write',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agency-approval-test-'));
  try{
    const store=new WorkflowStore(dir);
    let c=store.create({offerId:'123',title:'상품'});
    c=store.update(c.id,c.revision,{terms:{selectedVariant:'A',internationalShippingKrw:4000,supplierQuoteConfirmed:true,costsConfirmed:true}});
    c=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,terms:{...c.terms,selectedVariant:'B',internationalShippingKrw:0}},{store});
    assert.equal(c.terms.supplierQuoteConfirmed,false);
    assert.equal(c.terms.costsConfirmed,false);
    c=await executeAgencyAction({action:'update',id:c.id,revision:c.revision,terms:{...c.terms,supplierQuoteConfirmed:true,costsConfirmed:true}},{store});
    assert.equal(c.terms.costsConfirmed,true);
  }finally{await rm(dir,{recursive:true,force:true});}
});
