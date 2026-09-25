---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 05
subsystem: engine
tags: [grimoire, spells, chargen, magic-user, rules-fix, parity-fixtures]

# Dependency graph
requires:
  - phase: 75-02-rules-01-02-verify-and-cache-cut
    provides: "WILMST_CACHE_PER_DEPTH 300 -> 100 (unrelated to this plan's grimoire change, but the shared plan-base commit)"
provides:
  - "content/mu-chart.js: MU_CHART.Summoner carries no gate object — the offense school is open from level 1"
  - "engine/character.js#grantableAt(sub, sp, level): the one grant-time-legality predicate (canLearn && schoolGate <= level)"
  - "grantableAt wired into all four grant paths: rollGrimoire's low/high walks (new level param), checkLevel's Sorcerer gain and Apprentice reveal, engine/encounters.js#findGrimoire"
  - "test/unit/grimoire-legality.test.js: the grant-time legality sweep, boundary cases, must-have proof, and zero-draw guarantee"
  - "The Phase 75 FIXTURE-INVENTORY section + RULES75_EXPECTED_HOLDERS guard, declaring the three measured moved chargen/combat records"
affects: [75-10-summoner-healing-weakness, 75-13-fixture-inventory-and-retune-ledger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grant-time legality: a predicate (grantableAt) is threaded through every spell-GRANT path as a skip-while-walking filter over an already-shuffled list — never a re-roll, never a re-shuffle, so a legality fix adds zero rng draws and never reorders an existing draw."
    - "Fixture-move investigation before re-pinning: every predicted-mover seed is replayed LIVE (newRun(seed) / the fixture's own action script) and compared to the currently-declared value before touching a pin — a predicted mover that measures unchanged (seed 15) is left alone; an UNPREDICTED mover found this way (roll-high-state-pins.test.js's solo-1/solo-2/party-1/deep-8) is investigated for causation (confirmed: all four roll a gated Magic User sub-class) before being re-pinned, mirroring 75-02's own precedent."

key-files:
  created:
    - test/unit/grimoire-legality.test.js
    - tools/readouts/75-05-before.txt
    - tools/readouts/75-05-after.txt
  modified:
    - content/mu-chart.js
    - engine/character.js
    - engine/encounters.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/divergence-records.test.js
    - test/unit/identity-contract.test.js
    - test/unit/casters-can-act.test.js
    - test/unit/chargen-rng-pin.test.js
    - test/unit/day-one-damage.test.js
    - test/unit/guaranteed-attack-spell.test.js
    - test/unit/spell-level-overrides.test.js
    - test/unit/roll-high-state-pins.test.js

key-decisions:
  - "Grant-time legality means the school gate only (the flagged planner assumption, accepted): a book still holds higher-LEVEL spells as canon does (the must-have grants are above level 1 by design); the cast-time level lock stays entirely inside canCast."
  - "The Apprentice's level-3 reveal filters with grantableAt(newSub, spell, newLevel) instead of canLearn alone — a spell whose school is still gated above 3 for the new sub is dropped, not just a spell the new sub can never learn at all."
  - "Seed 15 (the Summoner, the plan's own predicted chargen mover) was measured live and found NOT to move — its book is byte-identical to the already-declared Phase 40 value. Only seeds 24 (Apprentice) and 29 (Warlock), plus combat's lose-apprentice (seed 127, Apprentice), actually move."
  - "roll-high-state-pins.test.js's solo-1/solo-2/party-1/deep-8 (outside this plan's declared files_modified) were re-pinned after confirming causation: all four roll a gated Magic User sub-class (Court Mage x3, Apprentice x1) whose chargen book composition changes under the new grant filter, cascading into a genuinely different 300-400-action bot-sweep outcome — verified via newRun(seed).c.sub and regenerated via the standing tool (hashed identically twice each), the same investigate-then-re-pin discipline 75-02 established for deep-8/deep-14."

requirements-completed: [RULES-03]

coverage:
  - id: D1
    description: "The Summoner's offense school gate is removed (content/mu-chart.js); schoolGate('Summoner', 'offense') reads 1, and a level-1 Summoner holding an offense spell (e.g. Freeze) passes canCast."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/grimoire-legality.test.js#RULES-03: schoolGate('Summoner', 'offense') is 1, and a level-1 Summoner holding Freeze passes canCast"
        status: pass
      - kind: unit
        ref: "test/unit/day-one-damage.test.js#RULES-03 (Phase 75): schoolGate('Summoner', 'offense') is 1 and a level-1 Summoner holding Freeze passes canCast"
        status: pass
      - kind: unit
        ref: "test/unit/casters-can-act.test.js#RULES-03: no MU_CHART sub-class gates the offense school any more"
        status: pass
    human_judgment: false
  - id: D2
    description: "grantableAt(sub, sp, level) — one predicate wired into all four grant paths (rollGrimoire's low/high walks, checkLevel's Sorcerer gain and Apprentice reveal, findGrimoire) — never grants a gated sub-class a spell whose school is still closed at that level; a gate equal to the level is open (the boundary)."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/grimoire-legality.test.js (11 tests: boundary, must-have, 200-seed chargen sweep, findGrimoire level-2/3, checkLevel Sorcerer/Apprentice)"
        status: pass
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js#rollGrimoire draws a constant, pinned number of rng values per sub-class"
        status: pass
    human_judgment: false
  - id: D3
    description: "The filter adds zero rng draws and reorders nothing — every grant path skips while walking an already-shuffled list."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/grimoire-legality.test.js#rollGrimoire's main-rng draw count is UNCHANGED for every non-Summoner sub, over seeds 1..50"
        status: pass
      - kind: unit
        ref: "test/unit/roll-high-guard.test.js (DRAW_INVENTORY unchanged, every raw draw tagged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every moved parity fixture is measured live, declared with phase +75/requirements RULES-03, and regenerated; nothing else moves. Prototype master untouched."
    requirement: RULES-03
    verification:
      - kind: integration
        ref: 'node --test "test/parity/**/*.test.js" (54/54)'
        status: pass
      - kind: unit
        ref: "test/parity/divergence-records.test.js#RULES-03 (Phase 75): the holders declaring Phase 75 are exactly the measured moved set"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 200-seed bot readout taken before and after the change (tools/readouts/75-05-before.txt / -after.txt)."
    requirement: RULES-03
    verification:
      - kind: other
        ref: "tools/readouts/75-05-before.txt, tools/readouts/75-05-after.txt (both committed, non-empty)"
        status: pass
    human_judgment: true
    rationale: "The Pixel 7 human-check (a level-1 Summoner can roll and cast an offense spell; a new Warlock/Apprentice never has a spell that says 'is not open to you yet') is deferred to the milestone-close UAT batch per this project's standing Deferred UAT protocol, not run by this executor."

duration: 130min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 05: Summoner Gate Removal + Grant-Time Legality (RULES-03) Summary

**Removed the Summoner's offense school gate (content/mu-chart.js) and added `grantableAt(sub, sp, level)`, one grant-time-legality predicate wired into all four spell-grant paths, so a gated sub-class (Warlock/Sorcerer/Court Mage/Illusionist/Cleric/Apprentice) is never handed a spell whose school is still closed — zero added or reordered rng draws.**

## Performance

- **Duration:** ~130 min
- **Started:** 2026-09-25 (worktree base 5e7fe0c)
- **Completed:** 2026-09-25
- **Tasks:** 3 completed
- **Files modified:** 17 (3 engine/content, 11 test, 2 parity fixtures + inventory/guard, 2 readouts, 1 new test file)

## Accomplishments

- **The Summoner's offense gate is gone.** `content/mu-chart.js`'s `Summoner` row no longer carries a `gate` key at all — `schoolGate("Summoner", "offense")` reads the default `1`. A level-1 Summoner holding Freeze now passes `canCast`. The Summoner's trade-off stays the summon backfire (one Summon in eight turns turns on its caster); 75-10 later adds the halved-healing weakness.
- **One grant predicate, four call sites.** `engine/character.js#grantableAt(sub, sp, level)` = `canLearn(sub, sp) && schoolGate(sub, sp.s) <= level`. Wired into: `rollGrimoire`'s `low`/`high` walks (a new `level` parameter, default 1, for the chargen caller); `checkLevel`'s Sorcerer level-up gain (walks the same shuffled `fresh` list, takes the first two GRANTABLE entries instead of a blind `slice(0,2)`); `checkLevel`'s Apprentice level-3 reveal (filters the surviving book with `grantableAt(newSub, spell, newLevel)` instead of `canLearn` alone); and `engine/encounters.js#findGrimoire` (the d4 walk takes only grantable spells from the already-shuffled learnable list). Every site SKIPS a non-grantable spell while walking — never re-rolls, never re-shuffles, so the zero-draw guarantee holds (proven for every non-Summoner sub over 50 seeds, and pinned by the independently-derived formula in `test/unit/chargen-rng-pin.test.js`).
- **Grant-time legality boundary proven.** A school gated at 3 is illegal to grant at level 1 or 2, legal at level 3 (gate equal to level is open) — pinned with real content (Cleric's divination gate 3, Warlock's protection gate 4 and healing gate 3) in `test/unit/grimoire-legality.test.js`, plus a 200-seed sweep per gated sub-class proving the chargen book never holds an illegally-gated spell.
- **Every must-have grant is self-consistent.** Cleric's Heal/Major Heal, Illusionist's Mirror Self/Phantom Host, Summoner's Summon/Lesser Summon, and Sorcerer's Freeze/Fireball are all from a school whose gate for their OWN sub-class is 1 — pinned directly, not assumed.
- **Fixture measurement found fewer movers than predicted, not more.** The plan predicted chargen seeds 15/24/29 plus combat's lose-apprentice. Live measurement found seed 15 (Summoner) does NOT actually move — its grimoire is byte-identical to the existing Phase 40 declared value (the widened day-one `spare` pool shifts the SHUFFLE's draw count for this sub, per the re-measured `ROLL_GRIMOIRE_DRAW_COUNTS.Summoner: 31 -> 36`, but this particular seed's final book content happens to land the same). Seeds 24 (Apprentice, Map the Floor dropped for Weaken) and 29 (Warlock, Shield dropped for Doze), and combat's lose-apprentice (seed 127, same Apprentice cause), DO move — declared, measured, and regenerated. `test/parity/prototype-master.js.txt` untouched (hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `node --test "test/parity/**/*.test.js"` is 54/54.
- **A wider, unpredicted ripple found and investigated, not assumed.** `test/unit/roll-high-state-pins.test.js`'s 300-400-action bot sweeps `solo-1`, `solo-2`, `party-1` and `deep-8` also moved — all four roll a gated Magic User sub-class (Court Mage x3, Apprentice x1), confirmed via `newRun(seed).c.sub`, whose chargen book composition changes under the new grant filter and cascades into a genuinely different multi-hundred-action outcome (solo-2 flips dead@228 -> alive@400; deep-8 flips alive@300 -> dead@93). Re-pinned via the standing `node tools/roll-high-baseline.mjs pins` tool (each hashed identically twice), with a rationale comment naming the cause — the same investigate-then-re-pin discipline 75-02 established for `deep-8`/`deep-14`.
- **Before/after 200-seed bot readout committed.** Death-depth p50 unchanged at 7 (min 2/p90 13/max 40, both runs); Magic User class-pool offensive casts move 270/1412 -> 262/1450 (more offense casts overall, consistent with a level-1 Summoner now casting offense); outcome split 175/25 -> 177/23 dead/stuck. No material balance shift.
- `npm test`: 6053/6053 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the Summoner gate and put one grant predicate on every grant path** - `aae50d7` (feat)
2. **Task 2: Measure, declare and regenerate the moved fixtures; add the Phase 75 inventory section and guard** - `0e78e7d` (docs)
3. **Task 3: Re-pin the identity and chargen tests, then take the AFTER readout** - `3be1c3d` (test) + `cc7bc2a` (docs: before/after readouts)

**Plan metadata:** (this commit, made by the orchestrator after wave close)

## Files Created/Modified

- `content/mu-chart.js` — `MU_CHART.Summoner.gate` deleted entirely
- `engine/character.js` — new exported `grantableAt`; `rollGrimoire`'s `low`/`high` walks take a `level` param and skip non-grantable spells; `checkLevel`'s Sorcerer gain and Apprentice reveal route through `grantableAt`
- `engine/encounters.js` — `findGrimoire` walks the shuffled `learnable` list, taking only grantable spells up to the drawn `k`
- `test/unit/grimoire-legality.test.js` — new: the full RULES-03 grant-time legality sweep (11 tests)
- `test/parity/fixtures/action-script.chargen.json` — seeds 24 and 29's `divergences` records updated in place (phase +75, requirements +RULES-03, measured `after.grimoire`, extended rationale)
- `test/parity/fixtures/action-script.combat.json` — `lose-apprentice`'s `chargenDivergence` updated the same way
- `test/parity/FIXTURE-INVENTORY.md` — new `## Phase 75` section with the Plan 05 predictor, live-scan results, and moved-set table
- `test/parity/divergence-records.test.js` — new `RULES75_EXPECTED_HOLDERS` guard test
- `test/unit/identity-contract.test.js` — the Summoner "bad" entry re-pinned to the summon backfire
- `test/unit/casters-can-act.test.js` — IDENT-01's Summoner school-lock case replaced with a level-lock case + an offense-gate sweep
- `test/unit/chargen-rng-pin.test.js`, `test/unit/day-one-damage.test.js` — seed 15's cursor and the Summoner's rollGrimoire draw count (31 -> 36) re-measured live
- `test/unit/guaranteed-attack-spell.test.js`, `test/unit/spell-level-overrides.test.js`, `test/unit/roll-high-state-pins.test.js` — deviation re-pins (see below)
- `tools/readouts/75-05-before.txt` / `tools/readouts/75-05-after.txt` — the 200-seed bot readouts

## Decisions Made

- The flagged planner assumption ("grant-time legality means the school gate only") is accepted as written — a book still holds higher-LEVEL spells as canon does, and the cast-time level lock stays entirely inside `canCast`, untouched by this plan.
- The Apprentice's level-3 reveal was upgraded from `canLearn` to `grantableAt(newSub, spell, newLevel)` per the plan's own action item — a spell whose school is merely gated above the new level (not permanently unlearnable) is now also dropped, matching the plan's stated behavior exactly.
- Seed 15's predicted-but-unmeasured chargen move was NOT force-declared — the plan's own protocol ("measure each field's engine-side value live... never hand-type a value") was followed literally, and the measurement said no. Declaring a non-move would have been a blanket/unproven regeneration, exactly the anti-pattern the engine gate forbids.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, direct consequence of the plan's own edit] Re-pinned `test/unit/guaranteed-attack-spell.test.js`'s Summoner draw count, retired-gate assertion, and adjacency bound**
- **Found during:** Task 1 (`npm test` after the mu-chart.js/character.js/encounters.js edit)
- **Issue:** This file independently restates the pinned `ROLL_GRIMOIRE_DRAW_COUNTS` (Summoner: 31, now 36) and directly asserts `castableAttackSpells(summonerState)` stays `[]` at level 1 — both contradict the declared RULES-03 change. Its own "adjacency" test (bounding how much the new algorithm can differ from a reference pre-Phase-40 implementation) measured a new worst case of 2 for the no-special-school subs (was 1), since a gated sub's walk can now both drop a spell AND reach one slot further into the shuffled list.
- **Fix:** Updated the pinned constant (31 -> 36, with a rationale comment); replaced the retired-gate assertion with a re-measured version proving Summon's own spell-LEVEL lock is unaffected and any castable attack spell returned is genuinely in the grimoire and castable; re-measured `NO_SPECIAL_BOUND` live via a probe script (1 -> 2, Warlock seed 657278) and documented why `SPECIAL_BOUND` (7, Wizard) is unaffected (Wizard carries no gate at all).
- **Files modified:** test/unit/guaranteed-attack-spell.test.js
- **Verification:** `node --test test/unit/guaranteed-attack-spell.test.js` green (6/6); full `npm test` green afterward.
- **Committed in:** `3be1c3d` (Task 3 commit)

**2. [Rule 1 - Bug, direct consequence of the plan's own edit] Re-pinned `test/unit/spell-level-overrides.test.js`'s Summoner castableAttackSpells case**
- **Found during:** Task 1 (`npm test`)
- **Issue:** `stateFor("Summoner", 1, ["Stun", "Summon"])` asserted `castableAttackSpells` stays `[]`, contradicting the retired gate — Stun (offense, gate 1 now) is castable at level 1.
- **Fix:** Updated the assertion to `[Stun]`; kept `canCast(Summon)` false (its own unrelated spell-LEVEL lock).
- **Files modified:** test/unit/spell-level-overrides.test.js
- **Verification:** `node --test test/unit/spell-level-overrides.test.js` green (27/27); full `npm test` green afterward.
- **Committed in:** `3be1c3d` (Task 3 commit)

**3. [Rule 1 - Bug, direct consequence of the plan's own edit] Re-pinned `test/unit/roll-high-state-pins.test.js`'s solo-1/solo-2/party-1/deep-8**
- **Found during:** Task 1 (`npm test` surfaced 4 failures)
- **Issue:** This Phase 73 baseline-hash harness's own header warns "a moved hash means a check site was flipped wrong: FIX THE SITE, never re-pin" — a strong signal to investigate before re-pinning, exactly like 75-02's own precedent for `deep-8`/`deep-14`. `solo-1`/`solo-2`/`party-1` are UNFORCED seeds; `deep-8` is a deep-start sweep already re-pinned once (75-02, RULES-02).
- **Fix:** Before re-pinning, measured `newRun(seed).c.sub` for all four: `solo-1`/`party-1` roll Court Mage, `solo-2` rolls Apprentice, `deep-8` also rolls Court Mage — all four gated Magic User sub-classes this plan's `grantableAt` filter touches. Confirmed the causal mechanism live (a small comparison script showing the grant filter changes which spell fills a book slot for these subs). Regenerated the four hashes via `node tools/roll-high-baseline.mjs pins` (each hashed identically twice, confirming determinism), and added a rationale comment naming RULES-03 and the verification method.
- **Files modified:** test/unit/roll-high-state-pins.test.js
- **Verification:** `node --test test/unit/roll-high-state-pins.test.js` green (9/9); full `npm test` green afterward (6053/6053).
- **Committed in:** `3be1c3d` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — direct, necessary re-pins caused by this plan's own declared `grantableAt` filter, outside the plan's stated `files_modified` list but required to keep `npm test` green; each investigated for causation before re-pinning, never a blind re-pin).
**Impact on plan:** All three re-pins are mechanical or investigated consequences of the single `grantableAt` filter addition. No scope creep — no other engine or test behavior was touched.

## Issues Encountered

- First draft of `test/unit/casters-can-act.test.js`'s replacement accidentally duplicated an existing test name and mis-assembled the trailing "Wizard still refuses to melee" assertion into the wrong test body — caught before commit by re-reading the file, reverted the working-tree edit (`git checkout --`, scoped to this one already-uncommitted file, not a blanket reset) and redid it cleanly as three separate, correctly-named tests.
- First draft of `test/unit/day-one-damage.test.js`'s re-pinned canCast test overwrote `state.c.grimoire` to `["Freeze"]` only, losing "Summon" and causing a false failure on the level-2 `canCast(Summon)` assertion — fixed by including both spell names.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-03 is fully landed: the Summoner's offense gate is gone, and every grant path for the six remaining gated sub-classes is grant-time legal.
- 75-10 (Summoner healing weakness) can proceed independently — it re-pins `identity-contract.test.js`'s Summoner "bad" entry again (from this plan's summon-backfire pin to the healing weakness), per this plan's own comment marker.
- The Pixel 7 human-check items (a level-1 Summoner can roll and cast an offense spell; a new Warlock/Apprentice never shows a "not open to you yet" spell in the day-one book) are deferred to the milestone-close UAT batch per this project's standing Deferred UAT protocol.
- 75-13 will fold this plan's readout headline and the Phase 75 FIXTURE-INVENTORY subsection into its phase-wide consolidation (not this plan's job).

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*
