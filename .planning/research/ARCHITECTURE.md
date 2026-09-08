# Architecture Research

**Domain:** Mobile roguelike dungeon-crawler, ported from a single-file web prototype to native iOS/Android, with post-MVP online multiplayer as a designed-for (not built) future
**Researched:** 2026-09-07
**Confidence:** HIGH (component boundaries and seam design — derived directly from reading the existing 3,300-line prototype, `mazeworld.html`, plus well-established game-architecture patterns); MEDIUM (specific packaging tech references — cross-checked web sources, see Sources)

## Prototype As-Built (what already exists)

Before recommending a target architecture, this is what `mazeworld.html` actually does today — every recommendation below is a *refactor* of this, not a rewrite from zero:

- **`S`** — one global mutable object: `{ c: character, floor: mazeGrid+features+playerPos, day, steps, combat, store, beats, dead, won, deathNote, epitaph }`. `S.c` and `S.floor` are plain JSON-serializable data (numbers, strings, plain objects/arrays) — this is the single biggest asset the port inherits for free.
- **`act(fn)`** — wraps a "turn": runs a closure that mutates `S` and calls `logLine`/`say`/`evt` to narrate; captures those narration strings into `S.beats` (a list of "beat" groups with HTML-flavored lines); then calls `renderEncounter()` directly. This is an embryonic event-log pattern, but it's incomplete as a seam (see Anti-Patterns).
- **Dice/RNG** — `D(n)` and `pick(a)` call `Math.random()` directly, globally, unseeded. Maze generation, combat, loot, and encounter tables all consume it the same way.
- **Rendering** — `draw()` (canvas, reads `S.floor` directly), `paint()` (imperative DOM writes for the character sheet/HUD, reads `S.c`/`S.floor`/`S.day` directly), `renderEncounter()`, `renderGraves()`. All are called *from inside* game-logic functions (`move()`, `descend()`, `die()`, etc.), not from a separate loop.
</br>
- **Persistence** — `save()`/`load()` synchronously JSON-serialize a hand-picked subset of `S` to `localStorage`; `S.store` (shop) is deliberately excluded from saves because it "holds closures" — a design smell where a piece of otherwise-game state became non-serializable.
- **Input** — DOM `addEventListener` handlers (`dpad` clicks, `keydown`) call domain functions (`move(dir)`, combat button handlers) directly and synchronously; each call cascades through mutation → narration → render → save in one call stack.
- **Procedural generation** — `genFloor(depth)`: recursive-backtracker maze + BFS-farthest-cell exit placement + feature scattering + depth-scaled "dark zone" blobs. Depth already flows in as a parameter and already tunes *some* things (dark-zone count, encounter-dot count) but **not** monster difficulty or loot tier — those are static tables today. The fixed 5-floor "Gate" ending is a single `depth >= 5` check in `genFloor`.
- **Module boundaries that already exist as comment sections** (useful cut lines): state, character creation, maze generation, rendering, log/beats, derived character numbers, encounters, carried treasure, the graveyard, boot/wiring. These map almost 1:1 onto the module split recommended below.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  PLATFORM SHELL  (native iOS/Android via WebView wrapper, or later    │
│  a native rewrite of the same shape)                                  │
│  ┌────────────┐ ┌────────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │ App lifecy-│ │ Native storage │ │ Haptics/Audio │ │ Store/build │ │
│  │ cle bridge │ │ (file/KV, not  │ │ bridge        │ │ signing     │ │
│  │            │ │ browser LS)    │ │               │ │             │ │
│  └─────┬──────┘ └───────┬────────┘ └───────┬───────┘ └─────────────┘ │
├────────┼────────────────┼──────────────────┼──────────────────────── ┤
│        │      PRESENTATION LAYER (UI — DOM/canvas today, could be    │
│        │      native views in a rewrite)                             │
│  ┌─────▼──────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ Input      │  │ HUD / sheet  │  │ Maze renderer │  │ Event-log  │ │
│  │ adapter    │  │ view         │  │ (canvas)      │  │ view (log/ │ │
│  │ (taps→     │  │ (reads       │  │ (reads floor  │  │ beats,     │ │
│  │  Actions)  │  │  snapshot)   │  │  snapshot)    │  │ formats    │ │
│  │            │  │              │  │               │  │ Events)    │ │
│  └─────┬──────┘  └──────▲───────┘  └──────▲────────┘  └─────▲──────┘ │
│        │ Action         │ StateSnapshot   │ StateSnapshot   │Events  │
├────────┼────────────────┴─────────────────┴─────────────────┴────────┤
│        │           RULES / SIMULATION ENGINE (pure, sync, no DOM,    │
│        ▼           no I/O — this is the multiplayer-ready seam)      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  applyAction(state, action, rng) → { state, events }          │   │
│  │  ── character creation  ── combat resolution  ── movement     │   │
│  │  ── shop/economy        ── leveling/skills    ── death/burial │   │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                    │ uses                             │
│                    ┌───────────────▼────────────────┐                │
│                    │ PROCEDURAL GENERATION            │               │
│                    │ maze/floor gen, encounter tables,│               │
│                    │ loot tables, difficulty curve —  │               │
│                    │ all pure functions of (seed,     │               │
│                    │ depth, rng-cursor)                │               │
│                    └───────────────┬────────────────┘                │
│                                    │ consumes                         │
│                    ┌───────────────▼────────────────┐                │
│                    │ SEEDED RNG  (deterministic,      │               │
│                    │ serializable cursor)             │               │
│                    └──────────────────────────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│  PERSISTENCE  (adapter behind an interface; localStorage today,      │
│  native secure/file storage on-device, no server in MVP)             │
│  ┌─────────────┐  ┌────────────────┐  ┌───────────────────────────┐ │
│  │ Active run  │  │ Graveyard /    │  │ Settings (audio, controls)│ │
│  │ snapshot    │  │ high scores    │  │                            │ │
│  └─────────────┘  └────────────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|-----------------|-------------------------|
| Rules/Simulation Engine | Owns all game rules: character creation, movement legality, combat math, spellcasting, shop economy, leveling, death, endless-descent progression. Exposes one narrow entry point (`applyAction`). Never touches DOM, canvas, `localStorage`, or `Math.random()` directly. | A dependency-free module (or small set of modules) of pure/near-pure functions operating on a plain-data `GameState` object; this is exactly what `move()`, `descend()`, `startCombat()`, `openStore()`, `die()`, `checkLevel()` etc. already are today, minus their render/save/DOM calls. |
| Game State | The plain-data object graph the engine reads and writes: character, current floor grid, run counters (day/steps/depth), combat sub-state, shop sub-state, RNG cursor, seed, run-log/version. Must be 100% JSON-serializable — no closures, no class instances with methods, no DOM references. | Prototype's `S` object, with the one wart fixed: shop stock becomes plain data (regenerated deterministically from seed+turn, or stored as plain arrays) instead of closures. |
| Procedural Generation | Pure functions that take `(seed, depth, rngCursor)` and return floor layouts, encounters, loot, and — new for endless mode — a difficulty-scaling curve. No global RNG access; only the injected RNG. | `genFloor(depth)`, `bfs()`, encounter/loot table lookups — same algorithms as today (recursive backtracker + BFS placement), parameterized by depth for endless scaling. |
| Rendering / Presentation | Turns a `StateSnapshot` (and/or an `Events` stream) into pixels/DOM: HUD, character sheet, canvas maze, encounter log. Never mutates game state; only reads it and dispatches `Action`s on input. | `draw()`, `paint()`, `renderEncounter()`, `renderGraves()` today — refactored to be pure "read state, write UI," called from one render loop/subscriber instead of scattered inline in gameplay functions. |
| Input | Translates platform input (touch D-pad, keyboard, tap targets) into engine `Action` objects (`{type:'move', dir:'N'}`, `{type:'attack'}`, `{type:'buyItem', idx}`) and hands them to a single dispatch point. Contains no game rules. | Today's `dpad` click handler and `keydown` listener, changed from "call `move()` directly" to "build an Action and dispatch it." |
| Persistence | Serializes/deserializes `GameState` (active run) and a separate append-only Graveyard/high-score store, behind a small interface (`load()/save()/loadGraves()/saveGraves()`) so the storage backend (browser `localStorage` today, native `Preferences`/file storage tomorrow) is swappable without touching the engine. | Prototype's `save()/load()/loadGraves()/saveGraves()`, with the shop-closure gap closed and a storage-adapter interface inserted between them and `localStorage`. |
| Platform/Native Bridge | Everything that only exists because the app runs on a phone inside an app-store shell: app lifecycle (background/foreground, low-memory), native storage APIs, haptics, safe-area/notch layout, back-button handling, store billing stub (none needed for v1), crash/analytics opt-in. | A thin wrapper layer (e.g., Capacitor) around the existing web app; talks to Persistence and Input, never to the Engine directly. |

## Recommended Project Structure

```
src/
├── engine/                     # The decoupled, serializable rules engine — the multiplayer seam
│   ├── state.ts                # GameState shape + factory (newRun(seed)), pure data only
│   ├── actions.ts               # Action type union + validators (what a caller may ask the engine to do)
│   ├── events.ts                # Event type union (what the engine reports happened) — structured, no HTML/markup
│   ├── engine.ts                # applyAction(state, action) -> {state, events}; the single public entry point
│   ├── rng.ts                   # Seeded PRNG (mulberry32-class) + roll/pick/shuffle helpers, all engine-internal
│   ├── character.ts             # rollCharacter, leveling, skills — ports rollCharacter()/checkLevel()
│   ├── maze.ts                  # genFloor, bfs, feature placement — ports genFloor()/bfs()
│   ├── difficulty.ts            # NEW: endless-descent scaling curve (depth -> monster tier/loot tier/hazard density)
│   ├── combat.ts                # startCombat, strike resolution, spellcasting — ports startCombat() and friends
│   ├── economy.ts                # shop/store, loot, gold — ports openStore()/findGear() etc., stock as plain data
│   └── death.ts                  # die(), epitaphFor(), run summary for graveyard — ports die()/epitaphCtx()
├── content/                     # Pure data tables — no logic — extracted from the prototype's big consts
│   ├── classes.ts, races.ts, spells.ts, creatures.ts, items.ts, epitaphs.ts, names.ts ...
├── presentation/                 # UI layer — DOM/canvas now; swappable later
│   ├── render/
│   │   ├── mazeCanvas.ts         # ports draw()
│   │   ├── hud.ts                # ports paint()
│   │   └── log.ts                # formats Events -> narration text/markup (the ONE place HTML/copy lives)
│   ├── input/
│   │   └── controls.ts           # dpad + keyboard -> Action objects, ports the addEventListener wiring
│   └── screens/                  # character sheet, encounter panel, graveyard, tutorial, store dialogs
├── persistence/
│   ├── storageAdapter.ts         # interface: get/set/remove, implemented per platform
│   ├── runStore.ts                # ports save()/load()
│   └── graveyardStore.ts          # ports loadGraves()/saveGraves()/bury()
├── platform/                      # native bridge — thin, replaced per target
│   └── capacitorBridge.ts (or equivalent)
└── app.ts                         # boot/wiring: creates engine, presentation, persistence; owns the one game loop
```

### Structure Rationale

- **`engine/` has zero imports from `presentation/`, `persistence/`, or `platform/`.** This is enforced (lint rule / separate package) not just conventional — it is the concrete guarantee that a future multiplayer server can `require`/`import` this folder verbatim and run it headless in Node.
- **`content/` is split out from `engine/`** because it's large, static, and edited far more often (balance passes, new creatures/spells) than the logic that consumes it — keeps diffs small and lets non-engineers (design/writing passes on epitaphs, flavor text) touch it safely.
- **`presentation/render/log.ts` is the only file allowed to know about HTML/CSS classes or narrative string templates.** The engine emits structured `Events` (`{type:'hit', attacker, target, dmg}`); this file turns them into the sarcastic, family-friendly copy the game's voice requires. This directly fixes the prototype's biggest coupling problem (see Anti-Patterns).
- **`persistence/` is behind an adapter interface** so swapping `localStorage` for a Capacitor `Preferences`/filesystem plugin (or, far later, a cloud save) touches one file, not the engine or UI.

## Architectural Patterns

### Pattern 1: Command/Event Engine Boundary (the multiplayer-ready seam)

**What:** The engine exposes exactly one public function shape: `applyAction(state: GameState, action: Action) => { state: GameState, events: Event[] }`. `Action` is what a player (local input, or later a network message) wants to attempt. `Event` is a structured, serializable record of what actually happened (a hit, a level-up, a floor change, a death) — never a pre-formatted string. Everything the UI shows — canvas redraw, HUD numbers, the sarcastic log — is derived by *presentation* code reading the returned `state` and translating `events` into pixels/text. The engine never calls a render function, never touches `localStorage`, never touches `Math.random()` directly.

**When to use:** From day one of the port — this is the seam the whole multiplayer future depends on, and it costs the same to build now as it would later, except later requires unwinding real coupling.

**Trade-offs:** Slightly more ceremony per action (define an Action type, an Event type) than "just call the function and let it render." Pays for itself immediately: it's also exactly the shape a native rewrite needs (no DOM to entangle with), and exactly the shape a lockstep multiplayer host needs (broadcast the `Action`, everyone runs the same `applyAction`, or a server runs it once and broadcasts the `Event`s) — deterministic command/event separation is the standard basis for turn-based/lockstep multiplayer architectures [MEDIUM confidence, cross-checked general pattern].

**Example:**
```typescript
// engine/actions.ts
type Action =
  | { type: "move"; dir: "N"|"S"|"E"|"W" }
  | { type: "attack"; targetIdx?: number }
  | { type: "castSpell"; spellId: string; targetIdx?: number }
  | { type: "buyItem"; idx: number }
  | { type: "flee" };

// engine/events.ts
type Event =
  | { type: "moved"; to: [number, number] }
  | { type: "strike"; actor: "player"|"monster"; roll: number; hit: boolean; dmg: number }
  | { type: "floorChanged"; depth: number }
  | { type: "died"; cause: string; epitaphKey: string };

// engine/engine.ts
function applyAction(state: GameState, action: Action): { state: GameState; events: Event[] } {
  const events: Event[] = [];
  const next = structuredClone(state); // or an immutable-update helper
  switch (action.type) {
    case "move": movePlayer(next, action.dir, events); break;
    case "attack": resolveAttack(next, action, events); break;
    // ...
  }
  return { state: next, events };
}
```

### Pattern 2: Injected, Serializable Seed-Cursor RNG

**What:** Replace every `Math.random()` call with a small seeded PRNG (mulberry32-class: a 32-bit state, fast, good-enough statistical quality for gameplay, not cryptographic) whose state lives *inside* `GameState.rngState` and advances only when the engine consumes it. `D(n)`/`pick(a)`/`shuffle(a)` become methods on an `Rng` object threaded through engine calls, never free functions calling the global `Math.random`.

**When to use:** From day one — this is required for both the endless-mode requirement ("scaling difficulty" needs the engine to *know* how deep it is generating for, deterministically) and the stated requirement of deterministic/seeded runs for high-score integrity: persist `{ seed, actionLog | rngCursor+depth }` alongside a run's final score so a claimed high score can, in principle, be replayed and checked, and so the exact same seed can reproduce the exact same floor for debugging or (later) a daily-challenge/shared-seed mode.

**Trade-offs:** None significant for a single-player game — mulberry32-class PRNGs are proven fast and simple [MEDIUM confidence, cross-checked]. The only discipline required is never letting *presentation* code call the RNG (a UI-only "cosmetic shimmer" effect can use its own unseeded RNG, but nothing that affects `GameState` may).

**Example:**
```typescript
// engine/rng.ts
function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// GameState carries { seed: number, rngCalls: number } — rehydrate the generator
// on load by re-seeding and fast-forwarding rngCalls, OR persist the raw internal
// state `a` directly (simpler; do this).
```

### Pattern 3: Depth-Parameterized Procedural Generation + Difficulty Curve

**What:** `genFloor(depth, rng)` already takes `depth` as an input and already scales two things by it (dark-zone blob count, encounter-dot count). Endless mode extends this same shape with a `difficultyCurve(depth)` pure function that returns tunables — monster tier weighting, loot tier weighting, WP/damage multipliers or floor-scoped modifiers, maze size/complexity bumps — consumed by maze gen, encounter resolution, and loot rolls. No hard floor cap; scaling should asymptote (log/soft-cap curves) rather than grow unbounded, so floor 80 is brutal-but-fair rather than instant-death, and so numbers don't overflow.

**When to use:** This is the concrete design for the "endless descent with scaling difficulty" requirement — it replaces the single `depth >= 5 ? "gate" : "exit"` check with an always-`"exit"` (no gate) plus a depth-fed difficulty table.

**Trade-offs:** Requires actual game-design tuning work (what should floor 20 feel like vs floor 5?) that the prototype never had to do, since it only ever needed 5 floors. Budget real playtesting time for this curve — it is a game-balance problem, not just an engineering one.

## Data Flow

### Turn/Action Flow (the core loop, single-player MVP)

```
[Touch D-pad / keypress]
    ↓  (Input adapter: raw event -> Action)
[Action object]  e.g. {type:"move", dir:"N"}
    ↓  dispatch()
[Engine.applyAction(state, action)]
    ↓  reads/writes GameState via engine-internal modules (maze, combat, economy, rng)
[{ newState, events[] }]
    ↓                                   ↓
[app.ts replaces current state]   [events fan out to:]
    ↓                                   ├─→ presentation/render/log.ts  (narrate: "A goblin claws at you — miss.")
    ↓                                   └─→ (future) network layer (broadcast events to other peers)
[presentation/render/*] reads new state → redraws canvas + HUD
    ↓
[persistence/runStore.save(newState)]  (fire-and-forget, throttled to once per turn)
```

**Direction is one-way and non-negotiable:** Input → Action → Engine → (State, Events) → Presentation/Persistence. Presentation and Persistence never call back into the engine except by producing a new `Action`; they never reach into `GameState` and mutate it directly, and the engine never calls into presentation or persistence.

### State Management

```
GameState (single source of truth, owned by app.ts)
    ↓ (read-only StateSnapshot passed down)
[HUD / MazeCanvas / LogView / GraveyardView]  — pure "render(snapshot)" functions, no local game-rule state
    ↑ (Action, on user interaction)
[Input adapter] → dispatch(action) → Engine.applyAction → new GameState → loop
```

### Key Data Flows

1. **A turn (move/fight/shop):** Input builds an `Action` → `Engine.applyAction` returns new `state` + `events` → app.ts swaps state, hands `events` to the log formatter and new `state` to the renderers → persistence saves the new state. This is identical whether the action came from a local D-pad tap or (post-MVP) a message received from a network peer — that identity is the entire point of the seam.
2. **Endless descent:** On an `"exit"` tile, engine increments `depth`, calls `genFloor(depth, rng)` which calls `difficultyCurve(depth)` for tuning, and emits a `floorChanged` event. No floor cap; the game never "wins," it only ends in death (permadeath) or, if ever desired, a voluntary "retire and bank the score" action.
3. **Run end → graveyard:** `die()`/(future) `retire()` produces a `RunSummary` (name, depth reached, day, steps, cause, epitaph) that persistence appends to the Graveyard store — a separate, append-only, smaller data set from the active-run snapshot, so a corrupted/cleared active run never loses history.
4. **Save/resume:** Persistence serializes the *entire* `GameState` (including `rngState` and any mid-encounter/mid-shop sub-state, now plain data) after every turn; on relaunch, `load()` rehydrates `GameState` and presentation re-renders from it — fixing the prototype's current gap where an open shop (closures) can't survive a reload.

## Endless Descent & Determinism — how they fit the architecture

- **Endless descent** is purely a `content + difficulty.ts` concern layered on the existing `genFloor(depth)` shape — no new component is needed, just: (a) remove the depth-5 "Gate" branch, (b) add `difficultyCurve(depth)` consumed by monster/loot rolls and maze generation, (c) decide and implement a soft-cap curve so late floors stay winnable-but-hard rather than either trivial or instantly lethal.
- **Deterministic/seeded runs** requires exactly two things the engine must own: (1) an injected seeded RNG whose *entire* state is part of `GameState` (Pattern 2), and (2) a stable `applyAction` that produces identical output given identical `(state, action)` input — i.e., no reads of wall-clock time, `Math.random()`, or ambient globals anywhere inside `engine/`. Given both, a run's integrity can be checked in one of two ways: store the `seed + ordered action log` and replay it to confirm the claimed final depth/score (strong, more storage), or store just `seed + depth reached + a running checksum/hash of state at intervals` (weaker, cheap). For a fully-offline v1 with local-only high scores, the cheap option is sufficient; keep the action-log replay option in mind as a "don't architecturally foreclose it" concern for any future shared/online leaderboard.
- These two concerns compose: the same seeded RNG that makes floor generation reproducible is what makes a "share this seed" or "daily challenge" feature possible later, at zero extra engine cost — it fits naturally into `engine/rng.ts` + `engine/maze.ts` and needs no bespoke plumbing beyond what determinism already requires.

## Scaling Considerations

Reframed for this project: there is no "user count" scaling problem (fully offline, single local player). The axes that matter are **depth** (how far a single run can sensibly go) and **multiplayer readiness** (how much rework is needed to add the post-MVP feature).

| Scale | Architecture Adjustments |
|-------|---------------------------|
| MVP: solo, offline, fixed-size 21×21 maze per floor | Current architecture (engine + local presentation + local persistence) is sufficient. No networking, no server, no accounts. |
| Endless depth (floor 50, 100, 500+) | `difficultyCurve` must asymptote; consider periodically enlarging the maze or increasing feature density rather than only scaling monster stats, to keep pacing (5–10 min sessions) intact at depth. Watch for numeric growth (WP/damage) overflowing UI formatting or breaking balance — cap or log-scale past a threshold. |
| Post-MVP multiplayer ("play with friends") | Because `engine/` already only consumes `(state, action) → (state, events)`, add a thin transport layer: a session host (could be one player's device acting as authority, or a small relay service) receives `Action`s from peers, calls the *same* `engine/applyAction` used offline, and broadcasts resulting `state`/`events`. No engine changes required if the seam was honored; this is the payoff of the whole architecture. |

### Scaling Priorities

1. **First bottleneck: difficulty-curve tuning, not engineering.** Endless mode's hardest problem is game balance (what should depth 30 feel like?), not code structure — budget playtesting iterations, not just implementation time.
2. **Second bottleneck: presentation performance on mid-range phones.** The canvas maze redraw is currently a full-grid repaint per move (`draw()` iterates all 441 cells every call); this is fine at 21×21 but should be profiled early on real mid-range Android hardware inside the native shell, since WebView canvas performance is a known soft spot for HTML-wrapped games.

## Anti-Patterns

### Anti-Pattern 1: Rules Functions That Call Render/Save/DOM Inline

**What people do (and what the prototype does today):** `move()`, `descend()`, `die()`, `openStore()` etc. mutate `S`, call `logLine()`/`say()`/`evt()` (which push raw HTML strings directly into the DOM *and* into the state's `beats`), then call `paint()`/`draw()`/`renderEncounter()`, then call `save()` — all in the same function, same call stack.
**Why it's wrong:** It's untestable without a DOM, unrunnable headlessly (which a future multiplayer server or a native rewrite both need), and it bakes presentation markup (`<span class="hurt">`) into what should be portable game data. It also means "what happened" and "how it's shown" can never be decoupled without touching every rule function.
**Instead:** Engine functions return `{ state, events }` and know nothing about rendering, storage, or markup; exactly one place (the presentation log formatter) turns `events` into copy/markup; exactly one place (persistence) decides when/how to save.

### Anti-Pattern 2: Unseeded Global RNG Inside Game Rules

**What people do (and what the prototype does today):** Every roll (`D(n)`, `pick(a)`, `shuffle(a)`) calls the global `Math.random()` directly, so no run is ever reproducible and there is no way to verify or replay a high score.
**Why it's wrong:** Forecloses seeded/reproducible runs, deterministic multiplayer lockstep, and any future "share a seed"/daily-challenge feature — all cheap to build in if RNG is injected from the start, expensive to retrofit once dozens of call sites assume a global.
**Instead:** One `Rng` instance lives in `GameState`, is threaded explicitly into every engine function that needs randomness, and is the only thing in the codebase allowed to call `Math.random()` (to pick the initial seed on a brand-new run).

### Anti-Pattern 3: Non-Serializable Data Sneaking Into Game State

**What people do (and what the prototype does today):** `S.store` holds closures (function values) generated when a shop opens, so it's excluded from `save()` — meaning a save/reload mid-shop silently loses the shop.
**Why it's wrong:** Any value in `GameState` that isn't plain JSON-serializable data is a save/resume bug waiting to happen, and it's also a value a multiplayer host could never send over a wire.
**Instead:** Represent shop stock (and anything similar) as plain data — an array of item IDs/quantities/prices generated deterministically from `(seed, depth, turn)` — so it can regenerate identically from the RNG cursor if needed, or simply be saved as data like everything else.

### Anti-Pattern 4: Treating "Wrap the Web App" as License to Skip the Engine/UI Split

**What people do:** Assume that because the plan is "wrap the existing web page in a native shell," no refactor of the coupling described above is needed — just ship the HTML as-is inside Capacitor/Cordova.
**Why it's wrong:** Wrapping solves *packaging/distribution* (native binary, store listing, native APIs) but does nothing for the *decoupling* requirement the project explicitly calls out (rules engine must stay UI-independent and serializable for multiplayer). Those are orthogonal problems; solving one does not solve the other, and the multiplayer requirement is stated as non-negotiable in `PROJECT.md`.
**Instead:** Do the wrap for distribution *and* do the engine/UI extraction for the seam — they're independent workstreams that can proceed in parallel once the extraction has started (see Suggested Build Order).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| None required for MVP (fully offline, no accounts, no backend) | — | Deliberate per `PROJECT.md` constraints. |
| Native packaging shell (e.g., Capacitor) | Wraps the built web bundle; exposes storage/haptics/lifecycle plugins to `platform/` | Works with plain vanilla JS/canvas apps, not tied to a JS framework; used by other canvas/web games for the same iOS/Android packaging need [MEDIUM confidence, cross-checked]. Final tool choice (Capacitor vs. Cordova vs. a from-scratch native rewrite) is the subject of a separate stack/feasibility research track per `PROJECT.md`; this document's component boundaries hold regardless of which is chosen. |
| App store platform identity (Game Center / Google Play Games) | Out of scope for v1; would attach at the `platform/` layer only if/when multiplayer needs matchmaking/identity | Per `PROJECT.md`, explicitly deferred. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|-----------------|-------|
| Input ↔ Engine | `Action` objects, one-directional (Input → Engine) | Input never reads engine internals beyond the last `StateSnapshot` needed to know what actions are currently legal to offer (e.g., gray out "attack" outside combat). |
| Engine ↔ Presentation | `StateSnapshot` + `Event[]`, one-directional (Engine → Presentation) | Presentation never mutates state; a UI-only optimistic animation (e.g., a swing animation before the result renders) must be purely cosmetic and reconciled against the authoritative `state`/`events` once they arrive. |
| Engine ↔ Persistence | Plain-data `GameState` in/out, via `save(state)`/`load(): state` | Persistence has no knowledge of game rules; it's a dumb serializer + storage adapter. |
| Engine ↔ Procedural Generation | Direct function calls within `engine/`, sharing the same injected `Rng` | Not a network/process boundary — just a module boundary for organization; generation code must still never touch `Math.random()`, DOM, or storage. |
| Platform Bridge ↔ everything else | Platform talks only to Persistence (native storage) and Input (native lifecycle/back-button events); never to Engine directly | Keeps the engine identically portable to a future server process, which will never have "platform" concerns like haptics or app lifecycle. |
| Engine ↔ (future) Multiplayer transport | Same `Action` in / `Event`+`state` out contract, just relayed over a network instead of a function call | This is the payoff: no new engine API is needed for multiplayer, only a new caller of the existing one. |

## Suggested Build Order

The rules engine already exists and works (as entangled logic inside `mazeworld.html`). The build order below is an **extraction and hardening sequence**, not a from-scratch build — front-load the decoupling work because every later phase (endless mode, native packaging, onboarding/tutorial, eventual multiplayer) is cheaper once the seam exists, and needlessly expensive if bolted on after presentation/platform work has already assumed the tangled shape.

1. **Extract `content/` (data tables) first.** Zero behavior risk — pulling `CLASSES`, `RACES`, `SPELLS`, `WEAPONS`, `EPITAPHS`, `NAMES`, encounter/loot tables into standalone modules is pure mechanical refactoring and immediately shrinks the surface area of every later step.
2. **Introduce the seeded `Rng` and thread it through generation/combat/loot, replacing `Math.random()`/`D()`/`pick()`/`shuffle()` call sites.** Do this before splitting engine/UI, because it's easiest to verify correctness (same seed → same maze) while the code still runs in the browser exactly as before, side-by-side with the old behavior.
3. **Define `Action`/`Event` types and refactor one vertical slice end-to-end** (movement is the best first candidate: `move()` touches maze traversal, feature triggers, day/upkeep ticking) into `applyAction(state, action) → {state, events}`, with a temporary adapter that still calls the old `paint()`/`draw()`/`logLine()` from `events` so the game keeps working at every commit.
4. **Repeat the slice-by-slice extraction for combat, shop/economy, character creation/leveling, and death/graveyard** — each becomes its own `engine/*.ts` module reachable only through `applyAction`. By the end of this step, `engine/` should have no imports of DOM/canvas/`localStorage`.
5. **Replace the temporary adapter with a real `presentation/render/log.ts`** that formats structured `Event`s into the sarcastic narrative copy — this is also the natural point to do the "voice" pass (epitaphs, log flavor) since it's now centralized in one file instead of scattered across every rule function.
6. **Add `difficulty.ts` and remove the depth-5 Gate, wiring `genFloor`/combat/loot to consult it** — this is the endless-descent conversion, and it's now a content/tuning change against a stable engine rather than a structural one.
7. **Harden persistence:** fix the shop-closure gap (make shop stock plain data), version the saved `GameState` shape, and confirm save/resume works through every sub-state (mid-combat, mid-shop, mid-beat) now that everything is plain data.
8. **Only now touch packaging/platform** (native shell, storage adapter swap, onboarding/tutorial UI, mobile-first layout passes) — these are presentation/platform concerns that are strictly easier against a clean `engine/` boundary, and this ordering means platform research (wrap vs. rewrite, decided separately) can proceed in parallel with steps 1–6 without blocking them.
9. **Multiplayer is not built in this build order** (explicitly post-MVP), but steps 1–7 are exactly the prerequisite work the project already committed to doing regardless — nothing here is speculative "build for a future that might not come," it is the same refactor endless mode and robust save/resume already require.

## Sources

- `C:\projects\mazeworld\mazeworld.html` — primary source; read directly (state shape, `act()`/beats, `draw()`/`paint()`, `genFloor()`, `move()`, `save()`/`load()`, `die()`/graveyard, RNG usage, depth-5 Gate logic).
- `C:\projects\mazeworld\.planning\PROJECT.md` — project constraints and requirements (endless descent, decoupled/serializable engine, offline-only, deterministic/seeded high-score integrity implied by "local high-score/depth chase").
- Deterministic lockstep / command-pattern multiplayer architecture — general pattern, cross-checked via web search [MEDIUM confidence]: [Netcode Architectures Part 1: Lockstep (SnapNet)](https://www.snapnet.dev/blog/netcode-architectures-part-1-lockstep/), [Game Networking Demystified, Part III: Lockstep](https://ruoyusun.com/2019/04/06/game-networking-3.html), [GameDev.net: deterministic lockstep for turn-based games](https://gamedev.net/forums/topic/708524-right-way-of-implementing-deterministic-lockstep-for-turn-based-games/).
- Seeded PRNG (mulberry32-class) for reproducible game randomness — cross-checked via web search [MEDIUM confidence]: [Mulberry32 GitHub](https://github.com/cprosche/mulberry32), [Understanding Mulberry32 for deterministic randomness in JS](https://emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/).
- Wrapping an existing vanilla-JS/canvas web app for iOS/Android app-store distribution — cross-checked via web search [MEDIUM confidence]: [Ionic: Native Mobile Apps with Capacitor & VanillaJS](https://ionic.io/blog/create-powerful-native-mobile-apps-with-capacitor-vanillajs), [Android Games with Capacitor and JavaScript (Excalibur.js)](https://excaliburjs.com/blog/android-games-capacitor/). Final packaging-tech decision (Capacitor vs. Cordova vs. native rewrite) is deferred to the separate stack/feasibility research track named in `PROJECT.md`; cited here only to support that the "wrap" path is viable in principle and doesn't change the component boundaries above.

---
*Architecture research for: mobile roguelike dungeon-crawler port (Mazeworld)*
*Researched: 2026-09-07*
