---
created: 2026-09-29T01:06:29.307Z
title: Stores stock up to d10 rations
area: engine
resolves_phase: 87
files:
  - engine/economy.js:452
  - engine/economy.js:232
  - engine/economy.js:210
---

## Problem

(User, 2026-09-28.) "Stores should stock more than just 1 ration. They should stock up to d10 rations."

Today every store has exactly one Rations line, `add("Rations (+1 ration)", priceFor(RATIONS_BASE_PRICE, race, c.sub), "buyRations", { amount: 1 })` (engine/economy.js:452), and a store row sells once, so a store visit buys at most one ration (the Phase 82 DAYS-farming hoarder hit exactly this limit: "the engine sells each store's Rations line once, so that is at most one ration per store visit").

## Solution

TBD at planning — outline:
- Each store rolls its ration stock (1–10, a d10) when it opens; the player can buy rations one at a time (or pick a count) until that stock is gone. Price per ration unchanged (RATIONS_BASE_PRICE 30, race/sub adjusted).
- Engine rule change → greenfield rules: the d10 comes from a derived rng stream (`makeRng(hash(seed, "storeRations", …))`) so floor generation and other store rolls don't reorder; declare and regenerate only the fixtures it moves (economy/store fixtures); new serialized field (stock count) carved out of the comparables; the bot's `chooseStorePurchase` buys the new way; every new event gets an EVENT_NARRATION entry.
- Store screen (src/browser/storeScreen.js) shows the remaining count (e.g. "Rations · 7 left").
- Balance: more food means longer runs and more DAYS. Phase 82's per-floor DAYS cap (daysKey = min(day, 10 × floor)) already stops floor-1 farming from topping the DAYS board, but the milestone-end bot readout should re-measure starvation deaths after this lands (bots only at milestone end).
- Not part of v2.2 (engine untouched this milestone) unless the user pulls it in.

## Resolution (Phase 87, 2026-09-30)
Closed by v2.3 Phase 87 (STORE-04, plans 87-02 and 87-03): each store rolls 1-10 rations on the derived "storeRations" stream when it opens, sells one per tap until the count is spent, shows "N left" on the Rations row, refuses a buy at the pack cap before any gold moves, and keeps the count through save and load. The fair bot tops up to three days of party ration upkeep; the DAYS-farm hoarder buys one per purchase to its cap. Device checks are in 87-VERIFICATION.md.
