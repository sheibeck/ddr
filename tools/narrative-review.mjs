#!/usr/bin/env node
// tools/narrative-review.mjs
//
// Phase 79 (VOX-05), plan 79-13: the narrative pass's REVIEW PAGE, the draft
// the user reads at milestone close (79-CONTEXT: "a before/after review page
// grouped by surface, with each changed line, the event it describes and why
// it changed"). Built from committed inputs only:
//   - docs/narrative-pass/corpus-base.json, the phase-base snapshot (every
//     "before" and every surface comes from it), and
//   - docs/narrative-pass/why/*.json, every plan's why-ledger (every "after"
//     and every "why"). test/unit/narrative-review.test.js proves each after
//     is a line the game prints today.
// It writes two views of the same rows:
//   - docs/NARRATIVE-PASS.md, the Markdown page (the house precedent is
//     docs/CLARITY.md's before/after table), and
//   - docs/narrative-pass/review.html, a self-contained page (inline CSS, no
//     script, no external request, every string HTML-escaped) that reads on
//     a phone in light or dark, ready to publish as an artifact.
//
// ONE ROW PER CHANGED LINE. Rows chain per key: a row whose `before` is an
// earlier plan's `after` for the same key (number-blind for an Oracle or rail
// builder, whose renderings are representative) extends that chain, so a
// line two plans touched shows once, with the base line, the final line and
// both plans' whys in plan order. Rows sort by the corpus's fixed SURFACES
// order, then key, then plan number, so two runs are byte-identical.
//
// Usage:
//   node tools/narrative-review.mjs            write both pages
//   node tools/narrative-review.mjs --md       write only docs/NARRATIVE-PASS.md
//   node tools/narrative-review.mjs --html     write only docs/narrative-pass/review.html
//   node tools/narrative-review.mjs --check    exit 1 (with the first difference) when a
//                                              committed page differs from a fresh
//                                              generation, CRLF normalised; else 0
//   --root <dir>                               read and write under <dir> (tests)
//
// Node built-ins only. Presentation tooling: no engine import, no rng.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { SURFACES } from "./lib/voice-corpus.mjs";
import { readLedgers, skeleton } from "./lib/voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

export const PAGE_MD = "docs/NARRATIVE-PASS.md";
export const PAGE_HTML = "docs/narrative-pass/review.html";
export const BASE_FILE = "docs/narrative-pass/corpus-base.json";
export const LEDGER_DIR = "docs/narrative-pass/why";

/** What each surface is, in the player's words (docs/narrative-pass/README.md). */
export const SURFACE_LABEL = Object.freeze({
  blurbs: "class and race blurbs, and their mechanical footers",
  oracle: "the Oracle log",
  rail: "rail lines and the fight log",
  refusals: "refusals: why the game said no",
  "rail-cards": "rail cards and decision cards",
  "combat-screen": "the combat screen and its chips",
  items: "item, gear and store text",
  spells: "spells, abilities and skills",
  foes: "the bestiary and foe text",
  death: "epitaphs and death",
  boards: "leaderboards and account",
  panels: "hero, gear, store and final-sheet panels",
  map: "the map, its marks and legend",
  title: "title, roller, settings and menus",
  other: "everything else",
});

/** The rubric, quoted from 79-CONTEXT (user accepted 2026-09-25). */
export const RUBRIC = Object.freeze([
  "States what happened, to whom and with what result (numbers where the player needs them).",
  "Reads naturally aloud, with no stilted or translated-sounding phrasing.",
  "The deadpan, family-friendly joke comes AFTER the fact, never instead of it.",
  "Is accurate to what the engine actually did, so the narration never contradicts the event.",
]);

/** The standing rulings every rewrite kept (docs/narrative-pass/README.md). */
export const RULINGS = Object.freeze([
  "HP, not WP: no player-facing string says \"wp\" or \"WP\".",
  "Roll-high everywhere (ROLL-04): a higher face is always better; a fixed die states its range (\"only on 18–20\"), a die that scales with level speaks in faces (\"only your die's top face lands\").",
  "U+2212 for a minus and U+2013 for a range: \"−4 hp\", \"18–20\".",
  "Dungeon Master and Game Master, never \"Maze Master\".",
  "Family-friendly deadpan: no profanity, gore or adult content; the darkness is in the wit, not the shock. A Pilfer's text never names a diagnosis.",
  "House spelling is British (79-12): \"armour\", \"honour\", \"rumour\"; item names such as the Cloak of Armor keep their spelling.",
  "A dismissible card is for decisions and big updates; a minor event is a rail line with its narrative sentence.",
]);

/** The reason tags a ledger row may carry, in the player's words. */
export const REASON_LABEL = Object.freeze({
  fact: "what happened, to whom",
  natural: "reads aloud",
  joke: "the joke after the fact",
  accurate: "accurate to the engine",
  "roll-under": "roll-high (ROLL-04)",
  number: "honest number",
  identity: "advantages and disadvantages (VOX-04)",
  naming: "naming ruling",
  hygiene: "hygiene",
});

const isBuilderKey = (key) => key.startsWith("oracle:") || key.startsWith("rail:");
const sameLine = (key, a, b) => a === b || (isBuilderKey(key) && skeleton(a) === skeleton(b));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * collapse({ base, ledgers }) — the page rows. One row per changed line:
 * { key, surface, trigger, before, after, steps: [{ plan, index, reasons,
 * why }] }. `before` is the first row's (a phase-base line, or "" for a new
 * line); `after` is the last row's ("" for a removed line). `surface` is the
 * phase base's for a base key, else the ledger row's.
 */
export function collapse({ base, ledgers }) {
  const baseSurface = new Map((base?.entries ?? []).map((e) => [e.key, e.surface]));
  const chainsByKey = new Map();
  const order = [];
  for (const { plan, rows } of ledgers ?? []) {
    if (!Array.isArray(rows)) continue;
    const extendedThisPlan = new Set();
    rows.forEach((r, index) => {
      if (!r || typeof r.key !== "string") return;
      const chains = chainsByKey.get(r.key) ?? [];
      chainsByKey.set(r.key, chains);
      const step = { plan, index, reasons: [...(r.reasons ?? [])], why: String(r.why ?? "") };
      const open = r.before === ""
        ? null
        : chains.find((c) => !extendedThisPlan.has(c) && c.lastPlan !== plan && c.after !== "" && sameLine(r.key, c.after, r.before));
      if (open) {
        open.after = r.after;
        open.lastPlan = plan;
        open.rowSurface = r.surface;
        open.steps.push(step);
        extendedThisPlan.add(open);
        return;
      }
      const chain = { key: r.key, trigger: String(r.trigger ?? ""), before: r.before ?? "", after: r.after ?? "", lastPlan: plan, rowSurface: r.surface, steps: [step] };
      chains.push(chain);
      extendedThisPlan.add(chain);
      order.push(chain);
    });
  }
  const idx = new Map(SURFACES.map((s, i) => [s, i]));
  const rows = order.map((c) => {
    let surface = baseSurface.get(c.key) ?? c.rowSurface;
    if (!idx.has(surface)) surface = "other";
    return { key: c.key, surface, trigger: c.trigger, before: c.before, after: c.after, steps: c.steps };
  });
  rows.sort((a, b) =>
    (idx.get(a.surface) - idx.get(b.surface)) || cmp(a.key, b.key) || cmp(a.steps[0].plan, b.steps[0].plan) || (a.steps[0].index - b.steps[0].index));
  return rows;
}

/**
 * buildReview({ base, ledgers }) — { baseSha, rows, counts }. Per surface,
 * counting KEYS (a builder key is one line however many renderings it has):
 * judged (phase-base keys), changed (base keys with a ledger row), kept
 * (judged minus changed: word for word, which the one-shot
 * `voice-inventory --check-ledgers --after --coverage` proves), added (keys
 * new since the base); and counting page ROWS: rows, removed (rows whose
 * line was deleted).
 */
export function buildReview({ base, ledgers }) {
  const rows = collapse({ base, ledgers });
  const baseKeys = new Map((base?.entries ?? []).map((e) => [e.key, e.surface]));
  const touched = new Map();
  for (const r of rows) if (!touched.has(r.key)) touched.set(r.key, r.surface);
  const perSurface = SURFACES.map((surface) => {
    const judged = [...baseKeys.values()].filter((s) => s === surface).length;
    const changed = [...touched].filter(([k, s]) => s === surface && baseKeys.has(k)).length;
    const added = [...touched].filter(([k, s]) => s === surface && !baseKeys.has(k)).length;
    const onSurface = rows.filter((r) => r.surface === surface);
    return { surface, judged, changed, removed: onSurface.filter((r) => r.after === "").length, kept: judged - changed, added, rows: onSurface.length };
  });
  const totals = { surface: "total" };
  for (const f of ["judged", "changed", "removed", "kept", "added", "rows"]) totals[f] = perSurface.reduce((n, c) => n + c[f], 0);
  const plans = (ledgers ?? []).map((l) => l.plan);
  return { baseSha: String(base?.base ?? ""), plans, rows, counts: { perSurface, totals } };
}

// ─── Markdown ──────────────────────────────────────────────────────────────

const mdCell = (s) => String(s).replace(/\r?\n/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/`/g, "\\`");
const reasonText = (reasons) => reasons.map((r) => REASON_LABEL[r] ?? r).join(", ");
const mdStep = (s) => `**${s.plan}** (${mdCell(reasonText(s.reasons))}): ${mdCell(s.why)}`;

/** renderMarkdown(review) — docs/NARRATIVE-PASS.md, LF line ends. */
export function renderMarkdown(review) {
  const { baseSha, rows, counts, plans } = review;
  const L = [];
  L.push("# The narrative pass (Phase 79): every changed line, before and after");
  L.push("");
  L.push("<!-- Generated by `node tools/narrative-review.mjs` from docs/narrative-pass/why/*.json and docs/narrative-pass/corpus-base.json. Do not edit by hand: test/unit/narrative-review.test.js fails on any difference. -->");
  L.push("");
  L.push("Phase 79 judged every player-facing line against a four-point rubric and rewrote only the lines that failed it. A line that passed stays word for word. This page lists every line that changed, grouped by where the player reads it, with the event it describes and why it changed.");
  L.push("");
  L.push("## How to read this page");
  L.push("");
  L.push(`- **Before** is the line at the phase base (commit \`${baseSha.slice(0, 8)}\`). **After** is the line the game prints now.`);
  L.push("- An Oracle or rail line is one representative rendering of its builder, from a fixed synthetic event, so its numbers and names are examples. \"…\" stands for a value filled in at play time.");
  L.push("- *(new line)* means nothing was printed there before. *(removed)* means the line is gone, and the why says what replaced it.");
  L.push("- **Why** lists every plan that changed the line, in order, with its reasons.");
  L.push(`- Ledgers read: ${plans.join(", ")}.`);
  L.push("");
  L.push("## How to ask for changes");
  L.push("");
  L.push("Quote the line (or its key, the code in the first column) and the tone you want instead. Every tone change goes into one quick follow-up task, not a new phase.");
  L.push("");
  L.push("## The rubric");
  L.push("");
  RUBRIC.forEach((r, i) => L.push(`${i + 1}. ${r}`));
  L.push("");
  L.push("## The standing rulings");
  L.push("");
  for (const r of RULINGS) L.push(`- ${r}`);
  L.push("");
  L.push("## The pass in numbers");
  L.push("");
  L.push("Keys are lines as the game stores them (a builder is one key, however many ways it renders). Rows are the lines on this page.");
  L.push("");
  L.push("| Surface | Keys judged | Changed | Kept word for word | New | Rows on this page | Lines removed |");
  L.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const c of counts.perSurface) L.push(`| ${c.surface} (${SURFACE_LABEL[c.surface]}) | ${c.judged} | ${c.changed} | ${c.kept} | ${c.added} | ${c.rows} | ${c.removed} |`);
  const t = counts.totals;
  L.push(`| **Total** | **${t.judged}** | **${t.changed}** | **${t.kept}** | **${t.added}** | **${t.rows}** | **${t.removed}** |`);
  L.push("");
  for (const surface of SURFACES) {
    const on = rows.filter((r) => r.surface === surface);
    if (!on.length) continue;
    L.push(`## ${surface} — ${SURFACE_LABEL[surface]}`);
    L.push("");
    L.push(`${on.length} changed line${on.length === 1 ? "" : "s"}.`);
    L.push("");
    L.push("| Line and trigger | Before | After | Why |");
    L.push("|---|---|---|---|");
    for (const r of on) {
      const before = r.before === "" ? "*(new line)*" : mdCell(r.before);
      const after = r.after === "" ? "*(removed)*" : mdCell(r.after);
      L.push(`| \`${r.key.replace(/`/g, "'")}\`<br>${mdCell(r.trigger)} | ${before} | ${after} | ${r.steps.map(mdStep).join("<br>")} |`);
    }
    L.push("");
  }
  return L.join("\n");
}

/**
 * auditPage(markdown, ledgers) — error strings (empty = complete): every
 * ledger row has a page row (its key, with that plan's why), and every page
 * row's key has a ledger row.
 */
export function auditPage(markdown, ledgers) {
  const errors = [];
  const pageRows = String(markdown).replace(/\r\n/g, "\n").split("\n")
    .filter((l) => l.startsWith("| `"))
    .map((l) => ({ key: l.slice(3, l.indexOf("`", 3)), line: l }));
  const ledgerKeys = new Set();
  for (const { plan, rows } of ledgers ?? []) {
    if (!Array.isArray(rows)) continue;
    rows.forEach((r, i) => {
      ledgerKeys.add(r.key);
      const want = `**${plan}** (${mdCell(reasonText(r.reasons ?? []))}): ${mdCell(r.why)}`;
      if (!pageRows.some((p) => p.key === r.key && p.line.includes(want))) errors.push(`${plan} row ${i} (${r.key}): no page row carries it`);
    });
  }
  for (const p of pageRows) if (!ledgerKeys.has(p.key)) errors.push(`page row ${p.key}: no ledger row`);
  return errors;
}

// ─── HTML ──────────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CSS = `
:root{--paper:#f3ead3;--card:#fbf5e4;--ink:#2b2418;--soft:#6b5c3c;--rule:#d8c9a3;--stamp:#a63a2c;--moss:#4f6b35;--amber:#8a5d0f;--code:#efe3c4}
@media (prefers-color-scheme: dark){:root{--paper:#14110c;--card:#1d1811;--ink:#e6ddc6;--soft:#a89c82;--rule:#3a3226;--stamp:#e07260;--moss:#8fae6a;--amber:#d99a2b;--code:#262016}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Georgia,"Iowan Old Style","Times New Roman",serif}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;line-height:1.25;margin:.5rem 0 1rem}
h2{font-size:1.2rem;margin:2rem 0 .5rem;padding-bottom:.25rem;border-bottom:2px solid var(--rule)}
h2 small{font-weight:normal;color:var(--soft)}
p,li{max-width:70ch}
a{color:var(--amber)}
code{font-family:"Courier Prime",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;background:var(--code);padding:0 .25em;border-radius:3px;overflow-wrap:anywhere}
nav ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.4rem}
nav a{display:inline-block;padding:.2rem .55rem;border:1px solid var(--rule);border-radius:999px;background:var(--card);text-decoration:none}
table{width:100%;border-collapse:collapse;margin:.5rem 0 1rem;background:var(--card)}
th,td{text-align:left;vertical-align:top;padding:.5rem;border:1px solid var(--rule)}
th{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--soft)}
td.num,th.num{text-align:right}
.trig{display:block;color:var(--soft);font-size:.85rem;margin-top:.25rem}
.before{color:var(--soft)}
.step{margin:0 0 .35rem}
.step:last-child{margin:0}
.plan{font-weight:bold}
.tags{color:var(--soft);font-size:.8rem}
.tag{display:inline-block;font-size:.75rem;padding:0 .4rem;border-radius:3px;border:1px solid currentColor}
.tag.gone{color:var(--stamp)}
.tag.new{color:var(--moss)}
@media (max-width:720px){
 table.lines,table.lines tbody,table.lines tr,table.lines td{display:block;width:100%}
 table.lines thead{display:none}
 table.lines{background:none}
 table.lines tr.row{background:var(--card);border:1px solid var(--rule);border-radius:6px;margin:0 0 .75rem;padding:.25rem .5rem}
 table.lines td{border:0;padding:.35rem 0}
 table.lines td::before{content:attr(data-label);display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--soft)}
 table.counts{font-size:.85rem}
 table.counts th,table.counts td{padding:.3rem}
}
`.trim();

const htmlStep = (s) =>
  `<p class="step"><span class="plan">${esc(s.plan)}</span> <span class="tags">(${esc(reasonText(s.reasons))})</span>: ${esc(s.why)}</p>`;

/** renderHtml(review) — docs/narrative-pass/review.html, LF line ends. */
export function renderHtml(review) {
  const { baseSha, rows, counts, plans } = review;
  const H = [];
  H.push("<!doctype html>");
  H.push('<html lang="en-GB">');
  H.push("<head>");
  H.push('<meta charset="utf-8">');
  H.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  H.push('<meta name="color-scheme" content="light dark">');
  H.push("<title>Mazeworld: the narrative pass, before and after</title>");
  H.push("<!-- Generated by node tools/narrative-review.mjs from docs/narrative-pass/why/*.json and docs/narrative-pass/corpus-base.json. Do not edit by hand. -->");
  H.push(`<style>\n${CSS}\n</style>`);
  H.push("</head>");
  H.push("<body>");
  H.push("<main>");
  H.push("<h1>The narrative pass (Phase 79): every changed line, before and after</h1>");
  H.push("<p>Phase 79 judged every player-facing line against a four-point rubric and rewrote only the lines that failed it. A line that passed stays word for word. This page lists every line that changed, grouped by where the player reads it, with the event it describes and why it changed.</p>");
  H.push('<h2 id="read">How to read this page</h2>');
  H.push("<ul>");
  H.push(`<li><strong>Before</strong> is the line at the phase base (commit <code>${esc(baseSha.slice(0, 8))}</code>). <strong>After</strong> is the line the game prints now.</li>`);
  H.push("<li>An Oracle or rail line is one representative rendering of its builder, from a fixed synthetic event, so its numbers and names are examples. \u201c\u2026\u201d stands for a value filled in at play time.</li>");
  H.push('<li><span class="tag new">new line</span> means nothing was printed there before. <span class="tag gone">removed</span> means the line is gone, and the why says what replaced it.</li>');
  H.push("<li><strong>Why</strong> lists every plan that changed the line, in order, with its reasons.</li>");
  H.push(`<li>Ledgers read: ${esc(plans.join(", "))}.</li>`);
  H.push("</ul>");
  H.push('<h2 id="ask">How to ask for changes</h2>');
  H.push("<p>Quote the line (or its key, the code in the first column) and the tone you want instead. Every tone change goes into one quick follow-up task, not a new phase.</p>");
  H.push('<h2 id="rubric">The rubric</h2>');
  H.push("<ol>");
  for (const r of RUBRIC) H.push(`<li>${esc(r)}</li>`);
  H.push("</ol>");
  H.push('<h2 id="rulings">The standing rulings</h2>');
  H.push("<ul>");
  for (const r of RULINGS) H.push(`<li>${esc(r)}</li>`);
  H.push("</ul>");
  H.push('<h2 id="numbers">The pass in numbers</h2>');
  H.push("<p>Keys are lines as the game stores them (a builder is one key, however many ways it renders). Rows are the lines on this page.</p>");
  H.push('<table class="counts">');
  H.push('<thead><tr><th>Surface</th><th class="num">Keys judged</th><th class="num">Changed</th><th class="num">Kept word for word</th><th class="num">New</th><th class="num">Rows here</th><th class="num">Removed</th></tr></thead>');
  H.push("<tbody>");
  for (const c of counts.perSurface) {
    const name = c.rows ? `<a href="#s-${c.surface}">${esc(c.surface)}</a>` : esc(c.surface);
    H.push(`<tr><td>${name}</td><td class="num">${c.judged}</td><td class="num">${c.changed}</td><td class="num">${c.kept}</td><td class="num">${c.added}</td><td class="num">${c.rows}</td><td class="num">${c.removed}</td></tr>`);
  }
  const t = counts.totals;
  H.push(`<tr><th>Total</th><th class="num">${t.judged}</th><th class="num">${t.changed}</th><th class="num">${t.kept}</th><th class="num">${t.added}</th><th class="num">${t.rows}</th><th class="num">${t.removed}</th></tr>`);
  H.push("</tbody>");
  H.push("</table>");
  const present = SURFACES.filter((s) => rows.some((r) => r.surface === s));
  H.push('<nav aria-label="Surfaces"><ul>');
  for (const s of present) H.push(`<li><a href="#s-${s}">${esc(s)} (${rows.filter((r) => r.surface === s).length})</a></li>`);
  H.push("</ul></nav>");
  for (const surface of present) {
    const on = rows.filter((r) => r.surface === surface);
    H.push(`<section id="s-${surface}">`);
    H.push(`<h2>${esc(surface)} <small>${esc(SURFACE_LABEL[surface])} \u00b7 ${on.length} changed line${on.length === 1 ? "" : "s"}</small></h2>`);
    H.push('<table class="lines">');
    H.push("<thead><tr><th>Line and trigger</th><th>Before</th><th>After</th><th>Why</th></tr></thead>");
    H.push("<tbody>");
    for (const r of on) {
      const before = r.before === "" ? '<span class="tag new">new line</span>' : esc(r.before);
      const after = r.after === "" ? '<span class="tag gone">removed</span>' : esc(r.after);
      H.push(`<tr class="row"><td data-label="Line"><code>${esc(r.key)}</code><span class="trig">${esc(r.trigger)}</span></td><td data-label="Before" class="before">${before}</td><td data-label="After">${after}</td><td data-label="Why">${r.steps.map(htmlStep).join("")}</td></tr>`);
    }
    H.push("</tbody>");
    H.push("</table>");
    H.push("</section>");
  }
  H.push("</main>");
  H.push("</body>");
  H.push("</html>");
  return H.join("\n") + "\n";
}

// ─── Generation, check and CLI ─────────────────────────────────────────────

/** generate({ root }) — { review, md, html } from the committed inputs under root. */
export function generate({ root = REPO_ROOT } = {}) {
  const base = JSON.parse(fs.readFileSync(path.join(root, BASE_FILE), "utf8").replace(/^\uFEFF/, ""));
  const ledgers = readLedgers(path.join(root, LEDGER_DIR));
  const review = buildReview({ base, ledgers });
  const md = renderMarkdown(review) + "\n";
  return { review, md, html: renderHtml(review) };
}

const lf = (s) => s.replace(/\r\n/g, "\n");

/** Write `text` (LF) keeping the line ends the file already has on disk, so a regeneration after a CRLF checkout is byte-identical. */
function writeKeepingEol(file, text) {
  const prior = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const out = prior.includes("\r\n") ? text.replace(/\n/g, "\r\n") : text;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (prior !== out) fs.writeFileSync(file, out, "utf8");
}

function firstDifference(a, b) {
  const x = a.split("\n");
  const y = b.split("\n");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return { line: i + 1, committed: x[i] ?? "(end of file)", fresh: y[i] ?? "(end of file)" };
  }
  return null;
}

/** checkPages({ root }) — { ok, problems } comparing each committed page with a fresh generation, CRLF normalised. */
export function checkPages({ root = REPO_ROOT } = {}) {
  const { md, html } = generate({ root });
  const problems = [];
  for (const [rel, fresh] of [[PAGE_MD, md], [PAGE_HTML, html]]) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) { problems.push(`${rel}: missing (run node tools/narrative-review.mjs)`); continue; }
    const d = firstDifference(lf(fs.readFileSync(file, "utf8")), fresh);
    if (d) problems.push(`${rel}: stale at line ${d.line}\n  committed: ${d.committed.slice(0, 160)}\n  fresh:     ${d.fresh.slice(0, 160)}`);
  }
  return { ok: problems.length === 0, problems };
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const rootAt = argv.indexOf("--root");
  const root = rootAt >= 0 ? path.resolve(argv[rootAt + 1]) : REPO_ROOT;
  for (const f of flags) if (!["--md", "--html", "--check", "--root"].includes(f)) { console.error(`unknown flag ${f}`); return 2; }
  if (flags.has("--check")) {
    const { ok, problems } = checkPages({ root });
    for (const p of problems) console.log(p);
    console.log(ok ? "narrative-review: pages are in sync" : "narrative-review: run node tools/narrative-review.mjs to regenerate");
    return ok ? 0 : 1;
  }
  const { review, md, html } = generate({ root });
  const both = !flags.has("--md") && !flags.has("--html");
  if (both || flags.has("--md")) writeKeepingEol(path.join(root, PAGE_MD), md);
  if (both || flags.has("--html")) writeKeepingEol(path.join(root, PAGE_HTML), html);
  console.log(`narrative-review: ${review.rows.length} rows on ${new Set(review.rows.map((r) => r.surface)).size} surfaces`);
  return 0;
}

if (path.resolve(process.argv[1] || "") === url.fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
