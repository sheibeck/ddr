---
created: 2026-09-21T22:35:00.000Z
title: Table-4 HP dots compound max HP geometrically (54-05 regression)
area: engine
files:
  - engine/difficulty.js:126-132 (DOT_HP_FRACTION { small 0.24, mid 0.36, large 0.6 } — fractions of the hero's CURRENT maxWP)
  - engine/difficulty.js:444-450 (dotHpFor(kind, maxWP))
  - engine/encounters.js:298-306 (Table-4 "+25 HP" row → c.maxWP += dotHpFor("large", c.maxWP) — a permanent ×1.6)
  - engine/encounters.js:315-320 (Table-4 "-15 HP" row → dotHpFor("mid", c.maxWP) — "The maze extracts a toll…")
  - engine/encounters.js:452-464 (faerie ±d20/d10 base HP rows — still flat, for contrast)
  - .planning/phases/54-four-band-retune-and-roster-decision/54-05-SUMMARY.md (the declared `encounters.json#tablefour` mover)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "human samurai. Floor 6. I got this message. I'm not sure what caused the 140: The maze extracts a toll you did not agree to. 140 hp. / Table 4, roll 7: The dice decide — -15 HP."

54-05 (BAND-02, USER RULING D) replaced Table-4's flat ±HP dots with fractions of the hero's OWN max HP so they keep meaning at higher levels. But the "+25 HP" row writes its fraction back INTO maxWP permanently: `maxWP += round(0.6 × maxWP)` is a ×1.6 per pull, compounding — a ~100-HP level-5 Samurai is ~160 after one pull, ~256 after two, ~410 after three. The "-15 HP" toll then takes 36 % of the inflated pool (140 here) and reads as a random 140-point hit. Canon (p.45) is a flat +25 / −15; the ROADMAP's own rule for this milestone is "no single hit can spike past a smooth depth-scaled damage curve" — this is a spike the hero's own luck manufactures.

Consequence for the fit (54-07): the fair bot's runs include this compounding, so every survival curve the search is fitting is measured on heroes with lucky-dot-inflated HP pools; the dials it turns to compensate (FOE_LEVEL base 0.9 etc.) then land on heroes WITHOUT the lucky pulls — variance the design did not ask for.

## Solution

Make the dots proportional to a pool that does not feed back on itself: `dotHpFor(kind, base)` where `base` = the hero's level-derived max HP (chargen roll + level gains, i.e. `maxWP` MINUS accumulated Table-4/faerie bonuses — track `c.hpBonus`), or simply the canon flat values × `HERO_HP_SCALE` (a ±25/15 that HERO_HP_SCALE already keeps in step with the HP pool). The "+HP for keeps" row must be additive and bounded (≤ one canon step per pull), the toll row a fraction of the UN-inflated pool. Re-pin `test/unit/encounters.test.js`, re-measure/declare the `tablefour` fixture (already a declared mover in 54-05 — update the rationale), keep `dotHpFor`'s identity fast path. This is an engine rules change — a USER RULING F adjustment candidate: land it BEFORE the next fit block so the search fits the corrected HP economy (blocks so far are still valid evidence, recorded). Pixel 7 check: pull "+25 HP" twice on one hero; max HP grows by two bounded steps, not ×2.56; the toll row never exceeds ~36 % of a sane pool.

## Second instance (2026-09-21 23:05, same device session)

User: "another instance of this. Just not sure what's causing it: The maze extracts a toll you did not agree to. 141 hp. / Table 4, roll 7: The dice decide — -15 HP." → 141 = round(0.36 × maxWP) ⇒ maxWP ≈ 392 on the same hero — consistent with two or three "+25 HP" pulls compounding (×1.6 each) on a ~100-HP level-5 Samurai. Fix in flight: USER RULING G §1 (54-07 cycle 3, Adjustment 2) — canon flat ±25/15 × HERO_HP_SCALE, no feedback into maxWP.
