// test/unit/tail-score.test.js
//
// Phase 75.3 (75.3-02-PLAN.md Task 2, RULES-17/RULES-18) — direct,
// engine-free unit coverage for tools/lib/tail-score.mjs: TAIL_SLICES,
// TAIL_TARGETS, summarizeSlice, scoreTail, TAIL_SEARCH_PLAN, tailEvalRow and
// formatTailEvalLine. Every synthetic row/summary below is hand-built to
// exercise one arithmetic path at a time (this file never imports the engine
// or the bot, exactly as tail-score.mjs itself does not).

import test from "node:test";
import assert from "node:assert/strict";

import {
  TAIL_SLICES,
  TAIL_TARGETS,
  summarizeSlice,
  scoreTail,
  TAIL_SEARCH_PLAN,
  tailEvalRow,
  formatTailEvalLine,
} from "../../tools/lib/tail-score.mjs";

// --- TAIL_SLICES / TAIL_TARGETS / TAIL_SEARCH_PLAN -------------------------

test("TAIL_SLICES names every slice this plan's truths require, each with the right shape", () => {
  const byId = Object.fromEntries(TAIL_SLICES.map((s) => [s.id, s]));
  assert.equal(TAIL_SLICES.length, 9);
  assert.deepStrictEqual(byId.fresh, { id: "fresh", startDepth: 1, seeds: 1000, stage: "fresh" });
  assert.deepStrictEqual(byId.deep12, { id: "deep12", startDepth: 12, seeds: 200 });
  assert.deepStrictEqual(byId.deep20, { id: "deep20", startDepth: 20, seeds: 200 });
  assert.deepStrictEqual(byId.deep30, { id: "deep30", startDepth: 30, seeds: 200 });
  assert.deepStrictEqual(byId.deep40, { id: "deep40", startDepth: 40, seeds: 200 });
  for (const [rotId, pair] of [["rot20", "deep20"], ["rot30", "deep30"], ["rot40", "deep40"]]) {
    const rot = byId[rotId];
    assert.equal(rot.seeds, 40);
    assert.equal(rot.controlRotation, true);
    assert.equal(rot.pairedWith, pair);
    assert.deepStrictEqual(rot.force, { cls: "Magic User", sub: "Sorcerer", race: "Human" });
  }
  assert.equal(byId.troll20.reportOnly, true);
  assert.deepStrictEqual(byId.troll20.force, { cls: "Magic User", sub: "Summoner", race: "Troll" });
});

test("TAIL_TARGETS carries the user's ruled numbers verbatim (75.3-CONTEXT.md, 2026-09-25)", () => {
  assert.deepStrictEqual(TAIL_TARGETS.fresh, { reach20Max: 1.0, reach21Below: 0.5, reachCount30Max: 1 });
  assert.deepStrictEqual(TAIL_TARGETS.deep12, { reach20Max: 5 });
  assert.deepStrictEqual(TAIL_TARGETS.deep20, { p50GainedMax: 2, reach30Max: 1 });
  assert.deepStrictEqual(TAIL_TARGETS.deep30, { p50GainedMax: 0, p90GainedMax: 1 });
  assert.deepStrictEqual(TAIL_TARGETS.rotation, { p50Slack: 0, p90Slack: 0 });
  assert.deepStrictEqual(TAIL_TARGETS.guard, { freshP50Death: [5, 7] });
});

test("TAIL_SEARCH_PLAN is exactly the four coordinates, in order, with pinned steps/bounds", () => {
  const expected = [
    ["FOE_HP_SCALE.perDepthAfter", 0.015, 0.015, 0.15],
    ["FOE_HIT_SCALE.perDepthAfter", 0.01, 0.01, 0.08],
    ["FOE_ELITE.hpPerRank", 0.05, 0.05, 0.4],
    ["CONTROL_AT_DEPTH.resistPerDepth", 0.25, 0.5, 2],
  ];
  assert.equal(TAIL_SEARCH_PLAN.length, 4);
  TAIL_SEARCH_PLAN.forEach((coord, i) => {
    const [path, step, lo, hi] = expected[i];
    assert.equal(coord.path.join("."), path, `coordinate ${i}`);
    assert.equal(coord.step, step);
    assert.equal(coord.lo, lo);
    assert.equal(coord.hi, hi);
  });
});

// --- summarizeSlice ---------------------------------------------------------

function row(deathDepth, floorsGained, stuck = false) {
  return { deathDepth, floorsGained, stuck };
}

test("summarizeSlice: n/stuck/reach% over ALL rows, p50/p90/mean/p50Death over non-stuck rows only", () => {
  const rows = [
    row(20, 0), // startDepth 20, gained 0
    row(21, 1),
    row(22, 2),
    row(30, 10, true), // stuck at floor 30 — still counts toward reach30, excluded from gained/death stats
  ];
  const s = summarizeSlice(rows);
  assert.equal(s.n, 4);
  assert.equal(s.stuck, 1);
  // non-stuck gained: [0, 1, 2] -> median 1
  assert.equal(s.p50Gained, 1);
  assert.equal(s.p90Gained, 2); // nearest-rank p90 of [0,1,2], n=3 -> idx floor(0.9*3)=2 -> value 2
  assert.equal(s.meanGained, 1);
  // non-stuck deaths: [20,21,22] -> median 21
  assert.equal(s.p50Death, 21);
  // reach% over ALL 4 rows
  assert.equal(s.reach20, 100); // all 4 >= 20
  assert.equal(s.reach21, 75); // 21, 22 and the stuck row's 30 are >= 21, of 4 rows
  assert.equal(s.reach30, 25); // only the stuck row reaches 30
  assert.equal(s.reachCount30, 1);
});

test("summarizeSlice: an empty or missing rows array returns null, never throws", () => {
  assert.equal(summarizeSlice([]), null);
  assert.equal(summarizeSlice(undefined), null);
  assert.equal(summarizeSlice(null), null);
});

// --- scoreTail --------------------------------------------------------------

/** A synthetic all-pass slice set matching every ruled target exactly or with room to spare. */
function allPassSummaries() {
  return {
    fresh: { n: 1000, stuck: 0, p50Gained: 4, p90Gained: 8, meanGained: 4, p50Death: 6, reach20: 0.8, reach21: 0.3, reach30: 0.1, reachCount30: 1 },
    deep12: { n: 200, stuck: 0, p50Gained: 8, p90Gained: 14, meanGained: 8, p50Death: 20, reach20: 4, reach21: 2, reach30: 0.5, reachCount30: 1 },
    deep20: { n: 200, stuck: 0, p50Gained: 2, p90Gained: 4, meanGained: 2, p50Death: 22, reach20: 100, reach21: 60, reach30: 0.5, reachCount30: 1 },
    deep30: { n: 200, stuck: 0, p50Gained: 0, p90Gained: 1, meanGained: 0.2, p50Death: 30, reach20: 100, reach21: 100, reach30: 100, reachCount30: 200 },
    deep40: { n: 200, stuck: 0, p50Gained: 0, p90Gained: 0, meanGained: 0, p50Death: 40, reach20: 100, reach21: 100, reach30: 100, reachCount30: 200 },
    rot20: { n: 40, stuck: 0, p50Gained: 2, p90Gained: 4, meanGained: 2, p50Death: 22, reach20: 100, reach21: 60, reach30: 0.5, reachCount30: 0 },
    rot30: { n: 40, stuck: 0, p50Gained: 0, p90Gained: 1, meanGained: 0.2, p50Death: 30, reach20: 100, reach21: 100, reach30: 100, reachCount30: 40 },
    rot40: { n: 40, stuck: 0, p50Gained: 0, p90Gained: 0, meanGained: 0, p50Death: 40, reach20: 100, reach21: 100, reach30: 100, reachCount30: 40 },
    troll20: { n: 40, stuck: 0, p50Gained: 3, p90Gained: 6, meanGained: 3, p50Death: 23, reach20: 100, reach21: 70, reach30: 1, reachCount30: 0 },
  };
}

test("scoreTail: a synthetic all-pass set (every rotation slice at or under its pair) scores 0, PASSes, constraints.ok true", () => {
  const result = scoreTail(allPassSummaries());
  assert.equal(result.score, 0);
  assert.equal(result.verdict, "PASS");
  assert.deepStrictEqual(result.misses, []);
  assert.equal(result.freshMeasured, true);
  assert.equal(result.guard, null); // p50Death 6 is inside [5,7]
  assert.equal(result.constraints.ok, true);
});

test("scoreTail boundaries: exact-equal Max-style targets PASS, exact-equal Below-style targets MISS", () => {
  const s = allPassSummaries();
  s.fresh.reach20 = 1.0; // exactly reach20Max -> passes
  s.deep12.reach20 = 5; // exactly reach20Max -> passes
  s.deep20.p50Gained = 2; // exactly p50GainedMax -> passes
  s.deep30.p90Gained = 1; // exactly p90GainedMax -> passes
  s.fresh.reachCount30 = 1; // exactly reachCount30Max -> passes
  let result = scoreTail(s);
  assert.equal(result.verdict, "PASS", result.misses.join(" | "));

  s.fresh.reach21 = 0.5; // exactly reach21Below -> a MISS (strictly under required)
  result = scoreTail(s);
  assert.equal(result.verdict, "MISS");
  assert.ok(result.misses.some((m) => m.startsWith("fresh.reach21")), result.misses.join(" | "));

  s.fresh.reach21 = 0.3; // restore
  s.fresh.reachCount30 = 2; // reachCount30 of 2 is a miss
  result = scoreTail(s);
  assert.equal(result.verdict, "MISS");
  assert.ok(result.misses.some((m) => m.startsWith("fresh.reachCount30")), result.misses.join(" | "));
});

test("scoreTail: a missed target adds a positive term that grows with the size of the miss", () => {
  const small = allPassSummaries();
  small.deep20.p50Gained = 3; // 1 over the max of 2
  const big = allPassSummaries();
  big.deep20.p50Gained = 10; // 8 over the max of 2
  const smallResult = scoreTail(small);
  const bigResult = scoreTail(big);
  assert.ok(smallResult.score > 0);
  assert.ok(bigResult.score > smallResult.score, `${bigResult.score} should exceed ${smallResult.score}`);
});

test("scoreTail: lexicographic — ANY slice miss outscores every fresh-only miss, however small the slice delta or bad the fresh terms", () => {
  const worstFreshOnly = allPassSummaries();
  worstFreshOnly.fresh.reach20 = 100; // wildly missed fresh term
  worstFreshOnly.fresh.reach21 = 100;
  worstFreshOnly.fresh.reachCount30 = 1000;

  const tinySliceMiss = allPassSummaries();
  tinySliceMiss.deep30.p90Gained = 1.01; // barely over its max of 1

  const worstFreshResult = scoreTail(worstFreshOnly);
  const tinySliceResult = scoreTail(tinySliceMiss);
  assert.equal(worstFreshResult.verdict, "MISS");
  assert.equal(tinySliceResult.verdict, "MISS");
  assert.ok(
    tinySliceResult.score > worstFreshResult.score,
    `a slice miss (${tinySliceResult.score}) must outscore even the worst fresh-only miss (${worstFreshResult.score})`,
  );
});

test("scoreTail: a candidate meeting every slice target but with no fresh summary is verdict MISS with the miss 'fresh unmeasured'", () => {
  const s = allPassSummaries();
  delete s.fresh;
  const result = scoreTail(s);
  assert.equal(result.verdict, "MISS");
  assert.equal(result.freshMeasured, false);
  assert.ok(result.misses.includes("fresh unmeasured"));
});

test("scoreTail: the rotation constraint rejects rot20 p50 above deep20's, or rot30 p90 above deep30's — REJECTED scoring is tailEvalRow's job, not scoreTail's own verdict", () => {
  const rot20Bad = allPassSummaries();
  rot20Bad.rot20.p50Gained = rot20Bad.deep20.p50Gained + 1;
  const r1 = scoreTail(rot20Bad);
  assert.equal(r1.constraints.ok, false);
  assert.ok(r1.constraints.reasons.some((r) => r.startsWith("rot20")));

  const rot30Bad = allPassSummaries();
  rot30Bad.rot30.p90Gained = rot30Bad.deep30.p90Gained + 1;
  const r2 = scoreTail(rot30Bad);
  assert.equal(r2.constraints.ok, false);
  assert.ok(r2.constraints.reasons.some((r) => r.startsWith("rot30")));
});

test("scoreTail: a fresh p50Death outside [5, 7] sets a guard note but never changes score or verdict", () => {
  const passing = allPassSummaries();
  const baseline = scoreTail(passing);
  const outside = allPassSummaries();
  outside.fresh.p50Death = 3;
  const result = scoreTail(outside);
  assert.equal(result.score, baseline.score);
  assert.equal(result.verdict, baseline.verdict);
  assert.ok(result.guard && result.guard.includes("3"));
});

test("scoreTail: troll20 and deep40 never affect score or verdict (deep40 is only rot40's pair)", () => {
  const s = allPassSummaries();
  s.troll20.p50Gained = 999;
  s.deep40.p50Gained = 999;
  const result = scoreTail(s);
  assert.equal(result.score, 0);
  assert.equal(result.verdict, "PASS");
});

test("scoreTail: a missing slice summary scores as a miss, never throws", () => {
  const s = allPassSummaries();
  delete s.deep12;
  const result = scoreTail(s);
  assert.equal(result.verdict, "MISS");
  assert.ok(result.misses.includes("deep12 unmeasured"));
});

// --- tailEvalRow / formatTailEvalLine ---------------------------------------

test("tailEvalRow: a passing candidate carries the JSONL shape and a formattable line", () => {
  const row = tailEvalRow(1, { FOE_HP_SCALE: { perDepthAfter: 0.05 } }, { summaries: allPassSummaries(), elapsedMs: 1234 });
  assert.equal(row.n, 1);
  assert.equal(row.pass, 1);
  assert.equal(row.score, 0);
  assert.equal(row.verdict, "PASS");
  assert.equal(row.freshMeasured, true);
  assert.equal(row.constraints.ok, true);
  assert.equal(row.elapsedMs, 1234);
  assert.equal("reason" in row, false);

  const line = formatTailEvalLine(row);
  assert.ok(line.startsWith(`#${row.n} score=`));
  assert.match(line, /verdict=PASS/);
  assert.match(line, /ok=true/);
});

test("tailEvalRow: the REJECTED rule — a rotation-constraint failure scores Infinity, verdict MISS, with a reason", () => {
  const summaries = allPassSummaries();
  summaries.rot20.p50Gained = summaries.deep20.p50Gained + 5;
  const row = tailEvalRow(2, {}, { summaries, elapsedMs: 500 });
  assert.equal(row.score, Infinity);
  assert.equal(row.verdict, "MISS");
  assert.ok(row.reason && row.reason.includes("rot20"));

  const line = formatTailEvalLine(row);
  assert.ok(line.startsWith(`#${row.n} score=+Infinity`));
  assert.match(line, /reason=/);
});

test("formatTailEvalLine: reports 'unmeasured' for a missing fresh summary", () => {
  const summaries = allPassSummaries();
  delete summaries.fresh;
  const row = tailEvalRow(3, {}, { summaries, elapsedMs: 10 });
  const line = formatTailEvalLine(row);
  assert.match(line, /fresh\[unmeasured\]/);
});
