import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidate, renderDetail, normalizeMarket } from '../src/purchaseAgency.js';

const product = { offerId: '123456', title: '수납함', minOrderQty: 1, supplier: { name: '공급사' }, images: ['https://cbu01.alicdn.com/img/test.jpg'], variants: [{ id: 1, name: '흰색', priceCny: 10 }] };
const observedAt = new Date().toISOString();
const market = { observedAt, competitors: [1, 2, 3].map(id => ({ id: String(id), title: '수납함', priceKrw: 22000, shippingKrw: 3000, reviewCount: 15, url: 'https://smartstore.naver.com/test/products/' + id, comparable: true, source: 'NAVER_BROWSER' })) };
const terms = { purchasePriceCny: 10, fxKrwPerCny: 200, chinaShippingCny: 2, internationalShippingKrw: 4000, domesticShippingKrw: 3000, otherCostKrw: 0, returnReserveKrw: 1000, feePercent: 6, salePriceKrw: 20000, buyerShippingKrw: 3000, minMarginPercent: 20, selectedVariant: '흰색', supplierQuoteConfirmed: true, costsConfirmed: true, saleEligibilityConfirmed: true, imageRightsConfirmed: true, comparisonConfirmed: true, demandConfirmed: true, demandEvidence: '동일 용도 비교상품 3개에서 구매후기 확인', evidenceUrl: 'https://smartstore.naver.com/test/products/1' };

test('purchase agency calculates contribution using order revenue and explicit costs', () => {
  const r = evaluateCandidate(product, market, terms);
  assert.equal(r.costKrw, 10400);
  assert.equal(r.revenueKrw, 23000);
  assert.equal(r.feeKrw, 1380);
  assert.equal(r.profitKrw, 11220);
  assert.equal(r.status, 'READY');
});

test('missing or coercible costs never produce a profitable READY candidate', () => {
  for (const value of [null, '', ' ', true, [], {}, Infinity, -1]) {
    const r = evaluateCandidate(product, market, { ...terms, internationalShippingKrw: value });
    assert.notEqual(r.status, 'READY');
    assert.equal(r.profitKrw, null);
  }
});

test('wholesale MOQ, unselected SKU and stale evidence block agency listing', () => {
  assert.notEqual(evaluateCandidate({ ...product, minOrderQty: 100 }, market, terms).status, 'READY');
  assert.notEqual(evaluateCandidate(product, market, { ...terms, selectedVariant: 'unknown' }).status, 'READY');
  assert.notEqual(evaluateCandidate(product, { ...market, observedAt: '2020-01-01' }, terms).status, 'READY');
  assert.notEqual(evaluateCandidate(product, market, { ...terms, purchasePriceCny: 0.01 }).status, 'READY');
});

test('supply count alone and missing delivery/reviews are not demand evidence', () => {
  const m = normalizeMarket({ total: 100000, items: [{ title: '<b>수납함</b>', lprice: '19900', link: 'https://smartstore.naver.com/x/products/1', productId: '1' }] });
  assert.equal(m.competitors[0].shippingKrw, null);
  assert.equal(m.competitors[0].reviewCount, null);
  assert.equal(m.competitors[0].title, '수납함');
  assert.notEqual(evaluateCandidate(product, m, { ...terms, demandConfirmed: false }).status, 'READY');
});

test('detail HTML escapes product copy and marks unresolved delivery as draft', () => {
  const r = renderDetail(product, { name: '수납함 <script>alert(1)</script>', description: '확인된 설명', specs: '재질: 확인 필요', selectedVariant: '흰색' });
  assert.ok(!r.html.includes('<script>'));
  assert.ok(r.html.includes('&lt;script&gt;'));
  assert.ok(r.html.includes('해외구매대행'));
  assert.ok(r.missing.includes('deliveryText'));
  assert.ok(r.missing.includes('returnText'));
});
