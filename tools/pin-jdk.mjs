#!/usr/bin/env node
// tools/pin-jdk.mjs
//
// Ensures android/gradle.properties has an org.gradle.java.home line pointing
// at the pinned JDK. Currently Temurin 21 (see 02-02-SUMMARY.md
// "Deviations" — 02-RESEARCH.md's JDK 17 guidance covered Gradle 8.14.x's
// own JVM ceiling and AGP 8.13.0's minimum, but Capacitor 8.5.1's own
// `capacitor-android` module additionally pins `sourceCompatibility`/
// `targetCompatibility` = Java 21 in its own build.gradle — a javac target a
// JDK 17 toolchain cannot compile against ("invalid source release: 21").
// JDK 21 satisfies all three constraints at once: Gradle 8.14.x's runner JVM
// range (8-24), AGP 8.13.0's minimum (17+), and capacitor-android's release
// 21 requirement).
//
// WHY THIS SCRIPT EXISTS (a real gotcha found during 02-02 execution, not
// covered by research): `npx cap sync android` regenerates
// android/gradle.properties from Capacitor's stock template on EVERY sync,
// silently discarding any hand-added org.gradle.java.home line. Since
// `npm run cap:sync` runs before every `npm run android:debug` build, a
// one-time manual edit to gradle.properties does not survive — the very
// next sync wipes it and the next gradlew invocation falls back to
// whatever JDK is on JAVA_HOME/PATH (this machine's system Java is JDK 25,
// which Gradle 8.14.x cannot even run on). This script re-applies the pin
// idempotently AFTER every cap sync and BEFORE gradlew ever runs, reading
// the JDK path from the JAVA_HOME environment variable (must be exported by
// the caller — see package.json's android:debug script).
//
// Run: JAVA_HOME="C:/path/to/jdk-21" node tools/pin-jdk.mjs
// (wired automatically into `npm run android:debug`, after cap:sync)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GRADLE_PROPS = path.join(ROOT, "android", "gradle.properties");

const javaHome = process.env.JAVA_HOME;
if (!javaHome) {
  throw new Error(
    "JAVA_HOME is not set — export it to the Temurin 17 install path before running this script " +
      "(see 02-RESEARCH.md \"The JDK 25 incompatibility\")",
  );
}
if (!existsSync(GRADLE_PROPS)) {
  throw new Error(`${GRADLE_PROPS} does not exist — run npx cap add android first`);
}

// Gradle/Java .properties files treat backslash as an escape character —
// always write forward slashes, regardless of how JAVA_HOME was set in the
// shell (Windows paths commonly use backslashes).
const normalizedHome = javaHome.replace(/\\/g, "/");
const pinLine = `org.gradle.java.home=${normalizedHome}`;

let contents = readFileSync(GRADLE_PROPS, "utf8");
const pinPattern = /^org\.gradle\.java\.home=.*$/m;

if (pinPattern.test(contents)) {
  contents = contents.replace(pinPattern, pinLine);
} else {
  const trailingNewline = contents.endsWith("\n") ? "" : "\n";
  contents += `${trailingNewline}\n# Pinned by tools/pin-jdk.mjs (re-applied after every cap sync — see file header)\n${pinLine}\n`;
}

writeFileSync(GRADLE_PROPS, contents, "utf8");
console.log(`[pin-jdk] android/gradle.properties org.gradle.java.home -> ${normalizedHome}`);
