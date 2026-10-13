import { evaluateCandidate, numberOrNull } from './purchaseAgency.js';

export const reviewLabels = { HOLD:'보류', REVIEW_REQUIRED:'재검토 필요', READY:'검토 통과' };

// Research scenarios are assumptions, never confirmed order economics.
export function researchMargins(research = {}) {
  return (research.scenarios || []).map(scenario => {
    const values = Object.fromEntries([
      'salePriceKrw','purchasePriceCny','fxKrwPerCny','purchaseFeePercent',
      'platformFeePercent','returnPercent','minProfitKrw','minMarginPercent',
    ].map(key => [key,numberOrNull(research[key])]));
    const costs = Object.fromEntries(['chinaShippingCny','internationalShippingKrw','otherCostKrw','advertisingPercent'].map(key=>[key,numberOrNull(scenario[key])]));
    const rate=(values.platformFeePercent+values.returnPercent+costs.advertisingPercent)/100;
    const invalid=Object.values({...values,...costs}).some(v=>v===null) ||
      ['salePriceKrw','purchasePriceCny','fxKrwPerCny'].some(k=>values[k]<=0) ||
      values.purchaseFeePercent>=100 || values.minMarginPercent>=100 || rate+values.minMarginPercent/100>=1;
    if(invalid)return {id:scenario.id,label:scenario.label,profitKrw:null,marginPercent:null,minSalePriceKrw:null,error:'비용·판매가·비율을 확인하세요.'};
    const fixedCostKrw=(values.purchasePriceCny+costs.chinaShippingCny)*values.fxKrwPerCny+
      values.purchasePriceCny*values.fxKrwPerCny*values.purchaseFeePercent/100+costs.internationalShippingKrw+costs.otherCostKrw;
    const profit=values.salePriceKrw*(1-rate)-fixedCostKrw;
    return {id:scenario.id,label:scenario.label,fixedCostKrw,profitKrw:Math.round(profit),
      marginPercent:profit/values.salePriceKrw*100,
      minSalePriceKrw:Math.ceil(Math.max((fixedCostKrw+values.minProfitKrw)/(1-rate),fixedCostKrw/(1-rate-values.minMarginPercent/100))),
      meetsTarget:profit>=values.minProfitKrw && profit/values.salePriceKrw*100>=values.minMarginPercent};
  });
}

export function reviewCandidate(candidate) {
  const analysis=evaluateCandidate(candidate.product,candidate.market || {},candidate.terms);
  const review=candidate.review;
  if(!review)return analysis;
  const reasons=Array.isArray(review.reasons)?review.reasons:[];
  return {...analysis,status:review.status==='HOLD'?'HOLD':'REVIEW_REQUIRED',
    blockers:[...new Set([...(review.stale?['자료 변경으로 이전 검토가 만료됐습니다. 재검토 후 저장하세요.']:[]),...reasons,...analysis.blockers])]};
}

export function invalidateReview(review) {
  return review?{...review,status:'REVIEW_REQUIRED',stale:true,reviewedAt:null}:review;
}
