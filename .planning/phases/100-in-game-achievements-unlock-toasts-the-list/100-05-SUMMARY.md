---
phase: 100-in-game-achievements-unlock-toasts-the-list
plan: 05
subsystem: ui
tags: [achievements, build-www, layout-check, accessibility, reduced-motion, docs]
requires:
  - phase: 100-03
    provides: the ACHIEVEMENTS row, the sheet, window.mzOpenAchievements
  - phase: 100-04
    provides: window.__mzAchBanner, the achievement rail card, the Earned strip
provides:
  - "tools/build-www.mjs: copyAchievementIcons() ships exactly achievements/ingame/ (77 PNGs) as www/achievements/ingame/"
  - "tools/layout-check.mjs: 18 scenes (achievements, achievement-card, death-earned) and the open sheet at each of the 7 boundary probes"
  - "test/unit/achievement-assets.test.js (8) and test/unit/achievements-shell-a11y.test.js (18)"
  - "docs/SHELL-MODULES.md: 'Achievements banner (Phase 100)' and 'Achievements list (Phase 100)' with the Phase 101 subscription contract"
affects: [101, 102]
tech-stack:
  added: []
  patterns: [page-side probe functions serialised with toString for the sheet, card and strip, a tiny brace-depth CSS reader to pin rules and their enclosing media queries]
key-files:
  created:
    - test/unit/achievement-assets.test.js
    - test/unit/achievements-shell-a11y.test.js
  modified:
    - tools/build-www.mjs
    - tools/layout-check.mjs
    - test/unit/layout-check.test.js
    - docs/SHELL-MODULES.md
key-decisions:
  - "The layout check needed no CSS change: plans 100-03 and 100-04's rules passed every profile and probe first time, so mazeworld.html is untouched by this plan"
  - "The check drives the new surfaces only through window.mzOpenAchievements, window.__mzAchBanner.onEvent/clearStrip and #mw-achievements-close; no hook was added to the shipped app"
  - "A bottom-docked achievement card is also checked to sit above the tab bar and to need no scrolling inside the rail"
requirements-completed: [AUI-01, AUI-02, AUI-03]
status: complete
duration: ~70min
completed: 2026-10-05
---

# Phase 100 Plan 05: Icons in the bundle, layout check, accessibility pins and docs Summary

**The 77 in-game icons now ship in the web bundle, the headless layout check measures the achievements sheet, the unlock card and the Earned strip in all 12 profiles and at all 7 size boundaries (all pass, no CSS defect found), reduced motion, text scale, dialog semantics and size-only layout are pinned by test, and SHELL-MODULES.md carries the Phase 100 sections with the contract Phase 101 subscribes under.**

## What was built

- `tools/build-www.mjs`: `copyAchievementIcons()` (whole-directory `cpSync` of `achievements/ingame` into `www/achievements/ingame`, throws naming the path when the source is missing), called in `main()` right after `copyIcons()`; header step 7 added. After `node tools/build-www.mjs`, `www/achievements/` holds only `ingame/` with 77 `.png` files.
- `test/unit/achievement-assets.test.js` (8): every catalog entry's `achievements/` + `icon.ingame` exists and is a 144 x 144 PNG (IHDR read with node:fs), the folder holds exactly the 77 catalog basenames, `achievementIconSrc` agrees, and the build wiring is source-scanned (source and destination, loud throw, no `play`/`master`/`sources`/`frames`, call order after `copyIcons();`).
- `tools/layout-check.mjs`: scenes 16-18 (`achievements`: sheet open, first track expanded, then closed through `#mw-achievements-close`; `achievement-card`: a real unlock through `window.__mzAchBanner.onEvent`; `death-earned`: a dead engine state through `die`, six unlocks, `window.paint()`, then the base state restored and `clearStrip()`), `buildStates()` gains `dead`, three page-side probes (`measureSheet`, `measureCard`, `measureEarned`) with `sheetFailures`, `cardFailures`, `earnedFailures`, and `runProbes` opens the sheet at each boundary probe (a probe passes only when the class matches and the sheet is clean; the report gets an "Open sheet" column and prints each failure). Header comment updated.
- `test/unit/achievements-shell-a11y.test.js` (18): dialog semantics, `aria-label` on Close, tabindex -1 title, menuitem row with an aria-hidden glyph; no animation or transition in any rule matching `mw-ach|mw-achievements|cb-over-earned|data-card-kind`; the blanket reduced-motion rule still present; no smooth scroll, frame loop, timer or script-written style in the two new module blocks; every `font-size` through `--mw-text-scale`; `.mw-ach-head` min-height 48px; no rule hides the row text parts; on a real render only icons and the ladder are `aria-hidden`; every `@media` around a new rule is a `LAYOUT_MEDIA` string; no device test in the new script blocks; the docs sections and the Phase 101 contract.
- `docs/SHELL-MODULES.md`: "### Achievements banner (Phase 100)" and "### Achievements list (Phase 100)" before "## What stays shared", including the "For Phase 101" paragraph; the "The ☰ menu rows (Phase 70)" row list now names the six `HUD_MENU_ITEMS` rows in order with ACHIEVEMENTS after MARKS. The generated bridge table was not touched (`node tools/bridge-doc.mjs --check` exits 0).

## Final layout-check result (`npm run layout:check`, exit 0)

| Profile | Size | Class | Scenes passed / run | Verdict |
| --- | --- | --- | --- | --- |
| phone-portrait | 412x915 | compact | 18 / 18 | PASS |
| phone-landscape | 915x412 | short | 18 / 18 | PASS |
| phone-landscape-360 | 800x360 | short | 18 / 18 | PASS |
| tablet7-portrait | 600x960 | medium | 18 / 18 | PASS |
| tablet7-landscape | 960x600 | expanded | 18 / 18 | PASS |
| tablet10-portrait | 800x1280 | medium | 18 / 18 | PASS |
| tablet10-landscape | 1280x800 | expanded | 18 / 18 | PASS |
| foldable-folded | 411x797 | compact | 18 / 18 | PASS |
| foldable-unfolded | 841x701 | expanded | 18 / 18 | PASS |
| foldable-unfolded-portrait | 701x841 | medium | 18 / 18 | PASS |
| chromebook-window | 1366x768 | expanded | 18 / 18 | PASS |
| chromebook-half | 683x768 | medium | 18 / 18 | PASS |

| Boundary probe | Expected | html[data-mw-layout] | Open sheet | Verdict |
| --- | --- | --- | --- | --- |
| 915x479 | short | short | PASS | PASS |
| 915x480 | expanded | expanded | PASS | PASS |
| 599x900 | compact | compact | PASS | PASS |
| 600x900 | medium | medium | PASS | PASS |
| 839x900 | medium | medium | PASS | PASS |
| 840x900 | expanded | expanded | PASS | PASS |
| 840x479 | short | short | PASS | PASS |

`layout-check: 12/12 profiles passed, 7/7 boundary probes passed`. Chrome was available. The very first invocation of the session timed out at the cold-boot wait ("title ready (initial boot)"), the known intermittent cold-start flake; the immediate re-run and every later run booted normally.

**CSS defects found and fixed: none.** The sheet, the card and the strip passed in every class first time; `mazeworld.html` is not in this plan's diff.

**Teeth experiment (run and reverted).** With `.mw-ach-list{width:1200px}` and the strip's `max-height` removed, one profile (phone-portrait) failed with: clipped `.mw-ach-head` controls, "#mw-achievements-body scrolls sideways (scrollWidth 1200 > clientWidth 376)", "a compact window shows 3 columns, expected exactly 1", list icons not loaded, "death-earned: the strip's list has no max-height", and all four probes run before the report cut-off showed the open-sheet column as FAIL. `git checkout -- mazeworld.html` restored the file (it had no other changes).

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1. Ship the in-game icons in the web bundle with an asset test | b8b9f83e | tools/build-www.mjs, test/unit/achievement-assets.test.js |
| 2. Layout check for the sheet, the card and the strip (run: 12/12, 7/7) | b169e603 | tools/layout-check.mjs, test/unit/layout-check.test.js |
| 3. Accessibility pins and the Phase 100 documentation | b634d03f | test/unit/achievements-shell-a11y.test.js, docs/SHELL-MODULES.md |

## Declared pin updates

Plan 100-05:

| File | Test | Old | New |
|------|------|-----|-----|
| test/unit/layout-check.test.js | "the scene list covers every screen the run conventions name" | 15 scenes ending at "camp" | 18 scenes, "achievements", "achievement-card", "death-earned" appended |

Plans 100-03 to 100-05 together: hudMenu.test.js (HUD_MENU_ITEMS six rows, ROW_ORDER/ALL_ON eight states, row-order, live-hero, always-enabled and hostile-ctx tests, a new ACHIEVEMENTS item test), hud-menu-layout.test.js ((3) six menu rows with the optional count span, (12) eight menuitems, ROW_IDS, new test (23)), notes-sheet-shell.test.js ((A1) slice end marker), shell-map-rail.test.js ((q) the icon lines honour `iconSrc`), layout-check.test.js (SCENES, above). No shell snapshot fixture moved.

## Phase-close targeted run (for the orchestrator; no full `npm test`, no bots)

All files below were run on the final tree of this plan, each file on its own:

| File | Pass | Fail |
|------|------|------|
| achievements-shell-a11y | 18 | 0 |
| achievement-assets | 8 | 0 |
| achievement-bus | 13 | 0 |
| achievement-card | 8 | 0 |
| achievement-card-queue | 19 | 0 |
| achievements-sheet-model | 23 | 0 |
| achievements-sheet-view | 24 | 0 |
| achievements-sheet-render | 21 | 0 |
| achievements-sheet-shell | 22 | 0 |
| achievement-banner-shell | 35 | 0 |
| hudMenu | 31 | 0 |
| hud-menu-layout | 24 | 0 |
| layout-check | 5 | 0 |
| bridge-registry | 10 | 0 |
| compliance-docs | 14 | 0 |
| stale-terms | 6 | 0 |
| shell-tab-snapshots | 11 | 0 |
| test/voice/safety-scan | 12 | 0 |
| voice-corpus | 29 | 0 |
| **Total** | **333** | **0** |

Also green: sfx-assets, build-www-vendoring, layout-class (9), layout-shell (30) in Task 1 and 2 verify runs (Task 1 run: achievement-assets, sfx-assets, build-www-vendoring, achievement-card, stale-terms = 31 pass). `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`; `node tools/bridge-doc.mjs --check` exits 0. `node tools/build-www.mjs` verified: `www/achievements/ingame` holds 77 `.png` files and `www/achievements/` holds nothing else; no full suite after it.

## Deviations from Plan

**1. [Addition within latitude] Card checks beyond the spec.** `cardFailures` also requires a bottom-docked card (compact, medium) to sit above the tab bar and the rail to need no inner scrolling. Both pass. The first screenshot of the card showed its line cut mid-word; that was the typed-text reveal caught mid-way (the screenshot is taken after the settle window, the line types in), not a clip, and the measurements confirm the rail fits.

**2. Process note:** tests for the layout tool were written after the tool changes (the tool's own run is its test; the unit pin is the SCENES list). The asset and a11y tests were written against the behavior lists and run red on the docs bullets before the docs landed.

No other deviations. No change to `mazeworld.html`, `engine/`, `content/`, the Phase 99 modules, `achievementBus.js`, `achievementCard.js`, `achievementsSheet.js` or `rail.js`. No new `window.__mz*` name, no new dependency.

## Known Stubs

None.

## Threat Flags

None. The check reads and drives only names the app already exposes; the bundle gains only `achievements/ingame/`; the layout check fails any request that leaves the machine (none did).

## Human verification (deferred to end of run)

Consolidated Phase 100 device checklist (Pixel 7, plus the 7" and 10" tablet emulators where marked), once one debug APK includes plans 100-01 to 100-05:

1. Hamburger menu: the ACHIEVEMENTS row sits after MARKS with a gold star glyph that renders as a star in the WebView font, and its count ("N / 77") on the right; the row is never dimmed (map, fight, store, Oracle, death screen).
2. The list on the Pixel 7 in portrait (one column) and landscape (a centred column, scrolls on its own, nothing scrolls sideways); on the 7" and 10" tablet emulators in both orientations (two columns where wide).
3. Tap a tiered track: the tiers appear and the list stays put; tap again to fold it. TalkBack reads a few rows (name, state, progress) and an expandable track ("expanded"/"collapsed"); icons and the I to IV ladder are skipped.
4. Android back closes the sheet in one press (the scrim and Close also close it; a second press behaves as before).
5. With Android's "remove animations" on, the sheet opens and closes without motion.
6. A card from a real unlock: it rises with the icon, ACHIEVEMENT, the name and the line, holds about twice the old length, and a tap dismisses it (the first tap right after it appears is ignored by the arm window); TalkBack announces it once.
7. Cross a tier inside a fight: no card during the fight or its last-round playback; it appears when the playback ends.
8. Die on floor 1 with a fresh hero: read Special Snowflake in the Earned strip on THAT IS THAT, above BURY THEM, with both buttons still reachable; the strip scrolls inside itself if it holds many.
9. The icons are present in the installed debug APK (list rows, the card and the strip): they come from `www/achievements/ingame`, which only a real build proves.
10. The four-at-once collapse and the summary card's tap have no practical device route; they are covered by the unit and sandbox tests.

Headless Chrome measures boxes, overflow and image loading; it does not prove glyph shapes, TalkBack speech, the Android back gesture, a notch or system-bar inset, or the feel of the card's hold; those are the rows above.

## Self-Check: PASSED

- FOUND: test/unit/achievement-assets.test.js, test/unit/achievements-shell-a11y.test.js, copyAchievementIcons in tools/build-www.mjs, the three new scenes in tools/layout-check.mjs, both Phase 100 sections in docs/SHELL-MODULES.md
- FOUND commits: b8b9f83e, b169e603, b634d03f
