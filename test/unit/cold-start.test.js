// test/unit/cold-start.test.js
//
// Phase 60 (PERF-03) — pins tools/cold-start.mjs's pure core (parseAmStart,
// splitAmStartBlocks, summarizeSamples, resolveAdb, judgePerf03,
// renderVerdictTable — Tests 1-11). median/p95/max are checked against
// src/browser/perfMarks.js's createPerfMarks directly, so cold start is
// proven to share the Phase 49 step rows' nearest-rank method rather than a
// re-derived one. Task 2 adds the CLI tests (Tests 12-18) below this file's
// current tail.

import test from "node:test";
import assert from "node:assert/strict";

import { createPerfMarks } from "../../src/browser/perfMarks.js";
import {
  DEFAULT_PACKAGE,
  DEFAULT_ACTIVITY,
  PERF03_THRESHOLDS,
  splitAmStartBlocks,
  parseAmStart,
  summarizeSamples,
  resolveAdb,
  judgePerf03,
  renderVerdictTable,
} from "../../tools/cold-start.mjs";

// --- (1) parseAmStart ----------------------------------------------------

test("parseAmStart reads Status, LaunchState, TotalTime and WaitTime from one am start -W block", () => {
  const block = [
    "Starting: Intent { cmp=com.darktierstudios.delvedierepeat/.MainActivity }",
    "Status: ok",
    "LaunchState: COLD",
    "Activity: com.darktierstudios.delvedierepeat/.MainActivity",
    "TotalTime: 812",
    "WaitTime: 815",
    "Complete",
  ].join("\n");

  const result = parseAmStart(block);
  assert.deepEqual(result, { status: "ok", launchState: "COLD", totalTime: 812, waitTime: 815 });
  assert.equal(typeof result.totalTime, "number");
  assert.equal(typeof result.waitTime, "number");

  const crlfBlock = block.replace(/\n/g, "\r\n");
  const crlfResult = parseAmStart(crlfBlock);
  assert.deepEqual(crlfResult, { status: "ok", launchState: "COLD", totalTime: 812, waitTime: 815 });
});

test("parseAmStart returns null for a block with no TotalTime", () => {
  const block = [
    "Starting: Intent { cmp=com.darktierstudios.delvedierepeat/.MainActivity }",
    "Error: Activity not started, unable to resolve Intent",
  ].join("\n");
  assert.equal(parseAmStart(block), null);
});

// --- (2) splitAmStartBlocks ------------------------------------------------

test("splitAmStartBlocks splits a concatenated transcript into one block per Starting: line", () => {
  const preamble = "some adb noise before the first launch\n";
  const b1 = "Starting: Intent { a }\nStatus: ok\nTotalTime: 100\n";
  const b2 = "Starting: Intent { b }\nStatus: ok\nTotalTime: 200\n";
  const b3 = "Starting: Intent { c }\nStatus: ok\nTotalTime: 300\n";
  const transcript = preamble + b1 + b2 + b3;

  const blocks = splitAmStartBlocks(transcript);
  assert.equal(blocks.length, 3);
  for (const block of blocks) assert.ok(block.startsWith("Starting:"));
  assert.ok(!blocks.some((b) => b.includes("some adb noise")));
});

// --- (3) summarizeSamples --------------------------------------------------

const TEST4_SAMPLES = [900, 850, 880, 910, 870, 860, 1200, 890, 875, 865];

test("summarizeSamples reports n/median/p95/min/max by nearest rank, identical to createPerfMarks for the same samples", () => {
  const result = summarizeSamples(TEST4_SAMPLES);
  assert.equal(result.n, 10);
  assert.equal(result.median, 875);
  assert.equal(result.p95, 1200);
  assert.equal(result.min, 850);

  const marks = createPerfMarks(10);
  for (const sample of TEST4_SAMPLES) marks.record("cold", sample);
  const expected = marks.summary().cold;
  assert.deepEqual(
    { median: result.median, p95: result.p95, max: result.max },
    { median: expected.median, p95: expected.p95, max: expected.max },
  );

  assert.deepEqual(summarizeSamples([]), { n: 0, median: null, p95: null, min: null, max: null });
});

// --- (4) PERF03_THRESHOLDS --------------------------------------------------

test("PERF03_THRESHOLDS pins the 60-CONTEXT numbers", () => {
  assert.equal(PERF03_THRESHOLDS.coldStartPct, 0.1);
  assert.equal(PERF03_THRESHOLDS.coldStartMs, 100);
  assert.equal(PERF03_THRESHOLDS.stepP95Ms, 2);
  assert.equal(PERF03_THRESHOLDS.aabBytes, 2000000);
  assert.ok(Object.isFrozen(PERF03_THRESHOLDS));
});

// --- (5) judgePerf03 — cold start -------------------------------------------

test("judgePerf03 cold start regresses on EITHER branch; exactly at a threshold does not", () => {
  const cases = [
    [1000, 1100, false],
    [1000, 1101, true],
    [500, 551, true],
    [2000, 2101, true],
    [2000, 2100, false],
    [1000, 900, false],
  ];
  for (const [base, head, expected] of cases) {
    const verdict = judgePerf03({ coldStart: { base, head } });
    assert.equal(verdict.coldStart.regresses, expected, `${base} -> ${head}`);
  }
});

// --- (6) judgePerf03 — step p95 ---------------------------------------------

test("judgePerf03 step p95: +2.0 ms does not regress despite floating-point error", () => {
  const cases = [
    [19.8, 21.8, false],
    [19.8, 21.9, true],
    [28.9, 19.8, false],
  ];
  for (const [base, head, expected] of cases) {
    const verdict = judgePerf03({ stepP95: { base, head } });
    assert.equal(verdict.stepP95.regresses, expected, `${base} -> ${head}`);
  }
});

// --- (7) judgePerf03 — AAB ----------------------------------------------

test("judgePerf03 AAB: +2,000,000 bytes does not regress, +2,000,001 does, a shrink never does", () => {
  assert.equal(judgePerf03({ aabBytes: { base: 10000000, head: 12000000 } }).aabBytes.regresses, false);
  assert.equal(judgePerf03({ aabBytes: { base: 10000000, head: 12000001 } }).aabBytes.regresses, true);
  assert.equal(judgePerf03({ aabBytes: { base: 10000000, head: 9000000 } }).aabBytes.regresses, false);
});

// --- (8) judgePerf03 — not measured -----------------------------------------

test("an unsupplied measure is 'not measured', never a pass", () => {
  const verdict = judgePerf03({ aabBytes: { base: 1, head: 2 } });
  assert.equal(verdict.coldStart.regresses, null);
  assert.equal(verdict.coldStart.rule, "not measured");
  assert.equal(verdict.stepP95.regresses, null);
  assert.equal(verdict.stepP95.rule, "not measured");
  assert.equal(verdict.anyRegression, false);
  assert.equal(verdict.complete, false);
});

// --- (9) resolveAdb ----------------------------------------------------

test("resolveAdb precedence: flag > ADB env > ANDROID_HOME > ANDROID_SDK_ROOT > local.properties sdk.dir > bare adb", () => {
  assert.equal(resolveAdb({ flag: "Z:/custom/adb.exe", env: { ADB: "should-not-use" }, platform: "win32" }), "Z:/custom/adb.exe");
  assert.equal(resolveAdb({ env: { ADB: "/opt/adb" }, platform: "linux" }), "/opt/adb");
  assert.equal(resolveAdb({ env: { ANDROID_HOME: "/opt/sdk" }, platform: "win32" }), "/opt/sdk/platform-tools/adb.exe");
  assert.equal(resolveAdb({ env: { ANDROID_HOME: "/opt/sdk" }, platform: "linux" }), "/opt/sdk/platform-tools/adb");
  assert.equal(resolveAdb({ env: { ANDROID_SDK_ROOT: "/opt/sdk2" }, platform: "linux" }), "/opt/sdk2/platform-tools/adb");
  assert.equal(
    resolveAdb({ env: { ANDROID_HOME: "/home-wins", ANDROID_SDK_ROOT: "/root-loses" }, platform: "linux" }),
    "/home-wins/platform-tools/adb",
  );

  const escapedProps = "sdk.dir=C\\:\\\\Users\\\\Dell\\\\AppData\\\\Local\\\\Android\\\\Sdk\n";
  assert.equal(
    resolveAdb({ env: {}, localPropertiesText: escapedProps, platform: "win32" }),
    "C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe",
  );

  const plainProps = "sdk.dir=C:/Users/Dell/AppData/Local/Android/Sdk\n";
  assert.equal(
    resolveAdb({ env: {}, localPropertiesText: plainProps, platform: "win32" }),
    "C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe",
  );
  assert.equal(
    resolveAdb({ env: {}, localPropertiesText: plainProps, platform: "linux" }),
    "C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb",
  );

  assert.equal(resolveAdb({ env: {}, platform: "linux" }), "adb");
  assert.equal(DEFAULT_PACKAGE, "com.darktierstudios.delvedierepeat");
  assert.equal(DEFAULT_ACTIVITY, ".MainActivity");
});

// --- (10) renderVerdictTable --------------------------------------------

test("renderVerdictTable renders one row per measure with yes / no / not measured", () => {
  const verdict = judgePerf03({
    coldStart: { base: 1000, head: 1200 },
    stepP95: { base: 19.8, head: 19.8 },
  });
  const table = renderVerdictTable(verdict);
  const lines = table.split("\n");
  assert.equal(lines[0], "| Measure | v1.7 | v1.8 | Delta | Threshold | Regresses? |");
  assert.ok(lines.some((l) => l.startsWith("| Cold start median (ms) |") && l.includes("| yes |")));
  assert.ok(lines.some((l) => l.startsWith("| Step p95 (ms) |") && l.includes("| no |")));
  assert.ok(lines.some((l) => l.startsWith("| AAB (bytes) |") && l.includes("| not measured |")));
});
