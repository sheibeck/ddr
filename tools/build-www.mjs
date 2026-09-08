#!/usr/bin/env node
// tools/build-www.mjs
//
// Single-source-of-truth build script for the Capacitor `www/` webDir
// (02-RESEARCH.md "webDir Strategy"). Node built-ins only — no bundler, no
// new build dependency, matching this project's zero-build-step ethos for
// the plain browser dev loop (`mazeworld.html` at the repo root is NEVER
// modified by this script; only read).
//
// What this does, in order:
//   1. Recreate an empty www/ (a build output — gitignored, regenerated
//      every run; never hand-edit anything inside it).
//   2. Recursively copy engine/, content/, src/ into www/ at the same
//      relative layout, verbatim — preserves the single source of truth
//      those directories' plain relative ES module imports depend on.
//   3. Vendor each installed @capacitor/* package's pre-built ESM entry
//      (reading ITS OWN package.json "module" field — the entry path
//      differs per package, core is dist/index.js, every plugin is
//      dist/esm/index.js; never assume a uniform path) into
//      www/vendor/@capacitor/<pkg>/, as a recursive directory copy (a
//      plugin's ESM entry can import sibling files, e.g. web.js, from
//      within its own dist/esm tree).
//   4. Read mazeworld.html's text and inject a <script type="importmap">
//      block mapping each vendored @capacitor/* bare specifier to its
//      vendored path, before </head>, then write the result as
//      www/index.html. This import map exists ONLY in www/index.html —
//      the Capacitor imports it resolves are only ever reached behind a
//      window.Capacitor?.isNativePlatform() runtime guard (src/browser/
//      storage.js), which is always false/absent in the plain dev loop, so
//      the dev loop never needs this import map and mazeworld.html itself
//      is left untouched on disk.
//
// Run: node tools/build-www.mjs  (also wired as `npm run build:www`)

import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");

// The exact @capacitor/* packages this project installs (Task 1's
// npm-install allow-list) — every one gets vendored so later plans (02-03
// wires storage.js's dynamic import('@capacitor/preferences'); 02-04 wires
// App/SplashScreen/StatusBar/ScreenOrientation in nativeChrome.js) resolve
// without needing to touch this script again.
const CAPACITOR_PACKAGES = [
  "@capacitor/core",
  "@capacitor/preferences",
  "@capacitor/app",
  "@capacitor/splash-screen",
  "@capacitor/status-bar",
  "@capacitor/screen-orientation",
];

function step(msg) {
  console.log(`[build-www] ${msg}`);
}

function cleanWww() {
  rmSync(WWW, { recursive: true, force: true });
  mkdirSync(WWW, { recursive: true });
  step("cleaned www/");
}

function copySourceDirs() {
  for (const dir of ["engine", "content", "src"]) {
    const src = path.join(ROOT, dir);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(WWW, dir), { recursive: true });
  }
  step("copied engine/, content/, src/ into www/");
}

function vendorCapacitorPackages() {
  const imports = {};
  for (const pkg of CAPACITOR_PACKAGES) {
    const pkgDir = path.join(ROOT, "node_modules", pkg);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) {
      throw new Error(
        `${pkg} is not installed (expected ${pkgJsonPath}) — run npm install first`,
      );
    }
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const modulePath = pkgJson.module;
    if (!modulePath) {
      throw new Error(
        `${pkg}: package.json has no "module" field — cannot determine its ESM entry`,
      );
    }
    const normalized = modulePath.replace(/\\/g, "/");
    const entryDir = path.posix.dirname(normalized); // e.g. "dist" or "dist/esm"
    const entryFile = path.posix.basename(normalized); // e.g. "index.js"
    const srcDir = path.join(pkgDir, ...entryDir.split("/"));
    const destDir = path.join(WWW, "vendor", ...pkg.split("/"));
    cpSync(srcDir, destDir, { recursive: true });
    imports[pkg] = `./vendor/${pkg}/${entryFile}`;
  }
  step(`vendored ${CAPACITOR_PACKAGES.length} @capacitor/* packages into www/vendor/`);
  return { imports };
}

function writeIndexHtml(importMap) {
  const htmlSrcPath = path.join(ROOT, "mazeworld.html");
  let html = readFileSync(htmlSrcPath, "utf8");
  if (!html.includes("</head>")) {
    throw new Error("mazeworld.html has no </head> — cannot inject import map");
  }
  const importMapTag =
    `<script type="importmap">\n${JSON.stringify(importMap, null, 2)}\n</script>\n`;
  html = html.replace("</head>", `${importMapTag}</head>`);
  writeFileSync(path.join(WWW, "index.html"), html, "utf8");
  step("wrote www/index.html (mazeworld.html + injected import map)");
}

function main() {
  cleanWww();
  copySourceDirs();
  const importMap = vendorCapacitorPackages();
  writeIndexHtml(importMap);
  step("done");
}

main();
