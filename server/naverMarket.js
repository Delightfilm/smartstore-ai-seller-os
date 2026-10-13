import { normalizeMarket } from '../src/purchaseAgency.js';
import { searchNaverBrowser } from './browserSearch.js';

export async function searchNaverMarket(query, config, fetchImpl = fetch) {
  if (typeof query !== 'string' || !query.trim() || query.length>100) throw new Error('국내 검색어를 100자 이하로 입력하세요.');
  if (!config.NAVER_CLIENT_ID || !config.NAVER_CLIENT_SECRET) return searchNaverBrowser(query);
  const url = 'https://openapi.naver.com/v1/search/shop.json?display=40&sort=sim&query='+encodeURIComponent(query);
  const response = await fetchImpl(url,{headers:{'X-Naver-Client-Id':config.NAVER_CLIENT_ID,'X-Naver-Client-Secret':config.NAVER_CLIENT_SECRET},signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`네이버 검색 API 오류 HTTP ${response.status}. 키와 검색 API 권한을 확인하세요.`);
  return {...normalizeMarket(await response.json()),query};
}
