---
phase: 76-darkness-unification-relaunch-persistence
plan: 01
subsystem: engine-rules
status: complete
tags: [darkness, DARK-01, derived, combat, phobias, parity]
requires: []
provides:
  - "engine/derived.js: DARK_WAIVERS, darkWaiver(c), darkWaived(c), darkLimited(state)"
  - "revealRadius, mapViewRadius, toHit's dark cap, combatInDark, the dark crit ban and both Darkness-phobia triggers on one predicate"
affects:
  - "76-02 (darknessView.js collapse, DARK chip, faint lit tint): reads darkWaiver / darkLimited"
  - "Phase 79.1 (the milestone-end bot readout measures the kinder dark)"
tech-stack:
  added: []
  patterns:
    - "one pure predicate (darkLimited) for every hero-side dark penalty; physical darkness (inDark) kept for non-penalty reads"
key-files:
  created:
    - test/unit/dark-waiver.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/phobias.js
    - engine/maze.js
    - test/unit/darkness-filter.test.js
    - test/unit/darkness-vignette.test.js
    - test/unit/movement.test.js
    - test/unit/phobia-triggers.test.js
    - test/unit/rollDirection.test.js
    - docs/ROLL-LEDGER.md
    - test/parity/divergence-records.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/DIFFICULTY-RETUNE.md
decisions:
  - "DARK-01: one darkness waiver (darkLimited = inDark && no Night Vision / live Amulet / lit torch) drives the reveal, the render window, toHit's dark cap, combatInDark, the dark crit ban and both Darkness-phobia triggers; precedence Night Vision > Amulet > torch (DARK_WAIVERS)"
  - "Sense Presence stays a fight-only relief beside darkLimited (the cap, the line, the crit ban), never a map waiver"
  - "No bot readouts in Phase 76 (user ruling 2026-09-26): DIFFICULTY-RETUNE gets a Phase 76 stub; the readout runs in Phase 79.1"
metrics:
  duration: "~40 min"
  completed: 2026-09-26
  tasks: 3
  files: 14
---

# Phase 76 Plan 01: One darkness waiver for the map and the fight Summary

One pure predicate, `darkLimited(state)` (in the dark with no Night Vision, live Amulet of Light or lit torch), now drives the reveal radius, the render window, toHit's dark cap, the `combatInDark` line, the no-crit-in-the-dark rule and both Darkness-phobia triggers. A torch or the Amulet now lights your way as you walk and in a fight. The measured moved set is zero: no parity fixtures, state pins or saves moved.

**Plan base:** `e090d1daba0ac7726851ec796792b8a9ca34d59a`

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Plan base, exposure prediction, pinned labels | (no file output: the readout was dropped by the 2026-09-26 ruling) | scratch probe only, reverted |
| 2 (RED) | Failing tests for the one waiver | `3b820a23` | test/unit/dark-waiver.test.js, test/unit/rollDirection.test.js |
| 2 (GREEN) | One darkness waiver for the map and the fight | `32fba0be` | engine/derived.js, combat.js, phobias.js, maze.js; flipped tests; docs/ROLL-LEDGER.md |
| 3 | Measure, declare, record | `319eb2bf` | test/parity/divergence-records.test.js, test/parity/FIXTURE-INVENTORY.md, docs/DIFFICULTY-RETUNE.md |

## What changed

- **engine/derived.js.** New `DARK_WAIVERS` (frozen `["nightVision", "amuletLight", "litTorch"]`), `darkWaiver(c)` (null for a missing or non-object `c`, never throws), `darkWaived(c)` and `darkLimited(state)`. `revealRadius` is `(darkLimited ? 1 : 2) + eff("sight")`, `mapViewRadius` is `darkLimited ? DARK_VIEW_RADIUS : Infinity`, and toHit's cap is `darkLimited(state) && !c.senses`. JSDoc marks each as a declared canon divergence. The Phase 41 DARK_VIEW_RADIUS comment no longer claims revealRadius shared the waiver set. inDark's JSDoc now says it covers physical darkness only and no longer lists the retired silent-thief clause.
- **engine/combat.js.** `combatInDark` and the dark term of `noCrit` read `darkLimited(state) && !c.senses`. The Darkness term of `phobiaCondition` is `c.phobia === "Darkness" && darkLimited(state)`. The `inDark` import was replaced by `darkLimited`.
- **engine/phobias.js#regionActive.** The Darkness arm returns `darkLimited(state)`.
- **engine/maze.js.** The reveal JSDoc now says revealRadius also waives on a torch or a live Amulet (DARK-01).

## Exposure prediction (Task 1)

A temporary in-engine probe, reverted with `git checkout --` before the first real edit, ran at the plan base. It counted every `revealRadius`, `mapViewRadius`, `toHit`, fight-join, strike and `regionActive` call where (a) the hero was in the dark with a live Amulet or lit torch and no Night Vision, or (b) a Darkness-phobic hero was in the dark with any waiver.

- **Parity fixtures (all 31 sites, 6 files):** (a) = 0 and (b) = 0 for every scenario. No dark states of any kind occurred at any probed call.
- **roll-high-invariant bot run (not a fixture):** seed 9004 had 24 differing reveal calls. That test checks an invariant, not a hash, and stays green.
- **Pinned labels at the base:** solo-1, solo-2, solo-thief-pilfer, solo-magicuser-sorcerer, party-1, party-fighter-knight, deep-8, deep-14 (hashes unchanged, see below).

## Dark-read inventory (Task 2 step 5)

grep over `engine/` after the change:

- **On `darkLimited`:** derived.js revealRadius, mapViewRadius (and inViewWindow through it), toHit; combat.js phobiaCondition, combatInDark, noCrit; phobias.js regionActive.
- **Physical darkness, not penalties (still `inDark` or its own read):** items.js#1489 (a torch used while not dark is refused), encounters.js#fallDark (a lit torch resists a Darkness result, `itemEffectActive(c, "lit")`), encounters.js `darknessFell` event's `nightVision` narration flag, movement.js (the Amulet's light dispels `c.darkFor`), and `darkLimited` itself.
- **The thief's silent strike:** no live dark clause exists. The Silence-in-the-dark term was retired in Phase 38 (see foeToHitVs's JSDoc). Only inDark's stale JSDoc named it, and that line is now removed.
- **Party members:** memberToHit has no dark term, so nothing needed routing.

## Measured moved set (Task 3)

- **Parity:** 62/62 green after the change, and 64/64 with the new guard. `git diff e090d1da -- test/parity/fixtures test/parity/prototype-master.js.txt` is empty. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` is unchanged. `tools/fixture-inventory.mjs` returns the same roster (fixture-inventory test 5/5). **No fixture regenerated.** The new empty `DARK76_EXPECTED_HOLDERS` guard plus a has-teeth test live in divergence-records.test.js, and replaySiteEvents gained additive `darkStates` / `darkWaivedStates` tallies.
- **Causation counts per bot pin (at the base):**
  - party-fighter-knight: 6 differing reveal calls, all with a live Amulet in the dark on floors 2 and 3. The pin is byte-identical: the wider reveals only marked cells the run saw anyway, so the final state hash is unchanged.
  - deep-14: Night Vision in the dark on floor 14, but no Darkness phobia, so 0 differing calls. Unchanged.
  - The other six labels: 0 differing calls, unchanged.
  - pre-switch save: 0, so `expected` was not re-recorded.
  - bot-tactics seeds 3, 4 and 5 had differing calls (seed 5: 136 reveal, 4 joins, 10 toHit, 6 strikes). Every bot-tactics assertion still holds, so no seed was swapped.
- **Re-pins:** none. roll-high-state-pins.test.js, roll-high-save-compat.test.js, pre-switch-save.json and bot-tactics.test.js are untouched.
- **npm test:** 6,715/6,715 green with the engine change, and 6,717/6,717 at the plan's final commit (with the guard). No band or survival test failed. `engine/difficulty.js` and `content/` are byte-identical to the plan base.

## Readouts

None. User ruling 2026-09-26: no bot balance runs in Phase 76. `docs/DIFFICULTY-RETUNE.md` gains `## v2.1 darkness unification (Phase 76) — bot readout` as a stub immediately before `## v1.2 retune (Phase 27)`, which stays the last H2. The stub lists what changed and says the 200-seed readout runs in Phase 79.1. No `tools/readouts/76-*.txt` files were created.

## Note for 76-02

- **Exports:** `DARK_WAIVERS`, `darkWaiver(c)`, `darkWaived(c)` and `darkLimited(state)` from engine/derived.js. `darkWaiver` returns the precedence-first key or null.
- **Waiver keys:** `"nightVision"`, `"amuletLight"` and `"litTorch"` (the shell's existing `WAIVER_LABEL` keys, so no label migration is needed).
- **Sense Presence is a separate, fight-only relief.** It lifts the cap, the `combatInDark` line and the crit ban, but it is not in `DARK_WAIVERS` and does not widen the map. The darkness explain copy must say so.
- `revealRadius` and `mapViewRadius` now always agree. darknessView.js's comments that describe the "torch leaves revealRadius at 1" divergence (src/browser/darknessView.js lines 20-27) are stale and are 76-02's to rewrite.

## Deviations from Plan

### Orchestrator / user ruling

**1. [Ruling 2026-09-26] No bot readouts.** The BEFORE and AFTER `tune-difficulty` runs, the scratch base worktree and `tools/readouts/76-01-*.txt` were all dropped. The DIFFICULTY-RETUNE H2 is a stub that defers to Phase 79.1. Task 1 therefore produced no committed file.

### Auto-fixed issues

**1. [Rule 1 - Test flip] movement.test.js HI-01 dark-Amulet reveal.** The plan listed movement.test.js's revealRadius tests as "stay true", but `HI-01: LIVE sight:1 on a dark tile without Night Vision still only widens the dark 1 to a 2 (5x5)` pinned the old waiver (a live Amulet on a dark tile). It now expects radius 3 (7x7), with a DARK-01 comment. Commit `32fba0be`.

**2. [Rule 1 - Test flip] phobia-triggers.test.js "Night Vision does NOT suppress the trigger".** This test pinned the old phobia rule. It now asserts that Night Vision suppresses the trigger, with a DARK-01 comment (per the 2026-09-25 ruling). Commit `32fba0be`.

**3. [Rule 1 - Test harness] dark-waiver.test.js join states needed `pending: true`.** Without it, `fight()` returns before joining, and the "not afraid / no line" cases pass for the wrong reason. Each case now also asserts `combatJoined`. Fixed before the GREEN commit.

## Known Stubs

None in code. The DIFFICULTY-RETUNE Phase 76 section is an intentional documentation stub (Phase 79.1 fills in the readout).

## TDD Gate Compliance

RED `3b820a23` (test) was followed by GREEN `32fba0be` (feat). No refactor commit was needed.

## Self-Check: PASSED

- Commits 3b820a23, 32fba0be and 319eb2bf are in git log.
- test/unit/dark-waiver.test.js and this SUMMARY exist.
- engine/difficulty.js, content/, the parity fixtures and the prototype master are byte-identical to e090d1da.
- No tools/readouts/76-* files were created.
