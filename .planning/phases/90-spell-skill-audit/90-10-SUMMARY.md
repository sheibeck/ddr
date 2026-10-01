---
phase: 90-spell-skill-audit
plan: 10
subsystem: spells-and-skills
tags: [joiner-casters, pickMemberSpell, death, lightning, turn-walking-dead, stealth, hardiness, ambidextrous, dirty-trick, bot, spell-10, abil-06, spell-08]
requires:
  - phase: 90-09
    provides: the last slate spells and their shared tails (behemothRoar took the caster's `by` and level for this plan)
  - phase: 90-08
    provides: stopTime and misdirectFoe (shared tails with a `by` parameter)
  - phase: 90-07
    provides: startSpellEffect, spellEffectSquares and the timed Special spells
  - phase: 89-item-audit-fixes
    provides: the Joiner item policy, the Joiner timer tick, member-side reads (critWard, foeToHit, haste)
provides:
  - "engine/combat.js#pickMemberSpell (pure policy) and allyCast for heal, timed, timestop, misdirect, behemoth, and a Joiner's Lightning on every foe"
  - "Death aims at the picked foe (Q7 A); pickFoeTarget reads `fixated` (Q9 B); a Joiner Fighter uses Stealth, Hardiness and Ambidextrous (Q10 A); Dirty Trick counts down on every visit a live foe takes (combat.js#tickBlindFor)"
  - "events memberHealed and the Joiner form of spellEffectStarted, stealthStrike and dirtyTrickLanded, with Oracle and rail twins and ledger 90-10"
  - "the bot plays the new spells (chooseSpell, decideAction's flee and parley branches) and aims a spell at the strongest foe through the harness target write"
  - "docs/SPELL-AUDIT.md `## Joiner casters` and seven rows flipped to fixed engine (90-10); the measured fixture record"
affects: [90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a Joiner policy that is a pure picker returning { sp, target } and a resolver that runs the hero's own shared tails with the Joiner's name on every event"
    - "a spell pick that needs aiming returns its target index only when it differs from the current target, so existing unaimed pins stay byte-identical"
key-files:
  created:
    - test/unit/joiner-casters.test.js
    - test/unit/spell-skill-audit-fixes.test.js
    - docs/narrative-pass/why/90-10.json
  modified:
    - engine/combat.js
    - engine/magic.js
    - engine/abilities.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - tools/lib/tuning-bot.mjs
    - test/unit/tuning-bot.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/harness/rollHighBaseline.js
    - test/unit/spell-audit.test.js
    - test/unit/skill-audit.test.js
    - test/parity/harness/comparables.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/SPELL-AUDIT.md
    - docs/SKILL-AUDIT.md
    - docs/ABILITIES.md
    - docs/SPELLS.md
    - docs/ROLL-LEDGER.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "A Joiner's heal dice come from a derived stream (memberHeal), so the policy adds no main-rng draw; the other Joiner casts draw what the hero's draw through the shared tails (declared exception)"
  - "The Joiner form of spellEffectStarted applies only to the two kinds a Joiner can cast (haste, enchant); every other kind keeps the hero's line, which keeps the 90-07 ledger rows valid against the corpus"
  - "pickFoeTarget keeps its draws exactly (no draw under a Taunt, the one pick die otherwise): a fixated foe only overrides the result, even over a Joiner's Taunt"
  - "The bot casts Chameleon Tongue only where it would parley (canParley) or the room is Magical; a plain hero that could not parley anyway still flees"
requirements-completed: [SPELL-10, ABIL-06, SPELL-08]
status: complete
duration: one long session
completed: 2026-10-01
---

# Phase 90 Plan 10: Joiner casters, the audit's remaining engine fixes, the bot's new spells Summary

**A Joiner Magic User now heals itself at half hit points, stops time or looms like a barn against a crowd, opens with Speed of Sound or Enchant Character and controls a strong foe, all from its own gated book; Death kills the foe you picked, a Joiner's Lightning hits every foe, Turn Walking Dead's survivors swing only at the caster, a Joiner Fighter uses Stealth, Hardiness and Ambidextrous, Dirty Trick's blindness counts every foe visit, and the bot plays the new spells (pinned, not run).**

## What was built

- **The Joiner caster policy** (`engine/combat.js#pickMemberSpell`, pure, no rng; docs/SPELL-AUDIT.md "Joiner casters"). After Phase 89's item policy and the class ability, before the best attack spell and the staff: (1) at or below half its hit points, a castable healing spell on itself; (2) three or more live foes, the highest-level castable room control among Stop Time, Size of the Behemoth and Doze not already in force on every foe; (3) round 1, a Speed of Sound or Enchant Character not already live on its sheet; (4) a live foe at or above its level with more than half its hit points, Duplicate Foe, Senseless or Stun not already on it (Senseless needs another foe; the hero's current target first); else nothing. Ties go to the higher effective level, then SPELLS order. `allyCast` resolves each pick through the hero's own tails with the Joiner's name on every event and the charge from its own sheet: `memberHealed` (derived-stream dice, the Cleric's +3, heal2x, healMul, clamped to its own maximum), `spellEffectStarted { member }` (a `spell:` record on its own sheet stretched by its own school bonus), `stopTime`, `misdirectFoe`, `behemothRoar`. A Joiner never picks Door Illusion, Chameleon Tongue, Summon, Open/Lock, Fly, the sight spells, a ward, Mirror Self, Regeneration or Strength (each with its reason in the doc's per-spell table). The Joiner's `spell:` timer already ticked and faded with the member's name through Phase 89's step tick, so it is pinned, not changed.
- **The audit's engine rows** (one pin each in `test/unit/spell-skill-audit-fixes.test.js`, every fix mutation-checked: each reverted fix fails its pin).
- **The bot** (`tools/lib/tuning-bot.mjs`): Ice (area damage by foes) and Doze (by the room) were already scored and are now pinned; Stun, Senseless and Duplicate Foe aim at the strongest foe (the pick carries `target` only when the strongest foe is not already the current target); Stop Time (250/456) and Size of the Behemoth (245/454) against three or more foes, skipped once in force; Enchant Character and Speed of Sound a 445 round-1 buff in a hard fight when not live; Door Illusion in place of the flee roll (`ctx.doorBlocked` after a `doorIllusionSeen`); Chameleon Tongue where the bot would parley or the room is Magical, guarded by the engine's own `parleyBlockedReason`; Stupidity removed from the disable tier; Fly and Open/Lock never chosen. `playRun` and the baseline harness's `dispatchOne` write a spell's `target` as they write an ability's. No bot readout was run.
- **Narration:** `memberHealed` (Oracle and rail), the Joiner forms of `spellEffectStarted` (haste and enchant only), `stealthStrike` and the already-blind `dirtyTrickLanded` line; ledger `docs/narrative-pass/why/90-10.json` (8 rows); `narrative-review.mjs --check` in sync (726 rows).

## Fixed rows

| Row (doc) | Before | After | Pinned by |
|---|---|---|---|
| Death (spells, Q7 A) | killed the first live foe whichever you picked, the resist rolled on that foe | kills the picked foe, a dead pick falls to the first live foe, the resist rolled on the picked foe | `spell-skill-audit-fixes.test.js`: Death (three tests) |
| Lightning (spells, Q8 A) | a Joiner threw one bolt at one foe | `allyCast` reaches every live foe, each its own resist, d8 to-hit and damage (`allyThrow`) | Lightning (three tests) |
| Turn Walking Dead (spells, Q9 B) | `fixated` set and read by nothing | `pickFoeTarget` returns the hero for a fixated foe, never a Joiner (not even under its Taunt), draws unchanged | Turn Walking Dead (three tests) |
| Stealth (skills, Q10 A) | `memberStrike` never read it | a Joiner's opening landed blow crits on the top two numbers; never in plate, the dark, or for a Soldier or Guard | Stealth (three tests) |
| Hardiness (skills, Q10 A) | left out of `applyFoeDamageToMember` on purpose | -3 per landed blow (swing or bolt), floor 1, before the Pendant and Brace | Hardiness (two tests) |
| Ambidextrous (skills, Q10 A) | a Joiner swung once | two swings on a plain strike, never stacked with its Speed | Ambidextrous (two tests) |
| Dirty Trick (skills) | `blindFor` counted only on a visit that swung | `tickBlindFor` runs on every visit a live foe takes (hold, sleep, stun, misdirect, ability, empty kit); `applyDirtyTrick` says 2 or 0 rounds | Dirty Trick (four tests) |

No row was handed on. The skill rows' "Joiner" cells for Cooking, Runes/Signs, Locks, Sewing, Night Vision and Acute Hearing stay "cannot" (exploration and upkeep jobs the hero does; Q10 left them alone).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The thrown-spell split broke the RULES-18 control scan**
- **Found during:** the one full `npm test` run (before the coordinator's no-full-suite rule): 2 failures in `control-at-depth-rules.test.js` (the audited Weaken control assignment moved to `allyCastRest`).
- **Fix:** the blast, status, stun and weaken tail is `allyCast`'s own body again; only the thrown spells live in `allyThrow`. No behaviour change. **Commit:** c21e1e99.

**2. [Rule 3 - Blocking] Tests that the doc edits would break**
- `spell-audit.test.js`: the reopened-call probe doctored Lightning's old `ruled (Q8, ...)` cell; it now doctors the fixed cell. `skill-audit.test.js`: a ruled question may be carried by a row's Joiner cell that names it (the spell test's own allowance), because Q10's three rows are now `fixed engine (90-10)`. **Commit:** faeb885c.

**3. [Rule 2 - Missing critical] Comparable carve-out and harness write**
- `test/parity/harness/comparables.js#stripFoeAbilityState` strips the new transient `opened` flag from a Joiner's combat entry (the all-three-comparables rule); `test/unit/harness/rollHighBaseline.js#dispatchOne` writes a spell's target like an ability's (the bot's aimed cast). **Commits:** faeb885c, ae60795a.

### Plan examples that the gates make impossible (tests use the nearest legal case)

- "A Joiner Cleric with Heal and Stop Time": a Cleric has no Special school; the heal-first test uses a Wizard, and the Cleric's +3 has its own test. "A level-3 Joiner Apprentice holding Duplicate Foe": Duplicate Foe is level 5; the test uses a level-5 Illusionist, and the level-3 Apprentice case uses Stun.

### Decisions worth the user's eye (flagged, not blocking)

- **Enchant Character for a Joiner** gives foes -2 to hit it and no critical on it, but its staff blows do not read the +2 to hit (`memberToHit` reads class, race and sub-class alone, by Phase 25.1's design). The audit table says so.
- **Ambidextrous for a Joiner** is the plain strike only (as Phase 89's Joiner haste read): an ability use or a cast stays one action.
- **A Joiner's Stealth dark ban** applies to the Stealth crit only (the Joiner's other crits ignore the dark, unchanged).
- **A fixated Walking Dead's ability bolts** still use the plain target pick (`foeAbilities.js` calls `pickFoeTarget` without the foe, deliberately, per its Bard clause); only swings are fixated. No Walking Dead row carries a bolt today.
- **The Joiner form of `spellEffectStarted`** covers only haste and enchant. The plan wrote "spellEffectStarted with member" for every kind; a Joiner never casts the others, and a generic member branch would have hidden the hero's four 90-07 lines from the narration corpus.
- **TDD note:** tests were written alongside the implementation within each task, not before it; there is no separate `test(...)` RED commit. Each Task 2 pin was mutation-checked instead (11 reverted fixes, 11 caught).

## Fixture drift

Measured against the plan base 3d875dd0 (an extracted tree, the same `playRun` trace), declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 10") and re-recorded alone. `test/parity/prototype-master.js.txt` untouched; `roll-high-baseline.mjs save` never run.

- **Parity: 66 of 66 unmoved.** The fixtures carry no party, no Joiner and no Walking Dead fight. The new transient `opened` flag on a Joiner's combat entry is carved out of all three comparables.
- **State pins: 2 of 8 moved**, each hashed identically twice and traced per bot step with an event-payload digest. **party-1** 400/false/3 -> 372/true/3: the first divergence is step 365, three live foes in round 2, the Joiner (a Court Mage with Doze) casts Doze as the room control where the base cast Freeze, and step 367 adds its first `memberHealed`. **party-fighter-knight** 297/true/3 -> 400/false/3: the first payload divergence is step 102, the foe's swing at the Joiner Hilda Stonecut (Hardiness): `memberStruck` 3 -> 1; her second wind is later not needed where the base needed it. solo-1, solo-2, solo-thief-pilfer, solo-magicuser-sorcerer, deep-8 and deep-14 re-measured byte-identical; `roll-high-save-compat` unchanged.
- **Draws:** one new roll, derived (`memberHeal`); the other Joiner casts draw what the hero's draw through shared tails; no `.d(` or `rollCheck(` call site was added, so `roll-high-guard` DRAW_INVENTORY does not move (docs/ROLL-LEDGER.md "Phase 90 plan 10").

## Results

- One full `npm test` run mid-plan (before the coordinator's rule change): 9,092 tests, 9,088 pass, 2 fail, 2 skipped; the 2 failures were the RULES-18 scan above, fixed in c21e1e99. No CRLF doc-ledger failure appeared. Per the coordinator's rule the full suite was not re-run.
- The final targeted run after the last file change (the plan's verify lists, the audit tests, the narration and voice guards, the parity glob, the state pins, the draw guard, the bot tests and the control-at-depth guard): **687 tests, 687 pass, 0 fail, 0 skipped.** `node --test "test/parity/**/*.test.js"`: all pass (66 tests). `node tools/narrative-review.mjs --check`: in sync. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0; `--check-ledgers --after`: 0 errors.
- Acceptance greps: `pickMemberSpell` exported once and called once in `alliesTurn`; no `fix engine (90-10)` left in either audit table; `### Phase 90 plan 10` once in FIXTURE-INVENTORY; `timestop` and `misdirect` in the bot; `git diff` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Commits

- `73075fd4` feat(90-10): Joiner Magic Users cast heals, room controls, buffs and single controls from their own book (Task 1; also carries the narration for the Task 2 events)
- `faeb885c` feat(90-10): Death aims at the pick, Turn Walking Dead fixates, Joiners use Stealth, Hardiness and Ambidextrous, Dirty Trick counts every visit (Task 2)
- `c21e1e99` fix(90-10): keep a Joiner's Weaken inside allyCast, where the RULES-18 control audit lists it
- `ae60795a` feat(90-10): the bot plays the new spell rules; re-record only the two party pins the Joiner changes moved (Task 3)

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface: `opened` is a transient combat-entry flag, a Joiner's spell record is a timers entry on its own sheet, and the bot change is tooling.

## Human verification (deferred to end of run)

1. With a Magic User Joiner in the party against three or more foes, watch it cast a room control (Stop Time or Size of the Behemoth) from its own book; badly hurt, it heals itself if it has a heal ("casts Heal on themselves: +N hp").
2. A Joiner never casts Door Illusion or Chameleon Tongue, even when its book holds them.
3. A Joiner Fighter with Hardiness takes visibly less from each blow (the Oracle's `memberStruck` numbers run 3 lower, never below 1); one with Ambidextrous swings twice a round on a plain strike; one with Stealth opens a fight with "they never saw it coming".
4. Cast Death with the second foe picked: the second foe dies, not the first. Against a Walking Dead fight with a Joiner, cast Turn Walking Dead: the dead it could not turn go for you and never for the Joiner.
5. Dirty Trick a foe that is asleep or held: its sight comes back after two foe turns, whatever it did with them.

## Self-Check: PASSED

- Files exist: `test/unit/joiner-casters.test.js`, `test/unit/spell-skill-audit-fixes.test.js`, `docs/narrative-pass/why/90-10.json`, this summary.
- Commits `73075fd4`, `faeb885c`, `c21e1e99` and `ae60795a` exist on the worktree branch; the targeted verification above is green.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` untouched.
