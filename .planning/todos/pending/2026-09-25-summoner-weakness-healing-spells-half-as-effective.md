---
created: 2026-09-25T00:00:00.000Z
title: Summoner weakness - healing spells it casts are half as effective
area: engine
resolves_phase: 75
files:
  - content/mu-chart.js:31-34 (Summoner row; the offense gate is removed per todo 2026-09-25-summoner-loses-its-offense-gate)
  - engine/magic.js (healing-school cast path: the amount a heal restores)
  - content/flavor.js:64 (SUB_NOTE.Summoner — must state the new weakness)
---

## Problem

User, 2026-09-25: "let's make summoner weakness be that healing spells are only half as effective."

This follows the same day's removal of the Summoner's offense gate. The Summoner keeps its good (summons twice as strong and twice as long-lived) and the existing one-in-eight summon backfire. Healing becomes its stated weakness.

## Solution

**Reading taken (tell the user; they can correct it):**
- Healing-school spells CAST BY a Summoner restore half their normal amount, rounded down, minimum 1.
- This applies to any target: the Summoner, party members and allies.
- Potions and heals cast by others on the Summoner are unaffected.
- The summon backfire stays.

**Implementation:**
- An engine rule on the healing-spell resolution path, keyed on the caster's sub-class. It is a data flag on the Summoner's chart row (for example `healMul: 0.5`) rather than a hard-coded name.
- No new rng draw.
- Measure the parity fixtures it moves (any Summoner heal in a fixture), declare them and regenerate only those.
- Oracle/rail lines show the halved amount. A narration hint in voice is optional.
- Phase 79's VOX-04 footer is generated from the chart, so it names "healing spells restore half".

**Tests:**
- A Summoner heal restores floor(normal/2), minimum 1.
- A non-Summoner heal is unchanged.
- A potion drunk by a Summoner is unchanged.

**Pixel 7 check (milestone close):** a Summoner casting a heal restores about half what a Cleric's does.
