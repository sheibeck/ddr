---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 06
subsystem: testing
tags: [test, identity-pass, sub-classes, races, contract-test, node-test]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "Combat-side identity pass (24-01), Fridgian/Dwarven race pass (24-03), Pickpocket store markup (24-04), world-side identity pass + 30-blurb flavor sweep (24-05) — the exact event names, flags, reasons, helpers and RACES flags this contract table asserts"
  - phase: 22-class-aware-harness-before-matrix
    provides: "newRun(seed, exclude, { force }) dev-only seam (22-01) — every CONTRACT hero is built through it"
provides:
  - "test/unit/identity-contract.test.js — ONE data table (CONTRACT) proving a good and a bad for all 24 sub-classes and 5 non-Human races, plus a Human-neutral entry, complete against CLASSES/RACES"
  - "the completeness meta-test (IDENT-08) deriving expected key sets from CLASSES[*].subs / Object.keys(RACES) at runtime"
  - "7 negative cases + 3 idempotency proofs (FID-07)"
  - "the 30-row good/bad name table below, the source Plan 24-07 transcribes into docs/CLASS-PASS.md's Rulings good/bad table"
affects: [24-07, docs/CLASS-PASS.md]

tech-stack:
  added: []
  patterns:
    - "Every CONTRACT hero is built via hero(sub, race, seed) = newRun(seed, [], { force: { sub, race } }), then a small, documented set of already-rolled scalar fields (skills, phobia, transient buffs) is neutralized so a single mechanic's assertion is never confounded by an unrelated natural roll — sub/race/class draw RESULTS and every other rollCharacter output (weapon, armor, grimoire, gold, items, maxWP) stay the real Phase-22 force-seam output"
    - "Differential control comparisons (a sub/race hero vs a plain control built the same way, given the identical scripted rng) replace hand-computed formula oracles everywhere except the phase's own literal decision numbers (20 hp, d20 <= 2, d12 <= 2, ar <= 10, x1.25/x0.75, ceil(dmg/2), -2 hide, -1 Guard, 0.6x Elven wp, +9 Troll damage)"
    - "looseRng(seq, fallback) — a fakeRng variant that returns a safe fallback value forever past the scripted prefix, used wherever downstream content-driven draws (a foe's own bestiary arithmetic, an extra combat round) are not the scenario's claim"

key-files:
  created:
    - test/unit/identity-contract.test.js
  modified: []

key-decisions:
  - "Race rows in CONTRACT are ordered Human, Elven, Dwarven, Wilmsry, Fridgian, Troll — matching Object.keys(RACES)'s real declaration order in content/races.js (Human first), not a narrative 'Human last as capstone' ordering — required for the completeness meta-test's deepEqual against the live RACES keys."
  - "hero() neutralizes skills/phobia/transient-buff fields on the freshly-rolled character (not the sub/race/class draws themselves) so a mechanic's assertion never accidentally depends on an unrelated natural roll (a skill collision, a phobia matching the scripted encounter type); every other rollCharacter output for that (seed, sub, race) is left as the real engine result."
  - "Ninja's 'a later roll of 2 crits' scenario pins BOTH the Ninja and its Pickpocket control to an identical synthetic weapon (withWeapon) rather than each sub's natural KIT weapon, isolating the crit-doubling clause from the two subs' different dice notations — the opener half of the same test still uses Ninja's natural Wakazashi/prof-1 kit to prove the flat ninjaFirstStrike formula against WEAPON_MAX."
  - "Cutthroat's 'first landed blow always crits' good deliberately sets a synthetic c.armor = \"Chain Mail\" (a string not actually reachable through the real armor system, since the heavy-armor check's own three-string list — \"Studded Leather\"/\"Chain Mail\"/\"Plate\" — never matches any name in content/armors.js) to force the pre-existing heavy-armor backstab-denial branch, proving the Cutthroat's OWN crit clause fires even when the generic Thief backstab crit does not — the true distinguishing behavior, otherwise indistinguishable from a plain Thief's opening backstab."
  - "hero() also seeds state.pendingJoiner = null (newRun does not pre-populate that field; only meetJoiner/resolveJoiner ever touch it) so every hero starts from the same baseline the Joiner-refusal scenarios assert against."

requirements-completed: [IDENT-08, IDENT-05, IDENT-06, IDENT-07]

coverage:
  - id: D1
    description: "One data table (CONTRACT) carries a named GOOD and a named BAD for all 24 sub-classes and 5 non-Human races, plus a Human-neutral entry, every scenario built from newRun(seed, [], { force })"
    requirement: "IDENT-08"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js — 59 GOOD/BAD/NEUTRAL scenario tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "A completeness meta-test derives the expected sub-class/race key sets from CLASSES[*].subs and Object.keys(RACES) at runtime (never a hand-copied list) and asserts CONTRACT is complete and canonically ordered"
    requirement: "IDENT-08"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js#IDENT-08: the contract table is complete and canonically ordered"
        status: pass
    human_judgment: false
  - id: D3
    description: "7 negative cases prove each mechanic is silent when its trigger condition never fires (Knight vs sub-20 foes, a solo Bard's targeting, a Joiner never met, an unopened store, an untouched armor gate, an empty-items useItem, a no-combat flee)"
    requirement: "IDENT-05, IDENT-07"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js — 7 tests prefixed 'negative:'"
        status: pass
    human_judgment: false
  - id: D4
    description: "3 idempotency tests prove a forced hero and a Cutthroat Joiner-refusal scenario replay byte-identical (same events, same rng cursor) and that the refusal's rng cursor matches an accepted control's"
    requirement: "FID-07"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js — 3 tests prefixed 'idempotency:'"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test stays fully green (1188/1188, # fail 0) with zero engine/content/parity file changes — this is a test-only plan"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "npm test (1188/1188, # fail 0); git status --porcelain engine content test/parity empty"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 06: Identity-Contract Table (IDENT-08) Summary

**One `test/unit/identity-contract.test.js` data table proves a machine-checked good and bad for all 24 sub-classes and 5 non-Human races (plus Human neutral), every hero built through Phase 22's `newRun(seed, [], { force })` seam, complete against the live `CLASSES`/`RACES` keys — 70 tests, zero engine/content/parity changes.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3
- **Files modified:** 1 (new test file only)

## Accomplishments

- `test/unit/identity-contract.test.js` (new): one exported-shaped `CONTRACT` array of `{ key, kind: "sub"|"race", good: {name, run}, bad: {name, run} }` (or, for Human, `{ key: "Human", kind: "race", neutral: {name, run} }`), in canonical `CLASSES["Magic User"].subs` → `CLASSES.Fighter.subs` → `CLASSES.Thief.subs` order, then `Object.keys(RACES)` order (Human first, matching content/races.js's real declaration order).
- Local scaffold helpers (`fakeRng`, `looseRng`, `countingRng`, `hero`, `withWeapon`, `withCombat`, `fixedFoe`, `findEvent`, `expectEvent`) mirroring the established conventions of `identity-combat.test.js`/`identity-race.test.js`/`identity-world.test.js`, deliberately not imported from them (each identity-*.test.js file reads standalone).
- Every hero is built via `hero(sub, race = "Human", seed = 1)` = `newRun(seed, [], { force: { sub, race } })` — the real Phase 22-01 dev-only seam — with `state.combat` nulled and a documented set of already-rolled scalar fields (skills, phobia/phobiaType, transient buffs, `pendingJoiner`) neutralized so a single mechanic's assertion is never confounded by an unrelated natural roll.
- 24 sub-class rows (8 Magic User, 8 Fighter, 8 Thief) and 6 race rows (Human + 5 others), each with a passing good/bad (or neutral) scenario asserting the exact mechanic 24-01/03/04/05 landed — Knight's big-foe initiative override at the 19/20 boundary, the Woodsman's armour gate at the 10/12 `ar` boundary, the Bard's widened camp-wake roll, the Court Mage's 1-in-6 boredom kill, the Cutthroat/Wilmsry Joiner refusals, the Pickpocket's x1.25/x0.75 store markup, the Fridgian's hide/frenzy and the Dwarven's half-wear armour, and Human asserted neutral across `foeToHitVs`, `priceFor`/`sellPriceFor`, `strikeDie`/`foeDie`, `rollInitiative`, `canEquipArmor`, `meetJoiner`, and `applyFoeDamageToPlayer`.
- A completeness meta-test (`IDENT-08: the contract table is complete and canonically ordered`) derives the expected sub-class/race key sets from `CLASSES[*].subs`/`Object.keys(RACES)` at runtime (never a hand-copied list, satisfying the threat register's T-24-15 mitigation) and asserts every non-Human entry carries a named good/bad, Human carries only `neutral`, and no key is duplicated.
- 7 negative cases and 3 idempotency proofs (byte-identical replays, rng-cursor parity for a Cutthroat's Joiner refusal vs an accepted control).
- Full suite: `node --test test/unit/identity-contract.test.js` — 70/70 passing; `npm test` — 1188/1188, `# fail 0`; `git status --porcelain engine content test/parity` empty (this plan changes only the new test file).

## The 30-row good/bad table (source for Plan 24-07's docs/CLASS-PASS.md Rulings transcription)

| Key | Good | Bad |
|---|---|---|
| Wizard | Full offense-school bonus (3), learns every school | Refuses to melee while a castable attack spell sits unused |
| Warlock | A nightly potion duplicates itself | Props up every Walking Dead foe in the room |
| Sorcerer | Grimoire guaranteed to carry Freeze and Fireball | Own arm caps at 9 damage |
| Summoner | Summons at level one instead of level two | Gated out of offense at level one even when a spell is known |
| Cleric | Heals 3 more than anyone else, rolls 4 to hit | No offensive bonus at all (soft bad) |
| Illusionist | Phantom Host summonable at level one instead of level three | Strikes on a d20 until level three |
| Court Mage | Boredom kills 1-in-6 (d12<=2); always parleys Humans | Talks first — foes act first in round one only |
| Apprentice | Double skill points off a kill at level one | One spell in eight backfires |
| Knight | Beneath the notice of small things — a foe under 5 maxWP flees | Everything over 20 comes straight at you — never wins initiative vs a live maxWP >= 20 foe |
| Guard | The profession is standing there — every foe needs one better to land a blow | Own blow is weaker and never crits |
| Woodsman | The professional forester — parleys Beasts/Lair Beasts | No mail, no plate — refused anything heavier than Studded |
| Soldier | Camp heals twice as fast | A foe's roll of 2 crits, doubling the blow |
| Barbarian | Two attacks every strike | Half skill points off a kill |
| Master of Arms | Plus two with every weapon ever forged | Cannot parley, ever; no clean round-1 tracked withdrawal |
| Samurai | Born in plate, wielding a magic katana | Never wins initiative, never runs |
| Bard | Courtly enough to talk to anyone — parleys Humans at fluency 0 | Camp wakes wandering monsters twice as often; dumb foes come for the Bard |
| Pickpocket | An extra take off every kill/chest | Shopkeepers know your face — buys x1.25, sells x0.75 |
| Pilfer | Disarms every trap, opens every chest for free | Cannot use a single item that does not heal |
| Cat Burglar | The first strike of any fight always lands | Every trap that catches them deals double damage |
| Cutthroat | The first landed blow always crits, even in armor a backstab would refuse | No Joiner will ever travel with you |
| Cloaker | A free vanish while nobody has seen your face | Once seen, the vanish is denied |
| Ninja | The opener always lands for max weapon damage; a later roll of 2 crits | You never speak — canParley is false unconditionally |
| Con Artist | Can talk anyone down except Magical/Walking Dead; a weak foe leaves before the fight starts | The opening blow is a warning, not an injury |
| Acrobat | Harder to land a blow on, easier to land one | A dagger, and only a dagger |
| Elven | Strikes a die better and hits at 5 whatever the class | 0.6x wp and easier to hit |
| Dwarven | +2 damage; armour built to be hit wears at half the rate | Foes strike at a better die |
| Wilmsry | Camp heals twice as fast; parleys Beasts at fluency 0 | Half skill points; Magic User Joiners refuse to travel with them |
| Fridgian | Frenzy never wastes its second swing; thick hide soaks 2 from every blow | Never wears armor, always strikes last |
| Troll | 75 wp regardless of class; +9 damage | Prices triple, eats two rations a night |
| Human | *(neutral — no race modifier anywhere)* | *(neutral)* |

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold + Fighter/Thief rows (16 subs x good/bad)** - `9744241` (test)
2. **Task 2: Magic User rows (8), the 5 non-Human races, and the Human-neutral entry** - `9bf0626` (test)
3. **Task 3: Completeness meta-test, negative cases, idempotency, full suite** - `28de35c` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `test/unit/identity-contract.test.js` - new, 70 tests (59 CONTRACT scenarios + 1 meta-test + 7 negative + 3 idempotency)

## Decisions Made

- Race rows ordered Human-first (matching `Object.keys(RACES)`'s real declaration order), not a "Human last as capstone" narrative ordering — required by the completeness meta-test's `deepEqual`.
- `hero()` neutralizes only cosmetic/transient chargen fields (skills, phobia, buffs, `pendingJoiner`); every sub/race/class-driven output (weapon, armor, grimoire, gold, items, maxWP) is the real `rollCharacter()` result for that seed, keeping every scenario anchored to the genuine Phase 22 force seam.
- Ninja's crit-clause isolation pins a synthetic identical weapon on both the Ninja and its Pickpocket control (rather than each sub's natural KIT weapon) so the differential comparison isn't confounded by different dice notations; the opener half of the same test still uses Ninja's natural Wakazashi kit to check the flat `ninjaFirstStrike` formula.
- Cutthroat's good scenario sets a synthetic (not naturally reachable) `c.armor = "Chain Mail"` to trigger the pre-existing heavy-armor backstab-denial branch, isolating the Cutthroat's own crit clause from the generic Thief backstab crit every Thief's first landed blow already gets.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps (CONTRACT declaration count, `kind: "sub"`/`"race"` counts, `force: { sub` seam usage, the Knight 19/20 and Woodsman ar 10/12 boundary literals, the Human `["size", "upkeep", "note"]` key-order literal, the `IDENT-08` meta-test title, `Object.keys(RACES)`/`CLASSES["Magic User"].subs` usage) and the `node --test`/`npm test` pass-count thresholds were satisfied on the first or second attempt per task; two small differential-comparison bugs (Ninja's mismatched weapon dice notation between sub and control; `pendingJoiner` `undefined` vs `null`) were caught and fixed inline during Task 1/2 verification before committing, not deferred.

## Issues Encountered

None beyond the two same-task differential-comparison fixes noted above (not deviations from the plan — they were bugs in this test file's own scenario setup, fixed before the task's commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 24-07 can now transcribe the 30-row good/bad table above verbatim into `docs/CLASS-PASS.md`'s Rulings good/bad table.
- No engine bug or discrepancy was found while building this contract table — every mechanic asserted here matched 24-01/03/04/05's landed behavior on the first correct scenario setup (the two fixes above were test-authoring bugs, not engine bugs).
- No blockers. `npm test` 1188/1188, `# fail 0`; `test/parity/prototype-master.js.txt` and every other fixture untouched; zero engine/content/parity file changed by this plan.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: test/unit/identity-contract.test.js
- FOUND: .planning/phases/24-every-sub-class-and-race-one-good-one-bad/24-06-SUMMARY.md
- FOUND commit: 9744241 (Task 1)
- FOUND commit: 9bf0626 (Task 2)
- FOUND commit: 28de35c (Task 3)
