---
phase: 76-darkness-unification-relaunch-persistence
plan: 04
subsystem: browser-adapter/save-load
status: complete
tags: [persistence, relaunch, SAV-06, SAV-07, round-trip, determinism]
requires:
  - "76-03: resumeEventsFor and the wholesale resume of combat/store/pending fields in engine/saveState.js"
provides:
  - "src/browser/engineAdapter.js: takeBootResumeEvents() (one-shot, set on boot's rehydrate path, reset by initRun)"
  - "test/roundtrip/resume-roundtrip.test.js: the generic every-key-path relaunch walk, precision, resume determinism, non-vacuity and old-shape fight proofs"
  - "test/persistence/resume-mid-encounter.test.js: per-action save, relaunch every round, move refused, boundary, store purchase and Joiner proofs through the real adapter"
affects:
  - "76-05 (the Oracle resume line at boot reads takeBootResumeEvents(); its FIXTURE-INVENTORY persistence subsection should list the loader change below)"
tech-stack:
  added: []
  patterns:
    - "generic key-path diff (Object.is leaves) over live vs relaunched state; covers future fields with no edit"
    - "memoised corpus sweep; each test asserts one property of the same sweep"
key-files:
  created:
    - test/roundtrip/resume-roundtrip.test.js
  modified:
    - src/browser/engineAdapter.js
    - engine/saveState.js
    - test/unit/engineAdapter.test.js
    - test/persistence/resume-mid-encounter.test.js
decisions:
  - "A load clamps the bag's carry caps only when a legacy worn fold spilled a piece into the bag. A current save keeps an over-cap purse and rations exactly as saved (live play never clamps a gain)."
  - "Dead states are not part of the relaunch walk: a dead save relaunches to the roller and is never resumed, and its leftover in-fight hero effects are cleared on load by design"
metrics:
  duration: "~50 min"
  completed: 2026-09-26
  tasks: 2
  files: 5
---

# Phase 76 Plan 04: Relaunch Proof and Boot Resume Events Summary

The adapter now exposes a one-shot `takeBootResumeEvents()` for the shell's resume line. The real adapter is shown to save every round of a fight, and a relaunch after any round resumes the same fight on the same dice with movement still refused. A generic walk over key paths finds that every fight, store and pending decision in a 16-run bot corpus and in the parity scripts comes back from a relaunch unchanged. That walk also found a real loader bug, now fixed: every relaunch cut a purse that was over the bag's cap.

**Plan base:** `034d7ece29d3013251f7957e571364e54644dcb0`

## What was built

### Task 1: takeBootResumeEvents and the adapter relaunch proofs
- `src/browser/engineAdapter.js`: a module-level `bootResumeEvents` sits beside `bootWornReport`. `boot()` sets it from `resumeEventsFor(currentState)` on the rehydrate path only, `initRun()` resets it to null (so `startNewRun()` does too), and `takeBootResumeEvents()` returns it and nulls it. `persist` and `dispatch` are unchanged.
- `test/unit/engineAdapter.test.js`: 5 cases. No save gives null, and so does a corrupt-save fallback. A quiet save gives `[]`. A pending fight gives `[{type:"fightResumed", round:1, pending:true, foes:n}]` once and then null. An open store gives `[{type:"storeResumed"}]` once. `initRun` or `startNewRun` after a resumed fight leaves it null.
- `test/persistence/resume-mid-encounter.test.js`: 3 new cases through the real adapter with fake storage.
  - **Fight (seed 4254, a 7-attack fight whose killing blow drops a spoils pile):** after each dispatch (the encounter step, `fight`, and every `attack`) the flushed save's `combat` JSON-equals the live combat. A relaunch then gives the identical combat, `c.foeEffect` and `c.timers`, with `beats` null. A `move` after the relaunch is refused, and the fight stays up with the position unchanged. The relaunched run's combat also matches an unbroken reference fight at every step, and the hero ends identically.
  - **Boundaries:** the encounter step resumes with `pending` true at round 1. The killing blow saves `combat` null, so the relaunch shows the spoils pile and no fight.
  - **Store (seed 4246):** after a purchase and a relaunch, the line is still sold, the gold is still spent, and every other line and price is unchanged. A second relaunch gives the identical store.
  - **Joiner (seed 4247, built through the real meetJoiner):** the booted `pendingJoiner` deep-equals both the saved offer and the live one. Accept and decline each give the same next state and events from the live state and the booted one. Accepting through the adapter adds exactly that Joiner to the party.

### Task 2: test/roundtrip/resume-roundtrip.test.js (7 tests, ~19 s)
- `diffPaths(live, loaded)` names every key path where the two differ: a key on one side only, an array length, or a leaf that is not `Object.is`-equal. The load under test is `rehydrate(validateSave(JSON.stringify(serializeRun(state))).value)`. Both sides go through `stripVolatileFields` and nothing else is excluded.
- **Fixture sweep:** every scenario in the parity combat (6), magic (4), economy (1) and encounters (5) scripts, walked after every action.
- **Bot corpus and determinism probe:** for every resumable state, up to 150 per run, the walk runs first. Then the probe applies the same next action to the live and the loaded state, and the next state and events must match. The action is `fight` or `attack` in a fight, `leaveStore` in a store, `leaveFind` on a find, `move` in the hazard's direction on a hazard, `resolveJoiner` with `accept: false` on an offer, and a legal `move` for a pendingTile.
- **Precision:** every live `combat`, `store` and pending value, plus `rngState`, JSON round-trips `Object.is`-equal at every path.
- **Non-vacuity floors:** at least 50 fights, at least 1 with allies, at least 1 joined fight past round 2, at least 1 open store, at least 1 Joiner offer and at least 1 elite.
- **Over-cap purse:** a named case for the loader fix.
- **Old-shape fight** (seeds 4254, 4242, 4264): fights cut down to startCombat's unconditional literal keys, both at the encounter step and joined. They resume and survive `fight`, `attack` and `flee` without throwing.

## Corpus configuration and counts

| Label | Seed | Options |
|---|---|---|
| solo-101 / 202 / 808 / 909 | 101, 202, 808, 909 | maxActions 800 |
| party-404 / 1404 | 404, 1404 | maxActions 800, party |
| mu-505 | 505 | maxActions 800, force Magic User/Sorcerer/Human |
| mu-deep8-515 | 515 | maxActions 600, startDepth 8, force Magic User |
| thief-303 | 303 | maxActions 800, force Thief/Pilfer/Human |
| deep8-606 / 616 | 606, 616 | maxActions 600, startDepth 8 |
| deep14-party-626 | 626 | maxActions 600, startDepth 14, party |
| deep14-646 | 646 | maxActions 600, startDepth 14 |
| deep20-707 / 717 / 727 | 707, 717, 727 | maxActions 400, startDepth 20 |
| explicit-joiner / explicit-store | 4247 / 4246 | real meetJoiner / openStore |

Counts seen (printed by the non-vacuity test): 16 runs and 7,097 bot steps. 742 states were walked and 742 probes run. By kind:

| Kind | Count |
|---|---|
| Combat states | 679 |
| Combat with allies | 165 |
| Combat with an elite | 13 |
| Joined fight past round 2 | 290 |
| Hero effect in a fight | 9 |
| Open store | 4 (1 explicit) |
| pendingFind | 53 |
| pendingHazard | 1 |
| pendingTile | 0 |
| pendingJoiner | 5 (1 explicit) |

The corpus met no pendingTile. Its round trip is still pinned by 76-03's unit test, and the walk covers any future one with no edit here.

**Runtime:** `node --test test/roundtrip/resume-roundtrip.test.js` takes about 17 to 19 s.

## Note for 76-05: takeBootResumeEvents() contract

```js
import { takeBootResumeEvents, formatEvents } from "./src/browser/engineAdapter.js";
// after `await boot(seed)`:
const ev = takeBootResumeEvents();
// null -> boot rehydrated nothing (no save / corrupt save), or a run was started since
// []   -> a quiet save (nothing to narrate)
// [{ type: "fightResumed", round, pending, foes }] or [{ type: "storeResumed" }]
// One-shot: a second call returns null. formatEvents(ev) gives the Oracle line
// (both types are in ORACLE_ONLY: no rail card).
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A relaunch clamped an over-cap purse (engine finding from the walk)**
- **Found during:** Task 2, the first corpus probe.
- **Issue:** `engine/saveState.js#sanitizeWorn` ran `clampCarry(c)` on every load that has a `c.worn` key. Every current save has one. Live play never clamps gold when it is gained (`items.js#gainWilmst`); only `sellItem` clamps. So a hero whose purse was over the bag's cap lost the excess on every relaunch. The walk caught `c.gold 2494 -> 2000` mid-fight in the mu-deep8-515 run, and 2729 -> 2000 in a depth-15 probe. Rations were clamped the same way.
- **Fix:** the clamp runs only when a legacy worn fold appended a piece to the bag (a folded staff, or a legacy jewelry piece that found no free slot). That was the clamp's documented purpose. Legacy migrations behave exactly as before; `worn-migration.test.js` still passes, including both overflow-drop cases.
- **Measurement:** parity is 64/64. The loader is not on the fixture replay path, so no fixture moved. The roll-high state pins and save-compat pins, carry-model, store-sell and save-resume all pass. No pin, fixture or shell snapshot moved, so nothing needs declaring in FIXTURE-INVENTORY.md. 76-05's persistence subsection may still want a line on this loader behaviour change.
- **Mutation check:** with the old unconditional clamp restored, both the corpus walk and the named purse test fail. The walk catches the bug with no field named.
- **Files modified:** engine/saveState.js
- **Commit:** a0924ccd

**2. [Scope note] Dead states are left out of the walk**
- Only dead states differ after a relaunch (`c.foeEffect`, rounds `c.timers`). The load clears those by design when no fight survives, and a dead save relaunches to the roller and is never resumed. The walk and the fixture sweep skip `dead` states. The file header records why.

**Orchestrator override applied:** there were no bot balance runs and no readouts (user ruling 2026-09-26). No tools/readouts/76-* files were created. The bot corpus here is a deterministic in-test correctness sweep, not a balance readout.

## TDD Gate Compliance

RED `8730a8b9` test(76-04) failed because `takeBootResumeEvents` was not exported. The adapter relaunch cases already passed, because 76-03's loader carries the state; they are proofs, not RED drivers. GREEN `9e5b4a3e` feat(76-04) followed. No refactor commit was needed.

## Verification

- `node --test test/unit/engineAdapter.test.js test/persistence/resume-mid-encounter.test.js test/persistence/lifecycle.test.js test/persistence/flush-drain.test.js`: 69/69 pass.
- `node --test test/roundtrip/resume-roundtrip.test.js`: 7/7 pass in about 19 s.
- `node --test "test/parity/**/*.test.js"`: 64/64 pass.
- `npm test`: 6,750 / 6,750 pass, 0 fail. That is the 6,735 at dispatch plus 15 new tests.
- SAV-07's force-close timing (a kill between a dispatch and its storage write) cannot be reproduced under node. It is a backstop check for the Pixel 7 at milestone close.

## Threat surface

There is no new surface. `takeBootResumeEvents()` is read-only adapter state, never serialized. The loader change keeps values a validated save already carried and adds no new trust path.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: test/roundtrip/resume-roundtrip.test.js
- FOUND: src/browser/engineAdapter.js exports takeBootResumeEvents
- FOUND commits: 8730a8b9, 9e5b4a3e, a0924ccd, 38979958
