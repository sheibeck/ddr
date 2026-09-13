# Phase 1: Engine Extraction & Determinism - Research

**Researched:** 2026-09-07
**Domain:** Testing/validation architecture and mechanical refactor patterns for extracting a pure, deterministic `applyAction(state, action) → {state, events}` engine out of a 3,300-line DOM-coupled vanilla-JS prototype
**Confidence:** HIGH (mechanical extraction patterns, direct read of `mazeworld.html`); MEDIUM (Node.js test-runner feature stability, PRNG comparison — cross-checked web sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Engine Contract (locked by PROJECT.md + ARCHITECTURE.md research)**
- Single entry point: `applyAction(state, action) → {state, events}` — pure, synchronous, no DOM/canvas/`localStorage`/`console` side effects inside the engine.
- The engine returns structured **Events** (e.g. `{type, ...}` describing what happened — moved, struck, killed, descended, died); presentation/log/persistence consume events downstream. This is the same seam a future multiplayer layer will drive.
- Non-serializable data (e.g. the prototype's `S.store` closures, at ~line 3184) must NOT live in engine `GameState`. Rework such cases into serializable data.

**Determinism (locked)**
- Replace ALL `Math.random()` in rules with an injected seeded PRNG (mulberry32-class is the research's suggestion). The PRNG's internal state lives inside `GameState` so it serializes and a run is reproducible from its seed. Rendering-only jitter (if any) may stay non-seeded, but nothing that affects game outcome.
- The run's seed is captured in state so high scores are reproducible/verifiable (sets up Phase 3 endless integrity, but only the seed plumbing is in scope here).

**Content-as-data (locked)**
- Move the prototype's rules tables/constants (roughly `mazeworld.html` lines ~493–914: `CLASSES`, `RACES`, `WEAPONS`, `ARMORS`, `SPELLS`, `MU_CHART`, `BESTIARY`, `ENCOUNTER_TABLES`, `POTIONS`, `TRAPS`, `AFFLICTIONS`, `EPITAPHS`, etc.) into standalone content data modules the engine reads. No content values hardcoded into logic branches.

**Extraction order (recommended by research — planner may refine)**
1. Extract content tables (zero behavior risk).
2. Introduce seeded RNG, thread it through, remove `Math.random()`.
3. Slice-by-slice convert movement → combat → economy/store → character-gen → death into the `applyAction` contract, keeping the browser harness green after each slice.
4. Build the serialize/rehydrate round-trip test and the prototype-parity harness.

### Claude's Discretion
- Language/module choice (plain ES modules vs. TypeScript), file/folder layout under an `engine/` + `content/` split, test runner (e.g. node's built-in test runner or a light framework), and how the existing browser prototype is refactored to consume the engine while remaining playable in a browser for the dev loop. Keep zero runtime dependencies where practical (matches the prototype's dependency-free ethos); a dev-only test tool is fine.

### Deferred Ideas (OUT OF SCOPE)
- Endless-descent difficulty curve — Phase 3 (this phase keeps the prototype's fixed 5-floor behavior intact, just behind the new contract).
- Native persistence / Capacitor — Phase 2.
- Any restored tabletop systems (bags, shields, thrown weapons) — v2 backlog, not now.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Rules run in a UI-free engine reached only through `applyAction(state, action) → {state, events}` — no rendering/storage/DOM inside the engine | See Architecture Patterns (Command/Event boundary mechanics, global-`S`-to-parameter conversion) and Validation Architecture (headless-import test + static grep guard) |
| ENG-02 | All randomness uses an injected seeded PRNG stored in game state, no direct `Math.random()` | See Determinism Testing findings, mulberry32 pattern, content-table dice-closure finding (79 call sites), and Validation Architecture ENG-02 row |
| ENG-03 | Game content lives in pure data tables separated from logic | See "Content Tables Are Not Pure Data Today" finding and Don't Hand-Roll / Architecture Patterns |
| ENG-04 | Full game state serializes/rehydrates losslessly, verified by a standing round-trip test | See Serialize/Rehydrate Round-Trip Testing section and Runtime State Inventory (save-schema migration) |
| ENG-05 | Complete prototype ruleset preserved with zero gameplay regressions | See Prototype-Parity Regression Harness section and Validation Architecture ENG-05 row |
</phase_requirements>

## Summary

This phase does not need new architecture — `.planning/research/ARCHITECTURE.md` already specifies the `applyAction` boundary, the seeded-RNG pattern, and the extraction order. What it needs is a **testing harness that makes "no regressions" and "byte-identical determinism" mechanically checkable**, plus concrete extraction moves for the specific coupling this prototype has.

Three findings from direct inspection of `mazeworld.html` sharpen the locked plan:

1. **Randomness is not confined to `move()`/`foeTurn()`/`genFloor()`.** It is baked into the content tables themselves: `WEAPONS["Axe"].d = () => D(6)`, `CLASSES["Fighter"].gain = [null, () => D(8), ...]`, and 79 similar dice-closures across the rules-tables section (lines ~493–914). ENG-03 ("content as pure data") and ENG-02 ("seeded RNG only") are the same refactor: every embedded `() => D(n)` / `() => pick(a)` closure must become a plain dice-notation value (e.g. `{n:1, sides:6, bonus:0}`) resolved by an injected `rng.roll(notation)` call in the engine, not evaluated inside the content module.
2. **`Date.now()` appears four times** (`S.deathAt`, the graveyard `when` field, and the `AGAIN_LOCK` re-roll cooldown), all wall-clock reads with no gameplay-outcome effect but that will break any byte-for-byte "same seed + same actions → identical state" comparison unless explicitly excluded from the comparison (or replaced with a state-only "turn counter" concept — recommended: exclude, don't replace, since the value is cosmetic).
3. **The store's closures (line 3182–3184 comment) are the only intentionally-flagged non-serializable data, but they are built the same way as every other "roll now, use later" pattern in the file** (`stock.push({..., buy: () => {...}})`) — fixing this is a template for a broader pattern: anywhere the prototype captures a callback instead of a plain descriptor, the fix is "assign an id/kind + params instead, and look up the effect function by id in the engine, never store the function in `GameState`."

**Primary recommendation:** Build the test suite entirely on Node's built-in `node:test`/`node:assert` (zero installed dependencies, ships with Node 22 already on this machine) with three test tiers — (a) unit tests per extracted engine module, (b) a **standing serialize/rehydrate round-trip test** that runs after every action in a multi-action script, and (c) a **prototype-parity harness** that runs the *same* recorded action script through both the original prototype logic (sandboxed headless via Node's built-in `vm` module — no jsdom/Playwright required) and the new engine, diffing state after every action. This keeps the "zero runtime dependencies" ethos intact for both the shipped app and its test tooling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rules resolution (movement, combat, magic, economy, leveling, death) | Rules/Simulation Engine | — | Must be pure/sync/no I/O per ENG-01; already the architecture's stated engine tier |
| Content tables (classes, races, weapons, spells, creatures, epitaphs) | Content (data) | Rules/Simulation Engine (consumer) | ENG-03 requires separation; engine reads but never embeds values |
| Seeded PRNG + its serialized cursor | Rules/Simulation Engine | Game State (storage location) | RNG logic lives in `engine/rng.ts`; its numeric state is a field *inside* `GameState`, not a separate component |
| Maze/floor generation | Procedural Generation (sub-tier of Engine) | — | Pure function of `(seed, depth, rngCursor)` per ARCHITECTURE.md |
| Serialize/rehydrate (save shape validity) | Persistence (adapter) | Rules/Simulation Engine (defines the shape) | The engine owns what's serializable; persistence owns *when* to read/write it — this phase only needs the browser's existing `localStorage` adapter, kept as-is |
| Test/parity harness itself | Dev tooling (outside all shipped tiers) | — | Runs in Node at dev-time only; must never be imported by `engine/`, `presentation/`, or shipped bundle |
| Rendering/DOM/log formatting | Presentation | — | Explicitly OUT of the engine per ENG-01; stays wired to the browser prototype via a temporary adapter during extraction (per ARCHITECTURE.md build order step 3) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Node.js `node:test` | builtin (Node 22.x, confirmed installed: v22.23.2) | Test runner: `describe`/`it`/`test`, run via `node --test` | Zero install, zero dependency footprint — matches the prototype's dependency-free ethos and the project's CLAUDE.md-enforced "keep runtime deps at zero" constraint. Stable (`Stability: 2`) in current Node LTS lines. [CITED: nodejs.org/api/test.html] |
| Node.js `node:assert/strict` | builtin | Assertions: `deepStrictEqual`, `throws`, `equal` | Pairs with `node:test`; `deepStrictEqual` is exactly what a serialize/rehydrate round-trip and a parity diff need (structural equality, not reference equality) |
| mulberry32 (inlined ~10-line snippet, not an npm package) | n/a (public-domain algorithm) | Seeded PRNG for all engine randomness | Already the architecture's chosen algorithm; single 32-bit integer state trivially serializes as one field on `GameState`. Confirmed still a sound, current recommendation: both mulberry32 and the alternative sfc32 are deterministic/seedable; mulberry32's smaller single-integer state is simpler to serialize and is "equally good" quality for gameplay-scale (non-cryptographic) use — sfc32's larger 128-bit state buys marginally better statistical quality only at output volumes far beyond a single game run. [CITED: github.com/JoakimCh/pluggable-prng, cross-checked against ARCHITECTURE.md's existing mulberry32 sources] |
| Node.js `node:vm` | builtin | Sandbox to execute the **unmodified original prototype** headlessly for the parity harness (stub `document`/`localStorage`/canvas as a small hand-written context object, no DOM emulation library needed) | Avoids adding jsdom or a browser-automation dependency just for a dev-time regression harness; keeps "zero dependencies" true for tooling as well as the shipped app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:test` snapshot assertions (`t.assert.snapshot()`) | Stable as of Node v23.4.0; present but experimental-flagged on the project's installed Node 22.23.2 | Golden-master style snapshotting of an action→event trace | Optional convenience only — since the project's Node (22.23.2) predates full stabilization, prefer a hand-written JSON fixture file + `assert.deepStrictEqual` for the golden-master trace (see below) so the test suite has no dependency on an experimental Node feature; revisit once the toolchain moves to Node 23+/24+. [CITED: nodejs.org/api/test.html, github.com/nodejs/node commit fb4661a "finish marking snapshot testing as stable"] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node `vm`-sandboxed headless prototype execution | `jsdom` (devDependency, confirmed on npm registry at v30.0.1) [ASSUMED — package name from training knowledge, not authoritative docs] | jsdom gives a fuller DOM (real `Element`, CSS-ish layout stubs) so less hand-stubbing is needed, at the cost of one devDependency and slower test startup. Reasonable fallback if hand-stubbing `document`/canvas proves too fragile as the prototype's DOM surface is touched during extraction. |
| Node `vm`-sandboxed headless prototype execution | `playwright` (devDependency, confirmed on npm registry at v1.63.0) [ASSUMED — package name from training knowledge, not authoritative docs] | Drives a *real* Chromium (same engine family as the target Android WebView) clicking actual D-pad buttons — the most faithful parity check, but heaviest: a real browser download, slower per-test, and the biggest devDependency footprint of the three options. Consider for a final pre-ship confidence pass, not as the everyday fast test. |
| Hand-written JSON fixture golden-master | `node:test` built-in snapshot testing | See Supporting table above — defer until Node is upgraded past v23.4 in this project's toolchain. |
| Hand-written seeded action-script generator (reuses the same mulberry32 RNG) | `fast-check` property-based testing library [ASSUMED — package name from training knowledge] | fast-check would give more systematic input-space coverage (shrinking on failure) but is unfamiliar tooling to introduce in a zero-dependency, solo-author project just for this phase; the hand-written generator (see Validation Architecture) is sufficient and keeps the dependency count at zero. |

**Installation:**
```bash
# No installation required for the primary recommendation — node:test, node:assert,
# and node:vm are all Node.js built-ins already present (v22.23.2 confirmed on this
# machine). This phase can ship its entire test suite with zero `npm install`.
#
# If the parity harness later needs jsdom or playwright (see Alternatives Considered):
npm install --save-dev jsdom       # or:
npm install --save-dev playwright && npx playwright install chromium
```

**Version verification:** `node --version` on this machine returns `v22.23.2`, which exceeds Node's `node:test` stable baseline. `npm view playwright version` → `1.63.0`; `npm view jsdom version` → `30.0.1` (both confirmed present on the npm registry as of this research date; neither is required for the primary recommendation).

## Package Legitimacy Audit

This phase's primary recommendation installs **zero external packages** — `node:test`, `node:assert`, and `node:vm` are Node.js built-ins. No legitimacy audit is required for the shipped path.

The two devDependency alternatives mentioned above (`jsdom`, `playwright`) are **not selected** by this research and are not installed by any plan step this phase should include as written. If the planner or a future phase does choose one of them:

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| jsdom | npm (confirmed via `npm view`, v30.0.1) | Not run through `package-legitimacy check` — well-established, long-lived, high-download package, but name sourced from training knowledge this session | `[ASSUMED]` — gate any future install behind `checkpoint:human-verify` |
| playwright | npm (confirmed via `npm view`, v1.63.0) | Same as above | `[ASSUMED]` — gate any future install behind `checkpoint:human-verify` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram — Validation Data Flow

```
                         ┌───────────────────────────────┐
                         │   Fixed action-script fixtures │
                         │  (hand-authored + generated)   │
                         └───────────────┬─────────────────┘
                                          │ same script, same seed
                    ┌─────────────────────┼─────────────────────┐
                    ▼                                            ▼
      ┌─────────────────────────┐                 ┌─────────────────────────────┐
      │ ORIGINAL PROTOTYPE       │                 │ EXTRACTED ENGINE             │
      │ mazeworld.html <script>  │                 │ engine/applyAction()         │
      │ body, run inside a       │                 │ (pure, no DOM at all)        │
      │ node:vm sandbox with     │                 │                              │
      │ stubbed document/canvas/ │                 │                              │
      │ localStorage             │                 │                              │
      └────────────┬─────────────┘                 └───────────────┬──────────────┘
                    │ state snapshot after each action              │ {state, events} after each action
                    ▼                                                ▼
            ┌───────────────────────────────────────────────────────────┐
            │           PARITY DIFF (node:assert.deepStrictEqual)         │
            │  compares only gameplay-relevant fields; excludes Date.now  │
            │  timestamps (deathAt / graveyard "when" / AGAIN_LOCK)       │
            └───────────────────────────┬───────────────────────────────┘
                                          │ fail fast: first divergent action index + field
                                          ▼
                              CI/test-run pass or fail (ENG-05)

            ┌───────────────────────────────────────────────────────────┐
            │        SERIALIZE/REHYDRATE ROUND-TRIP (ENG-04, standing)    │
            │  engine.applyAction() → state → JSON.stringify → JSON.parse│
            │  → deepStrictEqual(original, rehydrated) — after EVERY     │
            │  action in the same script, not just at the end            │
            └───────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (test-relevant additions only — engine/content/presentation layout is already specified in ARCHITECTURE.md)

```
test/
├── engine/                      # unit tests per extracted module (character, maze, combat, economy, death)
│   ├── character.test.js
│   ├── maze.test.js
│   ├── combat.test.js
│   ├── economy.test.js
│   └── death.test.js
├── determinism/
│   ├── same-seed-same-result.test.js   # ENG-02: two newRun(seed) + identical action script -> identical state+events
│   ├── rng-no-math-random.test.js      # static guard: grep engine/ + content/ source, fail if Math.random found
│   └── content-is-pure-data.test.js    # ENG-03: recursive walk of content/* exports, fail if any typeof === 'function'
├── roundtrip/
│   └── serialize-rehydrate.test.js     # ENG-04: standing guardrail, runs after every action in a multi-action fixture
├── parity/
│   ├── harness/
│   │   ├── sandboxPrototype.js          # node:vm wrapper that loads mazeworld.html's <script> body headless
│   │   └── diffState.js                 # deep-equal compare, ignoring Date.now()-derived fields
│   ├── fixtures/
│   │   ├── action-script.chargen.json   # hand-authored: exercise every class/race/subclass roll path once
│   │   ├── action-script.movement.json  # exercise every tile feature (dot/trap/chest/tele/exit/climb/gorge/one-way)
│   │   ├── action-script.combat.json    # win, lose, flee, parley, spellcast
│   │   ├── action-script.economy.json   # buy every stock slot, repair armor, insufficient gold
│   │   └── action-script.generated/*.json  # seeded-RNG-generated scripts, checked into source control for reproducibility
│   └── prototype-parity.test.js
└── fixtures/
    └── generate-action-scripts.js      # standalone script: seeded generator, writes fixtures/generated/*.json (rerun only to add coverage, not on every test run)
```

### Pattern 1: Content-Table Dice-Closures → Plain Dice-Notation Data

**What:** The prototype's rules tables embed executable RNG closures directly as data values — confirmed 79 occurrences of `() => D(n)` / `() => pick(a)` patterns across the file, the majority inside `WEAPONS`, `CLASSES.gain`, and similar tables in the ~493–914 line range. `content/weapons.ts` must instead export `{ dice: { n: 1, sides: 6, bonus: 0 }, cost: 50, cls: "FTM" }` and the **engine** (not the content module) calls `rng.rollDice(weapon.dice)`.

**When to use:** During the "extract content tables first" step (ARCHITECTURE.md build order step 1) — this is the same pass, not a separate one. Attempting to do content extraction "first, with zero behavior risk" while leaving these closures in place is a false sense of completion: the closures are exactly the `Math.random()` coupling ENG-02 targets, just hidden inside what looks like a data table.

**Example:**
```javascript
// BEFORE (mazeworld.html line 519 and friends)
"Axe": { d: () => D(6), lab: "d6", cost: 50, cls: "FTM" },

// AFTER — content/weapons.js (pure data, no functions)
export const WEAPONS = {
  "Axe": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 50, cls: "FTM" },
};

// engine/dice.js — the ONLY place a dice-notation object becomes a number
export function rollDice(rng, { n, sides, bonus }) {
  let total = bonus;
  for (let i = 0; i < n; i++) total += rng.d(sides);
  return total;
}
```

### Pattern 2: Global `S` Mutation → Explicit `state` Parameter + Draft Clone

**What:** Every rule function today reads/writes the module-global `let S = null` directly (`S.c.wp -= dmg`, `S.floor.px = nx`, etc.). The engine boundary requires each rule function to instead receive `state` as a parameter and mutate a local draft, never a shared global. The cheapest correct approach (matches ARCHITECTURE.md's own `engine.ts` example) is: `applyAction` calls `structuredClone(state)` once at the top to produce `next`, passes `next` down into the ported rule functions (renamed to accept `(next, action, rng, events)` instead of closing over `S`), and returns `{ state: next, events }`. `structuredClone` is a Node/browser built-in (no library needed) and correctly deep-clones plain data (arrays, plain objects, numbers, strings, null) — exactly the shape `S.c`/`S.floor` already have once the store-closure and content-closure fixes land.

**When to use:** During the slice-by-slice conversion (build order step 3–4), one rule function group at a time (movement, then combat, then economy, then chargen, then death) — this mirrors the locked extraction order.

**Trade-offs:** `structuredClone` throws on functions, and on values that don't support the structured clone algorithm — which is a *feature* here: if a not-yet-converted closure (leftover dice-closure or `S.store` callback) sneaks into the state being cloned, `structuredClone` throws immediately at test time rather than silently producing a broken clone. Use this fail-fast behavior as an early-warning signal during extraction, not just in the final round-trip test.

### Pattern 3: Callback-Bearing Descriptors → Id + Lookup-Table Descriptors

**What:** `S.store` (`stock.push({ n, cost, buy: () => {...} })`) is the one the prototype's own comment already flags as non-serializable, but the fix generalizes: replace `{ ...fields, buy: () => sideEffect() }` with `{ ...fields, effectId: "repair-armor", effectParams: { pts } }`, and move the actual `sideEffect()` implementations into an engine-side lookup table (`STORE_EFFECTS = { "repair-armor": (state, params) => {...}, ... }`) keyed by `effectId`. The stock array itself becomes 100% plain JSON.

**When to use:** Wherever the prototype captures a closure "to run later" — confirmed instances: `S.store.stock[i].buy` (line ~2001–2036), and none of the other systems checked (potions, traps, encounters) hold live closures in state — they call functions immediately rather than storing them, so this pattern is narrower in scope than the dice-closure fix (Pattern 1), but is the one explicitly called out in both `CONTEXT.md` and `ARCHITECTURE.md` as the anti-pattern to eliminate.

**Example:**
```javascript
// BEFORE (mazeworld.html ~line 2001-2036)
const add = (n, cost, buy, sub) => stock.push({ n, sub, cost, buy });
add(`${f.n} (+${f.wp} wp)`, f.cost, () => { S.c.wp = Math.min(S.c.maxWP, S.c.wp + f.wp); S.c.rations++; });

// AFTER — engine/economy.js
const STORE_EFFECTS = {
  eatRation: (state, { wp }) => { state.c.wp = Math.min(state.c.maxWP, state.c.wp + wp); state.c.rations++; },
  repairArmor: (state, { pts }) => { state.c.armorWP = state.c.armorMax; },
  // ... one entry per distinct effect
};
// stock entries are now: { n, sub, cost, effectId: "eatRation", effectParams: { wp: f.wp } }
// buyFrom(state, idx) looks up STORE_EFFECTS[stock[idx].effectId](state, stock[idx].effectParams)
```

### Pattern 4: `act()`/"beats" Narration Capture → Structured Events + Presentation-Side Regrouping

**What:** `act(fn)` (lines 1408–1430) wraps a turn, runs the rule function while capturing raw HTML strings pushed via `logLine`/`say`/`evt` into `S.beats` groups, then calls `renderEncounter()`. This is the prototype's existing embryonic event system, but it captures **markup strings**, not structured data. The engine-side replacement: rule functions push plain `{type, ...fields}` event objects into an `events` array (no HTML, no narration text); a **new presentation-side function** (ported from `act()`'s grouping logic, living in `presentation/render/log.ts` per ARCHITECTURE.md) consumes the returned `events` array and re-creates the same "beat card" grouping + HTML narration the UI shows today. The grouping/stepping behavior (`newBeat`, `beginEvent`, the phone-vs-wide-screen stepping in `stepping()`) is a **presentation** concern and ports unchanged in spirit — only its *input* changes from "captured raw HTML lines" to "structured events it formats into HTML."

**When to use:** This is the mechanism that makes ENG-01's "no rendering inside the engine" concretely achievable for this specific prototype's move/combat functions, which today call `say()`/`evt()` inline dozens of times per function body.

### Anti-Patterns to Avoid

- **Leaving a module-global `S` "for convenience" and wrapping it with a thin `applyAction` shim:** `function applyAction(state, action) { S = state; ...call old functions...; return { state: S, events: [] }; }` technically satisfies the function signature but defeats purity, testability without global reset, and multiplayer-readiness (two concurrent games would corrupt each other's `S`). The global must be eliminated, not hidden.
- **Comparing prototype-vs-engine parity output including `Date.now()`-derived fields:** `S.deathAt`, the graveyard `when` field, and the `AGAIN_LOCK` cooldown timer will legitimately differ by milliseconds between two runs even with identical seeds/actions, because they read the wall clock. Exclude these three fields from every `deepStrictEqual` parity/round-trip comparison (or replace their sources with an injected clock stub in test mode) — don't let a flaky, unrelated field make the entire regression harness untrustworthy.
- **Trusting object key order as a nondeterminism risk (a common but outdated worry):** modern V8 (and therefore Node and the target Android WebView) guarantees enumeration order for own-enumerable string keys as insertion order (integer-like keys are enumerated in ascending numeric order first, per spec) — this has been true since ES2015 and is not an actual source of flakiness for `JSON.stringify`. The *real* risks are `Map`/`Set` iteration order (deterministic only if insertion order is itself deterministic) and `Date.now()`/ambient I/O — focus verification effort there, not on plain-object key order.
- **Adding a real dependency (jsdom/Playwright) before trying the zero-dependency `node:vm` sandbox:** given this project's explicit zero-runtime-dependency ethos (CLAUDE.md, PROJECT.md), and that the prototype's DOM surface is small (a handful of `getElementById`, `addEventListener`, and a 2D canvas context), a hand-written stub object is very likely sufficient and keeps the test suite dependency-free. Reach for jsdom/Playwright only if the stub proves too fragile in practice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Seeded PRNG algorithm | A custom LCG/xorshift from scratch | mulberry32 (already chosen; ~10-line well-known public-domain snippet, not an npm install) | Getting PRNG bit-mixing subtly wrong produces visible statistical artifacts (repeating patterns, correlated rolls) that are hard to detect without dedicated statistical test suites (PractRand etc.) — reuse the already-vetted, already-decided algorithm rather than inventing a new one |
| Deep-clone for the `state` draft | A hand-rolled recursive clone function | `structuredClone` (Node/browser built-in since Node 17 / all evergreen browsers) | Handles arrays, nested objects, `Date`, `Map`, `Set`, typed arrays correctly and throws predictably on functions/DOM nodes — exactly the fail-fast behavior wanted during extraction (see Pattern 2) |
| Deep-equality diffing for round-trip/parity tests | A custom recursive `isEqual` | `node:assert.deepStrictEqual` (built-in) | Already handles key-order-independent structural comparison, `NaN`, `-0` vs `0`, and gives readable diff output on failure — a hand-rolled version would need to reinvent all of this to be trustworthy |
| Headless execution of the original DOM-coupled prototype | A hand-parsed mini-DOM or regex-based script extractor with ad hoc globals | Node's built-in `vm.createContext()` + a small, explicit stub object (`document.getElementById` returning a fake element with a no-op `.addEventListener`/`.getContext`, `localStorage` backed by a plain in-memory `Map`) | `vm` is a real, supported Node API for exactly this kind of sandboxed execution; a hand-parsed extractor is fragile against any future syntax change in the prototype and duplicates effort `vm` already solves |

**Key insight:** every "don't hand-roll" item above already has a Node.js **built-in** solution — this phase does not need to weigh third-party libraries against each other, it needs to correctly use what Node already ships, in keeping with the project's zero-dependency identity.

## Runtime State Inventory

> Rename/refactor phase — all 5 categories addressed explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Two `localStorage` keys already exist and will keep existing during this phase's browser dev-loop: `mazeworld.delve.v1` (active run — currently `{c, floor, day, steps, dead, won, deathNote, epitaph}`) and `mazeworld.graveyard.v1` (append-only array, capped at 60 entries). The new `GameState` shape adds fields the old save doesn't have (`seed`, `rngState`, and whatever replaces `S.store`'s closures). | **Code edit, not data migration** — `load()` must apply safe defaults for missing new fields (`o.seed ?? <derive from Date.now() once, on first load only>`, `o.rngState ?? <fresh mulberry32 state>`) rather than rejecting old saves outright, so a developer's existing local save keeps working through the refactor. No production users exist yet (nothing shipped), so a full wipe-and-restart fallback is also acceptable if simpler — CONTEXT.md does not mandate save compatibility during this internal refactor phase, only that save/resume itself keeps working going forward. |
| Live service config | None — the project has no external services, dashboards, or UI-configured backends of any kind (fully offline, no accounts, no CI-hosted config). | None — verified by reading PROJECT.md constraints (fully offline, no backend) and finding no `fetch`/`WebSocket`/service references anywhere in `mazeworld.html` (confirmed during the earlier stack research pass — zero network calls in the file). |
| OS-registered state | None — this is a browser page, not a background service; no Windows Task Scheduler entries, no pm2/launchd/systemd units reference it. | None. |
| Secrets/env vars | None — `mazeworld.html` and the planning docs contain no API keys, tokens, or environment-variable reads of any kind. | None. |
| Build artifacts | None yet — the repo currently has no `package.json`, `node_modules`, or build output; `mazeworld.html` is hand-authored and requires no build step. This phase is the **first** to add a `package.json` (for `"type": "module"` and a `"test"` script pointing at `node --test`). | **Code edit (creation)** — add a minimal `package.json` with zero `"dependencies"` and either zero or the discretionary `jsdom`/`playwright` under `"devDependencies"` only if that alternative is chosen. Nothing to "go stale" yet since nothing has been installed before. |

## Common Pitfalls

### Pitfall 1: Comparing Full State Trees Including Wall-Clock Fields

**What goes wrong:** A round-trip or parity test does `assert.deepStrictEqual(before, after)` on the entire state object and intermittently fails for no code-related reason.
**Why it happens:** `S.deathAt`, `graves[].when`, and the `AGAIN_LOCK` cooldown check all read `Date.now()`. Two invocations microseconds apart get different values.
**How to avoid:** Write a small `stripVolatileFields(state)` helper used by every determinism/parity/round-trip test before comparison, explicitly listing the wall-clock fields to omit (start with the three found this session; grep for `Date.now` again if new ones are added later).
**Warning signs:** A test that passes most runs but fails roughly 1-in-N with a diff isolated to a timestamp-shaped field.

### Pitfall 2: Content-Table Dice-Closures Surviving the "Content Extraction" Step Undetected

**What goes wrong:** Someone extracts `WEAPONS`/`CLASSES`/etc. into `content/*.js` files, calls step 1 done, and moves on to the RNG-threading step — but the closures (`d: () => D(6)`) got copy-pasted as-is into the new files, so `content/` still calls the global `D()`/`Math.random()` internally.
**Why it happens:** The closures look like ordinary data at a glance (`{ d: fn, lab: "d6", cost: 50 }` reads like a data row), and the file still "works" after the copy-paste, so nothing visibly breaks.
**How to avoid:** The `content-is-pure-data.test.js` fixture (Validation Architecture, ENG-03 row) — a generic recursive walker that asserts `typeof value !== 'function'` for every leaf in every `content/*.js` export — catches this mechanically instead of relying on manual review. Run it as the very first test written, before any other engine work starts, so it's a red flag immediately rather than discovered during the RNG-threading step.
**Warning signs:** `grep -rn "() =>" content/` returning any matches.

### Pitfall 3: `structuredClone` Throwing Mid-Extraction (this is actually useful — don't suppress it)

**What goes wrong:** Once `applyAction` starts calling `structuredClone(state)`, extraction work that hasn't yet removed a closure (leftover `S.store.stock[i].buy` or an unconverted dice-closure reached via some rarely-exercised code path) will throw `DataCloneError`. The instinct is to wrap the clone in a `try/catch` and fall back to a shallow copy "to keep things running."
**Why it happens:** Extraction is being done slice-by-slice; not every closure is gone on day one, and a throw feels like it's blocking progress.
**How to avoid:** Treat the throw as a to-do list, not a bug to route around. If a slice isn't ready yet, keep the not-yet-extracted portion of that turn running through the *old* code path (per ARCHITECTURE.md's "temporary adapter" step) rather than loosening the clone's strictness — loosening it here is exactly how a closure would silently sneak past ENG-04's round-trip guarantee later.
**Warning signs:** A `try/catch` wrapping `structuredClone` anywhere in `engine/`.

### Pitfall 4: Iteration-Order-Sensitive Refactors When Converting Arrays to `Map`/`Set`

**What goes wrong:** A rule function that iterates `S.combat.foes` (a plain array, so order = insertion order = deterministic) gets refactored during extraction to use a `Set` (e.g., "for uniqueness") or a `Map` keyed by foe id "for lookup speed" — and a rare multi-foe combat outcome (which foe gets hit first when several take damage in a `for` loop) changes.
**Why it happens:** `Map`/`Set` iterate in insertion order too, so this usually doesn't matter — but if the refactor also changes *how* entries get inserted (e.g., building the Map from `Object.values()` of something that wasn't itself insertion-ordered, or merging two collections), insertion order can shift silently.
**How to avoid:** Keep `foes` and similar sequences as plain arrays through this phase — there's no correctness or performance reason to introduce `Map`/`Set` for the state shapes this prototype already has, and the parity harness (which replays real combats) will catch an order change if one slips in, but only if it's specifically looking for divergence in *which* foe acted vs merely rolling correct random numbers.
**Warning signs:** A new `Map`/`Set` appears inside `engine/` state or combat-resolution code where the prototype used a plain array.

## Code Examples

### mulberry32 with GameState-embedded state (from ARCHITECTURE.md, reproduced here for the RNG test suite's reference implementation)
```javascript
// engine/rng.js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return {
    // returns a float in [0, 1)
    next() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() { return a; },       // persist this single integer in GameState.rngState
    setState(s) { a = s >>> 0; },   // rehydrate: setState(savedState) — no re-seeding/fast-forwarding needed
  };
}
// D(n) replacement: 1 + Math.floor(rng.next() * n)
// pick(arr) replacement: arr[Math.floor(rng.next() * arr.length)]
```
*Source: ARCHITECTURE.md Pattern 2, adapted here to persist the raw internal state directly (the doc's own "OR, simpler; do this" option) rather than re-seeding + fast-forwarding, which avoids needing to track a separate `rngCalls` counter at all.*

### Standing serialize/rehydrate round-trip test shape (ENG-04)
```javascript
// test/roundtrip/serialize-rehydrate.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { newRun, applyAction } from "../../engine/engine.js";
import actionScript from "../parity/fixtures/action-script.movement.json" with { type: "json" };

test("serialize/rehydrate round-trip holds after every action", () => {
  let state = newRun(12345);
  for (const action of actionScript) {
    const result = applyAction(state, action);
    state = result.state;
    const rehydrated = JSON.parse(JSON.stringify(state));
    assert.deepStrictEqual(rehydrated, state, `round-trip mismatch after action ${JSON.stringify(action)}`);
  }
});
```

### Node `vm`-sandboxed headless prototype execution sketch (for the parity harness — no jsdom/Playwright)
```javascript
// test/parity/harness/sandboxPrototype.js
import vm from "node:vm";
import fs from "node:fs";

export function loadPrototypeSandbox(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const scriptBody = html.match(/<script>([\s\S]*?)<\/script>/)[1]; // extract inline <script> body

  const fakeStorage = new Map();
  const fakeElement = { addEventListener() {}, appendChild() {}, getContext: () => fakeCanvasCtx, style: {}, dataset: {}, children: [], classList: { add() {}, remove() {} } };
  const fakeCanvasCtx = { fillRect() {}, fillText() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {} };

  const sandbox = {
    document: {
      getElementById: () => fakeElement,
      createElement: () => fakeElement,
      addEventListener() {},
    },
    localStorage: {
      getItem: k => fakeStorage.get(k) ?? null,
      setItem: (k, v) => fakeStorage.set(k, v),
      removeItem: k => fakeStorage.delete(k),
    },
    addEventListener() {},
    console,
    Math,               // real Math — the parity test controls determinism by monkey-patching Math.random below
    window: undefined,  // set to `sandbox` itself after context creation if the script references `window.`
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(scriptBody, context);
  return context; // exposes whatever the prototype's top-level `function`s left in global scope: move(), newGame(), etc.
}
```
*This is a reasoned engineering pattern for this specific file, not verified against an official Node.js recipe — tag confidence LOW/ASSUMED and expect to iterate on the stub surface as extraction touches more of the DOM-facing code. Start minimal; add stub methods only when the sandbox throws on a missing one.*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `Math.random()` called directly throughout rules code | Injected seeded PRNG (mulberry32-class) whose state lives in serializable game state | Always been best practice for reproducible simulations; not a recent change, but newly relevant here because the prototype never needed it (single-session browser toy, no save-verification requirement) | Enables ENG-02, deterministic replay, and (later) verifiable local high scores |
| `node:test` snapshot testing | Stable as of Node v23.4.0 (was experimental since ~v22.3.0) | Recent (2026) | On this project's installed Node 22.23.2, treat snapshot assertions as still experimental; prefer explicit JSON fixture + `deepStrictEqual` for the golden-master trace until the toolchain is upgraded |

**Deprecated/outdated:**
- Nothing in this phase's stack is deprecated — Node's built-in test runner, `structuredClone`, and `vm` are all current, actively maintained APIs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `jsdom` is a legitimate, currently-published npm package at v30.0.1 | Standard Stack / Alternatives Considered | Low — presented only as an optional fallback, not the primary recommendation; `npm view` confirmed the package exists and returns a version, but the name itself came from training knowledge this session, not an authoritative doc lookup, per the package-name provenance rule |
| A2 | `playwright` is a legitimate, currently-published npm package at v1.63.0 | Standard Stack / Alternatives Considered | Low — same reasoning as A1; also only an optional fallback |
| A3 | `fast-check` exists as a property-based testing library for JS | Alternatives Considered | Very low — mentioned only in passing as a non-recommended alternative, not verified via `npm view` this session |
| A4 | The `node:vm`-based headless-sandbox pattern for running the unmodified prototype will work with a *minimal* stub surface (no deeper DOM emulation needed) | Code Examples, Pattern discussion | Medium — if the prototype's DOM usage turns out to be broader/subtler than the spot-checks performed this session (e.g., relies on CSS layout values, `matchMedia`, or canvas measurement APIs the stub doesn't cover), the harness may need more stub methods or a fallback to jsdom/Playwright. The `stepping()` function's `window.matchMedia` call (line ~1403) is one concrete stub the sandbox will need to add early. |
| A5 | Excluding `Date.now()`-derived fields from parity/round-trip comparisons (rather than injecting a fake clock) is sufficient and won't hide a real regression | Common Pitfalls, Anti-Patterns | Low — these three fields (`deathAt`, graveyard `when`, `AGAIN_LOCK` cooldown) are confirmed by direct code read to have no effect on gameplay *outcomes* (they gate a UI cooldown and record metadata), so excluding them from equality checks cannot mask a rules-behavior regression |

## Open Questions

1. **Should the "same seed + same actions → identical state" test also assert identical `events` arrays, or only identical final `state`?**
   - What we know: `events` will carry structured data the old prototype's raw HTML strings didn't have (this is new surface area, not a port of existing behavior).
   - What's unclear: whether the planner wants event-shape locked down this early (risk: churn as presentation needs become clearer in Phase 4) or left flexible with only `state` asserted for now.
   - Recommendation: assert `state` strictly (this is the actual determinism requirement, ENG-02/ENG-04); assert `events` loosely for now (e.g., same `type` sequence, not full field equality) so the event schema can still evolve without breaking the standing test suite, then tighten once Phase 4/5 stabilize event consumers.

2. **How much of the 3,300-line file should the first prototype-parity fixture scripts try to cover before moving on to the slice-by-slice engine work?**
   - What we know: full coverage of every class/race/subclass/spell/creature/trap/affliction combination is a combinatorially large space; the CONTEXT.md's own extraction order says content and RNG come before the parity harness is "built" (step 4), implying the harness doesn't need to be complete before extraction starts.
   - What's unclear: the minimum fixture set that gives useful regression signal per slice (movement fixtures before the movement slice is extracted, combat fixtures before the combat slice, etc.) vs. one big fixture set built once at the end.
   - Recommendation: build fixtures incrementally, matching the locked extraction order — a small movement fixture before slicing `move()`, a combat fixture before slicing `foeTurn()`/`playerStrike()`, etc. — so parity checking starts giving signal on slice 1, not only after all slices are done.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Test runner (`node:test`), `structuredClone`, `vm` | ✓ | v22.23.2 | — |
| npm | Would only be needed if `jsdom`/`playwright` alternative is chosen | ✓ (ships with Node) | — | — |
| A real browser (manual, for the dev loop) | Playing `mazeworld.html` by hand during extraction to confirm it "keeps running" per CONTEXT.md | Not probed (author-operated, not an automated dependency) | — | N/A — this is a manual verification step, not something the test suite depends on |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the primary recommendation uses only what's already installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` (Node v22.23.2 installed) |
| Config file | none — no config file needed for `node --test`; a `package.json` `"scripts": {"test": "node --test"}` entry is the only setup required |
| Quick run command | `node --test test/engine test/determinism test/roundtrip` (skips the heavier parity suite) |
| Full suite command | `node --test` (runs everything under `test/`, including the parity harness) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| ENG-01 | `engine/` module loads and `applyAction` runs in a plain Node context with zero DOM globals defined (no `document`/`window`/`localStorage` referenced anywhere in `engine/`) | unit + static guard | `node --test test/engine && node test/determinism/no-dom-refs.check.js` | ❌ Wave 0 |
| ENG-02 | Same seed + same action script → byte-identical resulting `state` (stripped of wall-clock fields) across two independent `newRun(seed)` invocations; zero `Math.random()` references anywhere in `engine/`+`content/` source | unit + static guard | `node --test test/determinism/same-seed-same-result.test.js test/determinism/rng-no-math-random.test.js` | ❌ Wave 0 |
| ENG-03 | Every exported value in `content/*.js` is plain JSON-serializable data — no function-typed leaves anywhere in the object graph | unit | `node --test test/determinism/content-is-pure-data.test.js` | ❌ Wave 0 |
| ENG-04 | `state` survives `JSON.stringify` → `JSON.parse` with `assert.deepStrictEqual` equality, checked after **every** action in a multi-action fixture script, not just at the end | unit (standing guardrail) | `node --test test/roundtrip/serialize-rehydrate.test.js` | ❌ Wave 0 |
| ENG-05 | Original prototype (sandboxed via `node:vm`) and extracted engine produce matching state (stripped of wall-clock fields) after every action in each fixture script, across chargen/movement/combat/economy scenarios | integration (parity harness) | `node --test test/parity/prototype-parity.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit (each extraction slice):** `node --test test/engine test/determinism test/roundtrip` — fast, no sandboxed-prototype overhead, run after every slice (movement, then combat, then economy, then chargen, then death).
- **Per wave merge:** full suite including `test/parity/prototype-parity.test.js` — this is the "no regressions" check and should gate merging any slice into the branch the browser prototype's adapter depends on.
- **Phase gate:** full suite green, including parity harness across all fixture scripts (chargen, movement, combat, economy) and the round-trip test, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/determinism/rng-no-math-random.test.js` — static source-scan guard (no framework install needed; reads files with `node:fs`, regex-checks for `Math.random`)
- [ ] `test/determinism/content-is-pure-data.test.js` — recursive content-table type-walker
- [ ] `test/determinism/same-seed-same-result.test.js` — two-seed determinism check
- [ ] `test/roundtrip/serialize-rehydrate.test.js` — standing guardrail (build this before any engine slice work, per CONTEXT.md's emphasis that it must be a guardrail from early on)
- [ ] `test/parity/harness/sandboxPrototype.js` — `node:vm` stub harness (build incrementally per Open Question 2 — minimal stub surface first, add stub methods as the sandbox throws on missing ones)
- [ ] `test/parity/fixtures/*.json` — hand-authored action scripts, one per rule area, added incrementally alongside each extraction slice
- [ ] `package.json` — does not exist yet; needs creation with `"type": "module"` and `"scripts": {"test": "node --test"}`, zero required dependencies

## Security Domain

`security_enforcement` is enabled (`security_asvs_level: 1`) in this project's config. Given the app is fully offline with no accounts, no network, and no server, most ASVS categories are not applicable to this phase; the two that are relevant concern local data integrity, not authentication/authorization.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No accounts/logins exist or are planned for v1 |
| V3 Session Management | No | No sessions — single local device, single local player |
| V4 Access Control | No | No multi-user access boundaries in this offline single-player app |
| V5 Input Validation | Yes | The engine's `applyAction` must validate the `action` shape (unknown `type`, out-of-range `dir`, malformed `targetIdx`) and reject/no-op rather than throw or corrupt state — this matters even offline because a corrupted/malformed `action` could come from a bug in the presentation layer, not just an attacker; validate defensively at the one chokepoint (`applyAction`) rather than trusting every caller |
| V6 Cryptography | No | Nothing in this phase requires cryptographic operations — the PRNG (mulberry32) is explicitly non-cryptographic and must never be used for anything security-sensitive (it isn't, here — it's gameplay-only) |
| V12 Files and Resources (adapted: local storage integrity) | Yes | `load()`'s existing shape-check (`if (!o || !o.c || !o.floor) return null`) is the right instinct; extend it during this phase's serialize/rehydrate work so a malformed/edited `localStorage` value (a player using devtools to tamper with their own save) fails closed (falls back to `newGame()`) rather than throwing an unhandled exception mid-load |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Player edits their own `localStorage` save via devtools (self-tampering, not a multi-user attack) | Tampering | Defensive shape/type validation on `load()` before trusting any field into `GameState`; this is a low-severity concern (only affects the tamperer's own single-player score) but a *robustness* concern regardless — a malformed save should never crash the app |
| Malformed/unexpected `action` object reaching `applyAction` (e.g., a future multiplayer message, or a presentation-layer bug) | Tampering / Denial of Service (local crash) | Validate `action.type` against the known `Action` union and known field shapes at the single `applyAction` entry point; reject unknown actions as no-ops rather than throwing |

## Sources

### Primary (HIGH confidence)
- `C:\projects\mazeworld\mazeworld.html` — direct code read this session: `Math.random()` call sites (lines 489–490, 1190–1191, 1265 — confirmed only 3 *direct* Math.random call sites outside content tables, plus 79 `() => D(n)`/`() => pick(a)` closures embedded in content tables), `S.store` closure comment (lines 3182–3184), `save()`/`load()` (3182–3196), `act()`/beats system (1391–1441), `move()` (1618–1715), `foeTurn()` (2831–2896), `die()`/`bury()`/graveyard (2914–2960), `openStore()`/`buyFrom()` (1998–2055), `Date.now()` call sites (1860, 2917, 2956, 3010), content tables start at line 493 (`STRIKE_DICE`/`CLASSES`/`WEAPONS`).
- `.planning/research/ARCHITECTURE.md` — the locked architecture this research builds on; not re-derived, only extended with testing-specific findings.
- `node --version` on this machine → `v22.23.2` — directly verified, not assumed.

### Secondary (MEDIUM confidence)
- [Node.js Test runner docs](https://nodejs.org/api/test.html) — `node:test` stability and snapshot-testing status.
- [nodejs/node commit fb4661a — "test_runner: finish marking snapshot testing as stable"](https://github.com/nodejs/node/commit/fb4661a4cf) — confirms stabilization landed at v23.4.0.
- [pluggable-prng (GitHub)](https://github.com/JoakimCh/pluggable-prng) and [Mulberry32: A Tiny, Fast, Deterministic RNG](https://www.4rknova.com/blog/2026/03/01/mulberry32-rng) — mulberry32 vs. sfc32 comparison, cross-checked against ARCHITECTURE.md's own mulberry32 citations.
- [Characterization test / Golden Master (Wikipedia)](https://en.wikipedia.org/wiki/Characterization_test) and [Testing a deterministic browser game: seeds, replay and invalid state (dev.to)](https://dev.to/yulingg_zhang_dfbce7a345a/testing-a-deterministic-browser-game-seeds-replay-and-invalid-state-12ob) — golden-master pattern and JS-specific nondeterminism sources (Date, Math.random, iteration order, ambient I/O).
- `npm view playwright version` → `1.63.0`, `npm view jsdom version` → `30.0.1` — registry existence confirmed directly this session, though the package names themselves are tagged `[ASSUMED]` per the provenance rule (sourced from training knowledge, not an authoritative doc lookup).

### Tertiary (LOW confidence)
- The `node:vm`-sandbox stub-surface sketch in Code Examples — a reasoned engineering pattern for this specific file, not verified against an official Node.js recipe or a similar public example; expect iteration (see Assumption A4).

## Metadata

**Confidence breakdown:**
- Standard stack (node:test/node:assert/node:vm/mulberry32/structuredClone): HIGH — all built-ins, direct version-check on this machine, cross-checked stability claims
- Architecture/extraction mechanics: HIGH — derived directly from reading the actual prototype's line-level code, not general pattern knowledge
- Pitfalls: HIGH for the four documented here (all confirmed via direct code inspection: Date.now() sites, content-table closures, S.store closures) — MEDIUM for how well a `node:vm` sandbox will hold up against the full DOM surface until actually attempted

**Research date:** 2026-09-07
**Valid until:** 30 days (stable domain — Node built-ins and this specific prototype's code don't change on their own; re-verify only if the prototype file itself changes before planning starts)

---
*Research for: Phase 1 — Engine Extraction & Determinism (Mazeworld)*
*Researched: 2026-09-07*
