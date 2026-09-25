---
created: 2026-09-25T00:00:00.000Z
title: No rations, no spell recovery - the book refills only after a fed night's rest
area: engine
resolves_phase: 75
files:
  - engine/movement.js:~634 (newDay — `c.spellsUsed = 0;` runs unconditionally, BEFORE the rations check)
  - engine/movement.js:~652-656 (members — `if (m.spellsUsed) m.spellsUsed = 0;`, also before the rations check)
  - engine/movement.js:~660+ (`if (c.rations >= eats) { … rested/heal … }` — the fed branch)
---

## Problem

User, 2026-09-25: "When you make camp you recharge all spell slots. We need to provide that when you don't have enough rations, you do not recover spells. You need a good night's sleep!"

**Scouted:** `newDay` (camping, and the automatic new day every 100 squares) refills the hero's and every member's spell book at the very top, before checking rations. Only the rest-heal is gated on eating. A starving party wakes with full books.

## Solution

- Move the book refill (hero `c.spellsUsed = 0` and each member's) INSIDE the fed branch (`c.rations >= eats`), next to the rest-heal. An unfed day leaves every book exactly as it was.
- This applies to BOTH ways a day turns: making camp, and the automatic new day every 100 squares. Both run `newDay`.
- The unfed branch narrates it in voice: "No supper, no sleep worth the name. Your book stays empty." The Phase 78 new-day rail line names the refill only when it happened.
- The Wizard's per-round and every-20-squares trickle recovery is unaffected. That trickle is the Magic User's walking cadence, not sleep. The planner confirms it's intended to stay.
- **Engine gate:** a declared canon divergence (the prototype refills unconditionally). Measure, declare and regenerate the fixtures where a day turned unfed with charges spent. There's no new rng. Take a bot readout: casters starving on deep floors lose charges, a difficulty increase. Update `docs` rules text and the camp card copy ("Make camp: eat, rest, and refill your book — if you have the rations").

**Tests:**
- A fed day refills hero and member books.
- An unfed day refills nothing and emits the "no sleep" line.
- The 20-square trickle is unchanged.

**Pixel 7 check:** as a Magic User with 0 rations and spent charges, make camp. The book stays empty and the Oracle and rail say why.
