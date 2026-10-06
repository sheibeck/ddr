// test/unit/achievements-bot-isolation.test.js
//
// Phase 99 (TRACK-05), plan 99-03: only a player's real runs earn
// achievements. The tuning bot (tools/lib/tuning-bot.mjs) and every other
// script under tools/ drive the engine directly and must never reach the
// tracker, the record module or the engine adapter (which owns the hooks and
// the ddr.achievements.v1 storage). This test walks every import (static,
// re-export, bare side-effect, dynamic with a string literal, and require)
// reachable from every .js, .mjs and .cjs file under tools/ and proves those
// three files are never reached, that the walk is not vacuous (it does reach
// the engine from the bot), and that the walker has teeth (a fixture tool
// importing the tracker is caught, statically and dynamically).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const FORBIDDEN = [
  "src/browser/achievementTracker.js",
  "src/browser/achievementRecord.js",
  "src/browser/engineAdapter.js",
];

const SOURCE_EXT = /\.(?:js|mjs|cjs)$/;

function listSources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...listSources(full));
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Every string-literal specifier a module names: import ... from "x", bare
// import "x", export ... from "x", import("x") and require("x").
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\s[^"'`;]*?\sfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function specifiersOf(source) {
  const found = new Set();
  for (const re of SPECIFIER_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) found.add(m[1]);
  }
  return [...found];
}

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return null; // bare package and node: specifiers are ignored
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** reachableFrom(root, entryFiles) — repo-relative paths of every file reachable by imports, entries included. */
function reachableFrom(root, entryFiles) {
  const seen = new Set();
  const stack = entryFiles.map((f) => path.resolve(f));
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue; // only follow files inside root
    seen.add(file);
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of specifiersOf(source)) {
      const next = resolveRelative(file, spec);
      if (next && !seen.has(next)) stack.push(next);
    }
  }
  return new Set([...seen].map((f) => path.relative(root, f).split(path.sep).join("/")));
}

// Phase 100 close (declared re-pin, 2026-10-05): tools/layout-check.mjs is a
// headless-Chrome layout harness, not a simulation. Plan 100-05 has it import
// the PURE list view model (achievementsSheet.js#buildAchievementsView) to
// compute the expected column count, and that module reads progressFor and
// the record's empty/sanitize helpers. Those two pure modules may be reached
// by this one tool; it never drives the engine and never reaches the engine
// adapter (the hooks and the ddr.achievements.v1 writes), which stays
// forbidden for it like for every other tool.
//
// Phase 102 (declared re-pin, 2026-10-05): tools/store-screenshots/seed.mjs is
// the second read-only harness tool. The screenshot capture builds the mid-game
// achievements record and the Earned strip ids offline from the pure record and
// tracker modules (a real engine death folded through the real tracker), and
// hands the browser side seeds.json as data. It never drives the adapter, and
// the walk below still forbids the engine adapter for it. The rest of the
// capture harness is CommonJS and runs seed.mjs as a child process, so it
// stays on the strict walk.
const READ_ONLY_VIEW_TOOLS = Object.freeze({
  "tools/layout-check.mjs": ["src/browser/achievementTracker.js", "src/browser/achievementRecord.js"],
  "tools/store-screenshots/seed.mjs": ["src/browser/achievementTracker.js", "src/browser/achievementRecord.js"],
});

test("nothing reachable from tools/ is the tracker, the record module or the engine adapter", () => {
  const entries = listSources(path.join(ROOT, "tools"));
  assert.ok(entries.length > 10, "the walk starts from the real tools/ tree");
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
  const strict = entries.filter((f) => !(rel(f) in READ_ONLY_VIEW_TOOLS));
  const reached = reachableFrom(ROOT, strict);
  for (const forbidden of FORBIDDEN) {
    assert.ok(!reached.has(forbidden), `${forbidden} is reachable from tools/`);
  }
  for (const [tool, allowed] of Object.entries(READ_ONLY_VIEW_TOOLS)) {
    const viewReach = reachableFrom(ROOT, [path.join(ROOT, tool)]);
    for (const forbidden of FORBIDDEN.filter((p) => !allowed.includes(p))) {
      assert.ok(!viewReach.has(forbidden), `${forbidden} is reachable from ${tool}`);
    }
  }
});

test("the walk is not vacuous: it starts from the tuning bot and reaches the engine through it", () => {
  const bot = path.join(ROOT, "tools", "lib", "tuning-bot.mjs");
  assert.ok(fs.existsSync(bot));
  const fromBot = reachableFrom(ROOT, [bot]);
  assert.ok(fromBot.has("tools/lib/tuning-bot.mjs"));
  assert.ok(fromBot.has("engine/engine.js"), "the bot drives the engine directly");
  for (const forbidden of FORBIDDEN) assert.ok(!fromBot.has(forbidden), `${forbidden} reachable from the bot`);
  const all = reachableFrom(ROOT, listSources(path.join(ROOT, "tools")));
  assert.ok(all.has("engine/engine.js"));
});

test("teeth: a fixture tool importing the tracker is caught, statically, dynamically, by re-export and through a hop", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ach-isolation-"));
  try {
    fs.mkdirSync(path.join(dir, "tools", "lib"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src", "browser"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "browser", "achievementTracker.js"), "export const x = 1;\n");
    fs.writeFileSync(path.join(dir, "src", "browser", "achievementRecord.js"), "export const y = 1;\n");
    fs.writeFileSync(path.join(dir, "src", "browser", "engineAdapter.js"), "export const z = 1;\n");
    fs.writeFileSync(path.join(dir, "tools", "x.mjs"), 'import { x } from "../src/browser/achievementTracker.js";\nconsole.log(x);\n');
    fs.writeFileSync(path.join(dir, "tools", "y.mjs"), 'const m = await import("../src/browser/achievementTracker.js");\nconsole.log(m);\n');
    fs.writeFileSync(path.join(dir, "tools", "w.mjs"), 'export { y } from "../src/browser/achievementRecord.js";\n');
    fs.writeFileSync(path.join(dir, "tools", "lib", "hop.mjs"), 'import "../../src/browser/engineAdapter.js";\n');
    fs.writeFileSync(path.join(dir, "tools", "v.mjs"), 'import "./lib/hop.mjs";\n');
    fs.writeFileSync(path.join(dir, "tools", "clean.mjs"), 'import fs from "node:fs";\nconsole.log(fs);\n');

    const only = (name) => reachableFrom(dir, [path.join(dir, "tools", name)]);
    assert.ok(only("x.mjs").has("src/browser/achievementTracker.js"), "static import");
    assert.ok(only("y.mjs").has("src/browser/achievementTracker.js"), "dynamic import");
    assert.ok(only("w.mjs").has("src/browser/achievementRecord.js"), "re-export");
    assert.ok(only("v.mjs").has("src/browser/engineAdapter.js"), "an import through another tool");
    for (const forbidden of FORBIDDEN) assert.ok(!only("clean.mjs").has(forbidden), "a clean tool reaches none");

    const all = reachableFrom(dir, listSources(path.join(dir, "tools")));
    assert.ok(FORBIDDEN.every((f) => all.has(f)), "the whole-tools walk flags the fixture");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no file under tools/ names the achievements storage key", () => {
  const offenders = listSources(path.join(ROOT, "tools"))
    .filter((f) => fs.readFileSync(f, "utf8").includes("ddr.achievements"))
    .map((f) => path.relative(ROOT, f));
  assert.deepStrictEqual(offenders, []);
});
