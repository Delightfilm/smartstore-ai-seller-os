import test from 'node:test';
import assert from 'node:assert/strict';
const enabled=process.env.SELLER_OS_LIVE_TEST==='1';
const base=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,workspaceId=process.env.VITE_SELLER_OS_WORKSPACE_ID;
const token=process.env.SELLER_OS_TEST_TOKEN;
const publicOrigin=process.env.SELLER_OS_PUBLIC_ORIGIN;
const publicEnabled=enabled&&!!publicOrigin;
function endpoint(){
 const url=new URL(base);
 assert.match(url.hostname,/^[a-z0-9]{20}\.supabase\.co$/);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');
 return url.origin+'/functions/v1/seller-os-agency';
}
const invoke=(body,authorization)=>fetch(endpoint(),{method:'POST',headers:{origin:'http://127.0.0.1:5173',apikey:key,'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(body)});
const preflight=origin=>fetch(endpoint(),{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type'}});
test('live API denies anonymous and forged bearer credentials',{skip:!enabled?'opt-in live project check':false},async()=>{
 for(const authorization of [null,'Bearer invalid-token'])assert.equal((await invoke({action:'list',workspaceId},authorization)).status,401);
});
test('live API preflight retains the configured local application origin',{skip:!enabled?'opt-in live project check':false},async()=>{
 const response=await fetch(endpoint(),{method:'OPTIONS',headers:{origin:'http://127.0.0.1:5173','access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type'}});
 assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'http://127.0.0.1:5173');
});

test('live API preflight accepts the deployed external dashboard exact origin',{skip:!publicEnabled?'requires opt-in live external origin':false},async()=>{
 assert.match(publicOrigin,/^https:\/\/[a-z0-9-]+\.pages\.dev$/);
 const response=await preflight(publicOrigin);
 assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),publicOrigin);
});

test('live API denies foreign and lookalike external preflight origins',{skip:!publicEnabled?'requires opt-in live external origin':false},async()=>{
 for(const origin of ['https://unapproved-seller.pages.dev',`${publicOrigin}.evil.example`,publicOrigin.replace('https:','http:')]){
  const response=await preflight(origin);assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);
 }
});

test('live external dashboard origin does not authorize anonymous or forged credentials',{skip:!publicEnabled?'requires opt-in live external origin':false},async()=>{
 for(const authorization of [null,'Bearer invalid-token']){
  const response=await fetch(endpoint(),{method:'POST',headers:{origin:publicOrigin,apikey:key,'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify({action:'list',workspaceId})});
  assert.equal(response.status,401);
 }
});
test('live user JWT reads P2013 and is denied access to an unowned workspace',{skip:!enabled||!token?'requires separately provided live user JWT':false},async()=>{
 const member=await invoke({action:'list',workspaceId},`Bearer ${token}`);assert.equal(member.status,200);assert.ok((await member.json()).some(c=>c.id==='816692570613'));
 const other=await invoke({action:'list',workspaceId:'00000000-0000-4000-8000-000000000091'},`Bearer ${token}`);assert.equal(other.status,403);
});
