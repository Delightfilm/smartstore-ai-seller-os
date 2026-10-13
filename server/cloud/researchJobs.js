import { supportedOfferUrl } from '../../src/domain/source1688.js';
import { normalizeProduct, checkSourcingEligibility } from '../../src/domain/normalizedProduct.js';
import { uuid, failure } from './errors.js';
import { normalizeEstimateProfile, discoveryEstimate } from '../../src/domain/discoveryEstimate.js';
import { evidenceMatches } from '../../src/domain/sourceEvidence.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;

export function researchOperation(input,{cardMoq=null,estimateProfile=null}={}) {
  const actions = {researchList:'list',researchEnqueue:'enqueue',researchRetry:'retry',workerConnect:'connect',workerHeartbeat:'heartbeat',workerClaim:'claim',workerStop:'stop',workerComplete:'complete',workerFail:'fail'};
  const action = actions[input.action];
  if (!action) throw failure('INVALID_RESEARCH_ACTION');
  const data = {};
  if (['connect','heartbeat','claim','stop','complete','fail'].includes(action)) {
    if (!uuid(input.workerId)) throw failure('WORKER_REQUIRED');
    data.workerId=input.workerId;
  }
  if (['complete','fail','retry'].includes(action)) {
    if (!uuid(input.jobId)) throw failure('JOB_REQUIRED');
    data.jobId=input.jobId;
  }
  if (['complete','fail'].includes(action) || input.leaseId!==undefined) {
    if (!uuid(input.leaseId)) throw failure('LEASE_REQUIRED');
    data.leaseId=input.leaseId;
  }
  if (action==='enqueue') {
    if (!uuid(input.requestId)||!['search','refresh'].includes(input.kind)) throw failure('INVALID_JOB');
    data.requestId=input.requestId;data.kind=input.kind;
    if (input.kind==='search') {
      if(typeof input.query!=='string'||!input.query.trim()||input.query.length>100)throw failure('QUERY_REQUIRED');
      data.query=input.query.trim();
    } else data.url=supportedOfferUrl(input.url).canonicalUrl;
    if(input.estimateProfile!==undefined)data.estimateProfile=normalizeEstimateProfile(input.estimateProfile);
  }
  if (action==='complete') {
    if (input.kind==='search') {
      const offers=input.offers??input.urls?.map(url=>({url,cardMoq:null}));
      if(!Array.isArray(offers)||offers.length>3)throw failure('INVALID_SEARCH_RESULT');
      if(typeof input.observedAt!=='string'||!Number.isFinite(Date.parse(input.observedAt)))throw failure('OBSERVATION_TIME_REQUIRED');
      const cards={};
      for(const o of offers){const url=supportedOfferUrl(o.url).canonicalUrl;if(o.cardMoq!=null&&(!Number.isInteger(o.cardMoq)||o.cardMoq<1||o.cardMoq>1000000))throw failure('INVALID_CARD_MOQ');cards[url]=o.cardMoq??null;}
      data.result={kind:'search',urls:Object.keys(cards),cardMoQs:cards,observedAt:input.observedAt,status:'SEARCHED'};
    } else if(input.kind==='refresh') {
      const observation=normalizeProduct({...input.observation,cardMoq});
      let gate=checkSourcingEligibility(observation),estimate=null;
      if(estimateProfile){
        for(const s of observation.skuObservations){
          const context={offerId:observation.offerId,skuId:s.skuId,now:Date.parse(observation.observedAt)};
          if(!evidenceMatches(s.evidence.grossWeight,context))s.package.grossWeightG=null;
          if(!evidenceMatches(s.evidence.dimensions,context))s.package.dimensionsCm=null;
        }
        const trade=checkSourcingEligibility(observation,{requirePackaging:false});
        if(observation.skuSetComplete!==true)trade.reasons.push('원문 판매 옵션 전체 목록 미확인');
        if(observation.skuObservations.some(s=>s.priceCny>100000000))trade.reasons.push('추정 공급가 지원 범위 초과');
        if(!trade.reasons.length){
          estimate=discoveryEstimate(observation,estimateProfile);
          gate={status:estimate.promising?'PROVISIONAL':'HOLD',reasons:estimate.promising?['수익성 확정 보류: 추정 가정이며 포장·운임·경쟁·수요 확인 필요']:['기준 배송비 시나리오의 추정 마진 목표 미달']};
        }else gate={status:'HOLD',reasons:trade.reasons};
      }
      data.result={kind:'refresh',...gate,observation,...(estimate?{estimate}:{})};
    } else throw failure('INVALID_JOB_KIND');
  }
  if(action==='fail') {
    const codes=['BROWSER_VERIFY_REQUIRED','HUMAN_REQUIRED','SIGN_IN_REQUIRED','BROWSER_NOT_READY','READ_FAILED','RESULT_TOO_LARGE','RESULT_REJECTED'];
    data.result={code:codes.includes(input.code)?input.code:'READ_FAILED'};
  }
  return {action,data};
}

export function researchJobsService({writer,workspaceId,actorId}) {
  return async input=>{
    let cardMoq=null,completed=null,estimateProfile=null;
    if(input.action==='workerComplete'&&input.kind==='refresh'){
      const {data:job,error}=await writer.from('seller_os_research_jobs').select('input,completion_input').eq('workspace_id',workspaceId).eq('id',input.jobId).maybeSingle();
      if(error||!job)throw failure('JOB_REQUIRED');
      if(job.input.cardMoq!=null)cardMoq={value:job.input.cardMoq,unit:'piece',kind:'observed',confirmed:true,sourceUrl:job.input.url,observedAt:job.input.cardObservedAt,scope:{quantity:1,level:'offer',skuId:null}};
      completed=job.completion_input?.result;
      estimateProfile=job.input.estimateProfile??null;
    }
    const {action,data}=researchOperation(input,{cardMoq,estimateProfile});
    // A committed observation must replay its original verdict, even after freshness expires.
    // SQL still checks worker/lease and exact normalized completion identity.
    if(completed?.observation&&JSON.stringify(canonical(completed.observation))===JSON.stringify(canonical(data.result?.observation)))data.result=completed;
    // PostgreSQL jsonb text adds separators; the indented encoding is a conservative
    // upper bound for our bounded normalized values. Never truncate the full SKU set.
    if(action==='complete'&&new TextEncoder().encode(JSON.stringify(data,null,1)).length>65536)throw failure('RESULT_TOO_LARGE',400);
    const {data:result,error}=await writer.rpc('seller_os_research_operation',{p_workspace:workspaceId,p_actor:actorId,p_action:action,p_input:data});
    if(error)throw failure(error.code==='40001'?'LEASE_OR_WORKER_CONFLICT':error.code==='42501'?'WORKER_FORBIDDEN':error.code==='22023'?'INVALID_JOB_OR_REPLAY':'RESEARCH_STORE_ERROR',error.code==='40001'?409:error.code==='42501'?403:error.code==='22023'?400:500);
    return result;
  };
}
