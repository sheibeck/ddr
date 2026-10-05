---
phase: 99-engine-facts-lifetime-stats-tracker
plan: 03
subsystem: achievements
tags: [achievements, engine-adapter, persistence, listener, bot-isolation]
requires:
  - phase: 99-01
    provides: foeKilled.group, afflictionCaught.wp, afflictionTick.wp
  - phase: 99-02
    provides: achievementRecord.js, achievementTracker.js (beginRun, foldAction)
provides:
  - "engineAdapter.js exports loadAchievements, getAchievementRecord, setAchievementListener"
  - "dispatch() fold, startNewRun() run start (Tourist), boot() record load"
  - "frozen listener payload { unlocks: [{ id, at }], reveals: [id], progress: [{ id, value, steps }] }"
  - "docs/SHELL-MODULES.md Achievements tracker (Phase 99) section"
affects: [100 unlock banner and list, 101 Play mirror]
tech-stack:
  added: []
  patterns: [adapter-owned cross-run record like bests/graveyard, op queue behind a tracked lazy load, listener mirrors setRunRecordedListener]
key-files:
  created:
    - test/unit/achievements-adapter.test.js
    - test/persistence/achievements-persistence.test.js
    - test/unit/achievements-bot-isolation.test.js
  modified:
    - src/browser/engineAdapter.js
    - docs/SHELL-MODULES.md
key-decisions:
  - "An op arriving while a reload is in flight queues (even with a record already loaded), so a reload can never overwrite a fold applied during its read"
  - "The apply step nests a second try/catch around storage.setItem so a write failure still lets the listener hear the unlock"
  - "initRun() is not hooked; startNewRun() is the one seam every player-started delve passes through"
requirements-completed: [TRACK-02, TRACK-03, TRACK-04, TRACK-05]
status: complete
duration: ~1h
completed: 2026-10-05
---

# Phase 99 Plan 03: Adapter hooks, listener and persistence Summary

**The tracker is wired into engineAdapter.js: boot loads the record, dispatch() folds every real action, startNewRun() counts the sub-class for Tourist, each changed record is one write under ddr.achievements.v1, and one listener hears each action's unlocks, reveals and progress. Persistence and bot isolation are proven by test.**

## What was built

- `src/browser/engineAdapter.js` (152 lines added, nothing existing changed): module state `achievementRecord`, `achievementListener`, `achievementLoad`, `achievementQueue`; exports `loadAchievements()`, `getAchievementRecord()`, `setAchievementListener(fn)`; the apply step (own try/catch) calls `beginRun` / `foldAction`, writes `serializeRecord` once per changed action, then notifies; `dispatch()` queues `{ kind: "fold", events, before, after, now }` for non-dev actions (raw engine events), `startNewRun()` queues `{ kind: "begin", state, now }` for non-dev runs, `boot()` awaits `loadAchievements()` after `loadRunHistory()`.
- Lazy load: a dispatch before the record loads is queued and a tracked `loadAchievements()` starts, so `waitForPending()` and `flushOnBackground` cover it; the queue folds into the stored record in order.
- Listener payload: `Object.freeze({ unlocks, reveals, progress })` (the tracker's arrays are already frozen), called once per action that produced any of them; a sync throw or an async rejection is swallowed.
- `test/unit/achievements-adapter.test.js` (13 tests), `test/persistence/achievements-persistence.test.js` (8), `test/unit/achievements-bot-isolation.test.js` (4); `docs/SHELL-MODULES.md` gained the "Achievements tracker (Phase 99)" section before "What stays shared".

## Task commits

1. Task 1, adapter hooks and real-engine tests: `a5d6ab13`
2. Task 2, persistence and relaunch proofs: `2758ccb6`
3. Task 3, bot isolation walk and SHELL-MODULES.md section: `4021f0ae`

## Tests (targeted only; no full suite, no bots)

| Run | Tests | Pass |
|-----|-------|------|
| Task 1 verify (achievements-adapter plus 12 existing adapter, persistence and stale-terms suites) | 164 | 164 |
| Task 2 verify (achievements-persistence, achievements-adapter, storage, flush-drain, stale-terms) | 43 | 43 |
| Task 3 verify (achievements-bot-isolation, bridge-registry, compliance-docs, stale-terms) | 34 | 34 |

New files alone: 13 + 8 + 4 = 25 tests, all passing. No existing test was edited.

Real-engine coverage the 99-02 tracker lacked (it was tested on synthetic events only): a real attack kills a 1-HP Demons foe and the tracker counts it under the real `group` field (`kills.Demons` 1, `kills_demons_t1` progress 1); a real Poison water step with the hero at 2 HP emits a real `afflictionTick` with `wp` 1 and sets `flags.poisonLeftOnOneHp`; a real floor-1 combat death unlocks Special Snowflake in one listener call with Frequent Flier progress 1.

## Interpretation calls

- Bests progress (depth, days, wilmst) moves on the first action of any run, so the listener hears Downward Mobility, Survivor and Hoarder progress at once on the first dispatch; tests assert on the dying action's call and on unlock ids, not on total call counts.
- An op that arrives while a load is in flight queues even if a record is already in memory (spec said apply at once when loaded and the queue is empty); this keeps a reload (boot() again in one session) from overwriting a fold applied during its read.
- The bot isolation walk also flags a `tools/` file that merely re-exports or hops through another tool; it follows every relative specifier, bare packages and `node:` ignored.

## Deviations from Plan

None. The plan executed as written; no edit to engine/, content/, mazeworld.html or the 99-02 modules. `initRun()` has no achievement call.

## Human verification (deferred to end of run)

Device-round rows for the milestone-close Pixel 7 batch (not reachable headless):

1. Process kill mid-run: play a few floors, earn a counter change and an unlock, force-stop the app from Android settings, relaunch, confirm the counts and the unlock (with its date) survive and the unlock does not fire again.
2. App-update install: with a record holding counts and an unlock, `adb install -r` the next build over it and relaunch; the record (Preferences) is intact and the resumed run keeps its current-run progress.
3. A run left in progress from a 2.4.0 install, updated to 2.5.0 and resumed, counts from then on and never earns Naked Ambition or Teetotaler.

## Known Stubs

None. The listener has no registered consumer yet by design (Phase 100 registers it); the record still updates and is saved.

## Threat Flags

None. The record is on-device storage only; no network, analytics or Play call was added (T-99-07). Threat register: T-99-04 (listener failures swallowed, tested with a throwing and a rejecting listener), T-99-05 (apply step has its own try/catch, readable in the diff), T-99-06 (lazy dispatch queues behind a tracked load, first test in both new suites).

## Phase 100 and 101 API

```
import { setAchievementListener, getAchievementRecord, loadAchievements } from "./engineAdapter.js";
setAchievementListener(({ unlocks, reveals, progress }) => { ... }); // frozen; { id, at } / id / { id, value, steps }
getAchievementRecord();   // frozen record or null before boot(); record.unlocked[id] = date, record.revealed, record.run
```

`progressFor(record, entry)` from `achievementTracker.js` gives the list's "37 / 50" reading. Register the listener before the first action to hear everything; `boot()` has already loaded the record by then.

## Self-Check: PASSED

- Files exist: engineAdapter.js (hooks), the three test files, docs/SHELL-MODULES.md section.
- Commits exist: a5d6ab13, 2758ccb6, 4021f0ae.
