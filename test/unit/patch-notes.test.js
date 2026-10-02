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

// Phase 92.2: what a player's bests record looks like once they have played: a run held and ranked.
const PLAYED_BESTS = JSON.stringify({
  v: 1,
  runs: { ["a".repeat(64)]: { hash: "a".repeat(64) } },
  boards: { deep: ["a".repeat(64)], days: [], kills: [], purse: [] },
  last: null,
});

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
  // Phase 92.2: the bests record must hold a run (an empty one is what a fresh first boot writes, and proves nothing).
  const storage = fakeStorage({ [NOTES_SEEN_KEY]: null, "ddr.bests.v1": PLAYED_BESTS });
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

test("PATCH_NOTES_RELEASES_URL is the public patch-notes page on the website", () => {
  assert.equal(PATCH_NOTES_RELEASES_URL, "https://darktierstudios.com/delve-die-repeat/patch-notes");
});

test("purity: no window/document/localStorage/sessionStorage/navigator identifier and no global fetch; DOM only through host.ownerDocument", () => {
  const code = stripJs(MODULE_SRC);
  for (const banned of [/\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /localStorage|sessionStorage/, /(?<!\.)\bfetch\s*\(/, /\.innerHTML\b/, /addEventListener|\.onclick\b/, /createElement\(\s*["']button/]) {
    assert.doesNotMatch(code, banned, `patchNotes.js must not use ${banned}`);
  }
  assert.match(code, /host\.ownerDocument/);
});

// ─── Phase 92.2 (user 2026-10-02): a fresh install sees no "what's new" ──────
//
// The first boot of a fresh install writes an EMPTY ddr.bests.v1 (the adapter's
// loadBests backfill) before readNotesLaunch reads, so a non-empty string under
// that key used to make a fresh install look like an upgrade and pop the patch
// notes on its very first title. The same rule settings.js applies since 92.1:
// ddr.bests.v1 counts only when it carries a run (or is unreadable).

import { emptyBests } from "../../engine/records.js";
import { getItem as realGetItem, setItem as realSetItem, flush as flushStorage } from "../../src/browser/storage.js";
import { readSettings, SETTINGS_STORAGE_KEY } from "../../src/browser/settings.js";
import { boot as bootAdapter, waitForPending as adapterWaitForPending } from "../../src/browser/engineAdapter.js";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

const realStorage = { getItem: realGetItem, setItem: realSetItem };

test("92.2-01: the exact empty bests record a first boot writes does not make an install 'existing': mark, no sheet", async () => {
  assert.equal(await readNotesLaunch(fakeStorage({ "ddr.bests.v1": JSON.stringify(emptyBests()) }), "2.3.0"), "mark");
  assert.equal(await readNotesLaunch(fakeStorage({ "ddr.bests.v1": "{}" }), "2.3.0"), "mark");
});

test("92.2-01: a REAL first boot (adapter boot, then the settings read) leaves a fresh install marked, never shown", async () => {
  await withFakeLocalStorage(async (store) => {
    await bootAdapter(12345);
    await adapterWaitForPending();
    await flushStorage();
    // The premise of the bug: boot itself wrote ddr.bests.v1 before anything read the notes decision.
    assert.equal(typeof store.get("ddr.bests.v1"), "string", "the first boot writes ddr.bests.v1");
    await readSettings(); // the app reads settings first (mazeworld.html), as it does on every boot
    await flushStorage();
    assert.equal(store.has(SETTINGS_STORAGE_KEY), false, "a fresh install's first boot writes no settings blob, so that key cannot make it look existing");
    assert.equal(await readNotesLaunch(realStorage, "2.3.0"), "mark");
  });
});

test("92.2-01: an upgrade that holds anything a player made still sees the notes (no seen version yet)", async () => {
  const upgrades = {
    "a bests record with runs": { "ddr.bests.v1": PLAYED_BESTS },
    "a bests record with only a ranked board": { "ddr.bests.v1": JSON.stringify({ v: 1, runs: {}, boards: { deep: ["h"], days: [], kills: [], purse: [] }, last: null }) },
    "an unreadable bests record": { "ddr.bests.v1": "{not json" },
    "an empty bests record plus a graveyard": { "ddr.bests.v1": JSON.stringify(emptyBests()), "ddr.graveyard.v1": "[{\"x\":1}]" },
    "an empty bests record plus a save": { "ddr.bests.v1": JSON.stringify(emptyBests()), "ddr.delve.v1": "{\"x\":1}" },
    "a stored settings blob": { "ddr.bests.v1": JSON.stringify(emptyBests()), "ddr.settings.v1": JSON.stringify({ movement: "arrows" }) },
    "a save alone": { "ddr.delve.v1": "{\"x\":1}" },
  };
  for (const [label, keys] of Object.entries(upgrades)) {
    assert.equal(await readNotesLaunch(fakeStorage(keys), "2.3.0"), "show", label);
  }
});

test("92.2-01: a 2.2.0 install upgrading to 2.3.0 (a seen version on disk) still sees the notes, whatever its bests hold", async () => {
  for (const bests of [JSON.stringify(emptyBests()), PLAYED_BESTS]) {
    const storage = fakeStorage({ [NOTES_SEEN_KEY]: "2.2.0", "ddr.bests.v1": bests });
    assert.equal(await readNotesLaunch(storage, "2.3.0"), "show");
  }
  assert.equal(await readNotesLaunch(fakeStorage({ [NOTES_SEEN_KEY]: "2.3.0", "ddr.bests.v1": PLAYED_BESTS }), "2.3.0"), "none");
});

test("92.2-01: patchNotes.js and settings.js read ddr.bests.v1 by the one shared rule (bestsHoldsRuns)", () => {
  assert.match(MODULE_SRC, /import \{ bestsHoldsRuns \} from "\.\/settings\.js";/);
  assert.match(MODULE_SRC, /BOOT_WRITTEN_KEY && !bestsHoldsRuns\(value\)/);
});
