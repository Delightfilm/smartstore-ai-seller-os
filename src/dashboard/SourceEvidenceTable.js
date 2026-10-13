import React from 'react';
const h=React.createElement;
export default function SourceEvidenceTable({observation}) {
 if(!observation)return null;
 return h('details',{open:true},h('summary',null,'옵션별 단건 공급·포장 근거'),
  h('div',{style:{overflowX:'auto'}},h('table',{style:{width:'100%',fontSize:12}},
   h('thead',null,h('tr',null,...['원문 SKU / 옵션','가격·재고·MOQ','개당 포장 총중량','포장 가로×세로×높이','원문·확인 시간'].map(text=>h('th',{key:text,scope:'col'},text)))),
   h('tbody',null,...observation.skuObservations.map(s=>h('tr',{key:s.skuId},
    h('td',null,`${s.skuId} · ${s.label}`),h('td',null,`¥${s.priceCny} · ${s.stock}개 · MOQ ${s.moq}`),
    h('td',null,s.package.grossWeightG===null?'미확인':`${s.package.grossWeightG}g`),
    h('td',null,s.package.dimensionsCm?`${s.package.dimensionsCm.join(' × ')}cm`:'미확인'),
    h('td',null,h('a',{href:observation.sourceUrl,target:'_blank',rel:'noreferrer'},'원문'),' · ',new Date(observation.observedAt).toLocaleString('ko-KR'))))))),
  h('p',null,'포장 미확인 상품도 추정 후보로 보관됩니다. 후보 저장은 판매 승인·수익성 확정이 아닙니다. 정보 갱신 시 검토 확인 항목은 해제됩니다.'));
}
