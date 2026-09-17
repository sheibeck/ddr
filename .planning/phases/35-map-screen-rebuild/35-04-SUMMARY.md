---
phase: 35-map-screen-rebuild
plan: 04
subsystem: ui
tags: [vanilla-js, tap-to-step, hold-inspect, pinch, dpad-retirement, stair-down-gate, major-overlay, keyboard, source-assertion-tests]

# Dependency graph
requires:
  - phase: 35-01
    provides: "src/browser/tapStep.js (resolveStep/inspectCell/HOLD_MS/TAP_MAX_TRAVEL_PX/DIR_VECTORS) — the pure step-resolution/hold-inspect module this plan wires into the viewport"
  - phase: 35-02
    provides: "railLocked()/railPulse()/window.mzRailLine, the global movement lock this plan's tapStep()/openCampSheet-style gates extend"
  - phase: 35-03
    provides: "the finished map chrome (.mw-map-chips, window.__mzMapMarks) this plan's inspectAt()/tap pipeline builds against"
  - phase: 34-03
    provides: "renderMajorOverlay(host, spec) — reused UNMODIFIED for THE STAIR DOWN"
provides:
  - "The rewritten viewport pointer pipeline: tapStep(clientX, clientY) (dominant-axis-then-fallback step resolution via tapStep.js's resolveStep, gated on hasActiveEncounter()/railLocked()) and inspectAt(clientX, clientY) (the four hold-inspect cards, no dispatch)"
  - "The tap/hold gesture tracker in initMazeViewportControls' pointer pipeline (450ms hold timer, 10px travel cap, multi-finger cancels the hold) alongside the untouched Phase 33 pan/pinch mechanics; window.__mzTapStep bridges tapStep.js beside window.__mzControls"
  - "The D-pad, its control bar (.mazefoot), CSS and click listener are fully retired — zero dpad/data-dir/mazefoot occurrences anywhere in mazeworld.html, code or comments; keyboard arrows/WASD remain for desktop"
  - "ZOOM_MAX re-ranged 2.4 -> 2.0 (0.6-2.0 pinch range per the mock); the 0.8 default is unchanged"
  - "The stair-down gate (decision 5): stepTargetsExit(dir) is a read-only pre-dispatch peek; engineMove shows THE STAIR DOWN (window.__mzStair + renderEncounter()) before any dispatch when the target square is exit/gate; window.__mzDescend (GO DOWN) calls the identical stepNow(dir) every step uses; NOT YET clears the flag and rides the existing settle-window dismissal transition"
  - "renderEncounter's stair branch (first branch, before death/won/beats), MAP_COPY.stair, the keydown Enter/Escape mirror, and the three back-button getGameContext edits (hasOpenModal/isAtRoot/closeModal) covering the stair overlay and the MARKS/MAKE CAMP sheets"
  - "test/unit/shell-map-viewport.test.js (25 tests) + re-pinned shell-gear-toolbar.test.js/shell-map-store-polish.test.js/shell-map-hud.test.js"
affects: [35-05-executor-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The stair-down gate is a SHELL pre-dispatch interception, not an engine flag: engine/movement.js#move descends unconditionally and synchronously the instant the party steps onto an exit/gate tile, so the shell peeks at the target square (stepTargetsExit) BEFORE calling stepNow — the same 'nothing resolves before confirmation' rule as the Fight! gate, achieved by a different mechanism than combat.pending because there is no engine-side pending state to read for a descent"
    - "The viewport's single-finger gesture tracker (gesture = {id,x0,y0,travel,multi,holdFired,holdTimer}) lives alongside — never replaces — the pre-existing pts/pointerStart/pinch pan-and-pinch state; a second finger arriving mid-gesture flips gesture.multi and cancels the hold timer rather than tearing the gesture object down, so the one-finger hand-off after a pinch (pre-existing Phase 33 code) still works unmodified"
    - "window.__mzStair (presentation-only, { dir } | null) follows the exact window.__mzRail/__mzFightEnd/__mzCombatMenu precedent — never a field on S/state, since serializeRun spreads S wholesale"

key-files:
  created:
    - test/unit/shell-map-viewport.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "Decision 5 (descent gate = SHELL pre-dispatch interception) landed exactly as specified: stepTargetsExit(dir) peeks read-only at the target square; engineMove's five-statement sequence is hasActiveEncounter() -> encounterSettled() -> railLocked() -> stepTargetsExit(dir) -> stepNow(dir); window.__mzDescend clears the flag and calls the SAME stepNow(dir) every step uses (identical engine call, identical rng); NOT YET's re-render flips hasActiveEncounter() true->false, riding the existing dismissal transition's settle-window stamp with zero extra code."
  - "Ruling 2 (tap to move replaces the arrows) landed exactly as specified: the D-pad/.mazefoot/its CSS/its click listener are gone without a trace (zero dpad/data-dir/mazefoot anywhere, including comments — every stale prose reference to 'the D-pad'/'dpad clicks' was reworded); keyboard arrows/WASD are untouched and still funnel through window.move."
  - "Ruling 3 / decision 2 (global lock) landed exactly as specified: tapStep() checks railLocked() before any resolveStep call and pulses the pending card via railPulse() instead of stepping — the same check window.move's engineMove already performs for keyboard/any other movement path."
  - "Claude's discretion items landed exactly as specified: the hold detector is a 450ms setTimeout armed at pointerdown (never a transition/animation-completion listener, since prefers-reduced-motion zeroes those); ZOOM_MAX re-ranged to 2.0 with the 0.8 default unchanged; controls.js's classifyPointerGesture/TAP_MAX_DURATION_MS (350ms) stay untouched and unused by the new tap/hold boundary (HOLD_MS 450ms is a separate constant)."

requirements-completed: [MAP-02, MAP-05, MAP-08]

coverage:
  - id: D1
    description: "tapStep(clientX, clientY) resolves one adjacent step toward the tapped square (dominant axis, fallback axis, both-blocked -> NO WAY THAT DIRECTION, own square -> YOU ARE HERE) gated on hasActiveEncounter()/railLocked() before any dispatch, then funnels through the existing window.move"
    requirement: "MAP-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(d) tapStep(): the guard/lookup/resolve/branch order..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(d) tapStep(): never mutates S.floor.px/py, never dispatches directly"
        status: pass
    human_judgment: false
  - id: D2
    description: "inspectAt(clientX, clientY) reports the four hold-inspect cards (UNWALKED/SOLID ROCK/mark legend/EMPTY CORRIDOR) with zero dispatch; the pointer pipeline's gesture tracker (450ms hold timer, 10px travel cap) drives it while the untouched Phase 33 pan/pinch mechanics (0.6-2.0 clamp, one-finger hand-off after a pinch) keep working"
    requirement: "MAP-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(e) inspectAt(): looks up the cell, builds the hold-inspect card..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(f) viewport region: the gesture tracker..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(f) viewport region: the four Phase 33 pan/pinch literals are byte-intact"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D-pad, its control bar, its CSS and its click listener are gone without a trace; keyboard arrows/WASD still move on desktop and are refused (pulse) while a rail decision or obstacle is pending"
    requirement: "MAP-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(a) raw file: zero dpad/data-dir/mazefoot occurrences..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(h) keydown: arrows still resolve through dirKeys into move()"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stepping toward the stair shows THE STAIR DOWN before any dispatch; GO DOWN performs the identical stepNow(dir) dispatch every step uses; NOT YET closes the overlay under the settle window; keys (Enter/Escape) and the hardware back button honour it; the encounter gate and out-of-combat death overlay are untouched; renderMajorOverlay is reused byte-identical"
    requirement: "MAP-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(g) engineMove: the exact five-statement sequence..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(g) renderEncounter: the stair branch is the first branch..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(g) renderMajorOverlay(body call-site count is 2..."
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(h) keydown: the stair block clicks the two overlay button ids..."
        status: pass
    human_judgment: false
  - id: D5
    description: "The hardware back button closes the stair overlay or an open sheet as a modal but can never skip a rail decision (MAP-08); the stair overlay's copy passes the BANNED voice scan"
    requirement: "MAP-08"
    verification:
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(i) getGameContext: hasOpenModal/isAtRoot/closeModal all honour the stair overlay and the two sheets"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js#(k) MAP_COPY.stair is clear of BANNED terms..."
        status: pass
    human_judgment: false
  - id: D6
    description: "Full regression: npm test, npm run build:www, and the engine/content/parity diff stay green; the parity golden-master hash is unchanged; mzCenterMap call sites stay at 10"
    verification:
      - kind: unit
        ref: "npm test — 2133/2133, 0 fail (2109 baseline + 25 new - 1 retired mazefoot test)"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0, www/src/browser/tapStep.js present"
        status: pass
      - kind: other
        ref: "git diff --stat -- engine content test/parity — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On-device verification of tap-to-step, hold-inspect, drag/pinch, the stair overlay, and the back-button/keyboard mirrors on a Pixel 7 (deferred per the project's protocol)"
    human_judgment: true
    rationale: "Touch/pointer gesture feel (dominant-axis step choice against real corridor geometry, hold-timer feel, pinch smoothness, glyph legibility at the ⧗ crevice mark, the stair overlay's near-black fade and settle-window swallow) cannot be verified by source-assertion tests alone — requires a real device pass, batched at end of run per the Deferred UAT protocol."

# Metrics
duration: ~45min
completed: 2026-09-16
status: complete
---

# Phase 35 Plan 04: Viewport Pointer Model + Stair-Down Gate Summary

**Tap-to-step (dominant-axis-then-fallback) and hold-to-inspect replace the D-pad on the map viewport; a shell pre-dispatch interception shows THE STAIR DOWN before the engine's unconditional descend can fire, with GO DOWN dispatching the identical stepNow(dir) every step uses — 25 new source-assertion tests, zero engine/content/parity edits.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-16 (approx., immediately after 35-03)
- **Completed:** 2026-09-16T22:33:37-04:00
- **Tasks:** 3
- **Files modified:** 5 (1 core + 1 new test file + 3 re-pinned test files)

## Accomplishments

- **Viewport pointer model** — `tapStep(clientX, clientY)` resolves one adjacent step toward the tapped square via `tapStep.js`'s `resolveStep` (dominant axis, fallback axis, `NO WAY THAT DIRECTION` when both are blocked, `YOU ARE HERE` on the party's own square), gated on `hasActiveEncounter()`/`railLocked()` before any dispatch and always funneling through the existing `window.move`. `inspectAt(clientX, clientY)` builds the four hold-inspect cards (UNWALKED/SOLID ROCK/mark legend/EMPTY CORRIDOR) with zero dispatch.
- **Gesture tracker** — `initMazeViewportControls`'s pointer pipeline gained a single-finger tap/hold tracker (a 450ms `setTimeout` armed at pointerdown, 10px travel cap, cancelled by a second finger or excess travel) living alongside — never replacing — the untouched Phase 33 pan/pinch mechanics (the four pinned literals: `wasPinch`, the pinch-end recenter, the zoom-scale math, `pointerup` wiring). A `contextmenu` listener prevents the browser/WebView long-press menu.
- **D-pad retirement** — the control bar (`.mazefoot`), the D-pad grid/buttons, their CSS, and their click listener are gone; every stale prose mention of "the D-pad"/"dpad clicks" elsewhere in the file (comment blocks near the enc-panel markup, `initMazeViewportControls`'s header comment, the module-script doc comments) was reworded — `dpad`/`data-dir`/`mazefoot` occur zero times anywhere in `mazeworld.html`, code or comments.
- **ZOOM_MAX** re-ranged `2.4 -> 2.0` (the mock's 0.6-2.0 pinch spec); the `0.8` default is unchanged.
- **The stair-down gate (decision 5)** — `stepTargetsExit(dir)` is a read-only peek at the target square's `feat` (`"exit"`/`"gate"`); `window.move`'s `engineMove` shows `window.__mzStair = { dir }` + `renderEncounter()` (THE STAIR DOWN, via the byte-unmodified `renderMajorOverlay`) instead of dispatching when the target is a descent tile; `window.__mzDescend` (GO DOWN) clears the flag and calls the identical `stepNow(dir)` every step uses; NOT YET clears the flag and re-renders, riding the pre-existing dismissal transition's settle-window stamp and recenter with zero new code.
- **Keys and the back button** — Enter/Space = GO DOWN, Escape/Backspace = NOT YET on the stair overlay (mirroring the combat MAJOR OVERLAY's own key handling); the hardware back button's `getGameContext` now treats the stair overlay and the MARKS/MAKE CAMP sheets as modals it can close, while never touching a pending rail decision.
- 25 new tests in `test/unit/shell-map-viewport.test.js` (exceeding the plan's 14-test minimum) plus three re-pinned suites.

## Task Commits

Each task was committed atomically:

1. **Task 1: Viewport pointer model (tap/hold/drag/pinch), tapStep + inspectAt, D-pad retirement, ZOOM_MAX 2.0, the tapStep bridge** - `e4889cf` (feat)
2. **Task 2: The stair-down gate (stepTargetsExit pre-dispatch interception, window.__mzStair/__mzDescend, the overlay branch, Enter/Escape, back-button modal context, MAP_COPY.stair)** - `2d504b6` (feat)
3. **Task 3: shell-map-viewport.test.js + re-pin shell-gear-toolbar (control bar gone) and shell-map-store-polish (zoom clamp)** - `0f148a3` (test)

**Plan metadata:** (this commit) `docs: complete 35-04 plan`

## Files Created/Modified

- `mazeworld.html` - `tapStep(clientX, clientY)`/`inspectAt(clientX, clientY)`, the rewritten `initMazeViewportControls` gesture pipeline, retired D-pad/control-bar (markup/CSS/listener/comments), `ZOOM_MAX = 2.0`, `window.__mzTapStep` bridge, `stepTargetsExit(dir)`, `window.__mzStair`/`window.__mzDescend`, `engineMove`'s stair clause, `renderEncounter`'s stair branch, `MAP_COPY.stair`, the keydown stair-key mirror, the three `getGameContext` back-button edits
- `test/unit/shell-map-viewport.test.js` - new, 25 tests: (a) D-pad retirement, (b) ZOOM constants, (c) tapStep.js bridge, (d) tapStep() order/purity, (e) inspectAt() order/purity, (f) the pointer pipeline's gesture tracker + intact Phase 33 literals, (g) the stair gate (stepTargetsExit/engineMove sequence/__mzDescend/hasActiveEncounter/renderEncounter branch order/renderMajorOverlay untouched), (h) keys, (i) the back button, (j) guard-timing invariants, (k) voice scan, (l) BEHAVIOUR against the real tapStep.js
- `test/unit/shell-gear-toolbar.test.js` - dropped `mazefootMarkup()`/its control-bar test and the `.mazefoot` CSS assertions (the control bar this plan retired)
- `test/unit/shell-map-store-polish.test.js` - `ZOOM_MAX` pin re-pinned `2.4 -> 2.0`
- `test/unit/shell-map-hud.test.js` - `(h) chrome` region's end marker re-pinned from the retired `<div class="mazefoot">` literal to `<section class="mw-overlay"` (collateral fix, not in this plan's file list — see Deviations)
- `test/unit/shell-map-rail.test.js` - `(j.2) lock` re-pinned to include the new `stepTargetsExit` clause in `engineMove`'s pinned five-statement shape (collateral fix, not in this plan's file list — see Deviations)

## Decisions Made

See `key-decisions` in frontmatter. Decision 5, ruling 2, ruling 3/decision 2, and every "Claude's discretion" item landed exactly as the plan specified, with no deviation from the design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/shell-map-rail.test.js`'s `(j.2) lock` test broke as a direct consequence of Task 2's `engineMove` change**
- **Found during:** Task 2's full-suite regression run (this file is not in Plan 04's own `<files>` list)
- **Issue:** 35-02 pinned `engineMove`'s exact statement sequence ending `... railLocked() { ...; return; } stepNow(dir);`. Task 2 inserts the `stepTargetsExit(dir)` clause between `railLocked()` and `stepNow(dir)`, so the old literal regex no longer matched.
- **Fix:** Re-pinned the regex to include the new stair clause, matching Task 2's own literal engineMove shape.
- **Files modified:** `test/unit/shell-map-rail.test.js`
- **Verification:** `node --test test/unit/shell-map-rail.test.js` — 16/16 pass.
- **Committed in:** `2d504b6` (bundled with Task 2's own commit — a direct, obviously-correct consequence of the same change)

**2. [Rule 1 - Bug] `test/unit/shell-map-hud.test.js`'s `(h) chrome` region-slice broke as a direct consequence of Task 1's control-bar deletion**
- **Found during:** Task 1's full-suite regression run (this file is not in Plan 04's own `<files>` list)
- **Issue:** The `(h) chrome` test sliced the viewport-chrome region from `<div class="mw-map-chips" ...>` through `<div class="mazefoot">` — the latter is exactly the markup this plan retires.
- **Fix:** Re-pointed the end marker to `<section class="mw-overlay"` (the next markup landmark after the party-pulse ring), mirroring the identical fix already applied to `shell-gear-toolbar.test.js`'s own `chipsMarkup()` helper.
- **Files modified:** `test/unit/shell-map-hud.test.js`
- **Verification:** `node --test test/unit/shell-map-hud.test.js` — 19/19 pass.
- **Committed in:** `0f148a3` (bundled with Task 3's own commit — a direct, obviously-correct consequence of Task 1's markup deletion)

### Documented, not fixed

**3. [Cosmetic] The plan's own `indexOf`-ordering acceptance check for the stair branch collides with a pre-existing, already-documented dead-code literal**
- **Found during:** Task 2 self-check against the plan's acceptance criteria
- **Issue:** The plan's acceptance script computes plain `s.indexOf('if (window.__mzStair && !S.combat && !S.dead && !S.won) {')` vs. plain `s.indexOf('if (S.dead) {')` over the WHOLE file and expects the former to be smaller. There are two `if (S.dead) {`-shaped literals in the file: the real `renderEncounter` death branch (correctly AFTER the new stair branch, as required) and an unrelated, pre-existing dead-code occurrence inside the OLD classic (pre-engine-routing, now-superseded) `move()` function near line 3326 — which sits EARLIER in the file than anything in `renderEncounter`. This is the exact same collision 35-02-SUMMARY.md already documented and deliberately left unfixed (that plan's own `if (S.dead) {` guard-count criterion).
- **Why not fixed:** The dead classic `move()` function is out of every Phase 35 plan's scope; editing it solely to dodge a coincidental substring collision would be an unjustified, unrelated change. The real, scoped claim — the stair branch precedes the death branch INSIDE `renderEncounter` — is correctly proven both by this plan's own `test/unit/shell-map-viewport.test.js#(g) renderEncounter: the stair branch is the first branch...` (which scopes its `indexOf` search to the `renderEncounter` region, not the whole file) and by manual `grep -n` confirmation (stair branch at line 5663, real death branch at line 5682, both well after the unrelated dead-code line).
- **Verification:** `test/unit/shell-map-viewport.test.js`'s `(g)` test passes; `grep -n "if (S.dead) {" mazeworld.html` shows the two occurrences and their line numbers, confirming the real branch ordering is correct.

---

**Total deviations:** 3 (2 auto-fixed collateral test breakage under Rule 1, 1 documented-not-fixed pre-existing false-negative inherited from 35-02)
**Impact on plan:** Both auto-fixes were necessary, direct, obviously-correct consequences of this plan's own scoped changes to files this plan modifies (`mazeworld.html`) breaking tests in files this plan does not list — no scope creep, no unrelated work. The documented item is a pre-existing, out-of-scope cosmetic false-negative with zero effect on real behavior, already accepted as a precedent by 35-02.

## Issues Encountered

None beyond the three items above (all resolved/documented in the same task, no separate fix commit needed for any).

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

No device check was run for this plan (per the project's Deferred UAT protocol — autonomous runs batch device checks at milestone close). The following Pixel 7 checks are queued for the end-of-run batch:

1. No D-pad anywhere on the map screen. A tap two squares east of the party steps one square east. A tap up-and-right where the eastern square is rock steps north instead (fallback axis). A tap where both candidate directions are rock shows NO WAY THAT DIRECTION (dull tone) and the party does not move. A tap on the party's own square shows YOU ARE HERE.
2. Hold a square for about half a second (no finger travel) — UNWALKED (fogged square) / SOLID ROCK (seen wall) / the mark's legend name + description (a seen feature) / EMPTY CORRIDOR (seen, walked, featureless) appears in the rail and the party does not move. Releasing after a hold fires does not additionally step.
3. Drag pans the map and the party marker stays visually put relative to the corridor beneath it. Pinch zooms smoothly between fully zoomed-out and 2x, recentring the map on release. A step taken after panning away recentres the viewport on the party.
4. Walk toward a trap/wall/crevice while a Joiner or find card is pending in the rail — the card pulses and nothing happens (the tap-to-step gate, ruling 3).
5. Step toward the ▼ stairs-down tile — the screen goes near-black with a large ▼, THE STAIR DOWN, the "Floor N+1 is colder, longer..." line, and GO DOWN / NOT YET buttons. NOT YET returns to the same square with nothing changed, and a tap within about a quarter second of the overlay closing is silently swallowed (the settle window). GO DOWN descends and FLOOR N+1 appears in the rail. A tap within 250ms of the overlay first appearing is swallowed (the arm window).
6. With a keyboard: arrows still move the party; Enter on the stair overlay triggers GO DOWN; Escape triggers NOT YET.
7. The Android hardware back button closes the stair overlay (as NOT YET would) and closes an open MARKS/MAKE CAMP sheet, but does nothing to a pending Joiner/find/climb rail card (it can never be skipped by the back button).
8. With reduced motion enabled system-wide, the stair overlay appears without a fade transition and both its buttons respond correctly once the arm window has elapsed.

## Next Phase Readiness

- Plan 05 (the executor gate / phase close) can build directly against this plan's finished interaction model — the tap-to-step pipeline, the stair-down gate, and every guard/back-button edit are all source-provable and test-covered.
- No blockers. `npm test` 2133/2133; `npm run build:www` exit 0 (`www/src/browser/tapStep.js` present); `git diff --stat -- engine content test/parity` empty; the parity golden-master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` is unchanged; `dpad`/`data-dir`/`mazefoot` occur zero times anywhere in `mazeworld.html`; `mzCenterMap` call sites stay at 10; `renderMajorOverlay`'s own function body is byte-identical to before this plan.

---
*Phase: 35-map-screen-rebuild*
*Completed: 2026-09-16*
