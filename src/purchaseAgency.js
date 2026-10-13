export function numberOrNull(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const confirmationKeys=['supplierQuoteConfirmed','costsConfirmed','saleEligibilityConfirmed','imageRightsConfirmed','comparisonConfirmed','demandConfirmed'];
export const clearConfirmations=terms=>({...terms,...Object.fromEntries(confirmationKeys.map(k=>[k,false]))});
export function evidenceChanged(before,after){
  const signature=c=>JSON.stringify({
    terms:Object.entries(c.terms || {}).filter(([k])=>!confirmationKeys.includes(k)).sort(([a],[b])=>a.localeCompare(b)),
    listing:Object.entries(c.listing || {}).sort(([a],[b])=>a.localeCompare(b)),
    comparisons:(c.market?.competitors || []).map(r=>[r.id,r.comparable===true,numberOrNull(r.shippingKrw)]),
    research:c.research || null,
  });
  return signature(before)!==signature(after);
}

export function publicUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function normalizeMarket(data) {
  const seen = new Set();
  const competitors = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    const url = publicUrl(item.link);
    const priceKrw = numberOrNull(item.lprice);
    const id = String(item.productId || url || '');
    if (!url || !priceKrw || seen.has(id)) continue;
    seen.add(id);
    competitors.push({ id, title: String(item.title || '').replace(/<[^>]*>/g, '').slice(0,200), priceKrw, shippingKrw: null, reviewCount: null, url, mall: String(item.mallName || ''), comparable: false, source: 'NAVER_SEARCH_API' });
  }
  return { source: 'NAVER_SEARCH_API', observedAt: new Date().toISOString(), total: numberOrNull(data.total), competitors: competitors.slice(0,40), limitations: ['검색 API는 배송비·리뷰·판매량을 제공하지 않습니다.', '검색 결과 수는 수요가 아닙니다.'] };
}

export function evaluateCandidate(product = {}, market = {}, terms = {}) {
  const blockers = [];
  const fields = ['purchasePriceCny','fxKrwPerCny','chinaShippingCny','internationalShippingKrw','domesticShippingKrw','otherCostKrw','returnReserveKrw','feePercent','salePriceKrw','buyerShippingKrw','minMarginPercent'];
  const values = Object.fromEntries(fields.map(k => [k, numberOrNull(terms[k])]));
  for (const k of fields) if (values[k] == null) blockers.push(`비용/정책 미확인: ${k}`);
  for (const k of ['purchasePriceCny','fxKrwPerCny','salePriceKrw']) if (values[k] === 0) blockers.push(`0보다 커야 합니다: ${k}`);
  if (values.feePercent >= 100 || values.minMarginPercent >= 100) blockers.push('수수료·최소마진은 100% 미만이어야 합니다.');
  const numbersValid = blockers.length === 0;
  const costKrw = numbersValid ? Math.ceil((values.purchasePriceCny + values.chinaShippingCny) * values.fxKrwPerCny + values.internationalShippingKrw + values.domesticShippingKrw + values.otherCostKrw + values.returnReserveKrw) : null;
  const revenueKrw = numbersValid ? values.salePriceKrw + values.buyerShippingKrw : null;
  const feeKrw = numbersValid ? Math.ceil(revenueKrw * values.feePercent / 100) : null;
  const profitKrw = numbersValid ? revenueKrw - costKrw - feeKrw : null;
  const marginPercent = numbersValid ? profitKrw / revenueKrw * 100 : null;
  if (marginPercent != null && marginPercent < values.minMarginPercent) blockers.push('최소 마진 미달');
  if (!product.title || !product.supplier?.name || !product.images?.length) blockers.push('상품명·공급사·상품 이미지 수집 필요');
  if (numberOrNull(product.minOrderQty) !== 1) blockers.push('단건 공급 가능 여부 미확인 (MOQ 1 필요)');
  const selected = product.variants?.find(v => v.name === terms.selectedVariant);
  if (product.variants?.length && !selected) blockers.push('수집된 옵션에서 판매 옵션 선택 필요');
  if (selected?.priceCny != null && values.purchasePriceCny < selected.priceCny) blockers.push('선택 옵션의 공급가보다 입력 원가가 낮습니다.');
  const confirmations = {
    supplierQuoteConfirmed:'단건 옵션 견적 확인', costsConfirmed:'배송·비용 견적 확인', saleEligibilityConfirmed:'판매 가능 여부 확인', imageRightsConfirmed:'이미지 사용권 확인', comparisonConfirmed:'동일 구성 경쟁상품 확인', demandConfirmed:'실제 수요 근거 검토',
  };
  for (const [key,label] of Object.entries(confirmations)) if (terms[key] !== true) blockers.push(label);
  const age = Date.now() - Date.parse(market.observedAt || '');
  if (!Number.isFinite(age) || age < -60_000 || age > 7 * 86400000) blockers.push('최근 7일 이내 경쟁 조사 필요');
  const comparable = (market.competitors || []).filter(c => c.comparable === true && publicUrl(c.url) && numberOrNull(c.priceKrw) > 0 && numberOrNull(c.shippingKrw) != null);
  if (comparable.length < 3) blockers.push('배송비와 구성이 확인된 경쟁상품 3개 필요');
  if (typeof terms.demandEvidence !== 'string' || terms.demandEvidence.trim().length < 10 || !publicUrl(terms.evidenceUrl)) blockers.push('수요 판단 근거와 출처 URL 필요');
  const delivered = comparable.map(c => Number(c.priceKrw) + Number(c.shippingKrw)).sort((a,b)=>a-b);
  const n = delivered.length;
  const competitorMedianKrw = n ? (n % 2 ? delivered[(n-1)/2] : (delivered[n/2-1] + delivered[n/2])/2) : null;
  if (revenueKrw != null && competitorMedianKrw != null && revenueKrw > competitorMedianKrw) blockers.push('구매자 총결제액이 비교상품 중앙값보다 높습니다.');
  return { status: blockers.length ? 'REVIEW_REQUIRED' : 'READY', blockers, costKrw, revenueKrw, feeKrw, profitKrw, marginPercent, competitorMedianKrw, mode: 'OVERSEAS_PURCHASE_AGENCY', note: '예상 공헌이익입니다. 확인되지 않은 세금·비용은 기타 비용에 반영해야 합니다. 수요 판단은 판매 보장이 아닙니다.' };
}

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderDetail(product, listing = {}) {
  const missing = ['name','description','specs','deliveryText','returnText'].filter(k => typeof listing[k] !== 'string' || !listing[k].trim());
  if (!listing.imageRightsConfirmed) missing.push('imageRightsConfirmed');
  const images = listing.imageRightsConfirmed ? (product.images || []).filter(publicUrl).slice(0,8) : [];
  const block = (heading,text) => `<section style="padding:24px 0;border-top:1px solid #e5e7eb"><h2 style="font-size:22px">${escapeHtml(heading)}</h2><p style="white-space:pre-wrap;line-height:1.8">${escapeHtml(text || '확인 후 입력 예정')}</p></section>`;
  const html = `<article lang="ko" style="max-width:860px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#20252b;background:#fff"><p style="color:#52675b;letter-spacing:2px">해외구매대행 · 상품 안내</p><h1 style="font-size:32px;line-height:1.5">${escapeHtml(listing.name || '상품명 확인 필요')}</h1><p style="line-height:1.8;white-space:pre-wrap">${escapeHtml(listing.description || '')}</p>${images.map(src=>`<img src="${escapeHtml(src)}" alt="${escapeHtml(listing.name || '상품 이미지')}" style="display:block;max-width:100%;height:auto;margin:24px auto" />`).join('')}${block('상품 사양',listing.specs)}${block('선택 구성',listing.selectedVariant || '옵션 확인 필요')}${block('해외구매대행 배송 안내',listing.deliveryText)}${block('교환 · 반품 안내',listing.returnText)}</article>`;
  return { html, missing, status: missing.length ? 'DRAFT_INCOMPLETE' : 'DRAFT_READY' };
}
