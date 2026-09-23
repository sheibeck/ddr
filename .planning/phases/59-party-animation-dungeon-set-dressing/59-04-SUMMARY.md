---
phase: 59-party-animation-dungeon-set-dressing
plan: 04
subsystem: ui
tags: [party-animation, step-glide, camera-lockstep, reentrancy-safety, reduced-motion, mazeworld.html]

# Dependency graph
requires:
  - phase: 59-party-animation-dungeon-set-dressing (plan 01)
    provides: "src/browser/partySprite.js#createPartySprite — the retargetable step-glide controller (stepTo/displayed/pose/frame/active/finish/cancel/box), the inOnPoint/endGlide reentrancy guard against cameraGlide.js's landed step() crash"
  - phase: 59-party-animation-dungeon-set-dressing (plan 03)
    provides: "window.__mzPartySprite, partyShown(), positionPartySprite(rect)/positionParty() (+ window.mzPositionParty) — the lockstep placement path this plan's glide trigger renders through"
  - phase: 58-motion-pacing (plan 03)
    provides: "src/browser/cameraGlide.js (PAN_MS, createCameraGlide) and test/unit/harness/fakeClock.js/loadShellSandbox({reducedMotion, clock}) — the tween and test infrastructure this plan's marker glide/tests are built on"
provides:
  - "The classic glideParty(from) — window.mzPartySprite.stepTo(from, partyCentre()), exposed as window.mzGlideParty/window.mzPartyShown"
  - "stepWith's glideFrom capture (before the dispatch) and its trigger (`if (!jumped && glideFrom && events.some(moved)) window.mzGlideParty?.(glideFrom);`), placed AFTER the two pinned camera lines, byte-identical elsewhere"
  - "test/unit/party-glide.test.js (9 tests): the glide, step frames, retarget-with-no-backward-jump, the glow following the marker, marker/camera lockstep progress, a jump self-healing a stale glide, anchorCamOnParty never touching the party's own glide, and two reentrancy-safety tests"
  - "test/unit/reduced-motion.test.js's new 'party' section (3 tests): reduced lands a step synchronously with nothing pending, the predicate is read live, and a source-anchor pin on the glide trigger + the idle CSS freeze"
  - "__mzPartySprite BRIDGE row gains the classic glideParty (stepTo) consumer; docs/SHELL-MODULES.md regenerated"
affects: [60-uat-device-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A presentation trigger placed AFTER a pinned dispatch-tail region (the two byte-identical stepWith camera lines) rather than interleaved with it — keeps an existing source-anchor pin (shell-map-viewport.test.js's (m)) untouched while still landing the new effect in the SAME tick as the effect it must stay in lockstep with."
    - "Reconstructing a classic-script `let` camera variable indirectly for test assertions (`camFromPan(scn) = partyCentre() - cameraPan()/CELL`) rather than reading it directly — `cam` is not a vm-context-global property (only `function` declarations are); this identity holds regardless of the party's current position, so it is safe to call at any point in a test, including mid-glide."
    - "A simulated 'step' in a presentation-only behaviour test is `from = partyShown()` (read BEFORE the state changes) + a direct floor.px/py mutation to an open 4-neighbour + `glideParty(from)` — never a real engine dispatch, since this plan proves ONLY the presentation layer stepWith's trigger drives, matching the shape stepWith itself performs around dispatchWithNarration."

key-files:
  created:
    - test/unit/party-glide.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/reduced-motion.test.js

key-decisions:
  - "BASE_59 = f220718eadff6220cc9228b1eacab2ace5cb82ae, confirmed per the plan's discovery step. Note (re-verified, not assumed): this commit is an ANCESTOR of Phase 58's own work (bd4ae06, the 58-03 commit that created reduced-motion.test.js, lands AFTER f220718 on master) — so the plan's acceptance-criteria grep -c comparison against `git show \"$BASE_59\":test/unit/reduced-motion.test.js` correctly reports the file does not exist at BASE_59 (git show's fatal-but-empty-stdin behavior, piped into grep -c, yields 0), which trivially satisfies '0 <= current count'. This is expected, not a discovery-checklist failure — 59-CONTEXT.md (the discuss-phase output BASE_59 pins to) predates Phase 58's own execution in this project's actual commit history."
  - "Discovery re-verification (all 4 checklist items held exactly as documented against the LANDED code, no adaptation needed): (1) stepWith's structure, the two pinned tail lines, and stepNow's boundary were exactly as named. (2) keepPartyInView()'s G.to(cam, target, applyCam) applies nothing synchronously, confirmed by reading cameraGlide.js#to directly — both mzKeepPartyInView and mzGlideParty calls in the same tick share the same t0 window (same fake-clock now() reading, no time elapses between the two calls in a test or in real code). (3) partyShown()/positionParty()/window.mzPositionParty and window.__mzPartySprite's construction (render: () => window.mzPositionParty?.()) landed exactly as 59-03's SUMMARY documented. (4) shellSandbox.js's real __mzPartySprite wiring and map-pan.test.js's edge-nudge-trigger pattern were reused directly (triggerRightEdgeNudge mirrors triggerLeftEdgeNudge, flipped)."
  - "glideParty is placed as a new top-level function directly after `window.mzPositionParty = positionParty;` (immediately following positionParty(), per the plan's <action> instruction), rather than elsewhere in the classic script — keeps all three Phase 59 presentation functions (positionParty/mzPositionParty/glideParty) contiguous, and keeps draw()'s own doc-comment block (which begins immediately after) undisturbed."
  - "Task 2's behaviour tests never call through the real engine (no dispatchWithNarration/applyAction) — per the plan's own <action> text ('exactly the sequence stepWith performs around its dispatch'), a step is simulated as a direct floor.px/py mutation to an open 4-neighbour (openNeighbor(), scanning S.floor.g for a wall:false cell — read-only per the plan's engine/maze.js discovery note) plus glideParty(from), never a real move dispatch. This keeps the tests presentation-only (matching this plan's own 'the engine is untouched' must_have) while still exercising the real stepWith trigger LOGIC via its own source-anchor test."
  - "Run-convention 4 (KNOWN LATENT BUG guard) is proven by two additional tests beyond the plan's 7 literal behaviour bullets: party-glide (8)/(8b), a retarget and a finish() each triggered reentrantly from WITHIN the controller's own render callback (i.e., from inside cameraGlide.js's unmodified step() call stack) never throw. This confirms the plan's own shell wiring (glideParty/stepWith/window.mzPositionParty) introduces no NEW reentrant cancel/finish path beyond what 59-01's createPartySprite already guards internally."

patterns-established:
  - "camFromPan(scn) — the third test file (after map-pan.test.js, reduced-motion.test.js's 'pan' section) to reconstruct a classic-script `let` camera variable indirectly via the partyCentre()/cameraPan() identity rather than reading it as a vm-context global; future Phase 59/60 tests needing `cam` mid-animation should reuse this pattern rather than adding a new bridge."

requirements-completed: [ANIM-02]

coverage:
  - id: D1
    description: "glideParty(from) (classic) calls window.__mzPartySprite.stepTo(from, partyCentre()); window.mzGlideParty/window.mzPartyShown exposed; fail-open on a missing bridge/stepTo"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "scratch node check (acceptance criteria, Task 1): function glideParty(from) exactly once, .stepTo(from, partyCentre()) present, window.mzGlideParty/window.mzPartyShown assigned exactly once each"
        status: pass
      - kind: unit
        ref: "test/unit/party-glide.test.js (1)-(3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "stepWith captures glideFrom = window.mzPartyShown?.() ?? null BEFORE the dispatch, and triggers the glide AFTER the two pinned camera lines, guarded by !jumped and the moved event — every pinned stepWith line stays byte-identical"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/shell-map-viewport.test.js test/unit/perfMarks.test.js test/unit/shell-gear-39.test.js test/unit/bridge-registry.test.js (Task 1 acceptance suite, 78/78 for the first file, all four green)"
        status: pass
      - kind: unit
        ref: "test/unit/reduced-motion.test.js: 'reduced-motion/party: source anchors' (the trigger-line pin, exactly once)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Marker and map move together: keepPartyInView() and glideParty(from) share the same tick, same duration, same eased progress on every frame; the glow (the ring) follows the displayed marker throughout"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "test/unit/party-glide.test.js (4) the glow follows; (5) marker and map move together"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rapid steps retarget from the currently-displayed point (no backward jump, no queue); a jump (teleport/stairs) never glides and self-heals a stale in-flight glide; anchorCamOnParty (the pinch/snap cancel-first path) never touches the party's own step glide"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "test/unit/party-glide.test.js (3) retarget; (6) a jump ends a stale glide; (7) a step mid-drag"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reduced motion lands a step synchronously with nothing pending, in the same call; the predicate is read live (a mid-session flip lands the very next step instantly)"
    requirement: "ANIM-02"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js 'party' section (3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Run convention 4 (KNOWN LATENT BUG guard): this plan's own glideParty/stepWith/window.mzPositionParty wiring introduces no new reentrant cancel()/finish() path from within a render callback"
    verification:
      - kind: unit
        ref: "test/unit/party-glide.test.js (8) retarget reentrant from render; (8b) finish() reentrant from render"
        status: pass
    human_judgment: false
  - id: D7
    description: "On the Pixel 7, each step slides the party smoothly into the next square with a quick step animation and settles back to breathing on arrival; tapping fast never stutters or lags; the map and party move as one at an edge; Android's Remove animations moves the party instantly with no slide; stairs/teleports snap with no slide"
    verification: []
    human_judgment: true
    rationale: "Real-device compositor/animation-perception, touch-tap timing feel, and the OS-level reduced-motion toggle cannot be proven from source or a headless sandbox — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol."

# Metrics
duration: ~55min
completed: 2026-09-22
status: complete
---

# Phase 59 Plan 04: ANIM-02 Step Trigger (glideParty) Summary

**The classic `glideParty(from)` (calling `window.__mzPartySprite.stepTo(from, partyCentre())`) is wired into `stepWith`'s tail, right after the two pinned camera lines, driven by a `glideFrom` capture taken BEFORE the dispatch — every genuine step now glides the marker square-to-square in lockstep with the camera nudge, retargets on rapid taps, self-heals off a jump, and lands synchronously under reduced motion; proven by 12 new deterministic-clock tests including two reentrancy-safety regressions against cameraGlide.js's known landed-API crash.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-22 (discovery + Task 1)
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **Task 1 (feat, `b89ec2d`):** `function glideParty(from)` (classic, directly after `positionParty()`) — fails open on `!S`/`!from`/a missing `window.__mzPartySprite`/`.stepTo`, otherwise calls `sp.stepTo(from, partyCentre())`. `window.mzGlideParty = glideParty;` and `window.mzPartyShown = partyShown;` exposed. `stepWith` gains `const glideFrom = window.mzPartyShown?.() ?? null;` directly after the `wasCombat` line (before `dispatchWithNarration`), and the trigger `if (!jumped && glideFrom && events.some((e) => e.type === "moved")) window.mzGlideParty?.(glideFrom);` directly after the two pinned camera lines (`if (jumped) window.mzCenterMap?.(); else if (...moved...) window.mzKeepPartyInView?.();`), both lines byte-identical and unmoved. The `__mzPartySprite` BRIDGE row gains the classic `glideParty` consumer; `docs/SHELL-MODULES.md` regenerated in the same commit.
- **Task 2 (test, `bcb7fd5`):** `test/unit/party-glide.test.js` (new, 9 tests) — a step glides from the old cell to the new cell over ~200ms with the step-pose frame cycle, settling to idle exactly on arrival with nothing pending (1); `data-frame` matches `stepFrameAt` across all four 50ms windows (2); a retarget mid-glide starts from the currently-displayed point with no backward jump and restarts the frame at 1 (3); the ring's offset from the sprite stays constant across every sampled frame (4); `keepPartyInView()` and `glideParty(from)` called in the same tick keep IDENTICAL eased progress on every frame (5); a simulated teleport (`window.mzCenterMap()`) ends a stale in-flight glide at once, idle, with nothing further landing (6); `anchorCamOnParty` (the pinch/snap cancel-first path) never touches or crashes the party's own in-flight step glide (7); and two run-convention-4 reentrancy-safety tests proving a retarget or a `finish()` triggered reentrantly from WITHIN the render callback never throws (8, 8b). `test/unit/reduced-motion.test.js` gains a "party" section (3 tests): reduced lands a step synchronously with `clock.pending()` 0; the predicate is read live (a mid-session flip lands the next step instantly); and a source-anchor test pinning the trigger line (exactly once) plus 59-03's own idle-CSS-freeze proof, reused rather than retyped.
- Teeth check (after Task 2's commit, per this run's protocol): temporarily changed `glideParty` to pass `partyCentre()` instead of `from` as the glide's start point — `party-glide.test.js (1)`'s synchronous old-cell assertion FAILED exactly as required (`translate3d(186px, 314px, 0)` actual vs `translate3d(186px, 286px, 0)` expected), then reverted via `git checkout -- mazeworld.html`; re-ran green.
- Phase gate: `npm test` 3871/3871 (fail 0, +12 over the 3859/3859 baseline recorded at dispatch); `npm run build:www` exit 0; `git diff --stat f220718..HEAD -- engine/ content/ test/parity/` empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `package.json`/`package-lock.json` untouched; `bridge-registry.test.js` 10/10; `node tools/shell-sweep.mjs orphans` does not list `glideParty`.

## Task Commits

Each task was committed atomically:

1. **Task 1: glideParty, the stepWith capture and trigger, and the bridge row** - `b89ec2d` (feat)
2. **Task 2: party-glide.test.js and the party section of reduced-motion.test.js** - `bcb7fd5` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `mazeworld.html` — classic `glideParty(from)` + `window.mzGlideParty`/`window.mzPartyShown`; `stepWith`'s `glideFrom` capture and its tail trigger
- `src/browser/bridge.js` — the `__mzPartySprite` BRIDGE row's consumer list gains the classic `glideParty (stepTo)` entry
- `docs/SHELL-MODULES.md` — regenerated via `node tools/bridge-doc.mjs --write`
- `test/unit/party-glide.test.js` — new, 9 tests
- `test/unit/reduced-motion.test.js` — new "party" section, 3 tests

## Decisions Made

See `key-decisions` in the frontmatter above (BASE_59's ancestry relative to Phase 58's own history; the 4-item discovery re-verification; `glideParty`'s placement directly after `positionParty()`; the presentation-only "simulated step" test shape; the two run-convention-4 reentrancy tests).

## Deviations from Plan

None - plan executed exactly as written. The two extra reentrancy-safety tests (party-glide (8)/(8b)) are not a deviation from the plan's own 7 literal behaviour bullets — they satisfy this run's explicit `<run_conventions>` item 4 ("Add a test that a party glide retargeted or finished from within a frame callback does not throw"), which is a run-level instruction layered on top of the plan, not a plan change.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Human Verification — Phase 60 batched Pixel 7 checklist (this plan's items)

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built.

1. On the Pixel 7, each step slides the party smoothly into the next square with a quick step animation and it settles back to breathing on arrival; tapping fast several times never stutters or lags behind; when the map scrolls at an edge, the party and the map move as one.
2. With Android's Remove animations on, each step moves the party one square instantly, with no slide.
3. Stairs and teleports put the party on its new square at once, with no slide across the map.

## Next Phase Readiness

- ANIM-02 is complete: the step glide is fully wired end to end (trigger → controller → placement), matching Phase 58's camera glide duration and easing exactly, self-healing on every jump, and synchronous under reduced motion.
- No blockers. Engine/content/test-parity gate is clean against `f220718`; `npm test` 3871/3871; `npm run build:www` exit 0; `bridge-registry.test.js` green; working tree clean after the teeth check's revert.
- Remaining Phase 59 scope (DRESS-01..05, the set-dressing props) is untouched by this plan and unblocked by it.

---
*Phase: 59-party-animation-dungeon-set-dressing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/party-glide.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: commit b89ec2d
- FOUND: commit bcb7fd5
