import test from 'node:test';
import assert from 'node:assert/strict';
const enabled=process.env.SELLER_OS_COMMERCE_LIVE_TEST==='1';
const base=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,workspaceId=process.env.VITE_SELLER_OS_WORKSPACE_ID,token=process.env.SELLER_OS_TEST_TOKEN;
function endpoint(){const url=new URL(base);assert.match(url.hostname,/^[a-z0-9]{20}\.supabase\.co$/);assert.equal(url.protocol,'https:');return url.origin;}
const headers=authorization=>({apikey:key,'content-type':'application/json',origin:'http://127.0.0.1:5173',...(authorization?{authorization}:{})});
const invoke=(body,authorization)=>fetch(endpoint()+'/functions/v1/seller-os-agency',{method:'POST',headers:headers(authorization),body:JSON.stringify({...body,workspaceId:body.workspaceId||workspaceId})});
test('live Commerce Edge denies absent and forged JWT',{skip:!enabled},async()=>{
 for(const authorization of [null,'Bearer invalid-token'])assert.equal((await invoke({action:'commerceRead'},authorization)).status,401);
});
test('live new table and publisher deny anonymous direct access',{skip:!enabled},async()=>{
 const table=await fetch(endpoint()+'/rest/v1/seller_os_commerce_connections?select=workspace_id',{headers:headers(null)});assert.ok([401,403].includes(table.status));
 const rpc=await fetch(endpoint()+'/rest/v1/rpc/seller_os_publish_commerce_connection',{method:'POST',headers:headers(null),body:JSON.stringify({p_workspace_id:workspaceId,p_actor_id:'00000000-0000-4000-8000-000000000000',p_expected_revision:0,p_report:{status:'FAILED',channel:null,errorCode:'AUTH_FAILED'}})});assert.ok([401,403,404].includes(rpc.status));
});
test('live owner reads snapshot and unowned workspace is rejected',{skip:!enabled||!token},async()=>{
 const own=await invoke({action:'commerceRead'},`Bearer ${token}`);assert.equal(own.status,200);const value=await own.json();assert.ok(value.actorId);assert.ok('snapshot' in value);
 assert.equal((await invoke({action:'commerceRead',workspaceId:'00000000-0000-4000-8000-000000000091'},`Bearer ${token}`)).status,403);
});
test('live authenticated direct writes and direct RPC are denied',{skip:!enabled||!token},async()=>{
 const h=headers(`Bearer ${token}`);
 for(const method of ['POST','PATCH','DELETE']){const r=await fetch(endpoint()+'/rest/v1/seller_os_commerce_connections?workspace_id=eq.'+workspaceId,{method,headers:h,...(method!=='DELETE'?{body:JSON.stringify({workspace_id:workspaceId})}:{})});assert.ok([401,403].includes(r.status));}
 const r=await fetch(endpoint()+'/rest/v1/rpc/seller_os_publish_commerce_connection',{method:'POST',headers:h,body:JSON.stringify({p_workspace_id:workspaceId,p_actor_id:'00000000-0000-4000-8000-000000000000',p_expected_revision:0,p_report:{status:'FAILED',channel:null,errorCode:'AUTH_FAILED'}})});assert.ok([401,403,404].includes(r.status));
});
