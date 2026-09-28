// test/unit/resist-roll.test.js
//
// FOE-07 (D-07/D-17): resistRoll(rng, intel) — the ONE shared resistance
// helper homed in engine/derived.js (a cycle-free leaf), used by both sides
// again since quick 260928-hrs: a foe resisting a spell cast on it (through
// foeSpellResistCheck's derived stream) and the hero resisting a foe's spell
// or ability (foeAbilities.js, the main rng). Pins the draw (exactly one d20,
// every intel) and the half-intel comparison. Also pins toHit's D-10 dazed
// to-hit penalty (floored at 1).
//
// Phase 73 (ROLL-05): resistRoll reads its d20 roll-high through rollCheck —
// the `roll` FIELD on the returned object is the mirrored face (`21 - raw`
// for the raw draw fed to fakeRng), and the object carries the
// `atLeast`/`dieN` triple (plus `faces`).

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

// Quick 260928-hrs (user ruling 2026-09-28, "Use the same half-intel scale
// for heroes now"): canon p.25's gate (intel >= 12) and its `intel - 1`
// faces are retired. Every resistor rolls exactly one d20 and resists on the
// top max(1, round(intel / 2)) faces — the scale a foe already resisted the
// hero's spells on (quick 260927-rsx).

test("resistRoll: every intel rolls exactly one d20 — 11, 0, undefined and null included (no intel-12 gate)", () => {
  for (const intel of [11, 0, undefined, null, 1]) {
    const rng = fakeRng([1]);
    const result = resistRoll(rng, intel);
    assert.equal(result.rolled, true, `intel ${intel}`);
    assert.equal(result.resisted, true, `intel ${intel}: the top face always resists`);
    assert.throws(() => rng.d(20), /exhausted/, `intel ${intel}: exactly one draw`);
  }
  // A missing intel reads the one-face floor (5%): only the top face resists.
  assert.equal(resistRoll(fakeRng([2]), undefined).resisted, false);
});

test("resistRoll: intel 12 resists on 15–20 (6 faces) — raw 6 resists (mirrored roll 15), raw 7 does not (mirrored roll 14)", () => {
  const resisted = resistRoll(fakeRng([6]), 12);
  assert.deepStrictEqual(resisted, { rolled: true, resisted: true, roll: 15, atLeast: 15, dieN: 20, faces: 6 });

  const notResisted = resistRoll(fakeRng([7]), 12);
  assert.deepStrictEqual(notResisted, { rolled: true, resisted: false, roll: 14, atLeast: 15, dieN: 20, faces: 6 });
});

test("resistRoll: intel 20 resists on 11–20 (50%), intel 18 on 12–20 (45%); a raw natural 1 is the top face and always resists", () => {
  assert.equal(resistRoll(fakeRng([10]), 20).resisted, true);
  assert.equal(resistRoll(fakeRng([11]), 20).resisted, false);
  assert.equal(resistRoll(fakeRng([9]), 18).resisted, true);
  assert.equal(resistRoll(fakeRng([10]), 18).resisted, false);
  // a raw natural 1 mirrors to the die's TOP face (20) — the best possible
  // roll-high face, which always clears any atLeast on a d20.
  assert.equal(resistRoll(fakeRng([1]), 12).roll, 20);
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
