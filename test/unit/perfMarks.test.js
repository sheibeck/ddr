// test/unit/perfMarks.test.js
//
// Phase 49 (PERF-01) — direct unit coverage for the pure ring-buffer module
// src/browser/perfMarks.js (Task 1: module behaviour, injected samples, no
// clock/global reads) plus the dev-gated shell source pins for mazeworld.
// html's stepWith/mzDevStartAtDepth call sites and the #mw-dev-perf readout
// (Task 2, appended below the section marker).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  createPerfMarks,
  perfMarks,
  formatReadout,
  PERF_ROWS,
  PERF_RING_SIZE,
  PERF_LOG_EVERY,
} from "../../src/browser/perfMarks.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── module behaviour (Task 1) ──────────────────────────────────────────────

test("PERF-01: exports — createPerfMarks, perfMarks, formatReadout, PERF_ROWS, PERF_RING_SIZE, PERF_LOG_EVERY all present and of the expected type/value", () => {
  assert.equal(typeof createPerfMarks, "function");
  assert.equal(typeof formatReadout, "function");
  assert.equal(typeof perfMarks, "object");
  assert.equal(typeof perfMarks.record, "function");
  assert.equal(typeof perfMarks.summary, "function");
  assert.equal(typeof perfMarks.reset, "function");
  assert.deepEqual(PERF_ROWS, ["step", "dispatch", "paint", "draw"]);
  assert.ok(Object.isFrozen(PERF_ROWS));
  assert.equal(PERF_RING_SIZE, 100);
  assert.equal(PERF_LOG_EVERY, 10);
});

test("PERF-01: record 1..100 into step -> summary().step deep-equals nearest-rank median/p95/max", () => {
  const p = createPerfMarks();
  for (let i = 1; i <= 100; i++) p.record("step", i);
  assert.deepEqual(p.summary().step, { n: 100, total: 100, median: 50, p95: 95, max: 100 });
});

test("PERF-01: record 1..150 into step (ring cap 100) -> oldest 50 dropped, total still counts them", () => {
  const p = createPerfMarks();
  for (let i = 1; i <= 150; i++) p.record("step", i);
  assert.deepEqual(p.summary().step, { n: 100, total: 150, median: 100, p95: 145, max: 150 });
});

test("PERF-01: a single sample 7.25 -> n=1, total=1, median=p95=max=7.25", () => {
  const p = createPerfMarks();
  p.record("step", 7.25);
  assert.deepEqual(p.summary().step, { n: 1, total: 1, median: 7.25, p95: 7.25, max: 7.25 });
});

test("PERF-01: invalid record() calls (NaN, Infinity, -1, undefined, empty row, non-string row) record nothing", () => {
  const p = createPerfMarks();
  p.record("step", NaN);
  p.record("step", Infinity);
  p.record("step", -1);
  p.record("step", undefined);
  p.record("", 3);
  p.record(42, 3);
  assert.deepEqual(p.summary(), {});
});

test("PERF-01: rows come back from summary() in PERF_ROWS order regardless of record order; a never-recorded row is absent; an unknown row is listed after the known rows", () => {
  const p = createPerfMarks();
  p.record("draw", 1);
  p.record("paint", 2);
  p.record("dispatch", 3);
  p.record("step", 4);
  p.record("oracle", 5);
  assert.deepEqual(Object.keys(p.summary()), ["step", "dispatch", "paint", "draw", "oracle"]);
});

test("PERF-01: createPerfMarks(3) caps at n=3 with total=5 after 5 records; two instances are independent", () => {
  const p = createPerfMarks(3);
  for (let i = 1; i <= 5; i++) p.record("step", i);
  assert.equal(p.summary().step.n, 3);
  assert.equal(p.summary().step.total, 5);

  const a = createPerfMarks();
  const b = createPerfMarks();
  a.record("step", 1);
  assert.deepEqual(b.summary(), {});
});

test("PERF-01: reset() clears the ring — summary() is {} and a following record starts total at 1 again", () => {
  const p = createPerfMarks();
  p.record("step", 1);
  p.record("step", 2);
  p.reset();
  assert.deepEqual(p.summary(), {});
  p.record("step", 9);
  assert.equal(p.summary().step.total, 1);
});

test("PERF-01: formatReadout renders the exact wording, toFixed(1) rounding, and \"\" for an empty summary; n= reflects step (or the first listed row when step is absent)", () => {
  const full = formatReadout({
    step: { n: 57, total: 57, median: 7.4, p95: 12.1, max: 30.2 },
    dispatch: { n: 57, total: 57, median: 1.1, p95: 2.0, max: 4.0 },
    paint: { n: 57, total: 57, median: 3.2, p95: 6.0, max: 9.9 },
    draw: { n: 57, total: 57, median: 1.9, p95: 4.3, max: 7.7 },
  });
  assert.equal(
    full,
    "step 7.4 / 12.1 / 30.2 · dispatch 1.1 / 2.0 / 4.0 · paint 3.2 / 6.0 / 9.9 · draw 1.9 / 4.3 / 7.7 ms (med / p95 / max, n=57)",
  );
  assert.equal(formatReadout({}), "");
  const roundUp = formatReadout({ step: { n: 1, total: 1, median: 7, p95: 7.25, max: 7 } });
  assert.equal(roundUp, "step 7.0 / 7.3 / 7.0 ms (med / p95 / max, n=1)");
  const noStep = formatReadout({ dispatch: { n: 12, total: 12, median: 1, p95: 2, max: 3 } });
  assert.equal(noStep, "dispatch 1.0 / 2.0 / 3.0 ms (med / p95 / max, n=12)");
});

test("PERF-01: purity — src/browser/perfMarks.js reads no window/document/performance/globalThis/console global and has no import statement", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "perfMarks.js"), "utf8");
  const stripped = stripJs(src);
  assert.equal(/\b(window|document|performance|globalThis|console)\b/.test(stripped), false);
  assert.equal(/^import /m.test(stripped), false);
});

// ─── shell pins (Task 2) ───
