---
phase: 97-large-screen-support
plan: 04
subsystem: ui-shell
tags: [layout, landscape, side-rail, side-panel, arrow-pad, safe-area, large-screen]
requires: [97-01, 97-02, 97-03]
provides:
  - "#mw-stage[data-tab] (written by showTab) and #mw-stage[data-panel-up] (\"1\"|\"0\", written by renderEncounter)"
  - "SIDE group: @media LAYOUT_MEDIA.side inside <style id=\"mw-layout\"> (navigation rail, map plus right-hand side panel, docked camp)"
  - "SHORT group: @media LAYOUT_MEDIA.short (one-row HUD, 45% side panel, centred columns, two-column Hero and Gear, full-height sheets, trimmed combat)"
  - "--mw-side-w custom property (short: 45%), read as var(--mw-side-w, 45%)"
  - "syncArrowPad's side-layout card rule (window.__mzLayout.railBeside())"
affects: [97-05, 97-06]
tech-stack:
  added: []
  patterns: [CSS grid app shell for the side layouts, stage data attributes as the CSS hook for tab and encounter state, one indented rule per line so line-start pins keep reading base rules]
key-files:
  created: []
  modified:
    - mazeworld.html
    - test/unit/layout-shell.test.js
    - test/unit/shell-arrow-pad.test.js
requirements-completed: [SCREEN-03, SCREEN-06]
status: complete
completed: 2026-10-04
---

# Phase 97 Plan 04: The landscape layout Summary

A phone on its side now lays out as the CONTEXT sketch: navigation rail on the left, a one-row HUD, the map filling the rest, a right-hand side panel (rail card, fight, store, loot, stairs, death, Make Camp) that takes width only while something is up, readable centred columns elsewhere, and the arrow pad in its corner and never under a card.

## What was built

- **Task 1, attributes and pad rule:** `showTab` writes `data-tab` on `#mw-stage` right after `mwActiveTab = name;`; `renderEncounter` writes `data-panel-up` ("1" or "0") right after `encWasActive = active;` (nothing is written on `#enc-panel`, a snapshot root). `syncArrowPad`'s `railUp` expression now also requires `!window.__mzLayout?.railBeside?.()`, so in short and expanded the pad stays up beside a docked card; compact, medium and the shell sandbox (no `__mzLayout`) keep the 260927-s7b hide-in-place rule. The comment above `syncArrowPad` records this.
- **Task 2, SIDE block:** grid app shell (`nav | hud / cond / stage`), `.mw-tabbar` as a column with a left-edge active marker (padded by the top, bottom and left insets), `.mazebox` as a row, `#enc-panel` as a `flex:0 0 var(--mw-side-w, 45%)` column that scrolls inside itself, the party pulse and sprite kept visible beside it, arrow-pad side offsets 12px (the stage pads the insets), `#mw-rail` as an overlay at the side-panel width inside the right and bottom insets (`#mw-rail[hidden]{display:none!important}` so an empty rail costs nothing), the rail as a real flex column on the MAP tab when no encounter panel is up and no `data-over` (the verbatim selector from the plan), and Make Camp docked right over a lighter scrim with top and right insets.
- **Task 3, SHORT block:** `--mw-side-w:45%`; one-row HUD grid (`"ident band2" "track track"`); ☰ dropdown `max-height` (vh fallback then dvh); Oracle and Dead centred at 640px; Hero and Gear up to 960px; Hero `column-width:300px;column-count:2`; Gear as a two-column grid (WORN left, BAG, CONSUMABLES, ALSO ON YOU right); `.mw-legend-panel` centred at 640px and allowed the full height; trimmed `.cb-head`, `.cb-sum-body` (44px) and `.cb-act` so the combat actions fit about 320px of stage height.
- **Tests:** `layout-shell.test.js` gains (n)(o)(p) for the attributes and pad expression, (q)(q2) for the ten SIDE rule groups, (r)(r2) for the SHORT rules; `shell-arrow-pad.test.js` gains the side-layout vs stacked pad test.

## Commits

- be05d64f feat(97-04): stage tab and panel attributes, pad stays up beside a docked card
- fd0cf294 feat(97-04): side layout block, nav rail, right-hand side panel, docked camp
- 328d7d86 feat(97-04): short-window block, one-row HUD, centred columns, two-column Hero and Gear

## Tests run (targeted only)

- Task 1 set (shell-arrow-pad, layout-shell, rail-overlay, shell-map-rail, shell-map-viewport, dead-lockdown, shell-combat-screen, shell-combat-over, shell-loot-screen, shell-tab-snapshots): 207 pass, 0 fail.
- Task 2 set (layout-shell, rail-overlay, hud-menu-layout, shell-arrow-pad, text-scale): 91 pass, 0 fail. The single-occurrence SIDE media check prints ok.
- Task 3 set (layout-shell, hud-menu-layout, hud-bands-layout, rail-overlay, shell-combat-screen, text-scale, shell-tab-snapshots): 104 pass, 0 fail.
- Extra edit-adjacent set (shell-tab-snapshots, shell-arrow-pad, shell-map-viewport, shell-map-store-polish, shell-map-rail, dead-lockdown, shell-combat-over, shell-loot-screen, android-system-bars, voice-corpus): 220 pass, 0 fail.
- `git diff a5fbd87f -- engine test/parity test/determinism` is empty; `git status --short test/unit/fixtures` is empty (no fixture moved). No full suite, bots, sims, browser or Android build was run.

## Deviations from Plan

**1. [Rule 3 - Blocking pin] layout-shell (h) re-pinned for the short group's vh/dvh pairs**
- **Found during:** Task 3 (the plan's item 3 and item 7 write `100vh` then `100dvh` inside the SHORT media group, but 97-03's pin (h) allows dvh only inside the `@supports` group and exactly six base vh fallbacks).
- **Fix:** (h) now checks the short group on its own (exactly two `100vh` and two `100dvh`, each vh declaration immediately followed by its dvh twin) and scans the rest of the stylesheet as before. Carries a "Phase 97 (SCREEN-03): declared re-pin" comment.

**2. [Test-side choice] (o)'s `data-panel-up` count**
- The SIDE block's selector also contains the text `data-panel-up`, so the "written once" check counts `setAttribute("data-panel-up"` instead of the bare string.

Otherwise the plan was executed as written. No markup was added anywhere, so no shell-snapshot fixture moved.

## Known Stubs

None.

## Notes for 97-05

- **`--mw-side-w` is defined only in the SHORT block.** The SIDE block reads `var(--mw-side-w, 45%)`, so expanded windows get 45% until 97-05 sets `:root{--mw-side-w:...}` (LAYOUT_SIDE_WIDTH.expanded) in its own expanded query.
- The SIDE query already covers expanded windows (`(min-width: 840px) and (min-height: 480px)`): nav rail, rail card docked on MAP, encounter column and docked camp all apply there today. 97-05 only has to override what it wants different (the persistent right pane, Hero/Gear/Oracle in the pane, the map pane). The short-only rules (one-row HUD, 640/960px columns, sheet cap, combat trim) do not apply to expanded.
- Cap and centre the title, roller, leaderboards-from-title, HUD-menu scrim panels and sheets in expanded windows: 97-04 only capped the sheets (`.mw-legend-panel`, 640px) inside the SHORT block. Medium and expanded sheets are still full width.
- The docked rail column resizes the map every time a card shows or goes on the MAP tab (the 97-03 viewport ResizeObserver re-centres the party). No new `mzKeepPartyInView` literal was added; the count stays 13.
- `#mw-rail[data-over="combat"]` keeps its `bottom:var(--mw-rail-lift,0px)` (higher specificity than the side overlay rule), so in the side layouts the card sits on the combat summary strip of the right-hand column, as on a phone.
- Rule order inside mw-layout: global rules, compact notes group, SIDE group, SHORT group, in that source order. Add medium and expanded groups after these and indent every rule two spaces.

## Deferred human verification

- Pixel 7 in landscape (Screen set to Rotate), both landscape directions: play a full run. Roll, walk with the arrow pad and with tap-to-move, take a find (the card docks beside the map and the pad stays up), fight two rounds (the fight is the right-hand panel, the party marker and glow stay visible, the actions are on screen without scrolling), open the store and buy, make camp (the sheet docks right over a lighter scrim, the map stays visible behind it), read Hero, Gear, the Oracle and the leaderboards, die and bury. Every screen fits.
- Pixel 7 in landscape at text size L: the one-row HUD keeps the name, the HP and the four counters; the race/sub-class may ellipsize. The ☰ dropdown fits the short window.
- SCREEN-06 on a real cutout: with the camera cutout on the left and then on the right, and with gesture and 3-button navigation, no HUD text, tab, rail card, side-panel control or the docked camp sheet sits under an inset. The CDP check in 97-06 runs with zero insets, so this is only confirmed on the device and the AVD cutout row.
- Side panel feel: at 800x360 the map is about 400 px wide beside a fight; confirm it reads well and the 45% width is right.

## Self-Check: PASSED

Commits be05d64f, fd0cf294, 328d7d86 are in `git log`; `layout-shell.test.js` and `shell-arrow-pad.test.js` carry the new pins; the engine/parity/determinism diff and the fixture status are empty.
