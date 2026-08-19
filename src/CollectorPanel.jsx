import React, { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Package, Plus } from "lucide-react";
import { collect1688Product, getCollectorAvailability } from "./collector1688.js";

export default function CollectorPanel() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("IDLE");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const availability = getCollectorAvailability();

  const run = async () => {
    setStatus("LOADING");
    setError("");
    setResult(null);
    try {
      const next = await collect1688Product(url);
      setResult(next);
      setStatus("SUCCESS");
    } catch (nextError) {
      setError(nextError?.message || "상품 수집에 실패했습니다.");
      setStatus("ERROR");
    }
  };

  const product = result?.product;
  const collectorActive = result?.mode === "REMOTE_COLLECTOR" || result?.mode === "LOCAL_BROWSER_COLLECTOR";
  const local = result?.mode === "LOCAL_BROWSER_COLLECTOR";

  return (
    <div className="surf fade" data-testid="discovery-collector-panel" style={{ padding: 16 }}>
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
        <div style={{ textAlign: "right" }}>
          <div className="chip" data-collector-mode={availability.mode} style={{
            display: "inline-flex",
            background: availability.available ? "var(--pos-soft)" : "var(--warn-soft)",
            color: availability.available ? "var(--pos)" : "var(--warn)",
          }}>
            {availability.label}
          </div>
          <div className="t3" style={{ fontSize: 10.5, marginTop: 4 }}>{availability.description}</div>
        </div>
      </div>

      <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          className="inp"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && status !== "LOADING" && availability.available && run()}
          placeholder="https://detail.1688.com/offer/123456789.html"
          disabled={!availability.available}
          style={{ flex: "1 1 420px" }}
        />
        <button className="btn btn-md btn-primary" onClick={run} disabled={status === "LOADING" || !availability.available}>
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

      {status === "SUCCESS" && product && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <div className="surf-2" style={{ borderRadius: 6, padding: 12 }}>
            <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
              <Check size={14} style={{ color: collectorActive ? "var(--pos)" : "var(--warn)" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {collectorActive ? (local ? "로컬 실수집 완료" : "API 실수집 완료") : "URL 파싱 완료"}
              </span>
            </div>
            <div className="t3" style={{ fontSize: 11.5, lineHeight: 1.55 }}>{result.message}</div>
            <a href={product.canonicalUrl} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 5, marginTop: 9, fontSize: 11.5, color: "var(--accent)", textDecoration: "none" }}>
              <ExternalLink size={12} /> 1688 원본 열기
            </a>
          </div>

          <div className="surf-2" style={{ borderRadius: 6, padding: 12 }}>
            {[
              ["SOURCE", product.source],
              ["OFFER ID", product.offerId],
              ["상품명", product.title || "미수집"],
              ["가격", product.priceMinCny == null ? "미수집" : `¥${product.priceMinCny}${product.priceMaxCny != null && product.priceMaxCny !== product.priceMinCny ? ` ~ ¥${product.priceMaxCny}` : ""}`],
              ["MOQ", product.minOrderQty ?? "미수집"],
              ["이미지", `${product.images?.length || 0}개`],
              ["옵션", `${product.variants?.length || 0}개`],
              ["공급자", product.supplier?.name || product.supplier || "미수집"],
            ].map(([key, value]) => (
              <div key={key} className="flex items-center justify-between" style={{ gap: 12, fontSize: 11.5, padding: "3px 0" }}>
                <span className="t3">{key}</span>
                <span className="num" style={{ textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "68%" }}>{String(value)}</span>
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
