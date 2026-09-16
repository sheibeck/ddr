// test/unit/armor-durability.test.js
//
// Phase 28 (ARMOR-03/ARMOR-05) — item-carried durability, destroyed-armor
// guard, armorSoaked outcome flags. Pins the fix to the unequip -> swap ->
// re-equip full-repair exploit (durability now rides the bag item), closes
// the adjacent destroyed-armor gap (a piece at armorWP <= 0 is gone — no bag
// copy, even mid-combat via A1), and pins the two new additive `armorSoaked`
// payload flags (`underMin`, `magic`) that make all four soak outcomes
// distinguishable on screen. Local helpers mirror test/unit/combat.test.js
// (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/fixedCombat — those
// are file-private there, so they are replicated here rather than imported)
// and test/unit/inventory-actions.test.js (the WEAPON/ARMOR bag-item
// helpers — ARMOR here deliberately omits left/patches, the legacy shape).

import test from "node:test";
import assert from "node:assert/strict";

import { equipItem, unequipSlot } from "../../engine/items.js";
import { applyFoeDamageToPlayer } from "../../engine/combat.js";
import { newRun } from "../../engine/engine.js";
import {
  movementComparable,
  combatComparable,
  economyComparable,
} from "../parity/harness/comparables.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports
 * test/unit/combat.test.js's helper verbatim). */
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
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    flightLeft: 0, flightCooldown: 0,
    // Phase 28: a "small" bag (4 slots) so the full-bag destroyed-armor case
    // can be driven without a bagFull check ever gating it.
    bag: "small",
    ...overrides,
  };
}

/** A tiny fully-lit 3x3 open floor, sufficient for inDark(state) reads. */
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
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** WEAPON/ARMOR — mirror test/unit/inventory-actions.test.js's bag-item
 * helpers. ARMOR deliberately carries NO left/patches keys — that is the
 * legacy (pre-Phase-28, or freshly-found) bag-armor shape the tolerant read
 * (`it.left ?? it.wp`) must handle. */
const WEAPON = (base, bonus = 0) => ({ kind: "weapon", n: base, base, bonus, txt: base });
const ARMOR = (name, ar, cls = "FT") => ({ kind: "armor", n: name, armor: name, ar, wp: 20, min: 1, cls, txt: `AR ${ar}` });

// --- exploit closed / idempotent / index-stable swap (ARMOR-03) ------------

test("equipItem: exploit closed — re-equip does not repair a partially-worn piece", () => {
  const state = fixedState({
    c: { armor: "Plate", ar: 15, armorMin: 2, armorWP: 20, armorMax: 45, patches: 1, items: [ARMOR("Cloth", 3)] },
  });
  equipItem(state, 0, []);
  assert.equal(state.c.armor, "Cloth", "swapped to the bag piece");
  assert.equal(state.c.items.length, 1, "direct swap — no net slot change");
  const stowed = state.c.items[0];
  assert.equal(stowed.armor, "Plate");
  assert.equal(stowed.left, 20, "the stowed Plate carries its REMAINING durability, not full");
  assert.equal(stowed.patches, 1);
  assert.equal(stowed.wp, 45, "wp stays the piece's max");

  equipItem(state, 0, []); // re-equip the stowed Plate
  assert.equal(state.c.armor, "Plate");
  assert.equal(state.c.armorWP, 20, "NOT repaired to 45 — the exploit is closed");
  assert.equal(state.c.patches, 1);
  assert.equal(state.c.armorMax, 45);
});

test("unequip -> equip -> unequip -> equip is idempotent — no drift in durability/patches", () => {
  const state = fixedState({
    c: { armor: "Plate", ar: 15, armorMin: 2, armorWP: 20, armorMax: 45, patches: 1, items: [] },
  });
  unequipSlot(state, "armor", []);
  equipItem(state, 0, []);
  unequipSlot(state, "armor", []);
  equipItem(state, 0, []);
  assert.equal(state.c.armorWP, 20);
  assert.equal(state.c.patches, 1);
  assert.equal(state.c.armorMax, 45);
});

test("equipItem: index-stable swap — the stowed piece lands at the SAME bag index", () => {
  const state = fixedState({
    c: {
      armor: "Plate", ar: 15, armorMin: 2, armorWP: 20, armorMax: 45, patches: 1,
      items: [WEAPON("Dagger"), ARMOR("Cloth", 3)],
    },
  });
  equipItem(state, 1, []);
  assert.equal(state.c.items.length, 2);
  assert.equal(state.c.items[0].base, "Dagger", "index 0 untouched");
  assert.equal(state.c.items[1].armor, "Plate", "the stowed Plate lands at index 1 — same slot it came from");
  assert.equal(state.c.items[1].left, 20);
});

test("equipItem: a legacy bag armor item with no left/patches equips at full (tolerant read)", () => {
  const state = fixedState({ c: { items: [ARMOR("Cloth", 3)] } }); // armor:"Nothing" default
  equipItem(state, 0, []);
  assert.equal(state.c.armorWP, 20, "reads full via it.left ?? it.wp");
  assert.equal(state.c.patches, 0, "reads 0 via it.patches ?? 0");
});

test("unequipSlot: a fresh full-durability piece still records left/patches as concrete numbers", () => {
  const state = fixedState({
    c: { armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0, items: [] },
  });
  unequipSlot(state, "armor", []);
  assert.equal(state.c.items[0].left, 15);
  assert.equal(state.c.items[0].patches, 0);
  assert.notEqual(state.c.items[0].left, undefined, "never undefined, even at full");
});

// --- destroyed armor is GONE (ARMOR-03 + A1) --------------------------------

test("unequipSlot: destroyed armor (armorWP 0) is gone — no bag copy, even on a full bag", () => {
  const baseC = { armor: "Studded", ar: 15, armorMin: 2, armorWP: 0, armorMax: 20, patches: 0 };

  const state = fixedState({ c: { ...baseC, items: [] } });
  const events = unequipSlot(state, "armor", []);
  assert.equal(state.c.armor, "Nothing");
  assert.equal(state.c.ar, 0);
  assert.equal(state.c.armorMax, 0);
  assert.equal(state.c.armorWP, 0);
  assert.equal(state.c.items.length, 0, "no bag copy of a destroyed piece");
  const unequipped = events.find((e) => e.type === "itemUnequipped");
  assert.ok(unequipped);
  assert.equal(unequipped.destroyed, true);
  assert.equal(unequipped.item.n, "Studded");

  const fullState = fixedState({
    c: { ...baseC, items: [WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger"), WEAPON("Dagger")] },
  });
  const fullEvents = unequipSlot(fullState, "armor", []);
  assert.equal(fullState.c.armor, "Nothing", "bare even though the bag is full — nothing needed stowing");
  assert.equal(fullState.c.items.length, 4, "bag untouched, no bagFull gate applies");
  assert.equal(fullEvents.some((e) => e.type === "bagFull"), false, "NO bagFull — nothing is being stowed");
});

test("equipItem: swapping onto destroyed armor leaves no bag copy of the destroyed piece", () => {
  const state = fixedState({
    c: { armor: "Studded", ar: 15, armorMin: 2, armorWP: 0, armorMax: 20, patches: 0, items: [ARMOR("Cloth", 3)] },
  });
  equipItem(state, 0, []);
  assert.equal(state.c.armor, "Cloth");
  assert.equal(state.c.items.length, 0, "the destroyed Studded piece vanished, not stowed");
});

test("applyFoeDamageToPlayer + unequipSlot: combat-destroyed armor (A1) still vanishes on unequip", () => {
  const state = fixedState({
    c: { armor: "Studded", ar: 15, armorMin: 0, armorWP: 3, armorMax: 20, patches: 0, items: [] },
  });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([10]), events, { dmg: 5, roll: 3, need: 5 });
  assert.equal(state.c.armorWP, 0);
  assert.equal(state.c.ar, 15, "A1: combat's destroy path never resets c.ar — the guard lives in wornArmorItem");

  const unequipEvents = unequipSlot(state, "armor", []);
  assert.equal(state.c.items.length, 0, "zero bag items after unequipping a combat-destroyed piece");
  assert.equal(state.c.armor, "Nothing");
  assert.ok(unequipEvents.some((e) => e.type === "itemUnequipped" && e.destroyed === true));
});

// --- roundtrip safety --------------------------------------------------------

test("roundtrip: a stowed partial-durability armor item survives JSON serialize/deserialize with no undefined keys", () => {
  const state = fixedState({
    c: { armor: "Plate", ar: 15, armorMin: 2, armorWP: 20, armorMax: 45, patches: 1, items: [] },
  });
  unequipSlot(state, "armor", []);
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.deepStrictEqual(roundTripped, state);
  assert.ok(!Object.values(state.c.items[0]).some((v) => v === undefined), "no undefined-valued key");
});

// --- armorSoaked outcome flags (ARMOR-05) -----------------------------------

test("applyFoeDamageToPlayer: underMin flag — dmg at or under armorMin charges no wear", () => {
  const state = fixedState({
    c: { race: "Human", armor: "Studded", ar: 10, armorMin: 5, armorWP: 10, armorMax: 10, patches: 0 },
  });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);

  let events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([5]), events, { dmg: 5, roll: 3, need: 5 });
  let soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 0, "dmg === armorMin: no wear charged");
  assert.equal(soaked.underMin, true);
  assert.equal("magic" in soaked, false);
  assert.equal(state.c.armorWP, 10);

  events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([5]), events, { dmg: 6, roll: 3, need: 5 });
  soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 6, "dmg === armorMin + 1: full wear charged for a Human");
  assert.equal("underMin" in soaked, false);
  assert.equal(state.c.armorWP, 4);
});

test("applyFoeDamageToPlayer: wear is capped at remaining durability, armorDestroyed fires", () => {
  const state = fixedState({
    c: { race: "Human", armor: "Studded", ar: 15, armorMin: 0, armorWP: 3, armorMax: 20, patches: 0 },
  });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([10]), events, { dmg: 5, roll: 3, need: 5 });
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 3, "capped at what remained, not the full dmg");
  assert.equal(state.c.armorWP, 0);
  assert.ok(events.some((e) => e.type === "armorDestroyed"));
});

test("applyFoeDamageToPlayer: a Dwarf pays Math.ceil(dmg * 0.5) — halved wear", () => {
  const state = fixedState({
    c: { race: "Dwarven", armor: "Studded", ar: 10, armorMin: 0, armorWP: 10, armorMax: 10, patches: 0 },
  });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([5]), events, { dmg: 5, roll: 3, need: 5 });
  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.wear, 3, "ceil(5 * 0.5) = 3");
  assert.equal(soaked.halved, true);
  assert.equal(state.c.armorWP, 7);
});

test("applyFoeDamageToPlayer: roll edge — a soak roll equal to AR soaks, AR + 1 lets the blow through", () => {
  const state = fixedState({
    c: { armor: "Studded", ar: 10, armorMin: 0, armorWP: 10, armorMax: 10, patches: 0 },
  });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);

  let events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([10]), events, { dmg: 5, roll: 3, need: 5 });
  assert.ok(events.some((e) => e.type === "armorSoaked"), "roll === AR soaks");

  events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([11]), events, { dmg: 5, roll: 3, need: 5 });
  assert.ok(events.some((e) => e.type === "struckByFoe"), "roll === AR + 1 lets it through");
  assert.equal(events.some((e) => e.type === "armorSoaked"), false);
});

test("applyFoeDamageToPlayer: magic flag — the Cloak of Armor's plate soak never wears, bag-position independent", () => {
  const foe = fixedFoe();

  const state = fixedState({
    c: {
      race: "Human", armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
      items: [{ n: "Cloak of Armor", eff: { cloakArmor: 1 } }],
    },
  });
  state.combat = fixedCombat([foe]);
  let events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([12]), events, { dmg: 5, roll: 3, need: 5 });
  let soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.magic, true);
  assert.equal(soaked.wear, 0);
  assert.equal("underMin" in soaked, false);
  assert.equal(state.c.armorWP, 15, "unchanged — the cloak's plate took it, not the worn Leather");

  // Same cloak, buried behind a weapon in bag position — identical payload.
  const state2 = fixedState({
    c: {
      race: "Human", armor: "Leather", ar: 6, armorMin: 1, armorWP: 15, armorMax: 15, patches: 0,
      items: [WEAPON("Dagger"), { n: "Cloak of Armor", eff: { cloakArmor: 1 } }],
    },
  });
  state2.combat = fixedCombat([foe]);
  events = [];
  applyFoeDamageToPlayer(state2, foe, fakeRng([12]), events, { dmg: 5, roll: 3, need: 5 });
  soaked = events.find((e) => e.type === "armorSoaked");
  assert.equal(soaked.magic, true);
  assert.equal(soaked.wear, 0);
  assert.equal("underMin" in soaked, false);
  assert.equal(state2.c.armorWP, 15);
});

// --- parity comparables carve-out (ARMOR-03) --------------------------------

test("parity comparables strip left/patches from every armor bag item, leaving other kinds untouched", () => {
  const s = newRun(1);
  s.c.items = [
    { kind: "armor", n: "Plate", armor: "Plate", ar: 15, wp: 45, min: 2, cls: "F", left: 20, patches: 1, txt: "AR 15, 45 hp" },
    { kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0, txt: "Dagger" },
  ];
  for (const comparable of [movementComparable, combatComparable, economyComparable]) {
    const out = comparable(s);
    assert.equal("left" in out.c.items[0], false);
    assert.equal("patches" in out.c.items[0], false);
    assert.equal(out.c.items[0].wp, 45);
    assert.deepEqual(out.c.items[1], s.c.items[1]);
  }
  assert.equal(s.c.items[0].left, 20, "the ORIGINAL is never mutated");
});
