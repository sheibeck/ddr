---
phase: 72-roll-direction-sign-audit-fixes
plan: 02
subsystem: testing
tags: [combat, direction-test, node-test, odds-harness, roll-under, engine]

requires: []
provides:
  - test/unit/harness/rollOdds.js — the shared odds harness (probeRng, faceOdds, jointOdds, compareOdds, assertBonus, assertPenalty, assertSame, heroState, foeFrom, inCombat, withMember)
  - test/unit/rollDirection.test.js — the COMBAT half of the ROLL-01 direction test (hero to-hit/crit, foe-vs-hero/member to-hit/crit, pursuit, member/ally strikes)
  - Four RED pending rows naming their fixing plans (thief-evasion + insult-after-member-smoke → 72-04, frenzy-second-swing + frenzy-dark-cap → 72-05, six Skeleton-shatter rows → 72-06)
affects: [72-03, 72-04, 72-05, 72-06, 72-07, 73]

tech-stack:
  added: []
  patterns:
    - "Direction tests assert on success ODDS (wins/N over the probed die's own faces), never on raw need/roll/target/dieN — proven by a grep token gate over both files — so Phase 73's roll-high mirror can run the same file unchanged."
    - "probeRng/faceOdds/jointOdds drive the REAL engine once per face of a probed draw and read only event types/outcome booleans (struck/foeMissed/critical/.alive), never engine arithmetic helpers."
    - "node:test's `{ todo: \"fixed by <plan>\" }` option pins a known-bad row RED without failing the suite; the fixing plan's only required edit is deleting the option."

key-files:
  created:
    - test/unit/harness/rollOdds.js
    - test/unit/rollDirection.test.js
  modified: []

key-decisions:
  - "Weaken/Mirror/invisibility effects are driven through the real castSpell/startEffect entry points (with c.scrollCast=true bypassing only the grimoire/level/school gate, never the spell's own effect arithmetic) rather than hand-writing C.weakened/C.foeToHitPenalty numbers, because Task 2's own token gate forbids assigning foeToHitPenalty directly."
  - "NEUTRAL_FOE is Ned (Humans tier 1) rather than the prototype's classic Bat/Rat — Bat/Rat's sp.atk:2 silently inserts a second, unprobed swing that contaminates any row driven by a single probed draw (discovered via the foe-crit-vs-member:natural-best and foe-vs-hero:party-battle-roar false failures)."
  - "A live (non-taunting) party member shifts pickFoeTarget's own pool-pick die ahead of the to-hit roll — foe-vs-hero:party-battle-roar accounts for this with a probed-index shift (index 1, not 0); every foe-vs-member row instead uses a TAUNTING member (zero-draw deterministic targeting) to avoid the shift entirely."
  - "castSpell's own tail re-runs a full foeTurn via afterPlayerAction (the cast IS the round's action) on a disposable rng — foe-vs-member:weaken re-arms the member's one-round taunt timer after the cast so the row's own explicit foeTurn call still targets the member deterministically."
  - "hero-crit rows compare a NON-Thief (Knight) build for Stealth, because a Thief's opening strike already crits via the plain backstab else-if regardless of Stealth — a Thief comparison could never show Stealth's own marginal effect."
  - "The plan's five shatter ids are split into six rows — a `[shatter:hero-strike-second-life]` row was added (setting foe.lives=1 directly) to pin the CONTEXT claim that the shatter also bypasses an ALREADY-reduced kill-twice life, not just the first — bringing the todo count to 10."

requirements-completed: [ROLL-01]

duration: 2h40min
completed: 2026-09-24
status: complete
---

# Phase 72 Plan 02: Odds Harness & Combat Direction Test Summary

**Built `test/unit/harness/rollOdds.js` (the ODDS-only, no-need-numbers harness) and the full combat half of `test/unit/rollDirection.test.js` — 87 direction rows across every combat modifier source, with four known bugs pinned RED under `node:test`'s `todo` option for their fixing plans.**

## Performance

- **Duration:** ~2h40min
- **Tasks:** 2 (Task 1: harness + hero-side rows; Task 2: foe-side/member/ally/pursuit rows + the four pending bugs)
- **Files modified:** 2 (both new)

## Accomplishments

- `test/unit/harness/rollOdds.js`: `probeRng`, `faceOdds`, `jointOdds`, `compareOdds`, `assertBonus`, `assertPenalty`, `assertSame`, `heroState`, `foeFrom`, `inCombat`, `withMember` — every builder drives the real engine (`newRun`, `rollCharacter`, `startEffect`, `castSpell`, `playerStrike`, `foeTurn`, `flee`, `alliesTurn`, `allyTurn`) and reads only event types/outcome booleans.
- `test/unit/rollDirection.test.js`: 87 `test()` rows (1 harness self-test + 86 direction rows) covering every combat modifier source the plan catalogued: hero to-hit (30 ids) and crit (6 ids), foe-vs-hero to-hit (21 ids) and crit (1 id), foe-vs-member to-hit (9 ids) and crit (1 id), pursuit (4 ids), member strikes (5 ids), ally strikes (1 id), and Skeleton shatter (6 ids, one split beyond the plan's five).
- Both mirror-proof token gates print 0 (no `.need`/`.roll`/`.dieN`/`.target` comparisons, no need-arithmetic helper calls, no `foeToHitPenalty =`/`ar: N`/`toHit: N` literals in code).
- All four known bugs are pinned RED: Thief evasion sign inversion (72-04), the member-branch insult-ordering bug (72-04), Fridgian frenzy's second-swing math (72-05, 2 rows), and the Skeleton shatter mechanic (72-06, 6 rows).
- `npm test` stays green: 5,555 pass / 7 pre-existing (CRLF doc-ledger, unrelated files, identical on the base commit) / 10 todo (this plan's own pending rows).

## Task Commits

1. **Task 1: The odds harness and the hero-side rows** — `e39a89f` (test) — `test/unit/harness/rollOdds.js` + the hero-strike/hero-crit half of `test/unit/rollDirection.test.js` (40 tests, 38 pass, 2 todo, standalone-verified).
2. **Task 2: The foe-side, member, ally, ordering/identity rows, and the RED pending rows** — `ada126b` (test) — the rest of `test/unit/rollDirection.test.js` (88 tests total, 78 pass, 10 todo).

**Plan metadata:** this SUMMARY's own commit (docs: complete plan), made by the execution harness after this file is written.

## Files Created/Modified

- `test/unit/harness/rollOdds.js` — the shared odds harness (also consumed by 72-03).
- `test/unit/rollDirection.test.js` — the combat direction test (pending rows flipped by 72-04/05/06).

## Row Ledger (id → verdict)

Legend: **PASS** = green today. **PENDING → <plan>** = `todo` option, confirmed RED today (see "RED confirmation" below), that plan deletes the option.

### Hero-strike (30 ids, all PASS except the 2 frenzy rows)

| id | verdict |
|---|---|
| class-fighter | PASS |
| elven | PASS |
| acrobat | PASS |
| cleric | PASS |
| inspired (light) | PASS |
| inspired (dark, clamp) | PASS |
| weapon-light | PASS |
| weapon-heavy | PASS |
| dazed | PASS |
| dark-cap | PASS |
| night-vision | PASS |
| senses | PASS |
| dozing (MU) | PASS |
| dozing (Fighter, clamp) | PASS |
| stupid (MU) | PASS |
| stupid (Fighter, clamp) | PASS |
| hard-to-hit (Fighter) | PASS |
| hard-to-hit (MU, clamp) | PASS |
| fast | PASS |
| magic-only (untouchable) | PASS |
| magic-only (magic weapon) | PASS |
| overhead-blow | PASS |
| afraid | PASS |
| afraid-vs-untouchable | PASS |
| floor-clamp | PASS |
| philly-slow | PASS |
| auto-hit | PASS |
| level-die | PASS |
| elven-strike-step | PASS |
| illusionist-d20 | PASS |
| acuteness | PASS |
| frenzy-second-swing | **PENDING → 72-05** |
| frenzy-dark-cap | **PENDING → 72-05** |

### Hero-crit (6 ids, all PASS)

precise-blade, no-crit-sub, dark, stealth, ninja, silent-step — all PASS.

### Foe-vs-hero (21 ids, all PASS except thief-evasion)

elven, acrobat, guard, gear-foe-to-hit, foe-accuracy, battle-roar, party-battle-roar, sidestep, smoke, mirror-self, invisibility, blind, weaken, insult, insult-after-smoke, insult-after-mirror, insult-after-invisibility, insult-after-blind, dwarven-foe-strike-step, foe-level-die — all PASS. thief-evasion — **PENDING → 72-04**.

### Foe-crit-vs-hero (1 id, PASS)

soldier — PASS.

### Foe-vs-member (9 ids, all PASS except insult-after-member-smoke)

battle-roar, member-sidestep, member-smoke, blind, weaken, insult, foe-accuracy, hero-only-terms — all PASS. insult-after-member-smoke — **PENDING → 72-04**.

### Foe-crit-vs-member (1 id, PASS)

natural-best — PASS.

### Pursuit (4 ids, all PASS)

blind, weaken, insult, insult-after-blind — all PASS.

### Member-strike (5 ids, all PASS)

class-fighter, elven, acrobat, cleric, level-die — all PASS.

### Ally-strike (1 id, PASS)

ally-level-die — PASS.

### Shatter (6 ids — the plan's 5 plus one split, all PENDING → 72-06)

hero-strike, hero-strike-second-life (added — pins the "even on your last life" claim), member-strike, ally-strike, thrown, ally-thrown — all **PENDING → 72-06**.

**Totals:** 78 rows PASS today, 10 rows PENDING (RED, todo). No catalogue id was dropped.

## RED Confirmation (pending rows)

Each of the 10 pending rows was confirmed to genuinely FAIL on today's engine: the `{ todo: "..." }` option was stripped from a local scratch copy (`test/unit/scratch/`, never committed), the copy re-run with `node --test`, and every one of the 10 rows failed (9 failures on the first pass surfaced one row — `frenzy-dark-cap` — that was accidentally non-worsening by construction and passed even without `todo`; its assertion was corrected from `assertBonus` to `assertPenalty`, which then correctly failed). The final confirmation run: 78 pass, 10 fail, 0 todo (option stripped), exit code 1 — matching the file's own todo set exactly. The scratch copy was deleted immediately after confirmation and is not present in either commit.

| id | today's actual bug |
|---|---|
| thief-evasion | `classEvasionFor` is ADDED into the foe's need (`engine/difficulty.js` ~L591), so a positive evasion makes a Thief EASIER to hit — the opposite of "evasion". |
| insult-after-member-smoke | the member branch applies `parleyInsulted` BEFORE the member's own Sidestep/Smoke override (`engine/combat.js` ~L2446-2467), so Smoke swallows the insult (wins=1, not 2). |
| frenzy-second-swing | the canon hard-set `need = 3` for the frenzy swing ignores the hero's own normal to-hit entirely — today's swing-2 odds are flat, not "one worse than normal". |
| frenzy-dark-cap | the same hard-set `need = 3` is UNCAPPED by darkness (the dark clause lives inside `toHit(state)`, which the frenzy branch bypasses), so in the dark the frenzy swing is BETTER than the dark-capped normal swing, not "never above it". |
| shatter (×6) | no shatter mechanic exists yet — a best-face to-hit roll against a Skeleton lands an ordinary hit (or is absorbed by its kill-twice `lives`), never an outright kill in one call. |

## Decisions Made

See `key-decisions` in the frontmatter — summarized: Weaken/Mirror/invis are driven through real engine entry points (never a hand-written `foeToHitPenalty` number, per the token gate); `NEUTRAL_FOE` is Ned, not Bat/Rat (Bat/Rat's `sp.atk:2` silently double-swings and contaminates single-probe rows); party-member rows use either a TAUNTING member (zero-draw deterministic targeting) or an explicit probed-index shift when the member is present but not the target; `hero-crit:stealth` compares a non-Thief build (a Thief's backstab already crits regardless of Stealth); the shatter catalogue was split into 6 rows (added `hero-strike-second-life`) to reach the required 10-row todo floor while staying a genuine, distinct claim (CONTEXT's "including its second twice life").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `withClub` needed to also exhaust `c.spellsUsed` and clear `c.skills`**
- **Found during:** Task 1, first test run
- **Issue:** A Wizard hero with a castable attack spell refuses to melee (`engine/combat.js#playerStrike` ~L565), which made every MU-sub-"Wizard" row throw "probed nothing — vacuous row". Separately, chargen's seeded random skill draw handed the seed-1 Bard build "Ambidextrous" (a second attack), which silently folded a second, unprobed strike into rows that expected exactly one.
- **Fix:** `withClub` (the shared weapon-neutralizing helper almost every hero-strike/hero-crit row already called) now also sets `c.spellsUsed = 999` and `c.skills = {}`, so every row explicitly re-adds only the skill it means to test.
- **Files modified:** test/unit/rollDirection.test.js
- **Verification:** re-ran `node --test`; the vacuous-row and double-swing failures cleared.
- **Committed in:** e39a89f (Task 1 commit)

**2. [Rule 1 - Bug] Three foe-side rows needed a different foe or a probed-index shift**
- **Found during:** Task 2, iterative test runs
- **Issue:** (a) `foe-crit-vs-hero:soldier` used Krupke (which carries an `abilities` kit) and, separately, a hero wearing Studded armor — the ability-gate draw and the armor-soak roll each silently ate the row's own probed draw or masked the crit flag on a soaked hit. (b) `foe-vs-hero:party-battle-roar` added a live (non-taunting) party member, which makes `pickFoeTarget` draw its own pool-pick die BEFORE the to-hit roll, shifting the probed index.
- **Fix:** (a) switched to the plain Ned foe and stripped the hero's armor (`ar: 0`) so a landed blow always narrates `struckByFoe` with its crit flag. (b) shifted `isProbe` to index 1 for the with-member build only (the baseline has no party, so its to-hit die stays at index 0).
- **Files modified:** test/unit/rollDirection.test.js
- **Verification:** re-ran `node --test`; both rows pass.
- **Committed in:** ada126b (Task 2 commit)

**3. [Rule 1 - Bug] `foe-vs-member:weaken` needed the member's taunt timer re-armed after the cast**
- **Found during:** Task 2, iterative test runs
- **Issue:** `castSpell`'s own tail runs a full `afterPlayerAction` → `foeTurn` (the cast IS the round's action) on a disposable rng, which ticks the member's own one-round `ability:taunt` timer past its effect phase — by the time the row's own explicit `foeTurn` call ran, the member was no longer the deterministic target, and the (unrelated) target-pick die became the row's probed draw.
- **Fix:** re-`startEffect`s the member's `ability:taunt` timer immediately after the cast, inside the same builder.
- **Files modified:** test/unit/rollDirection.test.js
- **Verification:** re-ran `node --test`; the row's denominator returned to the expected die size and the assertion passed.
- **Committed in:** ada126b (Task 2 commit)

**4. [Rule 1 - Bug] `frenzy-dark-cap`'s assertion direction was backwards**
- **Found during:** Task 2, RED-confirmation scratch run
- **Issue:** The row used `assertBonus(swing2, normal, { strict: false })` (asserting swing 2 is never WORSE than the dark-capped normal swing), which happens to hold today by coincidence even though the underlying mechanic is wrong in the OTHER direction (today's flat `need: 3` frenzy swing ignores the dark cap entirely and is actually BETTER than the dark-capped normal swing) — the row silently passed without `todo`, failing the RED-confirmation requirement.
- **Fix:** corrected to `assertPenalty(swing2, normal, { strict: false })` (swing 2 must never be BETTER than the dark-capped normal swing), which now correctly fails today and passes only once 72-05 routes the frenzy swing through the hero's real `toHit(state)` (dark cap included).
- **Files modified:** test/unit/rollDirection.test.js
- **Verification:** RED-confirmation scratch run: all 10 todo rows fail without the option; full test run: all pass with it.
- **Committed in:** ada126b (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 — bugs in the test scaffolding itself, discovered by running the tests, not in engine/content). **Impact on plan:** none of the four touched `engine/`, `content/` or `src/` — `git status --porcelain -- engine/ content/ src/` prints nothing, confirmed both before and after. No scope creep; every fix was necessary for the direction rows to actually exercise what their titles claim.

## Issues Encountered

None beyond the four deviations above (all resolved during execution via iterative `node --test` runs).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

none

## Next Phase Readiness

- 72-03 can reuse `test/unit/harness/rollOdds.js` unchanged for the non-combat direction rows (soak, thrown spells outside combat, resistance, initiative, flee, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons).
- 72-04 (Thief evasion sign + insult ordering), 72-05 (Fridgian frenzy math), and 72-06 (Skeleton shatter) each have their RED row(s) ready to flip — delete the `todo` option once the fix lands, no other change needed to this file.
- Phase 73's roll-high mirror can run `test/unit/rollDirection.test.js` unchanged: every assertion is odds-based (wins/N), and both mirror-proof token gates print 0.

---
*Phase: 72-roll-direction-sign-audit-fixes*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: test/unit/harness/rollOdds.js
- FOUND: test/unit/rollDirection.test.js
- FOUND: e39a89f (Task 1 commit)
- FOUND: ada126b (Task 2 commit)
