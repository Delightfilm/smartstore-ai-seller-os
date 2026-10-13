import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrowserMarket } from '../server/browserSearch.js';
import { searchNaverMarket } from '../server/naverMarket.js';

test('market ignores UI controls and ambiguous money strings',()=>{
  const r=normalizeBrowserMarket([
    {title:'상품만 보기',url:'https://search.shopping.naver.com/search/all?q=x#',price:'25,900원'},
    {title:'상품',url:'https://smartstore.naver.com/x/products/3',price:'15,900원',shipping:'3만원 이상 무료'},
    {title:'옵션 범위',url:'https://smartstore.naver.com/x/products/4',price:'10,000~20,000원',shipping:'무료'},
  ],'상품');
  assert.equal(r.competitors.length,1);
  assert.equal(r.competitors[0].shippingKrw,null);
});

test('browser market keeps full price, exact review count and unknown delivery separate',()=>{
  const r=normalizeBrowserMarket([{title:'상품',url:'https://smartstore.naver.com/x/products/1',price:'25,900원',shipping:'배송비3,000원',reviews:'1,250'}, {title:'다른 상품',url:'https://smartstore.naver.com/x/products/2',price:'16,000원',shipping:'',reviews:'4.2만'}],'상품');
  assert.equal(r.competitors[0].priceKrw,25900);
  assert.equal(r.competitors[0].shippingKrw,3000);
  assert.equal(r.competitors[0].reviewCount,1250);
  assert.equal(r.competitors[1].shippingKrw,null);
  assert.equal(r.competitors[1].reviewCount,null);
});

test('official market adapter passes encoded query and never invents reviews',async()=>{
  const r=await searchNaverMarket('수납 함',{NAVER_CLIENT_ID:'test-id',NAVER_CLIENT_SECRET:'test-secret'},async(url,options)=>{
    assert.equal(new URL(url).searchParams.get('query'),'수납 함');
    assert.equal(options.headers['X-Naver-Client-Id'],'test-id');
    return {ok:true,json:async()=>({items:[{title:'<b>수납 함</b>',lprice:'12000',link:'https://smartstore.naver.com/x/products/1'}]})};
  });
  assert.equal(r.competitors[0].reviewCount,null);
  assert.equal(r.competitors[0].priceKrw,12000);
});
