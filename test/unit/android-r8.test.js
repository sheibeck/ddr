// test/unit/android-r8.test.js
//
// Phase 80 (DROID-01) — static pins for the R8 release-build configuration.
// CODE part, no build (user ruling 2026-09-26): this file proves the
// configuration on disk, not build output. 80-04's single release build
// checks the actual mapping.txt/seeds.txt against these same rules.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

// ─── brace-matching helper (not a greedy regex) ─────────────────────────────

function extractBlock(text, marker, fromIndex = 0) {
  const idx = text.indexOf(marker, fromIndex);
  assert.ok(idx !== -1, `expected to find ${JSON.stringify(marker)}`);
  const braceStart = text.indexOf("{", idx);
  assert.ok(braceStart !== -1, `expected an opening brace after ${JSON.stringify(marker)}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { block: text.slice(braceStart, i + 1), start: idx, end: i + 1 };
    }
  }
  throw new Error(`unbalanced braces scanning for ${JSON.stringify(marker)}`);
}

function stripProguardComments(text) {
  return text
    .split("\n")
    .filter((line) => line.trim()[0] !== "#")
    .join("\n");
}

// ─── android/app/build.gradle: the release buildType ────────────────────────

const BUILD_GRADLE = read("android/app/build.gradle");
const { block: buildTypesBlock } = extractBlock(BUILD_GRADLE, "buildTypes");
const { block: releaseBlock } = extractBlock(buildTypesBlock, "release");

test("DROID-01: release buildType has minifyEnabled true", () => {
  assert.match(releaseBlock, /\bminifyEnabled\s+true\b/);
});

test("DROID-01: release buildType has shrinkResources true", () => {
  assert.match(releaseBlock, /\bshrinkResources\s+true\b/);
});

test("DROID-01: release buildType still references proguard-android.txt and proguard-rules.pro", () => {
  assert.match(releaseBlock, /getDefaultProguardFile\(\s*['"]proguard-android(?:-optimize)?\.txt['"]\s*\)/);
  assert.match(releaseBlock, /['"]proguard-rules\.pro['"]/);
});

test("DROID-01: no debug buildType turns minification on", () => {
  if (!BUILD_GRADLE.includes("debug {") && !BUILD_GRADLE.includes("debug{")) return; // no debug block today
  const { block: debugBlock } = extractBlock(BUILD_GRADLE, "debug");
  assert.doesNotMatch(debugBlock, /\bminifyEnabled\s+true\b/);
});

test("DROID-01: android/build.gradle (AGP pin) is untouched by this plan", () => {
  const rootBuildGradle = read("android/build.gradle");
  assert.match(rootBuildGradle, /com\.android\.tools\.build:gradle:8\.13\.0/);
});

// ─── android/app/proguard-rules.pro: the defensive keep-rule mirror ────────

const PROGUARD_RAW = read("android/app/proguard-rules.pro");
const PROGUARD = stripProguardComments(PROGUARD_RAW);

const REQUIRED_RULE_FRAGMENTS = [
  // Capacitor v3 @CapacitorPlugin annotation keep
  "@com.getcapacitor.annotation.CapacitorPlugin public class *",
  "@com.getcapacitor.annotation.PermissionCallback <methods>",
  "@com.getcapacitor.annotation.ActivityCallback <methods>",
  "@com.getcapacitor.annotation.Permission <methods>",
  "@com.getcapacitor.PluginMethod public <methods>",
  // Plugin-subclass keep
  "-keep public class * extends com.getcapacitor.Plugin { *; }",
  // legacy v2 NativePlugin keep
  "@com.getcapacitor.NativePlugin public class *",
  // Cordova-plugin keep
  "-keep public class * extends org.apache.cordova.* {",
  // JavascriptInterface keepclassmembers rule (AGP default file already
  // covers this; this is the defensive mirror)
  "@android.webkit.JavascriptInterface <methods>",
  // line-number attributes
  "-keepattributes SourceFile,LineNumberTable",
  "-renamesourcefileattribute SourceFile",
];

for (const fragment of REQUIRED_RULE_FRAGMENTS) {
  test(`DROID-01: proguard-rules.pro contains ${JSON.stringify(fragment)}`, () => {
    assert.ok(PROGUARD.includes(fragment), `missing rule fragment: ${fragment}`);
  });
}

const FORBIDDEN_DIRECTIVES = ["dontobfuscate", "dontshrink", "dontoptimize", "ignorewarnings"];

for (const directive of FORBIDDEN_DIRECTIVES) {
  test(`DROID-01: proguard-rules.pro never disables R8 via -${directive}`, () => {
    assert.doesNotMatch(PROGUARD, new RegExp(`^-${directive}\\b`, "m"));
  });
}

test("DROID-01: proguard-rules.pro has no blanket dontwarn wildcard", () => {
  assert.doesNotMatch(PROGUARD, /^-dontwarn\s+\*\*?\s*$/m);
});

// ─── android/app/src/main/res/raw/keep.xml: the name-loaded splash drawable ─

test("DROID-01: keep.xml declares tools:keep for the name-loaded splash drawable", () => {
  const keepXml = read("android/app/src/main/res/raw/keep.xml");
  assert.match(keepXml, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
  assert.match(keepXml, /tools:keep="[^"]*@drawable\/splash_screen[^"]*"/);
});
