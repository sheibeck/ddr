// test/unit/android-large-screen.test.js
//
// Phase 97 (SCREEN-01, SCREEN-02, SCREEN-05): declared re-pin of the Phase 80
// DROID-03 pins. The portrait-lock and letterbox pins are retired: the
// manifest carries no restriction, nativeChrome locks only phones from the
// Screen preference, and the letterbox column's pins move to
// test/unit/layout-shell.test.js (97-03).
//
//   1. The manifest keeps android:appCategory="game" but carries no
//      orientation, resizability or aspect-ratio restriction, and keeps the
//      exact configChanges list and launchMode so rotation, fold and resize
//      never recreate the WebView.
//   2. src/browser/nativeChrome.js locks portrait in exactly one place,
//      syncOrientationLock, and registerNativeChrome goes through it.
//   3. decideOrientationLock never locks a device whose smallest width is
//      600 CSS px or more.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { decideOrientationLock } from "../../src/browser/nativeChrome.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const readRepoFile = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const stripXmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, "");

// ─── AndroidManifest.xml ────────────────────────────────────────────────────

test("SCREEN-01: the manifest keeps the game category and carries no orientation, resizability or aspect restriction", () => {
  const manifest = stripXmlComments(readRepoFile("android/app/src/main/AndroidManifest.xml"));

  const appTagMatch = manifest.match(/<application\b[^>]*>/);
  assert.ok(appTagMatch, "the manifest has an <application> start tag");
  assert.match(
    appTagMatch[0],
    /android:appCategory\s*=\s*"game"/,
    "the <application> element keeps android:appCategory=\"game\""
  );

  const activityTagMatch = manifest.match(/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s);
  assert.ok(activityTagMatch, "the manifest has the .MainActivity <activity> tag");
  // Phase 97 (SCREEN-01): declared re-pin. Phase 80 pinned
  // android:screenOrientation="portrait" here; the lock left the manifest.
  assert.doesNotMatch(
    activityTagMatch[0],
    /android:screenOrientation/,
    "the .MainActivity activity has no android:screenOrientation attribute"
  );

  // Phase 97 (SCREEN-01): declared re-pin. The whole manifest is now pinned
  // free of every large-screen restriction, not just resizeableActivity.
  for (const [re, what] of [
    [/android:screenOrientation/, "android:screenOrientation"],
    [/android:resizeableActivity/, "android:resizeableActivity"],
    [/android:maxAspectRatio/, "android:maxAspectRatio"],
    [/android:minAspectRatio/, "android:minAspectRatio"],
    [/PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY/, "the restricted-resizability compat property"],
    [/<layout\b/, "a <layout> element"],
  ]) {
    assert.doesNotMatch(manifest, re, `the manifest carries no ${what}`);
  }
});

test("SCREEN-01: MainActivity keeps the exact configChanges list and launchMode singleTask", () => {
  const manifest = stripXmlComments(readRepoFile("android/app/src/main/AndroidManifest.xml"));
  const activityTagMatch = manifest.match(/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s);
  assert.ok(activityTagMatch, "the manifest has the .MainActivity <activity> tag");
  const tag = activityTagMatch[0];

  const cc = tag.match(/android:configChanges\s*=\s*"([^"]*)"/);
  assert.ok(cc, "MainActivity declares android:configChanges");
  assert.deepEqual(cc[1].split("|"), [
    "orientation",
    "keyboardHidden",
    "keyboard",
    "screenSize",
    "locale",
    "smallestScreenSize",
    "screenLayout",
    "uiMode",
    "navigation",
    "density",
  ]);
  assert.match(tag, /android:launchMode\s*=\s*"singleTask"/, "MainActivity keeps launchMode singleTask");
});

// ─── src/browser/nativeChrome.js ────────────────────────────────────────────

test("SCREEN-02: nativeChrome.js locks portrait in exactly one place, inside syncOrientationLock", () => {
  const src = stripJs(readRepoFile("src/browser/nativeChrome.js"));

  const lockCall = /\.lock\??\.?\(\{\s*orientation:\s*"portrait"\s*\}\)/g;
  // Phase 97 (SCREEN-02): declared re-pin. Phase 80 pinned an unconditional
  // lock inside registerNativeChrome; the only lock call now sits in the
  // phone-only syncOrientationLock.
  assert.equal(src.match(lockCall)?.length, 1, "exactly one lock({ orientation: \"portrait\" }) call");

  const start = src.indexOf("export async function syncOrientationLock");
  assert.ok(start >= 0, "syncOrientationLock is exported");
  const next = src.indexOf("\nexport ", start + 1);
  const body = src.slice(start, next === -1 ? undefined : next);
  assert.match(body, lockCall, "the lock call sits inside syncOrientationLock");
  assert.match(body, /\.unlock\??\.?\(\)/, "an unlock call sits inside syncOrientationLock");

  const regStart = src.indexOf("export async function registerNativeChrome");
  assert.ok(regStart >= 0, "registerNativeChrome is exported");
  const regNext = src.indexOf("\n}\n", regStart);
  const regBody = src.slice(regStart, regNext === -1 ? undefined : regNext);
  assert.match(regBody, /syncOrientationLock\(\)/, "registerNativeChrome applies the rule through syncOrientationLock()");
  assert.doesNotMatch(regBody, /\.lock\??\.?\(/, "registerNativeChrome no longer calls the plugin's lock directly");
});

test("SCREEN-01: nothing is locked on a tablet, foldable-unfolded or Chromebook window", () => {
  assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: 412 }), "portrait");
  assert.equal(decideOrientationLock({ screenPref: "rotate", smallestWidth: 412 }), "unlock");
  assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: 800 }), "unlock");
});
