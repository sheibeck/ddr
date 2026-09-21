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
  SURVIVAL_PASS,
  DOT_CAUSES,
  STARVATION_CAUSES,
  interpolatedMedian,
  paceReadout,
  formatPaceReadout,
  classIdentityReadout,
  formatClassIdentityReadout,
  classSpreadReadout,
  CLASS_POOLS,
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

  // USER RULING D: the Pace + Class identity blocks print after the survival
  // block and before Outcome:, and both keys land in --json.
  const idxFormatPace = src.indexOf("formatPaceReadout(");
  const idxFormatClassIdentity = src.indexOf("formatClassIdentityReadout(");
  assert.ok(idxFormatPace > -1 && idxFormatClassIdentity > -1);
  assert.ok(idxFormatPace > idxFormatSurvival);
  assert.ok(idxFormatClassIdentity > idxFormatPace);
  assert.ok(idxFormatClassIdentity < idxOutcome);
  assert.ok(src.includes("pace: paceReadout(results)"));
  assert.ok(src.includes("classIdentity: classIdentityReadout(results)"));
});

// --- USER RULING C (2026-09-21): the per-floor survival block ------------

// 10 dead runs at [1, 3, 5, 5, 6, 7, 9, 16, 20, 23] (trap at 3, starvation
// at 6, every other death "cut down by a Ghoul") + 2 stuck runs at depth 6
// (reached, never deaths). USER RULING D (54-CONTEXT.md, 2026-09-21): cause
// strings are the real content/epitaphs.js CAUSE_TEXT shapes (a bare
// "combat" literal no longer classifies as combat — COMBAT_CAUSE_PREFIX
// requires the "cut down by a {foe}" shape). Expected values below are
// pasted from this same survivalReadout implementation's own output.
function makeSurvivalResults() {
  return [
    { deathDepth: 1, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 3, dead: true, stuck: false, cause: "undone by a trap" },
    { deathDepth: 5, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 5, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 6, dead: true, stuck: false, cause: "starved in the dark" },
    { deathDepth: 7, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 9, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 16, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 20, dead: true, stuck: false, cause: "cut down by a Ghoul" },
    { deathDepth: 23, dead: true, stuck: false, cause: "cut down by a Ghoul" },
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

test("survivalReadout: deaths split combat / dot / starvation-exhaustion / other by cause (USER RULING D)", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const f3 = r.floors.find((f) => f.floor === 3);
  assert.equal(f3.dot, 1); // "undone by a trap"
  const f6 = r.floors.find((f) => f.floor === 6);
  assert.equal(f6.starvation, 1); // "starved in the dark"
  const f1 = r.floors.find((f) => f.floor === 1);
  assert.equal(f1.combat, 1); // "cut down by a Ghoul"
});

test("USER RULING D: the three-class death split classifies one death per class, incl. 'spent by the dungeon itself' as dot (never starvation)", () => {
  const results = [
    { deathDepth: 1, dead: true, stuck: false, cause: "cut down by a Werebeast" }, // combat
    { deathDepth: 1, dead: true, stuck: false, cause: "undone by a trap" }, // dot
    { deathDepth: 1, dead: true, stuck: false, cause: "spent by the dungeon itself" }, // dot (NOT starvation)
    { deathDepth: 1, dead: true, stuck: false, cause: "starved in the dark" }, // starvation
    { deathDepth: 1, dead: true, stuck: false, cause: "poisoned by an unlabelled bottle" }, // other
  ];
  const r = survivalReadout(results, {});
  const f1 = r.floors.find((f) => f.floor === 1);
  assert.deepStrictEqual(
    { combat: f1.combat, dot: f1.dot, starvation: f1.starvation, other: f1.other },
    { combat: 1, dot: 2, starvation: 1, other: 1 },
  );
  assert.deepStrictEqual(DOT_CAUSES, ["undone by a trap", "fell off a wall", "came up short on a leap", "spent by the dungeon itself"]);
  assert.deepStrictEqual(STARVATION_CAUSES, ["starved in the dark"]);
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

test("survivalVerdict: USER RULING D (plan-approval cut #3) — the verdict covers ONLY floors 1-12 (shallow 1-10 beyond 8 points, deep 11-12 beyond 3); floor 13+ is tail (never in missing, never PASS/MISS); reach-20 is reported but never part of the verdict; empty missing list when all of 1-12 are inside", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const verdict = survivalVerdict(r);
  // Pasted from the implementation's own output on this fixture.
  assert.deepStrictEqual(verdict, {
    missing: [
      { floor: 10, deltaS: 10.7 },
      { floor: 11, deltaS: 15.9 },
      { floor: 12, deltaS: 19.9 },
    ],
  });
  assert.ok(!verdict.missing.some((m) => m.floor === 1));
  // Floor 16 is tail territory (SURVIVAL_PASS.tailFloors = [13, 20]) — its
  // own dS is far outside the old 11-19 band, but it is NEVER in `missing`.
  const f16 = r.floors.find((f) => f.floor === 16);
  assert.deepStrictEqual({ pass: f16.pass, tail: f16.tail }, { pass: null, tail: true });
  assert.ok(!verdict.missing.some((m) => m.floor === 16));
  assert.deepStrictEqual(SURVIVAL_PASS.deepFloors, [11, 12]);
  assert.deepStrictEqual(SURVIVAL_PASS.tailFloors, [13, 20]);
  assert.equal("reach20" in verdict, false); // reach-20 is reported (formatSurvivalReadout), never folded into the verdict object

  // An empty missing list when every floor 1-12 tracks the target p_L
  // exactly: build a synthetic million-run set whose per-floor death
  // counts are derived directly from TARGET_SURVIVAL's own p_L values.
  const N = 1_000_000;
  let reached = N;
  const deathsByFloor = {};
  for (const row of TARGET_SURVIVAL) {
    if (row.floor > SURVIVAL_PASS.deepFloors[1]) break;
    const d = Math.round(reached * (1 - row.pL / 100));
    deathsByFloor[row.floor] = d;
    reached -= d;
  }
  deathsByFloor[20] = reached; // remaining survivors all "die" at 20 — never checked by the verdict
  const onCurve = [];
  for (const [depthStr, count] of Object.entries(deathsByFloor)) {
    for (let i = 0; i < count; i++) {
      onCurve.push({ deathDepth: Number(depthStr), dead: true, stuck: false, cause: "cut down by a Ghoul" });
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

test("formatSurvivalReadout: the header line is exact, one line per floor carries dS and PASS/MISS/tail, floor 13+ is tail, the reach-20 line is reported (not part of the verdict), the verdict line is last", () => {
  const r = survivalReadout(makeSurvivalResults(), {});
  const lines = formatSurvivalReadout(r);
  assert.equal(
    lines[0],
    "Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths; deaths split combat/dot/starvation-exhaustion/other):",
  );
  assert.match(
    lines[1],
    /^  L=1  reached=12  deaths=1 \(combat 1 \/ dot 0 \/ starvation-exhaustion 0 \/ other 0\)  p_L=91\.7%  S_L=91\.7%  target p_L=98\.8%  target S_L=98\.8%  dS=-7\.1  PASS$/,
  );
  // Floor 16 (tail territory) prints "tail", never PASS/MISS, and is absent
  // from the verdict line below.
  const line16 = lines.find((l) => l.startsWith("  L=16 "));
  assert.ok(line16.trim().endsWith("tail"));
  const reachLine = lines.find((l) => /^  reach-20: /.test(l));
  assert.equal(reachLine, "  reach-20: 16.7% (band 3.0-5.0%, reported — tail)");
  const verdictLine = lines[lines.length - 1];
  assert.equal(verdictLine.startsWith("  verdict:"), true);
  assert.ok(!verdictLine.includes("16"));
  assert.ok(!verdictLine.includes("reach-20"));
});

// --- USER RULING D (54-CONTEXT.md, 2026-09-21): Pace + Class identity -----

test("interpolatedMedian: the middle value on odd n, the mean of the two middle values on even n; null on empty", () => {
  assert.equal(interpolatedMedian([]), null);
  assert.equal(interpolatedMedian([5]), 5);
  assert.equal(interpolatedMedian([1, 3, 5]), 3);
  assert.equal(interpolatedMedian([1, 2, 3, 4]), 2.5); // even n -> mean of the two middle values (2, 3)
  assert.equal(interpolatedMedian([1, 2, 4, 8]), 3); // mean of (2, 4)
});

function makeSnapshot(depth, over = {}) {
  return { depth, level: 1, gold: 0, ar: 0, weaponCost: 0, maxWP: 40, potions: 0, afraidTriggers: 0, diedAfraid: false, ...over };
}

test("paceReadout: aggregates floorSnapshots per floor (n, means to 2dp, summed afraid triggers/diedAfraid); stuck runs are included", () => {
  const results = [
    { floorSnapshots: [makeSnapshot(1, { level: 1, gold: 10, ar: 1, weaponCost: 5, maxWP: 40, potions: 1, afraidTriggers: 1 }), makeSnapshot(2, { level: 2, gold: 40 })], stuck: false },
    { floorSnapshots: [makeSnapshot(1, { level: 1, gold: 20, ar: 2, weaponCost: 10, maxWP: 44, potions: 0 })], stuck: true },
  ];
  const r = paceReadout(results);
  const f1 = r.floors.find((f) => f.floor === 1);
  assert.deepStrictEqual(f1, {
    floor: 1,
    n: 2,
    meanLevel: 1,
    meanGold: 15,
    meanAr: 1.5,
    meanWeaponCost: 7.5,
    meanMaxWP: 42,
    meanPotions: 0.5,
    afraidTriggers: 1,
    diedAfraid: 0,
  });
  const f2 = r.floors.find((f) => f.floor === 2);
  assert.equal(f2.n, 1); // the stuck run never reached floor 2 -> still included (it just has no row for floor 2)
});

test("formatPaceReadout: the header line is exact, one line per floor", () => {
  const results = [{ floorSnapshots: [makeSnapshot(1, { level: 1, gold: 10, ar: 1, weaponCost: 5, maxWP: 40, potions: 1, afraidTriggers: 3 })], stuck: false }];
  const lines = formatPaceReadout(paceReadout(results));
  assert.equal(
    lines[0],
    "Pace (per floor reached — mean hero level / gold / AR / weapon cost / maxWP / potions; afraid triggers, died afraid):",
  );
  assert.equal(lines[1], "  L=1  n=1  level=1.00  gold=10.00  ar=1.00  weapon=5.00  maxWP=40.00  potions=1.00  afraid=3  diedAfraid=0");
});

function makeIdentity(over = {}) {
  return { fights: 0, rounds: 0, dmgTaken: 0, foeSwings: 0, foeMisses: 0, castsDefensive: 0, castsOffensive: 0, potionsUsed: 0, backstabs: 0, flees: 0, ...over };
}

test("classIdentityReadout: pools by CLASS ONLY (a Fighter Knight and a Fighter Bard land in ONE row, in CLASS_POOLS order), computing dmgTakenPerFight / roundsPerFight / foeMissRate from the identity tallies", () => {
  assert.deepStrictEqual(CLASS_POOLS, ["Fighter", "Thief", "Magic User"]);
  const results = [
    { cls: "Fighter", sub: "Knight", stuck: false, deathDepth: 4, identity: makeIdentity({ fights: 2, dmgTaken: 20, foeSwings: 8, foeMisses: 2 }) },
    { cls: "Fighter", sub: "Bard", stuck: false, deathDepth: 6, identity: makeIdentity({ fights: 3, dmgTaken: 25, foeSwings: 12, foeMisses: 4 }) },
    { cls: "Thief", sub: "Pickpocket", stuck: false, deathDepth: 5, identity: makeIdentity({ backstabs: 2, flees: 1 }) },
  ];
  const rows = classIdentityReadout(results);
  assert.deepStrictEqual(rows.map((r) => r.cls), ["Fighter", "Thief", "Magic User"]);
  const fighter = rows.find((r) => r.cls === "Fighter");
  // ONE pooled Fighter row — both Knight and Bard runs folded together.
  assert.equal(fighter.n, 2);
  assert.equal(fighter.dmgTakenPerFight, 9); // (20+25) / (2+3)
  assert.equal(fighter.foeMissRate, 30); // (2+4) / (8+12) * 100
  const magicUser = rows.find((r) => r.cls === "Magic User");
  assert.equal(magicUser.n, 0);
  assert.equal(magicUser.p50, null);
});

test("formatClassIdentityReadout: the header line names 'class pools only' and prints one line per class", () => {
  const rows = classIdentityReadout([{ cls: "Thief", sub: "Pickpocket", stuck: false, deathDepth: 5, identity: makeIdentity({ backstabs: 2 }) }]);
  const lines = formatClassIdentityReadout(rows);
  assert.equal(
    lines[0],
    "Class identity (class pools only — Fighter = ABSORB, Thief = AVOID, Magic User = CHOOSE; race/sub cells are not targets):",
  );
  assert.equal(lines.length, 4); // header + Fighter + Thief + Magic User
  assert.ok(lines[2].startsWith("  Thief  n=1"));
});

test("classSpreadReadout: per class, the min/max p50Depth/reach5 cell — a recorded spread, never a verdict", () => {
  const smokeCells = [
    { cls: "Fighter", sub: "Knight", race: "Human", p50Depth: 6, reach5: 40 },
    { cls: "Fighter", sub: "Bard", race: "Elven", p50Depth: 4, reach5: 20 },
    { cls: "Thief", sub: "Pickpocket", race: "Human", p50Depth: 5, reach5: 30 },
  ];
  const rows = classSpreadReadout(smokeCells);
  const fighter = rows.find((r) => r.cls === "Fighter");
  assert.deepStrictEqual(fighter.p50Min, { value: 4, cell: "Bard/Elven" });
  assert.deepStrictEqual(fighter.p50Max, { value: 6, cell: "Knight/Human" });
  const magicUser = rows.find((r) => r.cls === "Magic User");
  assert.equal(magicUser.p50Min, null);
});
