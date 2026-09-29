---
created: 2026-09-29T01:10:00.000Z
title: Store can still be bought out at depth 7
area: engine
files:
  - engine/economy.js
  - content/store-stock.js
  - content/treasure-tables.js
  - tools/tune-economy.mjs
---

## Problem

(User, 2026-09-28, on device, right after the d10-rations todo.) "additionally, I'm still able to buy out a whole store at depth 7..."

By depth 7 the hero carries enough wilmst (gold) to buy every row in a store, so the store stops being a choice. This is the same complaint as the 2026-09-21 todo "red-dot wilmst cache still pays far too much" (resolved in v2.1 by RULES-02, which cut the Table-4 cache to about 100 × depth), so that cut alone did not fix the curve: income still outruns store prices by the mid floors.

## Solution

TBD. Measure first, then retune:
- Measure gold held on arrival at each store, by depth (floors 1–12), and the total price of that store's stock, with `tools/tune-economy.mjs` (currently a scaffold stub; extend its gold-by-source / gold-on-store-arrival readout). This is a milestone-end bot run (bots-only-at-milestone-end rule), unless the user wants it sooner.
- Find the sources that outrun prices: kill loot, caches/finds, sell-back, Joiner purses, etc.
- Candidate levers: scale store prices with depth (premium rows especially); trim the top gold sources; limit stock per visit (one of each tier); a store "budget" feel where buying everything costs more than a deep run's income. Target to agree with the user: at depth 7, a typical hero affords roughly a third to a half of a store.
- Related: todo 2026-09-28 stores stock up to d10 rations (more ration stock also means more to spend on).
- Engine rule change: greenfield rules (declare and regenerate only the moved economy fixtures; the bot plays the new prices). Outside v2.2 (engine untouched this milestone) unless the user pulls it in.
