// test/unit/flee-ledger.test.js
//
// Phase 42 (FLEE-01/FLEE-02) — the standing guard for docs/FLEE.md: proves
// its Modifier table and Before/after table can never drift from
// content/flee.js's actual constants, and that its six required H2
// headings exist in order. Mirrors test/unit/class-pass-ledger.test.js's
// doc-parsing helpers (h2s/section).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { FLEE_NEED, FLEE_THIEF_BONUS, FLEE_CLASS_MOD, FLEE_RACE_MOD, RACES, CLASSES } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const DOC_PATH = path.join(REPO_ROOT, "docs", "FLEE.md");
const doc = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // CRLF-tolerant: core.autocrlf checkouts

/** h2s(text) -> the list of `## ` heading lines, in document order. */
function h2s(text) {
  return [...text.matchAll(/^## .+$/gm)].map((m) => m[0]);
}

/** section(text, headingRegex) -> the text from the matching heading line
 * through (but not including) the next `## ` heading, or EOF. */
function section(text, headingRegex) {
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error(`section: no heading matches ${headingRegex}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

test("sections: the eight required H2 headings exist, in order", () => {
  const headings = h2s(doc);
  const expected = [
    /^## Canon change \(Phase 42, FLEE-01\)$/,
    /^## Modifier table$/,
    /^## Before \/ after$/,
    /^## What did not change$/,
    /^## Event payload and narration \(FLEE-02\)$/,
    /^## Parity fixture reading$/,
    /^## Tests$/,
    /^## Requirements map$/,
  ];
  assert.ok(headings.length >= expected.length, `expected at least ${expected.length} headings, found ${headings.length}`);
  expected.forEach((re, i) => {
    assert.match(headings[i], re, `heading ${i} mismatch: got "${headings[i]}"`);
  });
});

// --- Modifier table never drifts from content/flee.js -----------------------

/** Parses `| Name | +N | ... |` / `| Name | -N | ... |` rows from a markdown
 * table section into a { name -> number } map (sign-aware). */
function parseModifierRows(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*([A-Za-z ]+?)\s*(?:\([^)]*\))?\s*\|\s*([+−-]?\d+)\s*\|/);
    if (!m) continue;
    out[m[1].trim()] = Number(m[2].replace("−", "-"));
  }
  return out;
}

test("Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value; the Thief flee bonus is separate", () => {
  const modSection = section(doc, /^## Modifier table$/);
  const parsed = parseModifierRows(modSection);
  for (const key of Object.keys(RACES)) {
    assert.equal(parsed[key], FLEE_RACE_MOD[key], `race ${key}`);
  }
  for (const key of Object.keys(CLASSES)) {
    assert.equal(parsed[key], FLEE_CLASS_MOD[key], `class ${key}`);
  }
  assert.equal(parsed["Thief flee bonus"], FLEE_THIEF_BONUS, "the Thief +5 row is present and correct, and distinct from the Thief class modifier");
});

// --- Before/after table never drifts from FLEE_NEED/FLEE_THIEF_BONUS -------

function parseBeforeAfterRows(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/);
    if (!m) continue;
    if (m[1] === "Character") continue; // header row
    rows.push({ character: m[1], oldNeed: Number(m[2]), oldPct: Number(m[3]), newNeed: Number(m[4]), newPct: Number(m[5]) });
  }
  return rows;
}

test("Before/after table: the Human Fighter no-armor row's New need is FLEE_NEED; the Thief Leather row's is FLEE_NEED - FLEE_THIEF_BONUS", () => {
  const baSection = section(doc, /^## Before \/ after$/);
  const rows = parseBeforeAfterRows(baSection);
  assert.ok(rows.length >= 8, `expected at least 8 rows, found ${rows.length}`);

  const noArmor = rows.find((r) => /Human Fighter, no armor/.test(r.character));
  assert.ok(noArmor, "Human Fighter no-armor row must exist");
  assert.equal(noArmor.newNeed, FLEE_NEED);

  const thiefLeather = rows.find((r) => /Human Thief, Leather/.test(r.character));
  assert.ok(thiefLeather, "Human Thief Leather row must exist");
  assert.equal(thiefLeather.newNeed, FLEE_NEED - FLEE_THIEF_BONUS);
});

test("Before/after table: every row's Old %/New % equals Math.round((21 - need) / 20 * 100)", () => {
  const baSection = section(doc, /^## Before \/ after$/);
  const rows = parseBeforeAfterRows(baSection);
  for (const r of rows) {
    assert.equal(r.oldPct, Math.round(((21 - r.oldNeed) / 20) * 100), `${r.character} old %`);
    assert.equal(r.newPct, Math.round(((21 - r.newNeed) / 20) * 100), `${r.character} new %`);
  }
});

test("the ledger mentions fleeRolled and cross-links docs/CLASS-PASS.md", () => {
  assert.ok(doc.includes("fleeRolled"));
  assert.ok(doc.includes("docs/CLASS-PASS.md"));
});
