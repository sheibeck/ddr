---
phase: 22-class-aware-harness-before-matrix
plan: 01
subsystem: engine
tags: [chargen, determinism, harness, dev-only, testing]

requires: []
provides:
  - "engine/character.js#rollCharacter(rng, exclude, force) — dev-only draw-result substitution for class/sub/race"
  - "engine/state.js#newRun(seed, exclude, { startDepth, force }) forwarding force"
  - "test/determinism/forced-chargen.test.js — HARN-01 acceptance proof"
affects: [22-02, 22-03, 22-04]

tech-stack:
  added: []
  patterns:
    - "dev-only options-object seam on newRun (force alongside startDepth), default-null, never flips dev, no new serialized field"
    - "normalizeForce: canonical-key-only validator that infers cls from sub and rejects canon-impossible combos before the reroll loop"

key-files:
  created:
    - test/determinism/forced-chargen.test.js
  modified:
    - engine/character.js
    - engine/state.js

key-decisions:
  - "normalizeForce lives as a module-private function in engine/character.js, called at the top of rollCharacter; it resolves partial force (sub-only) by inferring cls from CLASSES[cls].subs membership"
  - "A second guard (sub-forced + race-natural-Fridgian) sits before the existing reroll while-loop so a forced sub can never be silently overwritten by the canon reroll"
  - "Three pinned seeds (one per class) found by scanning PAIRED(400) at authoring time: 7920 -> Magic User/Court Mage/Dwarven, 23758 -> Fighter/Master of Arms/Human, 31677 -> Thief/Cutthroat/Elven"

requirements-completed: [HARN-01]

coverage:
  - id: D1
    description: "rollCharacter/newRun accept a dev-only force option that substitutes class/sub/race draw RESULTS while still consuming the draws, so forcing a seed's own natural combo is byte-identical to the natural roll"
    requirement: "HARN-01"
    verification:
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: byte-identity, pinned seeds (one per class)"
        status: pass
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: byte-identity, sweep over PAIRED(80) (skipping Fridgian Fighters)"
        status: pass
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: draw-count parity — forced-with-its-own-combo consumes the same draws as natural"
        status: pass
    human_judgment: false
  - id: D2
    description: "Default newRun path (force omitted/null/{}) stays byte-identical to every parity fixture; zero comparables carve-out needed"
    requirement: "HARN-01"
    verification:
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: default path (force undefined/null/{}) stays byte-identical"
        status: pass
      - kind: unit
        ref: "test/parity/**/*.test.js (30/30 passing, git diff --quiet on harness/comparables.js, prototype-master.js.txt, fixtures)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid force keys/values and the canon-impossible Fridgian Samurai throw clear errors naming the valid keys, including the sub-forced/race-natural-Fridgian case caught before the reroll loop"
    requirement: "HARN-01"
    verification:
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: rejection — forced Fridgian Samurai throws (both fully-forced spellings)"
        status: pass
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: unknown/mismatched names throw with the valid keys listed"
        status: pass
      - kind: unit
        ref: "test/determinism/forced-chargen.test.js#HARN-01: forced Samurai against a naturally-rolled Fridgian throws, but a forced race rescues it"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-14
status: complete
---

# Phase 22 Plan 01: Dev-Only Force Option & Determinism Proof Summary

**Added a dev-only `force` option to `rollCharacter`/`newRun` that substitutes class/sub/race draw results while still consuming the draws, proven byte-identical to the natural roll by a 9-test determinism suite; the full 960-test suite (951 baseline + 9 new) stays green with zero parity carve-outs.**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-09-14
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- `engine/character.js#rollCharacter(rng, exclude, force)` gained a `normalizeForce` validator (canonical-key-only, infers `cls` from `sub`, rejects Fridgian+Samurai) and now substitutes the RESULTS of the class d6 / sub d8 / race d8 draws while still consuming them, so every later chargen draw sits at the identical rng cursor.
- `engine/state.js#newRun(seed, exclude, { startDepth, force })` forwards `force` unchanged to `rollCharacter` as a second dev-only option alongside `startDepth`; `dev` semantics are untouched by `force`.
- `test/determinism/forced-chargen.test.js` proves: byte-identity (pinned seeds + an 80-seed sweep, skipping the Fridgian-Fighter reroll edge case), default-path invariance, countingRng draw-count parity, an exhaustive 143-combo smoke test with no new serialized field, and every rejection/error path (Fridgian Samurai both-forced and sub-forced/race-natural, unknown/mismatched names, non-string values).
- Full `npm test` run: 960/960 passing (951 baseline + 9 new HARN-01 tests); parity suite (30/30) untouched with `git diff --quiet` on `test/parity/harness/comparables.js`, `test/parity/prototype-master.js.txt`, and `test/parity/fixtures`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the dev-only force option to rollCharacter and newRun** - `04e6e1f` (feat)
2. **Task 2: Write the forced-chargen determinism test (HARN-01 acceptance)** - `5f91178` (test)

_No TDD gating on this plan (`tdd` not set on either task); both tasks are single-commit._

## Files Created/Modified

- `engine/character.js` - added `normalizeForce(force)` validator and threaded `force` through `rollCharacter`'s three draws plus a pre-reroll-loop guard for the sub-forced/race-natural-Fridgian case
- `engine/state.js` - `newRun`'s options object gained `force = null`, forwarded to `rollCharacter` as its third argument; JSDoc extended
- `test/determinism/forced-chargen.test.js` - new HARN-01 acceptance suite (9 tests)

## Decisions Made

- Pinned the three byte-identity seeds by an authoring-time scan over `PAIRED(400)` rather than guessing: seed 7920 (Magic User/Court Mage/Dwarven), 23758 (Fighter/Master of Arms/Human), 31677 (Thief/Cutthroat/Elven).
- `normalizeForce` infers `cls` from `sub` when `cls` is omitted by finding the unique class whose `subs` array contains the given `sub` name; this makes `{ force: { sub: "Summoner" } }` resolve to `Magic User` automatically, matching the plan's partial-force contract.
- The Fridgian+Samurai rejection lives in two places by design: `normalizeForce` catches the both-forced spelling before any draws happen; a second guard inside `rollCharacter` (after the race draw, before the existing reroll `while` loop) catches the sub-forced/race-natural-Fridgian case, so a forced sub can never be silently overwritten by the canon reroll.
- Draw-count parity was measured directly (via `countingRng`), not assumed: seed 7920 draws 44 (natural and forced identical), 23758 draws 20, 31677 draws 17 — all with matching post-chargen rng cursors.

## Deviations from Plan

None — plan executed exactly as written. One micro-adjustment during self-verification: the first draft of `engine/state.js`'s JSDoc literally repeated the call-site string `rollCharacter(rng, exclude, force)`, which pushed `grep -c "rollCharacter(rng, exclude, force)" engine/state.js` to 2 instead of the plan's required exactly-1; reworded the JSDoc sentence to describe the forwarding without repeating the literal call text. This is a same-task correction, not a new deviation category.

## Issues Encountered

- `node --test test/parity/` (bare directory argument) fails to resolve as a module on this Windows/Git Bash setup — used the project's own glob convention (`node --test "test/parity/**/*.test.js"`, matching `package.json`'s `test:quick` script) instead, which the plan's verification line itself uses elsewhere in the codebase's precedent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `force` seam is ready for Plan 22-02 (`tools/lib/tuning-bot.mjs#playRun` will thread `opts.force` straight through to `newRun`) and Plan 22-03 (`tools/tune-classes.mjs`'s CLI will do friendly name resolution down to these canonical keys via `resolveForce`).
- No blockers. Parity suite, newRun/character unit tests, and the full 960-test suite are all green with zero carve-outs — the Engine Gate holds.

---
*Phase: 22-class-aware-harness-before-matrix*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: engine/character.js
- FOUND: engine/state.js
- FOUND: test/determinism/forced-chargen.test.js
- FOUND: SUMMARY.md
- FOUND commit: 04e6e1f
- FOUND commit: 5f91178
