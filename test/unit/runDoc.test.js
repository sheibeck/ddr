// test/unit/runDoc.test.js
//
// Phase 83 (SRV-01, SRV-02, SRV-03), Plan 02 Task 1. Covers the whole run
// document contract: build from engine-produced summaries at depths 1-20,
// every validateRunDoc fail id, every bound edge, the 2,000-pair rank-key
// ordering property (matching engine/records.js#compareRuns for deep/kills/
// purse, and the Phase 82 DAYS rule for days), and the exact commit/query
// REST shapes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/state.js";
import { buildRunSummary } from "../../engine/death.js";
import { compareRuns } from "../../engine/records.js";
import { BOARD_NAME_MAX_CHARS } from "../../src/browser/boardName.js";
import { SEASON } from "../../content/season.js";
import { FIREBASE_CONFIG } from "../../src/browser/firebaseConfig.js";
import { docName, toFirestoreFields } from "../../src/browser/firestoreRest.js";
import {
  RUN_COLLECTION,
  BANNED_COLLECTION,
  RUN_CLIENT_FIELDS,
  RUN_DOC_FIELDS,
  RUN_FAIL_IDS,
  FLOOR_MIN,
  FLOOR_MAX,
  LEVEL_MIN,
  LEVEL_MAX,
  DAY_MIN,
  DAY_CAMP_ALLOWANCE,
  STEPS_MAX,
  GOLD_MAX,
  SP_MAX,
  ACTS_MAX,
  SEED_MAX,
  NAME_MAX_CHARS,
  EPITAPH_MAX_CHARS,
  VERSION_MAX_CHARS,
  UID_MAX_CHARS,
  LIST_LIMIT_MAX,
  TOP_N,
  DAYS_PER_FLOOR_CAP,
  HASH_PATTERN,
  NOTE_MAX_CHARS,
  WHEN_SKEW_MS,
  RANK_FIELD,
  BOARD_STATS,
  isBoardStat,
  deepKeyOf,
  daysKeyOf,
  killsKeyOf,
  goldKeyOf,
  rankKeys,
  rankKeyOf,
  runDocId,
  buildRunDoc,
  validateRunDoc,
  createRunCommit,
  deleteCommit,
  boardFilters,
  topTenQuery,
  countQuery,
  ownRunsQuery,
} from "../../src/browser/runDoc.js";
import { BESTIARY, ELITE_TITLES } from "../../content/bestiary.js";
import { CAUSE_TEXT, CAUSE_TEXT_TOKENS } from "../../content/epitaphs.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- helpers -----------------------------------------------------------

function validHandle() {
  return "Moss Knuckle";
}

function baseValidPartial() {
  return {
    uid: "u1",
    handle: validHandle(),
    season: SEASON,
    name: "Test Hero",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 40,
    cause: "combat",
    note: "cut down by a Rat",
    epitaph: "",
    when: 1790624461000,
    hash: "0a1b2c3d",
    version: "2.2.0 (12)",
    seed: 12345,
    acts: 10,
  };
}

function docFrom(overrides = {}) {
  const merged = { ...baseValidPartial(), ...overrides };
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function baseValidDoc() {
  return docFrom();
}

// --- constants -----------------------------------------------------------

test("constants: field lists, bounds and RANK_FIELD", () => {
  assert.equal(RUN_COLLECTION, "runs");
  assert.equal(BANNED_COLLECTION, "banned");
  assert.deepEqual([...RUN_DOC_FIELDS], [...RUN_CLIENT_FIELDS, "createdAt"]);
  assert.equal(FLOOR_MIN, 1);
  assert.equal(FLOOR_MAX, 200);
  assert.equal(LEVEL_MIN, 1);
  assert.equal(LEVEL_MAX, 5);
  assert.equal(DAY_MIN, 1);
  assert.equal(DAY_CAMP_ALLOWANCE, 300);
  assert.equal(STEPS_MAX, 999999);
  assert.equal(GOLD_MAX, 10000000);
  assert.equal(SP_MAX, 1000000000);
  assert.equal(ACTS_MAX, 1000000000);
  assert.equal(SEED_MAX, Number.MAX_SAFE_INTEGER);
  assert.equal(NAME_MAX_CHARS, 40);
  assert.equal(EPITAPH_MAX_CHARS, 400);
  assert.equal(VERSION_MAX_CHARS, 64);
  assert.equal(UID_MAX_CHARS, 128);
  assert.equal(LIST_LIMIT_MAX, 50);
  assert.equal(TOP_N, 10);
  assert.equal(DAYS_PER_FLOOR_CAP, 10);
  assert.equal(HASH_PATTERN, "^[0-9a-f]{8}$");
  assert.equal(NOTE_MAX_CHARS, 120);
  assert.equal(WHEN_SKEW_MS, 86400000);
  assert.deepEqual(RANK_FIELD, { deep: "deepKey", days: "daysKey", kills: "killsKey", purse: "goldKey" });
  assert.deepEqual([...BOARD_STATS], ["deep", "days", "kills", "purse"]);
  assert.equal(isBoardStat("deep"), true);
  assert.equal(isBoardStat("yard"), false);
  assert.deepEqual([...RUN_FAIL_IDS], [
    "keys", "uid", "handle", "season", "name", "race", "sub", "cls", "level",
    "floor", "day", "steps", "kills", "gold", "sp", "cause", "note", "epitaph",
    "when", "hash", "version", "seed", "acts", "deepkey", "dayskey", "killskey",
    "goldkey",
  ]);
});

// --- buildRunDoc from engine-built summaries ------------------------------

test("buildRunDoc: ok for engine-built summaries at seeds 1-40", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const state = newRun(seed);
    const summary = buildRunSummary(state, "combat", 0);
    const handle = validHandle();
    const result = buildRunDoc(summary, { uid: "u1", handle, version: "2.2.0 (12)" });
    assert.equal(result.ok, true, `seed ${seed}: ${JSON.stringify(result)}`);
    assert.equal(result.id, `u1_${summary.hash}`);
    assert.deepEqual(Object.keys(result.doc), [...RUN_CLIENT_FIELDS]);
    for (const f of ["season", "name", "race", "sub", "cls", "level", "floor", "day", "steps", "kills", "gold", "sp", "cause", "hash", "seed", "acts", "when"]) {
      assert.equal(result.doc[f], summary[f], `seed ${seed} field ${f}`);
    }
    assert.equal(result.doc.uid, "u1");
    assert.equal(result.doc.handle, handle);
    assert.equal(result.doc.version, "2.2.0 (12)");
    assert.equal(result.doc.epitaph, typeof summary.epitaph === "string" ? summary.epitaph : "");
    assert.equal(result.doc.note, typeof summary.note === "string" ? summary.note : "");
    assert.deepEqual(validateRunDoc(result.doc), []);
  }
});

test("buildRunDoc: ok for newRun(seed, [], {startDepth: d}) with d in 2..20", () => {
  for (let d = 2; d <= 20; d++) {
    const state = newRun(9000 + d, [], { startDepth: d });
    const summary = buildRunSummary(state, "combat", 0);
    const result = buildRunDoc(summary, { uid: "u1", handle: validHandle(), version: "2.2.0 (12)" });
    assert.equal(result.ok, true, `depth ${d}: ${JSON.stringify(result)}`);
    assert.deepEqual(validateRunDoc(result.doc), []);
  }
});

test("buildRunDoc: a non-string epitaph becomes an empty string", () => {
  const state = newRun(7);
  const summary = buildRunSummary(state, "combat", 0);
  const nonString = { ...summary, epitaph: undefined };
  const result = buildRunDoc(nonString, { uid: "u1", handle: validHandle(), version: "2.2.0 (12)" });
  assert.equal(result.ok, true);
  assert.equal(result.doc.epitaph, "");
});

// --- validateRunDoc: fail ids ----------------------------------------------

test("validateRunDoc(valid) is []", () => {
  assert.deepEqual(validateRunDoc(baseValidDoc()), []);
});

test("extra or missing key yields exactly keys", () => {
  const valid = baseValidDoc();
  const { uid, ...missingUid } = valid;
  assert.deepEqual(validateRunDoc(missingUid), ["keys"]);
  const extra = { ...valid, extraField: 1 };
  assert.deepEqual(validateRunDoc(extra), ["keys"]);
});

test("a Fighter with sub Wizard yields exactly sub", () => {
  const doc = docFrom({ cls: "Fighter", sub: "Wizard" });
  assert.deepEqual(validateRunDoc(doc), ["sub"]);
});

test("validateRunDoc(doc, {uid}) mismatch adds exactly uid", () => {
  assert.deepEqual(validateRunDoc(baseValidDoc(), { uid: "other" }), ["uid"]);
});

// Fields with no role in any rank-key formula: safe to break in place on a
// pre-built valid doc without recomputing deepKey/daysKey/killsKey/goldKey —
// exactly one fail id should appear. floor/steps/kills/gold (which DO feed a
// rank-key formula) are covered by the "bound edges" tests below via
// docFrom(), which always recomputes the keys so only the broken field's own
// id appears.
const FIELD_BREAKS = [
  ["uid", 123, "uid"],
  ["uid", "", "uid"],
  ["handle", "", "handle"],
  ["handle", 42, "handle"],
  ["handle", "x".repeat(65), "handle"],
  ["season", 2, "season"],
  ["name", "", "name"],
  ["race", "Orcish", "race"],
  ["cls", "Ranger", "cls"],
  ["level", 0, "level"],
  ["sp", -1, "sp"],
  ["cause", "curse", "cause"],
  ["note", 123, "note"],
  ["when", -1, "when"],
  ["when", 1.5, "when"],
  ["hash", "NOTHEX!!", "hash"],
  ["version", "", "version"],
  ["seed", -1, "seed"],
  ["seed", 1.5, "seed"],
  ["acts", -1, "acts"],
  ["deepKey", 0, "deepkey"],
  ["daysKey", 0, "dayskey"],
  ["killsKey", 0, "killskey"],
  ["goldKey", -1, "goldkey"],
];

test("breaking one field (post-build, rank keys unchanged) yields exactly its fail id", () => {
  const valid = baseValidDoc();
  for (const [field, bad, expected] of FIELD_BREAKS) {
    const doc = { ...valid, [field]: bad };
    assert.deepEqual(validateRunDoc(doc), [expected], `field ${field} = ${bad}`);
  }
});

// --- bound edges -----------------------------------------------------------

test("bound edges: floor 1 and 200 pass, 0 and 201 fail", () => {
  assert.deepEqual(validateRunDoc(docFrom({ floor: 1 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ floor: 200 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ floor: 0 })), ["floor"]);
  assert.deepEqual(validateRunDoc(docFrom({ floor: 201 })), ["floor"]);
});

test("bound edges: steps 999999 passes, 1000000 fails", () => {
  assert.deepEqual(validateRunDoc(docFrom({ steps: 999999 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ steps: 1000000 })), ["steps"]);
});

test("bound edges: day 1 passes, 0 fails", () => {
  assert.deepEqual(validateRunDoc(docFrom({ day: 1 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ day: 0 })), ["day"]);
});

test("bound edges: day * 100 == steps + 30000 passes, one more day fails", () => {
  // steps stays at the base partial's 500: (500 + 30000) / 100 = 305
  assert.deepEqual(validateRunDoc(docFrom({ day: 305 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ day: 306 })), ["day"]);
});

test("bound edges: kills == steps passes, steps + 1 fails", () => {
  assert.deepEqual(validateRunDoc(docFrom({ kills: 500 })), []); // steps stays 500
  assert.deepEqual(validateRunDoc(docFrom({ kills: 501 })), ["kills"]);
});

test("bound edges: gold 10000000 passes, +1 fails", () => {
  assert.deepEqual(validateRunDoc(docFrom({ gold: 10000000 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ gold: 10000001 })), ["gold"]);
});

test("bound edges: level 1..5 pass, 0 and 6 fail", () => {
  for (let lvl = 1; lvl <= 5; lvl++) assert.deepEqual(validateRunDoc(docFrom({ level: lvl })), []);
  assert.deepEqual(validateRunDoc(docFrom({ level: 0 })), ["level"]);
  assert.deepEqual(validateRunDoc(docFrom({ level: 6 })), ["level"]);
});

test("bound edges: seed MAX_SAFE_INTEGER passes, -1 and 1.5 fail", () => {
  assert.deepEqual(validateRunDoc(docFrom({ seed: Number.MAX_SAFE_INTEGER })), []);
  assert.deepEqual(validateRunDoc(docFrom({ seed: -1 })), ["seed"]);
  assert.deepEqual(validateRunDoc(docFrom({ seed: 1.5 })), ["seed"]);
});

test("bound edges: name empty and 41 chars fail, 40 passes", () => {
  assert.deepEqual(validateRunDoc(docFrom({ name: "" })), ["name"]);
  assert.deepEqual(validateRunDoc(docFrom({ name: "x".repeat(41) })), ["name"]);
  assert.deepEqual(validateRunDoc(docFrom({ name: "x".repeat(40) })), []);
});

test("bound edges: epitaph 401 chars fails, 400 passes", () => {
  assert.deepEqual(validateRunDoc(docFrom({ epitaph: "x".repeat(401) })), ["epitaph"]);
  assert.deepEqual(validateRunDoc(docFrom({ epitaph: "x".repeat(400) })), []);
});

test("bound edges: version empty and 65 chars fail, 64 passes", () => {
  assert.deepEqual(validateRunDoc(docFrom({ version: "" })), ["version"]);
  assert.deepEqual(validateRunDoc(docFrom({ version: "x".repeat(65) })), ["version"]);
  assert.deepEqual(validateRunDoc(docFrom({ version: "x".repeat(64) })), []);
});

test("bound edges: note 121 chars fails, 120 passes, empty passes", () => {
  assert.deepEqual(validateRunDoc(docFrom({ note: "x".repeat(121) })), ["note"]);
  assert.deepEqual(validateRunDoc(docFrom({ note: "x".repeat(120) })), []);
  assert.deepEqual(validateRunDoc(docFrom({ note: "" })), []);
});

test("bound edges: when — a safe integer >= 0 passes with no now given; without now the upper bound is not checked client-side", () => {
  assert.deepEqual(validateRunDoc(docFrom({ when: 0 })), []);
  assert.deepEqual(validateRunDoc(docFrom({ when: Number.MAX_SAFE_INTEGER })), []);
  assert.deepEqual(validateRunDoc(docFrom({ when: -1 })), ["when"]);
  assert.deepEqual(validateRunDoc(docFrom({ when: 1.5 })), ["when"]);
});

test("bound edges: when with a now option — at the bound passes, one ms past fails", () => {
  const now = 1790624461000;
  assert.deepEqual(validateRunDoc(docFrom({ when: now + WHEN_SKEW_MS }), { now }), []);
  assert.deepEqual(validateRunDoc(docFrom({ when: now + WHEN_SKEW_MS + 1 }), { now }), ["when"]);
});

// --- rankKeyOf ---------------------------------------------------------

test("rankKeyOf: dispatches to deepKeyOf/daysKeyOf/killsKeyOf/goldKeyOf; null for anything else", () => {
  const run = { floor: 5, steps: 500, day: 3, kills: 10, gold: 100 };
  assert.equal(rankKeyOf("deep", run), deepKeyOf(run));
  assert.equal(rankKeyOf("days", run), daysKeyOf(run));
  assert.equal(rankKeyOf("kills", run), killsKeyOf(run));
  assert.equal(rankKeyOf("purse", run), goldKeyOf(run));
  assert.equal(rankKeyOf("combo", run), null);
  assert.equal(rankKeyOf(undefined, run), null);
});

// --- CAUSE_TEXT never overflows NOTE_MAX_CHARS with the longest foe name ---

test("every CAUSE_TEXT template, filled with the longest elite-titled bestiary name, is at most NOTE_MAX_CHARS", () => {
  const names = [];
  for (const group of Object.values(BESTIARY)) {
    for (const tier of group) {
      for (const m of tier) if (typeof m?.n === "string") names.push(m.n);
    }
  }
  const longestName = [...names].sort((a, b) => b.length - a.length)[0];
  const longestTitle = [...ELITE_TITLES].sort((a, b) => b.length - a.length)[0];
  const longestFoe = `${longestTitle} ${longestName}`;
  for (const [cause, template] of Object.entries(CAUSE_TEXT)) {
    const tokens = CAUSE_TEXT_TOKENS[cause] || [];
    const filled = tokens.includes("foe") ? template.replace("{foe}", longestFoe) : template;
    assert.ok(filled.length <= NOTE_MAX_CHARS, `${cause}: "${filled}" is ${filled.length} chars`);
  }
});

// --- 2,000-pair rank-key ordering property --------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomRun(rng) {
  const floor = randInt(rng, FLOOR_MIN, FLOOR_MAX);
  const steps = randInt(rng, 0, STEPS_MAX);
  const kills = randInt(rng, 0, steps);
  const gold = randInt(rng, 0, GOLD_MAX);
  const dayCeiling = Math.floor((steps + DAY_CAMP_ALLOWANCE * 100) / 100);
  const day = randInt(rng, DAY_MIN, Math.max(DAY_MIN, dayCeiling));
  return { floor, steps, kills, gold, day };
}

test("2,000 random in-bound pairs: key ordering matches compareRuns (deep/kills/purse) and the DAYS rule (days); every key is a safe integer", () => {
  const rng = mulberry32(20260928);
  const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  for (let i = 0; i < 2000; i++) {
    const a = randomRun(rng);
    const b = randomRun(rng);

    const deepA = deepKeyOf(a);
    const deepB = deepKeyOf(b);
    assert.ok(Number.isSafeInteger(deepA) && Number.isSafeInteger(deepB), `deep safe int pair ${i}`);
    assert.equal(sign(deepB - deepA), sign(compareRuns("deep", a, b)), `deep pair ${i}`);

    const killsA = killsKeyOf(a);
    const killsB = killsKeyOf(b);
    assert.ok(Number.isSafeInteger(killsA) && Number.isSafeInteger(killsB), `kills safe int pair ${i}`);
    assert.equal(sign(killsB - killsA), sign(compareRuns("kills", a, b)), `kills pair ${i}`);

    const goldA = goldKeyOf(a);
    const goldB = goldKeyOf(b);
    assert.ok(Number.isSafeInteger(goldA) && Number.isSafeInteger(goldB), `purse safe int pair ${i}`);
    assert.equal(sign(goldB - goldA), sign(compareRuns("purse", a, b)), `purse pair ${i}`);

    const daysA = daysKeyOf(a);
    const daysB = daysKeyOf(b);
    assert.ok(Number.isSafeInteger(daysA) && Number.isSafeInteger(daysB), `days safe int pair ${i}`);
    const cappedA = Math.min(a.day, DAYS_PER_FLOOR_CAP * a.floor);
    const cappedB = Math.min(b.day, DAYS_PER_FLOOR_CAP * b.floor);
    const expectedDaysCmp = cappedB - cappedA || b.floor - a.floor;
    assert.equal(sign(daysB - daysA), sign(expectedDaysCmp), `days pair ${i}`);
  }
});

// --- REST commit shapes ------------------------------------------------

test("createRunCommit: one Write — update (no createdAt) + updateTransforms + currentDocument.exists:false", () => {
  const doc = baseValidDoc();
  const id = runDocId(doc.uid, doc.hash);
  const commit = createRunCommit(FIREBASE_CONFIG, id, doc);
  assert.equal(commit.writes.length, 1);
  const w = commit.writes[0];
  assert.equal(w.update.name, docName(FIREBASE_CONFIG, "runs", id));
  assert.deepEqual(w.update.fields, toFirestoreFields(doc));
  assert.equal("createdAt" in w.update.fields, false);
  assert.deepEqual(w.updateTransforms, [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]);
  assert.deepEqual(w.currentDocument, { exists: false });
});

test("deleteCommit: one delete Write per id", () => {
  const ids = ["u1_aaaa1111", "u1_bbbb2222"];
  const commit = deleteCommit(FIREBASE_CONFIG, ids);
  assert.equal(commit.writes.length, 2);
  ids.forEach((id, i) => {
    assert.deepEqual(commit.writes[i], { delete: docName(FIREBASE_CONFIG, "runs", id) });
  });
});

// --- REST query shapes ------------------------------------------------

test("boardFilters: season-only is a single filter; race/sub add equality filters in order", () => {
  assert.equal(boardFilters({ season: 1 }).length, 1);
  const withBoth = boardFilters({ season: 1, race: "Elven", sub: "Knight" });
  assert.deepEqual(withBoth, [
    { fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: "1" } } },
    { fieldFilter: { field: { fieldPath: "race" }, op: "EQUAL", value: { stringValue: "Elven" } } },
    { fieldFilter: { field: { fieldPath: "sub" }, op: "EQUAL", value: { stringValue: "Knight" } } },
  ]);
});

test("topTenQuery: composite AND with race, bare fieldFilter with no race/sub, orderBy desc, limit 10", () => {
  const q1 = topTenQuery({ stat: "days", season: 1, race: "Elven", sub: null });
  assert.deepEqual(q1.structuredQuery.from, [{ collectionId: "runs" }]);
  assert.deepEqual(q1.structuredQuery.where, {
    compositeFilter: {
      op: "AND",
      filters: [
        { fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: "1" } } },
        { fieldFilter: { field: { fieldPath: "race" }, op: "EQUAL", value: { stringValue: "Elven" } } },
      ],
    },
  });
  assert.deepEqual(q1.structuredQuery.orderBy, [{ field: { fieldPath: "daysKey" }, direction: "DESCENDING" }]);
  assert.equal(q1.structuredQuery.limit, 10);

  const q2 = topTenQuery({ stat: "deep", season: 1 });
  assert.deepEqual(q2.structuredQuery.where, {
    fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: "1" } },
  });
  assert.deepEqual(q2.structuredQuery.orderBy, [{ field: { fieldPath: "deepKey" }, direction: "DESCENDING" }]);
});

test("countQuery: alias count, no orderBy without above, range+orderBy with above", () => {
  const q1 = countQuery({ stat: "deep", season: 1 });
  assert.equal(q1.structuredAggregationQuery.aggregations[0].alias, "count");
  assert.deepEqual(q1.structuredAggregationQuery.aggregations[0].count, {});
  assert.equal("orderBy" in q1.structuredAggregationQuery.structuredQuery, false);
  assert.deepEqual(q1.structuredAggregationQuery.structuredQuery.where, {
    fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: "1" } },
  });

  const q2 = countQuery({ stat: "deep", season: 1, above: 5 });
  const sq2 = q2.structuredAggregationQuery.structuredQuery;
  assert.deepEqual(sq2.where, {
    compositeFilter: {
      op: "AND",
      filters: [
        { fieldFilter: { field: { fieldPath: "season" }, op: "EQUAL", value: { integerValue: "1" } } },
        { fieldFilter: { field: { fieldPath: "deepKey" }, op: "GREATER_THAN", value: { integerValue: "5" } } },
      ],
    },
  });
  assert.deepEqual(sq2.orderBy, [{ field: { fieldPath: "deepKey" }, direction: "DESCENDING" }]);
});

test("ownRunsQuery: uid filter, __name__ ASC, limit 50, startAt only with afterName", () => {
  const q1 = ownRunsQuery({ uid: "u1" });
  assert.deepEqual(q1.structuredQuery.where, {
    fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: "u1" } },
  });
  assert.deepEqual(q1.structuredQuery.orderBy, [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }]);
  assert.equal(q1.structuredQuery.limit, 50);
  assert.equal("startAt" in q1.structuredQuery, false);

  const after = "projects/delve-die-repeat-6ba5f/databases/(default)/documents/runs/u1_aaaa1111";
  const q2 = ownRunsQuery({ uid: "u1", afterName: after });
  assert.deepEqual(q2.structuredQuery.startAt, { values: [{ referenceValue: after }], before: false });
});

// --- purity ------------------------------------------------------------

test("purity: no window/document/navigator/localStorage/sessionStorage and no bare global fetch", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "runDoc.js"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const bad of ["window", "document", "navigator", "localStorage", "sessionStorage"]) {
    assert.ok(!new RegExp(`\\b${bad}\\b`).test(src), `must not reference ${bad}`);
  }
  assert.ok(!/(^|[^.\w])fetch\s*\(/.test(src), "must not call a bare global fetch");
});

// ---------------------------------------------------------------------------
// Phase 87 (BOARD-28, report #9): DEPTH ties go to the MOST steps
// ---------------------------------------------------------------------------

test("deepKeyOf (Phase 87 BOARD-28): floor * 1,000,000 + steps, more steps ranks higher, a floor always dominates", () => {
  assert.equal(deepKeyOf({ floor: 5, steps: 900 }), 5000900);
  assert.equal(deepKeyOf({ floor: 5, steps: 100 }), 5000100);
  assert.ok(deepKeyOf({ floor: 5, steps: 900 }) > deepKeyOf({ floor: 5, steps: 100 }));
  assert.ok(deepKeyOf({ floor: 6, steps: 0 }) > deepKeyOf({ floor: 5, steps: STEPS_MAX }));
});

test("validateRunDoc: a doc carrying the old 2.2.0 deepKey (fewer steps first) fails exactly [deepkey]", () => {
  const valid = baseValidDoc();
  assert.deepEqual(validateRunDoc(valid), []);
  // floor * 1,000,000 + (999,999 - steps): the formula 2.2.0 clients wrote.
  const old = { ...valid, deepKey: valid.floor * 1000000 + (STEPS_MAX - valid.steps) };
  assert.notEqual(old.deepKey, deepKeyOf(valid));
  assert.deepEqual(validateRunDoc(old), ["deepkey"]);
});

// ---------------------------------------------------------------------------
// Phase 91.2 (BOARD-31, D-13): the handle is the poster's verified name
// ---------------------------------------------------------------------------

test("handle: a string of 1..BOARD_NAME_MAX_CHARS characters passes, empty / 65 / non-string fail", () => {
  assert.equal(BOARD_NAME_MAX_CHARS, 64);
  assert.deepEqual(validateRunDoc(docFrom({ handle: "x" })), []);
  assert.deepEqual(validateRunDoc(docFrom({ handle: "x".repeat(BOARD_NAME_MAX_CHARS) })), []);
  assert.deepEqual(validateRunDoc(docFrom({ handle: "" })), ["handle"]);
  assert.deepEqual(validateRunDoc(docFrom({ handle: "x".repeat(BOARD_NAME_MAX_CHARS + 1) })), ["handle"]);
  assert.deepEqual(validateRunDoc(docFrom({ handle: null })), ["handle"]);
  assert.deepEqual(validateRunDoc(docFrom({ handle: 7 })), ["handle"]);
});

test("handle: with a name option it must equal the name exactly; without one a 2.2.0 @handle still passes", () => {
  const doc = docFrom({ handle: "Moss Knuckle" });
  assert.deepEqual(validateRunDoc(doc, { name: "Moss Knuckle" }), []);
  assert.deepEqual(validateRunDoc(doc, { name: "Moss Knuckl" }), ["handle"]);
  assert.deepEqual(validateRunDoc(doc, { name: "moss knuckle" }), ["handle"]);
  assert.deepEqual(validateRunDoc(doc, { name: "" }), ["handle"]);
  assert.deepEqual(validateRunDoc(doc, { name: undefined }), []);
  assert.deepEqual(validateRunDoc(doc, { name: 5 }), [], "a non-string name is not a given name");
  assert.deepEqual(validateRunDoc(docFrom({ handle: "@mossjaw" })), []);
  assert.deepEqual(validateRunDoc(docFrom({ handle: "@mossjaw" }), { name: "Moss Knuckle" }), ["handle"]);
});

test("buildRunDoc: the handle is copied as given (no name rule at build time)", () => {
  const summary = buildRunSummary(newRun(11), "combat", 0);
  const built = buildRunDoc(summary, { uid: "u1", handle: "Moss Knuckle", version: "2.3.0 (13)" });
  assert.equal(built.ok, true, JSON.stringify(built));
  assert.equal(built.doc.handle, "Moss Knuckle");
  const bad = buildRunDoc(summary, { uid: "u1", handle: "", version: "2.3.0 (13)" });
  assert.deepEqual(bad, { ok: false, reason: "invalid", fails: ["handle"] });
});

test("purity: runDoc.js no longer imports the rolled-handle module", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "runDoc.js"), "utf8");
  assert.equal(/from\s+["']\.\/handles\.js["']/.test(raw), false);
  assert.equal(raw.includes("handles.js"), false, "not even in a comment");
  assert.ok(/from\s+["']\.\/boardName\.js["']/.test(raw));
});

test("D-11: the client has no handle-only commit builder (the transition-only legacy shape was deleted at the 2.3 cutover)", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "runDoc.js"), "utf8");
  assert.equal(raw.includes("handleUpdateCommit"), false);
  for (const name of ["legacyHandleUpdateCommit", "legacyDeepKeyOf", "LEGACY_HANDLE_PATTERN", "isLegacyHandle"]) {
    assert.equal(raw.includes(name), false, `${name} is deleted`);
  }
  const writes = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardWrites.js"), "utf8");
  assert.equal(/legacyHandleUpdateCommit|handleUpdateCommit/.test(writes), false, "boardWrites never builds a handle update");
});
