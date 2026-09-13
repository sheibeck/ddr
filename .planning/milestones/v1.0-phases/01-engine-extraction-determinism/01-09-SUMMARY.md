---
phase: 01-engine-extraction-determinism
plan: 09
subsystem: engine
tags: [magic, spells, potions, scrolls, charges, grimoire, determinism, parity, node-test]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/engine.js (applyAction dispatch), engine/derived.js (canCast/schoolGate/schoolBonus/canLearn/eff/skill), engine/combat.js (liveFoes/killFoe/afterPlayerAction — already reading every field a spell can set), engine/movement.js (maxCharges), engine/death.js (die), content/spells.js + content/mu-chart.js (SPELLS/MU_CHART pure data), test/parity harness (sandboxPrototype/diffState)"
provides:
  - "engine/magic.js: castSpell/drinkPotion/readScroll/canRead — the full magic domain (every SPELLS kind, charge economy, grimoire/school gating, Apprentice backfire, intelligent-target resistance), RNG-injected and event-emitting behind applyAction"
  - "engine/engine.js: applyAction dispatches 'castSpell'/'drinkPotion'/'readScroll' to engine/magic.js"
  - "test/parity/fixtures/action-script.magic.json + test/parity/magic-parity.test.js: cast-damage/heal/potion/scroll parity vs. the frozen prototype"
  - "test/roundtrip/serialize-rehydrate.test.js: extended through the magic fixture's four scenarios plus a dedicated ward (Shield) sub-state round-trip"
affects: [01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "castSpell's short-circuiting RNG draws (a d10 only rolled when the d6 roll was 4, a d20 treasure-check roll that gates whether rollTreasureItem draws further) are preserved verbatim inside the same if/else-if chain shape as the prototype, not refactored into pre-computed booleans — the roll-consumption ORDER is the actual determinism contract, and the magic-parity fixture proved this held on the very first run (no fix-up needed)."
    - "Offensive spells are a thin consumer of engine/combat.js's existing killFoe/liveFoes/afterPlayerAction rather than duplicating kill/loot/checkLevel logic — 01-08's combat.js header already documented that its playerStrike/foeTurn faithfully READ every field a spell can set (c.ward/c.regen/c.mirror/C.weakened/C.foeToHitPenalty); this plan is the thing that finally SETS them, closing that carried-forward gap with zero changes to combat.js itself."
    - "A scroll's cast (readScroll) reuses castSpell directly rather than re-implementing spell resolution: it swaps in a temporary spellsUsed=0/scrollCast=true window (bypassing the caster's own charge economy and grimoire/level gates, exactly like the prototype), calls castSpell, then restores the caller's real spellsUsed — a same-module direct call, not a new code path."

key-files:
  created:
    - engine/magic.js
    - test/unit/magic.test.js
    - test/parity/fixtures/action-script.magic.json
    - test/parity/magic-parity.test.js
  modified:
    - engine/engine.js
    - test/roundtrip/serialize-rehydrate.test.js
    - test/parity/fixtures/action-script.schema.md

key-decisions:
  - "Task 1 and Task 2 landed engine/magic.js's full contents (castSpell AND drinkPotion/readScroll) plus all three applyAction dispatch cases in a single commit, rather than the plan's two-commit split — readScroll calls castSpell directly (a same-file, same-direction call dependency, not a cycle), so there is no clean intermediate state where only castSpell exists and the file is 'done' for Task 1's commit. Task 2's own commit then only needed the parity fixture/test and round-trip extension, which is exactly what landed."
  - "Magic parity fixture seeds (8: an Illusionist with Freeze in its level-1-reachable grimoire; 7: a Wizard with Heal in its grimoire and a scroll on hand; 1: any class, for the potion) were found with the same throwaway-discovery-script method 01-05/01-07/01-08 used for their own fixtures — an engine-only scan of newRun(seed) for 1-5000, cross-checked for real prototype parity before being committed. All four scenarios passed diffState-null on the very first parity run with no roll-order fix-up needed."
  - "The round-trip guardrail's ward/spell sub-state proof is a dedicated synthetic test (newRun(1), then manually setting c.grimoire=['Shield'] before casting) rather than relying on a fixture seed happening to roll Shield into its grimoire naturally — this is a serialization proof (ENG-04: does the ward's pool/rounds/reflect/name shape survive JSON?), not a prototype-parity proof, so a hand-crafted state is the more direct test."

patterns-established:
  - "A single spell-kind switch's per-branch event names are the engine's OWN new vocabulary (spellHit/spellMissed/wardRaised/earthquake/insaneRolled/etc.) — there is no prototype event schema to match against (the prototype only had say()/evt() HTML strings), so naming is free within the existing loose-event-typing contract (01-RESEARCH.md Open Question 1: assert state strictly, events loosely)."

requirements-completed: [ENG-01, ENG-05]

coverage:
  - id: D1
    description: "castSpell resolves every SPELLS kind (heal/ward/might/status/thrown/reveal/mirror/stun/weaken/acid/quake/vapor/volley/petrify/insane/summon/turn/gate/senses/foresee/regen/death/stupid/blind/shrink) through applyAction, gated by charge economy (maxCharges/spellsUsed) and grimoire/school (canCast), with the Apprentice's one-in-eight backfire and the intelligent-target resistance roll preserved"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: no charges left is a no-op"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: a spell not in the grimoire is refused"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: a school the subclass may not yet work is refused"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: an Apprentice's thrown spell can backfire and hurt the caster"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: a lethal Apprentice backfire kills the caster"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: a thrown damage spell (Fireball) applies rollDice damage and kills the foe on lethal wp"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Heal caps at maxWP"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Shield sets a ward pool/rounds"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Bubble sets a reflecting ward pool"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Strength grants +damage and doubles Win Potential once"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Earthquake damages every foe AND the caster when unwarded"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#castSpell: Earthquake spares the caster behind a ward"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#magic.js references no Math.random/document/localStorage"
        status: pass
    human_judgment: false
  - id: D2
    description: "drinkPotion and readScroll (with canRead's Pilfer/Runes-Signs gate) route through applyAction, apply the prototype's effects, and readScroll's grimoire-copy vs. free-cast branches both work"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/magic.test.js#drinkPotion: heals and decrements the potion count; a no-op with none left"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#drinkPotion: caps at maxWP"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#canRead: a Pilfer can never read a scroll; a Magic User always can"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#readScroll: a learnable, unknown spell is copied into the grimoire instead of cast"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#readScroll: an already-known spell is cast for free, ignoring the charge economy"
        status: pass
      - kind: unit
        ref: "test/unit/magic.test.js#readScroll: no scrolls or cannot read is a no-op"
        status: pass
    human_judgment: false
  - id: D3
    description: "The magic parity fixture (cast-damage, heal, potion, scroll) matches the frozen prototype after every action; the round-trip guardrail stays green through the magic fixture's scenarios and a dedicated ward sub-state"
    requirement: "ENG-05"
    verification:
      - kind: integration
        ref: "test/parity/magic-parity.test.js#magic parity (cast-damage): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/magic-parity.test.js#magic parity (heal): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/magic-parity.test.js#magic parity (potion): engine matches the frozen prototype after every action"
        status: pass
      - kind: integration
        ref: "test/parity/magic-parity.test.js#magic parity (scroll): engine matches the frozen prototype after every action"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#state survives a JSON round-trip through the magic fixture's scenarios"
        status: pass
      - kind: unit
        ref: "test/roundtrip/serialize-rehydrate.test.js#a mid-cast ward sub-state (Shield) round-trips losslessly"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-08
status: complete
---

# Phase 1 Plan 9: Magic — Spellcasting, Potions & Scrolls Summary

**engine/magic.js ports the prototype's entire magic domain — every one of the 32 SPELLS kinds, potions, and scrolls — as pure, RNG-injected, event-emitting handlers behind `applyAction`, proven byte-identical to the frozen prototype across cast-damage/heal/potion/scroll scenarios on the very first parity run, with zero changes needed to `engine/combat.js` (which already read every field a spell sets).**

## Performance

- **Duration:** ~25 min (01:21:18 → 01:23:40 per commit timestamps, plus preceding research/design/discovery-script time)
- **Started:** 2026-09-08T01:21:18-04:00 (first task commit)
- **Completed:** 2026-09-08T01:23:40-04:00 (last task commit)
- **Tasks:** 2 completed
- **Files modified:** 4 created, 3 modified

## Accomplishments

- Ported the prototype's entire magic domain (mazeworld.html lines 2483-2794) into `engine/magic.js`: `castSpell` (charge check via `maxCharges`/`spellsUsed`, grimoire/school gating via `canCast` — skipped for a scroll-cast spell — the Apprentice's one-in-eight backfire with possible self-damage/death, the intelligent-target resistance roll, and every one of the 32 SPELLS kinds' effect: heal/major-heal capped at maxWP, Shield/Bubble ward pools, Strength's Win-Potential doubling, Doze/Stun/Weaken/Stupidity/Blind/Shrink status effects, Acid/Earthquake/Noxious-Vapor/Fireballs(volley)/Petrify/Insane/thrown-damage-spell resolution reusing combat.js's `killFoe`, Summon/Phantom-Host allies (including the Summoner's own backfire chance), Turn-Walking-Dead/Plane-Gate, Sense-Presence/Detect-Magic/Sense-Danger, Mirror-Self, Regeneration, and Death), `drinkPotion`, and `canRead`/`readScroll` (grimoire-copy vs. free-cast, ignoring the caster's own charge economy).
- `engine/engine.js` dispatches `castSpell`/`drinkPotion`/`readScroll` to these handlers.
- Every RNG-consumption short-circuit is preserved verbatim in the exact same if/else-if chain shape as the prototype (e.g. Noxious Vapor's per-foe d10 only rolled when the d6 came up 4; the treasure-check d20 inside killFoe gating whether further loot rolls happen) — this is the actual determinism contract, and the magic-parity fixture proved it held with zero roll-order fix-up needed across all four scenarios on the first run.
- Offensive spells are a thin consumer of `engine/combat.js`'s existing `killFoe`/`liveFoes`/`afterPlayerAction` — 01-08's combat.js already documented that its `playerStrike`/`foeTurn` faithfully READ every field a spell can set (`c.ward`/`c.regen`/`c.mirror`/`C.weakened`/`C.foeToHitPenalty`); this plan is what finally SETS them, closing that carried-forward gap with **zero changes to combat.js itself**.
- Built `test/parity/fixtures/action-script.magic.json` + `test/parity/magic-parity.test.js`: four independent scenarios (a Magic User casting Freeze in a forced Beasts encounter, casting Heal outside combat, drinking a potion, reading a scroll), each its own seed found via a throwaway discovery script (engine-only scan of `newRun(seed)` for 1-5000, then cross-checked for real prototype parity) — the same method 01-05/01-07/01-08 established for their own fixtures.
- Extended the standing ENG-04 round-trip guardrail (`test/roundtrip/serialize-rehydrate.test.js`) with the magic fixture's four scenarios, plus a dedicated synthetic test proving a mid-cast ward sub-state (Shield's `pool`/`rounds`/`reflect`/`name`) survives a JSON round-trip losslessly.
- Added 22 unit tests (`test/unit/magic.test.js`) covering charge/grimoire/school gating, the Apprentice backfire (including a lethal one), a thrown damage spell killing a foe, heal capping, Shield/Bubble wards, Strength's doubling, Earthquake's self-damage (warded and unwarded), drinkPotion's cap, and readScroll's grimoire-copy vs. free-cast branches.
- Full project test suite: **209/209 passing** in ~3.2s (31 new tests this plan — 22 magic unit + 4 magic-parity + 5 magic round-trip) atop 178 prior, well within the ~15s budget.

## Task Commits

1. **Task 1: castSpell — port all spell-kind resolution behind applyAction** — `38369a6` (feat) — includes `drinkPotion`/`readScroll` and all three applyAction dispatch cases (see Deviations)
2. **Task 2: magic parity fixtures (cast-damage/heal/potion/scroll) + ward round-trip** — `96f77a1` (test)

**Plan metadata:** committed via `docs(01-09): complete plan`.

## Files Created/Modified

- `engine/magic.js` — `castSpell`/`drinkPotion`/`readScroll`/`canRead` (RNG-injected, event-emitting, pure)
- `engine/engine.js` — `applyAction` dispatch wired for `"castSpell"`/`"drinkPotion"`/`"readScroll"`
- `test/unit/magic.test.js` — 22 tests: charge/grimoire/school gating, Apprentice backfire, thrown-damage kill, heal cap, ward set, Strength doubling, Earthquake self-damage, drinkPotion, canRead/readScroll, purity
- `test/parity/fixtures/action-script.magic.json` — 4 scenarios (cast-damage/heal/potion/scroll), each its own seed
- `test/parity/magic-parity.test.js` — engine-vs-prototype parity across all 4 scenarios (all passed immediately)
- `test/roundtrip/serialize-rehydrate.test.js` — extended with the magic fixture's coverage + a dedicated Shield/ward round-trip test
- `test/parity/fixtures/action-script.schema.md` — documents `castSpell`'s `idx` field

## Decisions Made

- Task 1 and Task 2 landed `engine/magic.js`'s full contents (castSpell AND drinkPotion/readScroll) plus all three dispatch cases in a single commit, since `readScroll` calls `castSpell` directly within the same file. See Deviations.
- Fixture seeds were found via the same throwaway-discovery-script method 01-05/01-07/01-08 established.
- The ward round-trip proof is a dedicated synthetic test (manually setting `c.grimoire=["Shield"]`) rather than waiting for a fixture seed to naturally roll it — a more direct serialization proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's commit includes drinkPotion/readScroll and all three dispatch cases, not just castSpell**
- **Found during:** Writing engine/magic.js
- **Issue:** The plan's Task 1 scope is castSpell only (Task 2 adds drinkPotion/readScroll). But `readScroll` calls `castSpell` directly in the same module (a same-file call dependency, not a cycle) as part of its "cast for free" branch, and there is no natural intermediate state where the file contains only castSpell and is meaningfully "done" — writing the file once, complete, was the straightforward implementation path, same reasoning 01-05/01-06/01-08 used for their own forced task-order/scope adjustments.
- **Fix:** `engine/magic.js` (all three exported functions), `engine/engine.js` (all three dispatch cases), and `test/unit/magic.test.js` (covering all three) landed together in the Task 1 commit. Task 2's own commit then contains exactly what remained: the parity fixture, the parity test, and the round-trip extension.
- **Files modified:** engine/magic.js, engine/engine.js, test/unit/magic.test.js — scope only, no content differs from the plan's intent (both tasks' artifacts exist exactly as specified, just committed together for Task 1).
- **Verification:** Full suite green (200/200) after the Task 1 commit; acceptance criteria for both tasks independently verified via test/unit/magic.test.js and (after Task 2) test/parity/magic-parity.test.js.
- **Committed in:** `38369a6`

---

**Total deviations:** 1 (Rule 3 commit-scope combination)
**Impact on plan:** No scope change and no architectural change. Every artifact the plan specifies for both tasks exists exactly as described; only the commit boundary shifted, for the same real-coupling reason prior plans in this phase have already established as the norm.

## Issues Encountered

None — the magic-parity fixture passed diffState-null on the very first run for all four scenarios, with no roll-consumption-order fix-up needed. This is notable given castSpell is the largest, most branch-heavy function ported in this phase; the careful 1:1 preservation of the prototype's short-circuiting `&&` guards (only rolling a die when the preceding condition demanded it) paid off immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The magic domain is complete, tested, and parity-proven. Combined with 01-05 through 01-08, every core rule domain (chargen/leveling, movement/day-cycle, items/death/save-validation, combat, magic) now runs behind the pure `applyAction` contract.
- `engine/magic.js`'s `castSpell`/`drinkPotion`/`readScroll` are ready for 01-10 (economy/store, and whatever full-loop integration plan closes out the phase) to call as-is; no further magic-domain work is anticipated before Phase 1 wraps.
- Carried-forward todo (from 01-08, now closed by this plan): combat.js's playerStrike/foeTurn faithfully read every field a spell sets — confirmed true by this plan's parity fixture passing with zero changes to combat.js.
- Carried-forward todo (from 01-08, still open): `mazeworld.html`'s live UI (keydown/click handlers for strike/potion/flee/spell/parley/sing) is not yet routed through the engine via `src/browser/engineAdapter.js` — only `move`/`camp` were wired in 01-07. Whichever plan extends the browser adapter should route `castSpell`/`drinkPotion`/`readScroll` the same way, now that all three exist.
- Carried-forward todo (new, low value): `useItem`'s foe-targeting potion effects (freeze/weaken/stone/fire/gas, engine/items.js) and this plan's magic spells both write similar foe-status fields (`asleep`, `wp`, `alive`) independently — no shared helper was extracted since the plan didn't call for one and the duplication is small; a future hardening pass could unify them if a third caller appears.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-08*

## Self-Check: PASSED

All 4 created files (engine/magic.js, test/unit/magic.test.js, test/parity/fixtures/action-script.magic.json, test/parity/magic-parity.test.js) plus this SUMMARY found on disk; both task-commit hashes (`38369a6`, `96f77a1`) found in git log. Full `node --test` suite: 209/209 passing in ~3.2s.
