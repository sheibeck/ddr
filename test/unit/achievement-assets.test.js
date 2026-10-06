// test/unit/achievement-assets.test.js
//
// Phase 100 (AUI-01/02) asset-side gate for the in-game achievement icons:
// the 77 catalog icons exist under achievements/ingame/ as 144 x 144 PNGs,
// the folder holds exactly that set, the shell's icon path resolves against
// it, and tools/build-www.mjs copies that one folder into the web bundle
// (mirrors sfx-assets.test.js's wiring pins). PNG size is read from the IHDR
// bytes with node:fs only.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { achievementIconSrc } from "../../src/browser/achievementCard.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ACH_DIR = path.join(REPO_ROOT, "achievements");
const INGAME_DIR = path.join(ACH_DIR, "ingame");
const BUILD_WWW_PATH = path.join(REPO_ROOT, "tools", "build-www.mjs");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(file) {
  const buf = readFileSync(file);
  assert.ok(buf.length >= 24, `${file} is too short to be a PNG`);
  assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), `${file} lacks the PNG signature`);
  assert.equal(buf.subarray(12, 16).toString("latin1"), "IHDR", `${file} has no IHDR chunk first`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function buildSource() {
  return readFileSync(BUILD_WWW_PATH, "utf8");
}

// Comment-stripped body of one top-level function in build-www.mjs.
function fnBody(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `expected a function ${name}( definition`);
  const next = code.indexOf("\nfunction ", start + 1);
  const body = next === -1 ? code.slice(start) : code.slice(start, next);
  return body
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

// ─── (1) the catalog icons are on disk ─────────────────────────────────

test("AUI-02: the catalog has 77 entries, each with an icon.ingame path", () => {
  assert.equal(ACHIEVEMENTS.length, 77);
  for (const e of ACHIEVEMENTS) {
    assert.equal(typeof e.icon?.ingame, "string", `${e.id} has no icon.ingame`);
  }
});

test("AUI-02: every entry's achievements/ + icon.ingame exists and is a 144 x 144 PNG", () => {
  for (const e of ACHIEVEMENTS) {
    const file = path.join(ACH_DIR, e.icon.ingame);
    assert.ok(existsSync(file), `${e.id}: ${file} is missing`);
    const { width, height } = pngSize(file);
    assert.equal(width, 144, `${e.id} width`);
    assert.equal(height, 144, `${e.id} height`);
  }
});

test("AUI-02: achievements/ingame/ holds exactly the catalog's 77 icon files", () => {
  const actual = readdirSync(INGAME_DIR).sort();
  const expected = ACHIEVEMENTS.map((e) => path.basename(e.icon.ingame)).sort();
  assert.equal(actual.length, 77);
  assert.equal(new Set(expected).size, 77);
  assert.deepEqual(actual, expected);
});

test("AUI-01: achievementIconSrc(entry) is achievements/ + icon.ingame for every entry", () => {
  for (const e of ACHIEVEMENTS) {
    assert.equal(achievementIconSrc(e), "achievements/" + e.icon.ingame);
  }
});

// ─── (2) build wiring ──────────────────────────────────────────────────

test("AUI-01: build-www.mjs defines copyAchievementIcons() copying achievements/ingame whole", () => {
  const code = buildSource();
  const body = fnBody(code, "copyAchievementIcons");
  assert.match(body, /path\.join\(ROOT,\s*["']achievements["'],\s*["']ingame["']\)/, "source is ROOT/achievements/ingame");
  assert.match(
    body,
    /path\.join\(WWW,\s*["']achievements["'],\s*["']ingame["']\)/,
    "destination is www/achievements/ingame",
  );
  assert.match(body, /cpSync\(/);
  assert.match(body, /recursive:\s*true/);
});

test("T-100-18: copyAchievementIcons() throws loudly, naming the path, when the folder is missing", () => {
  const body = fnBody(buildSource(), "copyAchievementIcons");
  assert.match(body, /existsSync\(/);
  assert.match(body, /throw new Error\(`\$\{src\} does not exist/);
});

test("T-100-19: copyAchievementIcons() names no other achievements sub-folder (play, master, sources, frames)", () => {
  const body = fnBody(buildSource(), "copyAchievementIcons");
  for (const dir of ["play", "master", "sources", "frames"]) {
    assert.equal(new RegExp(`["']${dir}["']|/${dir}\\b`).test(body), false, `must not name ${dir}`);
  }
});

test("AUI-01: main() calls copyAchievementIcons(); strictly after copyIcons();", () => {
  const code = buildSource();
  const mainStart = code.indexOf("function main(");
  assert.ok(mainStart !== -1);
  const main = code.slice(mainStart);
  const icons = main.indexOf("copyIcons();");
  const ach = main.indexOf("copyAchievementIcons();");
  assert.ok(icons !== -1, "expected copyIcons(); in main()");
  assert.ok(ach > icons, "expected copyAchievementIcons(); after copyIcons();");
});
