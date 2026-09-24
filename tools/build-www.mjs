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
//   5. Phase 21 (TUNE-04, D-22): stamp the real app version into
//      www/index.html's Settings-sheet version line — read
//      android/version.properties' versionName/versionCode and replace the
//      `#mw-app-version` placeholder span's text ("dev" in the plain dev
//      loop) with "<versionName> (<versionCode>)". Throws if either
//      property or the placeholder itself is missing, so a stale/renamed
//      element can never silently ship an unstamped "dev" string.
//
// Run: node tools/build-www.mjs  (also wired as `npm run build:www`)

import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
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
  // 04-09: haptics — vendored + import-mapped exactly like the other
  // plugins so src/browser/haptics.js's guarded dynamic import
  // ('@capacitor/haptics') resolves in the Android WebView. Reached only via
  // that fail-open seam (never a network fetch), keeping the offline/no-SDK
  // posture — a first-party Capacitor plugin, not an ad/analytics SDK.
  "@capacitor/haptics",
  // Phase 67 (D-12/D-17): the Play Games Services plugin, vendored and
  // import-mapped so src/browser/playGames.js's guarded dynamic import
  // resolves in the Android WebView. Reached only on native with Compete ON;
  // the exact 0.5.0 pin was reviewed in 67-01 (installed as-is, D-20).
  "@modbender/capacitor-play-games",
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

// 02-04: self-hosted fonts (offline correctness — a paid, fully-offline app
// must issue zero network requests, including for fonts previously loaded
// from fonts.googleapis.com/fonts.gstatic.com). The repo-root fonts/
// directory is the source of truth (fetched once at build time on a
// networked machine); mazeworld.html's local @font-face rules reference
// "./fonts/*.woff2" relatively, which resolves against www/index.html here
// exactly the same way it resolves against mazeworld.html itself in the
// plain browser dev loop (both files live one level above their own
// fonts/ directory).
function copyFonts() {
  const src = path.join(ROOT, "fonts");
  if (!existsSync(src)) {
    throw new Error(`${src} does not exist — expected self-hosted font files (see mazeworld.html @font-face rules)`);
  }
  cpSync(src, path.join(WWW, "fonts"), { recursive: true });
  step("copied fonts/ into www/fonts/");
}

// 04-06: the 9 user-provided map icons (downscaled once to icons/optimized/,
// ~128-160px, source of truth committed under version control — see that
// directory's own commit for the dependency-free PowerShell/System.Drawing
// resize pipeline, mirroring 02-04's launcher-icon approach since
// @capacitor/assets is broken in this environment). No runtime fetch: this
// is a whole-directory copy at build time, exactly like copyFonts() above.
// NOTE: Phase 5 also edits this file (coordinate — see copySourceDirs()'s
// own header comment for the same note re: src/browser/).
function copyIcons() {
  const src = path.join(ROOT, "icons", "optimized");
  if (!existsSync(src)) {
    throw new Error(`${src} does not exist — expected the downscaled icons/optimized/*.png set (see mazeworld.html's icon-draw code)`);
  }
  cpSync(src, path.join(WWW, "icons", "optimized"), { recursive: true });
  step("copied icons/optimized/ into www/icons/optimized/");
}

// The vendored @capacitor/* plugin ESM (dist/esm/*.js) ships with
// EXTENSIONLESS relative specifiers — `export * from './definitions'`,
// `import('./web')` — and bare `@capacitor/core` specifiers. Bare specifiers
// resolve against www/index.html's import map (fine, even from nested
// modules), but extensionless relative specifiers do NOT resolve in the
// Android WebView: a request for `/vendor/@capacitor/preferences/definitions`
// (no `.js`) misses on disk, Capacitor's local server falls back to
// index.html (MIME text/html), and the browser rejects the module script
// ("Expected a JavaScript-or-Wasm module script but the server responded with
// a MIME type of text/html"). That throws during boot, so the module that
// calls SplashScreen.hide() and boots the game never runs → stuck on splash.
//
// Fix: after vendoring each package's full dist/esm tree, rewrite every
// relative import/export specifier in the .js files to include an explicit
// `.js` extension. Handles static `import ... from`, `export ... from`,
// bare side-effect `import '...'`, and dynamic `import('...')`. Bare
// specifiers (e.g. '@capacitor/core') are left untouched so they keep
// resolving through the document import map.
function needsJsExt(spec) {
  return (
    (spec.startsWith("./") || spec.startsWith("../")) &&
    !/\.(mjs|cjs|js|json|css|wasm)$/.test(spec)
  );
}

function rewriteRelativeSpecifiers(code) {
  // Group 1 = everything up to and including the opening quote; Group 2 = the
  // relative specifier; Group 3 = the closing quote. Covers:
  //   from '...'            (static import / re-export)
  //   import '...'          (side-effect import)
  //   import('...')         (dynamic import; optional whitespace after `(`)
  const patterns = [
    /(\bfrom\s*['"])([^'"]+)(['"])/g,
    /(\bimport\s+['"])([^'"]+)(['"])/g,
    /(\bimport\s*\(\s*['"])([^'"]+)(['"])/g,
  ];
  let out = code;
  for (const re of patterns) {
    out = out.replace(re, (match, pre, spec, post) =>
      needsJsExt(spec) ? `${pre}${spec}.js${post}` : match,
    );
  }
  return out;
}

function rewriteVendoredTree(destDir) {
  let rewrittenCount = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".js") || full.endsWith(".js.map")) continue;
      const code = readFileSync(full, "utf8");
      const rewritten = rewriteRelativeSpecifiers(code);
      if (rewritten !== code) {
        writeFileSync(full, rewritten, "utf8");
        rewrittenCount++;
      }
    }
  };
  walk(destDir);
  return rewrittenCount;
}

// DR2 (04-CONTEXT.md device-review round 2, Group 3 "Add a start/title
// screen"): the title screen's splash art (assets/ddr_splash.png), copied
// verbatim into www/assets/ — mirrors copyFonts()/copyIcons()'s pattern
// exactly (whole-file/dir copy at build time, no runtime fetch, fail loud if
// the source is missing rather than silently shipping a brokenimg). Only the
// ONE file the title screen references is copied, not the whole assets/
// directory (which also holds launcher-icon source art for a separate,
// unrelated build step).
function copySplash() {
  const src = path.join(ROOT, "assets", "ddr_splash.png");
  if (!existsSync(src)) {
    throw new Error(`${src} does not exist — expected the title screen's splash art (see mazeworld.html's #mw-title-screen)`);
  }
  mkdirSync(path.join(WWW, "assets"), { recursive: true });
  cpSync(src, path.join(WWW, "assets", "ddr_splash.png"));
  step("copied assets/ddr_splash.png into www/assets/ddr_splash.png");
}

// Phase 56 (AUD-06): the 30 delivered one-shot sound clips, whole-directory
// copied at build time — mirrors copyIcons() exactly (throw loudly if the
// source is missing, no per-file allowlist/filter/transcode, so a clip added
// to sfx/ later ships without a build change). This is what makes AUD-06's
// "first launch after install with the phone in airplane mode plays every
// clip" guarantee true: nothing in the audio path is ever fetched at
// runtime, only copied here at build time.
function copySfx() {
  const src = path.join(ROOT, "sfx");
  if (!existsSync(src)) {
    throw new Error(`${src} does not exist — expected the 30 delivered one-shot sfx/*.mp3 clips (see src/browser/sfx.js)`);
  }
  cpSync(src, path.join(WWW, "sfx"), { recursive: true });
  step("copied sfx/ into www/sfx/");
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
    const n = rewriteVendoredTree(destDir);
    if (n > 0) {
      step(`  ${pkg}: rewrote relative specifiers in ${n} .js file(s) to add .js extension`);
    }
    imports[pkg] = `./vendor/${pkg}/${entryFile}`;
  }
  step(`vendored ${CAPACITOR_PACKAGES.length} native plugin packages into www/vendor/`);
  return { imports };
}

// Phase 21 (TUNE-04, D-22): read android/version.properties the SAME way
// tools/bump-version.mjs does (mirrored regex, not re-imported — that script
// is a one-shot CLI, not a module) so build-www.mjs's version stamp can never
// silently drift from the file bump-version.mjs writes.
function readVersionProperties() {
  const file = path.join(ROOT, "android", "version.properties");
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist — expected versionCode/versionName for the build-www version stamp`);
  }
  const text = readFileSync(file, "utf8");
  const codeMatch = text.match(/^versionCode=(\d+)\s*$/m);
  const nameMatch = text.match(/^versionName=(.+?)\s*$/m);
  if (!codeMatch || !nameMatch) {
    throw new Error(`${file} is missing versionCode= or versionName= — cannot stamp www/index.html's version line`);
  }
  return { versionCode: codeMatch[1], versionName: nameMatch[1] };
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

  // Phase 21 (TUNE-04, D-22): stamp the built app's real version into the
  // Settings sheet's version line, replacing the "dev" placeholder the plain
  // dev loop shows. Throws if the exact placeholder span is missing — a
  // stale/renamed element must never silently ship an unstamped "dev" string.
  const { versionName, versionCode } = readVersionProperties();
  const placeholder = '<span id="mw-app-version">dev</span>';
  if (!html.includes(placeholder)) {
    throw new Error("mazeworld.html is missing the #mw-app-version placeholder — cannot stamp the version");
  }
  html = html.replace(placeholder, `<span id="mw-app-version">${versionName} (${versionCode})</span>`);
  step(`stamped version ${versionName} (${versionCode}) into www/index.html`);

  writeFileSync(path.join(WWW, "index.html"), html, "utf8");
  step("wrote www/index.html (mazeworld.html + injected import map)");
}

function main() {
  cleanWww();
  copySourceDirs();
  copyFonts();
  copyIcons();
  copySplash();
  copySfx();
  const importMap = vendorCapacitorPackages();
  writeIndexHtml(importMap);
  step("done");
}

main();
