// engine/rng.js
//
// Seeded, serializable PRNG for all engine randomness (ENG-02). Replaces
// mazeworld.html's `Math.random()`-based D()/pick()/shuffle() helpers with a
// deterministic mulberry32 generator whose entire state is a single 32-bit
// integer, so it can live directly on GameState and round-trip through
// JSON.stringify/JSON.parse losslessly (ENG-04).
//
// mulberry32 is explicitly non-cryptographic and gameplay-only — never use
// it for anything security-sensitive.

/**
 * mulberry32(seed) — a tiny, fast, deterministic 32-bit PRNG.
 * @param {number} seed - initial 32-bit state (coerced with `>>> 0`)
 * @returns {{ next: () => number, getState: () => number, setState: (s: number) => void }}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return {
    // returns a float in [0, 1)
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return a;
    },
    setState(s) {
      a = s >>> 0;
    },
  };
}

/**
 * makeRng(seedOrState) — the engine-facing RNG surface. Wraps mulberry32
 * with the exact roll/pick/shuffle formulas the prototype used with
 * Math.random(), so extracted rules produce identical rolls given the same
 * seed and call order.
 *
 * @param {number} seedOrState - a seed to start fresh, or a previously
 *   captured `getState()` integer to resume an exact sequence.
 */
export function makeRng(seedOrState) {
  const gen = mulberry32(seedOrState);

  return {
    next: () => gen.next(),

    // Prototype: D = n => 1 + Math.floor(Math.random() * n)
    d(sides) {
      return 1 + Math.floor(gen.next() * sides);
    },

    // Prototype: pick = a => a[Math.floor(Math.random() * a.length)]
    pick(arr) {
      return arr[Math.floor(gen.next() * arr.length)];
    },

    // Prototype (line 1265):
    // function shuffle(a){for(let i=a.length-1;i>0;i--){
    //   const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
    // }}
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(gen.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    getState: () => gen.getState(),
    setState: (s) => gen.setState(s),
  };
}

/**
 * hashString(str) — FNV-1a 32-bit hash. Deterministic, non-cryptographic
 * (same disclaimer as mulberry32 above): pure function of its input string,
 * with no dependency on iteration order or platform.
 *
 * @param {*} str - coerced with `String(str)` before hashing
 * @returns {number} a 32-bit unsigned integer in [0, 2^32)
 */
export function hashString(str) {
  const s = String(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * derivedRng(...parts) — Phase 38 (milestone-wide greenfield ruling): a
 * PURE, keyed rng stream for new rolls that must not reorder an existing
 * seeded draw sequence (the level-pool ability rolls being the first
 * consumer — see engine/character.js#rollPoolAbility). Constructed FRESH
 * per call from `hashString(parts.join(":"))`; never serialized, never
 * advances any other rng instance's cursor (in particular the run's main
 * `state.rngState`), and is itself a pure function of its key — the same
 * parts always yield the same first draw, with no shared mutable state
 * between calls.
 *
 * @param {...*} parts - joined with ":" to form the hash key
 */
export function derivedRng(...parts) {
  return makeRng(hashString(parts.join(":")));
}
