# 비공개 상세페이지 결과물 운영

현재 상태(2026-10-16): 새 비공개 DB/bucket/API 적용 및 정상 로그인 UI의 기술 fixture 저장·재조회·새로고침 검증 완료. 기존 C UI/후보/다른 앱은 보존했다. 실제 GPT 결과물은 아직 제공되지 않았으며 2→5단계와 Pages 최신판 배포는 미완료다. 테스트 통과는 판매 승인·네이버 연결 완료를 뜻하지 않는다.

## 실제 적용·검증 기록

- 전용 프로젝트 `dzgczkwwezzsfqnjdqen`에 새 migration만 적용: 로컬 파일 버전 `20261015145622`, connector가 기록한 remote version `20261015154235`. 과거 migration을 rename하거나 blanket db push하지 않는다.
- 새 `seller-os-media` v1, JWT 검증 활성. 반환된 runtime 12개 파일은 제출 source와 일치(배포 manifest14개 중 NOTICE/lock은 runtime 조회에 미포함). 기존5함수의 버전/hash/JWT 설정과 다른3private bucket/8정책은 그대로다.
- Hosted startup log `2026-10-15T15:52:17.731Z`: `ready=true, fixtures=4, elapsedMs=130`. 자체 생성3format+8MP probe이며 coldstart마다 비용이 있다. 동시부하/hosted peak RSS 실측은 아니므로 그 보장을 주장하지 않는다.
- Free Usage 확인 `2026-10-15T15:35:04Z`, 11Oct–11Nov주기: Storage0.813/1GB평균, Egress2.95/5GB, DB0.033/0.5GB, Edge49533/500000. 당시19object817105361B는 별도 계수다. Usage는 지연될 수 있고 다른 앱이 같은 무료량을 사용한다.
- 제한 lease: 저장64MiB/read64MiB, **2026-10-17 00:35:04 KST 만료**. 자동갱신 없음. 만료 후 실제 Usage/정책을 다시 확인하기 전 upload/read 비활성. 무료 플랜/청구설정 변경 없음.
- 메모함675246155709의 자체 투명 PNG `TEST_ONLY_NOT_PRODUCT.png`: 31,179B,2000×4000, SHA256 `164828886d4ab2f49827a103ae5fed2bc13305a1b5ac6de5d00f2b68fff665a6`. 정상 UI 업로드→서버 readback SHA→카피저장r2→이미지 조회→전체 새로고침r2 확인. 최종r3는 기술 파일을 **초안에서 제외**하고 제목/소개/패널을 비웠으며 검수메모와 retained파일/용량만 보존, 모든check=false/REVIEW_REQUIRED다. 원래 후보 revision4/HOLD는 변경하지 않았다.
- 실제 HTTP 무인증/forged JWT/공개 Storage 경로 거절3PASS, owner JWT 자동test1SKIP(브라우저 JWT를 추출하지 않음). 실제DB BEGIN/ROLLBACK으로 owner/nonmember/anon/CAS/quota/RPC권한을 검증했고 정상owner role의 직접Storage SELECT도0행 확인. SQL role simulation은 타계정의 실제HTTP로그인 검증이 아니다.
- 처음70B 자체 PNG는 브라우저가 decode거절하여 업로드하지 않았다. 검증용 생성기로 올바른 자체8MP PNG를 새로 생성한 뒤 성공했다. 다른 제품사진/GPT결과물로 위장하지 않았다.
- 독립 코드리뷰4Important는 한 TDD수정pass로 해결. UI finish검토의 미저장확인 focus/scroll 및44px 타겟2건도 한batch수정 후 두 finding 모두resolved/ship(그두건 범위). 다크모드/스크린리더/실제GPT여러패널순서 변경은 아직 live검증하지 않았다.

다음 필요한 사용자 자료는 **실제 ChatGPT 제작 이미지**다. 메모함 ZIP의 프롬프트와 source사진7장을 수동으로 사용해 제작하고 같은 상품에서 업로드한다. 원본 이미지 권리 미확정 및 음수 마진은 그대로이며 흐름테스트가 판매적합성을 뜻하지 않는다. 그 후 실판매근거 검토→로컬 Naver키/IP/스토어확인→기존 무료 Pages promotion 순서로 재개한다.

## 사용자 흐름

기존 발굴 갤러리에서 상품 선택 → GPT 이미지 제작 자료 ZIP 다운로드 → 사용자가 ChatGPT에서 프롬프트와 사진으로 제작 → 같은 상품의 **완성 이미지·상세페이지** → 파일 선택 → 명시적 비공개 업로드 → 카피·순서·검수 저장 → 내부 미리보기. 파일 선택만으로 전송하지 않는다. 실제 결과물이 없으면 이 왕복은 미완료다.

- 정적 PNG/JPEG/WebP, 파일당4MiB·8MP, 각변16384px 이하. 자동 재인코딩/상품 변형 없음.
- 제품당20개/24MiB, workspace64MiB. 제외·미확정·실패 후 남은 object도 포함한다.
- 미리보기는 버튼을 눌렀을 때만 인증된 binary를 가져온다. 공개 URL/signed URL/영구 등록 HTML은 만들지 않는다.
- 초안에서 제외는 삭제가 아니다. 기존 파일과 사용량은 보존된다.
- 내부 검수는 판매 승인이 아니다. 기존 HOLD/NOT_PUBLISHED·수익성 확정 보류는 그대로다.
- 저장 결과가 불확실하면 같은 request ID/고정 payload로 확인한다. 새 object key로 자동 재시도하지 않는다.
- 카피 수정 후 업로드하려면 초안을 먼저 저장한다. 닫기/ESC는 미저장 확인, 처리 중 닫기는 차단한다. 계정 변경 시 요청과 object URL을 폐기한다.

## 배포 게이트

1. `npm test`, build, 격리 npm ci, Deno check 및 실제3codec, local SQL rollback 검증. 독립 코드/UI 검토.
2. 기존 프로젝트 `dzgczkwwezzsfqnjdqen`의 실제 Free Usage기간·Storage/egress/DB/Edge 여유와 현재 Storage 정책 확인. 817MB 같은 object 합계만으로 잔여량을 판단하지 않는다.
3. **새** migration `20261015145622_seller_os_private_detail_media.sql`만 forward apply. 다른 bucket/Auth/후보/함수 변경 금지. 새 bucket collision은 중단 사유다.
4. 새 `seller-os-media`만 JWT 검증 활성으로 배포. 실제 hosted decode 자원 검증 전 budget 비활성 유지.
5. 확인 시각부터 최대24h private budget lease.64MiB 저장/64MiB read allowance; readback/preview를 각2배 bytes로 차감. 만료 시 재확인 전 업로드/read 차단.
6. 명시적 TEST_ONLY 기술 fixture로 정상 owner 저장/read/reload, 무권한·직접Storage·cross-scope 거절. GPT 제작 증거와 분리. fixture는 초안에서 제외하고 object는 보존/계수.
7. 실제 GPT 왕복 → 실판매 근거 검토 → 기존 Naver 실제 키/스토어 확인 → 기존 무료 Pages에 dist만 업로드 순서.

## 구현 경계

새 public `seller_os_detail_sets/assets/events`, private `media_requests/media_budget`, server-only SECURITY INVOKER RPC. 기존 후보 revision과 독립 CAS, 원본 SHA 검증. RLS owner SELECT, end-user 직접 쓰기/RPC/storage 정책 없음. actor는 Edge getUser 결과만 사용하며 익명 사용자는 거절한다. 공유 관리자/service-role의 프로젝트 전체 접근은 기술적으로 남아 있으며 물리 격리는 아니다.

quota 설정은 trusted 운영 경로에서만 변경한다. 브라우저/API에 enable 기능을 제공하지 않는다. 신규 budget row가 없으면 disabled다. 임의 유료 플랜·카드·API·Spend Cap 변경은 금지다.

## 로컬 검증

`node scripts/prepare-media-codecs.mjs`: exact3package decode-WASM만 재현 생성. NOTICE와 hashes 확인. encode-WASM은 Edge/dist에 포함하지 않는다.

선택적 SQL 검증 도구는 application dependency가 아니다: `npm install --prefix .seller-os/sql-test --no-save --ignore-scripts @electric-sql/pglite@0.5.10`, 이후 `node scripts/test-media-sql-local.mjs`. 임시 Postgres-WASM에서 기존 foundation와 새 migration/rollback SQL을 실행한다. 로컬 모형 Auth/Storage schema이며 hosted RLS/HTTP 증명을 대신하지 않는다.

롤백은 새 진입점 비활성/이전 Pages 자산 복원이다. 자료·후보·bucket/Auth를 삭제하거나 스키마 reset하지 않는다.
