---
phase: 72-roll-direction-sign-audit-fixes
plan: 03
subsystem: testing
tags: [combat, direction-test, node-test, odds-harness, roll-under, engine, non-combat]

requires:
  - phase: 72-02
    provides: "test/unit/harness/rollOdds.js — the shared odds harness (probeRng, faceOdds, jointOdds, compareOdds, assertBonus, assertPenalty, assertSame, heroState, foeFrom, inCombat, withMember)"
provides:
  - test/unit/rollDirection-checks.test.js — the NON-COMBAT half of the ROLL-01 direction test (soak both ways, thrown spells hero/member, resistance, initiative, flee, parley, traps, locks, climbs, leaps, cures, wake, drops)
  - test/unit/harness/rollOdds.js#armorFrom — an additive helper returning a real ARMORS row, reused by soak/flee/climb/leap rows
  - One RED pending row naming its fixing plan (parley-need-mod → 72-07, F5)
affects: [72-04, 72-05, 72-06, 72-07, 73]

tech-stack:
  added: []
  patterns:
    - "Direction rows assert on success ODDS (wins/N over the probed die's own faces), never on raw need/roll/target/dieN — the same mirror-proof token gate 72-02 established, extended over this file too."
    - "A soak row (hero armor, or foe natural armor) always probes draw index 2 — the sequence is fixed (to-hit roll, damage dice, then the soak d20), so every soak row shares the same isProbe shape."
    - "A row whose modifier makes a draw UNREACHABLE (a noArmor foe, a crit bypassing natural soak, a Pilfer skipping the lock roll) is asserted by checking the ABSENCE of the specific event type directly, not via faceOdds's vacuous-probe throw — a wrapper function (playerStrike/openChest) that keeps drawing for OTHER reasons (a foeTurn counter-swing via afterPlayerAction, gold/scroll/treasure rolls) would make the vacuous-probe pattern a false positive."
    - "A chargen-random field that isn't the row's own test variable (armor, phobia, skills) is explicitly cleared/overridden in every builder, because heroState's default seed=1 chargen deterministically assigns a real starting phobia/armor/skill set to every class/sub/race combination — an unset override doesn't mean 'no phobia', it means 'whatever seed 1 rolled'."

key-files:
  created:
    - test/unit/rollDirection-checks.test.js
  modified:
    - test/unit/harness/rollOdds.js

key-decisions:
  - "armorFrom(name) added to the shared harness (not this file) since three+ soak/flee/climb/leap rows across this plan needed the same real-ARMORS-row lookup — matches the plan's own suggestion."
  - "Hero level is capped at 5 in every row (content/classes.js#CLASSES gain tables only have 5 entries) — the parley:ceiling row originally tried level 20+ to force the 85% cap and crashed engine/difficulty.js#heroMeanMaxWpFor reading past the table's end; fixed by reaching the same cap at level 5 (Con Artist + Wilmsry + level 5 already exceeds 17) and using a live Helm of Knowledge as the 'one more bonus term' instead of a further level bump."
  - "[foe-soak:crit-bypass] and [lock:pilfer] check the specific event type's absence directly rather than through faceOdds's vacuous-probe throw pattern — both wrap a function whose caller keeps drawing rng for OTHER reasons after the bypassed draw (playerStrike's afterPlayerAction runs a full foeTurn counter-swing when the foe survives; a Pilfer's openChest still rolls gold/scroll/treasure), so 'probed nothing at index 2' isn't actually true even though the SPECIFIC soak/lock draw never fires."
  - "Every hero-soak/foe-soak row uses isProbe index 2 uniformly: draw 0 is always the to-hit roll (foe-vs-hero, or the hero's own strike), draw 1 is always the follow-on damage dice, draw 2 is the soak d20 when the gate (av.wp>0 && av.ar>0 && !ignores, or foe.sp.ar>0 && !crit) allows it."

requirements-completed: [ROLL-01]

duration: ~2h
completed: 2026-09-24
status: complete
---

# Phase 72 Plan 03: Non-Combat Direction Test Summary

**Built the non-combat half of `test/unit/rollDirection-checks.test.js` — 51 direction rows across every modifier source outside the to-hit/crit core (soak both ways, thrown spells, resistance, initiative, flee, parley, traps, locks, climbs, leaps, cures, wake, drops), one pinned RED (`[parley:parley-need-mod]`, finding F5) for 72-07 to flip.**

## Performance

- **Duration:** ~2h
- **Tasks:** 2 (Task 1: soak/thrown/resist/initiative; Task 2: flee/parley/trap/lock/climb/leap/cure/wake/drop + the F5 pending row)
- **Files modified:** 2 (1 new, 1 additive change to the shared harness)

## Accomplishments

- `test/unit/rollDirection-checks.test.js` (new, 819 lines): 51 `test()` rows, every id from the plan's Task 1/Task 2 catalogues present — none dropped.
- `test/unit/harness/rollOdds.js`: added `armorFrom(name)`, a small lookup over `content/armors.js#ARMORS` — the exact fields `engine/items.js#takeItem`'s armor branch copies onto `c` — reused by every soak/flee/climb/leap row that needs a real armor row's AR/bulk.
- Both mirror-proof token gates print 0 over the whole file (no `.need`/`.roll`/`.dieN`/`.total`/`.mine`/`.theirs` reads, no need-arithmetic helper calls, no `ar: N` literals).
- `node --test test/unit/rollDirection-checks.test.js test/unit/rollDirection.test.js`: 139 tests, 128 pass, 0 fail, 11 todo (this plan's 1 pending row + 72-02's 10 pre-existing pending rows).
- `npm test`: 5,618 tests, 5,605 pass, 0 unexpected fail, 11 todo — the 7 failing lines are the pre-existing worktree-only CRLF doc-ledger noise (`docs/CLASS-PASS.md`/`docs/FLEE.md`), identical on the base commit per the orchestrator's notes.

## Task Commits

1. **Task 1: Rows for soak, thrown spells, resistance and initiative** — `f50911a` (test) — `test/unit/rollDirection-checks.test.js` (new, 429 lines, 19 rows) + `test/unit/harness/rollOdds.js#armorFrom`.
2. **Task 2: Rows for flee, parley, traps, locks, climbs, leaps, cure, wake and drops, plus the F5 pending row** — `25ad2d7` (test) — the rest of `test/unit/rollDirection-checks.test.js` (32 more rows, 51 total).

**Plan metadata:** this SUMMARY's own commit (docs: complete plan), made by the execution harness after this file is written.

## Files Created/Modified

- `test/unit/rollDirection-checks.test.js` — the non-combat direction test (this plan's own deliverable; the `[parley:parley-need-mod]` row is flipped by 72-07).
- `test/unit/harness/rollOdds.js` — `armorFrom(name)` added (also usable by any later plan).

## Row Ledger (id → verdict)

Legend: **PASS** = green today. **PENDING → 72-07 (F5)** = `todo` option, confirmed RED today, that plan deletes the option.

### Hero soak (5 ids, all PASS)

armor-ar, cloak-of-armor, taunt, fighter-armor-mul, no-armor-foe — all PASS.

### Foe natural soak (2 ids, all PASS)

natural-ar, crit-bypass — all PASS.

### Thrown / ally-thrown (3 ids, all PASS)

thrown:school-bonus, thrown:afraid, ally-thrown:school-bonus — all PASS.

### Resist (2 ids, all PASS)

intel, intel-gate — all PASS.

### Initiative (7 ids, all PASS)

samurai, fridgian-slow, knight-big-foe, court-mage, foresight, acute-hearing, senses — all PASS.

### Flee (7 ids, all PASS)

thief, class-mod, race-mod-elven, race-mod-heavy, armor-bulk, flee-need-mod, smoke — all PASS.

### Parley (9 ids, all PASS except parley-need-mod)

con-artist, woodsman, wilmsry, elven-humans, fluency, level, top-foe-level, ceiling — all PASS. parley-need-mod — **PENDING → 72-07 (F5)**.

### Trap (2 ids, all PASS)

acrobat, thief-trap-avoid — all PASS.

### Lock (5 ids, all PASS)

locks-tier, locks-tier-2, lockpicks, intel-bonus, pilfer — all PASS.

### Climb (3 ids, all PASS)

heights, hardiness-halving, armor-bulk — all PASS.

### Leap (2 ids, all PASS)

water, armor-bulk — all PASS.

### Cure (1 id, PASS)

hardiness — PASS.

### Wake (2 ids, all PASS)

bard, wander-rate — all PASS.

### Drop (1 id, PASS)

foe-level — PASS.

**Totals:** 50 rows PASS today, 1 row PENDING (RED, todo). No catalogue id was dropped — every id the plan's Task 1/Task 2 action lists named has a row.

## RED Confirmation (the pending row)

`[parley:parley-need-mod]` was confirmed to genuinely FAIL on today's engine: a scratch copy (`test/unit/scratch/rollDirection-checks-scratch.test.js`, its own import paths patched for its one-level-deeper location, never committed) had the `{ todo: "fixed by 72-07 (F5)" }` option stripped and was re-run with `node --test`. Result: 50 pass, 1 fail (exactly `[parley:parley-need-mod]`), 0 todo — matching the file's own todo set exactly. The failure message: `assertPenalty [parley:parley-need-mod]: expected a strict penalty (with 14/20 <= without 13/20), got the opposite` — today `PARLEY_NEED_MOD: 1` is a BONUS (13/20 → 14/20), the exact opposite of its "up = harder" documentation (`engine/difficulty.js#parleyNeedModFor` JSDoc), confirming finding F5. The scratch copy was deleted immediately after confirmation (`rm -rf test/unit/scratch`) and is not present in either task commit — `git status --porcelain` confirms no trace.

## Decisions Made

See `key-decisions` in the frontmatter — summarized: `armorFrom(name)` added to the shared harness (reused across soak/flee/climb/leap rows); every hero level in this file stays ≤ 5 (the engine's own class-gain tables only cover levels 1–5 — a level-20+ build crashes `heroMeanMaxWpFor`/`roundDamageCapFor` inside a foe's counter-turn, discovered building `[parley:ceiling]`); `[foe-soak:crit-bypass]` and `[lock:pilfer]` check the bypassed event type's absence directly instead of through the vacuous-probe throw pattern, because the wrapping function (`playerStrike`'s `afterPlayerAction` tail, `openChest`'s gold/scroll/treasure draws) legitimately keeps drawing rng for unrelated reasons after the specific draw under test is skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `[foe-soak:crit-bypass]`'s vacuous-probe assertion was a false negative**
- **Found during:** Task 1, first test run
- **Issue:** `playerStrike`'s own tail calls `afterPlayerAction`, which runs a full `foeTurn` counter-swing when the target foe survives the hero's crit — that counter-swing's own to-hit roll lands at probe index 2 (the same index the bypassed `foeArmorSoaked` draw would have used), so `faceOdds`'s vacuous-probe guard never threw even though the natural-armor soak itself was correctly bypassed.
- **Fix:** dropped the `assert.throws(() => faceOdds(...))` half of the row; kept (and strengthened) the direct check — `events.some(e => e.type === "struck" && e.critical)` plus `!events.some(e => e.type === "foeArmorSoaked")` — which is unaffected by any later, unrelated draw.
- **Files modified:** test/unit/rollDirection-checks.test.js
- **Verification:** re-ran `node --test`; the row passes and its docstring now explains why the vacuous-probe pattern doesn't apply here.
- **Committed in:** f50911a (Task 1 commit)

**2. [Rule 1 - Bug] `[lock:pilfer]`'s vacuous-probe assertion was a false negative**
- **Found during:** Task 2, first test run
- **Issue:** a Pilfer skips only the LOCK roll — `openChest` still draws for gold (`gainWilmst`), a scroll chance, and `rollTreasureItem`, all starting at probe index 0 — so `faceOdds`'s default `isProbe` (index 0) found a draw immediately and never threw, even though the lock roll itself was correctly skipped.
- **Fix:** dropped the `assert.throws` half; the row now checks `events.some(e => e.type === "chestOpened" && e.reason === "pilfer")` and `!events.some(e => e.type === "chestLockRolled")` directly.
- **Files modified:** test/unit/rollDirection-checks.test.js
- **Verification:** re-ran `node --test`; the row passes.
- **Committed in:** 25ad2d7 (Task 2 commit)

**3. [Rule 1 - Bug] `[parley:ceiling]` crashed the engine at level 20+**
- **Found during:** Task 2, first test run
- **Issue:** the row originally used `level: 20 + extraLevel` to force the parley 85% ceiling; `content/classes.js#CLASSES` gain tables only have 5 entries (levels 1–4 plus the null placeholder), so a failed parley's `afterPlayerAction` → `foeTurn` → `roundDamageCapFor` → `heroMeanMaxWpFor` → `classMean` → `meanDice` chain read past the array end and threw `Cannot read properties of undefined (reading 'n')`.
- **Fix:** capped the build at `level: 5` (Con Artist + Wilmsry + level 5 against a tier-1 foe already exceeds the `9 + bonus` ceiling) and used a live Helm of Knowledge (fluency +2) as the "one more bonus term beyond the cap" instead of a further level bump.
- **Files modified:** test/unit/rollDirection-checks.test.js
- **Verification:** re-ran `node --test`; the row passes, still genuinely proving the 85% ceiling (17/20 wins) and its non-worsening property when a further bonus stacks on top.
- **Committed in:** 25ad2d7 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in the test scaffolding itself, discovered by running the tests, not in engine/content). **Impact on plan:** none of the three touched `engine/`, `content/` or `src/` — `git status --porcelain -- engine/ content/ src/` prints nothing, confirmed after both commits. No scope creep; every fix was necessary for the affected rows to actually exercise what their titles claim.

## Issues Encountered

None beyond the three deviations above (all resolved during execution via iterative `node --test` runs).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

none

## Next Phase Readiness

- 72-04 (Thief evasion sign + insult ordering), 72-05 (Fridgian frenzy math), 72-06 (Skeleton shatter) and 72-07 (parley-need-mod sign, F5) each have their RED row(s) ready to flip — delete the `todo` option once the fix lands, no other change needed to either direction-test file.
- Phase 73's roll-high mirror can run `test/unit/rollDirection-checks.test.js` unchanged, alongside `test/unit/rollDirection.test.js`: every assertion in both files is odds-based (wins/N), and both mirror-proof token gates print 0 over the combined pair.
- Together with 72-02, every modifier source in `docs/ROLL-LEDGER.md`'s `## Modifier ledger` now has an odds-based direction row.

---
*Phase: 72-roll-direction-sign-audit-fixes*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: test/unit/rollDirection-checks.test.js
- FOUND: test/unit/harness/rollOdds.js (modified, armorFrom present)
- FOUND: f50911a (Task 1 commit)
- FOUND: 25ad2d7 (Task 2 commit)
