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

export function getCollectorAvailability(env = import.meta.env) {
  const endpoint = env?.VITE_1688_COLLECTOR_URL?.trim();
  if (endpoint) {
    return {
      available: true,
      mode: "REMOTE_COLLECTOR",
      endpoint,
      label: "원격 Collector",
      description: "설정된 운영용 Collector API를 사용합니다.",
    };
  }
  if (env?.DEV) {
    return {
      available: true,
      mode: "LOCAL_BROWSER_COLLECTOR",
      endpoint: "/api/collect-1688",
      label: "로컬 브라우저",
      description: "개발 모드 · 로그인된 1688 전용 브라우저가 필요합니다.",
    };
  }
  return {
    available: false,
    mode: "HOSTED_UNAVAILABLE",
    endpoint: null,
    label: "호스팅 미지원",
    description: "운영용 Collector URL이 설정되지 않았습니다.",
  };
}

export const DEFAULT_COLLECTOR_TIMEOUT_MS = 45_000;
const MAX_IMAGES = 24;
const MAX_VARIANTS = 36;

function finiteNumber(value, { positive = false } = {}) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) return null;
  return number;
}

function httpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeImages(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(httpUrl).filter(Boolean))].slice(0, MAX_IMAGES);
}

function normalizeVariants(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of value) {
    const name = typeof entry === "string" ? entry.trim() : typeof entry?.name === "string" ? entry.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push({ id: result.length + 1, name });
    if (result.length >= MAX_VARIANTS) break;
  }
  return result;
}

function normalizeSupplier(value) {
  const name = typeof value === "string" ? value.trim() : typeof value?.name === "string" ? value.name.trim() : "";
  return name ? { name: name.slice(0, 300) } : null;
}

function normalizeProvenance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields = new Set(["title", "priceMinCny", "priceMaxCny", "images", "minOrderQty", "variants", "supplier"]);
  return Object.fromEntries(Object.entries(value)
    .filter(([field, source]) => fields.has(field) && typeof source === "string" && source.trim())
    .map(([field, source]) => [field, source.trim().slice(0, 200)]));
}

export function normalizeCollectorPayload(data, parsed) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const error = new Error("1688 Collector 응답 형식이 올바르지 않습니다.");
    error.code = "INVALID_COLLECTOR_PAYLOAD";
    throw error;
  }
  if (data.offerId != null && String(data.offerId) !== parsed.offerId) {
    const error = new Error("1688 Collector 응답의 offerId가 요청과 일치하지 않습니다.");
    error.code = "INVALID_COLLECTOR_PAYLOAD";
    throw error;
  }

  const titleValue = data.title ?? data.subject;
  return {
    ...parsed,
    title: typeof titleValue === "string" && titleValue.trim() ? titleValue.trim().slice(0, 1000) : null,
    priceMinCny: finiteNumber(data.priceMinCny ?? data.price?.min),
    priceMaxCny: finiteNumber(data.priceMaxCny ?? data.price?.max),
    images: normalizeImages(data.images),
    minOrderQty: finiteNumber(data.minOrderQty ?? data.moq, { positive: true }),
    variants: normalizeVariants(data.variants ?? data.skus),
    supplier: normalizeSupplier(data.supplier),
    provenance: normalizeProvenance(data.provenance),
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

export async function collect1688Product(input, options = {}) {
  const parsed = parse1688OfferUrl(input);
  const availability = getCollectorAvailability(options.env ?? import.meta.env);

  if (!availability.available) {
    throw new Error("호스팅 환경에서는 1688 수집기를 사용할 수 없습니다. 운영용 VITE_1688_COLLECTOR_URL을 설정하세요.");
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_COLLECTOR_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let data;
  try {
    response = await (options.fetchImpl ?? fetch)(availability.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: parsed.canonicalUrl, offerId: parsed.offerId }),
      signal: controller.signal,
    });
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok) {
        const payloadError = new Error("1688 Collector가 올바른 JSON 응답을 반환하지 않았습니다.");
        payloadError.code = "INVALID_COLLECTOR_PAYLOAD";
        throw payloadError;
      }
      data = {};
    }
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      const timeoutError = new Error(`1688 수집 요청이 ${Math.ceil(timeoutMs / 1000)}초 안에 완료되지 않았습니다. 브라우저 상태를 확인하고 다시 시도하세요.`);
      timeoutError.code = "COLLECT_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = data?.message || `1688 수집 오류 (HTTP ${response.status})`;
    throw new Error(message);
  }

  const product = normalizeCollectorPayload(data, parsed);

  const missing = buildMissing(product);
  const local = availability.mode === "LOCAL_BROWSER_COLLECTOR";
  return {
    ok: true,
    mode: availability.mode,
    collectedAt: new Date().toISOString(),
    product,
    raw: data,
    missing,
    message: missing.length === 0
      ? `1688 ${local ? "로그인 브라우저" : "외부 API"} Collector에서 주요 필드를 모두 수집했습니다.`
      : `1688 ${local ? "로그인 브라우저" : "외부 API"} Collector가 ${6 - missing.length}/6개 핵심 필드를 수집했습니다. 누락: ${missing.join(", ")}`,
  };
}
