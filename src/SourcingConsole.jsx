import React, { useState, useMemo } from "react";
import { collect1688Product } from "./collector1688.js";
import {
  Check, X, Lock, AlertTriangle, ExternalLink, TrendingUp, TrendingDown,
  Sparkles, Sliders, RefreshCw, Search, ChevronDown, ChevronRight, Image as ImageIcon,
  LayoutGrid, FileImage, Settings2, Wallet, ShieldCheck, ShieldAlert, Info,
  ArrowRight, Package, Scale, Ruler, Zap, CircleDot, Gauge, Layers, Link2, Loader2,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   MOCK DATA — 1688 소싱 후보
   점수는 룰 엔진이 계산한 값이라고 가정한다. AI는 설명만 쓴다.
   ───────────────────────────────────────────────────────────── */

const FACTORS = [
  { key: "cost", label: "원가", weight: 20 },
  { key: "margin", label: "마진", weight: 22 },
  { key: "competition", label: "경쟁", weight: 18 },
  { key: "logistics", label: "물류", weight: 12 },
  { key: "trend", label: "트렌드", weight: 12 },
  { key: "risk", label: "리스크", weight: 8 },
  { key: "demand", label: "수요", weight: 8 },
];

const PRODUCTS = [
  {
    id: "SRC-8821",
    name: "캠핑용 접이식 멀티 폴딩박스 55L",
    cnName: "户外折叠收纳箱多功能露营箱55L",
    offerId: "882104773621",
    seller: "义乌市博野户外用品",
    sellerScore: 4.8,
    sold: 12400,
    score: 91, grade: "S", confidence: 0.89,
    factors: { cost: 88, margin: 94, competition: 82, logistics: 74, trend: 96, risk: 98, demand: 90 },
    rmb: 38.5, fx: 195.6,
    costKrw: 14100, shipKrw: 4200, feeKrw: 1420, totalCost: 19720,
    salePrice: 32900, marginKrw: 11760, marginRate: 0.357,
    compSellers: 14, compMedian: 33900, monthlySearch: 21400,
    risk: { level: "CLEAR", items: [] },
    tone: "from-emerald-900 to-emerald-700",
    note: "트렌드 지표가 최상위. 부피 대비 마진이 뛰어나고 경쟁이 아직 얕다.",
  },
  {
    id: "SRC-8847",
    name: "탁상용 저소음 무선 가습기 320ml",
    cnName: "桌面静音无线加湿器320ml充电款",
    offerId: "774210998312",
    seller: "深圳市卓远电子科技",
    sellerScore: 4.6,
    sold: 28900,
    score: 74, grade: "B", confidence: 0.71,
    factors: { cost: 76, margin: 72, competition: 48, logistics: 88, trend: 84, risk: 32, demand: 92 },
    rmb: 22.8, fx: 195.6,
    costKrw: 8350, shipKrw: 2100, feeKrw: 940, totalCost: 11390,
    salePrice: 19900, marginKrw: 6360, marginRate: 0.319,
    compSellers: 62, compMedian: 18900, monthlySearch: 44200,
    risk: {
      level: "KC",
      items: [
        { code: "KC-ELEC", label: "전기용품 안전확인 대상", detail: "USB 충전식 전기 구동 제품. KC 안전확인 미취득 시 판매 불가." },
        { code: "RF", label: "적합성평가 검토", detail: "무선 기능 탑재 여부 확인 필요." },
      ],
    },
    tone: "from-sky-900 to-sky-700",
    note: "수요는 크지만 전기용품 인증이 선행되어야 한다. 경쟁 판매자 62곳으로 밀집.",
  },
  {
    id: "SRC-8863",
    name: "스마트 고속충전 텀블러 온도표시 500ml",
    cnName: "智能温显保温杯无线快充500ml",
    offerId: "660118273400",
    seller: "广州市锐驰智能家居",
    sellerScore: 4.4,
    sold: 6800,
    score: 62, grade: "C", confidence: 0.54,
    factors: { cost: 58, margin: 64, competition: 36, logistics: 70, trend: 78, risk: 28, demand: 74 },
    rmb: 68.0, fx: 195.6,
    costKrw: 24900, shipKrw: 3800, feeKrw: 2280, totalCost: 30980,
    salePrice: 46900, marginKrw: 13230, marginRate: 0.282,
    compSellers: 88, compMedian: 44900, monthlySearch: 18700,
    risk: {
      level: "BRAND",
      items: [
        { code: "TM-LOGO", label: "상표권 주의", detail: "상세 이미지에서 유사 로고 감지 (신뢰도 0.51). 원본 셀러 상표 등록 여부 미확인." },
        { code: "KC-BATT", label: "배터리 내장", detail: "리튬 배터리 내장 추정. 국제 항공 운송 제한 및 KC 대상 가능성." },
      ],
    },
    tone: "from-zinc-800 to-zinc-600",
    note: "객단가는 높으나 상표·배터리 리스크가 겹친다. 표본 부족으로 신뢰도 0.54.",
  },
  {
    id: "SRC-8879",
    name: "LED 충전식 캠핑 랜턴 3단 밝기조절",
    cnName: "露营LED灯充电式三档调光野营灯",
    offerId: "990233187744",
    seller: "宁波市光辰照明器材",
    sellerScore: 4.9,
    sold: 41200,
    score: 84, grade: "A", confidence: 0.86,
    factors: { cost: 86, margin: 82, competition: 68, logistics: 94, trend: 88, risk: 74, demand: 86 },
    rmb: 29.6, fx: 195.6,
    costKrw: 10840, shipKrw: 1900, feeKrw: 1180, totalCost: 13920,
    salePrice: 24900, marginKrw: 8330, marginRate: 0.335,
    compSellers: 26, compMedian: 25900, monthlySearch: 16800,
    risk: { level: "CLEAR", items: [] },
    tone: "from-amber-900 to-amber-700",
    note: "셀러 평점 4.9, 누적 41,200건. 공급 안정성이 가장 확실한 후보.",
  },
  {
    id: "SRC-8890",
    name: "차량용 접이식 트렁크 정리함 방수 코팅",
    cnName: "车载后备箱折叠收纳箱防水涂层",
    offerId: "551209844120",
    seller: "台州市顺捷汽车用品",
    sellerScore: 4.7,
    sold: 9300,
    score: 79, grade: "B", confidence: 0.82,
    factors: { cost: 80, margin: 76, competition: 72, logistics: 62, trend: 74, risk: 96, demand: 78 },
    rmb: 41.2, fx: 195.6,
    costKrw: 15080, shipKrw: 5600, feeKrw: 1520, totalCost: 22200,
    salePrice: 35900, marginKrw: 11640, marginRate: 0.324,
    compSellers: 19, compMedian: 36900, monthlySearch: 11200,
    risk: { level: "CLEAR", items: [] },
    tone: "from-indigo-900 to-indigo-700",
    note: "부피가 커 물류 점수가 낮다. 배송 요율 인상 시 마진 압박 가능.",
  },
  {
    id: "SRC-8902",
    name: "실리콘 접이식 여행용 물병 550ml",
    cnName: "硅胶折叠水杯户外运动便携550ml",
    offerId: "331092776215",
    seller: "东莞市宏泰硅胶制品",
    sellerScore: 4.8,
    sold: 33700,
    score: 88, grade: "A", confidence: 0.91,
    factors: { cost: 92, margin: 90, competition: 78, logistics: 98, trend: 72, risk: 96, demand: 82 },
    rmb: 12.4, fx: 195.6,
    costKrw: 4540, shipKrw: 1100, feeKrw: 620, totalCost: 6260,
    salePrice: 12900, marginKrw: 5900, marginRate: 0.457,
    compSellers: 21, compMedian: 13900, monthlySearch: 8900,
    risk: { level: "CLEAR", items: [] },
    tone: "from-teal-900 to-teal-700",
    note: "청구중량 190g. 마진율 45.7%로 전체 최고. 객단가가 낮은 점만 감안.",
  },
];

const STUDIO_SECTIONS = [
  {
    id: "hook",
    n: 1,
    title: "메인 훅 이미지",
    desc: "첫 화면에서 구매 이유를 한 컷으로 전달",
    prompt: "Minimalist Korean e-commerce hero shot of a collapsible camping storage box on a wooden deck at golden hour, soft directional light, muted earth tones, generous empty space at top for Korean text overlay, portrait 4:5",
    overlay: { head: "펼치면 55L, 접으면 손바닥", sub: "트렁크를 되찾는 가장 쉬운 방법" },
    tone: "from-emerald-900 via-emerald-800 to-zinc-900",
    cost: 55,
  },
  {
    id: "feature",
    n: 2,
    title: "핵심 특장점 그리드",
    desc: "3분할 그리드 · 소재 / 하중 / 방수",
    prompt: "Three-panel product detail composition: anodized frame joint macro, reinforced fabric texture, water beading on coated surface. Studio lighting, dark neutral background, no text",
    overlay: { head: "600D 옥스포드 · 방수 코팅", sub: "적재 하중 30kg" },
    tone: "from-zinc-800 via-zinc-700 to-zinc-900",
    cost: 55,
  },
  {
    id: "spec",
    n: 3,
    title: "기술 스펙 및 상세 표",
    desc: "생성 배경 + 스펙 텍스트 합성",
    prompt: "Clean neutral studio backdrop with soft vertical gradient, empty center area, subtle floor shadow, no objects, no text",
    overlay: { head: "펼침 58 × 38 × 32cm", sub: "접힘 58 × 38 × 7cm · 1.9kg" },
    tone: "from-slate-800 via-slate-700 to-slate-900",
    cost: 55,
  },
  {
    id: "faq",
    n: 4,
    title: "FAQ & 구매 안내",
    desc: "해외구매대행 고지 · 교환 환불 · 고정 블록",
    prompt: null,
    overlay: { head: "자주 묻는 질문", sub: "배송 · 교환 · 환불 안내" },
    tone: "from-zinc-800 to-zinc-900",
    cost: 0,
  },
];

const NEGATIVE_PROMPT = "no text, no letters, no typography, no Korean characters, no watermark, no brand logo";

const won = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");
const pct = (n, d = 1) => (n * 100).toFixed(d) + "%";

const GRADE_STYLE = {
  S: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  A: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  B: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  C: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

const RISK_META = {
  CLEAR: { label: "CLEAR", icon: ShieldCheck, cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
  KC: { label: "KC 인증 필요", icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  BRAND: { label: "상표권 주의", icon: ShieldAlert, cls: "bg-rose-500/10 text-rose-400 ring-rose-500/20" },
};

function barColor(v) {
  if (v >= 85) return "bg-emerald-400";
  if (v >= 70) return "bg-sky-400";
  if (v >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

function Confidence({ v }) {
  const filled = Math.round(v * 5);
  const low = v < 0.65;
  return (
    <span className="inline-flex items-center gap-1.5" title={`신뢰도 ${v}`}>
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={"h-1.5 w-1.5 rounded-full " + (i < filled ? (low ? "bg-amber-400" : "bg-zinc-300") : "bg-zinc-700")} />
        ))}
      </span>
      <span className={"t11 tabular-nums " + (low ? "text-amber-400" : "text-zinc-400")}>{v.toFixed(2)}</span>
    </span>
  );
}

function RiskBadge({ level, size = "sm" }) {
  const m = RISK_META[level];
  const Icon = m.icon;
  return (
    <span className={"inline-flex items-center gap-1 rounded ring-1 font-medium " + m.cls + (size === "sm" ? " px-1.5 py-0.5 t105" : " px-2 py-1 text-xs")}>
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {m.label}
    </span>
  );
}

function ScoreMeter({ factors, expanded }) {
  return (
    <div>
      <div className="flex items-end gap-0.5" style={{ height: 26 }}>
        {FACTORS.map((f) => {
          const v = factors[f.key];
          return <div key={f.key} className="group flex-1" title={`${f.label} ${v}`}><div className="flex h-6 items-end"><div className={"w-full rounded-sm transition-all duration-500 " + barColor(v)} style={{ height: Math.max(3, (v / 100) * 24), opacity: 0.45 + (f.weight / 22) * 0.55 }} /></div></div>;
        })}
      </div>
      <div className="mt-1 flex gap-0.5">{FACTORS.map((f) => <span key={f.key} className="flex-1 text-center t9 leading-tight text-zinc-600">{f.label}</span>)}</div>
      {expanded && <div className="mt-3 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5">{FACTORS.map((f) => { const v = factors[f.key]; return <div key={f.key} className="flex items-center gap-2"><span className="w-10 shrink-0 t11 text-zinc-500">{f.label}</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800"><div className={"h-full rounded-full " + barColor(v)} style={{ width: v + "%" }} /></div><span className="w-6 text-right t11 tabular-nums text-zinc-300">{v}</span><span className="w-8 text-right t10 tabular-nums text-zinc-600">×{f.weight}</span><span className="w-8 text-right t105 tabular-nums text-zinc-400">{((v * f.weight) / 100).toFixed(1)}</span></div>; })}<div className="mt-1 flex items-center justify-between border-t border-zinc-800 pt-1.5"><span className="t11 text-zinc-500">가중 합계</span><span className="t115 font-semibold tabular-nums text-zinc-200">{FACTORS.reduce((s, f) => s + (factors[f.key] * f.weight) / 100, 0).toFixed(1)}</span></div></div>}
    </div>
  );
}

function CostTag({ amount }) {
  return <span className="ml-1 rounded bg-zinc-800 px-1 py-px t10 tabular-nums text-zinc-400">{amount}원</span>;
}

function ProductCard({ p, onOpen, onDecide, decision }) {
  const [open, setOpen] = useState(false);
  const locked = p.risk.level !== "CLEAR";
  const decided = decision === "APPROVED" || decision === "PASSED";
  return (
    <div className={"group relative flex flex-col rounded-lg border bg-zinc-900/40 transition-colors " + (decided ? "border-zinc-800/60 opacity-50" : "border-zinc-800 hover:border-zinc-700")}>
      {decided && <div className="absolute right-3 top-3 z-10"><span className={"inline-flex items-center gap-1 rounded px-2 py-1 t11 font-medium ring-1 " + (decision === "APPROVED" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-zinc-700/40 text-zinc-400 ring-zinc-600/30")}>{decision === "APPROVED" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{decision === "APPROVED" ? "승인됨" : "탈락"}</span></div>}
      <div className="flex gap-3 p-3">
        <div className={"relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br ring-1 ring-zinc-800 " + p.tone}><div className="absolute inset-0 flex items-center justify-center"><Package className="h-6 w-6 text-white/30" strokeWidth={1.5} /></div><span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 t9 tabular-nums text-white/70">{p.sold.toLocaleString()}건</span></div>
        <div className="min-w-0 flex-1"><div className="mb-1.5 flex items-center gap-1.5"><span className={"rounded px-1.5 py-0.5 t11 font-bold ring-1 " + GRADE_STYLE[p.grade]}>{p.grade}</span><span className="text-lg font-semibold leading-none tabular-nums text-zinc-100">{p.score}</span><span className="t11 text-zinc-600">점</span><span className="mx-0.5 h-3 w-px bg-zinc-800" /><Confidence v={p.confidence} /></div><h3 className="truncate t135 font-medium text-zinc-100">{p.name}</h3><p className="mt-0.5 truncate t11 text-zinc-600">{p.cnName}</p><div className="mt-1.5 flex items-center gap-2"><a className="inline-flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 t105 text-zinc-400" href="#" onClick={(e) => e.preventDefault()}><ExternalLink className="h-2.5 w-2.5" />1688 원본</a><button className="inline-flex items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 t105 text-zinc-400"><ImageIcon className="h-2.5 w-2.5" />네이버 이미지 검색</button></div></div>
      </div>
      <button onClick={() => setOpen((v) => !v)} className="mx-3 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2.5 pb-1.5 pt-2 text-left"><div className="mb-1 flex items-center justify-between"><span className="t10 font-medium uppercase tracking-wider text-zinc-600">7요소 기여도</span><span className="inline-flex items-center gap-0.5 t10 text-zinc-500">{open ? "접기" : "세부 수치"}<ChevronDown className={"h-3 w-3 transition-transform " + (open ? "rotate-180" : "")} /></span></div><ScoreMeter factors={p.factors} expanded={open} /></button>
      <div className="mx-3 mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md bg-zinc-800"><div className="bg-zinc-950/60 px-2.5 py-2"><div className="t95 uppercase tracking-wider text-zinc-600">소싱원가</div><div className="mt-0.5 t13 font-medium tabular-nums text-zinc-200">{won(p.totalCost)}</div><div className="t10 tabular-nums text-zinc-600">¥{p.rmb.toFixed(1)} + 배송</div></div><div className="bg-zinc-950/60 px-2.5 py-2"><div className="t95 uppercase tracking-wider text-zinc-600">예상 판매가</div><div className="mt-0.5 t13 font-medium tabular-nums text-zinc-200">{won(p.salePrice)}</div><div className="t10 tabular-nums text-zinc-600">경쟁 {won(p.compMedian)}</div></div><div className="bg-zinc-950/60 px-2.5 py-2"><div className="t95 uppercase tracking-wider text-zinc-600">예상 마진</div><div className="mt-0.5 t13 font-medium tabular-nums text-emerald-400">{won(p.marginKrw)}</div><div className="t10 tabular-nums text-emerald-500/70">{pct(p.marginRate)}</div></div></div>
      <div className="mx-3 mt-2.5 flex flex-wrap items-center gap-1.5"><RiskBadge level={p.risk.level} /><span className="rounded bg-zinc-800/60 px-1.5 py-0.5 t105 text-zinc-400">판매자 {p.compSellers}</span><span className="rounded bg-zinc-800/60 px-1.5 py-0.5 t105 tabular-nums text-zinc-400">검색 {(p.monthlySearch / 1000).toFixed(1)}k</span><span className="rounded bg-zinc-800/60 px-1.5 py-0.5 t105 text-zinc-400">셀러 {p.sellerScore}</span></div>
      <p className="mx-3 mt-2 flex gap-1.5 t115 leading-relaxed text-zinc-500"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />{p.note}</p>
      {locked && <div className="mx-3 mt-2.5 rounded-md border border-amber-900/40 bg-amber-950/20 px-2.5 py-2">{p.risk.items.map((it) => <div key={it.code} className="flex gap-1.5 t11 leading-snug text-amber-400/90"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /><span><span className="font-medium">{it.label}</span><span className="text-amber-500/60"> — {it.detail}</span></span></div>)}</div>}
      <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-800 p-2.5"><button onClick={() => onDecide(p.id, "PASSED")} disabled={decided} className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-800 px-2.5 text-xs text-zinc-400"><X className="h-3.5 w-3.5" />패스</button><div className="group/lock relative flex-1"><button onClick={() => !locked && onDecide(p.id, "APPROVED")} disabled={locked || decided} className={"inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium " + (locked ? "cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-600" : "bg-zinc-100 text-zinc-900")}>{locked ? <Lock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}퀵 승인</button></div><button onClick={() => onOpen(p.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-800 px-2.5 text-xs text-zinc-300">스튜디오<ArrowRight className="h-3.5 w-3.5" /></button></div>
    </div>
  );
}

function ReviewTab({ decisions, onDecide, onOpen }) {
  const [grades, setGrades] = useState(["S", "A", "B", "C"]);
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sort, setSort] = useState("score");
  const [q, setQ] = useState("");
  const [collectorUrl, setCollectorUrl] = useState("");
  const [collectorState, setCollectorState] = useState({ status: "IDLE", result: null, error: "" });

  const runCollector = async () => {
    setCollectorState({ status: "LOADING", result: null, error: "" });
    try {
      const result = await collect1688Product(collectorUrl);
      setCollectorState({ status: "SUCCESS", result, error: "" });
    } catch (error) {
      setCollectorState({ status: "ERROR", result: null, error: error.message || "상품 수집에 실패했습니다." });
    }
  };

  const toggleGrade = (g) => setGrades((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  const list = useMemo(() => {
    let r = PRODUCTS.filter((p) => grades.includes(p.grade));
    if (riskFilter === "CLEAR") r = r.filter((p) => p.risk.level === "CLEAR");
    if (riskFilter === "WARN") r = r.filter((p) => p.risk.level === "KC");
    if (riskFilter === "DANGER") r = r.filter((p) => p.risk.level === "BRAND");
    if (q.trim()) r = r.filter((p) => (p.name + p.cnName + p.id).toLowerCase().includes(q.toLowerCase()));
    const cmp = { score: (a, b) => b.score - a.score, margin: (a, b) => b.marginRate - a.marginRate, profit: (a, b) => b.marginKrw - a.marginKrw }[sort];
    return [...r].sort(cmp);
  }, [grades, riskFilter, sort, q]);

  const approved = Object.values(decisions).filter((d) => d === "APPROVED").length;
  const passed = Object.values(decisions).filter((d) => d === "PASSED").length;
  const pending = 50 - approved - passed;
  const SUMMARY = [
    { label: "오늘 추천", value: 50, sub: "발굴 잡 #331", tone: "text-zinc-100" },
    { label: "검토 대기", value: pending, sub: "처리 필요", tone: "text-amber-400" },
    { label: "승인 완료", value: approved, sub: "등록 대기로", tone: "text-emerald-400" },
    { label: "탈락", value: passed, sub: "사유 누적 중", tone: "text-zinc-500" },
  ];

  const collected = collectorState.result?.product;
  const remote = collectorState.result?.mode === "REMOTE_COLLECTOR";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-900/50 bg-sky-950/10 p-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 ring-1 ring-sky-500/20"><Link2 className="h-3.5 w-3.5 text-sky-400" /></div>
          <div><div className="t12 font-semibold text-zinc-100">1688 단일 상품 수집 테스트</div><div className="t10 text-zinc-600">실제 URL → offerId → Collector Adapter → 표준 데이터</div></div>
          <span className="ml-auto rounded bg-zinc-900 px-2 py-1 t10 text-zinc-500 ring-1 ring-zinc-800">TEST MODE</span>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <input value={collectorUrl} onChange={(e) => setCollectorUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runCollector(); }} placeholder="https://detail.1688.com/offer/123456789.html" className="h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-sky-700" />
          <button onClick={runCollector} disabled={collectorState.status === "LOADING"} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-900 disabled:opacity-60">{collectorState.status === "LOADING" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}상품 가져오기</button>
        </div>
        <p className="mt-1.5 t10 text-zinc-600">첫 단계에서는 URL/offerId 파싱이 실제 동작합니다. 상품명·가격·옵션·이미지는 수집 API 연결 시 자동 활성화됩니다.</p>

        {collectorState.status === "ERROR" && <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-900/40 bg-rose-950/20 p-2.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /><div><div className="t11 font-medium text-rose-300">수집 실패</div><div className="mt-0.5 t105 text-rose-400/80">{collectorState.error}</div></div></div>}

        {collectorState.status === "SUCCESS" && collected && <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 xl:col-span-5">
            <div className="mb-2 flex items-center gap-2"><span className={"rounded px-1.5 py-0.5 t10 font-semibold ring-1 " + (remote ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-amber-500/10 text-amber-400 ring-amber-500/20")}>{remote ? "REMOTE COLLECTOR" : "URL ONLY"}</span><span className="t10 text-zinc-600">{collectorState.result.message}</span></div>
            <div className="space-y-1.5">{[["SOURCE", collected.source], ["OFFER ID", collected.offerId], ["TITLE", collected.title || "미수집"], ["PRICE", collected.priceMinCny != null ? `¥${collected.priceMinCny}${collected.priceMaxCny != null && collected.priceMaxCny !== collected.priceMinCny ? ` ~ ¥${collected.priceMaxCny}` : ""}` : "미수집"], ["MOQ", collected.minOrderQty ?? "미수집"], ["IMAGES", collected.images?.length ?? 0], ["VARIANTS", collected.variants?.length ?? 0]].map(([k, v]) => <div key={k} className="flex items-start justify-between gap-4 border-b border-zinc-900 py-1 last:border-0"><span className="t10 font-medium tracking-wider text-zinc-600">{k}</span><span className="max-w-[70%] break-all text-right t11 tabular-nums text-zinc-300">{String(v)}</span></div>)}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 xl:col-span-7">
            <div className="mb-2 flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-zinc-500" /><span className="t11 font-medium text-zinc-300">Collector 상태</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{["title", "price", "images", "moq", "variants", "supplier"].map((field) => { const missing = collectorState.result.missing?.includes(field); return <div key={field} className={"rounded-md border px-2.5 py-2 " + (missing ? "border-amber-900/40 bg-amber-950/10" : "border-emerald-900/40 bg-emerald-950/10")}><div className="flex items-center gap-1.5">{missing ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : <Check className="h-3 w-3 text-emerald-400" />}<span className="t105 uppercase text-zinc-400">{field}</span></div><div className={"mt-1 t10 " + (missing ? "text-amber-500/70" : "text-emerald-500/70")}>{missing ? "API 연결 필요" : "수집됨"}</div></div>; })}</div>
            <div className="mt-2.5 rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5"><div className="t10 font-medium uppercase tracking-wider text-zinc-600">Canonical URL</div><a href={collected.canonicalUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all t11 text-sky-400 hover:text-sky-300">{collected.canonicalUrl}</a></div>
          </div>
        </div>}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-zinc-800 md:grid-cols-4">{SUMMARY.map((s) => <div key={s.label} className="bg-zinc-900/60 px-4 py-3"><div className="t10 font-medium uppercase tracking-wider text-zinc-600">{s.label}</div><div className={"mt-1 text-2xl font-semibold tabular-nums leading-none " + s.tone}>{s.value}</div><div className="mt-1 t11 text-zinc-600">{s.sub}</div></div>)}</div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"><div className="relative minw48 flex-1"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-600" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 · 소싱 ID 검색" className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-2 text-xs text-zinc-200 outline-none" /></div><div className="flex items-center gap-1.5"><span className="t11 text-zinc-600">등급</span>{["S", "A", "B", "C"].map((g) => <button key={g} onClick={() => toggleGrade(g)} className={"h-7 w-7 rounded-md t11 font-bold ring-1 " + (grades.includes(g) ? GRADE_STYLE[g] : "bg-transparent text-zinc-600 ring-zinc-800")}>{g}</button>)}</div><div className="flex items-center gap-1"><span className="mr-1 t11 text-zinc-600">리스크</span>{[["ALL", "전체"], ["CLEAR", "CLEAR"], ["WARN", "경고"], ["DANGER", "위험"]].map(([k, label]) => <button key={k} onClick={() => setRiskFilter(k)} className={"h-7 rounded-md px-2 t11 " + (riskFilter === k ? "bg-zinc-800 text-zinc-100" : "text-zinc-500")}>{label}</button>)}</div><select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300"><option value="score">점수순</option><option value="margin">마진율순</option><option value="profit">마진액순</option></select><span className="ml-auto t11 tabular-nums text-zinc-600">{list.length}건 표시</span></div>
      {list.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30 py-16"><Search className="mb-3 h-5 w-5 text-zinc-700" /><p className="text-sm text-zinc-400">조건에 맞는 상품이 없습니다</p></div> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">{list.map((p) => <ProductCard key={p.id} p={p} decision={decisions[p.id]} onDecide={onDecide} onOpen={onOpen} />)}</div>}
    </div>
  );
}

function NumField({ label, value, onChange, unit, hint, warn }) {
  return <div><div className="mb-1 flex items-center justify-between"><label className="t11 text-zinc-400">{label}</label>{warn && <span className="inline-flex items-center gap-0.5 t10 text-amber-400"><AlertTriangle className="h-2.5 w-2.5" />{warn}</span>}</div><div className="flex items-center gap-1.5"><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs tabular-nums text-zinc-200" /><span className="w-8 shrink-0 t11 text-zinc-600">{unit}</span></div>{hint && <p className="mt-1 t10 text-zinc-600">{hint}</p>}</div>;
}

function StudioTab({ productId, onBack }) {
  const p = PRODUCTS.find((x) => x.id === productId) || PRODUCTS[0];
  const [w, setW] = useState(1900);
  const [dim, setDim] = useState({ x: 580, y: 380, z: 70 });
  const [sections, setSections] = useState(STUDIO_SECTIONS.reduce((a, s) => ({ ...a, [s.id]: { approved: false, variant: 0 } }), {}));
  const [sel, setSel] = useState("hook");
  const [log, setLog] = useState([]);
  const volumetric = Math.round((dim.x * dim.y * dim.z) / 6000);
  const billable = Math.max(w, volumetric);
  const shipCost = Math.round(1900 + (billable / 1000) * 3100);
  const section = STUDIO_SECTIONS.find((s) => s.id === sel);
  const generatable = STUDIO_SECTIONS.filter((s) => s.prompt);
  const approvedCount = generatable.filter((s) => sections[s.id].approved).length;
  const allApproved = approvedCount === generatable.length;
  const totalCost = generatable.reduce((s, x) => s + x.cost, 0);
  const push = (msg) => setLog((l) => [{ t: Date.now(), msg }, ...l].slice(0, 4));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3"><button onClick={onBack} className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-800 px-2.5 text-xs text-zinc-400"><ChevronRight className="h-3.5 w-3.5 rotate-180" />심사로</button><div className="min-w-0"><div className="flex items-center gap-2"><span className={"rounded px-1.5 py-0.5 t11 font-bold ring-1 " + GRADE_STYLE[p.grade]}>{p.grade}</span><span className="text-sm font-medium text-zinc-100">{p.name}</span><RiskBadge level={p.risk.level} /></div><div className="mt-0.5 t11 tabular-nums text-zinc-600">{p.id} · offer {p.offerId} · {p.seller}</div></div></div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12"><div className="space-y-3 xl:col-span-4"><div className="rounded-lg border border-zinc-800 bg-zinc-900/40"><div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5"><Ruler className="h-3.5 w-3.5 text-zinc-500" /><span className="text-xs font-medium text-zinc-200">원본 규격 보정</span><span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 t10 text-amber-400 ring-1 ring-amber-500/20">OCR 실패</span></div><div className="space-y-3 p-3"><p className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2 t11 leading-relaxed text-zinc-500">상세 이미지에서 규격 텍스트를 추출하지 못했습니다. 원본 페이지를 확인해 직접 입력하세요. 국제배송비는 실중량과 부피중량 중 큰 값으로 계산됩니다.</p><NumField label="실중량" value={w} onChange={setW} unit="g" warn="추정값" /><div className="grid grid-cols-3 gap-2"><NumField label="가로" value={dim.x} onChange={(v) => setDim({ ...dim, x: v })} unit="mm" /><NumField label="세로" value={dim.y} onChange={(v) => setDim({ ...dim, y: v })} unit="mm" /><NumField label="높이" value={dim.z} onChange={(v) => setDim({ ...dim, z: v })} unit="mm" /></div><div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5">{[["부피중량", volumetric.toLocaleString() + " g", "제수 6000"], ["청구중량", billable.toLocaleString() + " g", billable === volumetric ? "부피 기준" : "실중량 기준"], ["국제배송비", won(shipCost), "요율표 적용"]].map(([k, v, note], i) => <div key={k} className="flex items-center justify-between"><span className="t11 text-zinc-500">{k}</span><span className="text-right"><span className={"t12 tabular-nums " + (i === 2 ? "font-semibold text-zinc-100" : "text-zinc-300")}>{v}</span><span className="ml-1.5 t10 text-zinc-600">{note}</span></span></div>)}</div><div className="flex items-center justify-between rounded-md border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-2"><span className="t11 text-emerald-400/80">보정 후 예상 마진</span><span className="text-sm font-semibold tabular-nums text-emerald-400">{pct((p.salePrice - (p.costKrw + shipCost + p.feeKrw)) / p.salePrice)}</span></div></div></div><div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><div className="mb-2 flex items-center gap-2"><Package className="h-3.5 w-3.5 text-zinc-500" /><span className="text-xs font-medium text-zinc-200">원본 요약</span></div><div className="space-y-1.5">{[["원문 상품명", p.cnName], ["셀러", p.seller], ["셀러 평점", p.sellerScore], ["누적 판매", p.sold.toLocaleString() + "건"], ["매입 단가", "¥" + p.rmb.toFixed(1)], ["적용 환율", p.fx + " KRW/CNY"]].map(([k, v]) => <div key={k} className="flex items-start justify-between gap-3"><span className="shrink-0 t11 text-zinc-600">{k}</span><span className="truncate text-right t11 tabular-nums text-zinc-400">{v}</span></div>)}</div></div></div>
        <div className="space-y-3 xl:col-span-8"><div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1.5">{STUDIO_SECTIONS.map((s) => { const st = sections[s.id]; return <button key={s.id} onClick={() => setSel(s.id)} className={"flex flex-1 items-center gap-1.5 rounded-md px-2.5 py-2 text-left " + (sel === s.id ? "bg-zinc-800" : "")}><span className={"flex h-4 w-4 shrink-0 items-center justify-center rounded t95 font-bold " + (!s.prompt ? "bg-zinc-800 text-zinc-500" : st.approved ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>{!s.prompt ? <Lock className="h-2.5 w-2.5" /> : st.approved ? <Check className="h-2.5 w-2.5" /> : s.n}</span><span className={"truncate t115 " + (sel === s.id ? "text-zinc-100" : "text-zinc-500")}>{s.title}</span></button>; })}</div><div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"><div className="t17 font-bold text-white">{section.overlay.head}</div><div className="mt-1.5 t115 text-zinc-500">{section.overlay.sub}</div><textarea defaultValue={section.prompt || "고정 블록"} rows={6} className="mt-4 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono t11 text-zinc-400" /><div className="mt-3 flex gap-2"><button onClick={() => { setSections((s) => ({ ...s, [section.id]: { ...s[section.id], variant: s[section.id].variant + 1, approved: false } })); push(`${section.title} 재생성`); }} className="h-8 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300">재생성<CostTag amount={7} /></button><button onClick={() => setSections((s) => ({ ...s, [section.id]: { ...s[section.id], approved: !s[section.id].approved } }))} className="ml-auto h-8 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-900">{sections[section.id].approved ? "승인 취소" : "이 섹션 승인"}</button></div></div><button disabled={!allApproved} className={"h-10 w-full rounded-md text-xs font-medium " + (allApproved ? "bg-emerald-500 text-emerald-950" : "border border-zinc-800 bg-zinc-900 text-zinc-600")}>{allApproved ? `전체 확정 및 상품 등록 (약 ${totalCost}원)` : `모든 섹션 승인 후 확정 가능 (${generatable.length - approvedCount}개 남음)`}</button></div></div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit, hint }) { return <div><div className="mb-1.5 flex items-baseline justify-between"><label className="text-xs text-zinc-300">{label}</label><span className="text-sm font-semibold tabular-nums text-zinc-100">{value}<span className="ml-0.5 t11 font-normal text-zinc-500">{unit}</span></span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-zinc-100" /><div className="mt-1 flex items-center justify-between"><span className="t10 tabular-nums text-zinc-700">{min}{unit}</span>{hint && <span className="t10 text-zinc-600">{hint}</span>}<span className="t10 tabular-nums text-zinc-700">{max}{unit}</span></div></div>; }

function SettingsTab() {
  const [minMargin, setMinMargin] = useState(25); const [fx, setFx] = useState(195.6); const [feeRate, setFeeRate] = useState(5.74); const [riskSense, setRiskSense] = useState(60);
  const sim = useMemo(() => { const POP = 50; const fxDelta = (fx - 195.6) / 195.6; const feeDelta = (feeRate - 5.74) / 100; let kept = 0; let marginSum = 0; const rows = []; for (let i = 0; i < POP; i++) { const baseMargin = 0.18 + ((i * 37) % 100) / 100 * 0.28; const adj = baseMargin - fxDelta * 0.45 - feeDelta; const riskDrop = ((i * 17) % 100) < riskSense * 0.28; const pass = adj >= minMargin / 100 && !riskDrop; if (pass) { kept++; marginSum += adj; } if (i < 6) rows.push({ i, adj, pass, riskDrop }); } const dropped = POP - kept; const avgMargin = kept ? marginSum / kept : 0; return { POP, kept, dropped, avgMargin, rows }; }, [minMargin, fx, feeRate, riskSense]);
  return <div className="grid grid-cols-1 gap-3 xl:grid-cols-12"><div className="space-y-3 xl:col-span-7"><div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"><div className="mb-4 flex items-center gap-2"><Sliders className="h-3.5 w-3.5 text-zinc-500" /><span className="text-xs font-medium text-zinc-200">글로벌 정책</span></div><div className="space-y-5"><Slider label="최소 목표 마진율" value={minMargin} onChange={setMinMargin} min={10} max={45} step={1} unit="%" hint="이 값 미만은 추천에서 제외" /><Slider label="적용 환율" value={fx} onChange={setFx} min={170} max={230} step={0.4} unit="" hint="KRW / CNY" /><Slider label="플랫폼 기본 수수료율" value={feeRate} onChange={setFeeRate} min={2} max={12} step={0.1} unit="%" hint="네이버 수수료 + 결제 수수료" /><Slider label="리스크 감도" value={riskSense} onChange={setRiskSense} min={0} max={100} step={5} unit="" hint="높을수록 보수적으로 판정" /></div></div></div><div className="xl:col-span-5"><div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"><div className="mb-3 flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-sky-400" /><span className="text-xs font-medium text-zinc-200">실시간 시뮬레이터</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded bg-zinc-950/70 p-3"><div className="t10 text-zinc-600">승인 유지</div><div className="mt-1 text-2xl font-semibold text-emerald-400">{sim.kept}</div></div><div className="rounded bg-zinc-950/70 p-3"><div className="t10 text-zinc-600">신규 탈락</div><div className="mt-1 text-2xl font-semibold text-rose-400">{sim.dropped}</div></div></div><div className="mt-3 t11 text-zinc-500">평균 예상 마진율 <span className="font-semibold text-zinc-200">{pct(sim.avgMargin)}</span></div></div></div></div>;
}

const MICRO_CSS = `
.t9{font-size:9px;line-height:1.35}.t95{font-size:9.5px;line-height:1.35}.t10{font-size:10px;line-height:1.4}.t105{font-size:10.5px;line-height:1.4}.t11{font-size:11px;line-height:1.45}.t115{font-size:11.5px;line-height:1.45}.t12{font-size:12px;line-height:1.45}.t13{font-size:13px;line-height:1.45}.t135{font-size:13.5px;line-height:1.4}.t17{font-size:17px;line-height:1.3}.ratio45{aspect-ratio:4/5}.minw48{min-width:12rem}.minw32{min-width:8rem}input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:9999px}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:9999px;background:#fafafa;border:2px solid #27272a;cursor:pointer}@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export default function App() {
  const [tab, setTab] = useState("review");
  const [studioId, setStudioId] = useState("SRC-8821");
  const [decisions, setDecisions] = useState({});
  const onDecide = (id, d) => setDecisions((s) => ({ ...s, [id]: d }));
  const openStudio = (id) => { setStudioId(id); setTab("studio"); };
  const TABS = [{ key: "review", label: "카드 심사", icon: LayoutGrid }, { key: "studio", label: "상세페이지 스튜디오", icon: FileImage }, { key: "settings", label: "설정 & 시뮬레이터", icon: Settings2 }];
  return <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased"><style>{MICRO_CSS}</style><header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur"><div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4"><div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100"><Layers className="h-3.5 w-3.5 text-zinc-900" strokeWidth={2.4} /></div><div className="leading-none"><div className="t13 font-semibold tracking-tight">Sourcing Console</div><div className="mt-0.5 t10 text-zinc-600">1688 · AI 상품 심사</div></div></div><nav className="ml-4 flex items-center gap-1">{TABS.map((t) => { const Icon = t.icon; return <button key={t.key} onClick={() => setTab(t.key)} className={"inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs " + (tab === t.key ? "bg-zinc-800 text-zinc-100" : "text-zinc-500")}><Icon className="h-3.5 w-3.5" />{t.label}</button>; })}</nav><div className="ml-auto flex items-center gap-3"><div className="hidden items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-1.5 sm:flex"><Wallet className="h-3 w-3 text-zinc-600" /><span className="t11 tabular-nums text-zinc-400">오늘 <span className="text-zinc-200">23,720</span><span className="text-zinc-600"> / 50,000원</span></span></div><div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 t10 font-semibold text-zinc-300">운</div></div></div></header><main className="mx-auto max-w-screen-2xl px-4 py-4">{tab === "review" && <ReviewTab decisions={decisions} onDecide={onDecide} onOpen={openStudio} />}{tab === "studio" && <StudioTab productId={studioId} onBack={() => setTab("review")} />}{tab === "settings" && <SettingsTab />}</main></div>;
}
