// test/unit/heal-over-time.test.js
//
// Phase 88 plan 04 (ITEM-03): the general heal-over-time system, first used by
// the Cloak of Regeneration. User, 2026-09-30: "The cloak should be active for
// 30 squares, healing 1d6 every 10 squares. Then it goes on cooldown for 50
// squares." Using the worn cloak starts a 30-square window (no instant heal);
// a d6 comes back 10, 20 and 30 squares after the use, each rolled from a
// DERIVED stream (never the main one); ticks follow squares (a water step is
// 2), never taps, never in a fight; every tick is a `healTick` event, the
// full-hp one included; taking the cloak off stops the ticks left.
//
// Helpers mirror the per-file convention (copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { rollDice } from "../../engine/dice.js";
import { GW, GH } from "../../engine/maze.js";
import { move } from "../../engine/movement.js";
import { useItem, unequipSlot, tickHealOverTime } from "../../engine/items.js";
import { conditionsOf, healTicksDue, healTicksLeft } from "../../engine/derived.js";
import { ACTIVATION_OF, CLOAKS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const CLOAK = "Cloak of Regeneration";
const ID = `item:${CLOAK}`;
const D6 = { n: 1, sides: 6, bonus: 0 };

// ─── helpers ────────────────────────────────────────────────────────────────

/** fakeRng(seq) — `.d()` throws on underflow, so fakeRng([]) is a "no main-rng
 * draw expected" assertion. It has no getState (the cursor reads 0). */
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

/** fixedState — the party stands on (5,5); (5,4) and (5,6) are open floor so
 * the hero can pace N/S as many squares as a test needs. */
function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  open(g, 5, 5);
  open(g, 5, 4);
  open(g, 5, 6);
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

/** The real content row as a carried cloak, exactly as the roller builds it. */
function cloak() {
  return { kind: "cloak", ...CLOAKS.find((r) => r.n === CLOAK) };
}

/** used(cOverrides) — a hero wearing the Cloak of Regeneration who has just
 * used it (window live, 30 left). */
function used(cOverrides = {}, stateOverrides = {}) {
  const state = fixedState({ c: { worn: { cloak: cloak() }, wp: 10, maxWP: 55, ...cOverrides }, ...stateOverrides });
  const events = useItem(state, { slot: "cloak" }, fakeRng([]), []);
  return { state, events };
}

/** pace(state, n, rng) — n single-square steps N,S,N,S... from wherever the
 * party stands; returns every event pushed. */
function pace(state, n, rng = fakeRng([])) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const dir = state.floor.py === 5 ? "N" : state.floor.py === 4 ? "S" : "N";
    move(state, dir, rng, events);
  }
  return events;
}

const ticksOf = (events) => events.filter((e) => e.type === "healTick");

// ─── content ────────────────────────────────────────────────────────────────

test("content: the Cloak of Regeneration is 30 squares of window, a d6 every 10, three ticks, 50 to cool", () => {
  assert.deepStrictEqual(ACTIVATION_OF[CLOAK], {
    kind: "knit", effect: 30, cd: 50, eff: { cloakRegen: 1 },
    hot: { every: 10, ticks: 3, heal: D6 },
  });
});

test("content: every hot row has every x ticks equal to the effect length and effect + cd at most 100 (the once-a-day rule)", () => {
  let seen = 0;
  for (const [key, act] of Object.entries(ACTIVATION_OF)) {
    if (!act.hot) continue;
    seen++;
    assert.equal(act.hot.every * act.hot.ticks, act.effect, `${key}: every x ticks is the effect length`);
    assert.ok(act.effect + (act.cd ?? 0) <= 100, `${key}: effect + cd <= 100`);
    assert.ok(Object.isFrozen(act.hot) && Object.isFrozen(act.hot.heal), `${key}: hot is frozen`);
  }
  assert.ok(seen >= 1, "non-vacuity: at least the Cloak of Regeneration is a hot row");
});

test("content: the exported cloak row carries no act/hot key and its text states the new rule", () => {
  const row = CLOAKS.find((r) => r.n === CLOAK);
  assert.equal("act" in row, false);
  assert.equal("hot" in row, false);
  assert.match(row.txt, /d6/);
  assert.match(row.txt, /every ten squares/);
  assert.match(row.txt, /three times/);
  assert.match(row.txt, /fifty squares/);
});

// ─── use ────────────────────────────────────────────────────────────────────

test("use: starts a 30-square knit window linked to the cloak slot; no instant heal, zero main-rng draws", () => {
  const { state, events } = used();
  assert.equal(state.c.wp, 10, "no instant heal on use");
  const started = events.find((e) => e.type === "itemEffectStarted");
  assert.equal(started.kind, "knit");
  assert.equal(started.left, 30);
  assert.equal(started.every, 10);
  assert.equal(started.ticks, 3);
  assert.deepStrictEqual(started.heal, D6);
  assert.deepStrictEqual(state.c.timers[ID], {
    cadence: "squares", left: 30, cd: 50, phase: "effect", src: { slot: "cloak", n: CLOAK },
  });
  assert.equal(events.some((e) => e.type === "healTick"), false);
});

// ─── the three ticks, from a derived stream ─────────────────────────────────

test("ticks: heal exactly on the 10th, 20th and 30th step; each die is the derived-stream d6; the main cursor never moves", () => {
  const { state } = used();
  const rng = makeRng(4242);
  const seen = [];
  for (let step = 1; step <= 30; step++) {
    const cursor = rng.getState();
    const wpBefore = state.c.wp;
    const events = pace(state, 1, rng);
    assert.equal(rng.getState(), cursor, `step ${step}: the walk drew nothing from the main stream`);
    const ticks = ticksOf(events);
    if (step % 10 !== 0) {
      assert.equal(ticks.length, 0, `step ${step}: no tick between the marks`);
      assert.equal(state.c.wp, wpBefore);
      continue;
    }
    assert.equal(ticks.length, 1, `step ${step}: one tick on the mark`);
    const k = step / 10;
    const [t] = ticks;
    assert.equal(t.item, CLOAK);
    assert.equal(t.tick, k);
    assert.equal(t.ticks, 3);
    const expected = rollDice(derivedRng(cursor, "healTick", CLOAK, k, state.steps), D6);
    assert.equal(t.amount, expected, `tick ${k}: the die comes from derivedRng(cursor, "healTick", item, tick, steps)`);
    assert.equal(t.gained, expected, "hurt enough that nothing is clamped");
    assert.equal(state.c.wp, wpBefore + expected);
    seen.push(k);
  }
  assert.deepStrictEqual(seen, [1, 2, 3]);

  // The same walk with the cloak worn but never used leaves the main cursor in
  // the same place: the window changes no main-stream draw.
  const idle = fixedState({ c: { worn: { cloak: cloak() }, wp: 10, maxWP: 55 } });
  const idleRng = makeRng(4242);
  pace(idle, 30, idleRng);
  assert.equal(idleRng.getState(), rng.getState(), "the live window leaves the main cursor where an unused cloak leaves it");
  assert.equal(idle.c.wp, 10, "worn but unused heals nothing");
});

test("ticks: three and only three; a further walk inside the cooldown heals nothing", () => {
  const { state } = used();
  const events = pace(state, 60, makeRng(9));
  assert.equal(ticksOf(events).length, 3);
});

// ─── water: squares, not taps ───────────────────────────────────────────────

function waterState(leftBefore) {
  const { state } = used();
  state.floor.g[4][5] = { wall: false, dark: false, seen: false, feat: null, water: true };
  state.c.timers[ID].left = leftBefore;
  return state;
}

test("water: a 2-square step landing on or crossing a 10-square mark ticks exactly once", () => {
  // elapsed 9 -> 11 crosses the 10 mark: tick 1, once.
  const crossing = waterState(21);
  const e1 = move(crossing, "N", fakeRng([]), []);
  assert.equal(crossing.steps, 2, "the water step cost 2");
  assert.deepStrictEqual(ticksOf(e1).map((t) => t.tick), [1]);
  // elapsed 8 -> 10 lands on the mark.
  const landing = waterState(22);
  assert.deepStrictEqual(ticksOf(move(landing, "N", fakeRng([]), [])).map((t) => t.tick), [1]);
  // elapsed 10 -> 12: nothing (tick 1 already fired at the mark, never doubled).
  const past = waterState(20);
  assert.deepStrictEqual(ticksOf(move(past, "N", fakeRng([]), [])), []);
});

test("water: the last mark ticks once, and a 2-square step from elapsed 29 ends the window on that same step", () => {
  const near = waterState(2); // elapsed 28 -> 30
  const e = move(near, "N", fakeRng([]), []);
  assert.deepStrictEqual(ticksOf(e).map((t) => t.tick), [3]);

  const over = waterState(1); // elapsed 29 -> min(30, 31)
  const events = move(over, "N", fakeRng([]), []);
  assert.deepStrictEqual(ticksOf(events).map((t) => t.tick), [3]);
  assert.equal(over.c.timers[ID].phase, "cooldown", "the window closed on that step");
});

// ─── ordering ───────────────────────────────────────────────────────────────

test("ordering: on the step that brings the third tick, the heal line comes before the cloak's wears-off line", () => {
  const { state } = used();
  state.c.timers[ID].left = 1; // elapsed 29: the next square is the 30th
  const events = pace(state, 1, makeRng(3));
  const tick = events.findIndex((e) => e.type === "healTick" && e.tick === 3);
  const faded = events.findIndex((e) => e.type === "itemEffectFaded" && e.item === CLOAK);
  assert.ok(tick >= 0 && faded >= 0, `both events fire: ${events.map((e) => e.type)}`);
  assert.ok(tick < faded, "healTick precedes itemEffectFaded");
});

// ─── empty: full hp, dead, no timers ────────────────────────────────────────

test("full hp: a tick is narrated (gained 0, amount is the die) and spent; the ticks left still drop by one", () => {
  const { state } = used({ wp: 55, maxWP: 55 });
  assert.equal(conditionsOf(state).find((c) => c.key === "knit").ticks, 3);
  const events = pace(state, 10, makeRng(11));
  const [t] = ticksOf(events);
  assert.ok(t, "the full-hp tick still fires");
  assert.equal(t.gained, 0);
  assert.ok(t.amount >= 1 && t.amount <= 6, "amount is the die");
  assert.equal(state.c.wp, 55, "nothing to heal");
  assert.equal(conditionsOf(state).find((c) => c.key === "knit").ticks, 2, "the tick was spent");
});

test("empty: a dead state, a hero at 0 hp, and a sheet with no timers tick nothing and heal nothing", () => {
  const dead = used().state;
  dead.c.timers[ID].left = 21;
  dead.dead = true;
  assert.deepStrictEqual(tickHealOverTime(dead, 1, fakeRng([]), []), []);
  assert.equal(dead.c.wp, 10);

  const down = used({ wp: 0 }).state;
  down.c.timers[ID].left = 21;
  assert.deepStrictEqual(tickHealOverTime(down, 1, fakeRng([]), []), []);
  assert.equal(down.c.wp, 0);

  const bare = fixedState({ c: { worn: { cloak: cloak() }, wp: 10 } });
  assert.equal(bare.c.timers, undefined);
  assert.deepStrictEqual(tickHealOverTime(bare, 1, fakeRng([]), []), []);
  assert.equal(bare.c.timers, undefined, "never creates timers");
  bare.c.timers = null;
  assert.deepStrictEqual(tickHealOverTime(bare, 1, fakeRng([]), []), []);
});

test("empty: healTicksDue is [] for a missing hot, a non-integer left, left above effect, and a step that is not a positive integer", () => {
  const act = ACTIVATION_OF[CLOAK];
  assert.deepStrictEqual(healTicksDue(undefined, 21, 1), []);
  assert.deepStrictEqual(healTicksDue({ kind: "fly", effect: 20, cd: 50 }, 10, 1), [], "no hot");
  assert.deepStrictEqual(healTicksDue(act, 21.5, 1), [], "non-integer left");
  assert.deepStrictEqual(healTicksDue(act, "21", 1), []);
  assert.deepStrictEqual(healTicksDue(act, 31, 1), [], "left above effect");
  assert.deepStrictEqual(healTicksDue(act, 0, 1), [], "left 0");
  assert.deepStrictEqual(healTicksDue(act, 21, 0), []);
  assert.deepStrictEqual(healTicksDue(act, 21, -1), []);
  assert.deepStrictEqual(healTicksDue(act, 21, 1.5), []);
  assert.deepStrictEqual(healTicksDue({ ...act, hot: { every: 0, ticks: 3, heal: D6 } }, 21, 1), []);
  assert.deepStrictEqual(healTicksDue({ ...act, hot: { every: 10, ticks: 3.5, heal: D6 } }, 21, 1), []);
  // and the counting itself
  assert.deepStrictEqual(healTicksDue(act, 21, 1), [1]);
  assert.deepStrictEqual(healTicksDue(act, 21, 2), [1]);
  assert.deepStrictEqual(healTicksDue(act, 20, 2), []);
  assert.deepStrictEqual(healTicksDue(act, 30, 30), [1, 2, 3], "a step wide enough for every mark fires each once");
  assert.deepStrictEqual(healTicksDue(act, 2, 5), [3], "capped at the window: elapsed never passes 30");
});

test("empty: healTicksLeft is 0 without a hot, a live record, or an in-range left", () => {
  const act = ACTIVATION_OF[CLOAK];
  assert.equal(healTicksLeft(act, { phase: "effect", left: 30 }), 3);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 21 }), 3);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 20 }), 2);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 10 }), 1);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 1 }), 1);
  assert.equal(healTicksLeft(act, { phase: "cooldown", left: 20 }), 0);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 0 }), 0);
  assert.equal(healTicksLeft(act, { phase: "effect", left: 99 }), 0);
  assert.equal(healTicksLeft(act, null), 0);
  assert.equal(healTicksLeft({ kind: "fly", effect: 20, cd: 50 }, { phase: "effect", left: 10 }), 0);
  assert.equal(healTicksLeft(undefined, { phase: "effect", left: 10 }), 0);
});

// ─── fight ──────────────────────────────────────────────────────────────────

test("fight: with a fight open, move is a no-op, no healTick fires and the window does not advance", () => {
  const { state } = used();
  state.combat = { foes: [{ name: "Target", alive: true, wp: 5, maxWP: 5 }], round: 1, target: 0, spellOpen: false, tracked: false };
  state.c.timers[ID].left = 21;
  const events = move(state, "N", fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.c.timers[ID].left, 21);
  assert.equal(state.steps, 0);
});

// ─── cooldown ───────────────────────────────────────────────────────────────

test("cooldown: after the window the cloak cools for 50 squares (one use every 80), refused meanwhile, ready on the 50th", () => {
  const { state } = used();
  pace(state, 30, makeRng(5));
  assert.equal(state.c.timers[ID].phase, "cooldown");
  assert.equal(state.c.timers[ID].left, 50);
  const refused = useItem(state, { slot: "cloak" }, fakeRng([]), []);
  assert.equal(refused.length, 1);
  assert.equal(refused[0].type, "useRefused");
  assert.equal(refused[0].reason, "cooldown");
  assert.equal(refused[0].left, 50);

  const events = pace(state, 49, makeRng(5));
  assert.equal(events.some((e) => e.type === "itemCooled"), false, "still cooling on square 79");
  const last = pace(state, 1, makeRng(5));
  assert.ok(last.some((e) => e.type === "itemCooled" && e.item === CLOAK), "ready on the 80th square from the use");
  assert.equal(state.steps, 80);
  const again = useItem(state, { slot: "cloak" }, fakeRng([]), []);
  assert.ok(again.some((e) => e.type === "itemEffectStarted" && e.kind === "knit"), "usable again");
});

// ─── take off ───────────────────────────────────────────────────────────────

test("take off: after tick 1 the take-off ends the window (ticks left 2), the use is spent, and no further tick fires", () => {
  const { state } = used();
  pace(state, 15, makeRng(6));
  assert.equal(state.c.timers[ID].left, 15);
  const events = unequipSlot(state, "cloak", [], fakeRng([]));
  const ended = events.find((e) => e.type === "itemEffectEnded");
  assert.equal(ended.item, CLOAK);
  assert.equal(ended.kind, "knit");
  assert.equal(ended.ticks, 2, "two ticks were left unspent");
  assert.equal(ended.left, 15);
  assert.equal(ended.ready, 65, "the use is spent: squares left (15) plus the 50 cooldown");
  assert.equal(state.c.timers[ID].phase, "cooldown");
  assert.equal(ticksOf(pace(state, 30, makeRng(6))).length, 0, "no tick after the cloak is off");
});

test("take off: taking the cloak off before any tick reports all three ticks unspent", () => {
  const { state } = used();
  const events = unequipSlot(state, "cloak", [], fakeRng([]));
  assert.equal(events.find((e) => e.type === "itemEffectEnded").ticks, 3);
});

// ─── chip data ──────────────────────────────────────────────────────────────

test("chip: the knit chip carries the ticks left (3, 2, 1) while the window is live and is gone after it", () => {
  const { state } = used();
  const chip = () => conditionsOf(state).find((c) => c.key === "knit");
  assert.equal(chip().ticks, 3);
  assert.equal(chip().remaining, 30);
  assert.equal(chip().source, CLOAK);
  pace(state, 10, makeRng(8));
  assert.equal(chip().ticks, 2);
  pace(state, 10, makeRng(8));
  assert.equal(chip().ticks, 1);
  pace(state, 10, makeRng(8));
  assert.equal(chip(), undefined, "no knit chip after the window");
});

test("chip: only a hot item's chip carries ticks", () => {
  const state = fixedState({ c: { worn: { cloak: { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Speed") } } } });
  useItem(state, { slot: "cloak" }, fakeRng([]), []);
  const chip = conditionsOf(state).find((c) => c.key === "haste");
  assert.ok(chip);
  assert.equal("ticks" in chip, false);
});
