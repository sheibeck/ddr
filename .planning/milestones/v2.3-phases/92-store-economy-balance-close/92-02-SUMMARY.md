---
phase: 92-store-economy-balance-close
plan: 02
subsystem: tuning-tools
tags: [tune-economy, economy-readout, ECON-11, ECON-12, store-economy, sell-price, readout]
requires:
  - phase: 92-01
    provides: the fair bot with the camp gate, cloak, tally and Cutpurse fixes (the bot the readout measures)
provides:
  - tools/tune-economy.mjs as the ECON-11 readout CLI (store visits, floor arrivals, --workers, --dials, --out, --max-depth)
  - tools/lib/economy-readout.mjs (pure aggregation, lever projections, text and Markdown renderers)
  - the stored 1,000-seed readout (docs/economy/econ-before-1000.json) and docs/ECONOMY-READOUT.md rendered from it, with a guard test
  - the user's ECON-12 ruling (target, shape, lever S) recorded for 92-03
affects: [92-03, 92-04]
tech-stack:
  added: []
  patterns: [docs tables rendered from a stored JSON and held to it by a guard test, worker_threads slices concatenated in slice order for byte-identical output, openStore run on a discarded structuredClone to price the store a hero would face]
key-files:
  created:
    - tools/lib/economy-readout.mjs
    - test/unit/economy-readout.test.js
    - test/unit/economy-readout-ledger.test.js
    - docs/ECONOMY-READOUT.md
    - docs/economy/econ-before-1000.json
    - tools/readouts/92-econ-before-1000.txt
  modified:
    - tools/tune-economy.mjs
decisions:
  - "Target (user, 2026-10-01): depth-7 median share 33-50% of a whole store, judged on gold PLUS the bag's sale value, on the arrival sample (n=240), visits (n=24) reported beside it"
  - "Shape: floors 1-4 about unchanged, floors 8-12 no higher than depth 7"
  - "Lever: S, stores pay less when you sell (a lower sell fraction in sellPriceFor); NOT P, G or C as 92-03's plan assumes"
metrics:
  tasks: 4
  commits: 3 (plus this summary)
  completed: 2026-10-01
status: complete
---

# Phase 92 Plan 02: the store-affordability readout and the ECON-12 ruling Summary

`tools/tune-economy.mjs` now measures, for each floor 1-12 (plus a 13+ row), the gold a hero holds on reaching a store against that store's whole shelf, with gold income by source, on two samples (store visits, and every floor arrival priced against the store that hero would face, via the engine's own `openStore` on a discarded clone), and also shows the bag's sale value. The 1,000-seed readout is stored and recorded in `docs/ECONOMY-READOUT.md`, and the user ruled the target and the lever. Tooling, tests and docs only: no engine, content, shell or parity byte changed.

## What was built

**Task 1 (3995a6e3).** `tools/lib/economy-readout.mjs` (`stockGroups`, `economyReadout`, `projectLever`, `valueForTarget`, `formatEconomyReadout`, `formatEconomyMarkdown`) and the rewritten `tools/tune-economy.mjs` (stale "SCAFFOLD STUB" header gone). New flags: `--workers=N` (contiguous seed slices, concatenated in slice order; output byte-identical for any N, tested), `--dials=<json|path>` (`setDialsForTuning` once per process; an unknown dial exits 1), `--out`, `--max-depth`, `--rows` (test aid). 13 tests in `test/unit/economy-readout.test.js`, including that the arrival pricing never changes a run's `deathDepth` or `actions`.

**Task 2 (466a16cb).** The 1,000-seed run (`--seeds=1000 --workers=4`, measured commit 3995a6e3, shipped dials, 433.4 s). `docs/ECONOMY-READOUT.md` (7 H2s) renders its tables from `docs/economy/econ-before-1000.json`; `test/unit/economy-readout-ledger.test.js` ties the affordability, income, stock and lever tables to the JSON.

**Task 3 and 4 (64761ebb).** Checkpoint put to the user; ruling recorded under `## Ruling`, Status `target confirmed 2026-10-01`, ledger guard extended to require the fixed block.

## Readout headline numbers (depth 7)

The typical hero reaching a depth-7 store holds 1,028 wilmst against a store worth 3,725: 24% affordable (middle half 14-40%), 0 of 24 visits could buy it all (store visits, n = 24). Across all 240 arrivals at depth 7 the median is 978 against 4,065 (23%; 4.6% could buy the whole store). With the bag's sale value added the median share is 86% on visits (45.8% could buy the whole store) and 98% on arrivals (48.3%). Whole stores cost about 3,700-4,100 at every floor from 2 to 8, so the climb is all income. Income to depth 7 averages 1,618 wilmst per run: chests 70%, parley 9.5%, the red-dot cache (tableFour) 5.5%; the bot spends only 161 at stores. On arrivals the curve (gold alone / with the bag) is floor 2 2% / 8%, floor 4 8% / 49%, floor 7 23% / 98%, floor 10 46% / 100%.

## Rulings for 92-03

The user ruled at the checkpoint (2026-10-01): "33-50% incl. selling", "S: stores pay less when you sell", "Floors 1-4 about unchanged, 8-12 no richer than 7". This is E1 A (on the arrival sample, visits reported beside it), E2 A, and a lever the checkpoint did not list.

**92-03's plan was written around levers P, G and C. The lever is S.** 92-03 must build a sell-fraction dial (a DIALS entry read by `engine/economy.js#sellPriceFor`, today the module constant `SELL_SPREAD = 0.5`) at identity (0.5) first, so nothing moves until the value is locked, then find the value.

- **Target:** depth-7 median share of a whole store 33-50%, judged on gold held plus the bag's sale value, arrival sample (n = 240), visits (n = 24) beside it. Today 98% (arrivals), 86% (visits).
- **Shape:** floors 1-4 about unchanged; floors 8-12 no higher than depth 7; arrival sample, both bases reported.
- **Lever:** S. Scope: the sale price only; buy prices, the rations line, every gold source, bag caps and floor-1 play untouched. The Pickpocket's sell drawback (x0.75 of the ordinary sell price) and Q5 A (every race sells at the ordinary price) stay as relative rules on top of the new base fraction. The fair bot never sells, so S does not change any bot run (the gold-held numbers cannot move; only the bag's sale value does), and the 92-04 pass is unaffected by it.
- **First candidate:** sell fraction 0.125 (a quarter of today's 0.5). A first guess from the stored depth-7 medians (the per-visit bag value is not stored, so S cannot be projected directly): (0.42 - 0.233) / (0.978 - 0.233) = 0.25 of today's fraction (visits give 0.144). The 33-50% band brackets roughly 0.065 to 0.18. It is likely a little high (shares are capped at 100%, so the stored with-bag median understates the bag). Suggested first block: 0.10, 0.125, 0.15, 0.20.
- **Stop rule:** the first candidate whose 1,000-seed readout puts the depth-7 median in 33-50% (gold plus bag, arrival sample) and meets the shape is locked. A block of up to 10 evaluations that does not close the gap by 10% or more, or a pattern showing S cannot reach the band, returns to the orchestrator.

Two things 92-03 should check and report (also written into the Ruling):
1. Early floors: S lowers the with-bag share on every floor. Floors 1-4 are unchanged on gold alone by construction, but the with-bag share falls (floor 4 arrivals: 49% today, roughly 18% at 0.125). "About unchanged" is read as: gold-held shares identical and no floor 1-4 with-bag share above today's. If the user wants early-floor selling kept as it is, S needs a depth shape, which is a decision for the user.
2. Floors 8-12: on gold alone the arrival median is already 32% at floor 8, 34% at 9, 46% at 10, 67% at 11, 75% at 12 (n = 141, 77, 39, 14, 8). A sell fraction alone cannot hold floors 10-12 at or under depth 7's share; that tail is income, not sales. Report it with its n and take any lever for it to the user.

The `tune-economy` `--dials` flag can evaluate S only once the dial exists in `engine/difficulty.js`; the readout's bag value is computed with `sellPriceFor`, so a dial change shows up in it directly.

## Deviations from Plan

**1. [Rule 1 - Bug in the plan's own constraints] `meta.workers` omitted from the stored JSON.** The plan lists `workers` in `meta` and also requires `--workers=N` output byte-identical to `--workers=1`; both cannot hold. Worker count and elapsed time go to stderr only. Commit 3995a6e3.

**2. [Rule 2 - test aid] `--rows` flag added.** It prints a per-run `{seed, deathDepth, actions}` list so the test can prove the arrival pricing never touches a run. Not in the stored JSON.

**3. Recommended lever.** The plan's rule (one source over half the income, recommend trimming it) gave G (chests are 70% of income to depth 7); the projection showed G cannot reach the band (zero loot leaves the with-bag median at 72% / 75%), so P was recommended. The user then chose S, a lever outside the plan's list; recorded above.

**4. Projection grids start at identity** (multipliers from 1 up, income and cap factors from 1 down), so the gold-alone basis, where the depth-7 median is already under 42%, is not bracketed. The readout was not re-run to extend them (standing one-run rule).

## Known Stubs

None.

## Threat Flags

None (tools, tests and docs only).

## Human verification (deferred to end of run)

1. None on the device for this plan (a readout). The user's ruling was taken at the checkpoint. At milestone close, skim `docs/ECONOMY-READOUT.md` (`## Reading` and `## Ruling`): the depth-7 numbers should match what you saw in play, and the S ruling should read as you meant it.

## Self-Check: PASSED

Verified present: `tools/lib/economy-readout.mjs`, `tools/tune-economy.mjs`, `test/unit/economy-readout.test.js`, `test/unit/economy-readout-ledger.test.js`, `docs/ECONOMY-READOUT.md` (7 H2s, Status `target confirmed 2026-10-01`, one `**Lever:**` line), `docs/economy/econ-before-1000.json` (seeds 1000, 12 depth rows), `tools/readouts/92-econ-before-1000.txt` (ends with `Bot:`); commits 3995a6e3, 466a16cb, 64761ebb on master; `node --test test/unit/economy-readout.test.js test/unit/economy-readout-ledger.test.js` 19 / 19; `git diff --stat -- engine content src mazeworld.html test/parity` prints nothing; STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
