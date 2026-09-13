---
phase: 01-engine-extraction-determinism
plan: 08
subsystem: engine
tags: [combat, bestiary, initiative, flee, parley, bard, determinism, parity, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction dispatch), engine/state.js (newRun), engine/derived.js (toHit/strikeDie/weaponDamage/foeDie/foeToHitVs/inDark/skill/eff), engine/character.js (checkLevel), engine/items.js (takeItem/gainWilmst/rollTreasureItem, the forward-compatible state.combat.foes shape), engine/death.js (die/epitaphFor/epitaphCtx), engine/movement.js (maxCharges, the wandering-monster check stub), content/bestiary.js + content/encounters.js (BESTIARY/ENC_TYPES pure data), test/parity harness (sandboxPrototype/diffState)"
provides:
  - "engine/combat.js: startCombat/rollInitiative/liveFoes/playerStrike/killFoe/flee/canParley/parley/songReady/sing/endCombat/afterPlayerAction/allyTurn/foeTurn — the full combat domain, RNG-injected and event-emitting, behind applyAction"
  - "engine/engine.js: applyAction dispatches 'attack'/'flee'/'parley'/'sing' to engine/combat.js"
  - "engine/movement.js: newDay's wandering-monster check now actually starts a forced-random encounter (closing 01-07's flagged gap)"
  - "engine/items.js: useItem's stone/fire potion effects now call the real killFoe for full loot/skill-point/checkLevel resolution (closing 01-06's flagged gap)"
  - "test/parity/fixtures/action-script.combat.json + test/parity/combat-parity.test.js: win/lose/flee/parley parity vs. the frozen prototype"
  - "test/roundtrip/serialize-rehydrate.test.js: extended to prove the round-trip guardrail holds through an active state.combat sub-state"
affects: [01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A safe circular ESM import between two rule-domain modules (engine/combat.js <-> engine/items.js) is fine when every export on both sides is a hoisted `function` declaration and every cross-module call happens inside a function BODY invoked at runtime, never at module-evaluation time — the whole graph has finished loading by the time any game logic actually runs."
    - "Port what the prototype DOES, not what its data model implies: BESTIARY creature `sp.*` flags (poison/disease/steals/enthrall/awe/grapple/entangle/possess/raise/shriek/quills/ar/critOn/loot/song/pack/slow/halfDmg/age/pursues/seesInvis/noTurn/never_melee/dark/daggerOnly/caster/breaks/every) are flavor-only in the frozen prototype — grep-confirmed that none of them are ever read by any live logic path (only `sp.note` feeds the UI). Only `sp.atk`/`sp.dmg`/`sp.toHit`/`sp.fast`/`sp.magicOnly`/`sp.noArmor`/`sp.twice` (via `lives`) have mechanical effect, and only those are implemented here — adding mechanics for the rest would be an accidental deviation from canon, not a faithful port."
    - "A non-validated internal function (startCombat) that other rule domains call directly (not a player-facing action in engine/actions.js's ACTION_TYPES) still needs an applyAction-shaped entry point for fixtures/tests to drive deterministically: clone -> rebuild rng from the persisted cursor -> call the function -> persist the rng cursor. Both test/parity/combat-parity.test.js and test/roundtrip/serialize-rehydrate.test.js hand-roll this same shape rather than stretching applyAction's validated dispatch to cover an unvalidated internal call."

key-files:
  created:
    - engine/combat.js
    - test/unit/combat.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/combat-parity.test.js
  modified:
    - engine/engine.js
    - engine/movement.js
    - engine/items.js
    - test/unit/movement.test.js
    - test/roundtrip/serialize-rehydrate.test.js
    - test/parity/fixtures/action-script.schema.md

key-decisions:
  - "Tasks 1 and 2 landed in a single commit rather than two: both add functions to the SAME new file (engine/combat.js) with mutual call dependencies in both directions (playerStrike calls killFoe/afterPlayerAction; afterPlayerAction calls foeTurn/allyTurn/endCombat — all 'Task 2' functions), so there is no clean intermediate green state to split a commit on. Same 'unavoidable due to real coupling' reasoning 01-05/01-06/01-07 used for their own forced task reorderings."
  - "Closed two gaps the two PRIOR plans explicitly flagged as this plan's job: engine/movement.js's newDay wandering-monster check now calls combat.js's startCombat instead of only emitting an event (01-07's carried-forward todo), and engine/items.js's useItem now calls the real killFoe for its stone/fire potion effects instead of 01-06's minimal wp/alive/kills stand-in (01-06's carried-forward todo) — both required a circular import between combat.js and movement.js/items.js, verified safe (see tech-stack pattern) and proven by the full suite staying green."
  - "SONGS (the Bard's song bank) is kept as a small local pure-data const inside engine/combat.js rather than added to content/*.js — nothing else in the engine needs it, and the plan's files_modified list didn't call for a new content module. A future presentation layer wanting the flavor `txt` field can import it from here."
  - "The combat action-script fixture uses FOUR INDEPENDENT scenarios (win/lose/flee/parley), each its own seed + forced encounter type, rather than one long fixture — a single continuous fight can't deterministically produce all four outcomes, and forcing the encounter type (bypassing the ENC_TYPES roll) is what the plan's Task 3 explicitly recommends for fixture determinism."
  - "startCombat is intentionally NOT added to engine/actions.js's validated ACTION_TYPES — it is an internal function other rule domains call (movement's wandering-monster check; the encounters domain's dot tile, once 01-09/01-10 lands it), not a player-facing input. The combat fixture's `startCombat` entries are handled by a small `applyStartCombat` test helper (clone/rng-rehydrate/persist, same shape as applyAction) rather than smuggling an unvalidated action type into the real dispatcher."

patterns-established:
  - "A rule domain's data-vs-code asymmetry with the frozen prototype (content tables ported to plain dice-notation data on the engine side, while the prototype's own BESTIARY still holds live closures) needs its own comparator carve-out, exactly like the `beats`/`initNote` narration-field carve-outs before it — strip the un-comparable 'recipe' representation, keep comparing its mechanical RESULT."

requirements-completed: [ENG-01, ENG-05]

coverage:
  - id: D1
    description: "startCombat builds a deterministic, BESTIARY-driven foe list (type/count/level scaling, Tracking, Warlock/Knight/Con Artist/Court Mage interactions, phobia freeze, ally join) and playerStrike resolves the player's attack (Wizard refusal, attack count incl. Barbarian/Ambidextrous/haste/Fridgian frenzy, criticals, killFoe on lethal) — all pure and RNG-injected behind applyAction"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js#startCombat: builds a deterministic foe list from BESTIARY for a fixed seed"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#playerStrike: a hit applies weaponDamage, kills the foe on lethal wp, and clears the encounter"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#playerStrike: Barbarian, Ambidextrous, and haste each grant two attacks"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#playerStrike: Fridgian frenzy grants a second wild swing, which can be wasted on a corpse"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#playerStrike: a Wizard refuses to melee while a spell charge remains"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#combat.js references no Math.random/document/localStorage"
        status: pass
    human_judgment: false
  - id: D2
    description: "killFoe awards the prototype's skill-point formula and loot via the injected rng; foeTurn resolves creature attacks (sp.atk/sp.dmg/sp.toHit/sp.fast/sp.magicOnly/sp.noArmor, ward/armor mitigation) and triggers die() at wp<=0"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js#killFoe: awards d6 x level x mul skill points, rolls coin, and calls checkLevel"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#killFoe: a foe with `lives: 2` gets back up once instead of dying"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#foeTurn: a landed critical hit damages the player, and wp<=0 triggers die('combat')"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#foeTurn: armor soaks a blow that lands under the character's AR"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#foeTurn: a sleeping foe skips its turn without drawing a die"
        status: pass
    human_judgment: false
  - id: D3
    description: "flee/canParley/parley/songReady/sing resolve per the prototype's class/skill/race rules and end combat cleanly on success"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js#flee: a Samurai refuses to run"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#flee: a Thief's +5 bonus can turn a marginal roll into a clean escape"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#canParley: Con Artist/Woodsman/Bard/Language/Wilmsry/Elven gates match the prototype"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#parley: a Con Artist can always parley, and success ends combat with skill points"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js#sing: a Bard's highest available song can put foes to sleep"
        status: pass
    human_judgment: false
  - id: D4
    description: "The combat parity fixture (win, lose->death, flee, parley) matches the frozen prototype after every action; the round-trip guardrail stays green through an active combat sub-state"
    requirement: "ENG-05"
    verification:
      - kind: integration
        ref: "test/parity/combat-parity.test.js#combat parity (win): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/combat-parity.test.js#combat parity (lose): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/combat-parity.test.js#combat parity (flee): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/combat-parity.test.js#combat parity (parley): engine matches the frozen prototype after every action"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#state survives a JSON round-trip through the combat fixture's \"lose\" scenario, including mid-fight combat sub-state"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-08
status: complete
---

# Phase 1 Plan 8: Combat — Encounters, Strikes, Kills, Foe Turns & Flee/Parley/Sing Summary

**engine/combat.js ports the entire combat rule domain (encounter setup, initiative, player strikes, kills, foe turns, allies, flee/parley/sing) as pure, RNG-injected, event-emitting handlers behind `applyAction`, proven byte-identical to the frozen prototype across win/lose/flee/parley scenarios — including a genuine parity-harness gap (prototype BESTIARY damage closures vs. the engine's serializable dice notation) discovered and fixed along the way.**

## Performance

- **Duration:** ~30 min (00:59:50 -> 01:05:45 per commit timestamps, plus preceding exploration/design/discovery-script time)
- **Started:** 2026-09-08T00:59:50-04:00 (first task commit)
- **Completed:** 2026-09-08T01:05:45-04:00 (last task commit)
- **Tasks:** 3 completed (Tasks 1+2 combined into one commit — see Decisions/Deviations; Task 3 its own commit)
- **Files modified:** 4 created, 6 modified

## Accomplishments

- Ported the prototype's entire combat domain (mazeworld.html lines 2257-2903) into `engine/combat.js`: `startCombat` (BESTIARY-driven encounter setup with Tracking, the Warlock walking-dead boost, Knight/Con Artist/Court Mage foe removals, phobia freeze, ally join, and initiative), `rollInitiative`/`liveFoes`, `playerStrike` (Wizard melee refusal, frozen-round skip, attack count incl. Barbarian/Ambidextrous/haste/Fridgian frenzy with the wasted-swing-on-corpse roll, all critical rules, weaponDamage, killFoe), `killFoe` (lives/kill-twice, the d6×level×mul skill-point formula, coin/treasure/cooking, checkLevel), `foeTurn` (per-foe swings honoring `sp.atk`/`sp.dmg`/`sp.toHit`/`sp.fast`/`sp.magicOnly`/`sp.noArmor` — the only BESTIARY `sp.*` flags the prototype's live logic ever mechanically reads — ward absorb/reflect/shatter, armor soak, `die()` on wp<=0), and `flee`/`canParley`/`parley`/`songReady`/`sing`/`endCombat`/`afterPlayerAction`/`allyTurn`, all RNG-injected and event-emitting.
- `engine/engine.js` dispatches `attack`/`flee`/`parley`/`sing` to these handlers.
- Closed two gaps the prior two plans flagged explicitly as this plan's job: `engine/movement.js`'s `newDay` wandering-monster check now actually starts a forced-random encounter via `startCombat` (01-07's carried-forward todo), and `engine/items.js`'s `useItem` now calls the real `killFoe` for its stone/fire potion effects — full loot/skill-point/checkLevel resolution — instead of 01-06's minimal wp/alive/kills stand-in (01-06's carried-forward todo). Both required a circular ESM import (`combat.js` <-> `movement.js`/`items.js`) that is safe because every export on both sides is a hoisted `function` declaration only ever called at runtime, after the whole module graph has loaded — proven by the full 178-test suite staying green.
- Built `test/parity/fixtures/action-script.combat.json` + `test/parity/combat-parity.test.js`: four independent scenarios (win, lose/death, flee, parley), each its own seed + forced encounter type (found via a throwaway discovery script that simulated the engine directly until it produced the desired outcome, then cross-checked for real prototype parity — same method 01-05/01-07 used for chargen/movement seeds). `startCombat` isn't a validated engine action (`engine/actions.js`'s `ACTION_TYPES`) since it's an internal function other rule domains call, not a player input — the test special-cases it with a hand-rolled clone/rng-rehydrate/persist helper mirroring `applyAction`'s own shape.
- Diagnosed and fixed a genuine parity-harness gap while wiring this up: the frozen prototype's BESTIARY stores a creature's damage as a live closure (`dmg: () => D(8)`), which `content/bestiary.js` deliberately ports to plain dice notation for engine-side serializability — a live function value on the prototype side makes `stripVolatileFields`'s `structuredClone` throw the instant a `diffState` call sees an active foe with a `dmg` field. Some seeds "happened" to pass before this was diagnosed (whichever foe they rolled lacked a `dmg` field); the 10-round "lose" scenario did not. Fixed by stripping the un-comparable `sp.dmg`/`acid.dmg` "recipe" field from both sides before every comparison, in the same spirit as the existing `beats`/`combat.initNote` narration-field carve-outs — the mechanical RESULT of resolving it (wp changes) is still fully compared as plain numbers, so no real parity coverage is lost.
- Extended the standing ENG-04 round-trip guardrail (`test/roundtrip/serialize-rehydrate.test.js`) with the same combat fixture, proving serialize/rehydrate stays lossless through an ACTIVE `state.combat` sub-state (foes, ally, in-progress round), not just before/after a fight.
- Added 27 unit tests (`test/unit/combat.test.js`) covering branches the parity fixture doesn't reach without hand-crafted foe/character states: multi-attack subclasses, Fridgian frenzy, Death-touch/backstab/stealth criticals, kill-twice foes, armor soak, sleeping foes, every flee/parley gate, and the Bard's song tiers.
- Full project test suite: **178/178 passing** in ~4s (35 new tests this plan — 27 combat unit + 4 combat-parity + 4 combat round-trip, plus 1 already-counted movement test update) atop 143 prior, well within the ~15s budget.

## Task Commits

1. **Tasks 1+2 (combined — see Decisions): combat domain — encounter setup, strikes, kills, foe turns, flee/parley/sing** — `ce9fe33` (feat)
2. **Task 3: combat parity fixtures (win/lose/flee/parley) vs the frozen prototype** — `eb459aa` (test)

**Plan metadata:** committed via `docs(01-08): complete plan`.

## Files Created/Modified

- `engine/combat.js` — startCombat/rollInitiative/liveFoes/playerStrike/killFoe/flee/canParley/parley/songReady/sing/endCombat/afterPlayerAction/allyTurn/foeTurn (RNG-injected, event-emitting)
- `engine/engine.js` — applyAction dispatch wired for `"attack"`/`"flee"`/`"parley"`/`"sing"`
- `engine/movement.js` — `newDay`'s wandering-monster check now calls `startCombat`
- `engine/items.js` — `useItem`'s stone/fire cases now call the real `killFoe`; exports `LOOT_DIVISOR`
- `test/unit/combat.test.js` — 27 tests: startCombat determinism/foe-removal rules, playerStrike (hits/misses/crits/attack-count/frenzy/Wizard-refusal), killFoe (skill points/loot/kill-twice), foeTurn (damage/armor/sleep), flee/canParley/parley/songReady/sing, endCombat's `senses` side effect, afterPlayerAction/allyTurn, purity
- `test/unit/movement.test.js` — updated the wandering-monster test for the now-real `startCombat` call
- `test/parity/fixtures/action-script.combat.json` — 4 scenarios (win/lose/flee/parley), each its own seed + forced type
- `test/parity/combat-parity.test.js` — engine-vs-prototype parity across all 4 scenarios, incl. the `sp.dmg`/`acid.dmg` closure-vs-data carve-out
- `test/roundtrip/serialize-rehydrate.test.js` — extended with the combat fixture's mid-fight round-trip coverage
- `test/parity/fixtures/action-script.schema.md` — documents the new `startCombat` (non-validated, internal) fixture action type

## Decisions Made

- Tasks 1 and 2 landed in one commit (mutual call dependencies within the same new file leave no clean intermediate green state). See Deviations.
- Closed both 01-06's and 01-07's explicitly-flagged carried-forward gaps (useItem's stone/fire → real killFoe; newDay's wandering-monster check → real startCombat) rather than deferring them further, since this is the first plan where the dependency (combat.js) actually exists.
- SONGS (the Bard's song bank) stays a local pure-data const in combat.js rather than a new content/*.js module — nothing else needs it yet.
- The combat fixture uses four independent seed+forced-type scenarios rather than one continuous fight, since a single fight can't deterministically produce all four outcomes.
- `startCombat` is deliberately NOT added to `ACTION_TYPES` — it's an internal cross-domain call, not a player action; fixtures/tests drive it via a small `applyStartCombat` helper matching `applyAction`'s own clone/rng/persist shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 1 and 2 combined into a single commit**
- **Found during:** Planning the Task 1 → Task 2 commit sequence
- **Issue:** The plan lists Task 1 (`startCombat`/`rollInitiative`/`liveFoes`/`playerStrike`) and Task 2 (`killFoe`/`foeTurn`/`flee`/`parley`/`sing`/`endCombat`/`afterPlayerAction`/`allyTurn`) as separate commits in the same new file, but `playerStrike` (Task 1) calls `killFoe` and `afterPlayerAction` (Task 2), while `afterPlayerAction` (Task 2) calls `foeTurn`/`allyTurn`/`endCombat` (also Task 2) — there is no way to commit Task 1's functions alone with a passing test suite, since they reference not-yet-defined Task 2 functions.
- **Fix:** Implemented and committed the entire `engine/combat.js` file (both tasks' functions) in a single commit, verified green (170/170, then 178/178 after Task 3) at that commit.
- **Files modified:** engine/combat.js, engine/engine.js, engine/movement.js, engine/items.js, test/unit/combat.test.js, test/unit/movement.test.js — commit ordering/scope only, no content differs from the plan's intent.
- **Verification:** Full suite green at the commit; acceptance criteria for both tasks independently verified via `test/unit/combat.test.js`.
- **Committed in:** `ce9fe33`

**2. [Rule 2 - Missing Critical] Closed 01-07's flagged gap: the wandering-monster check now actually starts combat**
- **Found during:** Task 2, wiring `afterPlayerAction`/`foeTurn` and re-reading `engine/movement.js`'s `newDay`
- **Issue:** 01-07 left `newDay`'s wandering-monster check emitting only a `wanderingMonster` event, explicitly documented as "Starting combat from that check is deferred to the combat slice (01-08)" — without this wiring, wandering monsters would have zero mechanical effect in the finished engine, a functional gap this plan is positioned to close (combat.js now exists).
- **Fix:** `newDay` now calls `startCombat(state, true, null, rng, events)` when `woke > 0`.
- **Files modified:** engine/movement.js, test/unit/movement.test.js (updated the affected test's rng sequence and assertions)
- **Verification:** `test/unit/movement.test.js#newDay: a fed character heals, and a wandering-monster hit starts a forced-random encounter (01-08)` passes; full suite green.
- **Committed in:** `ce9fe33`

**3. [Rule 1 - Bug] Closed 01-06's flagged gap: useItem's stone/fire potions now fully resolve via the real killFoe**
- **Found during:** Task 2, implementing `killFoe` and re-reading `engine/items.js`'s `useItem`
- **Issue:** 01-06 implemented `useItem`'s stone/fire foe-targeting effects with minimal bookkeeping (`f.wp=0; f.alive=false; c.kills++`) because `killFoe` didn't exist yet, explicitly flagged as "full combat resolution (loot, victory checks) is deferred to the combat slice (01-08)." The frozen prototype's own `useItem` calls the real `killFoe` for both cases (verified by direct read of mazeworld.html lines 1995-1996) — the 01-06 stand-in was a genuine, acknowledged incompleteness, not an intentional final behavior.
- **Fix:** `useItem`'s "stone" and "fire" cases now call `killFoe(state, f, rng, events)`, matching the prototype exactly (full skill points/loot/cooking/checkLevel on every stone/fire kill). This introduces a circular ESM import between `items.js` and `combat.js`, verified safe (both modules only call each other's exports from inside function bodies invoked at runtime; every export involved is a hoisted `function` declaration).
- **Files modified:** engine/items.js (imports `killFoe`, exports `LOOT_DIVISOR` for `combat.js` to share)
- **Verification:** Full suite green (170/170 after Task 1+2, 178/178 after Task 3); no test currently exercises this specific potion-in-combat path end-to-end (no existing test constructed that scenario), but the change is a direct, verified-safe substitution of the prototype's own call, not new logic.
- **Committed in:** `ce9fe33`

**4. [Rule 1 - Bug] The parity harness's `structuredClone`-based comparator cannot tolerate the prototype's own BESTIARY damage closures**
- **Found during:** Task 3, the "lose" scenario's parity test (a 10-round fight)
- **Issue:** `stripVolatileFields` (test/parity/harness/diffState.js, from 01-05) deep-clones both sides via `structuredClone` before comparing. The frozen prototype's BESTIARY stores creature damage as a live closure (`dmg: () => D(8)`, e.g. Cave Bear); `content/bestiary.js` deliberately ports this to plain `{n,sides,bonus}` dice notation for engine-side serializability. Whenever the ACTUAL foe encountered in a scenario has a `dmg` field, `ctx.S.combat.foes[i].sp.dmg` is a live function on the prototype side, and `structuredClone` throws outright the moment ANY diffState call runs while that foe is present. Several scenarios' seeds "happened" to draw a foe with no `dmg` field and passed by luck; the "lose" scenario's foe did not, surfacing the bug.
- **Fix:** `test/parity/combat-parity.test.js`'s `comparable()` now strips `combat.foes[].sp.dmg` and `combat.foes[].acid.dmg` from BOTH sides before every `diffState` call, alongside the existing `beats`/`initNote` narration-field carve-outs — documented at length in the test's own header comment. The mechanical RESULT of resolving that damage (the foe's/player's `wp` after the roll) is still fully compared as a plain number, so no real coverage is lost; only the un-comparable "recipe" representation is excluded.
- **Files modified:** test/parity/combat-parity.test.js
- **Verification:** All 4 scenarios pass (`combat parity (win/lose/flee/parley)`); full suite 178/178.
- **Committed in:** `eb459aa`

---

**Total deviations:** 4 (1 Rule 3 commit-scope combination, 2 Rule 1/2 gap-closures explicitly flagged by prior plans, 1 Rule 1 harness bug discovered and fixed)
**Impact on plan:** No scope change and no architectural change. The commit combination is the file's own real coupling forcing it; the two gap-closures were pre-flagged carried-forward todos this plan was positioned to close and are direct substitutions of already-designed-for call sites; the harness fix is a necessary correction to a pre-existing (01-05) comparator limitation this plan's foe-closure data was the first to expose, not a regression in this plan's own code.

## Issues Encountered

- BESTIARY `sp.*` flags beyond `atk`/`dmg`/`toHit`/`fast`/`magicOnly`/`noArmor`/`twice` (poison/disease/steals/enthrall/awe/grapple/entangle/possess/raise/shriek/quills/ar/critOn/loot/song/pack/slow/halfDmg/age/pursues/seesInvis/noTurn/never_melee/dark/daggerOnly/caster/breaks/every) are grep-confirmed to be flavor-only in the frozen prototype (never read by any live logic path) — implementing mechanics for them would be an accidental deviation from canon, not a gap. Documented at length in `engine/combat.js`'s module header for whoever next reads the BESTIARY table and wonders why, e.g., `poison`/`disease`/`grapple` do nothing.
- `useItem`'s stone/fire-in-combat path (now calling the real `killFoe`) has no dedicated end-to-end test in this plan — flagged for whichever future plan extends item/combat interaction coverage (economy/items slice, 01-09/01-10, or a later hardening pass).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/combat.js` is a complete, tested, parity-proven consequence surface: `killFoe`/`endCombat` are ready for any later slice that needs to end a fight or award a kill (e.g. a future "cast spell that kills a foe" magic domain, or the encounters domain's dot-triggered `startCombat` call).
- The combat parity fixture's `_note` documents exactly how its four scenario seeds were found (forced encounter type + a throwaway discovery script) — 01-09/01-10 should follow the same method for their own fixtures rather than hand-guessing seeds.
- Carried-forward todo: `useItem`'s stone/fire-in-combat path has no dedicated end-to-end test — a future items/economy hardening plan should add one now that `killFoe` is real.
- Carried-forward todo: `mazeworld.html`'s live combat UI (keydown/click handlers for strike/potion/flee/spell/parley/sing, `renderEncounter()`) is NOT yet routed through the engine — only `move`/`camp` were wired in 01-07's browser adapter. Whichever plan extends `src/browser/engineAdapter.js` to cover combat input should route `attack`/`flee`/`parley`/`sing` the same way movement was routed (overwrite the global functions the existing UI already calls).
- castSpell (the magic domain) remains fully unported; `engine/combat.js`'s `foeTurn`/`playerStrike` already faithfully READ every field a spell can set (`c.ward`/`c.regen`/`c.mirror`/`C.weakened`/`C.foeToHitPenalty`), so a future magic-domain plan should be able to land `castSpell` without touching combat.js at all.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 5 created/output files found on disk; both task-commit hashes (`ce9fe33`, `eb459aa`) found in git log. Full `node --test` suite: 178/178 passing in ~3.9s.
