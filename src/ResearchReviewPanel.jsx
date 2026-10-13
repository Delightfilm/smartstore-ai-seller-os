import React from 'react';
import { researchMargins, reviewLabels, reviewCandidate } from './researchReview.js';
import { publicUrl } from './purchaseAgency.js';

const money=n=>n==null?'미산정':`${n.toLocaleString('ko-KR',{maximumFractionDigits:0})}원`;

export default function ResearchReviewPanel({candidate,onPriceChange,onReviewChange,materialDirty}) {
  const research=candidate.research;
  if(!research)return null;
  const review=candidate.review || {status:'REVIEW_REQUIRED',reasons:[],note:''};
  const status=materialDirty?'REVIEW_REQUIRED':reviewCandidate(candidate).status;
  const rows=researchMargins(research);
  return <section aria-label="저장된 조사와 검토" className="surf-2" style={{padding:16,borderRadius:8,margin:'16px 0',fontSize:13,lineHeight:1.7}}>
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <h3 style={{margin:0}}>조사 기록 · P2013</h3>
      <span className="badge" data-testid="research-review-status">{reviewLabels[status]}</span>
      <span className="t3">실제 상품 미등록 · 배송 미신청</span>
    </div>
    <p>관찰일 {new Date(research.observedAt).toLocaleDateString('ko-KR')} · 로컬 영구 저장 · revision {candidate.revision}</p>
    <p>선택 옵션: {research.selectedVariant} · 매입가 ¥{research.purchasePriceCny} · 최소주문 {candidate.product.minOrderQty ?? '미확인'}개 · 관찰 당시 재고 {research.stock}개</p>
    <p>포장표: {research.package.weightG}g / {research.package.dimensionsCm.join(' × ')}cm · {research.package.measured?'실측':'판매자 표시값 · 실측 미확인'}</p>
    <p className="t3">{research.package.note}</p>
    <p>수요: {research.demand}</p>
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{research.sources.filter(s=>publicUrl(s.url)).map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}</div>

    <h4>검토 상태와 사유</h4>
    {(review.stale||materialDirty)&&<p role="status">자료가 변경되어 이전 검토가 만료되었습니다. 조사 시점 근거는 보존됩니다. 변경사항 저장 후 다시 검토하세요.</p>}
    <ul>{review.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
    <label style={{display:'grid',gap:4}}>검토 상태
      <select className="inp" aria-label="검토 상태" disabled={materialDirty} value={review.status} onChange={e=>onReviewChange('status',e.target.value)}>
        <option value="HOLD">보류</option><option value="REVIEW_REQUIRED">재검토 필요</option>
      </select>
    </label>
    <label style={{display:'grid',gap:4,marginTop:8}}>보류·재검토 사유 (한 줄에 하나)
      <textarea className="inp" style={{height:'auto',resize:'vertical'}} rows={4} maxLength={10000} value={review.reasons.join('\n')} onChange={e=>onReviewChange('reasons',e.target.value.split('\n'))}/>
    </label>
    <label style={{display:'grid',gap:4,marginTop:8}}>검토 메모
      <textarea className="inp" style={{height:'auto',resize:'vertical'}} rows={2} maxLength={2000} value={review.note} onChange={e=>onReviewChange('note',e.target.value)}/>
    </label>
    <p className="t3">상태만 바꿔 검토 통과로 만들 수 없습니다. 실거래·게시 기능은 연결하지 않았습니다.</p>

    <h4>마진 시나리오 · 미확정 가정</h4>
    <label style={{display:'grid',gap:4,maxWidth:300}}>시나리오 판매가 (무료배송 총결제액, 원)
      <input className="inp" type="number" min="1" max="100000000" step="1" value={research.salePriceKrw ?? ''} onChange={e=>onPriceChange(e.target.value)}/>
    </label>
    <div style={{overflowX:'auto',marginTop:12}} tabIndex={0} role="region" aria-label="마진 시나리오 표">
      <table style={{width:'100%',textAlign:'left',whiteSpace:'nowrap',borderSpacing:'12px 8px'}}>
        <caption style={{textAlign:'left'}}>조사 시점 비용 가정에 따른 세전 기여이익 — 순이익 아님</caption>
        <thead><tr><th scope="col">조건</th><th scope="col">정액비용</th><th scope="col">광고율</th><th scope="col">기여이익</th><th scope="col">이익률</th><th scope="col">임시 목표 최소 판매가</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={r.id}><th scope="row">{r.label}</th><td>{money(r.fixedCostKrw)}</td><td>{research.scenarios[i].advertisingPercent}%</td><td data-testid={`margin-${r.id}`} style={{color:r.profitKrw<0?'var(--neg)':'var(--text)'}}>{money(r.profitKrw)}</td><td>{r.marginPercent==null?'미산정':`${r.marginPercent.toFixed(1)}%`}</td><td>{money(r.minSalePriceKrw)}</td></tr>)}</tbody>
      </table>
    </div>
    {rows.some(r=>r.error)&&<p role="alert">유효한 판매가와 비용 값이 필요합니다. 빈값은 0원으로 계산하지 않습니다.</p>}
    <p>계산식: 결제 총액 − 상품·중국배송·구매수수료·국제운임·포장비 − 플랫폼 수수료 − 반품 충당 − 광고비</p>
    <p>환율 {research.fxKrwPerCny}원/CNY · 구매 수수료 {research.purchaseFeePercent}% · 플랫폼/결제 {research.platformFeePercent}% · 반품 충당 {research.returnPercent}%</p>
    <details><summary style={{cursor:'pointer'}}>비용 가정과 제외 항목 보기</summary>
      <ul>{research.assumptions.map(a=><li key={a}>{a}</li>)}</ul>
      <ul>{research.scenarios.map(s=><li key={s.id}>{s.label}: 중국 배송 ¥{s.chinaShippingCny}, 운임 {money(s.internationalShippingKrw)}, 포장/검수 {money(s.otherCostKrw)}</li>)}</ul>
    </details>
    <p className="t3">이 표는 조사 시점의 가정이며 아래 ‘단건 비용·검증’의 확정 견적 입력과 별개입니다. 조건상 이익이 나더라도 보류 사유가 자동 해제되지는 않습니다.</p>
  </section>;
}
