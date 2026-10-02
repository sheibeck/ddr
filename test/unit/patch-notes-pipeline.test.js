// test/unit/patch-notes-pipeline.test.js
//
// Phase 79.3 (NOTES-01), Plan 03 — the patch-notes library, its CLI, and the
// build-www bundling step. Task 2 covers tools/lib/patch-notes.mjs and
// tools/patch-notes.mjs (D-18, D-22); Task 3 appends the build-www
// source-scan test and the RELEASING.md step test (D-19).

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

import {
  NOTES_CATEGORIES,
  PLAY_WHATS_NEW_MAX,
  DATA_MODULE_PATH,
  NOTES_DIR,
  SITE_NOTES_DIR,
  REPO_ROOT,
  readVersionName,
  notesPathFor,
  validatePatchNotes,
  readNotesFor,
  notesModuleSource,
  releaseBody,
  playWhatsNew,
  siteNotesPathFor,
  validateSiteDir,
  writeSiteNotes,
} from "../../tools/lib/patch-notes.mjs";
import { BANK_REGISTRY, NON_COPY_EXPORTS } from "../../tools/lib/voice-corpus.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CLI_PATH = path.join(REPO_ROOT, "tools", "patch-notes.mjs");
const BUILD_WWW_PATH = path.join(REPO_ROOT, "tools", "build-www.mjs");
const RELEASING_PATH = path.join(REPO_ROOT, "docs", "RELEASING.md");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8", ...opts });
}

/** makeTempRoot(files) — a temp dir with android/version.properties and any
 * docs/patch-notes/*.md files supplied, laid out like the real repo. */
function makeTempRoot(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "patch-notes-"));
  fs.mkdirSync(path.join(dir, "android"), { recursive: true });
  fs.mkdirSync(path.join(dir, ...NOTES_DIR.split("/")), { recursive: true });
  fs.mkdirSync(path.join(dir, "src", "browser"), { recursive: true });
  fs.writeFileSync(path.join(dir, "android", "version.properties"), "versionCode=1\nversionName=2.1.0\n", "utf8");
  for (const [name, content] of Object.entries(files || {})) {
    fs.writeFileSync(path.join(dir, ...NOTES_DIR.split("/"), name), content, "utf8");
  }
  return dir;
}

/** makeTempSite() — a temp dir laid out like the website repo: package.json
 * and an src/ directory, nothing under SITE_NOTES_DIR yet. */
function makeTempSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddr-site-"));
  fs.writeFileSync(path.join(dir, "package.json"), "{}\n", "utf8");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  return dir;
}

// ─── validatePatchNotes ─────────────────────────────────────────────────────

test("validatePatchNotes: the committed 2.1.0.md is valid", () => {
  const md = fs.readFileSync(notesPathFor("2.1.0", REPO_ROOT), "utf8");
  assert.deepStrictEqual(validatePatchNotes(md, "2.1.0"), []);
});

const VALID_2_1_0 = [
  "# Delve, Die, Repeat 2.1.0",
  "",
  "## Headline",
  "Version 2.1.0.",
  "- A bullet.",
  "",
  "## Interface",
  "- Another bullet.",
  "",
].join("\n");

test("validatePatchNotes: a bad first line, a bad first category, an unknown category and a duplicate each report", () => {
  assert.ok(validatePatchNotes(VALID_2_1_0.replace("# Delve, Die, Repeat 2.1.0", "# Wrong Title"), "2.1.0").length > 0);
  assert.ok(validatePatchNotes(VALID_2_1_0.replace("## Headline", "## Interface"), "2.1.0").length > 0);
  assert.ok(validatePatchNotes(VALID_2_1_0.replace("## Interface", "## Not A Category"), "2.1.0").length > 0);
  const dup = VALID_2_1_0 + "\n## Interface\n- yet another\n";
  assert.ok(validatePatchNotes(dup, "2.1.0").length > 0);
});

test("validatePatchNotes: an empty category, ### outside Classes, a raw <, and a bad version each report", () => {
  const empty = ["# Delve, Die, Repeat 2.1.0", "", "## Headline", "", "## Interface", "- x", ""].join("\n");
  assert.ok(validatePatchNotes(empty, "2.1.0").some((e) => /empty/.test(e)));

  const badH3 = VALID_2_1_0 + "\n### Not Classes\n- x\n";
  assert.ok(validatePatchNotes(badH3, "2.1.0").some((e) => /###/.test(e)));

  const rawHtml = VALID_2_1_0.replace("- A bullet.", "- A <b>bullet</b>.");
  assert.ok(validatePatchNotes(rawHtml, "2.1.0").some((e) => /raw </.test(e)));

  assert.ok(validatePatchNotes(VALID_2_1_0, "2.1").some((e) => /X\.Y\.Z/.test(e)));
});

test("validatePatchNotes: categories out of order report", () => {
  const outOfOrder = [
    "# Delve, Die, Repeat 2.1.0",
    "",
    "## Headline",
    "Version 2.1.0.",
    "- A bullet.",
    "",
    "## Bug fixes",
    "- x",
    "",
    "## Interface",
    "- y",
    "",
  ].join("\n");
  assert.ok(validatePatchNotes(outOfOrder, "2.1.0").some((e) => /order/.test(e)));
});

test("validatePatchNotes: per-class ### subheadings under ## Classes are legal", () => {
  const withClasses = [
    "# Delve, Die, Repeat 2.1.0",
    "",
    "## Headline",
    "Version 2.1.0.",
    "- A bullet.",
    "",
    "## Classes",
    "### Fighter",
    "- Old thing to new thing.",
    "### Knight (Fighter)",
    "- Old thing to new thing.",
    "",
  ].join("\n");
  assert.deepStrictEqual(validatePatchNotes(withClasses, "2.1.0"), []);
});

// ─── readNotesFor ───────────────────────────────────────────────────────────

test("readNotesFor: a missing file throws naming the path and NOTES-01", () => {
  const tmp = makeTempRoot({});
  try {
    assert.throws(() => readNotesFor("9.9.9", tmp), (err) => {
      assert.match(err.message, /docs\/patch-notes\/9\.9\.9\.md/);
      assert.match(err.message, /NOTES-01/);
      return true;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("readNotesFor: an invalid file throws with its validation errors joined", () => {
  const tmp = makeTempRoot({ "2.1.0.md": "# Wrong title\n\n## Interface\n- x\n" });
  try {
    assert.throws(() => readNotesFor("2.1.0", tmp), (err) => {
      assert.match(err.message, /docs\/patch-notes\/2\.1\.0\.md/);
      assert.match(err.message, /NOTES-01/);
      assert.ok(err.message.length > 40, "expects the joined errors, not a bare label");
      return true;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("readNotesFor: a valid file round-trips LF-normalised with a BOM stripped", () => {
  const tmp = makeTempRoot({ "2.1.0.md": `﻿${VALID_2_1_0.replace(/\n/g, "\r\n")}` });
  try {
    const md = readNotesFor("2.1.0", tmp);
    assert.ok(!md.includes("\r"));
    assert.ok(!md.startsWith("﻿"));
    assert.deepStrictEqual(validatePatchNotes(md, "2.1.0"), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── notesModuleSource ──────────────────────────────────────────────────────

test("notesModuleSource: deterministic, GENERATED header names --write-module and D-19, round-trips through an import", async () => {
  const md = VALID_2_1_0;
  const src1 = notesModuleSource("2.1.0", md);
  const src2 = notesModuleSource("2.1.0", md);
  assert.equal(src1, src2);
  assert.match(src1, /^\/\/ .*\n\/\/\n\/\/ GENERATED/);
  assert.match(src1, /--write-module/);
  assert.match(src1, /D-19/);
  assert.match(src1, /export const PATCH_NOTES = Object\.freeze\(\{ version: "2\.1\.0", markdown: /);

  const tmpFile = path.join(os.tmpdir(), `patch-notes-module-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmpFile, src1, "utf8");
  try {
    const mod = await import(url.pathToFileURL(tmpFile).href);
    assert.equal(mod.PATCH_NOTES.version, "2.1.0");
    assert.equal(mod.PATCH_NOTES.markdown, md.replace(/\r\n/g, "\n"));
    assert.ok(Object.isFrozen(mod.PATCH_NOTES));
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});

test("notesModuleSource: CRLF markdown normalises to LF in the generated source", () => {
  const src = notesModuleSource("2.1.0", VALID_2_1_0.replace(/\n/g, "\r\n"));
  assert.ok(!src.includes("\\r"));
});

// ─── the committed generated module and versionName (the in-suite release gate) ─

test("the committed src/browser/patchNotesData.js equals notesModuleSource(readVersionName(), readNotesFor(...)), CRLF-normalised", () => {
  const version = readVersionName(REPO_ROOT);
  const md = readNotesFor(version, REPO_ROOT);
  const expected = notesModuleSource(version, md);
  const committedPath = path.join(REPO_ROOT, ...DATA_MODULE_PATH.split("/"));
  const committed = fs.readFileSync(committedPath, "utf8").replace(/\r\n/g, "\n");
  assert.equal(committed, expected);
});

test("readVersionName() is 2.3.0 with a notes file that exists for it", () => {
  const version = readVersionName(REPO_ROOT);
  assert.equal(version, "2.3.0");
  assert.ok(fs.existsSync(notesPathFor(version, REPO_ROOT)));
  assert.deepStrictEqual(validatePatchNotes(fs.readFileSync(notesPathFor(version, REPO_ROOT), "utf8"), version), []);
});

// ─── releaseBody ────────────────────────────────────────────────────────────

test("releaseBody: drops the # title line and leading blank lines, starts with ## Headline", () => {
  const body = releaseBody(VALID_2_1_0);
  assert.ok(body.startsWith("## Headline"));
  assert.ok(!body.includes("# Delve, Die, Repeat"));
});

// ─── playWhatsNew ───────────────────────────────────────────────────────────

test("playWhatsNew: the Headline paragraph plus bulleted lines, bold/link syntax stripped, at most 500 for 2.1.0.md", () => {
  const md = fs.readFileSync(notesPathFor("2.1.0", REPO_ROOT), "utf8");
  const cut = playWhatsNew(md);
  assert.ok(cut.length <= PLAY_WHATS_NEW_MAX);
  assert.ok(cut.includes("• "));
  assert.ok(!cut.includes("**"));
  assert.ok(!cut.includes("]("));

  const bolded = [
    "# Delve, Die, Repeat 2.1.0",
    "",
    "## Headline",
    "A **bold** headline with a [link](https://example.com/x).",
    "- A **bold** bullet.",
    "",
  ].join("\n");
  const cut2 = playWhatsNew(bolded);
  assert.ok(!cut2.includes("**"));
  assert.ok(!cut2.includes("]("));
  assert.ok(cut2.includes("link"));
});

test("playWhatsNew: a crafted 600-character headline throws naming 500 and the length; a missing or empty Headline throws", () => {
  const long = "x".repeat(600);
  const over = ["# Delve, Die, Repeat 2.1.0", "", "## Headline", long, ""].join("\n");
  assert.throws(() => playWhatsNew(over), (err) => {
    assert.match(err.message, /500/);
    assert.match(err.message, /600/);
    return true;
  });

  const missing = ["# Delve, Die, Repeat 2.1.0", "", "## Interface", "- x", ""].join("\n");
  assert.throws(() => playWhatsNew(missing));

  const empty = ["# Delve, Die, Repeat 2.1.0", "", "## Headline", "", "## Interface", "- x", ""].join("\n");
  assert.throws(() => playWhatsNew(empty));
});

// ─── site notes (260928-web: --site) ────────────────────────────────────────

test("siteNotesPathFor: <siteDir>/src/data/ddr-patch-notes/<version>.md", () => {
  assert.equal(siteNotesPathFor("2.1.0", "/site"), path.join("/site", ...SITE_NOTES_DIR.split("/"), "2.1.0.md"));
});

test("validateSiteDir: throws a clear message when the dir is missing, has no package.json, or has no src/", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddr-site-"));
  try {
    assert.throws(() => validateSiteDir(path.join(tmp, "nope")), /is missing/);

    const noPkg = path.join(tmp, "no-pkg");
    fs.mkdirSync(path.join(noPkg, "src"), { recursive: true });
    assert.throws(() => validateSiteDir(noPkg), /package\.json/);

    const noSrc = path.join(tmp, "no-src");
    fs.mkdirSync(noSrc, { recursive: true });
    fs.writeFileSync(path.join(noSrc, "package.json"), "{}\n", "utf8");
    assert.throws(() => validateSiteDir(noSrc), /src\//);

    const ok = makeTempSite();
    assert.doesNotThrow(() => validateSiteDir(ok));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeSiteNotes: writes the markdown byte-for-byte, creating the folder, and returns the written path", () => {
  const site = makeTempSite();
  try {
    const md = fs.readFileSync(notesPathFor("2.1.0", REPO_ROOT), "utf8");
    const written = writeSiteNotes("2.1.0", md, site);
    assert.equal(written, siteNotesPathFor("2.1.0", site));
    assert.equal(fs.readFileSync(written, "utf8"), md);
  } finally {
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test("writeSiteNotes: propagates validateSiteDir's error for a non-website dir", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddr-not-site-"));
  try {
    assert.throws(() => writeSiteNotes("2.1.0", "# x\n", tmp), /package\.json/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── CLI ────────────────────────────────────────────────────────────────────

test("CLI: --check exits 0 on the repo and prints OK", () => {
  const res = run(["--check"], { cwd: REPO_ROOT });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /OK/);
});

test("CLI: --play prints at most 500 characters", () => {
  const res = run(["--play"], { cwd: REPO_ROOT });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.trimEnd().length <= PLAY_WHATS_NEW_MAX);
});

test("CLI: --release-body prints text containing ## Headline", () => {
  const res = run(["--release-body"], { cwd: REPO_ROOT });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /## Headline/);
});

test("CLI: --version 9.9.9 --check exits 1", () => {
  const res = run(["--version", "9.9.9", "--check"], { cwd: REPO_ROOT });
  assert.equal(res.status, 1);
});

test("CLI: no flag, or two action flags, exits 2", () => {
  assert.equal(run([], { cwd: REPO_ROOT }).status, 2);
  assert.equal(run(["--check", "--play"], { cwd: REPO_ROOT }).status, 2);
});

test("CLI: --site <dir> validates, writes the file under the site dir, and prints its path", () => {
  const site = makeTempSite();
  try {
    const res = run(["--site", site], { cwd: REPO_ROOT });
    assert.equal(res.status, 0, res.stderr);
    const written = res.stdout.trim();
    assert.equal(written, siteNotesPathFor("2.3.0", site));
    assert.equal(fs.readFileSync(written, "utf8"), readNotesFor("2.3.0", REPO_ROOT));
  } finally {
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test("CLI: --site <dir> with no package.json/src exits 1 naming the dir", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddr-not-site-"));
  try {
    const res = run(["--site", tmp], { cwd: REPO_ROOT });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /package\.json/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLI: --site with no directory value exits 2 with usage", () => {
  const res = run(["--site"], { cwd: REPO_ROOT });
  assert.equal(res.status, 2);
});

test("CLI: --check exits 1 with --write-module in its message when the committed module is stale", () => {
  const tmp = makeTempRoot({ "2.1.0.md": VALID_2_1_0 });
  try {
    // No src/browser/patchNotesData.js written at all — the committed module
    // is absent, which the --check comparison also treats as stale.
    const res = run(["--root", tmp, "--check"], {});
    assert.equal(res.status, 1);
    assert.match(res.stderr, /--write-module/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── voice-corpus registry rows ─────────────────────────────────────────────

test("voice corpus: BANK_REGISTRY has patchNotes.js#PATCH_NOTES_COPY; NON_COPY_EXPORTS has patchNotesData.js#PATCH_NOTES", () => {
  assert.ok(BANK_REGISTRY.some((r) => r.module === "src/browser/patchNotes.js" && r.export === "PATCH_NOTES_COPY"));
  assert.ok(NON_COPY_EXPORTS.some((r) => r.module === "src/browser/patchNotesData.js" && r.export === "PATCH_NOTES"));
});

test("NOTES_CATEGORIES is the fixed 8-category order with Headline first", () => {
  assert.deepStrictEqual(NOTES_CATEGORIES, [
    "Headline",
    "Classes",
    "Races",
    "Abilities & spells",
    "Items & gear",
    "Monsters & difficulty",
    "Interface",
    "Bug fixes",
  ]);
});

// ─── build-www source-scan (Task 3, D-19) ──────────────────────────────────
// Following test/unit/sfx-assets.test.js's copySfx() pattern: pins the
// bundlePatchNotes() wiring by source scan rather than by actually running
// the build (the full build:www + boot:check run is the gate step below).

test("build-www: defines bundlePatchNotes(), whose body calls readNotesFor( and notesModuleSource(", () => {
  const code = fs.readFileSync(BUILD_WWW_PATH, "utf8");
  assert.match(code, /function bundlePatchNotes\s*\(/, "expected a function bundlePatchNotes( definition");
  const fnStart = code.indexOf("function bundlePatchNotes(");
  const nextFnStart = code.indexOf("\nfunction ", fnStart + 1);
  const fnBody = nextFnStart === -1 ? code.slice(fnStart) : code.slice(fnStart, nextFnStart);
  assert.match(fnBody, /readNotesFor\(/, "expected bundlePatchNotes() to call readNotesFor(");
  assert.match(fnBody, /notesModuleSource\(/, "expected bundlePatchNotes() to call notesModuleSource(");
});

test("build-www: bundlePatchNotes(); is called after copySourceDirs(); and before writeIndexHtml(", () => {
  const code = fs.readFileSync(BUILD_WWW_PATH, "utf8");
  const copySourceIdx = code.indexOf("copySourceDirs();");
  const bundleIdx = code.indexOf("bundlePatchNotes();");
  const writeIndexCallIdx = code.indexOf("writeIndexHtml(importMap);");
  assert.ok(copySourceIdx !== -1 && bundleIdx !== -1 && writeIndexCallIdx !== -1);
  assert.ok(bundleIdx > copySourceIdx, "expected bundlePatchNotes(); to be called after copySourceDirs();");
  assert.ok(bundleIdx < writeIndexCallIdx, "expected bundlePatchNotes(); to be called before the writeIndexHtml(importMap); call");
});

test("build-www: the CAPACITOR_PACKAGES literal is untouched (still includes @capacitor/core)", () => {
  const code = fs.readFileSync(BUILD_WWW_PATH, "utf8");
  assert.match(code, /"@capacitor\/core"/);
});

// ─── RELEASING.md step (Task 3, D-22) ──────────────────────────────────────

test("RELEASING.md: carries the patch-notes step (docs/patch-notes/, --check, --play, --release-body, gh release create)", () => {
  const doc = fs.readFileSync(RELEASING_PATH, "utf8");
  assert.match(doc, /docs\/patch-notes\//);
  assert.match(doc, /node tools\/patch-notes\.mjs --check/);
  assert.match(doc, /node tools\/patch-notes\.mjs --play/);
  assert.match(doc, /node tools\/patch-notes\.mjs --release-body/);
  assert.match(doc, /gh release create/);
});
