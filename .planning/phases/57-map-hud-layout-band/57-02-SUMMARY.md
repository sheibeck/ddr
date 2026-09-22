---
phase: 57-map-hud-layout-band
plan: 02
subsystem: ui
tags: [shell, rail, layout, css, vanilla-js]

requires:
  - phase: 57-map-hud-layout-band (plan 01)
    provides: "the map chip strip already out of .mw-maze-viewport, so this plan's #mw-stage wrapper has no chip/rail collision to solve"
provides:
  - "#mw-stage — the rail's positioning parent, a new flex:1/min-height:0 wrapper around .mw-screens and #mw-rail, sitting between #app and .mw-tabbar"
  - "The rail as an absolutely-positioned overlay (position:absolute;left:0;right:0;bottom:0), visible via transform+visibility instead of display:none, ready for Phase 58 to animate"
  - "renderRail() writes railEl.dataset.shown from the same predicate as railEl.hidden, in one place, so the stylesheet's visibility model and the accessibility-facing hidden attribute can never disagree"
  - "test/unit/rail-overlay.test.js — the seven-test LAYOUT-01 structural proof (out-of-flow claim, stage containment, transform-driven visibility, unbroken flex chain, renderRail() standing guard, still-a-sibling claim, no-motion-added claim), teeth-checked"
affects: [57-03-rail-dismiss-holds, 58-motion]

tech-stack:
  added: []
  patterns:
    - "rail-overlay.test.js follows shell-map-rail.test.js's source-assertion house style (fs.readFileSync against the real mazeworld.html, no importable module surface) but uses tools/ident-sweep.mjs's stripHtml for its one comment-stripped body slice, per Phase 56's carried-forward lesson on bare substring greps"
    - "hidden attribute + data-shown dataset both written from one boolean in renderRail(), never independently — the same one-predicate-two-writes shape Phase 57-01 used for paint()'s bridge writes"

key-files:
  created:
    - test/unit/rail-overlay.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "Followed the plan's <discovery> correction verbatim: #mw-stage wraps .mw-screens + #mw-rail (both direct children of #app become its two children), NOT .mazebox as CONTEXT.md's stale note claimed — the rail stays a sibling of .mw-screens so the 2026-09-17 every-tab feedback ruling (rail visible on Hero/Gear/Oracle tabs too) is preserved. Anchoring inside .mazebox would have put the rail inside #screen-maze, which is hidden on the other four tabs."
  - "z-index:4 on .mw-rail — above .mw-party-pulse (2) and .mw-major (2), below #enc-panel's 8, per the plan's read_first z-index ladder note."
  - "data-shown is derived by reading the just-assigned railEl.hidden property (`railEl.dataset.shown = railEl.hidden ? \"0\" : \"1\"`) rather than re-evaluating `!!(S.combat || S.dead) || idle` a second time — same boolean, one source of truth, and it keeps the diff to a single new line."
  - "rail-overlay.test.js test 4 (the flex chain) reads #screen-maze's TWO separate CSS rules (a structural flex-column rule at the top of the stylesheet and a padding-only override further down) and asserts against whichever one carries display:flex, since neither rule alone carries every declaration the chain needs."

requirements-completed: [LAYOUT-01]

coverage:
  - id: D1
    description: "#mw-rail is absolutely positioned inside #mw-stage and carries no flex value or fixed min-height — a rail show/hide can no longer resize .mw-maze-viewport"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(1) the rail is out of #app's flex flow"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(b) CSS: .mw-rail's own values..."
        status: pass
    human_judgment: false
  - id: D2
    description: "#mw-stage is the rail's positioning parent (relative, flex:1, min-height:0, flex column, overflow:hidden) and structurally contains both .mw-screens and #mw-rail while .mw-tabbar stays outside it"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(2) the stage is the positioning parent and clips the translated-out rail"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(l) layout: ...#mw-stage containment"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rail visibility is transform+visibility, never display:none — the [hidden] rule restores block display first; pointer-events flips with visibility (T-57-04)"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(3) visibility is transform-driven, not display-driven"
        status: pass
    human_judgment: false
  - id: D4
    description: "The #app -> #mw-stage -> .mw-screens -> #screen-maze -> .mazebox -> .mw-maze-viewport definite-height flex chain is unbroken by the new wrapper (T-57-05)"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(4) the flex chain that gives .mw-maze-viewport a definite height is unbroken"
        status: pass
    human_judgment: false
  - id: D5
    description: "renderRail() still calls neither fit() nor the keep-in-view nudge, and writes data-shown from the same predicate as hidden, in one place"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(5) renderRail() neither refits the canvas nor nudges the camera"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(o)/(f) predicate + precedence pins"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rail stays a sibling of .mw-screens, not a child of one — the every-tab feedback ruling stands"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(6) the rail is still a sibling of the screens, not a child of one"
        status: pass
    human_judgment: false
  - id: D7
    description: "No transition, duration, easing or @keyframes was added — Phase 58 owns all of that"
    requirement: LAYOUT-01
    verification:
      - kind: unit
        ref: "test/unit/rail-overlay.test.js#(7) no transition, duration or easing was added"
        status: pass
    human_judgment: false
  - id: D8
    description: "On the Pixel 7, the map does not jump when a rail card appears or clears, and the rail overlays the bottom of the play area without covering the tab bar at any safe-area inset"
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — device-only visual/interaction check, batched for Phase 60's Pixel 7 session. The automated half of this claim (the CSS/structural proof that a rail show/hide cannot change .mw-maze-viewport's box) is D1/D4 above."

duration: ~25min
completed: 2026-09-22
status: complete
---

# Phase 57 Plan 02: Rail Overlay (LAYOUT-01) Summary

**The rail is no longer a `flex:none;min-height:132px` sibling that reflows the map — it is now an absolutely-positioned overlay inside a new `#mw-stage` wrapper, shown/hidden with `transform`+`visibility` instead of `display:none`, with a teeth-checked structural test proving it can never resize `.mw-maze-viewport`.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-22T17:27:00Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Introduced `<div class="mw-stage" id="mw-stage">` as a new child of `#app`, wrapping `<main class="mw-screens">` and `<section class="mw-rail" id="mw-rail">` — the rail's new positioning parent (`position:relative;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden`). `<nav class="mw-tabbar">` stays a direct child of `#app`, outside the wrapper.
- Rewrote `.mw-rail`'s CSS: dropped `flex:none;min-height:132px`; added `position:absolute;left:0;right:0;bottom:0;z-index:4` plus a resting state (`transform:translateY(100%);visibility:hidden;pointer-events:none`). Rewrote `.mw-rail[hidden]` so its first declaration restores `display:block` (defeating the UA's own `[hidden]{display:none}` rule) with the same resting transform/visibility/pointer-events. Added a new `.mw-rail[data-shown="1"]` rule (`transform:translateY(0);visibility:visible;pointer-events:auto`). No transition, duration, easing or `@keyframes` added — the two pre-existing `mw-rail-new`/`mw-rail-pulse` animation classes are untouched.
- `renderRail()` now writes `railEl.dataset.shown` immediately after `railEl.hidden`, from the same boolean, so the two can never drift; the 2026-09-17 UAT comment above the assignment gained one sentence naming Phase 57 (LAYOUT-01) and explaining the split (hidden for a11y, data-shown for the stylesheet).
- `test/unit/rail-overlay.test.js` (new, 7 named tests): the out-of-flow claim, the `#mw-stage` containment/clipping claim, the transform-driven-visibility claim (including the `[hidden]`-restores-block-display detail and pointer-events per threat T-57-04), the unbroken flex chain (`#app.mw-app -> .mw-stage -> .mw-screens -> #screen-maze -> .mazebox -> .mw-maze-viewport`, per threat T-57-05), the `renderRail()` standing guard (zero `fit(`, zero `KeepPartyInView`), the still-a-sibling claim, and the no-motion-added claim (per T-57-06).
- Re-pinned `test/unit/shell-map-rail.test.js` test (b) to the new `.mw-rail`/`.mw-rail[hidden]`/`.mw-rail[data-shown="1"]` declarations (byte-exact, all five tone rules and typography pins untouched) and test (l) to also assert `#mw-stage`'s containment. Test count unchanged (19).
- **Teeth check performed and recorded** (plan-mandated): temporarily restored `flex:none;min-height:132px` on `.mw-rail`, ran `node --test test/unit/rail-overlay.test.js`, confirmed test 1 ("the rail is out of `#app`'s flex flow") **FAILED** as expected, then reverted — `git diff` on `mazeworld.html` after the revert showed zero content diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: The #mw-stage wrapper and the rail's overlay CSS** - `285956d` (feat)
2. **Task 2: renderRail() writes the shown state alongside the hidden attribute** - `dfe6a12` (feat)
3. **Task 3: test/unit/rail-overlay.test.js — the LAYOUT-01 structural proof, and re-pin shell-map-rail** - `1a6ff84` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `mazeworld.html` - New `#mw-stage` wrapper markup + `.mw-stage` CSS rule; `.mw-rail`/`.mw-rail[hidden]` rewritten, `.mw-rail[data-shown="1"]` added; `renderRail()` writes `railEl.dataset.shown`; the pre-existing rail comment extended to name Phase 57 (LAYOUT-01)
- `test/unit/rail-overlay.test.js` - New: 7 named tests, the LAYOUT-01 structural proof
- `test/unit/shell-map-rail.test.js` - Tests (b) and (l) re-pinned to the overlay CSS and the `#mw-stage` wrapper; test count unchanged (19)

## Decisions Made

- Followed the plan's `<discovery>` correction verbatim: `#mw-stage` wraps `.mw-screens` + `#mw-rail` (both already direct children of `#app`), **not** `.mazebox` as CONTEXT.md's stale note claimed — this keeps the rail a sibling of `.mw-screens`, preserving the 2026-09-17 every-tab feedback ruling.
- `z-index:4` on `.mw-rail` — above `.mw-party-pulse`/`.mw-major` (2), below `#enc-panel`'s 8, per the plan's own z-index ladder note.
- `data-shown` is derived by reading the just-assigned `railEl.hidden` property rather than re-evaluating the predicate a second time — one source of truth, minimal diff.
- `rail-overlay.test.js` test 4 (the flex chain) reads `#screen-maze`'s two separate CSS rules and asserts against whichever carries `display:flex`, since the chain's declarations are split across a structural rule and a later padding-only override.

## Deviations from Plan

None — the plan executed exactly as written, including its own `<discovery>` correction (the `.mazebox` → `#mw-stage`-around-`.mw-screens`+`#mw-rail` positioning-parent fix), which was already baked into the plan text and required no separate deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The rail is now an out-of-flow overlay with a transform-driven visibility model — Plan 03 (rail dismiss + doubled holds, LAYOUT-02/03) and Phase 58 (MOTION-01..05, the actual slide animation) can build directly on `data-shown`/`.mw-rail[data-shown="1"]` without further structural change.
- All milestone gates hold at this commit: engine gate (`git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/` empty), `npm test` 3559/3559 (green, grew by the 7 new tests over the 57-01 baseline of 3552), `npm run build:www` exit 0.
- Deferred device check (D8 above — the map does not visibly jump on a real Pixel 7 through a rail show/hold/hide cycle, and the rail clears the tab bar at every safe-area inset) is recorded for the Phase 60 batched Pixel 7 session per the standing deferred-UAT protocol — no device pause was taken in this run.

---
*Phase: 57-map-hud-layout-band*
*Completed: 2026-09-22*

## Self-Check: PASSED

All created files and referenced commits verified present on disk / in git log.
