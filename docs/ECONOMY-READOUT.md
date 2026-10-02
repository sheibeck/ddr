# Store economy readout (Phase 92, ECON-11 / ECON-12)

**Date:** 2026-10-01
**Status:** closed 2026-10-01
**Measured:** commit 3995a6e3, node tools/tune-economy.mjs --seeds=1000 --workers=4 (the fair bot of 92-01, shipped dials)

## What this measures

ECON-11 asks one question: how much gold does a hero hold when it reaches a store, against what that whole store costs, floor by floor? The user's device report (2026-09-28) was "Store can still be bought out at depth 7". This milestone moved prices a lot (Q8 A: race and Pickpocket buy rule on every non-tool line; Troll x2; selling at the ordinary price for every race; Enlarge 150; the Joiner armour repair line; the Pickpocket's extra item instead of gold), so the readout is taken on the finished rules.

The numbers come from 1,000 auto-played runs (seeds `i*7919+1`, the shipped dials) of the fair bot, in two samples:

- **Store visits**: every time a run actually opens a store, the gold the hero holds against the whole shelf.
- **Floor arrivals**: every floor a run reaches, the gold the hero holds on arrival against the store that hero would meet on that floor (the engine's own `openStore`, run on a throwaway copy of the state, so the live run is never touched). This sample is much larger than the visits at every floor, so it is the steadier one.

**Total stock price** = every line on the shelf when the store opens, each at the price this hero pays (race, Pickpocket and the Wilmsry haggle are already in the line's price), with the Rations line counted as its price times the stock left (a d10).

**The bot's shopping:** it buys a better weapon, then better armour, keeping 50 wilmst back, and tops rations up to three nights of the party's upkeep. It never buys repairs and never sells. Because a human does sell, every row also shows the gold held plus the sale value of the bag (half the base value of each carried item, `sellPriceFor`).

**Caveats that travel with every number:** (1) the bag's sale value is what a human could raise by selling; a sale is capped by the bag's wilmst carry cap, but a human can sell, buy, and sell again, so it is a fair picture of what the hero could spend over a visit. (2) The deeper rows are survivors of a bot whose median death is about floor 4, so n is stated on every row and the rows past floor 8 are thin. (3) The store-visit sample is small at depth 7 (24 visits); the arrival sample (240) is the one to lean on. (4) A tuning proxy, not a gate and not a substitute for a human playtest.

## Store affordability by depth (floors 1–12)

**Store visits** (the gold the hero holds when a store opens, against the whole shelf)

| Floor | Runs reaching | Visits | Gold held, median (p25–p75) | Whole store, median | Share of the store the hero can afford, median (p25–p75) | Visits that buy the whole store | Gold plus bag sold: share, median | Gold plus bag sold: buys the whole store | Gold at the bag cap | Spent at stores so far (mean) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 85 | 52 (50–62) | 2734 | 3% (2%–5%) | 0 of 85 (0.0%) | 3% | 2.4% | 0.0% | 0 |
| 2 | 987 | 78 | 136 (62–258) | 3745 | 3% (2%–7%) | 0 of 78 (0.0%) | 17% | 14.1% | 0.0% | 1 |
| 3 | 835 | 59 | 221 (86–456) | 3945 | 5% (2%–10%) | 0 of 59 (0.0%) | 32% | 10.2% | 0.0% | 2 |
| 4 | 698 | 53 | 391 (228–677) | 3414 | 10% (6%–22%) | 0 of 53 (0.0%) | 63% | 26.4% | 0.0% | 9 |
| 5 | 555 | 39 | 598 (330–917) | 4215 | 11% (8%–23%) | 1 of 39 (2.6%) | 60% | 28.2% | 0.0% | 35 |
| 6 | 377 | 27 | 992 (535–1317) | 4282 | 14% (11%–41%) | 1 of 27 (3.7%) | 44% | 33.3% | 3.7% | 89 |
| 7 | 240 | 24 | 1028 (710–1629) | 3725 | 24% (14%–40%) | 0 of 24 (0.0%) | 86% | 45.8% | 8.3% | 236 |
| 8 | 141 | 3 | 2417 (1207–2774) | 3259 | 60% (37%–93%) | 0 of 3 (0.0%) | 100% | 100.0% | 66.7% | 0 |
| 9 | 77 | 8 | 1830 (1032–3142) | 4875 | 34% (16%–61%) | 1 of 8 (12.5%) | 98% | 37.5% | 37.5% | 182 |
| 10 | 39 | 2 | 3200 (3148–3200) | 4053 | 85% (78%–85%) | 0 of 2 (0.0%) | 100% | 100.0% | 50.0% | 325 |
| 11 | 14 | 1 | 1431 (1431–1431) | 4205 | 34% (34%–34%) | 0 of 1 (0.0%) | 100% | 100.0% | 0.0% | 396 |
| 12 | 8 | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| 13+ | 5 | 1 | 6281 (6281–6281) | 3181 | 100% (100%–100%) | 1 of 1 (100.0%) | 100% | 100.0% | 0.0% | 0 |

**Floor arrivals** (the gold the hero holds on reaching the floor, against the store that hero would face there)

| Floor | Arrivals | Gold held, median | Store they would face, median | Share affordable, median | Buys the whole store | Gold plus bag sold: share, median | Gold plus bag sold: buys the whole store |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 2680 | 2% | 0.0% | 2% | 0.0% |
| 2 | 987 | 64 | 3630 | 2% | 0.0% | 8% | 2.5% |
| 3 | 835 | 184 | 3710 | 4% | 0.0% | 28% | 8.6% |
| 4 | 698 | 318 | 3735 | 8% | 0.0% | 49% | 19.1% |
| 5 | 555 | 515 | 4239 | 10% | 0.9% | 57% | 22.5% |
| 6 | 377 | 779 | 4198 | 17% | 1.6% | 76% | 36.6% |
| 7 | 240 | 978 | 4065 | 23% | 4.6% | 98% | 48.3% |
| 8 | 141 | 1347 | 3925 | 32% | 3.5% | 100% | 59.6% |
| 9 | 77 | 1771 | 4525 | 34% | 6.5% | 100% | 59.7% |
| 10 | 39 | 2087 | 4100 | 46% | 12.8% | 100% | 69.2% |
| 11 | 14 | 2349 | 3845 | 67% | 28.6% | 100% | 92.9% |
| 12 | 8 | 3622 | 4107 | 75% | 37.5% | 100% | 87.5% |
| 13+ | 13 | 5595 | 3131 | 100% | 69.2% | 100% | 84.6% |

## Gold income by source

**All runs, by source**

| Source | Gold (all runs) | Share |
| --- | --- | --- |
| start | 50000 | 5.3% |
| chest | 625784 | 66.6% |
| parley | 98400 | 10.5% |
| tableFour | 54480 | 5.8% |
| grimoire | 36900 | 3.9% |
| off the body | 36708 | 3.9% |
| faerie | 25600 | 2.7% |
| parley spoils | 9363 | 1.0% |
| cutpurse | 2934 | 0.3% |

**Mean income on each floor** (per run that reached it; `start` is the starting purse, counted on floor 1)

| Floor | Runs reaching | start | chest | parley | tableFour | grimoire | off the body | faerie | parley spoils | cutpurse | Total on this floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 43 | 3 | 3 | 6 | 6 | 6 | 1 | 0 | 117 |
| 2 | 987 | 0 | 73 | 11 | 7 | 9 | 8 | 3 | 1 | 0 | 112 |
| 3 | 835 | 0 | 103 | 19 | 10 | 7 | 7 | 7 | 2 | 0 | 154 |
| 4 | 698 | 0 | 141 | 32 | 11 | 8 | 7 | 5 | 2 | 1 | 204 |
| 5 | 555 | 0 | 179 | 32 | 25 | 7 | 8 | 2 | 3 | 1 | 257 |
| 6 | 377 | 0 | 217 | 49 | 13 | 6 | 9 | 3 | 4 | 1 | 302 |
| 7 | 240 | 0 | 286 | 18 | 14 | 6 | 10 | 19 | 3 | 1 | 357 |
| 8 | 141 | 0 | 227 | 45 | 36 | 14 | 11 | 8 | 4 | 2 | 347 |
| 9 | 77 | 0 | 222 | 0 | 19 | 2 | 8 | 0 | 4 | 2 | 257 |
| 10 | 39 | 0 | 291 | 0 | 21 | 4 | 9 | 0 | 8 | 0 | 332 |
| 11 | 14 | 0 | 453 | 0 | 0 | 11 | 2 | 0 | 1 | 0 | 467 |
| 12 | 8 | 0 | 132 | 0 | 0 | 19 | 2 | 0 | 12 | 0 | 164 |
| 13+ | 5 | 0 | 1923 | 0 | 0 | 90 | 1 | 0 | 36 | 0 | 2050 |

**Mean income cumulative to each floor** (per run that reached it)

| Floor | Runs reaching | start | chest | parley | tableFour | grimoire | off the body | faerie | parley spoils | cutpurse | Total to this floor | Spent at stores to this floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 43 | 3 | 3 | 6 | 6 | 6 | 1 | 0 | 117 | 0 |
| 2 | 987 | 50 | 115 | 14 | 10 | 15 | 14 | 9 | 2 | 1 | 229 | 4 |
| 3 | 835 | 50 | 224 | 33 | 20 | 23 | 21 | 16 | 4 | 1 | 391 | 12 |
| 4 | 698 | 50 | 374 | 66 | 31 | 31 | 28 | 21 | 6 | 1 | 607 | 29 |
| 5 | 555 | 50 | 578 | 98 | 54 | 40 | 37 | 19 | 8 | 2 | 888 | 53 |
| 6 | 377 | 50 | 844 | 162 | 74 | 51 | 50 | 25 | 13 | 4 | 1272 | 93 |
| 7 | 240 | 50 | 1136 | 153 | 89 | 55 | 66 | 47 | 16 | 7 | 1618 | 161 |
| 8 | 141 | 50 | 1438 | 160 | 135 | 69 | 81 | 51 | 17 | 10 | 2011 | 262 |
| 9 | 77 | 50 | 1755 | 146 | 166 | 78 | 93 | 50 | 23 | 14 | 2375 | 356 |
| 10 | 39 | 50 | 2213 | 180 | 193 | 100 | 107 | 23 | 38 | 16 | 2919 | 413 |
| 11 | 14 | 50 | 2827 | 171 | 269 | 107 | 129 | 57 | 37 | 28 | 3676 | 509 |
| 12 | 8 | 50 | 2966 | 300 | 310 | 131 | 125 | 0 | 76 | 15 | 3973 | 405 |
| 13+ | 5 | 50 | 4445 | 240 | 416 | 300 | 93 | 0 | 131 | 9 | 5683 | 494 |

## What a store holds

**Median price of each group of shelf lines at store visits** (the whole shelf, each line at the price this hero pays; Rations as price × stock left; the medians of the groups do not add up to the median of the total)

| Floor | Visits | Whole store | food | potions | lockpicks | repair | weapons | armour | scroll | premium | rations | tools |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 85 | 2734 | 60 | 450 | 450 | 0 | 173 | 0 | 0 | 900 | 135 | 85 |
| 2 | 78 | 3745 | 60 | 850 | 450 | 0 | 375 | 0 | 0 | 1000 | 150 | 235 |
| 3 | 59 | 3945 | 60 | 900 | 450 | 0 | 438 | 0 | 0 | 1050 | 150 | 235 |
| 4 | 53 | 3414 | 60 | 630 | 315 | 0 | 420 | 0 | 0 | 1000 | 126 | 235 |
| 5 | 39 | 4215 | 60 | 1085 | 450 | 0 | 700 | 525 | 0 | 1000 | 120 | 235 |
| 6 | 27 | 4282 | 60 | 1000 | 450 | 0 | 550 | 375 | 0 | 1400 | 189 | 235 |
| 7 | 24 | 3725 | 60 | 1085 | 450 | 0 | 650 | 375 | 0 | 1050 | 120 | 235 |
| 8 | 3 | 3259 | 43 | 775 | 315 | 0 | 420 | 500 | 0 | 1100 | 38 | 235 |
| 9 | 8 | 4875 | 60 | 1150 | 315 | 0 | 875 | 0 | 0 | 2000 | 150 | 235 |
| 10 | 2 | 4053 | 53 | 630 | 315 | 0 | 766 | 657 | 630 | 1750 | 135 | 165 |
| 11 | 1 | 4205 | 43 | 595 | 0 | 0 | 910 | 1400 | 0 | 1050 | 42 | 165 |
| 12 | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| 13+ | 1 | 3181 | 31 | 625 | 0 | 0 | 525 | 375 | 0 | 1375 | 15 | 235 |

## Reading

**At depth 7, on the gold the hero holds:** the typical (median) hero reaching a store holds 1,028 wilmst against a store worth 3,725, a share of 24% (the middle half of visits spans 14% to 40%); 0.0% of those 24 visits could buy the whole store. Across all 240 depth-7 arrivals the median hero holds 978 against 4,065, a share of 23%, and 4.6% could buy the whole store.

**At depth 7, with the bag sold:** the median share is 86% at store visits (45.8% of visits could buy the whole store) and 98% across arrivals (48.3% could). The bot carries all its finds and never sells them, so by depth 7 the bag is worth far more than the purse.

**The curve (floor arrivals, median share of the store):** floor 2 2% on gold alone / 8% with the bag; floor 4 8% / 49%; floor 7 23% / 98%; floor 10 46% / 100%. Gold alone climbs steadily; with the bag sold the typical hero is at the whole store by floor 8. A store's total barely moves with depth (the median whole store is 3,745 at floor 2 and 3,725 at floor 7), so the climb is all income and loot, none of it prices.

**Where the gold comes from** (mean per run, cumulative to depth 7: 1,618 wilmst, of which the starting purse is 50): chest 1,136 (70.2%), parley 153 (9.5%), tableFour 89 (5.5%). Chests alone are 70.2% of the income to depth 7 and 66.6% of all income in the 1,000 runs. The bot spends little: 161 wilmst at stores by depth 7.

**How this squares with the device report:** on gold alone the depth-7 store is not bought out (about a quarter of it is affordable). The report fits the with-bag view: a player who sells what the bag holds can buy about half the depth-7 stores outright, and about six in ten from floor 8 on. So the complaint is real for a human who sells, and invisible to a bot that does not; that is why the target below is judged on gold plus the bag's sale value.

## Target and levers (for the user)

**Target (ROADMAP default, to be confirmed):** at depth 7 the typical hero can afford about a third to a half of a store, not all of it: the median share between 33% and 50% of the whole store, judged on gold plus what the bag would sell for. Nobody typical buys it all.

**Where the rules stand against it:** 98% (arrivals) and 86% (visits) with the bag sold, well above the band; 23% and 24% on gold alone, under it. Whichever basis the user picks decides whether there is anything to retune: judged on gold alone the median is already below the band (a retune would make stores cheaper or gold richer, the opposite of the complaint); judged on gold plus the bag it is far above it.

**Proposed shape at other depths:** floors 1–4 stay about where they are so early shopping still works; floors 8–12 no higher than depth 7. Note that on the with-bag basis floor 4 already sits at 49% (arrivals), so a price rise by store tier (floors 2–4 are tier 1) will move floors 2–4 too; 92-03 would shape the multiplier by tier so floor 1 is untouched and the deeper tiers climb faster.

The three levers (first guesses are the value that puts the depth-7 median share at about 42%, from the projection tables below, with the bot's own buying held fixed; the bot spends so little that this holds well):

**Lever P: store prices rise with depth.** A price multiplier by store tier (floor 1 unchanged), on the groups the user picks. It touches the store lines only (the bag's sale value is not a store price and stays put), so it works on both bases. First guess on gold plus bag, depth 7 at 42%:

- Recommended scope, potions, lockpicks, weapons, armour, scroll and premium (rations, food, repairs and tools stay flat, so starvation and armour upkeep do not move): about x2.2 on the store-visit sample, x2.55 on the arrival sample.
- Gear only (weapons, armour, premium): about x3.17 (visits), x3.72 (arrivals); a bigger multiplier because it covers less of the shelf.
- What else it moves: the early floors (every store from floor 2 on; the multiplier is by tier, so floor 1 stays); the Enlarge potion price (150 today) rises with the potions, which is the ITEM-AUDIT note that Enlarge may move with the store economy (recommended: no separate Enlarge change); difficulty, a little, through the gear a player can buy (the bot spends only 161 wilmst by depth 7, so the bot's own play barely changes); the store fixtures and texts that quote a price.
- How 92-03 builds it: a new DIALS entry at identity first (nothing moves until the value is locked), read at `openStore` where the line price is set, then the found value.

**Lever G: cut the gold income at the largest source.** `LOOT_SCALE` (today 0.8) scales the four `lootFor` sources together (off the body, chest, tableFour, faerie); a per-source cut would be a new dial. The projection says this cannot reach the band on the with-bag basis: cutting all four sources to nothing leaves the depth-7 median at 72% (visits) and 75% (arrivals) with the bag sold, because the bag's sale value does not shrink. On gold alone it would make the below-band median lower still. What else it moves: every floor's income, so the early floors and the rations/gear the bot can afford.

**Lever C: lower the bags' wilmst carry caps** (2,000 / 5,000 / 8,000 / 10,000 today). The projection says it barely moves the depth-7 median on the with-bag basis (down to a quarter of today's caps leaves 84% on visits and 89% on arrivals): few depth-7 heroes sit at the cap (8.3% of visits). It would also hurt a hero saving for gear.

**The recommended lever:** by the rule this readout was written to (if one source carries more than half of the income to depth 7 and stands out, recommend trimming it, lever G; otherwise lever P), chests are 70.2% of the income to depth 7, so the rule's literal answer is G. The projection overrides it: trimming income cannot bring the with-bag median into the band (above), because most of what lets a human buy the store is the bag, not the purse. **Recommended: lever P**, on the recommended scope, because the complaint is a mid-depth buy-out, early shopping should stay as it is, and P is the only lever that reaches the band on the basis where there is a problem.

**Projection tables** (the same projection run over each lever's grid, both bases; the share columns are the median share of the store the hero can afford, the last column the share by floor at store visits):

**Lever price on weapons, armour, premium, judged on gold held** (first guess: the bot's own buying is held fixed)

| price multiplier | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 24% | 23% | 0.0% | 3% 3% 5% 10% 11% 14% 24% 60% 34% 85% 34% n/a |
| 1.25 | 22% | 20% | 0.0% | 2% 3% 5% 10% 10% 12% 22% 53% 28% 76% 28% n/a |
| 1.5 | 20% | 18% | 0.0% | 2% 3% 4% 9% 9% 11% 20% 48% 25% 68% 24% n/a |
| 2 | 16% | 15% | 0.0% | 2% 2% 3% 8% 7% 9% 16% 40% 20% 57% 19% n/a |
| 2.5 | 13% | 12% | 0.0% | 2% 2% 3% 7% 6% 8% 13% 34% 18% 49% 15% n/a |
| 3 | 11% | 11% | 0.0% | 2% 2% 3% 6% 6% 7% 11% 30% 15% 43% 13% n/a |
| 4 | 9% | 9% | 0.0% | 1% 1% 2% 5% 5% 5% 9% 24% 12% 34% 10% n/a |
| 5 | 8% | 7% | 0.0% | 1% 1% 2% 4% 4% 5% 8% 20% 10% 29% 8% n/a |
| 6 | 7% | 6% | 0.0% | 1% 1% 1% 3% 3% 4% 7% 17% 9% 25% 7% n/a |
| 8 | 5% | 5% | 0.0% | 1% 1% 1% 3% 3% 3% 5% 13% 7% 19% 5% n/a |
| 10 | 4% | 4% | 0.0% | 1% 1% 1% 2% 2% 3% 4% 11% 6% 16% 4% n/a |
| 12 | 3% | 3% | 0.0% | 1% 1% 1% 2% 2% 2% 3% 9% 5% 13% 3% n/a |
| 16 | 3% | 2% | 0.0% | 0% 0% 1% 2% 1% 2% 3% 7% 4% 10% 3% n/a |

**Lever price on potions, lockpicks, weapons, armour, scroll, premium, judged on gold held** (first guess: the bot's own buying is held fixed)

| price multiplier | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 24% | 23% | 0.0% | 3% 3% 5% 10% 11% 14% 24% 60% 34% 85% 34% n/a |
| 1.25 | 20% | 19% | 0.0% | 2% 3% 4% 8% 9% 11% 20% 49% 27% 70% 28% n/a |
| 1.5 | 17% | 16% | 0.0% | 2% 2% 4% 7% 8% 10% 17% 41% 23% 59% 23% n/a |
| 2 | 13% | 12% | 0.0% | 1% 2% 3% 5% 6% 7% 13% 31% 17% 45% 18% n/a |
| 2.5 | 11% | 10% | 0.0% | 1% 1% 2% 4% 5% 6% 11% 25% 14% 36% 14% n/a |
| 3 | 9% | 9% | 0.0% | 1% 1% 2% 4% 4% 5% 9% 21% 12% 30% 12% n/a |
| 4 | 7% | 6% | 0.0% | 1% 1% 1% 3% 3% 4% 7% 16% 9% 23% 9% n/a |
| 5 | 5% | 5% | 0.0% | 1% 1% 1% 2% 2% 3% 5% 13% 7% 18% 7% n/a |
| 6 | 5% | 4% | 0.0% | 1% 1% 1% 2% 2% 2% 5% 11% 6% 15% 6% n/a |
| 8 | 3% | 3% | 0.0% | 0% 0% 1% 2% 2% 2% 3% 8% 4% 12% 4% n/a |
| 10 | 3% | 3% | 0.0% | 0% 0% 1% 1% 1% 2% 3% 6% 4% 9% 4% n/a |
| 12 | 2% | 2% | 0.0% | 0% 0% 1% 1% 1% 1% 2% 5% 3% 8% 3% n/a |
| 16 | 2% | 2% | 0.0% | 0% 0% 0% 1% 1% 1% 2% 4% 2% 6% 2% n/a |

**Lever income on off the body, chest, tableFour, faerie, judged on gold held** (first guess: the bot's own buying is held fixed)

| income factor | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 24% | 23% | 0.0% | 3% 3% 5% 10% 11% 14% 24% 60% 34% 85% 34% n/a |
| 0.9 | 22% | 21% | 0.0% | 3% 3% 5% 10% 10% 13% 22% 54% 30% 77% 31% n/a |
| 0.8 | 20% | 18% | 0.0% | 3% 3% 4% 9% 10% 12% 20% 48% 27% 69% 27% n/a |
| 0.7 | 18% | 16% | 0.0% | 3% 3% 4% 8% 9% 10% 18% 42% 24% 60% 24% n/a |
| 0.6 | 14% | 14% | 0.0% | 3% 3% 3% 7% 7% 9% 14% 37% 20% 52% 20% n/a |
| 0.5 | 12% | 12% | 0.0% | 2% 2% 3% 6% 6% 8% 12% 31% 17% 44% 17% n/a |
| 0.4 | 10% | 10% | 0.0% | 2% 2% 3% 5% 6% 6% 10% 25% 14% 35% 14% n/a |
| 0.3 | 9% | 8% | 0.0% | 2% 2% 3% 4% 5% 5% 9% 19% 11% 27% 10% n/a |
| 0.2 | 7% | 6% | 0.0% | 2% 2% 2% 4% 3% 4% 7% 13% 7% 19% 7% n/a |
| 0.1 | 4% | 4% | 0.0% | 2% 2% 2% 3% 3% 3% 4% 7% 4% 10% 3% n/a |
| 0 | 2% | 2% | 0.0% | 2% 2% 1% 2% 1% 2% 2% 2% 1% 2% 0% n/a |

**Lever cap on the bag cap, judged on gold held** (first guess: the bot's own buying is held fixed)

| bag-cap factor | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 24% | 22% | 0.0% | 3% 3% 5% 10% 11% 14% 24% 50% 30% 78% 34% n/a |
| 0.8 | 24% | 22% | 0.0% | 3% 3% 5% 10% 11% 14% 24% 40% 26% 78% 34% n/a |
| 0.6 | 20% | 21% | 0.0% | 3% 3% 5% 10% 11% 14% 20% 37% 19% 74% 34% n/a |
| 0.5 | 20% | 19% | 0.0% | 3% 3% 5% 10% 11% 14% 20% 34% 16% 62% 34% n/a |
| 0.4 | 19% | 17% | 0.0% | 3% 3% 5% 10% 11% 14% 19% 27% 16% 49% 34% n/a |
| 0.3 | 16% | 15% | 0.0% | 3% 3% 5% 10% 11% 12% 16% 20% 16% 37% 34% n/a |
| 0.25 | 14% | 13% | 0.0% | 3% 3% 5% 10% 10% 12% 14% 17% 14% 31% 34% n/a |
| 0.2 | 12% | 11% | 0.0% | 3% 3% 4% 10% 9% 10% 12% 13% 14% 25% 34% n/a |
| 0.15 | 9% | 9% | 0.0% | 3% 3% 4% 8% 8% 7% 9% 10% 14% 19% 29% n/a |
| 0.1 | 6% | 7% | 0.0% | 3% 3% 4% 5% 6% 5% 6% 7% 9% 12% 19% n/a |
| 0.05 | 3% | 4% | 0.0% | 3% 2% 3% 3% 3% 3% 3% 3% 5% 6% 10% n/a |

**Lever price on weapons, armour, premium, judged on gold plus the bag sold** (first guess: the bot's own buying is held fixed)

| price multiplier | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 86% | 98% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 1.25 | 77% | 88% | 33.3% | 3% 15% 28% 55% 53% 38% 77% 100% 83% 100% 90% n/a |
| 1.5 | 69% | 79% | 29.2% | 3% 14% 27% 49% 47% 34% 69% 100% 72% 100% 77% n/a |
| 2 | 58% | 67% | 20.8% | 3% 11% 24% 46% 39% 28% 58% 90% 57% 100% 60% n/a |
| 2.5 | 50% | 57% | 20.8% | 2% 10% 20% 40% 33% 25% 50% 75% 48% 87% 49% n/a |
| 3 | 43% | 49% | 12.5% | 2% 9% 18% 34% 29% 22% 43% 65% 42% 74% 41% n/a |
| 4 | 35% | 39% | 0.0% | 2% 8% 15% 26% 23% 18% 35% 51% 34% 57% 32% n/a |
| 5 | 29% | 33% | 0.0% | 1% 7% 12% 21% 19% 15% 29% 42% 28% 46% 26% n/a |
| 6 | 25% | 28% | 0.0% | 1% 6% 10% 18% 16% 13% 25% 36% 24% 39% 22% n/a |
| 8 | 19% | 22% | 0.0% | 1% 5% 8% 14% 13% 10% 19% 28% 19% 30% 16% n/a |
| 10 | 15% | 18% | 0.0% | 1% 4% 7% 11% 10% 8% 15% 22% 15% 25% 13% n/a |
| 12 | 13% | 15% | 0.0% | 1% 3% 6% 10% 9% 7% 13% 19% 13% 21% 11% n/a |
| 16 | 10% | 12% | 0.0% | 1% 3% 4% 7% 7% 5% 10% 14% 10% 16% 8% n/a |

**Lever price on potions, lockpicks, weapons, armour, scroll, premium, judged on gold plus the bag sold** (first guess: the bot's own buying is held fixed)

| price multiplier | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 86% | 98% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 1.25 | 70% | 80% | 25.0% | 3% 14% 27% 52% 49% 36% 70% 100% 80% 100% 87% n/a |
| 1.5 | 59% | 69% | 20.8% | 2% 12% 24% 44% 42% 30% 59% 99% 68% 100% 73% n/a |
| 2 | 45% | 53% | 16.7% | 2% 9% 18% 34% 32% 23% 45% 75% 52% 99% 56% n/a |
| 2.5 | 37% | 43% | 4.2% | 1% 7% 15% 27% 26% 19% 37% 61% 42% 80% 45% n/a |
| 3 | 31% | 36% | 0.0% | 1% 6% 12% 23% 22% 16% 31% 51% 35% 67% 37% n/a |
| 4 | 23% | 27% | 0.0% | 1% 5% 9% 17% 17% 12% 23% 39% 27% 51% 28% n/a |
| 5 | 19% | 22% | 0.0% | 1% 4% 8% 14% 14% 10% 19% 31% 21% 41% 23% n/a |
| 6 | 16% | 18% | 0.0% | 1% 3% 6% 12% 11% 8% 16% 26% 18% 34% 19% n/a |
| 8 | 12% | 14% | 0.0% | 0% 2% 5% 9% 9% 6% 12% 20% 13% 26% 14% n/a |
| 10 | 10% | 11% | 0.0% | 0% 2% 4% 7% 7% 5% 10% 16% 11% 21% 11% n/a |
| 12 | 8% | 9% | 0.0% | 0% 2% 3% 6% 6% 4% 8% 13% 9% 17% 10% n/a |
| 16 | 6% | 7% | 0.0% | 0% 1% 2% 5% 4% 3% 6% 10% 7% 13% 7% n/a |

**Lever income on off the body, chest, tableFour, faerie, judged on gold plus the bag sold** (first guess: the bot's own buying is held fixed)

| income factor | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 86% | 98% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 0.9 | 84% | 97% | 45.8% | 3% 17% 31% 62% 60% 43% 84% 100% 97% 100% 100% n/a |
| 0.8 | 83% | 95% | 45.8% | 3% 16% 31% 61% 59% 42% 83% 100% 94% 100% 100% n/a |
| 0.7 | 82% | 93% | 41.7% | 3% 16% 30% 60% 59% 40% 82% 100% 90% 100% 98% n/a |
| 0.6 | 81% | 92% | 37.5% | 3% 16% 29% 58% 59% 39% 81% 100% 90% 100% 94% n/a |
| 0.5 | 80% | 89% | 29.2% | 3% 16% 28% 57% 59% 38% 80% 100% 90% 100% 91% n/a |
| 0.4 | 79% | 85% | 29.2% | 3% 16% 28% 56% 56% 38% 79% 100% 90% 100% 87% n/a |
| 0.3 | 79% | 83% | 29.2% | 3% 16% 27% 55% 54% 38% 79% 100% 90% 100% 84% n/a |
| 0.2 | 76% | 78% | 29.2% | 3% 16% 26% 53% 53% 37% 76% 100% 89% 100% 81% n/a |
| 0.1 | 73% | 75% | 29.2% | 3% 16% 25% 52% 52% 37% 73% 100% 87% 100% 77% n/a |
| 0 | 72% | 75% | 29.2% | 3% 16% 25% 51% 51% 37% 72% 100% 82% 100% 74% n/a |

**Lever cap on the bag cap, judged on gold plus the bag sold** (first guess: the bot's own buying is held fixed)

| bag-cap factor | Floor 7 store visits: median share | Floor 7 arrivals: median share | Floor 7 visits that buy the whole store | Share by floor at visits (floors 1–12) |
| --- | --- | --- | --- | --- |
| 1 | 86% | 98% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 0.8 | 86% | 98% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 0.6 | 86% | 96% | 45.8% | 3% 17% 32% 63% 60% 44% 86% 100% 98% 100% 100% n/a |
| 0.5 | 86% | 96% | 41.7% | 3% 17% 32% 63% 60% 42% 86% 100% 98% 100% 100% n/a |
| 0.4 | 86% | 94% | 41.7% | 3% 17% 32% 63% 60% 42% 86% 100% 98% 100% 100% n/a |
| 0.3 | 86% | 91% | 41.7% | 3% 17% 29% 62% 60% 42% 86% 100% 98% 100% 100% n/a |
| 0.25 | 84% | 89% | 37.5% | 3% 17% 29% 59% 60% 42% 84% 100% 95% 100% 100% n/a |
| 0.2 | 84% | 86% | 33.3% | 3% 17% 29% 58% 59% 41% 84% 100% 92% 100% 100% n/a |
| 0.15 | 84% | 83% | 33.3% | 3% 17% 29% 56% 57% 40% 84% 100% 90% 100% 100% n/a |
| 0.1 | 80% | 80% | 29.2% | 3% 17% 27% 54% 57% 40% 80% 100% 87% 100% 93% n/a |
| 0.05 | 75% | 75% | 25.0% | 3% 15% 25% 51% 54% 37% 75% 100% 85% 100% 83% n/a |

## Ruling

**Date:** 2026-10-01 (the 92-02 checkpoint).

The user's words: "33–50% incl. selling", "S: stores pay less when you sell", "Floors 1–4 about unchanged, 8–12 no richer than 7". That is E1 A on the arrival sample (store visits reported beside it), E2 A, and E3 a lever the checkpoint did not list, S, offered by the orchestrator and chosen by the user in place of P, G and C.

**Target:** at depth 7 the typical hero's median share of a whole store is 33% to 50%, judged on gold held PLUS the bag's sale value (`sellPriceFor` over the bag), on the floor-arrival sample (n = 240 at depth 7 in the 1,000-seed readout), with the store-visit sample (n = 24) reported beside it. Today: 98% (arrivals) and 86% (visits).

**Shape:** floors 1–4 about unchanged; floors 8–12 no higher than depth 7. Judged on the arrival sample, both bases reported.

**Lever:** S, stores pay less when you sell. The sell-price fraction in `engine/economy.js#sellPriceFor` (today the module constant `SELL_SPREAD = 0.5`, half the item's base value) is lowered until the target holds. Scope: the sale price only. Buy prices, the rations line, every gold source, the bag caps and floor-1 play are untouched; the Pickpocket's sell drawback (x0.75 of the ordinary sell price) and Q5 A (every race sells at the ordinary price) stay as relative rules on top of the new base fraction. **92-03's plan was written around P, G and C: the lever is S, so 92-03 builds a sell-fraction dial (a DIALS entry read by `sellPriceFor`) at identity (0.5) first, with nothing moving until the value is locked, then finds the value.** The fair bot never sells, so this lever does not change any bot run; the gold-held numbers cannot move, and only the bag's sale value (and so the with-bag share) does.

**First candidate:** a sell fraction of 0.125 (an eighth of the base value, a quarter of today's 0.5). The stored projections cannot estimate S directly (the per-visit bag value is not stored), so this is a first guess from the stored depth-7 medians: with the bag sold today the arrival median is 98% against 23% on gold alone, so the bag adds about 75 points; scaling that by f/0.5 and solving for 42% gives f/0.5 = (0.42 - 0.233) / (0.978 - 0.233) = 0.25, so f = 0.125 (the visit sample gives 0.144). The band 33–50% brackets about f = 0.065 to 0.18. The first guess is likely a little high, because the shares are capped at 100% and the stored with-bag median understates the bag. 92-03 finds the value in blocks (suggested first block: 0.10, 0.125, 0.15, 0.20), each a fresh readout.

**Stop rule:** the first candidate whose 1,000-seed readout puts the depth-7 median share inside 33–50% (gold plus bag, arrival sample) and meets the shape is locked. A block of up to 10 evaluations that does not close the gap by 10% or more, or a pattern showing the lever cannot reach the band, returns to the orchestrator.

Two things for 92-03 to check and report, not to hide:
- Early floors: S lowers the with-bag share on every floor, so floors 1–4 are unchanged on gold alone (by construction) but fall on the with-bag basis (floor 4 arrivals: 49% today, roughly 18% at f = 0.125, by the same scaling). "About unchanged" is read as: gold-held shares identical, and no floor 1–4 with-bag share above today's.
- Floors 8–12: on gold alone the arrival median is already 32% at floor 8, 34% at 9, 46% at 10, 67% at 11 and 75% at 12 (n = 141, 77, 39, 14, 8; thin past floor 9), so a sell fraction alone cannot hold floors 10–12 at or under depth 7's share: that tail is income, not sales. 92-03 reports it with its n; a lever on the tail (income or prices by tier) is a decision for the user, not a silent addition.

## After the retune (92-03)

**Date:** 2026-10-01 (plan 92-03).
**Measured:** commit 21111a88, `node tools/tune-economy.mjs --seeds=1000 --workers=4` on the shipped dials, no `--dials` (the proof run; stored in `docs/economy/econ-after-1000.json`, console text in `tools/readouts/92-econ-after-1000.txt`). The same 1,000 seeds, the same fair bot and the same runs as the before readout: the bot never sells, so only the bag's sale value moves.

**The lock.** The ruled lever is S, stores pay less when you sell, shaped by depth ("Scale with depth", user, 2026-10-01). It is one dial, `DIALS.SELL_FRACTION` in `engine/difficulty.js`, locked at `{ shallow: 0.5, deep: 0.125, shallowTo: 4, deepFrom: 7 }`: the share of an item's base value a store pays is 0.5 on floors 1 to 4 (today's half), eases down on floors 5 and 6 (0.375, 0.25), and is 0.125, an eighth of the base value, from floor 7 on. `engine/economy.js#sellPriceFor` reads it by the floor the store is on; the Pickpocket's x0.75 and Q5 A (every race is paid alike) ride on top of it. The value was found by measurement: `fit/econ-log.jsonl` (plan 92-03's phase directory) row 1, deep 0.125, put the depth-7 median at 42.05% on the first try (the Ruling's first candidate), inside the middle third of the band, so it was locked; row 2, deep 0.10, was run as a bracket and gives 38.9%. Locked by commit 21111a88; `fit/econ-lock.json` carries the same four leaves and a traced test (`test/difficulty/difficulty.test.js`) holds every leaf equal to `DIALS`.

**Depth 7, before -> after (floor arrivals, n = 240):** the median share of a whole store with the bag sold is 98% -> 42% (42.0%, the band is 33% to 50%); 48.3% -> 9.6% of those heroes could buy the whole store. At store visits (n = 24) the median share is 86% -> 41% (41.4%). On gold alone nothing moved (23%): the bot never sells.

**The shape, floor by floor** (arrival sample unless the last column says visits; the gold-alone column is identical before and after by construction):

| Floor | Arrivals (n) | Gold alone, median share: before -> after | Gold plus bag sold, median share: before -> after | Buys the whole store (bag sold): before -> after | Store visits (n) | Visits, bag sold, median share: before -> after |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 2% -> 2% | 2% -> 2% | 0% -> 0% | 85 | 3% -> 3% |
| 2 | 987 | 2% -> 2% | 8% -> 8% | 2.5% -> 2.5% | 78 | 17% -> 17% |
| 3 | 835 | 4% -> 4% | 28% -> 28% | 8.6% -> 8.6% | 59 | 32% -> 32% |
| 4 | 698 | 8% -> 8% | 49% -> 49% | 19.1% -> 19.1% | 53 | 63% -> 63% |
| 5 | 555 | 10% -> 10% | 57% -> 46% | 22.5% -> 15.7% | 39 | 60% -> 48% |
| 6 | 377 | 17% -> 17% | 76% -> 47% | 36.6% -> 15.1% | 27 | 44% -> 29% |
| 7 | 240 | 23% -> 23% | 98% -> 42% | 48.3% -> 9.6% | 24 | 86% -> 41% |
| 8 | 141 | 32% -> 32% | 100% -> 53% | 59.6% -> 12.8% | 3 | 100% -> 73% |
| 9 | 77 | 34% -> 34% | 100% -> 54% | 59.7% -> 16.9% | 8 | 98% -> 43% |
| 10 | 39 | 46% -> 46% | 100% -> 69% | 69.2% -> 25.6% | 2 | 100% -> 100% |
| 11 | 14 | 67% -> 67% | 100% -> 92% | 92.9% -> 35.7% | 1 | 100% -> 52% |
| 12 | 8 | 75% -> 75% | 100% -> 89% | 87.5% -> 37.5% | 0 | n/a |

**Floors 1 to 4:** gold-held shares are identical and no with-bag share rose (floor 4 is 49% before and after): the early stores pay what they always paid. **Floors 5 and 6** ease down (57% -> 46%, 76% -> 47%). **Floors 8 to 12 are reported, not hidden:** with the bag sold the median is 53% at floor 8 and 54% at floor 9 (n = 141 and 77), then 69%, 92% and 89% at floors 10 to 12 (n = 39, 14, 8). Those floors sit above depth 7's 42.0% because the gold in the purse alone climbs there (32% at floor 8, 34% at 9, 46% at 10, 67% at 11, 75% at 12), which is income from chests and a few heroes who live that long, not something a sell fraction can reach. The user accepted the floors 10 to 12 overshoot and asked to have it recorded (2026-10-01: "Accept and record it"). Floors 8 and 9 are over depth 7 by about 11 points and over the band's 50% edge by about 3 to 4 points; holding them at or under depth 7 would need the fraction to keep falling past floor 7 (a second step down), which is a shape the ruling did not ask for and is left to the user. The bracket row (deep 0.10) gives 38.9% at floor 7 and 49% at floors 8 and 9.

**Store visits** (the gold the hero holds when a store opens, against the whole shelf)

| Floor | Runs reaching | Visits | Gold held, median (p25–p75) | Whole store, median | Share of the store the hero can afford, median (p25–p75) | Visits that buy the whole store | Gold plus bag sold: share, median | Gold plus bag sold: buys the whole store | Gold at the bag cap | Spent at stores so far (mean) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 85 | 52 (50–62) | 2734 | 3% (2%–5%) | 0 of 85 (0.0%) | 3% | 2.4% | 0.0% | 0 |
| 2 | 987 | 78 | 136 (62–258) | 3745 | 3% (2%–7%) | 0 of 78 (0.0%) | 17% | 14.1% | 0.0% | 1 |
| 3 | 835 | 59 | 221 (86–456) | 3945 | 5% (2%–10%) | 0 of 59 (0.0%) | 32% | 10.2% | 0.0% | 2 |
| 4 | 698 | 53 | 391 (228–677) | 3414 | 10% (6%–22%) | 0 of 53 (0.0%) | 63% | 26.4% | 0.0% | 9 |
| 5 | 555 | 39 | 598 (330–917) | 4215 | 11% (8%–23%) | 1 of 39 (2.6%) | 48% | 12.8% | 0.0% | 35 |
| 6 | 377 | 27 | 992 (535–1317) | 4282 | 14% (11%–41%) | 1 of 27 (3.7%) | 29% | 22.2% | 3.7% | 89 |
| 7 | 240 | 24 | 1028 (710–1629) | 3725 | 24% (14%–40%) | 0 of 24 (0.0%) | 41% | 12.5% | 8.3% | 236 |
| 8 | 141 | 3 | 2417 (1207–2774) | 3259 | 60% (37%–93%) | 0 of 3 (0.0%) | 73% | 33.3% | 66.7% | 0 |
| 9 | 77 | 8 | 1830 (1032–3142) | 4875 | 34% (16%–61%) | 1 of 8 (12.5%) | 43% | 25.0% | 37.5% | 182 |
| 10 | 39 | 2 | 3200 (3148–3200) | 4053 | 85% (78%–85%) | 0 of 2 (0.0%) | 100% | 50.0% | 50.0% | 325 |
| 11 | 14 | 1 | 1431 (1431–1431) | 4205 | 34% (34%–34%) | 0 of 1 (0.0%) | 52% | 0.0% | 0.0% | 396 |
| 12 | 8 | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| 13+ | 5 | 1 | 6281 (6281–6281) | 3181 | 100% (100%–100%) | 1 of 1 (100.0%) | 100% | 100.0% | 0.0% | 0 |

**Floor arrivals** (the gold the hero holds on reaching the floor, against the store that hero would face there)

| Floor | Arrivals | Gold held, median | Store they would face, median | Share affordable, median | Buys the whole store | Gold plus bag sold: share, median | Gold plus bag sold: buys the whole store |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 2680 | 2% | 0.0% | 2% | 0.0% |
| 2 | 987 | 64 | 3630 | 2% | 0.0% | 8% | 2.5% |
| 3 | 835 | 184 | 3710 | 4% | 0.0% | 28% | 8.6% |
| 4 | 698 | 318 | 3735 | 8% | 0.0% | 49% | 19.1% |
| 5 | 555 | 515 | 4239 | 10% | 0.9% | 46% | 15.7% |
| 6 | 377 | 779 | 4198 | 17% | 1.6% | 47% | 15.1% |
| 7 | 240 | 978 | 4065 | 23% | 4.6% | 42% | 9.6% |
| 8 | 141 | 1347 | 3925 | 32% | 3.5% | 53% | 12.8% |
| 9 | 77 | 1771 | 4525 | 34% | 6.5% | 54% | 16.9% |
| 10 | 39 | 2087 | 4100 | 46% | 12.8% | 69% | 25.6% |
| 11 | 14 | 2349 | 3845 | 67% | 28.6% | 92% | 35.7% |
| 12 | 8 | 3622 | 4107 | 75% | 37.5% | 89% | 37.5% |
| 13+ | 13 | 5595 | 3131 | 100% | 69.2% | 100% | 69.2% |

**All runs, by source**

| Source | Gold (all runs) | Share |
| --- | --- | --- |
| start | 50000 | 5.3% |
| chest | 625784 | 66.6% |
| parley | 98400 | 10.5% |
| tableFour | 54480 | 5.8% |
| grimoire | 36900 | 3.9% |
| off the body | 36708 | 3.9% |
| faerie | 25600 | 2.7% |
| parley spoils | 9363 | 1.0% |
| cutpurse | 2934 | 0.3% |

**Mean income on each floor** (per run that reached it; `start` is the starting purse, counted on floor 1)

| Floor | Runs reaching | start | chest | parley | tableFour | grimoire | off the body | faerie | parley spoils | cutpurse | Total on this floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 43 | 3 | 3 | 6 | 6 | 6 | 1 | 0 | 117 |
| 2 | 987 | 0 | 73 | 11 | 7 | 9 | 8 | 3 | 1 | 0 | 112 |
| 3 | 835 | 0 | 103 | 19 | 10 | 7 | 7 | 7 | 2 | 0 | 154 |
| 4 | 698 | 0 | 141 | 32 | 11 | 8 | 7 | 5 | 2 | 1 | 204 |
| 5 | 555 | 0 | 179 | 32 | 25 | 7 | 8 | 2 | 3 | 1 | 257 |
| 6 | 377 | 0 | 217 | 49 | 13 | 6 | 9 | 3 | 4 | 1 | 302 |
| 7 | 240 | 0 | 286 | 18 | 14 | 6 | 10 | 19 | 3 | 1 | 357 |
| 8 | 141 | 0 | 227 | 45 | 36 | 14 | 11 | 8 | 4 | 2 | 347 |
| 9 | 77 | 0 | 222 | 0 | 19 | 2 | 8 | 0 | 4 | 2 | 257 |
| 10 | 39 | 0 | 291 | 0 | 21 | 4 | 9 | 0 | 8 | 0 | 332 |
| 11 | 14 | 0 | 453 | 0 | 0 | 11 | 2 | 0 | 1 | 0 | 467 |
| 12 | 8 | 0 | 132 | 0 | 0 | 19 | 2 | 0 | 12 | 0 | 164 |
| 13+ | 5 | 0 | 1923 | 0 | 0 | 90 | 1 | 0 | 36 | 0 | 2050 |

**Mean income cumulative to each floor** (per run that reached it)

| Floor | Runs reaching | start | chest | parley | tableFour | grimoire | off the body | faerie | parley spoils | cutpurse | Total to this floor | Spent at stores to this floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1000 | 50 | 43 | 3 | 3 | 6 | 6 | 6 | 1 | 0 | 117 | 0 |
| 2 | 987 | 50 | 115 | 14 | 10 | 15 | 14 | 9 | 2 | 1 | 229 | 4 |
| 3 | 835 | 50 | 224 | 33 | 20 | 23 | 21 | 16 | 4 | 1 | 391 | 12 |
| 4 | 698 | 50 | 374 | 66 | 31 | 31 | 28 | 21 | 6 | 1 | 607 | 29 |
| 5 | 555 | 50 | 578 | 98 | 54 | 40 | 37 | 19 | 8 | 2 | 888 | 53 |
| 6 | 377 | 50 | 844 | 162 | 74 | 51 | 50 | 25 | 13 | 4 | 1272 | 93 |
| 7 | 240 | 50 | 1136 | 153 | 89 | 55 | 66 | 47 | 16 | 7 | 1618 | 161 |
| 8 | 141 | 50 | 1438 | 160 | 135 | 69 | 81 | 51 | 17 | 10 | 2011 | 262 |
| 9 | 77 | 50 | 1755 | 146 | 166 | 78 | 93 | 50 | 23 | 14 | 2375 | 356 |
| 10 | 39 | 50 | 2213 | 180 | 193 | 100 | 107 | 23 | 38 | 16 | 2919 | 413 |
| 11 | 14 | 50 | 2827 | 171 | 269 | 107 | 129 | 57 | 37 | 28 | 3676 | 509 |
| 12 | 8 | 50 | 2966 | 300 | 310 | 131 | 125 | 0 | 76 | 15 | 3973 | 405 |
| 13+ | 5 | 50 | 4445 | 240 | 416 | 300 | 93 | 0 | 131 | 9 | 5683 | 494 |

**What else moved:** nothing in a fixture. The parity suite, the economy and store tests, the shell store snapshots and the roll-high state pins are untouched, because the sale at floors 1 to 4 and at no-depth callers pays what it paid, and every test and snapshot that sells does so on floor 1; the new fraction is pinned by `test/unit/econ-retune.test.js`. No player-facing text states a sell rate (the Sell button shows the price the floor pays), so none changed. See `test/parity/FIXTURE-INVENTORY.md` "Phase 92 plan 03".

**ECON-12 verdict:** PASS. A typical depth-7 hero, selling what the bag holds, can afford 42.0% of a store (the ruled band is 33% to 50%), not all of it; 9.6% of depth-7 heroes could buy the whole shelf, down from 48.3%.

**Accepted overshoot (user, 2026-10-01):** after 92-03 the with-bag share on floors 8 and 9 is 53% and 54% against 42% at depth 7 (n = 141 and 77; the sell fraction is flat at an eighth from floor 7, and the purse alone climbs to 32% and 34%), and floors 10 to 12 stay above depth 7 on gold alone (46%, 67%, 75% at n = 39, 14, 8; income, not sales). Both are ACCEPTED and recorded together; nothing is built for them. Revisit after a device playthrough (the cheap alternative on record is the 0.10 bracket from 92-03: floors 7 to 9 at 39%, 49%, 49%).

**Closed 2026-10-01:** the economy is not re-run by the TUNE-10 pass (92-04 and 92-05 changed no price, gold source or shopping rule, and the fair bot never sells), so the last readout is the 92-03 proof run, commit 21111a88, and the ECON-12 verdict above (PASS) stands. TUNE-10 is handled in docs/DIFFICULTY-RETUNE.md "Phase 92 — final reading".
