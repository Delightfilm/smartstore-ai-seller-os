import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCommerceChannel } from './snapshot.js';
export function createBindingStore({path,workspaceId}){
 return {
  async read(){
   let contents;try{contents=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}
   const value=JSON.parse(contents);
   if(value.workspaceId!==workspaceId||Object.keys(value).sort().join(',')!=='channel,workspaceId')throw new Error('COMMERCE_BINDING_INVALID');
   return validateCommerceChannel(value.channel);
  },
  async write(channel,{signal,assertCurrent=()=>{}}={}){
   const check=()=>{signal?.throwIfAborted();assertCurrent();};check();
   const value={workspaceId,channel:validateCommerceChannel(channel)};await mkdir(dirname(path),{recursive:true});
   const temporary=path+'.'+randomUUID()+'.tmp';
   // The final validity check and rename share one JS turn: cancellation cannot
   // interleave after approval but before the binding becomes visible.
   try{await writeFile(temporary,JSON.stringify(value),{encoding:'utf8',flag:'wx',mode:0o600});check();renameSync(temporary,path);}
   finally{await unlink(temporary).catch(()=>{});}
  },
 };
}
