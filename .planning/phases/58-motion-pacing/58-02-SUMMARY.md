---
phase: 58-motion-pacing
plan: 02
subsystem: ui
tags: [combat-beat, reveal-sequencing, timers, audio, sfx, node-test]

# Dependency graph
requires:
  - phase: 56-sound-effects-audio-settings (plan 04)
    provides: "src/browser/sfx.js's Phase 56 audio contract — CLIP_IDS, groupsForDispatch, clipsForDispatch, playForDispatch, unlockSfx, applySfxSettings, playUiTap, stopAllSfx, and the injectable Web Audio backend"
provides:
  - "src/browser/combatBeat.js — the pure combat-beat core: BEAT_GAP_MS, beatOffsets, beatEndMs, lineIdxsFor, cueLines, foeFrames, heroFrames, frameStateFor, planBeat (pure half); createBeat, createBeatRunner (timed half)"
  - "src/browser/sfx.js#cuesForDispatch/#playClipIds — clipsForDispatch is now the clip projection of cuesForDispatch (each cue carries its source event index); playClipIds plays an already-resolved clip list through the existing device/Sound-Off-guarded path"
  - "test/unit/combat-beat.test.js (30 tests) and test/unit/sfx-cues.test.js (7 tests) pinning both modules"
affects: [58-06-motion-pacing-shell-wiring, 58-07-motion-pacing-audio-beat-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable timer controller (createBeat({setTimeout, clearTimeout, reduced})) rather than a direct setTimeout/clearTimeout call — keeps combatBeat.js free of any window/document read and makes the whole timed half testable with a synchronous fake timer queue."
    - "clipsForDispatch/groupsForDispatch redefined as thin projections of new cuesForDispatch/groupEntriesForDispatch internals — a derived-API pattern that makes 'the old behaviour is unchanged' true by construction rather than by parallel maintenance."
    - "Cue ownership by nearest-preceding-line-index (cueLines' 'greatest idx <= cue idx, ties to the earlier line' rule) — a general algorithm for attributing a flat timeline of dated items to a coarser set of buckets, reusable wherever Phase 58's later plans need to align sound/animation to a reveal line."

key-files:
  created:
    - src/browser/combatBeat.js
    - test/unit/combat-beat.test.js
    - test/unit/sfx-cues.test.js
    - .planning/phases/58-motion-pacing/deferred-items.md
  modified:
    - src/browser/sfx.js

key-decisions:
  - "planBeat's mid-fight firstId formula uses afterLog.nextId - count directly (falling back to lines.length when afterLog is omitted) rather than requiring afterLog always be present — keeps the function defensive for a caller that has not yet built afterLog, per the plan's own null-return contract."
  - "cueLines(cues, []) (empty idxs) returns a single-bucket [[...all clips]] array rather than [] — chosen because 'Empty idxs puts everything in line 0' in the plan's behaviour bullet requires SOME bucket to exist to hold the clips; documented explicitly in the function's JSDoc."
  - "createBeat's finalization step (the delay from the last line's offset to endMs) fires onEnd SYNCHRONOUSLY when that delay is exactly 0, instead of always scheduling a timer — matches the plan's explicit 'with endMs 0, onEnd fires synchronously right after onLine(0)' behaviour bullet, and generalizes correctly to the common case where the last line's own typing duration is 0."
  - "Task 2's teeth check required rewriting the originally-planned 'ten dispatches sharing one variation, compare cuesForDispatch against clipsForDispatch' test: since clipsForDispatch now DELEGATES to cuesForDispatch (D-12's whole point), sabotaging cuesForDispatch's variation handling breaks clipsForDispatch identically, so a same-vs-same comparison has no teeth. Rewrote the test to compare against an INDEPENDENT reference variation fed the same group-id sequence (via groupsForDispatch, which is unaffected by variation) — this correctly fails under the teeth mutation. See Deviations below."

requirements-completed: [MOTION-03, MOTION-05]

coverage:
  - id: D1
    description: "The pure combat-beat core (schedule, line/event alignment, payload-only HP frames, lossless cue ownership, the mid-fight/ending beat plan) is pure, non-mutating, and imports only fightLog.js/narrationLines.js — no engine/content import, no rng, no window/document read"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat.test.js — 18 Task 1 tests (schedule, alignment corpus, cueLines ownership, foeFrames/heroFrames payload-only rule, frameStateFor, planBeat null/mid-fight/ending/non-mutation/cueLines-exposure, source-pin scan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The timed beat controller lands the first exchange immediately, paces the rest ~600ms apart, hurries losslessly (no line ever skipped), resolves synchronously under reduced motion (including a mid-beat OS-preference flip), and the runner sequences render+sound per line exposing the view() contract plan 58-06 will consume"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/combat-beat.test.js — 12 Task 2 tests (createBeat schedule/hurry/reduced/reduced-mid-tick/cancel/start-while-active/single-line, createBeatRunner render+play/ending-plan/hurry/hitFoe/start(null))"
        status: pass
    human_judgment: false
  - id: D3
    description: "src/browser/sfx.js#cuesForDispatch carries each clip's source event index with an IDENTICAL clip sequence to the pre-existing clipsForDispatch (now its projection); playClipIds plays an already-resolved clip list through the same Sound-Off-guarded path; every pre-existing Phase 56 sfx test passes byte-unchanged"
    requirement: "MOTION-03"
    verification:
      - kind: unit
        ref: "test/unit/sfx-cues.test.js — 7 tests (corpus equivalence, 10-dispatch shared-variation rotation vs an independent reference, idx correctness, groupsForDispatch literal pins, playClipIds behaviour, teeth)"
        status: pass
      - kind: unit
        ref: "test/unit/sfx.test.js (37), test/unit/sfx-map.test.js (17), test/unit/sfx-settings.test.js (14) — all 68 passing, byte-unchanged from BASE_58"
        status: pass
      - kind: other
        ref: "git diff --stat a01b38e08b98e36ed1939d9d1fe1538eee6237b1 -- test/unit/sfx.test.js test/unit/sfx-map.test.js test/unit/sfx-settings.test.js -> empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "The engine gate holds: engine/, content/, test/parity/ are byte-identical to BASE_58"
    verification:
      - kind: other
        ref: "git diff --stat a01b38e08b98e36ed1939d9d1fe1538eee6237b1..HEAD -- engine/ content/ test/parity/ -> empty"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 02: Combat Beat Core + sfx.js Cue Split Summary

**Pure combat-beat core (`src/browser/combatBeat.js`: reveal schedule, per-exchange HP frames, cue ownership, beat plan, timer-driven hurry/reduced-motion controller, render+sound runner) plus `sfx.js`'s `cuesForDispatch`/`playClipIds` split — every one of the 68 pre-existing Phase 56 sfx tests still passes byte-unchanged.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 4 created, 1 modified

## Accomplishments

- `src/browser/combatBeat.js` created: the pure half (`BEAT_GAP_MS`, `beatOffsets`, `beatEndMs`, `lineIdxsFor`, `cueLines`, `foeFrames`, `heroFrames`, `frameStateFor`, `planBeat`) sequences a combat round's already-resolved events into a line-by-line reveal plan with payload-only HP frames — no engine/content import, no rng, no argument ever mutated. The timed half (`createBeat`, `createBeatRunner`) drives that plan through an injected timer: the first exchange lands synchronously, later exchanges land ~600ms apart (never cutting off a still-typing line), a tap-to-hurry flushes every remaining line losslessly then settles once, and reduced motion resolves the whole beat synchronously — including a flip mid-beat, honoured on the very next tick.
- `src/browser/sfx.js` gained `cuesForDispatch`/`playClipIds` (D-12): `clipsForDispatch` and `groupsForDispatch` are now thin projections of new internal `cuesForDispatch`/`groupEntriesForDispatch`, so "the per-dispatch clip set is unchanged, only its timing moves" holds by construction rather than by parallel maintenance. Each cue now carries the source event's own array index (-1 for the synthesized step clip), which is what will let Phase 58-07 fire a clip with the fight-log line that folded its source event. `playClipIds` plays an already-resolved clip list through the exact same device/Sound-Off-guarded `playClips()` path every other clip already uses.
- `test/unit/combat-beat.test.js` (30 tests) and `test/unit/sfx-cues.test.js` (7 tests) pin both modules, with the two required teeth checks run manually (foeFrames' ambiguous-name guard; createBeat's hurry-loses-nothing guarantee; cuesForDispatch's shared-counter contract) — each confirmed to fail the tests it should, then reverted byte-identical (verified with `diff`).
- Every pre-existing Phase 56 sfx test (`sfx.test.js` 37, `sfx-map.test.js` 17, `sfx-settings.test.js` 14 — 68 total) passes unedited; `git diff --stat` against BASE_58 for those three files is empty.
- Engine gate holds: `engine/`, `content/`, `test/parity/` are byte-identical to BASE_58 (`a01b38e08b98e36ed1939d9d1fe1538eee6237b1`).

## Task Commits

Each task was committed atomically:

1. **Task 1: combatBeat.js pure half — schedule, alignment, HP frames, cue ownership, beat plan** - `35ebada` (test)
2. **Task 2: combatBeat.js timed half — createBeat controller and createBeatRunner** - `e4f1244` (test)
3. **Task 3: sfx.js cuesForDispatch/playClipIds split (D-12)** - `8f91bba` (feat)

## Files Created/Modified

- `src/browser/combatBeat.js` - the pure combat-beat core: reveal schedule, line/event alignment, payload-only HP frames, lossless cue ownership, mid-fight/ending beat plan, timer-driven hurry/reduced-motion controller, render+sound runner
- `test/unit/combat-beat.test.js` - 30 tests, one per Task 1/2 behaviour bullet, plus a source-pin scan (import specifiers, no window/document, no Math.random)
- `src/browser/sfx.js` - added internal `groupEntriesForDispatch`, exported `cuesForDispatch`/`playClipIds`; `groupsForDispatch`/`clipsForDispatch` redefined as their projections
- `test/unit/sfx-cues.test.js` - 7 tests: corpus equivalence, 10-dispatch shared-variation rotation, idx correctness, `groupsForDispatch` literal pins, `playClipIds` behaviour, a teeth case
- `.planning/phases/58-motion-pacing/deferred-items.md` - new: logs 16 pre-existing, out-of-scope `npm test` failures found during this plan's phase-gate run

## Decisions Made

See `key-decisions` in the frontmatter above (planBeat's defensive `firstId` fallback; `cueLines([], [])`'s single-bucket return; `createBeat`'s synchronous-onEnd-at-zero-delay finalization; the Task 2 teeth-check test rewrite necessitated by `clipsForDispatch` now delegating to `cuesForDispatch`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own draft, caught before commit] The plan's literal "ten dispatches sharing one variation per side, the two sides still match" teeth-check design had no teeth once implemented**
- **Found during:** Task 3, running the required teeth check (temporarily giving `cuesForDispatch` its own separate `createVariation()`)
- **Issue:** My first draft of the sequence test compared `cuesForDispatch(vCues)` against `clipsForDispatch(vClips)` directly. Since `clipsForDispatch` is now DEFINED as `cuesForDispatch(...).map(c => c.clip)` (the whole point of D-12's projection design), sabotaging `cuesForDispatch`'s variation handling breaks `clipsForDispatch` identically — both sides go wrong the same way, so the comparison still passed under the teeth mutation instead of failing.
- **Fix:** Rewrote the test to compute an expected clip sequence independently: `groupsForDispatch` (unaffected by variation) supplies each dispatch's entry ids, and a separate reference `createVariation()` instance resolves them in call order across the whole ten-dispatch sequence. Both `cuesForDispatch` and `clipsForDispatch` are then asserted against that independent reference, per dispatch. Confirmed this version fails under the teeth mutation (reverted `git diff` byte-identical after) and passes on the real implementation.
- **Files modified:** test/unit/sfx-cues.test.js (before the file was ever committed — no separate commit)
- **Verification:** `node --test test/unit/sfx-cues.test.js` — 7/7 passing on the real implementation; manually re-applied the teeth mutation and confirmed test 2 (`not ok`) failed, then reverted and re-confirmed all 7 pass.
- **Committed in:** `8f91bba` (Task 3 commit — the corrected test was the only version ever committed)

**2. [Rule 1/3 - out-of-scope pre-existing failures, logged not fixed] 16 pre-existing `npm test` failures unrelated to this plan**
- **Found during:** Task 3's phase-gate `npm test` run
- **Issue:** `npm test` reports 3654/3670 passing (16 failing) rather than the plan's target `fail 0`. All 16 span unrelated subsystems: `test/parity/divergence-records.test.js` (a RESEARCH.md/divergence doc scan), `test/unit/flee-ledger.test.js` (the FLEE modifier content table), and `test/unit/shell-tab-snapshots.test.js` (Thief/Magic User DOM tab snapshots).
- **Fix:** None applied — verified pre-existing by fully reverting `src/browser/sfx.js` to its last-committed state (removing every change this plan made) and re-running `test/unit/shell-tab-snapshots.test.js` directly: the same 7 of those 16 failures persisted identically with zero code from this plan present. `combatBeat.js`/`sfx-cues.test.js` are new files that cannot affect DOM snapshots, doc scans, or a content balance table. Logged to `.planning/phases/58-motion-pacing/deferred-items.md` per the scope-boundary rule (out-of-scope discoveries are logged, not fixed) rather than attempted here.
- **Files modified:** `.planning/phases/58-motion-pacing/deferred-items.md` (new)
- **Verification:** `node --test test/unit/shell-tab-snapshots.test.js` with `sfx.js` reverted to `HEAD` (pre-Task-3) — same 7 failures reproduced, confirming they predate this plan's changes.
- **Committed in:** `8f91bba` (Task 3 commit, docs-only addition)

---

**Total deviations:** 2 — 1 self-correction to my own test design (caught by running the plan's own required teeth check before committing, never landed in a bad state), 1 out-of-scope discovery logged per the scope-boundary rule.
**Impact on plan:** None on scope or correctness of this plan's deliverables. The pre-existing failures are a pre-existing condition of the worktree's base state, not introduced or worsened by this plan.

## Issues Encountered

- None beyond the two items above (both resolved/logged before the final commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/browser/combatBeat.js`'s pure half, timed controller and runner are ready for Plan 58-06 to wire into the module script: `onRender` is `window.renderEncounter`, `onSettle` is the deferred paint+render, `durationFor` is 58-01's `typeDurationMs`, and the runner is bridged as `window.__mzBeat`.
- `sfx.js#cuesForDispatch`/`playClipIds` are ready for Plan 58-07 to pass the dispatch's cues into `planBeat({ cues })` and play them through `playClipIds` per line. Until 58-07 lands, `clipsForDispatch`'s existing dispatch-time call site in `dispatchWithNarration` is untouched — sound still fires at dispatch time, as documented in the plan's `key_links`.
- No blockers. `.planning/phases/58-motion-pacing/deferred-items.md` flags 16 pre-existing `npm test` failures (DOM tab snapshots, a parity/divergence doc scan, the flee-ledger content table) for the orchestrator/a later phase to triage — unrelated to Phase 58's motion/pacing scope.

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred during this plan and no APK was built. This plan produces no directly device-observable behavior on its own (the beat/audio wiring lands in 58-06/58-07); nothing new is queued here for the Phase 60 batch beyond what those later plans will add.

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: src/browser/combatBeat.js
- FOUND: test/unit/combat-beat.test.js
- FOUND: test/unit/sfx-cues.test.js
- FOUND: .planning/phases/58-motion-pacing/deferred-items.md
- FOUND: commit 35ebada
- FOUND: commit e4f1244
- FOUND: commit 8f91bba
