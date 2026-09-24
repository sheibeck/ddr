// test/unit/boardScores.test.js
//
// Phase 68 (PGS-03, PGS-06; D-01, D-14, D-15, D-16, D-17): the five submitted
// boards' score encodings, the per-season leaderboard ID map and its lookup.
// Pins the D-16 worked examples, the clamps and rounding, LEANEST's
// equal-rate limit, the minimal-row fallback round-trip, the id rules, and
// the D-15 guard: bumping SEASON without adding that season's IDs fails here.

import test from "node:test";
import assert from "node:assert/strict";

import { SEASON } from "../../content/season.js";
import { LEADERBOARD_IDS, LEADERBOARD_PLACEHOLDER_PREFIX } from "../../content/leaderboards.js";
import { RANKED_BOARDS } from "../../engine/records.js";
import {
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

const FIVE = ["deep", "lean", "days", "kills", "purse"];

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

test("LEADERBOARD_IDS is deep-frozen with season 1's five placeholders", () => {
  assert.ok(isDeepFrozen(LEADERBOARD_IDS));
  assert.equal(LEADERBOARD_PLACEHOLDER_PREFIX, "PLACEHOLDER");
  assert.deepEqual({ ...LEADERBOARD_IDS[1] }, {
    deep: "PLACEHOLDER_DEEPEST_S1",
    lean: "PLACEHOLDER_LEANEST_S1",
    days: "PLACEHOLDER_LONGEST_S1",
    kills: "PLACEHOLDER_BUTCHERY_S1",
    purse: "PLACEHOLDER_PURSE_S1",
  });
});

test("every season entry is keyed by a season number and has exactly the five boards", () => {
  for (const [k, v] of Object.entries(LEADERBOARD_IDS)) {
    assert.match(k, /^[1-9]\d*$/);
    assert.deepEqual(Object.keys(v).sort(), [...FIVE].sort(), `season ${k}`);
    for (const id of Object.values(v)) assert.equal(typeof id, "string");
  }
});

test("D-15 guard: the current SEASON has an entry in LEADERBOARD_IDS", () => {
  assert.ok(LEADERBOARD_IDS[SEASON], `SEASON ${SEASON} has no LEADERBOARD_IDS entry; add its five IDs (docs/PLAY-GAMES-SETUP.md)`);
  assert.ok(knownSeasons().includes(SEASON));
});

// --- boards and order ------------------------------------------------------------

test("SUBMIT_BOARDS is the five ranked boards, frozen, and matches RANKED_BOARDS", () => {
  assert.deepEqual([...SUBMIT_BOARDS], FIVE);
  assert.deepEqual([...SUBMIT_BOARDS], [...RANKED_BOARDS]);
  assert.ok(Object.isFrozen(SUBMIT_BOARDS));
  assert.ok(!SUBMIT_BOARDS.includes("combo"));
  assert.ok(!SUBMIT_BOARDS.includes("yard"));
});

test("SCORE_ORDER uses the plugin's order strings, smaller is better only for lean", () => {
  assert.ok(Object.isFrozen(SCORE_ORDER));
  assert.deepEqual({ ...SCORE_ORDER }, {
    deep: "largerIsBetter",
    lean: "smallerIsBetter",
    days: "largerIsBetter",
    kills: "largerIsBetter",
    purse: "largerIsBetter",
  });
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

test("lean: round(1000 x steps / max(floor, 1)), rounding half up", () => {
  assert.equal(boardScore("lean", { floor: 8, steps: 1 }), 125);
  assert.equal(boardScore("lean", { floor: 16, steps: 1 }), 63);
  assert.equal(boardScore("lean", { floor: 3, steps: 1 }), 333);
  assert.equal(boardScore("lean", { floor: 0, steps: 7 }), 7000);
  assert.equal(boardScore("lean", { floor: 1, steps: 7 }), 7000);
});

test("lean: equal squares-per-floor rates at different depths score the same (the single-score limit)", () => {
  assert.equal(boardScore("lean", { floor: 2, steps: 10 }), boardScore("lean", { floor: 4, steps: 20 }));
});

test("days, kills and purse encodings", () => {
  assert.equal(boardScore("days", { day: 22, floor: 7 }), 22007);
  assert.equal(boardScore("days", { day: 22, floor: 1000 }), 22999);
  assert.equal(boardScore("kills", { kills: 19, floor: 7 }), 19007);
  assert.equal(boardScore("kills", { kills: 19, floor: 5000 }), 19999);
  assert.equal(boardScore("purse", { gold: 4688 }), 4688);
});

test("combo, yard and unknown boards return null", () => {
  const s = { floor: 7, steps: 431, day: 22, kills: 19, gold: 4688 };
  for (const b of ["combo", "yard", "nope", "", undefined, null]) assert.equal(boardScore(b, s), null, String(b));
});

test("missing fields count as 0 and odd inputs are truncated or zeroed", () => {
  for (const b of FIVE) assert.equal(boardScore(b, {}), 0, b);
  for (const b of FIVE) assert.equal(boardScore(b, null), 0, b);
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
    for (const b of FIVE) {
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

test("boardScores is a frozen object over the five boards in order", () => {
  const all = boardScores({ floor: 7, steps: 431, day: 22, kills: 19, gold: 4688 });
  assert.ok(Object.isFrozen(all));
  assert.deepEqual(Object.keys(all), FIVE);
  assert.deepEqual({ ...all }, { deep: 6999569, lean: 61571, days: 22007, kills: 19007, purse: 4688 });
  const empty = boardScores({});
  for (const b of FIVE) assert.ok(Number.isSafeInteger(empty[b]) && empty[b] >= 0);
});

// --- scoreFallback -----------------------------------------------------------------

test("scoreFallback recovers the displayed fields from a raw score", () => {
  assert.deepEqual({ ...scoreFallback("deep", 6999569) }, { floor: 7, steps: 431 });
  assert.deepEqual({ ...scoreFallback("days", 22007) }, { day: 22, floor: 7 });
  assert.deepEqual({ ...scoreFallback("kills", 19007) }, { kills: 19, floor: 7 });
  assert.deepEqual({ ...scoreFallback("purse", 4688) }, { gold: 4688 });
  assert.deepEqual({ ...scoreFallback("lean", 125) }, { rate: 0.125 });
  assert.ok(Object.isFrozen(scoreFallback("deep", 6999569)));
});

test("scoreFallback rejects bad raw scores and unsubmitted boards", () => {
  for (const raw of [-1, 1.5, NaN, Infinity, "42", null, undefined, 2 ** 60]) {
    assert.equal(scoreFallback("deep", raw), null, String(raw));
  }
  assert.equal(scoreFallback("combo", 7), null);
  assert.equal(scoreFallback("yard", 7), null);
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
  assert.equal(leaderboardId(LEADERBOARD_IDS, 1, "deep"), null);
  for (const b of FIVE) assert.equal(leaderboardId(LEADERBOARD_IDS, SEASON, b), null);
  const live = { 1: { deep: "CgkI4a-Rz8YUEAIQAQ", lean: "PLACEHOLDER_LEANEST_S1", days: "", kills: "x y", purse: 7 } };
  assert.equal(leaderboardId(live, 1, "deep"), "CgkI4a-Rz8YUEAIQAQ");
  assert.equal(leaderboardId(live, 1, "lean"), null);
  assert.equal(leaderboardId(live, 1, "days"), null);
  assert.equal(leaderboardId(live, 1, "kills"), null);
  assert.equal(leaderboardId(live, 1, "purse"), null);
});

test("leaderboardId returns null for a missing season, LINEAGE/GRAVEYARD, or a non-object map", () => {
  const live = { 1: { deep: "CgkI4a-Rz8YUEAIQAQ", combo: "CgkIcombo", yard: "CgkIyard" } };
  assert.equal(leaderboardId(live, 2, "deep"), null);
  assert.equal(leaderboardId(live, 1, "combo"), null);
  assert.equal(leaderboardId(live, 1, "yard"), null);
  for (const m of [null, undefined, 42, "x"]) assert.equal(leaderboardId(m, 1, "deep"), null);
  assert.equal(leaderboardId({ 1: "not an object" }, 1, "deep"), null);
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
    1: { deep: "dev_deep_s1", lean: "dev_lean_s1", days: "dev_days_s1", kills: "dev_kills_s1", purse: "dev_purse_s1" },
  });
  const two = devLeaderboardIds({ 1: {}, 2: {} });
  assert.equal(two[2].lean, "dev_lean_s2");
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
    dev_lean_s1: "smallerIsBetter",
    dev_days_s1: "largerIsBetter",
    dev_kills_s1: "largerIsBetter",
    dev_purse_s1: "largerIsBetter",
  });
  assert.deepEqual({ ...scoreOrdersFor(LEADERBOARD_IDS) }, {});
  assert.deepEqual({ ...scoreOrdersFor(null) }, {});
});
