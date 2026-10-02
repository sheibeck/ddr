---
phase: 89-item-audit-fixes
plan: 09
subsystem: items
tags: [items, text, text-01, plain-language, save-load, tolerant-load, wording-guard, fixtures, narrative-ledger]
requires:
  - phase: 89-08
    provides: the Q1 and Q6 engine rules the item texts now state (no floor-12 hold, one depth-rising resist, the Walnut Staff's full Weaken)
  - phase: 89-02
    provides: Enlarge's "foes +1 to hit you" wording, the model for the Gauntlet
  - phase: 89-03
    provides: the Poplar Staff's party-heal text (this plan adds its charges and recharge)
provides:
  - "every JEWELRY, CLOAKS, STAVES, POTIONS and BAG_ITEMS row, the Oracle and rail item start lines, and the item chip sentences speak in signed to-hit, d20 ranges and foe counts, never faces or squares of foes"
  - "engine/derived.js#canonItemText(it): the current content text for a known item"
  - "engine/saveState.js#refreshItemTexts(state): the tolerant-load text refresh, run by validateSave and rehydrate"
  - "weapon to-hit and crit, armour bulk and bag carry stat lines (ITEM_STAT_COPY) on the Gear tab, store, loot and find cards, and the Gear tab bag meter's caps line"
  - "test/unit/item-text-wording.test.js: the TEXT-01 item wording guard"
affects: [89-10, phase-90, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a known item's saved txt is refreshed from its content row on every load (words only, no rng, idempotent)"
    - "item texts state ranges on a d20 only for a foe's roll; a scaling die (the hero's strike die) is stated as a count of top numbers"
key-files:
  created:
    - test/unit/item-text-wording.test.js
    - test/unit/item-text-refresh.test.js
    - docs/narrative-pass/why/89-09.json
  modified:
    - content/treasure-tables.js
    - content/potions.js
    - content/bags.js
    - engine/derived.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/viewModels.js
    - src/browser/gearTab.js
    - mazeworld.html
    - test/unit/authored-ranges.test.js
    - test/unit/roll-sign-consistency.test.js
    - test/unit/size-voice.test.js
    - test/unit/item-stat-lines.test.js
    - test/unit/control-spells-depth.test.js
    - test/unit/gear-panels.test.js
    - test/unit/ether-wallwalk.test.js
    - test/unit/item-activation.test.js
    - test/unit/staff-wield.test.js
    - test/unit/worn-migration.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/fixtures/shell-snapshots (six of eight)
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/narrative-pass/why/q-260928-frz.json
key-decisions:
  - "Hard caps read '(20 on a d20; 19–20 if you insulted them)' (the user's example, computed from facesRangeText); a weapon's crit is a COUNT of the strike die's top numbers ('crits on the top 2 numbers of your strike die') because the hero's strike die scales from d20 to d6"
  - "The Helm says it lets you always parley with Humans, Demons and Beasts (a parley is talking your way out of the fight instead of swinging, one try per fight, +2 to the parley roll, Ninjas and Masters of Arms still will not) and says nothing of parley's rewards (PARLEY-01, Phase 91)"
  - "Declared parity after.worn.cloak.txt records were re-recorded (the Phase 88 Cloak of Regeneration precedent) instead of widening REWORDED_TXT_ITEMS, which strips c.items only"
  - "Every staff text states its charges and its recharge (the audit: no row's text stated a recharge)"
patterns-established:
  - "refreshItemTexts: a reworded content row reaches every old save (hero, Joiners, pending find, loot pile, open store)"
requirements-completed: [TEXT-01, ITEM-01]
status: complete
duration: ~5h
completed: 2026-09-30
---

# Phase 89 Plan 09: Item text in plain words Summary

**Every item row, Oracle and rail start line, and chip sentence now says what the engine does in signed to-hit ("foes −2 to hit you"), d20 ranges ("20 on a d20; 19–20 if you insulted them") and foe counts ("up to 4 foes"); the Walnut Staff casts Weaken, the Death potion reads "you're dead!", every staff states its charges and recharge, and a saved game's items load with the current words.**

## What was built

### Task 1: the wording (commit 73f1189c, 1099d448)

- **Item rows** (`content/treasure-tables.js`, `potions.js`, `bags.js`):
  - Signed to-hit: Anklet of Invisibility "foes are −2 to hit you", Gauntlet of the Giant "foes +1 to hit you".
  - D20 caps: Cloak of Invisibility, Invisible potion (also "a day (100 squares)") and Crystal Staff (also "the whole party"): "foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them)".
  - Foe counts and the Q1 resist: Amulet of Stone "up to 4 foes", Birch and Oak "up to 2 foes", Cedar "every foe in the fight (a fight holds at most 3)"; each says "each foe may resist, and the deeper the floor, the likelier it does"; no floor-12 sentence anywhere.
  - Helm of Knowledge: always parley with Humans, Demons and Beasts; what a parley is; +2 to the parley roll; no rewards restated.
  - Walnut Staff: "casts Weaken on the room for the whole fight: each foe may resist ..., and each foe that does not does half damage and hits you only on a high roll (18–20 on a d20; 17–20 if you insulted them)".
  - Cloaks: Speed, Flying and Ether state their effect and their rest (Ether also the ten squares and the entombment); Rowan Staff states what the dome soaks; Pine Staff says no roll to hit but each foe may resist; Acuteness "your strike die becomes a d6 for d8 rounds"; Death "you're dead!"; the three upgrade bags state their wilmst and ration caps.
  - Every staff ends "N charges, one back every R squares" (all eight, Poplar included).
- **Narration and chips:** `itemEffectStarted` (Oracle and rail, hero and Joiner) for invis, unseen, giant and tongue, and the invis, giant, unseen and tongue `CONDITION_EXPLAIN` sentences in `mazeworld.html`, in the same terms.
- **Stat lines** (`src/browser/viewModels.js`, `gearTab.js`): a weapon states its to-hit when it has one ("−1 to hit", "+1 to hit", never "+0") and its crit when it is wider than one number; a bulky armour states "−N to climb, leap and flee rolls"; a bag states "carries up to N wilmst and M rations"; the Gear tab's bag meter states the same for the small starting bag.
- **Guard:** `test/unit/item-text-wording.test.js` (17 tests) over every row, every start line for every activation kind, and every item chip sentence: no face(s), no "squares of" foes, no "understand them", signed to-hit with U+2212 only and never zero, d20 ranges one number or low–high with U+2013, the four probe edges named in its header.

### Task 2: ranges pinned to the engine, and the load refresh (commit 0c75163e)

- `engine/derived.js#canonItemText` and `engine/saveState.js#refreshItemTexts` (called at the end of `validateSave` and `rehydrate`); 10 tests in `item-text-refresh.test.js` (bag, worn, wielded staff, a Joiner's gear, the pending find, the loot pile, an open store's item and potion `sub`; unknown items keep their text; nothing else moves; no rng; idempotent; hostile values never throw).
- `authored-ranges.test.js`: the three invisibility items and the Walnut Staff pinned as d20 ranges computed from the engine's faces; the Anklet, Gauntlet and Helm as signed to-hit; the Helm's parley reach (it opens exactly Humans, Demons, Beasts, Lair Beasts); the staves' charges and recharge; the weapon crit and to-hit lines against real strikes; the area items' foe counts against a real `useItem` with five foes (Amulet 4, Birch 2, Oak 2, Cedar all). The face helpers stay for spells and abilities.

### Task 3: ledger, measure, declare (commit 579f3fec, 8cbd3df9)

`docs/narrative-pass/why/89-09.json` (42 rows from a corpus diff of the plan base against the change), review pages regenerated (583 -> 615 rows, in sync), a Phase 89 plan 09 section in `test/parity/FIXTURE-INVENTORY.md`.

## Fixture drift (TEXT-01 items)

Full record in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 09"). Predicted: parity moves only where a declared record carries a reworded worn cloak; bot pins only where a hashed state carries a reworded `txt`; unit pins and shell snapshots that state old words. Measured:

- **Parity: 66 / 66.** First run 12 failures, all `worn.cloak.txt` of declared `after` records (Cloak of Ether, Cloak of Flying). Nine records re-recorded alone (chargen seed 3; combat win, lose-plain, flee, parley; economy `divergence` and `chargenDivergence`; encounters tablefour and faerie), the text read from the engine's own row, each rationale gaining a Phase 89 plan 09 sentence. Ether "walk through walls, once every 100 squares" -> "used, you walk through walls for ten squares (be in a corridor when it ends: the wall will not make room); then eighty squares before it will do it again"; Flying "flight for 20 squares, once every 50" -> "used, flight for twenty squares; then fifty squares before it will do it again". Prototype sides, `prototype-master.js.txt`, `comparables.js` untouched.
- **Bot state pins: 6 of 8 moved** (`solo-2`, `solo-thief-pilfer`, `solo-magicuser-sorcerer`, `party-1`, `party-fighter-knight`, `deep-8`); `solo-1` and `deep-14` unchanged. Re-recorded alone, pasted by hand with a dated comment; `roll-high-baseline.mjs save` never run. Actions/dead/depth identical for all eight. **Proven text-only:** all eight pins run from a scratch tree with only `content/treasure-tables.js`, `potions.js`, `bags.js` at the plan base hash to their previous pins. `roll-high-save-compat` unchanged (13 / 13 with the state pins).
- **Shell snapshots: 6 of 8 moved** (`thief.gear`, `mu.gear`: the caps line; `thief.gear-sheet-bag`, `-worn`: the Anklet text; `thief-store.store`: a Flail's "−1 to hit", the Warded plate's bulk; `mu-store.store`: the Warded plate's bulk). `mu.hero` and `thief.hero` byte-identical.
- **Unit pins moved:** `authored-ranges`, `roll-sign-consistency`, `size-voice`, `item-stat-lines`, `ether-wallwalk`, `item-activation`, `gear-panels`, `control-spells-depth` (item half dropped, per the 89-08 hand-off), and the stand-in items in `staff-wield` and `worn-migration` (ten tests that loaded literal old texts now carry their rows' current text). Each before/after is in the inventory.
- **Main-rng draws:** none added, removed or reordered. No new serialized field, so no `*Comparable()` carve-out.

## Deviations from Plan

**1. [Rule 3 - Blocking] Parity re-declared, `REWORDED_TXT_ITEMS` not widened.** The plan predicted adding item names to `REWORDED_TXT_ITEMS`. That set strips `c.items[]` only; the failing text was a WORN cloak in a declared `after` record, whose precedent (Phase 88, Cloak of Regeneration) is to re-record the declared value with a rationale. Followed that; `comparables.js` is untouched.

**2. [Rule 1 - Bug] A weapon's crit is a count, not a d20 range.** The plan's TEXT-01 wording would have put "19–20 on a d20" on a Rapier, but the hero's strike die scales from d20 to d6 (the Phase 79 rule), so that is wrong above level 1. The stat line reads "crits on the top 2 numbers of your strike die" (the user's own Ninja phrasing). The foe's invisibility caps keep the user's "on a d20" example.

**3. [Scope, audit rows] Weapon, armour and bag stat lines and the bag meter caps line.** The audit marks 16 weapon rows, three armour rows and the bags `fix text (89-09)`; the plan allowed the weapon line "if the audit asks". Added the to-hit and crit lines, the armour bulk line, the bag carry line, `content/bags.js` texts and `GEAR_COPY.bagCaps` (not in the plan's file list).

**4. [Rule 3] Files outside the plan's list:** `test/unit/ether-wallwalk.test.js`, `item-activation.test.js`, `gear-panels.test.js`, `staff-wield.test.js`, `worn-migration.test.js` (pins or fixtures of an item's literal text), and `docs/narrative-pass/why/q-260928-frz.json`: its Birch Staff row (its after, the d4 text, is no longer printed, and 89-09 sorts before `q-` so it cannot chain from it) is folded into 89-09's Birch row, whose why names the 2026-09-28 ruling.

**5. [Plan adjustment] The Cedar Staff's wording** says "every foe in the fight (a fight holds at most 3)" rather than a number, as the engine reaches every foe (89-08's hand-off).

**6. [Plan adjustment] `roll-high-save-compat` was not re-recorded:** its saved state carries no reworded item.

## Known Stubs

None.

## Threat Flags

None. Display text, one pure lookup and a load-time rewrite of `txt` on items a save already holds; no new network, auth or file surface.

## Results

- `npm test` (final full run, after the last change): **8,644 tests, 8,642 pass, 0 fail, 2 skipped** (base 8,609 / 8,607 / 0 / 2; +35). No CRLF doc-ledger failures appeared in this worktree run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66. `node tools/narrative-review.mjs` then `--check`: 615 rows, in sync.
- Acceptance greps: "you're dead!" 1; "Weaken" in treasure-tables 1; "on a d20" 4 (treasure-tables 3, potions 1); "to hit you" 2; "parley" 1; `git diff --stat dd49e8d5 -- engine/items.js engine/combat.js test/parity/prototype-master.js.txt tools/lib/event-variants.mjs docs/narrative-pass/corpus-base.json` empty.

## Hand-off to 89-10

- Audit rows this plan fixed (verdict `fix text (89-09)` -> `fixed text (89-09)`): the Cloaks of Invisibility, Speed, Flying and Ether; the Gauntlet, Anklet and Helm; every staff (Rowan, Birch, Walnut, Oak, Crystal, Pine, Cedar; Poplar's recharge); the Amulet of Stone; the Death and Invisible potions; the 16 weapons (to-hit, and crit for the five precise blades), Studded, Mail and Plate (bulk), and the four bags (caps). `docs/ITEM-AUDIT.md` itself is untouched here.
- A text-vs-engine number guard (89-10) can read the numbers from the same places the new tests do: `ACTIVATION_OF` charges/recharge/effect/cd, `foeSwingVsHero().faces`, `SIZE_FACES_PER_STEP`, `weaponRow().need/crit`, `ARMORS[].bulk`, `BAGS[]`.
- Phase 90 owns spell text (the face helpers and the "past floor 12" spell half of `control-spells-depth.test.js` stay); Phase 91 owns parley's rewards and the Helm wording that follows them.

## Human verification (deferred to end of run)

1. Open the Gear tab sheet for an Anklet of Invisibility, a Cloak of Invisibility and a Crystal Staff: each reads in "to hit" or "on a d20" terms, never "faces".
2. In a store, read the Invisible potion and any staff line: plain words, the numbers the engine uses (charges and recharge on every staff).
3. Read the Helm of Knowledge: it says you can always parley and what a parley is.
4. Load a save made before this build that carries a reworded item: its sheet shows the new text.
5. The Death potion reads "you're dead!".
6. A weapon sheet shows its to-hit ("−1 to hit" on a Mace, "+1 to hit" and "crits on the top 2 numbers of your strike die" on a Rapier); Plate shows "−2 to climb, leap and flee rolls"; the Gear tab's bag meter shows what the bag carries.

## Self-Check: PASSED

- Files exist: `test/unit/item-text-wording.test.js`, `test/unit/item-text-refresh.test.js`, `docs/narrative-pass/why/89-09.json`, `engine/derived.js` (exports `canonItemText`), `engine/saveState.js` (exports `refreshItemTexts`), this file.
- Commits exist on `worktree-agent-a687deaa3c37fd44b`: `73f1189c`, `0c75163e`, `1099d448`, `579f3fec`, `8cbd3df9`.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt` untouched.
