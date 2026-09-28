// tools/lib/patch-notes.mjs
//
// Phase 79.3, NOTES-01 — D-18 (the source format and its validator), D-19
// (the generated in-app module) and D-22 (the Release body and the Play
// "What's new" cut). tools/patch-notes.mjs is the CLI that wraps this
// module; tools/build-www.mjs's bundlePatchNotes() calls readNotesFor() and
// notesModuleSource() directly.
//
// This file lives in tools/, not src/browser, on purpose: its error
// sentences and NOTES_CATEGORIES ("Abilities & spells" reads as copy) would
// otherwise enter the voice-corpus raw sweep, which only scans src/browser,
// engine and mazeworld.html (docs/narrative-pass/README.md "The corpus").
//
// Node built-ins only — no Markdown library (D-20: this project ships no
// third-party parsing dependency for the notes).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { parsePatchNotes } from "../../src/browser/patchNotes.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** REPO_ROOT — resolved from this file's own location (tools/lib/). */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** NOTES_CATEGORIES — D-18's fixed category order (Headline first, then the
 * seven content categories). Empty categories are dropped when the file is
 * authored; this array is the canonical order the validator enforces. */
export const NOTES_CATEGORIES = Object.freeze([
  "Headline",
  "Classes",
  "Races",
  "Abilities & spells",
  "Items & gear",
  "Monsters & difficulty",
  "Interface",
  "Bug fixes",
]);

/** NOTES_DIR — the source directory, posix-style (used both for path.join
 * and for error-message text, so messages never carry a backslash). */
export const NOTES_DIR = "docs/patch-notes";

/** PLAY_WHATS_NEW_MAX — the Play "What's new" character budget (D-22). */
export const PLAY_WHATS_NEW_MAX = 500;

/** DATA_MODULE_PATH — the generated in-app module's repo-relative path. */
export const DATA_MODULE_PATH = "src/browser/patchNotesData.js";

const VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * readVersionName(root) — android/version.properties' versionName, mirroring
 * tools/build-www.mjs#readVersionProperties' own regex so the two can never
 * silently drift.
 */
export function readVersionName(root) {
  const dir = root || REPO_ROOT;
  const file = path.join(dir, "android", "version.properties");
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^versionName=(.+?)\s*$/m);
  if (!match) throw new Error(`${file} is missing versionName=`);
  return match[1];
}

/** notesPathFor(version, root) — docs/patch-notes/<version>.md under root. */
export function notesPathFor(version, root) {
  const dir = root || REPO_ROOT;
  return path.join(dir, ...NOTES_DIR.split("/"), `${version}.md`);
}

/**
 * validatePatchNotes(md, version) — D-18's format rules as a list of plain
 * sentences (empty when the file is valid): the exact title line, the first
 * category being Headline, every category known/ordered/non-duplicate/
 * non-empty, `###` only inside `## Classes`, no raw `<`, and a version
 * string matching X.Y.Z.
 */
export function validatePatchNotes(md, version) {
  const errors = [];
  if (typeof version !== "string" || !VERSION_RE.test(version)) {
    errors.push(`version "${String(version)}" does not match the required X.Y.Z pattern`);
  }
  if (typeof md !== "string") {
    errors.push("the notes file is not a string");
    return errors;
  }
  const text = md.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (text.includes("<")) {
    errors.push("the notes file contains a raw < character; raw HTML is refused");
  }

  const lines = text.split("\n");
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim() !== "");
  const expectedTitle = `# Delve, Die, Repeat ${version}`;
  if (firstNonEmptyIdx === -1 || lines[firstNonEmptyIdx] !== expectedTitle) {
    errors.push(`the first line must be exactly "${expectedTitle}"`);
  }

  const h2Indices = [];
  lines.forEach((l, idx) => {
    if (/^##\s+/.test(l) && !/^###/.test(l)) h2Indices.push(idx);
  });
  if (h2Indices.length === 0) {
    errors.push('the notes file has no "## " category sections');
  } else {
    const firstTitle = lines[h2Indices[0]].replace(/^##\s+/, "").trim();
    if (firstTitle !== "Headline") {
      errors.push(`the first "##" section must be "## Headline", found "## ${firstTitle}"`);
    }
  }

  const seen = new Set();
  const order = [];
  for (let i = 0; i < h2Indices.length; i++) {
    const idx = h2Indices[i];
    const title = lines[idx].replace(/^##\s+/, "").trim();
    if (!NOTES_CATEGORIES.includes(title)) {
      errors.push(`unknown category "${title}"`);
      continue;
    }
    if (seen.has(title)) {
      errors.push(`duplicate category "${title}"`);
    }
    seen.add(title);
    order.push(title);

    const nextIdx = i + 1 < h2Indices.length ? h2Indices[i + 1] : lines.length;
    const body = lines.slice(idx + 1, nextIdx);
    const nonBlankBody = body.filter((l) => l.trim() !== "");
    if (nonBlankBody.length === 0) {
      errors.push(`category "${title}" is empty`);
    }
    if (title !== "Classes") {
      for (const l of body) {
        if (/^###\s/.test(l)) errors.push(`"###" is only allowed inside "## Classes" (found in "${title}")`);
      }
    }
  }

  const knownOrder = order.filter((t) => NOTES_CATEGORIES.includes(t));
  const expectedSubsequence = NOTES_CATEGORIES.filter((c) => knownOrder.includes(c));
  if (JSON.stringify(knownOrder) !== JSON.stringify(expectedSubsequence)) {
    errors.push("categories are out of order");
  }

  return errors;
}

/**
 * readNotesFor(version, root) — the LF-normalised, BOM-stripped notes file
 * for `version`, validated. Throws (message names the repo-relative path and
 * "NOTES-01") when the file is missing; throws with its validation errors
 * joined when it is malformed.
 */
export function readNotesFor(version, root) {
  const dir = root || REPO_ROOT;
  const relPath = `${NOTES_DIR}/${version}.md`;
  const file = notesPathFor(version, dir);
  if (!fs.existsSync(file)) {
    throw new Error(`${relPath} is missing (NOTES-01: every Play release needs its own patch-notes file)`);
  }
  const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const errors = validatePatchNotes(raw, version);
  if (errors.length) {
    throw new Error(`${relPath} is invalid (NOTES-01): ${errors.join("; ")}`);
  }
  return raw;
}

/**
 * notesModuleSource(version, md) — the deterministic generated-module
 * source: a `// GENERATED` header naming `node tools/patch-notes.mjs
 * --write-module` and D-19, then `export const PATCH_NOTES =
 * Object.freeze({ version, markdown })`.
 */
export function notesModuleSource(version, md) {
  const markdown = typeof md === "string" ? md.replace(/\r\n/g, "\n") : "";
  const header = [
    "// src/browser/patchNotesData.js",
    "//",
    "// GENERATED by `node tools/patch-notes.mjs --write-module` — do not hand-edit.",
    "// Phase 79.3, NOTES-01, D-19: bundled by tools/build-www.mjs#bundlePatchNotes",
    "// from docs/patch-notes/<versionName>.md, so the dev loop and the shipped app",
    "// read the exact same release notes. A test pins this file to the Markdown.",
    "",
  ].join("\n");
  const body = `export const PATCH_NOTES = Object.freeze({ version: ${JSON.stringify(version)}, markdown: ${JSON.stringify(markdown)} });\n`;
  return `${header}${body}`;
}

function inlineText(inlines) {
  return (inlines || []).map((i) => i.text).join("");
}

/**
 * releaseBody(md) — the GitHub Release body: the `# ` title line and any
 * leading blank lines dropped, starting at `## Headline`.
 */
export function releaseBody(md) {
  const text = typeof md === "string" ? md.replace(/\r\n/g, "\n") : "";
  const lines = text.split("\n");
  let i = 0;
  if (lines[i] !== undefined && /^#\s/.test(lines[i])) i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  return `${lines.slice(i).join("\n").replace(/\s+$/, "")}\n`;
}

/**
 * playWhatsNew(md) — the Headline section's paragraph text plus "• " + text
 * for each of its bullets, joined with "\n", bold markers and link syntax
 * stripped (parsePatchNotes already reduces those to plain inline text).
 * Throws when the Headline section is missing or empty, or when the cut
 * exceeds PLAY_WHATS_NEW_MAX characters (D-22).
 */
export function playWhatsNew(md) {
  const blocks = parsePatchNotes(md);
  const headIdx = blocks.findIndex((b) => b.type === "h2" && inlineText(b.inlines) === "Headline");
  if (headIdx === -1) {
    throw new Error('playWhatsNew: the notes have no "## Headline" section');
  }
  let endIdx = blocks.length;
  for (let i = headIdx + 1; i < blocks.length; i++) {
    if (blocks[i].type === "h2") {
      endIdx = i;
      break;
    }
  }
  const lines = [];
  for (const block of blocks.slice(headIdx + 1, endIdx)) {
    if (block.type === "p") lines.push(inlineText(block.inlines));
    else if (block.type === "ul") for (const item of block.items) lines.push(`• ${inlineText(item)}`);
  }
  if (lines.length === 0) {
    throw new Error('playWhatsNew: the "## Headline" section is empty');
  }
  const cut = lines.join("\n");
  if (cut.length > PLAY_WHATS_NEW_MAX) {
    throw new Error(`playWhatsNew: the Play cut is ${cut.length} characters, over the ${PLAY_WHATS_NEW_MAX} limit`);
  }
  return cut;
}
