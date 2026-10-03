---
created: 2026-10-02T12:30:00.480Z
title: Rewrite player-facing descriptions as fantasy flavor, not a manual
area: content
resolves_phase: 96
files:
  - content/spells.js
  - content/flavor.js
  - content/identity.js
  - content/potions.js
  - content/items*.js
  - mazeworld.html (CONDITION_EXPLAIN chip text)
---

## Problem

User, 2026-10-02, on the v2.3 debug build: "The debug build looks good, but I did notice now that the spell descriptions in game are too descriptive now. They read like a technical manual. I want fantasy flavor for the descriptions that show to the players for equipment, spells, race/sub-class, etc. Players see narrative, code sees technical."

v2.3 was the "Truth in Advertising" milestone: phases 89-91.1 rewrote item, spell, skill and identity text so that every number in it matches the engine, and the `*-AUDIT` docs plus text-engine tests pin those texts. In-game descriptions now read like rule sheets, for example the Cleric blurb in content/flavor.js:94 and the spell `txt` fields in content/spells.js.

## Solution

Split each description into two layers:
- **Player layer:** short, evocative fantasy flavor, shown in game.
- **Technical layer:** exact rules and numbers. It stays in code and docs, which the audits and text-engine tests pin.

Decide with the user whether the exact numbers survive in game somewhere secondary, for example a "details" toggle, the chip tap text or the Hero-tab footer. The family-friendly voice rules and the narrative-review check apply.

Truth-in-advertising tests currently pin the player text. They would need to move to the technical layer: item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity and the identity tests.

Scope: equipment, spells, scrolls, potions, races, classes, sub-classes and abilities. Likely a next-milestone phase, needing a discuss-phase on tone and on where the numbers live.
