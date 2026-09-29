// test/unit/account-copy.test.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1), Plan 03 Task 1 — pins
// content/account.js: every word the account chip, its sheet, the ☰
// block's rows and the three rail cards show. Proves the table is
// deep-frozen pure string data, carries the fixed labels (RE-ROLL HANDLE,
// ERASE MY RUNS, TAP AGAIN TO ERASE, menuLabel.plain "Menu"), the only
// {handle} token sites, no sign-on wording of any kind, and that both the
// voice safety scan and the HP-not-WP scan walk it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACCOUNT_COPY } from "../../content/account.js";
import { BANNED } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "content", "account.js"), "utf8").replace(/\r\n/g, "\n");

/** Every [path, value] leaf of a plain object tree. */
function collectLeaves(obj, pathLabel = "") {
  if (obj === null || typeof obj !== "object") return [[pathLabel, obj]];
  const out = [];
  for (const [k, v] of Object.entries(obj)) out.push(...collectLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  return out;
}

/** Every nested object in the tree, the root included. */
function collectObjects(obj, pathLabel = "ACCOUNT_COPY") {
  if (obj === null || typeof obj !== "object") return [];
  const out = [[pathLabel, obj]];
  for (const [k, v] of Object.entries(obj)) out.push(...collectObjects(v, `${pathLabel}.${k}`));
  return out;
}

/** The same recursive string-leaf walk the two scan tests use. */
function walkStrings(obj, pathLabel, push) {
  for (const [k, v] of Object.entries(obj)) {
    const label = `${pathLabel}.${k}`;
    if (typeof v === "string") push(label, v);
    else if (v && typeof v === "object") walkStrings(v, label, push);
  }
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SIGN_ON = /\bsign(s|ed|ing)?[ -]?(in|out)\b/i;
const PLAY_GAMES = /play[ _-]?games/i;

// ─── shape ──────────────────────────────────────────────────────────────────

test("ACCOUNT_COPY is deep-frozen", () => {
  for (const [p, o] of collectObjects(ACCOUNT_COPY)) assert.ok(Object.isFrozen(o), `${p} should be frozen`);
});

test("ACCOUNT_COPY holds only non-empty strings (no functions, numbers or nulls)", () => {
  const leaves = collectLeaves(ACCOUNT_COPY);
  assert.ok(leaves.length > 15, `expected a full copy table, got ${leaves.length} leaves`);
  for (const [p, v] of leaves) {
    assert.equal(typeof v, "string", `${p} should be a string, got ${typeof v}`);
    assert.ok(v.length > 0, `${p} should be non-empty`);
  }
});

test("ACCOUNT_COPY carries every fixed key and value the plan pins", () => {
  assert.equal(ACCOUNT_COPY.glyph, "?");
  assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.chipLabel).sort(), ["off", "on", "pending"]);
  assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.menuLabel).sort(), ["on", "plain"]);
  assert.equal(ACCOUNT_COPY.menuLabel.plain, "Menu");
  const s = ACCOUNT_COPY.sheet;
  for (const k of ["title", "pending", "compete", "on", "off", "onHelp", "offHelp", "reroll", "erase", "eraseArmed", "erasing", "settings"]) {
    assert.equal(typeof s[k], "string", `sheet.${k}`);
  }
  assert.deepStrictEqual(Object.keys(s.status).sort(), ["off", "on", "pending"]);
  assert.equal(s.compete, "COMPETE");
  assert.equal(s.on, "ON");
  assert.equal(s.off, "OFF");
  assert.equal(s.reroll, "RE-ROLL HANDLE");
  assert.equal(s.erase, "ERASE MY RUNS");
  assert.equal(s.eraseArmed, "TAP AGAIN TO ERASE");
  assert.equal(s.settings, "SETTINGS");
  assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.cards).sort(), ["eraseFailed", "erased", "welcome"]);
  for (const kind of ["welcome", "erased", "eraseFailed"]) {
    assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.cards[kind]).sort(), ["line", "title"]);
  }
});

test("the only {token} in the table is {handle}, and it appears in exactly chipLabel.on, menuLabel.on, cards.welcome.line and cards.erased.line", () => {
  const tokenLeaves = [];
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    for (const m of v.matchAll(/\{([a-zA-Z]+)\}/g)) {
      assert.equal(m[1], "handle", `${p} has an unknown token {${m[1]}}`);
      tokenLeaves.push(p);
    }
  }
  assert.deepStrictEqual([...new Set(tokenLeaves)].sort(), ["cards.erased.line", "cards.welcome.line", "chipLabel.on", "menuLabel.on"]);
  assert.doesNotMatch(ACCOUNT_COPY.menuLabel.plain, /\{handle\}/);
  assert.doesNotMatch(ACCOUNT_COPY.cards.eraseFailed.line, /\{handle\}/);
});

test("no leaf carries angle brackets, a WP word, a sign-in/sign-out form or Play-Games wording", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    assert.doesNotMatch(v, /[<>]/, `${p} must carry no markup`);
    assert.doesNotMatch(v, /(?<![\w.$-])(wp|WP)(?![\w:])/, `${p} must not say WP`);
    assert.doesNotMatch(v, SIGN_ON, `${p} must not offer a sign-in/out`);
    assert.doesNotMatch(v, PLAY_GAMES, `${p} must not name a third-party account service`);
  }
});

test("cards.welcome.line names {handle}, the public board and turning Compete off from the menu", () => {
  const c = ACCOUNT_COPY.cards.welcome;
  assert.ok(c.title.length > 0);
  assert.match(c.line, /\{handle\}/);
  assert.match(c.line, /board/i);
  assert.match(c.line, /Compete/);
});

test("cards.erased.line names {handle} and says the runs are off the board", () => {
  const c = ACCOUNT_COPY.cards.erased;
  assert.match(c.line, /\{handle\}/);
  assert.match(c.line, /board/i);
});

test("cards.eraseFailed carries no token and reads as a failure, not a success", () => {
  const c = ACCOUNT_COPY.cards.eraseFailed;
  assert.doesNotMatch(c.line, /\{handle\}/);
  assert.ok(c.title.length > 0 && c.line.length > 0);
});

test("offHelp says nothing leaves the phone and that Compete must be on to reach the board (and so to erase)", () => {
  const help = ACCOUNT_COPY.sheet.offHelp;
  assert.match(help, /leaves this phone/i);
  assert.match(help, /Compete must be on/i);
  assert.match(help, /erase/i);
});

test("No line says WP as a word", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) assert.doesNotMatch(v, /(?<![\w.$-])(wp|WP)(?![\w:])/, p);
});

// ─── source: the fixed phrases appear exactly once, and no retired wording ──

test("the fixed labels appear exactly once each in the source", () => {
  for (const phrase of ["RE-ROLL HANDLE", "ERASE MY RUNS", "TAP AGAIN TO ERASE"]) {
    const count = MODULE_SRC.split(phrase).length - 1;
    assert.equal(count, 1, `"${phrase}" should appear exactly once, found ${count}`);
  }
});

test("source: no Play-Games or sign-in/sign-out wording anywhere in the file, including comments", () => {
  assert.doesNotMatch(MODULE_SRC, PLAY_GAMES);
  assert.doesNotMatch(MODULE_SRC, SIGN_ON);
});

// ─── scan registration ─────────────────────────────────────────────────────

test("The safety scan and the HP-not-WP scan both import and walk ACCOUNT_COPY", () => {
  for (const rel of ["test/voice/safety-scan.test.js", "test/unit/hp-not-wp.test.js"]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    assert.match(src, /import\s*\{[^}]*\bACCOUNT_COPY\b[^}]*\}\s*from\s*"\.\.\/\.\.\/content\/account\.js"/, `${rel} imports ACCOUNT_COPY`);
    const uses = src.split("ACCOUNT_COPY").length - 1;
    assert.ok(uses >= 2, `${rel} should import AND walk ACCOUNT_COPY (found ${uses} mentions)`);
  }
});

test("A banned word planted in a copy of the table is caught by the scan walk", () => {
  const planted = structuredClone(ACCOUNT_COPY);
  const term = BANNED[0];
  planted.cards.eraseFailed.line = `${planted.cards.eraseFailed.line} ${term}`;
  const re = new RegExp("\\b" + escapeRegExp(term) + "\\b", "i");
  const hits = [];
  walkStrings(planted, "ACCOUNT_COPY", (label, s) => { if (re.test(s)) hits.push(label); });
  assert.deepStrictEqual(hits, ["ACCOUNT_COPY.cards.eraseFailed.line"]);
  // ...and the real table is clean under the same walk.
  const clean = [];
  walkStrings(ACCOUNT_COPY, "ACCOUNT_COPY", (label, s) => { if (re.test(s)) clean.push(label); });
  assert.deepStrictEqual(clean, []);
});
