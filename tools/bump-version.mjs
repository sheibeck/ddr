// tools/bump-version.mjs
//
// Bumps android/version.properties before a Play upload. Play rejects any
// bundle whose versionCode it has already seen, so every internal-testing
// push needs a fresh one. versionName is the human-readable string shown in
// Play Console / the store listing; it only changes when you pass --name.
//
//   node tools/bump-version.mjs              # versionCode +1
//   node tools/bump-version.mjs --name 1.1.0 # versionCode +1, versionName=1.1.0
//   node tools/bump-version.mjs --dry-run    # print what would change
//
// Read by android/app/build.gradle (see its header comment).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, "..", "android", "version.properties");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const nameIdx = args.indexOf("--name");
const newName = nameIdx >= 0 ? args[nameIdx + 1] : null;
if (nameIdx >= 0 && !newName) {
  console.error("[bump-version] --name needs a value, e.g. --name 1.0.2");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const codeMatch = text.match(/^versionCode=(\d+)\s*$/m);
const nameMatch = text.match(/^versionName=(.+?)\s*$/m);
if (!codeMatch || !nameMatch) {
  console.error(`[bump-version] ${file} is missing versionCode= or versionName=`);
  process.exit(1);
}

const oldCode = Number(codeMatch[1]);
const newCode = oldCode + 1;
const oldName = nameMatch[1];
const nextName = newName ?? oldName;

let out = text.replace(/^versionCode=\d+\s*$/m, `versionCode=${newCode}`);
out = out.replace(/^versionName=.+?\s*$/m, `versionName=${nextName}`);

console.log(
  `[bump-version] versionCode ${oldCode} -> ${newCode}` +
    (nextName !== oldName ? `, versionName ${oldName} -> ${nextName}` : ` (versionName ${oldName})`) +
    (dryRun ? "  [dry-run, not written]" : ""),
);
if (!dryRun) writeFileSync(file, out, "utf8");
