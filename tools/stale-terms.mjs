#!/usr/bin/env node
// tools/stale-terms.mjs
//
// Phase 48 (DOCS-01) standing tripwire — the ROADMAP Phase 48 criterion-1
// grep list ("every comment, doc page, CLAUDE.md row and test name
// describes the game as it is") as a reproducible table with an explicit
// allow-list of survivors instead of a hand-run grep re-typed at every
// phase close.
//
// What this scans: RAW lines of every scanned file — comments AND string
// literals are the subject here (a stale comment describing a retired
// pattern, or a describe()/test() title naming one, is exactly what this
// tool is built to catch), so unlike tools/ident-sweep.mjs this tool
// deliberately does NOT strip comments before matching.
//
// Survivor classes (see .planning/phases/48-*/48-CONTEXT.md's ground
// rules) — every line an ALLOWED entry excuses must fall into one of these:
//   A. a test that ASSERTS a retirement (e.g. `assert.equal(..., 0)`-style
//      pins and their titles)
//   B. prose that states a retirement by name and still helps a reader
//      ("was a toast; the rail owns feedback since Phase 35")
//   C. a tolerant-load legacy-key read and its pin (engine/saveState.js's
//      foldLegacyCounters, the parity harness's prototype-side strips, the
//      fold/save-validation test pins)
//   D. an inert legacy key inside a hand-built test-state literal
//      (`flightLeft: 0, flightCooldown: 0` / `won: false` in
//      `fixedState()`-style objects) — counted and listed, not edited,
//      until the dedicated fixture-hygiene commit removes them
//
// To add a survivor: append an `{ term, file, match, reason }` entry to
// ALLOWED below. `term` is a TERMS id; `file` is a repo-relative
// forward-slash path OR a directory prefix ending in `/` (matches every
// file under it); `match` is a regex SOURCE tested case-sensitively against
// the raw line; `reason` names the survivor class (A/B/C/D) and why. An
// entry that matches zero live lines is allow-list ROT — the tool fails
// loudly on it (see `## Allow-list rot` below) rather than silently
// accumulating dead entries.
//
// test/unit/stale-terms.test.js (Plan 05) pins this table to zero unlisted
// and the allow-list to zero rot — the phase's closing tripwire.
//
// Usage:
//   node tools/stale-terms.mjs [--paths p1 p2 ...] [--json] [--self-test]
//
// node:fs + node:path + node:url only — no packages.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const SURFACE_DIRS = ["src", "engine", "content", "tools", "test"];

const SELF_PATH = "tools/stale-terms.mjs";
const SELF_TEST_FILE_PATH = "test/unit/stale-terms.test.js";

// ---------------------------------------------------------------------
// TERMS — the criterion-1 grep list, one row per term, in table order.
// ---------------------------------------------------------------------

export const TERMS = Object.freeze(
  [
    { id: "dpad", regex: "d-pad|dpad", enforced: true, note: "the retired D-pad control scheme" },
    { id: "toast", regex: "toast", enforced: true, note: "the retired toast UI surface (rail/fight-log/Oracle replaced it)" },
    { id: "classic-engine", regex: "dead classic|classic engine", enforced: true, note: "the deleted classic-engine mirror (Phase 44)" },
    { id: "classic-script", regex: "classic script", enforced: false, note: "live term, CONTEXT judgment call 1 — reported for the record" },
    { id: "wornSlots", regex: "wornSlots", enforced: true, note: "the retired __mzWornSlots bridge / Phase 37 hedge option" },
    { id: "legacy-counters", regex: "flightLeft|flightCooldown|c\\.ether", enforced: true, note: "the pre-Phase-39 scattered item counters" },
    { id: "recentre", regex: "recent(er|re).*(every|each) step", enforced: true, note: "the retired per-step water re-narration rule" },
    { id: "round-card", regex: "round card|roundcard", enforced: true, note: "supplementary: the Phase 32 surface Phase 34 retired" },
    {
      id: "retired-bridges",
      regex: "__mz(ToHit|StrikeDie|ItemRowState|Abilities|Eff|SlotFor|WornSlots|Gear|WornKeysOf|SellPrice|RenderGrimoire|Bags)\\b",
      enforced: true,
      note: "supplementary: window.__mz* names Phases 47-02/03/04 deleted",
    },
    {
      id: "retired-files",
      regex:
        "toasts\\.js|toastsCoverage|toastTable\\.test|narrativeToasts\\.test|shell-toast-wiring|toastsForAction|tutorial\\.js|parley-button-mirror|round-card-worst-case",
      enforced: true,
      note: "supplementary: file names Phase 46 renamed/deleted, plus the test file Plan 03 renames",
    },
    { id: "legacy-won", regex: "won: false|state\\.won|winGame", enforced: false, note: "the 46-02 SUMMARY's inert won:false fixture-literal inventory — counted, test bodies untouched" },
  ].map((t) => Object.freeze(t)),
);

// ---------------------------------------------------------------------
// ALLOWED — seeded survivors this plan can already name (class C + D).
// Plans 02-05 append their own class A/B entries. Every entry below was
// verified against the live file before being added.
// ---------------------------------------------------------------------

export const ALLOWED = Object.freeze(
  [
    {
      term: "legacy-counters",
      file: "engine/saveState.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — foldLegacyCounters: the tolerant-load reads of the pre-Phase-39 counter keys and the doc comment that explains the fold",
    },
    {
      term: "legacy-counters",
      file: "test/parity/harness/comparables.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — the prototype-side strip of the legacy counters (the frozen master still sets them)",
    },
    {
      term: "legacy-counters",
      file: "test/parity/combat-parity.test.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — local comparable's prototype-side strip and its comment",
    },
    {
      term: "legacy-counters",
      file: "test/parity/magic-parity.test.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — local comparable's prototype-side strip and its comment",
    },
    {
      term: "legacy-counters",
      file: "test/parity/movement-parity.test.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — local comparable's prototype-side strip and its comment",
    },
    {
      term: "legacy-counters",
      file: "test/parity/full-suite.test.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — states the counters are removed entirely from the engine side",
    },
    {
      term: "legacy-counters",
      file: "test/unit/item-activation.test.js",
      match: "flightLeft|flightCooldown|c\\.ether",
      reason: "C — the foldLegacyCounters pin: its input MUST carry the legacy keys and its assertions prove they are deleted",
    },
    {
      term: "legacy-counters",
      file: "test/unit/",
      match: "flightLeft: 0, flightCooldown: 0",
      reason: "D — inert legacy keys in hand-built test-state literals (33 files at 649de2b); test bodies are out of DOCS-03's scope — counted, not edited",
    },
  ].map((a) => Object.freeze(a)),
);

// ---------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------

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

/**
 * defaultSources() — `[{ path, text }]` for mazeworld.html plus every
 * .js/.mjs/.cjs under src/, engine/, content/, tools/, test/ (recursive,
 * node_modules skipped), excluding this file and its own pinning test (they
 * spell the terms on purpose). .txt/.json/.md are never scanned by
 * construction (the prototype master and parity fixtures are out).
 */
export function defaultSources() {
  const files = [];
  const htmlPath = path.join(REPO_ROOT, "mazeworld.html");
  if (fs.existsSync(htmlPath)) files.push(htmlPath);
  for (const dir of SURFACE_DIRS) {
    const abs = path.join(REPO_ROOT, dir);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  return files
    .map((abs) => toRepoRelative(abs))
    .filter((rel) => rel !== SELF_PATH && rel !== SELF_TEST_FILE_PATH)
    .map((rel) => ({ path: rel, text: fs.readFileSync(path.join(REPO_ROOT, rel), "utf8") }));
}

// ---------------------------------------------------------------------
// Core scan
// ---------------------------------------------------------------------

function fileMatchesAllowEntry(file, allowFile) {
  return allowFile.endsWith("/") ? file.startsWith(allowFile) : file === allowFile;
}

/**
 * scan(sources, { terms, allowed }) — splits each source's text on
 * `/\r?\n/`; for every term and every line that matches (case-insensitive),
 * records a hit `{ term, file, line (1-based), text (trimmed), allowedBy }`.
 * A hit is allowed when some `allowed` entry shares its term, its `file`
 * equals the hit's path or is a `/`-terminated prefix of it, and its
 * `match` regex (case-sensitive) tests true on the RAW line.
 *
 * Returns `{ rows, hits, unusedAllow }`:
 *   - rows: one per term, `{ id, regex, enforced, total, allowed, unlisted }`
 *   - hits: every matched line, across every term
 *   - unusedAllow: every allowed entry that matched zero hits (rot)
 */
export function scan(sources, { terms = TERMS, allowed = ALLOWED } = {}) {
  const compiledTerms = terms.map((t) => ({ ...t, re: new RegExp(t.regex, "i") }));
  const compiledAllowed = allowed.map((a, idx) => ({ ...a, idx, re: new RegExp(a.match) }));

  const hits = [];
  const usedAllow = new Set();

  for (const { path: file, text } of sources) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const lineNo = i + 1;
      for (const term of compiledTerms) {
        if (!term.re.test(rawLine)) continue;
        let allowedBy = null;
        for (const a of compiledAllowed) {
          if (a.term !== term.id) continue;
          if (!fileMatchesAllowEntry(file, a.file)) continue;
          if (!a.re.test(rawLine)) continue;
          usedAllow.add(a.idx);
          if (allowedBy === null) allowedBy = a.idx;
        }
        hits.push({ term: term.id, file, line: lineNo, text: rawLine.trim(), allowedBy });
      }
    }
  }

  const rows = terms.map((t) => {
    const termHits = hits.filter((h) => h.term === t.id);
    const allowedCount = termHits.filter((h) => h.allowedBy !== null).length;
    return {
      id: t.id,
      regex: t.regex,
      enforced: t.enforced,
      total: termHits.length,
      allowed: allowedCount,
      unlisted: termHits.length - allowedCount,
    };
  });

  const unusedAllow = allowed.filter((_, idx) => !usedAllow.has(idx));

  return { rows, hits, unusedAllow };
}

/**
 * renderTable(rows) — a markdown table, one row per term, in TERMS order.
 */
export function renderTable(rows) {
  const header = "| Term | Regex | Hits | Allowed (listed) | Unlisted | Enforced |";
  const divider = "| --- | --- | --- | --- | --- | --- |";
  const body = rows.map(
    (r) => `| ${r.id} | \`${r.regex}\` | ${r.total} | ${r.allowed} | ${r.unlisted} | ${r.enforced ? "yes" : "no"} |`,
  );
  return [header, divider, ...body].join("\n");
}

// ---------------------------------------------------------------------
// --self-test — synthetic sources only, no disk reads.
// ---------------------------------------------------------------------

function selfTest() {
  const checks = [];

  // (a) unlisted toast hit when allowed is empty; (b) same line allowed
  // when a matching entry is passed.
  {
    const sources = [{ path: "x/a.js", text: "// the toast host renders cards\n" }];
    const { hits: hitsNoAllow } = scan(sources, { allowed: [] });
    const hitA = hitsNoAllow.find((h) => h.term === "toast");
    checks.push(["a", !!hitA && hitA.allowedBy === null]);

    const allowedList = [{ term: "toast", file: "x/a.js", match: "host", reason: "test" }];
    const { hits: hitsAllowed } = scan(sources, { allowed: allowedList });
    const hitB = hitsAllowed.find((h) => h.term === "toast");
    checks.push(["b", !!hitB && hitB.allowedBy === 0]);
  }

  // (c) directory-prefix entry allows a hit in a nested file.
  {
    const sources = [{ path: "x/sub/b.js", text: "// toast surface here\n" }];
    const allowedList = [{ term: "toast", file: "x/", match: "surface", reason: "test" }];
    const { hits } = scan(sources, { allowed: allowedList });
    const hit = hits.find((h) => h.term === "toast");
    checks.push(["c", !!hit && hit.allowedBy === 0]);
  }

  // (d) classic-script lands on its own row, unenforced.
  {
    const sources = [{ path: "x/c.js", text: "// the classic script owns paint()\n" }];
    const { rows } = scan(sources, { allowed: [] });
    const row = rows.find((r) => r.id === "classic-script");
    checks.push(["d", !!row && row.enforced === false && row.total === 1]);
  }

  // (e) an allowed entry matching nothing lands in unusedAllow.
  {
    const sources = [{ path: "x/d.js", text: "// nothing interesting here\n" }];
    const allowedList = [{ term: "toast", file: "x/d.js", match: "zzz-nomatch", reason: "test" }];
    const { unusedAllow } = scan(sources, { allowed: allowedList });
    checks.push(["e", unusedAllow.length === 1 && unusedAllow[0].match === "zzz-nomatch"]);
  }

  // (f) a CRLF source yields line numbers 1 and 2, not one line.
  {
    const sources = [{ path: "x/e.js", text: "// toast a\r\n// toast b\r\n" }];
    const { hits } = scan(sources, { allowed: [] });
    const toastHits = hits.filter((h) => h.term === "toast");
    checks.push(["f", toastHits.length === 2 && toastHits[0].line === 1 && toastHits[1].line === 2]);
  }

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length === 0) {
    console.log("self-test: PASS");
    return 0;
  }
  console.log("self-test: FAIL");
  for (const [name] of failed) {
    console.log(`  expected check "${name}" to pass, but it did not`);
  }
  return 1;
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

function fileUnderPrefix(file, prefix) {
  return file === prefix || file.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

function parseArgs(argv) {
  const paths = [];
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      json = true;
    } else if (a === "--paths") {
      i++;
      while (i < argv.length && !argv[i].startsWith("--")) {
        paths.push(argv[i]);
        i++;
      }
      i--;
    }
  }
  return { paths, json };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    process.exit(selfTest());
  }

  const { paths, json } = parseArgs(argv);

  let sources = defaultSources();
  let allowed = ALLOWED;
  if (paths.length > 0) {
    sources = sources.filter((s) => paths.some((p) => fileUnderPrefix(s.path, p)));
    // Rot is judged only against entries whose file falls inside the given paths.
    allowed = ALLOWED.filter((a) => paths.some((p) => fileUnderPrefix(a.file, p)));
  }

  const { rows, hits, unusedAllow } = scan(sources, { allowed });
  const hasUnlisted = rows.some((r) => r.enforced && r.unlisted > 0);
  const hasRot = unusedAllow.length > 0;
  const exitCode = hasUnlisted || hasRot ? 1 : 0;

  if (json) {
    console.log(JSON.stringify({ rows, hits, unusedAllow }));
    process.exit(exitCode);
  }

  const termById = Object.fromEntries(TERMS.map((t) => [t.id, t]));

  console.log(renderTable(rows));
  console.log("");
  console.log("## Unlisted");
  const unlistedHits = hits.filter((h) => h.allowedBy === null && termById[h.term] && termById[h.term].enforced);
  if (unlistedHits.length === 0) {
    console.log("(none)");
  } else {
    for (const h of unlistedHits) console.log(`${h.file}:${h.line}: ${h.text}`);
  }
  console.log("");
  console.log("## Allowed survivors");
  const byReason = new Map();
  for (const h of hits) {
    if (h.allowedBy === null) continue;
    const entry = allowed[h.allowedBy];
    const key = entry.reason;
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key).push(h);
  }
  if (byReason.size === 0) {
    console.log("(none)");
  } else {
    for (const [reason, hs] of byReason) {
      console.log(`### ${reason}`);
      for (const h of hs) console.log(`${h.file}:${h.line}: ${h.text}`);
    }
  }
  console.log("");
  console.log("## Allow-list rot");
  if (unusedAllow.length === 0) {
    console.log("(none)");
  } else {
    for (const a of unusedAllow) console.log(`${a.term} / ${a.file} / ${a.match} — ${a.reason}`);
  }

  process.exit(exitCode);
}

// Direct-invocation guard — mirrors tools/ident-sweep.mjs's pattern.
if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  main();
}
