// test/unit/narrative-review.test.js
//
// Phase 79 (VOX-05), plan 79-13: the doc-synced guard for the narrative
// pass's review page. tools/narrative-review.mjs builds docs/NARRATIVE-PASS.md
// and docs/narrative-pass/review.html from the committed why-ledgers
// (docs/narrative-pass/why/*.json) and the phase-base snapshot
// (docs/narrative-pass/corpus-base.json). This file proves:
//   - a key changed by more than one plan collapses to ONE page row: the base
//     line, the final line and every plan's why in plan order;
//   - rows group by surface in the corpus's fixed SURFACES order, then key,
//     then plan number, and two generations are byte-identical;
//   - the Markdown and the HTML carry the same rows, the HTML escapes every
//     cell and loads nothing external (no script, no remote src or href);
//   - a ledger row with no page row, or a page row with no ledger row, fails;
//   - `--check` exits 0 on a fresh page and 1 on a stale one;
//   - live: the committed pages equal a fresh generation (CRLF normalised),
//     every ledger row is on the page, every "before" is a phase-base line
//     and every "after" is a line the game prints today (the VOX-05
//     prohibition: the page never shows a line the game never printed).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import {
  PAGE_MD, PAGE_HTML, collapse, buildReview, renderMarkdown, renderHtml, auditPage, generate,
} from "../../tools/narrative-review.mjs";
import { SURFACES, buildCorpus } from "../../tools/lib/voice-corpus.mjs";
import { readLedgers, skeleton } from "../../tools/lib/voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TOOL = path.join(REPO_ROOT, "tools", "narrative-review.mjs");
const lf = (s) => s.replace(/\r\n/g, "\n");

// ─── A synthetic phase: a base, two ledgers, one key changed twice ────────

const ROW = (key, surface, before, after, why, reasons = ["natural"], trigger = `the ${key} line`) =>
  ({ key, surface, trigger, before, after, reasons, why });

const SYN_BASE = {
  base: "abc1234",
  entries: [
    { key: "bank:A.one", surface: "panels", texts: ["Old panel line."] },
    { key: "content:SPELLS.Mirror Self.txt", surface: "spells", texts: ["foes need a 1 to hit"] },
    { key: "oracle:rested", surface: "oracle", texts: ["Rest restores +2 hp.", "Rest restores +8 hp."] },
    { key: "bank:B.kept", surface: "oracle", texts: ["A line nobody touched."] },
    { key: "raw:mazeworld.html#markup", surface: "title", texts: ["Gone soon.", "Also gone."] },
  ],
};

const SYN_LEDGERS = [
  { plan: "79-02", rows: [
    ROW("oracle:rested", "oracle", "Rest restores +8 hp.", "Rest restores +3 hp.", "The rest line prints the HP it restored.", ["number"]),
    ROW("bank:A.one", "panels", "Old panel line.", "Middle panel line.", "First pass: the fact first."),
  ] },
  { plan: "79-05", rows: [
    ROW("content:SPELLS.Mirror Self.txt", "spells", "foes need a 1 to hit", "foes hit only on a 20 <b>&</b>", "Roll-high.", ["roll-under"]),
    ROW("bank:A.one", "panels", "Middle panel line.", "Final panel line.", "Second pass: reads aloud."),
  ] },
  { plan: "79-12", rows: [
    ROW("raw:mazeworld.html#markup", "title", "Gone soon.", "", "Deleted: never shown."),
    ROW("raw:mazeworld.html#markup", "title", "Also gone.", "", "Deleted with its section."),
    ROW("bank:IDENTITY_TRAITS.sub.X.good.0.text", "blurbs", "", "a brand-new trait", "VOX-04: a new line.", ["identity"]),
  ] },
];

test("collapse: a key changed by two plans is one row with the base before, the final after and both whys in plan order", () => {
  const rows = collapse({ base: SYN_BASE, ledgers: SYN_LEDGERS });
  const a = rows.filter((r) => r.key === "bank:A.one");
  assert.equal(a.length, 1);
  assert.equal(a[0].before, "Old panel line.");
  assert.equal(a[0].after, "Final panel line.");
  assert.deepStrictEqual(a[0].steps.map((s) => [s.plan, s.why]), [
    ["79-02", "First pass: the fact first."],
    ["79-05", "Second pass: reads aloud."],
  ]);
  // two independent lines of one key stay two rows
  assert.equal(rows.filter((r) => r.key === "raw:mazeworld.html#markup").length, 2);
});

test("collapse: rows group by the SURFACES order, then key, then plan number", () => {
  const rows = collapse({ base: SYN_BASE, ledgers: SYN_LEDGERS });
  const idx = new Map(SURFACES.map((s, i) => [s, i]));
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1];
    const r = rows[i];
    const bySurface = idx.get(p.surface) - idx.get(r.surface);
    assert.ok(bySurface < 0 || (bySurface === 0 && (p.key < r.key || (p.key === r.key && p.steps[0].plan <= r.steps[0].plan))), `${p.key} before ${r.key}`);
  }
  assert.deepStrictEqual([...new Set(rows.map((r) => r.surface))], ["blurbs", "oracle", "spells", "panels", "title"]);
  // the surface is the phase base's for a base key, the ledger's for a new one
  assert.equal(rows.find((r) => r.key.startsWith("bank:IDENTITY_TRAITS")).surface, "blurbs");
});

test("counts: per surface, lines judged, changed, kept word for word and added", () => {
  const review = buildReview({ base: SYN_BASE, ledgers: SYN_LEDGERS });
  const by = new Map(review.counts.perSurface.map((c) => [c.surface, c]));
  assert.deepStrictEqual(by.get("oracle"), { surface: "oracle", judged: 2, changed: 1, removed: 0, kept: 1, added: 0, rows: 1 });
  // `removed` counts page rows (lines) deleted, the others count keys
  assert.deepStrictEqual(by.get("title"), { surface: "title", judged: 1, changed: 1, removed: 2, kept: 0, added: 0, rows: 2 });
  assert.deepStrictEqual(by.get("blurbs"), { surface: "blurbs", judged: 0, changed: 0, removed: 0, kept: 0, added: 1, rows: 1 });
  assert.equal(review.counts.totals.judged, 5);
  assert.equal(review.counts.totals.rows, 6);
  assert.equal(review.baseSha, "abc1234");
});

test("markdown: one ## section per surface with a changed line, in SURFACES order; removed and new lines are named", () => {
  const md = renderMarkdown(buildReview({ base: SYN_BASE, ledgers: SYN_LEDGERS }));
  const sections = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const surfaceSections = sections.filter((s) => SURFACES.some((x) => s.startsWith(`${x} `) || s === x));
  assert.deepStrictEqual(surfaceSections.map((s) => s.split(" ")[0]), ["blurbs", "oracle", "spells", "panels", "title"]);
  assert.match(md, /\(removed\)/);
  assert.match(md, /\(new line\)/);
  assert.match(md, /Deleted: never shown\./);
  assert.equal(auditPage(md, SYN_LEDGERS).length, 0);
});

test("html: the same rows, every cell escaped, nothing external, no script", () => {
  const review = buildReview({ base: SYN_BASE, ledgers: SYN_LEDGERS });
  const html = renderHtml(review);
  const md = renderMarkdown(review);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/(src|href)="https?:/i.test(html));
  assert.ok(!/@import|url\(/i.test(html), "no external CSS");
  assert.ok(html.includes("foes hit only on a 20 &lt;b&gt;&amp;&lt;/b&gt;"));
  assert.ok(!html.includes("<b>&</b>"));
  const htmlRows = (html.match(/<tr class="row/g) ?? []).length;
  const mdRows = md.split("\n").filter((l) => l.startsWith("| `")).length;
  assert.equal(htmlRows, review.rows.length);
  assert.equal(mdRows, review.rows.length);
  for (const r of review.rows) assert.ok(html.includes(`<code>${r.key.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>`), r.key);
  assert.match(html, /prefers-color-scheme: ?dark/);
});

test("determinism: two generations are byte-identical", () => {
  const a = buildReview({ base: SYN_BASE, ledgers: SYN_LEDGERS });
  const b = buildReview({ base: SYN_BASE, ledgers: structuredClone(SYN_LEDGERS) });
  assert.equal(renderMarkdown(a), renderMarkdown(b));
  assert.equal(renderHtml(a), renderHtml(b));
});

test("audit: a ledger row with no page row fails, and a page row with no ledger row fails", () => {
  const md = renderMarkdown(buildReview({ base: SYN_BASE, ledgers: SYN_LEDGERS }));
  const dropped = md.split("\n").filter((l) => !l.startsWith("| `bank:A.one`")).join("\n");
  assert.ok(auditPage(dropped, SYN_LEDGERS).some((e) => e.includes("bank:A.one")));
  const extra = SYN_LEDGERS.map((l) => (l.plan === "79-05" ? { ...l, rows: l.rows.filter((r) => r.key !== "content:SPELLS.Mirror Self.txt") } : l));
  assert.ok(auditPage(md, extra).some((e) => e.includes("content:SPELLS.Mirror Self.txt")));
});

test("--check: exit 0 on a fresh page, 1 on a stale one", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "narrative-review-"));
  try {
    fs.mkdirSync(path.join(tmp, "docs", "narrative-pass", "why"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "docs", "narrative-pass", "corpus-base.json"), JSON.stringify(SYN_BASE));
    for (const l of SYN_LEDGERS) fs.writeFileSync(path.join(tmp, "docs", "narrative-pass", "why", `${l.plan}.json`), JSON.stringify(l.rows, null, 1));
    const run = (...args) => spawnSync(process.execPath, [TOOL, "--root", tmp, ...args], { encoding: "utf8" });
    assert.equal(run().status, 0);
    assert.equal(run("--check").status, 0, "fresh pages pass");
    // CRLF on disk (core.autocrlf) is not a difference
    const mdPath = path.join(tmp, PAGE_MD);
    fs.writeFileSync(mdPath, fs.readFileSync(mdPath, "utf8").replace(/\n/g, "\r\n"));
    assert.equal(run("--check").status, 0, "CRLF is normalised");
    fs.appendFileSync(mdPath, "\nA hand edit.\n");
    const stale = run("--check");
    assert.equal(stale.status, 1);
    assert.match(stale.stdout + stale.stderr, /NARRATIVE-PASS\.md/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── Live: the committed pages ─────────────────────────────────────────────

const live = generate({ root: REPO_ROOT });
const liveLedgers = readLedgers(path.join(REPO_ROOT, "docs", "narrative-pass", "why"));

test("live: the committed Markdown and HTML pages equal a fresh generation (CRLF normalised)", () => {
  assert.equal(lf(fs.readFileSync(path.join(REPO_ROOT, PAGE_MD), "utf8")), live.md, `${PAGE_MD} is stale: run node tools/narrative-review.mjs`);
  assert.equal(lf(fs.readFileSync(path.join(REPO_ROOT, PAGE_HTML), "utf8")), live.html, `${PAGE_HTML} is stale: run node tools/narrative-review.mjs`);
});

test("live: every ledger row of every plan has a page row, and every page row a ledger row", () => {
  assert.ok(liveLedgers.length >= 12, "every Phase 79 ledger is read");
  assert.ok(liveLedgers.some((l) => l.plan === "79-02c"), "79-02c's deletions count");
  assert.deepStrictEqual(auditPage(live.md, liveLedgers), []);
  // 79-12's new foe-swing label and 79-02c's two deletions are on the page
  assert.ok(live.review.rows.some((r) => r.key === "bank:MOD_LABEL.gear"));
  const removed = live.review.rows.filter((r) => r.steps.some((s) => s.plan === "79-02c"));
  assert.equal(removed.length, 2);
  for (const r of removed) assert.equal(r.after, "");
  assert.ok(!/<script/i.test(live.html) && !/(src|href)="https?:/i.test(live.html));
});

test("live (VOX-05 prohibition): every before is a phase-base line and every after is a line the game prints now", async () => {
  const base = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs", "narrative-pass", "corpus-base.json"), "utf8"));
  const baseTexts = new Map(base.entries.map((e) => [e.key, e.texts]));
  const current = await buildCorpus({ root: REPO_ROOT });
  const curTexts = new Map(current.entries.map((e) => [e.key, e.texts]));
  const isBuilder = (k) => k.startsWith("oracle:") || k.startsWith("rail:");
  const has = (texts, t, k) => !!texts && (texts.includes(t) || (texts.length > 1 && texts.join(" ") === t) || (isBuilder(k) && texts.some((x) => skeleton(x) === skeleton(t))));
  for (const r of live.review.rows) {
    if (r.before !== "") assert.ok(has(baseTexts.get(r.key), r.before, r.key), `${r.key}: before is not a phase-base line: ${r.before}`);
    if (r.after !== "") assert.ok(has(curTexts.get(r.key), r.after, r.key), `${r.key}: after is not a line the game prints: ${r.after}`);
  }
});
