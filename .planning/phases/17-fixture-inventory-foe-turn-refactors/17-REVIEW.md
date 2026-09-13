---
phase: 17-fixture-inventory-foe-turn-refactors
reviewed: 2026-09-13T20:33:04Z
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
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-09-13T20:33:04Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase extracts `pickFoeTarget` and `applyFoeDamageToPlayer` out of `foeTurn` in `engine/combat.js`, and adds a fixture-roster enumeration tool/test/doc plus a draw-count regression pin. I diffed `engine/combat.js` against `7bb009b^` line-for-line: the extraction is a **verbatim code move** — every statement, condition, and event payload in the two new exported functions is byte-identical to the inline block it replaces (only the loop variable `f` was renamed to the parameter `foe`), and the `continue`-vs-`return{died:false,...}`-then-fallthrough control-flow substitution is semantically equivalent (confirmed by tracing the `for (let s...)` loop's `if (!f.alive) break` re-check on the next iteration either way). I ran the full test suite (`npm test`, 724 tests) and the phase's own draw-count/fixture-inventory suites in isolation — all pass, including the countingRng-based FID-02 pins that would catch any RNG-order/count drift from the refactor. No `Math.random`/`document`/`localStorage` references were introduced, no new serialized state fields appear, and no hardcoded secrets, `eval`, or debug artifacts (`console.log`/`debugger`/`TODO`) were found outside the one legitimate CLI `console.log` in `tools/fixture-inventory.mjs` (a dev-only printer, not shipped).

The test/tooling additions (`fixtureRoster.js`, `fixture-inventory.test.js`, `foe-turn-draw-count.test.js`, `FIXTURE-INVENTORY.md`) are internally consistent and cross-validated against each other and against `content/bestiary.js` (spot-checked Bat/Rat wp:1, Shriek wp:3, Viper wp:3, Dante wp:20/atk:3 — all match). Everything is pure ESM using `node:fs`/`node:path`/`node:url`, runs via `node --test` (portable on Windows/Git-Bash, no shell-outs).

Two warnings and one info-level item below are about robustness/maintainability of the new code, not observed behavior changes — nothing here blocks the merge.

## Warnings

### WR-01: `pickFoeTarget` breaks the module's established `!state.combat` guard convention

**File:** `engine/combat.js:832-838`
**Issue:** Every other exported action-style function in this module defensively guards against a null `state.combat` before touching it (`playerStrike`, `flee`, `parley`, `sing` all do `if (!C) return events;`; `allyTurn` does `if (!C || !C.ally) return events;`; `alliesTurn` does `if (!C || !C.allies || !C.allies.length) return events;`). `pickFoeTarget` does not:

```js
export function pickFoeTarget(state, rng) {
  const C = state.combat;
  const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
  ...
```

Today this is safe because `foeTurn` (its only caller) already checked `if (!C) return events;` at its own top before entering the loop that calls `pickFoeTarget`. But the function's own JSDoc states it was extracted specifically so "Phase 19's foe-ability resolver (`engine/foeAbilities.js`) reuses this helper so `bolt`/`drain`-style abilities target the same pool as a melee swing" — i.e. this function is deliberately being handed to a *new, not-yet-written* caller. If that caller (or any future one) invokes `pickFoeTarget(state, rng)` on a state where `state.combat` is null (e.g. an ability resolver running just after combat ended), this throws an uncaught `TypeError: Cannot read properties of null (reading 'allies')` instead of failing gracefully like every sibling function in this file.
**Fix:**
```js
export function pickFoeTarget(state, rng) {
  const C = state.combat;
  if (!C) return null;
  const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
  if (!liveMembers.length) return null;
  const pick = rng.d(liveMembers.length + 1);
  return pick > 1 ? liveMembers[pick - 2] : null;
}
```

### WR-02: `fixtureRoster.js` silently records only the *first* combat encounter per script — a coverage gap in a safety-invariant tool

**File:** `test/parity/harness/fixtureRoster.js:52-116`
**Issue:** `replayEngineActions`/`replayEconomyLikeActions` snapshot `state.combat.foes` only on the first null→non-null transition of `state.combat` (`snapshotted` is a boolean set once and never reset):

```js
let snapshotted = false;
...
if (!wasCombat && nowCombat && !snapshotted) {
  foes = next.combat.foes.map(snapshotFoe);
  snapshotted = true;
  ...
}
```

This is fine for today's six fixtures, each of which (per `FIXTURE-INVENTORY.md`'s own analysis) starts at most one combat per scenario/script. But the whole purpose of this tool, per its own header and `FIXTURE-INVENTORY.md`, is to be the **authoritative, complete** answer to "which bestiary creatures does the frozen parity suite depend on?" so Phase 18 can safely rebalance every creature *not* listed. If a future fixture script (e.g. a longer movement/economy script, or a combat scenario that flees and re-engages) triggers a **second** combat within the same script/scenario, that second fight's foes would be silently dropped from the roster with no error, warning, or test failure — `enumerateFixtureRoster()` would just under-report, and Phase 18 could then "safely" rebalance a creature that is actually fixture-exposed. This is exactly the kind of silent-mis-scoping failure mode the tool's own docs (and this project's Pitfall 14 discipline) are trying to prevent, just moved one layer down into the enumeration tool itself.
**Fix:** Either (a) collect *every* null→non-null transition's foes (append to an array of "encounters" per row instead of a single `foes` snapshot, unioning them in `foesCell`/the roster surface calc), or (b) add an explicit assertion that at most one transition occurs per script/scenario so a future violation fails loudly instead of silently:
```js
if (!wasCombat && nowCombat) {
  if (snapshotted) {
    throw new Error(`${fixtureFile}/${scenario}: a second combat encounter started — fixtureRoster.js only records the first; update it before trusting this roster`);
  }
  foes = next.combat.foes.map(snapshotFoe);
  snapshotted = true;
  ...
}
```

## Info

### IN-01: Duplicated transition-detection logic between `replayEngineActions` and `replayEconomyLikeActions`

**File:** `test/parity/harness/fixtureRoster.js:52-80` and `:93-116`
**Issue:** Both functions carry near-identical "track `wasCombat`, detect the null→non-null transition, snapshot foes once" logic (roughly 10 lines each), differing only in how `trigger` is initially assigned and how each action is dispatched (`applyStartCombat`/`applyAction` vs. `runEconomyAction`).
**Fix:** Extract a small shared helper, e.g. `trackCombatTransition(prevCombat, nextCombat, snapshotState)`, that both callers invoke after dispatching their respective action, to avoid the two copies drifting out of sync if the transition-detection logic ever needs to change (relevant to WR-02's fix above, which would otherwise need to be applied in two places).

---

_Reviewed: 2026-09-13T20:33:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
