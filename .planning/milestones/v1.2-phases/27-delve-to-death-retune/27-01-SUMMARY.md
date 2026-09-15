---
phase: 27-delve-to-death-retune
plan: 01
subsystem: tuning
tags: [ledger, target-band, docs-first, harness-readout, pooled-rollup, standing-guard, no-engine-change]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    provides: "the corrected player-power AFTER yardstick (mu 3.08, Thief 3.51 > Fighter 3.16 > Magic User 2.55, 0 cannot-act, depth-20 forced start 1.3 encounters / 0.14 floors) that this plan's band is measured against"
provides:
  - "docs/DIFFICULTY-RETUNE.md '## v1.2 retune (Phase 27) — TUNE-05..07' section: target band table (D-09 superseded), verbatim v1.1 verdict, standing rules, bot proxy, BEFORE-by-reference, levers + Dante decision rule with calibration numbers, iteration protocol, and placeholders for 27-02/27-03/27-04"
  - "tools/lib/class-matrix.mjs additive pooled readout: per-cell reach20, pooledSummary(cellRows), rollups.pooled (key ALL), a POOLED text block"
  - "test/unit/difficulty-retune-ledger.test.js — standing structural guard for the v1.2 section"
affects: [27-02-dante-and-non-combat-easing, 27-03-combat-dials-and-after, 27-04-dr-round]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pooled/run-weighted harness readout: pooledSummary(cellRows) reuses summarizeRows over the concatenation of every cell's rows, so an overall median/reach is run-weighted by construction rather than averaged per-cell — the seam docs/DIFFICULTY-RETUNE.md's band table reads from"

key-files:
  created:
    - test/unit/difficulty-retune-ledger.test.js
  modified:
    - docs/DIFFICULTY-RETUNE.md
    - tools/lib/class-matrix.mjs
    - tools/tune-classes.mjs
    - test/unit/class-matrix.test.js

key-decisions:
  - "Substituted the amended band per 27-CONTEXT.md (commit 4d18e80, written AFTER the plan): the natural median death depth row's target is now 'bot median 4, pooled reach >= 5 at >= 25%' (the measured ceiling of the sanctioned levers) with 'human expectation: median 5-6' judged by the DR round — not the plan's original flat 'bot: median 5-6' target. Recorded inline in the ledger row with a provenance note, and here in the SUMMARY per the orchestrator's instruction."
  - "Fixed two hard-wrapped verbatim quotes (v1.1 verdict, D-16 lead) discovered while writing the guard test's exact-substring assertions — joined onto single lines, matching the ledger's existing convention for verbatim quotes (Rule 1 auto-fix)."
  - "Added a third class-matrix.test.js test (buildReport/formatText: rollups.pooled + POOLED block at a deep start depth) beyond the plan's Task 2 named tests to satisfy the task's own '>= 3 more passing tests' acceptance criteria, since extending the existing test in place plus 2 new named tests only reached +2."

requirements-completed: [TUNE-05]

coverage:
  - id: D1
    description: "Target band (TUNE-05) recorded in docs/DIFFICULTY-RETUNE.md under a new '## v1.2 retune (Phase 27)' H2, with the amended natural-median-death-depth row, D-09 marked SUPERSEDED, the verbatim v1.1 verdict, standing rules, bot proxy, BEFORE-by-reference, levers + Dante decision rule, iteration protocol, and placeholders — committed before any constant/bestiary change exists in the tree"
    requirement: TUNE-05
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js (6 tests: H2 uniqueness/position, band-table strings, D-09 superseded, verbatim verdict, sub-heading order, verbatim Bot lines)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Additive, bot-neutral pooled readout in tools/lib/class-matrix.mjs: per-cell reach20, pooledSummary(cellRows), rollups.pooled (key ALL), a POOLED text block — makes the band measurable from harness JSON alone, without touching tools/lib/tuning-bot.mjs or Phase 26's artifacts"
    requirement: TUNE-05
    verification:
      - kind: unit
        ref: "test/unit/class-matrix.test.js (14 tests, +3 vs. baseline: reach20 null/exact-20 handling, pooledSummary run-weighting + null-not-NaN, rollups.pooled/POOLED block at a deep start depth)"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js and test/unit/class-pass-diff.test.js (Phase 26 ledger/gate untouched by the readout change)"
        status: pass
      - kind: other
        ref: "git diff --quiet 5565b22 -- tools/lib/tuning-bot.mjs (bot byte-identical to pin)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-15
status: complete
---

# Phase 27 Plan 1: v1.2 Retune Band Recorded, Pooled Readout Added Summary

**Recorded the TUNE-05 delve-to-death target band in docs/DIFFICULTY-RETUNE.md (D-09 superseded) before any constant change, and added an additive `reach20`/`rollups.pooled` readout to the class-matrix harness so the band is measurable from JSON alone.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 5 (1 doc, 2 tool files, 2 test files — one test file newly created)

## Accomplishments

- Appended `## v1.2 retune (Phase 27) — TUNE-05..07` to `docs/DIFFICULTY-RETUNE.md`: 16 H3 sub-sections in the fixed order (Why again → Standing rules → Target band → Bot proxy → BEFORE → Levers → Iteration protocol → Dante demotion — landed → Change table → Iteration log → AFTER readouts → Comparison vs band → Counterweight triggers → Not changed → DR checklist → Verdict), all placeholders for 27-02/27-03/27-04 in place, D-09 explicitly SUPERSEDED, the v1.1 verdict and D-16 lead quoted verbatim, the Dante decision rule with the full calibration table, and the iteration protocol with the planner's calibration numbers.
- Added `reach20` (per cell), `pooledSummary(cellRows)`, and `rollups.pooled` (key `"ALL"`) to `tools/lib/class-matrix.mjs` — a run-weighted, null-safe pooled summary reusing the harness's own `summarizeRows`, closing the exact gap Phase 26's own handoff named ("the natural matrix's >= 20 rate and its overall median are not carried per cell by the harness JSON"). Added a `POOLED` text block to `formatText` after the BY RACE table, before the Bot line (which stays last). `tools/tune-classes.mjs`'s JSON-shape header comment updated to match; no code change there.
- Created `test/unit/difficulty-retune-ledger.test.js`: 6 tests pinning the v1.2 section's structure — H2 uniqueness/position, band-table measurement-path strings, the D-09 SUPERSEDED marker, the verbatim v1.1 verdict, the fixed 16-item sub-heading order, and the two verbatim Phase 26 Bot lines.
- Confirmed zero drift into Phase 26's territory: `tools/lib/tuning-bot.mjs` byte-identical to pin `5565b22`; `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` still reports 0 of 143 cannot-act cells; `test/unit/class-pass-ledger.test.js` and `test/unit/class-pass-diff.test.js` unaffected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append the `## v1.2 retune (Phase 27)` section to docs/DIFFICULTY-RETUNE.md** - `7e8ecbe` (docs)
2. **Task 2: Add the additive pooled readout to the class-matrix harness** - `547641d` (feat)
   - Fix-up: **add third class-matrix pooled test to meet the +3 acceptance bar** - `95ffbcd` (test)
3. **Task 3: Write test/unit/difficulty-retune-ledger.test.js** - `eaa6ecf` (test; also carries the wrap-quote fix to docs/DIFFICULTY-RETUNE.md)

_Note: no separate plan-metadata commit — this SUMMARY plus the final `docs(27-01): ...` commit close out the plan per the orchestrator's final-commit step._

## Files Created/Modified

- `docs/DIFFICULTY-RETUNE.md` - appended the `## v1.2 retune (Phase 27) — TUNE-05..07` section (band table, superseded D-09, verbatim verdict, levers, Dante decision rule, iteration protocol, placeholders); later fixed two hard-wrapped verbatim quotes onto single lines
- `tools/lib/class-matrix.mjs` - added `reach20` to `summarizeRows`, new `pooledSummary` export, `rollups.pooled`, `formatText`'s `POOLED` block, header comment update
- `tools/tune-classes.mjs` - JSON-shape header comment updated to document `reach20`/`rollups.pooled`; no code change
- `test/unit/class-matrix.test.js` - 3 new tests (reach20 edge cases, pooledSummary run-weighting/null-safety, rollups.pooled + POOLED block at a deep start depth)
- `test/unit/difficulty-retune-ledger.test.js` - new file, 6 tests, the standing structural guard for the v1.2 section

## Decisions Made

- **Band substitution per the amended CONTEXT.md (commit `4d18e80`):** the plan's original natural-median-death-depth row target ("bot: median 5-6") is superseded by the context's later amendment. The ledger row now reads: **Bot: median 4, pooled reach >= 5 at >= 25%** (the measured ceiling of the sanctioned parity-clean levers) with **human expectation: median 5-6**, judged by the DR round (TUNE-07), not the bot proxy. A provenance note is included directly under the band table explaining the substitution and pointing to commit `4d18e80`. All other band rows (reach >= 20 = 1.0-2.0%, forced-20 encounters 3.0-5.0 / floors p50 >= 1 mean 1.0-2.0, cannot-act = 0) are recorded exactly as the plan specified — unaffected by the amendment.
- **Quote-wrap fix (Rule 1):** the v1.1 verdict and D-16 lead quotes were initially drafted with a manual ~72-character line wrap (matching most of the document's prose style), which silently broke the guard test's exact-substring match since `"Level 20, way overtuned. It's instant death"` and `"on any combat."` landed on separate lines. Joined both quotes onto single lines (mirroring how the original v1.1 `### Verdict` block itself keeps its equivalent sentence on one very long line) and re-verified both the Task 1 verify script and the Task 3 guard test pass.
- **Extra class-matrix test (Rule 3 — acceptance-criteria gap):** Task 2's own acceptance criteria required "at least 3 more passing tests" in `test/unit/class-matrix.test.js`; the initial pass added 2 new named tests plus an in-place extension of the existing `buildReport`/`formatText` test (which doesn't add to the test count). Added a third, independent sibling test (`rollups.pooled` + `POOLED` block behavior at a deep start depth, verifying the `>=20%` column and the deep `gained`/`survived` columns) in a small follow-up commit to close the gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hard-wrapped verbatim quotes broke exact-substring guard-test matching**
- **Found during:** Task 3 (writing `test/unit/difficulty-retune-ledger.test.js`)
- **Issue:** The v1.1 verdict quote and the D-16 lead quote, both newly written in Task 1's "Why again" sub-section, were manually line-wrapped mid-sentence, so `d.includes("...instant death on any combat.")` failed even though the words were present (split across a `\r\n`).
- **Fix:** Joined both quoted sentences onto single lines in `docs/DIFFICULTY-RETUNE.md`, preserving CRLF elsewhere in the file.
- **Files modified:** `docs/DIFFICULTY-RETUNE.md`
- **Verification:** `node --test test/unit/difficulty-retune-ledger.test.js` (test 4, "the v1.1 verdict is quoted verbatim") passes; Task 1's automated verify script re-run and still prints `ok`.
- **Committed in:** `eaa6ecf` (Task 3 commit)

**2. [Rule 3 - Blocking] Task 2's own "+3 tests" acceptance criteria unmet after the initial pass**
- **Found during:** Post-Task-2 verification pass (before moving to Task 3)
- **Issue:** `test/unit/class-matrix.test.js` had 11 tests before Task 2; the initial edit added 2 new named tests (`reach20`, `pooledSummary`) and extended the existing `buildReport`/`formatText` test in place — net +2, short of the task's stated "at least 3 more passing tests than before this task" bar.
- **Fix:** Added a third, independent test exercising `rollups.pooled`/the `POOLED` text block at a deep (`startDepth: 20`) matrix, including the `>=20%` column and the deep `gained`/`survived` columns.
- **Files modified:** `test/unit/class-matrix.test.js`
- **Verification:** `node --test test/unit/class-matrix.test.js` reports 14 tests, 14 pass, 0 fail.
- **Committed in:** `95ffbcd`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/acceptance-gap)
**Impact on plan:** Both fixes are mechanical corrections needed to satisfy the plan's own stated verification/acceptance criteria; no scope creep, no engine/content/bot change.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/DIFFICULTY-RETUNE.md`'s `## v1.2 retune (Phase 27)` section is committed and stable before any constant or bestiary change exists in the tree — 27-02 can start immediately, reading the Dante decision rule and the iteration protocol directly from this ledger.
- `rollups.pooled`/`reach20` are available in every `tools/tune-classes.mjs` JSON output from this commit forward, so 27-03 can evaluate every band row directly against `docs/class-pass/retune-after.json` / `retune-after-depth20.json` once those are captured, with no further harness changes needed.
- **Flag for 27-02/27-03:** the amended band's bot-median target is a composite (median exactly 4 as a measured ceiling, reach >= 5 at >= 25% as a separate closed threshold) rather than a simple range. The planner's own calibration numbers (transcribed into the ledger's Iteration protocol sub-section) show the parity-clean lever set (the one actually sanctioned by the ladder cap) measures ≈ 24.7% reach >= 5 — just under the 25% target — so this row may land as a recorded near-miss with the ceiling stated, per the ledger's own "missed measures after the cap are RECORDED, never chased with a fifth iteration" rule. This is not a defect in this plan; it is exactly the outcome CONTEXT.md's calibration predicted and asked to be recorded as such.
- No engine, content, `src/`, `mazeworld.html`, or `tools/lib/tuning-bot.mjs` file changed in this plan (verified via `git diff --quiet` across all 4 commits against the pre-plan HEAD `4a1f8e4`).

---
*Phase: 27-delve-to-death-retune*
*Completed: 2026-09-15*

## Self-Check: PASSED

All 6 files (docs/DIFFICULTY-RETUNE.md, tools/lib/class-matrix.mjs, tools/tune-classes.mjs, test/unit/class-matrix.test.js, test/unit/difficulty-retune-ledger.test.js, this SUMMARY) confirmed present on disk; all 4 task commit hashes (7e8ecbe, 547641d, 95ffbcd, eaa6ecf) confirmed present in `git log --oneline --all`.
