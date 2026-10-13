import { failure } from './errors.js';
const check=({data,error})=>{
 if(error){const statuses={'40001':409,'22023':409,'42501':403};throw failure(error.code==='40001'?'REVISION_CONFLICT':error.code==='22023'?'REQUEST_REUSED':'STORE_ERROR',statuses[error.code]||500);}
 return data;
};
export function createCloudStore({client,writer,workspaceId,actorId,requestId}){
 const query=()=>client.from('seller_os_candidates').select('data').eq('workspace_id',workspaceId).eq('source','1688');
 return {
  async list(){return check(await query().order('created_at')).map(r=>r.data);},
  async get(id){if(!/^\d{1,32}$/.test(id))throw failure('CANDIDATE_REQUIRED');const rows=check(await query().eq('offer_id',id));if(rows.length!==1)throw failure('CANDIDATE_NOT_FOUND',404);return rows[0].data;},
  async events(id){return check(await client.from('seller_os_candidate_events').select('id,offer_id,revision,kind,changed_fields,created_at').eq('workspace_id',workspaceId).eq('offer_id',id).order('revision'));},
  async replay(id,input){return check(await writer.rpc('seller_os_replay_request',{p_workspace:workspaceId,p_actor:actorId,p_request:requestId,p_input:input}));},
  async update(id,revision,patch,input){return check(await writer.rpc('seller_os_commit_candidate',{p_workspace:workspaceId,p_actor:actorId,p_request:requestId,p_offer:id,p_expected:revision,p_patch:patch,p_input:input}));},
 };
}
