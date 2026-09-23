---
phase: 59-party-animation-dungeon-set-dressing
plan: 01
subsystem: ui
tags: [party-animation, motion, camera-glide, canvas-lockstep, pure-module]

# Dependency graph
requires:
  - phase: 58-motion-pacing
    provides: "src/browser/cameraGlide.js (PAN_MS, createCameraGlide — the retargetable, cancellable 200ms ease-out tween this plan's step glide is built on) and src/browser/motion.js (prefersReducedMotion, the one reduced-motion predicate the shell will inject)"
provides:
  - "src/browser/partySprite.js: PARTY_FRAME_ICONS, IDLE_FRAMES/IDLE_FRAME_MS/IDLE_CYCLE_MS, STEP_FRAMES/STEP_GLIDE_MS (= PAN_MS), idleFrameDelaysMs(), stepFrameAt(), snapToDevicePx(), spriteBoxPx(), spriteArt(), createPartySprite() — the party marker's complete pure presentation core (timing schedule, canvas-lockstep placement math, art fallback, retargetable step-glide controller)"
affects: [59-03, 59-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, clock-free, DOM-free src/browser/ module composing a Phase 58 primitive (createCameraGlide) rather than retyping a second easing/duration — STEP_GLIDE_MS is literally PAN_MS, imported"
    - "Reentrancy guard around a landed dependency's own callback-then-touch-closure-state pattern: an inOnPoint flag (endGlide helper) skips a real glide.cancel()/finish() call when this module's own callback is executing INSIDE that dependency's call stack, settling only local state instead — avoids mutating a peer module out from under itself without needing to modify that peer module"

key-files:
  created:
    - src/browser/partySprite.js
    - test/unit/party-sprite.test.js
  modified: []

key-decisions:
  - "BASE_59 = f220718eadff6220cc9228b1eacab2ace5cb82ae (the commit that added 59-CONTEXT.md), recorded per the plan's discovery step; used for every engine-gate diff in this phase."
  - "Landed-API adaptation (discovery step 2/3, re-verified): cameraGlide.js's step() (Phase 58, out of this plan's scope to modify) reads its own closed-over `run` again immediately AFTER its `apply` callback returns (`run.frame = raf(step)`, non-landing branch). A reentrant `glide.cancel()`/`glide.finish()` call from WITHIN that callback nulls `run` out from under that line and throws `Cannot set properties of null`. This is reachable two ways this plan's own behavior surfaces: (a) a throwing `render` callback mid-flight, and (b) more importantly, `displayed()`'s T-59-01 self-heal path called reentrantly from inside the shell's real render callback (a teleport/floor-change detected on the very next in-flight animation frame — exactly the scenario the threat register names). Fixed with an `inOnPoint` guard (the `endGlide` helper): while this module's own callback is executing inside cameraGlide's call stack, `endGlide` clears only this controller's own state instead of calling the real glide method. Nothing is lost externally — the controller's own `run` going null makes every future tick for the stale glide a no-op immediately, the background glide finishes itself invisibly on its own schedule, and any later `stepTo()` supersedes it safely regardless (cameraGlide's own `to()` always cancels its prior frame first). Pinned by two regression tests (a mid-flight throwing render, and a reentrant self-heal from within an active render callback) neither of which the plan's 12 literal behavior bullets explicitly named, but both of which are required for T-59-01's mitigation to actually hold at runtime against the landed cameraGlide.js."
  - "All 5 discovery assumptions (cameraGlide.js's exports/behavior, fakeClock's API, positionCanvas()'s rounding rule) were re-verified directly against the landed Phase 58 code and held exactly as documented in 59-01-PLAN.md's discovery section — no other adaptation was needed."
  - "Task 1 and Task 2 were each committed as their own RED-free single feat commit (the pure-math functions and their tests together, then createPartySprite and its tests together) rather than a separate test-then-implementation RED/GREEN pair — this plan's frontmatter does not set `type: tdd` at the plan level (only per-task `tdd=\"true\"`), and each task's own <action> describes building the implementation and its tests together, one commit per task, matching the plan's own Task Commits table shape."

patterns-established:
  - "STEP_GLIDE_MS = PAN_MS (imported, never retyped) as the pattern for a dependent animation matching an existing Phase 58 duration exactly by construction, so the two can never drift apart."
  - "A `box: spriteBoxPx` field on a controller's returned API, exposing a pure helper function unchanged, so callers needing the raw math (e.g. for a non-glide render, or a test) don't need a second import."

requirements-completed: [ANIM-01, ANIM-02]

coverage:
  - id: D1
    description: "src/browser/partySprite.js — the idle frame schedule (4 frames, 280ms each, 1120ms cycle) and its CSS phase-shift delays ([0,-840,-560,-280]), tiling the loop with no gap/overlap"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite.test.js (constants, idleFrameDelaysMs tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "stepFrameAt/snapToDevicePx/spriteBoxPx — the step-glide frame mapping and canvas-lockstep placement math, matching positionCanvas()'s own rounding rule exactly"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite.test.js (stepFrameAt, snapToDevicePx, spriteBoxPx tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "spriteArt — the frames/static/none art-fallback choice so the party marker is never invisible"
    requirement: "ANIM-01"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite.test.js (spriteArt tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "createPartySprite — the retargetable step-glide controller: renders 'from' synchronously on stepTo, advances step frames with cameraGlide's own eased progress, settles to idle exactly on arrival, retargets from the displayed point mid-flight with no backward jump, self-heals a stale target (T-59-01), lands synchronously under reduced motion (T-59-02), stays in lockstep with the camera's own easing (T-59-03), and never throws into a caller even when its own render callback throws or is called reentrantly from inside cameraGlide's call stack"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "test/unit/party-sprite.test.js (createPartySprite: all 14 behavior tests incl. the two landed-API reentrancy regression tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-09-22
status: complete
---

# Phase 59 Plan 01: Party Marker Pure Presentation Core Summary

**src/browser/partySprite.js — the party marker's idle/step frame schedule, canvas-lockstep placement math, art fallback, and a retargetable step-glide controller built directly on Phase 58's `createCameraGlide`, with a landed-API reentrancy fix so T-59-01's teleport-mid-glide self-heal can never crash cameraGlide.js's own step loop.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-22 (discovery + Task 1)
- **Completed:** 2026-09-22T19:28:01-04:00
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `src/browser/partySprite.js`: `PARTY_FRAME_ICONS`, `IDLE_FRAMES`/`IDLE_FRAME_MS`/`IDLE_CYCLE_MS`, `STEP_FRAMES`/`STEP_GLIDE_MS` (`=== PAN_MS`), `idleFrameDelaysMs()`, `stepFrameAt()`, `snapToDevicePx()`, `spriteBoxPx()`, `spriteArt()` — the complete pure timing/placement/fallback core (Task 1).
- `createPartySprite({ now, raf, cancelRaf, reduced, render, durationMs })` — the retargetable step-glide controller (`stepTo`, `displayed`, `pose`, `frame`, `active`, `finish`, `cancel`, `box`), composed on Phase 58's `createCameraGlide` with no second easing curve or duration constant (Task 2).
- Discovered and fixed a real reentrancy crash in how this module was originally going to call `glide.cancel()`/`glide.finish()` from inside its own `onPoint` callback — see Deviations below. This directly protects T-59-01 (a marker left drawn on a stale square after a teleport/floor change mid-glide), which is exactly the scenario that triggers the reentrant path in real usage.
- `test/unit/party-sprite.test.js`: 32 tests, one named test per `<behavior>` bullet across both tasks, plus the acceptance-criterion node check, three source-assertion checks (no `window`/`document`/`matchMedia`, single import specifier `./cameraGlide.js`), and two additional regression tests pinning the reentrancy fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: partySprite.js constants and pure math (frame schedule, idle delays, step frame, device-pixel snap, canvas-lockstep box, art choice)** - `e361446` (feat)
2. **Task 2: createPartySprite — the retargetable step-glide controller on Phase 58's camera glide** - `83622e5` (feat)
3. **Teeth-check follow-up: fix a test that wasn't actually observing the order-dependency it claimed to pin** - `9f3ed8c` (test)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 2's commit includes both the implementation and its tests together, per this plan's own `<action>` instructions; a third small commit fixed a test bug discovered during the mandated Task 2 teeth check (see Deviations)._

## Files Created/Modified
- `src/browser/partySprite.js` - the party marker's pure presentation core (timing, placement, fallback, step-glide controller)
- `test/unit/party-sprite.test.js` - 32 tests pinning every behavior bullet plus reentrancy regressions

## Decisions Made
See `key-decisions` in frontmatter above (BASE_59, the landed-API reentrancy adaptation, discovery re-verification, and the task-commit shape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a reentrancy crash in cameraGlide.js's landed step() surfaced by this module's own render-throw and self-heal paths**
- **Found during:** Task 2, running the required `<behavior>` bullet 12 test ("a render callback that throws ends the glide cleanly")
- **Issue:** The plan's own `<action>` text specified `onPoint`'s catch call `glide.cancel()` on a throw. Testing this against the LANDED (Phase 58) `cameraGlide.js` crashed: `step()`'s non-landing branch calls `applySafely(apply, ...)` and then, on the very next line, reads its own closed-over `run` again (`run.frame = raf(step)`). A synchronous `glide.cancel()`/`glide.finish()` call from within that `apply` callback (our `onPoint`) nulls `run` out from under that line, throwing `Cannot set properties of null (setting 'frame')`. Worse, this is reachable not just via a throwing render but via `displayed()`'s own self-heal branch (T-59-01) called reentrantly from inside the shell's real render callback — i.e. the exact "teleport detected on the very next in-flight frame" scenario the threat register names as `mitigate`.
- **Fix:** Added an `inOnPoint` guard and an `endGlide(useFinish)` helper. While this module's own callback (`onPoint`) is executing — i.e. while control is inside `cameraGlide.js`'s `step()` call stack — `endGlide` skips the real `glide.cancel()`/`glide.finish()` call and only clears this controller's own state. This module's own `run` going `null` immediately makes every future `onPoint` tick for the stale glide a no-op (its own first line is `if (!run) return;`), so the underlying glide finishes itself invisibly on its own schedule with zero further observable effect, and any later `stepTo()` supersedes it safely regardless (cameraGlide's `to()` always cancels its own prior frame first). No cameraGlide.js file was touched (prohibited by this plan).
- **Files modified:** src/browser/partySprite.js, test/unit/party-sprite.test.js
- **Verification:** Two new regression tests: "a throwing render callback during an in-flight frame update also ends the glide cleanly and never throws" and "self-heal reentrant from within an active glide's own render callback (T-59-01...) never crashes cameraGlide.js's step()". Both fail (crash) against the pre-fix code and pass against the fix. Full `test/unit/party-sprite.test.js` run: 32/32 pass. Full `npm test`: 3810 tests, 3794 pass / 16 fail (the documented CRLF-fixture artifacts only — see Verification below).
- **Committed in:** 83622e5 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed the Task 2 teeth-check test itself, which was not observing the order-dependency it claimed to pin**
- **Found during:** Task 2's mandated teeth check (swap render before `glide.to` in `stepTo`, confirm the named test FAILS)
- **Issue:** The first version of the "renders exactly once synchronously... displayed returns from" test called `controller.displayed(to)` from the TEST's own call stack, AFTER `stepTo()` had already fully returned. Since both the correct order and the swapped (buggy) order leave `glide.to()` having run by the time `stepTo()` returns, the test's final observable state was identical either way — the teeth check did not fail as required.
- **Fix:** Changed the test to read `displayed(to)` from WITHIN the `render` callback itself (via the same `extra` probe pattern already used by other tests in this file), matching how the real shell will actually call `displayed()` — from inside its own render function. Re-ran the teeth check: the fixed test now correctly fails when the order is swapped, then passes once reverted (`git checkout --`).
- **Files modified:** test/unit/party-sprite.test.js
- **Verification:** Teeth check re-run: swap reproduces the failure; revert restores 32/32 passing.
- **Committed in:** 9f3ed8c (follow-up test commit)

---

**Total deviations:** 2 auto-fixed (1 bug in the intended reentrant-cancel design against a landed peer module, 1 bug in the test built to catch ordering regressions)
**Impact on plan:** Both fixes were necessary for T-59-01's mitigation (a threat-register `mitigate` item) to actually hold and for the plan's own teeth check to do its job. No scope creep — no file outside `src/browser/partySprite.js` and `test/unit/party-sprite.test.js` was touched; `cameraGlide.js` was read but never modified, per the plan's prohibition.

## Issues Encountered
None beyond the two auto-fixed deviations above, both discovered and resolved within Task 2's own required teeth check.

## Human Device Checks (deferred to Phase 60, per user's Deferred UAT protocol)
None specific to this plan — it produces no DOM/CSS surface (that is 59-03's job, wiring `window.__mzPartySprite`). This plan is a pure, headless `src/browser/` module with no `window`/`document` reads; there is nothing for a device pass to visually confirm about THIS plan's own output. Device verification of the party marker's actual on-screen idle/step animation belongs to 59-03/59-04's SUMMARYs.

## Next Phase Readiness
- 59-03 can now bridge one `createPartySprite` instance as `window.__mzPartySprite`, built with the real clock (`performance.now`, `requestAnimationFrame`, `cancelAnimationFrame`) and `reduced: () => prefersReducedMotion(window)`, and read `box`, `displayed`, `pose` and `frame` from it in the classic `positionPartySprite`, per this plan's `key_links`.
- 59-04 can call `stepTo` from the classic `glideParty`, passing the currently-displayed point as `from` per the retarget contract documented in `createPartySprite`'s JSDoc.
- The engine gate is clean (`git diff --stat f220718..HEAD -- engine/ content/ test/parity/` prints nothing; `test/parity/prototype-master.js.txt` hash unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), and `npm test` is at the expected baseline (3810 = 3778 + 32 new tests; 3794 pass; the 16 failures are the pre-existing, documented CRLF-fixture artifacts in `test/parity/divergence-records.test.js`, `test/unit/class-pass-ledger.test.js`, `test/unit/flee-ledger.test.js` and `test/unit/shell-tab-snapshots.test.js` — confirmed by running exactly those 4 files in isolation: 16/41 fail, matching the total exactly).
- `npm run build:www` was NOT run in this worktree (no `node_modules` installed here per this plan's run conventions — the orchestrator runs it after merging).

---
*Phase: 59-party-animation-dungeon-set-dressing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: src/browser/partySprite.js
- FOUND: test/unit/party-sprite.test.js
- FOUND: e361446 (Task 1 commit)
- FOUND: 83622e5 (Task 2 commit)
- FOUND: 9f3ed8c (teeth-check follow-up commit)
