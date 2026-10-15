import bcrypt from 'bcryptjs';

const BASE='https://api.commerce.naver.com/external/v1';
const fail=code=>Object.assign(new Error(code),{code});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!/[\x00-\x1f<>]/.test(x);

// The current official schema is a single channel object. Normalize a bounded
// list as well, without guessing envelopes or accepting unrecognized channel types.
export function normalizeChannels(raw){
 const items=Array.isArray(raw)?raw:[raw];
 if(!items.length||items.length>20)throw fail('UPSTREAM_INVALID');
 const seen=new Set();
 return items.map(c=>{
  if(!object(c)||c.channelType!=='STOREFARM'||!text(c.name))throw fail('UPSTREAM_INVALID');
  const id=typeof c.channelNo==='number'&&Number.isSafeInteger(c.channelNo)?String(c.channelNo):c.channelNo;
  if(typeof id!=='string'||!/^\d{1,32}$/.test(id)||/^0+$/.test(id)||seen.has(id))throw fail('UPSTREAM_INVALID');
  let url;try{url=new URL(c.url);}catch{throw fail('UPSTREAM_INVALID');}
  if(url.protocol!=='https:'||!['smartstore.naver.com','brand.naver.com'].includes(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname==='/')throw fail('UPSTREAM_INVALID');
  seen.add(id);return {channelNo:id,name:c.name,url:url.href};
 });
}

export function createCommerceReader({clientId,clientSecret,fetchImpl=fetch,now=Date.now}){
 let cached=null,epoch=0;
 function clear(){cached=null;epoch++;}
 async function read({signal,deadlineAt=now()+45000}={}){
  const generation=epoch,deadline=Math.min(deadlineAt,now()+45000);let reauthenticated=false;
  const check=()=>{if(signal?.aborted||generation!==epoch||now()>=deadline)throw fail('TIMEOUT');};
  async function request(path,method,body,token){
   check();const controller=new AbortController();const stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});
   let timer;const timedOut=new Promise((_,reject)=>{
    controller.signal.addEventListener('abort',()=>reject(fail('TIMEOUT')),{once:true});
    timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(20000,deadline-now())));
   });
   try{
    return await Promise.race([timedOut,(async()=>{
     const response=await fetchImpl(BASE+path,{method,body,signal:controller.signal,redirect:'error',headers:token?{authorization:`Bearer ${token}`}:{'content-type':'application/x-www-form-urlencoded'}});
     check();if(response.status>=300&&response.status<400)throw fail('UPSTREAM_INVALID');
     if(Number(response.headers.get('content-length'))>65536)throw fail('UPSTREAM_INVALID');
     const reader=response.body?.getReader();if(!reader)throw fail('UPSTREAM_INVALID');
     let size=0;const chunks=[];
     try{while(true){check();const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw fail('UPSTREAM_INVALID');chunks.push(value);}}
     finally{if(controller.signal.aborted||size>65536)reader.cancel().catch(()=>{});}
     check();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('UPSTREAM_INVALID');}
     if(!response.ok){
      const code=response.status===429?'RATE_LIMITED':response.status===401?'AUTH_FAILED':response.status===403?(data?.code==='GW.AUTHN.IP'?'IP_REJECTED':'FORBIDDEN'):'UPSTREAM_INVALID';
      throw Object.assign(fail(code),{unauthorized:response.status===401});
     }
     return data;
    })()]);
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);controller.abort();}
  }
  async function token(){
   check();if(cached&&now()<cached.until)return cached.value;
   if(!text(clientId)||typeof clientSecret!=='string')throw fail('AUTH_FAILED');
   const timestamp=String(now());let signature;
   try{signature=Buffer.from(await bcrypt.hash(`${clientId}_${timestamp}`,clientSecret)).toString('base64');}catch{throw fail('AUTH_FAILED');}
   check();const data=await request('/oauth2/token','POST',new URLSearchParams({client_id:clientId,timestamp,client_secret_sign:signature,grant_type:'client_credentials',type:'SELF'}));
   check();if(!object(data)||typeof data.access_token!=='string'||!data.access_token||data.access_token.length>8192||/\s/.test(data.access_token)||!/^Bearer$/i.test(data.token_type)||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw fail('UPSTREAM_INVALID');
   const lifetime=data.expires_in*1000;cached={value:data.access_token,until:now()+lifetime-Math.min(60000,lifetime/2)};return cached.value;
  }
  async function get(path){
   try{return await request(path,'GET',undefined,await token());}
   catch(error){if(!error.unauthorized||reauthenticated)throw error;reauthenticated=true;cached=null;check();return request(path,'GET',undefined,await token());}
  }
  try{
   const account=await get('/seller/account');
   if(!object(account)||!text(account.accountId)||!text(account.accountUid))throw fail('UPSTREAM_INVALID');
   check();return {channels:normalizeChannels(await get('/seller/channels'))};
  }catch(error){throw fail(['IP_REJECTED','AUTH_FAILED','FORBIDDEN','RATE_LIMITED','TIMEOUT','UPSTREAM_INVALID'].includes(error.code)?error.code:'UPSTREAM_INVALID');}
 }
 return {read,clear};
}
