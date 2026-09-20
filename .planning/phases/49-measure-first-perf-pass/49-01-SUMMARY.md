---
phase: 49-measure-first-perf-pass
plan: 01
subsystem: performance
tags: [performance, instrumentation, perf-marks, dev-tools, android]

# Dependency graph
requires:
  - phase: 47-shell-modularisation
    provides: the module-script shell (stepWith, the src/browser/ module pattern, bridge-registry discipline) this plan instruments
provides:
  - "src/browser/perfMarks.js — pure ring-buffer timing module (record/summary/formatReadout), unit-tested"
  - "dev-gated performance.now() marks bracketing stepWith's dispatch/paint/draw/step rows"
  - "#mw-dev-perf readout + [mzperf] logcat line for the Pixel 7 device session"
  - "docs/PERF-BASELINE.md method/protocol/re-measure recipe (report sections reserved for 49-02)"
  - "the verbatim 10-step user checklist for the orchestrator's device handoff"
affects: [49-02-measure-first-perf-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dev-gated performance.now() marks: every clock read wrapped in `perf ? ... : 0` / `if (perf)`, where perf is null unless state.dev is true — zero cost/zero recording in a normal run"
    - "pure ring-buffer module (no window/document/performance/console) unit-tested with injected samples, consumed by a module-script call site that owns the actual clock reads"

key-files:
  created:
    - src/browser/perfMarks.js
    - test/unit/perfMarks.test.js
    - docs/PERF-BASELINE.md
  modified:
    - mazeworld.html

key-decisions:
  - "The instrumentation stays dev-gated in the shipped build rather than being removed — it is the phase's measurement method (criterion 1), not a fix (criterion 2); reversible in one revert commit"
  - "dispatch is the fourth row's name because it measures dispatchWithNarration (engine action + narration fold + rail-card push), not the bare engine call"
  - "The readout shows max as well as med/p95 so the user's report needs no logcat cross-check to be complete"
  - "step brackets the whole stepWith body (a superset of dispatch..draw, including the trailing draw, Oracle log append and camera nudge) — it can only over-report cost, never under-report"

patterns-established:
  - "Dev-gated shell instrumentation: a pure module (no globals) + guarded call sites in the module script + a readout element inside an already-hidden dev-only row"

requirements-completed: []
# PERF-01 is NOT marked complete here — the plan's own note (project_notes)
# is explicit: 49-02 closes both PERF-01 and PERF-02 together, once the
# device numbers exist and the fix-or-no-fix decision is made.

# Metrics
duration: ~45min
completed: 2026-09-20
status: complete
---

# Phase 49 Plan 01: Measure-First Perf Pass — Instrumentation Summary

**Dev-gated `performance.now()` rings (step/dispatch/paint/draw, 100-sample nearest-rank median/p95/max) wired into `stepWith`, surfaced on `#mw-dev-perf` and `[mzperf]` logcat, with `docs/PERF-BASELINE.md`'s method half and the verbatim Pixel 7 checklist for the orchestrator's device handoff — zero clock reads or recording in a normal run.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 4 (`src/browser/perfMarks.js`, `test/unit/perfMarks.test.js`, `mazeworld.html`, `docs/PERF-BASELINE.md`) + this SUMMARY

## Accomplishments

- `src/browser/perfMarks.js`: a pure, dependency-free ring-buffer module (`createPerfMarks`, `perfMarks`, `formatReadout`, `PERF_ROWS`, `PERF_RING_SIZE=100`, `PERF_LOG_EVERY=10`) — no `window`/`document`/`performance`/`globalThis`/`console` token anywhere in the file, no `import` — unit-tested with 10 injected-sample tests (ring cap, nearest-rank median/p95/max, invalid-input rejection, row ordering, independent instances, reset, readout wording, purity).
- Seven `performance.now()` lines inside `mazeworld.html`'s module-script `stepWith(action)`, every one gated by `perf` (`window.__mzState.get()?.dev ? perfMarks : null`) — bracketing `dispatch` (from the top of `stepWith` through `dispatchWithNarration`), `paint` (one `window.paint()` call), `draw` (the trailing standalone `window.draw()` call), and `step` (the whole `stepWith` body). 10 additional shell source pins in `test/unit/perfMarks.test.js` prove the gate, the bracket order, and that the classic (pre-module) script carries none of these tokens.
- `#mw-dev-perf`: an empty `<div>` inside the already-hidden `#mw-dev-row` (Settings sheet, revealed only by the version label's ~1.2 s long-press), styled to collapse via `:empty` in a normal run, written by a new `perfReadout(perf)` function after every recorded step; the same summary is logged as `console.log("[mzperf] " + JSON.stringify(s))` every 10 steps.
- `mzDevStartAtDepth` calls `perfMarks.reset()` + `perfReadout(perfMarks)` immediately after `closeSettingsSheet()`, so a fresh dev run starts its rings at n=0 with a collapsed readout.
- `docs/PERF-BASELINE.md`: all 8 sections present in order (Method, Device, Protocol, BEFORE, Jank report, Decision, AFTER, How to re-measure); Method explains all four rows including the paint()-also-calls-draw() finding (`stepWith` therefore draws the canvas twice per step) and pastes the criterion-4 grep verbatim; Protocol names depth D=5 with the curve values; the four report sections + Device each carry the single reserved line for Plan 49-02.
- The verbatim 10-step Pixel 7 checklist, ready for the orchestrator to paste into chat once the debug APK is built.

## Task Commits

Each task was committed atomically:

1. **Task 1: `src/browser/perfMarks.js` + unit suite** - `cab78ec` (feat)
2. **Task 2: dev-gated call sites, `#mw-dev-perf` readout, `[mzperf]` line, shell pins** - `bb83eed` (feat)
3. **Task 3: `docs/PERF-BASELINE.md` + this SUMMARY** - see `git log --oneline -1` after this commit lands (docs)

## Files Created/Modified

- `src/browser/perfMarks.js` - pure ring-buffer timing module (record/summary/formatReadout)
- `test/unit/perfMarks.test.js` - 10 module-behaviour tests (Task 1) + 10 shell source pins (Task 2)
- `mazeworld.html` - the `perfMarks.js` import, `perfReadout(perf)`, the seven guarded `performance.now()` lines in `stepWith`, the `#mw-dev-perf` markup + CSS, `perfMarks.reset()`/`perfReadout(perfMarks)` in `mzDevStartAtDepth`
- `docs/PERF-BASELINE.md` - method/protocol/re-measure recipe filled; report sections reserved for 49-02

## Decisions Made

See `key-decisions` in the frontmatter — all four are the plan's own locked judgment calls, reproduced under "Judgment calls for the user" below for the orchestrator to relay.

## Deviations from Plan

None — plan executed exactly as written. The one wording adjustment made during execution (not a deviation from behavior, only from the literal markup-comment prose): the `#mw-dev-row` comment block originally drafted the word "perfReadout" by name, which would have tripped the Task 2 shell pin requiring the classic-script region (everything before `<script type="module">`) to carry zero `perfMarks`/`perfReadout`/`performance.now` tokens, since that markup+CSS lives before the module script tag. Reworded to "the module script's readout writer" — same meaning, no function name spelled in markup. Verified by the classic-script-isolation pin (test 20) and the raw `awk` grep in the Task 2 acceptance criteria, both green.

## Issues Encountered

None.

## Ship proof (criterion 4)

After `npm run build:www`:

```
$ grep -rn "performance.now" www/
www/index.html:4952:    const tStep = perf ? performance.now() : 0;
www/index.html:4954:    if (perf) perf.record("dispatch", performance.now() - tStep);
www/index.html:5014:    const tPaint = perf ? performance.now() : 0;
www/index.html:5016:    if (perf) perf.record("paint", performance.now() - tPaint);
www/index.html:5017:    const tDraw = perf ? performance.now() : 0;
www/index.html:5019:    if (perf) perf.record("draw", performance.now() - tDraw);
www/index.html:5032:    if (perf) { perf.record("step", performance.now() - tStep); perfReadout(perf); }
```

```
$ grep -rn "performance.now" www/ | grep -vc "perf ? \|if (perf)"
0
```

Exactly 7 lines, all in `www/index.html`, all inside `stepWith`, every one gated — nothing unguarded shipped.

## Depth D (Protocol)

```
$ node -e "import('./engine/difficulty.js').then(m => { for (let d = 5; d <= 999; d++) { const c = m.difficultyCurve(d); if (!c.breather && c.darkBlobs >= 1) { console.log(JSON.stringify({ D: d, breather: c.breather, darkBlobs: c.darkBlobs, waterPools: c.waterPools })); break; } } })"
{"D":5,"breather":false,"darkBlobs":3,"waterPools":2}
```

Matches the planner's number — D = 5 is used throughout the checklist below unchanged.

## Gate results (recorded verbatim)

- `node --test test/unit/perfMarks.test.js` — Task 1: `# pass 10 / # fail 0`; Task 2 (after shell pins appended): `# pass 20 / # fail 0`
- `npm test` — after Task 1: `# pass 3303 / # fail 0` (3,293 + 10); after Task 2: `# pass 3313 / # fail 0` (3,293 + 20)
- `npm run build:www` — exit 0, `www/index.html` stamped
- `npm run boot:check` — `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4), both after Task 2 and again against the Task 2 `www/` build
- `node --test test/unit/shell-tab-snapshots.test.js` — `# pass 10 / # fail 0`; `git diff --stat -- test/unit/fixtures/` — empty (no fixture change)
- `node --test test/unit/bridge-registry.test.js` — `# pass 10 / # fail 0`; `node tools/bridge-doc.mjs --check` — exit 0; `git status --porcelain src/browser/bridge.js docs/SHELL-MODULES.md` — empty (no bridge added)
- `node tools/stale-terms.mjs` — exit 0 at every commit
- `git status --porcelain engine/ content/ test/parity/` — empty at every commit; `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged throughout
- `git diff --numstat HEAD~1 HEAD -- mazeworld.html` (Task 2 commit) — `38  2  mazeworld.html` (within the ≤ 40 added / ≤ 6 removed bound, no whole-file rewrite); `git ls-files --eol mazeworld.html` — `i/lf` preserved

## User checklist

The orchestrator pastes this block into chat verbatim (with `APK_COMMIT` substituted) once the debug APK is built:

```
Phase 49 device checklist — Pixel 7 perf baseline (PERF-01)

Build: debug APK at android/app/build/outputs/apk/debug/app-debug.apk from commit APK_COMMIT (the orchestrator fills this in after `npm run android:debug`).

1. If a Play-installed build is on the phone, uninstall it first — a Play build and a local debug build have different signers.
2. `adb devices` (or `adb mdns services` if the port rotated — the Pixel 7 is adb-28051FDH200H0R).
3. `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
4. `adb shell am force-stop com.darktierstudios.delvedierepeat` then `adb shell monkey -p com.darktierstudios.delvedierepeat 1` (install alone does not reload the WebView).
5. Title → ENTER → take any roll → on the map open Settings (the gear chip right of MAKE CAMP) and long-press the "Version …" label for about 1.2 s until the "Start at depth (dev)" row appears.
6. Enter 5 in the depth field and tap Start. Depth 5 is the shallowest non-breather floor whose difficulty curve gives at least one dark blob (it gives 3, plus 2 water pools), so the floor has both a dark region and water. The HUD shows the DEV chip.
7. Walk at least 50 steps by tapping, mixed the way you normally play: through a water pool, into a dark region and back out, at least one encounter card (fight, flee, parley — anything), and at least one tab switch (Gear or Hero, then back to the map). Do not steer around things to make the numbers look good.
8. Open Settings again (the dev row stays revealed for the session) and read the line under the Start button. It reads like: step 7.4 / 12.1 / 30.2 · dispatch 1.1 / 2.0 / 4.0 · paint 3.2 / 6.0 / 9.9 · draw 1.9 / 4.3 / 7.7 ms (med / p95 / max, n=57) — three numbers per row are median / p95 / max in milliseconds; n is the number of steps in the ring (last 100). Optional cross-check: `adb logcat -s chromium | grep mzperf` prints the same numbers as JSON every 10 steps.
9. Report back in this shape, copying the numbers exactly as shown (do not round): step med / p95 / max, n; dispatch med / p95 / max; paint med / p95 / max; draw med / p95 / max; device build number (Settings → About phone → Build number); APK commit (from the Build line above); jank — anything you saw and where (a stutter on a step, a late repaint, a tab flash) — or "none".
10. Then run the v1.6 UAT batch (docs/UAT-v1.6.md, 26 items) on the same APK; its results go to the milestone close, not to this phase.
```

## Device report

(appended by the orchestrator after the Pixel 7 session — Plan 49-02 stops if this section has no numbers)

## Judgment calls for the user

1. The instrumentation stays dev-gated rather than being removed — a full revert is one commit if the user wants it out entirely.
2. `dispatch` is the fourth row's name because it brackets `dispatchWithNarration` — engine action + narration fold + rail-card push — not the raw engine call in isolation.
3. The readout shows `max` as well as `med`/`p95`, so the device report needs no `adb logcat` cross-check to be complete (though the logcat line is there if wanted).
4. The `step` row brackets the whole `stepWith` body (dispatch through the trailing `draw()`, the Oracle log append, and the camera nudge) — a superset of "dispatch to the end of paint." It can only over-report per-step cost, never under-report it.

## User Setup Required

None — no external service configuration required. The Pixel 7 device session (installing/running the debug APK the orchestrator builds after this plan) is the in-phase human verification step; see "User checklist" above.

## Next Phase Readiness

- 49-02 is ready to run once the orchestrator builds the debug APK and the user completes the checklist above; this doc's "Device", "BEFORE", "Jank report", "Decision", and "AFTER" sections are the exact hand-off points.
- PERF-01 is intentionally left un-checked in REQUIREMENTS.md — 49-02 marks both PERF-01 and PERF-02 complete together once the fix-or-no-fix decision is made.
- No blockers.

---
*Phase: 49-measure-first-perf-pass*
*Completed: 2026-09-20*
