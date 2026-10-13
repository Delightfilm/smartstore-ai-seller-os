import { structuredDocuments, productCandidates } from './parse1688.js';
import { supportedOfferUrl } from '../src/domain/source1688.js';

export function researchDiagnostics(html) {
  const documents=structuredDocuments(html),paths=[];let visited=0;
  function inspect(value,path,depth) {
    if(depth>7||visited++>5000||!value||typeof value!=='object')return;
    for(const key of Object.keys(value).slice(0,120)) {
      if(/sku|package|weight/i.test(key)&&paths.length<30)paths.push(`${path}.${key}`);
      inspect(value[key],`${path}.${key}`,depth+1);
    }
  }
  for(const d of documents)inspect(d.value,d.source,0);
  return {structuredDocuments:documents.length,recognizedProducts:productCandidates(documents).length,publicProductFieldPaths:paths};
}

export function chooseResearchHtml(html,state) {
  if(state.conflict)return '';
  return state.product?`<script type="application/json">${JSON.stringify({product:state.product})}</script>`:html;
}

// Deliberately small supported adapter. Unsupported/vendor-changed fields remain unknown.
// No generated variant IDs, SKU-average prices, net weights, or carton dimensions.
export function researchObservation({html,product,packingRows=[],observedAt=new Date().toISOString()}) {
  const {offerId,canonicalUrl:sourceUrl}=supportedOfferUrl(product.canonicalUrl);
  const candidates=productCandidates(structuredDocuments(html));
  const sources=candidates.filter(c=>!c.jsonLd&&String(c.product.offerId??c.product.id)===offerId&&c.product.skuModel?.skuInfoMap).map(c=>c.product);
  const unique=[...new Map(sources.map(p=>[JSON.stringify({skus:p.skuModel.skuInfoMap,moq:p.minOrderQuantity??p.minOrderQty??p.minOrder??p.moq}),p])).values()];
  const source=unique.length===1?unique[0]:null;
  const map=source?.skuModel?.skuInfoMap;
  const evidence=(value,unit,skuId,semantic=null,level='sku')=>({value,unit,sourceUrl,observedAt,kind:'observed',confirmed:value!==null&&value!==undefined,semantic,scope:{skuId,quantity:1,level}});
  const moq=source?.minOrderQuantity??source?.minOrderQty??source?.minOrder??source?.moq??product.minOrderQty;
  const offerMoq=evidence(moq,'piece',null,null,'offer');
  const skus=map&&typeof map==='object'&&!Array.isArray(map)?Object.entries(map).slice(0,37).map(([label,s])=>{
    const skuId=s?.skuId!=null?String(s.skuId):null;
    // Shipping rows must explicitly identify this SKU and a *single packed unit*.
    const rows=packingRows.filter(r=>r.quantity===1&&(r.skuId===skuId||(r.label===label&&Object.keys(map).filter(k=>k===label).length===1)));
    const pack=rows.length===1?rows[0]:null;
    return {skuId,label,price:evidence(s?.price,'CNY',skuId),stock:evidence(s?.canBookCount??s?.stockCount,'piece',skuId),
      moq:s?.minOrderQuantity!=null?evidence(s.minOrderQuantity,'piece',skuId):offerMoq,
      grossWeight:evidence(pack?.grossWeight??null,pack?.weightUnit??null,skuId,'packed_gross'),
      dimensions:evidence(pack?.dimensions??null,pack?.lengthUnit??null,skuId,'packed_dimensions')};
  }):[];
  return {offerId,title:product.title,sourceUrl,observedAt,moq:offerMoq,skus,images:product.images,supplier:product.supplier?.name};
}

export async function readPackingRows(page) {
  return page.evaluate(()=>{
    const output=[];
    for(const table of document.querySelectorAll('table')) {
      const rows=[...table.querySelectorAll('tr')];
      const headers=[...(rows[0]?.querySelectorAll('th,td')||[])].map(e=>e.textContent.trim());
      const find=re=>headers.findIndex(h=>re.test(h));
      const identity=find(/^(SKU|规格|规格型号|货号)$/i),weight=find(/^(包装毛重|含包装重量|毛重)\s*\(?\s*(kg|g)\s*\)?$/i);
      const dimensions=['长','宽','高'].map(key=>find(new RegExp('^包装'+key+'\\s*\\(?\\s*(cm|mm|m)\\s*\\)?$','i')));
      const quantity=find(/^(包装数量|装箱数量)$/);
      // Explicit packing semantics AND per-unit quantity are mandatory.
      if(identity<0||weight<0||dimensions.some(i=>i<0)||quantity<0)continue;
      const weightUnit=headers[weight].match(/(kg|g)/i)?.[1].toLowerCase();
      const units=dimensions.map(i=>headers[i].match(/(cm|mm|m)/i)?.[1].toLowerCase());
      if(new Set(units).size!==1)continue;
      for(const row of rows.slice(1)) {
        const cells=[...row.querySelectorAll('th,td')].map(e=>e.textContent.trim());
        const numeric=v=>/^\d+(?:\.\d+)?$/.test(v||'')?Number(v):null;
        const label=cells[identity];
        output.push({...(headers[identity].toUpperCase()==='SKU'?{skuId:label}:{label}),quantity:numeric(cells[quantity]),grossWeight:numeric(cells[weight]),weightUnit,dimensions:dimensions.map(i=>numeric(cells[i])),lengthUnit:units[0]});
      }
    }
    return output.slice(0,100);
  });
}

export async function readResearchState(page,offerId) {
  return page.evaluate(offerId=>{
    const roots=[window.__INIT_DATA__,window.__PAGE_DATA__,window.__GLOBAL_DATA__];
    const paths=roots.flatMap(r=>r?[r.product,r.offer,r.data?.product,r.data?.offer,r.globalData?.product,r.offerDetail?.product]:[]);
    const matching=paths.filter(p=>String(p?.offerId??p?.id)===offerId&&p?.skuModel?.skuInfoMap);
    const uniqueSources=[...new Map(matching.map(p=>[JSON.stringify({skus:p.skuModel.skuInfoMap,moq:p.minOrderQuantity??p.minOrderQty??p.minOrder??p.moq}),p])).values()];
    const p=uniqueSources.length===1?uniqueSources[0]:null;
    const options=[...document.querySelectorAll('.module-od-sku-selection .expand-view-item')];
    const attrs=[...new Set(options.flatMap(e=>e.getAttributeNames()))];
    const publicLists=[];
    for(const row of options.slice(0,2)){
      let fiber=row[Object.keys(row).find(k=>k.startsWith('__reactFiber$'))];
      for(let n=0;n<6&&fiber;n++,fiber=fiber.return){
        const list=fiber.memoizedProps?.dataList;
        if(Array.isArray(list))publicLists.push(list.slice(0,37).map(s=>({skuId:typeof s.skuId==='number'&&!Number.isSafeInteger(s.skuId)?null:s.skuId,specAttrs:s.specAttrs,price:s.price,canBookCount:s.canBookCount})));
      }
    }
    const lists=[...new Map(publicLists.map(list=>[JSON.stringify(list),list])).values()];
    const live=lists.length===1&&lists[0].length===options.length?lists[0]:null;
    const labels=live?.map(s=>s.specAttrs);
    const liveModel=uniqueSources.length===0&&live&&labels.every(s=>typeof s==='string'&&s.trim())&&new Set(labels).size===labels.length?{offerId,skuModel:{skuInfoMap:Object.fromEntries(live.map(s=>[s.specAttrs,s]))}}:null;
    // Only explicitly named public product identifiers are read, never arbitrary globals/cookies.
    return {conflict:uniqueSources.length>1||(uniqueSources.length===0&&lists.length>1),product:p?{offerId:p.offerId??p.id,minOrderQuantity:p.minOrderQuantity,minOrderQty:p.minOrderQty,skuModel:{skuInfoMap:Object.fromEntries(Object.entries(p.skuModel.skuInfoMap).slice(0,37).map(([label,s])=>[label,{skuId:s.skuId,price:s.price,canBookCount:s.canBookCount,stockCount:s.stockCount,minOrderQuantity:s.minOrderQuantity}]))}}:liveModel,
      diagnostics:{knownProductRoots:roots.map(r=>!!r),skuRowAttributeNames:attrs.slice(0,20),liveSkuCount:live?.length??0,scaleText:document.querySelector('.module-od-sku-selection .sell-scale-info')?.textContent?.trim().slice(0,100)}};
  },offerId);
}
