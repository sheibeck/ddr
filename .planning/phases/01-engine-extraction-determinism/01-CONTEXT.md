# Phase 1: Engine Extraction & Determinism - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/refactor phase — smart discuss skipped grey-area questioning; architectural decisions below are locked by PROJECT.md + research/ARCHITECTURE.md)

<domain>
## Phase Boundary

Extract the full Mazeworld ruleset out of the `mazeworld.html` prototype into a UI-free, deterministic, serializable engine reached only through a single `applyAction(state, action) → {state, events}` contract. Content becomes pure data tables; randomness becomes an injected seeded PRNG whose state lives in game state; a serialize/rehydrate round-trip test guards the boundary. **Zero gameplay regressions** vs. the prototype — verified by driving the extracted engine through the existing browser harness and comparing behavior.

IN SCOPE: engine module + contract, seeded RNG, content-table extraction, serialization + round-trip tests, regression parity harness.
OUT OF SCOPE (later phases): Capacitor/Android packaging & native storage (Phase 2), endless-descent curve (Phase 3 — keep the existing 5-floor behavior intact here, just behind the new contract), mobile UI/controls (Phase 4), voice system (Phase 5). Do NOT change game balance or add features in this phase — this is a behavior-preserving refactor.
</domain>

<decisions>
## Implementation Decisions

### Engine Contract (locked by PROJECT.md + ARCHITECTURE.md research)
- Single entry point: `applyAction(state, action) → {state, events}` — pure, synchronous, no DOM/canvas/`localStorage`/`console` side effects inside the engine.
- The engine returns structured **Events** (e.g. `{type, ...}` describing what happened — moved, struck, killed, descended, died); presentation/log/persistence consume events downstream. This is the same seam a future multiplayer layer will drive.
- Non-serializable data (e.g. the prototype's `S.store` closures, at ~line 3184) must NOT live in engine `GameState`. Rework such cases into serializable data.

### Determinism (locked)
- Replace ALL `Math.random()` in rules with an injected seeded PRNG (mulberry32-class is the research's suggestion). The PRNG's internal state lives inside `GameState` so it serializes and a run is reproducible from its seed. Rendering-only jitter (if any) may stay non-seeded, but nothing that affects game outcome.
- The run's seed is captured in state so high scores are reproducible/verifiable (sets up Phase 3 endless integrity, but only the seed plumbing is in scope here).

### Content-as-data (locked)
- Move the prototype's rules tables/constants (roughly `mazeworld.html` lines ~493–914: `CLASSES`, `RACES`, `WEAPONS`, `ARMORS`, `SPELLS`, `MU_CHART`, `BESTIARY`, `ENCOUNTER_TABLES`, `POTIONS`, `TRAPS`, `AFFLICTIONS`, `EPITAPHS`, etc.) into standalone content data modules the engine reads. No content values hardcoded into logic branches.

### Extraction order (recommended by research — planner may refine)
1. Extract content tables (zero behavior risk).
2. Introduce seeded RNG, thread it through, remove `Math.random()`.
3. Slice-by-slice convert movement → combat → economy/store → character-gen → death into the `applyAction` contract, keeping the browser harness green after each slice.
4. Build the serialize/rehydrate round-trip test and the prototype-parity harness.

### Claude's Discretion
- Language/module choice (plain ES modules vs. TypeScript), file/folder layout under an `engine/` + `content/` split, test runner (e.g. node's built-in test runner or a light framework), and how the existing browser prototype is refactored to consume the engine while remaining playable in a browser for the dev loop. Keep zero runtime dependencies where practical (matches the prototype's dependency-free ethos); a dev-only test tool is fine.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from `mazeworld.html`, ~3,300 lines, and research/ARCHITECTURE.md)
- **`S`** — single global mutable game-state object (~line 1036) holding `c` (character), `floor`, `day`, `steps`, `combat`, `store`, `beats`, `dead`, `won`. Already largely plain, serializable data — the biggest asset inherited for free.
- **`act()` wrapper + "beats" system** (~lines 1391–1441) — an existing action/discrete-moment seam that prefigures the `applyAction`/events split.
- **`genFloor(depth)`** (~line 1167) — recursive-backtracker maze + feature placement + BFS exit; consumes RNG heavily (prime `Math.random()` removal target).
- **Rules functions**: `rollCharacter` (~1042), `move` (~1618), `weaponDamage` (~1484), `toHit` (~1452), `foeTurn` (~2831), `killFoe` (~2411), `checkLevel` (~2438), `descend` (~1848), `winGame` (~1858), `die`/graveyard (~2898–2990), store (~1871–2055). These call rendering (`paint()`/`draw()`), logging (`logLine`), and `save()` inline — that coupling is exactly what this phase removes.
- **Save/load** (`save()`/`load()` ~3182–3196) — `localStorage`, keys `mazeworld.delve.v1` + `mazeworld.graveyard.v1`. Stays localStorage in the browser dev loop this phase; native storage is Phase 2.

### Established Patterns
- Zero external dependencies; DOM + single `<canvas>`; event-driven (no game loop). Preserve the dependency-free ethos.

### Integration Points
- The browser prototype becomes the **test harness** for parity this phase: it must keep running (playable in a browser) while its rules are rerouted through the new engine, so regressions are caught immediately.

### Reference
- `.planning/research/ARCHITECTURE.md` — full component boundaries, the command/event seam, seeded-PRNG and serialization guidance, and the extraction build order. **Required reading for the planner.**
</code_context>

<specifics>
## Specific Ideas

- Follow `.planning/research/ARCHITECTURE.md` closely — it was written from a direct read of this exact prototype and specifies the `applyAction` boundary, the `S.store`-closures anti-pattern to fix, and the extraction order.
- The serialize/rehydrate round-trip test is a **standing guardrail** (success criterion 4) — it must be kept green through Phases 2–5, so build it to run cheaply/CI-style.
</specifics>

<deferred>
## Deferred Ideas

- Endless-descent difficulty curve — Phase 3 (this phase keeps the prototype's fixed 5-floor behavior intact, just behind the new contract).
- Native persistence / Capacitor — Phase 2.
- Any restored tabletop systems (bags, shields, thrown weapons) — v2 backlog, not now.
</deferred>
