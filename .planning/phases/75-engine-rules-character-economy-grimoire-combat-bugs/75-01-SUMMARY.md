---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 01
subsystem: testing
tags: [root-cause-session, combat-beat, trap, hp-display, regression-test]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "rollRange.js formatter, the cross-surface sign guard, roll-high event fields — the surface this session's re-verification checked for regressions"
provides:
  - "the resumed RULES-06 debug session (.planning/debug/trap-death-21hp-oracle-minus1.md): re-verified evidence, a 500-seed/197k-action engine-scale reproduction, an 8-path shell-level HP-readout audit, a root_cause_found Verdict, and Fix inputs for 75-08"
  - "test/unit/trap-death-repro.test.js: four passing regression pins (trap-narration-equals-actual-loss, the re-verified planBeat last-frame fix, blind spot 1's bounded non-actionable behavior)"
affects: [75-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine-scale reproduction driven through the tuning bot's own decideAction/applyAction policy from newRun(seed, [], { startDepth, force }) — never hand-built events — for a real, at-scale root-cause check"
    - "Shell-level HP-readout audit reusing combat-beat-shell.test.js's own real-beat-runner-against-sandbox technique, extended to a deliberately worst-case K-of-M multi-swing fold across all 8 named beat-ending paths"

key-files:
  created:
    - test/unit/trap-death-repro.test.js
  modified:
    - .planning/debug/trap-death-21hp-oracle-minus1.md

key-decisions:
  - "Verdict: root_cause_found — the 2026-09-22 combatBeat.js last-frame fix (already shipped, already tested) fully explains the reported symptom's shape; no NEW cause reproduces on master after Phases 73/74, so test/unit/trap-death-repro.test.js carries zero { todo: true } cases per the plan's own instruction"
  - "The engine-scale reproduction's 18 raw (ii) hits are explained (not counted as bugs): death.js#die() clamps c.wp to exactly 0 on an overkill blow, so a narrated loss can legitimately exceed the clamped actual change — the opposite shape from the report, not the same bug"
  - "Blind spot 1 (the intermediate, non-last K-of-M fold frame) is confirmed STILL present via a live shell reproduction, but confirmed NEVER exposed at an actionable moment (action buttons stay disarmed for the whole beat, per combat-beat-shell.test.js's own test 4) — recorded as a bounded, non-fatal, optional-fix item in Fix inputs, not a todo case"

requirements-completed: [RULES-06]

coverage:
  - id: D1
    description: "The 2026-09-22 debug session is resumed (not restarted): every prior finding — planBeat's last-frame pin, springTrap's dmg/narration agreement, the trappedPanic/afflictionTick >=1hp clamps, formatEvents' full event coverage — is re-verified byte-for-byte on master after Phases 73/74"
    requirement: "RULES-06"
    verification:
      - kind: unit
        ref: "node --test test/unit/combat-beat.test.js (31/31 pass, including the pre-existing last-frame regression)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An engine-level reproduction runs the real engine (applyAction, the tuning bot's own policy) from a dev start at depth 2 over 500 seeds (250 forced Elven Ninja), recording hp before/after and every hp-changing event's narrated amount for 197,377 actions, and answers the three must-haves counts: (i) 0 under-narrated fatal deaths, (ii) 18 explained (not bug) mismatches, (iii) 0 last-frame overstatements across 2,207 fight endings"
    requirement: "RULES-06"
    verification:
      - kind: other
        ref: "scratchpad script 75-01-trap-death-repro.mjs (never committed — reproduction is a documented, evidence-bearing one-off run, not a permanent CI gate); full JSON output recorded in the debug file's Phase 75 session"
        status: pass
    human_judgment: false
  - id: D3
    description: "A shell-level audit (reusing combat-beat-shell.test.js's real-beat-runner-against-sandbox technique) compares every visible hero-HP readout (#mw-hud-wp, the YOUR LOT hero card) against state.c.wp on all 8 named beat-ending paths (natural settle, hurry, tab switch, flee, a kill, a superseded dispatch, the over-panel dismiss, reduced motion), under a deliberately worst-case K-of-M multi-swing fold — zero mismatches at any actionable moment"
    requirement: "RULES-06"
    verification:
      - kind: other
        ref: "scratchpad script 75-01-shell-audit.mjs (never committed); the 8-path result table is recorded in the debug file's Phase 75 session"
        status: pass
    human_judgment: false
  - id: D4
    description: "The debug file ends the session with status root_cause_found, a Phase 75 findings section naming the confirmed cause (already-fixed, re-verified), its category (display), the exact file/function, and the assertion the fix already makes true; every confirmed cause is encoded as a test — here, as 4 PASSING pins (not todo cases, since no new cause was confirmed) in test/unit/trap-death-repro.test.js"
    requirement: "RULES-06"
    verification:
      - kind: unit
        ref: "node --test test/unit/trap-death-repro.test.js (5/5 pass — 2 trap-narration pins, 1 re-verified last-frame pin, 1 blind-spot-1 bounded-behavior pin, plus the file's own setup)"
        status: pass
    human_judgment: false

# Metrics
duration: ~70min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 01: Engine Rules — RULES-06 Trap-Death Root-Cause Session (resumed) Summary

**Resumed and closed the RULES-06 root-cause session at scale: 500 seeds / 197,377 real engine actions and an 8-path shell-level HP-readout audit both confirm the 2026-09-22 combatBeat.js fix fully explains the reported symptom, with zero new anomalies found — Verdict root_cause_found, zero code fix needed, zero todo test cases.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **Re-verified every 2026-09-22 finding on current master** (after Phases 73's roll-high rework and 74's display-honesty pass): `planBeat`'s last-hero-hp-frame pin (`src/browser/combatBeat.js`) is unchanged and its regression test still passes; `springTrap`'s `dmg` computation and its `trapSprung` event still share the exact same local variable (Phase 73 changed only the event's `roll`/`atLeast`/`dieN` triple, never `dmg`); `trappedPanic`/`afflictionTick`'s `>=1 hp` clamps are unchanged; `formatEvents` still narrates every hp-changing event.
- **A real, at-scale engine-level reproduction** — the tuning bot's own `decideAction`/`applyAction` policy, driven from `newRun(seed, [], { startDepth: 2, ... })`, over 500 seeds (250 unforced, 250 forced `{ race: "Elven", sub: "Ninja" }` — the report's own identity), 197,377 total actions, 2,207 fight endings. All three must-haves counts came back clean: **0** deaths with an under-narrated fatal loss, **0** last-frame overstatements, and the 18 raw "loss-vs-actual-change" hits were all traced to two benign, fully-explained measurement artifacts (the death clamp in `engine/death.js#die()` setting `c.wp = 0` on an overkill blow, and a self-heal ability riding the same dispatch as a foe's hit) — neither matches the reported bug's shape.
- **A shell-level HP-readout audit across all 8 named beat-ending paths** (natural settle, hurry, tab switch, flee, a kill, a superseded dispatch, the over-panel dismiss, reduced motion), reusing `test/unit/combat-beat-shell.test.js`'s own real-beat-runner-against-sandbox technique with a deliberately worst-case K-of-M multi-swing fold (an Ogre landing two swings, 8+9=17, folded to one fight-log line). `#mw-hud-wp` (the top HUD) and the YOUR LOT hero card both read the correct, engine-true hp (`38/55`) on every single path.
- **Confirmed blind spot 1 (the intermediate, non-last fold frame) is still present, live, via a fresh shell reproduction** — a follow-up scenario where the K-of-M fold is genuinely not the round's last line still shows the transient under-count (`47/55` instead of the true `38/55` at that point). But it is **never** the frame a player can act on: `combat-beat-shell.test.js`'s own test 4 already proves the action buttons stay disarmed for the whole beat, and the round's own last frame (the number that persists into the actionable moment) is always correct.
- **Recorded the Verdict (`status: root_cause_found`)** in the debug file: the existing 2026-09-22 fix fully explains the reported symptom; no new, different root cause reproduces on current master. Fix inputs for plan 75-08: no code fix required — 75-08's job is to promote this session's two ad hoc scratchpad scripts (the engine-scale reproduction and the 8-path shell audit) into permanent, committed regression tests, so the two standing guards CONTEXT.md names (every readout matches engine truth wherever the player can act; no hp loss goes un-narrated) become mechanically enforced going forward, not just true-today.
- **`test/unit/trap-death-repro.test.js`** — 4 new passing tests (built directly, per the plan's own instruction, "the way combat-beat.test.js and encounters.test.js do" — no shell harness, no applyAction, hand-built states): the report's own `-1 HP`-on-21-hp shape survives cleanly; an overkill trap clamps to exactly 0 (the death-clamp shape the engine-scale run's (ii) count needed explaining); the last-frame fix re-pinned with a freshly-built K-of-M fixture; blind spot 1's transient-but-bounded-to-non-actionable-moments behavior documented as a passing pin, not a todo case.

## Task Commits

All three tasks (re-verify + engine-scale reproduction; shell-level 8-path audit; Verdict + Fix inputs + regression tests) landed in a single commit — they are three tightly-coupled edits to the SAME two files (the debug file's one continuous Phase 75 session, and one test file whose final shape only exists once all three tasks' findings are known), so splitting them into three intermediate commits would have produced no independently-meaningful rollback points.

1. **Tasks 1–3: resume, reproduce at scale, audit the shell, record the Verdict** — `daaf5d4` (test)

_No plan-metadata commit and no STATE.md/ROADMAP.md/REQUIREMENTS.md updates — this is a parallel worktree plan; the orchestrator handles those after all wave agents complete._

## Files Created/Modified

- `test/unit/trap-death-repro.test.js` — new: 4 passing regression pins for the RULES-06 investigation.
- `.planning/debug/trap-death-21hp-oracle-minus1.md` — appended `## Phase 75 session (2026-09-25)`: re-verification, the engine-scale reproduction's counts and hit examples, the 8-path shell audit table, blind spot 1's confirmed-but-bounded status, the `### Verdict` and `### Fix inputs` subsections, and two new `## Eliminated` entries. All prior sections (Symptoms, Hypotheses, Evidence, Eliminated, Resolution) kept unchanged as history.

## Decisions Made

- **Verdict is `root_cause_found`, not a new todo-marked cause.** The plan's own Task 3 `<behavior>` block is explicit: "If nothing reproduces, the file contains no todo tests and no 'RULES-06 cause:' names, and the debug file says so." Since the EXISTING cause (already fixed, already tested) re-verified cleanly and no NEW cause reproduced across 197k actions and the full 8-path shell audit, `test/unit/trap-death-repro.test.js` carries zero `{ todo: true }` cases — confirmed via `grep -c "RULES-06 cause:" test/unit/trap-death-repro.test.js` = 0.
- **The 18 raw engine-scale "mismatch" hits are explained, not treated as a 4th finding.** Each is a death dispatch where `death.js#die()`'s `c.wp = 0` clamp makes the narrated loss read LARGER than the clamped actual change (an overkill blow, the opposite of the reported under-narrated-kill shape) or a `secondWindHealed` self-heal riding the same dispatch as a hit (the crude per-event sum doesn't net two independently-correct numbers). Documented with a worked example (seed 1169) in the debug file rather than silently dropped, so a future reader can verify the reasoning rather than trust the count alone.
- **Blind spot 1 stays confirmed-but-open, not fixed.** The 2026-09-22 session deliberately scoped its fix to only the LAST frame of an ending round (the one guaranteed to be on screen before settle). This session confirmed that scope decision remains sound (the transient intermediate under-count is never actionable) rather than silently expanding the fix's surface — an optional, non-required tightening is offered to 75-08 in Fix inputs for if there's budget, but the Verdict does not require it.
- **Both scale-reproduction scripts stay in the session scratchpad, never committed** — per the plan's own instruction ("Write a scratch reproduction in the session scratchpad (never committed)"). 75-08 is pointed at promoting their TECHNIQUE (not the literal files) into permanent tests, as one of the two Fix inputs.

## Deviations from Plan

None - plan executed exactly as written. The plan's own `<flagged_assumption>` anticipated this exact outcome ("If the scale reproduction finds no engine or narration fault, the verdict is 'display-only causes', and success criterion 4's... is then guaranteed by 75-08's two standing guards rather than by an engine change") — that is precisely what was found.

## Issues Encountered

- The initial engine-scale reproduction script's crude "narrated-loss-sum vs actual-hp-change" comparison flagged 18 false-positive "mismatches" before the death-clamp/heal-in-same-dispatch causes were identified and the script's own heal-event exclusion list was corrected — resolved by tracing each hit to its explanation (documented in the debug file) rather than either dropping them silently or mis-recording them as a new finding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 75-08 (the RULES-06 fix and its two standing guards) has everything it needs: a confirmed Verdict (`root_cause_found`, no code change required), and two named, evidence-backed Fix inputs (promote the engine-scale reproduction's event-narration inventory into a permanent guard; promote the 8-path shell audit into a permanent regression test) — both already proven true by this session, so 75-08's job is to make them permanent, not to fix new bugs.
- `test/unit/trap-death-repro.test.js` is a new, standing file plan 75-08 (or any later plan) can extend with more cases if a future regression is ever suspected in this area.
- No blockers. No known stubs. No new threat surface (this plan touched only a debug doc and a test file — no production code, no new event types, no new endpoints).

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/trap-death-repro.test.js
- FOUND: .planning/debug/trap-death-21hp-oracle-minus1.md
- FOUND: .planning/phases/75-engine-rules-character-economy-grimoire-combat-bugs/75-01-SUMMARY.md
- FOUND commit: daaf5d4 (Tasks 1-3)
