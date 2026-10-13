import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export class WorkflowStore {
  constructor(directory) {
    mkdirSync(directory,{recursive:true});
    this.path=join(directory,'candidates.json');
    this.records=existsSync(this.path)?JSON.parse(readFileSync(this.path,'utf8')):{};
    if (!this.records || typeof this.records !== 'object' || Array.isArray(this.records)) throw new Error('후보 저장 파일이 손상됐습니다. 원본 파일을 보존하고 확인하세요.');
  }
  list(){return Object.values(this.records).map(c=>structuredClone(c));}
  get(id){
    if(typeof id!=='string'||!/^\d{1,32}$/.test(id)||!Object.hasOwn(this.records,id))throw new Error('후보를 찾을 수 없습니다.');
    return structuredClone(this.records[id]);
  }
  save(records){
    const temp=this.path+'.tmp';
    writeFileSync(temp,JSON.stringify(records,null,2),{encoding:'utf8',mode:0o600});
    renameSync(temp,this.path);
    this.records=records;
  }
  create(product,{terms={},market=null,research=null,review=null}={}){
    const id=String(product.offerId||'');
    if(!/^\d{1,32}$/.test(id))throw new Error('상품 offerId가 올바르지 않습니다.');
    if(Object.hasOwn(this.records,id))return this.get(id);
    const record=structuredClone({id,revision:1,product,createdAt:new Date().toISOString(),terms,market,listing:{},research,review,publication:{status:'NOT_PUBLISHED'}});
    this.save({...this.records,[id]:record});
    return this.get(id);
  }
  update(id,revision,patch,{publication=false}={}){
    const previous=this.get(id);
    if(previous.revision!==revision)throw new Error('후보가 변경됐습니다. 최신 상태를 다시 불러오세요.');
    if(!publication&&['REGISTERING','UNKNOWN','PUBLISHED'].includes(previous.publication.status))throw new Error('등록 처리 중이거나 완료된 후보는 변경할 수 없습니다.');
    const next={...previous,...patch,id,revision:revision+1,updatedAt:new Date().toISOString()};
    this.save({...this.records,[id]:next});
    return this.get(id);
  }
  reserve(id,revision){return this.update(id,revision,{publication:{status:'REGISTERING',startedAt:new Date().toISOString()}});}
  finish(id,status,result){
    const c=this.get(id);
    return this.update(id,c.revision,{publication:{...c.publication,status,...result}},{publication:true});
  }
}
