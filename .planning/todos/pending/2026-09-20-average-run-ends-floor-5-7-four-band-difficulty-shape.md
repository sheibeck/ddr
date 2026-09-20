---
created: 2026-09-20T10:20:00.000Z
title: Average run ends on floor 5–7 — the four-band difficulty shape as the tuning target
area: engine
files:
  - engine/difficulty.js (difficultyCurve — the per-depth dials: foe cap/power, ability threat, dark blobs, water; breather floors)
  - tools/tune-difficulty.mjs, tools/tune-classes.mjs, tools/class-pass-diff.mjs (the bot readouts — median / p90 death depth, reach-N rates)
  - docs/DIFFICULTY-RETUNE.md:390 (the last measured readout — median death depth 3, p90 5; the depth-8..15 median target from Phase 27 was never met)
  - docs/class-pass/v15-after.json (frozen v1.5 class matrix: 143 cells × 40 seeds)
  - .planning/todos/pending/2026-09-20-enemy-attack-cadence-initiative-visibility-damage-curve.md (the cadence/damage fixes that move floors 1–7 first)
  - .planning/todos/pending/2026-09-19-initiative-rolled-once-per-combat-not-every-round.md
---

## Problem

The user's stated tuning shape (2026-09-20), refining the standing "depth 20 is a unicorn run" target:

> For a 20-floor dungeon designed to be highly challenging, the **average run should end around floor 5 to 7** — a sharp early curve where failure is common, so breaking deeper feels earned. Roguelike golden ratio: a standard run ends within the first 25–35% of total depth → floors 5, 6, 7. If players average floor 12, reaching 15 is nothing; if they usually die on 6, reaching 14 is an adrenaline run. Early deaths keep runs short — "just one more game".
>
> Four bands: **Floors 1–4, The Filter** — high variance; a few bad drops or early mistakes mean a quick death; cleared consistently only after mastering the basics. **Floors 5–8, The Wall** — where the average run dies; difficulty spikes; surviving needs skill or an item synergy. **Floors 9–15, The Breakaway Zone** — a strong run; still brutal, but the build gives a fighting chance. **Floors 16–20, The Endgame** — the true test; victory rare and celebrated.

What the bot says today: median death depth **3**, p90 **5** (`docs/DIFFICULTY-RETUNE.md` iteration readouts; the class matrix agrees) — the average run dies in The Filter, not at The Wall, and the on-device feel matches ("murdered at level 5 with every class", see the cadence todo). So the game is currently too lethal *early* relative to this shape, even though depth 20 remains the right ceiling.

## Solution

Adopt the four bands as the difficulty ledger's target and tune toward them — a rules/tuning pass after v1.6 (cleanup-only), sequenced after the cadence + initiative fixes because those change floors 1–7 by themselves:

1. Land the cadence todo (initiative once; one attack per foe per round unless `sp.atk`; ability turns replace swings; Herman-style flat-damage multipliers capped). Re-run the bot: `tune-difficulty --seeds=200` solo + `--party`, `tune-classes` matrix. Record the new median / p90 / reach-N table.
2. Define the target as measurable bands in `docs/DIFFICULTY-RETUNE.md`: median death depth **5–7**; p90 roughly **10–13**; reach-16 rate a few percent; reach-20 well under 1% (the unicorn). Per-band feel notes from the user's text, verbatim.
3. Shape `engine/difficulty.js` so the curve is identity-ish through floor 4 (variance from drops, not dials), spikes at 5–8 (The Wall — foe power/ability threat step), then eases its *slope* (not its level) through 9–15 so a strong build can run, and steepens again 16–20. Breather floors stay.
4. Gate every dial change on the bot readout moving toward the bands; declare fixture moves (engine gate), master never edited; depth-20 slice (`--start-depth 20`) stays the deep-lethality yardstick.

Do not chase the median with flat damage nerfs — the Filter is supposed to be variable; the Wall is supposed to be a wall.
