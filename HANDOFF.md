# HANDOFF.md

## Current objective

Stabilize the repository and Vercel build workflow before expanding 1688 collection features.

## Current known state

- Repository: `Delightfilm/smartstore-ai-seller-os`
- Stable branch: `main`
- Existing main UI is based on `src/SmartStoreSellerOS.jsx`.
- `src/DiscoveryCollectorBridge.jsx` injects the 1688 URL test panel into the Discovery screen.
- `src/SourcingConsole.jsx` is a separate experimental route and must not replace the main UI.
- Local 1688 collection uses Playwright CDP against a dedicated logged-in browser on `127.0.0.1:9222`.
- Vite dev middleware exposes `/api/collect-1688` locally.
- This local API does not exist automatically in Vercel production.
- A normal Windows user-directory checkout successfully ran `npm install` and `npm run build` with Vite 8.2.1.
- Earlier `EPERM` build failures were caused by working under `C:\Windows\System32`, not by frontend source bundling.

## Important repository problems already identified

1. `node_modules` is heavily tracked in Git.
2. `dist/` and generated files may also be present/tracked.
3. No proper `.gitignore` existed in the initial repository state.
4. `package.json` contained `playwright-core` while the committed lockfile was stale before local `npm install` refreshed it.
5. Several dependencies use `latest`, reducing build reproducibility.
6. `vite.config.js` contains a development live-preview sync mechanism with a hardcoded Supabase URL/key-like value.
7. The 1688 local collector exists only through Vite `configureServer`, so hosted production needs a separate remote collector endpoint or an explicit unavailable state.
8. Collector mode labels are inconsistent (`LOCAL_BROWSER_COLLECTOR` vs `LOCAL_HTML_COLLECTOR`).
9. Server-side collector URL validation should be added before authenticated browser navigation.
10. `beginAmount` should not be guessed as both price and MOQ without stronger evidence.
11. The DOM/MutationObserver bridge used to inject the Discovery collector panel is fragile but should not be refactored during the repository-stabilization task.

## Next task for Codex

### Branch

Create:

`chore/repo-build-stabilization`

### Goal

Produce a clean, reproducible repository and production build without redesigning the application.

### Required work

1. Confirm current path is a normal user directory and not `C:\Windows\System32`.
2. Inspect current dirty state before modifying anything.
3. Add a root `.gitignore` covering at least:
   - `node_modules/`
   - `dist/`
   - `.vite/`
   - `.vercel/`
   - `.env`
   - `.env.*`
   - `!.env.example`
   - `.preview-sync-state.json`
   - `.1688-browser-profile/`
   - `*.log`
4. Remove generated directories from Git tracking while preserving required local files as appropriate.
5. Make `package.json` and `package-lock.json` consistent.
6. Replace broad `latest` dependency declarations with the currently working installed versions, avoiding unnecessary upgrades.
7. Verify `npm ci` works from the cleaned dependency metadata.
8. Keep the 1688 browser collector development-only.
9. Hosted production must not attempt to connect to `127.0.0.1:9222`.
10. If no production collector URL is configured, surface a clear hosted-unavailable state rather than silently calling a nonexistent local API.
11. Move/guard the live-preview sync so it is explicitly development-only and remove credential-like hardcoding from source. Record any value that should be rotated because it was already committed.
12. Fix the local collector mode-string mismatch.
13. Add server-side validation for supported 1688 product URLs before `page.goto()`.
14. Review `beginAmount` parsing and prefer `null` over an unsupported guess.
15. Add Vercel SPA fallback configuration if needed so direct `/sourcing-console` navigation/refresh works, without swallowing future `/api/*` routes.
16. Do not substantially modify `SmartStoreSellerOS.jsx` or redesign the UI.

## Required verification

Run and record results for:

```bash
npm ci
npm run build
```

Then verify the dev server can start:

```bash
npm run dev
```

If feasible on Windows, also verify the browser launcher starts:

```bash
npm run 1688:browser
```

A full live 1688 collection test may require human login/captcha and can remain marked as human-required if blocked by that dependency.

## Git handoff protocol for this task

- Do not commit generated `node_modules` or `dist` content.
- Do not merge into `main`.
- After tests, update this file with the actual outcome.
- Commit the stabilization changes on `chore/repo-build-stabilization`.
- Push that branch to GitHub so ChatGPT can review it without the user copying logs manually.

## Codex completion record

- Status: COMPLETE
- Branch: `chore/repo-build-stabilization`
- Commit: pending; replace with the implementation commit after commit creation
- Files changed: added `.gitignore`, `.env.example`, and `vercel.json`; updated dependency metadata, Vite configuration, collector client/server handling, collector UI mode detection, and this handoff; removed 6,733 `node_modules/` files from Git tracking while preserving local installation behavior.
- `npm ci`: PASS (`97` packages installed, `0` vulnerabilities). The first sandboxed attempt hit `EPERM` on the user npm cache; the normal user-context rerun passed.
- `npm run build`: PASS with Vite `8.2.1` (`1,797` modules transformed).
- `npm run dev`: PASS; Vite started at `http://127.0.0.1:5173/`. Browser checks confirmed the home login UI and direct `/sourcing-console` UI render with content and no Vite error overlay.
- `npm run 1688:browser`: PASS; Chrome launched with the dedicated profile and `http://127.0.0.1:9222/json/version` returned HTTP `200`.
- Collector checks: PASS; unsupported hosts/protocols/routes are rejected, the dev API returned HTTP `400` for an external host before browser navigation, and `beginAmount` is no longer guessed as price or MOQ.
- Production behavior: the local CDP collector plugin is registered only for Vite dev; a production build without `VITE_1688_COLLECTOR_URL` shows an explicit hosted-unavailable error. `vercel.json` rewrites only `/sourcing-console` to the SPA entry and does not catch `/api/*`.
- Security: the hardcoded preview-sync URL/key-like value was removed. Preview sync is development-only and opt-in through `PREVIEW_SYNC_URL`. The previously committed preview-sync credential-like value should be treated as exposed and rotated.
- Unresolved: a full live 1688 product collection still requires a human-authenticated 1688 session and any captcha/security verification. A production remote collector URL is not configured in this repository.
- Next action: ChatGPT should review the pushed branch diff, ensure the previously committed preview-sync credential is rotated, and decide how to provision the production collector before merge/deploy.
