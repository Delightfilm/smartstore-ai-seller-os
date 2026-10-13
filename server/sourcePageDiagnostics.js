// Public product layout only, for unsupported vendor-selector diagnosis.
// Returned snapshots are NOT eligibility evidence and never contain globals/cookies/HTML.
export async function readSourcePageDiagnostics(page) {
  return page.evaluate(()=>{
    const text=selector=>{const e=document.querySelector(selector);return (e?.innerText||e?.textContent||'').trim().slice(0,1600)||null;};
    const scopes={price:text('.module-od-main-price'),sku:text('.module-od-sku-selection'),attributes:text('.module-od-properties')};
    const tables=[...document.querySelectorAll('table')].filter(table=>{
      const module=table.closest?.('[data-module]')?.getAttribute?.('data-module');
      return ['od_product_pack_info','od_product_attributes'].includes(module);
    }).slice(0,12).map(table=>{
      const rows=[...table.querySelectorAll('tr')];
      const cells=row=>[...(row?.querySelectorAll('th,td')||[])].slice(0,12).map(e=>e.textContent.trim().slice(0,200));
      const headers=cells(rows[0]);
      const heading=null; // An adjacent sibling need not belong to the approved public module.
      const context=table.closest?.('[data-module]')?.getAttribute?.('data-module')||null;
      const labels=[...(rows[0]?.querySelectorAll('th,td')||[])].slice(0,12).map(e=>(e.getAttribute?.('title')||e.getAttribute?.('data-title')||'').slice(0,200)||null);
      const packingNotes=rows.slice(0,36).map(cells).filter(cs=>cs.some(t=>/毛重|净重|包装|포장|총중량|순중량|상자\s*수량/.test(t)));
      return {headers,rows:rows.slice(1,6).map(cells),rowCount:rows.length,heading,context,labels,packingNotes};
    });
    const sku=document.querySelector('.module-od-sku-selection');
    const skuClasses=[...new Set([...(sku?.querySelectorAll?.('*')||[])].slice(0,100).map(e=>e.className).filter(c=>typeof c==='string'&&c).map(c=>c.slice(0,200)))].slice(0,30);
    const propHints=[];
    for(const row of [...(sku?.querySelectorAll?.('.expand-view-item')||[])].slice(0,1)){
      let fiber=row[Object.keys(row).find(k=>k.startsWith('__reactFiber$'))];
      for(let depth=0;depth<12&&fiber;depth++,fiber=fiber.return){
        const props=fiber.memoizedProps||{};
        const keys=value=>Object.keys(value).slice(0,24).map(k=>k.slice(0,100));
        propHints.push({keys:keys(props).slice(0,20),featureName:typeof props.featureName==='string'?props.featureName.slice(0,200):null,optionKeys:props.options&&typeof props.options==='object'?keys(props.options):[],valueKeys:props.value&&typeof props.value==='object'?keys(props.value):[]});
      }
    }
    return {scopes,tables,skuClasses,propHints};
  });
}
