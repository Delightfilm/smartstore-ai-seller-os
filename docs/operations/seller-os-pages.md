# Seller OS 외부 대시보드

운영 주소: https://seller-os-delightfilm.pages.dev/

## 로그인

1. 기존 Seller OS 운영 이메일을 입력하고 **인증메일 받기**를 누릅니다.
2. 메일에 인증번호가 있으면 화면에 입력합니다. sign-in link만 있으면 링크 주소를 복사해 **같은 외부 대시보드의 인증 입력칸**에 붙여넣습니다.
3. **인증하고 로그인**을 누르면 클라우드 후보와 조사 이력이 표시됩니다.

기존 비밀번호를 아는 운영자는 비밀번호 로그인도 사용할 수 있습니다. 이번 배포에서는 비밀번호를 만들거나 조회·재설정하지 않았습니다. 인증번호·로그인 링크·비밀번호를 채팅이나 Git에 올리지 마세요. Cloudflare 관리 계정 로그인은 Seller OS 앱 로그인과 별개입니다.

## 배포 범위

- 별도 Cloudflare Pages `seller-os-delightfilm` 직접 업로드 프로젝트. 정적 HTML/CSS/JS만 제공하며 Workers/Pages Functions, 유료 플랜, 카드 등록, 기존 도메인/DNS 변경은 추가하지 않았습니다.
- 기존 SmartStoreSellerOS UI와 별도 `/sourcing-console` 경로를 유지합니다. 데이터·인증·권한은 기존 Supabase의 Seller OS 전용 영역을 계속 사용합니다.
- 저장 서버는 로컬5173주소 두 개와 **정확히 이 운영 HTTPS 주소 하나**만 허용합니다. 임시 배포주소·다른 Pages 사이트·HTTP 주소는 허용하지 않습니다. CORS는 로그인 대체가 아니며 사용자 인증/워크스페이스 소유권 검사를 유지합니다.
- PC 조사 작업자는 외부에 공개하지 않습니다. 로컬 개발 서버, 인증된 로컬 대시보드, 로그인된1688전용 브라우저가 실행돼 있어야 수집을 이어갈 수 있습니다. 로컬 실행 방법은 `seller-os-research.md`를 참고하세요. 외부 사이트를 열었다고 24시간 수집 서버가 생기는 것은 아닙니다.
- 등록·배송 신청·구매·결제 기능은 활성화하지 않았습니다. 모든 후보의 보류/수익성 확정 보류 상태를 유지합니다.

## 이번 실제 검증 — 2026-10-14

- 외부 운영자 이메일 인증 로그인, 저장 후보6개 조회, P2013 revision9 상세, 새로고침 후 같은6개 후보/옵션/보류/추정 마진 표시를 확인했습니다. 원본 DB의6개 revision도 변경되지 않았습니다.
- HTML/CSS/JS 세 파일이 HTTP200이며 로컬 빌드와 바이트/SHA256가 모두 일치합니다. `/sourcing-console`의 SPA진입도 HTTP200입니다.
- 외부 정확한 origin preflight204, 로컬 preflight204, 외부/로컬 비로그인·가짜 토큰401, 다른/유사/HTTP origin403(no allow-origin) 검증을 통과했습니다. 사용자 JWT를 별도로 제공해야 하는 자동 교차워크스페이스 통합 검증은 실행하지 않았습니다. 정상 외부 로그인/조회는 실제 브라우저에서 검증했습니다.
- 전체 테스트105PASS/0FAIL/6선택적SKIP. 외부 공개 서버 통합 검증5PASS/0FAIL/1선택적SKIP. 빌드 및 분리된 깨끗한 의존성 설치PASS. 기존 큰 번들 경고와 빌드 도구계열 보안 경고8건은 남아 있으며 자동 major업그레이드를 하지 않았습니다. 해당 빌드 도구/node_modules는 호스팅 업로드에 포함되지 않습니다.

공개 서버 접근 검증은 실제 운영 서버에 읽기/차단 요청만 보냅니다. 외부 허용주소를 변경할 때 아래 검증을 재실행하세요. 사용자 JWT는 필요하면 안전한 별도 테스트 환경에서 제공하며 출력하거나 Git에 저장하지 않습니다.

```powershell
$env:SELLER_OS_LIVE_TEST='1'
$env:SELLER_OS_PUBLIC_ORIGIN='https://seller-os-delightfilm.pages.dev'
node --env-file=.env.local --test test/integration/cloudPermissions.test.js
```

## 다음 배포와 롤백

직접 업로드 방식이라 Git push만으로 Cloudflare가 새 빌드를 자동 배포하지 않습니다. 검증된 `npm run build` 결과의 **dist내용만** zip으로 묶어 이 프로젝트의 **Create deployment**에 업로드하고, 자산 일치와 실제 로그인/새로고침을 재검증합니다. 환경 파일·서비스 역할 키·서버 코드·조사 원본·브라우저 프로필을 업로드하지 마세요.

첫 배포 ID: `b6aee822-738f-4f3c-83f9-6761b320c36f`. Cloudflare의 Production/main표기는 업로드 배포의 환경 이름이며 Git main병합이 아닙니다. 임시주소 `b6aee822.seller-os-delightfilm.pages.dev`는 서버 허용목록에 없으므로 운영주소를 사용하세요.

이후 프런트 롤백은 이 프로젝트의 검증된 이전 배포를 재배포합니다. 서버 외부 접속을 철회하려면 `supabase/functions/seller-os-agency/index.ts`에서 **외부주소만** 제거하고 `seller-os-agency`를 JWT검증을 유지한 채 재배포합니다. 기존 로컬접속·후보·감사이력·Auth 사용자·다른 프로젝트를 초기화하거나 삭제하지 않습니다. 첫 서버 롤백 기준은 작업브랜치 `c36b0f8`의13개 함수 소스파일(v10)입니다.

무료인 것은 Pages정적 호스팅 범위입니다. 기존 Supabase와 로컬PC 운영 한도는 별개이며, 유료플랜/추가리소스가 필요하면 먼저 사용자 승인을 받습니다.
