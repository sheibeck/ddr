// test/unit/play-games-intake.test.js
//
// Phase 67 (PGS-01, D-17 / D-20) — the Play Games plugin intake pins.
//
// The user ruled "as-is" on the 67-01 review (D-20): @modbender/capacitor-play-games
// is installed at EXACTLY 0.5.0, unmodified, with no init patch. A plugin
// upgrade is a deliberate, reviewed change (D-17), so this file fails the
// moment the pin drifts: a caret/tilde range, a different version, or a
// tarball whose integrity is not the one 67-01 reviewed.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const PLUGIN = "@modbender/capacitor-play-games";
const PINNED_VERSION = "0.5.0";
const PINNED_INTEGRITY =
  "sha512-GJ7gzDQICQxzPIzKejqYnG9HXnL2/lq5CenHPeDaedkbaYf2hZndj1Xx+F4TtE0PLHp1Da2Ku5W/AMTw5Znb3w==";

const readJson = (rel) => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8"));

// ─── D-17: the exact pin and the reviewed tarball ───────────────────────────

test("D-17: package.json pins the Play Games plugin at exactly 0.5.0 (no range)", () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.dependencies[PLUGIN], PINNED_VERSION);
  assert.ok(!(PLUGIN in (pkg.devDependencies || {})), "the plugin is a runtime dependency, not a dev one");
});

test("D-17: package-lock.json resolves the plugin to 0.5.0 with the 67-01-reviewed integrity", () => {
  const lock = readJson("package-lock.json");
  const entry = lock.packages[`node_modules/${PLUGIN}`];
  assert.ok(entry, "the lockfile carries the plugin entry");
  assert.equal(entry.version, PINNED_VERSION);
  assert.equal(entry.integrity, PINNED_INTEGRITY);
  assert.equal(lock.packages[""].dependencies[PLUGIN], PINNED_VERSION, "the lock root records the exact pin");
});

test("D-17: the plugin brings no npm dependencies of its own along (peer @capacitor/core only)", () => {
  const lock = readJson("package-lock.json");
  const entry = lock.packages[`node_modules/${PLUGIN}`];
  assert.deepEqual(entry.dependencies || {}, {});
  assert.deepEqual(Object.keys(entry.peerDependencies || {}), ["@capacitor/core"]);
});

// ─── T-67-03: the WebView can resolve every bare dynamic import ─────────────
//
// build-www.mjs vendors each CAPACITOR_PACKAGES entry into www/vendor/ and
// maps its bare name in the import map it injects into www/index.html. A
// src/browser module that dynamically imports a bare specifier NOT on that
// list fails to resolve in the Android WebView (the stuck-on-splash bug
// class). This scan turns that into a node test failure instead.

const BUILD_WWW = readFileSync(path.join(REPO_ROOT, "tools", "build-www.mjs"), "utf8");

function vendoredPackages() {
  const m = BUILD_WWW.match(/const CAPACITOR_PACKAGES = \[([\s\S]*?)\];/);
  assert.ok(m, "tools/build-www.mjs declares a CAPACITOR_PACKAGES array literal");
  const body = stripJs(m[1]);
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function browserModules(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...browserModules(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function bareDynamicImports(src) {
  const code = stripJs(src);
  const specs = [];
  for (const m of code.matchAll(/\bimport\s*\(\s*(["'`])([^"'`]+)\1\s*\)/g)) {
    const spec = m[2];
    if (!spec.startsWith(".") && !spec.startsWith("/")) specs.push(spec);
  }
  return specs;
}

test("T-67-03: build-www vendors and import-maps the Play Games plugin", () => {
  const list = vendoredPackages();
  assert.ok(list.includes(PLUGIN), `CAPACITOR_PACKAGES must include ${PLUGIN}`);
  assert.ok(list.includes("@capacitor/core"), "the plugin imports @capacitor/core by bare specifier, so core stays vendored");
});

test("T-67-03: the dynamic-import scanner separates bare, relative and commented specifiers", () => {
  const sample = [
    'const a = await import("@capacitor/app");',
    "const b = await import('./local.js');",
    '// const c = await import("@not/real");',
    '/* await import("@also/not-real") */',
    "const d = await import(`@modbender/capacitor-play-games`);",
  ].join("\n");
  assert.deepEqual(bareDynamicImports(sample), ["@capacitor/app", "@modbender/capacitor-play-games"]);
});

test("T-67-03: every bare-specifier dynamic import in src/browser is on the vendoring list", () => {
  const list = new Set(vendoredPackages());
  const modules = browserModules(path.join(REPO_ROOT, "src", "browser"));
  assert.ok(modules.length > 0, "src/browser holds modules to scan");
  const missing = [];
  let seen = 0;
  for (const file of modules) {
    for (const spec of bareDynamicImports(readFileSync(file, "utf8"))) {
      seen += 1;
      if (!list.has(spec)) missing.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
    }
  }
  assert.ok(seen > 0, "the scan found the existing guarded @capacitor/* dynamic imports");
  assert.deepEqual(missing, [], "bare dynamic imports missing from build-www's CAPACITOR_PACKAGES");
});

// ─── D-15: the APP_ID placeholder resource and manifest meta-data ───────────

const MANIFEST = readFileSync(path.join(REPO_ROOT, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
const GAMES_IDS = readFileSync(
  path.join(REPO_ROOT, "android", "app", "src", "main", "res", "values", "games-ids.xml"),
  "utf8",
);

test("D-15: the manifest carries the PGS APP_ID meta-data pointing at @string/game_services_project_id", () => {
  const re =
    /<meta-data\s+android:name="com\.google\.android\.gms\.games\.APP_ID"\s+android:value="@string\/game_services_project_id"\s*\/>/;
  assert.match(MANIFEST, re);
  assert.equal(MANIFEST.split("com.google.android.gms.games.APP_ID").length - 1, 1, "exactly one APP_ID meta-data");
  const application = MANIFEST.match(/<application[\s\S]*?<\/application>/);
  assert.ok(application && re.test(application[0]), "the meta-data sits inside <application>");
});

test("D-15: the Play Games wiring adds no manifest permission beyond INTERNET", () => {
  const perms = [...MANIFEST.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(perms, ["android.permission.INTERNET"]);
});

test("D-15: games-ids.xml defines game_services_project_id as a non-translatable 12-digit placeholder", () => {
  const m = GAMES_IDS.match(/<string\s+name="game_services_project_id"\s+translatable="false">([^<]*)<\/string>/);
  assert.ok(m, 'games-ids.xml defines game_services_project_id with translatable="false"');
  assert.match(m[1], /^\d{12}$/);
  assert.match(GAMES_IDS, /PLAY-GAMES-SETUP\.md/, "the placeholder comment points at the setup runbook");
});

// ─── D-13: cap sync wires the plugin's Gradle project ───────────────────────

test("D-13: capacitor.settings.gradle includes the plugin's Gradle project from node_modules", () => {
  const settings = readFileSync(path.join(REPO_ROOT, "android", "capacitor.settings.gradle"), "utf8");
  assert.match(settings, /include ':modbender-capacitor-play-games'/);
  assert.match(
    settings,
    /project\(':modbender-capacitor-play-games'\)\.projectDir = new File\('\.\.\/node_modules\/@modbender\/capacitor-play-games\/android'\)/,
  );
});

test("D-13: the app module depends on the plugin's Gradle project", () => {
  const build = readFileSync(path.join(REPO_ROOT, "android", "app", "capacitor.build.gradle"), "utf8");
  assert.match(build, /implementation project\(':modbender-capacitor-play-games'\)/);
});
