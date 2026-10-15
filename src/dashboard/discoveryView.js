import { researchMargins, reviewCandidate } from '../researchReview.js';
import { candidateEstimate } from '../domain/discoveryEstimate.js';
import { publicUrl, numberOrNull } from '../purchaseAgency.js';

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
  const estimate=candidateEstimate(candidate);
  const researchRows=candidate.research?researchMargins(candidate.research):[];
  const profits=estimate?estimate.options.flatMap(o=>o.scenarios.filter(s=>s.level==='Base').map(s=>s.profitKrw)):researchRows.map(r=>r.profitKrw);
  const validProfits=profits.filter(Number.isFinite);
  const images=candidate.product?.images||[];
  return {id:candidate.id,title:candidate.listing?.name?.trim()||candidate.product?.title||candidate.id,sourceTitle:candidate.product?.title||candidate.id,revision:candidate.revision,status:review.status,
   imageUrl:images.find(url=>typeof url==='string'&&url.startsWith('https://')&&publicUrl(url))||null,
   salePriceKrw:numberOrNull(estimate?.profile?.salePriceKrw??candidate.research?.salePriceKrw),
   profitRange:validProfits.length?[Math.min(...validProfits),Math.max(...validProfits)]:null,
   economicsLabel:estimate?.stale?'이전 추정치 · 만료':estimate||researchRows.length?'시나리오 추정치':'비용 미확정',
   reasons:review.blockers,profitKrw:review.profitKrw??null,marginPercent:review.marginPercent??null,
   updatedAt:candidate.updatedAt||candidate.product?.collectedAt||null,moq:candidate.product?.minOrderQty??null,
   variants:candidate.product?.variants?.length??0,estimate};
 }).filter(c=>status==='전체'||c.status===status);
 return views.sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'ko'):sort==='oldest'?String(a.updatedAt||'').localeCompare(String(b.updatedAt||'')):String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}
