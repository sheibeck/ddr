// test/unit/teleport-pick.test.js
//
// Phase 91 plan 03 (IDENT-14, report #3: "I have a deserved illusionist. It
// says I choose where teleports takes me, but when I stepped on a teleport I
// didn't get to choose."). An Illusionist's teleport opens a PENDING PICK
// (`state.pendingTeleport = { x, y, depth }`, `teleportPickOffered`): nothing
// moves and no rng value is drawn until the player picks a reachable floor
// square the hero has already explored (`teleportPick { x, y }`) or lets it
// choose (`teleportPick { auto: true }`: today's automatic landing). While the
// pick is open every other action is held. A save mid-pick restores it. Every
// non-Illusionist teleport rolls exactly as before.
//
// ORCHESTRATOR AMENDMENT (user, 2026-09-30, "Explored squares only"): the pick
// lights and accepts only reachable floor squares the hero has already seen;
// fog stays fog; with none in reach the card offers only LET IT CHOOSE.

import test from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { newRun } from "../../engine/state.js";
import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import {
  TELEPORT_REACH,
  TELEPORT_DIRS,
  teleport,
  teleportTargets,
  autoTeleportLanding,
  resolveTeleportPick,
  bestTeleportDir,
} from "../../engine/movement.js";
import { goInsane } from "../../engine/encounters.js";
import { DIRECTION_TABLE } from "../../content/index.js";
import { rollGrimoire } from "../../engine/character.js";
import { SPELLS } from "../../content/index.js";
import { movementComparable, combatComparable, economyComparable } from "../parity/harness/comparables.js";
import { decideAction } from "../../tools/lib/tuning-bot.mjs";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

// ---------------------------------------------------------------- helpers

const wallGrid = () => Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({ wall: true, seen: false, feat: null })));
const openCell = (g, x, y, extra = {}) => {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
};
/** Opens (and marks explored) every square of the 1..GW-2 / 1..GH-2 room. */
function openRoom(g, { seen = true } = {}) {
  for (let y = 1; y <= GH - 2; y++) for (let x = 1; x <= GW - 2; x++) openCell(g, x, y, { seen });
}

/** An Illusionist (or another sub) standing at (px, py) on a hand-built floor. */
function standing({ px = 7, py = 10, sub = "Illusionist", cls = "Magic User", room = true, seed = 3 } = {}) {
  const state = newRun(seed, [], { force: { cls, sub } });
  const g = wallGrid();
  if (room) openRoom(g);
  state.floor = { g, px, py, depth: 1 };
  state.combat = null;
  return state;
}

/** A step onto a teleport tile: the hero stands at (px, py) and the tele sits one square north. */
function onTeleTile(opts = {}) {
  const state = standing(opts);
  const f = state.floor;
  openCell(f.g, f.px, f.py - 1, { feat: "tele", seen: true });
  openCell(f.g, f.px, f.py, { seen: true });
  return state;
}

const cursor = (x) => x >>> 0;

/** A fake rng that counts draws and throws if more than `seq` are taken. */
function fakeRng(seq = []) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng exhausted at draw ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    next: () => 0,
    shuffle: (a) => a,
    getState: () => 0,
    get draws() {
      return i;
    },
  };
}

/** Opens a pick: step onto the tele tile. */
function openPick(opts) {
  const state = onTeleTile(opts);
  const out = applyAction(state, { type: "move", dir: "N" });
  return { before: state, state: out.state, events: out.events };
}

// ---------------------------------------------------------------- opens

test("Open: an Illusionist stepping onto a teleport gets a pending pick, no move and no draw", () => {
  const { before, state, events } = openPick({ px: 7, py: 10 });
  assert.deepStrictEqual(state.pendingTeleport, { x: 7, y: 9, depth: 1 }, "the record is where the hero stands");
  assert.equal(state.floor.px, 7);
  assert.equal(state.floor.py, 9, "the step onto the tile is the only move");
  assert.equal(cursor(state.rngState), cursor(before.rngState), "the teleport draws nothing");
  assert.equal(events.some((e) => e.type === "teleported"), false, "nothing is resolved yet");
  const offer = events.find((e) => e.type === "teleportPickOffered");
  assert.ok(offer, "teleportPickOffered is pushed");
  assert.equal(offer.count, teleportTargets(state).length);
  const auto = autoTeleportLanding(state);
  assert.deepStrictEqual(offer.auto, { x: auto.x, y: auto.y });
});

test("Open: every live caller of teleport() opens the same pick (a tele tile resumed after a fight, insanity)", () => {
  // The encounter tables no longer hold a Teleport result (E1, content/encounters.js), so the
  // live callers are a tele tile (move above, or resumed by resolvePendingTile) and goInsane.
  const resumed = onTeleTile();
  resumed.floor.py -= 1; // stand on the tele tile itself
  resumed.pendingTile = { x: resumed.floor.px, y: resumed.floor.py, depth: 1 };
  const out = applyAction(resumed, { type: "loseTurn" });
  assert.ok(out.events.some((e) => e.type === "tileResumed"), "the interrupted tile resumed");
  assert.ok(out.state.pendingTeleport, "the resumed teleport opened the pick");
  assert.equal(cursor(out.state.rngState), cursor(resumed.rngState), "and drew nothing");

  const viaInsanity = onTeleTile();
  const rng2 = fakeRng([3]); // INSANITY d6 = 3: a teleport
  const ev2 = goInsane(viaInsanity, rng2, []);
  assert.equal(rng2.draws, 1, "only the insanity roll itself");
  assert.ok(viaInsanity.pendingTeleport, "the insanity teleport opened the pick");
  assert.ok(ev2.some((e) => e.type === "teleportPickOffered"));
});

// ---------------------------------------------------------------- targets

test("Targets: the eight rays, nearest first, N NE E SE S SW W NW, never the hero's own square, never off the map", () => {
  assert.deepStrictEqual(Object.keys(TELEPORT_DIRS), ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  assert.equal(TELEPORT_REACH, 12, "the reach stays 12");
  const state = standing({ px: 7, py: 10 });
  const targets = teleportTargets(state);
  // the east ray from (7, 10) holds exactly 12 squares (x 8..19), nearest first
  const east = targets.filter((t) => t.dir === "E");
  assert.deepStrictEqual(east.map((t) => t.x), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.ok(east.every((t) => t.y === 10));
  assert.deepStrictEqual(east.map((t) => t.dist), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  // direction groups appear in the ruled order
  const seenOrder = [...new Set(targets.map((t) => t.dir))];
  assert.deepStrictEqual(seenOrder, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  // a diagonal counts one square a step
  const ne = targets.filter((t) => t.dir === "NE");
  assert.deepStrictEqual(ne[0], { x: 8, y: 9, dir: "NE", dist: 1 });
  // the hero's own square is never listed, nothing is off the map
  assert.ok(!targets.some((t) => t.x === 7 && t.y === 10));
  assert.ok(targets.every((t) => t.x >= 1 && t.y >= 1 && t.x <= GW - 2 && t.y <= GH - 2));
  // no ray runs past 12
  assert.ok(targets.every((t) => t.dist >= 1 && t.dist <= TELEPORT_REACH));
});

test("Targets: a wall on a ray is skipped but squares beyond it on the same ray stay listed", () => {
  const state = standing({ px: 7, py: 10 });
  openCell(state.floor.g, 10, 10, { seen: true });
  state.floor.g[10][10].wall = true;
  const east = teleportTargets(state).filter((t) => t.dir === "E").map((t) => t.x);
  assert.ok(!east.includes(10), "the wall square is not listed");
  assert.ok(east.includes(11) && east.includes(19), "squares beyond the wall stay listed");
});

test("Targets (explored squares only): fog stays fog - an unexplored floor square is not listed, and nothing is revealed", () => {
  const state = standing({ px: 7, py: 10 });
  const g = state.floor.g;
  openRoom(g, { seen: false });
  g[10][8].seen = true; // one explored square, east
  g[10][9].seen = true;
  const before = JSON.stringify(g);
  const targets = teleportTargets(state);
  assert.deepStrictEqual(targets.map((t) => [t.x, t.y]).sort(), [[8, 10], [9, 10]]);
  assert.equal(JSON.stringify(g), before, "listing the targets reveals nothing");
  // an explored but unreachable square (off every ray) is not listed either
  g[3][15].seen = true; // dx 8, dy -7: on no ray from (7, 10)
  assert.equal(teleportTargets(state).length, 2);
});

test("Edge (fog only): with no explored square in reach the pick still opens and offers only LET IT CHOOSE", () => {
  const state = onTeleTile();
  openRoom(state.floor.g, { seen: false });
  openCell(state.floor.g, 7, 9, { feat: "tele", seen: false });
  const out = applyAction(state, { type: "move", dir: "N" });
  // the step reveals radius 2 around the new square, so clear that again to model "nothing explored in reach"
  assert.ok(out.state.pendingTeleport, "the pick opens even when the explored list could be empty");
  const offer = out.events.find((e) => e.type === "teleportPickOffered");
  assert.equal(offer.count, teleportTargets(out.state).length);
  // force the empty case directly and answer with LET IT CHOOSE
  const g = out.state.floor.g;
  for (const row of g) for (const cell of row) cell.seen = false;
  const s2 = structuredClone(out.state);
  assert.equal(teleportTargets(s2).length, 0);
  const landed = applyAction(s2, { type: "teleportPick", auto: true });
  assert.ok(landed.events.some((e) => e.type === "teleported" && e.auto === true));
  assert.equal(landed.state.pendingTeleport, undefined);
});

// ---------------------------------------------------------------- pick

test("Pick: teleportPick on a listed diagonal square lands there through the one landing function", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const target = teleportTargets(state).find((t) => t.dir === "NE" && t.dist === 3);
  assert.ok(target, "a NE square three away is listed");
  const before = structuredClone(state);
  const out = applyAction(state, { type: "teleportPick", x: target.x, y: target.y });
  assert.equal(out.state.floor.px, target.x);
  assert.equal(out.state.floor.py, target.y);
  assert.equal(out.state.pendingTeleport, undefined, "the pick is cleared");
  const ev = out.events.find((e) => e.type === "teleported");
  assert.ok(ev, "teleported is pushed");
  assert.equal(ev.picked, true);
  assert.equal(ev.auto, undefined);
  assert.equal(ev.dir, "NE");
  assert.equal(ev.dist, 3);
  assert.equal(ev.travelled, 3);
  assert.deepStrictEqual(ev.to, { x: target.x, y: target.y });
  assert.equal(cursor(out.state.rngState), cursor(before.rngState), "a plain landing draws nothing");
});

test("Pick: the landing square's encounter resolves as a normal landing does", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const target = teleportTargets(state).find((t) => t.dir === "E" && t.dist === 4);
  state.floor.g[target.y][target.x].feat = "dot";
  const out = applyAction(state, { type: "teleportPick", x: target.x, y: target.y });
  assert.ok(out.events.some((e) => e.type === "teleported" && e.picked === true));
  assert.ok(out.events.some((e) => e.type === "encounterRolled"), "the dot on the landing square rolls its encounter");
  assert.equal(out.state.floor.g[target.y][target.x].feat, null);
});

test("Pick: the picked landing reveals the neighbourhood of the square, like any landing", () => {
  const { state } = openPick({ px: 7, py: 10 });
  for (const row of state.floor.g) for (const cell of row) cell.seen = false;
  const keep = teleportTargets(state);
  assert.equal(keep.length, 0);
  // explore one far square, pick it, and the area around the landing is revealed
  state.floor.g[9][15].seen = true; // the hero stands at (7, 9): this square is east, 8 away
  const out = applyAction(state, { type: "teleportPick", x: 15, y: 9 });
  assert.ok(out.events.some((e) => e.type === "teleported" && e.picked === true));
  assert.ok(out.state.floor.g[9][16].seen && out.state.floor.g[8][15].seen);
});

// ---------------------------------------------------------------- LET IT CHOOSE

test("LET IT CHOOSE: lands exactly where the old automatic Illusionist teleport landed, with auto: true and no draws", () => {
  // the pre-plan scenario: a long clear run east from (5, 5); the best direction is E, a fixed 12
  const state = standing({ px: 5, py: 5, room: false });
  const g = state.floor.g;
  openCell(g, 5, 5, { seen: true });
  for (let x = 6; x <= 17; x++) openCell(g, x, 5);
  assert.equal(bestTeleportDir(state), "E");
  const rng = fakeRng([]); // the pick must draw nothing
  const events = teleport(state, rng, []);
  assert.deepStrictEqual(state.pendingTeleport, { x: 5, y: 5, depth: 1 });
  assert.equal(rng.draws, 0, "opening the pick draws nothing");
  assert.equal(state.floor.px, 5, "nothing moved");
  const offer = events.find((e) => e.type === "teleportPickOffered");
  assert.deepStrictEqual(offer.auto, { x: 17, y: 5 });
  const evs = resolveTeleportPick(state, { auto: true }, rng, []);
  assert.equal(rng.draws, 0, "LET IT CHOOSE draws nothing before the landing square resolves");
  assert.equal(state.floor.px, 17, "travelled the fixed 12 squares east");
  assert.equal(state.floor.py, 5);
  const ev = evs.find((e) => e.type === "teleported");
  assert.equal(ev.auto, true);
  assert.equal(ev.picked, undefined);
  assert.equal(ev.dist, 12);
  assert.equal(ev.used, "E");
  assert.equal(ev.travelled, 12);
  assert.equal(state.pendingTeleport, undefined);
});

// ---------------------------------------------------------------- refusals

test("Refusals: an unlisted square, a non-integer, a string and no pending pick are named, draw nothing and move nothing", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const pending = structuredClone(state.pendingTeleport);
  const cases = [
    [{ type: "teleportPick", x: 7, y: 9 }, "notATarget"], // the hero's own square
    [{ type: "teleportPick", x: 3, y: 4 }, "notATarget"], // on no ray
    [{ type: "teleportPick", x: 12.5, y: 3 }, "notATarget"],
    [{ type: "teleportPick", x: "12", y: 3 }, null], // invalid on the wire: held like any bad action
  ];
  for (const [action, reason] of cases) {
    const out = applyAction(state, action);
    if (reason === null) {
      assert.equal(validateAction(action).ok, false, "a string coordinate is not a wire-legal pick");
      assert.equal(out.state, state);
      assert.deepStrictEqual(out.events, []);
      continue;
    }
    assert.deepStrictEqual(out.events, [{ type: "teleportPickRefused", reason }], JSON.stringify(action));
    assert.equal(cursor(out.state.rngState), cursor(state.rngState), "no draw");
    assert.equal(out.state.floor.px, state.floor.px);
    assert.equal(out.state.floor.py, state.floor.py);
    assert.deepStrictEqual(out.state.pendingTeleport, pending, "the pick is still pending");
  }
  // an integer square on no ray is not a target either (the hero stands at (7, 9))
  const far = applyAction(state, { type: "teleportPick", x: 19, y: 10 });
  assert.equal(far.events[0].type, "teleportPickRefused");

  // with no pick pending
  const idle = standing();
  const none = applyAction(idle, { type: "teleportPick", x: 8, y: 10 });
  assert.deepStrictEqual(none.events, [{ type: "teleportPickRefused", reason: "none" }]);
  assert.equal(cursor(none.state.rngState), cursor(idle.rngState));
  assert.equal(none.state.floor.px, idle.floor.px);
});

test("Refusals: a stale record (the hero is elsewhere) is cleared and refused as stale", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const s = structuredClone(state);
  s.pendingTeleport = { x: 1, y: 1, depth: 1 };
  const out = applyAction(s, { type: "teleportPick", auto: true });
  assert.deepStrictEqual(out.events, [{ type: "teleportPickRefused", reason: "stale" }]);
  assert.equal(out.state.pendingTeleport, undefined);
});

test("Edge (encoding): reach is squares along a ray, and a pick matches by exact integer { x, y } equality only", () => {
  const { state } = openPick({ px: 7, py: 10 }); // the hero now stands at (7, 9)
  // 12 squares east is listed; 13 is off the ray's reach even though the floor is open there
  const e12 = teleportTargets(state).filter((t) => t.dir === "E");
  assert.equal(Math.max(...e12.map((t) => t.dist)), 12);
  // a diagonal step counts as one square: the farthest NE square is 12 diagonal steps (or the map edge)
  const ne = teleportTargets(state).filter((t) => t.dir === "NE");
  assert.ok(ne.every((t) => t.x - 7 === t.dist && 9 - t.y === t.dist));
  // 12.0 is the integer 12 in JS; a fractional or string coordinate never matches
  const ok = teleportTargets(state)[0];
  assert.equal(applyAction(state, { type: "teleportPick", x: ok.x + 0.0001, y: ok.y }).events[0].reason, "notATarget");
  assert.equal(validateAction({ type: "teleportPick", x: String(ok.x), y: ok.y }).ok, false);
  assert.equal(validateAction({ type: "teleportPick", x: NaN, y: 3 }).ok, false);
  assert.equal(validateAction({ type: "teleportPick" }).ok, false);
  assert.equal(validateAction({ type: "teleportPick", auto: "yes" }).ok, false, "auto must be strictly true");
  assert.equal(validateAction({ type: "teleportPick", auto: true }).ok, true);
  assert.equal(validateAction({ type: "teleportPick", x: 8, y: 10 }).ok, true);
});

// ---------------------------------------------------------------- hold

test("Hold: while a pick is pending every other action returns the SAME state and no events", () => {
  const { state } = openPick({ px: 7, py: 10 });
  for (const action of [
    { type: "move", dir: "E" },
    { type: "camp" },
    { type: "drinkPotion" },
    { type: "useItem", i: 0 },
    { type: "attack" },
    { type: "castSpell", idx: 0 },
    { type: "abandon" },
  ]) {
    const out = applyAction(state, action);
    assert.equal(out.state, state, `${action.type}: the same state object`);
    assert.deepStrictEqual(out.events, [], `${action.type}: no events`);
  }
  assert.equal(state.acts, 1, "acts did not move (the step that opened the pick counted once)");
});

// ---------------------------------------------------------------- save / load

test("Save: a mid-pick save restores the pending pick through both load chains, never resolving or re-rolling", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const json = JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true, check.reason);
  assert.deepStrictEqual(check.value.pendingTeleport, state.pendingTeleport);
  const viaRehydrate = rehydrate(JSON.parse(json));
  assert.deepStrictEqual(viaRehydrate.pendingTeleport, state.pendingTeleport);
  const booted = rehydrate(check.value);
  assert.deepStrictEqual(booted.pendingTeleport, state.pendingTeleport);
  assert.equal(cursor(booted.rngState), cursor(state.rngState), "no draw on load");
  assert.equal(booted.floor.px, state.floor.px);
  // and the restored pick still answers
  const out = applyAction(booted, { type: "teleportPick", auto: true });
  assert.ok(out.events.some((e) => e.type === "teleported" && e.auto === true));
});

test("Save: a malformed, off-map or stale pending record loads as no pick, never a throw", () => {
  const { state } = openPick({ px: 7, py: 10 });
  const bad = [
    { x: -1 },
    "a string",
    42,
    [],
    { x: 7, y: 9 }, // no depth
    { x: 7.5, y: 9, depth: 1 },
    { x: 8, y: 9, depth: 1 }, // not where the hero stands
    { x: 7, y: 9, depth: 2 }, // another floor
    { x: 0, y: 0, depth: 1 }, // off the playable map
  ];
  for (const rec of bad) {
    const raw = JSON.parse(JSON.stringify(serializeRun(state)));
    raw.pendingTeleport = rec;
    let check;
    assert.doesNotThrow(() => {
      check = validateSave(JSON.stringify(raw));
    }, JSON.stringify(rec));
    assert.equal(check.ok, true);
    assert.equal(check.value.pendingTeleport, undefined, `${JSON.stringify(rec)} loads as no pick`);
    assert.doesNotThrow(() => rehydrate(raw));
    assert.equal(rehydrate(raw).pendingTeleport, undefined);
  }
  // a fresh run never gains the key
  const fresh = newRun(5);
  assert.equal("pendingTeleport" in rehydrate(JSON.parse(JSON.stringify(serializeRun(fresh)))), false);
});

// ---------------------------------------------------------------- non-Illusionist

/** The pre-Phase-91 rolled teleport, kept here as the reference the new code must still match. */
function referenceRolled(state, rng) {
  const f = state.floor;
  const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const a = DIRECTION_TABLE[rng.d(8) - 1];
  const b = DIRECTION_TABLE[rng.d(8) - 1];
  const dist = rng.d(20);
  const tryDir = (dd) => {
    const [ax, ay] = DIRV[dd];
    for (let d = dist; d >= 1; d--) {
      const nx = f.px + ax * d;
      const ny = f.py + ay * d;
      if (nx < 1 || ny < 1 || nx > GW - 2 || ny > GH - 2) continue;
      if (f.g[ny][nx].wall) continue;
      return [nx, ny, d];
    }
    return null;
  };
  const order = [a, b, "N", "S", "E", "W"].filter((d, i, arr) => d && arr.indexOf(d) === i);
  for (const d of order) {
    const hit = tryDir(d);
    if (hit) return { x: hit[0], y: hit[1], dir: a, other: b, dist, used: d, travelled: hit[2] };
  }
  return { x: f.px, y: f.py, dir: a, other: b, dist, used: a, travelled: 0 };
}

test("Non-Illusionist: a Fighter's teleport draws two d8 then one d20 and lands exactly as before, no pick", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const state = standing({ px: 9, py: 10, sub: "Soldier", cls: "Fighter", seed });
    const want = referenceRolled(state, makeRng(seed + 1000));
    // count the draws the real code makes
    let draws = 0;
    const real = makeRng(seed + 1000);
    const counted = { ...real, d: (n) => ((draws++), real.d(n)), pick: real.pick, next: real.next, shuffle: real.shuffle, getState: real.getState };
    const events = teleport(state, counted, []);
    assert.equal(state.pendingTeleport, undefined, "no pick for a Fighter");
    assert.equal(events.some((e) => e.type === "teleportPickOffered"), false);
    assert.equal(draws, 3, `seed ${seed}: two d8 and one d20, nothing else`);
    const ev = events.find((e) => e.type === "teleported");
    assert.deepStrictEqual(
      { x: state.floor.px, y: state.floor.py, dir: ev.dir, other: ev.other, dist: ev.dist, used: ev.used, travelled: ev.travelled },
      want,
      `seed ${seed}`,
    );
    assert.equal(ev.picked, undefined);
    assert.equal(ev.auto, undefined);
    assert.deepStrictEqual(Object.keys(ev), ["type", "dir", "other", "dist", "used", "travelled", "to"], "the event shape is unchanged");
  }
});

// ---------------------------------------------------------------- edges

test("Edge (empty): when no floor square is in reach nothing is picked and the teleport resolves by the automatic rule at once", () => {
  const state = standing({ px: 5, py: 5, room: false });
  openCell(state.floor.g, 5, 5, { seen: true }); // boxed in: every other square is wall
  assert.equal(teleportTargets(state).length, 0);
  const rng = fakeRng([]);
  const events = teleport(state, rng, []);
  assert.equal(rng.draws, 0);
  assert.equal(state.pendingTeleport, undefined, "no pick opens");
  assert.equal(events.some((e) => e.type === "teleportPickOffered"), false);
  const ev = events.find((e) => e.type === "teleported");
  assert.ok(ev, "the teleport resolved at once");
  assert.equal(ev.travelled, 0);
  assert.equal(ev.auto, true);
  assert.deepStrictEqual(ev.to, { x: 5, y: 5 });
  assert.equal(state.floor.px, 5);
});

test("Edge (single): exactly one reachable explored square still opens the pick, with count 1", () => {
  const state = standing({ px: 5, py: 5, room: false });
  openCell(state.floor.g, 5, 5, { seen: true });
  openCell(state.floor.g, 5, 3, { seen: true }); // one square, two north (stone between is passed through)
  const events = teleport(state, fakeRng([]), []);
  assert.deepStrictEqual(state.pendingTeleport, { x: 5, y: 5, depth: 1 });
  const offer = events.find((e) => e.type === "teleportPickOffered");
  assert.equal(offer.count, 1);
  assert.deepStrictEqual(teleportTargets(state), [{ x: 5, y: 3, dir: "N", dist: 2 }]);
  const out = resolveTeleportPick(state, { x: 5, y: 3 }, fakeRng([]), []);
  assert.ok(out.some((e) => e.type === "teleported" && e.picked === true && e.dir === "N" && e.dist === 2));
});

// ---------------------------------------------------------------- comparables

test("Comparables: all three strip pendingTeleport", () => {
  const state = newRun(11);
  state.pendingTeleport = { x: 1, y: 1, depth: 1 };
  for (const [name, fn] of [["movement", movementComparable], ["combat", combatComparable], ["economy", economyComparable]]) {
    const out = fn(structuredClone(state));
    assert.equal("pendingTeleport" in out, false, `${name} comparable drops pendingTeleport`);
  }
});

// ---------------------------------------------------------------- the bot

test("Bot: decideAction answers a pending pick with LET IT CHOOSE, before any other decision", () => {
  const { state } = openPick({ px: 7, py: 10 });
  assert.deepStrictEqual(decideAction(state, makeRng(1), {}), { type: "teleportPick", auto: true });
  // and the answer is accepted by the engine and ends the pick
  const out = applyAction(state, decideAction(state, makeRng(1), {}));
  assert.equal(out.state.pendingTeleport, undefined);
});

// ---------------------------------------------------------------- the Illusionist's book (the trait's proof)

test("Illusionist book: every new Illusionist starts with Mirror Self, Door Illusion and one more Illusion spell (seeds 1-200)", () => {
  const ILLUSION = SPELLS.filter((sp) => sp.s === "illusion").map((sp) => sp.n);
  for (let seed = 1; seed <= 200; seed++) {
    const book = rollGrimoire(makeRng(seed), "Illusionist", 1);
    assert.ok(book.includes("Mirror Self") && book.includes("Door Illusion"), `seed ${seed}`);
    assert.ok(book.filter((n) => ILLUSION.includes(n)).length >= 3, `seed ${seed}: a third illusion`);
  }
});
