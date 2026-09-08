// ENG-03 static tripwire: every exported value under content/ must be pure,
// JSON-serializable data — no function-typed leaves anywhere in the object
// graph. This is what catches a `d: () => D(6)`-style dice-closure that got
// copy-pasted into a content table instead of being converted to plain
// dice-notation ({n, sides, bonus}). Content modules are discovered from
// the filesystem, never hardcoded, so new tables are covered automatically.
//
// Vacuously green today (content/ has no .js modules yet); becomes a live
// tripwire as content tables land.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CONTENT_DIR = path.join(REPO_ROOT, "content");

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
 * Recursively walk a value, collecting the path of every function-typed
 * leaf found in the object graph (arrays, plain objects, and nested
 * combinations thereof).
 */
function findFunctionLeaves(value, pathLabel, seen = new Set()) {
  if (typeof value === "function") {
    return [pathLabel];
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) return []; // guard against circular refs
  seen.add(value);

  const offenses = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      offenses.push(...findFunctionLeaves(item, `${pathLabel}[${i}]`, seen));
    });
  } else {
    for (const [key, item] of Object.entries(value)) {
      offenses.push(...findFunctionLeaves(item, `${pathLabel}.${key}`, seen));
    }
  }
  return offenses;
}

test("content/*.js exports contain no function-typed leaves (pure data only)", async () => {
  const files = collectJsFiles(CONTENT_DIR);

  if (files.length === 0) {
    // No content modules exist yet — vacuously green per plan spec.
    assert.ok(true);
    return;
  }

  const offenses = [];
  for (const file of files) {
    const mod = await import(url.pathToFileURL(file).href);
    for (const [exportName, exportValue] of Object.entries(mod)) {
      const label = `${path.relative(REPO_ROOT, file)}::${exportName}`;
      offenses.push(...findFunctionLeaves(exportValue, label));
    }
  }

  assert.deepStrictEqual(
    offenses,
    [],
    `Found function-typed leaf(ves) in content/ exports (content must be pure data):\n${offenses.join("\n")}`
  );
});
