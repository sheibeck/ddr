---
created: 2026-09-21T20:50:00.000Z
title: Summoner rolls Freeze it cannot cast; hide uncastable spells in combat
area: engine
resolves_phase: 75
files:
  - content/mu-chart.js:31-34 (Summoner — `gate: { offense: 3 }`: the offense school opens at level 3)
  - content/spells.js:87 (Freeze — offense, lvl 1, thrown)
  - engine/derived.js:1519-1528 (canCast — spellLevelFor + schoolGate)
  - engine/magic.js:93-97 (spellSchoolLocked event — "is not open to you yet")
  - engine/character.js:560 (rollGrimoire at chargen — grants without consulting the school gate)
  - src/browser/combatMenu.js:8,162-170 (spell rows: `enabled: canCast && charges > 0`; unavailable rows render disabled but STAY — an earlier CONTEXT decision)
  - src/browser/eventNarration.js:666 / src/browser/narrationLines.js:1363 (the lock line)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "my level 1 summoner has a level 1 freeze spell but it's not usable. Says: freeze is not open to you yet. Additionally, we should only see level appropriate spells in combat. Spells that are too high level for casting shouldn't show up."

Why it happens: the Summoner's MU chart row gates the whole OFFENSE school behind level 3 (`gate: { offense: 3 }`, the Phase 24 "one good, one bad" identity rule), but chargen's `rollGrimoire` can still roll an offense spell (Freeze, lvl 1) into a level-1 Summoner's grimoire. The spell is legally in the book and legally uncastable for two levels — to the player it reads as a level-1 spell that refuses to work. The combat menu then lists it disabled with no reason, alongside any spell above the hero's level.

## Solution

Two parts (user ruling 2026-09-21 on the second — it reverses the earlier "disabled rows stay visible" CONTEXT choice for combat):
1. Chargen / learning: don't grant what the sub cannot cast at grant time — `rollGrimoire` (and any later learn path) should skip spells whose `schoolGate(sub, sp.s) > c.level` at the level they're granted, re-rolling in the same draw discipline (derived rng stream if it would reorder chargen draws — chargen is a parity fixture, `action-script.chargen.json`, so declare the mover). Alternative to discuss: keep the roll but make the school gate visible in the Grimoire row ("offense opens at level 3") so it never reads as broken. The user's framing favours the first.
2. Combat menu: hide spells that are not castable for LEVEL reasons (`spellLevelFor > c.level` or the school gate) — only level-appropriate spells appear in the cast list; keep showing (disabled) spells that are merely out of charges, since "no charges" is information the player needs. Update `combatMenu.js`'s row builder + its unit test; the Hero-tab Grimoire keeps listing everything the book holds (with the gate note from part 1's alternative).
Pixel 7 check: roll a Summoner; confirm no offense spell in the day-one book (or the gate note shows); in a fight, only castable-by-level spells are listed.
