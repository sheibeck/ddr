---
phase: 32-combat-narrative-input-ui-build
plan: 01
subsystem: ui
tags: [vanilla-js, input-guards, tdd, presentation-only]

requires:
  - phase: 31-combat-start-gating-effect-hygiene
    provides: "C.pending Fight! gate, dispatchWithToasts -> noteCombat wiring, CONDITION_COPY.afraid/ward"
provides:
  - "src/browser/inputGuards.js: a pure, zero-import, DOM-free module exporting ARM_DELAY_MS=250, DISMISS_SETTLE_MS=250, isArmed(renderedAt, now), isSettled(lastDismissAt, now)"
  - "window.__mzInputGuards bridge on the classic script, alongside __mzConditionsOf/__mzCanCast/__mzArmorDisplay"
  - "test/unit/inputGuards.test.js: constants, boundary-exact predicate behavior, fail-open coverage, a purity scan, and the mazeworld.html bridge pin"
affects: ["32-02", "32-03"]

tech-stack:
  added: []
  patterns:
    - "Timing-guard predicates are Date.now()-style millisecond comparisons with the clock passed in by the caller, never read inside the pure module — mirrors src/browser/controls.js's zero-import sibling-constants precedent"

key-files:
  created:
    - src/browser/inputGuards.js
    - test/unit/inputGuards.test.js
  modified:
    - mazeworld.html

key-decisions:
  - "isArmed/isSettled fail open by directly returning true when their first argument (renderedAt/lastDismissAt) is non-finite, rather than coercing it to 0 and running it through the elapsed-time subtraction — the plan's own <behavior> block (isArmed(undefined, 100) === true) is incompatible with the literal 'coerce to 0 then subtract' reading of the <action> step, since 100 - 0 = 100 which is still under the 250ms threshold. Implemented to satisfy the normative <behavior>/<truths> spec; documented here as the tie-breaker."
  - "The bridge-pin test (mazeworld.html import/bridge assertions) was written into test/unit/inputGuards.test.js's Task 1 RED commit by mistake per an initial draft, then moved back out before the Task 1 GREEN commit and re-added in Task 2, matching the plan's intended split (leave the bridge pin out of Task 1's RED test)."

patterns-established:
  - "Pure timing-guard module + window.__mz* bridge: any future arm-delay/settle-window need should extend inputGuards.js rather than hand-rolling a new Date.now() check inline."

requirements-completed: [CMBUI-04, CMBUI-05]

coverage:
  - id: D1
    description: "src/browser/inputGuards.js exports ARM_DELAY_MS=250, DISMISS_SETTLE_MS=250, isArmed(renderedAt, now), isSettled(lastDismissAt, now) as a pure, zero-import, clock-free, DOM-free module with boundary-exact and fail-open predicate behavior"
    requirement: "CMBUI-04"
    verification:
      - kind: unit
        ref: "test/unit/inputGuards.test.js#exports the two pure timing constants"
        status: pass
      - kind: unit
        ref: "test/unit/inputGuards.test.js#isArmed: false one ms under the arm delay, true exactly at and past it"
        status: pass
      - kind: unit
        ref: "test/unit/inputGuards.test.js#isSettled: false one ms under the settle window, true exactly at and past it"
        status: pass
      - kind: unit
        ref: "test/unit/inputGuards.test.js#isArmed/isSettled: a missing or non-finite first argument coerces to stamp 0 (fail-open)"
        status: pass
      - kind: unit
        ref: "test/unit/inputGuards.test.js#inputGuards.js is pure: no clock read, no DOM, no transition/animation reference, no engine import"
        status: pass
    human_judgment: false
  - id: D2
    description: "The module is bridged onto the classic script as window.__mzInputGuards, in the same bridge block/style as window.__mzCanCast, wiring no button yet"
    requirement: "CMBUI-05"
    verification:
      - kind: unit
        ref: "test/unit/inputGuards.test.js#mazeworld.html: imports inputGuards.js and bridges it onto window.__mzInputGuards"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-16
status: complete
---

# Phase 32 Plan 01: Input Guards Foundation Summary

**Pure `src/browser/inputGuards.js` timing-guard module (ARM_DELAY_MS/DISMISS_SETTLE_MS = 250ms, isArmed/isSettled predicates), unit-tested with a purity scan, and bridged onto the classic script as `window.__mzInputGuards` — no button wired yet.**

## Performance

- **Duration:** ~5 min (commit-to-commit)
- **Started:** 2026-09-16T12:46:49-04:00 (first commit)
- **Completed:** 2026-09-16T12:50:36-04:00 (last commit)
- **Tasks:** 2
- **Files modified:** 3 (1 created new module, 1 created new test, 1 modified — mazeworld.html)

## Accomplishments
- `src/browser/inputGuards.js`: zero-import, DOM-free, clock-free module exporting `ARM_DELAY_MS = 250`, `DISMISS_SETTLE_MS = 250`, `isArmed(renderedAt, now)`, `isSettled(lastDismissAt, now)` — the clock is always passed in by the caller, matching the `src/browser/controls.js` sibling-constants precedent exactly.
- Both predicates are boundary-exact (true at exactly the threshold, false one ms under) and fail open on a non-finite/missing first argument (a never-rendered button or a fresh page is always treated as armed/settled, never locked out).
- `test/unit/inputGuards.test.js`: 9 tests — constants, `isArmed`/`isSettled` boundary tables, the fail-open cases, a purity scan (no `Date.now`, no DOM/`window`/`document`/`localStorage`/`setTimeout`/`requestAnimationFrame`, no `transition`/`animation` mention anywhere, no engine import, no `import` statements at all), and the `mazeworld.html` bridge pin.
- `mazeworld.html`: one import line for `./src/browser/inputGuards.js` beside the `controls.js` import, and one `window.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };` bridge assignment right after `window.__mzCanCast`, in the same comment voice as the surrounding bridges.
- Verified RESEARCH finding 3 empirically (not just trusted): `test/unit/feedback-payload.test.js` needed zero changes — 37 pass, file untouched (`git status --porcelain` empty on that path).
- Full suite: `npm test` → 1864/1864 pass, 0 fail (1855 baseline + 9 new `inputGuards.test.js` tests). `npm run build:www` exit 0.

## Task Commits

Each task was committed atomically (Task 1 as TDD RED then GREEN):

1. **Task 1a: failing inputGuards test (RED)** - `73d9b07` (test)
2. **Task 1b: pure inputGuards module (GREEN)** - `6907f20` (feat) — also moved the premature bridge-pin test back out of the RED file (see Deviations)
3. **Task 2: bridge inputGuards onto window.__mzInputGuards** - `68b7825` (feat)

**Plan metadata:** commit pending (final `docs(32-01)` metadata commit, made after this SUMMARY)

## Files Created/Modified
- `src/browser/inputGuards.js` - new pure module: `ARM_DELAY_MS`, `DISMISS_SETTLE_MS`, `isArmed`, `isSettled`
- `test/unit/inputGuards.test.js` - new: constants + boundaries + fail-open + purity scan + bridge pin (9 tests)
- `mazeworld.html` - one import line + one `window.__mzInputGuards` bridge assignment; no button wiring (deferred to 32-03)

## Decisions Made
- **Fail-open semantics resolved by direct short-circuit, not by coercing the missing stamp to 0 and subtracting.** The plan's `<behavior>` block requires `isArmed(undefined, 100) === true`, but literally coercing `renderedAt` to 0 and computing `now - renderedAt >= ARM_DELAY_MS` gives `100 - 0 = 100`, which is still under the 250ms threshold and would evaluate to `false`. Implemented `isArmed`/`isSettled` to return `true` directly when their first argument is non-finite (Number.isFinite check), which satisfies every case in the plan's `<behavior>` and `<truths>` blocks, including the `isArmed(0, 0) === false` case (an explicit, finite 0 still goes through the normal elapsed-time math). This is a Rule 1 (bug) resolution against an internal inconsistency between the plan's illustrative pseudocode and its own normative test list — the test list won, since it is what acceptance criteria score against.
- **Test-file scoping fix mid-TDD:** the RED test I initially wrote included the mazeworld.html bridge-pin assertion (Task 2's pin), contradicting the plan's explicit instruction to "leave one test (the bridge pin, Task 2) out for now." Caught and corrected before the Task 1 GREEN commit — the bridge-pin test was removed, then re-added as part of Task 2 once the actual import/bridge lines existed. No behavior or scope impact; purely a commit-sequencing correction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fail-open implementation corrected from literal pseudocode to match the plan's own behavior spec**
- **Found during:** Task 1 (GREEN step, first test run against the naive `stampOf`-both-arguments implementation)
- **Issue:** The plan's `<action>` step describes coercing both `renderedAt`/`lastDismissAt` and `now` to 0 via a `stampOf` helper and then subtracting — but that reading fails the plan's own `<behavior>` assertion `isArmed(undefined, 100) === true` (100 - 0 = 100 < 250 = false, not true).
- **Fix:** `isArmed`/`isSettled` now check `Number.isFinite` on the first argument and return `true` immediately if it's non-finite; otherwise they run the normal `now - renderedAt >= THRESHOLD` comparison (with `now` still passed through `stampOf` defensively).
- **Files modified:** `src/browser/inputGuards.js`
- **Verification:** All 9 `test/unit/inputGuards.test.js` tests pass, including the fail-open case and the `isArmed(0, 0) === false` boundary case.
- **Committed in:** `6907f20` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking, self-caught] Removed a prematurely-included test from the RED commit**
- **Found during:** Task 1 (before the GREEN commit, while reviewing the RED test file against the plan's step-by-step instructions)
- **Issue:** The initial RED test file included the mazeworld.html bridge-pin test (belongs to Task 2), which would have kept the suite red after Task 1's module was created (the bridge lines don't exist until Task 2).
- **Fix:** Removed the premature bridge-pin test before the GREEN commit; re-added it verbatim in Task 2 once the import/bridge lines existed in `mazeworld.html`.
- **Files modified:** `test/unit/inputGuards.test.js`
- **Verification:** Task 1 GREEN run showed 8/8 pass with only the module's own tests present; Task 2's full suite run showed the bridge-pin test passing alongside everything else.
- **Committed in:** `6907f20` (test-scope correction folded into the Task 1 GREEN commit) and `68b7825` (bridge-pin test re-added in Task 2)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug fix, 1 Rule 3 self-caught scoping correction)
**Impact on plan:** Neither changes scope or behavior beyond what CMBUI-04/05 requires; both were caught and resolved within Task 1 before its GREEN commit landed. No engine/content/test/parity files touched.

## Issues Encountered
None beyond the two auto-fixed items above.

## Self-Check

- `test -f src/browser/inputGuards.js` → FOUND
- `test -f test/unit/inputGuards.test.js` → FOUND
- Commit `73d9b07` (test RED) → FOUND in `git log --oneline --all`
- Commit `6907f20` (feat GREEN, module) → FOUND in `git log --oneline --all`
- Commit `68b7825` (feat, bridge) → FOUND in `git log --oneline --all`
- `node --test test/unit/inputGuards.test.js` → 9 pass, 0 fail
- `node --test test/unit/feedback-payload.test.js` → 37 pass, 0 fail; `git status --porcelain test/unit/feedback-payload.test.js` empty (file untouched, confirming RESEARCH finding 3)
- `npm test` → 1864 pass, 0 fail (1855 baseline + 9 new tests)
- `npm run build:www` → exit 0
- `git diff --stat 9174e6e..HEAD -- engine content test/parity` → empty (no engine/content/parity file touched)
- `git status --porcelain test/parity` → empty (`test/parity/prototype-master.js.txt` untouched)

## Self-Check: PASSED

## Human verification (deferred to end of run)

Per this run's rule, on-device verification is batched at the end of the autonomous run, not per-plan.

- No player-visible change shipped by this plan (no button is wired to the new guards yet — that's 32-03). The Pixel 7 device check for the actual arm-delay/dismiss-settle behavior belongs to 32-03's SUMMARY, once a real button consumes `window.__mzInputGuards.isArmed`/`isSettled`.

## Next Phase Readiness
- `window.__mzInputGuards` is live and proven correct at the boundary/fail-open level; 32-02 (Round Card DOM + `dispatchWithToasts` routing split) and 32-03 (guard wiring on the ~10 named decision buttons + `window.move`'s `DISMISS_SETTLE_MS` clause) can both build directly on this module without further changes to it.
- No blockers.

---
*Phase: 32-combat-narrative-input-ui-build*
*Completed: 2026-09-16*
