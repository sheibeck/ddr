---
phase: "16"
name: Economy-Local Conservative Tuning (Economy E)
status: complete
completed: 2026-09-10
tests: 666/666 (parity 25/25 byte-identical)
requirements: [ECON-09, ECON-10]
---

# Phase 16: Economy-Local Conservative Tuning — SUMMARY

**Complete + verified + deployed 2026-09-10.** `npm test` = **666/666**, parity 25/25 byte-identical. No new rng, `difficulty.js` + master untouched. FINAL Economy phase.

## What landed
- **+3000 red-dot reward → `300 × depth` (flat, NO rng)** — `engine/encounters.js` `WILMST_CACHE_PER_DEPTH=300` (depth 1 → 300, depth 7 → 2100; order of magnitude lower than the old flat 3000). The dual-purpose cell string `"+3000 wilmst"` → generic `"wilmst cache"` (renamed atomically with the `tableFour` switch key in `content/encounters.js` + `engine/encounters.js`); the actual amount is narrated via the existing `goldGained` event. Fixture-impact verified: NO parity fixture rolls this cell → parity-safe; master untouched.
- **Other grants** sanity-checked (chest/faerie/grimoire/`LOOT_DIVISOR`) — only +3000 was egregious; the rest deliberately left for the deep-tune.
- **Bag caps confirmed as v1** (slots 4/6/8/10, wilmst 2000/5000/8000/10000, rations 10/20/40/60) — documented tuning knobs.
- **`tools/tune-economy.mjs`** — a zero-dep harness STUB (mirrors tune-difficulty) for the later deep-tune; not driven for final balance.
- Test rewritten (encounters.test.js) for the depth-scaled "wilmst cache" (depth 1→300, 7→2100, no-new-rng). Count held at 666.

## Deferred (as scoped): deep harness-driven cost/spread/reward tuning + the GLOBAL `difficulty.js` foe-scaling retune → the consolidated cross-milestone pass (with Joiners Phase 11 + Monster Balancing).
## Requirements: ECON-09 ✅ (conservative reward fix), ECON-10 ✅ (v1 bag caps).
## Economy & Item Balancing milestone = CODE-COMPLETE (Phases 12–16).
