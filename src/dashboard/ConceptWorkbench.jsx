import React,{useEffect,useRef,useState} from 'react';
import { X, ImageOff, Check } from 'lucide-react';
import { artCategories, buildArtDirection } from '../export/artDirection.js';

function SourceStudy({imageUrl,concept}){
 const [failed,setFailed]=useState(false);
 return <div className={`concept-study concept-study-${concept.id}`}>
  <strong className="study-title">{concept.heroTitle}</strong>
  <div className="study-photo">{imageUrl&&!failed?<img src={imageUrl} alt="저장된 상품 원본 · 콘셉트 배치 예시" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span><ImageOff size={24} aria-hidden="true"/>원본 사진 필요</span>}</div>
  <div className="study-caption">{concept.id==='clean'?'형태와 쓰임을 차분하게':concept.id==='color'?'사진과 타이포에 다른 리듬을':'옵션 · 구성 · 확인된 정보'}</div>
 </div>;
}

export default function ConceptWorkbench({candidate,choice,onChange,onClose,children}){
 const heading=useRef(null);
 const art=buildArtDirection(candidate,choice);
 const chosen=art.concepts.find(c=>c.id===art.selection.conceptId);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[]);
 return <section className="concept-workbench" aria-labelledby="concept-workbench-title">
  <div className="concept-heading"><div><h2 id="concept-workbench-title" ref={heading} tabIndex={-1}>상세페이지 콘셉트 비교</h2><p>상품 {candidate.id} · 원본 사진을 활용한 레이아웃 예시입니다. GPT 완성 이미지가 아닙니다.</p></div><button type="button" className="btn btn-ghost" onClick={onClose}><X size={16} aria-hidden="true"/>비교 닫기</button></div>
  <div className="concept-context"><label>제작 품목<select className="inp" value={art.category.id} onChange={e=>onChange({categoryId:e.target.value,conceptId:'clean'})}>{artCategories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><p>{art.category.reason}. 품목·사진·실제 SKU는 제작 전 대조해야 합니다.</p></div>
  <fieldset className="concept-choices"><legend>제작 방향 선택 · 이번 요청문과 ZIP에만 반영</legend>
   {art.concepts.map(concept=><div className="concept-option" key={concept.id} data-selected={chosen.id===concept.id}>
    <label className="concept-select"><input type="radio" name={`concept-${candidate.id}`} value={concept.id} checked={chosen.id===concept.id} onChange={()=>onChange({categoryId:art.category.id,conceptId:concept.id})}/><span>{concept.name}</span>{chosen.id===concept.id&&<Check size={16} aria-hidden="true"/>}</label>
    <SourceStudy key={`${candidate.id}:${candidate.imageUrl}:${concept.id}`} imageUrl={candidate.imageUrl} concept={concept}/>
    <dl><div><dt>구매 질문</dt><dd>{concept.buyerQuestion}</dd></div><div><dt>구성</dt><dd>{concept.layout}</dd></div><div><dt>사진</dt><dd>{concept.photography}</dd></div></dl>
    <a href={concept.reference.url} target="_blank" rel="noopener noreferrer">구조 참고: {concept.reference.name}</a>
   </div>)}
  </fieldset>
  <div className="concept-export"><div><p role="status">선택: <strong>{chosen.name}</strong> · 가이드 v3</p><p>예시 카피·사진 배치는 미검수입니다. 원본 사용권·실제 구성 확인 전 게시 보류를 유지합니다. 후보 저장·검토 상태는 바뀌지 않습니다.</p></div>{children}</div>
 </section>;
}
