# Seller OS 비공개 상세페이지 결과물·운영 검증 설계

상태: **2026-10-15 사용자 설계·계획 승인, Native 실행 선택. 순차 구현 중이며 클라우드 변경·배포 완료를 뜻하지 않음.**

## 1. 목적과 승인 범위

DelightFilm 운영자가 기존 C 이미지형 대시보드에서 상품을 선택하고, 자료 ZIP을 ChatGPT로 수동 이동해 만든 결과물을 같은 상품에 저장한다. 이미지 순서·한국어 카피·검수 상태를 관리하고 로그인된 로컬/외부 화면에서 같은 상세페이지를 미리본다. 이후 실판매 조건 검토, 기존 네이버 조회 연결, 기존 무료 Pages 배포를 순서대로 검증한다.

사용자가 승인한 것은 기존 Supabase 프로젝트에 Seller OS 전용 비공개 영역을 추가하는 방향이다. 기존 다른 앱, 세 저장소, Auth 설정, 권한, 요금제, 네이버 거래 기능을 변경하는 승인이 아니다. 기존 Seller OS 조사/저장 API와 C 화면의 구조를 유지하고, 결과물 편집 영역만 덧붙인다.

완료는 1~5 각 단계의 실제 증거로 판단한다. API 모의 테스트를 실제 네이버 연결로, 이미지 검수를 판매 승인으로, 조사 완료를 수익성 확정으로 기록하지 않는다. 상품 등록·수정·삭제, 배송 신청·발주·구매·결제, 공급사 메시지, 유료 리소스는 제외한다.

## 2. 현재 확인한 사실

- 체크아웃: `C:\Users\Delight\Documents\DelightFilm\smartstore-ai-seller-os`, 브랜치 `codex/purchase-agency-pipeline`, 깨끗한 기준 `950a03d`. `main` 병합 금지.
- 기존 ZIP 기능은 상품별 프롬프트·원본·업로드 JPG·누락 manifest를 내보낸다. 완성 이미지의 클라우드 저장 기능은 없다. `candidateUpdate.js`는 listing에 텍스트 5개만 허용하고 기존 JSON API는 요청 본문 64KiB 한도다. 이미지/base64를 후보 JSON에 넣지 않는다.
- 프로젝트 `dzgczkwwezzsfqnjdqen`은 현재 ACTIVE_HEALTHY이며 DF-AUTOSYNC 조직의 실제 플랜은 Free다. 기존 `company-proof`, `portfolio`, `led-stage-audio` bucket은 모두 private이며 Seller OS 전용 bucket은 아직 없다.
- 현재 Storage 메타데이터 집계는 다른 앱의 19개 object, 817,105,361bytes다. 개별 파일명·내용은 열지 않았다. 이 합계는 현재 파일 크기 참고값이지 조직의 월간 과금·전송량 또는 잔여 무료량 증명이 아니다.
- 기존 Storage 정책은 위 bucket들의 고정 ID를 명시한다. 새 bucket 전체에 적용되는 광범위한 authenticated 허용 정책은 이번 조회에서 발견하지 않았다. 생성 직전 정책을 다시 검사한다.
- 현재 Seller OS 후보 6개는 모두 HOLD/NOT_PUBLISHED다. memo `675246155709/r4`는 7장 원본이 있는 제작 흐름 검증 대상이지 판매 추천 상품이 아니다. P2013 `816692570613/r9`는 저장 사진이 없다.
- `.env.local`의 Commerce ID/secret은 모두 비어 있거나 없다. 값은 출력·수집·Git 저장하지 않았다. 기존 조회 어댑터, 수동 스토어 결합, cloud snapshot은 이미 구현돼 있으므로 재작성하지 않는다.
- 운영 주소는 `https://seller-os-delightfilm.pages.dev/`다. 최신 C UI/ZIP 기능은 아직 외부에 배포하지 않았다. Git push는 직접 업로드 Pages의 배포가 아니다.

## 3. 선택한 구성과 대안

**선택: 기존 프로젝트에 전용 private bucket + 별도 결과물 메타데이터 + 별도 보호 media API.** 기존 후보 API/64KiB 계약을 보존하고 다른 앱과 파일을 섞지 않는다. 로그인한 동일 workspace owner만 읽고 쓴다. 별도 유료 프로젝트나 공개 이미지 호스팅을 만들지 않는다.

PC 전용 IndexedDB 대안은 외부/다른 기기 공유가 불가능하므로 제외했다. 후보 JSON에 data URL을 넣는 대안은 본문 크기·반복 조회·감사 이력·비용을 악화시키므로 제외했다. 공개 bucket/상시 signed URL은 비공개 요구와 맞지 않아 제외했다.

Supabase 관리자와 service-role 런타임은 공유 프로젝트의 다른 데이터에도 기술적으로 접근할 수 있다. 이번 설계는 앱 단위의 권한/경로 제한이며 물리적 프로젝트 격리는 아니다.

### 3.1 저장소와 데이터 모델

- bucket `seller-os-detail-media`: `public=false`, 허용 PNG/JPEG/WebP, 파일당 4MiB. 다른 bucket의 설정·정책·파일은 그대로 둔다.
- object 경로는 서버가 `<workspace UUID>/1688/<offer ID>/<asset UUID>.<검증된 확장자>`로 만든다. 사용자 파일명·임의 경로·원격 URL을 object key로 사용하지 않는다. 파일명은 표시용 짧은 텍스트만 보존한다.
- `seller_os_detail_sets`: workspace/source/offer별 1개 편집 초안, 독립 revision, sourceCandidateRevision, 제목/소개, 순서 있는 asset ID 목록과 패널 카피, 검수 상태/항목/메모/작성자/시각. 기존 후보 revision과 별개다.
- `seller_os_detail_assets`: immutable asset ID, 같은 workspace/source/offer, 고정 경로, MIME/검증된 byte 수/가로/세로/SHA-256, 업로드 요청 ID/hash, `PENDING / READY / FAILED` 상태, 작성자/시각. 원본 binary·JWT·signed URL·API 비밀값은 DB JSON에 넣지 않는다.
- `seller_os_detail_events`: 초안 revision별 변경 필드·asset ID·작성자·시각. 후보 조사 이력은 수정하지 않고 결과물 변경 이력만 추가한다.
- 예약량·재시도 identity는 Seller OS private schema에서 관리한다. DB 트랜잭션으로 동일 workspace의 총 예약/저장량과 동일 request ID/hash를 직렬화한다. 일반 authenticated/anon에는 직접 쓰기/RPC EXECUTE를 주지 않는다.

새 테이블은 모두 RLS 적용, 기존 owner membership에 한정해 SELECT 허용한다. 쓰기는 인증된 media API의 제한된 서버 RPC만 수행한다. 기존 membership/후보/이벤트의 쓰기 권한은 확대하지 않는다. 구현 때 기존 FK/unique 키를 검사해 같은 workspace의 실제 후보와 연결한다.

### 3.2 API와 인증 경계

별도 `seller-os-media` Edge Function을 사용한다. 기존 `seller-os-agency`의 action/body 계약은 바꾸지 않는다. 게이트웨이 JWT 검증과 `getUser()`를 유지하고, 모든 요청마다 기존 서버 인증 helper와 현재 owner membership을 검사한다. user_metadata는 권한에 사용하지 않는다.

허용 origin은 기존 두 로컬 주소와 정확한 운영 Pages HTTPS 하나뿐이다. 외부 임시 배포 hostname/유사 도메인/임의 origin은 거절한다. CORS는 인증을 대신하지 않는다.

| 기능 | 입력과 계약 | 결과 |
| --- | --- | --- |
| list | workspace, source=1688, offer ID | 초안 revision, 현재 후보 revision과 stale 여부, 해당 상품 READY asset 메타데이터 |
| upload | 같은 상품 식별자, UUID request ID, 후보·초안 기대 revision, 파일 1개 | 검증·용량 예약 후 immutable asset 저장; 성공은 READY asset ID와 최신 초안 revision |
| read | workspace, offer ID, asset ID | 현재 권한과 소속을 다시 검사한 image binary; URL의 토큰 없이 Authorization header 사용 |
| save | UUID request ID, 기대 초안 revision, 제목/소개/asset 순서/카피/검수 항목 | CAS·중복 요청 검증 후 새 revision 및 audit event |

JSON metadata는 64KiB, 업로드 전체 요청은 4MiB+16KiB 이내로 스트림을 읽어 제한한다. Content-Length만 신뢰하거나 무제한 formData를 먼저 만들지 않는다. 네 요청 외의 임의 storage 관리/action/URL fetch를 제공하지 않는다. 업로드 요청 형식/필드의 정확한 직렬화는 구현계획에서 고정하고 인증·한도 테스트에 포함한다.

upload/save는 부모 후보가 NOT_PUBLISHED일 때만 허용한다. 업로드 시작뿐 아니라 최종 DB commit에서 현재 owner membership·같은 상품·부모 후보 revision·초안 revision을 다시 검사한다. 도중에 후보가 변경됐으면409로 거절하고 저장된 object는 미확정·용량 포함 상태로 보존한다. 이미 commit된 동일 request/hash의 재조회는 CAS보다 먼저 replay 판정해 중복 저장을 막는다.

Storage에는 새 bucket용 anon/authenticated INSERT/UPDATE/DELETE/SELECT 허용 정책을 추가하지 않는다. media API가 권한을 검사한 뒤 server-only Storage 클라이언트로 해당 bucket과 서버 생성 경로만 사용한다. 직접 Storage 공개/인증 없는 download/list, 다른 workspace/상품/asset 조합, 경로 추측을 모두 거절하는지 실제 테스트한다. 공유 프로젝트에 광범위한 정책이 새로 생겼다면 적용을 멈추고 기존 정책 변경 없이 해결 가능한지 검토한다.

read 응답은 `Cache-Control: private, no-store`, 올바른 image MIME, `X-Content-Type-Options: nosniff`를 사용한다. 브라우저가 이를 object URL로 표시하며 선택/로그아웃/언마운트 때 취소·폐기한다. 장기 signed URL을 DB, HTML, 로그에 남기지 않는다. 실제 구현에서는 원본 요청 header/token/error body가 로그로 유출되지 않도록 테스트한다.

### 3.3 파일 검증·저장 실패·비용 상한

- 브라우저는 실제 이미지를 디코딩하고 세로 패널을 확인한다. 서버도 extension/MIME뿐 아니라 바이트 시그니처·실제 디코딩·크기 한도를 검사한다. SVG/HTML/GIF/영상/압축파일/손상·가장 파일은 거절한다. 정확한 bounded decoder와 런타임 호환성은 구현계획에서 공식 문서와 함께 결정하며, 확인 전 production 배포를 하지 않는다.
- 정적 이미지, 가로/세로 각각 최대16,384px, 총32MP, 파일4MiB 이내. 제품당 최대20개 asset 및24MiB, workspace 전체64MiB 한도로 시작한다. 활성·제외·교체·실패 후 남은 실제 object와 pending 예약량 모두 비용에 포함한다. 이 한도는 임의 사용량 확대나 영구 무료 보장이 아니다.
- 먼저 검증한 payload hash/byte 수로 DB 예약을 만든 뒤 upsert=false로 고정 object key에 저장하고, 저장 결과를 확인한 다음 READY 및 초안 참조를 commit한다. 같은 요청·같은 bytes는 기존 결과를 조회하며, 같은 request ID의 다른 파일/상품은409로 거절한다.
- DB와 object store는 하나의 원자 트랜잭션이 아니다. 저장 후 DB 응답이 끊기면 새 key로 반복 업로드하지 않는다. 동일 identity로 상태를 조회·확인하고 commit한다. 자동 재시도는 하지 않는다. 확인 전 화면은 저장 성공 대신 동기화 확인 필요로 표시한다.
- 파일은 있는데 참조 확정이 실패한 경우 pending/failed 상태로 보존하고 용량에 계속 포함한다. object 부재가 확인된 예약만 안전하게 해제한다. 정리되지 않은 파일의 자동 삭제나 다른 앱 파일 삭제는 하지 않는다.
- 이번 UI의 제거는 **초안에서 제외**다. 이미 저장된 binary의 영구 삭제·이전 버전 정리는 별도 승인 작업이다. 제외가 무료 사용량을 즉시 줄인다고 안내하지 않는다.
- 생성 직전에 조직 Usage의 Storage/egress/DB/Edge 여유와 기간을 확인한다. 메타데이터 합계만으로 남은 무료량을 확정하지 않는다. 실제 무료 범위가 확인되지 않거나 다른 앱과의 여유가 부족하면 upload disabled + 명확한 사유를 제공하고 클라우드 쓰기를 하지 않는다.
- 최초 운영 저장 허용은 확인 후 최대24시간의 짧은 enable lease로 제한한다. 이 상태/시각/작은 서버 상한은 Seller OS 전용 설정에만 둔다. 검증되지 않은 값으로 enable하지 않으며, 기간 만료 시 새 업로드를 막고 무료 사용량 재확인을 요구한다. 기존 결과 조회도 전송량을 소비하므로 자동 전체 다운로드·프리로드·주기적 binary polling을 하지 않는다. 미리보기는 사용자가 열 때만 해당 패널을 지연 로딩한다. 앱 차원의 제한은 다른 앱의 사용량을 통제하지 못하므로 조직 한도 보장은 하지 않는다.
- 요금제 변경·카드 등록·Spend Cap 해제·유료 이미지 변환·GPT API·새 유료 호스팅을 사용하지 않는다. 여유 부족 시 사용자 승인 없이 업그레이드하지 않는다.

## 4. 기존 화면에 더하는 사용 흐름

선택 상품 inspector의 ZIP 버튼 근처에 **완성 이미지·상세페이지** 진입 액션을 둔다. 기존 상품 갤러리/보류 사유/마진/조사 기록과 별도 sourcing-console은 유지한다. 새 화면이 기존 메인 UI를 대체하지 않는다.

편집 영역은 파일 선택, 순서 이동(위/아래 버튼), 패널별 카피·대체 텍스트, 제목/소개, 검수 항목, 저장, 내부 미리보기로 구성한다. drag-only 조작은 요구하지 않는다. 등록/배송 실행 버튼은 추가하지 않는다. 여러 장은 순차 업로드하며 파일별 성공/실패를 구분하고, 실패 시 전체 성공으로 표시하지 않는다.

파일 선택 직후는 **로컬 선택·미저장**이다. 업로드 전 파일 종류·용량·상품 소속을 확인하고 저장 버튼을 누를 때만 해당 자료를 전용 cloud로 전송한다. ChatGPT, 네이버, 퀵스타 또는 이미지 가공 외부 서비스에 자동 전송하지 않는다. 파일 선택 경로/EXIF를 카피에 사용하지 않는다.

미저장 카피/순서가 있으면 상품 전환 전 저장 또는 취소를 확인한다. 작업 중에는 같은 상품 중복 실행을 막고, 선택·계정 전환 후 늦게 온 응답으로 다른 상품 화면을 바꾸지 않는다. 로그아웃 후 새 쓰기를 막되 이미 서버 commit된 결과를 취소했다고 주장하지 않는다. 재로그인 시 최신 상태를 읽어 충돌을 처리한다.

초안 상태는 `DRAFT / REVIEW_REQUIRED / REVIEWED_INTERNAL`로 제한한다. 사진·순서·카피 변경 시 REVIEW_REQUIRED로 되돌린다. 연결한 후보 revision이 달라지면 읽기 시 stale로 표시하고 검수 완료 배지를 무효화한다. 내부 검수 항목은 상품/옵션 일치, 카피 사실 확인, 이미지 사용권 확인, 미확인 고시·배송정보의 미확정 표시다. 저장 가능한 READY 이미지가 없거나 필수 항목이 미확인이면 REVIEWED_INTERNAL로 바꾸지 못한다.

**REVIEWED_INTERNAL도 판매 통과가 아니다.** 기존 후보 HOLD/NOT_PUBLISHED, 수익성 확정 보류, 사용권/판매 적합성 검증은 독립적으로 유지한다. 미리보기는 저장 초안의 제목/소개/현재 순서 이미지/패널 카피만 React 텍스트 렌더링으로 조립한다. 임의 HTML/script/iframe/외부 URL을 저장·실행하지 않는다. 실제 순수익·배송일·KC 등을 생성해 채우지 않는다.

이번 미리보기는 로그인된 내부 검토용이며 공개 상품 상세페이지나 등록 가능한 이미지 URL이 아니다. 기존 HTML 초안 다운로드와 구분해 설명하고 private blob URL이 들어간 파일을 영구 사용 가능한 등록 자료라고 내보내지 않는다.

## 5. 사용자 요청 1~5의 순서와 완료 증거

### 1 — 비공개 결과물 저장·조회·미리보기

무료 여유/현재 정책 preflight → 새 Seller OS 영역만 추가 → 보호 API/소규모 UI 구현 → permission/CAS/파일/비용 한도 테스트 → 실제 한 상품의 저장·조회·전체 새로고침 검증 순서다. 새 bucket/table/API를 만들었다는 사실만으로 완료하지 않는다. 기존 후보6개/revision/다른 bucket·정책/다른 함수의 변동이 없는지 전후 비교한다.

### 2 — 실제 상품 1개 수동 ChatGPT 왕복

메모함을 **제작 흐름 테스트용**으로 선택하고 기존 ZIP을 다시 내려받는다. 사용자가 압축을 풀고 프롬프트+사진을 ChatGPT에 직접 넣어 만든 실제 결과물을 제공한다. GPT 로그인·계정 한도·생성 실행은 사용자 참여 단계다. 이 구현에서 GPT 데스크톱 조종·새 OAuth·자동 이미지 생성·API 과금은 추가하지 않는다.

실제 결과가 준비되면 명시적으로 파일을 선택·업로드하고 순서/카피/검수 상태를 저장한다. 서버 해시/파일 수/상품 ID를 확인하고 새로고침 뒤 같은 이미지 순서/카피/상태/미리보기인지 검사한다. 합성 fixture나 공급사 원본을 GPT 완성본이라고 기록하지 않는다. 실제 결과물 미제공은 이 단계의 명확한 대기 사유다.

### 3 — 실판매 조건 검토

같은 상품·같은 옵션/구성의 국내 가격·배송비·실제 최근 수요 신호, 공급 안정성, 이미지 사용권, 판매 적합성, 실제 국제배송비를 각각 출처·관찰일·추정/확인 구분과 함께 검토한다. 단순 검색 건수나 누적 리뷰 수만으로 수요가 확정됐다고 하지 않는다. 포장 실측은 사진으로 확정하지 않는다.

퀵스타는 기존 발급 안내/가이드와 계정에서 허용되는 인증·요금/견적 조회 범위를 먼저 확인한다. API가 있다고 견적 조회도 지원한다고 가정하지 않는다. 배송 신청 endpoint는 호출하지 않고 고객의 이름·주소·통관정보를 견적 테스트에 전송하지 않는다. 필요한 실측·견적·권리 근거가 없으면 해당 사유와 배송비 범위/음수 시나리오를 유지한다. 이 단계의 완료는 **검토 결과 기록**이며 판매 통과를 강제하지 않는다.

새 근거가 기존 검토 상태를 무효화하면 기존 검증된 candidate update/research 경로를 사용한다. 이번 결과물 저장 API에 비용·판매 승인 쓰기를 추가하지 않는다. 법/인증 기준은 당시 공식 근거를 확인하며 기술 테스트 통과를 적법성 인증으로 표현하지 않는다.

### 4 — 기존 네이버 인증·읽기 연동 마무리

기존 `docs/naver-commerce-local-runbook.md`와 구현된 token+두 GET 경로를 재사용한다. 전용 앱·현재 PC 공인 IPv4·판매자정보 그룹을 사용자가 확인하고, 서버 전용 키 두 개를 ignored `.env.local`에 직접 입력한다. 로그인/약관/키 입력이 필요한 실제 시점에 해당 창이나 파일을 열고 사용자에게 안내한다. 비밀값을 채팅/화면 캡처에 받지 않는다.

로컬 인증 조회 → 실제 스토어명/채널/주소 직접 대조·최초 확인 → 보호 cloud snapshot 저장 → 로컬 새로고침 검증이 완료돼야 연결 완료다. 외부 전체 새로고침 검증은5의 최신 배포에서 이어 확인한다. 키/IP/권한 대기 상태는 미연결로 표시한다. 과거 승인 메세지나 단위 테스트로 실제 인증을 대신하지 않는다.

### 5 — 기존 무료 Pages에 검증된 최신판 반영

사용자는 이번 요청에서 기존 `seller-os-delightfilm`의 최신판 배포를 승인했다. 새 프로젝트·도메인·유료 Worker를 만들지 않고 현재 무료 상태·용량/업로드 한도를 재확인한다. 다른 자동매매봇·Oracle·다른 Cloudflare 앱을 건드리지 않는다.

새 media backend가 permission 테스트를 통과한 뒤 최종 빌드를 만들고 **검증된 dist 파일만** 기존 프로젝트에 직접 업로드한다. 서버 코드·.env·사용자 파일·원본 사진·node_modules·브라우저 프로필은 배포하지 않는다. 기존 정확한 운영 origin을 유지하고 wildcards/임시주소를 추가하지 않는다.

배포 ID/자산 바이트·SHA/HTTPS200/SPA 경로를 확인한 후 기존 운영자 로그인으로 후보6개/결과물/미리보기/네이버 마지막 확인 상태를 읽는다. 전체 새로고침 후 자료가 유지되는지 확인한다. 외부에서 localhost·CDP·로컬 키 검증을 호출하지 않는지 실제 관찰 가능한 범위로 검사한다. 실키 확인이 막힌 경우4는 완료가 아니며5 배포 실행 전 대기 이유를 보고한다. 사용자 단계 대기 중에는 배포 준비까지만 하고 순서 완료를 꾸미지 않는다.

## 6. 필수 검증과 실패 처리

- 파일: 실제 사진 decode/치수/SHA, PNG/JPEG/WebP, 손상/가장/과대 byte·pixel,20개/24MiB/64MiB 및 예약 경쟁, 부분 실패, 중복/충돌 요청, object 저장 후 DB 응답 소실.
- 권한: 비로그인·가짜 JWT·익명 계정·비회원·다른 workspace/상품의 asset ID·임의 key 거절; 정상 owner만 read/write. 직접 Storage 조회/업로드도 거절. 허용 origin/유사·외부 origin 차단.
- 초안: 독립 revision CAS, 순서에 다른 상품/중복/missing asset 포함 거절, 순서·카피 수정과 source revision 변경 시 검수 무효화, 거래 상태 변경 불가, 오래된 사용자/응답 무시, 취소·로그아웃·미저장 전환.
- 실제 검증: 사람 제공 GPT 결과로 upload/read/reload/preview, 로컬과 배포 화면의 동일성. 실제 로그인 HTTP 증거와 SQL role 시뮬레이션을 따로 기록한다. owner JWT를 브라우저 저장소/네트워크에서 추출하지 않는다.
- 회귀: `npm test`, `npm run build`, 활성 root 의존성을 보존하는 별도 clean `npm ci`, `git diff --check`. 현재8개 audit 경고/큰 번들 등 기존 문제는 숨기지 않고 별도 범위로 둔다.
- 기존 다른 앱의 bucket·정책·함수 manifest와 Seller OS 후보 수/revision을 전후 비교한다. 라이브 테스트는 명시된 Seller OS 테스트 자료만 사용하며 영구 삭제가 필요한 정리는 승인받는다.
- 실패한 명령/HTTP 상태/미확정 사실을 HANDOFF에 기록한다. 후보를 임의 통과시키거나 가짜 성공 snapshot/미디어를 실데이터로 남기지 않는다.

## 7. 전개·롤백과 현재 단계

구현계획은 이 설계의 사용자 검토 후 작성한다. 외부 시스템 변경 전 최소 구현·테스트와 독립 검토를 마치며, 실행 방법도 계획 검토에서 선택한다. 개발은 현재 전용 작업 브랜치에서 하고 검증 후 commit/push하되 main에는 merge하지 않는다.

롤백은 새 media 진입점을 끄고 검증된 이전 Pages 자산을 다시 배포하는 방식이다. 새 전용 bucket/metadata/history와 모든 기존 후보·Auth·다른 앱 자료는 보존한다. DB reset/blanket push/whole-schema overwrite/DROP CASCADE/자동 파일 삭제는 사용하지 않는다. 기존 shared project의 보안 advisory를 이 작업 중 임의 수정하지 않는다.

사용자가 후속 구현계획과 Native 실행을 승인했다. 계획의 소스 검증·무료 사용량·권한 게이트에 따라 구현하며, 각 단계의 실제 증거가 없으면 완료로 보고하지 않는다.

## 참고한 공식 근거

- Supabase private bucket 다운로드/권한: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Storage RLS/서비스 키 경계: https://supabase.com/docs/guides/storage/security/access-control
- Storage 사용량/월간 산정: https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- 전송량: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- 최근 TLS 변경 공지: https://supabase.com/changelog/cbc-tls-ciphers-deprecated (현재 Node/최신 브라우저의 TLS1.3 사용을 훼손하는 우회 설정은 하지 않음)
- Pages 한도/기존 직접 업로드: https://developers.cloudflare.com/pages/platform/limits/ 및 `docs/operations/seller-os-pages.md`

2026-10-15의 read-only 공식 문서/프로젝트 조회를 근거로 작성했다. 유료 API나 새 리소스를 만들지 않았으며 계정 전체 무료 여유/egress는 클라우드 적용 직전 별도 확인 조건이다.
