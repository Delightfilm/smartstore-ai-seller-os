// Local editorial suggestions, not product classification or verified claims.
export const artCategories = [
 {id:'desk',label:'문구·데스크 정리',audience:'책상 위 문구를 정리하려는 사용자',question:'자주 쓰는 문구를 어디에 어떻게 모을까?',photo:'원본의 전체 형태·열린 입구·실제 문구 수납 장면을 대조. 탑뷰는 원본에 있을 때만 사용.',headlines:['책상 위, 각자의 자리','나의 문구를 모으는 방식','형태를 보고, 용도를 고르세요'],names:['클린 데스크형','컬러 문구 편집숍형','실용 카탈로그형']},
 {id:'beauty',label:'화장품·액세서리 수납',audience:'화장대의 작은 물건을 구분하려는 사용자',question:'내 화장품·액세서리를 어떤 공간에 둘까?',photo:'칸의 입구·높이·배치가 보이는 원본 우선. 거울·조명 연출은 상품 경계 밖에만. 사진 속 품목의 포함 여부 확인.',headlines:['작은 물건을 위한 자리','오늘의 취향을 정리하다','칸과 구성을 먼저 확인하세요'],names:['드레싱 테이블형','부티크 에디토리얼형','칸별 선택 가이드형']},
 {id:'tech',label:'거치대·디지털 주변용품',audience:'기기 배치와 사용 자세를 확인하려는 사용자',question:'내 기기·공간·사용 자세에 맞을까?',photo:'받침·힌지·접점·설치 방향을 보여주는 원본. 없는 각도나 기기 합성으로 호환·안정성을 증명하지 않기.',headlines:['내 기기를 놓는 방식','작업 공간의 새로운 배치','구조와 사용 범위를 확인하세요'],names:['테크 구조형','워크스테이션형','핏·호환 확인형']},
 {id:'household',label:'주방·생활 편의',audience:'일상 공간을 용도에 맞게 정리하려는 사용자',question:'어디에 놓고 어떤 순서로 사용할까?',photo:'실제 설치·분리·사용 단계와 공간 전체가 보이는 원본. 가짜 전후·내하중·위생 시험 장면 금지.',headlines:['생활 공간을 쓰는 방법','일상에 맞춘 작은 변화','사용 순서부터 확인하세요'],names:['생활 문제 해결형','홈 스타일링형','사용 설명서형']},
 {id:'general',label:'기타·품목 확인 필요',audience:'상품의 실제 쓰임을 확인하려는 사용자',question:'어떤 상품이며 선택 전에 무엇을 확인해야 할까?',photo:'상품 정체·전체 구성부터 확인. 출처 사진이 부족하면 촬영/자료 요청 목록을 작성.',headlines:['상품을 자세히 살펴보세요','나에게 맞는 쓰임 찾기','확인된 정보를 한눈에'],names:['제품 중심형','라이프스타일 제안형','정보 카탈로그형']},
];
const references = [
 {name:'MUJI 정리 트레이',url:'https://www.muji.com/jp/ja/store/cmdty/detail/4548076403227',take:'규격·구성·용도 설명의 구분',checkedAt:'2026-10-16'},
 {name:'HAY Colour Storage',url:'https://www.hay.com/hay/accessories/indoor-living/storage/colour-storage-large-chalk-white',take:'색상·크기별 선택과 공간 스타일링',checkedAt:'2026-10-16'},
 {name:'OXO 서랍 정리함',url:'https://www.oxo.com/adjustable-deep-drawer-organizer.html',take:'사용 문제→구조→사양·사용 안내',checkedAt:'2026-10-16'},
];
const compositions = [
 {id:'clean',palette:['#F5F6F3','#1B2B29','#526B64'],layout:'넓은 제품 컷 → 짧은 좌측 제목 → 구조 확대 → 사용 장면. 여백과 사진 크기의 대비.',copyTone:'짧고 구체적인 설명. 감성 문장은 도입 한 번만.',sequence:['hero','usage','structure','feature-a','options','size','contents','faq','information'],reference:0},
 {id:'color',palette:['#FFF2DD','#263B61','#BE4930'],layout:'큰 타이포와 색면 → 비대칭 제품 컷 → 편집 지면형 사용 이야기 → 옵션 비교. 같은 텍스트/사진 틀 반복 금지.',copyTone:'취향과 사용 상황을 연결하되 물성·효능을 꾸미지 않기.',sequence:['hero','problem','usage','feature-a','feature-b','options','contents','care','information'],reference:1},
 {id:'catalog',palette:['#FFFFFF','#182C25','#526159'],layout:'상품 사진 + 정보 요약의 분할 지면 → 구조별 설명 → 옵션 비교표 → 확인된 사양. 실측은 근거가 있을 때만.',copyTone:'선택에 필요한 차이를 먼저 설명. 수치·호환은 확인된 것만.',sequence:['hero','options','contents','structure','size','usage','care','faq','information'],reference:2},
];

function suggestCategory(facts){
 const title=`${facts.title||''} ${facts.sourceTitle||''}`.toLowerCase();
 if(/화장|보석|액세서리|化妆|首饰|耳钉|珠宝|cosmetic|jewel/.test(title))return 'beauty';
 if(/거치|태블릿|노트북|支架|平板|笔记本|laptop|tablet|stand/.test(title))return 'tech';
 if(/주방|서랍|厨房|抽屉|kitchen|drawer/.test(title))return 'household';
 if(facts.id==='675246155709'||/메모|문구|데스크|책상|文具|笔筒|桌面|memo|desk/.test(title))return 'desk';
 return 'general';
}

export function buildArtDirection(facts,choice={}){
 const categoryId=choice?.categoryId||suggestCategory(facts);
 const category=artCategories.find(c=>c.id===categoryId);
 const conceptId=choice?.conceptId||'clean';
 if(!category||!compositions.some(c=>c.id===conceptId))throw new Error('품목 또는 콘셉트 선택이 유효하지 않습니다. 비교 화면에서 다시 선택하세요.');
 const concepts=compositions.map((c,i)=>({...c,name:category.names[i],heroTitle:category.headlines[i],buyerQuestion:category.question,photography:category.photo,reference:references[c.reference],copyStatus:'DRAFT_NOT_VERIFIED'}));
 return {guideVersion:3,candidateId:facts.id,revision:facts.revision,
  category:{id:category.id,label:category.label,status:'SUGGESTED_NOT_VERIFIED',requiresConfirmation:true,reason:choice?.categoryId?'운영자 지정 품목. 상품 적합성·검증 완료를 뜻하지 않음':'저장된 상품명 기반 제안. 잘못 분류되면 직접 변경'},
  audience:category.audience,selection:{conceptId,source:choice?.conceptId?'OPERATOR_SELECTION':'LOCAL_RECOMMENDATION'},
  previewKind:'SOURCE_PHOTO_LAYOUT_STUDY',imageRightsConfirmed:facts.imageRightsConfirmed===true,concepts,
  rules:['원본 사진 기반 레이아웃 예시이며 실제 GPT 생성 결과/판매 승인 아님','색만 바꾸지 말고 사진 구도·정보 순서·밀도를 다르게 구성','촬영 지시는 제안일 뿐, 해당 원본/실측이 없으면 보류','참고 브랜드의 사진·카피·로고·상품 특성은 복제하지 않기','선택 콘셉트가 달라져도 권리·SKU·사실 검수는 유지'],
 };
}
