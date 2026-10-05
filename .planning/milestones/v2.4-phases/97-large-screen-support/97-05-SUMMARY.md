---
phase: 97-large-screen-support
plan: 05
subsystem: ui-shell
tags: [layout, medium, expanded, two-panes, tablet, foldable, chromebook, large-screen]
requires: [97-01, 97-02, 97-03, 97-04]
provides:
  - "MEDIUM group: @media LAYOUT_MEDIA.medium inside <style id=\"mw-layout\"> (text surfaces, sheets, encounter content and the rail card centred at 640 px)"
  - "EXPANDED group: @media LAYOUT_MEDIA.expanded (the map plus a persistent right pane, --mw-side-w: clamp(360px, 40%, 560px))"
  - "renderEncounter's encStarting and the expanded play-pane switch (window.__mzLayout?.mapStaysUp?.())"
affects: [97-06]
tech-stack:
  added: []
  patterns: [CSS grid over hidden attributes and data-tab for the two panes (no JS state per resize), start-edge-only tab switch]
key-files:
  created: []
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/layout-shell.test.js
requirements-completed: [SCREEN-04, SCREEN-05]
status: complete
completed: 2026-10-04
---

# Phase 97 Plan 05: Medium and expanded size classes Summary

Portrait tablets and upright unfolded foldables get the compact stack widened with every text surface centred at 640 px; landscape tablets, unfolded foldables on their side and Chromebook windows get two panes, the map always on the left and a persistent right pane holding Hero, Gear, the Oracle or the leaderboards, with 97-04's side rules supplying the play pane on MAP.

## What was built

- **Task 1, CSS:** after the SHORT group in `mw-layout`:
  - MEDIUM group, rules A1-A4: Hero, Gear, Oracle and Dead at 640 px; `.mw-legend-panel` at 640 px; `#enc-panel` (and its dark mode) padded so the overlay's content centres at 640 px while the overlay still covers the map; the bottom `#mw-rail` centred at 640 px (its slide transform untouched).
  - EXPANDED group, rules B1-B7: `--mw-side-w:clamp(360px, 40%, 560px)`; `#mw-screens` as a one-row grid, a second column of pane width on every tab but MAP; `#screen-maze` pinned to column 1, forced displayed when `hidden`, and its closing animation, absolute pinning and inline transform neutralised so the map never fades or flickers on a tab switch; Hero, Gear, Oracle and Dead in column 2 with their own scroll; a leaving pane screen fades in the pane's place; `#enc-panel` hidden off the MAP tab (never three columns); sheets at 640 px; title-opened leaderboards hide the map, collapse to one column and centre `#screen-dead` at 640 px.
  - Idempotent by construction: pure CSS over `hidden` and `data-tab`, no script state per resize or fold.
- **Task 2, JS:** `renderEncounter` computes `encStarting = active && !encWasActive` right after `hasActiveEncounter()` and, after 97-04's `data-panel-up` line, calls `window.__mzShowTab("maze")` when `window.__mzLayout?.mapStaysUp?.()` is true and the tab is not MAP. Only the start edge switches; the death branch's own HERO/GEAR switch is untouched. `__mzLayout` consumers in `bridge.js` reduced to the two plan-specified strings and `docs/SHELL-MODULES.md` regenerated (`bridge-doc --check` exits 0).
- **Tests (`layout-shell.test.js`):** (s) medium group, (t) expanded group plus source order SIDE < SHORT < MEDIUM < EXPANDED and "nothing else follows", (u1-u4) sandbox behaviour for every behavior bullet, (u5) a death that starts on GEAR in expanded, (v) source pin.

## Commits

- 6a6e3f63 feat(97-05): medium group and the expanded two panes
- 2799a49c feat(97-05): a fight that starts in expanded takes the pane
- 9230756c test(97-05): a death that starts in expanded switches to MAP once

## Tests run (targeted only)

- Task 1 verify set (layout-shell, rail-overlay, hud-menu-layout, panel-motion, shell-tab-snapshots): 73 pass, 0 fail. Edit-adjacent set (shell-map-viewport, android-system-bars, hud-bands-layout, text-scale, shell-arrow-pad, leaderboard-css, reduced-motion, shell-board): 176 pass, 0 fail. The single-occurrence medium/expanded media check prints ok.
- Task 2 verify set (layout-shell, bridge-registry, shell-combat-screen, shell-combat-over, dead-lockdown, shell-map-rail, shell-map-viewport, shell-loot-screen, storeScreen): 190 pass, 0 fail. Extra set (shell-map-store-polish, shell-tab-snapshots, rail-overlay, panel-motion, combat-beat-shell, shell-input-guards, layout-class): 81 pass, 0 fail. Final `layout-shell.test.js` alone: 29 pass, 0 fail.
- `node tools/bridge-doc.mjs --check` exits 0. `git diff a5fbd87f -- engine test/parity test/determinism` is empty. `git status --short test/unit/fixtures` is empty (no fixture moved). No full suite, bots, sims, browser or Android build was run.

## Deviations from Plan

**1. [Rule 3 - Blocking pin] layout-shell (f) re-pinned**
- **Found during:** Task 1. The pin "no rule sets max-width on body" matched `body[data-boards-entry="title"] #screen-dead{...max-width:640px...}` (plan item B7), a rule for a descendant of body.
- **Fix:** the regex now matches only rules whose subject is body itself (`body`, `html>body`, `body[attr]`). Carries a "Phase 97 (SCREEN-04): declared re-pin" comment.

**2. [Rule 2 - small addition] Hero dossier stacks in the pane (B8)**
- One extra expanded rule: `.doss section + section{border-left:0;padding-left:0;border-top:1px dotted var(--rule);padding-top:14px}`. The pane is 360-560 px, so the auto-fit dossier columns would wrap with stray left borders; the compact phone already stacks them this way. Pinned in (t).

**3. [Test-side choice] W written as `var(--mw-side-w, 45%)`** in the pane column and the leaving-screen width, matching how the SIDE group reads the variable. In expanded `--mw-side-w` is the clamp, so the value is the same.

**4. No title, roller or HUD-menu rules added.** The hand-off listed them as uncapped, but the title body is already `max-width:420px` over `object-fit:contain` art, the roller body is `max-width:420px; margin:0 auto`, and the HUD dropdown is `width:min(288px, ...)`; all three are already centred, so no cap was needed. Title-opened leaderboards are capped by A1 (medium) and B7 (expanded).

Otherwise the plan was executed as written. No markup was added, so no shell-snapshot fixture moved. The `mzKeepPartyInView` literal count stays 13; the vh/dvh pin (h) is untouched (no new vh or dvh).

## Known Stubs

None.

## Notes for 97-06

- **Shape to assert in expanded (>= 840 x >= 480):** `#mw-screens` is a grid. On MAP it has one column (`#screen-maze` fills it) and `#enc-panel` / the docked rail card are flex siblings inside `#screen-maze` / `#mw-stage` from 97-04. On HERO, GEAR, ORACLE and DEAD `#mw-screens` has two columns: `#screen-maze` visible in column 1 and the chosen screen in column 2 (width `--mw-side-w`, clamp(360px, 40%, 560px)). `#screen-maze` must be displayed (non-zero rect) on every tab even though it carries `hidden` after a tab switch. `#enc-panel` is `display:none` off the MAP tab.
- **Medium (600-839):** one column; `#screen-hero/gear/oracle/dead` at most 640 px wide and centred; the rail card and `#enc-panel` content at most 640 px wide and centred (the overlay itself still spans the width over the map); sheet panels at most 640 px.
- **Fight kept across rotate:** a fight that starts in expanded while HERO fills the pane switches the tab to MAP once (`encStarting` edge). Rotating to compact keeps `S` (nothing resets), the tab stays MAP, and the panel simply overlays the map again. Rotating a fight started on compact into expanded leaves the tab as is. Opening GEAR mid-fight in expanded hides the panel exactly as a phone does and MAP brings it back; a re-render never switches back to MAP.
- **Title-opened leaderboards in expanded:** `body[data-boards-entry="title"]` hides `#screen-maze`; `#screen-dead` is column 1, 640 px max and centred.
- **Tab-switch side effect:** the start-edge `showTab("maze")` runs the usual `__mzBeat.hurry()` and `mzKeepPartyInView()` like any tab tap. For a death that starts while HERO/GEAR fills the pane, `showTab` re-enters `renderEncounter` once (guarded: `encWasActive` is already true), covered by (u5).
- **Closing leaving screen:** a leaving pane screen is `position:absolute` against `#mw-stage` with `right:0; left:auto; width:var(--mw-side-w)`. It ignores the stage's right safe-area inset for the 120 ms fade only; zero insets in the CDP check make that invisible.
- **Map scale** needs no change: `cellScaleForWindow` already scales by the window's shorter side, and `#mw-maze-viewport`'s ResizeObserver re-keeps the party when the pane opens or closes.
- **Pad:** in expanded the arrow pad is in `#screen-maze`, so it stays on screen while HERO, GEAR, ORACLE or DEAD fill the pane (walking with a screen open is the intent) and stays up beside a docked card via `railBeside()`.

## Deferred human verification

- pixel_tablet emulator, landscape: walk the map with Hero open in the pane, start a fight (the pane switches to the fight), open Gear mid-fight and return to MAP; rotate to portrait and back mid-fight: the fight, its round and the tab are kept.
- pixel_fold emulator: unfold mid-store and fold again; the store, its stock and the open tab are kept, and the Screen lock re-applies on the cover screen.
- Desktop-size (Chromebook-like) emulator window: resize across 840 px wide and back twice; the layout lands the same each time.
- Portrait tablet (800x1280): Hero, Gear, the Oracle, sheets, the store panel and the rail card read as a centred column at most 640 px, with no gutters on the map.
- Feel check: the right pane collapsing to zero width on MAP when nothing is up (the "only while up" default). If the user wants the pane never to collapse, the follow-up is one rule in the expanded group.

## Self-Check: PASSED

Commits 6a6e3f63, 2799a49c, 9230756c are in `git log`; `layout-shell.test.js` carries (s), (t), (u1-u5), (v); the engine/parity/determinism diff and the fixture status are empty; `bridge-doc --check` exits 0.
