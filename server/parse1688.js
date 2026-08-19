const MAX_IMAGES = 24;
const MAX_VARIANTS = 36;
const DATA_MARKERS = ["window.__INIT_DATA__", "window.__PAGE_DATA__", "window.__GLOBAL_DATA__", "__INIT_DATA__", "__PAGE_DATA__", "__GLOBAL_DATA__"];

function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function finiteNumber(value, { positive = false } = {}) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) return null;
  return number;
}

function validHttpUrl(value) {
  if (typeof value !== "string") return null;
  const decoded = decodeHtml(value).replace(/\\u002F/g, "/").replace(/\\\//g, "/").trim();
  const candidate = decoded.startsWith("//") ? `https:${decoded}` : decoded;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function unique(values, limit) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function metaContent(html, property) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attribute(tag, "property")?.toLowerCase() === property.toLowerCase()) return attribute(tag, "content");
  }
  return null;
}

function balancedJson(text, start) {
  const opening = text[start];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : null;
  if (!closing) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function structuredDocuments(html) {
  const documents = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1];
    const text = match[2].trim();
    const type = attribute(attributes, "type")?.toLowerCase();
    const id = attribute(attributes, "id")?.toLowerCase() || "";
    if ((type === "application/ld+json" || type === "application/json" || id.includes("data")) && text) {
      const parsed = parseJson(text);
      if (parsed) documents.push({ value: parsed, source: type === "application/ld+json" ? "json-ld" : `script#${id || "json"}` });
    }
    for (const marker of DATA_MARKERS) {
      const markerIndex = text.indexOf(marker);
      if (markerIndex < 0) continue;
      const equalsIndex = text.indexOf("=", markerIndex + marker.length);
      if (equalsIndex < 0) continue;
      const objectIndex = text.slice(equalsIndex + 1).search(/[\[{]/);
      if (objectIndex < 0) continue;
      const start = equalsIndex + 1 + objectIndex;
      const json = balancedJson(text, start);
      const parsed = json ? parseJson(json) : null;
      if (parsed) documents.push({ value: parsed, source: marker.replace(/^window\./, "") });
    }
  }
  return documents;
}

function productCandidates(documents) {
  const candidates = [];
  for (const document of documents) {
    const roots = Array.isArray(document.value) ? document.value : [document.value];
    for (const root of roots) {
      if (!root || typeof root !== "object") continue;
      const graph = Array.isArray(root["@graph"]) ? root["@graph"] : [];
      for (const entry of [root, ...graph]) {
        const types = Array.isArray(entry?.["@type"]) ? entry["@type"] : [entry?.["@type"]];
        if (types.some((type) => String(type).toLowerCase() === "product")) {
          candidates.push({ product: entry, source: `${document.source}.Product`, jsonLd: true });
        }
      }
      const paths = [
        [root.product, "product"],
        [root.offer, "offer"],
        [root.data?.product, "data.product"],
        [root.data?.offer, "data.offer"],
        [root.globalData?.product, "globalData.product"],
        [root.offerDetail?.product, "offerDetail.product"],
      ];
      for (const [product, path] of paths) {
        if (product && typeof product === "object") candidates.push({ product, source: `${document.source}.${path}`, jsonLd: false });
      }
    }
  }
  return candidates;
}

function titleFrom(candidate) {
  const product = candidate.product;
  const value = candidate.jsonLd ? product.name : product.subject ?? product.offerTitle ?? product.title;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pricesFrom(candidate) {
  const product = candidate.product;
  if (candidate.jsonLd) {
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    return {
      min: finiteNumber(offers?.lowPrice ?? offers?.price),
      max: finiteNumber(offers?.highPrice ?? offers?.price),
      path: "offers",
    };
  }
  const ranges = [product.priceRange, product.priceInfo?.priceRange, product.priceModel?.priceRange];
  for (const range of ranges) {
    if (!Array.isArray(range)) continue;
    const values = range.flatMap((entry) => {
      if (entry && typeof entry === "object") return [entry.price, entry.value, entry.startPrice, entry.endPrice];
      return [entry];
    }).map((value) => finiteNumber(value)).filter((value) => value != null);
    if (values.length) return { min: Math.min(...values), max: Math.max(...values), path: "priceRange" };
  }
  const priceInfo = product.priceInfo ?? product.priceModel ?? product;
  const min = finiteNumber(priceInfo.minPrice ?? priceInfo.priceMin ?? priceInfo.price);
  const max = finiteNumber(priceInfo.maxPrice ?? priceInfo.priceMax ?? priceInfo.price);
  return { min, max: max ?? min, path: min != null ? "priceInfo" : null };
}

function imageUrlsFrom(candidate) {
  const product = candidate.product;
  const raw = candidate.jsonLd
    ? product.image
    : product.imageList ?? product.mainImages ?? product.images ?? product.offerImgList;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const images = entries.map((entry) => {
    if (typeof entry === "string") return validHttpUrl(entry);
    return validHttpUrl(entry?.url ?? entry?.originalUrl ?? entry?.imageUrl ?? entry?.fullPath);
  });
  return unique(images, MAX_IMAGES);
}

function variantsFrom(candidate) {
  if (candidate.jsonLd) return [];
  const props = candidate.product.skuModel?.skuProps;
  if (!Array.isArray(props)) return [];
  const names = [];
  for (const prop of props) {
    const group = typeof prop?.prop === "string" ? prop.prop.trim() : typeof prop?.name === "string" ? prop.name.trim() : null;
    const values = Array.isArray(prop?.value) ? prop.value : Array.isArray(prop?.values) ? prop.values : [];
    for (const value of values) {
      const name = typeof value === "string" ? value.trim() : typeof value?.name === "string" ? value.name.trim() : typeof value?.value === "string" ? value.value.trim() : null;
      if (name) names.push(group ? `${group}: ${name}` : name);
    }
  }
  return unique(names, MAX_VARIANTS).map((name, index) => ({ id: index + 1, name }));
}

function supplierFrom(candidate) {
  if (candidate.jsonLd) return null;
  const supplier = candidate.product.supplier ?? candidate.product.supplierInfo ?? candidate.product.company;
  const name = typeof supplier === "string" ? supplier : supplier?.companyName ?? supplier?.name;
  return typeof name === "string" && name.trim() ? { name: name.trim() } : null;
}

function minimumOrderFrom(candidate) {
  if (candidate.jsonLd) return finiteNumber(candidate.product.minimumOrderQuantity, { positive: true });
  return finiteNumber(candidate.product.minOrderQuantity ?? candidate.product.minOrderQty ?? candidate.product.minOrder ?? candidate.product.moq, { positive: true });
}

function assignFirst(target, provenance, field, candidates, extractor, sourcePath) {
  for (const candidate of candidates) {
    const value = extractor(candidate);
    const present = Array.isArray(value) ? value.length > 0 : value != null;
    if (!present) continue;
    target[field] = value;
    provenance[field] = `${candidate.source}.${sourcePath}`;
    return;
  }
}

export function parse1688Html(html, offerId, canonicalUrl) {
  const candidates = productCandidates(structuredDocuments(html));
  const provenance = {};
  const result = {
    source: "1688",
    offerId,
    canonicalUrl,
    title: null,
    priceMinCny: null,
    priceMaxCny: null,
    images: [],
    minOrderQty: null,
    variants: [],
    supplier: null,
    provenance,
  };

  assignFirst(result, provenance, "title", candidates, titleFrom, "title");
  if (!result.title) {
    const ogTitle = metaContent(html, "og:title");
    if (ogTitle) {
      result.title = ogTitle;
      provenance.title = "meta.og:title";
    }
  }
  if (result.title) result.title = result.title.replace(/\s*[-_]\s*阿里巴巴.*$/i, "").trim() || null;

  for (const candidate of candidates) {
    const prices = pricesFrom(candidate);
    if (prices.min == null && prices.max == null) continue;
    result.priceMinCny = prices.min;
    result.priceMaxCny = prices.max ?? prices.min;
    provenance.priceMinCny = `${candidate.source}.${prices.path}`;
    provenance.priceMaxCny = `${candidate.source}.${prices.path}`;
    break;
  }

  assignFirst(result, provenance, "images", candidates, imageUrlsFrom, "productImages");
  if (!result.images.length) {
    const ogImage = validHttpUrl(metaContent(html, "og:image"));
    if (ogImage) {
      result.images = [ogImage];
      provenance.images = "meta.og:image";
    }
  }
  assignFirst(result, provenance, "minOrderQty", candidates, minimumOrderFrom, "minimumOrder");
  assignFirst(result, provenance, "variants", candidates, variantsFrom, "skuModel.skuProps");
  assignFirst(result, provenance, "supplier", candidates, supplierFrom, "supplier");
  return result;
}
