# Phase 16: Economy-Local Conservative Tuning (Economy E) — Context

**Gathered:** 2026-09-10 (autonomous, FINAL Economy phase). **Requirements:** ECON-09, ECON-10.
**Research:** `.planning/research/economy-SUMMARY.md` §5. Depends on Phases 12–15. Baseline: **666/666**, parity byte-identical.
**Scope (user):** CONSERVATIVE first-pass numbers only — deep harness-driven tuning + the GLOBAL `difficulty.js` foe-scaling retune are DEFERRED (the latter to the consolidated cross-milestone pass; do NOT touch `engine/difficulty.js`).

## Phase boundary
- **DOES:** fix the egregiously-off economy numbers (the +3000 wilmst red-dot reward is the priority), sanity-check a few other large grants, and confirm the v1 bag caps. Conservative — leave the fine balance to on-device playtesting.
- **Does NOT:** deep cost/spread tuning, a tuning harness build (may scaffold but not drive), or ANY `difficulty.js`/foe-scaling change.

## Tasks
1. **The +3000 red-dot reward → depth-scaled flat, NO new rng** (`engine/encounters.js:254` area, the `+3000 WM`/"+3000 wilmst" tableFour case): replace the flat 3000 with a modest depth-scaled FLAT amount (e.g. `~300 * state.floor.depth`, an order of magnitude lower). **CRITICAL:** this row currently draws ZERO rng — keep it flat/derived, add NO `rng.d()` (a new draw would shift the seeded stream + break parity). Update the dual-purpose row string only if its displayed number is baked in (it reads "+3000 wilmst"; if the label must match, change label + the `case` key atomically — but prefer a generic label so the amount can vary by depth without a dual-purpose string, e.g. narrate the actual amount via the existing gold event).
2. **Sanity-check other large grants** — chest `(d10+6)*100*depth/10` (`encounters.js:~137`), faerie `d10×100` (`~384`), grimoire non-MU `+150` (`~297`), `LOOT_DIVISOR=10` (`items.js:71`). Fix ONLY egregious ones; leave the rest for the deep-tune. Any change must add NO new rng draw (adjust multipliers/divisors, not draw counts).
3. **Confirm v1 bag caps** — the Phase-12 `BAGS` (slots 4/6/8/10, wilmst 2000/5000/8000/10000, rations 10/20/40/60) are the v1 values; leave them as-is unless a number is obviously broken. Document them as tuning knobs.
4. **Optional:** scaffold a headless tuning-harness stub (a `tools/`/`test/` script driving `applyAction` over N seeded runs) for the LATER deep-tune — but do NOT drive final balance from it now.

## ⚠ DETERMINISM / PARITY — reward-value changes are deliberate divergences
- **FIRST check whether any parity fixture exercises each reward cell you change** (grep `test/parity/fixtures/`; the tableFour +3000 cell is index 8 of the table-4 row — the Text-batch notes say the table-4 reward cells are "never exercised by any parity fixture," but VERIFY). 
- If NO fixture hits it → the value change is parity-safe (the reward only fires in live play). Proceed.
- If a fixture DOES hit a changed reward → it diverges from the frozen master's amount. Handle as a DOCUMENTED deliberate divergence per research §5.4 (a targeted reconciliation/carve-out for JUST that reward — NEVER weaken the whole gold comparison, NEVER edit `prototype-master.js.txt`). If it can't be handled cleanly + conservatively, DEFER that specific reward's retune to the deep-tune and note it (the user chose "conservative").
- **NO new rng draws anywhere** (flat/derived formulas only) → `same-seed-same-result` stays green.
- GLOBAL `engine/difficulty.js` foe-scaling: DO NOT TOUCH (deferred).

## Success criteria (gate)
1. The +3000 red-dot reward is depth-scaled to a sane amount with NO new rng draw (ECON-09).
2. Any other egregious grant conservatively adjusted; the rest explicitly left for the deep-tune.
3. Bag caps confirmed as v1 values (documented knobs) (ECON-10).
4. **PARITY GATE:** full `npm test` green; empty/solo same-seed byte-identical; reward-value divergences handled/documented (or deferred); `difficulty.js` untouched; `prototype-master.js.txt` untouched.

## Hard constraints
Engine pure/deterministic; NO new rng draws; NO `difficulty.js` change; reward divergences documented + minimally scoped (or deferred); no field/existing-event renames; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
