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
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

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
    darkFor: 0, halfNext: false,
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
    dead: false, deathNote: "", epitaph: "",
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
const CLOAK_REGEN = { kind: "cloak", n: "Cloak of Regeneration", eff: { cloakRegen: 1 }, txt: "" };
const GAUNTLET = { kind: "jewel", n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "" };
const AMULET_STONE = { kind: "jewel", n: "Amulet of Stone", eff: {}, use: "stone", every: 200, aoe: 4, txt: "" };
// Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
const OAK_STAFF = { kind: "staff", n: "Oak Staff", use: "stone", charges: 1, txt: "" };

/** onlyRng() — a fakeRng-shaped stand-in that throws on ANY `.d()` call,
 * matching the plan's `() => 1` convenience shorthand for a numeric-only
 * (no-dice) `applyActivation` path — used for every worn+used case below
 * whose activation has a plain numeric `effect` (power/giant/glow/unseen/
 * tongue/brace/plate/fly all resolve with zero draws). */
function noDrawRng() {
  return { d: () => { throw new Error("noDrawRng: no rng draw expected"); }, pick: (a) => a[0], shuffle: (a) => a };
}

// --- 1. Helm of Knowledge tongue -> canParley (DR15-A) --------------------
// 260918-w4n (use-activated-only): the Helm must be WORN AND USED — a
// worn-but-unused Helm, or one merely carried in the bag, grants nothing.

test("Helm of Knowledge grants Language: worn AND used makes a TALKATIVE encounter parleyable; worn-but-unused and bagged do not", () => {
  const withoutHelm = fixedState({ combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }) });
  assert.equal(canParley(withoutHelm), false, "a plain Human Fighter with no Language cannot parley Humans");

  const wornUnused = fixedState({
    c: { worn: { jewelry1: HELM } },
    combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }),
  });
  assert.equal(canParley(wornUnused), false, "a worn-but-unused Helm grants nothing");

  const bagged = fixedState({
    c: { items: [HELM], worn: {} },
    combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }),
  });
  assert.equal(canParley(bagged), false, "a bagged Helm grants nothing");
  const bagUseEvents = useItem(bagged, 0, noDrawRng(), []);
  assert.deepStrictEqual(bagUseEvents, [{ type: "useRefused", item: HELM, reason: "notWorn" }]);

  const wornUsed = fixedState({
    c: { worn: { jewelry1: HELM } },
    combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }),
  });
  useItem(wornUsed, { slot: "jewelry1" }, noDrawRng(), []);
  assert.equal(canParley(wornUsed), true, "worn AND used — the Helm's live tongue effect grants Language -> parley Humans");
});

// --- 2. Cloak of Strength noCrit ------------------------------------------
// 260918-w4n: worn AND used suppresses the crit; worn-but-unused does not.

test("Cloak of Strength suppresses the player's own critical (a natural 1 no longer doubles damage) only worn AND used", () => {
  // Shared rng sequence: strike roll = 1 (crit), weapon d6 = 5, foe miss roll
  // — no round-advance draws, initiative is rolled once, Phase 51.
  const seq = () => [1, 5, 10];
  // Phase 24 (IDENT-05) collision-avoidance: this file's fixedFighter
  // defaults to sub: "Knight" and fixedFoe defaults to maxWP: 100 — the
  // Knight-big-foe rule would otherwise force a live maxWP >= 20 foe to win
  // the (now once-per-fight) initiative roll, and this test never calls
  // fight() to consume that roll's own draws. maxWP: 19 keeps the crit/soak
  // math this test actually proves untouched.
  const foeOverrides = { wp: 19, maxWP: 19 };

  const control = fixedState({ combat: fixedCombat([fixedFoe(foeOverrides)]) });
  const cEvents = playerStrike(control, fakeRng(seq()), []);
  const cStruck = cEvents.find((e) => e.type === "struck");
  assert.equal(cStruck.critical, true, "without the cloak, a natural 1 crits");
  assert.equal(cStruck.dmg, 12, "crit doubles (1 + d6=5) => 6*2 = 12");

  const wornUnused = fixedState({ c: { worn: { cloak: CLOAK_STRENGTH } }, combat: fixedCombat([fixedFoe(foeOverrides)]) });
  const uEvents = playerStrike(wornUnused, fakeRng(seq()), []);
  const uStruck = uEvents.find((e) => e.type === "struck");
  assert.equal(uStruck.critical, true, "worn but UNUSED — still crits, grants nothing");

  const wornUsed = fixedState({ c: { worn: { cloak: CLOAK_STRENGTH } } });
  useItem(wornUsed, { slot: "cloak" }, noDrawRng(), []);
  wornUsed.combat = fixedCombat([fixedFoe(foeOverrides)]);
  const wEvents = playerStrike(wornUsed, fakeRng(seq()), []);
  const wStruck = wEvents.find((e) => e.type === "struck");
  assert.equal(wStruck.critical, false, "worn AND used — the Cloak of Strength suppresses the crit");
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
// 260918-w4n: the dispel now fires on USE (engine/items.js#useItem's "glow"
// case), not as a movement per-step tick — a bagged/worn-but-unused Amulet
// grants nothing; the Amulet's own per-step tick is gone from movement.js.

test("Amulet of Light dispels the persistent darkness counter outright on USE (worn AND used only)", () => {
  const wornUsed = fixedState({ c: { worn: { jewelry1: AMULET_LIGHT }, darkFor: 30 } });
  const events = useItem(wornUsed, { slot: "jewelry1" }, noDrawRng(), []); // no rng: dispel is a plain clear
  assert.equal(wornUsed.c.darkFor, 0, "worn AND used clears darkFor immediately");
  assert.ok(events.some((e) => e.type === "darknessDispelled"), "emits darknessDispelled");
  assert.ok(events.some((e) => e.type === "itemEffectStarted" && e.kind === "glow"), "starts the 50-square glow effect");

  const wornUnused = fixedState({ c: { worn: { jewelry1: AMULET_LIGHT }, darkFor: 30 } });
  open(wornUnused.floor.g, 5, 4);
  move(wornUnused, "N", fakeRng([]), []);
  assert.equal(wornUnused.c.darkFor, 29, "worn but UNUSED — the counter merely ticks down, exactly like carrying nothing");

  const dark = fixedState({ c: { darkFor: 30 } });
  open(dark.floor.g, 5, 4);
  move(dark, "N", fakeRng([]), []);
  assert.equal(dark.c.darkFor, 29, "without the Amulet the counter merely ticks down");
});

// --- 6. Cloak of Regeneration (use-activated; the ONE rng draw is on USE) -
// 260918-w4n: the dropped healing cloak leaves the game entirely (no more
// Cloak of Healing tests); the Cloak of Regeneration's d6 now fires on USE,
// not on a per-step tick — a worn-but-unused cloak heals nothing while
// walking.

test("Cloak of Regeneration rolls a d6 on USE (worn AND used), then a 20-square cooldown; worn-but-unused heals nothing while walking", () => {
  const st = fixedState({ c: { worn: { cloak: CLOAK_REGEN }, wp: 10, maxWP: 55 } });
  const rng = fakeRng([6]); // exactly one d6 draw expected
  const events = useItem(st, { slot: "cloak" }, rng, []);
  assert.equal(st.c.wp, 16, "d6=6 regen on use");
  assert.ok(events.some((e) => e.type === "cloakRegenerated" && e.amount === 6), "emits cloakRegenerated");
  assert.deepStrictEqual(st.c.timers["item:Cloak of Regeneration"], { cadence: "squares", left: 20, phase: "cooldown" });
  assert.equal(events.some((e) => e.type === "itemEffectStarted"), false, "an instant effect starts a bare cooldown, no itemEffectStarted");

  const again = useItem(st, { slot: "cloak" }, fakeRng([]), []);
  assert.deepStrictEqual(again, [{ type: "useRefused", item: CLOAK_REGEN, reason: "cooldown", left: 20, phase: "cooldown" }]);
});

test("Cloak of Regeneration d6 is GATED: worn-but-unused draws NO rng and heals nothing while walking 20+ squares", () => {
  const wornUnused = fixedState({ c: { worn: { cloak: CLOAK_REGEN }, wp: 10, maxWP: 55 }, steps: 19 });
  open(wornUnused.floor.g, 5, 4);
  assert.doesNotThrow(() => move(wornUnused, "N", fakeRng([]), []));
  assert.equal(wornUnused.c.wp, 10, "worn but unused — no movement tick heals it any more");

  const noCloak = fixedState({ c: { wp: 10, maxWP: 55 }, steps: 19 });
  open(noCloak.floor.g, 5, 4);
  assert.doesNotThrow(() => move(noCloak, "N", fakeRng([]), []));
  assert.equal(noCloak.c.wp, 10, "a non-carrier is not healed");
});

test("Cloak of Regeneration d6 is GATED: a real seeded rng cursor is untouched by movement, worn or not", () => {
  const st = fixedState({ c: { worn: { cloak: CLOAK_REGEN }, wp: 10, maxWP: 55 }, steps: 19 });
  open(st.floor.g, 5, 4);
  const rng = makeRng(12345);
  const before = rng.getState();
  move(st, "N", rng, []);
  assert.deepEqual(rng.getState(), before, "no rng consumed by movement — the cloak's d6 only fires on useItem now");
});

// --- 7. Amulet of Stone (DR16-G) — per-item AoE count ---------------------

test("Amulet of Stone petrifies up to 4 foes (per-item aoe:4); a plain stone source hits 2", () => {
  const makeFoes = () => [1, 2, 3, 4, 5].map((i) => fixedFoe({ name: `F${i}`, wp: 12, maxWP: 12 }));

  const amulet = fixedState({ c: { items: [AMULET_STONE] }, combat: fixedCombat(makeFoes()) });
  useItem(amulet, 0, makeRng(7), []);
  assert.equal(amulet.combat.foes.filter((f) => f.alive).length, 1, "Amulet turns 4 of 5 to stone");

  // Phase 31 (CMB-02): a staff now refuses a non-Magic-User (wrongClass) —
  // use a Magic User caster here to keep exercising the aoe-count logic.
  // RULES-13 (Phase 75, Plan 09): a staff's power works only while wielded —
  // wield OAK_STAFF ({slot:"weapon"}) instead of addressing it by bag index.
  const staff = fixedState({ c: { cls: "Magic User", weapon: "Oak Staff", staff: OAK_STAFF, items: [] }, combat: fixedCombat(makeFoes()) });
  useItem(staff, { slot: "weapon" }, makeRng(7), []);
  assert.equal(staff.combat.foes.filter((f) => f.alive).length, 3, "a default stone source (Oak Staff) hits only 2");
});

// --- 8. ether pass-through + Gauntlet of the Giant size -------------------

test("Cloak of Ether: while ethereal you phase through a wall/crevice with no roll and no rng", () => {
  // Phase 39 (GEAR-02): c.ether is retired — a live "ether" item effect now
  // reads through c.timers instead.
  const st = fixedState({ c: { timers: { "item:Cloak of Ether": { cadence: "squares", left: 20, cd: 80, phase: "effect" } } } });
  open(st.floor.g, 5, 4, { feat: "climb" });
  const events = move(st, "N", fakeRng([]), []); // no climb roll drawn while phasing
  assert.equal(st.floor.py, 4, "you move through");
  assert.equal(st.floor.g[4][5].feat, null, "the obstacle is cleared");
  assert.ok(events.some((e) => e.type === "phasedThrough"), "emits phasedThrough");
});

test("Gauntlet of the Giant adds a flat size damage bonus to weaponDamage only when worn AND used", () => {
  const plain = fixedFighter();
  const wornUnused = fixedFighter({ worn: { helm: GAUNTLET } });
  const wornUsed = fixedFighter({
    worn: { helm: GAUNTLET },
    timers: { "item:Gauntlet of the Giant": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  assert.equal(weaponDamage(plain, fakeRng([4])), 5, "1 + d6=4 = 5");
  assert.equal(weaponDamage(wornUnused, fakeRng([4])), 5, "worn but UNUSED grants nothing");
  assert.equal(weaponDamage(wornUsed, fakeRng([4])), 7, "worn AND used — 1 + d6=4 + size(2) = 7");
});

// --- 9. Phase 18: fire item routed through damageFoe (CANON-01 A3) --------

test("Pine Staff's fire effect routes through damageFoe: soakable by sp.ar, never multiplied", () => {
  const soaked = fixedState({
    // Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
    c: { items: [{ n: "Pine Staff", use: "fire", charges: 1 }] },
    combat: fixedCombat([fixedFoe({ sp: { ar: 12 }, wp: 30, maxWP: 30 })]),
  });
  // n=d6=1 ball; dmg = d10=6 + 4 = 10; armor-soak d20=3, 3<=12 soaks entirely.
  const events = useItem(soaked, 0, fakeRng([1, 6, 3]), []);
  assert.ok(events.some((e) => e.type === "foeArmorSoaked" && e.amount === 10));
  assert.ok(events.some((e) => e.type === "itemBurned" && e.total === 0));
  assert.equal(soaked.combat.foes[0].wp, 30, "the soaked ball left the foe untouched");

  const unarmoured = fixedState({
    c: { items: [{ n: "Pine Staff", use: "fire", charges: 1 }] },
    combat: fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })]),
  });
  const controlEvents = useItem(unarmoured, 0, fakeRng([1, 6]), []);
  assert.ok(controlEvents.some((e) => e.type === "itemBurned" && e.total === 10));
  assert.equal(unarmoured.combat.foes[0].wp, 20, "an unarmoured foe takes the full 10");
});

// --- 10. Treasure base values feed sellPriceFor ---------------------------

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
