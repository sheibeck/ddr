---
phase: 77-combat-screen-oracle-readability
plan: 01
subsystem: combat-ui
status: complete
tags: [combat, submenu, css, spells, items, presentation-only]
requires:
  - engine/derived.js#spellLevelFor
  - engine/derived.js#slotFor
  - engine/items.js#useItem (notWorn / notWielded refusal ladder, read only)
provides:
  - combat submenu rows that grow to fit their text (CMBUI-07)
  - SPELLS rows sorted by effective level, then name (CMBUI-08)
  - ITEMS rows marked EQUIPPED / NOT EQUIPPED, with an enabled-only USABLE count (CMBUI-14)
affects:
  - mazeworld.html (.cb-row CSS)
  - src/browser/combatMenu.js
tech-stack:
  added: []
  patterns:
    - "Menu legality mirrors the engine's own gate word for word (slotFor + c.worn), proven by an applyAction agreement test"
key-files:
  created:
    - test/unit/combat-submenu-fit.test.js
    - test/unit/combat-items-equipped.test.js
  modified:
    - mazeworld.html
    - src/browser/combatMenu.js
    - test/unit/combatMenu.test.js
    - test/unit/gear-agreement.test.js
decisions:
  - "CMBUI-07 root cause, measured: min-height:48px replaced the flex item's content minimum inside the 206px-capped column list, so every row shrank to 48px; fixed with flex:none plus wrapping, and the list still scrolls"
  - "CMBUI-08 sort key is the EFFECTIVE level (spellLevelFor(c.sub, sp)), then the upper-cased name, then SPELLS index; the LVL label shows the same effective level"
  - "CMBUI-14: the potion counts toward N USABLE only while its row is enabled (below full HP), so a full-HP hero with potions reads 0 usable"
  - "heroOut view model left byte-identical: its submenu titles keep the pre-heroOut count, but the ITEMS grid sub shows the CANNOT ACT reason and the submenu cannot open, so the stale count is never visible"
metrics:
  duration: "~55 min"
  completed: 2026-09-26
  tasks: 3
  files: 6
---

# Phase 77 Plan 01: Combat Submenu Fit, Spell Order and ITEMS Honesty Summary

Combat submenu rows now grow to fit their whole label and description. The CSS fix is `flex:none`, wrapping text and a 13px bottom pad. SPELLS rows list by effective level, then A to Z, and the LVL label shows that same level. The ITEMS submenu marks worn gear `EQUIPPED · <state>` and greys out bagged wearables as `NOT EQUIPPED` with the reason. `N USABLE` counts only rows you can actually use, which a live `applyAction` agreement test checks against the engine's own refusals.

**Plan base:** `b7d33827ad6a5429ed2e38011ea8470030de81bf`

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Submenu rows grow to fit their text (CMBUI-07) | 64fbeb4e | mazeworld.html, test/unit/combat-submenu-fit.test.js |
| 2 | Spells sort by level, then name (CMBUI-08) | a2232f27 | src/browser/combatMenu.js, test/unit/combatMenu.test.js |
| 3 | ITEMS marks EQUIPPED, greys out bag gear that must be worn (CMBUI-14) | 88dde5e5 | src/browser/combatMenu.js, test/unit/combat-items-equipped.test.js, test/unit/combatMenu.test.js, test/unit/gear-agreement.test.js |

## CMBUI-07: Row-Fit Measurement and Root Cause

**How it was measured:** a scratch page (session scratchpad only, never committed) held mazeworld.html's joined `<style>` text and a `.cb-act > .cb-sub-list` of eight real rows. The rows were the longest spell names, the longest spell and ability descriptions (Sense Presence, Freeze, Smoke), an ITEMS row with a U+00B7 cost (`EQUIPPED · READY`), a `NOT EQUIPPED` row and two NOTHING placeholders, one of them with an empty description. The page ran at a 412px viewport in headless Chrome (`--dump-dom`, fonts loaded from the repo). For each row it read the row's height, `scrollHeight` against `clientHeight`, the description's bottom against the row's inner bottom, and the gap to the next row.

| Row | Before: height / scrollH / desc past the border | After: height / scrollH / desc past the border |
|-----|-----------------------------------|----------------------------------|
| TURN WALKING DEAD | 48 / 68 / +24.4px | 85.4 / 81 / -13px |
| SENSE PRESENCE (2-3 line desc) | 48 / 87 / +42.6px | 103.6 / 100 / -13px |
| FREEZE (longest desc) | 48 / 87 / +42.6px | 103.6 / 100 / -13px |
| SMOKE (longest ability desc) | 48 / 87 / +42.6px | 103.6 / 100 / -13px |
| Long ring name, `EQUIPPED · READY` | 48 / 58 / +14.2px | 75.2 / 71 / -13px |
| CLOAK, `NOT EQUIPPED` | 48 / 68 / +24.4px | 85.4 / 81 / -13px |
| NOTHING TO USE | 48 / 46 / +2.2px | 63.2 / 59 / -13px |
| NOTHING UP YOUR SLEEVE (empty desc) | 48 / 44 / fits | 48 / 44 / fits (48px minimum held) |

The list was 206/426px (clientHeight/scrollHeight) before the fix and is 206/710px after, so it still scrolls. The gap between rows stayed 6px throughout, and no label was clipped.

**Confirmed root cause:** this matches the plan's hypothesis. `.cb-sub-list` is a column flex container capped at 206px with `overflow:auto`. `.cb-row`'s explicit `min-height:48px` replaced the flex item's automatic content-based minimum. Once a submenu's rows added up to more than 206px, every row shrank to 48px, and its description ran up to about 43px past the bottom border and under the next row.

**Fix (CSS only):**
- `.cb-row`: `flex:none` and `padding:10px 11px 13px`.
- `.cb-row-head`: `align-items:flex-start`.
- `.cb-row-label`: dropped `overflow:hidden` and added `overflow-wrap:anywhere`.
- `.cb-row-desc`: `overflow-wrap:anywhere`.

`.cb-sub-list` keeps its 206px cap and its scrolling. A CSS comment names CMBUI-07 and the root cause.

The combat screen uses fixed px and does not follow the S/M/L text-size setting (Phase 78's work). Because the fix sizes rows by their content, it holds at any font size. Checking all three text sizes on the Pixel 7 stays with the milestone-close UAT.

## CMBUI-08: Spell Order

- `castableSpells`, after the RULES-04 `canCast` filter, is sorted by:
  1. `spellLevelFor(c.sub, sp)` ascending;
  2. then the upper-cased name, compared by code unit;
  3. then the SPELLS index.
- The row cost reads `LVL ${spellLevelFor(c.sub, sp)}`.
- `id` and `dispatch.idx` are still `SPELLS.indexOf(sp)`.
- Locked spells stay hidden.
- The RULES-04 comment block was rewritten so it no longer promises SPELLS order.

## CMBUI-14: ITEMS Rows and Count

- **Bag rows:** a non-staff bag row counts as `mustBeWorn` when `c.worn` is an object and `slotFor(it)` is truthy. That is engine/items.js#useItem's own notWorn gate. Such a row is `enabled:false`, `cost: NOT EQUIPPED`, `desc: notEquippedDesc`, and its dispatch is unchanged.
- **Staves:** the staff branch is unchanged (NOT WIELDED).
- **Worn rows:** cost is `EQUIPPED · <itemRowState text>`, dropping the separator if the text is empty. They stay enabled.
- **Count:** `usableCount` is:
  - the potion, only while `c.potions > 0 && c.wp < c.maxWP` (one shared `potionEnabled`, also used by the row's `enabled`);
  - plus the scroll;
  - plus every enabled carried, worn or staff row.
- `anyItemsPresent` stays presence-based.

### New COMBAT_MENU_COPY strings (voice record)

| Key | Text |
|-----|------|
| `notEquipped` | `NOT EQUIPPED` |
| `notEquippedDesc` | `Only works worn, and nobody changes outfits mid-fight. Put it on after.` |

Both are scanned by combatMenu.test.js's BANNED sweep over every COMBAT_MENU_COPY leaf. They use no HP or WP wording.

## Re-pinned Tests (before, then after)

| Test | Before | After |
|------|--------|-------|
| combatMenu: "Magic User (Wizard) ... rows in SPELLS order" | HEAL, FREEZE; `LVL ${sp.lvl}` | FREEZE, HEAL; `LVL ${spellLevelFor(c.sub, sp)}` (renamed "rows by level then name") |
| combatMenu: "RULES-04 ordering: ... relative SPELLS order" | HEAL, FREEZE, ACID | FREEZE, HEAL, ACID, costs LVL 1 / LVL 1 / LVL 2 (renamed "RULES-04 + CMBUI-08 ordering") |
| combatMenu: "Fighter (Soldier): the default grid" | ITEMS sub `1 usable` (a disabled full-HP potion counted by presence) | `0 usable` |
| combatMenu: "a bagged activatable staff ... worn Ring of Power" | worn-jewelry1 cost `READY` | `EQUIPPED · READY` |
| combatMenu: "with no staff involved ... count is unaffected" | potions 2 at full HP gave `1 USABLE` | fixture set to wp 40 of 55 so the potion is enabled, still `1 USABLE` |
| gear-agreement: "every .mw-gear-use cell ... agree with itemRowState" | combat cost equals `itemRowState.text` for every row | worn rows `EQUIPPED · <text>`, bagged wearables `NOT EQUIPPED`, other rows the bare text |
| gear-agreement: "advancing jewelry1's timer" | `9 SQ` | `EQUIPPED · 9 SQ` |

These tests needed no change:
- staff-surfaces.test.js: its staff counts already matched the enabled-only rule.
- hero-out-shell.test.js and the heroOut tests in combatMenu.test.js: these are live comparisons, not stored snapshots.
- shell-combat-actions.test.js: it reads only the JS region, never the old CSS rule text.

New tests:
- combat-submenu-fit.test.js: 9 CSS contract pins.
- combat-items-equipped.test.js: 13 tests, including the `applyAction` engine-agreement check over 7 fixtures with 10 or more bag rows.
- combatMenu.test.js: 5 new CMBUI-08 tests (Wizard LVL 1/2/4 with dispatch idx, Lesser Summon, Phantom Host, out of charges, unique names).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned test/unit/gear-agreement.test.js (not in files_modified)**
- **Found during:** Task 3.
- **Issue:** two GSCR-11 agreement tests pinned the combat worn-row cost to the bare `itemRowState` text. CMBUI-14 deliberately changes that to `EQUIPPED · <text>`.
- **Fix:** the expected cost now follows the CMBUI-14 rule (worn: `EQUIPPED · <text>`; bagged wearable: `NOT EQUIPPED`; otherwise the bare text). The state text still agrees with the Gear USE cell, so the test keeps its purpose.
- **Commit:** 88dde5e5

**2. [Test design] Made the Wizard sort fixtures discriminating**
- The plan's example Wizard grimoire already sits in SPELLS order, so it would pass without a sort. Heal (SPELLS index 0) was added, so the test fails under SPELLS order and passes only under level-then-name. The plan also calls Lightning level 3; it is level 4 in content, so the fixture uses a level-4 Wizard.

**3. [TDD commit shape] RED and GREEN share one commit per task**
- Tasks 2 and 3 were written tests-first and run RED before the code: 4 failures for Task 2 and 9 for Task 3. The failing tests and the implementation were then committed together as one `feat` commit per task, not as separate `test` and `feat` commits.

### Notes, not changes

- **heroOut count:** the plan says that while heroOut is set "the count honestly reads 0". The heroOut shape was kept byte-identical instead, as the plan also requires. heroOutViewModel only disables rows, so the ITEMS submenu title keeps the pre-heroOut count. That title is never visible: the ITEMS grid sub reads `CANNOT ACT · <kind>` and the action has `opens: null`, so the submenu cannot open.
- **A Fighter holding a staff:** the menu disables a bagged staff as NOT WIELDED, while the engine would refuse it as wrongClass. A Fighter cannot normally acquire a staff, because stowItem refuses one. The agreement test therefore uses Magic Users for its staff fixtures. This behaviour predates this plan and is unchanged.

## Verification

- `node --test test/unit/combat-submenu-fit.test.js test/unit/shell-combat-actions.test.js test/unit/combat-lock-shell.test.js`: 37/37 pass.
- `node --test test/unit/combat-items-equipped.test.js test/unit/combatMenu.test.js test/unit/staff-surfaces.test.js test/unit/hp-not-wp.test.js test/voice/safety-scan.test.js test/unit/hero-out-shell.test.js`: 104/104 pass.
- `git diff --quiet b7d33827 -- engine/ content/` exits 0, so the change is presentation only.
- `grep -c "spellLevelFor(c.sub, sp)" src/browser/combatMenu.js` is 3; `grep -c notEquipped` is at least 2; `slotFor(` is present; `CMBUI-07` is in mazeworld.html.
- No bot or tuning runs, per the 2026-09-26 user ruling. No fixtures moved, and FIXTURE-INVENTORY.md is untouched.
- Full suite (`node --test`, the same run as `npm test`): 6,794/6,794 pass, 0 fail, 0 cancelled. That is 6,767 at the plan base plus 27 new tests. The parity tests are included.

## Human Check (deferred, Pixel 7, milestone close)

- In a fight, open SPELLS, ABILITIES, ITEMS and SOCIAL. Every row should show its whole label and description inside its border at the S, M and L text sizes.
- SPELLS should read LVL 1 spells A to Z (with Lesser Summon among them for a Summoner), then LVL 2, and so on.
- With a ring worn and a cloak in the bag:
  - the ring row reads `EQUIPPED · READY` and works;
  - the cloak row is greyed, reads NOT EQUIPPED and gives its reason;
  - the ITEMS count matches the rows you can actually use.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: test/unit/combat-submenu-fit.test.js, test/unit/combat-items-equipped.test.js, this SUMMARY
- FOUND commits: 64fbeb4e, a2232f27, 88dde5e5
