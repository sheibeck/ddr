// test/unit/hp-growth-linear.test.js
//
// Phase 75, Plan 02 — RULES-01 ("verify, then pin"): the Table-4 ±HP dots
// (and every other +HP source this domain touches: the faerie's base-HP
// rows, a level-up gain, Strength's temporary boost) grow the hero's maxWP
// LINEARLY — a flat, canon amount scaled once by HERO_HP_SCALE — never a
// fraction of the hero's OWN current maxWP fed back into itself (which is
// what compounded before Phase 54, USER RULING G: see engine/difficulty.js's
// DOT_HP_BASE JSDoc for the retired ×1.6-per-pull history).
//
// VERIFY VERDICT (measured against master before this plan touched any
// engine file): every pin below passes unmodified. engine/encounters.js's
// "+25 HP" row already reads `c.maxWP += dotHpFor("large")` (a flat value
// that never reads c.maxWP itself); engine/difficulty.js#dotHpFor already
// scales DOT_HP_BASE's flat table ONCE by HERO_HP_SCALE. RULES-01 is
// VERIFIED, not fixed — this file is the regression pin the plan asked for,
// not evidence of a repair. See the Plan 02 SUMMARY for the full verdict.
//
// Uses the same fakeRng/fixedState/fixedFighter local-helper convention as
// test/unit/encounters.test.js (copied here, not imported, per that file's
// own header rationale: each test file owns its own small fixtures).

import test from "node:test";
import assert from "node:assert/strict";

import { tableFour, meetFaerie } from "../../engine/encounters.js";
import { checkLevel } from "../../engine/character.js";
import { castSpell } from "../../engine/magic.js";
import { newDay } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { dotHpFor, setDialsForTuning } from "../../engine/difficulty.js";
import { THRESHOLDS, SPELLS } from "../../content/index.js";
import { setIdentityDials, withIdentity } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's identity-dial pins are canon-mechanic numbers, so it runs
// under an explicit identity override by default (test/unit/harness/
// identityDials.js), same discipline as test/unit/encounters.test.js. The
// shipped-dial cases below switch to the fitted DIALS with
// `setDialsForTuning({})` inside a try/finally that restores identity.
setIdentityDials();

const STRENGTH_IDX = SPELLS.findIndex((sp) => sp.n === "Strength");
assert.ok(STRENGTH_IDX >= 0, "content/spells.js must still carry a 'Strength' (might) spell");

/** fakeRng(seq) — `.d()`/`.pick()` pop the next value off `seq` (ignoring the
 * requested side count / array); `.shuffle()` is a no-op by default. Throws
 * if the sequence underflows, doubling as a "no more draws expected"
 * assertion — mirrors test/unit/encounters.test.js's helper. */
function fakeRng(seq, { pick } = {}) {
  let i = 0;
  const next = () => {
    if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    return seq[i++];
  };
  return {
    d: (_sides) => next(),
    pick: pick || ((arr) => arr[0]),
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Guard", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    strengthBoost: 0, regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  g[5][5] = { wall: false, seen: true, feat: null };
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** castStrength(state, dieValue) — a scroll-shaped cast (bypasses the
 * grimoire/school gate exactly like readScroll does, per engine/magic.js's
 * own `c.scrollCast` comment) so a plain Fighter fixture can exercise the
 * `sp.kind === "might"` branch directly — the SAME branch a real Magic
 * User's Strength cast runs. */
function castStrength(state, dieValue, events = []) {
  state.c.scrollCast = true;
  castSpell(state, STRENGTH_IDX, fakeRng([dieValue]), events);
  state.c.scrollCast = false;
  return events;
}

// --- boundary: 0/1/2/3 "+25 HP" pulls, identity and shipped ---------------

test("RULES-01 boundary: 0/1/2/3 '+25 HP' pulls add exactly 0/1/2/3 flat steps at identity (step = dotHpFor('large') = 25)", () => {
  const expectedByCount = [40, 65, 90, 115];
  for (let n = 0; n <= 3; n++) {
    const state = fixedState({ c: { maxWP: 40, wp: 40 } });
    for (let i = 0; i < n; i++) tableFour(state, "+25 HP", fakeRng([]), []);
    assert.equal(state.c.maxWP, expectedByCount[n], `${n} pulls at identity`);
  }
});

test("RULES-01 boundary: 0/1/2/3 '+25 HP' pulls add exactly 0/1/2/3 flat steps at shipped dials (step = dotHpFor('large') = 31)", () => {
  setDialsForTuning({});
  try {
    const expectedByCount = [40, 71, 102, 133];
    for (let n = 0; n <= 3; n++) {
      const state = fixedState({ c: { maxWP: 40, wp: 40 } });
      for (let i = 0; i < n; i++) tableFour(state, "+25 HP", fakeRng([]), []);
      assert.equal(state.c.maxWP, expectedByCount[n], `${n} pulls at shipped dials`);
    }
  } finally {
    setIdentityDials();
  }
});

// --- pool-independence: the toll never reads the hero's own maxWP ---------

test("RULES-01 pool-independence: the toll ('-15 HP', dotHpFor('mid')) removes the same flat amount whatever the hero's maxWP, at identity and shipped dials", () => {
  const small = fixedState({ c: { wp: 40, maxWP: 40 } });
  tableFour(small, "-15 HP", fakeRng([]), []);
  assert.equal(small.c.wp, 40 - 15, "a 40-maxWP hero loses exactly 15 at identity");

  const large = fixedState({ c: { wp: 392, maxWP: 392 } });
  tableFour(large, "-15 HP", fakeRng([]), []);
  assert.equal(large.c.wp, 392 - 15, "a 392-maxWP hero loses exactly 15 at identity — no share of the inflated pool");

  setDialsForTuning({});
  try {
    const smallShip = fixedState({ c: { wp: 40, maxWP: 40 } });
    tableFour(smallShip, "-15 HP", fakeRng([]), []);
    assert.equal(smallShip.c.wp, 40 - 19, "a 40-maxWP hero loses exactly 19 at shipped dials");

    const largeShip = fixedState({ c: { wp: 392, maxWP: 392 } });
    tableFour(largeShip, "-15 HP", fakeRng([]), []);
    assert.equal(largeShip.c.wp, 392 - 19, "a 392-maxWP hero loses exactly 19 at shipped dials");
  } finally {
    setIdentityDials();
  }
});

// --- ordering: a pull then a toll, and a toll then a pull, agree ----------

test("RULES-01 ordering: pull-then-toll and toll-then-pull leave the same maxWP and wp", () => {
  const pullThenToll = fixedState({ c: { wp: 30, maxWP: 40 } });
  tableFour(pullThenToll, "+25 HP", fakeRng([]), []);
  tableFour(pullThenToll, "-15 HP", fakeRng([]), []);

  const tollThenPull = fixedState({ c: { wp: 30, maxWP: 40 } });
  tableFour(tollThenPull, "-15 HP", fakeRng([]), []);
  tableFour(tollThenPull, "+25 HP", fakeRng([]), []);

  assert.equal(pullThenToll.c.maxWP, tollThenPull.c.maxWP, "maxWP agrees regardless of order");
  assert.equal(pullThenToll.c.wp, tollThenPull.c.wp, "wp agrees regardless of order");
});

// --- adjacency: two consecutive pulls sum exactly --------------------------

test("RULES-01 adjacency: two '+25 HP' pulls in consecutive actions sum exactly (2x the flat step, no feedback)", () => {
  const state = fixedState({ c: { wp: 40, maxWP: 40 } });
  tableFour(state, "+25 HP", fakeRng([]), []);
  tableFour(state, "+25 HP", fakeRng([]), []);
  assert.equal(state.c.maxWP, 40 + 2 * 25);
});

// --- empty: death at 1 hp, and a pull at the smallest maxWP ---------------

test("RULES-01 empty: a hero on 1 hp takes the toll's flat amount, the line prints it, and dies through die(state, 'maze')", () => {
  const state = fixedState({ c: { wp: 1 } });
  const events = tableFour(state, "-15 HP", fakeRng([]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "tableFour" && /15 hp/.test(e.result)), "the toll line prints the exact flat amount");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "maze"), "death routes through die(state, 'maze')");
});

test("RULES-01 empty: a '+25 HP' pull on the smallest-maxWP hero still adds the same flat step", () => {
  const state = fixedState({ c: { wp: 5, maxWP: 5 } });
  tableFour(state, "+25 HP", fakeRng([]), []);
  assert.equal(state.c.maxWP, 5 + 25);
});

// --- precision: dotHpFor is Math.round(base * HERO_HP_SCALE), int >= 1 ----

test("RULES-01 precision: dotHpFor(kind) is Math.round(DOT_HP_BASE[kind] * HERO_HP_SCALE) — 10/15/25 at identity, 13/19/31 at shipped dials, always an integer >= 1", () => {
  assert.equal(dotHpFor("small"), 10);
  assert.equal(dotHpFor("mid"), 15);
  assert.equal(dotHpFor("large"), 25);

  setDialsForTuning({});
  try {
    assert.equal(dotHpFor("small"), 13);
    assert.equal(dotHpFor("mid"), 19);
    assert.equal(dotHpFor("large"), 31);
    for (const kind of ["small", "mid", "large"]) {
      const n = dotHpFor(kind);
      assert.ok(Number.isInteger(n) && n >= 1, `dotHpFor("${kind}") must be an integer >= 1`);
    }
  } finally {
    setIdentityDials();
  }
});

// --- the faerie's +d20/-d10 base-HP rows are flat, never maxWP-relative ---

test("RULES-01 faerie: '+d20 Base HP' with a scripted 12 adds exactly 12 to maxWP whatever the hero's current maxWP is", () => {
  // FAERIE[1] === "+d20 Base HP" -> r=2 selects it; the second draw is the
  // scripted d20 amount.
  const low = fixedState({ c: { maxWP: 40, wp: 40 } });
  const eventsLow = meetFaerie(low, fakeRng([2, 12]), []);
  assert.equal(low.c.maxWP, 40 + 12);
  assert.ok(eventsLow.some((e) => e.type === "faerieBoon" && e.amount === 12));

  const high = fixedState({ c: { maxWP: 300, wp: 300 } });
  meetFaerie(high, fakeRng([2, 12]), []);
  assert.equal(high.c.maxWP, 300 + 12, "the same scripted 12 adds the same flat amount at a much larger maxWP");
});

test("RULES-01 faerie: '-d10 Base HP' subtracts a flat amount, independent of maxWP", () => {
  // FAERIE[3] === "-d10 Base HP" -> r=4 selects it; the second draw is the
  // scripted d10 amount.
  const state = fixedState({ c: { maxWP: 100, wp: 100 } });
  const events = meetFaerie(state, fakeRng([4, 7]), []);
  assert.equal(state.c.maxWP, 100 - 7);
  assert.ok(events.some((e) => e.type === "faerieBane" && e.amount === 7));
});

// --- level-up: heroMaxWpFor's gain is flat, independent of prior pulls ----

test("RULES-01 level-up: a level-up's HP gain is the same flat rolled amount regardless of how many pulls came before", () => {
  const noPulls = { c: fixedFighter({ sp: THRESHOLDS[1], level: 1, maxWP: 40, wp: 40 }) };
  checkLevel(noPulls, fakeRng([5]), []);
  const addNoPulls = noPulls.c.maxWP - 40;

  // Same scripted gain roll, but this hero already took two "+25 HP" pulls
  // (its starting maxWP is 40 + 2*25 = 90) before leveling up.
  const twoPulls = { c: fixedFighter({ sp: THRESHOLDS[1], level: 1, maxWP: 90, wp: 90 }) };
  checkLevel(twoPulls, fakeRng([5]), []);
  const addTwoPulls = twoPulls.c.maxWP - 90;

  assert.ok(addNoPulls > 0, "the level-up actually granted HP");
  assert.equal(addNoPulls, addTwoPulls, "the level-up gain never reads the hero's own current maxWP");
});

// --- Strength's temporary boost does not compound, and survives newDay ----

test("RULES-01 Strength: casting Strength twice while boosted leaves maxWP unchanged by the second cast", () => {
  const state = fixedState({ c: { maxWP: 100, wp: 100, strengthBoost: 0 } });

  castStrength(state, 5);
  assert.equal(state.c.maxWP, 200, "the first cast doubles maxWP via c.strengthBoost = c.maxWP");
  assert.equal(state.c.strengthBoost, 100);

  castStrength(state, 9);
  assert.equal(state.c.maxWP, 200, "the second cast, still boosted, does not double it again");
  assert.equal(state.c.strengthBoost, 100, "strengthBoost is unchanged by the guarded re-cast");
});

test("RULES-01 Strength: a '+25 HP' pull made during the boost survives newDay's reset as exactly one flat step", () => {
  // Unfed (rations 0 < eats) so newDay takes the cheapest path: no resting
  // rolls, no affliction/armor-patch rolls — the only draws left are the
  // eight wandering-monster d20s. All eight are scripted high (20) so no
  // hour wakes the party and startCombat never fires.
  const state = fixedState({ c: { maxWP: 100, wp: 100, strengthBoost: 0, rations: 0 }, day: 1 });

  castStrength(state, 5); // maxWP 100 -> 200, wp -> 200, strengthBoost = 100
  tableFour(state, "+25 HP", fakeRng([]), []); // maxWP 200 -> 225, wp -> 225

  newDay(state, false, fakeRng(Array(8).fill(20)), []);

  assert.equal(state.c.strengthBoost, 0, "newDay unwinds the boost");
  assert.equal(state.c.maxWP, 100 + 25, "the pull survives as exactly one flat step above the original maxWP");
});
