// test/unit/rules-layer.test.js
//
// Phase 95 (FLAVOR-05; CONTEXT 'Where the exact numbers live'): the shared
// RULES reveal component. Flavour first, the exact rules one tap away; the
// open state lives in a module-level set (never the DOM, never game state);
// "Always show the rules" renders the body open with no toggle; a row with no
// rules text renders as today.

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  RULES_COPY, setAlwaysRules, alwaysRules, rulesOpen, toggleRulesOpen, clearRulesOpen,
  layerText, mountRules, wrapRow,
} from "../../src/browser/rulesLayer.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

// Copied from test/unit/hp-not-wp.test.js (never imported across tests).
const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

beforeEach(() => {
  setAlwaysRules(false);
  clearRulesOpen();
});

const fresh = () => {
  const { document } = createRecordingDocument();
  return { doc: document, host: document.createElement("div") };
};

test("layerText: flavour leads and the rules go behind the toggle", () => {
  assert.deepEqual(layerText({ flavor: "F", rules: "R" }), { lead: "F", rules: "R" });
});

test("layerText: no flavour means today's text leads and nothing is hidden", () => {
  assert.deepEqual(layerText({ flavor: "", rules: "R" }), { lead: "R", rules: "" });
  assert.deepEqual(layerText({ rules: "R" }), { lead: "R", rules: "" });
  assert.deepEqual(layerText(), { lead: "", rules: "" });
});

test("mountRules: empty rules append nothing and return null", () => {
  const { doc, host } = fresh();
  assert.equal(mountRules(doc, host, { id: "a", name: "A", rules: "" }), null);
  assert.equal(mountRules(doc, host, { id: "a", name: "A", rules: [] }), null);
  assert.equal(mountRules(doc, host, { id: "a", name: "A" }), null);
  assert.equal(host.children.length, 0);
});

test("mountRules: setting off appends the toggle button then a hidden body", () => {
  const { doc, host } = fresh();
  const out = mountRules(doc, host, { id: "spell:Heal", name: "Heal", rules: ["Heals d10.", "Costs 2."], lineClass: "extra" });
  assert.equal(host.children.length, 2);
  const [btn, body] = host.children;
  assert.equal(btn.tagName, "button");
  assert.equal(btn.className, "mw-rules-btn");
  assert.equal(btn.getAttribute("type"), "button");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.getAttribute("aria-label"), "Rules for Heal");
  assert.equal(btn.textContent, RULES_COPY.closed);
  assert.equal(body.className, "mw-rules-body");
  assert.equal(body.id, "mw-rules-spell-Heal");
  assert.equal(btn.getAttribute("aria-controls"), body.id);
  assert.equal(body.hidden, true);
  assert.equal(body.children.length, 2);
  assert.deepEqual(body.children.map((p) => p.textContent), ["Heals d10.", "Costs 2."]);
  for (const p of body.children) {
    assert.equal(p.tagName, "p");
    assert.equal(p.className, "mw-rules-line extra");
  }
  assert.equal(out.button, btn);
  assert.equal(out.body, body);
});

test("mountRules: a string is one entry", () => {
  const { doc, host } = fresh();
  mountRules(doc, host, { id: "x", name: "X", rules: "One line." });
  assert.equal(host.children[1].children.length, 1);
  assert.equal(host.children[1].children[0].className, "mw-rules-line");
});

test("the toggle reveals and hides in place, stops propagation and never renders", () => {
  const { doc, host } = fresh();
  mountRules(doc, host, { id: "k", name: "K", rules: "R" });
  const [btn, body] = host.children;
  let stopped = 0;
  const ev = { stopPropagation() { stopped++; } };
  btn.onclick(ev);
  assert.equal(stopped, 1);
  assert.equal(body.hidden, false);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.equal(btn.textContent, RULES_COPY.open);
  assert.equal(rulesOpen("k"), true);
  btn.onclick(ev);
  assert.equal(stopped, 2);
  assert.equal(body.hidden, true);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.textContent, RULES_COPY.closed);
  assert.equal(rulesOpen("k"), false);
  // an event-less call (a keyboard-synthesised click) is tolerated
  assert.doesNotThrow(() => btn.onclick());
});

test("the open state survives a fresh mount with the same id; another id stays closed", () => {
  const a = fresh();
  mountRules(a.doc, a.host, { id: "same", name: "S", rules: "R" });
  a.host.children[0].onclick({ stopPropagation() {} });
  const b = fresh();
  mountRules(b.doc, b.host, { id: "same", name: "S", rules: "R" });
  assert.equal(b.host.children[1].hidden, false);
  assert.equal(b.host.children[0].getAttribute("aria-expanded"), "true");
  assert.equal(b.host.children[0].textContent, RULES_COPY.open);
  const c = fresh();
  mountRules(c.doc, c.host, { id: "other", name: "O", rules: "R" });
  assert.equal(c.host.children[1].hidden, true);
});

test("always on: only the visible body is mounted, with no toggle", () => {
  setAlwaysRules(true);
  assert.equal(alwaysRules(), true);
  const { doc, host } = fresh();
  const out = mountRules(doc, host, { id: "z", name: "Z", rules: "R" });
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].className, "mw-rules-body");
  assert.equal(host.children[0].hidden, false);
  assert.equal(out.button, null);
});

test("setAlwaysRules only accepts a literal true", () => {
  setAlwaysRules("yes");
  assert.equal(alwaysRules(), false);
  setAlwaysRules(true);
  assert.equal(alwaysRules(), true);
  setAlwaysRules(undefined);
  assert.equal(alwaysRules(), false);
});

test("wrapRow: no rules returns the row itself with no wrapper", () => {
  const { doc } = fresh();
  const row = doc.createElement("button");
  assert.equal(wrapRow(doc, row, { id: "r", name: "R", rules: "" }), row);
  assert.equal(wrapRow(doc, row, { id: "r", name: "R", rules: [] }), row);
  assert.equal(wrapRow(doc, row, { id: "r", name: "R" }), row);
});

test("wrapRow: the toggle is a sibling beside the row, never inside it", () => {
  const { doc } = fresh();
  const row = doc.createElement("button");
  const wrap = wrapRow(doc, row, { id: "r", name: "R", rules: "Rules." });
  assert.equal(wrap.tagName, "div");
  assert.equal(wrap.className, "mw-rules-wrap");
  assert.equal(wrap.children.length, 3);
  assert.equal(wrap.children[0], row);
  assert.equal(wrap.children[1].className, "mw-rules-btn");
  assert.equal(wrap.children[2].className, "mw-rules-body");
  assert.equal(row.children.length, 0);
});

test("wrapRow: always on is the row then the visible body", () => {
  setAlwaysRules(true);
  const { doc } = fresh();
  const row = doc.createElement("div");
  const wrap = wrapRow(doc, row, { id: "r", name: "R", rules: "Rules." });
  assert.equal(wrap.children.length, 2);
  assert.equal(wrap.children[0], row);
  assert.equal(wrap.children[1].className, "mw-rules-body");
  assert.equal(wrap.children[1].hidden, false);
});

test("body ids replace every character outside letters, digits, underscore and hyphen", () => {
  const { doc, host } = fresh();
  mountRules(doc, host, { id: "item: Ring of Power/+1", name: "R", rules: "R" });
  assert.equal(host.children[1].id, "mw-rules-item--Ring-of-Power--1");
  assert.match(host.children[1].id, /^[A-Za-z0-9_-]+$/);
});

test("toggleRulesOpen returns the new state; clearRulesOpen empties the set", () => {
  assert.equal(toggleRulesOpen("q"), true);
  assert.equal(rulesOpen("q"), true);
  assert.equal(toggleRulesOpen("q"), false);
  toggleRulesOpen("q");
  toggleRulesOpen("w");
  clearRulesOpen();
  assert.equal(rulesOpen("q"), false);
  assert.equal(rulesOpen("w"), false);
});

test("RULES_COPY: frozen, and every string leaf is free of WP and the safety wordlist", () => {
  assert.ok(Object.isFrozen(RULES_COPY));
  const leaves = Object.entries(RULES_COPY);
  assert.deepEqual(leaves.map(([k]) => k).sort(), ["closed", "label", "open"]);
  for (const [k, v] of leaves) {
    assert.equal(typeof v, "string", k);
    assert.ok(!PLAYER_WP.test(v), `RULES_COPY.${k} says WP: ${v}`);
    for (const term of BANNED) {
      const m = new RegExp("\\b" + escapeRegExp(term) + "\\b", "i").exec(v);
      if (m && !ALLOW.has(m[0].toLowerCase())) assert.fail(`RULES_COPY.${k} hits banned term "${term}": ${v}`);
    }
  }
});
