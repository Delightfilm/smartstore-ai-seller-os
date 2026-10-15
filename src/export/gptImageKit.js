import { zipSync, strToU8 } from 'fflate';
import { buildDetailPageRequest, buildGuideFiles, DETAIL_GUIDE_VERSION } from './detailPageGuide.js';

const MAX_IMAGES=12, MAX_IMAGE_BYTES=8*1024*1024, MAX_TOTAL_BYTES=40*1024*1024;
const text=value=>typeof value==='string'?value.slice(0,4000):null;
const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const pick=(object,keys)=>Object.fromEntries(keys.map(key=>[key,typeof object?.[key]==='number'?finite(object[key]):text(object?.[key])]));

// Only the known public supplier image CDN. Never forward cookies, API keys or
// caller-provided arbitrary URLs through the logged-in server/browser collector.
export function sourceImageUrl(value){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&/^cbu\d{2}\.alicdn\.com$/.test(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash?u.href:null;
 }catch{return null;}
}

export function kitFacts(candidate){
 const p=candidate.product||{},listing=candidate.listing||{};
 return {
  id:String(candidate.id).slice(0,80),revision:candidate.revision,
  title:text(listing.name)||text(p.title)||'상품명 미확인',sourceTitle:text(p.title),
  source:/^\d+$/.test(String(candidate.id))?`https://detail.1688.com/offer/${candidate.id}.html`:null,
  observedAt:text(p.collectedAt),minOrderQty:finite(p.minOrderQty),
  variants:(p.variants||[]).slice(0,100).map(v=>pick(v,['id','name'])),
  operatorDraft:pick(listing,['description','specs','deliveryText','returnText']),
  imageRightsConfirmed:candidate.terms?.imageRightsConfirmed===true,
  status:['HOLD','REVIEW_REQUIRED'].includes(candidate.review?.status)?candidate.review.status:'REVIEW_REQUIRED',publication:'NOT_PUBLISHED',
  unknowns:['사진 사용권은 별도 근거 확인 필요','색상·구성·재질·치수·성능은 옵션별 근거와 대조 필요','포장 총중량·크기·배송비·배송기간·수익성 확정 보류','인증·원산지·판매 적합성·고시정보는 별도 검증 필요'],
 };
}

export function buildKitPrompt(facts){
 return buildDetailPageRequest(facts);
}

export function imageSlices(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16000||height>16000||width*height>40000000)throw new Error('이미지 크기 한도 초과 또는 규격 오류');
 const chunk=Math.min(3200,width*3),overlap=Math.min(120,Math.floor(chunk/10)),slices=[];
 for(let y=0;y<height;){
  const h=height-y<=chunk+overlap?height-y:chunk;slices.push({x:0,y,width,height:h});
  if(y+h===height)break;y+=chunk-overlap;
 }
 return slices;
}

export async function prepareBrowserImage(bytes,type,{signal}={}){
 signal?.throwIfAborted();
 const bitmap=await createImageBitmap(new Blob([bytes],{type}));
 try{
  const slices=imageSlices(bitmap.width,bitmap.height),out=[];
  for(const rect of slices){
   signal?.throwIfAborted();
   const scale=Math.min(1,1600/rect.width),canvas=document.createElement('canvas');
   canvas.width=Math.round(rect.width*scale);canvas.height=Math.round(rect.height*scale);
   const context=canvas.getContext('2d');
   if(!context)throw new Error('사진 정리 기능을 지원하지 않는 브라우저');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(bitmap,rect.x,rect.y,rect.width,rect.height,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
   if(!blob)throw new Error('업로드용 JPG 변환 실패');
   out.push({bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height,sourceRect:rect});
   canvas.width=canvas.height=0;
  }
  return out;
 }finally{bitmap.close();}
}

function imageFormat(bytes,type){
 if(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(type==='image/png'&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'png';
 if(type==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'webp';
 throw new Error('지원하지 않는 형식 또는 실제 이미지가 아닌 응답');
}

async function readImage(response,signal){
 if(!response.ok)throw new Error(`이미지 서버 HTTP ${response.status}`);
 if(Number(response.headers.get('content-length'))>MAX_IMAGE_BYTES)throw new Error('원본 8MB 한도 초과');
 const reader=response.body?.getReader();if(!reader)throw new Error('사진 응답 없음');
 const chunks=[];let size=0;
 try{
  while(true){
   signal?.throwIfAborted();const {value,done}=await reader.read();if(done)break;
   size+=value.length;if(size>MAX_IMAGE_BYTES)throw new Error('원본 8MB 한도 초과');chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const type=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
 return {bytes,type,ext:imageFormat(bytes,type)};
}

const instructions=`Seller OS → ChatGPT 수동 제작 자료
ZIP 하나를 다운로드한 뒤 압축을 풀어 주세요.
1. manifest.json에서 사진 누락·옵션 일치·사용권 상태를 확인하세요.
2. ChatGPT 새 대화에 00_ChatGPT_제작요청.txt 내용을 사용자 요청으로 붙여넣으세요. 대시보드의 제작 요청문 복사도 같은 내용입니다. 프롬프트.txt는 호환용 사본입니다.
3. upload 폴더의 JPG를 직접 첨부하세요. 많은 사진은 선택하거나 나누어 첨부하세요.
4. ZIP도 함께 첨부하면 제작가이드.md·패널구성안.json·사진옵션매칭표.json·검수표.md를 참고할 수 있습니다. ZIP만 첨부하면 업무가 자동 실행되거나 사진이 인식된다고 보장하지 않습니다.
5. 전체 패널 이미지와 카피·storyboard·검수표를 받아 같은 상품의 완성 이미지·상세페이지에서 확인하세요. 대표1장만으로 전체 제작 완료가 아닙니다. 생성 한도에 걸리면 다음 패널 번호부터 이어서 요청하세요.
사진 없는 ZIP은 이미지 제작 준비가 완료된 것이 아닙니다. 원본 사진 확보 후 다시 다운로드하세요.
사진 정리: 전체 픽셀 범위를 보존하는 겹침 분할·최대 가로 1600px 축소·JPG 변환만 합니다. 의미 기반 제품 크롭·워터마크 제거·배경 제거는 하지 않습니다.
원본은 수신 바이트 그대로 보존합니다. 사진 다운로드는 상업적 사용권이나 옵션 정확성을 보증하지 않습니다.
이 버튼은 GPT 호출/로그인/이미지 생성/상품 등록/배송 신청을 하지 않습니다. ChatGPT 사용은 사용자가 직접 선택하며 계정 한도·조건이 적용됩니다.
`;

export async function buildImageKit(candidate,{fetchImpl=fetch,prepare=prepareBrowserImage,signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();
 const facts=kitFacts(candidate),files={};
 const sources=[...new Set((candidate.product?.images||[]).filter(v=>typeof v==='string'))];
 const manifest={version:1,guideVersion:DETAIL_GUIDE_VERSION,candidateId:facts.id,revision:facts.revision,createdAt:new Date().toISOString(),imageRightsConfirmed:facts.imageRightsConfirmed,mode:'MANUAL_CHATGPT_DRAFT',images:[],limits:{maxImages:MAX_IMAGES,maxOriginalBytes:MAX_IMAGE_BYTES,maxBundleImageBytes:MAX_TOTAL_BYTES}};
 let total=0,ready=0;
 for(let i=0;i<sources.length;i++){
  signal?.throwIfAborted();
  const source=sourceImageUrl(sources[i]),entry={index:i+1,source,status:'MISSING',uploads:[]};manifest.images.push(entry);
  // Do not echo rejected URLs: they may contain credentials/query secrets.
  if(!source){entry.reason='허용된 공개 1688 CDN 이미지 주소가 아님';continue;}
  if(i>=MAX_IMAGES){entry.reason='한 번에 원본 12장 한도 — 사진을 나누어 준비 필요';continue;}
  if(total>=MAX_TOTAL_BYTES){entry.reason='사진 묶음 40MB 한도';continue;}
  onProgress(`원본 사진 ${i+1}/${Math.min(sources.length,MAX_IMAGES)} 준비 중`);
  const requestSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)]);
  try{
   const response=await fetchImpl(source,{mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:requestSignal});
   const {bytes,type,ext}=await readImage(response,requestSignal);
   if(total+bytes.length>MAX_TOTAL_BYTES)throw new Error('사진 묶음 40MB 한도');
   const number=String(i+1).padStart(2,'0'),path=`originals/${number}.${ext}`;
   files[path]=bytes;total+=bytes.length;entry.original=path;entry.bytes=bytes.length;
   entry.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   const prepared=await prepare(bytes,type,{signal});
   const size=prepared.reduce((sum,p)=>sum+p.bytes.length,0);
   if(total+size>MAX_TOTAL_BYTES)throw new Error('업로드용 사진 포함 40MB 한도');
   if(!prepared.length)throw new Error('업로드용 사진을 만들지 못함');
   for(const [n,p] of prepared.entries()){
    const upload=`upload/${number}-${String(n+1).padStart(2,'0')}.jpg`;files[upload]=p.bytes;
    entry.uploads.push({path:upload,width:p.width,height:p.height,sourceRect:p.sourceRect});
   }
   total+=size;entry.status='READY';ready++;
  }catch(error){
   signal?.throwIfAborted();
   entry.reason=error instanceof TypeError?'브라우저 보안/CORS 또는 네트워크 실패 — 직접 원본 확보 필요':error.name==='TimeoutError'?'사진 다운로드 15초 초과':error.message;
  }
 }
 if(!sources.length)manifest.images.push({status:'MISSING',reason:'저장된 원본 사진 없음',uploads:[]});
 signal?.throwIfAborted();
 files['프롬프트.txt']=strToU8(buildKitPrompt(facts));files['상품정보.json']=strToU8(JSON.stringify(facts,null,2));
 for(const [path,content] of Object.entries(buildGuideFiles(facts,manifest)))files[path]=strToU8(content);
 files['사용방법.txt']=strToU8(instructions);files['manifest.json']=strToU8(JSON.stringify(manifest,null,2));
 onProgress('ZIP 묶는 중');
 // Images are already compressed; STORE avoids an expensive UI-thread deflate.
 const bytes=zipSync(files,{level:0});signal?.throwIfAborted();
 return {bytes,request:buildKitPrompt(facts),filename:`gpt-image-kit-${facts.id.replace(/[^a-zA-Z0-9_-]/g,'_')}-r${facts.revision}-guide-v2.zip`,ready,missing:manifest.images.length-ready,uploads:manifest.images.reduce((n,i)=>n+i.uploads.length,0)};
}

export async function exportSavedKitRequest(client,selected,{signal}={}){
 signal?.throwIfAborted();
 const packet=await client.request({action:'export',id:selected.id});
 signal?.throwIfAborted();
 if(packet.candidate?.id!==selected.id||packet.candidate.revision!==selected.revision)throw new Error('저장 후보가 변경됐습니다. 새로고침한 후 다시 복사하세요.');
 return buildKitPrompt(kitFacts(packet.candidate));
}

export async function exportSavedImageKit(client,selected,options={}){
 options.signal?.throwIfAborted();
 const packet=await client.request({action:'export',id:selected.id});
 options.signal?.throwIfAborted();
 if(packet.candidate?.id!==selected.id||packet.candidate.revision!==selected.revision)throw new Error('저장 후보가 변경됐습니다. 새로고침한 후 다시 다운로드하세요.');
 return buildImageKit(packet.candidate,options);
}
