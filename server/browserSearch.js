import { chromium } from 'playwright-core';
import { disconnectFromCdp } from './collect1688.js';
import { numberOrNull, publicUrl } from '../src/purchaseAgency.js';

async function withSearchPage(url, read) {
  let browser;
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', {timeout:5000}); }
  catch { throw new Error('전용 브라우저를 먼저 실행하세요: npm run 1688:browser'); }
  let page;
  let keep = false;
  try {
    page = await browser.contexts()[0].newPage();
    await page.goto(url, {waitUntil:'domcontentloaded',timeout:25000});
    const ensureAccess = async () => {
      const title = await page.title();
      const url = new URL(page.url());
      const body = await page.locator('body').innerText().catch(()=>'');
      if (/captcha|보안 확인|접근이 제한|비정상적인 접근|安全验证|验证码/i.test(title + '\n' + body) || /login\.taobao\.com|login\.1688\.com|nid\.naver\.com|sec\.1688\.com/.test(url.hostname)) {
        keep = true;
        await page.bringToFront();
        throw Object.assign(new Error('열린 전용 브라우저에서 로그인/보안 인증을 완료한 뒤 다시 실행하세요.'), {code:'HUMAN_REQUIRED'});
      }
    };
    return await read(page, ensureAccess);
  } finally {
    if (page && !keep) await page.close().catch(()=>{});
    disconnectFromCdp(browser);
  }
}

export async function search1688Products(query) {
  if (typeof query !== 'string' || !query.trim() || query.length>100) throw new Error('중국어 검색어를 100자 이하로 입력하세요.');
  return withSearchPage('https://s.1688.com/selloffer/offer_search.htm', async (page,ensureAccess) => {
    await ensureAccess();
    const input = page.locator('#alisearch-input');
    await input.waitFor({timeout:10000});
    await input.fill(query.trim());
    await input.press('Enter');
    await page.waitForTimeout(2500);
    await ensureAccess();
    const links = await page.locator('a[href*="detail.1688.com/offer/"]').evaluateAll(es=>es.map(e=>{
      const text=e.closest('.offer-item,.offer-card,li')?.innerText||'';
      const quantities=[...text.matchAll(/(?:^|\s)(\d+)\s*(?:件|个|套)\s*起批/g)].map(m=>Number(m[1]));
      return {title:e.innerText.trim().slice(0,150),url:e.href.split('?')[0],cardMoq:quantities.length===1?quantities[0]:null};
    }));
    const seen = new Set();
    const offers = links.filter(e=>/^https:\/\/detail\.1688\.com\/offer\/\d+\.html$/.test(e.url)&&!seen.has(e.url)&&seen.add(e.url)).slice(0,12);
    return {offers,observedAt:new Date().toISOString(),source:'1688_BROWSER',message:offers.length ? '' : '검색 결과를 확인하지 못했습니다. 상품 URL을 직접 입력할 수 있습니다.'};
  });
}

export function normalizeBrowserMarket(rows, query) {
  const money = text => {
    const match = String(text || '').trim().match(/^(?:배송비\s*)?([\d,]+)\s*원?$/);
    return match ? numberOrNull(match[1].replace(/,/g,'')) : null;
  };
  const seen = new Set();
  const competitors = [];
  for (const row of rows) {
    const url = publicUrl(row.url);
    const priceKrw = money(row.price);
    if (!url || new URL(url).hostname === 'search.shopping.naver.com' || !priceKrw || !row.title || seen.has(url)) continue;
    seen.add(url);
    const shipping = /^(?:배송비\s*)?무료(?:배송)?$/.test((row.shipping || '').trim()) ? 0 : money(row.shipping);
    const reviewCount = /^[\d,]+$/.test(row.reviews || '') ? numberOrNull(row.reviews.replace(/,/g,'')) : null;
    competitors.push({id:String(competitors.length+1),title:row.title.slice(0,200),url,priceKrw,shippingKrw:shipping,reviewCount,mall:row.mall || '',isAd:row.isAd === true,comparable:false,source:'NAVER_BROWSER'});
  }
  return {source:'NAVER_BROWSER',query,observedAt:new Date().toISOString(),competitors:competitors.slice(0,20),limitations:['표시된 검색 카드 기준입니다. 옵션·구성·배송 조건을 대조해야 합니다.','누적 리뷰 수는 최근 판매량이 아닙니다.']};
}

export async function searchNaverBrowser(query) {
  if (typeof query !== 'string' || !query.trim() || query.length>100) throw new Error('검색어를 100자 이하로 입력하세요.');
  return withSearchPage('https://search.shopping.naver.com/search/all?query='+encodeURIComponent(query), async(page,ensureAccess)=>{
    await page.waitForTimeout(2000);
    await ensureAccess();
    const rows = await page.evaluate(()=>{
      const links = [...document.querySelectorAll('a[class*="product_link"],a[class*="adProduct_link"]')];
      return links.map(a=>{
        const card = a.closest('[class*="product_inner"],[class*="adProduct_inner"]');
        const text = selector=>card?.querySelector(selector)?.textContent?.trim() || '';
        return {title:a.textContent.trim(),url:a.href,price:text('[class*="price_num"]'),shipping:text('[class*="delivery_fee"]'),reviews:text('[class*="adProduct_review"] [class*="count"],[class*="product_review"] [class*="count"]'),mall:text('a[class*="adProduct_mall__"],a[class*="product_mall__"]'),isAd:a.className.includes('adProduct_')};
      });
    });
    return normalizeBrowserMarket(rows,query);
  });
}
