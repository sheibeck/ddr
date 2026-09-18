# Phase 41: Terrain, Darkness & Phobias - Research

**Researched:** 2026-09-18
**Domain:** Engine floor generation (water terrain), movement/timer cost model, render-time fog-of-war filter, phobia trigger design
**Confidence:** MEDIUM-HIGH (code-verified throughout; the phobia/Afraid design is genuinely open and flagged as such)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERR-01 | Floors can contain water regions — multi-square pools, generated so every existing fixture/bot/old save is unaffected | `genFloor` draw-order map below; derived-stream placement design; fixture-impact analysis (structural carve-out for the field itself, but real risk from the 2-move side-effect on any fixture whose action script steps onto water) |
| TERR-02 | Stepping onto water costs 2 moves; HUD square counter and every squares-based timer reflect the cost consistently (ratified as a Key Decision) | Exact tick site identified in `engine/movement.js#move` (`state.steps++` / `tickSquares(c,1)`); proposed semantics + Open Decision #1 |
| TERR-03 | Standing on a dark square without Night Vision/light shows only the 3×3 around the party; explored squares outside it fog and return on leaving — a render filter, `seen` unchanged | `draw()`'s exact read site identified; `inDark`/`revealRadius`/light-effect reads identified; pure `visibleCells`/`mapViewRadius` design proposed |
| TERR-04 | Every phobia has a real trigger (water/darkness/heights/trapped/death + the type-matched combat six) | Full `PHOBIAS` table read; existing `fight()` trigger mechanism read; existing standalone terrain penalties (`heightsPenalty`/`waterPenalty`/`trappedPanic`) read; gap analysis (Water/Heights/Trapped have no debounced "fresh entry" narration today) |
| TERR-05 | Terrain phobias fire once on fresh entry (not every step) and apply the Phase 31 Afraid penalty — never a lost action — trigger named in the rail line | Afraid's exact combat-scoped mechanism read (`afraidNeed`/`afraidDamage`/`state.combat.afraid`); the central design gap (Afraid has no out-of-combat manifestation today) is Open Decision #3 |

</phase_requirements>

## Summary

Phase 41 asks for three genuinely different pieces of engineering wearing one "terrain & phobias" label: (1) a new floor-generation feature (water pools) that must not perturb the frozen prototype's RNG stream or any existing fixture's byte-identical grid, (2) a movement-cost multiplier that ripples into every squares-based system already wired in this codebase (`state.steps`, `c.timers`, the day cycle, spell-charge recovery, cloak ticks), and (3) a render-time fog filter that is deliberately orthogonal to the engine's permanent `seen` memory. Layered on top is a phobia system whose "real trigger" requirement runs straight into a structural fact this research surfaces as the single most important finding: **the Phase 31 Afraid penalty (`afraidNeed`/`afraidDamage`) only exists inside `state.combat`** — it is read nowhere in movement, and the three terrain phobias TERR-04 names as needing a "real trigger" (Bodies of water, Heights, Being trapped) fire during *movement*, not combat. Two of them (Heights, Bodies of water) already have a *different*, older penalty mechanism (a deterministic bonus added to the climb/leap roll, from the 2026-09-09 PHOBIA-01 rules audit) that predates Afraid entirely; Being-trapped has a third, still-different mechanism (a flat HP loss). None of the three currently narrate as a *rail-visible, once-per-entry, named* event the way TERR-05 wants. Reconciling "apply the Phase 31 Afraid penalty" with three already-shipped, already-tested, non-Afraid mechanisms is a real design decision, not a mechanical extension — it is Open Decision #3 below and the highest-value thing for the user to rule on before planning starts.

The `genFloor`/water-generation piece is lower-risk than the roadmap's own research flag suggests, provided the planner follows the pattern Phase 40 already proved out for `spellSeen`: a **structurally new, orthogonal per-cell field**, placed by a **derived RNG stream** (`derivedRng(rng.getState(), "terrain", depth)`) captured *after* every existing draw in `genFloor`, so the main seeded cursor never moves and every wall/feat/dark-blob/one-way-door byte stays exactly where the frozen prototype put it. Under that design the water *field itself* needs no declared fixture divergence at all — it is structurally absent from the prototype comparison, exactly like `spellSeen`. The real risk the orchestrator flagged is different and narrower: if a water cell happens to fall on a tile one of the fixtures' **scripted action sequences actually steps onto**, the water's *movement-cost side effect* (2 steps instead of 1, extra timer ticks) is a genuine, real, comparable-visible divergence in `state.steps`/`c.wp`/`c.timers` — not a structural no-op. That risk is scoped precisely below and the exact measurement recipe (a live scratch script, matching this project's own "measured, not hand-computed" convention) is specified so the planner can run it before committing to a placement algorithm.

**Primary recommendation:** place water via a post-generation derived-stream flood-fill restricted to cells with `!wall && !feat` (never touching spawn, exit, or any existing feature tile — mirroring the `far`-list exclusion pattern `genFloor` already uses for dots/traps/chests); implement TERR-02 as a single-dispatch double-tick (`state.steps += 2; tickSquares(c, 2)` on a water step, still one player tap); implement TERR-03 as a new pure `mapViewRadius(state)` function `draw()` consults on top of `cell.seen`, never touching `reveal()`/`seen` itself; and bring the three genuinely-new terrain phobia triggers (water/heights/trapped) to the user as a single ratified Key Decision before planning proceeds, because three defensible designs exist and this codebase's own Engine Gate requires deliberate divergences to be *decided*, not defaulted.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Water pool generation (placement, shape) | Engine (`engine/maze.js#genFloor`) | — | Pure, seeded, must preserve the frozen prototype's draw order; no UI concern |
| Water movement cost (2 moves) | Engine (`engine/movement.js#move`) | — | `state.steps`/`c.timers` are engine-owned serialized state; the shell only ever displays what the engine already computed |
| Water map tint | Shell (`src/browser/mapMarks.js` + `mazeworld.html#draw()`) | — | Pure presentation, mirrors the existing `floorDark`/`floorSpell` palette pattern exactly |
| Darkness 3×3 render filter | Engine (pure derived fn, `engine/derived.js`) | Shell (`draw()` consumes it) | The *rule* ("what's visible right now") is game logic and must be testable/deterministic like every other derived read; the *paint* is presentation — same split as `revealRadius`/`conditionsOf` today |
| Phobia acquisition (which phobia, when) | Engine (`engine/encounters.js#catchAffliction`/`newPhobia`) | — | Unchanged this phase — already fully engine-owned, zero new work needed |
| Phobia *trigger* (water/heights/trapped fresh-entry) | Engine (`engine/movement.js`) | — | Movement is where these events physically happen; the penalty's *application* may reach into `engine/combat.js#fight` depending on Open Decision #3 |
| Afraid penalty application | Engine (`engine/derived.js#afraidNeed`/`afraidDamage`, `engine/combat.js`) | — | Existing, combat-scoped; Open Decision #3 is whether/how it extends |
| Rail narration for a fresh trigger | Shell (`src/browser/rail.js`, `eventNarration.js`, `toasts.js`) | — | Standing v1.4/v1.5 ruling: rail is the one feedback surface; no engine narration decisions |

## Standard Stack

Not applicable in the conventional sense — this phase adds **zero external packages, zero new dependencies, zero new npm modules**. Every piece of work is pure engine logic (`engine/*.js`), pure content data (`content/*.js` if a water palette/legend entry needs a home — none is currently needed, water is engine-only state), and shell presentation (`src/browser/*.js`, `mazeworld.html`). No `npm install` step exists for this phase.

### Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `package-legitimacy check` was not run because there is no `npm view`/`pip index`/`cargo search` target — the phase's entire surface is first-party engine/content/shell code plus tests.

## Architecture Patterns

### System Architecture Diagram

```
Movement dispatch (shell mzMove → applyAction "move")
        │
        ▼
engine/movement.js#move(state, dir, rng, events)
        │
        ├─► climb/gorge tile? ──► existing hazard/tool/fly/ether branches (unchanged)
        │
        ├─► genuine step: f.px/py updated
        │        │
        │        ├─► NEW: is destination cell.water? ──► stepCost = 2, else 1
        │        │
        │        ├─► state.steps += stepCost   (HUD "SQUARES" reads this)
        │        ├─► reveal(f, revealRadius(state))   [permanent seen memory — UNCHANGED]
        │        ├─► phobia/affliction/darkFor per-step ticks (existing, unchanged)
        │        ├─► if (c.timers) tickSquares(c, stepCost)   [Phase 36 timer model — NOW fed stepCost]
        │        ├─► NEW: fresh-entry phobia checks (water/dead-end/climb — debounced)
        │        └─► steps % 20 / % 100 cadences (spell charges, newDay) — now can double-fire on one water step
        │
        └─► events pushed (moved, waterEntered?, phobia trigger?, …)

Render pipeline (shell only — engine untouched):
mazeworld.html#draw()
        │
        ├─► for each (x,y): if (!cell.seen) continue;      [existing — permanent memory gate]
        ├─► NEW: if (mapViewRadius(state) finite && outside window) continue;   [TERR-03 — temporary render gate]
        ├─► fillStyle = cell.water ? P.floorWater : (cell.spellSeen ? P.floorSpell : (cell.dark ? P.floorDark : P.floor))
        └─► existing feature-icon / party-marker passes (unchanged)

genFloor(depth, rng)  — EVERY existing draw first, in the frozen order —
        │
        ├─► recursive backtracker, loop-carving, exit/feature scatter, dark blobs, one-way doors
        │        (all consume the MAIN seeded rng exactly as today — byte-identical)
        │
        └─► NEW, LAST, before return: placeWater(g, depth, derivedRng(rng.getState(), "terrain", depth))
                 — a SEPARATE rng instance; zero draws off the caller's `rng`
                 — writes ONLY cell.water on cells that are !wall && !feat && not spawn
```

### Recommended Project Structure

No new files are structurally required — this phase is additive to existing modules:

```
engine/
├── maze.js          # genFloor gains the water-placement pass; a new placeWater() export
├── movement.js       # move()'s step-cost + fresh-entry phobia checks
├── derived.js         # NEW: mapViewRadius(state) (or visibleCells); phobia-trigger reads if Open Decision #3 needs them
├── combat.js          # fight()'s trigger OR-condition, IF Open Decision #3 extends it
└── effects.js         # unchanged — tickSquares(c, n) already accepts an n>1 (Phase 36 designed for exactly this — see movement.js's own comment: "Phase 41 (TERR-02) passes a water square's 2 here")

content/
└── (no new file needed — water has no flavor text/table; it's a pure engine terrain property)

src/browser/
├── mapMarks.js        # MAP_PALETTE.floorWater; MARK_GLYPHS/legend row if a glyph is wanted
├── rail.js             # RAIL_FAMILY entries for the new fresh-entry trigger events
├── eventNarration.js   # EVENT_NARRATION entries (Oracle)
└── toasts.js            # TOAST_FOR/coverage-guard entries

test/
├── unit/terrain.test.js         # NEW — water placement, step-cost, fresh-entry debounce
├── unit/darkness-filter.test.js # NEW — mapViewRadius pure-function tests
├── unit/phobia-triggers.test.js # NEW — whichever Open Decision #3 design lands
└── parity/…                       # existing files gain a "Phase 41" section per FIXTURE-INVENTORY.md convention
```

### Pattern 1: Derived-stream, post-generation content placement (the Map-the-Floor / storeRoll-successor pattern)

**What:** A new piece of floor state that must not perturb the seeded main-rng cursor is computed in a dedicated pass, using its own `derivedRng(...)` instance seeded from the *result* of the main draws (`rng.getState()`), never the caller's own `rng`.

**When to use:** Any time a deliberate new-rules-for-everyone feature (the 2026-09-17 greenfield ruling: "new rules are the only rules — no dual paths, no shell-only run-option gating") needs its own randomness without moving any existing fixture's draw sequence.

**Example (design, not yet landed — this is the pattern to follow):**
```javascript
// Source: engine/maze.js#genFloor, modeled directly on the existing dark-blob
// BFS pass already in this function, but using a SEPARATE rng instance per
// the Phase 38/39/40 derivedRng convention (engine/rng.js).
import { derivedRng } from "./rng.js";

// ... inside genFloor, AFTER the one-way-door pass, BEFORE `return`:
const waterRng = derivedRng(rng.getState(), "terrain", depth);
placeWater(g, depth, waterRng); // mutates cell.water only; zero draws on `rng`
```

This is the EXACT mechanism Phase 40 used for the Summoner's Lesser Summon splice and Phase 38 used for the ability-level-pool rolls — both explicitly chosen *because* lengthening the main-rng draw sequence "would reorder the ENTIRE subsequent chargen draw sequence... for those subs' seeds" (`docs/SPELLS.md`, "Day-one grimoire" section). Water generation is the roadmap's own named example of where this technique belongs (STATE.md's Engine Gate AMENDMENT: "Prefer a derived rng stream... for new rolls that would otherwise reorder floor generation").

### Pattern 2: Structural parity carve-out for a brand-new, orthogonal field (the `spellSeen` precedent)

**What:** When a new field has literally no prototype-side equivalent (the frozen prototype's cell shape never had it and never will), it is stripped from every comparable the SAME way regardless of fixture content — not "declared and regenerated" like a genuine behavior divergence, because there is no value to disagree about, only a key's presence.

**When to use:** Any new per-cell/per-character field this phase introduces (`cell.water`) that carries no risk of colliding with an existing prototype field name.

**Example:**
```javascript
// Source: test/parity/harness/comparables.js#stripSpellSeen (existing, Phase 40) —
// stripWaterField would be the direct sibling, added to the SAME comparable
// chain (movementComparable/combatComparable/economyComparable) at the SAME
// call site as stripSpellSeen:
export function stripWaterField(floor) {
  if (!floor || !Array.isArray(floor.g)) return floor;
  let any = false;
  for (const row of floor.g) for (const cell of row) if (cell && "water" in cell) { any = true; break; }
  if (!any) return floor;
  const g = floor.g.map((row) => row.map((cell) =>
    !cell || !("water" in cell) ? cell : (({ water, ...rest }) => rest)(cell)
  ));
  return { ...floor, g };
}
```
Wire it at the exact same three call sites `stripSpellSeen` already occupies (`movementComparable`, `combatComparable`, `economyComparable` in `test/parity/harness/comparables.js`) plus the three per-domain local `comparable()` duplicates (Phase 21's "keep the local duplicates in sync" lesson, restated in every phase since).

### Pattern 3: Pure render-time filter over permanent memory (do NOT touch `seen`)

**What:** A pure function of `state` that returns "what subset of already-`seen` cells should actually be painted right now," consumed only by the shell's `draw()` — the engine's permanent fog-of-war memory (`cell.seen`, written only by `reveal()`) is never mutated by this filter.

**When to use:** TERR-03 exactly. This mirrors the exact orthogonality Phase 40 already documented for `spellSeen` vs. the (not-yet-built) Phase 41 filter: "Phase 41's darkness rework is explicitly a RENDER-TIME filter over `seen`... This plan changes what `seen` actually CONTAINS (temporarily, for a spell-lit cell); Phase 41 changes what's RENDERED from whatever `seen` already contains. The two are orthogonal" (`docs/SPELLS.md`, "Phase 41 note").

**Example (design):**
```javascript
// Source: engine/derived.js — a new pure function, modeled on the existing
// inDark/revealRadius pair immediately above it.
/**
 * mapViewRadius(state) — TERR-03: the render-time window radius while
 * standing on a dark square with no waiver. Returns Infinity ("show every
 * seen cell, as today") or a small integer radius (3x3 == radius 1) while
 * genuinely in the dark. Reads only inDark/skill/eff/itemEffectActive — the
 * SAME waiver set revealRadius() already reads — so "a light effect" means
 * exactly what it means everywhere else in this file (Night Vision skill,
 * eff("light") > 0 — the Amulet of Light — or a live torch "lit" c.timers
 * effect). Pure; no mutation of state.floor; no rng.
 */
export function mapViewRadius(state) {
  const c = state.c;
  if (!inDark(state)) return Infinity;
  if (skill(c, "Night Vision")) return Infinity;
  if (eff(c, "light") > 0) return Infinity;
  if (itemEffectActive(c, "lit")) return Infinity;
  return 1; // 3x3 window
}
```
Then `draw()` (`mazeworld.html`, the `for (let y=0;y<GH;y++) for (let x=0;x<GW;x++) { const c=g[y][x]; if (!c.seen) continue; ... }` loop, currently at line ~2675) gains exactly one more early-continue:
```javascript
const vr = window.__mzMapViewRadius ? window.__mzMapViewRadius(S) : Infinity;
// ...
if (!c.seen) continue;
if (Number.isFinite(vr) && (Math.abs(x - px) > vr || Math.abs(y - py) > vr)) continue;
```
No change anywhere to `reveal()`, `revealRadius()`, or `cell.seen` — leaving the floor and returning restores the full previously-`seen` view for free, because the filter re-evaluates fresh on every `draw()` call exactly like the Phase 40 `spellSeen` tint already does ("`draw()` already re-reads `cell.seen`/`cell.spellSeen` fresh every paint").

### Anti-Patterns to Avoid

- **Gating water behind a shell-only `newRun` option (`state.terrainRoll`, mirroring `storeRoll`):** This is literally the roadmap's own original wording and is now **FORBIDDEN** by the 2026-09-17 greenfield ruling (`STATE.md`'s Engine Gate AMENDMENT, and the CONTEXT the orchestrator supplied above repeats this explicitly). `storeRoll`/`wornSlots` are the OLD pattern (`engine/state.js` lines 148-252) — cite them as the anti-pattern, not the template, for this phase.
- **Placing water inline, interleaved with the existing draw sequence:** Would move `rng.pick`/`rng.shuffle`/`rng.d` consumption for every subsequent call in `genFloor` (the dark-blob pass, the one-way-door pass) and, transitively, everything `newRun` draws after `genFloor` (nothing today, but any future addition would inherit the fragility). Quantified: EVERY seed's floor would differ from the frozen prototype's floor from the water-insertion point onward — this is not a small, declarable divergence, it is a full fixture-roster regeneration, explicitly rejected by the "declare exactly what moves, never a blanket regeneration" ruling.
- **Mutating `cell.seen` to implement the 3×3 filter:** Would corrupt the permanent exploration memory `reveal()` maintains — leaving the dark tile would not restore the previously-explored view (a direct violation of TERR-03's own wording: "explored squares outside it are fogged and return when the player leaves the dark").
- **A per-step poll of a squares-cadence timer to detect "did the window just end":** Research Pitfall 4, already documented and avoided by Phase 40's `refogSpellSeen` (reacts to the ONE transition `tickSquares` returns, never polls the record). If TERR-02/03 introduce any new squares-cadence effect (they do not appear to need one), reuse this exact reaction-to-transition pattern, not a poll.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this event's rng draw safe from perturbing the seeded cursor?" | A bespoke second `makeRng(someAdHocSeed)` | `derivedRng(rng.getState(), "terrain", depth)` (`engine/rng.js`, already exported, already used by Phases 38/39/40) | The exact hashing/derivation this project already standardized on; a bespoke seed risks accidental seed collisions across features (two different derived streams keyed the same way would draw identically) |
| "How do I know a timer transition just happened?" | A per-step `if (c.timers["x"].left <= 0)` poll | `tickSquares(c, n)`'s own return value (`{ id, from, to }` transition list), exactly as `refogSpellSeen`'s call site already consumes it | `engine/effects.js` was built in Phase 36 SPECIFICALLY so every future timer-driven phase (38/39/40/41) shares one tick/clear discipline instead of inventing bespoke logic; polling was explicitly flagged as "research Pitfall 4" |
| "How do I strip a new field from parity comparison?" | A bespoke per-comparable inline destructure | The `stripXField(obj)` helper pattern in `test/parity/harness/comparables.js`, wired at the SAME three call sites every prior phase's carve-out uses | Six phases in a row (Phase 19 FOE-01/D-14 through Phase 40 SPELL-05) have used this exact helper shape; deviating risks missing one of the three comparables or the three per-domain local duplicates |
| "How do I debounce a fresh-entry trigger?" | A new per-character boolean flag on `c` | A per-TILE marker, exactly like `there.trapPanicked` (`engine/movement.js`, Being-trapped's existing debounce) — OR, for a multi-cell water pool, a per-POOL id set on `c` (see Open Decision #2) | `trapPanicked` already proves the "mark the tile, not the character" pattern avoids any new save-shape/parity carve-out for the common single-tile case; only a multi-cell REGION (water pools) genuinely needs a new character-side marker, because "fresh entry into the region" is not the same question as "fresh entry into this one tile" |

**Key insight:** Every "don't hand-roll" item above is not a third-party library problem — this codebase has no such libraries in play. The real hand-rolling risk in this phase is re-deriving mechanisms this project has *already built and proven* three times over (derived-stream placement, timer-transition reaction, comparable carve-out, tile-marker debounce) instead of reusing them. A planner unfamiliar with Phases 36–40's own precedents is the actual risk surface here, not an external dependency.

## Common Pitfalls

### Pitfall 1: Treating "water field is structurally stripped" as "water is fixture-safe"

**What goes wrong:** The planner assumes that because `cell.water` has no prototype equivalent (structurally stripped like `spellSeen`), water generation is automatically zero-risk for the whole parity suite.

**Why it happens:** The *field itself* genuinely is zero-risk (Pattern 2 above is airtight for the grid comparison). But TERR-02's 2-move cost is a REAL behavioral change, and `action-script.movement.json` (seed 256) is a raw, ordered `move` script compared **per-action, byte-for-byte** against the frozen prototype (`test/parity/fixtures/action-script.schema.md`: "the exact same ordered action list... any divergence in resulting state... is a regression signal"). If any step in that ~256-seed script's path lands on a cell the water-placement algorithm marks `water: true`, `state.steps` (NOT stripped — it is a real, compared top-level field) diverges from that action onward, and every subsequent per-action diff fails.

**How to avoid:** Before finalizing the water-placement algorithm, run the measurement recipe below. Bias placement rules toward keeping the shortest spawn→exit path (and any fixture's actual scripted path) dry, but do not assume this alone is sufficient — MEASURE it live.

**Warning signs:** `npm test` failing in `test/parity/movement-parity.test.js` (or the combined `full-suite.test.js`) with a `state.steps`/`c.wp`/`c.timers` diff starting partway through a fixture's action list, not at the end.

**The measurement recipe (do this, don't hand-compute it):**
```javascript
// scratchpad script, one per fixture with a `move` action list
// (action-script.movement.json seed 256 is the highest-risk one; the combat/
// magic/economy/encounters fixtures' scripts should also be checked — some
// begin with a short walk to their trigger tile before the named `startCombat`
// or encounter event fires, per the roster table in FIXTURE-INVENTORY.md).
import { genFloor } from "../engine/maze.js";
import { makeRng } from "../engine/rng.js";
// 1. genFloor(depth, rng) with the SAME seed the fixture uses
// 2. apply the candidate placeWater() pass
// 3. replay the fixture's `actions` array, tracking (px, py) after each move
// 4. for each move: does the DESTINATION cell have `.water === true`?
// 5. report every (fixture, seed, action index, x, y) hit
```
If a hit is found, either (a) adjust the placement algorithm's exclusion rules until the specific fixture's path is clear (acceptable — placement rules are Claude's discretion, per the phase's own framing), or (b) accept and declare the divergence via the SAME `action-path` divergence mechanism `action-script.schema.md` already documents (`kind: "action-path"`, `fromAction`, `fields`, `before`/`after` — used previously for Phase 24's Pickpocket economy fixture and Phase 20's parley scenario). Regenerating only the one affected fixture's declared divergence record is explicitly sanctioned by the greenfield ruling ("declare exactly what moves... regenerate only those").

### Pitfall 2: Double-penalizing a phobia across two different mechanisms

**What goes wrong:** Heights and Bodies-of-water already have a deterministic climb/leap-roll penalty from Phase 04.1-06 (`heightsPenalty`/`waterPenalty` in `engine/movement.js`, lines 44-61 — a `+2` added to the roll comparison, halved by Hardiness). If TERR-05's "apply the Phase 31 Afraid penalty" is implemented as a SECOND penalty firing on the exact same climb/leap event, a Heights-phobic character effectively pays for the same fear twice on one roll.

**Why it happens:** TERR-04's own wording ("Heights already has `heightsPenalty` at the climb roll — reconcile with the Afraid penalty so it isn't double-counted") explicitly names this risk, confirming it is a real trap the phase itself anticipates, not a hypothetical.

**How to avoid:** See Open Decision #3 — the recommended design (arm Afraid for the NEXT fight, leave the existing roll-penalty/wp-loss mechanisms untouched on the triggering event itself) structurally avoids double-counting because the two penalties land on two different rolls (the climb/leap roll vs. a future combat strike), never the same one.

**Warning signs:** A Heights-phobic Hardiness-less character's climb success rate measurably drops twice as much as a non-phobic character's in a bot smoke run, or a unit test asserting `afraidNeed`/`afraidDamage` fire from inside `move()`'s own climb branch (they should never be called from movement.js — they read `state.combat`, which is null there).

### Pitfall 3: Forgetting the "one-tick-already-spent" invariant when TERR-02 doubles a tick

**What goes wrong:** `engine/movement.js`'s per-step tick block already calls `tickSquares(c, 1)` unconditionally once per step. If the planner naively calls `tickSquares(c, 2)` for a water step, every LIVE squares-cadence effect (a duration+cooldown magic item, Map the Floor's `spell:reveal` window) advances by 2 on that single tap — which is exactly TERR-02's stated intent ("every squares-based counter or timer... reflect the cost consistently") but easy to under-test: a timer with `left === 1` before a water step must correctly fire its ONE transition event (not two), because `tickSquares` is designed to be called once per "unit of movement," and TERR-02 redefines what one unit of movement costs on a water tile — it does not mean "call tickSquares twice."

**Why it happens:** The existing 38-03 "ONE-TICK-ALREADY-SPENT INVARIANT" precedent (restated in `docs/SPELLS.md`'s Weaken section) is about a DIFFERENT subtlety (an ability/spell cast IS the round's own action) — it's easy to conflate "pass n=2 to tickSquares" with "call tickSquares(c,1) twice," which would double-fire narration events for a timer that only had 1 square left (both a `left:0→cooldown` AND a nonsensical second transition).

**How to avoid:** `tickSquares(c, n)` already accepts an `n` parameter (`engine/movement.js`'s own comment confirms this design intent: "the literal 1 is this step's cost — Phase 41 (TERR-02) passes a water square's 2 here so squares-cadence timers stay consistent with the step counter"). Call it ONCE per step, with `n = stepCost` (1 or 2), never twice.

**Warning signs:** A duplicated `itemCooled`/`revealFaded`/`staffRecharged` event in the fight log/Oracle for a single water step; `narrateTimerTransitions` receiving two transition arrays instead of one merged one.

### Pitfall 4: A per-step poll for the darkness render filter

Already covered under "Anti-Patterns to Avoid" (Pattern 3) — restated here because it is the single most explicitly-flagged pitfall in the additional_context and the most directly analogous to Phase 40's own documented Pitfall 4 (`refogSpellSeen`). `mapViewRadius(state)`/the shell's render loop must be a **pure, stateless, re-evaluated-every-paint** read — never a stored "am I currently filtered" flag that could go stale.

## Code Examples

### Water field on a cell (proposed shape)

```javascript
// Source: engine/maze.js — mirrors the existing cell shape:
// { wall: true, seen: false, feat: null } — water is a new, independent boolean.
g[y][x].water = true; // never touches .feat/.wall/.dark
```

### The existing squares-tick site TERR-02 must feed (verified, not hypothetical)

```javascript
// Source: engine/movement.js#move (current code, lines ~264-401)
f.px = nx;
f.py = ny;
state.pendingHazard = null;
state.steps++;                              // <-- TERR-02 target: += stepCost instead
reveal(f, revealRadius(state));              // unchanged — permanent memory
events.push(moved({ x: nx, y: ny }));
// ... phobia/affliction/darkFor ticks (unchanged) ...
if (c.timers) {
  const trans = tickSquares(c, 1);           // <-- TERR-02 target: tickSquares(c, stepCost)
  narrateTimerTransitions(state, trans, events);
  if (trans.some((t) => t.id === "spell:reveal" && t.from === "effect")) {
    const cells = refogSpellSeen(f);
    events.push({ type: "revealFaded", cells });
  }
}
// ... 20/100-square cadences read state.steps % N — these now advance
// correctly for free once state.steps itself carries the +2, no separate
// change needed at those sites.
if (state.steps % 100 === 0) newDay(state, false, rng, events, now);
```

### The existing fight()-time phobia trigger (verified — the pattern any Open Decision #3 extension must slot into)

```javascript
// Source: engine/combat.js#fight (current code, lines ~421-428)
const nearDeathPanic = c.phobia === "Death" && c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD;
if (
  (c.phobiaType === type || (c.phobia === "Darkness" && inDark(state)) || nearDeathPanic) &&
  !(skill(c, "Hardiness") && rng.d(2) === 1)
) {
  state.combat.afraid = AFRAID_ROUNDS;
  events.push({ type: "phobiaAfraid", rounds: AFRAID_ROUNDS });
}
```
Note the existing pattern is already a mix of a LIVE state re-check (`c.phobia === "Darkness" && inDark(state)`, re-evaluated fresh at every `fight()` call, needing no stored flag) and would need a THIRD kind of condition for Heights/Water/Trapped, which are transient MOVEMENT EVENTS, not standing states, by the time combat might start. See Open Decision #3.

## Open Decisions for the User

Three crisp grey areas, each with a concrete recommendation, surfaced from code that genuinely supports more than one defensible design. These should become one batched `/gsd-discuss-phase` question before planning locks.

### Decision 1 — What does "costs 2 moves" mean, mechanically?

- **Option A (recommended):** A single player action (one tap/dispatch) that steps onto water advances `state.steps` by 2 and calls `tickSquares(c, 2)` instead of the normal `+= 1` / `tickSquares(c, 1)`. One `moved` event, one tap, but every squares-based system (HUD counter, item/spell timers, the 20/100-square cadences) sees the full 2-square cost for free, because they all already read `state.steps`/the shared timer tick. This is the design `engine/movement.js`'s own existing code comment already anticipates verbatim ("Phase 41 (TERR-02) passes a water square's 2 here").
- **Option B:** Require two separate move dispatches to fully cross one water tile (the first tap "wastes" a turn without moving). Rejected as the primary recommendation: no existing mechanism partially executes a move and holds position, this would need an entirely new pending-state shape (`state.pendingWaterCrossing`), and it contradicts "the HUD square counter... reflect the cost" (which reads naturally as "one step here counts as two on the counter," not "you need two taps to advance one tile").
- **Option C:** Track "moves" as a concept separate from "squares" (i.e., stepping onto water costs 2 of some NEW currency the HUD adds alongside SQUARES). Rejected: adds a second player-facing counter the mock/HUD doesn't call for, and the requirement's own wording ("the HUD square counter... reflect the cost") implies squares themselves are the currency, not a new one.

**Recommendation: Option A.**

### Decision 2 — Water pool density, size, and placement safety

- **Option A (recommended):** Mirror the existing `darkBlobs`/`darkRadius` depth-curve pattern in `engine/difficulty.js` — a small, depth-scaled pool COUNT (e.g. 1 at shallow depths, easing toward a low cap like 3-4, never unbounded) and a bounded per-pool SIZE (a flood-fill from a derived-stream-picked seed cell, growing to a randomly-drawn target of ~3-8 cells), restricted to cells that are `!wall && !feat` and never the spawn tile `(1,1)`. Since water is passable (costs extra, never blocks), a pool can never make a floor unsolvable — the only design risk is "does it feel like a detour or a slog," which argues for keeping individual pools small and their count modest even at depth 20 (the phase's own stated target).
- **Option B:** A fixed, depth-independent pool count/size (simpler to implement and reason about, but doesn't escalate the "felt terrain" tension as depth increases, and breaks the pattern every other floor-generation knob in this codebase already follows).
- Placement safety (not really a separate option, a shared constraint under both): exclude every existing `feat` cell (dot/tele/chest/trap/climb/gorge/exit/one-way-door) and the spawn tile from eligibility, so water never overlaps a feature tile or blocks a fresh floor's start/end. This does NOT guarantee a fixture's *scripted* path stays dry — see Pitfall 1's measurement recipe, which must be run regardless of which density option is chosen.

**Recommendation: Option A**, exact count/size curve left to the planner (Claude's discretion) but reusing `difficultyCurve`'s existing shape rather than inventing a fourth unrelated formula.

### Decision 3 — How do Bodies-of-water, Heights, and Being-trapped "apply the Phase 31 Afraid penalty" when Afraid only exists inside combat?

This is the single highest-value question for the user to rule on. Code-verified fact: `afraidNeed`/`afraidDamage` (`engine/derived.js`) both gate on `state.combat.afraid > 0` and are read only from `engine/combat.js`'s strike/damage resolution — Afraid has **no meaning outside a fight**. Heights and Bodies-of-water already have a **different**, older, working mechanism (`heightsPenalty`/`waterPenalty`, a deterministic bonus added to the climb/leap roll comparison, Phase 04.1-06) and Being-trapped has a **third** mechanism (`trappedPanic`, a flat HP loss on dead-end entry, already debounced per-tile). None of these three is "the Afraid penalty."

- **Option A (recommended) — Arm Afraid for the next fight.** A fresh terrain-phobia trigger (once per region entry, per Decision 2's debounce) fires an immediate rail-narrated event with NO mechanical effect yet, and sets a zero-rng, self-clearing flag (e.g. `c.phobiaArmed`, cleared the moment it's consumed). `engine/combat.js#fight`'s existing trigger check gains this as a FOURTH OR-condition, alongside today's type-match/darkness-in-dark/near-death checks — so the player's next combat opens genuinely Afraid, using the real, existing `afraidNeed`/`afraidDamage` mechanism, satisfying TERR-05's literal wording. Critically, this is ADDITIVE, not a replacement: `heightsPenalty`/`waterPenalty`/`trappedPanic` stay exactly as they are today on the triggering roll itself (Pitfall 2's double-counting risk is structurally avoided because the two penalties land on two different rolls — the climb/leap/tile event vs. a future combat strike).
- **Option B — Terrain phobias keep their existing standalone mechanics only, with debounce + rail narration added, and no new Afraid surface.** Reads TERR-05's "apply the Phase 31 Afraid penalty" as already satisfied in spirit by the six phobias that already use it (five type-matched + Darkness/Death), treating the terrain three as a structurally different category the requirement's wording conflates. Simplest, smallest new engine surface, zero risk of double-counting by construction — but arguably under-delivers the requirement's literal text, and Being-trapped in particular would keep reading as "just an HP-loss event," which is exactly what `docs/`'s own Phase 43 CLAR-01 example line ("Being trapped: four walls and one door you already used. −4 hp.") suggests IS the intended, permanent shape for that one phobia specifically — worth noting this as a point in Option B's favor for Being-trapped even if Option A is chosen for Heights/Water.
- **Option C — A genuinely new, squares-based, out-of-combat Afraid (`c.afraidFor`), applied directly to the climb/leap/flee rolls too.** The most literal reading of "the Afraid penalty" as a standing debuff, but the largest new engine surface (a second parallel mechanism to combat's Afraid), the highest double-counting risk with the existing roll penalties, and no existing precedent in this codebase for a non-combat Afraid-equivalent.

**Recommendation: Option A for Heights and Bodies-of-water (arm-for-next-fight, existing roll penalties untouched); Option B (no new Afraid surface) specifically for Being-trapped**, since its existing HP-loss shape appears to already be the intended long-term design per the Phase 43 CLAR-01 example text quoted in this phase's own additional_context. All three still gain the "fires once on fresh entry, named in the rail line" narration polish TERR-05 asks for regardless of which mechanical option is chosen.

## State of the Art

| Old Approach (pre-Phase-41) | Phase 41 Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Shell-only `newRun` option gates a new-run-only feature (`storeRoll`, `wornSlots`) | A derived-rng stream applies the new rule to EVERY run unconditionally; fixtures declare/regenerate only what a measured divergence actually moves | 2026-09-17 (greenfield ruling, restated for this phase in ROADMAP.md's own Phase 41 goal line, which still uses the now-superseded `state.terrainRoll` wording — see the binding ruling in this phase's additional_context) | The roadmap's own Phase 41 section text is stale relative to the milestone-wide ruling; the planner should treat "generated behind a run flag, mirroring `storeRoll`" as **superseded**, not literal |
| Heights/Water phobias = a deterministic roll penalty only, no narration, no debounce (fires every single climb/leap attempt, silently) | Fires once on fresh entry, named in the rail line, PLUS (per Open Decision #3) an Afraid-penalty component | This phase | Existing `heightsPenalty`/`waterPenalty` math is unchanged in magnitude; only the narration/debounce/possible-Afraid-arming layer is new |
| Darkness fog-of-war = one radius (`revealRadius`) governing both what gets PERMANENTLY marked seen AND (implicitly, since nothing else exists) what's currently shown | Two independent concepts: `revealRadius` (permanent memory growth, unchanged) vs. `mapViewRadius` (temporary render window, new) | This phase | A player who explored a large area, then steps into an unrelated dark patch, no longer "loses" that memory on the map — it re-fogs visually only, exactly matching the Map-the-Floor `spellSeen` precedent's spirit |

**Deprecated/outdated:**
- The roadmap's literal "generated behind a new `state.terrainRoll` run flag, mirroring `storeRoll`" wording (ROADMAP.md's Phase 41 goal + success criterion 1) — superseded by the 2026-09-17 greenfield ruling. The planner should not implement this literally; the binding ruling in this research's additional_context and STATE.md's Engine Gate AMENDMENT both say so explicitly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Six type-matched combat phobias" (ROADMAP/additional_context wording) — the actual `content/flavor.js#PHOBIAS` table has exactly FIVE `t !== null` entries (Beasts, Walking Dead, Demons, Magical, Humans), not six. `t: null` entries are Darkness, Death, Being trapped, Bodies of water, Heights (five). | Phase Requirements / TERR-04 gap analysis | Low — this is a pure counting note for the planner's own verification pass; it does not change any design recommendation, but the planner should re-verify against the live `PHOBIAS` array (already quoted verbatim above) rather than trust the roadmap's "six" |
| A2 | The recommended water-placement exclusion set (`!wall && !feat`, spawn excluded) is SUFFICIENT to keep the fixture roster's scripted paths dry, without live measurement. | Pitfall 1 | MEDIUM — if wrong, `action-script.movement.json` (seed 256) or another fixture's script could still cross a water cell; the research explicitly does NOT claim this is proven, only that the measurement recipe exists and must be run before the plan locks the algorithm |
| A3 | Open Decision #3's "arm Afraid for the next fight" design is the best fit for Heights/Water/Being-trapped, given Afraid is combat-scoped today. | Open Decision #3 | MEDIUM-HIGH — this is presented as a recommendation among three real options, not a locked design; the user's ruling on this is the single most consequential input the planner needs before Wave 1 |
| A4 | Torch's `lit` effect (`itemEffectActive(c, "lit")`, Phase 39) and the Amulet of Light's `eff(c, "light")` should both count as "a light effect" for TERR-03's render filter, alongside Night Vision. | Pattern 3 / `mapViewRadius` design | LOW — both are the existing, established darkness-waiver vocabulary this codebase already uses in `inDark`/`fallDark`/`revealRadius`; a planner choosing to omit one would create an inconsistency with the exploration-radius rule players already experience |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does "Death near death" need any NEW work this phase, or is it already satisfied?**
   - What we know: `engine/combat.js#fight`'s existing `nearDeathPanic` check (`c.phobia === "Death" && c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD`) already sets `combat.afraid` at combat start for a Death-phobic character at/below 25% HP — this is a real, working, tested trigger today (Phase 31).
   - What's unclear: Whether TERR-04 lists "Death near death" merely for completeness (documenting the full phobia-trigger picture, not asking for new work) or wants an ADDITIONAL out-of-combat manifestation (e.g., a rail line the MOMENT a Death-phobic character's HP crosses the 25% line, even outside combat, ahead of any fight).
   - Recommendation: Treat as "already satisfied, no new engine work" unless the user's ruling on Open Decision #3 explicitly extends it — flag this reading in the batched question so the user can correct it cheaply if wrong.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependency beyond the project's own existing Node/`node --test` toolchain, already verified working in every prior v1.5 phase.

<!-- Validation Architecture section skipped: .planning/config.json has workflow.nyquist_validation explicitly set to false. -->

<!-- Security Domain section skipped: .planning/config.json has workflow.security_enforcement explicitly set to false. -->

## Sources

### Primary (HIGH confidence — direct code read, this session)
- `engine/maze.js` (full read) — `genFloor`'s exact draw order, cell shape, `reveal`/`refogSpellSeen`
- `engine/movement.js` (full read) — `move()`'s exact step/tick/reveal sequence, `pendingHazard`, `heightsPenalty`/`waterPenalty`/`trappedPanic`, `descend`/`teleport`'s reset sites
- `engine/encounters.js` (full read) — `fallDark`, `newPhobia`/`catchAffliction`, `PHOBIAS` consumers
- `engine/combat.js` (targeted read, lines 375-440, plus grep for every `afraid`/`phobia` occurrence) — `fight()`'s exact trigger mechanism
- `engine/derived.js` (targeted read) — `inDark`, `revealRadius`, `afraidNeed`/`afraidDamage`, `conditionsOf`'s darkness/afraid chips, `AFRAID_ROUNDS`/`AFRAID_TO_HIT_PENALTY`/`AFRAID_DMG_DIV`/`DEATH_PANIC_THRESHOLD` constants
- `engine/difficulty.js` (full read) — `difficultyCurve`'s existing depth-scaling pattern for `dots`/`darkBlobs`/`darkRadius` (the template for water's own depth curve)
- `engine/state.js` (targeted read, `newRun`) — the exact `storeRoll`/`wornSlots` shell-flag anti-pattern, verbatim
- `content/flavor.js` — the full, verbatim `PHOBIAS` table
- `test/parity/harness/comparables.js` (targeted read) — `stripSpellSeen`, `movementComparable`'s full carve-out chain, the exact pattern a `stripWaterField` must follow
- `test/parity/FIXTURE-INVENTORY.md` (targeted read) — the full fixture roster (seeds/scenarios), the section-header convention for declaring a phase's divergences
- `test/parity/fixtures/action-script.movement.json` + `action-script.schema.md` — confirmed the per-action byte-diff comparison model and the `action-path` divergence mechanism already available if needed
- `mazeworld.html`'s `draw()` (targeted read, lines 2661-2740) — the exact render loop TERR-03's filter must hook into
- `src/browser/mapMarks.js` (targeted read) — `MAP_PALETTE`/`MARK_GLYPHS` shape, the `floorSpell` precedent for a new `floorWater` tint
- `tools/lib/tuning-bot.mjs` (grep) — confirmed the bot's BFS pathing avoids `HAZARD_FEATS` (climb/gorge/trap) by `.feat`, NOT by any tile-property check — water (a non-`feat` property) will not be auto-avoided by the bot's routing unless explicitly taught to (Phase 42's job, per the phase's own out-of-scope framing)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/config.json` — phase framing, Engine Gate + its greenfield AMENDMENT, workflow flags
- `.planning/phases/40-spell-rework/40-CONTEXT.md` + `docs/SPELLS.md` — the Map-the-Floor `spellSeen`/derived-stream/structural-carve-out precedent this phase directly builds on, including its own explicit "Phase 41 note" on the seen-vs-render-filter orthogonality
- `.planning/phases/39-gear-magic-items-one-shot-tools/39-CONTEXT.md` + `docs/GEAR-BALANCE.md` — the once-a-day rule, `c.timers`/`tickSquares` activation model, torch `lit` vs `c.darkFor` scope boundary
- `.planning/phases/38-melee-active-abilities/38-01-SUMMARY.md` — the `derivedRng`/`hashString` stream precedent, verbatim
- `.planning/phases/36-balance-foundation-effect-timers-small-independent-wins/36-CONTEXT.md` — the `storeRoll` parity-gate precedent the roadmap cites, read in full to explain precisely why it is superseded

### Secondary (MEDIUM confidence)
- None — every claim in this document traces to a direct code or planning-doc read this session; no web search was performed (this is a pure internal-codebase research task with no external library/API surface).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Water generation mechanism (derived stream, structural carve-out): HIGH — directly modeled on three already-shipped, already-tested precedents (Phase 38 abilities, Phase 39 tool loot row, Phase 40 Lesser Summon/spellSeen) in the same codebase
- TERR-02 movement-cost semantics: MEDIUM-HIGH — the tick site and its `n` parameter are code-verified and the movement.js source comment literally anticipates this exact phase and change; the "single dispatch, double tick" design choice itself is still an Open Decision for the user
- TERR-03 render filter: HIGH — the exact hook point, the exact orthogonality precedent, and the exact waiver vocabulary are all code-verified
- Phobia trigger design (TERR-04/05): MEDIUM — the STRUCTURAL FACT (Afraid is combat-scoped, terrain phobias fire in movement) is HIGH confidence (directly read); the RESOLUTION is a genuine open design question, correctly flagged as such rather than defaulted

**Research date:** 2026-09-18
**Valid until:** No external time pressure (pure internal codebase, no library versions to go stale) — valid until the next phase touching `engine/maze.js`, `engine/movement.js`, or the Afraid mechanism lands (i.e., effectively until Phase 41 itself executes)
