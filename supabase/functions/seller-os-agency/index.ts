import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { authenticateRequest } from '../../../server/cloud/auth.js';
import { createCloudStore } from '../../../server/cloud/workflowStore.js';
import { createAgencyHandler } from '../../../server/cloud/handler.js';
import { researchJobsService } from '../../../server/cloud/researchJobs.js';

// Runtime-provided keys stay on Supabase's server; never returned to the caller.
const url=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const writer=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const userClient=(authorization:string)=>createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
const handler=createAgencyHandler({
 allowedOrigins:['http://127.0.0.1:5173','http://localhost:5173'],
 authenticate:({authorization,workspaceId})=>authenticateRequest({authorization,workspaceId},{
  getUser:async token=>{const {data,error}=await writer.auth.getUser(token);return error?null:data.user;},
  getMembership:async(workspaceId,userId)=>{
   const {data,error}=await userClient(authorization).from('seller_os_workspace_members').select('role').eq('workspace_id',workspaceId).eq('user_id',userId).maybeSingle();
   return error?null:data;
  },
 }),
 storeFor:({userId,workspaceId,requestId,authorization})=>createCloudStore({client:userClient(authorization),writer,workspaceId,actorId:userId,requestId}),
 researchFor:({userId,workspaceId})=>researchJobsService({writer,workspaceId,actorId:userId}),
});
Deno.serve(handler);
