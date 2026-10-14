# Seller OS research worker

## Operation

1. Run `npm run dev` in this user-directory repository. The cloud-mode Vite process owns the foreground local worker; no service or scheduled task is installed.
2. Keep the existing operator account logged in at `http://127.0.0.1:5173/`.
3. Run `npm run 1688:browser` if the dedicated CDP browser is off, and complete 1688 login manually.
4. In **발굴**, fill the estimate profile (selling-price scenario, FX, freight lower/base/upper bounds, other costs, fee/return reserve, targets and basis). Defaults are illustrative budgets, NOT Quickstar quotes; selling price and basis are deliberately blank. The top button and existing automation panel share this captured profile. Queue a keyword (up to three detailed offers per search), direct canonical offer URL, or selected-candidate refresh.
5. Login/captcha pauses the worker; finish verification yourself, retry the affected job and reconnect. Three consecutive other failures also stop the worker. Stopping discards in-flight browser results before storage.

The active dashboard refreshes its short-lived user JWT in worker memory. Neither cookies nor server service keys leave their original runtime. Closing the dashboard stops renewal: the worker pauses within90seconds. Closing Vite stops its timers; cloud status becomes offline. This is not24x7 hosted automation. Hosted frontend can queue/view jobs, but requires an approved remote worker; it cannot reach this PC's Chrome.

## GPT 없이 로컬에서 실행하기

현재 검색·상세 수집·옵션/MOQ/가격/재고 검증·추정 마진 계산·후보 저장은 기존 코드가 처리합니다. 이 경로에는 GPT 호출이 없으며, Codex 대화를 계속 열어 둘 필요도 없습니다. 다만 **로컬 실행은 인터넷 없는 오프라인 실행과 다릅니다**:1688 접근과 Supabase 로그인/대기열/저장에 인터넷이 필요합니다.

1. 이 사용자 디렉터리 프로젝트에서 터미널 하나로 `npm run dev`를 실행하고 유지합니다.
2. 다른 터미널에서 필요하면 `npm run 1688:browser`를 실행합니다. 전용 브라우저의 로그인·보안 검증은 직접 완료합니다.
3. `http://127.0.0.1:5173/`에서 앱에 로그인하고 **발굴 → 해외구매대행 조사·검토 기록 → 로컬 조사 작업자 연결**을 누릅니다.
4. 추정 판매가·배송비 범위·환율·부가비용·수수료·반품 예산·근거를 입력합니다. 기본값은 견적이 아닙니다. 중국어 검색어를 입력하고 상단 **발굴 실행**을 누릅니다.
5. 한 검색의 상위최대3상품을 상세 조사합니다. 기준 미충족/지원하지 않는 옵션 구조/너무 큰 자료는 제외·실패 기록에 남습니다. 옵션을 임의로 줄이거나 MOQ를1로 가정하지 않습니다. 조건을 만족한 후보도 수익성 확정 보류/미등록입니다.
6. 작업 기록과 아래 후보 목록을 확인합니다. GPT 없이도 이 절차를 반복할 수 있지만, 로그인·캡차는 사람이 처리해야 합니다. 대시보드/개발 서버/전용 브라우저/PC를 유지해야 하며24시간 무인 수집이나 재부팅 후 자동 시작은 구현하지 않았습니다.

국내 동일 구성 경쟁가·최근 수요·이미지/상표 권리·판매 적합성·퀵스타 최종 비용의 완전 자동 검토는 아직 아닙니다. 이 근거는 사람 또는 별도의 검토 작업으로 보완해야 합니다. 모델 도움 없이 조사 작업자를 실행하는 것과 상품 판매 승인은 구분합니다.

## Evidence gate

Every discovered real vendor SKU must still have MOQ1, positive per-SKU CNY price, available integer stock, same-offer/SKU scope, canonical source URL and a recent observation. Provisional discovery also requires a confirmed complete SKU set (max36). Missing **single packed unit** gross weight/dimensions no longer rejects an otherwise valid trade observation. No synthetic SKU IDs, net/carton weight substitution, SKU averaging, missing-number zero fill, or silent omission of incomplete options.

When at least one retained option meets the explicit profile's base-scenario contribution and margin targets, all options are saved as `PROVISIONAL` / candidate **HOLD**, with `product.discoveryEstimate.status=PROFITABILITY_PENDING`. Other options remain visible even when below target. JS uses exact decimal fractions before whole-won floor, and SQL recomputes the entire estimate from the job-owned profile before transactional storage; worker-supplied margins/profiles cannot override it. These are hypothetical economics, not competitive selling-price, demand or provider-tariff verification. Freight ranges are operator budgets, not automatically measured volumetric costs. Unknown packaging stays null; no photo-only gross weight is claimed. Final sales/rights/supplier/cost/comparison/demand confirmation gates remain unchanged.

Adapters read explicitly scoped structured SKU data or the visible1688SKU component's public dataList (volatile development adapter, only vendor SKU/label/price/stock fields). Redirect offer identity and conflicting sources are rejected. Packaging tables are supported only with explicit packing gross/unit headers, all three packing dimensions and unit quantity1, uniquely matched to the same SKU or exact unique label. Unsupported structures remain unknown, not guessed. Known search-card MOQ conflicts are carried into detail jobs and held. Absence of a card MOQ is not treated as proof; detail evidence is still mandatory.

Without an estimate profile, legacy strict packing-complete research remains **REVIEW_REQUIRED**, never sale/listing approval. The UI always sends the explicit estimate profile. Refresh atomically stores candidate + audit event + job outcome, clears all business confirmations and preserves old user terms, drafts, dated research and review reasons. Editable reasons are capped20. A rejected new offer makes no candidate; a rejected existing offer stays HOLD with old product history intact. An estimate-specific timestamp/expired designation suppresses current promising status after a newer rejected source check; retained figures are explicitly historical. Job completion replay cannot duplicate candidate/event; expired/replaced leases cannot finish.

## Verification and boundaries

`npm test`, `npm run build`; `test/sql/seller-os-research.sql` and `test/sql/seller-os-provisional.sql` are separate real-database rollback suites (fixtures must never be shown as real products). `node scripts/discovery-estimate-parity-sql.js` emits read-only SQL comparing actual JS results against PostgreSQL, including the binary-rounding boundary, negative margins, scientific-notation price and upper-bound costs. No listing, shipment, purchase or billing action is connected.

Rollback: stop worker; restore the prior `seller-os-agency` source from task base and redeploy (keep verify_jwt); revert frontend/task branch changes. Leave additive Seller OS tables/history in place for recovery. Do not reset/drop the shared database or alter other apps. Database/helper rollback or deletion requires a separate scoped decision and backup. Prior API cannot operate research jobs but existing candidate reads/edits still work.
