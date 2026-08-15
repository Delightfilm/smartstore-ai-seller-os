import { chromium } from "playwright-core";

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
  while ((match = urlRegex.exec(html)) && images.length < 40) images.push(normalizeImage(match[1]));
  return unique(images).slice(0, 24);
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
    while ((match = regex.exec(html)) && names.length < 50) {
      const name = decodeHtml(match[1]).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      if (name.length > 0 && name.length < 100) names.push(name);
    }
  }
  return unique(names).slice(0, 36).map((name, index) => ({ id: index + 1, name }));
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

async function browserReady() {
  try {
    const res = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function collect1688FromBrowser({ url, offerId }) {
  const canonicalUrl = url || `https://detail.1688.com/offer/${offerId}.html`;
  if (!(await browserReady())) {
    const error = new Error("1688 전용 브라우저가 실행 중이 아닙니다. 새 CMD에서 npm run 1688:browser 를 실행하고, 열린 브라우저에서 1688 로그인 후 다시 시도하세요.");
    error.code = "BROWSER_NOT_READY";
    throw error;
  }

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("1688 브라우저 컨텍스트를 찾지 못했습니다.");
    const page = await context.newPage();
    try {
      await page.goto(canonicalUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3500);
      const finalUrl = page.url();
      const titleText = await page.title().catch(() => "");
      const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
      const blocked = /验证码|访问过于频繁|安全验证|滑动验证|punish|verify/i.test(`${titleText}\n${bodyText}`) || /sec\.1688\.com|punish/i.test(finalUrl);
      if (blocked) {
        const error = new Error("1688 브라우저 세션에서도 보안 검증 화면이 열렸습니다. 전용 브라우저 창에서 검증을 완료한 뒤 다시 상품 가져오기를 누르세요.");
        error.code = "BROWSER_VERIFY_REQUIRED";
        throw error;
      }

      const html = await page.content();
      const data = parse1688Html(html, offerId, canonicalUrl);
      return {
        ...data,
        diagnostics: {
          mode: "BROWSER_CDP",
          htmlBytes: html.length,
          finalUrl,
          pageTitle: titleText,
        },
      };
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

export function local1688CollectorPlugin() {
  return {
    name: "local-1688-collector",
    configureServer(server) {
      server.middlewares.use("/api/collect-1688", async (req, res) => {
        res.setHeader("content-type", "application/json; charset=utf-8");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
          return;
        }
        try {
          let body = "";
          for await (const chunk of req) body += chunk;
          const input = body ? JSON.parse(body) : {};
          const data = await collect1688FromBrowser(input);
          res.statusCode = 200;
          res.end(JSON.stringify(data));
        } catch (error) {
          const clientCodes = new Set(["BROWSER_NOT_READY", "BROWSER_VERIFY_REQUIRED"]);
          res.statusCode = clientCodes.has(error?.code) ? 409 : 502;
          res.end(JSON.stringify({ error: error?.code || "COLLECT_FAILED", message: error?.message || "1688 수집 실패" }));
        }
      });
    },
  };
}
