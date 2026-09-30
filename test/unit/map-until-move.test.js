// test/unit/map-until-move.test.js
//
// Plan 76-06 (DARK-03), the user ruling of 2026-09-26 recorded in
// 76-CONTEXT.md "User rulings after planning": "revealing the dungeon spell
// should last only until you move. Then you lose focus and map stops being
// revealed."
//
// The rule: after a Map the Floor cast the whole floor stays shown while the
// hero stands still. The hero's FIRST step onto another square ends the
// window through the existing Phase 40 path (tickSquares -> the
// `spell:reveal` effect-to-null transition -> refogSpellSeen ->
// revealFaded), because the spell's window is now one square. Only movement
// ends it: engine/movement.js#move is the one tickSquares call site. A recast
// refreshes it, a relaunch keeps it, a scroll of Map the Floor follows the
// same rule, and an old save's longer window loads clamped to one square.
//
// The fixture helpers (fakeRng, fixedFloor, fixedChar, fixedState,
// countFlagged) are copied from test/unit/map-reveal.test.js, as that file
// copies its own from magic.test.js / movement.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, readScroll } from "../../engine/magic.js";
import { move } from "../../engine/movement.js";
import { GW, GH, reveal } from "../../engine/maze.js";
import { conditionsOf, revealRadius } from "../../engine/derived.js";
import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { playRun } from "../../tools/lib/tuning-bot.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(__dirname, "../../engine");
const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const MAP = SPELL_IDX["Map the Floor"];
const ONE_SQUARE = Object.freeze({ cadence: "squares", left: 1, phase: "effect" });
const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

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

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedChar(overrides = {}) {
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
  const { c: cOverrides, floor, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: floor || fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function countFlagged(floor) {
  let n = 0;
  for (const row of floor.g) for (const cell of row) if (cell.spellSeen) n++;
  return n;
}

const fadedIn = (events) => events.filter((e) => e.type === "revealFaded");

/**
 * castRun(seed) — a real newRun (seed 19 rolls a Human Sorcerer whose start
 * square opens only to the south), with Map the Floor and Strength in the
 * grimoire and a deep hp pool so no same-square fight ends the run. Casts
 * Map the Floor through applyAction and returns the post-cast state.
 */
function castRun(seed = 19) {
  const s = newRun(seed);
  s.c.grimoire = [...new Set([...(s.c.grimoire || []), "Map the Floor", "Strength"])];
  s.c.wp = s.c.maxWP = 5000;
  const r = applyAction(s, { type: "castSpell", idx: MAP });
  assert.ok(r.events.some((e) => e.type === "floorMapped"), "the cast lands");
  assert.deepStrictEqual(r.state.c.timers["spell:reveal"], ONE_SQUARE);
  return r.state;
}

/** The first direction from the hero's square onto an open, featureless, dry cell. */
function openDir(state) {
  const f = state.floor;
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const cell = f.g[f.py + dy]?.[f.px + dx];
    if (cell && !cell.wall && !cell.feat && !cell.water) return d;
  }
  throw new Error("no open neighbour");
}

/** The first direction from the hero's square into a wall. */
function wallDir(state) {
  const f = state.floor;
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const cell = f.g[f.py + dy]?.[f.px + dx];
    if (cell && cell.wall) return d;
  }
  throw new Error("no wall neighbour");
}

/** Asserts the window is still exactly as the cast left it. */
function assertWindowKept(state, flagged, label) {
  assert.deepStrictEqual(state.c.timers["spell:reveal"], ONE_SQUARE, `${label}: the record is untouched`);
  assert.equal(countFlagged(state.floor), flagged, `${label}: the flag count is untouched`);
}

/** Moves one step in the open direction via applyAction; asserts exactly one sweep. */
function stepSweepsOnce(state, label) {
  const r = applyAction(state, { type: "move", dir: openDir(state) });
  assert.ok(r.events.some((e) => e.type === "moved"), `${label}: the step happened`);
  assert.equal(fadedIn(r.events).length, 1, `${label}: the first step sweeps exactly once`);
  assert.equal("spell:reveal" in r.state.c.timers, false, `${label}: the record is gone`);
  assert.equal(countFlagged(r.state.floor), 0, `${label}: no cell keeps the flag`);
  return r.state;
}

/** A joined fight on the hero's own square (state.combat set, pending cleared). */
function joinFight(state, forced = null) {
  const s = structuredClone(state);
  const rng = makeRng(s.rngState);
  startCombat(s, false, forced, rng);
  s.rngState = rng.getState();
  return applyAction(s, { type: "fight" });
}

// --- the spell row ----------------------------------------------------------

test("Map the Floor row: kind reveal, a one-square window, niche sight, not combat-only; the txt tells the until-you-move truth", () => {
  const sp = SPELLS[MAP];
  assert.equal(sp.kind, "reveal");
  assert.equal(sp.squares, 1);
  assert.equal(sp.niche, "sight");
  assert.equal(sp.combatOnly, false);
  assert.ok(sp.txt.startsWith("sight · "), sp.txt);
  assert.match(sp.txt, /step/);
  assert.ok(sp.txt.length <= "sight · the whole floor · mapped for 40 squares, then the map forgets what it was told".length);
  assert.equal(/ wp\b/.test(sp.txt), false);
  assert.deepEqual(SPELLS.filter((s) => "squares" in s).map((s) => s.n), ["Map the Floor"]);
});

// --- the cast ---------------------------------------------------------------

test("cast: every unseen non-wall cell is marked seen+spellSeen, the record is one square, floorMapped is { type, cells }, zero rng draws", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  state.floor.g[2][2].wall = true;
  state.floor.g[3][3].seen = true;
  const events = castSpell(state, MAP, fakeRng([]), []);
  const fm = events.find((e) => e.type === "floorMapped");
  assert.deepStrictEqual(fm, { type: "floorMapped", cells: GW * GH - 2 });
  assert.equal(state.floor.g[2][2].seen, false);
  assert.equal("spellSeen" in state.floor.g[3][3], false);
  assert.equal(countFlagged(state.floor), GW * GH - 2);
  assert.deepStrictEqual(state.c.timers["spell:reveal"], ONE_SQUARE);
});

// --- the first step ends it -------------------------------------------------

test("first step: exactly one revealFaded re-fogging exactly the flags left before the sweep; walked and sight cells stay seen; a second step sweeps nothing", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] }, floor: fixedFloor({ px: 5, py: 5 }) });
  const radius = revealRadius(state);
  reveal(state.floor, radius); // the cast square's own sight, as in play
  castSpell(state, MAP, fakeRng([]), []);
  const preFlagged = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (state.floor.g[y][x].spellSeen) preFlagged.push([x, y]);

  const events = move(state, "E", fakeRng([]), []);
  const faded = fadedIn(events);
  assert.equal(faded.length, 1, "the first step sweeps once");
  const refogged = preFlagged.filter(([x, y]) => state.floor.g[y][x].seen === false).length;
  assert.equal(faded[0].cells, refogged, "the sweep re-fogs exactly the flags the step's own reveal left");
  assert.equal("spell:reveal" in state.c.timers, false);
  assert.equal(countFlagged(state.floor), 0);
  for (const [cx, cy] of [[5, 5], [6, 5]]) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (state.floor.g[y]?.[x]) assert.equal(state.floor.g[y][x].seen, true, `(${x},${y}) near (${cx},${cy}) stays seen`);
      }
    }
  }
  assert.equal(fadedIn(move(state, "E", fakeRng([]), [])).length, 0, "no second sweep");
});

test("first step on water (cost 2) ends the window too", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] }, floor: fixedFloor({ px: 5, py: 5 }) });
  state.floor.g[5][6].water = true;
  castSpell(state, MAP, fakeRng([]), []);
  const events = move(state, "E", fakeRng([]), []);
  assert.equal(fadedIn(events).length, 1);
  assert.equal("spell:reveal" in state.c.timers, false);
});

// --- only movement ends it --------------------------------------------------

test("same square keeps it: another spell, camping, a same-square fight, a flee attempt, a wall bump and a one-way refusal leave the window; then one step sweeps once", () => {
  const cast = castRun();
  const flagged = countFlagged(cast.floor);
  assert.ok(flagged > 0);

  // another non-combat spell
  const strength = applyAction(cast, { type: "castSpell", idx: SPELL_IDX.Strength });
  assert.ok(strength.events.some((e) => e.type === "strengthCast"), "Strength lands");
  assert.equal(fadedIn(strength.events).length, 0);
  assertWindowKept(strength.state, flagged, "Strength");

  // camping (with or without a wandering monster)
  const camp = applyAction(cast, { type: "camp" });
  assert.ok(camp.events.some((e) => e.type === "dayBegan"), "the camp happened");
  assert.equal(fadedIn(camp.events).length, 0);
  assertWindowKept(camp.state, flagged, "camp");

  // a fight on this square, fought to its end
  let f = joinFight(cast).state;
  assert.ok(f.combat, "the fight is up");
  for (let i = 0; i < 400 && f.combat && !f.dead; i++) {
    const r = applyAction(f, { type: "attack" });
    assert.equal(fadedIn(r.events).length, 0, "no round sweeps");
    f = r.state;
  }
  assert.equal(f.combat, null, "the fight ended");
  assert.equal(f.dead, false);
  assert.deepEqual([f.floor.px, f.floor.py], [cast.floor.px, cast.floor.py], "the fight never moved the hero");
  assertWindowKept(f, flagged, "fight");

  // a flee attempt
  const fl = applyAction(joinFight(cast).state, { type: "flee" });
  assert.equal(fadedIn(fl.events).length, 0);
  assertWindowKept(fl.state, flagged, "flee");

  // a wall bump
  const bump = applyAction(cast, { type: "move", dir: wallDir(cast) });
  assert.deepEqual([bump.state.floor.px, bump.state.floor.py], [cast.floor.px, cast.floor.py]);
  assertWindowKept(bump.state, flagged, "wall bump");

  // a one-way-door refusal
  const door = structuredClone(cast);
  const dir = openDir(door);
  const [dx, dy] = DIRV[dir];
  Object.assign(door.floor.g[door.floor.py + dy][door.floor.px + dx], { feat: "one", dir: OPPOSITE[dir] });
  const refused = applyAction(door, { type: "move", dir });
  assert.ok(refused.events.some((e) => e.type === "oneWayBlocked"));
  assertWindowKept(refused.state, flagged, "one-way refusal");

  // then the first real step sweeps, once
  for (const st of [strength.state, f, bump.state]) stepSweepsOnce(st, "after same-square actions");
});

test("tabs read, never tick: conditionsOf ten times leaves the state deep-equal", () => {
  const cast = castRun();
  const before = structuredClone(cast);
  for (let i = 0; i < 10; i++) conditionsOf(cast);
  assert.deepStrictEqual(cast, before);
});

// Phase 89 plan 05 (ITEM-07): before, movement.js held ONE tickSquares( call (the
// hero's); now it holds two, both inside move's one per-step tick block: the
// hero's and each Joiner's own item timers (`tickSquares(m, cost)`). Still the
// only file with one, still only on a step, and only movement ticks the
// `spell:reveal` window (a Joiner's timers never carry one).
test("one tick site: the only tickSquares( calls outside engine/effects.js are engine/movement.js's per-step tick, the hero's and each Joiner's", () => {
  const sites = [];
  for (const name of fs.readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".js") && f !== "effects.js")) {
    const src = fs
      .readFileSync(path.join(ENGINE_DIR, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const n = (src.match(/\btickSquares\s*\(/g) || []).length;
    if (n) sites.push([name, n]);
  }
  assert.deepEqual(sites, [["movement.js", 2]]);
});

// --- recast -----------------------------------------------------------------

test("recast: while open it keeps the one-square window and marks nothing twice; after the window closed it re-marks and reopens, and the next step sweeps", () => {
  const cast = castRun();
  const flagged = countFlagged(cast.floor);
  const camped = applyAction(cast, { type: "camp" }).state;
  const again = applyAction(camped, { type: "castSpell", idx: MAP });
  assert.equal(again.events.find((e) => e.type === "floorMapped").cells, 0);
  assertWindowKept(again.state, flagged, "recast while open");

  const stepped = stepSweepsOnce(cast, "first cast");
  const re = applyAction(stepped, { type: "castSpell", idx: MAP });
  assert.ok(re.events.find((e) => e.type === "floorMapped").cells > 0, "the re-fogged cells are marked again");
  assert.deepStrictEqual(re.state.c.timers["spell:reveal"], ONE_SQUARE);
  stepSweepsOnce(re.state, "after the recast");
});

// --- stairs -----------------------------------------------------------------

test("stairs: a step onto the exit sweeps before the descent; the new floor has no flag and no record", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] }, floor: fixedFloor({ px: 5, py: 5 }) });
  state.floor.g[5][6].feat = "exit";
  castSpell(state, MAP, fakeRng([]), []);
  const events = move(state, "E", makeRng(11), []);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("revealFaded"));
  assert.ok(types.includes("floorChanged"));
  assert.ok(types.indexOf("revealFaded") < types.indexOf("floorChanged"), "the sweep comes first");
  assert.equal(state.floor.depth, 2);
  assert.equal(countFlagged(state.floor), 0);
  assert.equal(state.c.timers && state.c.timers["spell:reveal"], undefined);
});

// --- scroll -----------------------------------------------------------------

test("scroll: a scroll that resolves Map the Floor opens the same one-square window, and the first step sweeps", () => {
  const state = fixedState({
    c: { cls: "Magic User", sub: "Sorcerer", grimoire: ["Map the Floor"], scrolls: 1 },
    floor: fixedFloor({ px: 5, py: 5 }),
  });
  const pickMap = (arr) => arr.find((sp) => sp.n === "Map the Floor");
  const events = readScroll(state, fakeRng([], { pick: pickMap }), []);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Map the Floor"));
  assert.ok(events.some((e) => e.type === "floorMapped"));
  assert.deepStrictEqual(state.c.timers["spell:reveal"], ONE_SQUARE);
  assert.equal(fadedIn(move(state, "E", fakeRng([]), [])).length, 1);
});

// --- relaunch ---------------------------------------------------------------

/** Every load chain the shell can take for `state`'s save. */
function loads(state) {
  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  return [check.value, rehydrate(JSON.parse(json)), rehydrate(validateSave(json).value)];
}

test("relaunch mid-window: the record and flags survive every load chain, and one move on the loaded state sweeps once", () => {
  const cast = castRun();
  const flagged = countFlagged(cast.floor);
  for (const st of loads(cast)) {
    assertWindowKept(st, flagged, "loaded");
    stepSweepsOnce(st, "after the relaunch");
  }
});

test("relaunch mid-window during a fight (76-03): the fight, record and flags survive; the fight ends on the square; the first step sweeps", () => {
  const cast = castRun();
  const flagged = countFlagged(cast.floor);
  const fought = applyAction(joinFight(cast).state, { type: "attack" }).state;
  assert.ok(fought.combat && !fought.dead, "the fight is still up");
  for (const st of loads(fought)) {
    assert.ok(st.combat, "the fight resumed");
    assertWindowKept(st, flagged, "loaded mid-fight");
    let q = st;
    for (let i = 0; i < 400 && q.combat && !q.dead; i++) q = applyAction(q, { type: "attack" }).state;
    assert.equal(q.combat, null);
    assertWindowKept(q, flagged, "fight finished after the relaunch");
    stepSweepsOnce(q, "after the resumed fight");
  }
});

// --- old saves --------------------------------------------------------------

test("old save: a stored 23-square window loads as one square in every chain, flags kept, and the first step sweeps", () => {
  const cast = castRun();
  const flagged = countFlagged(cast.floor);
  const old = structuredClone(cast);
  old.c.timers["spell:reveal"] = { cadence: "squares", left: 23, phase: "effect" };
  for (const st of loads(old)) {
    assertWindowKept(st, flagged, "clamped");
    stepSweepsOnce(st, "the clamped window");
  }
});

test("old save: a cooldown record, a left-0 record and a non-object record load without a throw and are left to the existing handling", () => {
  const cast = castRun();
  for (const rec of [
    { cadence: "squares", left: 5, phase: "cooldown" },
    { cadence: "squares", left: 0, phase: "effect" },
    "tampered",
    null,
    { cadence: "rounds", left: 9, phase: "effect" },
  ]) {
    const odd = structuredClone(cast);
    odd.c.timers["spell:reveal"] = rec;
    let states;
    assert.doesNotThrow(() => {
      states = loads(odd);
    }, `record ${JSON.stringify(rec)}`);
    for (const st of states) {
      const got = st.c.timers ? st.c.timers["spell:reveal"] : undefined;
      if (rec && typeof rec === "object" && rec.cadence === "squares") assert.deepStrictEqual(got, rec, "the clamp leaves a non-live record alone");
      assert.equal(countFlagged(st.floor), 0, "no live window: the stale flags are stripped");
    }
  }
});

// --- the chip ---------------------------------------------------------------

test("chip: the live window gives exactly { key: 'reveal', polarity: 'good' }; none before the cast or after the first step", () => {
  const s = newRun(19);
  assert.equal(conditionsOf(s).some((c) => c.key === "reveal"), false);
  const cast = castRun();
  assert.deepStrictEqual(conditionsOf(cast).find((c) => c.key === "reveal"), { key: "reveal", polarity: "good" });
  const stepped = stepSweepsOnce(cast, "chip");
  assert.equal(conditionsOf(stepped).some((c) => c.key === "reveal"), false);
});

// --- the bot plays the rule (no bot-code change) ----------------------------

test("bot: a forced Magic User run that casts Map the Floor closes every window on its next move; every live window has left 1", () => {
  // The PIN_RUNS "solo-magicuser-sorcerer" entry never casts Map the Floor
  // (0 floorMapped events, measured at the plan base 2a5bf95), so this case
  // pins its own seed: seed 3 is the smallest of seeds 1-20 whose forced
  // Human Sorcerer run (maxActions 400) casts it (3 casts, measured live).
  let windowOpen = false;
  let mapped = 0;
  let faded = 0;
  const lefts = new Set();
  playRun(3, { maxActions: 400, force: { cls: "Magic User", sub: "Sorcerer", race: "Human" } }, (events, state) => {
    const types = events.map((e) => e.type);
    mapped += types.filter((t) => t === "floorMapped").length;
    faded += types.filter((t) => t === "revealFaded").length;
    if (windowOpen && types.includes("moved")) assert.ok(types.includes("revealFaded"), `a move with a window open must sweep: ${types.join(",")}`);
    const rec = state.c.timers && state.c.timers["spell:reveal"];
    if (rec) lefts.add(rec.left);
    windowOpen = !!(rec && rec.phase === "effect" && rec.left > 0);
  });
  assert.ok(mapped >= 1, "non-vacuous: the run casts Map the Floor");
  assert.ok(faded >= 1, "non-vacuous: a window closes on a step");
  assert.deepEqual([...lefts], [1], "every live window the run holds has left 1");
});
