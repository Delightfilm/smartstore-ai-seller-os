// Read-only cross-runtime verification. Prints SELECT SQL; no database credentials.
import { normalizeProduct } from '../src/domain/normalizedProduct.js';
import { discoveryEstimate } from '../src/domain/discoveryEstimate.js';
const observedAt=new Date().toISOString(),url='https://detail.1688.com/offer/99999800001.html';
const profile={salePriceKrw:8000,fxKrwPerCny:211,chinaShippingCny:5,shippingLowKrw:1000,shippingBaseKrw:3000,shippingHighKrw:5000,otherCostKrw:500,feePercent:4,returnPercent:3,minProfitKrw:1000,minMarginPercent:10,basis:'Cross-runtime rollback-free calculation test only.'};
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
const cases=[1,2.1,3.5,0.00000001,100000000].map((price,index)=>{
 const obs=normalizeProduct({offerId:'99999800001',sourceUrl:url,title:'CALCULATION ONLY',observedAt,skuSetComplete:true,skus:[{skuId:'fixture',label:'fixture',price:{value:price,unit:'CNY'}}]});
 const p={...profile,...(index===2?{salePriceKrw:11900,shippingLowKrw:5400,shippingBaseKrw:7000,shippingHighKrw:10000}:{}),...(index===4?{fxKrwPerCny:100000}:{} )};
 const expected=discoveryEstimate(obs,p);
 return `SELECT '${index}' AS case_id, seller_os_private.discovery_estimate(${literal(obs)},${literal(p)}) = ${literal(expected)} AS identical`;
});
console.log(cases.join('\nUNION ALL\n')+';');
