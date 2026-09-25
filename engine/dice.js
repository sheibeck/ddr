// engine/dice.js
//
// The ONLY place a dice-notation object ({n, sides, bonus}) becomes a
// number. Content tables (content/*.js) hold plain dice-notation data —
// never a closure like the prototype's `d: () => D(6)` — and the engine
// resolves it here via the injected, seeded rng.

/**
 * rollDice(rng, { n, sides, bonus }) — sums `n` independent rng.d(sides)
 * rolls plus a flat `bonus`.
 *
 * @param {{ d: (sides: number) => number }} rng - an engine RNG (see makeRng)
 * @param {{ n: number, sides: number, bonus?: number }} notation
 * @returns {number}
 */
export function rollDice(rng, { n, sides, bonus }) {
  let total = bonus || 0;
  for (let i = 0; i < n; i++) total += rng.d(sides);
  return total;
}

/**
 * isBestFace(roll, dieN) — the best face of an N-sided die for the ROLLER.
 * Today's roll-under engine: a natural 1. Phase 73 (the roll-high mirror)
 * redefines it as `roll === dieN`; `dieN` is taken now so that stays a
 * one-line change. No rng.
 *
 * @param {number} roll
 * @param {number} dieN
 * @returns {boolean}
 */
export function isBestFace(roll, dieN) {
  return roll === 1;
}
