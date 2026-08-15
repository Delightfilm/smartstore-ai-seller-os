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

export async function collect1688Product(input) {
  const parsed = parse1688OfferUrl(input);
  const endpoint = import.meta.env.VITE_1688_COLLECTOR_URL;

  if (!endpoint) {
    return {
      ok: true,
      mode: "URL_ONLY",
      collectedAt: new Date().toISOString(),
      product: {
        ...parsed,
        title: null,
        priceMinCny: null,
        priceMaxCny: null,
        images: [],
        minOrderQty: null,
        variants: [],
        supplier: null,
      },
      missing: ["title", "price", "images", "moq", "variants", "supplier"],
      message: "1688 URL과 offerId 추출에 성공했습니다. 실제 상품 상세 수집은 VITE_1688_COLLECTOR_URL 연결 후 활성화됩니다.",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: parsed.canonicalUrl, offerId: parsed.offerId }),
  });

  if (!response.ok) {
    throw new Error(`1688 수집 API 오류 (HTTP ${response.status})`);
  }

  const data = await response.json();
  return {
    ok: true,
    mode: "REMOTE_COLLECTOR",
    collectedAt: new Date().toISOString(),
    product: {
      ...parsed,
      title: data.title ?? data.subject ?? null,
      priceMinCny: data.priceMinCny ?? data.price?.min ?? null,
      priceMaxCny: data.priceMaxCny ?? data.price?.max ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      minOrderQty: data.minOrderQty ?? data.moq ?? null,
      variants: Array.isArray(data.variants) ? data.variants : Array.isArray(data.skus) ? data.skus : [],
      supplier: data.supplier ?? null,
    },
    raw: data,
    missing: [],
    message: "1688 수집 API에서 상품 상세 데이터를 가져왔습니다.",
  };
}
