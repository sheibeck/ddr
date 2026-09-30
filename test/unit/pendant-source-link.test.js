// test/unit/pendant-source-link.test.js
//
// Phase 89 plan 03 (ITEM-06; CONTEXT "Pendant of Fortitude", user 2026-09-30):
// taking the Pendant of Fortitude off disarms it. Before this plan its use
// set `c.halfNext = true`, a boolean that survived take-off, so a player could
// arm it and then swap it away and keep the benefit. The armed charge now
// carries its source like a timer record: `c.halfNext = { slot, n }` (truthy,
// so every existing read is unchanged). engine/items.js#endSourceEffects, the
// ONE early-end helper of Phase 88, gains one pass for it: when the source
// slot is touched (take off, swap, destroyed) or no longer holds the Pendant
// (the drop/sell sweep), the charge is disarmed with one `itemEffectEnded`
// (kind "half"). The use stays spent: its 100-square cooldown runs on
// untouched, so taking the Pendant off never readies it sooner.
//
// Clauses -> tests:
//   arm ................ "arm: ..."
//   halve (unchanged) .. "halve: ..."
//   take off ........... "take off: ..."
//   swap ............... "swap: ..."
//   destroyed .......... "destroyed: ..."
//   drop and sell ...... "drop / sell of a bag twin ..."
//   re-wear ............ "re-wear: ..."
//   idempotent / empty . "idempotent and empty: ..."
//   Joiner sheet ....... "Joiner sheet: ..."
//   load ............... "load: ..."

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollCheck, atLeastFor } from "../../engine/dice.js";
import { applyFoeDamageToPlayer } from "../../engine/combat.js";
import { useItem, unequipSlot, equipItem, dropItem, endSourceEffects, pilferFumbleRng } from "../../engine/items.js";
import { sellItem } from "../../engine/economy.js";
import { conditionsOf } from "../../engine/derived.js";
import { tickSquares } from "../../engine/effects.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { ACTIVATION_OF, JEWELRY } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const PENDANT = "Pendant of Fortitude";

function fakeRng(seq = []) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}
const NO_DRAW = () => fakeRng([]);

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

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides),
    floor: { g: [[{ wall: false, dark: false, seen: true, feat: null }]], px: 0, py: 0, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

const pendant = () => ({ kind: "jewel", ...JEWELRY.find((r) => r.n === PENDANT) });
const ring = () => ({ kind: "jewel", ...JEWELRY.find((r) => r.n === "Ring of Power") });
const types = (events) => events.map((e) => e.type);
const ended = (events) => events.filter((e) => e.type === "itemEffectEnded");

/** armed(slot) — a hero wearing the Pendant in `slot`, used (armed). */
function armed(slot = "jewelry2", cOverrides = {}, stateOverrides = {}) {
  const state = fixedState({ c: { worn: { [slot]: pendant() }, ...cOverrides }, ...stateOverrides });
  const events = useItem(state, { slot }, NO_DRAW(), []);
  assert.ok(events.some((e) => e.type === "itemUsed"), "the use went through");
  return state;
}

test("arm: using the worn Pendant links the charge to its slot and starts the 100-square cooldown", () => {
  const state = armed("jewelry2");
  assert.deepStrictEqual(state.c.halfNext, { slot: "jewelry2", n: PENDANT });
  assert.deepStrictEqual(state.c.timers[`item:${PENDANT}`], { cadence: "squares", left: 100, phase: "cooldown" });
  assert.ok(conditionsOf({ c: state.c }).some((chip) => chip.key === "halfNext"), "the chip still shows");
});

test("arm: a bag use (a legacy test double with no worn map) carries slot null and is never linked", () => {
  const state = fixedState({ c: { items: [pendant()] } });
  delete state.c.worn;
  useItem(state, 0, NO_DRAW(), []);
  assert.deepStrictEqual(state.c.halfNext, { slot: null, n: PENDANT });
  const events = endSourceEffects(state, state.c, [], { slots: ["jewelry1", "jewelry2", "cloak"], why: "off" });
  assert.deepStrictEqual(events, []);
  assert.ok(state.c.halfNext, "an unlinked charge is left alone");
});

test("halve: the next landed blow is halved (ceil) exactly as before, and the charge clears", () => {
  const state = armed("jewelry1");
  const foe = { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  state.combat = { foes: [foe], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false };
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.wp, 55 - 3, "ceil(5/2) = 3");
  assert.equal(state.c.halfNext, false);
  assert.deepEqual(types(events), ["damageHalved", "struckByFoe"]);
});

test("take off: unequipSlot while armed disarms it with one itemEffectEnded (kind half), the cooldown untouched", () => {
  const state = armed("jewelry2");
  tickSquares(state.c, 7);
  const cooldown = JSON.stringify(state.c.timers[`item:${PENDANT}`]);
  const events = unequipSlot(state, "jewelry2", [], NO_DRAW());
  assert.deepStrictEqual(types(events), ["itemUnequipped", "itemEffectEnded"]);
  assert.deepStrictEqual(ended(events)[0], {
    type: "itemEffectEnded", item: PENDANT, kind: "half", slot: "jewelry2", why: "off", left: 0, ready: 93,
  });
  assert.equal(state.c.halfNext, false);
  assert.equal(JSON.stringify(state.c.timers[`item:${PENDANT}`]), cooldown, "the use stays spent: the cooldown runs on untouched");
});

test("swap: equipping another jewel into the source slot disarms it (why swap); the other jewelry key leaves it armed", () => {
  const a = armed("jewelry2");
  a.c.items.push(ring());
  const other = equipItem(a, 0, [], "jewelry1", NO_DRAW());
  assert.equal(ended(other).length, 0);
  assert.deepStrictEqual(a.c.halfNext, { slot: "jewelry2", n: PENDANT }, "still armed");

  a.c.items.push(ring());
  const same = equipItem(a, 0, [], "jewelry2", NO_DRAW());
  assert.deepStrictEqual(ended(same).map((e) => [e.item, e.kind, e.why, e.slot]), [[PENDANT, "half", "swap", "jewelry2"]]);
  assert.equal(a.c.halfNext, false);
});

test("swap: an identical Pendant copy into the source slot disarms it too", () => {
  const state = armed("jewelry1");
  state.c.items.push(pendant());
  const events = equipItem(state, 0, [], "jewelry1", NO_DRAW());
  assert.deepStrictEqual(ended(events).map((e) => [e.item, e.why]), [[PENDANT, "swap"]]);
  assert.equal(state.c.halfNext, false);
});

test("destroyed: the helper with why destroyed disarms a charge linked to that slot", () => {
  const state = armed("jewelry2");
  delete state.c.worn.jewelry2;
  const events = endSourceEffects(state, state.c, [], { slots: ["jewelry2"], why: "destroyed" });
  assert.deepStrictEqual(ended(events).map((e) => [e.item, e.kind, e.why, e.slot]), [[PENDANT, "half", "destroyed", "jewelry2"]]);
  assert.equal(state.c.halfNext, false);
});

test("destroyed: a real Pilfer fumble that destroys the item in the charge's slot disarms it", () => {
  const SEED = 4242;
  const item = ring();
  let acts = -1;
  const mainRng = makeRng(SEED);
  for (let a = 0; a <= 5000; a++) {
    if (rollCheck(pilferFumbleRng({ acts: a }, mainRng, { n: item.n }), 20, atLeastFor(19, 20)).roll === 1) {
      acts = a;
      break;
    }
  }
  assert.ok(acts >= 0, "a fumbling key exists");
  const state = fixedState({ acts, c: { cls: "Thief", sub: "Pilfer", wp: 40, maxWP: 40, worn: { jewelry2: item } } });
  // a stale charge still linked to the slot the ring sits in
  state.c.halfNext = { slot: "jewelry2", n: PENDANT };
  const events = useItem(state, { slot: "jewelry2" }, makeRng(SEED), []);
  assert.ok(types(events).includes("pilferFumbled"));
  assert.ok(types(events).indexOf("pilferFumbled") < types(events).indexOf("itemEffectEnded"), "the gear event comes first");
  assert.deepStrictEqual(ended(events).map((e) => [e.item, e.kind, e.why]), [[PENDANT, "half", "destroyed"]]);
  assert.equal(state.c.halfNext, false);
});

test("drop / sell of a bag twin of the Pendant leaves the worn one's charge armed", () => {
  for (const leave of [(s) => dropItem(s, 0, []), (s) => sellItem(s, 0, [])]) {
    const state = armed("jewelry2");
    state.c.items.push(pendant());
    const events = leave(state);
    assert.equal(ended(events).length, 0);
    assert.deepStrictEqual(state.c.halfNext, { slot: "jewelry2", n: PENDANT });
  }
});

test("sweep: a charge whose slot no longer holds the Pendant disarms as 'gone' (the drop/sell sweep)", () => {
  const state = armed("jewelry2");
  delete state.c.worn.jewelry2;
  const events = endSourceEffects(state, state.c, [], {});
  assert.deepStrictEqual(ended(events).map((e) => [e.item, e.kind, e.why]), [[PENDANT, "half", "gone"]]);
  assert.equal(state.c.halfNext, false);
});

test("re-wear: putting the Pendant back on never re-arms it and never readies it sooner", () => {
  const state = armed("jewelry2");
  tickSquares(state.c, 10);
  unequipSlot(state, "jewelry2", [], NO_DRAW());
  const cooldown = JSON.stringify(state.c.timers[`item:${PENDANT}`]);
  equipItem(state, state.c.items.findIndex((i) => i.n === PENDANT), [], "jewelry2", NO_DRAW());
  assert.equal(state.c.halfNext, false, "not re-armed");
  assert.equal(JSON.stringify(state.c.timers[`item:${PENDANT}`]), cooldown, "the cooldown is exactly what it was");
  const refused = useItem(state, { slot: "jewelry2" }, NO_DRAW(), []);
  assert.ok(refused.some((e) => e.type === "useRefused" && e.reason === "cooldown" && e.left === 90));
});

test("idempotent and empty: a second call disarms nothing more; a disarmed sheet, a sheet with no timers and a null sheet are silent no-ops", () => {
  const state = armed("jewelry2");
  const first = endSourceEffects(state, state.c, [], { slots: ["jewelry2"], why: "off" });
  const second = endSourceEffects(state, state.c, [], { slots: ["jewelry2"], why: "off" });
  assert.equal(ended(first).length, 1);
  assert.equal(ended(second).length, 0);

  const events = [];
  const bare = fixedFighter();
  assert.equal(endSourceEffects(state, bare, events, { slots: ["jewelry2"] }), events);
  assert.equal("timers" in bare, false, "never creates a timers map");
  assert.equal(endSourceEffects(state, null, events, { slots: ["jewelry2"] }), events);
  assert.equal(endSourceEffects(null, null, events), events);
  assert.deepEqual(events, []);

  // a linked charge on a sheet with NO timers map is still disarmed (and still creates none)
  const noTimers = fixedFighter({ halfNext: { slot: "jewelry2", n: PENDANT }, worn: {} });
  const out = endSourceEffects(state, noTimers, [], { slots: ["jewelry2"], why: "off" });
  assert.equal(noTimers.halfNext, false);
  assert.equal("timers" in noTimers, false);
  assert.deepStrictEqual(ended(out).map((e) => [e.kind, e.ready]), [["half", 0]]);
});

test("quiet: the load-time sweep disarms with no event", () => {
  const state = armed("jewelry2");
  delete state.c.worn.jewelry2;
  const events = endSourceEffects(null, state.c, [], { quiet: true });
  assert.deepEqual(events, []);
  assert.equal(state.c.halfNext, false);
});

test("Joiner sheet: a Joiner's linked halfNext disarms through the same helper and its event carries member", () => {
  const joiner = fixedFighter({ name: "Joiny", worn: { jewelry1: pendant() }, halfNext: { slot: "jewelry1", n: PENDANT } });
  const state = fixedState({ party: [joiner] });
  const events = endSourceEffects(state, joiner, [], { slots: ["jewelry1"], why: "off" });
  assert.deepStrictEqual(ended(events).map((e) => [e.item, e.kind, e.member]), [[PENDANT, "half", "Joiny"]]);
  assert.equal(joiner.halfNext, false);
  assert.equal(state.c.halfNext, false, "the hero is untouched");
});

// ─── load ───────────────────────────────────────────────────────────────────

function runWith(cOverrides = {}) {
  const state = newRun(3);
  Object.assign(state.c, { items: [], worn: {}, timers: {}, ...cOverrides });
  return state;
}
function load(state) {
  const r = validateSave(JSON.stringify(serializeRun(state)));
  assert.ok(r.ok, r.reason);
  return r.value;
}

test("load: an old save's armed Pendant (halfNext true) links to the worn Pendant, the first worn key holding it", () => {
  const state = runWith({ worn: { jewelry2: pendant() }, halfNext: true });
  assert.deepStrictEqual(load(state).c.halfNext, { slot: "jewelry2", n: PENDANT });
  const both = runWith({ worn: { jewelry1: pendant(), jewelry2: pendant() }, halfNext: true });
  assert.deepStrictEqual(load(both).c.halfNext, { slot: "jewelry1", n: PENDANT });
});

test("load: an armed Pendant with none worn is quietly disarmed (no event, no throw)", () => {
  const state = runWith({ items: [pendant()], worn: {}, halfNext: true });
  assert.equal(load(state).c.halfNext, false);
});

test("load: a linked charge survives a relaunch; a stale link (slot now holds something else) disarms; junk values load false", () => {
  const live = runWith({ worn: { jewelry1: pendant() } });
  useItem(live, { slot: "jewelry1" }, NO_DRAW(), []);
  const loaded = rehydrate(JSON.parse(JSON.stringify(load(live))));
  assert.deepStrictEqual(loaded.c.halfNext, { slot: "jewelry1", n: PENDANT });
  assert.equal(unequipSlot(loaded, "jewelry1", [], NO_DRAW()).filter((e) => e.type === "itemEffectEnded").length, 1);

  const stale = runWith({ worn: { jewelry1: ring() }, halfNext: { slot: "jewelry1", n: PENDANT } });
  assert.equal(load(stale).c.halfNext, false);

  for (const junk of ["yes", 1, [], { slot: "nowhere", n: PENDANT }]) {
    const s = runWith({ worn: { jewelry1: pendant() }, halfNext: junk });
    assert.doesNotThrow(() => load(s));
    const v = load(s).c.halfNext;
    assert.ok(v === false || (v && v.slot === "jewelry1"), `junk ${JSON.stringify(junk)} -> ${JSON.stringify(v)}`);
  }
});

test("load: a Joiner's armed Pendant reconciles the same way", () => {
  const state = runWith();
  state.party = [{ ...fixedFighter({ name: "Joiny", worn: { jewelry2: pendant() }, halfNext: true }) }];
  assert.deepStrictEqual(load(state).party[0].halfNext, { slot: "jewelry2", n: PENDANT });
  state.party[0].worn = {};
  assert.equal(load(state).party[0].halfNext, false);
});

test("the Pendant's activation is unchanged: an instant use with a 100-square cooldown and no effect", () => {
  assert.deepStrictEqual(ACTIVATION_OF[PENDANT], { kind: "half", effect: 0, cd: 100 });
});
