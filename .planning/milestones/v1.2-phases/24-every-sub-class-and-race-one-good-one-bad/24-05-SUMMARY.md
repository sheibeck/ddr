---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 05
subsystem: engine
tags: [engine, encounters, items, movement, economy, narration, flavor, identity-pass, zero-draw]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "Combat-side sub-class identity pass (24-01), Fridgian hide/frenzy + Dwarven half-wear race pass (24-03), Pickpocket store markup (24-04) — this plan lands the remaining world-side goods/bads and the full 30-blurb flavor sweep"
provides:
  - "meetJoiner refusal branch: joinerRefused (reason cutthroat | wilmsry) pushed AFTER the joiner is fully rolled; pendingJoiner left null on a refusal"
  - "armorRefusalReason(c, it) exported helper (engine/items.js) — noArmor | woodsman | tooHeavy | null; canEquipArmor delegates to it; takeItem/equipItem/openStore's armour filter all read the one rule"
  - "useItem's Pilfer gate: useRefused (reason pilfer) for any non-heal-kind item, fired BEFORE any side effect"
  - "newDay's Bard wake: rng.d(20) <= wakeOn (2 for a Bard, 1 for everyone else), same eight draws; wanderingMonster.bard flag"
  - "EVENT_NARRATION: joinerRefused, useRefused builders; woodsman clauses on itemRejected/equipRejected; a bard clause on wanderingMonster"
  - "All 30 SUB_NOTE/RACE_NOTE blurbs re-read and made true (14 rewritten, 16 checked unchanged); keys/order untouched"
  - "test/unit/identity-world.test.js (new, 22 tests) covering every mechanic in this plan"
affects: [24-06, 24-07, docs/CLASS-PASS.md]

tech-stack:
  added: []
  patterns:
    - "A refusal is a pure post-roll read: the joiner is rolled/armour item is offered exactly as before, then a zero-draw decision either proceeds normally or narrates a refusal and stops — same shape as 24-01's parleyRefused/withdrawalDenied/vanishDenied"
    - "One helper (armorRefusalReason) is the single source of truth read by four call sites (canEquipArmor, takeItem, equipItem, openStore's filter) rather than duplicating the noArmor/woodsman/tooHeavy checks at each site"
    - "A store never offers a line the buyer cannot legally take — the illegality gate is applied to the STOCK FILTER itself (openStore), not just the purchase (takeItem), so a Woodsman never buys-then-gets-rejected"

key-files:
  created:
    - test/unit/identity-world.test.js
  modified:
    - engine/encounters.js
    - engine/items.js
    - engine/economy.js
    - engine/movement.js
    - src/browser/eventNarration.js
    - content/flavor.js

key-decisions:
  - "Pinned Wilmsry-vs-Joiner-class seeds via a live scan (seeds 1..500), not hand-computed: seed 1 rolls a Magic User joiner (refused, reason wilmsry); seed 5 rolls a non-Magic-User joiner (Pilfer/Fridgian, accepted). Both pinned directly in test/unit/identity-world.test.js."
  - "Cutthroat joiner-refusal seeds reused the joiner-acquisition.test.js convention: seed 555 for the refusal/pendingJoiner-null/deep-equal-with-a-Soldier-control assertions, seed 777 for the 4-draw cursor-parity replay (hand-verified: the draw following a refused meetJoiner is byte-identical to the draw following an accepted one, confirmed live at 18)."
  - "armorRefusalReason's check order is noArmor -> woodsman -> tooHeavy -> null (per the plan's locked order) so a Woodsman's Mail/Plate refusal fires even though the existing class/Heft rule would otherwise call it legal for a Fighter."
  - "The store's armour filter gate is canEquipArmor(c, a) applied to the SAME ARMORS entries already filtered by class-letter and ar>c.ar — no double-import cycle risk since economy.js already imported from items.js before this plan."
  - "The 14 flavor rewrites keep every unaffected clause of the original sentence verbatim where possible (voice/structure preserved) and only add or correct the mechanic-bearing clause, per the plan's 'sharpen, don't rewrite wholesale' framing for Woodsman/Pilfer."

requirements-completed: [IDENT-05, IDENT-07, IDENT-09, FID-07]

coverage:
  - id: D1
    description: "A Cutthroat's Joiner is rolled exactly as before (same four draws, c.joiner identical to a control), then refused (joinerRefused, reason cutthroat) with pendingJoiner left null; a Magic User Joiner refuses a Wilmsry the same way (pinned seed 1), a non-Magic-User Joiner still joins a Wilmsry (pinned seed 5), and a Human is neutral on the same seed"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/identity-world.test.js — 5 meetJoiner tests (Cutthroat refusal/deep-equal, cursor-parity, Wilmsry-vs-MU/non-MU pinned seeds, Human neutral)"
        status: pass
      - kind: unit
        ref: "test/unit/joiner-acquisition.test.js, test/unit/encounters.test.js (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Woodsman may wear Cloth/Leather/Studded (ar <= 10) but never Mail/Plate, enforced identically by canEquipArmor, takeItem (itemRejected reason woodsman), equipItem (equipRejected reason woodsman), and the store's own armour-line filter (never offered, not just refused post-purchase); every other hero's legality/stock is unchanged"
    requirement: "IDENT-07"
    verification:
      - kind: unit
        ref: "test/unit/identity-world.test.js — 13 armour/store tests (armorRefusalReason ordering, takeItem/equipItem accept+refuse, openStore Woodsman-in-Studded/Woodsman-in-Leather/Soldier-in-Studded comparisons)"
        status: pass
      - kind: unit
        ref: "test/unit/items.test.js, test/unit/inventory-actions.test.js, test/unit/economy.test.js (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Pilfer may use only heal-kind items (Healing/Xtra Healing potions); every other useItem is refused (useRefused, reason pilfer) BEFORE usedAt/itemUsed/inventory are touched; drinkPotion and canRead remain untouched"
    requirement: "IDENT-07"
    verification:
      - kind: unit
        ref: "test/unit/identity-world.test.js — useItem heal/full-allowed, Strength-potion-refused (no side effect), Cat-Burglar-not-refused, canRead-still-false tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Bard camping wakes on a d20 of 1 OR 2 (same eight draws, wider hit); every other sub wakes only on a 1; wanderingMonster carries a bard flag"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/identity-world.test.js — Bard-wakes-on-8th-draw-of-2/Soldier-does-not/Bard-all-3s-no-wake/exactly-eight-draws-consumed tests"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new event type/reason/flag (joinerRefused, useRefused, itemRejected/equipRejected reason woodsman, wanderingMonster.bard) has a family-friendly EVENT_NARRATION entry; the coverage guard and voice safety scan stay green"
    requirement: "FID-07"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "All 30 SUB_NOTE/RACE_NOTE blurbs re-read against the implemented mechanics; 14 rewritten to be true, 16 confirmed already true; keys and key order unchanged; npm test and parity fully green"
    requirement: "IDENT-09, FID-07"
    verification:
      - kind: unit
        ref: "node -e key/order check (30 keys, exact join match) — see plan acceptance criteria"
        status: pass
      - kind: other
        ref: "npm test (1118/1118, # fail 0); node --test \"test/parity/**/*.test.js\" (33/33); git status --porcelain test/parity empty"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 05: World-Side Sub-Class/Race Identity Pass + 30-Blurb Flavor Sweep Summary

**Cutthroat/Wilmsry Joiner refusals, a Woodsman armour gate enforced across take/equip/store, a Pilfer's heal-only useItem, a Bard's doubled camp wake roll — all zero-draw and narrated — plus a full re-read of all 30 SUB_NOTE/RACE_NOTE blurbs (14 rewritten, 16 confirmed true) closing out IDENT-05/07/09 for Phase 24.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 7 (1 new test file, 6 modified)

## Accomplishments

- `engine/encounters.js#meetJoiner`: the joiner is still rolled with the exact same four draws and `c.joiner` set identically regardless of the hero's sub/race. A pure post-roll read then decides whether it travels: never for a Cutthroat, never a Magic User joiner for a Wilmsry (any other class still joins normally). On a refusal, `joinerRefused` (`reason: "cutthroat" | "wilmsry"`) is pushed after `joinerMet` and `state.pendingJoiner` is simply left null — never touched.
- `engine/items.js`: new exported `armorRefusalReason(c, it)` returns `"noArmor" | "woodsman" | "tooHeavy" | null` in that check order — the single source of truth `canEquipArmor` now delegates to. `takeItem`'s and `equipItem`'s armour paths collapsed their old noArmor/tooHeavy pair into one read of this helper (the `notBetter` check in `takeItem` is unchanged, still after it). `useItem` gained a Pilfer gate directly after the ready-check and before `it.usedAt`/`itemUsed`: any non-heal-kind item (`kind !== "heal" && kind !== "full"`) is refused (`useRefused`, reason `pilfer`) with zero side effects — item still carried, `usedAt` never set, cooldown/inventory untouched.
- `engine/economy.js#openStore`: the armour candidate filter now reads `ARMORS.filter((a) => a.cls.includes(letter) && a.ar > c.ar && canEquipArmor(c, a))` — a Woodsman in Studded is never even offered the Mail line (rather than buying it and having the purchase rejected after the gold is spent); every non-Woodsman hero's filtered stock is byte-identical, confirmed by a same-seed Woodsman-vs-Soldier weapon-line comparison.
- `engine/movement.js#newDay`: the eight-hour wandering-monster wake check now computes `const wakeOn = c.sub === "Bard" ? 2 : 1;` and tests `rng.d(20) <= wakeOn` — same eight draws in the same order, just a wider hit for a Bard. `wanderingMonster` gained a `bard: c.sub === "Bard"` flag.
- `src/browser/eventNarration.js`: new `joinerRefused` (two-reason: cutthroat/wilmsry) and `useRefused` builders; `itemRejected`/`equipRejected` gained a `"woodsman"` clause ahead of their existing generic text (byte-identical for every other reason); `wanderingMonster` gained an additive clause when `e.bard` is set.
- `content/flavor.js`: all 30 `SUB_NOTE`/`RACE_NOTE` blurbs re-read against the implemented mechanics (Phase 22-24's combat/economy/world-side work). **14 rewritten**, **16 confirmed already true** (see table below). Keys and key order unchanged, confirmed by a live node check against the exact expected join string.
- `test/unit/identity-world.test.js` (new, 22 tests): joiner refusal/parity/pinned-seed tests, armour-gate/store-filter/Pilfer-useItem tests, Bard wake tests — every mechanic in this plan directly exercised with a hand-verified rng sequence or a live scan-pinned seed.

## 30-Blurb Checked/Changed Table

| Key | Status | Why |
|---|---|---|
| Knight | changed | Added "and gets there first" — the Knight big-foe rule now also denies initiative (rollInitiative, landed in 24-01), not just proximity |
| Guard | changed | Added the -1-to-be-hit good (foeToHitVs, 24-01) alongside the existing no-crit/damage-penalty bad |
| Woodsman | changed | Sharpened to state the mail/plate refusal is enforced (store filter + take/equip gate, this plan), not merely flavor |
| Soldier | checked | Crit-on-2/never-deals-crits + level-III knighting text matches combat.js's Guard/Soldier noCrit line and character.js's promotion path unchanged |
| Barbarian | checked | Two-attacks/half-XP unchanged (attacks=2 in playerStrike, sp halving elsewhere) |
| Master of Arms | changed | Added "cannot parley — literally" and "no clean exit in round one" (canParley false + withdrawalDenied, both landed in 24-01) |
| Samurai | checked | Katana/plate/never-wins-initiative/never-runs (samuraiNeverFirst, flee refusal) all unchanged from prior phases |
| Bard | changed | Added the camp-doubles-wandering-monsters bad (this plan) alongside the existing party-targeting text |
| Pickpocket | changed | Added the shopkeepers-know-your-face store markup (priceFor/sellPriceFor x1.25/x0.75, landed in 24-04) |
| Pilfer | changed | Sharpened to state the heal-only gate is enforced (useItem refusal, this plan), not merely a joke |
| Cat Burglar | checked | First-strike-always-lands/opens-every-door text matches combat.js's `auto` opener and existing door-first rule |
| Cutthroat | changed | Replaced the old "one member of every party dies by your hand" line with the real mechanic: no Joiner will travel with you (this plan) |
| Cloaker | changed | Sharpened to state the vanish is free only until your first landed blow (`!C.opened2` gate, landed in 24-01) |
| Ninja | changed | Sharpened "you never speak" to state it is literal — canParley is false unconditionally (landed in 24-01) |
| Con Artist | checked | Wit<=6 refusal + zero-damage opener text matches combat.js's canParley/conArtistOpener logic unchanged |
| Acrobat | checked | Needs-a-3/dagger-only text matches derived.js foeToHitVs and items.js canEquipWeapon's Acrobat gate unchanged |
| Wizard | checked | Attack-spell-refusal/staff-fallback text matches Phase 23's castableAttackSpells gate unchanged |
| Warlock | checked | Daily potion duplication text already matches the DR12 daily-cadence change (pre-Phase-24) |
| Sorcerer | checked | One-in-eight forgetting / 9-damage-cap text matches existing rollGrimoire/weaponDamage caps unchanged |
| Court Mage | changed | Fixed the number (twelve -> six, matching d12<=2 landed in 24-01) and added "everyone else gets there first" (round-1 never-first, landed in 24-01) |
| Illusionist | checked | Teleport-choice/Phantom-Host/d20-to-strike text matches Phase 23 mechanics unchanged |
| Cleric | checked | Healing/turning/chain-mail/4-to-hit text matches existing character sheet unchanged |
| Summoner | checked | Double-strength summon/one-in-eight-wrong-side text matches existing summon mechanic unchanged |
| Apprentice | checked | Double-XP/one-in-eight-fizzle/level-three-reroll text matches character.js unchanged |
| Human | checked | Neutral-control text unchanged — no mechanic added anywhere for Human, per this phase's explicit prohibition |
| Elven | checked | 0.6x wp / strikes-a-die-better text matches content/races.js unchanged (no mechanic change per CONTEXT) |
| Dwarven | changed | Added the armour-half-wear good (`armorWear: 0.5`, landed in 24-03) alongside the existing +2 dmg / foe-strike-step bad |
| Wilmsry | changed | Sharpened "Magic Users despise you" to state no Magic User Joiner will travel with you (this plan's joinerRefused reason wilmsry) |
| Fridgian | changed | Removed "occasionally something already dead" (the corpse-whiff branch was deleted in 24-03) and added the hide-soaks-2 good (`hide: 2`, landed in 24-03) |
| Troll | checked | 75wp/+9dmg/double-rations/triple-cost text matches content/races.js unchanged (no mechanic change per CONTEXT) |

## Pinned Seeds (measured live, not hand-computed)

- **Cutthroat joiner refusal:** seed 555 (refusal/pendingJoiner-null/deep-equal-with-Soldier-control assertions); seed 777 (4-draw cursor-parity replay — the draw following a refused `meetJoiner` equals 18, identical to the draw following an accepted one from the same seed).
- **Wilmsry-vs-joiner-class:** scanned seeds 1..500 live via `meetJoiner` on a Wilmsry Soldier. **Seed 1** rolls a Magic User joiner (Owen Ashford, Cleric->Magic User, lvl 4) — refused, reason `wilmsry`. **Seed 5** rolls a non-Magic-User joiner (Snorri Snowfell, Thief/Pilfer/Fridgian, lvl 4) — accepted, pendingJoiner set. The same seed-1 Magic-User-joiner draw, replayed against a plain Human Soldier, recruits normally (Human neutral, no refusal).

## Narration Sentences Chosen

- `joinerRefused` (reason cutthroat): "Word has reached the Joiners. The Joiners have reached the exit."
- `joinerRefused` (reason wilmsry): "`${name}`, a Magic User, takes one look at a Wilmsry and remembers an appointment elsewhere."
- `useRefused` (reason pilfer): "`${item}` does not heal, so as far as a Pilfer is concerned it does not work."
- `itemRejected`/`equipRejected` (reason woodsman): "A Woodsman in `${item}` is a tree in a tin. No."
- `wanderingMonster` (bard flag, additive clause): " Something too stupid to know better heard the singing."

## Task Commits

Each task was committed atomically:

1. **Task 1: Joiners refuse a Cutthroat; Magic User Joiners refuse a Wilmsry** - `00ec2f7` (feat)
2. **Task 2: Woodsman armour gate (canEquipArmor + store filter) and Pilfer heal-only useItem** - `dbd187e` (feat)
3. **Task 3: Bard wake roll; EVENT_NARRATION entries; the 30-blurb flavor sweep; full suite green** - `fe95328` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/encounters.js` - `meetJoiner`'s refusal branch (reasons cutthroat/wilmsry), JSDoc update
- `engine/items.js` - `armorRefusalReason` export; `canEquipArmor` delegation; `takeItem`/`equipItem` armour-path collapse; `useItem`'s Pilfer gate
- `engine/economy.js` - `openStore`'s armour filter routed through `canEquipArmor`
- `engine/movement.js` - `newDay`'s `wakeOn`/Bard wake widening; `wanderingMonster.bard` flag
- `src/browser/eventNarration.js` - `joinerRefused`/`useRefused` builders; woodsman clauses; bard clause
- `content/flavor.js` - 14 rewritten SUB_NOTE/RACE_NOTE blurbs
- `test/unit/identity-world.test.js` - new, 22 tests

## Decisions Made

- Pinned Wilmsry-vs-Magic-User-joiner seeds (1 and 5) via a live scan rather than guessing/hand-tracing rollCharacter's internals — matches the plan's explicit instruction and this project's "pins are measured, not adjusted" convention (established in 24-03).
- Kept the check order in `armorRefusalReason` exactly as specified (noArmor -> woodsman -> tooHeavy -> null) since a Woodsman's Mail is otherwise class-legal for a Fighter — the woodsman check must run before the generic legality check would say "yes."
- The store's armour filter gate applies `canEquipArmor` to `ARMORS` entries directly (which carry `cls`/`ar` — the same shape `armorRefusalReason` expects for `it`), avoiding any need to reshape the filtered candidate.
- Flavor rewrites preserve each blurb's original sentence structure and unaffected clauses wherever possible (sharpen, don't replace) per the plan's Woodsman/Pilfer framing — Cutthroat and Court Mage needed a full clause swap since the old text described a mechanic (a party member literally dying, "one in twelve") that no longer matches reality.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria greps, the 30-key order/count check, `npm test` (1118/1118, `# fail 0`), and `node --test "test/parity/**/*.test.js"` (33/33, `git status --porcelain test/parity` empty) passed on the first full run after Task 3's changes landed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This plan closes out the remaining IDENT-05/IDENT-07 world-side mechanics and the full IDENT-09 flavor sweep for Phase 24 — REQUIREMENTS.md's IDENT-05/07/09/FID-07 rows were already `Complete` from 24-01/24-03/24-04 and stay so; this plan is the flavor sweep's actual execution (24-CONTEXT.md explicitly deferred the sweep to this plan).
- `docs/CLASS-PASS.md`'s Rulings section (owned by a later plan, per 24-01/24-03/24-04's own readiness notes) can now cite this plan's Cutthroat/Wilmsry/Woodsman/Pilfer/Bard rationale paragraphs verbatim.
- No blockers. `npm test` 1118/1118, parity 33/33, `test/parity/prototype-master.js.txt` and every other fixture untouched. Every new event/reason/flag is narrated and coverage-guard clean.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: engine/encounters.js
- FOUND: engine/items.js
- FOUND: engine/economy.js
- FOUND: engine/movement.js
- FOUND: src/browser/eventNarration.js
- FOUND: content/flavor.js
- FOUND: test/unit/identity-world.test.js
- FOUND: .planning/phases/24-every-sub-class-and-race-one-good-one-bad/24-05-SUMMARY.md
- FOUND commit: 00ec2f7 (Task 1)
- FOUND commit: dbd187e (Task 2)
- FOUND commit: fe95328 (Task 3)
