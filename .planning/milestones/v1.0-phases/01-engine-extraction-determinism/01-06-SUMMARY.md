---
phase: 01-engine-extraction-determinism
plan: 06
subsystem: engine
tags: [items, treasure, death, epitaphs, save-validation, fail-closed, determinism, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction, structuredClone fail-fast), engine/state.js (newRun/STATE_VERSION), engine/derived.js (eff/skill), engine/rng.js (makeRng), engine/dice.js (rollDice), content/index.js pure-data tables (treasure-tables, weapons, armors, epitaphs, misc-tables)"
provides:
  - "engine/items.js: eff/giveItem/takeItem/useItem/gainWilmst/hasPicks/itemReady + rollJewel/Cloak/Staff/Blade/MailPiece/rollTreasureItem — pure, RNG-injected, plain-data item/treasure helpers other slices (combat/movement/magic/economy) call as shared consequences"
  - "engine/death.js: die/bury/epitaphFor/epitaphCtx — pure death/graveyard/epitaph filling that returns a serializable RunSummary, with deathAt/RunSummary.when funneled through a single injectable now() clock"
  - "engine/saveState.js: serializeRun/validateSave/rehydrate — full-state save serialization plus fail-closed validation of an untrusted save (ENG-04 standing round-trip + T-01-06a save-tampering control)"
affects: [01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consequence helpers (items/death) are called BY later applyAction slices, not dispatched directly — they take an explicit state/rng/events tuple and mutate a passed draft, matching the applyAction seam without adding dispatch cases themselves."
    - "Wall-clock isolation: every Date.now() site in the ported prototype code (S.deathAt, graveyard `when`) funnels through a single injectable `now()` parameter (default Date.now) on die()/bury(), so determinism/parity/round-trip tests can pin a fixed clock instead of stripping fields after the fact."
    - "Fail-closed validation returns {ok:false, reason} and never throws; the caller (a future persistence adapter) falls back to newRun on failure. Safe defaults (freshSeed, a derived rngState) are applied for a save missing the newer seed/rngState fields rather than rejecting a pre-refactor save outright."
    - "Forward-compatible combat touchpoints: useItem's foe-targeting effects (freeze/stone/fire/gas/weaken) read/write state.combat.foes directly with minimal kill bookkeeping (wp/alive/kills) — the full combat resolution pipeline (loot, victory checks) is deferred to the combat slice (01-08) that will own state.combat's real shape."

key-files:
  created:
    - engine/items.js
    - engine/death.js
    - engine/saveState.js
    - test/unit/items.test.js
    - test/unit/death.test.js
    - test/unit/save-validation.test.js
  modified: []

key-decisions:
  - "Committed death.js before items.js (reversing the plan's Task 1/Task 2 order) because items.js's useItem imports die() from death.js for the Potion of Death effect — the natural dependency order, same pattern as 01-05's character/state reordering."
  - "itemReady takes the full `state` (not just the character `c` the plan's artifact shorthand suggested) because the prototype's every-N-squares cooldown check needs the run's step counter (state.steps), which the character object alone does not carry."
  - "rollTreasureItem(rng, depth, c) takes an OPTIONAL third character parameter (rather than the plan's exact 2-arg shorthand) to decide the lockpicks gate — a caller with no character in hand (including the acceptance test) is treated as not-yet-carrying-picks, matching the prototype's fresh-character behavior exactly while staying callable with 2 args."
  - "die()/bury() build a shared internal RunSummary from state.deathNote/state.epitaph (assumed already set by die() itself, or by a future winGame path) rather than re-deriving them — bury() never independently computes an epitaph, matching the prototype's own bury(cause,detail) which only ever read S.deathNote/S.epitaph."
  - "bury(state, cause, detail, graves, now) takes and returns the graveyard array immutably (unshift + cap-at-60, new array) rather than mutating a module-global — the graveyard's actual persistence (localStorage / @capacitor/preferences) stays entirely outside the engine, owned by a future storage adapter."
  - "serializeRun keeps the FULL GameState (no field exclusion) — unlike the prototype's save, which dropped seed/rngState/store because state is already 100% plain data end-to-end after 01-05/01-06, nothing needs to be excluded anymore."

patterns-established:
  - "Item/treasure/death helpers as shared consequence primitives: extracted once, ahead of the action slices that call them (combat's killFoe -> takeItem/bury, climb-fall -> die), avoiding backward dependencies in later plans."
  - "A save's fail-closed contract: validateSave never throws, returns {ok:false} on anything fundamentally broken, and applies safe defaults rather than rejecting for anything merely missing newer optional fields."

requirements-completed: [ENG-01, ENG-03, ENG-04, ENG-05]

coverage:
  - id: D1
    description: "Item and treasure helpers (eff, giveItem, takeItem, useItem, gainWilmst, rollTreasureItem and the jewel/cloak/staff/blade/mail rollers) are pure, RNG-injected, and store only plain data on the character"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/items.test.js#rollTreasureItem(rng, depth) is deterministic for the same seed and returns plain data"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js#giveItem mutates state.c.items with the plain descriptor and applies a flat wp effect"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js#takeItem equips a strictly-better weapon and rejects a worse or illegal one"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js#gainWilmst adds greed-scaled gold and only Pickpockets get the extra take"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js#items.js references no Math.random/document/localStorage"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js#a character carrying every item kind survives a JSON round-trip"
        status: pass
    human_judgment: false
  - id: D2
    description: "Death and graveyard (die, bury, epitaphFor, epitaphCtx) produce a serializable RunSummary and a filled epitaph string from the data templates, with no DOM/storage"
    requirement: "ENG-03"
    verification:
      - kind: unit
        ref: "test/unit/death.test.js#epitaphFor is deterministic for a given (cause, ctx, seed) and fills every token"
        status: pass
      - kind: unit
        ref: "test/unit/death.test.js#die returns a RunSummary that JSON round-trips"
        status: pass
      - kind: unit
        ref: "test/unit/death.test.js#bury produces a RunSummary with the prototype's fields and caps the graveyard at 60"
        status: pass
      - kind: unit
        ref: "test/unit/death.test.js#death.js references no DOM/localStorage"
        status: pass
    human_judgment: false
  - id: D3
    description: "Death timestamps (deathAt, graveyard when) remain the only wall-clock values and are isolated so they never enter determinism/parity comparisons"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/unit/death.test.js#die writes deathAt only via the injected now(), and only that field is clock-derived"
        status: pass
    human_judgment: false
  - id: D4
    description: "load()/validateSave rejects a malformed or version-mismatched save and falls back cleanly instead of throwing"
    requirement: "ENG-04"
    verification:
      - kind: unit
        ref: "test/unit/save-validation.test.js#serializeRun -> JSON -> validateSave -> rehydrate round-trips a fresh run deepStrictEqual"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#validateSave never throws on broken JSON and fails closed"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#validateSave rejects a save missing c or floor"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#an old-shape save (no seed/rngState) rehydrates with safe defaults"
        status: pass
      - kind: unit
        ref: "test/unit/save-validation.test.js#saveState.js references no localStorage/document"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-08
status: complete
---

# Phase 1 Plan 6: Items, Death & Fail-Closed Save Validation Summary

**Pure, RNG-injected item/treasure/death consequence helpers (engine/items.js, engine/death.js) plus a full-state serializeRun/validateSave/rehydrate pipeline (engine/saveState.js) that fails closed on any malformed or tampered save instead of throwing.**

## Performance

- **Duration:** ~15 min (commit span 00:05:49 → 00:06:26, plus preceding research/design time)
- **Started:** 2026-09-08T00:05:49-04:00 (first task commit)
- **Completed:** 2026-09-08T00:06:26-04:00 (last task commit)
- **Tasks:** 3 completed (Tasks 1 and 2 executed as TDD: test + feat each)
- **Files modified:** 6 created, 0 modified

## Accomplishments

- `engine/items.js` ports the prototype's entire carried-treasure section (mazeworld.html lines 1872-1997) as pure, RNG-injected helpers: `eff` (re-exported from `engine/derived.js`), `giveItem`/`takeItem` (preserving the exact weapon/armor equip-swap "only strictly better" rules), `gainWilmst` (with the Pickpocket bonus rolled via the injected rng), `hasPicks`/`itemReady`, and the `rollJewel`/`rollCloak`/`rollStaff`/`rollBlade`/`rollMailPiece`/`rollTreasureItem` treasure rollers. Every value written onto `state.c.items` is plain JSON.
- `engine/death.js` ports `die`/`bury`/`epitaphFor`/`epitaphCtx` (mazeworld.html lines 1030-1033, 2914-2961): death clears combat/wards, fills `deathNote` from the `CAUSE_TEXT` templates and `epitaph` from the `EPITAPHS` bank via the injected rng, and both functions return a serializable `RunSummary`. The two wall-clock reads (`deathAt`, `RunSummary.when`) are funneled through a single injectable `now()` parameter, isolating them for the determinism/parity harnesses per 01-RESEARCH.md Pitfall 1.
- `engine/saveState.js` implements the phase's save-tampering control (T-01-06a / ASVS V12): `validateSave` parses defensively (never throws), rejects a save missing `c`/`floor`, and applies safe defaults for a pre-refactor save missing `seed`/`rngState`; `rehydrate` always resets `combat`/`store`/`beats` to `null`. `serializeRun(newRun(seed))` → JSON → `validateSave` → `rehydrate` round-trips `deepStrictEqual` to the original state for every fixture seed — the ENG-04 standing guardrail.
- Full project test suite: **107/107 passing** in ~2.5s (38 new tests this plan — 12 items, 15 death, 7 save-validation, 4 already-counted from the fixture) atop 69 prior, well within the ~15s budget.

## Task Commits

Each task was committed atomically (Task 2's death.js committed before Task 1's items.js — dependency order, see Decisions):

1. **Task 2 (TDD) RED: death/graveyard/epitaph tests** — `28cefeb` (test)
2. **Task 2 (TDD) GREEN: death, graveyard & epitaph filling** — `d9fb803` (feat)
3. **Task 1 (TDD) RED: item & treasure helper tests** — `f1a0d4a` (test)
4. **Task 1 (TDD) GREEN: item & treasure helpers** — `46e565c` (feat)
5. **Task 3: save serialization + fail-closed load validation** — `21cb93c` (feat, includes test/unit/save-validation.test.js)

**Plan metadata:** committed via `docs(01-06): complete plan`.

## Files Created/Modified

- `engine/items.js` — `eff`/`giveItem`/`takeItem`/`useItem`/`gainWilmst`/`hasPicks`/`itemReady` + treasure rollers (RNG-injected, plain-data)
- `engine/death.js` — `die`/`bury`/`epitaphFor`/`epitaphCtx` (pure, injectable clock)
- `engine/saveState.js` — `serializeRun`/`validateSave`/`rehydrate` (fail-closed)
- `test/unit/items.test.js` — 12 tests: treasure roller determinism/coverage, giveItem/takeItem equip-swap rules, gainWilmst, useItem effects incl. the death potion, itemReady cooldown, purity, JSON round-trip
- `test/unit/death.test.js` — 15 tests: epitaphFor/epitaphCtx, die's field-setting + injected-clock determinism + RunSummary round-trip, bury's cap-at-60 graveyard, purity
- `test/unit/save-validation.test.js` — 7 tests: full round-trip, broken-JSON/missing-field fail-closed, old-shape-save defaulting, rehydrate's combat/store/beats reset, purity

## Decisions Made

- Committed death.js before items.js (natural dependency order — items.js's `useItem` imports `die` for the Potion of Death effect). See Deviations.
- `itemReady` takes the full `state`, not just the character, since the every-N-squares cooldown needs `state.steps`.
- `rollTreasureItem(rng, depth, c)` takes an optional character to gate the lockpicks roll, staying callable with 2 args exactly as the plan's acceptance test does.
- `bury` takes/returns the graveyard array immutably; the engine never touches localStorage — that's a future persistence adapter's job.
- `serializeRun` keeps the full state now that nothing in `GameState` is non-serializable anymore (no field exclusion needed, unlike the prototype's save).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task execution reordered so death.js (a dependency of items.js) lands first**
- **Found during:** Implementing Task 1's `useItem`, which needs `die()` for the "Potion of Death" effect
- **Issue:** The plan lists Task 1 (`engine/items.js`) before Task 2 (`engine/death.js`), but `useItem`'s `death` case must call `die()`, creating a hard import dependency in the opposite direction of the plan's task numbering.
- **Fix:** Implemented and committed death.js/death.test.js (Task 2) first, then items.js/items.test.js (Task 1), then saveState.js (Task 3) — same pattern as 01-05's Task 2/Task 1 reordering.
- **Files modified:** commit ordering only — no file content differs from the plan's intent.
- **Verification:** Each commit's acceptance verified green at commit time; full suite 107/107.
- **Committed in:** `28cefeb`, `d9fb803`, `f1a0d4a`, `46e565c`

**2. [Rule 1 - Bug] itemReady's documented character-only signature cannot express the prototype's cooldown check**
- **Found during:** Task 1, porting `itemReady`
- **Issue:** The plan's artifact shorthand lists `itemReady(c,it)`, but the prototype's cooldown (`S.steps - (it.usedAt ?? -99999) >= it.every`) reads the run's step counter, which the character object does not carry.
- **Fix:** `itemReady(state, it)` takes the full state instead; documented inline as an intentional deviation from the shorthand.
- **Files modified:** engine/items.js
- **Verification:** `test/unit/items.test.js#itemReady requires an every-N cooldown to have elapsed` passes.
- **Committed in:** `46e565c`

**3. [Rule 1 - Bug] Test-fixture helper bug: spread order silently dropped character-field defaults**
- **Found during:** Task 1/Task 2 test authoring — `takeItem`/`useItem`/`die` tests failed with `cls`/`gold`/`motive` undefined
- **Issue:** Both `items.test.js` and `death.test.js`'s `fixedState(overrides)` helpers built `{ c: fixedCharacter(overrides.c), ...overrides }` — since `overrides` itself carries a raw, non-merged `c` key, the trailing spread silently overwrote the fully-defaulted character with the raw partial override, dropping every field the test didn't explicitly set (e.g. `cls`, `gold`, `motive`).
- **Fix:** Destructured `{ c: cOverrides, ...rest }` from `overrides` so the merged character is applied last and never re-clobbered.
- **Files modified:** test/unit/items.test.js, test/unit/death.test.js
- **Verification:** All previously-failing tests (`takeItem equips a strictly-better weapon...`, `takeItem equips strictly-better armor...`, `useItem respects a staff/cloak's every-N-squares cooldown`, `useItem's potion of death kills the character...`, `die sets dead/deathNote/epitaph...`) now pass; full suite 107/107.
- **Committed in:** `f1a0d4a`, `28cefeb` (test commits, fixed before their paired feat commits landed)

**4. [Rule 1 - Bug] Static purity-guard regexes false-positived on the word "localStorage" inside doc comments**
- **Found during:** Task 2/Task 3 — `death.js`/`saveState.js`'s own header comments explain what they deliberately do NOT touch ("this function never touches localStorage"), which a naive `!/\blocalStorage\b/.test(src)` check flags as a violation.
- **Issue:** Unlike `test/unit/engine-purity.test.js`'s tree-wide guard (which strips comments before scanning), the new per-module purity assertions scanned raw source.
- **Fix:** Added a local `stripComments()` helper to each of the three new test files, mirroring the existing engine-purity guard's approach, before the forbidden-reference regex checks.
- **Files modified:** test/unit/items.test.js, test/unit/death.test.js, test/unit/save-validation.test.js
- **Verification:** `... references no Math.random/document/localStorage` tests pass in all three files; full suite 107/107.
- **Committed in:** `28cefeb`, `f1a0d4a`, `21cb93c`

---

**Total deviations:** 4 (1 Rule 3 dependency-ordering, 3 Rule 1 bugs — one in production code, two in test fixtures/assertions)
**Impact on plan:** No scope change and no architectural change. The reorder is the natural dependency order; the itemReady signature fix is a necessary correction to an underspecified shorthand; the two test-authoring bugs were caught and fixed before any commit landed with a false-passing test.

## Issues Encountered

- `useItem`'s foe-targeting potion effects (freeze/weaken/stone/fire/gas) reference `state.combat.foes`, a shape not yet defined by any landed plan (combat is 01-08). Implemented these as minimal, self-contained mutations (`asleep`/`wp`/`alive` flags, a direct `c.kills` increment) rather than calling a not-yet-existing `killFoe()` — full combat resolution (loot drops, victory checks) will be wired when 01-08 lands `state.combat`'s real shape and can supersede this minimal path if it changes the foe object's contract. No test in this plan exercises these branches against a live `state.combat` beyond confirming they don't crash when `state.combat` is `null` — flagged for the combat plan's parity fixture to cover once foes exist.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/items.js`, `engine/death.js`, and `engine/saveState.js` are ready for 01-07..01-10 to call as shared consequences: movement's climb-fall calls `die`; combat's `killFoe` will call `takeItem`/`bury`/`gainWilmst`; economy's store effects will call `takeItem`/`giveItem`.
- The ENG-04 standing round-trip guardrail (`serializeRun` → `validateSave` → `rehydrate`) is live and should be re-run after each subsequent slice adds new state fields — no new volatile (wall-clock) fields exist beyond `deathAt`, already isolated.
- Carried-forward todo: `useItem`'s foe-targeting branches operate on an as-yet-undefined `state.combat.foes` shape; 01-08 (combat) should confirm/adjust the `alive`/`wp`/`asleep` field contract this plan assumed and extend its parity fixture to cover a Fire/Stone/Freeze potion mid-combat.
- Carried-forward todo (from 01-05): the floor-5 Gate/winGame path still needs a parity fixture extension once a movement/aggregate slice lands there; `bury("won", ...)` is now available for that path to call.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 6 created files found on disk; all 5 task-commit hashes (`28cefeb`, `d9fb803`, `f1a0d4a`, `46e565c`, `21cb93c`) found in git log. Full `node --test` suite: 107/107 passing in ~2.5s.
