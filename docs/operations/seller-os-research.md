# Seller OS research worker

## Operation

1. Run `npm run dev` in this user-directory repository. The cloud-mode Vite process owns the foreground local worker; no service or scheduled task is installed.
2. Keep the existing operator account logged in at `http://127.0.0.1:5173/`.
3. Run `npm run 1688:browser` if the dedicated CDP browser is off, and complete 1688 login manually.
4. In **발굴**, fill the estimate profile (selling-price scenario, FX, freight lower/base/upper bounds, other costs, fee/return reserve, targets and basis). Defaults are illustrative budgets, NOT Quickstar quotes; selling price and basis are deliberately blank. The top button and existing automation panel share this captured profile. Queue a keyword (up to three detailed offers per search), direct canonical offer URL, or selected-candidate refresh.
5. Login/captcha pauses the worker; finish verification yourself, retry the affected job and reconnect. Three consecutive other failures also stop the worker. Stopping discards in-flight browser results before storage.

The active dashboard refreshes its short-lived user JWT in worker memory. Neither cookies nor server service keys leave their original runtime. Closing the dashboard stops renewal: the worker pauses within90seconds. Closing Vite stops its timers; cloud status becomes offline. This is not24x7 hosted automation. Hosted frontend can queue/view jobs, but requires an approved remote worker; it cannot reach this PC's Chrome.

## Evidence gate

Every discovered real vendor SKU must still have MOQ1, positive per-SKU CNY price, available integer stock, same-offer/SKU scope, canonical source URL and a recent observation. Provisional discovery also requires a confirmed complete SKU set (max36). Missing **single packed unit** gross weight/dimensions no longer rejects an otherwise valid trade observation. No synthetic SKU IDs, net/carton weight substitution, SKU averaging, missing-number zero fill, or silent omission of incomplete options.

When at least one retained option meets the explicit profile's base-scenario contribution and margin targets, all options are saved as `PROVISIONAL` / candidate **HOLD**, with `product.discoveryEstimate.status=PROFITABILITY_PENDING`. Other options remain visible even when below target. JS uses exact decimal fractions before whole-won floor, and SQL recomputes the entire estimate from the job-owned profile before transactional storage; worker-supplied margins/profiles cannot override it. These are hypothetical economics, not competitive selling-price, demand or provider-tariff verification. Freight ranges are operator budgets, not automatically measured volumetric costs. Unknown packaging stays null; no photo-only gross weight is claimed. Final sales/rights/supplier/cost/comparison/demand confirmation gates remain unchanged.

Adapters read explicitly scoped structured SKU data or the visible1688SKU component's public dataList (volatile development adapter, only vendor SKU/label/price/stock fields). Redirect offer identity and conflicting sources are rejected. Packaging tables are supported only with explicit packing gross/unit headers, all three packing dimensions and unit quantity1, uniquely matched to the same SKU or exact unique label. Unsupported structures remain unknown, not guessed. Known search-card MOQ conflicts are carried into detail jobs and held. Absence of a card MOQ is not treated as proof; detail evidence is still mandatory.

Without an estimate profile, legacy strict packing-complete research remains **REVIEW_REQUIRED**, never sale/listing approval. The UI always sends the explicit estimate profile. Refresh atomically stores candidate + audit event + job outcome, clears all business confirmations and preserves old user terms, drafts, dated research and review reasons. Editable reasons are capped20. A rejected new offer makes no candidate; a rejected existing offer stays HOLD with old product history intact. An estimate-specific timestamp/expired designation suppresses current promising status after a newer rejected source check; retained figures are explicitly historical. Job completion replay cannot duplicate candidate/event; expired/replaced leases cannot finish.

## Verification and boundaries

`npm test`, `npm run build`; `test/sql/seller-os-research.sql` and `test/sql/seller-os-provisional.sql` are separate real-database rollback suites (fixtures must never be shown as real products). `node scripts/discovery-estimate-parity-sql.js` emits read-only SQL comparing actual JS results against PostgreSQL, including the binary-rounding boundary, negative margins, scientific-notation price and upper-bound costs. No listing, shipment, purchase or billing action is connected.

Rollback: stop worker; restore the prior `seller-os-agency` source from task base and redeploy (keep verify_jwt); revert frontend/task branch changes. Leave additive Seller OS tables/history in place for recovery. Do not reset/drop the shared database or alter other apps. Database/helper rollback or deletion requires a separate scoped decision and backup. Prior API cannot operate research jobs but existing candidate reads/edits still work.
