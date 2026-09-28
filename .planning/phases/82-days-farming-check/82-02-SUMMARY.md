---
phase: 82-days-farming-check
plan: 02
subsystem: testing
tags: [days-farm, bot-measurement, leaderboard-ranking, tuning-bot]

# Dependency graph
requires:
  - phase: 82-01
    provides: "tools/days-farm.mjs CLI, tools/lib/days-farm.mjs (farmer policy, farmVerdict, DAYS_RULES), playRun's opt-in policy/stopWhen hooks"
provides:
  - "docs/days-farming/days-farm.json: the one 200-seed measurement report (honest baseline + noStairs/hoarder on farm floors 1 and 2)"
  - "docs/DAYS-FARMING.md: the ledger — method, commands, results, the mechanically-applied verdict, and the DAYS rule Phase 83/84 consume"
  - "test/unit/days-farming-ledger.test.js: structure + provenance guard tying the ledger to the stored report"
  - "The fired DAYS rule: perFloorCap — daysKey = min(day, 10 * floor), desc, ties by floor desc; displayed value stays the true day"
affects: [83-server (SRV-03 consumes the perFloorCap rankKey), 84-panel (BOARD-20/26 consume the ruleLine/voiceLine)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot measurement ledger pattern (docs/DIFFICULTY-RETUNE.md, docs/RATIONS.md precedent): a committed JSON report + a markdown ledger pasting the tool's own verbatim output, with a structure/provenance-only node:test guard (no bot replay in npm test)"

key-files:
  created:
    - docs/days-farming/days-farm.json
    - docs/DAYS-FARMING.md
    - test/unit/days-farming-ledger.test.js
  modified: []

key-decisions:
  - "The verdict was applied mechanically by farmVerdict (fixed in 82-01, before this measurement ran): floor 1 wins (hoarder p90=73 >= honest p99=17, 32 cap hits) AND floor 2 wins (noStairs p90=28 >= 17, 12 cap hits), so the branch is perFloorCap — the stricter per-floor cap rule, not the floor2plus rule. The user can overrule this before Phase 83/84 consume it."
  - "No harness-defect path was taken: the run's one leftFloor row (seed 277166, floor 1, day 9) has boxedIn=1 (not 0, the documented defect signature), zero unboundedFrozenClock across all 4 variant/floor groups (22 unbounded rows total, all clockMoving=true), and no crash. tools/ is untouched — git status --porcelain tools was empty at commit time."

requirements-completed: [FARM-01, FARM-02]

coverage:
  - id: D1
    description: "One 200-seed invocation measured the honest fair bot and both farmer variants (noStairs, hoarder) on farm floors 1 and 2 in the same run; the full report is committed"
    requirement: FARM-01
    verification:
      - kind: other
        ref: "node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json (1050.3s elapsed, 1000 runs, exit 0)"
        status: pass
      - kind: unit
        ref: "test/unit/days-farming-ledger.test.js#meta shape / row counts"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/DAYS-FARMING.md shows honest DAYS p50/p90/p99/max (floor-1 deaths separate) next to each farmer variant on floor 1 and floor 2, with cap hits, leftFloor, notReached and starvation share — the tables are the tool's own verbatim output"
    requirement: FARM-01
    verification:
      - kind: unit
        ref: "test/unit/days-farming-ledger.test.js#the pasted report block equals formatFarmReport(report)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The verdict (branch=perFloorCap) was applied mechanically from the pre-agreed thresholds with no mid-phase pause; the ledger quotes the rule, the firing numbers, and says the user can overrule"
    requirement: FARM-02
    verification:
      - kind: unit
        ref: "test/unit/days-farming-ledger.test.js#verdict.branch is one of the three fixed DAYS_RULES keys, and ruleLine matches"
        status: pass
    human_judgment: false
  - id: D4
    description: "The first non-blank line under '## The DAYS rule' is exactly DAYS_RULES[branch].ruleLine, followed by rankKey/filter/order/displayed-value/applies-to bullets and the voiceLine draft"
    requirement: FARM-02
    verification:
      - kind: unit
        ref: "test/unit/days-farming-ledger.test.js#exactly one '## The DAYS rule' heading, first non-blank line after it equals verdict.ruleLine"
        status: pass
    human_judgment: false
  - id: D5
    description: "A fast ledger test ties the doc to the data (rebuilt report deep-equals the stored one, pasted block equals formatFarmReport, rule line equals the verdict's); npm test runs no bot measurement"
    verification:
      - kind: unit
        ref: "node --test test/unit/days-farming-ledger.test.js (8/8 pass)"
        status: pass
      - kind: unit
        ref: "npm test (7957 passed, 0 failed, 2 pre-existing unrelated skips)"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-09-28
status: complete
---

# Phase 82 Plan 02: DAYS Farming Measurement, Verdict and the DAYS Rule Summary

**Ran the one 200-seed honest-vs-farmer measurement; both floor-1 and floor-2 farming decisively beat honest play (hoarder p90=73 days vs. honest p99=17 on floor 1; noStairs p90=28 vs. 17 on floor 2, each with double-digit cap-outs), so `farmVerdict` mechanically fired the `perFloorCap` branch — DAYS now ranks by `min(day, 10 * floor)` — recorded in `docs/DAYS-FARMING.md` for Phase 83 (SRV-03) and Phase 84 (BOARD-20/26) to consume directly.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-28T21:36:00Z
- **Completed:** 2026-09-28T22:14:00Z
- **Tasks:** 1
- **Files modified:** 3 (all created)

## Accomplishments

- Ran `node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json` once (1,000 runs: 200 honest + 800 farmer, 4 workers, 1050.3s / ~17.5 min elapsed — well inside the 15-40 min budget, no stall). The full report is committed as `docs/days-farming/days-farm.json`.
- Wrote `docs/DAYS-FARMING.md`: the question, method (both farmer variants, camp guard/breaker totals and rationale, farm-floor-2 semantics, honest baseline, caps/outcome classes, the `DAYS = state.day` engine read, the byte-identical `playRun` hook proof), commands, the tool's own verbatim results block plus a prose reading (starvation reliability, class/race longevity, food economics, every unbounded run by seed, leftFloor/notReached counts), the verdict, the single DAYS rule line, how Phase 83/84 apply it, and the engine gate.
- Applied the pre-agreed verdict mechanically via `farmVerdict` (fixed in code in plan 82-01, before this measurement ran): **both floors won**, so the branch is `perFloorCap` — DAYS ranks by `daysKey = min(day, 10 * floor)` desc, ties by floor desc; the board still displays the true day.
- Wrote `test/unit/days-farming-ledger.test.js` (8 tests): meta shape, row counts, a full `buildFarmReport` rebuild-and-deep-equal against the stored report (proving nothing was hand-edited), verdict/ruleLine provenance, the exact `## The DAYS rule` placement, the pasted-block-equals-`formatFarmReport` guard, the measurement command's presence, and heading order.
- Confirmed no harness defect: the run's single `leftFloor` row has `boxedIn: 1` (the sane "genuinely boxed in" case, not the documented `boxedIn: 0` defect signature), zero `unboundedFrozenClock` across all 22 unbounded rows (every one kept the 100-square day clock moving, `clockMoving: true`), and no crash — so the harness-defect path in the plan was never taken and `tools/` stayed untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the 200-seed measurement once, write docs/DAYS-FARMING.md with the verdict and the DAYS rule, and guard it with a ledger test** - `e5c0ba97` (docs)

_Note: single-task plan, single commit — the measurement itself produces no separate commit (it is not a code change, just a run whose output is the JSON artifact committed alongside the doc and test)._

## Files Created/Modified

- `docs/days-farming/days-farm.json` - the full 200-seed report: `meta` (seeds=200, farmFloors=[1,2], caps={maxActions:20000, maxDays:500}, commit=e3539326), `honest.summary`/`honest.rows` (200), `farm["1"|"2"].noStairs|hoarder.summary`/`.rows` (200 each), `verdict` (branch=`perFloorCap`)
- `docs/DAYS-FARMING.md` - the ledger: `## The question`, `## Method`, `## Commands`, `## Results` (verbatim `formatFarmReport` block between markers + prose reading), `## Verdict`, `## The DAYS rule`, `## For Phase 83 and Phase 84`, `## Engine gate`
- `test/unit/days-farming-ledger.test.js` - 8 node:test cases asserting structure and provenance only (no bot replay): meta shape, row counts, rebuild-deep-equal, verdict/ruleLine, rule-heading placement, pasted-block equality, command presence, heading order

## Key numbers (for quick reference)

- **Honest baseline:** 200 runs, 188 completed / 12 stuck. DAYS at death: p50=7, p90=13, **p99=17**, max=18. Floor-1 deaths only: n=4, p50=2, max=10.
- **Farm floor 1** (stronger variant: **hoarder**): counted=199 (183 dead, 16 unbounded), leftFloor=1, notReached=0. DAYS: p50=25, **p90=73**, p99=206, max=206. 32 total cap hits (16 noStairs + 16 hoarder). Starvation causes 80.3-80.9% of deaths (median ~23-24 days among starved, max 111).
- **Farm floor 2** (stronger variant: **noStairs**): counted=196 (190 dead, 6 unbounded), leftFloor=0, notReached=4. DAYS: p50=12, **p90=28**, p99=207, max=214. 12 total cap hits. Combat (not starvation) is the dominant death cause here (99-100/190 vs. 87-88/190 starve).
- **Verdict:** floor 1 wins (73 >= 17, reason "both"); floor 2 also wins (28 >= 17, reason "both") → **branch = `perFloorCap`**, fired mechanically, no mid-phase pause.
- **The DAYS rule:** "DAYS ranks every run by daysKey = min(day, 10 \* floor) (desc), ties by floor (desc); the board still displays the true day." Applies to SRV-03, BOARD-20, BOARD-26. Picker/rule voice-line draft (Phase 84 owns final copy): "Only ten days a floor count. The rest is loitering."
- **Wall time of the run:** 1050.3s (~17.5 minutes), 1000 total runs, 4 workers, no stall, no rerun.
- **Harness-defect path:** NOT taken. The run's single leftFloor row (seed 277166) has `boxedIn: 1`, and zero of the 22 unbounded rows have `clockMoving: false`.

**The verdict was applied mechanically from the pre-agreed thresholds (82-CONTEXT.md), with no mid-phase user pause. The user can overrule this verdict; FARM-02's record is this ledger plus this SUMMARY.**

## Decisions Made

- `farmVerdict` fired `perFloorCap` because **both** floors won outright (not the ambiguous "floor 2 wins while floor 1 does not" corner case 82-01's planner had to interpret) — `perFloorCap` is simply the correct, unambiguous branch whenever floor 2 wins, so no interpretive judgment was needed at measurement time.
- No rerun was performed — the single 200-seed invocation completed cleanly on the first attempt (no stall, no crash, no harness defect), consistent with the plan's "do not rerun to chase a verdict" instruction.

## Deviations from Plan

None - plan executed exactly as written. The harness-defect path (fixing `tools/lib/days-farm.mjs`, adding a regression test, committing separately, rerunning) was available but not triggered — the measured run showed no `boxedIn: 0` leftFloor row, no `unboundedFrozenClock > 0`, and no crash. All acceptance criteria in the plan passed as specified (structural JSON check, `--from` render exit 0 with "### Verdict" present, single `## The DAYS rule` heading, single pair of report markers, ledger test green, `npm test` green, engine-gate diff empty, `tools/` untouched at commit time).

## Issues Encountered

None. The background measurement ran to completion in 1050.3s without any progress stall (a new line landed every ~15-30s throughout, well under the plan's 15-minute stall threshold).

## Human verification (deferred to end of run)

None — this phase's verification is entirely mechanical (the ledger test + `npm test`) per the Deferred UAT protocol; no device/UAT checklist items were generated by this plan.

## User Setup Required

None - no external service configuration required. `docs/days-farming/days-farm.json` and `docs/DAYS-FARMING.md` are dev-only measurement artifacts; `tools/` is never copied into `www/` (`build-www.mjs`).

## Next Phase Readiness

- Phase 82 (DAYS Farming Check) is complete: both FARM-01 and FARM-02 are satisfied, the measurement report and ledger are committed, and the DAYS rule (`perFloorCap`: `daysKey = min(day, 10 * floor)`) is recorded for Phase 83's SRV-03 (server DAYS query filter/rank key) and Phase 84's BOARD-20 (DAYS picker copy) and BOARD-26 (YOUR DEAD) to apply directly.
- No blockers. `git diff --name-only 1284b0bd -- engine content test/parity` is empty (and `f9175525`, the run_notes' own baseline, is also empty). `npm test` is green (7957 passed, 0 failed, 2 pre-existing unrelated skips, unchanged from 82-01's baseline).
- The client-side implication for Phase 83/84: run documents must carry a `daysKey = min(day, 10 * floor)` field at submit time (SRV-02's write rules should check it equals the formula); DAYS queries order by `daysKey desc, floor desc`; the board displays the true `day`, never `daysKey`.

---
*Phase: 82-days-farming-check*
*Completed: 2026-09-28*

## Self-Check: PASSED

All four created/written files found on disk (`docs/days-farming/days-farm.json`, `docs/DAYS-FARMING.md`, `test/unit/days-farming-ledger.test.js`, this SUMMARY); the task commit hash (`e5c0ba97`) found in git log.
