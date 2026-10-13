import React from 'react';
import { discoveryProgress } from './discoveryView.js';
import { researchJobView } from './researchJobView.js';
const stages={queued:'대기',running:'조사 중',human:'검증 대기',failed:'실패',completed:'조사 완료',saved:'후보 저장',rejected:'조건 미충족'};
export default function DiscoveryProgress({research}) {
 const progress=discoveryProgress(research.jobs);
 return <section className="surf" aria-label="실제 발굴 진행 상태" style={{padding:16}}>
  <div className="flex items-center justify-between" style={{gap:10,flexWrap:'wrap',marginBottom:12}}><span className="eyebrow">최근 조사 · {progress.target}</span><span className="t3" style={{fontSize:12}}>작업자 {research.workerOnline?'연결됨':'대기'} · 예산 미연동</span></div>
  <p role="status" style={{fontSize:12}}>{research.message}{!research.fresh&&!research.loading?' · 아래는 마지막 조회 기록입니다.':''}</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:2}}>{Object.entries(stages).map(([key,label])=><div key={key} style={{textAlign:'center'}}><span className="num">{research.loading?'—':progress.counts[key]}</span><div style={{height:3,background:key==='saved'?'var(--accent)':'var(--surface-3)',margin:'8px 0 5px'}}/><span className="t3" style={{fontSize:10}}>{label}</span></div>)}</div>
  <p className="t3" style={{fontSize:11,marginBottom:0}}>검색·상세 작업 {progress.total}건 기준 · 조사 완료는 판매 적합성 통과가 아닙니다. PC·개발 서버·1688 로그인 세션이 필요합니다.</p>
  <details style={{marginTop:10}}><summary style={{cursor:'pointer',fontSize:12}}>진행 상세·제외 사유</summary><div style={{overflowX:'auto',maxHeight:280}}><table style={{width:'100%',fontSize:12}}><thead><tr><th>대상</th><th>진행 상태</th><th>저장 결과·사유</th><th>재시도</th></tr></thead><tbody>{progress.jobs.map(j=>{const view=researchJobView(j,{workerOnline:research.workerOnline});return <tr key={j.id}><td>{j.input?.query||j.input?.url?.match(/offer\/(\d+)/)?.[1]||j.id}</td><td>{view.label}</td><td>{view.outcome}<ul>{view.reasons.map(r=><li key={r}>{r}</li>)}</ul></td><td>{view.retryable&&<button className="btn btn-sm" disabled={research.busy} onClick={()=>research.retry(j.id)}>검증 완료 후 재시도</button>}</td></tr>;})}</tbody></table></div></details>
 </section>;
}
