---
phase: 91-race-sub-class-audit
plan: 01
subsystem: identity-audit
tags: [audit, races, sub-classes, identity, text-01, balance-calls, rulings, joiners, parley, store-prices]
requires:
  - phase: 89-item-audit-fixes
    provides: the audit table shape and the docs-parsing coverage test precedent
  - phase: 90-spell-skill-audit
    provides: the school gates, the Phase 91 hand-offs (Sing, faces wording, Special stretch, Wizard Illusion, fleeRefusal) and docs/SPELL-AUDIT.md, docs/SKILL-AUDIT.md
provides:
  - "docs/IDENTITY-AUDIT.md: 6 race sections and 24 sub-class sections, 102 trait rows (text, engine, canon, verdict, pinned by), findings for other phases, Balance calls Q1 to Q8 and their Rulings"
  - "test/unit/identity-audit.test.js: 19 coverage and consistency tests with doctored-copy edge probes"
  - "src/browser/identityFooter.js#identityEntries(kind, key): the ordered [{ id, side, text }] list the footer is built from, exported for the audit"
  - "every balance-moving call ruled by the user and handed to the plan that builds it"
affects: [91-02, 91-03, 91-04, 91-05, 91-06, 91-07, 91-08, 91-09, 91-10, phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "docs-parsing coverage test with doctored-copy probes (mirrors docs/ITEM-AUDIT.md and test/unit/item-audit.test.js)"
    - "live footer ids drive the row list; unstated engine rules and pre-registered plan traits follow them in a pinned order"
key-files:
  created:
    - docs/IDENTITY-AUDIT.md
    - test/unit/identity-audit.test.js
  modified:
    - src/browser/identityFooter.js
key-decisions:
  - "Q1 to Q7 were answered before the audit ran (91-CONTEXT); the audit found one more balance call, Q8, ruled A (engine to text) on 2026-10-01 against the recommended default"
  - "The user agreed on 2026-10-01 to drop 'a shield' from the Cleric blurb and 'no shield' from the Woodsman's: the game has no shields"
  - "Verdicts may join several parts with '; ' (a row can carry a Q5 sell-price ruling and a Q8 buy-line ruling at once)"
requirements-completed: [IDENT-11, IDENT-12]
status: complete
duration: ~one long session
completed: 2026-10-01
---

# Phase 91 Plan 01: Race and sub-class audit (inventory and rulings) Summary

**One audit table covers all 6 races and 24 sub-classes trait by trait (102 rows: text, engine, canon, verdict), a coverage test guards it, and all eight balance calls (Q1 to Q8) are ruled and handed to the plans that build them. The only source change is the additive, pure `identityEntries` export.**

## What was built

- `docs/IDENTITY-AUDIT.md`: header and "How to read this table" (verdict vocabulary, row-keeping rules, plan owners), `## Races` (Human, Elven, Dwarven, Wilmsry, Fridgian, Troll), `## Sub-classes` (8 Magic User, 8 Fighter, 8 Thief), Findings for other phases, Balance calls Q1 to Q8, Rulings. Each row's Trait is the stable id (an `IDENTITY_TRAITS` id, a generated footer id, `unstated:<name>` for an engine rule no trait states, or a pre-registered id). Every Magic User section carries its school limits, Phase 90's ten spells and the Cleric/Wizard changes included.
- `test/unit/identity-audit.test.js` (19 tests): race and sub-class sections in `RACES` and `CLASSES` order; every `identityEntries` id has exactly one row, in order, then the `unstated:` rows, then the pre-registered rows; no empty cell; closed verdict vocabulary; owners 91-01 to 91-10; Human has exactly one neutral row; every Magic User sub has a school-limits row; no `balance call (Qn)` row survives a recorded ruling; a `match` row never admits a gap. Edge probes (adjacency, empty, ordering) run the checker on doctored copies.
- `src/browser/identityFooter.js`: `export function identityEntries(kind, key)`; `identityFooter` is rebuilt on it with byte-identical output (identity-footer, heroTab, roller and identity-contract tests unchanged and green).

## Rulings for the fix plans

| Q | Ruling (date) | Built by |
|---|---|---|
| Q1 | B (2026-09-30): the Pickpocket's extra item replaces the extra-gold take (`gainWilmst`'s Pickpocket bonus goes away) | 91-08 engine and pin, 91-10 text |
| Q2 | A (2026-09-30): no Cleric HP rule; the blurb states the chain mail, +1 to hit and the offense ban | 91-10 |
| Q3 | B (2026-09-30): a scroll that rolls an offense spell still casts for a Cleric (RULES-10); the blurb says so | 91-09 pin (no engine change), 91-10 text |
| Q4 | A (2026-09-30): every healing potion the Wilmsry drinks heals double | 91-09 |
| Q5 | A (2026-09-30): selling pays every race the ordinary price | 91-08, with the Troll prices |
| Q6 | A (2026-09-30): the Fridgian's second swing is lost when the first kills; the text says so | 91-10 (91-09 builds the new frenzy odds) |
| Q7 | A (2026-09-30): a Fridgian Joiner's hide soaks 2 of every blow (Hardiness already built in 90-10) | 91-09 |
| Q8 | A, engine to text, against the recommendation (2026-10-01): every store stock line except the three flat-priced tools (potions, food, lockpicks, the sealed scroll included) takes the race and Pickpocket rule: Elf and Dwarf half, Troll double after IDENT-21, Pickpocket +25% | 91-08 (with the Troll prices); 91-10 checks the footer and blurbs |
| Shield | 2026-10-01: drop "a shield" from the Cleric blurb and "no shield" from the Woodsman's; the game has no shields | 91-10 |

Pre-owned rulings (IDENT-13 to IDENT-21, PARLEY-01, TEXT-01) sit on their rows as `ruled (2026-09-30) -> 91-NN`.

### Scope notes for the plans that follow

- **91-02:** the Cleric's offense ban (`MU_CHART.Cleric.offense` to null) also removes Strength, a buff in the offense school; `rollGrimoire`'s day-one damage top-up must end quietly for a Cleric and a Joiner Cleric must fall back to its staff. The Wizard already always opens with Freeze castable (`rollGrimoire`'s top-up); IDENT-13 states it as a trait and pins it across 1,000 seeds. `SUB_NOTE.Wizard`'s "Every school of magic" and its "refusal to teach" (no engine rule) go. Heal and Major Heal are already must-haves for a Cleric.
- **91-05:** `moa-withdraw` is dead code today: `startCombat` never sets `C.tracked`, so the round-1 clean withdrawal exists for nobody and the Master of Arms' drawback costs it nothing; it is `retire (91-05)`. Row `unstated:moa-escape-routes` lists every way a hero leaves a fight (ordinary flee, Cloaker vanish, the dead tracked withdrawal, Smoke, Door Illusion cast or scroll, parley); 91-05 puts the Master of Arms into `fleeRefusal` and pins them all for it and the Samurai. A Chameleon Tongue parley pays whatever `parley()` pays (pin it).
- **91-08:** Q8 A means routing the potion, food, lockpick and sealed-scroll lines of `economy.js#openStore` through `priceFor` (the three tools stay flat); the Wilmsry haggle already reaches every line; the Troll's extra plain-weapon doubling (`troll-weapons`) is retired; `sellPriceFor` stops applying the race multiplier (Q5) but keeps the Pickpocket's x0.75. Phase 92 measures the store economy once.
- **91-09:** the Fridgian frenzy's second swing is rolled one face narrower than the hero's own to-hit (a Phase 72 ruling); the rebuilt trait (a 4 to 6 on a d6) keeps it unless the user says otherwise, and 91-10 must state it. A Joiner Wilmsry already doubles its own potions and heal spells.
- **91-10 (text only, no question needed):** the Ninja's opener is doubled by the Thief backstab (prototype behaviour; the rulebook says never critical) and the text omits it; the Soldier's knighting swaps the weapon for an Awl Pike; the parley bonuses of the Woodsman (+3), Con Artist (+4) and Wilmsry (+4) are unstated; the Cat Burglar, Ninja and Acrobat free starting skills and the Acrobat's +3 trap dodge are unstated; the Special-school stretch is unstated for the Sorcerer, Summoner and Illusionist; every Magic User blurb must name the schools it never learns; the Apprentice learns every school; Joiner Apprentices never backfire (the footer says "your" spell); "faces" and "talk to" wording per TEXT-01.

## Deviations from Plan

### Auto-fixed Issues

None to code. Two notes on how the plan's text was read:

**1. [Rule 2 - Missing critical functionality] Rulings recorded in Task 1**
- **Found during:** Task 1
- **Issue:** the amendment says Q1 to Q7 are answered, so leaving `## Rulings` empty until Task 3 would have made the rows read `balance call` against answered questions.
- **Fix:** Q1 to Q7 are written into `## Balance calls` (marked answered) and `## Rulings` in Task 1; Task 3 added Q8 and the shield ruling.
- **Commit:** ccc1e2a0

**2. Task 2 was run as a checkpoint return, not inside the agent.** Q8 was put to the user through the orchestrator and answered A on 2026-10-01; Task 3 then flipped the four Q8 rows (`elven-prices`, `dwarven-prices`, `troll-prices`, `pickpocket-shops`) to `ruled (Q8, 2026-10-01) -> 91-08`.

## Facts the audit corrected

- The rulings note said the Pickpocket's +25% reaches every stock line except the three flat tools. It reached only weapons, armour, premium pieces, repairs and rations; Q8 A makes the note true.
- The Cleric's "a shield" and the Woodsman's "no shield" had no engine behind them (no Shield armour exists); the user agreed to drop both.

## Fixture drift

None. No engine, content, mazeworld.html or parity file changed (`git diff --stat -- engine content mazeworld.html test/parity` prints nothing). `identityEntries` is pure, adds no rng, and `identityFooter`'s output is byte-identical; no fixture moved and none was regenerated. The fixture drift the rulings will cause (Q8 A store prices, the Cleric ban, the Master of Arms never fleeing, the Pickpocket's items, the Cutthroat's d10, the frenzy odds) belongs to the plans that build them and must be declared there.

## Findings handed on

Recorded in `docs/IDENTITY-AUDIT.md` "Findings for other phases": Phase 91.1 (school bonuses on protection, healing, divination and illusion change no roll; Joiner sub-class specials are hero-only; the Ninja's and Cutthroat's crits ignore the dark no-crit ban; the Master of Arms' patch is unlimited; a Spectre still strikes a vanishing Cloaker; an Elf Illusionist loses its die bonus at levels 1 and 2) and Phase 92 (store economy after Q5, Q8 and the Troll change; the Cleric ban, never-fleeing Master of Arms, SING, Pickpocket items, the teleport pick, Cutthroat d10).

## Human verification (deferred to end of run)

1. None on the device for this plan: the user ruled every balance call at the checkpoints. At milestone close, skim `docs/IDENTITY-AUDIT.md`: every race and sub-class you know from play has its section, and each verdict reads true.

## Self-Check: PASSED

- FOUND: docs/IDENTITY-AUDIT.md, test/unit/identity-audit.test.js, src/browser/identityFooter.js (identityEntries export)
- FOUND commits: ccc1e2a0, 5b826ef6, d13443db
- `node --test test/unit/identity-audit.test.js test/unit/identity-footer.test.js`: 53 pass, 0 fail
- No balance call row remains; Rulings holds Q1 to Q8 and the shield ruling
