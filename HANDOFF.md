# HANDOFF.md

## Current checkpoint — dashboard research integration — 2026-10-13

- Request: preserve the existing dashboard; persist/query research and connect review state, starting with P2013. **No shipment application, purchase/payment or product publication.**
- Branch: `codex/purchase-agency-pipeline`; base commit `fcf9bcc`. Implementation and this checkpoint belong to the next task-branch commit (`Integrate persisted P2013 research and review into dashboard`); use branch HEAD for its final hash. No main merge or deployment authorized/performed.
- Files: `src/{PurchaseAgencyPanel.jsx,ResearchReviewPanel.jsx,researchReview.js,purchaseAgency.js}`, `server/{p2013Research.js,workflowStore.js,agencyWorkflow.js}`, `vite.config.js`, `test/researchReview.test.js`, this handoff and the two 2026-10-13 research documents. `SmartStoreSellerOS.jsx`, dependencies and lockfile unchanged.
- UI: existing **발굴 → 해외구매대행 조사 · 검토 기록 (로컬 전용)** panel. Stored candidate picker/status, observation sources, SKU/package/demand, editable hold reasons/note and scenario selling price. Three margin scenarios show assumptions, excluded costs and minimum price. Text status and labeled inputs; no main-layout replacement.
- Persistence: ignored `.seller-os/candidates.json`, revision checks and atomic replacement. P2013 one-time seed preserves existing records/user edits. If already collected, only missing research/review/market is filled; product, terms and draft remain untouched. Server restart does not overwrite edits. Local dev only; hosted dashboard/backend unchanged and main KPI/order data remains mock.
- Review safety: price/evidence changes invalidate prior confirmation and mark REVIEW_REQUIRED. Ordinary candidate saves do not clear stale review metadata; explicit review save is separate. Only HOLD/REVIEW_REQUIRED may be set, not READY. Startup loading disables edits. Dirty-state reload requires discard confirmation and permits stale-revision/timeout recovery.
- P2013 restored after QA to **HOLD**, scenario selling price KRW 14,900, original research note/reasons and no quote approvals. Contribution: favorable **3,237**, conservative **1,317 (8.8%)**, stress **-1,517 KRW**. These are dated assumptions, not actual quotes or net profit. No new detail page produced.

### Actual verification

- Correct cwd/status/branch/remotes/log checked in the user workspace, never System32. `git diff --check`: PASS. Main UI and dependency/lockfile diffs empty.
- TDD: new module/API tests failed before implementation, then passed. Review regression first failed with `TypeError: Cannot read properties of null (reading 'package')` for pre-existing P2013; fixed and rerun successfully.
- `npm ci`: initially FAIL `EPERM unlink node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node` while Vite held the file. PowerShell process inspection was sandbox-blocked; escalated read identified exact repo Vite PID. `Stop-Process` failed `Object reference not set to an instance of an object`; exact-PID `taskkill` succeeded. Retry `npm ci`: **PASS**, 97 packages; audit still **8 vulnerabilities (2 moderate, 6 high)**. No forced dependency upgrades.
- `npm test`: **40/40 PASS**; seed idempotence/existing-candidate preservation, exact margin math/invalid input, persistence/revision conflict, confirmation invalidation, forged review/scenario/external-action rejection, recollection and ordinary-save stale metadata preservation.
- `npm run build`: **PASS**, Vite 8.2.1, 1,801 modules. `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`: **PASS**, restarted at `http://127.0.0.1:5173/`; dedicated authenticated Chrome session preserved.
- Actual Chrome: dashboard/발굴 and saved P2013 load; note save/reload PASS; price 17,900 recalculates conservative contribution to **4,047** and invalidates review; ordinary confirmation save leaves stale=true/reviewedAt=null; restored 14,900 and HOLD. Canceling discard retains edits, accepting restores saved data; existing cable-tray candidate remains selectable. Refresh and server-restart persistence PASS. Concurrent API revision change causes visible conflict and confirmed reload recovers. No pageerrors or external non-GET requests in the final observed QA run.
- QA selectors initially timed out on English `Discovery` (actual nav is `발굴`) and exact status label (select accessible name included its options). Corrected nav selector and added explicit `aria-label`; reruns PASS. Screenshot inspected at 1440×1000; no claim of mobile/production QA.
- Independent read-only review: missing research for existing P2013 (Important), review metadata reuse and startup response race (Minor) addressed. Same reviewer rechecked fixes and found no remaining Important findings. Source research facts/rights/quotes are still unverified operationally; review did not recheck external prices. Scoped credential-pattern scan found no matches; local store/dependencies/build artifacts are not tracked.

### Unresolved / exact next action

1. Review this task-branch commit. No main merge/deployment without authorization. Research storage is local-only, not a production database or Quickstar/Commerce integration.
2. Keep P2013 HOLD. Confirm packed gross weight/additional packaging, China freight, VAT/fees, supply and image rights; obtain differentiation or cheaper verified all-in cost before reconsidering. Do not promote scenario assumptions to quotes.
3. Quickstar key/tokenKey/apiName/schema/idempotency/test-environment clarification and Naver store approval remain open. No real fulfillment or listing operations until separately authorized.
4. Dependency advisories and previously tracked preview credential rotation remain separate work. Rollback source with a new revert commit while preserving `.seller-os/`; no external shipment/listing exists to undo.

## Prior checkpoints — historical context

## Previous checkpoint — 2026-10-13

**Local overseas-purchase-agency preparation implemented; no product published.** User requested 1688 → domestic comparison → margin/demand → detail → registration, no owned inventory. Store review is incomplete, so actual Commerce OAuth/image upload/product POST is deferred. The older no-detail-work restriction below is superseded by the user's explicit request. Everything after “Historical handoff” is historical.

- Branch: `codex/purchase-agency-pipeline`; base `768a963` (previous collector implementation `2f93697`). Implementation commit: `1a82724` (`Add local purchase-agency sourcing and preparation workflow`).
- Main UI component `SmartStoreSellerOS.jsx` unchanged; `/sourcing-console` remains separate. No main merge or deployment.
- Files: new `server/{agencyWorkflow,browser1688,browserSearch,naverMarket,workflowStore}.js`, `src/{purchaseAgency.js,PurchaseAgencyPanel.jsx}`, corresponding tests; updated collector server/client, CollectorPanel, Vite config and .gitignore; plan/spec/research/draft under `docs/`. No dependency/lockfile change remains.
- Local workflow: scoped 1688 DOM/search, Naver API or browser comparison, explicit order economics, evidence gates, escaped HTML draft, revisioned `.seller-os/` store (Git-ignored), same-origin loopback JSON endpoint with 64 KB limit, collapsible development-only Discovery panel, PREPARATION_ONLY export. No publisher exists; reservation tests are storage foundations only.
- Material edits invalidate previous confirmations and require a subsequent confirmation after saving. Carton quantities do not imply MOQ 1. Comma-separated currency is parsed in full; ambiguous tokens stay null.

### Actual live result

- User completed Naver and 1688 login plus renewed 1688 security verification. Commerce developer eligibility remains blocked while store review is pending. No security bypass or retry loop used.
- Search returned 11 canonical offers. Saved offer `1089555932403`: title/supplier, 9 gallery images, 4 priced options. Fixed 40cm black/white ¥11.95; adjustable 43–74cm black/white ¥22.77. Supplier shown via browser translation: 이우 링천 생활용품 유한공사. Detail MOQ remains null, not inferred from the search card.
- Candidate persisted in ignored `.seller-os/candidates.json`; survives server restart. Five Naver ad cards with price/shipping and reviews where available; none verified as same-configuration competitors. Current status REVIEW_REQUIRED, profit null, publication NOT_PUBLISHED. Text-only detail DRAFT_INCOMPLETE; rights unknown so no images used.
- Shipping provider undecided. User authorized Quickstar/cheaper automated alternatives research, not signup/payment. Quickstar partner integrations, TossToss Open API, RootSmile REST documentation verified; cheapest all-in provider not established.
- Research: `docs/research/2026-10-13-sourcing-and-forwarders.md`; text-only draft: `docs/research/offer-1089555932403-draft.html`.
- Existing dashboard numbers/logs remain prototype mock data, not real orders/listings/profit.

### Commands and tests

- pwd/status/branch/remotes/log checked in `C:\Users\Delight\Documents\DelightFilm\smartstore-ai-seller-os`, never System32.
- `npm run 1688:browser`: PASS after required human login/verification. CDP `/json/version` HTTP 200 after collection cleanup; dedicated browser preserved.
- `npm ci`: PASS, 97 packages. Installer reported **15 vulnerabilities (1 moderate/14 high)**. Separate `npm audit --json` exit 1 reported **8 (2 moderate/6 high)**. Results differ; neither is a clean audit. No forced/major upgrade performed.
- Final `npm test`: **34/34 PASS**. Final `npm run build`: PASS, Vite 8.2.1, 1,799 modules.
- `npm run dev`: PASS at `http://127.0.0.1:5173/`, left running for inspection.
- Actual Chrome: main login/dashboard/Discovery intact; one collector and one workflow; persisted candidate loads, correct draft iframe, independent sourcing-console, no pageerror. Material edit disables confirmations until save; unsaved changes block export. Save and JSON download PASS with PREPARATION_ONLY / REVIEW_REQUIRED / DRAFT_INCOMPLETE / NOT_PUBLISHED.
- Actual API: cross-origin, malformed JSON and >64 KB requests rejected HTTP 400.
- Test-first failures observed and fixed: missing new modules, Naver UI control/ambiguous money parsing, stale recollection, confirmation reuse, carton MOQ, partial comma-price parsing.
- Browser follow-up initially timed out on exact textarea label (30s); explicit accessible label fixed it. Another test filled an identical value and wrongly expected dirty state; corrected test makes an actual edit then restores original text, and passes.
- Independent read-only review: 3 Important findings fixed RED→GREEN; 34-test suite/build re-run. No second reviewer used. Live fidelity/rights/quotes and Commerce behavior were not independently assessed; source facts tested by parent, remaining operational facts still unknown.

### Unresolved / Next task

1. Review pushed branch; no main merge without authorization.
2. Quickstar independent developer API guide acquired/read (follow-up below). Clarify existing-account issued API key vs tokenKey/user-session, apiName, schema casing, rate limits/idempotency/test environment before integration. Compare matched VAT/parcel/inspection/packing/returns quotes with RootSmile and TossToss. No signup/payment/shipments/customer-data transfer without authorization.
3. Prefer complete SKU-level package data and MOQ 1. P2013 reviewed and HOLD (follow-up below); do not draft/publish it until conservative costs and differentiation support a competitive price. Existing cable-tray candidate remains unapproved. Verify rights/specs/fulfillment for any next candidate.
4. Once store approval/API eligibility is available, implement/test real Commerce OAuth/image upload/schema-valid registration and persistent duplicate/unknown-outcome controls; verify real returned product ID.
5. Separate security upgrade review needed for dependency advisories. Prior preview-sync credential rotation remains owner issue #5.
- Deferred minor: no in-panel stale-revision/timeout recovery while edits are dirty. Copy unsaved text before reloading browser and loading saved candidate, or unsaved edits are lost.
- Local data/browser session preserved. No raw authenticated HTML, cookie, profile, secret or local store added to Git. Rollback source via revert on a new branch, preserving `.seller-os/`; no external listing/fulfillment rollback needed.

### Research follow-up — 2026-10-13

- Branch `codex/purchase-agency-pipeline`, inspected HEAD `fcf9bcc`; this follow-up is a local documentation update, no new commit/push or main merge.
- Files changed: `HANDOFF.md`, `docs/research/2026-10-13-sourcing-and-forwarders.md`. No application source, UI, dependencies, candidate confirmation or economics changed.
- Quickstar official Open API notice verified. User obtained issuance; authenticated guide read using user-provided access. Actual account API key not retrieved. No secret, account identifier or authenticated HTML stored in repo.
- Documented create/update/discard/query plus service/transport/carrier/HS reference endpoints. Query describes tracking, weight/volume/charges/payment. Existing-account API key vs signup-returned tokenKey remains ambiguous; no API calls, signup, shipment or payment executed.
- Offer `1089555932403`, black fixed 40cm: merchant table says product weight 500g (all four options); selected-option image says assembled 40×14×19cm, tray rim 4cm. These are NOT confirmed packed gross weight or parcel dimensions. Packaging verification remains incomplete; no freight/margin assumptions promoted to facts.
- Checks: pwd/status/branch/remotes/log, official notice + guide sections, live product weight DOM, 9 gallery and 12 detail images inspected. PASS for document access and listed product observations; NOT VERIFIED for auth integration, packed weight/dimensions, live API behavior. Browser selector initially matched four hidden/visible response tabs; scoping to visible tab resolved it. Documentation diff check recorded after editing; build/tests not rerun for documentation-only changes (earlier results above are from prior checkpoint).
- Dedicated Chrome and guide tab preserved; only temporary image contact sheet closed and CDP transport disconnected.
- The later user instruction below supersedes the proposed cable-tray inquiry: prefer products with complete package data and MOQ 1 rather than manually chasing missing data. Quickstar auth clarification remains open.

### P2013 market/margin follow-up — 2026-10-13

- Branch `codex/purchase-agency-pipeline`, base HEAD `fcf9bcc`. Local research/documentation only; no new commit/push. Existing research edits preserved.
- Files for this follow-up: new `docs/research/2026-10-13-p2013-market-margin.md`, updated `HANDOFF.md`. Main UI/source/dependencies/local candidate approvals unchanged.
- Selected P2013 black, offer `816692570613`: CNY 16.5, MOQ 1, displayed stock 13, SKU packaging table 18.5×14×4.5cm / 446g. Explicit gross/net distinction only corroborated by secondary repost; no physical packed-weight verification. Only 54g headroom below 0.5kg. Destination China freight remains unknown.
- Live substitutes: LAAON ITB-ST300 KRW 8,500 delivered (smaller/lighter, zero reviews); Leto LTS-R02 KRW 14,900 delivered (2 GS reviews); Morac Bold M1 KRW 15,900 + 3,000 delivery, membership free-delivery shown (745 reviews). Not confirmed same-OEM or fully equivalent configurations.
- Demand evidence: Morac primary page shows 21 repeat buyers in last 3 months and October-dated reviews; GS Leto reviews dated Feb 11/Aug 20. Category demand signal, not P2013 monthly-sales proof.
- Quickstar general sea-self public rates rechecked: 0.5kg KRW 5,400, 1kg 6,200; displayed FX 211 KRW/CNY. VAT/extra fees unresolved. Scenario assumptions and formula explicitly documented, not provider contracts.
- Decision HOLD / detail not created / not published. At KRW 14,900 delivered, modeled contribution ranges +3,237 favorable / +1,317 conservative / -1,517 stress including 10% ads. Taxes/fixed costs/labor excluded; not net profit. Conservative provisional 3,000 KRW and 20% screen requires >=17,242 KRW, without proven advantage over fast domestic substitutes.
- Verification: read-only live product/market/tariff observations and JS arithmetic; initial review-date script syntax error fixed and rerun successfully. No API transaction/order/customer-data transfer. Documentation diff check run; npm/build/tests not rerun for document-only work.
- Exact next action: keep P2013 on hold; use complete per-SKU package/gross-weight/MOQ-1 evidence and conservative delivered-cost comparison to shortlist candidates with more price headroom. Reconsider P2013 only with reliable low all-in logistics cost or evidenced differentiation, stable supply, and image rights. These are research rules, not newly implemented application filters.

## Historical handoff (superseded by checkpoint above)

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
- Implementation commit: `2f93697` (`Harden 1688 collector data quality`).
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
