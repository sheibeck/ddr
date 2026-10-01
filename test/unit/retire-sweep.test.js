// test/unit/retire-sweep.test.js
//
// RETIRE-02 (Phase 85), reworked in Phase 91.2: the retired leaderboard
// artefacts and the community plugin never come back.
//
// Phase 91.2 (BOARD-31/33) brings Play Games back for SIGN-IN ONLY, as the
// in-repo PlayIdentity plugin on the first-party Play Games Services v2 SDK.
// So the Play Games identifiers (play-games wording, the APP_ID string
// resource, gms.games, games-ids.xml) are no longer swept. Still retired,
// and still swept: the leaderboard modules and helpers (leaderboardIdsFor,
// LEADERBOARD_IDS, scoreTag, globalBoards, boardScores,
// createSubmissionQueue), the retired submission-queue key, and the
// community plugin (modbender, idleflowgames, any play-games key in
// package.json / package-lock.json).
//
// Scope: shipped code only — src/ and content/ (recursive .js/.mjs), the
// classic shell (mazeworld.html), tools/build-www.mjs, and the tracked text
// sources under android/ (the manifest, every .xml under
// android/app/src/main/res/, every .java under android/app/src/, the
// proguard rules and the six tracked Gradle files). docs/, archived
// .planning, test/ and engine/ are all out of scope — engine/ comments are
// frozen by the engine gate (STATE.md).
//
// The one allowlisted literal: src/browser/boardSync.js#RETIRED_KEYS holds
// the string "ddr.pgsqueue.v1" — the one retired pre-2.2 submission-queue
// storage key, dropped silently at every boot (RETIRE-03). It must stay so
// the drop keeps happening; this file allowlists exactly that one
// occurrence in that one file before running the raw sweep.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import { RETIRED_KEYS } from "../../src/browser/boardSync.js";
import { SETTINGS_DEFAULTS } from "../../src/browser/settings.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const rel = (p) => path.relative(REPO_ROOT, p).split(path.sep).join("/");

// ─── the retired-identifier sweep patterns ──────────────────────────────────

const SWEEP_PATTERNS = [
  "modbender",
  "idleflowgames",
  "leaderboardIdsFor",
  "LEADERBOARD_IDS",
  "scoreTag",
  "globalBoards",
  "boardScores",
  "createSubmissionQueue",
];

/** matcherFor(source) — a fresh case-insensitive RegExp for one sweep pattern. */
function matcherFor(source) {
  return new RegExp(source, "i");
}

/** Every file:line (1-based) matching ANY sweep pattern in `content`. */
function sweepText(content, filePath) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SWEEP_PATTERNS) {
      if (matcherFor(pattern).test(lines[i])) {
        hits.push(`${rel(filePath)}:${i + 1}: [${pattern}] ${lines[i].trim()}`);
      }
    }
  }
  return hits;
}

// ─── the shipped-code file set ───────────────────────────────────────────────

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

function shippedCodeFiles() {
  const files = [];
  files.push(...walk(path.join(REPO_ROOT, "src"), [".js", ".mjs"]));
  files.push(...walk(path.join(REPO_ROOT, "content"), [".js", ".mjs"]));
  files.push(path.join(REPO_ROOT, "mazeworld.html"));
  files.push(path.join(REPO_ROOT, "tools", "build-www.mjs"));

  // Tracked android text sources — never android/app/src/main/assets/ (the
  // cap-sync-generated copy) or android/app/build/ (build output).
  const manifest = path.join(REPO_ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
  if (existsSync(manifest)) files.push(manifest);
  const resDir = path.join(REPO_ROOT, "android", "app", "src", "main", "res");
  files.push(...walk(resDir, [".xml"]));
  const srcDir = path.join(REPO_ROOT, "android", "app", "src");
  for (const f of walk(srcDir, [".java"])) {
    if (!rel(f).includes("/assets/")) files.push(f);
  }
  for (const g of [
    "proguard-rules.pro",
    path.join("app", "proguard-rules.pro"),
  ]) {
    const p = path.join(REPO_ROOT, "android", g);
    if (existsSync(p) && !files.includes(p)) files.push(p);
  }
  for (const g of ["build.gradle", "settings.gradle", "variables.gradle", "capacitor.settings.gradle"]) {
    const p = path.join(REPO_ROOT, "android", g);
    if (existsSync(p)) files.push(p);
  }
  for (const g of ["build.gradle", "capacitor.build.gradle"]) {
    const p = path.join(REPO_ROOT, "android", "app", g);
    if (existsSync(p)) files.push(p);
  }
  return [...new Set(files)];
}

// ─── behavior: the retired files are gone ───────────────────────────────────

test("the retired module files and their test files do not exist", () => {
  const gone = [
    "src/browser/playGames.js",
    "src/browser/pgsQueue.js",
    "src/browser/globalBoards.js",
    "src/browser/boardScores.js",
    "src/browser/scoreTag.js",
    "content/leaderboards.js",
    "test/unit/playGames.test.js",
    "test/unit/pgsQueue.test.js",
    "test/unit/pgsQueue-flush.test.js",
    "test/unit/globalBoards.test.js",
    "test/unit/boardScores.test.js",
    "test/unit/scoreTag.test.js",
    "test/unit/play-games-intake.test.js",
    "test/unit/board-global-trace.test.js",
  ];
  for (const p of gone) {
    assert.equal(existsSync(path.join(REPO_ROOT, p)), false, `${p} must not exist`);
  }
});

// ─── behavior: the one allowlisted occurrence ───────────────────────────────

const BOARD_SYNC_PATH = path.join(REPO_ROOT, "src", "browser", "boardSync.js");
const ALLOWLISTED_LITERAL = "ddr.pgsqueue.v1";

test("src/browser/boardSync.js contains the retired queue-key string exactly once, and RETIRED_KEYS is exactly that key plus the 2.2 re-roll mark", () => {
  const content = readFileSync(BOARD_SYNC_PATH, "utf8");
  const count = content.split(ALLOWLISTED_LITERAL).length - 1;
  assert.equal(count, 1, `expected exactly one occurrence of ${JSON.stringify(ALLOWLISTED_LITERAL)} in boardSync.js, found ${count}`);
  // Phase 91.2 D-11: the re-roll's pending-rewrite mark is dropped at boot too.
  assert.deepEqual([...RETIRED_KEYS], [ALLOWLISTED_LITERAL, "ddr.handleRewrite.v1"]);
});

// ─── behavior: the raw sweep over shipped code ──────────────────────────────

test("RETIRE-02: no shipped-code file matches a retired-service identifier, outside the one allowlisted boardSync.js literal", () => {
  const failures = [];
  for (const file of shippedCodeFiles()) {
    let content = readFileSync(file, "utf8");
    if (file === BOARD_SYNC_PATH) {
      // The one allowlisted occurrence is removed before this file's own sweep.
      content = content.split(ALLOWLISTED_LITERAL).join("");
    }
    failures.push(...sweepText(content, file));
  }
  assert.deepEqual(failures, [], `retired-service identifiers found:\n${failures.join("\n")}`);
});

// ─── behavior: package.json / package-lock.json carry no plugin key ────────

test("package.json has no dependency or devDependency key matching play-games", () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const keys = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  assert.deepEqual(
    keys.filter((k) => /play-games/i.test(k)),
    [],
  );
});

test("package-lock.json has no packages entry or dependency naming the plugin package", () => {
  const lock = JSON.parse(readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8"));
  const packageKeys = Object.keys(lock.packages || {});
  assert.deepEqual(
    packageKeys.filter((k) => /play-games/i.test(k)),
    [],
  );
  for (const [name, entry] of Object.entries(lock.packages || {})) {
    const deps = { ...(entry.dependencies || {}), ...(entry.peerDependencies || {}), ...(entry.devDependencies || {}) };
    for (const depName of Object.keys(deps)) {
      assert.equal(/play-games/i.test(depName), false, `${name} depends on ${depName}`);
    }
  }
});

// ─── behavior: SETTINGS_DEFAULTS has no pgs* key ────────────────────────────

test("Object.keys(SETTINGS_DEFAULTS) has no key starting with pgs", () => {
  const pgsKeys = Object.keys(SETTINGS_DEFAULTS).filter((k) => /^pgs/i.test(k));
  assert.deepEqual(pgsKeys, []);
});

// ─── self-check: the sweep cannot pass vacuously ────────────────────────────

test("self-check: every sweep pattern catches a planted line", () => {
  const planted = {
    modbender: "// @modbender/capacitor-play-games used to live here",
    idleflowgames: "// com.idleflowgames.playgames.PlayGamesPlugin",
    leaderboardIdsFor: "const ids = leaderboardIdsFor(sub);",
    LEADERBOARD_IDS: "import { LEADERBOARD_IDS } from \"./leaderboards.js\";",
    scoreTag: "import { encode } from \"./scoreTag.js\";",
    globalBoards: "import { createGlobalBoards } from \"./globalBoards.js\";",
    boardScores: "import { decode } from \"./boardScores.js\";",
    createSubmissionQueue: "const queue = createSubmissionQueue();",
  };
  for (const pattern of SWEEP_PATTERNS) {
    const line = planted[pattern];
    assert.ok(line, `no planted example for pattern ${pattern}`);
    assert.ok(matcherFor(pattern).test(line), `pattern ${pattern} did not match its own planted line: ${line}`);
  }
  // And the whole-pattern-set sweep function agrees.
  for (const [pattern, line] of Object.entries(planted)) {
    const hits = sweepText(line, "planted.js");
    assert.ok(
      hits.some((h) => h.includes(`[${pattern}]`)),
      `sweepText missed pattern ${pattern} on its own planted line`,
    );
  }
});
