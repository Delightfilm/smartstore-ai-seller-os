function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]).trim();
  }
  return null;
}

function numeric(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function normalizeImage(url) {
  if (!url) return null;
  const value = decodeHtml(url).replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return null;
}

function parsePrice(html) {
  const direct = firstMatch(html, [
    /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
    /"priceMin"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
    /"minPrice"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
    /"beginAmount"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
  ]);

  const range = html.match(/(?:priceRange|price_range)[^\d]{0,40}([0-9]+(?:\.[0-9]+)?)[^\d]{1,12}([0-9]+(?:\.[0-9]+)?)/i);
  if (range) return { min: numeric(range[1]), max: numeric(range[2]) };

  const price = numeric(direct);
  return { min: price, max: price };
}

function parseImages(html) {
  const images = [];
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) images.push(normalizeImage(og[1]));

  const urlRegex = /(https?:\\?\/\\?\/[^"'<>\s]+?\.(?:jpg|jpeg|png|webp))(?:\?[^"'<>\s]*)?/gi;
  let match;
  while ((match = urlRegex.exec(html)) && images.length < 30) {
    images.push(normalizeImage(match[1]));
  }
  return unique(images).slice(0, 20);
}

function parseVariants(html) {
  const names = [];
  const regexes = [
    /"skuName"\s*:\s*"([^"]+)"/gi,
    /"specName"\s*:\s*"([^"]+)"/gi,
    /"value"\s*:\s*"([^"]+)"\s*,\s*"name"/gi,
  ];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(html)) && names.length < 40) {
      const name = decodeHtml(match[1]).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      if (name.length > 0 && name.length < 80) names.push(name);
    }
  }
  return unique(names).slice(0, 30).map((name, index) => ({ id: index + 1, name }));
}

export function parse1688Html(html, offerId, canonicalUrl) {
  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title>([^<]+)<\/title>/i,
    /"subject"\s*:\s*"([^"]+)"/i,
    /"offerTitle"\s*:\s*"([^"]+)"/i,
  ])?.replace(/[-_]?阿里巴巴.*$/i, "").trim() || null;

  const price = parsePrice(html);
  const images = parseImages(html);
  const minOrderQty = numeric(firstMatch(html, [
    /"minOrderQuantity"\s*:\s*"?([0-9]+)"?/i,
    /"minOrder"\s*:\s*"?([0-9]+)"?/i,
    /"beginAmount"\s*:\s*"?([0-9]+)"?/i,
  ]));
  const supplierName = firstMatch(html, [
    /"companyName"\s*:\s*"([^"]+)"/i,
    /"shopName"\s*:\s*"([^"]+)"/i,
    /"sellerName"\s*:\s*"([^"]+)"/i,
  ]);
  const variants = parseVariants(html);

  return {
    source: "1688",
    offerId,
    canonicalUrl,
    title,
    priceMinCny: price.min,
    priceMaxCny: price.max,
    images,
    minOrderQty,
    variants,
    supplier: supplierName ? { name: supplierName } : null,
  };
}

export async function collect1688FromWeb({ url, offerId }) {
  const canonicalUrl = url || `https://detail.1688.com/offer/${offerId}.html`;
  const response = await fetch(canonicalUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": "https://www.1688.com/",
    },
  });

  const html = await response.text();
  if (!response.ok) throw new Error(`1688 페이지 요청 실패 (HTTP ${response.status})`);
  if (!html || html.length < 500) throw new Error("1688 페이지 응답이 비어 있습니다.");

  const blocked = /验证码|verify|punish|访问过于频繁|sec\.1688\.com/i.test(html);
  if (blocked) {
    const error = new Error("1688가 자동 요청을 차단했습니다. 브라우저 로그인/쿠키 기반 Collector 또는 외부 API가 필요합니다.");
    error.code = "ANTI_BOT";
    throw error;
  }

  return {
    ...parse1688Html(html, offerId, canonicalUrl),
    diagnostics: { htmlBytes: html.length },
  };
}

export function local1688CollectorPlugin() {
  return {
    name: "local-1688-collector",
    configureServer(server) {
      server.middlewares.use("/api/collect-1688", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
          return;
        }

        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const input = body ? JSON.parse(body) : {};
          const data = await collect1688FromWeb(input);
          res.statusCode = 200;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = error?.code === "ANTI_BOT" ? 429 : 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: error?.code || "COLLECT_FAILED", message: error?.message || "1688 수집 실패" }));
        }
      });
    },
  };
}
