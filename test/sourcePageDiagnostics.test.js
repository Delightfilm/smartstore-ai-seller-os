import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readSourcePageDiagnostics } from '../server/sourcePageDiagnostics.js';
test('public source diagnostics retain displayed MOQ/table headings without fabricating packaging or exposing page globals',async()=>{
 const elements={'.module-od-main-price':{textContent:'1件起批 ¥12'},'.module-od-sku-selection':{textContent:'黑色 ¥12 20件库存'}};
 const table={closest:()=>({getAttribute:()=> 'od_product_pack_info'}),querySelectorAll:()=>[{querySelectorAll:()=>[{textContent:'规格型号'},{textContent:'毛重(g)'},{textContent:'包装长(cm)'}]}]};
 const document={querySelector:s=>elements[s]||null,querySelectorAll:s=>s==='table'?[table]:[]};
 const page={evaluate:async fn=>runInNewContext(`(${fn.toString()})()`,{document,window:{privateCookie:'NEVER_EXPORT'}})};
 const result=await readSourcePageDiagnostics(page);
 assert.equal(result.scopes.price,'1件起批 ¥12');assert.equal(result.tables[0].headers[1],'毛重(g)');
 assert.ok(!JSON.stringify(result).includes('NEVER_EXPORT'));assert.equal(result.eligible,undefined);
});
test('unrelated logged-in account tables are never exported as public product diagnostics',async()=>{
 const privateTable={closest:()=>null,querySelectorAll:()=>[{querySelectorAll:()=>[{textContent:'private@example.invalid'}]}]};
 const document={querySelector:()=>null,querySelectorAll:s=>s==='table'?[privateTable]:[]};
 const page={evaluate:async fn=>runInNewContext(`(${fn.toString()})()`,{document,window:{}})};
 const result=await readSourcePageDiagnostics(page);
 assert.equal(result.tables.length,0);
 assert.ok(!JSON.stringify(result).includes('private@example.invalid'));
});
