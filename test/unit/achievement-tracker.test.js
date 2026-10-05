// test/unit/achievement-tracker.test.js
//
// Phase 99 (TRACK-03, TRACK-04, TRACK-05). src/browser/achievementTracker.js:
// the counting rulings, list order, reveals, idempotence, progress, the dev
// guard and purity. The run-scoped rulings are in achievement-tracker-runs;
// the per-entry threshold sweep is in achievement-tracker-sweep.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { beginRun, foldAction, progressFor, runTagOf, filledSlotCount } from "../../src/browser/achievementTracker.js";
import * as trackerModule from "../../src/browser/achievementTracker.js";
import { emptyRecord } from "../../src/browser/achievementRecord.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { mkState, ev, seedRecord, deepFreeze } from "./harness/achievementState.js";

const NOW = 5000;
const OPTS = { now: NOW };
const entryOf = (id) => ACHIEVEMENTS.find((a) => a.id === id);

/** fold(rec, events, afterOver, beforeOver, now) — one action against mkState-built states. */
function fold(rec, events, afterOver = {}, beforeOver = {}, now = NOW) {
  return foldAction(rec, events, mkState(beforeOver), mkState(afterOver), { now });
}

test("TRACK-03: the module exports exactly the five names", () => {
  assert.deepEqual(Object.keys(trackerModule).sort(), ["beginRun", "filledSlotCount", "foldAction", "progressFor", "runTagOf"]);
});

test("body counts: one action counts each foeKilled by its group; a missing or unknown group adds nothing", () => {
  const r = fold(emptyRecord(), [
    ev("foeKilled", { group: "Beasts" }),
    ev("foeKilled", { group: "Demons" }),
    ev("foeKilled", { group: "Beasts" }),
    ev("foeKilled", {}),
    ev("foeKilled", { group: "Dragons" }),
    ev("foeKilled", { group: "toString" }),
  ]);
  assert.equal(r.record.kills.Beasts, 2);
  assert.equal(r.record.kills.Demons, 1);
  assert.equal(r.record.kills.Humans, 0);
  assert.equal(r.changed, true);
});

test("body counts: walkingDeadTurned adds its count as Walking Dead; count 0 or not a count adds nothing", () => {
  const r = fold(emptyRecord(), [ev("walkingDeadTurned", { count: 3 }), ev("foeKilled", { group: "Walking Dead" })]);
  assert.equal(r.record.kills["Walking Dead"], 4);
  for (const count of [0, -2, 1.5, "3", undefined]) {
    assert.equal(fold(emptyRecord(), [ev("walkingDeadTurned", { count })]).record.kills["Walking Dead"], 0, String(count));
  }
});

test("Human Shields: memberDowned and joinerMurdered each add one to joinersFallen", () => {
  const r = fold(emptyRecord(), [ev("memberDowned", { name: "Ann" }), ev("joinerMurdered", { name: "Bob" })]);
  assert.equal(r.record.counters.joinersFallen, 2);
});

test("Party Animal and Silver Tongue: joinerJoined and parleyWon each add one", () => {
  const r = fold(emptyRecord(), [ev("joinerJoined", { name: "Ann" }), ev("parleyWon", { count: 3 })]);
  assert.equal(r.record.counters.joinersAccepted, 1);
  assert.equal(r.record.counters.parleysWon, 1);
});

test("Still Standing: a trap with no death counts, a trap death does not, a trap then another death cause counts", () => {
  assert.equal(fold(emptyRecord(), [ev("trapSprung", { name: "Pit" })]).record.counters.trapsSurvived, 1);
  const dead = fold(emptyRecord(), [ev("trapSprung", { name: "Pit" }), ev("died", { cause: "trap" })]);
  assert.equal(dead.record.counters.trapsSurvived, 0);
  assert.ok(dead.unlocks.some((u) => u.id === "death_trap"));
  assert.equal(fold(emptyRecord(), [ev("trapSprung", { name: "Pit" }), ev("died", { cause: "combat" })]).record.counters.trapsSurvived, 1);
  const two = fold(emptyRecord(), [ev("trapSprung"), ev("trapSprung"), ev("died", { cause: "trap" })]);
  assert.equal(two.record.counters.trapsSurvived, 1);
});

test("abandon is not a death: no death count, no death achievement, no Special Snowflake; Tourist stays", () => {
  const none = seedRecord({ subClassesDelved: ["Soldier"] });
  const r = fold(none, [ev("died", { cause: "abandon" })], { floor: { depth: 1 } });
  assert.equal(r.record.counters.deaths, 0);
  assert.equal(r.unlocks.length, 0);
  assert.deepEqual(r.record.subClassesDelved, ["Soldier"]);
});

test("real deaths: counted once per action even with two died events; Special Snowflake needs floor 1", () => {
  const r = fold(emptyRecord(), [ev("died", { cause: "combat" }), ev("died", { cause: "trap" })], { floor: { depth: 2 } });
  assert.equal(r.record.counters.deaths, 1);
  assert.equal(r.unlocks.length, 0);
  const snow = fold(emptyRecord(), [ev("died", { cause: "combat" })], { floor: { depth: 1 } });
  assert.deepEqual(snow.unlocks.map((u) => u.id), ["special_snowflake"]);
});

test("death causes: fall and gorge are Gravity Wins, potion is Read the Label, starve, entombed", () => {
  const ids = (cause) => fold(emptyRecord(), [ev("died", { cause })], { floor: { depth: 3 } }).unlocks.map((u) => u.id);
  assert.deepEqual(ids("fall"), ["death_falling"]);
  assert.deepEqual(ids("gorge"), ["death_falling"]);
  assert.deepEqual(ids("potion"), ["read_the_label"]);
  assert.deepEqual(ids("starve"), ["death_starvation"]);
  assert.deepEqual(ids("entombed"), ["ether_entombed"]);
  assert.deepEqual(ids("combat"), []);
});

test("Terminal Condition: afflictionTick at exactly 1 HP sets the flag; 2 HP does not", () => {
  assert.equal(fold(emptyRecord(), [ev("afflictionTick", { kind: "Disease", loss: 2, wp: 1 })]).record.flags.diseaseLeftOnOneHp, true);
  assert.equal(fold(emptyRecord(), [ev("afflictionTick", { kind: "Disease", loss: 2, wp: 2 })]).record.flags.diseaseLeftOnOneHp, false);
  assert.equal(fold(emptyRecord(), [ev("afflictionTick", { kind: "Poison", loss: 2, wp: 0 })]).record.flags.poisonLeftOnOneHp, false);
});

test("Terminal Condition: afflictionCaught needs first above 0; the kind picks the flag", () => {
  assert.equal(fold(emptyRecord(), [ev("afflictionCaught", { kind: "Disease", first: 0, wp: 1 })]).record.flags.diseaseLeftOnOneHp, false);
  const r = fold(emptyRecord(), [ev("afflictionCaught", { kind: "Poison", first: 3, wp: 1 })]);
  assert.equal(r.record.flags.poisonLeftOnOneHp, true);
  assert.equal(r.record.flags.diseaseLeftOnOneHp, false);
  assert.equal(fold(emptyRecord(), [ev("afflictionCaught", { kind: "Poison", first: 3 })]).record.flags.poisonLeftOnOneHp, false);
});

test("Terminal Condition: the flags are lifetime, survive a new run tag, and death_disease needs both and is never a death", () => {
  const one = fold(emptyRecord(), [ev("afflictionTick", { kind: "Disease", wp: 1 })]);
  assert.equal(one.unlocks.length, 0);
  const otherRun = fold(one.record, [], { seed: 99, c: { name: "Someone Else" } });
  assert.equal(otherRun.record.flags.diseaseLeftOnOneHp, true);
  const both = fold(otherRun.record, [ev("afflictionCaught", { kind: "Poison", first: 4, wp: 1 })], { seed: 99, c: { name: "Someone Else" } });
  assert.deepEqual(both.unlocks.map((u) => u.id), ["death_disease"]);
  assert.equal(both.record.counters.deaths, 0);
});

test("Tourist: beginRun adds the sub-class once; the same sub-class again adds nothing", () => {
  const state = mkState({ c: { sub: "Ninja" } });
  const first = beginRun(emptyRecord(), state, OPTS);
  assert.deepEqual(first.record.subClassesDelved, ["Ninja"]);
  assert.equal(first.changed, true);
  const second = beginRun(first.record, state, OPTS);
  assert.deepEqual(second.record.subClassesDelved, ["Ninja"]);
  assert.equal(second.changed, false);
  assert.equal(second.record, first.record);
  const third = beginRun(first.record, mkState({ seed: 2, c: { sub: "Wizard" } }), OPTS);
  assert.deepEqual(third.record.subClassesDelved, ["Ninja", "Wizard"]);
});

test("Tourist: a dev beginRun returns the same record; an unknown sub-class is ignored", () => {
  const rec = seedRecord({ subClassesDelved: ["Bard"] });
  const dev = beginRun(rec, mkState({ dev: true, c: { sub: "Ninja" } }), OPTS);
  assert.equal(dev.record, rec);
  assert.equal(dev.changed, false);
  assert.deepEqual([dev.unlocks, dev.reveals, dev.progress], [[], [], []]);
  const unknown = beginRun(rec, mkState({ c: { sub: "Plumber" } }), OPTS);
  assert.deepEqual(unknown.record.subClassesDelved, ["Bard"]);
  assert.equal(beginRun(null, null, OPTS).record.v, 1);
});

test("list order: one action crossing three tracks unlocks in listOrder, whatever the catalog array order", () => {
  const rec = seedRecord({ kills: { Beasts: 49 }, counters: { deaths: 49 } });
  const events = [ev("died", { cause: "combat" }), ev("foeKilled", { group: "Beasts" })];
  const after = { floor: { depth: 5 } };
  const a = fold(rec, events, after);
  assert.deepEqual(a.unlocks.map((u) => u.id), ["depth_t1", "kills_beasts_t1", "frequent_flier_t1"]);
  const reversed = foldAction(rec, events, mkState(), mkState(after), { now: NOW, catalog: [...ACHIEVEMENTS].reverse() });
  assert.deepEqual(reversed.unlocks.map((u) => u.id), a.unlocks.map((u) => u.id));
  assert.deepEqual(reversed.reveals, a.reveals);
  assert.deepEqual(reversed.progress, a.progress);
  assert.ok(a.unlocks.every((u) => u.at === NOW));
});

test("TRACK-03 adjacency: one action crossing two tiers of one track unlocks both in list order", () => {
  const r = fold(seedRecord({ kills: { Magical: 99 } }), [ev("foeKilled", { group: "Magical" })]);
  assert.deepEqual(r.unlocks.map((u) => u.id), ["kills_magical_t1", "kills_magical_t2"]);
});

test("reveals: each revealer's unlock reveals its target (the six pairs the counters and bests drive)", () => {
  const cases = [
    ["trap_survivor_t1", seedRecord({ counters: { trapsSurvived: 9 } }), [ev("trapSprung")], {}, "death_trap"],
    ["survivor_t1", emptyRecord(), [], { day: 10 }, "death_starvation"],
    ["depth_t1", emptyRecord(), [], { floor: { depth: 5 } }, "death_falling"],
    ["frequent_flier_t1", seedRecord({ counters: { deaths: 49 } }), [ev("died", { cause: "combat" })], { floor: { depth: 2 } }, "death_disease"],
    ["parlay_t1", seedRecord({ counters: { parleysWon: 9 } }), [ev("parleyWon")], {}, "chicken"],
  ];
  for (const [revealer, rec, events, after, target] of cases) {
    const r = fold(rec, events, after);
    assert.ok(r.unlocks.some((u) => u.id === revealer), `${revealer} unlocks`);
    assert.ok(r.reveals.includes(target), `${revealer} reveals ${target}`);
    assert.ok(r.record.revealed.includes(target));
    assert.ok(entryOf(revealer).reveals.includes(target));
  }
  const chain = fold(emptyRecord(), [ev("died", { cause: "fall" })], { floor: { depth: 3 } });
  assert.deepEqual(chain.unlocks.map((u) => u.id), ["death_falling"]);
  assert.deepEqual(chain.reveals, ["death_falling", "ether_entombed"]);
});

test("reveals: a Hidden entry unlocked directly is revealed; a target already revealed is not reported again", () => {
  const direct = fold(emptyRecord(), [ev("died", { cause: "trap" })], { floor: { depth: 2 } });
  assert.deepEqual(direct.reveals, ["death_trap"]);
  assert.deepEqual(direct.record.revealed, ["death_trap"]);
  const already = fold(seedRecord({ counters: { trapsSurvived: 9 }, revealed: ["death_trap"] }), [ev("trapSprung")]);
  assert.ok(already.unlocks.some((u) => u.id === "trap_survivor_t1"));
  assert.deepEqual(already.reveals, []);
  assert.deepEqual(already.record.revealed, ["death_trap"]);
});

test("TRACK-03 adjacency: a revealer and the Hidden entry it reveals unlocking together report one reveal", () => {
  const r = fold(emptyRecord(), [ev("died", { cause: "fall" })], { floor: { depth: 5 } });
  assert.deepEqual(r.unlocks.map((u) => u.id), ["depth_t1", "death_falling"]);
  assert.deepEqual(r.reveals, ["death_falling", "ether_entombed"]);
  assert.equal(new Set(r.reveals).size, r.reveals.length);
});

test("reveals: no Revealed-state id ever appears in reveals", () => {
  const hidden = new Set(ACHIEVEMENTS.filter((a) => a.initialState === "Hidden").map((a) => a.id));
  const r = fold(seedRecord({ kills: { Beasts: 49 } }), [ev("foeKilled", { group: "Beasts" }), ev("died", { cause: "gorge" })], { floor: { depth: 10 } });
  assert.ok(r.unlocks.length > 3);
  for (const id of r.reveals) assert.ok(hidden.has(id), id);
  for (const id of r.record.revealed) assert.ok(hidden.has(id), id);
});

test("idempotence: folding the same action into the output unlocks nothing new and keeps every date", () => {
  const events = [ev("foeKilled", { group: "Beasts" })];
  const rec = seedRecord({ kills: { Beasts: 49 } });
  const first = fold(rec, events, {}, {}, 100);
  assert.deepEqual(first.unlocks, [{ id: "kills_beasts_t1", at: 100 }]);
  const second = fold(first.record, events, {}, {}, 200);
  assert.deepEqual(second.unlocks, []);
  assert.equal(second.record.unlocked.kills_beasts_t1, 100);
  assert.equal(second.record.kills.Beasts, 51);
});

test("TRACK-04: an unlock is never re-locked or re-dated, even when its counter reads lower", () => {
  const rec = seedRecord({ unlocked: { kills_beasts_t1: 42, depth_t1: 43 } });
  assert.equal(rec.kills.Beasts, 0);
  const r = fold(rec, [ev("foeKilled", { group: "Beasts" })], {}, {}, 9999);
  assert.deepEqual(r.unlocks, []);
  assert.equal(r.record.unlocked.kills_beasts_t1, 42);
  assert.equal(r.record.unlocked.depth_t1, 43);
  const again = fold(r.record, [], {}, {}, 99999);
  assert.equal(again.record.unlocked.kills_beasts_t1, 42);
  assert.deepEqual(again.unlocks, []);
});

test("progress: a kill moves each Beasts tier by one; a clamped or unchanged value reports nothing; standard entries never appear", () => {
  const covered = { depth: 1, days: 1 };
  const r = fold(seedRecord({ kills: { Beasts: 49 }, bests: covered }), [ev("foeKilled", { group: "Beasts" })]);
  assert.deepEqual(r.progress, [
    { id: "kills_beasts_t1", value: 50, steps: 50 },
    { id: "kills_beasts_t2", value: 50, steps: 100 },
    { id: "kills_beasts_t3", value: 50, steps: 200 },
    { id: "kills_beasts_t4", value: 50, steps: 500 },
  ]);
  const clamped = fold(seedRecord({ kills: { Beasts: 99 }, bests: covered }), [ev("foeKilled", { group: "Beasts" })]);
  assert.deepEqual(clamped.progress.map((p) => p.id), ["kills_beasts_t2", "kills_beasts_t3", "kills_beasts_t4"]);
  assert.equal(clamped.progress[0].value, 100);
  const quiet = fold(r.record, [ev("foeKilled", { group: "Demons" })]);
  assert.ok(quiet.progress.every((p) => !p.id.startsWith("kills_beasts")));
  const mixed = fold(emptyRecord(), [ev("died", { cause: "combat" })], { floor: { depth: 10 } });
  const standard = new Set(ACHIEVEMENTS.filter((a) => a.type === "standard").map((a) => a.id));
  assert.ok(mixed.progress.length > 0);
  for (const p of mixed.progress) assert.equal(standard.has(p.id), false, p.id);
});

test("progress: single-run entries read their best, Tourist its set size, and progressFor agrees with the fold", () => {
  const r = fold(emptyRecord(), [], { floor: { depth: 7 }, day: 3 });
  const depth2 = r.progress.find((p) => p.id === "depth_t2");
  assert.deepEqual(depth2, { id: "depth_t2", value: 7, steps: 10 });
  assert.deepEqual(r.progress.find((p) => p.id === "survivor_t1"), { id: "survivor_t1", value: 3, steps: 10 });
  assert.deepEqual(progressFor(r.record, entryOf("depth_t2")), { value: 7, steps: 10 });
  assert.deepEqual(progressFor(r.record, entryOf("depth_t1")), { value: 5, steps: 5 });
  assert.equal(progressFor(r.record, entryOf("race_human")), null);
  assert.deepEqual(progressFor(null, entryOf("tourist")), { value: 0, steps: 24 });
  const tour = beginRun(emptyRecord(), mkState({ c: { sub: "Ninja" } }), OPTS);
  assert.deepEqual(tour.progress, [{ id: "tourist", value: 1, steps: 24 }]);
  assert.deepEqual(progressFor(tour.record, entryOf("tourist")), { value: 1, steps: 24 });
  for (const p of r.progress) assert.deepEqual(progressFor(r.record, entryOf(p.id)), { value: p.value, steps: p.steps });
});

test("TRACK-02 boundary: Hoarder IV unlocks at exactly 10000 wilmst held and not at 9999", () => {
  const low = fold(emptyRecord(), [], { c: { gold: 9999 } });
  assert.equal(low.unlocks.some((u) => u.id === "hoarder_t4"), false);
  assert.equal(low.unlocks.some((u) => u.id === "hoarder_t3"), true);
  const high = fold(low.record, [], { c: { gold: 10000 } });
  assert.deepEqual(high.unlocks.map((u) => u.id), ["hoarder_t4"]);
  assert.equal(fold(high.record, [], { c: { gold: 0 } }).record.bests.wilmstHeld, 10000);
});

test("bests: race and parent class keep their best depth; a different race does not unlock another race's entry", () => {
  const r = fold(emptyRecord(), [], { floor: { depth: 10 }, c: { race: "Troll", cls: "Thief" } });
  assert.equal(r.record.bests.depthByRace.Troll, 10);
  assert.equal(r.record.bests.depthByClass.Thief, 10);
  assert.equal(r.record.bests.depthByRace.Human, 0);
  const ids = r.unlocks.map((u) => u.id);
  assert.ok(ids.includes("race_troll") && ids.includes("class_thief"));
  assert.ok(!ids.includes("race_human") && !ids.includes("class_fighter"));
  assert.equal(fold(r.record, [], { floor: { depth: 3 }, c: { race: "Troll", cls: "Thief" } }).record.bests.depthByRace.Troll, 10);
  const alien = fold(emptyRecord(), [], { floor: { depth: 9 }, c: { race: "Martian", cls: "Jester" } });
  assert.equal(alien.record.bests.depth, 9);
  assert.equal("Martian" in alien.record.bests.depthByRace, false);
});

test("dev: foldAction with after.dev or before.dev true returns the same record and empty lists", () => {
  const rec = seedRecord({ kills: { Beasts: 49 } });
  const events = [ev("foeKilled", { group: "Beasts" }), ev("died", { cause: "combat" })];
  const a = foldAction(rec, events, mkState(), mkState({ dev: true }), OPTS);
  const b = foldAction(rec, events, mkState({ dev: true }), mkState(), OPTS);
  for (const r of [a, b]) {
    assert.equal(r.record, rec);
    assert.equal(r.changed, false);
    assert.deepEqual([r.unlocks, r.reveals, r.progress], [[], [], []]);
  }
});

test("TRACK-03 empty: no events, no new best and a matching run section returns changed false and the same object", () => {
  const state = mkState();
  const rec = seedRecord({
    run: { tag: runTagOf(state), seen: true, stepped: true, naked: false, teetotal: true, fleesWon: 0 },
    bests: { depth: 1, days: 1, depthByRace: { Human: 1 }, depthByClass: { Fighter: 1 } },
  });
  const r = foldAction(rec, [], state, state, OPTS);
  assert.equal(r.changed, false);
  assert.equal(r.record, rec);
  assert.deepEqual([r.unlocks, r.reveals, r.progress], [[], [], []]);
});

test("TRACK-03 empty: a null or undefined record behaves as emptyRecord; a missing or malformed state reads as empty and never throws", () => {
  for (const rec of [null, undefined]) {
    const r = fold(rec, [ev("foeKilled", { group: "Beasts" })]);
    assert.equal(r.record.kills.Beasts, 1);
  }
  const nothing = foldAction(null, [], null, null, OPTS);
  assert.equal(nothing.changed, false);
  assert.deepEqual(nothing.record, emptyRecord());
  const junk = foldAction(emptyRecord(), "not an array", undefined, { floor: "x", c: 5, day: "soon", steps: {} }, OPTS);
  assert.ok(junk.record.v === 1);
  const weird = foldAction(emptyRecord(), [null, 5, "x", {}, { type: 7 }], {}, { c: { worn: 3, gold: Infinity }, floor: null }, undefined);
  assert.equal(weird.record.bests.wilmstHeld, 0);
  assert.equal(foldAction(emptyRecord(), [], {}, { floor: { depth: 2 } }, { now: "later" }).record.bests.depth, 2);
});

test("precision: unlock dates are floored epoch milliseconds from options.now; a non-finite now records 0", () => {
  const rec = seedRecord({ kills: { Beasts: 49 } });
  const events = [ev("foeKilled", { group: "Beasts" })];
  assert.deepEqual(fold(rec, events, {}, {}, 1700000000123.9).unlocks, [{ id: "kills_beasts_t1", at: 1700000000123 }]);
  for (const now of [NaN, Infinity, -5, "now", undefined, null]) {
    // (options.now itself missing is covered by the same rule: it reads as 0)
    assert.deepEqual(foldAction(rec, events, mkState(), mkState(), { now }).unlocks, [{ id: "kills_beasts_t1", at: 0 }], String(now));
  }
});

test("filledSlotCount: Fists, Nothing and an empty worn object are 0; a full set is 5", () => {
  assert.equal(filledSlotCount({ weapon: "Fists", armor: "Nothing", worn: {} }), 0);
  assert.equal(filledSlotCount({}), 0);
  assert.equal(filledSlotCount(null), 0);
  assert.equal(filledSlotCount({ weapon: "Club", armor: "Leather", worn: { jewelry1: { n: "Ring" }, jewelry2: { n: "Ring" }, cloak: { n: "Cloak" } } }), 5);
  assert.equal(filledSlotCount({ weapon: "Club", armor: "Nothing", worn: { cloak: {} } }), 2);
  assert.equal(filledSlotCount({ weapon: "Fists", armor: "Leather", armorWP: 0, worn: {}, bag: [{ n: "Sword" }], torch: 9 }), 1);
});

test("runTagOf: seed, race, sub-class and name joined with a pipe", () => {
  assert.equal(runTagOf(mkState({ seed: 77 })), "77|Human|Soldier|Test Delver");
  assert.equal(typeof runTagOf(null), "string");
  assert.ok(runTagOf({}).length > 0);
});

test("purity: deep-frozen record, events, before and after fold without throwing and stay equal to their JSON", () => {
  const rec = deepFreeze(seedRecord({ kills: { Beasts: 49 }, counters: { deaths: 49 } }));
  const events = deepFreeze([ev("foeKilled", { group: "Beasts" }), ev("trapSprung", { name: "Pit" }), ev("died", { cause: "combat" })]);
  const before = deepFreeze(mkState());
  const after = deepFreeze(mkState({ floor: { depth: 5 } }));
  const snapshots = [rec, events, before, after].map((v) => JSON.stringify(v));
  const r = foldAction(rec, events, before, after, { now: NOW, catalog: deepFreeze([...ACHIEVEMENTS]) });
  assert.deepEqual([rec, events, before, after].map((v) => JSON.stringify(v)), snapshots);
  assert.ok(r.unlocks.length > 0);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.record) && Object.isFrozen(r.unlocks) && Object.isFrozen(r.reveals) && Object.isFrozen(r.progress));
  const begun = beginRun(rec, before, OPTS);
  assert.ok(Object.isFrozen(begun) && Object.isFrozen(begun.record));
  assert.equal(JSON.stringify(rec), snapshots[0]);
});

test("TRACK-05: the tracker imports only the allowed modules and reads no clock, random source, DOM or storage", () => {
  const source = fs.readFileSync(new URL("../../src/browser/achievementTracker.js", import.meta.url), "utf8");
  const specs = [...source.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
  const allowed = new Set([
    "../../content/achievements.js",
    "../../content/bestiary.js",
    "../../content/races.js",
    "../../content/classes.js",
    "./achievementRecord.js",
  ]);
  assert.ok(specs.length >= 4);
  for (const s of specs) assert.ok(allowed.has(s), `unexpected import ${s}`);
  assert.equal(/engine\/|storage\.js|engineAdapter/.test(specs.join("\n")), false);
  const code = source.replace(/\/\/.*$/gm, "");
  for (const banned of [/\bDate\b/, /Math\.random/, /performance\./, /\bwindow\b/, /\bdocument\b/, /localStorage/, /Capacitor/, /\bfetch\b/, /setTimeout/]) {
    assert.equal(banned.test(code), false, String(banned));
  }
});
