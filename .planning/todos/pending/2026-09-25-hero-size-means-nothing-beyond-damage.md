---
created: 2026-09-25T00:00:00.000Z
title: Hero size means nothing beyond a damage bump - make size matter or make the items honest
area: engine
files:
  - content/treasure-tables.js:109-111 (Gauntlet of the Giant — eff { size: 1 }, txt "one size larger for fifty squares; mind the ceilings, then fifty squares of shrinking back", act kind "giant")
  - content/potions.js:36-38 (Enlarge — txt "one size up, +4 damage, 50 squares", act kind "might" +4)
  - engine/derived.js:1051, :1371 (the ONLY reads of the hero's size: +2 damage per eff("size") step)
  - engine/items.js:1381-1396 (enlarge/giant activation cases — record only, no other effect)
  - content/spells.js:99 (Shrink — a foe spell: half hp and half damage)
---

## Problem

User, 2026-09-25: "we have items that affect your size. Size doesn't matter in this game, so we either make it matter or make sure we update items and spells, like gauntlet of giant, to do something."

**Scouted facts:**
- The hero's "size" is read in exactly one place: +2 flat damage per size step (engine/derived.js). The Gauntlet gives size +1, which is +2 damage. Enlarge gives +4 damage through a "might" record and never touches size at all.
- Nothing else knows the hero's size. There are no ceilings, no squeezing, and no effect on being hit, initiative or carrying. So "mind the ceilings" and "one size larger" promise mechanics that don't exist.
- FOE size does matter (bestiary `sz` T/S/M/L/H): small foes "strike as one level lower", the Knight vs big-foe initiative rule, and so on. A hero-size rule could reuse that vocabulary.

## Solution

**Needs a user design call:**
- **(A) Make size matter:** give the hero a size class (Human/Elf/Dwarf base by race; items and potions step it). Candidate effects:
  - One size up: +2 damage (existing), foes find you one face easier (a bigger target), and big-foe rules treat you as big (for example the Knight rule, and foes that "strike small targets").
  - Dwarves or a shrunken hero get the reverse.
  - Tight passages or low ceilings on some tiles: a map rule, which is a bigger feature.
  - This is an engine change under the gate, with measured fixtures and a bot readout.
- **(B) Make the items honest:** keep the damage bump and rewrite the Gauntlet, Enlarge (and any other size text) to say exactly what happens ("+2 damage for fifty squares"). Drop "size" and "ceilings" language, or make Enlarge actually use `size` so both share one rule. This is a content and text change only (Phase 79 VOX-05 territory).
- The Shrink spell (on foes) is already mechanical (half hp and damage), so it isn't part of this gap.
