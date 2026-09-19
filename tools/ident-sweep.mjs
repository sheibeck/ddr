#!/usr/bin/env node
// tools/ident-sweep.mjs
//
// Phase 46 (NAME-02) gate — a comment-stripped identifier grep over the
// shipped surface (src/, engine/, content/, tools/, mazeworld.html). Unlike
// a plain `grep`, this tool strips // and /* */ comments (and HTML <!-- -->
// comments) before matching, so retired-identifier prose left behind on
// purpose in Phase 48's docs/comments sweep does not drown a real straggler
// grep in false positives. String literals are KEPT (a retired option value
// like "dpad" can still live inside a string) — only comments are removed.
//
// Usage:
//   node tools/ident-sweep.mjs [-i] <regex> [<regex> ...]
//   node tools/ident-sweep.mjs --self-test
//
// Regex arguments are JavaScript regex SOURCES (no delimiters), matched
// case-sensitively unless -i is given (applies to every regex in the run).
//
// Surface: every .js/.mjs/.cjs file under src/, engine/, content/, tools/
// (recursive, node_modules skipped) plus mazeworld.html at the repo root.
// Paths are printed relative to the repo root with forward slashes.
//
// Output: for each regex, every stripped line that matches prints
// `file:line: <original line trimmed>`, then a summary line
// `ident-sweep <regex>: <n>`. Exit 1 if any n > 0 across any regex, else 0.
//
// Pitfall this tool is built to avoid (documented in
// test/unit/shell-narration-wiring.test.js and
// test/unit/narrationLinesCoverage.test.js): a naive stripper that strips
// /* block */ comments as a SEPARATE pass BEFORE // line comments can
// misread a `//` comment that happens to contain a `/*`-looking substring
// (e.g. a mention of `@capacitor/*`) as an unterminated block-comment
// opener, silently swallowing real code that follows. This tool instead
// runs ONE combined single-pass state machine (see stripJs's own doc
// comment) that is structurally immune to that failure mode AND to the
// related failure mode of a two-pass design (a JSDoc block comment quoting
// example text like `"Thief +5"` corrupting a separately-tracked, file-wide
// string state) — both proven by --self-test below.
//
// node:fs + node:path only — no packages.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const SURFACE_DIRS = ["src", "engine", "content", "tools"];

// ---------------------------------------------------------------------
// Stripping — line-count-preserving so reported line numbers match the
// original file. Stripped characters become spaces; newlines are kept.
// ---------------------------------------------------------------------

/**
 * stripJs(src) — a SINGLE-PASS state machine over `code | line-comment |
 * block-comment | squote | dquote | backtick`, blanking comments while
 * keeping string content (including template-literal `${...}` bodies,
 * treated as string text per the module's stripping contract). One combined
 * pass — not two sequential ones — is deliberate: it is immune to BOTH
 * failure modes a naive stripper can hit —
 *
 *   1. The @capacitor/* pitfall: while inside a `//` line comment, this
 *      state machine never looks for `/*` at all (it only watches for the
 *      newline that ends the comment), so a line comment that happens to
 *      contain `/*`-looking text can never be misread as a block-comment
 *      opener that swallows the next line's real code.
 *   2. The quoted-punctuation pitfall: while inside a `/* *\/` block
 *      comment, this state machine never tracks quote characters at all
 *      (it only watches for the `*​/` that ends the comment), so a JSDoc
 *      comment containing a quoted example string (e.g. `"Thief +5"`)
 *      can never be misread as opening a real string literal and
 *      corrupting the string-tracking state for the rest of the file — the
 *      failure mode a two-pass "strip // first, then strip /* *\/" design
 *      hits, since the line-comment pass has no notion of block comments
 *      and tracks quotes globally across the whole file regardless.
 *
 * A `//` or `/*` inside a real string is likewise never mistaken for a
 * comment opener, since quote-state is checked before comment-state.
 */
function stripJs(src) {
  let out = "";
  let state = "code"; // code | line | block | squote | dquote | backtick
  const n = src.length;
  for (let i = 0; i < n; i++) {
    const c = src[i];
    const c2 = src[i + 1];

    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      } else {
        out += " ";
      }
      continue;
    }

    if (state === "block") {
      if (c === "*" && c2 === "/") {
        out += "  ";
        i++;
        state = "code";
      } else {
        out += c === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "squote" || state === "dquote" || state === "backtick") {
      const quote = state === "squote" ? "'" : state === "dquote" ? '"' : "`";
      if (c === "\\" && i + 1 < n) {
        out += c;
        out += src[i + 1];
        i++;
        continue;
      }
      if (c === quote) {
        state = "code";
      }
      out += c;
      continue;
    }

    // state === "code"
    if (c === "/" && c2 === "/") {
      out += "  ";
      i++;
      state = "line";
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i++;
      state = "block";
      continue;
    }
    if (c === "'") {
      state = "squote";
      out += c;
      continue;
    }
    if (c === '"') {
      state = "dquote";
      out += c;
      continue;
    }
    if (c === "`") {
      state = "backtick";
      out += c;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * stripHtmlComments(src) — blanks `<!-- ... -->` interiors, keeping
 * newlines. No string-tracking needed: HTML comments do not nest and are
 * not string-delimited.
 */
function stripHtmlComments(src) {
  let out = "";
  const n = src.length;
  for (let i = 0; i < n; i++) {
    if (src[i] === "<" && src.slice(i, i + 4) === "<!--") {
      out += "    ";
      i += 4;
      while (i < n && src.slice(i, i + 3) !== "-->") {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "   ";
        i += 2; // land on the last "-"; outer loop's i++ clears it
      } else {
        i--;
      }
      continue;
    }
    out += src[i];
  }
  return out;
}

/**
 * stripHtml(src) — mazeworld.html's stripper: HTML comments first (so a
 * `//`/`/* *\/` inside commented-out markup never leaks), then the JS
 * stripper over the whole file — this also strips the `<style>` block's CSS
 * `/* *\/` comments and the `<script>` blocks' `//`/`/* *\/` comments in one
 * pass, since the line-comments-first order already protects the
 * `@capacitor/*` pitfall regardless of surrounding markup.
 */
function stripHtml(src) {
  return stripJs(stripHtmlComments(src));
}

// ---------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------

function collectFiles() {
  const files = [];
  for (const dir of SURFACE_DIRS) {
    const abs = path.join(REPO_ROOT, dir);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  const htmlPath = path.join(REPO_ROOT, "mazeworld.html");
  if (fs.existsSync(htmlPath)) files.push(htmlPath);
  return files;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (entry.isFile() && JS_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(abs);
    }
  }
}

function toRepoRelative(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

// ---------------------------------------------------------------------
// Core scan — reusable by both the CLI sweep and --self-test.
// ---------------------------------------------------------------------

/**
 * scanEntry(relPath, content, regexes) — strips `content` per its kind
 * (mazeworld.html vs a .js/.mjs/.cjs file), then tests every regex against
 * each stripped line. Returns a Map<regexSource, Array<{file, line, text}>>
 * (`text` is the ORIGINAL line, trimmed — never the stripped line).
 */
function scanEntry(relPath, content, regexes) {
  const stripped = relPath.endsWith(".html") ? stripHtml(content) : stripJs(content);
  const originalLines = content.split("\n");
  const strippedLines = stripped.split("\n");
  const hits = new Map(regexes.map((r) => [r.source + "|" + r.flags, []]));
  for (let i = 0; i < strippedLines.length; i++) {
    for (const re of regexes) {
      re.lastIndex = 0;
      if (re.test(strippedLines[i])) {
        hits.get(re.source + "|" + re.flags).push({
          file: relPath,
          line: i + 1,
          text: (originalLines[i] || "").trim(),
        });
      }
    }
  }
  return hits;
}

function sweep(regexSources, ignoreCase) {
  const files = collectFiles();
  const flags = ignoreCase ? "i" : "";
  const regexes = regexSources.map((src) => new RegExp(src, flags));
  const totals = new Map(regexSources.map((s) => [s, []]));

  for (const abs of files) {
    const rel = toRepoRelative(abs);
    const content = fs.readFileSync(abs, "utf8");
    const hits = scanEntry(rel, content, regexes);
    for (const src of regexSources) {
      const re = new RegExp(src, flags); // rebuilt for a stable key (avoids relying on object identity)
      const key = re.source + "|" + re.flags;
      totals.get(src).push(...hits.get(key));
    }
  }

  let anyHits = false;
  for (const src of regexSources) {
    const hitList = totals.get(src);
    for (const h of hitList) {
      console.log(`${h.file}:${h.line}: ${h.text}`);
    }
    console.log(`ident-sweep ${src}: ${hitList.length}`);
    if (hitList.length > 0) anyHits = true;
  }
  return anyHits ? 1 : 0;
}

// ---------------------------------------------------------------------
// --self-test — proves the stripper's teeth: a line comment, a two-line
// block comment, and the @capacitor/* pitfall are never reported; a live
// code line, a string literal, and a real trailing-comment case are handled
// correctly; an HTML comment, a CSS comment and a script line are handled
// correctly too.
// ---------------------------------------------------------------------

function selfTest() {
  const JS_SAMPLE = [
    "// needle_a inside a line comment",
    "/* needle_b block comment",
    "   still inside the block comment */",
    "// pitfall guard: @capacitor/* looks like a block-comment opener but isn't",
    "const needle_c = 3;",
    "const needle_d = 1;",
    'const someVar = "needle_e";',
    'const url = "http://example.com"; // needle_f trailing comment',
  ].join("\n");

  const HTML_SAMPLE = [
    "<!-- needle_htmlc inside an HTML comment -->",
    "<style>",
    "/* needle_css inside a CSS comment */",
    "</style>",
    "<script>",
    "const needle_script = 2;",
    "</script>",
  ].join("\n");

  const regexes = [/needle/];
  const jsHits = scanEntry("sample.js", JS_SAMPLE, regexes).get("needle|");
  const htmlHits = scanEntry("sample.html", HTML_SAMPLE, regexes).get("needle|");
  const actual = [...jsHits, ...htmlHits].map((h) => h.text).sort();

  const expected = [
    "const needle_c = 3;",
    "const needle_d = 1;",
    'const someVar = "needle_e";',
    "const needle_script = 2;",
  ].sort();

  const match = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  if (match) {
    console.log("self-test: PASS");
    return 0;
  }
  console.log("self-test: FAIL");
  console.log("expected:", JSON.stringify(expected));
  console.log("actual:  ", JSON.stringify(actual));
  return 1;
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    process.exit(selfTest());
  }
  const ignoreCase = argv.includes("-i");
  const regexSources = argv.filter((a) => a !== "-i");
  if (regexSources.length === 0) {
    console.error("usage: node tools/ident-sweep.mjs [-i] <regex> [<regex> ...]");
    console.error("       node tools/ident-sweep.mjs --self-test");
    process.exit(2);
  }
  process.exit(sweep(regexSources, ignoreCase));
}

main();
