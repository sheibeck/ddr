// engine/dice.js
//
// The ONLY place a dice-notation object ({n, sides, bonus}) becomes a
// number. Content tables (content/*.js) hold plain dice-notation data —
// never a closure like the prototype's `d: () => D(6)` — and the engine
// resolves it here via the injected, seeded rng.
//
// Phase 73 (ROLL-05): this file also owns the ONE roll-high check helper
// (rollCheck, atLeastFor, rollFields) — the only place a check die is read
// roll-high. Every other engine file keeps content's numbers as counts of
// winning faces and converts them through atLeastFor before calling
// rollCheck; no engine file re-implements the mirror arithmetic.

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
  for (let i = 0; i < n; i++) total += rng.d(sides); // roll:primitive
  return total;
}

/**
 * rollCheck(rng, dieN, atLeast) — the ONE place in the engine where a check
 * die is read roll-high. Draws exactly one die in the same position the old
 * roll-under draw sat, so every seed resolves identically (Phase 73,
 * ROLL-05). The raw draw `r` is mirrored to `roll = dieN + 1 - r`, so a
 * roll of `dieN` is the best face and a roll of 1 is the worst, matching
 * "higher is better" for the roller. No clamping.
 *
 * @param {{ d: (sides: number) => number }} rng - an engine RNG
 * @param {number} dieN - sides on the check die
 * @param {number} atLeast - the lowest winning face (see atLeastFor)
 * @returns {{ roll: number, atLeast: number, dieN: number, ok: boolean }}
 */
export function rollCheck(rng, dieN, atLeast) {
  const r = rng.d(dieN); // roll:primitive
  const roll = dieN + 1 - r;
  return { roll, atLeast, dieN, ok: roll >= atLeast };
}

/**
 * atLeastFor(faces, dieN) — converts a content face count (bigger is
 * better for the roller, exactly as content and derived functions express
 * it today: class toHit 3/4/5, weapon need mods, AR, sp.toHit, lock tiers,
 * nimble, parley faces, `intel - 1` for resistance...) to the lowest
 * winning face on a dieN-sided die. 0 faces never wins (returns
 * dieN + 1); dieN or more faces always wins. No clamping by design —
 * callers may pass a negative or above-dieN atLeast straight into
 * rollCheck.
 *
 * @param {number} faces - count of winning faces
 * @param {number} dieN - sides on the check die
 * @returns {number}
 */
export function atLeastFor(faces, dieN) {
  return dieN + 1 - faces;
}

/**
 * rollFields(chk) — the triple every roll-carrying event spreads:
 * { roll, atLeast, dieN }. `ok` never goes onto an event.
 *
 * @param {{ roll: number, atLeast: number, dieN: number }} chk
 * @returns {{ roll: number, atLeast: number, dieN: number }}
 */
export function rollFields(chk) {
  return { roll: chk.roll, atLeast: chk.atLeast, dieN: chk.dieN };
}

/**
 * isBestFace(roll, dieN) — the best face of an N-sided die for the ROLLER.
 * Phase 73 (ROLL-05, the roll-high mirror): the top face of an N-sided die
 * is the roller's best face — `roll === dieN`. Every caller now passes the
 * mirrored (roll-high) `roll` a rollCheck draw produced. No rng.
 *
 * @param {number} roll
 * @param {number} dieN
 * @returns {boolean}
 */
export function isBestFace(roll, dieN) {
  return roll === dieN;
}
