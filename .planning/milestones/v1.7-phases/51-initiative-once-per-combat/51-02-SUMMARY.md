---
phase: 51-initiative-once-per-combat
plan: 02
subsystem: engine
tags: [combat, initiative, rng-determinism, parity-fixtures, draw-count-pins, bot-readout]

# Dependency graph
requires:
  - phase: 51-initiative-once-per-combat
    plan: 01
    provides: "the BEFORE bot readout (commit d5d8c10) and tools/initiative-fixture-scan.mjs's measured MOVED SET (combat.json lose/lose-apprentice/lose-plain) this plan declares and regenerates"
provides:
  - "engine/combat.js#resolveInitiative(state, rng) -> { first, mine, theirs, why } — the single roll site, called only from fight()"
  - "engine/combat.js#rollInitiative(state, rng) -> first — thin wrapper, contract unchanged for direct-call tests"
  - "combatJoined additive fields (mine, theirs, why, foe) for Plan 03's narration"
  - "afterPlayerAction cut to round++ only — no re-roll, no pre-emptive second foeTurn"
  - "MOVED SET declared + regenerated: action-script.combat.json lose (24+31 -> 24+31+51), lose-apprentice (31 -> 31+51), lose-plain (new '51' record)"
  - "test/parity/divergence-records.test.js's INIT-01 MOVED SET guard"
  - "docs/DIFFICULTY-RETUNE.md's Phase 51 AFTER readout + BEFORE->AFTER reading"
affects: [51-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveInitiative/rollInitiative split (detail form + thin wrapper) so every direct-call test keeps its string contract while fight() gets the full { first, mine, theirs, why } shape for narration"
    - "combatJoined's why/foe fields are additive spreads (why only when an override fired, foe only for a single live foe) — zero new comparables carve-out, since event payloads are never fixture-compared"

key-files:
  created: []
  modified:
    - engine/combat.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/combat.test.js
    - test/unit/fight-gate.test.js
    - test/unit/spell-utility.test.js
    - test/unit/identity-race.test.js
    - test/unit/identity-contract.test.js
    - test/unit/identity-combat.test.js
    - test/unit/normalizeTarget.test.js
    - test/determinism/foe-abilities.test.js
    - test/unit/afraid.test.js
    - test/unit/cast-refusals.test.js
    - test/unit/magic.test.js
    - test/unit/item-wiring.test.js
    - test/unit/freeze-pays-out.test.js
    - test/unit/abilities.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/divergence-records.test.js
    - test/parity/combat-parity.test.js
    - test/parity/fixture-inventory.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - tools/initiative-fixture-scan-output.txt
    - docs/DIFFICULTY-RETUNE.md
    - docs/class-pass/v17-p51-after-smoke.json

key-decisions:
  - "Part A's true invariant (firstRoundAdvance/moved columns, the MOVED SET line, INITIATIVE EXPOSURE line) is byte-identical before/after the engine edit, confirmed by a targeted column diff — but the scan's combined markdown table also embeds Part B's own firstDivergentAction/maxRound columns in the same rows, and those legitimately changed for exactly the 3 predicted MOVED sites. The literal acceptance-criteria shell diff (spanning the whole table through INITIATIVE EXPOSURE) is therefore NOT byte-empty — documented at length in FIXTURE-INVENTORY.md's new section rather than papered over; the substantive invariant the plan cares about (nothing unpredicted moved) holds perfectly."
  - "lose-apprentice and lose-plain both flip outcome (dead: true -> false) under the edited engine — a measured, not assumed, consequence of the foe never getting two consecutive turns; recorded honestly in the fixture rationale and FIXTURE-INVENTORY.md rather than forcing the plan's draft language (which assumed dead: true would persist)."
  - "lose-plain's new action-path record uses fromAction: 2 (measured — the scan's Part B), not 1 as a naive guess might assume; every FULL_FIGHTS/determinism draw-count pin was re-measured live via the same runFullFight/setupEncounter helpers already in each test file, never hand-computed, including cases where the removed re-roll's net effect on total draws was non-monotonic (e.g. foe-turn-draw-count.test.js seed 17: 89->88 draws but 10->14 attacks)."

requirements-completed: [INIT-01]

coverage:
  - id: D1
    description: "rollInitiative fires exactly once per combat, from fight() only; afterPlayerAction's re-roll and pre-emptive foeTurn are gone, pinned by a zero-draw assertion (SC1) and a strict-alternation assertion (SC2: foe turns = player actions + 1, never two in a row)"
    requirement: "INIT-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js 'INIT-01 (SC1)' + test/unit/combat.test.js 'INIT-01 (SC2)' + 'INIT-01: ... exactly one combatJoined' — all pass"
        status: pass
      - kind: other
        ref: "awk '/^export function afterPlayerAction/,/^}/' engine/combat.js | grep -c 'Initiative(' prints 0; grep -c 'foeTurn(state, rng, events)' prints 1; grep -c 'round++' prints 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "combatJoined carries mine/theirs/why/foe (additive); Samurai/slow/foresight/Acute Hearing/senses/Knight/Court Mage all covered via fight()-targeted tests"
    requirement: "INIT-01"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js's 8 re-targeted/new 'fight: initiative —' tests (all 7 why branches + plain/no-why + multi-foe-omits-foe); test/unit/fight-gate.test.js (b); test/unit/spell-utility.test.js's 3 senses shape pins"
        status: pass
    human_judgment: false
  - id: D3
    description: "MOVED SET (combat.json lose/lose-apprentice/lose-plain) declared and regenerated with engine-measured after/stateAfter values, never hand-typed; Part A predictor byte-identical to 51-01's BEFORE copy; master hash and comparables.js untouched"
    requirement: "INIT-01"
    verification:
      - kind: unit
        ref: "npm test 3346/3346 pass, fail 0; node --test test/parity/divergence-records.test.js test/parity/combat-parity.test.js test/parity/full-suite.test.js all green"
        status: pass
      - kind: other
        ref: "git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff --stat -- test/parity/harness/comparables.js empty; targeted column diff of firstRoundAdvance/moved + MOVED SET/INITIATIVE EXPOSURE lines against the 51-01 commit's copy is empty (see Deviations)"
        status: pass
    human_judgment: false
  - id: D4
    description: "AFTER bot readout captured under Plan 01's exact flags on the Task 2 commit, recorded under the same 'v1.7 · Phase 51 — initiative once' heading with a BEFORE->AFTER reading"
    requirement: "INIT-01"
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js 13/13 pass (v1.2 still last H2)"
        status: pass
      - kind: other
        ref: "grep -c '^#### AFTER — commit [0-9a-f]\\{40\\} (initiative once per fight)' / '^#### Reading (BEFORE .. AFTER)' docs/DIFFICULTY-RETUNE.md both print 1; node -e comparing v17-p51-after-smoke.json vs before-smoke.json (same seeds/cells, different commit) prints true"
        status: pass
    human_judgment: false

# Metrics
duration: ~3h
completed: 2026-09-20
status: complete
---

# Phase 51 Plan 02: Initiative Once Per Fight — Engine Cut, Re-Pinned Draws, Declared Fixtures Summary

**Cut `afterPlayerAction`'s per-round initiative re-roll and its pre-emptive second foe turn, made `fight()` the single initiative-roll site with `combatJoined` carrying the dice and the verdict, re-measured every draw-count pin the removed re-roll touched (never hand-computed), and declared + regenerated exactly the measured MOVED SET (`lose`, `lose-apprentice`, `lose-plain` — two of which flip from died to won, a measured consequence of the rule change).**

## Performance

- **Duration:** ~3h
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- **Task 1 (engine cut + pins):** `resolveInitiative(state, rng)` is the new detail-form export (`{ first, mine, theirs, why }`), called exactly once per fight from `fight()`; `rollInitiative` is now a one-line wrapper over it so every direct-call test (identity-combat/identity-contract/spell-utility/combat.test.js) keeps its string contract. `afterPlayerAction` is cut to `round++` only — the re-roll and the pre-emptive second `foeTurn` are gone. `combatJoined` gained additive `mine`/`theirs`/`why`/`foe` fields. Every draw-count pin the removed re-roll used to consume was re-measured live (never hand-computed): `foe-turn-draw-count.test.js` (CANON-01/03/04/05, all seven FULL_FIGHTS rows, a new Section 6 SC1 zero-draw pin), `combat.test.js` (the two `rollInitiative:` tests re-targeted at `fight()` and expanded to all 7 `why` branches + a plain/no-why case + multi-foe-omits-`foe`, plus new SC2 alternation and once-per-fight pins), `identity-race`/`identity-contract` (Fridgian frenzy sequence), `normalizeTarget`, `test/determinism/foe-abilities.test.js` (magical-t4/demons-t5/beasts-t5), `fight-gate.test.js`/`spell-utility.test.js` (combatJoined shape pins). Comment/sequence hygiene (dead trailing `15, 10` pairs dropped, "fresh initiative" language reworded) landed across `afraid`/`cast-refusals`/`magic`/`item-wiring`/`freeze-pays-out`/`abilities`/`identity-combat`/`identity-contract`.test.js. Two FULL_FIGHTS rows (seed 127, seed 1119 — the same seeds as the `lose-apprentice`/`lose-plain` parity fixtures) flip from `died` to `won`: with the foe never getting two consecutive turns, cumulative incoming damage drops enough for these fights to end in a win instead of a death, within the same natural-resolution loop — a measured, expected consequence of INIT-01, not a regression.
- **Task 2 (fixtures + guard + inventory):** Re-ran `tools/initiative-fixture-scan.mjs` on the edited engine. The true Part A predictor (round-advance/`moved` columns, the `MOVED SET`/`INITIATIVE EXPOSURE` lines) is byte-identical to the 51-01 BEFORE commit's copy for all 31 replay sites — nothing unpredicted moved. Declared and regenerated exactly the measured MOVED SET: `combat.json` `lose` (`24+31` -> `24+31+51`, after/stateAfter re-measured, wp 51->50, still survives), `lose-apprentice` (`31` -> `31+51`, flips dead:true -> dead:false), and a brand-new `lose-plain` record (`51`, `fromAction: 2` — measured, not the naive guess of 1 — flips dead:true -> dead:false). Added `test/parity/divergence-records.test.js`'s INIT-01 MOVED SET guard, removed `combat-parity.test.js`'s now-dead `lose-plain` "never declare a record" branch and replaced it with an honest comment, touched `fixture-inventory.test.js`'s stale comment, and wrote `FIXTURE-INVENTORY.md`'s new Phase 51 section (the live scan quoted verbatim, the moved-set table, every re-pinned draw-count value old->new, and the byte-identical-elsewhere close). `npm test` 3346/3346, master hash and `comparables.js` untouched. Tasks 1+2 landed as one commit (`608a0e5`) per the plan's own gate (the parity suite is red between them).
- **Task 3 (AFTER readout + gates):** Ran the same three bot commands Plan 01 used, on the Task 2 commit, and recorded them under the existing `### v1.7 · Phase 51 — initiative once` heading's new `#### AFTER — commit 608a0e5...` block, followed by a `#### Reading (BEFORE -> AFTER)` table. Every readout moves in the expected direction (median/p90 death depth rises a bit for both solo and party, action counts rise proportionally, class-smoke pooled mean depth 3.44 -> 3.80) — read in the tuning-proxy register only, no constants changed.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2 (one commit per the plan's own gate): engine cut + pins re-pinned + moved fixtures declared/regenerated** - `608a0e5` (feat)
3. **Task 3: AFTER bot readout + summary** - (this commit) (docs)

**Plan metadata:** (this commit or the next) — SUMMARY + STATE + ROADMAP

## Files Created/Modified

- `engine/combat.js` — `resolveInitiative`/`rollInitiative` split, `fight()`'s extended `combatJoined` push, `afterPlayerAction` cut to `round++` only, three `DELIBERATE RULES CHANGE (Phase 51, INIT-01, 2026-09-20)` paragraphs.
- `test/unit/foe-turn-draw-count.test.js`, `test/unit/combat.test.js`, `test/unit/fight-gate.test.js`, `test/unit/spell-utility.test.js`, `test/unit/identity-race.test.js`, `test/unit/identity-contract.test.js`, `test/unit/identity-combat.test.js`, `test/unit/normalizeTarget.test.js`, `test/determinism/foe-abilities.test.js` — re-pinned draw counts + new SC1/SC2/once/why-branch pins.
- `test/unit/afraid.test.js`, `test/unit/cast-refusals.test.js`, `test/unit/magic.test.js`, `test/unit/item-wiring.test.js`, `test/unit/freeze-pays-out.test.js`, `test/unit/abilities.test.js` — comment/sequence hygiene (dead trailing initiative-pair draws dropped).
- `test/parity/fixtures/action-script.combat.json` — `lose`/`lose-apprentice` divergence records extended to `+51`, new `lose-plain` divergence record.
- `test/parity/divergence-records.test.js` — INIT-01 MOVED SET guard test.
- `test/parity/combat-parity.test.js` — dead `lose-plain` branch removed, honest comment added.
- `test/parity/fixture-inventory.test.js` — comment touch (roster unchanged).
- `test/parity/FIXTURE-INVENTORY.md` — new `## Phase 51` section.
- `tools/initiative-fixture-scan-output.txt` — overwritten with the AFTER readout (BEFORE stays in git history at commit `bf0f9eb`).
- `docs/DIFFICULTY-RETUNE.md` — `#### AFTER — commit 608a0e5...` + `#### Reading (BEFORE -> AFTER)`.
- `docs/class-pass/v17-p51-after-smoke.json` — the AFTER 143-cell class-pass matrix.

## Decisions Made

- Part A's true invariant (round-advance/`moved` columns, the `MOVED SET`/`INITIATIVE EXPOSURE` lines) is byte-identical before/after the engine edit; the scan's combined table also embeds Part B's `firstDivergentAction`/`maxRound` columns in the same rows, which legitimately changed for exactly the 3 predicted MOVED sites — documented at length rather than papered over (see Deviations).
- `lose-apprentice` and `lose-plain` both flip outcome (`dead: true` -> `false`) under the edited engine — recorded honestly with the measured values, not the plan's draft assumption that `dead: true` would persist.
- `lose-plain`'s new record uses `fromAction: 2` (measured) rather than a guessed `1`.
- Every draw-count pin was re-derived by actually running the test's own helper against the edited engine (never hand-computed), including non-monotonic cases (draws down, attacks up, or vice versa).

## Deviations from Plan

### Auto-fixed / Rule 1 & clarifying deviations

**1. [Clarification, not a bug] The "Part A must diff empty" acceptance check's literal shell command is not byte-empty, but the underlying invariant it exists to prove holds perfectly.**
- **Found during:** Task 2, step 1 (re-running the scan).
- **Issue:** `tools/initiative-fixture-scan.mjs`'s single markdown table physically combines Part A's own invariant columns (`firstRoundAdvance`, `moved`) with Part B's own measurement columns (`firstDivergentAction`, `maxRound`) in the same rows. The plan's acceptance criterion diffs the whole table section (`sed -n '1,/^INITIATIVE EXPOSURE/p'`) against the 51-01 BEFORE copy expecting it to be empty — but `firstDivergentAction`/`maxRound` legitimately change for the 3 MOVED sites (that's the whole point of Part B: "fills Plan 02's divergence records" per the plan's own text two sentences later).
- **Investigation:** Ran a targeted diff of just the true Part A columns (site name, `firstRoundAdvance`, `moved`) plus the `MOVED SET`/`INITIATIVE EXPOSURE` summary lines — empty, confirmed byte-identical for all 31 rows. Only `lose`/`lose-apprentice`/`lose-plain`'s `firstDivergentAction`/`maxRound` values differ, exactly the 3 rows the invariant predictor named as MOVED. No row outside the predicted set changed at all — the plan's model is correct; only one acceptance criterion's mechanical scope (the whole table vs. just the invariant columns) doesn't match the tool's own documented Part A/Part B split.
- **Resolution:** Did not force a fake byte-identical diff (that would hide real, expected, plan-anticipated data). Documented the column-level invariant explicitly in `FIXTURE-INVENTORY.md`'s new Phase 51 section (a dedicated note right after the quoted AFTER scan) and here, with the exact targeted-diff commands used to confirm it.
- **Files affected:** none (documentation-only finding).
- **Commit:** `608a0e5` (the FIXTURE-INVENTORY.md note lands in the same commit as the fixture declarations).

**2. [Rule 1 — measured, not the plan's draft assumption] `lose-apprentice`/`lose-plain` flip outcome; `lose-plain`'s `fromAction` is 2, not 1.**
- **Found during:** Task 2, step 2 (declaring the MOVED SET records).
- **Issue:** The plan's own action text assumed `lose-plain`'s new record would likely still show `dead: true` (its prose talks about "the death path" being "pinned by the record's stateAfter.dead: true"). The actual measured Part B output shows `dead: false` for both `lose-apprentice` and `lose-plain` — the character now survives the same fixed action script.
- **Fix:** Used the actually-measured values throughout (fixture JSON, `combat-parity.test.js`'s comment, `FIXTURE-INVENTORY.md`), not the plan's draft assumption. `fromAction: 2` (not 1) for `lose-plain` because action 0/1 happen not to shift the rng cursor at this specific seed — read directly from the scan's Part B output.
- **Files affected:** `test/parity/fixtures/action-script.combat.json`, `test/parity/combat-parity.test.js`, `test/parity/FIXTURE-INVENTORY.md`.
- **Commit:** `608a0e5`.

None of the above required an architectural decision (Rule 4) — both are "the measured reality differs slightly from the plan's draft prose," resolved per the plan's own overriding rule: "measured, never hand-typed."

## Issues Encountered

None beyond the two documented above (both resolved by measuring and documenting, not by code changes).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (INIT-02 narration) can consume `combatJoined.mine`/`theirs`/`why`/`foe` directly — the engine half of INIT-02 landed in this plan's Task 1.
- The AFTER bot readout is committed under the same `v1.7 · Phase 51 — initiative once` heading Plan 01's BEFORE readout used, ready for Phase 52's cadence work to measure on top of.
- No blockers. `npm test` 3346/3346, `npm run build:www` green, master hash and `comparables.js` unchanged.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. Across a 3+ round fight, no two foe turns ever occur back to back in the fight log — every round reads as a steady you/them or them/you exchange.
2. A Samurai (or Fridgian) fight opens with the foe's turn immediately after tapping Fight!, then strictly alternates for the rest of the fight.
3. The combat panel's "YOU/THEY MOVE FIRST" reading stays sane across rounds of the same fight (it should never appear to flip mid-fight, since initiative now holds for the whole encounter).

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: test/unit/foe-turn-draw-count.test.js
- FOUND: test/unit/combat.test.js
- FOUND: test/parity/fixtures/action-script.combat.json
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: docs/class-pass/v17-p51-after-smoke.json
- FOUND: .planning/phases/51-initiative-once-per-combat/51-02-SUMMARY.md
- FOUND commit: 608a0e5 (Task 1+2)
- FOUND commit: 5b44dac (Task 3 + summary)
