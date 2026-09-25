---
phase: 73-engine-roll-high-mirror
plan: 02
subsystem: testing
tags: [roll-high, parity, bot-harness, save-compat, state-hash, sha256, node-test, tune-difficulty]

# Dependency graph
requires: []
provides:
  - "test/unit/harness/rollHighBaseline.js: canonicalJson/stateHash, PIN_RUNS/pinRun, loadSave/botSteps/replaySteps -- shared by the generator and every Phase 73 pinned test"
  - "tools/roll-high-baseline.mjs: pins mode (double-run determinism check) and save mode (pre-switch save + recorded continuation generator)"
  - "tools/roll-high-baseline-readout.txt: the full 200-seed tune-difficulty readout at the Phase 73 base, EXIT=0, matches Phase 72's AFTER block"
  - "tools/readout-compare.mjs: --recorded (subsequence against a docs/DIFFICULTY-RETUNE.md fenced block) and --exact (line-for-line) comparison modes"
  - "test/unit/roll-high-state-pins.test.js: 8 pinned bot-sweep state hashes on the untouched engine"
  - "test/unit/fixtures/roll-high/pre-switch-save.json + test/unit/roll-high-save-compat.test.js: a pre-switch save, its recorded 300-action continuation, and the compatibility test"
  - "test/parity/roll-high-invariant.test.js: the I1-I6 runtime roll invariant, OUTCOME empty / COMPLETE false in this plan, ready for 73-04 through 73-09 to extend"
affects: [73-03, 73-04, 73-05, 73-06, 73-07, 73-08, 73-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State-hash pinning: sha256 over a canonicalized (recursive key-sorted) JSON snapshot, with a named EXTRA_VOLATILE_FIELDS list (beyond diffState.js's stripVolatileFields) for fields that are pure save/load representation artifacts, not outcome divergences"
    - "botSteps/replaySteps share one dispatchOne helper so a targeted useAbility action's pre-dispatch combat.target write is re-derived identically on replay, never separately encoded in the recorded action list"
    - "Per-action event grouping for a roll invariant: copy the 31-site engine-only replay shape from test/parity/divergence-records.test.js's replaySiteEvents, but keep each action's events as its own array (not flattened) so an I3 outcome function can see `following` events in the same group"

key-files:
  created:
    - test/unit/harness/rollHighBaseline.js
    - tools/roll-high-baseline.mjs
    - tools/readout-compare.mjs
    - tools/roll-high-baseline-readout.txt
    - test/unit/roll-high-state-pins.test.js
    - test/unit/fixtures/roll-high/pre-switch-save.json
    - test/unit/roll-high-save-compat.test.js
    - test/parity/roll-high-invariant.test.js
  modified: []

key-decisions:
  - "pendingJoiner added to EXTRA_VOLATILE_FIELDS: engine/saveState.js's validateSave/rehydrate never carry it through a save/load round trip at all (unlike pendingFind/pendingHazard, explicitly nulled) -- a live `null` becomes an absent key after load, a pure representation artifact with zero outcome difference. Pre-existing engine/saveState.js characteristic, out of this plan's no-engine-edits scope."
  - "PIN_RUNS: 8 bot-sweep runs (4 solo -- 2 default, 1 forced Thief/Pilfer, 1 forced Magic User/Sorcerer -- 2 party, 2 deep starts at depth 8/14) chosen to reach far more check sites than the parity fixtures (which only reach solo level-1 Beasts/Humans)."
  - "Pre-switch save fixture: seed 909, party:true, startDepth 3, snapshotted at the first quiet step (i=5) that round-trips through loadSave, continued 300 actions."
  - "Runtime invariant event sources: the 31 parity replay sites (grouped per action, via a local copy of divergence-records.test.js's replaySiteEvents) plus a 4-run bot sweep (~4800 events alone) -- ~2000+ total events, all pass I1-I6 vacuously today since no event yet carries `atLeast`."

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "Bot-sweep state hashes pinned on the untouched engine (4 solo, 2 party, 2 deep starts), each verified deterministic across two independent runs before pinning"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "test/unit/roll-high-state-pins.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "A pre-switch save (built at this plan's base) loads through the shell's own path with no conversion, round-trips stable, and its recorded 300-action continuation replays to the pinned hash"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "test/unit/roll-high-save-compat.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The runtime roll invariant (I1-I6) over the 31 parity replay sites plus a bot sweep, with a synthetic self-test proving each rule fires"
    requirement: "ROLL-05"
    verification:
      - kind: integration
        ref: "test/parity/roll-high-invariant.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 200-seed tune-difficulty readout at the Phase 73 base matches every recorded line of Phase 72's AFTER block (docs/DIFFICULTY-RETUNE.md, commit d2adfd6) -- proves nothing drifted since the Phase 72 close"
    requirement: "ROLL-05"
    verification:
      - kind: other
        ref: "node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md \"### AFTER — commit d2adfd6\" tools/roll-high-baseline-readout.txt"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 02: Baseline Proof Machinery Summary

**Three independent BEFORE-the-switch baselines (bot-sweep state hashes, a pre-switch save with a recorded continuation, and the 200-seed readout) plus the runtime roll invariant test shell -- all pinned on the untouched engine, zero engine/content/src bytes touched.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-25T08:00:23-04:00 (worktree base)
- **Completed:** 2026-09-25T08:23:58-04:00
- **Tasks:** 3
- **Files modified:** 8 created, 0 modified outside this plan's own new files

## Accomplishments

- Pinned 8 bot-sweep final-state hashes (4 solo, 2 party, 2 deep starts near depth 8/14) on the untouched engine, each verified deterministic across two independent runs before pinning. Reaches Skeletons, climbs, traps, locks and party-member combat -- ground the parity fixtures (solo level-1 Beasts/Humans only) never touch.
- Built a pre-switch save fixture (seed 909, party, startDepth 3) snapshotted at the first quiet step that round-trips through the shell's own `validateSave`/`rehydrate` path, with a 300-action recorded continuation and a compatibility test (loads, idempotent round trip, resolves identically).
- Wrote `test/parity/roll-high-invariant.test.js`: the I1-I6 runtime roll invariant over the 31 parity replay sites (grouped per action) plus a 4-run bot sweep (~4800+ events), with a synthetic self-test proving each rule (out-of-range roll, a `need` beside `atLeast`, a wrong outcome, a missing OUTCOME row, a bad nested soak, a `critAtLeast` above the roll, and a forced-COMPLETE check without `atLeast`) actually fires. `OUTCOME` is empty and `COMPLETE = false` in this plan -- later plans (73-04 through 73-09) extend it event type by event type.
- Ran the 200-seed `tune-difficulty` readout at the Phase 73 base in the background (per the plan's instruction, before writing any code) and confirmed via `tools/readout-compare.mjs`'s `--recorded` subsequence check that it matches every line of Phase 72's AFTER block (`docs/DIFFICULTY-RETUNE.md`, commit d2adfd6) -- the base is byte-identical to the Phase 72 close; nothing drifted.
- Confirmed the only engine file that changed since the Phase 72 close (c3513b0) is `engine/records.js` (Phase 81 leaderboard bookkeeping, a deterministic content-field hash with no wall-clock reads) -- recorded in the fixture's `note`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Start the baseline readout, then pin the bot-sweep state hashes** - `724033b` (test)
2. **Task 2: The pre-switch save fixture and its compatibility test** - `6b70ee0` (test)
3. **Task 3: The runtime roll invariant, and the readout baseline check** - `57e6c83` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `test/unit/harness/rollHighBaseline.js` - canonicalJson/stateHash (sha256 over a key-sorted JSON snapshot, with a named EXTRA_VOLATILE_FIELDS list), PIN_RUNS/pinRun, loadSave (the shell's own validateSave+rehydrate sequence), botSteps/replaySteps (sharing one dispatchOne helper)
- `tools/roll-high-baseline.mjs` - `pins` mode (double-run determinism check + pinned-table printer) and `save` mode (pre-switch save + recorded continuation generator)
- `tools/roll-high-baseline-readout.txt` - the full 200-seed readout at this plan's base, `EXIT=0`
- `tools/readout-compare.mjs` - `--recorded` (subsequence against a doc's fenced block) and `--exact` (line-for-line) comparison modes
- `test/unit/roll-high-state-pins.test.js` - 8 pinned bot-sweep state hashes, one test per PIN_RUNS entry
- `test/unit/fixtures/roll-high/pre-switch-save.json` - the pre-switch save, its 300-action recorded continuation, and the expected final hash
- `test/unit/roll-high-save-compat.test.js` - loads, idempotency, and resolution tests over the pre-switch save
- `test/parity/roll-high-invariant.test.js` - the I1-I6 runtime roll invariant, its self-test, and the 31-site + bot-sweep event walk

## Decisions Made

- **`pendingJoiner` normalized in `EXTRA_VOLATILE_FIELDS`** (not a wall-clock field, but a pure save/load representation artifact -- see Deviations below).
- **PIN_RUNS composition:** 4 solo (2 default chargen, 1 forced Thief/Pilfer, 1 forced Magic User/Sorcerer) + 2 party + 2 deep starts (depth 8/14), each capped at 300-400 actions -- reaches Skeletons/climbs/traps/locks/party combat while keeping the whole pins test under 30s (measured ~5s).
- **Save fixture scenario:** seed 909, party:true, startDepth 3, snapshot at the first quiet step (i=5) whose save round-trips through `loadSave`, continued 300 actions -- comfortably over the 200-entry acceptance floor.
- **Bot-sweep event sources for the invariant:** 4 runs (2 solo, 1 party, 1 deep start near depth 10), maxActions 1000-1200 each, producing ~4800 events alone (well past "some thousands" combined with the 31-site replay), while keeping the whole invariant test under 4s (measured).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pendingJoiner` never round-trips through save/load; normalized in the state-hash harness**
- **Found during:** Task 2 (the pre-switch save's round-trip check kept failing on every quiet step)
- **Issue:** `engine/saveState.js`'s `validateSave`/`rehydrate` never carry `pendingJoiner` through a save/load round trip at all -- unlike `pendingFind`/`pendingHazard`, which ARE explicitly reset to `null` on load. A live value of `null` (set by `encounters.js#resolveJoiner`, e.g. `forceParty`'s own write-path, or a real in-run Joiner meeting that later resolves) becomes an ABSENT key after `loadSave` -- `undefined` and `null` both mean "no pending Joiner decision" to every engine/UI reader, so this is pure JSON-representation noise, not an outcome divergence. Pre-existing `engine/saveState.js` behavior, discovered while building this plan's harness -- out of this plan's "no engine/ changes" scope, so left untouched.
- **Fix:** Added `pendingJoiner` to `test/unit/harness/rollHighBaseline.js`'s `EXTRA_VOLATILE_FIELDS`, so `stateHash` normalizes it away (deleted from both sides before hashing) the same way it already strips `deathAt`/`graves[].when`.
- **Files modified:** `test/unit/harness/rollHighBaseline.js`, `test/unit/roll-high-state-pins.test.js` (party-1, party-fighter-knight, deep-14 pinned hashes regenerated -- solo runs unaffected, confirming they never met a Joiner in their action budget)
- **Verification:** `node tools/roll-high-baseline.mjs pins` (all 8 entries hash identically twice) + `node --test test/unit/roll-high-state-pins.test.js` (9/9 pass)
- **Committed in:** `6b70ee0` (Task 2 commit)

**2. [Rule 1 - Bug] `replaySteps` didn't redo a targeted `useAbility` action's `combat.target` write**
- **Found during:** Task 2 (the save-compat "resolution" test's replayed depth diverged from the generator's own recorded expectation: 3 vs 4)
- **Issue:** `botSteps` writes `state.combat.target` in place immediately before dispatching a targeted `useAbility` action, then records the bare `{ type: "useAbility", key }` (no `target` field, mirroring `playRun`'s own loop). `replaySteps` re-applied that bare action via `applyAction` with no target ever written -- a different (or absent) target than the original run, diverging the replay's outcome whenever any targeted ability fired during the recorded continuation.
- **Fix:** Extracted a shared `dispatchOne(state, action)` helper (the target-write-then-bare-dispatch logic) used identically by both `botSteps` (recording, now storing the ORIGINAL action with its `target` field) and `replaySteps` (replay, re-deriving the same write from each recorded action).
- **Files modified:** `test/unit/harness/rollHighBaseline.js`
- **Verification:** `node tools/roll-high-baseline.mjs save` regenerated the fixture with the identical final hash (confirming the underlying engine dispatch sequence was always correct -- only the harness's own replay path was wrong); `node --test test/unit/roll-high-save-compat.test.js` (4/4 pass)
- **Committed in:** `6b70ee0` (Task 2 commit)

**3. [Rule 1 - Bug] `readout-compare.mjs --recorded` matched the heading text after stripping its `#` markup, but callers pass a prefix that includes it**
- **Found during:** Task 3 (the exact `--recorded` invocation from the plan's own verification block threw "no heading found")
- **Issue:** `extractFencedBlock` matched a heading's TEXT (after stripping the leading `#`s) against `headingPrefix`, but the plan's own example invocation passes `"### AFTER — commit d2adfd6"` -- including the `###` markup.
- **Fix:** Match the FULL raw line (including its leading `#`s) against `headingPrefix`, so a caller's prefix reads exactly as it appears in the `.md` source.
- **Files modified:** `tools/readout-compare.mjs`
- **Verification:** `node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md "### AFTER — commit d2adfd6" tools/roll-high-baseline-readout.txt` exits 0; a deliberately-truncated readout file correctly fails with the first missing line reported
- **Committed in:** `57e6c83` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs in this plan's OWN harness/tooling code, discovered and fixed before the plan's tasks completed; zero engine/content/src changes at any point)
**Impact on plan:** All three fixes were necessary for the plan's own verification to pass honestly (a silently-wrong replay or a silently-unusable CLI invocation would have undermined the "proof it changed nothing" purpose of this plan). No scope creep -- all three stayed inside `test/unit/harness/`, `tools/`, and the plan's own new test files.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The proof machinery is in place for every later Phase 73 plan: `test/unit/harness/rollHighBaseline.js`'s `stateHash`/`pinRun`/`loadSave`/`botSteps`/`replaySteps` are ready to reuse, `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table and `COMPLETE` flag are ready for 73-04 through 73-09 to extend event type by event type, and `docs/ROLL-LEDGER.md`'s `### Event fields (Phase 73)` section (73-03) is the documented contract those OUTCOME rows will implement against.
- Three independent baselines are pinned BEFORE any engine edit: the 8-run bot-sweep state hashes, the pre-switch save's recorded continuation, and the 200-seed readout (confirmed byte-identical to Phase 72's AFTER block). Any later plan that moves one of these pins has flipped a check site wrong -- fix the site, never re-pin (per every header comment in this plan's test files).
- No blockers. `git status --porcelain -- engine/ content/ src/` is empty; the full parity suite is green (52/52); `npm test` shows only the 7 known worktree-only CRLF doc-ledger failures (unrelated to this plan, pass on master).

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

All 8 created files found on disk; all 3 task commits (724033b, 6b70ee0, 57e6c83) found in git log.
