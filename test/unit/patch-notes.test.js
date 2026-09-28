// test/unit/patch-notes.test.js
//
// Phase 79.3 (NOTES-02), Plan 03 Task 1 — the pure Markdown-subset parser,
// DOM renderer, and D-21's once-per-update auto-show decision.
// src/browser/patchNotes.js must build DOM only through host.ownerDocument
// and reach storage only through an injected `{ getItem, setItem }` (never
// raw localStorage) — the same purity discipline as finalSheet.js
// (test/unit/final-sheet.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  PATCH_NOTES_COPY,
  PATCH_NOTES_RELEASES_URL,
  NOTES_SEEN_KEY,
  NOTES_PRIOR_DATA_KEYS,
  parsePatchNotes,
  renderPatchNotes,
  notesLaunchDecision,
  readNotesLaunch,
  markNotesSeen,
} from "../../src/browser/patchNotes.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { BANNED as SAFETY_BANNED, ALLOWLIST as SAFETY_ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "patchNotes.js"), "utf8").replace(/\r\n/g, "\n");

function renderInto(blocks) {
  const { document } = createRecordingDocument();
  const listeners = [];
  const create = document.createElement;
  document.createElement = (tag) => {
    const node = create(tag);
    node.addEventListener = (...args) => listeners.push(args);
    return node;
  };
  const host = document.createElement("div");
  renderPatchNotes(host, blocks);
  return { host, listeners };
}

function walk(node, fn) {
  fn(node);
  for (const child of node.children || []) walk(child, fn);
}

function textsOf(root) {
  const out = [];
  walk(root, (n) => {
    if (n.nodeType === 3) out.push(n.textContent);
  });
  return out;
}

// ─── parsePatchNotes ────────────────────────────────────────────────────────

test("parsePatchNotes: headings become h1/h2/h3 blocks", () => {
  const blocks = parsePatchNotes("# One\n## Two\n### Three");
  assert.deepStrictEqual(
    blocks.map((b) => [b.type, b.inlines.map((i) => i.text).join("")]),
    [
      ["h1", "One"],
      ["h2", "Two"],
      ["h3", "Three"],
    ],
  );
});

test("parsePatchNotes: consecutive bullets collapse into one ul block; a new ul starts after a break", () => {
  const blocks = parsePatchNotes("- a\n- b\n* c\n\ntext\n\n- d");
  assert.deepStrictEqual(
    blocks.map((b) => b.type),
    ["ul", "p", "ul"],
  );
  assert.deepStrictEqual(
    blocks[0].items.map((inlines) => inlines.map((i) => i.text).join("")),
    ["a", "b", "c"],
  );
  assert.deepStrictEqual(
    blocks[2].items.map((inlines) => inlines.map((i) => i.text).join("")),
    ["d"],
  );
});

test("parsePatchNotes: consecutive non-blank lines join into one paragraph with a space", () => {
  const blocks = parsePatchNotes("line one\nline two\n\nline three");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "p");
  assert.equal(blocks[0].inlines.map((i) => i.text).join(""), "line one line two");
  assert.equal(blocks[1].inlines.map((i) => i.text).join(""), "line three");
});

test("parsePatchNotes: CRLF and a leading BOM are tolerated", () => {
  const md = "﻿# Title\r\n\r\n- item one\r\n- item two\r\n";
  const blocks = parsePatchNotes(md);
  assert.deepStrictEqual(
    blocks.map((b) => b.type),
    ["h1", "ul"],
  );
  assert.equal(blocks[0].inlines[0].text, "Title");
});

test("parsePatchNotes: an empty or non-string input gives []", () => {
  for (const bad of ["", null, undefined, 42, {}, []]) {
    const blocks = parsePatchNotes(bad);
    assert.deepStrictEqual(blocks, []);
  }
});

test("parsePatchNotes: every block and inline array is frozen", () => {
  const blocks = parsePatchNotes("# T\n\n- a\n\npara");
  assert.ok(Object.isFrozen(blocks));
  for (const b of blocks) {
    assert.ok(Object.isFrozen(b));
    if (b.type === "ul") {
      assert.ok(Object.isFrozen(b.items));
      for (const item of b.items) {
        assert.ok(Object.isFrozen(item));
        for (const inline of item) assert.ok(Object.isFrozen(inline));
      }
    } else {
      assert.ok(Object.isFrozen(b.inlines));
      for (const inline of b.inlines) assert.ok(Object.isFrozen(inline));
    }
  }
});

// ─── inline parsing ─────────────────────────────────────────────────────────

test("parsePatchNotes: **bold** becomes a b inline; an unclosed ** stays literal text", () => {
  const bold = parsePatchNotes("para **strong** word")[0].inlines;
  assert.deepStrictEqual(
    bold.map((i) => [i.type, i.text]),
    [
      ["text", "para "],
      ["b", "strong"],
      ["text", " word"],
    ],
  );
  const unclosed = parsePatchNotes("para **oops")[0].inlines;
  assert.deepStrictEqual(unclosed.map((i) => i.type), ["text"]);
  assert.equal(unclosed[0].text, "para **oops");
});

test("parsePatchNotes: [text](https://...) becomes an a inline; a non-https link degrades to plain text", () => {
  const https = parsePatchNotes("see [the notes](https://example.com/x)")[0].inlines;
  assert.deepStrictEqual(
    https.map((i) => [i.type, i.text, i.href]),
    [
      ["text", "see ", undefined],
      ["a", "the notes", "https://example.com/x"],
    ],
  );
  for (const bad of [
    "see [x](javascript:evil)",
    "see [x](http://example.com)",
    "see [x](/relative)",
  ]) {
    const inlines = parsePatchNotes(bad)[0].inlines;
    assert.deepStrictEqual(inlines.map((i) => i.type), ["text", "text"]);
    assert.equal(inlines[1].text, "x");
  }
});

test("parsePatchNotes: an arrow and other Unicode pass through byte-identical", () => {
  const text = "old thing → new thing, – a range, − a minus";
  const inlines = parsePatchNotes(text)[0].inlines;
  assert.equal(inlines.map((i) => i.text).join(""), text);
});

// ─── renderPatchNotes ───────────────────────────────────────────────────────

test("renderPatchNotes: clears the host and appends one div.mw-pn with the expected tag/class per block type", () => {
  const blocks = parsePatchNotes("# H1\n## H2\n### H3\n\npara\n\n- item");
  const { host } = renderInto(blocks);
  assert.equal(host.children.length, 1);
  const root = host.children[0];
  assert.equal(root.tagName, "div");
  assert.equal(root.className, "mw-pn");
  const tags = root.children.map((c) => [c.tagName, c.className]);
  assert.deepStrictEqual(tags, [
    ["h3", "mw-pn-h1"],
    ["h4", "mw-pn-h2"],
    ["h5", "mw-pn-h3"],
    ["p", "mw-pn-p"],
    ["ul", "mw-pn-ul"],
  ]);
  const li = root.children[4].children[0];
  assert.equal(li.tagName, "li");
  assert.equal(li.className, "mw-pn-li");
});

test("renderPatchNotes: bold becomes strong.mw-pn-b; a link becomes a.mw-pn-a with href, target _blank, rel noreferrer", () => {
  const blocks = parsePatchNotes("para **bold** and [link](https://example.com/x)");
  const { host } = renderInto(blocks);
  const p = host.children[0].children[0];
  const strong = p.children.find((c) => c.tagName === "strong");
  assert.equal(strong.className, "mw-pn-b");
  assert.equal(strong.textContent, "bold");
  const a = p.children.find((c) => c.tagName === "a");
  assert.equal(a.className, "mw-pn-a");
  assert.equal(a.getAttribute("href"), "https://example.com/x");
  assert.equal(a.getAttribute("target"), "_blank");
  assert.equal(a.getAttribute("rel"), "noreferrer");
});

test("renderPatchNotes: every rendered text node equals its inline text byte for byte; no innerHTML, no handler, no button", () => {
  const md = "# Title → arrow\n\npara **bold** [x](https://example.com)\n\n- item one\n- item two";
  const blocks = parsePatchNotes(md);
  const { host, listeners } = renderInto(blocks);
  let elements = 0;
  walk(host, (n) => {
    if (n.nodeType === 3) return;
    elements++;
    assert.notEqual(n.tagName, "button");
    assert.equal(n.onclick, null);
    assert.notEqual(n._content.kind, "html");
  });
  assert.ok(elements > 3);
  assert.equal(listeners.length, 0);
  const pool = new Set();
  for (const b of blocks) {
    if (b.type === "ul") for (const item of b.items) for (const i of item) pool.add(i.text);
    else for (const i of b.inlines) pool.add(i.text);
  }
  for (const t of textsOf(host)) assert.ok(pool.has(t), `unexpected text node: ${JSON.stringify(t)}`);
});

test("renderPatchNotes: a bogus block list never throws and produces the empty div.mw-pn", () => {
  for (const bad of [null, undefined, 42, "x", [null, 1, { type: "unknown" }]]) {
    assert.doesNotThrow(() => renderInto(bad));
  }
});

// ─── notesLaunchDecision ────────────────────────────────────────────────────

test("notesLaunchDecision: the same seen version gives none", () => {
  assert.equal(notesLaunchDecision({ bundledVersion: "2.1.0", seenVersion: "2.1.0" }), "none");
});

test("notesLaunchDecision: a different seen version gives show", () => {
  assert.equal(notesLaunchDecision({ bundledVersion: "2.1.0", seenVersion: "2.0.0" }), "show");
});

test("notesLaunchDecision: no seen version with prior data gives show; without, gives mark", () => {
  assert.equal(notesLaunchDecision({ bundledVersion: "2.1.0", seenVersion: null, hadPriorData: true }), "show");
  assert.equal(notesLaunchDecision({ bundledVersion: "2.1.0", seenVersion: null, hadPriorData: false }), "mark");
});

test("notesLaunchDecision: a malformed bundledVersion always gives none", () => {
  for (const bv of ["2.1", "2.1.0.1", "vNext", "", null, undefined, 42]) {
    assert.equal(notesLaunchDecision({ bundledVersion: bv, seenVersion: null, hadPriorData: true }), "none");
  }
});

test("notesLaunchDecision: never throws on a hostile argument", () => {
  for (const bad of [null, undefined, 42, "x", [], { seenVersion: {} }, { bundledVersion: {} }]) {
    assert.doesNotThrow(() => notesLaunchDecision(bad));
  }
});

// ─── readNotesLaunch / markNotesSeen ────────────────────────────────────────

function fakeStorage(values) {
  return {
    calls: [],
    async getItem(key) {
      this.calls.push(key);
      if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
      return null;
    },
  };
}

test("readNotesLaunch: reads NOTES_SEEN_KEY and every NOTES_PRIOR_DATA_KEYS key; a non-empty prior key means show", async () => {
  const storage = fakeStorage({ [NOTES_SEEN_KEY]: null, "ddr.bests.v1": "{}" });
  const decision = await readNotesLaunch(storage, "2.1.0");
  assert.equal(decision, "show");
  assert.ok(storage.calls.includes(NOTES_SEEN_KEY));
  for (const k of NOTES_PRIOR_DATA_KEYS) assert.ok(storage.calls.includes(k));
});

test("readNotesLaunch: a fresh install (no seen version, no prior data) gives mark", async () => {
  const storage = fakeStorage({});
  assert.equal(await readNotesLaunch(storage, "2.1.0"), "mark");
});

test("readNotesLaunch: a stored seen version equal to the bundled version gives none", async () => {
  const storage = fakeStorage({ [NOTES_SEEN_KEY]: "2.1.0" });
  assert.equal(await readNotesLaunch(storage, "2.1.0"), "none");
});

test("readNotesLaunch: a throwing/rejecting getItem, or a missing storage, gives none and never rejects", async () => {
  const throwing = { getItem: () => { throw new Error("boom"); } };
  await assert.doesNotReject(async () => {
    assert.equal(await readNotesLaunch(throwing, "2.1.0"), "none");
  });
  const rejecting = { getItem: () => Promise.reject(new Error("boom")) };
  await assert.doesNotReject(async () => {
    assert.equal(await readNotesLaunch(rejecting, "2.1.0"), "none");
  });
  assert.equal(await readNotesLaunch(null, "2.1.0"), "none");
  assert.equal(await readNotesLaunch(undefined, "2.1.0"), "none");
  assert.equal(await readNotesLaunch({}, "2.1.0"), "none");
});

test("markNotesSeen: calls setItem(NOTES_SEEN_KEY, version); swallows a throwing setItem", async () => {
  const calls = [];
  const storage = { setItem: async (k, v) => calls.push([k, v]) };
  await markNotesSeen(storage, "2.1.0");
  assert.deepStrictEqual(calls, [[NOTES_SEEN_KEY, "2.1.0"]]);

  const throwing = { setItem: () => { throw new Error("boom"); } };
  await assert.doesNotReject(() => markNotesSeen(throwing, "2.1.0"));

  const rejecting = { setItem: () => Promise.reject(new Error("boom")) };
  await assert.doesNotReject(() => markNotesSeen(rejecting, "2.1.0"));

  await assert.doesNotReject(() => markNotesSeen(null, "2.1.0"));
  await assert.doesNotReject(() => markNotesSeen({}, "2.1.0"));
});

// ─── copy / purity ──────────────────────────────────────────────────────────

test("PATCH_NOTES_COPY: frozen with exactly title, pastLink and missing; no BANNED term, no wp/WP", () => {
  assert.ok(Object.isFrozen(PATCH_NOTES_COPY));
  assert.deepStrictEqual(Object.keys(PATCH_NOTES_COPY).sort(), ["missing", "pastLink", "title"]);
  const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
  const escaped = SAFETY_BANNED.filter((w) => !SAFETY_ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bannedRe = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  for (const v of Object.values(PATCH_NOTES_COPY)) {
    assert.doesNotMatch(v, PLAYER_WP, v);
    assert.doesNotMatch(v, bannedRe, v);
  }
});

test("PATCH_NOTES_RELEASES_URL is the public releases page", () => {
  assert.equal(PATCH_NOTES_RELEASES_URL, "https://github.com/sheibeck/ddr/releases");
});

test("purity: no window/document/localStorage/sessionStorage/navigator identifier and no global fetch; DOM only through host.ownerDocument", () => {
  const code = stripJs(MODULE_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /localStorage|sessionStorage/, /(?<!\.)\bfetch\s*\(/, /\.innerHTML\b/, /addEventListener|\.onclick\b/, /createElement\(\s*["']button/]) {
    assert.doesNotMatch(code, banned, `patchNotes.js must not use ${banned}`);
  }
  assert.match(code, /host\.ownerDocument/);
});
