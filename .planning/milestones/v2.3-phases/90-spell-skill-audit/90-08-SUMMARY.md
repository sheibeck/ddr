---
phase: 90-spell-skill-audit
plan: 08
subsystem: spells
tags: [stop-time, senseless, duplicate-foe, control-spells, misdirected-swing, special-school, illusion-school, round-stretch, scrolls, fumbles, narration, chips, fixtures, spell-10]
requires:
  - phase: 90-05
    provides: holdFoe (rounds required, never shortens a longer live hold), the held skip in foeTurn, the one-resist tails (dozeFoes, stunFoe)
  - phase: 90-06
    provides: the school gates (canCast, schoolClosed, MU_CHART) and the school-gates.test.js guard that iterates SPELLS, the derived roll path for appended rows
  - phase: 90-07
    provides: spellEffectRounds in derived.js (Q6 A, +1 round per school bonus point), the four appended Special rows and their fixture record
provides:
  - "Stop Time (Special 3), Senseless (Illusion 2), Duplicate Foe (Illusion 5) appended after Speed of Sound (SPELLS is 38 rows): combat-only, stretch rounds, roll derived"
  - "combat.js#stopTime (every foe rolls the one rising resist, each failer held kind time for 2 + the Special bonus rounds, no main draw) and combat.js#misdirectFoe (f.misdirect = { at, left }, one main draw: the duration dice), shared by the hero's cast, a scroll's free cast and, in 90-10, a Joiner's"
  - "combat.js#resolveMisdirectedTurn inside foeTurn: the foe's own swings aimed at another foe or itself, never the hero's side; derived.js#foeSwingVsFoe (the body-less to-hit)"
  - "scroll fumble rows (Stop Time: a flat two-turn stopped out; Senseless and Duplicate Foe: maddened outs), and the three join the scroll pool (18, 27, 33, 38 rows at depths 1 to 4+)"
  - "foe chips Stopped, Senseless, Fighting its double; hero chip kind Stopped; Oracle lines and rail twins for six new events and the time kind of controlHeld / foeStillHeld / foeHoldBroken; ledger 90-08.json (23 rows)"
  - "the measured, declared fixture record for the longer spell list"
affects: [90-09, 90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a new combat turn shape (the misdirected turn) is one module-private helper called from foeTurn after the held, asleep and stunned skips: only a turn the foe really takes spends the spell's count"
    - "an appended roll: derived row needs a school gate and nothing else: stopTime and misdirectFoe read the chart through spellEffectRounds, and the gate guard passes unchanged"
key-files:
  created:
    - test/unit/control-slate-spells.test.js
    - docs/narrative-pass/why/90-08.json
  modified:
    - content/spells.js
    - content/scroll-fumbles.js
    - engine/combat.js
    - engine/derived.js
    - engine/magic.js
    - src/browser/foeConditions.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/combatMenu.js
    - mazeworld.html
    - test/unit/spell-table.test.js
    - test/unit/content-tables.test.js
    - test/unit/scroll-fumble-table.test.js
    - test/unit/foe-conditions.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/days-farm.test.js
    - test/unit/day-one-damage.test.js
    - test/unit/removed-spells-load.test.js
    - test/unit/special-timed-spells.test.js
    - test/unit/shell-combat-actions.test.js
    - test/unit/combatMenu.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/ROLL-LEDGER.md
    - docs/SPELLS.md
    - docs/SPELL-AUDIT.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "A misdirected swing draws its to-hit then, on a hit, its damage dice from the main rng, exactly where the foe's own hero swing draws them; the only new draw at the cast is the duration dice. Nothing is drawn by Stop Time"
  - "The to-hit has no body's defences: the foe's own die (foeDie(null, f)) against 5 + FOE_ACCURACY, blind caps it to the top face; Weaken halves its damage but its three-face to-hit cap is not applied (flagged); the per-round damage ceiling, which guards the hero's side, is not applied"
  - "A new misdirect never shortens a longer live one and keeps that record's aim and rounds (holdFoe's rule), instead of the plan's `{ at: sp.at, left: max }`, which would let a one-round Senseless re-aim a five-round Duplicate Foe"
  - "The three chips are separate table entries (stopped, senseless, double), not a labelFor on Held, because foe-conditions.test.js requires one description per label key; Fighting its double is the one multi-word chip label, a named exception in the test"
  - "The chart gives the Illusion school +0 to both sub-classes that learn it, so Q6 A stretches Stop Time (Illusionist 6 rounds) but not the two Illusion tricks today"
patterns-established:
  - "a fumbled control spell lands on the reader as an out kind: Stop Time a flat two turns (a zero-dice row, n 0 bonus 2), the Illusion tricks maddened"
requirements-completed: [SPELL-10]
duration: about 4h
completed: 2026-10-01
status: complete
---

# Phase 90 Plan 08: Stop Time, Senseless, Duplicate Foe (SPELL-10) Summary

**The control spells of the accepted slate: Stop Time holds every foe that fails the one rising resist for 2 rounds (+1 a Special bonus point, so an Illusionist stops the room for 6), and Senseless and Duplicate Foe turn one foe's blows onto its own side or itself for d4 or d4+1 rounds through a new misdirected-swing system that rolls the foe's own to-hit and damage and never touches the hero's side; school-gated by the chart with no extra code, with scroll fumbles, chips, Oracle and rail lines.**

## What was built

- **Content** (`content/spells.js`, `content/scroll-fumbles.js`): three rows appended after Speed of Sound, each `stretch: "rounds"`, `roll: "derived"`, `niche: "control"`, `combatOnly: true`, text stating the rule, the resist and "+1 round per school bonus point": Stop Time `{ lvl 3, s special, kind timestop, holdRounds 2 }`, Senseless `{ lvl 2, s illusion, kind misdirect, at friends, rounds d4 }`, Duplicate Foe `{ lvl 5, s illusion, kind misdirect, at self, rounds d4+1 }`. Fumble rows: Stop Time a flat two-turn `stopped` out (a zero-dice `rounds` of bonus 2), Senseless and Duplicate Foe `maddened` outs (d4, d4+1, clamped to `HERO_OUT_MAX`).
- **Stop Time** (`engine/combat.js#stopTime`): for each live foe in `C.foes` order, `foeResistsSpell` (the one rising resist, a derived stream); a failer is held kind `"time"` for `spellEffectRounds(sub, sp, 2)` rounds through `holdFoe` (no turns, a blow neither ends nor restarts it, strikes land on at least the top five faces via `targetStrikeFaces`, a longer live hold stands). One closing `timeStopped { count, rounds, by? }`, count 0 when every foe resisted. No main-rng draw.
- **Senseless and Duplicate Foe** (`combat.js#misdirectFoe`, `resolveMisdirectedTurn`, `derived.js#foeSwingVsFoe`): the picked foe's resist is rolled up front (`SINGLE_TARGET_KINDS.misdirect`; a Joiner's cast rolls it inside the tail); a landed spell sets `f.misdirect = { at, left }` (one main draw, the duration dice, +1 per Illusion bonus point). `foeTurn` calls the helper right after the held, asleep and stunned skips and before the flee check and ability gate: every swing the foe has (frenzied and `sp.atk` as its own turn) goes at itself or the first other live foe in `C.foes` order, `pickFoeTarget` never runs, so nothing reaches the hero or a Joiner; with no other foe it swings at the air once and loses the turn. Each swing draws its to-hit (`rollCheck` on the foe's own die, `5 + FOE_ACCURACY`, blind to the top face) then, on a hit, the damage dice (a top-face crit doubles them unless blind), `foeHitFor` with curve and elite, Weaken, Shrink and Hamstring halving, dealt through `damageFoe` (kind foe: natural armour may soak) and `killFoe` (the hero is paid). `left` counts down once per turn the foe takes; at 0, one `foeMisdirectEnded`.
- **Cast** (`engine/magic.js`): `misdirect: "target"` in `SINGLE_TARGET_KINDS`; `timestop` and `misdirect` branches call the tails. The three join the scroll pool through the existing `SPELLS.filter(lvl)` (no pool code).
- **Surfaces**: foe chips Stopped (held kind time, rounds), Senseless and Fighting its double (rounds from `left`), each with a one-line rule, and the Held chip no longer doubles a time hold; hero chip kind Stopped (combat menu STOPPED, shell label, tap card sentence); Oracle lines and rail twins for `timeStopped`, `foeMisdirected`, `foeMisdirectedHit`, `foeMisdirectedMiss`, `foeSwingsAtAir`, `foeMisdirectEnded`, the time kind of `controlHeld` / `foeStillHeld` / `foeHoldBroken`, and a fumbled Stop Time; the rail folds a failed resist behind `foeMisdirected` and behind each time hold. Ledger `docs/narrative-pass/why/90-08.json` (23 rows, every "after" read from `buildCorpus`).
- **Docs**: `docs/ROLL-LEDGER.md` (the misdirected swing's draws, in order), `docs/SPELLS.md` (a Phase 90 plan 08 section), `docs/SPELL-AUDIT.md` (the three rows' Pinned-by cells, the pool counts, the chips), `docs/USABLE-FEATURES-AUDIT.md` (three rows), `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 08").

## Fixture drift

Predicted from the code, then measured against the plan base 49425bac; every moved entry is declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 08") and regenerated alone. `test/parity/prototype-master.js.txt` is untouched; `roll-high-baseline.mjs save` was never run; no new serialized field outside combat (`f.misdirect` lives on a foe, inside `state.combat`, already carved out of every comparable).

**Cause.** The three rows are `roll: "derived"`, so no chargen main-rng cursor moved (`chargen-rng-pin.test.js` is untouched and passes). What moved is content: a Special or Illusion book can hold a spliced row and the extra splice draws shift the other spliced rows' derived positions, and a scroll's `rng.pick(options)` is over 18, 27, 33 and 38 rows at depths 1 to 4+ (it was 17, 25, 31 and 35), landing the same draw on another row. New draws exist only for a misdirected foe: the duration dice at the cast (a `rollDice`, no `.d(` of its own) and per misdirected swing one `rollCheck` and, on a hit, one tagged `amount` draw; `roll-high-guard.test.js` DRAW_INVENTORY `engine/combat.js` `rollCheck` 23 to 24 and `amount` 22 to 23.

- **Parity (66 of 66 pass).** Chargen: seed 24 (Apprentice) `[Heal, Strength, Stupidity, Sense Presence, Weaken, Open/Lock, Enchant Character, Petrify, Earthquake, Freeze]` to `[Senseless, Heal, Strength, Stupidity, Sense Presence, Weaken, Enchant Character, Petrify, Earthquake, Freeze]`; seeds 7, 8, 15, 29 and every no-grimoire seed unchanged. Combat: `lose-apprentice` (seed 127) chargen book `[.., Insane, Acid, Freeze]` to `[.., Insane, Senseless, Freeze]` (`rollGrimoireDraws` 38 to 37 unchanged, action path and end fields unchanged). Magic (`cast-damage` seed 243, `scroll` seed 1295), movement, economy and encounters unmoved.
- **Pins (re-recorded alone).** `roll-high-state-pins`: 3 of 8 labels (solo-2 368/true/4 to 239/true/2, solo-magicuser-sorcerer 150/true/2 to 313/true/3, deep-8 109/true/9 to 300/false/11), traced per bot step against an extracted tree of 49425bac (first divergence: solo-2 and solo-magicuser-sorcerer step 0, deep-8 step 80, each the scroll read or the book). solo-1, solo-thief-pilfer, party-1, party-fighter-knight, deep-14, `roll-high-save-compat` unmoved. `bot-tactics` Sorcerer trio seed 1 to 2 (the campFailed loop, depth 7 day 10 at 5000 actions under identity dials; seed 2 dies in 1229 actions, depth 11, day 12; confirmed in the test's own order); `days-farm` camp-guard seed 736468 to 863172 (index 109, a Court Mage, campGuard 200; the only one of the 30 Magic User starts that fires).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A new misdirect must not re-aim a longer live one**
- **Found during:** Task 1 (writing the longer-spell edge)
- **Issue:** the plan's `t.misdirect = { at: sp.at, left: max(rounds, old) }` lets a one-round Senseless change a five-round Duplicate Foe's aim to friends for five rounds.
- **Fix:** `misdirectFoe` follows `holdFoe`: when the live record has more rounds left than the new cast, the whole live record (aim and rounds) stands and the line reports it. Pinned in `control-slate-spells.test.js`. **Commit:** 9d476c70.

**2. [Rule 3 - Blocking] Three chips as separate table entries**
- **Issue:** `foe-conditions.test.js` requires one `FOE_CONDITION_DESC` sentence per label key, so a `labelFor` on the Held chip (the plan's idea) cannot carry a second description. Stopped, Senseless and Fighting its double are their own entries; the Held chip's `when` skips a time hold so one hold shows one chip. "Fighting its double" is a named exception to the one-capitalised-word rule in that test.
- **Commit:** 7469af38.

**3. [Rule 3 - Blocking] Files outside the plan's list had to move**
- `src/browser/combatMenu.js` (the `stopped` hero-out kind), the rail's resist fold in `narrationLines.js`, `test/parity/fixtures/action-script.combat.json` (the `lose-apprentice` record), and tests that pin a moved number, a row count or a seed: `shell-combat-actions`, `combatMenu`, `bot-tactics`, `days-farm`, `day-one-damage`, `removed-spells-load`, `special-timed-spells`, `roll-high-guard` (DRAW_INVENTORY moved into the Task 1 commit so that commit is green), `docs/USABLE-FEATURES-AUDIT.md` (its doc-sync test lists every SPELLS name) and `docs/SPELL-AUDIT.md`. `heroConditions.js`, `scroll-fumble-resolve.test.js` and `action-script.magic.json`, on the plan's list, needed no change (the hero-out labels live in `mazeworld.html`, the resolve test iterates the table, and the magic fixtures replay unchanged). **Commits:** 9d476c70, 7469af38, 8abcfb2c.

**4. [Rule 2 - Missing critical] A fumbled Stop Time needs its own tap-card sentence**
- The generic hero-out sentence says "nothing wakes you early", wrong for a flat two-turn stop; `mazeworld.html` gets `HERO_OUT_EXPLAIN.stopped` through `EXPLAIN_BY_KIND`. **Commit:** 7469af38.

TDD note: the tests were written after the Task 1 implementation within the same task (one commit per task, tests with code), not first; there is no separate `test(...)` RED commit and the new tests were never run red. They pin each behavior bullet and pass.

## Flagged for the user

- **Weaken's to-hit cap is not applied to a misdirected swing**, only its damage halving (the plan's wording: "Weaken, Shrink and Hamstring halve its blows"). Applying the top-three-faces cap too would be one line in `foeSwingVsFoe`.
- **The Q6 A stretch is +0 for both Illusion tricks today**: the chart gives the Illusion school 0 to the Illusionist and the Apprentice (the only sub-classes that learn it). Only Stop Time stretches (Illusionist 6, Sorcerer or Summoner 3). A chart change is a Phase 91 call.
- **Joiner Magic Users do not cast these yet**; `stopTime` and `misdirectFoe` take `caster.by` for 90-10.
- **A misdirected foe's blow ignores the per-round damage ceiling**, which guards the hero's side only.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface; `f.misdirect` is a combat-scoped foe field and the three rows read the existing chart.

## Human verification (deferred to end of run)

1. Cast Stop Time on a group: the foes that fail show "Stopped" for 2 rounds (6 as an Illusionist) and take no turns; hitting them doesn't wake them.
2. Cast Senseless on one of two foes: on its turn it attacks the other foe (the Oracle and rail say so); alone, it swings at the air.
3. Cast Duplicate Foe on a big foe: it hits itself for its own damage for a few rounds and leaves you alone.
4. Read a Stop Time scroll with a failing reader (a fumble): the hero chip reads "Stopped", the combat menu says CANNOT ACT · STOPPED, and the tap card says two turns.
5. Tap a foe card with Senseless and with Duplicate Foe: the long-press card reads the one-line rule; the chip shows the rounds left ("Senseless · 3", "Fighting its double · 2").

## Verification

- `npm test` (full run, after the last file change): 8,977 tests, 8,975 pass, **0 fail**, 2 skipped (base 8,932 / 8,930 / 0 / 2; +45 new). None of the known worktree CRLF doc-ledger failures appeared. `www/index.html` build-artefact tests skip (no `www/`).
- `node --test "test/parity/**/*.test.js"`: 66 of 66. `node tools/narrative-review.mjs --check`: in sync (696 rows). `node tools/voice-inventory.mjs --check-ledgers --plan 90-08 --after --coverage`: 0 errors. `node --test test/unit/school-gates.test.js`: passes unchanged with the three rows in `SPELLS`.
- Acceptance greps: `export function stopTime` once; `export function misdirectFoe` once; the last three `SPELLS` rows are Stop Time, Senseless, Duplicate Foe; `pickFoeTarget(` inside `resolveMisdirectedTurn` 0; `foeMisdirectedHit` in `eventNarration.js` and `narrationLines.js` (1 each); `misdirect` in `foeConditions.js` (9); `### Phase 90 plan 08` once in FIXTURE-INVENTORY; `misdirect` in `docs/ROLL-LEDGER.md` (8); `git diff` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them).

## Commits

- `9d476c70` feat(90-08): Stop Time, Senseless and Duplicate Foe, the control spells with the misdirected-swing system (Task 1)
- `7469af38` feat(90-08): narrate Stop Time, Senseless and Duplicate Foe; chips and lines state the rule (Task 2)
- `8abcfb2c` test(90-08): measure, declare and regenerate only what the three control spells moved (Task 3)

## Self-Check: PASSED

Created files exist (`test/unit/control-slate-spells.test.js`, `docs/narrative-pass/why/90-08.json`, this summary) and commits `9d476c70`, `7469af38` and `8abcfb2c` are on the worktree branch; the full suite is fail 0.
