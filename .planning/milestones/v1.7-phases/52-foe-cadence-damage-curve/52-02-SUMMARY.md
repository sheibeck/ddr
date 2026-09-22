---
phase: 52-foe-cadence-damage-curve
plan: 02
subsystem: combat
tags: [combat, crit, damage-curve, herman, parity-fixtures, draw-count-pins, engine-gate]

# Dependency graph
requires:
  - phase: 52-foe-cadence-damage-curve
    plan: 01
    provides: "test/unit/foe-cadence.test.js (CAD-01/02/03 pins), tools/cadence-audit.mjs + its committed output, tools/damage-curve-audit.mjs + its committed BEFORE section (FLAGGED 116/209, Herman 82/100 confirmed) — this plan's AFTER section builds directly on that BEFORE baseline"
provides:
  - "engine/combat.js#foeLevelBase(f) — the shared level-base helper (sp.strikesAs^2 else lvl^2) read by pursuitStrike, foeTurn's member branch, and foeTurn's hero branch"
  - "The general crit rule at all three foe-damage sites: a foe crit now doubles the DAMAGE DICE only, not the whole lvl^2+dmgBonus+dice sum — zero draw-shape change"
  - "content/bestiary.js Herman ×2 with sp.strikesAs: 5 (the old flat-25 notation is gone)"
  - "tools/bestiary-yardstick.mjs strikesAs-aware foe-side formula + regenerated BESTIARY-REBALANCE.md AFTER block"
  - "test/unit/foe-crit-curve.test.js — 8 DMG-02 pins + foeLevelBase pin"
  - "The measured moved parity set (exactly action-script.combat.json#lose) declared with a +52 record and a standing divergence-records.test.js guard"
  - "tools/damage-curve-audit-output.txt's AFTER section (--rule=dice): FLAGGED 116 -> 65 row×band cells"
  - "content/BESTIARY-REBALANCE.md's Phase 52 addendum: the crit-rule tier maxima, Herman before/after, and the full still-flagged table with every row's ruling (hand-to-54, no trims this phase)"
  - "test/parity/FIXTURE-INVENTORY.md's Phase 52 section: the crit-exposure predictor per site, the re-run initiative-scan diff, the moved-set table, the draw-count-pins summary"
affects: [52-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "foeLevelBase(f) as the one shared level-base read for all three foe-damage sites, mirrored in tools/bestiary-yardstick.mjs's own foe-side formula so a future strikesAs-bearing row needs no tool change"
    - "crit decided BEFORE the damage line (const crit = roll===1 || (roll<=2 && sub===Soldier)), the SAME single dice draw computed into a local, then folded into the sum once or twice depending on crit — zero draw-shape change at all three sites"
    - "the damage-curve-audit tool's Herman-block description text is now conditional on --rule so the AFTER section's prose matches the AFTER bestiary's actual shape"

key-files:
  created:
    - test/unit/foe-crit-curve.test.js
  modified:
    - engine/combat.js
    - content/bestiary.js
    - content/BESTIARY-REBALANCE.md
    - tools/bestiary-yardstick.mjs
    - tools/damage-curve-audit.mjs
    - tools/damage-curve-audit-output.txt
    - test/unit/combat.test.js
    - test/unit/identity-contract.test.js
    - test/unit/content-tables.test.js
    - test/determinism/foe-abilities.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/parity/divergence-records.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - tools/initiative-fixture-scan-output.txt

key-decisions:
  - "Task 1's pre-edit Step-0 sanity diff (node tools/initiative-fixture-scan.mjs vs the committed output) was NOT byte-empty before any Phase 52 edit — an inherited Phase 51 ordering artifact (the committed 51-02 scan output was generated in the same commit as, but chronologically before, that commit's own fixture declarations), the same class of finding 51-02-SUMMARY.md already documented for a different column pair. Verified the TRUE Part A invariant columns (round-advance/moved, MOVED SET/INITIATIVE EXPOSURE) were byte-identical and proceeded; this phase's own regeneration naturally absorbed the stale drift."
  - "walking-dead-t5's FULL_FIGHT_PINS row (test/determinism/foe-abilities.test.js) moved 23 draws/1 attack/died -> 48 draws/3 attacks/died: the seed-1 Vampire's crit used to double the whole sum and kill the hero on the fight's first attack; under the dice-only rule the same crit lands for less, so the hero survives two more strikes before losing the same way. Outcome unchanged; explicitly allowed by this plan's own 'a FULL_FIGHTS row may move when the smaller crit number changes a fight's length' rule."
  - "The DMG-02 divergence-records.test.js guard's EXPECTED set is a literal, measured list (not read off a MOVED SET line in the initiative scan, since a foe crit is not a round-advance event and the scan carries no crit-exposure predictor of its own) — cross-checked by a scratch replay of every combat/magic fixture site plus the full parity suite."
  - "Checkpoint (Task 3) pre-answered per the orchestrator's instruction: hand-to-54. No dice trims land in this plan. Every still-flagged row in the AFTER audit gets an explicit per-row ruling in content/BESTIARY-REBALANCE.md's addendum: tier-5 rows -> 'deliberate deep-tier threat (Endgame band)'; tier 2-4 rows (both level-base and row-dice categories) -> 'curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff'. Nothing silently skipped."

requirements-completed: [DMG-02]

coverage:
  - id: D1
    description: "The general crit rule (dice-only doubling) lands at all three foe-damage sites via a shared foeLevelBase(f) helper, with zero draw-shape change, pinned by 8 new DMG-02 tests + a foeLevelBase unit test"
    requirement: "DMG-02"
    verification:
      - kind: unit
        ref: "test/unit/foe-crit-curve.test.js (9/9 pass)"
        status: pass
      - kind: unit
        ref: "test/unit/combat.test.js (re-pinned dmg 14->13), test/unit/identity-contract.test.js (re-pinned Soldier clause), test/unit/content-tables.test.js (new Herman strikesAs pin) — all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "Herman's sp.strikesAs: 5 replaces the flat dmg.bonus: 25 notation; a Herman crit is now at most 37 (was 82/100) at both tiers, confirmed by the AFTER damage-curve audit's ## Herman block"
    requirement: "DMG-02"
    verification:
      - kind: other
        ref: "tools/damage-curve-audit-output.txt AFTER ## Herman block: critMax 37 at both T4 and T5, across every band"
        status: pass
    human_judgment: false
  - id: D3
    description: "The measured moved parity set (exactly action-script.combat.json#lose) is declared with a +52 record (after.wp 50->51) and regenerated from a real Part B measurement, never hand-typed; a standing divergence-records.test.js guard pins the declared set == the measured set; master hash and comparables.js untouched"
    requirement: "DMG-02"
    verification:
      - kind: unit
        ref: "node --test test/parity/divergence-records.test.js test/parity/combat-parity.test.js test/parity/full-suite.test.js — all green"
        status: pass
      - kind: other
        ref: "git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff --stat 484c495..HEAD -- test/parity/harness/comparables.js empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "The AFTER damage-curve audit is appended and reproducible (FLAGGED 116->65 row x band cells); the cadence audit re-run is byte-identical to Plan 01's; every still-flagged row is tabulated by category with an explicit ruling recorded (D-07), pre-answered as hand-to-54 (no trims this phase)"
    requirement: "DMG-02"
    verification:
      - kind: other
        ref: "node tools/damage-curve-audit.mjs --rule=dice diffs empty against the committed AFTER section; node tools/cadence-audit.mjs | diff - tools/cadence-audit-output.txt empty"
        status: pass
      - kind: unit
        ref: "content/BESTIARY-REBALANCE.md's '#### Still flagged after the fixes (rule=dice) — pending ruling' table + per-category ruling text"
        status: pass
    human_judgment: false

# Metrics
duration: ~2h
completed: 2026-09-20
status: complete
---

# Phase 52 Plan 02: Crit Doubles the Dice + Herman Strikes as a Level Five Summary

**Landed the general foe-crit fix (a critical now doubles the damage DICE, not the whole `lvl^2 + dmgBonus + dice` sum) at all three foe-damage sites via a shared `foeLevelBase(f)` helper, gave Herman `sp.strikesAs: 5` in place of his old flat-25 notation, re-measured every crit-value pin the change touched, declared and regenerated the one parity fixture the crit rule actually moved (`action-script.combat.json#lose`, wp 50→51), and recorded every still-flagged row from the AFTER damage-curve audit under the user's pre-answered hand-to-54 ruling — no bestiary dice trims land in this plan.**

## Performance

- **Duration:** ~2h
- **Completed:** 2026-09-20
- **Tasks:** 3 (Task 3 was a pre-answered checkpoint — recorded, not paused)
- **Files modified:** 14 (1 new test file, 13 modified)

## Accomplishments

- **Task 1 (engine + content + tests + fixtures, ONE commit `1612cf0`):**
  - `engine/combat.js`: new exported `foeLevelBase(f)` (returns `sp.strikesAs^2` when present, else `lvl^2`), read at `pursuitStrike`, `foeTurn`'s member branch, and `foeTurn`'s hero branch. All three sites now decide the crit BEFORE the damage line, draw the SAME single dice value in the SAME position, and fold it into the sum once (non-crit) or twice (crit) — the trailing whole-sum doubling statement is deleted at each site. `playerStrike`'s own crit (~L784) and the member-ally crit (~L1839, `allyTurn`) are untouched, confirmed by grep.
  - `content/bestiary.js`: both Herman rows (T4 line 114, T5 line 117) get `sp.strikesAs: 5` in place of `dmg: {n:0,sides:0,bonus:25}`; header comment updated.
  - `tools/bestiary-yardstick.mjs`: foe-side formula reads `sp.strikesAs^2` when present (mirrors `foeLevelBase` exactly); a strikesAs row's `dmg` column renders `d6 (as L5)`. `content/BESTIARY-REBALANCE.md`'s AFTER block regenerated (D-04 doc-consistency test passes).
  - `test/unit/foe-crit-curve.test.js` (new, 9 tests): hero branch (tier-5 default-d6 crit 37/31, level-1 crit 13, Bat/Rat-shaped crit 3), Soldier crit (7 vs 4, not exactly double), member branch (crit 17 = 9+2×4), pursuit strike (crit 14 = 4+2×5 via a Cloaker's free vanish), Herman (both live BESTIARY rows crit at 37, hit at 31, exactly 2 draws), the draw-shape guarantee (crit and non-crit draw identically; a flat `0d0+1` crit draws only 1), the pipeline-order distinction (weakened halves AFTER the dice doubling — a case where the new and old orders genuinely diverge: 17 vs the old rule's 30), and `foeLevelBase` itself.
  - Re-pins: `test/unit/combat.test.js` (dmg 14→13), `test/unit/identity-contract.test.js`'s Soldier clause (re-derived to assert the literal 7/4 values and the `+3` relation, since "exactly double" no longer holds), `test/unit/content-tables.test.js` (new Herman `sp.strikesAs` pin).
  - `test/determinism/foe-abilities.test.js`: `walking-dead-t5`'s `FULL_FIGHT_PINS` row re-measured live (23 draws/1 attack/died → 48 draws/3 attacks/died — outcome unchanged, allowed to move per this plan's own rule since the smaller crit changed the fight's length).
  - Measured moved parity set (via `tools/initiative-fixture-scan.mjs` Part B, re-run on the edited engine): **exactly `action-script.combat.json#lose`** (predicted correctly by the plan) — `fields.after.wp` moved 50→51. Declared with a `+52` record (`requirements` += `DMG-02`) and a new rationale paragraph, guarded by a new `divergence-records.test.js` "DMG-02: the holders declaring Phase 52 are exactly the measured moved set" test. `tools/initiative-fixture-scan-output.txt` re-run and committed (Part A byte-identical: `MOVED SET (3)` and `INITIATIVE EXPOSURE: 3 of 31 replay sites` unchanged).
  - Gates: `npm test` 3372/3372 pass, fail 0; `npm run build:www` exit 0; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `test/parity/harness/comparables.js` untouched.

- **Task 2 (records, ONE commit `0e93496`):**
  - Appended the AFTER damage-curve section (`--rule=dice`) to `tools/damage-curve-audit-output.txt`: **FLAGGED 116 → 65 rows across 209 row×band cells** (deep-tier 21, level-base 14, row-dice 30, bolt 0); the `## Herman` block confirms `critMax` **37** at both T4 and T5, across every band (was 82/100).
  - Fixed a stale boilerplate sentence in `tools/damage-curve-audit.mjs`'s `## Herman` description (it always said "no strikesAs field yet in this BEFORE run" regardless of `--rule`) — made conditional on `args.rule` so the AFTER section's prose is accurate (Rule 1, found while regenerating the AFTER section).
  - Cadence invariance confirmed: `node tools/cadence-audit.mjs | diff - tools/cadence-audit-output.txt` is **empty** — the crit rule changes no cadence (identical fight-length sampling, both INVARIANT lines unaffected).
  - `test/parity/FIXTURE-INVENTORY.md`'s new `## Phase 52` section: the crit-exposure predictor table (a scratch replay of every combat/magic fixture site — confirmed exactly one site, `#lose`, carries a foe crit hit; `#lose-apprentice` carries one opaque `armorSoaked` hit, unrelated to crits; every other site and every chargen/movement/economy/encounters site is clean), the re-run initiative scan's Part B diff (only `#lose`'s `fields.after` wp moved), the moved-set table, and the draw-count-pins summary (including the `walking-dead-t5` move).
  - `content/BESTIARY-REBALANCE.md`'s new `### Phase 52 addendum`: the engine-wide crit tier maxima (14/20/30/44/62 → 13/16/21/28/37), the Herman before/after table, the regenerated Herman yardstick rows, and the full `#### Still flagged after the fixes (rule=dice) — pending ruling` table (verbatim from the AFTER audit) with every row's disposition recorded per the pre-answered checkpoint ruling.
  - Gates: `npm test` 3372/3372 pass, fail 0; `npm run build:www` exit 0; master hash unchanged.

- **Task 3 (checkpoint, pre-answered — no pause):** the ruling was pre-recorded in `52-CONTEXT.md` at plan approval as `hand-to-54`. Recorded here and in `content/BESTIARY-REBALANCE.md`'s addendum: **no dice trims land in this plan.** Every still-flagged row gets an explicit per-row ruling — tier-5 rows → "deliberate deep-tier threat (Endgame band)"; tier 2–4 rows (both `level-base` and `row-dice` categories) → "curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff." Nothing silently skipped. Plan 03 applies the ruling (rulings only, no bestiary trims).

## Task Commits

Each task was committed atomically:

1. **Task 1: crit rule + Herman strikesAs — engine, re-pins, measured fixtures declared + regenerated** — `1612cf0` (feat)
2. **Task 2: FIXTURE-INVENTORY + BESTIARY-REBALANCE Phase 52 addendum + AFTER damage-curve section** — `0e93496` (docs)
3. **Task 3: checkpoint, pre-answered (hand-to-54)** — recorded in this SUMMARY, no separate commit
4. **Plan metadata** — (this commit) SUMMARY + STATE + ROADMAP + REQUIREMENTS

## Files Created/Modified

- `engine/combat.js` — `foeLevelBase(f)`; the dice-only crit at `pursuitStrike`, `foeTurn`'s member branch, `foeTurn`'s hero branch.
- `content/bestiary.js` — Herman ×2, `sp.strikesAs: 5` (flat-25 notation gone).
- `tools/bestiary-yardstick.mjs` — strikesAs-aware foe-side formula, `d6 (as L5)` rendering.
- `content/BESTIARY-REBALANCE.md` — regenerated AFTER block; new Phase 52 addendum.
- `test/unit/foe-crit-curve.test.js` (new) — 9 DMG-02/foeLevelBase pins.
- `test/unit/combat.test.js`, `test/unit/identity-contract.test.js`, `test/unit/content-tables.test.js` — re-pins.
- `test/determinism/foe-abilities.test.js` — `walking-dead-t5` FULL_FIGHT_PINS re-measured.
- `test/parity/fixtures/action-script.combat.json` — `lose` record `+52`.
- `test/parity/divergence-records.test.js` — new DMG-02 guard test.
- `test/parity/FIXTURE-INVENTORY.md` — new `## Phase 52` section.
- `tools/initiative-fixture-scan-output.txt` — re-run and committed.
- `tools/damage-curve-audit.mjs` — Herman-block description now `--rule`-conditional.
- `tools/damage-curve-audit-output.txt` — AFTER section appended.

## Decisions Made

- Task 1's pre-edit Step-0 sanity diff was not byte-empty before any edit — an inherited Phase 51 ordering artifact (documented above and in Deviations); the true Part A invariant columns were confirmed byte-identical and the plan proceeded.
- `walking-dead-t5`'s FULL_FIGHTS-shaped pin (in `test/determinism/foe-abilities.test.js`) is allowed to move (23/1/died → 48/3/died) since the smaller crit number legitimately changed the fight's own length; outcome unchanged.
- The DMG-02 divergence-records guard's EXPECTED set is a literal, measured list (there is no crit predictor line in the initiative scan) — cross-checked against a scratch replay of every combat/magic site and the full parity suite.
- Checkpoint pre-answered: `hand-to-54` — no dice trims this plan; every still-flagged row gets an explicit ruling recorded in `content/BESTIARY-REBALANCE.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — bug/stale text] `tools/damage-curve-audit.mjs`'s `## Herman` description was hardcoded to say "no strikesAs field yet in this BEFORE run" regardless of `--rule`**
- **Found during:** Task 2, Step 1 (appending the AFTER section).
- **Issue:** The tool's Herman-block description text was a single hardcoded string that correctly described Plan 01's BEFORE run but became inaccurate once Herman actually carries `sp.strikesAs: 5` in the AFTER run.
- **Fix:** Made the description conditional on `args.rule` — the AFTER (`--rule=dice`) branch now says Herman carries `sp.strikesAs: 5` and explains the level-base substitution.
- **Files affected:** `tools/damage-curve-audit.mjs`.
- **Commit:** `0e93496`.

**2. [Clarification, not a bug — inherited from Phase 51] Task 1's Step 0 pre-edit sanity diff was not byte-empty**
- **Found during:** Task 1, Step 0.
- **Issue:** `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt` showed a difference in the `divergence.phase` column for `lose`/`lose-apprentice`/`lose-plain` (reading `24+31`/`31`/`none` in the committed file vs `24+31+51`/`31+51`/`51` live) — the committed 51-02 scan output was generated in the same commit as, but chronologically before, that commit's own fixture declarations (an ordering artifact of Phase 51's own single-commit gate).
- **Investigation:** Confirmed the TRUE Part A invariant columns (round-advance, `moved`, the `MOVED SET`/`INITIATIVE EXPOSURE` summary lines) were byte-identical — only the non-invariant `divergence.phase` text differed, exactly the same class of finding 51-02-SUMMARY.md already documented for a different column pair in that plan.
- **Resolution:** Proceeded with Task 1 (the substantive invariant held); this plan's own Step 4/6 regeneration of `tools/initiative-fixture-scan-output.txt` naturally absorbs the stale drift alongside declaring its own `+52`. Documented at length in `test/parity/FIXTURE-INVENTORY.md`'s new Phase 52 section rather than papered over.
- **Files affected:** none (documentation-only finding; the eventual `tools/initiative-fixture-scan-output.txt` regeneration in Task 1 fixes the drift as a byproduct).
- **Commit:** `1612cf0`.

None of the above required an architectural decision (Rule 4).

## Issues Encountered

None beyond the two documented above (both resolved without requiring a plan change).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 has the full "Still flagged after the fixes" table with every row's ruling recorded (`content/BESTIARY-REBALANCE.md`'s Phase 52 addendum) and can act on it directly — the checkpoint's `hand-to-54` answer means Plan 03 records rulings, not dice trims.
- The AFTER damage-curve audit, the AFTER Herman critMax (37×2), and the FLAGGED count (65) are all committed and reproducible for Plan 03 to reference.
- No blockers. `npm test` 3372/3372, `npm run build:www` green, master hash and `comparables.js` unchanged at both task commits.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. A Herman crit on floor 5 no longer one-shots a full-HP level-5 hero — a CRIT line reads at most 37 (was reported at 80).
2. A Stalka Beast turn is never two hits AND a bolt in the same turn — either one cast line, or up to two swing lines (carried over from Plan 01's own pins, unaffected by this plan).
3. A Bat/Rat or China Wolf fight at depth 5 shows at most 2 foe attack lines between your own actions (carried over from Plan 01's own pins, unaffected by this plan).

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: content/bestiary.js
- FOUND: content/BESTIARY-REBALANCE.md
- FOUND: tools/bestiary-yardstick.mjs
- FOUND: tools/damage-curve-audit.mjs
- FOUND: tools/damage-curve-audit-output.txt
- FOUND: test/unit/foe-crit-curve.test.js
- FOUND: test/unit/combat.test.js
- FOUND: test/unit/identity-contract.test.js
- FOUND: test/unit/content-tables.test.js
- FOUND: test/determinism/foe-abilities.test.js
- FOUND: test/parity/fixtures/action-script.combat.json
- FOUND: test/parity/divergence-records.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: tools/initiative-fixture-scan-output.txt
- FOUND: .planning/phases/52-foe-cadence-damage-curve/52-02-SUMMARY.md
- FOUND commit: 1612cf0 (Task 1)
- FOUND commit: 0e93496 (Task 2)
