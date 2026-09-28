---
phase: 79-content-narrative-pass
plan: 09
subsystem: panel-copy
status: complete
tags: [VOX-05, ROLL-04, panels, hero-sheet, narrative-pass]
requirements: [VOX-05, ROLL-04]
dependency_graph:
  requires: [79-01, 79-03, 79-05, 79-06]
  provides:
    - "audited panel copy in gearTab.js, gearSheet.js, upgradeWhy.js, viewModels.js, storeScreen.js, heroTab.js"
    - "engine/derived.js#weaponDamageTerms and #weaponDamageRange: the one damage modifier stack, read by weaponDamage and the Hero sheet"
    - "test/unit/hero-damage-agreement.test.js: the sheet's range and #s-dmg line pinned against weaponDamage"
    - "docs/narrative-pass/why/79-09.json (16 rows)"
  affects: [79-11, 79-12, 79-13]
tech_stack:
  added: []
  patterns:
    - "a display reads the engine's own terms (weaponDamageTerms/Range) instead of restating a modifier stack"
    - "an authored number in copy (healingDesc's 7–25 hp) is pinned against the engine function that rolls it"
key_files:
  created:
    - test/unit/hero-damage-agreement.test.js
    - docs/narrative-pass/why/79-09.json
  modified:
    - engine/derived.js
    - src/browser/heroTab.js
    - src/browser/gearTab.js
    - src/browser/gearSheet.js
    - src/browser/upgradeWhy.js
    - src/browser/viewModels.js
    - src/browser/storeScreen.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/shell-worn-slots.test.js
    - test/unit/heroTab.test.js
    - test/unit/itemRowState.test.js
    - test/unit/gear-panels.test.js
    - test/unit/gear-view-models.test.js
    - test/unit/gear-tab-dom.test.js
    - test/unit/gear-sheet-model.test.js
    - test/unit/gear-sheet-dom.test.js
    - test/unit/lootCompare.test.js
    - test/unit/upgrade-why.test.js
    - test/unit/store-rows.test.js
    - test/unit/store-delivery.test.js
    - test/unit/fixtures/shell-snapshots/mu.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - .planning/todos/completed/2026-09-25-hero-sheet-damage-range-omits-some-bonuses.md
decisions:
  - "The Hero sheet's damage range and #s-dmg line read engine/derived.js#weaponDamageRange/weaponDamageTerms; weaponDamage itself now sums the same terms around its unchanged single dice draw (no rule, draw or fixture moves)."
  - "#s-dmg shows a negative bonus with U+2212 (a level-1 Guard reads '1² + d6 − 3') and names the Sorcerer's cap as ' (max 9)'."
  - "The store's ' · triple for armour, double for arms' clause was removed: no engine code sets st.markup, so it could never show and described a rule the game does not have."
  - "GEAR_COPY.healingDesc states drinkPotion's 7–25 hp and the Wilmsry double, pinned against drinkPotion in gear-view-models.test.js."
metrics:
  duration: "about 55 minutes"
  completed: 2026-09-27
  tasks: 2
  files: 33
---

# Phase 79 Plan 09: Panel copy and the hero sheet's damage range Summary

The Hero, Gear, Gear-sheet, store, loot-compare and upgrade-why panels now state the fact first: the empty bag, the healing potion's 7–25 hp, what an enchantment does, a staff's recharge in words, "average damage a swing", and the skill budget in words. The Hero sheet's damage range and #s-dmg line now read the engine's own damage terms, so Master of Arms, Heft and might can no longer go missing.

**Plan base:** `08969929`

## Commits

| Task | Commit | What |
|---|---|---|
| Extra scope (todo) | `f636af13` | fix: the hero sheet's damage reads engine/derived.js#weaponDamageTerms/Range; agreement test; todo moved to completed |
| 1 | `03b70220` | feat: panel copy rewrites (gear, gear sheet, upgrade why, item stats, loot compare, store, Hero abilities) |
| 1 | `a57b4693` | feat: the Special skills heading's "12/12 vp" becomes "12 of 12 points spent" |
| 2 | `fafac9cd` | test: re-pins, the declared snapshot regenerations, the ledger, the FIXTURE-INVENTORY subsection |

## Every changed string (before → after)

| Key | Before | After | Why |
|---|---|---|---|
| bank:GEAR_COPY.bagEmptyHead | NOTHING LEFT TO CARRY | THE BAG IS EMPTY | a fresh hero starts with an empty bag; "left" claimed a history |
| bank:GEAR_COPY.bagEmptyBody | You used it all. That was the plan, technically. | Nothing here takes a slot. Plenty of room for regret. | wrong on turn one, and after a drop or a sale |
| bank:GEAR_COPY.healingDesc | Heals. Wasted at full health. | Heals 7–25 hp (double for a Wilmsry). Stays corked at full health. | no amount; the row is disabled at full health, so nothing is ever wasted |
| bank:GEAR_COPY.weaponMagic | +{n} magic. Somebody cared, once. | +{n} damage, and it hits what only magic can. Somebody cared, once. | "+N magic" never said what it does |
| bank:GEAR_SHEET_COPY.use.charges | Charges {state}. | {k} of {max} charges left; the next one comes back in {n} squares. | it repeated the row tag ("Charges 1/3 · 17 SQ.") |
| bank:GEAR_SHEET_COPY.use.chargesOne | (new) | {k} of {max} charges left; the next one comes back in 1 square. | the singular |
| bank:ITEM_STAT_COPY.text.wield | Wielded: {lab} weapon; its power works only in hand. | Fights as a {lab} weapon; its power works only while wielded. | read as if a bagged staff were already in hand |
| bank:UPGRADE_WHY_COPY.swing | {got} vs {have} a swing | {got} vs {have} average damage a swing | the numbers had no unit |
| bank:UPGRADE_WHY_COPY.lostProf | loses your +{n} practiced bonus | loses your +{n} damage from practice | proficiency is a damage term |
| bank:ABILITY_VIEW_COPY.noAbilitiesCaster (and the renderAbilityRows literal) | Spells are the trick. | No abilities. Spells are the trick. | the joke stood in for the fact |
| raw:heroTab.js#renderHeroTab | …/… vp | … of … points spent | "vp" is never explained |
| raw:viewModels.js#lootCompare | … slots — you carry … / no bag | … slots — yours holds … / you carry no bag | "you carry 8" read as eight items carried |
| raw:storeScreen.js#renderStoreScreen | · triple for armour, double for arms | (removed) | dead: nothing sets st.markup, and the rule does not exist |

The #s-dmg formula line is not a corpus entry, but its output changed for every hero with Heft, Master of Arms, might, a potion of Strength, a low-level Guard penalty or the Sorcerer cap. It previously left out Heft, Master of Arms, might, the potion, the Guard's penalty and the cap. A level-1 Guard now reads "1² + d6 − 3", and a Sorcerer's line ends " (max 9)".

The side effect in narration: `upgradeWhyText` also feeds `oracle:purchaseBagged` / `rail:purchaseBagged`. A bagged store weapon's line now ends "… average damage a swing". The corpus renders those builders with a string `why`, so no corpus key moved. The recorded event-order corpus (`default-fold-corpus.json`) does not contain the phrase and was **not** regenerated.

Judged and passing (unchanged): every other GEAR_COPY, GEAR_SHEET_COPY, ITEM_STATE_COPY, USABLE_COPY, STORE_ROW_COPY, ITEM_STAT_COPY, UPGRADE_WHY_COPY, HERO_SIZE_COPY, RATIONS_COPY, FINAL_SHEET_COPY and ABILITY_VIEW_COPY leaf; the refusal reasons in `refusalText` (they match `weaponRefusalReason`/`armorRefusalReason`); the armorDisplay/bagArmorText lines; the grimoire reasons; the store header, bag-full and repair lines; and the Gear tab's sell/drop/swap prompts. The four boards modules (`boardsPanel.js`, `boardsView.js`, `globalBoards.js`, `boardScores.js`) have no entries owned by 79-09, because the corpus gives their banks to 79-06. No boards file was changed.

Checks: `node tools/voice-inventory.mjs --owner 79-09 --roll-under --hygiene --safety --count` prints 0 (it was already 0 at base). `--twins` has 0 hits. `node --test test/unit/roll-sign-consistency.test.js` passes unedited. `git diff --quiet 08969929 -- content test/parity src/browser/identityFooter.js` exits 0; test/parity has only the appended FIXTURE-INVENTORY subsection, in the Task 2 commit.

## The extra scope: hero sheet damage (todo 2026-09-25)

- `engine/derived.js`:
  - `weaponDamageTerms(c)` returns `{ weapon, levelSq, bonus, cap }`, with every modifier held once.
  - `weaponDamageRange(c)` returns the pure `{ min, max }`.
  - `weaponDamage(c, rng)` now sums the same terms around its unchanged single `rollDice` draw, with the same cap and floor of 1. Integer sums only, the same draw in the same position, so no parity fixture, state pin or determinism test moved.
- `src/browser/heroTab.js`: `damageBracket` returns `weaponDamageRange(c)`. The new module-private `damageLine(c)` builds #s-dmg from `weaponDamageTerms(c)`.
- `test/unit/hero-damage-agreement.test.js`:
  - Walks all 24 sub-classes × 6 races × 8 weapons (Club, Dagger, Whip, Claymore, Bastard Sword, Bardiche, Short Sword, Fists) × levels 1 and 3 × 3 bonus shapes (none; prof + enchantment + might; Heft + a live Gauntlet of the Giant). That is 6,912 cases, comparing the sheet's min/max with `weaponDamage` at the lowest and highest faces.
  - Checks every 11th case's #s-dmg line against the engine terms and against weaponDamage's arithmetic.
  - Has direct cases for Master of Arms ("1² + d6 + 2", range 4–9), Heft + might, a Guard's "− 3", a Sorcerer's "(max 9)" and purity.
- The todo was moved with `git mv` to `.planning/todos/completed/` in the fix commit.

## Regenerated snapshots (declared)

With `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`, each diff contains only this plan's copy:

- `mu.gear.txt`: the empty-bag head and body, and healingDesc.
- `thief.gear.txt`: healingDesc.
- `mu-store.store.txt`: two compare lines, "average damage a swing".
- `thief-store.store.txt`: two compare lines, "average damage a swing".
- `mu.hero.txt`: "No abilities. Spells are the trick."
- `thief.hero.txt`: "12 of 12 points spent".

`thief.gear-sheet-bag.txt` and `thief.gear-sheet-worn.txt` showed only CRLF noise and were restored. The hero #s-dmg values in both hero snapshots did not change (Wizard "1² + d6", Thief "1² + d6/2").

## Re-pinned tests

Each re-pin carries a "VOX-05 (79-09)" comment at the pin.

- **Wording re-pins:**
  - `gear-panels.test.js`: the GEAR_COPY mirror.
  - `gear-view-models.test.js`: the heal row desc.
  - `gear-tab-dom.test.js`: a test title.
  - `gear-sheet-model.test.js` and `gear-sheet-dom.test.js`: the why line.
  - `lootCompare.test.js`: two why lines and the bag line.
  - `upgrade-why.test.js`: swing and lostProf.
  - `store-rows.test.js`: two compare lines.
  - `store-delivery.test.js`: why, the rail string and the Oracle regex.
  - `heroTab.test.js`: the Magic User literal.
- **Shape re-pin:** `itemRowState.test.js`. The charges branch now also carries `charges` and `max`, which gearUseCell reads.
- **Implementation re-pin:** `shell-worn-slots.test.js`. heroTab.js no longer calls `eff(c, "dmg")`. The pin now asserts the new engine import and the absence of the restated read, with the previous assertion quoted in a comment.
- **New pins:**
  - The recharge sentence (`gear-sheet-model.test.js`).
  - healingDesc's 7–25 hp and Wilmsry double against `drinkPotion` (`gear-view-models.test.js`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The engine accessor (orchestrator's extra scope) touches engine/**
- **Found during:** extra scope (the todo)
- **Issue:** the plan's must-have says engine/ stays byte-identical, but the orchestrator's extra scope asks for a pure accessor in engine/derived.js.
- **Fix:** added `weaponDamageTerms` and `weaponDamageRange`, and made `weaponDamage` read the same terms. There are no rule, draw or fixture moves, and the FIXTURE-INVENTORY `### Plan 79-09` subsection declares an empty moved set.
- **Commit:** f636af13

**2. [Rule 1 - Bug] The no-fork source guard**
- **Found during:** Task 2
- **Issue:** the first gearUseCell change called `activationFor` directly, and the gear-agreement guard caught it.
- **Fix:** itemRowState's charges branch now carries its counts, and gearUseCell reads them from there.
- **Commit:** fafac9cd

**3. [Rule 3] Pins outside the plan's file list**
- **Found during:** Task 2
- **Issue:** `gear-panels`, `store-rows`, `store-delivery`, `itemRowState` and `shell-worn-slots` pin strings or shapes this plan changed.
- **Fix:** re-pinned them. None of these files is owned by a same-wave sibling (79-07 or 79-08).
- **Commit:** fafac9cd

**4. Orchestrator handoff from 79-07 (healingDesc):** already handled in 03b70220, before the message arrived. The row now states the amount. It does not mention the turn cost, because the Gear tab's row is an out-of-combat readout.

## Handed on

- **79-11 / 79-12:** the key is narrationLines.js `EQUIP_REJECT_TEXT.tooHeavy`, printed by `rail:equipRejected` / `oracle:equipRejected`. It reads "Too heavy to carry.", but the engine's `tooHeavy` is the armour CLASS gate (Fighter-only armour; a Thief with Heft may wear up to AR 12), not weight. It fails rubric 4. The panels' own `refusalText` already says "Fighter only".
- **79-12, house spelling:** the panels mix "armor" and "armour". ITEM_STAT_COPY.label.ar reads "Armour rating", GEAR_COPY.armorRating reads "ARMOR RATING", and refusalText says "your kind wears no armour". This is the same decision 79-04 handed on.
- **79-12:** the store's Healing POTION item (content/potions.js, "+d10+2 hp", 79-05's content) and the HEALING POTION the Gear tab counts (`c.potions`, drinkPotion's 2×d10+5) are two different heals with similar names. The copy is accurate for each, but a player may confuse them.
- **79-10:** no failing static heading was found on the Hero, Gear or store screens in mazeworld.html. None handed on.

## Known Stubs

None.

## Verification

- `node tools/voice-inventory.mjs --owner 79-09 --roll-under --hygiene --safety --count` prints 0.
- `node tools/voice-inventory.mjs --check-ledgers --plan 79-09 --after` reports 6 ledger files and 0 errors. `node --test test/unit/voice-corpus.test.js` passes.
- `npm test` (`node --test`) passes 7,414 of 7,414.
- Parity passes 66 of 66, and `test/parity/fixture-inventory.test.js` passes 5 of 5. `node tools/fixture-inventory.mjs` reproduces the roster block byte for byte, and prototype-master's hash is unchanged (`a1f4d0dc…`).
- `boot:check` passes all four checks. It ran with a temporary node_modules junction and a www/ build; both were removed afterwards and the junction target was left untouched.
- No bot or tuning run was made (user ruling 2026-09-26).

## Self-Check: PASSED

- FOUND: test/unit/hero-damage-agreement.test.js
- FOUND: docs/narrative-pass/why/79-09.json
- FOUND: .planning/todos/completed/2026-09-25-hero-sheet-damage-range-omits-some-bonuses.md
- FOUND commits: f636af13, 03b70220, a57b4693, fafac9cd
