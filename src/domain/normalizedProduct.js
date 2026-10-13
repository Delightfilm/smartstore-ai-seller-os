import { normalizeEvidence,sourceNumber,evidenceMatches } from './sourceEvidence.js';
import { supportedOfferUrl } from './source1688.js';
import { publicUrl } from '../purchaseAgency.js';
export function normalizeProduct(raw={}) {
  let identity=null;try { identity=supportedOfferUrl(raw.sourceUrl); } catch {}
  const input=Array.isArray(raw.skus)?raw.skus:[];
  const skuObservations=input.slice(0,36).map(s=>{
    const evidence=Object.fromEntries(['price','moq','stock','grossWeight','dimensions'].map(k=>[k,normalizeEvidence(s[k])]));
    const weight=evidence.grossWeight,dimensions=evidence.dimensions;
    const weightFactor={g:1,kg:1000}[weight?.unit],lengthFactor={cm:1,mm:0.1,m:100}[dimensions?.unit];
    const gross=weight?.semantic==='packed_gross'&&weightFactor?sourceNumber(weight.value):null;
    const lengths=dimensions?.semantic==='packed_dimensions'&&lengthFactor&&Array.isArray(dimensions.value)&&dimensions.value.length===3?dimensions.value.map(sourceNumber):null;
    return {skuId:typeof s.skuId==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(s.skuId)?s.skuId:null,
      label:typeof s.label==='string'?s.label.trim().slice(0,200):'',priceCny:evidence.price?.unit==='CNY'?sourceNumber(evidence.price.value):null,
      moq:evidence.moq?.unit==='piece'?sourceNumber(evidence.moq.value):null,stock:evidence.stock?.unit==='piece'?sourceNumber(evidence.stock.value):null,
      package:{grossWeightG:gross>0?gross*weightFactor:null,dimensionsCm:lengths?.every(n=>n>0)?lengths.map(n=>Math.round(n*lengthFactor*1e6)/1e6):null},evidence};
  });
  return {source:'1688',offerId:identity?.offerId===String(raw.offerId)?String(raw.offerId):null,sourceUrl:identity?.canonicalUrl||null,
    title:typeof raw.title==='string'?raw.title.trim().slice(0,300):'',observedAt:raw.observedAt,skuObservations,
    offerMoq:normalizeEvidence(raw.moq),cardMoq:normalizeEvidence(raw.cardMoq),skuLimitExceeded:input.length>36,
    images:Array.isArray(raw.images)?[...new Set(raw.images.filter(publicUrl))].slice(0,24):[],
    supplier:typeof raw.supplier==='string'?{name:raw.supplier.slice(0,200)}:null};
}
export function checkSourcingEligibility(observation,{now=Date.now()}={}) {
  const reasons=[];const add=message=>reasons.push(message);
  if(!observation.offerId||!observation.title)add('상품 식별자·상품명 미확인');
  if(!observation.skuObservations.length||observation.skuLimitExceeded)add('옵션 목록 미확인 또는 지원 개수 초과');
  const seen=new Set();
  for(const s of observation.skuObservations){
    const prefix=s.label||'미확인 옵션',context={offerId:observation.offerId,skuId:s.skuId,now};
    if(!s.skuId||seen.has(s.skuId)||!s.label)add(`${prefix}: 원문 SKU 식별자 미확인/중복`);seen.add(s.skuId);
    if(s.moq!==1||!evidenceMatches(s.evidence.moq,{...context,offerAllowed:true})||s.evidence.moq?.unit!=='piece')add(`${prefix}: 1개 구매 가능 근거 미확인`);
    if(observation.offerMoq&&(observation.offerMoq.unit!=='piece'||sourceNumber(observation.offerMoq.value)!==1||!evidenceMatches(observation.offerMoq,{...context,offerAllowed:true})))add(`${prefix}: 상품·옵션 MOQ 충돌 또는 미확인`);
    if(observation.cardMoq&&(observation.cardMoq.unit!=='piece'||sourceNumber(observation.cardMoq.value)!==1||!evidenceMatches(observation.cardMoq,{...context,offerAllowed:true})))add(`${prefix}: 검색 카드·상세 MOQ 충돌 또는 오래된 카드 근거`);
    if(!(s.priceCny>0)||!evidenceMatches(s.evidence.price,context))add(`${prefix}: 옵션 가격 미확인`);
    if(!Number.isInteger(s.stock)||s.stock<1||!evidenceMatches(s.evidence.stock,context))add(`${prefix}: 옵션 재고 미확인/품절`);
    if(!(s.package.grossWeightG>0)||!evidenceMatches(s.evidence.grossWeight,context))add(`${prefix}: 개당 포장 총중량·단위·근거 미완비`);
    if(!s.package.dimensionsCm?.every(n=>n>0)||!evidenceMatches(s.evidence.dimensions,context))add(`${prefix}: 개당 포장 가로·세로·높이·근거 미완비`);
  }
  return {status:reasons.length?'HOLD':'ELIGIBLE',reasons:[...new Set(reasons)].slice(0,100)};
}
