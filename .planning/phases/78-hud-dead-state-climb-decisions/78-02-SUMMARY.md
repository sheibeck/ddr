---
phase: 78-hud-dead-state-climb-decisions
plan: 02
subsystem: shell-settings
status: complete
tags: [HUD-04, HUD-05, text-size, settings, volume-slider, css]
requires: []
provides:
  - "the root --mw-text-scale write (document.documentElement)"
  - "every shell font-size on a token or calc(<N/16>rem * var(--mw-text-scale)), with a 10-entry glyph/dev allowlist"
  - "src/browser/sliderGesture.js (SLIDER_SLOP_PX, classifySliderGesture, sliderValueAt, sliderGestureNext)"
  - "volApplyLive / volCommit, the one live and one persist path for the volume sliders"
affects: [78-05, 78-07, 78-08]
tech-stack:
  added: []
  patterns:
    - "text sizes are rem against the 16px root times var(--mw-text-scale), never em, never fixed px"
    - "a band that cannot fit 412px at L caps its own scale with min(var(--mw-text-scale), cap)"
    - "pointer gestures on native controls go through a pure state machine returning an effect"
key-files:
  created:
    - src/browser/sliderGesture.js
    - test/unit/text-scale.test.js
    - test/unit/slider-gesture.test.js
  modified:
    - mazeworld.html
    - test/unit/settings.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/settings-volume-shell.test.js
    - test/unit/fight-log-sheet.test.js
    - test/unit/foe-family-card.test.js
    - test/unit/round-summary-band.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-fight-log.test.js
decisions:
  - "The text scale is written on the root element only; the #app write is gone (nothing read it there)."
  - "Band 2 (the counters) caps its own scale at 1.1: S 0.85 < M 1 < L 1.1. Every other token takes the full 1.25."
  - "Every text font-size becomes calc(<N/16>rem * var(--mw-text-scale)), exact at M. Tokens were not substituted even where values matched, so no typography role changed."
  - "Ten fixed-box glyph and dev-only sizes stay fixed, on an allowlist in text-scale.test.js; the combat screen has none."
  - "A volume slider gesture is pending up to 8px, then horizontal only when |dx| > |dy| strictly. A tap commits the tapped level. A vertical drag or a cancel restores the start level, with no storage write and no sound."
metrics:
  duration: "about 95 min"
  completed: 2026-09-26
  tasks: 3
  files: 13
---

# Phase 78 Plan 02: Settings behave (text size everywhere, no slider scrub) Summary

The S/M/L text size now scales every piece of shell text on every screen, the combat screen included. The fix writes `--mw-text-scale` on the root element, where `:root` declares the tokens, and converts 148 fixed px font sizes to scaled rems. Band 2's counters cap at 1.1 so they still fit 412px. A pure slider gesture module means a vertical drag on the Settings sheet scrolls it and never changes a volume.

**Plan base SHA:** 08e07495

## What was built

### Task 1: every font token follows the setting (HUD-04)
- **The root cause:** `applySettings` wrote the scale on `#app`. A custom property's `var()` resolves where the property is declared, so every token was computed on `:root` at the default 1 and `#app` inherited that already-resolved value. The shell now calls `document.documentElement.style.setProperty("--mw-text-scale", …)` exactly once.
- **The `#app` scoping:** grep found nothing that reads `--mw-text-scale` off `#app`, in CSS, the shell or `src/`, so the `#app` write was removed. Elements outside `#app` now scale too: the title, the roller, and the sheets mounted on the body. That is what "every screen" asks for.
- **Band 2 cap:** `--mw-font-hud-label` and `--mw-font-hud-num` are used only by band 2. Both now multiply by `min(var(--mw-text-scale), 1.1)`, and the reason is in the `:root` comment.
- **Tests:**
  - `text-scale.test.js` walks every token: each one scales, is written in rem, is declared once and only on `:root`.
  - It also pins that the root starts at 1, the single root write, and the band-2 cap (S < M < L, unchanged at M, and the model fits 411 at the capped L).
  - `settings.test.js` gains the adjacency and M-fallback cases.

### Task 2: every screen's text scales, the combat screen included (HUD-04)
- **Inventory:** the style blocks hold 237 font-size declarations. Before this plan: 5 were tokens, 74 already scaled and 158 fixed.
- **Converted:** 148 fixed sizes. Each N px became `calc(<N/16>rem * var(--mw-text-scale))`, which equals the old px exactly at M.
  - The two `clamp()` sizes (the `h1` and the title name) became `calc(clamp(<rem>,<vw>,<rem>) * var(--mw-text-scale))`.
  - The epitaph keeps its `!important`.
  - No other declaration was touched: the diff is 148 single-line value swaps plus comments.
- **Allowlist** (kept in `text-scale.test.js` with its reasons; no combat selector is on it):

| Selector | Value | Reason |
|---|---|---|
| `.mw-major-icon` | 54px | the major card's icon glyph or PNG, sized to a fixed icon box |
| `.mw-rail-icon` | 20px | the rail's icon glyph or PNG, in a fixed icon slot |
| `.mw-hud-menu-face` | 18px | the ☰ glyph inside band 2's fixed 34px button face |
| `.mw-acct-initials` | 10px | the account monogram inside the fixed 34px avatar disc |
| `.mw-acct-glyph` | 15px | the "?" avatar glyph in the title chip's fixed disc |
| `.mw-hud-menu-glyph[data-glyph="marks"]` | 13px | a ☰ dropdown row's icon glyph (its label scales) |
| `.mw-hud-menu-glyph[data-glyph="centre"]` | 14px | same |
| `.mw-hud-menu-glyph[data-glyph="camp"]` | 16px | same |
| `.mw-hud-menu-glyph[data-glyph="settings"]` | 15px | same |
| `#mw-dev-perf` | 10px | the dev-only frame-timing readout |
| `.mw-dev-chip` (`font:` shorthand) | 10px | the dev-only DEV chip |

- **New rules in `text-scale.test.js`:**
  - every font-size is a token, a scaled rem or allowlisted, and no allowlist row is stale;
  - no `font:` shorthand carries a fixed size outside the allowlist;
  - there are at least 40 combat-screen declarations, all scaled;
  - three spot pins: `.cb-row-label` and `.cb-btn-label` read `0.46875rem`, and `.cb-foe-name` reads `0.5rem`;
  - every converted rem is a whole or half pixel at M, with S < M < L;
  - no font size is written in em.
- **Teeth:** run against the pre-conversion HTML, the new rules fail 3 tests.

### Task 3: a volume slider moves only on a sideways drag or a tap (HUD-05)
- **`src/browser/sliderGesture.js`** is pure (no DOM, timers, storage or imports) and exports:
  - `SLIDER_SLOP_PX` = 8;
  - `classifySliderGesture`: pending up to and including the slop, horizontal only when |dx| > |dy| strictly (a tie is vertical), non-finite input stays pending;
  - `sliderValueAt`: clamps to the track, rounds to the step, takes an `inset` for the thumb, and returns null for a zero-width track or bad input;
  - `sliderGestureNext`, a frozen-state machine that returns `{live}`, `{commit}`, `{restore}` or null.
- **Shell wiring in `mazeworld.html`:**
  - `.mw-vol-range` gains `pointer-events:none`, so the inputs stay focusable and the keyboard and TalkBack still fire `input` / `change`.
  - `.mw-vol-row{touch-action:pan-y}`.
  - pointerdown, pointermove, pointerup and pointercancel listeners on `#mw-vol-rows` start a gesture only when the pointerdown lands inside the row's range box.
  - `volApplyLive` and `volCommit` are the single live and persist paths, shared by the keyboard listeners and the gesture. The EFFECTS-only preview tap stays in `volCommit`, and a restore goes through `volApplyLive`, so it never writes storage or plays a sound.
- **Other range inputs:** the shell has exactly 3 `type="range"` inputs, the volume sliders, and a test pins that count.
- **Headless proof** (CDP touch events at 412px):
  - a vertical drag starting on MUSIC scrolled the sheet (scrollTop 0 to 181) and left the level at 100;
  - a sideways drag to mid-track set 50 and persisted it;
  - a tap at a quarter of the way along set 25.

## Measurements (headless Chrome, 412 x 915 CSS px, deviceScaleFactor 2.625, scratch scripts not committed)

| Surface | S (0.85) | M (1.0) | L (1.25) |
|---|---|---|---|
| Band 2 natural width, before the cap | 337.4 | 377.7 | 444.6 (counters 366.6 > 334 available: RATIONS clipped) |
| Band 2 natural width, cap 1.1 | 337.4 | 377.7 | **404.5** (counters 326.5 of 334, fits) |
| Band 1 | fits; `#mw-hud-line` ellipsizes by design | ellipsizes (312 > 220) | ellipsizes more (390 > 183) |
| Tab bar | 6.375px labels, fits | 7.5px, fits | 9.375px, fits |
| ☰ dropdown | 288px, no overflow | same | same |
| Combat (3 foes, round strip, action grid) | no off-screen or clipped text | same | same (the foe list scrolls inside `#cb-mid`) |
| Combat ABILITIES submenu | rows grow to fit, list scrolls | same | same |
| Rail with a multi-line find card | fits | fits | fits (taller, the map shrinks) |
| Title, roller, Hero, Gear, Oracle | fits | fits | fits |
| Settings sheet | fits | fits | fits |
| DEAD / Leaderboards | one element off the right edge at every size: the intentional horizontal board-chip scroll row | same | same; the scope strip label ellipsizes ("PLAY GAMES · SIG…") |

- The only "clipped" nodes the probe reported were `.sr-only` elements and the `aria-live` round region, which are visually hidden by design.
- **The store could not be reached headlessly** without a scripted shop visit, so it was not measured. Its rules are converted like every other; the Pixel 7 check is the backstop.
- **The round strip body** stays a fixed 78px with a masked top, so at L it shows about 3 lines instead of 4. That is the strip's existing, masked design, and THE FIGHT SO FAR sheet holds the full log.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned literal px CSS in five tests outside files_modified**
- **Found during:** Task 2 and the full-suite run.
- **Issue:** converting the sizes changed the literal `font-size:<N>px` values that these tests pin.
- **Fix:** each pin now expects the scaled rem, with a HUD-04 comment. Before and after:
  - `foe-family-card.test.js`: `/font-size:(\d+)px/` with `< 8` became a comparison of the scaled rems (family < name, name = 0.5rem).
  - `round-summary-band.test.js`: `14px` became `0.875rem`, and `6px` became `0.375rem`.
  - `shell-map-rail.test.js`: `8px`, `14.5px`, `13.5px` and `6px` became `0.5rem`, `0.90625rem`, `0.84375rem` and `0.375rem`.
  - `shell-worn-slots.test.js`: `.mw-drop-confirm`'s `11px` became `0.6875rem`.
  - `shell-fight-log.test.js`: `15px`, `15px` and `13.5px` became `0.9375rem`, `0.9375rem` and `0.84375rem`.
- **Commits:** 2859fce6, c450e483

### Re-pins inside files_modified (before and after)
- `shell-map-hud.test.js`:
  - `--mw-font-hud-label` / `--mw-font-hud-num` changed from `calc(<rem> * var(--mw-text-scale))` to `calc(<rem> * min(var(--mw-text-scale), 1.1))`;
  - `.mw-cond` went from `5.5px` to `0.34375rem`;
  - `.mw-cond-detail` went from `10px` to `0.625rem`.
- `fight-log-sheet.test.js`: `.mw-fl-title` / `.mw-fl-close` went from `7px` to `0.4375rem`, and `.mw-fl-hint` from `6px` to `0.375rem`.
- `settings-volume-shell.test.js` (5) and (6):
  - the assertions that were on the `input` / `change` listener bodies now sit on `volApplyLive` / `volCommit`;
  - each listener is pinned to hand off `volSliderValue(input)`;
  - the write order (`writeSetting`, then `applySettings`, then `renderSettingsSheet`), the single write and the EFFECTS-only tap are unchanged.
- Listed but untouched, because no literal they pin changed: `hud-bands-layout.test.js`, `shell-combat-actions.test.js`, `combat-submenu-fit.test.js`.

## Hand-offs and notes
- **78-05 (band 1):** at L the band-1 line (`#mw-hud-line`) ellipsizes early (about 183px available with a long name), so "Lvl N" can be cut off. 78-05 owns this line and shortens it to "Race Sub-class · Lvl N". It should check L, and may want the same `min(var(--mw-text-scale), cap)` treatment on `--mw-font-hud-ident`.
- **`hud-menu-layout.test.js` (14)** still models band 2 at the uncapped 1.25 (446.8, which it only logs). The capped real figure is pinned in `text-scale.test.js`. I left that file alone because it is outside this plan.
- **78-07 (arrow pad):** size the pad's text in rem times `var(--mw-text-scale)` so it passes the every-font-size rule.

## Verification
- `npm test`: 6,960 / 6,960 pass, 0 fail. The parity suite is included in the `node --test` glob.
- `npm run build:www` and `npm run boot:check`: PASS (no-uncaught, painted, graves, title). A temporary node_modules junction was used and then removed; its target is intact and `www/` is not committed.
- No bot or tuning runs, per the orchestrator's ruling.

## Known Stubs
None.

## Commits
| Task | Commit | Message |
|---|---|---|
| 1 (RED) | 9bf96142 | test(78-02): pin the text-scale token walker and the root write (HUD-04) |
| 1 | 3b32127d | feat(78-02): every font token follows the text-size setting (HUD-04) |
| 2 | 2859fce6 | feat(78-02): every screen's text scales, the combat screen included (HUD-04) |
| 3 (RED) | f497584a | test(78-02): pin the slider gesture classifier, state machine and wiring (HUD-05) |
| 3 | 043c47c2 | feat(78-02): a volume slider moves only on a sideways drag or a tap on its track (HUD-05) |
| 2 (fix) | c450e483 | test(78-02): re-pin the fight log's scaled font sizes (HUD-04) |

## Self-Check: PASSED
- All six commits are present in `git log 08e07495..HEAD`.
- `src/browser/sliderGesture.js`, `test/unit/text-scale.test.js` and `test/unit/slider-gesture.test.js` exist.

## TDD Gate Compliance
- **Task 1:** the RED commit (9bf96142) is followed by GREEN (3b32127d). The root-write test failed before the fix.
- **Task 3:** the RED commit (f497584a) is followed by GREEN (043c47c2). The module was missing and the wiring pins failed.
