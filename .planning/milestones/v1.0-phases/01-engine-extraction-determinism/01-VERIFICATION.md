---
phase: 01-engine-extraction-determinism
verified: 2026-09-08T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open mazeworld.html in a real browser and play a full run: create a character, walk several floors, fight, cast spells, visit the store, hit a trap/chest, and either die or reach the floor-5 Gate."
    expected: "The game behaves identically to the pre-Phase-1 prototype from the player's perspective — no visual breakage, no thrown errors in the console, combat/economy/traps narrate correctly in the log."
    why_human: "This is the single manual 'playable-in-browser' check explicitly deferred to end-of-milestone UAT per the phase's own 01-VALIDATION.md and the autonomous run's UAT-deferral policy. Automated coverage (below) proves the engine's behavior is correct via a golden-master diff against the frozen prototype run headlessly in node:vm, but does not click real buttons in a real browser."
  - test: "In the browser, walk onto a trap tile, a chest tile, and a wandering-encounter tile (using the now-engine-backed move action), and separately trigger a fight/store visit via the original UI buttons."
    expected: "Trap/chest/encounter narration appears in the log the same way it did in the original prototype, and combat/store interactions (still running on the pre-extraction code path) behave correctly against the engine-shaped state object movement now writes into `S`."
    why_human: "Two real, code-confirmed facts create a live-browser risk that only manual play can rule out: (1) `src/browser/engineAdapter.js`'s `formatEvents()` (last touched in 01-07) has no case for any of the ~26 real event types `engine/encounters.js` now emits (trapSprung, chestOpened, encounterRolled, faerieMet, etc.) — its own unit test asserts unknown types are 'silently dropped,' so a live trap/chest/encounter hit via the wired move action currently produces zero log narration even though the underlying engine state change is correct; (2) only move/camp are routed through the engine in the live page (01-08/09/10 SUMMARY.md each carry forward the same open todo: attack/flee/parley/sing/castSpell/drinkPotion/readScroll/buyItem/leaveStore/useItem still call the original, unmodified prototype code operating on the same `S` binding the engine adapter now also writes engine-shaped state into). This dual-track wiring is a documented, intentional Phase-1 scope boundary (SKELETON.md 'Out of Scope' + every carried-forward todo says the unification lands in the Phase 4/5 presentation rewrite), not a defect — but its real-browser behavior has not been exercised outside the automated harness and should be confirmed before relying on the live page for anything beyond the movement walking-skeleton."
---

# Phase 1: Engine Extraction & Determinism Verification Report

**Phase Goal:** The full ruleset (character gen, movement, combat, magic, economy, leveling, death, descent) runs behind a single deterministic, serializable `applyAction(state, action) → {state, events}` contract, content data separated from logic, seeded PRNG replacing Math.random(), zero gameplay regressions from the prototype.
**Verified:** 2026-09-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Test Suite (objective, run live)

```
node --test
# tests 268
# suites 0
# pass 268
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

All 268 tests pass, 0 failures. This matches ROADMAP.md's "10/10 plans executed" claim and includes unit, determinism, round-trip, and golden-master parity suites.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Every game rule executes only through `applyAction` — no rendering/storage/DOM inside the engine module | ✓ VERIFIED | `engine/engine.js` is the single dispatch (`move`/`camp`/`attack`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll`/`buyItem`/`leaveStore`/`useItem`), pure/synchronous, `structuredClone`s state, returns `{state, events}`. `test/unit/engine-purity.test.js` statically greps every `.js` file under `engine/` (comments stripped) for `document`, `window`, `localStorage`, `Math.random`, `console.` on any code line — 0 offenses, test passes. All rule-domain modules (combat.js, movement.js, magic.js, encounters.js) internally call `checkLevel` (leveling, engine/character.js) and `die` (death, engine/death.js) — leveling/death are wired into the same dispatch tree, not side channels. |
| 2 | Same seed + same actions → byte-identical results across two runs; no direct `Math.random()` remains in the rules | ✓ VERIFIED | Static guard `test/determinism/rng-no-math-random.test.js` scans `engine/` and `content/` for `Math.random` on any code line — 0 offenses. Behavioral proof re-run live in this verification: `newRun(42)` twice → `JSON.stringify` identical; `newRun(7)` + a 3-action sequence run on two independent state chains → identical serialized output. `test/determinism/same-seed-same-result.test.js` proves this across the fixture's full seed set plus a "different seeds diverge" negative check. |
| 3 | All content (classes, subclasses, races, spells, creatures, items, traps, afflictions, epitaphs) lives in standalone data tables; nothing hardcoded in logic | ✓ VERIFIED | `content/` has 19 pure-data modules (classes, races, weapons, armors, kit, skills, bestiary, encounters, spells, mu-chart, potions, foods, traps, afflictions, treasure-tables, misc-tables, flavor, epitaphs, names), barrel-exported via `content/index.js`. Counted directly against the frozen prototype: 3 classes / 24 subclasses (8 per class × 3) / 6 races / 32 spells (prototype has exactly 32, not the ROADMAP text's approximate "31") / 53 bestiary creatures across 6 categories × 5 floor-tiers (matches the frozen master's `BESTIARY` block, lines 304-370, exactly: 53 `n:"..."` entries counted directly in both). `test/determinism/content-is-pure-data.test.js` walks every content module's export graph recursively for function-typed leaves — 0 offenses (this is what catches a `()=>D(6)`-style dice closure sneaking in instead of `{n,sides,bonus}` notation). |
| 4 | A serialize/rehydrate round-trip test passes for full state at multiple run points and stays green | ✓ VERIFIED | `test/roundtrip/serialize-rehydrate.test.js` asserts `JSON.parse(JSON.stringify(state))` `deepStrictEqual`s the (volatile-field-stripped) state after every single action across 7 fixture domains: fresh `newRun`, the full movement fixture (descend + day-tick), every combat scenario (mid-fight `state.combat` sub-state live), every magic scenario (a live ward sub-state), a hand-crafted active-Shield-ward round-trip, the economy fixture (an OPEN store sub-state, with an extra `structuredClone` non-throw assertion — proof the old closures are gone), every encounters scenario (chest/trap/faerie sub-states), and the full win-path fixture (won/deathNote/epitaph). This is a substantive, multi-domain guardrail, not a single happy-path check — confirmed green in the live 268/268 run above. |
| 5 | A full playthrough via the new engine matches the original prototype's behavior — no regressions | ✓ VERIFIED (automated) / see human verification | `test/parity/full-suite.test.js` is the ENG-05 phase gate: it drives `newRun`/`applyAction` for chargen (every fixture seed), the full movement fixture, every combat scenario, every magic scenario, the economy fixture (an OPEN store with gold set to 5000 to reach every stock slot) plus every encounters scenario, and a full win-path run to the floor-5 Gate — diffing the engine's state against the pristine prototype running headless in a `node:vm` sandbox (`test/parity/harness/sandboxPrototype.js`, loaded from the frozen, byte-verbatim `test/parity/prototype-master.js.txt`) after every single action, with wall-clock fields stripped. All scenarios pass with `diffState(...) === null` at every step, including the terminal `winGame` state (`deathNote`/`epitaph` equality) and the event stream containing `"won"`. The frozen master itself is confirmed untouched since its creation commit (`git diff f8c65f3 HEAD -- test/parity/prototype-master.js.txt` is empty). The literal "via the existing browser harness" / manual full click-through check is deferred — see Human Verification below. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `engine/engine.js` | Single `applyAction(state, action) → {state, events}` dispatcher | ✓ VERIFIED | Pure, synchronous, `structuredClone`s input, dispatches by `action.type`, no-ops safely on invalid input, re-exports `newRun` |
| `engine/actions.js` | Action vocabulary + input validation | ✓ VERIFIED | `ACTION_TYPES` set (13 types), `validateAction` never throws, rejects malformed shapes |
| `engine/{dice,rng,state,maze,character,derived,items,death,movement,combat,magic,economy,encounters,events,saveState}.js` | Pure rule-domain modules, RNG-injected | ✓ VERIFIED | 17 files total under `engine/`; all pass the static purity guard; each imports only from siblings and `content/index.js`, never from `src/` or `mazeworld.html` |
| `content/*.js` (19 modules) | Pure data tables for all content categories | ✓ VERIFIED | classes/races/weapons/armors/kit/skills/bestiary/encounters/spells/mu-chart/potions/foods/traps/afflictions/treasure-tables/misc-tables/flavor/epitaphs/names — all present, all pass the function-leaf purity walker |
| `test/determinism/*` (5 files) | ENG-02/03 static + behavioral guards | ✓ VERIFIED | rng-no-math-random, content-is-pure-data, same-seed-same-result, maze-determinism, rng-serialize — all pass |
| `test/roundtrip/serialize-rehydrate.test.js` | ENG-04 standing guardrail | ✓ VERIFIED | Multi-domain, multi-fixture, passes |
| `test/parity/full-suite.test.js` + per-domain parity tests | ENG-05 golden-master gate | ✓ VERIFIED | Aggregate + 5 per-domain parity files, all pass against the frozen prototype |
| `test/parity/prototype-master.js.txt` | Frozen, byte-verbatim golden master | ✓ VERIFIED | 2811 lines; `git diff` against its creation commit is empty — unmodified since 01-03 |
| `mazeworld.html` | Unmodified except a thin engine-adapter hook | ✓ VERIFIED (scoped) | `git diff e453ccf..071458d -- mazeworld.html`: 44 lines added, 0 removed, 0 changed — a `window.__mzState` bridge accessor plus one `<script type="module">` block at the end of the file. File is 3304 lines (was ~3260), still the same DOM/canvas/UI structure. Only `move`/`camp` are rerouted through `engine/engine.js`; combat/magic/economy/store click handlers still call the original, un-extracted prototype functions directly (by design — see SKELETON.md "Out of Scope" and the carried-forward todos in 01-08/09/10 SUMMARY.md). |
| `src/browser/engineAdapter.js` | Boot/dispatch/persist glue for the walking skeleton | ✓ VERIFIED (scoped) | `boot`/`initRun`/`dispatch`/`persist`/`formatEvents` all present and unit-tested (`test/unit/engineAdapter.test.js`); fail-closed save validation confirmed; no `Math.random`/DOM references. `formatEvents()`'s event-type coverage has not kept pace with `engine/encounters.js`'s ~26 real event types (see Human Verification) — a documented, intentionally-scoped gap, not a stub. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `engine/combat.js`, `engine/movement.js`, `engine/encounters.js` | `engine/character.js#checkLevel` | direct import + call | ✓ WIRED | Leveling triggers from kills (combat), floor survival (movement), and encounter resolution (encounters) |
| `engine/combat.js`, `engine/movement.js`, `engine/magic.js`, `engine/encounters.js`, `engine/items.js` | `engine/death.js#die` | direct import + call | ✓ WIRED | Death triggers from every domain capable of reducing wp to 0 |
| `engine/movement.js` | `engine/encounters.js#{encounterDot,springTrap,openChest}` | direct import + call | ✓ WIRED | Landing on a feature tile during a move resolves real encounter/trap/chest logic (not the old placeholder events) |
| `engine/engine.js` | `content/index.js` (transitively via each rule module) | barrel import | ✓ WIRED | Combat/movement/magic/economy read `BESTIARY`, `RACES`, `SPELLS`, `WEAPONS`, etc. from content modules, not literals |
| `mazeworld.html` (module script) | `src/browser/engineAdapter.js` | `import { boot, dispatch }` | ✓ WIRED (movement only) | `window.move` is overwritten to call `dispatch({type:"move",...})`; combat/economy UI handlers are NOT rerouted (confirmed: no other `engineAdapter` import site in `mazeworld.html`) |
| `src/browser/engineAdapter.js#dispatch` | `engine/engine.js#applyAction` | direct call | ✓ WIRED | Confirmed via unit test and live re-run in this verification |
| `src/browser/engineAdapter.js#formatEvents` | `engine/encounters.js`'s emitted event types | switch/case mapping | ⚠️ PARTIAL | 26 real event types (trapSprung, chestOpened, encounterRolled, faerieMet, etc.) have no case in `formatEvent()` and are silently dropped (by explicit, tested design — see `test/unit/engineAdapter.test.js`'s "drops unknown ones silently" assertion). Gameplay state is correct; live-browser narration for these events is currently blank. Flagged as human verification, not a phase-blocking gap (adapter is explicitly a temporary walking-skeleton artifact per its own header comment and SKELETON.md). |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| ENG-01 | 01-01, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10 | Rules run only through `applyAction`, UI-free engine | ✓ SATISFIED | Purity guard passes; single dispatch confirmed |
| ENG-02 | 01-01, 01-02, 01-04, 01-05 | Seeded PRNG, no direct `Math.random()`, reproducible from seed | ✓ SATISFIED | Static + behavioral determinism proofs pass |
| ENG-03 | 01-01, 01-02, 01-06, 01-10 | Content in pure data tables | ✓ SATISFIED | 19 content modules, purity walker passes, counts verified against frozen prototype |
| ENG-04 | 01-06, 01-07, 01-10 | Lossless serialize/rehydrate round-trip, kept green | ✓ SATISFIED | Multi-domain round-trip suite passes |
| ENG-05 | 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10 | Full prototype ruleset preserved, no regressions | ✓ SATISFIED (automated golden-master); live-browser click-through deferred | Full-suite parity gate passes end-to-end including the win path |

No orphaned requirements — REQUIREMENTS.md maps exactly ENG-01..05 to Phase 1, and every plan in the phase declares at least one of them; all 5 are covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in `engine/`, `content/`, `src/`, or `test/`. One `return null` in `engine/movement.js:307` inspected directly — legitimate "no valid landing square in this direction" signal inside a teleport-resolution loop, not a stub. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full suite passes | `node --test` | 268 pass / 0 fail | ✓ PASS |
| Same seed → byte-identical `newRun` | `newRun(42)` × 2, `JSON.stringify` compared | identical | ✓ PASS |
| Same seed + actions → byte-identical post-action state | `newRun(7)` + 3 actions × 2 chains | identical | ✓ PASS |
| Content purity/determinism/round-trip/parity static+unit suites | `node --test test/unit/content-tables.test.js` | 13/13 pass | ✓ PASS |
| Frozen golden master unmodified since creation | `git diff f8c65f3 HEAD -- test/parity/prototype-master.js.txt` | empty diff | ✓ PASS |
| `mazeworld.html` scope of change since seed commit | `git diff --stat e453ccf 071458d -- mazeworld.html` | +44/-0 lines | ✓ PASS (additive only) |

### Human Verification Required

See frontmatter `human_verification` for the full detail. Summary:

1. **Deferred milestone-UAT check (expected, not a gap):** a real full playthrough in an actual browser, per 01-VALIDATION.md's own "Manual-Only Verifications" table, which explicitly defers this to end-of-milestone UAT.
2. **Newly surfaced, scoped risk (worth a look before relying on the live page beyond movement):** `src/browser/engineAdapter.js#formatEvents()` has no narration mapping for the ~26 real trap/chest/encounter event types `engine/encounters.js` now emits, and only `move`/`camp` are routed through the engine in the live `mazeworld.html` — combat/economy/store buttons still run the original, un-extracted prototype code against the same `S` binding the engine adapter also writes into. Both facts are documented, intentional Phase-1 scope boundaries (per SKELETON.md and the carried-forward todos in 01-08/09/10 SUMMARY.md), not defects, but their live-browser behavior hasn't been exercised outside the automated node:vm harness.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are objectively verified true in the codebase with direct evidence (live test run, static guards, direct git diffs, direct content counts against the frozen prototype). The phase's own planning artifacts (SKELETON.md, 01-VALIDATION.md) explicitly and correctly scope the one remaining manual check (full playable-in-browser confirmation) to end-of-milestone UAT rather than Phase 1 exit — this verification honors that scoping rather than treating it as a blocking gap. One additional, more specific human-verification item is raised beyond what SUMMARY.md claims: the browser adapter's event-narration coverage lags behind the engine's actual event vocabulary, which is real and code-confirmed but does not affect the engine boundary itself (ENG-01..05 all hold inside `engine/`), so it does not block Phase 1 completion — it is a fact worth confirming before treating the live page as more than the documented "movement walking skeleton."

---

*Verified: 2026-09-08*
*Verifier: Claude (gsd-verifier)*
