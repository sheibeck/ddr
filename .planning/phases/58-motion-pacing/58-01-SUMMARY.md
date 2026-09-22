---
phase: 58-motion-pacing
plan: 01
subsystem: ui
tags: [motion, reduced-motion, camera, typewriter, accessibility, pure-module]

# Dependency graph
requires:
  - phase: 57-hud-menu
    provides: rail transform/visibility overlay (data-shown), doubled rail holds, ☰ dropdown data-state model — the surfaces plans 58-02..06 wire this plan's cores into
provides:
  - "src/browser/motion.js: the one live prefersReducedMotion predicate + onReducedMotionChange subscription, pinned OPEN_MS/MENU_OPEN_MS/CLOSE_MS/CLOSE_SLACK_MS/EASE_OUT_CSS/EASE_IN_CSS, and createPanelMotion (timer-driven, cancellable panel close helper)"
  - "src/browser/cameraGlide.js: PAN_MS/easeOutCubic/glidePoint and createCameraGlide — a retargetable, cancellable 200ms ease-out camera tween"
  - "src/browser/typewriter.js: TYPE_MS_PER_CHAR/TYPE_MAX_MS/TYPE_REST_CLASS, typeDurationMs/typedCount/splitTyped, and createTypewriter — a keyed, accessible, cancellable typewriter with adopt()"
affects: [58-02, 58-03, 58-04, 58-05, 58-06, 58-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, clock-free, DOM-free src/browser/ modules — every clock/raf/cancelRaf/reduced/doc dependency arrives as an argument, mirroring inputGuards.js/controls.js's house style"
    - "Timer-driven (never completion-event) motion helpers — createPanelMotion's close() sets `hidden` on a setTimeout at CSS-duration + one frame of slack, never a transitionend/animationend listener (CSCR-08)"
    - "Fail-to-instant reduced-motion predicate — every JS-timed effect consults ONE prefersReducedMotion(win), and resolves synchronously to its end state when it reads true or can't tell"

key-files:
  created:
    - src/browser/motion.js
    - src/browser/cameraGlide.js
    - src/browser/typewriter.js
    - test/unit/motion.test.js
    - test/unit/camera-glide.test.js
    - test/unit/typewriter.test.js
  modified: []

key-decisions:
  - "BASE_58 = a01b38e08b98e36ed1939d9d1fe1538eee6237b1 (the commit that added 58-CONTEXT.md) — recorded per the plan's discovery step; used for the engine-gate diff below."
  - "Module boundary: three separate files (motion.js, cameraGlide.js, typewriter.js) rather than one combined motion.js, per the plan's own discretion clause — each module has a distinct, independently-testable concern and none grows paint()/draw()."
  - "typewriter.js's fake-DOM test helper was purpose-built inline in the test file (per the plan's own instruction), not built on test/unit/harness/recordingDom.js, since this plan is prohibited from touching any existing test file and recordingDom.js's superset surface (innerHTML, insertAdjacentHTML, etc.) is unneeded for a controller that only ever calls textContent/className/appendChild/setAttribute."

patterns-established:
  - "Every motion/camera/typing duration in this phase is a named, exported, test-pinned constant (OPEN_MS, MENU_OPEN_MS, CLOSE_MS, CLOSE_SLACK_MS, PAN_MS, TYPE_MS_PER_CHAR, TYPE_MAX_MS) — later plans import these rather than re-declaring a literal."
  - "adopt(key, targets, ariaHost) as the pattern for handing an in-flight timed effect to freshly re-rendered elements at its CURRENT progress (never restarting from 0, never truncating) — typewriter.js's adopt() is the first instance; plans 58-05/58-06 depend on it surviving `paint()`'s re-render."

requirements-completed: [MOTION-01, MOTION-02, MOTION-04, MOTION-05]

coverage:
  - id: D1
    description: "src/browser/motion.js — the one live reduced-motion predicate (fail-to-instant), its change subscription, the pinned open/close durations, and a timer-driven, cancellable panel close helper (createPanelMotion) with no completion-event listener"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/motion.test.js (15 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/browser/cameraGlide.js — a retargetable, cancellable 200ms ease-out camera tween (createCameraGlide), continuing from the caller-passed point on a mid-flight retarget, landing synchronously under reduced motion or durationMs 0"
    requirement: "MOTION-01"
    verification:
      - kind: unit
        ref: "test/unit/camera-glide.test.js (11 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "src/browser/typewriter.js — a keyed typewriter at 12ms/char with a 700ms cap, reserving final layout via typed/rest spans, hiding the typing host from assistive tech for exactly the typing window, and adopt() for surviving a same-content re-render mid-typing"
    requirement: "MOTION-04"
    verification:
      - kind: unit
        ref: "test/unit/typewriter.test.js (17 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reduced motion (MOTION-05) resolves all three modules instantly to their end state — proven per-module rather than as a separate deliverable"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/motion.test.js (reduced-true close), test/unit/camera-glide.test.js (reduced-true to(), durationMs 0, mid-flight flip), test/unit/typewriter.test.js (reduced-true type(), mid-flight flip, zero-length texts)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 01: Motion Cores (motion.js, cameraGlide.js, typewriter.js) Summary

**Three pure src/browser/ modules — motion.js's fail-to-instant reduced-motion predicate and timer-driven panel close helper, cameraGlide.js's retargetable 200ms ease-out camera tween, and typewriter.js's 12ms/char keyed typewriter with adopt() — every duration a named, test-pinned constant, all clock-free and DOM-free per inputGuards.js's house style.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-22T19:32:00Z (worktree base commit ab3fca9)
- **Completed:** 2026-09-22T19:51:48Z
- **Tasks:** 3
- **Files modified:** 6 created (3 modules, 3 test files), plus 1 deferred-items.md logging an out-of-scope discovery

## Accomplishments

- `src/browser/motion.js`: `prefersReducedMotion(win)` (fail-to-instant), `onReducedMotionChange(win, cb)` (live subscription, addEventListener + legacy addListener fallback), the pinned `OPEN_MS`/`MENU_OPEN_MS`/`CLOSE_MS`/`CLOSE_SLACK_MS`/`EASE_OUT_CSS`/`EASE_IN_CSS`, and `createPanelMotion(...)` — a timer-driven `close()`/`open()`/`isClosing()`/`finishAll()` panel helper that never listens for a completion event (CSCR-08).
- `src/browser/cameraGlide.js`: `PAN_MS` (200), `easeOutCubic`, `glidePoint`, and `createCameraGlide(...)` — `to()` retargets mid-flight from the caller-passed `from` (never stutters on rapid tap-to-move), `cancel()`/`finish()`, synchronous landing under reduced motion or `durationMs <= 0`.
- `src/browser/typewriter.js`: `TYPE_MS_PER_CHAR` (12), `TYPE_MAX_MS` (700), `TYPE_REST_CLASS`, `typeDurationMs`/`typedCount`/`splitTyped` (pure schedule math), and `createTypewriter(...)` — types via typed+rest span pairs (no reflow), hides the typing host from assistive tech for exactly the typing window with prior-value restoration, and `adopt()` hands an in-flight block to fresh elements at its current progress without restarting or truncating it.
- 43 new tests across the three modules' test files (15 + 11 + 17), each with a fake clock/raf (or fake timer queue) and, where applicable, a minimal purpose-built fake DOM — zero real timers, zero real DOM.
- Confirmed via `tools/ident-sweep.mjs#stripJs`: none of the three modules holds a `transitionend`/`animationend` token or reads the `window`/`document` global.
- Confirmed via a name-collision scan + `test/unit/shell-no-content-copies.test.js` + `test/unit/bridge-registry.test.js`: no export name from any of the three modules is re-declared in `mazeworld.html`, and no new `window.__mz*` bridge name was introduced (none owed — these modules are wired by plans 58-03..06, not this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: src/browser/motion.js** - `01f33f1` (feat)
2. **Task 2: src/browser/cameraGlide.js** - `8c1a2bc` (feat)
3. **Task 3: src/browser/typewriter.js** - `d8f0b85` (feat, includes deferred-items.md)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `src/browser/motion.js` - Reduced-motion predicate + subscription, pinned durations, timer-driven panel close helper
- `src/browser/cameraGlide.js` - Retargetable, cancellable ease-out camera tween
- `src/browser/typewriter.js` - Typing schedule + keyed, accessible, cancellable typewriter controller
- `test/unit/motion.test.js` - 15 tests + 2 stripped-source checks
- `test/unit/camera-glide.test.js` - 11 tests + 2 stripped-source checks
- `test/unit/typewriter.test.js` - 17 tests + 2 stripped-source checks
- `.planning/phases/58-motion-pacing/deferred-items.md` - Logs a pre-existing, out-of-scope npm test finding (see Issues Encountered)

## Decisions Made

- Kept the three modules as separate files rather than one combined `motion.js`, per the plan's own discretion clause — each has an independently testable concern (reduced-motion + panels vs. camera math vs. typing), matching how plans 58-03/58-04 vs. 58-05/58-06 will each import only what they need.
- `createPanelMotion`'s `close()` treats "already hidden, not pending" as a strict no-op (checked before the `reduced()` branch), so a reduced-motion caller closing an already-closed element never fires `onHidden` a second time — this was inferred from the plan's behavior bullet ("close on an already-hidden, not-closing element does nothing") applying uniformly, not just under `reduced: false`.
- `typewriter.js`'s `adopt()` recomputes `typedCount` fresh from `run.t0`/`now()` rather than trusting the old spans' displayed text, so the new spans are guaranteed consistent with the running clock even if a caller calls `adopt()` on a frame boundary.

## Deviations from Plan

None - plan executed exactly as written. All three read_first sources were consulted; all `<behavior>` bullets became named tests; all three teeth checks were performed and reverted per protocol (see below).

### Teeth checks performed (all reverted with git checkout / manual revert, per Rule)

1. **motion.js — no-caching rule.** Temporarily made `prefersReducedMotion` cache its first answer in a module-scope variable. Confirmed the "no caching — a flipping stub returns the new value on the second call" test FAILED. Reverted (the file was untracked at mutation time, so reverted via a targeted `Edit` back to the original content rather than `git checkout --`, which only works on tracked files).
2. **cameraGlide.js — retarget-continuity rule.** Temporarily made `to()` ignore its `from` argument and restart from the ORIGINAL run's `from` on a retarget. Confirmed the "retargeting mid-flight continues from the passed 'from' ..." test FAILED. Reverted the same way.
3. **typewriter.js — aria-restore rule.** Temporarily removed the `restoreAria(...)` call from `finishRun`. Confirmed FOUR tests failed: the big `type()` test (aria-hidden removed assertion), `complete()`, `cancel()`, and `adopt()`. Also strengthened the "ariaHost carrying aria-hidden=\"true\" before typing keeps \"true\" afterwards" test with an explicit `setAttributeCalls.length === 2` assertion (one for `hideAria` at `type()`-time, one for `restoreAria` at `finishRun()`-time) — the plain final-value check alone was a false negative here, since a prior value of `"true"` is indistinguishable from "restore never ran" by final value alone (both land on `"true"`). Reverted.

## Issues Encountered

**Pre-existing, out-of-scope `npm test` failures (logged, not fixed).** Running the full `npm test` suite after Task 3 reported `3660 pass / 16 fail` of 3676 total (3633 baseline + this plan's 43 new tests, all 43 passing). The 16 failures are all in files this plan never touches (`test/parity/divergence-records.test.js`, `test/unit/class-pass-ledger.test.js`, `test/unit/flee-ledger.test.js`, `test/unit/shell-tab-snapshots.test.js`) and were root-caused to a CRLF-vs-LF checkout artifact in this fresh worktree (`core.autocrlf=true`, no `.gitattributes` LF pin for several text fixtures) — the committed git blobs are LF-clean but the checked-out working copies have CRLF, breaking a `(.*)$`-anchored regex a few tests use. Per the executor's scope-boundary rule ("only auto-fix issues DIRECTLY caused by the current task's changes"), this was logged to `.planning/phases/58-motion-pacing/deferred-items.md` rather than fixed — fixing it would mean touching `.gitattributes` and/or files under `test/parity/`, entirely outside this plan's `files_modified`, and risks interacting with the sibling 58-02 worktree running in parallel.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three pure cores (motion.js, cameraGlide.js, typewriter.js) are ready for plans 58-03 (camera glide wiring), 58-04 (panel motion wiring), and 58-05/58-06 (typewriter wiring) to import and wire into the shell with a real clock/raf/document and `reduced: () => prefersReducedMotion(window)`.
- No `window.__mz*` bridge row is owed by this plan (none of these three modules is called from the classic script yet — that happens in the wiring plans).
- **Blocker/concern for the orchestrator/user before merging this wave:** confirm whether the main checkout (`C:\projects\mazeworld`) exhibits the same CRLF-vs-LF drift on `tools/*.txt`/ledger fixtures documented in `deferred-items.md` above. If it does not, the drift is specific to this fresh worktree's checkout and should self-resolve once merged back; if it does, a `.gitattributes` LF pin is needed before `npm test` can report `fail 0` again.

## Self-Check: PASSED

- All 7 created/logged files found on disk (3 modules, 3 test files, deferred-items.md).
- All 3 task commit hashes (`01f33f1`, `8c1a2bc`, `d8f0b85`) found in `git log`.

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*
