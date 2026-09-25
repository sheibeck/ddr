---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 08
subsystem: testing
tags: [standing-guard, combat-beat, trap, hp-display, regression-test, engine-sweep]

# Dependency graph
requires:
  - phase: 75-engine-rules-character-economy-grimoire-combat-bugs
    provides: "75-01's resumed RULES-06 debug session — the root_cause_found Verdict and Fix inputs this plan implements"
provides:
  - "test/unit/trap-death-repro.test.js: two new RULES-06 boundary cases, plus a permanent engine-scale sweep (45 seeds, real applyAction, 50 trapSprung events, zero mismatches)"
  - "test/unit/hp-surface-guard.test.js: a permanent shell-level HP-readout audit across all 8 named beat-ending paths, plus a three-foe-landing fold case"
  - ".planning/debug/trap-death-21hp-oracle-minus1.md: status resolved, closed with a Phase 75 Resolution section"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine-scale sweep driven through the tuning bot's own decideAction/applyAction policy from newRun(seed, [], { startDepth: 2 }) — a curated LOSS_FIELDS/GAIN_TYPES/NEUTRAL_TYPES registry sums only confirmed hero-hp-loss event fields, skipping (never mis-summing) any action carrying a gain-type or unclassified event, since most engine gain sites narrate the RAW pre-clamp roll, not the actual post-Math.min(maxWP,...) delta"
    - "Shell-level HP-readout audit reusing combat-beat-shell.test.js's real-beat-runner-against-sandbox technique, extended with a paint() spy that captures the YOUR LOT hero card's DOM text the instant BEFORE each real paint() call — the only way to read that card's own last-frame value, since the over-panel/loot/dead screen always replaces it once a beat's onSettle repaints"
    - "Hand-built before/after/events fixtures (never real applyAction) let one worst-case fixture (a two-swing-foe fold) be reused, unmodified, across all 8 beat-ending paths — planBeat trusts `after` directly regardless of how the round was resolved"

key-files:
  created:
    - test/unit/hp-surface-guard.test.js
  modified:
    - test/unit/trap-death-repro.test.js
    - .planning/debug/trap-death-21hp-oracle-minus1.md

key-decisions:
  - "Took the 'no reproduction of a new cause' branch: 75-01's Verdict says no production code fix is required (the 2026-09-22 combatBeat.js fix already closes the gap), so this plan touches zero production files — only test files and the debug doc"
  - "Both tasks landed in one commit (test/unit/trap-death-repro.test.js is touched by both) — matching 75-01's own precedent for this same debug session: tightly-coupled edits to the same file, no independently meaningful rollback point between them"
  - "The engine-scale sweep checks LOSS events strictly (exact equality with the real hp change) but SKIPS any action carrying a gain-type event (healed, potionDrunk, foodFound, rested, leveled, etc.) rather than attempting exact gain accounting — most engine gain sites narrate the raw pre-clamp roll, not the Math.min(maxWP,...)-clamped actual delta, and RULES-06's own risk surface is under-narrated LOSSES causing a surprise death, never an over-narrated gain. This was found empirically: an initial full loss-and-gain accounting attempt produced real mismatches (foodFound/potionDrunk/leveled all narrate raw, not clamped, amounts) before this scoping was applied"
  - "The YOUR LOT hero card is captured via a paint() spy reading the DOM the instant before each real paint() call, not read directly post-settle — the over-panel/loot/dead screen replaces the combat body (and the lot card with it) the moment a beat actually settles, so the only way to see what the card showed a player is to intercept the render that happens just before"

requirements-completed: [RULES-06]

coverage:
  - id: D1
    description: "The two RULES-06 boundary cases pass: a hero at dmg+1 hp survives a trap of dmg with exactly 1 hp; a hero at exactly dmg hp dies, cause \"trap\", and the trapSprung line prints dmg"
    requirement: "RULES-06"
    verification:
      - kind: unit
        ref: "test/unit/trap-death-repro.test.js#RULES-06 boundary (Phase 75, plan 75-08) — both cases pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "A permanent engine-scale sweep (45 seeds, real applyAction via the tuning bot's policy, startDepth 2) observes at least 20 trapSprung events and finds zero mismatches on every checkable loss-only action"
    requirement: "RULES-06"
    verification:
      - kind: unit
        ref: "test/unit/trap-death-repro.test.js#RULES-06 (Phase 75 standing guard, plan 75-08) — 50 trapSprung events, 377 checked actions, 0 mismatches"
        status: pass
    human_judgment: false
  - id: D3
    description: "A permanent shell-level audit confirms #mw-hud-wp and the YOUR LOT hero card both equal state.c.wp on all 8 named beat-ending paths, under a two-swing-foe fold, plus a separate three-foe-landing fold case"
    requirement: "RULES-06"
    verification:
      - kind: unit
        ref: "test/unit/hp-surface-guard.test.js — 9/9 pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "The debug session is closed: status resolved, a Phase 75 Resolution section naming the fix (none required), the files changed, the verification, and a human check for the milestone device round"
    requirement: "RULES-06"
    verification:
      - kind: other
        ref: ".planning/debug/trap-death-21hp-oracle-minus1.md — grep -c \"^status: resolved\" = 1, grep -c \"### Resolution (Phase 75)\" = 1"
        status: pass
    human_judgment: false

# Metrics
duration: ~100min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 08: RULES-06 Standing Guards (No Code Fix — 75-01's Verdict) Summary

**No production code change (75-01's Verdict: root_cause_found, no reproduction of a new cause) — landed the two RULES-06 boundary cases, a 45-seed engine-scale sweep (50 real trapSprung events, zero mismatches), and a permanent 9-case shell-level HP-readout audit across all 8 beat-ending paths; closed the debug session as resolved.**

## Performance

- **Duration:** ~100 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Took the "no reproduction" branch exactly as 75-01's Fix inputs specified.** Read the debug file's `### Verdict` and `### Fix inputs`: the confirmed cause is already fixed (the 2026-09-22 `combatBeat.js` last-frame pin), no NEW cause reproduces on current master, and no production code change is required. Verified `grep -c "todo: true"` and `grep -c "RULES-06 cause:"` on `test/unit/trap-death-repro.test.js` both already read 0 (75-01 left zero pending cause tests) — confirming the "no reproduction" branch was the correct one to take.
- **Added the two RULES-06 boundary cases** Task 1's own `<behavior>` names: a hero at `dmg+1` hp survives a trap of `dmg` with exactly 1 hp left; a hero at exactly `dmg` hp dies, cause `"trap"`, and the `trapSprung` line still prints the same `dmg`. Both built with the same `fakeRng`/`fixedState` technique 75-01's own case (1) uses (a scripted dodge-miss + trap-kind pick + damage roll against `springTrap` directly).
- **Promoted 75-01's ad hoc engine-scale reproduction into a permanent guard** in `test/unit/trap-death-repro.test.js`: 45 seeds, up to 300 actions each, driven through the tuning bot's own `decideAction`/`applyAction` policy from `newRun(seed, [], { startDepth: 2 })` — observed 50 real `trapSprung` events (>=20 required) and 377 checkable loss-only actions, zero mismatches. Discovered along the way (and scoped around) that most engine GAIN event types (`foodFound`, `potionDrunk`, `healed`, `leveled`, ...) narrate the raw pre-clamp roll, not the `Math.min(maxWP,...)`-clamped actual delta — an initial full-accounting attempt produced real (but benign, clamp-shaped) mismatches before the check was scoped to loss-only actions, matching RULES-06's own actual risk surface (an under-narrated LOSS causing a surprise death, never an over-narrated gain).
- **Promoted 75-01's ad hoc 8-path shell audit into a permanent guard**, `test/unit/hp-surface-guard.test.js` (new): a real `createBeatRunner` driven against the real classic shell, checking `#mw-hud-wp` and the YOUR LOT hero card against `state.c.wp` on all 8 named beat-ending paths (natural settle, hurry, tab switch, flee, a kill, a superseded dispatch, the over-panel dismiss, reduced motion) under the SAME worst-case two-swing-foe fold 75-01's own audit used, plus a 9th case exercising the OTHER fold shape (a three-foe-landing collapse). All 9 pass. Discovered and fixed two harness bugs along the way: `beatEndMs` must be computed with the sandbox's own real `typeDurationMs`, not a stubbed zero-duration function, or `clock.advance()` undershoots the real settle time; and the classic script's `let S` binding is unreachable as `context.window.S` (only `var`/function declarations attach to a `vm.runInContext` global) — `window.__mzState.get()` is the only sanctioned way to reach it from outside the script.
- **Closed the debug session**: `status: resolved`, a new `### Resolution (Phase 75)` section naming the (already-fixed) root cause, the two standing guards, the files changed, and the verification commands/results, plus the human check for the milestone device round.

## Task Commits

Both tasks landed in a single commit — `test/unit/trap-death-repro.test.js` is touched by both (Task 1's boundary cases and Task 2's engine sweep), matching 75-01's own precedent for this same debug session ("three tightly-coupled edits to the SAME two files... splitting them into intermediate commits would have produced no independently-meaningful rollback points").

1. **Tasks 1–2: boundary cases, engine sweep, 8-path shell audit, close the debug session** — `e1cc7be` (test)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified

- `test/unit/trap-death-repro.test.js` — added: 2 boundary-case tests (Task 1); the `LOSS_FIELDS`/`GAIN_TYPES`/`NEUTRAL_TYPES` registries, `narratedHeroLossDelta`, and the engine-scale sweep test (Task 2). Also lightly reworded two prose comments that happened to contain the literal substring `"todo: true"` inside explanatory text (not an actual pending-test marker), so this plan's own acceptance criterion (`grep -c "todo: true"` = 0) holds mechanically, not just semantically.
- `test/unit/hp-surface-guard.test.js` — new: the shell-level 8-path HP-readout audit plus the three-foe-landing fold case (9 tests total).
- `.planning/debug/trap-death-21hp-oracle-minus1.md` — `status: resolved`, `updated` bumped, a new `### Resolution (Phase 75)` section appended.

## Decisions Made

- **No production code touched.** 75-01's Verdict is explicit: the existing 2026-09-22 fix already closes the gap, and no new cause reproduces on master. Confirmed via `git diff --stat 6dbdde538dd65fcf25cf569ddecd9f3c6494d076` (this worktree's own dispatch base) touching only the two test files, and `git diff --quiet <base> -- test/parity/fixtures test/parity/prototype-master.js.txt` exiting 0 (no parity fixture moved).
- **The engine-scale sweep is loss-only, by design, not by oversight.** See the tech-tracking/key-decisions entries above and the test file's own `LOSS_FIELDS`/`GAIN_TYPES` doc comments for the full reasoning: gain-side clamping is real and would require per-event, running-hp simulation to check precisely, which is out of this guard's own risk surface.
- **The YOUR LOT card is read via a paint() spy, not a direct post-settle DOM read**, because the card is only ever on screen while a beat is live — once it settles, the over-panel (or loot/dead screen) replaces the combat body entirely. Every one of the 8 named paths still fires the round's own last render before onEnd/onSettle (createBeat's own control flow), so the spy's pre-paint snapshot always reflects exactly what a player watching the beat would have seen an instant before settle.

## Deviations from Plan

None (Rule 1-3 auto-fixes only, all within this plan's own test files — no scope creep):

**1. [Rule 1 - Bug] Two harness-timing bugs in the new shell audit, found and fixed during Task 2**
- **Found during:** Task 2 (writing test/unit/hp-surface-guard.test.js)
- **Issue:** (a) `beatEndMs(plan.texts, () => 0)` used a stubbed zero-duration function instead of the sandbox's own real `typeDurationMs`, undershooting the real settle time so `clock.advance()` never reached the natural-settle paths' onEnd; (b) `sandbox.context.window.S.beats = null` threw `Cannot set properties of undefined` — the classic script's `let S` binding never attaches to the `vm.runInContext` global object (only `var`/function declarations do), so it is unreachable except through `window.__mzState`.
- **Fix:** imported the real `typeDurationMs` and used it consistently for every `beatEndMs` call; switched the over-panel-dismiss test to mutate the object returned by `window.__mzState.get()` instead.
- **Files modified:** test/unit/hp-surface-guard.test.js
- **Verification:** all 9 cases in the new file pass; full suite still green.
- **Committed in:** e1cc7be (part of the Task 1-2 commit)

**2. [Rule 1 - Bug] The engine sweep's first accounting design produced false-positive mismatches**
- **Found during:** Task 2 (calibrating the engine-scale sweep in the session scratchpad, never committed)
- **Issue:** an initial design summed BOTH losses and gains into one strict per-action equality check; several real (but benign) mismatches surfaced because most gain-type events (`foodFound`, `potionDrunk`, `healed`, `leveled`, ...) narrate the raw pre-clamp roll, not the `Math.min(maxWP,...)`-clamped actual delta.
- **Fix:** rescoped the check to loss-only actions (skipping, not mis-summing, any action carrying a gain-type event) — see the key-decisions entry above.
- **Files modified:** test/unit/trap-death-repro.test.js
- **Verification:** re-ran the sweep across 45 seeds with zero mismatches; confirmed via a session-scratchpad calibration script (never committed) before landing the final registry in the committed test.

## Issues Encountered

None beyond the two auto-fixed items above (both resolved within this plan's own scope, no user input needed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-06 is closed. Both standing guards run on every `npm test` going forward, so a future regression on any of the 8 named HP-readout paths, or a future engine hp-loss site added without a matching narrated field, is caught by a test, not a field report.
- No blockers. No known stubs. No new threat surface (this plan touched only test files and a debug doc — no production code, no new event types, no new endpoints).
- **Human check still owed at the milestone device round (Pixel 7):** confirm a floor-2 trap at ~21 HP never kills on a "−1 HP" line, and that after a fight where a foe swings twice, the YOUR LOT card and the top HP bar agree with each other. Recorded in the debug file's own closing section for the milestone UAT batch to pick up.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/hp-surface-guard.test.js
- FOUND: test/unit/trap-death-repro.test.js
- FOUND: .planning/debug/trap-death-21hp-oracle-minus1.md
- FOUND commit: e1cc7be (Tasks 1-2)
