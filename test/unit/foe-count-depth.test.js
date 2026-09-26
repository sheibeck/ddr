// test/unit/foe-count-depth.test.js
//
// Phase 75.3 (RULES-16, Plan 01) — "solo fights fade with depth": the count
// table and the two draws it consumes stay exactly canon; a new
// FOE_COUNT_DEPTH dial reshapes what that draw MEANS at depth, never adding
// a third draw. Floors 1-4 are today's count verbatim; floors 5-9 are solo
// only on a first d4 of 1; floors 10-19 never start a fight solo; floors 20+
// always bring at least 3 (the table's own ceiling). A wandering fight
// (which today never draws a count at all) takes the SAME depth minimum as
// its whole size.
//
// fakeRng/countingRng are copied locally (never imported from another test
// file), per this repo's established per-file-fixture convention
// (test/unit/combat-scaling.test.js's own header states the same rule).

import test from "node:test";
import assert from "node:assert/strict";
import {
  DIALS,
  FOE_COUNT_TABLE,
  foeCountFor,
  foeCountMinFor,
  setDialsForTuning,
} from "../../engine/difficulty.js";
import { startCombat } from "../../engine/combat.js";
import { BESTIARY } from "../../content/index.js";

// --- local test fixtures (mirror test/unit/combat-scaling.test.js) ---------

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow. `pick` defaults to the first element, override per-test. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/** recordingRng(seq) — like fakeRng, but also records every raw value drawn
 * (in order) on `.drawn`, so a test can assert exactly how many (and which)
 * d4 draws a call consumed without needing a separate wrapper. */
function recordingRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  const drawn = [];
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`recordingRng: sequence exhausted at index ${i}`);
      const v = seq[i++];
      drawn.push(v);
      return v;
    },
    pick,
    shuffle: (a) => a,
    drawn,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// ─── the shipped dials (FOE_COUNT_SKEW 1, FOE_COUNT_DEPTH as-shipped) ──────

test("floors 1-4 (shipped dials): foeCountFor(1, t)/foeCountFor(2, t) = 1 without calling t; foeCountFor(3, () => f) for f = 1..4 gives 1, 2, 2, 3", () => {
  for (const depth of [1, 2, 3, 4]) {
    const t = () => { throw new Error("must not draw a second d4"); };
    assert.equal(foeCountFor(1, t, depth), 1, `depth ${depth}, first 1`);
    assert.equal(foeCountFor(2, t, depth), 1, `depth ${depth}, first 2`);
    assert.deepStrictEqual(
      [1, 2, 3, 4].map((f) => foeCountFor(3, () => f, depth)),
      [1, 2, 2, 3],
      `depth ${depth}, first 3`,
    );
  }
});

test("floors 5-9 (shipped dials): foeCountFor(1, t) = 1 and foeCountFor(2, t) = 2 without calling t; foeCountFor(4, () => f) for f = 1..4 gives 2, 2, 2, 3", () => {
  for (const depth of [5, 6, 7, 8, 9]) {
    const t = () => { throw new Error("must not draw a second d4"); };
    assert.equal(foeCountFor(1, t, depth), 1, `depth ${depth}, first 1`);
    assert.equal(foeCountFor(2, t, depth), 2, `depth ${depth}, first 2`);
    assert.deepStrictEqual(
      [1, 2, 3, 4].map((f) => foeCountFor(4, () => f, depth)),
      [2, 2, 2, 3],
      `depth ${depth}, first 4`,
    );
  }
});

test("floors 10-19 (shipped dials): first 1 or 2 gives 2 without calling t; first 3 or 4 gives 2, 2, 2, 3 for f = 1..4", () => {
  for (const depth of [10, 14, 19]) {
    const t = () => { throw new Error("must not draw a second d4"); };
    assert.equal(foeCountFor(1, t, depth), 2, `depth ${depth}, first 1`);
    assert.equal(foeCountFor(2, t, depth), 2, `depth ${depth}, first 2`);
    for (const first of [3, 4]) {
      assert.deepStrictEqual(
        [1, 2, 3, 4].map((f) => foeCountFor(first, () => f, depth)),
        [2, 2, 2, 3],
        `depth ${depth}, first ${first}`,
      );
    }
  }
});

test("floors 20+ (shipped dials): every first roll and every second face gives 3; a first roll of 1 or 2 never calls t", () => {
  for (const depth of [20, 40]) {
    const t = () => { throw new Error("must not draw a second d4"); };
    assert.equal(foeCountFor(1, t, depth), 3, `depth ${depth}, first 1`);
    assert.equal(foeCountFor(2, t, depth), 3, `depth ${depth}, first 2`);
    for (const first of [3, 4]) {
      for (const second of [1, 2, 3, 4]) {
        assert.equal(foeCountFor(first, () => second, depth), 3, `depth ${depth}, first ${first}, second ${second}`);
      }
    }
  }
});

test("boundaries: (first 2) depth 4 -> 1, depth 5 -> 2; (first 1) depth 9 -> 1, depth 10 -> 2; (first 3, second 1) depth 19 -> 2, depth 20 -> 3", () => {
  assert.equal(foeCountFor(2, () => { throw new Error("no second draw"); }, 4), 1);
  assert.equal(foeCountFor(2, () => { throw new Error("no second draw"); }, 5), 2);
  assert.equal(foeCountFor(1, () => { throw new Error("no second draw"); }, 9), 1);
  assert.equal(foeCountFor(1, () => { throw new Error("no second draw"); }, 10), 2);
  assert.equal(foeCountFor(3, () => 1, 19), 2);
  assert.equal(foeCountFor(3, () => 1, 20), 3);
});

test("precision: depth 4.9 behaves as 4; depth 0, -3, NaN and Infinity behave as 1; omitting depth behaves as 1", () => {
  assert.equal(foeCountFor(2, () => { throw new Error("no second draw"); }, 4.9), 1, "4.9 floors to 4 (below the solo-only-on-one rung)");
  for (const depth of [0, -3, NaN, Infinity]) {
    assert.equal(foeCountFor(2, () => { throw new Error("no second draw"); }, depth), 1, `depth ${depth} sanitises to 1`);
  }
  assert.equal(foeCountFor(2, () => { throw new Error("no second draw"); }), 1, "omitting depth keeps today's count (defaults to 1)");
});

test("draw count: over first 1..4 x depth {1, 5, 10, 20, 40} x FOE_COUNT_SKEW 0..4, the thunk is called exactly 0 times for first <= 2 and exactly once for first > 2", () => {
  for (let skew = 0; skew <= 4; skew++) {
    const restore = setDialsForTuning({ FOE_COUNT_SKEW: skew });
    try {
      for (const depth of [1, 5, 10, 20, 40]) {
        for (const first of [1, 2, 3, 4]) {
          let drawn = 0;
          const t = () => { drawn++; return 1; };
          foeCountFor(first, t, depth);
          const expected = first > 2 ? 1 : 0;
          assert.equal(drawn, expected, `skew ${skew}, depth ${depth}, first ${first}`);
        }
      }
    } finally {
      restore();
    }
  }
});

test("foeCountMinFor(depth): 1 for depths 1-9, 2 for 10-19, 3 for 20, 21 and 40; sanitised like foeCountFor", () => {
  for (const depth of [1, 4, 5, 9]) assert.equal(foeCountMinFor(depth), 1, `depth ${depth}`);
  for (const depth of [10, 14, 19]) assert.equal(foeCountMinFor(depth), 2, `depth ${depth}`);
  for (const depth of [20, 21, 40]) assert.equal(foeCountMinFor(depth), 3, `depth ${depth}`);
  assert.equal(foeCountMinFor(0), 1);
  assert.equal(foeCountMinFor(-3), 1);
  assert.equal(foeCountMinFor(NaN), 1);
  assert.equal(foeCountMinFor(4.9), 1);
});

test("identity (FOE_COUNT_DEPTH all 0): foeCountFor at depths 5, 10, 20 and 40 equals its depth-1 result for every first/second pair, and foeCountMinFor returns 1 at every depth", () => {
  const restore = setDialsForTuning({ FOE_COUNT_DEPTH: { soloOnlyOnOneFrom: 0, atLeastTwoFrom: 0, atLeastThreeFrom: 0 } });
  try {
    for (const first of [1, 2, 3, 4]) {
      for (const second of [1, 2, 3, 4]) {
        const at1 = foeCountFor(first, () => second, 1);
        for (const depth of [5, 10, 20, 40]) {
          assert.equal(foeCountFor(first, () => second, depth), at1, `first ${first}, second ${second}, depth ${depth}`);
        }
      }
    }
    for (const depth of [1, 5, 10, 20, 40]) assert.equal(foeCountMinFor(depth), 1, `depth ${depth}`);
  } finally {
    restore();
  }
});

test("real-dial derived rates at the shipped skew: P(solo) is 62.5% on floors 1-4, 25% on 5-9, 0 on 10+ (enumerated over the 16 first/second pairs, never sampled)", () => {
  assert.equal(DIALS.FOE_COUNT_SKEW, 1, "this test's percentages assume the shipped FOE_COUNT_SKEW (1)");
  const soloRateAt = (depth) => {
    let solo = 0;
    let total = 0;
    for (const first of [1, 2, 3, 4]) {
      for (const second of [1, 2, 3, 4]) {
        total++;
        if (foeCountFor(first, () => second, depth) === 1) solo++;
      }
    }
    return (solo / total) * 100;
  };
  assert.equal(soloRateAt(1), 62.5);
  assert.equal(soloRateAt(4), 62.5);
  assert.equal(soloRateAt(5), 25);
  assert.equal(soloRateAt(9), 25);
  assert.equal(soloRateAt(10), 0);
  assert.equal(soloRateAt(20), 0);
});

// ─── Task 2: startCombat wiring ─────────────────────────────────────────────

/** startCombatFoeCount(depth, seq) — runs startCombat on a fresh Beasts
 * encounter with a recordingRng and returns { foes: state.combat.foes.length,
 * drawn: rng.drawn } so a test can assert both the resulting roster size and
 * exactly which/how-many d4 draws were consumed. */
function startCombatFoeCount(depth, seq, opts = {}) {
  const state = fixedState({ floor: { depth } });
  const rng = recordingRng(seq, opts);
  startCombat(state, false, "Beasts", rng, []);
  return { foes: state.combat.foes.length, drawn: rng.drawn.slice() };
}

test("a real startCombat with a scripted rng on a Beasts encounter builds the depth-ruled count, consuming the SAME one-or-two-d4 count draws as canon before the bleed draws", () => {
  // depth 4: first roll 2 (<=2, canon short-circuit) -> 1 foe; 1 count draw + 1 bleed draw.
  {
    const { foes, drawn } = startCombatFoeCount(4, [2, 2]);
    assert.equal(foes, 1);
    assert.deepStrictEqual(drawn, [2, 2]);
  }
  // depth 5: first roll 2 -> raised to 2 foes (solo-only-on-one is live); 1 count draw + 2 bleed draws.
  {
    const { foes, drawn } = startCombatFoeCount(5, [2, 2, 2]);
    assert.equal(foes, 2);
    assert.deepStrictEqual(drawn, [2, 2, 2]);
  }
  // depth 9: first roll 1 -> 1 foe (still solo); 1 count draw + 1 bleed draw.
  {
    const { foes, drawn } = startCombatFoeCount(9, [1, 2]);
    assert.equal(foes, 1);
    assert.deepStrictEqual(drawn, [1, 2]);
  }
  // depth 10: first roll 1 -> raised to 2 (never solo from here); 1 count draw + 2 bleed draws.
  {
    const { foes, drawn } = startCombatFoeCount(10, [1, 2, 2]);
    assert.equal(foes, 2);
    assert.deepStrictEqual(drawn, [1, 2, 2]);
  }
  // depth 20: first roll 3 (> 2) draws a second (1) -> table then raised to the floor of 3;
  // 2 count draws + 3 bleed draws.
  {
    const { foes, drawn } = startCombatFoeCount(20, [3, 1, 2, 2, 2]);
    assert.equal(foes, 3);
    assert.deepStrictEqual(drawn, [3, 1, 2, 2, 2]);
  }
});

test("a wandering startCombat consumes no count draw and builds 1 foe at depth 9, 2 at depth 10 and 3 at depth 20; its encounterStarted event lists that many foes with wandering: true", () => {
  for (const [depth, expectedCount] of [[9, 1], [10, 2], [20, 3]]) {
    const state = fixedState({ floor: { depth } });
    const rng = recordingRng([2, 2, 2]); // enough bleed draws for up to 3 foes; no count draw expected
    const events = [];
    startCombat(state, true, "Beasts", rng, events);
    assert.equal(state.combat.foes.length, expectedCount, `depth ${depth}`);
    assert.equal(rng.drawn.length, expectedCount, `depth ${depth}: no count draw, one bleed draw per foe`);
    const enc = events.find((e) => e.type === "encounterStarted");
    assert.ok(enc, `depth ${depth}: encounterStarted event missing`);
    assert.equal(enc.wandering, true, `depth ${depth}`);
    assert.equal(enc.foes.length, expectedCount, `depth ${depth}`);
  }
});

test("a Knight at depth 10 facing a drawn pair whose one foe has maxWP below 5 still routs that foe (the count governs the draw, the sub-class rule acts after it)", () => {
  const restore = setDialsForTuning({ FOE_LEVEL: { base: 2, perDepth: 0 } }); // pins the tier to BESTIARY.Beasts[1] = [Cave Bear (wp 25), Zit (wp 4)]
  try {
    let pickCount = 0;
    const pick = (arr) => arr[pickCount++ % arr.length]; // Cave Bear first, then Zit
    const state = fixedState({ c: { sub: "Knight" }, floor: { depth: 10 } });
    const rng = fakeRng([1, 2, 2], { pick }); // count: first roll 1 -> raised to 2 (depth 10 floor); two non-bleed bleed checks
    const events = [];
    startCombat(state, false, "Beasts", rng, events);
    assert.equal(state.combat.foes.length, 2, "the count still drew 2 foes before any rout");
    const zit = state.combat.foes.find((f) => f.name === "Zit");
    assert.ok(zit, "Zit (wp 4) must be among the drawn foes");
    assert.equal(zit.alive, false, "the Knight routs the sub-5-hp foe after the count, not instead of it");
    assert.ok(events.some((e) => e.type === "foeFled" && e.name === "Zit" && e.reason === "knight"));
    const caveBear = state.combat.foes.find((f) => f.name === "Cave Bear");
    assert.ok(caveBear, "Cave Bear (wp 25) must still be present and untouched by the rout");
    assert.equal(caveBear.alive, true);
  } finally {
    restore();
  }
});

test("FOE_COUNT_TABLE is unchanged by this plan (row 0 canon, non-decreasing rows)", () => {
  for (const row of FOE_COUNT_TABLE) {
    for (let i = 0; i < row.length - 1; i++) assert.ok(row[i] <= row[i + 1]);
  }
  assert.deepStrictEqual(FOE_COUNT_TABLE[0], [2, 2, 2, 3]);
});

test("BESTIARY fixtures used by this file's Knight scenario are stable (Cave Bear wp 25, Zit wp 4)", () => {
  assert.deepStrictEqual(BESTIARY.Beasts[1].map((r) => [r.n, r.wp]), [["Cave Bear", 25], ["Zit", 4]]);
});
