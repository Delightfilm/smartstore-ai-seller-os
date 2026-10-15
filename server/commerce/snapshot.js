const invalid=()=>Object.assign(new Error('COMMERCE_REPORT_INVALID'),{code:'COMMERCE_REPORT_INVALID',status:400});
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
export const commerceFailureCodes=['IP_REJECTED','AUTH_FAILED','FORBIDDEN','RATE_LIMITED','TIMEOUT','UPSTREAM_INVALID','CHANNEL_MISMATCH'];
export function validateCommerceChannel(channel){
 if(!exact(channel,['channelNo','name','url'])||typeof channel.channelNo!=='string'||!/^\d{1,32}$/.test(channel.channelNo)||/^0+$/.test(channel.channelNo)||typeof channel.name!=='string'||!channel.name.trim()||channel.name.length>200||/[\x00-\x1f<>]/.test(channel.name)||typeof channel.url!=='string'||channel.url.length>500)throw invalid();
 let url;try{url=new URL(channel.url);}catch{throw invalid();}
 if(url.protocol!=='https:'||!['smartstore.naver.com','brand.naver.com'].includes(url.hostname)||url.username||url.password||url.port||url.search||url.hash||url.pathname==='/')throw invalid();
 return {channelNo:channel.channelNo,name:channel.name,url:url.href};
}
export function validateCommerceReport(value){
 if(!exact(value,['status','channel','errorCode']))throw invalid();
 if(value.status==='VERIFIED'&&value.errorCode===null)return {status:'VERIFIED',channel:validateCommerceChannel(value.channel),errorCode:null};
 if(value.status==='FAILED'&&value.channel===null&&commerceFailureCodes.includes(value.errorCode))return {status:'FAILED',channel:null,errorCode:value.errorCode};
 throw invalid();
}
export function projectCommerceStatus(snapshot,nowMs=Date.now()){
 if(!snapshot)return 'UNVERIFIED';
 if(snapshot.status==='FAILED')return 'FAILED';
 const time=Date.parse(snapshot.succeededAt);
 if(snapshot.status!=='VERIFIED'||!Number.isFinite(time))return 'UNVERIFIED';
 return nowMs-time>=900000?'STALE':'VERIFIED';
}
