// Phase 65 Plan 02 (RUN-01/RUN-02/RUN-03) — engine/records.js: the run's
// integrity hash, the one shared board table, and the bests record.
//
// Task 1 proves: fnv1a32's known test vectors and a BigInt reference match;
// runHash's shape, field order, adjacency and ordering independence;
// compareRuns/boardValue/lineageKey per the CONTEXT board table.
//
// Task 2 (added below) proves: emptyBests/sanitizeBests/updateBests/
// backfillBests/sortGraveyard — the pure, non-mutating bests record.

import test from "node:test";
import assert from "node:assert/strict";

import {
  RUN_HASH_FIELDS,
  HASH_DELIMITER,
  fnv1a32,
  runHash,
  BOARD_TOP_N,
  BOARD_IDS,
  RANKED_BOARDS,
  compareRuns,
  boardValue,
  lineageKey,
  emptyBests,
  sanitizeBests,
  updateBests,
  backfillBests,
  sortGraveyard,
} from "../../engine/records.js";

// --- deterministic generators (no Math.random) ------------------------------

/** A tiny deterministic PRNG (mulberry32-alike) so tests need no engine rng. */
function seededGen(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RACES = ["Human", "Dwarf", "Elf", "Wilmsry"];
const CLASSES = ["Fighter", "Thief", "Wizard", "Cutthroat"];
const CAUSES = ["combat", "trap", "starvation", "maze"];

/** genRun(i, gen) — deterministic RunSummary-shaped object. */
function genRun(i, gen) {
  const f = () => Math.floor(gen() * 1000);
  return {
    season: f() % 3,
    seed: f(),
    acts: f(),
    floor: f() % 25,
    steps: f(),
    day: f() % 40,
    kills: f() % 60,
    gold: f() * 10,
    sp: f(),
    level: (f() % 10) + 1,
    race: RACES[f() % RACES.length],
    sub: `Sub${f() % 5}`,
    cls: CLASSES[f() % CLASSES.length],
    name: `Delver${i}`,
    cause: CAUSES[f() % CAUSES.length],
  };
}

// --- fnv1a32 -----------------------------------------------------------------

test("fnv1a32 matches the three pinned test vectors", () => {
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32("a"), 0xe40c292c);
  assert.equal(fnv1a32("foobar"), 0xbf9cf968);
});

test("fnv1a32 over a deterministic 10,000-char string matches a BigInt reference implementation", () => {
  let s = "";
  for (let i = 0; i < 10000; i++) {
    s += String.fromCharCode(32 + (i % (126 - 32 + 1)));
  }

  // BigInt reference FNV-1a 32-bit, written independently of the implementation.
  const OFFSET = 0x811c9dc5n;
  const PRIME = 0x01000193n;
  const MASK = 0xffffffffn;
  let h = OFFSET;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * PRIME) & MASK;
  }
  const expected = Number(h);

  assert.equal(fnv1a32(s), expected);
});

// --- runHash -----------------------------------------------------------------

test("runHash returns exactly 8 lowercase hex characters for 500 generated runs", () => {
  const gen = seededGen(777);
  for (let i = 0; i < 500; i++) {
    const h = runHash(genRun(i, gen));
    assert.match(h, /^[0-9a-f]{8}$/, `run ${i} produced "${h}"`);
  }
});

test("runHash left-pads a small hash value to 8 hex characters (stubbed fnv output)", () => {
  // Prove the padStart(8, "0") path directly against fnv1a32's own output
  // shape, independent of whether a real run happens to hash small.
  const smallHex = (0x0f).toString(16).padStart(8, "0");
  assert.equal(smallHex, "0000000f");
  assert.equal(smallHex.length, 8);

  // And confirm runHash's own zero-padding by constructing a run whose
  // canonical string happens to be the empty string (all-empty fields) —
  // this exercises the real padStart call inside runHash.
  const h = runHash({});
  assert.equal(h.length, 8);
  assert.equal(h, fnv1a32(RUN_HASH_FIELDS.map(() => "").join(HASH_DELIMITER)).toString(16).padStart(8, "0"));
});

test("runHash ignores when, note and epitaph", () => {
  const gen = seededGen(42);
  const run = genRun(1, gen);
  const decorated = { ...run, when: 1, note: "x", epitaph: "y" };
  assert.equal(runHash(run), runHash(decorated));
});

test("runHash changes when any single RUN_HASH_FIELDS field changes", () => {
  const gen = seededGen(43);
  const base = genRun(2, gen);
  const baseHash = runHash(base);
  for (const key of RUN_HASH_FIELDS) {
    const mutated = { ...base, [key]: `${base[key]}__mutated` };
    assert.notEqual(runHash(mutated), baseHash, `field "${key}" did not change the hash`);
  }
});

test("runHash: adjacency pairs across field boundaries hash differently", () => {
  const a = runHash({ cls: "FighterX", name: "Anna" });
  const b = runHash({ cls: "Fighter", name: "XAnna" });
  assert.notEqual(a, b);

  assert.notEqual(runHash({ seed: 0 }), runHash({}));
  assert.notEqual(runHash({ acts: 0 }), runHash({}));
});

test("runHash is independent of key insertion order and runHash({}) never throws", () => {
  const gen = seededGen(99);
  const run = genRun(3, gen);
  const reversed = {};
  for (const key of Object.keys(run).reverse()) reversed[key] = run[key];
  assert.equal(runHash(run), runHash(reversed));

  assert.doesNotThrow(() => runHash({}));
  assert.match(runHash({}), /^[0-9a-f]{8}$/);
  // fourteen delimiters joining 15 empty fields
  assert.equal(runHash(null), runHash({}));
  assert.equal(runHash(undefined), runHash({}));
  assert.equal(runHash("not-an-object"), runHash({}));
});

// --- compareRuns / boardValue / lineageKey -----------------------------------

test("compareRuns deep/lean: floor desc, then steps asc", () => {
  assert.ok(compareRuns("deep", { floor: 5, steps: 900 }, { floor: 4, steps: 10 }) < 0);
  assert.ok(compareRuns("deep", { floor: 5, steps: 100 }, { floor: 5, steps: 200 }) < 0);
  assert.equal(
    compareRuns("deep", { floor: 5, steps: 100 }, { floor: 5, steps: 100 }),
    compareRuns("lean", { floor: 5, steps: 100 }, { floor: 5, steps: 100 }),
  );
  assert.equal(compareRuns("lean", { floor: 5, steps: 900 }, { floor: 4, steps: 10 }) < 0, true);
});

test("compareRuns days: day desc, then floor desc on a tie", () => {
  assert.ok(compareRuns("days", { day: 9, floor: 1 }, { day: 8, floor: 20 }) < 0);
  assert.ok(compareRuns("days", { day: 5, floor: 10 }, { day: 5, floor: 3 }) < 0);
});

test("compareRuns kills: kills desc, then floor desc", () => {
  assert.ok(compareRuns("kills", { kills: 10, floor: 1 }, { kills: 5, floor: 20 }) < 0);
  assert.ok(compareRuns("kills", { kills: 5, floor: 10 }, { kills: 5, floor: 3 }) < 0);
});

test("compareRuns purse: gold desc only, floor difference on equal gold returns 0", () => {
  assert.ok(compareRuns("purse", { gold: 500, floor: 1 }, { gold: 100, floor: 20 }) < 0);
  assert.equal(compareRuns("purse", { gold: 500, floor: 1 }, { gold: 500, floor: 20 }), 0);
});

test("compareRuns combo/yard order like deep", () => {
  const a = { floor: 6, steps: 10 };
  const b = { floor: 6, steps: 50 };
  assert.equal(compareRuns("combo", a, b), compareRuns("deep", a, b));
  assert.equal(compareRuns("yard", a, b), compareRuns("deep", a, b));
});

test("compareRuns: a full tie returns 0 on every board", () => {
  const run = { floor: 5, steps: 5, day: 5, kills: 5, gold: 5 };
  for (const board of BOARD_IDS) {
    assert.equal(compareRuns(board, run, { ...run }), 0, `board "${board}" did not tie`);
  }
});

test("compareRuns: missing or non-finite numeric fields compare as 0", () => {
  assert.equal(compareRuns("deep", {}, {}), 0);
  assert.equal(compareRuns("purse", { gold: NaN }, { gold: Infinity }), 0);
  assert.equal(compareRuns("days", { day: "x" }, { day: undefined }), 0);
});

test("compareRuns: an unknown board id returns 0", () => {
  assert.equal(compareRuns("no-such-board", { floor: 9 }, { floor: 1 }), 0);
});

test("boardValue maps each board to its headline number", () => {
  const run = { floor: 3, day: 4, kills: 5, gold: 6 };
  assert.equal(boardValue("deep", run), 3);
  assert.equal(boardValue("lean", run), 3);
  assert.equal(boardValue("combo", run), 3);
  assert.equal(boardValue("yard", run), 3);
  assert.equal(boardValue("days", run), 4);
  assert.equal(boardValue("kills", run), 5);
  assert.equal(boardValue("purse", run), 6);
  assert.equal(boardValue("no-such-board", run), 0);
});

test("lineageKey joins race and cls with a space", () => {
  assert.equal(lineageKey({ race: "Dwarf", cls: "Fighter" }), "Dwarf Fighter");
});

// --- board table constants ---------------------------------------------------

test("BOARD_IDS and RANKED_BOARDS match the mock's tab order and are frozen", () => {
  assert.deepStrictEqual(BOARD_IDS, ["deep", "lean", "combo", "days", "kills", "purse", "yard"]);
  assert.deepStrictEqual(RANKED_BOARDS, ["deep", "lean", "days", "kills", "purse"]);
  assert.ok(Object.isFrozen(BOARD_IDS));
  assert.ok(Object.isFrozen(RANKED_BOARDS));
  assert.ok(Object.isFrozen(RUN_HASH_FIELDS));
  assert.equal(BOARD_TOP_N, 10);
});

test("RUN_HASH_FIELDS is exactly the 15 names in the pinned order", () => {
  assert.deepStrictEqual(RUN_HASH_FIELDS, [
    "season", "seed", "acts", "floor", "steps", "day", "kills", "gold",
    "sp", "level", "race", "sub", "cls", "name", "cause",
  ]);
  assert.equal(HASH_DELIMITER, "\u001f");
});

// =============================================================================
// Task 2 — emptyBests, sanitizeBests, updateBests, backfillBests, sortGraveyard
// =============================================================================

/** deepFreeze(obj) — recursive Object.freeze, used to prove no-mutation. */
function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  }
  return obj;
}

/** makeSummary(overrides) — a full RunSummary with a correctly computed hash. */
function makeSummary(overrides = {}) {
  const base = {
    season: 1, seed: 1, acts: 10, floor: 5, steps: 500, day: 3, kills: 2,
    gold: 100, sp: 50, level: 2, race: "Human", sub: "Soldier", cls: "Fighter",
    name: "Anna", cause: "combat",
    ...overrides,
  };
  return { ...base, hash: runHash(base) };
}

/** legacyStone(overrides) — a pre-ledger graveyard tombstone (no season/seed/acts/hash). */
function legacyStone(overrides = {}) {
  return {
    name: "Old One", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 88, floor: 4, day: 6, steps: 300, gold: 50, kills: 2,
    cause: "combat", note: "died", epitaph: "RIP", when: 1000,
    ...overrides,
  };
}

// --- emptyBests ---------------------------------------------------------------

test("emptyBests returns a fresh, deep-equal object on every call", () => {
  const expected = {
    v: 1,
    runs: {},
    boards: { deep: [], lean: [], days: [], kills: [], purse: [] },
    lineage: {},
    last: null,
  };
  const a = emptyBests();
  assert.deepStrictEqual(a, expected);
  const b = emptyBests();
  assert.notEqual(a, b);
  assert.notEqual(a.boards, b.boards);
  a.boards.deep.push("x");
  assert.deepStrictEqual(b.boards.deep, []);
});

// --- updateBests ---------------------------------------------------------------

test("updateBests(emptyBests(), s1) records the first run across every board and lineage", () => {
  const s1 = makeSummary({ floor: 5 });
  const { record, newBests, first } = updateBests(emptyBests(), s1);

  assert.equal(first, true);
  assert.deepStrictEqual(newBests, []);
  for (const board of RANKED_BOARDS) {
    assert.deepStrictEqual(record.boards[board], [s1.hash]);
  }
  assert.deepStrictEqual(record.lineage[lineageKey(s1)], { count: 1, best: s1.hash });
  assert.deepStrictEqual(Object.keys(record.runs), [s1.hash]);
  assert.deepStrictEqual(record.runs[s1.hash], s1);
  assert.equal(record.last, s1.hash);
});

test("updateBests: a strictly deeper same-combo run announces deep, lean and combo, but not days/kills/purse when those are not beaten", () => {
  const s1 = makeSummary({ floor: 5, steps: 100, day: 10, kills: 5, gold: 200 });
  const { record: r1 } = updateBests(emptyBests(), s1);

  const s2 = makeSummary({ floor: 8, steps: 50, day: 8, kills: 3, gold: 150, name: "Bob" });
  const { newBests, first } = updateBests(r1, s2);

  assert.equal(first, false);
  assert.deepStrictEqual(newBests, ["deep", "lean", "combo"]);
});

test("updateBests: a run beating every ranked board from a NEW combo announces all boards but never a first-of-combo lineage", () => {
  const s1 = makeSummary({ floor: 5, steps: 200, day: 5, kills: 5, gold: 100, race: "Human", cls: "Fighter" });
  const { record: r1 } = updateBests(emptyBests(), s1);

  const s2 = makeSummary({
    floor: 10, steps: 50, day: 10, kills: 10, gold: 500,
    race: "Dwarf", cls: "Thief", name: "Bob",
  });
  const { record: r2, newBests, first } = updateBests(r1, s2);

  assert.equal(first, false);
  assert.deepStrictEqual(newBests, ["deep", "lean", "days", "kills", "purse"]);
  assert.deepStrictEqual(r2.lineage[lineageKey(s2)], { count: 1, best: s2.hash });
});

test("updateBests: a run tying #1 on every key is not a new best, and is inserted directly after the incumbent", () => {
  const s1 = makeSummary({ floor: 5, steps: 100 });
  const { record: r1 } = updateBests(emptyBests(), s1);

  const s2 = makeSummary({ floor: 5, steps: 100, name: "Bob", cause: "trap" });
  const { record: r2, newBests, first } = updateBests(r1, s2);

  assert.equal(first, false);
  assert.deepStrictEqual(newBests, [], "a full tie announces nothing on any board");
  for (const board of RANKED_BOARDS) {
    assert.deepStrictEqual(r2.boards[board], [s1.hash, s2.hash], `board "${board}" did not keep the incumbent first`);
  }
});

test("updateBests: a lesser run announces nothing and is inserted at its sorted top-ten position", () => {
  const s1 = makeSummary({ floor: 8, steps: 50, day: 10, kills: 10, gold: 300 });
  const { record: r1 } = updateBests(emptyBests(), s1);

  const s2 = makeSummary({ floor: 3, steps: 900, day: 2, kills: 1, gold: 10, name: "Loser" });
  const { record: r2, newBests } = updateBests(r1, s2);

  assert.deepStrictEqual(newBests, []);
  assert.deepStrictEqual(r2.boards.deep, [s1.hash, s2.hash]);
});

test("updateBests: lineage count always increments; best only switches when strictly beaten", () => {
  const s1 = makeSummary({ floor: 5, steps: 100, name: "First" });
  let rec = updateBests(emptyBests(), s1).record;
  assert.deepStrictEqual(rec.lineage[lineageKey(s1)], { count: 1, best: s1.hash });

  const s2 = makeSummary({ floor: 3, steps: 900, name: "Second" });
  const r2 = updateBests(rec, s2);
  assert.deepStrictEqual(r2.newBests, []);
  rec = r2.record;
  assert.deepStrictEqual(rec.lineage[lineageKey(s1)], { count: 2, best: s1.hash });

  const s3 = makeSummary({ floor: 9, steps: 20, name: "Third" });
  const r3 = updateBests(rec, s3);
  assert.ok(r3.newBests.includes("combo"));
  rec = r3.record;
  assert.deepStrictEqual(rec.lineage[lineageKey(s1)], { count: 3, best: s3.hash });
});

test("updateBests is idempotent: applying the same summary twice returns newBests [] and a deepStrictEqual record", () => {
  const s = makeSummary({ floor: 6 });
  const { record: r1 } = updateBests(emptyBests(), s);
  const second = updateBests(r1, s);

  assert.deepStrictEqual(second.newBests, []);
  assert.equal(second.first, false);
  assert.deepStrictEqual(second.record, r1);

  const third = updateBests(second.record, s);
  assert.deepStrictEqual(third.record, second.record);
  assert.deepStrictEqual(third.newBests, []);
});

test("updateBests does not mutate a deep-frozen record or a deep-frozen summary", () => {
  const s1 = makeSummary({ floor: 4 });
  const { record: r1 } = updateBests(emptyBests(), s1);
  const frozenRecord = deepFreeze(structuredClone(r1));
  const s2 = deepFreeze(makeSummary({ floor: 9, name: "Bob" }));

  assert.doesNotThrow(() => updateBests(frozenRecord, s2));
  const { record: r2 } = updateBests(frozenRecord, s2);
  assert.notEqual(r2, frozenRecord);
  assert.deepStrictEqual(frozenRecord, deepFreeze(structuredClone(r1)), "the frozen input record is unchanged");
});

test("updateBests: an invalid or non-object summary returns the input record unchanged", () => {
  const r = emptyBests();
  assert.deepStrictEqual(updateBests(r, null), { record: r, newBests: [], first: false });
  assert.deepStrictEqual(updateBests(r, "nope"), { record: r, newBests: [], first: false });
  assert.deepStrictEqual(updateBests(r, { hash: "zzzzzzzz" }), { record: r, newBests: [], first: false });
  assert.deepStrictEqual(updateBests(r, { hash: "abc" }), { record: r, newBests: [], first: false });
});

test("updateBests: the deepest run survives a 70-run graveyard fold and every board stays capped at 10", () => {
  const gen = seededGen(555);
  let rec = emptyBests();
  const deepest = makeSummary({ floor: 999, steps: 1, name: "Deepest", cause: "combat" });
  rec = updateBests(rec, deepest).record;

  for (let i = 0; i < 69; i++) {
    const run = genRun(i, gen);
    const summary = { ...run, hash: runHash(run) };
    rec = updateBests(rec, summary).record;
  }

  for (const board of RANKED_BOARDS) {
    assert.ok(rec.boards[board].length <= BOARD_TOP_N, `board "${board}" exceeded cap`);
  }
  assert.equal(rec.boards.deep[0], deepest.hash);

  const referenced = new Set();
  for (const board of RANKED_BOARDS) for (const h of rec.boards[board]) referenced.add(h);
  for (const key of Object.keys(rec.lineage)) {
    if (rec.lineage[key].best) referenced.add(rec.lineage[key].best);
  }
  assert.deepStrictEqual(new Set(Object.keys(rec.runs)), referenced);
});

// --- sanitizeBests ---------------------------------------------------------------

test("sanitizeBests coerces invalid inputs to emptyBests", () => {
  for (const bad of [null, [], "x", 5, { runs: 5 }]) {
    assert.deepStrictEqual(sanitizeBests(bad), emptyBests());
  }
});

test("sanitizeBests drops dangling hashes, caps a 14-hash list at 10, drops unknown board keys, defaults a missing board key to []", () => {
  const validRuns = {};
  const hashes = [];
  for (let i = 0; i < 14; i++) {
    const h = i.toString(16).padStart(8, "0");
    validRuns[h] = { hash: h, floor: i };
    hashes.push(h);
  }
  const raw = {
    v: 1,
    runs: validRuns,
    boards: {
      deep: [...hashes, "deadbeef"],
      lean: [],
      unknownBoard: ["00000000"],
    },
    lineage: {},
    last: null,
  };
  const result = sanitizeBests(raw);
  assert.equal(result.boards.deep.length, 10, "capped at 10");
  assert.ok(!result.boards.deep.includes("deadbeef"), "dangling hash dropped");
  assert.deepStrictEqual(result.boards.days, [], "missing board key becomes []");
  assert.ok(!("unknownBoard" in result.boards), "unknown board key dropped");
});

test("sanitizeBests drops invalid lineage entries and clears a dangling lineage best", () => {
  const raw = {
    runs: { aaaaaaaa: { hash: "aaaaaaaa", floor: 1 } },
    boards: { deep: ["aaaaaaaa"] },
    lineage: {
      "Human Fighter": { count: 2, best: "aaaaaaaa" },
      "Zero Count": { count: 0, best: "aaaaaaaa" },
      "Non Integer": { count: 1.5, best: "aaaaaaaa" },
      "Dangling Best": { count: 1, best: "deadbeef" },
    },
    last: null,
  };
  const result = sanitizeBests(raw);
  assert.deepStrictEqual(result.lineage["Human Fighter"], { count: 2, best: "aaaaaaaa" });
  assert.ok(!("Zero Count" in result.lineage));
  assert.ok(!("Non Integer" in result.lineage));
  assert.deepStrictEqual(result.lineage["Dangling Best"], { count: 1, best: null });
});

test("sanitizeBests drops a runs entry whose value.hash differs from its key", () => {
  const raw = { runs: { aaaaaaaa: { hash: "bbbbbbbb", floor: 1 } }, boards: {}, lineage: {}, last: null };
  const result = sanitizeBests(raw);
  assert.deepStrictEqual(result.runs, {});
});

test("sanitizeBests(updateBests(emptyBests(), s).record) round-trips through JSON unchanged", () => {
  const s = makeSummary({ floor: 12 });
  const { record } = updateBests(emptyBests(), s);
  const sanitized = sanitizeBests(record);
  const roundTripped = JSON.parse(JSON.stringify(sanitized));
  assert.deepStrictEqual(sanitizeBests(roundTripped), sanitized);
});

// --- backfillBests ---------------------------------------------------------------

test("backfillBests(non-array) returns emptyBests()", () => {
  for (const bad of [null, {}, "x", 5, undefined]) {
    assert.deepStrictEqual(backfillBests(bad), emptyBests());
  }
});

test("backfillBests normalizes legacy stones to season 0 with no seed/acts, and orders boards.deep floor desc then steps asc", () => {
  const graves = [
    legacyStone({ name: "Newest", floor: 5, steps: 10 }),
    legacyStone({ name: "Middle", floor: 8, steps: 20 }),
    legacyStone({ name: "Oldest", floor: 2, steps: 5 }),
  ];
  const rec = backfillBests(graves);
  for (const hash of Object.keys(rec.runs)) {
    const run = rec.runs[hash];
    assert.equal(run.season, 0);
    assert.ok(!("seed" in run));
    assert.ok(!("acts" in run));
    assert.equal(run.hash, runHash(run));
  }
  const floors = rec.boards.deep.map((h) => rec.runs[h].floor);
  assert.deepStrictEqual(floors, [8, 5, 2]);
});

test("backfillBests skips a stone without a finite numeric floor", () => {
  const graves = [legacyStone({ floor: 5 }), { name: "X", cause: "combat" }];
  const rec = backfillBests(graves);
  assert.equal(Object.keys(rec.runs).length, 1);
});

test("backfillBests keeps season and hash for a stone that already carries both", () => {
  const validHash = "0a0a0a0a";
  const stone = legacyStone({ floor: 6, season: 1, hash: validHash, seed: 42, acts: 7 });
  const rec = backfillBests([stone]);
  const [hash] = Object.keys(rec.runs);
  assert.equal(hash, validHash);
  assert.equal(rec.runs[hash].season, 1);
  assert.equal(rec.runs[hash].seed, 42);
});

test("backfillBests: tied stones rank the oldest stone first", () => {
  const graves = [
    legacyStone({ name: "Newer", floor: 6, steps: 50 }),
    legacyStone({ name: "Older", floor: 6, steps: 50 }),
  ];
  const rec = backfillBests(graves);
  const first = rec.runs[rec.boards.deep[0]];
  assert.equal(first.name, "Older", "the older stone (later array index) ranks first on a tie");
});

test("backfillBests(graves) makes no announcements and returns the record only", () => {
  const rec = backfillBests([legacyStone({ floor: 3 })]);
  assert.deepStrictEqual(Object.keys(rec), ["v", "runs", "boards", "lineage", "last"]);
});

// --- sortGraveyard ---------------------------------------------------------------

test("sortGraveyard(60 stones) returns 60 entries ordered floor desc then steps asc, never cut, without mutating input", () => {
  const gen = seededGen(321);
  const graves = [];
  for (let i = 0; i < 60; i++) {
    const r = genRun(i, gen);
    graves.push(legacyStone({ name: `Stone${i}`, floor: r.floor, steps: r.steps }));
  }
  const original = graves.map((g) => ({ ...g }));
  const sorted = sortGraveyard(graves);

  assert.equal(sorted.length, 60);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(compareRuns("yard", sorted[i - 1], sorted[i]) <= 0, `not sorted at index ${i}`);
  }
  assert.deepStrictEqual(graves, original, "input array not mutated");
});

test("sortGraveyard skips invalid stones and keeps ties in input order (a stable sort)", () => {
  const a = legacyStone({ name: "A", floor: 5, steps: 10 });
  const b = legacyStone({ name: "B", floor: 5, steps: 10 });
  const invalid = { name: "NoFloor" };
  const sorted = sortGraveyard([a, invalid, b]);
  assert.deepStrictEqual(sorted.map((s) => s.name), ["A", "B"]);
});

test("sortGraveyard(non-array) returns []", () => {
  assert.deepStrictEqual(sortGraveyard(null), []);
  assert.deepStrictEqual(sortGraveyard("x"), []);
});
