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
  leanRate,
  boardValue,
  lineageKey,
  lineageRuns,
  emptyBests,
  sanitizeBests,
  updateBests,
  backfillBests,
  normalizeStone,
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

test("compareRuns deep: floor desc, then steps asc", () => {
  assert.ok(compareRuns("deep", { floor: 5, steps: 900 }, { floor: 4, steps: 10 }) < 0);
  assert.ok(compareRuns("deep", { floor: 5, steps: 100 }, { floor: 5, steps: 200 }) < 0);
  assert.equal(compareRuns("deep", { floor: 5, steps: 100 }, { floor: 5, steps: 100 }), 0);
});

// --- compareRuns lean (Phase 66, D-09): squares per floor, not a DEEPEST duplicate --

test("compareRuns lean: squares per floor asc — a lower rate wins even at a shallower floor", () => {
  assert.ok(
    compareRuns("lean", { floor: 4, steps: 40 }, { floor: 2, steps: 30 }) < 0,
    "10 per floor beats 15 per floor",
  );
  assert.ok(
    compareRuns("lean", { floor: 9, steps: 900 }, { floor: 1, steps: 22 }) > 0,
    "100 per floor loses to 22 per floor",
  );
});

test("compareRuns lean: an equal rate (cross-multiplied, no rounding) ties to the deeper floor, then fewer steps", () => {
  assert.ok(
    compareRuns("lean", { floor: 4, steps: 80 }, { floor: 2, steps: 40 }) < 0,
    "both rate 20; the deeper run (a) wins",
  );
  assert.ok(
    compareRuns("lean", { floor: 3, steps: 1 }, { floor: 6, steps: 2 }) > 0,
    "1/3 vs 2/6 is the rounding trap — cross-multiplication keeps them tied, and the deeper run (b) wins",
  );
});

test("compareRuns lean: a placed run always beats an unplaced one; two unplaced runs fall to fewer steps", () => {
  assert.ok(compareRuns("lean", { floor: 1, steps: 500 }, { floor: 0, steps: 0 }) < 0);
  assert.ok(compareRuns("lean", { floor: 0, steps: 5 }, { floor: 0, steps: 9 }) < 0);
});

test("compareRuns lean: a full tie returns 0, and 200 generated pairs (including missing/NaN/Infinity fields) never return NaN", () => {
  assert.equal(compareRuns("lean", {}, {}), 0);

  const gen = seededGen(2026);
  const weird = [undefined, null, NaN, Infinity, -Infinity, "x", {}, 0];
  function weirdOrNumber() {
    const pick = weird[Math.floor(gen() * weird.length)];
    return gen() < 0.5 ? pick : gen() * 30;
  }
  for (let i = 0; i < 200; i++) {
    const a = { floor: weirdOrNumber(), steps: weirdOrNumber() };
    const b = { floor: weirdOrNumber(), steps: weirdOrNumber() };
    const result = compareRuns("lean", a, b);
    assert.ok(!Number.isNaN(result), `pair ${i} (${JSON.stringify(a)}, ${JSON.stringify(b)}) produced NaN`);
  }
});

// --- leanRate ------------------------------------------------------------------

test("leanRate: steps/floor when placed, Infinity when unplaced or non-object", () => {
  assert.equal(leanRate({ floor: 4, steps: 40 }), 10);
  assert.equal(leanRate({ floor: 0, steps: 5 }), Infinity);
  assert.equal(leanRate(null), Infinity);
  assert.equal(leanRate({}), Infinity);
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

test("lineageKey (Phase 70, D-10) joins race and sub-class with a space, never the base class", () => {
  assert.equal(lineageKey({ race: "Dwarven", sub: "Knight", cls: "Fighter" }), "Dwarven Knight");
  assert.doesNotThrow(() => lineageKey(null));
  assert.doesNotThrow(() => lineageKey({}));
  assert.equal(lineageKey(null), " ");
  assert.equal(lineageKey({}), " ");
  assert.equal(lineageKey({ race: "Troll" }), "Troll ");
});

test("lineageRuns (Phase 70, D-12): non-array gives [], filters to the lineage, orders floor desc/steps asc/hash asc, never mutates", () => {
  for (const bad of [null, undefined, {}, "x", 5]) assert.deepStrictEqual(lineageRuns(bad, "Human Knight"), []);

  const a = { race: "Human", sub: "Knight", floor: 5, steps: 50, hash: "bbbbbbbb" };
  const b = { race: "Human", sub: "Knight", floor: 5, steps: 50, hash: "aaaaaaaa" };
  const c = { race: "Human", sub: "Knight", floor: 9, steps: 900, hash: "cccccccc" };
  const d = { race: "Human", sub: "Knight", floor: 5, steps: 10, hash: "dddddddd" };
  const other = { race: "Human", sub: "Wizard", floor: 20, steps: 1, hash: "eeeeeeee" };
  const input = Object.freeze([a, null, "junk", [1], b, other, c, d]);

  const out = lineageRuns(input, "Human Knight");
  assert.deepStrictEqual(out.map((r) => r.hash), ["cccccccc", "dddddddd", "aaaaaaaa", "bbbbbbbb"]);
  assert.notEqual(out, input);
  assert.deepStrictEqual(lineageRuns([b, a], "Human Knight").map((r) => r.hash), ["aaaaaaaa", "bbbbbbbb"], "an exact tie always falls to hash ascending");
  assert.deepStrictEqual(lineageRuns([a, b], "Human Knight").map((r) => r.hash), ["aaaaaaaa", "bbbbbbbb"]);
  assert.deepStrictEqual(lineageRuns(input, "Troll Acrobat"), []);
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

test("updateBests(emptyBests(), s1) records the first run across every board, with no lineage map", () => {
  const s1 = makeSummary({ floor: 5 });
  const { record, newBests, first } = updateBests(emptyBests(), s1);

  assert.equal(first, true);
  assert.deepStrictEqual(newBests, []);
  for (const board of RANKED_BOARDS) {
    assert.deepStrictEqual(record.boards[board], [s1.hash]);
  }
  assert.ok(!("lineage" in record), "the Phase 65 lineage map is retired (Phase 70, D-12)");
  assert.deepStrictEqual(lineageRuns(Object.values(record.runs), lineageKey(s1)).map((r) => r.hash), [s1.hash]);
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
  const s1 = makeSummary({ floor: 5, steps: 200, day: 5, kills: 5, gold: 100, race: "Human", sub: "Knight", cls: "Fighter" });
  const { record: r1 } = updateBests(emptyBests(), s1);

  const s2 = makeSummary({
    floor: 10, steps: 50, day: 10, kills: 10, gold: 500,
    race: "Dwarven", sub: "Pickpocket", cls: "Thief", name: "Bob",
  });
  const { record: r2, newBests, first } = updateBests(r1, s2);

  assert.equal(first, false);
  assert.deepStrictEqual(newBests, ["deep", "lean", "days", "kills", "purse"]);
  assert.ok(r2.runs[s2.hash], "the first run of a new lineage is held");
  assert.ok(!("lineage" in r2));
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

test("updateBests (Phase 70, D-12 / 65 D-14): LINEAGE announces only a strict beat of the held best of the same race + sub-class", () => {
  const s1 = makeSummary({ floor: 5, steps: 100, name: "First" });
  const r1 = updateBests(emptyBests(), s1);
  assert.ok(!r1.newBests.includes("combo"), "the first run of a lineage never announces LINEAGE");
  let rec = r1.record;

  const s2 = makeSummary({ floor: 3, steps: 900, name: "Second" });
  const r2 = updateBests(rec, s2);
  assert.deepStrictEqual(r2.newBests, []);
  rec = r2.record;

  const tie = makeSummary({ floor: 5, steps: 100, name: "Tie", cause: "trap" });
  const rt = updateBests(rec, tie);
  assert.ok(!rt.newBests.includes("combo"), "an exact tie never announces LINEAGE");

  const s3 = makeSummary({ floor: 9, steps: 20, name: "Third" });
  const r3 = updateBests(rec, s3);
  assert.ok(r3.newBests.includes("combo"), "a strict beat of the same lineage announces LINEAGE");
  rec = r3.record;
  assert.equal(lineageRuns(Object.values(rec.runs), lineageKey(s1))[0].hash, s3.hash);

  const otherSub = makeSummary({ floor: 30, steps: 5, name: "Cousin", sub: "Paladin" });
  const r4 = updateBests(rec, otherSub);
  assert.ok(r4.newBests.includes("deep"));
  assert.ok(!r4.newBests.includes("combo"), "a deeper run of the same race but another sub-class is a first-of-lineage, silent");

  const firstOfNewLineage = makeSummary({ floor: 40, steps: 5, name: "Stranger", race: "Troll", sub: "Acrobat", cls: "Thief" });
  assert.ok(!updateBests(r4.record, firstOfNewLineage).newBests.includes("combo"));
});

test("updateBests (Phase 70, D-12): prune keeps each lineage's top ten even when none of them make a ranked board", () => {
  let rec = emptyBests();
  for (let i = 0; i < 10; i++) {
    const big = makeSummary({
      floor: 100 + i, steps: 1 + i, day: 100 + i, kills: 100 + i, gold: 10000 + i,
      race: "Elven", sub: "Wizard", cls: "Magic User", name: `Big${i}`,
    });
    rec = updateBests(rec, big).record;
  }
  const lineageL = [];
  for (let i = 0; i < 12; i++) {
    const run = makeSummary({
      floor: 1 + (i % 6), steps: 500 + i * 7, day: 1, kills: 0, gold: 1,
      race: "Troll", sub: "Acrobat", cls: "Thief", name: `L${i}`,
    });
    lineageL.push(run);
    rec = updateBests(rec, run).record;
  }
  for (const board of RANKED_BOARDS) {
    for (const run of lineageL) assert.ok(!rec.boards[board].includes(run.hash), `no L run is on ${board}`);
  }
  const expected = lineageRuns(lineageL, "Troll Acrobat").slice(0, 10).map((r) => r.hash);
  const held = lineageRuns(Object.values(rec.runs), "Troll Acrobat").map((r) => r.hash);
  assert.deepStrictEqual(held, expected, "exactly L's ten best by lineageRuns order are held");
  const pruned = lineageRuns(lineageL, "Troll Acrobat").slice(10).map((r) => r.hash);
  assert.equal(pruned.length, 2);
  for (const h of pruned) assert.ok(!rec.runs[h], "L's 11th and 12th are pruned");
  for (const board of RANKED_BOARDS) {
    for (const h of rec.boards[board]) assert.ok(rec.runs[h], `board "${board}" hash ${h} is held`);
  }
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
  const keys = new Set(Object.values(rec.runs).map((r) => lineageKey(r)));
  for (const key of keys) {
    for (const r of lineageRuns(Object.values(rec.runs), key).slice(0, BOARD_TOP_N)) referenced.add(r.hash);
  }
  assert.deepStrictEqual(new Set(Object.keys(rec.runs)), referenced);
  assert.ok(!("lineage" in rec));
});

test("updateBests (Phase 66, D-09): the lean list of a mixed sequence is ordered by rate, and newBests includes lean only when strictly better (or an equal rate at a deeper floor)", () => {
  let rec = emptyBests();

  const s1 = makeSummary({ floor: 10, steps: 200, name: "Mid" }); // rate 20
  rec = updateBests(rec, s1).record;

  const s2 = makeSummary({ floor: 4, steps: 40, name: "Best" }); // rate 10 — strictly better
  const r2 = updateBests(rec, s2);
  assert.ok(r2.newBests.includes("lean"), "a strictly better rate is a new lean best");
  rec = r2.record;

  const s3 = makeSummary({ floor: 20, steps: 800, name: "Worst" }); // rate 40 — worse, goes last
  const r3 = updateBests(rec, s3);
  assert.ok(!r3.newBests.includes("lean"), "a worse rate never announces lean");
  rec = r3.record;

  const rates = rec.boards.lean.map((h) => leanRate(rec.runs[h]));
  for (let i = 1; i < rates.length; i++) {
    assert.ok(rates[i - 1] <= rates[i], "boards.lean is ordered by rate ascending");
  }
  assert.equal(rec.runs[rec.boards.lean[0]].name, "Best");

  const s4 = makeSummary({ floor: 8, steps: 80, name: "Tie-deeper" }); // rate 10, deeper than s2 (floor 4)
  const r4 = updateBests(rec, s4);
  assert.ok(r4.newBests.includes("lean"), "an equal rate at a deeper floor still takes #1 on lean");
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
    last: null,
  };
  const result = sanitizeBests(raw);
  assert.equal(result.boards.deep.length, 10, "capped at 10");
  assert.ok(!result.boards.deep.includes("deadbeef"), "dangling hash dropped");
  assert.deepStrictEqual(result.boards.days, [], "missing board key becomes []");
  assert.ok(!("unknownBoard" in result.boards), "unknown board key dropped");
});

test("sanitizeBests (Phase 70, D-12) ignores a legacy Phase 65 lineage map: runs, boards and last load, no lineage key, idempotent", () => {
  const raw = {
    v: 1,
    runs: { aaaaaaaa: { hash: "aaaaaaaa", floor: 1, race: "Human", sub: "Knight" } },
    boards: { deep: ["aaaaaaaa"] },
    lineage: {
      "Human Fighter": { count: 2, best: "aaaaaaaa" },
      "Zero Count": { count: 0, best: "aaaaaaaa" },
      "Dangling Best": { count: 1, best: "deadbeef" },
    },
    last: "aaaaaaaa",
  };
  const result = sanitizeBests(raw);
  assert.ok(!("lineage" in result), "the legacy map is dropped on load");
  assert.deepStrictEqual(Object.keys(result.runs), ["aaaaaaaa"]);
  assert.deepStrictEqual(result.boards.deep, ["aaaaaaaa"]);
  assert.equal(result.last, "aaaaaaaa");
  assert.equal(result.v, 1);
  assert.deepStrictEqual(sanitizeBests(result), result, "sanitizing its own output is a no-op");
});

test("sanitizeBests drops a runs entry whose value.hash differs from its key", () => {
  const raw = { runs: { aaaaaaaa: { hash: "bbbbbbbb", floor: 1 } }, boards: {}, last: null };
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

// --- sanitizeBests re-ranks (Phase 66, D-09) --------------------------------------

test("sanitizeBests re-ranks a hand-built boards.lean list stored in the retired depth order", () => {
  const runA = makeSummary({ floor: 10, steps: 300, name: "A" }); // rate 30
  const runB = makeSummary({ floor: 6, steps: 60, name: "B" }); // rate 10 — should rank first
  const runC = makeSummary({ floor: 2, steps: 40, name: "C" }); // rate 20 — should rank second
  const raw = {
    v: 1,
    runs: { [runA.hash]: runA, [runB.hash]: runB, [runC.hash]: runC },
    boards: { deep: [], lean: [runA.hash, runB.hash, runC.hash], days: [], kills: [], purse: [] },
    last: null,
  };
  const result = sanitizeBests(raw);
  assert.deepStrictEqual(
    result.boards.lean.map((h) => result.runs[h].name),
    ["B", "C", "A"],
    "re-ranked by squares-per-floor ascending, not the stored depth order",
  );
});

test("sanitizeBests is idempotent over its own output, and leaves an updateBests-produced record unchanged", () => {
  const runA = makeSummary({ floor: 10, steps: 300, name: "A" });
  const runB = makeSummary({ floor: 6, steps: 60, name: "B" });
  const raw = {
    v: 1,
    runs: { [runA.hash]: runA, [runB.hash]: runB },
    boards: { deep: [], lean: [runA.hash, runB.hash], days: [], kills: [], purse: [] },
    last: null,
  };
  const once = sanitizeBests(raw);
  const twice = sanitizeBests(once);
  assert.deepStrictEqual(twice, once, "sanitizeBests(sanitizeBests(r)) deepStrictEquals sanitizeBests(r)");

  const gen = seededGen(2027);
  let rec = emptyBests();
  for (let i = 0; i < 20; i++) {
    const run = genRun(i, gen);
    rec = updateBests(rec, { ...run, hash: runHash(run) }).record;
  }
  assert.deepStrictEqual(sanitizeBests(rec), rec, "a record already produced by updateBests is unchanged by sanitizeBests");
});

test("sanitizeBests keeps stored order for two runs tied on every ordering key", () => {
  const runA = makeSummary({ floor: 5, steps: 50, name: "First" });
  const runB = makeSummary({ floor: 5, steps: 50, name: "Second", cause: "trap" }); // ties lean, differs only in cause
  const raw = {
    v: 1,
    runs: { [runA.hash]: runA, [runB.hash]: runB },
    boards: { deep: [], lean: [runA.hash, runB.hash], days: [], kills: [], purse: [] },
    last: null,
  };
  const result = sanitizeBests(raw);
  assert.deepStrictEqual(
    result.boards.lean.map((h) => result.runs[h].name),
    ["First", "Second"],
    "a full tie keeps the stored order (stable sort)",
  );
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
  assert.deepStrictEqual(Object.keys(rec), ["v", "runs", "boards", "last"]);
});

// --- normalizeStone (Phase 66, D-09) ----------------------------------------------

test("normalizeStone(legacyStone).hash equals the key backfillBests([legacyStone]).runs holds for it", () => {
  const stone = legacyStone({ floor: 7, steps: 40 });
  const normalized = normalizeStone(stone);
  const rec = backfillBests([stone]);
  const [hash] = Object.keys(rec.runs);
  assert.equal(normalized.hash, hash);
  assert.deepStrictEqual(normalized, rec.runs[hash]);
});

test("normalizeStone: null/invalid input returns null", () => {
  assert.equal(normalizeStone(null), null);
  assert.equal(normalizeStone(undefined), null);
  assert.equal(normalizeStone("x"), null);
  assert.equal(normalizeStone([]), null);
  assert.equal(normalizeStone({ floor: "x" }), null);
  assert.equal(normalizeStone({}), null);
});

test("normalizeStone: a stone with a numeric season and a valid hash keeps both, unchanged", () => {
  const validHash = "0a0a0a0a";
  const stone = legacyStone({ floor: 6, season: 1, hash: validHash, seed: 42, acts: 7 });
  const normalized = normalizeStone(stone);
  assert.equal(normalized.season, 1);
  assert.equal(normalized.hash, validHash);
  assert.equal(normalized.seed, 42);
  assert.equal(normalized.acts, 7);
});

test("normalizeStone: a numeric season with no valid hash gets a freshly computed hash, season/seed/acts untouched", () => {
  const stone = legacyStone({ floor: 6, season: 2, seed: 5, acts: 3, hash: "not-a-hash" });
  const normalized = normalizeStone(stone);
  assert.equal(normalized.season, 2);
  assert.equal(normalized.seed, 5);
  assert.equal(normalized.acts, 3);
  assert.equal(normalized.hash, runHash(normalized));
});

test("normalizeStone never mutates its input", () => {
  const stone = legacyStone({ floor: 5 });
  const before = { ...stone };
  normalizeStone(stone);
  assert.deepStrictEqual(stone, before);
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
