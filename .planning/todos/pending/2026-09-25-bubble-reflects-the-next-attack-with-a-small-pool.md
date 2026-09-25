---
created: 2026-09-25T00:00:00.000Z
title: Bubble reflects the next attack (plus a small soak pool), no longer a bigger Shield
area: engine
resolves_phase: 75
files:
  - content/spells.js:109 (Bubble — lvl 3 protection ward, pool 100, rounds 12, reflect: true)
  - content/spells.js:84 (Shield — lvl 1 protection ward, pool 50, rounds 5)
  - engine/combat.js (ward soak/reflect handling — wardReflected / wardAbsorbed / wardShattered events)
---

## Problem

User, 2026-09-25: "I think bubble is too strong a spell. We already have a shield spell. Maybe bubble should just reflect the next attack. Revisit this."

Today Bubble is a strictly bigger Shield: a 100 hp soak for 12 rounds that ALSO reflects. Shield is 50 hp for 5 rounds.

## Solution (user choice, 2026-09-25: "Reflect the next attack, keep a small pool")

- **Bubble becomes a one-shot mirror.** The NEXT blow that would land on the caster is fully reflected: the caster takes none of it, and the attacker takes its full damage. Then the bubble POPS.
- **Plus a small soak pool** for the rest of that round after it pops. Recommend 25 hp; the planner sets the final value against Shield's 50 and the bot readout. So a multi-attack round isn't wide open.
- It lasts until that one attack lands or the fight ends. It has no 12-round duration.
- Shield keeps its role (a 50 hp pool for 5 rounds).
- Narration: "The bubble catches it and sends it back. Pop." The chip shows "Bubble · next hit" (Phase 77 CMBUI-13) and the pool afterward.
- **Engine gate:** a declared rules change to a canon-era spell. Measure, declare and regenerate the fixtures where Bubble was cast, and take a bot readout (a defensive nerf). Update the spell text in `content/spells.js`, `docs/SPELLS.md` and the Grimoire description, written roll-high-aware.
- **Interactions to check:** the ward reflect code shared with Shield (Shield has no reflect), members casting Bubble, a fumbled Bubble scroll (RULES-10, which lands on the targeted foe, so a foe's bubble reflects YOUR next hit), and any foe ability that ignores wards.

**Pixel 7 check:** cast Bubble. The next hit bounces back and the bubble pops, a small pool soaks the rest of that round, and then it's gone.
