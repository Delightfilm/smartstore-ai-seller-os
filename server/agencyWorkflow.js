import { collect1688FromBrowser, parseSupported1688Url } from './collect1688.js';
import { search1688Products } from './browserSearch.js';
import { searchNaverMarket } from './naverMarket.js';
import { renderDetail, numberOrNull, clearConfirmations, evidenceChanged } from '../src/purchaseAgency.js';
import { researchMargins, reviewCandidate, invalidateReview } from '../src/researchReview.js';
import { validateCandidateUpdate } from './candidateUpdate.js';

const shapes = {
  list:['action'], search:['action','query'], collect:['action','url'],
  market:['action','id','revision','query'],
  update:['action','id','revision','terms','listing','comparisons','research','review'],
  export:['action','id'],
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function checkAgencyRequest(headers, body = '') {
  const host = String(headers.host || '');
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || headers.origin !== `http://${host}`) throw new Error('로컬 동일 출처 요청만 허용합니다.');
  if (!/^application\/json(?:;|$)/i.test(headers['content-type'] || '')) throw new Error('JSON 요청이 필요합니다.');
  if (Buffer.byteLength(body) > 65536) throw new Error('요청 본문은 64 KB 이하여야 합니다.');
}

export async function executeAgencyAction(input, {store, config = {}, providers = {}}) {
  const allowed = shapes[input?.action];
  if (!object(input) || !allowed) throw new Error('지원하지 않는 작업입니다. 실제 등록은 스토어 심사/API 연결 후 가능합니다.');
  if (Object.keys(input).some(k=>!allowed.includes(k))) throw new Error('허용되지 않은 필드입니다.');
  const {action} = input;
  if (action === 'list') return store.list();
  if (action === 'search') return (providers.search || search1688Products)(input.query);
  if (action === 'collect') {
    const {offerId,canonicalUrl} = parseSupported1688Url(input.url);
    const product=await (providers.collect || collect1688FromBrowser)({url:canonicalUrl,offerId});
    const previous=(await store.list()).find(c=>c.id===offerId);
    if (!previous) return store.create(product);
    const terms={...previous.terms};
    for(const key of ['supplierQuoteConfirmed','costsConfirmed','saleEligibilityConfirmed','imageRightsConfirmed','comparisonConfirmed','demandConfirmed'])terms[key]=false;
    return store.update(offerId,previous.revision,{product,terms,review:invalidateReview(previous.review)});
  }
  const c = await store.get(input.id);
  if (action === 'export') return {
    status:'PREPARATION_ONLY', candidate:c,
    analysis:reviewCandidate(c), researchMargins:researchMargins(c.research || {}), detail:renderDetail(c.product,{...c.listing,imageRightsConfirmed:c.terms.imageRightsConfirmed===true,selectedVariant:c.terms.selectedVariant}),
    pending:['스토어 심사 및 커머스 API 권한','단건 공급·배송 견적·수요 및 판매 가능 여부 검증','이미지 사용권과 네이버 이미지 업로드','카테고리·고시정보·원산지·배송/반품/A/S 설정'],
  };
  if (c.revision !== input.revision) throw new Error('후보가 변경됐습니다. 최신 상태를 다시 불러오세요.');
  if (action === 'market') {
    const market = await (providers.market || searchNaverMarket)(input.query,config);
    return store.update(c.id,c.revision,{market,terms:clearConfirmations(c.terms),review:invalidateReview(c.review)});
  }
  return store.update(c.id,c.revision,validateCandidateUpdate(c,input));
}

export function agencyWorkflowPlugin(options) {
  let busy = false;
  return {name:'local-purchase-agency',configureServer(server){
    server.middlewares.use('/api/agency',async(req,res)=>{
      res.setHeader('content-type','application/json; charset=utf-8');
      res.setHeader('cache-control','no-store');
      if (req.method!=='POST') {res.statusCode=405;res.end(JSON.stringify({error:'POST_ONLY'}));return;}
      let acquired=false;
      try {
        checkAgencyRequest(req.headers);
        if (busy) throw new Error('다른 작업이 진행 중입니다. 완료 후 다시 시도하세요.');
        busy=true; acquired=true;
        const chunks=[]; let size=0;
        for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>65536)throw new Error('요청 본문은 64 KB 이하여야 합니다.');chunks.push(Buffer.from(chunk));}
        const body=Buffer.concat(chunks).toString('utf8');
        const result=await executeAgencyAction(JSON.parse(body),options);
        res.end(JSON.stringify(result));
      }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.code || 'WORKFLOW_ERROR',message:String(error.message).split('\n')[0].slice(0,240)}));}
      finally{if(acquired)busy=false;}
    });
  }};
}
