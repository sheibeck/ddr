// test/unit/shell-pgs.test.js
//
// Phase 68 (PGS-03..05, PLACE-01/02; D-01..D-07, D-10..D-12), Plan 07 —
// pins the shell's Phase 68 wiring in mazeworld.html: the THAT IS THAT rank
// line (the classic renderRankLine, its CSS and the __mzPlacement bridge),
// and the module's submission queue, death listener, flush triggers,
// placement routing, rail-card parking, season-drop Oracle line and the
// Leaderboards panel's global seams. mazeworld.html has no ESM surface a
// test could import, so this uses the comment-stripping and
// region-extraction technique of test/unit/shell-new-best.test.js and
// test/unit/shell-account.test.js: SOURCE pins over the comment-stripped
// text, and BEHAVIOUR tests that evaluate the exact shipped source of a
// region with recording fakes threaded in.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BRIDGE } from "../../src/browser/bridge.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — the
// order test/unit/shell-combat-over.test.js documents) ──────────────────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}
const CODE = stripComments(HTML);
const MODULE = CODE.slice(CODE.indexOf('<script type="module">'));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function occurrences(source, literal) {
  return source.split(literal).length - 1;
}

// A per-function slice of the classic script, from an exact signature to
// the NEXT zero-indent "\nfunction " after it.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

// ─── a recording DOM for renderRankLine ─────────────────────────────────────

function makeElement(tag) {
  const el = {
    tagName: tag,
    className: "",
    id: "",
    textContent: "",
    attrs: {},
    parent: null,
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    remove() {
      if (!this.parent) return;
      const i = this.parent.children.indexOf(this);
      if (i !== -1) this.parent.children.splice(i, 1);
      this.parent = null;
    },
  };
  return el;
}

function makeHost() {
  return {
    children: [],
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parent = this;
      const i = this.children.indexOf(ref);
      if (i === -1) this.children.push(child);
      else this.children.splice(i, 0, child);
      return child;
    },
    querySelector(sel) {
      if (sel.startsWith("#")) return this.children.find((c) => c.id === sel.slice(1)) || null;
      if (sel.startsWith(".")) return this.children.find((c) => String(c.className).split(" ").includes(sel.slice(1))) || null;
      return null;
    },
  };
}

function loadRenderRankLine(win = {}) {
  const src = fnRegion("function renderRankLine(host, placement)");
  const created = [];
  const doc = {
    createElement(tag) {
      const el = makeElement(tag);
      created.push(el);
      return el;
    },
  };
  const fn = new Function("document", "window", src + "\nreturn renderRankLine;")(doc, win);
  return { renderRankLine: fn, win, created };
}

const ranks = (host) => host.children.filter((c) => c.id === "cb-over-rank");

// ═══════════════════════ (R) the THAT IS THAT rank line (D-10/D-11) ════════

test("(R1) BEHAVIOUR: a fresh placement adds one p#cb-over-rank before .cb-over-actions, marked data-fresh, and the bridge turns not fresh", () => {
  const win = {};
  const { renderRankLine } = loadRenderRankLine(win);
  const host = makeHost();
  const line = makeElement("div");
  line.className = "cb-over-line";
  host.appendChild(line);
  const actions = makeElement("div");
  actions.className = "cb-over-actions";
  host.appendChild(actions);
  const placement = { hash: "h1", line: "You placed 3,117th of 9,044.", fresh: true };
  win.__mzPlacement = placement;
  renderRankLine(host, placement);
  const rows = ranks(host);
  assert.equal(rows.length, 1);
  const p = rows[0];
  assert.equal(p.tagName, "p");
  assert.equal(p.className, "cb-over-rank");
  assert.equal(p.textContent, "You placed 3,117th of 9,044.");
  assert.equal(p.getAttribute("data-fresh"), "1");
  assert.equal(host.children.indexOf(p), 1, "inserted before .cb-over-actions");
  assert.deepEqual({ ...win.__mzPlacement }, { hash: "h1", line: "You placed 3,117th of 9,044.", fresh: false });
});

test("(R2) BEHAVIOUR: without .cb-over-actions the line is appended", () => {
  const { renderRankLine } = loadRenderRankLine({});
  const host = makeHost();
  host.appendChild(makeElement("div"));
  renderRankLine(host, { hash: "h1", line: "L", fresh: true });
  assert.equal(host.children.length, 2);
  assert.equal(host.children[1].id, "cb-over-rank");
});

test("(R3) BEHAVIOUR: a second call with the not-fresh placement replaces the element (still one) without data-fresh", () => {
  const win = {};
  const { renderRankLine } = loadRenderRankLine(win);
  const host = makeHost();
  win.__mzPlacement = { hash: "h1", line: "L", fresh: true };
  renderRankLine(host, win.__mzPlacement);
  const first = ranks(host)[0];
  renderRankLine(host, win.__mzPlacement);
  const rows = ranks(host);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0], first, "the element is replaced");
  assert.equal(rows[0].getAttribute("data-fresh"), null);
  assert.equal(rows[0].textContent, "L");
});

test("(R4) BEHAVIOUR: a null placement, a non-string line or an empty line removes any rank line and adds nothing; a null host is a no-op", () => {
  const { renderRankLine, created } = loadRenderRankLine({});
  for (const bad of [null, undefined, {}, { line: 42 }, { line: "" }, "text"]) {
    const host = makeHost();
    renderRankLine(host, { hash: "h1", line: "L", fresh: false });
    assert.equal(ranks(host).length, 1);
    renderRankLine(host, bad);
    assert.equal(ranks(host).length, 0, `removed for ${JSON.stringify(bad)}`);
    assert.equal(host.children.length, 0);
  }
  const before = created.length;
  assert.doesNotThrow(() => renderRankLine(null, { line: "L", fresh: true }));
  assert.equal(created.length, before, "nothing built for a null host");
});

test("(R5) SOURCE: renderCombatOver calls renderRankLine(over, window.__mzPlacement) on the line directly after the renderNewBestBlock call", () => {
  const region = fnRegion("function renderCombatOver(host, kind, opts = {})");
  const lines = region.split("\n").map((l) => l.trim()).filter(Boolean);
  const i = lines.indexOf('if (kind === "dead") renderNewBestBlock(over, window.__mzDeathRecord);');
  assert.ok(i !== -1, "the renderNewBestBlock call site is still there");
  assert.equal(lines[i + 1], 'if (kind === "dead") renderRankLine(over, window.__mzPlacement);');
  assert.equal(occurrences(HTML, "renderRankLine(over, window.__mzPlacement);"), 1);
  assert.equal(occurrences(HTML, "function renderRankLine"), 1);
});

test("(R6) SOURCE: renderRankLine builds DOM with createElement/textContent only (no innerHTML)", () => {
  const region = fnRegion("function renderRankLine(host, placement)");
  assert.doesNotMatch(region, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(region, /document\.createElement\("p"\)/);
  assert.match(region, /\.textContent = /);
});

test("(R7) CSS: .cb-over-rank has a rule; [data-fresh=\"1\"] animates with mwrankin, defined once; the blanket reduced-motion rule is intact", () => {
  const rule = CODE.match(/\.cb-over-rank\{([^}]*)\}/);
  assert.ok(rule, ".cb-over-rank rule");
  assert.match(rule[1], /#e8c97a/);
  assert.match(rule[1], /var\(--mono\)/);
  const fresh = CODE.match(/\.cb-over-rank\[data-fresh="1"\]\{([^}]*)\}/);
  assert.ok(fresh, "fresh rule");
  assert.match(fresh[1], /animation:\s*mwrankin 600ms ease-out/);
  assert.equal(occurrences(CODE, "@keyframes mwrankin"), 1);
  assert.match(CODE, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
  assert.equal(occurrences(CODE, "prefers-reduced-motion:reduce"), 1, "no second reduced-motion rule");
});

test("(R8) SOURCE: the module resets window.__mzPlacement to null in the bridge init and in showTitleScreen", () => {
  const init = sliceBetween(MODULE, "window.__mzDeathRecord = null;", "window.mzRailLine = ");
  assert.match(init, /window\.__mzPlacement = null;/);
  const title = sliceBetween(MODULE, "function showTitleScreen({ allowResume } = {}) {", "screen.hidden = false;");
  assert.match(title, /window\.__mzPlacement = null;/);
});

test("(R9) REGISTRY: __mzPlacement is registered as a module-owned presentation bridge naming its consumers", () => {
  const entry = BRIDGE.__mzPlacement;
  assert.ok(entry, "registered");
  assert.equal(entry.owner, "mazeworld.html (module)");
  const consumers = entry.consumers.join(" ");
  assert.match(consumers, /renderCombatOver/);
  assert.match(consumers, /renderRankLine/);
  assert.match(consumers, /handlePgsFlush/);
  assert.match(consumers, /showTitleScreen/);
  assert.match(entry.purpose, /never a field on state/);
});

test("(R10) no S.placement field is ever assigned in the shell", () => {
  assert.doesNotMatch(CODE, /\bS\.(placement|rank|pgs\w*)\b/);
});
