# Phase 3: Endless Descent & Difficulty Balance - Research

**Researched:** 2026-09-08
**Domain:** Endless-mode difficulty-curve design for a level-capped dice-rolled roguelike engine (`engine/maze.js`, `engine/movement.js`, `engine/combat.js`, `engine/encounters.js`)
**Confidence:** MEDIUM (engine-specific findings HIGH — direct code read; curve-shape/attrition design patterns MEDIUM — cross-checked genre sources, not project-specific playtest data)

## Summary

The engine already contains two depth-scaling knobs that are the literal seam this phase must tame: `genFloor`'s `nDots = 9 + depth` (encounter-trigger tile count) and `blobs = depth - 1` with per-blob BFS radius `3 + depth` (darkness coverage). Both grow **linearly and unboundedly** with depth today, and the darkness radius compounds with the blob count — at depth ~20 a floor is already close to fully dark, which is exactly the "pure-darkness ambush wall" PITFALLS.md (P10) and CONTEXT.md flag as the failure mode to avoid. The good news: the combat-danger side of the equation is **already bounded** and does not need new work — `startCombat` in `engine/combat.js` clamps foe tier to `Math.min(c.level, floor.depth)` capped at level V, and foe count to `c.level <= 2 ? 2 : 3` (never depth-driven), so a level-V character never faces a mechanically harder single encounter no matter how deep they go. The endless-mode difficulty problem in this codebase is therefore narrower than the generic "endless roguelike" literature suggests: it is not "prevent enemies from out-scaling the player's combat stats" (already solved), it is "bound the two floor-generation knobs that currently diverge, and layer attrition (more triggers, not stronger triggers) on top."

The recommended shape is a single pure `difficultyCurve(depth)` function in a new `engine/difficulty.js` module that both `genFloor` and (optionally) a future encounter-density hook consume. It returns an asymptotic ("soft-cap") value for encounter-dot count and for darkness blob count/radius, using a simple `1 - e^(-depth/k)` diminishing-returns formula that matches the prototype's existing linear feel for the first several floors (preserving the "already-tuned floors 1-5" behavior parity requires) and then flattens well before the density becomes unfair. A `BREATHER_EVERY = 5` cadence zeroes darkness and floors the dot count back to baseline on breather floors. Concrete starting constants and the full formula are in "Standard Stack" / "Code Examples" below.

Because there is no external service, library, or npm package involved in this phase's balance work, this is a pure-logic/content-tuning research area — the "sources" for curve-shape validity are genre design precedent (cross-checked across three separate searches converging on the same failure pattern already documented in this project's own PITFALLS.md) plus direct inspection of this codebase's actual current scaling formulas.

**Primary recommendation:** Add `engine/difficulty.js` exporting `difficultyCurve(depth)` and named constants; have `genFloor` consume it in place of the raw `9 + depth` / `depth - 1` / `3 + depth` formulas; change the descent-tile feature to always be `"exit"` (never `"gate"`); leave `startCombat`'s existing level/count clamps untouched (they already do the anti-unwinnable job); add a property-test suite asserting the fairness bounds across a large seed × depth sample; and build a zero-dependency `tools/tune-difficulty.mjs` harness that auto-plays many seeded runs with a simple heuristic policy to report death-depth and action-count distributions as a tuning proxy ahead of the deferred human playtest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Floor/maze generation (`genFloor`) | Rules/Simulation Engine (`engine/maze.js`) | — | Pure function of `(depth, rng)`; must stay engine-only per the project's decoupling constraint |
| Difficulty-curve constants/formula | Rules/Simulation Engine (`engine/difficulty.js`, new) | — | Consumed by `genFloor` and (indirectly) `combat.js`'s existing clamps; must be a pure, serialization-free module so it round-trips with everything else |
| Encounter/foe scaling (tier, count) | Rules/Simulation Engine (`engine/combat.js`) | — | Already implemented and already bounded (level/count clamps); this phase does not change it, only documents why it's already safe |
| Descent/run-terminator (`descend`, removal of `winGame` as an ending) | Rules/Simulation Engine (`engine/movement.js`) | — | Pure state transition; permadeath (`engine/death.js`) remains the sole terminator |
| Best-depth/score tracking | Rules/Simulation Engine (`engine/state.js`, `engine/saveState.js`) | — | Must be serializable GameState fields so Phase 2's native persistence layer can pick them up unchanged |
| Tuning/balance harness (auto-play policy, distribution reporting) | Dev tooling (`tools/` or `scripts/`, new, Node built-ins only) | Rules/Simulation Engine (consumes `applyAction`/`newRun` as a black box) | Not part of the shipped app; a standalone Node script that drives the public engine API exactly as the real UI would — must not reach into engine internals |
| One-tap "new run" from death card | Browser dev adapter (`src/browser/engineAdapter.js`) | Rules/Simulation Engine (`newRun`) | The button/UI is presentation; the adapter's job is to call the engine's `newRun(seed)` factory and swap state — no new engine action type is strictly required (see Code Examples) |
| Fairness/property tests | Test suite (`test/unit/`, `test/determinism/`, new files) | — | Automated, no-human-required proxy for "no floor is a statistical death sentence"; the real UAT validator is the deferred human playtest per CONTEXT.md |

## Standard Stack

### Core

This phase adds **no new runtime dependency** (project constraint: ZERO runtime deps; `.claude/CLAUDE.md` mandates Node built-in test tooling only). The "stack" here is entirely new pure-JS modules inside the existing `engine/` tree plus one new dev-only script.

| Module (new) | Purpose | Why this shape |
|---------|---------|--------------|
| `engine/difficulty.js` | Exports `difficultyCurve(depth)` + named tunable constants (`BREATHER_EVERY`, `ENCOUNTER_DOT_BASE`, `ENCOUNTER_DOT_CAP`, `ENCOUNTER_DOT_SOFT_K`, `DARK_BLOB_CAP`, `DARK_RADIUS_BASE`, `DARK_RADIUS_CAP`) | Single source of truth the planner's tasks and the tuning harness both import; keeps `genFloor` a thin consumer instead of re-deriving formulas inline, matching the existing pattern of `engine/derived.js` as a pure-computation module |
| `tools/tune-difficulty.mjs` (new, dev-only, not shipped) | Runs N seeded runs with a heuristic auto-play policy against `applyAction`/`newRun`, reports death-depth/action-count distributions | Zero-dependency (Node built-ins: `node:test` is NOT needed here since this is a report script, not an assertion — plain `node tools/tune-difficulty.mjs` run via `node`) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in (Node 22+, already the project's test runner) | Property-style fairness tests over many seeds/depths | New files under `test/unit/` (curve unit tests) and a new `test/determinism/` or `test/unit/` file for the cross-seed fairness sweep |
| `node:assert/strict` | built-in | Assertions in the new tests | Same as above |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `1 - e^-(depth/k)` soft-cap formula | A lookup table of hand-tuned per-floor constants | A table is more "designed by feel" but is not a *function* of depth — harder to reason about/extrapolate past the last tuned row, and every extension requires editing a growing table. The formula generalizes to arbitrary depth for free, which matters for a truly endless mode. |
| A single scalar `difficultyCurve(depth)` returning a plain object | A class/OOP "DifficultyManager" with internal state | The engine's existing pattern (`derived.js`, `dice.js`) is small pure functions of explicit arguments, no classes, no module-level mutable state — matching that keeps this phase's code idiomatically consistent with Phase 1's extraction and avoids reintroducing any hidden-state coupling risk (PITFALLS.md P13). |
| Node-script tuning harness | A `node:test`-based "simulation test" that asserts hard pass/fail on death-depth median | A hard-gating test on a heuristic bot's median death depth is fragile (bot skill is arbitrary, not real-player skill) and risks becoming a false confidence signal. Keep the harness a *reporting* tool (stdout/JSON) that a human reads while tuning constants, with only the *bound* properties (density caps, no-crash, seed determinism) as real `node:test` assertions. |

**Installation:** none — no new package.json dependency. `tools/tune-difficulty.mjs` runs via `node tools/tune-difficulty.mjs`.

**Version verification:** N/A — no external package versions to verify. Project already targets `"engines": {"node": ">=22"}` in `package.json`, confirmed by direct read.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (project constraint: ZERO runtime deps, `.claude/CLAUDE.md`). No `npm install`, no new `package.json` dependency entries. The Package Legitimacy Gate is skipped in full — nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │        engine/difficulty.js (NEW)         │
                    │  difficultyCurve(depth) -> {              │
                    │    breather, dots, darkBlobs, darkRadius } │
                    └───────────────┬─────────────────────────┘
                                    │ pure fn call, no RNG consumed
                                    ▼
   applyAction("move" into      ┌──────────────────────────┐
   an "exit" tile)  ──────────▶ │  descend()  (movement.js)  │
                                    │  awards SP, checkLevel,   │
                                    │  genFloor(depth+1, rng)   │──┐
                                    └──────────────────────────┘   │
                                                                    ▼
                                                    ┌───────────────────────────┐
                                                    │  genFloor(depth, rng)       │
                                                    │  (maze.js) — consumes       │
                                                    │  difficultyCurve(depth) for │
                                                    │  nDots / blob count /       │
                                                    │  blob radius; ALWAYS sets   │
                                                    │  descent tile = "exit"      │
                                                    │  (no "gate" past depth 5)   │
                                                    └───────────┬───────────────┘
                                                                │ feature-tile
                                                                ▼ placement
                                          ┌─────────────────────────────────┐
                                          │  move() dispatches feat="dot"     │
                                          │  -> encounterDot() (encounters.js)│
                                          │  -> ENCOUNTER_TABLES[d8][d10]     │
                                          │  -> combat type roll              │
                                          └───────────────┬───────────────────┘
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │  startCombat() (combat.js)         │
                                          │  ALREADY bounded:                  │
                                          │  tier = clamp(min(lvl,depth),1,5)  │
                                          │  count = lvl<=2 ? 2 : 3            │
                                          │  (untouched by this phase)         │
                                          └─────────────────────────────────┘

   Death (any cause) ──▶ die() (death.js) sets state.dead — the ONLY run
                          terminator; winGame()'s "gate" path becomes dead
                          code once genFloor stops emitting "gate".

   Tuning proxy (dev-only, offline):
   tools/tune-difficulty.mjs ──▶ newRun(seed) + applyAction() loop with a
   heuristic policy ──▶ death-depth / action-count distribution report
   (NOT part of the shipped app; NOT a substitute for human playtest)
```

### Recommended Project Structure

```
engine/
├── difficulty.js       # NEW — difficultyCurve(depth) + tunable constants
├── maze.js              # MODIFIED — genFloor consumes difficultyCurve(); descent tile always "exit"
├── movement.js          # MODIFIED — descend() has no depth ceiling; winGame() path becomes unreachable (see Pitfall below)
├── state.js             # MODIFIED — newRun() adds bestDepth/score fields to GameState
tools/
└── tune-difficulty.mjs  # NEW — dev-only headless tuning harness (not shipped, not in engine/)
test/
├── unit/
│   └── difficulty.test.js        # NEW — difficultyCurve() unit tests (breather cadence, monotonic bound)
└── determinism/ or unit/
    └── floor-fairness.test.js    # NEW — property sweep: N seeds x M depths, assert density caps hold
```

### Pattern 1: Pure soft-cap curve function, consumed by the existing generator

**What:** A single exported function that maps `depth -> tunable knobs`, with no side effects and no RNG consumption (so it never perturbs the `rng` cursor and stays parity-test-safe for anything that doesn't depend on the new depths).
**When to use:** Any per-floor or per-encounter density knob that currently scales unboundedly with `depth` (`nDots`, dark blob count, dark blob radius).
**Example:**
```javascript
// engine/difficulty.js — NEW module. No RNG, no DOM, no Math.random.
// Ports the design intent of the prototype's original `9 + depth` /
// `depth - 1` knobs (mazeworld.html-derived, engine/maze.js today) into a
// bounded, asymptotic curve so deep floors keep the SAME early-game feel
// (floors 1-10 track the old linear formula closely) but never exceed a
// fairness cap no matter how deep the run goes.

export const BREATHER_EVERY = 5; // every 5th floor past the first is a breather

export const ENCOUNTER_DOT_BASE = 9;   // matches the prototype's original "9"
export const ENCOUNTER_DOT_CAP = 24;   // soft ceiling: ~11% of a 21x21 floor's ~220 open cells
export const ENCOUNTER_DOT_SOFT_K = 12; // curve "bend" depth — see softCap()

export const DARK_BLOB_CAP = 6;        // never more than 6 dark-zone seeds per floor
export const DARK_RADIUS_BASE = 3;
export const DARK_RADIUS_CAP = 9;      // never darkens more than a 9-tile BFS radius per blob

/** isBreather(depth) — every BREATHER_EVERY-th floor after floor 1 is a breather. */
export function isBreather(depth) {
  return depth > 1 && (depth - 1) % BREATHER_EVERY === 0; // floors 6, 11, 16, ...
}

/**
 * softCap(base, cap, depth, k) — an asymptotic ("diminishing returns") curve:
 * value(depth) approaches `cap` as depth grows but never reaches it. Chosen
 * over a hard clamp (`Math.min(base+depth, cap)`) because a hard clamp has a
 * visible "kink" where the curve suddenly flatlines; this stays smooth and
 * still tracks the original linear formula closely for depth << k.
 */
function softCap(base, cap, depth, k) {
  return Math.round(base + (cap - base) * (1 - Math.exp(-depth / k)));
}

/**
 * difficultyCurve(depth) — the single source of truth genFloor consumes.
 * Pure function of depth only; consumes no RNG (call order/count is
 * unaffected, so this cannot desync the seeded RNG stream).
 */
export function difficultyCurve(depth) {
  const breather = isBreather(depth);
  return {
    depth,
    breather,
    dots: breather ? ENCOUNTER_DOT_BASE : softCap(ENCOUNTER_DOT_BASE, ENCOUNTER_DOT_CAP, depth, ENCOUNTER_DOT_SOFT_K),
    darkBlobs: breather ? 0 : Math.min(Math.max(0, depth - 1), DARK_BLOB_CAP),
    darkRadius: breather ? 0 : Math.min(DARK_RADIUS_BASE + depth, DARK_RADIUS_CAP),
  };
}
```

`genFloor` then replaces its three inline formulas:
```javascript
// engine/maze.js — BEFORE (current code, lines 112 and 121-122):
const nDots = 9 + depth;
// ...
if (depth >= 2) {
  const blobs = depth - 1;
  for (let bIdx = 0; bIdx < blobs && open.length; bIdx++) {
    const [sx, sy] = rng.pick(open);
    const d2 = bfs(g, sx, sy);
    for (const [x, y] of open) if (d2[y][x] >= 0 && d2[y][x] <= 3 + depth) g[y][x].dark = true;
  }
  g[1][1].dark = false;
}

// AFTER — consumes difficultyCurve(depth); RNG call order/count UNCHANGED
// (rng.pick(open) is still called exactly `dc.darkBlobs` times, same as
// `blobs` times before — this preserves determinism/parity for any test
// that doesn't specifically exercise depth > what was tuned before).
import { difficultyCurve } from "./difficulty.js";
// ...
const dc = difficultyCurve(depth);
const nDots = dc.dots;
// ...
if (dc.darkBlobs > 0) {
  for (let bIdx = 0; bIdx < dc.darkBlobs && open.length; bIdx++) {
    const [sx, sy] = rng.pick(open);
    const d2 = bfs(g, sx, sy);
    for (const [x, y] of open) if (d2[y][x] >= 0 && d2[y][x] <= dc.darkRadius) g[y][x].dark = true;
  }
  g[1][1].dark = false;
}
```

And the descent-tile line drops its floor-5 special case entirely:
```javascript
// BEFORE:
g[best[1]][best[0]].feat = depth >= 5 ? "gate" : "exit";
// AFTER (endless — the Gate never spawns again):
g[best[1]][best[0]].feat = "exit";
```

### Pattern 2: Attrition over inflation — what to scale and what NOT to

**What:** CONTEXT.md's design intent (and PITFALLS.md P10's documented failure mode) is "attrition, not stat inflation" past the level cap. Concretely, in THIS engine that means:

| Lever | Currently in `genFloor`/`combat.js` | Depth-scale it? | Why |
|---|---|---|---|
| Encounter-trigger tile count (`nDots`) | `9 + depth`, unbounded | **Yes — via `difficultyCurve`** | More rolls of the SAME encounter-odds table = more expected combat/hazard exposure without touching any individual roll's fairness. This is the attrition lever. |
| Darkness blob count + radius | `depth-1` blobs, `3+depth` radius, unbounded, compounding | **Yes — via `difficultyCurve`, both capped** | Darkness increases navigation difficulty and ambush risk (foeToHitVs/toHit both worsen `inDark`); left unbounded it becomes a full-floor ambush wall (the exact pitfall flagged). Cap count AND radius independently — capping only one still lets the other runaway. |
| Foe tier (`BESTIARY[type][lvl-1]`) | Already clamped: `maxLvl = clamp(min(c.level, floor.depth), 1, 5)` | **No — leave untouched** | Already asymptotic by construction: once `c.level` hits the V cap, `maxLvl` is capped at 5 regardless of `floor.depth`. This is the "soft-cap on creature tier" CONTEXT.md asks for — it already exists in `combat.js` and needs no new code. |
| Foe count per encounter | `wandering ? 1 : min(cap, d4-derived 1-3)`, `cap = c.level<=2?2:3` | **No — leave untouched** | Already player-level-driven, not depth-driven; multi-foe counts do NOT currently grow with depth. If the tuning harness (see below) shows runs are still too easy at depth 30+, raising `cap` is a candidate follow-up, but it is NOT part of this phase's starting-point defaults (would touch `combat.js`, a different module than the CONTEXT-scoped `genFloor`/movement work). |
| Trap/chest/climb/gorge feature counts | Fixed at `2` each regardless of depth | **No — leave as Claude's-discretion optional secondary lever** | Lower priority than the two knobs CONTEXT explicitly names; scaling these adds more forced-roll hazard exposure (another attrition vector) but risks also scaling LOOT access (chests) upward, which is a reward-economy question, not purely a difficulty one. Flag as future-tuning, not a starting default. |
| Upkeep/rations (`upkeep(c)`, `RACES[c.race].eats`) | Race-fixed, not depth-scaled | **No — do not touch** | These are character/race data (content tables), not floor-generation knobs; scaling them by depth would mean editing `content/races.js`, a canon-fidelity table Phase 3's scope (`genFloor`/`movement.js`/`encounters.js`/`content/*` bestiary only) does not call out for modification. Attrition already emerges naturally from MORE encounters (via `nDots`) draining more rations/WP per floor as depth increases — no separate direct scaling needed. |

**Key insight:** This engine's player-power plateau is milder than the generic "endless roguelike" failure case because `startCombat`'s clamps already prevent per-encounter difficulty from diverging past level V. The only two genuinely-unbounded knobs are floor-generation density knobs (`nDots`, darkness), and both are entirely inside `genFloor` — this phase's core work is narrowly scoped to that one function plus the terminator change in `movement.js`.

### Anti-Patterns to Avoid

- **Multiplying foe stats by a per-floor factor:** Not present in this codebase today and must not be introduced — `combat.js`'s `wp`/`dmg` come straight from the `BESTIARY` roster entry for the clamped tier; there is no floor-depth multiplier anywhere in the damage/WP formulas (`foeDie`, `weaponDamage`, `killFoe`'s SP formula). Keep it that way; this is the exact failure mode PITFALLS.md P10 and CONTEXT.md warn against.
- **Hard clamp with a visible kink instead of a smooth soft-cap:** `Math.min(base + depth, cap)` technically bounds the value but produces a sudden flatline at one specific depth, which can feel like an arbitrary wall was hit rather than a gradual difficulty ease. Prefer the exponential soft-cap (Pattern 1) for a smoother curve, unless the tuning harness shows the smooth curve doesn't matter in practice (in which case the simpler hard clamp is an acceptable simplification — note this as an open question below).
- **Scaling the darkness blob radius without also capping blob count (or vice versa):** These two knobs compound multiplicatively (total dark tiles ≈ blobs × blob-area, with overlap). Capping only one still allows runaway coverage from the other; both must be independently bounded (see Pattern 1's `DARK_BLOB_CAP` and `DARK_RADIUS_CAP`).
- **Leaving the old `depth >= 5 ? "gate" : "exit"` branch in place "just in case":** Endless descent means the Gate must never spawn again, full stop — a conditional Gate-at-depth-5-only branch left in place is dead code that also risks confusing future maintainers about whether the Gate still exists. Remove it; see the Common Pitfalls section for the one place this needs a deliberate compatibility decision (an in-flight save already sitting on a "gate" tile).

## Runtime State Inventory

This is not a rename/refactor phase in the trigger sense (Step 2.5), but it shares the exact same shape of risk in one specific spot: **an existing localStorage save may already contain a generated floor-5 grid with a `"gate"` feature tile**, created by the OLD `genFloor` before this phase's code ships. Documenting explicitly, per the canonical question ("after every file in the repo is updated, what runtime state still has the old behavior baked in?"):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | An in-progress `localStorage["mazeworld.delve.v1"]` save (browser dev loop only — no native persistence yet, that's Phase 2) may contain a `floor.g` grid with a cell whose `feat === "gate"`, generated before this phase's `genFloor` change ships. | **Code edit, defensive branch in `move()`**: keep (or add) a `feat === "gate"` case in `engine/movement.js`'s `move()` dispatch that calls `descend(state, rng, events)` instead of `winGame(...)` — i.e., route any legacy Gate tile a player is mid-floor-on to "continue deeper" rather than ending the run, exactly as CONTEXT.md specifies ("if any legacy Gate handling remains, route it to continue deeper"). This is a one-line change, not a data migration — no save-file rewrite needed since the player will simply walk onto the tile and it will behave as an exit. |
| Live service config | None — this project has no external/live services (fully offline, no server). | None. |
| OS-registered state | None — native packaging (Capacitor, Android Task/back-button registration) is Phase 2/4, not touched here. | None. |
| Secrets/env vars | None — no secrets or env vars are involved in floor generation or difficulty tuning. | None. |
| Build artifacts / installed packages | None — no build step, no installed packages change (ZERO runtime deps maintained). | None. |

## Common Pitfalls

### Pitfall 1: Darkness blob count and radius compounding into a full-floor ambush wall

**What goes wrong:** `blobs = depth - 1` and per-blob radius `3 + depth` both currently grow unboundedly and independently. By depth ~15-20, the maze's ~220 open cells are covered by darkness blobs whose radius alone (18-23) already exceeds the 21x21 grid's diagonal span — meaning a SINGLE blob can already darken nearly the whole floor, and there are `depth-1` of them stacking on top. This is the literal ambush-wall failure CONTEXT.md and PITFALLS.md (P10) name.
**Why it happens:** The prototype's original formula was tuned for a bounded 5-floor game (`depth-1` maxes out at 4 blobs, radius maxes out at 8) — removing the floor cap without bounding the formula lets it run into territory the original design never had to survive.
**How to avoid:** Cap BOTH `darkBlobs` and `darkRadius` independently (Pattern 1's `DARK_BLOB_CAP`/`DARK_RADIUS_CAP`), and zero both on breather floors.
**Warning signs:** A property test (see Validation Architecture) that computes `darkTileCount / openTileCount` for many seeds at high depth and finds it approaching 1.0.

### Pitfall 2: Encounter-dot count exceeding the available "far" tile pool

**What goes wrong:** `nDots = 9 + depth` is drawn from `far` — open cells at BFS distance > 4 from spawn with no existing feature. `far.length` is finite (bounded by the maze's open-cell count minus already-placed features). At high depth, `nDots` can exceed `far.length`, silently truncating (the `k < nDots && i < far.length` loop guard already handles this gracefully — no crash — but it means the density cap effectively becomes "however many far cells exist," which varies per-seed and isn't the intentional design bound).
**Why it happens:** Same root cause as Pitfall 1 — an unbounded linear formula that was fine for depth ≤ 5 stops being fine once depth is unbounded.
**How to avoid:** `ENCOUNTER_DOT_CAP` (Pattern 1) should be picked conservatively relative to a typical `far.length` for this maze size (empirically verify via the fairness property test — see Validation Architecture) so the cap is the binding constraint, not the maze's physical tile budget.
**Warning signs:** A property test logging `far.length` vs `nDots` across many seeds at the deepest tested depth and finding `nDots > far.length` in a nontrivial fraction of seeds.

### Pitfall 3: Treating the auto-play tuning harness's output as ground truth

**What goes wrong:** It is tempting to tune `ENCOUNTER_DOT_CAP`/`DARK_BLOB_CAP`/etc. until the harness's heuristic bot reports a median death depth in some target range, and treat that as "balanced." A heuristic bot's play skill is arbitrary — it may flee too eagerly (runs die of starvation instead of combat, understating combat lethality) or too rarely (runs die at floor 3 to a fight a real player would have fled, overstating difficulty).
**Why it happens:** The harness is the only automated signal available before the real human playtest (CONTEXT.md explicitly defers "feels right" tuning to end-of-milestone playtest), so it's easy to over-trust it under schedule pressure.
**How to avoid:** Use the harness ONLY for the properties that are genuinely policy-independent: (a) does ANY seed produce a floor whose density exceeds the fairness caps (a hard bug, not a tuning question), (b) do death causes/depths show a monotonic trend with depth (sanity, not calibration), (c) roughly how many actions does a typical run take (a proxy for session length, useful for initial constant-picking, explicitly labeled approximate). Do NOT gate the build on the bot's specific median death depth.
**Warning signs:** A commit message or plan step that says "tuned until the bot's median matched floor N" as if that were sufficient validation — CONTEXT.md's own deferred-items list explicitly says this needs real human play to floor 30-50+.

### Pitfall 4: Reusing `content/bestiary.js`'s level-V roster forever without any new-content signal at extreme depth

**What goes wrong:** Once `floor.depth` exceeds 5 (and `c.level` is capped at 5), `startCombat`'s `maxLvl = clamp(min(c.level, floor.depth), 1, 5)` means EVERY encounter from depth 5 onward draws from the exact same level-V roster (`BESTIARY[type][4]`) with no further variation tied to depth at all. This is by design (CONTEXT.md: "beyond that, increase encounter frequency... rather than raw per-enemy stats") but a very long run (deep floors, e.g., 50+) will feel monotonous — same ~2-3 creature options per type forever, no depth-linked narrative signal beyond the sarcastic epitaph/flavor text.
**Why it happens:** The bestiary only has 5 tiers (I-V) per the tabletop-canon fidelity constraint; there is no "tier VI" to reach for.
**How to avoid:** This is explicitly OUT of this phase's scope per CONTEXT.md (no new content, no meta-progression) — flagging as a known, accepted limitation rather than something to fix here. If it becomes a real playtest complaint, the fix belongs in a later content phase (new bestiary tiers or a "boss variant" reroll of the same tier), not in this phase's difficulty-curve work.
**Warning signs:** N/A for this phase — informational only, feeds the Open Questions section below.

## Code Examples

### `genFloor` consuming `difficultyCurve` (full before/after already shown in Pattern 1 above)

### The one-tap "new run" wiring already has a seam — use it, don't invent a new one

```javascript
// engine/actions.js already lists "newGame" in ACTION_TYPES (validated,
// accepted), but engine/engine.js's applyAction() switch does NOT currently
// handle it — it falls through to the `default: break` no-op. This is an
// existing (Phase 1) gap, not something this phase's research invented.
//
// Two valid approaches for the planner to choose between:
//
// (A) Keep newRun() as a factory the ADAPTER calls directly (matches the
//     prototype's newGame(), and matches how src/browser/engineAdapter.js's
//     initRun(seed) already works) — the death-card button calls
//     engineAdapter.initRun(newSeed) directly, bypassing applyAction
//     entirely. Simplest; matches CONTEXT.md's literal wording ("a single
//     action calls newRun(newSeed)") if "action" is read as "adapter call,"
//     not "engine Action object."
//
// (B) Wire "newGame" as a real applyAction case that calls newRun(seed)
//     internally and returns it as the new state — makes "start a new run"
//     go through the same applyAction(state, action) -> {state, events}
//     contract as every other player action, which is more consistent with
//     the project's "everything through applyAction" architecture goal
//     (PITFALLS.md P13) but requires threading a seed through the action
//     object (`{ type: "newGame", seed }`) since applyAction's signature
//     takes the OLD state, not "no state."
//
// (A) is lower-risk and matches the existing adapter pattern exactly;
// (B) is architecturally cleaner. Either is a reasonable planner decision —
// document whichever is chosen, since CONTEXT.md's "Claude's Discretion"
// explicitly covers "how the score is surfaced in the browser dev prototype."
```

### Property-test shape for the fairness sweep (see Validation Architecture for the full mapping)

```javascript
// test/unit/floor-fairness.test.js (illustrative shape, not exhaustive)
import test from "node:test";
import assert from "node:assert/strict";
import { genFloor, GW, GH } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";
import { difficultyCurve, ENCOUNTER_DOT_CAP, DARK_BLOB_CAP, DARK_RADIUS_CAP, isBreather } from "../../engine/difficulty.js";

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1); // 200 sample seeds
const DEPTHS = [1, 5, 6, 10, 15, 20, 30, 50, 75, 100];

test("no floor's actual dark-tile coverage exceeds a sane fraction of open tiles", () => {
  for (const depth of DEPTHS) {
    for (const seed of SEEDS.slice(0, 20)) { // full 200 x 10 is the CI/nightly variant; keep the quick-run subset small
      const floor = genFloor(depth, makeRng(seed));
      let open = 0, dark = 0;
      for (const row of floor.g) for (const cell of row) { if (!cell.wall) { open++; if (cell.dark) dark++; } }
      const coverage = dark / open;
      assert.ok(coverage <= 0.6, `depth ${depth} seed ${seed}: dark coverage ${coverage.toFixed(2)} exceeds fairness cap`);
    }
  }
});

test("breather floors have zero darkness and baseline encounter-dot count", () => {
  const breatherDepths = DEPTHS.filter(isBreather);
  assert.ok(breatherDepths.length > 0, "test sanity: at least one sampled depth must be a breather floor");
  for (const depth of breatherDepths) {
    const dc = difficultyCurve(depth);
    assert.equal(dc.darkBlobs, 0);
    assert.equal(dc.dots, 9); // ENCOUNTER_DOT_BASE
  }
});

test("difficultyCurve never exceeds its documented caps at extreme depth", () => {
  for (const depth of [200, 1000, 10000]) {
    const dc = difficultyCurve(depth);
    assert.ok(dc.dots <= ENCOUNTER_DOT_CAP);
    assert.ok(dc.darkBlobs <= DARK_BLOB_CAP);
    assert.ok(dc.darkRadius <= DARK_RADIUS_CAP);
  }
});
```

### Headless tuning harness skeleton

```javascript
// tools/tune-difficulty.mjs — dev-only, NOT shipped, zero dependencies.
// Run: node tools/tune-difficulty.mjs --seeds=500
//
// Auto-play policy (deliberately simple, deterministic, and documented as
// approximate — NOT a stand-in for real player skill):
//   - In combat: attack, UNLESS wp/maxWP < 0.3 AND flee/parley is viable,
//     in which case try parley first (if canParley), else flee.
//   - In a store: leave immediately (store strategy is out of scope for the
//     difficulty-curve question this harness answers).
//   - Exploring a floor: walk toward the nearest unseen tile using a
//     harness-local seeded RNG (makeRng(seed ^ 0x9e3779b9), a SEPARATE
//     stream from the engine's own rngState) so harness runs are
//     independently reproducible without perturbing engine determinism.
//   - On death or win: record { seed, deathDepth, cause, actionCount }.
//
// Reports (stdout table + optional --json): death-depth distribution
// (min/p50/p90/max), death-cause breakdown, action-count distribution (a
// PROXY for real-world session length — see "Session-length mapping" in
// Open Questions; calibrate the actions-per-minute constant from the real
// playtest, not from this harness).

import { newRun, applyAction } from "../engine/engine.js";
import { makeRng } from "../engine/rng.js";

function autoPlayOnce(seed, policyRng) {
  let state = newRun(seed);
  let actions = 0;
  const MAX_ACTIONS = 20000; // hard safety stop — prevents a runaway loop bug from hanging the harness
  while (!state.dead && !state.won && actions < MAX_ACTIONS) {
    const action = decideAction(state, policyRng); // combat/store/explore dispatch per policy above
    ({ state } = applyAction(state, action));
    actions++;
  }
  return { seed, deathDepth: state.floor.depth, dead: state.dead, cause: state.deathNote, actions };
}

// decideAction(), reportDistribution(), and CLI arg parsing omitted here —
// implement per the policy description above; keep the file dependency-free
// (only imports from engine/ and Node builtins).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fixed 5-floor Gate ending (`winGame`) | Endless descent, permadeath-only terminator | This phase | `winGame`'s code path becomes unreachable once `genFloor` never emits `"gate"`; `state.won` and the "Through the Gate" UI branch in `mazeworld.html` become dead paths this phase does not delete (that's a Phase 4/UI cleanup call, not an engine concern) |
| Linear, unbounded floor-density scaling (`9+depth`, `depth-1`, `3+depth`) | Asymptotic soft-cap via `difficultyCurve(depth)` | This phase | Prevents the darkness/encounter-density "ambush wall" at high depth while preserving the original tuned feel for floors 1-10ish |

**Deprecated/outdated:** The fixed-5-floor Gate concept itself is fully retired by this phase per CONTEXT.md/PROJECT.md — the "Gate" only survives as a legacy-save compatibility branch (Pitfall in Runtime State Inventory above), not as a live design element.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The specific constants (`ENCOUNTER_DOT_CAP=24`, `DARK_BLOB_CAP=6`, `DARK_RADIUS_CAP=9`, `BREATHER_EVERY=5`, `ENCOUNTER_DOT_SOFT_K=12`) are reasonable starting points, not validated against real play | Standard Stack / Code Examples | If wrong, runs feel too easy (caps too low) or still hit a wall (caps too high) before the deferred human playtest catches it — low risk since CONTEXT.md already frames every constant as a tunable, playtest-adjustable default, not a locked decision |
| A2 | "~5-10 minute session" maps roughly to 100-300 engine actions at typical mobile play cadence (1-3 sec/action) | Open Questions / Code Examples (tuning harness) | If the real cadence is very different (e.g., combat rounds take much longer to read on a phone with sarcastic flavor text), the harness's session-length proxy will mis-calibrate the depth/dot-count targets — flagged explicitly as approximate, not authoritative, and the harness reports raw action counts so this constant can be recalibrated later without re-deriving anything |
| A3 | A 0.6 (60%) dark-tile-coverage fairness cap and a `far.length`-relative encounter-dot cap are "fair" thresholds | Common Pitfalls / Code Examples (property test) | These are illustrative starting thresholds from design reasoning, not measured against actual play-feel; the property test's job is to catch REGRESSIONS/runaway growth, not to certify a specific number as "the" correct fairness bar — the planner/user can tighten or loosen this constant freely |
| A4 | Genre design pattern claims (soft-cap/asymptotic curves outperforming linear-vs-exponential divergence; attrition/darkness-pressure design as used in Darkest Dungeon-style games) generalize to this project | Summary / Architecture Patterns | MEDIUM confidence — cross-checked across 3 independent web searches converging on the same failure pattern already independently documented in this project's own PITFALLS.md (P10), which raises confidence above a single-source claim, but none of this is Mazeworld-specific playtest data |

## Open Questions

1. **What are the right numeric values for `ENCOUNTER_DOT_CAP`, `DARK_BLOB_CAP`, `DARK_RADIUS_CAP`, `BREATHER_EVERY`, and the soft-cap `k` constant?**
   - What we know: The formula shape (asymptotic soft-cap, independent caps on count AND radius, periodic breather) addresses the documented failure modes.
   - What's unclear: The exact numbers that produce a "feels right" curve for THIS game's specific combat pacing, weapon/armor progression, and the sarcasm-driven pacing of reading combat/flavor text on a phone.
   - Recommendation: Ship the starting-point defaults above as NAMED, DOCUMENTED constants (already required by CONTEXT.md); let the tuning harness's distribution reports guide a first-pass adjustment; treat the real answer as belonging to the deferred human playtest (CONTEXT.md's own "criterion 3 needs human play to floor 30-50+").

2. **Should `startCombat`'s foe-count cap (`c.level<=2?2:3`) ever grow with depth as a secondary attrition lever, if the harness/playtest shows depth 30+ is still too easy?**
   - What we know: It is currently player-level-driven only, and CONTEXT.md's explicit scope is `genFloor`/`movement.js`/loot-adjacent generation, not `combat.js`'s encounter-composition logic.
   - What's unclear: Whether the two knobs this research recommends (encounter frequency + darkness) alone are sufficient to keep depth 30-50+ engaging, or whether a third lever (foe count) will be needed.
   - Recommendation: Treat as a candidate FOLLOW-UP tuning lever, not a Phase 3 starting default; the tuning harness should specifically report whether death-depth distributions show runs "coasting" past floor 30 with high remaining WP, which would be the signal this lever is needed.

3. **Hard clamp vs. smooth exponential soft-cap — does the smoothness actually matter for player-perceived fairness in THIS game?**
   - What we know: A smooth asymptotic curve avoids a visible "kink," which is a real anti-pattern in many game-balance contexts.
   - What's unclear: Whether a player descending floor-by-floor in this specific UI (no visible "difficulty meter") would ever perceive the difference between a smooth curve and a simple hard clamp at all.
   - Recommendation: Implement the smooth version (marginal extra complexity, strictly better if it matters) but treat "simplify to a hard clamp" as an acceptable simplification if the planner judges the smooth formula adds unjustified complexity for this codebase's style (the rest of `engine/` favors simple, readable arithmetic over parametrized curve math).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | Starting a run generates a 100%-dice-rolled character with no player choices, then reveals it on a character sheet | Engine-level piece (`rollCharacter`, `newRun`) already exists from Phase 1 and is unmodified by this phase's difficulty work; the "character sheet reveal" UI is Phase 4 scope. This phase's only touchpoint is ensuring `newRun(seed)` remains the correct one-call entry point for a fresh run (see Code Examples, "one-tap new run" section) |
| RUN-02 | The player descends procedurally-generated floors endlessly, with no fixed floor cap or Gate ending | Direct: remove the `depth >= 5 ? "gate" : "exit"` branch in `genFloor` (Pattern 1); `descend()` in `movement.js` already has no depth ceiling in its own logic — only `genFloor`'s tile-placement carried the cap |
| RUN-03 | Difficulty scales with depth along a tuned curve (soft-cap/breather floors) so a typical run resolves in ~5-10 minutes and never becomes a trivial or unbeatable wall | Core of this research: `engine/difficulty.js`'s `difficultyCurve(depth)`, the attrition-lever table (Architecture Patterns Pattern 2), the fairness property tests (Validation Architecture), and the tuning harness (Code Examples) all address this directly. Final "feels right" calibration is explicitly deferred to human playtest per CONTEXT.md |
| RUN-04 | Character death is permanent and ends the run (permadeath) | Already fully implemented (`engine/death.js`'s `die()`/`bury()`) and unmodified by this phase; this phase's only related change is ensuring `winGame()` no longer competes with `die()` as a terminator (State of the Art section) |
| RUN-05 | After death, the player can start a fresh run in a single tap from a death screen | The prototype's death card + "Roll another delver" button (`mazeworld.html`'s `armAgain()`/`btn-again`) already exists; this phase's job is wiring it through `src/browser/engineAdapter.js`'s existing `initRun(seed)` (see Code Examples, "one-tap new run" section) — no new engine capability required, only adapter wiring |
</phase_requirements>

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22+ built-in) — already the project's sole test framework, zero dependencies |
| Config file | none — `package.json`'s `"test"` script is `node --test`; no separate config file exists or is needed |
| Quick run command | `npm run test:quick` (`node --test test/unit test/determinism test/roundtrip`) |
| Full suite command | `npm test` (`node --test`, includes the heavier `test/parity` prototype-comparison harness) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-02 | `genFloor` never places a `"gate"` feature at any depth; descent tile is always `"exit"` | unit | `node --test test/unit/maze.test.js` | ❌ Wave 0 — extend existing file with a new test case (file exists, new test needed) |
| RUN-02 | `descend()` can be called past floor 5 indefinitely without hitting any cap | unit | `node --test test/unit/movement.test.js` | ❌ Wave 0 — extend existing file |
| RUN-02 | A legacy in-flight save with a `"gate"` feature tile routes to `descend()`, not `winGame()`, when reached | unit | `node --test test/unit/movement.test.js` | ❌ Wave 0 |
| RUN-03 | `difficultyCurve(depth)` never exceeds its documented caps, for depth up to a very large sample (200, 1000, 10000) | unit | `node --test test/unit/difficulty.test.js` | ❌ Wave 0 — new file |
| RUN-03 | Breather floors (per `BREATHER_EVERY`) have zero darkness and baseline encounter-dot count | unit | `node --test test/unit/difficulty.test.js` | ❌ Wave 0 |
| RUN-03 | No generated floor's actual dark-tile coverage exceeds the fairness cap, across N seeds x M depths | property (fairness sweep) | `node --test test/unit/floor-fairness.test.js` (quick-run subset) | ❌ Wave 0 — new file |
| RUN-03 | Foe tier/count invariants (`startCombat`'s existing clamps) hold for arbitrarily large `floor.depth` (regression guard — proves the ALREADY-bounded side stays bounded) | property | `node --test test/unit/combat.test.js` (extend) | ❌ Wave 0 — extend existing file with a high-depth sweep |
| RUN-03 | Same-seed determinism is preserved for `genFloor` at depths beyond 5 (extends the existing depth 1-5 determinism proof) | determinism | `node --test test/determinism/maze-determinism.test.js` (extend) | ❌ Wave 0 — extend existing file's depth range |
| RUN-03 | Tuning harness runs N seeded auto-play sessions and reports death-depth/action-count distributions | manual-only tool (not a `node:test` assertion) | `node tools/tune-difficulty.mjs --seeds=500` | ❌ Wave 0 — new file, dev-only, not gating |
| RUN-04 | Permadeath remains the sole terminator — `state.won` no longer reachable via floor generation (property test: for any depth, no floor ever contains a `"gate"` tile) | unit | Same as the RUN-02 `maze.test.js` extension above | (covered above) |
| RUN-05 | `initRun(seed)`/`newRun(seed)` produces a fresh, valid GameState after a prior run's death (adapter-level round-trip) | unit / roundtrip | `node --test test/unit/engineAdapter.test.js` (extend) | ❌ Wave 0 — extend existing file |

### Sampling Rate

- **Per task commit:** `npm run test:quick` (unit + determinism + roundtrip; skips the heavy parity harness for fast iteration)
- **Per wave merge:** `npm test` (full suite, including parity — confirms no unintended regression to the unchanged floors-1-5/combat/economy/magic behaviors the parity harness guards)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus a manual run of `tools/tune-difficulty.mjs` whose output is eyeballed (not gated) as a sanity check ahead of the deferred human playtest

### Wave 0 Gaps

- [ ] `engine/difficulty.js` — the module itself does not exist yet; must be created before any test importing it can run
- [ ] `test/unit/difficulty.test.js` — covers RUN-03 (curve caps, breather cadence)
- [ ] `test/unit/floor-fairness.test.js` — covers RUN-03 (darkness/encounter-density fairness sweep across seeds × depths)
- [ ] `tools/tune-difficulty.mjs` — dev-only harness; not a `node:test` file, needs no test-framework wiring, but should be created early (Wave 0) since later waves' manual tuning depends on it existing
- [ ] Extensions (not new files) to `test/unit/maze.test.js`, `test/unit/movement.test.js`, `test/unit/combat.test.js`, `test/unit/engineAdapter.test.js`, `test/determinism/maze-determinism.test.js` — no new test infrastructure needed, just new `test(...)` blocks in existing files
- [ ] Framework install: none — `node:test` is already wired via `package.json`'s existing `"test"`/`"test:quick"` scripts

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Fully offline, no accounts (project constraint) |
| V3 Session Management | no | No sessions/network in this phase's scope |
| V4 Access Control | no | Single-player, single-device, no access boundaries |
| V5 Input Validation | yes (pre-existing, unmodified) | `engine/actions.js`'s `validateAction()` already fail-closed-validates every action reaching `applyAction`; this phase adds no new action type that needs new validation (the "newGame" action type already exists in `ACTION_TYPES`, already validated as a bare type-check — see Code Examples for the dispatch-wiring decision). If the planner chooses option (B) (`newGame` takes a `seed` field), that seed field should get the same `isInt`-style guard the other action types already use (e.g. `buyItem.idx`) so a malformed/adversarial seed value can't reach `newRun` unchecked. |
| V6 Cryptography | no | The seeded PRNG (`engine/rng.js`, mulberry32) is explicitly documented as non-cryptographic and gameplay-only; this phase does not introduce any new randomness source or change that posture |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed/adversarial `action` object reaching `applyAction` (e.g., a future multiplayer peer, or a corrupted localStorage-derived UI state) | Tampering | Already mitigated by `validateAction()`'s fail-closed contract (`{ok:false}` → untouched state, no events, never throws) — this phase's `difficultyCurve(depth)` function should mirror the same "never throw" posture: `depth` is always internally supplied by `genFloor`/`descend`, never user input directly, but should still tolerate `depth <= 0` or non-integer `depth` gracefully (e.g., `Math.max(1, depth)` guard) rather than producing `NaN`-poisoned floor data that could later corrupt a serialized save |
| A tampered/edited localStorage save re-injecting a stale `"gate"` feature tile to attempt to force `state.won` (trivial single-player self-tampering, not a real attacker threat — see PITFALLS.md P12) | Tampering | Not a security concern for this offline single-player game (no leaderboard/multiplayer to protect yet, per PITFALLS.md P12's own explicit "do not over-invest for v1" guidance) — noted here only because it's the same code path as the legitimate legacy-save compatibility case (Runtime State Inventory above), not because it needs a dedicated mitigation in this phase |

## Sources

### Primary (HIGH confidence)
- Direct inspection of `engine/maze.js`, `engine/movement.js`, `engine/combat.js`, `engine/encounters.js`, `engine/state.js`, `engine/death.js`, `engine/derived.js`, `engine/character.js`, `engine/actions.js`, `engine/engine.js`, `engine/items.js`, `engine/rng.js`, `content/bestiary.js`, `content/misc-tables.js` — confirmed the exact current depth-scaling formulas, the existing foe-tier/count clamps, THRESHOLDS/level-cap values, and the test-suite structure/conventions.
- `.planning/phases/03-endless-descent-difficulty-balance/03-CONTEXT.md` — locked decisions and Claude's-discretion boundaries for this phase.
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` — RUN-01..05 exact wording, scope constraints (permadeath, no meta-progression, 5-10 min).
- `.claude/CLAUDE.md` — ZERO runtime deps / Node built-in test tooling constraint.
- `test/README.md`, `test/unit/maze.test.js`, `test/determinism/maze-determinism.test.js` — existing test conventions this research's proposed tests must match.

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` Pitfall 10 ("Endless-mode difficulty scaling breaks because enemy/player growth curves were never designed against each other") — project's own prior research, independently converging with the web search findings below on the exact same linear-vs-exponential divergence failure mode.
- [Optimal scaling for endless :: Combolands discussion](https://steamcommunity.com/app/4075620/discussions/0/582806854239885649/) and [Roguelikes That Balance Their Difficulty Perfectly](https://gamerant.com/roguelikes-with-perfect-difficulty-balance/) — corroborate the "player linear growth vs. enemy exponential/percentage growth = brick wall" pattern.
- [Slay the Spire Endless Mode Guide](https://gamerblurb.com/articles/slay-the-spire-endless-mode-guide-how-it-works) and related Steam Community discussion threads — corroborate that "buff enemies every loop but not enough" and "difficulty front-loaded then trivializes" are both real, observed failure shapes in shipped endless modes, motivating the soft-cap-with-breather approach over either extreme.
- [Darkest Dungeon Provisions Guide](https://vip.jeffgordon.com/insight/314/7TW/NNy4Rp/DarkestDungeonProvisionsGuide) and [A Mechanical Critique of Darkest Dungeon](https://thegemsbok.com/art-reviews-and-articles/darkest-dungeon-red-hook-critique-mechanics-design/) — corroborate darkness/light-pressure and resource-attrition as an established, effective difficulty lever distinct from raw combat-stat inflation, directly supporting this research's recommendation to lean on this engine's existing darkness/encounter-frequency knobs rather than touching `combat.js`'s stat formulas.

### Tertiary (LOW confidence)
- None used as load-bearing claims; all web-search findings above were cross-checked across at least two independent search queries converging on the same pattern before being cited.

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps, module shape): HIGH — direct code read, matches existing `engine/` module conventions exactly
- Architecture (curve formula, attrition-lever table, what's already bounded vs. what needs bounding): HIGH for the "what's already bounded in this codebase" claims (direct code read of `combat.js`'s clamps); MEDIUM for the specific soft-cap formula/constants (design reasoning + cross-checked genre precedent, not Mazeworld-specific playtest data)
- Pitfalls: HIGH for the two concrete unbounded-formula pitfalls (directly derived from reading the current `genFloor` code); MEDIUM for the genre-level "endless mode" pitfalls (matches this project's own PITFALLS.md, itself flagged MEDIUM confidence there)

**Research date:** 2026-09-08
**Valid until:** No external time-sensitive dependency (no library versions, no store-policy dates); this research remains valid until the engine's `genFloor`/`combat.js` are substantially refactored again, or until real playtest data supersedes the starting-point constants (expected, per CONTEXT.md's own deferred-items list).
