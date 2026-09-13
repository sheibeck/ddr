# Proposed Milestone: "Economy & Item Balancing"

**Captured:** 2026-09-09 (from user via /gsd-next, then reframed from a single phase to a milestone)
**Status:** PROPOSED — to be stood up via `/gsd-new-milestone` after the 04.1 device UAT + the in-flight rules-text-audit quick task land.
**Open sequencing question:** run this milestone BEFORE the Play launch (current v1.0 Phase 6) as pre-launch depth, or as a post-launch v1.1? (User to decide at milestone-creation time.)

## Vision

Turn the loot/economy loop into a real system with meaningful carry constraints, inventory decisions, a sell economy, and balanced numbers. Builds directly on Phase 04.1 (rations became their own resource; store/food decoupled).

## Scope (candidate phases — to be broken down by /gsd-new-milestone)

### 1. Bags & carry capacity
- Every character **starts with a bag**. Convert the **rulebook p.9 bag table** into per-bag capacities for three axes: **item slots**, **wilmst (gold) cap**, and **rations (food) cap**.
- Bag size determines all three caps. Item-slot counts to be re-scaled to something like **~4 / 6 / 8 / 10** (final numbers TBD during balancing).
- **Every item takes up a slot** in the bag.

### 2. Inventory management (take / keep-drop / manual equip)
- **Replace the current "auto-take the best item and drop the rest" behavior** with player choice throughout:
  - On a find, **choose whether to take the item** at all (not auto-grabbed).
  - When the bag is full, **choose which to keep and which to drop**.
  - **Manually equip items from your bag** onto the character — including deliberately **wearing gear that is INFERIOR to what you have on** (the player's call, not the engine's).
  - **Cannot equip items you can't use** (class/subclass/race restrictions stay enforced — e.g. Pilfer's magic-item limits, armor tier caps).
- New engine actions (take / drop / equip / unequip, all pure) + inventory UI. This is a behavior change from the prototype's auto-optimize; log as a deliberate rules change.

### 3. Store sells all gear
- **Any** carried item can be **sold** at a store, so the store UI must **list all your gear** (not just buyable stock) with sell prices. New sell action + store UI section.
- (Overlaps the in-flight quick-task item **E2 "surface combat-usable items"** and the Phase-04.1 store work — coordinate so we don't build the store UI twice.)

### 4. Item review & rebalance
- **Full pass over every item**: what it does, whether it's wired (cross-ref the 04.1 audit — e.g. the inert `eff.fly` flight items), its value/effect, and its cost.
- Fix/retire items that don't work or don't earn their slot.

### 5. Economy cost balancing
- Go over **all costs** (item prices, store buy/sell spreads, rations price from 04.1, repair costs, wilmst rewards) so the **find → carry → sell → buy** loop is fair and neither trivial nor grindy. Likely needs a headless tuning harness like Phase 3 used for difficulty.
- **Wilmst reward retune — known-too-generous rewards to cut down:**
  - The **Table-Four `+3000 WM` encounter** (`engine/encounters.js:247` / `content/encounters.js:12` row) is far too much wilmst for a single red-dot pull (user report, 2026-09-09). Scale it to the tuned economy (likely depth-scaled and an order of magnitude lower). *(Phase 04.2's Text batch only fixes its garbled DISPLAY / "(tableFour)" leak — the AMOUNT is this milestone's job; see EXTRA-SCOPE E10.)*
  - While here, audit the other flat/large wilmst grants (chest `gainWilmst` at `:136`, faerie `d10×100` at `:375`, `d10×100 WM` gift, `+150` grimoire) against the tuned curve.

## Dependencies / notes
- Depends on the deterministic engine + Phase 04.1's economy changes (rations-as-resource, store decoupling).
- The **rulebook p.9 bag table** and item tables are the primary source material (PDF at repo root; prototype is canon where they conflict).
- Save-shape impact: bag capacity + per-item slot occupancy likely add fields to `c` (carry state) — a serialization/migration concern to design carefully (like 04.1 handled `c.darkFor`).
- Keep engine pure/deterministic; UI (keep/drop, store sell list) is presentation over engine actions.
