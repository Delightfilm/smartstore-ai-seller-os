export function parse1688OfferUrl(input) {
  const raw = (input || "").trim();
  if (!raw) throw new Error("1688 상품 URL을 입력하세요.");

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("올바른 URL 형식이 아닙니다.");
  }

  const host = url.hostname.toLowerCase();
  if (!(host === "1688.com" || host.endsWith(".1688.com"))) {
    throw new Error("1688.com 상품 URL만 테스트할 수 있습니다.");
  }

  const match = url.pathname.match(/\/offer\/(\d+)\.html/i) || raw.match(/offer[\/=](\d+)/i);
  const offerId = match?.[1] || null;
  if (!offerId) {
    throw new Error("URL에서 1688 offerId를 찾지 못했습니다. detail.1688.com/offer/숫자.html 형식을 사용하세요.");
  }

  return {
    source: "1688",
    offerId,
    canonicalUrl: `https://detail.1688.com/offer/${offerId}.html`,
    originalUrl: raw,
  };
}

function buildMissing(product) {
  const missing = [];
  if (!product.title) missing.push("title");
  if (product.priceMinCny == null) missing.push("price");
  if (!product.images?.length) missing.push("images");
  if (product.minOrderQty == null) missing.push("moq");
  if (!product.variants?.length) missing.push("variants");
  if (!product.supplier) missing.push("supplier");
  return missing;
}

export async function collect1688Product(input) {
  const parsed = parse1688OfferUrl(input);
  const configuredEndpoint = import.meta.env.VITE_1688_COLLECTOR_URL;
  const endpoint = configuredEndpoint || "/api/collect-1688";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: parsed.canonicalUrl, offerId: parsed.offerId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || `1688 수집 오류 (HTTP ${response.status})`;
    throw new Error(message);
  }

  const product = {
    ...parsed,
    title: data.title ?? data.subject ?? null,
    priceMinCny: data.priceMinCny ?? data.price?.min ?? null,
    priceMaxCny: data.priceMaxCny ?? data.price?.max ?? null,
    images: Array.isArray(data.images) ? data.images : [],
    minOrderQty: data.minOrderQty ?? data.moq ?? null,
    variants: Array.isArray(data.variants) ? data.variants : Array.isArray(data.skus) ? data.skus : [],
    supplier: data.supplier ?? null,
  };

  const missing = buildMissing(product);
  const local = !configuredEndpoint;
  return {
    ok: true,
    mode: local ? "LOCAL_BROWSER_COLLECTOR" : "REMOTE_COLLECTOR",
    collectedAt: new Date().toISOString(),
    product,
    raw: data,
    missing,
    message: missing.length === 0
      ? `1688 ${local ? "로그인 브라우저" : "외부 API"} Collector에서 주요 필드를 모두 수집했습니다.`
      : `1688 ${local ? "로그인 브라우저" : "외부 API"} Collector가 ${6 - missing.length}/6개 핵심 필드를 수집했습니다. 누락: ${missing.join(", ")}`,
  };
}
