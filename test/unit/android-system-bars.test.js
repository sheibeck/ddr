// test/unit/android-system-bars.test.js
//
// Phase 80 (DROID-02, plan 80-02) — source pins for the status-bar-to-
// SystemBars migration. 80-RESEARCH.md ("Edge-to-Edge / DROID-02",
// source-verified) found that dropping the JS `StatusBar.setBackgroundColor`
// call is necessary but NOT sufficient: `@capacitor/status-bar` 8.0.3's
// `StatusBarPlugin.load()` constructs `StatusBar`, whose constructor calls
// the deprecated `Window.setStatusBarColor` on every launch whether JS calls
// it or not, because the plugin is registered in `capacitor.plugins.json`.
// The accepted fix removes the package entirely and moves bar styling to the
// `SystemBars` plugin inside `@capacitor/core` (auto-registered by
// `Bridge.registerAllPlugins()`).
//
// Task 1 pins the web-shell half (source of the migration, this file's
// initial content). Task 2 extends this file with the native/dependency
// pins once the package is actually uninstalled and cap sync regenerates the
// Gradle files — see the second half of this file below.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const readRepoFile = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(readRepoFile(rel));

// ─── Web shell: nativeChrome.js reads SystemBars off @capacitor/core ───────

const NATIVE_CHROME_SRC = readRepoFile("src/browser/nativeChrome.js");
const NATIVE_CHROME_STRIPPED = stripJs(NATIVE_CHROME_SRC);

test("DROID-02: nativeChrome.js dynamically imports @capacitor/core and reads .SystemBars", () => {
  assert.match(
    NATIVE_CHROME_STRIPPED,
    /\(await import\(\s*["']@capacitor\/core["']\s*\)\)\.SystemBars/,
    "registerNativeChrome must resolve SystemBars via a guarded dynamic import of @capacitor/core",
  );
});

test("DROID-02: nativeChrome.js has no bare import of the retired @capacitor/status-bar package", () => {
  assert.doesNotMatch(
    NATIVE_CHROME_STRIPPED,
    /["']@capacitor\/status-bar["']/,
    "the retired status-bar package must not be referenced anywhere in nativeChrome.js",
  );
});

test("DROID-02: nativeChrome.js makes no background-colour call of any kind (Android 15 deprecates bar colours)", () => {
  assert.doesNotMatch(
    NATIVE_CHROME_STRIPPED,
    /setBackgroundColor/,
    "no setBackgroundColor call may remain — SystemBars owns the bar colour via the theme's windowBackground",
  );
});

test("DROID-02: nativeChrome.js's SystemBars injection parameter replaces the old StatusBar parameter", () => {
  assert.match(NATIVE_CHROME_STRIPPED, /SystemBars:\s*injectedSystemBars/);
  assert.doesNotMatch(NATIVE_CHROME_STRIPPED, /StatusBar:\s*injectedStatusBar/);
});

// ─── tools/build-www.mjs: the status-bar package is off the vendoring list ──

const BUILD_WWW_SRC = readRepoFile("tools/build-www.mjs");
const BUILD_WWW_STRIPPED = stripJs(BUILD_WWW_SRC);

function vendoredPackages() {
  const m = BUILD_WWW_STRIPPED.match(/const CAPACITOR_PACKAGES = \[([\s\S]*?)\];/);
  assert.ok(m, "tools/build-www.mjs declares a CAPACITOR_PACKAGES array literal");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

test("DROID-02: CAPACITOR_PACKAGES excludes @capacitor/status-bar and keeps @capacitor/core", () => {
  const list = vendoredPackages();
  assert.ok(!list.includes("@capacitor/status-bar"), "the retired status-bar package must not be vendored");
  assert.ok(list.includes("@capacitor/core"), "@capacitor/core (which now exports SystemBars) stays vendored");
});

test("DROID-02: the comment above CAPACITOR_PACKAGES no longer names StatusBar", () => {
  // Comments are stripped from BUILD_WWW_STRIPPED, so check the raw source
  // for the specific declaration-list comment block instead of the whole
  // file (other comments elsewhere may mention Play Games etc. safely).
  const declBlockMatch = BUILD_WWW_SRC.match(/\/\/[^\n]*\n(?:\/\/[^\n]*\n)*const CAPACITOR_PACKAGES = \[/);
  assert.ok(declBlockMatch, "CAPACITOR_PACKAGES has a preceding comment block");
  assert.doesNotMatch(declBlockMatch[0], /StatusBar/, "the CAPACITOR_PACKAGES comment block must not name StatusBar");
});

// ─── capacitor.config.json: the SystemBars plugin config ───────────────────

test("DROID-02: capacitor.config.json configures plugins.SystemBars with insetsHandling css and style DARK", () => {
  const config = readJson("capacitor.config.json");
  assert.ok(config.plugins?.SystemBars, "capacitor.config.json must have a plugins.SystemBars block");
  assert.equal(config.plugins.SystemBars.insetsHandling, "css");
  assert.equal(config.plugins.SystemBars.style, "DARK");
});

// ─── mazeworld.html: the safe-area contract needs no CSS change ────────────

const MAZEWORLD_HTML = readRepoFile("mazeworld.html");

test("DROID-02: mazeworld.html keeps viewport-fit=cover", () => {
  assert.match(MAZEWORLD_HTML, /viewport-fit=cover/);
});

test("DROID-02: mazeworld.html still reads the --safe-area-inset-top/bottom CSS variables with env() fallbacks", () => {
  assert.match(MAZEWORLD_HTML, /var\(--safe-area-inset-top,\s*env\(safe-area-inset-top/);
  assert.match(MAZEWORLD_HTML, /var\(--safe-area-inset-bottom,\s*env\(safe-area-inset-bottom/);
});

// ─── Task 2: the plugin is gone from the dependency tree and native project ─
//
// These pins are extended (not created fresh) once Task 2 uninstalls
// @capacitor/status-bar and regenerates the Capacitor Gradle files with
// `npx cap sync android` — see below.

test("DROID-02 (Task 2): package.json dependencies has no status-bar key", () => {
  const pkg = readJson("package.json");
  assert.ok(!("@capacitor/status-bar" in (pkg.dependencies || {})), "package.json must not depend on @capacitor/status-bar");
});

test("DROID-02 (Task 2): package-lock.json carries no @capacitor/status-bar entry", () => {
  const lock = readJson("package-lock.json");
  assert.ok(
    !("node_modules/@capacitor/status-bar" in (lock.packages || {})),
    "package-lock.json must not carry a node_modules/@capacitor/status-bar entry",
  );
  assert.ok(
    !("@capacitor/status-bar" in (lock.packages?.[""]?.dependencies || {})),
    "the lock root's dependencies must not list @capacitor/status-bar",
  );
});

test("DROID-02 (Task 2): the regenerated Capacitor Gradle files reference no status-bar project", () => {
  const buildGradle = readRepoFile("android/app/capacitor.build.gradle");
  const settingsGradle = readRepoFile("android/capacitor.settings.gradle");
  assert.doesNotMatch(buildGradle, /status-bar/i, "android/app/capacitor.build.gradle must not reference the status-bar Gradle project");
  assert.doesNotMatch(settingsGradle, /status-bar/i, "android/capacitor.settings.gradle must not reference the status-bar Gradle project");
});

test("DROID-02 (Task 2): AppTheme.NoActionBar sets colorPrimaryDark #1b170f and android:windowBackground #14110c, with no Android-15-deprecated bar-colour attribute", () => {
  const styles = readRepoFile("android/app/src/main/res/values/styles.xml");
  const block = styles.match(/<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?<\/style>/);
  assert.ok(block, "styles.xml must have an AppTheme.NoActionBar block");
  assert.match(block[0], /<item name="colorPrimaryDark">#1b170f<\/item>/);
  assert.match(block[0], /<item name="android:windowBackground">#14110c<\/item>/);
  assert.doesNotMatch(block[0], /android:statusBarColor/, "statusBarColor is deprecated on Android 15 and must not be set");
  assert.doesNotMatch(block[0], /android:navigationBarColor/, "navigationBarColor is deprecated on Android 15 and must not be set");
});

test("DROID-02 (Task 2): MainActivity.java registers the PlayIdentity plugin before super.onCreate and makes no window or bar-colour call", () => {
  const mainActivity = readRepoFile(
    "android/app/src/main/java/com/darktierstudios/delvedierepeat/MainActivity.java",
  );
  assert.match(mainActivity, /class MainActivity extends BridgeActivity/);
  const reg = mainActivity.indexOf("registerPlugin(PlayIdentityPlugin.class)");
  const sup = mainActivity.indexOf("super.onCreate(savedInstanceState)");
  assert.ok(reg >= 0, "MainActivity must register PlayIdentityPlugin");
  assert.ok(sup > reg, "registerPlugin must come before super.onCreate (Capacitor 8 local-plugin order)");
  for (const banned of ["setStatusBarColor", "setNavigationBarColor", "setDecorFitsSystemWindows", "getWindow"]) {
    assert.ok(!mainActivity.includes(banned), `MainActivity must not call ${banned} (DROID-02)`);
  }
});

// Phase 92.1 (BOARD-31): the privacy gate. The Play Games SDK's own auto-init
// provider signs the player in at every launch whatever Compete says, so the
// manifest removes it and MainActivity starts the SDK itself, gated.

const MAIN_ACTIVITY_PATH = "android/app/src/main/java/com/darktierstudios/delvedierepeat/MainActivity.java";
const PLUGIN_PATH = "android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java";

/** Strip Java and XML comments so a pin cannot be satisfied by prose. */
const stripJavaComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const stripXmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, "");

test("92.1-01: the manifest removes the Play Games SDK's auto-init provider (tools:node=remove, ${applicationId}.playgamesinitprovider)", () => {
  const manifest = readRepoFile("android/app/src/main/AndroidManifest.xml");
  const code = stripXmlComments(manifest);
  assert.match(code, /<manifest[^>]*xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
  const providers = [...code.matchAll(/<provider\b[\s\S]*?\/?>/g)].map((m) => m[0]);
  const removal = providers.find((p) => /com\.google\.android\.gms\.games\.provider\.PlayGamesInitProvider/.test(p));
  assert.ok(removal, "a <provider> element must name PlayGamesInitProvider");
  assert.match(removal, /android:authorities="\$\{applicationId\}\.playgamesinitprovider"/);
  assert.match(removal, /tools:node="remove"/);
});

test("92.1-01: MainActivity initializes the Play Games SDK before super.onCreate, only behind the stored-Compete gate", () => {
  const code = stripJavaComments(readRepoFile(MAIN_ACTIVITY_PATH));
  const gate = code.indexOf("if (competeIsOn(this))");
  const init = code.indexOf("PlayIdentityPlugin.initSdkOnce(");
  const sup = code.indexOf("super.onCreate(savedInstanceState)");
  assert.ok(gate >= 0, "the initialize must sit behind competeIsOn(this)");
  assert.ok(init > gate, "initSdkOnce must be inside the gate");
  assert.ok(sup > init, "initSdkOnce must run before super.onCreate (the SDK's silent sign-in needs initialize first)");
  // The only initialize call in the activity is through the shared helper.
  assert.ok(!/PlayGamesSdk\.initialize\(/.test(code), "MainActivity must go through PlayIdentityPlugin.initSdkOnce, not call the SDK directly");
  // The gate reads the Capacitor Preferences blob and treats anything but compete:false as ON.
  assert.match(code, /getSharedPreferences\(PREFS_GROUP/);
  assert.match(code, /PREFS_GROUP = "CapacitorStorage"/);
  assert.match(code, /SETTINGS_KEY = "ddr\.settings\.v1"/);
  assert.match(code, /!Boolean\.FALSE\.equals\(settings\.opt\("compete"\)\)/);
  // A missing or unparsable blob (and any throw) is ON.
  assert.match(code, /catch \(Throwable t\) \{\s*return true;/);
  assert.ok(!/Log\.[a-z]\(/.test(code), "the gate never logs a stored value");
});

test("92.1-01: PlayIdentityPlugin's init is idempotent with MainActivity's (one process-wide guard) and its header no longer claims lazy init", () => {
  const raw = readRepoFile(PLUGIN_PATH);
  const code = stripJavaComments(raw);
  assert.match(code, /private static boolean sdkInitialized/);
  assert.match(code, /static synchronized void initSdkOnce\(Context context\)/);
  assert.equal(code.split("PlayGamesSdk.initialize(").length - 1, 1, "exactly one initialize call site");
  assert.match(code, /private void ensureInit\(\) \{\s*initSdkOnce\(getContext\(\)\);/);
  assert.match(raw, /INIT AND THE PRIVACY GATE/);
  assert.doesNotMatch(raw, /LAZY INIT/, "the A6 lazy-init claim is corrected");
});

test("91.2-01: PlayIdentityPlugin.java is the four Play Games methods plus buildInfo with the no-extra-scopes server code and no reject", () => {
  const plugin = readRepoFile(
    "android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java",
  );
  assert.match(plugin, /@CapacitorPlugin\(name = "PlayIdentity"\)/);
  const methods = [...plugin.matchAll(/@PluginMethod\s+public void (\w+)\(/g)].map((m) => m[1]);
  assert.deepEqual(methods, ["buildInfo", "init", "status", "signIn", "serverAuthCode"]);
  assert.match(plugin, /requestServerSideAccess\([^,()]+(\([^)]*\))?[^,()]*,\s*false\)/, "two-argument overload, no extra scopes");
  assert.ok(!/AuthScope|PROFILE|OPEN_ID/.test(plugin.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")), "no scope constants outside comments");
  assert.ok(!plugin.includes("call.reject("), "every method resolves, none rejects");
  assert.ok(!/Log\.[a-z]\(/.test(plugin), "the plugin never logs");
});
