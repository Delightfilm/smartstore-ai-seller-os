import path from 'node:path';
import { randomUUID as uuid } from 'node:crypto';
import { createCommerceReader } from './naverReader.js';
import { createBindingStore } from './bindingStore.js';
import { validateCommerceChannel,commerceFailureCodes } from './snapshot.js';
const fail=(code,status=400)=>Object.assign(new Error(code),{code,status});
const origins=['http://127.0.0.1:5173','http://localhost:5173'];
function readBody(req,signal){
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  const clean=()=>{req.off('data',data);req.off('end',end);req.off('error',error);signal.removeEventListener('abort',abort);};
  const error=()=>{clean();req.pause();reject(fail('INVALID_REQUEST'));};
  const abort=()=>{clean();req.pause();reject(fail('TIMEOUT',408));};
  const data=chunk=>{size+=chunk.length;if(size>65536){clean();req.pause();reject(fail('BODY_TOO_LARGE',413));}else chunks.push(chunk);};
  const end=()=>{clean();try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(fail('INVALID_REQUEST'));}};
  if(signal.aborted)return abort();
  req.on('data',data);req.once('end',end);req.once('error',error);signal.addEventListener('abort',abort,{once:true});
 });
}

export function createCommerceLocalHandler({workspaceId,reader,authorizeOwner,cloud,bindings,configured=true,now=Date.now,randomUUID=uuid,setTimer=setTimeout}){
 let epoch=0,owner=null,pending=null,active=null,lastStart=-Infinity;
 let state={status:configured?'UNVERIFIED':'NOT_CONFIGURED',attemptId:null,channels:[],errorCode:null,snapshot:null};
 const cancel=()=>{epoch++;pending=null;active?.abort();reader.clear();state={...state,status:configured?'UNVERIFIED':'NOT_CONFIGURED',attemptId:null,channels:[],errorCode:null};};
 return async(req,res)=>{
  const entryEpoch=epoch,startedAt=now();let operationEpoch=null,phase=null;
  const controller=new AbortController();const timer=setTimer(()=>controller.abort(),45000);
  const disconnected=()=>{if(!res.writableEnded){controller.abort();if(active===controller)cancel();}};res.once('close',disconnected);
  const reply=(body,status=200)=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',connection:'close'});res.end(JSON.stringify(body));}};
  const check=()=>{if(controller.signal.aborted)throw fail('TIMEOUT',408);};
  const wait=promise=>new Promise((resolve,reject)=>{
   const abort=()=>reject(fail('TIMEOUT',408));
   if(controller.signal.aborted)return abort();
   controller.signal.addEventListener('abort',abort,{once:true});
   Promise.resolve(promise).then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',abort));
  });
  try{
   const origin=req.headers.origin;
   if(!origins.includes(origin)||req.headers.host!==new URL(origin).host)throw fail('ORIGIN_FORBIDDEN',403);
   if(req.method!=='POST')throw fail('POST_ONLY',405);
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fail('JSON_REQUIRED',415);
   if(!/^Bearer [^\s]+$/i.test(req.headers.authorization||''))throw fail('SIGN_IN_REQUIRED',401);
   const input=await readBody(req,controller.signal);
   const keys=input?.action==='confirm'?['action','workspaceId','attemptId','channelNo']:['action','workspaceId'];
   if(!input||Array.isArray(input)||!['status','verify','cancel','confirm'].includes(input.action)||Object.keys(input).length!==keys.length||Object.keys(input).some(k=>!keys.includes(k)))throw fail('INVALID_ACTION_OR_FIELDS');
   if(input.workspaceId!==workspaceId)throw fail('WORKSPACE_FORBIDDEN',403);
   const deadlineAt=startedAt+45000,authorization=req.headers.authorization;
   const identity=await wait(authorizeOwner({authorization,workspaceId,signal:controller.signal}));check();
   if(!identity?.userId)throw fail('SESSION_INVALID',401);
   if(input.action!=='cancel'&&entryEpoch!==epoch)throw fail('CANCELLED',409);
   if(owner!==identity.userId){cancel();owner=identity.userId;state.snapshot=null;}
   state.snapshot=identity.snapshot;
   if(input.action==='cancel'){cancel();return reply(state);}
   if(input.action==='status')return reply(state);
   if(!configured)return reply(state);
   if(active||input.action==='verify'&&now()-lastStart<60000)throw fail('RATE_LIMITED',429);
   const captured=epoch;operationEpoch=captured;active=controller;
   const stillCurrent=()=>{check();if(captured!==epoch||owner!==identity.userId)throw fail('CANCELLED',409);};
   async function publish(report){
    stillCurrent();
    phase='publish';
    try{const snapshot=await wait(cloud.publish({authorization,signal:controller.signal,expectedRevision:identity.snapshot?.revision||0,report}));stillCurrent();state={...state,status:report.status,errorCode:report.errorCode,snapshot};}
    catch(error){stillCurrent();state={...state,status:'SYNC_PENDING',errorCode:report.errorCode};}
   }
   try{
    const binding=await bindings.read();stillCurrent();
    if(input.action==='confirm'){
     if(!pending||pending.attemptId!==input.attemptId||pending.owner!==owner||pending.epoch!==epoch||now()-pending.completedAt>=300000||binding)throw fail('CONFIRMATION_INVALID',409);
     const selected=pending.channels.find(c=>c.channelNo===input.channelNo);if(!selected)throw fail('CONFIRMATION_INVALID',409);
     stillCurrent();await bindings.write(selected,{signal:controller.signal,assertCurrent:stillCurrent});stillCurrent();pending=null;state={...state,attemptId:null,channels:[selected]};
     await publish({status:'VERIFIED',channel:selected,errorCode:null});return reply(state);
    }
    lastStart=now();phase='read';pending=null;state={...state,status:'VERIFYING',attemptId:null,channels:[],errorCode:null};
    try{
     const result=await wait(reader.read({signal:controller.signal,deadlineAt}));stillCurrent();
     const channels=result.channels.map(validateCommerceChannel);
     if(!binding){
      pending={attemptId:randomUUID(),owner,epoch,channels,completedAt:now()};state={...state,status:'CONFIRM_REQUIRED',channels,attemptId:pending.attemptId};
     }else{
      const selected=channels.find(c=>c.channelNo===binding.channelNo);if(!selected)throw fail('CHANNEL_MISMATCH');
      state={...state,channels:[selected]};await publish({status:'VERIFIED',channel:selected,errorCode:null});
     }
    }catch(error){stillCurrent();const errorCode=commerceFailureCodes.includes(error.code)?error.code:'UPSTREAM_INVALID';state={...state,status:'FAILED',errorCode};if(binding)await publish({status:'FAILED',channel:null,errorCode});}
    reply(state);
   }finally{if(active===controller)active=null;}
  }catch(error){
   if(controller.signal.aborted&&operationEpoch!==null&&operationEpoch===epoch){state={...state,status:phase==='publish'?'SYNC_PENDING':'FAILED',errorCode:'TIMEOUT',attemptId:null,channels:[]};pending=null;reader.clear();}
   const code=controller.signal.aborted?'TIMEOUT':error.code||'COMMERCE_LOCAL_FAILED';
   reply({error:code},controller.signal.aborted?408:error.status||400);
  }
  finally{clearTimeout(timer);res.removeListener('close',disconnected);}
 };
}

export function commerceLocalPlugin({workspaceId,clientId,clientSecret,supabaseUrl,publishableKey}){
 const configured=!!clientId&&!!clientSecret;
 const reader=createCommerceReader({clientId,clientSecret});
 const bindings=createBindingStore({path:path.resolve('.seller-os/commerce-binding.json'),workspaceId});
 async function call({authorization,signal,...input}){
  const response=await fetch(`${supabaseUrl}/functions/v1/seller-os-agency`,{method:'POST',redirect:'error',signal,headers:{origin:origins[0],'content-type':'application/json',authorization,apikey:publishableKey},body:JSON.stringify({...input,workspaceId})});
  const result=await response.json();if(!response.ok)throw fail(['SIGN_IN_REQUIRED','SESSION_INVALID','WORKSPACE_FORBIDDEN','COMMERCE_REVISION_CONFLICT'].includes(result.error)?result.error:'COMMERCE_CLOUD_FAILED',response.status);return result;
 }
 const handler=createCommerceLocalHandler({workspaceId,configured,reader,bindings,authorizeOwner:async args=>{const result=await call({...args,action:'commerceRead'});return {userId:result.actorId,snapshot:result.snapshot};},cloud:{publish:args=>call({...args,action:'commercePublish'})}});
 return {name:'seller-os-commerce-local',configureServer(server){server.middlewares.use('/api/commerce-local',handler);server.httpServer?.once('close',()=>reader.clear());}};
}
