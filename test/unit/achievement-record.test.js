// test/unit/achievement-record.test.js
//
// Phase 99 (TRACK-02). src/browser/achievementRecord.js: the lifetime stats
// record's fixed shape, tolerant load and byte-stable round-trip.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  ACHIEVEMENTS_KEY,
  RECORD_VERSION,
  emptyRecord,
  sanitizeRecord,
  parseRecord,
  serializeRecord,
} from "../../src/browser/achievementRecord.js";
import * as recordModule from "../../src/browser/achievementRecord.js";
import { BESTIARY } from "../../content/bestiary.js";
import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { seedRecord } from "./harness/achievementState.js";

const v1 = (extra) => ({ ...JSON.parse(serializeRecord(emptyRecord())), ...extra });

test("TRACK-02: the key and the version are fixed, apart from the run save", () => {
  assert.equal(ACHIEVEMENTS_KEY, "ddr.achievements.v1");
  assert.notEqual(ACHIEVEMENTS_KEY, "ddr.delve.v1");
  assert.equal(RECORD_VERSION, 1);
});

test("TRACK-02: the module exports exactly the six names and imports only content/", () => {
  assert.deepEqual(Object.keys(recordModule).sort(), [
    "ACHIEVEMENTS_KEY",
    "RECORD_VERSION",
    "emptyRecord",
    "parseRecord",
    "sanitizeRecord",
    "serializeRecord",
  ]);
  const source = fs.readFileSync(new URL("../../src/browser/achievementRecord.js", import.meta.url), "utf8");
  const specs = [...source.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const s of specs) assert.ok(s.startsWith("../../content/"), `unexpected import ${s}`);
});

test("TRACK-02 empty: emptyRecord has every key present at zero, false, [] or {}", () => {
  const r = emptyRecord();
  assert.equal(r.v, 1);
  assert.deepEqual(Object.keys(r), ["v", "counters", "kills", "bests", "flags", "subClassesDelved", "unlocked", "revealed", "run"]);
  assert.deepEqual(r.counters, { deaths: 0, joinersAccepted: 0, joinersFallen: 0, parleysWon: 0, trapsSurvived: 0 });
  assert.deepEqual(Object.keys(r.kills), Object.keys(BESTIARY));
  assert.deepEqual(Object.keys(r.kills), ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"]);
  assert.ok(Object.values(r.kills).every((n) => n === 0));
  assert.equal(r.bests.depth, 0);
  assert.equal(r.bests.days, 0);
  assert.equal(r.bests.wilmstHeld, 0);
  assert.equal(r.bests.fleesWon, 0);
  assert.deepEqual(Object.keys(r.bests.depthByRace), Object.keys(RACES));
  assert.deepEqual(Object.keys(r.bests.depthByClass), Object.keys(CLASSES));
  assert.ok(Object.values(r.bests.depthByRace).every((n) => n === 0));
  assert.ok(Object.values(r.bests.depthByClass).every((n) => n === 0));
  assert.deepEqual(r.flags, { diseaseLeftOnOneHp: false, poisonLeftOnOneHp: false });
  assert.deepEqual(r.subClassesDelved, []);
  assert.deepEqual(r.unlocked, {});
  assert.deepEqual(r.revealed, []);
  assert.equal(r.run, null);
});

test("TRACK-02: emptyRecord is deep-frozen", () => {
  "use strict";
  const r = emptyRecord();
  assert.throws(() => {
    r.counters.deaths = 5;
  }, TypeError);
  assert.throws(() => {
    r.kills.Beasts = 5;
  }, TypeError);
  assert.throws(() => {
    r.revealed.push("chicken");
  }, TypeError);
  assert.throws(() => {
    r.bests.depthByRace.Human = 3;
  }, TypeError);
  assert.ok(Object.isFrozen(r));
});

test("TRACK-02 empty: parseRecord of unreadable input is the empty record", () => {
  const empty = emptyRecord();
  for (const input of [null, undefined, "", "null", "not json", "[]", "{}", "5", '"text"']) {
    assert.deepEqual(parseRecord(input), empty, `input ${JSON.stringify(input)}`);
  }
});

test("TRACK-02: an older-shape or newer-shape record (v not 1) loads as zeros with no migration", () => {
  const populated = v1({ counters: { deaths: 9, joinersAccepted: 1, joinersFallen: 1, parleysWon: 1, trapsSurvived: 1 } });
  for (const v of [0, 2, "1", null, undefined]) {
    const text = JSON.stringify({ ...populated, v });
    assert.deepEqual(parseRecord(text), emptyRecord(), `v ${String(v)}`);
  }
});

test("TRACK-02: a v1 record with bad fields keeps every valid field and zeroes only the bad ones", () => {
  const text = JSON.stringify(
    v1({
      counters: { deaths: "x", joinersAccepted: 4, bogus: 99, joinersFallen: 2, parleysWon: 0, trapsSurvived: 7 },
      kills: { Beasts: -3, Demons: 12, "Not A Group": 40 },
      bests: { depth: 7.9, days: 30, wilmstHeld: Infinity, fleesWon: 2 },
    }),
  );
  const r = parseRecord(text);
  assert.equal(r.counters.deaths, 0);
  assert.equal(r.counters.joinersAccepted, 4);
  assert.equal(r.counters.joinersFallen, 2);
  assert.equal(r.counters.trapsSurvived, 7);
  assert.equal("bogus" in r.counters, false);
  assert.equal(r.kills.Beasts, 0);
  assert.equal(r.kills.Demons, 12);
  assert.equal("Not A Group" in r.kills, false);
  assert.equal(r.bests.depth, 7);
  assert.equal(r.bests.days, 30);
  assert.equal(r.bests.wilmstHeld, 0);
  assert.equal(r.bests.fleesWon, 2);
});

test("TRACK-02 boundary: numbers above MAX_SAFE_INTEGER cap, negatives, fractions, NaN and non-numbers sanitize", () => {
  const raw = v1({
    counters: { deaths: 1e300, joinersAccepted: -1, joinersFallen: 2.9, parleysWon: NaN, trapsSurvived: "5" },
    bests: { depth: Number.MAX_SAFE_INTEGER + 10, days: -0.5, wilmstHeld: null, fleesWon: {} },
  });
  const r = sanitizeRecord(raw);
  assert.equal(r.counters.deaths, Number.MAX_SAFE_INTEGER);
  assert.equal(r.counters.joinersAccepted, 0);
  assert.equal(r.counters.joinersFallen, 2);
  assert.equal(r.counters.parleysWon, 0);
  assert.equal(r.counters.trapsSurvived, 0);
  assert.equal(r.bests.depth, Number.MAX_SAFE_INTEGER);
  assert.equal(r.bests.days, 0);
  assert.equal(r.bests.wilmstHeld, 0);
  assert.equal(r.bests.fleesWon, 0);
});

test("TRACK-02 flags: only exactly true sets a lifetime flag", () => {
  const r = sanitizeRecord(v1({ flags: { diseaseLeftOnOneHp: true, poisonLeftOnOneHp: "true" } }));
  assert.deepEqual(r.flags, { diseaseLeftOnOneHp: true, poisonLeftOnOneHp: false });
});

test("TRACK-04: unlocked keeps catalog ids with their integer time, drops a non-catalog id, keeps a bad time at 0", () => {
  const r = sanitizeRecord(v1({ unlocked: { depth_t1: 1700000000123.8, not_an_id: 5, kills_beasts_t1: "bad", depth_t2: -4 } }));
  assert.equal(r.unlocked.depth_t1, 1700000000123);
  assert.equal("not_an_id" in r.unlocked, false);
  assert.equal(r.unlocked.kills_beasts_t1, 0);
  assert.equal(r.unlocked.depth_t2, 0);
  assert.equal(Object.keys(r.unlocked).length, 3);
});

test("TRACK-02 adjacency: revealed drops Revealed-state and unknown ids, dedupes, and gains an unlocked Hidden id", () => {
  const r = sanitizeRecord(v1({ revealed: ["death_trap", "depth_t1", "nope", "death_trap", 7], unlocked: { chicken: 5 } }));
  assert.deepEqual(r.revealed, ["death_trap", "chicken"]);
});

test("TRACK-02 ordering: revealed keeps reveal order without duplicates", () => {
  const r = sanitizeRecord(v1({ revealed: ["chicken", "death_trap", "chicken", "death_falling"] }));
  assert.deepEqual(r.revealed, ["chicken", "death_trap", "death_falling"]);
});

test("TRACK-02 ordering: subClassesDelved keeps real sub-class names in first-seen order, dropping duplicates and unknown names", () => {
  const r = sanitizeRecord(v1({ subClassesDelved: ["Ninja", "Wizard", "Ninja", "Plumber", 3, "Bard"] }));
  assert.deepEqual(r.subClassesDelved, ["Ninja", "Wizard", "Bard"]);
});

test("TRACK-02: run survives only with a non-empty string tag; booleans coerce by === true", () => {
  const kept = sanitizeRecord(v1({ run: { tag: "a|b", seen: true, stepped: "yes", naked: true, teetotal: 1, fleesWon: 3.7, extra: 1 } }));
  assert.deepEqual(kept.run, { tag: "a|b", seen: true, stepped: false, naked: true, teetotal: false, fleesWon: 3 });
  for (const run of [{ seen: true }, { tag: "" }, { tag: 5 }, null, "x", []]) {
    assert.equal(sanitizeRecord(v1({ run })).run, null, JSON.stringify(run));
  }
});

test("TRACK-02 idempotency: parseRecord(serializeRecord(r)) deep-equals r for a fully populated record", () => {
  const r = seedRecord({
    counters: { deaths: 3, joinersAccepted: 4, joinersFallen: 5, parleysWon: 6, trapsSurvived: 7 },
    kills: { Beasts: 8, Demons: 9, Humans: 10, "Lair Beasts": 11, Magical: 12, "Walking Dead": 13 },
    bests: { depth: 6, days: 12, wilmstHeld: 2500, fleesWon: 3, depthByRace: { Human: 6, Troll: 2 }, depthByClass: { Fighter: 6 } },
    flags: { diseaseLeftOnOneHp: true },
    subClassesDelved: ["Soldier", "Ninja"],
    unlocked: { depth_t1: 111, chicken: 222 },
    revealed: ["death_falling"],
    run: { tag: "1|Human|Soldier|Test", seen: true, stepped: true, naked: false, teetotal: true, fleesWon: 2 },
  });
  const text = serializeRecord(r);
  assert.deepEqual(parseRecord(text), r);
  assert.equal(serializeRecord(parseRecord(text)), text);
  assert.equal(serializeRecord(r), text);
  assert.ok(r.revealed.includes("chicken"));
});

test("TRACK-02 idempotency: sanitizeRecord of an already-sanitized record returns an equal record", () => {
  const r = seedRecord({ counters: { deaths: 4 }, unlocked: { depth_t1: 5 }, subClassesDelved: ["Ninja"] });
  assert.deepEqual(sanitizeRecord(r), r);
  assert.equal(serializeRecord(sanitizeRecord(r)), serializeRecord(r));
});

test("TRACK-02: every record sanitize returns is deep-frozen", () => {
  const r = sanitizeRecord(v1({ unlocked: { depth_t1: 5 }, subClassesDelved: ["Ninja"], run: { tag: "t" } }));
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.unlocked) && Object.isFrozen(r.subClassesDelved) && Object.isFrozen(r.run));
});

test("TRACK-02 precision: the serialized record is plain JSON text (no rounding contract beyond flooring)", () => {
  const text = serializeRecord(emptyRecord());
  assert.equal(typeof text, "string");
  assert.equal(JSON.parse(text).v, 1);
});
