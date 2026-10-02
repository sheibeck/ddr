// test/unit/economy-readout.test.js
//
// Phase 92 (ECON-11, 92-02) -- pins for tools/lib/economy-readout.mjs (pure,
// hand-built runs; never a seeded run's numbers) and for the tools/tune-
// economy.mjs CLI (a few seeds, small action cap: shape and determinism only).

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import { STORE_EFFECTS } from "../../engine/economy.js";
import {
  STOCK_GROUP_OF,
  GROUP_ORDER,
  stockGroups,
  shareOf,
  economyReadout,
  projectLever,
  valueForTarget,
  formatEconomyReadout,
  formatEconomyMarkdown,
} from "../../tools/lib/economy-readout.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL = path.join(REPO_ROOT, "tools", "tune-economy.mjs");

const grp = (o) => {
  const g = Object.fromEntries(GROUP_ORDER.map((k) => [k, 0]));
  Object.assign(g, o);
  g.total = GROUP_ORDER.reduce((s, k) => s + g[k], 0);
  return g;
};

// --- stockGroups --------------------------------------------------------------

test("econ lib: every STORE_EFFECTS key maps to a named group", () => {
  for (const id of Object.keys(STORE_EFFECTS)) {
    assert.ok(STOCK_GROUP_OF[id], `no group for ${id}`);
    assert.ok(GROUP_ORDER.includes(STOCK_GROUP_OF[id]), `${id} -> unknown group ${STOCK_GROUP_OF[id]}`);
  }
  assert.deepEqual([...GROUP_ORDER].sort(), [...new Set(Object.values(STOCK_GROUP_OF))].sort());
});

test("econ lib: stockGroups sums by group, counts Rations as price x stock left, and skips a sold line", () => {
  const stock = [
    { n: "Bread", cost: 40, effectId: "eatRation", sold: false },
    { n: "Healing potion", cost: 150, effectId: "givePotion", sold: false },
    { n: "Long sword", cost: 500, effectId: "buyWeapon", sold: false },
    { n: "Chain", cost: 900, effectId: "buyArmor", sold: true },
    { n: "Rations (+1 ration)", cost: 30, effectId: "buyRations", left: 7, sold: false },
    { n: "Torch", cost: 20, effectId: "giveTool", sold: false },
  ];
  const g = stockGroups(stock);
  assert.equal(g.food, 40);
  assert.equal(g.potions, 150);
  assert.equal(g.weapons, 500);
  assert.equal(g.armour, 0, "a sold line counts 0");
  assert.equal(g.rations, 210);
  assert.equal(g.tools, 20);
  assert.equal(g.total, 40 + 150 + 500 + 210 + 20);
  assert.throws(() => stockGroups([{ cost: 1, effectId: "nope" }]), /unknown store effect/);
});

// --- shares ---------------------------------------------------------------------

test("econ lib: share arithmetic, caps at 1, an empty shelf is null (never NaN)", () => {
  assert.equal(shareOf(300, 1000), 0.3);
  assert.equal(shareOf(2000, 1000), 1);
  assert.equal(shareOf(5, 0), null);
});

// --- economyReadout -----------------------------------------------------------------

function fixtureRuns() {
  return [
    {
      seed: 1, cls: "Fighter", sub: null, race: "Human", startGold: 300, deathDepth: 3,
      visits: [{ depth: 2, gold: 300, bagCap: 2000, sellValue: 200, groups: grp({ potions: 500, weapons: 500 }), incomeSoFar: { chest: 100 }, spentSoFar: 50 }],
      arrivals: [
        { depth: 1, gold: 300, sellValue: 0, bagCap: 2000, wouldFace: grp({ potions: 1000 }), incomeSoFar: {} },
        { depth: 2, gold: 400, sellValue: 100, bagCap: 2000, wouldFace: grp({ potions: 800 }), incomeSoFar: { chest: 100 } },
      ],
      incomeByDepth: { 1: { "off the body": 50 }, 2: { chest: 100 }, 3: { chest: 10 } },
      spentByDepth: { 2: 50 },
    },
    {
      seed: 2, cls: "Thief", sub: "Pickpocket", race: "Elven", startGold: 200, deathDepth: 14,
      visits: [
        { depth: 2, gold: 1200, bagCap: 2000, sellValue: 0, groups: grp({ potions: 1000 }), incomeSoFar: { chest: 900 }, spentSoFar: 0 },
        { depth: 13, gold: 2000, bagCap: 2000, sellValue: 50, groups: grp({ potions: 1000, premium: 1000 }), incomeSoFar: {}, spentSoFar: 300 },
      ],
      arrivals: [],
      incomeByDepth: { 2: { chest: 900 }, 13: { tableFour: 1300 }, 14: { "off the body": 7 } },
      spentByDepth: { 13: 300 },
    },
  ];
}

test("econ lib: economyReadout rows run 1..maxDepth in order plus a 13+ aggregate", () => {
  const ro = economyReadout(fixtureRuns(), { maxDepth: 12 });
  assert.deepEqual(ro.depths.map((r) => r.L), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(ro.deeper.L, "13+");
  assert.equal(ro.depths[0].runsReached, 2);
  assert.equal(ro.depths[2].runsReached, 2);
  assert.equal(ro.depths[3].runsReached, 1);
  assert.equal(ro.deeper.runsReached, 1);
});

test("econ lib: visit statistics, buy-out and the with-bag basis", () => {
  const ro = economyReadout(fixtureRuns());
  const f2 = ro.depths[1].visits;
  assert.equal(f2.n, 2);
  // shares 300/1000 = 0.3 and 1200/1000 -> 1 (capped); nearest-rank p50 of [0.3, 1] is index 1
  assert.equal(f2.share.p50, 1);
  assert.equal(f2.buyOutCount, 1);
  assert.equal(f2.buyOutPct, 50);
  assert.equal(f2.buyOutWithSalesPct, 50);
  assert.equal(f2.atBagCapPct, 0);
  assert.equal(f2.spentBefore, 25);
  assert.equal(f2.groups.potions, 1000);
  const deep = ro.deeper.visits;
  assert.equal(deep.n, 1);
  assert.equal(deep.buyOutPct, 100);
  assert.equal(deep.atBagCapPct, 100);
  // a depth with no visits reports n 0 and nulls
  const f5 = ro.depths[4].visits;
  assert.equal(f5.n, 0);
  assert.equal(f5.gold.p50, null);
  assert.equal(f5.share.p50, null);
  assert.equal(f5.buyOutPct, null);
  assert.equal(JSON.stringify(ro).includes("NaN"), false);
  // arrivals sample
  assert.equal(ro.depths[0].arrivals.n, 1);
  assert.equal(ro.depths[0].arrivals.shareP50, 0.3);
  assert.equal(ro.depths[1].arrivals.shareWithSalesP50, 0.625);
});

test("econ lib: income per depth and cumulative sum to the run totals", () => {
  const runs = fixtureRuns();
  const ro = economyReadout(runs, { maxDepth: 12 });
  const rows = [...ro.depths, ro.deeper];
  let onFloorSum = 0;
  for (const r of rows) onFloorSum += r.runsReached * r.income.onFloorTotal;
  const runTotals = runs.reduce((s, r) => s + r.startGold + Object.values(r.incomeByDepth).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0), 0);
  assert.ok(Math.abs(onFloorSum - runTotals) < 0.5, `${onFloorSum} vs ${runTotals}`);
  assert.equal(ro.sources.total, runTotals);
  assert.equal(ro.sources.earned, runTotals - 500);
  assert.equal(ro.sources.order[0], "start");
  // cumulative to floor 3 for run 1 (reached 3) and run 2: (300+50+100+10 + 200+900) / 2
  assert.equal(ro.depths[2].income.toFloorTotal, (460 + 1100) / 2);
  assert.equal(ro.depths[0].income.onFloor.start, 250);
  assert.equal(ro.depths[1].income.spentToFloor, 25);
  // cumulative to the deeper aggregate is the whole run
  assert.equal(ro.deeper.income.toFloorTotal, 200 + 900 + 1300 + 7);
});

// --- projectLever -------------------------------------------------------------------

test("econ lib: price lever share = gold / (total - scaled + m x scaled)", () => {
  const runs = [{ visits: [{ depth: 7, gold: 300, bagCap: 2000, sellValue: 100, groups: grp({ weapons: 400, rations: 600 }), incomeSoFar: {}, spentSoFar: 0 }], arrivals: [] }];
  const p = projectLever(runs, { lever: "price", groups: ["weapons"], values: [1, 2], basis: "gold" });
  assert.equal(p.values[0].focus.visitShare, 0.3);
  assert.equal(p.values[1].focus.visitShare, round4(300 / 1400));
  assert.equal(p.values[1].visitShare.length, 12);
  assert.ok(/first guess/.test(p.note));
  const w = projectLever(runs, { lever: "price", groups: ["weapons"], values: [2], basis: "goldWithSales" });
  assert.equal(w.values[0].focus.visitShare, round4(400 / 1400));
});

test("econ lib: income lever trims the named sources' income so far; the cap lever clips to k x bag cap", () => {
  const runs = [{ visits: [{ depth: 7, gold: 1000, bagCap: 2000, sellValue: 0, groups: grp({ potions: 2000 }), incomeSoFar: { chest: 600, faerie: 100, "off the body": 200 }, spentSoFar: 0 }], arrivals: [] }];
  const inc = projectLever(runs, { lever: "income", sources: ["chest", "faerie"], values: [1, 0.5, 0], basis: "gold" });
  assert.equal(inc.values[0].focus.visitShare, 0.5); // 1000 / 2000
  assert.equal(inc.values[1].focus.visitShare, round4(650 / 2000)); // 1000 - 0.5 x 700
  assert.equal(inc.values[2].focus.visitShare, round4(300 / 2000)); // 1000 - 700
  const cap = projectLever(runs, { lever: "cap", values: [1, 0.25], basis: "gold" });
  assert.equal(cap.values[0].focus.visitShare, 0.5);
  assert.equal(cap.values[1].focus.visitShare, 0.25); // min(1000, 500) / 2000
  const tgt = valueForTarget(inc, 0.4);
  assert.ok(tgt > 0 && tgt < 1, `interpolated ${tgt}`);
  assert.equal(valueForTarget(inc, 0.9), null);
});

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

// --- renderers ----------------------------------------------------------------------

test("econ lib: the renderers are byte-stable and carry the en dash and every depth row", () => {
  const runs = fixtureRuns();
  const ro = economyReadout(runs);
  const proj = [projectLever(runs, { lever: "price", groups: ["weapons", "armour"], values: [1, 2], basis: "gold" })];
  const a = formatEconomyMarkdown(ro, proj);
  const b = formatEconomyMarkdown(economyReadout(runs), proj);
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a), ["affordability", "sources", "stock", "levers"]);
  assert.ok(a.affordability.includes("–"));
  for (const L of [1, 12, "13+"]) assert.ok(new RegExp(`^\\| ${String(L).replace("+", "\\+")} \\|`, "m").test(a.affordability), `row ${L}`);
  assert.ok(a.levers.includes("first guess"));
  const text = formatEconomyReadout(ro).join("\n");
  assert.ok(text.includes("Store affordability by depth"));
  assert.ok(text.includes("Gold income by source and depth"));
  assert.equal(text.includes("NaN"), false);
});

// --- CLI ----------------------------------------------------------------------------

function runTool(args) {
  const res = spawnSync(process.execPath, [TOOL, ...args], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return res;
}

test("econ cli: --json holds 12 depth rows, the 13+ row, the legacy block and no timing field", () => {
  const res = runTool(["--seeds=4", "--max-actions=600", "--json"]);
  assert.equal(res.status, 0, res.stderr);
  const j = JSON.parse(res.stdout);
  assert.equal(j.readout.depths.length, 12);
  assert.deepEqual(j.readout.depths.map((r) => r.L), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(j.readout.deeper.L, "13+");
  assert.equal(j.meta.seeds, 4);
  assert.equal(j.meta.seedList, "i*7919+1");
  assert.equal(j.meta.dials, "shipped");
  assert.ok(Array.isArray(j.projections) && j.projections.length > 0);
  assert.ok(j.legacy.earned && j.legacy.bySource);
  assert.equal(/elapsed|ms"|timing/i.test(res.stdout), false);
});

test("econ cli: --workers=2 prints byte-identical JSON to --workers=1", () => {
  const one = runTool(["--seeds=6", "--max-actions=500", "--json", "--workers=1"]);
  const two = runTool(["--seeds=6", "--max-actions=500", "--json", "--workers=2"]);
  assert.equal(one.status, 0, one.stderr);
  assert.equal(two.status, 0, two.stderr);
  assert.equal(two.stdout, one.stdout);
});

test("econ cli: the text report has the affordability block and a Dials line; --dials changes the earned total; an unknown dial exits non-zero", () => {
  const base = runTool(["--seeds=4", "--max-actions=600"]);
  assert.equal(base.status, 0, base.stderr);
  assert.ok(base.stdout.includes("Store affordability by depth"));
  assert.ok(/^Dials: shipped$/m.test(base.stdout));
  assert.ok(/^Bot:/m.test(base.stdout.trim().split("\n").pop()));
  const a = JSON.parse(runTool(["--seeds=4", "--max-actions=600", "--json"]).stdout);
  const b = JSON.parse(runTool(["--seeds=4", "--max-actions=600", "--json", '--dials={"LOOT_SCALE":0.4}']).stdout);
  assert.ok(b.readout.sources.earned < a.readout.sources.earned, `${b.readout.sources.earned} vs ${a.readout.sources.earned}`);
  assert.deepEqual(b.meta.dials, { LOOT_SCALE: 0.4 });
  const bad = runTool(["--seeds=1", "--max-actions=50", '--dials={"NOT_A_DIAL":1}']);
  assert.notEqual(bad.status, 0);
  assert.ok(/NOT_A_DIAL/.test(bad.stderr + bad.stdout));
});

test("econ cli: the floor-arrival pricing never touches the run (deathDepth and actions equal playRun's)", async () => {
  const { playRun, BOT_DEFAULTS } = await import("../../tools/lib/tuning-bot.mjs");
  const res = runTool(["--seeds=3", "--max-actions=500", "--json", "--rows"]);
  assert.equal(res.status, 0, res.stderr);
  const j = JSON.parse(res.stdout);
  assert.equal(j.rows.length, 3);
  j.rows.forEach((row, i) => {
    const seed = i * 7919 + 1;
    const ref = playRun(seed, { ...BOT_DEFAULTS, maxActions: 500 });
    assert.equal(row.seed, seed);
    assert.equal(row.deathDepth, ref.deathDepth);
    assert.equal(row.actions, ref.actions);
  });
});
