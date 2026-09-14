---
phase: 22-class-aware-harness-before-matrix
plan: 03
subsystem: testing
tags: [harness, matrix, worker-threads, cli, dev-only, class-pass]

requires:
  - phase: 22-class-aware-harness-before-matrix (Plan 01)
    provides: "engine/character.js#rollCharacter / engine/state.js#newRun — the dev-only force option resolveForce ultimately feeds into"
  - phase: 22-class-aware-harness-before-matrix (Plan 02)
    provides: "tools/lib/tuning-bot.mjs#playRun(seed, opts) — opts.startDepth/opts.force pass-through, stuck/floorsGained/encountersSurvived result fields, botLine/percentile reused verbatim by class-matrix.mjs"
provides:
  - "tools/lib/class-matrix.mjs — enumerateCells/EXCLUDED_CELLS/resolveName/resolveForce/selectCells/seedList/rowFromRun/summarizeRows/rankCells/rollups/buildReport/formatText (pure, zero-dependency)"
  - "tools/tune-classes.mjs — the 143-cell matrix CLI: worker_threads-by-cell parallelism, --seeds/--workers/--max-actions/--start-depth/--explore-budget/--cls/--sub/--race/--json/--out, atomic --out write"
  - "tools/tune-difficulty.mjs — --start-depth=N (HARN-04) and the stuck bucket in both text (Outcome line, header) and --json (deathDepth/causes computed over completed runs only)"
  - "test/unit/class-matrix.test.js — 11 tests pinning enumeration/exclusion/resolution/seeds/aggregation/tie-break/roll-ups/report/force-smoke/purity"
affects: [22-04]

tech-stack:
  added: []
  patterns:
    - "worker_threads same-file worker (isMainThread branch) with a main-thread by-cell queue — no engine state ever crosses a thread boundary, only { idx, cell, rows } plain-object messages"
    - "write-to-temp-then-rename for --out (never a partial docs/class-pass/*.json snapshot)"
    - "pure aggregation module (class-matrix.mjs) with zero I/O, consumed identically by the main thread's inline path and every worker's playCell call"

key-files:
  created:
    - tools/lib/class-matrix.mjs
    - tools/tune-classes.mjs
    - test/unit/class-matrix.test.js
  modified:
    - tools/tune-difficulty.mjs

key-decisions:
  - "resolveForce (CLI-facing) lives in class-matrix.mjs, separate from engine/character.js's normalizeForce — it does the case-insensitive name resolution and the Fridgian+Samurai refusal BEFORE any newRun call, so the harness never has to rely on the engine's own rejection path for a friendly CLI error"
  - "Work is distributed BY CELL through a main-thread queue (each worker plays a cell's whole seed list); this makes p50/p90/roll-ups true percentiles over runs and the JSON output scheduling-independent — confirmed byte-identical cells/rollups under --workers 1 vs --workers 4 on a --race Troll --seeds 2 (24-cell) run"
  - "A single-cell run (or --workers 1) plays inline via the same playCell function a worker uses, skipping worker_threads startup cost entirely"
  - "JSON report carries NO timing field anywhere (meta or per-cell) — elapsed time is printed to stderr only, so a future BEFORE/AFTER diff (Plan 22-04's job) never gets polluted by wall-clock noise"
  - "tune-difficulty's death-cause percentage denominator was deliberately left as results.length (unchanged from v1.1), per the plan's 'keep every existing line's wording' instruction — only the death-depth/causes SOURCE set switched to completed runs, not the percentage math"

requirements-completed: [HARN-01, HARN-03, HARN-04]

coverage:
  - id: D1
    description: "tools/lib/class-matrix.mjs enumerates exactly 143 cells (144 combos minus the 1 canon-impossible Fridgian Samurai), resolves CLI names case-insensitively to canonical CLASSES/RACES/subs strings, and refuses Fridgian Samurai before any newRun"
    requirement: "HARN-01"
    verification:
      - kind: unit
        ref: "test/unit/class-matrix.test.js#enumerateCells: 143 canonical cells, no excluded triple, 24 subs, 6 races"
        status: pass
      - kind: unit
        ref: "test/unit/class-matrix.test.js#resolveName: case-insensitive resolution to canonical keys; throws with valid keys listed"
        status: pass
      - kind: unit
        ref: "test/unit/class-matrix.test.js#resolveForce: infers cls from sub, rejects cls/sub mismatch, rejects Fridgian Samurai, null when empty"
        status: pass
      - kind: other
        ref: "node tools/tune-classes.mjs --sub samurai --race fridgian --seeds 1 -> exit 2 with a /Fridg/i message BEFORE any newRun"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/tune-classes.mjs runs any subset of the 143 cells in parallel via worker_threads (by-cell main-thread queue), prints a ranked text matrix or --json, writes --out atomically, and produces byte-identical cells/rollups regardless of worker count"
    requirement: "HARN-03"
    verification:
      - kind: other
        ref: "node tools/tune-classes.mjs --sub Summoner --race Troll --seeds 2 --json -> 1 cell, correct cls/sub/race/seeds/maxActions/excluded"
        status: pass
      - kind: other
        ref: "node tools/tune-classes.mjs --race Troll --seeds 2 --workers 1 vs --workers 4 --json -> JSON.stringify({cells,rollups}) identical, meta.workers differs"
        status: pass
      - kind: other
        ref: "node tools/tune-classes.mjs --sub Summoner --race Troll --seeds 1 --out <tmp>/x/out.json -> exactly one out.json, no leftover .tmp, no 'elapsed' key in meta"
        status: pass
      - kind: other
        ref: "node tools/tune-classes.mjs --seeds 0 -> exit 2 with usage; --sub Paladin --seeds 1 -> exit 2 listing valid subs"
        status: pass
      - kind: other
        ref: "git diff --quiet -- package.json package-lock.json (no dependency added); grep -c 'tune-classes\\|tools/lib' tools/build-www.mjs == 0 (never shipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "--start-depth is exposed on both tools/tune-classes.mjs and tools/tune-difficulty.mjs, reusing playRun's opts.startDepth exactly; deep runs report floorsGained/encountersSurvived; stuck runs are reported honestly and separately in both tools' text and JSON output"
    requirement: "HARN-04"
    verification:
      - kind: other
        ref: "node tools/tune-classes.mjs --start-depth 20 --sub Knight --race Troll --seeds 2 --json -> meta.startDepth 20, meanFloorsGained/meanDepth consistent with a depth-20 start"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=4 --start-depth=20 --json -> bot.startDepth 20, stuck/completed counts present, deathDepth.min >= 20 or completed 0"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=4 -> Outcome line reports stuck count separately; --json causes never include maxActionsHit"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 11-test class-matrix.test.js suite pins summarizeRows' null-safety (never NaN), rankCells' documented tie-break, rollups' pooling, buildReport/formatText's no-timing/no-verdict contract, and a force pass-through smoke test through the real bot"
    verification:
      - kind: unit
        ref: "test/unit/class-matrix.test.js (11/11 passing)"
        status: pass
      - kind: unit
        ref: "npm test (989/989 passing: 978 baseline + 11 new)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-14
status: complete
---

# Phase 22 Plan 03: Class-Aware Matrix Harness (tune-classes.mjs) Summary

**Built `tools/tune-classes.mjs` — a worker_threads-parallel 143-cell class x race matrix CLI on a new pure `tools/lib/class-matrix.mjs` helper module — with `--cls/--sub/--race` force resolution, `--start-depth`, `--json`/atomic `--out`, and scheduling-independent output proven byte-identical at 1 vs 4 workers; also added `--start-depth` and an honest stuck bucket to `tools/tune-difficulty.mjs`.**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-09-14
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `tools/lib/class-matrix.mjs` — pure, zero-dependency helpers: `enumerateCells()` (143 canonical `{cls,sub,race}` triples, skipping the frozen `EXCLUDED_CELLS` Fridgian+Samurai entry), `resolveName`/`resolveForce` (case-insensitive CLI name resolution to canonical keys, cls-inferred-from-sub, Fridgian+Samurai refused with a canon-quoting message BEFORE any newRun), `selectCells`, `seedList` (the exact `i*7919+1` stride), `rowFromRun`/`summarizeRows` (stuck-aware, null-safe — never NaN), `rankCells` (meanDepth desc/p50 desc/reach5 desc/sub asc/race asc, null always last), `rollups` (by class/sub/race, key-asc tiebreak), `buildReport`/`formatText` (no timing fields, no fun-band verdict wording).
- `tools/tune-classes.mjs` — the CLI: `parseArgs` accepts both `--flag value` and `--flag=value`; numeric flags validated to finite integers (exit 2 + usage on violation); `--cls/--sub/--race` resolved through `resolveForce` inside a try/catch (exit 2 + message, no usage block, before any newRun); a main-thread by-cell `worker_threads` queue (same-file worker via the `isMainThread` branch) with `--workers 1` or a single-cell run playing inline through the identical `playCell` function; `--json`/text output; `--out PATH` written atomically (temp-then-rename) once after every worker returns; `elapsed`/`workers`/`runs` printed to stderr only.
- `tools/tune-difficulty.mjs` gained `--start-depth=N` (default 1, threaded through `playRun`'s existing `opts.startDepth`) and a stuck bucket: the Death-depth distribution and Death-cause breakdown (both text and `--json`) now compute over completed (non-stuck) runs only, while the Action-count distribution stays over all runs; the Outcome line and report header report the stuck count/start depth explicitly.
- `test/unit/class-matrix.test.js` — 11 new tests covering enumeration/exclusion, name/force resolution, seed list, null-safe stuck-aware aggregation, the documented ranking tie-break (including the null-last case), roll-up pooling, `buildReport`/`formatText`'s no-timing/no-verdict contract, an HARN-01 force pass-through smoke test through the real `playRun`, and module purity (no `Math.random`/`Date.now`/`worker_threads`/`fs`/`os` imports).
- Full `npm test`: 989/989 passing (978 baseline + 11 new). Scheduling independence verified directly: `--race Troll --seeds 2` (24 cells, 48 runs) produced byte-identical `{cells, rollups}` JSON under `--workers 1` (13.5s) and `--workers 4` (6.6s) — this pair is Plan 22-04's reference point for sizing the full 143-cell BEFORE capture's polling window.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tools/lib/class-matrix.mjs (pure matrix helpers) and its unit tests** - `b41ea7c` (feat)
2. **Task 2: Write tools/tune-classes.mjs — the worker_threads matrix CLI with --json and atomic --out** - `63f1bba` (feat)
3. **Task 3: Add --start-depth and the stuck bucket to tools/tune-difficulty.mjs** - `08b8ebd` (feat)

_No TDD gating on this plan (`tdd` not set on any task); each task is a single commit._

## Files Created/Modified

- `tools/lib/class-matrix.mjs` - new pure helper module: cell enumeration/exclusion, name/force resolution, seed list, per-run row extraction, null-safe stuck-aware aggregation, ranking, roll-ups, report/text building
- `tools/tune-classes.mjs` - new CLI: worker_threads-by-cell matrix runner with force/start-depth/json/atomic-out support
- `tools/tune-difficulty.mjs` - `--start-depth=N` and the stuck bucket added to both text and `--json` output; header/Outcome lines updated
- `test/unit/class-matrix.test.js` - new 11-test suite for `tools/lib/class-matrix.mjs`

## Decisions Made

See `key-decisions` in frontmatter — summarized: `resolveForce` is a CLI-facing seam separate from (but structurally mirroring) `engine/character.js#normalizeForce`, catching Fridgian+Samurai before any `newRun` call; work distribution is by-cell through a main-thread `worker_threads` queue for scheduling-independent, true-percentile aggregation (confirmed byte-identical at 1 vs 4 workers); the JSON report never carries a timing field (elapsed goes to stderr only); `tune-difficulty`'s death-cause percentage denominator was deliberately left unchanged (`results.length`) per the plan's "keep every existing line's wording" instruction — only the underlying cause/depth SOURCE set switched to completed runs.

## Deviations from Plan

None — plan executed exactly as written. One same-task authoring correction during Task 1's own verification: two JSDoc comment lines (block-comment `/** ... */` style, not `//`) referenced the literal token "worker_threads", which the plan's own acceptance-criteria grep command (`grep -v '^\s*//' ... | grep -c '...worker_threads...'` expecting `0`) does not filter out of `/** */`-style lines. Reworded both JSDoc sentences to describe the same behavior without the literal token (e.g., "thread-message boundary" instead of "worker_threads message boundary"); no functional code changed. This mirrors 22-01's own documented precedent for a wording-only, same-task fix caught by re-running the plan's own acceptance command.

## Issues Encountered

None beyond the wording correction above — every acceptance criteria command in the plan (Tasks 1-3) passed on first functional implementation once that wording was adjusted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Timing data for Plan 22-04's polling window:** a 24-cell, 2-seed (48-run) matrix took 13.5s at `--workers 1` and 6.6s at `--workers 4` on this dev machine. Extrapolating linearly, the full BEFORE capture (143 cells x 40 seeds = 5,720 runs) is roughly 119x this sample's run count; Plan 22-04 should budget its background-run polling window accordingly (expect single-digit minutes at a healthy worker count, comfortably under the CONTEXT.md's "well under 30 minutes" target) and confirm with a real timed run before committing to a poll interval.
- **Final text-table column layout** (`formatText`'s ranked table, for Plan 22-04's `docs/CLASS-PASS.md` transcription): `#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes`, with `gained(mean)  gained(p50)  survived` inserted before `top causes` whenever `meta.startDepth > 1`. The three roll-up tables (`BY CLASS` / `BY SUBCLASS` / `BY RACE`) use the identical column set with the leading `#`/`class`/`sub`/`race` columns replaced by a single `key`-labeled column (`class`, `sub`, or `race` respectively) and no `rank` column.
- `tools/tune-classes.mjs` is ready for Plan 22-04's BEFORE capture: `node tools/tune-classes.mjs --seeds 40 --workers <N> --out docs/class-pass/before.json` for the natural-start matrix and `node tools/tune-classes.mjs --seeds 10 --start-depth 20 --workers <N> --out docs/class-pass/before-depth20.json` for the depth-20 slice, per 22-CONTEXT.md's volume decisions.
- No blockers. `npm test`: 989/989. The Engine Gate holds — this plan touched only `tools/` and `test/unit/class-matrix.test.js`, no engine/content files (`git diff --quiet` on `package.json`/`package-lock.json` confirms zero new dependencies).

---
*Phase: 22-class-aware-harness-before-matrix*
*Completed: 2026-09-14*
