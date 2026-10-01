// test/unit/days-farm.test.js
//
// Phase 82 (FARM-01/FARM-02) — small caps only. No full-cap bot run (20,000
// actions / 500 days) ever runs inside `npm test`; every playRun/playFarmRun
// call in this file caps maxActions well under 3,000. The 200-seed measured
// run is plan 82-02's own one-off CLI invocation, never a test.

import test from "node:test";
import assert from "node:assert/strict";

import { playRun, decideAction, makeBotContext, botLine, BOT_DEFAULTS, forceParty, RUN_FLAGS } from "../../tools/lib/tuning-bot.mjs";
import { buyFrom } from "../../engine/economy.js";
import { newRun } from "../../engine/engine.js";
import { eatsFor, nightlyEats } from "../../engine/movement.js";
import { seedList } from "../../tools/lib/class-matrix.mjs";
import {
  FARM_CAPS,
  FARM_VARIANTS,
  CLOCK_WINDOW,
  BREAKER_LIMIT,
  DAYS_RULES,
  isStairsCell,
  farmDir,
  hoarderStorePick,
  makeFarmerPolicy,
  playHonestRun,
  playFarmRun,
  summarizeHonest,
  summarizeFarm,
  farmVerdict,
  buildFarmReport,
  formatFarmReport,
} from "../../tools/lib/days-farm.mjs";

// --- Task 1: playRun hooks (opts.policy / opts.stopWhen) -------------------

test("playRun hooks", async (t) => {
  await t.test("BOT_DEFAULTS keeps exactly its 8 keys; no policy or stopWhen key", () => {
    const keys = Object.keys(BOT_DEFAULTS).sort();
    assert.deepEqual(keys, [
      "campThreshold",
      "casterFleeThreshold",
      "exploreBudget",
      "fleeThreshold",
      "maxActions",
      "party",
      "potionThreshold",
      "startDepth",
    ]);
    assert.equal("policy" in BOT_DEFAULTS, false);
    assert.equal("stopWhen" in BOT_DEFAULTS, false);
  });

  await t.test("botLine with policy and stopWhen added equals botLine(BOT_DEFAULTS)", () => {
    const withHooks = { ...BOT_DEFAULTS, startDepth: 1, policy: decideAction, stopWhen: () => false };
    assert.equal(botLine(withHooks), botLine({ ...BOT_DEFAULTS, startDepth: 1 }));
  });

  const project = (result) => ({
    actions: result.actions,
    deathDepth: result.deathDepth,
    dead: result.dead,
    cause: result.cause,
    day: result.state.day,
    steps: result.state.steps,
    rngState: result.state.rngState,
  });

  for (const seed of [1, 7920, 47515]) {
    await t.test(`playRun with policy: decideAction, or stopWhen: () => false, matches the bare call (seed ${seed})`, () => {
      const bare = project(playRun(seed, { maxActions: 400 }));
      const withPolicy = project(playRun(seed, { maxActions: 400, policy: decideAction }));
      const withStopWhen = project(playRun(seed, { maxActions: 400, stopWhen: () => false }));
      assert.deepEqual(withPolicy, bare);
      assert.deepEqual(withStopWhen, bare);
    });
  }

  await t.test("stopWhen: (s, n) => n >= 25 stops the run at exactly 25 actions with stuck false", () => {
    const result = playRun(1, { maxActions: 400, stopWhen: (_s, n) => n >= 25 });
    assert.equal(result.actions, 25);
    assert.equal(result.stuck, false);
    assert.equal(result.outcome, "unknown");
  });

  await t.test("a counting policy that wraps decideAction is called exactly `actions` times", () => {
    let calls = 0;
    const countingPolicy = (state, policyRng, ctx) => {
      calls++;
      return decideAction(state, policyRng, ctx);
    };
    const result = playRun(1, { maxActions: 400, policy: countingPolicy });
    assert.equal(calls, result.actions);
  });
});

// --- Task 2: farmer policy, classification, summaries, verdict -------------

/**
 * mkGrid(rows) — a minimal `{g, px, py, depth}` floor: `#` wall, `.`
 * open+seen, `?` open+UNSEEN, `E` exit+seen, `D` dot+seen, `H` chest+seen,
 * `C` climb+seen (a HAZARD_FEATS member), `S` the player's start (an
 * open+seen cell). Every cell is seen unless marked `?`. Mirrors
 * test/unit/tuning-bot.test.js's own mkGrid (not exported there, so a small
 * local copy — the shape is a plain data contract, not shared code).
 */
function mkGrid(rows) {
  const g = [];
  let px = 0;
  let py = 0;
  for (let y = 0; y < rows.length; y++) {
    const row = [];
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      const cell = { wall: false, seen: true, feat: null };
      if (ch === "#") cell.wall = true;
      else if (ch === "E") cell.feat = "exit";
      else if (ch === "D") cell.feat = "dot";
      else if (ch === "H") cell.feat = "chest";
      else if (ch === "C") cell.feat = "climb";
      else if (ch === "?") cell.seen = false;
      else if (ch === "S") {
        px = x;
        py = y;
      }
      row.push(cell);
    }
    g.push(row);
  }
  return { g, px, py, depth: 1 };
}

test("Task 2: farmDir", async (t) => {
  await t.test("never returns a direction whose destination is an exit cell — fully seen, floor cleared, every legal dir but one leads to the stairs", () => {
    // S at (2,2); N leads to the exit at (2,1); S/E/W lead to open, seen,
    // non-hazard cells. No unseen tile, no dot/chest left to clear.
    const floor = mkGrid(["#####", "#.E.#", "#.S.#", "#...#", "#####"]);
    const state = { floor };
    for (let i = 0; i < 20; i++) {
      // 20 different policyRng "seeds" — a simple deterministic cycling
      // pick, standing in for 20 distinct policyRng instances.
      const policyRng = { pick: (arr) => arr[i % arr.length] };
      const dir = farmDir(state, policyRng);
      assert.notEqual(dir, "N", `i=${i}: farmDir picked the exit direction`);
      assert.notEqual(dir, null);
    }
  });

  await t.test("heads toward the nearest unseen cell first, never through the exit", () => {
    // S at (1,1); the exit sits directly east; the only unseen cell is west.
    const floor = mkGrid(["#####", "#?SE#", "#####"]);
    const state = { floor };
    assert.equal(farmDir(state, { pick: (arr) => arr[0] }), "W");
  });

  await t.test("heads toward a seen dot/chest once nothing is unseen, never through the exit", () => {
    // S at (2,1); exit is east; a seen dot sits west; every cell is seen.
    const floor = mkGrid(["#####", "#DSE#", "#####"]);
    const state = { floor };
    assert.equal(farmDir(state, { pick: (arr) => arr[0] }), "W");
  });

  await t.test("returns null when every legal step is the stairs (boxed in)", () => {
    // A 1-wide dead-end corridor: S has exactly one legal neighbor, the exit.
    const boxedFloor = mkGrid(["####", "#SE#", "####"]);
    const state = { floor: boxedFloor };
    assert.equal(farmDir(state, { pick: (arr) => arr[0] }), null);
  });
});

test("Task 2: hoarderStorePick", async (t) => {
  function storeState(over = {}) {
    return {
      store: { stock: [{ n: "Rations", cost: 30, effectId: "buyRations", effectParams: { amount: 1 }, sold: false }] },
      c: { gold: 100, rations: 0, bag: "small" },
      ...over,
    };
  }

  await t.test("returns {type:'buyItem', idx} for the first unsold, affordable buyRations line", () => {
    const state = storeState();
    assert.deepStrictEqual(hoarderStorePick(state), { type: "buyItem", idx: 0 });
  });

  await t.test("returns null when the line is already sold", () => {
    const state = storeState();
    state.store.stock[0].sold = true;
    assert.equal(hoarderStorePick(state), null);
  });

  await t.test("returns null when the line's cost exceeds c.gold", () => {
    const state = storeState();
    state.c.gold = 5;
    assert.equal(hoarderStorePick(state), null);
  });

  await t.test("returns null when c.rations is already at BAGS[c.bag].rations (small: 10)", () => {
    const state = storeState();
    state.c.rations = 10;
    assert.equal(hoarderStorePick(state), null);
  });

  // Phase 87 (STORE-04): one ration per purchase, repeated until the shelf, the
  // purse or the pack cap runs out. Driven through the REAL engine buyFrom.
  function hoard(state) {
    let buys = 0;
    for (let n = 0; n < 50; n++) {
      const pick = hoarderStorePick(state);
      if (pick === null) return buys;
      const before = state.c.rations;
      buyFrom(state, pick.idx, []);
      assert.ok(state.c.rations > before, "hoarder picked a buy the engine refused");
      buys++;
    }
    assert.fail("hoarder looped");
  }
  const perRation = (left, over = {}) => ({
    store: { stock: [{ n: "Rations (+1 ration)", sub: null, cost: 30, effectId: "buyRations", effectParams: { amount: 1 }, sold: false, left }] },
    c: { gold: 100, rations: 0, bag: "small" },
    ...over,
  });

  await t.test("Phase 87: left 3, gold 100 -> exactly 3 buys (gold 10 left), then null", () => {
    const state = perRation(3);
    assert.equal(hoard(state), 3);
    assert.equal(state.c.gold, 10);
    assert.equal(state.c.rations, 3);
    assert.equal(hoarderStorePick(state), null);
  });

  await t.test("Phase 87: left 10, 8 rations in a small bag -> exactly 2 buys (the cap), then null", () => {
    const state = perRation(10, { c: { gold: 1000, rations: 8, bag: "small" } });
    assert.equal(hoard(state), 2);
    assert.equal(state.c.rations, 10);
  });

  await t.test("Phase 87: left 10, gold 70 -> exactly 2 buys (the purse), then null", () => {
    const state = perRation(10, { c: { gold: 70, rations: 0, bag: "small" } });
    assert.equal(hoard(state), 2);
    assert.equal(state.c.gold, 10);
  });

  await t.test("Phase 87: a legacy line (no left, unsold) still returns its idx once", () => {
    const state = storeState();
    assert.deepStrictEqual(hoarderStorePick(state), { type: "buyItem", idx: 0 });
    state.store.stock[0].sold = true;
    assert.equal(hoarderStorePick(state), null);
  });

  await t.test("returns null with no store or no buyRations line", () => {
    assert.equal(hoarderStorePick({ store: null, c: { gold: 100, rations: 0, bag: "small" } }), null);
    const state = storeState();
    state.store.stock[0].effectId = "buyWeapon";
    assert.equal(hoarderStorePick(state), null);
  });
});

test("Task 2: makeFarmerPolicy", async (t) => {
  await t.test("below the farm floor, returns exactly what decideAction returns (identical twin ctx/rng)", () => {
    const state = newRun(1, [], { ...RUN_FLAGS });
    assert.equal(state.floor.depth, 1);
    const { policy } = makeFarmerPolicy({ variant: "noStairs", farmFloor: 2 });
    const fixedPolicyRng = { pick: (arr) => arr[0] };
    const policyResult = policy(state, fixedPolicyRng, makeBotContext());
    const directResult = decideAction(state, fixedPolicyRng, makeBotContext());
    assert.deepStrictEqual(policyResult, directResult);
  });

  await t.test("camp guard: decideAction picks camp but c.rations < nightlyEats(state) — the farmer moves instead and stats.campGuard becomes 1", () => {
    // Pinned: seed 1 (Fridgian Fighter) is the first seedList(60) entry whose
    // decideAction returns {type:"camp"} under this setup (rations set to
    // exactly the hero's own appetite, wp under campThreshold, no potions) —
    // verified live via a throwaway probe in the planner's scratchpad.
    let state = newRun(1, [], { ...RUN_FLAGS });
    forceParty(state);
    assert.ok(state.party.length >= 1, "forceParty must recruit at least one member for this precondition");
    state.c.rations = eatsFor(state.c); // the fair bot's OWN gate: c.rations >= RACES[c.race].eats
    state.c.wp = Math.max(1, Math.floor(state.c.maxWP * BOT_DEFAULTS.campThreshold) - 1);
    state.c.potions = 0;
    // Precondition asserted FIRST: decideAction picks camp, and the party's
    // real appetite exceeds what was provisioned.
    const probe = decideAction(state, { pick: (arr) => arr[0] }, makeBotContext());
    assert.deepStrictEqual(probe, { type: "camp" });
    assert.ok(state.c.rations < nightlyEats(state), "precondition: rations must be short of the party's real nightly need");

    const { policy, stats } = makeFarmerPolicy({ variant: "noStairs", farmFloor: 1 });
    const action = policy(state, { pick: (arr) => arr[0] }, makeBotContext());
    assert.notEqual(action.type, "camp");
    assert.equal(action.type, "move");
    assert.equal(stats.campGuard, 1);
  });
});

test("Task 2: playFarmRun — floor-1 farming", async (t) => {
  for (const variant of FARM_VARIANTS) {
    await t.test(`${variant}: seed 1, maxActions 1500 — floor stays 1, outcome is dead or unbounded, never leftFloor, day > 1`, () => {
      const row = playFarmRun(1, { variant, farmFloor: 1, maxActions: 1500 });
      assert.equal(row.floor, 1);
      assert.ok(row.outcome === "dead" || row.outcome === "unbounded", `outcome was ${row.outcome}`);
      assert.notEqual(row.outcome, "leftFloor");
      assert.ok(row.day > 1, `day was ${row.day}`);
    });
  }

  // Pinned: seed 55434 (seedList index 7, i*7919+1) is the planner's own
  // probe seed — a solo start that recruits a Joiner whose extra appetite
  // the fair bot's own camp gate (hero-only eats) does not account for,
  // triggering campFailed(noRations) before this plan's guard existed.
  //
  // Re-pinned (Phase 90 plan 02, ABIL-07, 2026-09-30): a Joiner Fighter's
  // Pommel Strike now strikes as well as stuns, so the run seed 55434 plays
  // out differently and its campGuard count went 200 -> 0 (campFailed 0
  // either way; its hero is a Summoner, so the Pommel Strike is a Joiner's);
  // the sibling seed 15839 (a Barbarian) went 195 -> 0 as well. The new
  // pin is the first seedList(120) Summoner solo start whose measured run
  // fires the guard: seed 293004 (index 37), campGuard 139, campFailed 0,
  // the same shape of run (a solo Magic User start, a Joiner's appetite). The
  // assertion itself is unchanged.
  await t.test("camp-guard regression on a real run: seed 293004, noStairs, farmFloor 1 — campGuard fires, campFailed never does", () => {
    const row = playFarmRun(293004, { variant: "noStairs", farmFloor: 1, maxActions: 1500 });
    assert.ok(row.campGuard >= 1, `campGuard was ${row.campGuard}`);
    assert.equal(row.campFailed, 0);
  });
});

test("Task 2: playFarmRun — farm floor 2 reaches exactly like the honest run", () => {
  const honestStop = playRun(1, { ...BOT_DEFAULTS, stopWhen: (s) => s.floor.depth >= 2 });
  const row = playFarmRun(1, { variant: "noStairs", farmFloor: 2, maxActions: 2500 });
  assert.equal(row.reachedFarmAt, honestStop.actions);
  assert.equal(row.floor, 2);
  assert.notEqual(row.outcome, "leftFloor");
});

test("Task 2: playHonestRun", () => {
  const row = playHonestRun(1);
  assert.equal(typeof row.day, "number");
  assert.equal(typeof row.floor, "number");
  assert.ok(row.outcome === "dead" || row.outcome === "stuck");
});

test("Task 2: summarizeHonest", async (t) => {
  await t.test("excludes stuck rows from days/depth, reports floor1Deaths separately", () => {
    const rows = [
      { day: 5, floor: 1, outcome: "dead", cls: "Fighter", race: "Human" },
      { day: 10, floor: 3, outcome: "dead", cls: "Thief", race: "Elven" },
      { day: 999, floor: 50, outcome: "stuck", cls: "Fighter", race: "Human" },
    ];
    const summary = summarizeHonest(rows);
    assert.equal(summary.runs, 3);
    assert.equal(summary.completed, 2);
    assert.equal(summary.stuck, 1);
    assert.equal(summary.days.max, 10); // the stuck row's day=999 never enters the distribution
    assert.equal(summary.depth.max, 3);
    assert.equal(summary.floor1Deaths.n, 1);
    assert.equal(summary.floor1Deaths.days.max, 5);
  });

  await t.test("p99 over 200 values is the value at sorted index 198", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ day: i, floor: 2, outcome: "dead", cls: "Fighter", race: "Human" }));
    const summary = summarizeHonest(rows);
    assert.equal(summary.days.p99, 198);
  });

  await t.test("empty input reports 0 everywhere, never NaN", () => {
    const summary = summarizeHonest([]);
    assert.deepStrictEqual(summary.days, { min: 0, p50: 0, p90: 0, p99: 0, max: 0 });
    assert.equal(summary.floor1Deaths.n, 0);
    assert.deepStrictEqual(summary.floor1Deaths.days, { min: 0, p50: 0, p90: 0, p99: 0, max: 0 });
  });
});

test("Task 2: summarizeFarm", async (t) => {
  await t.test("counts only dead/unbounded in the DAYS percentiles; an unbounded row's day is the cap value; leftFloor/notReached counted separately", () => {
    const rows = [
      { day: 5, outcome: "dead", cause: "starve", cls: "Fighter", race: "Human", rationsBought: 1, cooked: 0, campGuard: 0, breaker: 0, boxedIn: 0, hungryNights: 2, clockMoving: null },
      { day: 500, outcome: "unbounded", cause: null, cls: "Fighter", race: "Human", rationsBought: 3, cooked: 1, campGuard: 1, breaker: 0, boxedIn: 0, hungryNights: 0, clockMoving: true },
      { day: 12, outcome: "leftFloor", cause: null, cls: "Thief", race: "Elven", rationsBought: 0, cooked: 0, campGuard: 0, breaker: 0, boxedIn: 1, hungryNights: 1, clockMoving: null },
      { day: 3, outcome: "notReached", cause: null, cls: "Thief", race: "Elven", rationsBought: 0, cooked: 0, campGuard: 0, breaker: 0, boxedIn: 0, hungryNights: 0, clockMoving: null },
    ];
    const summary = summarizeFarm(rows);
    assert.equal(summary.runs, 4);
    assert.equal(summary.dead, 1);
    assert.equal(summary.unbounded, 1);
    assert.equal(summary.counted, 2);
    assert.equal(summary.leftFloor, 1);
    assert.equal(summary.notReached, 1);
    assert.equal(summary.days.max, 500); // the unbounded row's day (the cap value) is in the percentile set
    assert.equal(summary.starveDeaths, 1);
    assert.equal(summary.starveShare, 1); // 1 of 1 dead rows starved
    assert.equal(summary.totals.rationsBought, 4); // summed over ALL rows, not just counted
  });

  await t.test("empty input reports 0 everywhere, never NaN", () => {
    const summary = summarizeFarm([]);
    assert.deepStrictEqual(summary.days, { min: 0, p50: 0, p90: 0, p99: 0, max: 0 });
    assert.equal(summary.starveShare, 0);
    assert.equal(summary.hungryNightsMean, 0);
  });
});

test("Task 2: DAYS_RULES", () => {
  assert.deepStrictEqual(Object.keys(DAYS_RULES).sort(), ["floor2plus", "mock", "perFloorCap"]);
  for (const key of Object.keys(DAYS_RULES)) {
    assert.equal(typeof DAYS_RULES[key].ruleLine, "string");
    assert.equal(DAYS_RULES[key].ruleLine.includes("\n"), false);
  }
  assert.equal(DAYS_RULES.floor2plus.voiceLine, "Days on the first floor don't count. That's loitering.");
  assert.equal(DAYS_RULES.perFloorCap.rankKey.formula, "min(day, 10 * floor)");
});

test("Task 2: farmVerdict", async (t) => {
  const honest = { days: { p99: 20 } };

  function farmSummary({ p90, unbounded = 0, max = p90 }) {
    return { days: { p90, max }, unbounded };
  }

  await t.test("no win on either floor gives 'mock'", () => {
    const farm = {
      1: { noStairs: farmSummary({ p90: 5 }), hoarder: farmSummary({ p90: 6 }) },
      2: { noStairs: farmSummary({ p90: 8 }), hoarder: farmSummary({ p90: 9 }) },
    };
    const verdict = farmVerdict({ honest, farm });
    assert.equal(verdict.branch, "mock");
  });

  await t.test("floor-1 p90 >= honest p99 gives 'floor2plus'", () => {
    const farm = {
      1: { noStairs: farmSummary({ p90: 25 }), hoarder: farmSummary({ p90: 6 }) },
      2: { noStairs: farmSummary({ p90: 8 }), hoarder: farmSummary({ p90: 9 }) },
    };
    const verdict = farmVerdict({ honest, farm });
    assert.equal(verdict.floors["1"].wins, true);
    assert.equal(verdict.floors["1"].reason, "p90>=p99");
    assert.equal(verdict.branch, "floor2plus");
  });

  await t.test("a floor-1 cap hit alone gives 'floor2plus'", () => {
    const farm = {
      1: { noStairs: farmSummary({ p90: 5, unbounded: 2 }), hoarder: farmSummary({ p90: 6 }) },
      2: { noStairs: farmSummary({ p90: 8 }), hoarder: farmSummary({ p90: 9 }) },
    };
    const verdict = farmVerdict({ honest, farm });
    assert.equal(verdict.floors["1"].wins, true);
    assert.equal(verdict.floors["1"].reason, "capHit");
    assert.equal(verdict.branch, "floor2plus");
  });

  await t.test("a floor-2 win gives 'perFloorCap', also when floor 1 does not win", () => {
    const farm = {
      1: { noStairs: farmSummary({ p90: 5 }), hoarder: farmSummary({ p90: 6 }) },
      2: { noStairs: farmSummary({ p90: 25 }), hoarder: farmSummary({ p90: 9 }) },
    };
    const verdict = farmVerdict({ honest, farm });
    assert.equal(verdict.floors["1"].wins, false);
    assert.equal(verdict.floors["2"].wins, true);
    assert.equal(verdict.branch, "perFloorCap");
  });

  await t.test("stronger-variant tie-break: p90, then unbounded count, then max, then 'hoarder'", () => {
    // Equal p90, hoarder has more unbounded runs -> hoarder wins the tie.
    const farmA = { 1: { noStairs: farmSummary({ p90: 5, unbounded: 0 }), hoarder: farmSummary({ p90: 5, unbounded: 1 }) } };
    assert.equal(farmVerdict({ honest, farm: farmA }).floors["1"].stronger, "hoarder");

    // Equal p90 and unbounded, noStairs has the higher max -> noStairs wins.
    const farmB = {
      1: { noStairs: farmSummary({ p90: 5, unbounded: 0, max: 40 }), hoarder: farmSummary({ p90: 5, unbounded: 0, max: 30 }) },
    };
    assert.equal(farmVerdict({ honest, farm: farmB }).floors["1"].stronger, "noStairs");

    // Everything tied -> "hoarder" (the documented final tie-break).
    const farmC = { 1: { noStairs: farmSummary({ p90: 5 }), hoarder: farmSummary({ p90: 5 }) } };
    assert.equal(farmVerdict({ honest, farm: farmC }).floors["1"].stronger, "hoarder");
  });

  await t.test("a single measured floor gives branch null with a note", () => {
    const farm = { 1: { noStairs: farmSummary({ p90: 5 }), hoarder: farmSummary({ p90: 6 }) } };
    const verdict = farmVerdict({ honest, farm });
    assert.equal(verdict.branch, null);
    assert.equal(typeof verdict.note, "string");
    assert.ok(verdict.note.length > 0);
  });
});

test("Task 2: formatFarmReport / buildFarmReport", async (t) => {
  const meta = {
    seeds: 4,
    seedList: "i*7919+1",
    farmFloors: [1, 2],
    caps: FARM_CAPS,
    bot: { exploreBudget: BOT_DEFAULTS.exploreBudget, campThreshold: BOT_DEFAULTS.campThreshold },
  };
  const honestRows = [1, 7920, 23758, 39596].map((seed) => playHonestRun(seed));
  const farmRows = {
    1: {
      noStairs: [1, 7920].map((seed) => playFarmRun(seed, { variant: "noStairs", farmFloor: 1, maxActions: 300 })),
      hoarder: [1, 7920].map((seed) => playFarmRun(seed, { variant: "hoarder", farmFloor: 1, maxActions: 300 })),
    },
    2: {
      noStairs: [1, 7920].map((seed) => playFarmRun(seed, { variant: "noStairs", farmFloor: 2, maxActions: 300 })),
      hoarder: [1, 7920].map((seed) => playFarmRun(seed, { variant: "hoarder", farmFloor: 2, maxActions: 300 })),
    },
  };
  const report = buildFarmReport({ meta, honestRows, farmRows });

  await t.test("buildFarmReport survives a JSON round trip unchanged", () => {
    const roundTripped = JSON.parse(JSON.stringify(report));
    assert.deepStrictEqual(roundTripped, report);
  });

  await t.test("formatFarmReport is deterministic, uses only ### and #### headings, and names the verdict", () => {
    const text1 = formatFarmReport(report);
    const text2 = formatFarmReport(report);
    assert.equal(text1, text2);
    assert.ok(text1.includes("### Verdict"));
    assert.ok(text1.includes("### Farm floor 1"));
    assert.ok(text1.includes("### Farm floor 2"));
    for (const line of text1.split("\n")) {
      if (line.startsWith("#")) {
        assert.ok(line.startsWith("### ") || line.startsWith("#### "), `unexpected heading level: ${line}`);
      }
    }
    if (report.verdict.ruleLine) {
      assert.ok(text1.includes(report.verdict.ruleLine));
    }
  });
});

test("Task 2: module constants", () => {
  assert.deepStrictEqual(FARM_CAPS, { maxActions: 20000, maxDays: 500 });
  assert.deepStrictEqual(FARM_VARIANTS, ["noStairs", "hoarder"]);
  assert.equal(CLOCK_WINDOW, 2000);
  assert.equal(BREAKER_LIMIT, 50);
  assert.equal(isStairsCell({ feat: "exit" }), true);
  assert.equal(isStairsCell({ feat: "gate" }), true);
  assert.equal(isStairsCell({ feat: "tele" }), false);
  assert.equal(isStairsCell({ feat: null }), false);
});
