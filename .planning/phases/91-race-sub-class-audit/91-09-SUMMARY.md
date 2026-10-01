---
phase: 91-race-sub-class-audit
plan: 09
subsystem: identity-rules
tags: [fridgian, frenzy, hide, wilmsry, heal2x, cleric, parley, joiners, idents, rulings, fixtures]
requires:
  - phase: 91-race-sub-class-audit
    provides: "91-01's rulings (Q2 A, Q3 B, Q4 A, Q6 A, Q7 A) and the audit rows; 91-05's parley; 91-08 as the plan base"
  - phase: 89-item-audit-fixes
    provides: "applyFoeDamageToMember, the Joiner damage pipeline"
  - phase: 90-spell-skill-audit
    provides: "Joiner Hardiness in that pipeline (90-10), reused for the hide"
provides:
  - "IDENT-20: the Fridgian frenzy is a 4-6 on a d6 (one draw at the old d8's position), the second swing -1 to hit and lost when the first kills (Q6 A), the corpse line gone from every line"
  - "Q7 A: a Fridgian Joiner's hide soaks 2 of every blow (applyFoeDamageToMember), stacking with Hardiness, floor 1"
  - "Q4 A: a found Healing potion heals a Wilmsry double (useItem heal case), Xtra Healing already restores to max; narrated on the Oracle and rail"
  - "Q3 B and Q2 A pinned (no engine change)"
  - "orchestrator amendment: a won parley's experience splits with Joiners like a kill's (combat.js#partyXpShares)"
affects: [91-10, phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "a changed die at the same draw position is not a new roll: the d8 frenzy check became a d6 with no derived stream"
    - "one share-count helper read by both the kill split and the parley split"
key-files:
  created:
    - test/unit/fridgian-frenzy.test.js
    - test/unit/identity-rulings.test.js
    - docs/narrative-pass/why/91-09.json
  modified:
    - engine/combat.js
    - engine/items.js
    - content/flavor.js
    - content/races.js
    - src/browser/identityFooter.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - docs/IDENTITY-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/fixtures/action-script.combat.json
    - test/unit/combat.test.js
    - test/unit/condition-roll-mods.test.js
    - test/unit/foe-turn-draw-count.test.js
    - test/unit/identity-contract.test.js
    - test/unit/identity-footer.test.js
    - test/unit/identity-race.test.js
    - test/unit/joiner-armour-soak.test.js
    - test/unit/roll-high-state-pins.test.js
key-decisions:
  - "Q6 A needed no new engine code: the attack loop runs only while the target lives, so a killing first swing already ends the strike; the comment and the text now say so"
  - "A parley's split is per foe (round(award / shares)) as a kill's is, then summed and scaled once; a solo hero (one share) takes the old plain sum, byte-identical"
  - "Xtra Healing is left alone for a Wilmsry: it restores to the maximum, which a double cannot pass"
requirements-completed: [IDENT-20, IDENT-11, IDENT-12]
status: complete
duration: ~one long session
completed: 2026-10-01
---

# Phase 91 Plan 09: the Fridgian frenzy and the audit's engine rulings Summary

**A Fridgian frenzies on a 4-6 of a d6 (half the time, one draw where the d8 sat) into a second swing at -1 to hit that a killing first swing loses; a Fridgian Joiner's hide soaks 2; a found Healing potion heals a Wilmsry double; a won parley's experience splits with Joiners like a kill's; every 91-09 audit row is built and pinned, and the moved fixtures are declared.**

## What was built

- `engine/combat.js#playerStrike`: the frenzy check is `rollCheck(rng, 6, atLeastFor(3, 6))` at the d8's old position (one draw, same place, so every later draw of the strike is unmoved). The frenzy event still comes before the strike events; the extra swing stays one step narrower (the 2026-09-24 ruling); a haste or Ambidextrous swing keeps the normal to-hit and the frenzy never adds a third.
- `engine/combat.js#applyFoeDamageToMember`: a Joiner reads its own `RACES[race].hide` right after Hardiness (floor 1, before the Pendant and Brace), as the hero's pipeline does. A race with no hide soaks nothing extra.
- `engine/items.js#useItem`: the `heal` case doubles a found Healing potion for a heal2x race after the die and before the clamp (same single draw), pushing `healed { doubled }`; `eventNarration.js` and `narrationLines.js` add the suffix (Oracle "(Wilmsry: twice the dose, as promised.)", rail " · Wilmsry") only when `doubled` is present.
- `engine/combat.js#partyXpShares`: the hero plus every Joiner on its feet; `killFoe` now reads it (identical result) and `parley` divides each foe's award by it (rounded per foe) before the hero's scale. No draw moves.
- Text: the footer ("each time you strike, a 4–6 on a d6 gives you a second, wilder swing (−1 to hit)"), `RACE_NOTE.Fridgian` and `RACES.Fridgian.note` state the d6 rule, the -1 to hit, the lost swing on a kill, no armour, the hide and never striking first; nothing mentions a corpse. Ledger `docs/narrative-pass/why/91-09.json` (3 rows, `--check` in sync).
- Tests: `test/unit/fridgian-frenzy.test.js` (10), `test/unit/identity-rulings.test.js` (11), three Joiner hide tests added to `test/unit/joiner-armour-soak.test.js`, the d6 footer pin in `test/unit/identity-footer.test.js`.

## 91-09 rows built

Audit rows (verdict `fix engine (91-09)` or `ruled (...) -> 91-09`), in table order:

| Row | Ruling | Built | Pinned by |
|---|---|---|---|
| `race-heal2x` | Q4 A | a found Healing potion doubles for a Wilmsry | `identity-rulings.test.js`: "Wilmsry race-heal2x: a found Healing potion heals double (Q4 A), the same one die drawn" (and two more: stock potion and other races; Xtra Healing and the clamp) |
| `race-frenzy` | IDENT-20, Q6 A | d6 4-6, narrow swing, lost on a kill, text | `fridgian-frenzy.test.js`: "IDENT-20 odds ...", "IDENT-20 boundary ...", "IDENT-20 position ...", "IDENT-20 ordering ...", "IDENT-20 narrow swing ...", "IDENT-20 edge (adjacency) ...", "IDENT-20 Q6 A (edge, empty) ...", "IDENT-20 text ...", "IDENT-20 source pin ..." |
| `race-hide` | Q7 A | a Fridgian Joiner's hide soaks 2 | `joiner-armour-soak.test.js`: "IDENT-20 hide: a foe's 7-damage hit ...", "... stacks with Hardiness ...", "... (edge, empty) ..." |
| `unstated:cleric-scroll` | Q3 B | pin only, no engine change | `identity-rulings.test.js`: "Cleric unstated:cleric-scroll: a scroll that rolls a damage spell still free-casts for a Cleric in a fight, never copied (Q3 B)" |

Other rulings and the amendment: Q2 A (no Cleric hit-point rule) pinned by "Cleric unstated:cleric-mail: Q2 A builds no Cleric hit-point rule ..." (200 seeds); the parley split by three "Joiner parley-xp: ..." tests. The audit rows read `fixed engine (91-09)` (the frenzy row also `fixed text (91-09)`; `unstated:cleric-scroll` keeps `ruled (Q3) -> 91-10` for the blurb) with Pinned by filled; `grep -c "fix engine (91-09)" docs/IDENTITY-AUDIT.md` prints 0.

**Unbuilt 91-09 rows:** none.

## Deviations from Plan

None to the rulings. Notes on how the plan was read:

**1. [Scope] The text for the frenzy was written here, not left to 91-10.** The plan's Task 1 asked for the footer, `RACE_NOTE` and `RACES.Fridgian.note`; the audit row therefore also reads `fixed text (91-09)`. 91-10's TEXT-01 sweep should re-read these three lines for wording only.

**2. [Rule 1 - scripted tests] Three fixed-draw tests moved with the die.** A scripted d8 raw 5 was a frenzy (roll 4); on the d6 it is not (roll 2). `combat.test.js`, `identity-race.test.js` and `identity-contract.test.js` now script raw 1 (a roll of 6) so they stay the same fights.

**3. A Joiner's hide pushes no `soaked` payload.** The hero's pipeline records what the hide soaked for narration; the Joiner's `memberStruck` event has no such field, so none was added (the damage is simply lower).

**4. The full `npm test` was not run** (user ruling 2026-10-01). Run instead: `test/unit/fridgian-frenzy.test.js`, `identity-rulings.test.js`, `joiner-armour-soak.test.js`, `identity-footer.test.js`, `identity-contract.test.js`, `identity-audit.test.js`, `roll-high-state-pins.test.js`, `roll-high-save-compat.test.js`, `roll-high-guard.test.js`, `narrative-review.test.js`, `narrationLinesCoverage.test.js`, `narrationLinesTable.test.js`, `voice-corpus.test.js`, `combat.test.js`, `identity-race.test.js`, `foe-turn-draw-count.test.js`, `condition-roll-mods.test.js`, the parity glob (66) and the determinism glob (32): 548 pass, 0 fail in the final run; a wider batch (parley, party, joiner, scroll, heal, items, cleric-ban, event-order, fight-log tests) was green earlier (458 + 322 + 223 pass, 0 fail). `node tools/narrative-review.mjs --check` exits 0; `git diff --stat -- test/parity/prototype-master.js.txt` prints nothing.

## Fixture drift (IDENT-20 and the audit rulings)

Measured against the plan base `b33a4f72` (an extracted tree), declared in `test/parity/FIXTURE-INVENTORY.md` "Phase 91 plan 09". Only Fridgian runs move (the d6 odds, from the first strike); the Wilmsry potion, parley split and hide change no fixture.

| Entry | Before | After |
|---|---|---|
| `action-script.combat.json#lose` (seed 14, Fridgian Soldier) declared `after` | wp 72, sp 10 | wp 73, sp 6 (kills, rations, dead unchanged; first part at attack 3, where the d8 frenzied and the d6 does not) |
| `roll-high-state-pins` `solo-1` (a Fridgian Court Mage) | 253 / dead / depth 3 | 400 / alive / depth 5 (first divergence step 107) |
| `roll-high-state-pins` `party-1` (a Fridgian Court Mage with a Joiner) | 372 / dead / depth 3 | 257 / dead / depth 2 (first divergence step 234) |
| `condition-roll-mods` `frenzyDazed` digest | `c0da3841` | `28fc9673` |
| `foe-turn-draw-count` FULL_FIGHTS seed 14 | 36 draws | 33 draws |
| `joiner-armour-soak` Fridgian Joiner 7-damage blow | 23 of 30 left | 25 of 30 left |

The other six state pins, the save-compat fixture, the other 65 parity checks and the 32 determinism tests are byte-identical. Only moved state-pin labels were pasted by hand; `roll-high-baseline.mjs save` was never run. No bot runs (Phase 92).

## Human verification (deferred to end of run)

1. As a Fridgian, fight a few rounds: the Oracle shows the frenzy on a 4, 5 or 6 of a d6, never on a 3.
2. The Hero tab footer for a Fridgian names the d6, the 4-6, and the -1 to hit, and says nothing about corpses.
3. With a Fridgian Joiner, a foe's hit takes 2 less than it would from a Human Joiner (Q7 A).
4. Q4 A: as a Wilmsry, use a found Healing potion: it heals twice a Human's amount and the Oracle says "twice the dose"; Xtra Healing still tops you up to full.
5. Q3 B: as a Cleric, read a scroll in a fight: an offense spell can still fire from it, and your book never gains it.
6. Parley with a Joiner at your side and win: the hero's XP is about half of what the same parley pays alone (the Joiner's half is not shown), and a solo parley pays as before.

## Self-Check: PASSED

- FOUND: test/unit/fridgian-frenzy.test.js, test/unit/identity-rulings.test.js, docs/narrative-pass/why/91-09.json
- FOUND commits: 51a8ab42 (Task 1), ba504500 (Task 2), 468b501b (Task 3)
- Acceptance greps: `rollCheck(rng, 6, atLeastFor(3, 6))` in engine/combat.js 1; `d6` in identityFooter.js 2; `fix engine (91-09)` in the audit 0; `### Phase 91 plan 09` in FIXTURE-INVENTORY.md 1
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched
