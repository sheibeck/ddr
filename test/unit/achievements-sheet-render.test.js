// test/unit/achievements-sheet-render.test.js
//
// Phase 100 (AUI-02, AUI-03), plan 02 task 3: the DOM renderer. Plain, ordered
// DOM that TalkBack reads row by row; expandable tracks; secrets that reveal
// nothing; no raw HTML, no timers, no scrolling.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { emptyRecord, sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { achievementIconSrc } from "../../src/browser/achievementCard.js";
import { ACHIEVEMENTS_SHEET_COPY, buildAchievementsView, renderAchievementsSheet } from "../../src/browser/achievementsSheet.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MODULE_SRC = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "achievementsSheet.js"), "utf8").replace(/\r\n/g, "\n");

const HIDDEN = ACHIEVEMENTS.filter((e) => e.initialState === "Hidden");
const rec = (over) => sanitizeRecord({ v: 1, ...over });
const T_A = Date.UTC(2026, 9, 1, 12, 0, 0);
const T_B = Date.UTC(2026, 9, 5, 12, 0, 0);

function newHost() {
  const { document } = createRecordingDocument();
  return document.createElement("div");
}

function walk(node, fn) {
  fn(node);
  for (const child of node.children || []) walk(child, fn);
}

function hasClass(node, cls) {
  return (node.className || "").split(/\s+/).includes(cls);
}

function findAll(root, pred) {
  const out = [];
  walk(root, (n) => {
    if (n.nodeType === 1 && pred(n)) out.push(n);
  });
  return out;
}

const byClass = (root, cls) => findAll(root, (n) => hasClass(n, cls));
const elementChildren = (node) => (node.children || []).filter((c) => c.nodeType === 1);

function render(view, opts) {
  const host = newHost();
  const root = renderAchievementsSheet(host, view, opts);
  return { host, root };
}

function rowByKey(root, key) {
  const row = byClass(root, "mw-ach-row").find((r) => r.getAttribute("data-key") === key);
  assert.ok(row, `row ${key}`);
  return row;
}

const BEASTS_PARTIAL = rec({ kills: { Beasts: 137 }, unlocked: { kills_beasts_t1: T_A, kills_beasts_t2: T_B } });

function beastsKey(view) {
  return view.blocks.flatMap((b) => b.rows).find((r) => r.name === "Body Count: Beasts").key;
}

// --- structure ------------------------------------------------------------------

test("render: the empty-record view is one root with a summary, 7 blocks and 35 rows (14 buttons, 21 plain heads)", () => {
  const view = buildAchievementsView(emptyRecord());
  const { host, root } = render(view);
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0], root);
  assert.equal(root.tagName, "div");
  assert.ok(hasClass(root, "mw-ach"));
  const kids = elementChildren(root);
  assert.ok(hasClass(kids[0], "mw-ach-summary"));
  const paragraphs = elementChildren(kids[0]);
  assert.deepStrictEqual(paragraphs.map((p) => p.tagName), ["p", "p"]);
  assert.ok(hasClass(paragraphs[0], "mw-ach-count"));
  assert.ok(hasClass(paragraphs[1], "mw-ach-secrets"));
  assert.equal(paragraphs[0].textContent, view.earnedText);
  assert.equal(paragraphs[1].textContent, view.secretsText);

  const sections = kids.slice(1);
  assert.equal(sections.length, 7);
  sections.forEach((s, i) => {
    assert.equal(s.tagName, "section");
    assert.ok(hasClass(s, "mw-ach-block"));
    const [h, ul] = elementChildren(s);
    assert.equal(h.tagName, "h3");
    assert.ok(hasClass(h, "mw-ach-block-title"));
    assert.equal(h.textContent, view.blocks[i].title);
    assert.equal(ul.tagName, "ul");
    assert.ok(hasClass(ul, "mw-ach-list"));
    assert.equal(elementChildren(ul).length, view.blocks[i].rows.length);
  });

  const rows = byClass(root, "mw-ach-row");
  assert.equal(rows.length, 35);
  assert.ok(rows.every((r) => r.tagName === "li"));
  const buttons = byClass(root, "mw-ach-head").filter((h) => h.tagName === "button");
  const divs = byClass(root, "mw-ach-head").filter((h) => h.tagName === "div");
  assert.equal(buttons.length, 14);
  assert.equal(divs.length, 21);
  for (const b of buttons) {
    assert.equal(b.getAttribute("type"), "button");
    assert.equal(b.getAttribute("aria-expanded"), "false");
  }
  for (const d of divs) assert.equal(d.getAttribute("aria-expanded"), null);
});

test("render: rows carry data-state, data-kind and data-key from the view", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const { root } = render(view);
  const flat = view.blocks.flatMap((b) => b.rows);
  const rows = byClass(root, "mw-ach-row");
  rows.forEach((li, i) => {
    assert.equal(li.getAttribute("data-state"), flat[i].state);
    assert.equal(li.getAttribute("data-kind"), flat[i].kind);
    assert.equal(li.getAttribute("data-key"), flat[i].key);
  });
});

// --- icons and ladder -------------------------------------------------------------

test("render: every icon is decorative; dim and silhouette classes follow the row", () => {
  const view = buildAchievementsView(rec({ unlocked: { race_human: T_A } }));
  const { root } = render(view);
  const flat = view.blocks.flatMap((b) => b.rows);
  const rows = byClass(root, "mw-ach-row");
  rows.forEach((li, i) => {
    const imgs = byClass(li, "mw-ach-icon");
    assert.equal(imgs.length, 1);
    const img = imgs[0];
    assert.equal(img.tagName, "img");
    assert.equal(img.getAttribute("alt"), "");
    assert.equal(img.getAttribute("aria-hidden"), "true");
    assert.equal(img.getAttribute("src"), flat[i].iconSrc);
    assert.equal(hasClass(img, "mw-ach-icon-dim"), flat[i].dim);
    assert.equal(hasClass(img, "mw-ach-icon-silhouette"), flat[i].silhouette);
  });
  assert.ok(byClass(root, "mw-ach-icon-silhouette").length === 8);
});

test("render: the ladder is aria-hidden with four pips I, II, III, IV", () => {
  const { root } = render(buildAchievementsView(emptyRecord()));
  const ladders = byClass(root, "mw-ach-ladder");
  assert.equal(ladders.length, 14);
  for (const ladder of ladders) {
    assert.equal(ladder.getAttribute("aria-hidden"), "true");
    const pips = elementChildren(ladder);
    assert.deepStrictEqual(pips.map((p) => p.tagName), ["i", "i", "i", "i"]);
    assert.deepStrictEqual(pips.map((p) => p.textContent), ["I", "II", "III", "IV"]);
    assert.ok(pips.every((p) => p.getAttribute("data-state") === "locked"));
  }
  const earned = byClass(render(buildAchievementsView(BEASTS_PARTIAL)).root, "mw-ach-ladder").find((l) => elementChildren(l).some((p) => p.getAttribute("data-state") === "earned"));
  assert.deepStrictEqual(elementChildren(earned).map((p) => p.getAttribute("data-state")), ["earned", "earned", "locked", "locked"]);
});

// --- reading order --------------------------------------------------------------

test("render: a row's spans read name, state, detail, progress, then the hint for a track", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const { root } = render(view);
  const row = rowByKey(root, beastsKey(view));
  const [text] = byClass(row, "mw-ach-text");
  const spans = elementChildren(text);
  assert.deepStrictEqual(
    spans.map((s) => s.className),
    ["mw-ach-name", "mw-ach-state", "mw-ach-detail", "mw-ach-progress", "mw-ach-hint"],
  );
  assert.deepStrictEqual(spans.map((s) => s.textContent), [
    "Body Count: Beasts",
    "2 of 4 tiers earned",
    ACHIEVEMENTS.find((e) => e.id === "kills_beasts_t2").line,
    "137 / 200 kills",
    "Tap for every tier",
  ]);
});

test("render: a plain single row has no hint, no button and no handler", () => {
  const view = buildAchievementsView(rec({ unlocked: { race_human: T_B } }));
  const { root } = render(view);
  const row = byClass(root, "mw-ach-row").find((r) => r.getAttribute("data-kind") === "single" && r.getAttribute("data-state") === "earned");
  assert.equal(byClass(row, "mw-ach-hint").length, 0);
  assert.equal(byClass(row, "mw-ach-ladder").length, 0);
  const head = byClass(row, "mw-ach-head")[0];
  assert.equal(head.tagName, "div");
  assert.equal(head.onclick, null);
  assert.deepStrictEqual(
    elementChildren(byClass(row, "mw-ach-text")[0]).map((s) => s.className),
    ["mw-ach-name", "mw-ach-state", "mw-ach-detail"],
  );
  assert.equal(byClass(row, "mw-ach-state")[0].textContent, "Earned 5 Oct 2026");
});

test("render: a secret row reads only Secret and its teaser", () => {
  const { root } = render(buildAchievementsView(emptyRecord()));
  const row = byClass(root, "mw-ach-row").find((r) => r.getAttribute("data-state") === "secret");
  const spans = elementChildren(byClass(row, "mw-ach-text")[0]);
  assert.deepStrictEqual(spans.map((s) => [s.className, s.textContent]), [
    ["mw-ach-name", "Secret"],
    ["mw-ach-detail", ACHIEVEMENTS_SHEET_COPY.secret.line],
  ]);
});

test("render: spans are separated by a space node so the computed name has word breaks", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const { root } = render(view);
  const [text] = byClass(rowByKey(root, beastsKey(view)), "mw-ach-text");
  const kinds = text.children.map((c) => (c.nodeType === 3 ? c.textContent : "span"));
  assert.deepStrictEqual(kinds, ["span", " ", "span", " ", "span", " ", "span", " ", "span"]);
});

// --- expand ---------------------------------------------------------------------

test("render: expanded inserts the rung list directly after the head inside the same li", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const key = beastsKey(view);
  const collapsed = render(view, { expanded: [] }).root;
  assert.equal(byClass(collapsed, "mw-ach-rungs").length, 0);

  const { root } = render(view, { expanded: [key] });
  const row = rowByKey(root, key);
  const head = byClass(row, "mw-ach-head")[0];
  assert.equal(head.getAttribute("aria-expanded"), "true");
  assert.equal(byClass(row, "mw-ach-hint")[0].textContent, "Tap to fold it away");
  const kids = elementChildren(row);
  // Quick 261005-vhn (declared re-pin): this track has earned tiers, so its icon
  // button sits BEFORE the head; the rung list still follows the head directly.
  assert.deepStrictEqual(kids.map((k) => k.className), ["mw-ach-large-open mw-ach-head-open", "mw-ach-head", "mw-ach-rungs"]);
  const rungs = byClass(row, "mw-ach-rung");
  assert.equal(rungs.length, 4);
  const r = view.blocks.flatMap((b) => b.rows).find((x) => x.key === key).rungs;
  rungs.forEach((li, i) => {
    assert.equal(li.tagName, "li");
    const spans = elementChildren(li).filter((c) => c.tagName === "span");
    assert.deepStrictEqual(spans.map((s) => s.className).slice(0, 3), ["mw-ach-rung-name", "mw-ach-rung-state", "mw-ach-rung-text"]);
    assert.equal(spans[0].textContent, r[i].name);
    assert.equal(spans[1].textContent, r[i].stateText);
    assert.equal(spans[2].textContent, r[i].text);
    assert.equal(spans.length, r[i].progressText ? 4 : 3);
  });
  assert.equal(byClass(rungs[0], "mw-ach-rung-state")[0].textContent, "Earned 1 Oct 2026");
  assert.equal(byClass(rungs[2], "mw-ach-rung-state")[0].textContent, "Locked");
  assert.equal(byClass(rungs[2], "mw-ach-rung-progress")[0].textContent, "137 / 200 kills");
});

test("render: expanded accepts a Set, and expanding one row moves no other row", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const key = beastsKey(view);
  const keysOf = (root) => byClass(root, "mw-ach-row").map((r) => r.getAttribute("data-key"));
  const before = render(view, { expanded: new Set() }).root;
  const after = render(view, { expanded: new Set([key]) }).root;
  assert.deepStrictEqual(keysOf(after), keysOf(before));
  assert.equal(byClass(after, "mw-ach-rungs").length, 1);
  const flatChildren = (root) => byClass(root, "mw-ach-list").map((ul) => elementChildren(ul).length);
  assert.deepStrictEqual(flatChildren(after), flatChildren(before));
});

test("render: a track button calls onToggle once with the row key; a missing onToggle never throws", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const key = beastsKey(view);
  const calls = [];
  const { root } = render(view, { expanded: [], onToggle: (k) => calls.push(k) });
  const head = byClass(rowByKey(root, key), "mw-ach-head")[0];
  assert.equal(typeof head.onclick, "function");
  head.onclick();
  assert.deepStrictEqual(calls, [key]);

  for (const opts of [undefined, null, {}, { onToggle: "nope" }, { expanded: "x" }]) {
    const { root: r2 } = render(view, opts);
    const h = byClass(rowByKey(r2, key), "mw-ach-head")[0];
    assert.doesNotThrow(() => h.onclick());
  }
});

test("render: only tracks have handlers", () => {
  const view = buildAchievementsView(emptyRecord());
  const { root } = render(view, { onToggle() {} });
  for (const li of byClass(root, "mw-ach-row")) {
    const head = byClass(li, "mw-ach-head")[0];
    assert.equal(typeof head.onclick === "function", li.getAttribute("data-kind") === "track");
  }
});

// --- order ----------------------------------------------------------------------

test("render: DOM row order equals the view's row order", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const keys = view.blocks.flatMap((b) => b.rows.map((r) => r.key));
  const domKeys = [];
  walk(render(view, { expanded: [beastsKey(view)] }).root, (n) => {
    if (n.nodeType === 1 && n.getAttribute("data-key") !== null) domKeys.push(n.getAttribute("data-key"));
  });
  assert.deepStrictEqual(domKeys, keys);
});

// --- secret leak -----------------------------------------------------------------

test("render: no secret's name, description, line or id reaches any text or attribute but src (all 8 Hidden entries)", () => {
  const view = buildAchievementsView(emptyRecord());
  const { root } = render(view, { expanded: view.blocks.flatMap((b) => b.rows.map((r) => r.key)) });
  const secretRows = byClass(root, "mw-ach-row").filter((r) => r.getAttribute("data-state") === "secret");
  assert.equal(secretRows.length, 8);
  for (const row of secretRows) {
    const seen = [];
    walk(row, (n) => {
      if (n.nodeType === 3) seen.push(n.textContent);
      else {
        seen.push(n.className || "", n.title || "", n.id || "");
        for (const [name, value] of n.attributes) if (name !== "src") seen.push(name, value);
      }
    });
    const blob = seen.join("\n");
    for (const e of HIDDEN) {
      for (const [what, text] of [["name", e.name], ["description", e.description], ["line", e.line], ["id", e.id]]) {
        assert.ok(!blob.includes(text), `a secret row leaks ${e.id} ${what}`);
      }
    }
    assert.ok(row.getAttribute("data-key").match(/^t\d+$/));
    for (const img of byClass(row, "mw-ach-icon")) {
      assert.equal(img.getAttribute("alt"), "");
      assert.equal(img.getAttribute("aria-label"), null);
    }
  }
});

test("render: the whole empty-record tree names no Hidden entry anywhere but in image src", () => {
  const { root } = render(buildAchievementsView(emptyRecord()));
  const seen = [];
  walk(root, (n) => {
    if (n.nodeType === 3) seen.push(n.textContent);
    else for (const [name, value] of n.attributes) if (name !== "src") seen.push(value);
  });
  const blob = seen.join("\n");
  for (const e of HIDDEN) {
    assert.ok(!blob.includes(e.name), e.name);
    assert.ok(!blob.includes(e.id), e.id);
  }
});

// --- edges ----------------------------------------------------------------------

test("render: a second render into the same host leaves exactly one root", () => {
  const host = newHost();
  const view = buildAchievementsView(emptyRecord());
  renderAchievementsSheet(host, view);
  const second = renderAchievementsSheet(host, view);
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0], second);
});

test("render: null, an empty object and a block without rows give an empty root and never throw", () => {
  for (const view of [null, undefined, {}, "x", 5, { blocks: "no" }, { blocks: [{ id: "x", title: "T", rows: [] }] }, { blocks: [null, { rows: null }] }]) {
    const host = newHost();
    let root;
    assert.doesNotThrow(() => {
      root = renderAchievementsSheet(host, view, { expanded: [] });
    });
    assert.equal(host.children.length, 1);
    assert.ok(hasClass(root, "mw-ach"));
    assert.equal(byClass(root, "mw-ach-row").length, 0);
    assert.equal(root.children.length, 0);
  }
});

test("render: a missing host gives null and never throws", () => {
  assert.equal(renderAchievementsSheet(null, buildAchievementsView(emptyRecord())), null);
  assert.equal(renderAchievementsSheet({}, buildAchievementsView(emptyRecord())), null);
});

test("render: markup in a string is text, never parsed", () => {
  const view = { earnedText: "<b>x</b>", secretsText: "y", blocks: [{ id: "a", title: "<i>T</i>", rows: [{ key: "t1", kind: "single", state: "locked", name: "<img src=x onerror=1>", detail: "d", iconSrc: "a.png", dim: true, ladder: [], rungs: [], expandable: false }] }] };
  const { root } = render(view);
  assert.equal(byClass(root, "mw-ach-name")[0].textContent, "<img src=x onerror=1>");
  assert.equal(findAll(root, (n) => n.tagName === "img").length, 1, "only the row's own icon");
  assert.equal(byClass(root, "mw-ach-block-title")[0].textContent, "<i>T</i>");
});

// --- source purity ----------------------------------------------------------------

test("source purity (comment-stripped): DOM only through host.ownerDocument, no raw HTML, no timers, no scrolling", () => {
  const code = stripJs(MODULE_SRC);
  for (const banned of [
    /innerHTML/, /outerHTML/, /insertAdjacentHTML/, /\bwindow\b/, /\bdocument\./, /\bsetTimeout\b/, /\bsetInterval\b/,
    /requestAnimationFrame/, /scrollTo\b/, /scrollIntoView/, /\banimate\(/, /localStorage/, /Date\.now/, /new Date\(\)/, /\bfetch\(/,
  ]) {
    assert.ok(!banned.test(code), `module source must not contain ${banned}`);
  }
  assert.match(code, /host\.ownerDocument/);
  assert.match(code, /createElement/);
  assert.match(code, /createTextNode/);
  assert.match(code, /textContent/);
  assert.match(code, /setAttribute/);
});

test("render: the bank's own hint strings are the only hints", () => {
  const view = buildAchievementsView(emptyRecord());
  const { root } = render(view);
  const hints = new Set(byClass(root, "mw-ach-hint").map((h) => h.textContent));
  assert.deepStrictEqual([...hints], [ACHIEVEMENTS_SHEET_COPY.expand]);
  assert.equal(achievementIconSrc("depth_t1"), byClass(root, "mw-ach-icon")[0].getAttribute("src"));
});
