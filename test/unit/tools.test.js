// Phase 39 (GEAR-05) — the three one-shot hazard tools: content shape, the
// derived-stream loot row (zero main-rng draws on the no-tool-fires path),
// store stock at depth tiers, sell value, and the haveOne duplicate gate.
// Task 2 extends this file with the hazard pre-roll pending state, useTool,
// and the torch's darkness-lighting behaviour.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng, derivedRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
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
} from "../../engine/items.js";
import { hasTool } from "../../engine/derived.js";
import { openStore, buyFrom, sellPriceFor, storeTier } from "../../engine/economy.js";

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
