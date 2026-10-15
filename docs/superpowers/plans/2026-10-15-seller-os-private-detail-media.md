# Seller OS Private Detail Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 상품에 비공개 완성 이미지·순서·카피·내부 검수를 저장하고, 실제 수동 GPT 왕복 → 실판매 조건 검토 → 기존 네이버 조회 연결 → 기존 무료 Pages 배포까지 증거로 검증한다.

**Architecture:** 기존 후보 API/JSON을 변경하지 않고 독립 media metadata/RPC와 private bucket, JWT+owner 보호 Edge Function을 추가한다. 브라우저는 기존 인증 클라이언트의 세션 무효화 경계를 재사용하고, binary를 authenticated POST로 받아 object URL 내부 미리보기로만 사용한다. 공유 프로젝트·다른 bucket·Auth·네이버 거래 API는 변경하지 않는다.

**Tech Stack:** 기존 React19.2.8/Vite8.2.1/Node test/Deno/SupabaseJS2.117.3/Postgres17. Decoder는 `@jsquash/jpeg@1.6.0`, `@jsquash/png@3.1.1`, `@jsquash/webp@1.5.0`의 실제 WASM decode를 사용한다. dependency/lockfile 변경은 실행 승인 후에만 한다.

**Spec:** `docs/superpowers/specs/2026-10-15-seller-os-private-detail-media-design.md` (2026-10-15 사용자 서면 승인).

**Status:** 구현계획 검토·실행 방식 확인 대기. 현재 제품 코드·의존성·클라우드 변경 없음. 권장 실행은 Native이며, 구현 전 이 계획 검토가 필요하다.

## Global Constraints

- 현재 사용자 디렉터리/작업 브랜치만 사용. 기준64cee55, `main` 병합 금지. AGENTS/HANDOFF/승인 spec을 읽고 관련 없는 변경을 보존한다.
- 기존 SmartStoreSellerOS C UI, sourcing-console 별도 경로, 기존64KiB 후보 API/후보 revision/6HOLD/NOT_PUBLISHED를 유지한다.
- 프로젝트 `dzgczkwwezzsfqnjdqen`, workspace `ccb5017e-7c70-414d-b103-38e17e48e799`, 새 private bucket `seller-os-detail-media`만 사용. 다른 세 bucket·권한·파일·Auth·기존 함수·다른 앱/봇/DNS를 수정하지 않는다.
- 허용 origin은 `http://127.0.0.1:5173`, `http://localhost:5173`, `https://seller-os-delightfilm.pages.dev`만. JWT gateway+getUser+현재 owner membership 필수. 서비스 키는 Edge 런타임에만 남긴다.
- staticPNG/JPEG/WebP,4MiB/file,16,384px/각변,32MP,20assets+24MiB/product,64MiB/workspace. PNG acTL/WebP animation/GIF/SVG/HTML/압축파일/가장·손상 이미지는 거절한다.
- 후보/초안 revision CAS, request UUID/hash 재사용 검증, 저장된 object+미확정 object+pending 예약을 모두 용량에 포함. hard delete/overwrite/자동 재시도 없음.
- 이미지 상태 DRAFT/REVIEW_REQUIRED/REVIEWED_INTERNAL은 판매 승인 아님. 파일·순서·카피·source revision 변경 시 내부 검수 무효화. 미확인 수익·배송·권리·고시를 만들어 채우지 않는다.
- 무료 여유·현재 정책·런타임을 확인하지 못하면 실제 업로드 비활성. 단순 현재 object 크기를 월간 과금 잔여량으로 사용하지 않는다. 유료 변경·새 hosting·GPT API·상품 등록/배송/주문/결제 금지.
- TDD RED→GREEN→전체 suite, 실제 브라우저/권한/저장/전체 새로고침 증거. SQL role simulation/fixture/실제 GPT 결과/실제 네이버 연결은 각각 구분해 보고한다.

## Review Focus

1. 업로드가 성공했으나 응답/DB commit이 끊긴 요청: 같은 request/hash로 확인하고 object 중복·용량 누락이 없어야 한다 (Tasks2/3).
2. 파일 선택/카피 편집 중 계정·상품·후보 revision이 바뀜: 타 상품 저장·늦은 미리보기·작업 유실을 막아야 한다 (Task4).
3. PNG/WebP animation, EXIF 회전 JPEG, 헤더는 맞고 데이터가 깨진 이미지, 디코더 메모리/CPU 초과: 정상 사진을 왜곡하지 않고 실패를 저장 성공으로 만들지 않아야 한다 (Tasks1/3).
4. 다른 앱이 공유 무료량을 사용하거나 lease 만료 중 병렬 upload/read: 정책/예산 확인 없이 저장하거나 한도를 우회하지 않아야 한다 (Tasks2/5).
5. 제외/과거 asset와 후보 변경 후 오래된 내부 검수: 비용은 계속 집계하고 판매 통과/새 검수로 오인시키지 않아야 한다 (Tasks2/4).

## Shared Interfaces and File Map

타입은 JS 객체 계약이다. 기존 프로젝트처럼 `.js`/`.jsx`, Edge 진입만 `.ts`로 유지한다.

- `src/domain/detailMedia.js`: `MEDIA_LIMITS`, `validateDraft({candidate,previous,input,assets}) -> DetailDraft`, `draftView({draft,candidate,assets}) -> DetailSnapshot`. `Scope={workspaceId,offerId}`; source는 서버에서1688고정. `DetailDraft={revision,sourceCandidateRevision,title,intro,panels:[{assetId,copy,alt}],review:{status,checks:{optionMatch,copyFacts,imageRights,unknownsLabelled},note}}`. 사용자`DraftInput`은title/intro/panels/review만허용하고revision은요청의expected필드에서만받는다. title200/intro4000/copy2000/alt300/note2000문자; panel최대20, 중복/타상품asset 불가.
- `server/media/imageValidation.js`: `inspectImage(bytes,mime) -> {mime,ext,width,height}` (시그니처/프레임/헤더 한도), `validateUploadedImage(bytes,mime,{decode}) -> Promise<ImageMeta>`; `ImageMeta={mime,ext,width,height,byteLength,sha256}`.
- `server/media/jsquashDecoder.js`: `createJsquashDecoder({wasmBytes}) -> {decode(bytes,mime):Promise<{width,height,data}>}`. `wasmBytes={jpeg,png,webp:Uint8Array}`. 실제 decode 전에 inspect 결과를 검사하고 한 isolate에서 동시에 한 파일만 decode한다. Node/Deno의 ImageData 호환도 이 경계에서 처리한다.
- `server/media/store.js`: `createMediaStore({client,writer,workspaceId,actorId}) -> {list(offerId),reserve(input),finish(input),save(input),asset(offerId,assetId),readPermit(offerId,assetId)}`. 다음 SQL 계약만 사용하고 arbitrary table/bucket/path를 받지 않는다. 초안이 없을 때 list는 revision0/empty panels/REVIEW_REQUIRED를 반환하고, 첫 finish/save가revision1을만든다. finish는READY새asset만emptycopy/alt패널로append한다.
- `server/media/handler.js`: `createMediaHandler({allowedOrigins,authenticate,storeFor,storage,validateImage}) -> (Request)=>Promise<Response>`. 기존 `server/cloud/auth.js`, `errors.js`를 수정하지 않고 재사용한다.
- `src/data/mediaClient.js`: `createMediaClient({config,workspaceId,getAccessToken,fetchImpl,getGeneration}) -> {list(scope),upload(scope,request),read(scope,assetId),save(scope,request),abort()}`; `read -> {bytes:Uint8Array,mime}`. 자동 retry 없음. 같은 미확정 write 재시도는 같은 requestId와 frozen payload를 유지한다.
- `src/dashboard/detailMediaController.js`: `createDetailMediaController({client,onState,createObjectURL,revokeObjectURL}) -> {load(scope,candidateRevision),edit(patch),selectFiles(files),uploadSelected(),save(),preview(assetId),requestSwitch(nextScope),dispose()}`. `requestSwitch`는dirty여부의decision만반환하고scope변경은하지않는다. 승인된전환후호출자가load한다. `preview`는동일asset의진행중요청을공유하고읽은bytes를open중에만objectURL로보유한다.
- UI 새 `src/dashboard/{DetailMediaPanel,DetailMediaPreview}.jsx`; 변경 `CandidateGallery.jsx`, `src/styles.css`. transport 연결만 `src/data/workflowClient.js` 변경. `AuthProvider`/기존 로그인 동작은 보존한다.
- 새 Edge `supabase/functions/seller-os-media/{index.ts,deno.json,deno.lock,codecBytes.js,CODECS_NOTICE.txt}`. `codecBytes.js`/NOTICE는 고정 decoder 패키지에서 재현 생성하는 서버 자산이며 사용자 사진이 아니다. browser bundle/dist에 포함하지 않는다.
- 새 `scripts/prepare-media-codecs.mjs`, `scripts/check-media-preflight.mjs`, `test/{detailMedia,imageValidation,mediaStore,mediaHandler,mediaClient,detailMediaController}.test.js`, `test/sql/seller-os-media.sql`, `test/integration/mediaPermissions.test.js`, `docs/operations/seller-os-detail-media.md`. 기존 package/lockfile은 decoder dependency3개만 정확 버전 추가한다.

## Task 1: Bounded Image Validation and Reproducible Runtime

**Files:** domain/validation/decoder/generator와 해당3test 파일, package/lockfile, Edge deno.json/codecBytes/NOTICE. 생성 자산 provenance는 정확 package version/file path/byte SHA로 기록한다.

**Interfaces:** 위 `ImageMeta`, `DetailDraft`, decoder factory를 제공한다. Decoder 입력은 byte+허용 MIME만, remote URL이나 filename decode는 없다.

- [ ] **Step1 RED:** `imageValidation.test.js`에 `valid_png_jpeg_webp_decode_and_hash`, `reject_mime_spoof_truncated_animation`, `reject_4194305_bytes_16385_side_32000001_pixels_before_decode`, `jpeg_exif_orientation_no_pixel_mutation`을 작성한다. 알려진 fixture byte SHA와 literal 치수 비교, 실제 decoder로 깨진 pixel stream 거절을 확인한다. `detailMedia.test.js`에 empty/duplicate/foreign asset 거절, 필수check없음의 REVIEWED_INTERNAL 거절, 카피/순서/source변경 시 REVIEW_REQUIRED 및 후보JSON 불변을 assert한다.
- [ ] **Step2:** `node --test test/imageValidation.test.js test/detailMedia.test.js` 실행, 누락된 기능 때문에 실패하는지 확인한다. 테스트 fixture는 자체 생성 단색/도형 사진이며 TEST_ONLY 명시, 공급사 사진/GPT 완성본이라고 저장하지 않는다.
- [ ] **Step3:** 실제 byte/header 한도 검사 후3고정 decoder로 full raster decode한다. `@jsquash/jpeg@1.6.0`, png3.1.1, webp1.5.0을 설치/lock한다. server decode는 제품을 재인코딩하지 않는다. SHA는 입력 원본으로 계산한다. decoder 오류/자원 초과는 명시적인 `MEDIA_IMAGE_INVALID`/`MEDIA_DECODE_LIMIT` 오류이며 DB 예약 전에 거절한다. Free Edge의운영상decode상한은8,000,000pixels로더보수적으로시작한다(설계의32MP는형식상최대). 이를넘으면자동변형하지않고긴이미지분할/작은출력필요를안내한다. 이운영상제한도계획검토대상이며8,000,001pixels에서decoder호출0을테스트한다.
- [ ] **Step4:** 생성기는 설치된 decode WASM3개만 읽어 base64 JS와 NOTICE/원본hash를 만든다. 확인된 원본 크기는166470/181088/137960bytes(계485518)이며 변경 시 무조건 실패한다. npm integrity와 license도 확인한다. Node는 bare package import, Edge deno.json은 같은 exact npm version 매핑을 사용한다. jpeg/webp init에는 미리 compile한 WebAssembly.Module, png init에는 wasm Uint8Array를 전달해 런타임 CDN fetch/파일 download를 없앤다. encode WASM은 넣지 않는다.
- [ ] **Step5:** 실제 Node/Deno 동일 fixture decode, lazy initialization/동시 요청 직렬화/메모리 압박 fixture 검증. `deno check --config supabase/functions/seller-os-media/deno.json supabase/functions/seller-os-media/index.ts`는Task3진입 생성 후 재실행하고생성deno.lock을고정한다. Docker는 현재 없으므로 설치하지 않는다. API배포5MB에 충분한지 실제 배포 package 크기를 검사한다. 256MB/2초CPU 한도에 맞는 hosted probe 전에는 호환 완료라고 하지 않는다. 적합한 decoder/패키징/런타임이 성립하지 않으면 보안을 생략하거나 유료 우회하지 말고 중단 보고한다.
- [ ] **Step6:** focused tests→`npm test`→`npm run build` GREEN. 브라우저 bundle에 WASM/Node fs/비밀값이 들어가지 않았는지 산출물 manifest로 확인하고 이 task만 commit한다.

첫 RED assertion의 고정값(나머지 정상/손상 fixture는 자체 제작2x3pixel로 준비):
```js
assert.throws(() => inspectImage(new Uint8Array(4194305), 'image/png'), {code:'MEDIA_IMAGE_TOO_LARGE'});
assert.throws(() => inspectImage(new TextEncoder().encode('<html>login</html>'), 'image/png'), {code:'MEDIA_IMAGE_INVALID'});
```

## Task 2: Private Metadata, CAS, Quota Reservations and Audit

**Files:** 새 CLI 생성 forward migration, `server/media/store.js`, `test/mediaStore.test.js`, `test/sql/seller-os-media.sql`. 임의 timestamp migration명을 만들지 않는다: official CLI의 `migration new seller_os_private_detail_media`를 실행하고 반환된 실제 경로를 task 기록에 고정한다. 기존 migration은 수정/재적용하지 않는다.

**Interfaces:** public RPC `seller_os_media_reserve(p_workspace uuid,p_actor uuid,p_request uuid,p_offer text,p_candidate_revision integer,p_detail_revision integer,p_fingerprint text,p_meta jsonb) -> jsonb`; `seller_os_media_finish(p_workspace uuid,p_actor uuid,p_request uuid,p_object_meta jsonb) -> jsonb`; `seller_os_media_save(p_workspace uuid,p_actor uuid,p_request uuid,p_offer text,p_candidate_revision integer,p_detail_revision integer,p_fingerprint text,p_draft jsonb) -> jsonb`; `seller_os_media_read_permit(p_workspace uuid,p_actor uuid,p_offer text,p_asset uuid) -> jsonb`. actor는 authenticate 결과만 전달한다.

- [ ] **Step1 RED:** `mediaStore.test.js`에 old revision409, 동일id/hash replay, 동일id/다른파일409, 동시19→20→21개와24MiB/64MiB 초과, parentrevision/owner변경 중 finish거절, orphan계수 유지, replay가 CAS보다 우선임을 literal fixture로 assert한다.
- [ ] **Step2:** `node --test test/mediaStore.test.js` RED 확인 후 service adapter를 작성한다. DB tests는 BEGIN/ROLLBACK안의 별도 명시fixture만 쓰며 SQLrole simulation을 실제HTTP검증이라고 부르지 않는다.
- [ ] **Step3:** 새 tables `seller_os_detail_sets/assets/events`, private `media_requests/media_budget`를 만든다. candidate FK는 기존 `(workspace_id,source,offer_id)`를 참조하고 cascade delete를 사용하지 않는다. asset PK UUID, requests의workspace+requestunique, event초안revisionunique. 새 tables RLS+ownerSELECT, anon/auth directwrite/RPCexecute거절, service-only SECURITY INVOKER RPC에서 현재membership/후보NOT_PUBLISHED를 재확인한다. source는1688고정, 경로는DB예약asset UUID로 도출한다.
- [ ] **Step4:** 동일workspace transaction lock 안에서 storage비용 및assetcount를 예약한다. `media_budget`는 checkedAt/enabledUntil/checkedBy와 새쓰기/read byte allowance를 가진다. default disabled, lease≤24h, user API로 enable불가. 계획의 보수적 read allowance는 lease당64MiB이며 readback/preview 응답을 각2×byte로 예약한다. reserve는upload검증readback도미리예약하고, PENDING상태의재시도readback마다read허용량을추가차감하되파일저장예약은중복하지않는다. COMMITTED동일요청은object I/O없이replay한다. object와 초안에서제외된asset도 계속 집계한다. 확실한 object404만 미사용예약 해제, 이미 있는 object는 unknown 상태여도 비용0으로 만들지 않는다.
- [ ] **Step5:** read_permit도 현재owner/상품/READY상태/예산lease를 검사해 경로·MIME·byteLength와 read byte 예약을 반환한다. direct Storage anon/auth grant/policy를 만들지 않는다. bucket create는4MiB/static3MIME/private만, 기존bucket upsert 또는전역정책 수정 없음.
- [ ] **Step6:** rollback SQL에 owner/nonmember/anon SELECT·직접write/RPC거절, crossworkspaceFK, source변경검수무효화, budget만료/병렬예약, 모든view의JWT/path누출없음을 assert한다. 로컬DB가 없으면 라이브 적용 전 test불가 상태를 명시하고Task5에서 먼저 실행한다. 아직 공유DB에 migration을 적용하지 않는다. focused+전체tests GREEN 및 migration검토 후 commit.

store행동의 RED assertion(complete store fixture는 candidate4/detail2, valid owner, 여유 있는 활성lease로 시작):
```js
await assert.rejects(store.save({offerId:'675246155709', expectedCandidateRevision:4, expectedDetailRevision:1, requestId:crypto.randomUUID(), draft:{title:'메모함',intro:'검수 전',panels:[],review:{status:'REVIEW_REQUIRED',checks:{optionMatch:false,copyFacts:false,imageRights:false,unknownsLabelled:false},note:''}}}), {code:'REVISION_CONFLICT'});
// 같은 request/hash를두번reserve해도두번째assetId는첫번째와같고저장예약증가가없어야한다.
```

## Task 3: Protected Media API and Failure-Safe Binary Storage

**Files:** `server/media/handler.js`, `supabase/functions/seller-os-media/index.ts`, `test/mediaHandler.test.js`, `test/integration/mediaPermissions.test.js`, `scripts/check-media-preflight.mjs`.

**Interfaces:** JSONPOST `list/read/save`는 `{action,workspaceId,offerId,...}`이며 source/path/bucket입력 없음. save는 `{requestId,expectedCandidateRevision,expectedDetailRevision,draft}`; read는 `{assetId}`. upload는 multipartPOST의 **meta/file 두 part만** 허용: meta는 `{action:'upload',workspaceId,offerId,requestId,expectedCandidateRevision,expectedDetailRevision}` UTF8≤8192bytes, file1개≤4MiB, 전체≤4MiB+16KiB. 이름은 표시용basename120자만, 요청 fingerprint는 정규화meta+원본SHA/byteLength/MIME로 서버 계산한다. Response snapshot은 `{draft,candidateRevision,stale,assets,budget}`; assetDTO는 `{id,mime,width,height,byteLength,sha256,displayName,status}`이며 실제 storage key/token 없음.

- [ ] **Step1 RED:** 실제 Request/Response로 `mediaHandler.test.js` 작성: wrongorigin/forgedtoken/nonowner/crossoffer/unknownfield/multiplefile/streamlimit 거절 및 저장호출0; 정상PNG fullvalidate/immutable upload/finalize; upload성공후응답소실→동일id재조회가object중복0; candidate변경 후finish409+orphan계수유지. body SDK오류/token은 응답/log에 넣지 않는다.
- [ ] **Step2:** `node --test test/mediaHandler.test.js` RED 확인. `createMediaHandler` 구현: exactorigin→boundedbodyshape→getUser/owner→validatefile→reserve→private upsert=false upload→같은keyreadback SHA확인→finish. uncertain replay는 같은key만조회한다. 파일body를보관한대기요청은최대1개만허용하고초과는429로거절하여decode직렬화대기메모리증가를막는다. 기존function/auth/후보handler는 변경하지 않는다.
- [ ] **Step3:** binary read는 read_permit가돌려준새bucket/고정key만 가져오고, 4MiBstream한도/저장SHA/헤더MIME를 확인한다. `private,no-store`/nosniff 응답, signedURL/HTML응답없음. upload/read 외 임의remote fetch는 없다. abort/timeout은 성공을추정하지 않으며 재시도는 사용자가같은identity로만 한다.
- [ ] **Step4:** Edge진입은 `npm:@supabase/supabase-js@2.117.3`와 현재authhelper, 새handler/store/decoder만 조립한다. gateway verify_jwt=true를 유지한다. `deno check .../index.ts`, Node+실제Deno fixture 검증, generatedsource/hash/totalbundle≤5MB 확인. 기존함수getUser/claims나서비스키설정은수정하지 않는다.
- [ ] **Step5:** integration test는 live명시flag없으면SKIP. 익명/forged/foreignorigin deny는 쓰기 없이실행, ownerJWT가안전하게별도제공되지않으면 owner자동검증SKIP+실제로그인UI로대체증거기록. 브라우저JWT추출금지. Task5에서올바른origin·새bucket직접접근거절·지정TEST_ONLY자료저장/read를확인한다. focused→전체suite/build GREEN, scopedcommit.

실제handler에대한 RED assertion(위 factory로 만든 `handler` 사용):
```js
const denied = await handler(new Request('https://unit.test/media', {method:'OPTIONS', headers:{origin:'https://seller-os-delightfilm.pages.dev.evil.test'}}));
assert.equal(denied.status, 403);
assert.equal(denied.headers.get('access-control-allow-origin'), null);
```

## Task 4: Existing C UI — Result Upload, Copy, Ordering and Internal Preview

**Files:** `src/data/mediaClient.js`, `src/data/workflowClient.js`, controller/Panel/Preview/3tests, `CandidateGallery.jsx`, `src/styles.css`, `docs/operations/seller-os-detail-media.md`.

**Interfaces:** `createWorkflowClient`가 같은generation/getAccessToken을 공유하는 `.media`를 제공한다. 기존 `.invalidate()`가 `.media.abort()`도 호출한다. `AuthProvider`, 기존API request signature/64KiB 경로, Commerce/worker동작은바꾸지 않는다. controller state는 `{scope,draft,assets,selectedFiles,dirty,busy,message,previewUrls,conflict}`. bytes/file은Reactrender마다복제하지 않는다.

- [ ] **Step1 RED:** transport와controllertest 작성: logout/다른계정/oldgeneration응답무시, binarybound/no signedURL, 중복uploadclick1회, unknownwrite동일requestId, dirty전환confirmationRequired, blobURLcleanup, 순서저장→read동일, upload일부실패→성공파일유지+실패미저장표시, lease만료→업로드비활성, stale검수배지무효. 리터럴상품A/B를 써타상품쓰기0을assert한다.
- [ ] **Step2:** focusedRED 확인후client/controller구현. local-onlyworkflow모드는 명확히cloud설정필요로표시하며로컬영구저장으로조용히대체하지 않는다. 파일은선택만으로전송하지않는다. 같은bytes를미리보기로볼때만read하고count/bytes예산소진시이유표시, read반복polling없음.
- [ ] **Step3:** UI/UX ProMax+Impeccable를읽고 incumbent PRODUCT/DESIGN/brief를따른다. 소규모확장이므로신규월드/컨셉선택게이트는재실행하지않는다. inspector의 `완성 이미지·상세페이지` 액션으로captured상품을편집하는native`<dialog>.showModal()`을연다. 메인갤러리는그대로두고편집중뒤메뉴/상품클릭은inert로막는다. 닫기·ESC·취소시dirty면대화상자내저장/변경버림/계속편집선택을확인하고, dirty동안beforeunload확인도유지한다. source revision갱신은dialog를key로재마운트하지않고conflict를표시한다. 위/아래이동,copy/alt/checks/save,내부세로preview와미저장·서버확인필요·예산/권한/충돌·누락을구분한다. copy는텍스트렌더링, blobURL을영구HTML다운로드로제공하지않는다. `초안에서 제외`는harddelete가아님을명시한다.
- [ ] **Step4:** 실제로컬세션에서선택/dirtyguard/취소/미리보기empty/error를확인한다. PC1440/mobile390/사용자실제폭,키보드버튼/44px타겟/overflow/로딩·포커스를한번에캡처,필요수정은한배치. 토큰·사진·캡처는Git제외. 원래6후보/보류·마진정보가유지되는지확인한다.
- [ ] **Step5:** focused→`npm test`→`npm run build`, 활성rootdependencies를보존한격리`npm ci`,diffcheck,브라우저fullreload통과. 구현코드전체를한번독립코드/UI리뷰하고중요문제수정후검증한다. Native방식은여기까지주에이전트가구현하고최종독립리뷰,문서시스템은좁은확장확인만한다. 이검토전에외부migration/API를적용하지않는다. 각task실제결과를HANDOFF/체크박스에기록하고commit/push.

controller행동의 RED assertion(loaded memo scope에서실제production controller 사용):
```js
controller.edit({intro:'검수 전 카피'});
assert.equal(controller.requestSwitch({workspaceId:'ccb5017e-7c70-414d-b103-38e17e48e799',offerId:'816692570613'}).confirmationRequired, true);
// oldgeneration의느린list/read를resolve한뒤onState에타계정결과나새objectURL이없어야한다.
```

## Task 5: Free-Only Cloud Apply and Actual Storage Acceptance (사용자 단계1 완료)

**Files:** `scripts/check-media-preflight.mjs`, `test/sql/seller-os-media.sql`, `test/integration/mediaPermissions.test.js`, 운영runbook/HANDOFF. 기존함수·bucketmanifest와후보revision은전후snapshot비교한다. 비밀값/파일내용은snapshot에서제외한다.

- [ ] **Step1:** 기존Supabase로그인으로조직Free+Usage기간별Storage/egress/DB/Edge여유를확인한다. 로그인풀리면정확한창을열어사용자가로그인한다. 계획만으로freeenabled를넣지않는다. 여유부족/현재policies에새bucket까지허용하는광범위grant가생겼으면적용중단; 타앱파일삭제·요금제변경금지. preflight결과는비밀없는계수·시각만기록한다.
- [ ] **Step2:** CLI생성SQL한개만대상프로젝트에forward apply,실제remoteversion을기록한다. blanket dbpush/reset/schemaoverwrite금지. 새bucketprivate/RLS/grant/advisors/rollbackSQL PASS확인. 새로운보안문제는고치되기존다른앱advisory는변경하지않는다.
- [ ] **Step3:** 새function만verify_jwt=true로deploy하고전체filemanifest/codecSHA를대조한다. 실제hosteddecodeprobe의resource/정상·손상image결과를확인한다. 통과하지않으면예산disabled유지하고함수진입비활성,서버검증을빼지않는다. Docker나추가software가불가피해졌다면해당권한만별도로요청한다.
- [ ] **Step4:** 무료여유확인시각부터최대24h,64MiB저장/64MiBread예산lease를전용private설정에만부여한다. 임의필드권한을브라우저에노출하지않는다. 정상로그인UI로명시된`검증용_TEST_ONLY_실상품아님.png`1개만업로드/조회/새로고침,개별SHA확인. 새기술fixture는메모함초안에서제외하고retained/용량포함으로남긴다. 합성검증을실제GPT완료라고보고하지않는다.
- [ ] **Step5:** 직접Storageanon/auth접근·crossworkspace거절,정상owner만mediaAPIread/write,기존6후보와3bucket/기존Edge변동없음검증. readbackSHA/초안revision/예산bytes를기록한다. actualownerJWT미제공자동test는SKIP그대로표시하고브라우저증거와분리한다. 모든조건PASS여야단계1완료. 결과/HANDOFFcommit/push.

## Task 6: Actual GPT Roundtrip and Commercial Evidence (사용자 단계2→3)

**Files:** `docs/research/2026-10-15-memo-detail-roundtrip.md`, `docs/research/2026-10-15-memo-sale-readiness.md`, HANDOFF. cloudwrites는정상앱의허용된media/기존candidateupdate경로만사용한다.

- [ ] **Step1:** memo675246155709선택→기존ZIP다운로드→내용/사진7장/권리미확인표시확인. 사용자가직접ChatGPT에프롬프트+사진을넣어만든실제결과파일이필요한시점에만요청한다. 비밀번호·OTP·한도우회·API키를받거나자동생성을실행하지않는다.
- [ ] **Step2:** 받은실제결과를운영자가선택·확인한뒤업로드,순서/카피/검수항목save→fullreload→sameorder/copy/hash/내부preview검증. 옵션왜곡·가짜치수·소품포함오해·권리근거없음이면REVIEW_REQUIRED유지. 이미지만으로상품HOLD는변경하지않는다. fixture와실제GPT파일을명확히구분해야단계2완료.
- [ ] **Step3:** 당시국내동일구성가격/배송/최근수요를primary실페이지에서확인해출처·관찰일을기록한다. 시세조사로그인/captcha는사용자에게창을열어요청한다. 누적리뷰/검색건수만으로수요확정금지. 실제포장/중국배송/반품/수수료/환율의추정·확인값과negative범위를구분한다.
- [ ] **Step4:** 퀵스타공식가이드/계정에서인증·요금/견적조회허용범위만확인,신청/주문/결제API호출금지. 원본이미지권리·물성·판매적합성은실제근거가없으면확정하지않는다. source확인후기존candidateAPI의정상revision/CAS로검토기록을저장·재조회한다. 단계3완료는검토기록이며판매통과가아니다. 근거미확정항목을HANDOFF에명시해commit/push.

## Task 7: Existing Naver Read-Only Connection (사용자 단계4)

**Files:** 기존 `docs/naver-commerce-local-runbook.md`, HANDOFF의실제검증기록만. 실제결함이없으면Commerce구현을재작성하지않는다.

- [ ] **Step1:** 키의존재여부만재확인하고비어있을때네이버앱창/ignored.env.local을열어사용자가직접앱·현재공인IPv4·판매자정보권한/최종동의·두키입력을완료하도록요청한다. 이전SearchAPI키나Pages/SupabaseIP를재사용하지않는다. 키/토큰을읽어출력하거나새비밀번호를설정하지않는다.
- [ ] **Step2:** 해당로컬서버만필요시재시작하고기존인증조회버튼으로token+두GET을실행한다. 최초채널/스토어명/HTTPS주소는사용자가맞다고확인해야한다. 임의스토어결합·자동권한확대금지.
- [ ] **Step3:** 보호snapshot저장→로컬fullreload→채널/revision/확인시각/source검증. 단위테스트/빈snapshot이아닌실제응답이어야한다. 키/IP/권한대기면단계4미완료를보고하고단계5실배포는대기한다. 결과문서commit/push.

## Task 8: Existing Free Pages Promotion and Final Acceptance (사용자 단계5)

**Files:** `docs/operations/seller-os-pages.md`, detail-media운영runbook/HANDOFF와이계획의실제체크상태. 최종배포산출물은ignored dist만.

- [ ] **Step1:** source·테스트·권한검증최종상태와실제2→4증거를확인하고fresh`npm test`/`npm run build`/isolatedci/diffcheck를실행한다. Naver실키나GPT결과가없으면해당단계를완료표시하지않는다. 미완료권한이남으면정확한필요행동만요청한다.
- [ ] **Step2:** 기존Cloudflare로그인/Free Pages프로젝트 `seller-os-delightfilm`를확인한다. 로그인필요시같은창에서사용자가로그인한다. 다른프로젝트/봇/플랜/DNS/카드/Worker추가금지. **dist내용만**직접업로드하고deploymentID/운영주소를기록한다.
- [ ] **Step3:** 실제운영HTML/CSS/JS/lazychunk200+byte/SHAparity, SPA/sourcing-console,원래로그인·6후보·신규비공개결과물·검수보류·네이버실제snapshot을확인한다. fullreload/재로그인시같은결과인지검증한다. 외부에서로컬worker/CDP/Naver비밀값을호출하지않는지관찰가능한network증거로확인한다.
- [ ] **Step4:** PRIVATEbinary의공개URL미노출·권한없는요청거절과서버예산잔여를재확인한다. PC/모바일/사용자폭의실제배포UI를확인하고사용자에게화면을남긴다. 운영 rollback은이전Pagesasset/새media진입비활성만,저장자료/기존앱/DB/Auth를삭제하지않는다.
- [ ] **Step5:** HANDOFF에branch/commit/변경파일/전체명령·실제PASS/FAIL/SKIP/미확정근거/사용자남은작업을사실대로정리하고작업branchcommit/push. remoteHEAD일치·clean상태확인,mainmerge없음. 기능/실배포/판매준비완료를서로구분해최종보고한다.

## Plan Self-Review and Execution Handoff

- Spec1~4및6→Tasks1~5,Spec5단계2/3→Task6,단계4→Task7,단계5/rollback→Task8로연결했다.5개ReviewFocus모두소유task에테스트를지정했다.
- API shape/DTO/독립revision/동적생성migrationpath/codecversion·배포artifact/무료enable/read예산을고정했다. 기본quota0/lease만료/미제공실데이터는실패·대기조건이지누락placeholder가아니다.
- 실제클라우드변경은소스전체독립리뷰및무료/권한preflight후이며사용자역할은로그인·실제GPT결과제공·로컬키/최초스토어확인·필요한추가비용승인에한정한다. 자동유료우회없음.
- **권장 Native:** 서로의revision/예약/API경계를공유하는task이므로현재에이전트가순서대로구현하고Task4끝에전체소스독립리뷰를실시하는방식이비용과맥락중복이적다. 구현계획검토후사용자가Native를선택하면`executing-plans`로실행한다. Subagent-driven을선택하면task마다fresh구현/리뷰를하고종료시전체branch리뷰를한다.

## Read-Only Planning Evidence and Official References

- 현재Node/Deno명령사용가능, Docker/전역SupabaseCLI없음. jSquash세고정버전·decode init API·WASMbyte크기는공식npm package원본을읽어확인했으며설치/실행/호환성성공은아직주장하지않는다. Node/Deno/hosted검증은Task1/3/5의필수gate다.
- Supabase공식예제는nativeSharp미지원/WASM방식과runtime한도를명시한다. 대형magick-wasm은이번계획에서제외하고필요한3decode만사용한다. 현재정적파일API배포제약을피하려고작은WASM을재현가능JS에내장하되실제bundle/gateway/decoder검증을생략하지않는다.
- Primary references: https://github.com/jamsinclair/jSquash ; exactpackage npm registry; https://supabase.com/docs/guides/functions/examples/image-manipulation ; https://supabase.com/docs/guides/functions/limits ; https://supabase.com/docs/guides/functions/wasm . Storage/free/billing/Pages근거와실행시다시확인할항목은승인spec의참고근거를따른다.
