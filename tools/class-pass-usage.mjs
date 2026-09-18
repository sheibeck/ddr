#!/usr/bin/env node
// tools/class-pass-usage.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped (see
// tools/build-www.mjs's copy list, which never references this file), NOT a
// node:test file (it makes no assertions, so `node --test` never picks it
// up). THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute
// for a human playtest — same discipline as tools/tune-classes.mjs and
// tools/class-pass-diff.mjs, whose JSON output this script reads.
//
// PURPOSE (Phase 42, BAL-02, 42-03-PLAN.md): renders
// tools/lib/class-matrix.mjs#formatUsageMarkdown's pick-rate tables for a
// tools/tune-classes.mjs JSON report (or a BEFORE/deep pair), so BAL-02's
// "pick-rates for every new spell/ability" number is a machine-rendered
// Markdown block, never retyped by hand. Never plays a run, never imports
// the engine directly — content/tools-internal imports come through
// class-matrix.mjs alone.
//
// BYTE-STABILITY: no Math.random, no Date.now/new Date, no timestamps, no
// environment-dependent text anywhere in this script or its output — the
// same input file(s) always produce byte-identical stdout
// (test/unit/class-pass-usage.test.js's determinism test runs the CLI twice
// and diffs the bytes, mirroring test/unit/class-pass-diff.test.js's own
// pattern for the sibling CLI).
//
// CLI:
//   node tools/class-pass-usage.mjs --after PATH [--deep PATH]
//     --after PATH   a tools/tune-classes.mjs JSON report (required)
//     --deep PATH    an OPTIONAL second report (e.g. a depth-20 slice) —
//                    appends a second `## Pick-rates — depth-20 slice`
//                    block after a blank line
// A missing/unreadable `--after` file, or a missing `--after` flag itself,
// prints a usage message to stderr and exits 2.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatUsageMarkdown } from "./lib/class-matrix.mjs";

function usage() {
  return [
    "Usage: node tools/class-pass-usage.mjs --after PATH [--deep PATH]",
    "  --after PATH   a tools/tune-classes.mjs JSON report (required)",
    "  --deep PATH    an optional second report (e.g. a depth-20 slice)",
  ].join("\n");
}

function fail(msg) {
  process.stderr.write(`${msg}\n${usage()}\n`);
  process.exit(2);
}

/** parseArgs(argv) — accepts both `--flag value` and `--flag=value` forms; unknown flag exits 2 with usage. */
function parseArgs(argv) {
  const opts = { after: null, deep: null };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`Unrecognized argument: ${arg}`);
    const eqIdx = arg.indexOf("=");
    const flag = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? null : arg.slice(eqIdx + 1);
    const nextValue = () => {
      if (inlineValue !== null) return inlineValue;
      i++;
      if (i >= argv.length) fail(`${flag} requires a value`);
      return argv[i];
    };
    switch (flag) {
      case "--after":
        opts.after = nextValue();
        break;
      case "--deep":
        opts.deep = nextValue();
        break;
      default:
        fail(`Unknown flag: ${flag}`);
    }
    i++;
  }
  return opts;
}

/** readJSON(p, label) — exits 2 with a clear message naming the file when it is missing or unparseable. */
function readJSON(p, label) {
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (e) {
    fail(`Cannot read ${label} file "${p}": ${e.message}`);
    return undefined; // unreachable — fail() exits the process
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Cannot parse ${label} file "${p}" as JSON: ${e.message}`);
    return undefined; // unreachable — fail() exits the process
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.after) fail("--after is required");

  const after = readJSON(opts.after, "--after");
  const parts = [formatUsageMarkdown(after)];

  if (opts.deep) {
    const deep = readJSON(opts.deep, "--deep");
    parts.push("", "## Pick-rates — depth-20 slice", formatUsageMarkdown(deep));
  }

  process.stdout.write(`${parts.join("\n")}\n`);
  process.exit(0);
}

function isMainModule() {
  try {
    return path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
