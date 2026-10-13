# Seller OS Economics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가정/확인된 비용을 분리하고 검증된 물류 근거가 있을 때만 실제 견적 기반 수익성을 산출한다.
**Architecture:** 순수 비용 계산기와 공급사 조회 어댑터를 분리한다. 퀵스타 문서에서 확인된 읽기 기능만 allowlist로 제공하며 조회 실패를 0원으로 바꾸지 않는다.
**Tech Stack:** 기존 Node/React 계산기, 단계 1 Store, 단계 2 sourceEvidence.
**Spec:** ../specs/2026-10-13-seller-os-operating-foundation-design.md (비용 검증 계약).

## Global Constraints

- 전용 신규 프로젝트만 사용, 비용 사전 승인, 실제 구매/배송/결제·고객정보 전송 금지.
- 211원 환율/운임/수수료 등 P2013 시나리오는 과거 가정이며 계약/실청구로 승격하지 않는다.
- 유료 조회 API나 AI 서비스는 자동 사용하지 않는다. auth/tokenKey/schema가 불명확한 엔드포인트에 추측 요청하지 않는다.

## Review Focus

- 빈 비용을 0원으로 계산하지 않음 → Task 1.
- 운임에 국내 배송/VAT가 포함됐는지 미확인하면 확정 견적 아님 → Task 1.
- 실제중량/부피중량 적용 규칙이 다르면 확인된 공급사 규칙만 적용 → Task 1.
- 401/오류 HTML/대소문자 다른 필드 응답을 정상 견적으로 저장하지 않음 → Task 2.
- 반품 충당보다 큰 반품비 가능성과 세전 기여이익/순이익 차이를 표시 → Task 3.

## File Structure / Contracts

- `src/domain/economics.js`: `evaluateEconomics({product,costs,salePriceKrw,policy,now}): {status:'ESTIMATE'|'VERIFIED'|'INCOMPLETE',profitKrw,marginPercent,missing,assumptions,evidenceRevision}`.
- costs는 sourceEvidence 항목 집합, quote에는 skuId/weight bracket/포함비용/만료일 필수. VERIFIED는 필수 항목 모두 quoted+confirmed+유효일이며 SKU 일치일 때만 가능. estimated가 있으면 ESTIMATE.
- `server/providers/quickstarReadOnly.js`: `readQuickstarReference({operation,parameters},config): ProviderResult`; `quoteAvailability()`는 실제 문서 근거 없으면 UNSUPPORTED, 가짜 요금 endpoint를 만들지 않는다.

### Task 1: 근거와 유효기간 기반 계산

**Files:** Create `src/domain/economics.js`, `test/economics.test.js`; modify `src/researchReview.js` (기존 시나리오는 유지).

- [ ] 실패 테스트: 기존 P2013 14,900 시나리오 [3237,1317,-1517] 유지; 빈 운임→INCOMPLETE/profit=null, 만료 견적→INCOMPLETE, 추정 반품비 포함→ESTIMATE, 포함 국내배송 이중합산 금지. 확인되지 않은 VAT를 임의 확정하지 않는 assertion.
- [ ] `node --test test/economics.test.js test/researchReview.test.js` RED 확인.
- [ ] 경제성 순수함수 구현. 모델 버전과 입력 revision을 결과에 포함하고 계산 반올림은 표시에서만 수행. 비용에 없는 세금·고정비를 반영했다고 주장하지 않는다.
- [ ] GREEN/경계값·0과null구분·100%초과 수수료 거부 확인 후 커밋.

### Task 2: 퀵스타 문서 확인과 읽기 전용 어댑터

**Files:** Create `server/providers/quickstarReadOnly.js`, `test/quickstarReadOnly.test.js`, `docs/operations/quickstar-read-only.md`.

- [ ] 인증 종류/필수 필드/단위/응답 케이싱/호출 한도/읽기 작업의 비과금 여부를 현재 공식 가이드에서 확인해 문서화. 불명확하면 사용자에게 필요한 확인 항목을 제시하고 실호출만 중지한다. 비밀키는 화면/로컬 env로 설정, 채팅/Git 기록 금지.
- [ ] 실패 테스트: operation='create'/'update'/'discard'/'pay'→네트워크 호출0, allowlist외 URL 거부, 401/HTML/필수필드누락→ProviderError, 실패 시 quote 저장0.
- [ ] `node --test test/quickstarReadOnly.test.js` RED 후 검증된 읽기 operation만 구현. timeout10초, 자동재시도0, 민감 응답 로그 금지. 기존 배송신청 조회에 고객 데이터가 필요하면 이번 범위에서는 호출하지 않는다.
- [ ] GREEN 뒤 비과금·비고객정보 조회 1건만 실확인. 미지원 요금 기능은 수동 견적 근거 입력으로 남기고 실연동 성공과 구분한다. 결과 및 외부 호출 종류를 기록 후 커밋.

### Task 3: 대시보드 비용 근거 표시

**Files:** Modify `src/ResearchReviewPanel.jsx`, `src/PurchaseAgencyPanel.jsx`, `server/candidateUpdate.js`, `HANDOFF.md`; add `test/costEvidenceUpdate.test.js`.

- [ ] 실패 테스트: 비용 변경은 이전 검토 만료, 클라이언트가 status='VERIFIED'를 직접 보내면 거부, 근거 없는 운임 입력은 ESTIMATE.
- [ ] RED 후 가정/확인/미확인/만료 라벨·원문 출처·관찰일·제외 항목·마진을 기존 패널에 연결.
- [ ] 실제 저장/조회와 새로고침, 유효일 경계, P2013 보류 유지 확인. tests/build 통과 후 커밋·푸시; 실제 운임/반품 비용 미확정은 미완료로 기록.
