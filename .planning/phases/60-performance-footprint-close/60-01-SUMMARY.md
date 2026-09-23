---
phase: 60-performance-footprint-close
plan: 01
subsystem: testing
tags: [node-test, cli-tool, perf, adb, tdd]

# Dependency graph
requires:
  - phase: 49-measure-first-perf-pass
    provides: src/browser/perfMarks.js (createPerfMarks nearest-rank median/p95/max)
provides:
  - tools/cold-start.mjs — dependency-free cold-start measurement tool (run/judge/adb-path)
  - test/unit/cold-start.test.js — 18-test pin (11 pure core, 7 CLI)
affects: [60-performance-footprint-close plan 03 (device session)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-free tools/*.mjs CLI: node:-only imports, main-module guard (`path.resolve(process.argv[1] || \"\") === url.fileURLToPath(import.meta.url)`), hand-rolled --key value arg parser, spawnSync with array args and no shell."
    - "One tested judge function owns every regression threshold; a measure that was not supplied reports 'not measured', never a pass."

key-files:
  created:
    - tools/cold-start.mjs
    - test/unit/cold-start.test.js
  modified: []

key-decisions:
  - "PERF03_THRESHOLDS.aabBytes reads '2 MB' as 2,000,000 bytes (decimal MB) — the stricter of the two byte/MB readings, per 60-CONTEXT."
  - "resolveAdb appends .exe (win32 only) to the three SDK-derived paths (ANDROID_HOME/ANDROID_SDK_ROOT/sdk.dir) but returns the --adb flag, the ADB env var, and the bare 'adb' fallback exactly as given — those are already a full adb invocation."
  - "judgePerf03 rounds delta/deltaPct to 0.001 before every comparison so floating-point noise (21.8 - 19.8 reading as 1.9999999999999982) can never flip a verdict; every comparison is strictly greater, so an exact-threshold delta never regresses."

patterns-established:
  - "Pattern: a measurement tool's validity gate (warm/failed launch exclusion) and its threshold judge both carry a teeth check — a temporary code mutation proven to fail the pinning test, then reverted via git checkout — recorded in the SUMMARY as evidence the guard is not vacuous."

requirements-completed: [PERF-03]

coverage:
  - id: D1
    description: "tools/cold-start.mjs measures 1 warm-up + 10 cold launches per build via adb shell am start -W, force-stopping between runs, and reports median/p95/min/max by the same nearest-rank method as the Phase 49 step rows (createPerfMarks)."
    requirement: "PERF-03"
    verification:
      - kind: unit
        ref: "test/unit/cold-start.test.js#summarizeSamples reports n/median/p95/min/max by nearest rank, identical to createPerfMarks for the same samples"
        status: pass
      - kind: unit
        ref: "test/unit/cold-start.test.js#run --fixture replays 1 warm-up + 10 measured blocks and spawns no adb"
        status: pass
    human_judgment: false
  - id: D2
    description: "A warm, failed, or non-ok-status launch can never be silently averaged into the cold-start median — measured runs with no TotalTime or a non-ok Status exit 1; a non-COLD LaunchState (with no exit-1 condition) exits 2; the warm-up launch is excluded from both checks and the samples."
    requirement: "PERF-03"
    verification:
      - kind: unit
        ref: "test/unit/cold-start.test.js#run --fixture exits 2 on a non-COLD measured launch and 1 on a missing TotalTime or a non-ok Status"
        status: pass
    human_judgment: false
  - id: D3
    description: "judgePerf03 is the single tested function applying all three PERF-03 regression thresholds (cold-start median EITHER-branch, step p95, AAB bytes), with delta/deltaPct rounded to 0.001 so floating-point noise cannot flip a verdict, and an unsupplied measure always reports 'not measured' rather than a pass."
    requirement: "PERF-03"
    verification:
      - kind: unit
        ref: "test/unit/cold-start.test.js#judgePerf03 cold start regresses on EITHER branch; exactly at a threshold does not"
        status: pass
      - kind: unit
        ref: "test/unit/cold-start.test.js#judgePerf03 step p95: +2.0 ms does not regress despite floating-point error"
        status: pass
      - kind: unit
        ref: "test/unit/cold-start.test.js#judgePerf03 AAB: +2,000,000 bytes does not regress, +2,000,001 does, a shrink never does"
        status: pass
      - kind: unit
        ref: "test/unit/cold-start.test.js#an unsupplied measure is 'not measured', never a pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveAdb resolves adb with no PATH dependency (this machine has no adb on PATH), in a six-level precedence order, sharing the same resolution plan 60-03's install commands will use."
    requirement: "PERF-03"
    verification:
      - kind: unit
        ref: "test/unit/cold-start.test.js#resolveAdb precedence: flag > ADB env > ANDROID_HOME > ANDROID_SDK_ROOT > local.properties sdk.dir > bare adb"
        status: pass
      - kind: unit
        ref: "test/unit/cold-start.test.js#adb-path prints the resolved adb path"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-23
status: complete
---

# Phase 60 Plan 01: Cold-start measurement tool + PERF-03 judge Summary

**Dependency-free `tools/cold-start.mjs` (run/judge/adb-path CLI) and its 18-test unit pin, giving plan 60-03's Pixel 7 session a tool proven against fixtures — not hand-computed arithmetic mid-session.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-23T01:10Z (approx, first Read)
- **Completed:** 2026-09-23T02:09:50Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `tools/cold-start.mjs` exports a fully pure core (`splitAmStartBlocks`, `parseAmStart`, `summarizeSamples`, `resolveAdb`, `judgePerf03`, `renderVerdictTable`, `PERF03_THRESHOLDS`) plus a `run` / `judge` / `adb-path` CLI, imports only `node:`-prefixed built-ins and `../src/browser/perfMarks.js`, and has no top-level side effects when imported (verified by this file's own test importing it directly).
- `summarizeSamples` reuses `createPerfMarks` directly (not a re-derived percentile calculation), so cold-start numbers and the Phase 49 step rows share exactly one nearest-rank method — pinned by a deep-equal assertion against a hand-built `createPerfMarks` instance on the same samples.
- `run --fixture` replays a captured `am start -W` transcript through the identical split/parse/summarize path the live path uses, spawning no process; `--dry-run` prints the exact adb command lines and spawns nothing either — the tool is fully unit-tested with no device.
- A warm-up launch is excluded from both validity checks and the samples; a measured launch with no `TotalTime` or a non-ok `Status` exits 1; a present non-COLD `LaunchState` (with no exit-1 condition) exits 2 — proven both by Test 13 and by a teeth check that deletes the non-COLD guard and confirms the test fails.
- `judgePerf03` owns all three PERF-03 thresholds in one tested function with `delta`/`deltaPct` rounded to 0.001 before every comparison (so `21.8 − 19.8`'s floating-point residue of `1.9999999999999982` reads as exactly `2.0` and does not regress); an unsupplied measure always reports `regresses: null` / `rule: "not measured"`, never a pass — proven both by Tests 6–9 and by a teeth check that drops the cold-start percentage branch and confirms the 500→551 case fails.
- `resolveAdb` resolves adb with zero PATH dependency (confirmed: this machine has no adb on PATH), in the exact six-level precedence order plan 60-03's install commands will reuse via `node tools/cold-start.mjs adb-path`.

## Task Commits

Each task was committed atomically, following the plan's `tdd="true"` RED/GREEN split:

1. **Task 1: The pure core** — RED `90ef171` (test: Tests 1-11), GREEN `6a7e9a5` (feat: parse/summarize/resolve-adb/judge)
2. **Task 2: The CLI — run/judge/adb-path, with teeth checks** — RED `9d829e2` (test: Tests 12-18), GREEN `596bbb6` (feat: run/judge/adb-path CLI)

**Plan metadata:** committed after this SUMMARY (docs: complete plan)

_Both tasks were `tdd="true"`; no separate refactor commit was needed — GREEN landed clean on the first pass for both._

## Files Created/Modified

- `tools/cold-start.mjs` - Pure exports (`DEFAULT_PACKAGE`, `DEFAULT_ACTIVITY`, `PERF03_THRESHOLDS`, `splitAmStartBlocks`, `parseAmStart`, `summarizeSamples`, `resolveAdb`, `judgePerf03`, `renderVerdictTable`) plus `run` / `judge` / `adb-path` CLI subcommands behind a main-module guard.
- `test/unit/cold-start.test.js` - 18 named tests (11 pure core, 7 CLI), fixtures built inline or written to `os.tmpdir()` at test time; no `.js` fixture file under `test/` (would be collected by `node --test`).

## Decisions Made

- `PERF03_THRESHOLDS.aabBytes` reads "2 MB" as 2,000,000 bytes (decimal), the stricter reading, per the plan's must_haves.
- `resolveAdb`'s `.exe` suffix applies only to the three SDK-derived resolution paths (ANDROID_HOME / ANDROID_SDK_ROOT / sdk.dir), not to the `--adb` flag, the `ADB` env var, or the bare `"adb"` fallback — those three are already meant to be a complete adb invocation, so appending `.exe` to them would be wrong on a value like `Z:/custom/adb` supplied without an extension.
- `judgeMeasure`'s per-measure `threshold` field carries the exact render-time string (`"> 10 % or > 100 ms"`, `"> 2 ms"`, `"> 2,000,000 B"`), so `renderVerdictTable` reads it directly rather than re-deriving the same text in two places.
- Task 1's module imports zero `node:` built-ins (none are needed by the pure functions) — only `../src/browser/perfMarks.js` — keeping the "no top-level side effects" requirement airtight rather than importing `fs`/`path` early and leaving them unused until Task 2.

## Deviations from Plan

None - plan executed exactly as written. Both teeth checks (dropping the cold-start percentage branch; deleting the non-COLD launch-state guard) were performed exactly as specified, confirmed to fail the named test, and reverted with `git checkout -- tools/cold-start.mjs` before the next step. `git diff --quiet -- tools/cold-start.mjs` returned clean before and after each teeth check, and the full 18-test suite was green immediately before and after each one.

## Issues Encountered

None.

## Verification (from the plan's `<verification>` block)

- `node --test test/unit/cold-start.test.js` — **18/18 pass**, exit 0.
- Import allowlist (`stripJs`-stripped, line-anchored `^import\s[^;]*?from\s+"([^"]+)";$` plus `import(...)`): specifiers are exactly `node:fs`, `node:path`, `node:url`, `node:child_process`, `../src/browser/perfMarks.js` — every one starts with `node:` or is the perfMarks import, and the latter is present. `package.json` / `package-lock.json` byte-unchanged.
- `git diff --quiet d6db678...HEAD -- package.json package-lock.json src/ engine/ content/ test/parity/ mazeworld.html` — exit 0, both after Task 1 and after Task 2.
- Live-mode smoke without a device, run **in this isolated worktree** (no `android/local.properties`, `ANDROID_HOME`/`ANDROID_SDK_ROOT` both confirmed unset): `node tools/cold-start.mjs adb-path` printed `adb` — the expected fallback per the plan's own instruction ("record in the SUMMARY that it falls back to a bare adb, which is expected. Do not copy the file in"). Plan 60-03, running on the main checkout with `android/local.properties` present, is expected to print a path ending in `adb.exe`.
- `node tools/cold-start.mjs run --label x --dry-run` — exit 0, printed exactly **22 lines** (2 × (1 warmup + 10 runs)).
- Teeth check (a): dropped the cold-start rule's percentage branch → `node --test --test-name-pattern="EITHER branch" test/unit/cold-start.test.js` **FAILED** (500 → 551 case: expected `true`, got `false`) → reverted via `git checkout -- tools/cold-start.mjs` → `git diff --quiet` clean, full suite green.
- Teeth check (b): deleted the non-COLD `LaunchState` guard in `processBlocks` → the "exits 2 on a non-COLD measured launch" test **FAILED** (expected exit 2, got exit 0) → reverted via `git checkout -- tools/cold-start.mjs` → `git diff --quiet` clean, full suite green.
- `npm test` (plain `node --test`, no `node_modules` in this worktree, matching the run_conventions expectation): **3888 pass / 16 fail / 3904 total**. All 16 failures are the documented CRLF-artifact set exactly (`test/parity/divergence-records.test.js` ×2, `test/unit/class-pass-ledger.test.js` ×4, `test/unit/flee-ledger.test.js` ×3, `test/unit/shell-tab-snapshots.test.js` ×7 = 16) — confirmed by location, not chased or fixed. Every other test passed, including the new `test/unit/cold-start.test.js` file.
- `npm run build:www` — **not run here**; this is an isolated worktree without `node_modules`, following the 59-01 precedent (the orchestrator runs it after merge).
- `git diff --quiet v1.7 HEAD -- engine/ content/ test/parity/` — exit 0. The presentation gate holds against the milestone base; this plan touched no engine/content/parity file.
- `git hash-object test/parity/prototype-master.js.txt` — printed `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`, matching exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 60-03's device session can run `node tools/cold-start.mjs run --label v1.7 --runs 10 --warmup 1` and `... --label v1.8 ...` against the Pixel 7, then feed both run JSONs' `summary.median` into `node tools/cold-start.mjs judge --cold-base ... --cold-head ... --step-base ... --step-head ... --aab-base ... --aab-head ...` for a single tested verdict — no hand arithmetic needed mid-session.
- `node tools/cold-start.mjs adb-path` gives plan 60-03's install commands the same adb resolution this tool uses, with no PATH dependency.
- No blockers. This plan's only device-touching verbs (`am force-stop`, `am start -W`) were never exercised against a real device or a real adb binary — every CLI test passed `--adb` pointing at a nonexistent path, or used `--fixture`/`--dry-run`, which never spawn at all.

---
*Phase: 60-performance-footprint-close*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: tools/cold-start.mjs
- FOUND: test/unit/cold-start.test.js
- FOUND: .planning/phases/60-performance-footprint-close/60-01-SUMMARY.md
- FOUND commit 90ef171 (test: Tests 1-11, RED)
- FOUND commit 6a7e9a5 (feat: pure core, GREEN)
- FOUND commit 9d829e2 (test: Tests 12-18, RED)
- FOUND commit 596bbb6 (feat: CLI, GREEN)
