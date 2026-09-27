// test/unit/hazard-decision.test.js
//
// Phase 78 (CLIMB-01/02), plan 78-01: the wall/crevice decision lives in the
// engine. Every step toward a climb or gorge tile pauses on ONE pending
// decision with no dice drawn (`state.pendingHazard = { feat, dir, tool }`
// plus a `hazardChoice { feat, dir, tool, carried }` event). The player then
// commits (`resolveHazard { cross: true }`: CLIMB IT / LEAP IT), spends a
// carried tool (`useTool`, unchanged), or turns back (`resolveHazard
// { cross: false }`), which costs nothing at all.
//
// The golden equivalence below is the proof that no die changed: every
// scenario in fixtures/hazard-commit/golden.json was captured on the plan
// base (the pre-Phase-78 single `move`), and `move` + commit must end in the
// same state (minus `acts` and `pendingHazard`), the same rngState and the
// same events (minus the one added `hazardChoice`).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyAction } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";
import { DIRV, move, resolveHazard, hazardOdds } from "../../engine/movement.js";
import { toolItem } from "../../engine/items.js";
import { hasTool } from "../../engine/derived.js";
import { CLIMB_TABLE, LEAP_TABLE } from "../../content/index.js";
import { stateHash } from "./harness/rollHighBaseline.js";

const GOLDEN = JSON.parse(readFileSync(new URL("./fixtures/hazard-commit/golden.json", import.meta.url), "utf8"));

/** The golden recipe: a structuredClone of the named base, cPatch assigned onto c, the target cell's feat set. */
function inputOf(sc) {
  const s = structuredClone(GOLDEN.bases[sc.base]);
  Object.assign(s.c, sc.cPatch || {});
  s.floor.g[sc.y][sc.x].feat = sc.feat;
  return s;
}

/** A scenario-shaped hazard next to the party on a golden base (no golden outcome needed). */
function atHazard(baseKey, feat, cPatch = {}) {
  const sc = GOLDEN.scenarios.find((x) => x.base === baseKey);
  return { state: inputOf({ ...sc, feat, cPatch }), dir: sc.action.dir, x: sc.x, y: sc.y };
}

const withoutActsAndRecord = (st) => {
  const { acts, pendingHazard, ...rest } = st;
  return rest;
};

const FEAR_TYPES = new Set(["phobiaTriggered", "heightsFear"]);

/** Everything a pause or TURN BACK must leave alone. */
function assertUntouched(before, after, label) {
  assert.equal(after.floor.px, before.floor.px, `${label}: px`);
  assert.equal(after.floor.py, before.floor.py, `${label}: py`);
  assert.equal(after.steps, before.steps, `${label}: steps`);
  assert.equal(after.day, before.day, `${label}: day`);
  assert.equal(after.rngState, before.rngState, `${label}: rngState`);
  assert.deepStrictEqual(after.c, before.c, `${label}: c`);
  assert.deepStrictEqual(after.floor, before.floor, `${label}: floor`);
  assert.deepStrictEqual(after.party, before.party, `${label}: party`);
}

// ─── the golden fixture itself ─────────────────────────────────────────────

test("golden: at least 12 scenarios with success, fail-and-cross and death all represented", () => {
  assert.ok(GOLDEN.scenarios.length >= 12);
  const outcomes = new Set(GOLDEN.scenarios.map((s) => s.outcome));
  for (const o of ["succeeded", "failedCrossed", "died"]) assert.ok(outcomes.has(o), `an outcome of ${o}`);
  for (const sc of GOLDEN.scenarios) {
    assert.ok(GOLDEN.bases[sc.base], `${sc.label}: base present`);
    assert.equal(sc.action.type, "move");
  }
});

// ─── the pause ─────────────────────────────────────────────────────────────

test("CLIMB-01: every hero kind pauses at a wall and a crevice — one hazardChoice, the { feat, dir, tool } record, no roll, nothing else changes", () => {
  for (const baseKey of ["fighter-s1", "thief-s2", "mu-s3", "party-s1"]) {
    for (const feat of ["climb", "gorge"]) {
      for (const carry of [false, true]) {
        const tool = feat === "climb" ? "ladder" : "rope";
        const { state, dir } = atHazard(baseKey, feat);
        if (carry) state.c.items.push(toolItem(tool));
        const label = `${baseKey} ${feat} carried=${carry}`;
        const { state: after, events } = applyAction(state, { type: "move", dir });
        assert.deepStrictEqual(events, [{ type: "hazardChoice", feat, dir, tool, carried: carry }], label);
        assert.deepStrictEqual(after.pendingHazard, { feat, dir, tool }, label);
        assert.deepStrictEqual(Object.keys(after.pendingHazard).sort(), ["dir", "feat", "tool"], label);
        assert.equal(events[0].carried, hasTool(after.c, tool), label);
        assertUntouched(state, after, label);
      }
    }
  }
});

test("CLIMB-01: a Heights-phobic hero's pause arms no fear (Heights arms on the COMMIT)", () => {
  const { state, dir } = atHazard("fighter-s1", "climb", { phobia: "Heights" });
  const { state: after, events } = applyAction(state, { type: "move", dir });
  assert.equal(events.some((e) => FEAR_TYPES.has(e.type)), false);
  assertUntouched(state, after, "heights pause");
});

// ─── the golden equivalence ────────────────────────────────────────────────

test("CLIMB-01: move then resolveHazard(cross:true) reproduces every pre-Phase-78 single move — same state, rngState and events", () => {
  for (const sc of GOLDEN.scenarios) {
    const input = inputOf(sc);
    const paused = applyAction(input, sc.action);
    assert.deepStrictEqual(paused.events.map((e) => e.type), ["hazardChoice"], `${sc.label}: the move pauses`);
    assert.equal(paused.state.rngState, input.rngState, `${sc.label}: the pause draws nothing`);
    const committed = applyAction(paused.state, { type: "resolveHazard", cross: true });
    const events = [...paused.events, ...committed.events].filter((e) => e.type !== "hazardChoice");
    assert.deepStrictEqual(events, sc.expected.events, `${sc.label}: events`);
    assert.equal(committed.state.rngState, sc.expected.rngState, `${sc.label}: rngState`);
    assert.equal(stateHash(withoutActsAndRecord(committed.state)), sc.expected.hash, `${sc.label}: state`);
    assert.equal(committed.state.pendingHazard, null, `${sc.label}: the record clears on crossing or a fatal fall`);
    const s = committed.state;
    assert.deepStrictEqual(
      {
        px: s.floor.px, py: s.floor.py, wp: s.c.wp, steps: s.steps, day: s.day, dead: s.dead,
        feat: s.floor.g[sc.y][sc.x].feat, deathNote: s.deathNote, fearArmed: s.c.fearArmed ?? null, phobiaState: s.c.phobiaState ?? null,
      },
      sc.expected.summary,
      `${sc.label}: summary`,
    );
  }
});

// ─── TURN BACK ─────────────────────────────────────────────────────────────

test("CLIMB-02: TURN BACK clears the record, emits one turnedBack, and costs nothing (no step, day, rng, fear)", () => {
  for (const [baseKey, feat, cPatch] of [
    ["fighter-s1", "climb", {}],
    ["thief-s2", "gorge", {}],
    ["fighter-s2", "climb", { phobia: "Heights" }],
    ["fighter-s3", "gorge", { phobia: "Bodies of water" }],
  ]) {
    const { state, dir } = atHazard(baseKey, feat, cPatch);
    const paused = applyAction(state, { type: "move", dir }).state;
    const { state: after, events } = applyAction(paused, { type: "resolveHazard", cross: false });
    const label = `${baseKey} ${feat}`;
    assert.deepStrictEqual(events, [{ type: "turnedBack", feat, dir }], label);
    assert.equal(after.pendingHazard, null, label);
    assertUntouched(state, after, label);
    assert.deepStrictEqual(after.c.phobiaState, state.c.phobiaState, `${label}: phobiaState`);
    assert.deepStrictEqual(after.c.fearArmed, state.c.fearArmed, `${label}: fearArmed`);
  }
});

test("CLIMB-02: after TURN BACK the next step toward the same wall pauses again (a fresh card, still no roll)", () => {
  const { state, dir } = atHazard("fighter-s1", "climb");
  let s = applyAction(state, { type: "move", dir }).state;
  s = applyAction(s, { type: "resolveHazard", cross: false }).state;
  const { state: again, events } = applyAction(s, { type: "move", dir });
  assert.deepStrictEqual(events.map((e) => e.type), ["hazardChoice"]);
  assert.equal(again.rngState, state.rngState);
  assert.deepStrictEqual(again.pendingHazard, { feat: "climb", dir, tool: "ladder" });
});

// ─── Heights timing (the declared rules-timing change) ─────────────────────

test("CLIMB-01 Heights timing: turning back arms nothing; committing arms Heights exactly as the old single step did", () => {
  const sc = GOLDEN.scenarios.find((x) => x.label === "heights-phobic-climb-s1");
  const input = inputOf(sc);
  const paused = applyAction(input, sc.action).state;
  const back = applyAction(paused, { type: "resolveHazard", cross: false });
  assert.equal(back.events.some((e) => FEAR_TYPES.has(e.type)), false);
  assert.deepStrictEqual(back.state.c.phobiaState, input.c.phobiaState);
  assert.deepStrictEqual(back.state.c.fearArmed, input.c.fearArmed);

  const committed = applyAction(paused, { type: "resolveHazard", cross: true });
  assert.ok(committed.events.some((e) => e.type === "phobiaTriggered" && e.trigger === "heights"));
  assert.ok(committed.events.some((e) => e.type === "heightsFear"));
  assert.deepStrictEqual(committed.state.c.fearArmed, sc.expected.summary.fearArmed);
  assert.deepStrictEqual(committed.state.c.phobiaState, sc.expected.summary.phobiaState);
});

// ─── idempotency ───────────────────────────────────────────────────────────

test("CLIMB-02: resolveHazard with no record is a no-op either way — no events, no rng, no state change beyond acts", () => {
  const { state } = atHazard("fighter-s1", "climb");
  for (const cross of [true, false]) {
    const { state: after, events } = applyAction(state, { type: "resolveHazard", cross });
    assert.deepStrictEqual(events, []);
    assert.equal(after.acts, (state.acts || 0) + 1, "the validated-action counter still counts it");
    assert.deepStrictEqual({ ...after, acts: state.acts }, state);
  }
});

test("CLIMB-02: a second commit after the crossing never rolls again", () => {
  const sc = GOLDEN.scenarios.find((x) => x.outcome === "succeeded");
  let s = applyAction(inputOf(sc), sc.action).state;
  s = applyAction(s, { type: "resolveHazard", cross: true }).state;
  const { state: after, events } = applyAction(s, { type: "resolveHazard", cross: true });
  assert.deepStrictEqual(events, []);
  assert.equal(after.rngState, s.rngState);
});

test("CLIMB-01: a second move toward the same pending hazard re-pauses with no roll", () => {
  const { state, dir } = atHazard("thief-s1", "gorge");
  const first = applyAction(state, { type: "move", dir }).state;
  const { state: second, events } = applyAction(first, { type: "move", dir });
  assert.deepStrictEqual(events, [{ type: "hazardChoice", feat: "gorge", dir, tool: "rope", carried: false }]);
  assert.deepStrictEqual(second.pendingHazard, first.pendingHazard);
  assertUntouched(state, second, "re-pause");
});

// ─── the free crossings and the other ways out ─────────────────────────────

test("CLIMB-01: flight live at commit time crosses free (flownOver, no roll)", () => {
  const { state, dir } = atHazard("fighter-s1", "climb");
  let s = applyAction(state, { type: "move", dir }).state;
  s.c.items.push({ n: "Bracelet of Flight", eff: { fly: 1 } });
  s.c.timers = { ...(s.c.timers || {}), "item:Bracelet of Flight": { cadence: "squares", left: 20, cd: 50, phase: "effect" } };
  const { state: after, events } = applyAction(s, { type: "resolveHazard", cross: true });
  assert.ok(events.some((e) => e.type === "flownOver"));
  assert.equal(events.some((e) => ["climbedOver", "fellClimbing", "draggedOver"].includes(e.type)), false);
  assert.equal(after.pendingHazard, null);
  assert.notDeepStrictEqual([after.floor.px, after.floor.py], [state.floor.px, state.floor.py]);
});

test("CLIMB-01: a live ether effect at commit time phases through free", () => {
  const { state, dir } = atHazard("thief-s1", "gorge");
  let s = applyAction(state, { type: "move", dir }).state;
  s.c.timers = { ...(s.c.timers || {}), "item:Cloak of Ether": { cadence: "squares", left: 20, cd: 80, phase: "effect" } };
  const { state: after, events } = applyAction(s, { type: "resolveHazard", cross: true });
  assert.ok(events.some((e) => e.type === "phasedThrough"));
  assert.equal(events.some((e) => ["leaptOver", "fellInGorge", "draggedOver"].includes(e.type)), false);
  assert.equal(after.pendingHazard, null);
});

test("CLIMB-01: useTool still crosses with the tool spent, no roll, and clears the record", () => {
  const { state, dir, x, y } = atHazard("fighter-s2", "climb");
  state.c.items.push(toolItem("ladder"));
  const paused = applyAction(state, { type: "move", dir });
  assert.deepStrictEqual(paused.events, [{ type: "hazardChoice", feat: "climb", dir, tool: "ladder", carried: true }]);
  const { state: after, events } = applyAction(paused.state, { type: "useTool", tool: "ladder", dir });
  assert.ok(events.some((e) => e.type === "toolUsed" && e.tool === "ladder"));
  assert.equal(events.some((e) => ["climbedOver", "fellClimbing"].includes(e.type)), false);
  assert.equal(hasTool(after.c, "ladder"), false);
  assert.equal(after.pendingHazard, null);
  assert.deepStrictEqual([after.floor.px, after.floor.py], [x, y]);
});

test("CLIMB-01: a genuine step in another direction clears the record", () => {
  // fighter-s1's hazard lies S of the party; find another open neighbour.
  const { state, dir } = atHazard("fighter-s1", "climb");
  const f = state.floor;
  const other = Object.keys(DIRV).find((d) => {
    if (d === dir) return false;
    const [dx, dy] = DIRV[d];
    const cell = f.g[f.py + dy]?.[f.px + dx];
    return cell && !cell.wall && cell.feat !== "one";
  });
  assert.ok(other, "precondition: a second open neighbour");
  const [dx, dy] = DIRV[other];
  f.g[f.py + dy][f.px + dx].feat = null;
  const paused = applyAction(state, { type: "move", dir }).state;
  assert.ok(paused.pendingHazard);
  const stepped = applyAction(paused, { type: "move", dir: other }).state;
  assert.equal(stepped.pendingHazard, null);
});

test("CLIMB-02: resolveHazard is a no-op in combat, in a store and when dead (the record stays)", () => {
  const { state, dir } = atHazard("fighter-s1", "climb");
  const paused = applyAction(state, { type: "move", dir }).state;
  for (const [label, patch] of [["combat", { combat: { pending: true, foes: [] } }], ["store", { store: { stock: [] } }], ["dead", { dead: true }]]) {
    for (const cross of [true, false]) {
      const s = { ...structuredClone(paused), ...patch };
      const events = resolveHazard(s, cross, { d: () => assert.fail("no draw"), pick: () => assert.fail("no draw") }, []);
      assert.deepStrictEqual(events, [], label);
      assert.deepStrictEqual(s.pendingHazard, paused.pendingHazard, label);
    }
  }
});

test("CLIMB-01: a commit whose target cell lost its feat just clears the record (no roll, no step)", () => {
  const { state, dir, x, y } = atHazard("fighter-s1", "climb");
  const paused = applyAction(state, { type: "move", dir }).state;
  paused.floor.g[y][x].feat = null;
  const { state: after, events } = applyAction(paused, { type: "resolveHazard", cross: true });
  assert.deepStrictEqual(events, []);
  assert.equal(after.pendingHazard, null);
  assert.equal(after.rngState, paused.rngState);
  assert.deepStrictEqual([after.floor.px, after.floor.py], [state.floor.px, state.floor.py]);
});

test("move (direct): the pause draws nothing from the rng it is handed", () => {
  const { state, dir } = atHazard("fighter-s1", "gorge");
  const draws = [];
  const rng = { d: (n) => (draws.push(n), 1), pick: (a) => a[0] };
  const pauseEvents = move(structuredClone(state), dir, rng, []);
  assert.deepStrictEqual(pauseEvents.map((e) => e.type), ["hazardChoice"]);
  assert.equal(draws.length, 0);
});

// ─── validation ────────────────────────────────────────────────────────────

test("validateAction: resolveHazard needs a boolean cross", () => {
  assert.deepStrictEqual(validateAction({ type: "resolveHazard", cross: true }), { ok: true });
  assert.deepStrictEqual(validateAction({ type: "resolveHazard", cross: false }), { ok: true });
  for (const bad of [{ type: "resolveHazard" }, { type: "resolveHazard", cross: "yes" }, { type: "resolveHazard", cross: 1 }, { type: "resolveHazard", cross: null }]) {
    const r = validateAction(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.match(r.reason, /resolveHazard\.cross/);
  }
});

// ─── relaunch (SAV-06 carries the new record) ──────────────────────────────

test("CLIMB-02 relaunch: a state paused at a hazard keeps the record through the load, and the commit after the load equals the commit before it", () => {
  for (const label of ["fighter-climb-s1", "thief-gorge-s2", "heights-phobic-climb-s3", "fatal-leap-s2"]) {
    const sc = GOLDEN.scenarios.find((x) => x.label === label);
    const paused = applyAction(inputOf(sc), sc.action).state;
    const json = JSON.stringify(serializeRun(paused));
    const check = validateSave(json);
    assert.equal(check.ok, true);
    const booted = rehydrate(check.value);
    assert.deepStrictEqual(booted.pendingHazard, paused.pendingHazard, label);
    assert.deepStrictEqual(rehydrate(JSON.parse(json)).pendingHazard, paused.pendingHazard, label);
    const live = applyAction(paused, { type: "resolveHazard", cross: true });
    const relaunched = applyAction(booted, { type: "resolveHazard", cross: true });
    assert.deepStrictEqual(relaunched.events, live.events, label);
    assert.equal(relaunched.state.rngState, live.state.rngState, label);
  }
});

test("CLIMB-02 relaunch: a record whose tool does not match its feat, or whose neighbour lost the feat, loads as null", () => {
  const sc = GOLDEN.scenarios.find((x) => x.label === "fighter-climb-s1");
  const paused = applyAction(inputOf(sc), sc.action).state;
  const wrongTool = structuredClone(paused);
  wrongTool.pendingHazard = { ...wrongTool.pendingHazard, tool: "rope" };
  const lostFeat = structuredClone(paused);
  lostFeat.floor.g[sc.y][sc.x].feat = null;
  for (const s of [wrongTool, lostFeat]) {
    const json = JSON.stringify(serializeRun(s));
    assert.equal(validateSave(json).value.pendingHazard, null);
    assert.equal(rehydrate(JSON.parse(json)).pendingHazard, null);
  }
});

test("CLIMB-02 relaunch: an old save's record with the retired retry flag still loads and commits", () => {
  const sc = GOLDEN.scenarios.find((x) => x.label === "mu-gorge-s1");
  const paused = applyAction(inputOf(sc), sc.action).state;
  const old = structuredClone(paused);
  old.pendingHazard = { ...old.pendingHazard, declined: true };
  const booted = rehydrate(validateSave(JSON.stringify(serializeRun(old))).value);
  assert.ok(booted.pendingHazard, "the old record survives the load");
  assert.equal(booted.pendingHazard.feat, "gorge");
  const live = applyAction(paused, { type: "resolveHazard", cross: true });
  const relaunched = applyAction(booted, { type: "resolveHazard", cross: true });
  assert.deepStrictEqual(relaunched.events, live.events);
  assert.equal(relaunched.state.rngState, live.state.rngState);
  assert.equal(relaunched.state.pendingHazard, null);
});

// ─── hazardOdds ────────────────────────────────────────────────────────────

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

test("hazardOdds: a Fighter at a wall with no penalties reads rope 7, rock 6, wood 7 on a d10, 2 or 3 rolls", () => {
  const { state } = atHazard("fighter-s1", "climb", { armor: "Nothing", phobia: "Spiders" });
  const odds = hazardOdds(state, "climb");
  assert.equal(odds.feat, "climb");
  assert.equal(odds.dieN, 10);
  assert.deepStrictEqual(odds.rolls, [2, 3]);
  assert.deepStrictEqual(odds.penalties, []);
  assert.deepStrictEqual(
    odds.cases.map((k) => [k.label, k.faces, k.atLeast]),
    [["rope", 7, 4], ["rock", 6, 5], ["wood", 7, 4]],
  );
  for (const k of odds.cases) assert.deepStrictEqual(k.fall, CLIMB_TABLE[k.label].fall);
});

test("hazardOdds: Heights drops every climb case by the penalty (halved with Hardiness); armour bulk drops every case", () => {
  const plain = hazardOdds(atHazard("fighter-s1", "climb", { armor: "Nothing", phobia: "Spiders" }).state, "climb");
  const heights = hazardOdds(atHazard("fighter-s1", "climb", { armor: "Nothing", phobia: "Heights", skills: {} }).state, "climb");
  const hardy = hazardOdds(atHazard("fighter-s1", "climb", { armor: "Nothing", phobia: "Heights", skills: { Hardiness: 1 } }).state, "climb");
  const plate = hazardOdds(atHazard("fighter-s1", "climb", { armor: "Plate", phobia: "Spiders" }).state, "climb");
  plain.cases.forEach((k, i) => {
    assert.equal(heights.cases[i].faces, k.faces - 2);
    assert.equal(hardy.cases[i].faces, k.faces - 1);
    assert.equal(plate.cases[i].faces, k.faces - 2);
  });
  assert.deepStrictEqual(heights.penalties, [{ name: "heights", faces: -2 }]);
  assert.deepStrictEqual(hardy.penalties, [{ name: "heights", faces: -1 }]);
  assert.deepStrictEqual(plate.penalties, [{ name: "armorBulk", faces: -2 }]);
});

test("hazardOdds: a gorge lists every LEAP_TABLE row in the hero's class column, minus water and bulk, with the 2d6 fall", () => {
  for (const [baseKey, col] of [["fighter-s1", "F"], ["thief-s1", "T"], ["mu-s1", "M"]]) {
    const plain = hazardOdds(atHazard(baseKey, "gorge", { armor: "Nothing", phobia: "Spiders" }).state, "gorge");
    assert.deepStrictEqual(plain.rolls, [1]);
    assert.deepStrictEqual(
      plain.cases.map((k) => [k.label, k.faces, k.atLeast]),
      LEAP_TABLE.map((row) => [row.ft, row[col], 11 - row[col]]),
      baseKey,
    );
    for (const k of plain.cases) assert.deepStrictEqual(k.fall, { n: 2, sides: 6, bonus: 0 });
    const water = hazardOdds(atHazard(baseKey, "gorge", { armor: "Studded", phobia: "Bodies of water", skills: {} }).state, "gorge");
    water.cases.forEach((k, i) => assert.equal(k.faces, plain.cases[i].faces - 2 - 1, baseKey));
    assert.deepStrictEqual(water.penalties, [{ name: "water", faces: -2 }, { name: "armorBulk", faces: -1 }]);
  }
});

test("hazardOdds: the roll and the odds read the same faces — every golden climb/leap roll's atLeast is one of the listed cases", () => {
  for (const sc of GOLDEN.scenarios) {
    const odds = hazardOdds(inputOf(sc), sc.feat);
    const atLeasts = new Set(odds.cases.map((k) => k.atLeast));
    for (const e of sc.expected.events) {
      if (["climbedOver", "fellClimbing", "leaptOver", "fellInGorge"].includes(e.type)) {
        assert.ok(atLeasts.has(e.atLeast), `${sc.label}: atLeast ${e.atLeast} in ${[...atLeasts]}`);
      }
    }
  }
});

test("hazardOdds: a missing or unknown feat returns the same shape with no cases; never throws, never mutates, draws nothing", () => {
  const { state } = atHazard("fighter-s1", "climb");
  const frozen = deepFreeze(structuredClone(state));
  const keys = Object.keys(hazardOdds(frozen, "climb")).sort();
  assert.deepStrictEqual(Object.keys(hazardOdds(frozen, "gorge")).sort(), keys);
  for (const feat of [undefined, null, "dot", "one"]) {
    const odds = hazardOdds(frozen, feat);
    assert.deepStrictEqual(Object.keys(odds).sort(), keys);
    assert.deepStrictEqual(odds.cases, []);
  }
  assert.doesNotThrow(() => hazardOdds(null, "climb"));
  assert.deepStrictEqual(hazardOdds(null, "climb").cases, []);
  assert.deepStrictEqual(frozen, state);
});
