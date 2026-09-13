// test/unit/foe-damage.test.js
//
// Dedicated fakeRng coverage for engine/foeDamage.js — the ONE foe-damage
// seam (Phase 18, D-09; CANON-01/03/04). Pins the locked modifier order
// (multiplier -> halfDmg -> soak), the zero-draw gates, the crit/spell
// bypasses, the physical-kinds-are-soakable rule, the Sterling ceil ladder,
// the multiplier table's max-not-product / hero-only-Trachea behavior, and
// the no-kill contract (D-09) — via fakeRng's throw-on-underflow, which
// doubles as a "no more rng draws expected" assertion.
//
// Mirrors test/unit/party-combat.test.js's fakeRng helper and
// test/unit/foe-turn-draw-count.test.js's fixedFoe shape verbatim.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { damageFoe, multiplierFor } from "../../engine/foeDamage.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** fakeRng(seq) — `.d()` pops the next value regardless of side count;
 * throws on underflow, which doubles as a "no more rng draws expected"
 * assertion. */
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

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  return { c: { cls: "Fighter", sub: "Soldier" }, combat: { foes: [] }, ...overrides };
}

test("no-flag foe: melee 7 lands in full with zero draws and no events", () => {
  const foe = fixedFoe();
  const state = fixedState({ combat: { foes: [foe] } });
  const rng = fakeRng([]);
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, rng, events);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
  assert.equal(foe.wp, 3);
  assert.deepEqual(events, []);
});

test("rawDmg 0 and negative: no change, no draw, even against ar 12", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const events = [];
  assert.deepEqual(
    damageFoe(state, foe, 0, { kind: "melee" }, fakeRng([]), events),
    { applied: 0, soaked: false, mult: 1 }
  );
  assert.deepEqual(
    damageFoe(state, foe, -3, { kind: "melee" }, fakeRng([]), events),
    { applied: 0, soaked: false, mult: 1 }
  );
  assert.equal(foe.wp, 10);
  assert.deepEqual(events, []);
});

test("ar 12: a soak roll of exactly 12 soaks (boundary)", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const rng = fakeRng([12]);
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, rng, events);
  assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 });
  assert.equal(foe.wp, 10);
  assert.deepEqual(events, [{ type: "foeArmorSoaked", name: "Target", amount: 7 }]);
  assert.throws(() => rng.d(20), /sequence exhausted/);
});

test("ar 12: a soak roll of exactly 13 lands (boundary)", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([13]), events);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
  assert.equal(foe.wp, 3);
  assert.deepEqual(events, []);
});

test("ar 20 always soaks; ar 0 and absent ar and absent sp never draw", () => {
  const state = fixedState();

  const foe20 = fixedFoe({ sp: { ar: 20 } });
  const r20 = damageFoe(state, foe20, 7, { kind: "melee" }, fakeRng([20]), []);
  assert.deepEqual(r20, { applied: 0, soaked: true, mult: 1 });

  const foe0 = fixedFoe({ sp: { ar: 0 } });
  const r0 = damageFoe(state, foe0, 7, { kind: "melee" }, fakeRng([]), []);
  assert.deepEqual(r0, { applied: 7, soaked: false, mult: 1 });

  const foeEmptySp = fixedFoe({ sp: {} });
  const rEmpty = damageFoe(state, foeEmptySp, 7, { kind: "melee" }, fakeRng([]), []);
  assert.deepEqual(rEmpty, { applied: 7, soaked: false, mult: 1 });

  const foeNoSp = fixedFoe();
  delete foeNoSp.sp;
  const rNoSp = damageFoe(state, foeNoSp, 7, { kind: "melee" }, fakeRng([]), []);
  assert.deepEqual(rNoSp, { applied: 7, soaked: false, mult: 1 });
});

test("D-07: a crit against an armoured foe draws nothing and lands in full", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const result = damageFoe(state, foe, 7, { kind: "melee", crit: true }, fakeRng([]), []);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
});

test("D-06: a spell against an armoured foe draws nothing and lands in full", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const result = damageFoe(state, foe, 7, { kind: "spell", casterSub: "Wizard" }, fakeRng([]), []);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
});

test("physical kinds ally / foe / reflect / item are all soakable", () => {
  const state = fixedState();
  for (const kind of ["ally", "foe", "reflect", "item"]) {
    const foe = fixedFoe({ sp: { ar: 12 } });
    const events = [];
    const rng = fakeRng([1]);
    const result = damageFoe(state, foe, 7, { kind }, rng, events);
    assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 }, `kind ${kind}`);
    assert.deepEqual(events, [{ type: "foeArmorSoaked", name: "Target", amount: 7 }], `kind ${kind}`);
    assert.throws(() => rng.d(20), /sequence exhausted/, `kind ${kind} drew more than once`);
  }
});

test("D-10 halfDmg ceil ladder across kinds", () => {
  const state = fixedState();

  const foeMelee = fixedFoe({ sp: { halfDmg: true } });
  const rMelee = damageFoe(state, foeMelee, 7, { kind: "melee" }, fakeRng([]), []);
  assert.equal(rMelee.applied, 4);
  assert.equal(foeMelee.wp, 6);

  const foeSpell = fixedFoe({ sp: { halfDmg: true } });
  assert.equal(damageFoe(state, foeSpell, 8, { kind: "spell" }, fakeRng([]), []).applied, 4);

  const foeItem = fixedFoe({ sp: { halfDmg: true } });
  assert.equal(damageFoe(state, foeItem, 5, { kind: "item" }, fakeRng([]), []).applied, 3);

  const foe1 = fixedFoe({ sp: { halfDmg: true } });
  assert.equal(damageFoe(state, foe1, 1, { kind: "melee" }, fakeRng([]), []).applied, 1);

  const foe2 = fixedFoe({ sp: { halfDmg: true } });
  assert.equal(damageFoe(state, foe2, 2, { kind: "melee" }, fakeRng([]), []).applied, 1);

  const foe3 = fixedFoe({ sp: { halfDmg: true } });
  assert.equal(damageFoe(state, foe3, 3, { kind: "melee" }, fakeRng([]), []).applied, 2);
});

test("halfDmg foe with ar: the soak decides on the halved value and reports it", () => {
  const foe = fixedFoe({ sp: { halfDmg: true, ar: 12 } });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([5]), events);
  assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 });
  assert.deepEqual(events, [{ type: "foeArmorSoaked", name: "Target", amount: 4 }]);
});

test("CANON-04 rows via damageFoe", () => {
  const state = fixedState();

  const demons = fixedFoe({ type: "Demons" });
  assert.equal(damageFoe(state, demons, 5, { kind: "spell", casterSub: "Cleric" }, fakeRng([]), []).applied, 10);
  const demons2 = fixedFoe({ type: "Demons" });
  assert.equal(damageFoe(state, demons2, 5, { kind: "spell", casterSub: "Wizard" }, fakeRng([]), []).applied, 5);

  const wd1 = fixedFoe({ type: "Walking Dead" });
  assert.equal(damageFoe(state, wd1, 5, { kind: "spell", casterSub: "Wizard" }, fakeRng([]), []).applied, 10);
  const wd2 = fixedFoe({ type: "Walking Dead" });
  assert.equal(damageFoe(state, wd2, 5, { kind: "melee", casterClass: "Fighter" }, fakeRng([]), []).applied, 5);
  const wd3 = fixedFoe({ type: "Walking Dead" });
  assert.equal(damageFoe(state, wd3, 5, { kind: "item" }, fakeRng([]), []).applied, 5);

  const trachea1 = fixedFoe({ name: "Trachea", type: "Lair Beasts" });
  assert.equal(damageFoe(state, trachea1, 5, { kind: "melee", casterClass: "Fighter" }, fakeRng([]), []).applied, 10);
  const trachea2 = fixedFoe({ name: "Trachea", type: "Lair Beasts" });
  assert.equal(damageFoe(state, trachea2, 5, { kind: "melee", casterClass: "Thief" }, fakeRng([]), []).applied, 5);
  const trachea3 = fixedFoe({ name: "Trachea", type: "Lair Beasts" });
  assert.equal(damageFoe(state, trachea3, 5, { kind: "ally", casterClass: "Fighter" }, fakeRng([]), []).applied, 5);
});

test("concurrency: overlapping rows take the max, never the product", () => {
  const foe = fixedFoe({ type: "Walking Dead" });
  const state = fixedState();
  const result = damageFoe(state, foe, 5, { kind: "spell", casterSub: "Cleric" }, fakeRng([]), []);
  assert.equal(result.applied, 10);
  assert.equal(result.mult, 2);
});

test("idempotency: two hits each multiply their own raw once - no accumulation on the foe", () => {
  const foe = fixedFoe({ type: "Demons", wp: 40, maxWP: 40 });
  const state = fixedState();
  const r1 = damageFoe(state, foe, 5, { kind: "spell", casterSub: "Cleric" }, fakeRng([]), []);
  const r2 = damageFoe(state, foe, 5, { kind: "spell", casterSub: "Cleric" }, fakeRng([]), []);
  assert.equal(r1.applied, 10);
  assert.equal(r2.applied, 10);
  assert.equal(foe.wp, 20);
});

test("ordering: multiplier before halfDmg", () => {
  const foe = fixedFoe({ type: "Walking Dead", sp: { halfDmg: true } });
  const state = fixedState();
  const result = damageFoe(state, foe, 5, { kind: "spell", casterSub: "Wizard" }, fakeRng([]), []);
  // x2 = 10, ceil(10/2) = 5. The reverse order (halve then double) would give 6.
  assert.equal(result.applied, 5);
});

test("table miss falls back to 1 with no rounding surprises", () => {
  const foe1 = fixedFoe({ type: "Demons" });
  const state = fixedState();
  assert.equal(damageFoe(state, foe1, 7, { kind: "item" }, fakeRng([]), []).applied, 7);
  const foe2 = fixedFoe({ type: "Demons" });
  assert.equal(damageFoe(state, foe2, 7, { kind: "bogus" }, fakeRng([]), []).applied, 7);
});

test("multiplierFor direct: returns 1 for an empty source object and 2 for each canonical row", () => {
  assert.equal(multiplierFor({}, fixedFoe()), 1);
  assert.equal(multiplierFor({ kind: "spell", casterSub: "Cleric" }, fixedFoe({ type: "Demons" })), 2);
  assert.equal(multiplierFor({ kind: "spell", casterSub: "Wizard" }, fixedFoe({ type: "Walking Dead" })), 2);
  assert.equal(
    multiplierFor({ kind: "melee", casterClass: "Fighter" }, fixedFoe({ name: "Trachea", type: "Lair Beasts" })),
    2
  );
});

test("D-09: the seam never kills - wp goes negative, alive stays true, no foeKilled", () => {
  const foe = fixedFoe({ wp: 3 });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([]), events);
  assert.equal(result.applied, 7);
  assert.equal(foe.wp, -4);
  assert.equal(foe.alive, true);
  assert.deepEqual(events, []);
});

test("no event on the non-soak path", () => {
  const foe = fixedFoe({ sp: { ar: 12 } });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([19]), events);
  assert.equal(result.applied, 7);
  assert.deepEqual(events, []);
});

// --- Phase 18 invariant: damageFoe is the ONLY foe-wp decrement site (D-09, assumption-delta: promote) ---
//
// Source-assertion tests (mirroring test/unit/combat.test.js's
// "combat.js references no Math.random/document/localStorage" pattern):
// read the real engine source, strip comments, and count regex matches on
// code lines only. This proves the "one seam" property is a MAINTAINED
// invariant (enforced by CI), not a one-time cleanup that could silently
// regress the next time someone adds a damage path.
//
// The regex intentionally matches ONLY the foe-side loop/target identifiers
// the engine actually uses (`t`, `f`, `o`, `foe`) followed by `.wp -= `. It
// deliberately does NOT match `c` (the hero) or `member` (a party member) —
// those decrements are legitimate and must remain untouched by this phase.

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FOE_WP_DECREMENT_RE = /\b(?:foe|t|f|o)\.wp -= /g;

test("invariant: engine/combat.js, engine/magic.js and engine/items.js contain zero foe-side wp decrements on code lines", () => {
  for (const file of ["combat.js", "magic.js", "items.js"]) {
    const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", file), "utf8"));
    const matches = src.match(FOE_WP_DECREMENT_RE) || [];
    assert.equal(
      matches.length,
      0,
      `engine/${file} should have zero foe-side wp decrements outside the seam, found ${matches.length}: ${JSON.stringify(matches)}`,
    );
  }
});

test("invariant: engine/foeDamage.js contains exactly one foe-side wp decrement (the seam itself)", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "foeDamage.js"), "utf8"));
  const matches = src.match(FOE_WP_DECREMENT_RE) || [];
  assert.equal(matches.length, 1, `engine/foeDamage.js should have exactly one foe-side wp decrement, found ${matches.length}`);
});

test("sanity: the regex would catch a violation, and does not match a hero-side decrement", () => {
  const violation = "t" + ".wp -= " + "5;";
  assert.match(violation, FOE_WP_DECREMENT_RE);

  const heroSide = "c" + ".wp -= " + "dmg;";
  assert.doesNotMatch(heroSide, FOE_WP_DECREMENT_RE);
});

test("sanity: the hero and party-member wp decrements still exist, untouched, in combat.js", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "combat.js"), "utf8"));
  const heroMatches = src.match(/\bc\.wp -= dmg;/g) || [];
  const memberMatches = src.match(/\bmember\.wp -= mDmg;/g) || [];
  assert.equal(heroMatches.length, 1, "combat.js's hero-side c.wp -= dmg; must still exist exactly once");
  assert.equal(memberMatches.length, 1, "combat.js's party-member member.wp -= mDmg; must still exist exactly once");
});
