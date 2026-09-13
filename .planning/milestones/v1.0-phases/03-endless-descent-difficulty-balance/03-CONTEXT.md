# Phase 3: Endless Descent & Difficulty Balance - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** mvp — Auto-generated (autonomous run). Design decisions below are deliberate STARTING-POINT defaults; the "feels right / 5–10 min" tuning is a playtest UAT item deferred to milestone end. Everything is parameterized so the user can tune without re-architecting.

<domain>
## Phase Boundary

Replace the prototype's fixed 5-floor Gate ending with **endless descent** in the extracted engine (Phase 1). A 100%-dice-rolled character descends procedurally-generated floors of scaling difficulty until permadeath; runs target ~5–10 minutes; the player chases depth/high-score. All work happens behind the `applyAction` engine + its content data and is proven with `node:test` (determinism + property tests + the parity harness for unchanged behaviors).

IN SCOPE:
- Remove the floor cap / Gate `winGame` path as the run terminator; descent continues indefinitely (`descend` past floor 5).
- A tunable `difficultyCurve(depth)` consumed by floor/monster/loot/hazard generation, with soft-cap/asymptotic scaling and periodic "breather" floors.
- Depth-based run scoring / best-depth tracking in engine state (local; no server).
- Permadeath as the sole run terminator; a one-tap "new run" path from the death state (engine `newRun`; wire the browser prototype's existing death card + New Delve button through the engine adapter).
- Automated tests for the curve's mechanical properties + tuning knobs/harness for the user's playtest.

OUT OF SCOPE (other phases):
- Durable NATIVE persistence of best-depth/graveyard (Capacitor Preferences) — Phase 2. This phase uses the existing engine save layer / browser localStorage in the dev loop; best-depth lives in serializable engine state so Phase 2 can persist it natively.
- Mobile UI/controls, the polished death screen, onboarding — Phase 4. This phase only wires the prototype's EXISTING death/new-run affordances through the engine so the loop is playable/testable.
- Power meta-progression, daily seeds, unlockables — explicitly OUT (v2 / anti-features per PROJECT.md).
</domain>

<decisions>
## Implementation Decisions (starting-point defaults — tunable)

### Difficulty curve (the core design)
- **The central tension:** player power caps at level V (engine `THRESHOLDS` cap), but depth is now unbounded. So past ~floor 5 the player plateaus while floors deepen. The curve must keep floors *challenging but fair* without an unwinnable wall.
- **Scaling model:** favor **soft-cap / asymptotic** scaling over linear/multiplicative. Enemy *tier/level* and *count* rise with depth but approach caps (e.g. creature level tier tops out at the bestiary's level-V roster, which already exists; beyond that, increase encounter frequency, multi-foe counts, hazard density, and upkeep/attrition rather than raw per-enemy stats — attrition, not stat inflation, drives endgame difficulty). This matches the prototype's existing depth-scaling knobs (`genFloor` already scales encounter dots = `9 + depth`, darkness blobs = `depth − 1`, etc.).
- **Breather cadence:** every ~5 floors, a lighter "breather" floor (reduced hazard/darkness, a likelier store/rest) to restore the pacing the bounded 5-floor design had. Parameterized (`BREATHER_EVERY`).
- **Anti-unwinnable guard:** cap per-floor hostile density and darkness so no single floor is statistically a death sentence at max player power; include a test asserting generated floors stay within sane bounds across a large seed sample.

### Run terminator & scoring
- **Permadeath is the ONLY terminator** — remove/neutralize `winGame` as an ending (the Gate no longer spawns; if any legacy Gate handling remains, route it to "continue deeper"). Keep the death/graveyard system (engine `die`/`bury`) intact.
- **Score = deepest floor reached** (primary, per user's "depth chase"), with kills/treasure as secondary tiebreakers recorded in state. Best-depth persists in serializable engine state (Phase 2 makes it durable natively).
- **One-tap new run:** from the death state, a single action calls `newRun(newSeed)`. Wire the prototype's existing death card "New Delve" button through the engine adapter so the loop is closable in the browser dev harness.

### Session length
- Target ~5–10 min typical. Expose curve constants (`DIFFICULTY`, `BREATHER_EVERY`, density caps) as named, documented knobs so the user can playtest and retune without code surgery. Provide a small dev harness that simulates and reports run-length/death-depth distributions across many seeded runs to guide tuning (approximate proxy for playtest, NOT a substitute for it).

### Determinism / fidelity
- Endless generation must remain seeded & deterministic (same seed + actions → identical run), preserving Phase 1's guarantees. All existing parity/round-trip tests must stay green for unchanged behaviors; the only intentional behavior change is "descent no longer ends at floor 5."

### Claude's Discretion
- Exact curve formulas/constants (planner + researcher pick sensible defaults), the shape of the tuning harness, and how the score is surfaced in the browser dev prototype.
</decisions>

<code_context>
## Existing Code Insights (from Phase 1)
- `engine/maze.js` — `genFloor(depth, rng)` already scales features with depth; extend it to consume `difficultyCurve(depth)` and drop the hard floor-5 assumptions.
- `engine/movement.js` — `descend` currently routes floor-5 → `winGame`; change to endless. `winGame` event/handling to be removed or neutralized.
- `engine/encounters.js`, `engine/combat.js`, `content/*` — creature rosters/bestiary (level I–V; level-V roster reused for higher tiers per the prototype's own fallback) drive enemy scaling.
- `engine/state.js` / `engine/saveState.js` — add best-depth/score fields to serializable GameState (Phase 2 persists natively).
- `engine/death.js` — permadeath/graveyard already implemented; reuse.
- `src/browser/engineAdapter.js` + `mazeworld.html` — the death card + "New Delve" button exist in the prototype; wire them through the adapter for the one-tap new-run loop.
- Full-suite parity/determinism harness under `test/` — reuse for regression safety; add property tests for the curve.

## Reference
- `.planning/research/SUMMARY.md` and `PITFALLS.md` — flagged endless-mode balance as a dedicated design/playtest workstream; the classic failure is enemy stats scaling multiplicatively while player power scales additively (exactly the tension above). A focused phase researcher will produce `03-RESEARCH.md` on endless-roguelike difficulty-curve patterns for this capped-level engine.
</code_context>

<specifics>
## Specific Ideas
- Keep the prototype's existing depth knobs where sensible (encounter dots `9+depth`, darkness `depth−1`) but bound them so deep floors don't become pure darkness/ambush walls.
- Because player level caps at V, lean on **attrition** (rations/upkeep, hazard density, encounter frequency, armor wear) rather than enemy stat inflation for endgame difficulty — this is fairer and more roguelike.
</specifics>

<deferred>
## Deferred Ideas
- The actual "feels right / 5–10 min" difficulty validation — playtest UAT, deferred to milestone end (criterion 3 needs human play to floor 30–50+).
- Durable native persistence of best-depth/graveyard — Phase 2.
- Polished mobile death screen / score display / share card — Phase 4 / v2.
- Daily seeds, leaderboards, unlockables — v2 (anti-features for v1).
</deferred>
