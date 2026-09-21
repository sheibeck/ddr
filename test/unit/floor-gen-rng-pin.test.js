// test/unit/floor-gen-rng-pin.test.js
//
// Phase 41 (TERR-01, Plan 01, Task 1) — the phase's proof that water
// placement never moves the main seeded rng cursor. This file is committed
// FIRST, before ANY engine edit lands — it pins genFloor's per-(seed,depth)
// main-rng draw count and post-generation cursor, plus newRun(seed).rngState,
// measured at HEAD before Task 2 adds placeWater. If a change to
// engine/maze.js#genFloor ever moves ANY number below, that is a main-rng
// draw-order regression — never silently re-pin; the 2026-09-17 greenfield
// ruling requires water to draw from a DERIVED stream
// (`derivedRng(rng.getState(), "terrain", depth)`), read AFTER every existing
// draw, so this file staying green through Task 2 is the mechanical proof
// that ruling was honored.
//
// Three tests:
//   A. genFloor(depth, countingRng(makeRng(seed))) draws exactly the pinned
//      number of main-rng values and leaves the cursor at the pinned state,
//      for every (seed, depth) pair in FLOOR_GEN_PIN.
//   B. newRun(seed).rngState matches NEWRUN_PIN for every seed — deliberately
//      redundant with test/unit/chargen-rng-pin.test.js so the two pins fail
//      together, loudly, if a main draw ever slips into floor generation.
//   C. derivedRng(cursor, "terrain", depth) is a pure function of its key:
//      the same (cursor, depth) always yields the same first draw, and a
//      different depth yields a different one (for every sample cursor
//      tried) — this pins the key SHAPE Task 2's placeWater call must use.

import test from "node:test";
import assert from "node:assert/strict";

import { genFloor } from "../../engine/maze.js";
import { makeRng, derivedRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";

/** countingRng(inner) — modelled on test/unit/chargen-rng-pin.test.js's own
 * wrapper: counts every draw-producing call (d()/pick()/next() as 1 draw
 * each, shuffle(a) as max(0, a.length - 1) draws, matching engine/rng.js's
 * Fisher-Yates loop) and forwards to `inner`. getState/setState delegate
 * straight through — MANDATORY: genFloor reads `rng.getState()` after Task 2
 * lands (derivedRng(rng.getState(), "terrain", dc.depth)), and a wrapper
 * missing this passthrough would be a TEST bug, not an engine bug. */
function countingRng(inner) {
  let draws = 0;
  return {
    next() {
      draws++;
      return inner.next();
    },
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    getState: () => inner.getState(),
    setState: (s) => inner.setState(s),
    get draws() {
      return draws;
    },
  };
}

const SEEDS = [1, 2, 3, 7, 8, 14, 17, 38, 127, 160, 256, 303, 1119, 2026];
const DEPTHS = [1, 2, 3, 5, 6, 10, 20];

// Measured at 562811f (2026-09-18), on the untouched pre-Phase-41 engine, via
// a one-off scratch script (never committed) that ran
// `genFloor(depth, countingRng(makeRng(seed)))` for every (seed, depth) pair
// below and recorded `{ draws, stateAfter: rng.getState() }`. 14 seeds x 7
// depths = 98 entries.
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D): re-measured live against
// the identity-commit engine — ENCOUNTER_DOT_CAP is retired (ENCOUNTER_DOTS
// is now uncapped, `9 + depth`, matching genFloor's own placement target
// exactly). Only every ":3" entry moves (depth 3's dots target 11 -> 12,
// one more dot placed); every other depth's PLACED count was already
// grid-capacity-bounded at the same value the old soft-cap asymptote
// produced, so this table is otherwise byte-identical to the pre-Phase-54
// pins above.
const FLOOR_GEN_PIN = {
  "1:1": { draws: 425, stateAfter: 1026389950 },
  "1:2": { draws: 426, stateAfter: -1437011533 },
  "1:3": { draws: 427, stateAfter: 394554280 },
  "1:5": { draws: 428, stateAfter: -2068847203 },
  "1:6": { draws: 425, stateAfter: 1026389950 },
  "1:10": { draws: 428, stateAfter: -2068847203 },
  "1:20": { draws: 428, stateAfter: -2068847203 },
  "2:1": { draws: 422, stateAfter: -173340192 },
  "2:2": { draws: 423, stateAfter: 1658225621 },
  "2:3": { draws: 424, stateAfter: -805175862 },
  "2:5": { draws: 425, stateAfter: 1026389951 },
  "2:6": { draws: 422, stateAfter: -173340192 },
  "2:10": { draws: 425, stateAfter: 1026389951 },
  "2:20": { draws: 425, stateAfter: 1026389951 },
  "3:1": { draws: 427, stateAfter: 394554282 },
  "3:2": { draws: 428, stateAfter: -2068847201 },
  "3:3": { draws: 429, stateAfter: -237281388 },
  "3:5": { draws: 430, stateAfter: 1594284425 },
  "3:6": { draws: 427, stateAfter: 394554282 },
  "3:10": { draws: 430, stateAfter: 1594284425 },
  "3:20": { draws: 430, stateAfter: 1594284425 },
  "7:1": { draws: 426, stateAfter: -1437011527 },
  "7:2": { draws: 427, stateAfter: 394554286 },
  "7:3": { draws: 428, stateAfter: -2068847197 },
  "7:5": { draws: 429, stateAfter: -237281384 },
  "7:6": { draws: 426, stateAfter: -1437011527 },
  "7:10": { draws: 429, stateAfter: -237281384 },
  "7:20": { draws: 429, stateAfter: -237281384 },
  "8:1": { draws: 424, stateAfter: -805175856 },
  "8:2": { draws: 425, stateAfter: 1026389957 },
  "8:3": { draws: 426, stateAfter: -1437011526 },
  "8:5": { draws: 427, stateAfter: 394554287 },
  "8:6": { draws: 424, stateAfter: -805175856 },
  "8:10": { draws: 427, stateAfter: 394554287 },
  "8:20": { draws: 427, stateAfter: 394554287 },
  "14:1": { draws: 424, stateAfter: -805175850 },
  "14:2": { draws: 425, stateAfter: 1026389963 },
  "14:3": { draws: 426, stateAfter: -1437011520 },
  "14:5": { draws: 427, stateAfter: 394554293 },
  "14:6": { draws: 424, stateAfter: -805175850 },
  "14:10": { draws: 427, stateAfter: 394554293 },
  "14:20": { draws: 427, stateAfter: 394554293 },
  "17:1": { draws: 428, stateAfter: -2068847187 },
  "17:2": { draws: 429, stateAfter: -237281374 },
  "17:3": { draws: 430, stateAfter: 1594284439 },
  "17:5": { draws: 431, stateAfter: -869117044 },
  "17:6": { draws: 428, stateAfter: -2068847187 },
  "17:10": { draws: 431, stateAfter: -869117044 },
  "17:20": { draws: 431, stateAfter: -869117044 },
  "38:1": { draws: 426, stateAfter: -1437011496 },
  "38:2": { draws: 427, stateAfter: 394554317 },
  "38:3": { draws: 428, stateAfter: -2068847166 },
  "38:5": { draws: 429, stateAfter: -237281353 },
  "38:6": { draws: 426, stateAfter: -1437011496 },
  "38:10": { draws: 429, stateAfter: -237281353 },
  "38:20": { draws: 429, stateAfter: -237281353 },
  "127:1": { draws: 427, stateAfter: 394554406 },
  "127:2": { draws: 428, stateAfter: -2068847077 },
  "127:3": { draws: 429, stateAfter: -237281264 },
  "127:5": { draws: 430, stateAfter: 1594284549 },
  "127:6": { draws: 427, stateAfter: 394554406 },
  "127:10": { draws: 430, stateAfter: 1594284549 },
  "127:20": { draws: 430, stateAfter: 1594284549 },
  "160:1": { draws: 430, stateAfter: 1594284582 },
  "160:2": { draws: 431, stateAfter: -869116901 },
  "160:3": { draws: 432, stateAfter: 962448912 },
  "160:5": { draws: 433, stateAfter: -1500952571 },
  "160:6": { draws: 430, stateAfter: 1594284582 },
  "160:10": { draws: 433, stateAfter: -1500952571 },
  "160:20": { draws: 433, stateAfter: -1500952571 },
  "256:1": { draws: 427, stateAfter: 394554535 },
  "256:2": { draws: 428, stateAfter: -2068846948 },
  "256:3": { draws: 429, stateAfter: -237281135 },
  "256:5": { draws: 430, stateAfter: 1594284678 },
  "256:6": { draws: 427, stateAfter: 394554535 },
  "256:10": { draws: 430, stateAfter: 1594284678 },
  "256:20": { draws: 430, stateAfter: 1594284678 },
  "303:1": { draws: 423, stateAfter: 1658225922 },
  "303:2": { draws: 424, stateAfter: -805175561 },
  "303:3": { draws: 425, stateAfter: 1026390252 },
  "303:5": { draws: 426, stateAfter: -1437011231 },
  "303:6": { draws: 423, stateAfter: 1658225922 },
  "303:10": { draws: 426, stateAfter: -1437011231 },
  "303:20": { draws: 426, stateAfter: -1437011231 },
  "1119:1": { draws: 429, stateAfter: -237280272 },
  "1119:2": { draws: 430, stateAfter: 1594285541 },
  "1119:3": { draws: 431, stateAfter: -869115942 },
  "1119:5": { draws: 432, stateAfter: 962449871 },
  "1119:6": { draws: 429, stateAfter: -237280272 },
  "1119:10": { draws: 432, stateAfter: 962449871 },
  "1119:20": { draws: 432, stateAfter: 962449871 },
  "2026:1": { draws: 432, stateAfter: 962450778 },
  "2026:2": { draws: 433, stateAfter: -1500950705 },
  "2026:3": { draws: 434, stateAfter: 330615108 },
  "2026:5": { draws: 435, stateAfter: -2132786375 },
  "2026:6": { draws: 432, stateAfter: 962450778 },
  "2026:10": { draws: 435, stateAfter: -2132786375 },
  "2026:20": { draws: 435, stateAfter: -2132786375 },

};

// Measured at the same commit/date as FLOOR_GEN_PIN above, via
// `newRun(seed).rngState` on the same untouched engine. Deliberately
// redundant with test/unit/chargen-rng-pin.test.js's own NEW_RUN_PINS (this
// file's ten shared seeds — 1, 2, 3, 7, 8, 14, 17, 38, 256, 303 — match that
// pin exactly) so the two pins fail together, loudly, if a main draw ever
// slips into floor generation.
const NEWRUN_PIN = {
  1: -1692776321, 2: 266671887, 3: 1466402031, 7: 514860380, 8: 74848302,
  14: 2034296515, 17: 1466402045, 38: -996999417, 127: 1778531840, 160: -1564893768,
  256: 2098237954, 303: -429104679, 1119: 2034297620, 2026: -996997429,
};

// measured at 562811f (2026-09-18) — see FLOOR_GEN_PIN's own comment above.

test("genFloor draws exactly the pinned number of main-rng values and leaves the cursor at the pinned state, per (seed, depth)", () => {
  for (const seed of SEEDS) {
    for (const depth of DEPTHS) {
      const rng = countingRng(makeRng(seed));
      genFloor(depth, rng);
      const pin = FLOOR_GEN_PIN[`${seed}:${depth}`];
      assert.ok(pin, `missing pin for seed ${seed} depth ${depth}`);
      assert.equal(
        rng.draws,
        pin.draws,
        `seed ${seed} depth ${depth}: genFloor's main-rng draw count drifted from the pinned pre-Phase-41 value — a main-rng draw-order regression, never edit this pin to make it pass`,
      );
      assert.equal(
        rng.getState(),
        pin.stateAfter,
        `seed ${seed} depth ${depth}: genFloor's post-generation main-rng cursor drifted from the pinned pre-Phase-41 value`,
      );
    }
  }
});

test("newRun(seed).rngState is unchanged for every pinned seed", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed);
    assert.equal(
      state.rngState,
      NEWRUN_PIN[seed],
      `seed ${seed}: newRun's rngState drifted from the pinned pre-Phase-41 value — this must fail together with the genFloor pin above if a main draw ever slips into floor generation`,
    );
  }
});

test("the derived terrain stream is a pure function of the cursor: same (cursor, depth) repeats identically, a different depth diverges", () => {
  const sampleCursors = [12345, 999, -1692776321, 266671887, 2098237954];
  let sawDivergence = false;
  for (const cursor of sampleCursors) {
    const a1 = derivedRng(cursor, "terrain", 3).d(100);
    const a2 = derivedRng(cursor, "terrain", 3).d(100);
    assert.equal(a1, a2, `cursor ${cursor}: derivedRng(cursor, "terrain", 3) must be a pure function of its key`);
    const b = derivedRng(cursor, "terrain", 4).d(100);
    if (a1 !== b) sawDivergence = true;
  }
  assert.ok(sawDivergence, "at least one sample cursor must show depth 3 and depth 4 draw different values");
});
