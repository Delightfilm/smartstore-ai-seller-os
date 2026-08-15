import React, { useState } from "react";
import { AlertTriangle, Check, Gauge, Link2, Loader2, Package } from "lucide-react";
import { collect1688Product } from "./collector1688.js";

export default function CollectorTestPanel() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState({ status: "IDLE", result: null, error: "" });

  const run = async () => {
    setState({ status: "LOADING", result: null, error: "" });
    try {
      const result = await collect1688Product(url);
      setState({ status: "SUCCESS", result, error: "" });
    } catch (error) {
      setState({ status: "ERROR", result: null, error: error?.message || "상품 수집에 실패했습니다." });
    }
  };

  const collected = state.result?.product;
  const remote = state.result?.mode === "REMOTE_COLLECTOR";

  return (
    <div className="rounded-lg border border-sky-900/50 bg-sky-950/10 p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 ring-1 ring-sky-500/20">
          <Link2 className="h-3.5 w-3.5 text-sky-400" />
        </div>
        <div>
          <div className="t12 font-semibold text-zinc-100">1688 단일 상품 수집 테스트</div>
          <div className="t10 text-zinc-600">실제 URL → offerId → Collector Adapter → 표준 데이터</div>
        </div>
        <span className="ml-auto rounded bg-zinc-900 px-2 py-1 t10 text-zinc-500 ring-1 ring-zinc-800">TEST MODE</span>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="https://detail.1688.com/offer/123456789.html"
          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-sky-700"
        />
        <button
          onClick={run}
          disabled={state.status === "LOADING"}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-60"
        >
          {state.status === "LOADING" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
          상품 가져오기
        </button>
      </div>

      <p className="mt-1.5 t10 text-zinc-600">현재는 URL과 offerId 파싱부터 검증합니다. 수집 API 연결 후 상품명·가격·옵션·이미지가 자동 활성화됩니다.</p>

      {state.status === "ERROR" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-900/40 bg-rose-950/20 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <div><div className="t11 font-medium text-rose-300">수집 실패</div><div className="mt-0.5 t105 text-rose-400/80">{state.error}</div></div>
        </div>
      )}

      {state.status === "SUCCESS" && collected && (
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 xl:col-span-5">
            <div className="mb-2 flex items-start gap-2">
              <span className={"shrink-0 rounded px-1.5 py-0.5 t10 font-semibold ring-1 " + (remote ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-amber-500/10 text-amber-400 ring-amber-500/20")}>{remote ? "REMOTE COLLECTOR" : "URL ONLY"}</span>
              <span className="t10 leading-relaxed text-zinc-600">{state.result.message}</span>
            </div>
            <div className="space-y-1.5">
              {[["SOURCE", collected.source], ["OFFER ID", collected.offerId], ["TITLE", collected.title || "미수집"], ["PRICE", collected.priceMinCny != null ? `¥${collected.priceMinCny}${collected.priceMaxCny != null && collected.priceMaxCny !== collected.priceMinCny ? ` ~ ¥${collected.priceMaxCny}` : ""}` : "미수집"], ["MOQ", collected.minOrderQty ?? "미수집"], ["IMAGES", collected.images?.length ?? 0], ["VARIANTS", collected.variants?.length ?? 0]].map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4 border-b border-zinc-900 py-1 last:border-0"><span className="t10 font-medium tracking-wider text-zinc-600">{key}</span><span className="max-w-[70%] break-all text-right t11 tabular-nums text-zinc-300">{String(value)}</span></div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 xl:col-span-7">
            <div className="mb-2 flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-zinc-500" /><span className="t11 font-medium text-zinc-300">Collector 상태</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {["title", "price", "images", "moq", "variants", "supplier"].map((field) => {
                const missing = state.result.missing?.includes(field);
                return <div key={field} className={"rounded-md border px-2.5 py-2 " + (missing ? "border-amber-900/40 bg-amber-950/10" : "border-emerald-900/40 bg-emerald-950/10")}><div className="flex items-center gap-1.5">{missing ? <AlertTriangle className="h-3 w-3 text-amber-400" /> : <Check className="h-3 w-3 text-emerald-400" />}<span className="t105 uppercase text-zinc-400">{field}</span></div><div className={"mt-1 t10 " + (missing ? "text-amber-500/70" : "text-emerald-500/70")}>{missing ? "API 연결 필요" : "수집됨"}</div></div>;
              })}
            </div>
            <div className="mt-2.5 rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5"><div className="t10 font-medium uppercase tracking-wider text-zinc-600">Canonical URL</div><a href={collected.canonicalUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all t11 text-sky-400 hover:text-sky-300">{collected.canonicalUrl}</a></div>
          </div>
        </div>
      )}
    </div>
  );
}
