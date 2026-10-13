import { failure, uuid } from './errors.js';
import { validateCandidateUpdate } from '../candidateUpdate.js';
import { renderDetail } from '../../src/purchaseAgency.js';
import { reviewCandidate, researchMargins } from '../../src/researchReview.js';
const shapes={list:['action','workspaceId'],events:['action','workspaceId','id'],export:['action','workspaceId','id'],update:['action','workspaceId','requestId','id','revision','terms','listing','comparisons','research','review'],search:['action','workspaceId','query'],collect:['action','workspaceId','url'],market:['action','workspaceId','id','revision','query']};
const researchShapes={researchList:[],researchEnqueue:['requestId','kind','query','url','estimateProfile'],researchRetry:['jobId'],workerConnect:['workerId'],workerHeartbeat:['workerId','leaseId'],workerClaim:['workerId'],workerStop:['workerId'],workerComplete:['workerId','jobId','leaseId','kind','urls','offers','observedAt','observation'],workerFail:['workerId','jobId','leaseId','code']};
for(const [action,keys] of Object.entries(researchShapes))shapes[action]=['action','workspaceId',...keys];
export function createAgencyHandler({allowedOrigins,authenticate,storeFor,researchFor}){
 if(!Array.isArray(allowedOrigins)||!allowedOrigins.length)throw failure('ORIGINS_REQUIRED');
 return async req=>{
  const origin=req.headers.get('origin');const allowed=origin!==null&&allowedOrigins.includes(origin);
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',vary:'Origin',...(allowed?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'}:{})};
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
   if(!allowed)throw failure('ORIGIN_FORBIDDEN',403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(req.method!=='POST')throw failure('POST_ONLY',405);
   if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))throw failure('JSON_REQUIRED',415);
   const reader=req.body?.getReader();if(!reader)throw failure('BODY_REQUIRED');
   let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw failure('BODY_TOO_LARGE',413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const input=JSON.parse(new TextDecoder().decode(bytes));
   const keys=shapes[input?.action];if(!input||Array.isArray(input)||!keys||Object.keys(input).some(k=>!keys.includes(k)))throw failure('INVALID_ACTION_OR_FIELDS');
   if(!uuid(input.workspaceId))throw failure('WORKSPACE_REQUIRED');
   if(input.action==='update'&&(!uuid(input.requestId)||!Number.isInteger(input.revision)||input.revision<1))throw failure('INVALID_WRITE_IDENTITY');
   const identity=await authenticate({authorization:req.headers.get('authorization'),workspaceId:input.workspaceId});
   if(identity.workspaceId!==input.workspaceId)throw failure('WORKSPACE_FORBIDDEN',403);
   const store=storeFor({...identity,requestId:input.requestId,authorization:req.headers.get('authorization')});
   if(researchShapes[input.action]){
    if(!researchFor)throw failure('RESEARCH_UNAVAILABLE',503);
    return response(await researchFor(identity)(input));
   }
   if(['search','collect','market'].includes(input.action))throw failure('COLLECTOR_UNAVAILABLE',503);
   if(input.action==='list')return response(await store.list());
   if(typeof input.id!=='string'||!/^\d{1,32}$/.test(input.id))throw failure('CANDIDATE_REQUIRED');
   if(input.action==='events')return response(await store.events(input.id));
   if(input.action==='update'){
    const replay=await store.replay(input.id,input);if(replay)return response(replay);
    const c=await store.get(input.id);
    if(c.revision!==input.revision){const committed=await store.replay(input.id,input);if(committed)return response(committed);}
    const patch=validateCandidateUpdate(c,input);
    return response(await store.update(c.id,c.revision,patch,input));
   }
   const c=await store.get(input.id);
   return response({status:'PREPARATION_ONLY',candidate:c,analysis:reviewCandidate(c),researchMargins:researchMargins(c.research||{}),detail:renderDetail(c.product,{...c.listing,imageRightsConfirmed:c.terms.imageRightsConfirmed===true,selectedVariant:c.terms.selectedVariant})});
  }catch(error){return response({error:error.code||'INVALID_REQUEST',message:error.status===500?'저장 서버 오류가 발생했습니다.':error instanceof SyntaxError?'JSON 요청 형식을 확인하세요.':error.code||String(error.message).slice(0,160)},error.status||400);}
 };
}
