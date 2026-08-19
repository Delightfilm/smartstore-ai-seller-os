# HANDOFF.md

## Current objective

Validate and harden real 1688 product-data extraction before connecting collected products to Seller OS screening or automation.

## Stable state

- Repository: `Delightfilm/smartstore-ai-seller-os`
- Stable branch: `main`
- PR #4 repository/build stabilization: merged.
- PR #6 direct Discovery collector integration: reviewed by ChatGPT and squash-merged into `main` as `87381df`.
- Vercel checks for the PR preview and merged production commit passed on both connected Vercel project checks.
- `node_modules/`, `dist/`, `.env`, Vercel local metadata, browser profiles, and generated files are ignored.
- Dependencies are pinned and `npm ci` / `npm run build` are reproducible.
- The existing `SmartStoreSellerOS.jsx` UI remains the main UI.
- `CollectorPanel` is directly rendered inside the existing Discovery React screen; the MutationObserver/portal bridge has been removed.
- `/sourcing-console` remains separate and experimental.
- Local 1688 collection is development-only through Playwright CDP on `127.0.0.1:9222`.
- Hosted builds without `VITE_1688_COLLECTOR_URL` show `HOSTED_UNAVAILABLE` and do not attempt local Chrome access.
- Server request validation, 2 KB body limit, exact request shape checks, strict canonical 1688 navigation validation, and regression tests are present.
- `npm test` uses Node's built-in test runner and now covers deterministic extraction, payload normalization, timeout, and CDP cleanup (17/17 passing).
- Collector extraction now accepts only scoped product structures/metadata and reports per-field provenance; generic page-wide price/image/value/company regexes were removed.
- CDP cleanup closes only the Playwright transport, not the dedicated Chrome process.
- GitHub issue #5 still tracks rotation/revocation of the previously committed preview-sync credential-like value. This is a credential-owner action and is not a blocker for collector development.

## Product invariants

- Preserve the existing SmartStore Seller OS layout and Discovery screen structure.
- Do not replace the main UI with `SourcingConsole.jsx`.
- Do not implement Vercel-to-local-Chrome connectivity.
- Do not start SmartStore auto-registration, LLM screening, detail-page generation, or mass sourcing yet.
- Do not fabricate unavailable 1688 fields. Unknown values must remain `null`/empty and be reported as missing.
- Never commit full authenticated page HTML, cookies, local browser profiles, tokens, account identifiers, or other session data.

## Completed task for Codex

Status: completed on `feat/1688-collector-data-quality`; factual results are in the completion record below. The next action is ChatGPT review. Do not repeat this task unless review finds a defect.

### Branch

Create:

`feat/1688-collector-data-quality`

### Goal

Prove that the current live 1688 collector is extracting the correct product-level values, then harden the parser/normalizer with sanitized regression fixtures and explicit field provenance. The goal is data correctness, not feature expansion.

### Required work

1. Start from current `main`:
   - `git checkout main`
   - `git pull origin main`
   - confirm a clean working tree and normal Windows user-directory checkout
   - create `feat/1688-collector-data-quality`

2. Run the existing verification baseline first:
   - `npm ci`
   - `npm test`
   - `npm run build`

3. Start the dedicated browser and dev server, then perform a real collector validation using the known project test offer if still reachable:
   - `https://detail.1688.com/offer/985165165739.html`
   - If 1688 login/captcha/security verification blocks the page, record `HUMAN_REQUIRED` and do not bypass it.
   - Do not commit raw authenticated HTML.

4. For the live result, inspect whether each normalized field actually corresponds to the product page:
   - title
   - priceMinCny
   - priceMaxCny
   - minOrderQty
   - product images
   - variants/SKU option values
   - supplier
   Record field presence and extraction source/provenance in `HANDOFF.md`, but do not record private account/session data.

5. Audit the current regex parser for false-positive risk. In particular:
   - generic `"price"` matches may pick unrelated values
   - broad image URL scanning may pick site/UI assets instead of product images
   - generic `value`/`name` variant matching may pick unrelated page data
   - supplier/title fallbacks must not silently return unrelated page chrome values
   Prefer specific structured page state, product JSON, product DOM/meta, or narrowly scoped patterns over broad regexes.

6. Refactor extraction only as much as needed to make field origin explicit and testable.
   - Keep `parse1688Html` or replace it with small deterministic extractors if that is cleaner.
   - Preserve the collector response contract used by the UI.
   - Add non-sensitive diagnostics such as field source names/provenance where useful, e.g. `priceRange`, `og:title`, structured SKU block, etc.
   - Do not expose or persist cookies/session identifiers.

7. Add sanitized regression fixtures/tests.
   - Do NOT save a full real authenticated HTML page.
   - Extract only minimal representative snippets/objects needed for parser tests and scrub any account/session identifiers.
   - Add tests that prove product values are preferred over unrelated decoy values in the same fixture.
   - Add tests for partial/missing data returning `null` instead of guesses.
   - Keep using Node's built-in test runner unless there is a compelling reason not to.

8. Harden client collection behavior while touching this boundary:
   - add a reasonable request timeout/AbortController so the UI cannot stay in `LOADING` forever if a local or remote collector hangs
   - return a clear timeout error to the panel
   - do not retry automatically in a way that could amplify 1688 anti-bot/security checks

9. Validate normalized payload types.
   - prices and MOQ should be finite numeric values or `null`
   - images should be valid HTTP(S) URLs and deduplicated
   - variants should be bounded/deduplicated structured values
   - supplier should have a predictable shape
   - malformed collector payloads must not be presented as successful high-confidence data

10. Do not connect the collected result into the Seller OS candidate/rule engine yet. The next architectural step after this task will be `Raw Collector -> Normalizer -> ProductCandidate -> Rule Engine`, but only after data quality is proven.

## Required verification

Run and record:

```bash
npm ci
npm test
npm run build
npm run dev
npm run 1688:browser
```

Then verify:

- existing `/` Seller OS UI still renders
- Discovery collector panel still renders once and remains visually consistent
- `/sourcing-console` remains independent
- malformed/unsupported requests still fail safely
- collector timeout behavior is user-visible and deterministic
- dedicated CDP browser remains reachable after collection
- known live product extraction is compared against the visible 1688 page where feasible
- no raw authenticated HTML/session data is added to Git

## Git handoff protocol

- Do not merge into `main`.
- Update this file with factual results at completion.
- Commit and push `feat/1688-collector-data-quality` for ChatGPT review.
- If a live field cannot be verified, report it as unverified rather than assuming correctness.

## Recent completion

### PR #6 — Discovery collector integration

- Direct React integration: PASS.
- MutationObserver/portal bridge removed.
- `npm ci`: PASS.
- `npm test`: PASS (10/10).
- `npm run build`: PASS with Vite 8.2.1.
- `npm run dev`: PASS.
- Middleware malformed/oversize/invalid URL checks: PASS.
- `npm run 1688:browser`: PASS.
- CDP lifecycle: PASS; browser remained reachable after collection cleanup.
- Vercel Preview checks: PASS.
- Production checks after merge: PASS.

## Codex completion record

- Status: COMPLETE
- Branch: `feat/1688-collector-data-quality`
- Commit: branch commit created after this record; use the pushed branch tip for review.
- Files changed:
  - `server/parse1688.js`: deterministic structured product extraction and field provenance.
  - `server/collect1688.js`: parser integration and CDP transport-only disconnect.
  - `src/collector1688.js`: 45-second AbortController timeout, strict normalized payload types, URL/variant bounds and deduplication, malformed payload rejection.
  - `test/fixtures/1688-product-snippet.html`: minimal sanitized product/decoy fixture; no authenticated page or session data.
  - `test/collector1688.test.js`: parser, decoy, missing-data, normalizer, invalid JSON, timeout/no-retry, and CDP cleanup coverage.
- Verification:
  - Baseline before changes: `npm ci` PASS (97 packages, 0 vulnerabilities), `npm test` PASS (10/10), `npm run build` PASS (Vite 8.2.1, 1,797 modules).
  - Final `npm ci`: PASS (97 packages, 0 vulnerabilities).
  - Final `npm test`: PASS (17/17).
  - Final `npm run build`: PASS (Vite 8.2.1, 1,797 modules).
  - `npm run dev`: PASS at `http://127.0.0.1:5173/`.
  - `npm run 1688:browser`: PASS; remote debugging ready at `http://127.0.0.1:9222`.
  - Existing `/` Seller OS login, dashboard, and Discovery UI: PASS; Collector input rendered exactly once and no Vite overlay/recorded console error was present.
  - `/sourcing-console`: PASS as an independent route with its existing controls; no Vite overlay.
  - Timeout UI: PASS; a controlled hanging fetch produced the deterministic visible `45초 안에 완료되지 않았습니다` panel error, with one request and no retry.
  - Malformed request: PASS; rejected with HTTP 400. Known live request under the security screen: HTTP 409 `BROWSER_VERIFY_REQUIRED`.
  - CDP lifecycle: PASS; `/json/version` returned HTTP 200 after collector cleanup.
- Known live offer audit (`985165165739`):
  - An initial pre-hardening request returned HTTP 200 before the security screen appeared.
  - `title`: present and matched the then-visible page title; old source was a broad title/meta fallback.
  - `priceMinCny` / `priceMaxCny`: present as `0.14` / `0.14`, but visible-page correspondence was not verified; old source was a generic price regex.
  - `minOrderQty`: missing (`null`); unverified.
  - `images`: present (24) but incorrect; inspection showed Alibaba/site UI assets, confirming the broad URL scan false-positive risk.
  - `variants`: missing (empty); unverified.
  - `supplier`: present as `澜澳日用品(扬州)有限公司`, but visible-page correspondence was not verified; old source was a generic company-name fallback.
  - Subsequent and final attempts displayed 1688 security verification, so current post-hardening live field comparison is `HUMAN_REQUIRED`. No bypass was attempted.
- Security/hygiene: no full authenticated HTML, cookies, browser profile, token, account identifier, or session data was saved or added to Git.
- Unresolved issue: a human must complete the 1688 security verification before the hardened parser can be compared field-by-field against the visible live offer.
- Next action: ChatGPT should review the pushed branch, especially the allowed structured-data paths and internal Playwright CDP transport disconnect; do not merge to `main` until approved.
