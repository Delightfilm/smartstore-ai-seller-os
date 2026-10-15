import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCommerceLocalHandler } from '../server/commerce/localAdapter.js';
import { createBindingStore } from '../server/commerce/bindingStore.js';
const workspace='ccb5017e-7c70-414d-b103-38e17e48e799';
const channel={channelNo:'123',name:'Test',url:'https://smartstore.naver.com/test'};
async function fixture(t,{read,cloudFail=false,bound=null,configured=true,authorize,writeBinding,setTimer}={}){
 let time=0,reads=0,writes=0,binding=bound,saveCount=0;let snapshot=null;
 const handler=createCommerceLocalHandler({workspaceId:workspace,configured,setTimer,reader:{clear(){},read:async opts=>{reads++;return read?read(opts):{channels:[channel]};}},
 authorizeOwner:async args=>{if(args.authorization!=='Bearer owner'||args.workspaceId!==workspace)throw Object.assign(new Error(),{code:'SESSION_INVALID',status:401});if(authorize)await authorize(args);return {userId:'owner',snapshot};},
 cloud:{publish:async({report})=>{saveCount++;if(cloudFail)throw new Error('PRIVATE_SECRET');snapshot={...report,revision:saveCount};return snapshot;}},bindings:{read:async()=>binding,write:async(value,options)=>{if(writeBinding)await writeBinding(options);options?.assertCurrent();writes++;binding=value;}},now:()=>time,randomUUID:()=>crypto.randomUUID()});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 return {send:(action,extra={},headers={})=>new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/commerce-local',method:'POST',headers:{origin:'http://127.0.0.1:5173',host:'127.0.0.1:5173',authorization:'Bearer owner','content-type':'application/json',...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});
  req.on('error',reject);req.end(JSON.stringify({action,workspaceId:workspace,...extra}));
 }),port:server.address().port,stats:()=>({reads,writes,saveCount}),advance:ms=>time+=ms};
}
test('origin host fixed workspace identity and action gate upstream',async t=>{
 const f=await fixture(t);for(const headers of [{origin:'https://evil.example'},{host:'evil.example'},{authorization:'Bearer fake'}])assert.ok((await f.send('verify',{},headers)).status>=400);
 assert.equal((await f.send('verify',{workspaceId:crypto.randomUUID()})).status,403);assert.equal((await f.send('register')).status,400);
 assert.equal(f.stats().reads,0);
});
test('first channel requires explicit fresh server-held confirmation and saves once',async t=>{
 const f=await fixture(t);const first=await f.send('verify');assert.equal(first.body.status,'CONFIRM_REQUIRED');assert.equal(f.stats().saveCount,0);
 assert.equal((await f.send('confirm',{attemptId:crypto.randomUUID(),channelNo:'123'})).status,409);
 const saved=await f.send('confirm',{attemptId:first.body.attemptId,channelNo:'123'});assert.equal(saved.body.status,'VERIFIED');assert.equal(f.stats().writes,1);assert.equal(f.stats().saveCount,1);
 assert.equal((await f.send('confirm',{attemptId:first.body.attemptId,channelNo:'123'})).status,409);
 assert.equal((await f.send('verify')).status,429);
});
test('expired confirmation and mismatch never rewrite binding',async t=>{
 const first=await fixture(t);const pending=await first.send('verify');first.advance(300001);assert.equal((await first.send('confirm',{attemptId:pending.body.attemptId,channelNo:'123'})).status,409);assert.equal(first.stats().writes,0);
 const mismatch=await fixture(t,{bound:{...channel,channelNo:'999'}});assert.equal((await mismatch.send('verify')).body.errorCode,'CHANNEL_MISMATCH');assert.equal(mismatch.stats().writes,0);
});
test('missing configuration never reaches Naver and publish failure is sync pending',async t=>{
 const no=await fixture(t,{configured:false});assert.equal((await no.send('verify')).body.status,'NOT_CONFIGURED');assert.equal(no.stats().reads,0);
 const f=await fixture(t,{bound:channel,cloudFail:true});assert.equal((await f.send('verify')).body.status,'SYNC_PENDING');assert.equal(f.stats().saveCount,1);
});
test('concurrent verify is single-flight and cancel invalidates delayed result',async t=>{
 let release;const f=await fixture(t,{read:()=>new Promise(r=>release=r)});const pending=f.send('verify');
 for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release);assert.equal((await f.send('verify')).status,429);
 assert.equal((await f.send('cancel')).status,200);release({channels:[channel]});await pending;assert.equal(f.stats().saveCount,0);assert.equal(f.stats().writes,0);
});
test('binding file survives reopening and rejects cross-workspace/tampering',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'seller-commerce-'));const file=path.join(dir,'binding.json');const store=createBindingStore({path:file,workspaceId:workspace});
 assert.equal(await store.read(),null);await store.write(channel);assert.deepEqual(await createBindingStore({path:file,workspaceId:workspace}).read(),channel);
 const value=JSON.parse(await readFile(file,'utf8'));value.workspaceId=crypto.randomUUID();await writeFile(file,JSON.stringify(value));await assert.rejects(store.read());
});
test('cancel during owner authorization prevents later upstream and pending confirmation',async t=>{
 let release,waiting=false,calls=0;const f=await fixture(t,{authorize:async()=>{if(++calls===1){waiting=true;await new Promise(r=>release=r);}}});
 const pending=f.send('verify');for(let i=0;!waiting&&i<100;i++)await new Promise(r=>setTimeout(r,5));assert.ok(waiting);
 await f.send('cancel');release();await pending;assert.equal(f.stats().reads,0);assert.equal((await f.send('status')).body.status,'UNVERIFIED');
});
test('cancel during binding preparation cannot commit or authorize next verify',async t=>{
 let release;const f=await fixture(t,{writeBinding:async options=>{await new Promise(r=>release=r);options.assertCurrent();}});
 const found=await f.send('verify');const confirmation=f.send('confirm',{attemptId:found.body.attemptId,channelNo:'123'});
 for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release);await f.send('cancel');release();assert.equal((await confirmation).status,408);
 assert.equal(f.stats().writes,0);f.advance(60001);assert.equal((await f.send('verify')).body.status,'CONFIRM_REQUIRED');assert.equal(f.stats().saveCount,0);
});
test('deadline ends verifying state instead of leaving a phantom active operation',async t=>{
 const f=await fixture(t,{setTimer:(fn,ms)=>{assert.equal(ms,45000);return setTimeout(fn,20);},read:({signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'})),{once:true}))});
 const attempt=await f.send('verify');assert.equal(attempt.status,408);const state=await f.send('status');assert.equal(state.body.status,'FAILED');assert.equal(state.body.errorCode,'TIMEOUT');
});
test('slow local request body terminates at deadline before EOF',async t=>{
 const f=await fixture(t,{setTimer:fn=>setTimeout(fn,20)});
 let connection;const response=new Promise((resolve,reject)=>{connection=http.request({hostname:'127.0.0.1',port:f.port,method:'POST',headers:{origin:'http://127.0.0.1:5173',host:'127.0.0.1:5173',authorization:'Bearer owner','content-type':'application/json','transfer-encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});connection.on('error',reject);connection.write('{"action":"verify"');});
 const result=await Promise.race([response,new Promise(resolve=>setTimeout(()=>resolve('NOT_BOUNDED'),100))]);connection.destroy();assert.equal(result,408);assert.equal(f.stats().reads,0);
});
test('binding store checks abort before its atomic commit',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'seller-commerce-abort-'));const file=path.join(dir,'binding.json');const controller=new AbortController();
 const store=createBindingStore({path:file,workspaceId:workspace});const pending=store.write(channel,{signal:controller.signal});controller.abort();await assert.rejects(pending);assert.equal(await store.read(),null);
});
