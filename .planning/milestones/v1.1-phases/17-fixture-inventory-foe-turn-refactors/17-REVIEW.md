---
phase: 17-fixture-inventory-foe-turn-refactors
reviewed: 2026-09-13T21:10:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - engine/combat.js
  - test/parity/FIXTURE-INVENTORY.md
  - test/parity/fixture-inventory.test.js
  - test/parity/harness/fixtureRoster.js
  - test/unit/combat.test.js
  - test/unit/foe-turn-draw-count.test.js
  - test/unit/party-combat.test.js
  - tools/fixture-inventory.mjs
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 17: Code Review Report (Iteration 2)

**Reviewed:** 2026-09-13T21:10:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review after the `--auto` fix loop applied two one-line/small fixes for the findings in `17-REVIEW.iter2.md`: WR-01 (`pickFoeTarget` null-guard, commit `080cf89`) and WR-02 (`fixtureRoster.js` recording every combat transition instead of only the first, commit `91a9b36`).

**Verification of both fixes:**

- `git diff b5e01e0..HEAD` shows exactly the two expected, minimal diffs — nothing else changed. `engine/combat.js` gained a single `if (!C) return null;` line at the top of `pickFoeTarget` (`engine/combat.js:834`), placed before the only `rng.d(...)` call in the function. `pickFoeTarget`'s sole production caller is `foeTurn`, which already guards `if (!C) return events;` before it ever reaches this call (`engine/combat.js:1003`), so `state.combat` is always non-null on every code path that currently invokes this function — the new guard is unreachable today and changes zero RNG draws/order for any existing fixture. It only matters for a not-yet-written future caller (Phase 19's foe-ability resolver, per the function's own JSDoc), exactly as the original WR-01 finding intended.
- `test/parity/harness/fixtureRoster.js`'s `replayEngineActions`/`replayEconomyLikeActions` now `concat` onto `foes` on every `!wasCombat && nowCombat` transition instead of gating on a `snapshotted` boolean that only fired once. I confirmed via a small script that every current fixture scenario contains at most one `startCombat` action (`combat.json`: 1 per scenario across 4 scenarios; `magic.json`: 1 in `cast-damage` only; `movement.json`/`economy.json`/`encounters.json`: 0 explicit `startCombat` calls), so this is a genuine no-op against today's fixtures, matching the fix's own comment.
- Ran the full suite: `npm test` → **724/724 passing**, including the `fixture-inventory.test.js` deep-equal pins (which would have caught any behavioral drift from either fix) and the `foe-turn-draw-count.test.js` `countingRng` pins (which would catch any change to `pickFoeTarget`'s draw count/order).
- IN-01 from the prior review (duplicated transition-detection logic between `replayEngineActions` and `replayEconomyLikeActions`) was left unaddressed, as the workflow instructions specified. It is restated below since it's still present in the current code.

No new critical or warning-severity issues were found. Three info-level items are noted below — two are follow-on observations from the fix itself (not new bugs), one restates the carried-over IN-01.

## Info

### IN-01: Duplicated transition-detection logic between `replayEngineActions` and `replayEconomyLikeActions` (carried over, unresolved)

**File:** `test/parity/harness/fixtureRoster.js:52-84` and `:97-120`
**Issue:** Both functions still carry near-identical "track `wasCombat`, detect the null→non-null transition, concat foes" logic, now duplicated with slightly different comments (`// WR-02 fix (Phase 17 review): record EVERY null->non-null transition...` vs. `// WR-02 fix (Phase 17 review): see replayEngineActions above...`). The two comment blocks already show early drift risk — one repeats the full rationale, the other just cross-references it.
**Fix:** Extract a small shared helper, e.g. `recordCombatTransition({ wasCombat, nowCombat, nextCombat, trigger })`, that both callers invoke after dispatching their respective action, so the transition-detection logic (and any future fix to it) lives in one place.

### IN-02: WR-02's fix aggregates `foes` across multiple encounters, but `trigger`/`forced` still reflect only the first

**File:** `test/parity/harness/fixtureRoster.js:76-79`
**Issue:** The transition block now does `foes = foes.concat(...)` on every transition, but `trigger`/`forced` are only set inside the same `if` guarded by `if (trigger === "none") trigger = "wandering"` — i.e. once `trigger` is non-`"none"` (set either by an explicit `startCombat` action or by the first wandering transition), a *second* transition in the same script/scenario would correctly append its foes to the roster row but would not update `trigger`/`forced` to reflect that second encounter's actual cause. For example, a hypothetical script that first wanders into a fight and later hits an explicit `startCombat` would report `trigger: "wandering"` for the whole row even though a `startCombat`-forced encounter also contributed foes to it.
**Impact today:** none — verified (see Summary) that no current fixture triggers more than one combat start per scenario/script, so this is purely a latent gap in the fix's completeness, not an active bug.
**Fix:** If/when a multi-encounter script is ever added, either record `trigger`/`forced` per-encounter (e.g. as parallel arrays alongside `foes`, or as a list of `{trigger, forced, foes}` sub-rows) or add an assertion that fails loudly if a second transition's trigger would differ from the first, rather than silently keeping the first-seen value.

### IN-03: Neither WR-01 nor WR-02's fix has a dedicated regression test

**File:** `engine/combat.js:832-839`, `test/parity/harness/fixtureRoster.js:52-120`
**Issue:** No test in `test/unit/party-combat.test.js` calls `pickFoeTarget(state, rng)` with `state.combat === null`/`undefined` to pin the new guard's `null`-return-without-touching-`rng` behavior, and no test in `test/parity/fixture-inventory.test.js` (or elsewhere) exercises a synthetic action script with two null→non-null `state.combat` transitions to pin that `fixtureRoster.js` now records both. The full 724-test suite passes because every existing fixture happens to have at most one combat start, so the suite would not fail if either fix were silently reverted (e.g. during a future refactor of `foeTurn` or `fixtureRoster.js`).
**Fix:** Add one unit test asserting `pickFoeTarget({ combat: null }, fakeRng([]))` returns `null` and draws zero RNG (mirroring the existing "absent allies key" test pattern at `test/unit/party-combat.test.js:255`), and one test in `fixture-inventory.test.js` (or a new harness-level test) that feeds `replayEngineActions`/`replayEconomyLikeActions` a synthetic two-encounter action list and asserts `foes` contains entries from both encounters.

---

_Reviewed: 2026-09-13T21:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
