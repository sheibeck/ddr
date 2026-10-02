---
phase: 92-store-economy-balance-close
plan: 04
subsystem: balance-bot-pass
tags: [TUNE-10, fair-bot, watch-list, drift, tune-difficulty, tune-classes]
requires:
  - phase: 92-01
    provides: the bot fixes the pass measures on (camp gate, regen cloak, member items, Cutpurse)
  - phase: 92-03
    provides: the economy lock on master (SELL_FRACTION), the finished rules
provides:
  - tools/lib/watch-readout.mjs and the Watch list block in tune-difficulty (report only)
  - the one milestone fair-bot pass on the finished rules, on disk (tools/readouts/92-final-*)
  - the Phase 92 ledger sections, the drift list (D1, D2) and the pending ruling
affects: [92-05]
tech-stack:
  added: []
  patterns: [a report-only readout block fed by the same onStep hook as the parley tally, a ledger block pasted verbatim and proven with readout-compare, every table built by a scratch script from files on disk]
key-files:
  created:
    - tools/lib/watch-readout.mjs
    - test/unit/watch-readout.test.js
    - tools/readouts/92-final-1000.txt
    - tools/readouts/92-final-classes.json
    - tools/readouts/92-final-classes.txt
    - tools/readouts/92-final-tail.jsonl
    - tools/readouts/92-final-tail.txt
    - tools/readouts/92-final-party-200.txt
  modified:
    - tools/tune-difficulty.mjs
    - test/unit/band-readout.test.js
    - docs/DIFFICULTY-RETUNE.md
key-decisions:
  - "No engine, content or bot-policy byte changed: the runs measure commit 10fec3c3 and `git diff --stat 10fec3c3 -- engine content tools/lib/tuning-bot.mjs` is empty after the last run"
  - "The drift checkpoint was not stopped at (orchestrator instruction): the pass records D1 and D2 with options and a recommended default (A, accept and record) and the ruling section reads Pending"
requirements-completed: []
duration: about 1 hour 35 minutes
completed: 2026-10-01
status: complete
---

# Phase 92 Plan 04: The TUNE-10 fair-bot pass Summary

**One fair-bot pass on the finished v2.3 rules: the median death depth is 5 against the ruled floor 3-4 (one floor easier than the band; the 79.1 FINAL read 4), floors 3 to 6 are outside the Phase 79.2 tolerance, starvation is unchanged at 10.6% of deaths, every ruled tail target passes, and the watch list is clean. Two drift items (D1, D2) are recorded with options; no dial was touched.**

## What was built

- **Task 1 (commit 10fec3c3, then 0cd5ea9e):** `tools/lib/watch-readout.mjs` (`makeWatchTally`, `tallyWatch`, `watchReadout`, `formatWatchReadout`; pure, report only), wired into `tools/tune-difficulty.mjs` after the class identity block and before `Outcome:` and as `watch` in `--json`; `test/unit/watch-readout.test.js` (6 tests) and a source-shape assertion in `test/unit/band-readout.test.js` (41 of 41 pass with the ledger test). The tuning-bot import line is unchanged. Then the four runs on that committed tree, one at a time in the background.
- **Task 2 (commit a30b50b0):** the Phase 92 H2 gains what this measures, parameters and refs, the FINAL block (verbatim, proven by `readout-compare --recorded`), the floors 1-12 rows, starvation, classes and watch list, the tail, the drift list and the reading; `## v1.2 retune (Phase 27)` is still the last H2; the ledger test passes (13 of 13).
- **Task 3 (the checkpoint):** not stopped at, by the orchestrator's instruction. The drift is recorded in the ledger and below with options and a recommendation.
- **Task 4:** the ruling section reads `Pending` with the recommended default per item (see Ruling for 92-05).

## The runs (measured commit 10fec3c3)

| Run | Command | Elapsed |
| --- | --- | --- |
| R1 natural | `tune-difficulty --seeds=1000` | 738 s |
| R2 classes | `tune-classes --seeds 10 --workers 3` (143 cells, 1,430 runs) | 360 s |
| R3 tail | `fit-difficulty --objective=tail --fresh=gate --dials='{}' --workers=4` | 356 s |
| R4 Joiners | `tune-difficulty --seeds=200 --party` | 185 s |

## Headline numbers (79.1 FINAL beside Phase 92)

- **p50 death depth 5** against [3, 4] (79.1: 4); mean 4.97 (4.49); p90 8 (7). 994 dead, 6 stuck (938 dead, 62 stuck at 79.1). Deaths through floor 4: 443 of 994 (44.6%); 54 more would flip the median to 4.
- **Floors 1-12 (S_L, dS):** floor 3 69.9 (+11.5) MISS (PASS at 79.1), floor 4 55.7 (+17.0) MISS, floor 5 37.8 (+13.5) MISS, floor 6 24.2 (+9.1) MISS (PASS at 79.1); floors 1, 2, 7 to 12 PASS. The Filter shape is ok. Per-floor survival on floors 2 to 6 is 2 to 5 points above the 79.1 FINAL.
- **Starvation:** 105 of 994 deaths = 10.6% (79.1: 86 of 938 = 9.2%), +1.4 points, ratio 1.15. Class matrix: 145 of 1,424 (10.2%) against 128 of 1,358 (9.4%). campFailed per run 0; rations bought per run 0.38. Troll (19.1%) and Thief (16.3%) carry it, as before.
- **Classes (natural run, p50 / reach5):** Fighter 5 / 56.0, Thief 6 / 71.8, Magic User 4 / 36.1 (exempt); pooled 5 / 56.0; the class constraint is ok. Class matrix pooled p50 5, mean 4.74 (4.38).
- **Tail:** every ruled target PASS (score 0): fresh reach-20 0%, reach-21 0%, none reach 30; deep12 reach20 0%; deep20 p50 gained 0, reach30 0%; deep30 p50 / p90 gained 0 / 1; rot20 and rot30 not above fair.
- **Watch list:** Illusionist natural p50 4 (Magic User pool 4, pooled 5; class matrix 3, the lowest sub-class), Door Illusion ends the fight about 89% of casts (1.32 escapes against 0.16 see-throughs per run), flees 2.53 per run; Cleric p50 4, 9.11 swings and 0.53 heals per fight; Fridgian frenzy 0.51 per strike action (ruled 0.50), race p50 6; the 91.1 cooldown abilities second-use per fight Kata 0.34, Feint 0.25, Overhead Blow 0.38, Last Stand 0.24, Second Wind 0.26 (Hamstring and Mark 0, by the rule); Joiners in 264 of 1,000 natural runs, parley share of SP 3.8% (79.1: 2.3%); R4 (Joiner from the start) p50 5, floors 2 to 5 clearly easier, 2 stuck of 200.

## Drift list

| Item | Verdict | Numbers |
| --- | --- | --- |
| D1 median death depth | **drift** (game, +1 floor) | p50 5 against [3, 4] |
| D2 floors 1-12 rows | **drift** (game) | floors 3 and 6 newly MISS, floors 4 and 5 grew (dS +17.0, +13.5) |
| D3 starvation share | no drift | +1.4 points, ratio 1.15 |
| D4 Fighter / Thief vs pooled | no drift | 5 and 6 against 5 |
| D5 watch items | no drift (noted only) | none out of line |
| D6 tail targets | no drift | all PASS |
| D7 stuck runs | no drift | 0.6% |

### D1 and D2 in plain words, with options

D1 and D2 are one finding: the early curve is about a floor easier than the ruled band, in the same way on every floor from 2 to 6. Likely cause (not separable, one pass over everything together): v2.3 added early hero power (Joiner hp and armour, heal over time, the 91.1 abilities coming back, the Cleric's melee-and-heal, Door Illusion, Pommel Strike as a real strike) and the stuck population shrank from 62 to 6 so more runs count as deaths. The Phase 79.2 lock itself read 5; the 79.1 FINAL read 4 after quick fixes that landed after it. By the ruling's rule of thumb a bot at 5 is a human at about floor 7 to 9 (an extrapolation, not a measurement).

- **(A) Accept and record. Recommended.** Nothing changes; the game is where the 79.2 lock the user accepted left it, the Filter shape is ok, the tail passes everything, and a retune now moves fixtures the milestone just locked.
- **(B) Dial refit** by the checkpointed fit (the 79.2 curve and the [3, 4] band, class constraint with the Magic User exempt, SEARCH_PLAN coordinates, blocks of 10 at 200 seeds, best confirmed at 1,000). Needs about 3 points less survival on each of floors 2 to 4. Moves fixtures; the 79.2 fit could not close floors 4 and 5.
- **(C) A named rule change,** for example `FOE_COUNT_DEPTH.soloOnlyOnOneFrom` 5 to 4 (the open 79.2 question), which hardens floors 4 and 5 directly.
- **(D) A bot-only fix:** not recommended; this is a game measurement.

## Ruling for 92-05

Pending: the checkpoint was not put to the user in this run (the orchestrator said not to stop). The ledger's `### Phase 92 — ruling` carries `D1` and `D2` lines at the recommended default (A, accept and record). If the user accepts the default, 92-05 builds nothing for the drift. If the user rules B, **expect a 79.2-04-sized fixture re-declaration** (the fit moves hero-side and several foe dials together; the 79.2 lock re-declared 38 parity records), so the orchestrator should split 92-05 before dispatching it. A ruling of C moves fixtures too and is the user's named change.

## Deviations from Plan

**1. [Orchestrator instruction] The drift checkpoint (Task 3) was not stopped at.** The coordinator ruled mid-run to complete all runs and the whole plan and to record the drift with options and a recommendation instead. Task 4's "the user's words" therefore does not exist: the ruling section says `Pending` and carries the recommended defaults; it is the user's to confirm or replace before 92-05 builds. No ruling was invented.

**2. [Rule 1 - Bug] Fridgian frenzy rate denominator.** The first cut divided frenzies by `attack` actions, which gave 0.77 (strike abilities also roll the frenzy check). The tally now counts steps with a hero strike event (`struck`, `strikeMissed` or `frenzy`), the one frenzy check per strike action, and reads 0.51 against the ruled 0.50. Fixed in Task 1 before the commit; the test covers it.

**3. [Process] No sequence 6 retune and no dial change.** Per the instruction; the pass is report only.

No auth gates. No fix attempts exhausted.

## Known Stubs

None.

## Threat Flags

None (a report-only tally and ledger text; no endpoint, auth path or serialized field).

## Human verification (deferred to end of run)

1. Over your next few runs on the debug APK, note where they end: the fair bot's floor 5 (median) reads, by the ruling's rule of thumb, as about floor 7 to 9 for you, a floor or two later than the 5-7 the original ruling expected. Flag a run that ends far earlier or later than that, with the class and race.
2. Starvation: note whether you ever run short of rations with the store's d10 supply. The bot buys few (0.38 per run) and starves in 10.6% of deaths, mostly the Troll and the Thief.
3. If you play an Illusionist: does Door Illusion feel like a free escape (it ended the fight about 9 casts in 10 for the bot) and does the class feel strong or weak against the other Magic Users? (The bot has it at the bottom.)

## Self-Check: PASSED

Files found: tools/lib/watch-readout.mjs, test/unit/watch-readout.test.js, tools/readouts/92-final-1000.txt, 92-final-classes.json, 92-final-classes.txt, 92-final-tail.jsonl, 92-final-tail.txt, 92-final-party-200.txt, docs/DIFFICULTY-RETUNE.md (Phase 92 sections). Commits found: 10fec3c3, 0cd5ea9e, a30b50b0. `grep -c "^Outcome:" tools/readouts/92-final-1000.txt` prints 1; classes JSON meta.seeds is 10; `readout-compare --recorded` exits 0; the targeted tests pass (41 of 41); `git diff --stat 10fec3c3 -- engine content tools/lib/tuning-bot.mjs` is empty.
