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
  actionsPerFloorDist,
  sharedJson,
  isTalkFirst,
  botLine,
  playRun,
  BOT_DEFAULTS,
} from "../../tools/lib/tuning-bot.mjs";
import { newRun } from "../../engine/engine.js";
import { SPELLS, RACES } from "../../content/index.js";
import { maxCharges } from "../../engine/movement.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";

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

test("HARN-02: Death gate — costs 25 wp, only cast when the post-cost wp stays above the flee line", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Sorcerer", level: 5, grimoire: ["Death"] });

  const fullWp = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 40, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(fullWp, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Death") });

  // 30 - 25 = 5, not > fleeThreshold(0.3) * maxWP(40) = 12 -> the engine
  // would refuse at wp<=26 anyway; chooseSpell must not even try.
  const tooWeak = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 30, maxWP: 40 } });
  assert.deepStrictEqual(decideAction(tooWeak, fixedPolicyRng, ctx), { type: "attack" });
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

test("HARN-02: disables score only at 2+ live foes; weaken is skipped once C.weakened is set", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Sorcerer", level: 2, grimoire: ["Stun", "Doze", "Weaken"] });

  const oneFoe = mkState({ combat: fight("Beasts", 1), c });
  assert.deepStrictEqual(decideAction(oneFoe, fixedPolicyRng, ctx), { type: "attack" });

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

  const noPotionsLowWp = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 15, maxWP: 40, potions: 0 } });
  assert.deepStrictEqual(decideAction(noPotionsLowWp, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Major Heal") });

  const withPotion = mkState({ combat: fight("Beasts", 1), c: { ...c, wp: 15, maxWP: 40, potions: 1 } });
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

test("HARN-02: Summon in combat — round 1, no ally yet, charges remain; Phantom Host follows the same rule", () => {
  const ctx = makeBotContext();
  const c = mu({ sub: "Summoner", level: 2, grimoire: ["Summon"] });

  const round1NoAlly = mkState({ combat: fight("Beasts", 1, 1, { ally: undefined }), c });
  assert.deepStrictEqual(decideAction(round1NoAlly, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Summon") });

  const round1WithAlly = mkState({ combat: fight("Beasts", 1, 1, { ally: { lvl: 2 } }), c });
  assert.deepStrictEqual(decideAction(round1WithAlly, fixedPolicyRng, ctx), { type: "attack" });

  const round2 = mkState({ combat: fight("Beasts", 1, 2), c });
  assert.deepStrictEqual(decideAction(round2, fixedPolicyRng, ctx), { type: "attack" });

  const illusionistPhantom = mkState({
    combat: fight("Beasts", 1, 1),
    c: mu({ sub: "Illusionist", level: 3, grimoire: ["Phantom Host"] }),
  });
  assert.deepStrictEqual(decideAction(illusionistPhantom, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Phantom Host") });
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

test("HARN-02: Bard sings on round 1 once ready; a level-1 song only does anything vs Beasts/Lair Beasts", () => {
  const ctx = makeBotContext();
  const bardC = { cls: "Fighter", sub: "Bard", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0 };

  const level1VsBeasts = mkState({ steps: 500, combat: fight("Beasts", 1, 1), c: bardC });
  assert.deepStrictEqual(decideAction(level1VsBeasts, fixedPolicyRng, ctx), { type: "sing" });

  const level1VsWalkingDead = mkState({ steps: 500, combat: fight("Walking Dead", 1, 1), c: bardC });
  assert.deepStrictEqual(decideAction(level1VsWalkingDead, fixedPolicyRng, ctx), { type: "attack" });

  const level2VsWalkingDead = mkState({ steps: 500, combat: fight("Walking Dead", 1, 1), c: { ...bardC, level: 2 } });
  assert.deepStrictEqual(decideAction(level2VsWalkingDead, fixedPolicyRng, ctx), { type: "sing" });

  const notReady = mkState({ steps: 500, combat: fight("Walking Dead", 1, 1), c: { ...bardC, level: 2, songAt: 450 } });
  assert.deepStrictEqual(decideAction(notReady, fixedPolicyRng, ctx), { type: "attack" });
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
    c: mu({ sub: "Wizard", level: 1, grimoire: ["Detect Magic", "Strength"], spellsUsed: 0 }),
  });
  const result = decideAction(withUtilitySpells, fixedPolicyRng, strikeBlockedCtx());
  assert.strictEqual(result.type, "castSpell");
  assert.ok([idx("Detect Magic"), idx("Strength")].includes(result.idx));

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

test("HARN-02: readScroll out of combat when canRead; a Pilfer never reads; no scrolls carried is a no-op", () => {
  const ctx = makeBotContext();

  const readerState = mkState({ c: mu({ sub: "Sorcerer", grimoire: [], scrolls: 1 }) });
  assert.deepStrictEqual(decideAction(readerState, fixedPolicyRng, ctx), { type: "readScroll" });

  const pilferState = mkState({ c: { cls: "Thief", sub: "Pilfer", scrolls: 1 } });
  assert.strictEqual(decideAction(pilferState, fixedPolicyRng, ctx).type, "move");

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
