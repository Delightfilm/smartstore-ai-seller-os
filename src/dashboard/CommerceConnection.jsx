import React,{useEffect,useRef,useState} from 'react';
import { useWorkflow } from '../auth/AuthProvider.jsx';
import { commerceConnectionView } from './commerceConnectionState.js';
const labels={UNVERIFIED:'아직 인증·조회하지 않음',NOT_CONFIGURED:'로컬 비밀 설정 필요',VERIFYING:'인증·조회 중',CONFIRM_REQUIRED:'최초 스토어 확인 필요',VERIFIED:'최근 인증·조회 확인',STALE:'오래된 확인 (15분 경과)',FAILED:'최근 시도 실패',SYNC_PENDING:'동기화 미완료'};
const errors={IP_REJECTED:'호출 IP 거절',AUTH_FAILED:'인증 실패',FORBIDDEN:'권한 부족',RATE_LIMITED:'호출 제한',TIMEOUT:'시간 초과',UPSTREAM_INVALID:'응답 확인 필요',CHANNEL_MISMATCH:'결합된 스토어와 불일치'};
const date=value=>value?new Date(value).toLocaleString('ko-KR'):'없음';
export default function CommerceConnection(){
 const workflow=useWorkflow();const client=workflow?.client,userId=workflow?.user?.id;
 const localAvailable=import.meta.env.DEV&&['http://127.0.0.1:5173','http://localhost:5173'].includes(globalThis.location?.origin);
 const [snapshot,setSnapshot]=useState(null),[localState,setLocalState]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const epoch=useRef(0);
 async function refresh(){
  const captured=epoch.current;setBusy(true);setMessage('');
  try{const result=await client.commerceRead();if(captured!==epoch.current)return;setSnapshot(result.snapshot);
   if(localAvailable){const local=await client.commerceLocal('status');if(captured===epoch.current)setLocalState(local);}
  }catch(e){if(captured===epoch.current)setMessage(e.message);}finally{if(captured===epoch.current)setBusy(false);}
 }
 useEffect(()=>{epoch.current++;setSnapshot(null);setLocalState(null);setBusy(false);setMessage('');if(client&&userId)refresh();return()=>{epoch.current++;};},[client,userId]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]); // clock only, no API polling
 async function run(action,confirmation){
  const captured=epoch.current;setBusy(true);setMessage('');
  try{const result=await client.commerceLocal(action,confirmation);if(captured!==epoch.current)return;setLocalState(result);setSnapshot(result.snapshot);}
  catch(e){if(captured===epoch.current){setMessage(e.message);setLocalState(previous=>({...previous,status:'FAILED',errorCode:errors[e.code]?e.code:e.name==='AbortError'?'TIMEOUT':'UPSTREAM_INVALID'}));}}finally{if(captured===epoch.current)setBusy(false);}
 }
 const view=commerceConnectionView({snapshot,localState,localAvailable,now});const channel=snapshot?.channel;
 return <div style={{padding:'12px 0',borderBottom:'1px solid var(--line)'}}>
  <div className="flex items-center justify-between" style={{gap:12,flexWrap:'wrap'}}>
   <div><div style={{fontSize:13,fontWeight:500}}>네이버 커머스 API</div><div className="t3" style={{fontSize:11.5,marginTop:4}}>{labels[view.status]}</div></div>
   <div className="flex items-center" style={{gap:8,flexWrap:'wrap'}}>
    <button className="btn btn-sm" disabled={busy||!userId} onClick={refresh}>저장 결과 새로고침</button>
    {localAvailable&&<button className="btn btn-sm" disabled={busy||!userId||view.status==='NOT_CONFIGURED'} onClick={()=>run('verify')}>인증·조회 확인</button>}
    {localAvailable&&busy&&<button className="btn btn-sm" onClick={()=>run('cancel')}>조회 취소</button>}
   </div>
  </div>
  {channel&&<div style={{fontSize:12,marginTop:10}}>{channel.name} · 채널 {channel.channelNo} · <a href={channel.url} target="_blank" rel="noreferrer">스토어 보기</a></div>}
  {localAvailable&&localState?.status==='CONFIRM_REQUIRED'&&<div style={{marginTop:12,fontSize:12}}>
   <p>실제 운영 스토어와 이름·채널 번호·주소를 대조한 뒤 확인하세요. 아직 연결 완료로 저장되지 않았습니다.</p>
   {localState.channels.map(c=><div key={c.channelNo} style={{marginTop:8}}>{c.name} · {c.channelNo} · <a href={c.url} target="_blank" rel="noreferrer">{c.url}</a> <button className="btn btn-sm" disabled={busy} onClick={()=>run('confirm',{attemptId:localState.attemptId,channelNo:c.channelNo})}>이 스토어가 맞습니다</button></div>)}
  </div>}
  <div className="t3" style={{fontSize:11.5,marginTop:10,lineHeight:1.7}}>
   {errors[localAvailable?localState?.errorCode||snapshot?.errorCode:snapshot?.errorCode]||''}<br/>
   마지막 시도: {date(snapshot?.attemptedAt)} · 성공: {date(snapshot?.succeededAt)}<br/>
   서버 수신: {date(snapshot?.receivedAt)} · revision {snapshot?.revision??'—'}<br/>
   LOCAL_WORKER_REPORTED · {view.notice}<br/>상품 등록·수정 및 주문·배송 기능은 활성화하지 않습니다.
  </div>
  {message&&<div role="alert" style={{fontSize:12,color:'var(--neg)',marginTop:8}}>{message}</div>}
 </div>;
}
