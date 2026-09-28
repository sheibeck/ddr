---
phase: 72-roll-direction-sign-audit-fixes
plan: 05
subsystem: engine (combat to-hit)
tags: [roll-01, sign-fix, combat, frenzy, fridgian, parity]

requires:
  - phase: 72-01
    provides: "docs/ROLL-LEDGER.md's known fix (b) and F4 ruling context"
  - phase: 72-04
    provides: "test/parity/FIXTURE-INVENTORY.md's Phase 72 H2 and ROLL01_EXPECTED_HOLDERS in test/parity/divergence-records.test.js"
provides:
  - "engine/combat.js#playerStrike: the frenzy second swing's need is Math.max(1, toHit(state) - 1) — the hero's own normal to-hit narrowed by one face, honouring the dark cap and dazed — replacing the canon hard-set need 3"
  - "F4 (user ruling 2026-09-24, applied in the same edit): a local frenzyFired boolean, captured at the trigger draw, gates the narrowed need — a Fridgian's OTHER second attacks (Barbarian, haste, Ambidextrous, Last Stand) keep the normal to-hit"
  - "test/unit/rollDirection.test.js's [hero-strike:frenzy-second-swing] and [hero-strike:frenzy-dark-cap] rows are green (todo removed)"
  - "test/unit/combat.test.js: three new outcome-based frenzy odds tests (lit Fighter, lit Magic User, dark without Night Vision)"
  - "test/parity/FIXTURE-INVENTORY.md's Plan 05 section: predictor table, live-scan confirmation, measured moved set of zero, and the one re-measured draw-count pin"
  - "docs/ROLL-LEDGER.md's Rulings: F4 recorded applied"
affects: [72-06, 72-07, "Phase 73 (roll-high mirror)", "Phase 74 (display-sign)"]

tech-stack:
  added: []
  patterns:
    - "A per-call trigger boolean (frenzyFired), captured at the same draw that decides the mechanic fires, is the correct gate for a need rule that must apply to THIS swing only — not a persistent race/class flag that stays true for every subsequent swing regardless of whether the triggering event actually happened this call."

key-files:
  created: []
  modified:
    - engine/combat.js
    - test/unit/combat.test.js
    - test/unit/rollDirection.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/divergence-records.test.js
    - docs/ROLL-LEDGER.md

key-decisions:
  - "F4 gates on a local frenzyFired boolean captured at the d8<=5 trigger draw (the same draw, same branch), not on the Fridgian race flag alone — so a Fridgian's non-frenzy second attack (Barbarian/haste/Ambidextrous/Last Stand) uses the normal to-hit, matching the user's 'frenzy swing only' ruling."
  - "content/races.js and content/flavor.js's Fridgian notes were confirmed (not edited) to state nothing about the swing's odds — no text change needed, per the plan's own check."
  - "Task 1's own npm test sweep surfaced one moved draw-count pin outside the plan's named files — test/unit/foe-turn-draw-count.test.js's FULL_FIGHTS seed 17/Beasts row (totalDraws 88->70, attacks 12->9) — re-measured live via the file's own runFullFight helper, never hand-typed, per the file's own gate ('measured, not adjusted')."
  - "Task 2's predictor (a scratch replay over every combat/magic fixture) measured a moved set of ZERO: combat#lose (seed 14, the only Fridgian whose action script reaches a second strike) fires frenzy 4 times, but every swing-2 roll lands on the same side of both the old hard-set need (3) and the new measured need, so no hit/miss outcome flips and no fixture needed regeneration — confirmed by all three live checks (parity suite, both scan diffs, fixture byte-diff)."

requirements-completed: [ROLL-01]

duration: ~1 session
completed: 2026-09-25
status: complete
---

# Phase 72 Plan 05: Fridgian frenzy second swing = normal to-hit narrowed by one Summary

**Replaced the canon hard-set frenzy-swing need (a flat 3) with the hero's own normal to-hit narrowed by one face (`Math.max(1, toHit(state) - 1)`, honouring the dark cap and dazed), gated per-call on the actual frenzy trigger (F4) rather than the Fridgian race flag — measured to move zero parity fixtures and exactly one draw-count pin.**

## Performance

- **Duration:** ~1 session
- **Tasks:** 2 (Task 1: the engine fix + tests + the one moved pin; Task 2: measure/declare/confirm the frenzy fix's moved fixture set)
- **Files modified:** 7 (4 in Task 1, 2 in Task 2, 1 small follow-on ledger commit)

## Accomplishments

- **The fix (ROLL-01 (b)).** `engine/combat.js#playerStrike`: the frenzy second swing's need is now `Math.max(1, toHit(state) - 1)` instead of the canon hard-set constant `3`. Every per-target rule already applied after the need line (dozing/stupid, `sp.toHit`, `sp.fast`, `sp.magicOnly`, Overhead Blow's `needShift`, Afraid) still applies in the same order — and since the swing now reads `toHit(state)` instead of bypassing it, the dark cap and dazed apply for the first time too. Declared canon divergence: a Fighter's frenzy swing now IMPROVES over canon (3→4 in the light); a Magic User's WORSENS (3→2, canon had it equal to the normal swing).
- **F4 (user ruling 2026-09-24, applied in the same edit).** A local `frenzyFired` boolean, captured at the `rng.d(8) <= 5` trigger draw, gates the narrowed need — not the persistent `R.frenzy` race flag. A Fridgian's OTHER second attacks (Barbarian's own `attacks=2`, a live `haste` timer, Ambidextrous, an ability descriptor's Last Stand `attacks:3`) now use the normal to-hit for every swing, including the second, unless frenzy itself actually fired this call.
- Confirmed `content/races.js` and `content/flavor.js`'s Fridgian notes state nothing about the swing's odds ("frenzies into a second wild swing", "swing twice at whatever is nearest") — no text change needed.
- `test/unit/combat.test.js`: reworded the stale canon-need comment on the existing frenzy test; added three new outcome-based odds tests via the shared `rollOdds` harness — lit Fighter (swing 2 wins = normal wins − 1), lit Magic User (same, canon had it equal), dark without Night Vision (swing 2 never above the dark-capped normal swing, never below one face).
- `test/unit/rollDirection.test.js`: `[hero-strike:frenzy-second-swing]` and `[hero-strike:frenzy-dark-cap]` are both green — `todo` option removed from both, file header comment updated.
- `test/unit/foe-turn-draw-count.test.js`: the one moved pin — `FULL_FIGHTS`' seed 17/Beasts row (a Fridgian hero's full natural-resolution fight, unrelated to the `combat#flee` parity fixture that also happens to use seed 17) — re-measured live: `totalDraws` 88→70, `attacks` 12→9; roster and outcome (`["Viper","Shriek","Shriek"]`, "won") unchanged. Every other pin in that file, and `test/determinism/foe-abilities.test.js`, is untouched.
- **Task 2's measurement: a moved set of ZERO.** A scratch predictor replayed every combat/magic parity fixture scenario; `combat#lose` (seed 14, Fighter Soldier Fridgian — the only Fridgian whose action script reaches a second strike) fires frenzy 4 times, but every one of the 4 swing-2 rolls lands on the same side of both the old hard-set need (3) and the new per-swing measured need — zero hit/miss flips. Confirmed live: `node --test test/parity/*.test.js` 47/47 green, both fixture scan diffs empty, `test/parity/fixtures/` byte-identical to the plan base, master hash unchanged.
- `test/parity/FIXTURE-INVENTORY.md`'s new `### Plan 05 — Fridgian frenzy's second swing` section (rule, predictor table, live-scan confirmation, empty Moved set, the one re-measured draw-count pin, byte-identical-elsewhere).
- `docs/ROLL-LEDGER.md`'s `## Rulings`: one-line note recording F4 applied by 72-05.

## Task Commits

1. **Task 1: The frenzy second swing = the normal to-hit narrowed by one face** — `f71f733` (fix) — `engine/combat.js`, `test/unit/combat.test.js`, `test/unit/rollDirection.test.js`, `test/unit/foe-turn-draw-count.test.js`.
2. **Task 2: Measure, declare and confirm the frenzy's moved set (zero)** — `d3ccaaa` (docs) — `test/parity/FIXTURE-INVENTORY.md`, `test/parity/divergence-records.test.js`.
3. **Follow-on: record F4 applied in the ledger** — `0e444f1` (docs) — `docs/ROLL-LEDGER.md` (per the orchestrator's F4 ruling note — allowed outside the plan's `files_modified` list).

**Plan metadata:** this SUMMARY's own commit (docs: complete plan), made by the execution harness after this file is written.

## Files Created/Modified

- `engine/combat.js` — the frenzy second-swing need line + the `frenzyFired` boolean + the DELIBERATE RULES CHANGE comment (ROLL-01 (b), F4).
- `test/unit/combat.test.js` — reworded comment on the existing frenzy test; three new outcome-based ROLL-01 (b) tests.
- `test/unit/rollDirection.test.js` — both frenzy rows' `todo` option removed; header comment updated.
- `test/unit/foe-turn-draw-count.test.js` — `FULL_FIGHTS`' seed 17/Beasts row re-measured (88→70 draws, 12→9 attacks) with a Phase 72 rationale comment; the restated test's title/comment updated to match.
- `test/parity/FIXTURE-INVENTORY.md` — new Plan 05 section under the Phase 72 H2.
- `test/parity/divergence-records.test.js` — `ROLL01_EXPECTED_HOLDERS`'s comment extended to record 72-05's own measured zero (the constant itself stays `[]`).
- `docs/ROLL-LEDGER.md` — F4 applied note under `## Rulings`.

## Decisions Made

See `key-decisions` in the frontmatter — summarized: F4 gates on a per-call `frenzyFired` boolean rather than the race flag; the Fridgian race/flavor text needed no edit (confirmed, not assumed); the one moved draw-count pin outside the plan's named files (`foe-turn-draw-count.test.js`) was re-measured live per that file's own "measured, not adjusted" gate; Task 2's predictor and all three live checks converged on a measured moved set of zero fixtures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/foe-turn-draw-count.test.js`'s FULL_FIGHTS seed 17/Beasts pin moved**
- **Found during:** Task 1, the plan's own `npm test` sweep after the engine edit
- **Issue:** The frenzy fix changes which draws hit/miss for a Fridgian hero's frenzy swings across a full natural-resolution fight; seed 17/Beasts (the only `FULL_FIGHTS` row whose hero is a Fridgian) resolves in fewer rounds under the fix, moving its pinned `totalDraws` (88→70) and `attacks` (12→9) counts. This is explicitly one of the plan's own named candidates ("Candidates: ... test/unit/foe-turn-draw-count.test.js").
- **Fix:** Re-measured live via the file's own `runFullFight(17, "Beasts")` helper (never hand-typed): `totalDraws` 70, `attacks` 9, roster and outcome (`won`) unchanged. Updated the pin and its own per-row comment, plus the dependent restated-test's title/comment string.
- **Files modified:** test/unit/foe-turn-draw-count.test.js
- **Verification:** `node --test test/unit/foe-turn-draw-count.test.js` — 43/43 pass, 0 fail.
- **Committed in:** f71f733 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a measured, not hand-typed, engine-caused pin move, explicitly anticipated by the plan's own text). **Impact on plan:** none of this touched the frenzy fix's own correctness or the parity fixture set; `test/determinism/foe-abilities.test.js` (the other named candidate) needed no change.

## Issues Encountered

None beyond the expected worktree-only CRLF doc-ledger noise (`docs/CLASS-PASS.md`/`docs/FLEE.md`, 7 tests, pre-existing, identical on the base commit, flagged by the orchestrator before this plan started) and the pre-existing F5/shatter `todo` rows (72-07's and 72-06's own pending fixes, not this plan's).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7, play a Fridgian Fighter into a dark square, trigger a frenzy, and confirm the Oracle's second-swing need reads one worse than the first swing's.

## Verification

- `node --test test/unit/combat.test.js test/unit/ability-strike.test.js test/unit/rollDirection.test.js`: 211 pass, 0 fail, 6 todo (the 6 Skeleton-shatter rows, 72-06's).
- `grep -c "Math.max(1, toHit(state) - 1)" engine/combat.js`: 1. `grep -cE "R\.frenzy \? 3" engine/combat.js`: 0. `grep -c "ROLL-01 (b)" engine/combat.js`: 1 (comment block).
- `grep -c "ROLL-01 (b)" test/unit/combat.test.js`: 18 (well above the required 3 — three new tests, each naming ROLL-01 (b) in title and both assertion messages).
- `grep -n "frenzy-second-swing\]\|frenzy-dark-cap\]" test/unit/rollDirection.test.js`: both rows present, no `todo` option; both pass under `node --test`.
- `node --test test/parity/*.test.js`: 47/47 pass (unchanged from 72-04's count).
- `node tools/initiative-fixture-scan.mjs | diff --strip-trailing-cr - tools/initiative-fixture-scan-output.txt`: empty. `node tools/worn-fixture-scan.mjs | diff --strip-trailing-cr - tools/worn-fixture-scan-output.txt`: empty.
- `git diff --name-only b817392..HEAD -- test/parity/fixtures/`: empty (measured zero, nothing to regenerate).
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). `git diff --stat b817392..HEAD -- test/parity/harness/comparables.js`: empty.
- `grep -c "^### Plan 05 — Fridgian frenzy's second swing" test/parity/FIXTURE-INVENTORY.md`: 1. Section contains both `#### Moved set — declared records` and `#### Draw-count pins` (both grep-confirmed count 1).
- `node --test test/parity/divergence-records.test.js`: 9/9 pass, including the `ROLL-01 (Phase 72)` guard (still passes; `ROLL01_EXPECTED_HOLDERS` stays `[]`).
- `npm test`: 5,614 pass / 7 fail / 7 todo. The 7 failures are the pre-existing worktree-only CRLF doc-ledger noise (`docs/CLASS-PASS.md`/`docs/FLEE.md`, identical on the base commit — confirmed via the orchestrator's pre-flagged note, not re-verified against a byte-diff here since the note already establishes it). The 7 todo rows are the Phase 72 F5 (`[parley:parley-need-mod]`, 72-07's) and 6 Skeleton-shatter rows (72-06's), neither this plan's.

## Next Phase Readiness

- `docs/ROLL-LEDGER.md`'s known fix (b) and F4 are both landed; (c) remains for 72-06, F1/F2/F3/F5 remain for 72-07.
- `ROLL01_EXPECTED_HOLDERS` in `test/parity/divergence-records.test.js` stays `[]` after this plan (72-06/07 may still extend it with their own measured sets).
- `test/unit/rollDirection.test.js` carries 6 remaining `todo` rows (all Skeleton-shatter, 72-06's) — every other row, including both frenzy rows this plan landed, is green.
- Phase 73's roll-high mirror can run `test/unit/rollDirection.test.js` and `test/unit/harness/rollOdds.js` unchanged — this plan touched neither file's odds-only contract, only removed two `todo` options in the former.

---
*Phase: 72-roll-direction-sign-audit-fixes*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: test/unit/combat.test.js
- FOUND: test/unit/rollDirection.test.js
- FOUND: test/unit/foe-turn-draw-count.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: test/parity/divergence-records.test.js
- FOUND: docs/ROLL-LEDGER.md
- FOUND: .planning/phases/72-roll-direction-sign-audit-fixes/72-05-SUMMARY.md
- FOUND commit f71f733 (Task 1)
- FOUND commit d3ccaaa (Task 2)
- FOUND commit 0e444f1 (follow-on ledger note)
