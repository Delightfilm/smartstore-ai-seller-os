import React, { useState } from 'react';
import { evaluateCandidate, renderDetail, confirmationKeys, clearConfirmations, evidenceChanged } from './purchaseAgency.js';

const costFields={purchasePriceCny:'선택 옵션 매입가 (CNY)',fxKrwPerCny:'결제 적용환율 (원/CNY)',chinaShippingCny:'중국 내 배송비 (CNY)',internationalShippingKrw:'국제운송비 (원)',domesticShippingKrw:'별도 국내운송비 (원)',otherCostKrw:'검수·포장·기타 비용 (원)',returnReserveKrw:'반품 충당액 (원)',feePercent:'총 수수료 (%)',salePriceKrw:'상품 판매가 (원)',buyerShippingKrw:'구매자 배송비 (원)',minMarginPercent:'최소 목표마진 (%)'};
const confirmations={supplierQuoteConfirmed:'단건 옵션 견적',costsConfirmed:'실제 배송·비용 견적',saleEligibilityConfirmed:'판매 가능 여부',imageRightsConfirmed:'이미지 사용권',comparisonConfirmed:'동일 구성 비교',demandConfirmed:'수요 근거 검토'};

async function api(input){
  const r=await fetch('/api/agency',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(60000)});
  const data=await r.json();
  if(!r.ok)throw new Error(data.message || '요청 실패');
  return data;
}
function download(name,data,type){
  const href=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}

export default function PurchaseAgencyPanel(){
  const [records,setRecords]=useState([]),[candidate,setCandidate]=useState(null),[offers,setOffers]=useState([]);
  const [query,setQuery]=useState(''),[url,setUrl]=useState(''),[marketQuery,setMarketQuery]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('로컬에 저장됩니다. 실제 상품 등록은 아직 연결되지 않았습니다.'),[dirty,setDirty]=useState(false);
  if(!import.meta.env.DEV)return null;
  const run=async fn=>{setBusy(true);setMessage('처리 중…');try{await fn();setMessage('작업 완료 · 실제 상품은 등록하지 않았습니다.');}catch(e){setMessage(e.name==='TimeoutError'?'요청 시간 초과. 후보를 다시 불러와 저장 여부를 확인하세요.':e.message);}finally{setBusy(false);}};
  const accept=c=>{setCandidate(c);setDirty(false);setRecords(rs=>[...rs.filter(r=>r.id!==c.id),c]);};
  const edit=(section,key,value)=>{setDirty(true);setCandidate(c=>{
    const next={...c,[section]:{...c[section],[key]:value}};
    if(!confirmationKeys.includes(key))next.terms=clearConfirmations(next.terms);
    return next;
  });};
  const changeComparison=(id,patch)=>{setDirty(true);setCandidate(c=>({...c,terms:clearConfirmations(c.terms),market:{...c.market,competitors:c.market.competitors.map(r=>r.id===id?{...r,...patch}:r)}}));};
  const materialDirty=candidate?evidenceChanged(records.find(r=>r.id===candidate.id) || candidate,candidate):false;
  const save=async()=>{
    const c=await api({action:'update',id:candidate.id,revision:candidate.revision,terms:candidate.terms,listing:candidate.listing,comparisons:candidate.market?.competitors.map(c=>({id:c.id,comparable:c.comparable,shippingKrw:c.shippingKrw}))});
    accept(c);return c;
  };
  const analysis=candidate?evaluateCandidate(candidate.product,candidate.market || {},candidate.terms):null;
  const detail=candidate?renderDetail(candidate.product,{...candidate.listing,imageRightsConfirmed:candidate.terms.imageRightsConfirmed===true,selectedVariant:candidate.terms.selectedVariant}):null;
  const button=(label,fn,disabled=false)=><button type="button" className="btn btn-sm" disabled={busy||disabled} onClick={()=>run(fn)}>{label}</button>;
  const input=(label,value,onChange,type='text')=><label style={{display:'grid',gap:4,fontSize:12}}>{label}<input className="inp" type={type} min={type==='number'?0:undefined} step={type==='number'?'any':undefined} value={value ?? ''} onChange={e=>onChange(e.target.value)}/></label>;
  return <details data-testid="purchase-agency-panel" style={{marginTop:16,borderTop:'1px solid var(--line)',paddingTop:12}}>
    <summary style={{cursor:'pointer',fontWeight:600}}>해외구매대행 조사 · 상세페이지 준비 (로컬 전용)</summary>
    <p role="status" style={{fontSize:12,margin:'12px 0'}}>{message}</p>
    <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {button('저장 후보 불러오기',async()=>setRecords(await api({action:'list'})),dirty)}
        <select className="inp" aria-label="저장 후보" disabled={dirty} value={candidate?.id || ''} onChange={e=>{const c=records.find(r=>r.id===e.target.value);if(c)accept(c);}}>
          <option value="">후보 선택</option>{records.map(c=><option key={c.id} value={c.id}>{c.product.title || c.id}</option>)}
        </select>
      </div>
      <h3>1. 1688 탐색</h3>
      {input('중국어 검색어',query,setQuery)}{button('1688 검색',async()=>setOffers((await api({action:'search',query})).offers))}
      <ul>{offers.map(o=><li key={o.url}><button type="button" onClick={()=>setUrl(o.url)}>{o.title || o.url}</button></li>)}</ul>
      {input('1688 상품 URL',url,setUrl)}{button('후보 수집·저장',async()=>accept(await api({action:'collect',url})),dirty)}
      {candidate&&<>
        <p>{candidate.product.title} · MOQ {candidate.product.minOrderQty ?? '미확인'} · {candidate.product.supplier?.name || '공급사 미확인'}</p>
        <h3>2. 국내 비교</h3>
        {input('국내 검색어',marketQuery,setMarketQuery)}{button('국내 경쟁 조사',async()=>accept(await api({action:'market',id:candidate.id,revision:candidate.revision,query:marketQuery})),dirty)}
        <p style={{fontSize:12}}>표시가격 기준입니다. 광고·옵션·수량을 대조해야 하며 누적 리뷰는 최근 판매량이 아닙니다.</p>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:12}}><thead><tr><th>동일 구성</th><th>상품</th><th>가격</th><th>배송비</th><th>리뷰</th></tr></thead><tbody>
          {candidate.market?.competitors.map(c=><tr key={c.id}>
            <td><input aria-label={`${c.title} 비교 선택`} type="checkbox" checked={c.comparable} onChange={e=>changeComparison(c.id,{comparable:e.target.checked})}/></td>
            <td><a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>{c.isAd?' (광고)':''}</td><td>{c.priceKrw.toLocaleString()}원</td>
            <td><input className="inp" aria-label={`${c.title} 배송비`} type="number" min="0" value={c.shippingKrw ?? ''} placeholder="미확인" style={{width:90}} onChange={e=>changeComparison(c.id,{shippingKrw:e.target.value})}/></td><td>{c.reviewCount ?? '미확인'}</td>
          </tr>)}
        </tbody></table></div>
        <h3>3. 단건 비용 · 검증</h3>
        <label>판매 옵션 <select className="inp" value={candidate.terms.selectedVariant || ''} onChange={e=>edit('terms','selectedVariant',e.target.value)}><option value="">선택 필요</option>{candidate.product.variants?.map(v=><option key={v.id} value={v.name}>{v.name} · ¥{v.priceCny ?? '미확인'}</option>)}</select></label>
        <p style={{fontSize:12}}>모르는 값은 빈칸으로 두세요. 국제운송비에 국내 배송이 포함된 경우 별도 국내운송비만 0으로 입력합니다.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>{Object.entries(costFields).map(([k,label])=><React.Fragment key={k}>{input(label,candidate.terms[k],v=>edit('terms',k,v),'number')}</React.Fragment>)}</div>
        {input('수요 판단 근거 (리뷰 추이·옵션 대조 등)',candidate.terms.demandEvidence,v=>edit('terms','demandEvidence',v))}
        {input('근거 URL',candidate.terms.evidenceUrl,v=>edit('terms','evidenceUrl',v))}
        {materialDirty&&<p>내용을 바꾸면 이전 검증이 해제됩니다. 먼저 변경사항을 저장한 뒤 확인 항목을 다시 검토해 주세요.</p>}
        <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}>{Object.entries(confirmations).map(([k,label])=><label key={k}><input type="checkbox" disabled={materialDirty} checked={candidate.terms[k]===true} onChange={e=>edit('terms',k,e.target.checked)}/>{label} 확인</label>)}</div>
        <p>판정: {analysis.status} · 예상 공헌이익 {analysis.profitKrw==null?'미산정':`${analysis.profitKrw.toLocaleString()}원 (${analysis.marginPercent.toFixed(1)}%)`}</p>
        <ul>{analysis.blockers.map(b=><li key={b}>{b}</li>)}</ul>
        <h3>4. 상세페이지 초안</h3>
        {Object.entries({name:'한국어 상품명',description:'확인된 설명',specs:'사양 및 구성',deliveryText:'확정 배송 안내',returnText:'확정 교환·반품 안내'}).map(([k,label])=><label key={k} style={{display:'grid',gap:4,margin:'8px 0'}}>{label}<textarea className="inp" aria-label={label} rows={2} value={candidate.listing[k] || ''} onChange={e=>edit('listing',k,e.target.value)}/></label>)}
        <p>{detail.status} · 이미지 사용권 미확인 시 사진을 넣지 않습니다. 저장과 다운로드는 상품 게시가 아닙니다.</p>
        <iframe title="상품 상세페이지 초안" sandbox="" srcDoc={detail.html} style={{width:'100%',height:420,border:'1px solid #ddd',background:'#fff'}}/>
        {button(dirty?'변경사항 저장':'후보 저장',save)}
        {button('HTML 초안 다운로드',async()=>download(`detail-${candidate.id}.html`,detail.html,'text/html'))}
        <h3>5. 등록 준비</h3>
        <p>스토어 심사·커머스 API 권한 확인 대기. 실제 등록 API 호출은 구현/활성화하지 않았습니다.</p>
        {button('저장된 등록 준비 자료 다운로드',async()=>download(`preparation-${candidate.id}.json`,JSON.stringify(await api({action:'export',id:candidate.id}),null,2),'application/json'),dirty)}
      </>}
    </fieldset>
  </details>;
}
