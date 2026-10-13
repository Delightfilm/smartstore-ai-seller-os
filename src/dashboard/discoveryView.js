import { reviewCandidate } from '../researchReview.js';

export function discoveryProgress(jobs=[]) {
 const roots=jobs.filter(j=>j.kind==='search'||!j.input?.parentJobId);
 const root=[...roots].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0];
 const scoped=root?jobs.filter(j=>j.id===root.id||j.input?.parentJobId===root.id):[];
 const counts={queued:0,running:0,human:0,failed:0,completed:0,saved:0,rejected:0};
 for(const j of scoped){
  if(['QUEUED','WAITING_WORKER'].includes(j.status))counts.queued++;
  if(j.status==='RUNNING')counts.running++;
  if(j.status==='WAITING_HUMAN')counts.human++;
  if(j.status==='FAILED')counts.failed++;
  if(j.status==='SUCCEEDED')counts.completed++;
  if(j.result?.candidateId)counts.saved++;
  if(j.result?.status==='HOLD')counts.rejected++;
 }
 return {target:root?.input?.query||root?.input?.url||'아직 조사 없음',total:scoped.length,counts,jobs:scoped};
}

export function savedCandidateViews(records=[],{status='전체',sort='latest'}={}) {
 const views=records.map(candidate=>{
  const review=reviewCandidate(candidate);
  return {id:candidate.id,title:candidate.product?.title||candidate.id,revision:candidate.revision,status:review.status,
   reasons:review.blockers,profitKrw:review.profitKrw??null,marginPercent:review.marginPercent??null,
   updatedAt:candidate.updatedAt||candidate.product?.collectedAt||null,moq:candidate.product?.minOrderQty??null,
   variants:candidate.product?.variants?.length??0};
 }).filter(c=>status==='전체'||c.status===status);
 return views.sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'ko'):sort==='oldest'?String(a.updatedAt||'').localeCompare(String(b.updatedAt||'')):String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
