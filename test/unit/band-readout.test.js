// test/unit/band-readout.test.js
//
// Phase 54 (BAND-01) — synthetic-results pins for tools/lib/band-readout.mjs.
// Never asserts on a real seeded run's numbers (same discipline as
// test/unit/tuning-bot.test.js) — the fixture below is hand-built.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  bandReadout,
  formatBandReadout,
  survivalReadout,
  survivalFromHistogram,
  survivalVerdict,
  formatSurvivalReadout,
  TARGET_SURVIVAL,
} from "../../tools/lib/band-readout.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Deaths at depths [1, 3, 5, 5, 6, 7, 9, 16, 20, 23] plus two stuck records
// (excluded). deathDepth 23 is `beyond` (> Endgame's max of 20).
function makeResults() {
  return [
    { deathDepth: 1, stuck: false, floorsGained: 0, encountersSurvived: 0, cause: "combat" },
    { deathDepth: 3, stuck: false, floorsGained: 2, encountersSurvived: 1, cause: "trap" },
    { deathDepth: 5, stuck: false, floorsGained: 4, encountersSurvived: 2, cause: "combat" },
    { deathDepth: 5, stuck: false, floorsGained: 4, encountersSurvived: 2, cause: "combat" },
    { deathDepth: 6, stuck: false, floorsGained: 5, encountersSurvived: 3, cause: "starvation" },
    { deathDepth: 7, stuck: false, floorsGained: 6, encountersSurvived: 4, cause: "combat" },
    { deathDepth: 9, stuck: false, floorsGained: 8, encountersSurvived: 5, cause: "combat" },
    { deathDepth: 16, stuck: false, floorsGained: 15, encountersSurvived: 6, cause: "combat" },
    { deathDepth: 20, stuck: false, floorsGained: 19, encountersSurvived: 7, cause: "combat" },
    { deathDepth: 23, stuck: false, floorsGained: 22, encountersSurvived: 8, cause: "combat" },
    { deathDepth: 2, stuck: true, floorsGained: 1, encountersSurvived: 0, cause: "unknown" },
    { deathDepth: 2, stuck: true, floorsGained: 1, encountersSurvived: 0, cause: "unknown" },
  ];
}

test("bandReadout: stuck runs are excluded and completed counts the rest", () => {
  const r = bandReadout(makeResults(), {});
  assert.equal(r.completed, 10);
});

test("bandReadout: histogram lists only depths with deaths, ascending, and sums to completed", () => {
  const r = bandReadout(makeResults(), {});
  const keys = Object.keys(r.histogram).map(Number);
  const sortedKeys = [...keys].sort((a, b) => a - b);
  assert.deepStrictEqual(keys, sortedKeys);
  const total = Object.values(r.histogram).reduce((s, v) => s + v, 0);
  assert.equal(total, 10);
  assert.deepStrictEqual(r.histogram, {
    "1": 1,
    "3": 1,
    "5": 2,
    "6": 1,
    "7": 1,
    "9": 1,
    "16": 1,
    "20": 1,
    "23": 1,
  });
});

test("bandReadout: reach uses the reachTable rounding — >=16 is 30.0 and >=20 is 20.0 on the synthetic set", () => {
  const r = bandReadout(makeResults(), {});
  assert.equal(r.reach["16"], 30.0);
  assert.equal(r.reach["20"], 20.0);
});

test("bandReadout: band share sums to 100.0 across Filter/Wall/Breakaway/Endgame/beyond", () => {
  const r = bandReadout(makeResults(), {});
  assert.deepStrictEqual(r.bandShare, { Filter: 20.0, Wall: 40.0, Breakaway: 10.0, Endgame: 20.0, beyond: 10.0 });
  const sum = Object.values(r.bandShare).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 100.0) < 1e-9);
});

test("bandReadout: topCausesByBand sorts count desc then cause asc and caps at 5", () => {
  const r = bandReadout(makeResults(), {});
  assert.deepStrictEqual(r.topCausesByBand.Filter, [
    { cause: "combat", count: 1 },
    { cause: "trap", count: 1 },
  ]);
  assert.deepStrictEqual(r.topCausesByBand.Wall, [
    { cause: "combat", count: 3 },
    { cause: "starvation", count: 1 },
  ]);
  assert.deepStrictEqual(r.topCausesByBand.Breakaway, [{ cause: "combat", count: 1 }]);
  assert.deepStrictEqual(r.topCausesByBand.Endgame, [{ cause: "combat", count: 2 }]);
  for (const band of Object.keys(r.topCausesByBand)) {
    assert.ok(r.topCausesByBand[band].length <= 5);
  }
});

test("bandReadout: an all-stuck or empty set yields zeros and empty lists, never NaN", () => {
  const allStuck = [
    { deathDepth: 2, stuck: true, floorsGained: 1, encountersSurvived: 0, cause: "unknown" },
    { deathDepth: 3, stuck: true, floorsGained: 2, encountersSurvived: 0, cause: "unknown" },
  ];
  for (const results of [allStuck, []]) {
    const r = bandReadout(results, {});
    assert.equal(r.completed, 0);
    assert.deepStrictEqual(r.histogram, {});
    assert.equal(r.meanDeathDepth, 0);
    assert.ok(!Number.isNaN(r.meanDeathDepth));
    assert.deepStrictEqual(r.floorsGained, { p50: 0, mean: 0 });
    assert.equal(r.encountersSurvivedMean, 0);
    for (const floor of [5, 8, 9, 10, 13, 16, 20]) {
      assert.equal(r.reach[String(floor)], 0);
      assert.ok(!Number.isNaN(r.reach[String(floor)]));
    }
    for (const band of ["Filter", "Wall", "Breakaway", "Endgame", "beyond"]) {
      assert.equal(r.bandShare[band], 0);
    }
    for (const band of ["Filter", "Wall", "Breakaway", "Endgame"]) {
      assert.deepStrictEqual(r.topCausesByBand[band], []);
    }
  }
});

test("formatBandReadout: the header line is exactly the BAND-01 string and the reach line carries >=16", () => {
  const r = bandReadout(makeResults(), {});
  const lines = formatBandReadout(r);
  assert.equal(
    lines[0],
    "Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):",
  );
  assert.match(lines[3], />=16 30\.0%/);
});

test("tune-difficulty.mjs source: prints the band block after printSharedReadout and before Outcome, and never imports anything new from tuning-bot.mjs", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../tools/tune-difficulty.mjs"), "utf8");
  const idxShared = src.indexOf("printSharedReadout(results, opts);");
  const idxBand = src.indexOf("formatBandReadout(");
  const idxOutcome = src.indexOf("Outcome:");
  assert.ok(idxShared > -1 && idxBand > -1 && idxOutcome > -1);
  assert.ok(idxBand > idxShared);
  assert.ok(idxBand < idxOutcome);
  assert.ok(
    src.includes(
      'import { playRun, distribution, percentile, sharedJson, printSharedReadout, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";',
    ),
  );
  const idxFormatSurvival = src.indexOf("formatSurvivalReadout(");
  assert.ok(idxFormatSurvival > -1);
  assert.ok(idxFormatSurvival > idxBand);
  assert.ok(idxFormatSurvival < idxOutcome);
  assert.ok(src.includes("survival: survivalReadout(results, opts)"));
});

// --- USER RULING C (2026-09-21): the per-floor survival block ------------

// 10 dead runs at [1, 3, 5, 5, 6, 7, 9, 16, 20, 23] (trap at 3, starvation
// at 6) + 2 stuck runs at depth 6 (reached, never deaths). Expected values
// below were computed by this same survivalReadout implementation and
// cross-checked by hand for the L=1 and L=6 rows quoted in the plan.
function makeSurvivalResults() {
  return [
    { deathDepth: 1, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 3, dead: true, stuck: false, cause: "undone by a trap" },
    { deathDepth: 5, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 5, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 6, dead: true, stuck: false, cause: "starved in the dark" },
    { deathDepth: 7, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 9, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 16, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 20, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 23, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 6, dead: false, stuck: true, cause: "unknown" },
    { deathDepth: 6, dead: false, stuck: true, cause: "unknown" },
  ];
}

test("survivalReadout: reached/deaths/p_L/S_L on a synthetic set; a stuck run counts as reached at every floor <= its depth and never as a death", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  assert.equal(r.runs, 12);
  assert.equal(r.stuck, 2);
  const f1 = r.floors.find((f) => f.floor === 1);
  assert.deepStrictEqual(
    { reached: f1.reached, deaths: f1.deaths, pL: f1.pL, SL: f1.SL },
    { reached: 12, deaths: 1, pL: 91.7, SL: 91.7 },
  );
  const f6 = r.floors.find((f) => f.floor === 6);
  // reached_6: dead >= 6 (6,7,9,16,20,23 = 6) + both stuck runs (depth 6 >= 6) = 8
  assert.deepStrictEqual(
    { reached: f6.reached, deaths: f6.deaths, starvation: f6.starvation },
    { reached: 8, deaths: 1, starvation: 1 },
  );
});

test("survivalReadout: start depth 20 reports S_L relative to 20 and reach-20 = 100", () => {
  const results = [
    { deathDepth: 20, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 21, dead: true, stuck: false, cause: "combat" },
    { deathDepth: 22, dead: true, stuck: false, cause: "combat" },
  ];
  const r = survivalReadout(results, { startDepth: 20 });
  assert.equal(r.startDepth, 20);
  assert.equal(r.reach20, 100);
  const f20 = r.floors.find((f) => f.floor === 20);
  assert.equal(f20.SL, f20.pL); // the chain starts fresh at the start depth
});

test("survivalReadout: deaths split hazard / starvation / combat by cause", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const f3 = r.floors.find((f) => f.floor === 3);
  assert.equal(f3.hazard, 1);
  const f6 = r.floors.find((f) => f.floor === 6);
  assert.equal(f6.starvation, 1);
  const f1 = r.floors.find((f) => f.floor === 1);
  assert.equal(f1.combat, 1);
});

test("TARGET_SURVIVAL: 25 rows; floor 1 p 98.8 S 98.8; floor 10 p 78.9 S 24.3; floor 20 p 84.5 with reach20Band [3, 5]; floor 25 p 88.9 S 1.5", () => {
  assert.equal(TARGET_SURVIVAL.length, 25);
  assert.deepStrictEqual(TARGET_SURVIVAL[0], { floor: 1, pL: 98.8, SL: 98.8, note: "High early survival" });
  const f10 = TARGET_SURVIVAL.find((t) => t.floor === 10);
  assert.equal(f10.pL, 78.9);
  assert.equal(f10.SL, 24.3);
  const f20 = TARGET_SURVIVAL.find((t) => t.floor === 20);
  assert.equal(f20.pL, 84.5);
  assert.deepStrictEqual(f20.reach20Band, [3, 5]);
  const f25 = TARGET_SURVIVAL.find((t) => t.floor === 25);
  assert.equal(f25.pL, 88.9);
  assert.equal(f25.SL, 1.5);
});

test("survivalVerdict: floors 1-10 fail beyond 8 points, 11-19 beyond 3, floor 20 by the reach-20 band; empty missing list when all inside", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const verdict = survivalVerdict(r);
  assert.ok(verdict.missing.some((m) => m.floor === 10));
  assert.ok(verdict.missing.some((m) => m.floor === 16));
  assert.ok(!verdict.missing.some((m) => m.floor === 1));
  assert.equal(verdict.reach20.pass, false); // reach20 = 16.7%, outside [3,5]
  assert.deepStrictEqual(verdict.reach20.band, [3.0, 5.0]);

  // An empty missing list when every floor 1-19 tracks the target p_L
  // exactly: build a synthetic million-run set whose per-floor death
  // counts are derived directly from TARGET_SURVIVAL's own p_L values.
  const N = 1_000_000;
  let reached = N;
  const deathsByFloor = {};
  for (const row of TARGET_SURVIVAL) {
    if (row.floor > 19) break;
    const d = Math.round(reached * (1 - row.pL / 100));
    deathsByFloor[row.floor] = d;
    reached -= d;
  }
  deathsByFloor[20] = reached; // remaining survivors all "die" at 20 — floor 20 itself isn't in `missing`
  const onCurve = [];
  for (const [depthStr, count] of Object.entries(deathsByFloor)) {
    for (let i = 0; i < count; i++) {
      onCurve.push({ deathDepth: Number(depthStr), dead: true, stuck: false, cause: "combat" });
    }
  }
  const flat = survivalReadout(onCurve, {});
  assert.deepStrictEqual(survivalVerdict(flat).missing, []);
});

test("survivalFromHistogram: matches survivalReadout on a 0-stuck set (the rung-2 histogram 1:19 2:20 3:30 4:59 5:45 6:17 7:8 8:1 9:1 gives p_1 90.5, p_4 55.0, p_5 37.5, S_4 36.0)", () => {
  const histogram = { 1: 19, 2: 20, 3: 30, 4: 59, 5: 45, 6: 17, 7: 8, 8: 1, 9: 1 };
  const r = survivalFromHistogram(histogram, 200, 1);
  assert.equal(r.runs, 200);
  assert.equal(r.stuck, 0);
  const f1 = r.floors.find((f) => f.floor === 1);
  const f4 = r.floors.find((f) => f.floor === 4);
  const f5 = r.floors.find((f) => f.floor === 5);
  assert.equal(f1.pL, 90.5);
  assert.equal(f4.pL, 55.0);
  assert.equal(f5.pL, 37.5);
  assert.equal(f4.SL, 36.0);
  // matches survivalReadout called directly on the equivalent synthetic set
  const direct = survivalReadout(
    Object.entries(histogram).flatMap(([d, c]) =>
      Array.from({ length: c }, () => ({ deathDepth: Number(d), dead: true, stuck: false, cause: "unknown" })),
    ),
    { startDepth: 1 },
  );
  assert.deepStrictEqual(r, direct);
});

test("formatSurvivalReadout: the header line is exact, one line per floor carries dS and PASS/MISS, the verdict line is last", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const lines = formatSurvivalReadout(r);
  assert.equal(
    lines[0],
    "Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):",
  );
  assert.match(lines[1], /^  L=1  reached=12  deaths=1 \(hazard 0 \/ starvation 0 \/ combat 1\)  p_L=91\.7%  S_L=91\.7%  target p_L=98\.8%  target S_L=98\.8%  dS=-7\.1  PASS$/);
  assert.equal(lines[lines.length - 1].startsWith("  verdict:"), true);
  assert.ok(lines.some((l) => /^  reach-20: /.test(l)));
});
