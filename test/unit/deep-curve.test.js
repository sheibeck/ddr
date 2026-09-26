// test/unit/deep-curve.test.js
//
// Phase 75.3 (RULES-17, Plan 03) — "the deep floors keep getting harder":
// FOE_HP_SCALE/FOE_HIT_SCALE each gain a second, steeper slope past floor 12
// (the knee, user-ruled 2026-09-25 — floor 13 is the first harder floor,
// the Phase 54 fit boundary), and the roster keeps escalating past the
// level-5 tier as ELITE variants of tier-5 foes (foeTierFor), never a raised
// clamp or new hand-authored foe type.
//
// Every float check below compares with `===` against the SAME expression
// the engine itself evaluates (never a rounded literal), so a genuine
// floating-point drift would fail loudly rather than silently round away.

import test from "node:test";
import assert from "node:assert/strict";
import {
  DIALS,
  setDialsForTuning,
  difficultyCurve,
  foeTierFor,
  foeWpFor,
  foeHitFor,
} from "../../engine/difficulty.js";
import { ELITE_TITLES } from "../../content/bestiary.js";
import { eliteName, startCombat, foeTurn } from "../../engine/combat.js";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── Task 1: the knee, FOE_ELITE and the tier/scaling helpers ─────────────

test("USER RULING D, RULES-17: floors 1-12 are === to today's single-slope expression (no drift, byte-identical to before this dial carried a knee)", () => {
  for (let d = 1; d <= 12; d++) {
    const curve = difficultyCurve(d);
    assert.equal(curve.foeHpScale, 0.9 + 0.015 * d, `depth ${d} foeHpScale`);
    assert.equal(curve.foeHitScale, 0.6 + 0.01 * d, `depth ${d} foeHitScale`);
  }
});

test("RULES-17: floor 13 is the first floor either scale differs from the single-slope expression — the knee join formula, computed the same way as the engine", () => {
  for (const d of [13, 20, 42]) {
    const curve = difficultyCurve(d);
    const expectedHp = 0.9 + 0.015 * 12 + 0.03 * (d - 12);
    const expectedHit = 0.6 + 0.01 * 12 + 0.02 * (d - 12);
    assert.equal(curve.foeHpScale, expectedHp, `depth ${d} foeHpScale`);
    assert.equal(curve.foeHitScale, expectedHit, `depth ${d} foeHitScale`);
    // and each differs from the (wrong) single-slope expression once d > 12
    assert.notEqual(curve.foeHpScale, 0.9 + 0.015 * d, `depth ${d} foeHpScale must have left the single slope`);
    assert.notEqual(curve.foeHitScale, 0.6 + 0.01 * d, `depth ${d} foeHitScale must have left the single slope`);
  }
});

test("RULES-17: the two branches meet exactly AT kneeDepth — no jump", () => {
  const curve = difficultyCurve(12);
  assert.equal(curve.foeHpScale, 0.9 + 0.015 * 12);
  assert.equal(curve.foeHitScale, 0.6 + 0.01 * 12);
});

test("RULES-17 identity/no-op: perDepthAfter === perDepth (setDialsForTuning) reproduces the single-slope expression at every depth 1..60, including past 12", () => {
  const restore = setDialsForTuning({
    FOE_HIT_SCALE: { base: 0.6, perDepth: 0.01, kneeDepth: 12, perDepthAfter: 0.01 },
    FOE_HP_SCALE: { base: 0.9, perDepth: 0.015, kneeDepth: 12, perDepthAfter: 0.015 },
  });
  try {
    for (let d = 1; d <= 60; d++) {
      const curve = difficultyCurve(d);
      assert.equal(curve.foeHpScale, 0.9 + 0.015 * d, `depth ${d} foeHpScale (identity perDepthAfter)`);
      assert.equal(curve.foeHitScale, 0.6 + 0.01 * d, `depth ${d} foeHitScale (identity perDepthAfter)`);
    }
  } finally {
    restore();
  }
});

test("RULES-17: a dial with no knee fields at all (HAZARD_SCALE) is unaffected by scaleField's knee branch", () => {
  for (const d of [1, 12, 13, 42]) {
    const curve = difficultyCurve(d);
    assert.equal(curve.hazardScale, DIALS.HAZARD_SCALE.base + DIALS.HAZARD_SCALE.perDepth * d, `depth ${d} hazardScale`);
  }
});

test("RULES-17: under the identity column (FOE_HIT_SCALE/FOE_HP_SCALE base 1 perDepth 0) every scale is exactly 1 at every depth, knee included", () => {
  const restore = setDialsForTuning({
    FOE_HIT_SCALE: { base: 1, perDepth: 0, kneeDepth: 12, perDepthAfter: 0 },
    FOE_HP_SCALE: { base: 1, perDepth: 0, kneeDepth: 12, perDepthAfter: 0 },
  });
  try {
    for (const d of [1, 5, 12, 13, 20, 42]) {
      const curve = difficultyCurve(d);
      assert.equal(curve.foeHitScale, 1, `depth ${d} foeHitScale`);
      assert.equal(curve.foeHpScale, 1, `depth ${d} foeHpScale`);
    }
  } finally {
    restore();
  }
});

test("foeTierFor at the shipped dials: d 1..15 is today's tier pick, rank 0 for both bled values", () => {
  for (let d = 1; d <= 15; d++) {
    for (const bled of [false, true]) {
      const { lvl, eliteRank } = foeTierFor(d, bled);
      const expectedLvl = Math.max(1, Math.min(5, difficultyCurve(d).foeLevel - (bled ? 1 : 0)));
      assert.equal(lvl, expectedLvl, `depth ${d} bled=${bled} lvl`);
      assert.equal(eliteRank, 0, `depth ${d} bled=${bled} eliteRank`);
    }
  }
});

test("foeTierFor: d16 -> {lvl 5, eliteRank 1} unbled, {lvl 5, eliteRank 0} bled; d20 -> rank 2/1; d40 -> rank 8/7 (shipped FOE_ELITE.maxRank 10)", () => {
  assert.deepStrictEqual(foeTierFor(16, false), { lvl: 5, eliteRank: 1 });
  assert.deepStrictEqual(foeTierFor(16, true), { lvl: 5, eliteRank: 0 });
  assert.deepStrictEqual(foeTierFor(20, false), { lvl: 5, eliteRank: 2 });
  assert.deepStrictEqual(foeTierFor(20, true), { lvl: 5, eliteRank: 1 });
  assert.deepStrictEqual(foeTierFor(40, false), { lvl: 5, eliteRank: 8 });
  assert.deepStrictEqual(foeTierFor(40, true), { lvl: 5, eliteRank: 7 });
});

test("foeTierFor: FOE_ELITE.maxRank 3 clamps d40's rank to 3/2 (unbled/bled)", () => {
  const restore = setDialsForTuning({ FOE_ELITE: { maxRank: 3, hpPerRank: 0.1, hitPerRank: 0.05 } });
  try {
    assert.deepStrictEqual(foeTierFor(40, false), { lvl: 5, eliteRank: 3 });
    assert.deepStrictEqual(foeTierFor(40, true), { lvl: 5, eliteRank: 2 });
  } finally {
    restore();
  }
});

test("foeTierFor: FOE_ELITE.maxRank 0 (identity, elites off) reproduces today's tier pick at d40 exactly — {lvl 5, rank 0} unbled, {lvl 4, rank 0} bled", () => {
  const restore = setDialsForTuning({ FOE_ELITE: { maxRank: 0, hpPerRank: 0, hitPerRank: 0 } });
  try {
    assert.deepStrictEqual(foeTierFor(40, false), { lvl: 5, eliteRank: 0 });
    assert.deepStrictEqual(foeTierFor(40, true), { lvl: 4, eliteRank: 0 });
  } finally {
    restore();
  }
});

test("foeWpFor/foeHitFor: rank 0 (default, or explicit) is today's value exactly; rank above 0 multiplies inside the one Math.round, floored at 1", () => {
  const curve = difficultyCurve(20);
  assert.equal(foeWpFor(20, curve), Math.max(1, Math.round(20 * curve.foeHpScale)));
  assert.equal(foeWpFor(20, curve, 0), foeWpFor(20, curve));
  assert.equal(foeWpFor(20, curve, 2), Math.max(1, Math.round(20 * curve.foeHpScale * 1.2)));
  assert.equal(foeHitFor(10, curve, 2), Math.max(1, Math.round(10 * curve.foeHitScale * 1.1)));
  assert.equal(foeWpFor(1, curve, 5), Math.max(1, Math.round(1 * curve.foeHpScale * 1.5)));
});

test("ELITE_TITLES is a frozen array of exactly the five titles, in order, each a non-empty consonant-initial string", () => {
  assert.ok(Array.isArray(ELITE_TITLES));
  assert.equal(Object.isFrozen(ELITE_TITLES), true);
  assert.deepStrictEqual(ELITE_TITLES, ["Dread", "Grim", "Dire", "Very Dire", "Unreasonably Dire"]);
  for (const t of ELITE_TITLES) {
    assert.ok(typeof t === "string" && t.length > 0, `title "${t}" must be a non-empty string`);
  }
  // "cut down by a <title> <foe>" must always read "a", never "an" — every
  // title's FIRST WORD starts with a true consonant sound (never a vowel
  // letter that reads as a vowel SOUND; "Unreasonably" starts with a
  // consonant SOUND — "yoo" — the same reason "a university" is correct).
  for (const t of ["Dread", "Grim", "Dire", "Very"]) assert.ok(!/^[AEIOUaeiou]/.test(t), `"${t}" must not start with a vowel letter`);
});

// ─── Task 2: elite foes in startCombat, the three hit sites, foe details ──

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow. `pick` defaults to the first element, override per-test.
 * Mirrors test/unit/combat-scaling.test.js's own local fixture. */
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

function fixedState(overrides = {}) {
  return {
    c: { name: "Test Delver", level: 1, sub: null, race: "Human", cls: "Fighter", wp: 55, maxWP: 55, timers: {}, ...overrides.c },
    floor: { depth: 1, ...overrides.floor },
    combat: overrides.combat,
    party: [],
  };
}

// depth 20 is past FOE_COUNT_DEPTH.atLeastThreeFrom (RULES-16) — a fight
// there always brings at least 3 foes, so the count draws (firstRoll 3,
// second-draw 2 -> FOE_COUNT_TABLE[1][1] = 2, floored up to 3 by
// foeCountMinFor(20)) plus 3 tier-bleed draws (one per foe) is 5 total d4s.

test("startCombat at depth 20 with a bleed that does NOT fire: foe.lvl 5, foe.elite 2, name starts 'Grim ', wp === foeWpFor(row.wp, curve, 2)", () => {
  const state = fixedState({ floor: { depth: 20 } });
  // each foe's own tier-bleed d4 rolls a 4 (a miss under tierSpreadFor()'s
  // shipped value 1, since atLeastFor(1,4) needs the TOP face) -> bled =
  // false for all 3 foes.
  const rng = fakeRng([3, 2, 4, 4, 4]);
  const events = [];
  startCombat(state, false, "Humans", rng, events);
  assert.equal(state.combat.foes.length, 3);
  for (const f of state.combat.foes) {
    assert.equal(f.lvl, 5);
    assert.equal(f.elite, 2);
    assert.ok(f.name.startsWith("Grim "), f.name);
  }
});

test("startCombat at depth 20 with a bleed that DOES fire: foe.elite 1, name starts 'Dread '", () => {
  const state = fixedState({ floor: { depth: 20 } });
  // each tier-bleed d4 rolls a 1 (a hit under atLeastFor(1,4) — the top
  // face) -> bled = true for all 3 foes.
  const rng = fakeRng([3, 2, 1, 1, 1]);
  const events = [];
  startCombat(state, false, "Humans", rng, events);
  assert.equal(state.combat.foes.length, 3);
  for (const f of state.combat.foes) {
    assert.equal(f.lvl, 5);
    assert.equal(f.elite, 1);
    assert.ok(f.name.startsWith("Dread "), f.name);
  }
});

test("startCombat at depth 15: no foe carries an `elite` key and names are plain (below the first elite floor)", () => {
  const state = fixedState({ floor: { depth: 15 } });
  const rng = fakeRng([3, 2, 4, 4]);
  const events = [];
  startCombat(state, false, "Humans", rng, events);
  for (const f of state.combat.foes) {
    assert.equal("elite" in f, false);
    assert.equal(f.name.includes("Dread") || f.name.includes("Grim") || f.name.includes("Dire"), false, f.name);
  }
});

test("startCombat: the per-foe draw shape is identical at depths 15, 16 and 20 — exactly one bleed d4 and one pick per foe, however many foes the depth's own count floor brings", () => {
  function countingRng(base) {
    let draws = 0;
    return {
      d(sides) { draws++; return base.d(sides); },
      pick(arr) { draws++; return base.pick(arr); },
      shuffle: base.shuffle,
      get draws() { return draws; },
    };
  }
  const seq = [3, 2, 4, 4, 4, 4, 4]; // extra trailing 4s cover depth 20's 3rd foe
  for (const depth of [15, 16, 20]) {
    const state = fixedState({ floor: { depth } });
    const rng = countingRng(fakeRng(seq));
    startCombat(state, false, "Humans", rng, []);
    const n = state.combat.foes.length;
    assert.equal(rng.draws, 2 + 2 * n, `depth ${depth}: 2 count d4s + (1 bleed d4 + 1 pick) per foe (n=${n})`);
  }
});

test("encounterStarted's foes carry `elite` only for elites", () => {
  const state = fixedState({ floor: { depth: 20 } });
  const rng = fakeRng([3, 2, 4, 4, 4]);
  const events = [];
  startCombat(state, false, "Humans", rng, events);
  const started = events.find((e) => e.type === "encounterStarted");
  for (const f of started.foes) assert.equal("elite" in f, true, JSON.stringify(f));

  const state15 = fixedState({ floor: { depth: 15 } });
  const rng15 = fakeRng([3, 2, 4, 4]);
  const events15 = [];
  startCombat(state15, false, "Humans", rng15, events15);
  const started15 = events15.find((e) => e.type === "encounterStarted");
  for (const f of started15.foes) assert.equal("elite" in f, false, JSON.stringify(f));
});

test("eliteName(name, rank): rank 0 returns the name unchanged; ranks 1..5 give the five titles; rank 9 gives 'Unreasonably Dire Vampire'", () => {
  assert.equal(eliteName("Vampire", 0), "Vampire");
  const titles = ["Dread", "Grim", "Dire", "Very Dire", "Unreasonably Dire"];
  for (let rank = 1; rank <= 5; rank++) assert.equal(eliteName("Vampire", rank), `${titles[rank - 1]} Vampire`);
  assert.equal(eliteName("Vampire", 9), "Unreasonably Dire Vampire");
});

test("foeTurn: a rank-2 elite's hero-branch and member-branch swing damage is foeHitFor(base + dice, curve, 2), before ROUND_DAMAGE_CEILING", () => {
  const foe = { name: "Grim Test", type: "Beasts", lvl: 5, elite: 2, size: "S", intel: 1, wp: 1000, maxWP: 1000, alive: true, asleep: 0, sp: {}, lives: 1 };
  const state = fixedState({ floor: { depth: 20 }, combat: { foes: [foe], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false } });
  const rng = fakeRng([3, 4]); // to-hit roll 3 -> mirrored to 21-3=18 (a hit), dmg die 4
  const events = foeTurn(state, rng, []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.ok(struck);
});

test("pursuitStrike (module-private) scales the SAME way as the two exported hit sites: its own source passes the pursuer's elite rank as foeHitFor's third argument", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine/combat.js"), "utf8");
  const body = src.slice(src.indexOf("function pursuitStrike"), src.indexOf("\n}\n", src.indexOf("function pursuitStrike")));
  assert.ok(body.includes("pursuer.elite || 0"), "pursuitStrike must scale its hit by the pursuer's own elite rank");
});
