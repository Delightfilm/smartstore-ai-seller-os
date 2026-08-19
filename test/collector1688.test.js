import test from "node:test";
import assert from "node:assert/strict";

import {
  collect1688FromBrowser,
  parse1688Html,
  parseCollectorRequestBody,
  parseSupported1688Url,
} from "../server/collect1688.js";
import { getCollectorAvailability, parse1688OfferUrl } from "../src/collector1688.js";

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
