// test/unit/roll-ledger-sync.test.js
//
// Phase 72-07 (ROLL-01) — a standing guard that keeps docs/ROLL-LEDGER.md's
// `## Modifier ledger` table and the two odds-based direction test files
// (test/unit/rollDirection.test.js, test/unit/rollDirection-checks.test.js)
// in lockstep, so Phase 73's roll-high mirror inherits a ledger and an odds
// contract that already agree, with zero pending rows.
//
// Three checks, reading only the two direction files and this ledger:
//   (1) every `[site:source]` id in the ledger's Modifier ledger table whose
//       Verdict cell does NOT start with `N/A` must appear as a bracketed
//       title prefix in one of the two direction test files. Any id this
//       fails for is either a gap this test file must close with a new
//       direction row (per its own action's mirror-proof rules), or the
//       ledger row itself must be marked `N/A (no mirror-proof probe:
//       <reason>)` — this guard is never loosened by deleting the ledger
//       row instead.
//   (2) every bracketed id at the start of a `test(` title in either
//       direction file, except a `[harness:...]` self-test id (the shared
//       odds harness's own vacuous-probe guard, not a ledger modifier),
//       must appear in the ledger's Modifier ledger table.
//   (3) neither direction test file keeps a node:test `todo` option
//       anywhere — every row in both files must be live and green. Phase 73
//       must be able to run both files UNCHANGED and keep this guard green
//       without editing either direction test file's body.
//
// This file itself is scoped to reading test/unit/rollDirection.test.js and
// test/unit/rollDirection-checks.test.js only, so its own source (which
// necessarily contains the word "todo" in prose) never self-trips check (3).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const LEDGER_PATH = path.join(REPO_ROOT, "docs", "ROLL-LEDGER.md");
const DIRECTION_FILES = [
  path.join(__dirname, "rollDirection.test.js"),
  path.join(__dirname, "rollDirection-checks.test.js"),
];

// Normalise CRLF to LF before matching — docs/ROLL-LEDGER.md is CRLF
// (core.autocrlf=true) and is never rewritten by this test.
const readNormalized = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

/**
 * ledgerModifierIds() — parses docs/ROLL-LEDGER.md's `## Modifier ledger`
 * section (sliced from that heading up to the NEXT `## ` heading, so later
 * sections like `## Known fixes` never leak in). Returns the set of
 * bracketed ids whose row's Verdict cell (the table's last `|`-delimited
 * column) does NOT start with `N/A` — an `N/A` row is a declared "no
 * mirror-proof probe exists" case and is exempt from check (1).
 */
function ledgerModifierIds() {
  const lines = readNormalized(LEDGER_PATH).split("\n");
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && lines[i].startsWith("## Modifier ledger")) {
      start = i;
    } else if (start >= 0 && end < 0 && i > start && lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  assert.ok(start >= 0, "docs/ROLL-LEDGER.md must contain a '## Modifier ledger' heading");
  if (end < 0) end = lines.length;

  const ids = new Set();
  for (const line of lines.slice(start, end)) {
    const idMatch = line.match(/^\|\s*`\[([a-z0-9:_-]+)]`\s*\|/i);
    if (!idMatch) continue;
    const cells = line.split("|");
    const verdict = (cells[cells.length - 2] || "").trim(); // last real cell (row ends with a trailing "|")
    if (/^\*{0,2}N\/A/.test(verdict)) continue; // declared no-mirror-proof-probe row — exempt
    ids.add(idMatch[1]);
  }
  return ids;
}

/**
 * directionTestIds() — parses both direction test files for every
 * bracketed id at the START of a `test(` call's title string, skipping any
 * `harness:*` id (the shared odds harness's own self-test, not a ledger
 * modifier). Returns `{ ids: Set<string>, todoHits: string[] }` — todoHits
 * lists which files (if any) still carry node:test's `todo` option.
 */
function directionTestIds() {
  const ids = new Set();
  const todoHits = [];
  const idPattern = /test\(\s*[`'"]\[([a-z0-9:_-]+)]/gi;
  // Mirrors the plan's own acceptance grep exactly: `{\s*todo` or `todo:`.
  const todoPattern = /\{\s*todo|todo:/;
  for (const file of DIRECTION_FILES) {
    const src = fs.readFileSync(file, "utf8");
    let m;
    while ((m = idPattern.exec(src))) {
      const id = m[1];
      if (id.startsWith("harness:")) continue;
      ids.add(id);
    }
    if (todoPattern.test(src)) todoHits.push(path.basename(file));
  }
  return { ids, todoHits };
}

test("roll-ledger-sync: every non-N/A ledger modifier id has a matching direction-test row", () => {
  const ledgerIds = ledgerModifierIds();
  const { ids: testIds } = directionTestIds();
  const missing = [...ledgerIds].filter((id) => !testIds.has(id)).sort();
  assert.deepStrictEqual(missing, [], `docs/ROLL-LEDGER.md ids with no direction-test row: ${missing.join(", ")}`);
});

test("roll-ledger-sync: every direction-test id (except harness:*) has a matching ledger row", () => {
  const ledgerIds = ledgerModifierIds();
  const { ids: testIds } = directionTestIds();
  const extra = [...testIds].filter((id) => !ledgerIds.has(id)).sort();
  assert.deepStrictEqual(extra, [], `direction-test ids with no docs/ROLL-LEDGER.md row: ${extra.join(", ")}`);
});

test("roll-ledger-sync: neither direction test file keeps a node:test todo option", () => {
  const { todoHits } = directionTestIds();
  assert.deepStrictEqual(todoHits, [], `pending (todo) rows remain in: ${todoHits.join(", ")}`);
});
