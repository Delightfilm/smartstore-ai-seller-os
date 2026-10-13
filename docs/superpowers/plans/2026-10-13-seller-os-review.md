# Seller OS Evidence Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조건을 충족한 자료만 준비 완료 판정하고 누락/만료/충돌은 구체적인 사유로 보류한다.
**Architecture:** 서버 순수 판정 함수가 정규화 상품·비용·경쟁·수요·권리 근거의 revision을 읽고 결과를 기록한다. UI 체크나 임의 점수는 서버 판정을 대체하지 않는다.
**Tech Stack:** 단계 1 원자적 Store, 단계 2 정규화, 단계 3 economics, Node test.
**Spec:** ../specs/2026-10-13-seller-os-operating-foundation-design.md (심사 계약).

## Global Constraints

- 실제 등록/발주/배송 권한과 검토 통과는 분리. 전 단계 공통 제한 적용.
- P2013의 근거를 채우거나 경쟁 우위를 만들어내지 않는다. 자동 판정은 판매 보장이나 법적 적합성 보증이 아니다.
- 규정/판매 가능 여부는 해당 상품의 현재 공식 근거를 확인하고 모호하면 사용자 판단을 요청한다.

## Review Focus

- 누적 리뷰/카테고리 인기를 해당 모델 월판매량으로 사용하지 않음 → Task 1.
- 옵션/수량/배송비가 다른 경쟁상품을 동등 비교로 판정하지 않음 → Task 1.
- 권리 체크만 있고 라이선스/허락 근거가 없으면 상세 이미지 승인 불가 → Task 1.
- 판정 중 다른 탭에서 근거가 바뀌면 오래된 READY 결과 저장 거부 → Task 2.
- 현재 시간이 정책/근거 유효기간을 넘으면 저장돼 있던 READY도 사용 불가 → Task 2.

## File Structure / Contracts

- `src/domain/evidenceReview.js`: `assessCandidate({candidate,observation,economics,evidence,policy,now}): {status:'HOLD'|'READY_FOR_DETAIL',reasons:[{code,message,evidenceIds}],evidenceRevision,policyVersion,validUntil}`.
- evidence 항목 `{id,type,skuId,sourceUrl,observedAt,expiresAt,confirmedBy,details}`. type은 demand/comparison/supply/imageRights/saleEligibility. URL만으로 사실 확정하지 않고 details의 범위/대상과 검토 기록을 요구한다.
- policy `{version,minProfitKrw,minMarginPercent,maxEvidenceAgeDays,enabled}`는 owner가 명시적으로 확정하기 전 enabled=false. 기존 3000/20 기준은 제안/시나리오용, 실제 운영 정책으로 자동 채택하지 않는다.
- API `saveReviewPolicy({workspaceId,expectedVersion,requestId,minProfitKrw,minMarginPercent,maxEvidenceAgeDays,confirmed:true},actor)`는 owner만 호출 가능하다. 서버가 새 version/확인시각/행위자를 부여한다. 금액은 유한수 >=0, 마진은 0~100 미만, 유효기간은 양의 정수; 변경 시 기존 결과의 policyVersion 불일치로 재검토 처리한다.

### Task 1: 사유 코드가 있는 보류 우선 판정

**Files:** Create `src/domain/evidenceReview.js`, `test/evidenceReview.test.js`; modify `src/researchReview.js`.

- [ ] RED tests: 정책 미확정→POLICY_NOT_CONFIRMED, 순중량만→PACKAGING_INCOMPLETE, 견적 추정→COST_NOT_VERIFIED, 다른옵션경쟁→COMPARISON_NOT_EQUIVALENT, 근거없는권리체크→IMAGE_RIGHTS_UNVERIFIED. 테스트용 완전 자료만 READY_FOR_DETAIL이며 publication은 NOT_PUBLISHED.
- [ ] `node --test test/evidenceReview.test.js` 실패 확인 후 함수 구현. 준비 완료에는 SKU MOQ1/포장 근거, 유효 비용, 경쟁/수요/공급/권리/판매 적합성, 사용자 확정 정책 충족을 모두 요구.
- [ ] 최근 수요·동일구성·이미지 사용권 evidence의 구조와 만료 경계를 검증하고 GREEN 후 커밋. 임시 수치/추정 판매량을 실제 facts에 넣지 않는다.

### Task 2: 서버 판정 저장·무효화

**Files:** Modify `server/{agencyWorkflow.js,candidateUpdate.js}`, `server/cloud/{handler.js,workflowStore.js}`, CLI 생성 migration; create `test/reviewAssessment.test.js`.
**Interfaces:** API `assess` 입력 `{id,revision,requestId,workspaceId}`. 클라이언트는 status를 지정하지 못한다. 판정 기록은 same revision 비교 후 원자적 저장.

- [ ] 실패 테스트: evidence 변경과 assess 동시 실행→충돌, stale READY export→거부, 직접 READY 입력→거부, 다른workspace policy→거부. validUntil 경계에서 재검토 요구.
- [ ] `node --test test/reviewAssessment.test.js` RED 후 서버 clock/정책/자료만으로 판정하고 event 기록. 자료 변경·만료 시 READY 사용 차단을 export에도 적용한다.
- [ ] GREEN 및 실제 두 세션 충돌 검증 후 커밋. 서버 판정 오류를 이전 READY로 fallback하지 않는다.

### Task 3: 정책 확인과 실제 후보 심사

**Files:** Modify `src/{ResearchReviewPanel.jsx,PurchaseAgencyPanel.jsx}`, `HANDOFF.md`; create `docs/operations/review-policy.md`.

- [ ] UI 실패 테스트: POLICY_NOT_CONFIRMED 안내, 보류 코드별 근거 링크, 판정 timestamp/validUntil/revision 표시.
- [ ] RED 확인 후 기존 패널에 정책 확인·재심사 UI 연결. 최소 기여이익/마진/근거 유효기간은 사용자 확인 후 저장하며 빈 정책을 통과시키지 않는다.
- [ ] P2013 및 실제 후보에 실행하고, 통과 후보가 없으면 그 사실을 기록. 누락 근거를 꾸며내지 않는다. tests/build/브라우저 검증 후 커밋·푸시.
