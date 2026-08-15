DelightFilm SmartStore AI Seller OS — Local UI Fix v1

1) 기존 localhost:5173 검은 창을 닫습니다.
2) START_LOCAL.bat 를 더블클릭합니다.
3) 메인 UI: http://localhost:5173/
4) Sourcing Console: http://localhost:5173/sourcing-console

이번 수정 범위
- Claude 원본 큰 레이아웃/배치 유지
- 누락되어 있던 Tailwind CSS 복구
- flex/grid/spacing/responsive 유틸리티 정상화
- 긴 한글/ID overflow 방지
- 버튼/chip 축소 충돌 방지
- 표는 컬럼이 겹치지 않고 가로 스크롤 허용

첫 실행 시 npm install이 실행됩니다.
