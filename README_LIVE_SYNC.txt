DelightFilm SmartStore AI Seller OS — LIVE SYNC

앞으로 이 폴더는 다시 다운로드할 필요가 없습니다.

1) START_LOCAL.bat 실행
2) http://localhost:5173 접속
3) ChatGPT에 UI 수정을 요청
4) 수정이 반영되면 Vite가 자동 갱신(HMR). 필요하면 F5만 누르세요.

메인: http://localhost:5173/
소싱 콘솔: http://localhost:5173/sourcing-console

동작 원리:
- Vite 서버가 2초마다 DelightFilm 전용 preview-sync 엔드포인트를 확인합니다.
- ChatGPT가 승인된 UI 패치를 엔드포인트에 반영합니다.
- 로컬 Vite가 정확한 문자열 패치만 적용한 뒤 HMR로 브라우저에 반영합니다.
- 큰 레이아웃/원본 파일은 로컬에 유지됩니다.

주의:
- START_LOCAL.bat 창은 열어둬야 합니다.
- 수정 중 [DelightFilm Sync] patch ... skipped 메시지가 뜨면 그 줄을 ChatGPT에 보내주세요.
- .preview-sync-state.json 파일은 적용된 패치 기록입니다. 평소에는 삭제하지 마세요.
