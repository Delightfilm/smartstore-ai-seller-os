import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import { createClient } from '@supabase/supabase-js';
import { resolveWorkflowConfig } from '../data/workflowConfig.js';
import { createWorkflowClient } from '../data/workflowClient.js';
import { summarizeCandidates } from '../dashboard/operatingSummary.js';
import { emailVerificationInput } from './emailSignIn.js';
import { createRecordUpdater } from '../data/recordUpdates.js';
const Context=createContext(null);
export const useWorkflow=()=>useContext(Context);
export function AuthProvider({children}){
 const setup=useMemo(()=>{try{const config=resolveWorkflowConfig(import.meta.env);if(config.mode==='cloud'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(import.meta.env.VITE_SELLER_OS_WORKSPACE_ID||''))throw new Error('Seller OS 공간 ID가 필요합니다.');return {config};}catch(error){return {error:error.message};}},[]);
 const config=setup.config;
 const supabase=useMemo(()=>config?.mode==='cloud'?createClient(config.url,config.publishableKey,{auth:{storageKey:'seller-os-auth-v1',detectSessionInUrl:false}}):null,[config]);
 const session=useRef(null);
 const [status,setStatus]=useState(config?.mode==='local'?'local':'loading');
 const [user,setUser]=useState(null),[error,setError]=useState(setup.error||''),[records,setRecords]=useState([]);
 const [recordsLoaded,setRecordsLoaded]=useState(false);
 const recordUpdater=useRef(null);if(!recordUpdater.current)recordUpdater.current=createRecordUpdater(rows=>{setRecords(rows);setRecordsLoaded(true);});
 const publishRecords=recordUpdater.current.publish;
 const client=useMemo(()=>config?createWorkflowClient({config,workspaceId:import.meta.env.VITE_SELLER_OS_WORKSPACE_ID,getAccessToken:async()=>session.current?.access_token}):null,[config]);
 useEffect(()=>{
  if(!supabase)return;
  let active=true,revision=0;
  const apply=s=>{const changed=session.current?.user?.id!==s?.user?.id;session.current=s;if(changed){client.invalidate();publishRecords([]);setRecordsLoaded(false);setError('');}setUser(s?.user||null);setStatus(s?'signedIn':'signedOut');};
  const {data}=supabase.auth.onAuthStateChange((event,s)=>{revision++;if(active)apply(s);});
  const atStart=revision;
  supabase.auth.getSession().then(({data,error})=>{if(active&&revision===atStart){if(error)setError('로그인 세션을 확인하지 못했습니다.');apply(data.session);}});
  return ()=>{active=false;session.current=null;client.invalidate();data.subscription.unsubscribe();};
 },[supabase,client]);
 useEffect(()=>{if(status!=='signedIn'||!client)return;let active=true;recordUpdater.current.load(()=>client.request({action:'list'})).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[status,user?.id,client]);
 const signIn=async(email,password)=>{setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw new Error('이메일 또는 비밀번호를 확인하세요.');};
 const requestEmailSignIn=async email=>{
  const {error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
  if(error)throw new Error('인증메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.');
 };
 const verifyEmailSignIn=async(email,value)=>{
  const {error}=await supabase.auth.verifyOtp(emailVerificationInput({url:config.url,email,value}));
  if(error)throw new Error('인증번호/링크가 올바르지 않거나 만료됐습니다. 새 인증메일을 받아 주세요.');
 };
 const signOut=async()=>{
  session.current=null;client.invalidate();publishRecords([]);setRecordsLoaded(false);setUser(null);setStatus('signedOut');
  const {error}=await supabase.auth.signOut({scope:'local'});if(error)setError('로그아웃 후 세션 제거 상태를 확인하세요.');
 };
 if(setup.error)return <p role="alert" style={{padding:24}}>연결 설정 오류: {setup.error}</p>;
 return <Context.Provider value={{config,status,user,error,signIn,signOut,requestEmailSignIn,verifyEmailSignIn,client,records,recordsLoaded,setRecords:publishRecords,summary:summarizeCandidates(records)}}>{children}</Context.Provider>;
}
