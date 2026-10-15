import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, ImageOff, Package } from 'lucide-react';
import { reviewLabels } from '../researchReview.js';
import DiscoveryEstimatePanel from './DiscoveryEstimatePanel.jsx';
import ImageKitExport from './ImageKitExport.jsx';
import DetailMediaPanel from './DetailMediaPanel.jsx';
import { useWorkflow } from '../auth/AuthProvider.jsx';

export const money = value => value == null ? '미확정' : `${value.toLocaleString('ko-KR')}원`;
const range = values => !values ? '비용 미확정' : values[0]===values[1] ? money(values[0]) : `${money(values[0])} ~ ${money(values[1])}`;

function CandidateImage({candidate,large=false}) {
 const [failed,setFailed]=useState(false);
 return <div className={`candidate-image${large?' candidate-image-large':''}`}>
  {candidate.imageUrl&&!failed?<img src={candidate.imageUrl} alt={candidate.title} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<div className="candidate-image-empty"><ImageOff size={large?22:28} strokeWidth={1.3}/><span>{large?'사진 없음':failed?'원본 이미지를 불러올 수 없습니다':'저장된 이미지가 없습니다'}</span></div>}
 </div>;
}

export default function CandidateGallery({views,onReview}) {
 const {user}=useWorkflow();
 const [selectedId,setSelectedId]=useState('816692570613');
 const [mediaCandidate,setMediaCandidate]=useState(null);
 const selected=views.find(c=>c.id===selectedId)||views[0];
 return <div className="candidate-workspace" data-testid="saved-discovery-candidates">
  <div className="candidate-grid" aria-label="저장된 상품 후보">
   {views.map(c=><button key={c.id} type="button" className="candidate-card" aria-pressed={selected?.id===c.id} onClick={()=>setSelectedId(c.id)}>
    <div className="candidate-photo"><CandidateImage key={c.imageUrl||c.id} candidate={c}/><span className="candidate-status">{reviewLabels[c.status]||'검토 필요'}</span></div>
    <div className="candidate-card-copy"><h2>{c.title}</h2><p>{c.moq===1?'1개 구매 가능':`최소주문 ${c.moq??'미확인'}`}<span>옵션 {c.variants}개</span></p><div className="candidate-price">{c.salePriceKrw==null?'판매가 미확정':<>추정 <strong>{money(c.salePriceKrw)}</strong></>}</div><div className="candidate-card-foot">{c.economicsLabel}</div></div>
   </button>)}
  </div>
  {selected&&<aside className="candidate-inspector" aria-label="선택 상품 검토">
   <div className="inspector-heading"><h2>상품 검토</h2><span className="candidate-status">{reviewLabels[selected.status]||'검토 필요'}</span></div>
   <div className="inspector-product"><CandidateImage key={selected.imageUrl||selected.id} candidate={selected} large/><div><h3>{selected.title}</h3><p>상품 {selected.id}</p><p>저장 옵션 {selected.variants}개 · revision {selected.revision}</p></div></div>
   <section className="inspector-finance"><h3>예상 수익성 <span>(참고)</span></h3><dl><div><dt>추정 판매가</dt><dd>{money(selected.salePriceKrw)}</dd></div><div><dt>{selected.economicsLabel}</dt><dd className={selected.profitRange?.[0]<0?'negative':''}>{range(selected.profitRange)}</dd></div>{selected.estimate&&<div><dt>배송비 가정 범위</dt><dd>{money(selected.estimate.profile.shippingLowKrw)} ~ {money(selected.estimate.profile.shippingHighKrw)}</dd></div>}</dl><p>{selected.estimate?'기준 운임·옵션별':'전체 시나리오'} 기여이익 범위 · 실제 순이익 아님</p></section>
   <div className="profit-hold"><AlertTriangle size={18}/><div><strong>수익성 확정 보류</strong><p>배송비·수요·판매 적합성 확인 전에는 확정하지 않습니다.</p></div></div>
   <section className="inspector-reasons"><h3>보류·검토 사유</h3><ul>{selected.reasons.slice(0,4).map(reason=><li key={reason}>{reason}</li>)}</ul>{selected.reasons.length>4&&<p className="t2">외 {selected.reasons.length-4}개 사유 · 전체 검토에서 확인</p>}</section>
   <details className="inspector-estimate"><summary>배송비 범위·옵션별 추정 근거</summary>{selected.estimate?<DiscoveryEstimatePanel estimate={selected.estimate} compact/>:<p>추정 근거와 시나리오는 전체 조사·검토 기록에서 확인하세요. 확인되지 않은 값은 0원으로 처리하지 않습니다.</p>}</details>
   <button type="button" className="btn btn-primary review-record-button" onClick={()=>onReview(selected.id)}>전체 조사·검토 기록 <ArrowRight size={16}/></button>
   <ImageKitExport key={`${user?.id||'local'}:${selected.id}:${selected.revision}`} selected={selected}/>
   <button type="button" className="btn btn-ghost detail-media-open" onClick={()=>setMediaCandidate(selected)}>완성 이미지·상세페이지</button>
   <p className="inspector-lock"><Package size={13}/> 상품 등록·배송 신청 미실행</p>
  </aside>}
  {mediaCandidate&&<DetailMediaPanel key={`${user?.id||'local'}:${mediaCandidate.id}`} candidate={views.find(c=>c.id===mediaCandidate.id)||mediaCandidate} onClose={()=>setMediaCandidate(null)}/>}
 </div>;
}
