#!/usr/bin/env node
// tools/cold-start.mjs
//
// Phase 60 (PERF-03) — dependency-free cold-start measurement for the
// Pixel 7 side-by-side v1.7/v1.8 comparison (60-CONTEXT "Cold start" /
// "Regression thresholds & dispositions"). Three subcommands:
//   run        force-stop + `adb shell am start -W`, 1 warm-up + N cold
//              launches, prints one line per launch and a final
//              `[cold-start] {json}` summary line.
//   judge      reads two `run` JSONs (or raw step/AAB numbers) and applies
//              the three PERF-03 thresholds, printing a verdict table and a
//              final `[perf03] {json}` line.
//   adb-path   prints the adb path this tool would resolve, with no PATH
//              dependency (this machine has no adb on PATH).
//
// median / p95 / max reuse `createPerfMarks` (src/browser/perfMarks.js), so
// cold start and the Phase 49 step rows share one nearest-rank method; at
// n = 10 the p95 is always the slowest run (sorted[9]).
//
// The tool's only device verbs are `am force-stop` and `am start -W` — it
// NEVER installs, uninstalls or clears app data. Plan 60-03's device
// session does the install, with the user's explicit OK.
//
// node:fs + node:path + node:url + node:child_process only — no packages.

import { createPerfMarks } from "../src/browser/perfMarks.js";

// PERF03_THRESHOLDS — the three regression thresholds, verbatim from
// 60-CONTEXT "Regression thresholds & dispositions": cold start median
// exceeds base by > 10% OR > 100ms; step p95 exceeds base by > 2ms; the AAB
// grows by > 2 MB, read here as 2,000,000 bytes (decimal MB) — the
// stricter of the two byte/MB readings.
export const PERF03_THRESHOLDS = Object.freeze({
  coldStartPct: 0.1,
  coldStartMs: 100,
  stepP95Ms: 2,
  aabBytes: 2000000,
});

export const DEFAULT_PACKAGE = "com.darktierstudios.delvedierepeat";
export const DEFAULT_ACTIVITY = ".MainActivity";

/**
 * splitAmStartBlocks(text) — normalizes CRLF to LF, then splits the text so
 * every block begins at a line starting with "Starting:". Any text before
 * the first such line (adb noise / a stray preamble) is dropped.
 */
export function splitAmStartBlocks(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("Starting:")) {
      if (current !== null) blocks.push(current.join("\n"));
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) blocks.push(current.join("\n"));
  return blocks;
}

/**
 * parseAmStart(block) — reads Status/LaunchState/TotalTime/WaitTime from
 * one `am start -W` block via line-anchored `^Key:\s*(.+)$` matches (CRLF
 * tolerant — captured adb output on Windows can end lines in \r\n). Returns
 * null unless the block has a TotalTime line: a failed launch (an `Error:`
 * line, no TotalTime) is not parseable and must never be silently treated
 * as a sample.
 */
export function parseAmStart(block) {
  const normalized = block.replace(/\r\n/g, "\n");
  const totalTimeMatch = normalized.match(/^TotalTime:\s*(.+)$/m);
  if (!totalTimeMatch) return null;
  const statusMatch = normalized.match(/^Status:\s*(.+)$/m);
  const launchStateMatch = normalized.match(/^LaunchState:\s*(.+)$/m);
  const waitTimeMatch = normalized.match(/^WaitTime:\s*(.+)$/m);
  return {
    status: statusMatch ? statusMatch[1].trim() : null,
    launchState: launchStateMatch ? launchStateMatch[1].trim() : null,
    totalTime: Number(totalTimeMatch[1].trim()),
    waitTime: waitTimeMatch ? Number(waitTimeMatch[1].trim()) : null,
  };
}

/**
 * summarizeSamples(samples) — { n, median, p95, min, max } by the same
 * nearest-rank method as src/browser/perfMarks.js's createPerfMarks (one
 * row, ring sized to at least the sample count so a future --runs > 100
 * can never silently drop a sample against the default 100-slot ring).
 */
export function summarizeSamples(samples) {
  if (!samples || samples.length === 0) {
    return { n: 0, median: null, p95: null, min: null, max: null };
  }
  const marks = createPerfMarks(Math.max(samples.length, 1));
  for (const sample of samples) marks.record("cold", sample);
  const row = marks.summary().cold;
  return { n: row.n, median: row.median, p95: row.p95, min: Math.min(...samples), max: row.max };
}

function unescapeSdkDir(raw) {
  // .properties escaping: "\:" -> ":", then a collapsed "\\" -> "\", then
  // every remaining backslash (single, from Windows paths) -> "/".
  return raw.replace(/\\:/g, ":").replace(/\\\\/g, "\\").replace(/\\/g, "/");
}

function parseSdkDir(localPropertiesText) {
  if (!localPropertiesText) return null;
  const normalized = localPropertiesText.replace(/\r\n/g, "\n");
  const match = normalized.match(/^sdk\.dir=(.+)$/m);
  if (!match) return null;
  return unescapeSdkDir(match[1].trim());
}

function joinAdbPath(base, exeSuffix) {
  const trimmed = base.replace(/[\\/]+$/, "");
  return `${trimmed}/platform-tools/adb${exeSuffix}`;
}

/**
 * resolveAdb({ flag, env, localPropertiesText, platform }) — adb resolution
 * with no PATH dependency, in precedence order: --adb flag, then the ADB
 * env var, then ANDROID_HOME, then ANDROID_SDK_ROOT, then the sdk.dir line
 * of android/local.properties, then a bare "adb". `.exe` is appended only
 * for the three SDK-derived paths (ANDROID_HOME/ANDROID_SDK_ROOT/sdk.dir),
 * and only on win32 — the flag, the ADB env var and the bare fallback are
 * returned as given, since those are already a full adb invocation.
 */
export function resolveAdb({ flag, env = {}, localPropertiesText, platform = process.platform } = {}) {
  const exeSuffix = platform === "win32" ? ".exe" : "";
  if (flag) return flag;
  if (env.ADB) return env.ADB;
  const sdkHome = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (sdkHome) return joinAdbPath(sdkHome, exeSuffix);
  const sdkDir = parseSdkDir(localPropertiesText);
  if (sdkDir) return joinAdbPath(sdkDir, exeSuffix);
  return "adb";
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function computeDelta(base, head) {
  const rawDelta = head - base;
  const rawPct = base !== 0 ? rawDelta / base : null;
  return {
    delta: roundTo(rawDelta, 3),
    deltaPct: rawPct === null ? null : roundTo(rawPct, 3),
  };
}

function judgeMeasure(measure, thresholdText, regressesFn) {
  if (!measure) {
    return { base: null, head: null, delta: null, deltaPct: null, threshold: thresholdText, regresses: null, rule: "not measured" };
  }
  const { base, head } = measure;
  const { delta, deltaPct } = computeDelta(base, head);
  return { base, head, delta, deltaPct, threshold: thresholdText, regresses: regressesFn(delta, deltaPct), rule: thresholdText };
}

/**
 * judgePerf03({ coldStart, stepP95, aabBytes, baseLabel, headLabel }) — the
 * one tested function owning all three PERF-03 thresholds (60-CONTEXT
 * "Regression thresholds & dispositions"). Each measure is `{ base, head }`
 * or undefined; an undefined measure reports `regresses: null` and rule
 * "not measured" — never a pass. `delta`/`deltaPct` are rounded to 0.001
 * before the comparison, so floating-point noise (e.g. 19.8 -> 21.8
 * reading as 1.9999999999999982) can never flip a verdict. Every
 * comparison is strictly greater — exactly at a threshold does not
 * regress.
 */
export function judgePerf03({ coldStart, stepP95, aabBytes, baseLabel = "v1.7", headLabel = "v1.8" } = {}) {
  const coldStartResult = judgeMeasure(
    coldStart,
    "> 10 % or > 100 ms",
    (delta, deltaPct) => delta > PERF03_THRESHOLDS.coldStartMs || deltaPct > PERF03_THRESHOLDS.coldStartPct,
  );
  const stepP95Result = judgeMeasure(stepP95, "> 2 ms", (delta) => delta > PERF03_THRESHOLDS.stepP95Ms);
  const aabBytesResult = judgeMeasure(aabBytes, "> 2,000,000 B", (delta) => delta > PERF03_THRESHOLDS.aabBytes);

  const anyRegression = [coldStartResult, stepP95Result, aabBytesResult].some((m) => m.regresses === true);
  const complete = Boolean(coldStart) && Boolean(stepP95) && Boolean(aabBytes);

  return {
    coldStart: coldStartResult,
    stepP95: stepP95Result,
    aabBytes: aabBytesResult,
    baseLabel,
    headLabel,
    anyRegression,
    complete,
  };
}

function fmtCell(value) {
  return value === null || value === undefined ? "—" : String(value);
}

function regressesCell(measure) {
  if (measure.regresses === true) return "yes";
  if (measure.regresses === false) return "no";
  return "not measured";
}

/**
 * renderVerdictTable(verdict) — a Markdown table, one row per measure, in
 * the order cold start / step / AAB, for pasting straight into
 * docs/PERF-BASELINE.md.
 */
export function renderVerdictTable(verdict) {
  const header = `| Measure | ${verdict.baseLabel} | ${verdict.headLabel} | Delta | Threshold | Regresses? |`;
  const divider = "| --- | --- | --- | --- | --- | --- |";
  const rows = [
    ["Cold start median (ms)", verdict.coldStart],
    ["Step p95 (ms)", verdict.stepP95],
    ["AAB (bytes)", verdict.aabBytes],
  ].map(([label, m]) => `| ${label} | ${fmtCell(m.base)} | ${fmtCell(m.head)} | ${fmtCell(m.delta)} | ${m.threshold} | ${regressesCell(m)} |`);
  return [header, divider, ...rows].join("\n");
}
