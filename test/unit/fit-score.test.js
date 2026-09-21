// test/unit/fit-score.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — direct, engine-free unit
// coverage for tools/lib/fit-score.mjs: scoreSurvival, classConstraints,
// SEARCH_PLAN, applyStep, evalRow/formatEvalLine. Every synthetic `survival`/
// `classIdentity` object below is hand-built to exercise one arithmetic path
// at a time (this file never imports the engine or the bot — fit-score.mjs
// itself doesn't, and neither does its test).

import test from "node:test";
import assert from "node:assert/strict";

import {
  SEARCH_PLAN,
  HELD_DIALS,
  scoreSurvival,
  classConstraints,
  applyStep,
  evalRow,
  formatEvalLine,
  CLASS_POOL_MIN_N,
} from "../../tools/lib/fit-score.mjs";
import { DIALS } from "../../engine/difficulty.js";

// The Ruling C target S_L curve for floors 1-12, transcribed from
// 54-CONTEXT.md (the same numbers fit-score.mjs's own TARGET_S_1_25 holds
// internally — this is an independent paste, not an import, so a drift
// between the two would fail this test rather than hide behind a shared
// constant).
const TARGET_S_1_12 = [98.8, 95.1, 88.6, 79.7, 69.2, 58.4, 48.0, 38.7, 30.8, 24.3, 19.1, 15.1];

function onTargetSurvival() {
  return { reach20: 4.0, floors: TARGET_S_1_12.map((SL, i) => ({ floor: i + 1, pL: 90, SL })) };
}

// --- SEARCH_PLAN / HELD_DIALS ------------------------------------------

test("SEARCH_PLAN has Ruling F Adjustment 1b's coordinate (CLASS_MITIGATION Magic User spellPower) FIRST, then the core 10, in order, with pinned steps/bounds", () => {
  const expected = [
    ["CLASS_MITIGATION.Magic User.spellPower", 0.15, 1.0, 2.0],
    ["FOE_LEVEL.perDepth", 0.03, 0.12, 0.3],
    ["FOE_LEVEL.base", 0.15, 0.3, 1.0],
    ["HERO_SP_SCALE", 0.05, 0.15, 0.6],
    ["FOE_HIT_SCALE.base", 0.08, 0.4, 1.0],
    ["FOE_HIT_SCALE.perDepth", 0.01, 0, 0.05],
    ["FOE_HP_SCALE.base", 0.1, 0.5, 1.2],
    ["HERO_HP_SCALE", 0.15, 1.0, 1.8],
    ["HERO_REGEN_PER_FLOOR", 0.1, 0, 0.5],
    ["HAZARD_SCALE.base", 0.1, 0.3, 1.0],
    ["ENCOUNTER_DOTS.base", 1, 5, 10],
  ];
  assert.equal(SEARCH_PLAN.length, 11);
  SEARCH_PLAN.forEach((coord, i) => {
    const [path, step, lo, hi] = expected[i];
    assert.equal(coord.path.join("."), path, `coordinate ${i}`);
    assert.equal(coord.step, step, `${path} step`);
    assert.equal(coord.lo, lo, `${path} lo`);
    assert.equal(coord.hi, hi, `${path} hi`);
  });
});

test("HELD_DIALS names every DIALS key not in SEARCH_PLAN (no MAZE_SIZE — cut; no standalone CLASS_MITIGATION row post-Ruling-F)", () => {
  const searchKeys = new Set(SEARCH_PLAN.map((c) => c.path[0]));
  const heldKeys = new Set(HELD_DIALS.map((c) => c.path[0]));
  for (const key of Object.keys(DIALS)) {
    assert.ok(searchKeys.has(key) || heldKeys.has(key), `${key} must be in SEARCH_PLAN or HELD_DIALS`);
  }
  assert.equal("MAZE_SIZE" in DIALS, false);
  assert.equal(heldKeys.has("MAZE_SIZE"), false);
  // Every HELD_DIALS row's path actually resolves against DIALS.
  for (const coord of HELD_DIALS) {
    let node = DIALS;
    for (const key of coord.path) {
      assert.ok(key in node, `${coord.path.join(".")} must resolve against DIALS`);
      node = node[key];
    }
  }
});

// --- scoreSurvival --------------------------------------------------------

test("scoreSurvival: a synthetic survival exactly on the Ruling C curve scores 0 and PASSes", () => {
  const result = scoreSurvival(onTargetSurvival());
  assert.equal(result.score, 0);
  assert.equal(result.verdict, "PASS");
  assert.deepStrictEqual(result.misses, []);
  assert.equal(result.terms.length, 12);
  assert.ok(result.terms.every((t) => t.term === 0));
});

test("scoreSurvival: S_5 off by 8 (shallow tolerance) adds exactly 1.0", () => {
  const survival = onTargetSurvival();
  const floor5 = survival.floors.find((f) => f.floor === 5);
  floor5.SL = floor5.SL + 8;
  const result = scoreSurvival(survival);
  assert.equal(result.score, 1);
});

test("scoreSurvival: S_12 off by 3 (deep tolerance) adds exactly 1.0", () => {
  const survival = onTargetSurvival();
  const floor12 = survival.floors.find((f) => f.floor === 12);
  floor12.SL = floor12.SL + 3;
  const result = scoreSurvival(survival);
  assert.equal(result.score, 1);
});

test("scoreSurvival: S_15 off by 30 and reach20 0 add NOTHING to the score (tail, informational) and do not flip the verdict", () => {
  const survival = onTargetSurvival();
  survival.floors.push({ floor: 15, pL: 50, SL: 999 }); // wildly off target, but floor 15 is tail
  survival.reach20 = 0;
  const result = scoreSurvival(survival);
  assert.equal(result.score, 0);
  assert.equal(result.verdict, "PASS");
  const tailFloor15 = result.tail.find((t) => t.floor === 15);
  assert.ok(tailFloor15, "floor 15 is reported in the tail block");
  assert.equal(tailFloor15.SL, 999);
});

test("scoreSurvival: a null (never-reached) S_L counts as 0", () => {
  const survival = { reach20: 0, floors: [] }; // no floor was ever reached
  const result = scoreSurvival(survival);
  const floor1 = result.terms.find((t) => t.floor === 1);
  assert.equal(floor1.SL, 0);
  assert.equal(floor1.term, Math.round((((0 - 98.8) ** 2) / 64) * 1e6) / 1e6);
  assert.equal(result.verdict, "MISS");
  assert.ok(result.misses.length > 0);
});

// --- classConstraints ------------------------------------------------------

function classRow(cls, overrides = {}) {
  return {
    cls,
    n: CLASS_POOL_MIN_N,
    p50: 5,
    reach5: 50,
    reach10: 20,
    dmgTakenPerFight: 5,
    roundsPerFight: 2,
    ...overrides,
  };
}

test("classConstraints: rejects a Fighter p50 1.5 below pooled", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 4.5, reach5: 50 }),
    classRow("Thief", { p50: 6, reach5: 50 }),
    classRow("Magic User", { p50: 6, reach5: 50 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.startsWith("Fighter p50")), result.reasons.join(" | "));
});

test("classConstraints: rejects Thief roundsPerFight > Fighter's", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 5, reach5: 50, dmgTakenPerFight: 6, roundsPerFight: 2 }),
    classRow("Thief", { p50: 5, reach5: 50, dmgTakenPerFight: 3, roundsPerFight: 3 }),
    classRow("Magic User", { p50: 5, reach5: 50, dmgTakenPerFight: 4, roundsPerFight: 2 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes("roundsPerFight")), result.reasons.join(" | "));
});

test("classConstraints: a pool with n < 20 is unconstrained (ok stays true, a reason is recorded)", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 5, reach5: 50, dmgTakenPerFight: 6, roundsPerFight: 2 }),
    classRow("Thief", { p50: 5, reach5: 50, dmgTakenPerFight: 3, roundsPerFight: 2 }),
    classRow("Magic User", { n: 5, p50: 99, reach5: 0, dmgTakenPerFight: 0, roundsPerFight: 0 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, true);
  assert.ok(result.reasons.some((r) => r === "Magic User n<20 — unconstrained"));
});

// --- applyStep ---------------------------------------------------------

test("applyStep clamps, steps ENCOUNTER_DOTS.base by 1, halves the step at stepScale 0.5, returns null at a bound, and never touches a key outside SEARCH_PLAN", () => {
  const coord = SEARCH_PLAN.find((c) => c.path.join(".") === "ENCOUNTER_DOTS.base");
  const dials = JSON.parse(JSON.stringify(DIALS));
  dials.ENCOUNTER_DOTS.base = 7;

  const up = applyStep(dials, coord, 1);
  assert.equal(up.ENCOUNTER_DOTS.base, 8);
  assert.equal(dials.ENCOUNTER_DOTS.base, 7, "the input is never mutated");

  const half = applyStep(dials, coord, 1, 0.5);
  assert.equal(half.ENCOUNTER_DOTS.base, 7.5);

  dials.ENCOUNTER_DOTS.base = coord.hi;
  const atBound = applyStep(dials, coord, 1);
  assert.equal(atBound, null, "a step past the bound clamps to the SAME value -> null");

  // never touches a key outside SEARCH_PLAN
  const before = JSON.stringify(dials);
  applyStep(dials, coord, 1);
  assert.equal(JSON.stringify(dials), before);
  const movedDials = applyStep({ ...DIALS, ENCOUNTER_DOTS: { base: 7, perDepth: 0.3 } }, coord, 1);
  assert.equal(movedDials.LOOT_SCALE, DIALS.LOOT_SCALE, "every other dial is carried through untouched");
});

test("applyStep on the 3-level CLASS_MITIGATION.Magic User.spellPower coordinate (Ruling F Adjustment 1) touches only that leaf", () => {
  const coord = SEARCH_PLAN.find((c) => c.path.join(".") === "CLASS_MITIGATION.Magic User.spellPower");
  assert.ok(coord, "the spellPower coordinate must exist");
  const dials = JSON.parse(JSON.stringify(DIALS));

  const up = applyStep(dials, coord, 1);
  assert.equal(up.CLASS_MITIGATION["Magic User"].spellPower, 1.15);
  // Sibling rows (Fighter, Thief) and the sibling Magic User shape survive untouched.
  assert.deepStrictEqual(up.CLASS_MITIGATION.Fighter, DIALS.CLASS_MITIGATION.Fighter);
  assert.deepStrictEqual(up.CLASS_MITIGATION.Thief, DIALS.CLASS_MITIGATION.Thief);
  assert.equal(dials.CLASS_MITIGATION["Magic User"].spellPower, 1, "the input is never mutated");

  // dir=-1 at the identity lo bound (1.0) clamps to the same value -> null.
  const atLoBound = applyStep(dials, coord, -1);
  assert.equal(atLoBound, null, "spellPower's lo bound is the identity value 1.0");

  // The clamp at hi (2.0) also returns null once reached.
  dials.CLASS_MITIGATION["Magic User"].spellPower = coord.hi;
  const atHiBound = applyStep(dials, coord, 1);
  assert.equal(atHiBound, null);
});

test("setDialsForTuning correctly applies a full-candidate CLASS_MITIGATION override produced by applyStep's 3-level path (the search's own worker contract)", async () => {
  const { setDialsForTuning, spellPowerFor } = await import("../../engine/difficulty.js");
  const coord = SEARCH_PLAN.find((c) => c.path.join(".") === "CLASS_MITIGATION.Magic User.spellPower");
  const candidate = applyStep(JSON.parse(JSON.stringify(DIALS)), coord, 1);
  const restore = setDialsForTuning(candidate);
  try {
    assert.equal(spellPowerFor({ cls: "Magic User" }), 1.15, "the fitted spellPower value is live");
    assert.equal(spellPowerFor({ cls: "Fighter" }), 1, "a non-MU class is unaffected");
  } finally {
    restore();
  }
  assert.equal(spellPowerFor({ cls: "Magic User" }), 1, "restore() puts live back to identity");
});

// --- evalRow / formatEvalLine ---------------------------------------------

test("evalRow/formatEvalLine shape (tail flag on floors >= 13); formatEvalLine begins '#n score='", () => {
  const survival = onTargetSurvival();
  const scored = scoreSurvival(survival);
  const classIdentity = [
    classRow("Fighter", { p50: 5 }),
    classRow("Thief", { p50: 5 }),
    classRow("Magic User", { p50: 5 }),
  ];
  const constraints = classConstraints(classIdentity);
  const pace = { floors: [{ floor: 1, meanLevel: 1, meanGold: 50, meanMaxWP: 41.67 }] };
  const row = evalRow(1, DIALS, { survival, scored, classIdentity, constraints, pace, elapsedMs: 123, walkPass: 1 });

  assert.equal(row.n, 1);
  assert.equal(row.pass, 1);
  assert.equal(row.score, 0);
  assert.equal(row.verdict, "PASS");
  assert.equal(row.floors.length, 20);
  assert.equal(row.floors.find((f) => f.L === 12).tail, false);
  assert.equal(row.floors.find((f) => f.L === 13).tail, true);
  assert.equal(row.floors.find((f) => f.L === 20).tail, true);
  assert.equal(row.pace.length, 1);
  assert.equal(row.pace[0].L, 1);

  const line = formatEvalLine(row);
  assert.ok(line.startsWith("#1 score="), line);
  assert.ok(!line.includes("reason="), "a non-rejected row carries no reason=");
});

test("evalRow: a constraint-rejected candidate scores +Infinity, verdict MISS, and carries a reason", () => {
  const survival = onTargetSurvival();
  const scored = scoreSurvival(survival);
  const classIdentity = [
    classRow("Fighter", { p50: 4.5 }),
    classRow("Thief", { p50: 6 }),
    classRow("Magic User", { p50: 6 }),
  ];
  const constraints = classConstraints(classIdentity);
  assert.equal(constraints.ok, false, "fixture assumption: this class spread violates a constraint");
  const row = evalRow(2, DIALS, { survival, scored, classIdentity, constraints, pace: { floors: [] }, elapsedMs: 1 });
  assert.equal(row.score, Infinity);
  assert.equal(row.verdict, "MISS");
  assert.ok(typeof row.reason === "string" && row.reason.length > 0);
  const line = formatEvalLine(row);
  assert.ok(line.startsWith("#2 score=+Infinity"), line);
  assert.ok(line.includes("reason="), line);
});
