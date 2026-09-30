// test/unit/item-effect-source-save.test.js
//
// Phase 88 plan 02 (ITEM-02, persistence): the effect-source link
// (`src: { slot, n }` on an `item:<name>` timer record, stamped in 88-01)
// survives save, load and relaunch, and engine/saveState.js#reconcileItemSources
// is the ONE load-time reconciliation:
//   - a live worn-item effect with no recorded source links to the matching
//     worn item when one is there (the first SOURCE_SLOTS key that holds it),
//     otherwise it ends quietly as the spent use (left + cd, no event);
//   - a live Crystal Staff record links to a wielded Crystal Staff, else it is
//     removed (its charges and `charges:` record are never touched);
//   - a recorded source whose slot no longer holds that item, or that is
//     malformed, is treated the same way and never throws or rejects a save;
//   - every Joiner sheet in the party is reconciled the same way.
//
// User words (backlog 999.16, 2026-09-28): "when you use an item and then take
// that item off, you should lose the items benefit."
// ROADMAP Phase 88 criterion 2: "after saving, quitting and relaunching in the
// middle of an effect, the effect still knows its item and ends when the item
// comes off".
//
// Helpers mirror the established per-file convention (copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave, rehydrate, reconcileItemSources } from "../../engine/saveState.js";
import { startEffect, tickSquares } from "../../engine/effects.js";
import { useItem, unequipSlot } from "../../engine/items.js";
import { isFlying, critWardOf, effectSourceOf, foeToHitVs, itemEffectActive } from "../../engine/derived.js";
import { ACTIVATION_OF, CLOAKS, JEWELRY, STAVES } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ─── helpers ────────────────────────────────────────────────────────────────

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
const NO_DRAW = () => fakeRng([]);

/** The real content row as a carried item, built as the treasure rollers do. */
function item(name) {
  const cloak = CLOAKS.find((r) => r.n === name);
  if (cloak) return { kind: "cloak", ...cloak };
  const jewel = JEWELRY.find((r) => r.n === name);
  if (jewel) return { kind: "jewel", ...jewel };
  const staff = STAVES.find((r) => r.n === name);
  if (staff) return { kind: "staff", charges: ACTIVATION_OF[name].charges, ...staff };
  throw new Error(`no treasure row named ${name}`);
}

function joinerSheet(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 40, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    items: [], name: "Joiny", worn: {},
    ...overrides,
  };
}

/** A real run with the hero's gear and timers replaced. */
function runWith(cOverrides = {}, stateOverrides = {}) {
  const state = newRun(3);
  Object.assign(state.c, { items: [], worn: {}, timers: {}, ...cOverrides });
  Object.assign(state, stateOverrides);
  return state;
}

/** save -> JSON -> validateSave (the real load path), returning the loaded value. */
function load(state) {
  const r = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(r.ok, r.reason);
  return r.value;
}

/** the full relaunch: validateSave then rehydrate on its own output. */
function relaunch(state) {
  return rehydrate(JSON.parse(JSON.stringify(load(state))));
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const types = (events) => events.map((e) => e.type);
const endedEvents = (events) => events.filter((e) => e.type === "itemEffectEnded");

// ─── relaunch: a link made in play ───────────────────────────────────────────

test("relaunch: a Cloak of Flying used and walked keeps src and left exactly, then ends with one itemEffectEnded on take-off", () => {
  const state = runWith({ worn: { cloak: item("Cloak of Flying") } });
  const ev = useItem(state, { slot: "cloak" }, NO_DRAW(), []);
  assert.ok(ev.some((e) => e.type === "itemEffectStarted"));
  tickSquares(state.c, 5);
  const saved = clone(state.c.timers["item:Cloak of Flying"]);
  assert.deepEqual(saved.src, { slot: "cloak", n: "Cloak of Flying" });
  assert.equal(saved.phase, "effect");
  assert.equal(saved.left, ACTIVATION_OF["Cloak of Flying"].effect - 5);

  const loaded = relaunch(state);
  assert.deepEqual(loaded.c.timers["item:Cloak of Flying"], saved, "the record survives byte-identical");
  assert.equal(isFlying(loaded.c), true);

  const events = unequipSlot(loaded, "cloak", [], NO_DRAW());
  assert.equal(endedEvents(events).length, 1, "exactly one itemEffectEnded");
  assert.equal(endedEvents(events)[0].item, "Cloak of Flying");
  assert.equal(isFlying(loaded.c), false);
});

test("relaunch: validateSave alone (without rehydrate) keeps the record exactly", () => {
  const state = runWith({ worn: { cloak: item("Cloak of Flying") } });
  useItem(state, { slot: "cloak" }, NO_DRAW(), []);
  tickSquares(state.c, 5);
  const saved = clone(state.c.timers["item:Cloak of Flying"]);
  assert.deepEqual(load(state).c.timers["item:Cloak of Flying"], saved);
});

// ─── old saves ────────────────────────────────────────────────────────────────

test("old save, worn: a live record with no src and the item worn in jewelry2 loads linked to jewelry2 and stays live", () => {
  const state = runWith({ worn: { jewelry2: item("Ring of Power") } });
  startEffect(state.c, "item:Ring of Power", { squares: ACTIVATION_OF["Ring of Power"].effect, cd: ACTIVATION_OF["Ring of Power"].cd });
  assert.equal("src" in state.c.timers["item:Ring of Power"], false);
  const c = load(state).c;
  const rec = c.timers["item:Ring of Power"];
  assert.deepEqual(rec.src, { slot: "jewelry2", n: "Ring of Power" });
  assert.equal(rec.phase, "effect");
  assert.equal(rec.left, ACTIVATION_OF["Ring of Power"].effect);
});

test("old save, worn: the first SOURCE_SLOTS key holding the item wins (jewelry1 before jewelry2)", () => {
  const state = runWith({ worn: { jewelry1: item("Ring of Power"), jewelry2: item("Ring of Power") } });
  startEffect(state.c, "item:Ring of Power", { squares: 10, cd: 50 });
  assert.deepEqual(load(state).c.timers["item:Ring of Power"].src, { slot: "jewelry1", n: "Ring of Power" });
});

test("old save, not worn: a live record with no src and the cloak only in the bag loads as the spent cooldown, no event", () => {
  const act = ACTIVATION_OF["Cloak of Speed"];
  const state = runWith({ items: [item("Cloak of Speed")], worn: {} });
  startEffect(state.c, "item:Cloak of Speed", { squares: 20, cd: act.cd });
  const r = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(r.ok, r.reason);
  assert.deepEqual(r.value.c.timers["item:Cloak of Speed"], { cadence: "squares", left: 20 + act.cd, phase: "cooldown" });
});

test("tampered: a src naming the cloak slot while it holds a different cloak loads as the spent cooldown", () => {
  const state = runWith({ worn: { cloak: item("Cloak of Strength") } });
  startEffect(state.c, "item:Cloak of Flying", { squares: 12, cd: 50 });
  state.c.timers["item:Cloak of Flying"].src = { slot: "cloak", n: "Cloak of Flying" };
  const c = load(state).c;
  assert.deepEqual(c.timers["item:Cloak of Flying"], { cadence: "squares", left: 62, phase: "cooldown" });
});

test("tampered: a stale src (the item is no longer in its slot) ends quietly, never revives the effect", () => {
  const state = runWith({ items: [item("Cloak of Flying")], worn: {} });
  startEffect(state.c, "item:Cloak of Flying", { squares: 12, cd: 50 });
  state.c.timers["item:Cloak of Flying"].src = { slot: "cloak", n: "Cloak of Flying" };
  const c = load(state).c;
  assert.equal(c.timers["item:Cloak of Flying"].phase, "cooldown");
  assert.equal(isFlying(c), false);
});

test("tampered: a malformed src (string, array, unknown slot, empty name, wrong name) is treated as missing: linked when worn, ended when not, never throws", () => {
  const bad = ["x", [], { slot: "hat", n: "Ring of Power" }, { slot: "jewelry1", n: "" }, { slot: "jewelry1" }, 7, null, { slot: "jewelry1", n: "Ring of Speed" }];
  for (const src of bad) {
    // worn: the malformed link is replaced by the true one
    const worn = runWith({ worn: { jewelry1: item("Ring of Power") } });
    startEffect(worn.c, "item:Ring of Power", { squares: 10, cd: 50 });
    worn.c.timers["item:Ring of Power"].src = src;
    const c = load(worn).c;
    assert.deepEqual(effectSourceOf(c.timers["item:Ring of Power"]), { slot: "jewelry1", n: "Ring of Power" }, `worn, src ${JSON.stringify(src)}`);
    assert.equal(c.timers["item:Ring of Power"].phase, "effect");
    // bagged: the effect ends quietly
    const bagged = runWith({ items: [item("Ring of Power")], worn: {} });
    startEffect(bagged.c, "item:Ring of Power", { squares: 10, cd: 50 });
    bagged.c.timers["item:Ring of Power"].src = src;
    const c2 = load(bagged).c;
    assert.deepEqual(c2.timers["item:Ring of Power"], { cadence: "squares", left: 60, phase: "cooldown" }, `bagged, src ${JSON.stringify(src)}`);
  }
});

test("untouched: a potion record, the Torch record and every cooldown-phase record load exactly as saved", () => {
  const state = runWith({ worn: { cloak: item("Cloak of Flying") } });
  state.c.timers = {
    "item:Speed": { cadence: "squares", left: 30, phase: "effect" },
    "item:Torch": { cadence: "squares", left: 40, phase: "effect" },
    "item:Cloak of Flying": { cadence: "squares", left: 17, phase: "cooldown" },
    "item:Ring of Power": { cadence: "squares", left: 33, phase: "cooldown", src: { slot: "jewelry1", n: "Ring of Power" } },
    "charges:Crystal Staff": { cadence: "squares", left: 70, phase: "cooldown" },
  };
  const before = clone(state.c.timers);
  const c = load(state).c;
  assert.deepEqual(c.timers, before);
});

test("never creates c.timers or c.worn on a sheet that had none", () => {
  const sheet = { name: "Bare" };
  assert.equal(reconcileItemSources(sheet), sheet);
  assert.equal("timers" in sheet, false);
  assert.equal("worn" in sheet, false);
  assert.equal(reconcileItemSources(null), null);
  assert.deepEqual(reconcileItemSources({ timers: "x" }), { timers: "x" });
  assert.deepEqual(reconcileItemSources({ timers: [] }), { timers: [] });
});

test("a hostile timers value never throws (null record, string record, array record)", () => {
  const sheet = { worn: {}, timers: { "item:Ring of Power": null, "item:Cloak of Speed": "x", "item:Cloak of Flying": [] } };
  assert.doesNotThrow(() => reconcileItemSources(sheet));
});

// ─── the Crystal Staff ────────────────────────────────────────────────────────

function wieldedStaffRun(extra = {}) {
  const staff = item("Crystal Staff");
  return runWith({ cls: "Magic User", weapon: "Crystal Staff", staff, items: [], worn: {} }, extra);
}

test("Crystal Staff, wielded: an old record with no src loads linked to the weapon slot; the party read follows; unwield ends it with one party event", () => {
  const joiner = joinerSheet();
  const state = wieldedStaffRun({ party: [joiner] });
  startEffect(state.c, "item:Crystal Staff", { squares: 12 });
  const plainNeed = foeToHitVs({ ...state, c: { ...state.c, timers: {} } }, "member", joiner);
  assert.ok(plainNeed > 1);

  const loaded = rehydrate(JSON.parse(JSON.stringify(load(state))));
  assert.deepEqual(loaded.c.timers["item:Crystal Staff"].src, { slot: "weapon", n: "Crystal Staff" });
  assert.equal(loaded.c.timers["item:Crystal Staff"].left, 12);
  assert.equal(foeToHitVs(loaded, "member", loaded.party[0]), 1, "the one-face defence reaches the Joiner");

  const events = unequipSlot(loaded, "weapon", [], NO_DRAW());
  const end = endedEvents(events);
  assert.equal(end.length, 1);
  assert.equal(end[0].party, true);
  assert.equal(foeToHitVs(loaded, "member", loaded.party[0]), plainNeed, "the Joiner's ordinary faces are back");
});

test("Crystal Staff, not wielded (staff in the bag): the record is removed, no event, charges and the recharge record untouched, the member read is ordinary", () => {
  const joiner = joinerSheet();
  const staff = item("Crystal Staff");
  const state = runWith({ cls: "Magic User", weapon: "Fists", items: [staff], worn: {} }, { party: [joiner] });
  staff.charges = 0;
  startEffect(state.c, "item:Crystal Staff", { squares: 12 });
  state.c.timers["charges:Crystal Staff"] = { cadence: "squares", left: 70, phase: "cooldown" };
  const loaded = load(state);
  assert.equal("item:Crystal Staff" in loaded.c.timers, false);
  assert.deepEqual(loaded.c.timers["charges:Crystal Staff"], { cadence: "squares", left: 70, phase: "cooldown" });
  const bagged = loaded.c.items.find((i) => i.n === "Crystal Staff");
  assert.equal(bagged.charges, 0, "the spent charge stays spent");
  assert.equal(itemEffectActive(loaded.c, "invis"), false);
  const plain = foeToHitVs(loaded, "member", loaded.party[0]);
  assert.ok(plain > 1, "no one-face defence any more");
});

test("Crystal Staff, tampered: a src naming weapon while sanitizeStaff un-wields a mismatched staff ends quietly", () => {
  const state = wieldedStaffRun();
  startEffect(state.c, "item:Crystal Staff", { squares: 12 });
  state.c.timers["item:Crystal Staff"].src = { slot: "weapon", n: "Crystal Staff" };
  state.c.staff = { ...state.c.staff, n: "Some Other Staff" }; // c.staff no longer agrees with c.weapon
  const c = load(state).c;
  assert.equal(c.weapon, "Fists", "sanitizeStaff repaired the pair");
  assert.equal("item:Crystal Staff" in c.timers, false);
});

test("Crystal Staff, relaunch: a record linked in play keeps its src and left exactly", () => {
  const state = wieldedStaffRun();
  useItem(state, { slot: "weapon" }, fakeRng([10]), []);
  const saved = clone(state.c.timers["item:Crystal Staff"]);
  assert.deepEqual(saved.src, { slot: "weapon", n: "Crystal Staff" });
  const loaded = relaunch(state);
  assert.deepEqual(loaded.c.timers["item:Crystal Staff"], saved);
  const events = unequipSlot(loaded, "weapon", [], NO_DRAW());
  assert.equal(endedEvents(events).length, 1);
});

// ─── Joiner sheets ────────────────────────────────────────────────────────────

test("Joiner: a member wearing a Cloak of Strength with a live record and no src loads linked; a member without it loses the effect quietly", () => {
  const wearer = joinerSheet({ name: "Wearer", worn: { cloak: item("Cloak of Strength") } });
  startEffect(wearer, "item:Cloak of Strength", { squares: 30, cd: 50 });
  const bare = joinerSheet({ name: "Bare" });
  delete bare.worn;
  startEffect(bare, "item:Cloak of Strength", { squares: 30, cd: 50 });
  const state = runWith({}, { party: [wearer, bare] });
  const loaded = load(state);
  const w = loaded.party.find((m) => m.name === "Wearer");
  const b = loaded.party.find((m) => m.name === "Bare");
  assert.deepEqual(w.timers["item:Cloak of Strength"].src, { slot: "cloak", n: "Cloak of Strength" });
  assert.equal(w.timers["item:Cloak of Strength"].phase, "effect");
  assert.equal(critWardOf(w), "Cloak of Strength");
  assert.deepEqual(b.timers["item:Cloak of Strength"], { cadence: "squares", left: 80, phase: "cooldown" });
  assert.equal(critWardOf(b), null);
});

test("Joiner: a linked record on a Joiner sheet survives a full relaunch", () => {
  const wearer = joinerSheet({ name: "Wearer", worn: { cloak: item("Cloak of Strength") } });
  startEffect(wearer, "item:Cloak of Strength", { squares: 30, cd: 50 });
  wearer.timers["item:Cloak of Strength"].src = { slot: "cloak", n: "Cloak of Strength" };
  const saved = clone(wearer.timers["item:Cloak of Strength"]);
  const loaded = relaunch(runWith({}, { party: [wearer] }));
  assert.deepEqual(loaded.party[0].timers["item:Cloak of Strength"], saved);
});

// ─── ITEM-04 across a relaunch ────────────────────────────────────────────────

test("ITEM-04 across a relaunch: the old-save cloak (eff.noCrit) with a live record loads linked, wards, and ends with the cloak", () => {
  const state = runWith({
    worn: { cloak: { kind: "cloak", n: "Cloak of Strength", eff: { noCrit: 1 }, txt: "old text" } },
  });
  startEffect(state.c, "item:Cloak of Strength", { squares: 50, cd: 50 });
  const loaded = relaunch(state);
  assert.deepEqual(loaded.c.timers["item:Cloak of Strength"].src, { slot: "cloak", n: "Cloak of Strength" });
  assert.equal(critWardOf(loaded.c), "Cloak of Strength");
  unequipSlot(loaded, "cloak", [], NO_DRAW());
  assert.equal(critWardOf(loaded.c), null);
});

// ─── idempotency, legacy worn map ─────────────────────────────────────────────

test("idempotent: validateSave, serializeRun, validateSave gives deep-equal c.timers; rehydrate on the output changes nothing further", () => {
  const state = runWith({ worn: { jewelry2: item("Ring of Power") }, items: [item("Cloak of Speed")] });
  startEffect(state.c, "item:Ring of Power", { squares: 10, cd: 50 });
  startEffect(state.c, "item:Cloak of Speed", { squares: 10, cd: 50 });
  const once = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(once.ok);
  const twice = validateSave(JSON.stringify(serializeRun(clone(once.value))));
  assert.ok(twice.ok);
  assert.deepEqual(twice.value.c.timers, once.value.c.timers);
  const re = rehydrate(clone(once.value));
  assert.deepEqual(re.c.timers, once.value.c.timers);
});

test("legacy save with no worn map: the bagged cloak auto-worn at load links to the auto-worn slot", () => {
  const state = runWith({ items: [item("Cloak of Flying")] });
  delete state.c.worn;
  startEffect(state.c, "item:Cloak of Flying", { squares: 12, cd: 50 });
  const c = load(state).c;
  assert.equal(c.worn.cloak.n, "Cloak of Flying");
  assert.deepEqual(c.timers["item:Cloak of Flying"].src, { slot: "cloak", n: "Cloak of Flying" });
  assert.equal(c.timers["item:Cloak of Flying"].phase, "effect");
});

// ─── fairness: a load never grants ────────────────────────────────────────────

test("a load never grants, extends or revives: a live linked effect the gear backs is unchanged, and no record is ever created", () => {
  const state = runWith({ worn: { cloak: item("Cloak of Speed") } });
  const before = clone(state.c.timers);
  const c = load(state).c;
  assert.deepEqual(c.timers, before, "no effect appears out of nothing");
});
