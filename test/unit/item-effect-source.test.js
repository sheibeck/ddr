// test/unit/item-effect-source.test.js
//
// Phase 88 plan 01 (ITEM-02): a timed item effect started from a source slot
// (the three worn keys, and the weapon slot for a wielded staff) carries its
// source on the timer record (`src: { slot, n }`) and ends the moment that
// item leaves the slot, through ONE helper (engine/items.js#endSourceEffects)
// that every gear-change path calls.
//
// User words (backlog 999.16, 2026-09-28): "when you use an item and then
// take that item off, you should lose the items benefit. For instance, if I
// wear the cloak of flying and use it, I gain flying, and then if I take it
// off, I should lose that flying condition." Rulings 2026-09-30: the use is
// spent (remaining effect + cooldown), Ether in rock entombs, flight ending
// strands nothing, and the Crystal Staff (weapon slot) is linked too.
//
// Helpers mirror the established per-file convention (copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollCheck, atLeastFor } from "../../engine/dice.js";
import { GW, GH } from "../../engine/maze.js";
import { move } from "../../engine/movement.js";
import { applyAction } from "../../engine/engine.js";
import { startEffect, tickSquares, endEffectEarly } from "../../engine/effects.js";
import {
  useItem,
  unequipSlot,
  equipItem,
  takeLoot,
  dropItem,
  endSourceEffects,
  narrateTimerTransitions,
  pilferFumbleRng,
} from "../../engine/items.js";
import { sellItem } from "../../engine/economy.js";
import {
  SOURCE_SLOTS,
  sourceSlotItem,
  effectSourceOf,
  isFlying,
  critWardOf,
  eff,
  itemEffectActive,
  foeToHitVs,
} from "../../engine/derived.js";
import { ACTIVATION_OF, SLOT_OF, CLOAKS, JEWELRY, STAVES } from "../../content/index.js";
import { EPITAPHS } from "../../content/epitaphs.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ─── helpers ────────────────────────────────────────────────────────────────

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow, so an
 * exhausted sequence doubles as a "no draw expected" assertion. */
function fakeRng(seq = []) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    get draws() {
      return i;
    },
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
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

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

/** fixedState — the party stands on an OPEN cell (5,5) of an otherwise
 * walled grid; overrides.c / .floor / the rest fold in. */
function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  open(g, 5, 5);
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

/** The real content row as a carried item: cloaks/jewelry/staves exactly as
 * the treasure rollers build them. */
function item(name) {
  const cloak = CLOAKS.find((r) => r.n === name);
  if (cloak) return { kind: "cloak", ...cloak };
  const jewel = JEWELRY.find((r) => r.n === name);
  if (jewel) return { kind: "jewel", ...jewel };
  const staff = STAVES.find((r) => r.n === name);
  if (staff) return { kind: "staff", charges: ACTIVATION_OF[name].charges, ...staff };
  throw new Error(`no treasure row named ${name}`);
}

const FAMILY_KEY = { cloak: "cloak", jewelry: "jewelry1" };

/** wearing(name, slot) — a state wearing `name` in `slot`, the item used. */
function used(name, slot, cOverrides = {}, stateOverrides = {}) {
  const it = item(name);
  const state = fixedState({ c: { worn: { [slot]: it }, ...cOverrides }, ...stateOverrides });
  const events = useItem(state, { slot }, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "itemEffectStarted"), `${name}: the use starts an effect (${events.map((e) => e.type)})`);
  return { state, it, events };
}

/** A Magic User wielding a Crystal Staff whose party invisibility is live
 * (d10 = 10 -> 15 squares). */
function wieldedCrystal(stateOverrides = {}) {
  const staff = item("Crystal Staff");
  const state = fixedState({ c: { cls: "Magic User", weapon: "Crystal Staff", staff, items: [] }, ...stateOverrides });
  const events = useItem(state, { slot: "weapon" }, fakeRng([10]), []);
  assert.ok(events.some((e) => e.type === "itemEffectStarted"), "the staff's use starts its party invisibility");
  return { state, staff };
}

const types = (events) => events.map((e) => e.type);
const ended = (events) => events.filter((e) => e.type === "itemEffectEnded");
const NO_DRAW = () => fakeRng([]);

/** The twelve linked worn items, derived from content: a SLOT_OF member with a
 * positive numeric effect. */
const LINKED_WORN = Object.keys(ACTIVATION_OF).filter(
  (k) => SLOT_OF[k] !== undefined && typeof ACTIVATION_OF[k].effect === "number" && ACTIVATION_OF[k].effect > 0,
);

// ─── the link ────────────────────────────────────────────────────────────────

test("the linked worn set is the twelve the plan names", () => {
  assert.deepEqual(
    [...LINKED_WORN].sort(),
    [
      "Amulet of Light", "Anklet of Invisibility", "Bracelet of Flight", "Cloak of Armor", "Cloak of Ether",
      "Cloak of Flying", "Cloak of Invisibility", "Cloak of Speed", "Cloak of Strength", "Gauntlet of the Giant",
      "Helm of Knowledge", "Ring of Power",
    ].sort(),
  );
  assert.equal(LINKED_WORN.length, 12);
});

test("SOURCE_SLOTS is the three worn keys plus the weapon slot, frozen", () => {
  assert.deepEqual([...SOURCE_SLOTS], ["jewelry1", "jewelry2", "cloak", "weapon"]);
  assert.ok(Object.isFrozen(SOURCE_SLOTS));
});

test("link, worn: using each of the 12 linked items from its slot stamps src { slot, n } on its record", () => {
  for (const name of LINKED_WORN) {
    const slot = FAMILY_KEY[SLOT_OF[name]];
    const { state } = used(name, slot);
    assert.deepEqual(state.c.timers[`item:${name}`].src, { slot, n: name }, name);
  }
});

test("link, worn: a Ring of Power worn in jewelry2 is linked to jewelry2", () => {
  const { state } = used("Ring of Power", "jewelry2");
  assert.deepEqual(state.c.timers["item:Ring of Power"].src, { slot: "jewelry2", n: "Ring of Power" });
});

test("link, weapon: a wielded Crystal Staff's party invisibility is linked to the weapon slot", () => {
  const { state } = wieldedCrystal();
  assert.deepEqual(state.c.timers["item:Crystal Staff"].src, { slot: "weapon", n: "Crystal Staff" });
  assert.equal(state.c.timers["item:Crystal Staff"].left, 15);
});

test("no link: a Speed potion used from the bag and the Torch start records with no src", () => {
  const potion = { kind: "potion", n: "Speed potion", eff2: "speed", uses: 1 };
  const s1 = fixedState({ c: { items: [potion] } });
  useItem(s1, 0, NO_DRAW(), []);
  assert.ok(s1.c.timers["item:Speed"], "the potion's effect runs");
  assert.equal("src" in s1.c.timers["item:Speed"], false);

  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const s2 = fixedState({ c: { items: [torch], darkFor: 5 } });
  useItem(s2, 0, NO_DRAW(), []);
  assert.ok(s2.c.timers["item:Torch"], "the torch's effect runs");
  assert.equal("src" in s2.c.timers["item:Torch"], false);
});

test("effectSourceOf and sourceSlotItem read only what is valid, and never throw on a hostile value", () => {
  assert.deepEqual(effectSourceOf({ src: { slot: "cloak", n: "X" } }), { slot: "cloak", n: "X" });
  for (const bad of [null, undefined, {}, { src: null }, { src: [] }, { src: { slot: "armor", n: "X" } }, { src: { slot: "cloak", n: "" } }, { src: { slot: "cloak", n: 4 } }, 7, "x"]) {
    assert.equal(effectSourceOf(bad), null, JSON.stringify(bad));
  }
  const ring = item("Ring of Power");
  assert.equal(sourceSlotItem({ worn: { jewelry2: ring } }, "jewelry2"), ring);
  assert.equal(sourceSlotItem({ worn: {} }, "cloak"), null);
  assert.equal(sourceSlotItem(null, "cloak"), null);
  assert.equal(sourceSlotItem({ worn: { cloak: ring } }, "armor"), null);
  const staff = item("Crystal Staff");
  assert.equal(sourceSlotItem({ weapon: "Crystal Staff", staff }, "weapon"), staff);
  assert.equal(sourceSlotItem({ weapon: "Club", staff }, "weapon"), null, "a stale staff pointer is not wielded");
});

// ─── take off, and the use is spent ─────────────────────────────────────────

test("take off: the Cloak of Flying stops flying at once, one itemEffectEnded after itemUnequipped, the use spent as left + cd", () => {
  const { state } = used("Cloak of Flying", "cloak");
  tickSquares(state.c, 5);
  assert.equal(state.c.timers["item:Cloak of Flying"].left, 15);
  assert.equal(isFlying(state), true);

  const events = unequipSlot(state, "cloak", [], NO_DRAW());
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded"]);
  assert.deepEqual(events[1], {
    type: "itemEffectEnded", item: "Cloak of Flying", kind: "fly", slot: "cloak", why: "off", left: 15, ready: 65,
  });
  assert.equal(isFlying(state), false);
  assert.equal(itemEffectActive(state.c, "fly"), false);
  assert.deepEqual(state.c.timers["item:Cloak of Flying"], { cadence: "squares", left: 65, phase: "cooldown" });
});

test("the use is spent: putting it back on never brings the effect back, and it is ready exactly when a full run would have been", () => {
  const { state } = used("Cloak of Flying", "cloak");
  tickSquares(state.c, 5);
  unequipSlot(state, "cloak", [], NO_DRAW());
  // back on (the bag holds the cloak now)
  const back = equipItem(state, 0, [], null, NO_DRAW());
  assert.ok(back.some((e) => e.type === "itemEquipped"));
  assert.equal(ended(back).length, 0, "a cooling record has nothing left to end");
  assert.equal(isFlying(state), false, "no flight comes back");
  const refused = useItem(state, { slot: "cloak" }, NO_DRAW(), []);
  assert.deepEqual(
    refused.map((e) => [e.type, e.reason, e.left, e.phase]),
    [["useRefused", "cooldown", 65, "cooldown"]],
  );

  // 64 more squares: still cooling; the 65th cools it.
  const t1 = tickSquares(state.c, 64);
  assert.deepEqual(t1, []);
  const t2 = tickSquares(state.c, 1);
  const cooled = narrateTimerTransitions(state, t2, []);
  assert.deepEqual(cooled, [{ type: "itemCooled", item: "Cloak of Flying" }]);

  // control: the flight runs its full 20 + 50; it cools on the same 70th square
  const control = used("Cloak of Flying", "cloak").state;
  for (let sq = 1; sq < 70; sq++) tickSquares(control.c, 1);
  assert.ok(control.c.timers["item:Cloak of Flying"], "not cooled at square 69");
  const tc = tickSquares(control.c, 1);
  assert.deepEqual(tc, [{ id: "item:Cloak of Flying", from: "cooldown", to: null }]);
});

test("taking off before any square is walked spends the full effect: ready in effect + cd", () => {
  const { state } = used("Ring of Power", "jewelry1");
  const events = unequipSlot(state, "jewelry1", [], NO_DRAW());
  assert.deepEqual(ended(events).map((e) => [e.item, e.left, e.ready, e.why]), [["Ring of Power", 50, 100, "off"]]);
  assert.equal(state.c.timers["item:Ring of Power"].left, 100);
});

test("the natural tick flip drops src: a cooling record is exactly { cadence, left, cd, phase }", () => {
  const { state } = used("Cloak of Flying", "cloak");
  tickSquares(state.c, 20);
  assert.deepEqual(state.c.timers["item:Cloak of Flying"], { cadence: "squares", left: 50, cd: 50, phase: "cooldown" });
});

test("endEffectEarly: a live effect becomes the spent cooldown; no cd deletes; everything else is a null no-op", () => {
  const c = {};
  startEffect(c, "item:A", { squares: 7, cd: 3 });
  c.timers["item:A"].src = { slot: "cloak", n: "A" };
  startEffect(c, "item:B", { squares: 4 });
  assert.deepEqual(endEffectEarly(c, "item:A"), { id: "item:A", left: 7, ready: 10 });
  assert.deepEqual(c.timers["item:A"], { cadence: "squares", left: 10, phase: "cooldown" });
  assert.deepEqual(endEffectEarly(c, "item:B"), { id: "item:B", left: 4, ready: 0 });
  assert.equal("item:B" in c.timers, false);
  assert.equal(endEffectEarly(c, "item:A"), null, "a cooldown is not a live effect");
  assert.equal(endEffectEarly(c, "item:none"), null);
  assert.equal(endEffectEarly({}, "item:A"), null);
  assert.equal(endEffectEarly(null, "item:A"), null);
  assert.equal("timers" in {}, false);
});

// ─── the Crystal Staff ──────────────────────────────────────────────────────

test("Crystal Staff unwield: the party is visible again on the same action, the charge stays spent and the recharge is untouched", () => {
  const joiner = fixedFighter({ name: "Joiny" });
  const { state, staff } = wieldedCrystal({ party: [joiner] });
  const plainNeed = foeToHitVs(fixedState({ c: { cls: "Magic User" }, party: [joiner] }), "member", joiner);
  assert.ok(plainNeed > 1, "a Joiner with no party invisibility is hit on more than the top face");
  assert.equal(foeToHitVs(state, "member", joiner), 1, "live: the one-face defence reaches the Joiner");
  const chargesBefore = staff.charges;
  const rechargeBefore = JSON.stringify(state.c.timers["charges:Crystal Staff"]);
  assert.equal(chargesBefore, 1);

  const events = unequipSlot(state, "weapon", [], NO_DRAW());
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded"]);
  assert.deepEqual(events[1], {
    type: "itemEffectEnded", item: "Crystal Staff", kind: "invis", slot: "weapon", why: "off", left: 15, ready: 0, party: true,
  });
  assert.equal("item:Crystal Staff" in state.c.timers, false, "a staff has no cooldown: the record is gone");
  assert.equal(itemEffectActive(state.c, "invis"), false);
  assert.equal(foeToHitVs(state, "member", joiner), plainNeed, "the Joiner's ordinary faces are back");
  assert.equal(staff.charges, chargesBefore, "no charge is refunded");
  assert.equal(JSON.stringify(state.c.timers["charges:Crystal Staff"]), rechargeBefore, "the recharge countdown is untouched");
  assert.equal(state.c.weapon, "Fists");
  assert.ok(state.c.items.includes(staff), "the staff is in the bag");
});

test("Crystal Staff swaps: an ordinary weapon, an identical staff, and a takeLoot weapon each end it; armour does not", () => {
  // equipItem: an ordinary weapon over the wielded staff
  const a = wieldedCrystal();
  a.state.c.items.push({ kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 });
  const ea = equipItem(a.state, 0, [], null, NO_DRAW());
  assert.deepEqual(ended(ea).map((e) => [e.item, e.why, e.slot, e.party]), [["Crystal Staff", "swap", "weapon", true]]);
  assert.equal(itemEffectActive(a.state.c, "invis"), false);

  // equipItem: an identical Crystal Staff copy
  const b = wieldedCrystal();
  b.state.c.items.push(item("Crystal Staff"));
  const eb = equipItem(b.state, 0, [], null, NO_DRAW());
  assert.deepEqual(ended(eb).map((e) => [e.item, e.why]), [["Crystal Staff", "swap"]]);
  assert.equal(b.state.c.staff === b.staff, false, "the copy is now the wielded staff");

  // takeLoot with equip: a weapon over the wielded staff
  const c = wieldedCrystal();
  c.state.pendingLoot = [{ kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 }];
  const ec = takeLoot(c.state, 0, true, []);
  assert.deepEqual(ended(ec).map((e) => [e.item, e.why]), [["Crystal Staff", "swap"]]);

  // equipItem: armour leaves it live (whether the piece is accepted or not)
  const d = wieldedCrystal();
  d.state.c.items.push({ kind: "armor", armor: "Cloth", n: "Cloth", ar: 3, min: 1, wp: 12, cls: "FTM" });
  const ed = equipItem(d.state, 0, [], null, NO_DRAW());
  assert.equal(ended(ed).length, 0);
  assert.equal(itemEffectActive(d.state.c, "invis"), true);
});

test("Crystal Staff drop and sell: use, unwield, then drop (or sell) the staff gives exactly one itemEffectEnded", () => {
  for (const leave of [(s, i) => dropItem(s, i, []), (s, i) => sellItem(s, i, [])]) {
    const { state, staff } = wieldedCrystal();
    const all = [];
    all.push(...unequipSlot(state, "weapon", [], NO_DRAW()));
    const i = state.c.items.indexOf(staff);
    assert.ok(i >= 0);
    all.push(...leave(state, i));
    assert.equal(ended(all).length, 1, types(all).join(","));
  }
});

// ─── swapping a worn slot ───────────────────────────────────────────────────

test("swap, worn: a different cloak, and an identical copy, each end the effect with why swap", () => {
  const a = used("Cloak of Flying", "cloak").state;
  a.c.items.push(item("Cloak of Speed"));
  const ea = equipItem(a, 0, [], null, NO_DRAW());
  assert.deepEqual(types(ea).slice(0, 2), ["itemEquipped", "itemEffectEnded"]);
  assert.deepEqual(ended(ea).map((e) => [e.item, e.why, e.slot, e.ready]), [["Cloak of Flying", "swap", "cloak", 70]]);
  assert.equal(isFlying(a), false);

  const b = used("Cloak of Flying", "cloak").state;
  b.c.items.push(item("Cloak of Flying"));
  const eb = equipItem(b, 0, [], null, NO_DRAW());
  assert.deepEqual(ended(eb).map((e) => [e.item, e.why]), [["Cloak of Flying", "swap"]], "an identical copy ends it too");
  assert.equal(isFlying(b), false);
});

test("swap, jewelry: a second piece into the OTHER slot leaves it running; into the source slot ends it", () => {
  const { state } = used("Ring of Power", "jewelry1");
  state.c.items.push(item("Amulet of Light"), item("Helm of Knowledge"));
  const other = equipItem(state, 0, [], "jewelry2", NO_DRAW());
  assert.equal(ended(other).length, 0);
  assert.equal(itemEffectActive(state.c, "power"), true, "the Empowered effect stays");
  assert.ok(effectSourceOf(state.c.timers["item:Ring of Power"]), "and stays linked");

  const same = equipItem(state, 0, [], "jewelry1", NO_DRAW());
  assert.deepEqual(ended(same).map((e) => [e.item, e.why, e.slot]), [["Ring of Power", "swap", "jewelry1"]]);
  assert.equal(itemEffectActive(state.c, "power"), false);
});

test("wearing into a free slot by takeLoot auto-wear ends nothing linked elsewhere", () => {
  const { state } = used("Ring of Power", "jewelry1");
  state.pendingLoot = [item("Amulet of Light")];
  const events = takeLoot(state, 0, false, []);
  assert.ok(events.some((e) => e.type === "itemEquipped" && e.slot === "jewelry2"));
  assert.equal(ended(events).length, 0);
  assert.equal(itemEffectActive(state.c, "power"), true);
});

// ─── drop and sell ──────────────────────────────────────────────────────────

test("drop / sell of a bag twin leaves a slotted source's effect running", () => {
  for (const leave of [(s) => dropItem(s, 0, []), (s) => sellItem(s, 0, [])]) {
    const { state } = used("Cloak of Flying", "cloak");
    state.c.items.push(item("Cloak of Flying"));
    const events = leave(state);
    assert.equal(ended(events).length, 0);
    assert.equal(isFlying(state), true);
    assert.ok(state.c.timers["item:Cloak of Flying"].src, "still linked");
  }
});

test("use, take off, then drop (or sell) the taken-off cloak: exactly one itemEffectEnded across the whole sequence", () => {
  for (const leave of [(s, i) => dropItem(s, i, []), (s, i) => sellItem(s, i, [])]) {
    const { state } = used("Cloak of Flying", "cloak");
    const all = [];
    all.push(...unequipSlot(state, "cloak", [], NO_DRAW()));
    all.push(...leave(state, 0));
    assert.equal(ended(all).length, 1, types(all).join(","));
  }
});

test("the sweep: a stale linked record whose item is gone ends with why gone on the next drop or sell", () => {
  for (const leave of [(s) => dropItem(s, 0, []), (s) => sellItem(s, 0, [])]) {
    const state = fixedState({ c: { items: [{ kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 }] } });
    startEffect(state.c, "item:Cloak of Flying", { squares: 20, cd: 50 }).src = { slot: "cloak", n: "Cloak of Flying" };
    const events = leave(state);
    const e = ended(events);
    assert.equal(e.length, 1);
    assert.equal(e[0].why, "gone");
    assert.equal(e[0].ready, 70);
  }
});

// ─── refusals ───────────────────────────────────────────────────────────────

test("refusals: a full bag and the combat gear lock end nothing", () => {
  // bag full: four bag-slot items in a small bag
  const full = used("Cloak of Flying", "cloak", {
    bag: "small",
    items: [1, 2, 3, 4].map((n) => ({ kind: "weapon", n: `Dagger ${n}`, base: "Dagger", bonus: 0 })),
  }).state;
  const e1 = unequipSlot(full, "cloak", [], NO_DRAW());
  assert.deepEqual(types(e1), ["bagFull"]);
  assert.ok(full.c.worn.cloak, "the cloak stays worn");
  assert.equal(isFlying(full), true);

  // combat gear lock
  const fight = used("Cloak of Flying", "cloak").state;
  fight.c.items.push(item("Cloak of Speed"));
  fight.combat = { foes: [], round: 1 };
  const e2 = unequipSlot(fight, "cloak", [], NO_DRAW());
  const e3 = equipItem(fight, 0, [], null, NO_DRAW());
  assert.deepEqual(types(e2), ["gearRefused"]);
  assert.deepEqual(types(e3), ["gearRefused"]);
  assert.equal(isFlying(fight), true);
});

// ─── Ether in rock ──────────────────────────────────────────────────────────

test("Ether: taking the cloak off in rock entombs the hero, in order, with no refusal and no warning", () => {
  const { state } = used("Cloak of Ether", "cloak");
  state.floor.g[5][5] = { wall: true, dark: false, seen: true, feat: null };
  const events = unequipSlot(state, "cloak", [], fakeRng([]));
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded", "entombed", "died"]);
  assert.equal(events[1].kind, "ether");
  assert.equal(state.dead, true);
  assert.equal(state.deathNote, "became a permanent architectural feature");
  assert.equal(state.epitaph, EPITAPHS.entombed[0].replace("{name}", state.c.name).replace("{floor}", "1"));
});

test("Ether: swapping the cloak for another in rock entombs too", () => {
  const { state } = used("Cloak of Ether", "cloak");
  state.floor.g[5][5] = { wall: true, dark: false, seen: true, feat: null };
  state.c.items.push(item("Cloak of Speed"));
  const events = equipItem(state, 0, [], null, fakeRng([]));
  assert.deepEqual(types(events), ["itemEquipped", "itemEffectEnded", "entombed", "died"]);
  assert.equal(state.dead, true);
});

test("Ether: out of rock the same take-off ends the effect harmlessly", () => {
  const { state } = used("Cloak of Ether", "cloak");
  const events = unequipSlot(state, "cloak", [], NO_DRAW());
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded"]);
  assert.equal(state.dead, false);
  assert.equal(itemEffectActive(state.c, "ether"), false);
});

test("Ether through applyAction: the dispatcher hands the main rng in, so a take-off in rock entombs on the real path", () => {
  const { state } = used("Cloak of Ether", "cloak");
  state.floor.g[5][5] = { wall: true, dark: false, seen: true, feat: null };
  const { state: after, events } = applyAction(state, { type: "unequipSlot", slot: "cloak" });
  assert.equal(after.dead, true);
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded", "entombed", "died"]);
});

// ─── flight strands nothing ─────────────────────────────────────────────────

test("flight: a flight that ends early leaves the hero where they stand: no fall, climb, leap or move", () => {
  for (const feat of ["climb", "gorge"]) {
    const { state } = used("Cloak of Flying", "cloak");
    open(state.floor.g, 5, 4, { feat });
    const flown = move(state, "N", fakeRng([]), []);
    assert.ok(flown.some((e) => e.type === "flownOver"), `${feat}: flew over`);
    const at = [state.floor.px, state.floor.py];
    const events = unequipSlot(state, "cloak", [], NO_DRAW());
    assert.deepEqual([state.floor.px, state.floor.py], at);
    assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded"]);
    assert.equal(state.dead, false);
  }
});

// ─── the Pilfer fumble ──────────────────────────────────────────────────────

test("Pilfer: the helper called with why destroyed ends a record linked to that slot", () => {
  const { state } = used("Ring of Power", "jewelry2");
  delete state.c.worn.jewelry2;
  const events = endSourceEffects(state, state.c, [], { slots: ["jewelry2"], why: "destroyed" });
  assert.deepEqual(ended(events).map((e) => [e.item, e.why, e.slot]), [["Ring of Power", "destroyed", "jewelry2"]]);
});

test("Pilfer: a real fumble still yields pilferFumbled, then the helper ends whatever was linked to the destroyed slot", () => {
  const SEED = 4242;
  const ring = item("Ring of Power");
  let acts = -1;
  const mainRng = makeRng(SEED);
  for (let a = 0; a <= 5000; a++) {
    const chk = rollCheck(pilferFumbleRng({ acts: a }, mainRng, { n: ring.n }), 20, atLeastFor(19, 20));
    if (chk.roll === 1) {
      acts = a;
      break;
    }
  }
  assert.ok(acts >= 0, "a fumbling key exists");
  const state = fixedState({ acts, c: { cls: "Thief", sub: "Pilfer", wp: 40, maxWP: 40, worn: { jewelry2: ring } } });
  // a stale linked record for the same slot (its item is not the ring)
  startEffect(state.c, "item:Helm of Knowledge", { squares: 50, cd: 50 }).src = { slot: "jewelry2", n: "Helm of Knowledge" };
  const events = useItem(state, { slot: "jewelry2" }, makeRng(SEED), []);
  const order = types(events);
  assert.ok(order.includes("pilferFumbled"));
  assert.ok(order.indexOf("pilferFumbled") < order.indexOf("itemEffectEnded"), "the gear event comes first");
  assert.deepEqual(ended(events).map((e) => [e.item, e.why]), [["Helm of Knowledge", "destroyed"]]);
  assert.equal(state.c.worn.jewelry2, undefined);
});

// ─── any character sheet ────────────────────────────────────────────────────

test("Joiner sheet: the helper ends the Joiner's linked effect, names the member, and never entombs", () => {
  const joiner = fixedFighter({ name: "Joiny", worn: { cloak: item("Cloak of Strength") } });
  const state = fixedState({ party: [joiner] });
  startEffect(joiner, "item:Cloak of Strength", { squares: 50, cd: 50 }).src = { slot: "cloak", n: "Cloak of Strength" };
  assert.equal(critWardOf(joiner) !== null, true, "the ward is live before");
  const events = endSourceEffects(state, joiner, [], { slots: ["cloak"], why: "off" });
  assert.equal(critWardOf(joiner), null);
  assert.deepEqual(ended(events).map((e) => [e.item, e.kind, e.member]), [["Cloak of Strength", "critWard", "Joiny"]]);
  assert.equal(eff(state.c, "critWard"), 0, "the hero is untouched");
});

test("Joiner sheet in rock: an ended Ether effect entombs nobody", () => {
  const joiner = fixedFighter({ name: "Joiny", worn: { cloak: item("Cloak of Ether") } });
  const state = fixedState({ party: [joiner] });
  state.floor.g[5][5] = { wall: true, dark: false, seen: true, feat: null };
  startEffect(joiner, "item:Cloak of Ether", { squares: 10, cd: 80 }).src = { slot: "cloak", n: "Cloak of Ether" };
  const events = endSourceEffects(state, joiner, [], { slots: ["cloak"], why: "off", rng: fakeRng([]) });
  assert.equal(ended(events).length, 1);
  assert.equal(types(events).includes("entombed"), false);
  assert.equal(state.dead, false);
});

// ─── the four edges ─────────────────────────────────────────────────────────

test("empty edge: no timers, a null sheet, an empty slot, or a record with no src is a silent no-op that never creates timers", () => {
  const events = [];
  const bare = fixedFighter();
  const state = fixedState();
  assert.equal(endSourceEffects(state, bare, events, { slots: ["cloak"] }), events);
  assert.equal("timers" in bare, false, "never creates a timers map");
  assert.equal(endSourceEffects(state, null, events, { slots: ["cloak"] }), events);
  assert.equal(endSourceEffects(null, null, events), events);
  assert.equal(endSourceEffects(state, { timers: null }, events, { slots: ["cloak"] }), events);

  const live = fixedFighter({ worn: { cloak: item("Cloak of Flying") } });
  startEffect(live, "item:Cloak of Flying", { squares: 20, cd: 50 }); // no src
  const before = JSON.stringify(live.timers);
  assert.equal(endSourceEffects(state, live, events, { slots: ["cloak"], why: "off" }), events);
  assert.equal(JSON.stringify(live.timers), before, "a record with no src is left alone");

  const emptySlot = fixedFighter({ timers: {} });
  assert.equal(endSourceEffects(state, emptySlot, events, { slots: ["cloak", "weapon", "jewelry1"] }), events);
  assert.deepEqual(events, []);
});

test("idempotency edge: calling the helper twice on the same slot yields one itemEffectEnded and leaves the record unchanged by the second call", () => {
  const { state } = used("Cloak of Flying", "cloak");
  tickSquares(state.c, 3);
  const first = endSourceEffects(state, state.c, [], { slots: ["cloak"], why: "off" });
  const snapshot = JSON.stringify(state.c.timers);
  const second = endSourceEffects(state, state.c, [], { slots: ["cloak"], why: "off" });
  assert.equal(ended(first).length, 1);
  assert.equal(ended(second).length, 0);
  assert.equal(JSON.stringify(state.c.timers), snapshot);
});

test("ordering edge: several ended records follow c.timers insertion order; the gear event comes before them", () => {
  const state = fixedState({ c: { worn: { cloak: item("Cloak of Flying") } } });
  // a stale record for another slot first, then the real one on the cloak
  startEffect(state.c, "item:Ring of Power", { squares: 50, cd: 50 }).src = { slot: "jewelry1", n: "Ring of Power" };
  useItem(state, { slot: "cloak" }, NO_DRAW(), []);
  assert.deepEqual(Object.keys(state.c.timers), ["item:Ring of Power", "item:Cloak of Flying"]);
  const events = unequipSlot(state, "cloak", [], NO_DRAW());
  assert.deepEqual(types(events), ["itemUnequipped", "itemEffectEnded", "itemEffectEnded"]);
  assert.deepEqual(ended(events).map((e) => [e.item, e.why]), [["Ring of Power", "gone"], ["Cloak of Flying", "off"]]);
});

test("adjacency edge: an identical copy into the source slot ends it; a bag twin dropped, or an item worn into the other slot, leaves it", () => {
  // identical copy: covered for cloak and staff above; bag twin and other slot:
  const { state } = used("Ring of Power", "jewelry1");
  state.c.items.push(item("Ring of Power"));
  assert.equal(ended(dropItem(state, 0, [])).length, 0);
  state.c.items.push(item("Ring of Power"));
  assert.equal(ended(equipItem(state, 0, [], "jewelry2", NO_DRAW())).length, 0);
  assert.equal(itemEffectActive(state.c, "power"), true);
  state.c.items = [item("Ring of Power")];
  assert.equal(ended(equipItem(state, 0, [], "jewelry1", NO_DRAW())).length, 1, "the identical copy ends it");
});

test("quiet mode ends a record with no event and no entombment", () => {
  const { state } = used("Cloak of Ether", "cloak");
  state.floor.g[5][5] = { wall: true, dark: false, seen: true, feat: null };
  delete state.c.worn.cloak;
  const events = endSourceEffects(state, state.c, [], { slots: [], quiet: true });
  assert.deepEqual(events, []);
  assert.equal(state.dead, false);
  assert.equal(state.c.timers["item:Cloak of Ether"].phase, "cooldown");
});

test("no non-lethal gear change draws from the main rng (an exhausted fake rng never throws)", () => {
  const rng = fakeRng([]);
  const { state } = used("Cloak of Flying", "cloak");
  state.c.items.push(item("Cloak of Speed"));
  assert.doesNotThrow(() => {
    equipItem(state, 0, [], null, rng);
    unequipSlot(state, "cloak", [], rng);
    dropItem(state, 0, []);
  });
  assert.equal(rng.draws, 0);
});
