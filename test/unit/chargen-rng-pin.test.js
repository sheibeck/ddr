// test/unit/chargen-rng-pin.test.js
//
// FID-06 ordering proof (Phase 23, Plan 01, Task 1): pins the pre-Phase-23
// chargen rng-consumption ORDER for every parity-fixture seed and every
// Magic User sub-class's rollGrimoire draw count, measured on the engine at
// commit f344642 on 2026-09-14 — BEFORE any Phase 23 engine or content edit.
//
// This file is committed FIRST, before Task 2 touches engine/derived.js or
// adds content/spell-level-overrides.js, so its pins are a trustworthy
// "before" snapshot. Plans 02-04 (and Task 2/3 of this plan) must keep this
// file green: a change to ANY number below is a chargen rng-ORDER
// regression (FID-06), not something to "fix" by editing the pin. If a
// change is genuinely intended to shift rng order, that is an architectural
// decision (Rule 4) requiring explicit sign-off — never silently re-pin.
//
// Three tests:
//   1. rollCharacter(rng) leaves rng at a pinned cursor, per seed.
//   2. newRun(seed).rngState is separately pinned, per seed (newRun also
//      draws for floor generation after chargen, so this is a DIFFERENT
//      cursor than test 1, not a duplicate check).
//   3. rollGrimoire(rng, sub) draws a constant, pinned number of rng values
//      per sub-class — independently re-derived via the pool/low/high/spare
//      formula so the pin is provably not just "whatever the code did
//      today" but the SHAPE of the algorithm (two shuffles + one d10 + one
//      more shuffle).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollCharacter, rollGrimoire } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, CLASSES } from "../../content/index.js";
import { canLearn, schoolGate } from "../../engine/derived.js";

// The 20-seed union of every parity-fixture seed in the repo (14 chargen
// seeds from action-script.chargen.json + the other fixture seeds named in
// test/parity/FIXTURE-INVENTORY.md's roster table: 256, 14, 17, 303, 38, 160).
const SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 14, 15, 17, 19, 24, 29, 32, 35, 38, 160, 256, 303];

// --- countingRng: copied verbatim from test/determinism/forced-chargen.test.js
// (itself copied from test/unit/foe-turn-draw-count.test.js) — wraps ANY rng
// object and counts every draw-producing call: d()/pick()/next() each count
// as 1 draw; shuffle(arr) counts max(0, arr.length - 1) draws, matching
// engine/rng.js's Fisher-Yates loop.
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
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
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// Pinned via `rng.getState()` immediately after `rollCharacter(rng)`, one
// fresh `makeRng(seed)` per entry, measured on the untouched pre-Phase-23
// engine (commit f344642, 2026-09-14).
const ROLL_CHARACTER_PINS = {
  1: -2023389403, 2: -759718062, 3: 1071847752, 4: -759718060, 6: 440012085,
  7: -447588372, 8: -1015482844, 13: -2023389391, 14: -2023389390, 15: 2079754316,
  17: 1071847766, 19: 816082980, 24: 2015813128, 29: 1447918660, 32: -2023389372,
  35: 1447918666, 38: 1071847787, 160: 1071847909, 256: -759717808, 303: 1071848052,
};

// Pinned via `newRun(seed).rngState` — a DIFFERENT (larger) cursor than the
// rollCharacter-only pins above, because newRun also generates the starting
// floor (genFloor) after chargen finishes. Same seeds, same untouched engine.
const NEW_RUN_PINS = {
  1: -1692776321, 2: 266671887, 3: 1466402031, 4: 266671889, 6: 202730694,
  7: 514860380, 8: 74848302, 13: -365163772, 14: 2034296515, 15: 10907112,
  17: 1466402045, 19: -1188823027, 24: -556987352, 29: -1820658687, 32: -1692776290,
  35: 642742802, 38: -996999417, 160: -1564893768, 256: 2098237954, 303: -429104679,
};

// Pinned per-sub rollGrimoire draw counts (constant across seeds — proven by
// the sweep below), measured on the untouched engine.
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 39, Warlock: 33, Sorcerer: 35, Summoner: 31,
  Cleric: 34, Illusionist: 34, "Court Mage": 34, Apprentice: 38,
};

test("rollCharacter leaves the rng at the pinned cursor for every parity-fixture seed", () => {
  for (const seed of SEEDS) {
    const rng = makeRng(seed);
    rollCharacter(rng);
    assert.equal(
      rng.getState(),
      ROLL_CHARACTER_PINS[seed],
      `seed ${seed}: rollCharacter rng cursor drifted from the pinned pre-Phase-23 value — this is a chargen rng-ORDER regression (FID-06), never edit this pin to make it pass`,
    );
  }
});

test("newRun leaves the rng at the pinned cursor for every parity-fixture seed", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed);
    assert.equal(
      state.rngState,
      NEW_RUN_PINS[seed],
      `seed ${seed}: newRun rng cursor drifted from the pinned pre-Phase-23 value — this is a chargen rng-ORDER regression (FID-06), never edit this pin to make it pass`,
    );
  }
});

test("rollGrimoire draws a constant, pinned number of rng values per sub-class, equal to the pool-derived formula", () => {
  const subs = CLASSES["Magic User"].subs;
  for (const sub of subs) {
    // The independently-derived formula: two shuffles (low, high) + one d10
    // + one more shuffle (spare), each shuffle costing max(0, len-1) draws.
    // Phase 40 (SPELL-04): rows flagged `roll: "derived"` (content/spells.js
    // — today, only Lesser Summon) never enter these MAIN-rng shuffles —
    // engine/character.js#rollGrimoire splices them in afterward via a
    // separate derived rng stream — so the formula excludes them here; the
    // three pin tables above are otherwise unchanged.
    const pool = SPELLS.filter((sp) => canLearn(sub, sp) && sp.roll !== "derived");
    const low = pool.filter((sp) => sp.lvl <= 2).length;
    const high = pool.filter((sp) => sp.lvl > 2).length;
    const spare = pool.filter((sp) => sp.lvl === 1 && schoolGate(sub, sp.s) <= 1).length;
    const formula = Math.max(0, low - 1) + Math.max(0, high - 1) + 1 + Math.max(0, spare - 1);
    assert.equal(
      formula,
      ROLL_GRIMOIRE_DRAW_COUNTS[sub],
      `${sub}: the independently-derived draw-count formula no longer matches the pinned constant — content/spells.js or content/mu-chart.js may have shifted the pool shape`,
    );

    for (let i = 0; i < 50; i++) {
      const seed = i * 7919 + 1;
      const rng = makeRng(seed);
      const counting = countingRng(rng);
      const book = rollGrimoire(counting, sub);
      assert.equal(
        counting.draws,
        ROLL_GRIMOIRE_DRAW_COUNTS[sub],
        `${sub} seed ${seed}: rollGrimoire drew ${counting.draws} rng values, expected the pinned constant ${ROLL_GRIMOIRE_DRAW_COUNTS[sub]} — this is a chargen rng-ORDER regression (FID-06)`,
      );
      assert.equal(
        new Set(book).size,
        book.length,
        `${sub} seed ${seed}: rollGrimoire produced a duplicate spell name in the grimoire`,
      );
    }
  }
});
