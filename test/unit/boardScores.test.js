// test/unit/boardScores.test.js
//
// Phase 68 (PGS-03, PGS-06; D-01, D-14, D-15, D-16, D-17): the submitted
// boards' score encodings, the per-season leaderboard ID map and its lookup.
// Pins the D-16 worked examples, the clamps and rounding, the minimal-row
// fallback round-trip, the id rules, and the D-15 guard: bumping SEASON
// without adding that season's IDs fails here.
//
// Phase 81 (BOARD-17): LEANEST is retired. RETIRED_BOARDS holds its id; every
// four-board expectation below reflects the removal, plus a concurrency
// check that no SUBMIT_BOARDS id maps through leaderboardId to the retired
// Season-1 console id.

import test from "node:test";
import assert from "node:assert/strict";

import { SEASON } from "../../content/season.js";
import { LEADERBOARD_IDS, LEADERBOARD_PLACEHOLDER_PREFIX } from "../../content/leaderboards.js";
import { RANKED_BOARDS } from "../../engine/records.js";
import {
  RETIRED_BOARDS,
  SUBMIT_BOARDS,
  SCORE_ORDER,
  SCORE_INPUT_CAP,
  boardScore,
  boardScores,
  scoreFallback,
  isRealLeaderboardId,
  leaderboardId,
  knownSeasons,
  devLeaderboardIds,
  leaderboardIdsFor,
  scoreOrdersFor,
} from "../../src/browser/boardScores.js";

const FOUR = ["deep", "days", "kills", "purse"];
/** The Season-1 console id for the retired LEANEST board. Never referenced
 * outside this test file — code comments must not repeat it either
 * (src/browser/boardScores.js's header). */
const RETIRED_SEASON_1_ID = "CgkIlvbN0YYPEAIQAw";

function isDeepFrozen(v) {
  if (v === null || typeof v !== "object") return true;
  if (!Object.isFrozen(v)) return false;
  return Object.values(v).every(isDeepFrozen);
}

/** A small deterministic generator (LCG) so the round-trip sample is fixed. */
function makeRng(seed) {
  let s = seed >>> 0;
  return (max) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

// --- content/leaderboards.js ----------------------------------------------------

test("LEADERBOARD_IDS is deep-frozen with season 1's four live Play Console IDs (LEANEST retired, BOARD-17)", () => {
  assert.ok(isDeepFrozen(LEADERBOARD_IDS));
  assert.equal(LEADERBOARD_PLACEHOLDER_PREFIX, "PLACEHOLDER");
  assert.deepEqual({ ...LEADERBOARD_IDS[1] }, {
    deep: "CgkIlvbN0YYPEAIQAg",
    days: "CgkIlvbN0YYPEAIQBA",
    kills: "CgkIlvbN0YYPEAIQBQ",
    purse: "CgkIlvbN0YYPEAIQBg",
  });
  assert.deepEqual(Object.keys(LEADERBOARD_IDS[1]), FOUR, "four IDs");
  for (const id of Object.values(LEADERBOARD_IDS[1])) assert.ok(!id.startsWith(LEADERBOARD_PLACEHOLDER_PREFIX), "season 1 has no placeholder left");
});

test("every season entry is keyed by a season number and has exactly the four boards", () => {
  for (const [k, v] of Object.entries(LEADERBOARD_IDS)) {
    assert.match(k, /^[1-9]\d*$/);
    assert.deepEqual(Object.keys(v).sort(), [...FOUR].sort(), `season ${k}`);
    for (const id of Object.values(v)) assert.equal(typeof id, "string");
  }
});

test("D-15 guard: the current SEASON has an entry in LEADERBOARD_IDS", () => {
  assert.ok(LEADERBOARD_IDS[SEASON], `SEASON ${SEASON} has no LEADERBOARD_IDS entry; add its five IDs (docs/PLAY-GAMES-SETUP.md)`);
  assert.ok(knownSeasons().includes(SEASON));
});

// --- boards and order ------------------------------------------------------------

test("SUBMIT_BOARDS is the four ranked boards, frozen, and equals RANKED_BOARDS minus RETIRED_BOARDS", () => {
  assert.deepEqual([...SUBMIT_BOARDS], FOUR);
  assert.deepEqual([...SUBMIT_BOARDS], RANKED_BOARDS.filter((b) => !RETIRED_BOARDS.includes(b)));
  assert.ok(Object.isFrozen(SUBMIT_BOARDS));
  assert.ok(!SUBMIT_BOARDS.includes("combo"));
  assert.ok(!SUBMIT_BOARDS.includes("yard"));
  assert.ok(!SUBMIT_BOARDS.includes("lean"));
});

test("RETIRED_BOARDS holds exactly the one retired id and is frozen (BOARD-17)", () => {
  assert.ok(Object.isFrozen(RETIRED_BOARDS));
  assert.deepEqual([...RETIRED_BOARDS], ["lean"]);
  assert.equal(RETIRED_BOARDS.length, 1);
});

test("SCORE_ORDER uses the plugin's order strings over the four submitted boards", () => {
  assert.ok(Object.isFrozen(SCORE_ORDER));
  assert.deepEqual({ ...SCORE_ORDER }, {
    deep: "largerIsBetter",
    days: "largerIsBetter",
    kills: "largerIsBetter",
    purse: "largerIsBetter",
  });
  assert.equal(Object.keys(SCORE_ORDER).length, 4);
  assert.ok(!("lean" in SCORE_ORDER));
});

// --- boardScore --------------------------------------------------------------------

test("deep: floor x 1,000,000 - steps, steps clamped, never negative", () => {
  assert.equal(boardScore("deep", { floor: 7, steps: 431 }), 6999569);
  assert.equal(boardScore("deep", { floor: 7, steps: 999999 }), 7 * 1e6 - 999999);
  assert.equal(boardScore("deep", { floor: 7, steps: 1000000 }), 7 * 1e6 - 999999);
  assert.equal(boardScore("deep", { floor: 0, steps: 5 }), 0);
  assert.equal(boardScore("deep", { floor: 7, steps: -3 }), 7000000);
});

test("deep ties on floor are broken by fewer steps", () => {
  assert.ok(boardScore("deep", { floor: 7, steps: 100 }) > boardScore("deep", { floor: 7, steps: 101 }));
  assert.ok(boardScore("deep", { floor: 8, steps: 999999 }) > boardScore("deep", { floor: 7, steps: 0 }));
});

test("boardScore and scoreFallback return null for the retired LEANEST id (BOARD-17)", () => {
  assert.equal(boardScore("lean", { floor: 8, steps: 1 }), null);
  assert.equal(scoreFallback("lean", 125), null);
});

test("days, kills and purse encodings", () => {
  assert.equal(boardScore("days", { day: 22, floor: 7 }), 22007);
  assert.equal(boardScore("days", { day: 22, floor: 1000 }), 22999);
  assert.equal(boardScore("kills", { kills: 19, floor: 7 }), 19007);
  assert.equal(boardScore("kills", { kills: 19, floor: 5000 }), 19999);
  assert.equal(boardScore("purse", { gold: 4688 }), 4688);
});

test("combo, yard, the retired id and unknown boards return null", () => {
  const s = { floor: 7, steps: 431, day: 22, kills: 19, gold: 4688 };
  for (const b of ["combo", "yard", "lean", "nope", "", undefined, null]) assert.equal(boardScore(b, s), null, String(b));
});

test("missing fields count as 0 and odd inputs are truncated or zeroed", () => {
  for (const b of FOUR) assert.equal(boardScore(b, {}), 0, b);
  for (const b of FOUR) assert.equal(boardScore(b, null), 0, b);
  assert.equal(boardScore("purse", { gold: 7.9 }), 7);
  assert.equal(boardScore("purse", { gold: NaN }), 0);
  assert.equal(boardScore("purse", { gold: Infinity }), 0);
  assert.equal(boardScore("purse", { gold: -5 }), 0);
  assert.equal(boardScore("purse", { gold: "4688" }), 0);
});

test("every score at the input cap and beyond is a non-negative safe integer", () => {
  assert.equal(SCORE_INPUT_CAP, 999999999);
  for (const v of [999999999, 1e15, 1e300]) {
    const s = { floor: v, steps: v, day: v, kills: v, gold: v };
    for (const b of FOUR) {
      const score = boardScore(b, s);
      assert.ok(Number.isSafeInteger(score) && score >= 0, `${b} @ ${v}: ${score}`);
    }
  }
  assert.equal(boardScore("purse", { gold: 1e15 }), 999999999);
});

test("identical board fields encode identical scores", () => {
  const a = { floor: 7, steps: 431, day: 22, kills: 19, gold: 4688, name: "A" };
  const b = { floor: 7, steps: 431, day: 22, kills: 19, gold: 4688, name: "B" };
  assert.deepEqual({ ...boardScores(a) }, { ...boardScores(b) });
});

test("boardScores is a frozen object over the four boards in order", () => {
  const all = boardScores({ floor: 7, steps: 431, day: 22, kills: 19, gold: 4688 });
  assert.ok(Object.isFrozen(all));
  assert.deepEqual(Object.keys(all), FOUR);
  assert.deepEqual({ ...all }, { deep: 6999569, days: 22007, kills: 19007, purse: 4688 });
  const empty = boardScores({});
  for (const b of FOUR) assert.ok(Number.isSafeInteger(empty[b]) && empty[b] >= 0);
});

// --- scoreFallback -----------------------------------------------------------------

test("scoreFallback recovers the displayed fields from a raw score", () => {
  assert.deepEqual({ ...scoreFallback("deep", 6999569) }, { floor: 7, steps: 431 });
  assert.deepEqual({ ...scoreFallback("days", 22007) }, { day: 22, floor: 7 });
  assert.deepEqual({ ...scoreFallback("kills", 19007) }, { kills: 19, floor: 7 });
  assert.deepEqual({ ...scoreFallback("purse", 4688) }, { gold: 4688 });
  assert.ok(Object.isFrozen(scoreFallback("deep", 6999569)));
});

test("scoreFallback rejects bad raw scores and unsubmitted boards", () => {
  for (const raw of [-1, 1.5, NaN, Infinity, "42", null, undefined, 2 ** 60]) {
    assert.equal(scoreFallback("deep", raw), null, String(raw));
  }
  assert.equal(scoreFallback("combo", 7), null);
  assert.equal(scoreFallback("yard", 7), null);
  assert.equal(scoreFallback("lean", 7), null);
  assert.equal(scoreFallback("nope", 7), null);
});

test("scoreFallback(board, boardScore(board, s)) recovers the clamped fields for 50 generated runs", () => {
  const rand = makeRng(68);
  for (let i = 0; i < 50; i++) {
    const s = {
      floor: 1 + rand(1500),
      steps: rand(1200000),
      day: rand(5000),
      kills: rand(5000),
      gold: rand(2000000),
    };
    const d = scoreFallback("deep", boardScore("deep", s));
    assert.deepEqual({ ...d }, { floor: s.floor, steps: Math.min(s.steps, 999999) });
    const dy = scoreFallback("days", boardScore("days", s));
    assert.deepEqual({ ...dy }, { day: s.day, floor: Math.min(s.floor, 999) });
    const k = scoreFallback("kills", boardScore("kills", s));
    assert.deepEqual({ ...k }, { kills: s.kills, floor: Math.min(s.floor, 999) });
    const p = scoreFallback("purse", boardScore("purse", s));
    assert.deepEqual({ ...p }, { gold: s.gold });
  }
});

// --- id lookup ----------------------------------------------------------------------

test("isRealLeaderboardId accepts console and dev ids, rejects placeholders and junk", () => {
  assert.equal(isRealLeaderboardId("CgkI4a-Rz8YUEAIQAQ"), true);
  assert.equal(isRealLeaderboardId("dev_deep_s1"), true);
  for (const bad of ["", "PLACEHOLDER_DEEPEST_S1", "has space", 42, null, undefined, "a".repeat(129), "bad/slash"]) {
    assert.equal(isRealLeaderboardId(bad), false, String(bad));
  }
  assert.equal(isRealLeaderboardId("a".repeat(128)), true);
});

test("leaderboardId returns null for placeholders and returns a real id when present", () => {
  // Season 1's shipped IDs are live (2026-09-24): every board resolves to its own ID.
  for (const b of FOUR) assert.equal(leaderboardId(LEADERBOARD_IDS, SEASON, b), LEADERBOARD_IDS[SEASON][b]);
  const placeholders = { 1: { deep: "PLACEHOLDER_DEEPEST_S1", days: "PLACEHOLDER_LONGEST_S1", kills: "PLACEHOLDER_BUTCHERY_S1", purse: "PLACEHOLDER_PURSE_S1" } };
  for (const b of FOUR) assert.equal(leaderboardId(placeholders, 1, b), null);
  const live = { 1: { deep: "CgkI4a-Rz8YUEAIQAQ", days: "", kills: "x y", purse: 7 } };
  assert.equal(leaderboardId(live, 1, "deep"), "CgkI4a-Rz8YUEAIQAQ");
  assert.equal(leaderboardId(live, 1, "days"), null);
  assert.equal(leaderboardId(live, 1, "kills"), null);
  assert.equal(leaderboardId(live, 1, "purse"), null);
});

test("leaderboardId returns null for the retired LEANEST id, a missing season, LINEAGE/GRAVEYARD, or a non-object map", () => {
  const live = { 1: { deep: "CgkI4a-Rz8YUEAIQAQ", lean: "CgkIlvbN0YYPEAIQAw", combo: "CgkIcombo", yard: "CgkIyard" } };
  assert.equal(leaderboardId(live, 2, "deep"), null);
  assert.equal(leaderboardId(live, 1, "lean"), null, "BOARD-17: never resolves to the retired id");
  assert.equal(leaderboardId(live, 1, "combo"), null);
  assert.equal(leaderboardId(live, 1, "yard"), null);
  for (const m of [null, undefined, 42, "x"]) assert.equal(leaderboardId(m, 1, "deep"), null);
  assert.equal(leaderboardId({ 1: "not an object" }, 1, "deep"), null);
});

test("BOARD-17 concurrency: no SUBMIT_BOARDS id maps through leaderboardId to the retired Season-1 console id", () => {
  for (const b of SUBMIT_BOARDS) {
    assert.notEqual(leaderboardId(LEADERBOARD_IDS, SEASON, b), RETIRED_SEASON_1_ID, b);
  }
  assert.equal(leaderboardId(LEADERBOARD_IDS, SEASON, "lean"), null);
});

test("knownSeasons lists the numbered season entries ascending", () => {
  assert.deepEqual(knownSeasons(), [1]);
  assert.deepEqual(knownSeasons({ 2: { deep: "a" }, 1: { deep: "b" }, x: 3 }), [1, 2]);
  assert.deepEqual(knownSeasons({ 0: {}, 3: null, 4: "x", 10: {}, 9: {} }), [9, 10]);
  assert.deepEqual(knownSeasons(null), []);
});

test("devLeaderboardIds builds dev ids for every known season", () => {
  const dev = devLeaderboardIds();
  assert.ok(isDeepFrozen(dev));
  assert.deepEqual(JSON.parse(JSON.stringify(dev)), {
    1: { deep: "dev_deep_s1", days: "dev_days_s1", kills: "dev_kills_s1", purse: "dev_purse_s1" },
  });
  const two = devLeaderboardIds({ 1: {}, 2: {} });
  assert.equal(two[2].deep, "dev_deep_s2");
  assert.ok(!("lean" in two[2]));
});

test("leaderboardIdsFor picks the console map natively and the dev map in the browser", () => {
  assert.equal(leaderboardIdsFor({ native: true }), LEADERBOARD_IDS);
  assert.deepEqual(leaderboardIdsFor({ native: false }), devLeaderboardIds());
  assert.deepEqual(leaderboardIdsFor(), devLeaderboardIds());
  assert.equal(leaderboardId(leaderboardIdsFor({ native: false }), 1, "deep"), "dev_deep_s1");
});

test("scoreOrdersFor maps every real id to its order and skips placeholders", () => {
  const orders = scoreOrdersFor(devLeaderboardIds());
  assert.ok(Object.isFrozen(orders));
  assert.deepEqual({ ...orders }, {
    dev_deep_s1: "largerIsBetter",
    dev_days_s1: "largerIsBetter",
    dev_kills_s1: "largerIsBetter",
    dev_purse_s1: "largerIsBetter",
  });
  assert.deepEqual({ ...scoreOrdersFor(LEADERBOARD_IDS) }, {
    CgkIlvbN0YYPEAIQAg: "largerIsBetter",
    CgkIlvbN0YYPEAIQBA: "largerIsBetter",
    CgkIlvbN0YYPEAIQBQ: "largerIsBetter",
    CgkIlvbN0YYPEAIQBg: "largerIsBetter",
  });
  assert.deepEqual({ ...scoreOrdersFor({ 1: { deep: "PLACEHOLDER_DEEPEST_S1" } }) }, {});
  assert.deepEqual({ ...scoreOrdersFor(null) }, {});
});
