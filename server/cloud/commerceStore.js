import { failure } from './errors.js';
import { validateCommerceReport } from '../commerce/snapshot.js';
const check=({data,error})=>{if(error)throw failure(error.code==='40001'?'COMMERCE_REVISION_CONFLICT':'COMMERCE_STORE_ERROR',error.code==='40001'?409:500);return data;};
export function createCommerceStore({client,writer,workspaceId,actorId}){
 return {
  async read(){
   const r=check(await client.from('seller_os_commerce_connections').select('workspace_id,provider,source,channel,status,error_code,attempted_at,succeeded_at,received_at,actor_id,revision').eq('workspace_id',workspaceId).maybeSingle());
   if(!r)return null;
   return {workspaceId:r.workspace_id,provider:r.provider,source:r.source,channel:r.channel,status:r.status,errorCode:r.error_code,attemptedAt:r.attempted_at,succeededAt:r.succeeded_at,receivedAt:r.received_at,actorId:r.actor_id,revision:r.revision};
  },
  async publish({expectedRevision,report}){
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw failure('COMMERCE_REPORT_INVALID');
   const sanitized=validateCommerceReport(report);
   return check(await writer.rpc('seller_os_publish_commerce_connection',{p_workspace_id:workspaceId,p_actor_id:actorId,p_expected_revision:expectedRevision,p_report:sanitized}));
  },
 };
}
