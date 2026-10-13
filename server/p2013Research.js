// Curated public research checkpoint. No credentials, sessions, or licensed images.
const sourceUrl='https://detail.1688.com/offer/816692570613.html';
const observedAt='2026-10-13T03:15:00.000Z';
const variant='P2013 검정 · 탄소강';

export function seedP2013Research(store) {
  const product={offerId:'816692570613',canonicalUrl:sourceUrl,source:'CURATED_RESEARCH',
    title:'P2013 회전 접이식 태블릿 거치대 · 검정',minOrderQty:1,
    variants:[{id:'p2013-black',name:variant,priceCny:16.5}],images:[],supplier:{name:''},collectedAt:observedAt};
  const initial={
    terms:{selectedVariant:variant,purchasePriceCny:16.5,demandEvidence:'유사 제품 모락: 누적 리뷰 745건, 최근 3개월 21명 재구매 및 10월 리뷰. P2013 자체 판매량은 미확인.',evidenceUrl:'https://smartstore.naver.com/mimideshop/products/10866461573'},
    market:{source:'CURATED_RESEARCH',observedAt,competitors:[
      {id:'laaon',title:'LAAON ITB-ST300',mall:'오늘의집',priceKrw:8500,shippingKrw:0,reviewCount:0,url:'https://store.ohou.se/goods/3512224',comparable:false,note:'170g 소형 대체재. 동급 사양 아님.'},
      {id:'leto',title:'레토 LTS-R02 회전 접이식 거치대',mall:'GS SHOP',priceKrw:14900,shippingKrw:0,reviewCount:2,url:'https://www.gsshop.com/prd/prd.gs?prdid=1087932667',comparable:false,note:'기능 대체재. 리뷰 2026-02-11 / 08-20. 동일 OEM 미확인.'},
      {id:'morac',title:'모락 볼드 M1',mall:'모락스토어',priceKrw:15900,shippingKrw:3000,reviewCount:745,url:'https://smartstore.naver.com/mimideshop/products/10866461573',comparable:false,note:'멤버십 무료배송 표시. 최근 3개월 21명 재구매. P2013 수요로 환산 불가.'},
    ]},
    research:{observedAt,selectedVariant:variant,stock:13,
      package:{weightG:446,dimensionsCm:[18.5,14,4.5],measured:false,note:'원문 SKU 포장표 관찰값. 순/총중량 구분은 외부 재게시 설명에서만 확인. 국제 발송 추가 포장 미확정. 0.5kg까지 여유 54g.'},
      demand:'유사 제품군의 최근 수요 신호는 있음. P2013의 동일 모델 수요·월 판매량은 미검증.',
      sources:[{label:'1688 선택 옵션·포장표',url:sourceUrl},{label:'퀵스타 해운(자가) 일반셀러 공개표',url:'https://www.quickstar.co.kr/guide/guide_12.php?tr_no=38'},{label:'모락 최근 수요 근거',url:'https://smartstore.naver.com/mimideshop/products/10866461573'},{label:'총중량 구분 보조 자료 (재게시)',url:'https://gobozor.tut.uz/ru/product/816692570613'}],
      salePriceKrw:14900,purchasePriceCny:16.5,fxKrwPerCny:211,purchaseFeePercent:5,platformFeePercent:6,returnPercent:3,minProfitKrw:3000,minMarginPercent:20,
      assumptions:['판매가=고객 결제 총액, 무료배송 판매 가정. 국내 배송은 퀵스타 운임에 포함되어 중복 합산하지 않음.',
        '중국 배송 6/10위안·구매 수수료 5%·플랫폼/결제 6%·반품 충당 3%·포장 예비비·광고 10%는 미확정 가정.',
        '211원/CNY는 조사 당시 퀵스타 표시값. 실제 결제 환율 미확정.',
        '유리 조건: 0.5kg 5,400원, VAT 추가 없음 가정. 보수/스트레스: 1kg 6,200원에 VAT 10%를 추가한 가정.',
        '기여이익 3,000원·20%는 임시 검토 기준이며 확정 운영 정책이 아님.',
        '예상 세전 기여이익이며 순이익 아님. 세금·인건비·고정비·미확정 통관비·쿠폰 제외. 실제 반품비는 충당액을 넘을 수 있음.'],
      scenarios:[
        {id:'favorable',label:'유리한 조건',chinaShippingCny:6,internationalShippingKrw:5400,otherCostKrw:0,advertisingPercent:0},
        {id:'conservative',label:'보수 조건',chinaShippingCny:6,internationalShippingKrw:6820,otherCostKrw:500,advertisingPercent:0},
        {id:'stress',label:'스트레스 조건',chinaShippingCny:10,internationalShippingKrw:6820,otherCostKrw:1000,advertisingPercent:10},
      ]},
    review:{status:'HOLD',stale:false,reviewedAt:observedAt,note:'상세페이지 제작·실제 등록 보류. 비용 또는 차별성 근거 확보 후 재검토.',reasons:[
      '국내 레토 14,900원 무료배송 대비 가격·납기 차별성 부족.',
      '14,900원 판매 시 보수 조건 기여이익 약 1,317원(8.8%). 광고·추가비용에 취약.',
      '포장 실측·중국 배송·운임 VAT·부가비용 미확정. 표시 재고 13개로 지속 공급 미검증.',
      'P2013 자체 수요·동등 사양 경쟁상품·이미지 사용권·판매 적합성 미확인.',
    ]},
  };
  const existing=store.list().find(c=>c.id===product.offerId);
  if(!existing)return store.create(product,initial);
  if(existing.research&&existing.review)return existing;
  if(existing.publication.status!=='NOT_PUBLISHED')return existing;
  // Add dated research only; never replace the user's collected product, quotes or draft.
  return store.update(existing.id,existing.revision,{
    research:existing.research || initial.research,
    review:existing.review || initial.review,
    market:existing.market || initial.market,
  });
}
