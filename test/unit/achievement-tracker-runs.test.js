// test/unit/achievement-tracker-runs.test.js
//
// Phase 99 (TRACK-03). The run-scoped rulings of 98-CONTEXT "What counts":
// the run tag, a run the tracker did not see start, Chicken, Naked Ambition,
// Teetotaler and Fully Dressed.

import test from "node:test";
import assert from "node:assert/strict";

import { beginRun, foldAction, runTagOf } from "../../src/browser/achievementTracker.js";
import { emptyRecord, parseRecord, serializeRecord } from "../../src/browser/achievementRecord.js";
import { mkState, ev, seedRecord } from "./harness/achievementState.js";

const NOW = 7000;
const BARE = { weapon: "Fists", armor: "Nothing", worn: {} };
const CLOTHED = { weapon: "Club", armor: "Leather", worn: {} };
const FULL = { weapon: "Club", armor: "Leather", worn: { jewelry1: { n: "Ring" }, jewelry2: { n: "Ring" }, cloak: { n: "Cloak" } } };

/** state(over) — a state of the run seeded 7 (so every fold in a test shares one run tag). */
const state = (over = {}) => mkState({ seed: 7, ...over });
const bare = (over = {}) => state({ ...over, c: { ...BARE, ...(over.c || {}) } });
const clothed = (over = {}) => state({ ...over, c: { ...CLOTHED, ...(over.c || {}) } });

const act = (rec, events, before, after, now = NOW) => foldAction(rec, events, before, after, { now });
const ids = (res) => res.unlocks.map((u) => u.id);
const flee = (reason) => ev("fled", { reason });

/** startSeen(s) — a record for a run the tracker saw start, in state s. */
const startSeen = (s) => beginRun(emptyRecord(), s, { now: NOW }).record;

test("run tag: beginRun sets the run section; the tag is seed, race, sub-class and name", () => {
  const s = state();
  const r = beginRun(emptyRecord(), s, { now: NOW });
  assert.deepEqual(r.record.run, { tag: runTagOf(s), seen: true, stepped: false, naked: true, teetotal: true, fleesWon: 0 });
  assert.equal(runTagOf(s), "7|Human|Soldier|Test Delver");
});

test("run tag: folds with the same tag keep the run's progress", () => {
  const s = state();
  let rec = startSeen(s);
  rec = act(rec, [flee("escaped"), ev("potionDrunk", { amount: 3 })], s, s).record;
  rec = act(rec, [flee("escaped")], s, s).record;
  assert.deepEqual(rec.run, { tag: runTagOf(s), seen: true, stepped: false, naked: true, teetotal: false, fleesWon: 2 });
});

test("run tag: a fold whose state has a different tag replaces the run with an unseen one", () => {
  const rec = startSeen(state());
  const other = state({ seed: 8 });
  const r = act(rec, [], other, other);
  assert.deepEqual(r.record.run, { tag: runTagOf(other), seen: false, stepped: true, naked: false, teetotal: false, fleesWon: 0 });
  assert.equal(r.changed, true);
});

test("relaunch mid-run: serialize, parse, then fold the same run's next action; the run section carries on", () => {
  const s = bare();
  let rec = startSeen(s);
  rec = act(rec, [ev("moved", { to: { x: 1, y: 1 } }), flee("escaped")], s, bare({ steps: 1 })).record;
  assert.equal(rec.run.stepped, true);
  assert.equal(rec.run.naked, true);
  const reloaded = parseRecord(serializeRecord(rec));
  assert.deepEqual(reloaded.run, rec.run);
  const next = act(reloaded, [flee("escaped"), ev("potionDrunk", {})], bare({ steps: 1 }), bare({ steps: 2 }));
  assert.deepEqual(next.record.run, { tag: runTagOf(s), seen: true, stepped: true, naked: true, teetotal: false, fleesWon: 2 });
});

test("pre-2.5 resumed run (record.run null): floor 5 unlocks depth but never Naked Ambition or Teetotaler", () => {
  const r = act(emptyRecord(), [], bare(), bare({ floor: { depth: 5 }, steps: 40 }));
  assert.ok(ids(r).includes("depth_t1"));
  assert.equal(ids(r).includes("naked_ambition"), false);
  assert.equal(ids(r).includes("teetotaler"), false);
  assert.equal(r.record.run.seen, false);
  const deeper = act(r.record, [], bare({ floor: { depth: 5 } }), bare({ floor: { depth: 9 }, steps: 80 }));
  assert.equal(ids(deeper).includes("naked_ambition") || ids(deeper).includes("teetotaler"), false);
});

test("pre-2.5 resumed run: Fully Dressed and Chicken still count from the moment the run is seen", () => {
  const dressed = act(emptyRecord(), [], state(), state({ c: FULL }));
  assert.ok(ids(dressed).includes("fully_dressed"));
  let rec = emptyRecord();
  const s = state();
  let last;
  for (let i = 0; i < 10; i++) {
    last = act(rec, [flee("escaped")], s, s);
    rec = last.record;
  }
  assert.ok(ids(last).includes("chicken"));
});

test("Chicken: only escaped counts; door, cloaker, tracked and smoke add none", () => {
  const s = state();
  let rec = startSeen(s);
  rec = act(rec, [flee("door"), flee("cloaker"), flee("tracked"), flee("smoke"), { type: "fled" }], s, s).record;
  assert.equal(rec.run.fleesWon, 0);
  rec = act(rec, [flee("escaped")], s, s).record;
  assert.equal(rec.run.fleesWon, 1);
});

test("Chicken: the 10th escaped flee in one run unlocks it, the 9th does not", () => {
  const s = state();
  let rec = startSeen(s);
  let res;
  for (let i = 1; i <= 9; i++) {
    res = act(rec, [flee("escaped")], s, s);
    rec = res.record;
    assert.equal(ids(res).includes("chicken"), false, `flee ${i}`);
  }
  res = act(rec, [flee("escaped")], s, s);
  assert.deepEqual(ids(res), ["chicken"]);
  assert.deepEqual(res.reveals, ["chicken"]);
  assert.equal(res.record.bests.fleesWon, 10);
});

test("Chicken: 9 in one run, then a new run, then 1 more does not unlock; bests keeps the best run's count", () => {
  const s1 = state();
  let rec = startSeen(s1);
  rec = act(rec, Array.from({ length: 9 }, () => flee("escaped")), s1, s1).record;
  assert.equal(rec.bests.fleesWon, 9);
  const s2 = state({ seed: 8 });
  rec = beginRun(rec, s2, { now: NOW }).record;
  assert.equal(rec.run.fleesWon, 0);
  const res = act(rec, [flee("escaped")], s2, s2);
  assert.equal(ids(res).includes("chicken"), false);
  assert.equal(res.record.run.fleesWon, 1);
  assert.equal(res.record.bests.fleesWon, 9);
});

test("Naked Ambition: a bare first step and floor 5 with nothing filled unlocks it; floor 4 does not", () => {
  const s0 = bare();
  let rec = startSeen(s0);
  const step = act(rec, [ev("moved", { to: { x: 2, y: 2 } })], s0, bare({ steps: 1 }));
  assert.equal(step.record.run.stepped, true);
  assert.equal(step.record.run.naked, true);
  const four = act(step.record, [], bare({ steps: 1 }), bare({ steps: 30, floor: { depth: 4 } }));
  assert.equal(ids(four).includes("naked_ambition"), false);
  const five = act(four.record, [], bare({ steps: 30, floor: { depth: 4 } }), bare({ steps: 40, floor: { depth: 5 } }));
  assert.ok(ids(five).includes("naked_ambition"));
  assert.deepEqual(five.reveals.includes("naked_ambition"), true);
});

test("Naked Ambition: any slot filled at the first step never unlocks it", () => {
  const s0 = clothed();
  const rec = startSeen(s0);
  const step = act(rec, [ev("moved", { to: { x: 2, y: 2 } })], s0, clothed({ steps: 1 }));
  assert.equal(step.record.run.naked, false);
  const five = act(step.record, [], clothed({ steps: 1 }), bare({ steps: 40, floor: { depth: 5 } }));
  assert.equal(ids(five).includes("naked_ambition"), false);
});

test("Naked Ambition: filled on floor 3 and emptied again never unlocks it", () => {
  const s0 = bare();
  let rec = startSeen(s0);
  rec = act(rec, [ev("moved", {})], s0, bare({ steps: 1 })).record;
  rec = act(rec, [], bare({ steps: 1 }), clothed({ steps: 20, floor: { depth: 3 } })).record;
  assert.equal(rec.run.naked, false);
  rec = act(rec, [], clothed({ steps: 20, floor: { depth: 3 } }), bare({ steps: 30, floor: { depth: 3 } })).record;
  const five = act(rec, [], bare({ steps: 30, floor: { depth: 3 } }), bare({ steps: 50, floor: { depth: 5 } }));
  assert.equal(ids(five).includes("naked_ambition"), false);
});

test("Naked Ambition: slots filled and emptied again before the first step do not matter", () => {
  const s0 = clothed();
  let rec = startSeen(s0);
  const unequip = act(rec, [], s0, bare());
  assert.equal(unequip.record.run.stepped, false);
  assert.equal(unequip.record.run.naked, true);
  rec = act(unequip.record, [ev("moved", {})], bare(), bare({ steps: 1 })).record;
  assert.equal(rec.run.naked, true);
  const five = act(rec, [], bare({ steps: 1 }), bare({ steps: 40, floor: { depth: 5 } }));
  assert.ok(ids(five).includes("naked_ambition"));
});

test("Naked Ambition: a step seen only as after.steps above before.steps is the first step", () => {
  const s0 = bare();
  const rec = startSeen(s0);
  const step = act(rec, [], s0, bare({ steps: 1 }));
  assert.equal(step.record.run.stepped, true);
  assert.equal(step.record.run.naked, true);
  const dressedStep = act(startSeen(clothed()), [], clothed(), clothed({ steps: 1 }));
  assert.equal(dressedStep.record.run.naked, false);
});

test("Naked Ambition: bag items and the torch are never read", () => {
  const s0 = bare({ c: { bag: [{ n: "Sword" }, { n: "Plate" }], torch: 50 } });
  let rec = startSeen(s0);
  rec = act(rec, [ev("moved", {})], s0, bare({ steps: 1, c: { bag: [{ n: "Sword" }], torch: 49 } })).record;
  const five = act(rec, [], s0, bare({ steps: 40, floor: { depth: 5 }, c: { bag: [{ n: "Sword" }], torch: 3 } }));
  assert.ok(ids(five).includes("naked_ambition"));
});

test("Teetotaler: floor 5 with no healing potion unlocks it and reveals Read the Label", () => {
  const s0 = state();
  const rec = startSeen(s0);
  const four = act(rec, [], s0, state({ floor: { depth: 4 } }));
  assert.equal(ids(four).includes("teetotaler"), false);
  const five = act(four.record, [], state({ floor: { depth: 4 } }), state({ floor: { depth: 5 } }));
  assert.ok(ids(five).includes("teetotaler"));
  assert.ok(five.reveals.includes("read_the_label"));
});

test("Teetotaler: one potionDrunk earlier in the run blocks it; memberPotionDrunk does not; a new run resets it", () => {
  const s0 = state();
  let rec = startSeen(s0);
  rec = act(rec, [ev("potionDrunk", { amount: 4 })], s0, state({ floor: { depth: 2 } })).record;
  const blocked = act(rec, [], state({ floor: { depth: 2 } }), state({ floor: { depth: 5 } }));
  assert.equal(ids(blocked).includes("teetotaler"), false);

  const s1 = state({ seed: 9 });
  let rec2 = startSeen(s1);
  rec2 = act(rec2, [ev("memberPotionDrunk", { member: "Ann" }), ev("magicPotionDrunk", {})], s1, state({ seed: 9, floor: { depth: 2 } })).record;
  assert.equal(rec2.run.teetotal, true);
  const okRun = act(rec2, [], state({ seed: 9, floor: { depth: 2 } }), state({ seed: 9, floor: { depth: 5 } }));
  assert.ok(ids(okRun).includes("teetotaler"));

  const fresh = beginRun(blocked.record, state({ seed: 10 }), { now: NOW });
  assert.equal(fresh.record.run.teetotal, true);
  const again = act(fresh.record, [], state({ seed: 10 }), state({ seed: 10, floor: { depth: 5 } }));
  assert.ok(ids(again).includes("teetotaler"));
});

test("Fully Dressed: Fists, armor Nothing, or any of jewelry1, jewelry2 or cloak missing is not dressed", () => {
  const s = state();
  const rec = startSeen(s);
  const variants = [
    { ...FULL, weapon: "Fists" },
    { ...FULL, armor: "Nothing" },
    { ...FULL, worn: { jewelry2: {}, cloak: {} } },
    { ...FULL, worn: { jewelry1: {}, cloak: {} } },
    { ...FULL, worn: { jewelry1: {}, jewelry2: {} } },
  ];
  for (const c of variants) assert.equal(ids(act(rec, [], s, state({ c }))).includes("fully_dressed"), false, JSON.stringify(c));
});

test("Fully Dressed: all five at once unlocks it in a seen run and reveals Naked Ambition", () => {
  const s = state();
  const rec = startSeen(s);
  const r = act(rec, [], s, state({ c: FULL }));
  assert.deepEqual(ids(r), ["fully_dressed"]);
  assert.deepEqual(r.reveals, ["naked_ambition"]);
  assert.equal(r.record.revealed.includes("naked_ambition"), true);
});

test("Fully Dressed: a destroyed armor piece still named in c.armor counts as filled", () => {
  const s = state();
  const r = act(startSeen(s), [], s, state({ c: { ...FULL, armorWP: 0 } }));
  assert.ok(ids(r).includes("fully_dressed"));
});

test("dev run: the run-scoped rules earn nothing", () => {
  const dev = state({ dev: true, c: FULL });
  const r = act(seedRecord({}), [flee("escaped")], dev, dev);
  assert.equal(r.changed, false);
  assert.equal(beginRun(emptyRecord(), dev, { now: NOW }).changed, false);
});
