# Seller OS area in a shared project

Target approved by the user: project `dzgczkwwezzsfqnjdqen` in DF-AUTOSYNC.
This directory contains **only Seller OS additions**, not the whole project's schema.
Never use `db reset`, blanket `db push`, or whole-project schema replacement against it.
Do not change other apps, shared Auth settings, storage, project keys or billing.

## Applied objects

- `public.seller_os_workspaces`
- `public.seller_os_workspace_members`
- `public.seller_os_candidates`
- `public.seller_os_candidate_events`
- `seller_os_private.write_requests`
- `public.seller_os_save_candidate(uuid,uuid,uuid,text,integer,jsonb)`

All tables have RLS. Authenticated users may SELECT only their memberships and
workspace records. They have no direct write grants or write-RPC EXECUTE grant.
Anonymous access is denied. Only the trusted server role can execute the atomic
write function, which rechecks the actor's workspace membership and enforces
revision, request replay, audit-event and NOT_PUBLISHED invariants.

The function is SECURITY INVOKER, with an empty search_path. It is a storage
boundary, **not** the complete domain review validator. The future server API must
validate JWTs and candidate edits before invoking it; never expose a service key
to the browser. No HTTP handler is deployed or frontend connected at this checkpoint.

The shared project's administrators/service-role credentials can still access
all these records. Compute, Auth and quotas are shared; table prefixes and RLS are
not physical/project-level isolation. Existing `seller-os-preview-sync` is untouched;
its hardcoded URL access key needs a separate rotation decision before reuse.

## Migration and live verification

Official CLI `supabase@2.120.0 migration new seller_os_isolated_area` generated
`20261013050122_seller_os_isolated_area.sql` locally. The Supabase MCP
applied that exact SQL once under name `seller_os_isolated_area`, remote migration
version **20261013050448**. The local file was then renamed to the **actual remote
version** (`migrations/20261013050448_seller_os_isolated_area.sql`) without changing
its SQL, so the checked-in migration identity matches the applied record.
Do not blindly replay the file or reconcile the whole shared migration history.
Future changes must be new, Seller OS-scoped forward migrations; never edit an
already-applied migration to represent a fix.

Workspace `ccb5017e-7c70-414d-b103-38e17e48e799` (Seller OS) was bootstrapped
separately with the user-confirmed, already email-verified Auth account as its
single owner. Account IDs, email addresses and credentials are not embedded in
the migration. No Auth user was created or altered. Candidate data is still local.

Run `test/sql/seller-os-area.sql` through an authorized SQL connection to this
project. It inserts only test workspace fixtures and rolls everything back. It
requires at least one existing Auth user, without modifying that user. Never use
this SQL-role simulation as proof of real JWT/HTTP or cross-device verification.
The test covers member/nonmember/anonymous reads, direct-write and self-enrolment
denial, restricted RPC execution, revision conflict, request replay/mismatch,
unsupported publication/review status and event/request atomicity. It is not
included in `npm test`; run and record it separately.

## Rollback and residual risk

Source rollback is a reviewed revert commit; it **does not roll back the cloud DB**.
For an incident, first disable the new application's entry point (none is currently
deployed). A DBA can revoke only the Seller OS SELECT/RPC grants and remove only
its workspace memberships after approval. Export Seller OS records before any
data removal. No DROP/CASCADE or deletion procedure is executed automatically.

Pre-existing project advisor warnings were observed, not repaired: public-callable
DF dev SECURITY DEFINER functions and disabled leaked-password protection. These
remain shared-project risks, not findings introduced by this migration. See the
[Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
and [password security guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
