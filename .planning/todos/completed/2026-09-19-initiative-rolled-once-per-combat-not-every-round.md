---
created: 2026-09-19T22:18:06.344Z
title: Initiative rolled once per combat, not every round
area: engine
resolves_phase: 51
files:
  - engine/combat.js:154-175 (rollInitiative — d20 vs d20, Samurai/slow/foresight/Acute Hearing overrides, sets C.first + C.initNote)
  - engine/combat.js:388 (startCombat — the opening roll)
  - engine/combat.js:1339-1342 (afterPlayerAction — `state.combat.round++; rollInitiative(state, rng); // p.24: a fresh d20 each round` then `if (first === "foe") foeTurn(...)`)
  - test/parity/prototype-master.js.txt:1865-1875 (canon rollInitiative — same shape, called every round)
  - test/parity/fixtures/action-script.combat.json, test/parity/fixtures/*magic*.json, test/unit/combat.test.js, test/unit/foe-turn-draw-count.test.js (draw-count pins)
  - docs/FIXTURE-INVENTORY (test/parity/FIXTURE-INVENTORY.md) — the declared-divergence ledger
---

## Problem

User ruling (2026-09-19, on-device feel): initiative should be rolled **once at the start of combat**, not every round. Today `afterPlayerAction` increments the round and re-rolls initiative (`engine/combat.js:1341`, canon p.24 "a fresh d20 each round"); when the foe wins the new roll it acts first in the new round — right after it already acted at the end of the previous round — so the player sees two enemy attacks back to back with no chance to respond. The user wants the initiative order fixed for the whole fight, which removes the back-to-back enemy turns and makes rounds read as a steady you/them or them/you exchange.

## Solution

- Roll initiative once in `startCombat` (existing call at L388) and delete the per-round re-roll at L1341; keep `C.first` for the fight's duration. Per-round order then follows from the opening roll: `first === "foe"` → foe acts before the player each round (the existing branch stays, gated on the stored `C.first` instead of a fresh roll); `first === "you"` → player acts, then `foeTurn` — the foe never gets two consecutive turns.
- `C.initNote` (the "Initiative — you N, them M" narration) is emitted once; check the combat header / fight log for a per-round initiative line and drop it. `foresight` (one-shot) and Samurai/slow rules apply to the single roll.
- **Deliberate canon divergence** (p.24) under the greenfield ruling: 2 fewer d20 draws per round shifts every combat/magic parity fixture's stream from round 2 onward. Measure first (a scan in the `tools/worn-fixture-scan.mjs` style listing every replay site whose comparables move), declare each with before/after, regenerate only those, record in `FIXTURE-INVENTORY.md`; master never edited. Re-pin `foe-turn-draw-count.test.js` / `combat.test.js` sequences. Bot readout before/after (`tune-classes` smoke) since fewer foe turns lowers lethality slightly — note it in `docs/DIFFICULTY-RETUNE.md` for the next tuning pass.
- Gameplay change → **outside v1.6** (cleanup-only). Land as a quick task after the milestone or fold into the next tuning pass with 999.2 (Joiner level cap).
