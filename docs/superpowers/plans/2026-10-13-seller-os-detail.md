# Seller OS Evidence-backed Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 심사를 통과한 근거만 사용해 한국어 상세페이지 준비 자료를 만들고 검수·내보내기한다.
**Architecture:** 허용된 사실을 추출하는 순수 모델 → 안전한 HTML 렌더러 → 서버 revision 검증 저장/내보내기. 외부 생성 AI 없이 검증된 사실 기반 템플릿부터 구현한다.
**Tech Stack:** 기존 renderDetail/escapeHtml, 단계 4 assessCandidate, React iframe preview, Node test.
**Spec:** ../specs/2026-10-13-seller-os-operating-foundation-design.md (상세페이지 계약).

## Global Constraints

- 유료 AI 호출/실상품 등록/배송 신청 없음. 기존 UI 및 전 단계 공통 제한 적용.
- 미확인 효능/인증/내구성/배송일/원산지를 생성하지 않는다. 사용자 텍스트는 명령이 아닌 데이터로 처리한다.
- 사용권 미확인 이미지 금지. 외부 상세 이미지를 임의 다운로드/번역/재가공하지 않는다.
- HOLD 후보의 기존 초안은 보존하되 새 준비 완료 결과를 만들지 않는다. P2013은 실근거가 해결되기 전 그대로 보류.

## Review Focus

- 상품 설명에 script/이벤트/위험 URL이 있으면 실행되지 않음 → Task 1.
- 순중량을 포장 총중량으로, 추정 운임을 확정 배송비로 표시하지 않음 → Task 1.
- 이미지 권리 만료/해제 시 저장된 HTML 재다운로드도 차단 → Task 2.
- 생성 도중 상품 revision 변경 시 오래된 결과 저장 거부 → Task 2.
- 금지 주장/미확인 한국어 번역이 검수 없이 준비 완료가 되지 않음 → Task 3.

## File Structure / Contracts

- `src/domain/detailDocument.js`: `buildDetailDocument({candidate,assessment,evidence,now}): {status:'BLOCKED'|'DRAFT',sections,claims,missing,evidenceRevision}`. claim은 `{text,evidenceIds,verified}`; sections는 title/specs/options/package/delivery/returns/images.
- `renderVerifiedDetail(document): {html,warnings}`는 기존 escapeHtml/publicUrl 규칙을 재사용한다. 가격/배송일/옵션을 추측하지 않는다.
- `server/detailPreparation.js`: `prepareDetail(input,deps)`, `exportDetail(input,deps)`. 두 함수 모두 현재 유효 assessment/rights/revision 확인. 결과 상태 DETAIL_READY도 publication=NOT_PUBLISHED.

### Task 1: 사실과 사용권에 한정된 상세 문서/렌더링

**Files:** Create `src/domain/detailDocument.js`, `test/detailDocument.test.js`; modify `src/purchaseAgency.js` (공통 escape/renderer 재사용).

- [ ] RED tests: HOLD→BLOCKED, 근거 없는 'KC 인증/당일 배송/100% 안전' 문구가 출력되지 않음, `<script>`와 javascript URL 제거/이스케이프, imageRights 만료→이미지0, SKU별 수치 불일치→BLOCKED. 테스트용 완전자료는 각 claim에 evidenceIds가 있어야 함.
- [ ] `node --test test/detailDocument.test.js` 실패 확인 후 순수 build/render 구현. 한국어로 확인되지 않은 외국어 핵심 사양은 검수 필요로 남긴다.
- [ ] GREEN와 기존 HTML draft 회귀 검증 후 커밋. 외부 AI 모델/이미지 생성은 이번 기본 구현에 추가하지 않는다.

### Task 2: 생성·저장·내보내기의 서버 검증

**Files:** Create `server/detailPreparation.js`, `test/detailPreparation.test.js`; modify `server/cloud/handler.js`, `server/agencyWorkflow.js`, CLI 생성 migration.
**Interfaces:** `prepareDetail({id,revision,workspaceId,requestId},deps)`→stored DRAFT; `exportDetail({id,revision,workspaceId},deps)`→HTML+manifest. 검수 저장 입력은 section text/근거 연결만 받고 READY 상태 직접 입력은 거부.

- [ ] RED tests: stale revision 저장 거부, 권리 철회 후 export 거부, 세션없음/다른workspace 접근 거부, requestId 재시도 무중복, 금지 publish action 네트워크0.
- [ ] `node --test test/detailPreparation.test.js` RED 후 현재 근거 재확인/원자적 저장/검수 이력 구현. 기존 수동 초안과 새 검증 문서를 구분하고 자동 덮어쓰지 않는다.
- [ ] GREEN/실DB 통합 결과 확인 후 커밋. 서버가 이미지 URL을 fetch하는 경우 publicUrl 검증만으로 SSRF를 막았다고 주장하지 말고 DNS/private address/redirect 검증을 별도 구현하거나 fetch하지 않는다.

### Task 3: 미리보기·실상품 검수·최종 인수

**Files:** Modify `src/{PurchaseAgencyPanel.jsx,ResearchReviewPanel.jsx}`, `HANDOFF.md`; create `docs/operations/preparation-acceptance.md`.

- [ ] 실패 UI 테스트: BLOCKED일 때 부족한 근거 표시, DRAFT/검수필요 라벨, sandbox iframe 유지, export가 등록/게시가 아님을 표시.
- [ ] RED 후 기존 상세페이지 영역에 문서/근거 목록/검수/HTML export 연결. 생성됐다는 이유만으로 상업적 적합성이나 판매 성과를 보장하지 않는다.
- [ ] 실제 통과 후보가 있으면 한국어 사양·옵션·권리·배송/반품 안내를 원문 대조하고 미리보기 검수. 없다면 테스트 fixture 품질 검증과 실후보 BLOCKED를 분리해서 보고한다.
- [ ] npm ci/test/build, 독립 코드 리뷰, 보안/권한/세션/복구/5단계 브라우저 회귀 수행. 실제 상품 등록/구매/배송 요청0 확인. HANDOFF에 단계별 완료/미확인/복구 절차를 기록하고 task branch commit/push. main 병합/배포 없음.
