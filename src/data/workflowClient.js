export function createWorkflowClient({config,workspaceId,getAccessToken,fetchImpl=fetch}){
 let generation=0;
 const pending=new Map();
 return {
  invalidate(){generation++;pending.clear();},
  async request(input){
   const captured=generation;
   const token=config.mode==='cloud'?await getAccessToken():null;
   if(config.mode==='cloud'&&!token)throw Object.assign(new Error('로그인이 필요합니다.'),{code:'SIGN_IN_REQUIRED'});
   if(generation!==captured)throw Object.assign(new Error('로그인 상태가 변경됐습니다.'),{code:'SESSION_CHANGED'});
   const signature=JSON.stringify(input);
   const requestId=input.action==='update'?(pending.get(signature)||crypto.randomUUID()):undefined;
   if(requestId)pending.set(signature,requestId);
   const body=config.mode==='cloud'?{...input,workspaceId,...(requestId?{requestId}:{})}:input;
   const response=await fetchImpl(config.mode==='cloud'?`${config.url}/functions/v1/seller-os-agency`:'/api/agency',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`,apikey:config.publishableKey}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
   const result=await response.json();
   if(generation!==captured)throw Object.assign(new Error('로그인 상태가 변경됐습니다.'),{code:'SESSION_CHANGED'});
   if(!response.ok)throw Object.assign(new Error(result.message||result.error||'요청 실패'),{code:result.error,status:response.status});
   pending.delete(signature);return result;
  }
 };
}
