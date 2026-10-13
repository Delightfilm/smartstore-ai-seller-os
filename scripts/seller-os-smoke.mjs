const base=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!base||!key)throw new Error('Public project configuration required');
const endpoint=base+'/functions/v1/seller-os-agency';
for(const [name,headers] of [
 ['anonymous',{}],['forged bearer',{authorization:'Bearer invalid-token'}],
]){
 const response=await fetch(endpoint,{method:'POST',headers:{origin:'http://127.0.0.1:5173',apikey:key,'content-type':'application/json',...headers},body:JSON.stringify({action:'list',workspaceId:process.env.VITE_SELLER_OS_WORKSPACE_ID})});
 console.log(JSON.stringify({name,status:response.status}));
 if(response.status!==401)throw new Error('Unauthenticated request was not rejected');
}
const preflight=await fetch(endpoint,{method:'OPTIONS',headers:{origin:'http://127.0.0.1:5173','access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type'}});
console.log(JSON.stringify({name:'preflight',status:preflight.status,origin:preflight.headers.get('access-control-allow-origin')}));
if(preflight.status!==204||preflight.headers.get('access-control-allow-origin')!=='http://127.0.0.1:5173')throw new Error('Preflight failed');
