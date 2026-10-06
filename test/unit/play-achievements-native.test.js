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

// ─── Section B: Java source pins ────────────────────────────────────────────

const PLUGIN_PATH = "android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java";
const PLUGIN_RAW = lf(read(PLUGIN_PATH));
const stripJava = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const CODE = stripJava(PLUGIN_RAW);
const occurrences = (text, needle) => text.split(needle).length - 1;

/** Text of `text` from the first `from` up to the next `to` after it (or the end). */
function slice(text, from, to) {
  const a = text.indexOf(from);
  assert.ok(a >= 0, `missing: ${from}`);
  const b = to === undefined ? -1 : text.indexOf(to, a + from.length);
  return b === -1 ? text.slice(a) : text.slice(a, b);
}

test("B: the @PluginMethod names in order, and exactly one @ActivityCallback (achievementsClosed)", () => {
  const methods = [...CODE.matchAll(/@PluginMethod\s+public void (\w+)\(/g)].map((m) => m[1]);
  assert.deepEqual(methods, [
    "buildInfo",
    "init",
    "status",
    "signIn",
    "serverAuthCode",
    "syncAchievements",
    "showAchievements",
  ]);
  assert.equal(occurrences(CODE, "@ActivityCallback"), 1, "one annotation use");
  const cb = [...CODE.matchAll(/@ActivityCallback\s+private void (\w+)\(PluginCall call, ActivityResult result\)/g)];
  assert.equal(cb.length, 1);
  assert.equal(cb[0][1], "achievementsClosed");
});

test("B: ensureInit(); is called from six methods, the SDK starts from one site, buildInfo touches no Play API", () => {
  assert.equal(occurrences(CODE, "ensureInit();"), 6, "init, status, signIn, serverAuthCode, syncAchievements and showAchievements");
  assert.equal(occurrences(CODE, "PlayGamesSdk.initialize("), 1);
  const body = slice(CODE, "public void buildInfo(PluginCall call) {", "@PluginMethod");
  for (const banned of ["ensureInit", "initSdkOnce", "PlayGamesSdk", "PlayGames."]) {
    assert.ok(!body.includes(banned), `buildInfo must not touch ${banned}`);
  }
  // Both new methods run ensureInit() inside their own body.
  assert.match(slice(CODE, "public void syncAchievements(PluginCall call) {", "private void runAchievementOps"), /ensureInit\(\);/);
  assert.match(slice(CODE, "public void showAchievements(PluginCall call) {", "@ActivityCallback"), /ensureInit\(\);/);
});

test("B: syncAchievements checks isAuthenticated() before the achievements client and validates its ops", () => {
  const section = slice(CODE, "public void syncAchievements(PluginCall call) {", "public void showAchievements(PluginCall call) {");
  const auth = section.indexOf("isAuthenticated()");
  const client = section.indexOf("getAchievementsClient(");
  assert.ok(auth >= 0 && client > auth, "isAuthenticated() before getAchievementsClient(");
  assert.match(section, /call\.resolve\(failure\("signin"\)\)/);
  // Batch bounds and the resource pattern.
  assert.match(CODE, /Pattern\.compile\("\^achievement_\[a-z0-9_\]\{1,80\}\$"\)/);
  assert.match(CODE, /MAX_OPS = 20;/);
  assert.match(section, /ops\.length\(\) < 1 \|\| ops\.length\(\) > MAX_OPS/);
  assert.match(CODE, /MIN_STEPS = 1;/);
  assert.match(CODE, /MAX_STEPS = 10000;/);
  assert.match(section, /RESOURCE_PATTERN\.matcher\(resource\)\.matches\(\)/);
  // The lookup is by name, string resources, this package; 0 is a per-op config no-op.
  assert.match(section, /getIdentifier\(resource, "string", getContext\(\)\.getPackageName\(\)\)/);
  assert.match(PLUGIN_RAW, /@SuppressLint\("DiscouragedApi"\)/);
  assert.match(section, /if \(resId == 0\) \{\s*reason = "config";/);
  // Closed kind set.
  for (const kind of ["unlock", "reveal", "steps"]) assert.match(section, new RegExp(`"${kind}"\\.equals\\(kind\\)`));
});

test("B: the batch runs one op at a time, each Task chained from the previous completion", () => {
  const run = slice(CODE, "private void runAchievementOps(", "private int achievementStringId");
  assert.match(run, /task\.addOnCompleteListener\(done ->/);
  assert.match(run, /runAchievementOps\(call, client, ops, index \+ 1, results\)/);
  // No loop over the ops: the only advance is the recursive hand-off.
  assert.ok(!/\bfor\s*\(|\bwhile\s*\(/.test(run), "no loop starts several Tasks at once");
  // Stops at network or signin.
  assert.match(run, /"network"\.equals\(answer\) \|\| "signin"\.equals\(answer\)/);
  assert.match(run, /call\.resolve\(syncAnswer\(results\)\)/);
  // Each result carries i, ok and (when not ok) a reason.
  const append = slice(CODE, "private static void appendAchievementResult(", "private static JSObject syncAnswer");
  assert.match(append, /entry\.put\("i", index\)/);
  assert.match(append, /entry\.put\("ok", reason == null\)/);
  assert.match(append, /entry\.put\("reason", reason\)/);
});

test("B: only unlockImmediate, revealImmediate, setStepsImmediate and getAchievementsIntent are called on the achievements client", () => {
  for (const used of ["unlockImmediate(", "revealImmediate(", "setStepsImmediate(", "getAchievementsIntent("]) {
    assert.ok(CODE.includes(used), `uses ${used}`);
  }
  // No other achievements-client method: no bare unlock/reveal/setSteps, no counting call of either form.
  assert.ok(!/\.(unlock|reveal|setSteps)\(/.test(CODE), "no fire-and-forget call");
  assert.ok(!/\bincrement(Immediate)?\s*\(/.test(CODE), "the counting call never appears (the status-code name NOT_INCREMENTAL is not a call)");
  const clientCalls = [...CODE.matchAll(/\b(?:client|getAchievementsClient\([^)]*\))\s*\.\s*(\w+)\(/g)].map((m) => m[1]);
  assert.ok(clientCalls.length >= 3, "the client is called for the three op kinds");
  for (const name of clientCalls) {
    assert.ok(["unlockImmediate", "revealImmediate", "setStepsImmediate", "getAchievementsIntent"].includes(name), `client.${name}`);
  }
  // Absolute steps: the n handed over is the only value sent.
  assert.match(CODE, /client\.setStepsImmediate\(playId, \(int\) n\)/);
});

test("B: showAchievements and achievementsClosed launch and release through the Capacitor activity-result path", () => {
  const show = slice(CODE, "public void showAchievements(PluginCall call) {", "@ActivityCallback");
  const auth = show.indexOf("isAuthenticated()");
  const intent = show.indexOf("getAchievementsIntent()");
  assert.ok(auth >= 0 && intent > auth, "signed-in check before the intent");
  assert.match(show, /call\.resolve\(failure\("signin"\)\)/);
  assert.match(show, /startActivityForResult\(call, intent, "achievementsClosed"\)/);
  assert.match(show, /call\.resolve\(failure\(reason == null \? "error" : reason\)\)/);
  const closed = slice(CODE, "private void achievementsClosed(PluginCall call, ActivityResult result) {", "private void resolveFromAuth");
  assert.match(closed, /if \(call == null\) \{\s*return;/);
  assert.match(closed, /out\.put\("ok", true\);/);
  assert.match(closed, /getBridge\(\)\.releaseCall\(call\)/);
  assert.ok(!/result\./.test(closed), "the result code is never read: ok whatever the player did");
});

test("B: ApiException codes map to reasons through named private static final int constants", () => {
  const constants = {
    CODE_SIGN_IN_REQUIRED: 4,
    CODE_NETWORK_ERROR: 26506,
    CODE_APP_MISCONFIGURED: 26508,
    CODE_ACHIEVEMENT_UNLOCK_FAILURE: 26560,
    CODE_ACHIEVEMENT_UNKNOWN: 26561,
    CODE_ACHIEVEMENT_NOT_INCREMENTAL: 26562,
    CODE_ACHIEVEMENT_UNLOCKED: 26563,
  };
  for (const [name, value] of Object.entries(constants)) {
    assert.match(CODE, new RegExp(`private static final int ${name} = ${value};`), `${name} = ${value}`);
  }
  const map = slice(CODE, "private static String reasonFor(Exception e) {", "@PluginMethod");
  assert.match(map, /case CODE_NETWORK_ERROR:\s*return "network";/);
  assert.match(map, /case CODE_SIGN_IN_REQUIRED:\s*return "signin";/);
  assert.match(map, /case CODE_ACHIEVEMENT_UNKNOWN:\s*return "unknown";/);
  assert.match(map, /case CODE_ACHIEVEMENT_UNLOCK_FAILURE:\s*case CODE_ACHIEVEMENT_NOT_INCREMENTAL:\s*return "type";/);
  assert.match(map, /case CODE_APP_MISCONFIGURED:\s*return "config";/);
  assert.match(map, /case CODE_ACHIEVEMENT_UNLOCKED:\s*return null;/);
  assert.match(map, /default:\s*return "error";/);
  assert.match(map, /if \(!\(e instanceof ApiException\)\) \{\s*return "error";/);
});

test("B: no reject call, no logging, no Play ID literal, no scope constants; the header keeps its gate heading", () => {
  assert.ok(!CODE.includes("call.reject("), "every method resolves, none rejects");
  assert.ok(!PLUGIN_RAW.includes("call.reject("), "not even in a comment");
  assert.ok(!/\bLog\.[a-z]\(/.test(PLUGIN_RAW), "the plugin never logs");
  assert.ok(!/System\.out|printStackTrace/.test(PLUGIN_RAW), "no other output channel either");
  // Built from two halves so this test never matches itself.
  const needle = "Cg" + "kI";
  assert.ok(!PLUGIN_RAW.includes(needle), "no Play ID literal");
  assert.ok(!/AuthScope|PROFILE|OPEN_ID/.test(CODE), "no scope constants outside comments");
  assert.match(PLUGIN_RAW, /INIT AND THE PRIVACY GATE/);
  assert.doesNotMatch(PLUGIN_RAW, /LAZY INIT/);
  assert.match(PLUGIN_RAW, /ACHIEVEMENTS \(Phase 101/);
  assert.match(PLUGIN_RAW, /at most 20/);
  assert.match(PLUGIN_RAW, /res\/values\/games-ids\.xml/);
});
