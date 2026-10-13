import { normalizeEstimateProfile } from '../domain/discoveryEstimate.js';
export const initialDiscoveryState=()=>({jobs:[],workerOnline:false,worker:null,busy:false,loading:true,fresh:false,message:'서버 조사 기록을 불러옵니다.'});

// One authenticated foreground controller for both main discovery and the review panel.
export function createDiscoveryController({client,localAvailable,onState,onCandidates}) {
 let state=initialDiscoveryState(),active=true,generation=0,polling=null;
 const publish=patch=>{if(active){state={...state,...patch};onState(state);}};
 const poll=()=>{
  if(!active)return Promise.resolve(false);
  if(polling)return polling;
  const captured=generation;
  polling=(async()=>{
   try{
    const [next,rows]=await Promise.all([client.request({action:'researchList'}),client.request({action:'list'})]);
    const worker=localAvailable?await client.localWorker('status').catch(()=>({enabled:false,lastCode:'LOCAL_STATUS_UNAVAILABLE'})):null;
    if(!active||captured!==generation)return false;
    onCandidates(rows);
    publish({...next,worker,loading:false,fresh:true,message:state.loading||state.message.startsWith('조회 실패:')?'서버 조사·후보 기록을 불러왔습니다.':state.message});
    return true;
   }catch(error){if(active&&captured===generation)publish({loading:false,fresh:false,message:`조회 실패: ${error.message}`});return false;}
   finally{polling=null;}
  })();
  return polling;
 };
 const operate=async action=>{
  if(!active||state.busy)return false;
  generation++;publish({busy:true});
  try{
   await action();if(!active)return false;
   if(polling)await polling;
   await poll();return active;
  }catch(error){publish({message:error.message});return false;}
  finally{publish({busy:false});}
 };
 const ensureLocalWorker=async()=>{
  if(localAvailable){const worker=await client.localWorker('status');if(!worker.enabled&&active)publish({worker:await client.localWorker('connect')});}
 };
 const enqueue=(kind,data)=>operate(async()=>{
  if(kind==='search'&&(typeof data.query!=='string'||!data.query.trim()||data.query.trim().length>100))throw new Error('발굴 검색어를 1~100자로 입력하세요.');
  const captured={...data,...(data.estimateProfile?{estimateProfile:normalizeEstimateProfile(data.estimateProfile)}:{})};
  await ensureLocalWorker();if(!active)return;
  await client.request({action:'researchEnqueue',kind,...captured,...(kind==='search'?{query:data.query.trim()}:{})});
  publish({message:'조사 대기열에 저장했습니다. 조건 미충족 상품은 후보로 저장하지 않습니다.'});
 });
 return {poll,start:(query,estimateProfile)=>enqueue('search',{query,...(estimateProfile?{estimateProfile}:{})}),enqueue,
  connect:()=>operate(async()=>{publish({worker:await client.localWorker('connect'),message:'로컬 조사 작업자를 연결했습니다.'});}),
  stop:()=>operate(async()=>{publish({worker:await client.localWorker('stop'),message:'로컬 조사 작업자를 중지했습니다.'});}),
  retry:jobId=>operate(async()=>{await ensureLocalWorker();if(!active)return;await client.request({action:'researchRetry',jobId});publish({message:'재시도를 예약했습니다. 로그인·보안 검증을 먼저 완료하세요.'});}),
  dispose(){active=false;generation++;},
 };
}
