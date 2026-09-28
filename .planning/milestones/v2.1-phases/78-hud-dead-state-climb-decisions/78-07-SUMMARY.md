---
phase: 78-hud-dead-state-climb-decisions
plan: 07
subsystem: shell-input
status: complete
tags: [hud-08, arrow-pad, settings, camera, tap-to-move]
requires: [78-02, 78-03, 78-06]
provides:
  - "settings.js movement ('tap'|'arrows') and padSide ('left'|'right')"
  - "controls.js#keepInViewRect (the pad is an edge)"
  - "src/browser/arrowPad.js (ARROW_PAD_COPY, ARROW_PAD_DIRS, arrowPadModel)"
  - "#mw-arrow-pad overlay, the Movement/Pad settings rows, arrow-mode tapStep gate"
affects: [mazeworld.html, tools/stale-terms.mjs]
tech-stack:
  added: []
  patterns: ["pure view model + module-script sync function (window.mzSyncArrowPad, optional-chained from classic code)", "keepInViewAxis re-used over a sub-range of the viewport"]
key-files:
  created:
    - src/browser/arrowPad.js
    - test/unit/arrow-pad.test.js
    - test/unit/shell-arrow-pad.test.js
  modified:
    - src/browser/settings.js
    - src/browser/controls.js
    - mazeworld.html
    - tools/stale-terms.mjs
    - test/unit/settings.test.js
    - test/unit/controls.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-gear-toolbar.test.js
decisions:
  - "Default pad side BOTTOM RIGHT (ARROW_PAD_DEFAULT_SIDE, one constant)"
  - "The pad is a sibling of #mw-maze-viewport (not a child), so a press never enters the pan/tap/hold pipeline; the container is pointer-events:none, only the buttons take presses"
  - "keepInViewRect runs keepInViewAxis over the open side of the pad (column band: viewport top to pad top; row band: the pad's inner side edge), inheriting its rest margin and strict edge test"
  - "The pad lifts above a shown rail card via --mw-pad-lift, measured from the rail's layout height (not its sliding transform)"
  - "Press feedback is colour/border/shadow only (no transform), so the one blanket reduced-motion rule covers it"
metrics:
  duration: "22 min"
  completed: "2026-09-27"
  tasks: 3
  files: 14
---

# Phase 78 Plan 07: The opt-in arrow pad (HUD-08) Summary

Settings › Movement now offers TAP TO MOVE (the default) or ARROWS. ARROWS puts a four-way pad in the bottom-left or bottom-right corner of the map. Every press is one `window.move(dir)`, and map taps stop stepping. The camera scrolls before the party walks under the pad, because `keepInViewRect` treats the pad's rect as a viewport edge.

**Plan base SHA:** `876e71dca1e8cdfdedf270f42bc30bf259d22051`

## What was built

- **Settings (`src/browser/settings.js`):** `movement` (`"tap"` | `"arrows"`, default `"tap"`) and `padSide` (`"left"` | `"right"`, default `"right"`), now 13 fields. `writeSetting` validates them against the allowlist. `readSettings` loads them tolerantly: a missing, unknown or tampered value reads its default, so an unknown movement falls back to tap-to-move. The retired Phase 46 key and value are still never spelled.
- **Camera rule (`src/browser/controls.js#keepInViewRect`):** called with no obstacle, it returns exactly `keepInViewAxis` on each axis, so tap mode is unchanged (pinned over a grid of inputs).
  - When the party's cell is in the pad's column band, the y axis runs `keepInViewAxis` over the region above the pad.
  - When it is in the pad's row band instead, the x axis runs it against the pad's inner side edge.
  - Strictness matches `keepInViewAxis`: exactly `EDGE_TRIGGER_CELLS` from an edge does not scroll, closer does. BOTTOM LEFT and BOTTOM RIGHT are pinned as a mirrored case table.
- **Pad model (`src/browser/arrowPad.js`):** frozen `ARROW_PAD_COPY` ("Arrow pad", "Step north/east/south/west"), `ARROW_PAD_DIRS` (N, E, S, W with their cross placement), and `arrowPadModel(settings, ctx)`. The pad is visible only in arrow mode while a run exists, the hero lives, no encounter is up and no sheet is open.
- **Shell (`mazeworld.html`):**
  - The Movement row, and a Pad row that shows only while ARROWS is chosen (the volume rows' `hidden` pattern).
  - `#mw-arrow-pad`: four `data-step` buttons with `aria-label`s, `role="group"`, `z-index:3` (under the rail at 4, the overlay at 8 and the sheets at 45+), clear of the left/right safe-area insets.
  - `syncArrowPad` (module script, exposed as `window.mzSyncArrowPad`) renders the model. It runs from:
    - `applySettings`
    - both of `renderRail`'s exits after its `data-shown` write
    - the start of `renderEncounter`
    - a MutationObserver on the sheets' `hidden`
    - a ResizeObserver on the rail
  - It lifts the pad above a shown rail card, and re-runs keep-in-view whenever the pad's place changes.
  - `tapStep` returns before any step or rail line in arrow mode, via `tapMovementOff()`. Hold, pan, pinch and the keyboard path never read the setting.
  - In arrow mode with the pad shown, `keepPartyInView` converts the pad's rect to cells (`arrowPadCells`) and calls `keepInViewRect`. `window.__mzControls` gains `keepInViewRect`, with no new bridge name.

## Pad size at S / M / L

Each button is `max(48px, calc(3.25rem * var(--mw-text-scale)))`:

| Text size | Scale | Button | Pad (3 buttons + 2 x 4px gaps) |
|-----------|-------|--------|--------------------------------|
| S | 0.85 | 48px (44.2px, floored to the 48px touch minimum) | 152px |
| M | 1.0 | 52px | 164px |
| L | 1.25 | 65px | 203px |

The glyph is `calc(1.125rem * var(--mw-text-scale))`, so it satisfies 78-02's every-font-size rule.

## ALLOWED entry removed from tools/stale-terms.mjs

`{ term: "dpad", file: "mazeworld.html", match: "there is no D-pad", reason: "B — the Cloak-of-Ether tap rule states the retirement of the D-pad; ..." }` is gone. The tapStep Cloak-of-Ether comment was rewritten to describe both modes, and a comment in the file notes why the entry went. `test/unit/stale-terms.test.js` passes with no rot.

## Re-pinned tests

- `test/unit/settings.test.js`: the field list and count 11 -> 13 (`movement`, `padSide`); the defaults and round-trip deep-equals; the Phase 46 pin's comment. Five new HUD-08 tests: write accept/reject, tampered read, old blob, arrows/left load.
- `test/unit/controls.test.js`: eight new `keepInViewRect` tests covering the null regression grid, a malformed obstacle, no edge near, the strict column edge, outside the column, the strict row edge, a party under the pad, and the mirrored pair.
- `test/unit/shell-gear-toolbar.test.js` (outside the plan's file list, Rule 3): "exactly 11 fields" -> 13, with `movement` and `padSide` appended.
- `test/unit/shell-map-viewport.test.js`:
  - The (a) retired-control-bar titles and header now say the OLD bar stays gone while the opt-in pad exists; the zero-greps are unchanged.
  - (f) `mzKeepPartyInView` call sites 8 -> 10.
  - (m) the `__mzControls` exact pin now includes `keepInViewRect`.
- `test/unit/shell-map-invariants.test.js`: three SC-1 titles reworded the same way (the zero-greps are unchanged); `btn-death-sheet` added to `FILE_WIDE_GUARDED_IDS`.
- `test/unit/shell-input-guards.test.js` (orchestrator-authorised): `btn-death-sheet` added to `GUARDED_IDS`.
- `test/unit/shell-map-store-polish.test.js` (outside the plan's file list, Rule 3): `mzKeepPartyInView` call sites 8 -> 10.
- New `test/unit/arrow-pad.test.js` (8 tests) and `test/unit/shell-arrow-pad.test.js` (23 tests):
  - Settings rows and markup/CSS pins.
  - `syncArrowPad` run in a vm: hidden while dead, in an encounter, under a sheet, with no run, and in tap mode; the rail lift; the keep-in-view re-check.
  - Presses: one `window.move` each, in order.
  - The real `engineMove` in a vm: a press during a pending rail decision pulses and never steps.
  - The real `tapStep` in a sandbox, in both modes.
  - Keyboard in both modes.
  - The real `keepPartyInView`: `keepInViewRect` gets the pad's cell rect in arrow mode and is never called in tap mode or with the pad hidden.

## Verification

- `npm test`: 7,179 / 7,179 pass, 0 fail.
- Parity `node --test "test/parity/**/*.test.js"`: 66 / 66.
- `npm run boot:check`: PASS (no-uncaught, painted, graves, title). It ran on a temporary node_modules junction; the junction and www/ were removed afterwards, and the target is intact.
- No bot balance runs (user ruling 2026-09-26).
- Acceptance greps:
  - `padSide` appears 6 times in settings.js; `export function keepInViewRect` 1; `export function arrowPadModel` 1.
  - `mw-arrow-pad` appears 9 times in mazeworld.html; each `data-setting` appears once; `keepInViewRect` at least 2.
  - The retired `dpad` / `data-dir` / `mazefoot` literals appear 0 times.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned two tests outside files_modified**
- **Found during:** Tasks 1 and 2
- **Issue:** `shell-gear-toolbar.test.js` pins the settings field list (11), and `shell-map-store-polish.test.js` pins the `mzKeepPartyInView` call-site count (8). Both break on the planned changes.
- **Fix:** Re-pinned to 13 fields and 10 call sites, with Phase 78 notes.
- **Commits:** 1232bedf, 4760e1df

**2. [Rule 1 - Bug] Dropped the press "sink" and its second reduced-motion media query**
- **Found during:** Task 2
- **Issue:** A second `@media (prefers-reduced-motion)` rule broke the suite's one-blanket-rule invariant (reduced-motion audit, R7).
- **Fix:** Press feedback is now colour, border and shadow only (no transform). The one blanket rule removes its fade.
- **Commit:** 4760e1df

**3. Stale-comment cleanup beyond the tapStep sentence**
- The `applySettings` bridge comment and the Phase 35 control-bar note in mazeworld.html both said tap-to-move was the only movement input, so both were rewritten for HUD-08.
- The settings.js header was updated the same way.

## Deferred Issues

- `src/browser/bridge.js`'s `__mzControls` consumer string still lists only `keepInViewAxis` among the camera functions. `docs/SHELL-MODULES.md` is generated from it. The registry test passes because set equality is by bridge name, but the prose could name `keepInViewRect` in a later doc pass. bridge.js is outside this plan's files.

## Known Stubs

None.

## Human check (deferred UAT, Pixel 7 at milestone close)

- Switch Movement to ARROWS and back live; the Pad row appears only for ARROWS.
- Put the pad in each corner. Each press takes one step; a map tap does nothing; a hold still inspects; a drag still pans.
- Walk toward the pad in both corners; the map scrolls before the party slips under it.
- When a rail line appears, the pad stays above it and keeps working.
- The pad is gone while dead, in a fight, at the stair prompt, and with Settings or MARKS open.
- At S the buttons are still easy to hit; at L they are bigger; TalkBack reads "Step north" and so on.

## Self-Check: PASSED

- FOUND: src/browser/arrowPad.js, test/unit/arrow-pad.test.js, test/unit/shell-arrow-pad.test.js
- FOUND commits: 1232bedf, 3d4af720, 4760e1df, 7c91fa05
