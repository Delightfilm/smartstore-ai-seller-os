export function summarizeCandidates(candidates){
 return {candidateCount:candidates.length,holdCount:candidates.filter(c=>c.review?.status==='HOLD').length,reviewRequiredCount:candidates.filter(c=>c.review?.status==='REVIEW_REQUIRED'||!c.review).length};
}
