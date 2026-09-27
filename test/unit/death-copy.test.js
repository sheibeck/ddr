// test/unit/death-copy.test.js
//
// VOX-05 / ROLL-04 (Plan 79-06): the guard on the lines a player reads when a
// run ends — content/epitaphs.js's CAUSE_TEXT (the "{name}, {race} {sub},
// {cause}." line on the death card) and EPITAPHS (the line under it).
//
//   1. Coverage: every cause the engine can pass to die() (found by scanning
//      the die( call sites in engine/*.js, not by a hand list) has a
//      CAUSE_TEXT entry and a non-empty EPITAPHS bucket.
//   2. Tokens: every template's {tokens} are a subset of what its fill
//      supplies (death.js fills CAUSE_TEXT from { foe } and EPITAPHS from
//      epitaphCtx), CAUSE_TEXT_TOKENS matches CAUSE_TEXT exactly, and a
//      filled template never shows a raw "{" or "undefined".
//   3. ROLL-04: the trap epitaph states the roll-high avoid range, read from
//      the engine's own springTrap (a plain hero's winning d20 faces through
//      facesRangeText), and no line states a bare face count as a need.
//   4. Family-friendly: no line names a diagnosis (the Pilfer ruling's word
//      list, built by concatenation as pilfer-fumble.test.js does) or a
//      content/safety-wordlist.js term, and the insanity cause is never
//      framed as self-harm.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { EPITAPHS, CAUSE_TEXT, CAUSE_TEXT_TOKENS } from "../../content/epitaphs.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { epitaphCtx } from "../../engine/death.js";
import { springTrap } from "../../engine/encounters.js";
import { facesRangeText } from "../../src/browser/rollRange.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENGINE_DIR = join(ROOT, "engine");

const TOKEN_RE = /\{(\w+)\}/g;
const tokensOf = (s) => [...s.matchAll(TOKEN_RE)].map((m) => m[1]);
const fill = (s, ctx) => s.replace(TOKEN_RE, (_, k) => (ctx[k] !== undefined ? String(ctx[k]) : ""));

/** Every string literal passed as die()'s cause argument across engine/*.js. */
function engineDeathCauses() {
  const causes = new Set();
  for (const file of readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".js"))) {
    const src = readFileSync(join(ENGINE_DIR, file), "utf8");
    for (const m of src.matchAll(/\bdie\(\s*\w+\s*,\s*([^,]+),/g)) {
      for (const lit of m[1].matchAll(/"(\w+)"/g)) causes.add(lit[1]);
    }
  }
  return causes;
}

/** A sample death: every epitaphCtx token has a real value. */
function sampleState() {
  return {
    c: { name: "Brannoc", sub: "Knight", race: "Human", gold: 1234, sp: 210.4, motive: "Revenge", level: 2 },
    floor: { depth: 3 },
    day: 4,
  };
}

const allLines = () => [
  ...Object.entries(CAUSE_TEXT).map(([k, v]) => [`CAUSE_TEXT.${k}`, v]),
  ...Object.entries(EPITAPHS).flatMap(([k, arr]) => arr.map((v, i) => [`EPITAPHS.${k}.${i}`, v])),
];

test("death copy: every cause the engine passes to die() has a CAUSE_TEXT entry and an epitaph bucket", () => {
  const causes = engineDeathCauses();
  // the scan itself must see the known set (a regex that silently finds
  // nothing would pass every check below)
  for (const known of ["combat", "trap", "starve", "fall", "gorge", "maze", "insanity", "abandon", "potion", "backfire", "summon", "quake", "entombed", "pilferFumble", "scrollFumble"]) {
    assert.ok(causes.has(known), `the die( scan should find "${known}"`);
  }
  for (const cause of causes) {
    assert.equal(typeof CAUSE_TEXT[cause], "string", `CAUSE_TEXT.${cause} is missing`);
    assert.ok(CAUSE_TEXT[cause].trim().length > 0, `CAUSE_TEXT.${cause} is empty`);
    assert.ok(Array.isArray(EPITAPHS[cause]) && EPITAPHS[cause].length > 0, `EPITAPHS.${cause} is missing or empty`);
  }
});

test("death copy: CAUSE_TEXT tokens are exactly CAUSE_TEXT_TOKENS and only {foe}; filled lines show no raw token or undefined", () => {
  assert.deepEqual(Object.keys(CAUSE_TEXT_TOKENS).sort(), Object.keys(CAUSE_TEXT).sort());
  for (const [cause, template] of Object.entries(CAUSE_TEXT)) {
    const toks = tokensOf(template);
    assert.deepEqual([...new Set(toks)].sort(), [...CAUSE_TEXT_TOKENS[cause]].sort(), `CAUSE_TEXT.${cause} tokens`);
    for (const t of toks) assert.equal(t, "foe", `CAUSE_TEXT.${cause} uses {${t}}, which die() never fills`);
    const out = fill(template, { foe: "Ghoul" });
    assert.ok(!out.includes("{") && !out.includes("undefined"), `CAUSE_TEXT.${cause} renders "${out}"`);
  }
});

test("death copy: every EPITAPHS token is one epitaphCtx supplies; filled lines show no raw token or undefined", () => {
  const ctx = epitaphCtx(sampleState(), "Ghoul");
  const supplied = new Set(Object.keys(ctx));
  for (const [cause, bank] of Object.entries(EPITAPHS)) {
    bank.forEach((template, i) => {
      for (const t of tokensOf(template)) {
        assert.ok(supplied.has(t), `EPITAPHS.${cause}.${i} uses {${t}}, which epitaphCtx never supplies`);
      }
      const out = fill(template, ctx);
      assert.ok(!out.includes("{") && !out.includes("undefined"), `EPITAPHS.${cause}.${i} renders "${out}"`);
    });
  }
});

test("ROLL-04: the trap epitaph states the engine's roll-high avoid range on a d20", () => {
  // Read the winning faces off springTrap itself for a plain hero (no
  // Acrobat bonus, not a Thief): rollCheck reads a raw draw r as 21 − r.
  const avoid = [];
  for (let face = 1; face <= 20; face++) {
    let first = true;
    const rng = { d: () => (first ? ((first = false), 21 - face) : 1), pick: (a) => a[0] };
    const state = { c: { cls: "Fighter", sub: "Knight", wp: 1000, skills: [], worn: {}, items: [] }, floor: { depth: 1 } };
    const ev = springTrap(state, rng, []);
    if (ev[0].type === "trapAvoided") avoid.push(face);
  }
  assert.ok(avoid.length > 0 && avoid.includes(20), "a plain hero dodges a trap on the top faces");
  const range = facesRangeText(avoid.length, 20);
  assert.equal(range, "16–20", "the plain-hero trap dodge is 16–20 on a d20 (re-pin both if the rule moves)");
  const stated = EPITAPHS.trap.filter((l) => /d20/.test(l));
  assert.ok(stated.length > 0, "one trap epitaph states the dodge roll");
  for (const line of stated) {
    assert.ok(line.includes(`${range} on a d20`), `trap epitaph should state ${range} on a d20: "${line}"`);
  }
});

test("ROLL-04: no death line states a bare face count as the roll it needed", () => {
  for (const [key, line] of allLines()) {
    assert.doesNotMatch(line, /\bneed(?:s|ed|ing)? an? \d+\b/i, `${key} states a bare face count: "${line}"`);
    assert.doesNotMatch(line, /\b1[–-][1-9]\d? on a d\d+ avoids\b/i, `${key} states a roll-under avoid range: "${line}"`);
  }
});

// Built by concatenation on purpose, as pilfer-fumble.test.js does: this file
// never spells one of these out whole.
const DIAGNOSIS_TERMS = [
  ["A", "D", "H", "D"].join(""),
  ["attention", " ", "deficit"].join(""),
  ["klepto", "mania"].join(""),
  ["hoarding", " ", "disorder"].join(""),
  ["O", "C", "D"].join(""),
  ["obsessive", "-", "compulsive"].join(""),
  ["impulse", " ", "control", " ", "disorder"].join(""),
  ["neuro", "divergent"].join(""),
  ["a", "u", "t", "i", "s", "t", "i", "c"].join(""),
];

test("family-friendly: no death line names a diagnosis or a safety-wordlist term", () => {
  const allow = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const banned = BANNED.map((t) => new RegExp("\\b" + esc(t) + "\\b", "i"));
  for (const [key, line] of allLines()) {
    const lower = line.toLowerCase();
    for (const term of DIAGNOSIS_TERMS) {
      assert.ok(!new RegExp("\\b" + esc(term.toLowerCase()) + "\\b").test(lower), `${key} names a diagnosis`);
    }
    for (const re of banned) {
      const m = line.match(re);
      assert.ok(!m || allow.has(m[0].toLowerCase()), `${key} carries a banned term: "${line}"`);
    }
  }
});

test("family-friendly: the insanity cause and its epitaphs are never framed as self-harm", () => {
  const lines = [CAUSE_TEXT.insanity, ...EPITAPHS.insanity];
  for (const line of lines) {
    assert.doesNotMatch(line, /\bown hand\b|\bwith themselves\b|\bthemselves\b|\bhimself\b|\bherself\b/i, `self-harm framing: "${line}"`);
  }
  // it still names what ended the run
  assert.match(CAUSE_TEXT.insanity, /madness/i);
});
