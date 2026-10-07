---
phase: 100-in-game-achievements-unlock-toasts-the-list
plan: 03
subsystem: ui
tags: [achievements, hamburger-menu, legend-sheet, css-grid, android-back, panel-motion]
requires:
  - phase: 100-02
    provides: buildAchievementsView, renderAchievementsSheet, menuCountText and the .mw-ach-* class contract
  - phase: 99
    provides: getAchievementRecord on the adapter
provides:
  - "src/browser/hudMenu.js: the achievements item (6 items) and an always-enabled achievements row state (8 rows)"
  - "mazeworld.html: the ACHIEVEMENTS row with its count span, #mw-achievements-sheet markup, CSS and module wiring, plus the back-button hooks"
  - "window.mzOpenAchievements, window.mzRefreshAchievementsSheet, window.mzSyncAchievementsCount (plain names, no bridge entry)"
  - "test/unit/achievements-sheet-shell.test.js: 22 tests (source anchors plus a behaviour harness)"
affects: [100-04, 100-05, 101]
tech-stack:
  added: []
  patterns: [legend-sheet family member opened through closeMenuThen and panelMotion, grid auto-fill columns by window width alone, behaviour harness built from the comment-stripped module source]
key-files:
  created:
    - test/unit/achievements-sheet-shell.test.js
  modified:
    - src/browser/hudMenu.js
    - mazeworld.html
    - test/unit/hudMenu.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/notes-sheet-shell.test.js
key-decisions:
  - "The sheet panel declares no max-height: it keeps the legend family's own cap (78vh, 78dvh twin, full window height in the short class). An id-scoped 86vh would outrank the short class's rule and would add vh/dvh lengths that layout-shell (h) counts outside the mw-layout block"
  - "A track toggle re-focuses the toggled row's button after the re-render (plan 100-02's note), by data-key, guarded for fakes"
  - "The count font is 0.4375rem mono (the menu's small size), not the draft 0.5rem"
requirements-completed: []  # AUI-02 and AUI-03 finish with 100-04 (unlock banner wiring, summary card) and 100-05 (assets, layout check, a11y pins)
status: complete
duration: ~50min
completed: 2026-10-05
---

# Phase 100 Plan 03: The ACHIEVEMENTS row and sheet Summary

**An always-enabled gold-star ACHIEVEMENTS row with its earned count in the hamburger menu, opening the 100-02 list in a legend-style sheet (z-index 55) that scrolls on its own, flows into 300px-minimum grid columns by window width alone, expands tracks on tap and closes by Close, the scrim and Android back.**

## What was built

- `src/browser/hudMenu.js`: `HUD_MENU_ITEMS` has six items (camp, marks, achievements, settings, report, notes); `hudMenuRowStates` returns eight rows with `achievements: true` for every ctx. Header and doc comments updated.
- `mazeworld.html`, the row: `#mw-menu-achievements` (glyph span `&#9733;`, label, `#mw-menu-achievements-count`) after MARKS and before SETTINGS; gold glyph rule and `.mw-hud-menu-count` (mono, tabular figures, right-aligned); `syncHudMenuRows` ends with `window.mzSyncAchievementsCount?.()`, so the count is re-read on every menu open.
- `mazeworld.html`, the sheet: `div#mw-achievements-sheet.mw-legend-sheet.mw-achievements-sheet[hidden]` directly after the PATCH NOTES sheet; its only text is Close. Module block after the notes handlers: `achExpanded` Set, `achievementsSheetOpen`, `renderAchievementsSheetNow` (view from `getAchievementRecord()` with `tzOffset`, title written from the view, scrollTop kept), `toggleAchievementTrack`, `openAchievementsSheet` (panelMotion.open, focus the title with preventScroll), `closeAchievementsSheet` (panelMotion.close only when open), `syncAchievementsCount`. Row click uses `closeMenuThen(openAchievementsSheet)` exactly once; scrim and Close close it.
- Back button: `achievementsSheetOpen()` appended to `hasOpenModal`; `closeModal` closes it right after the notes line and before the Final Sheet's.
- Two new import lines (`achievementsSheet.js` names; `getAchievementRecord` on its own adapter line).

## Notes for plan 100-04

- Call `window.mzRefreshAchievementsSheet?.()` and `window.mzSyncAchievementsCount?.()` on every unlock. The refresh re-renders only while the sheet is open and keeps the scroll offset and the expanded set; the count writer is safe to call with the menu closed (it just writes the span).
- `window.mzOpenAchievements()` opens the sheet without closing the ☰ first; use `closeMenuThen`-style ordering yourself if you call it from a menu context (a summary-card tap needs no menu).
- The sheet reads only `getAchievementRecord()`; it holds no listener. The record is whatever the adapter holds at open time.
- `getAchievementRecord(` appears twice in the module block (render and count); a pin in `achievements-sheet-shell.test.js` (C4) expects exactly 2. If 100-04 adds a third reader outside the block it does not trip, inside the block it does.
- The closing path adds no `mzKeepPartyInView` call by design (pins stay at 12 and 13).
- The `mzRefreshAchievementsSheet` assignment line is pinned verbatim by (C5).

## Final CSS class list (for the plan 100-05 layout check)

Sheet: `#mw-achievements-sheet` (z 55), `#mw-achievements-sheet .mw-legend-panel` (flex column, overflow hidden, max-width 960px), `#mw-achievements-sheet .mw-legend-head`, `#mw-achievements-title`, `.mw-achievements-body` (id `mw-achievements-body`, the scroller).
List: `.mw-ach`, `.mw-ach-summary`, `.mw-ach-count`, `.mw-ach-secrets`, `.mw-ach-block-title`, `.mw-ach-list` (grid, `repeat(auto-fill,minmax(min(100%,300px),1fr))`, column gap 18px), `.mw-ach-row`, `.mw-ach-head`, `.mw-ach-icon` (+ `-dim`, `-silhouette`), `.mw-ach-text`, `.mw-ach-name`, `.mw-ach-state`, `.mw-ach-detail`, `.mw-ach-progress`, `.mw-ach-hint`, `.mw-ach-ladder`, `.mw-ach-pip`, `.mw-ach-rungs`, `.mw-ach-rung`, `.mw-ach-rung-name`, `.mw-ach-rung-progress`.
Menu: `.mw-hud-menu-count`, `.mw-hud-menu-glyph[data-glyph="achievements"]`.

## Cascade decision (short class and widths)

The plan asked for `max-height:86vh` with a dvh twin on the panel and a check that the short class still wins. Read in place: the base `.mw-legend-panel` (78vh), its 78dvh twin in the `@supports` block and the short class rule (full window height minus the top inset) all have specificity (0,1,0); an id-scoped max-height would be (1,1,0) and beat the short rule, and `layout-shell.test.js` (h) counts every vh and dvh length outside the mw-layout block (and takes the first `@media (max-height: 479.98px)` it finds as the short group, so a second one earlier in the file would hijack it). The block therefore declares no max-height: the panel inherits the family's cap in every class (78dvh in the normal classes, the full window height minus the inset in the short class). Declared as a deviation below. The id selector does beat the medium and expanded blocks' `max-width:640px`, which is what gives the sheet up to 960px; the compact class has no max-width and its panel is full width, so it stays one column. The block holds no media query (pin B5).

## Declared pin updates

| File | Test | Old | New |
|------|------|-----|-----|
| test/unit/hudMenu.test.js | HUD_MENU_ITEMS pin (title and body) | five rows, order camp, marks, settings, report, notes | six rows, achievements (key, id mw-menu-achievements, glyph star) after marks |
| test/unit/hudMenu.test.js | ROW_ORDER, ALL_ON | seven states | eight states, achievements after marks |
| test/unit/hudMenu.test.js | row-order test (title and length) | seven entries, first five ids equal HUD_MENU_ITEMS | eight entries, first six ids |
| test/unit/hudMenu.test.js | live-hero test title | "all seven rows" | "all eight rows" |
| test/unit/hudMenu.test.js | always-enabled test (title, key list) | settings, report, notes, saveQuit, abandon | adds achievements |
| test/unit/hudMenu.test.js | hostile-ctx test (title, asserts) | report and notes enabled | adds achievements enabled |
| test/unit/hudMenu.test.js | new test | n/a | ACHIEVEMENTS item shape (label, colour #e0b84a, size 15) |
| test/unit/hud-menu-layout.test.js | (3) menu rows match HUD_MENU_ITEMS | "five menu rows", rowRe closes right after the label span | "six menu rows"; rowRe allows the optional `.mw-hud-menu-count` span after the label |
| test/unit/hud-menu-layout.test.js | (12) accessibility menuitem count | 7 | 8 |
| test/unit/hud-menu-layout.test.js | ROW_IDS (used by assertRows in (10)) | seven ids | adds mw-menu-achievements after mw-chip-marks, so the stair-prompt scenario also proves it enabled |
| test/unit/hud-menu-layout.test.js | new test (23) | n/a | row enabled idle, mid-encounter and on every tab; markup order; count hook called once per open; sync is the last statement of syncHudMenuRows |
| test/unit/notes-sheet-shell.test.js | (A1) markup slice | ends at `<div class="mw-fade"` | ends at `<div id="mw-achievements-sheet"` (the new sheet sits in between; "Close is the only text node" still reads the notes sheet alone). Not in the plan's file list; the same precedent as report-sheet-shell's end marker |

The label-width model in hud-menu-layout.test.js needed no change. No shell snapshot fixture moved.

## Tasks and commits

| Task | Commit | Files |
|------|--------|-------|
| 1. The ACHIEVEMENTS row (items, row states, markup, CSS, count sync) with pin updates | dfed2655 | hudMenu.js, mazeworld.html, hudMenu.test.js, hud-menu-layout.test.js |
| 2. The achievements sheet (markup, CSS, wiring, back button) with tests | 16e77e3a | mazeworld.html, achievements-sheet-shell.test.js, notes-sheet-shell.test.js |

## Test counts (targeted only)

- achievements-sheet-shell: 22 pass (new)
- hudMenu: 31 pass; hud-menu-layout: 24 pass; shell-map-hud: 23; shell-menu-quit: 11
- notes-sheet-shell: 15; report-sheet-shell: 16
- shell-map-store-polish: 15 and shell-map-viewport: 37 (camera-keep pins 12 and 13 untouched); shell-resume-line: 6; bridge-registry: 10
- layout-shell: 30; shell-tab-snapshots: 11; panel-motion: 9; reduced-motion: 22; stale-terms: 6; voice-corpus: 29
- Combined run of all of the above: 317 pass, 0 fail. No full `npm test`, no bots.

## Deviations from Plan

**1. [Rule 3 - Blocking] Panel max-height left to the legend family**
- **Found during:** Task 2 (layout-shell (h) failed after the first CSS pass)
- **Issue:** the specified `max-height:86vh` plus dvh twin and a short override in a second `@media (max-height: 479.98px)` block broke layout-shell (h) (vh/dvh counted outside mw-layout; the first short media group is found by position).
- **Fix:** no max-height in the sheet block; see "Cascade decision". The sheet is 78dvh tall instead of 86dvh in the normal classes.
- **Files modified:** mazeworld.html. **Commit:** 16e77e3a

**2. [Rule 1 - pin premise] notes-sheet-shell (A1) slice end marker** (see Declared pin updates). **Commit:** 16e77e3a

**3. Small additions within latitude:** the title gets `outline:none` on `:focus` (it is a non-interactive heading focused by script); the toggled row's button is re-focused after the re-render (plan 100-02's hint); `button.mw-ach-head` neutralises the global button hover fill and press nudge (no motion declared).

## Known Stubs

None. The count span is empty until the first menu open or `mzSyncAchievementsCount` call, by design (it is written each time the menu opens).

## Threat Flags

None. The sheet and row only read the record through the adapter and the pure view functions; a source test (C4) forbids storage, dispatch, fetch and `window.__mz` assignments in the block.

## Human verification (deferred to end of run)

On the Pixel 7, once the debug APK includes plans 100-03 to 100-05:

1. Open the hamburger menu: the ACHIEVEMENTS row sits after MARKS, with a gold star and its count ("N / 77") on the right; the star renders as a star in the WebView font.
2. Open the sheet from the map, in a fight, in a store, on the Oracle tab and on the death screen; it opens over each, and the row is never dimmed.
3. Android back closes the sheet with one press (and a second press behaves as before); the scrim and Close also close it.
4. Tap a tiered track: its tiers appear under it and the list stays where it was; tap again to fold it.
5. Turn the phone sideways: the sheet is a centred column, scrolls on its own, nothing scrolls sideways.
6. On a tablet (or a 600 to 960dp emulator window): the rows flow into two columns where the panel is wide enough; a phone in portrait shows one.
7. With Android's "remove animations" on, the sheet opens and closes without motion.

## Self-Check: PASSED

- FOUND: test/unit/achievements-sheet-shell.test.js, mazeworld.html changes (row, sheet, wiring), hudMenu.js changes
- FOUND commits: dfed2655, 16e77e3a
