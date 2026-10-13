import React from 'react';
import { reviewLabels } from '../researchReview.js';
export default function SavedCandidateCards({views,onReview}) {
 return <div data-testid="saved-discovery-candidates" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(330px,100%),1fr))',gap:14}}>{views.map(c=><article key={c.id} className="surf" style={{padding:16,minWidth:0}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:8}}><span className="chip" style={{background:'var(--warn-soft)',color:'var(--warn)'}}>{reviewLabels[c.status]||'검토 필요'}</span><span className="num t3">revision {c.revision}</span></div>
  <h3 style={{fontSize:14,margin:'12px 0 6px',overflowWrap:'anywhere'}}>{c.title}</h3>
  <p className="t3" style={{fontSize:12}}>상품 {c.id} · MOQ {c.moq??'미확인'} · 저장 옵션 {c.variants}개</p>
  <p style={{fontSize:12}}>단건 예상 기여이익: {c.profitKrw===null?'비용 미확정':`${c.profitKrw.toLocaleString()}원 (추정)`}</p>
  <ul style={{fontSize:12,paddingLeft:18}}>{c.reasons.slice(0,2).map(r=><li key={r}>{r}</li>)}</ul>
  <p className="t3" style={{fontSize:11}}>등록·배송 미실행 · 추천 등급·수요 점수 미검증</p>
  <button className="btn btn-sm btn-ghost" onClick={()=>onReview(c.id)}>조사·보류·마진 확인</button>
 </article>)}</div>;
}
