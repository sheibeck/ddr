---
phase: 39-gear-magic-items-one-shot-tools
plan: 04
subsystem: engine
tags: [items, tools, movement, darkness, derived-rng, parity-clean, bot-policy]

# Dependency graph
requires:
  - phase: 39-gear-magic-items-one-shot-tools (Plan 03)
    provides: "content/activations.js#ACTIVATION_OF and the c.timers activation model (activationFor/itemTimerId/liveItemEffects/itemEffectActive) the torch's lit effect builds directly on"
  - phase: 38-melee-active-abilities (Plan 01)
    provides: "engine/rng.js#hashString/derivedRng — the derived rng stream pattern this plan's loot row reuses"
provides:
  - "content/tools.js — TOOLS, TOOL_ORDER, TOOL_LOOT_WEIGHTS, TOOL_ACTIVATION_OF"
  - "engine/derived.js#hasTool; engine/items.js#toolItem/toolIndex/pickLootTool, rollTreasureItem's derived-stream tool-loot row, takeItem's haveOne refusal"
  - "engine/economy.js — STORE_EFFECTS.giveTool, depth-tier-gated tool store lines, baseValueFor's tool case"
  - "engine/movement.js — state.pendingHazard pre-roll pending state, move(..., opts.tool), useTool(state, tool, dir, rng, events, now)"
  - "engine/items.js#useItem — the torch's notDark refusal, case \"light\", the tool consumption branch"
  - "engine/encounters.js#fallDark — the darknessResisted suppression guard"
  - "engine/actions.js/engine.js — the useTool { tool, dir } action"
  - "engine/state.js/saveState.js — state.pendingHazard, transient like pendingFind"
  - "tools/lib/tuning-bot.mjs — the pending-hazard dispatch handler"
  - "test/parity/harness/comparables.js — the pendingHazard carve-out, ENGINE_ONLY_STORE_EFFECTS"
affects: [39-05-shell-gear-surfaces, 42-bal-02-consolidated-retune]

tech-stack:
  added: []
  patterns:
    - "a kind:\"tool\" bag item family (torch/rope/ladder), one bag slot each, haveOne-gated — the Lockpicks kind:\"picks\" precedent generalized to three named tools"
    - "a derived-rng loot row inserted BEFORE an existing rng.d(10) table roll — the new stream is keyed by the main cursor (rng.getState()) but is a fully separate makeRng instance, so the no-fire path advances the main rng by the exact same draw count as before"
    - "a pre-roll pending-decision record (state.pendingHazard) that a second identical action DECLINES in place (mutating the existing record) rather than a fresh action type — the roll code path itself is unchanged, just reached one dispatch later"

key-files:
  created:
    - content/tools.js
    - test/unit/tools.test.js
  modified:
    - content/activations.js
    - content/index.js
    - engine/derived.js
    - engine/items.js
    - engine/economy.js
    - engine/movement.js
    - engine/encounters.js
    - engine/actions.js
    - engine/engine.js
    - engine/state.js
    - engine/saveState.js
    - tools/lib/tuning-bot.mjs
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/unit/item-activation.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/actions.test.js
    - test/unit/bot-buy-policy.test.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/fixtures/action-script.economy.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/GEAR-BALANCE.md

key-decisions:
  - "rollTreasureItem's derived tool-loot check is guarded on `typeof rng.getState === \"function\"` — real production callers (killFoe, the find handlers) always thread a real makeRng instance and are unaffected, but this made the mechanic a structural no-op (never a crash) for the many pre-existing bare {d,pick,shuffle} test doubles across the unit suite that predate this plan and never had a tool-loot cursor to key from"
  - "the climb/gorge block's tool branch (opts.tool) checks isFlying FIRST, inside itself, via a shared flyOver() closure — reconciling the plan's own two descriptions (the outer restructure text puts opts.tool first; the behavior spec says isFlying wins even over a tool use) rather than picking one over the other"
  - "a fired-but-empty-candidate-list derived tool roll (every eligible tool already carried) falls through to the SAME rng.d(10) table roll with zero extra main-rng draws — verified by replaying the pre-plan control flow (legacyRollTreasureItem) against the exact same seed and asserting byte-identical final rng state and item"
  - "toolUsed is the one RAIL_FEATURE_ICON exception — its icon depends on the raw event's own .feat (climb->wall, gorge->crevice), not just its type, since a single toolUsed TYPE covers both hazards; railCardFor reads e.feat directly at its one lookup site rather than polluting the type-keyed table with an ambiguous default"
  - "the economy fixture's EXISTING Pickpocket-markup divergence record (test/parity/fixtures/action-script.economy.json) was EXTENDED, not replaced — the new Torch/Rope engine-only store lines are appended to its stockAfter array with a measured, not hand-typed, cost; stockNames (the roll-identity check) is unchanged since ENGINE_ONLY_STORE_EFFECTS strips both new lines the same way it already strips Rations"

requirements-completed: []  # GEAR-05's engine half is done, but the requirement text describes the RENDERED decision card (Plan 05's job) — left unmarked, mirroring the 39-03 GEAR-02 / Phase 38 ABIL-01 precedent

coverage:
  - id: D1
    description: "content/tools.js declares the three tools (Torch 25/tier0/light, Rope 60/tier0/gorge, Ladder 150/tier1/climb); toolItem/toolIndex/hasTool resolve bag carriage; a second copy of a carried tool is refused itemRejected{reason:haveOne}"
    requirement: "GEAR-05"
    verification:
      - kind: unit
        ref: "test/unit/tools.test.js (content-shape + toolItem/toolIndex/haveOne sections)"
        status: pass
    human_judgment: false
  - id: D2
    description: "rollTreasureItem's derived-stream tool-loot row fires before the main d(10) table with zero extra main-rng draws on the no-fire path (200-seed replay proof) and exactly one (the lockpick d12) when it fires; a Ladder never rolls at depth 1; openStore offers Torch/Rope from tier 0 and Ladder from tier 1, flat-priced, only when not carried"
    requirement: "GEAR-05"
    verification:
      - kind: unit
        ref: "test/unit/tools.test.js (rollTreasureItem + openStore/buyFrom sections)"
        status: pass
      - kind: unit
        ref: "test/parity/economy-parity.test.js, test/unit/economy.test.js, test/unit/store-roll.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "state.pendingHazard pauses a climb/gorge roll exactly once when the matching tool is carried (hazardChoice, zero draws, zero position change); a second move() at the same tile declines in place and the roll runs; useTool spends the tool and passes the tile with no roll/no fall damage; a character without the matching tool sees byte-identical movement"
    requirement: "GEAR-05"
    verification:
      - kind: unit
        ref: "test/unit/tools.test.js (the hazard pre-roll + useTool sections, 12 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/movement.test.js, test/unit/actions.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "the torch lights a live c.darkFor darkness (torchLit, 40-square lit effect) and is refused (useRefused notDark) while not dark, not consumed; a live lit effect suppresses a later fallDark entirely (darknessResisted, no tile painted)"
    requirement: "GEAR-05"
    verification:
      - kind: unit
        ref: "test/unit/tools.test.js (the torch + fallDark sections, 5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "every new event (hazardChoice, toolUsed, toolRefused, torchLit, darknessResisted) is narrated in EVENT_NARRATION/TOAST_FOR/RAIL_FAMILY, passes the voice scan, and the parity suite (pendingHazard carve-out + the one measured loot-roll call) stays green with the master hash unchanged"
    verification:
      - kind: unit
        ref: "npm test (2664/2664, # fail 0); test/unit/toastsCoverage.test.js, formatEventsCoverage.test.js, test/voice/safety-scan.test.js"
        status: pass
      - kind: unit
        ref: "git hash-object test/parity/prototype-master.js.txt unchanged; git status --porcelain test/parity/fixtures empty; npm run build:www exit 0"
        status: pass
    human_judgment: false

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 39 Plan 04: One-Shot Tools (GEAR-05 Engine) Summary

**Rope/ladder/torch as `kind:"tool"` bag items with a derived-rng loot row (zero new main-rng draws on the no-tool path), a `state.pendingHazard` pre-roll decision that lets a carried rope/ladder skip the climb/gorge roll entirely via a new `useTool` action, and a torch that lights `c.darkFor` darkness and holds a later Darkness result off for 40 squares — with the full parity suite (2664 tests, master hash unchanged) reconciled by a single new `pendingHazard` structural carve-out and zero fixture divergences.**

## Performance

- **Duration:** not precisely timed (single continuous execution)
- **Tasks:** 3 (plan tasks) — committed as 3 atomic commits
- **Files modified:** 27 (2 new, 25 modified)

## Accomplishments

- `content/tools.js` (new): `TOOLS` (Torch 25/tier0/`use:"light"`, Rope 60/tier0/`feat:"gorge"`, Ladder 150/tier1/`feat:"climb"`), `TOOL_ORDER`, `TOOL_LOOT_WEIGHTS` (torch 4 > rope 3 > ladder 1), `TOOL_ACTIVATION_OF` (Torch's `{kind:"lit", effect:40}` spread into `content/activations.js#ACTIVATION_OF` alongside `TREASURE_ACTIVATION_OF`/`POTION_ACTIVATION_OF`).
- `engine/derived.js#hasTool(c, tool)` — the one carry-check gate every consumer (movement's pre-check, `useTool`, `takeItem`'s haveOne, `rollTreasureItem`'s candidate filter) shares.
- `engine/items.js`: `toolItem(key)`/`toolIndex(c, tool)`; `rollTreasureItem` gains a derived-stream loot row (`derivedRng(rng.getState(), "tool", depth)`) inserted between the lockpick gate and the main `d(10)` table roll — a fully separate rng instance that never draws from the caller's `rng`, so the no-fire path is byte-identical to before this plan (proven live: 200 seeds × 2 depths) and the fire path advances the main rng by exactly the one lockpick draw already spent. Guarded on `typeof rng.getState === "function"` so the many pre-existing bare test-double rngs across the unit suite are unaffected (never a crash — real production callers always thread a real `makeRng`). `takeItem` refuses a duplicate tool (`itemRejected {reason:"haveOne"}`), mirroring the Lockpicks precedent.
- `engine/economy.js`: `STORE_EFFECTS.giveTool` + `STOWING_EFFECTS` entry; depth-tier-gated, flat-priced tool store lines appended after Rations (Torch/Rope from tier 0, Ladder from tier 1, only when not carried); `baseValueFor` reads a tool's real cost.
- `engine/movement.js`: `move(state, dir, rng, events, now, opts)` — the climb/gorge block restructures to `opts.tool` (checking `isFlying` first, via a shared `flyOver()` closure, so a flying hero's `useTool` tap never burns the tool) → `isFlying` → `ether` → the roll branch, which gains a pre-check: a matching-tool-carrying hero at a fresh hazard tile stashes `state.pendingHazard` and emits `hazardChoice`, returning with zero draws; a second `move()` at the same tile/dir flips `declined:true` in place and the roll runs; any successful step/tool-use/teleport/descend clears the pending record. `useTool(state, tool, dir, rng, events, now)` — the refusal ladder (`unknown`/`noTool`/`noHazard`) then delegates to `move(..., {tool})`.
- `engine/items.js#useItem`: a `notDark` refusal for `kind:"light"` (the torch) before `itemReady`; `case "light"` clears `c.darkFor` and emits `torchLit`; the consumption branch now includes `it.kind === "tool"`.
- `engine/encounters.js#fallDark`: a live torch `lit` effect (`itemEffectActive(c, "lit")`) suppresses a Darkness result entirely — `darknessResisted`, no tile painted, `c.darkFor` untouched.
- `engine/actions.js`/`engine.js`: the `useTool { tool, dir }` action (`tool` must be ladder/rope; `dir` a cardinal direction).
- `engine/state.js`/`saveState.js`: `pendingHazard` — a seventh transient top-level analog of `pendingFind` (always `null` on `newRun`/`validateSave`/`rehydrate`, never trusted from a save, T-39-11).
- `tools/lib/tuning-bot.mjs`: a pending-hazard dispatch handler (answers an un-declined pending record with `useTool` in one dispatch) — a pending-state handler, not a timing tactic; the bot does not buy/carry a tool yet (Phase 42).
- `src/browser/{eventNarration,toasts,rail}.js`: `hazardChoice` (SILENT on the toast side, like `findOffered`), `toolUsed`, `toolRefused` (`FEATURE_EVENTS`), `torchLit`, `darknessResisted` — plus `notDark`/`haveOne` reason additions to the pre-existing `useRefused`/`itemRejected` tables. `rail.js`'s `toolUsed` icon reads the raw event's own `.feat` directly at `railCardFor`'s one lookup site (climb→wall, gorge→crevice) since `RAIL_FEATURE_ICON` is keyed by type only and `toolUsed` covers both hazards.
- Parity: `pendingHazard` added to all three shared comparables' top-level destructure plus the three per-domain local `comparable()` duplicates; `ENGINE_ONLY_STORE_EFFECTS` (`buyRations`, `giveTool`) replaces the old `buyRations`-only filter in `stripStoreClosures`/`stockMarkupDiff`. Measured, not assumed: the chest scenario (seed 2) still rolls a Cloak of Speed — the derived tool roll never fires for that cursor, so no fixture divergence was declared anywhere; the economy fixture's EXISTING Pickpocket-markup record was extended (not replaced) with the two new engine-only store lines it now offers.
- `test/parity/FIXTURE-INVENTORY.md` and `docs/GEAR-BALANCE.md` carry the full ledger: the derived-stream rationale, the `pendingHazard` shape/lifecycle, the torch's exact scope, the refusal vocabulary, the events, and the bot's deferred-to-Phase-42 tactics note.
- `test/unit/tools.test.js` (new, 41 tests): content shape, `toolItem`/`toolIndex`/`hasTool`, the derived loot row's zero-draw proof, `takeItem`'s haveOne gate, `sellPriceFor`, `openStore`/`buyFrom` at both tiers, the full hazard pre-roll/decline/retry/clear lifecycle, `useTool`'s spend/refusals/flying-wins, `teleport`/`descend` clearing the pending record, and the torch's light/refuse/resist/fade behavior.

## Task Commits

1. **Task 1: Tools content; loot row on a derived stream; store lines; sell value; duplicate gate** - `d761250` (feat)
2. **Task 2: Hazard pre-roll pending state + useTool action; torch lights darkness; narration; bot pending handler** - `e569a35` (feat)
3. **Task 3: Parity strip for pendingHazard, fixture check (chest seed 2), FIXTURE-INVENTORY + ledger sections, plan gate** - `23ef593` (test)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in `.planning/config.json`, so the final metadata commit still fires for `.planning/` docs this run's own instructions leave to the orchestrator).

## Files Created/Modified

- `content/tools.js` (new) — `TOOLS`, `TOOL_ORDER`, `TOOL_LOOT_WEIGHTS`, `TOOL_ACTIVATION_OF`
- `content/activations.js` — spreads `TOOL_ACTIVATION_OF` into `ACTIVATION_OF`
- `content/index.js` — barrel export for `content/tools.js`
- `engine/derived.js` — `hasTool`
- `engine/items.js` — `toolItem`/`toolIndex`/`pickLootTool`, `rollTreasureItem`'s derived-stream row, `takeItem`'s haveOne refusal, `useItem`'s `notDark` refusal + `case "light"` + tool consumption
- `engine/economy.js` — `STORE_EFFECTS.giveTool`, `STOWING_EFFECTS`, the tool store lines, `baseValueFor`'s tool case
- `engine/movement.js` — `opts.tool`, `state.pendingHazard` pre-check/lifecycle, `useTool`
- `engine/encounters.js` — `fallDark`'s `darknessResisted` guard
- `engine/actions.js`/`engine.js` — the `useTool` action
- `engine/state.js`/`saveState.js` — `pendingHazard: null`
- `tools/lib/tuning-bot.mjs` — the pending-hazard dispatch handler
- `src/browser/{eventNarration,toasts,rail}.js` — the five new events + two reason additions
- `test/unit/item-activation.test.js` — `ACTIVATION_OF` entry-count pin 19→20 (Torch)
- `test/unit/foe-turn-draw-count.test.js` — seed 8/Beasts `FULL_FIGHTS` row re-measured (32→27 draws)
- `test/unit/actions.test.js`, `test/unit/bot-buy-policy.test.js` — `useTool` validation + pending-hazard bot tests
- `test/parity/harness/comparables.js` — `pendingHazard` carve-out, `ENGINE_ONLY_STORE_EFFECTS`
- `test/parity/{combat,magic,movement}-parity.test.js` — the matching local `comparable()` destructures
- `test/parity/fixtures/action-script.economy.json` — the existing declared record extended with two measured `stockAfter` entries
- `test/parity/FIXTURE-INVENTORY.md`, `docs/GEAR-BALANCE.md` — the Phase 39 GEAR-05 sections
- `test/unit/tools.test.js` (new) — the 41-test suite

## Decisions Made

See frontmatter `key-decisions` — the `rng.getState` type-guard (real callers unaffected, pre-existing test doubles never crash), the tool branch's isFlying-first reconciliation of the plan's two descriptions, the empty-candidate-list fired-but-falls-through proof, the `toolUsed`/`RAIL_FEATURE_ICON` per-instance icon exception, and the economy fixture's extend-not-replace divergence-record approach are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `rollTreasureItem`'s new `rng.getState()` call crashed 14 pre-existing tests across the unit suite that pass a bare `{d, pick, shuffle}` test double with no `getState` method**
- **Found during:** Task 1 (full `npm test` run after the initial implementation)
- **Issue:** `test/unit/encounters.test.js` (openChest x3), `test/unit/combat.test.js`/`test/unit/foe-turn-draw-count.test.js` (killFoe/full-fight tests x8), `test/unit/identity-contract.test.js`, `test/unit/usable-features-audit.test.js` and `test/unit/item-activation.test.js`'s entry-count pin all broke — most via `Cannot read properties of undefined (reading 'getState')` from the many `fakeRng(seq)` mocks throughout the codebase (a pre-existing convention across dozens of files, none of which implement `getState`), one via the `ACTIVATION_OF` entry count moving 19→20 (Torch added), and two `FULL_FIGHTS` draw-count pins genuinely moving because a real seeded fight's kill now drops a Torch instead of the pre-plan table roll.
- **Fix:** Guarded the entire derived-stream tool-loot check behind `typeof rng.getState === "function"` (real production callers — `engine/combat.js#killFoe`, `engine/encounters.js`'s find handlers — always thread a real `makeRng` instance and are unaffected; the guard only ever matters for a bare test double, making the mechanic a structural no-op for it rather than a crash); updated the `ACTIVATION_OF` count pin to 20 with a Torch assertion; re-measured the seed 8/Beasts `FULL_FIGHTS` row live (32→27 total draws, roster/attacks/outcome unchanged) and its "restated" test title, both per the file's own "pins are measured, not adjusted, only escalated with rationale" convention.
- **Files modified:** `engine/items.js`, `test/unit/item-activation.test.js`, `test/unit/foe-turn-draw-count.test.js`.
- **Verification:** `npm test` — 2664/2664, `# fail 0`.
- **Committed in:** `d761250` (Task 1 commit)

**2. [Rule 1 - Bug] The economy fixture's declared Pickpocket-markup divergence record's `stockAfter` array was stale against the new tool store lines**
- **Found during:** Task 1 (`node --test test/parity/economy-parity.test.js` after the store-line addition)
- **Issue:** `declaredStockDiffs`'s `after` check compares the engine's RAW `[n, cost]` stock pairs against the record's `stockAfter` literal; seed 3's depth-1 store now appends `["Torch", 25]`/`["Rope", 60]` (the hero starts with neither) after the existing 13 lines, diverging the length (15 vs 13).
- **Fix:** Extended the existing record's `stockAfter` array with the two measured entries (computed live via `openStore`, never hand-typed) and its `requirements`/`rationale` fields; `stockNames` (the roll-identity check) needed no change since `ENGINE_ONLY_STORE_EFFECTS` strips both new lines the same way it already strips Rations.
- **Files modified:** `test/parity/fixtures/action-script.economy.json`.
- **Verification:** `node --test test/parity/economy-parity.test.js` green; full `npm test` 2664/2664.
- **Committed in:** `d761250` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 3 — a blocking crash across pre-existing tests, fixed via a defensive guard that never changes real-gameplay behavior; Rule 1 — a direct, correct consequence of the plan's own new store lines)
**Impact on plan:** No plan behavior was altered to make a test pass; the `rng.getState` guard is purely defensive against a test-infrastructure gap this plan's new call site exposed, and the fixture extension is exactly the "declare and measure" protocol the plan itself specifies.

## Issues Encountered

None beyond the deviations above. Reconciling the plan's `<action>` text (literal `if (opts.tool) {…} else if (isFlying) {…}` structure) against its own `<behavior>` text ("isFlying wins even over a tool use — order: tool branch checks isFlying first") required a small design choice (a shared `flyOver()` closure invoked from inside the `opts.tool` branch) rather than a genuine blocker — recorded in Decisions Made, not as a deviation, since both plan texts were followed exactly as written.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. This plan's shell surface is narration-table entries only (`src/browser/{eventNarration,toasts,rail}.js`) — `mazeworld.html` is untouched (`git diff --stat -- mazeworld.html` empty) and `npm run build:www` exits 0; the actual USE LADDER/USE ROPE/USE TORCH buttons are Plan 05's job. Recorded here for the milestone-close aggregated Pixel 7 checklist:

1. Buy a Ladder at a depth-2 store, walk into a climbable wall — a decision card appears BEFORE any roll (visible after Plan 05) with USE LADDER / CLIMB IT; USE LADDER passes with no damage and the ladder is gone.
2. With a Rope, decline at a crevice (LEAP IT), fall, and confirm the retry card now offers USE ROPE beside LEAP IT.
3. Get Darkness (table result) while carrying a Torch — the card offers USE TORCH; using it lights the maze and a later Darkness within 40 squares is resisted.
4. Try USE from the Gear tab on a Torch in a lit corridor — the refusal line reads "It is not dark. Save the torch for when it is."
5. A Torch/Rope line appears in a depth-1 store, Ladder only from depth 2, and none once carried.
6. (carried forward) The items 39-01/39-02/39-03-SUMMARY.md already deferred: TO HIT 1–6/1–4 axis visibility, the Thief Plate-armor backstab refusal, the store's heavy/neutral/light weapon mix, the Speed-potion Hasted chip, the Cloak of Speed vending-machine cooldown line, the Pine Staff recharging line, and resuming a pre-Phase-39 save mid-run — all still meaningful only once Plan 05 lands.

## Next Phase Readiness

- The engine half of GEAR-05 is fully landed: tools exist as content/items, roll as loot on a derived stream with zero main-rng-draw impact, stock at depth tiers, and are spent at the hazard's decision point via `pendingHazard`/`useTool`/the torch's `useItem` path. Every new event is narrated in all three tables and passes the voice scan.
- `GEAR-05` is deliberately left unmarked in `.planning/REQUIREMENTS.md` — its own text ("offered at the matching decision point, e.g. the CLIMB IT rail card") describes the RENDERED decision card, which is Plan 05's job, mirroring the Phase 39-03 GEAR-02 / Phase 38 ABIL-01 precedent (marked complete only once the full DoD, including the UI surface, is satisfied). This SUMMARY does not run `requirements mark-complete`, `state advance-plan`, or any ROADMAP/STATE write — this run's orchestrator owns those.
- Plan 05 (shell gear surfaces) has everything it needs: `state.pendingHazard`'s shape is stable, `useTool`'s action contract is fixed, the torch's `useRefused`/`torchLit`/`itemEffectStarted` events are narrated, and `docs/GEAR-BALANCE.md`'s ledger documents every number and refusal reason it will need to render.
- No blockers.

---
*Phase: 39-gear-magic-items-one-shot-tools*
*Completed: 2026-09-18*

## Self-Check: PASSED

All created files found on disk (`content/tools.js`, `test/unit/tools.test.js`, this SUMMARY.md); all three task commits found in `git log --oneline --all` (`d761250`, `e569a35`, `23ef593`).
