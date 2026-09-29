---
phase: 82-days-farming-check
plan: 01
subsystem: testing
tags: [tuning-bot, worker-threads, node-test, cli, farming-exploit]

# Dependency graph
requires: []
provides:
  - "tools/lib/tuning-bot.mjs#playRun's opt-in opts.policy/opts.stopWhen hooks (undefined by default, byte-identical to every existing caller)"
  - "tools/lib/days-farm.mjs: the farmer policy (noStairs/hoarder), run classification, summaries, farmVerdict and the three fixed DAYS_RULES"
  - "tools/days-farm.mjs: the worker_threads CLI that plays and reports a full honest-vs-farmer measurement"
affects: [82-02 (runs the CLI at 200 seeds and records the verdict), 83-server (SRV-03 consumes the DAYS_RULES rankKey), 84-panel (BOARD-20/26 consume the ruleLine/voiceLine)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "playRun's policy/stopWhen hooks: an opt-in seam on a shared bot loop, resolved once before the loop, proven inert-by-default via a before/after cmp of an existing readout plus the untouched Phase 73 state pins"
    - "Work distributed BY RUN (not by cell) through a worker_threads queue, re-assembled by a fixed units-array order (never completion order) for scheduling-independent output"

key-files:
  created:
    - tools/lib/days-farm.mjs
    - tools/days-farm.mjs
    - test/unit/days-farm.test.js
  modified:
    - tools/lib/tuning-bot.mjs

key-decisions:
  - "The camp-guard precondition test is pinned to seed 1 (Fridgian Fighter) for the hand-built unit test, and to the real-run regression at seed 55434 (the planner's own probe seed) — both verified live before pinning."
  - "farmVerdict's corner case (floor 2 wins while floor 1 does not) is read as perFloorCap, per the plan's own documented JSDoc reasoning — the user can overrule this before plan 82-02 records the final verdict."

requirements-completed: [FARM-01, FARM-02]

coverage:
  - id: D1
    description: "playRun accepts opts.policy and opts.stopWhen, both undefined by default; every existing bot readout and the Phase 73 state pins stay byte-identical"
    requirement: FARM-01
    verification:
      - kind: unit
        ref: "test/unit/days-farm.test.js#playRun hooks"
        status: pass
      - kind: unit
        ref: "test/unit/roll-high-state-pins.test.js"
        status: pass
      - kind: other
        ref: "cmp of tune-difficulty --seeds=20 --json before/after the edit (recorded below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The noStairs/hoarder farmer policy, run classification (dead/unbounded/leftFloor/notReached), summaries and the mechanical farmVerdict over the three fixed DAYS_RULES"
    requirement: FARM-02
    verification:
      - kind: unit
        ref: "test/unit/days-farm.test.js#Task 2: farmDir / hoarderStorePick / makeFarmerPolicy / playFarmRun / summarizeHonest / summarizeFarm / farmVerdict / DAYS_RULES / formatFarmReport-buildFarmReport"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/days-farm.mjs CLI: worker-threaded honest+farmer measurement across floors 1/2, JSON/markdown report, --from re-render, scheduling-independent output"
    requirement: FARM-01
    verification:
      - kind: other
        ref: "node tools/days-farm.mjs --seeds=4 --max-actions=2000 --json --out=<scratchpad>/df-smoke.json (smoke, recorded below)"
        status: pass
      - kind: other
        ref: "node tools/days-farm.mjs --seeds=8 --farm-floor=1 --max-actions=1000 --json cross-checked against tune-difficulty --seeds=8 --json's deathDepth"
        status: pass
      - kind: other
        ref: "cmp of --workers=1 vs --workers=4 stdout at --seeds=4 --farm-floor=1 --max-actions=1500"
        status: pass
      - kind: unit
        ref: "npm test (full suite)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-28
status: complete
---

# Phase 82 Plan 01: DAYS Farming Instrument Summary

**Built the DAYS-farming measurement tool (playRun's opt-in policy/stopWhen hooks, the noStairs/hoarder farmer policy, run classification, summaries, the mechanical farmVerdict, and the DAYS_RULES verdict fixed in code with tests) and the worker-threaded `tools/days-farm.mjs` CLI, with zero engine/content/parity bytes touched and every existing bot readout byte-identical.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-28T21:23:23Z
- **Completed:** 2026-09-28T21:48:01Z
- **Tasks:** 3
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- `tools/lib/tuning-bot.mjs#playRun` gained two opt-in hooks (`opts.policy`, `opts.stopWhen`), both `undefined` by default, so every existing caller (`tune-difficulty`, `tune-economy`, `tune-classes`, `fit-difficulty`, the Phase 73 state pins) plays exactly the same unchanged loop.
- `tools/lib/days-farm.mjs`: the farmer policy wraps `decideAction` (never forks it) in two variants — `noStairs` (never takes the stairs, keeps walking once the floor is cleared) and `hoarder` (also spends every gold piece on rations at every store). A camp guard fixes the probe's seed-55434 stall (the fair bot's own camp gate reads only the hero's own appetite; `makeCamp` refuses on the party's real `nightlyEats`). Run classification (`dead`/`unbounded`/`leftFloor`/`notReached`), summaries, and `farmVerdict` apply the pre-agreed mechanical thresholds (stronger p90 ≥ honest p99, or any cap hit) against three DAYS_RULES fixed in code before any measurement runs: `mock`, `floor2plus`, `perFloorCap`.
- `tools/days-farm.mjs`: a worker_threads CLI (`--seeds`, `--farm-floor=1|2|1,2`, `--json`, `--workers`, `--out`, `--from`, `--max-actions`, `--max-days`) that plays the honest baseline and both farmer variants on each requested farm floor, in one invocation, and prints a deterministic JSON or markdown report.
- Proof of "byte-identical everywhere": `node tools/tune-difficulty.mjs --seeds=20 --json` before/after the `playRun` edit is byte-for-byte identical (`cmp` exit 0), and `test/unit/roll-high-state-pins.test.js` (the Phase 73 bot-sweep state-hash pins) passes unchanged with zero file diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: Opt-in policy and stopWhen hooks on playRun, proven inert by default** - `2b586fec` (feat)
2. **Task 2: The farmer policy, run classification, summaries and the mechanical verdict** - `7bcd9f24` (feat)
3. **Task 3: tools/days-farm.mjs CLI with worker threads, smoke-tested and cross-checked against tune-difficulty** - `bd5e774d` (feat)

**Plan metadata:** (this commit) - `docs(82-01): complete DAYS farming instrument plan`

_Note: all three tasks were `type="auto" tdd="true"`/`type="auto"` single-commit tasks — no separate RED/GREEN/REFACTOR commits were required by the plan._

## Files Created/Modified

- `tools/lib/tuning-bot.mjs` - added `opts.policy`/`opts.stopWhen` opt-in hooks to `playRun`, plus a "Phase 82 (FARM-01)" JSDoc paragraph; no other export touched
- `test/unit/days-farm.test.js` - new file: "playRun hooks" group (Task 1) plus the full Task 2 behavior-bullet coverage (farmDir, hoarderStorePick, makeFarmerPolicy, playFarmRun, playHonestRun, summarizeHonest, summarizeFarm, farmVerdict, DAYS_RULES, buildFarmReport/formatFarmReport, module constants) — small caps only, no full-cap bot run
- `tools/lib/days-farm.mjs` - new file: FARM_CAPS/FARM_VARIANTS/CLOCK_WINDOW/BREAKER_LIMIT/DAYS_RULES, isStairsCell, farmDir, hoarderStorePick, makeFarmerPolicy, playHonestRun, playFarmRun, summarizeHonest, summarizeFarm, farmVerdict, buildFarmReport, formatFarmReport
- `tools/days-farm.mjs` - new file: the dev-only worker_threads CLI

## Byte-Identical Proof (Task 1)

```
node tools/tune-difficulty.mjs --seeds=20 --json > <scratchpad>/td-before.json   (before the playRun edit)
node tools/tune-difficulty.mjs --seeds=20 --json > <scratchpad>/td-after.json    (after the playRun edit)
cmp <scratchpad>/td-before.json <scratchpad>/td-after.json                      -> exit 0 (no output, identical)
node --test test/unit/roll-high-state-pins.test.js                              -> 9/9 pass
git diff --quiet HEAD -- test/unit/roll-high-state-pins.test.js test/unit/harness/rollHighBaseline.js  -> exit 0 (zero diff)
```

## Smoke Timings

Single-run timings (measured directly, `tools/lib/days-farm.mjs` functions called inline, one core):

- `playHonestRun(1)` — 594 actions, dead (starve/etc.), **~0.7 s**
- `playFarmRun(1, {variant:"noStairs", farmFloor:1, maxActions:2000})` — capped at 2000 actions (unbounded), **~2.9 s** (~1.5 ms/action)
- `playFarmRun(31677, {variant:"noStairs", farmFloor:1, maxActions:20000})` — the planner's own probe seed, capped at the full 20,000 actions (unbounded), **~26.5 s** — matches the planner's probe note ("about 26 s") almost exactly

CLI smoke run (`--seeds=4 --max-actions=2000 --json --out=<scratchpad>/df-smoke.json`, 4 workers, 20 total units — 4 honest + 2 floors × 2 variants × 4 seeds): **11.7 s elapsed**, `verdict.branch` = `"perFloorCap"` for this tiny/low-cap sample (not a real measurement — plan 82-02 owns the 200-seed run).

## Camp-Guard Regression Seed

Pinned at seed **55434** (`seedList` index 7, `i*7919+1`) — the planner's own probe seed, a solo start that recruits a Joiner whose extra appetite the fair bot's own camp gate (hero-only `eats`) does not account for. Measured with `playFarmRun(55434, {variant:"noStairs", farmFloor:1, maxActions:1500})`: `campGuard: 200`, `campFailed: 0`, `outcome: "dead"` (starved on day 10 after `campGuard` kept forcing moves instead of a refused camp).

## Decisions Made

- The unit hand-built camp-guard precondition test (`makeFarmerPolicy`) is pinned to seed 1 (a Fridgian Fighter) — the first `seedList(60)` entry, verified live, whose `decideAction` returns `{type:"camp"}` once `c.rations` is set to exactly the hero's own appetite (`eatsFor`) with `wp` under `campThreshold` and no potions.
- `farmVerdict`'s JSDoc states the planner's reading of the plan's own documented open corner case: a floor-2 win while floor 1 does not win maps to `"perFloorCap"` (the only one of the three rules that actually stops floor-2 farming) — the user can overrule this before plan 82-02 records the final verdict.
- `hoarderStorePick` has no `GOLD_RESERVE` (unlike `chooseStorePurchase`'s own store policy) — the hoarder variant deliberately spends every gold piece on rations, per 82-CONTEXT.md.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<behavior>` bullets are covered by tests, and every `<acceptance_criteria>` check in the plan passed as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This is dev-only tooling; `tools/` is never copied into `www/` (build-www.mjs).

## Next Phase Readiness

- The instrument is ready for plan 82-02, which runs `node tools/days-farm.mjs --seeds=200 --farm-floor=1,2 --json --out=docs/days-farming/days-farm.json` once, records the verdict, and writes `docs/DAYS-FARMING.md`.
- No blockers. `git diff --name-only 1284b0bd -- engine content test/parity` is empty; `npm test` is green (7949 passed, 0 failed, 2 pre-existing unrelated skips in a bug-report CLI test, unaffected by this plan).

---
*Phase: 82-days-farming-check*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk; all three task commit hashes (`2b586fec`, `7bcd9f24`, `bd5e774d`) found in git log.
