import { readFileSync,writeFileSync,mkdirSync,copyFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { makeSnapshot,validateSnapshot,planImport } from '../server/cloud/dataTransfer.js';
const [action,workspaceId,id='816692570613']=process.argv.slice(2);
if(!['backup','verify','dry-run'].includes(action)||!/^[0-9a-f-]{36}$/.test(workspaceId||''))throw new Error('Usage: node scripts/seller-os-data.mjs backup|verify|dry-run WORKSPACE [OFFER_ID]');
const root=resolve('.seller-os'),directory=join(root,'backups');
if(action==='backup'){
 const records=Object.values(JSON.parse(readFileSync(join(root,'candidates.json'),'utf8')));
 const selected=records.filter(c=>c.id===id);if(selected.length!==1)throw new Error('후보를 찾을 수 없습니다.');
 const snapshot=makeSnapshot({workspaceId,records:selected});validateSnapshot(snapshot,workspaceId);
 mkdirSync(directory,{recursive:true});
 const prefix=new Date().toISOString().replace(/[:.]/g,'-');
 const raw=join(directory,`${prefix}-local-original.json`),file=join(directory,`${prefix}-${id}.json`);
 copyFileSync(join(root,'candidates.json'),raw);
 writeFileSync(file,JSON.stringify(snapshot,null,2),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({file,raw,count:snapshot.records.length,sha256:snapshot.manifest.sha256}));
}else{
 const snapshot=validateSnapshot(JSON.parse(readFileSync(join(root,'import-snapshot.json'),'utf8')),workspaceId);
 const existing=JSON.parse(readFileSync(join(root,'cloud-before-import.json'),'utf8'));
 console.log(JSON.stringify({verified:true,plan:planImport(snapshot,existing)}));
}
