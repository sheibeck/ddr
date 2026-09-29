// test/unit/runHistory.test.js
//
// Phase 84 (BOARD-26). Covers src/browser/runHistory.js: historyRecordOf's
// validation, sanitizeHistory's tolerant-load/dedupe/sort/cap, appendRun's
// 500-run cap, mergeHistories' never-shrinks union, importLegacy's
// 2.1.0-cutoff import (and version-preservation on an already-held run),
// newBestsAgainst's history-based new-best comparison (including the
// capped DAYS rule), serializeHistory, and purity (never throws, never
// mutates its inputs, no DOM/storage globals in source).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  RUN_HISTORY_KEY,
  RUN_HISTORY_CAP,
  RUN_HISTORY_FIELDS,
  IMPORT_VERSION,
  historyRecordOf,
  sanitizeHistory,
  appendRun,
  mergeHistories,
  importLegacy,
  newBestsAgainst,
  serializeHistory,
} from "../../src/browser/runHistory.js";
import { BACKFILL_SINCE_MS, BACKFILL_VERSION } from "../../src/browser/runBackfill.js";
import { rankKeyOf } from "../../src/browser/runDoc.js";
import { runHash, emptyBests, updateBests } from "../../engine/records.js";
import { SEASON } from "../../content/season.js";
import { newRun } from "../../engine/engine.js";
import { buildRunSummary } from "../../engine/death.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/* ---------------- helpers ---------------- */

/** summary(overrides) — a RunSummary-shaped fixture (engine/death.js#buildRunSummary's
 * own field names), hashed via engine/records.js#runHash unless the caller
 * supplies its own `hash`. */
function summary(overrides = {}) {
  const s = {
    name: "Test Hero", race: "Human", sub: "Knight", cls: "Fighter",
    level: 1, sp: 40, floor: 5, day: 3, steps: 500, gold: 100, kills: 10,
    cause: "combat", note: "died", epitaph: "", when: BACKFILL_SINCE_MS,
    season: SEASON, seed: 12345, acts: 10,
    ...overrides,
  };
  if (!("hash" in overrides)) s.hash = runHash(s);
  return s;
}

/** record(overrides) — a valid historyRecordOf() output built from summary(). */
function record(overrides = {}) {
  const version = overrides.version ?? "dev";
  return historyRecordOf(summary(overrides), version);
}

/** rawRecord(overrides) — a plain, already RUN_HISTORY_FIELDS-shaped object,
 * for exercising sanitizeHistory/appendRun/mergeHistories directly without
 * going through historyRecordOf's own hash computation. */
function rawRecord(overrides = {}) {
  return {
    hash: "aaaaaaaa", name: "Hero", race: "Human", cls: "Fighter", sub: "Knight",
    level: 1, floor: 1, day: 1, steps: 1, kills: 0, gold: 0, sp: 0,
    cause: "combat", note: "died", epitaph: "", when: 100, version: "dev", season: SEASON,
    ...overrides,
  };
}

function foldBests(summaries) {
  let rec = emptyBests();
  for (const s of summaries) rec = updateBests(rec, s).record;
  return rec;
}

/* ================================================================
   constants
   ================================================================ */

test("constants: RUN_HISTORY_KEY, RUN_HISTORY_CAP, RUN_HISTORY_FIELDS, IMPORT_VERSION", () => {
  assert.equal(RUN_HISTORY_KEY, "ddr.runs.v1");
  assert.equal(RUN_HISTORY_CAP, 500);
  assert.deepStrictEqual(RUN_HISTORY_FIELDS, [
    "hash", "name", "race", "cls", "sub", "level", "floor", "day", "steps",
    "kills", "gold", "sp", "cause", "note", "epitaph", "when", "version", "season",
  ]);
  assert.ok(Object.isFrozen(RUN_HISTORY_FIELDS));
  assert.equal(IMPORT_VERSION, BACKFILL_VERSION);
});

/* ================================================================
   historyRecordOf
   ================================================================ */

test("historyRecordOf: a valid summary builds a frozen record with exactly RUN_HISTORY_FIELDS", () => {
  const s = summary();
  const rec = historyRecordOf(s, "2.1.0 (11)");
  assert.ok(rec);
  assert.deepStrictEqual(Object.keys(rec).sort(), [...RUN_HISTORY_FIELDS].sort());
  assert.ok(Object.isFrozen(rec));
  assert.equal(rec.hash, s.hash);
  assert.equal(rec.version, "2.1.0 (11)");
  assert.equal(rec.season, SEASON);
});

test("historyRecordOf accepts a real buildRunSummary output from a fresh engine run", () => {
  const state = newRun(4242);
  const s = buildRunSummary(state, "combat", 12345);
  const rec = historyRecordOf(s, "dev");
  assert.ok(rec);
  assert.equal(rec.hash, s.hash);
  assert.equal(rec.when, 12345);
});

test("historyRecordOf: null for a bad hash, a non-integer when, an empty/non-string name/race/cls/sub, or a negative/non-integer numeric field", () => {
  assert.equal(historyRecordOf(null, "v"), null);
  assert.equal(historyRecordOf("garbage", "v"), null);
  assert.equal(historyRecordOf(summary({ hash: "NOTHEX!!" }), "v"), null);
  assert.equal(historyRecordOf(summary({ hash: "ABCDEF12" }), "v"), null, "uppercase hex is rejected");
  assert.equal(historyRecordOf(summary({ when: 1.5 }), "v"), null);
  assert.equal(historyRecordOf(summary({ when: "nope" }), "v"), null);
  assert.equal(historyRecordOf(summary({ when: Infinity }), "v"), null);
  assert.equal(historyRecordOf(summary({ name: "" }), "v"), null);
  assert.equal(historyRecordOf(summary({ race: 5 }), "v"), null);
  assert.equal(historyRecordOf(summary({ cls: "" }), "v"), null);
  assert.equal(historyRecordOf(summary({ sub: null }), "v"), null);
  assert.equal(historyRecordOf(summary({ level: -1 }), "v"), null);
  assert.equal(historyRecordOf(summary({ floor: 1.5 }), "v"), null);
  assert.equal(historyRecordOf(summary({ day: "x" }), "v"), null);
  assert.equal(historyRecordOf(summary({ steps: -1 }), "v"), null);
  assert.equal(historyRecordOf(summary({ kills: -1 }), "v"), null);
  assert.equal(historyRecordOf(summary({ gold: -1 }), "v"), null);
  assert.equal(historyRecordOf(summary({ sp: -1 }), "v"), null);
});

test("historyRecordOf: note/epitaph/cause/version fall back to '' when not a string; season defaults to SEASON when not an integer", () => {
  const rec = historyRecordOf(summary({ note: 5, epitaph: null, cause: undefined, season: "x" }), 42);
  assert.equal(rec.note, "");
  assert.equal(rec.epitaph, "");
  assert.equal(rec.cause, "");
  assert.equal(rec.version, "");
  assert.equal(rec.season, SEASON);
});

/* ================================================================
   sanitizeHistory
   ================================================================ */

test("sanitizeHistory: null/undefined/string/number/array/garbage all sanitize to an empty, non-imported, frozen history", () => {
  for (const bad of [null, undefined, "garbage", 5, [], [1, 2, 3]]) {
    const h = sanitizeHistory(bad);
    assert.deepStrictEqual(h, { v: 1, imported: false, runs: [] });
    assert.ok(Object.isFrozen(h));
    assert.ok(Object.isFrozen(h.runs));
  }
});

test("sanitizeHistory: imported is true only when raw.imported === true", () => {
  assert.equal(sanitizeHistory({ imported: true, runs: [] }).imported, true);
  assert.equal(sanitizeHistory({ imported: "true", runs: [] }).imported, false);
  assert.equal(sanitizeHistory({ imported: 1, runs: [] }).imported, false);
  assert.equal(sanitizeHistory({}).imported, false);
});

test("sanitizeHistory: dedupes by hash (first occurrence wins) and drops malformed entries", () => {
  const first = rawRecord({ hash: "aaaaaaaa", when: 100, name: "First" });
  const dupeLater = rawRecord({ hash: "aaaaaaaa", when: 200, name: "Second" });
  const other = rawRecord({ hash: "bbbbbbbb", when: 100 });
  const malformed = { hash: "cccccccc" }; // missing required fields

  const h = sanitizeHistory({ runs: [first, dupeLater, other, malformed] });
  assert.equal(h.runs.length, 2);
  const kept = h.runs.find((r) => r.hash === "aaaaaaaa");
  assert.equal(kept.name, "First", "the first occurrence in the raw list wins on a hash collision");
  assert.equal(kept.when, 100, "the first occurrence's own fields are kept, not the later duplicate's");
});

test("sanitizeHistory: sorts when descending, then hash ascending on ties", () => {
  const older = rawRecord({ hash: "cccccccc", when: 100 });
  const newer = rawRecord({ hash: "bbbbbbbb", when: 200 });
  const tie1 = rawRecord({ hash: "dddddddd", when: 150 });
  const tie2 = rawRecord({ hash: "aaaaaaaa", when: 150 });

  const h = sanitizeHistory({ runs: [older, newer, tie1, tie2] });
  assert.deepStrictEqual(h.runs.map((r) => r.hash), ["bbbbbbbb", "aaaaaaaa", "dddddddd", "cccccccc"]);
});

test("sanitizeHistory: caps at RUN_HISTORY_CAP, keeping the newest", () => {
  const runs = [];
  for (let i = 0; i < RUN_HISTORY_CAP + 10; i++) {
    runs.push(rawRecord({ hash: i.toString(16).padStart(8, "0"), when: i }));
  }
  const h = sanitizeHistory({ runs });
  assert.equal(h.runs.length, RUN_HISTORY_CAP);
  assert.equal(h.runs[0].when, RUN_HISTORY_CAP + 9, "the newest run is kept first");
  assert.ok(!h.runs.some((r) => r.when < 10), "the oldest 10 runs were dropped by the cap");
});

/* ================================================================
   appendRun
   ================================================================ */

test("appendRun: adds a new record and re-sorts newest-first", () => {
  let h = sanitizeHistory(null);
  h = appendRun(h, rawRecord({ hash: "aaaaaaaa", when: 100 }));
  h = appendRun(h, rawRecord({ hash: "bbbbbbbb", when: 200 }));
  assert.deepStrictEqual(h.runs.map((r) => r.hash), ["bbbbbbbb", "aaaaaaaa"]);
});

test("appendRun: a duplicate hash is ignored (the existing entry's fields are kept)", () => {
  let h = sanitizeHistory({ runs: [rawRecord({ hash: "aaaaaaaa", when: 100, name: "Original" })] });
  h = appendRun(h, rawRecord({ hash: "aaaaaaaa", when: 999, name: "Dupe" }));
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0].name, "Original");
});

test("appendRun: a 501st run drops the oldest (the 500-run cap)", () => {
  let h = sanitizeHistory(null);
  for (let i = 0; i < RUN_HISTORY_CAP; i++) {
    h = appendRun(h, rawRecord({ hash: i.toString(16).padStart(8, "0"), when: i }));
  }
  assert.equal(h.runs.length, RUN_HISTORY_CAP);
  assert.ok(h.runs.some((r) => r.when === 0), "the oldest run is still present before the 501st append");

  h = appendRun(h, rawRecord({ hash: "ffffffff", when: 1000 }));
  assert.equal(h.runs.length, RUN_HISTORY_CAP);
  assert.ok(!h.runs.some((r) => r.when === 0), "the oldest run (when=0) was dropped by the 501st append");
  assert.ok(h.runs.some((r) => r.hash === "ffffffff"), "the new run was added");
});

/* ================================================================
   mergeHistories
   ================================================================ */

test("mergeHistories: unions stored and memory by hash, memory wins on a collision, imported true if either is", () => {
  const stored = sanitizeHistory({
    imported: true,
    runs: [rawRecord({ hash: "aaaaaaaa", when: 100, name: "Stored" })],
  });
  const memory = sanitizeHistory({
    imported: false,
    runs: [
      rawRecord({ hash: "aaaaaaaa", when: 100, name: "Memory" }),
      rawRecord({ hash: "bbbbbbbb", when: 200 }),
    ],
  });
  const merged = mergeHistories(stored, memory);
  assert.equal(merged.imported, true);
  assert.equal(merged.runs.length, 2);
  assert.equal(merged.runs.find((r) => r.hash === "aaaaaaaa").name, "Memory", "memory wins on a collision");
});

test("mergeHistories: never shrinks the stored history — a corrupt memory copy still keeps every stored run", () => {
  const stored = sanitizeHistory({
    runs: [rawRecord({ hash: "aaaaaaaa", when: 100 }), rawRecord({ hash: "bbbbbbbb", when: 200 })],
  });
  const merged = mergeHistories(stored, "not an object");
  assert.equal(merged.runs.length, 2);
});

test("mergeHistories: sorts and caps the union", () => {
  const stored = sanitizeHistory({ runs: [rawRecord({ hash: "aaaaaaaa", when: 300 })] });
  const memory = sanitizeHistory({ runs: [rawRecord({ hash: "bbbbbbbb", when: 400 })] });
  const merged = mergeHistories(stored, memory);
  assert.deepStrictEqual(merged.runs.map((r) => r.hash), ["bbbbbbbb", "aaaaaaaa"]);
});

/* ================================================================
   importLegacy
   ================================================================ */

test("importLegacy: cutoff boundary — one ms before BACKFILL_SINCE_MS is not imported, exactly at it is, each stamped IMPORT_VERSION", () => {
  const atCutoff = summary({ when: BACKFILL_SINCE_MS, steps: 900 });
  const before = summary({ when: BACKFILL_SINCE_MS - 1, steps: 901 });
  const bests = foldBests([atCutoff, before]);

  const h = importLegacy(null, { bests, graves: [] });
  assert.equal(h.imported, true);
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0].hash, atCutoff.hash);
  assert.equal(h.runs[0].version, IMPORT_VERSION);
});

test("importLegacy: dedupes the same run when it appears in both the graveyard and ddr.bests.v1", () => {
  const s = summary({ when: BACKFILL_SINCE_MS + 10, steps: 902 });
  const bests = foldBests([s]);
  const h = importLegacy(null, { bests, graves: [s] });
  assert.equal(h.runs.length, 1);
});

test("importLegacy: a run already in the history keeps its own stored version rather than being overwritten by the import", () => {
  const s = summary({ when: BACKFILL_SINCE_MS + 20, steps: 903 });
  const existing = sanitizeHistory({
    runs: [rawRecord({ hash: s.hash, when: s.when, version: "dev-custom" })],
  });
  const bests = foldBests([s]);
  const h = importLegacy(existing, { bests, graves: [] });
  assert.equal(h.runs.length, 1);
  assert.equal(h.runs[0].version, "dev-custom");
});

test("importLegacy: never throws on corrupt bests/graves and marks imported true anyway", () => {
  const h = importLegacy(null, { bests: "corrupt", graves: "corrupt" });
  assert.equal(h.imported, true);
  assert.equal(h.runs.length, 0);
});

/* ================================================================
   newBestsAgainst
   ================================================================ */

test("newBestsAgainst: an empty history reports first:true, newBests: []", () => {
  const rec = record();
  assert.deepStrictEqual(newBestsAgainst([], rec), { first: true, newBests: [] });
});

test("newBestsAgainst: lists, in BOARD_STATS order, every stat the new record beats", () => {
  const existing = record({ floor: 3, steps: 100, day: 2, kills: 1, gold: 10 });
  const deeper = record({ floor: 9, steps: 50, day: 1, kills: 0, gold: 0 });
  const report = newBestsAgainst([existing], deeper);
  assert.equal(report.first, false);
  assert.deepStrictEqual(report.newBests, ["deep"]);
});

test("newBestsAgainst: a shallower/lesser run after a deeper one reports first:false, newBests: []", () => {
  const deeper = record({ floor: 9, steps: 50, day: 5, kills: 10, gold: 500 });
  const shallower = record({ floor: 1, steps: 900, day: 1, kills: 0, gold: 0 });
  const report = newBestsAgainst([deeper], shallower);
  assert.equal(report.first, false);
  assert.deepStrictEqual(report.newBests, []);
});

test("newBestsAgainst: DAYS ranks by the capped daysKey (min(day,10*floor)*1000+floor), not the raw day count", () => {
  const shallowLongLived = record({ floor: 1, day: 50, steps: 10 });
  assert.equal(rankKeyOf("days", shallowLongLived), 10001, "a floor-1 run with 50 days caps to daysKey 10001");

  const deeperFewerDays = record({ floor: 5, day: 45, steps: 5 }); // min(45,50)=45 -> 45000+5=45005
  const report = newBestsAgainst([deeperFewerDays], shallowLongLived);
  assert.ok(!report.newBests.includes("days"), "10001 does not beat the deeper run's capped daysKey 45005");
});

/* ================================================================
   serializeHistory
   ================================================================ */

test("serializeHistory: JSON.stringify of the sanitized {v, imported, runs} shape", () => {
  const h = sanitizeHistory({ imported: true, runs: [rawRecord({ hash: "aaaaaaaa" })] });
  const parsed = JSON.parse(serializeHistory(h));
  assert.equal(parsed.v, 1);
  assert.equal(parsed.imported, true);
  assert.equal(parsed.runs.length, 1);
  assert.equal(parsed.runs[0].hash, "aaaaaaaa");
});

test("serializeHistory: never throws on garbage input", () => {
  assert.doesNotThrow(() => serializeHistory("not a history"));
  assert.doesNotThrow(() => serializeHistory(null));
});

/* ================================================================
   purity
   ================================================================ */

test("purity: appendRun/mergeHistories/importLegacy never mutate their history inputs", () => {
  const h = sanitizeHistory({ imported: true, runs: [rawRecord({ hash: "aaaaaaaa" })] });
  const before = JSON.parse(JSON.stringify(h));

  appendRun(h, rawRecord({ hash: "bbbbbbbb" }));
  mergeHistories(h, h);
  importLegacy(h, { bests: null, graves: [] });

  assert.deepStrictEqual(JSON.parse(JSON.stringify(h)), before);
});

test("purity: source has no window/document/navigator/localStorage/bare-fetch references", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "runHistory.js"), "utf8");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bwindow\b/.test(stripped));
  assert.ok(!/\bdocument\b/.test(stripped));
  assert.ok(!/\bnavigator\b/.test(stripped));
  assert.ok(!/localStorage/.test(stripped));
  assert.ok(!/\bfetch\(/.test(stripped));
});
