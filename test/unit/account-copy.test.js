// test/unit/account-copy.test.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — pins
// content/account.js: every word the account chip, its sheet, the ☰ block's
// rows and the rail cards show. Proves the table is deep-frozen pure string
// data, carries the fixed labels (SIGN IN WITH PLAY GAMES, ERASE MY RUNS, TAP
// AGAIN TO ERASE, menuLabel.plain "Menu"), the only {name} token sites, no
// re-roll or rolled-handle wording, and that both the voice safety scan and
// the HP-not-WP scan walk it.

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
const WP_WORD = /(?<![\w.$-])(wp|WP)(?![\w:])/;
const ROLLED = /re-?roll|rolling your handle|rolled handle|@handle|\bhandle\b/i;

// ─── shape ──────────────────────────────────────────────────────────────────

test("ACCOUNT_COPY is deep-frozen", () => {
  for (const [p, o] of collectObjects(ACCOUNT_COPY)) assert.ok(Object.isFrozen(o), `${p} should be frozen`);
});

test("ACCOUNT_COPY holds only non-empty strings (no functions, numbers or nulls)", () => {
  const leaves = collectLeaves(ACCOUNT_COPY);
  assert.ok(leaves.length > 20, `expected a full copy table, got ${leaves.length} leaves`);
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
  for (const k of ["title", "pending", "compete", "on", "off", "onHelp", "offHelp", "signin", "signingIn", "erase", "eraseArmed", "erasing", "settings"]) {
    assert.equal(typeof s[k], "string", `sheet.${k}`);
  }
  assert.equal("reroll" in s, false, "no re-roll row (D-11)");
  assert.deepStrictEqual(Object.keys(s.status).sort(), ["off", "on", "pending", "signedOut", "signingIn", "unavailable"]);
  assert.equal(s.compete, "COMPETE");
  assert.equal(s.on, "ON");
  assert.equal(s.off, "OFF");
  assert.equal(s.signin, "SIGN IN WITH PLAY GAMES");
  assert.equal(s.erase, "ERASE MY RUNS");
  assert.equal(s.eraseArmed, "TAP AGAIN TO ERASE");
  assert.equal(s.settings, "SETTINGS");
  assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.cards).sort(), ["eraseFailed", "erased", "signinFailed", "signinNeeded", "signinUnavailable", "welcome"]);
  for (const kind of ["welcome", "erased", "eraseFailed", "signinNeeded", "signinUnavailable", "signinFailed"]) {
    assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.cards[kind]).sort(), ["line", "title"]);
  }
});

test("the only {token} in the table is {name}, and it appears in exactly chipLabel.on, menuLabel.on, cards.welcome.line and cards.erased.line", () => {
  const tokenLeaves = [];
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    for (const m of v.matchAll(/\{([a-zA-Z]+)\}/g)) {
      assert.equal(m[1], "name", `${p} has an unknown token {${m[1]}}`);
      tokenLeaves.push(p);
    }
  }
  assert.deepStrictEqual([...new Set(tokenLeaves)].sort(), ["cards.erased.line", "cards.welcome.line", "chipLabel.on", "menuLabel.on"]);
  assert.doesNotMatch(ACCOUNT_COPY.menuLabel.plain, /\{name\}/);
  assert.doesNotMatch(ACCOUNT_COPY.cards.eraseFailed.line, /\{name\}/);
  assert.doesNotMatch(ACCOUNT_COPY.cards.signinNeeded.line, /\{name\}/);
  assert.doesNotMatch(ACCOUNT_COPY.cards.signinUnavailable.line, /\{name\}/);
  assert.doesNotMatch(ACCOUNT_COPY.cards.signinFailed.line, /\{name\}/);
});

test("92.1-01: the two sign-in failure cards give a plain reason and say nothing is lost", () => {
  const u = ACCOUNT_COPY.cards.signinUnavailable;
  const f = ACCOUNT_COPY.cards.signinFailed;
  assert.match(u.line, /not available/i);
  assert.match(u.line, /nothing is lost/i);
  assert.match(f.line, /did not sign you in/i);
  assert.match(f.line, /wait here, safe/i);
  assert.notEqual(u.title, f.title);
});

test("no leaf carries angle brackets, a WP word, or rolled-handle / re-roll wording", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    assert.doesNotMatch(v, /[<>]/, `${p} must carry no markup`);
    assert.doesNotMatch(v, WP_WORD, `${p} must not say WP`);
    assert.doesNotMatch(v, ROLLED, `${p} must not talk about rolling or a handle`);
  }
});

test("the Play Games sign-in wording is present where the plan needs it", () => {
  const s = ACCOUNT_COPY.sheet;
  assert.match(s.signin, /PLAY GAMES/);
  assert.match(s.onHelp, /Play Games/);
  assert.match(s.offHelp, /Play Games/);
  assert.match(ACCOUNT_COPY.cards.welcome.line, /Play Games/);
  assert.match(ACCOUNT_COPY.cards.signinNeeded.line, /SIGN IN/);
  assert.match(s.status.signedOut, /NOT SIGNED IN/);
});

test("cards.welcome.line names {name}, the Play Games name, the public board and turning Compete off from the menu", () => {
  const c = ACCOUNT_COPY.cards.welcome;
  assert.ok(c.title.length > 0);
  assert.match(c.line, /\{name\}/);
  assert.match(c.line, /Play Games name/);
  assert.match(c.line, /everyone|public/i);
  assert.match(c.line, /board/i);
  assert.match(c.line, /Compete/);
  assert.match(c.line, /menu/i);
});

test("cards.erased.line names {name} and says the runs are off the board", () => {
  const c = ACCOUNT_COPY.cards.erased;
  assert.match(c.line, /\{name\}/);
  assert.match(c.line, /board/i);
});

test("cards.eraseFailed carries no token and reads as a failure, not a success", () => {
  const c = ACCOUNT_COPY.cards.eraseFailed;
  assert.doesNotMatch(c.line, /\{name\}/);
  assert.ok(c.title.length > 0 && c.line.length > 0);
});

test("cards.signinNeeded says runs are waiting and that SIGN IN is in the menu", () => {
  const c = ACCOUNT_COPY.cards.signinNeeded;
  assert.match(c.title + " " + c.line, /waiting|queued/i);
  assert.match(c.line, /SIGN IN/);
  assert.match(c.line, /menu/i);
});

test("onHelp says deaths go on the board under the Play Games name", () => {
  const help = ACCOUNT_COPY.sheet.onHelp;
  assert.match(help, /board/i);
  assert.match(help, /Play Games name/);
});

test("offHelp says nothing leaves the phone, Compete off means no Play Games sign-in, and Compete must be on to reach the board (and so to erase)", () => {
  const help = ACCOUNT_COPY.sheet.offHelp;
  assert.match(help, /leaves this phone/i);
  assert.match(help, /no Play Games sign-in/i);
  assert.match(help, /Compete must be on/i);
  assert.match(help, /erase/i);
});

test("No line says WP as a word", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) assert.doesNotMatch(v, WP_WORD, p);
});

// ─── source: the fixed phrases appear exactly once, and no retired wording ──

test("the fixed labels appear exactly once each in the source", () => {
  for (const phrase of ["SIGN IN WITH PLAY GAMES", "ERASE MY RUNS", "TAP AGAIN TO ERASE"]) {
    const count = MODULE_SRC.split(phrase).length - 1;
    // The sign-in label is also named once in the signinNeeded card line.
    const expected = phrase === "SIGN IN WITH PLAY GAMES" ? 3 : 1;
    assert.ok(count >= 1 && count <= expected, `"${phrase}" should appear at most ${expected} times, found ${count}`);
  }
});

test("source: no re-roll or rolled-handle wording anywhere in the file, including comments", () => {
  assert.doesNotMatch(MODULE_SRC, /re-?roll/i);
  assert.doesNotMatch(MODULE_SRC, /\{handle\}/);
  assert.doesNotMatch(MODULE_SRC, /ensureHandle/);
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
