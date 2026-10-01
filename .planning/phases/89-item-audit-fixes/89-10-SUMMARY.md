---
phase: 89-item-audit-fixes
plan: 10
subsystem: items
tags: [items, audit, text-guard, party-wide, ledgers, usable-features, phase-gate]
requires:
  - phase: 89-02
    provides: Enlarge at +11 / foes +1 / 50 squares / 150
  - phase: 89-03
    provides: the Poplar Staff party heal (act.heal) and the Pendant source link
  - phase: 89-04
    provides: the Joiner's armour soak (applyFoeDamageToMember)
  - phase: 89-05
    provides: memberUseItem and its refusals, wear-on-join, Joiner timers, Q2 and Q3
  - phase: 89-06
    provides: the Joiner's in-fight item policy and item chips
  - phase: 89-07
    provides: the Company panel DRINK and USE
  - phase: 89-08
    provides: the shared depth-rising resist, Q1, Q4, Q5, Q6
  - phase: 89-09
    provides: every item text in TEXT-01 words and the load-time text refresh
provides:
  - "test/unit/item-text-engine.test.js: the text-vs-engine guard (numbersIn, ITEM_TEXT_FACTS, completeness, truth, a mutation sweep of every stated number, the surface and party-wide guards)"
  - "docs/ITEM-AUDIT.md closed: every row a shipped text, a final verdict and a pin (117 distinct titled pins); every Systems entry built or ruled"
  - "test/unit/item-audit.test.js close rules: no fix engine / fix text / balance call, every pin's file and title exist, the Closed line's pin count is true"
  - "docs/GEAR-BALANCE.md: 'Joiners use their items (Phase 89, ITEM-07)' and 'Phase 89: items that do what they say'"
  - "docs/USABLE-FEATURES-AUDIT.md section 4b and section 1 rows for the Joiner action; usable-features-audit.test.js memberUseItem CASES"
affects: [phase-90, phase-91, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "a claims table: each row's stated numbers captured by `(#)` slots in a sentence regex and read back off the real engine (a real useItem, strike, foe swing, tick walk), with a completeness rule that no number goes unclaimed"
    - "a close-state checker for a ledger doc: pins are `file: title`, every title is searched for in the file's source"
key-files:
  created:
    - test/unit/item-text-engine.test.js
  modified:
    - docs/ITEM-AUDIT.md
    - test/unit/item-audit.test.js
    - docs/GEAR-BALANCE.md
    - docs/USABLE-FEATURES-AUDIT.md
    - test/unit/usable-features-audit.test.js
key-decisions:
  - "No text drift and no engine drift was found at the close: every stated number in every row already equalled the engine, so no content row, no narrative corpus key and no parity comparable changed (the plan's content/treasure-tables.js, content/potions.js, comparables.js, why/89-10.json, NARRATIVE-PASS.md and review.html entries stay untouched)"
  - "The guard counts the number words once, once-ness included: 'once every 100' is claimed as [uses per cycle, cycle length], 'one back every 60 squares' as [charges restored, squares], and the idiom 'at once' is not a number"
  - "A fact's sentence has `(#)` slots that open up to any number token, so a CHANGED number still finds its slot and fails with the engine's value (not just 'sentence missing')"
  - "Match rows may keep a bare test file as their pin (13 do, all in Treasure and Faerie, where nothing was ever at issue); every fixed and ruled row names a title"
patterns-established:
  - "mutation sweep: change each stated number in each row to a different value and require the engine's value in the failure (over 80 numbers, 36 rows)"
requirements-completed: [ITEM-01, ITEM-06, TEXT-01]
status: complete
duration: ~3h
completed: 2026-09-30
---

# Phase 89 Plan 10: The item guard and the closed audit Summary

**An item's text and its numbers can no longer drift apart (a guard that reads every stated number off the real engine and fails on a changed or an unclaimed one), the item audit is closed with a pin on every fixed and ruled row (117 distinct titled pins), and the gear ledgers describe the new item rules. Full suite 8,682 tests, 8,680 pass, 0 fail, 2 skipped.**

## What was built

### Task 1: the text-vs-engine guard (`bb3d43a5`, `1762af45`)

`test/unit/item-text-engine.test.js` (21 tests):

- **`numbersIn(text)`** reads digits, number words (fifty, a hundred, twice, half, double, once), signed numbers (+11, U+2212 2), dice with or without a leading 1 (`d20+10` equals `1d20+10`) and d20 ranges with the one en dash (`19–20 on a d20`, and the bare `19–20` after it). A hyphen-minus sign or range separator is deliberately not recognised, so its digits surface as unclaimed numbers and fail.
- **`ITEM_TEXT_FACTS`** covers every one of the 36 JEWELRY, CLOAKS, STAVES, POTIONS and TOOLS rows (8 + 7 + 8 + 10 + 3; the 33 rows of the plan's `node -e` count plus the 3 tools), and the 3 upgrade bags have their own facts. Each fact is a sentence regex with `(#)` slots and a `value()` that reads the engine, never the text:
  - effect and cooldown: a real `useItem`, then every square ticked until the item is ready (`cycle`); "once every 100" is measured as one use per cycle and the cycle length;
  - staves: the charges the roller builds the staff with, and a real recharge walk (`narrateTimerTransitions`) for how many come back after how many squares;
  - damage and to-hit: `weaponDamageTerms`, `foeToHitVs` and `sizeAxisStep` with the item's live record (Ring +1, Gauntlet +2 and foes +1, Anklet −2, Strength +8, Enlarge +11 and foes +1);
  - dice: found by drawing 1 from a recording rng and noting each die asked for (Healing d10+2, Crystal d10+5, Acuteness d6 and d8, Pine d6 fireballs and 1d10+4, Birch d4), or by sweeping a derived stream (Poplar d20+10, Cloak of Regeneration d6);
  - the d20 ranges: `foeSwingVsHero` faces, plain and insulted, with the live effect (Walnut: from a real staff use that landed);
  - the rest: the Pendant's half and its one blow (`applyFoeDamageToPlayer`), the Helm's +2 and one try per fight (`parley`), Speed's two swings (`playerStrike`), Weaken's half damage (`foeTurn`), the Cloak of Armor's AR 15 (`armorSoak`), the dome's 100 hp, the areas reached (a real use against five foes), the torch, rope and ladder spent (`useTool`), the bags (`clampCarry`), "a fight holds at most 3" (`FOE_COUNT_TABLE`).
- **Completeness**: every number `numbersIn` finds must be captured by exactly one fact, and a row with numbers has facts while a row with none has none, so a number added to any row fails with the row and the number.
- **Mutation sweep**: every stated number in every row is changed to a different value and the guard must fail with the engine's value in the message (over 80 numbers), so no fact can be a decoration.
- **Surfaces**: `rollJewel`/`rollCloak`/`rollStaff` scripted onto every row, the store's potion and tool lines across classes, depths and seeds (every potion in `STORE_POTION_POOL`, Healing from the fixed line, never Death), the found potion for every Misc Magic potion, the Misc Magic cloak, staff and jewel finds, and `itemStatLines` printing the row's text as the effect with the staff's charges line.
- **Weapons and armour**: every label equals its dice and halve flag, `WEAPON_MAX` is the dice maximum, the stat lines state the row's to-hit and crit (and the real swing agrees with the stated to-hit); armour's AR, durability and bulk lines and the store's armour line equal `ARMORS`.
- **Bags**: the Gear tab bag meter and the stat lines for all four tiers, the small starting bag included, state what `clampCarry` enforces (the small bag has no item text, so the meter is where it speaks).
- **Party-wide**: every row whose text names the party or every Joiner (today the Crystal Staff and the Poplar Staff) is in `PARTY_WIDE_ITEM_EFFECTS` or is `partyHeal`, and every `PARTY_WIDE_ITEM_EFFECTS` key's text names the party; the reach is proven in the engine (a live Crystal Staff makes a foe's faces 1 against the hero and a Joiner, while the Cloak of Invisibility, which says "you", covers only the hero; a real Poplar use heals the hero and every Joiner by its own d20+10).

The checker is itself tested on doctored text: a changed number, an added number, a vanished sentence, a hyphen-minus sign and range, a number on a row that stated none.

### Task 2: the audit closed (`28cb7124`, `b0a106f1`)

- `docs/ITEM-AUDIT.md`: 92 row and system cells rewritten. Every row reads its shipped text (the 16 weapons now state their to-hit and crit lines, the heavy armours their bulk, the staves their new words, and so on), a final verdict (`match`, `fixed engine`, `fixed text`, `ruled`, `not in game`) and a pin. Engine and Canon cells that described the pre-fix state (the floor-12 limits, the Poplar's hero-only heal, the Pendant's surviving flag, "faces" wording, "the text kept the old sentence") now read what the engine does. Every Systems entry is `built (89-NN)` or `ruled (Qn, 2026-09-30) -> 89-NN`, each with its pins. Header: a dated "Closed" line stating 117 distinct pins. The vocabulary and the Findings section are brought up to date.
- `test/unit/item-audit.test.js` keeps every 89-01 rule and adds the close: no row or system reads `fix engine`, `fix text` or `balance call`; every `fixed` and `ruled` row names at least one `file: title` pin whose file exists and whose source contains the title; a bare file is allowed only on a `match` row and `—` only on a `match` or `not in game` row; every Systems entry is built or ruled with existing pins; the Closed line's pin count is true. Seven new tests prove the checker fails on a row turned back to `fix text`, a missing title, a missing file, a pin with no title, a malformed pin, an open system and a wrong pin count.

### Task 3: the ledgers (`e0091874`)

- `docs/GEAR-BALANCE.md`: "Members never activate items" is replaced by "Joiners use their items (Phase 89, ITEM-07)" (wear on join, `memberUseItem` and its refusals, the in-fight policy, item timers and heal-over-time on a Joiner, the armour soak, Q2/Q3/Q4) and a new "Phase 89: items that do what they say (ITEM-01, ITEM-05, ITEM-06, ITEM-07)" (Enlarge +11 for 50 squares at 150 with the user's report quoted, the Poplar party heal, the Pendant link, Q1 with the user's quote and the one folded resist, Q5, Q6 B, plain words). The Phase 88 "Joiners" paragraph that said Joiners had no item path is updated.
- `docs/USABLE-FEATURES-AUDIT.md`: section 1 rows for `noMember`, `inCombat`, `noPotions`, `fullHealth`, `leaderOnly` and the `member` forms of `cooldown` and `combatOnly`, and a new section 4b on the Joiner's items.
- `test/unit/usable-features-audit.test.js`: ten `memberUseItem` CASES (every reason with a throwing rng and a before/after JSON check, one potion success, one worn-item success), plus a doc-sync test for the reasons and the section.

## Requirement map (Phase 89)

| Requirement | Plans | Pins (a few, by file) |
|---|---|---|
| ITEM-01 (every item does what its text says; the audit and its pins) | 89-01 (audit), 89-02, 89-03, 89-08 (engine fixes), 89-09 (text), 89-10 (guard, close) | `item-text-engine.test.js` (truth, live, surfaces), `item-audit.test.js` (the close), `item-audit-fixes.test.js`, `poplar-party-heal.test.js`, `pendant-source-link.test.js` |
| ITEM-05 (Enlarge is worth drinking) | 89-02 | `enlarge-potion.test.js`, `size-items.test.js`, `item-text-engine.test.js` (Enlarge row) |
| ITEM-06 (party-wide reach and every missing system built or ruled) | 89-03, 89-05, 89-08, 89-10 | `item-text-engine.test.js` (party-wide), `joiner-defences.test.js`, `poplar-party-heal.test.js`, Systems pins in the audit |
| ITEM-07 (Joiners use items and soak hits) | 89-04, 89-05, 89-06, 89-07, 89-08 (repair) | `joiner-armour-soak.test.js`, `joiner-item-use.test.js`, `joiner-combat-items.test.js`, `joiner-item-chips.test.js`, `company-items-model.test.js`, `usable-features-audit.test.js` |
| TEXT-01 (item rows) | 89-09, 89-10 (guard) | `item-text-wording.test.js`, `authored-ranges.test.js`, `item-text-engine.test.js` |

## Declared fixture moves across the phase (one line each; full records in `test/parity/FIXTURE-INVENTORY.md`)

- 89-02 ("### Phase 89 plan 02"): `thief-store.store.txt` shell snapshot (Enlarge text and 53 to 105 wm); unit pins in `size-items`, `conditions`, `authored-ranges`, `size-voice`. Parity and bot pins unmoved.
- 89-03 ("### Phase 89 plan 03"): `roll-high-state-pins` `solo-thief-pilfer` hash (a bagged Poplar's use and text; proven use/text-only); `worn-slots` and `item-activation` unit pins. Parity unmoved.
- 89-04 ("### Phase 89 plan 04"): bot pins `solo-magicuser-sorcerer`, `party-1`, `party-fighter-knight` (first soaked Joiner blow); `joiner-defences`, `rollDirection`, `roll-high-guard` (rollCheck 22 to 23), `foe-damage`, `honest-gains`.
- 89-05 ("### Phase 89 plan 05"): bot pin `solo-magicuser-sorcerer` (state shape only: the dressed Joiner), `pre-switch-save.json` expected hash; `joiner-acquisition`, `party-model`, `resume-mid-encounter`, `map-until-move`, `roll-high-guard` (amount 7 to 8), `combat-gear-lock`.
- 89-06 ("### Phase 89 plan 06"): bot pins `solo-magicuser-sorcerer`, `party-1`, `party-fighter-knight`; `hero-conditions` scan; `tuning-bot` TERR-02 seed 4 to 6.
- 89-07 ("### Phase 89 plan 07"): `mu.hero.txt` shell snapshot, `shell-company-panel` sheet order. Bot pins unmoved (0 of 8).
- 89-08 ("### Phase 89 plan 08"): no parity or bot pin; `control-spells-depth`, `control-at-depth`, `freeze-rule`, `usable-features-audit` cure rows, `control-at-depth-rules`.
- 89-09 ("### Phase 89 plan 09"): nine declared parity `after.worn.cloak.txt` records re-recorded; bot pins 6 of 8; shell snapshots 6 of 8; item unit pins and ten stand-in items.
- 89-10: none. This plan changes tests and docs only (`git diff --stat a240e16a..HEAD` lists six files, none under `engine/`, `content/`, `src/` or `test/parity/`).

## Fixture drift (89-10)

Predicted: none (a guard test, a doc and two ledgers). Measured: `node --test "test/parity/**/*.test.js"` 66 / 66, same count as the phase base; `test/parity/prototype-master.js.txt` last changed in Phase 1 and untouched across Phase 89; `test/parity/harness/comparables.js` untouched; no new serialized field, so no `*Comparable()` carve-out; no roll-high pin, snapshot or fixture regenerated; `node tools/narrative-review.mjs --check` in sync (no corpus key changed, so no why-ledger file). One existing test file changed behaviour: `usable-features-audit.test.js`'s distinctness test now gives the Joiner-only reasons a `member` in its sample event (they always travel with it).

## Findings for Phases 90, 91 and 92 (from docs/ITEM-AUDIT.md "Findings for other phases")

- **Phase 90 (spells, the shared rising resist):** `risingResistFaces` and `foeResistsEffect` sit on every item effect; the spell sites still on the old floor-12 control machinery are Phase 90's (`engine/combat.js`: Bard's `sing`, `allyCast`'s Joiner Doze and Stun, `foeTurn`'s Ice payoff, `holdFoe`'s default; `engine/magic.js`: stun, stupid, blind, shrink, vapor, insane, status/Doze, petrify, a thrown sleep). The spell menu's resist hint and the foe card still read `resistFaces(intel)`. The "past floor 12" half of `control-spells-depth.test.js` and the face-speaking spell and ability texts stay.
- **Phase 91 (identity):** Wilmsry "heals twice as fast" covers the stock potion only, not item heals; a Joiner gets no Hardiness or Fridgian hide soak (IDENT-20); the Helm of Knowledge's parley wording must follow PARLEY-01's rewards.
- **Phase 92 (economy and the bot pass):** the Enlarge price and the Gauntlet's balance are tuning reads; whether Enlarge is worth drinking at every depth and what d20+10 to two bodies does to the Poplar were never measured (no bot run in Phase 89); a Joiner uses one ready item in round 1 (a small follow-up that would move the pins). Bot notes: the tuning-bot's Regeneration and wielded-staff logic has not been checked against the new window and the party heal; the fair bot's camp gate reads only the hero's appetite so a Joiner with too few rations repeats `campFailed` (fix `c.rations >= nightlyEats(state)`); `tallyUsage` counts a Joiner's `itemUsed` as the hero's.

## Gaps (engine drift found at close)

None. Every number every item row states equalled the engine on the first run of the guard, and the mutation sweep proves each fact reads a real engine value. No test was marked `todo`.

## Deviations from Plan

### Plan adjustments (not bugs)

**1. The plan's content, comparables and narrative files were not touched.** `content/treasure-tables.js`, `content/potions.js`, `test/parity/harness/comparables.js`, `docs/narrative-pass/why/89-10.json`, `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` were listed "only if a text drift fix changed a line". No drift was found, so none changed.

**2. Two small additions to the guard.** The idiom "at once" (the Amulet of Light) is excluded from the number words; a second commit (`1762af45`) added the Gear tab bag-meter check, because the small starting bag has no item text of its own.

**3. A bare file pin remains on 13 `match` rows** (Chest sealed scroll, the Misc Magic and Faerie rows for +1 Level, +2 Level, Magic Weapon, Magic Armor and Miscellaneous Magic, and a few more where the only coverage is a parity scenario). The plan allows `—` only on a row nothing was ever at issue on; these keep the file they had since 89-01 and the checker accepts a bare file on a `match` row only. Every `fixed` and `ruled` row names a title.

**4. Tooling note.** The audit doc and several tests were rewritten through small one-off Python scripts (kept out of the repo) because the document's rows are single very long lines; each rewrite was checked by `item-audit.test.js`, whose new close rules failed on the first version (two pin titles that contained a `;` or built their name from a template) and were fixed.

## Known Stubs

None.

## Threat Flags

None. Tests and documentation only; no new network, auth, file or wire surface.

## Human verification (deferred to end of run)

Combined list of plans 89-02 to 89-09 (device checks, one batched Pixel 7 pass at milestone close):

1. (89-02) Buy an Enlarge potion: the store line reads 150 wilmst and states "+11 damage, and foes +1 to hit you".
2. (89-02) Drink it: the Oracle and rail say +11 damage and foes +1 to hit; the Hero sheet's damage range rises by 11; the Enlarged chip explains the same.
3. (89-02) As a Troll, drink Enlarge: the size reads Huge and the damage range rises by 11 again.
4. (89-03) A Magic User with a Joiner wields a Poplar Staff while both are hurt and uses it: the Oracle and rail name both heals, and the Company panel's HP rises for the Joiner.
5. (89-03) Use the Pendant of Fortitude, then take it off before any blow lands: the Oracle says the next blow is no longer halved, and the Pendant shows cooling.
6. (89-03) Use the Pendant and take a hit with it on: the blow is halved as before.
7. (89-04) Fight beside an armoured Joiner (a Fighter in Studded): some foe hits on the Joiner are "soaked by <name>'s armour" and its HP does not drop for those.
8. (89-04) Keep fighting until the Joiner's armour gives out: the Oracle says so by name.
9. (89-04) The hero's own armour line in the Gear tab does not change when only the Joiner is hit.
10. (89-05) Recruit a Thief Joiner: the rail says what cloak it put on.
11. (89-05) A hurt Joiner drinks a potion outside a fight (from the Company panel): its HP rises and the rail names it; the hero's potion count does not change.
12. (89-05) Have a Joiner with a Cloak of Strength use it, then walk 50 squares: the rail says its cloak wore off, and 50 squares later that it is ready again.
13. (89-05) Recruit a Magic User Joiner: the rail says what its scroll did (a spell copied into its book).
14. (89-05, 89-07) USE on a Joiner's Cloak of Flying or Helm of Knowledge is not offered: the "Only the one in front can use this" line shows in place of USE.
15. (89-06) Start a fight beside a Thief Joiner wearing a Cloak of Strength: in round 1 the rail says it used the cloak, and its YOUR LOT card shows a Crit-proof chip.
16. (89-06) Let a Joiner with potions drop to a third of its HP: on its turn it drinks instead of swinging, and its HP bar rises.
17. (89-06) A Joiner with a Cloak of Speed used swings twice in a round.
18. (89-06, 89-07) Outside a fight, a Joiner's live item (for example Cloak of Speed or Ring of Power) shows its chip in the Company panel, and a cooling item shows its cooldown chip.
19. (89-07) Open the Hero tab with a Joiner: its card shows its armour (AR and durability), its healing potions, its worn cloak with a state, and its chips.
20. (89-07) Out of a fight, tap DRINK on a hurt Joiner: the rail names it and its HP bar rises; DRINK is disabled at full HP with the reason shown.
21. (89-07) Tap USE on a Joiner's ready Cloak of Strength: the rail says it used it, a Crit-proof chip appears on its card, and USE now shows "live" then "cooling".
22. (89-07) During a fight the Company card shows the one-line note and no buttons; YOUR LOT shows the Joiner's chips.
23. (89-07) Tap/arrow movement both still work with the Company panel open and closed.
24. (89-07) Tap a Joiner chip on the Company card: the rail shows the same tap text the hero's chip shows.
25. (89-08) Drink Cure Poison while diseased (or carrying nothing): the Oracle says it only cures poison and what you have, the potion is still in the bag. Drink it while poisoned: "Cured of poison." and it is gone. Same for Cure Disease.
26. (89-08) With a Joiner whose armour is worn and hurt, open a store: a line reads "Repair <Joiner>'s <armour>" with its points and a price a tenth of the armour's cost per point. Buy it: the Hero tab's Company card shows its armour whole and your own armour is unchanged. Dismiss the Joiner from the Hero tab with the store open, then tap the line: it says no charge and nothing is taken.
27. (89-08) Past floor 12, use the Oak Staff or the Amulet of Stone: stoned foes die outright (no "held" line); the roll detail shows "(intel N, depth +M)".
28. (89-08) Past floor 12, use the Cedar Staff: a foe that fails its resist stays asleep for the whole fight, not three rounds.
29. (89-08) Use the Walnut Staff in a fight: the foes' hits are halved and they miss more (they only hit on a high roll), for the whole fight, at any depth.
30. (89-08) Use the Birch Staff past floor 12: one resist line per foe, then a d4-round freeze, no separate "unmoved" line.
31. (89-09) Open the Gear tab sheet for an Anklet of Invisibility, a Cloak of Invisibility and a Crystal Staff: each reads in "to hit" or "on a d20" terms, never "faces".
32. (89-09) In a store, read the Invisible potion and any staff line: plain words, the numbers the engine uses (charges and recharge on every staff).
33. (89-09) Read the Helm of Knowledge: it says you can always parley and what a parley is.
34. (89-09) Load a save made before this build that carries a reworded item: its sheet shows the new text.
35. (89-09) The Death potion reads "you're dead!".
36. (89-09) A weapon sheet shows its to-hit ("−1 to hit" on a Mace, "+1 to hit" and "crits on the top 2 numbers of your strike die" on a Rapier); Plate shows "−2 to climb, leap and flee rolls"; the Gear tab's bag meter shows what the bag carries.
37. (89-10) Skim `docs/ITEM-AUDIT.md`: every row's verdict and pin reads true against what you saw on the device.

## Results

- `npm test` (final full run, after the last commit): **8,682 tests, 8,680 pass, 0 fail, 2 skipped** (base on master 8,644 / 8,642 / 0 / 2; +38: 21 in `item-text-engine.test.js`, 6 close tests and the doctored-doc checks in `item-audit.test.js`, 10 `memberUseItem` rows and 1 doc-sync test in `usable-features-audit.test.js`). None of the known worktree-only CRLF doc-ledger failures appeared.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, same count as the phase base. `node tools/narrative-review.mjs --check`: pages in sync.
- `git diff --stat a240e16a..HEAD`: six files (`docs/GEAR-BALANCE.md`, `docs/ITEM-AUDIT.md`, `docs/USABLE-FEATURES-AUDIT.md`, `test/unit/item-audit.test.js`, `test/unit/item-text-engine.test.js`, `test/unit/usable-features-audit.test.js`); nothing under `engine/`, `content/`, `src/` or `test/parity/`.
- Acceptance: `awk '/^## Rows/,/^## Systems/' docs/ITEM-AUDIT.md | grep -c "fix engine\|fix text\|balance call"` prints 0 and `grep -c "test/unit/"` on the same range prints 94; `grep -c "Joiners use their items (Phase 89, ITEM-07)" docs/GEAR-BALANCE.md` prints 1 and `grep -c "### Members never activate items"` prints 0; `grep -c "leaderOnly" docs/USABLE-FEATURES-AUDIT.md` prints 2 and `grep -c "memberUseItem" test/unit/usable-features-audit.test.js` prints 9; `node -e` over JEWELRY, CLOAKS, STAVES and POTIONS prints 33, and all 33 (plus the 3 tools) are covered by the completeness assertion.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | The text-vs-engine guard | `bb3d43a5` |
| 1 | The guard also pins the Gear tab bag meter and every bag tier's caps | `1762af45` |
| 2 | Close the item audit and tighten its test | `28cb7124` |
| 3 | The gear ledgers and the Joiner action's audit | `e0091874` |
| 2 | Pin the match rows that have a real test by title | `b0a106f1` |

## Self-Check: PASSED

- Files exist: `test/unit/item-text-engine.test.js`, `docs/ITEM-AUDIT.md`, `test/unit/item-audit.test.js`, `docs/GEAR-BALANCE.md`, `docs/USABLE-FEATURES-AUDIT.md`, `test/unit/usable-features-audit.test.js`.
- Commits exist on `worktree-agent-a831ba5afd4d37e46`: `bb3d43a5`, `1762af45`, `28cb7124`, `e0091874`, `b0a106f1`.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `engine/`, `content/` and `test/parity/prototype-master.js.txt` not modified.
