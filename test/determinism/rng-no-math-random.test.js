// ENG-02 static tripwire: no direct Math.random() may appear anywhere under
// engine/ or content/. All randomness must flow through the injected,
// seeded RNG (engine/rng.js's makeRng). This guard reads every .js file
// under those two directories, strips comments, and regex-scans the
// remaining source lines. It passes vacuously today (content/ is empty)
// and becomes a live tripwire as content tables and engine modules land.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_DIRS = ["engine", "content"];

/** Recursively collect every .js file under `dir` (absolute path). */
function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip block comments (/* ... *\/) and line comments (// ...) from source,
 * returning an array of the remaining line strings (same line count/index
 * as the original, so line numbers stay accurate for failure reporting).
 */
function stripComments(source) {
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    // Preserve line breaks inside the removed block comment so line numbers
    // of subsequent code are unaffected.
    match.replace(/[^\n]/g, "")
  );

  return noBlockComments.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
}

test("no Math.random on any non-comment line under engine/ or content/", () => {
  const files = SCAN_DIRS.flatMap((dir) => collectJsFiles(path.join(REPO_ROOT, dir)));
  const offenses = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const lines = stripComments(source);
    lines.forEach((line, i) => {
      if (/Math\.random/.test(line)) {
        offenses.push(`${path.relative(REPO_ROOT, file)}:${i + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepStrictEqual(
    offenses,
    [],
    `Found Math.random() outside the RNG boundary:\n${offenses.join("\n")}`
  );
});
