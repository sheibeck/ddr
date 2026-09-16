// content/bags.js
//
// Carry-capacity DATA MODEL (ECON-01, Phase 12 — Economy A). Pure, JSON-
// serializable data: the four bag tiers and their caps. A character's `c.bag`
// (assigned by class at chargen, engine/character.js) names one of these keys;
// engine/derived.js's clampCarry(c) reads BAGS[c.bag] to enforce the caps.
//
// Each tier caps three resources:
//   - slots:   max `c.items.length` (equipped weapon/armor are scalar and
//              slot-free; the bag is `c.items`, which already exists).
//   - wilmst:  max `c.gold` (the game's currency is "wilmst").
//   - rations: max `c.rations`.
//
// The book's raw item column (1/2/3/4) is rescaled to 4/6/8/10 per the phase
// spec; all three numbers per tier are documented TUNING KNOBS. ECON-10
// (Phase 16, Economy E) CONFIRMED these as the v1 conservative values — none
// was obviously broken, so the Phase-12 numbers stand unchanged and final
// balance is left to on-device playtesting (the deferred deep-tune). The caps
// remain knobs: slots (max c.items.length), wilmst (max c.gold), rations (max
// c.rations). No closures — see test/determinism/content-is-pure-data.test.js.
export const BAGS = {
  small: { slots: 4, wilmst: 2000, rations: 10 },
  medium: { slots: 6, wilmst: 5000, rations: 20 },
  large: { slots: 8, wilmst: 8000, rations: 40 },
  exlarge: { slots: 10, wilmst: 10000, rations: 60 },
};

// Phase 29 (LOOT-05): bigger bags as depth-appropriate treasure. Pure data —
// see test/determinism/content-is-pure-data.test.js.
//
// BAG_ORDER — tier order, lowest first. engine/items.js#bagUpgradeTier walks
// this to find "one tier above what I carry."
export const BAG_ORDER = ["small", "medium", "large", "exlarge"];

// BAG_FLOORS — the depth floor from which each upgrade tier may turn up as a
// foe drop (never offered below it). TUNING KNOB, same status as the BAGS
// caps above.
export const BAG_FLOORS = { medium: 2, large: 5, exlarge: 9 };

// BAG_DROP_UNDER — on a successful treasure drop at or past a tier's floor,
// one extra d20 at or under this value swaps the rolled item for the bag
// instead (engine/combat.js#killFoe, Plan 02). TUNING KNOB.
export const BAG_DROP_UNDER = 3;

// BAG_ITEMS — the takeable `kind:"bag"` item for each upgrade tier. Slot
// counts intentionally mirror BAGS[tier].slots (asserted in
// test/unit/bag-cap-gate.test.js by deriving from BAGS, not duplicated as a
// literal here).
export const BAG_ITEMS = {
  medium: { kind: "bag", tier: "medium", n: "Medium bag", txt: "6 slots. Room to regret more things." },
  large: { kind: "bag", tier: "large", n: "Large bag", txt: "8 slots. Your spine has filed a complaint." },
  exlarge: { kind: "bag", tier: "exlarge", n: "Enormous bag", txt: "10 slots. Technically luggage." },
};
