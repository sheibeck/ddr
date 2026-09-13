// tools/gradle.mjs — run the Android Gradle wrapper from npm scripts on any
// shell. npm on Windows runs scripts through cmd.exe, where `./gradlew` is
// not a command and a bare `gradlew` is not found from the current directory
// on some machines; on sh the .bat is meaningless. Spawning the right wrapper
// from Node sidesteps both.   Usage: node tools/gradle.mjs bundleRelease
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const androidDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "android");
const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const res = spawnSync(path.join(androidDir, wrapper), process.argv.slice(2), {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
