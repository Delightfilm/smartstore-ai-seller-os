# C 이미지형 적용 범위

2026-10-15 사용자 선택: `C 이미지형으로 가자`. 기존 기록·조사 인터페이스를 바꾸지 않는 bounded UI 작업. 모드는 Operate. 별도 재승인이나 새 기능 설계는 필요하지 않다.

## Direction contract

THESIS: 상품 이미지에서 선택하고 바로 오른쪽에서 보류와 추정 수익성을 읽는다. 큰 빈 추천 패널과 테스트 수집기가 첫 화면을 차지하지 않는다.

OWN-WORLD: 사용자가 고른 웜 스톤 배경·흰 표면·포레스트 그린 액션과 선택. 동일한 UI 산세리프, 14px 본문, 12–14px 카드 모서리, 얇은 테두리. 경고는 앰버.

STORY: 저장 후보를 검색·선택 → 가정과 미확인값 확인 → 전체 검토 기록에서 기존 저장 기능으로 이어진다. 등록·배송은 실행하지 않는다.

FIRST VIEWPORT: 얇은 좌측 레일·64px 상단 바·우상단 발굴 실행. PC 3열 이미지 카드와 우측 약32% 검토 패널. 실제 제목 길이·실제 이미지 비율에 맞춰 배치하며, 시안의 가짜 사진·예시 숫자는 옮기지 않는다. 설정과 진행 상태는 접을 수 있다. 모바일에서는 카드 아래 검토 패널.

FORM: 사용자 지정 C 시안. 참조: generated_images/01a01b06-3a74-73a0-a98a-327de34315ee/exec-29323646-fdfc-4056-ac7b-0ea63522aa15.png. 이미지 시안은 시각 방향의 기준이며 실제 데이터·기능 진실이 우선한다. 시안에서 검증되지 않은 상품 이미지를 재생산하지 않는다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Validation
데이터 뷰 RED/GREEN, 실제 컴포넌트 선택·검색·필터·전체 검토 진입, 로컬 로그인 유지·실제 후보 조회, PC/모바일 overflow·다크 모드, 전체 테스트/빌드. 운영 데이터 쓰기나 발굴 실행은 디자인 검증에 사용하지 않는다. 외부 배포는 이 요청에서 자동 수행하지 않는다.
