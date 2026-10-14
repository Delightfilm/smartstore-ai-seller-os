# Memo and additional provisional candidate review — 2026-10-14

## Scope and verification boundary

Research/data update only. Existing UI, application code, dependencies, schemas, deployments and other apps remain unchanged. No listing, shipment, order, supplier message, payment or billing action.

Fresh public supplier data was read with the repository's validated local CDP collector; Korean search cards used its existing Naver search adapter. The operator completed Naver login in the in-app browser; actual domestic product details/review dates were then inspected there. Never stored authentication state or full authenticated HTML in Git.

Vite was stopped overnight. A cached dashboard did not enqueue a job. Local HTTP initially refused connection; restarting `npm run dev` restored HTTP200. The existing browser tab remained on a generated connection-error page, and browser navigation was blocked. The operator was asked to refresh manually; no alternate browser/control route was used to bypass the block. **Current-turn dashboard reload/render verification remains pending.**

Cloud writes below used existing audited Seller-only RPCs through the connected Supabase SQL interface. The new candidate used the existing research enqueue/connect/claim/complete/stop path in a one-shot execution with actual observations. This is **not** proof that the top button/foreground worker ran today or that market collection is now automatic. Before that execution the worker was offline and there were no queued/running jobs; it was stopped afterward. No new credentials, access, Auth settings or policies were created.

## Memo box 675246155709

- [Actual supplier](https://detail.1688.com/offer/675246155709.html), observed `2026-10-14T01:01:46.607Z`: full2SKUs, MOQ1, ¥3.50/¥2.10, stock1791/1254. Open-top clear trays, not a lidded box. Generic table dimensions/weight are not established single-parcel packed-gross evidence and remain null in the normalized package. Supplier cumulative200+ sales have no known period and are not domestic demand.
- [Actual Korean functional substitute](https://smartstore.naver.com/easyselect7/products/13790646042): observed after login, price3840+shipping3000=6840KRW, reviews0. Original detail shows KAPAMAX memo refill K97110-1,400sheets,105×120×48mm, madeKorea. Case/refill inclusion is unresolved and configuration differs from the supplier trays; `comparable=false`. Search advertisement and new October2026 registration do not establish demand.
- Coupang Comix search index showed4430/free shipping/9reviews, but primary access returned403; Gmarket index showed2260+3000/5reviews/151purchases, but the browser displayed a bot check. These were **not** promoted to currently verified prices, identical comparables or recent demand. No challenge was bypassed.
- Prior11900 selling-price assumption is not justified by matched domestic evidence. Revised6900 **total-payment stress scenario** tracks the6840 functional alternative; it is not an established market price or sale recommendation. Three identical-configuration comparables remain missing.

Cost assumptions retained: FX211KRW/CNY, China freight5CNY, international freight5400/7000/10000KRW, other500, fee6%, return reserve3%. These are budgets, **not Quickstar quotes**; taxes/advertising/additional handling remain unconfirmed. Calculation floors whole-won contribution after the explicit costs/reserves, not net profit.

| Actual option | Supply CNY | Low freight contribution | Base contribution | High freight contribution |
| --- | ---: | ---: | ---: | ---: |
| Long SKU4855892641767 | 3.50 | -1415 | -3015 | -6015 |
| Square SKU4855892641768 | 2.10 | -1120 | -2720 | -5720 |

Saved actual normalized source, revised estimate/profile, curated domestic market and HOLD review via revision-checked `seller_os_save_candidate`; SQL recomputation exactly matched the existing JS estimate before the write. Revision3→4, events4. All6 business confirmations remain false; publicationNOT_PUBLISHED. No demand/sale approval.

## Additional real candidate 920640944156

[Actual supplier](https://detail.1688.com/offer/920640944156.html), observed `2026-10-14T01:18:24.003Z`: MONR drawer organizer, supplier Linhai Wangfeng plastic company;6actual vendor SKUs, complete set, MOQ1 and positive stock for every option. Representative public image confirms drawers; decorative contents and pictured combinations are not assumed included. Generic weight/dimension table does not establish packed-gross semantics; package remains null. Trademark/sale suitability, image rights and ongoing supply stability are unverified.

Domestic research query `책상 미니 서랍 정리함`:

- [Actual Kkoons product](https://smartstore.naver.com/stuffmall/products/11356386281):7900+3000=10900KRW,4cumulative reviews. Displayed review dated2026-09-29 and recent6months rating4.0 observed. Pegboard/drawer design, not the same MONR model. This is a limited category signal, **not** monthly sales or target-SKU demand.
- Search advertising cards: Modernlive15000+3000=18000,97cumulative reviews; Stampling23900+4000=27900,1374cumulative reviews. Configuration/recent review periods not matched; exclude from identical-model median.

Use13900 **total-payment scenario**, not confirmed achievable price; domestic10900 fast-delivery alternative creates substantial price pressure. Same explicit cost budgets as the memo. All6 options retained;4meet base targets1000KRW/10%,2fail margin target.

| Actual vendor SKU / option | CNY | Stock | Low contribution | Base contribution | High contribution | Base target |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 5791519696243 / TB-2358 small single | 4.89 | 9982 | 4662 | 3062 | 62 | Meets assumption |
| 5791519696244 / TB-2359 double layer | 10.50 | 9985 | 3478 | 1878 | -1122 | Meets assumption |
| 5791519696245 / TB-2156 white large single | 10.90 | 9990 | 3394 | 1794 | -1206 | Meets assumption |
| 5791519696246 / TB-2156 yellow large single | 10.90 | 9996 | 3394 | 1794 | -1206 | Meets assumption |
| 5791519696247 / TB-2135 white double-grid | 13.90 | 9985 | 2761 | 1161 | -1839 | Fails10% |
| 5791519696248 / TB-2135 yellow double-grid | 13.90 | 9998 | 2761 | 1161 | -1839 | Fails10% |

At the10900 domestic functional-substitute price, even the cheapest option has base contribution332KRW/3.045872%, below targets. The five higher-price options lose money at upper freight. Therefore stored as **HOLD / PROFITABILITY_PENDING / confidenceLOW / NOT_PUBLISHED**, not an approved profitable product.

Research job `cbb4177f-ebad-46e5-a908-06168aea1301` completedSUCCEEDED/PROVISIONAL and saved revision1 through independent server estimate/evidence validation. Curated market and explicit review/sensitivity were added with the existing audit RPC, revision2/events2. No client-editable market API or automatic domestic demand workflow was implemented.

## Rejected observations

- [961193410697](https://detail.1688.com/offer/961193410697.html): primaryMOQ2; normalized option price unconfirmed. Job `321b7aa6-3183-4c34-850e-2c297b66a3cc` SUCCEEDED/HOLD, no candidate.
- [980286485482](https://detail.1688.com/offer/980286485482.html): MOQ1, oneactualSKU6102424690942, price0.80CNY/stock9418. Title mentions drawers, but inspected primary image shows open stackable baskets. Drawer pricing scenario is not applicable. Job `d76ccfbb-a69e-4a25-a658-b2b748d54ff5` SUCCEEDED/HOLD, no candidate; low source price alone did not qualify it.
- [734395404719](https://detail.1688.com/offer/734395404719.html): separate read-only bookend investigation,9actualSKUs/MOQ1, ¥10.86/11.83. Generic900g weight and incomplete dimensions; branded Kaba Bear. Not queued/saved this turn. Domestic bookend search cards were unmatched and did not justify approval.
- Rotating-pen-holder category search showed a5000+3000 domestic alternative/44cumulative reviews; no new source candidates collected in that category.

## Actual final checks

- Independent cloud re-read:3candidates total. Memo revision4/events4; new drawer revision2/events2; P2013 revision9/events9 unchanged. AllHOLD/NOT_PUBLISHED. New/memo price profiles6900/13900 and2/6options re-read. Curated competitor observations explicitlynoncomparable; confirmationsfalse.
-3new research jobs persisted/read; no queued/waiting-worker/running jobs remain. One-shot worker stopped. No fixture products or fake successful source rows.
- Fresh `npm test`:105total,102PASS,0FAIL,3optionalSKIP. Fresh `npm run build`:PASS1864modules,645.87KBmainJS. No dependency changes/forced upgrades; `npm ci` not repeated for this documentation/data-only turn with the restored dev server running.
- Dashboard current-turn reload/card/detail rendering and proof screenshot are **not verified**, pending the user's manual recovery of the blocked error tab. Server-side persistence verification must not be described as browser verification.

Next: manually restore the existing dashboard, reconnect the local worker and inspect/reload memo6900 and drawer13900 cards, market table and HOLD reasons. Then establish matched configuration/size prices and stronger recent demand, sale/image rights and real Quickstar costs before changing confirmations or making commercial actions. Restore prior memo scenarios only through another revision-checked audit write if explicitly needed; preserve all history rather than deleting candidates/events.
