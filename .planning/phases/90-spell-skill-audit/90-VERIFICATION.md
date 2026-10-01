---
phase: 90-spell-skill-audit
status: passed
verified: 2026-10-01
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 4/4
human_verification:
  - "(90-01, 90-12) Skim `docs/SPELL-AUDIT.md` and `docs/SKILL-AUDIT.md`: every spell and skill you know from play has a row whose rule matches what you saw on the device."
  - "(90-02) A Fighter uses Pommel Strike on a foe: the Oracle shows a normal hit with its damage, then the foe loses its turn; on a miss nothing is stunned and the ability still cools down 4 rounds. With a Joiner Fighter in the party, round 1: the Joiner opens with it, hits and stuns (the rail names the Joiner)."
  - "(90-03) Cast Strength: max HP does not change; the chip shows Strength with 100 squares; the hero sheet's damage range grows by 1 to 10; a hit is visibly higher; making camp keeps the chip; a recast goes back to 100, not 200; Fireball or Lightning with Strength live read higher and an Acid tick does not."
  - "(90-04) Petrify a foe: it dies, the experience is paid, no treasure offer or coin. Stupidity: the foe keeps attacking, its chip says intelligence 1, the resist hint drops to a 20. Blind: its attacks land only on its top roll and never crit, even if you insulted it. On floor 13 and deeper the resist hint and foe card show higher odds than on floor 12."
  - "(90-05) Doze a group: several foes show Dozing and a hit wakes only the one it lands on. Stun one foe: it shows Stunned with a count and a hit does not end it. Ice a group: every foe takes damage and some show Frozen; a foe the damage kills gets no freeze line."
  - "(90-06) A Summoner has Summon in the Grimoire at level 1 and the footer says so; Wizards have no Illusion spell and the footer says \"never learns illusion spells\"; an old save with Lesser Summon or Phantom Host loads (Summon, and nothing removed castable); a Wizard reading an Illusion scroll casts it once and never copies it."
  - "(90-07) Open/Lock then a chest: it opens with no lock roll. Fly over a wall, a crevice and water by arrow pad and by tap: no roll, one square for water. Enchant Character raises the sheet's to-hit by 2 and lowers the foe card's odds. Speed of Sound before a fight: you act first and strike twice. As an Illusionist the chips start at 70 (Fly), 140 (Open/Lock), 90 (Enchant Character, Speed of Sound)."
  - "(90-08) Stop Time a group: failing foes show Stopped for 2 rounds (6 as an Illusionist). Senseless one of two foes: it attacks the other (alone, it swings at the air). Duplicate Foe: it hits itself and leaves you alone. A fumbled Stop Time scroll reads Stopped on the chip and the menu."
  - "(90-09) Door Illusion in a bad fight: you leave at once with no flee roll and the spoils left behind (a clever foe sometimes sees through it). Chameleon Tongue against Magical foes parleys at +4; after a parley the row greys with the reason. Size of the Behemoth: weaker foes flee, the rest show Cowering for the fight. A new Illusionist's Grimoire has Mirror Self, Door Illusion and one more illusion. Scrolls on floor 1 and floor 4+ sometimes roll a Special or Illusion spell."
  - "(90-10) A Magic User Joiner casts a room control from its own book against three or more foes and heals itself when hurt; it never casts Door Illusion or Chameleon Tongue. A Joiner Fighter with Hardiness takes 3 less per blow, with Ambidextrous swings twice a round, with Stealth opens a fight with a crit. Death on the second picked foe kills the second foe; Turn Walking Dead leaves the unturned dead hitting you, never the Joiner. A Dirty Trick on a sleeping or held foe still ends after two foe turns."
  - "(90-11) The combat ABILITIES menu: Kata \"+3 to hit\", Sidestep \"foes −2 to hit you\", Battle Roar \"foes −2 to hit anyone on your side\", Overhead Blow \"−2 to hit\", Death Touch \"one swing, rolled as normal\"; no line says \"faces\". The Grimoire: Mirror Self and Weaken state their d20 ranges, every spell cast on a foe ends with the resist sentence, Heal and Shield do not; the SPELLS menu rows add \"{foe} resists on 16–20 (d20)\"; the Oracle, rail and chips say the same ranges, and the Fixated chip says the unturned dead swing only at you."
---

# Phase 90: Spell & Skill Audit — Verification

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Every spell and skill audited (text / engine / canon), each mismatch fixed or ruled | 90-01 built docs/SPELL-AUDIT.md (41 live spells + Removed table) and docs/SKILL-AUDIT.md (32 rows); user ruled Q1–Q11; 90-12 closed both: every row a final verdict and a pin that exists (78 + 30 titled pins), audit tests fail on any open verdict, missing pin, stale Text cell or gate disagreement | ✓ |
| 2 | Strength does what it says (SPELL-09, report #8) and Pommel Strike is a real strike (ABIL-07, report #4) | 90-03: +d10 on every damage roll for 100 squares, no HP, recast restarts; 90-02: a normal strike that stuns on a hit, hero and Joiner Fighters | ✓ |
| 3 | The ruled reworks and the SPELL-10 slate are built and gated | 90-04 one depth-rising resist for every spell (shared with items), Petrify/Blind/Stupidity; 90-05 Doze/Stun swap, area Ice; 90-06 removals, Summoner's Summon at level 1, Wizard loses Illusion, school-gate guard over every hand-out path (user requirement); 90-07/08/09 the ten Special and Illusion spells, the Illusionist's book, the scroll table pinned per depth band with both new schools (user requirement); 90-10 Joiner casters, Q7–Q10 engine rulings, the bot plays the new spells | ✓ |
| 4 | TEXT-01 for spell and skill rows, and a guard so text can't drift from the engine | 90-11 plain-language text; 90-12 `spell-skill-text-engine.test.js` (88 tests) claims all 179 stated numbers against real engine reads | ✓ |

## Requirements

SPELL-08 ✓ · SPELL-09 ✓ · SPELL-10 ✓ · SPELL-11 ✓ · SPELL-12 ✓ · ABIL-06 ✓ · ABIL-07 ✓ · TEXT-01: spell and skill rows ✓ (identity rows remain with Phase 91)

## Automated checks

- Phase-close full `npm test` by the orchestrator on master after the 90-12 merge: **9,222 tests, 9,220 pass, 0 fail, 2 skipped** (testing once per phase from 90-10 on, user 2026-10-01).
- Parity 66/66; `prototype-master.js.txt` untouched; `narrative-review --check` in sync.
- Declared moves per plan in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan NN"); state pins re-pasted by label only, never `save`. Chargen draw counts moved for Wizard/Illusionist/Apprentice (90-06, smaller pools; declared and regenerated per the greenfield rule).

## Findings carried forward

Listed in both audits' "Findings for other phases" and 90-12-SUMMARY: Phase 91 (Sing on the old helpers, identity text in faces, footer stretch, Master of Arms flee refusal, Chameleon Tongue's parley pay, Cleric offense ban, Joiner Fridgian hide); Phase 91.1 (Illusion school bonus is 0 for both learners so Q6 gives Illusion spells nothing; Joiner Enchant staff blows; Ambidextrous plain strikes only; fixated Walking Dead bolts; Weaken cap on misdirected swings); Phase 92 (fair-bot Joiner camp stall; Magic User death depth with Door Illusion; Stop Time's Illusionist length).
