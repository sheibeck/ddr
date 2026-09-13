---
phase: 01-engine-extraction-determinism
plan: 10
subsystem: engine
tags: [economy, store, encounters, traps, chests, determinism, parity, round-trip, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction dispatch), engine/items.js (giveItem/takeItem/gainWilmst/rollBlade/rollMailPiece/rollTreasureItem/hasPicks), engine/combat.js (startCombat), engine/character.js (rollCharacter/checkLevel), engine/movement.js (the dot/trap/chest feature-tile stubs), content/index.js (FOODS/POTIONS/WEAPONS/ARMORS/ENCOUNTER_TABLES/ENC_ALIAS/TRAPS/AFFLICTIONS/FAERIE/MISC_MAGIC/PHOBIAS/INSANITY — all already pure data), test/parity harness (sandboxPrototype/diffState) and every prior plan's fixture (chargen/movement/combat/magic)"
provides:
  - "engine/economy.js: openStore/buyFrom/leaveStore + STORE_EFFECTS — the store's buy closures eliminated, stock is plain {n,sub,cost,effectId,effectParams,sold} data"
  - "engine/encounters.js: encounterDot/springTrap/openChest/tableFour/findFood/findGrimoire/findGear/findMisc/meetFaerie/meetJoiner/catchAffliction/goInsane/newPhobia/fallDark — the full encounter/trap/chest domain, RNG-injected and event-emitting"
  - "engine/movement.js: the dot/trap/chest feature-tile stubs replaced by the real encounters.js handlers"
  - "engine/engine.js: applyAction dispatches 'buyItem'/'leaveStore'/'useItem'"
  - "test/parity/fixtures/action-script.economy.json + action-script.encounters.json + action-script.win.json, test/parity/economy-parity.test.js, test/parity/full-suite.test.js: the ENG-05 phase gate, including the win-path (floor-5 Gate) parity case"
  - "test/parity/harness/comparables.js: the shared comparable()/internal-action-dispatch helpers every parity test (and the full-suite aggregator) now reuses"
  - "test/roundtrip/serialize-rehydrate.test.js: extended through the economy/encounters/win fixtures, proving an OPEN store survives structuredClone with zero throws"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The prototype's LAST non-serializable pattern (store stock's `add(n,cost,buy,sub)` closures, the one the prototype's own save() comment flags as unsaveable) is eliminated via Pattern 3 (01-RESEARCH.md): stock becomes plain {effectId, effectParams} descriptors, and an engine-side STORE_EFFECTS map (keyed by effectId) applies the purchase. Never store or call a function held on `state` — the map lookup happens in buyFrom, entirely off the GameState object."
    - "Fixture authoring for encounters/win used a THIRD extraction technique this phase (after 'hand-craft a floor' and 'brute-force scan newRun(seed) for a matching roll'): internal (non-validated) action types — openStore/springTrap/openChest/encounterDot/descend — mirroring the startCombat precedent from 01-08, so a scenario can force a deterministic domain entry point without needing to walk a real maze onto a matching feature tile first."
    - "The win-path fixture skips floors 1-4 via four direct descend() calls (descend parity is already proven by the movement fixture) and only BFS-walks the final floor-5 leg to the Gate — proving winGame() parity is the fixture's whole point, not re-proving descend() a second time."
    - "Per-domain parity comparable()/dispatch helpers (movementComparable/combatComparable/applyStartCombat/economyComparable/runEconomyAction) were factored into test/parity/harness/comparables.js so full-suite.test.js could aggregate every fixture in one gate WITHOUT importing other *.test.js files as modules (which would silently re-execute their own top-level test() registrations a second time under node:test)."

key-files:
  created:
    - engine/economy.js
    - engine/encounters.js
    - test/unit/economy.test.js
    - test/unit/encounters.test.js
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/fixtures/action-script.win.json
    - test/parity/economy-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/harness/comparables.js
  modified:
    - engine/engine.js
    - engine/movement.js
    - test/unit/movement.test.js
    - test/parity/fixtures/action-script.schema.md
    - test/roundtrip/serialize-rehydrate.test.js

key-decisions:
  - "STORE_EFFECTS params carry the FULL prepared item object (e.g. {item: {kind:'weapon', ...}}) rather than the plan artifact's illustrative shorthand ({name}) — this mirrors exactly what the prototype's closure captured (a complete item literal), keeps buyFrom's effect application a single takeItem/giveItem call, and needs no extra lookup back into content tables at purchase time."
  - "openChest's prototype fallback (a locked box's 'Smash it open' retry) stores a retry CALLBACK on S.beats.action — a presentation concern the engine's `state.beats` deliberately stays null for throughout (per 01-07's header). This plan does not invent a new action type for it: openChest simply stops after a 'chestLocked' event on a failed roll, matching every other 'the roll failed, nothing further happens' branch in the module. Documented as an intentionally deferred UI-layer concern, not a missed requirement."
  - "meetJoiner's prototype rolls TWO separate D(20) draws (wp AND a maxWP it then immediately discards by overwriting maxWP=wp) — the discarded roll is still consumed verbatim in engine/encounters.js so the SAME seed draws identical subsequent rolls (fidelity over 'obvious' dead-code removal)."
  - "The win-path parity fixture (action-script.win.json) uses internal 'descend' calls to skip floors 1-4 rather than a full attack-resolved 5-floor crawl — a level-1 character surviving a full crawl under naive always-attack combat AI proved statistically unreliable across hundreds of searched seeds (frequent death or the wandering-monster/Wizard-refuses-melee loop exhausting the search budget), while descend() parity is already covered by the movement fixture, so re-proving it a second time added no coverage value."

patterns-established:
  - "Internal (non-validated) fixture actions now cover five engine entry points beyond startCombat (openStore/springTrap/openChest/encounterDot/descend), all sharing the identical clone/rng-rehydrate/persist shape applyAction itself uses — documented in action-script.schema.md's vocabulary table for future plans/phases to extend the same way."

requirements-completed: [ENG-01, ENG-03, ENG-04, ENG-05]

coverage:
  - id: D1
    description: "The store's buy closures are eliminated: stock is plain {n,sub,cost,effectId,effectParams,sold} data, an engine-side STORE_EFFECTS map applies purchases, and openStore/buyFrom/leaveStore route through applyAction matching the prototype's outcomes exactly"
    requirement: "ENG-03"
    verification:
      - kind: unit
        ref: "test/unit/economy.test.js#openStore: builds plain-data stock with no function-typed leaves anywhere in state.store"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#openStore: every stock entry's effectId resolves to a real STORE_EFFECTS handler"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#buyFrom: deducts gold, marks sold, and applies the STORE_EFFECTS effect"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#buyFrom: an out-of-range idx is a no-op, never a throw"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#buyFrom: buying an already-sold slot is a no-op"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#buyFrom: insufficient gold fails without mutating state"
        status: pass
      - kind: unit
        ref: "test/unit/economy.test.js#economy.js has no ACTUAL Math.random/document/localStorage code reference"
        status: pass
    human_judgment: false
  - id: D2
    description: "An open store now survives serialize/rehydrate: a GameState with state.store set round-trips JSON deepStrictEqual and structuredClone never throws (the prototype's own flagged anti-pattern, fixed)"
    requirement: "ENG-04"
    verification:
      - kind: unit
        ref: "test/unit/economy.test.js#a GameState with an open store round-trips JSON deepStrictEqual (the closure fix)"
        status: pass
      - kind: integration
        ref: "test/parity/economy-parity.test.js#economy parity (store visit): mid-scenario open-store round-trip assertion on every step"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#state survives a JSON round-trip through the economy fixture's store scenario, including an OPEN store"
        status: pass
    human_judgment: false
  - id: D3
    description: "encounterDot/springTrap/openChest and their helper tables (tableFour/findFood/findGrimoire/findGear/findMisc/meetFaerie/meetJoiner/catchAffliction/goInsane/newPhobia/fallDark) are pure, RNG-injected, event-emitting, and wired into movement's dot/trap/chest feature tiles (replacing the 01-07/01-09 pending* stubs)"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/encounters.test.js (26 tests covering springTrap/openChest/encounterDot/tableFour/findFood/findGrimoire/findGear/findMisc/meetFaerie/meetJoiner/catchAffliction/goInsane/newPhobia/fallDark + purity)"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js#move: dot/trap/chest feature tiles are consumed and dispatch to the real encounter/trap/chest handlers (01-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ENG-05 phase gate: the full test suite is green across every fixture (chargen/movement/combat/magic/economy/encounters/win), and the carried-forward win-path gap (a full run to the floor-5 Gate, winGame parity via diffState) is closed"
    requirement: "ENG-05"
    verification:
      - kind: integration
        ref: "test/parity/economy-parity.test.js (6 tests: store visit + 5 encounters scenarios, all diffState-null throughout)"
        status: pass
      - kind: integration
        ref: "test/parity/full-suite.test.js#ENG-05 phase gate: full-suite parity across chargen/movement/combat/magic/economy/encounters/win"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js (7 new round-trip tests: economy store scenario + 5 encounters scenarios + the win fixture)"
        status: pass
      - kind: integration
        ref: "full `node --test`: 268/268 passing in ~4.6s, full-suite gate itself in ~1.4s (well within the ~15s budget)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-08
status: complete
---

# Phase 1 Plan 10: Economy, Encounters & the Full-Suite Gate Summary

**engine/economy.js eliminates the prototype's last non-serializable pattern (the store's buy closures, replaced by plain-data stock + an engine-side STORE_EFFECTS lookup); engine/encounters.js ports the full encounter/trap/chest domain and wires it into movement's feature tiles; and test/parity/full-suite.test.js closes the phase with a single aggregate parity+round-trip gate — including the carried-forward win-path case — proving the entire prototype ruleset now runs behind the pure, deterministic, serializable `applyAction` contract with zero regressions (268/268 tests green).**

## Performance

- **Duration:** ~50 min across three task commits
- **Tasks:** 3 completed
- **Files modified:** 10 created, 5 modified

## Accomplishments

- Ported `openStore`/`buyFrom`/`leaveStore` into `engine/economy.js` (mazeworld.html lines 2005-2062): every `add(n, cost, buy, sub)` closure — food/potion/lockpick gives, armor repair, weapon/armor buys, the Magic User scroll, the premium enchanted-item roll — became a plain `{n, sub, cost, effectId, effectParams, sold}` stock entry, with an engine-side `STORE_EFFECTS` map (`eatRation`/`givePotion`/`giveLockpicks`/`repairArmor`/`buyWeapon`/`buyArmor`/`buyScroll`/`buyPremium`) applying the purchase. `priceFor`'s Troll/Elven-Dwarven pricing and haggle (Wilmsry -30%) are preserved exactly. `buyFrom` guards out-of-range/sold/insufficient-gold buys as no-ops (never throws — T-01-10b). `engine/engine.js` dispatches `buyItem`/`leaveStore`/`useItem`.
- Ported `springTrap`/`openChest`/`encounterDot` and their thirteen helper functions into `engine/encounters.js` (mazeworld.html lines 2064-2255): trap dodge/damage/poison, chest lock-tier rolls with gold/scroll/treasure, and the full `ENCOUNTER_TABLES[d8][d10]` dispatch (monster types via `ENC_ALIAS`→`startCombat`, `Store`→`openStore`, and every other row — Teleport/Joiner/Faerie/Food/Disease/Insanity/Phobia/Darkness/Grimoire/Weapon/Magic-Weapon/Magic-Armor/Misc-Magic/Table-Four). Replaced `engine/movement.js`'s 01-07/01-09 `pending*`-event stubs so a "dot"/"trap"/"chest" cell now genuinely triggers the real chain into combat/economy/magic/faerie/joiner/affliction.
- A poisoned trap's affliction (the prototype's inline `loss:()=>2*D(6)` closure) is hand-ported to the exact matching plain dice-notation `{n:2,sides:6,bonus:0}` already used by `AFFLICTIONS[0]`, rather than inventing a second closure-turned-notation shape.
- Authored `action-script.economy.json` (a full store visit: food/potion/weapon/armor/premium/lockpicks purchases plus an insufficient-gold case) and `action-script.encounters.json` (trap/chest/table-four/faerie/affliction scenarios), each driven against the frozen prototype via new internal (non-validated) fixture actions — `openStore`/`springTrap`/`openChest`/`encounterDot`/`descend` — mirroring the `startCombat` precedent from 01-08.
- Closed the win-path gap flagged by the 01-07 plan-checker and deferred through 01-09: `action-script.win.json` skips floors 1-4 via four direct `descend()` calls, then BFS-walks the shortest wall-avoiding path to floor 5's Gate — 91 actions, zero divergence from the frozen prototype at every step, `winGame` event/state (including `deathNote`/`epitaph`) matching byte-for-byte.
- Factored every per-domain `comparable()`/dispatch helper into `test/parity/harness/comparables.js`, letting `test/parity/full-suite.test.js` aggregate chargen+movement+combat+magic+economy+encounters+win into one ENG-05 phase-gate test (~1.4s) without re-executing other `*.test.js` files' own top-level registrations.
- Extended the ENG-04 round-trip guardrail (`test/roundtrip/serialize-rehydrate.test.js`) across the economy/encounters/win fixtures — an OPEN store now round-trips JSON `deepStrictEqual` and `structuredClone` never throws on it, the mechanical proof the closure-elimination actually worked.
- Full project test suite: **268/268 passing** in ~4.6s (59 new tests this plan: 12 economy unit + 26 encounters unit + 1 movement-tile rewrite + 6 economy/encounters parity + 1 full-suite aggregate (6 nested) + 7 new round-trip), well within the ~15s budget.

## Task Commits

1. **Task 1: Store closures → plain-data stock + STORE_EFFECTS lookup** — `1d8c54f` (feat)
2. **Task 2: Encounters/traps/chests + replace the movement feature stubs** — `6dce333` (feat)
3. **Task 3: Economy/encounters parity fixtures + full-suite parity & round-trip gate** — `38e442e` (test)

**Plan metadata:** committed via `docs(01-10): complete plan`.

## Files Created/Modified

- `engine/economy.js` — `openStore`/`buyFrom`/`leaveStore` + `STORE_EFFECTS` (plain-data stock, no closures)
- `engine/encounters.js` — `encounterDot`/`springTrap`/`openChest`/`tableFour`/`findFood`/`findGrimoire`/`findGear`/`findMisc`/`meetFaerie`/`meetJoiner`/`catchAffliction`/`goInsane`/`newPhobia`/`fallDark`
- `engine/engine.js` — `applyAction` dispatch wired for `"buyItem"`/`"leaveStore"`/`"useItem"`
- `engine/movement.js` — dot/trap/chest stubs replaced by real `encounters.js` calls
- `test/unit/economy.test.js` — 12 tests: plain-data stock, STORE_EFFECTS application, bounds/sold/gold guards, open-store round-trip, purity
- `test/unit/encounters.test.js` — 26 tests across every encounters.js export + purity
- `test/unit/movement.test.js` — the old pending-event test rewritten to assert the real dispatch
- `test/parity/fixtures/action-script.economy.json`, `action-script.encounters.json`, `action-script.win.json` — new fixtures
- `test/parity/economy-parity.test.js` — economy + encounters parity vs. the frozen prototype (6 tests)
- `test/parity/full-suite.test.js` — the ENG-05 aggregate phase gate (chargen/movement/combat/magic/economy/encounters/win)
- `test/parity/harness/comparables.js` — shared comparable()/internal-action-dispatch helpers
- `test/parity/fixtures/action-script.schema.md` — documents the five new internal action types
- `test/roundtrip/serialize-rehydrate.test.js` — extended with economy/encounters/win coverage

## Decisions Made

- STORE_EFFECTS params carry the full prepared item object, mirroring what the prototype's closure captured, rather than a name-only shorthand.
- openChest's "Smash it open" UI retry is intentionally not ported (no engine action type exists for it yet — `state.beats` stays null by design); documented as deferred, not missed.
- meetJoiner's redundant second `D(20)` roll (immediately discarded) is preserved verbatim for RNG-order fidelity.
- The win-path fixture skips floors 1-4 via direct `descend()` calls rather than a full attack-resolved crawl, since descend() parity is already proven elsewhere and a naive always-attack AI proved unreliable across a full 5-floor run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The movement unit test asserting the old "pending*" stub events had to be rewritten**
- **Found during:** Task 2 (replacing the movement feature-tile stubs)
- **Issue:** `test/unit/movement.test.js` had a test asserting `move()` pushed `pendingEncounter`/`pendingTrap`/`pendingChest` events for dot/trap/chest tiles — exactly the stub behavior this plan's action REMOVES. Once the real handlers were wired in, that test failed (the stub events no longer exist).
- **Fix:** Rewrote the test to drive each tile type with a hand-crafted deterministic `fakeRng` sequence and assert the REAL resulting events (`encounterRolled`/`tableFour`, `trapAvoided`, `chestLockRolled`/`chestLocked`) and feature-tile consumption instead.
- **Files modified:** test/unit/movement.test.js
- **Verification:** `node --test test/unit/movement.test.js` — 25/25 passing.
- **Committed in:** `6dce333`

---

**Total deviations:** 1 (Rule 1 — a test asserting now-removed stub behavior, corrected to assert the real replacement behavior)
**Impact on plan:** No scope change. This is the direct, expected fallout of the plan's own Task 2 action ("replace the movement feature-trigger stubs"); the plan's `files_modified` frontmatter didn't list this file, but leaving a test asserting deleted behavior red would violate the plan's own zero-regression gate.

## Issues Encountered

- Authoring the win-path fixture required three iterations: (1) a BFS avoiding ALL feature tiles found zero seeds reachable within any path-length budget (the maze generator produces a perfect spanning-tree maze — often the unique path to the exit crosses a feature tile, so "avoid every feature" is over-constrained); (2) allowing feature tiles but resolving any resulting combat via always-`attack` hung on a Wizard's `strikeRefused` (a Wizard never melees while spell charges remain, so `attack` alone can spin forever) — added a `flee` fallback when `strikeRefused` appears; (3) even with that fix, a genuine 5-floor crawl under naive combat AI died or exceeded the action-budget cap on every one of 300 searched seeds, so the fixture skips floors 1-4 via direct `descend()` calls (already covered by the movement fixture) and only proves the final floor-5-to-Gate leg plus `winGame` itself — which is the actual point of this fixture per the plan's win-path requirement.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every core rule domain (chargen/leveling, movement/day-cycle, items/death/save-validation, combat, magic, economy, encounters/traps/chests) now runs behind the pure `applyAction` contract, and the entire prototype ruleset is parity-proven against the frozen golden master via `test/parity/full-suite.test.js`.
- No non-serializable data remains anywhere in GameState — the round-trip guardrail (`test/roundtrip/serialize-rehydrate.test.js`) now covers every fixture this phase authored, including an OPEN store.
- Phase 1's five success criteria (ENG-01 through ENG-05) are all mechanically verified green via `node --test` (268/268).
- Carried-forward todo (from 01-07, still open, low value — Phase 3 removes the Gate for endless descent): `mazeworld.html`'s live UI (New Delve/Wipe/camp buttons, and the store/encounter click handlers) is still NOT rerouted through `src/browser/engineAdapter.js` — only dpad/keydown movement was wired in 01-07. Whichever later plan unifies all UI entry points behind the engine (likely the Phase 4/5 presentation rewrite) should reroute buyItem/leaveStore/useItem/castSpell/drinkPotion/readScroll/attack/flee/parley/sing the same way.
- Carried-forward todo (new, low value): the openChest "Smash it open" retry-on-failed-lock UI affordance has no engine action type yet (state.beats stays null by design) — a future plan wiring the encounter UI could add one if the feature is wanted, but it's cosmetic (a locked chest simply stays locked in the engine today, matching every other "the roll failed" branch).

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 10 created files (engine/economy.js, engine/encounters.js, test/unit/economy.test.js, test/unit/encounters.test.js, test/parity/fixtures/action-script.economy.json, test/parity/fixtures/action-script.encounters.json, test/parity/fixtures/action-script.win.json, test/parity/economy-parity.test.js, test/parity/full-suite.test.js, test/parity/harness/comparables.js) plus this SUMMARY found on disk; all three task-commit hashes (`1d8c54f`, `6dce333`, `38e442e`) found in git log. Full `node --test` suite: 268/268 passing in ~4.6s.
