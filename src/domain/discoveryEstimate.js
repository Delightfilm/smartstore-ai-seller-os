import { sourceNumber } from './sourceEvidence.js';
export const estimateDefaults={salePriceKrw:'',fxKrwPerCny:211,chinaShippingCny:5,shippingLowKrw:3000,shippingBaseKrw:5000,shippingHighKrw:8000,otherCostKrw:500,feePercent:6,returnPercent:3,minProfitKrw:1000,minMarginPercent:10,basis:''};
const fields=Object.keys(estimateDefaults).filter(k=>k!=='basis');
export function normalizeEstimateProfile(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(estimateDefaults,k)))throw new Error('추정 가정 필드를 확인하세요.');
 const p=Object.fromEntries(fields.map(k=>[k,sourceNumber(input[k])]));
 if(Object.values(p).some(n=>n===null||n>100000000)||p.salePriceKrw<=0||p.fxKrwPerCny<=0||p.fxKrwPerCny>100000||p.minProfitKrw<=0||p.minMarginPercent<=0||p.minMarginPercent>=100||p.feePercent+p.returnPercent>=100||p.shippingLowKrw<=0||p.shippingLowKrw>p.shippingBaseKrw||p.shippingBaseKrw>p.shippingHighKrw||typeof input.basis!=='string'||input.basis.trim().length<10||input.basis.length>1000)throw new Error('판매가·환율·배송비 범위·추정 근거를 확인하세요. 빈값은 0원으로 계산하지 않습니다.');
 return {...p,basis:input.basis.trim()};
}
// Decimal inputs are JSON numbers. Exact fractions prevent binary rounding from
// disagreeing with PostgreSQL numeric at whole-won floor boundaries.
const decimal=value=>{
 const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
 const digits=mantissa.replace('.',''),power=Number(exponent)-(mantissa.split('.')[1]?.length||0);
 return power>=0?{n:BigInt(digits)*10n**BigInt(power),d:1n}:{n:BigInt(digits),d:10n**BigInt(-power)};
};
const add=(a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
const multiply=(a,b)=>({n:a.n*b.n,d:a.d*b.d});
const negative=a=>({...a,n:-a.n});
const floor=a=>a.n>=0n?a.n/a.d:-((-a.n+a.d-1n)/a.d);
const margin=(profit,sale)=>{
 const n=profit*100000000n*sale.d,abs=n<0n?-n:n;
 return Number((abs*2n+sale.n)/(sale.n*2n))*(n<0n?-1:1)/1000000;
};
export function discoveryEstimate(observation,input) {
 const profile=normalizeEstimateProfile(input);
 const options=observation.skuObservations.map(s=>{
  const scenarios=['Low','Base','High'].map(level=>{
   const shippingKrw=profile[`shipping${level}Krw`];
   if(!(s.priceCny>0)||s.priceCny>100000000)throw new Error('추정 공급가 범위를 확인하세요.');
   const sale=decimal(profile.salePriceKrw);
   const rate=multiply(add(decimal(profile.feePercent),decimal(profile.returnPercent)),{n:1n,d:100n});
   const revenue=multiply(sale,add({n:1n,d:1n},negative(rate)));
   const purchase=multiply(add(decimal(s.priceCny),decimal(profile.chinaShippingCny)),decimal(profile.fxKrwPerCny));
   const profit=floor(add(add(add(revenue,negative(purchase)),negative(decimal(shippingKrw))),negative(decimal(profile.otherCostKrw))));
   return {level,shippingKrw,profitKrw:Number(profit),marginPercent:margin(profit,sale)};
  });
  return {skuId:s.skuId,label:s.label,purchasePriceCny:s.priceCny,package:s.package,scenarios,promising:scenarios[1].profitKrw>=profile.minProfitKrw&&scenarios[1].marginPercent>=profile.minMarginPercent};
 });
 return {status:'PROFITABILITY_PENDING',confidence:'LOW',observedAt:observation.observedAt,profile,options,
  promising:options.some(s=>s.promising),basis:'확인된 옵션 공급가 + 운영자 입력 판매가·배송비 예산 시나리오. 실측 운임·동일 구성 경쟁가·수요 검증 아님.',
  limitations:['수익성 확정 보류: 퀵스타 실측·최종 운임 미확인','포장 미확인 값은 유지하며 사진만으로 총중량을 확정하지 않음','세금·광고·추가 취급비는 별도 확인 필요; 순이익·판매 보장 아님']};
}
export function candidateEstimate(candidate) {
 const estimate=candidate.product?.discoveryEstimate;
 if(!estimate)return null;
 const check=candidate.product.latestSourcingCheck;
 const stale=check?.status==='HOLD'&&(!Number.isFinite(Date.parse(check.observedAt))||Date.parse(check.observedAt)>=Date.parse(estimate.observedAt));
 return {...estimate,stale};
}
