# Phase 99: Engine Facts & Lifetime Stats Tracker - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the 77 catalog achievements (`content/achievements.js`, Phase 98) unlock in play.

**In scope:**
- Two additive engine fact fields, which are the only engine bytes this milestone changes.
- A durable lifetime stats record in `@capacitor/preferences`.
- A pure, headless tracker module that folds each action's events and state into that record.
- Hooks in the engine adapter.
- A listener that hands unlocks, reveals and progress to later phases.

**Out of scope:** UI (Phase 100) and Play Games (Phase 101).

The counting rulings are LOCKED in `98-CONTEXT.md` ("What counts"), as amended by quick task 261005-opm: races and classes now need floor 10. Read them from there.

</domain>

<decisions>
## Implementation Decisions

### Engine facts (TRACK-01): the only engine change this milestone
- **Kill group:** add a `group` field to `foeKilled`, holding the BESTIARY family key the foe was drawn from (Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead).
  - The field is additive and uses no dice.
  - Turned undead come from `walkingDeadTurned.count`. Their group is Walking Dead, and that event needs no change.
- **Hero HP after an ailment hit:** add the hero's HP right after the hit to `afflictionCaught` and `afflictionTick` (for example `wp`).
  - It is additive.
  - Terminal Condition is "exactly 1 HP after a Disease (or Poison) hit". Reading the state after the action is wrong when something else changes HP in the same action.
- **Everything else** is read from existing events plus the state after the action. That covers:
  - depth `state.floor.depth`, days `state.day`, wilmst held, worn slots, race and parent class;
  - the `died` cause;
  - `fled` with reason `escaped`;
  - `parleyWon`, `joinerJoined`, `memberDowned`, `joinerMurdered`;
  - `trapSprung` with no trap death;
  - `potionDrunk` for the hero only.
- **No other engine bytes change.**
- **The engine gate applies:**
  - New fields are carved out of the three `*Comparable()` functions in `test/parity/harness/comparables.js`.
  - `test/parity/prototype-master.js.txt` is never edited.
  - No new event types, so no new `EVENT_NARRATION` entries. If one is added after all, it gets an entry.
  - Expected fixture moves: zero. Any fixture that moves is measured, declared and regenerated.

### Lifetime stats record (TRACK-02)
- **Storage:** one record under a new key, `ddr.achievements.v1`, written through `src/browser/storage.js` (Preferences on device, localStorage in the browser). It is kept apart from the run save (`ddr.delve.v1`).
- **Contents:**
  - lifetime counters: deaths (excluding abandons), kills per group, Joiners accepted, Joiners fallen, parleys won, traps survived;
  - single-run bests: depth, days, wilmst held;
  - lifetime flags: Disease to 1 HP, Poison to 1 HP;
  - the set of sub-classes delved;
  - unlocks, each with its date;
  - revealed ids.
- **Current-run progress lives in the same record, tagged to the current run** (for example by the run's seed and start time). It covers Chicken's won flees, whether the run is still naked, whether it is still teetotal, and whether its first step has been seen. It resets when a new run starts. A crash or relaunch mid-run keeps it.
- **Loading:** a missing, corrupt or older-shape record loads tolerantly as all zeros. There is no legacy path and no credit from the graveyard or bests history; a fresh 2.5.0 starts at zero.
- **Saving:** after every action that changed the record, through the storage per-key write queue. The flush the app already does on going to the background (`nativeChrome.js` → `waitForPending` / `storage.flush`) covers it. An unlock is saved in the same write that earns it.
- **A run started before 2.5.0 and resumed** (no current-run tag in the record) can never earn Naked Ambition or Teetotaler, because its first step and earlier potions were never seen. Everything else counts from the moment the tracker sees it.

### Tracker and hooks (TRACK-03..05)
- **The tracker** is a pure shell module, `src/browser/achievementTracker.js`. Its inputs are the record, the events, the state before, the state after and the catalog. It returns the new record, the unlocks, the reveals and the progress changes. It has no DOM and no storage I/O, and it is fully testable headless.
- **The hooks live in `src/browser/engineAdapter.js`:**
  - `dispatch()` folds every action next to the existing death recording.
  - Starting a new run (`startNewRun` / `initRun`) records the sub-class for Tourist and resets the current-run progress. A started run counts toward Tourist even if it is later abandoned.
  - Boot loads the record.
  - A listener (in the style of `setRunRecordedListener`) hands unlocks, reveals and progress to Phase 100 (the unlock banner and the list) and to Phase 101 (the Play mirror). With no listener attached, nothing is shown, but the record still updates.
- **Only real runs count.**
  - Dev runs earn nothing: `currentState.dev` start-at-depth runs and the debug dev row. This is the same rule that keeps them out of the graveyard and the bests.
  - The tuning bot drives the engine directly (`tools/lib/tuning-bot.mjs`), never the adapter. A test proves nothing under `tools/` imports the tracker.
- **Unlock rules:**
  - Several unlocks in one action fire in catalog list order.
  - Unlocking a hidden achievement directly also marks it revealed.
  - A revealer's unlock reveals its target.
  - An unlock fires exactly once, never re-locks, and is persisted the moment it is earned. Killing the app right after an unlock and relaunching leaves it unlocked, and it does not fire again.

### Claude's Discretion
- The exact field names (for example `group`, `wp`) and the record's internal shape.
- How the tracker evaluates each trigger kind in the catalog's `TRIGGER_VOCABULARY`. The kinds are lifetimeCounter, singleRunBest, singleRunFlag, deathCause, lifetimeFlagPair and distinctSetCount.
- How the progress values are expressed for the listener. Phase 100 needs them for "37 / 50"-style progress, and Phase 101 needs them for Play's increment or set-steps calls.
- The plan split. Expect: (1) the engine fields and the parity carve-outs; (2) the record and the pure tracker with headless tests covering every catalog trigger; (3) the adapter hooks, the listener and the persistence/relaunch tests.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/engineAdapter.js`:
  - `dispatch()`, around line 910, is the one choke point for actions and events. It already finds the `died` event, skips dev runs (`currentState.dev`) and calls `recordDeath` / `notifyRunRecorded` / `track(persistGrave(...))`.
  - `startNewRun` (around line 803), `initRun` (around line 554) and `boot` (around line 837) are the other entry points.
  - `setRunRecordedListener` (around line 189) is the listener pattern.
  - `track()` / `waitForPending()` (around line 531) cover background flushes.
  - The key-constant style is `SAVE_KEY = "ddr.delve.v1"` and `BESTS_KEY = "ddr.bests.v1"`.
- `src/browser/storage.js`: `getItem`, `setItem`, `removeItem` and `flush`, with per-key write queues and fail-safe fallbacks.
- `content/achievements.js`: `ACHIEVEMENTS` (77 entries, each with trigger, threshold, type, steps, reveals and listOrder) and `TRIGGER_VOCABULARY`.
- Engine event sites:
  - `foeKilled` (engine/combat.js:1250)
  - `walkingDeadTurned` (combat.js:3742, magic.js:522)
  - `afflictionCaught` (encounters.js:808)
  - `afflictionTick` (movement.js:534)
  - `fled` (combat.js: door 1919, cloaker 2020, tracked 2037/2047, smoke 2047, escaped 2067)
  - `parleyWon` (combat.js:2318)
  - `memberDowned` (combat.js:3904)
  - `joinerMurdered` (movement.js:1439)
  - `joinerJoined` (encounters.js:743)
  - `trapSprung` (encounters.js:100)
  - `potionDrunk` (magic.js:877)
  - `died`, via engine/death.js#die
  - the `abandon` cause (engine.js:160)
- `test/parity/harness/comparables.js` holds the three `*Comparable()` functions.

### Established Patterns
- **Engine purity:** deterministic, no new rng draws behind feature guards, and new fields carved out of the comparables.
- **Greenfield:** tolerant load only, no legacy paths.
- **Tests:** executors run targeted tests only. The orchestrator runs the full suite at phase close. No bot runs.

### Integration Points
- **Phase 100:** reads the listener (unlock, reveal, progress) and the record (dates, progress) for the banner and the ☰ list.
- **Phase 101:** reads the listener and the record for the Play mirror's durable queue.

</code_context>

<specifics>
## Specific Ideas
- The counting rulings live in `98-CONTEXT.md`, "What counts". Races and classes are at floor 10 per quick 261005-opm.
- Hoarder measures the most wilmst held at once in one run. Spending never counts against it.

</specifics>

<deferred>
## Deferred Ideas
- None. The UI is Phase 100 and the Play mirror is Phase 101.

</deferred>
