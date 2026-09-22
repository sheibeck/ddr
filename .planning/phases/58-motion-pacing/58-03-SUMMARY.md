---
phase: 58-motion-pacing
plan: 03
subsystem: ui
tags: [motion, camera, map-pan, reduced-motion, fake-clock, sandbox, mazeworld.html]

# Dependency graph
requires:
  - phase: 58-motion-pacing (plan 01)
    provides: "src/browser/motion.js (prefersReducedMotion/onReducedMotionChange) and src/browser/cameraGlide.js (createCameraGlide, PAN_MS, glidePoint/easeOutCubic) — the pure cores this plan wires into the shell"
  - phase: 57-map-hud-layout-band (plan 05)
    provides: "the ☰ HUD menu's mw-chip-centre CENTRE MAP row this plan rebinds from centerMap to glideCenterMap"
provides:
  - "window.__mzCameraGlide — the bridged createCameraGlide instance the classic script's keepPartyInView/glideCenterMap/anchorCamOnParty/pointerdown all read"
  - "settleAllMotion() — the module script's single mid-session reduced-motion settle point, subscribed once via onReducedMotionChange; later Phase 58 plans append their own effect's settle call here"
  - "applyCam(p) and glideCenterMap() — the classic script's glide frame writer and the CENTRE row's glide handler"
  - "transform-based positionCanvas() (translate3d, device-pixel-rounded) with the party ring kept in lockstep from the same call"
  - "test/unit/harness/fakeClock.js — the deterministic clock (now/setTimeout/clearTimeout/requestAnimationFrame/cancelAnimationFrame/advance/pending/Date) every later Phase 58 wiring plan's animated-path tests will drive"
  - "test/unit/harness/shellSandbox.js's reduced-by-default loadShellSandbox({ doc, reducedMotion, clock }) with a REAL window.__mzCameraGlide wired"
  - "test/unit/map-pan.test.js and reduced-motion.test.js's 'pan' section — the MOTION-01/MOTION-05 behaviour proof for the camera"
affects: [58-04, 58-05, 58-06, 58-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reduced-by-default shell sandbox (test/unit/harness/shellSandbox.js) — every pre-existing sandbox test now exercises the MOTION-05 end-state path by default; an animated-path test opts in explicitly with { reducedMotion: false, clock }."
    - "A fake clock (test/unit/harness/fakeClock.js) drives timers/raf/Date.now() deterministically via advance(ms) — no shell-sandbox test ever sleeps."
    - "Glide retarget-from-in-flight-target: keepPartyInView() computes its target from window.__mzCameraGlide's own current TARGET (G.target()) rather than the displayed cam, so a mid-glide re-trigger never freezes the camera short of its original destination."
    - "Cancel-first snap/pointer discipline: anchorCamOnParty() (every snap and pinch frame) and the viewport's pointerdown handler both cancel any in-flight glide as their FIRST statement."

key-files:
  created:
    - test/unit/harness/fakeClock.js
    - test/unit/map-pan.test.js
    - test/unit/reduced-motion.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/rail-dismiss.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/perfMarks.test.js

key-decisions:
  - "BASE_58 = a01b38e08b98e36ed1939d9d1fe1538eee6237b1 (the commit that added 58-CONTEXT.md), recorded per the plan's discovery step."
  - "applyCam(p) lives next to anchorCamOnParty (not between positionCanvas and positionPartyPulse) so shell-map-viewport.test.js's positionCanvas region (sliced up to the next function, positionPartyPulse) stays a clean single-function proof with no unrelated function's body folded in."
  - "window.__mzControls is one of shellSandbox.js#wireBridges' deliberately-unwired bridges (its own header comment lists it among the three snapshot surfaces' bridges) — map-pan.test.js and reduced-motion.test.js each wire it themselves from the real src/browser/controls.js#keepInViewAxis, mirroring rail-dismiss.test.js's own established 'wire one extra bridge myself' pattern rather than expanding wireBridges' documented scope."
  - "map-pan.test.js test (6) (the pointerdown cancel) takes the plan's documented 'otherwise' route: a source-anchor proof on the real mazeworld.html, not a sandbox event-firing proof — recordingDom.js's addEventListener is an unconditional no-op and is out of this plan's files_modified; extending it risked moving shell-tab-snapshots.test.js's committed fixture output."
  - "Rule 1 fix (see Deviations): test/unit/perfMarks.test.js's PERF-01 shell pin re-pinned to recognise the new window.__mzCameraGlide `now: () => performance.now(),` line as a deliberate, always-live exception, distinct from the 7 dev-gated PERF-01 instrumentation reads it still requires."

patterns-established:
  - "Every later Phase 58 wiring plan (58-04..58-07) imports test/unit/harness/fakeClock.js and calls loadShellSandbox({ doc, reducedMotion: false, clock }) for its own animated-path tests, and { reducedMotion: true } (the default) for its reduced-motion-ledger tests."
  - "reduced-motion.test.js is the shared MOTION-05 ledger file — one section per effect, appended by each wiring plan; 58-07's own audit checks every section is present."

requirements-completed: [MOTION-01, MOTION-05]

coverage:
  - id: D1
    description: "window.__mzCameraGlide bridge (createCameraGlide, performance.now/rAF/cancelRAF, reduced: () => prefersReducedMotion(window)), settleAllMotion() and its one onReducedMotionChange subscription — bridged, documented (BRIDGE row + docs/SHELL-MODULES.md regen), and not yet read by the classic script (fail-open until Task 2)"
    requirement: "MOTION-01"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10, set-equality + doc-sync)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-no-content-copies.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "The keep-in-view nudge and the ☰ menu's CENTRE row glide over window.__mzCameraGlide's ~200ms ease-out instead of snapping; a mid-flight retrigger re-aims from the glide's own in-flight target; stairs/teleport/new run/boot keep the SNAP (centerMap/window.mzCenterMap, byte-unchanged); anchorCamOnParty and the viewport's pointerdown both cancel any in-flight glide first; the canvas moves by a device-pixel-rounded translate3d with the ring in lockstep"
    requirement: "MOTION-01"
    verification:
      - kind: unit
        ref: "test/unit/map-pan.test.js (7/7)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-viewport.test.js, shell-map-invariants.test.js, shell-map-store-polish.test.js (re-pinned, all green)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reduced motion (D-17): the nudge and glideCenterMap land cam on their targets synchronously under the default reduced sandbox; prefersReducedMotion is read LIVE (a mid-session flip lands the very next nudge instantly); the module script's camera instance/settleAllMotion/subscription are source-pinned"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js — pan section (4/4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared test infrastructure for plans 58-04..58-07: a deterministic fake clock and a reduced-by-default shell sandbox with a real camera glide wired"
    verification:
      - kind: unit
        ref: "test/unit/harness/fakeClock.js (exercised throughout map-pan.test.js/reduced-motion.test.js); test/unit/darkness-vignette.test.js, hud-bands-layout.test.js, hud-menu-layout.test.js, shell-tab-snapshots.test.js (all pre-existing sandbox consumers, unaffected)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate: npm test fail 0 (3727/3727, +14 over the 3713/3713 baseline at dispatch), npm run build:www exit 0, engine/content/test-parity diff empty against BASE_58, parity master hash unchanged, package.json/lock untouched, bridge-registry green"
    verification:
      - kind: unit
        ref: "npm test (3727/3727)"
        status: pass
      - kind: other
        ref: "npm run build:www"
        status: pass
      - kind: other
        ref: "git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/ -> empty; git hash-object test/parity/prototype-master.js.txt -> a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false
  - id: D6
    description: "On the Pixel 7, walking toward a map edge scrolls smoothly, rapid tapping never stutters, a drag started mid-glide takes over instantly, the ring stays glued to the party, and the resting map stays crisp; with Android's Remove animations on, the map moves in single jumps exactly as before"
    verification: []
    human_judgment: true
    rationale: "Real-device compositor smoothness, touch feel, and the OS-level reduced-motion toggle cannot be proven from source or a headless sandbox — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol."

# Metrics
duration: ~35min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 03: Map Pan Wiring (MOTION-01) Summary

**Wires the keep-in-view nudge and the ☰ menu's CENTRE row to `window.__mzCameraGlide`'s ~200ms ease-out tween, moves the canvas to a device-pixel-rounded `translate3d` transform with the party ring in lockstep, makes every snap/touch cancel an in-flight glide first, and lands the whole path synchronously under reduced motion — plus the fake clock and reduced-by-default sandbox every later Phase 58 wiring plan reuses.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-22 (session start, before first Read)
- **Completed:** 2026-09-22T20:37:15Z
- **Tasks:** 3
- **Files modified:** 10 (3 created, 7 modified; plus 1 out-of-plan Rule-1 fix, `test/unit/perfMarks.test.js`)

## Accomplishments

- `window.__mzCameraGlide`: a real `createCameraGlide` instance bridged from the module script (`performance.now`/`requestAnimationFrame`/`cancelAnimationFrame`, `reduced: () => prefersReducedMotion(window)`), with its BRIDGE row and a `docs/SHELL-MODULES.md` regen in the same commit.
- `settleAllMotion()` — the one module-script function every in-flight Phase 58 effect will land on when reduced motion turns on mid-session — and its single `onReducedMotionChange(window, ...)` subscription.
- Classic-script wiring: `positionCanvas()` now writes a device-pixel-rounded `translate3d` transform (CSS `will-change:transform`) instead of `left`/`top`, always finishing with `positionPartyPulse(rect)` in the same call. `applyCam(p)` is the glide's one per-frame writer. `keepPartyInView()` glides via `window.__mzCameraGlide`, computing its target from the glide's own in-flight `target()` (never a mid-glide `cam`) so a rapid re-trigger re-aims instead of freezing short. `glideCenterMap()` glides the ☰ menu's CENTRE row to the party; `centerMap()`/`window.mzCenterMap` stay the byte-identical SNAP for stairs/teleport/new run/boot. `anchorCamOnParty()` (every snap + pinch frame) and the viewport's `pointerdown` handler both cancel any in-flight glide as their first statement.
- `test/unit/harness/fakeClock.js` (new): a deterministic clock — `advance(ms)` is the only way time moves, driving timers/rAF in scheduled/frame order and a `Date` subclass whose `now()` tracks the clock.
- `test/unit/harness/shellSandbox.js#loadShellSandbox` gains `{ reducedMotion = true, clock = null }` — reduced by default (every pre-existing sandbox test keeps exercising the pre-Phase-58 synchronous path), and wires a REAL `window.__mzCameraGlide`. `rail-dismiss.test.js`'s sibling loader gets the same reduced-by-default `matchMedia` stub.
- `test/unit/map-pan.test.js` (7 tests) and `test/unit/reduced-motion.test.js`'s new "pan" section (4 tests) prove the glide, retarget, snap-cancels-glide, CENTRE-glide, pointerdown-cancels (source anchor), transform/lockstep and reduced-motion-synchronous/live-flip claims — all against a real `newRun` engine state and the fake clock, never a real sleep.
- Re-pinned (never loosened, no test dropped): `shell-map-viewport.test.js`'s `positionCanvas`/`keepPartyInView` pins now match `translate3d`/`base.x`/`base.y`/`.to(cam, target, applyCam)`; `shell-map-invariants.test.js`'s CENTRE listener pin moved to `glideCenterMap` and gained a `window.mzCenterMap = centerMap;` exactly-once pin; `shell-map-store-polish.test.js` gained an `anchorCamOnParty` cancels-first pin.
- Phase gate: `npm test` 3727/3727 (fail 0, +14 over the 3713/3713 baseline recorded at dispatch), `npm run build:www` exit 0, `engine/`/`content/`/`test/parity/` diff against BASE_58 empty, parity master hash unchanged, `package.json`/`package-lock.json` untouched, `bridge-registry.test.js` 10/10.

## Task Commits

Each task was committed atomically:

1. **Task 1: Module script — the `__mzCameraGlide` bridge, `settleAllMotion` and the one reduced-motion subscription** - `5e6775b` (feat)
2. **Task 2: Classic camera wiring — transform-based placement, glided nudge/CENTRE, cancel-first snaps and pointer** - `e4e7650` (feat)
3. **Task 3: Fake clock, reduced-by-default sandbox, `map-pan.test.js`, the pan section of `reduced-motion.test.js`, and the re-pins** - `bd4ae06` (test)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `mazeworld.html` — the `__mzCameraGlide`/`settleAllMotion` module wiring; classic `positionCanvas`/`applyCam`/`anchorCamOnParty`/`keepPartyInView`/`glideCenterMap`/pointerdown wiring; the canvas CSS `will-change:transform` rule
- `src/browser/bridge.js` — the `__mzCameraGlide` BRIDGE row (sorted before `__mzCanvasSizing`)
- `docs/SHELL-MODULES.md` — regenerated via `node tools/bridge-doc.mjs --write`
- `test/unit/harness/fakeClock.js` — new deterministic clock harness
- `test/unit/harness/shellSandbox.js` — `{ reducedMotion, clock }` params, reduced-by-default `matchMedia`, real `__mzCameraGlide` wiring
- `test/unit/rail-dismiss.test.js` — sibling `matchMedia` stub gets the same reduced-by-default behaviour
- `test/unit/map-pan.test.js` — new, 7 tests
- `test/unit/reduced-motion.test.js` — new, MOTION-05 ledger's "pan" section, 4 tests
- `test/unit/shell-map-viewport.test.js` — `positionCanvas`/`keepPartyInView` re-pins
- `test/unit/shell-map-invariants.test.js` — CENTRE listener re-pin + `mzCenterMap` snap pin
- `test/unit/shell-map-store-polish.test.js` — `anchorCamOnParty` cancels-first pin
- `test/unit/perfMarks.test.js` — Rule 1 fix (see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (BASE_58; `applyCam` placement; `window.__mzControls` wired per-test rather than in `wireBridges`; the pointerdown-cancel test's source-anchor route; the `perfMarks.test.js` re-pin).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug caused by this plan's own change] `test/unit/perfMarks.test.js`'s PERF-01 shell pin broke — a new, legitimately un-gated `performance.now(` line**
- **Found during:** Task 3's full `npm test` phase-gate run
- **Issue:** Task 1 added `now: () => performance.now(),` to the `window.__mzCameraGlide = createCameraGlide({...})` config in the module script. `test/unit/perfMarks.test.js`'s existing PERF-01 shell pin asserted EVERY `performance.now(` line in `mazeworld.html` is dev-gated behind `perf ? ` / `if (perf)`, with an exact count of 7. The camera glide's clock read is not, and can never be — the tween must keep ticking every frame regardless of whether PERF-01's dev instrumentation flag is on, so gating it behind `perf` would be a functional regression, not a fix.
- **Fix:** Re-pinned the test to separate "the 7 dev-gated PERF-01 instrumentation reads" (still required to be gated, unchanged in count) from "the one Phase 58 camera-glide clock read" (an explicit, named, always-live exception), with an updated total-line-count assertion (8, both stripped and raw).
- **Files modified:** `test/unit/perfMarks.test.js` (not in this plan's original `files_modified` list — added per the executor's Rule 1 scope, since the breakage was directly caused by this plan's own Task 1 change)
- **Verification:** `node --test test/unit/perfMarks.test.js` (22/22 passing); full `npm test` re-run green (3727/3727) after the fix.
- **Committed in:** `bd4ae06` (Task 3 commit)

**2. [Process — no code change] The applyCam(p) relocation was lost by the Task 3 teeth-check revert, then redone**
- **Found during:** Task 3's phase-gate `npm test` re-run, immediately after performing the required teeth check
- **Issue:** After committing Task 2 (which had placed `applyCam(p)` between `positionCanvas`/`positionPartyPulse`), an UNCOMMITTED follow-up edit relocated `applyCam(p)` to sit next to `anchorCamOnParty` instead (so `shell-map-viewport.test.js`'s `positionCanvas` region-slice, which runs up to the next function, stayed a clean single-function proof). That relocation was still uncommitted when Task 3's required teeth check (`git checkout -- mazeworld.html`) ran — the checkout correctly reverted the teeth mutation, but ALSO wiped the still-uncommitted relocation, since both were uncommitted changes to the same file.
- **Fix:** Redid the `applyCam(p)` relocation (byte-identical to the version that had been wiped), re-ran the full test trio to confirm, then performed and reverted the teeth check again — this time against a state where the relocation was already reflected, so nothing further was lost.
- **Files modified:** `mazeworld.html`
- **Verification:** `node --test test/unit/shell-map-viewport.test.js test/unit/shell-map-invariants.test.js test/unit/shell-map-store-polish.test.js test/unit/rail-dismiss.test.js test/unit/map-pan.test.js test/unit/reduced-motion.test.js` (111/111); full `npm test` green (3727/3727).
- **Committed in:** `bd4ae06` (Task 3 commit)

---

**Total deviations:** 2 (1 Rule-1 auto-fix outside the plan's declared file list, necessary for correctness of an existing pin; 1 self-caught process issue from the teeth-check protocol, corrected before commit — no bad state ever landed).
**Impact on plan:** No scope creep beyond the one necessary re-pin. Both deviations were caught and resolved before any commit; the final committed state matches the plan's intent exactly.

## Issues Encountered

- `--test-name-pattern` requires an `=` sign (`--test-name-pattern="stepWith"`) to actually filter under this environment's Node 22.23.2 — without it, every test in the file still runs (harmless here, since it only meant two THEN-still-broken re-pin targets showed up as failures in Task 2's own interim check; both were fixed in Task 3 as planned).
- `keepInViewAxis`'s triggered-branch return value (`partyAxis - rest + half`) does not depend on `camAxis`/`base` at all — only the trigger/no-trigger BOUNDARY does. `map-pan.test.js` test (2)'s scenario therefore needed a party position chosen so the trigger fires against `target1` but NOT against `mid1` (found via a short linear search over candidate positions, using the real `keepInViewAxis`), rather than the first "move the party further left" scenario tried (which triggered identically under both bases and had no teeth).

## User Setup Required

None - no external service configuration required.

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built.

1. On the Pixel 7, walking toward a map edge scrolls the map smoothly instead of in jumps; tapping quickly several times never stutters; a drag started mid-glide takes over instantly; the gold ring stays glued to the party throughout; the resting map is as crisp as before.
2. With Android's Remove animations turned on, the map moves in single jumps exactly as before this phase.

## Next Phase Readiness

- `window.__mzCameraGlide`, `settleAllMotion()`, `test/unit/harness/fakeClock.js` and the reduced-by-default `loadShellSandbox({ doc, reducedMotion, clock })` are all in place and reusable by plans 58-04 (panel motion), 58-05/58-06 (typewriter wiring) and 58-07 (combat beat / final audit).
- `test/unit/reduced-motion.test.js` is the shared MOTION-05 ledger file — plans 58-04..58-07 each append their own effect's section below the existing "pan" section; 58-07's own audit checks every section is present.
- No blockers.

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/fakeClock.js
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/rail-dismiss.test.js
- FOUND: test/unit/map-pan.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/shell-map-viewport.test.js
- FOUND: test/unit/shell-map-invariants.test.js
- FOUND: test/unit/shell-map-store-polish.test.js
- FOUND: test/unit/perfMarks.test.js
- FOUND: commit 5e6775b
- FOUND: commit e4e7650
- FOUND: commit bd4ae06

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*
