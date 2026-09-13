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
