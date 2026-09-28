---
quick_id: 260927-s7b
status: complete
date: 2026-09-27
---

# Quick 260927-s7b: hide the bottom buttons while a rail card shows (summary)

**Result:** the buttons a rail card pushes up are the **arrow pad** (Phase 78, HUD-08). The store's buttons never move. The fix went on the pad: it stays in its corner and hides in place while a rail card is up, then shows again when the card goes. The user is asked to confirm this is what they meant.

(The executor's Write tool refused the report file, so the orchestrator wrote this SUMMARY from the executor's returned text.)

## What the rail actually moves (measured first)

Headless Edge at 412x915, a live run, driven over CDP (a scratch probe, not committed):

- **The store screen: its Leave row does not move.**
  - The store is the `#enc-panel` overlay in legacy mode (`mazeworld.html:5264`, mounted at `:5418`).
  - `.mw-overlay` is `position:absolute; inset:0; z-index:8` (`:554`), and the Leave row is `#enc-body .actions{margin-top:auto}` (`:732`, `src/browser/storeScreen.js:90`).
  - The rail is `.mw-rail{position:absolute; bottom:0; z-index:4}` (`:972`), so it sits UNDER the store overlay.
  - A BUY that raised a card left `#a-leave` at exactly the same rect.
- **The arrow pad: pushed up 74px.**
  - Phase 78's `syncArrowPad` measured the rail and wrote `--mw-pad-lift`, and the pad CSS used `bottom:calc(12px + var(--mw-pad-lift, 0px))`.
  - In arrow mode the pad sat at top 673 / bottom 837. With a one-line card shown it moved to 599 / 763.

## The fix (commit 624dfcd9)

- `mazeworld.html:517`: the pad's `bottom` is a fixed `12px`. The lift and its measurement are gone.
- `mazeworld.html:7412`: `syncArrowPad` stamps `pad.dataset.railUp` from the rail's own `data-shown`. Every `renderRail` exit already calls `window.mzSyncArrowPad?.()`, so show and hide are hooked in one place. The keep-in-view key is now the side alone, so a card showing or going never moves the camera.
- `mazeworld.html:527-528`: `.mw-arrow-pad[data-rail-up="1"]{visibility:hidden}`, and its buttons get `pointer-events:none`. The pad keeps its box, nothing reflows, and it can't be tapped.
- **Every dismissal path shows it again:** the hold timer, an armed body tap, a resolved decision, and a card replacing a card (the pad stays hidden until the last one goes). The stairs fade re-syncs too.
- **Relaunch:**
  - with no card: the pad shows;
  - with a decision card restored: the pad stays hidden;
  - into an open store: the pad is hidden by the encounter rule until the store closes, then it shows.
- **After the fix,** the pad stays at 673 / 837 in all three states. Keyboard arrows still step, tap-to-move stays the default, and nothing depends on the pad.

## Tests

`test/unit/shell-arrow-pad.test.js` (29 pass):
- **Re-pinned, with reasons:** the pad CSS pin (`bottom:12px`, no `--mw-pad-lift`); "a shown card hides the pad in place; the camera does not re-check".
- **New:**
  - the rail-up CSS pair;
  - a pad hidden for another reason never reads as rail-up;
  - the REAL `renderRail` wired to the REAL `syncArrowPad`, covering the hold running out, an armed tap, a card replacing a card, a locked decision card that then resolves, and the three relaunch cases.
- No snapshot was regenerated and no fixture moved (no engine, content or parity file was touched).

## Gates (executor's worktree)

- `npm test`: 7,486/7,486, which is 7,480 plus 6 new tests.
- Parity: 66/66.
- `build:www` + `boot:check`: PASS on all 4 checks.

## For the user

1. **Confirm the target.** On the store screen nothing moves when a card shows; the arrow pad is the only thing a card pushes. If you meant something else, say which screen. The commit reverts cleanly.
2. **Separate finding, not changed:** rail cards raised while the store is open (a BUY's "WELL THEN", a refusal) draw UNDER the store overlay (rail z-index 4, overlay 8, 94% opaque), so you never see that feedback while shopping. The same happens over the loot screen and the stair prompt. The options are to raise the rail over those overlays the way combat does (`#mw-rail[data-over="combat"]`, `mazeworld.html:1012`), or to leave it as it is.
3. **Other bottom rows checked, none pushed:**
   - the full-bag find card and the hazard card are themselves rail cards;
   - the camp sheet draws over the rail;
   - the store, loot and stair panels sit above the rail;
   - combat lifts the rail onto the what-happened strip.

## Human check

On the Pixel 7 (debug APK rebuilt with this change), turn on Settings › Movement › ARROWS and walk onto a trap or a feature so a card shows. The pad vanishes in place and comes back in the same spot when the card goes.
