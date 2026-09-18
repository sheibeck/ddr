// test/unit/tapStep.test.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 (MAP-02) — direct unit coverage
// for src/browser/tapStep.js: resolveStep's dominant-axis-then-fallback
// direction resolution (incl. ties, out-of-grid, both-blocked) and
// inspectCell's four hold-inspect cards.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import url from "node:url";

import { DIR_VECTORS, TAP_MAX_TRAVEL_PX, HOLD_MS, resolveStep, inspectCell } from "../../src/browser/tapStep.js";
import { RAIL_COPY, RAIL_HOLD } from "../../src/browser/rail.js";

// ─── constants ──────────────────────────────────────────────────────────────

test("constants: DIR_VECTORS covers the four cardinal directions; TAP_MAX_TRAVEL_PX and HOLD_MS are the spec'd values", () => {
  assert.deepEqual(Object.keys(DIR_VECTORS).sort(), ["E", "N", "S", "W"]);
  assert.deepEqual(DIR_VECTORS.N, [0, -1]);
  assert.deepEqual(DIR_VECTORS.S, [0, 1]);
  assert.deepEqual(DIR_VECTORS.E, [1, 0]);
  assert.deepEqual(DIR_VECTORS.W, [-1, 0]);
  assert.equal(TAP_MAX_TRAVEL_PX, 10);
  assert.equal(HOLD_MS, 450);
});

// ─── resolveStep: here ──────────────────────────────────────────────────────

test("resolveStep: tapping the party's own square is 'here'", () => {
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 5, y: 5 }, () => true), { kind: "here" });
});

// ─── resolveStep: dominant axis per direction ──────────────────────────────

test("resolveStep: dominant axis resolves the correct direction for a distant tap in every direction", () => {
  const open = () => true;
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 9, y: 6 }, open), { kind: "step", dir: "E" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 5, y: 1 }, open), { kind: "step", dir: "N" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 4, y: 9 }, open), { kind: "step", dir: "S" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 1, y: 5 }, open), { kind: "step", dir: "W" });
});

// ─── resolveStep: ties prefer the horizontal axis ──────────────────────────

test("resolveStep: a |dx|===|dy| tie prefers the horizontal (x) axis", () => {
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 8, y: 8 }, () => true), { kind: "step", dir: "E" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 2, y: 2 }, () => true), { kind: "step", dir: "W" });
});

// ─── resolveStep: fallback axis when the dominant candidate is blocked ────

test("resolveStep: falls back to the other axis when the dominant-axis candidate is blocked", () => {
  const isOpen = (x, y) => !(x === 6 && y === 5); // E-candidate (6,5) blocked, S-candidate (5,6) open
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 9, y: 6 }, isOpen), { kind: "step", dir: "S" });
});

// ─── resolveStep: blocked (both candidates fail) ───────────────────────────

test("resolveStep: blocked when both the dominant and fallback candidates fail", () => {
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 9, y: 6 }, () => false), { kind: "blocked" });
});

// ─── resolveStep: no fallback axis when the other delta is zero ───────────

test("resolveStep: blocked (no fallback) when the dominant candidate fails and the other axis has zero delta", () => {
  const isOpen = (x, y) => !(x === 6 && y === 5);
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 9, y: 5 }, isOpen), { kind: "blocked" });
});

// ─── resolveStep: never throws on bad input ────────────────────────────────

test("resolveStep: NaN/undefined pos or target never throws and always resolves to blocked", () => {
  assert.deepEqual(resolveStep({ x: NaN, y: 5 }, { x: 9, y: 6 }, () => true), { kind: "blocked" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: undefined, y: 6 }, () => true), { kind: "blocked" });
  assert.deepEqual(resolveStep(undefined, { x: 9, y: 6 }, () => true), { kind: "blocked" });
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, undefined, () => true), { kind: "blocked" });
});

// ─── resolveStep: a non-function isOpen never throws, resolves blocked ────

test("resolveStep: a non-function isOpen defends to always-closed, never throws", () => {
  assert.deepEqual(resolveStep({ x: 5, y: 5 }, { x: 9, y: 6 }, undefined), { kind: "blocked" });
});

// ─── inspectCell: the four cards ───────────────────────────────────────────

const legend = { name: "TRAP", desc: "A d6 out of you, before you knew it was there." };
const legendFor = (feat) => (feat === "trap" ? legend : null);

test("inspectCell: a null/undefined cell is SOLID ROCK", () => {
  assert.deepEqual(inspectCell(null, legendFor), {
    title: RAIL_COPY.rock.title,
    line: RAIL_COPY.rock.line,
    tone: "dull",
    hold: RAIL_HOLD.dull,
  });
  assert.deepEqual(inspectCell(undefined, legendFor), inspectCell(null, legendFor));
});

test("inspectCell: an unseen cell is UNWALKED — checked before the wall test so fog never reveals rock", () => {
  assert.deepEqual(inspectCell({ seen: false }, legendFor), {
    title: RAIL_COPY.unwalked.title,
    line: RAIL_COPY.unwalked.line,
    tone: "dull",
    hold: RAIL_HOLD.dull,
  });
  assert.deepEqual(inspectCell({ seen: false, wall: true }, legendFor).title, RAIL_COPY.unwalked.title, "unseen beats wall");
});

test("inspectCell: a seen wall is SOLID ROCK", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: true }, legendFor), {
    title: RAIL_COPY.rock.title,
    line: RAIL_COPY.rock.line,
    tone: "dull",
    hold: RAIL_HOLD.dull,
  });
});

test("inspectCell: a seen, non-wall cell with a legend-mapped feat shows the mark's legend row (tone odd, RAIL_HOLD.mark)", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: false, feat: "trap" }, legendFor), {
    title: "TRAP",
    line: legend.desc,
    tone: "odd",
    hold: RAIL_HOLD.mark,
  });
});

test("inspectCell: a seen, non-wall, featureless cell is EMPTY CORRIDOR", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: false, feat: null }, legendFor), {
    title: RAIL_COPY.empty.title,
    line: RAIL_COPY.empty.line,
    tone: "dull",
    hold: RAIL_HOLD.dull,
  });
});

test("inspectCell: a seen, non-wall cell with an unrecognized feat (no legend row) falls back to EMPTY CORRIDOR", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: false, feat: "not-a-real-feat" }, legendFor).title, RAIL_COPY.empty.title);
});

// ─── inspectCell: water (Phase 41, TERR-01/02, Plan 04) ────────────────────

test("inspectCell: a seen, non-wall, feat-less water cell shows the WATER row (tone odd, RAIL_HOLD.mark)", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: false, feat: null, water: true }, legendFor), {
    title: RAIL_COPY.water.title,
    line: RAIL_COPY.water.line,
    tone: "odd",
    hold: RAIL_HOLD.mark,
  });
});

test("inspectCell: an unseen water cell still returns the UNWALKED row (fog never reveals water)", () => {
  assert.deepEqual(inspectCell({ seen: false, water: true }, legendFor).title, RAIL_COPY.unwalked.title);
});

test("inspectCell: a water cell that also carries a feat returns the feat's own legend row (the feat branch stays first)", () => {
  assert.deepEqual(inspectCell({ seen: true, wall: false, feat: "trap", water: true }, legendFor), {
    title: "TRAP",
    line: legend.desc,
    tone: "odd",
    hold: RAIL_HOLD.mark,
  });
});

// ─── purity ─────────────────────────────────────────────────────────────────

test("tapStep.js is pure: no window/document/Date.now/localStorage/setTimeout/innerHTML/Math.random in live code", () => {
  const src = url.fileURLToPath(new URL("../../src/browser/tapStep.js", import.meta.url));
  const raw = fs.readFileSync(src, "utf8");
  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const text = noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  for (const needle of ["window.", "document.", "Date.now", "localStorage", "setTimeout", "innerHTML", "Math.random"]) {
    assert.doesNotMatch(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must not appear in tapStep.js`);
  }
});
