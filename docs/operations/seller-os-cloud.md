# Seller OS authenticated storage

The existing dashboard now uses the dedicated Seller OS area in shared project
`dzgczkwwezzsfqnjdqen`. The workspace is `ccb5017e-7c70-414d-b103-38e17e48e799`.
The frontend runs locally; its backend is the new **seller-os-agency** Supabase
Edge Function. Existing functions and other apps are untouched.

## Configuration and login

Set the four public values shown in `.env.example` in an ignored `.env.local`:
`VITE_WORKFLOW_MODE=cloud`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SELLER_OS_WORKSPACE_ID`.
Use only the modern publishable key. No server secret belongs in local client
configuration. Vite rejects VITE secret/service-role fields before building.
Explicit `local` mode remains development-only; missing configuration shows an
error rather than silently selecting local storage.

Run `npm ci`, `npm run dev`. Password login and existing-account email sign-in
are available. Auth storage is named `seller-os-auth-v1` to avoid overwriting
other apps' browser sessions. Email sign-in sets `shouldCreateUser:false`.
The shared project's email template currently sends a Sign-in link and defaults
to localhost:3000. Copy that link address into the dashboard's credential input;
the app exchanges its hash against this project's Auth API. It does not navigate
to the link's redirect URL. Shared Auth templates and redirect settings are unchanged.
Do not put passwords, tokens or login links in chat, logs, Git or backup files.

## Request path

The browser sends its user JWT and publishable key to
`https://dzgczkwwezzsfqnjdqen.supabase.co/functions/v1/seller-os-agency`.
The gateway checks JWTs (`verify_jwt=true`). The handler also uses `getUser()`
and checks the user's workspace membership through an RLS-scoped client.
Only list, event history, validated update and preparation export are exposed.
Search/collect/market return COLLECTOR_UNAVAILABLE until the worker is connected.
There is no publish, shipment or payment action.

Writes use runtime-provided server credentials and fixed Seller OS RPCs.
Candidate validation is shared with the local API. Raw HTTP request identity is
stored atomically with the resulting candidate and audit event. A manual retry
after an uncertain transport failure keeps the request ID; automatic retries
are not performed. Different bodies cannot reuse an ID. A concurrent identical
request can replay its committed result even if the candidate revision changed.
Session changes invalidate pending responses. Newer panel records supersede
delayed initial dashboard reads.

Allowed frontend origins currently are only localhost/127.0.0.1 on port 5173.
A future hosted frontend needs an explicitly configured origin and deployment
verification. The Edge runtime has a shared-project service credential; the
application restricts its use to Seller OS objects, but this is not a separately
privileged database role or physical project isolation.

## Verification

- `npm test`: local behavior tests; live integration tests are skipped by default.
- `npm run build`: static application build.
- `node --env-file=.env.local scripts/seller-os-smoke.mjs`: real anonymous/forged
  JWT denial and CORS preflight.
- `SELLER_OS_LIVE_TEST=1` plus `node --env-file=.env.local --test
  test/integration/cloudPermissions.test.js`: opt-in HTTP checks. The user-JWT
  check additionally needs `SELLER_OS_TEST_TOKEN` supplied privately; never commit it.
- `test/sql/seller-os-area.sql` and `seller-os-http-replay.sql`: real database
  permission/transaction assertions, using rollback-only fixtures. SQL role
  simulation is not another user's real JWT or a second-device test.

P2013 was migrated from local revision 7 to cloud revision 1. Four UI verification
writes produced cloud revision 5 and five audit events in total. Final state is
HOLD, original reasons/note, KRW 14,900 scenario, NOT_PUBLISHED. Cloud timestamps
and revision represent cloud history; the dated observation remains unchanged.

## Backup and recovery

`node scripts/seller-os-data.mjs backup WORKSPACE OFFER_ID` preserves the full
original local file and creates a checksum-verified business-data snapshot under
ignored `.seller-os/backups/`. The import dry-run compares canonical offer IDs
and ignores JSON property order; identical records skip and differing user edits
conflict. It never overwrites the source file.

For this transfer, backups are:

- `.seller-os/backups/2026-10-13T05-28-08-705Z-local-original.json`
- `.seller-os/backups/2026-10-13T05-28-08-705Z-816692570613.json`

Snapshot SHA256: `40e669abcc252409c3cbcea88be32927150baa974315c4fbe6e42d88549a92c3`.
Restoring its six business fields to an isolated workspace inside a rolled-back
transaction reproduced the source data, HOLD and NOT_PUBLISHED exactly. This is
a business-data restore check, not full Auth/storage disaster recovery or a
scheduled cloud backup. Automated backup scheduling is not configured.

## Rollback

Revert the source commit to undo the application changes. Cloud migrations/data
are not reverted by Git. To disconnect locally, select explicit development
local mode in the ignored environment and restart Vite; the original candidate
file is preserved. If the new API needs to be disabled, restrict only
seller-os-agency / Seller OS RPC grants after confirming scope. Export its data
before any database removal. Never reset the shared project, replace Auth
configuration, delete other functions or drop tables with CASCADE.

The additional migration was CLI-created as 20261013052419, then renamed to the
actual MCP-applied version `20261013052512_seller_os_http_replay.sql`.
Do not blindly push this repository's partial migration history to the shared
project. See `supabase/README.md` for the initial area's boundaries.
