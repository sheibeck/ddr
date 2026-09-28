---
phase: 78-hud-dead-state-climb-decisions
plan: 08
subsystem: shell-presentation
status: complete
tags: [hud-06, hud-09, stairs-fade, reduced-motion, rail, find-card, bag-full]
requires: [78-02, 78-06, 78-07]
provides:
  - "src/browser/stairsFade.js (STAIRS_FADE_MS, createStairsFade)"
  - "#mw-fade overlay and window.__mzStairsFade (bridged, documented)"
  - "viewModels.js#dropShelfRows (the bag-full drop rows with the Gear-sheet stat line)"
  - "the bounded .mw-find-drop region and the column-flex rail card"
affects: [mazeworld.html, src/browser/bridge.js, docs/SHELL-MODULES.md, test/unit/harness/shellSandbox.js]
tech-stack:
  added: []
  patterns:
    - "pure timer-injected motion controller (the cameraGlide/motion.js house style) bridged from the module script, read by classic draw()/renderRail()"
    - "one dispatch hook (dispatchWithNarration) for every floorChanged path"
    - "column-flex rail: only the drop region shrinks; the lines column scrolls past its floor, so the actions row is never overlapped"
key-files:
  created:
    - src/browser/stairsFade.js
    - test/unit/stairs-fade.test.js
    - test/unit/shell-stairs-fade.test.js
    - test/unit/find-card-full-bag.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - src/browser/viewModels.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-arrow-pad.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-new-best.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/foe-inspect-shell.test.js
    - test/unit/status-chit-combat.test.js
decisions:
  - "The fade hooks dispatchWithNarration (the shell's only dispatch() call site), so GO DOWN and RULES-12's resumed exit tile after a fight or a loot pile both fade"
  - "S takes the new state inside the hook before the fade starts, so the reduced-motion instant cut (both callbacks run synchronously) draws and centres the new floor; every caller sets the same state again straight after"
  - "The fade joins renderRail's one hidden predicate (|| fadeUp) instead of a second hidden write; its branch forgets the shown key and any hold/typing so the card rises, announces and holds from the reveal"
  - "The input lock is window.move's FIRST gate plus the overlay's pointer-events:auto while a phase runs; hasActiveEncounter() is untouched"
  - "Reduced motion stays in the ONE existing media query: the controller's reduced() (the shared prefersReducedMotion) makes the instant cut, never a CSS rule"
  - "window.__mzDropShelfItems now hands out dropShelfRows ({ it, i, name, stats }, a superset of the old { it, i } entries), so the find card and the loot screen both show the stat line with no new __mz name"
  - "A fixed region cap could not guarantee the fit at L (measured: TAKE / LEAVE 120px below a 656px stage at 412px wide), so the rail became a column where only the drop region shrinks, to a floor of about three rows"
  - "The bag-full line (existing copy) heads the drop region; no new copy string"
metrics:
  duration: "~1h 45m"
  completed: 2026-09-27
  tasks: 3
  files: 18
---

# Phase 78 Plan 08: The Stairs Fade and the Full-Bag Find Card Summary

**A stairs descent now fades to black over 0.6s under the stairs clip, swaps the floor in the dark and fades back in over 0.4s (an instant cut under reduced motion), with every input locked and the FLOOR card held until the fade-in ends. The full-bag find card keeps the found item and TAKE IT NOW / LEAVE IT on screen while a bounded drop list, one row per bag item with its Gear-sheet stat line, scrolls inside the card.**

Plan base SHA: `e78746c620b7acb48d06b376baf6b30ea4754314`.

## What was built

### HUD-06: the stairs fade
- `src/browser/stairsFade.js`: `STAIRS_FADE_MS` frozen at `{ out: 600, in: 400 }` and `createStairsFade({ setPhase, reduced, schedule, cancel })` returning `{ start, cancel, active, holding }`. `start(onDark, onDone)` goes out, then onDark, then in, then onDone. Under reduced motion both callbacks run at once and the phase only ever reads `idle`. A restart runs the old run's onDark at once if it hadn't run yet (so the newest floor is always drawn) and fires only the last onDone. `cancel()` settles to idle with each pending callback run once. A throwing callback never strands it. It imports nothing and makes no DOM or window reads.
- `#mw-fade`: a body-level, fixed, full-screen black layer at z-index 60, above the sheets at 55. At rest it has `pointer-events:none`; while `out` or `in` it takes `pointer-events:auto`, with transitions of 0.6s and 0.4s.
- The module builds it with the shared `prefersReducedMotion(window)` and a `data-phase` writer, bridged as `window.__mzStairsFade`. `settleAllMotion()` cancels it, so flipping to reduced motion mid-fade lands on the new floor.
- `dispatchWithNarration`: when the events include `floorChanged`, it sets S and starts the fade after the audio call, so the stairs clip plays under the fade-out, and before the rail card push. onDark runs `window.draw()` then `window.mzCenterMap()`. onDone runs `window.renderRail()`.
- `window.move` returns at once while `active()`; this is its first gate. Classic `draw()` returns early while `holding()`, so the old floor stays on the canvas and the marker stays put. `renderRail` hides every card while the fade runs. `stepWith` now centres only on a teleport.

### HUD-09: the full-bag find card
- `viewModels.js#dropShelfRows(c)`: `dropShelfItems(c)` mapped to `{ it, i, name, stats }`, where `stats` is `itemStatLines(it, c)` texts joined with " · ".
- `window.__mzDropShelfItems = dropShelfRows` (the module and the test sandbox). `renderDropShelf` shows `stats` first, falling back to the old armour/txt sub.
- The find card's shelf is `.shelf.mw-find-drop#find-drop-shelf`, after the found item's lines and the bag-full line, and before `#mw-rail-actions`.
- CSS: `.mw-find-drop` has `max-height:min(34vh, calc(15rem * var(--mw-text-scale)))`, `overflow-y:auto` and `overscroll-behavior:contain`, and its rows wrap (`overflow-wrap:anywhere`, no nowrap or ellipsis). `#mw-rail` is capped at `max-height:100%` of the stage and laid out as a column. The title and actions never shrink. Inside the lines column the drop region is the only flexible line (floor `5.5rem x scale`). Past that floor the lines column scrolls, so it never overlaps the actions.

## Measurements

- **Stairs clip:** `sfx/stairs.mp3` is about **2.18s** (91 MPEG frames, measured by a frame-header walk in scratch). This is much longer than the 1.0s fade. The timings stay at 600/400 as the plan directs, so the sound simply carries on into the fade-in and past it.
- **Find card fit** (headless Chrome over the real CSS and markup, a 10-item Enormous bag with long names and stat lines, a two-line narration, text size L = 1.25, the page held to 412px wide):
  - Before the flex chain (fixed cap only), with a 656px stage: the rail content was 773px, TAKE / LEAVE sat at 808-856 (off-screen), and only the whole rail scrolled.
  - Final, with a 656px stage: the title is at 115, the first line at 137, the region is 184px (556px of rows scrolling inside it), and the actions are at 688-736. Everything is in view and the rail doesn't overflow.
  - Final, with a 441px stage (extreme): the region sits at its 110px floor, the lines column scrolls, and the title, the first line and the actions (473-521) are all on screen with no overlap.
  - Final, at S (0.85): the region is capped at 204px and everything is in view.
  - The Pixel 7 device check at L remains the backstop (human-check below).

## floorChanged paths confirmed through the hook

`engine/movement.js#descend` is the sole `floorChanged` producer. It is reached from `move` (stepping onto an exit/gate tile, i.e. GO DOWN through `__mzDescend` -> `stepNow` -> `stepWith`) and from `resolveFeature` inside `resolvePendingTile` (RULES-12). `engine/engine.js#applyAction` runs `resolvePendingTile` after EVERY action, so a combat action (the killing blow or a flee), `takeAllLoot`/`leaveAllLoot`, or a find/store close can also descend. Every one of these reaches the shell through `dispatchWithNarration`, the only `dispatch(action)` call site (pinned in `shell-stairs-fade.test.js`). The dev start-at-depth run, the rolled-run commit and boot set state directly and never fade (pinned). A teleport keeps its snap (pinned).

Known edge: when a combat dispatch descends (RULES-12's exit tile resolving on the fight's last blow), the combat beat's reveal of that final round plays under the darkening. The fade-in then shows whatever the new floor presents. This follows the plan's "every floorChanged dispatch fades" truth.

## Bag-list audit (HUD-09 "the same rule applies to any other card listing N bag items")

| Surface | Lists N bag items? | Outcome |
|---|---|---|
| Rail find card, full bag (`#find-drop-shelf`) | yes | bounded `.mw-find-drop` region, stat-line rows, column-flex rail (changed) |
| Loot screen, full bag (`#loot-drop-shelf`, renderEncounter's THEY ARE DOWN) | yes | same `.mw-find-drop` class and the same rows (changed); it sits inside `#enc-body`, which already scrolls, with TAKE ALL / LEAVE ALL in the combat-over action area |
| Store "Your gear" sell list (`storeScreen.js`) | yes | unchanged: a full-screen encounter panel whose `#enc-body` scrolls. It isn't a card, so no pinned decision can be pushed away |
| Gear tab BAG cards | yes | unchanged: a full tab that scrolls |
| Joiner, hazard, dark and event rail cards | no | not applicable |
| Gear action sheet | one item | not applicable |

## Re-pinned tests (all with a Phase 78 / 78-08 comment)

- `reduced-motion.test.js`: the `DRAW_SHA256` re-pin (draw() gains exactly the hold statement). The previous digest `455c2b5f...feef3` is recorded; the new digest is `b59a98cb...a5a6`. `PAINT_SHA256` is unchanged.
- `shell-map-store-polish.test.js` and `shell-map-viewport.test.js` (f): the mzCenterMap site count goes from 4 to 5 (the fade's dark point).
- `shell-map-viewport.test.js` (m): stepWith centres only a teleport.
- `shell-arrow-pad.test.js` (c): renderRail now has three `mzSyncArrowPad` exits (the fade branch added one).
- `shell-map-rail.test.js` (o), `shell-new-best.test.js`, `foe-inspect-shell.test.js`, `status-chit-combat.test.js`: the rail hidden predicate gains `|| fadeUp`.
- `shell-clarity-43.test.js`: the import line (`dropShelfRows`), the bridge literal (`= dropShelfRows;`) and renderDropShelf's destructure (`{ it: bi, i, stats }`).
- `shell-loot-screen.test.js` needed no change: its pins survived. `rail-overlay.test.js` (5) is honoured as it stands, because the fade joined the one hidden write instead of adding a second.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned literal pins outside files_modified**
- **Found during:** Tasks 2 and 3 (the suite runs)
- **Issue:** The fade and the rows legitimately move pins in `reduced-motion`, `shell-arrow-pad`, `shell-map-store-polish`, `shell-map-viewport`, `shell-new-best`, `shell-clarity-43`, `foe-inspect-shell` and `status-chit-combat`.
- **Fix:** Each is re-pinned to the new literal with a traced comment (list above). The orchestrator's notes pre-authorised the draw() digest.
- **Commits:** b99881d4, 2b730e4c, and the Task 3 commit

**2. [Rule 1 - Bug] A fixed region cap did not keep TAKE / LEAVE on screen at L**
- **Found during:** Task 3 (the scratch fit measurement)
- **Issue:** At 412px wide and L, a 34vh cap left the actions 120px below a 656px stage.
- **Fix:** The rail became a column-flex card where only the drop region shrinks (to a floor), and the lines column scrolls past that floor. This is measured above and pinned in `find-card-full-bag.test.js` (e).
- **Files modified:** mazeworld.html, test/unit/find-card-full-bag.test.js

**3. [Rule 1 - Bug] The fade's rail hold as a second hidden write**
- **Found during:** Task 2
- **Issue:** My first draft wrote `railEl.hidden` a second time inside the fade branch. `rail-overlay.test.js` (5) guards the one-predicate rule.
- **Fix:** The fade now joins the one predicate (`fadeUp`).

## Known Stubs

None.

## TDD Gate Compliance

- Task 1: RED `205dd0d0` (test) then GREEN `da674714` (feat).
- Task 3: RED `80927e7b` (test) then GREEN in the Task 3 feat commit.

## Human check (deferred to the milestone's Pixel 7 batch)

- Take the stairs down. The screen should darken under the stairs sound, then the new floor fades in and the FLOOR card appears after it. Tap and press arrows during the fade: nothing should move.
- With Android's remove-animations setting on, you should get an instant cut and still hear the stairs sound.
- A teleport should be unchanged (a snap).
- With the biggest bag full at text size L, find a weapon. Its name, stats and TAKE IT NOW / LEAVE IT should stay visible, the drop list should scroll inside the card, and each row should show the item's stats.

## Gates (worktree, final code)

- `npm test`: **7213/7213** pass, 0 fail. An earlier run caught the two combat-card predicate pins, re-pinned in 2b730e4c.
- Parity `node --test "test/parity/**/*.test.js"`: **66/66**.
- `npm run boot:check`: **PASS** (no-uncaught, painted, graves, title). It ran over a www/ built through a temporary node_modules junction; the junction and www/ were removed afterwards and nothing from them was committed.
- No bot balance runs (user ruling 2026-09-26).

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 205dd0d0 | test(78-08): add failing tests for the stairs fade controller |
| 1 GREEN | da674714 | feat(78-08): the stairs fade controller (HUD-06) |
| 2 | b99881d4 | feat(78-08): the stairs descent fades to black under the stairs sound (HUD-06) |
| 3 RED | 80927e7b | test(78-08): add failing tests for the full-bag find card (HUD-09) |
| 2 (re-pin) | 2b730e4c | test(78-08): re-pin the rail hidden predicate in the combat-card suites (HUD-06) |
| 3 GREEN | 1fcc3048 | feat(78-08): the full-bag find card keeps the loot in view (HUD-09) |

## Self-Check: PASSED

- FOUND: src/browser/stairsFade.js, test/unit/stairs-fade.test.js, test/unit/shell-stairs-fade.test.js, test/unit/find-card-full-bag.test.js
- FOUND commits: 205dd0d0, da674714, b99881d4, 80927e7b, 2b730e4c, 1fcc3048
