---
created: 2026-09-25T00:00:00.000Z
title: Summoner loses its offense gate; Lesser Summon shows in the party and sorts with level-1 spells
area: engine
resolves_phase: 75
files:
  - content/mu-chart.js:33 (Summoner `gate: { offense: 3 }` — REMOVE)
  - engine/derived.js:1496 (schoolGate)
  - content/spells.js:119 (Lesser Summon, lvl 1, row 32 — listed last because the combat menu keeps SPELLS array order)
  - src/browser/combatMenu.js:150-166 (spell rows built in SPELLS order, no sort)
  - content/flavor.js (SUB_NOTE.Summoner — must state the new trade-off)
---

## Problem

User, 2026-09-25 (mid v2.1 run), three items:

1. "lesser summon isn't showing up in the party list when cast." A summoned ally from Lesser Summon does not appear in the party list (YOUR LOT) in combat.
2. "put lesser summon with the level 1 spells, when in combat it's always at the bottom." Lesser Summon is a level-1 spell, but it sits at row 32 of `SPELLS`, and `combatMenu.js` lists spells in array order.
3. "let's remove the summoner lack of ability to cast early level spells. They already have a negative of summons having a chance to turn on them." The Summoner's offense school gate (`MU_CHART.Summoner.gate = { offense: 3 }`) goes away.

## Solution

**Routing:**
- **Item 3 → Phase 75.** RULES-03 is amended: the Summoner's offense gate is removed outright, so a level-1 Summoner can roll and cast offense spells. The general grant-time legality rule still applies to the six sub-classes that keep gates (Warlock, Sorcerer, Court Mage, Illusionist, Cleric, Apprentice).
  - Engine gate: removing the gate can move a chargen/combat fixture where a Summoner rolled or cast offense. Measure, declare and regenerate only those.
  - The Summoner's disadvantage becomes "summons may turn on you". Phase 79 (VOX-04) writes the blurb and footer from the chart, so it must no longer claim an offense gate.
- **Item 2 → Phase 77 (CMBUI-08).** The spell sort (level ascending, then A–Z) puts Lesser Summon with the level-1 spells. Pin it with a test that Lesser Summon lists among the level-1 rows.
- **Item 1 → Phase 77.**
  - YOUR LOT lists every combatant on the hero's side, including a summoned ally (Lesser Summon and any other summon), with its HP and remaining rounds, as part of the CMBUI-13 indicators work.
  - Root-cause why the summon is missing first: the view model may read `state.party` only, not the combat ally.

**Pixel 7 checks (milestone close):**
- A level-1 Summoner can roll and cast an offense spell.
- Lesser Summon lists with the level-1 spells.
- A cast Lesser Summon appears in YOUR LOT until it leaves.
