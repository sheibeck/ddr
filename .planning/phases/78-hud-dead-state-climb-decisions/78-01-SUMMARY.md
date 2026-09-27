---
phase: 78-hud-dead-state-climb-decisions
plan: 01
subsystem: engine
status: complete
tags: [engine, movement, climb, pending-decision, save-resume, tuning-bot, narration]
requirements: [CLIMB-01, CLIMB-02]
dependency-graph:
  requires:
    - "Phase 76 relaunch persistence (engine/saveState.js#resumedSubState, sanitizePendingHazard)"
    - "Phase 54 one-and-done crossing; Phase 73 roll-high rollCheck/atLeastFor"
  provides:
    - "engine/movement.js#resolveHazard (commit / TURN BACK) and the pause for every wall and crevice"
    - "engine/movement.js#hazardOdds, climbFacesFor, leapFacesFor (one faces formula for the roll and the card)"
    - "the resolveHazard action (engine/actions.js, engine/engine.js)"
    - "hazardChoice (carried) and turnedBack narration"
  affects:
    - "78-03 (the rail card reads hazardOdds and dispatches resolveHazard; until then the shell's roll button sends a plain move, which now re-pauses)"
    - "78-04 (the relaunch probe in test/roundtrip/resume-roundtrip.test.js still answers a pending hazard with a move)"
    - "Phase 79.1 (the bot readout for this change)"
tech-stack:
  added: []
  patterns:
    - "pending decision + commit/cancel action (pendingJoiner/resolveJoiner precedent)"
    - "golden capture on the plan base, replayed as a draw-identity proof"
key-files:
  created:
    - test/unit/hazard-decision.test.js
    - test/unit/fixtures/hazard-commit/golden.json
  modified:
    - engine/movement.js
    - engine/actions.js
    - engine/engine.js
    - engine/saveState.js
    - engine/state.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/tuning-bot.mjs
    - docs/DIFFICULTY-RETUNE.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/actions.test.js
    - test/unit/save-resume.test.js
    - test/unit/tools.test.js
    - test/unit/movement.test.js
    - test/unit/phobia-triggers.test.js
    - test/unit/one-and-done-lines.test.js
    - test/unit/clarity-cause-lines.test.js
    - test/unit/gear-axes.test.js
    - test/unit/rollDirection-checks.test.js
    - test/unit/bot-buy-policy.test.js
    - test/unit/combat-gear-lock.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/roll-high-save-compat.test.js
    - test/unit/fixtures/roll-high/pre-switch-save.json
decisions:
  - "Every step toward a wall or crevice pauses on { feat, dir, tool } with no dice; resolveHazard { cross } commits (the old roll, draw for draw) or turns back for free"
  - "Heights arms on the commit, not the step (declared rules-timing change)"
  - "The bot always commits (useTool when carried); an uncarried pause and its commit count as one floor action"
  - "The relaunch sanitizer requires tool to match the feat and tolerates an old save's declined flag (wholesale load)"
  - "No bot balance runs (user ruling 2026-09-26): the readout is deferred to Phase 79.1"
metrics:
  duration: "about 60 min"
  completed: 2026-09-26
  tasks: 3
  files: 26
---

# Phase 78 Plan 01: The pre-roll wall/crevice decision (CLIMB-01/02) Summary

Every step toward a wall or crevice now pauses on one engine decision. `state.pendingHazard = { feat, dir, tool }` is set, a `hazardChoice { carried }` event fires, and no die is drawn. `resolveHazard { cross: true }` then replays the pre-Phase-78 roll draw for draw, `cross: false` (TURN BACK) is free, and a golden capture of 41 scenarios from the plan base proves no die changed.

**Plan base SHA:** `e8bd4808afa8efafef6bf628f08f313f521b0576`

## What was built

- **engine/movement.js**
  - The pause replaces the Phase 39 tool-only pre-check and its `declined` retry flag (greenfield, one path). The tool, flight and ether branches still run ahead of the pause.
  - `move` takes a new internal knob, `opts.commit`, set only by `resolveHazard`.
  - `resolveHazard(state, cross, rng, events, now)` is a no-op in combat, in a store, when dead, or with no pending record. TURN BACK clears the record and pushes `turnedBack`. The commit clears the record first, so a fatal fall never leaves one behind. It then re-enters `move` with `opts.commit`. If the target cell has lost its feat, the commit just clears the record.
  - The roll and `hazardOdds(state, feat)` share two helpers, `climbFacesFor(c, kind)` and `leapFacesFor(c, row)`.
    - `hazardOdds` returns `{ feat, dieN: 10, rolls, cases[{ label, faces, atLeast, fall }], penalties[{ name, faces }] }`. It is pure, never throws, and returns empty cases for an unknown feat.
  - `noteHeightsAttempt` now sits after the pause, so Heights arms only on a commit.
- **engine/actions.js, engine/engine.js:** `resolveHazard` is in ACTION_TYPES, and the validator requires a strict boolean `cross` (reason `resolveHazard.cross must be a boolean`). `applyAction` has a `resolveHazard(next, ...)` case.
- **engine/saveState.js:** `sanitizePendingHazard` requires:
  - `feat` is climb or gorge;
  - `dir` is a DIRV key;
  - `tool` is the feat's own TOOLS key;
  - the neighbour cell still carries the feat.

  An old record with `declined` loads wholesale and commits. engine/state.js got a comment-only update.
- **Narration:**
  - `hazardChoice` gains two lines for a hero without the tool, a wall one and a crevice one. It stays in ORACLE_ONLY, with its reason reworded.
  - `turnedBack` has an Oracle line and a LINE_FOR rail line (tone beat, priority other).
- **tools/lib/tuning-bot.mjs:**
  - `decideAction` answers a pending hazard on the next action: `useTool` when `hasTool` says the tool is carried, otherwise `resolveHazard cross true`. The bot never turns back.
  - `observe` does not count a pause whose `hazardChoice` has `carried` false.

## Measurements (Task 1, on the unchanged engine)

### Parity exposure

A temporary probe sat at the top of move's climb/gorge block while `node --test "test/parity/**/*.test.js"` ran. It was reverted before the first edit.

| Fixture site | Hazard steps |
|---|---|
| action-script.chargen.json (14 seeds) | 0 |
| action-script.movement.json | 0 |
| action-script.combat.json (win, lose, lose-apprentice, lose-plain, flee, parley) | 0 |
| action-script.magic.json (cast-damage, heal, potion, scroll) | 0 |
| action-script.economy.json | 0 |
| action-script.encounters.json (trap, chest, tablefour, faerie, affliction) | 0 |
| roll-high-invariant.test.js bot seeds 9001-9004 (live replays, not fixtures) | 29, none with the tool |

The fixture exposure is zero. No harness reconcile was needed, and the fixtures, the harness and prototype-master.js.txt are untouched (hash `a1f4d0dc…` unchanged). The fixture-inventory roster is identical before and after (diffed).

### Bot exposure

Every run is shipped-dials unless marked. The count is hazard crossings inside the budget. "pilfer" means the run has a Pilfer hero.

- **PIN_RUNS:**
  - solo-1: first crossing at step 123. solo-2: 259. solo-thief-pilfer (pilfer): 68. solo-magicuser-sorcerer: 23. party-1: 72.
  - party-fighter-knight, deep-8 and deep-14 reach no hazard.
- **bot-tactics seeds** (Knight/Human 1, 2, 3, 5, 6 at 2000 actions and 1-5 at 1000; Pilfer 2, 3, 4; Sorcerer 4, 2, 3; Knight/Troll 5, 2, 4): all cross hazards. Tool carriers at seed 2 (step 472) and seed 3 (step 216) already paused under Phase 39.
- **The invariant bot seeds 9001-9004:** all cross. 9003 has a Pilfer.

### Golden scenarios

`test/unit/fixtures/hazard-commit/golden.json` holds 41 scenarios on 13 newRun bases:

- Fighter, Thief and Magic User at a wall and at a crevice, over seeds 1-3.
- A Heights-phobic climber.
- A Bodies-of-water-phobic leaper, with and without Hardiness.
- Plate at a wall and at a crevice.
- A hero with a party.
- Three fatal climbs and two fatal leaps.

Outcomes: **12 succeed, 24 fail and cross, 5 die.** Each scenario stores the input recipe (a base plus a c-patch and the target feat), the move, the output state hash (the harness `stateHash`, minus `acts` and `pendingHazard`), a readable summary, the events and the rngState.

Before the engine change, `node --test test/unit/hazard-decision.test.js` failed with `SyntaxError: ... does not provide an export named 'hazardOdds'` (commit e943c25d). After Task 2 all 26 tests pass.

## Moved tests and pins (before -> after, cause)

| File / label | Before | After | Cause |
|---|---|---|---|
| roll-high-state-pins `solo-1` | `ce883a88…` | `5ab327e8…` | 4 uncarried pauses; the same game step for step, cut 4 actions short by the 400 budget |
| `solo-2` | `3cabf90f…` | `368ef81d…` | 3 pauses; same game, cut 3 short |
| `solo-magicuser-sorcerer` | `444ec2ca…` | `3121f6b2…` | 7 pauses; same game, cut 7 short |
| `party-1` | `ab7a42cb…` | `673f322d…` | 5 pauses; same game, cut 5 short |
| `solo-thief-pilfer` | `3371e1f8…` | `5618fcf6…` | 3 pauses; identical to step 137, then the acts-keyed `scrollRead` derived stream fumbles a read that deciphered before |
| party-fighter-knight, deep-8, deep-14 | unchanged | unchanged | no hazard in budget |
| pre-switch-save.json `expected.hash` | `43b71a38…` | `70f1de84…` | The recorded `move N` at dispatched 233 now pauses at the wall (4 pauses: 233, 234, 237, 240). `dead`/`depth`/`actions` stay false/4/300; only `expected` was re-recorded |

`actions`, `dead` and `depth` are unchanged for every re-pinned label. The pins were regenerated with `node tools/roll-high-baseline.mjs pins` three times, identical each time. The bisection was a scratch per-step full-state-hash trace against a plan-base copy of the engine (a `git archive` in scratch), with pauses dropped.

The moved test files:

- **Roll tests:** movement.test.js (14 tests), clarity-cause-lines (2), gear-axes (1), one-and-done-lines (2) and rollDirection-checks (the `climbedClean`/`leapedClean` helpers) now `move` then commit via a local `moveAndCommit` helper, with the same dice.
- **tools.test.js:** the hazard block now pins the pause for every hero, the re-pause, the commit and the record shape.
- **phobia-triggers.test.js:** Heights fires only on the commit. A new test checks that TURN BACK arms nothing.
- **save-resume.test.js:** the new record shape, the tool/feat mismatch drop, and a new tolerant old-record case.
- **actions.test.js:** new resolveHazard cases.
- **bot-buy-policy.test.js:** the bot uses its tool when carried and commits without one.
- **combat-gear-lock.test.js:** the payload table gains `resolveHazard`.
- **roll-high-save-compat.test.js:** header comment only.

The bot-tactics seeds and the roll-high-invariant seeds kept every assertion, and no seed was swapped. The divergences were traced:

- Knight/Human seed 5 (identity dials): a scroll read at step 142.
- Knight/Troll seed 4: a scroll read at 441.
- Pilfer seeds 2 and 3: scroll reads at 74 and 222.
- Pilfer seed 4: a Pilfer fumble at 861.
- Invariant seeds 9002 and 9003: scroll reads at 180 and 376.

Every other seed's route is identical once pauses are removed.

## Readout comparison

None, by user ruling (2026-09-26): no bot balance runs until Phase 79.1. No `tools/readouts/78-01-*.txt` files were created. docs/DIFFICULTY-RETUNE.md has a Phase 78 H2 stub placed just before `## v1.2 retune (Phase 27)`, which stays the last H2 (the ledger test passes). The stub lists the change and defers the readout. Every test/difficulty band test passes in `npm test`, with no compensating change.

## Voice record (new narration strings)

- hazardChoice, wall, no ladder (Oracle): "A wall. No ladder. Just you, your fingers, and a strong opinion about gravity."
- hazardChoice, crevice, no rope (Oracle): "A crevice. No rope. The gap is waiting to see how far you think you can jump."
- turnedBack, wall (Oracle): "You leave the wall unclimbed. It does not seem to mind."
- turnedBack, crevice (Oracle): "You step back from the edge. The crevice will be here, being deep, when you change your mind."
- turnedBack, wall (rail line): "You leave the wall alone. Nothing rolled, nothing lost."
- turnedBack, crevice (rail line): "You back away from the crevice. Nothing rolled, nothing lost."

## Verification

- `node --test test/unit/hazard-decision.test.js test/unit/actions.test.js test/unit/save-resume.test.js test/unit/formatEventsCoverage.test.js test/unit/narrationLinesTable.test.js test/unit/stale-terms.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js`: all pass.
- `node --test "test/parity/**/*.test.js"`: 64/64. `git diff --quiet e8bd4808 -- test/parity/prototype-master.js.txt test/parity/fixtures` exits 0.
- `test/unit/event-order-fold.test.js` passes; the default-fold corpus did not move and was not regenerated.
- `npm test`: **7,011 / 7,011 pass, 0 fail.**
- `npm run build:www` + `node tools/shell-boot-check.mjs`: PASS (painted, graves, title). This used a temporary node_modules junction, removed afterwards; www/ is gitignored and was not committed.
- Grep gates: `export function resolveHazard` 1, `export function hazardOdds` 1, `resolveHazard(next` in engine.js 1, `resolveHazard` in actions.js 3, `turnedBack` in both narration files, and `resolveHazard` in tuning-bot.mjs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] My own new comments broke the rng draw-line pin**
- **Found during:** Task 3 (npm test)
- **Issue:** test/unit/rations-audit.test.js pins 18 lines containing `rng.` in engine/movement.js. Three new JSDoc lines ("Pure, no rng." and the LEAP_FALL note) raised the count to 21.
- **Fix:** reworded the comments ("Pure; draws nothing."). No code change.
- **Commit:** 4cbe56f5

**2. [Rule 3 - Blocking] Tests outside the plan's list moved**
- **Found during:** Task 3 (npm test)
- **Issue:** bot-buy-policy.test.js pinned the retired `declined` fall-through. combat-gear-lock.test.js requires its payload table to cover every ACTION_TYPES entry. roll-high-save-compat.test.js's fixture continuation moved.
- **Fix:** updated each one with a CLIMB-01 comment, per the plan's "fix any other test the change moves".
- **Commit:** 4cbe56f5

### Plan changes by user ruling (orchestrator notes)

- **No bot balance runs.** No BEFORE/AFTER `tune-difficulty` readouts and no `--json` per-seed comparison were made, and no `tools/readouts/78-01-*.txt` files exist. A Phase 78 H2 stub went into docs/DIFFICULTY-RETUNE.md instead.
- **FIXTURE-INVENTORY.md** got a `## Phase 78` heading with a `### Plan 78-01` subsection at the end of the file.

### Design choices within the plan

- **The golden fixture stores its input as a recipe, not full states.** Each scenario is a shared newRun base (stored in full) plus a c-patch and the target cell. Each output is stored as a canonical state hash plus a summary, not a full state. Full input and output states would have been about 1.5 MB; the file is 268 KB. The test rebuilds the input from the stored base, so chargen drift can never change it.
- **The rng cursor is compared unsigned.** `newRun` stores the cursor signed and `applyAction` persists it unsigned (`>>> 0`), so the test's "rng unchanged" checks compare `cursor >>> 0`.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the `resolveHazard` action, validated at the engine chokepoint (a strict boolean), and the save sanitizer, which got tighter: the tool must match the feat.

## Self-Check: PASSED

- FOUND: test/unit/hazard-decision.test.js, test/unit/fixtures/hazard-commit/golden.json, engine/movement.js (resolveHazard, hazardOdds)
- FOUND commits: e943c25d (Task 1), 5f1a08b0 (Task 2), 4cbe56f5 (Task 3)
