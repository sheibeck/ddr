---
phase: 78-hud-dead-state-climb-decisions
plan: 06
subsystem: shell-dead-state
status: complete
tags: [hud-02, hud-03, hud-01, climb-01, dead-state, final-sheet, band-1]
requirements: [HUD-02, HUD-03]
requires:
  - 78-03 (the rail hazard card, window.mzResolveHazard, railLocked covering a pending hazard)
  - 78-05 (band 1's "Race Sub-class · Lvl N" form and its 1.1 cap)
  - 78-02 (the text-scale rule every new font-size follows)
provides:
  - "src/browser/finalSheet.js: FINAL_SHEET_COPY, FINAL_SHEET_CLASSES, finalSheetViewModel(state), renderFinalSheet(host, vm)"
  - "the HERO/GEAR tab lock, the read-only dead MAP (death card put aside after a visit away; pan and pinch only)"
  - "#mw-final-sheet and window.mzOpenFinalSheet; the death card's FINAL SHEET button; the DEAD tab's dead-hero dock"
  - "hudMenuRowStates: MARKS and CENTRE MAP off while dead"
  - "hudBands.js#identityParts ident/lvl fields; band 1's two-span line"
  - "NARRATIVE_ACTIONS includes resolveHazard"
affects:
  - 78-07 (the arrow pad inherits the dead lock: hasActiveEncounter still counts S.dead)
  - 78-09 (the phase close and the Pixel 7 checklist)
tech-stack:
  added: []
  patterns:
    - "a read-only overlay built by a pure text-only renderer over existing view models, instead of a read-only mode of a live tab"
    - "a presentation-only classic-script flag (mwDeadMapAside) that changes what renderEncounter shows without touching any input gate"
key-files:
  created:
    - src/browser/finalSheet.js
    - test/unit/final-sheet.test.js
    - test/unit/dead-lockdown.test.js
  modified:
    - mazeworld.html
    - src/browser/hudMenu.js
    - src/browser/boardsView.js
    - src/browser/boardsPanel.js
    - content/boards.js
    - src/browser/hudBands.js
    - src/browser/narrationLines.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md (regenerated)
    - test/unit/hudMenu.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/boardsView.test.js
    - test/unit/boardsPanel.test.js
    - test/unit/boards-copy.test.js
    - test/unit/shell-boards-panel.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/hudBands.test.js
    - test/unit/hud-bands-layout.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/text-scale.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/dismiss-joiner.test.js
    - test/unit/narrativeLines.test.js
decisions:
  - "No internal showTab flag: the death-time switch goes TO the map, which is never locked, so showTab simply refuses HERO/GEAR while dead"
  - "syncDeadTabLock() runs at the top of renderEncounter (every paint reaches it), not in paint(), so the Task 2 commit left paint()'s SHA pin alone"
  - "CENTRE MAP is off whenever ctx.dead is strictly true, not only via the encounter flag"
  - "The DEAD tab's dock FINAL SHEET routes without clearing the panel's entry (a sheet opens over it); BURY THEM routes like any exit and shows the map before mzReturnToTitle"
  - "The back button closes the FINAL SHEET after the account sheet, the title panel and the ☰, before anything touches S (placed after the ☰ line so shell-boards-entry's closeModal extraction still proves its ordering)"
  - "HUD-01: identityParts keeps `line` and adds `ident` and `lvl` (line === ident + lvl); #mw-hud-line holds two spans; .mw-hud-lvl uses white-space:pre to keep the separator's leading space"
metrics:
  duration: "about 2 h 10 min"
  completed: 2026-09-26
  tasks: 5
  commits: 8
---

# Phase 78 Plan 06: Dead-state lockdown, read-only FINAL SHEET, band-1 level fix Summary

After death, only the Oracle, the DEAD tab, the ☰ and a read-only MAP take input. HERO and GEAR are disabled. MARKS, CENTRE MAP and MAKE CAMP are dimmed. After the player visits another tab, the map shows where the hero died, and it can be panned and pinched but nothing else. A text-only FINAL SHEET (stats, level, gear, the book and the epitaph) opens from the death card and from the DEAD tab's new dock. Two extra tasks shipped too: band 1's level can no longer be cut off, and a wall or crevice crossing's rail card now carries the Oracle sentence.

**Plan base SHA:** `c799d5b041fc55604f5b40a7223c747cb9bb5089`

## Tasks

| # | Task | Commits | Key files |
|---|------|---------|-----------|
| 1 | A pure, read-only final sheet (HUD-03) | 6dddc95c (RED), 213ac4da (GREEN) | finalSheet.js, final-sheet.test.js |
| 2 | The dead-state lockdown, with the map viewable read-only (HUD-02) | fbfc6800 (RED), 01b2072a (GREEN) | mazeworld.html, hudMenu.js, dead-lockdown.test.js, hudMenu/hud-menu-layout/shell-map-viewport tests |
| 3 | FINAL SHEET on the DEAD tab and the death card (HUD-03) | d91f7b94 | mazeworld.html, boardsView.js, boardsPanel.js, content/boards.js, boards/shell tests, dead-lockdown.test.js |
| A | Extra scope A: band 1 never cuts the level off (HUD-01) | 7b5d1c18 | hudBands.js, mazeworld.html, hudBands/hud-bands-layout/hud-menu-layout/shell-map-hud/text-scale/reduced-motion tests |
| B | Extra scope B: resolveHazard narrates; the bridge docs name hazardCard | 9cb16513, 8a940431 | narrationLines.js, bridge.js, docs/SHELL-MODULES.md, dismiss-joiner/narrativeLines tests |

## The lockdown set (HUD-02, as amended 2026-09-26)

| Surface | While dead |
|---|---|
| MAP tab | Selectable. It shows the death card (THAT IS THAT) first. Once the player leaves the MAP tab for anything, a return shows the bare map where the hero died. |
| Dead map input | Drag pans and pinch zooms (camera only). Taps, holds (no inspect card) and keyboard arrows do nothing. `hasActiveEncounter()` still counts `S.dead`, so every gate stays shut. |
| HERO, GEAR tabs | `disabled` and `aria-disabled="true"`, and `showTab` refuses them. A death while one is showing switches to the map so the card is seen. |
| ORACLE, DEAD tabs | Selectable. The DEAD tab docks FINAL SHEET and BURY THEM. |
| ☰ rows | SETTINGS, SAVE & QUIT and NEW CHARACTER are live, and the ACCOUNT block is untouched. MARKS, CENTRE MAP and MAKE CAMP are dimmed. |
| Ways back to the title | BURY THEM on the death card, BURY THEM on the DEAD tab dock, and the ☰'s SAVE & QUIT and NEW CHARACTER. |
| Hazard card | A dead hero has no `pendingHazard` card: `hazardCardViewModel` returns null for a dead hero (78-03), and `mzResolveHazard` refuses while `hasActiveEncounter()` is true, which covers `S.dead`. |
| Back button | Closes an open FINAL SHEET first, after the account sheet, the title panel and the ☰. |

`mwDeadMapAside` is a plain classic-script `let`. It is never on S or window. Leaving the MAP tab while dead sets it, and `syncDeadTabLock()` clears it for a live run.

## What was built

**Task 1: `src/browser/finalSheet.js`.**
- `finalSheetViewModel(state)` builds display strings only:
  - `who`: name, "Race Sub-class", class, "LEVEL IV", "HP 0/max"
  - `stats`: `characterSheetViewModel`'s rows, each value as a string
  - `tricks`: skills and abilities, name and description only
  - `worn`: `gearWornModel` rows in `GEAR_WORN_ORDER`
  - `bag`: `gearBagCardsModel` names
  - `book`: `grimoireViewModel` rows as name and "Lvl N"
  - `death`: epitaph, cause (`deathNote`), and depth/day/squares facts
- A null or hero-less state gives the empty model. Each composed view model is wrapped in try/catch, so a hand-built state never throws.
- `renderFinalSheet(host, vm)` uses only `host.ownerDocument`, `createElement`, `textContent` and `className`. It creates no button, sets no handler and writes no HTML string. Empty strings are never rendered.

**Task 2: mazeworld.html.**
- `DEAD_LOCKED_TABS`, `mwDeadMapAside`, `deadNow()` and `syncDeadTabLock()` are declared before `initTabs`, so there is no TDZ.
- `showTab` refuses the locked tabs, sets the put-aside flag on leaving the map while dead, re-renders the encounter on a dead return to the map, and passes `{ dead }` to `onDeadTab`.
- `renderEncounter`:
  - calls `syncDeadTabLock()` first;
  - has a put-aside branch before `showPanel` that hides the overlay and uncovers the party ring;
  - switches the death branch to the map from HERO or GEAR.
- `deadMapLookOnly()` opens the viewport's pointerdown gate for a look only. `inspectAt` bails while dead.
- The tab buttons get ids (`mw-tab-maze|hero|gear|oracle|dead`) and a `.mw-tab:disabled` dim rule.

**Task 3.**
- `#mw-final-sheet` uses the legend-sheet chrome. Close is its only button.
- `.mw-fs-*` CSS: every font-size is `calc(<n>rem * var(--mw-text-scale))`, and long lines wrap with `overflow-wrap:anywhere`.
- The module's `openFinalSheet` does nothing unless `S.dead === true`. `closeFinalSheet` and `finalSheetOpen` are wired to the scrim, Close and `getGameContext`. `window.mzOpenFinalSheet` is its one opener.
- `routeFromBoards` handles `finalSheet` and `bury`.
- The death card now offers REVIEW THE ORACLE, FINAL SHEET and BURY THEM.
- In `boardsView`, `buildDock(entry, hasHero, dead)` gives the tab entry with a dead hero `[finalSheet (secondary), bury (primary)]`. `boardsPanel` carries `dead` from `openFromTab`/`onDeadTab`, and a title open clears it.

## Extra scope A: HUD-01, the level is never cut

- `#mw-hud-line` is now `<span id="mw-hud-ident">` (`flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis`) followed by `<span id="mw-hud-lvl">` (`flex:none;white-space:pre`). The line itself is a `display:flex` row.
- `identityParts(c)` returns `{ name, line, ident, lvl }`:
  - `lvl` is `" · Lvl N"`, or `"Lvl N"` alone when there is no ident;
  - `line === ident + lvl`, so the pure string API is unchanged.
- `paint()` writes `ident` and `lvl` into the spans and keeps `identityLine(c)` as the line's title.
- **Proof:** `shell-map-hud.test.js` (c2) walks the worst case on a 411px Pixel 7: the longest generated name ("Lithariel Silverbough"), `" · Lvl 10"`, `"999/999 HP"`, and the longest race and sub-class ("Fridgian Master of Arms"). It reads the padding, the gap and the token cap from the CSS.

| Size | px/glyph | name + level + HP + padding | Left for race/sub-class | "Fridgian Master of Arms" |
|---|---|---|---|---|
| S | 6.63 | 309.2 of 411 | 101.8 | 152.5 (truncates) |
| M | 7.80 | 356.0 of 411 | 55.0 | 179.4 (truncates) |
| L (capped 1.1) | 8.58 | 387.2 of 411 | 23.8 | 197.3 (truncates) |

The level span fits at all three sizes, and the race and sub-class text is what ellipsizes. In the worst case at L that leaves room for only about three glyphs of it; typical names leave more.

## Extra scope B

- `NARRATIVE_ACTIONS` is now `move, camp, resolveJoiner, dismissJoiner, resolveHazard`. A real golden-fixture crossing (`fellClimbing`, `draggedOver`, `moved`) now puts the Oracle's "Fall: the wall had other plans. −5 hp." on the rail, where it used to show the table text "Fall: the wall won (−5 hp)."
- `src/browser/bridge.js`: `__mzRailVM` names `hazardCard` (consumer and purpose), and `__mzHudBands` names the HUD-01 span split. `docs/SHELL-MODULES.md` was regenerated with `node tools/bridge-doc.mjs --write`, and `--check` passes.

## Final copy (voice record)

- **FINAL_SHEET_COPY headings:** FINAL SHEET, THE DECEASED, STATS, WHAT THEY COULD DO, WORN, THE BAG, THE BOOK, HOW IT ENDED
- **Labels:** "LEVEL {n}", "HP 0/{max}", "Lvl {n}", EPITAPH, CAUSE, DEPTH, DAY, SQUARES
- **Empty lines:**
  - "No special skills. They got by on optimism."
  - "No book. Their spells were mostly hitting things." (Fighter/Thief)
  - "An empty book. A wizard in name, and in name only." (Magic User with no spells)
  - "An empty bag. Travelling light, all the way down."
- **Death card:** `COMBAT_COPY.over.dead.sheet` = "FINAL SHEET"
- **Dock:** `BOARDS_PANEL_COPY.dock.finalSheet` = "FINAL SHEET", `.bury` = "BURY THEM"
- **Sheet head:** "Final sheet" (uppercased by the head CSS)

Every leaf is clear of wp/WP and of the BANNED safety list (pinned in final-sheet.test.js).

## Re-pinned tests (before -> after)

| File / test | Before | After |
|---|---|---|
| hudMenu.test.js, dead-hero row states | dead disables MAKE CAMP only; CENTRE follows the encounter flag | dead disables MARKS, CENTRE MAP and MAKE CAMP (with or without the encounter flag); a strict-true-only dead case is added |
| hudMenu.test.js, "always enabled" | MARKS, SETTINGS, SAVE & QUIT, ABANDON | SETTINGS, SAVE & QUIT, ABANDON (MARKS left the set) |
| hud-menu-layout (19), dead block | disabled rows: camp and centre | camp, centre and marks |
| hud-menu-layout (14) | L uncapped, pinned 446.8 (did not fit) | reads the band-2 cap from both tokens; S 336.4, M 377.8, capped L 405.4 all fit 411; the uncapped 446.8 is logged only |
| hud-menu-layout (15) | `#mw-hud-line` textContent === `parts.line` | `#mw-hud-ident` === `.ident`, `#mw-hud-lvl` === `.lvl`, and they join to `.line` |
| hud-bands-layout (4) | the same single-span check | the same two-span check at 999, 1,000 and 100,000 steps |
| shell-map-hud (c) | `.mw-hud-line` is the ellipsizing rule | `.mw-hud-line` is a flex row; new `.mw-hud-ident` and `.mw-hud-lvl` rules pinned |
| shell-map-hud (c2) | none | new HUD-01 worst-case fit walk |
| text-scale HUD-01 band-1 test | comment said the line ellipsizes | comment names the two-span split and (c2); assertions unchanged |
| reduced-motion paint() SHA-256 | 7fe5fedd…4dc4b14 | 18f60803…80848b5 (band 1's span writes only; the previous digest is recorded in the comment) |
| shell-map-viewport | no pan-gate pin | new (f) HUD-02 pin: the gate is `(hasActiveEncounter() && !deadMapLookOnly())`; tapStep and inspectAt stay shut while dead |
| shell-boards-panel (F2) | `onDeadTab?.();` | `onDeadTab?.({ dead });` |
| shell-boards-panel | none | (A6) dead dock, (A7) live dock hidden, (E6) finalSheet route, (E7) bury route; the fake window gains mzOpenFinalSheet and mzReturnToTitle |
| shell-combat-over | ORACLE and BURY THEM ids | also FINAL SHEET between them (order pinned) and `sheet: "FINAL SHEET"` |
| boardsView / boardsPanel / boards-copy | no dead dock | the dead dock view, `dead` carried through onDeadTab, the finalSheet/bury routes, the copy keys and their order |
| dismiss-joiner NARRATIVE_ACTIONS | camp/dismissJoiner/move/resolveJoiner | plus resolveHazard, and a real-crossing Oracle-sentence test |
| narrativeLines.test.js NARRATIVE_ACTIONS | "exactly move + camp + resolveJoiner + dismissJoiner" | plus resolveHazard; useTool is pinned as not narrative |

## Verification

- `npm test`: **7,135/7,135 pass, 0 fail** on the final run. An earlier full run had one failure, the second NARRATIVE_ACTIONS pin in narrativeLines.test.js, which is now re-pinned (commit 8a940431). A Task 3 run before the extra scope was 7,132/7,132.
- Parity: `node --test "test/parity/**/*.test.js"` 66/66. `git diff --quiet c799d5b -- test/parity/prototype-master.js.txt engine` exits 0.
- boot:check: I built www/ through a temporary node_modules junction to the main checkout, and all four checks passed (no-uncaught, painted, graves, title). I then reran the nine www-reading suites (113/113 pass) and removed only the junction. www/ is gitignored and not committed.
- Grep gates:
  - `export function finalSheetViewModel` = 1, and `characterSheetViewModel(` appears in finalSheet.js
  - `HUD-02` appears in both mazeworld.html and hudMenu.js
  - `mw-final-sheet` ≥ 2, `mzOpenFinalSheet` ≥ 2, `finalSheet` appears in boardsView.js
- Per the user's 2026-09-26 ruling, no bot or balance tools were run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The tab buttons needed ids**
- **Found during:** Task 2
- **Issue:** The lock has to reach the HERO and GEAR buttons outside `initTabs`, and the recording DOM's `querySelectorAll` returns nothing.
- **Fix:** Added `id="mw-tab-<name>"` to all five buttons (pinned in dead-lockdown.test.js).
- **Commit:** 01b2072a

**2. [Rule 3 - Blocking] The lock sync lives in renderEncounter, not paint**
- **Found during:** Task 2
- **Issue:** `paint()` is SHA-pinned in reduced-motion.test.js.
- **Fix:** `syncDeadTabLock()` runs at the top of `renderEncounter`, which every paint reaches. Scope A later changed paint() for the band-1 spans and re-pinned the digest once, with a comment.
- **Commit:** 01b2072a, 7b5d1c18

**3. [Rule 3 - Blocking] The back-button line had to follow the ☰ line**
- **Found during:** Task 3
- **Issue:** shell-boards-entry.test.js (C2) evaluates `closeModal` without a `finalSheetOpen` binding and expects to reach `hudMenuIsOpen` first.
- **Fix:** The FINAL SHEET close sits right after the ☰ escape and still comes before anything touches S.
- **Commit:** d91f7b94

**4. [Rule 3 - Blocking] Tests outside the listed files**
- **Found during:** extra scope A and B
- **Issue:** Several tests pinned the old behaviour and were outside the listed files: hud-bands-layout.test.js (4), hud-menu-layout (15), reduced-motion.test.js's paint digest and narrativeLines.test.js's NARRATIVE_ACTIONS pin.
- **Fix:** Each was re-pinned with a before/after comment (see the table above).
- **Commit:** 7b5d1c18, 8a940431

### Design choices within the plan
- There is no internal showTab flag. The death-time switch goes to the map, which is never locked.
- CENTRE MAP is off on `dead` directly, not only through the encounter flag.
- The new guarded id `btn-death-sheet` goes through the same generic `renderCombatOver` guardTap path as `btn-death-oracle`. I did not add it to the guarded-id lists in shell-input-guards and shell-map-invariants, because both files were outside this plan's list.

## Deferred Issues

None.

## Known Stubs

None.

## Threat Flags

None. The FINAL SHEET renders engine strings with textContent only and adds no control. `window.mzOpenFinalSheet` opens a read-only view only while `S.dead` is true and dispatches nothing. The dock's `bury` route calls the existing `mzReturnToTitle`.

## TDD Gate Compliance

- Task 1: RED 6dddc95c, then GREEN 213ac4da. The test failed on the missing module first.
- Task 2: RED fbfc6800 (9 of 11 failing), then GREEN 01b2072a.
- Task 3 is `type="auto"` (not TDD), so it has one feat commit.

## Human check (Pixel 7, deferred to milestone close)

- Die on the map: THAT IS THAT offers REVIEW THE ORACLE, FINAL SHEET and BURY THEM.
- While dead:
  - HERO and GEAR are dimmed and do nothing; ORACLE and DEAD open.
  - MAP, after a visit to another tab, shows the map where you died. Drag and pinch work; tap, hold and the arrow keys do nothing.
  - The ☰ shows MARKS, CENTRE MAP and MAKE CAMP dimmed.
- The DEAD tab shows FINAL SHEET and BURY THEM. FINAL SHEET scrolls at L, wraps long epitaphs, and has only Close. The back button closes it.
- A fatal potion drunk from the Gear tab switches to the map and shows the death card.
- Band 1 at S, M and L always shows "Lvl N", with the race and sub-class ellipsized first.
- A wall crossing's rail card reads the Oracle's sentence.

## Self-Check: PASSED

- FOUND: src/browser/finalSheet.js, test/unit/final-sheet.test.js, test/unit/dead-lockdown.test.js
- FOUND commits: 6dddc95c, 213ac4da, fbfc6800, 01b2072a, d91f7b94, 7b5d1c18, 9cb16513, 8a940431
