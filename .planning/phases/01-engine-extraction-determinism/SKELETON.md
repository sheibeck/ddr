# Walking Skeleton — Mazeworld Engine

**Phase:** 1
**Generated:** 2026-09-07

> **Adapted skeleton.** Mazeworld is a *behavior-preserving extraction* of a finished
> ~3,300-line vanilla-JS game (`mazeworld.html`), not a greenfield web app. There is no
> database, HTTP server, routing, auth, or web deploy to stand up. The "walking skeleton"
> here is the **thinnest end-to-end proof the new architecture works**: a seeded run's
> state flows through one `applyAction(state, action) → {state, events}` call, survives a
> serialize/rehydrate round-trip, matches the original prototype byte-for-byte (parity),
> and renders back in the browser prototype. The template's DB / routing / deploy rows are
> replaced with engine-pipeline rows below.

## Capability Proven End-to-End

A seeded run (`newRun(seed)` → a fully dice-rolled character standing on a generated
floor) can take a **move** action through `applyAction`, produce a new `{state, events}`
with **no `Math.random()` and no DOM/storage inside the engine**, have that state
**serialize→rehydrate losslessly**, **match the pristine prototype** for the same seed +
action script (parity), and **render in the browser** via a thin adapter — proving
character-state → action → new-state → render works across the full new stack.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language / modules | Plain ES modules (`"type": "module"`), no build step, no TypeScript | Matches the prototype's zero-dependency, no-build ethos (CLAUDE.md); ships identically to browser and Node |
| Runtime dependencies | **Zero** | Hard constraint (CLAUDE.md, PROJECT.md); the shipped engine imports nothing external |
| Test tooling | Node 22 built-ins only: `node:test`, `node:assert/strict`, `node:vm` | Zero-install; `node --test`; v22.23.2 confirmed. No jest/vitest/jsdom/playwright |
| Engine contract | `applyAction(state, action) → {state, events}`; pure, sync, no DOM/canvas/`localStorage`/`console` | Locked by PROJECT.md + `research/ARCHITECTURE.md`; the multiplayer-ready seam |
| State draft | `structuredClone(state)` once at the top of `applyAction`, mutate the clone | Built-in; throws fail-fast on any stray closure (a feature, not a bug) |
| Randomness | Injected mulberry32 PRNG; raw 32-bit state stored in `GameState.rngState`; `d/pick/shuffle/rollDice` are engine-internal | Deterministic, single-integer serializable cursor; replaces `D()`/`pick()`/`shuffle()`/`Math.random()` |
| Content | Pure-data modules under `content/`; dice become `{n,sides,bonus}` notation the engine rolls | ENG-03 + ENG-02 are one pass — the prototype's 79 `()=>D(n)` closures are the RNG coupling hidden as data |
| Non-serializable data | Eliminated: `S.store` closures → `{effectId, effectParams}` + engine-side lookup table | ENG-04; anything not JSON-plain is a save/resume + multiplayer bug |
| Directory layout | `engine/` (rules), `content/` (data), `test/` (unit/determinism/roundtrip/parity), browser adapter alongside `mazeworld.html` | Mirrors `research/ARCHITECTURE.md`; `engine/` imports nothing from presentation/persistence |
| Parity strategy | Golden-master: pristine prototype `<script>` frozen as a fixture, run headless in `node:vm` with a seeded `Math.random`, diffed against the engine after every action (wall-clock fields stripped) | ENG-05; forces a faithful port including RNG-consumption order |
| Determinism scope | 4 `Date.now()` sites (`S.deathAt`, graveyard `when`, `AGAIN_LOCK`) are cosmetic — **excluded** from every determinism/parity/round-trip diff, not replaced | They have no gameplay-outcome effect; excluding them keeps the harness trustworthy |

## Stack Touched in Phase 1 (engine-pipeline substitution for DB/routing/deploy)

- [ ] Project scaffold — `package.json` (`"type":"module"`, `"test":"node --test"`, zero deps) + `engine/`/`content/`/`test/` tree + `node --test` runs green
- [ ] Seeded RNG — mulberry32 with serializable cursor; one real deterministic sequence, `getState/setState` round-trips
- [ ] Content-as-data — at least one real content module is pure JSON (dice → notation), guarded by the content-purity walker
- [ ] Engine pipeline — one real `applyAction(state, {type:"move",...})` call returns `{state, events}` from a `newRun(seed)` state, with the engine-purity guard green
- [ ] Serialize/rehydrate — `JSON.parse(JSON.stringify(state))` `deepStrictEqual` after every action of the movement fixture (standing guardrail)
- [ ] Parity — pristine prototype (frozen, `node:vm`) vs. engine agree on the movement action script (wall-clock fields stripped)
- [ ] Browser render — a thin adapter in `mazeworld.html` routes a move through `engine.applyAction`, swaps state, formats events → existing `logLine`, and calls `paint()`/`draw()` (playable dev loop; manual confirm deferred to milestone UAT)

## Out of Scope (Deferred to Later Slices / Phases)

- Endless descent, difficulty curve, removing the 5-floor Gate — **Phase 3** (this phase keeps fixed 5-floor behavior intact behind the new contract)
- Capacitor / Android packaging, native `Preferences` storage, versioned durable save — **Phase 2** (save stays browser `localStorage` in the dev loop here)
- Mobile touch controls, DPI/safe-area rendering, character sheet/log screens, tutorial — **Phase 4**
- Data-driven voice/epitaph *generation system* and tone QA — **Phase 5** (epitaph **tables** are extracted as data here; the generator is later)
- Full presentation rewrite (`presentation/render/log.ts`), replacing the temporary browser adapter — later; this phase keeps the prototype's rendering and only reroutes rules through the engine
- Restored tabletop systems (bags, shields, thrown weapons) — v2 backlog

## Subsequent Slice Plan (within Phase 1, on top of this skeleton)

Each later plan adds one rule domain as a vertical slice, keeping the round-trip and
parity harnesses green, without changing the architectural decisions above:

- 01-05: Engine core + character generation, derived numbers & leveling
- 01-06: Items, treasure & death/graveyard helpers + save-integrity load validation
- 01-07: **Movement slice + round-trip guardrail + browser adapter** (this skeleton's proof)
- 01-08: Combat slice
- 01-09: Magic, potions & scrolls slice
- 01-10: Economy/store (closures → data) + encounters/traps/chests + full-suite parity/round-trip green

Later *phases* then build on the frozen `engine/` boundary: Phase 2 wraps it in Capacitor
and swaps the storage adapter; Phase 3 adds `difficulty.ts` and removes the Gate; Phase 5
adds the voice/log formatter that consumes the structured `events` this phase introduces.
