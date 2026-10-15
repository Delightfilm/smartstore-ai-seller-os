# Seller OS

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
DelightFilm 해외구매대행 운영자. PC에서 상품을 발굴하고 근거와 비용을 비교·검토한다. 2026-10-15 사용자가 PC 디자인 C 이미지형을 선택했다.

## Product Purpose
1688 조사 → 국내 경쟁·수요 검토 → 비용 시나리오 → 보류 사유 해소 → 상세페이지 준비를 같은 후보 기록으로 연결한다.

## Capabilities and Constraints
- 기존 React/Vite 앱과 인증·저장 API를 유지한다. `/sourcing-console`은 별도 실험 경로다.
- 로컬 PC 수집기는 PC·서버·1688 세션이 필요하다. 외부 대시보드가 PC에 직접 접속하지 않는다.
- 추정 기여이익은 확정 순이익이 아니다. 미확인값·만료 근거·음수 시나리오를 숨기지 않는다.
- 상품 등록·배송 신청·구매·결제는 이 작업의 범위 밖이다. 네이버 실제 키 인증은 인간 작업 대기다.
- 실제 저장된 이미지와 이름만 표시하며, 누락 이미지는 임의 생성 상품으로 대체하지 않는다. 내부 원본 미리보기는 상세페이지 이미지 사용권 승인이 아니다.

## Brand Commitments
Seller OS / DelightFilm. 사용자 승인 C 이미지형(이미지 카드 + 오른쪽 검토 패널).

## Product Principles
실제 데이터와 예시를 구분한다. 검토 근거를 숨기지 않는다. UI 변경으로 거래 권한을 확대하지 않는다.
