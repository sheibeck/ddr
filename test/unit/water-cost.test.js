// test/unit/water-cost.test.js
//
// Phase 41 (TERR-02, Plan 02) — the ratified Key Decision "one tap, two
// squares of time": direct unit coverage for `engine/derived.js#moveCost` and
// the cost-aware step site in `engine/movement.js#move` (the `crossings(n)`
// cadence helper, `tickSquares(c, cost)` once, the affliction/darkFor/cloak/
// spell-charge/newDay cadences, the `waded` entry-only event, and the
// flight/ether exemption). Helpers copied verbatim from
// test/unit/movement.test.js (fakeRng/wallGrid/open/fixedFighter/fixedState
// are module-local there, not exported).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { move, maxCharges } from "../../engine/movement.js";
import { moveCost, WATER_MOVE_COST } from "../../engine/derived.js";
import { startEffect, startCooldown } from "../../engine/effects.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws if the sequence underflows, which doubles as
 * a "no more rng draws expected" assertion. */
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

/** A minimal, fully-walled 21x21 grid (matches engine/maze.js's GW/GH) with
 * a hole punched wherever a test needs an open cell. */
function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// --- moveCost(state, cell) — the pure derived read --------------------------

test("moveCost: a null/undefined/dry cell costs 1", () => {
  const state = fixedState();
  assert.equal(moveCost(state, null), 1);
  assert.equal(moveCost(state, undefined), 1);
  assert.equal(moveCost(state, {}), 1);
  assert.equal(moveCost(state, { water: false }), 1);
});

test("moveCost: a genuine water cell costs WATER_MOVE_COST (2) for a plain hero", () => {
  const state = fixedState();
  assert.equal(WATER_MOVE_COST, 2);
  assert.equal(moveCost(state, { water: true }), 2);
});

test("moveCost: a Bracelet of Flight carrier pays 1 on water", () => {
  const state = fixedState({ c: { items: [{ n: "Bracelet of Flight" }] } });
  assert.equal(moveCost(state, { water: true }), 1);
});

test("moveCost: a LIVE Cloak-of-Flying fly effect pays 1 on water", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Flying", { squares: 20, cd: 50 });
  assert.equal(moveCost(state, { water: true }), 1);
});

test("moveCost: a LIVE Cloak-of-Ether effect pays 1 on water", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Ether", { squares: 20, cd: 80 });
  assert.equal(moveCost(state, { water: true }), 1);
});

test("moveCost: a READY-but-unstarted Cloak of Flying still costs 2 — a puddle does not spend the cloak", () => {
  const state = fixedState({ c: { items: [{ n: "Cloak of Flying", slot: "cloak", eff: { fly: 1 } }] } });
  assert.equal(moveCost(state, { water: true }), 2);
});

// --- move(): the cost-aware step site — entry/exit/waded --------------------

test("move: stepping onto water from dry costs 2, exactly one moved, exactly one waded{cost:2}", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 2);
  assert.equal(events.filter((e) => e.type === "moved").length, 1);
  const waded = events.filter((e) => e.type === "waded");
  assert.equal(waded.length, 1);
  assert.equal(waded[0].cost, 2);
});

test("move: water -> water costs 2 with no waded (not a fresh entry)", () => {
  const state = fixedState();
  open(state.floor.g, 5, 5, { water: true });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 2);
  assert.ok(!events.some((e) => e.type === "waded"));
});

test("move: water -> dry costs 1 with no waded", () => {
  const state = fixedState();
  open(state.floor.g, 5, 5, { water: true });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 1);
  assert.ok(!events.some((e) => e.type === "waded"));
});

test("move: a Bracelet of Flight carrier stepping onto water pays 1, no waded", () => {
  const state = fixedState({ c: { items: [{ n: "Bracelet of Flight" }] } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 1);
  assert.ok(!events.some((e) => e.type === "waded"));
});

test("move: a LIVE Cloak-of-Flying fly effect stepping onto water pays 1, no waded", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Flying", { squares: 20, cd: 50 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 1);
  assert.ok(!events.some((e) => e.type === "waded"));
});

test("move: a LIVE Cloak-of-Ether effect stepping onto water pays 1, no waded", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Ether", { squares: 20, cd: 80 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 1);
  assert.ok(!events.some((e) => e.type === "waded"));
});

test("move: a READY-but-unstarted Cloak of Flying pays 2 on water and starts NO effect record", () => {
  const state = fixedState({ c: { items: [{ n: "Cloak of Flying", slot: "cloak", eff: { fly: 1 } }] } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 2);
  assert.ok(events.some((e) => e.type === "waded" && e.cost === 2));
  assert.equal(state.c.timers, undefined, "a water step never starts a fresh Cloak of Flying window (unlike the climb block)");
});

// --- cadence crossings: never skipped, never doubled ------------------------

test("move: a water step crossing the 100-square boundary rolls the day exactly once (98 -> 100)", () => {
  const state = fixedState({ steps: 98 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", makeRng(1), []);
  assert.equal(state.steps, 100);
  assert.equal(events.filter((e) => e.type === "dayBegan").length, 1);
});

test("move: a water step crossing 100 from an odd base still rolls the day exactly once (99 -> 101)", () => {
  const state = fixedState({ steps: 99 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", makeRng(1), []);
  assert.equal(state.steps, 101);
  assert.equal(events.filter((e) => e.type === "dayBegan").length, 1);
});

test("move: a water step that never reaches 100 rolls no day (97 -> 99)", () => {
  const state = fixedState({ steps: 97 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", makeRng(1), []);
  assert.equal(state.steps, 99);
  assert.equal(events.filter((e) => e.type === "dayBegan").length, 0);
});

test("move: a Magic User's spell charge recovers exactly once across a water step (19 -> 21)", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", spellsUsed: 1 }, steps: 19 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 21);
  assert.equal(state.c.spellsUsed, 0);
  assert.equal(maxCharges(state.c), 2 * 1 + 2 + 0);
  assert.equal(events.filter((e) => e.type === "spellChargeRecovered").length, 1);
});

test("move: Cloak of Healing ticks exactly once across a water step (19 -> 21) with ZERO rng draws", () => {
  const state = fixedState({
    c: { items: [{ kind: "cloak", n: "Cloak of Healing", eff: { cloakHeal: 1 }, txt: "" }], wp: 10, maxWP: 55 },
    steps: 19,
  });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []); // fakeRng([]) throws on ANY draw
  assert.equal(state.steps, 21);
  assert.equal(state.c.wp, 20, "flat +10 heal, one tick only");
  assert.equal(events.filter((e) => e.type === "cloakHealed").length, 1);
});

// --- affliction cadence: crossings(af.per), stops early once cleared -------

test("move: a per:1 affliction ticks TWICE on one water step (two afflictionTick events, two loss draws)", () => {
  const state = fixedState({
    c: { affliction: { kind: "Poison", per: 1, loss: { n: 1, sides: 6, bonus: 0 }, left: 5 }, wp: 55 },
  });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([3, 4]), []);
  const ticks = events.filter((e) => e.type === "afflictionTick");
  assert.equal(ticks.length, 2);
  assert.deepStrictEqual(ticks.map((e) => e.loss), [3, 4]);
  assert.equal(state.c.wp, 55 - 3 - 4);
  assert.equal(state.c.affliction.left, 3);
});

test("move: a per:10 affliction ticks once crossing 9 -> 11", () => {
  const state = fixedState({
    c: { affliction: { kind: "Disease", per: 10, loss: { n: 1, sides: 6, bonus: 0 }, left: 20 }, wp: 55 },
    steps: 9,
  });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([2]), []);
  assert.equal(state.steps, 11);
  assert.equal(events.filter((e) => e.type === "afflictionTick").length, 1);
});

test("move: a per:10 affliction ticks once crossing 8 -> 10", () => {
  const state = fixedState({
    c: { affliction: { kind: "Disease", per: 10, loss: { n: 1, sides: 6, bonus: 0 }, left: 20 }, wp: 55 },
    steps: 8,
  });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([2]), []);
  assert.equal(state.steps, 10);
  assert.equal(events.filter((e) => e.type === "afflictionTick").length, 1);
});

test("move: a per:10 affliction ticks zero times crossing 10 -> 12", () => {
  const state = fixedState({
    c: { affliction: { kind: "Disease", per: 10, loss: { n: 1, sides: 6, bonus: 0 }, left: 20 }, wp: 55 },
    steps: 10,
  });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 12);
  assert.equal(events.filter((e) => e.type === "afflictionTick").length, 0);
});

test("move: an affliction that clears on the first of two crossings does NOT tick a second time", () => {
  const state = fixedState({
    c: { affliction: { kind: "Poison", per: 1, loss: { n: 1, sides: 6, bonus: 0 }, left: 5 }, wp: 1 },
  });
  open(state.floor.g, 5, 4, { water: true });
  // wp:1 clamps loss to 0 on the FIRST tick regardless of the die -> clears
  // immediately (afflictionPassed) and the loop must stop, never drawing a
  // second die (fakeRng throws on an unexpected second draw).
  const events = move(state, "N", fakeRng([5]), []);
  assert.equal(events.filter((e) => e.type === "afflictionTick").length, 0);
  assert.equal(events.filter((e) => e.type === "afflictionPassed").length, 1);
  assert.equal(state.c.affliction, null);
});

// --- darkFor: decrements by cost, clamped at 0, one event on the crossing --

test("move: darkFor 2 -> 0 on a water step, exactly one darknessLifted", () => {
  const state = fixedState({ c: { darkFor: 2 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 0);
  assert.equal(events.filter((e) => e.type === "darknessLifted").length, 1);
});

test("move: darkFor 1 -> 0 on a water step (overshoot clamps at 0), exactly one darknessLifted", () => {
  const state = fixedState({ c: { darkFor: 1 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 0);
  assert.equal(events.filter((e) => e.type === "darknessLifted").length, 1);
});

test("move: darkFor 3 -> 1 on a water step, no event", () => {
  const state = fixedState({ c: { darkFor: 3 } });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 1);
  assert.ok(!events.some((e) => e.type === "darknessLifted"));
});

// --- c.timers: tickSquares(c, cost), called once -----------------------------

test("move: a squares timer left:3 becomes left:1 on a water step (no transition)", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Speed", { squares: 3 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["item:Cloak of Speed"].left, 1);
  assert.ok(!events.some((e) => e.type === "itemEffectFaded" || e.type === "itemCooled"));
});

test("move: a squares timer left:1,cd:50 flips to cooldown with EXACTLY one transition/itemEffectFaded", () => {
  const state = fixedState();
  startEffect(state.c, "item:Cloak of Ether", { squares: 1, cd: 50 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.deepStrictEqual(state.c.timers["item:Cloak of Ether"], { cadence: "squares", left: 50, cd: 50, phase: "cooldown" });
  assert.equal(events.filter((e) => e.type === "itemEffectFaded").length, 1);
});

test("move: a squares timer left:2 with no cd is deleted on a water step, one transition", () => {
  const state = fixedState();
  startEffect(state.c, "item:Invisible", { squares: 2 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["item:Invisible"], undefined);
  assert.equal(events.filter((e) => e.type === "itemEffectFaded").length, 1);
});

test("move: a rounds-cadence timer record is untouched by a water step", () => {
  const state = fixedState();
  startCooldown(state.c, "ability:test", { rounds: 3 });
  open(state.floor.g, 5, 4, { water: true });
  move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["ability:test"].left, 3);
});

test("move: spell:reveal at left:1 triggers exactly one revealFaded on a water step", () => {
  const state = fixedState();
  startEffect(state.c, "spell:reveal", { squares: 1 });
  open(state.floor.g, 5, 4, { water: true });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(events.filter((e) => e.type === "revealFaded").length, 1);
});

// --- byte-identical: a cost-1 (dry) step is unchanged from before this plan -

test("move: a dry cost-1 step is byte-identical to before this plan (steps 1, one moved, no waded)", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 1);
  assert.equal(events.filter((e) => e.type === "moved").length, 1);
  assert.ok(!events.some((e) => e.type === "waded"));
  assert.equal(state.c.darkFor, 0);
  assert.equal(state.c.timers, undefined);
});
