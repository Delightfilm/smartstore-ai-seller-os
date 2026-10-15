# Naver Commerce Local Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 PC에서 운영자의 네이버 계정·스토어를 읽기 전용으로 확인하고, 정제된 마지막 결과를 기존 외부 Seller OS에서 조회한다.

**Architecture:** 기존 Vite 서버에 독립된 Commerce 어댑터를 추가한다. 사용자 JWT로 고정 workspace owner를 먼저 검증하고, 로컬 비밀 설정으로 token+두 GET만 호출한다. 수동 채널 결합 후 기존 보호 Edge API에 스냅샷을 저장하며 외부 Pages는 저장된 결과만 읽는다.

**Tech Stack:** 기존 Vite/React, Node node:test, bcryptjs@3.0.3, 기존 Supabase SDK 2.117.3 및 Postgres RLS.

**Spec:** `docs/superpowers/specs/2026-10-15-naver-commerce-local-read-design.md` (2026-10-15 사용자 승인).

## Global Constraints

- `codex/purchase-agency-pipeline`에서 작업하고 main에 merge하지 않는다. 기존 SmartStoreSellerOS UI/레이아웃, 1688 작업자, 다른 앱·Auth·멤버십·후보를 보존한다.
- 허용 upstream은 `https://api.commerce.naver.com`의 POST `/external/v1/oauth2/token`, GET `/external/v1/seller/account`, GET `/external/v1/seller/channels`뿐이다. redirect 금지; 임의 URL/path/method/account_id 입력 금지.
- 토큰 요청은 form-urlencoded, client_credentials, SELF, 직전 millisecond timestamp와 공식 bcrypt 서명. 토큰은 메모리만 사용한다. 상품/주문/배송/판매자 설정 변경 요청은 0건이어야 한다.
- workspace당 최소60초, single-flight, 401 재인증 최대1회, 429 자동 재시도 없음. 외부 요청20초/64KiB, 전체45초. 남은 전체 deadline을 우선한다.
- 비밀값은 ignored `.env.local`의 `NAVER_COMMERCE_CLIENT_ID`, `NAVER_COMMERCE_CLIENT_SECRET`만 사용한다. 기존 Search API 변수 재사용 및 VITE_ 비밀 변수 금지. PC에 service-role key를 복사하지 않는다.
- 로컬은 기존127.0.0.1:5173만 사용한다. 외부 Pages에 localhost/CDP/Naver 직접 호출, 새 터널·상시 작업·비용·Oracle 변경 없음.
- 최초 STOREFARM 채널은 운영자 대조 후 결합한다. 이후 예상 채널 불일치는 실패이며 기존 성공을 보존한다. 채널 번호는 십진 문자열, unsafe numeric ID는 거절한다.
- 스냅샷 source=`LOCAL_WORKER_REPORTED`; 운영자가 보고한 과거 결과이지 실시간 인증 증명이 아니다. 마지막 성공15분 경과 시 STALE. 상업적 행동 승인으로 사용하지 않는다.
- 로그인/약관/권한/키 입력/실제 IP 등록은 사람의 확인이 필요하다. 비밀값은 채팅·Git·화면·로그·클라우드에 노출하지 않는다.

## Review Focus

1. 이중 클릭·401·느린 body가 겹쳐도 전체45초와 단일 재인증을 넘지 않는다 — Task1/3.
2. 로그아웃·사용자 교체·취소 후 늦게 도착한 성공은 다음 GET/결합/게시/화면 복원에 쓰이지 않는다 — Task3/4.
3. 조작된 확인 요청·다른 스토어·정밀도 잃은 ID로 첫 채널을 자동 채택하지 않는다 — Task1/3.
4. 과거 성공 뒤 실패·저장 충돌·동기화 실패가 와도 이전 성공은 보존하고 현재 정상으로 오인시키지 않는다 — Task2/3/4.
5. 외부 탭·다른 workspace·미인증 호출은 로컬 fetch/upstream/write를 유발하지 않고, 임의 중첩 데이터/비밀값을 저장하지 않는다 — Task2/3/4.

## File map and shared contracts

- New `server/commerce/naverReader.js`: 고정 upstream, 서명·메모리 토큰·읽기/정규화만 담당.
- New `server/commerce/snapshot.js`: Edge/Node 공용의 순수 스냅샷 검증·상태 투영; Node 모듈 의존성 금지.
- New `server/cloud/commerceStore.js`: workspace 한정 조회와 revision CAS 게시. Existing `server/cloud/handler.js`, `supabase/functions/seller-os-agency/index.ts`: 보호 action 배선만 추가.
- New migration: 실행 시 `supabase migration new seller_os_commerce_connection`으로 생성된 단 하나의 `supabase/migrations/*_seller_os_commerce_connection.sql`. 임의 timestamp 파일을 미리 만들지 않는다.
- New `server/commerce/localAdapter.js`: 요청 인증·상태·결합·취소; `bindingStore.js`: ignored 로컬 결합 파일의 원자 저장. Existing `vite.config.js`: dev middleware 배선.
- Existing `src/data/workflowClient.js`, `src/auth/AuthProvider.jsx`: 얇은 클라이언트와 세션 무효화. New `src/dashboard/CommerceConnection.jsx`: 기존 설정의 네이버 행만 대체. Existing `src/SmartStoreSellerOS.jsx`, `src/PurchaseAgencyPanel.jsx`: 해당 행/안내 문구만 수정.
- Tests: `test/naverCommerceReader.test.js`, `test/commerceSnapshot.test.js`, `test/cloudWorkflow.test.js`, `test/commerceLocalAdapter.test.js`, `test/workflowClient.test.js`, `test/commerceConnection.test.js`, `test/integration/commercePermissions.test.js`. 순수 상태 테스트는 node:test, 실제 React 동작은 브라우저 검증으로 구분한다.

공통 계약(아래 이름을 모든 task에서 동일하게 사용):

```ts
type Channel = { channelNo: string, name: string, url: string }; // HTTPS, no credentials/query/fragment
type ReadResult = { channels: Channel[] }; // account 원본/UID는 검증 후 폐기
type FailureCode = 'IP_REJECTED'|'AUTH_FAILED'|'FORBIDDEN'|'RATE_LIMITED'|'TIMEOUT'|'UPSTREAM_INVALID'|'CHANNEL_MISMATCH';
type Report = { status: 'VERIFIED'|'FAILED', channel: Channel|null, errorCode: FailureCode|null };
// VERIFIED만 channel 필수; FAILED는 channel=null. 기존 성공 필드는 서버가 보존한다.
type Snapshot = { workspaceId: string, provider: 'NAVER_COMMERCE', source: 'LOCAL_WORKER_REPORTED',
  channel: Channel|null, status: 'VERIFIED'|'FAILED', errorCode: FailureCode|null,
  attemptedAt: string, succeededAt: string|null, receivedAt: string, actorId: string, revision: number };
// 날짜는 Edge 서버 수신 시각으로 생성; succeededAt은 VERIFIED 수신 시에만 갱신한다.
type LocalState = { status: 'NOT_CONFIGURED'|'UNVERIFIED'|'VERIFYING'|'CONFIRM_REQUIRED'|'VERIFIED'|'FAILED'|'SYNC_PENDING',
  attemptId: string|null, channels: Channel[], errorCode: FailureCode|null, snapshot: Snapshot|null };
```

### Task 1: Bounded read-only Naver reader

**Files:** Create `server/commerce/naverReader.js`, `test/naverCommerceReader.test.js`; Modify `package.json`, `package-lock.json`.

**Interfaces:** Consumes injected fetch/clock/AbortSignal. Produces `createCommerceReader({clientId,clientSecret,fetchImpl=fetch,now=Date.now}) -> {read({signal,deadlineAt}):Promise<ReadResult>, clear():void}` and `normalizeChannels(raw):Channel[]`. Errors expose only `{code:FailureCode}`, never raw response/request.

- [ ] **Step 1: Write failing tests.** Use local synthetic fixtures with a valid bcrypt salt and known secret/token/PII sentinels; compare the signature to independently computed official bcrypt+base64 procedure, not to production function output.

```js
// Named test assertions; request capture/fake-clock fixture is local to this test file.
// 'SELF form signature and fixed read allowlist'
assert.equal(form.get('grant_type'), 'client_credentials'); assert.equal(form.get('type'), 'SELF');
assert.equal(form.get('client_secret_sign'), expectedSignature);
assert.deepEqual(calls.map(x => [x.method, new URL(x.url).pathname]), [
 ['POST','/external/v1/oauth2/token'],['GET','/external/v1/seller/account'],['GET','/external/v1/seller/channels']]);
// 'bounded cache retries and cancellation': table-driven subtests
assert.equal(tokenCallsBeforeExpiry, 1); assert.equal(totalReauthAfter401, 1);
assert.equal(retriesAfter429, 0); assert.ok(elapsedMs <= 45000); assert.equal(bodyLimitBytes, 65536);
// 'unsafe IDs malformed payload redirects and secrets are rejected'
assert.throws(() => normalizeChannels([{channelNo:9007199254740992}]), /UPSTREAM_INVALID/);
assert.equal(serializedPublicResult.includes(secretSentinel), false);
```

- [ ] **Step 2:** Run `node --test test/naverCommerceReader.test.js`; expect FAIL missing module. Cover chunked/absent Content-Length, body timeout, 3xx, unsafe IDs, duplicate/conflicting channel IDs, bad account/channel shapes, abort between GETs and token expiry with injected clock.
- [ ] **Step 3:** Install exact `bcryptjs@3.0.3` (retain other dependency pins); implement Interfaces. Use `redirect:'error'`, streamed byte count, deadline-linked abort, 60-second early token expiry (short lifetime: half lifetime), one retry budget shared by whole read. `clear()` invalidates token; caller owns workspace throttle. Validate official response schemas from spec links before coding normalization; never infer unknown fields as success.
- [ ] **Step 4:** Run targeted command then `npm test`; expect all non-optional tests PASS, only explicitly missing live credentials may SKIP. Inspect captured calls for zero commercial requests and sentinel leaks.
- [ ] **Step 5:** `git add server/commerce/naverReader.js test/naverCommerceReader.test.js package.json package-lock.json` then `git commit -m "feat: add bounded read-only Naver Commerce client"`.

### Task 2: Protected cloud snapshot and real permission boundary

**Files:** Create `server/commerce/snapshot.js`, `server/cloud/commerceStore.js`, generated migration, `test/commerceSnapshot.test.js`, `test/integration/commercePermissions.test.js`; Modify `server/cloud/handler.js`, `supabase/functions/seller-os-agency/index.ts`, `test/cloudWorkflow.test.js`.

**Interfaces:** Produces `validateCommerceReport(value):Report`, `projectCommerceStatus(snapshot,nowMs):string`, `createCommerceStore({client,writer,workspaceId,actorId})->{read():Promise<Snapshot|null>,publish({expectedRevision,report}):Promise<Snapshot>}`. Add `commerceFor(identity)` to `createAgencyHandler`. Exact actions: `{action:'commerceRead',workspaceId}` returning `{actorId,snapshot}` with actorId from authenticated identity, and `{action:'commercePublish',workspaceId,expectedRevision,report}` returning Snapshot; unknown top-level/nested fields rejected. `expectedRevision=0` means no row. Conflict returns409 `COMMERCE_REVISION_CONFLICT`.

- [ ] **Step 1: Write failing tests** against the exact handler/store contracts and pure functions.

```js
// 'commerce owner gating strict shape and revision CAS'
assert.equal(unauthorized.status, 401); assert.equal(otherWorkspace.status, 403);
assert.equal(unknownNestedField.status, 400); assert.equal(stalePublish.status, 409);
assert.equal(anonymousWriteCount, 0); assert.equal(afterFailure.succeededAt, beforeSuccess.succeededAt);
assert.deepEqual(afterFailure.channel, beforeSuccess.channel); assert.equal(afterFailure.status, 'FAILED');
// 'failed beats stale and old success never claims live'
assert.equal(projectCommerceStatus(verified, Date.parse(verified.succeededAt)+900001), 'STALE');
assert.equal(projectCommerceStatus(failedWithOldSuccess, now), 'FAILED');
```

- [ ] **Step 2:** Run `node --test test/commerceSnapshot.test.js test/cloudWorkflow.test.js`; expect missing-module/action FAIL. Include client-supplied actor/date/revision/source injection, null/invalid success channel, unsafe revision, untrusted URL, error-text/PII fields and oversized input.
- [ ] **Step 3:** Implement Interfaces and migration. Table `public.seller_os_commerce_connections` has workspace PK/FK, strictly constrained snapshot fields, RLS owner-select using existing membership, explicit SELECT grant only to authenticated, no anon/table direct write grants. Atomic RPC `public.seller_os_publish_commerce_connection(p_workspace_id uuid,p_actor_id uuid,p_expected_revision bigint,p_report jsonb)` is SECURITY INVOKER, executable by service_role only, with public/anon/authenticated revoked; lock workspace row for first-insert races, CAS revision, server timestamps. Edge uses existing writer only after getUser+owner check. No raw JSON persistence. Keep current CORS allowlist/JWT unchanged. Read Supabase skill and CLI `--help` before generating/applying migration; inspect actual API exposure/grants first.
- [ ] **Step 4:** Run targeted tests and `npm test`. Before deployment, record migration diff/advisor results, other functions' versions/hashes and existing6candidate revisions/states. Apply only Seller OS migration + function; verify deployed source manifest. Run `node --test test/integration/commercePermissions.test.js` with human-established test sessions supplied securely, never browser token extraction: anonymous denied; different workspace/nonowner denied; owner read succeeds; owner direct INSERT/UPDATE/DELETE and RPC denied; Edge valid publish/CAS works. Missing sessions means explicit incomplete acceptance, not success. Preserve other functions/data; no shared Auth changes.
- [ ] **Step 5:** Stage only task files plus the exact generated migration (`git add -- <resolved-migration-path>`), update HANDOFF with actual cloud results; `git commit -m "feat: add owner-scoped Commerce connection snapshots"`.

### Task 3: Authenticated local adapter and manual channel binding

**Files:** Create `server/commerce/localAdapter.js`, `server/commerce/bindingStore.js`, `test/commerceLocalAdapter.test.js`; Modify `vite.config.js`.

**Interfaces:** Consumes Task1 reader, Task2 cloud actions using public Supabase config and caller JWT. Produces `commerceLocalPlugin({workspaceId,clientId,clientSecret,supabaseUrl,publishableKey})`; testable `createCommerceLocalHandler({workspaceId,reader,authorizeOwner,cloud,bindings,now,randomUUID}) -> (req,res)=>Promise<void>`; `createBindingStore({path,workspaceId})->{read():Promise<Channel|null>,write(channel):Promise<void>}`. `authorizeOwner({authorization,workspaceId})` invokes protected commerceRead and maps authenticated actorId to `{userId,snapshot}`, not JWT decoding. `cloud.read({authorization,signal})` returns Task2 envelope and `cloud.publish({authorization,signal,expectedRevision,report})` returns Snapshot, always using the fixed configured workspace.

Local endpoint `POST /api/commerce-local`, exact bodies `{action:'status'|'verify'|'cancel',workspaceId}` or `{action:'confirm',workspaceId,attemptId,channelNo}`. Bearer mandatory for all; origin exactly `http://127.0.0.1:5173` or `http://localhost:5173`, Host must match that origin at port5173. Unknown fields/invalid JSON/>64KiB rejected. Response is LocalState, with no credentials/IP/raw account.

- [ ] **Step 1: Write failing tests.** Stub reader/cloud counters; pending results live in handler memory, not supplied by tests through a public endpoint.

```js
// 'authorization origin host and workspace gate every upstream call'
assert.equal(upstreamCallsBeforeOwner, 0); assert.equal(foreignOrigin.status, 403);
// 'first channel requires fresh server-held confirmation'
assert.equal(first.status, 'CONFIRM_REQUIRED'); assert.equal(publishesBeforeConfirm, 0);
assert.equal(forgedAttempt.status, 409); assert.equal(expiredAttempt.status, 409);
assert.equal(mismatchedBoundChannel.status, 'FAILED'); assert.equal(bindingWritesOnMismatch, 0);
// 'single flight throttle epoch and sync conflict'
assert.equal(concurrentReaderCalls, 1); assert.equal(tooSoon.status, 429);
assert.equal(additionalGetsAfterCancel, 0); assert.equal(publishesAfterLogout, 0);
assert.equal(cloudSaveFailure.status, 'SYNC_PENDING'); assert.equal(revisionConflictRetries, 0);
```

- [ ] **Step 2:** Run `node --test test/commerceLocalAdapter.test.js`; expect FAIL missing module. Also test logout/relogin user switch during token/GET/confirm/publish, pending expiry at5minutes, malformed/multiple channel choices, cancellation, binding file tampering and interrupted atomic write.
- [ ] **Step 3:** Implement Interfaces. Vite reads two server env names only in serve mode; fixed workspace is existing public workspace config, never request-selected. Binding path ignored `.seller-os/commerce-binding.json`, content `{workspaceId,channel}`, validate on read, temp+rename atomic save. Hold pending attempt UUID, userId, channels, completedAt, epoch in memory max5minutes. Confirm must match same owner/epoch/attempt and selected returned channel; explicit UI confirmation only. For bound reads require exactly the expected STOREFARM channel; no automatic rebinding. Per workspace verify single-flight and60s since start; client abort/cancel/user change invalidates epoch, aborts reader and prohibits further publication. Clear token/pending state on cancellation. Before cloud publish recheck epoch; abort fetch and discard response on cancel. A cloud write already committed before cancellation cannot be undone: preserve server record/time, never claim rollback. On failure publish only sanitized failure when authenticated, active and bound; retain previous success. No automatic conflict retry or timed rechecks. Thread overall45s deadline through authorization, Naver and publication.
- [ ] **Step 4:** Run targeted tests and `npm test`; missing env gives NOT_CONFIGURED/upstream0. Verify cloud-only Pages build contains no local secrets. Existing 1688 worker behavior/tests unchanged.
- [ ] **Step 5:** `git add server/commerce/localAdapter.js server/commerce/bindingStore.js test/commerceLocalAdapter.test.js vite.config.js` then `git commit -m "feat: add local Commerce verification and manual channel binding"`.

### Task 4: Existing settings UI with honest local/external state

**Files:** Modify `src/data/workflowClient.js`, `src/auth/AuthProvider.jsx`, `src/SmartStoreSellerOS.jsx`, `src/PurchaseAgencyPanel.jsx`, `test/workflowClient.test.js`; Create `src/dashboard/CommerceConnection.jsx`, `test/commerceConnection.test.js`.

**Interfaces:** Add `workflowClient.commerceRead():Promise<{actorId:string,snapshot:Snapshot|null}>` and `commerceLocal(action:'status'|'verify'|'cancel'|'confirm',confirmation?:{attemptId:string,channelNo:string}):Promise<LocalState>`. Local origin+DEV guard runs before token acquisition/fetch. `CommerceConnection` consumes current AuthProvider client/session and Task2 `projectCommerceStatus`; local runtime only `import.meta.env.DEV && exactLocalOrigin`. Use existing client generation invalidation for all new requests.

- [ ] **Step 1: Write failing tests** with fake fetch and session generation; pure state assertions use Task2 projection, component interaction is later real-browser QA.

```js
// 'external commerce read never fetches local PC'
assert.equal(localFetchesOnPages, 0); assert.equal(tokenRequestsForRejectedLocalAction, 0);
// 'logout and user change discard late commerce results'
assert.equal(lateResultAccepted, false); assert.equal(newUserSeesOldSnapshot, false);
// 'pending and failure do not masquerade as current verified'
assert.equal(projectCommerceStatus(null, now), 'UNVERIFIED');
assert.equal(projectCommerceStatus(oldVerified, now), 'STALE');
assert.equal(projectCommerceStatus(latestFailed, now), 'FAILED');
```

- [ ] **Step 2:** Run `node --test test/workflowClient.test.js test/commerceConnection.test.js`; expect missing method/module FAIL. Cover default applicationOrigin, malformed confirmation, cloud timeout, refresh after failed publish and hidden local controls in production build.
- [ ] **Step 3:** Implement Interfaces, preserve all other API rows/tabs/layout. Replace only mocked Naver key/status with channel name/URL, last attempt/success/received times, LOCAL_WORKER_REPORTED label and sanitized status. Local button 인증·조회 확인 plus explicit channel confirmation; external only 저장 결과 새로고침 and PC 상태 확인 불가. No secret inputs or fake key suffix. NOT_CONFIGURED/CONFIRM_REQUIRED/SYNC_PENDING distinct locally; external cannot know unsent failures. Update mock disclaimer for remaining demo rows. Update sourcing notice to separate user-reported store approval from unverified Commerce state; registration remains unavailable. AuthProvider on logout/user switch cancels local epoch (before token/session disposal), invalidates pending client results and clears state; never request local cancellation from external pages. Reuse existing auth/session subscription, no new login settings or background polling.
- [ ] **Step 4:** Run targeted tests then `npm test`; run isolated clean `npm ci` in a new ignored task directory without deleting/reinstalling active node_modules, then `npm run build` there and `git diff --check` in checkout. Scan resulting bundle with synthetic secret/token sentinels; no matches. Start/reuse only existing local dev server. Browser-test local missing config/confirm/failure/stale/logout and external read-only controls; existing dashboard navigation/candidates remain intact. Distinguish mocked checks from real connection acceptance.
- [ ] **Step 5:** Stage only listed files, update HANDOFF actual verification; `git commit -m "feat: show Commerce connection status in existing settings"`.

### Task 5: Human setup and end-to-end release acceptance

**Files:** Create `docs/naver-commerce-local-runbook.md`; Modify `HANDOFF.md`. Implementation repair, if needed, belongs to its owning task with failing regression test first.

**Interfaces:** Consumes Tasks1–4, existing human browser sessions, approved Seller OS-only deployment workflow. Produces a factual runbook and evidence for every gate; no additional API/product features.

- [ ] **Step 1: Write the acceptance checklist before real calls.** Initial state must be FAIL/NOT RUN, not assumed PASS: `token+account+channels===PASS`, `manualBinding===PASS`, `cloudReadAfterReload===PASS`, `externalLocalRequests===0`, `commercialRequests===0`, `existingCandidateRevisionsUnchanged===true`. Use synthetic fixtures for failures, never trigger seller writes to test their rejection.
- [ ] **Step 2:** Confirm absent app/credentials makes real acceptance NOT RUN. Read current official docs linked in spec and verify token signature/IP/scope contracts again before account setup. Record dependency audit findings; do not perform unrelated dependency upgrades.
- [ ] **Step 3:** Open API Center for human final app creation, seller-information-only scope/terms confirmation. Determine actual PC outbound publicIPv4 with permission, show actual value to human and have them confirm registration; no Pages/DB/temporary Edge IP substitution. Human inputs keys directly into ignored `.env.local`, never screenshots/chat. Reuse/restart only owned Vite server after checking its process. Perform explicit local verify, human comparison and channel confirm. No bypass when login/captcha/permission/billing blocks; show relevant window and report gate. No public secret editor.
- [ ] **Step 4:** Verify actual token+twoGET, local binding, cloud record/read/CAS and full reload; inspect sanitized request-path counters only, never Authorization/raw payload. Deploy verified Edge manifest (if not yet) and built dist to existing separate Pages project, not another app. Human external login → snapshot read → full reload must preserve same workspace/channel/revision/time and show no localhost calls. Recheck existing6candidate revisions/HOLD/NOT_PUBLISHED, other functions' identities and Auth unchanged. Run `npm test`, isolated ci/build, `git diff --check`; optional live permission checks remain incomplete until actually exercised. Record applied scope, actual tests, incomplete items, residual PC/IP/stale risks and rollback: stop local adapter/remove local secret configuration, restore prior verified frontend/Edge; retain table/history, no Auth/data resets. Human handles key revocation if needed.
- [ ] **Step 5:** `git add docs/naver-commerce-local-runbook.md HANDOFF.md` then `git commit -m "docs: record Commerce setup and live verification"`; push `git push origin codex/purchase-agency-pipeline`, verify HEAD matches remote and clean status. No main merge. Report separately local implementation, cloud deployment and real authenticated acceptance; if any human gate remains, identify it without claiming connected.

## Plan self-review — 2026-10-15

- Spec coverage: read allowlist/crypto/bounds Task1; RLS/minimized snapshot/conflict Task2; owner/local/binding/epoch Task3; preserved UI/honest states Task4; real credentials/IP/release/rollback Task5.
- Contract review: same Channel/Report/Snapshot and action names throughout; commerceRead authenticated actor envelope is explicitly shared between Tasks2–4. All five Review Focus items have named tests.
- Scope review: no new research queue, remote control, paid hosting, commercial endpoints or Auth migration. Tasks remain gated by human credentials/permissions; tests alone cannot certify a live connection.
- Execution update: user approved Native. Tasks1–4 local implementation and reviewed cloud/Pages deployment are complete at their documented verification boundary; Task5 actual Naver credentials/manual channel/live save-reload and some supplied-JWT checks remain pending. User is away from PC; do not demand immediate login. See HANDOFF and runbook for consolidated human steps, review fixes, actual tests and limitations.
