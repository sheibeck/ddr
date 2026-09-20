#!/usr/bin/env node
// tools/comment-only-diff.mjs
//
// Phase 48 criterion 4's proof — the engine-gate fence says engine/,
// content/ and test/parity/fixtures/ may change on COMMENT LINES ONLY. This
// tool strips comments on BOTH sides of every changed .js/.mjs/.cjs/.html
// file under the given prefixes (reusing tools/ident-sweep.mjs's own
// stripJs/stripHtml, so "comment" means the same thing everywhere) and
// reports whether the stripped text is identical.
//
// The comparison is deliberately whitespace-insensitive (every run of
// whitespace collapses to one space, both sides trimmed, CRLF normalized to
// LF first): deleting a whole comment line removes a line of text, which
// must NOT count as a code change. `npm test` and the parity suite remain
// the behavioural proof this tool does not attempt to replace.
//
// Usage:
//   node tools/comment-only-diff.mjs <base-ref> [path-prefix ...]
//   (default prefixes when none given: engine content test/parity/fixtures)
//
// For each changed file (via `git diff --name-status <base-ref> --
// <prefixes>`):
//   - status D (deleted)                    -> `DELETED: <file>` (failure)
//   - extension not .js/.mjs/.cjs/.html      -> `NON-CODE FILE CHANGED: <file>` (failure)
//   - otherwise: strip both `git show <base-ref>:<file>` and the working
//     tree file, normalize, compare -> `comment-only: <file>` or
//     `CODE CHANGED: <file>` (with a 120-char window around the first
//     differing index on each side)
//
// Final line: `comment-only-diff <base-ref>: <n changed>, <k code-changed>`
// (or `comment-only-diff <base-ref>: 0 changed` when nothing changed at
// all). Exit 1 if any failure, else 0.
//
// node:fs + node:path + node:url + node:child_process only — no packages.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import { stripJs, stripHtml } from "./ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".html"]);
const DEFAULT_PREFIXES = ["engine", "content", "test/parity/fixtures"];

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function stripByExtension(relPath, text) {
  return relPath.endsWith(".html") ? stripHtml(text) : stripJs(text);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  return result;
}

function nameStatus(baseRef, prefixes) {
  const result = git(["diff", "--name-status", baseRef, "--", ...prefixes]);
  if (result.status !== 0) {
    throw new Error(`git diff --name-status failed: ${result.stderr || result.stdout}`);
  }
  const out = (result.stdout || "").trim();
  if (out === "") return [];
  return out.split("\n").map((line) => {
    const [status, ...rest] = line.split("\t");
    return { status: status[0], file: rest.join("\t") };
  });
}

function readAtRef(baseRef, file) {
  const result = git(["show", `${baseRef}:${file}`]);
  if (result.status !== 0) {
    throw new Error(`git show ${baseRef}:${file} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function firstDiffWindow(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  const start = Math.max(0, i - 20);
  return {
    before: a.slice(start, start + 120),
    after: b.slice(start, start + 120),
  };
}

function run(baseRef, prefixes) {
  const entries = nameStatus(baseRef, prefixes);

  if (entries.length === 0) {
    console.log(`comment-only-diff ${baseRef}: 0 changed`);
    return 0;
  }

  let failures = 0;
  let codeChanged = 0;

  for (const { status, file } of entries) {
    if (status === "D") {
      console.log(`DELETED: ${file}`);
      failures++;
      continue;
    }
    const ext = path.extname(file);
    if (!CODE_EXTENSIONS.has(ext)) {
      console.log(`NON-CODE FILE CHANGED: ${file}`);
      failures++;
      continue;
    }

    const before = readAtRef(baseRef, file);
    const after = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");

    const strippedBefore = normalize(stripByExtension(file, before));
    const strippedAfter = normalize(stripByExtension(file, after));

    if (strippedBefore === strippedAfter) {
      console.log(`comment-only: ${file}`);
    } else {
      console.log(`CODE CHANGED: ${file}`);
      const { before: windowBefore, after: windowAfter } = firstDiffWindow(strippedBefore, strippedAfter);
      console.log(`  before: ${windowBefore}`);
      console.log(`  after:  ${windowAfter}`);
      codeChanged++;
      failures++;
    }
  }

  console.log(`comment-only-diff ${baseRef}: ${entries.length} changed, ${codeChanged} code-changed`);
  return failures > 0 ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error("usage: node tools/comment-only-diff.mjs <base-ref> [path-prefix ...]");
    process.exit(2);
  }
  const [baseRef, ...rest] = argv;
  const prefixes = rest.length > 0 ? rest : DEFAULT_PREFIXES;
  process.exit(run(baseRef, prefixes));
}

// Direct-invocation guard — mirrors tools/ident-sweep.mjs's pattern.
if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  main();
}
