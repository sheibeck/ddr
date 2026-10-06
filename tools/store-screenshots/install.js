"use strict";
// Installs the checked capture set into store-listing/screenshots.
//
//   node install.js [--from <dir>] [--to <dir>] [--dry-run]
//
// Gate, stage, check, swap:
//   1. any leftover staging directory from an earlier run is removed;
//   2. the gate: <from>/manifest.json must hold 24 shots, every one ok, with
//      rules ok, and the full Play-rules tree check must pass on <from>;
//   3. the eight scene files of each size folder are copied into a staging
//      directory that sits beside the target tree, and that copy is checked
//      again; a violation aborts with the target untouched;
//   4. each target folder is moved aside, the staged folder is renamed into
//      place, and the old folders are deleted only when all three swaps worked
//      (a failed swap puts the old folders back);
//   5. the installed tree is checked once more.
// Running it twice leaves exactly the same 24 files and nothing else.
// Node built-ins, config.js and play-rules.js only. Nothing here ships.
const fs = require("fs");
const path = require("path");
const { SIZES, SCENES, OUT_DIR, STORE_DIR } = require("./config.js");
const { checkTree } = require("./play-rules.js");

const STAGING_NAME = ".screenshots-staging";
const EXPECTED = Object.keys(SIZES).length * SCENES.length;

function parseArgs(argv) {
  const o = { from: OUT_DIR, to: STORE_DIR, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--from" || a === "--to") {
      const v = argv[++i];
      if (!v) throw new Error(a + " needs a directory");
      o[a.slice(2)] = path.resolve(v);
    } else throw new Error("unknown argument: " + a);
  }
  return o;
}

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

// Returns a list of reasons the set in `from` may not be installed.
function gate(from) {
  const why = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(from, "manifest.json"), "utf8"));
  } catch (e) {
    return ["no readable manifest.json in " + from + " (" + e.message + ")"];
  }
  if (manifest.partial) why.push("the manifest is from a partial run");
  const shots = Array.isArray(manifest.shots) ? manifest.shots : [];
  if (shots.length !== EXPECTED) why.push("the manifest holds " + shots.length + " shots, need " + EXPECTED);
  for (const s of shots) if (!s.ok) why.push("shot " + s.file + " is not ok");
  if (!manifest.rules || manifest.rules.ok !== true) why.push("the manifest's rules result is not ok");
  const tree = checkTree(from);
  for (const v of tree.violations) why.push(v);
  return why;
}

function stage(from, staging) {
  rm(staging);
  fs.mkdirSync(staging, { recursive: true });
  for (const key of Object.keys(SIZES)) {
    const folder = SIZES[key].folder;
    fs.mkdirSync(path.join(staging, folder));
    for (const scene of SCENES) {
      fs.copyFileSync(path.join(from, folder, scene.file), path.join(staging, folder, scene.file));
    }
  }
}

function swap(staging, to) {
  const aside = path.join(staging, "_old");
  fs.mkdirSync(aside);
  fs.mkdirSync(to, { recursive: true });
  const done = [];
  try {
    for (const key of Object.keys(SIZES)) {
      const folder = SIZES[key].folder;
      const live = path.join(to, folder);
      const hadOld = fs.existsSync(live);
      if (hadOld) fs.renameSync(live, path.join(aside, folder));
      done.push({ folder, hadOld });
      fs.renameSync(path.join(staging, folder), live);
    }
  } catch (e) {
    // put the old folders back, newest first
    for (const d of done.reverse()) {
      const live = path.join(to, d.folder);
      rm(live);
      if (d.hadOld) fs.renameSync(path.join(aside, d.folder), live);
    }
    throw e;
  }
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const staging = path.join(path.dirname(o.to), STAGING_NAME);

  rm(staging); // 1. a leftover from an interrupted run

  const why = gate(o.from); // 2. the gate
  if (why.length) {
    console.log("install refused: " + why.length + " reason(s)");
    for (const w of why) console.log("  " + w);
    process.exit(1);
  }

  stage(o.from, staging); // 3. stage and re-check
  const staged = checkTree(staging);
  if (!staged.ok) {
    console.log("install refused: the staged copy fails the Play rules");
    for (const v of staged.violations) console.log("  " + v);
    rm(staging);
    process.exit(1);
  }
  if (o.dryRun) {
    rm(staging);
    console.log("dry run ok: gate passed, " + staged.files + " files staged and checked, nothing installed");
    return;
  }

  try {
    swap(staging, o.to); // 4. swap
  } catch (e) {
    rm(staging);
    console.log("install failed during the swap, old folders restored: " + e.message);
    process.exit(1);
  }
  rm(staging);

  const final = checkTree(o.to); // 5. the installed tree
  if (!final.ok) {
    console.log("installed tree fails the Play rules");
    for (const v of final.violations) console.log("  " + v);
    process.exit(1);
  }
  console.log("installed " + final.files + " files");
}

main();
