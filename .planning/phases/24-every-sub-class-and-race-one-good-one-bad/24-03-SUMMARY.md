---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 03
subsystem: combat
tags: [engine, combat, races, parity, fid-07, race-pass]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "actionPathDivergenceOf/skipsByteDiffAt/declaredEndDiffs (Plan 24-02) — this plan is the first consumer, declaring the combat/lose (seed 14) record"
provides:
  - "RACES.Fridgian.hide = 2 (flat damage soak, floor 1, stacks with Hardiness) read by applyFoeDamageToPlayer"
  - "RACES.Dwarven.armorWear = 0.5 (armour durability wear fraction, Math.ceil'd) read by applyFoeDamageToPlayer"
  - "Fridgian frenzy's second swing always targets the live foe — the corpse-whiff rng.d(10) branch is deleted"
  - "combat/lose (seed 14) declared action-path divergence record (kind action-path, fromAction 1) — the first real consumer of Plan 24-02's harness"
  - "lose-apprentice parity scenario (seed 127) restoring byte-identical death-path coverage"
  - "Re-measured FID-02 pins (test/unit/foe-turn-draw-count.test.js) + collateral D-15 pins (test/determinism/foe-abilities.test.js)"
affects: [24-04, 24-05, 24-06, 24-07]

tech-stack:
  added: []
  patterns:
    - "Race mechanics as content/races.js data flags (hide, armorWear) read at damage time by applyFoeDamageToPlayer, consistent with the existing frenzy/slow/noArmor/heal2x/spMul flags"
    - "A removed rng draw (not a new one) is the one permitted zero-draw-discipline exception, declared via a single machine-checked action-path divergence record rather than a blanket fixture regeneration"

key-files:
  created:
    - test/unit/identity-race.test.js
  modified:
    - content/races.js
    - engine/combat.js
    - src/browser/eventNarration.js
    - test/unit/combat.test.js
    - test/parity/fixtures/action-script.combat.json
    - test/unit/foe-turn-draw-count.test.js
    - test/parity/fixture-inventory.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/determinism/foe-abilities.test.js

key-decisions:
  - "Hide stacks with Hardiness as a second, separate Math.max(1, dmg - N) application (Hardiness first, hide second), matching the plan's stated stacking order and the existing Hardiness flooring convention exactly."
  - "Dwarven's armorWear is applied only to the SUBTRACTED durability amount, not to whether the blow lands on armour at all — the soak-roll gate (`av.wp>0 && av.ar>0`) and the `dmg > av.min` guard are both byte-identical to before for every race including Dwarven."
  - "The combat/lose divergence record's `fields` intentionally omits `gold` (identical on both sides, 51) — declaredEndDiffs only checks fields that actually differ, per its own JSDoc contract."
  - "Collateral fix (not in this plan's file list): test/determinism/foe-abilities.test.js's FULL_FIGHT_PINS for humans-t2/demons-t5/beasts-t5 were re-measured — seed 1's hero is a Fridgian Knight (documented in 24-CONTEXT.md), so the same corpse-whiff removal shifted those full-fight totals. Treated as a Rule 1 collision fix, following Plan 24-01's precedent for the same seed's incidental collisions."

requirements-completed: [IDENT-08, IDENT-09, FID-07]

coverage:
  - id: D1
    description: "A Fridgian's hide soaks 2 flat from every blow that reaches applyFoeDamageToPlayer, floor 1, stacking with Hardiness's -3; a Human takes the full amount"
    requirement: "IDENT-09"
    verification:
      - kind: unit
        ref: "test/unit/identity-race.test.js — hide flat/floor/Hardiness-stacking/Human-full-damage tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Fridgian's frenzy second swing is never spent on a corpse — the corpse-whiff rng.d(10) branch and its narration entry are both deleted"
    requirement: "IDENT-08"
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js (rewritten frenzy test) + test/unit/identity-race.test.js (draw-count proof) + test/unit/formatEventsCoverage.test.js (no dead entries)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Dwarf's armour loses Math.ceil(dmg/2) durability on a soaked blow (a 1-point-over-min hit still costs 1); every other race loses the full dmg"
    requirement: "IDENT-09"
    verification:
      - kind: unit
        ref: "test/unit/identity-race.test.js — Dwarven half-wear/min-guard/ceil-rounding + Human full-wear tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "combat/lose (seed 14) carries a declared, live-measured action-path divergence record (fromAction 1); the outcome flips from died (prototype) to won (engine); lose-apprentice (seed 127) restores byte-identical death-path parity coverage; flee (seed 17) stays byte-identical"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "node --test test/parity/combat-parity.test.js test/parity/full-suite.test.js — 5/5 combat scenarios pass, including lose and lose-apprentice"
        status: pass
    human_judgment: false
  - id: D5
    description: "FID-02 pins (foe-turn-draw-count.test.js) and the fixture-inventory roster (doc + pinned array) are re-measured live and regenerated together with Phase 24 provenance"
    requirement: "FID-07"
    verification:
      - kind: unit
        ref: "test/unit/foe-turn-draw-count.test.js (34/34), test/parity/fixture-inventory.test.js (5/5)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test ends # fail 0 with the full 1089-test suite green, prototype-master.js.txt and every other fixture untouched"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "npm test — 1089/1089, # fail 0; git diff --stat -- test/parity/prototype-master.js.txt (and every other fixture) empty"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 03: Fridgian Hide/Frenzy + Dwarven Half-Wear Race Pass (IDENT-08/09, FID-07) Summary

**Fridgian hide (-2 flat, floor 1, stacks with Hardiness) and a frenzy that never wastes its second swing on a corpse, Dwarven armour that wears at half rate — landed as content/races.js data flags — plus the one measured, machine-checked parity divergence this created (combat/lose, seed 14, died -> won) and its restored death-path coverage (lose-apprentice, seed 127).**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 9 (1 new test file, 8 modified)

## Accomplishments

- `content/races.js`: `Fridgian.hide = 2`, `Dwarven.armorWear = 0.5`, both documented with a one-line comment and kept alongside every other existing flag/note.
- `engine/combat.js#applyFoeDamageToPlayer`: hide soaks 2 flat from every landed blow (foe swing, pursuit strike, foe ability bolt — the single hero-damage seam), applied directly after Hardiness's -3, floor 1 per the same convention; Dwarven armour durability now loses `Math.ceil(dmg * armorWear)` instead of the full `dmg` on a soaked blow (a 1-point-over-min hit still costs 1 durability); every non-Dwarf's expression is value-identical to before.
- `engine/combat.js#playerStrike`: deleted the frenzy corpse-whiff branch (the `corpse && rng.d(10) <= 5` early-return that could waste both swings on a dead foe) — the attack loop already targets the live foe `t`, so the second wild swing now always lands there. This removes exactly one `rng.d(10)` draw whenever a Fridgian frenzies with a corpse present.
- `src/browser/eventNarration.js`: removed the now-dead `frenzyWasted` narration entry (the coverage guard forbids dead entries).
- `test/unit/combat.test.js`: rewrote the frenzy test to prove the whiff draw is gone via `fakeRng` sequence exhaustion (`rng.d(10)` throws afterward).
- `test/unit/identity-race.test.js` (new, 12 tests): RACES flag assertions (Fridgian/Dwarven carry the new flags, no other race does, existing flags untouched, Human stays exactly `size/upkeep/note`); hide flat/floor/Hardiness-stacking/Human-full-damage; Dwarven half-wear/min-guard/ceil-rounding/Human-full-wear; a draw-count proof that the frenzy sequence is exactly 7 draws with zero corpse-whiff draw.
- **Declared the one measured parity divergence** (FID-07, first real consumer of Plan 24-02's harness): `combat/lose` (seed 14, a Fridgian Soldier) now carries a `divergence` record (`kind: "action-path"`, `fromAction: 1`) in `test/parity/fixtures/action-script.combat.json`, with before/after `c` fields and a `dead` state flag, all live-measured (never hand-computed) and asserted via `declaredEndDiffs` at both `combat-parity.test.js` and `full-suite.test.js`.
- Added the **`lose-apprentice`** scenario (seed 127, a plain Human Apprentice, unaffected by the race pass) restoring byte-identical death-path parity coverage — confirmed dying on both sides at the same action with the same state throughout.
- Re-measured and regenerated together: FID-02's `FULL_FIGHTS` pins (`test/unit/foe-turn-draw-count.test.js`), the fixture-inventory roster (`test/parity/fixture-inventory.test.js` pinned array + `test/parity/FIXTURE-INVENTORY.md`'s generated block via `tools/fixture-inventory.mjs`), and (as a documented collateral fix) three of the D-15 determinism pins in `test/determinism/foe-abilities.test.js` whose seed-1 Fridgian Knight hit the same corpse-whiff removal.

## Measured Data (verbatim, per the plan's output spec)

### combat/lose (seed 14, Fighter/Soldier/Fridgian, no armour, wp 52) — per-action before/after

Measured live via a scratch replay of `loadPrototypeSandbox({ seed: 14 })` against the patched engine, action by action (action 0 = `startCombat`; actions 1-10 = the ten `attack` actions in the fixture):

| action | prototype (frozen master) | engine (Phase 24, patched) | note |
|---|---|---|---|
| 0 startCombat | wp 52, sp 0, kills 0, rations 6, gold 50 | identical | roster: Bat/Rat (wp 1), Shriek (wp 3) |
| 1 attack | wp 32 | wp 38 | first divergence — hide -2 shaves this and every subsequent landed foe blow |
| 2 attack | wp 16 | wp 26 | |
| 3 attack | wp 14 | wp 25 | |
| 4 attack | wp 8 | wp 22 | |
| 5 attack | wp 5, sp 5, kills 1, rations 7, gold 51 | wp 21, sp 5, kills 1, rations 7, gold 51 | Bat/Rat killed on both sides, same action, same kill |
| 6 attack | unchanged (miss) | unchanged (miss) | |
| 7 attack | unchanged (miss) | unchanged (miss) | frenzy with the Bat/Rat corpse present: prototype drew (and lost) the whiff d10; engine drew no such die — both swings still miss this round on different underlying rolls, so wp doesn't move on either side yet |
| 8 attack | unchanged, combat still open | **wp 22, sp 30, kills 2, rations 8, combat null** | engine kills the Shriek here — the encounter clears; prototype's Shriek is still alive |
| 9 attack | unchanged, combat still open | unchanged (combat already null, no-op) | |
| 10 attack | **wp 0, dead true, combat null** | unchanged (combat already null, no-op) | prototype's Fridgian dies to the Shriek here |

**End-state pins written into the declared record:**
- prototype (`before`): `wp: 0, sp: 5, kills: 1, rations: 7`, `stateBefore: { dead: true }`
- engine (`after`): `wp: 22, sp: 30, kills: 2, rations: 8`, `stateAfter: { dead: false }`
- `gold` (51) and `combat === null` are identical on both sides and intentionally omitted from the declared `fields` (nothing to check).

### combat/flee (seed 17) — confirmed byte-identical

Replayed the same way: `startCombat` then `flee`. Both sides end at `wp 40, sp 0, kills 0, rations 5, gold 50, dead false, combat null` after both actions — no divergence anywhere in this scenario's action path (it never reaches a frenzy).

### lose-apprentice (seed 127) — new scenario, measured

Rolls **Magic User / Apprentice / Human**, Cloth armor, wp 33, against the same roster as seed 14 (Bat/Rat wp 1 + Shriek wp 3). Confirmed byte-identical between prototype and engine after every one of the 14 scripted `attack` actions; **dies on attack 14** on both sides (`wp 0, dead true, combat null`), restoring death-path parity coverage that seed 14 no longer provides post-patch.

### FID-02 pins — before/after

| seed | forced | roster | before (draws/attacks/outcome) | after (measured, live) |
|---|---|---|---|---|
| 3 | Beasts | Shriek | 12 / 1 / won | unchanged: 12 / 1 / won |
| 14 | Beasts | Bat/Rat, Shriek | 101 / 10 / died | **87 / 8 / won** |
| 17 | Beasts | Viper, Shriek | 111 / 11 / won | **101 / 9 / won** |
| 303 | Humans | Dante, Dante | 66 / 6 / won | unchanged: 66 / 6 / won |
| 8 | Beasts | Shriek | 32 / 4 / won | unchanged: 32 / 4 / won |
| 127 | Beasts | Bat/Rat, Shriek | (new row) | **119 / 14 / died** |

Seeds 14 and 17 are both Fridgian heroes (Soldier and Pilfer respectively) whose full-fight replay includes a frenzy with a corpse present — same root cause as the parity divergence. Seed 127 is the new row restoring death-path FID-02 coverage.

### Collateral D-15 pins (test/determinism/foe-abilities.test.js) — before/after

Seed 1's hero is a Fridgian Knight (documented in `24-CONTEXT.md`'s fixture-roll notes); three of the five full-fight encounters kill one of their two same-named foes mid-fight and then frenzy again with the corpse present, hitting the same removed draw:

| encounter | before (draws/attacks/outcome) | after (measured, live) |
|---|---|---|
| humans-t2 | 76 / 6 / won | **59 / 4 / won** |
| magical-t4 | 46 / 4 / won | unchanged: 46 / 4 / won |
| demons-t5 | 63 / 5 / won | **55 / 4 / won** |
| walking-dead-t5 | 36 / 2 / died | unchanged: 36 / 2 / died |
| beasts-t5 | 71 / 5 / died | **64 / 4 / died** |

The 12-visit per-visit pins (`PER_VISIT_PINS`) are untouched for all five encounters — `runVisits` only drives `foeTurn`, never `playerStrike`, so frenzy never fires in that helper.

## Task Commits

Each task was committed atomically:

1. **Task 1: RACES flags + Fridgian hide/whiff + Dwarven half-wear in combat.js; narration entry removal; unit tests** - `2c4f153` (feat)
2. **Task 2: Declare the combat/lose (seed 14) action-path divergence; add lose-apprentice; re-measure FID-02 pins** - `c3ba036` (feat)
3. **Task 3: Regenerate the fixture-inventory roster; collateral D-15 pin re-measurement; full suite green** - `0083626` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `content/races.js` - `Fridgian.hide = 2`, `Dwarven.armorWear = 0.5`
- `engine/combat.js` - `applyFoeDamageToPlayer` hide line + Dwarven half-wear line; `playerStrike` frenzy block without the corpse-whiff branch
- `src/browser/eventNarration.js` - removed the dead `frenzyWasted` entry
- `test/unit/combat.test.js` - rewrote the frenzy test for the always-live second swing
- `test/unit/identity-race.test.js` - new, 12 tests
- `test/parity/fixtures/action-script.combat.json` - `lose`'s declared `divergence` record; new `lose-apprentice` scenario; updated `_note`
- `test/unit/foe-turn-draw-count.test.js` - re-measured `FULL_FIGHTS` (seed 14, seed 17), new seed 127 row, reworded restated-totals test
- `test/parity/fixture-inventory.test.js` - new pinned `lose-apprentice` row, `Array(5)` -> `Array(6)`, reworded title
- `test/parity/FIXTURE-INVENTORY.md` - regenerated generated block (one new row)
- `test/determinism/foe-abilities.test.js` - re-measured `FULL_FIGHT_PINS` for humans-t2/demons-t5/beasts-t5 (collateral fix)

## Decisions Made

- Hide is applied as a second, independent `Math.max(1, dmg - N)` step directly after Hardiness, not folded into a single combined subtraction — this keeps each race/skill's contribution individually readable and matches the plan's stated stacking order exactly.
- The divergence record's `fields` list omits `gold` (identical on both sides) — `declaredEndDiffs` only needs to check fields that actually diverge, and the acceptance criteria explicitly requires every declared field to really differ.
- Treated the seed-1 D-15 pin drift in `test/determinism/foe-abilities.test.js` (not in this plan's file list) as a Rule 1 collision fix rather than out-of-scope — it is the direct, mechanical consequence of this plan's own engine change (same root cause as the FID-02 pins), and leaving it red would violate the project's "npm test green at the end" gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Collision] test/determinism/foe-abilities.test.js's D-15 FULL_FIGHT_PINS drifted for three of five encounters**
- **Found during:** Task 3's `npm test` verification pass (after all three planned tasks were otherwise green)
- **Issue:** `npm test` reported 3 failures outside this plan's file list: `humans-t2`, `demons-t5`, and `beasts-t5` in `test/determinism/foe-abilities.test.js` each pin a full-fight draw/attack count for seed 1 (a Fridgian Knight, per `24-CONTEXT.md`'s fixture-roll notes). Each of these three encounters kills one of its two same-named foes mid-fight and then frenzies again with the corpse present — exactly the removed `rng.d(10)` whiff draw this plan's Task 1 deleted.
- **Fix:** Re-measured all five `FULL_FIGHT_PINS` live via this file's own `runFullFight` helper (never hand-computed, following the file's own "pins are measured, not adjusted" rule): `humans-t2` 76/6/won -> 59/4/won, `demons-t5` 63/5/won -> 55/4/won, `beasts-t5` 71/5/died -> 64/4/died; confirmed `magical-t4` (46/4/won) and `walking-dead-t5` (36/2/died) unchanged. Added a Phase 24 provenance comment above the pin table naming the root cause. The 12-visit `PER_VISIT_PINS` were confirmed unaffected (that helper never calls `playerStrike`) and left untouched.
- **Files modified:** `test/determinism/foe-abilities.test.js`
- **Verification:** `node --test test/determinism/foe-abilities.test.js` — 13/13; `npm test` — 1089/1089, `# fail 0`.
- **Committed in:** `0083626` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 collision, directly caused by this plan's own deliberate rng-draw removal)
**Impact on plan:** Necessary to keep the full suite green per the project's engine gate; zero scope creep — the fix is a pure pin re-measurement with a documented rationale, no engine behavior touched beyond what Task 1 already changed.

## Issues Encountered

None beyond the collision above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 24-04 through 24-07 can proceed: the Fridgian and Dwarven mechanics are landed, and the FID-07 action-path divergence harness now has a real, working example (`combat/lose`) to pattern-match against for the Pickpocket store-markup divergence (Plan 24-04).
- `docs/CLASS-PASS.md`'s Rulings section (owned by a later plan) can now cite this plan's rationale paragraph verbatim for the Fridgian/Dwarven race-pass entries.
- No blockers. `npm test` 1089/1089, parity 33/33 (five combat scenarios including the new `lose-apprentice`), `test/parity/prototype-master.js.txt` and every other fixture untouched.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*
