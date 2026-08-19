# HANDOFF.md

## Current objective

Move from repository stabilization to a clean, testable 1688 Discovery integration while preserving the existing SmartStore Seller OS UI.

## Stable state

- Repository: `Delightfilm/smartstore-ai-seller-os`
- Stable branch: `main`
- PR #4 (`Stabilize repository build and local 1688 collector`) was reviewed by ChatGPT and squash-merged into `main` as `a7be9cc`.
- Vercel build checks for the stabilization branch passed; production deployment for the merged commit is being handled through the connected Git integration.
- `node_modules/` and generated build output are no longer intended to be tracked.
- Dependencies are pinned and `package-lock.json` is aligned.
- `npm ci`, `npm run build`, `npm run dev`, and `npm run 1688:browser` passed in the normal Windows user-directory checkout.
- The local 1688 collector is development-only and uses Playwright CDP with the dedicated browser on `127.0.0.1:9222`.
- Hosted production does not attempt to connect to the user's local Chrome. Without `VITE_1688_COLLECTOR_URL`, it reports an explicit unavailable state.
- Server-side 1688 URL validation is present and arbitrary authenticated-browser navigation is blocked.
- `beginAmount` is no longer guessed as both price and MOQ.
- The hardcoded preview-sync endpoint/key-like value was removed; preview sync is opt-in via `PREVIEW_SYNC_URL`.
- ChatGPT additionally hardened preview-sync path containment after reviewing the Codex branch.
- GitHub issue #5 tracks rotation/revocation of the previously committed preview-sync credential-like value. This is a human/credential-owner action.

## Product invariants

- Preserve the existing `src/SmartStoreSellerOS.jsx` main UI and overall layout.
- Do not replace the main UI with `src/SourcingConsole.jsx`.
- `/sourcing-console` remains experimental/separate.
- Do not implement Vercel-to-local-Chrome connectivity.
- Do not expand into SmartStore auto-registration, LLM screening, or detailed page generation during this task.

## Next task for Codex

### Branch

Create:

`feat/discovery-collector-integration`

### Goal

Remove the fragile DOM/MutationObserver bridge and make the 1688 collector a first-class part of the existing Discovery screen, then add targeted regression/security tests around the collector boundary.

### Required work

1. Start from current `main`:
   - `git checkout main`
   - `git pull origin main`
   - confirm the checkout is not under `C:\Windows\System32`
   - confirm a clean working tree before starting
2. Create `feat/discovery-collector-integration`.
3. Inspect how the existing Discovery screen is rendered inside `SmartStoreSellerOS.jsx`.
4. Replace the current `DiscoveryCollectorBridge.jsx` MutationObserver/portal insertion with a direct React integration at the correct Discovery location.
   - Preserve the existing visual placement as closely as possible.
   - Do not redesign the page.
   - Prefer extracting/reusing a `CollectorPanel` component rather than duplicating markup.
   - Once direct integration is verified, remove obsolete bridge wiring from `main.jsx`; delete the bridge file only if it is no longer referenced.
5. Add a small explicit collector availability presentation without making network calls just to detect mode:
   - local dev + no remote endpoint => local browser collector mode
   - configured `VITE_1688_COLLECTOR_URL` => remote collector mode
   - hosted build + no remote endpoint => hosted unavailable
   Keep this consistent with the current collection behavior and do not fake availability.
6. Harden the local Vite middleware request boundary:
   - reject malformed JSON cleanly
   - require the expected request shape
   - enforce a small request-body size limit appropriate for a URL/offerId request
   - keep the existing strict supported-1688 URL validation before browser navigation
7. Verify CDP lifecycle behavior. A collection request must not unexpectedly terminate the dedicated Chrome/Edge process or destroy the user's authenticated browser session. If current `browser.close()` semantics in this implementation terminate the remote browser, change the cleanup to disconnect safely while still closing only the page created by the request. Record the observed behavior.
8. Add focused automated tests with minimal new tooling. Prefer Node's built-in test runner if practical rather than adding a large test framework. Cover at least:
   - accepted canonical 1688 offer URL
   - rejected non-HTTPS URL
   - rejected non-`detail.1688.com` host
   - rejected unsupported path
   - offerId mismatch rejection
   - client URL canonicalization behavior
   - parser does not infer price/MOQ from `beginAmount`
   If testing Vite middleware directly would require disproportionate scaffolding, keep middleware checks as documented integration tests instead of adding a heavy dependency.
9. Do not implement a production remote collector in this task. Preserve the replaceable `VITE_1688_COLLECTOR_URL` interface.
10. Do not touch the separate Supabase credential rotation issue except to keep it documented as unresolved/human-required.

## Required verification

Run and record:

```bash
npm ci
npm run build
npm run dev
```

Run the new automated tests.

On Windows, also verify:

```bash
npm run 1688:browser
```

Then verify:

- `/` renders the existing SmartStore Seller OS UI.
- Discovery screen renders the 1688 collector panel directly, without MutationObserver/portal discovery.
- Navigation away from and back to Discovery does not duplicate the panel.
- `/sourcing-console` still renders independently.
- Dedicated browser CDP endpoint stays reachable after a collector request lifecycle test.
- If a full live 1688 collection is blocked by login/captcha, record it as human-required rather than bypassing security verification.

## Git handoff protocol

- Do not merge into `main`.
- Update this file with factual results at completion.
- Commit and push `feat/discovery-collector-integration` for ChatGPT review.
- Do not commit generated output, browser profiles, cookies, secrets, or `.env` files.

## Previous stabilization completion

- PR #4: merged.
- `npm ci`: PASS.
- `npm run build`: PASS with Vite 8.2.1.
- `npm run dev`: PASS.
- `npm run 1688:browser`: PASS; CDP endpoint returned HTTP 200.
- Remaining human/security action: rotate/revoke the previously committed preview-sync credential-like value tracked in issue #5.

## Codex completion record

- Status: COMPLETE
- Branch: `feat/discovery-collector-integration`
- Implementation commit: `a9014a3` (`Integrate Discovery collector`)
- Files changed: added `src/CollectorPanel.jsx` and `test/collector1688.test.js`; directly integrated the panel in `SmartStoreSellerOS.jsx`; removed `DiscoveryCollectorBridge.jsx` and its `main.jsx` wiring; added explicit collector availability modeling; hardened the local request boundary; added the `npm test` script.
- `npm ci`: PASS (`97` packages installed, `0` vulnerabilities).
- `npm test`: PASS (`10/10` Node built-in tests). Coverage includes canonical URL acceptance, protocol/host/path rejection, offerId mismatch, client canonicalization, `beginAmount`, availability modes, malformed JSON, and exact request shape.
- `npm run build`: PASS with Vite `8.2.1` (`1,797` modules transformed).
- `npm run dev`: PASS at `http://127.0.0.1:5173/`.
- Browser/UI checks: PASS. The existing Seller OS login/dashboard layout remained intact; Discovery rendered exactly one direct collector panel and no bridge DOM; navigating away and back still rendered one panel; `/sourcing-console` rendered independently with zero collector panels; no Vite overlay or captured console errors appeared.
- Availability checks: PASS. Dev without a remote URL displayed `LOCAL_BROWSER_COLLECTOR`. Production preview without a remote URL displayed `HOSTED_UNAVAILABLE` / `호스팅 미지원` with the collector input and button disabled. The configured-remote branch is covered by the automated availability test.
- Middleware integration checks: PASS. Malformed JSON returned `400 MALFORMED_JSON`, missing fields returned `400 INVALID_REQUEST`, a body over 2 KB returned `413 REQUEST_TOO_LARGE`, and an unsupported host returned `400 INVALID_1688_URL` before browser navigation.
- `npm run 1688:browser`: PASS. Chrome launched with the dedicated profile and the CDP endpoint returned HTTP `200`.
- CDP lifecycle: PASS. A local API collection request for a canonical 1688 URL completed with HTTP `200`; the CDP endpoint returned HTTP `200` both before and after request cleanup. The Playwright `browser.close()` call disconnected the CDP transport without terminating the dedicated Chrome process or authenticated session, while the request-created page was closed.
- React review: PASS. The panel is a top-level reusable component, derives availability during render without effect duplication, and adds no global listeners or probe requests.
- Unresolved: no production remote collector was implemented, by design. Credential rotation/revocation remains human-required in GitHub issue #5.
- Next action: ChatGPT should review the pushed branch and test evidence, then decide whether it is ready to merge. Do not merge until review is complete.
