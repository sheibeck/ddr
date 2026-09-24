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
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

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
