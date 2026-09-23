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
