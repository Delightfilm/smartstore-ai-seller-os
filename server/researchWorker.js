import { randomUUID } from 'node:crypto';
import { collect1688FromBrowser } from './collect1688.js';
import { search1688Products } from './browserSearch.js';
import { checkAgencyRequest } from './agencyWorkflow.js';

const humanCodes=new Set(['BROWSER_VERIFY_REQUIRED','HUMAN_REQUIRED','BROWSER_NOT_READY','SIGN_IN_REQUIRED']);
export function createResearchWorker({call,collect=collect1688FromBrowser,search=search1688Products,now=Date.now}) {
  const workerId=randomUUID();
  let token=null,updated=0,enabled=false,busy=false,epoch=0,current=null,lastCode=null,failures=0;
  const request=(action,data={})=>call({action,workerId,...data},token);
  const status=()=>({enabled,busy,currentJobId:current?.id||null,lastCode,mode:'FOREGROUND_LOCAL_CDP'});
  const stop=async()=>{enabled=false;epoch++;try{if(token)await request('workerStop');}finally{token=null;current=null;}return status();};
  const connect=async nextToken=>{
    token=nextToken;updated=now();
    try{await request('workerConnect');enabled=true;lastCode=null;failures=0;}catch(e){token=null;enabled=false;throw e;}
    return status();
  };
  const renew=async nextToken=>{
    if(!enabled)return status();
    await call({action:'workerHeartbeat',workerId,...(current?{leaseId:current.lease_id}:{})},nextToken);
    token=nextToken;updated=now();return status();
  };
  async function tick(){
    if(!enabled||busy)return;
    if(now()-updated>90000){lastCode='DASHBOARD_OFFLINE';await stop().catch(()=>{});return;}
    busy=true;const activeEpoch=epoch;
    try{
      current=await request('workerClaim');if(!current)return;
      if(!enabled||epoch!==activeEpoch)return;
      const job=current;
      let payload;
      try{
        let output;
        for(let attempt=0;attempt<3;attempt++) {
          if(!enabled||epoch!==activeEpoch)return;
          try{output=job.kind==='search'?await search(job.input.query):await collect({url:job.input.url});break;}
          catch(e){if(humanCodes.has(e.code)||e.code==='SIGN_IN_REQUIRED'||attempt===2||!/Timeout|ECONNRESET|ETIMEDOUT/.test(e.name+' '+e.code))throw e;}
        }
        payload=job.kind==='search'?{kind:'search',observedAt:output.observedAt,offers:output.offers.slice(0,3).map(o=>({url:o.url,cardMoq:o.cardMoq??null}))}:{kind:'refresh',observation:output.researchRaw};
        if(!payload.observation&&job.kind==='refresh')throw Object.assign(new Error('Unsupported observation'),{code:'READ_FAILED'});
        if(Buffer.byteLength(JSON.stringify(payload))>60000)throw Object.assign(new Error('Result too large'),{code:'RESULT_TOO_LARGE'});
      }catch(e){
        if(!enabled||epoch!==activeEpoch)return;
        lastCode=e.code||'READ_FAILED';
        failures++;
        await request('workerFail',{jobId:job.id,leaseId:job.lease_id,code:lastCode});
        if(humanCodes.has(lastCode)||failures>=3)await stop();
        return;
      }
      if(!enabled||epoch!==activeEpoch)return;
      for(let attempt=0;attempt<3;attempt++) {
        try{await request('workerComplete',{jobId:job.id,leaseId:job.lease_id,...payload});break;}
        catch(e){
          if(e.status===400){
            // An explicit rejected completion did not commit. Store a bounded failure
            // using the same lease; unknown transport outcomes still replay unchanged.
            const code=e.code==='RESULT_TOO_LARGE'?'RESULT_TOO_LARGE':'RESULT_REJECTED';
            await request('workerFail',{jobId:job.id,leaseId:job.lease_id,code});
            lastCode=code;failures++;if(failures>=3)await stop();return;
          }
          if(attempt===2||e.status)throw e;
        }
      }
      lastCode=null;failures=0;
    }catch(e){lastCode=e.code||'WORKER_ERROR';failures++;if(e.status===401||e.status===403){enabled=false;epoch++;token=null;}else if(failures>=3)await stop().catch(()=>{});}
    finally{current=null;busy=false;}
  }
  async function heartbeat(){
    if(!enabled)return;
    if(now()-updated>90000){lastCode='DASHBOARD_OFFLINE';await stop().catch(()=>{});return;}
    try{await request('workerHeartbeat',current?{leaseId:current.lease_id}:{});}catch(e){lastCode=e.code||'HEARTBEAT_FAILED';if(e.status===401||e.status===403){enabled=false;epoch++;token=null;}}
  }
  return {status,connect,renew,stop,tick,heartbeat};
}

export function researchWorkerPlugin(config) {
  const call=async(input,token)=>{
    if(typeof token!=='string'||!token)throw Object.assign(new Error('로그인이 필요합니다.'),{code:'SIGN_IN_REQUIRED',status:401});
    const response=await fetch(`${config.url}/functions/v1/seller-os-agency`,{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:5173',authorization:`Bearer ${token}`,apikey:config.publishableKey},body:JSON.stringify({...input,workspaceId:config.workspaceId}),signal:AbortSignal.timeout(30000)});
    const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'WORKER_ERROR'),{code:result.error,status:response.status});return result;
  };
  const worker=createResearchWorker({call});
  return {name:'seller-os-authenticated-research-worker',configureServer(server){
    const poll=setInterval(()=>void worker.tick(),5000),beat=setInterval(()=>void worker.heartbeat(),25000);
    server.httpServer?.once('close',()=>{clearInterval(poll);clearInterval(beat);void worker.stop().catch(()=>{});});
    server.middlewares.use('/api/research-worker',async(req,res)=>{
      res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');
      try{
        if(req.method!=='POST')throw Object.assign(new Error('POST_ONLY'),{status:405});
        checkAgencyRequest(req.headers);
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048)throw new Error('BODY_TOO_LARGE');chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString());
        if(!input||Object.keys(input).some(k=>k!=='action')||!['connect','status','stop'].includes(input.action))throw new Error('INVALID_ACTION');
        const authorization=String(req.headers.authorization||'');if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('SIGN_IN_REQUIRED'),{status:401});
        const token=authorization.slice(7);
        await call({action:'researchList'},token);
        const result=input.action==='connect'?await worker.connect(token):input.action==='stop'?await worker.stop():await worker.renew(token);
        res.end(JSON.stringify(result));
      }catch(e){res.statusCode=e.status||400;res.end(JSON.stringify({error:e.code||'LOCAL_WORKER_ERROR',message:e.code||String(e.message).slice(0,120)}));}
    });
  }};
}
