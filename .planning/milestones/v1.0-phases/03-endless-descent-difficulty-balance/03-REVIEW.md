---
phase: 03-endless-descent-difficulty-balance
reviewed: 2026-09-08T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - engine/difficulty.js
  - engine/maze.js
  - engine/movement.js
  - src/browser/engineAdapter.js
  - mazeworld.html
  - tools/tune-difficulty.mjs
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: fixed
fixed_at: 2026-09-08T13:30:00Z
fixed:
  critical: 1
  warning: 1
  info: 3
  total: 5
  not_fixed: 0
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** deep (cross-file call-chain tracing: `engine/movement.js` → `engine/death.js` → `src/browser/engineAdapter.js` → `mazeworld.html`, plus `engine/difficulty.js` → `engine/maze.js` → `engine/saveState.js`)
**Files Reviewed:** 6 (`engine/difficulty.js`, `engine/maze.js`, `engine/movement.js`, `src/browser/engineAdapter.js`, `mazeworld.html`, `tools/tune-difficulty.mjs`)
**Status:** issues_found → **fixed** (fix pass 2026-09-08; all 5 findings resolved, `node --test` 324/324 green — see [Fix Disposition](#fix-disposition) below)

## Summary

The core deliverable — `engine/difficulty.js`'s bounded soft-cap curve and its wiring into `genFloor` — is solid. `safeDepth()` correctly neutralizes NaN/Infinity/negative/non-integer depth inputs *for the curve's own outputs* (dots/darkBlobs/darkRadius all verifiably stay within their documented caps, and the depths-1-5 parity guard genuinely holds, confirmed by hand-tracing the `softCap`/breather formulas against the old `9+depth`/`depth-1`/`3+depth` literals). RNG call order/count for floors 1-5 is preserved because `difficultyCurve` consumes no RNG and `nDots` never affects `rng.shuffle(far)`'s draw count — only `darkBlobs` affects `rng.pick(open)` call count, and it equals the old unbounded `depth-1` for every depth ≤ 6. Endless descent is real: `winGame()` has zero call sites outside its own JSDoc/tests, and the legacy `"gate"` branch in `move()` routes to `descend()` exactly once (no double-descend).

However, deep tracing of the death/graveyard call chain surfaced one **BLOCKER**: the engine's own graveyard mechanism (`engine/death.js#bury()`) is never invoked by any production code path, so a meaningful and (under this phase's own attrition-driven difficulty design) increasingly common class of permadeaths is silently never recorded in the persistent graveyard — directly contradicting `03-CONTEXT.md`'s explicit decision to "keep the death/graveyard system (engine `die`/`bury`) intact." One **WARNING** covers a related depth-sanitization gap in `genFloor`'s return value and `descend()`'s SP-bonus formula. Three **INFO** items round out minor test-coverage and documentation-drift observations. None of the five items touch the RNG-order-preservation or endless-terminator concerns the phase was most worried about — those hold up under scrutiny.

## Critical Issues

### CR-01: `engine/death.js#bury()` is never called by any production code path — starve/fall/gorge deaths (and, more broadly, every engine-routed death) silently never reach the graveyard

**File:** `src/browser/engineAdapter.js` (missing call site — the file as a whole), cross-referenced with `engine/movement.js:108` and `engine/movement.js:248`

**Issue:** `engine/death.js` exports `bury(state, cause, detail, graves, now)`, whose JSDoc explicitly states it exists because "the graveyard array itself is owned by the persistence layer — this function never touches localStorage." `engine/movement.js`'s own `winGame()` JSDoc repeats this contract: "the caller supplies the current graveyard array and calls `bury` itself once it has one to persist." `03-CONTEXT.md`'s locked decision for this phase is: *"Keep the death/graveyard system (engine `die`/`bury`) intact."*

Tracing every caller of `bury(` in the repo (`Grep` across all `.js` files) shows it is referenced **only** from `engine/death.js` itself (definition) and `test/unit/death.test.js` (unit tests exercising it in isolation). It is never imported or called by:
- `src/browser/engineAdapter.js` (`dispatch()` swaps state and calls `persist()` for the *save*, `SAVE_KEY`, but never touches a graveyard array or a `GRAVE_KEY`-equivalent for the engine-driven state)
- `engine/engine.js` (`applyAction` has no post-death hook)
- `mazeworld.html`'s engine-wiring module script (`window.move`'s handler at line ~3294 just calls `dispatch()`, syncs `__mzState`, paints/draws, and pushes `html` lines to the log — no graveyard write)

Meanwhile, `engine/movement.js` — a file this phase's plan directly modified — contains two death paths that call `engine/death.js#die()` directly, with no combat object and no subsequent classic-script involvement at all:
- Line 108: `if (state.c.wp <= 0) die(state, climbing ? "fall" : "gorge", null, rng, events, now);` (climb/gorge fall damage)
- Line 248: `die(state, "starve", null, rng, events, now);` (starvation in `newDay()`)

Since `window.move` is the *only* input path rerouted through the engine (confirmed: `Grep "^\s*window\.\w+\s*="` across `mazeworld.html` returns only `window.move` and `window.newGame`), and neither `dispatch()` nor the `window.move` handler ever calls `bury()`, **every starvation death and every climb/gorge fall-death that happens through the ported movement system is permanently un-recorded in the persistent graveyard.** The visible "Interred" panel (`mazeworld.html`'s `graves`/`GRAVE_KEY`) only still receives entries because the *classic*, unported combat/spell code (`mazeworld.html:2921`'s own separate `die()`, still reachable via the still-classic-driven Strike/Flee/Parley/spell action buttons) happens to call the classic `bury()` independently — a coincidental survivor of the old prototype, not the engine's `bury()` this phase's CONTEXT.md said to preserve.

This is squarely a data-loss/incorrect-behavior bug per this review's classification rubric: a documented, load-bearing feature (permanent graveyard record of every permadeath — a core piece of this "chase a higher depth/score" roguelike's identity, per `PROJECT.md`) silently fails for an entire death-cause category, and this phase's own difficulty-curve design explicitly leans on starvation/attrition as the primary *endgame* difficulty lever ("attrition, not stat inflation... rations/upkeep... drives endgame difficulty" — `03-CONTEXT.md`), meaning this exact bug's practical impact *grows* the deeper/longer a run goes, which is the entire point of this phase. It is invisible to the automated suite (317/317 green) because no test exercises the full `window.move` → `dispatch()` → death → graveyard-persistence chain end-to-end; `bury()` is only ever unit-tested in isolation.

**Fix:** Wire `bury()` into the persistence layer's death path, the same way `recordBest()` already hooks `startNewRun()`. Minimal shape (adapt key/merge strategy to taste — whether this should share `mazeworld.html`'s existing `mazeworld.graveyard.v1` key or use a new one is a design call, not this review's to make, but *some* wiring must exist):

```javascript
// src/browser/engineAdapter.js
import { bury } from "../../engine/death.js";

const GRAVE_KEY = "mazeworld.graveyard.v1"; // match mazeworld.html's existing key so both write to one graveyard

function persistGrave(state, events) {
  const diedEvent = events.find((e) => e.type === "died");
  if (!diedEvent) return;
  try {
    const raw = localStorage.getItem(GRAVE_KEY);
    const prevGraves = raw ? JSON.parse(raw) : [];
    const graves = bury(state, diedEvent.cause, null, Array.isArray(prevGraves) ? prevGraves : []);
    localStorage.setItem(GRAVE_KEY, JSON.stringify(graves));
  } catch {
    /* private window, blocked storage — matches persist()'s posture */
  }
}

// inside dispatch(), after `currentState = state; persist();`:
persistGrave(currentState, events);
```

At minimum, add a test that drives a real starvation or climb-fall death through `dispatch({type:"move",...})` and asserts a graveyard entry was written — the current suite has no such test, which is exactly how this gap shipped un-caught.

**Disposition: FIXED** (commit `69022ed`). Wired `bury()` into `src/browser/engineAdapter.js#dispatch()` rather than `startNewRun()` as the review's illustrative snippet located it — adapted because `dispatch()` is the single choke point every engine-routed death (combat via `combat.js`, trap/maze/insanity via `encounters.js`, starve/fall/gorge via `movement.js`) passes through as a `died` event, and the raw `cause` string is only available at that moment (`GameState` itself never persists it, so a later `startNewRun()` call would have no cause to bury with). Added `GRAVE_KEY = "mazeworld.graveyard.v1"` matching `mazeworld.html`'s existing key, `persistGrave(state, cause)` (try/catch-wrapped, same fail-safe posture as `persist()`/`recordBest()`), and a hook in `dispatch()` after `persist()`. Graveyard stays adapter-side (localStorage), not folded into `GameState`, per `03-CONTEXT.md`. Added 4 regression tests to `test/unit/engineAdapter.test.js`: a starvation death (no combat object) writes a tombstone; a climb/gorge-fall death (RNG-conditional, skips gracefully if the seed's floor has no adjacent climb/gorge tile — the starvation test already proves the no-combat-object path); repeated deaths across runs accumulate multiple tombstones (newest-first); `persistGrave` never throws when storage is blocked.

## Warnings

### WR-01: `genFloor`'s returned floor object stores the raw, unclamped `depth` parameter instead of `difficultyCurve`'s sanitized value — the NaN/negative-depth guard protects the curve's *outputs* but not the *state* that flows back into future floors

**File:** `engine/maze.js:174` (also `engine/movement.js:392`)
**Issue:** `engine/difficulty.js`'s `safeDepth()` is explicitly documented as existing so "a corrupted/non-integer/non-positive save-derived `floor.depth`... can never poison this module's output with NaN/Infinity, **which could later corrupt a serialized floor**." In practice, `genFloor` computes `dc = difficultyCurve(depth)` (correctly sanitized internally) but then returns:

```javascript
// engine/maze.js:174
return { g, px: 1, py: 1, depth };
```

— the raw `depth` *parameter*, not `dc.depth` (the clamped value). So while the dots/darkBlobs/darkRadius used to *generate* that floor are safely bounded, the `depth` value written into the returned (and later serialized) floor object is not. `engine/saveState.js#isValidFloor` only checks `Number.isInteger(f.depth)`, not that it's ≥ 1 — so a hand-edited save with `"floor":{"depth":-500,...}` passes validation and rehydrates. On the next `descend()`:

```javascript
// engine/movement.js:392
const bonus = 40 + 30 * state.floor.depth; // uses the RAW, possibly-negative depth directly
...
state.floor = genFloor(state.floor.depth + 1, rng); // genFloor sanitizes internally, but...
```

the SP-bonus formula (unrelated to `difficultyCurve`, and not routed through `safeDepth` at all) produces a large *negative* SP grant, and the new floor's returned `depth` is still the raw, still-negative `state.floor.depth + 1` — the corruption is **not healed by the guard that was written specifically to prevent this class of problem**. (For a negative-integer tamper it does self-correct over N further descends once the counter increments back past 0, since `depth` always advances by exactly +1; a save that somehow reached a true `NaN` depth — not achievable via valid JSON today, but worth guarding defensively given `descend()`'s formula doesn't use `safeDepth` either — would never self-correct, since `NaN + 1 === NaN` forever, permanently soft-locking `c.sp`/`levelFromSP` at level 1.) No test in the suite exercises `genFloor()` or `descend()` with a negative/zero/NaN depth to catch this (confirmed: no `genFloor(-`/`genFloor(0`/`genFloor(NaN` call sites exist anywhere under `test/`).

**Fix:**
```javascript
// engine/maze.js:174
return { g, px: 1, py: 1, depth: dc.depth };
```
and, for defense in depth, route `descend()`'s bonus formula through the same guard rather than the raw field:
```javascript
// engine/movement.js — descend()
import { difficultyCurve } from "./difficulty.js"; // or export safeDepth from difficulty.js
const bonus = 40 + 30 * difficultyCurve(state.floor.depth).depth;
```

**Disposition: FIXED** (commit `c60f868`). Applied both parts of the suggested fix essentially as-is: `engine/maze.js#genFloor` now returns `depth: dc.depth` instead of the raw parameter; `engine/movement.js#descend()` now computes `const safeFloorDepth = difficultyCurve(state.floor.depth).depth;` and uses that in the SP-bonus formula. Both changes are no-ops for any valid depth ≥ 1 (verified: full suite unchanged at 321/321 immediately after, before new tests were added). Added regression tests: `test/unit/maze.test.js` asserts `genFloor(tampered, rng).depth` stays a sane integer ≥ 1 for `[-500, 0, -1, 1.7, NaN, Infinity, -Infinity]`; `test/unit/movement.test.js` drives `move()` into `descend()` with a tampered `state.floor.depth` for the same set and asserts the SP bonus stays ≥ 40 and finite, and the new floor's own depth is sanitized too.

## Info

### IN-01: `difficultyCurve`'s NaN/Infinity handling is correct but untested at the `difficultyCurve()`/`isBreather()` call boundary

**File:** `test/difficulty/difficulty.test.js:93-101`
**Issue:** The "tolerates a non-integer or non-positive depth" test exercises `[0, -3, 1.5]` only. `safeDepth()`'s own JSDoc specifically calls out NaN and ±Infinity as the motivating threat ("a corrupted/non-integer/non-positive save-derived `floor.depth`... Handles NaN/±Infinity too"), but no test passes `NaN`, `Infinity`, or `-Infinity` directly to `difficultyCurve()` or `isBreather()` to confirm this. Hand-tracing confirms the implementation is correct (`Math.floor(NaN)` / `Math.floor(Infinity)` are both non-finite, so `Number.isFinite` short-circuits to depth 1 either way) — this is a coverage gap, not a live bug, but it's precisely the scenario the code's own comments say the guard exists for.
**Fix:** Add `NaN`, `Infinity`, `-Infinity` to the parameterized list in that test.

**Disposition: FIXED** (commit `4a53ebc`). Added `NaN`, `Infinity`, `-Infinity` to the existing parameterized `difficultyCurve` test's depth list, plus a new dedicated test confirming `isBreather()` also returns a plain boolean (never throws) for all three. Confirms the review's own hand-traced conclusion: implementation was already correct, this closes the coverage gap only.

### IN-02: Redundant double `safeDepth()` computation in `difficultyCurve()`

**File:** `engine/difficulty.js:94-103`
**Issue:** `difficultyCurve(depth)` computes `const d = safeDepth(depth)`, then calls `isBreather(d)`, which itself calls `safeDepth(d)` again internally (idempotent, so no correctness issue — `safeDepth(safeDepth(x)) === safeDepth(x)` always). Purely a minor, harmless inefficiency/readability nit.
**Fix:** Either export an `isBreatherSafe(d)` internal variant that skips the redundant clamp, or accept this as intentional defensive redundancy (both are fine; flagging only for awareness).

**Disposition: FIXED** (commit `f43c775`). Took the review's first offered option: extracted an unexported `isBreatherOfSafeDepth(d)` that assumes its input is already sanitized; `difficultyCurve()` now calls that directly instead of the public `isBreather(depth)`, while `isBreather(depth)` itself keeps its own `safeDepth()` call so external/test callers with an untrusted value stay safe. Behavior-preserving — full suite unchanged (324/324) immediately before and after.

### IN-03: Stale header comment in `mazeworld.html`'s engine-wiring module script now misdescribes what's ported

**File:** `mazeworld.html:3267-3274`
**Issue:** The comment block introducing the engine-adapter `<script type="module">` still reads: *"Combat/store/New-Delve/camp stay on the existing prototype code path above; those slices are wired in later plans (01-08/01-09/01-10)."* This is a Phase-1-era (01-07) comment that was accurate when written but is no longer true for "New-Delve": this very phase's `window.newGame` override (lines 3302-3318, immediately below the stale claim) reroutes New-Delve through the engine's `startNewRun()`. A future maintainer skimming only this header (e.g., during the Phase 4/5 presentation rewrite this comment explicitly anticipates) could reasonably conclude New-Delve is still classic-script-driven, when it isn't.
**Fix:** Update the header comment to say movement *and new-run* are rerouted, or remove "New-Delve" from the "stays on the existing prototype path" list.

**Disposition: FIXED** (commit `a313acd`). Rewrote the header comment: it now states movement AND New-Delve are both rerouted through the engine adapter, points to `window.newGame` below for the New-Delve wiring, and drops "New-Delve" from the "stays on the existing prototype path" list (leaving Combat/store/camp, which genuinely are still un-ported). Comment-only change; no behavior affected, verified with `node --check` against the extracted `<script type="module">` block plus a full `node --test` pass.

## Fix Disposition

**Fixed at:** 2026-09-08 (fix pass following this review)
**Summary:** 5/5 findings fixed (1 critical, 1 warning, 3 info). 0 skipped/not-fixed.
**Test suite:** `node --test` went from 317/317 (baseline, before this fix pass) to **324/324** (317 + 7 new regression/coverage tests) — all green throughout, one commit per finding.

| ID | Severity | Disposition | Commit |
|----|----------|--------------|--------|
| CR-01 | Critical | Fixed (adapted: hooked `dispatch()`'s single choke point rather than `startNewRun()`, since only `dispatch()` has the raw death `cause`) | `69022ed` |
| WR-01 | Warning | Fixed (applied essentially as suggested — `genFloor` returns `dc.depth`; `descend()` routes its SP-bonus formula through `difficultyCurve(...).depth`) | `c60f868` |
| IN-01 | Info | Fixed (NaN/Infinity/-Infinity added to the existing parameterized test, plus an `isBreather` boundary test) | `4a53ebc` |
| IN-02 | Info | Fixed (extracted `isBreatherOfSafeDepth(d)` per the review's first suggested option) | `f43c775` |
| IN-03 | Info | Fixed (header comment rewritten to describe movement + New-Delve rerouting) | `a313acd` |

No findings were skipped or left unfixed. Difficulty balance/curve constants were not touched by any of these fixes (behavior-preserving except CR-01's intended new graveyard-write side effect, which is the fix itself).

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fix pass: Claude (gsd-code-fixer), 2026-09-08_
