import React, {useMemo,useRef,useState} from 'react';
import { Search, Play, SlidersHorizontal, RefreshCw, Loader2 } from 'lucide-react';
import {useWorkflow} from '../auth/AuthProvider.jsx';
import {useResearch} from './ResearchProvider.jsx';
import {savedCandidateViews} from './discoveryView.js';
import CandidateGallery from './CandidateGallery.jsx';
import CollectorPanel from '../CollectorPanel.jsx';
import EstimateProfileFields from './EstimateProfileFields.jsx';
import DiscoveryProgress from './DiscoveryProgress.jsx';

export default function DiscoveryWorkspace(){
 const workflow=useWorkflow(),research=useResearch();
 const [query,setQuery]=useState('平板支架'),[filter,setFilter]=useState(''),[status,setStatus]=useState('전체'),[sort,setSort]=useState('latest');
 const [inspection,setInspection]=useState(null);
 const recordsPanel=useRef(null);
 const all=useMemo(()=>savedCandidateViews(workflow.records),[workflow.records]);
 const views=useMemo(()=>savedCandidateViews(workflow.records,{status,sort}).filter(c=>`${c.title} ${c.sourceTitle} ${c.id}`.toLowerCase().includes(filter.trim().toLowerCase())),[workflow.records,status,sort,filter]);
 const inspect=id=>{if(recordsPanel.current)recordsPanel.current.open=true;setInspection({id,nonce:Date.now()});};
 const run=()=>{if(research.ready&&!research.busy&&query.trim())void research.start(query);};
 return <div className="discovery-workspace">
  <div className="discovery-heading"><div><h1>검토할 상품</h1><p>상품을 보고, 근거를 확인하고, 다음 검토를 결정하세요.</p></div><div className="discovery-summary"><span>저장 후보 <strong>{workflow.recordsLoaded?all.length:'—'}</strong></span><span>검토 보류 <strong>{workflow.recordsLoaded?all.filter(c=>c.status==='HOLD').length:'—'}</strong></span><button type="button" className="btn btn-primary discovery-run" disabled={!research.ready||research.busy||!query.trim()} onClick={run}>{research.busy?<Loader2 size={18}/>:<Play size={18}/>} {research.busy?'조사 예약 중':'발굴 실행'}</button></div></div>
  <div className="discovery-toolbar"><label className="gallery-search"><Search size={17}/><input className="inp" aria-label="저장 상품 검색" placeholder="상품명, 원본명, 상품번호 검색" value={filter} onChange={e=>setFilter(e.target.value)}/></label><select className="inp" aria-label="저장 후보 검토 상태" value={status} onChange={e=>setStatus(e.target.value)}><option value="전체">검토 상태 전체</option><option value="HOLD">보류</option><option value="REVIEW_REQUIRED">재검토 필요</option></select><select className="inp" aria-label="후보 정렬" value={sort} onChange={e=>setSort(e.target.value)}><option value="latest">최근 저장순</option><option value="oldest">오래된 저장순</option><option value="name">상품명순</option></select><button type="button" className="btn btn-ghost" aria-label="조사 상태와 저장 후보 새로고침" disabled={research.loading||research.busy} onClick={()=>research.refresh()}><RefreshCw size={16}/><span>새로고침</span></button></div>
  <details className="discovery-setup"><summary><SlidersHorizontal size={15}/> 조사 설정·진행 상태 <span>작업자 {research.fresh?(research.workerOnline?'연결됨':'대기'):'확인 필요'} · {research.message||'조회 중'}</span></summary><div className="discovery-controls"><label>1688 발굴 검색어<input className="inp" aria-label="1688 발굴 검색어" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();run();}}}/></label><EstimateProfileFields profile={research.estimateProfile} onChange={research.setEstimateProfile} disabled={research.busy} error={research.message.includes('추정')||research.message.includes('빈값')?research.message:null}/><DiscoveryProgress research={research}/></div></details>
  {research.message&&(!research.fresh||research.busy||!research.message.startsWith('서버 조사'))&&<p className="discovery-message" role="status">{research.message}{!research.fresh?' · 마지막 조회 기준일 수 있습니다.':''}</p>}
  {!workflow.recordsLoaded?<div className="gallery-empty" role="status">저장 후보를 불러오고 있습니다…</div>:views.length?<CandidateGallery views={views} onReview={inspect}/>:<div className="gallery-empty"><Search size={30}/><h2>{all.length?'검색 조건에 맞는 후보가 없습니다':'아직 저장된 후보가 없습니다'}</h2><p>{all.length?'검색어나 검토 상태를 바꿔 확인하세요.':'조사 설정에서 판매가·배송비 근거를 입력하고 발굴을 실행하세요.'}</p>{all.length>0&&<button type="button" className="btn btn-ghost" onClick={()=>{setFilter('');setStatus('전체');}}>필터 초기화</button>}</div>}
  <p className="source-image-note">원본 이미지는 내부 검토용입니다. 상세페이지 사용권은 별도로 확인해야 합니다.</p>
  <details ref={recordsPanel} className="discovery-records"><summary>직접 수집·전체 조사·검토 기록</summary><CollectorPanel inspection={inspection}/></details>
 </div>;
}
