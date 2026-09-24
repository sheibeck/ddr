---
phase: 71-device-round-polish-ii
plan: 02
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, gear, store, view-model, milestone-v2.0]
requirements: [POLISH-06]
requires:
  - src/browser/viewModels.js usableBy / armorDisplay (Phase 43 / Phase 28)
  - src/browser/gearSheet.js gearSheetModel / renderGearSheet (Phase 63)
  - src/browser/storeScreen.js renderStoreScreen / storeRowState (Phase 47 / 61)
provides:
  - itemStatLines(item, c), wornItemFor(c, slot), ITEM_STAT_COPY (viewModels.js)
  - storeItemStats(line, c, showUsable) (storeScreen.js)
  - gearSheetModel(...).stats and the renderer-created #mw-gear-sheet-stats root
affects:
  - the store screen's item rows (text of the italic segment)
  - the Gear tab action sheet (new stats block, note narrowed)
tech-stack:
  added: []
  patterns:
    - "one pure formatter shared by two surfaces, pinned by an agreement test"
    - "renderer-created root inserted via whyEl.parentNode.insertBefore (no markup edit)"
key-files:
  created:
    - test/unit/item-stat-lines.test.js
  modified:
    - src/browser/viewModels.js
    - src/browser/storeScreen.js
    - src/browser/gearSheet.js
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/gear-sheet-model.test.js
    - test/unit/gear-sheet-dom.test.js
    - test/unit/gear-sheet-agreement.test.js
    - test/unit/gear-sheet-shell.test.js
    - test/unit/storeScreen.test.js
    - test/unit/store-rows.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/gear-agreement.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt
decisions:
  - "D-04: the store row and the Gear sheet both render item stats from itemStatLines; an agreement test pins identical lists for bag and worn items"
  - "R-06: the sheet note never repeats a stat — bag note dropped when stats exist; worn armour/cloak/jewel note empties; under the Cloak of Armor the note reads armorDisplay(c).sub; the worn weapon keeps its voice note"
  - "Armour 'enchanted' is derived from AR/durability above the ARMORS row so it survives equip (the engine drops the Warded name on equip)"
  - "Lockpicks' store row now reads its item text ('1–5 on d10 against any lock') instead of the engine sub ('opens boxes on 1–5') — the formatter reads item.txt"
metrics:
  duration: "~45 min"
  completed: 2026-09-24
  tasks: 2
  commits: 5
---

# Phase 71 Plan 02: One stat formatter for the store and the Gear sheet Summary

The Gear tab's action sheet now shows an item's full stat list, including a worn weapon's damage dice. The list comes from `itemStatLines(item, c)`, the same formatter the store rows now use. An agreement test proves the two surfaces show identical lists for bag and worn items across every kind.

Closes source todo: `.planning/todos/pending/2026-09-24-gear-tab-item-sheet-shows-the-full-stat-set-like-the-store.md`.

## What was built

- **`itemStatLines(item, c = null)`** in `src/browser/viewModels.js`:
  - pure and null-safe;
  - returns a frozen array of frozen `{ key, label, value, text }` entries;
  - holds display text only: legality stays in `usableBy` (reused as the last entry), the damage label stays `WEAPONS[base].lab`, and durability uses `bagArmorText`'s tolerant `left ?? wp` rule.
- **`wornItemFor(c, slot)`** returns an item-shaped view of a worn slot:
  - weapon and armour mirror the engine's own `wornWeaponItem`/`wornArmorItem` shapes (`cls` from the ARMORS row, `left` from `c.armorWP`);
  - cloak and jewellery return `c.worn[slot]`;
  - an empty slot, or the magic plate with nothing under it, returns `null`.
- **`ITEM_STAT_COPY`** is frozen and holds every label and text template. It is registered in the HP-not-WP guard and voice-scanned in the new test file.
- **Store** (`storeScreen.js`): the new exported `storeItemStats(line, c, showUsable)` renders every stock line that wraps an item. Its stats are joined with ` · `, followed by the compare line and then the reason. `rs.showUsable` filters out the usable-by entry on an illegal row, so it is not shown twice.
- **Sheet** (`gearSheet.js`):
  - `gearSheetModel` gains an additive `stats` field (`string[]`);
  - `GEAR_SHEET_IDS.stats = "mw-gear-sheet-stats"` is the seventh root;
  - `renderGearSheet` creates it once after the note and before why, fills it with one `<p class="mw-gsheet-note mw-gsheet-stat">` per stat using createElement/textContent only, hides it when empty, and replaces the rows on every render;
  - an empty note now also hides.

### Final per-kind stat table (fixed order)

| Kind | Entries, in order |
|------|-------------------|
| weapon | damage: `WEAPONS[base].lab`, or `lab +N` when bonus > 0 (never "+0") · `enchanted` when bonus > 0 · usable-by |
| armor | `AR n` · durability `left/wp hp` (`left ?? wp`), or `destroyed` when left <= 0 · `enchanted` when AR or wp is above the ARMORS row · usable-by |
| staff | effect (`txt`) · `n/max charges` (max from `activationFor(it).charges`; n = `it.charges`, or max when absent) · usable-by (Magic Users) |
| bag | `N slots` from `BAGS[tier].slots` |
| cloak / jewel / potion / tool / picks / any other kind with `txt` | effect (`txt`) · usable-by, which is always empty for these kinds today |
| null, non-object, unknown kind with no txt, weapon with an unknown base, armour without a numeric AR, bag of an unknown tier | `[]` |

New engine read: `activationFor` from `engine/derived.js`. It is an existing pure helper, added to viewModels.js's existing derived.js import for the staff's charge maximum. No other engine import was added.

## Rulings

- **R-05:** no `mazeworld.html` edit. The stats container is created by the renderer. The markup pin in `gear-sheet-shell.test.js` now asserts `mw-gear-sheet-stats` is *never* in the markup. If the rows need their own CSS, that is a UAT finding. The rows carry an extra `mw-gsheet-stat` class as a hook for that.
- **R-06 (the note):** the note is dropped whenever it only restates what the stats say.
  - **Bag sheet:** note = `""` whenever stats is non-empty, and `card.desc` otherwise. The Gear tab card is unchanged.
  - **Worn sheets:** the same rule.
    - Worn armour: the note (its durability) empties.
    - Worn cloak or jewel: the note (its txt) empties.
    - Under the Cloak of Armor with a real piece: the note becomes `armorDisplay(c).sub` ("AR n · magic plate, never wears"). It names the plate that actually counts instead of repeating the piece's hp.
    - Worn weapon: keeps its voice note ("no enchantment. Just you and the swing." / "+N magic. Somebody cared, once."), because it is flavour, not a stat.
    - Empty slots: keep their empty lines.
- **R-07:** food, rations, the sealed scroll and the repair row render byte-identically. This is pinned by a new store-rows test that restates the Phase 61 composition. The engine's stock `sub` strings are untouched, with no change to `engine/economy.js`.

## Fixture declaration

`MZ_SNAPSHOT_UPDATE=1` regenerated exactly four fixtures. `git diff --ignore-cr-at-eol` confirmed no other fixture's content moved. The other four fixtures were restored to drop working-copy line-ending churn only.

- `thief.gear-sheet-bag.txt` / `thief.gear-sheet-worn.txt`:
  - new `#mw-gear-sheet-stats` root with one row (the jewel's effect text);
  - the note empties and hides, because the effect text is now in the stats (R-06).
- `thief-store.store.txt` / `mu-store.store.txt`:
  - armour and warded rows read `AR n · left/max hp` (was `AR n, wp hp`);
  - lockpicks read `1–5 on d10 against any lock` (was `opens boxes on 1–5`);
  - usable-by moves from a trailing suffix to a ` · ` entry before the compare line;
  - the illegal Warded plate row still hides usable-by behind its can't-use reason.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned two storeScreen source guards outside the plan's file list**
- **Found during:** full `npm test` after Task 2.
- **Issue:** two existing tests pinned the exact storeScreen lines this plan deliberately changed:
  - `test/unit/gear-agreement.test.js` pinned the viewModels import line;
  - `test/unit/shell-clarity-43.test.js` pinned the `usable` line.
- **Fix:** re-pinned both to the landed code, with Phase 71 comments.
- **Commit:** 1229dc4

**2. [Rule 3 - Blocking] `gear-sheet-shell.test.js` markup pin**
- **Issue:** the pin required every `GEAR_SHEET_IDS` id to appear in the markup exactly once. The file was in the verify list but not in `files_modified`.
- **Fix:** it now requires 0 occurrences for the renderer-created `stats` root (R-05) and 1 for the other six.
- **Commit:** b694d27

**3. [Design] R-06 applied to worn sheets as well as bag sheets**
- **Why:** the must-have says "each stat once, never repeated in the note". The worn armour note (durability) and the worn jewel/cloak note (txt) repeated a stat, so they empty too.
- **Tests changed:** two existing gear-sheet-model pins (`model.note === row.note` for a worn jewel, `model.note === card.desc` for a bag club) were updated to the new contract.

**4. [Design] Armour `enchanted` mark is derived, not flagged**
- **Why:** the engine keeps no premium marker on armour and drops the "Warded …" name on equip. The mark is read from AR/durability above the ARMORS row instead, so it survives equip and the worn and bag lists agree.

## TDD Gate Compliance

- **Task 1:** RED `0356073` (test) → GREEN `7404214` (feat).
- **Task 2:** RED `b694d27` (test) → GREEN `9004759` (feat).
- `1229dc4` is a test re-pin that follows the GREEN commit.
- No REFACTOR commit was needed.

## Verification

- Task 1 verify set: 116/116 pass.
- Task 2 verify set (16 files): 283/283 pass.
- `npm test`: 5239 tests, 5232 pass, 7 fail. All 7 are the known worktree CRLF doc-ledger failures:
  - Outliers / AFTER / Handoff ×3;
  - the v1.5 AFTER section;
  - the flee modifier / before-after tables ×3.
- No change under `engine/`, `content/`, `test/parity/` or `mazeworld.html`.

## Known Stubs

None.

## Human verification (deferred)

To be folded into docs/UAT-v2.0.md section M by 71-06 for the Phase 71 device round:

1. **Worn weapon:** on the Gear tab, tap the worn weapon. The sheet shows its damage dice (and +N if enchanted) and who can use it, above the upgrade line and the actions.
2. **Worn armour and bag items:**
   - Tap worn armour. The sheet shows AR and durability (current/max hp, or destroyed).
   - Tap a bag weapon, bag armour, a cloak, a jewel and a staff. Each shows the same stat lines a store row shows for that item.
3. **Store rows:** a weapon or armour row reads the same stats as the sheet does for that item. Food, repair and the sealed scroll read as before.
4. **Text size L:** the sheet's stats wrap onto rows, and every action and CANCEL is still reachable by scrolling the sheet.

Also worth a look on device:
- the stat rows reuse the note's 8px top margin, so check whether the block reads too airy (R-05, CSS is a UAT finding);
- the store rows now read usable-by before the compare line.

## Self-Check: PASSED

- Created and modified files exist: `src/browser/viewModels.js`, `src/browser/storeScreen.js`, `src/browser/gearSheet.js`, `test/unit/item-stat-lines.test.js`.
- Commits exist: 0356073, 7404214, b694d27, 9004759, 1229dc4.
