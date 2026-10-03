// test/unit/flavor-layer.test.js
//
// Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05; CONTEXT 'Data shape and guards'
// tests one and two, and 'Tone'): the player layer is complete and number-free,
// so rules cannot creep back into it. Table-driven over FLAVOR_DOMAINS, so
// Phase 96 only appends a domain. Until 95-08 a domain whose map is not
// exported yet is skipped BY NAME (95-08 makes absence a failure).
//
// Per domain: every content key has a non-empty line, the map has no key
// outside the content keys. Per line: no digit, no percent sign, no die token
// and no number word (except "one", so "no one" stays legal); one sentence of
// at most 100 characters; unique across the whole layer; never equal to its
// own rules text; a spell line never starts with its niche label.
//
// The number-word list is a per-file copy of WORD_NUM in
// test/unit/item-text-engine.test.js (never imported across tests).

import test from "node:test";
import assert from "node:assert/strict";

import { FLAVOR_DOMAINS } from "../../src/browser/flavorText.js";
import { SPELLS, POTIONS, TOOLS, TOOL_ORDER, BAG_ITEMS, JEWELRY, CLOAKS, STAVES, NICHE_LABELS } from "../../content/index.js";

// ---------------------------------------------------------------------------
// the predicates
// ---------------------------------------------------------------------------

const WORD_NUM = [
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
  "seventy", "eighty", "ninety", "hundred", "once", "twice", "half", "double",
]; // "one" is deliberately absent: idiom such as "no one" stays legal
const NUMBER_WORD_RE = new RegExp(`\\b(?:${WORD_NUM.join("|")})\\b`, "i");
const DIE_RE = /\bd\d/i;
const MAX_LEN = 100;

/** numberProblems(line) — the reasons `line` states a number, a die or a percentage. */
function numberProblems(line) {
  const out = [];
  if (/\d/.test(line)) out.push("digit");
  if (line.includes("%")) out.push("percent sign");
  if (DIE_RE.test(line)) out.push("die token");
  const w = NUMBER_WORD_RE.exec(line);
  if (w) out.push(`number word "${w[0]}"`);
  return out;
}

/** shapeProblems(line) — one sentence, bounded, tidy. */
function shapeProblems(line) {
  const out = [];
  if (typeof line !== "string" || !line) return ["not a non-empty string"];
  if (line.length > MAX_LEN) out.push(`longer than ${MAX_LEN} (${line.length})`);
  const marks = (line.match(/[.!?]/g) || []).length;
  if (marks !== 1 || !/[.!?]$/.test(line)) out.push("not exactly one sentence ending the line");
  if (line !== line.trim()) out.push("leading or trailing space");
  if (/ {2}/.test(line)) out.push("doubled space");
  return out;
}

const problemsOf = (line) => [...numberProblems(line), ...shapeProblems(line)];

// ---------------------------------------------------------------------------
// the rules text each domain's lines must differ from
// ---------------------------------------------------------------------------

const LOCKPICKS_TXT = "6–10 on d10 against any lock"; // engine/items.js#rollTreasureItem
const byN = (rows) => Object.fromEntries(rows.map((r) => [r.n, r.txt]));
const RULES_TXT = {
  spell: Object.fromEntries(SPELLS.map((s) => [s.n, s.txt])),
  potion: byN(POTIONS),
  tool: { ...Object.fromEntries(TOOL_ORDER.map((k) => [TOOLS[k].n, TOOLS[k].txt])), Lockpicks: LOCKPICKS_TXT },
  bag: byN(Object.values(BAG_ITEMS)),
  magic: byN([...JEWELRY, ...CLOAKS, ...STAVES]),
};
const NICHE_OF = Object.fromEntries(SPELLS.map((s) => [s.n, NICHE_LABELS[s.niche]]));

// ---------------------------------------------------------------------------
// the shape of the layer, pinned now (keys come from content)
// ---------------------------------------------------------------------------

test("the layer has eight domains covering 111 content keys", () => {
  assert.equal(FLAVOR_DOMAINS.length, 8);
  assert.equal(FLAVOR_DOMAINS.reduce((n, d) => n + d.keys().length, 0), 111);
  for (const d of FLAVOR_DOMAINS) assert.ok(d.id && d.module && d.exportName, `${d.id}: id, module and exportName`);
});

// ---------------------------------------------------------------------------
// teeth: the predicates themselves must catch what they claim to
// ---------------------------------------------------------------------------

test("teeth: doctored lines fail the same predicates, the accepted Heal line passes", () => {
  assert.ok(numberProblems("Heals 10 hp.").includes("digit"));
  assert.ok(numberProblems("Works twice a round.").some((p) => p.includes("twice")));
  assert.ok(numberProblems("A 50% chance.").includes("percent sign"));
  assert.ok(numberProblems("Rolls a d6.").includes("die token"));
  assert.ok(numberProblems("Seven stern warnings.").some((p) => p.includes("Seven")));
  assert.deepEqual(numberProblems("Nobody asked, and no one will thank you."), []);
  assert.ok(shapeProblems("Heals you. Mostly.").length > 0, "two sentences");
  assert.ok(shapeProblems("No stop at the end").length > 0, "no ending mark");
  assert.ok(shapeProblems("Ends early. And then more").length > 0, "mark not last");
  assert.ok(shapeProblems(`${"x".repeat(MAX_LEN)}.`).length > 0, "too long");
  assert.ok(shapeProblems(" Leading space.").length > 0);
  assert.ok(shapeProblems("Doubled  space.").length > 0);
  assert.ok(shapeProblems("").length > 0);
  assert.deepEqual(problemsOf("Closes wounds the polite way: quickly, and without asking how you got them."), []);
});

// ---------------------------------------------------------------------------
// per domain: complete, no orphans, every line number-free and one sentence
// ---------------------------------------------------------------------------

for (const d of FLAVOR_DOMAINS) {
  const m = d.lines();
  const skip = m ? false : `${d.exportName} (${d.module}) is not exported yet: its batch has not landed (95-08 makes absence a failure)`;

  test(`${d.id}: every content key has a non-empty flavour line and there is no orphan key`, { skip }, () => {
    const keys = d.keys();
    for (const k of keys) {
      assert.ok(Object.prototype.hasOwnProperty.call(m, k), `${d.exportName}: missing key "${k}"`);
      assert.equal(typeof m[k], "string", `${d.exportName}["${k}"] is a string`);
      assert.ok(m[k].trim().length > 0, `${d.exportName}["${k}"] is empty`);
    }
    const orphans = Object.keys(m).filter((k) => !keys.includes(k));
    assert.deepEqual(orphans, [], `${d.exportName}: keys with no content row`);
    assert.equal(Object.keys(m).length, keys.length);
  });

  test(`${d.id}: no flavour line states a number, a die or a percentage`, { skip }, () => {
    for (const [k, line] of Object.entries(m)) assert.deepEqual(numberProblems(line), [], `${d.exportName}["${k}"]: ${line}`);
  });

  test(`${d.id}: every flavour line is one tidy sentence of at most ${MAX_LEN} characters`, { skip }, () => {
    for (const [k, line] of Object.entries(m)) assert.deepEqual(shapeProblems(line), [], `${d.exportName}["${k}"]: ${line}`);
  });

  test(`${d.id}: no flavour line repeats its rules text or opens with its niche label`, { skip }, () => {
    const rules = RULES_TXT[d.id];
    for (const [k, line] of Object.entries(m)) {
      if (rules && typeof rules[k] === "string") assert.notEqual(line, rules[k], `${d.exportName}["${k}"] equals its rules text`);
      if (d.id === "spell") {
        const label = NICHE_OF[k];
        if (label) assert.ok(!line.toLowerCase().startsWith(label.toLowerCase()), `${d.exportName}["${k}"] starts with its niche label "${label}"`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// across the whole layer
// ---------------------------------------------------------------------------

test("no two flavour lines in the whole layer are equal", () => {
  const seen = new Map();
  for (const d of FLAVOR_DOMAINS) {
    const m = d.lines();
    if (!m) continue;
    for (const [k, line] of Object.entries(m)) {
      const where = `${d.id}/${k}`;
      assert.ok(!seen.has(line), `"${line}" appears at ${seen.get(line)} and ${where}`);
      seen.set(line, where);
    }
  }
});
