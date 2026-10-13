import React from 'react';
const money=n=>`${n.toLocaleString('ko-KR')}원`;
export default function DiscoveryEstimatePanel({estimate,compact=false}) {
 if(!estimate)return null;
 const p=estimate.profile;
 return <section aria-label="후보 추정 수익성" style={{fontSize:12,lineHeight:1.7,margin:'10px 0',overflowWrap:'anywhere'}}>
  <p style={{color:'var(--warn)'}}>수익성 확정 보류 · 신뢰도 낮음 · 추정 기여이익(순이익 아님)</p>
  <p>추정 시점 {new Date(estimate.observedAt).toLocaleString('ko-KR')}{estimate.stale?' · 재조사 조건 미충족: 이전 추정치(만료), 현재 유망 판정 아님':''}</p>
  <p>가정 판매가 {money(p.salePriceKrw)} · 배송비 {money(p.shippingLowKrw)} ~ {money(p.shippingHighKrw)} (기준 {money(p.shippingBaseKrw)})</p>
  {compact&&<p>{estimate.stale?'이전':'기준'} 추정 기여이익: {money(Math.min(...estimate.options.map(s=>s.scenarios[1].profitKrw)))} ~ {money(Math.max(...estimate.options.map(s=>s.scenarios[1].profitKrw)))} · 보수 조건 적자 여부는 옵션별 상세에서 확인</p>}
  <p>추정 근거: {p.basis}</p>
  <details open={!compact}><summary>옵션별 예상 마진 · 비용 가정</summary>
   <p>{estimate.basis}</p>
   {estimate.options.map(s=><div key={s.skuId} style={{marginBottom:12}}><strong>{s.label}</strong> · ¥{s.purchasePriceCny} · {estimate.stale?'이전 조사 기록':s.promising?'추정 유망':'가정 목표 미달'}
    <p>포장 총중량 {s.package.grossWeightG===null?'미확인':`${s.package.grossWeightG}g`} · 크기 {s.package.dimensionsCm?.join(' × ')||'미확인'}{s.package.dimensionsCm?'cm':''}</p>
    <ul>{s.scenarios.map(r=><li key={r.level}>{({Low:'낙관',Base:'기준',High:'보수'})[r.level]}: 배송비 {money(r.shippingKrw)} → 예상 기여이익 {money(r.profitKrw)} / {r.marginPercent.toFixed(1)}%</li>)}</ul>
   </div>)}
   <p>환율 {p.fxKrwPerCny} · 중국 배송 ¥{p.chinaShippingCny} · 기타/포장 {money(p.otherCostKrw)} · 수수료 {p.feePercent}% · 반품 충당 {p.returnPercent}%</p>
   <ul>{estimate.limitations.map(l=><li key={l}>{l}</li>)}</ul>
  </details>
 </section>;
}
