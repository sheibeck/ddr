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
  tallyUsage,
  abilitySummary,
  reachTable,
  actionsPerFloorDist,
  sharedJson,
  isTalkFirst,
  botLine,
  chooseSpell,
  playRun,
  expectedSpellDamage,
  BOT_DEFAULTS,
  BOT_TACTICS,
} from "../../tools/lib/tuning-bot.mjs";
import { newRun } from "../../engine/engine.js";
import { SPELLS, RACES } from "../../content/index.js";
import { maxCharges } from "../../engine/movement.js";
import { spellLevelSq } from "../../engine/derived.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

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
    ...rest,
  };
}

/** idx(name) — the SPELLS index for a spell by exact display name. */
function idx(name) {
  return SPELLS.findIndex((s) => s.n === name);
}

/**
 * mu(over) — a Magic User character sheet for HARN-02's chooseSpell/opener
 * tests. Defaults to a Sorcerer (broad "offense"-school access, no gates
 * beyond level) at level 1, empty grimoire, full wp — every field is
 * overridable per test.
 */
function mu(over = {}) {
  return {
    name: "T",
    race: "Human",
    cls: "Magic User",
    sub: "Sorcerer",
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
    ...over,
  };
}

/** fight(type, nFoes, round, extra) — a minimal state.combat with nFoes plain, alive, undamaged foes. */
function fight(type, nFoes, round = 1, extra = {}) {
  const foes = Array.from({ length: nFoes }, (_, i) => ({ name: `foe${i}`, alive: true, wp: 20, maxWP: 20 }));
  return { type, foes, round, target: 0, ...extra };
}

// CMB-01 (Phase 31): the bot presses Fight! like a player would — the very
// first check inside `if (state.combat)`, before any of the flee/parley/
// potion/sing/spell heuristics below even run.
test("CMB-01: decideAction returns {type:'fight'} whenever state.combat.pending is truthy, before any other combat heuristic", () => {
  const ctx = makeBotContext();
  const pendingState = mkState({ combat: fight("Beasts", 1, 1, { pending: true }), c: { wp: 5, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(pendingState, fixedPolicyRng, ctx), { type: "fight" });

  // A joined (non-pending) combat falls through to the ordinary heuristics.
  const joinedState = mkState({ combat: fight("Beasts", 1, 1, {}), c: { wp: 40, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(joinedState, fixedPolicyRng, ctx), { type: "attack" });
});

test("D-06: caster threshold raises flee/parley to 0.6 vs any kit-bearing live foe (0.4 otherwise) (USER RULING D)", () => {
  const ctx = makeBotContext();

  const casterFoe = { name: "x", alive: true, abilities: ["drudgeFreeze"], wp: 5, maxWP: 5 };
  const fleeState = mkState({ combat: { type: "Walking Dead", foes: [casterFoe], round: 1 }, c: { wp: 16, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(fleeState, fixedPolicyRng, ctx), { type: "flee" }); // Walking Dead: canParley false

  // USER RULING D (54-CONTEXT.md, 2026-09-21): wp:20/maxWP:40 = 0.5, clearly
  // above the new fleeThreshold (0.4) — the plain (non-caster) threshold's
  // "above" side.
  const plainFoe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const attackState = mkState({ combat: { type: "Walking Dead", foes: [plainFoe], round: 1 }, c: { wp: 20, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(attackState, fixedPolicyRng, ctx), { type: "attack" });

  // USER RULING D: wp:30/maxWP:40 = 0.75, clearly above the new
  // casterFleeThreshold (0.6) — the caster threshold's "above" side.
  const aboveCasterThresholdState = mkState({
    combat: { type: "Walking Dead", foes: [casterFoe], round: 1 },
    c: { wp: 30, maxWP: 40 },
  });
  assert.deepStrictEqual(decideAction(aboveCasterThresholdState, fixedPolicyRng, ctx), { type: "attack" });

  // D-12/Rule-1 bugfix (found during the BEFORE readout): parley()'s
  // wilmsryVsMagical branch REFUSES a fluency-2 Wilmsry vs a Magical foe
  // without ever setting C.parleyTried, so canParley stays true forever —
  // a bot that always prefers parley over flee would retry it every turn
  // for the rest of the fight. ctx.parleyBlocked (set by observe() on a
  // parleyRefused event) makes decideAction fall through to flee instead.
  //
  // Phase 38 (ABIL-02, Rule 1 fix): the Language skill is dropped outright,
  // so fluency(c) now maxes at 1 (a tongue-effect item alone) — a fluency-2
  // Wilmsry is structurally unreachable, and canParley's Magical branch
  // (which requires flu >= 2) is never true for ANY character anymore. This
  // scenario's Wilmsry (still planting a retired Language skill AND a tongue
  // item, both harmless no-ops now) therefore never even sees a "parley"
  // option — decideAction goes straight to "flee", with or without
  // ctx.parleyBlocked, since canParley is false from the very first check.
  const wilmsryC = {
    race: "Wilmsry", cls: "Fighter", sub: "Soldier", level: 1, wp: 8, maxWP: 40,
    potions: 0, rations: 0, spellsUsed: 0, grimoire: [], items: [{ eff: { tongue: 1 } }],
    skills: {}, gold: 0,
  };
  const magicalCombat = { type: "Magical", foes: [plainFoe], round: 1 };
  const wilmsryState = mkState({ combat: magicalCombat, c: wilmsryC });
  assert.deepStrictEqual(decideAction(wilmsryState, fixedPolicyRng, ctx), { type: "flee" });
  ctx.parleyBlocked = true;
  assert.deepStrictEqual(decideAction(wilmsryState, fixedPolicyRng, ctx), { type: "flee" });
});

test("D-05: potion in combat drinks below potionThreshold (0.6) when carried; flee still wins below fleeThreshold (0.4) (USER RULING D)", () => {
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

  // User rulings 2026-09-28 (re-pinned): a Freeze never kills outright any
  // more (its damage, then a d4 hold), so it scores in the DISABLE tier (230
  // offensive), not KILL (410) — [Freeze, Fireball] at level 3 now picks
  // Fireball's DAMAGE tier (300 + 15), the bot playing the new rule.
  const highLevelState = mkState({
    combat,
    c: { cls: "Magic User", sub: "Sorcerer", grimoire: ["Freeze", "Fireball"], level: 3, spellsUsed: 0, wp: 40, maxWP: 40, items: [] },
  });
  assert.deepStrictEqual(decideAction(highLevelState, fixedPolicyRng, ctx), { type: "castSpell", idx: fireballIdx });

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

test("USER RULING D: a pending Joiner is accepted when the party is empty and declined when full; take/leave a find based on findFull, always leave a store", () => {
  const ctx = makeBotContext();

  // D-20 superseded (54-CONTEXT.md, 2026-09-21): an empty party accepts.
  const emptyPartyJoinerState = mkState({ pendingJoiner: { name: "J" }, party: [] });
  assert.deepStrictEqual(decideAction(emptyPartyJoinerState, fixedPolicyRng, ctx), { type: "resolveJoiner", accept: true });

  // A party that already holds a member declines.
  const fullPartyJoinerState = mkState({ pendingJoiner: { name: "J" }, party: [{ name: "M" }] });
  assert.deepStrictEqual(decideAction(fullPartyJoinerState, fixedPolicyRng, ctx), { type: "resolveJoiner", accept: false });

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

test("HARN-02: Death gate — costs 25 wp, only cast when the post-cost wp stays above the flee line", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Sorcerer", level: 5, grimoire: ["Death"] });

  // USER RULING D (54-CONTEXT.md, 2026-09-21): fleeThreshold is now 0.4, so
  // the gate needs maxWP=100 headroom (wp-25 > 0.4*maxWP requires wp > 65 at
  // maxWP=100 — unreachable at maxWP=40 under the new threshold).
  const fullWp = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 100, maxWP: 100 } });
  assert.deepStrictEqual(decideAction(fullWp, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Death") });

  // 64 - 25 = 39, not > fleeThreshold(0.4) * maxWP(100) = 40 -> the engine
  // would refuse anyway; chooseSpell must not even try.
  const tooWeak = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 64, maxWP: 100 } });
  assert.deepStrictEqual(decideAction(tooWeak, fixedPolicyRng, ctx), { type: "attack" });
});

test("USER RULING D: chooseSpell defensive mode — below the potion threshold Heal outranks Fireball; at 2 live foes with no one-shot, a disable outranks damage; above threshold with 1 foe the damage pick is unchanged", () => {
  const ctx = makeBotContext();
  const base = { sub: "Sorcerer", level: 5 }; // Sorcerer's healing gate is 4 — level 5 clears it

  // (1) below the potion threshold (0.6): defensive mode re-ranks Heal (460 +
  // expected 5.5 = 465.5) above Fireball's unchanged damage score (300 + 15
  // = 315).
  const belowPotion = mkState({
    combat: fight("Beasts", 1),
    c: mu({ ...base, grimoire: ["Heal", "Fireball"], wp: 20, maxWP: 40, potions: 0 }),
  });
  assert.deepStrictEqual(decideAction(belowPotion, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Heal") });

  // (2) full wp, 2 live foes, no KILL-tier spell in the grimoire: defensive
  // mode (via the outnumbered-no-kill branch) re-ranks Stun (450) above
  // Fireball's unchanged damage score (315).
  const outnumberedNoKill = mkState({
    combat: fight("Beasts", 2),
    c: mu({ ...base, grimoire: ["Stun", "Fireball"], wp: 40, maxWP: 40, potions: 0 }),
  });
  assert.deepStrictEqual(decideAction(outnumberedNoKill, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Stun") });

  // (3) full wp, 1 live foe: offensive mode — Heal is not even castable
  // (its own gate requires wp/maxWP < potionThreshold), so Fireball is
  // picked exactly as the pre-existing DAMAGE-tier table always has.
  const aboveThreshold = mkState({
    combat: fight("Beasts", 1),
    c: mu({ ...base, grimoire: ["Heal", "Fireball"], wp: 40, maxWP: 40, potions: 0 }),
  });
  assert.deepStrictEqual(decideAction(aboveThreshold, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Fireball") });
});

test("HARN-02: DAMAGE-tier ordering — Mangle > Fireball(s) > Acid/Lightning > Ice, Lightning scales with live-foe count", () => {
  const ctx = makeBotContext();
  const base = { sub: "Sorcerer", level: 5 };

  const fullSet = mkState({
    combat: fight("Beasts", 1),
    c: mu({ ...base, grimoire: ["Mangle", "Lightning", "Fireball", "Acid", "Ice"] }),
  });
  assert.deepStrictEqual(decideAction(fullSet, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Mangle") });

  const lightningVsFireball1 = mkState({
    combat: fight("Beasts", 1),
    c: mu({ ...base, grimoire: ["Lightning", "Fireball"] }),
  });
  assert.deepStrictEqual(decideAction(lightningVsFireball1, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Fireball") });

  const lightningVsFireball3 = mkState({
    combat: fight("Beasts", 3),
    c: mu({ ...base, grimoire: ["Lightning", "Fireball"] }),
  });
  assert.deepStrictEqual(decideAction(lightningVsFireball3, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Lightning") });

  const acidVsIce = mkState({ combat: fight("Beasts", 1), c: mu({ ...base, grimoire: ["Acid", "Ice"] }) });
  assert.deepStrictEqual(decideAction(acidVsIce, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Acid") });

  const acidAlreadyTicking = mkState({
    combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 20, maxWP: 20, acid: { rounds: 3 } }] }),
    c: mu({ ...base, grimoire: ["Acid", "Ice"] }),
  });
  assert.deepStrictEqual(decideAction(acidAlreadyTicking, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Ice") });
});

test("Phase 42 (BAL-01 second half): a DOT (niche 'dot') is skipped when the target won't outlast the party's best castable burst, kept when it will", () => {
  const ctx = makeBotContext();
  const base = { sub: "Sorcerer", level: 5 };
  const grimoire = ["Fireball", "Acid"];
  // Fireball's expected damage is 15 (2d10+4) + the level-5 caster's level²
  // 25 = 40 (Phase 79.2-02 re-pin (traced: the bot scores level² spell damage, quick 260928-sq2); the boundary was 16/17 before);
  // BOT_TACTICS.dotToughMargin is 1, so bestBurstExpected(state)=40 makes the
  // skip threshold exactly 41 — a CLOSED boundary (<=, not <). Acid's own
  // plain score (343 = 300 + 9 x2 + 25) would otherwise outscore Fireball's
  // plain score (340), so this pair is chosen specifically because skipping
  // Acid actually FLIPS the winner, rather than merely removing an
  // already-losing option.
  assert.strictEqual(BOT_TACTICS.dotToughMargin, 1);

  const atBoundary = mkState({
    combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 41, maxWP: 41 }] }),
    c: mu({ ...base, grimoire }),
  });
  // 41 <= 40+1 -> Acid skipped; only Fireball scores (300+40=340, no finish
  // since 40 < 41) -> Fireball wins by elimination, not by raw score.
  assert.deepStrictEqual(decideAction(atBoundary, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Fireball") });

  const justOverBoundary = mkState({
    combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 42, maxWP: 42 }] }),
    c: mu({ ...base, grimoire }),
  });
  // 42 > 40+1 -> Acid is KEPT and outscores Fireball's plain 340 with its
  // own 343 (expected 9 x2 + 25) -> Acid wins.
  assert.deepStrictEqual(decideAction(justOverBoundary, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Acid") });
});

test("Phase 42 (BAL-01 second half): a burst spell (niche 'burst') expected to finish the target scores 350+expected, not 300+expected", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Sorcerer", level: 5, grimoire: ["Fireball"] });
  const fireballIdx = idx("Fireball");

  // Phase 79.2-02 re-pin (traced: the bot scores level² spell damage, quick 260928-sq2): Fireball's
  // expected is 15 (2d10+4) + the level-5 caster's 25 = 40 (was 15), so the
  // tough target is 50 wp (was 20) and the exact match 40 (was 15).
  const weakTarget = mkState({ combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 10, maxWP: 10 }] }), c });
  const finishPick = chooseSpell(weakTarget, ctx);
  assert.deepStrictEqual(finishPick, { idx: fireballIdx, tier: "damage", score: 390 }); // 350 + 40

  const toughTarget = mkState({ combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 50, maxWP: 50 }] }), c });
  const plainPick = chooseSpell(toughTarget, ctx);
  assert.deepStrictEqual(plainPick, { idx: fireballIdx, tier: "damage", score: 340 }); // 300 + 40

  // The finish threshold is CLOSED (>=, not >): expected 40 exactly equals
  // the target's wp -> still scores the finish bonus.
  const exactMatch = mkState({ combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 40, maxWP: 40 }] }), c });
  assert.deepStrictEqual(chooseSpell(exactMatch, ctx), { idx: fireballIdx, tier: "damage", score: 390 });
});

// Phase 90 plan 06 (SPELL-12): Lesser Summon is removed; the one summon spell is Summon, which a
// level-1 Summoner casts through the named exception (so the bot finds it castable at level 1) and
// a Wizard needs level 2 for.
test("Phase 42 (BAL-01 second half) + SPELL-12: Summon in combat — a level-1 Summoner's bot casts Summon; a level-1 Wizard's cannot, a level-2 Wizard's can", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Summoner", level: 1, grimoire: ["Summon"] });

  const level1 = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c });
  assert.deepStrictEqual(decideAction(level1, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });

  const level3 = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c: { ...c, level: 3 } });
  assert.deepStrictEqual(decideAction(level3, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });

  const wizard1 = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c: mu({ sub: "Wizard", level: 1, grimoire: ["Summon"] }) });
  assert.notDeepEqual(decideAction(wizard1, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });
  const wizard2 = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c: mu({ sub: "Wizard", level: 2, grimoire: ["Summon"] }) });
  assert.deepStrictEqual(decideAction(wizard2, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });
});

// Phase 90 plan 05 (SPELL-11), declared: Stun holds ONE foe now, so like Freeze's hold it is allowed against a
// lone foe (before: every disable, Stun included, needed 2+ live foes; the lone-foe case below was an attack).
// Doze, Weaken, Shrink and Stupidity keep the two-foe gate.
test("HARN-02: disables score only at 2+ live foes (Stun, a one-foe hold, excepted); weaken is skipped once C.weakened is set", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Sorcerer", level: 2, grimoire: ["Stun", "Doze", "Weaken"] });

  const oneFoe = mkState({ combat: fight("Beasts", 1), c });
  assert.deepStrictEqual(decideAction(oneFoe, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Stun") });
  const oneFoeNoStun = mkState({ combat: fight("Beasts", 1), c: { ...c, grimoire: ["Doze", "Weaken"] } });
  assert.deepStrictEqual(decideAction(oneFoeNoStun, fixedPolicyRng, ctx), { type: "attack" });

  const twoFoes = mkState({ combat: fight("Beasts", 2), c });
  assert.deepStrictEqual(decideAction(twoFoes, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Stun") });

  const weakenVsDoze = mkState({ combat: fight("Beasts", 2), c: { ...c, grimoire: ["Weaken", "Doze"] } });
  assert.deepStrictEqual(decideAction(weakenVsDoze, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Weaken") });

  const alreadyWeakened = mkState({
    combat: fight("Beasts", 2, 1, { weakened: true }),
    c: { ...c, grimoire: ["Weaken", "Doze"] },
  });
  assert.deepStrictEqual(decideAction(alreadyWeakened, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Doze") });
});

test("HARN-02: Heal fires below potionThreshold once potions run out; Major Heal outranks Heal", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Cleric", level: 3, grimoire: ["Heal", "Major Heal"] });

  // USER RULING D (54-CONTEXT.md, 2026-09-21): wp:20/maxWP:40 = 0.5 sits
  // between the new fleeThreshold (0.4, so flee never triggers) and the new
  // potionThreshold (0.6, so the heal/potion branches below still fire).
  const noPotionsLowWp = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 20, maxWP: 40, potions: 0 } });
  assert.deepStrictEqual(decideAction(noPotionsLowWp, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Major Heal") });

  const withPotion = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 20, maxWP: 40, potions: 1 } });
  assert.deepStrictEqual(decideAction(withPotion, fixedPolicyRng, ctx), { type: "drinkPotion" });

  const aboveHalf = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 30, maxWP: 40, potions: 0 } });
  assert.deepStrictEqual(decideAction(aboveHalf, fixedPolicyRng, ctx), { type: "attack" });
});

test("HARN-02: Mirror Self is a round-1 opener that precedes the KILL tier; skipped once already up or off round 1", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Illusionist", level: 1, grimoire: ["Mirror Self", "Freeze"] });

  // c.mirror lives on the CHARACTER (magic.js#castSpell sets `c.mirror`), not
  // on state.combat.
  const round1NoMirror = mkState({ combat: fight("Beasts", 1, 1), c: { ...c, mirror: 0 } });
  assert.deepStrictEqual(decideAction(round1NoMirror, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Mirror Self") });

  const round2 = mkState({ combat: fight("Beasts", 1, 2), c: { ...c, mirror: 0 } });
  assert.deepStrictEqual(decideAction(round2, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Freeze") });

  const round1AlreadyMirrored = mkState({ combat: fight("Beasts", 1, 1), c: { ...c, mirror: 3 } });
  assert.deepStrictEqual(decideAction(round1AlreadyMirrored, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Freeze") });
});

test("HARN-02: Shield/Bubble score a round-1 WARD-OPENER below every other tier, including KILL", () => {
  const ctx = makeBotContext();
  // c.ward lives on the CHARACTER (magic.js#castSpell sets `c.ward`), not on
  // state.combat.
  const clericC = mu({ sub: "Cleric", level: 1, grimoire: ["Shield", "Heal"], wp: 40, maxWP: 40, ward: null });

  const round1NoWard = mkState({ combat: fight("Beasts", 1, 1), c: clericC });
  assert.deepStrictEqual(decideAction(round1NoWard, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Shield") });

  const round2 = mkState({ combat: fight("Beasts", 1, 2), c: clericC });
  assert.deepStrictEqual(decideAction(round2, fixedPolicyRng, ctx), { type: "attack" });

  const round1WardUp = mkState({ combat: fight("Beasts", 1, 1), c: { ...clericC, ward: { pool: 50 } } });
  assert.deepStrictEqual(decideAction(round1WardUp, fixedPolicyRng, ctx), { type: "attack" });

  const sorcererShieldVsFreeze = mkState({
    combat: fight("Beasts", 1, 1),
    c: mu({ sub: "Sorcerer", level: 1, grimoire: ["Shield", "Freeze"], ward: null }),
  });
  assert.deepStrictEqual(decideAction(sorcererShieldVsFreeze, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Freeze") });
});

test("HARN-02: Summon in combat — round 1, no ally yet, charges remain (Phase 90 plan 06: Phantom Host is removed)", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Summoner", level: 2, grimoire: ["Summon"] });

  const round1NoAlly = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c });
  assert.deepStrictEqual(decideAction(round1NoAlly, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });

  const round1WithAlly = mkState({ combat: fight("Beasts", 1, 1, { ally: { lvl: 2 } }), c });
  assert.deepStrictEqual(decideAction(round1WithAlly, fixedPolicyRng, ctx), { type: "attack" });

  const round2 = mkState({ combat: fight("Beasts", 1, 2), c });
  assert.deepStrictEqual(decideAction(round2, fixedPolicyRng, ctx), { type: "attack" });
});

test("HARN-02: Summon out of combat — no pendingAlly and more than half of maxCharges left", () => {
  const ctx = makeBotContext();
  const grid = mkGrid(["?....", ".S...", ".....", ".....", "....."]);
  const base = mu({ sub: "Summoner", level: 2, grimoire: ["Summon"], spellsUsed: 0 });

  const plentyOfCharges = mkState({ floor: grid, c: base });
  assert.deepStrictEqual(decideAction(plentyOfCharges, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });

  // maxCharges(level 2) = 6; spellsUsed 3 -> chargesLeft 3, not > 3.
  const halfCharges = mkState({ floor: grid, c: { ...base, spellsUsed: 3 } });
  assert.strictEqual(decideAction(halfCharges, fixedPolicyRng, ctx).type, "move");

  const pendingAlly = mkState({ floor: grid, c: { ...base, pendingAlly: { lvl: 2 } } });
  assert.strictEqual(decideAction(pendingAlly, fixedPolicyRng, ctx).type, "move");
});

// Phase 91 (IDENT-17, plan 91-06): SING is once per fight and every song is a real
// spell, so the bot sings in EVERY fight as a Bard (no level or Beasts condition,
// no squares cooldown) and never again once it has. Rewritten from the old
// "a level-1 song only does anything vs Beasts" test.
test("HARN-02: a Bard sings once in every fight, at any level, against any type, and never again in that fight", () => {
  const ctx = makeBotContext();
  const bardC = { cls: "Fighter", sub: "Bard", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };

  const level1VsBeasts = mkState({ steps: 500, combat: fight("Beasts", 1, 1), c: bardC });
  assert.deepStrictEqual(decideAction(level1VsBeasts, fixedPolicyRng, ctx), { type: "sing" });

  const level1VsWalkingDead = mkState({ steps: 500, combat: fight("Walking Dead", 1, 1), c: bardC });
  assert.deepStrictEqual(decideAction(level1VsWalkingDead, fixedPolicyRng, ctx), { type: "sing" });

  const level2VsWalkingDead = mkState({ steps: 500, combat: fight("Walking Dead", 1, 1), c: { ...bardC, level: 2 } });
  assert.deepStrictEqual(decideAction(level2VsWalkingDead, fixedPolicyRng, ctx), { type: "sing" });

  const sung = mkState({ steps: 500, combat: { ...fight("Walking Dead", 1, 1), sang: true }, c: { ...bardC, level: 2 } });
  assert.deepStrictEqual(decideAction(sung, fixedPolicyRng, ctx), { type: "attack" }, "sung this fight -> back to striking");
});

test("HARN-02: talk-first identities try parley at round 1, once, before anything else", () => {
  const ctx = () => makeBotContext();

  const conArtist = { cls: "Thief", sub: "Con Artist", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };
  const round1Beasts = mkState({ combat: fight("Beasts", 1, 1), c: conArtist });
  assert.deepStrictEqual(decideAction(round1Beasts, fixedPolicyRng, ctx()), { type: "parley" });
  const round2Beasts = mkState({ combat: fight("Beasts", 1, 2), c: conArtist });
  assert.deepStrictEqual(decideAction(round2Beasts, fixedPolicyRng, ctx()), { type: "attack" });
  const blockedCtx = ctx();
  blockedCtx.parleyBlocked = true;
  assert.deepStrictEqual(decideAction(round1Beasts, fixedPolicyRng, blockedCtx), { type: "attack" });

  const woodsman = { cls: "Fighter", sub: "Woodsman", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Beasts", 1, 1), c: woodsman }), fixedPolicyRng, ctx()), { type: "parley" });
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Humans", 1, 1), c: woodsman }), fixedPolicyRng, ctx()), { type: "attack" });

  const bard = { cls: "Fighter", sub: "Bard", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };
  assert.deepStrictEqual(
    decideAction(mkState({ steps: 500, combat: fight("Humans", 1, 1), c: bard }), fixedPolicyRng, ctx()),
    { type: "parley" },
  ); // talk beats song

  const wilmsry = { race: "Wilmsry", cls: "Fighter", sub: "Soldier", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Humans", 1, 1), c: wilmsry }), fixedPolicyRng, ctx()), { type: "parley" });
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Magical", 1, 1), c: wilmsry }), fixedPolicyRng, ctx()), { type: "attack" });

  const elven = { race: "Elven", cls: "Fighter", sub: "Soldier", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Humans", 1, 1), c: elven }), fixedPolicyRng, ctx()), { type: "parley" });
  assert.deepStrictEqual(decideAction(mkState({ combat: fight("Demons", 1, 1), c: elven }), fixedPolicyRng, ctx()), { type: "attack" });
});

test("HARN-02: a Samurai never flees; a generically flee-blocked character fights instead", () => {
  const ctx = makeBotContext();
  const samuraiC = { cls: "Fighter", sub: "Samurai", level: 1, grimoire: [], wp: 8, maxWP: 52, potions: 0, rations: 0 };

  const vsPlain = mkState({ combat: fight("Walking Dead", 1, 1), c: samuraiC });
  assert.deepStrictEqual(decideAction(vsPlain, fixedPolicyRng, ctx), { type: "attack" });

  const vsCaster = mkState({
    combat: { type: "Walking Dead", foes: [{ name: "f", alive: true, wp: 20, maxWP: 20, abilities: ["x"] }], round: 1, target: 0 },
    c: samuraiC,
  });
  assert.deepStrictEqual(decideAction(vsCaster, fixedPolicyRng, ctx), { type: "attack" });

  const blockedCtx = makeBotContext();
  blockedCtx.fleeBlocked = true;
  const soldierC = { cls: "Fighter", sub: "Soldier", level: 1, grimoire: [], wp: 8, maxWP: 40, potions: 0, rations: 0 };
  const soldierState = mkState({ combat: fight("Beasts", 1, 1), c: soldierC });
  assert.deepStrictEqual(decideAction(soldierState, fixedPolicyRng, blockedCtx), { type: "attack" });
});

test("HARN-02: a strike-refused Wizard casts something else while charges remain, else flees (unless flee is also blocked)", () => {
  const strikeBlockedCtx = () => {
    const c = makeBotContext();
    c.strikeBlocked = true;
    return c;
  };
  const combat = fight("Beasts", 1, 1);

  const withUtilitySpells = mkState({
    combat,
    c: mu({ sub: "Wizard", level: 1, grimoire: ["Map the Floor", "Strength"], spellsUsed: 0 }),
  });
  const result = decideAction(withUtilitySpells, fixedPolicyRng, strikeBlockedCtx());
  assert.strictEqual(result.type, "castSpell");
  assert.ok([idx("Map the Floor"), idx("Strength")].includes(result.idx));

  const emptyGrimoire = mkState({ combat, c: mu({ sub: "Wizard", level: 1, grimoire: [], spellsUsed: 0 }) });
  assert.deepStrictEqual(decideAction(emptyGrimoire, fixedPolicyRng, strikeBlockedCtx()), { type: "flee" });

  const bothBlockedCtx = strikeBlockedCtx();
  bothBlockedCtx.fleeBlocked = true;
  assert.deepStrictEqual(decideAction(emptyGrimoire, fixedPolicyRng, bothBlockedCtx), { type: "attack" });

  // Once charges hit 0, playerStrike's Wizard refusal lifts on its own — the
  // guard requires chargesLeft > 0, so this falls straight through to attack.
  const mc = maxCharges({ level: 1, items: [] });
  const outOfCharges = mkState({ combat, c: mu({ sub: "Wizard", level: 1, grimoire: [], spellsUsed: mc }) });
  assert.deepStrictEqual(decideAction(outOfCharges, fixedPolicyRng, strikeBlockedCtx()), { type: "attack" });
});

test("HARN-02: observe sets fleeBlocked/strikeBlocked on refusal events, clears both (plus parleyBlocked) on encounterStarted", () => {
  const ctx = makeBotContext();
  observe(ctx, [{ type: "fleeRefused", reason: "samurai" }]);
  assert.strictEqual(ctx.fleeBlocked, true);
  observe(ctx, [{ type: "strikeRefused", reason: "wizard" }]);
  assert.strictEqual(ctx.strikeBlocked, true);
  ctx.parleyBlocked = true;
  observe(ctx, [{ type: "encounterStarted" }]);
  assert.strictEqual(ctx.fleeBlocked, false);
  assert.strictEqual(ctx.strikeBlocked, false);
  assert.strictEqual(ctx.parleyBlocked, false);
});

// RULES-10 (Phase 75.1): canRead is gone — the bot reads a carried scroll
// out of combat for EVERY class (a fumble there just fizzles, so it is safe
// for a non-Magic-User/non-Runes reader too); only "no scrolls carried"
// stays a no-op.
test("HARN-02: readScroll out of combat for every class; no scrolls carried is a no-op", () => {
  const ctx = makeBotContext();

  const readerState = mkState({ c: mu({ sub: "Sorcerer", grimoire: [], scrolls: 1 }) });
  assert.deepStrictEqual(decideAction(readerState, fixedPolicyRng, ctx), { type: "readScroll" });

  const pilferState = mkState({ c: { cls: "Thief", sub: "Pilfer", scrolls: 1 } });
  assert.deepStrictEqual(decideAction(pilferState, fixedPolicyRng, ctx), { type: "readScroll" });

  const noScrollsState = mkState({ c: mu({ sub: "Sorcerer", grimoire: [], scrolls: 0 }) });
  assert.strictEqual(decideAction(noScrollsState, fixedPolicyRng, ctx).type, "move");
});

test("HARN-02: isTalkFirst names the five identity talkers and nobody else", () => {
  const mk = (c, type) => ({ combat: { type, foes: [], round: 1 }, c });

  assert.strictEqual(isTalkFirst(mk({ sub: "Con Artist" }, "Beasts")), true);
  assert.strictEqual(isTalkFirst(mk({ sub: "Woodsman" }, "Beasts")), true);
  assert.strictEqual(isTalkFirst(mk({ sub: "Bard" }, "Humans")), true);
  assert.strictEqual(isTalkFirst(mk({ race: "Wilmsry" }, "Humans")), true);
  assert.strictEqual(isTalkFirst(mk({ race: "Elven" }, "Humans")), true);

  assert.strictEqual(isTalkFirst(mk({ sub: "Woodsman" }, "Humans")), false);
  assert.strictEqual(isTalkFirst(mk({ race: "Wilmsry" }, "Magical")), false);
  assert.strictEqual(isTalkFirst(mk({ sub: "Soldier", race: "Human" }, "Beasts")), false);
});

test("HARN-04: stuck is its own outcome bucket, excluded from the depth-stat readouts", () => {
  const r = playRun(1, { ...BOT_DEFAULTS, maxActions: 25 });
  assert.strictEqual(r.stuck, true);
  assert.strictEqual(r.outcome, "stuck");
  assert.strictEqual(r.cause, "maxActionsHit");
  assert.strictEqual(r.startDepth, 1);
  assert.strictEqual(r.floorsGained, r.state.floor.depth - 1);
  assert.ok(r.encountersSurvived <= r.tallies.encounters);

  const stuckRow = [{ stuck: true, deathDepth: 999, actionsPerFloor: 999 }];
  assert.deepStrictEqual(reachTable(stuckRow), { "5": 0, "10": 0, "20": 0, "30": 0, "50": 0 });
  assert.deepStrictEqual(actionsPerFloorDist(stuckRow), { min: 0, p50: 0, p90: 0, max: 0 });

  const sj = sharedJson([r], { ...BOT_DEFAULTS, maxActions: 25 });
  assert.strictEqual(sj.stuck, 1);
  assert.strictEqual(sj.completed, 0);
  assert.strictEqual(sj.bot.startDepth, 1);
});

test("HARN-04: playRun(seed, { startDepth }) is deterministic; startDepth:1/force:undefined matches the bare default", () => {
  for (const startDepth of [1, 20]) {
    const a = playRun(9, { ...BOT_DEFAULTS, startDepth, maxActions: 300 });
    const b = playRun(9, { ...BOT_DEFAULTS, startDepth, maxActions: 300 });
    assert.deepStrictEqual({ ...a, state: stripVolatileFields(a.state) }, { ...b, state: stripVolatileFields(b.state) });
    assert.strictEqual(a.startDepth, startDepth);
    if (startDepth === 20) {
      assert.ok(a.state.c.level === 5 || a.state.dead);
      assert.strictEqual(a.state.dev, true);
    }
  }

  const natural = playRun(9, { ...BOT_DEFAULTS, maxActions: 300 });
  const explicit = playRun(9, { ...BOT_DEFAULTS, startDepth: 1, force: undefined, maxActions: 300 });
  assert.deepStrictEqual(
    { ...natural, state: stripVolatileFields(natural.state) },
    { ...explicit, state: stripVolatileFields(explicit.state) },
  );
});

test("HARN-04: botLine emits the grep-stable Bot: line, appending seeds/workers/startDepth in order", () => {
  const plain = botLine({ ...BOT_DEFAULTS });
  assert.ok(plain.startsWith("Bot: exploreBudget=50  maxActions=20000  party=off"));
  assert.ok(plain.endsWith("  startDepth=1"));

  const withSeedsAndWorkers = botLine({ ...BOT_DEFAULTS, seeds: 40, workers: 4 });
  assert.ok(withSeedsAndWorkers.includes("  seeds=40  workers=4  startDepth=1"));
});

test("USER RULING D: playRun records cls/sub/race, one floorSnapshot per floor reached, and identity tallies (fights/rounds/dmgTaken/foeSwings/foeMisses/castsDefensive/castsOffensive/potionsUsed/backstabs/flees) — a seeded 200-action Thief run counts >= 1 backstab", () => {
  const result = playRun(1, { ...BOT_DEFAULTS, maxActions: 300, force: { cls: "Thief" } });

  assert.strictEqual(result.cls, "Thief");
  assert.strictEqual(typeof result.sub, "string");
  assert.strictEqual(typeof result.race, "string");

  assert.ok(Array.isArray(result.floorSnapshots));
  assert.ok(result.floorSnapshots.length >= 1);
  for (const snap of result.floorSnapshots) {
    assert.strictEqual(typeof snap.depth, "number");
    assert.strictEqual(typeof snap.level, "number");
    assert.strictEqual(typeof snap.gold, "number");
    assert.strictEqual(typeof snap.ar, "number");
    assert.strictEqual(typeof snap.weaponCost, "number");
    assert.strictEqual(typeof snap.maxWP, "number");
    assert.strictEqual(typeof snap.potions, "number");
    assert.strictEqual(typeof snap.afraidTriggers, "number");
    assert.strictEqual(typeof snap.diedAfraid, "boolean");
  }

  const id = result.identity;
  for (const k of ["fights", "rounds", "dmgTaken", "foeSwings", "foeMisses", "castsDefensive", "castsOffensive", "potionsUsed", "backstabs", "flees"]) {
    assert.strictEqual(typeof id[k], "number", `identity.${k} should be a number`);
  }
  assert.ok(id.backstabs >= 1, "a Thief run should count at least one backstab opener");
});

test("purity: decideAction never mutates its state argument; module source draws no Math.random/Date.now", () => {
  const ctx = makeBotContext();
  const combatFoe = { name: "x", alive: true, wp: 5, maxWP: 5 };
  const states = [
    mkState({ combat: { type: "Beasts", foes: [combatFoe], round: 1 }, c: { wp: 16, maxWP: 40 } }),
    mkState({ c: { wp: 16, maxWP: 40, potions: 1 } }),
    mkState({ c: { wp: 16, maxWP: 40, rations: 1 } }),
    mkState({}),
    // HARN-02: a caster combat state (chooseSpell's tiers all read `state`
    // and `state.c` without ever writing to them) and a Bard state (sing's
    // songReady/type gate).
    mkState({ combat: fight("Beasts", 2, 1), c: mu({ sub: "Sorcerer", level: 5, grimoire: ["Mangle", "Stun", "Heal"] }) }),
    mkState({ steps: 500, combat: fight("Beasts", 1, 1), c: { cls: "Fighter", sub: "Bard", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 } }),
    // Phase 42 (BAL-01 second half): a Fighter with abilities/timers in round
    // 2 — chooseAbility's own read-only policy (pickMemberAbility's mirror)
    // must never write to state.c.timers/state.combat either.
    mkState({
      combat: fight("Beasts", 1, 2),
      c: { cls: "Fighter", sub: "Knight", level: 1, wp: 40, maxWP: 40, potions: 0, rations: 0, abilities: ["kata", "brace"], timers: {} },
    }),
    // Phase 42 (BAL-01 second half): a Magic User out of combat, on an
    // unmapped floor (ctx.mappedDepth starts null), with a castable Map the
    // Floor and charges to spare — the field step reads `state`/`ctx` only.
    mkState({ c: mu({ sub: "Sorcerer", level: 1, grimoire: ["Map the Floor"], scrolls: 0 }) }),
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

test("Phase 41 (TERR-02): the bot paths across water and never stalls", () => {
  // (1) water is a non-feat cell property, so the bot's feat/wall-based BFS
  // routing (canStep/bfsFirstStep, keyed on .wall and HAZARD_FEATS by .feat)
  // never special-cases it — a fresh floor's routing directions must exist
  // exactly as they do on a floor with no water at all.
  for (let seed = 1; seed <= 20; seed++) {
    const state = newRun(seed);
    assert.ok(dirTowardExit(state) !== null, `seed ${seed}: dirTowardExit must find a direction`);
    assert.ok(nearestUnseenDir(state) !== null, `seed ${seed}: nearestUnseenDir must find a direction`);
  }

  // (2) water is passable (costs extra, never blocks) — a real playRun must
  // never report stuck, and at least one of these three runs must actually
  // cross a water cell (a "waded" event fires), proving the bot keeps
  // running INTO and THROUGH water rather than merely never encountering it.
  //
  // [Rule 1 deviation] maxActions measured, not hand-typed at the plan's own
  // literal 600: at 600 actions seed 2's run is still in progress (it dies
  // naturally to a Werebeast at action 623, never routing-stuck) — 600 would
  // report a false "stuck" purely from an undersized budget, not a real
  // stall. Measured against a live run (node -e against playRun): all three
  // seeds complete (die naturally) well under 1000 actions, so 1000 was the
  // smallest round budget that kept this a genuine stuck-vs-not-stuck proof
  // rather than a budget artifact.
  //
  // [Rule 1 deviation, Phase 42 (BAL-01 second half) fallout]: chooseAbility
  // now lets seed 2's Fighter survive longer (defensive/damage abilities
  // change the fight's length) — re-measured live: seed 2 now dies naturally
  // at action 1106, not <1000. 1000 would report a false "stuck" purely from
  // this plan's own legitimate behavior change, not a real routing stall.
  // 1500 is the smallest round budget that keeps every seed's die-naturally
  // outcome comfortably clear of the cap.
  //
  // [Rule 1 deviation, Phase 54 (BAND-02, USER RULING D) fallout]: the
  // identity-commit engine removes EVERY early-floor easing the retired
  // knot ladder used to supply (foeLevel now keys to depth alone, no grace
  // band) — seeds 2 and 3 now genuinely never resolve within any reasonable
  // action budget (re-measured live up to 20,000 actions: seed 3 sits stuck
  // at depth 4/day 9, never dying, never progressing meaningfully). This is
  // an expected consequence of landing at identity BEFORE 54-06/54-07's fit
  // — not a routing regression this file exists to catch. Seeds 1/4/5 all
  // die naturally AND cross water within the SAME 1500-action budget
  // (re-measured live), so this test keeps its real invariant (water never
  // blocks routing, the bot keeps running into and through it) on a seed
  // set the current identity-commit engine can actually resolve.
  //
  // [Rule 3 deviation, Phase 89 plan 06 (ITEM-07) fallout]: a Joiner now drinks
  // its own potions and uses its worn items in a fight, so seed 4's Joiner
  // keeps the run alive past its old death (action 894) to depth 8, where the
  // fair bot's camp gate (it reads only the HERO's appetite; makeCamp refuses
  // on the party's, the known seed-55434 stall documented in
  // tools/lib/days-farm.mjs) repeats a refused campFailed to maxActions: not a
  // water-routing stall (that run does wade). Measured live at
  // identity dials: seed 6 dies at action 322 and wades, like seeds 1 and 5,
  // so seed 6 takes seed 4's place. The bot's camp gate is left as it is (a
  // fair-bot policy call for the Phase 92 bot pass, logged in the 89-06
  // SUMMARY).
  let sawWaded = false;
  // [Phase 91 close, 2026-10-01]: seed 1 now loops campFailed (975 of 1500
  // actions; the same known fair-bot camp-gate stall, fixed in Phase 92), not
  // a water-routing stall. Measured under identity dials: seed 3 dies at
  // action 963 and wades, so seed 3 takes seed 1's place.
  // [Phase 92 plan 01, TUNE-10, 2026-10-01]: the camp gate reads nightlyEats now, so the
  // campFailed loop that swapped seed 4 (89-06) and seed 1 (Phase 91 close) out is gone at
  // its source. Measured live at identity dials, maxActions 1500: seed 1 dies at action 1216
  // (depth 10, day 17, wades, 0 campFailed), seed 4 dies at action 528 (depth 6, day 7, wades;
  // before the fix it stalled at depth 5 with 1032 campFailed events), seed 5 dies at action
  // 673. The pre-stall seeds [1, 4, 5] are restored; seeds 3 and 6 still die naturally (619 and
  // 322 actions) but are no longer needed.
  for (const seed of [1, 4, 5]) {
    const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 1500 }, (events) => {
      if (events.some((e) => e.type === "waded")) sawWaded = true;
    });
    assert.strictEqual(r.stuck, false, `seed ${seed}: the bot must not stall`);
    assert.notStrictEqual(r.outcome, "stuck", `seed ${seed}: outcome must not be stuck`);
  }
  assert.ok(sawWaded, "at least one of seeds 1-3 must cross a water cell (a waded event) within 1000 actions");
});

// Phase 79.2-02 pre-step (the bot scores level² spell damage): since quick
// 260928-sq2 the engine adds the caster's level² to spell damage
// (engine/derived.js#spellLevelSq). The bot's expected spell damage uses that
// same helper, so at levels 1, 3 and 5 Freeze scores d6 (3.5) + level² and
// Fireball 2d10+4 (15) + level²; Lightning adds it per foe, Fireballs once
// per foe struck, Acid and Ice on their first tick. Heals never add it.
test("expectedSpellDamage: Freeze and Fireball include the caster's level² at levels 1, 3 and 5", () => {
  const byName = (n) => SPELLS.find((sp) => sp.n === n);
  const freeze = byName("Freeze");
  const fireball = byName("Fireball");
  for (const level of [1, 3, 5]) {
    const caster = { level };
    assert.equal(spellLevelSq(caster), level * level);
    assert.equal(expectedSpellDamage(freeze, caster), 3.5 + level * level, `Freeze at level ${level}`);
    assert.equal(expectedSpellDamage(fireball, caster), 15 + level * level, `Fireball at level ${level}`);
  }
  const c3 = { level: 3 };
  assert.equal(expectedSpellDamage(byName("Lightning"), c3, 2), (11.5 + 9) * 2, "Lightning: level² per foe");
  assert.equal(expectedSpellDamage(byName("Fireballs"), c3, 1), 7.5 * 4.5 + 9, "Fireballs vs 1 foe: level² once");
  assert.equal(expectedSpellDamage(byName("Fireballs"), c3, 2), 7.5 * 4.5 + 9 * 1.875, "Fireballs vs 2 foes: level² per foe struck, E[min(2, d8)]");
  assert.equal(expectedSpellDamage(byName("Acid"), c3), 9 * 2 + 9, "Acid: level² on the first tick");
  // Phase 90 plan 05 (SPELL-12): Ice is the area freeze, scored per foe like Lightning (before: three scored tick rounds).
  assert.equal(expectedSpellDamage(byName("Ice"), c3), 5.5 + 9, "Ice vs 1 foe: d10 + level²");
  assert.equal(expectedSpellDamage(byName("Ice"), c3, 3), (5.5 + 9) * 3, "Ice: d10 + level² per foe, like Lightning");
});

// Phase 90 plan 05 (SPELL-11, SPELL-12): the bot plays the new rules.
test("chooseSpell: Ice is a DAMAGE-tier area spell scored per live foe (never a Freeze-style hold); it beats Fireball in a crowd and loses to it vs one foe", () => {
  const ctx = makeBotContext();
  const base = { sub: "Sorcerer", level: 3, grimoire: ["Fireball", "Ice"] };
  // tough foes (wp 100): no finishing Fireball, so the DAMAGE tier is ordered by expected damage alone
  const tough = (n) => fight("Beasts", n, 1, { foes: Array.from({ length: n }, (_, i) => ({ name: `foe${i}`, alive: true, wp: 100, maxWP: 100 })) });
  const crowd = mkState({ combat: tough(3), c: mu(base) });
  const pick = chooseSpell(crowd, ctx);
  assert.deepStrictEqual({ idx: pick.idx, tier: pick.tier }, { idx: idx("Ice"), tier: "damage" });
  assert.equal(pick.score, 300 + (5.5 + 9) * 3);
  const lone = mkState({ combat: fight("Beasts", 1), c: mu(base) });
  assert.equal(chooseSpell(lone, ctx).idx, idx("Fireball"));
  // Even with the Freeze rotation on, Ice scores as damage (its onHit flag is the area freeze, not a Freeze hold).
  const rotation = makeBotContext({ controlRotation: true });
  const rot = chooseSpell(mkState({ combat: tough(3), c: mu({ ...base, grimoire: ["Ice"] }) }), rotation);
  assert.deepStrictEqual({ idx: rot.idx, tier: rot.tier }, { idx: idx("Ice"), tier: "damage" });
});

test("chooseSpell: Stun is a single-target hold (allowed vs a lone foe, 230 offensive, skipped while the target is held); Doze is a multi-foe sleep that grows with the room and is skipped when everyone sleeps", () => {
  const ctx = makeBotContext();
  const stun = mu({ sub: "Sorcerer", level: 2, grimoire: ["Stun"] });
  const lone = chooseSpell(mkState({ combat: fight("Beasts", 1), c: stun }), ctx);
  assert.deepStrictEqual({ idx: lone.idx, tier: lone.tier, score: lone.score }, { idx: idx("Stun"), tier: "disable", score: 230 });
  const held = mkState({ combat: fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, wp: 20, maxWP: 20, held: { kind: "stunned", left: 2 } }] }), c: stun });
  assert.equal(chooseSpell(held, ctx), null, "a hold never shortens a longer one: do not re-stun a held target");

  const doze = mu({ sub: "Sorcerer", level: 2, grimoire: ["Doze"] });
  assert.equal(chooseSpell(mkState({ combat: fight("Beasts", 1), c: doze }), ctx), null, "Doze keeps the two-foe gate");
  // two or more live foes with no one-shot kill is the DEFENSIVE mode (the 430 band); the growth is the same either way
  const scores = [2, 3, 4, 6, 9].map((n) => chooseSpell(mkState({ combat: fight("Beasts", n), c: doze }), ctx).score);
  assert.deepStrictEqual(scores, [430, 431, 432, 434, 434], "the band stays 430-434 (below Shrink's 435), growing with the live foes, capped at +4");
  const asleep = mkState({
    combat: fight("Beasts", 2, 1, { foes: [{ name: "a", alive: true, wp: 20, maxWP: 20, asleep: 3 }, { name: "b", alive: true, wp: 20, maxWP: 20, asleep: 2 }] }),
    c: doze,
  });
  assert.equal(chooseSpell(asleep, ctx), null, "nothing left to put to sleep");
});

// ─── Phase 90 plan 10 (SPELL-10): the bot plays the new and reworked spells (pinned, never run) ───────────────────

/** foesOf(specs) — a fight whose foes carry lvl, wp, maxWP and any flags. */
function foesOf(specs, round = 1, extra = {}) {
  return {
    type: "Humans",
    foes: specs.map((s, i) => ({ name: `f${i}`, alive: true, lvl: 1, wp: 20, maxWP: 20, ...s })),
    round,
    target: 0,
    ...extra,
  };
}
const illusionist = (over = {}) => mu({ sub: "Illusionist", level: 5, wp: 40, maxWP: 40, ...over });

test("bot (90-10): Ice scores as area damage by the live foes and Doze by the room; neither is a plain single-target pick", () => {
  const ctx = makeBotContext();
  const base = { sub: "Wizard", level: 3 };
  const two = chooseSpell(mkState({ combat: foesOf([{}, {}]), c: mu({ ...base, grimoire: ["Ice"] }) }), ctx);
  const three = chooseSpell(mkState({ combat: foesOf([{}, {}, {}]), c: mu({ ...base, grimoire: ["Ice"] }) }), ctx);
  assert.deepStrictEqual({ tier: two.tier, idx: two.idx }, { tier: "damage", idx: idx("Ice") });
  assert.equal(two.score, 300 + (5.5 + 9) * 2);
  assert.equal(three.score, 300 + (5.5 + 9) * 3, "the area damage grows with each foe it reaches");
  const doze = mu({ ...base, grimoire: ["Doze"] });
  const dozeTwo = chooseSpell(mkState({ combat: foesOf([{}, {}]), c: doze }), ctx);
  const dozeFour = chooseSpell(mkState({ combat: foesOf([{}, {}, {}, {}]), c: doze }), ctx);
  assert.ok(dozeFour.score > dozeTwo.score, "Doze is valued by the live foes");
});

test("bot (90-10): Stun, Senseless and Duplicate Foe are aimed at the STRONGEST foe (the cast carries its index when it is not already the target) and skipped when it is already held or misdirected", () => {
  const ctx = makeBotContext();
  const crowd = (flags = {}) => foesOf([{ lvl: 1 }, { lvl: 4, ...flags }, { lvl: 2 }]);
  const stun = chooseSpell(mkState({ combat: crowd(), c: illusionist({ grimoire: ["Stun"] }) }), ctx);
  assert.deepStrictEqual({ idx: stun.idx, tier: stun.tier, target: stun.target }, { idx: idx("Stun"), tier: "disable", target: 1 });
  assert.equal(chooseSpell(mkState({ combat: crowd({ held: { kind: "stunned", left: 2 } }), c: illusionist({ grimoire: ["Stun"] }) }), ctx), null, "the strongest foe is held already");
  // when the strongest foe is already the current target no `target` rides on the pick (an unaimed cast)
  const same = chooseSpell(mkState({ combat: foesOf([{ lvl: 4 }, { lvl: 1 }]), c: illusionist({ grimoire: ["Stun"] }) }), ctx);
  assert.equal("target" in same, false);

  const dup = chooseSpell(mkState({ combat: crowd(), c: illusionist({ grimoire: ["Duplicate Foe"] }) }), ctx);
  assert.deepStrictEqual({ idx: dup.idx, tier: dup.tier, target: dup.target, score: dup.score }, { idx: idx("Duplicate Foe"), tier: "disable", target: 1, score: 455 });
  assert.equal(chooseSpell(mkState({ combat: crowd({ misdirect: { at: "self", left: 3 } }), c: illusionist({ grimoire: ["Duplicate Foe"] }) }), ctx), null);
  const alone = chooseSpell(mkState({ combat: foesOf([{ lvl: 5 }]), c: illusionist({ grimoire: ["Duplicate Foe"] }) }), ctx);
  assert.equal(alone.idx, idx("Duplicate Foe"), "Duplicate Foe works against a lone foe");
  assert.equal(alone.score, 240, "offensive band against one foe");

  const sense = illusionist({ grimoire: ["Senseless"] });
  assert.equal(chooseSpell(mkState({ combat: foesOf([{ lvl: 5 }]), c: sense }), ctx), null, "Senseless needs another foe to hit");
  const pair = chooseSpell(mkState({ combat: foesOf([{ lvl: 1 }, { lvl: 5 }]), c: sense }), ctx);
  assert.deepStrictEqual({ idx: pair.idx, target: pair.target, score: pair.score }, { idx: idx("Senseless"), target: 1, score: 445 });
  // decideAction dispatches the aimed cast with its target; the harness writes it (playRun) and sends the bare cast
  const aimed = decideAction(mkState({ combat: crowd(), c: illusionist({ grimoire: ["Stun"] }) }), fixedPolicyRng, ctx);
  assert.deepStrictEqual(aimed, { type: "castSpell", idx: idx("Stun"), target: 1 });
});

test("bot (90-10): Stop Time and Size of the Behemoth need THREE or more live foes and are skipped once in force on every one", () => {
  const ctx = makeBotContext();
  const book = illusionist({ grimoire: ["Stop Time"] });
  assert.equal(chooseSpell(mkState({ combat: foesOf([{}, {}]), c: book }), ctx), null, "two foes are not a crowd");
  const three = chooseSpell(mkState({ combat: foesOf([{}, {}, {}]), c: book }), ctx);
  assert.deepStrictEqual({ idx: three.idx, tier: three.tier }, { idx: idx("Stop Time"), tier: "disable" });
  const stopped = foesOf([{ held: { kind: "time", left: 2 } }, { held: { kind: "time", left: 2 } }, { held: { kind: "time", left: 2 } }]);
  assert.equal(chooseSpell(mkState({ combat: stopped, c: book }), ctx), null);
  const behemoth = illusionist({ grimoire: ["Size of the Behemoth"] });
  assert.equal(chooseSpell(mkState({ combat: foesOf([{}, {}]), c: behemoth }), ctx), null);
  assert.equal(chooseSpell(mkState({ combat: foesOf([{}, {}, {}]), c: behemoth }), ctx).idx, idx("Size of the Behemoth"));
  assert.equal(chooseSpell(mkState({ combat: foesOf([{ cowering: true }, { cowering: true }, { cowering: true }]), c: behemoth }), ctx), null);
  // both castable against a crowd: Stop Time's band is the higher
  const both = chooseSpell(mkState({ combat: foesOf([{}, {}, {}]), c: illusionist({ grimoire: ["Stop Time", "Size of the Behemoth"] }) }), ctx);
  assert.equal(both.idx, idx("Stop Time"));
});

test("bot (90-10): Enchant Character and Speed of Sound are round-1 buffs in a HARD fight, when not already live; never in round 2 or an easy fight", () => {
  const ctx = makeBotContext();
  const hard = (round = 1) => foesOf([{ lvl: BOT_TACTICS.hardFoeLvl }], round);
  const easy = foesOf([{ lvl: 1 }]);
  const wiz = mu({ sub: "Wizard", level: 5, grimoire: ["Enchant Character"] });
  const pick = chooseSpell(mkState({ combat: hard(), c: wiz }), ctx);
  assert.deepStrictEqual({ idx: pick.idx, tier: pick.tier, score: pick.score }, { idx: idx("Enchant Character"), tier: "buff", score: 445 });
  assert.equal(chooseSpell(mkState({ combat: hard(2), c: wiz }), ctx), null, "round 2");
  assert.equal(chooseSpell(mkState({ combat: easy, c: wiz }), ctx), null, "an easy fight");
  const live = { ...wiz, timers: { "spell:Enchant Character": { cadence: "squares", phase: "effect", left: 20 } } };
  assert.equal(chooseSpell(mkState({ combat: hard(), c: live }), ctx), null, "already live");
  const speed = mu({ sub: "Sorcerer", level: 5, grimoire: ["Speed of Sound"] });
  assert.equal(chooseSpell(mkState({ combat: hard(), c: speed }), ctx).idx, idx("Speed of Sound"));
});

test("bot (90-10): Stupidity, Fly and Open/Lock are never chosen, at any round, foe count or health (pinned)", () => {
  const ctx = makeBotContext();
  const book = ["Stupidity", "Fly", "Open/Lock"];
  for (const round of [1, 2, 5]) {
    for (const n of [1, 2, 3]) {
      for (const wp of [40, 10]) {
        const state = mkState({ combat: foesOf(Array.from({ length: n }, () => ({ lvl: 5 })), round), c: illusionist({ sub: "Illusionist", level: 5, wp, grimoire: [...book] }) });
        assert.equal(chooseSpell(state, ctx), null, `round ${round}, ${n} foes, wp ${wp}`);
      }
    }
  }
  const wiz = mu({ sub: "Wizard", level: 5, wp: 40, grimoire: ["Fly", "Open/Lock", "Stupidity"] });
  assert.deepStrictEqual(decideAction(mkState({ combat: foesOf([{}, {}]), c: wiz }), fixedPolicyRng, ctx), { type: "attack" });
});

test("bot (90-10): where its flee rule would flee, a castable Door Illusion is the escape; the cleverest foe seeing through it blocks the door for that encounter and the bot flees", () => {
  const ctx = makeBotContext();
  // Walking Dead: no parley, so the flee rule is the next step
  const fleeing = mkState({ combat: foesOf([{}, {}], 1, { type: "Walking Dead" }), c: illusionist({ level: 3, wp: 8, maxWP: 40, grimoire: ["Door Illusion"] }) });
  assert.deepStrictEqual(decideAction(fleeing, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Door Illusion") });
  // no charge: the ordinary flee
  const dry = mkState({ combat: foesOf([{}, {}], 1, { type: "Walking Dead" }), c: illusionist({ level: 3, wp: 8, maxWP: 40, grimoire: ["Door Illusion"], spellsUsed: 99 }) });
  assert.deepStrictEqual(decideAction(dry, fixedPolicyRng, ctx), { type: "flee" });
  // seen through: blocked for the encounter, then flee; a new encounter re-arms it
  observe(ctx, [{ type: "doorIllusionSeen", foe: "f0" }]);
  assert.equal(ctx.doorBlocked, true);
  assert.deepStrictEqual(decideAction(fleeing, fixedPolicyRng, ctx), { type: "flee" });
  observe(ctx, [{ type: "encounterStarted" }]);
  assert.equal(ctx.doorBlocked, false);
  assert.deepStrictEqual(decideAction(fleeing, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Door Illusion") });
  // not hurt enough to flee: no door
  const fine = mkState({ combat: foesOf([{}, {}], 1, { type: "Walking Dead" }), c: illusionist({ level: 3, wp: 40, maxWP: 40, grimoire: ["Door Illusion"] }) });
  assert.notEqual(decideAction(fine, fixedPolicyRng, ctx)?.idx, idx("Door Illusion"));
});

test("bot (90-10): where it would parley, a castable Chameleon Tongue is the better parley; a Magical room with the parley still open takes it too; the Walking Dead and a spent parley never do (the engine's own predicate guards the cast)", () => {
  const ctx = makeBotContext();
  const caster = (over = {}) => illusionist({ level: 3, wp: 8, maxWP: 40, grimoire: ["Chameleon Tongue"], ...over });
  // an Elven hero parleys Humans (the bot would parley), so it casts the Tongue instead
  const humans = mkState({ combat: foesOf([{}, {}], 1, { type: "Humans" }), c: caster({ race: "Elven" }) });
  assert.deepStrictEqual(decideAction(humans, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Chameleon Tongue") });
  // no charge: the ordinary parley
  const dry = mkState({ combat: foesOf([{}, {}], 1, { type: "Humans" }), c: caster({ race: "Elven", spellsUsed: 99 }) });
  assert.deepStrictEqual(decideAction(dry, fixedPolicyRng, ctx), { type: "parley" });
  // a plain Human hero could not parley Humans anyway: the bot's rule flees, it does not go looking for a parley
  const plain = mkState({ combat: foesOf([{}, {}], 1, { type: "Humans" }), c: caster() });
  assert.deepStrictEqual(decideAction(plain, fixedPolicyRng, ctx), { type: "flee" });
  // Magical foes: an ordinary parley is closed at fluency 0, the Tongue opens it
  const magical = mkState({ combat: foesOf([{}, {}], 1, { type: "Magical" }), c: caster() });
  assert.deepStrictEqual(decideAction(magical, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Chameleon Tongue") });
  // the Walking Dead never talk, and a spent parley is spent: the flee rule
  const dead = mkState({ combat: foesOf([{}, {}], 1, { type: "Walking Dead" }), c: caster() });
  assert.deepStrictEqual(decideAction(dead, fixedPolicyRng, ctx), { type: "flee" });
  const spent = mkState({ combat: foesOf([{}, {}], 1, { type: "Humans", parleyTried: true }), c: caster() });
  assert.deepStrictEqual(decideAction(spent, fixedPolicyRng, ctx), { type: "flee" });
});
