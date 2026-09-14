// test/unit/resist-roll.test.js
//
// FOE-07 (D-07/D-17): resistRoll(rng, intel) — the ONE shared resistance
// helper homed in engine/derived.js (a cycle-free leaf), reused by both
// magic.js's castSpell (foe resists the player) and Phase 19's foe-ability
// resolver (the hero resists a foe). Pins the exact gate (intel < 12 never
// rolls, zero draws), the exact draw (exactly one d20 when intel >= 12), and
// the exact comparison (resisted iff roll < intel — a natural 1 always
// resists). Also pins toHit's D-10 dazed to-hit penalty (floored at 1).

import test from "node:test";
import assert from "node:assert/strict";

import { resistRoll, toHit } from "../../engine/derived.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow, which doubles as a "no more
 * rng draws expected" assertion (ported from
 * test/unit/foe-turn-draw-count.test.js verbatim). */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

test("resistRoll: intel below 12 never rolls (0 draws) — 11, 0, undefined, null", () => {
  for (const intel of [11, 0, undefined, null]) {
    const result = resistRoll(fakeRng([]), intel);
    assert.deepStrictEqual(result, { rolled: false, resisted: false, roll: undefined });
  }
});

test("resistRoll: intel 12 draws exactly one d20 — roll 11 resists, roll 12 does not", () => {
  const resisted = resistRoll(fakeRng([11]), 12);
  assert.deepStrictEqual(resisted, { rolled: true, resisted: true, roll: 11 });

  const notResisted = resistRoll(fakeRng([12]), 12);
  assert.deepStrictEqual(notResisted, { rolled: true, resisted: false, roll: 12 });

  // Exactly one draw: a second .d() on an rng with only one value queued throws.
  const rng = fakeRng([11]);
  resistRoll(rng, 12);
  assert.throws(() => rng.d(20));
});

test("resistRoll: intel 20 — 19 resists, 20 does not; a natural 1 always resists at any intel >= 12", () => {
  assert.equal(resistRoll(fakeRng([19]), 20).resisted, true);
  assert.equal(resistRoll(fakeRng([20]), 20).resisted, false);
  assert.equal(resistRoll(fakeRng([1]), 12).resisted, true);
  assert.equal(resistRoll(fakeRng([1]), 15).resisted, true);
});

// --- D-10: toHit's dazed to-hit penalty -------------------------------------

function daedState(cOverrides = {}) {
  return {
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human",
      skills: {}, items: [],
      ...cOverrides,
    },
    combat: null,
    floor: { g: [[{ wall: false, dark: false }]], px: 0, py: 0, depth: 1 },
  };
}

test("toHit: dazed lowers the need by 2, floored at 1; weakened does not touch it", () => {
  const fighterDazed = daedState({ foeEffect: { kind: "dazed", rounds: 2 } });
  assert.equal(toHit(fighterDazed), 3, "Fighter needs 5, dazed needs 3");

  const wizardDazed = daedState({ cls: "Magic User", sub: "Wizard", foeEffect: { kind: "dazed", rounds: 2 } });
  assert.equal(toHit(wizardDazed), 1, "Magic User needs 3, dazed needs 1 (floored, not -1)");

  const weakened = daedState({ foeEffect: { kind: "weakened", rounds: 2 } });
  assert.equal(toHit(weakened), 5, "weakened does not affect toHit");

  const expired = daedState({ foeEffect: { kind: "dazed", rounds: 0 } });
  assert.equal(toHit(expired), 5, "rounds: 0 is not live — no penalty");

  const none = daedState();
  assert.equal(toHit(none), 5, "no foeEffect key — no penalty");
});
