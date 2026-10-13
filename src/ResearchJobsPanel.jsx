import React,{useEffect,useRef,useState} from 'react';
import { useWorkflow } from './auth/AuthProvider.jsx';
import { researchJobView } from './dashboard/researchJobView.js';
import { useResearch } from './dashboard/ResearchProvider.jsx';
export default function ResearchJobsPanel({candidate,onCandidates,dirty}) {
  const {records}=useWorkflow();
  const research=useResearch();
  const [query,setQuery]=useState('平板支架'),[url,setUrl]=useState('');
  const {busy,message,worker,...state}=research;
  const callback=useRef(onCandidates);callback.current=onCandidates;
  const synced=useRef('');
  const signature=records.map(c=>`${c.id}:${c.revision}`).join('|');
  useEffect(()=>{if(signature!==synced.current){synced.current=signature;callback.current(records);}},[signature]);
  const enqueue=research.enqueue;
  return <section aria-label="상품 조사 자동화" style={{border:'1px solid var(--line)',padding:12,margin:'12px 0',borderRadius:8}}>
    <h3>상품 조사 자동화</h3>
    <p role="status">{message}</p>
    <p>작업자: {state.workerOnline?'연결됨':'연결 대기'} · {worker?.busy?'수집 중':worker?.enabled?'실행 가능':'중지/오프라인'}{worker?.lastCode?` · ${worker.lastCode}`:''}</p>
    <p className="t3">최근 완료된 조사: {state.jobs.find(j=>j.status==='SUCCEEDED')?new Date(state.jobs.find(j=>j.status==='SUCCEEDED').updated_at).toLocaleString('ko-KR'):'아직 없음'} · 완료는 판매 적합성 통과를 의미하지 않습니다.</p>
    <p className="t3">현재는 이 PC의 개발 서버·로그인된 대시보드·1688 전용 브라우저가 켜져 있을 때 작동합니다. 24시간 서버 수집이나 실제 등록·배송 신청은 하지 않습니다. 검색당 최대 3개 상품을 상세 조사합니다.</p>
    {import.meta.env.DEV&&<div style={{display:'flex',gap:8}}>
      <button className="btn btn-sm" disabled={busy} onClick={research.connect}>로컬 조사 작업자 연결</button>
      <button className="btn btn-sm" disabled={busy} onClick={research.stop}>조사 작업자 중지</button>
    </div>}
    <label style={{display:'block',marginTop:10}}>자동 조사 중국어 검색어<input className="inp" aria-label="자동 조사 중국어 검색어" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></label>
    <button className="btn btn-sm" disabled={busy||!query.trim()} onClick={()=>enqueue('search',{query})}>검색·조건 선별 조사 예약</button>
    <label style={{display:'block',marginTop:10}}>자동 조사 1688 URL<input className="inp" aria-label="자동 조사 1688 URL" value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <button className="btn btn-sm" disabled={busy||!url.trim()} onClick={()=>enqueue('refresh',{url})}>상품 조건 확인·후보 저장 예약</button>
    {candidate&&<button className="btn btn-sm" disabled={busy||dirty} onClick={()=>enqueue('refresh',{url:candidate.product.canonicalUrl})}>선택 후보 가격·재고·포장 재조사</button>}
    <div style={{overflowX:'auto',maxHeight:320}}><table style={{width:'100%',fontSize:12}}><thead><tr><th>조사 대상</th><th>상태</th><th>실제 결과·제외 사유</th><th>재시도</th></tr></thead><tbody>{state.jobs.map(j=>{
      const view=researchJobView(j,{workerOnline:state.workerOnline});
      return <tr key={j.id}><td>{j.kind==='search'?j.input.query:<a href={j.input.url} target="_blank" rel="noreferrer">{j.input.url?.match(/offer\/(\d+)/)?.[1]||'상품'}</a>}<br/>{new Date(j.updated_at).toLocaleString('ko-KR')}</td><td>{view.label}</td><td>{view.outcome}<ul>{view.reasons.slice(0,2).map(r=><li key={r}>{r}</li>)}</ul>{view.reasons.length>2&&<details><summary>제외 사유 전체 {view.reasons.length}개 보기</summary><ul>{view.reasons.map(r=><li key={r}>{r}</li>)}</ul></details>}</td><td>{view.retryable&&<button className="btn btn-sm" disabled={busy} onClick={()=>research.retry(j.id)}>검증 완료 후 재시도</button>}</td></tr>;
    })}</tbody></table></div>
  </section>;
}
