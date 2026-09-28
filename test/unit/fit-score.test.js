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
  CLASS_CONSTRAINT_EXEMPT,
} from "../../tools/lib/fit-score.mjs";
import { DIALS } from "../../engine/difficulty.js";

// Phase 79.2 (user ruling 2026-09-27): the target S_L curve for floors 1-12
// is USER RULING C's floor 2L (the same numbers fit-score.mjs's own
// EARLY_TARGET_S holds — this is an independent paste, not an import, so a
// drift between the two would fail this test rather than hide behind a
// shared constant). Was Ruling C's floors 1-12.
const TARGET_S_1_12 = [95.1, 79.7, 58.4, 38.7, 24.3, 15.1, 9.5, 6.2, 4.2, 3.0, 2.2, 1.7];
// Phase 79.2 (user ruling 2026-09-27): the target's own p_L, so the
// on-target survival also passes the Filter-shape gate (a flat pL 90 would
// now fail it as "flat"), and p50Death 4 sits inside P50_DEATH_BAND [3, 4].
const TARGET_P_1_12 = [95.1, 83.8, 73.3, 66.3, 62.8, 62.1, 62.9, 65.3, 67.7, 71.4, 73.3, 77.3];

function onTargetSurvival() {
  return { reach20: 4.0, p50Death: 4, floors: TARGET_S_1_12.map((SL, i) => ({ floor: i + 1, pL: TARGET_P_1_12[i], SL })) };
}

// --- SEARCH_PLAN / HELD_DIALS ------------------------------------------

// Phase 79.2 (user ruling 2026-09-27): the same 9 coordinates with the same
// Phase 54 steps and bounds, re-ordered so the early-weighted base levers
// are walked first and the two depth slopes last.
test("SEARCH_PLAN is exactly the core 9 in the Phase 79.2 order (early-weighted base levers first, depth slopes last; user ruling 2026-09-27 removed HERO_REGEN_PER_FLOOR), with pinned Phase 54 steps/bounds (USER RULING G, cycle 3: the Ruling F spellPower coordinate is dropped again — proved a structural no-op in cycle 2)", () => {
  const expected = [
    ["FOE_HIT_SCALE.base", 0.08, 0.4, 1.0],
    ["FOE_LEVEL.base", 0.15, 0.3, 1.0],
    ["HAZARD_SCALE.base", 0.1, 0.3, 1.0],
    ["FOE_HP_SCALE.base", 0.1, 0.5, 1.2],
    ["ENCOUNTER_DOTS.base", 1, 5, 10],
    ["HERO_HP_SCALE", 0.15, 1.0, 1.8],
    ["HERO_SP_SCALE", 0.05, 0.15, 0.6],
    ["FOE_HIT_SCALE.perDepth", 0.01, 0, 0.05],
    ["FOE_LEVEL.perDepth", 0.03, 0.12, 0.3],
  ];
  assert.equal(SEARCH_PLAN.length, 9);
  assert.equal(SEARCH_PLAN.some((c) => c.path[0] === "HERO_REGEN_PER_FLOOR"), false, "the regen coordinate left with its dial (user ruling 2026-09-27)");
  SEARCH_PLAN.forEach((coord, i) => {
    const [path, step, lo, hi] = expected[i];
    assert.equal(coord.path.join("."), path, `coordinate ${i}`);
    assert.equal(coord.step, step, `${path} step`);
    assert.equal(coord.lo, lo, `${path} lo`);
    assert.equal(coord.hi, hi, `${path} hi`);
  });
  assert.equal(SEARCH_PLAN.some((c) => c.path[0] === "CLASS_MITIGATION"), false, "spellPower is HELD in cycle 3, not searched");
});

test("HELD_DIALS names every DIALS key not in SEARCH_PLAN (no MAZE_SIZE — cut; no DOT_HP_FRACTION — retired, USER RULING G; CLASS_MITIGATION held at spellPower's identity value)", () => {
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

test("scoreSurvival: a synthetic survival exactly on the Phase 79.2 curve (p50Death 4) scores 0 and PASSes", () => {
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
  // Phase 79.2 (user ruling 2026-09-27): floor 1's target is 95.1 (was 98.8).
  assert.equal(floor1.term, Math.round((((0 - 95.1) ** 2) / 64) * 1e6) / 1e6);
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

test("classConstraints (USER RULING G, cycle 3): a Fighter p50 1.5 below pooled is now WITHIN the loosened 2.0-floor tolerance and does NOT reject", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 4.5, reach5: 50 }),
    classRow("Thief", { p50: 6, reach5: 50 }),
    classRow("Magic User", { p50: 6, reach5: 50 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, true, result.reasons.join(" | "));
});

test("classConstraints: rejects a Fighter p50 3 below pooled (beyond the loosened 2.0-floor tolerance)", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 3, reach5: 50 }),
    classRow("Thief", { p50: 6, reach5: 50 }),
    classRow("Magic User", { p50: 6, reach5: 50 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.startsWith("Fighter p50")), result.reasons.join(" | "));
});

test("classConstraints: reach5 tolerance is 20 points (a 15-point delta passes, a 25-point delta rejects)", () => {
  const passing = [
    classRow("Fighter", { p50: 5, reach5: 35 }),
    classRow("Thief", { p50: 5, reach5: 50 }),
    classRow("Magic User", { p50: 5, reach5: 50 }),
  ];
  assert.equal(classConstraints(passing).ok, true, classConstraints(passing).reasons.join(" | "));

  const rejecting = [
    classRow("Fighter", { p50: 5, reach5: 25 }),
    classRow("Thief", { p50: 5, reach5: 50 }),
    classRow("Magic User", { p50: 5, reach5: 50 }),
  ];
  const result = classConstraints(rejecting);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.startsWith("Fighter reach5")), result.reasons.join(" | "));
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

// USER RULING 2026-09-28 (Phase 79.2-02): "This is fine for now. Magic users
// require much more tactical play." The Magic User's breach is reported in
// `exempt`, never rejects; Fighter and Thief breaches still reject against
// the same pooled values (computed from all eligible classes, unchanged).
test("classConstraints (user ruling 2026-09-28): CLASS_CONSTRAINT_EXEMPT is exactly the Magic User", () => {
  assert.deepStrictEqual([...CLASS_CONSTRAINT_EXEMPT], ["Magic User"]);
});

test("classConstraints (user ruling 2026-09-28): a Magic-User-only p50 and reach5 breach now PASSES, reported as exempt", () => {
  const classIdentity = [
    classRow("Fighter", { p50: 6, reach5: 83.5 }),
    classRow("Thief", { p50: 7, reach5: 84.2 }),
    classRow("Magic User", { p50: 2, reach5: 49.3 }),
  ];
  const result = classConstraints(classIdentity);
  assert.equal(result.ok, true, result.reasons.join(" | "));
  assert.deepStrictEqual(result.reasons, []);
  assert.equal(result.pooledP50, 6, "pooled p50 is the median of all three classes, the Magic User included");
  assert.equal(result.pooledReach5, 83.5, "pooled reach5 is the median of all three classes, the Magic User included");
  assert.deepStrictEqual(result.exempt, [
    "Magic User p50 2 vs pooled 6 (|delta| > 2) — exempt",
    "Magic User reach5 49.3 vs pooled 83.5 (|delta| > 20) — exempt",
  ]);
  const row = evalRow(1, {}, { survival: { floors: [], reach20: 0 }, scored: { score: 1, verdict: "MISS", misses: [] }, classIdentity, constraints: result, pace: { floors: [] }, elapsedMs: 1 });
  assert.equal(row.score, 1, "an exempt breach never scores the row +Infinity");
  assert.equal("reason" in row, false);
  const line = formatEvalLine(row);
  assert.ok(line.includes("ok=true exempt=Magic User p50 2 vs pooled 6 (|delta| > 2) — exempt; Magic User reach5 49.3 vs pooled 83.5 (|delta| > 20) — exempt"), line);
});

test("classConstraints (user ruling 2026-09-28): a Fighter or a Thief breach still rejects while the Magic User is exempt", () => {
  const fighterBreach = classConstraints([
    classRow("Fighter", { p50: 5, reach5: 20 }),
    classRow("Thief", { p50: 5, reach5: 60 }),
    classRow("Magic User", { p50: 5, reach5: 50 }),
  ]);
  assert.equal(fighterBreach.ok, false);
  assert.deepStrictEqual(fighterBreach.reasons, ["Fighter reach5 20 vs pooled 50 (|delta| > 20)"]);
  assert.deepStrictEqual(fighterBreach.exempt, []);

  const thiefBreach = classConstraints([
    classRow("Fighter", { p50: 5, reach5: 50 }),
    classRow("Thief", { p50: 8, reach5: 50 }),
    classRow("Magic User", { p50: 2, reach5: 50 }),
  ]);
  assert.equal(thiefBreach.ok, false);
  assert.deepStrictEqual(thiefBreach.reasons, ["Thief p50 8 vs pooled 5 (|delta| > 2)"]);
  assert.deepStrictEqual(thiefBreach.exempt, ["Magic User p50 2 vs pooled 5 (|delta| > 2) — exempt"]);
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

test("applyStep on a 3-level path (CLASS_MITIGATION.Magic User.spellPower's own shape, held not searched in cycle 3 — USER RULING G) touches only that leaf", () => {
  // spellPower is HELD in cycle 3 (not in SEARCH_PLAN); this coord is built
  // inline, with the same step/bounds Ruling F's cycle-2 search used, purely
  // to exercise applyStep's generic 3-level-path handling.
  const coord = { path: ["CLASS_MITIGATION", "Magic User", "spellPower"], step: 0.15, lo: 1.0, hi: 2.0 };
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
  const coord = { path: ["CLASS_MITIGATION", "Magic User", "spellPower"], step: 0.15, lo: 1.0, hi: 2.0 };
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
    classRow("Fighter", { p50: 3 }),
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
