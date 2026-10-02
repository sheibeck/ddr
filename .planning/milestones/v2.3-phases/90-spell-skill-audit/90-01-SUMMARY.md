---
phase: 90-spell-skill-audit
plan: 01
subsystem: spells-and-skills
tags: [audit, spells, skills, abilities, roll-high, text-01, balance-calls, rulings, joiners]
requires:
  - phase: 89-item-audit-fixes
    provides: the audit table shape, the shared depth-rising resist (risingResistFaces, foeResistsEffect) and the Q1 depth-resist ruling
provides:
  - "docs/SPELL-AUDIT.md: 43 spell rows (33 SPELLS plus the ten ruled-in slate spells), the school gates and hand-out paths, cross-cutting rules, findings, Balance calls Q1 to Q9 and their Rulings"
  - "docs/SKILL-AUDIT.md: 31 rows (12 Fighter skills, 9 Thief skills, 5 Fighter and 4 Thief pool abilities, Sing) with hero and Joiner use, Balance calls Q10 and Q11 and their Rulings"
  - "test/unit/spell-audit.test.js and test/unit/skill-audit.test.js: the 24 coverage and consistency tests that guard both tables"
  - "every balance-moving call ruled by the user and handed to the plan that builds it"
affects: [90-02, 90-03, 90-04, 90-05, 90-06, 90-07, 90-08, 90-09, 90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "docs-parsing coverage test with doctored-copy edge probes (mirrors docs/ITEM-AUDIT.md and test/unit/item-audit.test.js)"
    - "a ruled question carried either by a `ruled (Qn, 2026-09-30)` verdict or, for a cross-cutting rule (Q6), named in the Rolls cells of the rows it governs"
key-files:
  created:
    - docs/SPELL-AUDIT.md
    - docs/SKILL-AUDIT.md
    - test/unit/spell-audit.test.js
    - test/unit/skill-audit.test.js
  modified: []
key-decisions:
  - "Q1 to Q6 were answered A before the audit ran (90-CONTEXT); the audit's own Q7 to Q11 were ruled at the batched checkpoint on 2026-09-30"
  - "Q9 B (canon) was ruled against the recommended default: untouched Walking Dead swing only at the caster"
  - "Every spell a foe can resist carries the verdict ruled (2026-09-30) -> 90-04 (the depth-rising resist, no floor-12 extras) unless a more specific ruling owns it"
requirements-completed: [SPELL-08, ABIL-06, TEXT-01]
status: complete
duration: ~one long session
completed: 2026-09-30
---

# Phase 90 Plan 01: Spell and skill audit (inventory and rulings) Summary

**Two audit tables (43 spell rows, 31 skill rows) state each spell's and skill's text, engine, roll-high odds, canon and verdict, two coverage tests guard them, and all eleven balance calls (Q1 to Q11) are ruled and handed to the plans that build them. No engine, content, shell or parity file changed.**

## What was built

- `docs/SPELL-AUDIT.md`: the Spells table (SPELLS order, then the ten slate spells in append order: Open/Lock, Fly, Enchant Character, Speed of Sound, Stop Time, Senseless, Duplicate Foe, Door Illusion, Chameleon Tongue, Size of the Behemoth), each row with Text, Engine, Rolls (to-hit, resist with real odds, damage with level², duration, backfire and scroll fumble), Canon (rulebook page and prototype line) and Verdict; a School gates section (one row per MU_CHART sub-class with its after-Phase-90 state, and 13 hand-out paths); Cross-cutting rules (the universal resist, the ruled rising resist, level², the school bonus, backfires, scroll reading and the scroll pool by depth band: 16, 25, 30, 33 spells today and 19, 29, 36, 41 after Phase 90); Findings; Balance calls Q1 to Q9; Rulings.
- `docs/SKILL-AUDIT.md`: one row per FIGHTER_SKILLS key, THIEF_SKILLS key, pool ability and Sing, each with Rule (cooldown or once per fight, to-hit shift, bonus terms), Hero and Joiner use (an engine site or "cannot" and why), Canon and Verdict; Findings; Balance calls Q10 and Q11; Rulings.
- `test/unit/spell-audit.test.js` (13 tests) and `test/unit/skill-audit.test.js` (11 tests): coverage, order, empty cells, unknown verdicts, bad owners, Kind · Class against content, balance calls against rulings, gap words in match rows, ASCII-hyphen ranges, and doctored-copy probes for missing, duplicate, merged, empty, swapped and reopened rows. Edge probes (adjacency, empty, encoding, ordering) are named in each file's header.

## Rulings for the fix plans

| Q | Ruling (user, 2026-09-30) | Built by |
|---|---|---|
| Q1 | A. Strength's +d10 joins every damage roll the hero makes: each weapon blow (both blows of a double strike) and each damage spell's roll as it lands (each foe of an area spell, each Fireballs bolt); a damage-over-time tick gets none. Also 100 squares from the cast, a recast restarts, no hit points (SPELL-09). The fumbled-scroll Strength on a foe stops doubling its hp with it | 90-03 |
| Q2 | A. Petrify: the stone foe pays its experience like any kill and drops no coin or treasure | 90-04 |
| Q3 | A. Only Doze's sleep wakes on a hit; Noxious Vapor's, Insane's and the staves' sleeps stay plain (pin it) | 90-05 |
| Q4 | A. Doze reaches exactly d4 foes, your target first | 90-05 |
| Q5 | A. Ice: no to-hit roll; every foe takes d10 + level²; a survivor is frozen d4 rounds unless it resists (the resist stops only the freeze) | 90-05 |
| Q6 | A. The school bonus adds +10 squares per point to a square-timed new spell and +1 round per point to a round-timed one | 90-07 (Open/Lock, Fly, Enchant Character, Speed of Sound) and 90-08 (Stop Time, Senseless, Duplicate Foe) |
| Q7 | A. Stupidity and Death aim at the foe you picked; a dead pick falls to the first live foe | 90-04 (Stupidity, with its ruled rework) and 90-10 (Death); wording 90-11 |
| Q8 | A. A Joiner's Lightning hits every foe like the hero's | 90-10 (`allyCast` gains the area branch) |
| Q9 | B, canon, against the recommended default. Every Walking Dead Turn Walking Dead fails to turn swings only at the caster for the rest of the fight; a Joiner is never picked while one lives | 90-10 (engine: `combat.js#pickFoeTarget` finally reads `fixated`; a new rule whose fixture drift 90-10 must measure) and 90-11 (the Fixated chip copy stops saying "It fights exactly as before") |
| Q10 | A. Joiners use Stealth, Hardiness and Ambidextrous as the text describes; Hardiness reaches `applyFoeDamageToMember` (the Fridgian hide for a Joiner stays Phase 91's, IDENT-20) | 90-10 (engine), 90-11 (wording) |
| Q11 | A. Keep the engine and reword Death Touch: one swing, doubles if it lands, finishes anything under 15 HP, once per fight | 90-11 (text only) |

Other pre-owned work the tables hand on (no question needed): Pommel Strike a real strike that stuns, Joiners too (90-02); Doze and Stun swapped, Ice reshaped (90-05); Blind, Stupidity and Petrify reworks and the one depth-rising resist on every spell, the combat menu hint and foe card moved to `risingResistFaces(depth, intel)` (90-04); Lesser Summon and Phantom Host removed, the Summoner's Summon from level 1, the Wizard's Illusion loss, the Illusionist's book and the school-gate guard (90-06 and 90-09); the ten slate spells (90-07, 90-08, 90-09); Dirty Trick's blind countdown only ticking on a foe visit it takes (90-10); TEXT-01 wording for every faces, "squares of" and parley row (90-11); the text-vs-engine guard and the audit close (90-12).

Scope notes for the orchestrator checking plan scopes: the Q7 to Q11 rulings add work beyond each plan's original list. 90-10 now also owns Death's aim, the Joiner's Lightning area branch, the `fixated` read in `pickFoeTarget` and the Joiner reads of Stealth, Hardiness and Ambidextrous (all with new rolls or flags that need derived streams where they draw, and a fixture-drift declaration); 90-04 also owns Stupidity's aim; 90-11 also owns the Death Touch reword and the Fixated chip copy.

## Findings the audit made (non-balance, all owned)

- Wording-only fixes (`fix text (90-11)`): Kata, Feint, Sidestep, Battle Roar, Smoke, Overhead Blow (faces), Stealth, Hardiness, Ambidextrous and Death Touch under their questions, Cooking (it also gives a ration), Locks (intelligence and lockpick terms), Sewing (a fed day's rest), Silent Step (heavy armour, Guard, Soldier, dark exceptions), plus TEXT-01 notes inside spell rows (Mirror Self, Weaken, Insane's table, Noxious Vapor's six faces that really collapse to one sleep).
- Engine fix, no balance call: Dirty Trick's `blindFor` only counts down on a foe visit the foe takes (`fix engine (90-10)`).
- Facts recorded for later plans: the school-gate hand-out paths all read `canLearn`, `grantableAt` or `canCast` and match; `canCast` does not re-check the school (old saves tolerant-load); the Grimoire row prints the printed level, not `spellLevelFor`; a fumbled Strength doubles a foe's max hp; a Joiner Apprentice never backfires; the scroll pool grows from 33 to 41 spells; Phase 91 and Phase 92 findings are listed in both docs.

## Deviations from Plan

None - plan executed as written, with the orchestrator amendment applied: Q1 to Q6 were written into the docs as answered (recorded from 90-CONTEXT), Task 2 asked only Q7 onward (five questions, Q7 to Q11), and Task 3 recorded the user's replies. One interpretation worth naming: the plan says the Q6 school-bonus rule needs a `ruled (Q6, ...)` verdict, but the acceptance greps need the ten slate rows to read `new (90-NN)`, so Q6 is carried by the slate rows' Rolls cells and the test accepts a ruled cross-cutting question named there.

## Fixture drift

None. This plan changed docs and two new test files only; no engine, content, shell, parity (`test/parity/prototype-master.js.txt` untouched) or fixture file moved, no rng draw was added, and no pin was re-recorded. The later plans declare their own moves (the scroll pool size, the new rolls, the Q9 targeting rule and the Joiner passive reads in particular).

## Results

- `node --test test/unit/spell-audit.test.js test/unit/skill-audit.test.js`: 24 pass, 0 fail.
- `npm test` (final full run, after the last file change): 8,706 tests, 8,704 pass, 0 fail, 2 skipped (base 8,682 / 8,680 / 0 / 2; +24 new). No CRLF doc-ledger failures appeared.
- Acceptance greps: `## School gates`, `## Balance calls`, `## Rulings` once each in the spell doc and `## Balance calls` in the skill doc; `new (90-07)` 4, `new (90-08)` 3, `new (90-09)` 3, `removed (90-06)` at least 2; no row reads `balance call (Qn)` in either doc; the spell Rulings hold 9 entries and the skill Rulings 2; `git status` showed only the four new files and the two docs.

## Commits

- `c38ffc83`: the two audit tables, their coverage tests and the Q1 to Q6 answers.
- `0becabb4`: the Q7 to Q11 rulings recorded and every balance call flipped.

## Known Stubs

None.

## Threat Flags

None. Docs and tests only; no new network, auth, file-access or schema surface.

## Human verification (deferred to end of run)

1. None on the device for this plan: the user reviewed the Balance calls at the checkpoint. At milestone close, skim `docs/SPELL-AUDIT.md` and `docs/SKILL-AUDIT.md`: every spell and skill you know from play has a row, and its verdict reads true.

## Self-Check: PASSED

- Files exist: `docs/SPELL-AUDIT.md`, `docs/SKILL-AUDIT.md`, `test/unit/spell-audit.test.js`, `test/unit/skill-audit.test.js`, this file.
- Commits exist on `worktree-agent-a8e8e732316a2028a`: `c38ffc83`, `0becabb4`.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt` and every engine, content and shell file untouched.
