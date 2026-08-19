# AGENTS.md

## Purpose

This repository is the shared working source of truth for the DelightFilm SmartStore AI Seller OS project.

ChatGPT and Codex should coordinate through GitHub instead of requiring the user to manually copy long status reports between them.

## Roles

### ChatGPT
- Acts as CTO / architecture reviewer / GitHub and deployment coordinator.
- Reviews repository state, diffs, PRs, deployment failures, and architecture decisions.
- May prepare or edit repository documentation and low-risk coordination files directly.
- Uses `HANDOFF.md` as the current project handoff record.

### Codex
- Acts as the local implementation and verification engineer.
- Works in the user's currently opened local Git repository.
- Runs Windows-local commands, builds, dev server tests, and the 1688 browser/CDP workflow.
- Reads this file and `HANDOFF.md` before beginning work.
- Updates `HANDOFF.md` with factual results before handing work back.

### User
- Handles actions that require a human session or judgment, such as 1688 login/captcha, visual acceptance, credentials, billing, or explicit production approval.
- Should not need to relay routine technical context between ChatGPT and Codex.

## Source of truth

1. GitHub repository: `Delightfilm/smartstore-ai-seller-os`
2. `main` is the stable integration branch.
3. Work should normally occur on a dedicated branch and be pushed for review.
4. `HANDOFF.md` contains the latest task, known state, test results, and next action.
5. If conversation text conflicts with current repository code, inspect the code and report the discrepancy before changing behavior.

## Product invariants

- Preserve the existing `SmartStoreSellerOS.jsx` main UI and overall layout.
- Do not replace the main UI with `SourcingConsole.jsx`.
- `/sourcing-console` remains an experimental/separate route unless explicitly changed.
- Avoid large UI rewrites unless explicitly requested.
- The current 1688 browser collector is a development-only collector based on a logged-in local Chrome/Edge CDP session at `127.0.0.1:9222`.
- Do not attempt to make Vercel connect to the user's local Chrome.
- Production should use a replaceable remote collector interface such as `VITE_1688_COLLECTOR_URL`, or clearly report that the collector is unavailable.
- Raw 1688 data should eventually be normalized before entering Seller OS domain logic.

## Security rules

- Never add secrets, tokens, cookies, browser profiles, or credentials to Git.
- Do not hardcode new credentials in source files.
- Treat any previously committed credential-like value as potentially exposed and flag it for rotation.
- Server-side collector endpoints must validate supported 1688 URLs independently of client validation.
- Do not allow arbitrary authenticated-browser navigation from unvalidated API input.

## Repository hygiene

The repository currently requires cleanup. The intended end state is:

- `node_modules/` is ignored and not tracked.
- `dist/` is ignored and not tracked.
- `.vite/`, `.vercel/`, local browser profiles, logs, and local env files are ignored.
- `package.json` and `package-lock.json` are consistent.
- Dependencies are reproducible rather than relying broadly on `latest`.
- `npm ci` succeeds from a clean checkout.
- `npm run build` succeeds from a normal user directory.

## Codex workflow

At the start of a task:

1. Read `AGENTS.md`.
2. Read `HANDOFF.md`.
3. Run:
   - `pwd`
   - `git status`
   - `git branch --show-current`
   - `git remote -v`
   - `git log --oneline -5`
4. Confirm the repository is not under `C:\Windows\System32`.
5. Do not overwrite unrelated local user changes.

For implementation work:

1. Create or reuse the task branch named in `HANDOFF.md`.
2. Make the smallest coherent change that satisfies the task.
3. Run the requested verification commands.
4. Update `HANDOFF.md` with actual results, not assumptions.
5. Commit the task branch when tests pass.
6. Push the task branch to GitHub unless `HANDOFF.md` explicitly says not to push.
7. Do not merge into `main` unless explicitly instructed.

If a test fails:

- Record the exact failing command and error in `HANDOFF.md`.
- Do not claim success.
- Avoid unrelated refactors while diagnosing the failure.

## ChatGPT workflow

When continuing work from Codex:

1. Read the current GitHub branch/PR and `HANDOFF.md`.
2. Review the diff and test evidence.
3. Decide whether to request another Codex iteration, make a targeted GitHub-side change, or merge/deploy when authorized.
4. Update `HANDOFF.md` when the project-level next action changes materially.

## Required verification baseline

For repository/build changes, prefer:

```bash
npm ci
npm run build
```

For local UI checks:

```bash
npm run dev
```

For the Windows-local 1688 browser collector, when applicable:

```bash
npm run 1688:browser
```

Human login/security verification may still be required in the dedicated browser.

## Handoff format

Every substantive Codex handoff should update `HANDOFF.md` with:

- branch
- commit (if any)
- files changed
- commands run
- pass/fail results
- unresolved issues
- exact next recommended action

Keep the handoff concise and factual.