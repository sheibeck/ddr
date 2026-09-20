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
//
// mazeworld.html has no module surface a test could import directly, so —
// mirroring test/unit/shell-input-guards.test.js's own source-assertion
// pattern (copied below so this file stays self-contained like every other
// shell pin file) — these tests read the real shipped source with
// fs.readFileSync and assert against it directly.

const __shellDirname = path.dirname(url.fileURLToPath(import.meta.url));
const SHELL_REPO_ROOT = path.resolve(__shellDirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(SHELL_REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const CODE = stripComments(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

const MODULE_START = HTML.indexOf('<script type="module">');
const MODULE = HTML.slice(MODULE_START);
const CLASSIC = HTML.slice(0, MODULE_START);
const MODULE_CODE = stripComments(MODULE);
const CLASSIC_CODE = stripComments(CLASSIC);

const STEP_WITH_REGION = sliceBetween(CODE, "function stepWith(action) {", "function stepNow(dir) {");
const DEV_START_REGION = sliceBetween(
  CODE,
  'window.mzDevStartAtDepth = async function devStartAtDepth(depth) {',
  "\n  };",
);

test("PERF-01 (shell pin): exactly one import of perfMarks/formatReadout/PERF_LOG_EVERY from ./src/browser/perfMarks.js", () => {
  const hits = CODE.match(/import \{ perfMarks, formatReadout, PERF_LOG_EVERY \} from "\.\/src\/browser\/perfMarks\.js";/g) || [];
  assert.equal(hits.length, 1);
});

test("PERF-01 (shell pin): every performance.now( line is dev-gated (perf ? or if (perf)); exactly 7 such lines, stripped and raw; no comment spells the clock call", () => {
  const strippedLines = CODE.split("\n").filter((l) => l.includes("performance.now("));
  assert.equal(strippedLines.length, 7);
  for (const line of strippedLines) {
    assert.ok(line.includes("perf ? ") || line.includes("if (perf)"), `not dev-gated: ${line}`);
  }
  const rawLines = HTML.split("\n").filter((l) => l.includes("performance.now"));
  assert.equal(rawLines.length, 7);
});

test("PERF-01 (shell pin): the const perf = line gates on .dev ? perfMarks : null", () => {
  assert.match(STEP_WITH_REGION, /const perf = window\.__mzState\.get\(\)\?\.dev \? perfMarks : null;/);
});

test("PERF-01 (shell pin): stepWith records dispatch/paint/draw/step exactly once each and calls perfReadout(perf) once; file-wide perf.record( occurs exactly 4 times", () => {
  for (const row of ["dispatch", "paint", "draw", "step"]) {
    const hits = STEP_WITH_REGION.match(new RegExp(`perf\\.record\\("${row}",`, "g")) || [];
    assert.equal(hits.length, 1, `expected exactly one perf.record("${row}", in stepWith`);
  }
  const readoutHits = STEP_WITH_REGION.match(/perfReadout\(perf\)/g) || [];
  assert.equal(readoutHits.length, 1);
  const fileWideRecordHits = CODE.match(/perf\.record\(/g) || [];
  assert.equal(fileWideRecordHits.length, 4);
});

test("PERF-01 (shell pin): the marks bracket the right calls, by index order", () => {
  const idx = (needle) => {
    const i = STEP_WITH_REGION.indexOf(needle);
    assert.ok(i !== -1, `not found: ${needle}`);
    return i;
  };
  const tStep = idx("const tStep");
  const dispatchCall = idx("dispatchWithNarration(action)");
  const recordDispatch = idx('perf.record("dispatch"');
  const stateSet = idx("window.__mzState.set(state)");
  assert.ok(tStep < dispatchCall);
  assert.ok(dispatchCall < recordDispatch);
  assert.ok(recordDispatch < stateSet);

  const tPaint = idx("const tPaint");
  const paintCall = idx("window.paint();");
  const recordPaint = idx('perf.record("paint"');
  const tDraw = idx("const tDraw");
  const drawCall = idx("window.draw();");
  const recordDraw = idx('perf.record("draw"');
  const logLine = idx("window.logLine(line)");
  const recordStep = idx('perf.record("step"');
  assert.ok(tPaint < paintCall);
  assert.ok(paintCall < recordPaint);
  assert.ok(recordPaint < tDraw);
  assert.ok(tDraw < drawCall);
  assert.ok(drawCall < recordDraw);
  assert.ok(recordDraw < logLine);
  assert.ok(logLine < recordStep);
});

test("PERF-01 (shell pin): function perfReadout(perf) is declared exactly once; its body wires the readout element, formatReadout, PERF_LOG_EVERY and the [mzperf] logcat line; file-wide perfReadout( occurs exactly 3 times (declaration + two calls)", () => {
  const declHits = MODULE_CODE.match(/function perfReadout\(perf\) \{/g) || [];
  assert.equal(declHits.length, 1);
  const body = sliceBetween(MODULE_CODE, "function perfReadout(perf) {", "\n  }");
  assert.match(body, /"mw-dev-perf"/);
  assert.match(body, /formatReadout\(/);
  assert.match(body, /PERF_LOG_EVERY/);
  assert.match(body, /"\[mzperf\] "/);
  assert.match(body, /JSON\.stringify\(/);
  const fileWideHits = CODE.match(/perfReadout\(/g) || [];
  assert.equal(fileWideHits.length, 3);
});

test("PERF-01 (shell pin): mzDevStartAtDepth resets perfMarks then calls perfReadout(perfMarks), and still calls surfaceAbilityPool(state)", () => {
  const resetIdx = DEV_START_REGION.indexOf("perfMarks.reset();");
  const readoutIdx = DEV_START_REGION.indexOf("perfReadout(perfMarks);");
  assert.ok(resetIdx !== -1);
  assert.ok(readoutIdx !== -1);
  assert.ok(resetIdx < readoutIdx);
  assert.match(DEV_START_REGION, /surfaceAbilityPool\(state\);/);
});

test("PERF-01 (shell pin): the markup has exactly one id=\"mw-dev-perf\", positioned inside the dev row, empty (no text content) in the shipped markup", () => {
  const hits = HTML.match(/id="mw-dev-perf"/g) || [];
  assert.equal(hits.length, 1);
  const devRowStart = HTML.indexOf('id="mw-dev-row"');
  const perfIdx = HTML.indexOf('id="mw-dev-perf"');
  assert.ok(devRowStart !== -1 && perfIdx > devRowStart);
  assert.match(HTML, /<div id="mw-dev-perf"><\/div>/);
});

test("PERF-01 (shell pin): the <style> block declares #mw-dev-perf{...} and #mw-dev-perf:empty{display:none}; getElementById(\"mw-dev-perf\") occurs exactly once file-wide (one writer, not paint())", () => {
  assert.match(HTML, /#mw-dev-perf\{/);
  assert.match(HTML, /#mw-dev-perf:empty\{display:none\}/);
  const getElHits = CODE.match(/getElementById\("mw-dev-perf"\)/g) || [];
  assert.equal(getElHits.length, 1);
});

test("PERF-01 (shell pin): the classic script (everything before <script type=\"module\">) carries no perfMarks, perfReadout or performance.now token", () => {
  assert.equal(/perfMarks|perfReadout|performance\.now/.test(CLASSIC_CODE), false);
});
