---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 02
subsystem: engine
tags: [effects, timers, cooldowns, parity-carve-out, no-player-visible-behaviour, deferred-uat]

# Dependency graph
requires:
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 01)
    provides: "the v1.5 BEFORE class-matrix pin (BAL-01), landed before any engine byte in this plan"
provides:
  - "engine/effects.js — the single plain-JSON timer/cooldown shape (c.timers[id] = { cadence, left, cd?, phase }) and seven pure functions (startEffect, startCooldown, tickRounds, tickSquares, remaining, isReady, clearRoundTimers) every later v1.5 timer targets"
  - "the three tick sites wired (engine/movement.js per-step tickSquares, engine/combat.js foeTurn-tail tickRounds + endCombat clearRoundTimers), all guarded behind c.timers so no fixture/bot/old-save byte changes until a later phase creates a record"
  - "engine/saveState.js clearStaleTimers(c) — load-tolerance for a present-but-tampered or stale c.timers, mirroring clearFoeEffect"
  - "c.timers carved out of all three test/parity/harness/comparables.js *Comparable() functions plus the three per-domain local comparable() duplicates"
affects: ["38-ability-cooldowns", "39-item-use-effect-cooldown", "40-timed-map-reveal", "41-terrain-effects (TERR-02 water-square step cost)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "engine/effects.js is a second cycle-free leaf module (zero imports) alongside engine/derived.js — every later timer consumer imports it, it imports nothing"
    - "tick functions return { id, from, to } transitions instead of pushing events — the caller narrates, effects.js stays silent (no event vocabulary entry needed)"
    - "c.timers follows the exact lazy-creation / never-injected-on-load / carved-out-of-all-comparables discipline established by c.foeEffect (Phase 19) and c.bag (Phase 12)"

key-files:
  created:
    - engine/effects.js
    - test/unit/effects.test.js
  modified:
    - engine/movement.js
    - engine/combat.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js

key-decisions:
  - "Wrote the full 24-test suite (unit + wiring) as a single Write, then re-split it into two commits matching the plan's own Task 1 / Task 2 boundary (unit tests + effects.js first, wiring tests + the three tick sites second) so the git history reflects genuine RED-then-GREEN TDD gates per task rather than one combined diff — re-verified RED (4 wiring tests failing) before wiring, then GREEN (24/24) after."
  - "stripTimersField's extra wrapping paren was inserted directly after stripBagArmorFields( per the plan's literal instruction (innermost-but-one wrapper around stripFoeEffectField); verified with node --check plus the full parity suite rather than trusting the sed-based paren count by eye."
  - "clearStaleTimers(c) treats a non-plain-object timers value (string/array/number) as a straight `delete c.timers`, and a genuine map as a clearRoundTimers(c) call — mirroring clearFoeEffect's own two-branch shape (null-out vs. leave alone) as closely as the different data types allow."

requirements-completed: [BAL-01]

coverage:
  - id: D1
    description: "engine/effects.js exists as a zero-import pure leaf exporting exactly the seven locked functions; newRun(1).c never carries a timers key"
    requirement: BAL-01
    verification:
      - kind: unit
        ref: "test/unit/effects.test.js (17 unit tests, all pass)"
        status: pass
      - kind: other
        ref: "grep -c '^import' engine/effects.js == 0; grep -c '^export function' == 7; grep -c 'type:' == 0; node -e import check prints the 7 sorted export names"
        status: pass
    human_judgment: false
  - id: D2
    description: "the three tick sites (movement per-step, combat foeTurn tail, combat endCombat) and saveState load-tolerance are wired, each behind an if (c.timers) / if (state.c.timers) guard"
    requirement: BAL-01
    verification:
      - kind: unit
        ref: "test/unit/effects.test.js wiring section (7 tests: move step tick/blocked-step no-op, foeTurn tick/isolation, endCombat clear, no-record invariant, rehydrate/validateSave tolerance including a tampered value, 30-move rng-draw/event invariance) — 24/24 total pass"
        status: pass
      - kind: other
        ref: "grep -n line-order checks placing each guarded call between its documented neighbours (all confirmed via grep -n)"
        status: pass
    human_judgment: false
  - id: D3
    description: "c.timers is carved out of movementComparable/combatComparable/economyComparable plus the three per-domain local comparable() duplicates; every parity fixture stays byte-identical"
    requirement: BAL-01
    verification:
      - kind: other
        ref: "npm test (2206/2206, # fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff --stat -- content src mazeworld.html package.json package-lock.json empty; git diff --stat v1.4.0 -- engine lists only effects.js (new) + movement/combat/saveState.js"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 02: engine/effects.js — Timer/Cooldown Foundation Summary

**Landed `engine/effects.js` (seven pure functions, one lazily-created `c.timers` map) and wired its three tick sites behind `if (c.timers)` guards, so v1.5's later timer consumers (ability cooldowns, item effects, timed map reveal) share one shape instead of inventing three — with zero player-visible behaviour and zero parity/draw-count drift.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-17T16:20:00Z
- **Completed:** 2026-09-17T16:42:00Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- Created `engine/effects.js`: a zero-import, zero-rng, cycle-free leaf module exporting exactly `startEffect`, `startCooldown`, `tickRounds`, `tickSquares`, `remaining`, `isReady`, `clearRoundTimers`, operating on one lazily-created `c.timers[id] = { cadence, left, cd?, phase }` map. Tick functions return `{ id, from, to }` transitions instead of pushing events — the module emits no narration or event vocabulary of its own.
- Wired the three tick sites, all guarded so behaviour is byte-identical until a later phase creates a record: `engine/movement.js`'s per-step block calls `tickSquares(c, 1)` (line 350, between the flight tick and the Magic User recharge check); `engine/combat.js`'s `foeTurn` tail calls `tickRounds(c)` last (line 1918, after the Afraid countdown); `endCombat` calls `clearRoundTimers(state.c)` (line 1118, between the `foeEffect` clear and the `combatEnded` push).
- Added `engine/saveState.js`'s `clearStaleTimers(c)` — mirrors `clearFoeEffect`: deletes a present-but-tampered non-object `timers` value outright, clears rounds-cadence records from a genuine map, and never injects the key onto a save that never had it. Wired into both `validateSave` and `rehydrate`.
- Carved `c.timers` out of all three `test/parity/harness/comparables.js` `*Comparable()` functions (via a new `stripTimersField`, wrapped directly around `stripFoeEffectField` in all three chains) plus the three per-domain local `comparable()` duplicates in `combat-parity.test.js` / `magic-parity.test.js` / `movement-parity.test.js`.
- Full gate: `npm test` 2206/2206 pass (`# fail 0`), `test/parity/fixtures` untouched, `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), no `content`/`src`/`mazeworld.html`/`package.json`/`package-lock.json` byte touched, and `git diff --stat v1.4.0 -- engine` lists exactly the four engine files this plan's frontmatter declared.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create engine/effects.js (seven pure functions) with test/unit/effects.test.js written first** — `7169fba` (feat) — `feat(36-02): create engine/effects.js — seven pure timer/cooldown functions`
   - `engine/effects.js` (new), `test/unit/effects.test.js` (new, 17 unit tests)
2. **Task 2: Wire the three tick sites + load tolerance** — `f29d9fb` (feat) — `feat(36-02): wire the three effects.js tick sites + load tolerance`
   - `engine/movement.js`, `engine/combat.js`, `engine/saveState.js`, `test/unit/effects.test.js` (+7 wiring tests, 24 total)
3. **Task 3: Parity carve-out (stripTimersField + three local comparable() duplicates)** — `88043d2` (test) — `test(36-02): carve c.timers out of every parity comparable`
   - `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js`

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: this plan's `tdd="true"` tasks (1 and 2) each ran a genuine RED-then-GREEN gate before their commit — Task 1's 17 unit tests were verified failing before `engine/effects.js` existed (module-missing error), and Task 2's 7 appended wiring tests were re-verified failing (4 of them) against the already-green Task 1 baseline before the three tick sites were wired, then all 24 passed after wiring. Task 3 is `type="auto"` (no tdd flag)._

## Files Created/Modified

- `engine/effects.js` - the seven-function timer/cooldown module (new)
- `test/unit/effects.test.js` - 24 tests: 17 unit (Task 1) + 7 wiring (Task 2)
- `engine/movement.js` - `import { tickSquares }`; guarded per-step `tickSquares(c, 1)` call
- `engine/combat.js` - `import { tickRounds, clearRoundTimers }`; guarded `tickRounds(c)` in `foeTurn`'s tail; guarded `clearRoundTimers(state.c)` in `endCombat`
- `engine/saveState.js` - `import { clearRoundTimers }`; new `clearStaleTimers(c)`; wired into both `validateSave` and `rehydrate`
- `test/parity/harness/comparables.js` - new `stripTimersField(c)`; wired into `movementComparable`/`combatComparable`/`economyComparable`
- `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js` - local `comparable()` destructure extended with `timers`

## Decisions Made

- **Combined-then-split test authoring:** wrote the entire 24-test file in one pass for design coherence, then rewrote it back down to the 17 Task-1 unit tests for the first commit, re-verified GREEN, committed, then re-appended the 7 wiring tests via Edit and re-verified they failed (RED) before wiring the tick sites — preserving the plan's intended two-commit RED/GREEN gate structure rather than collapsing it into one commit.
- **stripTimersField placement:** inserted as the innermost-but-one wrapper directly around `stripFoeEffectField(...)` in all three comparable chains, per the plan's literal instruction; verified paren balance with `node --check` (not just eyeballing the sed-based insertion) before running the full suite.
- **clearStaleTimers shape:** a present non-plain-object `timers` value is `delete`d outright (not reset to `{}`) — matching `clearFoeEffect`'s "neutralise a tampered value" precedent rather than silently upgrading it to a valid-but-empty map, which would inject a key a v1.4 save never had.

## Deviations from Plan

None beyond the test-authoring/commit-sequencing decision above (not a deviation from behaviour or acceptance criteria — every locked API surface, tick-site placement, and carve-out matches the plan verbatim; only the *order* in which the test file was drafted differs from a literal step-by-step reading).

## Issues Encountered

None. Both TDD gates (Task 1, Task 2) failed exactly as expected before their respective implementation landed, and passed cleanly afterward on the first attempt. `npm test` was green on the first full run after Task 3's carve-out — no re-runs needed to find or fix a regression.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: **this plan has no player-visible behaviour.** Nothing to add to the aggregated Pixel 7 checklist — `engine/effects.js` ships with unit tests only, no `start*` caller exists anywhere outside `engine/effects.js`'s own test file, and every tick site is guarded behind `c.timers`, which nothing in this phase (or the shipped 1.4.0 build) ever sets. A normal run through a fight and a floor change is expected to look, sound, and play identically to 1.4.0; a pre-Phase-36 save is expected to load and play exactly as before. No device steps, no APK build, no checkpoint was needed or attempted for this plan.

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** adds zero draws — every tick is a plain decrement; no `rng` parameter anywhere in `engine/effects.js`; confirmed by the draw-count-invariance wiring test (identical `rngState` and identical event list across 30 legal moves with and without a planted squares-cadence timer record).
- **serialized_field_impact:** adds `c.timers` — a lazily created plain-JSON map, never created by anything in this phase (no `start*` caller exists yet outside `engine/effects.js`'s own test), carved out of `movementComparable`/`combatComparable`/`economyComparable` plus the three local `comparable()` duplicates; load (`validateSave` + `rehydrate`) clears rounds-cadence records / drops a tampered value on a PRESENT key and never injects the key onto a save that lacked it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/effects.js` is ready for Phases 38–40 to build their first real `start*` callers (ability cooldowns, item use-then-effect-then-cooldown, timed map reveal) on top of the same shape, and for Phase 41 (TERR-02) to pass a water square's step cost into `tickSquares(c, n)`.
- Plans 03–06 of Phase 36 (targeting normalize, Cutthroat murder risk, dismissJoiner, Company panel) are independent of this plan and can land in any order per the phase's own wave design.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (engine/effects.js, test/unit/effects.test.js, engine/movement.js, engine/combat.js, engine/saveState.js, test/parity/harness/comparables.js, test/parity/combat-parity.test.js, test/parity/magic-parity.test.js, test/parity/movement-parity.test.js, this SUMMARY.md); all three task commit hashes (`7169fba`, `f29d9fb`, `88043d2`) found in `git log --oneline --all`.
