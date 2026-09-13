// test/unit/item-wiring.test.js
//
// Phase 15 (Item Audit + Inert-Effect Wiring, ECON-08). Proves each formerly
// INERT item effect (research economy-SUMMARY.md §4) now DOES something, and
// that the one new rng draw (Cloak of Regeneration's per-step d6) fires ONLY
// when the cloak is carried — a non-carrier draws nothing (the parity/
// determinism guarantee). The full prototype-fidelity proof lives in
// test/parity/*; these are the direct behavioral proofs for the new reads.
//
// Deterministic `.d()` sequences via fakeRng (ports the movement/combat unit
// tests' helper): an exhausted sequence throws, which doubles as a "no more
// rng draws expected here" assertion — exactly how the Cloak-of-Regeneration
// gate is proven (a non-carrier is driven with fakeRng([]) and must not throw).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { move } from "../../engine/movement.js";
import { canParley, playerStrike, foeTurn } from "../../engine/combat.js";
import { useItem } from "../../engine/items.js";
import { weaponDamage } from "../../engine/derived.js";
import { sellPriceFor } from "../../engine/economy.js";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow (a "no further rng draw expected" assertion). */
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

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0, halfNext: false,
    ...overrides,
  };
}

/** A minimal fully-walled GWxGH grid (engine/maze.js), holes punched by open(). */
function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, dark: false, seen: false, feat: null });
  }
  return g;
}
function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, dark: false, seen: false, feat: null, ...extra };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    party: [], pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 100, maxWP: 100, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const HELM = { kind: "jewel", n: "Helm of Knowledge", eff: { tongue: 1 }, txt: "" };
const CLOAK_STRENGTH = { kind: "cloak", n: "Cloak of Strength", eff: { noCrit: 1 }, txt: "" };
const PENDANT = { kind: "jewel", n: "Pendant of Fortitude", eff: {}, use: "half", txt: "" };
const AMULET_LIGHT = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 }, txt: "" };
const CLOAK_HEALING = { kind: "cloak", n: "Cloak of Healing", eff: { cloakHeal: 1 }, txt: "" };
const CLOAK_REGEN = { kind: "cloak", n: "Cloak of Regeneration", eff: { cloakRegen: 1 }, txt: "" };
const GAUNTLET = { kind: "jewel", n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "" };
const AMULET_STONE = { kind: "jewel", n: "Amulet of Stone", eff: {}, use: "stone", every: 200, aoe: 4, txt: "" };
const OAK_STAFF = { kind: "staff", n: "Oak Staff", use: "stone", txt: "" };

// --- 1. Helm of Knowledge tongue -> canParley (DR15-A) --------------------

test("Helm of Knowledge grants Language: carrying it makes a TALKATIVE encounter parleyable", () => {
  const withoutHelm = fixedState({ combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }) });
  assert.equal(canParley(withoutHelm), false, "a plain Human Fighter with no Language cannot parley Humans");

  const withHelm = fixedState({
    c: { items: [HELM] },
    combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }),
  });
  assert.equal(canParley(withHelm), true, "the Helm's tongue effect grants Language -> parley Humans");
});

// --- 2. Cloak of Strength noCrit ------------------------------------------

test("Cloak of Strength suppresses the player's own critical (a natural 1 no longer doubles damage)", () => {
  // Shared rng sequence: strike roll = 1 (crit), weapon d6 = 5, foe miss roll,
  // then a fresh initiative (mine>=theirs -> "you", no bonus foeTurn).
  const seq = () => [1, 5, 10, 20, 1];

  const control = fixedState({ combat: fixedCombat([fixedFoe({ wp: 100 })]) });
  const cEvents = playerStrike(control, fakeRng(seq()), []);
  const cStruck = cEvents.find((e) => e.type === "struck");
  assert.equal(cStruck.critical, true, "without the cloak, a natural 1 crits");
  assert.equal(cStruck.dmg, 12, "crit doubles (1 + d6=5) => 6*2 = 12");

  const cloaked = fixedState({ c: { items: [CLOAK_STRENGTH] }, combat: fixedCombat([fixedFoe({ wp: 100 })]) });
  const wEvents = playerStrike(cloaked, fakeRng(seq()), []);
  const wStruck = wEvents.find((e) => e.type === "struck");
  assert.equal(wStruck.critical, false, "the Cloak of Strength suppresses the crit");
  assert.equal(wStruck.dmg, 6, "no crit => 1 + d6=5 = 6 (undoubled)");
});

// --- 3. Pendant of Fortitude halfNext -------------------------------------

test("Pendant of Fortitude halves ONE incoming blow, then spends the charge", () => {
  // foeTurn draws: foe attack roll (3 -> hit, not a crit), then damage d6 (4).
  const armed = fixedState({ c: { halfNext: true }, combat: fixedCombat([fixedFoe()]) });
  const events = foeTurn(armed, fakeRng([3, 4]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 3, "raw 1 + d6=4 = 5, halved (ceil) => 3");
  assert.ok(events.some((e) => e.type === "damageHalved"), "emits damageHalved");
  assert.equal(armed.c.halfNext, false, "the charge is spent after one hit");

  const control = fixedState({ c: { halfNext: false }, combat: fixedCombat([fixedFoe()]) });
  const cEvents = foeTurn(control, fakeRng([3, 4]), []);
  assert.equal(cEvents.find((e) => e.type === "struckByFoe").dmg, 5, "unhalved => full 5");
});

// --- 4. Amulet of Light light -> dispels persistent darkness --------------

test("Amulet of Light dispels the persistent darkness counter outright on the next step", () => {
  const lit = fixedState({ c: { items: [AMULET_LIGHT], darkFor: 30 } });
  open(lit.floor.g, 5, 4);
  const events = move(lit, "N", fakeRng([]), []); // no rng: dispel is a plain clear
  assert.equal(lit.c.darkFor, 0, "carrying the Amulet clears darkFor immediately");
  assert.ok(events.some((e) => e.type === "darknessDispelled"), "emits darknessDispelled");

  const dark = fixedState({ c: { darkFor: 30 } });
  open(dark.floor.g, 5, 4);
  move(dark, "N", fakeRng([]), []);
  assert.equal(dark.c.darkFor, 29, "without the Amulet the counter merely ticks down");
});

// --- 5. Cloak of Healing (flat, no rng) -----------------------------------

test("Cloak of Healing restores a flat amount every 20 squares with NO rng draw", () => {
  const st = fixedState({ c: { items: [CLOAK_HEALING], wp: 10, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  const events = move(st, "N", fakeRng([]), []); // fakeRng([]) throws if ANY rng is drawn
  assert.equal(st.steps, 20);
  assert.equal(st.c.wp, 20, "flat +10 heal at the 20-square tick");
  assert.ok(events.some((e) => e.type === "cloakHealed"), "emits cloakHealed");
});

test("Cloak of Healing never overheals past maxWP", () => {
  const st = fixedState({ c: { items: [CLOAK_HEALING], wp: 52, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  move(st, "N", fakeRng([]), []);
  assert.equal(st.c.wp, 55, "capped at maxWP");
});

// --- 6. Cloak of Regeneration (the ONE new rng draw, GATED) ---------------

test("Cloak of Regeneration rolls a d6 every 20 squares when carried", () => {
  const st = fixedState({ c: { items: [CLOAK_REGEN], wp: 10, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  const events = move(st, "N", fakeRng([6]), []); // exactly one d6 draw expected
  assert.equal(st.steps, 20);
  assert.equal(st.c.wp, 16, "d6=6 regen at the 20-square tick");
  assert.ok(events.some((e) => e.type === "cloakRegenerated"), "emits cloakRegenerated");
});

test("Cloak of Regeneration d6 is GATED: a NON-carrier draws NO rng on the same step", () => {
  const st = fixedState({ c: { wp: 10, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  // fakeRng([]) throws on ANY draw — a non-carrier reaching step 20 must draw
  // nothing (byte-identical to the frozen prototype's rng cursor).
  assert.doesNotThrow(() => move(st, "N", fakeRng([]), []));
  assert.equal(st.c.wp, 10, "a non-carrier is not healed");
});

test("Cloak of Regeneration d6 is GATED: a real seeded rng cursor is untouched for a non-carrier", () => {
  const st = fixedState({ c: { wp: 10, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  const rng = makeRng(12345);
  const before = rng.getState();
  move(st, "N", rng, []);
  assert.deepEqual(rng.getState(), before, "no rng consumed by a non-carrier's step");
});

// --- 7. Amulet of Stone (DR16-G) — per-item AoE count ---------------------

test("Amulet of Stone petrifies up to 4 foes (per-item aoe:4); a plain stone source hits 2", () => {
  const makeFoes = () => [1, 2, 3, 4, 5].map((i) => fixedFoe({ name: `F${i}`, wp: 12, maxWP: 12 }));

  const amulet = fixedState({ c: { items: [AMULET_STONE] }, combat: fixedCombat(makeFoes()) });
  useItem(amulet, 0, makeRng(7), []);
  assert.equal(amulet.combat.foes.filter((f) => f.alive).length, 1, "Amulet turns 4 of 5 to stone");

  const staff = fixedState({ c: { items: [OAK_STAFF] }, combat: fixedCombat(makeFoes()) });
  useItem(staff, 0, makeRng(7), []);
  assert.equal(staff.combat.foes.filter((f) => f.alive).length, 3, "a default stone source (Oak Staff) hits only 2");
});

// --- 8. ether pass-through + Gauntlet of the Giant size -------------------

test("Cloak of Ether: while ethereal you phase through a wall/crevice with no roll and no rng", () => {
  const st = fixedState({ c: { ether: 20 } });
  open(st.floor.g, 5, 4, { feat: "climb" });
  const events = move(st, "N", fakeRng([]), []); // no climb roll drawn while phasing
  assert.equal(st.floor.py, 4, "you move through");
  assert.equal(st.floor.g[4][5].feat, null, "the obstacle is cleared");
  assert.ok(events.some((e) => e.type === "phasedThrough"), "emits phasedThrough");
});

test("Gauntlet of the Giant adds a flat size damage bonus to weaponDamage", () => {
  const plain = fixedFighter();
  const giant = fixedFighter({ items: [GAUNTLET] });
  assert.equal(weaponDamage(plain, fakeRng([4])), 5, "1 + d6=4 = 5");
  assert.equal(weaponDamage(giant, fakeRng([4])), 7, "1 + d6=4 + size(2) = 7");
});

// --- 9. Treasure base values feed sellPriceFor ----------------------------

test("sellPriceFor uses real treasure base values for cloaks/jewelry/staves, not the flat fallback", () => {
  // SELL_SPREAD 0.5, priceFor(base, "Human") === base.
  assert.equal(sellPriceFor({ kind: "cloak", n: "Cloak of Armor" }, "Human"), 1250, "2500 base * 0.5");
  assert.equal(sellPriceFor({ kind: "jewel", n: "Ring of Power" }, "Human"), 750, "1500 base * 0.5");
  assert.equal(sellPriceFor({ kind: "staff", n: "Pine Staff" }, "Human"), 1300, "2600 base * 0.5");

  // An unknown/renamed treasure item still falls back (200 * 0.5 = 100), and a
  // real item now sells for well more than that flat fallback.
  const fallback = sellPriceFor({ kind: "cloak", n: "Nonexistent Cloak" }, "Human");
  assert.equal(fallback, 100, "unknown treasure => flat fallback");
  assert.ok(sellPriceFor({ kind: "cloak", n: "Cloak of Armor" }, "Human") > fallback, "real value beats the fallback");
});
