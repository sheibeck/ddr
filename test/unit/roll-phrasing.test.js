// test/unit/roll-phrasing.test.js
//
// Phase 79 (ROLL-04), plan 79-12 — the doc-synced guard ROADMAP Phase 79
// criterion 2 asks for: no player-facing string encodes roll-under
// phrasing, and a test pins that none remains.
//
// 79-CONTEXT (user accepted 2026-09-25): "A DOC-SYNCED TEST scans every
// player-facing string (content txt/note, EVENT_NARRATION templates, line
// banks, panel copy) for roll-under patterns ('1–N' as a to-hit range,
// 'need N', 'natural 1', 'N or under/less', '−N on to-hit') and fails on
// any."
//
// What it reads:
//   - the live narration corpus (tools/lib/voice-corpus.mjs#buildCorpus):
//     every Oracle and rail builder rendered through the synthetic events,
//     every registered copy bank, every content text field and the raw
//     literal sweep of src/browser, engine and mazeworld.html — the same
//     corpus every Phase 79 rewrite plan drove to zero, so the guard sees
//     exactly what the player sees;
//   - the patterns and exceptions in tools/lib/voice-checks.mjs;
//   - docs/ROLL-LEDGER.md's `## Phase 79 roll phrasing closure (ROLL-04)`
//     section (CRLF normalised, sliced up to the next `## ` heading, the
//     test/unit/roll-ledger-sync.test.js precedent).
//
// It fails when:
//   - any corpus string trips a pattern outside the exceptions list;
//   - an exception no longer matches a live string (rot);
//   - a pattern stops catching its violation fixtures or starts catching
//     its clean ones (every dash variant, number word and case);
//   - the doc's pattern ids or exceptions differ from the code's, or a doc
//     example does not trip its own pattern;
//   - the corpus shrinks below its per-surface floors (an empty corpus
//     never reads as clean);
//   - the closure list stops naming a handoff, or names one without the
//     plan that closed it.
//
// This file quotes no roll-under phrase itself: every violation it tests
// comes from the patterns' own fixtures or from the ledger's examples
// (tools/stale-terms.mjs's roll-under term scans .js files, never .md).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";
import {
  ROLL_UNDER_PATTERNS,
  ROLL_PHRASING_EXCEPTIONS,
  ROLL_HIGH_CLEAN,
  fixtureVariants,
  scanRollUnder,
} from "../../tools/lib/voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LEDGER_PATH = path.join(REPO_ROOT, "docs", "ROLL-LEDGER.md");
const HEADING = "## Phase 79 roll phrasing closure (ROLL-04)";

const corpus = await buildCorpus();

// ─── The ledger section ──────────────────────────────────────────────────

const readNormalized = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

/** section() — the lines of the Phase 79 closure section, heading to the next `## `. */
function section() {
  const lines = readNormalized(LEDGER_PATH).split("\n");
  const starts = lines.flatMap((l, i) => (l === HEADING ? [i] : []));
  assert.equal(starts.length, 1, `docs/ROLL-LEDGER.md must hold exactly one "${HEADING}" heading`);
  const start = starts[0];
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start, end);
}

/** subsection(lines, title) — the lines under `### <title>` up to the next `### `. */
function subsection(lines, title) {
  const start = lines.findIndex((l) => l === `### ${title}`);
  assert.ok(start >= 0, `the closure section must hold a "### ${title}" subsection`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("### "));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end);
}

/** tableRows(lines) — the body rows of the first markdown table, as trimmed cells. */
function tableRows(lines) {
  const rows = lines.filter((l) => l.startsWith("|"));
  // rows[0] is the header, rows[1] the divider.
  return rows.slice(2).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

const unquote = (cell) => {
  const m = cell.match(/^`(.*)`$/) || cell.match(/^"(.*)"$/);
  return m ? m[1] : cell;
};

const LEDGER = section();
const DOC_PATTERNS = tableRows(subsection(LEDGER, "Patterns")).map(([id, catches, example, shape]) => ({
  id: unquote(id),
  catches,
  example: unquote(example),
  shape,
}));
const DOC_EXCEPTIONS = tableRows(subsection(LEDGER, "Exceptions"))
  .filter((cells) => cells[0] !== "*(none)*")
  .map(([key, match, reason]) => ({ key: unquote(key), match: unquote(match), reason }));
const DOC_CLOSURES = tableRows(subsection(LEDGER, "Closure list")).map(([item, source, closedBy, how]) => ({ item, source, closedBy, how }));

const compile = (p) => new RegExp(p.source, p.flags);

// ─── Doc sync ────────────────────────────────────────────────────────────

test("doc sync: the ledger's pattern ids are the code's ROLL_UNDER_PATTERNS ids, in order", () => {
  assert.deepEqual(
    DOC_PATTERNS.map((p) => p.id),
    ROLL_UNDER_PATTERNS.map((p) => p.id),
    "docs/ROLL-LEDGER.md's Phase 79 Patterns table and tools/lib/voice-checks.mjs#ROLL_UNDER_PATTERNS must list the same ids",
  );
  for (const p of DOC_PATTERNS) {
    assert.ok(p.catches.length > 0, `${p.id}: the doc must say what it catches`);
    assert.ok(p.shape.length > 0, `${p.id}: the doc must give the roll-high replacement shape`);
  }
});

test("doc sync: every doc violation example trips its own pattern", () => {
  const byId = new Map(ROLL_UNDER_PATTERNS.map((p) => [p.id, p]));
  for (const d of DOC_PATTERNS) {
    const p = byId.get(d.id);
    assert.ok(p, `unknown pattern id ${d.id}`);
    assert.ok(d.example.length > 0, `${d.id}: the doc must give a violation example`);
    for (const x of fixtureVariants(d.example)) {
      assert.ok(compile(p).test(x), `${d.id}: the doc example ${JSON.stringify(x)} does not trip its own pattern`);
    }
  }
});

test("doc sync: the ledger's exceptions are the code's ROLL_PHRASING_EXCEPTIONS (key and phrase)", () => {
  assert.deepEqual(
    DOC_EXCEPTIONS.map((x) => ({ key: x.key, match: x.match })),
    ROLL_PHRASING_EXCEPTIONS.map((x) => ({ key: x.key, match: x.match })),
    "docs/ROLL-LEDGER.md's Phase 79 Exceptions table and tools/lib/voice-checks.mjs#ROLL_PHRASING_EXCEPTIONS must agree",
  );
  for (const x of [...DOC_EXCEPTIONS, ...ROLL_PHRASING_EXCEPTIONS]) {
    assert.ok(String(x.reason ?? "").trim().length > 0, `${x.key}: an exception needs a reason`);
  }
});

// ─── Teeth ───────────────────────────────────────────────────────────────

test("teeth: every pattern trips every variant of its violations and passes every variant of its clean lines and the roll-high examples", () => {
  assert.ok(ROLL_UNDER_PATTERNS.length >= 8, "the eight ROLL-04 pattern families stay");
  for (const p of ROLL_UNDER_PATTERNS) {
    const re = compile(p);
    assert.ok(p.violation.length > 0 && p.clean.length > 0, `${p.id}: fixtures both ways`);
    for (const v of p.violation) for (const x of fixtureVariants(v)) assert.ok(re.test(x), `${p.id} misses ${JSON.stringify(x)}`);
    for (const c of [...p.clean, ...ROLL_HIGH_CLEAN]) for (const x of fixtureVariants(c)) assert.ok(!re.test(x), `${p.id} catches the clean ${JSON.stringify(x)}`);
  }
});

// ─── The live corpus ─────────────────────────────────────────────────────

test("ROLL-04: no player-facing string in the live corpus reads roll-under", () => {
  const hits = scanRollUnder(corpus);
  assert.deepEqual(
    hits.map((h) => `${h.rule} ${h.key} [${h.owner}] «${h.match}» ${h.text}`),
    [],
    "roll-under phrasing is back: rewrite the line roll-high (fixed die: the Phase 74 range; scaling die: faces), never add an exception for a phrase about a roll",
  );
});

test("no rot: every exception matches a live corpus string that its pattern would otherwise catch", () => {
  const byKey = new Map(corpus.entries.map((e) => [e.key, e]));
  for (const x of ROLL_PHRASING_EXCEPTIONS) {
    const e = byKey.get(x.key);
    assert.ok(e, `exception ${x.key}: the key is no longer in the corpus`);
    const re = new RegExp(x.match);
    const live = e.texts.filter((t) => re.test(t));
    assert.ok(live.length > 0, `exception ${x.key}: ${x.match} matches no live text`);
    const caught = live.some((t) => ROLL_UNDER_PATTERNS.some((p) => compile(p).test(t)));
    assert.ok(caught, `exception ${x.key}: no pattern catches its text any more, so the exception is dead`);
  }
});

// The corpus surfaces the ROLL-04 scope names (content txt/note, the Oracle
// and rail templates, the line banks, the panel copy), each held above a
// floor well under today's count so a broken build never reads as clean.
const FLOORS = Object.freeze({
  blurbs: 31, oracle: 261, rail: 229, refusals: 30, "rail-cards": 112, "combat-screen": 162,
  items: 88, spells: 69, foes: 55, death: 90, boards: 145, panels: 152, map: 16, title: 13,
});
const TEXT_FLOOR = 2990;

test("no vacuity: the corpus meets its per-surface floors and its text floor", () => {
  for (const [s, floor] of Object.entries(FLOORS)) {
    assert.ok(corpus.counts.bySurface[s] >= floor, `${s}: ${corpus.counts.bySurface[s]} entries, floor ${floor}`);
  }
  assert.ok(corpus.counts.texts >= TEXT_FLOOR, `texts: ${corpus.counts.texts}, floor ${TEXT_FLOOR}`);
  // Every source kind the CONTEXT names is present.
  for (const prefix of ["oracle:", "rail:", "bank:", "content:", "raw:"]) {
    assert.ok(corpus.entries.some((e) => e.key.startsWith(prefix)), `no ${prefix} entry in the corpus`);
  }
});

// ─── The closure list ────────────────────────────────────────────────────

// Every item docs/ROLL-LEDGER.md's `## Handoffs → Phase 79` list and its
// `(g) What stays for Phase 79` list hand on, by the name the closure
// table uses for it.
const HANDOFF_ITEMS = Object.freeze([
  "Mirror Self",
  "Crystal Staff",
  "Weaken",
  "Acute Hearing",
  "Bestiary face counts (Zit, Drat, Stink Bug)",
  "Skeleton and Shadow notes",
  "Bare signed numbers (the device trigger)",
  "Smoke",
  "Lockpicks",
  "Smoke and Battle Roar narration",
  "Invisibility lines (Anklet, Cloak)",
  "CONDITION_EXPLAIN and FOE_CONDITION_DESC",
  "Every other bestiary face count",
]);

test("closure: every Phase 79 handoff is named, with the plan that closed it", () => {
  const names = DOC_CLOSURES.map((c) => c.item);
  for (const item of HANDOFF_ITEMS) assert.ok(names.includes(item), `the closure list must name "${item}"`);
  for (const c of DOC_CLOSURES) {
    assert.match(c.closedBy, /\b(?:7[2-9](?:\.\d)?-\d{2}|79-\d{2}[a-z]?)\b/, `"${c.item}" must name the plan that closed it (got "${c.closedBy}")`);
    assert.ok(c.how.length > 0, `"${c.item}" must say how it closed`);
  }
});
