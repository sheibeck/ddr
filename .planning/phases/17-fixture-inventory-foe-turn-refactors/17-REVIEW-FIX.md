---
phase: 17-fixture-inventory-foe-turn-refactors
fixed_at: 2026-09-13T20:38:14Z
review_path: .planning/phases/17-fixture-inventory-foe-turn-refactors/17-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-09-13T20:38:14Z
**Source review:** .planning/phases/17-fixture-inventory-foe-turn-refactors/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (critical_warning scope — WR-01, WR-02; IN-01 out of scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `pickFoeTarget` breaks the module's established `!state.combat` guard convention

**Files modified:** `engine/combat.js`
**Commit:** `080cf89`
**Applied fix:** Added `if (!C) return null;` immediately after `const C = state.combat;` in `pickFoeTarget`, matching the defensive-guard convention every sibling exported function in `engine/combat.js` already follows (`playerStrike`, `flee`, `parley`, `sing`, `allyTurn`, `alliesTurn`). Confirmed `pickFoeTarget`'s only current caller, `foeTurn`, already guards `if (!C) return events;` at its own top before ever reaching the `pickFoeTarget` call inside its swing loop — so this change cannot alter behavior, RNG draw order, or RNG draw count on any existing call path. It only changes behavior for a future caller (e.g. Phase 19's foe-ability resolver, per the function's own JSDoc) that might invoke `pickFoeTarget` when `state.combat` is already null, which now returns `null` gracefully instead of throwing `TypeError: Cannot read properties of null (reading 'allies')`.

**Verification:** `node --check engine/combat.js` passed; `npm test` — 724/724 passing, 0 failing; `node --test test/unit/foe-turn-draw-count.test.js` — 12/12 passing (FID-02 draw-count pins unaffected, confirming no RNG order/count drift).

### WR-02: `fixtureRoster.js` silently records only the *first* combat encounter per script

**Files modified:** `test/parity/harness/fixtureRoster.js`
**Commit:** `91a9b36`
**Applied fix:** Applied option (a) from the review's fix suggestion: removed the `snapshotted` boolean gate in both `replayEngineActions` and `replayEconomyLikeActions`, so every null→non-null `state.combat` transition observed during a script/scenario replay now has its foes appended (`foes = foes.concat(next.combat.foes.map(snapshotFoe))`) instead of only the first transition being captured. A future fixture script that flees and re-engages (or otherwise starts a second combat within one scenario) will now have both encounters' foes included in the roster instead of the second silently dropping out.

Did NOT touch `test/parity/harness/comparables.js`, `test/parity/prototype-master.js.txt`, or any parity fixture files, per the engine-parity constraint.

**Verification:** `node --check test/parity/harness/fixtureRoster.js` passed; `node --test test/parity/fixture-inventory.test.js` — 5/5 passing, including the doc-consistency test ("FIXTURE-INVENTORY.md's generated block matches the live replay"), confirming the roster output for today's six fixtures is byte-identical to before the fix (each currently starts at most one combat per scenario/script, so the fix is a behavioral no-op on existing fixtures and only changes coverage for a future multi-combat scenario). Since the roster did not change, `test/parity/FIXTURE-INVENTORY.md` did NOT need regeneration via `tools/fixture-inventory.mjs` — confirmed via `git status` showing only `test/parity/harness/fixtureRoster.js` modified. Full suite: `npm test` — 724/724 passing, 0 failing.

## Skipped Issues

None — both in-scope findings (WR-01, WR-02) were fixed. IN-01 (duplicated transition-detection logic between `replayEngineActions` and `replayEconomyLikeActions`) is Info-level and out of the `critical_warning` fix scope for this run; it was not attempted.

---

_Fixed: 2026-09-13T20:38:14Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
