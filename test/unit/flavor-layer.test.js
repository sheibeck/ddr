// test/unit/flavor-layer.test.js
//
// Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05; CONTEXT 'Data shape and guards'
// tests one and two, and 'Tone'): the player layer is complete and number-free,
// so rules cannot creep back into it. Table-driven over FLAVOR_DOMAINS, so
// Phase 96 only appends a domain. Since 95-08 a domain whose map is missing
// fails by name: the layer is complete (11 domains, 144 entries) and every
// per-domain test runs.
//
// Per domain: every content key has a non-empty line, the map has no key
// outside the content keys. Per line: no digit, no percent sign, no die token
// and no number word (except "one", so "no one" stays legal); one sentence of
// at most 100 characters; unique across the whole layer; never equal to its
// own rules text; a spell line never starts with its niche label.
//
// Phase 96 (FLAVOR-03; CONTEXT 'Shape'): the identity domains (race, sub,
// class) get their own shape rule: one or two sentences, at most 200
// characters, NFC and no astral character. The number rule is unchanged and
// strict for every domain. Every other domain keeps the one-sentence rule.
//
// The number-word list is a per-file copy of WORD_NUM in
// test/unit/item-text-engine.test.js (never imported across tests).

import test from "node:test";
import assert from "node:assert/strict";

import { FLAVOR_DOMAINS, everyFlavorLine } from "../../src/browser/flavorText.js";
import { SPELLS, POTIONS, TOOLS, TOOL_ORDER, BAG_ITEMS, JEWELRY, CLOAKS, STAVES, NICHE_LABELS } from "../../content/index.js";
import { RACE_NOTE, CLASS_NOTE, SUB_NOTE } from "../../content/flavor.js";

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
// The per-domain shape rule (TEXT-LAYERS.md step 4). The length unit is the
// JavaScript string length (UTF-16 code units); for the identity rule the NFC
// and no-astral checks make that equal to the character count.
const DEFAULT_RULE = Object.freeze({ max: MAX_LEN, minMarks: 1, maxMarks: 1, encoding: false });
const IDENTITY_RULE = Object.freeze({ max: 200, minMarks: 1, maxMarks: 2, encoding: true });
const RULE_OF = { race: IDENTITY_RULE, sub: IDENTITY_RULE, class: IDENTITY_RULE };
const ruleOf = (id) => RULE_OF[id] || DEFAULT_RULE;

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

/** shapeProblems(line, rule) — the sentence count and length of `rule`, tidy. */
function shapeProblems(line, rule = DEFAULT_RULE) {
  const out = [];
  if (typeof line !== "string" || !line) return ["not a non-empty string"];
  if (line.length > rule.max) out.push(`longer than ${rule.max} (${line.length})`);
  const marks = (line.match(/[.!?]/g) || []).length;
  if (marks < rule.minMarks || marks > rule.maxMarks || !/[.!?]$/.test(line)) {
    out.push(rule.maxMarks === 1 ? "not exactly one sentence ending the line" : `not ${rule.minMarks} to ${rule.maxMarks} sentences ending the line`);
  }
  if (rule.encoding) {
    if (line !== line.normalize("NFC")) out.push("not NFC");
    if ([...line].length !== line.length) out.push("astral character");
  }
  if (line !== line.trim()) out.push("leading or trailing space");
  if (/ {2}/.test(line)) out.push("doubled space");
  return out;
}

const problemsOf = (line, rule = DEFAULT_RULE) => [...numberProblems(line), ...shapeProblems(line, rule)];

/** missingMaps(domains) — "<exportName> (<module>)" for every domain whose map is not a non-null object. */
function missingMaps(domains) {
  return domains.filter((d) => { const m = d.lines(); return !m || typeof m !== "object"; }).map((d) => `${d.exportName} (${d.module})`);
}

/** mapOf(d) — the domain's map, failing by name when it is missing. */
function mapOf(d) {
  const m = d.lines();
  assert.ok(m && typeof m === "object", `${d.exportName} (${d.module}) is not exported: every domain must export its map (95-08)`);
  return m;
}

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
  // Phase 96 (FLAVOR-03): the identity notes a blurb must differ from
  race: RACE_NOTE,
  sub: SUB_NOTE,
  class: CLASS_NOTE,
};
const NICHE_OF = Object.fromEntries(SPELLS.map((s) => [s.n, NICHE_LABELS[s.niche]]));

// ---------------------------------------------------------------------------
// the shape of the layer, pinned now (keys come from content)
// ---------------------------------------------------------------------------

test("the layer has eleven domains covering 144 content keys", () => {
  // Phase 96 (FLAVOR-03): declared re-pin, race (6), sub-class (24) and class (3) added to the 111
  assert.equal(FLAVOR_DOMAINS.length, 11);
  assert.equal(FLAVOR_DOMAINS.reduce((n, d) => n + d.keys().length, 0), 144);
  for (const d of FLAVOR_DOMAINS) assert.ok(d.id && d.module && d.exportName, `${d.id}: id, module and exportName`);
});

test("the layer is complete: all 11 domains export their map, 144 entries", () => {
  // Phase 96 (FLAVOR-03): declared re-pin, race (6), sub-class (24) and class (3) added to the 111
  assert.equal(FLAVOR_DOMAINS.length, 11);
  assert.deepEqual(missingMaps(FLAVOR_DOMAINS), [], "every domain must export its map (95-08)");
  assert.equal(FLAVOR_DOMAINS.reduce((n, d) => n + Object.keys(d.lines()).length, 0), 144);
  assert.equal(everyFlavorLine().length, 144);
});

test("teeth: a domain whose map is missing is named by the completeness check", () => {
  const spell = FLAVOR_DOMAINS.find((d) => d.id === "spell");
  assert.deepEqual(missingMaps([{ ...spell, lines: () => undefined }]), ["SPELL_FLAVOR (content/spells.js)"]);
  assert.deepEqual(missingMaps([{ ...spell, lines: () => null }]), ["SPELL_FLAVOR (content/spells.js)"]);
  assert.deepEqual(missingMaps([{ ...spell, lines: () => ({}) }]), []);
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

test("teeth: the identity rule allows two sentences and 200 units, nothing else changes", () => {
  const two = `${"A tall tale told at length, ".repeat(3)}ends here. And then a second sentence closes the line, which is rather the point.`;
  assert.ok(two.length > 100 && two.length <= 200, `fixture length ${two.length}`);
  assert.deepEqual(shapeProblems(two, IDENTITY_RULE), [], "a two-sentence line passes the identity rule");
  assert.ok(shapeProblems(two, DEFAULT_RULE).length > 0, "and fails the default rule");
  assert.ok(shapeProblems(`${"x".repeat(200)}.`, IDENTITY_RULE).some((p) => p.includes("longer than 200")), "201 units fails");
  assert.deepEqual(shapeProblems(`${"x".repeat(199)}.`, IDENTITY_RULE), [], "200 units passes");
  assert.ok(shapeProblems("One. Two. Three.", IDENTITY_RULE).length > 0, "three sentences fail");
  assert.ok(shapeProblems("Cafe\u0301 is a decomposed accent.", IDENTITY_RULE).includes("not NFC"), "a decomposed accent fails");
  assert.ok(shapeProblems("A grin \u{1F600} is astral.", IDENTITY_RULE).includes("astral character"), "an astral character fails");
  assert.deepEqual(shapeProblems("Caf\u00e9 is composed.", IDENTITY_RULE), [], "a composed accent passes");
  // the default rule is exactly Phase 95's
  assert.deepEqual(shapeProblems("Closes wounds the polite way.", DEFAULT_RULE), []);
  assert.deepEqual([RULE_OF.race, RULE_OF.sub, RULE_OF.class].map((r) => r.max), [200, 200, 200]);
  assert.equal(ruleOf("spell"), DEFAULT_RULE);
  assert.equal(ruleOf("race"), IDENTITY_RULE);
  assert.equal(ruleOf("sub"), IDENTITY_RULE);
  // numbers stay strict in an identity line
  assert.ok(numberProblems("Hits for two.").length > 0);
});

// ---------------------------------------------------------------------------
// per domain: complete, no orphans, every line number-free and one sentence
// ---------------------------------------------------------------------------

for (const d of FLAVOR_DOMAINS) {
  test(`${d.id}: every content key has a non-empty flavour line and there is no orphan key`, () => {
    const m = mapOf(d);
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

  test(`${d.id}: no flavour line states a number, a die or a percentage`, () => {
    const m = mapOf(d);
    for (const [k, line] of Object.entries(m)) assert.deepEqual(numberProblems(line), [], `${d.exportName}["${k}"]: ${line}`);
  });

  test(`${d.id}: every flavour line is tidy and within its domain's sentence and length rule (${ruleOf(d.id).max} max)`, () => {
    const m = mapOf(d);
    for (const [k, line] of Object.entries(m)) assert.deepEqual(shapeProblems(line, ruleOf(d.id)), [], `${d.exportName}["${k}"]: ${line}`);
  });

  test(`${d.id}: no flavour line repeats its rules text or opens with its niche label`, () => {
    const m = mapOf(d);
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
    const m = mapOf(d);
    for (const [k, line] of Object.entries(m)) {
      const where = `${d.id}/${k}`;
      assert.ok(!seen.has(line), `"${line}" appears at ${seen.get(line)} and ${where}`);
      seen.set(line, where);
    }
  }
});
