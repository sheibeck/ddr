---
phase: 01-engine-extraction-determinism
plan: 07
subsystem: engine
tags: [movement, applyAction, walking-skeleton, browser-adapter, round-trip, parity, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction seam), engine/state.js (newRun), engine/maze.js (genFloor/reveal), engine/character.js (checkLevel), engine/death.js (die/epitaphFor/epitaphCtx), engine/derived.js (skill/skillTier/upkeep/eff), engine/saveState.js (serializeRun/validateSave/rehydrate), content CLIMB_TABLE/LEAP_TABLE/DIRECTION_TABLE/RACES, test/parity harness (sandboxPrototype/diffState)"
provides:
  - "engine/movement.js: move/newDay/makeCamp/teleport/bestTeleportDir/descend/winGame — the movement domain, RNG-injected and event-emitting, fully behind applyAction"
  - "engine/engine.js: applyAction dispatches action.type 'move'/'camp' to engine/movement.js"
  - "engine/events.js: a 'won' event constructor"
  - "test/roundtrip/serialize-rehydrate.test.js: the standing ENG-04 round-trip guardrail, extended to movement/floor/day state"
  - "test/parity/movement-parity.test.js + fixtures/action-script.movement.json: ENG-05 movement parity against the frozen prototype"
  - "src/browser/engineAdapter.js: boot/initRun/dispatch/formatEvents — the browser presentation/persistence adapter routing movement through the engine"
  - "mazeworld.html wired to render the movement slice from engine state (playable dev loop)"
affects: [01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The movement action-script fixture is programmatically discovered, not hand-walked: a feature-avoiding BFS (blocking dot/trap/chest/tele/climb/gorge as intermediate cells, since those domains aren't ported yet) finds a path to the real procedurally-generated exit tile, respecting one-way-door directionality as a directed-edge constraint; a second search continues the SAME rng object across the descend to find a monster-free 100-step bounce on floor 2. This is the same 'programmatic seed-set discovery' pattern 01-05 used for chargen coverage, applied to pathfinding."
    - "`beats` (the prototype's narration-log grouping, S.beats/newBeat()) is a presentation artifact the engine deliberately never populates — engine/saveState.js's rehydrate already always resets it to null (01-06). The movement-parity test strips it from both sides before diffState alongside the engine-only seed/rngState/version bookkeeping fields the prototype's S never carried; the engine's narration channel is the structured `events` array instead."
    - "The browser adapter bridges a classic <script>'s top-level `let S` binding to a `type=\"module\"` script (which cannot see it) via one small `window.__mzState = {get,set}` accessor, then reroutes movement by overwriting the global `move` function itself — since `function move(dir){}` created a mutable global-object property, every existing bare-identifier call site (dpad click, arrow/WASD keydown) picks up the new implementation with zero changes to those call sites."
    - "Consequence functions accept an explicit `now = Date.now` parameter (matching engine/death.js's pattern) rather than threading a clock through applyAction — wall-clock timestamps are already stripped by diffState/stripVolatileFields before every comparison, so real Date.now() inside movement.js's death/win paths is safe and simpler than plumbing an injectable clock through the dispatcher."

key-files:
  created:
    - engine/movement.js
    - test/roundtrip/serialize-rehydrate.test.js
    - test/parity/fixtures/action-script.movement.json
    - test/parity/movement-parity.test.js
    - test/unit/movement.test.js
    - src/browser/engineAdapter.js
    - test/unit/engineAdapter.test.js
  modified:
    - engine/engine.js
    - engine/events.js
    - mazeworld.html

key-decisions:
  - "The movement-parity fixture (seed 256) avoids dot/trap/chest/tele/climb/gorge tiles as INTERMEDIATE path cells (via a directed-edge BFS honoring one-way-door direction) because those rule domains either aren't ported yet (dot/trap/chest — stubs) or would consume an unpredictable number of rng draws that shift the pre-computed day-100 monster-check offset (climb/gorge). The fixture still lands on a real 'exit' tile and crosses exactly one direction-validated one-way door — full climb/gorge/teleport coverage is proven instead via test/unit/movement.test.js's deterministic mock-rng tests."
  - "winGame(state, rng, events, now) fully parity-tests against the frozen prototype is deferred (a 5-floor traversal to a real Gate tile is impractical within one fixture); instead it is unit-tested directly (test/unit/movement.test.js) with a hand-placed 'gate' cell at depth 5, proving state.won/deathNote/epitaph/event all resolve correctly. This closes the STATE.md carried-forward todo pragmatically rather than via full ENG-05 golden-master parity, which remains available to 01-10's full-suite aggregation if ever wanted."
  - "engine/movement.js preserves the prototype's `S.c.dr` dead-code branch in newDay's armor-patching check verbatim (that field is never set anywhere in rollCharacter, making the branch permanently unreachable in the shipped prototype) rather than 'fixing' it to `c.ar` — per the project's fidelity rule, deviations from the canon prototype must be deliberate, not accidental."
  - "The browser adapter is a self-contained persistence layer: it reads/writes its own localStorage key (duplicating mazeworld.html's SAVE_KEY string literal, documented) via engine/saveState.js's serializeRun/validateSave/rehydrate, rather than depending on or reusing the classic script's own save()/load() functions. This keeps the adapter fully engine-boundary-correct and independently testable (test/unit/engineAdapter.test.js stubs localStorage directly), at the cost of a tiny, documented string-literal coupling."
  - "Wiring scope was kept literally to the plan's text: only dpad-click and arrow/WASD-keydown movement inputs route through the engine (by overwriting the global `move` function). The btn-camp button and the New-Delve/Wipe buttons remain on the OLD prototype code path — clicking New Delve after the module has booted resets S via the old, non-engine chargen path, which stays playable (engine/saveState.js's validateSave safely defaults a missing seed/rngState on the NEXT boot) but is not itself routed through applyAction. This is a known, documented gap for whichever later plan unifies all UI entry points behind the engine."

patterns-established:
  - "A rule-domain slice's parity fixture should be constructed by simulating the ALREADY-LANDED primitives it depends on (genFloor/newRun here) directly in a throwaway script, rather than hand-guessing a seed — the same discipline 01-05/01-06 used for chargen/save fixtures, now extended to pathfinding-constrained action scripts."
  - "A temporary browser adapter for an in-progress engine extraction can reroute a single shared entry-point function (here, the global `move`) rather than touching every call site — minimizing the blast radius of a partial migration while a phase's rule domains land one at a time."

requirements-completed: [ENG-01, ENG-04, ENG-05]

coverage:
  - id: D1
    description: "A move action routes through applyAction and returns {state, events}: legality, position/steps update, reveal, affliction/haste/invis/ether ticks, MU spell recharge, newDay/upkeep at 100 steps, climb/gorge and one-way-door handling, and descend/win on the exit/gate tile"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/movement.test.js#move: a legal corridor move increments steps, reveals, and emits moved"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: a one-way door blocks entry from the wrong side (no-op)"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: a successful climb clears the feature and does not hurt the character"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: a fatal climb fall kills the character via die('fall')"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: stepping onto an exit tile descends to the next floor"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: stepping onto the floor-5 gate wins the run without killing it"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#newDay: starving with no rations kills via die('starve') when wp hits 0"
        status: pass
      - kind: integration
        ref: "test/parity/movement-parity.test.js#engine matches the frozen prototype after every action in the movement fixture"
        status: pass
    human_judgment: false
  - id: D2
    description: "The serialize/rehydrate round-trip holds (deepStrictEqual, stripped) after EVERY action in the movement fixture — the standing ENG-04 guardrail, now covering movement/floor/day state"
    requirement: "ENG-04"
    verification:
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#state survives a JSON round-trip after EVERY action in the movement fixture"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#applyAction never mutates the state object passed in (returns a fresh clone)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The engine and the frozen prototype produce matching state after every move in the movement fixture (parity, stripped), including an exit-triggered descend and a day-100 upkeep tick"
    requirement: "ENG-05"
    verification:
      - kind: integration
        ref: "test/parity/movement-parity.test.js#engine matches the frozen prototype after every action in the movement fixture"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live browser prototype routes movement through engine.applyAction via a thin adapter and stays playable (renders from the returned state/events)"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#dispatch(action) advances state via applyAction and persists it"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#boot(freshSeed) fails closed to a fresh run on a corrupt save"
        status: pass
      - kind: manual_procedural
        ref: "Manual browser playtest (create run, walk several floors) deferred to end-of-milestone UAT per the autonomous run's UAT-deferral policy"
        status: unknown
    human_judgment: true
    rationale: "Static checks (node --check, an adapter-contract smoke call, and the unit suite above) prove the wiring is correct, but confirming the game actually renders and feels playable in a real browser requires a human to load mazeworld.html and look at it — deferred to milestone-end UAT per this autonomous run's established policy (STATE.md)."

duration: 32min
completed: 2026-09-08
status: complete
---

# Phase 1 Plan 7: The Walking Skeleton — Movement, Round-Trip Guardrail & Browser Adapter Summary

**Movement (move/newDay/makeCamp/teleport/descend/winGame) is now fully behind `applyAction`, proven byte-identical to the frozen prototype across a programmatically-discovered action script, with the standing serialize/rehydrate guardrail extended and a thin browser adapter routing the live `mazeworld.html` dpad/keyboard input through the engine.**

## Performance

- **Duration:** ~32 min (00:08:51 → 00:35:39, per commit timestamps; state exploration/fixture discovery preceded the first commit)
- **Started:** 2026-09-08T00:31:12-04:00 (first task commit)
- **Completed:** 2026-09-08T00:35:39-04:00 (last task commit)
- **Tasks:** 3 completed (Task 1 RED, Task 2 GREEN as TDD; Task 3 plus a supplemental adapter-test commit)
- **Files modified:** 7 created, 3 modified

## Accomplishments

- Ported the prototype's entire movement domain (mazeworld.html lines 1614-1868) into `engine/movement.js`: `move` (legality/one-way doors/climb-gorge resolution via CLIMB_TABLE/LEAP_TABLE, reveal, affliction/haste/invis/ether ticks, MU spell recharge, day-100 upkeep, feature-tile dispatch), `newDay`/`makeCamp` (rations, healing, starve-death, the 8-hour wandering-monster check), `teleport`/`bestTeleportDir` (full port), `descend` (sp bonus + checkLevel + next floor), and `winGame` (the fixed 5-floor Gate) — all RNG-injected, event-emitting, and dispatched through `engine/engine.js`'s `applyAction` for `"move"`/`"camp"`.
- `dot`/`trap`/`chest` feature tiles are intentionally left as event-emitting stubs (`encounterDot`/`springTrap`/`openChest`) that consume the tile and push a `pending*` event, matching the same "consequence primitives extracted ahead of their slice" pattern `engine/items.js` established — full resolution is 01-09/01-10's job.
- Extended the standing ENG-04 round-trip guardrail (`test/roundtrip/serialize-rehydrate.test.js`) to run after every action of a real movement fixture, proving state stays 100% plain JSON through a descend and a day-cycle tick, not just at boot.
- Proved ENG-05 movement parity against the frozen prototype (`test/parity/movement-parity.test.js`) over a programmatically-discovered fixture (seed 256, `test/parity/fixtures/action-script.movement.json`): a feature-avoiding, one-way-door-direction-respecting BFS path from the start to a real generated exit tile, then a monster-free bounce to exactly 100 cumulative steps on floor 2 — `diffState` is `null` after all 101 actions.
- Added `test/unit/movement.test.js` (24 tests) with a deterministic mock-rng harness to directly cover branches the parity fixture can't reach without walking onto an unimplemented feature tile: one-way-door legality both directions, climb/gorge success/fail/fatal, affliction tick-off, haste/invis/ether decrement, MU recharge, newDay starve-death and the wandering-monster check (proving no combat starts — deferred to 01-08), makeCamp gating, and both teleport paths (Illusionist choice vs. 2d8-roll fallback).
- Built `src/browser/engineAdapter.js` (`boot`/`initRun`/`dispatch`/`formatEvents`, `test/unit/engineAdapter.test.js`) and wired `mazeworld.html`: a tiny `window.__mzState` accessor bridges the classic script's `S` binding to a new `type="module"` script, which boots engine state and overwrites the global `move` function — every existing dpad-click and arrow/WASD-keydown call site picks up the engine-routed movement with zero changes to those handlers. The frozen parity master (`test/parity/prototype-master.js.txt`) is untouched.
- Full project test suite: **143/143 passing** in ~3.3s (36 new tests this plan — 24 movement unit, 3 round-trip, 1 movement-parity, 7 engine-adapter unit — 1 already-counted) atop 107 prior, well within the ~15s budget.

## Task Commits

1. **Task 1 (TDD) RED: failing round-trip + movement parity tests** — `c4ea3b5` (test)
2. **Task 2 (TDD) GREEN: movement slice — move/newDay/teleport/descend/winGame** — `ed2ee91` (feat)
3. **Task 3: browser adapter — route movement through the engine** — `071458d` (feat)
4. **Supplemental: direct unit coverage for the browser engine adapter** — `d0cb3b6` (test)

**Plan metadata:** committed via `docs(01-07): complete plan`.

## Files Created/Modified

- `engine/movement.js` — move/newDay/makeCamp/teleport/bestTeleportDir/descend/winGame (RNG-injected, event-emitting)
- `engine/engine.js` — applyAction dispatch wired for `"move"`/`"camp"`
- `engine/events.js` — added a `won` event constructor
- `test/roundtrip/serialize-rehydrate.test.js` — the standing ENG-04 guardrail, extended to movement/floor/day state
- `test/parity/fixtures/action-script.movement.json` — the programmatically-discovered seed-256 movement fixture
- `test/parity/movement-parity.test.js` — ENG-05 movement parity vs. the frozen prototype
- `test/unit/movement.test.js` — 24 tests: legality, one-way doors, climb/gorge, affliction/haste/invis/ether/MU-recharge ticks, exit/gate dispatch, dot/trap/chest stubs, newDay/makeCamp, teleport
- `src/browser/engineAdapter.js` — boot/initRun/dispatch/formatEvents (presentation/persistence glue)
- `test/unit/engineAdapter.test.js` — 7 tests: boot fail-closed load, dispatch/persist, formatEvents mapping, purity
- `mazeworld.html` — `window.__mzState` accessor + a `type="module"` script rerouting movement input through the engine

## Decisions Made

- The movement-parity fixture avoids dot/trap/chest/tele/climb/gorge as intermediate path cells (a directed-edge BFS honoring one-way-door direction) to stay reachable and rng-predictable; those branches are covered by `test/unit/movement.test.js`'s deterministic mock-rng tests instead. See Deviations for the full rationale.
- winGame's full ENG-05 prototype-parity is deferred (impractical to reach a real floor-5 Gate within one fixture); a direct unit test proves the win path's mechanics instead, closing the STATE.md carried-forward todo pragmatically.
- The prototype's dead `S.c.dr` armor-patching branch in newDay is preserved verbatim (unreachable in both the prototype and the port) rather than "fixed," per the project's fidelity rule.
- The browser adapter owns its own localStorage read/write via `engine/saveState.js`, independent of mazeworld.html's own `save()`/`load()`, at the cost of a documented SAVE_KEY string-literal duplication.
- Wiring is scoped exactly to dpad/keydown movement input, per the plan's text; New Delve/Wipe/camp buttons stay on the old code path (documented gap for a later plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] winGame/teleport needed `rng` even though the plan's artifact shorthand omitted it**
- **Found during:** Task 2, porting `winGame`
- **Issue:** The plan's artifact list documents `winGame(state, events, now)` without an `rng` parameter, but `winGame` calls `epitaphFor(cause, ctx, rng)`, which draws a random epitaph from the bank — a genuine rng consumer, not an oversight to remove.
- **Fix:** `winGame(state, rng, events, now)` takes `rng` (matching `descend`/`teleport`'s signatures); documented inline as an intentional deviation from the shorthand, the same pattern 01-06 used for `itemReady`'s signature.
- **Files modified:** engine/movement.js
- **Verification:** `test/unit/movement.test.js#move: stepping onto the floor-5 gate wins the run without killing it` passes; the movement fixture's own descend path (which also calls `checkLevel`+`genFloor` with `rng`) is green.
- **Committed in:** `ed2ee91`

**2. [Rule 3 - Blocking] The movement-parity fixture could not walk a naive shortest path to the exit without crossing unimplemented feature tiles**
- **Found during:** Task 1, authoring `action-script.movement.json`
- **Issue:** A plain BFS shortest path from the start to the procedurally-placed exit tile almost always crosses several `dot`/`trap`/`chest`/`tele` cells (features are scattered across most of the maze's "far" cells, including cells that lie on the only route to the farthest point) — walking over one would trigger the prototype's real (unported) encounter/trap/chest logic, which the engine's Task-2 stubs can't match, breaking parity by construction rather than by a bug.
- **Fix:** Built a directed-edge BFS (in a throwaway discovery script, not committed) that blocks `dot`/`trap`/`chest`/`tele`/`climb`/`gorge` as intermediate cells (climb/gorge are also excluded because their rng consumption is unpredictable-length, which would shift the pre-computed day-tick monster-check offset) while still respecting one-way-door directionality, then searched seeds until one (256) yielded a short, feature-avoiding path to a real exit tile crossing exactly one door, plus a monster-free 100-step day-tick continuation on floor 2.
- **Files modified:** test/parity/fixtures/action-script.movement.json (the fixture itself documents the discovery method in its `_note` field)
- **Verification:** `test/parity/movement-parity.test.js` passes (`diffState` null after all 101 actions); `test/roundtrip/serialize-rehydrate.test.js` confirms the fixture actually reaches floor 2, day 2, and step 100.
- **Committed in:** `c4ea3b5`

**3. [Rule 2 - Missing Critical] Added a `won` event type**
- **Found during:** Task 2, porting `winGame`
- **Issue:** `engine/events.js` had no structured event for a win — without one, `winGame`'s outcome would be invisible to any presentation consumer of the `events` array (a gap, not a stylistic choice, since `died`/`leveled`/`floorChanged` already exist as the pattern to follow).
- **Fix:** Added `EVENT_TYPES.WON` and a `won(level, day, steps)` constructor, mirroring the existing event constructors' shape.
- **Files modified:** engine/events.js
- **Verification:** `test/unit/movement.test.js#move: stepping onto the floor-5 gate wins the run...` and `test/unit/engineAdapter.test.js#formatEvents maps known event types...` both assert on it.
- **Committed in:** `ed2ee91`

---

**Total deviations:** 3 (1 Rule 1 signature correction, 1 Rule 3 fixture-construction constraint, 1 Rule 2 missing event type)
**Impact on plan:** No scope change and no architectural change. The signature fix and new event type are small, necessary corrections; the fixture-construction constraint is a direct, unavoidable consequence of this being the FIRST slice through a maze that already scatters features from later, unimplemented slices — documented thoroughly in the fixture's own `_note` field for whoever extends it in 01-08/01-09/01-10.

## Issues Encountered

- Node has no built-in `localStorage`; `test/unit/engineAdapter.test.js` installs and tears down a minimal in-memory stub on `globalThis` per test (mirroring the parity harness's own `fakeStorage` pattern) rather than depending on a browser-like environment.
- ES module imports (used by the new `<script type="module">` in mazeworld.html) are blocked by same-origin/CORS policy when a page is opened via a bare `file://` URL in most browsers — the dev loop must be served via a local static server (`npx serve`, `live-server`, etc.), which is already the documented workflow per `.claude/CLAUDE.md`'s Development Tools table, not a new requirement introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/movement.js` is a complete, tested consequence surface for 01-08 (combat) to build on: `newDay`'s wandering-monster check already rolls the correct dice and pushes a `wanderingMonster` event, it just doesn't start `state.combat` yet — 01-08 owns wiring that up once it defines `state.combat`'s real shape (matching the same forward-compatible pattern 01-06 left for `useItem`'s foe-targeting effects).
- The movement-parity fixture's `_note` documents exactly which feature tiles it avoids and why — 01-09/01-10 should extend it (or add sibling fixtures) once `dot`/`trap`/`chest` get real implementations, rather than trying to retrofit this one fixture to cover everything.
- `src/browser/engineAdapter.js`'s `formatEvents` already has cases for every event type any landed engine module can currently emit; 01-08/01-09/01-10 should add their new event types there as they land, keeping the dev loop narrated instead of silently dropping new events (the `default: return null` fallback is safe but silent).
- Carried-forward todo (from 01-05/01-06, now closed pragmatically): the floor-5 Gate/winGame path is unit-tested directly rather than prototype-parity-tested; full golden-master parity for it remains available to 01-10's full-suite aggregation if ever wanted, but is not blocking.
- New carried-forward todo: New Delve/Wipe/camp buttons in mazeworld.html still call the OLD (non-engine) `newGame()`/`makeCamp()` — whichever later plan unifies all UI entry points behind the engine (likely the Phase 4/5 presentation rewrite, per SKELETON.md) should reroute those too.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 7 created files + the SUMMARY found on disk; all 4 task-commit hashes (`c4ea3b5`, `ed2ee91`, `071458d`, `d0cb3b6`) found in git log. Full `node --test` suite: 143/143 passing in ~3.3s.
