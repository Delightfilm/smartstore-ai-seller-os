import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  collect1688FromBrowser,
  disconnectFromCdp,
  parse1688Html,
  parseCollectorRequestBody,
  parseSupported1688Url,
} from "../server/collect1688.js";
import {
  collect1688Product,
  getCollectorAvailability,
  normalizeCollectorPayload,
  parse1688OfferUrl,
} from "../src/collector1688.js";

const fixtureUrl = new URL("./fixtures/1688-product-snippet.html", import.meta.url);

test("accepts a canonical 1688 offer URL", () => {
  assert.deepEqual(parseSupported1688Url("https://detail.1688.com/offer/123456.html?spm=test"), {
    offerId: "123456",
    canonicalUrl: "https://detail.1688.com/offer/123456.html",
  });
});

test("rejects a non-HTTPS 1688 offer URL", () => {
  assert.throws(
    () => parseSupported1688Url("http://detail.1688.com/offer/123456.html"),
    { code: "INVALID_1688_URL" },
  );
});

test("rejects a host other than detail.1688.com", () => {
  assert.throws(
    () => parseSupported1688Url("https://evil.example/offer/123456.html"),
    { code: "INVALID_1688_URL" },
  );
});

test("rejects an unsupported 1688 path", () => {
  assert.throws(
    () => parseSupported1688Url("https://detail.1688.com/item/123456.html"),
    { code: "INVALID_1688_URL" },
  );
});

test("rejects a request whose offerId does not match its URL", async () => {
  await assert.rejects(
    collect1688FromBrowser({
      url: "https://detail.1688.com/offer/123456.html",
      offerId: "654321",
    }),
    { code: "INVALID_1688_URL" },
  );
});

test("canonicalizes a supported client URL", () => {
  assert.deepEqual(parse1688OfferUrl("https://m.1688.com/offer/987654.html?spm=test"), {
    source: "1688",
    offerId: "987654",
    canonicalUrl: "https://detail.1688.com/offer/987654.html",
    originalUrl: "https://m.1688.com/offer/987654.html?spm=test",
  });
});

test("does not infer price or MOQ from beginAmount", () => {
  const parsed = parse1688Html(
    JSON.stringify({ beginAmount: "5" }),
    "123456",
    "https://detail.1688.com/offer/123456.html",
  );
  assert.equal(parsed.priceMinCny, null);
  assert.equal(parsed.priceMaxCny, null);
  assert.equal(parsed.minOrderQty, null);
});

test("extracts only scoped product data and records provenance", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const parsed = parse1688Html(html, "123456", "https://detail.1688.com/offer/123456.html");

  assert.equal(parsed.title, "Sanitized product title");
  assert.equal(parsed.priceMinCny, 0.14);
  assert.equal(parsed.priceMaxCny, 0.18);
  assert.equal(parsed.minOrderQty, 100);
  assert.deepEqual(parsed.images, [
    "https://cdn.example.test/product-a.jpg",
    "https://cdn.example.test/product-b.jpg",
  ]);
  assert.deepEqual(parsed.variants.map(({ name }) => name), ["Color: Blue", "Color: Red", "Pack: 10 units"]);
  assert.deepEqual(parsed.supplier, { name: "Sanitized Supplier" });
  assert.equal(parsed.provenance.priceMinCny, "__INIT_DATA__.product.priceRange");
  assert.equal(parsed.provenance.images, "__INIT_DATA__.product.productImages");
  assert.ok(!JSON.stringify(parsed).includes("Unrelated Navigation Company"));
  assert.ok(!JSON.stringify(parsed).includes("ui-icon"));
});

test("returns missing values instead of guessing from unrelated page data", () => {
  const parsed = parse1688Html(
    '<title>Captcha Interception</title><script type="application/json">{"price":999,"beginAmount":5,"companyName":"Wrong"}</script>',
    "123456",
    "https://detail.1688.com/offer/123456.html",
  );
  assert.equal(parsed.title, null);
  assert.equal(parsed.priceMinCny, null);
  assert.equal(parsed.priceMaxCny, null);
  assert.equal(parsed.minOrderQty, null);
  assert.deepEqual(parsed.images, []);
  assert.deepEqual(parsed.variants, []);
  assert.equal(parsed.supplier, null);
  assert.deepEqual(parsed.provenance, {});
});

test("normalizes and bounds collector payload fields", () => {
  const parsed = parse1688OfferUrl("https://detail.1688.com/offer/123456.html");
  const product = normalizeCollectorPayload({
    offerId: "123456",
    title: " Product ",
    priceMinCny: "0.14",
    priceMaxCny: Infinity,
    minOrderQty: "100",
    images: ["https://cdn.example.test/a.jpg", "https://cdn.example.test/a.jpg", "javascript:bad"],
    variants: ["Blue", { name: "Blue" }, { name: "Red" }, { bad: true }],
    supplier: { name: " Supplier " },
    provenance: { title: "structured.title", bad: "ignored", images: 42 },
  }, parsed);

  assert.equal(product.priceMinCny, 0.14);
  assert.equal(product.priceMaxCny, null);
  assert.equal(product.minOrderQty, 100);
  assert.deepEqual(product.images, ["https://cdn.example.test/a.jpg"]);
  assert.deepEqual(product.variants, [{ id: 1, name: "Blue" }, { id: 2, name: "Red" }]);
  assert.deepEqual(product.supplier, { name: "Supplier" });
  assert.deepEqual(product.provenance, { title: "structured.title" });
});

test("rejects malformed or mismatched collector payloads", () => {
  const parsed = parse1688OfferUrl("https://detail.1688.com/offer/123456.html");
  assert.throws(() => normalizeCollectorPayload([], parsed), { code: "INVALID_COLLECTOR_PAYLOAD" });
  assert.throws(() => normalizeCollectorPayload({ offerId: "654321" }, parsed), { code: "INVALID_COLLECTOR_PAYLOAD" });
});

test("rejects a successful collector response with invalid JSON", async () => {
  await assert.rejects(
    collect1688Product("https://detail.1688.com/offer/123456.html", {
      env: { DEV: true },
      fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError("bad json"); } }),
    }),
    { code: "INVALID_COLLECTOR_PAYLOAD" },
  );
});

test("aborts a hanging collector once and exposes a deterministic timeout", async () => {
  let calls = 0;
  const fetchImpl = (_url, { signal }) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  };
  await assert.rejects(
    collect1688Product("https://detail.1688.com/offer/123456.html", {
      env: { DEV: true },
      fetchImpl,
      timeoutMs: 10,
    }),
    { code: "COLLECT_TIMEOUT", message: /완료되지 않았습니다/ },
  );
  assert.equal(calls, 1);
});

test("disconnects only the Playwright CDP transport", () => {
  let closed = false;
  const connection = { close() { closed = true; } };
  const browser = { _connection: { toImpl: () => ({ _connection: connection }) } };
  disconnectFromCdp(browser);
  assert.equal(closed, true);
});

test("reports collector availability without probing the network", () => {
  assert.equal(getCollectorAvailability({ DEV: true }).mode, "LOCAL_BROWSER_COLLECTOR");
  assert.equal(
    getCollectorAvailability({ DEV: false, VITE_1688_COLLECTOR_URL: "https://collector.example/api" }).mode,
    "REMOTE_COLLECTOR",
  );
  assert.equal(getCollectorAvailability({ DEV: false }).mode, "HOSTED_UNAVAILABLE");
});

test("rejects malformed or unexpected collector request bodies", () => {
  assert.throws(() => parseCollectorRequestBody("{"), { code: "MALFORMED_JSON" });
  assert.throws(
    () => parseCollectorRequestBody(JSON.stringify({ url: "https://detail.1688.com/offer/123456.html" })),
    { code: "INVALID_REQUEST" },
  );
  assert.throws(
    () => parseCollectorRequestBody(JSON.stringify({
      url: "https://detail.1688.com/offer/123456.html",
      offerId: "123456",
      extra: true,
    })),
    { code: "INVALID_REQUEST" },
  );
});

test("accepts the exact collector request shape", () => {
  assert.deepEqual(
    parseCollectorRequestBody(JSON.stringify({
      url: "https://detail.1688.com/offer/123456.html",
      offerId: "123456",
    })),
    {
      url: "https://detail.1688.com/offer/123456.html",
      offerId: "123456",
    },
  );
});
