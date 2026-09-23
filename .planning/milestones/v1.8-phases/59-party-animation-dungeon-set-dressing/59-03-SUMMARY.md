---
phase: 59-party-animation-dungeon-set-dressing
plan: 03
subsystem: ui
tags: [party-animation, dom-sprite, css-animation, canvas-lockstep, reduced-motion, mazeworld.html]

# Dependency graph
requires:
  - phase: 59-party-animation-dungeon-set-dressing (plan 01)
    provides: "src/browser/partySprite.js — PARTY_FRAME_ICONS, IDLE_FRAME_MS/IDLE_CYCLE_MS, idleFrameDelaysMs(), spriteBoxPx()/snapToDevicePx(), spriteArt(), createPartySprite() — the pure presentation core this plan wires into the shell"
  - phase: 58-motion-pacing (plan 03/07)
    provides: "the reduced-motion predicate + settleAllMotion() mid-session settle point, the fake clock, and the reduced-by-default loadShellSandbox({ doc, reducedMotion, clock }) this plan extends"
provides:
  - "#mw-party-sprite — the DOM sprite (8 stacked frame images), the sibling of #mw-party-pulse inside .mw-maze-viewport, with its composited-only idle loop (mwpartyidle), step/fallback-art states and the .covered sibling rule"
  - "The dialled-back ring: .mw-party-pulse drops its hard 3px dark box-shadow ring, keeps a .25 halo, and gains a .28 radial glow (half the canvas's old under-party glow) that travels with the marker"
  - "draw() no longer paints the party (no drawImage/createRadialGradient/arc/fillText for it); partyShown()/positionPartySprite(rect)/positionParty() (+ window.mzPositionParty) place the sprite and ring from one lockstep canvas origin"
  - "window.__mzPartySprite — a real createPartySprite instance sharing Phase 58's one reduced-motion predicate; settleAllMotion() finishes it"
  - "test/unit/harness/shellSandbox.js#loadShellSandbox gains stubDraw=false/canvasContext options (a REAL draw() on a recording canvas context) and unconditionally wires a REAL window.__mzPartySprite"
  - "test/unit/party-sprite-shell.test.js (12 tests) and the extended reduced-motion.test.js audit section (createPartySprite in the 5-controller check, its finish() in settle-all, a 5th controller in the mid-session flip, the draw() digest re-pinned)"
affects: [59-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The canvas's old under-party radial glow moved onto the DOM ring (.mw-party-pulse's own CSS background, at half alpha) instead of staying a canvas paint — a canvas glow is drawn at the party's REAL square and cannot glide with a DOM sprite, so halving it and moving it onto the ring (which already follows the displayed point) keeps it glued to the marker through every step."
    - "One lockstep placement path: positionCanvas() computes the canvas's own device-pixel-rounded origin, then calls positionPartySprite(rect) (spriteBoxPx adds the shown-cell offset to that SAME origin, no second rounding) before positionPartyPulse(rect) (converts partyShown() to the same screen-offset formula cameraPan() used) — the sprite and the ring can never disagree with the canvas, at any dpr."
    - "partyShown() is the ONE read of where the marker is DRAWN (a gliding point mid-step, the real cell otherwise) — window.__mzPartySprite.displayed(partyCentre()) when the bridge exists, else partyCentre(); tap hit-testing keeps reading cameraPan()/partyCentre() untouched, so presentation and input never share a read path."

key-files:
  created:
    - test/unit/party-sprite-shell.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-map-hud.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/perfMarks.test.js

key-decisions:
  - "BASE_59 = f220718eadff6220cc9228b1eacab2ace5cb82ae (the commit that added 59-CONTEXT.md), confirmed per the plan's discovery step; used for the engine-gate diff and the per-file grep -c '^test(' floor."
  - "Discovery re-verification: all 7 of the plan's discovery-checklist assumptions about landed Phase 58 code (positionCanvas()'s translate3d/rounding rule and its final positionPartyPulse(rect) call, applyCam(p)'s per-frame re-place, the __mzCameraGlide construction + settleAllMotion + its one onReducedMotionChange subscription, reduced-motion.test.js's 58-07 audit section shape, loadShellSandbox's reduced-by-default signature, renderEncounter's two untouched covered toggles, and panel-motion.test.js's per-selector CSS/JS agreement test never scanning every stylesheet duration) held exactly as documented — no adaptation was needed beyond the plan's own instructions."
  - "The draw() modularity digest (reduced-motion.test.js audit test 6) is re-pinned to a NEW constant (DRAW_SHA256, replacing the old PRE58_DRAW_SHA256 name) rather than kept under the PRE58 name, since draw()'s body is no longer PRE58's — the paint() digest (PRE58_PAINT_SHA256) is untouched, since paint() itself is untouched by this plan."
  - "Task 2's draw() destructure dropped `px, py` (`const { g } = S.floor;`) since neither is read anywhere else in draw() once the party-marker block is removed — no test pins the old destructure's exact text."

patterns-established:
  - "loadShellSandbox({ ..., stubDraw = true, canvasContext = null }) — a sandbox option pair for exercising a REAL heavy classic function (draw()) on a REAL recording implementation (recordingCanvas.js's createRecordingContext()) instead of the harness's own no-op stub, mirroring the established stubRail=false precedent (rail.js's real wiring) for the same purpose."

requirements-completed: [ANIM-01, ANIM-03]

coverage:
  - id: D1
    description: "#mw-party-sprite markup (8 frames in PARTY_FRAME_ICONS order, after the ring, aria-hidden, data-art=\"static\"/data-pose=\"idle\") and its composited-only idle-loop CSS (mwpartyidle, phase-shifted by idleFrameDelaysMs()), step/fallback-art states, and the .mw-party-pulse.covered ~ .mw-party-sprite sibling rule"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite-shell.test.js (1)-(8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dialled-back ring (ANIM-03): no spread-only dark ring, a .25 halo, a .28 radial background moved from the canvas's old under-party glow; mwglow/will-change unchanged"
    requirement: "ANIM-03"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite-shell.test.js (9); test/unit/shell-map-hud.test.js (h), re-pinned"
        status: pass
    human_judgment: false
  - id: D3
    description: "draw() no longer paints the party (no drawImage/createRadialGradient/arc/fillText for it), while every seen/visible feature icon still draws at Math.round(CELL*0.75); positionCanvas() places the sprite and the ring from the SAME rounded origin at every dpr (tested at 1 and 2.625, the Pixel 7's)"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite-shell.test.js (10), (11); test/unit/shell-map-hud.test.js (i), re-pinned"
        status: pass
    human_judgment: false
  - id: D4
    description: "window.__mzPartySprite is built with the shared reduced-motion predicate and the mzPositionParty render callback; settleAllMotion() finishes it; the art-fallback decode check runs directly after the icon preload line; the BRIDGE row + docs/SHELL-MODULES.md regen land in the same commit; Phase 58's cross-effect reduced-motion audit is extended to cover the new controller"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite-shell.test.js (12); test/unit/reduced-motion.test.js audit (2)-(4); test/unit/bridge-registry.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "On the Pixel 7, the standing party gently cycles its idle frames and the old black ring is gone, leaving only a soft warm glow; with Remove animations on the marker freezes on frame 1 with a steady glow; the marker stays glued to its square while the map glides/drags/pinches and disappears under the encounter panel with no flicker"
    verification: []
    human_judgment: true
    rationale: "Real-device compositor/animation-perception and the OS-level reduced-motion toggle cannot be proven from source or a headless sandbox — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol."

# Metrics
duration: ~75min
completed: 2026-09-22
status: complete
---

# Phase 59 Plan 03: ANIM-01/03 Shell Wiring Summary

**The party marker is now a DOM sprite (`#mw-party-sprite`) with a composited CSS idle loop, placed in exact canvas-lockstep by `positionPartySprite()`/`positionCanvas()`; `draw()` no longer paints the party at all; the ring's hard dark edge is gone, replaced by a faint halo plus a half-strength radial glow (the canvas's old under-party glow, relocated so it travels with the marker) — all wired on `window.__mzPartySprite`, sharing Phase 58's one reduced-motion predicate and its `settleAllMotion()` settle point.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-09-22
- **Completed:** 2026-09-22
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **Task 1 — markup/CSS**: `#mw-party-sprite` (8 `<img class="mw-party-frame">` children in `PARTY_FRAME_ICONS` order) added as the sibling directly after `#mw-party-pulse` inside `.mw-maze-viewport`; its composited-only idle loop (`@keyframes mwpartyidle`, one shared opacity keyframe phase-shifted per frame by `idleFrameDelaysMs()`), step-pose frame-opacity rules, `data-art="static"/"none"` fallback rules, and the `.mw-party-pulse.covered ~ .mw-party-sprite` sibling rule (hide + pause, no JS change — `renderEncounter`'s two pinned `covered` toggles stay byte-identical). The ring's `box-shadow` drops its hard `0 0 0 3px #14110c` ring, keeps a `.25` halo, and gains a `background:radial-gradient(...,.28...)`.
- **Task 2 — JS wiring**: `draw()`'s whole party-marker block (the drawImage, the canvas `createRadialGradient` glow, the dot+"P" fallback) is deleted; `const { g } = S.floor;` (px/py no longer read there). `partyShown()` (the one read of where the marker is DRAWN), `positionPartySprite(rect)` (places the sprite from the canvas's own rounded origin via `window.__mzPartySprite.box`) and `positionParty()` (+ `window.mzPositionParty`, the per-frame repaint a step glide's `render` callback drives) are added directly after `positionPartyPulse`, which itself now reads `partyShown()` converted to a screen offset instead of `cameraPan()`, so the ring's new glow travels with the displayed marker. `positionCanvas()` calls `positionPartySprite(rect)` immediately before its unchanged final `positionPartyPulse(rect)`. `window.__mzPartySprite = createPartySprite({...})` is built next to `__mzCameraGlide`, sharing `reduced: () => prefersReducedMotion(window)`; `settleAllMotion()` also finishes it. The module script decodes every frame + the static fallback once (`Promise.all(img.decode())`) and sets `data-art` via `spriteArt()` right after the icon preload line. `PLAYER_MARKER_ICON` is dropped from the `window.__mzIconsApi` literal (the module still imports it directly for the decode check). The `__mzPartySprite` BRIDGE row (sorted between `__mzPartyCap`/`__mzPendingNarration`) and a `docs/SHELL-MODULES.md` regen land in the same commit; the `__mzIconsApi` row's consumer text is updated.
- **Task 3 — tests**: `test/unit/harness/shellSandbox.js#loadShellSandbox` gains `stubDraw = true`/`canvasContext = null` (a REAL `draw()` on a recording canvas context, wiring the icon pipeline + map-mark palette it reads) and unconditionally wires a REAL `window.__mzPartySprite`. `test/unit/party-sprite-shell.test.js` (new, 12 named tests) proves every markup/CSS/behaviour claim. `reduced-motion.test.js`'s audit section gains `createPartySprite(` in the four-controllers check (now five), `window.__mzPartySprite?.finish?.();` in the settle-all body check, a real party-sprite controller in the mid-session flip test (asserted idle at its exact target after the same five settle calls), and a re-pinned `draw()` digest (`DRAW_SHA256`, replacing `PRE58_DRAW_SHA256` — `paint()`'s `PRE58_PAINT_SHA256` is untouched, since `paint()` is untouched). `shell-map-hud.test.js`'s (h)/(i) pins move to the new ring CSS and the new draw() needle/absence lists (the four party-marker needles moved to must-not-include).
- Phase gate: `npm test` 3859/3859 (fail 0, +12 over the 3847/3847 baseline recorded at dispatch); `npm run build:www` exit 0; `git diff --stat f220718..HEAD -- engine/ content/ test/parity/` empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `package.json`/`package-lock.json` untouched; `bridge-registry.test.js` green; `node tools/shell-sweep.mjs orphans` lists none of `partyShown`/`positionPartySprite`/`positionParty`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Markup and CSS — the sprite, its composited idle loop, the step and fallback states, the covered rule, and the dialled-back ring** - `ac5d7af` (feat)
2. **Task 2: JS — the canvas stops drawing the party; the sprite and ring are placed from one displayed point; the __mzPartySprite bridge with art detection and settle** - `dd75d87` (feat)
3. **Task 3: party-sprite-shell.test.js, the sandbox's real-draw option, the audit extension and the exact re-pins** - `dfc7ee7` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `mazeworld.html` — the sprite markup + CSS, the ring's new declarations, `draw()`'s party block removed, `partyShown()`/`positionPartySprite()`/`positionParty()`, `positionCanvas()`/`positionPartyPulse()` wiring, `window.__mzPartySprite`, `settleAllMotion()`, the module's art-decode block
- `src/browser/bridge.js` — the `__mzPartySprite` BRIDGE row; the `__mzIconsApi` row's consumer text updated
- `docs/SHELL-MODULES.md` — regenerated via `node tools/bridge-doc.mjs --write`
- `test/unit/harness/shellSandbox.js` — `stubDraw`/`canvasContext` options, the unconditional real `__mzPartySprite` wiring
- `test/unit/party-sprite-shell.test.js` — new, 12 tests
- `test/unit/reduced-motion.test.js` — audit tests (2)/(3)/(4) extended, test (6)'s draw() digest re-pinned
- `test/unit/shell-map-hud.test.js` — (h)/(i) re-pinned to the new ring CSS and draw() needle/absence lists
- `test/unit/perfMarks.test.js` — PERF-01 shell pin re-pinned (Rule 1, see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (BASE_59; the full discovery re-verification; the `DRAW_SHA256` rename away from `PRE58_DRAW_SHA256`; dropping `px, py` from `draw()`'s destructure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - bug caused directly by this plan's own Task 2 change, in a file outside Task 2/3's declared file list] `test/unit/perfMarks.test.js`'s PERF-01 shell pin broke — a new, legitimately un-gated `performance.now(` line**

- **Found during:** Task 2's own verification pass (re-confirmed by Task 3's full `npm test` run)
- **Issue:** Task 2 added `now: () => performance.now(),` to `window.__mzPartySprite = createPartySprite({...})` in the module script — the party-sprite step glide's clock, which (like the Phase 58 camera-glide/typewriter clocks before it) must keep ticking regardless of PERF-01's dev instrumentation flag, so it can never be gated behind `perf ? `/`if (perf)` like the seven real PERF-01 reads. `perfMarks.test.js`'s existing shell pin asserted an exact total of 9 `performance.now(` lines (7 dev-gated + the one shared "live clock" exception string, which already covered both the camera-glide and typewriter lines by literal-substring match) — the new third live-clock line raised the true total to 10, breaking the exact-count assertion (the literal-match exception logic itself needed no change).
- **Fix:** Re-pinned both count assertions (`strippedLines.length`/`rawLines.length`) from 9 to 10, extended the test title and its in-line comment to name Phase 59/`window.__mzPartySprite` as the third live-clock exception.
- **Files modified:** `test/unit/perfMarks.test.js` (not in this plan's declared `files_modified` list — added per Rule 1, since the breakage was directly caused by this plan's own Task 2 change)
- **Verification:** `node --test test/unit/perfMarks.test.js` (22/22 passing); full `npm test` re-run green (3859/3859) after the fix.
- **Committed in:** `dd75d87` (Task 2 commit)

---

**Total deviations:** 1 (a Rule-1 re-pin outside the plan's declared file list, directly caused by this plan's own Task 2 change, mechanical and same-semantics — no test loosened or dropped).
**Impact on plan:** No scope creep. `grep -c '^test('` held (22→22) for the one touched file outside the plan's declared list.

### Teeth Checks (run AFTER Task 3's commit `dfc7ee7`, per this run's teeth-check-safety convention)

1. **Lockstep at rest (D-01).** Pre-check `git diff --quiet -- mazeworld.html` exited 0. Temporarily changed `positionPartySprite`'s `sp.box({...})` call to pass `dpr: 1` unconditionally instead of the real `devicePixelRatio`. `node --test --test-name-pattern="\(11\)" test/unit/party-sprite-shell.test.js` → **test (11) FAILED** as expected (the sprite's `translate3d` no longer matched the canvas's rounded origin at `dpr` 2.625). Reverted via `git checkout -- mazeworld.html`; confirmed clean (`git diff --quiet`) and green again (test 11 passes).

## Issues Encountered

None beyond the one auto-fixed deviation above, caught within Task 2's own verification pass and folded into that task's commit.

## User Setup Required

None — no external service configuration required.

## Human Verification — Phase 60 batched Pixel 7 checklist (this plan's items)

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built.

1. On the Pixel 7, the standing party gently cycles its idle frames (about one breath a second), reads as the highlight on its own, and the old black ring is gone, leaving only a soft warm glow.
2. With Android's Remove animations on, the standing party shows its first idle frame, still, with a steady glow.
3. The marker stays glued to its square while the map glides, drags and pinches, and disappears under the encounter panel with no flicker when a fight opens.

## Next Phase Readiness

- `window.__mzPartySprite`, `partyShown()`, `positionPartySprite(rect)`/`positionParty()` (+ `window.mzPositionParty`) are all in place and ready for Plan 59-04 to wire the step trigger: a classic `glideParty(from)` calling `window.__mzPartySprite.stepTo`, with `render: () => window.mzPositionParty?.()` (already wired here) repainting each glide frame.
- **Known latent bug reminder (carried from 59-01, not touched by this plan):** `cameraGlide.js`'s `step()` reads its own closed-over `run` immediately AFTER calling its `apply` callback — a synchronous `glide.cancel()`/`glide.finish()` call from WITHIN a render/apply callback throws. `createPartySprite` already guards its own case (the `inOnPoint`/`endGlide` pattern from 59-01). Plan 59-04's `glideParty` wiring must not introduce a new reentrant cancel/finish call from inside a render/apply callback.
- No blockers. Engine/content/test-parity gate is clean against `f220718`; `npm test` 3859/3859; `npm run build:www` exit 0; `bridge-registry.test.js` green.

---
*Phase: 59-party-animation-dungeon-set-dressing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/party-sprite-shell.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/shell-map-hud.test.js
- FOUND: test/unit/perfMarks.test.js
- FOUND: commit ac5d7af
- FOUND: commit dd75d87
- FOUND: commit dfc7ee7
