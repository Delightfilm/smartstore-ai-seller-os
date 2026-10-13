# Seller OS research worker

## Operation

1. Run `npm run dev` in this user-directory repository. The cloud-mode Vite process owns the foreground local worker; no service or scheduled task is installed.
2. Keep the existing operator account logged in at `http://127.0.0.1:5173/`.
3. Run `npm run 1688:browser` if the dedicated CDP browser is off, and complete 1688 login manually.
4. In **발굴 → 해외구매대행 조사 · 검토 기록 → 상품 조사 자동화**, connect the local worker. Queue a keyword (up to three detailed offers per search), direct canonical offer URL, or selected-candidate refresh.
5. Login/captcha pauses the worker; finish verification yourself, retry the affected job and reconnect. Three consecutive other failures also stop the worker. Stopping discards in-flight browser results before storage.

The active dashboard refreshes its short-lived user JWT in worker memory. Neither cookies nor server service keys leave their original runtime. Closing the dashboard stops renewal: the worker pauses within90seconds. Closing Vite stops its timers; cloud status becomes offline. This is not24x7 hosted automation. Hosted frontend can queue/view jobs, but requires an approved remote worker; it cannot reach this PC's Chrome.

## Evidence gate

Every discovered real vendor SKU must have MOQ1, positive per-SKU CNY price, available integer stock, explicit **single packed unit** gross weight and three dimensions, supported units, same-offer/SKU scope, canonical source URL and a recent observation. The whole offer is rejected if any option fails or exceeds36options. No synthetic SKU IDs, net/carton weight substitution, SKU averaging, missing-number zero fill, or silent omission of incomplete options.

Adapters read explicitly scoped structured SKU data or the visible1688SKU component's public dataList (volatile development adapter, only vendor SKU/label/price/stock fields). Redirect offer identity and conflicting sources are rejected. Packaging tables are supported only with explicit packing gross/unit headers, all three packing dimensions and unit quantity1, uniquely matched to the same SKU or exact unique label. Unsupported structures remain unknown, not guessed. Known search-card MOQ conflicts are carried into detail jobs and held. Absence of a card MOQ is not treated as proof; detail evidence is still mandatory.

Pass means **candidate REVIEW_REQUIRED**, never sale/listing approval. Refresh atomically stores candidate + audit event + job outcome, clears all business confirmations and preserves old user terms, drafts, dated research and review reasons. Editable review reasons are capped20 (full exclusion reasons remain in source-check/job records). A rejected new offer makes no candidate; a rejected existing offer stays HOLD with its old product data intact. Job completion replay cannot duplicate the candidate/event, and expired/replaced leases cannot finish.

## Verification and boundaries

`npm test`, `npm run build`; `test/sql/seller-os-research.sql` is a separate real-database rollback suite (fixtures must never be shown as real products). No listing, shipment, purchase or billing action is connected.

Rollback: stop worker; restore the prior `seller-os-agency` source from task base and redeploy (keep verify_jwt); revert frontend/task branch changes. Leave additive Seller OS tables/history in place for recovery. Do not reset/drop the shared database or alter other apps. Database/helper rollback or deletion requires a separate scoped decision and backup. Prior API cannot operate research jobs but existing candidate reads/edits still work.
