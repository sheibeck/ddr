---
created: 2026-09-25T00:00:00.000Z
title: Dazed works (-2 to hit) but nothing on screen says what it does
area: ui
resolves_phase: 77
files:
  - engine/derived.js:1132-1134 (toHit — dazed: need 2 lower to hit, never below 1, while c.foeEffect.kind === "dazed" && rounds > 0)
  - content/foe-abilities.js:61 (djinniDaze — the source)
  - mazeworld.html:3046, :3123 (CONDITION_COPY.foeEffect / FOE_EFFECT_LABEL — the chip label only, no effect text)
  - src/browser/eventNarration.js:601-611, src/browser/narrationLines.js:1326 (flavor-only lines)
---

## Problem

User, 2026-09-25: "i was dazed in combat, but it seems like it doesn't do anything. The description is too vague to know."

**Scouted:**
- Dazed IS mechanical. While it lasts, the hero's to-hit loses 2 winning faces (floor 1), applied in `toHit` (Phase 19 D-10). After Phase 73 it reads "−2 to hit (now 19–20)".
- But the chip reads only "Dazed · n rds". The Oracle's "The room keeps moving after you stop. Dazed for N rounds." never names the effect, and a miss line only shows it if its `mods` breakdown includes "dazed".
- So the player can't tell it did anything. This is a VOX-05/CMBUI-13 honesty gap.

## Solution

- The Dazed chip's tap description (Phase 77 CMBUI-13 hero-side chips) states the effect in Phase 74's format: "Dazed · 2: −2 to hit (you hit on 19–20 instead of 17–20) for 2 more rounds."
- The onset line names the effect: "The room keeps moving after you stop. −2 to hit for 3 rounds."
- Every strike roll while dazed carries a "dazed −2" entry in its modifier list. Verify it's in `mods`; add it if missing.
- Audit the sibling `foeEffect` kind "weakened" and every other hero condition chip for the same "label only, effect unstated" gap as part of CMBUI-13's coverage table. Each chip's description names its mechanical effect.
- Presentation only, unless the `mods` entry turns out to be missing (then a tiny engine tweak with no outcome change).

**Pixel 7 check:** get dazed by a Djinni. The chip tap and the onset line both say −2 to hit and the rounds left, and a miss line lists "dazed −2".
