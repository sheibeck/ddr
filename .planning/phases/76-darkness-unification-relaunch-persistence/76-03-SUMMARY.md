---
phase: 76-darkness-unification-relaunch-persistence
plan: 03
subsystem: engine/save-load
status: complete
tags: [persistence, save, relaunch, SAV-06, SAV-07, tolerant-load]
requires: []
provides:
  - "engine/saveState.js: sanitizeCombat / sanitizeStore / sanitizePendingFind / sanitizePendingHazard / sanitizePendingTile / sanitizePendingJoiner, resumedSubState, resumeEventsFor"
  - "fightResumed / storeResumed Oracle lines (ORACLE_ONLY)"
affects:
  - "76-04 (takeBootResumeEvents in the adapter consumes resumeEventsFor)"
  - "76-05 (the Oracle resume line at boot; FIXTURE-INVENTORY persistence subsection)"
  - "Phase 77 effect indicators read the rehydrated c.foeEffect / rounds timers of a resumed fight"
tech-stack:
  added: []
  patterns:
    - "wholesale tolerant carry: a sanitizer returns the raw object or null, never copies or deletes keys"
    - "fight-conditional hero-side clears (clearFoeEffect/clearStaleTimers take fightSurvives)"
key-files:
  created:
    - test/unit/save-resume.test.js
  modified:
    - engine/saveState.js
    - engine/state.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/persistence/resume-mid-encounter.test.js
    - test/unit/pending-tile.test.js
    - test/unit/tools.test.js
    - test/unit/effects.test.js
    - test/unit/loot-pile.test.js
    - test/unit/carry-model.test.js
    - test/unit/parley.test.js
    - test/unit/harness/rollHighBaseline.js
decisions:
  - "A relaunch resumes a validated fight, store, find, hazard decision, pending tile and Joiner offer wholesale; an invalid one loads as null and the rest of the save loads as before (SAV-06/SAV-07, declared canon divergence from the 1994 load)"
  - "A fight and a store both valid: the fight wins, the store is dropped"
  - "A stored fight with allies is dropped when the tolerant party load dropped any member"
  - "pendingFoes entries must each carry a sound foe (validation-depth discretion: foeTurn pushes p.foe straight into foes)"
metrics:
  duration: "~35 min"
  completed: 2026-09-26
  tasks: 2
  files: 13
---

# Phase 76 Plan 03: Relaunch Persistence Summary

With this plan, a relaunch keeps a live fight, an open store, a pending find, a pending hazard decision, a pending tile and a pending Joiner offer. Each one is validated on load and carried over whole, with its original fields untouched. One that fails validation is dropped and the rest of the save loads as it did before, so force-closing the app no longer gets a player out of a fight.

**Plan base:** `e090d1daba0ac7726851ec796792b8a9ca34d59a`

## What was built

### Task 1: validation and carry-through (engine/saveState.js)
- New sanitizers: `sanitizeCombat(raw, party, partyIntact)`, `sanitizeStore(raw)`, `sanitizePendingFind`, `sanitizePendingHazard(raw, floor)`, `sanitizePendingTile(raw, floor)` and `sanitizePendingJoiner`. Each returns either the raw object itself or `null`, and none of them throws. They follow the rules in the plan's must-haves.
- `resumedSubState(obj, combat, floor)` is the one builder both load chains use. It returns `{ combat, store, pendingFind, pendingHazard, pendingTile }`, plus `pendingJoiner` only when the save has that key. A fight that survives drops the store.
- `validateSave` and `rehydrate` now settle the party and the resumed fight before running the `c` chain, so that chain knows whether a fight survived. The rest of the chain runs in its original order. The floor is computed before the value/state literal, so the hazard and tile checks read the same sanitized floor.
- `clearFoeEffect(c, fightSurvives)`: when the fight survives, a genuine `{ kind: string, rounds: number }` is kept and anything else is nulled. Without a surviving fight it behaves as before.
- `clearStaleTimers(c, fightSurvives)`: a tampered timers value is always dropped. Rounds-cadence records are kept when the fight survives and cleared otherwise.
- `beats` is always null after a load. There is no STATE_VERSION bump, and the load never advances the rng (`rngState` is copied as-is).
- The stale reset-on-load comments are rewritten in saveState.js (helpers, value/state literals, rehydrate's JSDoc, the RULES-12 handoff) and in engine/state.js (newRun's party, pendingFind, pendingHazard, pendingTile and pendingLoot notes).

### Task 2: narration, flipped pins, measurement
- `fightResumed` and `storeResumed` get EVENT_NARRATION entries and are in ORACLE_ONLY (the fight and store screens are where the player sees them; no rail card).
- `test/persistence/resume-mid-encounter.test.js`: the header is rewritten with a pointer to Phase 76 (SAV-06/SAV-07). Cases (a) and (b) are flipped, and (a) now also shows that a move after the relaunch is refused.
- Every other test that pinned reset-on-load is flipped (listed below). `rollHighBaseline.js` comments are reworded; the EXTRA_VOLATILE_FIELDS entries are unchanged.

## Resume-line copy (for 76-05)

| Event | Condition | Line |
|---|---|---|
| `fightResumed` | `pending: true` | "They waited. Monsters can be very patient." |
| `fightResumed` | fight under way | "Still here. Still fighting. Round N, where you left it." (the round clause appears only when `round` is an integer) |
| `storeResumed` | always | "The shopkeeper has not moved. Neither have the prices." |

All three are `<span class="beat">` lines. They pass the voice safety scan.

## Note for 76-04: resumeEventsFor

```js
import { resumeEventsFor } from "../../engine/saveState.js";
resumeEventsFor(state) // pure, zero rng, never mutates
// live combat -> [{ type: "fightResumed", round: <C.round>, pending: <!!C.pending>, foes: <living foe count> }]
// open store  -> [{ type: "storeResumed" }]
// otherwise   -> []
```
Call it on the state that `boot()` rehydrated. The combat branch takes precedence over the store branch, although the loader already guarantees the two never coexist after a load.

## Measurement

- **Parity:** `node --test "test/parity/**/*.test.js"` passes 62/62. `git diff --quiet e090d1d -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` exits 0. No fixture edits and no comparable carve-outs were needed.
- **npm test:** 6,715 / 6,715 pass, 0 fail. That is the 6,697 at dispatch plus 18 new tests.
- **Coverage guards:** formatEventsCoverage, narrationLinesTable and the voice safety-scan all pass.
- **Bot readouts:** none, per the user ruling of 2026-09-26. No tools/readouts files were created.
- No state pins, fixtures or shell snapshots moved.

## Flipped pins (for 76-05's FIXTURE-INVENTORY subsection)

| File | Test (new name) | Old assertion | New assertion |
|---|---|---|---|
| test/persistence/resume-mid-encounter.test.js | (a) SAV-06 (Phase 76): relaunch mid-combat ... | `booted.combat === null` | `booted.combat` deep-equals the saved combat; a post-relaunch `move` is refused (combat still up, px/py unchanged) |
| test/persistence/resume-mid-encounter.test.js | (b) SAV-07 (Phase 76): relaunch mid-store ... | `booted.store === null` | `booted.store` deep-equals the saved store |
| test/unit/pending-tile.test.js | SAV-06 (Phase 76): validateSave/rehydrate keep a saved pendingTile on the current floor, and drop one from another floor | `pendingTile === null` | `{x:3,y:3,depth:1}` survives both chains; `depth: 2` loads null |
| test/unit/tools.test.js | newRun/validateSave/rehydrate: pendingHazard starts null; one inconsistent with the floor loads as null | "always null" | kept as the drop case, with a precondition that the E neighbour is not a climb |
| test/unit/tools.test.js | SAV-06 (Phase 76): a pendingHazard matching its neighbour cell survives ... (new) | none | a matching hazard survives both chains |
| test/unit/effects.test.js | SAV-06 (Phase 76): with a surviving fight, rehydrate/validateSave keep the rounds record too (new) | none | the rounds and squares records both survive with a fight; a tampered map is still dropped |
| test/unit/loot-pile.test.js | SAV-06 (Phase 76): a pending find and the loot pile both survive the load | `pendingFind === null` | pendingFind deep-equals the saved find |
| test/unit/carry-model.test.js | serialization round-trip preserves c.bag and a null pendingFind | message "reset to null on rehydrate" | same assertion (a null find), reworded |
| test/unit/carry-model.test.js | SAV-06 (Phase 76): a valid pendingFind survives rehydrate; a nameless one loads as null | `pendingFind === null` | the valid find survives; a nameless find loads null |
| test/unit/parley.test.js | D-19 old-save probe: ... survive with the combat on load | `rehydrated.combat === null` | the combat survives with `parleyTried` and `parleyInsulted` true |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] pendingFoes entries are validated too**
- **Found during:** Task 1
- **Issue:** The must-haves only required `pendingFoes` to be absent, null or an array. But `foeTurn` pushes each `p.foe` straight into `C.foes` and reads `p.foe.name`, so a malformed entry would throw on the next action. The adapter's catch would then replace the whole run (T-76-01).
- **Fix:** every `pendingFoes` entry must be a plain object carrying a foe that passes the same check the foes do (string name, finite wp/maxWP, boolean alive). This falls within the validation depth CONTEXT leaves to Claude's discretion.
- **Files modified:** engine/saveState.js
- **Commit:** 358e7491

**2. [Rule 3 - Test setup] test fixtures adjusted to real engine limits**
- **Found during:** Task 1 GREEN
- **Issue:** `PARTY_CAP` is 1, and `clampCarry` caps gold at load. So the test's two-member party and its 5,000 gold did not match any real state.
- **Fix:** the "dropped member" case now prepends a `null` to a one-member party, which proves the `partyIntact` rule on its own (partyIdx 0 still indexes the surviving member). The store test's gold was lowered to 1,000.
- **Files modified:** test/unit/save-resume.test.js
- **Commit:** 358e7491

Orchestrator override applied: no bot balance runs and no readouts (the user ruling of 2026-09-26). This plan itself had no readout step.

## TDD Gate Compliance

RED `cab4a3ed` test(76-03) failed as expected: `resumeEventsFor` was not exported. GREEN `358e7491` feat(76-03) came after it. No refactor commit was needed.

## Threat surface

No new surface beyond the plan's threat model. The mitigations are in place: T-76-01 (the sanitizers check every field the next action reads) and T-76-03 (a tampered foeEffect or timers value is neutralised with or without a fight).

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: test/unit/save-resume.test.js
- FOUND: engine/saveState.js exports resumeEventsFor
- FOUND commits: cab4a3ed, 358e7491, ab707c5e
