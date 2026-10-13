import { numberOrNull, publicUrl } from '../src/purchaseAgency.js';

export function normalize1688Dom(snapshot) {
  const currency = text => {
    const match=String(text || '').trim().match(/^[¥￥]\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:起|元)?$/);
    return match ? numberOrNull(match[1].replace(/,/g,'')) : null;
  };
  const variants = (snapshot.variants || []).filter(v => typeof v.name === 'string' && v.name.trim()).slice(0,36).map((v,i)=>({id:i+1,name:v.name.trim(),priceCny:currency(v.price)}));
  const prices = variants.map(v=>v.priceCny).filter(v=>v!=null);
  const scale = String(snapshot.scale || '');
  const quantities = scale.match(/\d+/g) || [];
  const units=scale.match(/(\d+)\s*(?:件|个|套|개|세트)(?![A-Za-z])/);
  const moq = /起订|起批|최소\s*주문/.test(scale) && quantities.length === 1 && units ? numberOrNull(units[1]) : null;
  const title = typeof snapshot.title === 'string' ? snapshot.title.trim() || null : null;
  const images = [...new Set((snapshot.images || []).filter(publicUrl))].slice(0,24);
  const supplier = snapshot.supplier?.trim() ? {name:snapshot.supplier.trim()} : null;
  const result = { title, images, supplier, variants, minOrderQty: moq, priceMinCny: prices.length ? Math.min(...prices) : currency(snapshot.price), priceMaxCny: prices.length ? Math.max(...prices) : null, provenance: {} };
  for (const [key,selector] of Object.entries({title:'.module-od-title .title-content',images:'.od-gallery-list img',supplier:'.shop-company-name',variants:'.module-od-sku-selection .expand-view-item',minOrderQty:'.module-od-sku-selection .sell-scale-info',priceMinCny:prices.length ? '.module-od-sku-selection .item-price-stock' : '.module-od-main-price .price-info',priceMaxCny:'.module-od-sku-selection .item-price-stock'})) {
    if (result[key] != null && (!Array.isArray(result[key]) || result[key].length)) result.provenance[key] = `DOM:${selector}`;
  }
  return result;
}

export async function read1688Dom(page) {
  const snapshot = await page.evaluate(() => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    return {
      title: text('.module-od-title .title-content'), supplier:text('.shop-company-name'), price:text('.module-od-main-price .price-info'), scale:text('.module-od-sku-selection .sell-scale-info'),
      images:[...document.querySelectorAll('.od-gallery-list img')].map(e=>e.src),
      variants:[...document.querySelectorAll('.module-od-sku-selection .expand-view-item')].map(e=>({name:e.querySelector('.item-label')?.textContent,price:[...e.querySelectorAll('.item-price-stock')].map(n=>n.textContent).find(t=>/[¥￥]/.test(t))})),
    };
  });
  return normalize1688Dom(snapshot);
}
