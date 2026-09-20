---
phase: 51-initiative-once-per-combat
plan: 01
subsystem: testing
tags: [bot-readout, parity-fixtures, report-tool, measurement-gate]

# Dependency graph
requires:
  - phase: 50-character-roller-fix
    provides: "the phase-start commit (0cacf50, later docs-only descendants d5d8c10) — the untouched engine/content/parity tree this plan measures against"
provides:
  - "docs/DIFFICULTY-RETUNE.md's '## v1.7 tuning pass (Phases 51-54)' H2 with the Phase 51 BEFORE bot readout (solo/party/tune-classes smoke), inserted before the pinned '## v1.2 retune (Phase 27)' H2"
  - "docs/class-pass/v17-p51-before-smoke.json — the full 143-cell BEFORE class-pass matrix"
  - "tools/initiative-fixture-scan.mjs — a report tool that replays all 31 parity replay sites and measures the MOVED SET the per-round initiative re-roll's removal will move"
  - "tools/initiative-fixture-scan-output.txt — the committed BEFORE scan output: MOVED SET (3) = action-script.combat.json#lose, #lose-apprentice, #lose-plain"
affects: [51-02, 51-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Report-tool mould (tools/worn-fixture-scan.mjs) extended to a second measurement axis: Part A tracks state.combat.round transitions directly off engineState.combat (never through a comparable, since combatComparable strips round) to build an edit-invariant predictor; Part B reconstructs full-suite.test.js's own per-scenario comparable (combatComparable + chargenShiftOf/stripChargenShift + stripParleyDivergence/stripScenarioDivergence) minus its skipsByteDiffAt suppression, so a genuinely new divergence is never hidden behind an already-declared one"

key-files:
  created:
    - tools/initiative-fixture-scan.mjs
    - tools/initiative-fixture-scan-output.txt
    - docs/class-pass/v17-p51-before-smoke.json
  modified:
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Part B's comparable deliberately omits full-suite.test.js's skipsByteDiffAt suppression (which hides a declared action-path divergence's already-known cause entirely) — a report tool should show real per-action divergence, not hide it, so Plan 02 sees genuine signal rather than a blanket 'never'. This means parley/cast-damage report firstDivergentAction=0 (their own already-declared Phase 27/31 and Phase 23/31 causes genuinely surface in the raw comparable) rather than the planner's rough guess of 'never' — the tool's own header comment documents this rule so a reader is never surprised."
  - "Part A's round-advance predictor matched the planner's own measured probe exactly: MOVED SET (3), each with first live-fight round advance = 1 — no scan-vs-prediction reconciliation was needed."

requirements-completed: [INIT-01]

coverage:
  - id: D1
    description: "BEFORE bot readout (tune-difficulty --seeds=200 solo, --party, and a tune-classes --seeds 5 smoke) captured verbatim on the phase-start commit (no engine edit landed yet), recorded under '### v1.7 · Phase 51 — initiative once' / '#### BEFORE — commit d5d8c10...' in docs/DIFFICULTY-RETUNE.md, inserted immediately before the pinned '## v1.2 retune (Phase 27)' H2"
    requirement: "INIT-01"
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js + test/unit/class-pass-ledger.test.js: 33/33 pass (v1.2 section still last H2, still 16 H3s)"
        status: pass
      - kind: other
        ref: "grep -c '^## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts' / '^### v1.7 · Phase 51 — initiative once' / '^#### BEFORE — commit [0-9a-f]{40} (phase start, no engine edit)' docs/DIFFICULTY-RETUNE.md all print 1; node -e \"require('./docs/class-pass/v17-p51-before-smoke.json').cells.length\" prints 143"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/initiative-fixture-scan.mjs (a report tool, exit 0, no assertions) replays all 31 parity replay sites and measures the MOVED SET Plan 02 must declare and regenerate: MOVED SET (3) = action-script.combat.json#lose, #lose-apprentice, #lose-plain, each with first live-fight round advance = 1 — matching the planner's own per-action probe exactly. Committed output is deterministic (re-run diff empty)."
    requirement: "INIT-01"
    verification:
      - kind: other
        ref: "node tools/initiative-fixture-scan.mjs > /tmp/check.txt && diff /tmp/check.txt tools/initiative-fixture-scan-output.txt (empty); grep -c '^MOVED SET ([0-9]*): ' / '^| action-script\\.' (31) / '^## Record values (JSON, per moved site)' / '^INITIATIVE EXPOSURE: [0-9]* of 31 replay sites' tools/initiative-fixture-scan-output.txt all print 1 (31 for the row count)"
        status: pass
      - kind: other
        ref: "grep -c 'node:test' tools/initiative-fixture-scan.mjs prints 0 (never picked up by node --test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase gates on the Wave 1 tree: npm test fail 0, npm run build:www green, engine/content/parity fence untouched from the phase-start commit"
    verification:
      - kind: unit
        ref: "npm test — 3334/3334 pass, fail 0 (no test count change; this plan adds no tests)"
        status: pass
      - kind: other
        ref: "npm run build:www exit 0 ('[build-www] done'); git diff --stat 0cacf50..HEAD -- engine/ content/ test/parity/ empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-20
status: complete
---

# Phase 51 Plan 01: Measure First — BEFORE Bot Readout + Initiative Fixture Scan Summary

**Captured the Phase 51 BEFORE bot readout on the untouched phase-start commit and built `tools/initiative-fixture-scan.mjs`, which measures exactly three parity fixtures the per-round initiative re-roll's removal will move — `combat.json#lose`, `#lose-apprentice`, `#lose-plain` — with zero engine bytes changed.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 1 (docs/DIFFICULTY-RETUNE.md) + 3 new (docs/class-pass/v17-p51-before-smoke.json, tools/initiative-fixture-scan.mjs, tools/initiative-fixture-scan-output.txt)

## Accomplishments

- **BEFORE bot readout** (Task 1): three commands run verbatim on commit `d5d8c10` (the phase-start docs-only tree, engine/content/parity byte-identical to `0cacf50`) — `node tools/tune-difficulty.mjs --seeds=200` (solo: death-depth p50=4, p90=5), `--party` (p50=4, p90=6, 56/200 stuck), and `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p51-before-smoke.json` (143 cells x 5 seeds, pooled mean 3.44). All three transcripts quoted verbatim under a new `## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts` H2, inserted immediately before `docs/DIFFICULTY-RETUNE.md`'s pinned `## v1.2 retune (Phase 27)` H2 (per `test/unit/difficulty-retune-ledger.test.js`'s last-H2 guard).
- **`tools/initiative-fixture-scan.mjs`** (Task 2): a report tool in the `tools/worn-fixture-scan.mjs` mould, replaying all 31 parity replay sites (chargen x14, movement, combat x6, magic x4, economy, encounters x5) in lockstep with the frozen prototype sandbox. Part A tracks `state.combat.round` transitions directly (never through a comparable) to build a predictor that is invariant across Plan 02's engine edit; Part B reconstructs the same effective comparable `full-suite.test.js` uses (`combatComparable` + the chargenShift/parley/scenario-divergence carve-outs) to measure current-engine drift.
- **Measured MOVED SET (3):** `action-script.combat.json#lose` (seed 14), `#lose-apprentice` (seed 127), `#lose-plain` (seed 1119) — each with first live-fight round advance at action index 1, matching the planner's own per-action probe exactly. The remaining 28 sites (`win`/`flee`/`parley`, all four `magic.json` scenarios, every chargen/movement/economy/encounters site) never advance a live-fight round and stay out of the MOVED SET.
- Output committed as `tools/initiative-fixture-scan-output.txt`; re-running the tool and diffing against the committed file is empty (deterministic).
- Phase gates: `npm test` 3334/3334 pass, fail 0; `npm run build:www` exit 0; engine/content/parity fence untouched (`git diff --stat 0cacf50..HEAD` empty for those paths; master hash unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: BEFORE bot readout on the phase-start commit** - `0366e4c` (docs)
2. **Task 2: tools/initiative-fixture-scan.mjs — the report tool, run on the pre-edit engine, output committed** - `bf0f9eb` (feat)
3. **Task 3: phase gates on the Wave 1 tree — npm test + build:www, recorded verbatim** - (this commit) (docs)

**Plan metadata:** (this commit) — SUMMARY + STATE + ROADMAP

## Files Created/Modified

- `docs/DIFFICULTY-RETUNE.md` (modified) — new `## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts` H2 (inserted before `## v1.2 retune (Phase 27)`), with `### v1.7 · Phase 51 — initiative once` and `#### BEFORE — commit d5d8c10f64bc9dca33605d82350a93f5083bded3 (phase start, no engine edit)` holding the three transcripts.
- `docs/class-pass/v17-p51-before-smoke.json` (new) — the full 143-cell BEFORE class-pass matrix (`tune-classes --seeds 5 --workers 4`).
- `tools/initiative-fixture-scan.mjs` (new) — the report tool (Part A round-advance predictor + Part B lockstep divergence measurement).
- `tools/initiative-fixture-scan-output.txt` (new) — the committed BEFORE scan output.

## Decisions Made

- Part B's comparable deliberately omits `full-suite.test.js`'s `skipsByteDiffAt` suppression (see key-decisions above) — the scan reports genuine per-action divergence rather than hiding it behind an already-declared cause, giving Plan 02 real signal. Documented at length in the tool's own header comment.
- Part A's round-advance predictor is read directly off `engineState.combat.round` (never through `combatComparable`, which strips `round`) — this is the one measurement that must stay byte-identical before and after Plan 02's engine edit, since it keys on the `afterPlayerAction` `round++` site itself, whose placement does not change.

## Deviations from Plan

None — plan executed exactly as written. The tool's Part B comparable construction (chargenShift/parley/scenario-divergence carve-outs) required reading three additional harness exports (`chargenShiftOf`, `stripChargenShift`, `stripParleyDivergence`, `stripScenarioDivergence`, `actionPathDivergenceOf`) beyond the plan's read_first list (`combatComparable`/`diffState`) to produce a meaningful (non-universally-"0") Part B measurement — this is the same set full-suite.test.js already imports for the identical purpose, not a new pattern, and is documented in the tool's own header comment (Rule 1: a scan that reported "diverges at action 0" for all 31 sites, including `win`/`flee`/`heal`/`potion`/`scroll` which have zero known parity issues, would be a bug in the tool, not a true reading — the universal Phase 38/45 chargen-table-reshape record every scenario carries would otherwise swamp every row).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (engine cut + pins + fixtures) has its measured MOVED SET: exactly `combat.json#lose`, `#lose-apprentice`, `#lose-plain` — these are the only fixtures it may regenerate, per the greenfield engine-gate amendment.
- The BEFORE bot readout is committed and cited by heading name (`v1.7 · Phase 51 — initiative once`) for Plan 02's AFTER block to append under.
- No blockers. Zero engine/content/parity bytes changed this plan (verified: `git diff --stat 0cacf50..HEAD -- engine/ content/ test/parity/` empty; master hash unchanged).

## Human verification (deferred to end of run)

None owed — this plan is measurement and tooling only (a bot readout + a report tool), with zero behavior change to the shipped game. No Pixel 7 checks apply.
