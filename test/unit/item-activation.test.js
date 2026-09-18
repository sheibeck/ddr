// test/unit/item-activation.test.js
//
// Phase 39 Plan 03 (GEAR-02) — ONE activation model for every item that does
// something when used: duration+cooldown (jewelry/cloaks), charges+recharge
// (staves), consumable-with-duration (potions) — all as `c.timers` records
// on Phase 36's engine/effects.js. Proves content/activations.js#ACTIVATION_OF,
// engine/derived.js's activation helpers, engine/items.js's timer-backed
// itemReady/useItem/applyActivation/narrateTimerTransitions, and
// engine/saveState.js's foldLegacyCounters tolerant-load migration.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { useItem, itemReady, narrateTimerTransitions, rollStaff } from "../../engine/items.js";
import {
  activationKeyFor,
  activationFor,
  itemTimerId,
  chargesTimerId,
  liveItemEffects,
  itemEffectActive,
  potionMight,
} from "../../engine/derived.js";
import { foldLegacyCounters, validateSave, serializeRun } from "../../engine/saveState.js";
import { newRun } from "../../engine/engine.js";
import { ACTIVATION_OF, CLOAKS } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow (a "no
 * further rng draw expected" assertion). `.pick(arr)` returns `arr[0]`. */
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

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {},
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    gold: 50, kills: 0, might: 0, ward: null, regen: false, mirror: 0,
    affliction: null, items: [], motive: "Money", name: "Test Delver",
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

// --- content/activations.js#ACTIVATION_OF -----------------------------

test("ACTIVATION_OF: 19 entries (6 treasure cd rows + 8 staves + 5 potions), frozen, keyed correctly", () => {
  assert.equal(Object.keys(ACTIVATION_OF).length, 19);
  assert.ok(Object.isFrozen(ACTIVATION_OF));
  assert.deepStrictEqual(ACTIVATION_OF["Cloak of Speed"], { kind: "haste", effect: 50, cd: 50 });
  assert.deepStrictEqual(ACTIVATION_OF["Pendant of Fortitude"], { kind: "half", effect: 0, cd: 100 });
  assert.deepStrictEqual(ACTIVATION_OF["Cloak of Flying"], { kind: "fly", effect: 20, cd: 50 });
  assert.deepStrictEqual(ACTIVATION_OF["Pine Staff"], { kind: "fire", charges: 1, recharge: 100 });
  assert.deepStrictEqual(ACTIVATION_OF["Crystal Staff"], {
    kind: "invis", charges: 2, recharge: 100, effect: { n: 1, sides: 10, bonus: 5 },
  });
  assert.deepStrictEqual(ACTIVATION_OF["Speed"], { kind: "haste", effect: 50 });
  assert.deepStrictEqual(ACTIVATION_OF["Strength"], { kind: "might", effect: 25, might: 8 });
  assert.deepStrictEqual(ACTIVATION_OF["Acuteness"], { kind: "acute", effect: { n: 1, sides: 8, bonus: 0 }, cadence: "rounds" });
  assert.equal(ACTIVATION_OF["Ring of Power"], undefined);
  // Once-a-day rule: effect + cd <= 100 for every cd-based row; recharge <= 100 for every staff.
  for (const [key, act] of Object.entries(ACTIVATION_OF)) {
    if (act.cd !== undefined) assert.ok((act.effect || 0) + act.cd <= 100, `${key}: effect+cd must be <= 100`);
    if (act.recharge !== undefined) assert.ok(act.recharge <= 100, `${key}: recharge must be <= 100`);
  }
});

test("exported CLOAKS/JEWELRY/STAVES rows carry NO act key (dropAuthored strips it like slot)", () => {
  const speed = CLOAKS.find((c) => c.n === "Cloak of Speed");
  assert.deepStrictEqual(speed, { n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" });
});

// --- engine/derived.js activation helpers -------------------------------

test("activationKeyFor: potion resolves via eff2, tool/treasure resolve via .n, weapon/armor resolve to null", () => {
  assert.equal(activationKeyFor({ kind: "potion", n: "Test speed", eff2: "speed" }), "Speed");
  assert.equal(activationKeyFor({ kind: "cloak", n: "Cloak of Speed" }), "Cloak of Speed");
  assert.equal(activationKeyFor({ kind: "staff", n: "Pine Staff" }), "Pine Staff");
  assert.equal(activationKeyFor({ kind: "weapon", n: "Club", base: "Club" }), "Club");
  assert.equal(activationKeyFor(null), null);
  assert.equal(activationKeyFor({ kind: "potion", n: "Unknown", eff2: "bogus" }), null);
});

test("activationFor/itemTimerId/chargesTimerId resolve through activationKeyFor", () => {
  const cloak = { kind: "cloak", n: "Cloak of Speed" };
  assert.deepStrictEqual(activationFor(cloak), { kind: "haste", effect: 50, cd: 50 });
  assert.equal(itemTimerId(cloak), "item:Cloak of Speed");
  assert.equal(chargesTimerId(cloak), "charges:Cloak of Speed");
  assert.equal(activationFor({ kind: "jewel", n: "Ring of Power" }), null);
  assert.equal(itemTimerId({ kind: "jewel", n: "Ring of Power" }), "item:Ring of Power");
});

test("liveItemEffects/itemEffectActive/potionMight read only phase:effect, left>0, known-key records", () => {
  const c = {
    timers: {
      "item:Cloak of Speed": { cadence: "squares", left: 30, cd: 50, phase: "effect" },
      "item:Strength": { cadence: "squares", left: 10, phase: "effect" },
      "item:Pendant of Fortitude": { cadence: "squares", left: 40, cd: 100, phase: "cooldown" }, // cooling, not live
      "item:Unknown Thing": { cadence: "squares", left: 5, phase: "effect" }, // unresolvable key, skipped
      "charges:Pine Staff": { cadence: "squares", left: 60, phase: "cooldown" }, // not an item: id
    },
  };
  const live = liveItemEffects(c);
  assert.deepStrictEqual(
    live.map((e) => e.key),
    ["Cloak of Speed", "Strength"],
  );
  assert.equal(itemEffectActive(c, "haste"), true);
  assert.equal(itemEffectActive(c, "invis"), false);
  assert.equal(potionMight(c), 8);
  assert.equal(liveItemEffects({}).length, 0);
  assert.equal(liveItemEffects(null).length, 0);
});

// --- itemReady (Phase 39, GEAR-02) --------------------------------------

test("itemReady: non-use/non-potion false; potion always true; cd item gated on its own timer record; staff gated on charges", () => {
  const state = fixedState();
  assert.equal(itemReady(state, {}), false);
  assert.equal(itemReady(state, { kind: "potion", eff2: "heal" }), true);
  assert.equal(itemReady(state, { kind: "cloak", n: "Cloak of Speed", use: "haste" }), true, "no record — ready");
  const busy = fixedState({ c: { timers: { "item:Cloak of Speed": { cadence: "squares", left: 50, cd: 50, phase: "effect" } } } });
  assert.equal(itemReady(busy, { kind: "cloak", n: "Cloak of Speed", use: "haste" }), false);
  assert.equal(itemReady(state, { kind: "staff", n: "Pine Staff", use: "fire", charges: 1 }), true);
  assert.equal(itemReady(state, { kind: "staff", n: "Pine Staff", use: "fire", charges: 0 }), false);
  assert.equal(itemReady(state, { kind: "staff", n: "Pine Staff", use: "fire" }), false, "no charges field at all — not ready");
});

// --- useItem: duration+cooldown (Cloak of Speed, worn) -------------------

test("useItem on a worn Cloak of Speed starts an effect record and refuses a second immediate use with reason cooldown", () => {
  const cloak = { kind: "cloak", n: "Cloak of Speed", eff: {}, use: "haste" };
  const state = fixedState({ c: { worn: { cloak } } });
  const rng = fakeRng([]);
  const rngBefore = JSON.stringify(rng);
  const events = useItem(state, { slot: "cloak" }, rng, []);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.deepStrictEqual(
    events.find((e) => e.type === "itemEffectStarted"),
    { type: "itemEffectStarted", item: "Cloak of Speed", kind: "haste", left: 50, cadence: "squares" },
  );
  assert.deepStrictEqual(state.c.timers["item:Cloak of Speed"], { cadence: "squares", left: 50, cd: 50, phase: "effect" });

  const events2 = useItem(state, { slot: "cloak" }, fakeRng([]), []);
  assert.deepStrictEqual(events2, [{ type: "useRefused", item: cloak, reason: "cooldown", left: 50, phase: "effect" }]);
  assert.equal(JSON.stringify(rng), rngBefore, "no rng consumed by either call (haste has a numeric effect, no dice)");
});

test("useItem on a Pendant of Fortitude sets c.halfNext and starts an instant COOLDOWN (no itemEffectStarted, since effect is 0)", () => {
  const pendant = { kind: "jewel", n: "Pendant of Fortitude", eff: {}, use: "half" };
  const state = fixedState({ c: { items: [pendant] } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.equal(state.c.halfNext, true);
  assert.equal(events.some((e) => e.type === "itemEffectStarted"), false);
  assert.deepStrictEqual(state.c.timers["item:Pendant of Fortitude"], { cadence: "squares", left: 100, phase: "cooldown" });
  assert.equal(itemReady(state, pendant), false);
});

// --- useItem: charges+recharge (staves) ---------------------------------

test("useItem on a Pine Staff spends its one charge, starts a 100-square recharge, and a second use is refused recharging", () => {
  const staff = { kind: "staff", n: "Pine Staff", use: "fire", charges: 1 };
  const state = fixedState({ c: { cls: "Magic User", items: [staff] } });
  // wp high enough that the fireball never kills it (no killFoe draws to budget).
  state.combat = { foes: [{ name: "Rat", type: "Beasts", wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1 }], round: 1, target: 0 };
  // n=d6=1 ball; dmg=d10=6+4=10, armor-soak d20=1 (no sp.ar -> miss the soak branch entirely).
  const events = useItem(state, 0, fakeRng([1, 6, 1]), []);
  assert.equal(staff.charges, 0);
  assert.deepStrictEqual(state.c.timers["charges:Pine Staff"], { cadence: "squares", left: 100, phase: "cooldown" });
  assert.ok(events.some((e) => e.type === "itemBurned"));

  const events2 = useItem(state, 0, fakeRng([]), []);
  assert.deepStrictEqual(events2, [
    { type: "useRefused", item: staff, reason: "recharging", left: 100, charges: 0, max: 1 },
  ]);
  assert.equal(staff.charges, 0, "a refused use never spends a charge");
});

test("useItem on a Crystal Staff spends a charge, starts the recharge cooldown immediately (it has none already running), and rolls a d10+5 timed invis effect", () => {
  const staff = { kind: "staff", n: "Crystal Staff", use: "invis", charges: 2 };
  const state = fixedState({ c: { cls: "Magic User", items: [staff] } });
  const events = useItem(state, 0, fakeRng([10]), []); // d10 = 10 -> 15 squares
  assert.equal(staff.charges, 1);
  // The staff still has a spare charge, but recharging is CONTINUOUS while
  // below max — no recharge was already counting down, so this spend starts
  // one (a later spend while it's still running does NOT restart it).
  assert.deepStrictEqual(state.c.timers["charges:Crystal Staff"], { cadence: "squares", left: 100, phase: "cooldown" });
  assert.deepStrictEqual(
    events.find((e) => e.type === "itemEffectStarted"),
    { type: "itemEffectStarted", item: "Crystal Staff", kind: "invis", left: 15, cadence: "squares" },
  );
  assert.deepStrictEqual(state.c.timers["item:Crystal Staff"], { cadence: "squares", left: 15, phase: "effect" });
});

test("rollStaff assigns a charge pool from content (no every field) with the same single rng.d(8) draw", () => {
  const rng = makeRng(3);
  const staff = rollStaff(rng);
  assert.equal("every" in staff, false);
  assert.equal(typeof staff.charges, "number");
  assert.equal(staff.charges, ACTIVATION_OF[staff.n].charges);
});

// --- useItem: consumable-with-duration (potions) ------------------------

test("useItem on a Speed potion consumes it and starts item:Speed with no cd", () => {
  const potion = { kind: "potion", n: "Speed potion (yellow)", eff2: "speed", txt: "", uses: 1 };
  const state = fixedState({ c: { items: [potion] } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.deepStrictEqual(state.c.timers["item:Speed"], { cadence: "squares", left: 50, phase: "effect" });
  assert.deepStrictEqual(state.c.items, []);
  assert.ok(events.some((e) => e.type === "itemConsumed"));
});

test("useItem on a Strength potion starts a timed might effect read through potionMight, additive across two doses", () => {
  const strength = () => ({ kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 });
  const state = fixedState({ c: { items: [strength(), { kind: "potion", n: "Enlarge potion", eff2: "enlarge", uses: 1 }] } });
  useItem(state, 0, fakeRng([]), []);
  assert.equal(potionMight(state.c), 8);
  useItem(state, 0, fakeRng([]), []); // now index 0 is the Enlarge potion
  assert.equal(potionMight(state.c), 8 + 4, "Strength + Enlarge stack additively");
});

test("useItem on an Acuteness potion rolls one d8 into a rounds-cadence effect (same single draw as before)", () => {
  const potion = { kind: "potion", n: "Acuteness potion", eff2: "acute", uses: 1 };
  const state = fixedState({ c: { items: [potion] } });
  const events = useItem(state, 0, fakeRng([6]), []);
  assert.deepStrictEqual(state.c.timers["item:Acuteness"], { cadence: "rounds", left: 6, phase: "effect" });
  assert.ok(events.some((e) => e.type === "itemEffectStarted" && e.cadence === "rounds"));
});

test("useItem on a Healing potion creates no c.timers key at all (no activation)", () => {
  const potion = { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 };
  const state = fixedState({ c: { wp: 10, maxWP: 55, items: [potion] } });
  useItem(state, 0, fakeRng([5]), []);
  assert.equal("timers" in state.c, false);
});

// --- narrateTimerTransitions ---------------------------------------------

test("narrateTimerTransitions: item: effect->null pushes itemEffectFaded; cooldown->null pushes itemCooled", () => {
  const state = fixedState();
  const events1 = narrateTimerTransitions(state, [{ id: "item:Cloak of Speed", from: "effect", to: null }], []);
  assert.deepStrictEqual(events1, [{ type: "itemEffectFaded", item: "Cloak of Speed", kind: "haste" }]);
  const events2 = narrateTimerTransitions(state, [{ id: "item:Cloak of Speed", from: "cooldown", to: null }], []);
  assert.deepStrictEqual(events2, [{ type: "itemCooled", item: "Cloak of Speed" }]);
  const events3 = narrateTimerTransitions(state, [{ id: "ability:kata", from: "effect", to: "cooldown" }], []);
  assert.deepStrictEqual(events3, [], "ability: ids are ignored");
});

test("narrateTimerTransitions: charges: cooldown->null refills the carried staff and pushes staffRecharged, restarting the cooldown while below max", () => {
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 1 };
  const state = fixedState({ c: { items: [staff] } });
  const events = narrateTimerTransitions(state, [{ id: "charges:Poplar Staff", from: "cooldown", to: null }], []);
  assert.equal(staff.charges, 2);
  assert.deepStrictEqual(events, [{ type: "staffRecharged", item: "Poplar Staff", charges: 2, max: 3 }]);
  assert.deepStrictEqual(state.c.timers["charges:Poplar Staff"], { cadence: "squares", left: 60, phase: "cooldown" });
});

test("narrateTimerTransitions: charges: refill to full max does NOT restart the cooldown", () => {
  const staff = { kind: "staff", n: "Pine Staff", use: "fire", charges: 0 };
  const state = fixedState({ c: { items: [staff] } });
  narrateTimerTransitions(state, [{ id: "charges:Pine Staff", from: "cooldown", to: null }], []);
  assert.equal(staff.charges, 1);
  assert.equal(state.c.timers?.["charges:Pine Staff"], undefined, "already at max (1) — no fresh cooldown");
});

test("narrateTimerTransitions: charges: id for a staff no longer carried is a no-op (no event, nothing thrown)", () => {
  const state = fixedState({ c: { items: [] } });
  const events = narrateTimerTransitions(state, [{ id: "charges:Pine Staff", from: "cooldown", to: null }], []);
  assert.deepStrictEqual(events, []);
});

// --- foldLegacyCounters (tolerant load) -----------------------------------

test("foldLegacyCounters: a fresh newRun character round-trips with no key injected", () => {
  const state = newRun(5);
  const before = JSON.stringify(state.c);
  const folded = foldLegacyCounters(state.c, state.steps);
  assert.equal(JSON.stringify(folded), before);
  assert.equal("timers" in folded, false);
});

test("foldLegacyCounters: folds haste/invis/ether/acute counters, flightLeft/flightCooldown, and a staff's usedAt/every — deletes all six legacy keys", () => {
  const c = {
    haste: 30, invis: 0, ether: 0, acute: 3, flightLeft: 7, flightCooldown: 0,
    items: [
      { kind: "staff", n: "Pine Staff", use: "fire", every: 250, usedAt: 5 },
    ],
  };
  const folded = foldLegacyCounters(c, 40);
  for (const k of ["haste", "invis", "ether", "acute", "flightLeft", "flightCooldown"]) assert.equal(k in folded, false);
  // haste (30, no matching carried item) folds to the fallback potion key.
  assert.deepStrictEqual(folded.timers["item:Speed"], { cadence: "squares", left: 30, phase: "effect" });
  // acute (3) folds to Acuteness, rounds cadence.
  assert.deepStrictEqual(folded.timers["item:Acuteness"], { cadence: "rounds", left: 3, phase: "effect" });
  // flightLeft (7) folds to the Cloak of Flying's own effect record (cd 50).
  assert.deepStrictEqual(folded.timers["item:Cloak of Flying"], { cadence: "squares", left: 7, cd: 50, phase: "effect" });
  // the staff: no every, no usedAt, charges defaulted to its full pool (1).
  assert.deepStrictEqual(folded.items[0], { kind: "staff", n: "Pine Staff", use: "fire", charges: 1 });
});

test("foldLegacyCounters: an item's usedAt reconstructs a COOLDOWN (elapsed-aware), and a tampered staff charge count is clamped", () => {
  const c = {
    items: [
      { kind: "cloak", n: "Cloak of Ether", eff: {}, use: "ether", every: 80, txt: "x", usedAt: 10 },
      { kind: "staff", n: "Rowan Staff", use: "dome", charges: 99 },
    ],
  };
  const folded = foldLegacyCounters(c, 40); // elapsed 30, cd 80 -> 50 left
  assert.deepStrictEqual(folded.timers["item:Cloak of Ether"], { cadence: "squares", left: 50, phase: "cooldown" });
  assert.equal("usedAt" in folded.items[0], false);
  assert.equal(folded.items[1].charges, 2, "clamped into [0, max] — Rowan Staff's pool is 2");
});

test("foldLegacyCounters: an active counter WINS over an item-fold cooldown for the same id (counters run second)", () => {
  const c = {
    ether: 15,
    items: [{ kind: "cloak", n: "Cloak of Ether", eff: {}, use: "ether", every: 80, txt: "x", usedAt: 10 }],
  };
  const folded = foldLegacyCounters(c, 40);
  assert.deepStrictEqual(folded.timers["item:Cloak of Ether"], { cadence: "squares", left: 15, cd: 80, phase: "effect" });
});

test("validateSave folds legacy counters through the real load chain (wornSlots option) with the tampered-charges clamp applied", () => {
  const run = newRun(9);
  run.c.items.push({ kind: "staff", n: "Oak Staff", use: "stone", every: 250, usedAt: 3, charges: "x" });
  run.steps = 30;
  const check = validateSave(JSON.stringify(serializeRun(run)), { wornSlots: true });
  assert.equal(check.ok, true);
  const staffItem =
    check.value.c.worn?.staff?.n === "Oak Staff" ? check.value.c.worn.staff : check.value.c.items.find((it) => it.n === "Oak Staff");
  assert.ok(staffItem);
  assert.equal(staffItem.charges, 1, "a tampered non-integer charge count defaults to a full pool");
  assert.equal("usedAt" in staffItem, false);
  assert.equal("every" in staffItem, false);
});
