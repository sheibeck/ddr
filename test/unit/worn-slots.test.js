// test/unit/worn-slots.test.js
//
// Phase 37 Plan 02 (GEAR-03) — the worn model's BEHAVIOURS, every one gated
// on `c.worn` being present so no fixture, bot, or un-migrated save changes
// by a byte. Builds directly on Plan 01's WORN_SLOTS/slotFor/carriedItems/
// two-path eff() (test/unit/worn-model.test.js).
//
// Task 1: equipItem/unequipSlot slot branches, autoWearSlot/wearItem, and
//   auto-wear at the four take sites (takeItem/takeFind/takeLoot/
//   takeAllLoot).
// Task 2: useItem slot addressing + the notWorn refusal + engine.js
//   dispatch + actions.js validation + toast/Oracle copy.
// Task 3: the legacy-identity sweep over a real newRun(3) state.
//
// No cross-test-file imports (project convention for these deterministic
// unit suites) — every rng/state helper this file needs is defined or
// imported directly.

import test from "node:test";
import assert from "node:assert/strict";

import { validateAction } from "../../engine/actions.js";
import { applyAction, newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import {
  equipItem,
  unequipSlot,
  takeItem,
  takeFind,
  takeLoot,
  takeAllLoot,
  useItem,
  autoWearSlot,
  wearItem,
} from "../../engine/items.js";
import { TOAST_FOR } from "../../src/browser/toasts.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

/** hero(overrides) — a minimal, fixed level-1 Fighter with `bag: "medium"`
 * (6 slots) and `c.worn = {}` planted by hand (Plan 03 owns the real
 * newRun/load wiring — this plan only needs a state that ALREADY carries the
 * model). Mirrors test/unit/items.test.js's fixedFighter/fixedState shape. */
function hero(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
      maxWP: 55, wp: 55, skills: {},
      weapon: "Club", prof: 0, magicWpn: 0,
      armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      gold: 50, kills: 0, might: 0, ward: null, regen: false, mirror: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null,
      bag: "medium", items: [], worn: {}, motive: "Money", name: "Test Delver",
      ...cOverrides,
    },
    floor: { depth: 1 }, day: 1, steps: 0, combat: null, store: null, beats: null,
    party: [], pendingJoiner: null, pendingFind: null, pendingLoot: [],
    dead: false, won: false,
    ...rest,
  };
}

/** legacyHero(overrides) — the SAME shape but with NO `c.worn` key at all
 * (the un-migrated / fixture / bot state every existing caller sees). */
function legacyHero(overrides = {}) {
  const state = hero(overrides);
  delete state.c.worn;
  return state;
}

// Item builders — fresh objects per call, never aliasing content, matching
// content/treasure-tables.js's real rows.
function RING() {
  return { kind: "jewel", n: "Ring of Power", eff: { dmg: 1 }, txt: "+1 damage to all attacks" };
}
function GAUNTLET() {
  return { kind: "jewel", n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "one size larger" };
}
function CLOAK_SPEED() {
  return { kind: "cloak", n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" };
}
function OAK_STAFF() {
  return { kind: "staff", n: "Oak Staff", use: "stone", every: 250, txt: "turns 2 squares of opponents to stone" };
}
function POPLAR_STAFF() {
  return { kind: "staff", n: "Poplar Staff", use: "heal", every: 250, txt: "1d20+10 wp to up to 6" };
}
function POTION() {
  return { kind: "potion", n: "Healing potion", eff2: "heal", txt: "restores wp" };
}
function PICKS() {
  return { kind: "picks", n: "Lockpicks", txt: "1-5 on d10 against any lock" };
}
function filler(count) {
  return Array.from({ length: count }, (_, idx) => ({ kind: "picks", n: `Filler ${idx}`, txt: "filler" }));
}

/** fakeRng(seq) — verbatim style of test/unit/item-combat-gate.js's helper. */
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

/* ============================================================
 * Task 1: equipItem — the slot branch (swap on an occupied slot)
 * ============================================================ */

test("equipItem (new model): equipping an unworn ring moves it to c.worn.ring and frees the bag slot", () => {
  const ring = RING();
  const state = hero({ c: { items: [ring] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.worn.ring, ring);
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: ring, slot: "ring" }]);
  assert.equal("replaced" in events[0], false, "no replaced key when nothing was worn");
});

test("equipItem (new model): equipping into an occupied slot is a direct swap — the old item lands at the freed bag index with a replaced payload", () => {
  const ringA = RING();
  const ringB = RING();
  const potion = POTION();
  const state = hero({ c: { worn: { ring: ringA }, items: [potion, ringB] } });
  const events = equipItem(state, 1, []);
  assert.equal(state.c.worn.ring, ringB);
  assert.deepStrictEqual(state.c.items, [potion, ringA]);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: ringB, slot: "ring", replaced: ringA }]);
});

test("equipItem (new model): a ring and a cloak occupy different slots — equipping one never displaces the other", () => {
  const ring = RING();
  const cloak = CLOAK_SPEED();
  const state = hero({ c: { worn: { ring }, items: [cloak] } });
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(state.c.worn, { ring, cloak });
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: cloak, slot: "cloak" }]);
});

test("equipItem (new model): a non-Magic-User equipping a staff is refused wrongClass; nothing moves", () => {
  const staff = OAK_STAFF();
  const state = hero({ c: { cls: "Fighter", items: [staff] } });
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: staff, reason: "wrongClass" }]);
  assert.deepStrictEqual(state.c.items, [staff]);
  assert.deepStrictEqual(state.c.worn, {});
});

test("equipItem (new model): a Magic User equipping a staff wears it", () => {
  const staff = OAK_STAFF();
  const state = hero({ c: { cls: "Magic User", items: [staff] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.worn.staff, staff);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: staff, slot: "staff" }]);
});

test("equipItem (new model): potions/picks are still not equippable", () => {
  for (const it of [POTION(), PICKS()]) {
    const state = hero({ c: { items: [it] } });
    const events = equipItem(state, 0, []);
    assert.deepStrictEqual(events, [{ type: "equipRejected", item: it, reason: "notEquippable" }]);
  }
});

test("equipItem legacy identity: without c.worn, a ring/cloak/staff still gets notEquippable and c is byte-identical", () => {
  for (const it of [RING(), CLOAK_SPEED(), OAK_STAFF()]) {
    const state = legacyHero({ c: { cls: "Magic User", items: [it] } });
    const before = JSON.stringify(state);
    const events = equipItem(state, 0, []);
    assert.deepStrictEqual(events, [{ type: "equipRejected", item: it, reason: "notEquippable" }]);
    assert.equal(JSON.stringify(state), before, "legacy state must be byte-identical after a refused equip");
  }
});

/* ============================================================
 * Task 1: unequipSlot — extends to the six new slots
 * ============================================================ */

test("unequipSlot: a free ring slot stows via stowItem and pushes itemUnequipped (delete, not null)", () => {
  const ring = RING();
  const state = hero({ c: { worn: { ring }, items: [] } });
  const events = unequipSlot(state, "ring", []);
  assert.equal("ring" in state.c.worn, false, "delete, not null");
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.deepStrictEqual(events, [{ type: "itemUnequipped", item: ring, slot: "ring" }]);
});

test("unequipSlot: a full bag pushes bagFull and leaves the ring worn", () => {
  const ring = RING();
  const state = hero({ c: { worn: { ring }, items: filler(6) } });
  const events = unequipSlot(state, "ring", []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "bagFull");
  assert.equal(state.c.worn.ring, ring, "the ring stays worn");
  assert.equal(state.c.items.length, 6);
});

test("unequipSlot: an empty slot is a silent no-op", () => {
  const state = hero({ c: { worn: {} } });
  const events = unequipSlot(state, "helm", []);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(state.c.worn, {});
});

test("unequipSlot on a legacy state (no worn) for ring is a no-op", () => {
  const state = legacyHero();
  const events = unequipSlot(state, "ring", []);
  assert.deepStrictEqual(events, []);
  assert.equal("worn" in state.c, false);
});

/* ============================================================
 * Task 1: autoWearSlot / wearItem
 * ============================================================ */

test("autoWearSlot: returns the slot key for an unworn slot item, null when occupied/legacy/non-slot/wrong-class staff", () => {
  const ring = RING();
  assert.equal(autoWearSlot(hero({ c: { worn: {} } }), ring), "ring");
  assert.equal(autoWearSlot(hero({ c: { worn: { ring: RING() } } }), ring), null, "occupied slot");
  assert.equal(autoWearSlot(legacyHero(), ring), null, "legacy state (no worn key)");
  assert.equal(autoWearSlot(hero({ c: { worn: {} } }), POTION()), null, "not a slot item");
  const staff = OAK_STAFF();
  assert.equal(autoWearSlot(hero({ c: { cls: "Fighter", worn: {} } }), staff), null, "staff on a Fighter");
  assert.equal(autoWearSlot(hero({ c: { cls: "Magic User", worn: {} } }), staff), "staff", "staff on a Magic User");
});

test("wearItem: assigns the item into c.worn[slot] (same object) and pushes itemEquipped", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} } });
  const events = wearItem(state, ring, "ring", []);
  assert.equal(state.c.worn.ring, ring);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: ring, slot: "ring" }]);
});

/* ============================================================
 * Task 1: auto-wear at the four take sites
 * ============================================================ */

test("takeFind (new model): an empty slot auto-wears, consumes no bag slot, take-then-wear event order", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingFind: ring });
  const events = takeFind(state, []);
  assert.equal(state.pendingFind, null);
  assert.deepStrictEqual(state.c.items, []);
  assert.equal(state.c.worn.ring, ring);
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "ring" },
  ]);
});

test("takeFind (new model): an occupied slot bags the item exactly as today", () => {
  const ringA = RING();
  const ringB = RING();
  const state = hero({ c: { worn: { ring: ringA }, items: [] }, pendingFind: ringB });
  const events = takeFind(state, []);
  assert.deepStrictEqual(state.c.items, [ringB]);
  assert.equal(state.c.worn.ring, ringA);
  assert.deepStrictEqual(events, [{ type: "findTaken", item: ringB }]);
});

test("takeFind (new model): a FULL bag with an empty slot still wears — wearing needs no slot, no bagFull", () => {
  const ring = RING();
  const state = hero({ c: { worn: {}, items: filler(6) }, pendingFind: ring });
  const events = takeFind(state, []);
  assert.equal(state.c.worn.ring, ring);
  assert.equal(state.c.items.length, 6);
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "ring" },
  ]);
});

test("takeFind legacy identity: without c.worn, today's bag-only behaviour is byte-identical", () => {
  const ring = RING();
  const state = legacyHero({ pendingFind: ring });
  const events = takeFind(state, []);
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.equal(state.pendingFind, null);
  assert.deepStrictEqual(events, [{ type: "findTaken", item: ring }]);
  assert.equal("worn" in state.c, false);
});

test("takeLoot non-equip (new model): mirrors takeFind — empty slot wears, occupied slot bags", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingLoot: [ring] });
  const events = takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.ring, ring);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "ring" },
  ]);

  const ringA = RING();
  const ringB = RING();
  const state2 = hero({ c: { worn: { ring: ringA }, items: [] }, pendingLoot: [ringB] });
  const events2 = takeLoot(state2, 0, false, []);
  assert.deepStrictEqual(state2.c.items, [ringB]);
  assert.deepStrictEqual(events2, [{ type: "lootTaken", item: ringB }]);
});

test("takeLoot equip:true on a slot item stays notEquippable (deliberately unchanged)", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingLoot: [ring] });
  const events = takeLoot(state, 0, true, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: ring, reason: "notEquippable" }]);
  assert.deepStrictEqual(state.pendingLoot, [ring], "pile untouched");
});

test("takeAllLoot (new model): auto-wears the first slot item per empty slot, bags the rest, in pile order", () => {
  const ringA = RING();
  const ringB = RING();
  const potion = POTION();
  const state = hero({ c: { worn: {} }, pendingLoot: [ringA, ringB, potion] });
  const events = takeAllLoot(state, []);
  assert.equal(state.c.worn.ring, ringA);
  assert.deepStrictEqual(state.c.items, [ringB, potion]);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ringA },
    { type: "itemEquipped", item: ringA, slot: "ring" },
    { type: "lootTaken", item: ringB },
    { type: "lootTaken", item: potion },
  ]);
});

test("takeAllLoot (new model): a full bag with an empty ring slot still wears ringA, one bagFull for ringB", () => {
  const ringA = RING();
  const ringB = RING();
  const state = hero({ c: { worn: {}, items: filler(6) }, pendingLoot: [ringA, ringB] });
  const events = takeAllLoot(state, []);
  assert.equal(state.c.worn.ring, ringA);
  assert.deepStrictEqual(state.pendingLoot, [ringB]);
  const bagFulls = events.filter((e) => e.type === "bagFull");
  assert.equal(bagFulls.length, 1);
  assert.deepStrictEqual(events[0], { type: "lootTaken", item: ringA });
  assert.deepStrictEqual(events[1], { type: "itemEquipped", item: ringA, slot: "ring" });
});

test("takeItem (new model): a Magic User taking a staff auto-wears it; a Fighter taking a ring auto-wears it", () => {
  const staff = OAK_STAFF();
  const mu = hero({ c: { cls: "Magic User", worn: {} } });
  const events = takeItem(mu, staff, []);
  assert.equal(mu.c.worn.staff, staff);
  assert.deepStrictEqual(events, [
    { type: "itemGiven", item: staff },
    { type: "itemEquipped", item: staff, slot: "staff" },
  ]);

  const ring = RING();
  const fighter = hero({ c: { cls: "Fighter", worn: {} } });
  const events2 = takeItem(fighter, ring, []);
  assert.equal(fighter.c.worn.ring, ring);
  assert.deepStrictEqual(events2, [
    { type: "itemGiven", item: ring },
    { type: "itemEquipped", item: ring, slot: "ring" },
  ]);
});

test("takeItem: a Fighter taking a staff is still refused wrongClass before any wear check", () => {
  const staff = OAK_STAFF();
  const fighter = hero({ c: { cls: "Fighter", worn: {} } });
  const events = takeItem(fighter, staff, []);
  assert.deepStrictEqual(events, [{ type: "itemRejected", item: staff, reason: "wrongClass" }]);
  assert.deepStrictEqual(fighter.c.worn, {});
});

test("takeItem legacy identity: without c.worn, giveItem-only behaviour is unchanged", () => {
  const ring = RING();
  const state = legacyHero({ c: { cls: "Fighter" } });
  const events = takeItem(state, ring, []);
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.deepStrictEqual(events, [{ type: "itemGiven", item: ring }]);
});

test("wearing/swapping/unequipping a slot item never touches maxWP/wp (Plan 01's no-slot-row-carries-eff.wp tripwire)", () => {
  const ring = RING();
  const state = hero({ c: { worn: {}, items: [ring], maxWP: 55, wp: 40 } });
  equipItem(state, 0, []);
  assert.equal(state.c.maxWP, 55);
  assert.equal(state.c.wp, 40);
  unequipSlot(state, "ring", []);
  assert.equal(state.c.maxWP, 55);
  assert.equal(state.c.wp, 40);
});

test("validateAction: unequipSlot accepts weapon/armor and the six worn slots; rejects unknown strings/non-strings", () => {
  for (const slot of ["ring", "bracelet", "amulet", "helm", "cloak", "staff", "weapon", "armor"]) {
    assert.equal(validateAction({ type: "unequipSlot", slot }).ok, true, slot);
  }
  const bad = validateAction({ type: "unequipSlot", slot: "hat" });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /ring|bracelet|amulet|helm|cloak|staff|WORN_SLOTS/);
  assert.equal(validateAction({ type: "unequipSlot", slot: 3 }).ok, false);
});
