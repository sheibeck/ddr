// test/unit/achievement-tracker-sweep.test.js
//
// Phase 99 (TRACK-03). The sweep: every catalog entry unlocks exactly when its
// condition is first met and not one fact before. Each driver takes a record
// from one short of the threshold to exactly the threshold through real folds
// and asserts the id is absent from the first result's unlocks and present
// exactly once in the second's, dated by that fold's now.

import test from "node:test";
import assert from "node:assert/strict";

import { beginRun, foldAction } from "../../src/browser/achievementTracker.js";
import { emptyRecord } from "../../src/browser/achievementRecord.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { CLASSES } from "../../content/classes.js";
import { RACES } from "../../content/races.js";
import { mkState, ev, seedRecord } from "./harness/achievementState.js";

const NOW_BEFORE = 1000;
const NOW_AT = 2000;

const run = (rec, events, after, now) => foldAction(rec, events, mkState(), mkState(after || {}), { now });
const idsOf = (res) => res.unlocks.map((u) => u.id);

/** expectEdge(id, short, at) — `short` must not unlock `id`; `at` must unlock it exactly once, dated NOW_AT. */
function expectEdge(id, short, at) {
  assert.equal(idsOf(short).includes(id), false, `${id} must not unlock one short of its condition`);
  assert.equal(short.record.unlocked[id], undefined, `${id} must not be recorded one short`);
  assert.equal(idsOf(at).filter((x) => x === id).length, 1, `${id} must unlock exactly once at its condition`);
  assert.equal(at.unlocks.find((u) => u.id === id).at, NOW_AT);
  assert.equal(at.record.unlocked[id], NOW_AT);
}

const COUNTER_EVENTS = {
  deaths: [[ev("died", { cause: "combat" })], [ev("died", { cause: "combat" })], { floor: { depth: 2 } }],
  joinersAccepted: [[ev("joinerJoined", { name: "Ann" })], [ev("joinerJoined", { name: "Bob" })]],
  joinersFallen: [[ev("memberDowned", { name: "Ann" })], [ev("joinerMurdered", { name: "Bob" })]],
  parleysWon: [[ev("parleyWon", { count: 1 })], [ev("parleyWon", { count: 2 })]],
  trapsSurvived: [[ev("trapSprung", { name: "Pit" })], [ev("trapSprung", { name: "Spikes" })]],
};

function seedCounter(trigger, value) {
  return trigger.counter === "kills" ? seedRecord({ kills: { [trigger.group]: value } }) : seedRecord({ counters: { [trigger.counter]: value } });
}

function driveCounter(entry) {
  const t = entry.trigger;
  const start = seedCounter(t, entry.threshold - 2);
  let first;
  let second;
  if (t.counter === "kills") {
    const e = [ev("foeKilled", { group: t.group })];
    first = run(start, e, {}, NOW_BEFORE);
    second = run(first.record, e, {}, NOW_AT);
  } else {
    const [e1, e2, after] = COUNTER_EVENTS[t.counter];
    first = run(start, e1, after, NOW_BEFORE);
    second = run(first.record, e2, after, NOW_AT);
  }
  expectEdge(entry.id, first, second);
}

function driveBest(entry) {
  const t = entry.trigger;
  const stateFor = (value) => {
    if (t.metric === "days") return { day: value };
    if (t.metric === "wilmstHeld") return { c: { gold: value } };
    const c = {};
    if (t.race) c.race = t.race;
    if (t.parentClass) c.cls = t.parentClass;
    return { floor: { depth: value }, c };
  };
  const first = run(emptyRecord(), [], stateFor(entry.threshold - 1), NOW_BEFORE);
  const second = run(first.record, [], stateFor(entry.threshold), NOW_AT);
  expectEdge(entry.id, first, second);
  if (t.race || t.parentClass) {
    // A deep run of a different race or parent class must not unlock this entry.
    const otherRace = t.race ? Object.keys(RACES).find((r) => r !== t.race) : "Human";
    const otherCls = t.parentClass ? Object.keys(CLASSES).find((k) => k !== t.parentClass) : "Fighter";
    const other = run(emptyRecord(), [], { floor: { depth: 10 }, c: { race: otherRace, cls: otherCls } }, NOW_AT);
    assert.equal(idsOf(other).includes(entry.id), false, `${entry.id} must ignore a different race or class`);
  }
}

function driveDeathCause(entry) {
  const t = entry.trigger;
  const floor = t.floor ?? 2;
  const causes = t.causes ?? ["combat"];
  const died = (cause) => [ev("died", { cause })];
  // An abandon on the matching floor never counts.
  const abandon = run(emptyRecord(), died("abandon"), { floor: { depth: floor } }, NOW_BEFORE);
  assert.equal(idsOf(abandon).includes(entry.id), false, `${entry.id} must ignore an abandon`);
  // A non-matching real cause, or the wrong floor, does not count.
  let short;
  if (t.causes) {
    const wrong = ["combat", "maze", "quake"].find((c) => !t.causes.includes(c));
    short = run(emptyRecord(), died(wrong), { floor: { depth: floor } }, NOW_BEFORE);
  } else {
    short = run(emptyRecord(), died("combat"), { floor: { depth: floor + 1 } }, NOW_BEFORE);
  }
  // Each listed cause on a fresh record unlocks.
  for (const cause of causes) {
    const at = run(emptyRecord(), died(cause), { floor: { depth: floor } }, NOW_AT);
    expectEdge(entry.id, short, at);
  }
}

function driveFlagPair(entry) {
  const one = run(emptyRecord(), [ev("afflictionTick", { kind: "Disease", loss: 1, wp: 1 })], {}, NOW_BEFORE);
  const both = run(one.record, [ev("afflictionCaught", { kind: "Poison", first: 2, wp: 1 })], {}, NOW_AT);
  expectEdge(entry.id, one, both);
}

function driveTourist(entry) {
  const subs = Object.values(CLASSES).flatMap((c) => c.subs);
  assert.equal(subs.length, entry.threshold);
  const rec = seedRecord({ subClassesDelved: subs.slice(0, entry.threshold - 2) });
  const first = beginRun(rec, mkState({ seed: 11, c: { sub: subs[entry.threshold - 2] } }), { now: NOW_BEFORE });
  const second = beginRun(first.record, mkState({ seed: 12, c: { sub: subs[entry.threshold - 1] } }), { now: NOW_AT });
  expectEdge(entry.id, first, second);
}

/** Drivers keyed by trigger kind; runs.test.js drives the four run-scoped entries. */
function driverFor(entry) {
  const t = entry.trigger;
  if (t.kind === "lifetimeCounter") return driveCounter;
  if (t.kind === "singleRunBest" && t.metric !== "fleesWon") return driveBest;
  if (t.kind === "deathCause") return driveDeathCause;
  if (t.kind === "lifetimeFlagPair") return driveFlagPair;
  if (t.kind === "distinctSetCount") return driveTourist;
  return null;
}

test("sweep: every driven catalog entry unlocks exactly at its threshold and not one fact before", () => {
  const driven = [];
  for (const entry of ACHIEVEMENTS) {
    const drive = driverFor(entry);
    if (!drive) continue;
    drive(entry);
    driven.push(entry.id);
  }
  assert.equal(driven.length, 73);
  const undriven = ACHIEVEMENTS.map((a) => a.id).filter((id) => !driven.includes(id)).sort();
  assert.deepEqual(undriven, ["chicken", "fully_dressed", "naked_ambition", "teetotaler"]);
});

test("sweep: Special Snowflake is a real death on floor 1 only", () => {
  const entry = ACHIEVEMENTS.find((a) => a.id === "special_snowflake");
  const no = run(emptyRecord(), [ev("died", { cause: "combat" })], { floor: { depth: 2 } }, NOW_BEFORE);
  const yes = run(emptyRecord(), [ev("died", { cause: "starve" })], { floor: { depth: 1 } }, NOW_AT);
  expectEdge(entry.id, no, yes);
});

test("sweep: the 8 reveal pairs in the catalog are the ones the tracker honours", () => {
  const pairs = ACHIEVEMENTS.flatMap((a) => a.reveals.map((t) => `${a.id}>${t}`)).sort();
  assert.deepEqual(pairs, [
    "death_falling>ether_entombed",
    "depth_t1>death_falling",
    "frequent_flier_t1>death_disease",
    "fully_dressed>naked_ambition",
    "parlay_t1>chicken",
    "survivor_t1>death_starvation",
    "teetotaler>read_the_label",
    "trap_survivor_t1>death_trap",
  ]);
});
