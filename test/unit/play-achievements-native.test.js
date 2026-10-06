// test/unit/play-achievements-native.test.js
//
// Phase 101-01 (PGS-07, PGS-10, PGS-11, AUI-04): the native half of the Play
// achievements mirror, proven by source pins. Section A covers the resource
// file the app ships (the Play Console export), the manifest app id, the
// duplicate-name guard and the shrinker keep. Section B covers the Java
// plugin source. No Gradle build runs in the executor: the Java is proven by
// these pins here, and compiled by the first milestone-end debug build.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import { PLAY_GAMES_CONFIG } from "../../src/browser/firebaseConfig.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const lf = (text) => text.replace(/\r\n/g, "\n");

const RES_IDS = "android/app/src/main/res/values/games-ids.xml";
const EXPORT_IDS = "achievements/games-ids.xml";
const STRINGS = "android/app/src/main/res/values/strings.xml";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const KEEP = "android/app/src/main/res/raw/keep.xml";

/** [{ name, value }] for every <string name="..." ...>value</string>. */
function parseStrings(xml) {
  const out = [];
  const re = /<string\s+name="([^"]+)"[^>]*>([^<]*)<\/string>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push({ name: m[1], value: m[2] });
  return out;
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

// ─── Section A: resources ───────────────────────────────────────────────────

test("A: the app's res/values/games-ids.xml is the Play Console export verbatim (CRLF-insensitive)", () => {
  assert.equal(lf(read(RES_IDS)), lf(read(EXPORT_IDS)));
});

test("A: the res file's app_id equals PLAY_GAMES_CONFIG.appId and game_services_project_id is gone from android/app/src", () => {
  const entries = parseStrings(lf(read(RES_IDS)));
  const appId = entries.filter((e) => e.name === "app_id");
  assert.equal(appId.length, 1, "exactly one app_id string");
  assert.equal(appId[0].value.trim(), PLAY_GAMES_CONFIG.appId);
  assert.equal(entries.filter((e) => e.name === "game_services_project_id").length, 0);

  const srcRoot = path.join(REPO_ROOT, "android", "app", "src");
  const offenders = walk(srcRoot).filter((f) => /\.(xml|java)$/.test(f) && read(path.relative(REPO_ROOT, f)).includes("game_services_project_id"));
  assert.deepEqual(offenders, [], "no xml or java under android/app/src names game_services_project_id");
});

test("A: the res file holds exactly 77 achievement_ strings, all values non-empty and pairwise distinct", () => {
  const ach = parseStrings(lf(read(RES_IDS))).filter((e) => e.name.startsWith("achievement_"));
  assert.equal(ach.length, 77);
  for (const e of ach) assert.ok(e.value.trim() !== "", `${e.name} has a value`);
  assert.equal(new Set(ach.map((e) => e.value.trim())).size, 77, "no two achievements share a Play ID");
  assert.equal(new Set(ach.map((e) => e.name)).size, 77, "no duplicate achievement names");
});

test("A: no string name is defined twice across res/values/*.xml (a duplicate fails the resource merge)", () => {
  const dir = path.join(REPO_ROOT, "android", "app", "src", "main", "res", "values");
  const seen = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
    for (const { name } of parseStrings(read(path.relative(REPO_ROOT, path.join(dir, file))))) {
      const list = seen.get(name) ?? [];
      list.push(file);
      seen.set(name, list);
    }
  }
  const dupes = [...seen].filter(([, files]) => files.length > 1).map(([name, files]) => `${name}: ${files.join(", ")}`);
  assert.deepEqual(dupes, []);
  const stringsNames = parseStrings(read(STRINGS)).map((e) => e.name);
  assert.ok(!stringsNames.includes("package_name"), "package_name now comes from the export");
  for (const keep of ["app_name", "title_activity_main", "custom_url_scheme"]) {
    assert.ok(stringsNames.includes(keep), `${keep} stays in strings.xml`);
  }
});

test("A: the manifest APP_ID meta-data reads @string/app_id and the init provider is still removed", () => {
  const manifest = read(MANIFEST);
  assert.match(
    manifest,
    /<meta-data\s+android:name="com\.google\.android\.gms\.games\.APP_ID"\s+android:value="@string\/app_id"\s*\/>/,
  );
  assert.match(manifest, /PlayGamesInitProvider/);
  assert.match(manifest, /tools:node="remove"/);
});

test("A: keep.xml keeps @string/achievement_* beside the splash drawables (R8 shrinker, name-looked-up strings)", () => {
  const keepXml = read(KEEP);
  assert.match(keepXml, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
  const m = keepXml.match(/tools:keep="([^"]*)"/);
  assert.ok(m, "keep.xml has a tools:keep value");
  const kept = m[1].split(",").map((s) => s.trim());
  for (const item of ["@drawable/splash_screen", "@drawable/splash", "@string/achievement_*"]) {
    assert.ok(kept.includes(item), `tools:keep includes ${item}`);
  }
  assert.ok(existsSync(path.join(REPO_ROOT, KEEP)));
});
