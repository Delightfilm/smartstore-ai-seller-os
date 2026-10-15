export function createWorkflowClient({config,workspaceId,getAccessToken,fetchImpl=fetch,applicationOrigin=globalThis.location?.origin,localDevelopment=import.meta.env?.DEV===true}){
 let generation=0;
 const pending=new Map();
 const commerceRequests=new Set();
 return {
  invalidate(){generation++;pending.clear();for(const controller of commerceRequests)controller.abort();commerceRequests.clear();},
  commerceRead(){return this.request({action:'commerceRead'});},
  async commerceLocal(action,confirmation){
   if(config.mode!=='cloud'||!localDevelopment||!['http://127.0.0.1:5173','http://localhost:5173'].includes(applicationOrigin))throw Object.assign(new Error('커머스 인증·조회는 이 PC의 로컬 개발 대시보드에서만 가능합니다.'),{code:'COMMERCE_LOCAL_UNAVAILABLE'});
   if(!['status','verify','cancel','confirm'].includes(action)||action==='confirm'&&(!confirmation||Object.keys(confirmation).sort().join(',')!=='attemptId,channelNo'||typeof confirmation.attemptId!=='string'||typeof confirmation.channelNo!=='string')||action!=='confirm'&&confirmation!==undefined)throw new Error('잘못된 커머스 요청입니다.');
   const captured=generation,token=await getAccessToken();
   if(!token)throw Object.assign(new Error('로그인이 필요합니다.'),{code:'SIGN_IN_REQUIRED'});
   // Cancellation deliberately uses the captured old session, even if logout
   // invalidated normal requests while getAccessToken was resolving.
   if(action!=='cancel'&&generation!==captured)throw Object.assign(new Error('로그인 상태가 변경됐습니다.'),{code:'SESSION_CHANGED'});
   const controller=new AbortController();if(action!=='cancel')commerceRequests.add(controller);
   const timer=setTimeout(()=>controller.abort(),50000);
   try{
    const response=await fetchImpl('/api/commerce-local',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({action,workspaceId,...(confirmation||{})}),signal:controller.signal});
    const result=await response.json();
    if(action!=='cancel'&&generation!==captured)throw Object.assign(new Error('로그인 상태가 변경됐습니다.'),{code:'SESSION_CHANGED'});
    if(!response.ok)throw Object.assign(new Error('로컬 커머스 확인 실패: '+(result.error||'UNKNOWN')),{code:result.error,status:response.status});
    return result;
   }finally{clearTimeout(timer);commerceRequests.delete(controller);}
  },
  async localWorker(action){
   if(config.mode!=='cloud')throw new Error('클라우드 모드에서 연결하세요.');
   if(!['http://127.0.0.1:5173','http://localhost:5173'].includes(applicationOrigin))throw Object.assign(new Error('PC 조사 작업자는 이 PC의 로컬 대시보드에서만 연결할 수 있습니다. 외부 화면에서는 저장된 조사 결과를 확인하세요.'),{code:'LOCAL_WORKER_UNAVAILABLE'});
   const captured=generation,token=await getAccessToken();
   if(!token||generation!==captured)throw new Error('로그인이 필요합니다.');
   const response=await fetchImpl('/api/research-worker',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({action}),signal:AbortSignal.timeout(40000)});
   const result=await response.json();
   if(generation!==captured)throw new Error('로그인 상태가 변경됐습니다.');
   if(!response.ok)throw new Error(result.message||result.error||'로컬 작업자 연결 실패');
   return result;
  },
  async request(input){
   const captured=generation;
   const token=config.mode==='cloud'?await getAccessToken():null;
   if(config.mode==='cloud'&&!token)throw Object.assign(new Error('로그인이 필요합니다.'),{code:'SIGN_IN_REQUIRED'});
   if(generation!==captured)throw Object.assign(new Error('로그인 상태가 변경됐습니다.'),{code:'SESSION_CHANGED'});
   const signature=JSON.stringify(input);
   const requestId=['update','researchEnqueue'].includes(input.action)?(pending.get(signature)||crypto.randomUUID()):undefined;
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
