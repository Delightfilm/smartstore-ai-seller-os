import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import { createDiscoveryController,initialDiscoveryState } from './discoveryController.js';
const Context=createContext(null);
export const useResearch=()=>useContext(Context);
export default function ResearchProvider({client,enabled,userId,onCandidates,children}) {
 const [state,setState]=useState(initialDiscoveryState),controller=useRef(null);
 const callback=useRef(onCandidates);callback.current=onCandidates;
 useEffect(()=>{
  setState(initialDiscoveryState());if(!enabled)return;
  const current=createDiscoveryController({client,localAvailable:import.meta.env.DEV,onState:setState,onCandidates:rows=>callback.current(rows)});
  controller.current=current;void current.poll();
  const timer=setInterval(()=>void current.poll(),10000);
  return()=>{current.dispose();controller.current=null;clearInterval(timer);};
 },[client,enabled,userId]);
 const call=(method,...args)=>controller.current?.[method](...args)??Promise.resolve(false);
 return <Context.Provider value={{...state,ready:enabled,start:query=>call('start',query),enqueue:(kind,data)=>call('enqueue',kind,data),refresh:()=>call('poll'),connect:()=>call('connect'),stop:()=>call('stop'),retry:id=>call('retry',id)}}>{children}</Context.Provider>;
}
