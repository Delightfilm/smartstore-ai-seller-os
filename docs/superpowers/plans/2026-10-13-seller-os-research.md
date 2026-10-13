# Seller OS Research Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SKU 단위의 검증 가능한 조사 결과를 정규화하고 로그인된 로컬 작업자로 반복 수집·갱신한다.
**Architecture:** 클라우드가 인증된 조사 작업을 저장하고 로컬 작업자가 할당된 작업을 처리한다. 로그인/캡차/오프라인은 대기 상태로 노출하며 로컬 Chrome을 클라우드에 공개하지 않는다.
**Tech Stack:** 단계 1 Store/Auth, 기존 Node/Playwright 수집기, Supabase 작업 레코드.
**Spec:** ../specs/2026-10-13-seller-os-operating-foundation-design.md (2~5단계 안전 계약).

## Global Constraints

- 실행 선행: Foundation Task 2/3의 저장/인증 계약. 공통 제한은 실행 계획 안내의 전 단계 공통 제한을 그대로 적용한다.
- 사용자 변경 승인에 따라 기존 공유 프로젝트의 Seller OS 전용 테이블/API만 추가한다. 다른 앱/공유 Auth/과금 설정은 유지한다. 세션 쿠키 전송, 보안 검증 우회, 무제한 재시도, 임의 URL 탐색 금지.
- 포장 정보 완비=선택 SKU의 개당 포장 총중량+가로/세로/높이+단위+URL+관찰일. 순중량/박스 묶음/다른 옵션 자료를 대체 사용하지 않는다.

## Review Focus

- 검색 카드 MOQ와 상세 SKU MOQ 충돌 시 자동 통과 금지 → Task 1.
- 순중량/카톤 무게만 있는 경우 grossWeight=null → Task 1.
- 옵션 가격/재고를 다른 SKU 포장 데이터와 결합하지 않음 → Task 1.
- 작업자가 응답 중단한 후 결과를 다시 제출해도 중복 후보/이력 없음 → Task 2.
- 로그인/캡차/중단된 PC를 성공/재고 0으로 표시하지 않음 → Task 2/3.

## File Structure / Contracts

- `src/domain/sourceEvidence.js`: 공통 관찰 `{value,unit,sourceUrl,observedAt,kind:'observed'|'quoted'|'estimated',scope,confirmed}`. scope는 SKU ID와 개당/카톤 구분을 포함한다.
- `src/domain/normalizedProduct.js`: `normalizeProduct(raw): ProductObservation`; `checkSourcingEligibility(observation): {status:'ELIGIBLE'|'HOLD',reasons}`.
- ProductObservation `{source:'1688',offerId,title,skuObservations:[{skuId,label,priceCny,moq,stock,package:{grossWeightG,dimensionsCm},evidence}],observedAt}`. 숫자는 유한 양수(재고는 0 허용) 또는 null. 문자열 SKU ID는 원문에 없으면 미확인으로 유지하며 자동 매칭하지 않는다.
- `server/researchJobs.js`: 작업 수명. `scripts/seller-os-worker.mjs`: 로컬 실행. `src/ResearchJobsPanel.jsx`: 기존 발굴 화면 내 상태.

### Task 1: 근거를 보존하는 정규화/선별

**Files:** Create 두 domain 파일, `test/normalizedProduct.test.js`, 비인증 fixture; modify `server/parse1688.js`, `server/collect1688.js`.
**Interfaces:** 위 ProductObservation 계약. 비용/심사는 원문 raw 값 대신 이 형식을 소비한다.

- [ ] 실패 테스트: MOQ=1+동일 SKU 개당 gross446g/dimensions[18.5,14,4.5]의 확인 근거→ELIGIBLE; 순중량/카톤/다른 SKU/근거 없는 수치→HOLD; 현재 P2013 조사값은 총중량 구분 확정 전 HOLD. `assert.equal(checkSourcingEligibility(incomplete).status,'HOLD')`.
- [ ] `node --test test/normalizedProduct.test.js` RED 확인.
- [ ] DOM에 실제 있는 옵션별 근거만 수집·정규화. 단위 변환은 명시 단위가 있을 때만 수행하고 original value/unit 보존. 상품 단위 공통표를 임의 SKU에 복사하지 않는다.
- [ ] 같은 테스트 GREEN와 기존 수집 테스트 회귀 통과 후 커밋. 실브라우저 관찰은 사용자 로그인/검증 후만 실행한다.

### Task 2: 인증된 로컬 작업자·서버 작업 기록

**Files:** Create `server/researchJobs.js`, `scripts/seller-os-worker.mjs`, `test/researchJobs.test.js`; modify 단계 1 handler/store와 CLI 생성 migration.
**Interfaces:** `enqueueResearch({workspaceId,kind:'search'|'refresh',query?,offerId?,skuId?,requestId},actor)`; `claimResearch(workerSession)`→lease; `completeResearch({jobId,leaseId,result},workerSession)`; `pauseResearch({jobId,leaseId,reason})`. worker는 사용자 인증 세션을 사용하며 server secret을 받지 않는다.

- [ ] RED tests: 다른 workspace lease 거부, 만료 lease 결과 거부, 동일 완료 request 재시도 무중복, capcha→WAITING_HUMAN, offlinedevice→WAITING_WORKER. URL은 클라이언트/서버/worker 모두 canonical 1688 검증.
- [ ] `node --test test/researchJobs.test.js` FAIL 확인 후 single-worker/동시성1, lease5분/heartbeat30초/연속 실패 자동중지 구현. 자동 재시도는 안전한 일시적 읽기 실패 최대2회, 캡차/401은 재시도하지 않는다.
- [ ] worker CLI foreground 실행/종료 기능과 최소 세션 로그 구현. 상주 서비스/스케줄 설치는 사용자에게 실행 호스트와 주기를 보여준 후 진행하며 별도 과금 자원은 생성하지 않는다.
- [ ] GREEN/원자적 완료 통합 테스트와 실제 한 검색/선택 후보 갱신을 확인하고 커밋. 관찰 원본 cookies/인증 HTML 미저장.

### Task 3: 발굴 화면 연결과 반복 실행 검증

**Files:** Create `src/ResearchJobsPanel.jsx`; modify `src/PurchaseAgencyPanel.jsx`, `HANDOFF.md`; add `test/researchJobView.test.js`.
**Interfaces:** 상태 `QUEUED|RUNNING|WAITING_HUMAN|WAITING_WORKER|FAILED|SUCCEEDED`; candidate은 동일 offerId 갱신 시 revision 증가/검토 만료.

- [ ] 실패 테스트: WAITING_HUMAN은 로그인 필요 문구, FAILED는 원인과 마지막 성공 시각, null 가격/재고는 미확인 표시. 누적 리뷰를 판매량으로 표시하지 않는 assertion.
- [ ] RED 확인 후 기존 레이아웃의 패널 안에 작업 상태/마지막 관찰/재시도/중지 연결. 상품 MOQ·포장 누락 사유 표시.
- [ ] 동일 후보 2회 갱신 시 후보 1개/관찰 이력 증가/이전 검토 만료를 실제 DB에서 검증. worker 중단 시 명시적 대기, 재시작 시 중복 처리 방지 확인.
- [ ] tests/build/브라우저 검증 및 미확인 항목 기록 후 커밋·푸시. 공급 사이트가 막히면 재현 fixture와 실제 미검증을 분리한다.

## Execution record — 2026-10-13

- Three implementation tasks delivered as one coherent branch checkpoint (gateway/client/worker contracts must ship together), not separate intermediate functional commits.
- Foreground Vite-owned authenticated worker replaces the separate CLI entrypoint; no OS service/scheduler is installed. Actual files are `server/cloud/researchJobs.js`, `server/researchWorker.js`, `server/research1688.js`, `src/ResearchJobsPanel.jsx`. Tests are `test/{normalizedProduct,researchAutomation,researchJobView,candidateSnapshots}.test.js` and separate rollback SQL.
- Domain tests first failed missing module, then passed. Existing URL contract regression first failed3 tests because the new helper omitted error.code; fixed and rerun green. Worker/SQL/view tests include negative cases; their initial RED runs were not recorded, so the original RED checkboxes above are not retrospectively claimed.
- SKU evidence gate, queue/lease/replay, source identity/conflicts, search-card MOQ conflicts, stop/login/captcha guards, failure circuit breaker, revision-safe polling and review invalidation implemented. Heartbeat25s (dashboard renew20s), lease5min, offline grace90s, concurrency1; safe transient read retry max2.
- Actual authenticated UI: P2013 refresh twice plus1search/3child-details. No new incomplete candidate stored. P2013 stays one candidate, HOLD revision8; original user reasons restored/preserved, full latest64exclusion reasons in job/source-check, editable reasons20. Later adapter reads16realvendorSKUs; MOQ/packing remains incomplete. Actual new eligible commodity storage is not yet proven; positive atomic candidate/event/replay is verified only with rollback fixtures.
- Existing main UI/layout, dependency manifests, local original data and other shared-app areas preserved. No paid resource, listing, shipment or purchase enabled. Current tests/build/remote validation and exact next action are recorded in HANDOFF.md.
