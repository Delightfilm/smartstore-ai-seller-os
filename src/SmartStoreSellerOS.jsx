import React, { useReducer, useContext, createContext, useMemo, useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Search, Package, FileImage, ClipboardCheck, Store, ShoppingCart,
  Settings as SettingsIcon, Moon, Sun, ChevronRight, ChevronLeft, Check, X, Pause,
  AlertTriangle, TrendingUp, TrendingDown, Sparkles, RefreshCw, Eye, Lock,
  ArrowRight, Info, Wallet, Activity, Filter, Layers, Truck, ExternalLink, Plus,
  CircleDot, ShieldCheck, ShieldAlert, Boxes, Loader2, PanelLeftClose, PanelLeft,
} from "lucide-react";

/* ============================================================================
   DESIGN TOKENS
   방향: 브리프가 지정한 Linear / Vercel / Stripe 계열 미니멀 SaaS.
   축: 중성 슬레이트 표면 + 단일 인디고 액센트 + 등급 전용 데이터 팔레트.
   숫자(금액·점수)는 tabular-nums 고정폭으로 세로 정렬을 맞춘다 —
   이 제품은 숫자를 비교하는 도구이므로 정렬이 곧 가독성이다.
============================================================================ */
const TOKENS = `
[data-app]{
  --bg:#FBFBFC; --surface:#FFFFFF; --surface-2:#F6F7F9; --surface-3:#EFF1F4;
  --line:#E4E7EC; --line-strong:#D3D8E0;
  --text:#14161A; --text-2:#5B6470; --text-3:#8A929E;
  --accent:#4A5FE7; --accent-fg:#FFFFFF; --accent-soft:#EDF0FE; --accent-line:#C7D0FB;
  --pos:#0E8A5F; --pos-soft:#E6F5EF;
  --neg:#C4362F; --neg-soft:#FCEDEC;
  --warn:#9A6410; --warn-soft:#FDF3E2;
  --gS:#4A5FE7; --gA:#0E8A5F; --gB:#9A6410; --gC:#8A929E; --gD:#B0B6BF;
  --shadow:0 1px 2px rgba(20,22,26,.05), 0 1px 3px rgba(20,22,26,.04);
  --shadow-lg:0 8px 24px rgba(20,22,26,.10), 0 2px 6px rgba(20,22,26,.06);
  --radius:8px;
}
[data-app][data-theme="dark"]{
  --bg:#0B0C0E; --surface:#131519; --surface-2:#191C21; --surface-3:#21252B;
  --line:#25292F; --line-strong:#343A42;
  --text:#EDEFF2; --text-2:#98A1AD; --text-3:#6B747F;
  --accent:#7E8DF5; --accent-fg:#0B0C0E; --accent-soft:#1B1F33; --accent-line:#2E3760;
  --pos:#3DBE8B; --pos-soft:#12241D;
  --neg:#F0736A; --neg-soft:#2A1616;
  --warn:#D9A03F; --warn-soft:#261D0C;
  --gS:#7E8DF5; --gA:#3DBE8B; --gB:#D9A03F; --gC:#6B747F; --gD:#4A5159;
  --shadow:0 1px 2px rgba(0,0,0,.4); --shadow-lg:0 12px 32px rgba(0,0,0,.5);
}
[data-app]{
  background:var(--bg); color:var(--text); min-height:100%;
  font-family:ui-sans-serif,-apple-system,"Pretendard","Apple SD Gothic Neo",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; font-size:14px; line-height:1.5;
}
[data-app] *{box-sizing:border-box;}
.num{font-variant-numeric:tabular-nums; letter-spacing:-.01em;}
.mono{font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:.92em;}
.surf{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius);}
.surf-2{background:var(--surface-2);}
.t2{color:var(--text-2);} .t3{color:var(--text-3);}
.hair{border-color:var(--line);}
.eyebrow{font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--text-3);}
.btn{display:inline-flex; align-items:center; justify-content:center; gap:6px;
  border-radius:6px; font-weight:500; border:1px solid transparent; cursor:pointer;
  transition:background .12s, border-color .12s, color .12s; white-space:nowrap;}
.btn:focus-visible{outline:2px solid var(--accent); outline-offset:2px;}
.btn-sm{height:28px; padding:0 10px; font-size:12.5px;}
.btn-md{height:34px; padding:0 14px; font-size:13.5px;}
.btn-primary{background:var(--accent); color:var(--accent-fg);}
.btn-primary:hover{filter:brightness(1.08);}
.btn-ghost{background:transparent; color:var(--text-2); border-color:var(--line);}
.btn-ghost:hover{background:var(--surface-2); color:var(--text);}
.btn-quiet{background:transparent; color:var(--text-2);}
.btn-quiet:hover{background:var(--surface-2); color:var(--text);}
.btn-pos{background:var(--pos-soft); color:var(--pos); border-color:transparent;}
.btn-pos:hover{filter:brightness(.97);}
.btn-neg{background:transparent; color:var(--neg); border-color:var(--line);}
.btn-neg:hover{background:var(--neg-soft);}
.btn:disabled{opacity:.42; cursor:not-allowed;}
.chip{display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 8px;
  border-radius:5px; font-size:11.5px; font-weight:600; letter-spacing:.01em;}
.inp{height:34px; padding:0 10px; border-radius:6px; background:var(--surface);
  border:1px solid var(--line); color:var(--text); font-size:13.5px; width:100%;}
.inp:focus{outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft);}
.navitem{display:flex; align-items:center; gap:9px; height:32px; padding:0 9px;
  border-radius:6px; color:var(--text-2); font-size:13.5px; cursor:pointer; width:100%;
  border:none; background:transparent; text-align:left; transition:background .1s;}
.navitem:hover{background:var(--surface-2); color:var(--text);}
.navitem[data-on="1"]{background:var(--surface-3); color:var(--text); font-weight:500;}
.row-hover:hover{background:var(--surface-2);}
.bar-track{height:5px; border-radius:3px; background:var(--surface-3); overflow:hidden;}
.bar-fill{height:100%; border-radius:3px; transition:width .5s cubic-bezier(.4,0,.2,1);}
.skel{background:linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2));
  background-size:200% 100%; animation:sh 1.3s infinite;}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.fade{animation:fadeUp .28s cubic-bezier(.2,.7,.3,1) both;}
@media (prefers-reduced-motion:reduce){
  .fade,.skel{animation:none!important} .bar-fill{transition:none!important}
}
[data-app] ::-webkit-scrollbar{width:10px;height:10px}
[data-app] ::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:6px;border:3px solid var(--bg)}
`;

/* ============================================================================
   MOCK DATA
   실제 API는 연결하지 않는다. 구조는 설계 문서의 스키마를 따른다.
============================================================================ */

const KRW = (n) => (n == null ? "—" : "₩" + Number(n).toLocaleString("ko-KR"));
const PCT = (n, d = 1) => (n == null ? "—" : (n * 100).toFixed(d) + "%");

const FACTOR_LABELS = {
  margin: "마진성", demand: "시장 수요", competition: "경쟁 강도",
  price: "가격 경쟁력", supply: "공급 안정성", logistics: "물류 적합성", quality: "품질 신호",
};
const FACTOR_WEIGHTS = { margin: 25, demand: 20, competition: 20, price: 15, supply: 10, logistics: 5, quality: 5 };

const mkProduct = (o) => ({
  images: [], tags: [], risk: { level: "CLEAR", brand: "NONE", kc: "NO", notes: [] },
  isExploration: false, sections: null, ...o,
});

const MOCK_PRODUCTS = [
  mkProduct({
    id: "P-4821", status: "RECOMMENDED", keyword: "캠핑의자",
    name: "경량 캠핑 릴렉스 체어 접이식 야외용",
    sourceTitle: "户外折叠椅便携超轻躺椅露营椅",
    site: "1688", sourceId: "882104773621", sellerScore: 4.8, soldCount: 4210,
    score: 87, grade: "A", confidence: 0.84, penalty: 0,
    factors: { margin: 82, demand: 91, competition: 58, price: 76, supply: 88, logistics: 70, quality: 80 },
    cost: { purchase: 9800, cnShip: 980, intlShip: 5200, duty: 0, payFee: 216, buffer: 504, acquisition: 1700, total: 18400 },
    price: { min: 21905, target: 26667, competitor: 24900, final: 24900 },
    margin: { rate: 0.201, krw: 5006 },
    weight: { grams: 1800, source: "명시값", confidence: 0.95 },
    comp: { sellers: 34, median: 24900, p25: 22400, p75: 28100, low: 19800, high: 39000, reviewMedian: 1200, sample: 41, confidence: 0.86 },
    demandEst: { band: "HIGH", range: [180, 520], monthlySearch: 18200 },
    options: [
      { name: "블랙 / L", price: 24900, stock: 420, sku: "882104773621-1001" },
      { name: "카키 / L", price: 24900, stock: 380, sku: "882104773621-1002" },
      { name: "그레이 / M", price: 23900, stock: 155, sku: "882104773621-1003" },
    ],
    rationale: {
      summary: "수요가 높고 마진이 안정적. 경쟁은 다소 치열",
      pros: ["월 검색량 18,200회로 카테고리 상위권", "마진 20.1% 확보, 절대액 5,006원", "대체 공급자 3곳 확인 — 품절 리스크 낮음"],
      cons: ["동일상품 판매자 34곳", "상위 리스팅 리뷰 중앙값 1,200건대로 진입 장벽 존재"],
      action: "가격 경쟁보다 상세페이지 차별화로 접근 권장",
      watch: [],
    },
    tags: ["캠핑의자", "접이식의자", "경량체어", "야외의자", "폴딩체어"],
  }),
  mkProduct({
    id: "P-4833", status: "RECOMMENDED", keyword: "캠핑의자",
    name: "휴대용 미니 폴딩 스툴 등산 낚시 의자",
    sourceTitle: "便携迷你折叠凳登山钓鱼椅",
    site: "1688", sourceId: "774210998312", sellerScore: 4.9, soldCount: 9840,
    score: 92, grade: "S", confidence: 0.88, penalty: 0,
    factors: { margin: 94, demand: 88, competition: 82, price: 90, supply: 92, logistics: 96, quality: 84 },
    cost: { purchase: 4200, cnShip: 420, intlShip: 1800, duty: 0, payFee: 92, buffer: 195, acquisition: 1700, total: 8400 },
    price: { min: 10000, target: 12174, competitor: 13900, final: 13900 },
    margin: { rate: 0.335, krw: 4666 },
    weight: { grams: 620, source: "명시값", confidence: 0.95 },
    comp: { sellers: 11, median: 13900, p25: 12900, p75: 15900, low: 11900, high: 19000, reviewMedian: 210, sample: 18, confidence: 0.79 },
    demandEst: { band: "HIGH", range: [220, 460], monthlySearch: 9400 },
    options: [
      { name: "블랙", price: 13900, stock: 1200, sku: "774210998312-2001" },
      { name: "네이비", price: 13900, stock: 880, sku: "774210998312-2002" },
    ],
    rationale: {
      summary: "부피 대비 마진이 뛰어나고 경쟁이 아직 얕음",
      pros: ["마진 33.5% — 카테고리 최상위", "청구중량 620g으로 배송비 부담 최소", "상위 리스팅 리뷰 210건대 — 진입 여지 충분"],
      cons: ["객단가 13,900원으로 절대 마진액은 보통", "계절성 있음 (3~10월 집중)"],
      action: "즉시 등록 권장. 여름 성수기 전 리뷰 확보가 관건",
      watch: [],
    },
    tags: ["미니의자", "폴딩스툴", "등산의자", "낚시의자", "휴대용의자"],
  }),
  mkProduct({
    id: "P-4840", status: "RECOMMENDED", keyword: "주방수납",
    name: "스테인리스 싱크대 선반 2단 주방 정리대",
    sourceTitle: "不锈钢水槽置物架双层厨房收纳",
    site: "1688", sourceId: "660118273400", sellerScore: 4.6, soldCount: 2180,
    score: 76, grade: "B", confidence: 0.71, penalty: 0,
    factors: { margin: 74, demand: 78, competition: 52, price: 68, supply: 80, logistics: 44, quality: 76 },
    cost: { purchase: 12400, cnShip: 1240, intlShip: 9800, duty: 0, payFee: 273, buffer: 711, acquisition: 1700, total: 26100 },
    price: { min: 31071, target: 37826, competitor: 34900, final: 34900 },
    margin: { rate: 0.191, krw: 6675 },
    weight: { grams: 2900, source: "OCR 추출", confidence: 0.72 },
    comp: { sellers: 47, median: 34900, p25: 29900, p75: 41000, low: 24900, high: 58000, reviewMedian: 640, sample: 33, confidence: 0.74 },
    demandEst: { band: "MEDIUM", range: [60, 190], monthlySearch: 12100 },
    options: [
      { name: "2단 / 실버", price: 34900, stock: 240, sku: "660118273400-3001" },
      { name: "3단 / 실버", price: 41900, stock: 90, sku: "660118273400-3002" },
    ],
    rationale: {
      summary: "마진은 확보되나 부피가 커 배송비 비중이 높음",
      pros: ["절대 마진액 6,675원으로 양호", "주방 카테고리 꾸준한 수요"],
      cons: ["국제배송비가 원가의 38% — 요율 변동에 취약", "무게가 OCR 추출값이라 신뢰도 0.72", "판매자 47곳으로 경쟁 밀집"],
      action: "배송 요율 인상 시 마진 역전 가능. 자동 가격조정 활성화 권장",
      watch: ["부피중량 추정 오차 주의"],
    },
    tags: ["싱크대선반", "주방정리대", "스텐선반", "주방수납"],
  }),
  mkProduct({
    id: "P-4855", status: "RECOMMENDED", keyword: "애견용품",
    name: "반려견 자동 급수기 정수 필터형 2L",
    sourceTitle: "宠物自动饮水机过滤循环2L",
    site: "1688", sourceId: "551209844120", sellerScore: 4.7, soldCount: 6300,
    score: 71, grade: "B", confidence: 0.66, penalty: 15,
    risk: { level: "REVIEW_REQUIRED", brand: "NONE", kc: "POSSIBLE", notes: ["전기 구동 제품 — KC 안전확인 대상 가능성"] },
    factors: { margin: 86, demand: 84, competition: 61, price: 72, supply: 78, logistics: 66, quality: 80 },
    cost: { purchase: 11200, cnShip: 1120, intlShip: 4100, duty: 0, payFee: 246, buffer: 500, acquisition: 1700, total: 18866 },
    price: { min: 22459, target: 27342, competitor: 29900, final: 29900 },
    margin: { rate: 0.307, krw: 9180 },
    weight: { grams: 1400, source: "명시값", confidence: 0.9 },
    comp: { sellers: 28, median: 29900, p25: 25900, p75: 35900, low: 21900, high: 49000, reviewMedian: 880, sample: 26, confidence: 0.72 },
    demandEst: { band: "HIGH", range: [140, 380], monthlySearch: 22400 },
    options: [{ name: "화이트 2L", price: 29900, stock: 520, sku: "551209844120-4001" }],
    rationale: {
      summary: "수익성은 우수하나 전기용품 인증 확인이 선행되어야 함",
      pros: ["마진 30.7%, 절대액 9,180원으로 최상위", "애견 카테고리 수요 지속 성장"],
      cons: ["KC 안전확인 대상일 가능성 — 미인증 판매 시 제재", "리스크 감점 15점 적용"],
      action: "인증 여부 확인 전까지 등록 보류. 확인되면 우선 등록 대상",
      watch: ["KC 안전확인 대상 여부 확인 필요", "인증 없이 등록 시 계정 리스크"],
    },
    tags: ["반려견급수기", "자동급수기", "애견정수기"],
  }),
  mkProduct({
    id: "P-4861", status: "RECOMMENDED", keyword: "차량용품",
    name: "차량용 무선 충전 거치대 자동 개폐 15W",
    sourceTitle: "车载无线充电支架自动开合15W",
    site: "1688", sourceId: "443872001955", sellerScore: 4.4, soldCount: 15200,
    score: 64, grade: "C", confidence: 0.58, penalty: 15,
    risk: { level: "REVIEW_REQUIRED", brand: "SUSPECTED", kc: "POSSIBLE", notes: ["무선 충전 — 방송통신기자재 적합성평가 대상 가능성", "이미지에서 상표 유사 로고 감지 (신뢰도 0.44)"] },
    factors: { margin: 70, demand: 92, competition: 34, price: 58, supply: 64, logistics: 88, quality: 62 },
    cost: { purchase: 8600, cnShip: 860, intlShip: 2200, duty: 0, payFee: 189, buffer: 355, acquisition: 1700, total: 13905 },
    price: { min: 16554, target: 20152, competitor: 18900, final: 18900 },
    margin: { rate: 0.174, krw: 3861 },
    weight: { grams: 480, source: "카테고리 평균", confidence: 0.45 },
    comp: { sellers: 86, median: 18900, p25: 15900, p75: 24900, low: 12900, high: 39000, reviewMedian: 3400, sample: 38, confidence: 0.63 },
    demandEst: { band: "VERY_HIGH", range: [400, 1100], monthlySearch: 41000 },
    options: [{ name: "블랙", price: 18900, stock: 3200, sku: "443872001955-5001" }],
    rationale: {
      summary: "수요는 매우 크나 경쟁 포화 상태이고 인증·상표 리스크 동반",
      pros: ["월 검색량 41,000회로 최상위 수요"],
      cons: ["판매자 86곳, 상위 리뷰 3,400건 — 신규 진입 난이도 최상", "마진 17.4%로 목표 미달", "무게가 카테고리 평균 추정값 (신뢰도 0.45)", "상표 유사 로고 감지"],
      action: "현 조건으로는 비추천. 상표 확인 및 차별화 전략 없이는 진입 부적합",
      watch: ["전파 적합성평가 대상 확인", "상표권 침해 여부 확인"],
    },
    tags: ["차량용무선충전", "핸드폰거치대", "자동거치대"],
  }),
  mkProduct({
    id: "P-4870", status: "RECOMMENDED", keyword: "캠핑의자",
    name: "우드 롤테이블 캠핑 접이식 소형 사이드테이블",
    sourceTitle: "户外实木蛋卷桌便携折叠小桌",
    site: "1688", sourceId: "990233187744", sellerScore: 4.5, soldCount: 780,
    score: 68, grade: "C", confidence: 0.52, penalty: 0, isExploration: true,
    factors: { margin: 78, demand: 54, competition: 74, price: 66, supply: 58, logistics: 40, quality: 62 },
    cost: { purchase: 18600, cnShip: 1860, intlShip: 11200, duty: 0, payFee: 409, buffer: 962, acquisition: 1700, total: 34731 },
    price: { min: 41346, target: 50335, competitor: 46900, final: 46900 },
    margin: { rate: 0.199, krw: 9335 },
    weight: { grams: 3600, source: "안전 마진 적용", confidence: 0.38 },
    comp: { sellers: 9, median: 46900, p25: 39900, p75: 58000, low: 34900, high: 79000, reviewMedian: 95, sample: 7, confidence: 0.44 },
    demandEst: { band: "LOW", range: [15, 70], monthlySearch: 3100 },
    options: [{ name: "원목 소형", price: 46900, stock: 60, sku: "990233187744-6001" }],
    rationale: {
      summary: "표본이 적어 판단 근거가 약함. 탐색 예산으로 검증 가치 있음",
      pros: ["경쟁 판매자 9곳, 상위 리뷰 95건 — 미개척 구간", "절대 마진액 9,335원"],
      cons: ["경쟁 표본 7건으로 가격 기준 신뢰도 0.44", "무게가 안전마진 추정값 (신뢰도 0.38)", "월 검색량 3,100회로 수요 제한적"],
      action: "탐색 예산으로 소량 등록해 실제 반응 확인 권장",
      watch: ["데이터 부족 — 실판매로 검증 필요"],
    },
    tags: ["롤테이블", "캠핑테이블", "우드테이블"],
  }),
  mkProduct({
    id: "P-4790", status: "APPROVED", keyword: "주방수납",
    name: "실리콘 접이식 물병 스포츠 휴대용 550ml",
    sourceTitle: "硅胶折叠水杯运动便携550ml",
    site: "1688", sourceId: "331092776215", sellerScore: 4.8, soldCount: 11200,
    score: 84, grade: "A", confidence: 0.81, penalty: 0,
    factors: { margin: 88, demand: 76, competition: 70, price: 82, supply: 90, logistics: 94, quality: 78 },
    cost: { purchase: 3900, cnShip: 390, intlShip: 1500, duty: 0, payFee: 86, buffer: 172, acquisition: 1700, total: 7748 },
    price: { min: 9224, target: 11229, competitor: 12900, final: 12900 },
    margin: { rate: 0.339, krw: 4378 },
    weight: { grams: 190, source: "명시값", confidence: 0.95 },
    comp: { sellers: 16, median: 12900, p25: 10900, p75: 15900, low: 9900, high: 22000, reviewMedian: 340, sample: 21, confidence: 0.8 },
    demandEst: { band: "MEDIUM", range: [90, 240], monthlySearch: 7600 },
    options: [
      { name: "민트", price: 12900, stock: 900, sku: "331092776215-7001" },
      { name: "코랄", price: 12900, stock: 760, sku: "331092776215-7002" },
    ],
    rationale: { summary: "가볍고 마진이 높은 전형적 우수 후보", pros: ["청구중량 190g", "마진 33.9%"], cons: ["객단가 낮음"], action: "등록 진행", watch: [] },
    tags: ["실리콘물병", "접이식물병", "휴대용물통"],
    approvedAt: "2026-07-29",
  }),
  mkProduct({
    id: "P-4712", status: "PUBLISHED", keyword: "애견용품",
    name: "반려동물 논슬립 매트 방수 대형 120x90",
    sourceTitle: "宠物防滑垫防水大号120x90",
    site: "1688", sourceId: "220984113077", sellerScore: 4.7, soldCount: 3400,
    score: 81, grade: "A", confidence: 0.83, penalty: 0,
    factors: { margin: 80, demand: 82, competition: 66, price: 78, supply: 86, logistics: 72, quality: 80 },
    cost: { purchase: 7400, cnShip: 740, intlShip: 3900, duty: 0, payFee: 163, buffer: 366, acquisition: 1700, total: 14269 },
    price: { min: 16987, target: 20680, competitor: 21900, final: 21900 },
    margin: { rate: 0.288, krw: 6317 },
    weight: { grams: 1250, source: "명시값", confidence: 0.92 },
    comp: { sellers: 22, median: 21900, p25: 18900, p75: 26900, low: 15900, high: 34000, reviewMedian: 520, sample: 24, confidence: 0.82 },
    demandEst: { band: "MEDIUM", range: [70, 200], monthlySearch: 9800 },
    options: [{ name: "그레이 120x90", price: 21900, stock: 310, sku: "220984113077-8001" }],
    rationale: { summary: "안정적 수요·마진 조합", pros: ["마진 28.8%"], cons: ["부피 있음"], action: "등록 완료", watch: [] },
    tags: ["펫매트", "논슬립매트", "방수매트"],
    channelNo: "8823410021", publishedAt: "2026-07-24", sold30d: 34, revenue30d: 744600,
  }),
  mkProduct({
    id: "P-4688", status: "PUBLISHED", keyword: "주방수납",
    name: "냉장고 정리용기 4개 세트 밀폐 투명",
    sourceTitle: "冰箱收纳盒4件套密封透明",
    site: "1688", sourceId: "118822004561", sellerScore: 4.6, soldCount: 8900,
    score: 79, grade: "B", confidence: 0.77, penalty: 0,
    factors: { margin: 76, demand: 80, competition: 64, price: 74, supply: 84, logistics: 68, quality: 82 },
    cost: { purchase: 6200, cnShip: 620, intlShip: 4400, duty: 0, payFee: 137, buffer: 340, acquisition: 1700, total: 13397 },
    price: { min: 15949, target: 19416, competitor: 19900, final: 19900 },
    margin: { rate: 0.267, krw: 5309 },
    weight: { grams: 1600, source: "OCR 추출", confidence: 0.75 },
    comp: { sellers: 31, median: 19900, p25: 16900, p75: 24900, low: 13900, high: 32000, reviewMedian: 760, sample: 29, confidence: 0.78 },
    demandEst: { band: "MEDIUM", range: [80, 210], monthlySearch: 14200 },
    options: [{ name: "4P 세트", price: 19900, stock: 480, sku: "118822004561-9001" }],
    rationale: { summary: "무난한 수요·마진", pros: ["세트 구성으로 객단가 확보"], cons: ["경쟁 다수"], action: "등록 완료", watch: [] },
    tags: ["냉장고정리", "밀폐용기", "정리용기세트"],
    channelNo: "8823409884", publishedAt: "2026-07-18", sold30d: 21, revenue30d: 417900,
  }),
  mkProduct({
    id: "P-4655", status: "PUBLISHED", keyword: "캠핑의자",
    name: "캠핑 LED 랜턴 충전식 밝기조절 3단",
    sourceTitle: "露营LED灯充电式三档调光",
    site: "1688", sourceId: "907733112884", sellerScore: 4.5, soldCount: 5600,
    score: 73, grade: "B", confidence: 0.7, penalty: 15,
    risk: { level: "REVIEW_REQUIRED", brand: "NONE", kc: "YES", notes: ["충전식 전기용품 — KC 안전확인 완료 확인됨"] },
    factors: { margin: 82, demand: 74, competition: 58, price: 70, supply: 76, logistics: 90, quality: 72 },
    cost: { purchase: 5800, cnShip: 580, intlShip: 2100, duty: 0, payFee: 128, buffer: 288, acquisition: 1700, total: 10596 },
    price: { min: 12614, target: 15357, competitor: 16900, final: 16900 },
    margin: { rate: 0.313, krw: 5290 },
    weight: { grams: 540, source: "명시값", confidence: 0.94 },
    comp: { sellers: 26, median: 16900, p25: 13900, p75: 21900, low: 11900, high: 29000, reviewMedian: 430, sample: 23, confidence: 0.75 },
    demandEst: { band: "MEDIUM", range: [60, 180], monthlySearch: 8300 },
    options: [{ name: "웜화이트", price: 16900, stock: 220, sku: "907733112884-1101" }],
    rationale: { summary: "인증 확인 완료된 전기용품", pros: ["마진 31.3%"], cons: ["재고 220개로 여유 부족"], action: "재고 모니터링", watch: ["재고 소진 주의"] },
    tags: ["캠핑랜턴", "LED랜턴", "충전식랜턴"],
    channelNo: "8823409112", publishedAt: "2026-07-11", sold30d: 47, revenue30d: 794300,
  }),
];

const MOCK_ORDERS = [
  { id: "O-20260730-014", channelOrderId: "2026073012884", productId: "P-4655", productName: "캠핑 LED 랜턴 충전식 밝기조절 3단", option: "웜화이트", qty: 2, payment: 33800, orderedAt: "2026-07-30 14:22", status: "TRACKING_SYNCED", poNo: "QS-88214", tracking: "CJ 412088771234", cost: 21192 },
  { id: "O-20260730-013", channelOrderId: "2026073012871", productId: "P-4712", productName: "반려동물 논슬립 매트 방수 대형 120x90", option: "그레이 120x90", qty: 1, payment: 21900, orderedAt: "2026-07-30 13:08", status: "SHIPPED", poNo: "QS-88209", tracking: "CJ 412088770988", cost: 14269 },
  { id: "O-20260730-012", channelOrderId: "2026073012840", productId: "P-4688", productName: "냉장고 정리용기 4개 세트 밀폐 투명", option: "4P 세트", qty: 1, payment: 19900, orderedAt: "2026-07-30 11:47", status: "PO_CONFIRMED", poNo: "QS-88201", tracking: null, cost: 13397 },
  { id: "O-20260730-011", channelOrderId: "2026073012802", productId: "P-4655", productName: "캠핑 LED 랜턴 충전식 밝기조절 3단", option: "웜화이트", qty: 1, payment: 16900, orderedAt: "2026-07-30 10:15", status: "PO_FAILED", poNo: null, tracking: null, cost: 10596, failure: "퀵스타 응답 없음 (3회 시도)" },
  { id: "O-20260730-010", channelOrderId: "2026073012788", productId: "P-4712", productName: "반려동물 논슬립 매트 방수 대형 120x90", option: "그레이 120x90", qty: 3, payment: 65700, orderedAt: "2026-07-30 09:31", status: "VALIDATED", poNo: null, tracking: null, cost: 42807 },
  { id: "O-20260729-009", channelOrderId: "2026072912699", productId: "P-4688", productName: "냉장고 정리용기 4개 세트 밀폐 투명", option: "4P 세트", qty: 2, payment: 39800, orderedAt: "2026-07-29 18:04", status: "DELIVERED", poNo: "QS-88180", tracking: "CJ 412088769112", cost: 26794 },
];

const MOCK_ACTIVITY = [
  { t: "14:22", kind: "order", text: "신규 주문 2건 수집 — 캠핑 LED 랜턴 외" },
  { t: "14:02", kind: "error", text: "발주 실패 — O-20260730-011 (퀵스타 응답 없음)" },
  { t: "13:40", kind: "score", text: "발굴 잡 #331 완료 — 추천 6건 (S 1 / A 2 / B 2 / C 1)" },
  { t: "12:15", kind: "publish", text: "상품 등록 완료 — 실리콘 접이식 물병 외 2건" },
  { t: "11:08", kind: "image", text: "상세페이지 생성 완료 — P-4790 (이미지 8장, 512원)" },
  { t: "09:31", kind: "warn", text: "1688 스크래핑 지연 — 프록시 3/8 응답 저하" },
  { t: "04:12", kind: "warn", text: "마진 역전 4건 감지 — 환율 상승 (1,392 → 1,418)" },
];

const MOCK_ERRORS = [
  { id: "E-1182", level: "CRITICAL", at: "14:02", code: "PO_VENDOR_TIMEOUT", msg: "퀵스타 발주 3회 실패 — 자동 재시도 중단", entity: "O-20260730-011" },
  { id: "E-1181", level: "WARNING", at: "11:44", code: "SCRAPE_SLOW", msg: "1688 응답 지연 — 프록시 전환", entity: "JOB-331" },
  { id: "E-1180", level: "WARNING", at: "09:12", code: "LISTING_TAG_RESTRICTED", msg: "등록불가 태그 자동 제거 후 재시도 성공", entity: "P-4790" },
  { id: "E-1179", level: "WARNING", at: "04:12", code: "MARGIN_INVERSION", msg: "환율 상승으로 마진 역전 4건", entity: "BATCH" },
  { id: "E-1178", level: "INFO", at: "03:00", code: "FX_UPDATED", msg: "환율 갱신 192.40 → 195.60 KRW/CNY", entity: "SYSTEM" },
];

const SECTION_PLAN = [
  { id: "hero", type: "HERO", label: "Hero", src: "GENERATED", headline: "1.8kg, 한 손에 담기는 휴식", sub: "무게는 덜고 편안함은 그대로", prompt: "Minimalist Korean e-commerce hero shot of a lightweight folding camping chair on a wooden deck at golden hour, soft natural light, muted earth tones, clean composition with generous empty space at top for text overlay, portrait 4:5", tone: "#8B7355" },
  { id: "problem", type: "PROBLEM", label: "Problem", src: "GENERATED", headline: "무거운 캠핑의자, 결국 안 가져가게 됩니다", sub: "차 트렁크에서 잠자는 장비", prompt: "Cluttered car trunk with bulky outdoor gear, dim overcast light, muted desaturated palette, documentary style, no text", tone: "#6B6B6B" },
  { id: "solution", type: "SOLUTION", label: "Solution", src: "GENERATED", headline: "접으면 A4 한 장 크기", sub: "한 손에 들리는 1.8kg", prompt: "Folded compact camping chair held in one hand against clean neutral background, studio lighting, soft shadow, product-forward composition, no text", tone: "#A89070" },
  { id: "feature1", type: "FEATURE", label: "Feature — 프레임", src: "GENERATED", headline: "7075 알루미늄 프레임", sub: "내하중 120kg", prompt: "Macro detail of anodized aluminum tube joint with precise machining, dramatic side lighting, dark neutral background, industrial product photography, no text", tone: "#4A4A52" },
  { id: "feature2", type: "FEATURE", label: "Feature — 원단", src: "GENERATED", headline: "600D 옥스포드 원단", sub: "통기성 메쉬 등판", prompt: "Close-up texture of woven oxford fabric with mesh panel, natural daylight, shallow depth of field, tactile emphasis, no text", tone: "#7A8471" },
  { id: "detail", type: "DETAIL", label: "실물 확인", src: "ORIGINAL", headline: "실제 상품 이미지", sub: "원본 사진 · 중국어 마스킹 처리", prompt: null, tone: "#5B6470" },
  { id: "size", type: "SIZE", label: "사이즈 가이드", src: "COMPOSED", headline: "펼쳤을 때 52 × 48 × 68cm", sub: "접었을 때 12 × 12 × 40cm", prompt: "Clean neutral studio backdrop with soft gradient, empty center space, minimal shadow, no objects, no text", tone: "#C9C4BC" },
  { id: "lifestyle", type: "LIFESTYLE", label: "Lifestyle", src: "GENERATED", headline: "어디에 두어도 어울리는", sub: "캠핑, 낚시, 운동회", prompt: "Family enjoying a riverside picnic at dusk with folding chairs, warm ambient light, lifestyle photography, natural candid moment, no text", tone: "#9C7B5A" },
  { id: "delivery", type: "DELIVERY", label: "배송 안내", src: "NONE", headline: "해외구매대행 상품", sub: "고정 블록 · 수정 불가", prompt: null, tone: null },
  { id: "policy", type: "POLICY", label: "교환·환불", src: "NONE", headline: "교환 및 환불 안내", sub: "고정 블록 · 수정 불가", prompt: null, tone: null },
];

const DEFAULT_SETTINGS = {
  fxRate: 195.6, fxBuffer: 2, minMargin: 10, targetMargin: 25,
  naverFee: 3.74, payFee: 2, buffer: 3, volumetricDivisor: 6000,
  roundUnit: 100, priceEnding: 900, maxPriceChange: 15,
  dailyBudget: 50000, productImageCap: 1500, dailyListCap: 30, explorationRate: 10,
  imageModelDraft: "gpt-image-mini / low", imageModelFinal: "gpt-image-2 / medium",
  brandBlock: true, kcPolicy: "REVIEW_REQUIRED", competitorRef: "TRIMMED_MEAN",
};

/* ============================================================================
   STATE — useReducer + Context
   상품은 하나의 상태 머신을 따른다:
   RECOMMENDED → APPROVED → CONTENT_READY → PUBLISHED
   반려 시 ARCHIVED, 보류 시 HOLD.
============================================================================ */

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

const initialState = {
  authed: false,
  theme: "light",
  route: { name: "dashboard", params: {} },
  products: MOCK_PRODUCTS,
  orders: MOCK_ORDERS,
  settings: DEFAULT_SETTINGS,
  toasts: [],
  spend: { ai: 8420, image: 12100, scrape: 3200 },
  sidebarOpen: true,
};

let toastSeq = 0;

function reducer(state, action) {
  switch (action.type) {
    case "LOGIN": return { ...state, authed: true, route: { name: "dashboard", params: {} } };
    case "LOGOUT": return { ...state, authed: false };
    case "THEME": return { ...state, theme: state.theme === "light" ? "dark" : "light" };
    case "SIDEBAR": return { ...state, sidebarOpen: !state.sidebarOpen };
    case "NAV": return { ...state, route: { name: action.name, params: action.params || {} } };

    case "APPROVE": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "APPROVED", approvedAt: "2026-07-30" } : p);
      return { ...state, products };
    }
    case "REJECT": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "ARCHIVED", rejectReason: action.reason } : p);
      return { ...state, products };
    }
    case "HOLD": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "HOLD" } : p);
      return { ...state, products };
    }
    case "UNHOLD": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "RECOMMENDED" } : p);
      return { ...state, products };
    }
    case "GENERATE_CONTENT": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, sections: SECTION_PLAN.map(s => ({ ...s, state: "DRAFT" })) } : p);
      return { ...state, products, spend: { ...state.spend, image: state.spend.image + 63 } };
    }
    case "SECTION_APPROVE": {
      const products = state.products.map((p) => {
        if (p.id !== action.id || !p.sections) return p;
        return { ...p, sections: p.sections.map(s => s.id === action.sectionId ? { ...s, state: "APPROVED" } : s) };
      });
      return { ...state, products };
    }
    case "SECTION_REGEN": {
      const products = state.products.map((p) => {
        if (p.id !== action.id || !p.sections) return p;
        return { ...p, sections: p.sections.map(s => s.id === action.sectionId ? { ...s, state: "DRAFT", variant: (s.variant || 0) + 1 } : s) };
      });
      return { ...state, products, spend: { ...state.spend, image: state.spend.image + 7 } };
    }
    case "FINALIZE_CONTENT": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "CONTENT_READY", sections: (p.sections || []).map(s => ({ ...s, state: "FINAL" })) } : p);
      return { ...state, products, spend: { ...state.spend, image: state.spend.image + 495 } };
    }
    case "PUBLISH": {
      const products = state.products.map((p) =>
        p.id === action.id ? { ...p, status: "PUBLISHED", channelNo: "88234" + Math.floor(10000 + Math.random() * 89999), publishedAt: "2026-07-30", sold30d: 0, revenue30d: 0 } : p);
      return { ...state, products };
    }
    case "PRICE_CHANGE": {
      const products = state.products.map((p) => {
        if (p.id !== action.id) return p;
        const final = action.price;
        const feeRate = (state.settings.naverFee + state.settings.payFee) / 100;
        const rate = (final - p.cost.total - final * feeRate) / final;
        return { ...p, price: { ...p.price, final }, margin: { rate, krw: Math.round(final - p.cost.total - final * feeRate) } };
      });
      return { ...state, products };
    }
    case "SUSPEND": {
      const products = state.products.map((p) => p.id === action.id ? { ...p, status: "SUSPENDED" } : p);
      return { ...state, products };
    }
    case "RESUME": {
      const products = state.products.map((p) => p.id === action.id ? { ...p, status: "PUBLISHED" } : p);
      return { ...state, products };
    }
    case "ORDER_RETRY": {
      const orders = state.orders.map((o) =>
        o.id === action.id ? { ...o, status: "PO_CONFIRMED", poNo: "QS-882" + Math.floor(10 + Math.random() * 89), failure: null } : o);
      return { ...state, orders };
    }
    case "ORDER_SYNC_TRACKING": {
      const orders = state.orders.map((o) =>
        o.id === action.id ? { ...o, status: "TRACKING_SYNCED" } : o);
      return { ...state, orders };
    }
    case "ORDER_PURCHASE": {
      const orders = state.orders.map((o) =>
        o.id === action.id ? { ...o, status: "PO_CONFIRMED", poNo: "QS-882" + Math.floor(10 + Math.random() * 89) } : o);
      return { ...state, orders };
    }
    case "SETTING": return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case "TOAST": return { ...state, toasts: [...state.toasts, { id: ++toastSeq, ...action.toast }] };
    case "UNTOAST": return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default: return state;
  }
}

/* ============================================================================
   PRIMITIVES
============================================================================ */

const GRADE_VAR = { S: "--gS", A: "--gA", B: "--gB", C: "--gC", D: "--gD" };

function Grade({ g, size = "md" }) {
  const h = size === "sm" ? 20 : 24;
  return (
    <span className="chip num" style={{
      height: h, background: `color-mix(in srgb, var(${GRADE_VAR[g]}) 12%, transparent)`,
      color: `var(${GRADE_VAR[g]})`, fontWeight: 700, letterSpacing: ".04em",
    }}>{g}</span>
  );
}

function Chip({ tone = "neutral", children, icon: Icon }) {
  const map = {
    neutral: { bg: "var(--surface-3)", fg: "var(--text-2)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    pos: { bg: "var(--pos-soft)", fg: "var(--pos)" },
    neg: { bg: "var(--neg-soft)", fg: "var(--neg)" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  }[tone];
  return (
    <span className="chip" style={{ background: map.bg, color: map.fg }}>
      {Icon && <Icon size={11} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

function Btn({ variant = "ghost", size = "sm", icon: Icon, children, ...rest }) {
  return (
    <button className={`btn btn-${size} btn-${variant}`} {...rest}>
      {Icon && <Icon size={size === "md" ? 15 : 13.5} strokeWidth={2} />}
      {children}
    </button>
  );
}

/* SIGNATURE ELEMENT — 스코어 미터.
   점수 하나가 아니라 7개 요소의 기여도와 신뢰도를 동시에 보여준다.
   이 제품의 핵심 주장("점수는 룰 엔진이 계산하고 근거가 남는다")이
   시각적으로 성립하는 지점. */
function ScoreMeter({ p, compact = false }) {
  const keys = Object.keys(FACTOR_LABELS);
  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr", gap: compact ? "3px 16px" : 5 }}>
      {keys.map((k) => {
        const v = p.factors[k];
        const w = FACTOR_WEIGHTS[k];
        return (
          <div key={k} className="flex items-center" style={{ gap: 8 }}>
            <span className="t3" style={{ fontSize: 11, width: 52, flexShrink: 0 }}>{FACTOR_LABELS[k]}</span>
            <div className="bar-track" style={{ flex: 1, minWidth: 24 }}>
              <div className="bar-fill" style={{
                width: `${v}%`,
                background: v >= 80 ? "var(--pos)" : v >= 60 ? "var(--accent)" : v >= 40 ? "var(--warn)" : "var(--neg)",
                opacity: 0.55 + (w / 25) * 0.45,
              }} />
            </div>
            <span className="num t2" style={{ fontSize: 11, width: 18, textAlign: "right" }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function Confidence({ v, showLabel = true }) {
  const filled = Math.round(v * 5);
  const low = v < 0.6;
  return (
    <span className="flex items-center" style={{ gap: 5 }} title={`신뢰도 ${v.toFixed(2)}`}>
      {showLabel && <span className="t3" style={{ fontSize: 11 }}>신뢰도</span>}
      <span className="flex" style={{ gap: 2 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: 3,
            background: i < filled ? (low ? "var(--warn)" : "var(--text-2)") : "var(--line-strong)",
          }} />
        ))}
      </span>
      <span className="num" style={{ fontSize: 11, color: low ? "var(--warn)" : "var(--text-2)" }}>{v.toFixed(2)}</span>
    </span>
  );
}

function RiskBadge({ risk }) {
  if (risk.level === "BLOCKED") return <Chip tone="neg" icon={ShieldAlert}>차단</Chip>;
  if (risk.level === "REVIEW_REQUIRED") return <Chip tone="warn" icon={AlertTriangle}>검토 필요</Chip>;
  return <Chip tone="pos" icon={ShieldCheck}>정상</Chip>;
}

function Stat({ label, value, sub, tone, icon: Icon }) {
  return (
    <div className="surf" style={{ padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={14} strokeWidth={2} style={{ color: "var(--text-3)" }} />}
      </div>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && (
        <div className="flex items-center" style={{ gap: 4, marginTop: 6, fontSize: 12, color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text-3)" }}>
          {tone === "pos" && <TrendingUp size={12} />}
          {tone === "neg" && <TrendingDown size={12} />}
          <span className="num">{sub}</span>
        </div>
      )}
    </div>
  );
}

function Empty({ icon: Icon, title, body, action }) {
  return (
    <div className="surf flex flex-col items-center justify-center text-center" style={{ padding: "56px 24px" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", marginBottom: 14 }}>
        <Icon size={18} strokeWidth={1.8} style={{ color: "var(--text-3)" }} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div className="t3" style={{ fontSize: 13, maxWidth: 320, marginBottom: action ? 16 : 0 }}>{body}</div>
      {action}
    </div>
  );
}

/* 이미지는 Mock이므로 실제 파일을 쓰지 않는다.
   섹션 톤 컬러 기반 플레이스홀더로 "생성될 자리"를 표현한다. */
function ImgMock({ tone, label, ratio = "4/5", src = "GENERATED", variant = 0, big = false }) {
  const isOriginal = src === "ORIGINAL";
  const seed = (variant * 37) % 100;
  return (
    <div style={{
      aspectRatio: ratio, borderRadius: 6, position: "relative", overflow: "hidden",
      border: "1px solid var(--line)",
      background: isOriginal
        ? `repeating-linear-gradient(45deg, var(--surface-2) 0 8px, var(--surface-3) 8px 16px)`
        : `linear-gradient(${140 + seed}deg, ${tone || "#8A929E"} 0%, color-mix(in srgb, ${tone || "#8A929E"} 45%, #ffffff) 55%, color-mix(in srgb, ${tone || "#8A929E"} 70%, #000000) 100%)`,
    }}>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6,
        background: isOriginal ? "transparent" : "rgba(0,0,0,.12)",
      }}>
        {isOriginal
          ? <Package size={big ? 22 : 16} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
          : <Sparkles size={big ? 22 : 16} strokeWidth={1.6} style={{ color: "rgba(255,255,255,.9)" }} />}
        <span style={{
          fontSize: big ? 11 : 10, fontWeight: 600, letterSpacing: ".04em",
          color: isOriginal ? "var(--text-3)" : "rgba(255,255,255,.92)",
        }}>{label}</span>
      </div>
    </div>
  );
}

function Toasts() {
  const { state, dispatch } = useApp();
  useEffect(() => {
    if (!state.toasts.length) return;
    const t = setTimeout(() => dispatch({ type: "UNTOAST", id: state.toasts[0].id }), 2800);
    return () => clearTimeout(t);
  }, [state.toasts, dispatch]);
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 90 }}>
      {state.toasts.map((t) => (
        <div key={t.id} className="surf fade flex items-center" style={{ gap: 10, padding: "10px 14px", boxShadow: "var(--shadow-lg)", minWidth: 240 }}>
          {t.tone === "neg"
            ? <AlertTriangle size={15} style={{ color: "var(--neg)" }} />
            : <Check size={15} style={{ color: "var(--pos)" }} />}
          <span style={{ fontSize: 13 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   SCREEN — Login
============================================================================ */
function Login() {
  const { dispatch } = useApp();
  const [email, setEmail] = useState("operator@delightfilm.kr");
  const [pw, setPw] = useState("••••••••••");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setBusy(true);
    setTimeout(() => dispatch({ type: "LOGIN" }), 450);
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: "100vh", padding: 24 }}>
      <div className="fade" style={{ width: "100%", maxWidth: 360 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 28 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--accent)", display: "grid", placeItems: "center" }}>
            <Layers size={15} strokeWidth={2.2} style={{ color: "var(--accent-fg)" }} />
          </div>
          <div>
            <div style={{ fontWeight: 650, fontSize: 14.5, letterSpacing: "-.01em" }}>SmartStore AI Seller OS</div>
            <div className="t3" style={{ fontSize: 11.5 }}>상품 발굴 및 심사 시스템</div>
          </div>
        </div>

        <div className="surf" style={{ padding: 22 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>로그인</div>
          <div className="t3" style={{ fontSize: 12.5, marginBottom: 18 }}>운영자 계정으로 접속합니다.</div>

          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>이메일</label>
          <input className="inp" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={{ marginBottom: 14 }} />

          <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>비밀번호</label>
          <input className="inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} style={{ marginBottom: 18 }} />

          <Btn variant="primary" size="md" onClick={submit} disabled={busy}
            style={{ width: "100%" }} icon={busy ? Loader2 : undefined}>
            {busy ? "접속 중" : "로그인"}
          </Btn>
        </div>

        <div className="flex items-center justify-center" style={{ gap: 6, marginTop: 14 }}>
          <Lock size={11} style={{ color: "var(--text-3)" }} />
          <span className="t3" style={{ fontSize: 11.5 }}>Prototype · Mock 데이터로 동작합니다</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — Dashboard
============================================================================ */
function Dashboard() {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });

  const recommended = state.products.filter((p) => p.status === "RECOMMENDED");
  const pending = state.products.filter((p) => ["APPROVED", "CONTENT_READY"].includes(p.status));
  const published = state.products.filter((p) => ["PUBLISHED", "SUSPENDED"].includes(p.status));
  const todayOrders = state.orders.filter((o) => o.orderedAt.startsWith("2026-07-30"));
  const revenue = todayOrders.reduce((s, o) => s + o.payment, 0);
  const cogs = todayOrders.reduce((s, o) => s + o.cost, 0);
  const profit = revenue - cogs - Math.round(revenue * 0.0574);
  const spendTotal = state.spend.ai + state.spend.image + state.spend.scrape;

  const top = [...recommended].sort((a, b) => b.score - a.score).slice(0, 4);

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>대시보드</h1>
        <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>2026년 7월 30일 목요일 · 오늘의 운영 현황</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <Stat label="오늘 추천" value={recommended.length} sub={`승인 대기 ${pending.length}건`} icon={Sparkles} />
        <Stat label="오늘 등록" value={published.length} sub="+3 어제 대비" tone="pos" icon={Store} />
        <Stat label="오늘 주문" value={todayOrders.length} sub={`발주 실패 1건`} tone="neg" icon={ShoppingCart} />
        <Stat label="오늘 순이익" value={KRW(profit)} sub={`매출 ${KRW(revenue)}`} icon={Wallet} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}
        className="dash-grid">
        {/* 오늘 추천상품 */}
        <div className="surf" style={{ overflow: "hidden" }}>
          <div className="flex items-center justify-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>오늘 추천상품</div>
              <div className="t3" style={{ fontSize: 11.5, marginTop: 1 }}>점수순 · 클릭하면 분석으로 이동합니다</div>
            </div>
            <Btn onClick={() => nav("discovery")}>전체 보기 <ChevronRight size={13} /></Btn>
          </div>
          {top.length === 0 ? (
            <Empty icon={Sparkles} title="추천 대기 중" body="발굴에서 키워드를 실행하면 추천 상품이 여기 표시됩니다."
              action={<Btn variant="primary" size="md" onClick={() => nav("discovery")}>발굴 시작</Btn>} />
          ) : top.map((p) => (
            <button key={p.id} className="row-hover flex items-center" onClick={() => nav("product", { id: p.id })}
              style={{ width: "100%", gap: 12, padding: "12px 16px", background: "transparent", border: "none", borderTop: "1px solid var(--line)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 42, flexShrink: 0 }}>
                <ImgMock tone="#7A8471" label="" ratio="1/1" src={p.risk.level === "CLEAR" ? "GENERATED" : "ORIGINAL"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center" style={{ gap: 6, marginBottom: 3 }}>
                  <Grade g={p.grade} size="sm" />
                  <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{p.score}</span>
                  {p.risk.level !== "CLEAR" && <RiskBadge risk={p.risk} />}
                  {p.isExploration && <Chip tone="accent" icon={CircleDot}>탐색</Chip>}
                </div>
                <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div className="t3 num" style={{ fontSize: 11.5, marginTop: 2 }}>
                  원가 {KRW(p.cost.total)} → 판매 {KRW(p.price.final)} · 마진 {PCT(p.margin.rate)}
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* 비용 */}
          <div className="surf" style={{ padding: 16 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <span className="eyebrow">오늘 비용</span>
              <span className="num t3" style={{ fontSize: 11.5 }}>
                {Math.round((spendTotal / state.settings.dailyBudget) * 100)}% 소진
              </span>
            </div>
            {[["AI 분석", state.spend.ai], ["이미지 생성", state.spend.image], ["수집", state.spend.scrape]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                <span className="t2" style={{ fontSize: 12.5 }}>{k}</span>
                <span className="num" style={{ fontSize: 12.5 }}>{KRW(v)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--line)", margin: "10px 0" }} />
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>합계</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                {KRW(spendTotal)} <span className="t3" style={{ fontWeight: 400 }}>/ {KRW(state.settings.dailyBudget)}</span>
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.min(100, (spendTotal / state.settings.dailyBudget) * 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>

          {/* 오류 로그 */}
          <div className="surf" style={{ overflow: "hidden" }}>
            <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              <span className="eyebrow">오류 로그</span>
              <Chip tone="neg">{MOCK_ERRORS.filter(e => e.level === "CRITICAL").length} 심각</Chip>
            </div>
            <div style={{ maxHeight: 210, overflowY: "auto" }}>
              {MOCK_ERRORS.map((e) => (
                <div key={e.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                  <div className="flex items-center" style={{ gap: 7, marginBottom: 3 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: 3, flexShrink: 0,
                      background: e.level === "CRITICAL" ? "var(--neg)" : e.level === "WARNING" ? "var(--warn)" : "var(--text-3)",
                    }} />
                    <span className="mono t3" style={{ fontSize: 11 }}>{e.at}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>{e.code}</span>
                  </div>
                  <div className="t2" style={{ fontSize: 12, paddingLeft: 12 }}>{e.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="surf" style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <span className="eyebrow">최근 활동</span>
        </div>
        <div style={{ padding: "4px 0" }}>
          {MOCK_ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-center" style={{ gap: 12, padding: "8px 16px" }}>
              <span className="mono t3" style={{ fontSize: 11, width: 36, flexShrink: 0 }}>{a.t}</span>
              <span style={{
                width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                background: a.kind === "error" ? "var(--neg)" : a.kind === "warn" ? "var(--warn)"
                  : a.kind === "publish" ? "var(--pos)" : "var(--accent)",
              }} />
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{a.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — Discovery
============================================================================ */
const KEYWORDS = ["캠핑의자", "주방수납", "애견용품", "차량용품"];
const CATEGORIES = ["전체", "스포츠/레저", "생활/건강", "가구/인테리어", "디지털/가전"];

function Discovery() {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });

  const [q, setQ] = useState("");
  const [kw, setKw] = useState("전체");
  const [cat, setCat] = useState("전체");
  const [grades, setGrades] = useState(["S", "A", "B", "C"]);
  const [minConf, setMinConf] = useState(0);
  const [hideRisk, setHideRisk] = useState(false);
  const [running, setRunning] = useState(false);
  const [sort, setSort] = useState("score");

  const runDiscovery = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      dispatch({ type: "TOAST", toast: { msg: "발굴 완료 — 후보 10,240건에서 추천 6건" } });
    }, 1400);
  };

  const toggleGrade = (g) =>
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const list = useMemo(() => {
    let r = state.products.filter((p) => ["RECOMMENDED", "HOLD"].includes(p.status));
    if (q.trim()) r = r.filter((p) => (p.name + p.keyword + p.id).toLowerCase().includes(q.toLowerCase()));
    if (kw !== "전체") r = r.filter((p) => p.keyword === kw);
    r = r.filter((p) => grades.includes(p.grade));
    r = r.filter((p) => p.confidence >= minConf);
    if (hideRisk) r = r.filter((p) => p.risk.level === "CLEAR");
    const cmp = {
      score: (a, b) => b.score - a.score,
      margin: (a, b) => b.margin.rate - a.margin.rate,
      profit: (a, b) => b.margin.krw - a.margin.krw,
      demand: (a, b) => b.demandEst.monthlySearch - a.demandEst.monthlySearch,
    }[sort];
    return [...r].sort(cmp);
  }, [state.products, q, kw, grades, minConf, hideRisk, sort]);

  const funnel = [
    ["수집", 10240, 100], ["스크리닝", 1180, 11.5], ["상세수집", 1142, 11.2],
    ["마진통과", 312, 3.0], ["경쟁분석", 312, 3.0], ["리스크", 289, 2.8], ["추천", 6, 0.06],
  ];

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="flex items-start justify-between" style={{ gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>발굴</h1>
          <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>키워드로 소스 상품을 탐색하고 심사합니다</div>
        </div>
        <Btn variant="primary" size="md" icon={running ? Loader2 : Search} onClick={runDiscovery} disabled={running}>
          {running ? "발굴 중" : "발굴 실행"}
        </Btn>
      </div>

      {/* 검색 · 카테고리 */}
      <div className="surf" style={{ padding: 16 }}>
        <div className="flex" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-3)" }} />
            <input className="inp" placeholder="상품명 또는 키워드 검색" value={q}
              onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
          </div>
          <select className="inp" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 150 }}>
            <option>전체</option>{KEYWORDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select className="inp" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 170 }}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 140 }}>
            <option value="score">점수 높은순</option>
            <option value="margin">마진율 높은순</option>
            <option value="profit">마진액 높은순</option>
            <option value="demand">수요 많은순</option>
          </select>
        </div>

        <div className="flex items-center" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="flex items-center" style={{ gap: 7 }}>
            <Filter size={13} style={{ color: "var(--text-3)" }} />
            <span className="t3" style={{ fontSize: 12 }}>등급</span>
            <div className="flex" style={{ gap: 4 }}>
              {["S", "A", "B", "C", "D"].map((g) => (
                <button key={g} onClick={() => toggleGrade(g)} className="btn btn-sm num"
                  style={{
                    minWidth: 28, padding: "0 7px", fontWeight: 700,
                    background: grades.includes(g) ? `color-mix(in srgb, var(${GRADE_VAR[g]}) 14%, transparent)` : "transparent",
                    color: grades.includes(g) ? `var(${GRADE_VAR[g]})` : "var(--text-3)",
                    border: `1px solid ${grades.includes(g) ? "transparent" : "var(--line)"}`,
                  }}>{g}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="t3" style={{ fontSize: 12 }}>최소 신뢰도</span>
            <input type="range" min="0" max="0.9" step="0.1" value={minConf}
              onChange={(e) => setMinConf(parseFloat(e.target.value))} style={{ width: 90, accentColor: "var(--accent)" }} />
            <span className="num t2" style={{ fontSize: 12, width: 26 }}>{minConf.toFixed(1)}</span>
          </div>
          <label className="flex items-center" style={{ gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={hideRisk} onChange={(e) => setHideRisk(e.target.checked)}
              style={{ accentColor: "var(--accent)" }} />
            <span className="t2" style={{ fontSize: 12 }}>검토 필요 숨기기</span>
          </label>
          <span className="t3 num" style={{ fontSize: 12, marginLeft: "auto" }}>{list.length}건</span>
        </div>
      </div>

      {/* 퍼널 */}
      <div className="surf" style={{ padding: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">발굴 잡 #331 — 캠핑의자 외 3</span>
          <span className="t3 num" style={{ fontSize: 11.5 }}>예산 31,200 / 50,000원</span>
        </div>
        <div className="flex items-end" style={{ gap: 2, height: 56 }}>
          {funnel.map(([label, n, pctv], i) => (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <span className="num" style={{ fontSize: 10.5, color: "var(--text-2)" }}>{n.toLocaleString()}</span>
              <div style={{
                width: "100%", height: Math.max(3, (Math.log10(n + 1) / Math.log10(10241)) * 30),
                background: i === funnel.length - 1 ? "var(--accent)" : "var(--surface-3)",
                borderRadius: 2,
              }} />
              <span className="t3" style={{ fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {running ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
          {[0, 1, 2].map((i) => <div key={i} className="surf skel" style={{ height: 250 }} />)}
        </div>
      ) : list.length === 0 ? (
        <Empty icon={Search} title="조건에 맞는 상품이 없습니다"
          body="등급 필터나 신뢰도 기준을 낮춰보세요. 발굴을 다시 실행하면 새 후보가 추가됩니다."
          action={<Btn variant="ghost" size="md" onClick={() => { setGrades(["S", "A", "B", "C", "D"]); setMinConf(0); setHideRisk(false); setQ(""); setKw("전체"); }}>필터 초기화</Btn>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14 }}>
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p }) {
  const { dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });
  const blocked = p.risk.level !== "CLEAR";

  const approve = (e) => {
    e.stopPropagation();
    dispatch({ type: "APPROVE", id: p.id });
    dispatch({ type: "TOAST", toast: { msg: `승인됨 — ${p.name.slice(0, 18)}…` } });
  };
  const reject = (e) => {
    e.stopPropagation();
    dispatch({ type: "REJECT", id: p.id, reason: "운영자 반려" });
    dispatch({ type: "TOAST", toast: { msg: "반려 처리했습니다" } });
  };
  const hold = (e) => {
    e.stopPropagation();
    dispatch({ type: p.status === "HOLD" ? "UNHOLD" : "HOLD", id: p.id });
  };

  return (
    <div className="surf" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button onClick={() => nav("product", { id: p.id })}
        style={{ background: "transparent", border: "none", padding: 14, textAlign: "left", cursor: "pointer", display: "block" }}>
        <div className="flex items-start" style={{ gap: 11, marginBottom: 11 }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            <ImgMock tone="#7A8471" label="" ratio="1/1" src="ORIGINAL" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center" style={{ gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
              <Grade g={p.grade} />
              <span className="num" style={{ fontSize: 17, fontWeight: 650, letterSpacing: "-.02em" }}>{p.score}</span>
              <Confidence v={p.confidence} showLabel={false} />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
          </div>
        </div>

        <div style={{ marginBottom: 11 }}><ScoreMeter p={p} compact /></div>

        <div className="surf-2" style={{ borderRadius: 6, padding: "9px 11px", marginBottom: 10 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="t3" style={{ fontSize: 11 }}>원가 → 판매가</span>
            <span className="num" style={{ fontSize: 12.5 }}>{KRW(p.cost.total)} → <strong>{KRW(p.price.final)}</strong></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="t3" style={{ fontSize: 11 }}>마진</span>
            <span className="num" style={{ fontSize: 12.5, color: "var(--pos)", fontWeight: 600 }}>
              {PCT(p.margin.rate)} · {KRW(p.margin.krw)}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 8 }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>AI</span> {p.rationale.summary}
        </div>

        <div className="flex" style={{ gap: 5, flexWrap: "wrap" }}>
          <Chip>판매자 {p.comp.sellers}</Chip>
          <Chip>검색 {(p.demandEst.monthlySearch / 1000).toFixed(1)}k</Chip>
          {blocked && <RiskBadge risk={p.risk} />}
          {p.isExploration && <Chip tone="accent" icon={CircleDot}>탐색 예산</Chip>}
          {p.status === "HOLD" && <Chip tone="warn" icon={Pause}>보류</Chip>}
        </div>
      </button>

      <div className="flex" style={{ gap: 6, padding: "10px 14px", borderTop: "1px solid var(--line)", marginTop: "auto" }}>
        <Btn variant="pos" icon={Check} onClick={approve} disabled={blocked}
          title={blocked ? "검토 필요 상품은 상세에서 확인 후 승인할 수 있습니다" : undefined}
          style={{ flex: 1 }}>승인</Btn>
        <Btn variant="neg" icon={X} onClick={reject}>반려</Btn>
        <Btn variant="ghost" icon={Pause} onClick={hold} />
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — Product Detail
============================================================================ */
const COST_ITEMS = [
  ["purchase", "매입원가"], ["cnShip", "중국내 배송"], ["intlShip", "국제배송"],
  ["duty", "관부가세"], ["payFee", "결제수수료"], ["buffer", "예비비"], ["acquisition", "획득·제작원가"],
];

function ProductDetail({ id }) {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });
  const p = state.products.find((x) => x.id === id);
  const [tab, setTab] = useState("score");

  if (!p) return <Empty icon={Package} title="상품을 찾을 수 없습니다" body="목록으로 돌아가 다시 선택해 주세요." />;

  const blocked = p.risk.level !== "CLEAR";
  const feeRate = (state.settings.naverFee + state.settings.payFee) / 100;
  const weighted = Object.keys(FACTOR_LABELS).map((k) => ({
    k, v: p.factors[k], w: FACTOR_WEIGHTS[k], contrib: (p.factors[k] * FACTOR_WEIGHTS[k]) / 100,
  }));
  const base = weighted.reduce((s, x) => s + x.contrib, 0);

  const approve = () => {
    dispatch({ type: "APPROVE", id: p.id });
    dispatch({ type: "TOAST", toast: { msg: "승인됨 — 등록 대기로 이동했습니다" } });
    nav("pending");
  };

  const TABS = [["score", "종합 점수"], ["cost", "원가 분석"], ["comp", "경쟁 분석"], ["risk", "리스크"], ["source", "원본 정보"]];

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <Btn icon={ChevronLeft} onClick={() => nav("discovery")}>목록</Btn>
        <span className="mono t3" style={{ fontSize: 11.5 }}>{p.id}</span>
      </div>

      <div className="flex items-start justify-between" style={{ gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
            <Grade g={p.grade} />
            <span className="num" style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-.02em" }}>{p.score}</span>
            <Confidence v={p.confidence} />
            <RiskBadge risk={p.risk} />
            {p.isExploration && <Chip tone="accent" icon={CircleDot}>탐색 예산</Chip>}
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.015em", margin: 0, lineHeight: 1.35 }}>{p.name}</h1>
          <div className="t3" style={{ fontSize: 12.5, marginTop: 5 }}>
            {p.site} · {p.sourceTitle} · 판매 {p.soldCount.toLocaleString()}건 · 셀러 {p.sellerScore}
          </div>
        </div>
        <div className="flex" style={{ gap: 7 }}>
          <Btn size="md" variant="neg" icon={X} onClick={() => { dispatch({ type: "REJECT", id: p.id, reason: "운영자 반려" }); nav("discovery"); }}>반려</Btn>
          {p.status === "RECOMMENDED" || p.status === "HOLD" ? (
            <Btn size="md" variant="primary" icon={Check} onClick={approve} disabled={blocked}>
              {blocked ? "검토 필요 — 승인 불가" : "승인하고 등록 대기로"}
            </Btn>
          ) : (
            <Btn size="md" variant="primary" icon={FileImage} onClick={() => nav("gptpage", { id: p.id })}>상세페이지 열기</Btn>
          )}
        </div>
      </div>

      {blocked && (
        <div className="surf" style={{ padding: "12px 14px", background: "var(--warn-soft)", borderColor: "transparent" }}>
          <div className="flex items-start" style={{ gap: 9 }}>
            <AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)", marginBottom: 3 }}>검토가 필요한 상품입니다</div>
              {p.risk.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--warn)", opacity: .9 }}>· {n}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 요약 4칸 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <Stat label="원가" value={KRW(p.cost.total)} sub={`무게 ${p.weight.grams}g · ${p.weight.source}`} />
        <Stat label="예상 판매가" value={KRW(p.price.final)} sub={`최소 ${KRW(p.price.min)}`} />
        <Stat label="예상 순이익" value={KRW(p.margin.krw)} sub={`마진율 ${PCT(p.margin.rate)}`} tone="pos" />
        <Stat label="경쟁 중앙값" value={KRW(p.comp.median)} sub={`판매자 ${p.comp.sellers}곳`} />
      </div>

      {/* 탭 */}
      <div className="flex" style={{ gap: 2, borderBottom: "1px solid var(--line)" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "9px 13px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer",
              color: tab === k ? "var(--text)" : "var(--text-3)", fontWeight: tab === k ? 600 : 400,
              borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`, marginBottom: -1,
            }}>{label}</button>
        ))}
      </div>

      {tab === "score" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 16 }} className="dash-grid">
          <div className="surf" style={{ padding: 18 }}>
            <div className="flex flex-col items-center" style={{ paddingBottom: 16, borderBottom: "1px solid var(--line)", marginBottom: 14 }}>
              <div className="num" style={{ fontSize: 44, fontWeight: 650, letterSpacing: "-.04em", lineHeight: 1 }}>{p.score}</div>
              <div className="flex items-center" style={{ gap: 6, marginTop: 8 }}>
                <Grade g={p.grade} /><Confidence v={p.confidence} />
              </div>
              <div className="t3" style={{ fontSize: 11.5, marginTop: 8 }}>스코어 정책 v3 · 룰 엔진 계산</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {weighted.map((x) => (
                <div key={x.k}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <span style={{ fontSize: 12 }}>{FACTOR_LABELS[x.k]}</span>
                    <span className="num t3" style={{ fontSize: 11 }}>{x.v} × {x.w} = {x.contrib.toFixed(1)}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${x.v}%`, background: x.v >= 80 ? "var(--pos)" : x.v >= 60 ? "var(--accent)" : x.v >= 40 ? "var(--warn)" : "var(--neg)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              {[["가중 합계", base.toFixed(1)], ["리스크 감점", `−${p.penalty}`], ["최종", p.score]].map(([k, v], i) => (
                <div key={k} className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: i === 2 ? 600 : 400, color: i === 2 ? "var(--text)" : "var(--text-2)" }}>{k}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: i === 2 ? 650 : 400 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="surf" style={{ padding: 18 }}>
            <div className="flex items-center" style={{ gap: 7, marginBottom: 12 }}>
              <Sparkles size={14} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>AI 분석</span>
              <span className="t3" style={{ fontSize: 11 }}>점수는 룰 엔진, 설명은 AI</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>{p.rationale.summary}</div>

            <div className="eyebrow" style={{ marginBottom: 7 }}>강점</div>
            {p.rationale.pros.map((s, i) => (
              <div key={i} className="flex items-start" style={{ gap: 7, marginBottom: 5 }}>
                <Check size={13} style={{ color: "var(--pos)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s}</span>
              </div>
            ))}

            <div className="eyebrow" style={{ margin: "14px 0 7px" }}>약점</div>
            {p.rationale.cons.map((s, i) => (
              <div key={i} className="flex items-start" style={{ gap: 7, marginBottom: 5 }}>
                <X size={13} style={{ color: "var(--neg)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s}</span>
              </div>
            ))}

            <div className="surf-2" style={{ borderRadius: 6, padding: "11px 13px", marginTop: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 5 }}>권장 액션</div>
              <div style={{ fontSize: 12.5 }}>{p.rationale.action}</div>
            </div>

            {p.rationale.watch.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>확인 사항</div>
                {p.rationale.watch.map((s, i) => (
                  <div key={i} className="flex items-start" style={{ gap: 7, marginBottom: 4 }}>
                    <AlertTriangle size={12} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, color: "var(--warn)" }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "cost" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 16 }} className="dash-grid">
          <div className="surf" style={{ padding: 18 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <span className="eyebrow">원가 구성</span>
              <span className="t3 num" style={{ fontSize: 11 }}>환율 {state.settings.fxRate} KRW/CNY</span>
            </div>
            {COST_ITEMS.map(([k, label]) => {
              const v = p.cost[k]; const ratio = v / p.cost.total;
              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5 }}>{label}</span>
                    <span className="num t2" style={{ fontSize: 12.5 }}>{KRW(v)} <span className="t3">{(ratio * 100).toFixed(0)}%</span></span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${ratio * 100}%`, background: k === "intlShip" ? "var(--warn)" : "var(--accent)" }} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between" style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>총 원가</span>
              <span className="num" style={{ fontWeight: 650, fontSize: 15 }}>{KRW(p.cost.total)}</span>
            </div>
            <div className="surf-2 flex items-start" style={{ gap: 8, borderRadius: 6, padding: "10px 12px", marginTop: 14 }}>
              <Info size={13} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
              <span className="t3" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                무게 {p.weight.grams}g — {p.weight.source} (신뢰도 {p.weight.confidence.toFixed(2)}).
                {p.weight.confidence < 0.6 && " 추정 신뢰도가 낮아 안전마진이 적용되었습니다."}
              </span>
            </div>
          </div>

          <div className="surf" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>가격 결정</div>
            {[
              ["최소 판매가", p.price.min, "마진 하한선"],
              ["목표 판매가", p.price.target, `목표 마진 ${state.settings.targetMargin}%`],
              ["경쟁 기준가", p.price.competitor, "절사평균"],
            ].map(([k, v, note]) => (
              <div key={k} className="flex items-center justify-between" style={{ marginBottom: 11 }}>
                <div>
                  <div style={{ fontSize: 12.5 }}>{k}</div>
                  <div className="t3" style={{ fontSize: 11 }}>{note}</div>
                </div>
                <span className="num t2" style={{ fontSize: 13 }}>{KRW(v)}</span>
              </div>
            ))}
            <div className="surf-2" style={{ borderRadius: 6, padding: 13, marginTop: 4 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>최종 판매가</span>
                <span className="num" style={{ fontSize: 17, fontWeight: 650 }}>{KRW(p.price.final)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="t3" style={{ fontSize: 12 }}>예상 순이익</span>
                <span className="num" style={{ fontSize: 13, color: "var(--pos)", fontWeight: 600 }}>
                  {KRW(p.margin.krw)} · {PCT(p.margin.rate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "comp" && (
        <div className="surf" style={{ padding: 18 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <span className="eyebrow">경쟁사 가격 분포</span>
            <span className="t3" style={{ fontSize: 11.5 }}>
              표본 {p.comp.sample}건 · 매칭 {p.comp.sellers}건 · 신뢰도 {p.comp.confidence.toFixed(2)}
            </span>
          </div>

          {/* 가격 분포 바 */}
          <div style={{ position: "relative", marginBottom: 8, paddingTop: 22 }}>
            <div style={{ height: 30, borderRadius: 5, background: "var(--surface-3)", position: "relative", overflow: "visible" }}>
              <div style={{
                position: "absolute", top: 0, bottom: 0, borderRadius: 5, background: "var(--accent-soft)",
                left: `${((p.comp.p25 - p.comp.low) / (p.comp.high - p.comp.low)) * 100}%`,
                width: `${((p.comp.p75 - p.comp.p25) / (p.comp.high - p.comp.low)) * 100}%`,
              }} />
              <div style={{
                position: "absolute", top: -4, bottom: -4, width: 2, background: "var(--text-2)",
                left: `${((p.comp.median - p.comp.low) / (p.comp.high - p.comp.low)) * 100}%`,
              }} />
              <div style={{
                position: "absolute", top: -22, transform: "translateX(-50%)",
                left: `${((p.price.final - p.comp.low) / (p.comp.high - p.comp.low)) * 100}%`,
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <span className="chip num" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>내 가격</span>
                <div style={{ width: 2, height: 38, background: "var(--accent)" }} />
              </div>
            </div>
            <div className="flex justify-between" style={{ marginTop: 8 }}>
              {[["최저", p.comp.low], ["P25", p.comp.p25], ["중앙", p.comp.median], ["P75", p.comp.p75], ["최고", p.comp.high]].map(([k, v]) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div className="t3" style={{ fontSize: 10.5 }}>{k}</div>
                  <div className="num" style={{ fontSize: 11.5 }}>{KRW(v)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginTop: 20 }}>
            {[
              ["판매자 수", p.comp.sellers + "곳"],
              ["상위 리뷰 중앙값", p.comp.reviewMedian.toLocaleString() + "건"],
              ["월 검색량", p.demandEst.monthlySearch.toLocaleString() + "회"],
              ["판매량 추정", `${p.demandEst.range[0]}~${p.demandEst.range[1]}개`],
            ].map(([k, v]) => (
              <div key={k} className="surf-2" style={{ borderRadius: 6, padding: "11px 13px" }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>{k}</div>
                <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="t3" style={{ fontSize: 11.5, marginTop: 12 }}>
            판매량은 직접 확인이 불가능하여 리뷰 증가 속도와 순위로 추정한 값입니다. 등급 판단용으로만 사용하세요.
          </div>
        </div>
      )}

      {tab === "risk" && (
        <div className="surf" style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
            {[["종합 판정", p.risk.level === "CLEAR" ? "정상" : "검토 필요"], ["브랜드 리스크", p.risk.brand === "NONE" ? "없음" : p.risk.brand === "SUSPECTED" ? "의심" : "확정"], ["KC 인증 대상", p.risk.kc === "NO" ? "아님" : p.risk.kc === "POSSIBLE" ? "가능성 있음" : "대상"], ["리스크 감점", `−${p.penalty}점`]].map(([k, v]) => (
              <div key={k} className="surf-2" style={{ borderRadius: 6, padding: "11px 13px" }}>
                <div className="eyebrow" style={{ marginBottom: 5 }}>{k}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          {p.risk.notes.length > 0 ? (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>판정 근거</div>
              {p.risk.notes.map((n, i) => (
                <div key={i} className="flex items-start" style={{ gap: 8, marginBottom: 6 }}>
                  <AlertTriangle size={13} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12.5 }}>{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="t3" style={{ fontSize: 12.5 }}>브랜드 로고, 상표 문구, 규제 카테고리 모두 해당 없음. 자동 승인 가능한 상품입니다.</div>
          )}
        </div>
      )}

      {tab === "source" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }} className="dash-grid">
          <div className="surf" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>원본 상품</div>
            {[["사이트", p.site], ["상품 ID", p.sourceId], ["원문 상품명", p.sourceTitle], ["셀러 평점", p.sellerScore], ["누적 판매", p.soldCount.toLocaleString() + "건"], ["청구중량", `${p.weight.grams}g (${p.weight.source})`]].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between" style={{ gap: 12, marginBottom: 9 }}>
                <span className="t3" style={{ fontSize: 12, flexShrink: 0 }}>{k}</span>
                <span className="num" style={{ fontSize: 12.5, textAlign: "right" }}>{v}</span>
              </div>
            ))}
            <Btn icon={ExternalLink} style={{ marginTop: 6 }}>원본 페이지 열기</Btn>
          </div>
          <div className="surf" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>옵션 · SKU</div>
            {p.options.map((o) => (
              <div key={o.sku} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontSize: 12.5 }}>{o.name}</div>
                  <div className="mono t3" style={{ fontSize: 10.5 }}>{o.sku}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: 12.5 }}>{KRW(o.price)}</div>
                  <div className="num t3" style={{ fontSize: 11 }}>재고 {o.stock}</div>
                </div>
              </div>
            ))}
            <div className="eyebrow" style={{ margin: "16px 0 8px" }}>검색 태그 (상위 10개만 등록)</div>
            <div className="flex" style={{ gap: 5, flexWrap: "wrap" }}>
              {p.tags.map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
          </div>
        </div>
      )}

      {/* 상세페이지 미리보기 진입 */}
      <div className="surf flex items-center justify-between" style={{ padding: 16, gap: 16, flexWrap: "wrap" }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center" }}>
            <FileImage size={17} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>GPT 상세페이지</div>
            <div className="t3" style={{ fontSize: 12 }}>
              {p.sections ? `섹션 ${p.sections.length}개 · ${p.sections.filter(s => s.state !== "DRAFT").length}개 승인됨` : "아직 생성되지 않았습니다. 승인 후 생성할 수 있습니다."}
            </div>
          </div>
        </div>
        <Btn size="md" variant={p.sections ? "primary" : "ghost"} icon={ArrowRight}
          disabled={p.status === "RECOMMENDED" || p.status === "HOLD"}
          onClick={() => nav("gptpage", { id: p.id })}>
          {p.sections ? "상세페이지 열기" : "상세페이지 만들기"}
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — GPT Detail Page Studio
   설계 원칙 5·6을 화면으로 강제한다:
   · negative prompt는 읽기 전용 (한글 생성 금지)
   · 대표/실물 섹션은 원본 사진 고정
   · 고정 블록(배송·교환환불)은 수정 불가
============================================================================ */
function GptDetailPage({ id }) {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });
  const p = state.products.find((x) => x.id === id);
  const [sel, setSel] = useState("hero");
  const [view, setView] = useState("studio");
  const [gen, setGen] = useState(false);

  if (!p) return <Empty icon={FileImage} title="상품을 찾을 수 없습니다" body="목록에서 다시 선택해 주세요." />;

  const sections = p.sections;
  const section = sections?.find((s) => s.id === sel) || sections?.[0];
  const approvedCount = sections ? sections.filter((s) => s.state !== "DRAFT").length : 0;
  const genCount = sections ? sections.filter((s) => s.src === "GENERATED" || s.src === "COMPOSED").length : 0;
  const allApproved = sections && sections.every((s) => s.src === "NONE" || s.src === "ORIGINAL" || s.state !== "DRAFT");

  const startGenerate = () => {
    setGen(true);
    setTimeout(() => {
      dispatch({ type: "GENERATE_CONTENT", id: p.id });
      dispatch({ type: "TOAST", toast: { msg: "초안 이미지 8장 생성 완료 (63원)" } });
      setGen(false);
    }, 1500);
  };

  if (!sections) {
    return (
      <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Btn icon={ChevronLeft} onClick={() => nav("product", { id: p.id })}>상품</Btn>
        </div>
        <Empty icon={Sparkles} title="상세페이지를 아직 만들지 않았습니다"
          body="Claude가 섹션 구성과 이미지 프롬프트를 기획한 뒤, GPT Image로 초안을 생성합니다. 초안은 저가 모델을 사용하므로 8장에 약 63원이 듭니다."
          action={<Btn size="md" variant="primary" icon={gen ? Loader2 : Sparkles} onClick={startGenerate} disabled={gen}>
            {gen ? "기획 및 생성 중" : "상세페이지 기획 시작"}
          </Btn>} />
      </div>
    );
  }

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Btn icon={ChevronLeft} onClick={() => nav("product", { id: p.id })}>상품</Btn>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>상세페이지 스튜디오</div>
            <div className="t3" style={{ fontSize: 12 }}>{p.name}</div>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div className="surf-2 flex items-center" style={{ gap: 7, padding: "5px 10px", borderRadius: 6 }}>
            <Wallet size={12} style={{ color: "var(--text-3)" }} />
            <span className="num t2" style={{ fontSize: 11.5 }}>이미지 예산 {approvedCount * 7 + 63} / {state.settings.productImageCap}원</span>
          </div>
          <div className="flex" style={{ gap: 2, background: "var(--surface-2)", padding: 2, borderRadius: 6 }}>
            {[["studio", "스튜디오"], ["preview", "HTML 미리보기"]].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} className="btn btn-sm"
                style={{ background: view === k ? "var(--surface)" : "transparent", color: view === k ? "var(--text)" : "var(--text-3)", boxShadow: view === k ? "var(--shadow)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "preview" ? (
        <HtmlPreview p={p} sections={sections} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "218px minmax(0,1fr)", gap: 14 }} className="studio-grid">
          {/* 섹션 목록 */}
          <div className="surf" style={{ padding: 10, alignSelf: "start" }}>
            <div className="eyebrow" style={{ padding: "2px 6px 8px" }}>섹션 {sections.length}</div>
            {sections.map((s, i) => {
              const locked = s.src === "NONE";
              return (
                <button key={s.id} onClick={() => setSel(s.id)} className="navitem" data-on={sel === s.id ? "1" : "0"}
                  style={{ height: 34, marginBottom: 1 }}>
                  <span className="mono t3" style={{ fontSize: 10.5, width: 14 }}>{i + 1}</span>
                  {locked ? <Lock size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                    : s.state === "DRAFT" ? <CircleDot size={12} style={{ color: "var(--warn)", flexShrink: 0 }} />
                      : <Check size={12} style={{ color: "var(--pos)", flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>{s.label}</span>
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
              <div className="t3" style={{ fontSize: 10.5, lineHeight: 1.5, padding: "0 6px" }}>
                <Lock size={9} style={{ display: "inline", marginRight: 3 }} />고정 블록은 정책상 수정할 수 없습니다.
              </div>
            </div>
          </div>

          {/* 편집 영역 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="surf" style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{section.label}</span>
                  <Chip tone={section.src === "GENERATED" ? "accent" : section.src === "ORIGINAL" ? "pos" : "neutral"}>
                    {section.src === "GENERATED" ? "생성 이미지" : section.src === "ORIGINAL" ? "원본 사진" : section.src === "COMPOSED" ? "생성 + 합성" : "HTML 고정"}
                  </Chip>
                  {section.state === "DRAFT" && section.src !== "NONE" && <Chip tone="warn">초안</Chip>}
                  {section.state === "APPROVED" && <Chip tone="pos">승인됨</Chip>}
                  {section.state === "FINAL" && <Chip tone="pos">확정 생성</Chip>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,220px) minmax(0,1fr)", gap: 16 }} className="dash-grid">
                <div>
                  {section.src === "NONE" ? (
                    <div className="surf-2 flex flex-col items-center justify-center" style={{ aspectRatio: "4/5", borderRadius: 6, gap: 8 }}>
                      <Lock size={18} style={{ color: "var(--text-3)" }} />
                      <span className="t3" style={{ fontSize: 11.5 }}>HTML 고정 블록</span>
                    </div>
                  ) : (
                    <ImgMock tone={section.tone} label={section.type} src={section.src} variant={section.variant || 0} big />
                  )}
                  {section.src !== "NONE" && (
                    <div className="t3 flex items-center justify-center" style={{ gap: 5, fontSize: 10.5, marginTop: 7 }}>
                      <Info size={10} />텍스트 없음 — 한글은 합성 레이어에서 추가
                    </div>
                  )}
                </div>

                <div>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>텍스트 오버레이 (합성)</div>
                  <div className="surf-2" style={{ borderRadius: 6, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-.02em", marginBottom: 4 }}>{section.headline}</div>
                    <div className="t2" style={{ fontSize: 12.5 }}>{section.sub}</div>
                    <div className="t3" style={{ fontSize: 10.5, marginTop: 8 }}>Pretendard Bold 48 / #2B2B2B · HTML 오버레이</div>
                  </div>

                  {section.prompt ? (
                    <>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span className="eyebrow">이미지 프롬프트</span>
                        <Btn icon={RefreshCw}>수정</Btn>
                      </div>
                      <div className="surf-2 mono" style={{ borderRadius: 6, padding: 11, fontSize: 11.5, lineHeight: 1.55, color: "var(--text-2)", marginBottom: 10 }}>
                        {section.prompt}
                      </div>
                      <div className="eyebrow" style={{ marginBottom: 5 }}>네거티브 (자동 · 수정 불가)</div>
                      <div className="mono flex items-center" style={{ gap: 6, fontSize: 11, color: "var(--text-3)", background: "var(--surface-2)", borderRadius: 6, padding: "8px 11px" }}>
                        <Lock size={10} style={{ flexShrink: 0 }} />
                        no text, no letters, no typography, no Korean characters
                      </div>
                    </>
                  ) : (
                    <div className="t3" style={{ fontSize: 12, lineHeight: 1.6 }}>
                      {section.src === "ORIGINAL"
                        ? "실물 확인 섹션은 원본 상품 사진을 사용합니다. 배경 정리와 중국어 마스킹만 적용되며 생성 이미지로 대체할 수 없습니다."
                        : "배송·교환·환불 안내는 정책 고정 블록입니다. 해외구매대행 고지가 자동 삽입됩니다."}
                    </div>
                  )}
                </div>
              </div>

              {section.src !== "NONE" && section.src !== "ORIGINAL" && (
                <div className="flex" style={{ gap: 7, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                  <Btn size="md" icon={RefreshCw} onClick={() => {
                    dispatch({ type: "SECTION_REGEN", id: p.id, sectionId: section.id });
                    dispatch({ type: "TOAST", toast: { msg: "재생성 완료 (초안 7원)" } });
                  }}>재생성 <span className="t3">7원</span></Btn>
                  <Btn size="md" icon={Sparkles} onClick={() => dispatch({ type: "TOAST", toast: { msg: "고품질 생성 요청 (230원)" } })}>
                    고품질 생성 <span className="t3">230원</span>
                  </Btn>
                  <Btn size="md" variant="pos" icon={Check} disabled={section.state !== "DRAFT"}
                    onClick={() => dispatch({ type: "SECTION_APPROVE", id: p.id, sectionId: section.id })}>
                    {section.state === "DRAFT" ? "이 섹션 승인" : "승인됨"}
                  </Btn>
                </div>
              )}
            </div>

            {/* 확정 생성 */}
            <div className="surf flex items-center justify-between" style={{ padding: 16, gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                  진행 {approvedCount} / {genCount} 섹션 승인
                </div>
                <div className="t3" style={{ fontSize: 11.5 }}>
                  {p.status === "CONTENT_READY"
                    ? "확정 이미지 생성 완료. 등록 대기에서 등록할 수 있습니다."
                    : `승인된 섹션만 고품질 모델로 다시 생성합니다. 예상 ${genCount * 65}원`}
                </div>
              </div>
              {p.status === "CONTENT_READY" ? (
                <Btn size="md" variant="primary" icon={ArrowRight} onClick={() => nav("pending")}>등록 대기로 이동</Btn>
              ) : (
                <Btn size="md" variant="primary" icon={Sparkles} disabled={!allApproved}
                  onClick={() => {
                    dispatch({ type: "FINALIZE_CONTENT", id: p.id });
                    dispatch({ type: "TOAST", toast: { msg: `확정 이미지 ${genCount}장 생성 완료` } });
                  }}>
                  {allApproved ? "확정 이미지 생성" : "모든 섹션 승인 필요"}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HtmlPreview({ p, sections }) {
  const [vp, setVp] = useState("mobile");
  const w = vp === "mobile" ? 380 : 860;
  return (
    <div className="surf" style={{ padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="eyebrow">HTML 미리보기</span>
          <Chip tone="pos" icon={Check}>린터 통과</Chip>
          <Chip>이미지 8장 · 1.2MB</Chip>
        </div>
        <div className="flex" style={{ gap: 2, background: "var(--surface-2)", padding: 2, borderRadius: 6 }}>
          {[["mobile", "모바일"], ["desktop", "PC"]].map(([k, label]) => (
            <button key={k} onClick={() => setVp(k)} className="btn btn-sm"
              style={{ background: vp === k ? "var(--surface)" : "transparent", color: vp === k ? "var(--text)" : "var(--text-3)" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "20px 12px", display: "flex", justifyContent: "center", maxHeight: 620, overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: w, background: "#FFFFFF", borderRadius: 4, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
          {sections.map((s) => {
            if (s.src === "NONE") {
              return (
                <div key={s.id} style={{ padding: "22px 20px", borderTop: "1px solid #EDEDED", background: "#FAFAFA" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 8 }}>{s.headline}</div>
                  {s.type === "DELIVERY" ? (
                    <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.7 }}>
                      본 상품은 해외구매대행 상품입니다.<br />주문 후 영업일 기준 7~14일 소요됩니다.<br />
                      관·부가세는 판매가에 포함되어 있습니다.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.7 }}>
                      단순 변심에 의한 교환·환불은 수령 후 7일 이내 가능합니다.<br />
                      해외 배송 특성상 왕복 배송비가 부과됩니다.
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={s.id} style={{ position: "relative" }}>
                <div style={{
                  aspectRatio: vp === "mobile" ? "4/5" : "16/9",
                  background: s.src === "ORIGINAL"
                    ? "repeating-linear-gradient(45deg,#F0F0F0 0 10px,#E8E8E8 10px 20px)"
                    : `linear-gradient(${140 + (s.variant || 0) * 37}deg, ${s.tone} 0%, color-mix(in srgb, ${s.tone} 45%, #ffffff) 55%, color-mix(in srgb, ${s.tone} 70%, #000000) 100%)`,
                  display: "flex", flexDirection: "column", justifyContent: "flex-start",
                  padding: vp === "mobile" ? "28px 22px" : "44px 40px",
                }}>
                  <div style={{
                    fontSize: vp === "mobile" ? 21 : 30, fontWeight: 700, letterSpacing: "-.03em",
                    color: s.src === "ORIGINAL" ? "#333" : "#FFF", lineHeight: 1.3,
                    textShadow: s.src === "ORIGINAL" ? "none" : "0 1px 12px rgba(0,0,0,.25)",
                  }}>{s.headline}</div>
                  <div style={{
                    fontSize: vp === "mobile" ? 12.5 : 15, marginTop: 7,
                    color: s.src === "ORIGINAL" ? "#777" : "rgba(255,255,255,.88)",
                  }}>{s.sub}</div>
                </div>
                {s.src === "GENERATED" && (
                  <div style={{ fontSize: 9.5, color: "#999", padding: "5px 20px", background: "#FFF", textAlign: "right" }}>
                    ※ 연출 이미지로, 실제 상품과 다를 수 있습니다.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — Pending Products
============================================================================ */
function Pending() {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });
  const list = state.products.filter((p) => ["APPROVED", "CONTENT_READY"].includes(p.status));

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>등록 대기</h1>
        <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>
          승인된 상품입니다. 상세페이지를 만들고 등록하세요. 오늘 등록 한도 {state.settings.dailyListCap}건
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={ClipboardCheck} title="등록 대기 중인 상품이 없습니다"
          body="발굴에서 추천 상품을 승인하면 이곳으로 이동합니다."
          action={<Btn size="md" variant="primary" onClick={() => nav("discovery")}>발굴로 이동</Btn>} />
      ) : (
        <div className="surf" style={{ overflow: "hidden" }}>
          {list.map((p, i) => {
            const ready = p.status === "CONTENT_READY";
            return (
              <div key={p.id} className="flex items-center" style={{ gap: 14, padding: "14px 16px", borderTop: i ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                <div style={{ width: 44, flexShrink: 0 }}><ImgMock tone="#7A8471" label="" ratio="1/1" src="ORIGINAL" /></div>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div className="flex items-center" style={{ gap: 6, marginBottom: 3 }}>
                    <Grade g={p.grade} size="sm" />
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.score}</span>
                    {ready ? <Chip tone="pos" icon={Check}>상세페이지 완료</Chip> : <Chip tone="warn">상세페이지 필요</Chip>}
                  </div>
                  <button onClick={() => nav("product", { id: p.id })}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontSize: 13.5, color: "var(--text)" }}>
                    {p.name}
                  </button>
                  <div className="t3 num" style={{ fontSize: 11.5, marginTop: 2 }}>
                    {KRW(p.price.final)} · 마진 {PCT(p.margin.rate)} ({KRW(p.margin.krw)}) · 승인 {p.approvedAt}
                  </div>
                </div>
                <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
                  <Btn icon={FileImage} onClick={() => nav("gptpage", { id: p.id })}>
                    {ready ? "상세페이지" : "상세페이지 만들기"}
                  </Btn>
                  <Btn icon={Eye} onClick={() => nav("product", { id: p.id })}>분석</Btn>
                  <Btn variant="neg" icon={X} onClick={() => {
                    dispatch({ type: "REJECT", id: p.id, reason: "등록 대기에서 반려" });
                    dispatch({ type: "TOAST", toast: { msg: "반려 처리했습니다" } });
                  }}>반려</Btn>
                  <Btn variant="primary" icon={Store} disabled={!ready}
                    title={ready ? undefined : "상세페이지를 먼저 완성해야 합니다"}
                    onClick={() => {
                      dispatch({ type: "PUBLISH", id: p.id });
                      dispatch({ type: "TOAST", toast: { msg: "등록 완료 — 판매 중 상품으로 이동" } });
                    }}>등록</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SCREEN — Registered Products
============================================================================ */
function Registered() {
  const { state, dispatch } = useApp();
  const nav = (name, params) => dispatch({ type: "NAV", name, params });
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState(0);
  const list = state.products.filter((p) => ["PUBLISHED", "SUSPENDED"].includes(p.status));

  const revenue = list.reduce((s, p) => s + (p.revenue30d || 0), 0);
  const units = list.reduce((s, p) => s + (p.sold30d || 0), 0);

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>판매 중 상품</h1>
        <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>
          {list.length}개 등록 · 30일 {units}개 판매 · 매출 {KRW(revenue)}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={Store} title="등록된 상품이 없습니다" body="등록 대기에서 상세페이지를 완성한 상품을 등록하세요."
          action={<Btn size="md" variant="primary" onClick={() => nav("pending")}>등록 대기로</Btn>} />
      ) : (
        <div className="surf" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["상품", "채널 상품번호", "판매가", "마진", "30일 판매", "상태", ""].map((h, i) => (
                  <th key={h} className="eyebrow" style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "10px 14px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="row-hover" style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <button onClick={() => nav("product", { id: p.id })}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                      <div className="flex items-center" style={{ gap: 6, marginBottom: 2 }}>
                        <Grade g={p.grade} size="sm" />
                        <span style={{ fontSize: 13, color: "var(--text)" }}>{p.name}</span>
                      </div>
                      <span className="mono t3" style={{ fontSize: 10.5 }}>{p.id} · 등록 {p.publishedAt}</span>
                    </button>
                  </td>
                  <td className="mono t2" style={{ padding: "11px 14px", fontSize: 11.5 }}>{p.channelNo}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    {edit === p.id ? (
                      <div className="flex items-center" style={{ gap: 5, justifyContent: "flex-end" }}>
                        <input className="inp num" type="number" value={draft} onChange={(e) => setDraft(Number(e.target.value))}
                          style={{ width: 96, height: 28, textAlign: "right" }} />
                        <Btn variant="primary" icon={Check} onClick={() => {
                          dispatch({ type: "PRICE_CHANGE", id: p.id, price: draft });
                          dispatch({ type: "TOAST", toast: { msg: `판매가를 ${KRW(draft)}로 변경했습니다` } });
                          setEdit(null);
                        }} />
                        <Btn icon={X} onClick={() => setEdit(null)} />
                      </div>
                    ) : (
                      <button onClick={() => { setEdit(p.id); setDraft(p.price.final); }}
                        className="num" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 13 }}>
                        {KRW(p.price.final)}
                      </button>
                    )}
                  </td>
                  <td className="num" style={{ padding: "11px 14px", textAlign: "right", fontSize: 12.5, color: p.margin.rate < state.settings.minMargin / 100 ? "var(--neg)" : "var(--pos)" }}>
                    {PCT(p.margin.rate)}
                    <div className="t3" style={{ fontSize: 11 }}>{KRW(p.margin.krw)}</div>
                  </td>
                  <td className="num" style={{ padding: "11px 14px", textAlign: "right", fontSize: 12.5 }}>
                    {p.sold30d}개
                    <div className="t3" style={{ fontSize: 11 }}>{KRW(p.revenue30d)}</div>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    {p.status === "PUBLISHED" ? <Chip tone="pos">판매중</Chip> : <Chip tone="warn" icon={Pause}>판매중지</Chip>}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div className="flex" style={{ gap: 5, justifyContent: "flex-end" }}>
                      {p.status === "PUBLISHED" ? (
                        <Btn icon={Pause} onClick={() => { dispatch({ type: "SUSPEND", id: p.id }); dispatch({ type: "TOAST", toast: { msg: "판매를 중지했습니다" } }); }}>중지</Btn>
                      ) : (
                        <Btn variant="pos" icon={RefreshCw} onClick={() => { dispatch({ type: "RESUME", id: p.id }); dispatch({ type: "TOAST", toast: { msg: "판매를 재개했습니다" } }); }}>재등록</Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SCREEN — Order Manager
============================================================================ */
const ORDER_FLOW = ["RECEIVED", "VALIDATED", "PO_CONFIRMED", "SHIPPED", "TRACKING_SYNCED", "DELIVERED"];
const ORDER_LABEL = {
  RECEIVED: "주문 접수", VALIDATED: "검증 완료", PO_REQUESTED: "발주 요청",
  PO_CONFIRMED: "발주 완료", PO_FAILED: "발주 실패", SHIPPED: "출고",
  TRACKING_SYNCED: "송장 전송", DELIVERED: "배송 완료",
};

function Orders() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState("all");
  const list = state.orders.filter((o) => filter === "all" ? true : filter === "issue" ? o.status === "PO_FAILED" : o.status === filter);
  const failed = state.orders.filter((o) => o.status === "PO_FAILED").length;

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="flex items-start justify-between" style={{ gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>주문</h1>
          <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>주문 수집 → 발주 → 송장 전송까지 관리합니다</div>
        </div>
        <div className="flex" style={{ gap: 7 }}>
          <Btn size="md" icon={RefreshCw} onClick={() => dispatch({ type: "TOAST", toast: { msg: "신규 주문 0건 — 최신 상태입니다" } })}>주문 동기화</Btn>
          <Btn size="md" icon={Truck} onClick={() => dispatch({ type: "TOAST", toast: { msg: "발주 신청서를 내려받았습니다" } })}>발주서 내려받기</Btn>
        </div>
      </div>

      {failed > 0 && (
        <div className="surf flex items-center justify-between" style={{ padding: "12px 14px", background: "var(--neg-soft)", borderColor: "transparent", gap: 12, flexWrap: "wrap" }}>
          <div className="flex items-center" style={{ gap: 9 }}>
            <AlertTriangle size={15} style={{ color: "var(--neg)" }} />
            <span style={{ fontSize: 13, color: "var(--neg)" }}>
              발주 실패 {failed}건 — 자동 재시도가 중단되었습니다. 확인이 필요합니다.
            </span>
          </div>
          <Btn onClick={() => setFilter("issue")}>확인하기</Btn>
        </div>
      )}

      <div className="flex" style={{ gap: 5, flexWrap: "wrap" }}>
        {[["all", "전체"], ["VALIDATED", "발주 대기"], ["PO_CONFIRMED", "발주 완료"], ["SHIPPED", "출고"], ["TRACKING_SYNCED", "송장 전송"], ["issue", "문제 있음"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className="btn btn-sm"
            style={{
              background: filter === k ? "var(--surface-3)" : "transparent",
              color: filter === k ? "var(--text)" : "var(--text-3)",
              border: `1px solid ${filter === k ? "transparent" : "var(--line)"}`,
              fontWeight: filter === k ? 600 : 400,
            }}>{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty icon={ShoppingCart} title="해당 조건의 주문이 없습니다" body="다른 필터를 선택하거나 주문을 동기화해 보세요." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((o) => {
            const stepIdx = ORDER_FLOW.indexOf(o.status);
            const failedOrder = o.status === "PO_FAILED";
            return (
              <div key={o.id} className="surf" style={{ padding: 16 }}>
                <div className="flex items-start justify-between" style={{ gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div className="flex items-center" style={{ gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="mono t3" style={{ fontSize: 11 }}>{o.id}</span>
                      {failedOrder ? <Chip tone="neg" icon={AlertTriangle}>발주 실패</Chip>
                        : o.status === "DELIVERED" ? <Chip tone="pos">배송 완료</Chip>
                          : <Chip tone="accent">{ORDER_LABEL[o.status]}</Chip>}
                    </div>
                    <div style={{ fontSize: 13.5 }}>{o.productName}</div>
                    <div className="t3 num" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {o.option} · {o.qty}개 · {o.orderedAt}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>{KRW(o.payment)}</div>
                    <div className="num t3" style={{ fontSize: 11.5 }}>
                      원가 {KRW(o.cost)} · 이익 {KRW(o.payment - o.cost - Math.round(o.payment * 0.0574))}
                    </div>
                  </div>
                </div>

                {/* 진행 단계 */}
                <div className="flex items-center" style={{ gap: 0, marginBottom: 14 }}>
                  {ORDER_FLOW.map((s, i) => {
                    const done = !failedOrder && stepIdx >= i;
                    const isFailPoint = failedOrder && i === 2;
                    return (
                      <React.Fragment key={s}>
                        <div className="flex flex-col items-center" style={{ gap: 5, flexShrink: 0 }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 8, display: "grid", placeItems: "center",
                            background: isFailPoint ? "var(--neg)" : done ? "var(--accent)" : "var(--surface-3)",
                          }}>
                            {isFailPoint ? <X size={9} strokeWidth={3} style={{ color: "#fff" }} />
                              : done ? <Check size={9} strokeWidth={3} style={{ color: "var(--accent-fg)" }} /> : null}
                          </div>
                          <span style={{ fontSize: 9.5, color: done || isFailPoint ? "var(--text-2)" : "var(--text-3)", whiteSpace: "nowrap" }}>
                            {ORDER_LABEL[s]}
                          </span>
                        </div>
                        {i < ORDER_FLOW.length - 1 && (
                          <div style={{ flex: 1, height: 1.5, background: !failedOrder && stepIdx > i ? "var(--accent)" : "var(--line)", marginTop: -14 }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div className="flex" style={{ gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 2 }}>발주번호</div>
                      <div className="mono" style={{ fontSize: 12 }}>{o.poNo || "—"}</div>
                    </div>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 2 }}>송장</div>
                      <div className="mono" style={{ fontSize: 12 }}>{o.tracking || "—"}</div>
                    </div>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 2 }}>수취인</div>
                      <div className="mono t3" style={{ fontSize: 12 }}>김●● · 010-••••-••••</div>
                    </div>
                  </div>
                  <div className="flex" style={{ gap: 6 }}>
                    {failedOrder && (
                      <Btn variant="primary" icon={RefreshCw} onClick={() => {
                        dispatch({ type: "ORDER_RETRY", id: o.id });
                        dispatch({ type: "TOAST", toast: { msg: "발주를 재시도했습니다" } });
                      }}>발주 재시도</Btn>
                    )}
                    {o.status === "VALIDATED" && (
                      <Btn variant="primary" icon={Truck} onClick={() => {
                        dispatch({ type: "ORDER_PURCHASE", id: o.id });
                        dispatch({ type: "TOAST", toast: { msg: "발주를 접수했습니다" } });
                      }}>발주하기</Btn>
                    )}
                    {o.status === "SHIPPED" && (
                      <Btn variant="primary" icon={ArrowRight} onClick={() => {
                        dispatch({ type: "ORDER_SYNC_TRACKING", id: o.id });
                        dispatch({ type: "TOAST", toast: { msg: "송장을 스마트스토어에 전송했습니다" } });
                      }}>송장 전송</Btn>
                    )}
                    <Btn icon={Eye}>주문 상세</Btn>
                  </div>
                </div>

                {failedOrder && (
                  <div className="flex items-start" style={{ gap: 8, marginTop: 12, padding: "10px 12px", background: "var(--neg-soft)", borderRadius: 6 }}>
                    <AlertTriangle size={13} style={{ color: "var(--neg)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: "var(--neg)" }}>{o.failure}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SCREEN — Settings
============================================================================ */
function Field({ label, hint, value, onChange, suffix, type = "number", options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 3 }}>{label}</label>
      {hint && <div className="t3" style={{ fontSize: 11.5, marginBottom: 6 }}>{hint}</div>}
      <div className="flex items-center" style={{ gap: 8 }}>
        {options ? (
          <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : (
          <input className="inp num" type={type} value={value}
            onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)} />
        )}
        {suffix && <span className="t3" style={{ fontSize: 12.5, flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, hint, on, onChange }) {
  return (
    <div className="flex items-start justify-between" style={{ gap: 16, marginBottom: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        {hint && <div className="t3" style={{ fontSize: 11.5 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!on)} style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? "var(--accent)" : "var(--line-strong)", position: "relative", transition: "background .15s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 8,
          background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }} />
      </button>
    </div>
  );
}

function Settings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const set = (key) => (value) => dispatch({ type: "SETTING", key, value });
  const [tab, setTab] = useState("pricing");

  const TABS = [["pricing", "가격 정책"], ["shipping", "환율·배송"], ["risk", "브랜드·KC"], ["gpt", "GPT 설정"], ["keys", "API 키"]];

  const sample = { cost: 18400, competitor: 24900 };
  const feeRate = (s.naverFee + s.payFee) / 100;
  const pMin = Math.ceil(sample.cost / (1 - feeRate - s.minMargin / 100) / s.roundUnit) * s.roundUnit;
  const pTarget = Math.ceil(sample.cost / (1 - feeRate - s.targetMargin / 100) / s.roundUnit) * s.roundUnit;
  const pFinal = Math.max(pMin, sample.competitor);
  const mRate = (pFinal - sample.cost - pFinal * feeRate) / pFinal;

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>설정</h1>
        <div className="t3" style={{ fontSize: 12.5, marginTop: 3 }}>정책을 바꾸면 이후 계산되는 모든 상품에 적용됩니다</div>
      </div>

      <div className="flex" style={{ gap: 2, borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "9px 13px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap",
              color: tab === k ? "var(--text)" : "var(--text-3)", fontWeight: tab === k ? 600 : 400,
              borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`, marginBottom: -1,
            }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 18, alignItems: "start" }} className="dash-grid">
        <div className="surf" style={{ padding: 18 }}>
          {tab === "pricing" && (
            <>
              <Field label="최소 마진율" hint="이 값 아래로는 절대 등록하지 않습니다" value={s.minMargin} onChange={set("minMargin")} suffix="%" />
              <Field label="목표 마진율" hint="경쟁가 정보가 부족할 때 적용됩니다" value={s.targetMargin} onChange={set("targetMargin")} suffix="%" />
              <Field label="네이버 수수료" value={s.naverFee} onChange={set("naverFee")} suffix="%" />
              <Field label="결제 수수료" value={s.payFee} onChange={set("payFee")} suffix="%" />
              <Field label="예비비" value={s.buffer} onChange={set("buffer")} suffix="%" />
              <Field label="경쟁 기준가 산정" hint="산술평균은 미끼가격에 왜곡되기 쉽습니다"
                value={s.competitorRef} onChange={set("competitorRef")}
                options={[["TRIMMED_MEAN", "절사평균 (권장)"], ["MEDIAN", "중앙값"], ["AVG", "산술평균"]]} />
              <Field label="가격 변동 상한" hint="1회 조정 폭이 이 값을 넘으면 승인 대기로 보냅니다" value={s.maxPriceChange} onChange={set("maxPriceChange")} suffix="%" />
              <Field label="반올림 단위" value={s.roundUnit} onChange={set("roundUnit")} suffix="원" />
            </>
          )}
          {tab === "shipping" && (
            <>
              <Field label="환율" hint="매일 03:00 자동 갱신됩니다" value={s.fxRate} onChange={set("fxRate")} suffix="KRW/CNY" />
              <Field label="환율 버퍼" hint="변동 대비 여유분" value={s.fxBuffer} onChange={set("fxBuffer")} suffix="%" />
              <Field label="부피중량 제수" hint="가로×세로×높이(mm) ÷ 이 값 = 부피중량(g)" value={s.volumetricDivisor} onChange={set("volumetricDivisor")} />
              <div className="surf-2" style={{ borderRadius: 6, padding: 13, marginTop: 4 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>국제배송 요율표</div>
                {[["~500g", 3800], ["~1kg", 5200], ["~2kg", 7900], ["~3kg", 10400], ["3kg 초과", "kg당 3,100원"]].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                    <span className="t2" style={{ fontSize: 12 }}>{k}</span>
                    <span className="num" style={{ fontSize: 12 }}>{typeof v === "number" ? KRW(v) : v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "risk" && (
            <>
              <Toggle label="브랜드 상품 자동 차단" hint="로고나 상표가 확정 감지되면 파이프라인을 중단합니다"
                on={s.brandBlock} onChange={set("brandBlock")} />
              <Field label="KC 인증 대상 처리" hint="자동 제외하지 않고 검토 대기로 두는 것을 권장합니다"
                value={s.kcPolicy} onChange={set("kcPolicy")}
                options={[["REVIEW_REQUIRED", "검토 필요로 분류 (권장)"], ["BLOCK", "자동 제외"], ["ALLOW", "제한 없음"]]} />
              <Field label="일일 등록 한도" hint="기계적 대량 등록은 채널 페널티 위험이 있습니다" value={s.dailyListCap} onChange={set("dailyListCap")} suffix="건" />
              <Field label="탐색 예산 비율" hint="점수가 낮아도 새 트렌드를 검증하기 위해 등록하는 비율" value={s.explorationRate} onChange={set("explorationRate")} suffix="%" />
              <div className="surf-2" style={{ borderRadius: 6, padding: 13 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>차단 키워드</div>
                <div className="flex" style={{ gap: 5, flexWrap: "wrap" }}>
                  {["나이키", "아디다스", "디즈니", "전자담배", "의약품", "배터리", "짝퉁", "레플리카"].map((t) => (
                    <Chip key={t} tone="neg">{t}</Chip>
                  ))}
                  <Btn icon={Plus}>추가</Btn>
                </div>
              </div>
            </>
          )}
          {tab === "gpt" && (
            <>
              <Field label="초안 생성 모델" hint="재생성이 반복되는 단계는 저가 모델을 사용합니다"
                value={s.imageModelDraft} onChange={set("imageModelDraft")} type="text" />
              <Field label="확정 생성 모델" hint="승인된 섹션만 고품질로 다시 생성합니다"
                value={s.imageModelFinal} onChange={set("imageModelFinal")} type="text" />
              <Field label="상품당 이미지 예산" hint="초과하면 생성을 중단하고 알립니다" value={s.productImageCap} onChange={set("productImageCap")} suffix="원" />
              <Field label="일일 AI 예산" hint="초과하면 이미지 큐를 정지합니다" value={s.dailyBudget} onChange={set("dailyBudget")} suffix="원" />
              <div className="surf-2 flex items-start" style={{ gap: 9, borderRadius: 6, padding: 13 }}>
                <Lock size={14} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>변경할 수 없는 정책</div>
                  <div className="t3" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                    이미지에 한글을 생성하지 않습니다. 대표 이미지는 원본 상품 사진만 사용합니다.
                    두 규칙은 표시광고 리스크와 직결되어 설정으로 해제할 수 없습니다.
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === "keys" && (
            <>
              {[["1688 Open API", "sk_live_••••••••••••8f2a", "미연결"], ["네이버 커머스 API", "••••••••••••4b71", "미연결"],
              ["OpenAI (GPT Image)", "sk-••••••••••••92c4", "미연결"], ["Anthropic (Claude)", "sk-ant-••••••••7d10", "미연결"],
              ["퀵스타", "—", "협의 중"]].map(([name, key, status]) => (
                <div key={name} className="flex items-center justify-between" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
                    <div className="mono t3" style={{ fontSize: 11.5, marginTop: 2 }}>{key}</div>
                  </div>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <Chip tone={status === "협의 중" ? "warn" : "neutral"}>{status}</Chip>
                    <Btn>연결</Btn>
                  </div>
                </div>
              ))}
              <div className="t3" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.6 }}>
                Prototype 단계에서는 외부 API를 연결하지 않습니다. 모든 화면은 Mock 데이터로 동작합니다.
              </div>
            </>
          )}
        </div>

        {/* 시뮬레이터 */}
        <div className="surf" style={{ padding: 18, position: "sticky", top: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>실시간 시뮬레이션</div>
          <div className="t3" style={{ fontSize: 11.5, marginBottom: 14 }}>
            샘플: 경량 캠핑 릴렉스 체어 (원가 {KRW(sample.cost)}, 경쟁 기준가 {KRW(sample.competitor)})
          </div>
          {[["최소 판매가", pMin], ["목표 판매가", pTarget], ["최종 판매가", pFinal]].map(([k, v], i) => (
            <div key={k} className="flex items-center justify-between" style={{ marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: i === 2 ? 600 : 400, color: i === 2 ? "var(--text)" : "var(--text-2)" }}>{k}</span>
              <span className="num" style={{ fontSize: i === 2 ? 15 : 13, fontWeight: i === 2 ? 650 : 400 }}>{KRW(v)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12.5 }}>예상 마진율</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 600, color: mRate >= s.minMargin / 100 ? "var(--pos)" : "var(--neg)" }}>
              {PCT(mRate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 12.5 }}>판정</span>
            {mRate >= s.minMargin / 100 ? <Chip tone="pos" icon={Check}>등록 가능</Chip> : <Chip tone="neg" icon={X}>마진 미달</Chip>}
          </div>

          <div className="surf-2" style={{ borderRadius: 6, padding: 12, marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>이 정책을 적용하면</div>
            {[["가격 인상", "88건"], ["가격 인하", "141건"], ["신규 탈락", "31건", "neg"], ["신규 통과", "12건", "pos"]].map(([k, v, tone]) => (
              <div key={k} className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                <span className="t2" style={{ fontSize: 12 }}>{k}</span>
                <span className="num" style={{ fontSize: 12, color: tone === "neg" ? "var(--neg)" : tone === "pos" ? "var(--pos)" : "var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
          <Btn variant="primary" size="md" style={{ width: "100%", marginTop: 14 }}
            onClick={() => dispatch({ type: "TOAST", toast: { msg: "정책 v4를 저장했습니다" } })}>정책 저장</Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SHELL
============================================================================ */
const NAV_ITEMS = [
  ["dashboard", "대시보드", LayoutDashboard],
  ["discovery", "발굴", Search],
  ["pending", "등록 대기", ClipboardCheck],
  ["registered", "판매 중 상품", Store],
  ["orders", "주문", ShoppingCart],
  ["settings", "설정", SettingsIcon],
];

function Shell() {
  const { state, dispatch } = useApp();
  const { route, sidebarOpen } = state;
  const nav = (name, params) => dispatch({ type: "NAV", name, params });

  const pendingCount = state.products.filter((p) => ["APPROVED", "CONTENT_READY"].includes(p.status)).length;
  const orderIssues = state.orders.filter((o) => o.status === "PO_FAILED").length;
  const spendTotal = state.spend.ai + state.spend.image + state.spend.scrape;
  const badge = { pending: pendingCount, orders: orderIssues };

  const screen = () => {
    switch (route.name) {
      case "dashboard": return <Dashboard />;
      case "discovery": return <Discovery />;
      case "product": return <ProductDetail id={route.params.id} />;
      case "gptpage": return <GptDetailPage id={route.params.id} />;
      case "pending": return <Pending />;
      case "registered": return <Registered />;
      case "orders": return <Orders />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  };

  const activeNav = ["product", "gptpage"].includes(route.name) ? "discovery" : route.name;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <aside style={{
          width: 208, flexShrink: 0, borderRight: "1px solid var(--line)", background: "var(--surface)",
          padding: 12, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh",
        }}>
          <button onClick={() => nav("dashboard")} className="flex items-center"
            style={{ gap: 8, padding: "4px 6px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Layers size={13} strokeWidth={2.3} style={{ color: "var(--accent-fg)" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, letterSpacing: "-.01em", color: "var(--text)", whiteSpace: "nowrap" }}>AI Seller OS</div>
              <div className="t3" style={{ fontSize: 10 }}>DelightFilm</div>
            </div>
          </button>

          <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {NAV_ITEMS.map(([key, label, Icon]) => (
              <button key={key} className="navitem" data-on={activeNav === key ? "1" : "0"} onClick={() => nav(key)}>
                <Icon size={15} strokeWidth={1.9} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge[key] > 0 && (
                  <span className="chip num" style={{
                    height: 17, minWidth: 17, padding: "0 5px", justifyContent: "center",
                    background: key === "orders" ? "var(--neg-soft)" : "var(--surface-3)",
                    color: key === "orders" ? "var(--neg)" : "var(--text-2)", fontSize: 10.5,
                  }}>{badge[key]}</span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ marginTop: "auto" }}>
            <div className="surf-2" style={{ borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="eyebrow" style={{ fontSize: 10 }}>오늘 예산</span>
                <span className="num t3" style={{ fontSize: 10.5 }}>{Math.round((spendTotal / state.settings.dailyBudget) * 100)}%</span>
              </div>
              <div className="bar-track" style={{ marginBottom: 6 }}>
                <div className="bar-fill" style={{ width: `${(spendTotal / state.settings.dailyBudget) * 100}%`, background: "var(--accent)" }} />
              </div>
              <div className="num t2" style={{ fontSize: 11 }}>{KRW(spendTotal)} / {KRW(state.settings.dailyBudget)}</div>
            </div>
            <button className="navitem" onClick={() => dispatch({ type: "LOGOUT" })}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: "var(--surface-3)", display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>운</div>
              <span style={{ flex: 1, fontSize: 12.5 }}>운영자</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </aside>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="flex items-center justify-between" style={{
          height: 48, padding: "0 20px", borderBottom: "1px solid var(--line)",
          background: "var(--surface)", position: "sticky", top: 0, zIndex: 20, gap: 12,
        }}>
          <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
            <Btn icon={sidebarOpen ? PanelLeftClose : PanelLeft} variant="quiet" onClick={() => dispatch({ type: "SIDEBAR" })} />
            <span className="t3" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
              {NAV_ITEMS.find(([k]) => k === activeNav)?.[1]}
              {route.name === "product" && " / 상품 분석"}
              {route.name === "gptpage" && " / 상세페이지"}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {orderIssues > 0 && (
              <button onClick={() => nav("orders")} className="chip" style={{ background: "var(--neg-soft)", color: "var(--neg)", border: "none", cursor: "pointer" }}>
                <AlertTriangle size={11} /> 발주 실패 {orderIssues}
              </button>
            )}
            <Btn icon={state.theme === "light" ? Moon : Sun} variant="quiet" onClick={() => dispatch({ type: "THEME" })} />
          </div>
        </header>

        <main style={{ padding: 20, flex: 1, maxWidth: 1240, width: "100%" }}>{screen()}</main>
      </div>
    </div>
  );
}

/* ============================================================================
   ROOT
============================================================================ */
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const ctx = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AppCtx.Provider value={ctx}>
      <style>{TOKENS}{`
        @media (max-width: 900px){
          .dash-grid{grid-template-columns:minmax(0,1fr)!important}
          .studio-grid{grid-template-columns:minmax(0,1fr)!important}
        }
      `}</style>
      <div data-app data-theme={state.theme}>
        {state.authed ? <Shell /> : <Login />}
        <Toasts />
      </div>
    </AppCtx.Provider>
  );
}
