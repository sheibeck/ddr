// Task 1 (TDD) — item & treasure helpers (ENG-01, ENG-03).
//
// Proves: treasure rollers are RNG-injected & deterministic and return
// plain-data descriptors; giveItem/takeItem mutate a passed state's
// c.items with plain descriptors following the prototype's equip-swap
// rules; gainWilmst applies the Pickpocket bonus correctly; the module
// references no Math.random/document/localStorage; a character carrying
// every item kind survives a JSON round-trip.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { makeRng } from "../../engine/rng.js";
import {
  eff,
  giveItem,
  takeItem,
  useItem,
  itemReady,
  gainWilmst,
  hasPicks,
  rollJewel,
  rollCloak,
  rollStaff,
  rollBlade,
  rollMailPiece,
  rollTreasureItem,
} from "../../engine/items.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** A minimal, fixed level-1 Fighter character — every field the item
 * helpers touch. */
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {},
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    gold: 50, kills: 0, might: 0, ward: null, regen: false, mirror: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null,
    items: [], motive: "Money",
    name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedFighter(cOverrides),
    floor: { depth: 1 },
    day: 1,
    steps: 0,
    combat: null,
    ...rest,
  };
}

/** Recursively assert no function-typed leaf exists anywhere in `value`. */
function assertNoFunctionLeaves(value, label = "value") {
  if (typeof value === "function") assert.fail(`${label} is a function`);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoFunctionLeaves(v, `${label}.${k}`);
  }
}

// --- treasure rollers: deterministic, plain-data -----------------------

test("rollTreasureItem(rng, depth) is deterministic for the same seed and returns plain data", () => {
  for (const seed of [1, 42, 12345]) {
    const a = rollTreasureItem(makeRng(seed), 3);
    const b = rollTreasureItem(makeRng(seed), 3);
    assert.deepStrictEqual(a, b, `seed ${seed} must roll an identical item twice`);
    assertNoFunctionLeaves(a, "rolled item");
  }
});

test("rollTreasureItem covers every treasure kind across a seed sweep", () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 300; seed++) kinds.add(rollTreasureItem(makeRng(seed), 3).kind);
  for (const kind of ["weapon", "armor", "jewel", "cloak", "staff"]) {
    assert.ok(kinds.has(kind), `expected to see a rolled "${kind}" across the seed sweep`);
  }
});

test("rollJewel/rollCloak/rollStaff/rollBlade/rollMailPiece are deterministic plain-data rollers", () => {
  for (const [name, roller, args] of [
    ["rollJewel", rollJewel, []],
    ["rollCloak", rollCloak, []],
    ["rollStaff", rollStaff, []],
    ["rollBlade (mundane)", (rng) => rollBlade(rng, 3, false), []],
    ["rollBlade (magical)", (rng) => rollBlade(rng, 3, true), []],
    ["rollMailPiece", rollMailPiece, []],
  ]) {
    const a = roller(makeRng(7), ...args);
    const b = roller(makeRng(7), ...args);
    assert.deepStrictEqual(a, b, `${name} must be deterministic for the same seed`);
    assertNoFunctionLeaves(a, name);
  }
});

// --- giveItem / takeItem -------------------------------------------------

test("giveItem mutates state.c.items with the plain descriptor and applies a flat wp effect", () => {
  const state = fixedState();
  const events = [];
  const potion = { kind: "potion", n: "Healing potion", txt: "+d10+2 wp", eff2: "heal", uses: 1 };
  giveItem(state, potion, false, events);
  assert.deepStrictEqual(state.c.items, [potion]);
  assert.ok(events.some((e) => e.type === "itemGiven"));

  const wpItem = { kind: "jewel", n: "Ring", eff: { wp: 5 }, txt: "+5 wp" };
  giveItem(state, wpItem, true, events);
  assert.equal(state.c.maxWP, 60);
  assert.equal(state.c.wp, 60);
});

test("takeItem equips a strictly-better weapon and rejects a worse or illegal one", () => {
  const state = fixedState({ c: { weapon: "Club", prof: 0, magicWpn: 0 } });
  const better = { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0, txt: "d8" };
  const events = [];
  takeItem(state, better, events);
  assert.equal(state.c.weapon, "Long Sword");
  assert.ok(events.some((e) => e.type === "itemTaken"));

  const worse = { kind: "weapon", n: "Club", base: "Club", bonus: 0, txt: "d6" };
  const events2 = [];
  takeItem(state, worse, events2);
  assert.equal(state.c.weapon, "Long Sword", "a not-better weapon must not replace the equipped one");
  assert.ok(events2.some((e) => e.type === "itemRejected" && e.reason === "notBetter"));

  const illegal = { kind: "weapon", n: "Bardiche", base: "Bardiche", bonus: 0, txt: "2d8" };
  const state2 = fixedState({ c: { cls: "Magic User", weapon: "Club", prof: 0, magicWpn: 0 } });
  const events3 = [];
  takeItem(state2, illegal, events3);
  assert.equal(state2.c.weapon, "Club");
  assert.ok(events3.some((e) => e.type === "itemRejected" && e.reason === "wrongClass"));
});

test("takeItem equips strictly-better armor and respects race noArmor", () => {
  const state = fixedState({ c: { armor: "Nothing", ar: 0, armorMax: 0, armorWP: 0 } });
  const mail = { kind: "armor", n: "Leather", armor: "Leather", ar: 6, wp: 15, min: 1, cls: "FT", txt: "AR 6" };
  const events = [];
  takeItem(state, mail, events);
  assert.equal(state.c.armor, "Leather");
  assert.equal(state.c.ar, 6);
  assert.equal(state.c.armorWP, 15);

  const fridgian = fixedState({ c: { race: "Fridgian", armor: "Nothing", ar: 0 } });
  const events2 = [];
  takeItem(fridgian, mail, events2);
  assert.equal(fridgian.c.armor, "Nothing");
  assert.ok(events2.some((e) => e.type === "itemRejected" && e.reason === "noArmor"));
});

test("staves only equip for a Magic User; everything else falls through to giveItem", () => {
  const staff = { kind: "staff", charges: 2, n: "Rowan Staff", use: "dome", txt: "a protective dome" };
  const fighter = fixedState();
  const events = [];
  takeItem(fighter, staff, events);
  assert.deepStrictEqual(fighter.c.items, [], "a Fighter cannot use a staff");
  assert.ok(events.some((e) => e.type === "itemRejected" && e.reason === "wrongClass"));

  const mu = fixedState({ c: { cls: "Magic User" } });
  const events2 = [];
  takeItem(mu, staff, events2);
  assert.deepStrictEqual(mu.c.items, [staff]);
});

// --- gainWilmst ------------------------------------------------------------

test("gainWilmst adds greed-scaled gold and only Pickpockets get the extra take", () => {
  const state = fixedState({ c: { sub: "Soldier", gold: 0, items: [] } });
  const rng = makeRng(1);
  const amt = gainWilmst(state, 100, "found on a corpse", rng);
  assert.equal(amt, 100);
  assert.equal(state.c.gold, 100);

  const pickpocketState = fixedState({ c: { sub: "Pickpocket", gold: 0, items: [] } });
  const rng2 = makeRng(1);
  const amt2 = gainWilmst(pickpocketState, 100, "found on a corpse", rng2);
  assert.ok(amt2 > 100, "a Pickpocket must gain more than the base amount");
  assert.equal(pickpocketState.c.gold, amt2);
});

test("gainWilmst applies greed item effects to the base amount", () => {
  const state = fixedState({ c: { sub: "Soldier", gold: 0, items: [{ kind: "jewel", eff: { greed: 1 } }] } });
  const amt = gainWilmst(state, 100, null, makeRng(1));
  assert.equal(amt, 150); // 100 * (1 + 0.5*1)
});

test("hasPicks reflects whether the character already carries lockpicks", () => {
  assert.equal(hasPicks({ items: [] }), false);
  assert.equal(hasPicks({ items: [{ kind: "picks" }] }), true);
});

// --- useItem -----------------------------------------------------------

test("useItem heals and consumes a single-use potion", () => {
  const potion = { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 };
  const state = fixedState({ c: { wp: 10, maxWP: 55, items: [potion] } });
  const events = useItem(state, 0, makeRng(3));
  assert.ok(state.c.wp > 10, "wp should have increased");
  assert.deepStrictEqual(state.c.items, [], "a single-use potion is consumed");
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(events.some((e) => e.type === "itemConsumed"));
});

test("useItem spends a staff's charge and starts its recharge cooldown (Phase 39, GEAR-02)", () => {
  // Phase 31 (CMB-02): a staff refuses a non-Magic-User first — use a Magic
  // User caster so this keeps exercising the charges/recharge model itself.
  const staff = { kind: "staff", use: "dome", charges: 2, n: "Rowan Staff" };
  const state = fixedState({ c: { cls: "Magic User", items: [staff] }, steps: 10 });
  useItem(state, 0, makeRng(3));
  assert.equal(state.c.items[0].charges, 1, "one charge spent");
  assert.ok(state.c.ward, "dome effect should have applied");
  assert.deepStrictEqual(state.c.timers["charges:Rowan Staff"], { cadence: "squares", left: 100, phase: "cooldown" });

  const state2 = fixedState({
    c: { cls: "Magic User", items: [{ kind: "staff", use: "dome", charges: 0, n: "Rowan Staff" }] },
    steps: 20,
  });
  const events = useItem(state2, 0, makeRng(3));
  assert.equal(state2.c.ward, null, "no charge left — no effect applied");
  // Phase 39 (GEAR-02): the two named refusals — a staff at 0 charges gets
  // "recharging" (never "cooldown", which is a duration+cooldown item's own reason).
  assert.equal(events.length, 1, "exactly one event — the recharging refusal");
  assert.deepStrictEqual(events[0], {
    type: "useRefused",
    item: state2.c.items[0],
    reason: "recharging",
    left: 0,
    charges: 0,
    max: 2,
  });
  assert.equal(state2.c.items[0].charges, 0, "charges untouched by a refused use");
});

test("useItem's potion of death kills the character via engine/death.js", () => {
  const potion = { kind: "potion", n: "?? potion", eff2: "death", uses: 1 };
  const state = fixedState({ c: { items: [potion], wp: 30 } });
  const now = () => 12345;
  const events = useItem(state, 0, makeRng(5), [], now);
  assert.equal(state.dead, true);
  assert.equal(state.deathAt, 12345);
  assert.ok(events.some((e) => e.type === "died"));
});

test("itemReady reads the c.timers-backed activation model (Phase 39, GEAR-02)", () => {
  const state = fixedState({ steps: 100 });
  const pendant = { kind: "jewel", use: "half", n: "Pendant of Fortitude" };
  assert.equal(itemReady(state, pendant), true, "a cd item with no record is ready");

  const busy = fixedState({
    c: { timers: { "item:Pendant of Fortitude": { cadence: "squares", left: 40, phase: "cooldown" } } },
  });
  assert.equal(itemReady(busy, pendant), false, "a live cooldown record refuses");

  assert.equal(itemReady(state, { use: "dome", n: "Rowan Staff", charges: 1 }), true, "a staff with a spare charge is ready");
  assert.equal(itemReady(state, { use: "dome", n: "Rowan Staff", charges: 0 }), false, "an empty staff is not ready");
  assert.equal(itemReady(state, { use: "dome", n: "Rowan Staff", charges: "x" }), false, "a tampered non-integer charge count is not ready");

  assert.equal(itemReady(state, { kind: "potion", eff2: "heal", n: "Healing potion" }), true, "a potion is always ready");
  assert.equal(itemReady(state, {}), false, "no use and not a potion — never ready");
  assert.equal(
    itemReady(state, { use: "dmg", n: "Ring of Power" }),
    true,
    "an item with no activation at all is always ready",
  );
});

// --- purity / serializability -----------------------------------------

/** Strip block + line comments before scanning source for forbidden refs. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("items.js references no Math.random/document/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "items.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
});

test("a character carrying every item kind survives a JSON round-trip", () => {
  const rng = makeRng(99);
  const state = fixedState({ c: { items: [] } });
  giveItem(state, rollJewel(rng), true);
  giveItem(state, rollCloak(rng), true);
  giveItem(state, rollStaff(rng), true);
  giveItem(state, rollBlade(rng, 3, true), true);
  giveItem(state, rollMailPiece(rng), true);
  giveItem(state, { kind: "picks", n: "Lockpicks", txt: "1–5 on d10" }, true);
  giveItem(state, { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 }, true);

  const roundTripped = JSON.parse(JSON.stringify(state.c.items));
  assert.deepStrictEqual(roundTripped, state.c.items);
  assertNoFunctionLeaves(state.c.items, "state.c.items");
});
