---
phase: 78-hud-dead-state-climb-decisions
plan: 04
subsystem: tests-and-docs
status: complete
tags: [parity, exposure-guard, save-resume, climb, docs]
requirements: [CLIMB-01, CLIMB-02]
dependency-graph:
  requires:
    - "78-01 (resolveHazard, pendingHazard, the measured zero exposure, the moved pins)"
  provides:
    - "test/parity/hazard-exposure.test.js: the standing no-hazard-at-any-replay-site guard"
    - "the resolveHazard relaunch probe in test/roundtrip/resume-roundtrip.test.js (CLIMB-02, the relaunch half)"
    - "the Plan 78-04 declaration under FIXTURE-INVENTORY.md's Phase 78 H2; the TERRAIN, ROLL-LEDGER and DIFFICULTY-RETUNE records"
  affects:
    - "78-09 (appends its own measured-zero note under the Phase 78 H2)"
    - "Phase 79.1 (owns the bot readout)"
tech-stack:
  added: []
  patterns:
    - "engine-only exposure replay per fixture site, with a teeth case on a hand-set tile"
key-files:
  created:
    - test/parity/hazard-exposure.test.js
  modified:
    - test/roundtrip/resume-roundtrip.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/DIFFICULTY-RETUNE.md
    - docs/TERRAIN.md
    - docs/ROLL-LEDGER.md
decisions:
  - "The guard's measured set is empty (78-01 measured zero); a hit fails with the reconcile instructions"
  - "The Phase 78 declaration is a ### Plan 78-04 subsection under the existing Phase 78 H2, not a second H2"
  - "DIFFICULTY-RETUNE's Phase 78 stub is completed with the guards; no readout (user ruling 2026-09-26)"
metrics:
  duration: "about 30 min"
  completed: 2026-09-26
  tasks: 2
  files: 6
---

# Phase 78 Plan 04: The pre-roll hazard decision, declared and guarded (CLIMB-01/02) Summary

This plan adds a standing parity guard that fails if any fixture site ever reaches a wall or crevice. It also adds a relaunch probe that commits every sampled pending climb or leap on the live and the reloaded state, and writes the four records the engine gate expects. No behaviour changed.

**Plan base SHA:** `c6de10dba86725e0c64e03aab460be96cf5bc3b6`. The phase base for the parity diff is 78-01's `e8bd4808`.

## What was built

- **test/parity/hazard-exposure.test.js (new)**
  - It replays all 31 fixture sites on the engine: 14 chargen seeds, movement, 6 combat, 4 magic, economy and 5 encounters. The replay shape is divergence-records.test.js's (engine only, full action objects).
  - It collects every `hazardChoice` event and every set `pendingHazard` as `<site>@<actionIndex>`, and asserts the set equals `MEASURED_HAZARD_SITES`.
  - **Measured set: empty (`[]`)**, matching 78-01's measurement. On a hit, the failure message explains the pause-versus-step divergence, names 78-01's reconcile decision and says where to declare the site.
  - Teeth case: a hand-set `climb` and a hand-set `gorge` next to the movement seed's hero are each caught at action 0. The guard's own assertion throws on them, and the same step with no feat is not a hit.
- **test/roundtrip/resume-roundtrip.test.js**
  - The pending-hazard probe is now `{ type: "resolveHazard", cross: true }` (it was a `move`, which re-pauses since 78-01). A CLIMB-02 comment explains why the commit is the meaningful probe.
  - A TURN BACK probe (`cross: false`) runs on a fresh relaunch of the first sampled pending hazard.
  - A new CLIMB-02 test checks four things:
    - the sample count is above zero;
    - at least one commit drew a die;
    - exactly one TURN BACK probe ran and cleared the record with `turnedBack`;
    - no `resolveHazard` probe differed.
  - **Corpus result: 44 pending hazards sampled, all 44 commits drew a die, 1 TURN BACK probe, 0 differences.** The file ran in about 25 s, inside its budget, and PER_RUN_CAP was not changed.
- **The four written sections**
  - test/parity/FIXTURE-INVENTORY.md, `### Plan 78-04 — the pre-roll hazard decision, declared and guarded (CLIMB-01/02): measured zero`, under the existing `## Phase 78` H2. It covers:
    - the rule, a declared canon divergence in movement timing;
    - the predictor (a pointer to 78-01's table);
    - the live scan: parity 66/66, the `e8bd4808` diff of fixtures, prototype and harness empty, prototype hash `a1f4d0dc…` unchanged;
    - draw identity (41 golden scenarios: 12 succeed, 24 fail and cross, 5 die);
    - Heights timing;
    - 78-01's pin table (label, before, after, cause);
    - the empty moved set;
    - the standing guards.
  - docs/DIFFICULTY-RETUNE.md: the existing `## v2.1 pre-roll wall/crevice decision (Phase 78) — bot readout` stub gains a bullet on 78-04's two guards. It stays right before `## v1.2 retune (Phase 27)`, which is still the last H2. The ledger test passes.
  - docs/TERRAIN.md, the Heights tile-key section: `noteHeightsAttempt` runs only on a committed climb or leap. The pause and TURN BACK never arm fear, and flight, ether and a tool cross before the pause. The declined-retry sentence is removed.
  - docs/ROLL-LEDGER.md: `## Phase 78 note (CLIMB-01)` is appended with a Node script, with CRLF kept and 8 added, 0 deleted lines. It closes Phase 74's climb-card hook. The card reads `rollOdds.js#hazardOddsText` over `engine/movement.js#hazardOdds`, which shares `climbFacesFor`/`leapFacesFor` with the roll. Sites 40-42 are unchanged; only the roll's timing moved.

## Verification

- `node --test test/parity/hazard-exposure.test.js test/roundtrip/resume-roundtrip.test.js`: 2/2 and 8/8 pass.
- `node --test "test/parity/**/*.test.js"`: 66/66 (64 plus the 2 new).
- `git diff --stat e8bd4808 -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness`: empty. `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.
- `node --test test/unit/roll-ledger-sync.test.js test/parity/fixture-inventory.test.js test/unit/stale-terms.test.js test/unit/difficulty-retune-ledger.test.js`: 26/26.
- `git diff --quiet c6de10db -- engine src`: exit 0.
- `npm test`: **7,049 / 7,049 pass, 0 fail** (7,046 plus 3 new tests).
- Grep gates:
  - `grep -c "^## Phase 78" test/parity/FIXTURE-INVENTORY.md` = 1.
  - `(Phase 78)` in DIFFICULTY-RETUNE.md: at least 1.
  - `Phase 78` in TERRAIN.md: at least 1.
  - `resolveHazard` in resume-roundtrip.test.js: at least 1.

## Deviations from Plan

### Plan changes by user ruling / orchestrator notes

- **No bot readout (user ruling 2026-09-26).**
  - The planned `## v2.1 HUD & climb decisions (Phase 78) — bot readout` section with 200-seed numbers was not written. 78-01's existing Phase 78 stub was completed instead, and the readout stays deferred to Phase 79.1.
  - The readout-file reads (`tools/readouts/78-01-*.txt`) were dropped, because those files do not exist.
  - No tune, fit or class tool was run.
- **No second Phase 78 H2 in FIXTURE-INVENTORY.md.** The plan asked for `## Phase 78: the pre-roll hazard decision ... — measured`. The H2 already existed from 78-01, so the declaration is a `### Plan 78-04` subsection under it (orchestrator note). The acceptance check `grep -c "^## Phase 78"` = 1 holds.

### Auto-fixed Issues

None.

## Known Stubs

None.

## Threat Flags

None. This plan changes tests and docs only.

## Self-Check: PASSED

- FOUND: test/parity/hazard-exposure.test.js, test/roundtrip/resume-roundtrip.test.js (resolveHazard probe), the four doc sections
- FOUND commits: 0d596397 (Task 1), 6ff0fdf6 (Task 2)
