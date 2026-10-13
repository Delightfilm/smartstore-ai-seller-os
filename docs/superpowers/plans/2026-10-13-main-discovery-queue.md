# Main discovery queue integration

> Use executing-plans inline, TDD and one fresh whole-change final review. This is the implementation record for the existing approved foundation/research design and the user's exact main-button integration request, not a new architecture approval.

Goal: retain the main UI while its discovery button enqueues actual research, displays saved candidates/progress below, and survives reload through authenticated server reads.
Spec: ../specs/2026-10-13-seller-os-operating-foundation-design.md; latest user request narrows this checkpoint to UI/queue integration only.
Architecture: one shared foreground research controller/provider serves both existing research panel and main discovery. Existing authenticated queue/store/API unchanged. No credentials, migrations, dependencies, listing or shipping endpoints added.

## Constraints and review focus

Preserve main layout and separate experimental route; reuse current clean dedicated task branch. Keep full all-SKU gate and P2013 HOLD. Do not manufacture recommendations, scores, funnel totals or profits. Handle duplicate clicks, uncertain writes, failed/offline/human states, stale polling, logout/unmount, stored edits and excluded results. Show scoped job counts, not full sales-pipeline progress. Source policy-denied pages must not be revisited or bypassed.

### Task 1: Shared queue/controller and factual views

- Write failing tests for actual search enqueue, overlapping start suppression, immutable queued input, unknown-response retry identity through existing client, candidate revision merge, disposed/delayed reads, explicit failure/human/offline progress and genuine stored candidate mapping/filter/sort.
- Run `node --test test/mainDiscovery.test.js`: expect RED; implement `src/dashboard/{discoveryController,discoveryView}.js` and shared `ResearchProvider.jsx`. Run focused suite then `npm test`: expect PASS, optional live skips explicit.
- Reuse provider from main and existing research panel; only one polling/renewal loop. Poll actual research/candidate reads without replacing newer revisions or dirty review drafts.

### Task 2: Main UI and actual server verification

- Replace cloud-disabled demo top button with shared-controller search enqueue. Reuse existing first search field with explicit source-keyword label, real candidate status/sort, disabled unavailable score controls. Show scoped actual job progress and saved read-only candidate cards in existing results region; open existing review panel for details without changing saved status.
- Exercise real browser button → authenticated job → worker → server result, show excluded job versus saved candidate distinctly. Reload and re-read same job and P2013, verify new candidate writes only if genuinely eligible; never persist fabricated fixture commodity.
- `npm ci` in isolated ignored manifest-copy path (preserve running dev/browser), `npm test`, `npm run build`, `git diff --check`: expect PASS. Record exact failures and results in HANDOFF, one fresh reviewer/fix pass, commit/push task branch, no main merge.

## Actual execution extension

Live testing exposed a previously hidden completion rejection for32SKUoffer837297724548: compact normalized62,615bytes versus estimated PostgreSQL jsonb separator representation67,434bytes exceeds the existing65,536byte RPC limit. A rejected completion previously left RUNNING until lease replacement. Small in-scope correction: conservative normalized-size check before RPC and an explicit400-rejected completion becomes an audited failed job; no truncation, schema enlargement or gate relaxation. `server/cloud/researchJobs.js`, `server/researchWorker.js`, existing job-view error label and two RED→GREEN regressions cover this correction.

Bounded-source limitation remains: some complete-looking large SKU sets cannot fit the current job payload and must remain failed/excluded until a separately scoped chunked-evidence design is implemented. This checkpoint does not implement that design.
