// test/unit/tuning-bot.test.js
//
// Phase 21 (TUNE-02) — synthetic-state probes for the shared tuning-bot
// policy (tools/lib/tuning-bot.mjs). Asserts DECISIONS and tally arithmetic
// only, using hand-built states — never a readout number from an actual
// seeded run. The tuning tools stay proxies: this file must never assert on
// deathDepth/actions numbers produced by a real playRun.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  decideAction,
  makeBotContext,
  observe,
  nearestUnseenDir,
  dirTowardExit,
  canStep,
  forceParty,
  makeTallies,
  tallyEvents,
  abilitySummary,
  reachTable,
} from "../../tools/lib/tuning-bot.mjs";
import { newRun } from "../../engine/engine.js";
import { SPELLS, RACES } from "../../content/index.js";
import { maxCharges } from "../../engine/movement.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// A policyRng whose .pick() always returns the first element — deterministic
// for the pickFallbackDir/legalDirs paths this file's tests may fall through to.
const fixedPolicyRng = { pick: (arr) => arr[0] };

/**
 * mkGrid(rows) — turns an array of equal-length strings into a minimal
 * `{ g, px, py, depth }` floor: `#` wall, `.` open+seen, `?` open+UNSEEN,
 * `E` exit+seen, `D` dot+seen, `C` climb+seen, `T` trap+seen, `S` the
 * player's start position (an open+seen cell). Every cell is seen unless
 * marked `?`.
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
      else if (ch === "C") cell.feat = "climb";
      else if (ch === "T") cell.feat = "trap";
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

/** A 5x5 open room with S at (1,1) and E at (3,3), no dots, fully seen. */
function defaultFloor() {
  return mkGrid(["....E", ".S...", ".....", ".....", "....."].map((r) => r));
}

function mkState(over = {}) {
  const { c: cOverride, ...rest } = over;
  return {
    c: {
      name: "T",
      race: "Human",
      cls: "Fighter",
      sub: "Soldier",
      level: 1,
      wp: 40,
      maxWP: 40,
      potions: 0,
      rations: 0,
      spellsUsed: 0,
      grimoire: [],
      items: [],
      skills: {},
      gold: 0,
      ...cOverride,
    },
    combat: null,
    store: null,
    pendingFind: null,
    pendingJoiner: null,
    party: [],
    floor: defaultFloor(),
    dead: false,
    won: false,
    ...rest,
  };
}

test("D-06: caster threshold raises flee/parley to 0.5 vs any kit-bearing live foe (0.3 otherwise)", () => {
  const ctx = makeBotContext();

  const casterFoe = { name: "x", alive: true, abilities: ["drudgeFreeze"], wp: 5, maxWP: 5 };
  const fleeState = mkState({ combat: { type: "Walking Dead", foes: [casterFoe], round: 1 }, c: { wp: 16, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(fleeState, fixedPolicyRng, ctx), { type: "flee" }); // Walking Dead: canParley false

  const plainFoe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const attackState = mkState({ combat: { type: "Walking Dead", foes: [plainFoe], round: 1 }, c: { wp: 16, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(attackState, fixedPolicyRng, ctx), { type: "attack" });

  const aboveCasterThresholdState = mkState({
    combat: { type: "Walking Dead", foes: [casterFoe], round: 1 },
    c: { wp: 24, maxWP: 40 },
  });
  assert.deepStrictEqual(decideAction(aboveCasterThresholdState, fixedPolicyRng, ctx), { type: "attack" });

  // D-12/Rule-1 bugfix (found during the BEFORE readout): parley()'s
  // wilmsryVsMagical branch REFUSES a fluency-2 Wilmsry vs a Magical foe
  // without ever setting C.parleyTried, so canParley stays true forever —
  // a bot that always prefers parley over flee would retry it every turn
  // for the rest of the fight. ctx.parleyBlocked (set by observe() on a
  // parleyRefused event) makes decideAction fall through to flee instead.
  const wilmsryC = {
    race: "Wilmsry", cls: "Fighter", sub: "Soldier", level: 1, wp: 8, maxWP: 40,
    potions: 0, rations: 0, spellsUsed: 0, grimoire: [], items: [{ eff: { tongue: 1 } }],
    skills: { Language: 1 }, gold: 0,
  };
  const magicalCombat = { type: "Magical", foes: [plainFoe], round: 1 };
  const wilmsryState = mkState({ combat: magicalCombat, c: wilmsryC });
  assert.deepStrictEqual(decideAction(wilmsryState, fixedPolicyRng, ctx), { type: "parley" });
  ctx.parleyBlocked = true;
  assert.deepStrictEqual(decideAction(wilmsryState, fixedPolicyRng, ctx), { type: "flee" });
});

test("D-05: potion in combat drinks below potionThreshold when carried; flee still wins below fleeThreshold", () => {
  const ctx = makeBotContext();
  const foe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const combat = { type: "Beasts", foes: [foe], round: 1 };

  const drinkState = mkState({ combat, c: { wp: 16, maxWP: 40, potions: 1 } });
  assert.deepStrictEqual(decideAction(drinkState, fixedPolicyRng, ctx), { type: "drinkPotion" });

  const attackState = mkState({ combat, c: { wp: 16, maxWP: 40, potions: 0 } });
  assert.deepStrictEqual(decideAction(attackState, fixedPolicyRng, ctx), { type: "attack" });

  const fleeWinsState = mkState({ combat, c: { wp: 8, maxWP: 40, potions: 1 } });
  assert.deepStrictEqual(decideAction(fleeWinsState, fixedPolicyRng, ctx), { type: "flee" });
});

test("HARN-02: chooseSpell casts the highest-scoring castable spell; no charges or non-Magic-User falls to attack", () => {
  const ctx = makeBotContext();
  const foe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const combat = { type: "Beasts", foes: [foe], round: 1 };

  const freezeIdx = SPELLS.findIndex((s) => s.n === "Freeze");
  assert.strictEqual(freezeIdx, 4);
  const fireballIdx = SPELLS.findIndex((s) => s.n === "Fireball");

  const casterBase = { cls: "Magic User", sub: "Sorcerer", grimoire: ["Freeze", "Heal"], level: 1, spellsUsed: 0, wp: 40, maxWP: 40, items: [] };
  const casterState = mkState({ combat, c: casterBase });
  assert.deepStrictEqual(decideAction(casterState, fixedPolicyRng, ctx), { type: "castSpell", idx: freezeIdx });

  const mc = maxCharges({ level: casterBase.level, items: [] });
  const noChargesState = mkState({ combat, c: { ...casterBase, spellsUsed: mc } });
  assert.deepStrictEqual(decideAction(noChargesState, fixedPolicyRng, ctx), { type: "attack" });

  const fighterState = mkState({ combat, c: { cls: "Fighter", sub: "Soldier", grimoire: ["Freeze", "Heal"], level: 1, spellsUsed: 0, wp: 40, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(fighterState, fixedPolicyRng, ctx), { type: "attack" });

  // HARN-02: under the scoring table Freeze is KILL-tier (410) and wins over
  // any DAMAGE-tier spell regardless of level — this is the OLD thrown-only
  // rule's level-3 case ([Freeze, Fireball] used to pick the higher-lvl
  // Fireball; the table now picks Freeze).
  const highLevelState = mkState({
    combat,
    c: { cls: "Magic User", sub: "Sorcerer", grimoire: ["Freeze", "Fireball"], level: 3, spellsUsed: 0, wp: 40, maxWP: 40, items: [] },
  });
  assert.deepStrictEqual(decideAction(highLevelState, fixedPolicyRng, ctx), { type: "castSpell", idx: freezeIdx });

  // DAMAGE-tier ordering with no KILL-tier spell in the grimoire: Fireball's
  // expected damage (15) outscores Ice's (3.5).
  const damageOnlyState = mkState({
    combat,
    c: { cls: "Magic User", sub: "Sorcerer", grimoire: ["Fireball", "Ice"], level: 3, spellsUsed: 0, wp: 40, maxWP: 40, items: [] },
  });
  assert.deepStrictEqual(decideAction(damageOnlyState, fixedPolicyRng, ctx), { type: "castSpell", idx: fireballIdx });
});

test("D-05: camp needs rations >= the race's eats; potion drinking wins over camp", () => {
  const ctx = makeBotContext();

  const noRationsState = mkState({ c: { wp: 16, maxWP: 40, rations: 0, potions: 0 } });
  assert.strictEqual(decideAction(noRationsState, fixedPolicyRng, ctx).type, "move");

  const enoughRationsState = mkState({ c: { wp: 16, maxWP: 40, rations: 1, potions: 0 } });
  assert.deepStrictEqual(decideAction(enoughRationsState, fixedPolicyRng, ctx), { type: "camp" });

  const [largeRaceName] = Object.entries(RACES).find(([, r]) => r.eats === 2) || [];
  assert.ok(largeRaceName, "expected at least one race with eats === 2");

  const largeShortState = mkState({ c: { race: largeRaceName, wp: 16, maxWP: 40, rations: 1, potions: 0 } });
  assert.strictEqual(decideAction(largeShortState, fixedPolicyRng, ctx).type, "move");

  const largeEnoughState = mkState({ c: { race: largeRaceName, wp: 16, maxWP: 40, rations: 2, potions: 0 } });
  assert.deepStrictEqual(decideAction(largeEnoughState, fixedPolicyRng, ctx), { type: "camp" });

  const potionWinsState = mkState({ c: { wp: 16, maxWP: 40, rations: 1, potions: 1 } });
  assert.deepStrictEqual(decideAction(potionWinsState, fixedPolicyRng, ctx), { type: "drinkPotion" });
});

test("D-05: descend toward the exit once the floor's dots are cleared", () => {
  const grid = mkGrid(["?....", ".S...", ".....", ".D.E.", "....."]);
  const ctx = makeBotContext();
  const state = mkState({ floor: grid, c: { wp: 40, maxWP: 40 } });

  const unseenDir = nearestUnseenDir(state);
  assert.ok(unseenDir);
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "move", dir: unseenDir });

  state.floor.g[3][1].feat = null; // the dot is cleared -> dotsRemaining is 0
  const exitDir = dirTowardExit(state);
  assert.ok(exitDir === "S" || exitDir === "E");
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "move", dir: exitDir });

  // Following dirTowardExit repeatedly reaches the exit within 6 steps.
  let steps = 0;
  let reached = false;
  const cur = state;
  while (steps < 6) {
    const dir = dirTowardExit(cur);
    if (!dir || !canStep(cur.floor, cur.floor.px, cur.floor.py, dir)) break;
    const [dx, dy] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[dir];
    cur.floor.px += dx;
    cur.floor.py += dy;
    steps++;
    if (cur.floor.g[cur.floor.py][cur.floor.px].feat === "exit") {
      reached = true;
      break;
    }
  }
  assert.ok(reached);
});

test("D-05: the exploration budget forces heading to the exit; observe resets/increments floorActions", () => {
  const grid = mkGrid(["?....", ".S...", ".....", ".D.E.", "....."]);
  const ctx = makeBotContext();
  const state = mkState({ floor: grid, c: { wp: 40, maxWP: 40 } });
  ctx.floorActions = ctx.opts.exploreBudget;

  const exitDir = dirTowardExit(state);
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "move", dir: exitDir });

  observe(ctx, [{ type: "floorChanged" }]);
  assert.strictEqual(ctx.floorActions, 0);
  observe(ctx, [{ type: "moved" }]);
  assert.strictEqual(ctx.floorActions, 1);
});

test("hazard routing: a seen climb/gorge/trap cell is routed around when a detour exists, crossed only when none does, and never avoided when unseen", () => {
  const detourGrid = mkGrid(["#####", "S.C.?", "....."]);
  assert.strictEqual(nearestUnseenDir({ floor: detourGrid }), "S");

  const blockedGrid = mkGrid(["#####", "S.C.?", "#####"]);
  assert.strictEqual(nearestUnseenDir({ floor: blockedGrid }), "E");

  const unseenHazardGrid = mkGrid(["#####", "S.C.?", "#####"]);
  unseenHazardGrid.g[1][2].seen = false;
  assert.strictEqual(nearestUnseenDir({ floor: unseenHazardGrid }), "E");
});

test("pending prompts: decline every Joiner, take/leave a find based on findFull, always leave a store", () => {
  const ctx = makeBotContext();

  const joinerState = mkState({ pendingJoiner: { name: "J" } });
  assert.deepStrictEqual(decideAction(joinerState, fixedPolicyRng, ctx), { type: "resolveJoiner", accept: false });

  const findState = mkState({ pendingFind: { n: "x" } });
  assert.deepStrictEqual(decideAction(findState, fixedPolicyRng, ctx), { type: "takeFind" });

  observe(ctx, [{ type: "bagFull" }]);
  assert.deepStrictEqual(decideAction(findState, fixedPolicyRng, ctx), { type: "leaveFind" });

  observe(ctx, [{ type: "findLeft" }]);
  assert.deepStrictEqual(decideAction(findState, fixedPolicyRng, ctx), { type: "takeFind" });

  const storeState = mkState({ store: {} });
  assert.deepStrictEqual(decideAction(storeState, fixedPolicyRng, ctx), { type: "leaveStore" });
});

test("D-20: forceParty forces exactly one member deterministically and never touches an untouched state", () => {
  const a = forceParty(newRun(7));
  const b = forceParty(newRun(7));
  assert.strictEqual(a.party.length, 1);
  assert.notStrictEqual(a.rngState, newRun(7).rngState);
  assert.strictEqual(a.party[0].name, b.party[0].name);
  assert.strictEqual(newRun(7).party.length, 0);
});

test("D-07: tallyEvents sums counters/damage and buckets encounters by depth band", () => {
  const t = makeTallies();
  const stateAtDepth12 = { combat: { foes: [{ alive: true, abilities: ["x"] }] }, floor: { depth: 12 } };
  tallyEvents(
    t,
    [
      { type: "foeCast" },
      { type: "foeBolted", dmg: 7 },
      { type: "foeBolted", dmg: 5, member: "M" },
      { type: "struckByFoe", dmg: 3 },
      { type: "foeSummoned", pending: true },
      { type: "foeSummoned", pending: false },
      { type: "heroResisted" },
      { type: "encounterStarted" },
    ],
    stateAtDepth12,
  );
  assert.strictEqual(t.foeCast, 1);
  assert.strictEqual(t.foeBolted, 2);
  assert.strictEqual(t.abilityDmg, 7);
  assert.strictEqual(t.meleeDmg, 3);
  assert.strictEqual(t.foeSummoned, 1);
  assert.strictEqual(t.heroResisted, 1);
  assert.strictEqual(t.encounters, 1);
  assert.strictEqual(t.casterEncounters, 1);
  assert.strictEqual(t.encountersByBand["11-20"], 1);

  assert.strictEqual(abilitySummary([{ tallies: t }]).abilityShare, 0.7);

  assert.deepStrictEqual(reachTable([{ deathDepth: 5 }, { deathDepth: 12 }, { deathDepth: 1 }, { deathDepth: 50 }]), {
    "5": 75,
    "10": 50,
    "20": 25,
    "30": 25,
    "50": 25,
  });
});

test("purity: decideAction never mutates its state argument; module source draws no Math.random/Date.now", () => {
  const ctx = makeBotContext();
  const combatFoe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const states = [
    mkState({ combat: { type: "Beasts", foes: [combatFoe], round: 1 }, c: { wp: 16, maxWP: 40 } }),
    mkState({ c: { wp: 16, maxWP: 40, potions: 1 } }),
    mkState({ c: { wp: 16, maxWP: 40, rations: 1 } }),
    mkState({}),
  ];
  for (const state of states) {
    const before = structuredClone(state);
    decideAction(state, fixedPolicyRng, ctx);
    assert.deepStrictEqual(state, before);
  }

  const src = fs.readFileSync(path.join(REPO_ROOT, "tools", "lib", "tuning-bot.mjs"), "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*\/\//.test(line));
  assert.ok(!codeLines.some((line) => /Math\.random|Date\.now/.test(line)));
});
