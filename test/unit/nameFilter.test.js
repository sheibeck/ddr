// test/unit/nameFilter.test.js
//
// Phase 91.2-02 Task 3 (D-08). src/browser/nameFilter.js: the matcher that
// flags a Play Games name containing a word on the family-friendly safety
// list (content/safety-wordlist.js). The test never inlines a banned word: it
// picks terms from the list at runtime, and it reads its own source and the
// module's to prove neither one spells a banned term out.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { nameTokens, nameFlagged } from "../../src/browser/nameFilter.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const allowed = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const letters = (t) => t.replace(/[^a-z]/g, "");
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const SINGLE_WORDS = BANNED.filter((t) => /^[a-z]+$/.test(t) && !allowed.has(t));
const LONG_WORDS = SINGLE_WORDS.filter((t) => t.length >= 4);
const PHRASES = BANNED.filter((t) => /\s/.test(t));

test("nameTokens: lowercase tokens split on non-letters, camelCase and letter/digit boundaries", () => {
  assert.deepEqual(nameTokens("MossKnuckle99"), ["moss", "knuckle", "99"]);
  assert.deepEqual(nameTokens("dev_delver"), ["dev", "delver"]);
  assert.deepEqual(nameTokens("Dev Delver"), ["dev", "delver"]);
  assert.deepEqual(nameTokens("xX_Grim-Spoon_Xx"), ["x", "x", "grim", "spoon", "xx"]);
  assert.deepEqual(nameTokens("HTTPServer2go"), ["http", "server", "2", "go"]);
  assert.deepEqual(nameTokens("  --  "), []);
});

test("nameTokens: non-strings give []", () => {
  for (const bad of [null, undefined, 7, {}, [], true]) assert.deepEqual(nameTokens(bad), []);
});

test("the safety list has the shapes this test relies on", () => {
  assert.ok(SINGLE_WORDS.length > 50);
  assert.ok(LONG_WORDS.length > 50);
  assert.ok(PHRASES.length >= 1);
});

test("a name whose token equals any BANNED term is flagged, whatever its length", () => {
  for (const term of SINGLE_WORDS) {
    assert.equal(nameFlagged(cap(term)), true, `token: ${term.length} letters`);
    assert.equal(nameFlagged(`Grim ${term.toUpperCase()}`), true, `upper: ${term.length} letters`);
    assert.equal(nameFlagged(`x_${term}_9`), true, `punctuated: ${term.length} letters`);
  }
  for (const phrase of PHRASES) {
    assert.equal(nameFlagged(phrase), true, "phrase");
    assert.equal(nameFlagged(`The ${phrase.replace(/\s+/g, "_")} Kid`), true, "phrase, joined");
  }
});

test("a name embedding a BANNED term of 4+ letters inside other letters is flagged", () => {
  for (const term of LONG_WORDS) {
    assert.equal(nameFlagged(`Xx${cap(term)}Xx`), true, `camel: ${term.length} letters`);
    assert.equal(nameFlagged(`zz${term}zz`), true, `fused: ${term.length} letters`);
    assert.equal(nameFlagged(`${term.split("").join(".")}`), true, `dotted: ${term.length} letters`);
  }
});

test("a short BANNED term does not flag a name that merely embeds it (only 4+ letters embed)", () => {
  const shorts = SINGLE_WORDS.filter((t) => t.length <= 3);
  for (const term of shorts) {
    // Surrounded by letters that cannot form a longer banned term, and with
    // no token boundary: a name like "ZqxqTERMqxqZ".
    assert.equal(nameFlagged(`Zqx${term}qxZ`), false, `embedded short term of ${term.length} letters`);
  }
});

test("a banned term inside a longer ALLOWLIST word is not flagged; a token equal to an allowlisted word is not flagged", () => {
  // The real list: every allowlisted word, alone and embedded.
  for (const word of ALLOWLIST) {
    assert.equal(nameFlagged(cap(word)), false, "allowlisted token");
    assert.equal(nameFlagged(`Sir ${cap(word)} Rex`), false, "allowlisted token in a name");
  }
  // Injected lists: a made-up banned term explained by a made-up longer word.
  const lists = { banned: ["zork"], allowlist: ["zorkmid"] };
  assert.equal(nameFlagged("Zorkmid", lists), false);
  assert.equal(nameFlagged("The Zorkmid Collector", lists), false);
  assert.equal(nameFlagged("Zork", lists), true);
  assert.equal(nameFlagged("xxzorkxx", lists), true);
  assert.equal(nameFlagged("zorkmid zork", lists), true, "an unexplained occurrence still flags");
  assert.equal(nameFlagged("xxzorkmidxx", lists), false);
});

test("ordinary names are not flagged", () => {
  for (const ok of ["Dev Delver", "MossKnuckle", "Grim Spoon", "Aldric Vane", "Sir Reginald III", "Bog_Witch_77", "xX_Delver_Xx", "Müller", "Zoë Ørsted", "Thistle", "x".repeat(64)]) {
    assert.equal(nameFlagged(ok), false, ok);
  }
});

test("non-strings and empty names are not flagged", () => {
  for (const bad of [null, undefined, 3, {}, [], "", "   ", "___"]) assert.equal(nameFlagged(bad), false);
});

test("diacritics and case do not hide a term", () => {
  const term = LONG_WORDS[0];
  const accented = term.replace(/[aeiou]/, (v) => ({ a: "ä", e: "é", i: "í", o: "ö", u: "ü" })[v]);
  assert.equal(nameFlagged(accented), true);
  assert.equal(nameFlagged(term.toUpperCase()), true);
});

test("no literal banned term of 4+ letters appears in nameFilter.js or in this test", () => {
  const files = [path.join(REPO_ROOT, "src", "browser", "nameFilter.js"), path.join(__dirname, "nameFilter.test.js")];
  const terms = BANNED.filter((t) => letters(t).length >= 4);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      assert.equal(re.test(text), false, `${path.basename(file)} spells out a banned term (#${BANNED.indexOf(term)})`);
    }
  }
});

test("nameFilter.js imports only the safety list and exports no copy", async () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "nameFilter.js"), "utf8").replace(/\r\n/g, "\n");
  const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l));
  assert.equal(imports.length, 1);
  assert.match(imports[0], /safety-wordlist\.js/);
  const mod = await import("../../src/browser/nameFilter.js");
  assert.deepEqual(Object.keys(mod).sort(), ["nameFlagged", "nameTokens"]);
});
