// test/unit/build-www-vendoring.test.js
//
// Phase 85 (RETIRE-02, plan 06): moved out of the retired play-games-intake
// test's T-67-03 block. build-www.mjs vendors each CAPACITOR_PACKAGES entry
// into www/vendor/ and maps its bare name in the import map it injects into
// www/index.html. A src/browser module that dynamically imports a bare
// specifier NOT on that list fails to resolve in the Android WebView (the
// stuck-on-splash bug class). This scan turns that into a node test failure
// instead. It names no retired package — the guard is generic and outlives
// any one plugin.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const BUILD_WWW = readFileSync(path.join(REPO_ROOT, "tools", "build-www.mjs"), "utf8");

function vendoredPackages() {
  const m = BUILD_WWW.match(/const CAPACITOR_PACKAGES = \[([\s\S]*?)\];/);
  assert.ok(m, "tools/build-www.mjs declares a CAPACITOR_PACKAGES array literal");
  const body = stripJs(m[1]);
  return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function browserModules(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...browserModules(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function bareDynamicImports(src) {
  const code = stripJs(src);
  const specs = [];
  for (const m of code.matchAll(/\bimport\s*\(\s*(["'`])([^"'`]+)\1\s*\)/g)) {
    const spec = m[2];
    if (!spec.startsWith(".") && !spec.startsWith("/")) specs.push(spec);
  }
  return specs;
}

test("the dynamic-import scanner separates bare, relative and commented specifiers", () => {
  const sample = [
    'const a = await import("@capacitor/app");',
    "const b = await import('./local.js');",
    '// const c = await import("@not/real");',
    '/* await import("@also/not-real") */',
    "const d = await import(`@made-up/example-package`);",
  ].join("\n");
  assert.deepEqual(bareDynamicImports(sample), ["@capacitor/app", "@made-up/example-package"]);
});

test("@capacitor/core stays vendored", () => {
  const list = vendoredPackages();
  assert.ok(list.includes("@capacitor/core"), "core must stay on the vendoring list — every plugin imports it by bare specifier");
});

test("every bare-specifier dynamic import in src/browser is on build-www's CAPACITOR_PACKAGES list", () => {
  const list = new Set(vendoredPackages());
  const modules = browserModules(path.join(REPO_ROOT, "src", "browser"));
  assert.ok(modules.length > 0, "src/browser holds modules to scan");
  const missing = [];
  let seen = 0;
  for (const file of modules) {
    for (const spec of bareDynamicImports(readFileSync(file, "utf8"))) {
      seen += 1;
      if (!list.has(spec)) missing.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
    }
  }
  assert.ok(seen > 0, "the scan found the existing guarded @capacitor/* dynamic imports");
  assert.deepEqual(missing, [], "bare dynamic imports missing from build-www's CAPACITOR_PACKAGES");
});
