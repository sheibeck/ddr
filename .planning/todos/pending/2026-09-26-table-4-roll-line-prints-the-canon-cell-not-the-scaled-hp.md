---
created: 2026-09-26T00:00:00.000Z
title: Table 4 roll line prints the table's "-15 HP" while the row actually deals the scaled amount (19 at depth 3)
area: narration
resolves_phase: 79
files:
  - engine/encounters.js:200 (encounterRolled carries the raw table cell as `result`)
  - engine/encounters.js:298-336 (tableFour HP rows apply dotHpFor(...), which is scaled by HERO_HP_SCALE since Phase 54)
  - src/browser/eventNarration.js:899 (encounterRolled line: "Table N, roll R: The dice decide — {cell}.")
---

## Problem

User, 2026-09-26, from a death on a device (depth 3, day 4, 11 rations): "I'm not sure where the 19 damage came from." The Oracle, oldest line first:

- Table 3, roll 7: The dice decide — Ailment.
- Something is wrong with you. The die turns up 7. Poison.
- Poison: it takes hold. −3 hp.
- Poison: still in you. −9 hp.
- **Table 4, roll 7: The dice decide — -15 HP.**
- **The maze extracts a toll you did not agree to. 19 hp.**
- You have died.

**Diagnosis (orchestrator, 2026-09-26):** the two bold lines are ONE event.
- `encounterRolled` prints the table's printed cell ("-15 HP", the canon label).
- `tableFour`'s "-15 HP" row actually applies `dotHpFor("mid")`, and since the Phase 54 retune that is HERO_HP_SCALE-scaled: 19 at depth 3.
- The player reads a −15 roll followed by an unexplained second 19 hp hit.
- The toll line also has no minus sign, so it doesn't clearly read as a loss.

The hunger and rations were not involved. The same label-versus-amount drift hits every scaled Table 4 HP row ("+10 HP", "-10 HP", "+25 HP") and the XP rows, which are scaled by HERO_SP_SCALE.

## Solution

- The roll line and the effect line tell ONE consistent number:
  - Either the `encounterRolled` line names the row by its effect ("a toll") instead of the raw cell "-15 HP",
  - or the engine emits the scaled amount on the event and the roll line prints it.
- The effect line prints a signed amount through the Phase 74 formatter ("−19 HP"), with HP not WP.
- Check whether the raw-cell echo exists anywhere else. This is related to the heal-lines-print-the-raw-roll todo (2026-09-25).
- It is presentation plus an additive event field only. The engine gate applies if an event field is added: narrate it and carve it out of the comparables if it is serialized.
