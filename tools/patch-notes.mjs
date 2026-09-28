#!/usr/bin/env node
// tools/patch-notes.mjs
//
// Phase 79.3, NOTES-01 — D-18 (the source format), D-19 (the build gate and
// the generated in-app module) and D-22 (the Release body and the Play cut).
// A thin CLI over tools/lib/patch-notes.mjs.
//
// Usage:
//   node tools/patch-notes.mjs --check          validate + Play-cut budget + module freshness
//   node tools/patch-notes.mjs --release-body    print the GitHub Release body
//   node tools/patch-notes.mjs --play            print the Play "What's new" cut (<= 500 chars)
//   node tools/patch-notes.mjs --write-module     (re)generate src/browser/patchNotesData.js
//   [--version <v>]  defaults to android/version.properties' versionName
//   [--root <dir>]   defaults to the repo root
//
// Exactly one action flag is required; zero or two-plus exits 2 with usage.

import fs from "node:fs";
import path from "node:path";

import {
  PLAY_WHATS_NEW_MAX,
  DATA_MODULE_PATH,
  REPO_ROOT,
  readVersionName,
  readNotesFor,
  notesModuleSource,
  releaseBody,
  playWhatsNew,
} from "./lib/patch-notes.mjs";

const ACTION_FLAGS = Object.freeze(["--check", "--release-body", "--play", "--write-module"]);

function usage() {
  return "Usage: node tools/patch-notes.mjs (--check|--release-body|--play|--write-module) [--version <v>] [--root <dir>]";
}

function parseArgs(argv) {
  const actions = [];
  let version;
  let root;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (ACTION_FLAGS.includes(a)) actions.push(a);
    else if (a === "--version") version = argv[++i];
    else if (a === "--root") root = argv[++i];
  }
  return { actions, version, root };
}

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

function main() {
  const { actions, version, root } = parseArgs(process.argv.slice(2));
  if (actions.length !== 1) {
    fail(usage(), 2);
    return;
  }
  const action = actions[0];
  const useRoot = root ? path.resolve(root) : REPO_ROOT;

  let v;
  try {
    v = version || readVersionName(useRoot);
  } catch (err) {
    fail(String((err && err.message) || err), 1);
    return;
  }

  let md;
  try {
    md = readNotesFor(v, useRoot);
  } catch (err) {
    fail(String((err && err.message) || err), 1);
    return;
  }

  if (action === "--release-body") {
    process.stdout.write(releaseBody(md));
    process.exit(0);
    return;
  }

  if (action === "--play") {
    let cut;
    try {
      cut = playWhatsNew(md);
    } catch (err) {
      fail(String((err && err.message) || err), 1);
      return;
    }
    process.stdout.write(`${cut}\n`);
    process.exit(0);
    return;
  }

  const modulePath = path.join(useRoot, ...DATA_MODULE_PATH.split("/"));

  if (action === "--write-module") {
    fs.mkdirSync(path.dirname(modulePath), { recursive: true });
    fs.writeFileSync(modulePath, notesModuleSource(v, md), "utf8");
    console.log(modulePath);
    process.exit(0);
    return;
  }

  // --check
  let cut;
  try {
    cut = playWhatsNew(md);
  } catch (err) {
    fail(String((err && err.message) || err), 1);
    return;
  }
  const expected = notesModuleSource(v, md);
  let committed = "";
  try {
    committed = fs.readFileSync(modulePath, "utf8").replace(/\r\n/g, "\n");
  } catch {
    committed = "";
  }
  if (committed !== expected) {
    fail(`patch notes ${v}: stale: run node tools/patch-notes.mjs --write-module`, 1);
    return;
  }
  console.log(`patch notes ${v}: OK (Play cut ${cut.length}/${PLAY_WHATS_NEW_MAX})`);
  process.exit(0);
}

main();
