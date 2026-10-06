// test/unit/dev-build-gate.test.js
//
// Quick task 260402 (user ruling 2026-10-02): "make sure that dev trick never
// shows up on production build. Only on debug builds." The hidden Settings dev
// rows (#mw-dev-row start-at-depth + perf readout, #mw-dev-pgs-row Play Games
// probe + Fake sign-in) are gated on a native debug flag:
//
//   Java    PlayIdentityPlugin.buildInfo() answers BuildConfig.DEBUG and never
//           starts the Play Games SDK (the 92.1 privacy gate stays intact).
//   JS      src/browser/playIdentity.js (native seam buildInfo) and
//           src/browser/devBuild.js (devToolsAllowed, fails closed) feed the
//           shell, which attaches the long-press only when debug === true and
//           guards every dev entry point on devToolsOn.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

import { createPlayIdentity } from "../../src/browser/playIdentity.js";
import { devToolsAllowed } from "../../src/browser/devBuild.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// ─── devToolsAllowed: behaviour ─────────────────────────────────────────────

const identityAnswering = (answer) => ({ buildInfo: async () => answer });

test("devToolsAllowed: the browser dev loop (native === false) keeps the dev tools and never asks the seam", async () => {
  let asked = false;
  const identity = { buildInfo: async () => ((asked = true), { ok: true, debug: false }) };
  assert.equal(await devToolsAllowed({ native: false, identity }), true);
  assert.equal(asked, false);
});

test("devToolsAllowed: a native build allows the dev tools only on exactly { ok: true, debug: true }", async () => {
  assert.equal(await devToolsAllowed({ native: true, identity: identityAnswering({ ok: true, debug: true }) }), true);
  assert.equal(await devToolsAllowed({ native: true, identity: identityAnswering({ ok: true, debug: false }) }), false);
});

test("devToolsAllowed: fails closed on every failed, absent or malformed native check", async () => {
  const bad = [
    { ok: false, reason: "error" },
    { ok: false, reason: "unavailable", debug: true },
    { ok: true },
    { ok: true, debug: "true" },
    { ok: true, debug: 1 },
    { debug: true },
    null,
    undefined,
    "debug",
  ];
  for (const answer of bad) {
    assert.equal(await devToolsAllowed({ native: true, identity: identityAnswering(answer) }), false, JSON.stringify(answer));
  }
  const throwing = { buildInfo: async () => { throw new Error("boom"); } };
  const syncThrowing = { buildInfo: () => { throw new Error("boom"); } };
  assert.equal(await devToolsAllowed({ native: true, identity: throwing }), false, "a rejected check");
  assert.equal(await devToolsAllowed({ native: true, identity: syncThrowing }), false, "a throwing check");
  assert.equal(await devToolsAllowed({ native: true, identity: {} }), false, "a seam without buildInfo");
  assert.equal(await devToolsAllowed({ native: true, identity: null }), false, "no seam at all");
  assert.equal(await devToolsAllowed({ native: true }), false, "no identity argument");
});

test("devToolsAllowed: an unknown platform (native not a boolean) is NOT debug, and it never rejects", async () => {
  assert.equal(await devToolsAllowed({}), false);
  assert.equal(await devToolsAllowed(), false);
  assert.equal(await devToolsAllowed({ native: undefined, identity: identityAnswering({ ok: true, debug: true }) }), false);
  assert.equal(await devToolsAllowed({ native: "yes", identity: identityAnswering({ ok: true, debug: true }) }), false);
});

// ─── the native seam's buildInfo ────────────────────────────────────────────

test("native seam: buildInfo forwards to the plugin and normalizes to a plain frozen { ok, debug }", async () => {
  const pluginFor = (answer) => ({ plugin: { buildInfo: async () => answer } });
  const yes = await createPlayIdentity({ loadPlugin: async () => pluginFor({ ok: true, debug: true }) }).buildInfo();
  assert.deepEqual(yes, { ok: true, debug: true });
  assert.ok(Object.isFrozen(yes));
  const no = await createPlayIdentity({ loadPlugin: async () => pluginFor({ ok: true, debug: false }) }).buildInfo();
  assert.deepEqual(no, { ok: true, debug: false });
});

test("native seam: buildInfo turns a non-boolean, missing or failing answer into { ok: false } and never rejects", async () => {
  for (const raw of [{ ok: true }, { ok: true, debug: "true" }, null, "x", { ok: false, reason: "error" }]) {
    const r = await createPlayIdentity({ loadPlugin: async () => ({ plugin: { buildInfo: async () => raw } }) }).buildInfo();
    assert.equal(r.ok, false, JSON.stringify(raw));
    assert.notEqual(r.debug, true);
  }
  const rejecting = createPlayIdentity({ loadPlugin: async () => ({ plugin: { buildInfo: async () => { throw new Error("x"); } } }) });
  assert.deepEqual(await rejecting.buildInfo(), { ok: false, reason: "error" });
  const noPlugin = createPlayIdentity({ loadPlugin: async () => { throw new Error("no bridge"); } });
  assert.deepEqual(await noPlugin.buildInfo(), { ok: false, reason: "unavailable" });
  const noMethod = createPlayIdentity({ loadPlugin: async () => ({ plugin: {} }) });
  assert.deepEqual(await noMethod.buildInfo(), { ok: false, reason: "error" });
});

test("devToolsAllowed over the real native seam: a release plugin answer closes, a debug plugin answer opens", async () => {
  const seam = (debug) => createPlayIdentity({ loadPlugin: async () => ({ plugin: { buildInfo: async () => ({ ok: true, debug }) } }) });
  assert.equal(await devToolsAllowed({ native: true, identity: seam(true) }), true);
  assert.equal(await devToolsAllowed({ native: true, identity: seam(false) }), false);
  const missingPlugin = createPlayIdentity({ loadPlugin: async () => ({ plugin: undefined }) });
  assert.equal(await devToolsAllowed({ native: true, identity: missingPlugin }), false);
});

// ─── the shell: source-shape pins ───────────────────────────────────────────

const HTML = read("mazeworld.html");
function stripComments(source) {
  const noLine = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}
const MODULE = (() => {
  const code = stripComments(HTML);
  return code.slice(code.indexOf('<script type="module">'));
})();
const occurrences = (source, literal) => source.split(literal).length - 1;
function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found: ${endMarker}`);
  return source.slice(start, end);
}

test("shell: imports devToolsAllowed from src/browser/devBuild.js, and devToolsOn starts closed on native", () => {
  assert.equal(occurrences(HTML, 'import { devToolsAllowed } from "./src/browser/devBuild.js";'), 1);
  assert.equal(occurrences(MODULE, "let devToolsOn = !devNative;"), 1);
  assert.equal(occurrences(MODULE, 'const devNative = window.Capacitor?.isNativePlatform?.() === true;'), 1);
});

test("shell: the version-label long-press listeners live ONLY inside attachDevLongPress", () => {
  const fn = slice(MODULE, "function attachDevLongPress() {", "\n  }\n");
  assert.match(fn, /mwSettingsVersion\?\.addEventListener\("pointerdown"/);
  assert.match(fn, /mwSettingsVersion\?\.addEventListener\("contextmenu"/);
  // Nothing else in the module listens on the version label.
  assert.equal(occurrences(MODULE, "mwSettingsVersion?.addEventListener("), occurrences(fn, "mwSettingsVersion?.addEventListener("));
  assert.equal(occurrences(MODULE, 'getElementById("mw-settings-version")'), 1);
  // The rows are unhidden only in that function, and only after the live re-check.
  assert.equal(occurrences(MODULE, 'getElementById("mw-dev-row")'), 1);
  assert.equal(occurrences(MODULE, 'getElementById("mw-dev-pgs-row")'), 1);
  assert.ok(fn.includes('getElementById("mw-dev-row")') && fn.includes('getElementById("mw-dev-pgs-row")'));
  assert.ok(fn.indexOf("if (!devToolsOn) return;") !== -1 && fn.indexOf("if (!devToolsOn) return;") < fn.indexOf('getElementById("mw-dev-row")'));
});

test("shell: attachDevLongPress is called from exactly two places, native only after debug === true, browser directly", () => {
  assert.equal(occurrences(MODULE, "attachDevLongPress();"), 2);
  const native = slice(MODULE, "if (devNative) {", "} else {");
  assert.match(native, /devToolsAllowed\(\{ native: true, identity: playIdentity\(\) \}\)\.then\(/);
  assert.match(native, /devToolsOn = ok === true;/);
  assert.match(native, /if \(devToolsOn\) attachDevLongPress\(\);/);
  // A rejected check does nothing (devToolsOn stays false).
  assert.match(native, /\(\) => \{\},\s*\)/);
  const browser = slice(MODULE, "} else {\n    attachDevLongPress();", "\n  }\n");
  assert.ok(browser.includes("attachDevLongPress();"));
  // The only call outside a function body of its own is the guarded pair above.
  const idxFn = MODULE.indexOf("function attachDevLongPress() {");
  const idxFirstCall = MODULE.indexOf("attachDevLongPress();");
  assert.ok(idxFirstCall > idxFn, "defined before it is called");
});

test("shell: the dev entry points all refuse when devToolsOn is false (start button, window.mzDevStartAtDepth, probe, fake sign-in)", () => {
  const startBtn = slice(MODULE, 'getElementById("mw-dev-start-btn")?.addEventListener("click", () => {', "});");
  assert.ok(startBtn.indexOf("if (!devToolsOn) return;") !== -1);
  const fn = slice(MODULE, "window.mzDevStartAtDepth = async function devStartAtDepth(depth) {", "closeSettingsSheet();");
  assert.match(fn, /if \(!devToolsOn\) return;/);
  const probe = slice(MODULE, 'pgsProbeBtn?.addEventListener("click", async () => {', "pgsProbeBtn.disabled = true;");
  assert.match(probe, /if \(!devToolsOn\) return;/);
  const fake = slice(MODULE, 'pgsFakeBtn?.addEventListener("click", () => {', "pgsFakeSignedIn = !pgsFakeSignedIn;");
  assert.match(fake, /if \(!devToolsOn\) return;/);
  // The guard is the first statement of the dev function.
  assert.match(MODULE, /window\.mzDevStartAtDepth = async function devStartAtDepth\(depth\) \{\s*if \(!devToolsOn\) return;\s*closeSettingsSheet\(\);/);
});

test("shell: devToolsOn is only ever assigned from the devBuild check (one assignment after the initial)", () => {
  const assigns = MODULE.match(/devToolsOn\s*=[^=]/g) || [];
  assert.equal(assigns.length, 2, "the initial `let devToolsOn = !devNative` and the one from the check");
});

test("build: www/ is Capacitor's webDir only, no web hosting ships the dev loop (so the browser path stays ungated)", () => {
  const firebase = JSON.parse(read("firebase.json"));
  assert.equal("hosting" in firebase, false, "firebase.json has no hosting block");
  assert.equal(JSON.parse(read("capacitor.config.json")).webDir, "www");
});

// ─── the native half ────────────────────────────────────────────────────────

const PLUGIN = read("android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java");
const stripJava = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const PLUGIN_CODE = stripJava(PLUGIN);

test("native: PlayIdentityPlugin.buildInfo is a @PluginMethod that resolves BuildConfig.DEBUG and never rejects", () => {
  assert.match(PLUGIN_CODE, /@PluginMethod\s+public void buildInfo\(PluginCall call\)/);
  const body = slice(PLUGIN_CODE, "public void buildInfo(PluginCall call) {", "@PluginMethod");
  assert.match(body, /out\.put\("ok", true\);/);
  assert.match(body, /out\.put\("debug", BuildConfig\.DEBUG\);/);
  assert.match(body, /call\.resolve\(out\);/);
  assert.match(body, /call\.resolve\(failure\("error"\)\);/);
  assert.ok(!body.includes("call.reject("));
});

test("native: buildInfo never initializes the Play Games SDK (the 92.1 privacy gate stays intact)", () => {
  const body = slice(PLUGIN_CODE, "public void buildInfo(PluginCall call) {", "@PluginMethod");
  for (const banned of ["ensureInit", "initSdkOnce", "PlayGamesSdk", "PlayGames."]) {
    assert.ok(!body.includes(banned), `buildInfo must not touch ${banned}`);
  }
  // The SDK still starts from exactly one call site, in initSdkOnce.
  assert.equal(occurrences(PLUGIN_CODE, "PlayGamesSdk.initialize("), 1);
  // Re-pinned in Phase 101-01 (PGS-07/AUI-04): 4 -> 6 for the two achievement methods, which are reached only from JS.
  assert.equal(
    occurrences(PLUGIN_CODE, "ensureInit();"),
    6,
    "init, status, signIn, serverAuthCode, syncAchievements and showAchievements only",
  );
});

test("native: the app module generates BuildConfig (AGP 8 default is off) so BuildConfig.DEBUG compiles", () => {
  const gradle = read("android/app/build.gradle");
  assert.match(gradle, /buildFeatures\s*\{\s*buildConfig\s*=\s*true\s*\}/);
});
