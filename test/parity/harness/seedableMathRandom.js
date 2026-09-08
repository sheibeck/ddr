// test/parity/harness/seedableMathRandom.js
//
// A mulberry32-backed replacement for Math.random(), for injecting into the
// node:vm sandbox that runs the frozen prototype (test/parity/prototype-master.js.txt).
//
// This deliberately duplicates the mulberry32 bit-mixing algorithm from
// engine/rng.js (mulberry32) rather than importing it, so that a faithful
// engine port and the sandboxed prototype consume the EXACT SAME roll
// sequence for a given seed: the prototype's D()/pick()/shuffle() and
// genFloor's inline Math.random() calls (mazeworld.html lines 489-490,
// 1190-1191, 1265) all read from Math.random() directly, while the engine
// reads from rng.next() via makeRng() — same algorithm, same output stream,
// different call site. Any change to engine/rng.js's mulberry32 must be
// mirrored here (or this file should import it directly) to keep parity.
//
// mulberry32 is explicitly non-cryptographic and gameplay-only.

/**
 * makeSeededMathRandom(seed) — returns a zero-argument function suitable for
 * assigning directly to a sandbox's `Math.random`, backed by mulberry32(seed).
 * Two instances constructed with the same seed produce identical sequences.
 *
 * @param {number} seed - initial 32-bit state (coerced with `>>> 0`)
 * @returns {() => number} a stateful replacement for Math.random()
 */
export function makeSeededMathRandom(seed) {
  let a = seed >>> 0;
  return function seededMathRandom() {
    // Identical bit-mixing to engine/rng.js's mulberry32(seed).next() —
    // see that file for the canonical, documented implementation.
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
