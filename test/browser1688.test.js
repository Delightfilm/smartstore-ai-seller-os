import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize1688Dom } from '../server/browser1688.js';

test('observed DOM scopes SKU prices and MOQ instead of recommendations', () => {
  const r = normalize1688Dom({ title: '상품', supplier: '공급사', price: '¥0.14起', scale: '按箱起订，每箱100套', images: ['https://cbu01.alicdn.com/img/a.jpg'], variants: [{ name: '칫솔', price: '¥0.28' }, { name: '샤워캡', price: '¥0.14' }], recommendationPrice: '¥0.01' });
  assert.equal(r.priceMinCny, 0.14);
  assert.equal(r.priceMaxCny, 0.28);
  assert.equal(r.minOrderQty, 100);
  assert.equal(r.variants[0].priceCny, 0.28);
  assert.match(r.provenance.variants, /sku-selection/);
});

test('unrecognized scale and empty price stay null', () => {
  const r = normalize1688Dom({ scale: '재고 100000', price: '로그인', variants: [] });
  assert.equal(r.minOrderQty, null);
  assert.equal(r.priceMinCny, null);
  assert.equal(r.title, null);
});

test('cartons do not prove single-unit supply and complete currency tokens are required',()=>{
  for(const scale of ['1箱起订','1包起订','1박스 최소 주문']) assert.equal(normalize1688Dom({scale}).minOrderQty,null);
  for(const scale of ['1件起订','1个起批','최소 주문 1개']) assert.equal(normalize1688Dom({scale}).minOrderQty,1);
});

test('complete currency tokens parse thousands and reject ambiguous suffixes',()=>{
  assert.equal(normalize1688Dom({variants:[{name:'A',price:'¥1,200.00'}]}).variants[0].priceCny,1200);
  for(const price of ['¥1,20','¥10-20','¥10 ~ ¥20','¥1.2.3','¥10foo']) assert.equal(normalize1688Dom({variants:[{name:'A',price}]}).variants[0].priceCny,null);
});
