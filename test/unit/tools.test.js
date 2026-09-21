// Phase 39 (GEAR-05) — the three one-shot hazard tools: content shape, the
// derived-stream loot row (zero main-rng draws on the no-tool-fires path),
// store stock at depth tiers, sell value, and the haveOne duplicate gate.
// Task 2 extends this file with the hazard pre-roll pending state, useTool,
// and the torch's darkness-lighting behaviour.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { GW, GH } from "../../engine/maze.js";
import { TOOLS, TOOL_ORDER, TOOL_LOOT_WEIGHTS, TOOL_ACTIVATION_OF, ACTIVATION_OF } from "../../content/index.js";
import {
  rollTreasureItem,
  toolItem,
  toolIndex,
  hasPicks,
  takeItem,
  stowItem,
  canStow,
  bagCap,
  rollBlade,
  rollMailPiece,
  rollJewel,
  rollCloak,
  rollStaff,
  useItem,
} from "../../engine/items.js";
import { hasTool, itemEffectActive, inDark } from "../../engine/derived.js";
import { openStore, buyFrom, sellPriceFor, storeTier } from "../../engine/economy.js";
import { move, useTool, teleport, descend } from "../../engine/movement.js";
import { fallDark } from "../../engine/encounters.js";
import { validateSave, rehydrate } from "../../engine/saveState.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (a "no more draws expected"
 * assertion) — mirrors test/unit/movement.test.js's helper. */
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

/** wallGrid()/open(g,x,y,extra) — mirrors test/unit/movement.test.js's floor builder. */
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
    day: 1, steps: 0, combat: null, store: null, beats: null, pendingHazard: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** heroOf(seed, cls, depth, extraForce) — a forced-class hero on an
 * arbitrary floor.depth (mirrors test/unit/store-roll.test.js's helper). */
function heroOf(seed, cls, depth, extraForce = {}) {
  const s = newRun(seed, [], { force: { cls, ...extraForce } });
  s.floor.depth = depth;
  return s;
}

/** legacyRollTreasureItem(rng, depth, c) — the PRE-Phase-39-GEAR-05 control
 * flow (no derived tool-loot row at all), used to prove the derived stream
 * never touches the main rng cursor on the no-fire path. */
function legacyRollTreasureItem(rng, depth, c) {
  if (!hasPicks(c || {}) && rng.d(12) === 1) {
    return { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };
  }
  const r = rng.d(10);
  if (r <= 3) return rollBlade(rng, depth, true);
  if (r <= 5) return rollMailPiece(rng);
  if (r <= 7) return rollJewel(rng);
  if (r <= 9) return rollCloak(rng);
  return rollStaff(rng);
}

// --- content shape ----------------------------------------------------------

test("TOOLS: torch/rope/ladder carry exactly the declared fields", () => {
  assert.deepEqual(TOOLS.torch, {
    n: "Torch",
    cost: 25,
    fromTier: 0,
    use: "light",
    txt: "lights the dark once, and keeps it off for forty squares",
  });
  assert.deepEqual(TOOLS.rope, {
    n: "Rope",
    cost: 60,
    fromTier: 0,
    feat: "gorge",
    txt: "the honest way across a crevice. Once.",
  });
  assert.deepEqual(TOOLS.ladder, {
    n: "Ladder",
    cost: 150,
    fromTier: 1,
    feat: "climb",
    txt: "one climbable wall, no climbing. Once.",
  });
});

test("TOOL_ORDER / TOOL_LOOT_WEIGHTS / TOOL_ACTIVATION_OF", () => {
  assert.deepEqual(TOOL_ORDER, ["torch", "rope", "ladder"]);
  assert.deepEqual(TOOL_LOOT_WEIGHTS, { torch: 4, rope: 3, ladder: 1 });
  assert.deepEqual(TOOL_ACTIVATION_OF, { Torch: { kind: "lit", effect: 40 } });
});

test("ACTIVATION_OF.Torch deep-equals TOOL_ACTIVATION_OF.Torch (spread into the merged table)", () => {
  assert.deepEqual(ACTIVATION_OF.Torch, TOOL_ACTIVATION_OF.Torch);
});

// --- toolItem / toolIndex ----------------------------------------------------

test("toolItem('torch') builds a kind:tool bag item with use, no cost/fromTier/feat", () => {
  const it = toolItem("torch");
  assert.deepEqual(it, { kind: "tool", tool: "torch", n: "Torch", use: "light", txt: TOOLS.torch.txt });
});

test("toolItem('rope') carries no use key (spent through useTool, not useItem)", () => {
  const it = toolItem("rope");
  assert.deepEqual(it, { kind: "tool", tool: "rope", n: "Rope", txt: TOOLS.rope.txt });
  assert.ok(!("use" in it));
  assert.ok(!("cost" in it) && !("fromTier" in it) && !("feat" in it) && !("act" in it));
});

test("toolItem('ladder') shape", () => {
  const it = toolItem("ladder");
  assert.deepEqual(it, { kind: "tool", tool: "ladder", n: "Ladder", txt: TOOLS.ladder.txt });
});

test("hasTool / toolIndex", () => {
  const c = { items: [toolItem("rope")] };
  assert.equal(hasTool(c, "rope"), true);
  assert.equal(hasTool(c, "ladder"), false);
  assert.equal(hasTool({}, "rope"), false);
  assert.equal(toolIndex(c, "rope"), 0);
  assert.equal(toolIndex(c, "ladder"), -1);
});

// --- rollTreasureItem: derived stream, zero main-rng draws on no-fire ------

test("rollTreasureItem: the main rng advances exactly as the pre-plan control flow, whenever the derived tool roll does not fire (200 seeds x depth 1/3)", () => {
  let firedAtLeastOnce = false;
  for (const depth of [1, 3]) {
    for (let seed = 1; seed <= 200; seed++) {
      const probe = makeRng(seed);
      const lock = probe.d(12);
      let fires = false;
      if (lock !== 1) {
        const toolRng = derivedRng(probe.getState(), "tool", depth);
        fires = toolRng.d(8) === 1;
      }
      if (fires) {
        firedAtLeastOnce = true;
        continue;
      }
      const rngOld = makeRng(seed);
      legacyRollTreasureItem(rngOld, depth, {});
      const rngNew = makeRng(seed);
      rollTreasureItem(rngNew, depth, {});
      assert.equal(rngNew.getState(), rngOld.getState(), `seed ${seed} depth ${depth}: main rng cursor diverged`);
    }
  }
  assert.ok(firedAtLeastOnce, "expected at least one seed/depth in range to fire the derived tool roll (sanity check on the scan itself)");
});

test("rollTreasureItem: when the derived tool roll fires, the main rng advances by exactly the one lockpick draw, and a Ladder never rolls at depth 1", () => {
  const depth = 1;
  let foundSeed = null;
  for (let seed = 1; seed <= 5000 && foundSeed === null; seed++) {
    const probe = makeRng(seed);
    const lock = probe.d(12);
    if (lock === 1) continue; // picks branch — never reaches the tool row
    const toolRng = derivedRng(probe.getState(), "tool", depth);
    if (toolRng.d(8) === 1) foundSeed = seed;
  }
  assert.ok(foundSeed, "expected a firing seed within 5000 at depth 1");

  const rng = makeRng(foundSeed);
  const before = rng.getState();
  const it = rollTreasureItem(rng, depth, {});
  assert.equal(it.kind, "tool");
  assert.notEqual(it.tool, "ladder", "a Ladder must never roll as loot at depth 1");

  const check = makeRng(before);
  check.d(12); // the one lockpick draw — nothing else touches the main rng
  assert.equal(rng.getState(), check.getState());
});

test("rollTreasureItem: a Ladder CAN roll as loot at depth 2+ (scan finds one)", () => {
  const depth = 2;
  let foundLadder = false;
  for (let seed = 1; seed <= 20000 && !foundLadder; seed++) {
    const rng = makeRng(seed);
    const it = rollTreasureItem(rng, depth, {});
    if (it.kind === "tool" && it.tool === "ladder") foundLadder = true;
  }
  assert.ok(foundLadder, "expected at least one seed within 20000 at depth 2 to roll a Ladder");
});

test("rollTreasureItem: a carried tool is never rolled twice — falls through to the normal table with no extra main-rng draw", () => {
  const depth = 1;
  let foundSeed = null;
  for (let seed = 1; seed <= 5000 && foundSeed === null; seed++) {
    const probe = makeRng(seed);
    const lock = probe.d(12);
    if (lock === 1) continue;
    const toolRng = derivedRng(probe.getState(), "tool", depth);
    if (toolRng.d(8) === 1) foundSeed = seed;
  }
  assert.ok(foundSeed, "expected a firing seed within 5000 at depth 1");

  // Carrying both non-ladder tools already — pickLootTool's candidate list
  // is empty at depth 1, so the fired derived roll must fall through with
  // zero extra draws on the MAIN rng.
  const c = { items: [toolItem("torch"), toolItem("rope")] };
  const rngOld = makeRng(foundSeed);
  const legacyResult = legacyRollTreasureItem(rngOld, depth, c);
  const rngNew = makeRng(foundSeed);
  const newResult = rollTreasureItem(rngNew, depth, c);
  assert.deepEqual(newResult, legacyResult);
  assert.equal(rngNew.getState(), rngOld.getState());
});

// --- takeItem: haveOne duplicate gate ---------------------------------------

test("takeItem: a second copy of an already-carried tool is refused (haveOne), nothing stowed", () => {
  const c = { items: [toolItem("rope")], cls: "Fighter" };
  const state = { c };
  const events = takeItem(state, toolItem("rope"), []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "itemRejected");
  assert.equal(events[0].reason, "haveOne");
  assert.equal(c.items.length, 1);
});

test("takeItem: a NOT-yet-carried tool stows normally (giveItem/auto-wear path — a tool has no worn slot, so it lands in the bag)", () => {
  const c = { items: [], cls: "Fighter" };
  const state = { c };
  const events = takeItem(state, toolItem("ladder"), []);
  assert.equal(events.some((e) => e.type === "itemRejected"), false);
  assert.equal(c.items.length, 1);
  assert.equal(c.items[0].tool, "ladder");
});

// --- sellPriceFor / baseValueFor --------------------------------------------

test("sellPriceFor: a Rope sells for half its buy cost (Human, no race/sub modifier)", () => {
  assert.equal(sellPriceFor(toolItem("rope"), "Human"), 30);
});

test("sellPriceFor: a Ladder sells for 75", () => {
  assert.equal(sellPriceFor(toolItem("ladder"), "Human"), 75);
});

// --- store stock: depth tiers, haveOne, haggle ------------------------------

test("openStore at depth 1 (tier 0): Torch (25) and Rope (60) lines after Rations, no Ladder", () => {
  const state = heroOf(1, "Fighter", 1);
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const stock = state.store.stock;
  const rationsIdx = stock.findIndex((s) => s.effectId === "buyRations");
  const torchIdx = stock.findIndex((s) => s.n === "Torch");
  const ropeIdx = stock.findIndex((s) => s.n === "Rope");
  const ladderIdx = stock.findIndex((s) => s.n === "Ladder");
  assert.ok(rationsIdx >= 0);
  assert.ok(torchIdx > rationsIdx, "Torch must be offered AFTER the Rations line");
  assert.ok(ropeIdx > rationsIdx, "Rope must be offered AFTER the Rations line");
  assert.equal(stock[torchIdx].cost, 25);
  assert.equal(stock[torchIdx].effectId, "giveTool");
  assert.equal(stock[ropeIdx].cost, 60);
  assert.equal(stock[ropeIdx].effectId, "giveTool");
  assert.equal(ladderIdx, -1, "a depth-1 store must never offer a Ladder");
});

test("openStore at depth 2 (tier 1): Torch/Rope/Ladder all offered, Ladder costs 150", () => {
  const state = heroOf(1, "Fighter", 2);
  assert.equal(storeTier(2), 1);
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const stock = state.store.stock;
  assert.ok(stock.some((s) => s.n === "Torch"));
  assert.ok(stock.some((s) => s.n === "Rope"));
  const ladder = stock.find((s) => s.n === "Ladder");
  assert.ok(ladder);
  assert.equal(ladder.cost, 150);
  assert.equal(ladder.effectId, "giveTool");
});

test("openStore: a hero already carrying a Rope gets no Rope line", () => {
  const state = heroOf(1, "Fighter", 1);
  state.c.items = state.c.items || [];
  state.c.items.push(toolItem("rope"));
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const stock = state.store.stock;
  assert.equal(stock.some((s) => s.n === "Rope"), false);
  assert.ok(stock.some((s) => s.n === "Torch"), "Torch is still offered — only Rope was already carried");
});

test("openStore: a Wilmsry's haggle (x0.7) applies to the tool lines like every other line", () => {
  const state = heroOf(1, "Fighter", 1, { race: "Wilmsry" });
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const torch = state.store.stock.find((s) => s.n === "Torch");
  assert.equal(torch.cost, Math.round(25 * 0.7));
});

test("openStore with storeRoll:true (the flag-on reroll) still appends the same tool lines after the reroll block", () => {
  const state = heroOf(1, "Fighter", 1);
  state.storeRoll = true;
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const stock = state.store.stock;
  assert.ok(stock.some((s) => s.n === "Torch" && s.effectId === "giveTool"));
  assert.ok(stock.some((s) => s.n === "Rope" && s.effectId === "giveTool"));
});

test("buyFrom: buying the Torch line stows the torch and deducts gold; a full bag refuses with no gold spent", () => {
  const state = heroOf(1, "Fighter", 1);
  state.c.gold = 100000;
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const idx = state.store.stock.findIndex((s) => s.n === "Torch");
  const goldBefore = state.c.gold;
  const events = buyFrom(state, idx, []);
  assert.ok(events.some((e) => e.type === "bought"));
  assert.ok(state.c.items.some((it) => it.kind === "tool" && it.tool === "torch"));
  assert.equal(state.c.gold, goldBefore - state.store.stock[idx].cost);
});

test("buyFrom: a full bag refuses the tool line with bagFull, no gold spent, item not stowed", () => {
  const state = heroOf(1, "Fighter", 1);
  state.c.gold = 100000;
  const rng = makeRng(state.rngState);
  openStore(state, rng, []);
  const idx = state.store.stock.findIndex((s) => s.n === "Torch");
  // fill the bag to capacity with non-potion filler items
  const cap = bagCap(state.c);
  state.c.items = state.c.items.filter((it) => it.kind === "potion");
  while (!(cap === Infinity) && state.c.items.length < cap) {
    state.c.items.push({ kind: "jewel", n: `Filler ${state.c.items.length}` });
  }
  assert.equal(canStow(state.c), cap === Infinity ? true : false, "sanity: bag must actually be full for this test to prove anything");
  const goldBefore = state.c.gold;
  const events = buyFrom(state, idx, []);
  assert.ok(events.some((e) => e.type === "bagFull"));
  assert.equal(state.c.gold, goldBefore, "no gold spent on a refused stow");
  assert.equal(state.c.items.some((it) => it.kind === "tool" && it.tool === "torch"), false);
});

// =============================================================================
// Task 2: the hazard pre-roll pending state, useTool, and the torch
// =============================================================================

// --- pendingHazard is transient, like pendingFind ---------------------------

test("newRun/validateSave/rehydrate: pendingHazard is always null (transient, like pendingFind)", () => {
  const state = newRun(1);
  assert.equal(state.pendingHazard, null);

  const tampered = { ...state, pendingHazard: { feat: "climb", dir: "E", tool: "ladder", declined: false } };
  const validated = validateSave(tampered);
  assert.equal(validated.ok, true);
  assert.equal(validated.value.pendingHazard, null);

  const rehydrated = rehydrate(tampered);
  assert.equal(rehydrated.pendingHazard, null);
});

// --- the hazard pre-roll pending decision (ladder / rope) -------------------

test("move: a Ladder-carrying hero at a wall gets ONE pause — hazardChoice, no move, no roll, pendingHazard stashed", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")] } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  const events = move(state, "E", fakeRng([]), []);
  assert.deepStrictEqual(
    events.filter((e) => e.type === "hazardChoice"),
    [{ type: "hazardChoice", feat: "climb", dir: "E", tool: "ladder" }],
  );
  assert.equal(state.floor.px, 5, "position unchanged");
  assert.equal(state.steps, 0);
  assert.deepStrictEqual(state.pendingHazard, { feat: "climb", dir: "E", tool: "ladder", declined: false });
});

test("move: a second move(E) at the pending tile declines — no new hazardChoice, declined flips true, the roll runs", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")] } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  move(state, "E", fakeRng([]), []); // the pending card
  // Capture the pending record's OWN reference before the second move() —
  // a SUCCESSFUL roll's normal step-tail reassigns state.pendingHazard to
  // null (a genuine step resolves the decision), but never mutates the
  // object itself, so `pend.declined` still reads true either way.
  const pend = state.pendingHazard;
  // pick "rope"; feet=10*(1+d(2)=1)=20; two rungs, both succeed (<=7).
  const events = move(state, "E", fakeRng([1, 5, 5]), []);
  assert.equal(events.some((e) => e.type === "hazardChoice"), false);
  assert.equal(pend.declined, true);
  assert.ok(events.some((e) => e.type === "climbedOver" || e.type === "fellClimbing"));
});

// DELIBERATE RULES CHANGE (Phase 54, 2026-09-21, USER RULING D, one-and-done):
// a failed climb/leap no longer leaves the hero (or the pending-hazard
// record) parked for a retry — the feature is consumed and the hero crosses
// either way, and the genuine-step tail (which clears pendingHazard on every
// resolved decision) always runs, whether the roll passed or failed. The old
// "wall is still there to retry" / "a third move(E) rolls again" premise is
// gone: there is no third roll, because there is no wall left.
test("move: after a declined fellClimbing, the hero still crosses (one and done) — feat cleared, pendingHazard cleared, draggedOver fires", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")] } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  move(state, "E", fakeRng([]), []); // the pending card
  // feet=20; first rung fails (9>7); fall check d20=15 (>2, hurt rolls); d6=4.
  const failEvents = move(state, "E", fakeRng([1, 9, 15, 4]), []);
  assert.ok(failEvents.some((e) => e.type === "fellClimbing"));
  assert.ok(failEvents.some((e) => e.type === "draggedOver" && e.feat === "climb"), "a survived failure still crosses");
  assert.equal(state.pendingHazard, null, "the genuine step tail resolves the decision — one and done, no retry to track");
  assert.equal(state.floor.g[5][6].feat, null, "one and done: the feature is consumed even on a failed roll");
  assert.equal(state.floor.px, 6, "one and done: the hero crossed despite the failed roll");
});

test("move: moving to a free tile instead clears pendingHazard to null", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")] } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  open(state.floor.g, 5, 4); // a free tile to the north
  move(state, "E", fakeRng([]), []); // the pending card (declines nothing yet)
  assert.ok(state.pendingHazard);
  move(state, "N", fakeRng([]), []);
  assert.equal(state.pendingHazard, null);
});

test("move: a Rope-carrying hero at a gorge gets the same pending decision (feat/tool = gorge/rope)", () => {
  const state = fixedState({ c: { items: [toolItem("rope")] } });
  open(state.floor.g, 6, 5, { feat: "gorge" });
  const events = move(state, "E", fakeRng([]), []);
  assert.deepStrictEqual(
    events.filter((e) => e.type === "hazardChoice"),
    [{ type: "hazardChoice", feat: "gorge", dir: "E", tool: "rope" }],
  );
  assert.deepStrictEqual(state.pendingHazard, { feat: "gorge", dir: "E", tool: "rope", declined: false });
});

test("move: a hero carrying only a Ladder at a gorge gets NO pending state and rolls immediately (and vice versa)", () => {
  const ladderState = fixedState({ c: { items: [toolItem("ladder")] } });
  open(ladderState.floor.g, 6, 5, { feat: "gorge" });
  // LEAP_TABLE[d(4)-1=0]; Fighter need 10; r=d(10)=11 fails; fall d6+d6.
  const events = move(ladderState, "E", fakeRng([1, 11, 3, 4]), []);
  assert.equal(events.some((e) => e.type === "hazardChoice"), false);
  assert.equal(ladderState.pendingHazard, null);
  assert.ok(events.some((e) => e.type === "fellInGorge"));

  const ropeState = fixedState({ c: { items: [toolItem("rope")] } });
  open(ropeState.floor.g, 6, 5, { feat: "climb" });
  const climbEvents = move(ropeState, "E", fakeRng([1, 9, 15, 4]), []);
  assert.equal(climbEvents.some((e) => e.type === "hazardChoice"), false);
  assert.equal(ropeState.pendingHazard, null);
  assert.ok(climbEvents.some((e) => e.type === "fellClimbing"));
});

test("move: a hero with no tool sees byte-identical movement (no hazardChoice, no pendingHazard, rng consumed as before)", () => {
  const state = fixedState();
  open(state.floor.g, 6, 5, { feat: "climb" });
  const rng = fakeRng([1, 5, 5]);
  const events = move(state, "E", rng, []);
  assert.equal(events.some((e) => e.type === "hazardChoice"), false);
  assert.equal(state.pendingHazard, null);
  assert.ok(events.some((e) => e.type === "climbedOver"));
});

// --- useTool ------------------------------------------------------------

test("useTool: spends the ladder, passes the tile with no roll, clears pendingHazard, ticks steps, draws nothing beyond a plain step", () => {
  const withTool = fixedState({ c: { items: [toolItem("ladder")] } });
  open(withTool.floor.g, 6, 5, { feat: "climb" });
  const events = useTool(withTool, "ladder", "E", fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "toolUsed" && e.tool === "ladder" && e.feat === "climb"));
  assert.ok(events.some((e) => e.type === "moved"));
  assert.equal(events.some((e) => e.type === "climbedOver" || e.type === "fellClimbing"), false);
  assert.equal(withTool.floor.px, 6, "the wall tile is now occupied");
  assert.equal(withTool.floor.g[5][6].feat, null);
  assert.equal(withTool.pendingHazard, null);
  assert.equal(withTool.steps, 1);
  assert.equal(withTool.c.items.some((it) => it.kind === "tool" && it.tool === "ladder"), false, "the ladder is gone");

  // Zero climb-roll draws: a plain step onto an already-open tile, same seed,
  // consumes the exact same real-rng cursor as the tool-assisted step above.
  const plainState = fixedState();
  open(plainState.floor.g, 6, 5); // a plain open tile, no feature at all
  const seed = 12345;
  const rngA = makeRng(seed);
  const toolState = fixedState({ c: { items: [toolItem("ladder")] } });
  open(toolState.floor.g, 6, 5, { feat: "climb" });
  useTool(toolState, "ladder", "E", rngA, []);
  const rngB = makeRng(seed);
  move(plainState, "E", rngB, []);
  assert.equal(rngA.getState(), rngB.getState(), "useTool draws nothing beyond a plain step's own ticks");
});

test("useTool: refusals — noTool (not carried), noHazard (wrong tile/wall/oob); no mutation, no consumption", () => {
  const noToolState = fixedState();
  open(noToolState.floor.g, 6, 5, { feat: "climb" });
  const noToolEvents = useTool(noToolState, "ladder", "E", fakeRng([]), []);
  assert.deepStrictEqual(noToolEvents, [{ type: "toolRefused", tool: "ladder", reason: "noTool" }]);
  assert.equal(noToolState.floor.px, 5);

  const wrongTileState = fixedState({ c: { items: [toolItem("ladder")] } });
  open(wrongTileState.floor.g, 6, 5, { feat: "gorge" }); // a gorge, not a climb
  const wrongTileEvents = useTool(wrongTileState, "ladder", "E", fakeRng([]), []);
  assert.deepStrictEqual(wrongTileEvents, [{ type: "toolRefused", tool: "ladder", reason: "noHazard" }]);
  assert.equal(wrongTileState.c.items.length, 1, "the ladder is not consumed on a refusal");

  const wallState = fixedState({ c: { items: [toolItem("ladder")] } }); // (6,5) stays a solid wall
  const wallEvents = useTool(wallState, "ladder", "E", fakeRng([]), []);
  assert.deepStrictEqual(wallEvents, [{ type: "toolRefused", tool: "ladder", reason: "noHazard" }]);
});

test("useTool: no-op in combat/store/dead/won", () => {
  const combatState = fixedState({ c: { items: [toolItem("ladder")] }, combat: {} });
  open(combatState.floor.g, 6, 5, { feat: "climb" });
  assert.deepStrictEqual(useTool(combatState, "ladder", "E", fakeRng([]), []), []);
  assert.equal(combatState.floor.px, 5);
});

test("useTool: isFlying wins — the tool is NOT consumed and flownOver fires instead", () => {
  // 260918-w4n (use-activated-only): isFlying now requires a LIVE fly-kind
  // record — a bagged/ready Bracelet no longer flies unconditionally.
  const state = fixedState({
    c: {
      items: [toolItem("ladder"), { n: "Bracelet of Flight", eff: { fly: 1 } }],
      timers: { "item:Bracelet of Flight": { cadence: "squares", left: 20, cd: 50, phase: "effect" } },
    },
  });
  open(state.floor.g, 6, 5, { feat: "climb" });
  const events = useTool(state, "ladder", "E", fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "flownOver"));
  assert.equal(events.some((e) => e.type === "toolUsed"), false);
  assert.equal(state.c.items.some((it) => it.kind === "tool" && it.tool === "ladder"), true, "the ladder is still carried");
});

// --- teleport / descend clear a pending hazard too --------------------------

test("teleport clears a pending hazard", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")] } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  move(state, "E", fakeRng([]), []);
  assert.ok(state.pendingHazard);
  open(state.floor.g, 3, 3);
  teleport(state, fakeRng([1, 1, 1]), []);
  assert.equal(state.pendingHazard, null);
});

test("descend clears a pending hazard", () => {
  const state = fixedState({ c: { items: [toolItem("ladder")], sp: 500 } });
  open(state.floor.g, 6, 5, { feat: "climb" });
  move(state, "E", fakeRng([]), []);
  assert.ok(state.pendingHazard);
  const rng = makeRng(99);
  descend(state, rng, []);
  assert.equal(state.pendingHazard, null);
});

// --- torch: lights c.darkFor darkness ----------------------------------

test("useItem torch: while inDark (c.darkFor>0), lights, clears darkFor, starts a 40-square lit effect, is consumed", () => {
  const state = fixedState({ c: { items: [toolItem("torch")], darkFor: 12 } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(events.some((e) => e.type === "torchLit" && e.left === 40));
  assert.ok(events.some((e) => e.type === "itemEffectStarted" && e.kind === "lit" && e.left === 40));
  assert.ok(events.some((e) => e.type === "itemConsumed"));
  assert.equal(state.c.darkFor, 0);
  assert.equal(state.c.items.length, 0, "the torch is gone");
  assert.deepStrictEqual(state.c.timers["item:Torch"], { cadence: "squares", left: 40, phase: "effect" });
});

test("useItem torch: a Pilfer lights a torch too — a tool is mundane kit, not a magic item, so the pilfer refusal never fires", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Pilfer", items: [toolItem("torch")], darkFor: 12 } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.ok(!events.some((e) => e.type === "useRefused"), "no useRefused of any reason");
  assert.ok(events.some((e) => e.type === "torchLit" && e.left === 40));
  assert.ok(events.some((e) => e.type === "itemConsumed"));
  assert.equal(state.c.darkFor, 0);
  assert.equal(state.c.items.length, 0, "the torch is gone");
});

test("useItem torch: on a lit tile with darkFor 0, inDark still reads true off the tile's own .dark flag — same lit result", () => {
  const state = fixedState({ c: { items: [toolItem("torch")], darkFor: 0 }, floor: { g: wallGrid(), px: 5, py: 5, depth: 1 } });
  state.floor.g[5][5] = { wall: false, seen: false, feat: null, dark: true };
  assert.equal(inDark(state), true);
  const events = useItem(state, 0, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "torchLit"));
  assert.ok(events.some((e) => e.type === "itemConsumed"));
});

test("useItem torch: NOT dark — useRefused notDark, torch stays in the bag, no timers key", () => {
  const state = fixedState({ c: { items: [toolItem("torch")], darkFor: 0 } });
  state.floor.g[5][5] = { wall: false, seen: false, feat: null, dark: false };
  assert.equal(inDark(state), false);
  const events = useItem(state, 0, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: state.c.items[0], reason: "notDark" }]);
  assert.equal(state.c.items.length, 1, "the torch is still carried");
  assert.equal(state.c.timers, undefined);
});

test("fallDark: a live torch lit effect resists — darknessResisted, no tile painted, darkFor unchanged", () => {
  const state = fixedState({ c: { darkFor: 0, timers: { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } } } });
  const events = fallDark(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "darknessResisted", by: "torch" }]);
  assert.equal(state.c.darkFor, 0);
  assert.equal(state.floor.g[state.floor.py][state.floor.px].dark, undefined);
});

test("fallDark: after the lit effect fades (40 steps), fallDark works again", () => {
  const state = fixedState({ c: { items: [toolItem("torch")], darkFor: 5 } });
  useItem(state, 0, fakeRng([]), []); // starts the 40-square lit effect, darkFor -> 0
  assert.equal(itemEffectActive(state.c, "lit"), true);
  // Walk 40 plain steps to burn the effect down (no feature tiles, no rng
  // draws) — an open corridor the whole row, so E/W oscillation never hits
  // an unopened (still-walled) cell.
  for (let x = 1; x < GW - 1; x++) open(state.floor.g, x, 5);
  for (let i = 0; i < 40; i++) {
    move(state, i % 2 === 0 ? "E" : "W", fakeRng([]), []);
  }
  assert.equal(itemEffectActive(state.c, "lit"), false, "the lit effect has faded");
  const events = fallDark(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "darknessFell"));
  assert.equal(state.c.darkFor, 30, "fallDark works normally again");
});
