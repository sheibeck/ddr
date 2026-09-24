// test/unit/account-copy.test.js
//
// Phase 67 (ACCT-01/02), 67-03 Task 1 — pins content/account.js: every word
// the account chip, its sheet and its two rail cards show. Proves the table
// is deep-frozen pure string data, carries the exact D-10 status lines, the
// D-03 helper line, the D-04 welcome and D-11 failure card lines and the D-07
// glyph, and that both the voice safety scan and the HP-not-WP scan walk it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACCOUNT_COPY } from "../../content/account.js";
import { BANNED } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Every [path, value] leaf of a plain object tree (arrays included). */
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

test("The only {token} in the table is {name}, and it appears in chipLabel.signedIn and menuLabel.signedIn", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    for (const m of v.matchAll(/\{([a-zA-Z]+)\}/g)) assert.equal(m[1], "name", `${p} has an unknown token {${m[1]}}`);
  }
  assert.match(ACCOUNT_COPY.chipLabel.signedIn, /\{name\}/);
  assert.match(ACCOUNT_COPY.menuLabel.signedIn, /\{name\}/);
  assert.doesNotMatch(ACCOUNT_COPY.menuLabel.plain, /\{name\}/);
});

test("menuLabel is the ☰ button's accessible label pair (Phase 70 D-03)", () => {
  assert.ok(Object.isFrozen(ACCOUNT_COPY.menuLabel));
  assert.deepStrictEqual({ ...ACCOUNT_COPY.menuLabel }, {
    signedIn: "Menu — signed in as {name}",
    plain: "Menu",
  });
});

test("glyph is the dim question mark (D-07)", () => {
  assert.equal(ACCOUNT_COPY.glyph, "?");
});

test("chipLabel has signedIn, signedOut, pending and off, each distinct", () => {
  const keys = ["signedIn", "signedOut", "pending", "off"];
  assert.deepStrictEqual(Object.keys(ACCOUNT_COPY.chipLabel).sort(), [...keys].sort());
  assert.equal(new Set(keys.map((k) => ACCOUNT_COPY.chipLabel[k])).size, 4);
});

test("sheet.status carries the exact D-10 identity lines", () => {
  assert.deepStrictEqual({ ...ACCOUNT_COPY.sheet.status }, {
    signedIn: "PLAY GAMES · SIGNED IN",
    signedOut: "PLAY GAMES · SIGNED OUT",
    pending: "PLAY GAMES · SIGNING IN",
    off: "PLAY GAMES · COMPETE OFF",
  });
});

test("sheet carries every row label the D-10 sheet draws", () => {
  const s = ACCOUNT_COPY.sheet;
  for (const k of ["title", "nobody", "unnamed", "signIn", "signingIn", "stopCompeting", "stopHelp", "offHelp", "compete", "on", "off", "settings"]) {
    assert.equal(typeof s[k], "string", `sheet.${k}`);
  }
  assert.equal(s.title, "PLAY GAMES");
  assert.equal(s.signIn, "SIGN IN");
  assert.equal(s.signingIn, "SIGNING IN…");
  assert.equal(s.stopCompeting, "STOP COMPETING");
  assert.equal(s.compete, "COMPETE");
  assert.equal(s.on, "ON");
  assert.equal(s.off, "OFF");
  assert.equal(s.settings, "SETTINGS");
});

test("stopHelp points at the Play Games app for a real disconnect (D-03)", () => {
  assert.match(ACCOUNT_COPY.sheet.stopHelp, /Play Games app/);
});

test("offHelp says nothing leaves the phone", () => {
  assert.match(ACCOUNT_COPY.sheet.offHelp, /leaves this phone/i);
});

test("No line words Stop competing, or anything else, as signing out (D-03)", () => {
  const signOutish = /sign(ed|ing)?[\s-]?out|log(ged|ging)?[\s-]?out/i;
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) {
    if (p === "chipLabel.signedOut" || p === "sheet.status.signedOut") continue; // honest state names, not actions
    assert.doesNotMatch(v, signOutish, `${p} must not offer a sign-out: "${v}"`);
  }
  assert.doesNotMatch(ACCOUNT_COPY.sheet.stopCompeting, /sign|log|disconnect/i);
});

test("cards.welcome mentions the public record and Compete (D-04)", () => {
  const c = ACCOUNT_COPY.cards.welcome;
  assert.ok(c.title.length > 0);
  assert.match(c.line, /public record/i);
  assert.match(c.line, /Compete/);
});

test("cards.failed says the game stays playable and offers retrying and Compete off (D-11)", () => {
  const c = ACCOUNT_COPY.cards.failed;
  assert.ok(c.title.length > 0);
  assert.match(c.line, /playable/i);
  assert.match(c.line, /try again/i);
  assert.match(c.line, /Compete off/);
});

test("cards.failed points at the menu in the corner, not the retired band-2 face (Phase 70 DISC-4)", () => {
  const line = ACCOUNT_COPY.cards.failed.line;
  assert.ok(line.endsWith("turn Compete off, from the menu in the corner."), line);
  assert.equal(
    line,
    "Sign-in failed, or was declined. You stay unrecorded and fully playable. Try again, or turn Compete off, from the menu in the corner.",
  );
});

test("No line says WP; player text says HP", () => {
  for (const [p, v] of collectLeaves(ACCOUNT_COPY)) assert.doesNotMatch(v, /(?<![\w.$-])(wp|WP)(?![\w:])/, p);
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
  planted.cards.failed.line = `${planted.cards.failed.line} ${term}`;
  const re = new RegExp("\\b" + escapeRegExp(term) + "\\b", "i");
  const hits = [];
  walkStrings(planted, "ACCOUNT_COPY", (label, s) => { if (re.test(s)) hits.push(label); });
  assert.deepStrictEqual(hits, ["ACCOUNT_COPY.cards.failed.line"]);
  // ...and the real table is clean under the same walk.
  const clean = [];
  walkStrings(ACCOUNT_COPY, "ACCOUNT_COPY", (label, s) => { if (re.test(s)) clean.push(label); });
  assert.deepStrictEqual(clean, []);
});
