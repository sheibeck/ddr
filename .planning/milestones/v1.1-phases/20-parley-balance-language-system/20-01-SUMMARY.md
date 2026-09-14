---
phase: 20-parley-balance-language-system
plan: 01
subsystem: testing
tags: [parity, harness, carve-out, tune-difficulty, readout, baseline, node-test]

requires: []
provides:
  - "stripParleyDivergence(state) exported from test/parity/harness/comparables.js — strips exactly c.sp, c.gold, combat.parleyTried, combat.parleyInsulted; scenario-scoped, never folded into the three shared *Comparable() fns"
  - "scenario-scoped cmp wrapper wired into BOTH parley replay sites (test/parity/combat-parity.test.js's local comparable(), test/parity/full-suite.test.js's shared combatComparable loop) — applied only when scenario.name === \"parley\""
  - "test/unit/parley-carveout.test.js: exact-field-scope, no-op-shape, combatComparable-still-exposes-sp/gold, and defensive-flags proofs"
  - "tools/tune-difficulty.mjs: per-run parley tally (parleyAttempts/Successes/Failures/Refused/Exhausted/Sp + spTotal), parleySummary(results) aggregator, 'Parley (D-15 readout' text-report section, parley key in --json"
  - "docs/PARLEY-REBALANCE.md: locked-decision change table (D-01..D-16), seed-303 BEFORE fixture facts, verbatim 200-seed tune-difficulty BEFORE transcript, explicit AFTER/Comparison placeholders for 20-03"
affects: [20-02-parley-balance-language-system, 20-03-parley-balance-language-system]

tech-stack:
  added: []
  patterns: ["scenario-scoped parity carve-out chosen via scenario.name, applied at every independent replay site of the same fixture", "readout-only dev-tool extension (D-15/18-06 precedent): tally new event types without touching the bot's decision policy"]

key-files:
  created:
    - test/unit/parley-carveout.test.js
    - docs/PARLEY-REBALANCE.md
  modified:
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/full-suite.test.js
    - tools/tune-difficulty.mjs

key-decisions:
  - "stripParleyDivergence placed directly after stripRationsField (before economyComparable) in comparables.js, mirroring stripRationsField's exact JSDoc shape (deliberate-permanent-divergence rationale, requirement IDs, fields named, scope stated)"
  - "combat-parity.test.js's per-scenario cmp wrapper defined as the test callback's first statement (scenario.name === \"parley\" ? (s) => stripParleyDivergence(comparable(s)) : comparable), replacing both diffState call sites (initial-boot check and per-action check) with cmp(...) — zero change to the local comparable() body itself"
  - "full-suite.test.js's combat-loop comment avoids repeating the literal function name a third time (grep -c 'stripParleyDivergence' must print exactly 2: import + wrapper) — worded as \"the imported stripper's JSDoc\" instead"
  - "tune-difficulty.mjs's parley tally reads events returned by applyAction inside autoPlayOnce's existing loop (no new draws, no policy change); parleySummary(results) is a new aggregator beside causeBreakdown, not folded into it"

patterns-established:
  - "A fixture scenario replayed by two independent test files gets its scenario-scoped divergence stripper wired at BOTH call sites in the same task, verified by a grep gate on each file plus a dedicated unit test proving the strip's exact field scope"

requirements-completed: [PARLEY-01, PARLEY-02, PARLEY-03]

coverage:
  - id: D1
    description: "stripParleyDivergence strips exactly c.sp/c.gold/combat.parleyTried/combat.parleyInsulted, is a no-op-shaped identity otherwise, and combatComparable itself still exposes c.sp/c.gold (never folded in globally)"
    requirement: PARLEY-01
    verification:
      - kind: unit
        ref: "test/unit/parley-carveout.test.js (4 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The carve-out is wired at both parley replay sites (combat-parity.test.js local comparable, full-suite.test.js shared combatComparable loop), scoped only to scenario.name === \"parley\"; magic fixture and win/lose/flee scenarios untouched"
    requirement: PARLEY-01
    verification:
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/tune-difficulty.mjs reports parley attempts/successes/failures/refused/exhausted/SP-share per batch in both text and --json output, with decideAction's policy, MAX_ACTIONS, and the seed stride byte-for-byte unchanged"
    requirement: PARLEY-03
    verification:
      - kind: unit
        ref: "node tools/tune-difficulty.mjs --seeds=3 --json (verify script: parley object has all 10 numeric keys) — exit 0"
        status: pass
      - kind: other
        ref: "git diff 04eb229 -- tools/tune-difficulty.mjs | grep -c 'canParley\\|ratio < 0.3\\|MAX_ACTIONS =\\|i \\* 7919' — 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/PARLEY-REBALANCE.md holds the verbatim 200-seed BEFORE readout (measured against commit 04eb229, engine/content/src/mazeworld.html unchanged for the whole plan), the seed-303 BEFORE numbers, the locked-decision change table, and explicit empty AFTER/Comparison sections"
    requirement: PARLEY-02
    verification:
      - kind: other
        ref: "docs/PARLEY-REBALANCE.md acceptance-criteria greps (change table, seed-303 draws, tune-difficulty BEFORE transcript, AFTER/Comparison placeholders) — all pass"
        status: pass
      - kind: other
        ref: "git diff --quiet 04eb229 -- engine content src mazeworld.html — exit 0"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-14
status: complete
---

# Phase 20 Plan 01: Parley Baseline (Carve-out, Readout, BEFORE Ledger) Summary

**Scenario-scoped parity carve-out for the seed-303 parley fixture (wired at both independent replay sites), a parley-attempt/success/SP-share tally added to tools/tune-difficulty.mjs, and the committed BEFORE half of docs/PARLEY-REBALANCE.md — all measured against the unmodified pre-Phase-20 engine.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-14
- **Tasks:** 3 completed
- **Files modified:** 6 (4 modified, 2 created)

## Accomplishments
- Exported `stripParleyDivergence(state)` from `test/parity/harness/comparables.js` (placed after `stripRationsField`, mirroring its exact JSDoc shape) — strips exactly `c.sp`, `c.gold`, `combat.parleyTried`, `combat.parleyInsulted`; never folded into `combatComparable`/`movementComparable`/`economyComparable` themselves.
- Wired a scenario-scoped `cmp` wrapper (`scenario.name === "parley" ? (s) => stripParleyDivergence(...) : ...`) into BOTH parley replay sites: `test/parity/combat-parity.test.js`'s local `comparable()` (both `diffState` call sites) and `test/parity/full-suite.test.js`'s shared `combatComparable` loop (both call sites, magic-fixture loop untouched).
- Added `test/unit/parley-carveout.test.js` (4 tests): exact-field-scope proof, no-op-shape proof on a combat-less state, `combatComparable` still exposing `c.sp`/`c.gold` (strip is scenario-scoped, never global), and a defensive-flags-absent-in/out proof. Full parity suite stays 30/30 green.
- Extended `tools/tune-difficulty.mjs`'s `autoPlayOnce` with a per-run parley tally (`parleyAttempts`/`parleySuccesses`/`parleyFailures`/`parleyRefused`/`parleyExhausted`/`parleySp` + `spTotal`), a `parleySummary(results)` aggregator, a `"Parley (D-15 readout"` text-report section, and a `parley` key in `--json` output — zero change to `decideAction`'s policy, `MAX_ACTIONS`, or the seed stride.
- Ran the 200-seed BEFORE readout in the background (confirmed the engine unchanged since commit `04eb229` both before and after the run) and transcribed it verbatim into new `docs/PARLEY-REBALANCE.md`, alongside the locked-decision change table (D-01..D-16) and the seed-303 fixture's exact BEFORE draw sequence/outcome.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export stripParleyDivergence, wire it at both replay sites, add the carve-out unit test** - `dc69aa5` (test)
2. **Task 2: Extend tools/tune-difficulty.mjs with the D-15 parley tally** - `fc1b6aa` (feat)
3. **Task 3: Capture the BEFORE readout and create docs/PARLEY-REBALANCE.md** - `aa52a02` (docs)

_Note: no TDD tasks in this plan._

## Files Created/Modified
- `test/parity/harness/comparables.js` - added `stripParleyDivergence(state)` export (Task 1)
- `test/parity/combat-parity.test.js` - scenario-scoped `cmp` wrapper at both `diffState` call sites for the `parley` scenario (Task 1)
- `test/parity/full-suite.test.js` - scenario-scoped `cmp` wrapper inside the `COMBAT_FIXTURE` loop only (Task 1)
- `test/unit/parley-carveout.test.js` - new, 4 tests proving the carve-out's exact scope (Task 1)
- `tools/tune-difficulty.mjs` - D-15 parley tally, `parleySummary`, report section, `--json` key (Task 2)
- `docs/PARLEY-REBALANCE.md` - new, change ledger + seed-303 BEFORE + tune-difficulty BEFORE readout + AFTER/Comparison placeholders (Task 3)

## Decisions Made
- `stripParleyDivergence` placed immediately after `stripRationsField` (before `economyComparable`) — the closest deliberate-permanent-divergence precedent in the file, same JSDoc shape.
- `full-suite.test.js`'s inline comment describing the carve-out avoids repeating the literal function name a third time, since the plan's acceptance criteria require `grep -c 'stripParleyDivergence'` to print exactly 2 (import + wrapper) in that file.
- `tools/tune-difficulty.mjs`'s parley tally is a new counter block + a separate `parleySummary` aggregator beside the existing `causeBreakdown`, keeping `autoPlayOnce`'s existing control flow (and `decideAction`'s policy) completely untouched.
- The 200-seed BEFORE run was launched with `run_in_background` writing to a scratchpad file with an `EXIT=<code>` sentinel, then polled in bounded ≤90s checks (per the 18-06 precedent) rather than blocking in the foreground — it took just under the documented 5-6 minute window.
- `.planning/REQUIREMENTS.md`'s PARLEY-01/02/03 checkboxes are intentionally left unchecked ("Pending") after this plan, even though they appear in this plan's frontmatter `requirements` field. This plan lays the parity/tooling/doc groundwork ONLY — the actual payout formula, Con Artist odds, and failure-cost mechanics land in 20-02. Marking them complete here would be a false signal in the traceability table; they will be marked complete when 20-02's SUMMARY runs `requirements mark-complete` after the engine rules actually change.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria (grep gates, unit tests, parity suite, `npm test` count, `git diff --quiet` engine-unchanged checks) passed without needing a fix-up pass. One process deviation: `requirements mark-complete` was deliberately NOT run for PARLEY-01/02/03 (see Decisions Made) — the requirement text describes the finished behavior, which this baseline plan does not yet deliver.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
20-02 can now rewrite `canParley`/`parley`/`foeTurn`/`killFoe` in `engine/combat.js` and add `fluency`/`killSpFor` to `engine/derived.js` and land `npm test` green immediately — the scenario-scoped parity carve-out already absorbs the seed-303 `c.sp`/`c.gold` divergence at both replay sites, so no test-file editing is needed mid-flight. 20-03 has the BEFORE half of `docs/PARLEY-REBALANCE.md` ready to compare against once it fills the AFTER readout and the `test/parity/FIXTURE-INVENTORY.md` "Phase 20 parley divergence" table. `npm test` is green at 886/886 (882 baseline + 4 new carve-out tests); parity remains byte-identical to `04eb229` with the one named, documented, scenario-scoped carve-out.

---
*Phase: 20-parley-balance-language-system*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: test/parity/harness/comparables.js
- FOUND: test/parity/combat-parity.test.js
- FOUND: test/parity/full-suite.test.js
- FOUND: test/unit/parley-carveout.test.js
- FOUND: tools/tune-difficulty.mjs
- FOUND: docs/PARLEY-REBALANCE.md
- FOUND: .planning/phases/20-parley-balance-language-system/20-01-SUMMARY.md
- FOUND commit: dc69aa5
- FOUND commit: fc1b6aa
- FOUND commit: aa52a02
- FOUND commit: 7ede251
