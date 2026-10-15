import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';

const kit = await import('../src/export/gptImageKit.js').catch(()=>({}));
const candidate = () => ({id:'675246155709',revision:4,product:{title:'투명 메모함',url:'https://detail.1688.com/offer/675246155709.html',minOrderQty:1,images:['https://cbu01.alicdn.com/a.webp'],variants:[{name:'흰색',price:3.5}]},listing:{name:'책상 메모 정리함'},terms:{imageRightsConfirmed:false},review:{status:'HOLD'},secret:'never-export-this',research:{salePriceKrw:6900}});
const image = new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80,86,80,56,32]);

test('kit isolates saved product facts from credentials and keeps rights and unknowns explicit',()=>{
 assert.equal(typeof kit.kitFacts,'function','export facts feature missing');
 const c=candidate();c.product.token='secret-token';
 const facts=kit.kitFacts(c),text=JSON.stringify(facts);
 assert.equal(facts.id,'675246155709');assert.equal(facts.revision,4);
 assert.equal(facts.title,'책상 메모 정리함');assert.equal(facts.variants[0].name,'흰색');
 assert.equal(facts.imageRightsConfirmed,false);assert.equal(facts.status,'HOLD');
 assert.equal(text.includes('secret'),false);assert.equal(text.includes('6900'),false);
 assert.match(kit.buildKitPrompt(facts),/미확인/);assert.match(kit.buildKitPrompt(facts),/참고 데이터/);
});

test('image locations allow only credential-free Alibaba CDN images, never arbitrary hosts or query secrets',()=>{
 assert.equal(typeof kit.sourceImageUrl,'function','image URL policy missing');
 for(const url of ['http://cbu01.alicdn.com/a.jpg','https://localhost/a','https://127.0.0.1/a','https://cbu01.alicdn.com.evil.test/a','https://user:pass@cbu01.alicdn.com/a','https://cbu01.alicdn.com/a?token=abc']) assert.equal(kit.sourceImageUrl(url),null);
 assert.equal(kit.sourceImageUrl('https://cbu01.alicdn.com/a.webp'),'https://cbu01.alicdn.com/a.webp');
});

test('long-image slices cover every source pixel with overlap and never infer product crops',()=>{
 assert.equal(typeof kit.imageSlices,'function','image slicing feature missing');
 assert.deepEqual(kit.imageSlices(800,600),[{x:0,y:0,width:800,height:600}]);
 const slices=kit.imageSlices(800,7000);
 assert.deepEqual(slices.map(s=>s.y),[0,2280,4560]);
 assert.equal(slices.at(-1).y+slices.at(-1).height,7000);
 assert.throws(()=>kit.imageSlices(20000,20000),/크기/);
});

test('bundle keeps original bytes, prepared photos and source manifest in one valid ZIP',async()=>{
 assert.equal(typeof kit.buildImageKit,'function','ZIP feature missing');
 const seen=[];
 const result=await kit.buildImageKit(candidate(),{fetchImpl:async(url,opts)=>{seen.push(opts);return new Response(image,{headers:{'content-type':'image/webp'}});},prepare:async()=>[{bytes:new Uint8Array([1,2,3]),width:800,height:600,sourceRect:{x:0,y:0,width:800,height:600}}]});
 const files=unzipSync(result.bytes),manifest=JSON.parse(strFromU8(files['manifest.json']));
 assert.deepEqual(files['originals/01.webp'],image);assert.deepEqual(files['upload/01-01.jpg'],new Uint8Array([1,2,3]));
 assert.ok(files['프롬프트.txt']);assert.ok(files['사용방법.txt']);assert.ok(files['상품정보.json']);
 assert.equal(manifest.images[0].status,'READY');assert.equal(manifest.images[0].source,'https://cbu01.alicdn.com/a.webp');
 assert.equal(seen[0].credentials,'omit');assert.equal(seen[0].redirect,'error');assert.equal(seen[0].referrerPolicy,'no-referrer');
 assert.equal(result.ready,1);assert.equal(result.missing,0);
});

test('missing photos and CORS failure still produce an honest partial bundle',async()=>{
 assert.equal(typeof kit.buildImageKit,'function','partial ZIP feature missing');
 const c=candidate();c.product.images.push('https://evil.test/a');
 const result=await kit.buildImageKit(c,{fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
 const files=unzipSync(result.bytes),m=JSON.parse(strFromU8(files['manifest.json']));
 assert.equal(result.ready,0);assert.equal(result.missing,2);assert.equal(m.images.length,2);
 assert.ok(m.images.every(i=>i.reason));assert.equal(Object.keys(files).some(p=>p.startsWith('upload/')),false);
 c.product.images=[];
 const empty=await kit.buildImageKit(c);assert.equal(empty.missing,1);assert.equal(empty.ready,0);
});

test('HTML masquerading as an image never enters originals or preparation',async()=>{
 assert.equal(typeof kit.buildImageKit,'function','image validation missing');
 const result=await kit.buildImageKit(candidate(),{fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'image/webp'}}),prepare:()=>{throw new Error('must not decode HTML');}});
 const files=unzipSync(result.bytes);assert.equal(result.ready,0);assert.equal(files['originals/01.webp'],undefined);
});

test('cancellation aborts the entire bundle rather than offering stale session data',async()=>{
 assert.equal(typeof kit.buildImageKit,'function','cancellation missing');
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>kit.buildImageKit(candidate(),{signal:controller.signal}),{name:'AbortError'});
});

test('saved kit export is read-only and refuses changed revisions before downloading images',async()=>{
 assert.equal(typeof kit.exportSavedImageKit,'function','authenticated export orchestration missing');
 const calls=[];
 const client={request:async input=>{calls.push(input);return {candidate:candidate()};}};
 const result=await kit.exportSavedImageKit(client,{id:'675246155709',revision:4},{fetchImpl:async()=>{throw new TypeError('offline');}});
 assert.equal(result.ready,0);assert.deepEqual(calls,[{action:'export',id:'675246155709'}]);
 await assert.rejects(()=>kit.exportSavedImageKit(client,{id:'675246155709',revision:3}),/변경/);
});

test('oversized streams and redirect responses are reported without archiving bytes',async()=>{
 for(const response of [new Response(image,{headers:{'content-type':'image/webp','content-length':'9000000'}}),new Response(image,{status:302,headers:{location:'https://localhost/secret'}})]){
  const result=await kit.buildImageKit(candidate(),{fetchImpl:async()=>response});
  const files=unzipSync(result.bytes);assert.equal(result.ready,0);assert.equal(files['originals/01.webp'],undefined);
 }
});

test('decode failure preserves the downloaded original but never calls it upload-ready',async()=>{
 const result=await kit.buildImageKit(candidate(),{fetchImpl:async()=>new Response(image,{headers:{'content-type':'image/webp'}}),prepare:async()=>{throw new Error('이미지 크기 한도 초과');}});
 const files=unzipSync(result.bytes),m=JSON.parse(strFromU8(files['manifest.json']));
 assert.deepEqual(files['originals/01.webp'],image);assert.equal(result.ready,0);assert.equal(result.missing,1);assert.equal(m.images[0].status,'MISSING');
});

test('only first twelve sources are fetched and the rest have explicit omission records',async()=>{
 const c=candidate();c.product.images=Array.from({length:14},(_,i)=>`https://cbu01.alicdn.com/${i}.webp`);
 let calls=0;
 const result=await kit.buildImageKit(c,{fetchImpl:async()=>{calls++;return new Response(image,{headers:{'content-type':'image/webp'}});},prepare:async()=>[{bytes:new Uint8Array([1]),width:1,height:1}]});
 assert.equal(calls,12);assert.equal(result.ready,12);assert.equal(result.missing,2);
});

test('cancellation after authenticated read never starts photo requests',async()=>{
 const controller=new AbortController();
 await assert.rejects(()=>kit.exportSavedImageKit({request:async()=>{controller.abort();return {candidate:candidate()};}},{id:'675246155709',revision:4},{signal:controller.signal,fetchImpl:()=>{assert.fail('must not fetch');}}),{name:'AbortError'});
});

test('review-needed candidates remain review-needed in exported facts',()=>{
 const c=candidate();c.review.status='REVIEW_REQUIRED';
 assert.equal(kit.kitFacts(c).status,'REVIEW_REQUIRED');
});
