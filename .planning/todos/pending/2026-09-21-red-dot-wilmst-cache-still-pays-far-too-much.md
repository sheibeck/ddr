---
created: 2026-09-21T21:58:00.000Z
title: Red-dot wilmst cache still pays far too much
area: engine
resolves_phase: 75
files:
  - engine/encounters.js:250-262 (WILMST_CACHE_PER_DEPTH = 300 — the Table-4 "wilmst cache" row, a documented TUNING KNOB; flat, no rng)
  - engine/encounters.js:321-333 (the row's gainWilmst(lootFor(300 × depth)) call)
  - engine/difficulty.js (LOOT_SCALE dial — held in the fit at 0.8 "already too much money", identity 1; applies to kill purse / chest / cache / faerie together)
  - tools/lib/fit-score.mjs:203-210 (HELD_DIALS — LOOT_SCALE is held, not searched)
  - docs/DIFFICULTY-RETUNE.md:4899 (the LOOT_SCALE dial-table row)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "still getting way too much wilmst from red dot encounters."

The Table-4 "wilmst cache" row pays a flat `300 × depth` (ECON-09 cut it from the prototype's flat 3000; Phase 54 multiplies it by `LOOT_SCALE`, 1 at identity, 0.8 at the fit's start point). A single red dot on floor 3 hands 900 (720 at 0.8) — several times a chest (`(d10+6) × 100 × depth / LOOT_DIVISOR`, ≈ 160 × depth) and enough to buy out the store, which flattens the economy the store-tier ladder is supposed to pace. This is the second time the user has flagged it (the first produced the 0.8 start value).

## Solution

Treat the cache row as its own dial rather than riding `LOOT_SCALE`: cut `WILMST_CACHE_PER_DEPTH` (300 → ~100, so a cache ≈ a good chest, still the best single find) or convert it to `(d6+2) × 25 × depth`-style rolled amount ONLY via a derived rng stream (a new draw on the main stream would shift every downstream fixture — the ECON-09 comment's warning stands). Record the before/after in the ledger's Change table; declare any fixture the change moves (`action-script.encounters.json`, economy). Optionally release `LOOT_SCALE` into a later fit block so the bot's gold-on-hand pace (54-04's Pace block) is measured against the store tiers. Engine quick task; sequence AFTER 54-07 lands (the fit's economy baseline must not move under it). Pixel 7 check: a red-dot cache on floors 1–3 pays less than a store-tier reset.
