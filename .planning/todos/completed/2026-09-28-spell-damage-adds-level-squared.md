---
created: 2026-09-28T05:00:00.000Z
title: Spell damage adds the caster's level squared, like weapons
area: rules
files:
  - engine/magic.js (thrown, volley, quake and vapor damage: rollDice(dmg) × max(1, level − spell level))
  - engine/derived.js#weaponDamageTerms (levelSq, the precedent)
---

## Ruling (user, 2026-09-28)
- "What if we square spell damage just like we do with weapons damage. Having every spell be resistable then helps offset that if it's too powerful."
- **Chosen:** "Dice + level²". Damage spells deal their dice + the caster's level², replacing the (level − spell level) multiplier FOR DAMAGE; the p.26 multiplier stays for area, duration and effects.
- **Chosen:** "Each foe gets it". An area spell adds level² to every foe it damages.

## Why
Weapon damage adds level² per hit (L5: +25), so Magic Users fell behind (79.2-01 START: F/T/M p50 6/7/4). Spells also became resistible, and Freeze stopped killing.

## Status
In progress as quick 260928-sq2, before the 79.2 re-START and sweep.
