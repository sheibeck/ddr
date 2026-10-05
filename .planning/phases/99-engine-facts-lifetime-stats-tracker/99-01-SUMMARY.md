---
phase: 99-engine-facts-lifetime-stats-tracker
plan: 01
subsystem: engine
tags: [achievements, engine-facts, events, parity]
requires: []
provides:
  - "foeKilled.group (BESTIARY family key of the killed foe)"
  - "afflictionCaught.wp and afflictionTick.wp (hero HP right after the hit)"
affects: [99-02, 99-03]
tech-stack:
  added: []
  patterns: ["additive event fields, zero rng draws, event-only (never in GameState)"]
key-files:
  created:
    - test/unit/achievement-engine-facts.test.js
  modified:
    - engine/combat.js
    - engine/encounters.js
    - engine/movement.js
    - test/unit/parley-rewards.test.js
key-decisions:
  - "group reads the foe's own type, so a reinforcement reports its own family"
  - "wp is read straight from c.wp after the subtraction, so the 1-HP clamp reports exactly 1"
requirements-completed: [TRACK-01]
duration: ~25 min
completed: 2026-10-05
status: complete
---

# Phase 99 Plan 01: Engine facts (kill group, post-hit HP) Summary

Three one-key additive engine edits: `foeKilled.group` (the foe's own BESTIARY `type`) and `wp: c.wp` on `afflictionCaught` and `afflictionTick`, proven by a new test file with base-measured draw-count pins, and the engine gate held with zero moved fixtures.

BASE commit: `c0535a54b76a5b20bf90b6386a09a0ed274cc545`

## Commits

| Commit | Message |
|--------|---------|
| 8c5469ca | test(99-01): add failing engine-fact tests and base draw-count pins (RED) |
| 35a5d942 | feat(99-01): report kill group and post-hit HP on engine events (GREEN) |
| e76fc074 | test(99-01): add group key to the pinned foeKilled event literals |

## What changed

- `engine/combat.js` killFoe: `events.push({ type: "foeKilled", name, spGained, group: f.type })`.
- `engine/encounters.js` catchAffliction: `afflictionCaught` gains `wp: c.wp`.
- `engine/movement.js` affliction tick: `afflictionTick` gains `wp: c.wp`.
- `git diff c0535a54 -- engine/` is exactly those three keys plus their comments (12 insertions, 3 deletions). `walkingDeadTurned`, `EVENT_NARRATION`, `saveState.js` and every parity file are untouched.
- `test/unit/achievement-engine-facts.test.js` (new, 23 tests): group for all six families, reinforcement (Demons in a Beasts fight reports Demons), Petrify kill, kill-twice (first death foeRevived with no foeKilled), two kills in one action with two groups, key order; wp 33 after a 40-HP first hit, wp 1 at the clamp, two ticks reporting 52 then 48, tick clamped to wp 1, a 0-HP tick still afflictionPassed with no afflictionTick, event order; the three draw-count pins; the no-event-in-GameState deep walk.

## Measured draw counts (at BASE, before the engine edit)

Measured with a counting proxy around `makeRng(seed)` (every `d`, `pick`, `shuffle`, `next` call counted); the three pin tests passed at BASE (7 pass, 16 RED) and still pass after the edit:

| Scenario | Seed | d | pick | shuffle | next | cursor (getState) |
|----------|------|---|------|---------|------|-------------------|
| killFoe, one 1-HP foe of each of the six families (fresh newRun(1234) each) | 7 | 20 | 0 | 0 | 0 | -2023389397 |
| catchAffliction, 40-HP hero | 11 | 2 | 0 | 0 | 0 | -631835659 |
| one per:1 Poison water step (move N) | 5 | 2 | 0 | 0 | 0 | -631835665 |

## Engine-gate declaration

- rng draws added: 0 (pins above unchanged after the edit)
- new event types: 0
- EVENT_NARRATION entries added: 0
- parity fixtures moved: 0 (`git diff --stat c0535a54 -- test/parity/` prints nothing)
- `test/parity/prototype-master.js.txt`: untouched
- comparables carve-out: not needed, fields are event-only, proven by test (the GameState deep walk finds no foeKilled, afflictionCaught or afflictionTick object in `serializeRun(state)` or its JSON round trip); `test/parity/harness/comparables.js` is byte-identical.
- event-literal updates (test expectations, not parity fixtures): `test/unit/parley-rewards.test.js`, test "kill byte-identical: killFoe (now routed through foeSpoils) ...", six golden `foeKilled` JSON strings gained `"group":"<family>"`. Its state, gold, sp, rng cursor, pile and rations goldens are unchanged.

## Verification (targeted only; no full npm test, no bots)

- Task 1 verify (achievement-engine-facts, water-cost, encounters, movement, stale-terms): 174 tests, 174 pass.
- Task 2 gate (all of `test/parity`, `test/determinism`, `test/roundtrip`, formatEventsCoverage, engine-purity, hp-not-wp, and the 59 unit test files that name a touched event or function, plus the new file): 1748 tests; first run 1747 pass and 1 fail (the parley-rewards literal above, a test expectation); after the literal update parley-rewards, stale-terms and the new file re-ran 47 of 47 pass. Net 1748 of 1748. Every parity, determinism and round-trip test passed on the first run.
- The CRLF-only doc-ledger test noise mentioned in the dispatch notes did not appear in the targeted runs.

## Deviations from Plan

None to the engine. The one `parley-rewards.test.js` golden update is the plan's own anticipated "event-literal update" (Task 2 step 2). The `git grep -l` list was passed as explicit file names (JSON fixture `test/unit/fixtures/event-order/default-fold-corpus.json` excluded, as it is not a test file; `event-order-fold.test.js` passed).

## Known Stubs

None.

## Threat Flags

None (no new endpoints, auth paths, file access or schema).

## Self-Check: PASSED

- test/unit/achievement-engine-facts.test.js present; engine edits present; commits 8c5469ca, 35a5d942, e76fc074 exist.
