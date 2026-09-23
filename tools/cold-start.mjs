#!/usr/bin/env node
// tools/cold-start.mjs
//
// Phase 60 (PERF-03) — dependency-free cold-start measurement for the
// Pixel 7 side-by-side v1.7/v1.8 comparison (60-CONTEXT "Cold start" /
// "Regression thresholds & dispositions"). Three subcommands:
//   run        force-stop + `adb shell am start -W`, 1 warm-up + N cold
//              launches, prints one line per launch and a final
//              `[cold-start] {json}` summary line.
//              node tools/cold-start.mjs run --label v1.8 --runs 10 --warmup 1
//   judge      reads two `run` JSONs (or raw step/AAB numbers) and applies
//              the three PERF-03 thresholds, printing a verdict table and a
//              final `[perf03] {json}` line.
//              node tools/cold-start.mjs judge --cold-base v1.7-cold.json \
//                --cold-head v1.8-cold.json --step-base 14.2 --step-head 15.1 \
//                --aab-base 9500000 --aab-head 9800000
//   adb-path   prints the adb path this tool would resolve, with no PATH
//              dependency (this machine has no adb on PATH).
//              node tools/cold-start.mjs adb-path
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

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import { createPerfMarks } from "../src/browser/perfMarks.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

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

// ===========================================================================
// CLI — run / judge / adb-path. Everything below this line has a top-level
// side effect (process.exit, fs, spawnSync) and only runs behind the
// main-module guard at the bottom of this file.
// ===========================================================================

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function readLocalProperties() {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, "android", "local.properties"), "utf8");
  } catch {
    return "";
  }
}

function resolveAdbFromEnv(flag) {
  return resolveAdb({ flag, env: process.env, localPropertiesText: readLocalProperties(), platform: process.platform });
}

function forceStopArgs(serialArgs, pkg) {
  return [...serialArgs, "shell", "am", "force-stop", pkg];
}

function startArgs(serialArgs, pkg, activity) {
  return [...serialArgs, "shell", "am", "start", "-W", "-n", `${pkg}/${activity}`];
}

function sleepMs(ms) {
  if (!ms || ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

// --- run -------------------------------------------------------------------

function parseRunArgs(argv) {
  const opts = {
    label: null,
    runs: 10,
    warmup: 1,
    serial: null,
    adb: null,
    package: DEFAULT_PACKAGE,
    activity: DEFAULT_ACTIVITY,
    settleMs: 1500,
    holdMs: 4000,
    out: null,
    fixture: null,
    dryRun: false,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--label":
        opts.label = argv[++i];
        break;
      case "--runs":
        opts.runs = Number(argv[++i]);
        break;
      case "--warmup":
        opts.warmup = Number(argv[++i]);
        break;
      case "--serial":
        opts.serial = argv[++i];
        break;
      case "--adb":
        opts.adb = argv[++i];
        break;
      case "--package":
        opts.package = argv[++i];
        break;
      case "--activity":
        opts.activity = argv[++i];
        break;
      case "--settle-ms":
        opts.settleMs = Number(argv[++i]);
        break;
      case "--hold-ms":
        opts.holdMs = Number(argv[++i]);
        break;
      case "--out":
        opts.out = argv[++i];
        break;
      case "--fixture":
        opts.fixture = argv[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        fail(`run: unrecognized argument: ${arg}\nUsage: node tools/cold-start.mjs run --label <name> [--runs N] [--warmup N] [--serial S] [--adb PATH] [--fixture FILE] [--dry-run] [--out FILE]`);
    }
    i++;
  }
  if (!opts.label) {
    fail("run: --label is required\nUsage: node tools/cold-start.mjs run --label <name> [--runs N] [--warmup N] [--serial S] [--adb PATH] [--fixture FILE] [--dry-run] [--out FILE]");
  }
  return opts;
}

/**
 * processBlocks({ label, pkg, activity, serial, source, warmup, runs,
 * blockTexts, log }) — the shared validator/summarizer for both live and
 * `--fixture` `run` modes. The first `warmup` texts are excluded from both
 * validity checks and the samples (must_haves: a warm-up run can never be
 * averaged into the cold-start number). Of the `runs` measured texts: a
 * null parse or a non-ok Status is an exit-1 condition; a present
 * LaunchState other than COLD (and no exit-1 condition) is exit-2.
 */
function processBlocks({ label, pkg, activity, serial, source, warmup, runs, blockTexts, log = () => {} }) {
  const total = warmup + runs;
  if (blockTexts.length < total) {
    fail(`run: only ${blockTexts.length} block(s) available, need warmup(${warmup}) + runs(${runs}) = ${total}`);
  }

  const warmupSamples = [];
  const samples = [];
  const launchStates = [];
  const invalid = [];
  let sawStatusError = false;
  let sawLaunchStateError = false;

  for (let idx = 0; idx < total; idx++) {
    const parsed = parseAmStart(blockTexts[idx]);
    const displayIdx = idx + 1;
    const isWarmup = idx < warmup;

    if (isWarmup) {
      log(`run ${displayIdx}/${total} TotalTime=${parsed ? parsed.totalTime : "?"} LaunchState=${parsed ? parsed.launchState : "?"} (warm-up)`);
      if (parsed) warmupSamples.push(parsed.totalTime);
      continue;
    }

    const measuredIdx = idx - warmup + 1;
    log(`run ${displayIdx}/${total} TotalTime=${parsed ? parsed.totalTime : "?"} LaunchState=${parsed ? parsed.launchState : "?"}`);

    if (!parsed || parsed.status !== "ok") {
      invalid.push({ run: measuredIdx, reason: !parsed ? "no TotalTime" : `Status=${parsed.status}` });
      sawStatusError = true;
      continue;
    }
    if (parsed.launchState && parsed.launchState !== "COLD") {
      invalid.push({ run: measuredIdx, reason: `LaunchState=${parsed.launchState}` });
      sawLaunchStateError = true;
      continue;
    }
    samples.push(parsed.totalTime);
    launchStates.push(parsed.launchState);
  }

  const summary = summarizeSamples(samples);
  const result = {
    label,
    package: pkg,
    activity,
    serial: serial || null,
    source,
    runs,
    warmup,
    samples,
    warmupSamples,
    launchStates,
    summary,
    invalid,
  };

  let exitCode = 0;
  if (sawStatusError) exitCode = 1;
  else if (sawLaunchStateError) exitCode = 2;

  return { result, exitCode };
}

function cmdRun(argv) {
  const opts = parseRunArgs(argv);
  const total = opts.warmup + opts.runs;
  const serialArgs = opts.serial ? ["-s", opts.serial] : [];

  if (opts.dryRun) {
    const adbPath = resolveAdbFromEnv(opts.adb);
    for (let idx = 0; idx < total; idx++) {
      console.log(`${adbPath} ${forceStopArgs(serialArgs, opts.package).join(" ")}`);
      console.log(`${adbPath} ${startArgs(serialArgs, opts.package, opts.activity).join(" ")}`);
    }
    process.exit(0);
    return;
  }

  if (opts.fixture) {
    let text;
    try {
      text = fs.readFileSync(opts.fixture, "utf8");
    } catch (e) {
      fail(`run: cannot read --fixture file "${opts.fixture}": ${e.message}`);
      return;
    }
    const blocks = splitAmStartBlocks(text);
    const { result, exitCode } = processBlocks({
      label: opts.label,
      pkg: opts.package,
      activity: opts.activity,
      serial: opts.serial,
      source: "fixture",
      warmup: opts.warmup,
      runs: opts.runs,
      blockTexts: blocks,
      log: (line) => console.log(line),
    });
    console.log(`[cold-start] ${JSON.stringify(result)}`);
    if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(result, null, 2));
    process.exit(exitCode);
    return;
  }

  // Live mode — force-stop, wait, `am start -W`, wait, repeat.
  const adbPath = resolveAdbFromEnv(opts.adb);
  const blockTexts = [];
  for (let idx = 0; idx < total; idx++) {
    const fsResult = spawnSync(adbPath, forceStopArgs(serialArgs, opts.package));
    if (fsResult.error) fail(`run: adb force-stop failed (resolved adb "${adbPath}"): ${fsResult.error.message}`);
    sleepMs(opts.settleMs);
    const startResult = spawnSync(adbPath, startArgs(serialArgs, opts.package, opts.activity), { encoding: "utf8" });
    if (startResult.error) fail(`run: adb start failed (resolved adb "${adbPath}"): ${startResult.error.message}`);
    blockTexts.push(startResult.stdout || "");
    sleepMs(opts.holdMs);
  }
  const { result, exitCode } = processBlocks({
    label: opts.label,
    pkg: opts.package,
    activity: opts.activity,
    serial: opts.serial,
    source: "live",
    warmup: opts.warmup,
    runs: opts.runs,
    blockTexts,
    log: (line) => console.log(line),
  });
  console.log(`[cold-start] ${JSON.stringify(result)}`);
  if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(result, null, 2));
  process.exit(exitCode);
}

// --- judge -------------------------------------------------------------

function parseJudgeArgs(argv) {
  const opts = {
    coldBase: null,
    coldHead: null,
    stepBase: null,
    stepHead: null,
    aabBase: null,
    aabHead: null,
    baseLabel: "v1.7",
    headLabel: "v1.8",
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--cold-base":
        opts.coldBase = argv[++i];
        break;
      case "--cold-head":
        opts.coldHead = argv[++i];
        break;
      case "--step-base":
        opts.stepBase = argv[++i];
        break;
      case "--step-head":
        opts.stepHead = argv[++i];
        break;
      case "--aab-base":
        opts.aabBase = argv[++i];
        break;
      case "--aab-head":
        opts.aabHead = argv[++i];
        break;
      case "--base-label":
        opts.baseLabel = argv[++i];
        break;
      case "--head-label":
        opts.headLabel = argv[++i];
        break;
      default:
        fail(`judge: unrecognized argument: ${arg}\nUsage: node tools/cold-start.mjs judge --cold-base FILE --cold-head FILE --step-base MS --step-head MS --aab-base BYTES --aab-head BYTES`);
    }
    i++;
  }
  return opts;
}

function readRunMedian(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    fail(`judge: cannot read ${label} file "${filePath}": ${e.message}`);
    return undefined;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail(`judge: cannot parse ${label} file "${filePath}" as JSON: ${e.message}`);
    return undefined;
  }
  const median = json?.summary?.median;
  if (typeof median !== "number" || !Number.isFinite(median)) {
    fail(`judge: ${label} file "${filePath}" has no numeric summary.median`);
    return undefined;
  }
  return median;
}

function readNumericFlag(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) fail(`judge: ${label} must be numeric, got "${value}"`);
  return n;
}

function cmdJudge(argv) {
  const opts = parseJudgeArgs(argv);

  let coldStart;
  if (opts.coldBase !== null && opts.coldHead !== null) {
    coldStart = { base: readRunMedian(opts.coldBase, "--cold-base"), head: readRunMedian(opts.coldHead, "--cold-head") };
  }
  let stepP95;
  if (opts.stepBase !== null && opts.stepHead !== null) {
    stepP95 = { base: readNumericFlag(opts.stepBase, "--step-base"), head: readNumericFlag(opts.stepHead, "--step-head") };
  }
  let aabBytes;
  if (opts.aabBase !== null && opts.aabHead !== null) {
    aabBytes = { base: readNumericFlag(opts.aabBase, "--aab-base"), head: readNumericFlag(opts.aabHead, "--aab-head") };
  }

  const verdict = judgePerf03({ coldStart, stepP95, aabBytes, baseLabel: opts.baseLabel, headLabel: opts.headLabel });
  console.log(renderVerdictTable(verdict));
  console.log(`[perf03] ${JSON.stringify(verdict)}`);
  process.exit(0);
}

// --- adb-path ------------------------------------------------------------

function parseAdbPathArgs(argv) {
  const opts = { adb: null };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--adb") {
      opts.adb = argv[++i];
    } else {
      fail(`adb-path: unrecognized argument: ${arg}\nUsage: node tools/cold-start.mjs adb-path [--adb PATH]`);
    }
    i++;
  }
  return opts;
}

function cmdAdbPath(argv) {
  const opts = parseAdbPathArgs(argv);
  console.log(resolveAdbFromEnv(opts.adb));
  process.exit(0);
}

// --- main ----------------------------------------------------------------

function main() {
  const [sub, ...rest] = process.argv.slice(2);
  switch (sub) {
    case "run":
      cmdRun(rest);
      break;
    case "judge":
      cmdJudge(rest);
      break;
    case "adb-path":
      cmdAdbPath(rest);
      break;
    default:
      fail(`Unknown subcommand "${sub || ""}"\nUsage: node tools/cold-start.mjs <run|judge|adb-path> [options]`);
  }
}

// Direct-invocation guard — mirrors tools/bridge-doc.mjs and
// tools/ident-sweep.mjs's pattern. Importing this module (as this file's
// own test does) runs nothing.
if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  main();
}
