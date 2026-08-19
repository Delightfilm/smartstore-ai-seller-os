import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ExternalLink, Loader2, Package, Plus } from "lucide-react";
import { collect1688Product } from "./collector1688.js";

function CollectorPanel() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("IDLE");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setStatus("LOADING");
    setError("");
    setResult(null);
    try {
      const next = await collect1688Product(url);
      setResult(next);
      setStatus("SUCCESS");
    } catch (e) {
      setError(e?.message || "상품 수집에 실패했습니다.");
      setStatus("ERROR");
    }
  };

  const p = result?.product;
  const collectorActive = result?.mode === "REMOTE_COLLECTOR" || result?.mode === "LOCAL_BROWSER_COLLECTOR";
  const local = result?.mode === "LOCAL_BROWSER_COLLECTOR";

  return (
    <div className="surf fade" style={{ padding: 16 }}>
      <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div className="flex items-center" style={{ gap: 7 }}>
            <Package size={14} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>1688 URL 직접 수집 테스트</div>
            <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>TEST</span>
          </div>
          <div className="t3" style={{ fontSize: 11.5, marginTop: 3 }}>
            실제 1688 상품 URL을 넣어 상품명·가격·이미지·MOQ·옵션·공급자 수집을 시험합니다.
          </div>
        </div>
        <div className="t3 mono" style={{ fontSize: 10.5 }}>URL → offerId → Collector → Normalizer</div>
      </div>

      <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          className="inp"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && status !== "LOADING" && run()}
          placeholder="https://detail.1688.com/offer/123456789.html"
          style={{ flex: "1 1 420px" }}
        />
        <button className="btn btn-md btn-primary" onClick={run} disabled={status === "LOADING"}>
          {status === "LOADING" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {status === "LOADING" ? "가져오는 중" : "상품 가져오기"}
        </button>
      </div>

      {status === "ERROR" && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: "var(--neg-soft)", color: "var(--neg)" }}>
          <div className="flex items-center" style={{ gap: 7 }}>
            <AlertTriangle size={14} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>수집 실패</span>
          </div>
          <div style={{ fontSize: 11.5, marginTop: 3 }}>{error}</div>
        </div>
      )}

      {status === "SUCCESS" && p && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <div className="surf-2" style={{ borderRadius: 6, padding: 12 }}>
            <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
              <Check size={14} style={{ color: collectorActive ? "var(--pos)" : "var(--warn)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {collectorActive ? (local ? "로컬 실수집 완료" : "API 실수집 완료") : "URL 파싱 완료"}
              </span>
            </div>
            <div className="t3" style={{ fontSize: 11.5, lineHeight: 1.55 }}>{result.message}</div>
            <a href={p.canonicalUrl} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 5, marginTop: 9, fontSize: 11.5, color: "var(--accent)", textDecoration: "none" }}>
              <ExternalLink size={12} /> 1688 원본 열기
            </a>
          </div>

          <div className="surf-2" style={{ borderRadius: 6, padding: 12 }}>
            {[
              ["SOURCE", p.source],
              ["OFFER ID", p.offerId],
              ["상품명", p.title || "미수집"],
              ["가격", p.priceMinCny == null ? "미수집" : `¥${p.priceMinCny}${p.priceMaxCny != null && p.priceMaxCny !== p.priceMinCny ? ` ~ ¥${p.priceMaxCny}` : ""}`],
              ["MOQ", p.minOrderQty ?? "미수집"],
              ["이미지", `${p.images?.length || 0}개`],
              ["옵션", `${p.variants?.length || 0}개`],
              ["공급자", p.supplier?.name || p.supplier || "미수집"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between" style={{ gap: 12, fontSize: 11.5, padding: "3px 0" }}>
                <span className="t3">{k}</span>
                <span className="num" style={{ textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "68%" }}>{String(v)}</span>
              </div>
            ))}
          </div>

          <div className="surf-2" style={{ borderRadius: 6, padding: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>수집 상태</div>
            {["title", "price", "images", "moq", "variants", "supplier"].map((field) => {
              const missing = result.missing?.includes(field);
              return (
                <div key={field} className="flex items-center justify-between" style={{ gap: 10, padding: "3px 0", fontSize: 11.5 }}>
                  <span>{field}</span>
                  <span style={{ color: missing ? "var(--warn)" : "var(--pos)" }}>{missing ? "미수집" : "수집됨"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiscoveryCollectorBridge() {
  const [mount, setMount] = useState(null);

  useEffect(() => {
    const sync = () => {
      const heading = [...document.querySelectorAll("h1")].find((node) => node.textContent?.trim() === "발굴");
      if (!heading) {
        setMount((current) => {
          if (current?.isConnected) current.remove();
          return null;
        });
        return;
      }

      const header = heading.parentElement?.parentElement;
      const page = header?.parentElement;
      if (!header || !page) return;

      let node = page.querySelector(":scope > [data-1688-collector-bridge]");
      if (!node) {
        node = document.createElement("div");
        node.dataset["1688CollectorBridge"] = "1";
        header.insertAdjacentElement("afterend", node);
      }
      setMount(node);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      const node = document.querySelector("[data-1688-collector-bridge]");
      if (node) node.remove();
    };
  }, []);

  return mount ? createPortal(<CollectorPanel />, mount) : null;
}
