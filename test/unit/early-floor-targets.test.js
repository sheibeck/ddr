// test/unit/early-floor-targets.test.js
//
// Phase 79.2 (user ruling 2026-09-27): "we need to bring the difficulty back
// up on floors 1 - 12. Just too easy." The user's yardstick: a typical
// FAIR-BOT run dies around floor 3-4 (fresh p50 death depth 3-4 at 1,000
// seeds). This file pins the floors 1-12 survival targets that yardstick
// becomes, the p50 band and the Filter-shape gate the band objective scores,
// and ties both copies of the curve (tools/lib/band-readout.mjs
// #TARGET_SURVIVAL and tools/lib/fit-score.mjs#EARLY_TARGET_S) to USER
// RULING C's own digits: floor L's target is Ruling C's floor 2L.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { TARGET_SURVIVAL, FOUR_BANDS, survivalReadout } from "../../tools/lib/band-readout.mjs";
import { TAIL_TARGETS } from "../../tools/lib/tail-score.mjs";
import {
  EARLY_TARGET_S,
  P50_DEATH_BAND,
  FILTER_SHAPE,
  filterShape,
  scoreSurvival,
  classConstraints,
  evalRow,
  formatEvalLine,
  CLASS_POOL_MIN_N,
} from "../../tools/lib/fit-score.mjs";
import { distribution } from "../../tools/lib/tuning-bot.mjs";
import { DIALS } from "../../engine/difficulty.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// USER RULING C's S_L for floors 1-24 (54-CONTEXT.md, 2026-09-21), pasted
// independently of both copies under test, so a drift fails here.
const RULING_C_S = [98.8, 95.1, 88.6, 79.7, 69.2, 58.4, 48.0, 38.7, 30.8, 24.3, 19.1, 15.1, 11.9, 9.5, 7.6, 6.2, 5.0, 4.2, 3.5, 3.0, 2.5, 2.2, 1.9, 1.7];

const EXPECTED_S = [95.1, 79.7, 58.4, 38.7, 24.3, 15.1, 9.5, 6.2, 4.2, 3.0, 2.2, 1.7];
const EXPECTED_P = [95.1, 83.8, 73.3, 66.3, 62.8, 62.1, 62.9, 65.3, 67.7, 71.4, 73.3, 77.3];

const round1 = (x) => Math.round(x * 10) / 10;

function onTargetSurvival(p50Death = 4) {
  return {
    reach20: 0,
    p50Death,
    floors: TARGET_SURVIVAL.map((r) => ({ floor: r.floor, pL: r.pL, SL: r.SL })),
  };
}

function classRow(cls, overrides = {}) {
  return { cls, n: CLASS_POOL_MIN_N, p50: 4, reach5: 30, reach10: 5, dmgTakenPerFight: 5, roundsPerFight: 2, ...overrides };
}

// --- the targets ------------------------------------------------------------

test("Phase 79.2 targets: 12 rows; floor L's S_L is Ruling C floor 2L; p_L = round1(100 x S_L / S_(L-1)), S_0 = 100", () => {
  assert.equal(TARGET_SURVIVAL.length, 12);
  let prev = 100;
  TARGET_SURVIVAL.forEach((row, i) => {
    const L = i + 1;
    assert.equal(row.floor, L);
    assert.equal(row.SL, RULING_C_S[2 * L - 1], `floor ${L} S_L is Ruling C floor ${2 * L}`);
    assert.equal(row.note, `Ruling C floor ${2 * L}`);
    assert.equal(row.pL, round1((100 * row.SL) / prev), `floor ${L} p_L`);
    prev = row.SL;
  });
  assert.deepStrictEqual(TARGET_SURVIVAL.map((r) => r.SL), EXPECTED_S);
  assert.deepStrictEqual(TARGET_SURVIVAL.map((r) => r.pL), EXPECTED_P);
});

test("Phase 79.2 targets: fit-score's EARLY_TARGET_S equals TARGET_SURVIVAL's S_L; the curve's own median death floor (first S_L <= 50) is 4, inside P50_DEATH_BAND", () => {
  assert.deepStrictEqual(EARLY_TARGET_S, TARGET_SURVIVAL.map((r) => r.SL));
  assert.deepStrictEqual(P50_DEATH_BAND, [3, 4]);
  const medianFloor = TARGET_SURVIVAL.find((r) => r.SL <= 50).floor;
  assert.equal(medianFloor, 4);
  assert.ok(medianFloor >= P50_DEATH_BAND[0] && medianFloor <= P50_DEATH_BAND[1]);
});

// --- survivalReadout.p50Death ------------------------------------------------

test("survivalReadout.p50Death: nearest-rank over completed runs (stuck excluded), equal to tune-difficulty's distribution p50; null when every run is stuck", () => {
  const results = [
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
  const r = survivalReadout(results, {});
  const expected = distribution(results.filter((x) => !x.stuck).map((x) => x.deathDepth)).p50;
  assert.equal(r.p50Death, expected);
  assert.equal(r.p50Death, 7);
  // Folding the stuck runs in would give 6: the exclusion is load-bearing.
  assert.notEqual(r.p50Death, distribution(results.map((x) => x.deathDepth)).p50);

  const allStuck = survivalReadout([{ deathDepth: 2, dead: false, stuck: true, cause: "unknown" }], {});
  assert.equal(allStuck.p50Death, null);
});

// --- filterShape --------------------------------------------------------------

const shapeOf = (pLs) => filterShape({ floors: pLs.map((pL, i) => ({ floor: i + 1, pL })) });

test("FILTER_SHAPE constants: floors 1-5, maxDrop 20, rise floors 1-4, minRise 10", () => {
  assert.deepStrictEqual(FILTER_SHAPE, { floors: [1, 5], maxDrop: 20, riseFloors: [1, 4], minRise: 10 });
});

test("filterShape: the Phase 79.2 target passes (largest drop 11.3 on floor 2, rise 28.8)", () => {
  const s = shapeOf(EXPECTED_P.slice(0, 5));
  assert.equal(s.ok, true, s.reasons.join(" | "));
  assert.equal(s.maxDrop, 11.3);
  assert.equal(s.maxDropFloor, 2);
  assert.equal(s.rise, 28.8);
  assert.deepStrictEqual(s.reasons, []);
});

test("filterShape: the Phase 54 wall (pL 90, 89, 81, 55, 37 — 'that curve is not a curve, that's a wall') fails on floor 4's 26-point drop", () => {
  const s = shapeOf([90, 89, 81, 55, 37]);
  assert.equal(s.ok, false);
  assert.equal(s.maxDrop, 26);
  assert.equal(s.maxDropFloor, 4);
  assert.ok(s.reasons.some((r) => r.includes("floor 4 drops 26")), s.reasons.join(" | "));
});

test("filterShape: a flat Filter (pL 84 on floors 1-5) fails with rise 0", () => {
  const s = shapeOf([84, 84, 84, 84, 84]);
  assert.equal(s.ok, false);
  assert.equal(s.rise, 0);
  assert.ok(s.reasons.some((r) => r.includes("flat")), s.reasons.join(" | "));
});

test("filterShape: floor 5 missing fails with 'floor 5 unmeasured'", () => {
  const s = shapeOf(EXPECTED_P.slice(0, 4));
  assert.equal(s.ok, false);
  assert.ok(s.reasons.includes("floor 5 unmeasured"), s.reasons.join(" | "));
});

// --- scoreSurvival's verdict -------------------------------------------------------

test("scoreSurvival: exactly on the Phase 79.2 target scores 0 and PASSes at p50Death 4 and 3", () => {
  for (const p50 of [4, 3]) {
    const result = scoreSurvival(onTargetSurvival(p50));
    assert.equal(result.score, 0);
    assert.equal(result.verdict, "PASS");
    assert.deepStrictEqual(result.misses, []);
    assert.equal(result.p50Death, p50);
    assert.equal(result.p50InBand, true);
    assert.equal(result.shape.ok, true);
  }
});

test("scoreSurvival: the same curve at p50Death 5 is a MISS with no floor misses (the p50 gate)", () => {
  const result = scoreSurvival(onTargetSurvival(5));
  assert.equal(result.verdict, "MISS");
  assert.deepStrictEqual(result.misses, []);
  assert.equal(result.p50InBand, false);
});

test("scoreSurvival: the same S values with a floor-3 wall (pL 99, 97, 60, 90, 90) are a MISS on shape", () => {
  const survival = onTargetSurvival(4);
  [99, 97, 60, 90, 90].forEach((pL, i) => {
    survival.floors[i].pL = pL;
  });
  const result = scoreSurvival(survival);
  assert.deepStrictEqual(result.misses, []);
  assert.equal(result.shape.ok, false);
  assert.equal(result.verdict, "MISS");
});

test("scoreSurvival: a floor never reached counts S_L = 0 (floor-1 term ((0 - 95.1)/8)^2); tail rows 13-20 carry target null and dS null", () => {
  const result = scoreSurvival({ reach20: 0, floors: [] });
  const floor1 = result.terms.find((t) => t.floor === 1);
  assert.equal(floor1.SL, 0);
  assert.equal(floor1.term, Math.round((((0 - 95.1) / 8) ** 2) * 1e6) / 1e6);
  assert.equal(result.verdict, "MISS");
  assert.equal(result.tail.length, 8);
  for (const t of result.tail) {
    assert.equal(t.target, null);
    assert.equal(t.dS, null);
  }
});

// --- evalRow / formatEvalLine -----------------------------------------------------

test("evalRow: floors 13-20 carry dS null; the row carries p50Death, p50InBand and shape; formatEvalLine reads 'deathP50=4 shape=ok'", () => {
  const survival = onTargetSurvival(4);
  const scored = scoreSurvival(survival);
  const classIdentity = [classRow("Fighter"), classRow("Thief"), classRow("Magic User")];
  const constraints = classConstraints(classIdentity);
  const row = evalRow(1, DIALS, { survival, scored, classIdentity, constraints, pace: { floors: [] }, elapsedMs: 1, walkPass: 1 });
  for (let L = 13; L <= 20; L++) assert.equal(row.floors.find((f) => f.L === L).dS, null, `floor ${L}`);
  assert.equal(row.floors.find((f) => f.L === 1).dS, 0);
  assert.equal(row.p50Death, 4);
  assert.equal(row.p50InBand, true);
  assert.equal(row.shape.ok, true);
  const line = formatEvalLine(row);
  assert.ok(line.startsWith("#1 score="), line);
  assert.ok(line.includes("deathP50=4 shape=ok"), line);
  assert.ok(line.includes(" S1=95.1 S2=79.7 S3=58.4 S4=38.7 S6=15.1 S8=6.2 S12=1.7 tail S15="), line);
});

// --- the tail guard and the doc record (Phase 79.2) ----------------------------------

test("P50_DEATH_BAND deep-equals TAIL_TARGETS.guard.freshP50Death ([3, 4], user ruling 2026-09-27); the fresh ruled tail targets are unchanged", () => {
  assert.deepStrictEqual(TAIL_TARGETS.guard, { freshP50Death: [3, 4] });
  assert.deepStrictEqual(P50_DEATH_BAND, TAIL_TARGETS.guard.freshP50Death);
  assert.deepStrictEqual(TAIL_TARGETS.fresh, { reach20Max: 1.0, reach21Below: 0.5, reachCount30Max: 1 });
});

test("docs/DIFFICULTY-RETUNE.md: the Phase 79.2 targets section agrees with TARGET_SURVIVAL and the live constants (doc-sync)", () => {
  const doc = fs.readFileSync(path.join(__dirname, "../../docs/DIFFICULTY-RETUNE.md"), "utf8").replace(/\r\n/g, "\n");
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => l.startsWith("### Phase 79.2 — the targets (floors 1–12)"));
  assert.ok(start > -1, "the '### Phase 79.2 — the targets (floors 1–12)' heading exists");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3} /.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start + 1, end);

  const rowRe = /^\| (\d+) \| ([\d.]+) % \| ([\d.]+) % \| Ruling C floor (\d+) \| (\w+) \|$/;
  const rows = section.filter((l) => rowRe.test(l));
  assert.equal(rows.length, 12, "exactly 12 target rows");
  const bandOf = (L) => (L <= 4 ? "Filter" : L <= 8 ? "Wall" : "Breakaway");
  rows.forEach((line, i) => {
    const t = TARGET_SURVIVAL[i];
    const band = FOUR_BANDS.find((b) => t.floor >= b.min && t.floor <= b.max).name;
    assert.equal(band, bandOf(t.floor));
    assert.equal(line, `| ${t.floor} | ${t.pL.toFixed(1)} % | ${t.SL.toFixed(1)} % | Ruling C floor ${2 * t.floor} | ${band} |`);
  });

  const constLines = [
    `- \`P50_DEATH_BAND\`: [${P50_DEATH_BAND.join(", ")}]`,
    `- \`FILTER_SHAPE.maxDrop\`: ${FILTER_SHAPE.maxDrop}`,
    `- \`FILTER_SHAPE.minRise\`: ${FILTER_SHAPE.minRise}`,
    `- \`TAIL_TARGETS.guard.freshP50Death\`: [${TAIL_TARGETS.guard.freshP50Death.join(", ")}]`,
  ];
  for (const c of constLines) assert.ok(section.includes(c), `the section carries the line: ${c}`);
});
