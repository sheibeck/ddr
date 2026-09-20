// test/unit/shell-no-content-copies.test.js
//
// Phase 44 (DEAD-02), Plan 03 — ROADMAP success criterion 3's source pin.
// mazeworld.html's classic <script> and <script type="module"> declare no
// second copy of any content/ export: content/ is the single source, the
// classic tables are gone, and the Hero-tab dossier reads
// window.__mzTables (module-assigned from content/index.js) instead of a
// classic mirror. This file must keep failing for ANY future classic copy
// of a content/ table — the name set is derived from Object.keys(content)
// at test time, never a hand-written list, so a new content/ export is
// automatically covered without touching this file.
//
// Mirrors test/unit/shell-map-invariants.test.js's source-assertion pattern
// (fs.readFileSync + a comment-stripped CODE constant, line comments
// stripped BEFORE block comments) since mazeworld.html has no ESM module
// surface a test could import directly.
//
// MZ_HTML: an env var override for the shipped-source path, used to prove
// this pin has teeth against a scratch copy with an injected classic table
// copy (see 44-03-SUMMARY.md's fail-first output) without ever touching the
// real mazeworld.html.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import * as content from "../../content/index.js";
import { RACE_NOTE, CLASS_NOTE, SUB_NOTE } from "../../content/flavor.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = process.env.MZ_HTML || path.join(REPO_ROOT, "mazeworld.html");
const RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — same
// order-sensitive approach as the sibling shell-*.test.js files) ──────────
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

// ─── classic <script> / <script type="module"> region split ───────────────
// Both tag lines sit at column 0 in mazeworld.html, one per line, so a plain
// indexOf on the newline-bounded tag text finds the real boundaries and
// never a coincidental in-string match.
function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  const modStart = raw.indexOf('\n<script type="module">\n', classicEnd);
  assert.ok(modStart !== -1, 'column-0 <script type="module"> tag not found');
  const modEnd = raw.indexOf("\n</script>\n", modStart + 1);
  assert.ok(modEnd !== -1, "module </script> tag not found");
  return {
    classic: raw.slice(classicStart + 1, classicEnd),
    mod: raw.slice(modStart + 1, modEnd),
  };
}

const { classic: CLASSIC_RAW, mod: MOD_RAW } = extractScriptRegions(RAW);
const CLASSIC = stripComments(CLASSIC_RAW);
const MOD = stripComments(MOD_RAW);

// Phase 47 (SHELL-02), Plan 04: the Hero-tab dossier moved out of the
// classic script's paint() into src/browser/heroTab.js, which imports
// RACE_NOTE/CLASS_NOTE/SUB_NOTE directly (a module CAN import content/) — no
// bridge needed for a module-owned reader.
const HERO_TAB_PATH = path.join(REPO_ROOT, "src", "browser", "heroTab.js");
const HERO_SRC = stripComments(fs.readFileSync(HERO_TAB_PATH, "utf8").replace(/\r\n/g, "\n"));

function countOf(source, sub) {
  let c = 0;
  let i = 0;
  while ((i = source.indexOf(sub, i)) !== -1) {
    c++;
    i += sub.length;
  }
  return c;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── 1. no classic copy of any content/ export ─────────────────────────────

test("DEAD-02: mazeworld.html declares no copy of any content/ export (classic or module script)", () => {
  const names = Object.keys(content);
  assert.ok(names.length >= 70, `expected content/index.js to re-export at least 70 names, found ${names.length}`);
  const offenders = [];
  for (const name of names) {
    // import { NAME } / import { NAME, OTHER } lines are bindings, not
    // declarations — the regex only matches an actual const/let/var/
    // function/async function declaration of NAME.
    const re = new RegExp(`^\\s*(?:const|let|var|function|async function)\\s+${escapeRegExp(name)}\\b`, "m");
    if (re.test(CLASSIC)) offenders.push(`${name} (classic script)`);
    if (re.test(MOD)) offenders.push(`${name} (module script)`);
  }
  assert.deepEqual(offenders, [], `mazeworld.html must not re-declare any content/ export:\n${offenders.join("\n")}`);
});

// ─── 2. the Hero-tab dossier reads RACE_NOTE/CLASS_NOTE/SUB_NOTE directly ──

// Phase 47 (SHELL-02), Plan 04: the dossier's own render body moved into
// src/browser/heroTab.js, which imports RACE_NOTE/CLASS_NOTE/SUB_NOTE
// directly from content/index.js — no bridge needed for a module-owned
// reader. mazeworld.html (classic AND module script) must carry ZERO such
// reads now (the __mzTables bridge for these three names is gone).
test("DEAD-02: the Hero-tab dossier reads RACE_NOTE/CLASS_NOTE/SUB_NOTE directly in heroTab.js; mazeworld.html has zero such reads", () => {
  assert.equal(countOf(HERO_SRC, "RACE_NOTE[c.race]"), 1);
  assert.equal(countOf(HERO_SRC, "CLASS_NOTE[c.cls]"), 1);
  assert.equal(countOf(HERO_SRC, "SUB_NOTE[c.sub]"), 1);
  for (const name of ["RACE_NOTE", "CLASS_NOTE", "SUB_NOTE"]) {
    assert.equal(countOf(CLASSIC, name), 0, `mazeworld.html classic script must not read ${name}`);
    assert.equal(countOf(MOD, name), 0, `mazeworld.html module script must not read ${name}`);
  }
});

// ─── 3. the module assigns window.__mzTables (ROMAN only) before boot() ────

// Phase 47 (SHELL-02), Plan 04: RACE_NOTE/CLASS_NOTE/SUB_NOTE/THRESHOLDS/
// WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES all lost their last classic
// reader (moved into heroTab.js/gearTab.js, which import content/ directly)
// — __mzTables shrinks to the one key the classic script still reads.
test("DEAD-02: the module assigns window.__mzTables (ROMAN only) from content/index.js before boot()", () => {
  const importLine = 'import { ROMAN } from "./content/index.js";';
  const bridgeLine = "window.__mzTables = Object.freeze({ ROMAN });";
  assert.equal(countOf(MOD, importLine), 1, "the separate content/index.js import line must appear exactly once");
  assert.equal(countOf(MOD, bridgeLine), 1, "the window.__mzTables bridge assignment must appear exactly once");
  const bridgeIdx = MOD.indexOf(bridgeLine);
  const bootIdx = MOD.indexOf("await boot(");
  assert.ok(bootIdx !== -1, "await boot( call not found in the module script");
  assert.ok(bridgeIdx < bootIdx, "window.__mzTables must be assigned before await boot(...) runs");
});

// ─── 4. every surviving classic read goes through window.__mzTables; the ──
// ─── seven retired keys have zero classic reads ────────────────────────────

test("DEAD-02: every surviving classic read of ROMAN goes through window.__mzTables; the seven retired keys have zero classic reads", () => {
  const survivors = ["ROMAN"];
  const bareRe = new RegExp(`(^|[^.\\w])(${survivors.join("|")})\\[`, "g");
  const bareMatches = CLASSIC.match(bareRe) || [];
  assert.equal(bareMatches.length, 0, `no bare classic read of a survivor table may remain: ${bareMatches.join(", ")}`);
  for (const name of survivors) {
    const bridged = countOf(CLASSIC, `window.__mzTables.${name}`);
    assert.ok(bridged >= 1, `expected at least one window.__mzTables.${name} read in the classic script, found ${bridged}`);
  }
  const retired = ["THRESHOLDS", "WEAPONS", "FIGHTER_SKILLS", "THIEF_SKILLS", "RACES"];
  for (const name of retired) {
    assert.equal(countOf(CLASSIC, `window.__mzTables.${name}`), 0, `window.__mzTables.${name} must have zero classic readers`);
  }
});

// ─── 5. dossier byte-equality — 24 SUB_NOTE, 6 RACE_NOTE, 3 CLASS_NOTE ──────

test("DEAD-02: all 24 SUB_NOTE, 6 RACE_NOTE and 3 CLASS_NOTE dossier strings are byte-equal (===) to content/flavor.js and appear nowhere in mazeworld.html", () => {
  assert.equal(Object.keys(SUB_NOTE).length, 24);
  assert.equal(Object.keys(RACE_NOTE).length, 6);
  assert.equal(Object.keys(CLASS_NOTE).length, 3);

  // Built the same way the module assigns window.__mzTables — a plain
  // object pulled straight from the content/index.js barrel re-export.
  const tables = { RACE_NOTE: content.RACE_NOTE, CLASS_NOTE: content.CLASS_NOTE, SUB_NOTE: content.SUB_NOTE };

  for (const k of Object.keys(SUB_NOTE)) {
    assert.equal(tables.SUB_NOTE[k], SUB_NOTE[k], `SUB_NOTE.${k} must be byte-equal to content/flavor.js`);
  }
  for (const k of Object.keys(RACE_NOTE)) {
    assert.equal(tables.RACE_NOTE[k], RACE_NOTE[k], `RACE_NOTE.${k} must be byte-equal to content/flavor.js`);
  }
  for (const k of Object.keys(CLASS_NOTE)) {
    assert.equal(tables.CLASS_NOTE[k], CLASS_NOTE[k], `CLASS_NOTE.${k} must be byte-equal to content/flavor.js`);
  }

  // The shell reaches this text only through the bridge — none of the 33
  // exported strings may occur verbatim in the raw file.
  const leaked = [];
  for (const [table, obj] of [["SUB_NOTE", SUB_NOTE], ["RACE_NOTE", RACE_NOTE], ["CLASS_NOTE", CLASS_NOTE]]) {
    for (const [k, str] of Object.entries(obj)) {
      if (RAW.includes(str)) leaked.push(`${table}.${k}`);
    }
  }
  assert.deepEqual(leaked, [], `these dossier strings must not appear verbatim in mazeworld.html: ${leaked.join(", ")}`);
});

// ─── 6. criterion 3 widened: no classic/module copy of any src/browser/
// export (Phase 47, SHELL-04 closing gate) ──────────────────────────────────
//
// mazeworld.html must not re-declare, under its OWN name, anything any
// src/browser/*.js module already exports — the module carve's whole point
// (gearTab.js, heroTab.js, storeScreen.js and every other src/browser/
// module) is that the shell reads these through an import/bridge, never a
// second copy. The export-name set is derived from every module's own
// `export` statements at test time, never a hand-written list, so a future
// src/browser/ export is automatically covered without touching this file.

const SRC_BROWSER_DIR = path.join(REPO_ROOT, "src", "browser");

/**
 * exportNamesOf(source) — every top-level export binding name a module
 * declares: `export (async )?(const|let|var|function|class) NAME` and
 * `export { a, b as c }` lists (the re-exported/aliased NAME, `c` above, is
 * the one that matters — that is the name a classic-script declaration
 * would collide with).
 */
function exportNamesOf(source) {
  const names = new Set();
  const declRe = /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let m;
  while ((m = declRe.exec(source))) names.add(m[1]);
  const listRe = /^export\s*\{([^}]*)\}/gm;
  while ((m = listRe.exec(source))) {
    for (const rawPart of m[1].split(",")) {
      const piece = rawPart.trim();
      if (!piece) continue;
      const asMatch = piece.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      names.add(asMatch ? asMatch[2] : piece);
    }
  }
  return names;
}

function allSrcBrowserExportNames() {
  const files = fs.readdirSync(SRC_BROWSER_DIR).filter((f) => f.endsWith(".js"));
  const byModule = new Map();
  for (const file of files) {
    const src = fs.readFileSync(path.join(SRC_BROWSER_DIR, file), "utf8").replace(/\r\n/g, "\n");
    byModule.set(file, exportNamesOf(src));
  }
  return byModule;
}

test("criterion 3: mazeworld.html declares no duplicate of any src/browser export (gearTab.js, heroTab.js, storeScreen.js, viewModels.js, bridge.js, ... every module)", () => {
  const byModule = allSrcBrowserExportNames();
  const allNames = new Set();
  for (const names of byModule.values()) for (const n of names) allNames.add(n);
  assert.ok(allNames.size >= 100, `expected at least 100 src/browser export names across every module, found ${allNames.size}`);

  const offenders = [];
  for (const [moduleFile, names] of byModule) {
    for (const name of names) {
      const re = new RegExp(`^\\s*(?:const|let|var|function|async function)\\s+${escapeRegExp(name)}\\b`, "m");
      if (re.test(CLASSIC)) offenders.push(`${name} (src/browser/${moduleFile} export, re-declared in the classic script)`);
      if (re.test(MOD)) offenders.push(`${name} (src/browser/${moduleFile} export, re-declared in the module script)`);
    }
  }
  assert.deepEqual(offenders, [], `mazeworld.html must not re-declare any src/browser export:\n${offenders.join("\n")}`);
});
