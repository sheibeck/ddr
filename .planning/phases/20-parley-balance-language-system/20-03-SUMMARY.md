---
phase: 20-parley-balance-language-system
plan: 03
subsystem: testing
tags: [parley, availability-matrix, property-test, draw-count, counting-rng, ui-mirror, fixture-inventory, readout, phase-gate, node-test]

requires:
  - phase: 20-parley-balance-language-system/20-01
    provides: "stripParleyDivergence carve-out at both parity replay sites; tools/tune-difficulty.mjs parley tally; docs/PARLEY-REBALANCE.md BEFORE half"
  - phase: 20-parley-balance-language-system/20-02
    provides: "the landed canParley/parley/foeTurn rewrite, fluency/killSpFor helpers, narration, and the mazeworld.html classic canParley/fluency mirror"
provides:
  - "test/unit/parley.test.js — 15 tests: the full 576-case availability matrix (independent oracle), every canParley gate explicitly, the reachable Wilmsry-vs-Magical refusal, the applyAction dispatcher-path exhausted probe, the parleyInsulted member-branch +1 and its persistence, Con Artist odds + the D-08 clamp, the fluency bonus term, the killSpFor x0.5 payout + its <= property, the Humans wilmst-on-6-only check, a countingRng draw-shape pin, the seed-303 pin re-measured live, and a save/load round-trip"
  - "test/unit/parley-button-mirror.test.js — 3 tests: extracts mazeworld.html's LIVE classic fluency()/canParley() and replays the engine's 576-case matrix plus the parleyTried/no-combat cases through it; zero disagreements"
  - "test/parity/FIXTURE-INVENTORY.md '## Phase 20 parley divergence' section — the re-measured seed-303 before/after table (need 19->17, sp 13->7, gold 250->50, draws 4->3), the carve-out rationale, and the byte-identical-elsewhere statement"
  - "docs/PARLEY-REBALANCE.md AFTER readout (200-seed tune-difficulty against the landed engine) + Comparison section, both informational per D-15"
affects: []

tech-stack:
  added: []
  patterns:
    - "an independent prose-restated oracle (never calling the function under test) checked against every combination of a combinatorial gate, with aggregate counts pinning the shape (24/0/0) as a second, structural proof beyond the per-case loop"
    - "a hand-maintained UI duplicate of an engine gate function is kept honest by extracting its REAL shipped source (fs.readFileSync + regex, new Function) and replaying the SAME matrix through both, rather than trusting a comment to keep them in sync"
    - "a deliberate parity divergence's AFTER numbers are taken from a passing unit test's live measurement, never computed by hand a second time, so the documentation and the code cannot silently drift apart"

key-files:
  created:
    - test/unit/parley.test.js
    - test/unit/parley-button-mirror.test.js
  modified:
    - test/parity/FIXTURE-INVENTORY.md
    - docs/PARLEY-REBALANCE.md

key-decisions:
  - "expectedCanParley (the LANG-02 oracle) is a prose restatement written from CONTEXT.md's D-11/D-12 bullets, not derived by reading engine/combat.js's canParley body — verified independently by running it against all 576 cases before committing and confirming 0 mismatches, matching magicalTrue=24/walkingDeadTrue=0/plainHumanSoldierTrue=0 exactly as the plan's must_haves require"
  - "the D-03/D-04 wilmst-check test needed floor.depth=3 (not the fixedState default of 1) to reproduce the plan's own pinned amount of 1200 (d6=4 x 100 x depth) — fixedState's default fixture floor was overridden per-test rather than changed globally, to avoid perturbing every other test in the file that relies on depth 1"
  - "two literal-number acceptance-criteria greps (need, 13 appearing >=2 times; need, 11 appearing >=2 times) needed a second explicit assertion beyond the natural test flow (parley() events already prove the numbers correctly) — added restated assert.ok/assert.equal lines with the literal digits so the grep gate and the live assertion both hold, rather than treating this as a cosmetic no-op"
  - "the FIXTURE-INVENTORY.md gold row was restructured from an inline '250 (50 + 200)' expression to a literal '250 (starting 50 + wilmst 200)' / '50 (...)' pair, plus a standalone headline sentence stating '250 → 50', so the row stays factually accurate (250 was never a formula output, it was starting-gold-plus-payout) while still satisfying the acceptance grep for a literal '250 → 50' transition"
  - "docs/PARLEY-REBALANCE.md's AFTER readout was transcribed verbatim from a single background node tools/tune-difficulty.mjs --seeds=200 run (EXIT=0, polled via bounded checks) against the engine exactly as landed by 20-02 — re-run was not needed since the engine was already confirmed diverged from 04eb229's engine/combat.js before the run started and unchanged after"

patterns-established:
  - "A combinatorial availability gate gets both a per-case independent-oracle loop AND aggregate count assertions (the count of true/false across specific sub-slices) as two separate, mutually-reinforcing proofs of the same rule set."
  - "A deliberate parity carve-out's documentation states its AFTER numbers as 'taken from test X, not computed here' with the exact test name, so a future reader can re-verify by re-running one command instead of re-deriving arithmetic."

requirements-completed: [PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02]

coverage:
  - id: D1
    description: "test/unit/parley.test.js's 576-case availability matrix (LANG-02/D-11) matches an independent rule oracle exactly, with aggregate counts (Magical=24, Walking Dead=0, plain-Human-Soldier=0) proving the shape structurally, not just per-case"
    requirement: LANG-02
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"LANG-02 / D-11: availability matrix...\" (passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every canParley gate is individually, explicitly asserted (PARLEY-04/D-12) including the now-reachable Wilmsry-vs-Magical refusal, proven to draw nothing, never set parleyTried, and refuse (not exhaust) on a second call"
    requirement: PARLEY-04
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"PARLEY-04 / D-12: every canParley gate, explicitly\" and \"...a fluency-2 Wilmsry vs Magical is refused...\" (both passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The applyAction dispatcher-path exhausted probe (PARLEY-02/D-05) yields exactly [{type:\"parleyExhausted\"}] with an unchanged rngState via the real rng, and a successful parley leaves nothing to retry"
    requirement: PARLEY-02
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"PARLEY-02 / D-05: through applyAction...\" (passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "parleyInsulted widens both the member and hero foeTurn branches by exactly +1 (need/mNeed, never the roll), persists across rounds, and dies with endCombat (PARLEY-02/D-06/D-20)"
    requirement: PARLEY-02
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"...parleyInsulted widens the MEMBER branch...\" and \"...the insult, which persists every round...\" (both passing)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Con Artist need is 13/12 at even/one-level-up, the D-08 clamp lands exactly at 17 for bonus 8 and clamps 21->17 for bonus 12, and 18 vs need 17 still fails (PARLEY-03/D-07/D-08)"
    requirement: PARLEY-03
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"PARLEY-03 / D-07\" and \"PARLEY-03 / D-08\" tests (both passing)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Bard vs Humans reads need 9/11/11/13 and fluency 0/1/1/2 across skill-alone/Helm-alone/both, and the classic mazeworld.html canParley/fluency mirror agrees with the engine on all 576 matrix cases plus parleyTried/no-combat (LANG-01/D-10, D-17)"
    requirement: "LANG-01, LANG-02"
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"LANG-01 / D-10\" test; test/unit/parley-button-mirror.test.js (3 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Payout is round(Sigma killSpFor x 0.5) over live foes in foe order (33 for a two-foe example, 8 for a mixed alive/dead pair), the property share<=combatEquivalent holds for every race x sub x level x roll singly and summed, the Humans wilmst check fires only on a 6, and countingRng pins the exact draw shape including the seed-303 re-measurement (PARLEY-01/D-01/D-02/D-03/D-04, D-21)"
    requirement: PARLEY-01
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js tests 10-14 (all passing)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Mid-fight parleyTried/parleyInsulted round-trip losslessly through JSON but are dropped with the combat on validateSave/rehydrate — no save-migration work needed (D-19)"
    requirement: PARLEY-02
    verification:
      - kind: unit
        ref: "test/unit/parley.test.js \"D-19 old-save probe...\" (passing)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The FIXTURE-INVENTORY.md Phase 20 section and docs/PARLEY-REBALANCE.md's AFTER readout/Comparison hold measured (not computed) numbers, and the phase gate (full npm test, parity, frozen files) is green"
    requirement: "PARLEY-01, PARLEY-03"
    verification:
      - kind: integration
        ref: "npm test (911/911); node --test \"test/parity/**/*.test.js\" (30/30); node --test test/parity/fixture-inventory.test.js (5/5); git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/unit/foe-turn-draw-count.test.js engine/difficulty.js content package.json package-lock.json (exit 0)"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-14
status: complete
---

# Phase 20 Plan 03: Parley Proof (Behavioural Suite, UI Mirror, Divergence Ledger, Phase Gate) Summary

**Closes Phase 20 with proof: an independently-oracled 576-case availability matrix, every canParley gate individually asserted (including the now-reachable Wilmsry-vs-Magical refusal), the classic mazeworld.html canParley/fluency mirror machine-checked against the engine, the seed-303 divergence re-measured live and documented (need 19→17, sp 13→7, gold 250→50, draws 4→3), the tune-difficulty AFTER readout (attempts 151→97, success 57.6%→60.8%, SP share 3.7%→2.3%), and the full phase gate green (npm test 911/911, parity 30/30, every frozen file untouched).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-14
- **Tasks:** 3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `test/unit/parley.test.js` (15 tests): the LANG-02/D-11 availability matrix over all 576 race x sub x skill x Helm x type combinations, checked against `expectedCanParley` — an INDEPENDENT prose restatement of D-11/D-12 that never calls `canParley` — with aggregate counts confirming Magical=24, Walking Dead=0, plain-Human-Soldier=0; every PARLEY-04/D-12 gate asserted explicitly, including the reachable Wilmsry-vs-Magical refusal (proven to draw nothing, leave `parleyTried` undefined, and refuse — not exhaust — on a second call); the `applyAction` dispatcher-path exhausted probe (PARLEY-02/D-05) through the real rng; the `parleyInsulted` member-branch `+1` and its round-to-round persistence (D-06/D-20); Con Artist odds (need 13/12) and the D-08 clamp (17 active/inactive, 18 still fails); the fluency bonus term (LANG-01/D-10, need 9/11/11/13); the `killSpFor x0.5` payout (33 for a two-foe example) and its `<=` property across every race/sub/level/roll; the Humans wilmst check firing only on a natural 6 (D-03/D-04); a `countingRng` draw-shape pin; the seed-303 pin re-measured LIVE against `newRun(303)` (D-21: draws `d20=2,d6=5,d6=5`, need 17, sp 7, gold 50, no fourth draw); and a save/load round-trip proving the two new combat flags never survive a reload (D-19).
- Created `test/unit/parley-button-mirror.test.js` (3 tests): extracts mazeworld.html's LIVE classic `fluency()`/`canParley()` pair with `fs.readFileSync` + regex (mirroring `test/unit/foe-effect-chip.test.js`'s source-read pattern), builds it with `new Function("S","skill","eff","TALKATIVE", ...)`, and replays the SAME 576-case matrix plus the `parleyTried`/no-combat cases through it against `engine/combat.js#canParley` — zero disagreements. Source pins confirm the classic gate literally contains `if (C.parleyTried) return false;`, the `flu < 2` Magical gate, and the fluency-2 `talkable` widening. A manual (uncommitted) tripwire — patching a scratch copy's `flu < 2` to `flu < 1` — confirmed the mechanism genuinely catches drift (classic returned `true`, engine `false` on the affected Magical rows).
- Appended `## Phase 20 parley divergence` to `test/parity/FIXTURE-INVENTORY.md` (D-13/D-21, outside the generated block, append-only — zero lines removed from the pre-existing content): the re-measured before/after table for the one parity-exposed parley (need 19→17, sp 13→7, gold 250→50, draws 4→3, first three dice unchanged), the `stripParleyDivergence` carve-out rationale at both replay sites, a "why the draw count changed" note (Pitfall 5), a "flags never visible here" note (the success path nulls `state.combat` before comparison, making the flag strip purely defensive for this fixture), and a "byte-identical elsewhere" statement. `test/parity/fixture-inventory.test.js` stayed green (roster pin, generated-block markers untouched).
- Filled `docs/PARLEY-REBALANCE.md`'s `## tune-difficulty AFTER` section with the verbatim 200-seed transcript measured against the landed engine (background run, `EXIT=0`) and its `## Comparison` section (informational per D-15/D-16): attempts dropped 151→97 (the one-attempt cap removing the old unlimited-retry loop), success rate held at 57.6%→60.8% (within noise, consistent with the documented ~60-65% Con Artist target), and SP-from-parley share fell 3.7%→2.3% (the expected consequence of the structural half-of-kill payout). Both readouts explicitly frame the numbers as informational, not a gate — Phase 21 owns the retune.
- Ran the phase gate: `npm test` 911/911 passing (~11s), `node --test "test/parity/**/*.test.js"` 30/30, `node --test test/parity/fixture-inventory.test.js` 5/5, and confirmed every frozen file (`test/parity/prototype-master.js.txt`, `test/parity/fixtures`, `test/unit/foe-turn-draw-count.test.js`, `engine/difficulty.js`, `content/`, `package.json`, `package-lock.json`) unchanged since commit `04eb229`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test/unit/parley.test.js** - `dc86b79` (test)
2. **Task 2: Create test/unit/parley-button-mirror.test.js** - `2e8ae41` (test)
3. **Task 3: FIXTURE-INVENTORY.md divergence table + PARLEY-REBALANCE.md AFTER readout + phase gate** - `7ae9015` (docs)

_Note: no TDD tasks in this plan._

## Files Created/Modified

- `test/unit/parley.test.js` - new, 15 tests (Task 1)
- `test/unit/parley-button-mirror.test.js` - new, 3 tests (Task 2)
- `test/parity/FIXTURE-INVENTORY.md` - appended `## Phase 20 parley divergence` section (Task 3)
- `docs/PARLEY-REBALANCE.md` - filled AFTER readout + Comparison, replaced the `_Pending` placeholders (Task 3)

## Decisions Made

- `expectedCanParley` (the LANG-02 oracle) was written as a prose restatement of D-11/D-12's bullets from CONTEXT.md, then verified against all 576 live engine cases to confirm 0 mismatches and the exact aggregate counts (24/0/0) the must_haves demand — it does not read or call `canParley`'s implementation.
- The D-03/D-04 wilmst-check test needed `floor.depth = 3` (not the fixture default of 1) to reproduce the plan's own pinned `+1200` amount; overridden per-test rather than changed in the shared `fixedFloor` default, to avoid perturbing every other test's `need`/payout numbers.
- Two acceptance-criteria greps (`need, 13` and `need, 11` each needing >= 2 literal occurrences) required adding a second, explicit literal-number assertion beyond the test's natural flow — the underlying behavior was already correctly asserted via the returned event object; the extra assertion is a restatement, not new coverage.
- `test/parity/FIXTURE-INVENTORY.md`'s gold row reads `250 (starting 50 + wilmst 200)` / `50 (...)` rather than a bare `250 → 50`, because 250 was never itself a formula output (it's starting-gold-plus-payout) — a standalone headline sentence separately states the literal `250 → 50` transition so the acceptance grep and the factually-accurate table both hold.
- `docs/PARLEY-REBALANCE.md`'s AFTER readout is the verbatim, single background `node tools/tune-difficulty.mjs --seeds=200` run (polled via bounded ≤120s checks, per the 18-06/20-01 precedent) — not re-run, since the engine was confirmed already diverged from `04eb229` at the start of Task 3 and confirmed unchanged (via the frozen-file `git diff --quiet` checks) at the end.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep, unit test, parity suite run, and `git diff --quiet` frozen-file check passed after one small self-correction (the wilmst-check test's floor depth, caught immediately by the first `node --test` run and fixed before committing Task 1).

## Issues Encountered

None. `.planning/REQUIREMENTS.md`'s PARLEY-01..04/LANG-01/02 checkboxes were already marked complete by 20-02's own SUMMARY (confirmed via `git log -- .planning/REQUIREMENTS.md`), so no `requirements mark-complete` call was needed in this plan.

## User Setup Required

None - no external service configuration required.

## Verification Evidence

- `node --test test/unit/parley.test.js test/unit/combat.test.js test/unit/fluency.test.js test/unit/foe-turn-draw-count.test.js`: **142/142** passing.
- `node --test test/unit/parley-button-mirror.test.js test/unit/foe-effect-chip.test.js`: **7/7** passing.
- `node --test test/parity/fixture-inventory.test.js`: **5/5** passing (roster pin + generated-block markers untouched).
- `npm test`: **911/911** passing (~11s) — 893 baseline (post-20-02) + 15 (`parley.test.js`) + 3 (`parley-button-mirror.test.js`).
- `node --test "test/parity/**/*.test.js"`: **30/30** passing.
- `git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/unit/foe-turn-draw-count.test.js engine/difficulty.js content package.json package-lock.json` exits 0.
- `git diff 04eb229 -- test/parity/FIXTURE-INVENTORY.md | grep '^-' | grep -v '^---' | wc -l` prints 0 (append-only).

## Known Stubs

None.

## Threat Flags

None — this plan added only tests and documentation; no new network endpoints, auth paths, file-access patterns, or schema changes.

## Next Phase Readiness

Phase 20 (Parley Balance & Language System) is complete: PARLEY-01..04 and LANG-01/02 are all implemented (20-02), proven by an exhaustive behavioural suite and a UI-mirror guard (20-03), and documented with measured (not computed) before/after numbers in both `test/parity/FIXTURE-INVENTORY.md` and `docs/PARLEY-REBALANCE.md`. `npm test` is green at 911/911; parity remains byte-identical to `04eb229` outside the one named, documented, scenario-scoped seed-303 carve-out. Phase 21 (Consolidated Difficulty Retune) can now fold this phase's readout signal (fewer, lower-value, capped-per-encounter parleys) into the ONE consolidated retune alongside every other v1.1 power-changing milestone.

---
*Phase: 20-parley-balance-language-system*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: test/unit/parley.test.js
- FOUND: test/unit/parley-button-mirror.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: docs/PARLEY-REBALANCE.md
- FOUND: .planning/phases/20-parley-balance-language-system/20-03-SUMMARY.md
- FOUND commit: dc86b79
- FOUND commit: 2e8ae41
- FOUND commit: 7ae9015
