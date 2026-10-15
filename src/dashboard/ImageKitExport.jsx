import React,{useEffect,useRef,useState} from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useWorkflow } from '../auth/AuthProvider.jsx';

export default function ImageKitExport({selected}){
 const {client}=useWorkflow();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const running=useRef(null);
 useEffect(()=>()=>{running.current?.abort();},[]);
 const run=async()=>{
  if(running.current||!client)return;
  const controller=new AbortController();running.current=controller;setBusy(true);setMessage('저장된 상품 자료 확인 중');
  try{
   const {exportSavedImageKit}=await import('../export/gptImageKit.js');
   const result=await exportSavedImageKit(client,selected,{signal:controller.signal,onProgress:setMessage});
   controller.signal.throwIfAborted();
   const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/zip'}));
   const link=document.createElement('a');link.href=url;link.download=result.filename;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   setMessage(`ZIP 다운로드 시작 · 원본 ${result.ready}장 정리 / 업로드용 ${result.uploads}장${result.missing?` · 누락 ${result.missing}건: manifest.json 확인`:' · 압축을 풀고 사진을 첨부하세요'}`);
  }catch(error){
   if(!controller.signal.aborted)setMessage(`자료 준비 실패: ${error.message} 로그인·연결 상태를 확인하고 다시 시도하세요.`);
  }finally{
   if(!controller.signal.aborted){running.current=null;setBusy(false);}
  }
 };
 return <section className="image-kit-export" aria-label="GPT 이미지 제작 자료" aria-busy={busy}>
  <button type="button" className="btn btn-ghost review-record-button" disabled={busy||!client} onClick={run}>{busy?<Loader2 size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}{busy?'사진·프롬프트 준비 중':'GPT 이미지 제작 · 자료 다운로드'}</button>
  <p>프롬프트 + 원본 + 업로드용 사진 ZIP<br/>GPT 호출 없음 · 사용권·옵션 검수 필요</p>
  {busy&&<button type="button" className="btn btn-ghost" onClick={()=>{running.current?.abort();running.current=null;setBusy(false);setMessage('취소됨 · 파일은 다운로드하지 않았습니다.');}}>준비 취소</button>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
