// test/unit/achievements-sheet-model.test.js
//
// Phase 100 (AUI-02), plan 02 task 1: the achievements list's structure and
// helpers: the copy bank, the seven blocks, the 35 tracks, dates, unit-bearing
// progress readings and the counts. Records are built through sanitizeRecord
// of literal objects so they carry the real shape.

import test from "node:test";
import assert from "node:assert/strict";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { CLASSES } from "../../content/classes.js";
import { emptyRecord, sanitizeRecord } from "../../src/browser/achievementRecord.js";
import {
  ACHIEVEMENTS_SHEET_COPY,
  ACHIEVEMENT_BLOCKS,
  TRACK_JOINS,
  TIER_NUMERALS,
  tracksOf,
  formatEarnedDate,
  progressText,
  earnedCount,
  secretCount,
  menuCountText,
} from "../../src/browser/achievementsSheet.js";

const byId = (id) => ACHIEVEMENTS.find((e) => e.id === id);
const rec = (over) => sanitizeRecord({ v: 1, ...over });

function leaves(obj, out = []) {
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") leaves(v, out);
    else out.push(v);
  }
  return out;
}

function deepFrozen(obj) {
  if (obj === null || typeof obj !== "object") return true;
  return Object.isFrozen(obj) && Object.values(obj).every(deepFrozen);
}

// --- blocks -----------------------------------------------------------------

test("ACHIEVEMENT_BLOCKS: seven frozen blocks whose ranges partition all 77 entries (6, 4, 10, 14, 13, 24, 6)", () => {
  assert.ok(Object.isFrozen(ACHIEVEMENT_BLOCKS));
  assert.deepStrictEqual(ACHIEVEMENT_BLOCKS.map((b) => b.id), ["descent", "dressing", "who", "alive", "company", "bodies", "dying"]);
  const counts = ACHIEVEMENT_BLOCKS.map(() => 0);
  for (const entry of ACHIEVEMENTS) {
    const hits = ACHIEVEMENT_BLOCKS.map((b, i) => (entry.listOrder >= b.firstOrder && entry.listOrder <= b.lastOrder ? i : -1)).filter((i) => i >= 0);
    assert.equal(hits.length, 1, `${entry.id} falls in exactly one block`);
    counts[hits[0]]++;
  }
  assert.deepStrictEqual(counts, [6, 4, 10, 14, 13, 24, 6]);
  assert.equal(counts.reduce((a, b) => a + b, 0), ACHIEVEMENTS.length);
});

test("ACHIEVEMENT_BLOCKS: every block id has a title in the bank", () => {
  for (const b of ACHIEVEMENT_BLOCKS) {
    assert.ok(Object.isFrozen(b));
    assert.equal(typeof ACHIEVEMENTS_SHEET_COPY.blocks[b.id], "string", b.id);
    assert.ok(ACHIEVEMENTS_SHEET_COPY.blocks[b.id].length > 0);
  }
});

// --- tracks -----------------------------------------------------------------

test("tracksOf: 35 tracks, 14 with more than one entry, every entry in exactly one track", () => {
  const tracks = tracksOf();
  assert.equal(tracks.length, 35);
  assert.equal(tracks.filter((t) => t.entries.length > 1).length, 14);
  const seen = new Map();
  for (const t of tracks) for (const e of t.entries) seen.set(e.id, (seen.get(e.id) || 0) + 1);
  assert.equal(seen.size, ACHIEVEMENTS.length);
  for (const [id, n] of seen) assert.equal(n, 1, `${id} appears once`);
  assert.ok(Object.isFrozen(tracks));
  assert.ok(tracks.every((t) => Object.isFrozen(t) && Object.isFrozen(t.entries)));
});

test("tracksOf: the depth track is depth_t1, depth_t2, depth_t3, unicorn; the other 13 tiered tracks hold tiers 1 to 4", () => {
  assert.deepStrictEqual(TRACK_JOINS, { unicorn: "depth" });
  assert.ok(Object.isFrozen(TRACK_JOINS));
  const tracks = tracksOf();
  const depth = tracks.find((t) => t.key === "depth");
  assert.deepStrictEqual(depth.entries.map((e) => e.id), ["depth_t1", "depth_t2", "depth_t3", "unicorn"]);
  const others = tracks.filter((t) => t.entries.length > 1 && t.key !== "depth");
  assert.equal(others.length, 13);
  for (const t of others) assert.deepStrictEqual(t.entries.map((e) => e.tier), [1, 2, 3, 4], t.key);
  assert.equal(tracks.find((t) => t.key === "kills_beasts").entries[0].id, "kills_beasts_t1");
});

test("tracksOf: tracks are sorted by the first entry's listOrder", () => {
  const orders = tracksOf().map((t) => t.entries[0].listOrder);
  assert.deepStrictEqual(orders, [...orders].sort((a, b) => a - b));
});

test("tracksOf: a custom catalog array works and does not alter its entries", () => {
  const catalog = [
    { id: "zed_t2", tier: 2, listOrder: 30 },
    { id: "zed_t1", tier: 1, listOrder: 20 },
    { id: "solo", tier: null, listOrder: 10 },
  ];
  const tracks = tracksOf(catalog);
  assert.deepStrictEqual(tracks.map((t) => [t.key, t.entries.map((e) => e.id)]), [
    ["solo", ["solo"]],
    ["zed", ["zed_t1", "zed_t2"]],
  ]);
  assert.ok(!Object.isFrozen(catalog[0]), "catalog entries are not frozen by tracksOf");
});

// --- dates ------------------------------------------------------------------

test("formatEarnedDate: a short local date, no leading zero, no host time zone", () => {
  assert.equal(formatEarnedDate(Date.UTC(2026, 9, 5, 12, 0, 0), 0), "5 Oct 2026");
  assert.equal(formatEarnedDate(Date.UTC(2026, 9, 6, 2, 0, 0), 300), "5 Oct 2026");
  assert.equal(formatEarnedDate(Date.UTC(2026, 11, 31, 20, 0, 0), -600), "1 Jan 2027");
  assert.equal(formatEarnedDate(Date.UTC(2028, 1, 29, 9, 0, 0), 0), "29 Feb 2028");
  assert.equal(formatEarnedDate(Date.UTC(2026, 9, 15, 12, 0, 0), 0), "15 Oct 2026");
});

test("formatEarnedDate: zero, negative, non-finite and non-number times give null", () => {
  for (const bad of [0, -5, NaN, Infinity, -Infinity, "x", undefined, null, {}, 8.7e15]) {
    assert.equal(formatEarnedDate(bad, 0), null, String(bad));
  }
});

test("formatEarnedDate: a non-finite offset reads as 0", () => {
  const at = Date.UTC(2026, 9, 5, 12, 0, 0);
  for (const off of [NaN, Infinity, "300", undefined, null]) assert.equal(formatEarnedDate(at, off), "5 Oct 2026");
  assert.equal(formatEarnedDate(at), "5 Oct 2026");
});

// --- progress ---------------------------------------------------------------

test("progressText: lifetime counts carry their unit", () => {
  const r = rec({
    kills: { Beasts: 37 },
    counters: { deaths: 12, joinersAccepted: 3, joinersFallen: 2, parleysWon: 4, trapsSurvived: 9 },
  });
  assert.equal(progressText(r, byId("kills_beasts_t1")), "37 / 50 kills");
  assert.equal(progressText(r, byId("kills_beasts_t3")), "37 / 200 kills");
  assert.equal(progressText(r, byId("frequent_flier_t1")), "12 / 50 deaths");
  assert.equal(progressText(r, byId("party_animal_t1")), "3 / 10 Joiners");
  assert.equal(progressText(r, byId("human_shields_t1")), "2 / 5 Joiners fallen");
  assert.equal(progressText(r, byId("parlay_t1")), "4 / 10 parleys won");
  assert.equal(progressText(r, byId("trap_survivor_t1")), "9 / 10 traps survived");
});

test("progressText: single-run bests read as the best run so far", () => {
  const r = rec({ bests: { depth: 7, days: 7, wilmstHeld: 1200 } });
  assert.equal(progressText(r, byId("depth_t2")), "best: floor 7 / 10");
  assert.equal(progressText(r, byId("survivor_t1")), "best: 7 / 10 days");
  assert.equal(progressText(r, byId("hoarder_t1")), "best: 1200 / 2000 wilmst held");
});

test("progressText: the value never exceeds the steps", () => {
  assert.equal(progressText(rec({ bests: { depth: 99 } }), byId("unicorn")), "best: floor 20 / 20");
  assert.equal(progressText(rec({ kills: { Beasts: 9999 } }), byId("kills_beasts_t1")), "50 / 50 kills");
});

test("progressText: Tourist counts distinct real sub-classes", () => {
  const subs = Object.values(CLASSES).flatMap((c) => c.subs).slice(0, 7);
  assert.equal(subs.length, 7);
  assert.equal(progressText(rec({ subClassesDelved: subs }), byId("tourist")), "7 / 24 sub-classes");
});

test("progressText: a standard entry, an unknown id and null all give null", () => {
  const r = emptyRecord();
  assert.equal(progressText(r, byId("race_human")), null);
  assert.equal(progressText(r, byId("chicken")), null);
  assert.equal(progressText(r, { id: "no_such_entry", type: "incremental", steps: 5, trigger: { kind: "lifetimeCounter", counter: "deaths" } }), null);
  assert.equal(progressText(r, null), null);
  assert.equal(progressText(r, undefined), null);
});

test("progressText: a null or empty record reads as zero", () => {
  assert.equal(progressText(null, byId("kills_beasts_t1")), "0 / 50 kills");
  assert.equal(progressText(emptyRecord(), byId("unicorn")), "best: floor 0 / 20");
});

// --- counts -----------------------------------------------------------------

// Quick 261005-vn5 (declared re-pin): Special Snowflake now starts Hidden, so 9 entries are secrets (was 8).
test("earnedCount and secretCount: the empty record is 0 earned and 9 secrets", () => {
  assert.equal(earnedCount(emptyRecord()), 0);
  assert.equal(secretCount(emptyRecord()), 9);
  assert.equal(earnedCount(null), 0);
  assert.equal(secretCount(undefined), 9);
});

test("secretCount: a reveal lowers it without changing the earned count", () => {
  const r = rec({ revealed: ["death_falling"] });
  assert.equal(secretCount(r), 8);
  assert.equal(earnedCount(r), 0);
});

test("secretCount: unlocking a Hidden entry lowers it and raises the earned count", () => {
  const r = rec({ unlocked: { chicken: 1000 } });
  assert.equal(secretCount(r), 8);
  assert.equal(earnedCount(r), 1);
});

test("earnedCount: unknown unlock ids are ignored", () => {
  const r = rec({ unlocked: { race_human: 5, not_an_achievement: 9 } });
  assert.equal(earnedCount(r), 1);
});

test("menuCountText: earned over the catalog size", () => {
  assert.equal(menuCountText(emptyRecord()), "0 / 77");
  const unlocked = {};
  for (const e of ACHIEVEMENTS.slice(0, 12)) unlocked[e.id] = 1;
  assert.equal(menuCountText(rec({ unlocked })), "12 / 77");
  assert.equal(menuCountText(null), "0 / 77");
});

// --- copy bank ---------------------------------------------------------------

test("ACHIEVEMENTS_SHEET_COPY: deeply frozen, every leaf a non-empty string, no arrays", () => {
  assert.ok(deepFrozen(ACHIEVEMENTS_SHEET_COPY));
  const all = leaves(ACHIEVEMENTS_SHEET_COPY);
  assert.ok(all.length > 30);
  for (const v of all) assert.ok(typeof v === "string" && v.length > 0);
  const hasArray = (o) => Array.isArray(o) || (o && typeof o === "object" && Object.values(o).some(hasArray));
  assert.ok(!hasArray(ACHIEVEMENTS_SHEET_COPY));
});

test("ACHIEVEMENTS_SHEET_COPY: the template tokens are present", () => {
  const c = ACHIEVEMENTS_SHEET_COPY;
  assert.equal(c.title, "ACHIEVEMENTS");
  assert.match(c.earned, /\{n\}.*\{total\}/);
  assert.match(c.menuCount, /\{n\}.*\{total\}/);
  assert.match(c.secrets.many, /\{n\}/);
  assert.match(c.state.earned, /\{date\}/);
  assert.match(c.state.partial, /\{n\}.*\{total\}/);
  assert.match(c.state.complete, /\{total\}/);
  assert.match(c.tier.label, /\{tier\}/);
  assert.match(c.tier.next, /\{tier\}/);
  assert.match(c.progress.count, /\{value\}.*\{steps\}.*\{unit\}/);
  assert.match(c.progress.bestFloor, /\{value\}.*\{steps\}/);
  assert.match(c.progress.best, /\{value\}.*\{steps\}.*\{unit\}/);
  for (const unit of ["kills", "deaths", "joinersAccepted", "joinersFallen", "parleysWon", "trapsSurvived", "days", "wilmstHeld", "subClasses"]) {
    assert.equal(typeof c.units[unit], "string", unit);
  }
  assert.equal(c.secret.name, "Secret");
  assert.equal(typeof c.expand, "string");
  assert.equal(typeof c.collapse, "string");
});

test("TIER_NUMERALS: frozen I to IV and not part of the bank", () => {
  assert.deepStrictEqual([...TIER_NUMERALS], ["I", "II", "III", "IV"]);
  assert.ok(Object.isFrozen(TIER_NUMERALS));
  assert.ok(!("numerals" in ACHIEVEMENTS_SHEET_COPY) && !("months" in ACHIEVEMENTS_SHEET_COPY));
});
