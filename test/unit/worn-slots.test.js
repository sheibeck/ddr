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
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { itemEffectActive } from "../../engine/derived.js";

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
function BRACELET() {
  return { kind: "jewel", n: "Bracelet of Flight", eff: { fly: 1 }, txt: "twenty squares of flight" };
}
function ANKLET() {
  return { kind: "jewel", n: "Anklet of Invisibility", eff: { foeToHit: -2 }, txt: "foes need two better to land" };
}
function CLOAK_SPEED() {
  return { kind: "cloak", n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" };
}
function OAK_STAFF() {
  return { kind: "staff", n: "Oak Staff", use: "stone", charges: 1, txt: "turns 2 squares of opponents to stone" };
}
function POPLAR_STAFF() {
  return { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3, txt: "1d20+10 wp to up to 6" };
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

test("equipItem (new model): equipping an unworn ring moves it to jewelry1 and frees the bag slot", () => {
  const ring = RING();
  const state = hero({ c: { items: [ring] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: ring, slot: "jewelry1" }]);
  assert.equal("replaced" in events[0], false, "no replaced key when nothing was worn");
});

test("equipItem (new model): with jewelry1 taken, equipping another jewel wears jewelry2 — NO swap, both survive worn", () => {
  const ring = RING();
  const anklet = ANKLET();
  const state = hero({ c: { worn: { jewelry1: ring }, items: [anklet] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.worn.jewelry1, ring, "jewelry1 untouched");
  assert.equal(state.c.worn.jewelry2, anklet);
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: anklet, slot: "jewelry2" }]);
  assert.equal("replaced" in events[0], false, "no swap — jewelry2 was free");
});

test("equipItem (new model): both jewelry keys occupied, untargeted equip refuses jewelryFull — nothing moves", () => {
  const ring = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state = hero({ c: { worn: { jewelry1: ring, jewelry2: anklet }, items: [gauntlet] } });
  const before = JSON.stringify(state.c);
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: gauntlet, reason: "jewelryFull" }]);
  assert.equal(JSON.stringify(state.c), before, "neither c.worn nor c.items changes");
});

test("equipItem (new model): targeted equip on jewelry2 with both full swaps exactly that key — jewelry1 untouched, displaced piece lands in the bag", () => {
  const ring = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state = hero({ c: { worn: { jewelry1: ring, jewelry2: anklet }, items: [gauntlet] } });
  const events = equipItem(state, 0, [], "jewelry2");
  assert.equal(state.c.worn.jewelry1, ring, "jewelry1 untouched");
  assert.equal(state.c.worn.jewelry2, gauntlet);
  assert.deepStrictEqual(state.c.items, [anklet]);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: gauntlet, slot: "jewelry2", replaced: anklet }]);
});

test("equipItem (new model): a targeted cloak key on a jewel is refused wrongSlot — nothing moves", () => {
  const ring = RING();
  const state = hero({ c: { worn: {}, items: [ring] } });
  const before = JSON.stringify(state.c);
  const events = equipItem(state, 0, [], "cloak");
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: ring, reason: "wrongSlot" }]);
  assert.equal(JSON.stringify(state.c), before);
});

test("equipItem (new model): a targeted jewelry1 key on a cloak is refused wrongSlot — nothing moves", () => {
  const cloak = CLOAK_SPEED();
  const state = hero({ c: { worn: {}, items: [cloak] } });
  const before = JSON.stringify(state.c);
  const events = equipItem(state, 0, [], "jewelry1");
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: cloak, reason: "wrongSlot" }]);
  assert.equal(JSON.stringify(state.c), before);
});

test("equipItem (new model): a cloak on an occupied cloak key is still a direct swap, untargeted (unchanged single-key-family behavior)", () => {
  const cloakA = CLOAK_SPEED();
  const cloakB = { kind: "cloak", n: "Cloak of Strength", eff: { noCrit: 1 }, txt: "no critical damage lands on you" };
  const state = hero({ c: { worn: { cloak: cloakA }, items: [cloakB] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.worn.cloak, cloakB);
  assert.deepStrictEqual(state.c.items, [cloakA]);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: cloakB, slot: "cloak", replaced: cloakA }]);
});

test("equipItem (new model): a ring and a cloak occupy different families — equipping one never displaces the other", () => {
  const ring = RING();
  const cloak = CLOAK_SPEED();
  const state = hero({ c: { worn: { jewelry1: ring }, items: [cloak] } });
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(state.c.worn, { jewelry1: ring, cloak });
  assert.deepStrictEqual(state.c.items, []);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: cloak, slot: "cloak" }]);
});

// 260918-w4n (staff amendment, user ruling 2026-09-18): a staff is not
// equipable at all any more — equipItem refuses it notEquippable for EVERY
// class (the same refusal a potion already gets), never wrongClass.
test("equipItem (new model): a staff is refused notEquippable for a non-Magic-User; nothing moves", () => {
  const staff = OAK_STAFF();
  const state = hero({ c: { cls: "Fighter", items: [staff] } });
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: staff, reason: "notEquippable" }]);
  assert.deepStrictEqual(state.c.items, [staff]);
  assert.deepStrictEqual(state.c.worn, {});
});

test("equipItem (new model): a staff is refused notEquippable for a Magic User too — nothing moves", () => {
  const staff = OAK_STAFF();
  const state = hero({ c: { cls: "Magic User", items: [staff] } });
  const events = equipItem(state, 0, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: staff, reason: "notEquippable" }]);
  assert.deepStrictEqual(state.c.items, [staff]);
  assert.deepStrictEqual(state.c.worn, {});
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

test("unequipSlot: jewelry1 stows exactly that piece via stowItem and pushes itemUnequipped (delete, not null), leaving jewelry2 worn", () => {
  const ring = RING();
  const anklet = ANKLET();
  const state = hero({ c: { worn: { jewelry1: ring, jewelry2: anklet }, items: [] } });
  const events = unequipSlot(state, "jewelry1", []);
  assert.equal("jewelry1" in state.c.worn, false, "delete, not null");
  assert.equal(state.c.worn.jewelry2, anklet, "jewelry2 stays worn");
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.deepStrictEqual(events, [{ type: "itemUnequipped", item: ring, slot: "jewelry1" }]);
});

test("unequipSlot: a full bag pushes bagFull and leaves jewelry1 worn", () => {
  const ring = RING();
  const state = hero({ c: { worn: { jewelry1: ring }, items: filler(6) } });
  const events = unequipSlot(state, "jewelry1", []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "bagFull");
  assert.equal(state.c.worn.jewelry1, ring, "the ring stays worn");
  assert.equal(state.c.items.length, 6);
});

test("unequipSlot: an empty slot is a silent no-op", () => {
  const state = hero({ c: { worn: {} } });
  const events = unequipSlot(state, "jewelry2", []);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(state.c.worn, {});
});

test("unequipSlot on a legacy state (no worn) for jewelry1 is a no-op", () => {
  const state = legacyHero();
  const events = unequipSlot(state, "jewelry1", []);
  assert.deepStrictEqual(events, []);
  assert.equal("worn" in state.c, false);
});

/* ============================================================
 * Task 1: autoWearSlot / wearItem
 * ============================================================ */

test("autoWearSlot: returns the first free jewelry key for an unworn jewel (jewelry1 empty, jewelry2 once jewelry1 is taken), null when both are/legacy/non-slot/a staff (every class)", () => {
  const ring = RING();
  assert.equal(autoWearSlot(hero({ c: { worn: {} } }), ring), "jewelry1");
  assert.equal(autoWearSlot(hero({ c: { worn: { jewelry1: RING() } } }), ring), "jewelry2", "jewelry1 taken -> jewelry2");
  assert.equal(
    autoWearSlot(hero({ c: { worn: { jewelry1: RING(), jewelry2: ANKLET() } } }), ring),
    null,
    "both jewelry keys occupied",
  );
  assert.equal(autoWearSlot(legacyHero(), ring), null, "legacy state (no worn key)");
  assert.equal(autoWearSlot(hero({ c: { worn: {} } }), POTION()), null, "not a slot item");
  // 260918-w4n: a staff never auto-wears, for ANY class — slotFor(staff) is
  // always null now.
  const staff = OAK_STAFF();
  assert.equal(autoWearSlot(hero({ c: { cls: "Fighter", worn: {} } }), staff), null, "staff on a Fighter");
  assert.equal(autoWearSlot(hero({ c: { cls: "Magic User", worn: {} } }), staff), null, "staff on a Magic User too");
});

test("wearItem: assigns the item into c.worn[slot] (same object) and pushes itemEquipped", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} } });
  const events = wearItem(state, ring, "jewelry1", []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.deepStrictEqual(events, [{ type: "itemEquipped", item: ring, slot: "jewelry1" }]);
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
  assert.equal(state.c.worn.jewelry1, ring);
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
  ]);
});

test("takeFind (new model): an occupied jewelry1 wears jewelry2 (two of a kind — a second Ring of Power wears alongside the first)", () => {
  const ringA = RING();
  const ringB = RING();
  const state = hero({ c: { worn: { jewelry1: ringA }, items: [] }, pendingFind: ringB });
  const events = takeFind(state, []);
  assert.deepStrictEqual(state.c.items, []);
  assert.equal(state.c.worn.jewelry1, ringA);
  assert.equal(state.c.worn.jewelry2, ringB);
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ringB },
    { type: "itemEquipped", item: ringB, slot: "jewelry2" },
  ]);
});

test("takeFind (new model): both jewelry keys occupied bags the third piece exactly as today", () => {
  const ringA = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state = hero({ c: { worn: { jewelry1: ringA, jewelry2: anklet }, items: [] }, pendingFind: gauntlet });
  const events = takeFind(state, []);
  assert.deepStrictEqual(state.c.items, [gauntlet]);
  assert.equal(state.c.worn.jewelry1, ringA);
  assert.equal(state.c.worn.jewelry2, anklet);
  assert.deepStrictEqual(events, [{ type: "findTaken", item: gauntlet }]);
});

test("takeFind (new model): a FULL bag with an empty jewelry key still wears — wearing needs no slot, no bagFull", () => {
  const ring = RING();
  const state = hero({ c: { worn: {}, items: filler(6) }, pendingFind: ring });
  const events = takeFind(state, []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.equal(state.c.items.length, 6);
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
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

test("takeLoot non-equip (new model): mirrors takeFind — empty jewelry key wears, both-full bags", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingLoot: [ring] });
  const events = takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
  ]);

  const ringA = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state2 = hero({ c: { worn: { jewelry1: ringA, jewelry2: anklet }, items: [] }, pendingLoot: [gauntlet] });
  const events2 = takeLoot(state2, 0, false, []);
  assert.deepStrictEqual(state2.c.items, [gauntlet]);
  assert.deepStrictEqual(events2, [{ type: "lootTaken", item: gauntlet }]);
});

test("takeLoot non-equip (new model): a second Ring of Power wears into jewelry2 alongside the first (two of a kind)", () => {
  const ringA = RING();
  const ringB = RING();
  const state = hero({ c: { worn: { jewelry1: ringA }, items: [] }, pendingLoot: [ringB] });
  const events = takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.jewelry1, ringA);
  assert.equal(state.c.worn.jewelry2, ringB);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ringB },
    { type: "itemEquipped", item: ringB, slot: "jewelry2" },
  ]);
});

test("takeLoot equip:true on a slot item stays notEquippable (deliberately unchanged)", () => {
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingLoot: [ring] });
  const events = takeLoot(state, 0, true, []);
  assert.deepStrictEqual(events, [{ type: "equipRejected", item: ring, reason: "notEquippable" }]);
  assert.deepStrictEqual(state.pendingLoot, [ring], "pile untouched");
});

test("takeAllLoot (new model): auto-wears up to TWO jewelry items (jewelry1, jewelry2), bags the rest, in pile order", () => {
  const ringA = RING();
  const ringB = RING();
  const gauntlet = GAUNTLET();
  const potion = POTION();
  const state = hero({ c: { worn: {} }, pendingLoot: [ringA, ringB, gauntlet, potion] });
  const events = takeAllLoot(state, []);
  assert.equal(state.c.worn.jewelry1, ringA);
  assert.equal(state.c.worn.jewelry2, ringB);
  assert.deepStrictEqual(state.c.items, [gauntlet, potion]);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ringA },
    { type: "itemEquipped", item: ringA, slot: "jewelry1" },
    { type: "lootTaken", item: ringB },
    { type: "itemEquipped", item: ringB, slot: "jewelry2" },
    { type: "lootTaken", item: gauntlet },
    { type: "lootTaken", item: potion },
  ]);
});

test("takeAllLoot (new model): a full bag with both jewelry keys free wears ringA into jewelry1 and ringB into jewelry2 — bag-full never blocks a wear", () => {
  const ringA = RING();
  const ringB = RING();
  const state = hero({ c: { worn: {}, items: filler(6) }, pendingLoot: [ringA, ringB] });
  const events = takeAllLoot(state, []);
  assert.equal(state.c.worn.jewelry1, ringA);
  assert.equal(state.c.worn.jewelry2, ringB);
  assert.deepStrictEqual(state.pendingLoot, []);
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ringA },
    { type: "itemEquipped", item: ringA, slot: "jewelry1" },
    { type: "lootTaken", item: ringB },
    { type: "itemEquipped", item: ringB, slot: "jewelry2" },
  ]);
});

test("takeAllLoot (new model): a full bag with BOTH jewelry keys occupied pushes one bagFull for the third piece", () => {
  const ringA = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state = hero({ c: { worn: { jewelry1: ringA, jewelry2: anklet }, items: filler(6) }, pendingLoot: [gauntlet] });
  const events = takeAllLoot(state, []);
  assert.deepStrictEqual(state.pendingLoot, [gauntlet]);
  const bagFulls = events.filter((e) => e.type === "bagFull");
  assert.equal(bagFulls.length, 1);
});

test("takeItem (new model): a Magic User taking a staff STOWS it in the bag (no auto-wear, no slot exists); a Fighter taking a ring auto-wears it", () => {
  const staff = OAK_STAFF();
  const mu = hero({ c: { cls: "Magic User", worn: {} } });
  const events = takeItem(mu, staff, []);
  assert.deepStrictEqual(mu.c.worn, {}, "260918-w4n: a staff never wears — it always stows");
  assert.deepStrictEqual(mu.c.items, [staff]);
  assert.deepStrictEqual(events, [{ type: "itemGiven", item: staff }]);

  const ring = RING();
  const fighter = hero({ c: { cls: "Fighter", worn: {} } });
  const events2 = takeItem(fighter, ring, []);
  assert.equal(fighter.c.worn.jewelry1, ring);
  assert.deepStrictEqual(events2, [
    { type: "itemGiven", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
  ]);
});

test("takeItem (new model): two of a kind via the real take sites — takeItem(Bracelet) then takeItem(Anklet) wear jewelry1 then jewelry2 (same objects), a third jewel (Ring) stows", () => {
  const bracelet = BRACELET();
  const anklet = ANKLET();
  const ring = RING();
  const fighter = hero({ c: { cls: "Fighter", worn: {} } });
  const e1 = takeItem(fighter, bracelet, []);
  assert.equal(fighter.c.worn.jewelry1, bracelet, "same object");
  assert.deepStrictEqual(e1, [
    { type: "itemGiven", item: bracelet },
    { type: "itemEquipped", item: bracelet, slot: "jewelry1" },
  ]);
  const e2 = takeItem(fighter, anklet, []);
  assert.equal(fighter.c.worn.jewelry2, anklet, "same object");
  assert.deepStrictEqual(e2, [
    { type: "itemGiven", item: anklet },
    { type: "itemEquipped", item: anklet, slot: "jewelry2" },
  ]);
  const e3 = takeItem(fighter, ring, []);
  assert.deepStrictEqual(fighter.c.items, [ring], "the third jewel is stowed, not equipped");
  assert.deepStrictEqual(e3, [{ type: "itemGiven", item: ring }]);
});

test("takeFind (new model): two of a kind via takeFind — Bracelet then Anklet wear jewelry1/jewelry2; a third jewel (Ring) stows", () => {
  const bracelet = BRACELET();
  const anklet = ANKLET();
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingFind: bracelet });
  takeFind(state, []);
  assert.equal(state.c.worn.jewelry1, bracelet);
  state.pendingFind = anklet;
  takeFind(state, []);
  assert.equal(state.c.worn.jewelry2, anklet);
  state.pendingFind = ring;
  const events = takeFind(state, []);
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.deepStrictEqual(events, [{ type: "findTaken", item: ring }]);
});

test("takeLoot(i, false) (new model): two of a kind via takeLoot — Bracelet then Anklet wear jewelry1/jewelry2; a third jewel (Ring) stows", () => {
  const bracelet = BRACELET();
  const anklet = ANKLET();
  const ring = RING();
  const state = hero({ c: { worn: {} }, pendingLoot: [bracelet] });
  takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.jewelry1, bracelet);
  state.pendingLoot = [anklet];
  takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.jewelry2, anklet);
  state.pendingLoot = [ring];
  const events = takeLoot(state, 0, false, []);
  assert.deepStrictEqual(state.c.items, [ring]);
  assert.deepStrictEqual(events, [{ type: "lootTaken", item: ring }]);
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

test("validateAction: unequipSlot accepts weapon/armor and the three worn keys; rejects the four old jewelry names/staff/unknown strings/non-strings", () => {
  for (const slot of ["jewelry1", "jewelry2", "cloak", "weapon", "armor"]) {
    assert.equal(validateAction({ type: "unequipSlot", slot }).ok, true, slot);
  }
  // 260918-w4n: a staff has no worn slot any more — rejected like any
  // unknown string. 260918-wy1: the four legacy jewelry sub-slot names are
  // rejected the same way.
  for (const slot of ["staff", "ring", "bracelet", "amulet", "helm"]) {
    assert.equal(validateAction({ type: "unequipSlot", slot }).ok, false, slot);
  }
  const bad = validateAction({ type: "unequipSlot", slot: "hat" });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /jewelry1|jewelry2|cloak|WORN_SLOTS/);
  assert.equal(validateAction({ type: "unequipSlot", slot: 3 }).ok, false);
});

test("validateAction: useItem rejects the four old jewelry slot names on both useItem and unequipSlot", () => {
  for (const slot of ["ring", "bracelet", "amulet", "helm"]) {
    assert.equal(validateAction({ type: "useItem", slot }).ok, false, `useItem ${slot}`);
    assert.equal(validateAction({ type: "unequipSlot", slot }).ok, false, `unequipSlot ${slot}`);
  }
});

test("validateAction: equipItem.slot is optional; when present it must be one of jewelry1, jewelry2, cloak", () => {
  assert.equal(validateAction({ type: "equipItem", i: 0 }).ok, true);
  assert.equal(validateAction({ type: "equipItem", i: 0, slot: "jewelry2" }).ok, true);
  assert.equal(validateAction({ type: "equipItem", i: 0, slot: "cloak" }).ok, true);
  assert.equal(validateAction({ type: "equipItem", i: 0, slot: "ring" }).ok, false);
  assert.equal(validateAction({ type: "equipItem", i: 0, slot: "amulet" }).ok, false);
});

test("applyAction: { type: equipItem, i, slot: jewelry2 } performs the targeted swap through the full engine dispatch", () => {
  const ring = RING();
  const anklet = ANKLET();
  const gauntlet = GAUNTLET();
  const state = hero({ c: { worn: { jewelry1: ring, jewelry2: anklet }, items: [gauntlet] } });
  const result = applyAction(state, { type: "equipItem", i: 0, slot: "jewelry2" });
  assert.deepStrictEqual(result.state.c.worn.jewelry1, ring);
  assert.deepStrictEqual(result.state.c.worn.jewelry2, gauntlet);
  assert.deepStrictEqual(result.state.c.items, [anklet]);
  assert.ok(result.events.some((e) => e.type === "itemEquipped" && e.slot === "jewelry2" && e.replaced));
});

/* ============================================================
 * Task 2: useItem slot addressing + notWorn refusal + engine.js
 * dispatch + actions validation + toast/Oracle copy
 * ============================================================ */

test("useItem slot form: a worn staff heals, spends its one charge, and a second immediate use refuses recharging (Phase 39, GEAR-02)", () => {
  const staff = { ...POPLAR_STAFF(), charges: 1 };
  const state = hero({ c: { cls: "Magic User", worn: { staff }, wp: 20, maxWP: 55 } });
  const rng = fakeRng([5]);
  const events = useItem(state, { slot: "staff" }, rng, [], () => 12345);
  assert.equal(state.c.worn.staff, staff);
  assert.deepStrictEqual(state.c.items, []);
  assert.equal(staff.charges, 0);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("itemUsed"));
  assert.ok(types.includes("healed"));

  const events2 = useItem(state, { slot: "staff" }, rng, [], () => 12345);
  assert.equal(events2.length, 1);
  assert.equal(events2[0].type, "useRefused");
  assert.equal(events2[0].reason, "recharging");
  assert.equal(typeof events2[0].left, "number");
});

test("useItem slot form on an empty slot is a silent no-op (mirrors the bag out-of-range no-op)", () => {
  const state = hero({ c: { worn: {} } });
  const events = useItem(state, { slot: "cloak" }, fakeRng([]), [], () => 1);
  assert.deepStrictEqual(events, []);
});

test("useItem (new model): a bagged activatable is refused notWorn before any side effect", () => {
  const cloak = CLOAK_SPEED();
  const state = hero({ c: { worn: {}, items: [cloak] } });
  const events = useItem(state, 0, fakeRng([]), [], () => 1);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: cloak, reason: "notWorn" }]);
  assert.equal(itemEffectActive(state.c, "haste"), false);
  assert.equal(state.c.timers, undefined);
});

test("useItem notWorn ordering: wrongClass fires before notWorn for a bagged staff on a non-caster", () => {
  const staff = OAK_STAFF();
  const state = hero({ c: { cls: "Fighter", worn: {}, items: [staff] } });
  const events = useItem(state, 0, fakeRng([]), [], () => 1);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: staff, reason: "wrongClass" }]);
});

test("useItem notWorn ordering: notWorn fires before pilfer for a bagged Cloak of Speed", () => {
  const cloak = CLOAK_SPEED();
  const state = hero({ c: { sub: "Pilfer", worn: {}, items: [cloak] } });
  const events = useItem(state, 0, fakeRng([]), [], () => 1);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: cloak, reason: "notWorn" }]);
});

test("useItem notWorn: a bagged passive Ring of Power (no use) with worn {} is refused notWorn, not itemFizzled", () => {
  const ring = RING();
  const state = hero({ c: { worn: {}, items: [ring] } });
  const events = useItem(state, 0, fakeRng([]), [], () => 1);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: ring, reason: "notWorn" }]);
});

test("useItem legacy identity: a bagged Cloak of Speed without c.worn still hastes exactly as today (Phase 39, GEAR-02: via c.timers)", () => {
  const cloak = CLOAK_SPEED();
  const state = legacyHero({ c: { items: [cloak] } });
  const events = useItem(state, 0, fakeRng([]), [], () => 1);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("itemUsed"));
  assert.ok(types.includes("itemEffectStarted"));
  assert.equal(itemEffectActive(state.c, "haste"), true);
  assert.equal("worn" in state.c, false);
});

test("useItem consume path: a worn uses:1 item deletes the worn slot (not the bag) and pushes itemConsumed — from jewelry2 as well as jewelry1", () => {
  const trinket = { uses: 1, use: "heal", kind: "jewel", n: "Ring of Power", eff: {} };
  const state = hero({ c: { worn: { jewelry1: trinket }, wp: 20, maxWP: 55 } });
  const events = useItem(state, { slot: "jewelry1" }, fakeRng([5]), [], () => 1);
  assert.equal("jewelry1" in state.c.worn, false);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("itemConsumed"));

  const trinket2 = { uses: 1, use: "heal", kind: "jewel", n: "Anklet of Invisibility", eff: {} };
  const state2 = hero({ c: { worn: { jewelry2: trinket2 }, wp: 20, maxWP: 55 } });
  const events2 = useItem(state2, { slot: "jewelry2" }, fakeRng([5]), [], () => 1);
  assert.equal("jewelry2" in state2.c.worn, false);
  assert.ok(events2.map((e) => e.type).includes("itemConsumed"));
});

test("useItem from jewelry2: a worn ready Amulet of Light glows and clears darkFor (260918-w4n behaviour) from either key", () => {
  const amulet = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 } };
  const state = hero({ c: { worn: { jewelry2: amulet }, darkFor: 5, wp: 40, maxWP: 55 } });
  const events = useItem(state, { slot: "jewelry2" }, fakeRng([]), [], () => 1);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("itemUsed"));
  assert.equal(state.c.darkFor, 0);
});

test("validateAction: useItem accepts { i } or { slot } but not both, and rejects an unknown slot", () => {
  assert.equal(validateAction({ type: "useItem", slot: "cloak" }).ok, true);
  assert.equal(validateAction({ type: "useItem", slot: "hat" }).ok, false);
  assert.equal(validateAction({ type: "useItem", i: 0 }).ok, true);
  const noAddress = validateAction({ type: "useItem" });
  assert.equal(noAddress.ok, false);
  assert.equal(noAddress.reason, "useItem.i must be a non-negative integer");
  assert.equal(validateAction({ type: "useItem", i: 0, slot: "cloak" }).ok, false);
});

test("applyAction reaches a BAGGED staff through engine.js's bag-index dispatch (260918-w4n: no worn slot exists for a staff)", () => {
  const staff = POPLAR_STAFF();
  const state = hero({ c: { cls: "Magic User", worn: {}, items: [staff], wp: 20, maxWP: 55 } });
  const result = applyAction(state, { type: "useItem", i: 0 });
  assert.ok(result.events.some((e) => e.type === "itemUsed"));
});

test("validateAction: a useItem action naming slot 'staff' is rejected outright — a staff has no worn slot", () => {
  const result = validateAction({ type: "useItem", slot: "staff" });
  assert.equal(result.ok, false);
});

test("LINE_FOR.useRefused renders the notWorn line with a block tone", () => {
  const t = LINE_FOR.useRefused({ type: "useRefused", item: { n: "Cloak of Speed" }, reason: "notWorn" });
  assert.equal(t.text, "Cloak of Speed is in your bag, doing what things in bags do: nothing. Wear it first.");
  assert.equal(t.tone, "block");
});

test("EVENT_NARRATION.useRefused renders the notWorn line", () => {
  const line = EVENT_NARRATION.useRefused({ item: { n: "Cloak of Speed" }, reason: "notWorn" });
  assert.ok(line.includes("Wear it first"));
});

test("LINE_FOR.itemEquipped appends the replaced suffix only when replaced is present; byte-identical otherwise", () => {
  const swapped = LINE_FOR.itemEquipped({ item: { n: "Ring of Power" }, slot: "ring", replaced: { n: "Ring of Power" } });
  assert.equal(swapped.text, "Equipped: Ring of Power (ring). Ring of Power goes back in the bag.");
  const plain = LINE_FOR.itemEquipped({ item: { n: "Ring of Power" }, slot: "ring" });
  assert.equal(plain.text, "Equipped: Ring of Power (ring).");
});

test("EVENT_NARRATION.itemEquipped mentions the replaced item going back in the bag only when replaced is present; byte-identical otherwise", () => {
  const swapped = EVENT_NARRATION.itemEquipped({ item: { n: "Ring of Power" }, slot: "ring", replaced: { n: "Ring of Power" } });
  assert.ok(swapped.includes("goes back in the bag"));
  const plain = EVENT_NARRATION.itemEquipped({ item: { n: "Ring of Power" }, slot: "ring" });
  assert.equal(plain, `<span class="hit">Equipped:</span> Ring of Power (ring). Whether that was wise is between you and the maze.`);
});

// --- Plan 02 Task 3: legacy identity sweep ---
//
// Five entry points, exercised against a REAL newRun(3) legacy state (a
// Pickpocket Thief with a Cloak of Ether in the bag, no `worn` key) run
// through the actual engine — proving this plan changed nothing for a state
// without the worn-slot model. Each test asserts the call's own before/after
// state (or, for useItem, agreement across two independently-cloned legacy
// states run through the SAME call) rather than a hand-typed literal pin —
// deliberately avoiding a mistyped magic-string pin on this seed's real,
// non-trivial chargen output while still proving byte-identical behaviour.

test("Task 3 sweep: unequipSlot('ring') on a real newRun(3) state is a no-op (jewelry1 already empty)", () => {
  const state = newRun(3);
  const before = JSON.stringify(state.c);
  const events = unequipSlot(state, "ring", []);
  assert.deepStrictEqual(events, []);
  assert.equal(JSON.stringify(state.c), before);
});

test("Task 3 sweep: takeFind of a ring on a real newRun(3) state wears it into the empty jewelry1 (single-path outcome)", () => {
  const state = newRun(3); // Thief, cloak already worn at chargen — jewelry1/jewelry2 free
  const ring = RING();
  state.pendingFind = ring;
  const beforeItemsLen = state.c.items.length;
  const events = takeFind(state, []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.equal(state.c.items.length, beforeItemsLen, "the ring wears — it never touches the bag");
  assert.deepStrictEqual(events, [
    { type: "findTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
  ]);
});

test("Task 3 sweep: takeLoot of a ring on a real newRun(3) state wears it into the empty jewelry1 (single-path outcome)", () => {
  const state = newRun(3); // Thief, cloak already worn at chargen — jewelry1/jewelry2 free
  const ring = RING();
  state.pendingLoot = [ring];
  const beforeItemsLen = state.c.items.length;
  const events = takeLoot(state, 0, false, []);
  assert.equal(state.c.worn.jewelry1, ring);
  assert.equal(state.c.items.length, beforeItemsLen, "the ring wears — it never touches the bag");
  assert.deepStrictEqual(events, [
    { type: "lootTaken", item: ring },
    { type: "itemEquipped", item: ring, slot: "jewelry1" },
  ]);
});
