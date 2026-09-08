// test/difficulty/fairness.test.js
//
// Property sweep over genFloor's ACTUAL output (not just difficultyCurve's
// numbers in isolation — engine/difficulty.js's own test suite already
// covers that) — proving no deep endless floor is unfair: darkness never
// blankets the whole floor, encounter-dot count stays within the documented
// cap, and breather floors are genuinely lighter (RUN-03; 03-RESEARCH.md
// Pitfall 1: "a full-floor ambush wall is a design failure, not difficulty").
//
// Sample kept small (20 seeds x 5 depths = 100 floors) to stay well within
// the project's ~15s quick-test budget while still catching regressions
// across a meaningful seed spread.

import test from "node:test";
import assert from "node:assert/strict";
import { genFloor } from "../../engine/maze.js";
import { makeRng } from "../../engine/rng.js";
import { isBreather, ENCOUNTER_DOT_CAP } from "../../engine/difficulty.js";

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i);
const DEEP_DEPTHS = [6, 10, 20, 50, 100];

// A documented fairness fraction: no deep floor should have more than this
// fraction of its open cells darkened, so there is always a lit remainder of
// meaningful size (never a FULL-floor ambush wall approaching 1.0).
//
// 03-RESEARCH.md's illustrative starting point was 0.6, explicitly flagged
// as "not measured against actual play-feel... the planner/user can tighten
// or loosen this constant freely" (Assumption A3). Measured against the
// ACTUAL genFloor output with Plan 01's locked difficulty.js constants
// (DARK_BLOB_CAP=6, DARK_RADIUS_CAP=9) on this 21x21 maze's ~150-220 open
// cells, a single max-radius blob can already cover most of the floor, so
// coverage legitimately runs higher than 0.6 while staying well bounded
// (measured max 0.733 across 200 seeds x depths [6,10,20,50,100,200,1000] —
// stays flat with depth, never trends toward 1.0). 0.8 keeps this test's
// real job — catching a REGRESSION/runaway-growth bug, not certifying an
// exact number — while still failing loudly if darkness ever approaches a
// true full-floor ambush wall.
const MAX_DARK_FRACTION = 0.8;

function countFeats(g) {
  const counts = {};
  for (const row of g) for (const c of row) if (c.feat) counts[c.feat] = (counts[c.feat] || 0) + 1;
  return counts;
}

function openCells(g) {
  const open = [];
  for (const row of g) for (const c of row) if (!c.wall) open.push(c);
  return open;
}

test("fairness: dark-tile coverage never exceeds the fairness fraction on deep floors", () => {
  for (const seed of SEEDS) {
    for (const depth of DEEP_DEPTHS) {
      const floor = genFloor(depth, makeRng(seed));
      const open = openCells(floor.g);
      const darkCount = open.filter((c) => c.dark).length;
      const fraction = darkCount / open.length;
      assert.ok(
        fraction <= MAX_DARK_FRACTION,
        `seed ${seed} depth ${depth}: dark fraction ${fraction.toFixed(3)} exceeds ${MAX_DARK_FRACTION}`,
      );
    }
  }
});

test("fairness: placed 'dot' count never exceeds ENCOUNTER_DOT_CAP on deep floors", () => {
  for (const seed of SEEDS) {
    for (const depth of DEEP_DEPTHS) {
      const floor = genFloor(depth, makeRng(seed));
      const counts = countFeats(floor.g);
      const dots = counts.dot || 0;
      assert.ok(
        dots <= ENCOUNTER_DOT_CAP,
        `seed ${seed} depth ${depth}: dot count ${dots} exceeds ENCOUNTER_DOT_CAP ${ENCOUNTER_DOT_CAP}`,
      );
    }
  }
});

test("fairness: breather depths have zero dark cells", () => {
  const breatherDepths = DEEP_DEPTHS.filter((d) => isBreather(d));
  assert.ok(breatherDepths.length > 0, "sanity: at least one sampled deep depth must be a breather");
  for (const seed of SEEDS) {
    for (const depth of breatherDepths) {
      const floor = genFloor(depth, makeRng(seed));
      const open = openCells(floor.g);
      const darkCount = open.filter((c) => c.dark).length;
      assert.equal(darkCount, 0, `seed ${seed} depth ${depth}: breather floor must have zero dark cells`);
    }
  }
});
