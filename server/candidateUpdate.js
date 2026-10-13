import { numberOrNull, clearConfirmations, evidenceChanged, confirmationKeys } from '../src/purchaseAgency.js';
import { invalidateReview } from '../src/researchReview.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const costKeys=['purchasePriceCny','fxKrwPerCny','chinaShippingCny','internationalShippingKrw','domesticShippingKrw','otherCostKrw','returnReserveKrw','feePercent','salePriceKrw','buyerShippingKrw','minMarginPercent'];
const termKeys=[...costKeys,...confirmationKeys,'selectedVariant','demandEvidence','evidenceUrl'];
const listingKeys=['name','description','specs','deliveryText','returnText'];
export function validateCandidateUpdate(c,input) {
 if(c.revision!==input.revision)throw Object.assign(new Error('후보가 변경됐습니다. 최신 상태를 다시 불러오세요.'),{status:409,code:'REVISION_CONFLICT'});
 if(c.publication?.status!=='NOT_PUBLISHED')throw new Error('등록 처리 중이거나 완료된 후보는 변경할 수 없습니다.');
 for(const [section,keys] of [['terms',termKeys],['listing',listingKeys]]) {
  if(input[section]===undefined)continue;
  if(!object(input[section])||Object.keys(input[section]).some(k=>!keys.includes(k)))throw new Error(`${section} 편집 필드를 확인하세요.`);
  for(const [k,v] of Object.entries(input[section])) {
   if(confirmationKeys.includes(k)){if(typeof v!=='boolean')throw new Error('확인 항목은 true/false여야 합니다.');}
   else if(costKeys.includes(k)){if(v!==null&&v!==''&&(numberOrNull(v)===null||Number(v)>100000000))throw new Error('비용 범위를 확인하세요.');}
   else if(typeof v!=='string'||v.length>10000)throw new Error('문자 입력 길이를 확인하세요.');
  }
 }
 let market=c.market;
 if(input.comparisons!==undefined){
  if(!Array.isArray(input.comparisons)||input.comparisons.length>40||!market)throw new Error('경쟁 조사 후 비교 항목을 입력하세요.');
  for(const e of input.comparisons)if(!object(e)||Object.keys(e).some(k=>!['id','comparable','shippingKrw'].includes(k))||typeof e.id!=='string'||typeof e.comparable!=='boolean')throw new Error('경쟁 비교 편집 필드가 올바르지 않습니다.');
  market={...market,competitors:market.competitors.map(row=>{
   const edit=input.comparisons.find(e=>e.id===row.id);if(!edit)return row;
   return {...row,comparable:edit.comparable,shippingKrw:numberOrNull(edit.shippingKrw),observedShippingKrw:row.observedShippingKrw??row.shippingKrw,shippingEdited:row.shippingEdited||row.shippingKrw!==numberOrNull(edit.shippingKrw)};
  })};
 }
 let research=c.research,review=c.review;
 if(input.research!==undefined){
  if(!research||!object(input.research)||Object.keys(input.research).some(k=>k!=='salePriceKrw'))throw new Error('조사 편집은 시나리오 판매가만 허용합니다.');
  const salePriceKrw=numberOrNull(input.research.salePriceKrw);
  if(!salePriceKrw||salePriceKrw>100000000)throw new Error('시나리오 판매가는 0 초과 1억원 이하여야 합니다.');
  research={...research,salePriceKrw};
 }
 if(input.review!==undefined){
  const r=input.review;
  if(!object(r)||Object.keys(r).some(k=>!['status','reasons','note'].includes(k))||!['HOLD','REVIEW_REQUIRED'].includes(r.status))throw new Error('검토 상태는 보류 또는 재검토 필요만 저장할 수 있습니다.');
  if(!Array.isArray(r.reasons)||r.reasons.length>20||r.reasons.some(s=>typeof s!=='string'||s.length>500)||typeof r.note!=='string'||r.note.length>2000)throw new Error('검토 사유/메모 형식 또는 길이를 확인하세요.');
  const reasons=r.reasons.map(s=>s.trim()).filter(Boolean);if(r.status==='HOLD'&&!reasons.length)throw new Error('보류 사유를 입력하세요.');
  review={status:r.status,reasons,note:r.note.trim(),stale:false,reviewedAt:new Date().toISOString()};
 }
 const patch={market,terms:{...c.terms,...input.terms},listing:{...c.listing,...input.listing},research,review};
 if(evidenceChanged(c,patch)){patch.terms=clearConfirmations(patch.terms);patch.review=invalidateReview(review);}
 return patch;
}
