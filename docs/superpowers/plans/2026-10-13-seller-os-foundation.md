# Seller OS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 UI에서 인증된 사용자만 전용 클라우드 후보/이력을 저장·조회하고 기존 자료를 안전하게 이전/백업한다.
**Architecture:** React → 사용자 JWT를 검증하는 Node 준비 전용 API → 전용 Supabase DB. 사용자 RLS는 workspace별 읽기만, 변경은 검증된 서버와 원자적 DB 함수만 허용한다. 기존 로컬 모드는 명시적 개발 모드로 보존한다.
**Tech Stack:** 기존 React/Vite/Node test, Supabase Auth/Postgres, 버전을 확인·고정한 supabase-js.
**Spec:** ../specs/2026-10-13-seller-os-operating-foundation-design.md

## Global Constraints

- 2026-10-13 사용자 변경 승인: 기존 DF-AUTOSYNC의 `dzgczkwwezzsfqnjdqen` 프로젝트 안에 Seller OS 전용 영역만 추가한다. `public.seller_os_*` 테이블 및 `seller_os_private` 스키마로 이름/권한을 분리한다. 다른 앱의 테이블·함수·Auth 설정·스토리지·과금은 변경하지 않는다. 새 Seller OS 조직은 빈 상태로 보존한다.
- 아래 Task 1의 신규 프로젝트 생성 단계는 이 승인으로 대체된다. Task 2의 '신규 프로젝트'는 위 프로젝트의 신규 Seller OS 영역만을 뜻한다. 공용 Auth 사용자 중 사용자가 확인한 운영 계정만 Seller OS workspace에 연결하며, 다른 앱의 멤버를 자동으로 포함하지 않는다.
- 비용 발생 사전 승인, 공개 회원가입/익명 운영 접근 금지, 비밀키/쿠키/프로필 Git 및 클라이언트 노출 금지.
- SmartStoreSellerOS 메인 UI/레이아웃과 /sourcing-console 유지. mock 로그인으로 클라우드 기능 접근 금지.
- P2013 HOLD 및 로컬 원본 유지. publication=NOT_PUBLISHED 고정. main 병합/배포/결제/실제 등록·배송 없음.

## Review Focus

- 유효 JWT라도 비멤버 또는 다른 workspace이면 읽기/쓰기 거부 → Task 2.
- 저장은 성공했지만 응답이 유실된 경우 동일 requestId 재시도가 중복 이벤트를 만들지 않음 → Task 2.
- 로그인 전환/로그아웃 중 늦게 도착한 응답이 이전 사용자의 데이터를 화면에 복원하지 않음 → Task 3.
- 동일 offerId의 수집 경로/표시 source가 달라도 로컬 자료 이전은 중복 후보를 만들지 않음 → Task 4.
- 백업 해시가 다르거나 workspace가 다른 복구 요청은 원본 DB에 쓰기 전에 거부 → Task 4.

## File Structure / Contracts

- `src/data/workflowClient.js`: 클라이언트 저장/조회와 명시적 local/cloud 모드. `src/auth/AuthProvider.jsx`: 세션 수명.
- `server/cloud/{auth.js,workflowStore.js,handler.js}`: JWT/멤버 검증, DB 어댑터, 요청 처리. `api/agency.js`: 배포 준비용 Node HTTP 진입점(배포는 별도).
- `server/candidateUpdate.js`: 기존 update 검증의 공유 순수 함수. `server/agencyWorkflow.js`: sync/async store를 await하는 공통 서비스.
- `supabase/`: CLI로 초기화한 신규 전용 스키마/마이그레이션. 마이그레이션 이름은 CLI로 생성하며 임의 타임스탬프 파일 생성 금지.
- 공통 `Candidate`: 기존 id=offerId 문자열, revision/product/terms/market/research/review/listing/publication 보존. source 중복키는 수집 방식 이름이 아닌 canonical source `1688`.
- `Store`: `list(): Promise<Candidate[]>`, `get(id): Promise<Candidate>`, `create(product,initial): Promise<Candidate>`, `update(id,revision,patch): Promise<Candidate>`. 로컬 store는 동기 반환을 유지해도 호출자가 await한다.
- `createCloudStore({client,workspaceId,actorId,requestId}): Store`; actorId는 서버 검증 결과로만 전달. DB 원자적 함수는 service_role만 EXECUTE 가능하며 PUBLIC/anon/authenticated 실행 금지, SECURITY INVOKER 사용.
- HTTP 입력 `{action,workspaceId,requestId,...payload}`. JWT는 Authorization 헤더. publish/ship/pay는 항상 거부. 서버는 workspace 멤버 확인 후만 DB 함수를 호출한다.

### Task 1: 무료 전용 프로젝트와 명시적 설정

**Files:** Create `src/data/workflowConfig.js`, `test/workflowConfig.test.js`; modify `.env.example`, `.gitignore`, `package.json`, `package-lock.json`.
**Interfaces:** `resolveWorkflowConfig(env): {mode:'local'|'cloud',url?,publishableKey?}`. cloud 설정 불완전 시 오류; production에서 local 모드 거부. 서버 비밀키는 server 전용 env.

- [ ] 테스트 작성: `assert.throws(()=>resolveWorkflowConfig({MODE:'production',VITE_WORKFLOW_MODE:'local'}))`; cloud의 URL/공개키 누락 오류, 이름에 SECRET/SERVICE_ROLE을 포함한 client config 거부.
- [ ] `node --test test/workflowConfig.test.js` 실행해 구현 전 FAIL 확인.
- [ ] 신규 조직 생성 UI 확인 및 필요한 사용자 로그인. Free 이외 선택 금지. 새 조직 식별자/요금 확인 후 get_cost/confirm_cost 절차 수행; 금액 >0 또는 불명확하면 사용자 응답 전 생성 금지. 기존 조직을 선택하지 않는다.
- [ ] 실제 새 프로젝트 healthy 확인. 최신 공식 docs/changelog 확인 후 SDK 버전 고정 설치 및 resolveWorkflowConfig 구현. CLI 명령은 --help로 확인한다.
- [ ] 위 테스트 PASS, 빌드 산출물에 비밀키가 없음을 확인 후 이 Task 파일만 커밋. 계정 가입/운영 사용자 이메일은 사용자가 확인하며 임의 생성 계정으로 실제 운영을 대체하지 않는다.

### Task 2: 권한과 원자적 클라우드 저장

**Files:** Create `server/cloud/{auth.js,workflowStore.js,handler.js}`, `server/candidateUpdate.js`, `api/agency.js`, `test/cloudWorkflow.test.js`, `test/integration/cloudPermissions.test.js`; modify `server/agencyWorkflow.js`, `vite.config.js`; CLI-generated Supabase schema/migrations.
**Interfaces:** `authenticateRequest({authorization,workspaceId},deps): Promise<{userId,workspaceId}>`; `validateCandidateUpdate(candidate,input): patch`; Store contract above. Handler rejects extra fields, >64 KB, disallowed origin, missing JWT; requestId UUID required for writes.

- [ ] 작성할 실패 테스트: 인증 없음/만료/비멤버→거부, 사용자 metadata owner 위조→거부, 이전 revision→충돌, unknown outcome 뒤 같은 requestId→같은 revision/event 1개, 다른 본문에 같은 requestId→거부. update 검증 기존 테스트를 공유 함수로 재사용한다.
- [ ] `node --test test/cloudWorkflow.test.js`로 RED 확인.
- [ ] 신규 프로젝트에서만 workspaces/workspace_members/candidates/candidate_events 및 write request 중복방지 저장을 구현한다. workspace+source+offerId unique, 서버 시각/행위자, RLS 읽기 및 클라이언트 쓰기 차단. private DB 함수에서 candidate 변경+event+request 결과를 단일 트랜잭션으로 처리한다. 권한/이벤트 삽입용 service key는 서버에만 둔다.
- [ ] 읽기/쓰기 API와 async Store 연결. 클라우드 search/collect/market는 단계 2 전까지 명시적 COLLECTOR_UNAVAILABLE, 로컬 Chrome 주소로 접속하지 않는다. 양쪽 서버 URL 검증 유지.
- [ ] `node --test test/cloudWorkflow.test.js test/integration/cloudPermissions.test.js`: unit 및 별도 opt-in 실DB 테스트 수행. 실제 anon/멤버/비멤버 JWT로 RLS·direct REST·RPC 권한 검증. 실DB 환경이 없으면 통합 테스트 SKIP 사유 명시, PASS로 합산하지 않는다.
- [ ] DB advisors/권한 결과를 확인하고 CLI로 마이그레이션 기록 생성·검증 후 커밋. 다른 DB에는 migration 적용 금지.

### Task 3: 기존 로그인·조사 화면의 실데이터 연결

**Files:** Create `src/auth/AuthProvider.jsx`, `src/data/workflowClient.js`, `src/dashboard/operatingSummary.js`, `test/operatingSummary.test.js`; modify `src/{main.jsx,SmartStoreSellerOS.jsx,PurchaseAgencyPanel.jsx}`.
**Interfaces:** `createWorkflowClient({config,getAccessToken}): {request(input): Promise<any>}`; `summarizeCandidates(candidates): {candidateCount,holdCount,reviewRequiredCount}`. Auth context `{status:'loading'|'signedOut'|'signedIn',user,signIn,signOut}`.

- [ ] 실패 테스트 작성: `assert.deepEqual(summarizeCandidates([]),{candidateCount:0,holdCount:0,reviewRequiredCount:0})`; P2013 HOLD 입력은 holdCount=1이며 매출/주문 숫자는 생성하지 않는다. 토큰 없는 cloud 저장 요청을 거부하고 로그아웃 후 도착한 응답을 폐기한다.
- [ ] `node --test test/operatingSummary.test.js test/cloudWorkflow.test.js` FAIL 확인 후 Auth 수명 관리/명시적 mode client/실집계를 구현한다. 기존 Login의 가짜 비밀번호/default user를 cloud mode에서 제거한다.
- [ ] 기존 UI 구조/스타일을 유지해 로그인·로그아웃·후보 데이터 소스만 교체. 매출·주문·등록 mock 통계는 미연동 처리하고 조사 관련 실집계만 노출한다. source 모드 표시와 저장 충돌 복구를 유지한다.
- [ ] 실제 브라우저: 사용자 로그인, 후보 조회/저장, 서로 독립된 2세션에서 일치, 로그아웃/계정 전환 시 지연응답 폐기, /sourcing-console 분리 검증. 컨텍스트 2개는 실제 다른 기기 검증으로 보고하지 않는다.
- [ ] unit suite/build 및 화면 검증 후 커밋. 실사용자 로그인/연결 불가 시 그 부분을 미완료로 기록한다.

### Task 4: 이전·백업·복구와 단계 1 인수

**Files:** Create `server/cloud/dataTransfer.js`, `scripts/seller-os-data.mjs`, `test/dataTransfer.test.js`, `docs/operations/seller-os-backup.md`; modify `HANDOFF.md`.
**Interfaces:** `validateSnapshot(snapshot): {records,events,manifest}`; `planImport(snapshot,existing): {create,skip,conflict}`; `makeSnapshot({workspaceId,records,events}): {version:1,workspaceId,records,events,manifest:{counts,sha256,createdAt}}`. CLI `export`, `import --dry-run`, `import --apply`, `restore --dry-run`; real restore requires explicit target and confirmation.

- [ ] 실패 테스트 작성: 같은 offerId의 source 표기가 달라도 동일 후보로 처리, 기존 편집은 conflict, 재실행은 skip, 해시 변조/다른 workspace는 reject, P2013 HOLD와 기존 케이블 후보의 확인 플래그 보존을 assert한다.
- [ ] `node --test test/dataTransfer.test.js`로 RED 확인 후 형식 검증/원본 backup/preview/트랜잭션 기반 import를 구현한다. 일반 사용자가 이벤트를 수정하는 API는 만들지 않는다.
- [ ] 실제 로컬 후보 파일 백업·dry-run 결과를 사용자에게 보여주고 확인한 workspace로만 이전. 기존 파일 삭제/덮어쓰기 없음. snapshot에 secrets/auth 비밀번호 포함 금지.
- [ ] 비용 없는 격리 테스트 DB/스키마에 복구하고 후보/이력 개수·해시 비교. 새 유료 프로젝트/브랜치 생성 금지. 매 작업일 종료 및 이전 직전 백업 절차와 실행 호스트/경로를 문서화; 자동 스케줄은 별도 확인 전 설정하지 않는다.
- [ ] `npm ci`, `npm test`, `npm run build`, 브라우저·실DB 권한·복구 결과를 기록. Windows Vite 잠금이면 해당 repo PID만 확인해 중지/재시작, Chrome 보존. review findings 수정 후 Task commit/push, main 미병합. 단계 2로 이동하되 미검증 외부 항목을 숨기지 않는다.
