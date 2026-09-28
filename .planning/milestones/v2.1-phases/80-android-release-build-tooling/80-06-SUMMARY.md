---
phase: 80-android-release-build-tooling
plan: "06"
subsystem: testing
tags: [tooling, fit-tool, cli, jsonl, resume, node-test]

# Dependency graph
requires:
  - phase: 54-band-02
    provides: "tools/lib/fit-resume.mjs's readLog/appendLog/makeResumableEvaluate/runSearch and the already-landed Infinity/null rehydrateRow fix (commit 6b48281) this plan proves end to end"
  - phase: 75.3-02
    provides: "tools/fit-difficulty.mjs's --objective/--fresh CLI shape (parseArgs, usage, the stdout-routing/block-header seam this plan's --transcript threads through)"
provides:
  - "tools/lib/fit-resume.mjs#appendTranscript — the tool-owned, append-only per-block stdout record"
  - "tools/fit-difficulty.mjs --transcript=<path> (routes every stdout line through one emit() helper, plus a new per-invocation block header)"
  - "tools/fit-difficulty.mjs --force-infeasible=<n,...> — a TEST SEAM ONLY flag (refused outside --search) forcing named candidates rejected"
  - "test/difficulty/fit-difficulty-cli.test.js — the real-CLI-subprocess proof that a two-block resume retraces a live search exactly, including through a forced +Infinity point"
  - "the TOOL-01 todo closed with a Resolution note"
affects: [79.1-milestone-balance-check-deep-floor-tuning, 80-04, 80-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One emit(line) helper is the sole place a CLI's stdout line is produced — prints to console.log AND appends to an optional, tool-owned transcript file, so the transcript is always byte-identical to what a `>>`-redirected stdout would accumulate, independent of the caller's shell redirect"
    - "A refused-outside-mode test seam (--force-infeasible requires --search) mirrors the existing --fresh-under-tail-only shape: parse the flag unconditionally, validate/refuse in main() once the mode is known"

key-files:
  created:
    - test/difficulty/fit-difficulty-cli.test.js
  modified:
    - tools/lib/fit-resume.mjs
    - tools/fit-difficulty.mjs
    - test/unit/fit-resume.test.js
    - .planning/todos/completed/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md (moved from todos/pending/)

key-decisions:
  - "The CLI test supplies --start=<a real DIALS snapshot> rather than relying on --search's default {} identity: tools/lib/fit-score.mjs#applyStep indexes directly into the raw --start object by SEARCH_PLAN's coordinate paths, and every real fit run in this codebase's history has always supplied a full --start=fit/start.json for exactly this reason (confirmed by reproducing the crash against unmodified master with a bare `node tools/fit-difficulty.mjs --search --seeds=2 --workers=1 --budget=2`, no plan-added flags at all) — the test builds this snapshot by importing the engine's own frozen DIALS export (read-only; engine/difficulty.js is never modified) rather than hand-authoring a partial dial set that could drift from the real coordinate paths."
  - "--max-actions was lowered from the plan's suggested starting point (1500) to the floor (300): the first green run of the full CLI test file measured 141s combined (over the 120s budget); at 300 it measured 74s. Not lowered further since the plan sets 300 as the floor."
  - "The block header (`== fit-difficulty block ...`) is emitted through the same emit() helper as every other line, INCLUDING in single-evaluation mode — informational only there (single mode never resumes), but keeping one emission path for every mode avoids a second, divergent code path."

requirements-completed: [TOOL-01]

coverage:
  - id: D1
    description: "A resumed fit retraces the live walk exactly through the real CLI, including after an infeasible point (rows agree n/dials/score/verdict/constraints.ok/floors; exactly one resumed marker between rows 3 and 4; the final BEST line matches)"
    requirement: TOOL-01
    verification:
      - kind: integration
        ref: "test/difficulty/fit-difficulty-cli.test.js#a fit resumed across two blocks (with a forced-infeasible n=2) retraces the live walk exactly, and per-block stdout is appended not truncated"
        status: pass
      - kind: unit
        ref: "test/unit/fit-resume.test.js#a search resumed from a log containing an infeasible row reproduces the original walk (USER RULING G Adjustment 3(c))"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-block stdout is appended, never truncated, by construction (appendTranscript) — the resumed transcript stays byte-prefixed across two blocks, holds two block headers, and its #n row lines equal the live transcript's"
    requirement: TOOL-01
    verification:
      - kind: unit
        ref: "test/unit/fit-resume.test.js#appendTranscript (3 tests: append+newline ordering, null-path no-op, missing-parent-dir creation)"
        status: pass
      - kind: integration
        ref: "test/difficulty/fit-difficulty-cli.test.js (same test as D1 — the transcript-prefix, two-header-line and matching-#n-row-line assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The test-only infeasibility seam (--force-infeasible) never changes a real fit: refused outside --search (exit 2), and without it a cheap search has no seam reason and a finite score at n=2"
    requirement: TOOL-01
    verification:
      - kind: integration
        ref: "test/difficulty/fit-difficulty-cli.test.js#--search without --force-infeasible has no seam reason and a finite score at n=2 (exit 0)"
        status: pass
      - kind: integration
        ref: "test/difficulty/fit-difficulty-cli.test.js#--force-infeasible without --search exits 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "The stale TOOL-01 todo is closed with a Resolution note naming commit 6b48281 and this plan's tests; the tooling-only boundary holds (no engine/content/parity/fixtures touched)"
    requirement: TOOL-01
    verification:
      - kind: other
        ref: "test -f .planning/todos/completed/2026-09-21-...md && grep -c 6b48281 (=1); git diff --stat <plan-base> -- engine content test/parity test/fixtures (empty)"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-09-26
status: complete
---

# Phase 80 Plan 06: Fit Tool CLI Resume Proof, Append-Only Transcript & TOOL-01 Close-Out Summary

**A real-CLI subprocess test proves a two-block resume retraces a live `fit-difficulty.mjs` search exactly through a forced-infeasible point; `appendTranscript` + `--transcript` make per-block stdout append-only by construction; the stale TOOL-01 todo is closed**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-09-26T15:52:54-04:00 (plan base commit)
- **Completed:** 2026-09-26T16:41:05-04:00
- **Tasks:** 3 of 3
- **Files modified:** 5 (1 created, 3 modified, 1 moved)

## Accomplishments

- `tools/lib/fit-resume.mjs#appendTranscript(transcriptPath, line)` — a pure, additions-only helper (zero lines removed from the existing file) that appends a line plus a newline, no-ops on a `null` path, and creates a missing parent directory.
- `tools/fit-difficulty.mjs` gained `--transcript=<path>` (every stdout line — a new per-invocation block header, each `#n` row, both `BEST` lines — routes through one `emit()` helper that prints AND appends) and `--force-infeasible=<n,...>` (TEST SEAM ONLY, refused outside `--search`, forces the listed candidate numbers rejected using the exact rejection shape `classConstraints` would produce for a real fairness failure).
- `test/difficulty/fit-difficulty-cli.test.js` (new, 3 tests) spawns the real `fit-difficulty.mjs` CLI as a subprocess — real argument parsing, real worker threads, the real engine, real file I/O — for a live search and a two-block resumed search against the same JSONL log/transcript, and proves row-for-row agreement (n, dials, score, verdict, constraints.ok, floors), the single `{resumed:true, fromN:3}` marker's position, matching final `BEST` lines, and the transcript's append-only/prefix/two-header/matching-row-line behavior.
- `test/unit/fit-resume.test.js` gained 3 `appendTranscript` unit tests; every pre-existing test in that file is unchanged and still passes.
- The stale `2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` todo moved from `todos/pending/` to `todos/completed/` with a Resolution note naming commit `6b48281` (the already-landed fix) and this plan's real-CLI proof.
- Full suite: `npm test` 6569/6569 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the CLI end-to-end test and the appendTranscript unit tests (RED)** - `4e2710ac` (test)
2. **Task 2: Add appendTranscript and the --transcript and --force-infeasible flags (GREEN)** - `56217b17` (feat)
3. **Task 3: Check the success criterion end to end, close the todo, run the full suite** - `da7d8653` (docs)

_Note: Tasks 1-2 were marked `tdd="true"` and DID land as separate RED-then-GREEN commits (`4e2710ac` test, then `56217b17` feat) — see TDD Gate Compliance below._

## Files Created/Modified

- `test/difficulty/fit-difficulty-cli.test.js` - new: 3 tests spawning the real CLI subprocess for the live-vs-resumed proof, the seam-off proof, and the outside-`--search` refusal
- `test/unit/fit-resume.test.js` - 3 new `appendTranscript` tests added; every pre-existing test unchanged
- `tools/lib/fit-resume.mjs` - `appendTranscript` export added (additions only)
- `tools/fit-difficulty.mjs` - `--transcript`/`--force-infeasible` flags, `parseArgs`/`usage`/header updates, the `emit()` helper + block header, the `realEvaluate` seam
- `.planning/todos/completed/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` - moved from `todos/pending/`, Resolution note appended

## Decisions Made

- **`--start` supplies a real DIALS snapshot, not the CLI's own `{}` default.** Reproduced against unmodified master (no plan-added flags) that `node tools/fit-difficulty.mjs --search --seeds=2 --workers=1 --budget=2` (no `--start`) crashes inside `applyStep` on the very first coordinate probe — `--search` walks `SEARCH_PLAN`'s coordinates directly on the raw `--start` object, and every real fit run in this repo's history has always supplied a full `fit/start.json` for exactly this reason (the CLI's own header "Run:" examples never show `--search` without `--start`). This is a Rule 3 (blocking issue) fix scoped entirely to the test file — it reads `DIALS` from `engine/difficulty.js` (read-only import, no engine file modified) to build a `--start` file that covers every coordinate the search will touch.
- **`--max-actions` lowered from 1500 to the plan's 300 floor.** First green run of the full CLI test file (at 1500) measured 141s combined, over the plan's 120s budget; at 300 it measured 74s. Recorded per the plan's own instruction ("not below 300").
- **The block header emits in single-evaluation mode too**, even though only `--search` resumes — one emission code path for every mode is simpler than a mode-conditional one, and the header's own `resume-from` field is honestly `none` when nothing was resumed.

## TDD Gate Compliance

Both Task 1 and Task 2 are `tdd="true"` at the individual-task level (this plan's own frontmatter is `type: execute`, not `type: tdd`, so the plan-level RED/GREEN/REFACTOR gate sequence enforcement does not apply — but the same discipline was followed anyway):

1. **RED gate:** `4e2710ac` (`test(80-06): ...`) — both new test files fail against the unmodified tools (`node --test` exit code 1; the unit test fails at import with `SyntaxError: ... does not provide an export named 'appendTranscript'`; the CLI test fails on `Unknown flag: --force-infeasible`).
2. **GREEN gate:** `56217b17` (`feat(80-06): ...`) — `node --test test/unit/fit-resume.test.js test/difficulty/fit-difficulty-cli.test.js` passes 12/12.
3. **REFACTOR gate:** not applicable — no refactor commit was needed; the GREEN implementation was accepted as-is.

## Success Criterion 4 Evidence Map (ROADMAP Phase 80)

| Criterion | Evidence |
|---|---|
| (a) Exact walk after `+Infinity` | `test/difficulty/fit-difficulty-cli.test.js`'s row-for-row agreement (n, dials, score, verdict, constraints.ok, floors for n=1..6) between the live and two-block-resumed logs, the single `{resumed:true, fromN:3}` marker sitting between rows 3 and 4, and the matching final `BEST` lines — plus the pre-existing library-level regression test `test/unit/fit-resume.test.js#a search resumed from a log containing an infeasible row reproduces the original walk` |
| (b) Per-block stdout appended | The same CLI test's transcript assertions: the resumed transcript after block 2 starts with block 1's exact snapshot and is strictly longer, holds exactly two block-header lines, and its `#n` row lines (in order) equal the live transcript's — backed by the 3 new `appendTranscript` unit tests |
| (c) The seam is inert when absent | `test/difficulty/fit-difficulty-cli.test.js#--search without --force-infeasible has no seam reason and a finite score at n=2` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `--search` without a coordinate-covering `--start` crashes in `applyStep`, unrelated to any of this plan's own flags**
- **Found during:** Task 1 (writing the CLI test's shared flags)
- **Issue:** The plan's shared-flags list (`--search --seeds=2 --workers=1 --max-actions=1500 --force-infeasible=2`) omits `--start`, defaulting `--search` to the identity `{}` object. Reproduced on unmodified master with zero plan-added flags (`node tools/fit-difficulty.mjs --search --seeds=2 --workers=1 --budget=2`): `applyStep` (`tools/lib/fit-score.mjs`) throws `TypeError: Cannot read properties of undefined (reading 'perDepth')` on the very first coordinate probe, because it indexes directly into the raw `--start` object by `SEARCH_PLAN`'s coordinate paths (e.g. `["FOE_LEVEL", "perDepth"]`), which don't exist on `{}`.
- **Fix:** The test file now writes a real `DIALS` snapshot (imported read-only from `engine/difficulty.js`, never modified) to a tmp JSON file and passes it as every invocation's `--start`, matching how every real fit run in this repo's history has always been invoked (`--start=fit/start.json`).
- **Files modified:** `test/difficulty/fit-difficulty-cli.test.js` only — `tools/lib/fit-score.mjs` was never touched (the plan's own prohibition holds).
- **Verification:** all 3 CLI tests pass; `git diff --quiet <plan-base> -- tools/lib/fit-score.mjs tools/lib/tail-score.mjs` succeeds.
- **Committed in:** `4e2710ac` (the test file's own commit — this fix was made before the file's first commit, so it carries no separate hash).

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking issue, scoped entirely to the new test file).
**Impact on plan:** No functional regressions to the tool itself; the fix only corrects how the new test invokes an existing, unmodified CLI contract. No scope creep — `tools/lib/fit-score.mjs` and `tools/lib/tail-score.mjs` remain byte-identical to the plan base.

## Issues Encountered

None beyond the Rule 3 fix documented above.

## User Setup Required

None - no external service configuration required.

## Orchestrator Notes

- **STATE.md's "Pending Todos" line for `2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md`** can be struck — the todo now lives under `.planning/todos/completed/` with its Resolution note.
- **Future checkpointed fit blocks (including Phase 79.1's deep-floor balance sweep) should pass `--transcript=<block transcript path>` in addition to any `>>` shell redirect** — the transcript is now the tool's own append-only record and cannot be truncated by a re-run block regardless of how the shell redirect is spelled.
- No engine, content, `test/parity/`, or `test/fixtures/` file was touched (`git diff --stat <plan-base> -- engine content test/parity test/fixtures` is empty) — the tooling-only boundary holds.
- `npm test` is 6569/6569 green.

## Next Phase Readiness

- TOOL-01 is fully closed: the already-landed replay/resume fix (`6b48281`) is now proven through the real CLI, not just the pure library, and per-block stdout is structurally append-only.
- `--transcript` is ready for Phase 79.1's own milestone-end balance sweep to adopt.
- No blockers for 80-04/80-05 (the BUILD part) — this plan is the CODE part's fit-tool track and is independent of the R8/edge-to-edge/large-screen tracks in 80-01..80-03.

---
*Phase: 80-android-release-build-tooling*
*Completed: 2026-09-26*

## Self-Check: PASSED

All 6 created/modified files found on disk; all 3 task commits (`4e2710ac`, `56217b17`, `da7d8653`) found in `git log --oneline --all`.
