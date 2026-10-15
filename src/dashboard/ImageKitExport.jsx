import React,{useEffect,useRef,useState} from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { useWorkflow } from '../auth/AuthProvider.jsx';

export default function ImageKitExport({selected}){
 const {client}=useWorkflow();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[request,setRequest]=useState('');
 const running=useRef(null);
 useEffect(()=>()=>{running.current?.abort();},[]);
 const run=async()=>{
  if(running.current||!client)return;
  const controller=new AbortController();running.current=controller;setBusy(true);setMessage('저장된 상품 자료 확인 중');
  try{
   const {exportSavedImageKit}=await import('../export/gptImageKit.js');
   const result=await exportSavedImageKit(client,selected,{signal:controller.signal,onProgress:setMessage});
   controller.signal.throwIfAborted();
   setRequest(result.request);
   const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/zip'}));
   const link=document.createElement('a');link.href=url;link.download=result.filename;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   setMessage(`가이드 v2 ZIP 다운로드 시작 · 원본 ${result.ready}장 / 업로드용 ${result.uploads}장${result.missing?` · 누락 ${result.missing}건: manifest.json 확인`:' · 요청문과 ZIP을 함께 ChatGPT에 전달하세요'}`);
  }catch(error){
   if(!controller.signal.aborted)setMessage(`자료 준비 실패: ${error.message} 로그인·연결 상태를 확인하고 다시 시도하세요.`);
  }finally{
   if(!controller.signal.aborted){running.current=null;setBusy(false);}
  }
 };
 const copyRequest=async()=>{
  if(running.current||!client)return;
  const controller=new AbortController();running.current=controller;setBusy(true);setMessage('저장된 상품의 제작 요청문 확인 중');setRequest('');
  try{
   const {exportSavedKitRequest}=await import('../export/gptImageKit.js');
   const value=await exportSavedKitRequest(client,selected,{signal:controller.signal});
   controller.signal.throwIfAborted();setRequest(value);
   try{
    await navigator.clipboard.writeText(value);controller.signal.throwIfAborted();
    setMessage('제작 요청문 복사 완료 · ChatGPT 새 대화에 붙여넣고 가이드 v2 ZIP과 사진을 첨부하세요.');
   }catch{
    if(!controller.signal.aborted)setMessage('자동 복사가 허용되지 않았습니다. 아래 제작 요청문을 펼쳐 직접 복사하세요.');
   }
  }catch(error){if(!controller.signal.aborted)setMessage(`요청문 준비 실패: ${error.message}`);}
  finally{if(!controller.signal.aborted){running.current=null;setBusy(false);}}
 };
 return <section className="image-kit-export" aria-label="GPT 이미지 제작 자료" aria-busy={busy}>
  <button type="button" className="btn btn-ghost review-record-button" disabled={busy||!client} onClick={run}>{busy?<Loader2 size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}{busy?'사진·프롬프트 준비 중':'GPT 이미지 제작 · 자료 다운로드'}</button>
  <button type="button" className="btn btn-ghost review-record-button image-kit-copy" disabled={busy||!client} onClick={copyRequest}><Copy size={16} aria-hidden="true"/>ChatGPT 제작 요청문 복사</button>
  <p>가이드 v2 · 전체 8~12패널 기획 + 사진·옵션 매칭 + 검수표<br/>요청문을 붙여넣고 ZIP을 첨부하세요. ZIP만으로 자동 실행되지 않습니다.<br/>GPT 호출 없음 · 사용권·옵션 검수 필요</p>
  {busy&&<button type="button" className="btn btn-ghost" onClick={()=>{running.current?.abort();running.current=null;setBusy(false);setMessage('취소됨 · 파일은 다운로드하지 않았습니다.');}}>준비 취소</button>}
  {message&&<p role="status">{message}</p>}
  {request&&<details className="image-kit-request"><summary>제작 요청문 보기·직접 복사</summary><label>ChatGPT에 붙여넣을 제작 요청문<textarea className="inp" readOnly rows={6} value={request}/></label></details>}
 </section>;
}
