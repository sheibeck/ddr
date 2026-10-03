---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 06
subsystem: shell text layer (Gear tab WORN, BAG, CONSUMABLES and the Gear action sheet)
tags: [flavour, text-layer, rules-layer, gear, gear-sheet, snapshots]
requires:
  - phase: 95-01
    provides: flavorOf, flavorOfItem, flavorOfScroll
  - phase: 95-02
    provides: rulesLayer.js (mountRules, alwaysRules, the open-id set), RULES_COPY
  - phase: 95-04
    provides: MAGIC_ITEM_FLAVOR, WEAPON_FLAVOR, ARMOR_FLAVOR
  - phase: 95-05
    provides: the additive lead / rules / rulesId row shape and test/unit/rules-surfaces.test.js
provides:
  - additive lead, rules and rulesId on gearWornModel rows, gearBagCardsModel cards and gearConsumablesModel rows (one local layerRow helper in src/browser/gearTab.js)
  - additive lead, rules and rulesId on gearSheetModel (worn and bag targets)
  - renderGearTab: flavour in the WORN note and BAG desc slots, Always-on rules bodies on openers, a per-row RULES toggle on every CONSUMABLES row
  - renderGearSheet: flavour in the note slot and a RULES toggle around the stats
  - four declared fixture moves: thief.gear, mu.gear, thief.gear-sheet-bag, thief.gear-sheet-worn
affects: [95-07, 95-08, 96]
tech-stack:
  added: []
  patterns: [second-pass layering of finished rows (the old note IS the rules), openers carry no toggle and show rules statically only with Always on, rules ids keyed by index or slot so a DOM id is never duplicated]
key-files:
  created: []
  modified:
    - src/browser/gearTab.js
    - src/browser/gearSheet.js
    - test/unit/gear-view-models.test.js
    - test/unit/gear-tab-dom.test.js
    - test/unit/gear-sheet-model.test.js
    - test/unit/gear-sheet-dom.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/rules-surfaces.test.js
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/mu.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt
key-decisions:
  - "WORN rows and BAG cards (sheet openers) show flavour only and carry no toggle; with Always show the rules on, their exact old text sits statically under the flavour inside main."
  - "CONSUMABLES rows are not openers, so each carries its own RULES toggle after its description; the Gear sheet's toggle sits around its stats."
  - "Claude's discretion (for the user's end review): the armour WORN row keeps its live wear note; the WORN weapon row's voice line gives way to the weapon type's flavour (the old line is its rules); a jewel or cloak SWAP FOR or EQUIP candidate's sub reads the candidate's flavour."
requirements-completed: []
status: complete
duration: ~45 min
completed: 2026-10-03
---

# Phase 95 Plan 06: Gear tab and Gear sheet show flavour with RULES Summary

The Gear tab's WORN rows, BAG cards and CONSUMABLES rows, and the bottom action sheet, now lead with the item's flavour line and keep the exact old text one tap (or the Always setting) away. WORN rows and BAG cards stay plain openers; CONSUMABLES rows carry their own RULES toggle; the sheet's toggle wraps its stats. Four snapshot fixtures moved, all declared.

PLAN_BASE: 510da49a664c9b52336ab864b460fe45f02df699

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Gear tab: WORN rows, BAG cards, CONSUMABLES | 2e314a47 | `layerRow` helper; WORN layering as a second pass over the finished rows (weapon, wielded staff, cloak, jewels; armour, magic plate and empty rows untouched); BAG cards and CONSUMABLES rows layered; `renderGearTab` writes `lead ?? note/desc`, mounts rules on openers only when Always is on, and mounts the toggle on every CONSUMABLES row; thief.gear and mu.gear regenerated; surface cases f to i |
| 2. Gear sheet | d58e4771 | `gearSheetModel` adds `lead`, `rules`, `rulesId` on both branches; `candidate()` sub reads `card.lead ?? card.desc` for non-gear cards; `renderGearSheet` shows `lead ?? note` and mounts RULES around the stats; thief.gear-sheet-bag and thief.gear-sheet-worn regenerated; surface cases j to l |

## Before and after

WORN row (thief fixture, weapon, `.mw-gear-note`):
- before: `no enchantment. Just you and the swing.`
- after: `A small, quick blade: more sting than damage, but it has a gift for finding gaps.` (the old line is the row's `rules`, shown under it only with Always on). The Cloak of Armor row went from `used, it soaks as plate (AR 15) for fifty squares over whatever you wear ...` to `Wears like silk and turns blows like plate, whatever you do for a living.` The armour row's note is byte-identical.

CONSUMABLES row (mu fixture, HEALING POTION):
- before: desc `Heals 7–25 hp (double for a Wilmsry). Stays corked at full health.`
- after: desc `A reassuring swig that tops you up, and tastes exactly like medicine.`, then `<button class="mw-rules-btn" aria-controls="mw-rules-gear-cons-heal" aria-expanded="false" aria-label="Rules for HEALING POTION">RULES ▸</button>` and `<div id="mw-rules-gear-cons-heal" class="mw-rules-body" hidden>` holding the whole old line. The SCROLLS row is the same shape (flavour `The scroll picks the spell and you do the reading, which seems about fair.`, body = scrollDesc plus the reader's odds).

Worn sheet (thief, Bracelet of Flight):
- before: note hidden and empty; stats container held one `p.mw-gsheet-note.mw-gsheet-stat`: `used, twenty squares of flight when you ask; fifty to catch its breath`
- after: note visible `A bangle that waives gravity for a short flight, then reinstates it without warning.`; the stats container holds the collapsed `RULES ▸` toggle and a hidden body whose one line (`p.mw-rules-line.mw-gsheet-note.mw-gsheet-stat`) is the old stat text. The SWAP FOR Anklet of Invisibility sub went from the Anklet's rules text to `Makes you a little easy to overlook, so foes aim badly until the effect lapses.`

## Declared re-pins (file, test, what moved)

- `test/unit/gear-view-models.test.js`: "gearConsumablesModel, nothing held ..." whole-row `deepStrictEqual` gains lead, rules, rulesId (comment: Phase 95 Plan 06 declared re-pin). Eight new tests: worn ring, worn Long Sword (and +2 rules), wielded staff, armour/empty rows untouched, bag jewel, bag armour with usable tag, old-save Cloak of Healing, consumables (heal, buff potion, SCROLLS).
- `test/unit/gear-tab-dom.test.js`: "CONSUMABLES: the SCROLLS row's .mw-gear-desc shows the reader's own odds ..." now reads the odds from the row's `.mw-rules-body` line (the desc holds SCROLL_FLAVOR); the empty-slot note test stayed green unedited.
- `test/unit/gear-sheet-dom.test.js`: "Stats: the container is created once ..." now expects the toggle plus body (rows are the body's lines = model.rules) for a flavoured Axe; the "replaces, never appends" assertion counts the two children. The older note pin and `gear-sheet-model.test.js`'s swap-sub pin did not move because those tests use a made-up `kind: "jewelry"` item with no flavour (the tolerant path); the new flavour behaviour is pinned by six new model tests in `gear-sheet-model.test.js`.
- `test/unit/shell-tab-snapshots.test.js`: two header paragraphs (Plan 06 Task 1 and Task 2) declaring the four regenerations.
- Fixtures regenerated with `MZ_SNAPSHOT_UPDATE=1`: thief.gear, mu.gear (Task 1); thief.gear-sheet-bag, thief.gear-sheet-worn (Task 2). Both diffs were read: only the WORN notes (weapon, cloak, jewels), the BAG descs, the CONSUMABLES descs plus toggles and bodies (Task 1), and the sheet's note, stats container and the SWAP FOR sub (Task 2) changed.
- Fixtures restored: after the Task 1 regeneration `thief.gear-sheet-bag.txt` and `thief.gear-sheet-worn.txt` showed line-ending-only changes and were restored with `git checkout -- <file>` before the Task 1 commit (they were then regenerated for real in Task 2). After the Task 2 regeneration no unrelated fixture showed a change. mu.hero.txt is 95-05's.

## Tests added

- `test/unit/rules-surfaces.test.js`: cases f (WORN), g (BAG), h (CONSUMABLES), i (tolerant, Gear tab), j (bag sheet), k (worn weapon sheet), l (candidate sub and old-save sheet). 7 tests, each in both Always modes where the plan asked.
- `gear-view-models.test.js` +8, `gear-sheet-model.test.js` +6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan adaptation] WORN layering as a second pass instead of wrapping each return**
- **Found during:** Task 1
- **Issue:** the plan lists the layering per return statement; the WORN branches each return a long object literal, so wrapping every return would have rewritten most of the model.
- **Fix:** the original `rows` map became `plainRows` (untouched), and one second pass layers the filled non-armour rows using `row.note` as the rules (it is exactly the old note by construction, including the wielded staff's `staff.txt ?? ""`). Behaviour is identical to the plan; every field of every row is unchanged.
- **Files modified:** src/browser/gearTab.js
- **Commit:** 2e314a47

**2. [Plan adaptation] 95-05's rules-id convention was kept, with one deliberate difference**
- The plan's ids are used as written (`gear:worn:<slot>`, `gear:bag:<i>`, `gear:cons:heal|scroll|potion:<name>`, `gsheet:worn:<slot>`, `gsheet:bag:<name>`). These are already unique per document without 95-05's name suffix: a slot or bag index cannot repeat, and the buff-potion ids are per distinct potion name (the model groups same-named potions into one row). The sheet's bag id is keyed by name so a revealed body follows the item (only one sheet is ever open).

**3. [Test fixture note]** The older Gear tests build items as `kind: "jewelry"` (not the engine's `"jewel"`), which `flavorOfItem` does not resolve; those tests therefore exercise the no-flavour path unchanged. The flavoured paths are pinned with real `kind: "jewel"` items.

## Verification results

- Task gates: both verify commands exit 0 without `MZ_SNAPSHOT_UPDATE` (Task 1 sweep 408 tests, Task 2 sweep 346 tests, all passing).
- Full `npm test` at the end of the plan: tests 10393, pass 10385, fail 0, skipped 8, duration about 162 s (95-05 baseline 10372 / 10364 / 0 / 8; this plan adds 21 tests).
- `git diff --ignore-cr-at-eol --stat cb5f77ec -- test/unit/fixtures/shell-snapshots` lists exactly mu.hero, thief.gear, mu.gear, thief.gear-sheet-bag, thief.gear-sheet-worn.
- `git diff --stat cb5f77ec -- engine test/parity test/determinism`, the 18 GUARDS files and the five AUDIT_DOCS print nothing; `git diff --stat 510da49a -- mazeworld.html engine` prints nothing.
- `node tools/narrative-review.mjs --check` exits 0; no docs/narrative-pass or NARRATIVE-PASS.md change (no new player words).
- Acceptance greps: `mw-rules-btn` in mu.gear.txt = 2; `rulesId` in gearTab.js = 7; `alwaysRules()` in gearTab.js = 2; `mw-rules-body` in thief.gear-sheet-bag.txt = 1; `mw-rules-btn` in thief.gear-sheet-worn.txt = 1; `mountRules(doc, statsEl` in gearSheet.js = 1; both header paragraphs present once.
- Line endings: gearTab.js, gearSheet.js, the four edited gear tests and shell-tab-snapshots.test.js are `w/crlf`; rules-surfaces.test.js `w/lf`; none `w/mixed`.

## Requirements bookkeeping

FLAVOR-01 and FLAVOR-02 are NOT marked complete here (95-08 marks them); `requirements.mark-complete` was not run and `requirements-completed` is empty.

## Claude's-discretion calls for the user's end review

1. The armour WORN row keeps its wear note (hp left, destroyed, under the cloak): it is live state. Armour's flavour shows on its BAG card and in its Gear sheet.
2. The WORN weapon row's voice line (`no enchantment. Just you and the swing.` / the enchanted variant) gives way to the weapon type's flavour; the old line sits in that row's rules (statically with Always on) and is the first line of the sheet's RULES body. The enchantment still shows in the value cell (`d8 +2`).
3. A jewel or cloak SWAP FOR or EQUIP candidate in the sheet is described by its flavour; its rules are one tap away in its own sheet. Weapon and armour candidates keep their compare line.

## For the end-of-phase device check (Pixel 7, text size L)

1. The CONSUMABLES toggle under each description: its tap target size and where it sits relative to the USE or READ button.
2. The Always-on rules bodies on WORN rows and BAG cards: row height at text size L, and that a tap on a body still opens the Gear sheet (the body sits inside the opener's main and has no handler of its own).
3. The sheet's RULES toggle around the stats while the sheet scrolls, and that a revealed body stays open after USE or a swap refreshes the sheet.

## Known Stubs

None. Every surface reads live flavour maps; an item with no flavour renders its old text.

## Threat Flags

None. No network, auth, file-access or schema surface was added; the new fields are view-model strings and are never serialized into saves.

## Self-Check: PASSED

- FOUND: src/browser/gearTab.js (`layerRow`, `alwaysRules()`), src/browser/gearSheet.js (`mountRules(doc, statsEl`), test/unit/rules-surfaces.test.js cases f to l, four regenerated fixtures
- FOUND commits: 2e314a47, d58e4771
