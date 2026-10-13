# Purchase Agency Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task. The user requested continuous execution; implementation stays in this session.

**Goal:** Connect real product sourcing, Korean market comparison, order-level profitability, factual detail HTML and guarded SmartStore registration.

**Architecture:** Existing Vite/CDP collector plus local workflow middleware. Pure evaluation/content functions, provider adapters and a local candidate store are separate. Existing Discovery panel hosts the workflow.

**Tech Stack:** React, Vite, Node test runner, playwright-core, Naver Open/Commerce APIs.

**Spec:** `docs/superpowers/specs/2026-10-13-purchase-agency-design.md`

## Global Constraints

- Overseas purchase agency only; no warehouse inventory purchase.
- Preserve main layout; never merge main.
- Missing evidence stays missing. No fabricated sales/reviews/specifications.
- Browser verification is human-only. No raw authenticated HTML or secrets in Git.
- Credentials remain server-side. Writes are same-origin and registration is not retried automatically.

## Review Focus

- Numeric strings/whitespace/booleans and missing shipping must not produce profitable recommendations.
- A cheap unrelated SKU must not become a listing price; selected purchase quote is required.
- Edited or stale candidates must not reuse old registration approval; uncertain POST outcomes cannot be replayed.
- Search supply counts and category click ratios must not become confirmed sales demand.
- Missing login/configuration must be actionable in UI without exposing secrets.

### Task 1: Product sourcing

**Files:** `server/collect1688.js`, `server/parse1688.js`, `server/browser1688.js`, collector tests.
**Interfaces:** `search1688Products(query)` → canonical offer links; `collect1688FromBrowser` → normalized source record with provenance.
- [ ] Add failing fixture tests for observed product DOM and invalid numeric input.
- [ ] Implement narrowly scoped DOM extraction, bounded search and visible security handoff.
- [ ] Run `npm test`; all tests pass, compare against visible product.

### Task 2: Evidence and order economics

**Files:** `src/purchaseAgency.js`, `server/naverMarket.js`, `test/purchaseAgency.test.js`, `test/naverMarket.test.js`.
**Interfaces:** `evaluateCandidate(product, market, terms)` → status, blockers, totals; `searchNaverMarket(query, config)` → timestamped competitors and optional trend.
- [ ] Test explicit zero vs missing costs, single-unit MOQ, selected quote and competition/demand gaps.
- [ ] Implement finite order costs and evidence gating; official market API normalizer with null reviews/shipping.
- [ ] Run `npm test`; no false READY decisions with missing inputs.

### Task 3: Content and registration

**Files:** `server/smartstore.js`, `server/workflowStore.js`, registration tests.
**Interfaces:** `renderDetail(product, listing)` → escaped HTML; publisher persists per-offer REGISTERING/PUBLISHED/UNKNOWN and returns real API identifiers only.
- [ ] Test escaped content, missing merchant fields, duplicate and uncertain registrations.
- [ ] Implement OAuth, approved image upload, final payload validation, persistent no-retry publication boundary.
- [ ] Run `npm test`; no remote POST on failed preconditions.

### Task 4: Connect existing Discovery UI

**Files:** `server/purchaseAgencyPlugin.js`, `src/PurchaseAgencyPanel.jsx`, `src/CollectorPanel.jsx`, `vite.config.js`, `.env.example`, `.gitignore`.
**Interfaces:** `/api/agency/{status,credentials,search,collect,candidates,analyze,draft,publish}`. Never return credential values. Candidate revision binds updates.
- [ ] Test origin/body checks and workflow persistence through actual middleware.
- [ ] Add compact workflow panel, connection setup, cost/evidence editor, HTML preview and explicit publish result.
- [ ] Run unit tests, build and Playwright UI flow with controlled external responses.

### Task 5: Live check and handoff

- [ ] Resume user login; attempt market API and actual candidate only with authentic configuration.
- [ ] Run `npm ci`, `npm test`, `npm run build`; record exact failures/limits.
- [ ] Obtain independent code review and address substantive findings.
- [ ] Update HANDOFF with implementation vs live outcomes; commit/push work branch.

## Execution ledger

- Scope update: store approval is incomplete. User requested unaffected work first. Tasks 3/4 are narrowed to local draft + PREPARATION_ONLY export, not OAuth/image upload/product POST. No live publisher exists. Shipping provider is undecided; public comparison research is authorized, signup/payment is not.
- Task 1: DOM fixture tests and live search pass; actual offer 1089555932403 has 4 priced options and 9 gallery images, supplier/title present, MOQ remains null. Human verification recurred and was completed by the user; no bypass/retry loop.
- Task 2: order economics/market normalizers implemented; missing shipping stays null; ambiguous currency/range text and navigation controls excluded. Live market has 5 advertisement cards, not 5 verified equivalent SKUs. Never label search count or review count as sales.
- Task 3: escaped detail HTML and revisioned local store implemented. Duplicate reservation tests are foundations only, not evidence of an implemented publisher. Draft omits images until use rights are confirmed.
- Task 4: same-origin 64 KB JSON local endpoint plus collapsible Discovery panel added. Existing main component and layout untouched. Separate sourcing-console verified. New fields support blank costs, comparison review, draft preview, and preparation export. No credential-entry UI needed for browser fallback.
- Task 5 current checks: 31/31 unit tests and build pass; actual candidate persisted locally with partial terms/draft; browser smoke check shows one collector, one workflow, correct iframe title, no pageerror; sourcing-console independent. Final clean install, review, handoff and commit/push pending.
- Regression discovered during integration: recollecting an existing offer returned stale source data. Added a failing recollection test, then refreshed source and reset all evidence confirmations; targeted suite 2/2 passes.
- Final review: independent read-only reviewer found 3 Important items. All fixed with RED→GREEN tests: editing evidence resets confirmations and requires a subsequent saved-state confirmation; carton MOQ remains unknown without sellable-unit conversion; complete currency tokens parse thousands and reject malformed/range text. Full suite 34/34 and build PASS.
- Final: minor (deferred): dirty stale-revision/timeout recovery lacks an in-panel reload/discard action. Workaround is to copy unsaved text, reload the page and load the saved candidate; unsaved fields otherwise disappear on reload.
- Final: Ruling: reviewer did not judge live field fidelity/visual acceptance/supplier rights/quotes. Parent verified live title/options/supplier and UI, but MOQ/rights/quotes remain unconfirmed and candidate stays REVIEW_REQUIRED. Cost if wrong: more source verification, not published claims.
- Final: Ruling: reviewer did not judge Commerce behavior because no publisher exists. Keep registration deferred and clearly mark PREPARATION_ONLY; cost if wrong: later integration work.
- Final: Ruling: reviewer did not repeat install/build/browser checks. Parent performed npm ci, 34-test suite/build and browser checks directly; cost if wrong: independent reproduction remains desirable before merge.
- Browser follow-up initially timed out finding exact textarea label because label accessible text included its current contents. Added explicit aria-label matching visible labels; rerun required before final handoff.
- Final browser rerun PASS: real edit/reset, confirmation-disabled-on-material-edit, save, JSON download and correct PREPARATION_ONLY/REVIEW_REQUIRED/DRAFT_INCOMPLETE/NOT_PUBLISHED states. An intermediate identical-fill test had no change event; the test was corrected, not product data. Cross-origin/malformed/oversized requests rejected; CDP remains alive.
- npm ci PASS (97 packages), reported 15 vulnerabilities (1 moderate/14 high); separate npm audit --json returned exit 1 and 8 (2 moderate/6 high). Both are warning evidence, not a clean security report. No lockfile/dependency change remains; forced/major upgrades deferred to a dedicated review.
- Ruling: stale HANDOFF prohibition on detail/automation superseded by explicit user five-stage request, then narrowed by pending store review. Publication remains deferred; cost if wrong is needing API integration after approval, not unintended live listing.

- Baseline: branch `768a963`; 17/17 tests pass. No Naver/Commerce/OpenAI credential environment configured.
- Live: dedicated CDP launched after escalation; known offer visible. MOQ display is 100 sets, not a verified single-item offer. Naver API center opened for user login.
- Ruling: use the current dedicated branch `codex/purchase-agency-pipeline`, preserving the user's selected workspace; no separate worktree needed for this serial implementation.
- Ruling: keep this tracked plan as the progress ledger instead of POSIX skill scratch scripts; all source edits use apply_patch on Windows.
