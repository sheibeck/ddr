---
phase: 01-engine-extraction-determinism
plan: 05
subsystem: engine
tags: [applyAction, game-state, action-validation, character-generation, leveling, determinism, parity, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/rng.js (makeRng), engine/dice.js (rollDice), engine/maze.js (genFloor/reveal), content/*.js pure-data tables, test/parity harness (sandboxPrototype/diffState)"
provides:
  - "engine/engine.js: applyAction(state, action) → {state, events} — THE single pure engine entry point (structuredClone fail-fast, RNG rehydration, safe no-op on malformed input) + newRun re-export"
  - "engine/state.js: newRun(seed) GameState factory + STATE_VERSION — a fully JSON-serializable run (seed, rngState, dice-rolled character, floor 1, counters, null combat/store, flags)"
  - "engine/actions.js: ACTION_TYPES set + validateAction(action) — the single input-validation chokepoint (V5)"
  - "engine/events.js: EVENT_TYPES + structured event constructors (moved/struck/floorChanged/died/leveled) — no HTML/copy"
  - "engine/character.js: rollCharacter/rollSkills/rollGrimoire/checkLevel — RNG-injected, byte-identical to the prototype for a given seed"
  - "engine/derived.js: pure strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/skill/skillTier + MU school gates — all take an explicit character/state (no global S)"
affects: [01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The applyAction seam: validate → structuredClone(next) → rebuild rng from next.rngState → dispatch by action.type → persist next.rngState → return {state, events}. Slice plans add their handler to the switch; malformed/unknown actions are no-ops returning unchanged state (never throw)."
    - "structuredClone is deliberately NOT wrapped in try/catch — a stray closure or non-serializable value fails fast at the clone (ENG-04 protection), per 01-RESEARCH.md Pitfall 3."
    - "Object-literal property evaluation order IS the RNG-consumption order: rollCharacter's character object literal draws temperament(d12)→motive(d12)→potions(d6,MU)→cloak(d8,Thief)→grimoire(MU) in source order, so the port preserves the prototype's exact draw sequence and rolls a byte-identical adventurer."
    - "Derived numbers that the prototype read off global S now take an explicit `c` (character-only: strikeDie/weaponDamage/upkeep/foeDie/eff/skill) or `state` (needs combat/floor: toHit/foeToHitVs/inDark/canCast) parameter — no module global, fully unit-testable."

key-files:
  created:
    - engine/engine.js
    - engine/state.js
    - engine/actions.js
    - engine/events.js
    - engine/character.js
    - engine/derived.js
    - test/unit/engine-purity.test.js
    - test/unit/character.test.js
    - test/determinism/same-seed-same-result.test.js
    - test/parity/chargen-parity.test.js
    - test/parity/fixtures/action-script.chargen.json
  modified: []

key-decisions:
  - "Executed Task 2 (character.js/derived.js, TDD) BEFORE Task 1 (state.js/engine.js), because state.js imports rollCharacter and Task 1's acceptance (newRun(12345) round-trips) cannot pass until character generation exists. This is the natural dependency order; the plan's task numbering had the dependent module (state.js) listed first. engine/events.js (a Task 1 artifact) was created in the Task 2 GREEN commit since character.js's checkLevel emits leveled() events. Committed atomically as: RED test → GREEN character/derived/events → engine contract (state/actions/engine) → determinism/parity tests. (Rule 3 — blocking dependency ordering.)"
  - "Derived functions split their parameter by need: character-only reads (strikeDie/weaponDamage/upkeep/foeDie/eff/skill/skillTier) take `c`; reads that need combat or floor state (toHit/foeToHitVs/inDark/canCast) take `state`. Satisfies the acceptance 'pure functions of a passed character (no global S)' while faithfully porting the few functions that legitimately read S.combat/S.floor."
  - "chargen-parity reads ctx.S.c directly after loadPrototypeSandbox WITHOUT calling ctx.newGame() again — the frozen prototype's boot tail (`load() || newGame()`) already runs newGame() once during sandbox load, consuming the seeded stream from position 0 exactly as the engine's newRun(seed) does. Calling newGame() a second time draws from the advanced stream and diverges (caught and fixed during execution)."
  - "The chargen fixture carries both the schema-required scalar `seed` and a `seeds` array the determinism + parity tests iterate. The 14-seed set (1,2,3,4,6,7,8,13,15,19,24,29,32,35) was discovered programmatically to collectively hit all 3 classes, all 6 races, a Samurai (plate + magic weapon), and every special-grant grimoire branch (Wizard/Illusionist/Summoner/Sorcerer/Apprentice/Warlock/Cleric)."

patterns-established:
  - "Prototype parity for a rules domain: seed the vm-sandboxed frozen prototype and the engine with the same integer, run the equivalent boot/action, and assert diffState(protoSubtree, engineSubtree) === null over a covering seed set — the mechanical ENG-05 no-regression proof for each extracted slice."
  - "Action validation lives at exactly one chokepoint (validateAction, called first inside applyAction); presentation/network callers are untrusted and malformed input is a no-op, never a throw (Security V5 / threats T-01-05a, T-01-05b)."

requirements-completed: [ENG-01, ENG-02, ENG-05]

coverage:
  - id: D1
    description: "engine/engine.js exports the single pure applyAction(state, action) → {state, events}: validates the action, structuredClone's state (no try/catch), rehydrates the rng from next.rngState, dispatches by type, and returns unchanged state + empty events on malformed/unknown input without throwing"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/engine-purity.test.js#engine loads and runs with no DOM globals defined"
        status: pass
      - kind: unit
        ref: "test/unit/engine-purity.test.js#applyAction is a safe no-op on an unknown action"
        status: pass
      - kind: unit
        ref: "test/unit/engine-purity.test.js#applyAction is a safe no-op on a malformed move"
        status: pass
    human_judgment: false
  - id: D2
    description: "The engine tree references no DOM/render/storage/Math.random on any code line — enforced by a static comment-stripping scan of every engine/*.js file"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/engine-purity.test.js#engine/ references no DOM/render/storage/Math.random on any code line"
        status: pass
      - kind: unit
        ref: "test/determinism/rng-no-math-random.test.js#no Math.random on any non-comment line under engine/ or content/"
        status: pass
    human_judgment: false
  - id: D3
    description: "engine/actions.js validateAction rejects non-objects, unknown types, and malformed per-type fields (move.dir, buyItem.idx, castSpell.idx, useItem.i); ACTION_TYPES is the closed action vocabulary"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/engine-purity.test.js#validateAction rejects malformed actions"
        status: pass
    human_judgment: false
  - id: D4
    description: "engine/state.js newRun(seed) returns a fully JSON-serializable GameState (version/seed/rngState/c/floor/day/steps/combat:null/store:null/beats:null/dead:false/won:false/deathNote/epitaph) that round-trips deepStrictEqual through JSON"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/engine-purity.test.js#newRun produces a JSON round-trippable GameState"
        status: pass
      - kind: unit
        ref: "test/determinism/same-seed-same-result.test.js#newRun state survives a JSON round-trip for every fixture seed"
        status: pass
    human_judgment: false
  - id: D5
    description: "engine/character.js rollCharacter(rng) is RNG-injected and deterministic (same seed → deepStrictEqual character); the Fridgian-Samurai reroll invariant holds; Magic Users get a grimoire >= 4 spells; Thieves start with a cloak item"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/character.test.js#rollCharacter is deterministic: same seed → deepStrictEqual character"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#no Fridgian Samurai is ever rolled (reroll loop preserved)"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#Magic Users get a grimoire of >= 4 spells; Thieves start with a cloak"
        status: pass
    human_judgment: false
  - id: D6
    description: "engine/derived.js strikeDie/toHit/weaponDamage/upkeep/foeDie/levelFromSP are pure functions of a passed character/state (no global S), with correct race/subclass/skill modifiers"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/character.test.js#strikeDie is a pure function of the passed character"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#toHit is a pure function of the passed state"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#weaponDamage is pure and deterministic given a character + rng"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#upkeep is a pure function of the passed character"
        status: pass
    human_judgment: false
  - id: D7
    description: "engine/character.js checkLevel(state, rng, events) raises level when sp crosses THRESHOLDS and applies the Soldier→Knight, Apprentice-reveal, and Sorcerer spell-gain/forget rules, emitting leveled events"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/unit/character.test.js#checkLevel raises level when sp crosses a threshold"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#checkLevel: a Soldier is knighted at level 3"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#checkLevel: an Apprentice becomes a real subclass at level 3"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.js#checkLevel: a Sorcerer gains spells on level up"
        status: pass
    human_judgment: false
  - id: D8
    description: "newRun(seed) is byte-identical across two invocations for every fixture seed (ENG-02 determinism); the seed actually drives generation"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/determinism/same-seed-same-result.test.js#newRun(seed) is deterministic across the covering seed set"
        status: pass
      - kind: unit
        ref: "test/determinism/same-seed-same-result.test.js#different seeds produce different runs (the seed actually drives generation)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The engine's rolled character matches the frozen prototype's S.c field-for-field (diffState null) for every seed in a set collectively exercising all 3 classes, all 6 races, and a Magic User grimoire (ENG-05 chargen parity)"
    requirement: "ENG-05"
    verification:
      - kind: integration
        ref: "test/parity/chargen-parity.test.js#engine chargen matches the frozen prototype for every fixture seed"
        status: pass
      - kind: integration
        ref: "test/parity/chargen-parity.test.js#the fixture seed set collectively exercises all classes, races and a grimoire"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-09-07
status: complete
---

# Phase 1 Plan 5: The Engine Boundary — applyAction, GameState & Character Generation Summary

**engine/engine.js establishes the single pure `applyAction(state, action) → {state, events}` seam (validate → structuredClone → dispatch → persist rng) over a fully-serializable GameState from newRun(seed), and lands the first rule domain behind it — a 100%-dice-rolled character (generation, derived numbers, leveling) that is byte-identical to the frozen prototype for the same seed across all 3 classes, all 6 races, and every grimoire branch.**

## Performance

- **Duration:** ~7 min (23:44:39 → 23:51:46, per commit timestamps)
- **Started:** 2026-09-07T23:44:39-04:00 (first task commit)
- **Completed:** 2026-09-07T23:51:46-04:00 (last task commit)
- **Tasks:** 3 completed (Task 2 executed as TDD: RED + GREEN)
- **Files modified:** 11 created, 0 modified

## Accomplishments

- Built THE engine boundary: `engine/engine.js`'s `applyAction(state, action)` validates the action at the single chokepoint, deep-clones state with `structuredClone` (fail-fast, no try/catch), rebuilds the seeded rng from `next.rngState`, dispatches by `action.type` (slice handlers added by later plans), persists the rng cursor, and returns `{state, events}`. Malformed/unknown actions are safe no-ops that return the state unchanged and never throw (Security V5 / threats T-01-05a, T-01-05b).
- `engine/state.js`'s `newRun(seed)` produces a fully JSON-serializable GameState — `version`, `seed`, `rngState`, a dice-rolled character, floor 1 (via `genFloor(1, rng)` + `reveal`), `day`/`steps` counters, `null` combat/store/beats, and the dead/won/deathNote/epitaph flags — round-tripping `deepStrictEqual` through `JSON.stringify`/`parse`.
- `engine/actions.js` (`ACTION_TYPES` + `validateAction`) and `engine/events.js` (`EVENT_TYPES` + `moved`/`struck`/`floorChanged`/`died`/`leveled` constructors, no HTML) define the Action/Event contracts.
- Ported character generation RNG-injected and pure in `engine/character.js`: `rollCharacter`/`rollSkills`/`rollGrimoire`/`checkLevel`, preserving the prototype's EXACT roll order (class d6 → subclass d8 → race d8 → Fridgian/Samurai reroll → intel d20 → baseWP → skills shuffle → phobia d10 → temperament d12 → motive d12 → potions d6 → cloak d8 → grimoire → name) — including the object-literal property evaluation order that IS the draw order.
- `engine/derived.js` ports strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/skill/skillTier + the MU school gates as pure functions taking an explicit character/state (every `S.c` global read replaced with a passed parameter).
- Proved determinism (ENG-02) and prototype parity (ENG-05): `newRun(seed)` is byte-identical twice and JSON-round-trips per seed; the engine's rolled character matches the vm-sandboxed frozen prototype's `S.c` field-for-field (`diffState` null) across a 14-seed covering set.
- Full project test suite: 69/69 passing in ~2.1s (well within the ~15s budget) — 31 new tests this plan (16 character, 6 engine-purity, 3 determinism, 2 parity + 4 already-counted) atop 44 prior.

## Task Commits

Each task was committed atomically (Task 2 executed first — dependency order, see Deviations):

1. **Task 2 (TDD) RED: failing character/derived/leveling tests** — `c17afa9` (test)
2. **Task 2 (TDD) GREEN: character generation, derived numbers & leveling** — `79b0086` (feat) — includes engine/events.js (needed by checkLevel)
3. **Task 1: engine contract — state factory, actions/events, applyAction** — `7ecf655` (feat)
4. **Task 3: same-seed determinism + chargen parity vs frozen prototype** — `f362d19` (test)

**Plan metadata:** committed via `docs(01-05): complete plan`.

## Files Created/Modified

- `engine/engine.js` — pure `applyAction(state, action) → {state, events}` + `newRun` re-export
- `engine/state.js` — `newRun(seed)` GameState factory + `STATE_VERSION`
- `engine/actions.js` — `ACTION_TYPES` + `validateAction` (input validation chokepoint)
- `engine/events.js` — `EVENT_TYPES` + structured event constructors
- `engine/character.js` — `rollCharacter`/`rollSkills`/`rollGrimoire`/`checkLevel` (RNG-injected)
- `engine/derived.js` — pure derived numbers + MU school gates (no global S)
- `test/unit/engine-purity.test.js` — 6 tests: bare-context load, static no-DOM guard, validation, no-op safety, JSON round-trip
- `test/unit/character.test.js` — 16 tests: chargen determinism, invariants, pure derived numbers, leveling
- `test/determinism/same-seed-same-result.test.js` — 3 tests: same-seed byte-identity, seed divergence, per-seed round-trip
- `test/parity/chargen-parity.test.js` — 2 tests: engine-vs-prototype character parity, seed-set coverage
- `test/parity/fixtures/action-script.chargen.json` — covering seed set (empty actions; chargen exercised at newRun/boot)

## Decisions Made

- Executed Task 2 before Task 1 (natural dependency order — state.js imports rollCharacter); created engine/events.js in the Task 2 GREEN commit since checkLevel emits leveled() events. See Deviations.
- Derived functions take `c` (character-only reads) or `state` (reads needing combat/floor) explicitly — no global S — satisfying "pure functions of a passed character."
- chargen-parity reads `ctx.S.c` directly (the prototype's boot already ran newGame once from stream position 0); calling newGame() again would advance the stream and diverge.
- The chargen fixture's 14-seed set was discovered programmatically to guarantee full class/race/subclass/grimoire coverage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task execution reordered so the dependency (character.js) lands before its consumer (state.js)**
- **Found during:** Planning the Task 1 → Task 2 sequence
- **Issue:** The plan lists Task 1 (engine/state.js) first, but state.js imports `rollCharacter` from engine/character.js, which Task 2 creates. Task 1's own acceptance (`newRun(12345)` round-trips, engine-purity test loads the full import chain) therefore cannot pass until character.js/derived.js exist. Additionally, engine/character.js's `checkLevel` emits `leveled()` events from engine/events.js — a Task 1 artifact.
- **Fix:** Ran Task 2 (TDD: RED test → GREEN character.js/derived.js) first, creating engine/events.js in the GREEN commit as a genuine dependency, then Task 1 (state.js/actions.js/engine.js + engine-purity test), then Task 3 (determinism/parity). All commits remain atomic and correctly typed (test/feat/feat/test).
- **Files modified:** engine ordering only — no file content differs from the plan's intent.
- **Verification:** Each commit's acceptance verified green at commit time; full suite 69/69.
- **Committed in:** `c17afa9`, `79b0086`, `7ecf655`, `f362d19`

**2. [Rule 1 - Bug] chargen-parity initially double-booted the prototype, advancing the RNG stream and diverging**
- **Found during:** Task 3 (first parity run failed: seed 1 character mismatched at field `ar`)
- **Issue:** The test called `ctx.newGame()` after `loadPrototypeSandbox`, but the frozen prototype's boot tail (`load() || newGame()`) already runs `newGame()` once during sandbox load — consuming the seeded stream from position 0. The second call drew from the advanced stream, producing an entirely different character than the engine's fresh `newRun(seed)`.
- **Fix:** Read `ctx.S.c` directly (post-boot) without re-calling newGame(); documented the boot behavior in a code comment.
- **Files modified:** test/parity/chargen-parity.test.js
- **Verification:** All 14 seeds now match the prototype field-for-field (`diffState` null); suite 69/69.
- **Committed in:** `f362d19` (Task 3 commit)

---

**Total deviations:** 2 (1 Rule 3 dependency-ordering, 1 Rule 1 test bug)
**Impact on plan:** No scope change and no architectural change — the reorder is the natural dependency order and the parity fix corrected a test harness misuse, not engine behavior. All plan artifacts exist exactly as specified.

## Issues Encountered

- Threat-model mitigations T-01-05a (validate action shape, no-op on malformed) and T-01-05b (structuredClone not wrapped in try/catch — fail fast) are both implemented and covered by engine-purity tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `applyAction` seam is live: plan 01-06 (serialize/rehydrate + save-load validation) can build the standing round-trip guardrail on `newRun`/`applyAction`, and plans 01-07..01-10 (movement, combat, economy, death) each add their handler to the engine.js dispatch switch and their parity fixture.
- `engine/derived.js` supplies strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs the combat/movement slices need; `checkLevel` is ready for the sp-gain paths.
- Carried-forward todo (from STATE.md): the floor-5 Gate/winGame path is ported in 01-07 but not yet parity-tested — extend a movement/aggregate parity fixture with a win case there. Low long-term value (Phase 3 removes the Gate). No blocker for 01-06.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 11 created files + the SUMMARY found on disk; all 4 task-commit hashes (`c17afa9`, `79b0086`, `7ecf655`, `f362d19`) found in git log. Full `node --test` suite: 69/69 passing in ~2.1s.
