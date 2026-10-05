#!/usr/bin/env node
// tools/achievements-zip.mjs
//
// Phase 98 (ZIP-01, ZIP-02, ZIP-03), plan 98-03. A thin CLI over
// tools/lib/achievements-zip.mjs: builds the Play Console achievements import
// zip from content/achievements.js, checks an existing zip, or prints the
// readable copy table. It never contacts Play; the import is the user's step
// (docs/ACHIEVEMENTS.md).
//
// Usage:
//   node tools/achievements-zip.mjs --build [--out <zip>] [--root <dir>]
//   node tools/achievements-zip.mjs --check [zip] [--root <dir>]
//   node tools/achievements-zip.mjs --copy-table [--out <file>] [--root <dir>]
//
// Exactly one action flag is required. Exit codes: 0 pass, 1 a build or
// validation failure, 2 usage. Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  REPO_ROOT,
  DEFAULT_ZIP_PATH,
  RULES,
  sha256,
  loadCatalog,
  buildAchievementsZip,
  validateZip,
  copyTable,
} from "./lib/achievements-zip.mjs";

const ACTIONS = Object.freeze(["--build", "--check", "--copy-table"]);

const USAGE =
  "Usage: node tools/achievements-zip.mjs (--build [--out <zip>] | --check [zip] | --copy-table [--out <file>]) [--root <dir>]";

// Returns { action, out, root, positional } or null on any argument error.
function parseArgs(argv) {
  const actions = [];
  let out;
  let root;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (ACTIONS.includes(a)) actions.push(a);
    else if (a === "--out" || a === "--root") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) return null;
      if (a === "--out") out = value;
      else root = value;
    } else if (a.startsWith("--")) return null;
    else positional.push(a);
  }
  if (actions.length !== 1) return null;
  if (positional.length > 1 || (positional.length === 1 && actions[0] !== "--check")) return null;
  if (out !== undefined && actions[0] === "--check") return null;
  return { action: actions[0], out, root, positional: positional[0] };
}

function printViolations(violations) {
  for (const v of violations) console.log(`${v.rule}: ${v.message}`);
}

async function runBuild(root, outArg) {
  const out = outArg ? path.resolve(outArg) : path.join(root, DEFAULT_ZIP_PATH);
  let tmp = null;
  try {
    const built = await buildAchievementsZip({ root });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    tmp = `${out}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, built.buffer);
    const reread = fs.readFileSync(tmp);
    const result = validateZip(reread, { catalog: built.catalog });
    if (!result.ok) {
      printViolations(result.violations);
      console.error("The built zip failed validation; nothing was written to the output path.");
      return 1;
    }
    try {
      fs.renameSync(tmp, out);
      tmp = null;
    } catch (err) {
      // Two builds at once can collide on the rename (Windows refuses to
      // replace a file another build just placed). The bytes are identical,
      // so the other build's file is as good as ours.
      let same = false;
      try {
        same = fs.readFileSync(out).equals(reread);
      } catch {
        same = false;
      }
      if (!same) throw err;
    }
    console.log(`path: ${out}`);
    console.log(`size: ${reread.length} bytes`);
    console.log(`sha256: ${sha256(reread)}`);
    console.log(`entries: ${result.stats.entries}`);
    console.log(`achievements: ${result.stats.achievements}`);
    console.log(`points: ${result.stats.points}`);
    return 0;
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
    return 1;
  } finally {
    if (tmp) fs.rmSync(tmp, { force: true });
  }
}

async function runCheck(root, zipArg) {
  const file = zipArg ? path.resolve(zipArg) : path.join(root, DEFAULT_ZIP_PATH);
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    console.error(`Cannot read ${file}. Build it first with: node tools/achievements-zip.mjs --build`);
    return 1;
  }
  let catalog;
  try {
    catalog = await loadCatalog(root);
  } catch (err) {
    console.error(`Cannot load the catalog: ${err.message}`);
    return 1;
  }
  const result = validateZip(bytes, { catalog });
  if (!result.ok) {
    printViolations(result.violations);
    console.log(`FAIL (${result.violations.length} violations, ${RULES.length} rules checked)`);
    return 1;
  }
  const s = result.stats;
  console.log(
    `PASS ${file} (${bytes.length} bytes, sha256 ${sha256(bytes)}): ${s.entries} entries, ${s.achievements} achievements, ` +
      `${s.points} points, ${s.incremental} incremental, ${s.hidden} hidden`,
  );
  return 0;
}

async function runCopyTable(root, outArg) {
  let text;
  try {
    text = copyTable(await loadCatalog(root));
  } catch (err) {
    console.error(`Cannot build the copy table: ${err.message}`);
    return 1;
  }
  if (outArg) {
    const out = path.resolve(outArg);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text);
    console.log(`wrote ${out}`);
  } else {
    process.stdout.write(text);
  }
  return 0;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  const root = args.root ? path.resolve(args.root) : REPO_ROOT;
  if (args.action === "--build") return runBuild(root, args.out);
  if (args.action === "--check") return runCheck(root, args.positional);
  return runCopyTable(root, args.out);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exitCode = 1;
    },
  );
}
