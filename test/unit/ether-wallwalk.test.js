// test/unit/ether-wallwalk.test.js
//
// 260919-00d — the Cloak of Ether becomes a real wall-walk: while a live
// `ether` item effect is running, move() accepts a step onto ANY in-bounds
// cell (wall or not); ending the effect on a wall cell is death through the
// existing permadeath terminator (die("entombed")). This file pins every
// truth in the plan's `must_haves`: the content numbers, the engine guard,
// resolveEtherEnd (the ONE home of the entombment rule), the dispatch gate,
// newDay's in-stone wandering-monster skip (draws unchanged), inStone, and
// the bot's canStep refusal.
//
// Helpers (fakeRng/fixedFighter/wallGrid/open/fixedState) are copied
// verbatim from test/unit/item-wiring.test.js, the same "copied verbatim"
// convention water-cost.test.js already uses for this file family.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { move, newDay, resolveEtherEnd } from "../../engine/movement.js";
import { inStone, itemEffectActive } from "../../engine/derived.js";
import { ACTIVATION_OF } from "../../content/activations.js";
import { CLOAKS } from "../../content/treasure-tables.js";
import { EPITAPHS, CAUSE_TEXT, CAUSE_TEXT_TOKENS } from "../../content/epitaphs.js";
import { canStep } from "../../tools/lib/tuning-bot.mjs";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow (a "no further rng draw expected" assertion). `.pick` defaults
 * to arr[0]. */
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
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false,
    ...overrides,
  };
}

/** A minimal fully-walled GWxGH grid (engine/maze.js), holes punched by open(). */
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

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    party: [], pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

const LIVE_ETHER = (left = 10, cd = 80) => ({ "item:Cloak of Ether": { cadence: "squares", left, cd, phase: "effect" } });

// --- 1. content numbers ----------------------------------------------------

test("ACTIVATION_OF['Cloak of Ether'] is 10 squares / 80 cd; the exported CLOAKS row is byte-identical (no act/slot key)", () => {
  assert.deepStrictEqual(ACTIVATION_OF["Cloak of Ether"], { kind: "ether", effect: 10, cd: 80 });
  const row = CLOAKS.find((c) => c.n === "Cloak of Ether");
  assert.deepStrictEqual(row, {
    n: "Cloak of Ether", eff: {}, use: "ether", every: 80,
    txt: "walk through walls, once every 100 squares",
  });
});

// --- 2. entombed content ----------------------------------------------------

test("entombed content: EPITAPHS bank, CAUSE_TEXT, CAUSE_TEXT_TOKENS, and the every-bucket-except-won invariant", () => {
  assert.ok(Array.isArray(EPITAPHS.entombed) && EPITAPHS.entombed.length > 0);
  assert.ok(EPITAPHS.entombed.includes("Became a permanent architectural feature."));
  assert.equal(CAUSE_TEXT.entombed, "became a permanent architectural feature");
  assert.deepEqual(CAUSE_TEXT_TOKENS.entombed, []);
  for (const cause of Object.keys(EPITAPHS)) {
    if (cause === "won") continue;
    assert.ok(CAUSE_TEXT[cause], `EPITAPHS.${cause} has no CAUSE_TEXT entry`);
  }
});

// --- 3. no live ether: wall step is the unchanged no-op ---------------------

test("move: no live ether — a step onto a wall cell is the unchanged no-op (zero draws)", () => {
  const state = fixedState();
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(events.length, 0);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 5);
  assert.equal(state.steps, 0);
});

// --- 4. live ether: wall steps succeed, border ring included, off-grid still refused ---

test("move: a LIVE ether effect accepts a wall step — position/steps/seen/record all update, zero draws", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) } });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 4);
  assert.equal(state.steps, 1);
  assert.ok(events.some((e) => e.type === "moved"));
  assert.equal(state.floor.g[4][5].seen, true);
  assert.deepStrictEqual(state.c.timers["item:Cloak of Ether"], { cadence: "squares", left: 9, cd: 80, phase: "effect" });
});

test("move: a second consecutive wall step (wall -> wall) also succeeds while ethereal", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) } });
  move(state, "N", fakeRng([]), []); // (5,5) -> (5,4), both walls
  const events = move(state, "N", fakeRng([]), []); // (5,4) -> (5,3), still walls
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 3);
  assert.equal(state.steps, 2);
  assert.ok(events.some((e) => e.type === "moved"));
});

test("move: a LIVE ether effect can step onto the border ring (x = 0)", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) }, floor: { px: 1, py: 5 } });
  const events = move(state, "W", fakeRng([]), []);
  assert.equal(state.floor.px, 0);
  assert.equal(state.floor.py, 5);
  assert.ok(events.some((e) => e.type === "moved"));
});

test("move: even while ethereal, an off-grid step (from x = 0 westward) is still a no-op", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) }, floor: { px: 0, py: 5 } });
  const events = move(state, "W", fakeRng([]), []);
  assert.equal(events.length, 0);
  assert.equal(state.floor.px, 0);
  assert.equal(state.floor.py, 5);
});

// --- 5. ending the effect inside a wall is fatal ---------------------------

test("move: the ether window ending on a step INTO a wall kills through die('entombed')", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(1, 80) } });
  open(state.floor.g, 5, 5); // party starts on an OPEN cell
  const events = move(state, "N", fakeRng([]), []); // (5,4) is still a wall (default wallGrid)
  assert.equal(state.dead, true);

  const faded = events.findIndex((e) => e.type === "itemEffectFaded" && e.item === "Cloak of Ether");
  const entombed = events.findIndex((e) => e.type === "entombed");
  const died = events.findIndex((e) => e.type === "died");
  assert.ok(faded !== -1 && entombed !== -1 && died !== -1, "all three events must fire");
  assert.ok(faded < entombed && entombed < died, "order: itemEffectFaded -> entombed -> died");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "entombed"));

  assert.equal(state.deathNote, "became a permanent architectural feature");
  const expectedEpitaph = EPITAPHS.entombed[0].replace("{name}", state.c.name).replace("{floor}", String(state.floor.depth));
  assert.equal(state.epitaph, expectedEpitaph);

  assert.deepStrictEqual(state.c.timers["item:Cloak of Ether"], { cadence: "squares", left: 80, cd: 80, phase: "cooldown" });
  assert.equal(state.c.wp, 0);
});

test("move: the ether window ending on a step OUT onto an open cell is NOT fatal", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(1, 80) } }); // party starts on default unopened wall (5,5)
  open(state.floor.g, 5, 4); // destination is a corridor
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.dead, false);
  assert.ok(!events.some((e) => e.type === "entombed"));
  assert.ok(events.some((e) => e.type === "itemEffectFaded" && e.item === "Cloak of Ether"));
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 4);
});

// --- 6. resolveEtherEnd is the ONE home -------------------------------------

test("resolveEtherEnd: a no-op on an open cell; fatal on a wall cell; a no-op again once already dead", () => {
  const openState = fixedState();
  open(openState.floor.g, 5, 5);
  const events1 = resolveEtherEnd(openState, fakeRng([]), []);
  assert.equal(events1.length, 0);
  assert.equal(openState.dead, false);

  const wallState = fixedState(); // default (5,5) is an unopened wall cell
  const events2 = resolveEtherEnd(wallState, fakeRng([]), []);
  assert.equal(wallState.dead, true);
  assert.ok(events2.some((e) => e.type === "entombed"));
  assert.ok(events2.some((e) => e.type === "died"));

  const deadState = fixedState({ dead: true }); // still on a wall cell
  const events3 = resolveEtherEnd(deadState, fakeRng([]), []);
  assert.equal(events3.length, 0, "already dead — no further entombed/died push");
});

// --- 7. dispatch gate: a wall cell never fires a feature --------------------

test("move: a wall cell artificially carrying feat 'exit' never dispatches descend while ethereal", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) } });
  state.floor.g[4][5].feat = "exit"; // still wall: true
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.floor.depth, 1);
  assert.ok(!events.some((e) => e.type === "floorChanged"));
});

test("move: a wall cell artificially carrying feat 'dot' never dispatches an encounter while ethereal", () => {
  const state = fixedState({ c: { timers: LIVE_ETHER(10, 80) } });
  state.floor.g[4][5].feat = "dot"; // still wall: true
  const events = move(state, "N", fakeRng([]), []); // fakeRng([]) never throws: no encounter draw
  assert.ok(!events.some((e) => e.type === "encounterRolled" || e.type === "encounterStarted"));
  assert.equal(state.combat, null);
});

// --- 8. inStone ---------------------------------------------------------------

test("inStone(state): true on a wall cell, false on an open cell, false for a missing floor/cell", () => {
  const wallState = fixedState();
  assert.equal(inStone(wallState), true);

  const openState = fixedState();
  open(openState.floor.g, 5, 5);
  assert.equal(inStone(openState), false);

  assert.equal(inStone({ floor: null }), false);
  assert.equal(inStone({}), false);
});

// --- 9. newDay in stone: no fight, draws unchanged --------------------------

test("newDay: standing in stone skips the wandering-monster fight; the eight d20 wake draws still run, rng cursor unchanged", () => {
  function unfedFighter(overrides = {}) {
    return fixedFighter({ rations: 0, wp: 55, maxWP: 55, ...overrides });
  }

  // Find the first seed >= 1 whose OPEN-cell control run wakes the party
  // (measured, not hand-picked).
  let wakeSeed = null;
  for (let seed = 1; seed <= 2000 && wakeSeed === null; seed++) {
    const control = fixedState({ c: unfedFighter() });
    open(control.floor.g, 5, 5);
    const events = [];
    newDay(control, false, makeRng(seed), events);
    if (events.some((e) => e.type === "wanderingMonster")) wakeSeed = seed;
  }
  assert.ok(wakeSeed !== null, "expected at least one wake seed in range");

  // Replay the SAME seed with the party standing in stone (unopened wall
  // cell — the LIVE ether record is what got them there and keeps them
  // safe to camp).
  const stoneState = fixedState({ c: unfedFighter({ timers: LIVE_ETHER(5, 80) }) });
  const events = [];
  const rng = makeRng(wakeSeed);
  newDay(stoneState, false, rng, events);
  assert.ok(!events.some((e) => e.type === "wanderingMonster"));
  assert.equal(stoneState.combat, null);

  const probe = makeRng(wakeSeed);
  for (let i = 0; i < 8; i++) probe.d(20);
  assert.equal(rng.getState(), probe.getState(), "exactly eight d20 draws — the rng cursor is unchanged");
});

// --- 10. the bot never enters rock ------------------------------------------

test("canStep: refuses a wall destination regardless of a live item:Cloak of Ether effect on the state", () => {
  const f = { g: wallGrid(), px: 5, py: 5 };
  assert.equal(canStep(f, 5, 5, "N"), false);
  // canStep takes only the floor — it structurally never reads c.timers, so
  // a live ether record on some hypothetical state cannot change its answer.
});
