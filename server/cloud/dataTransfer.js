import { createHash } from 'node:crypto';
const digest=(records,events)=>createHash('sha256').update(JSON.stringify({records,events})).digest('hex');
const domain=c=>({product:{...c.product,source:'1688'},terms:c.terms||{},market:c.market||null,research:c.research||null,review:c.review||null,listing:c.listing||{}});
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function makeSnapshot({workspaceId,records,events=[]}){
 const clone=structuredClone({version:1,workspaceId,records,events});
 return {...clone,manifest:{counts:{records:records.length,events:events.length},sha256:digest(clone.records,clone.events),createdAt:new Date().toISOString()}};
}
export function validateSnapshot(snapshot,workspaceId=snapshot?.workspaceId){
 if(!snapshot||snapshot.version!==1||snapshot.workspaceId!==workspaceId||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.events))throw new Error('백업 버전/대상 공간을 확인하세요.');
 const ids=new Set();
 for(const c of snapshot.records){if(!c||!/^\d{1,32}$/.test(c.id)||c.product?.offerId!==c.id||ids.has(c.id)||c.publication?.status!=='NOT_PUBLISHED')throw new Error('후보 형식/중복/게시 상태가 올바르지 않습니다.');ids.add(c.id);}
 if(snapshot.manifest?.counts?.records!==snapshot.records.length||snapshot.manifest.counts.events!==snapshot.events.length||snapshot.manifest.sha256!==digest(snapshot.records,snapshot.events))throw new Error('백업 무결성 검증 실패');
 return structuredClone(snapshot);
}
export function planImport(snapshot,existing){
 const {records}=validateSnapshot(snapshot);const plan={create:[],skip:[],conflict:[]};
 for(const c of records){const prior=existing.find(x=>x.id===c.id);plan[!prior?'create':canonical(domain(prior))===canonical(domain(c))?'skip':'conflict'].push(c.id);}
 return plan;
}
