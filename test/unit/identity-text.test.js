// test/unit/identity-text.test.js
//
// Phase 91 plan 10 (TEXT-01 for every race and sub-class row, IDENT-11 and
// IDENT-12's blurb guard) — the guard over every identity line a player reads:
//
//   - every generated footer line, every IDENTITY_TRAITS text, every SUB_NOTE,
//     RACE_NOTE and CLASS_NOTE and every RACES note (6 races, 24 sub-classes,
//     3 classes);
//   - the TEXT-01 wording rules (user 2026-09-30): nobody speaks in "faces";
//     a shift reads "+N to hit" or "foes −N to hit you"; a hard cap or a crit
//     range names its range on a d20 ("foes hit you only on a high roll
//     (17–20 on a d20)"); "can talk to X" reads "can always parley with X", and a
//     blurb says what a parley is;
//   - every number in that text is the engine's own, read back through the
//     engine (classNeed, foeToHitVs, foeDie, strikeDie, schoolBonus,
//     spellEffectSquares / Rounds, springTrap, the crit checks in
//     engine/combat.js) and written with src/browser/rollRange.js, so text and
//     engine cannot drift;
//   - the blurb guard (IDENT-12): every id `identityEntries` lists for an
//     identity has a BLURB_ANCHORS phrase its blurb matches (and, for a race,
//     its RACES note matches), and no anchor names an id that is not live, so a
//     new trait cannot land without a line in the blurb, and a blurb never
//     promises an advantage the engine does not apply;
//   - the schools every Magic User sub-class can never learn are named.
//
// The four TEXT-01 probe edges (fallback probes, 91-10-PLAN truths):
//   ADJACENCY  one line holding both a "+N to hit" and a hard cap states both; a
//              count of one reads "+1 to hit", never "+1 faces"; two identities
//              with the same number say it the same way.
//   EMPTY      Human's one neutral line needs no range; an identity with no
//              to-hit rule states no range; an empty or missing blurb fails the
//              guard instead of passing it.
//   ENCODING   a negative is the U+2212 minus and a range the U+2013 en dash; the
//              face / talk-to checks match whole words, any case, so "surface"
//              and "interface" never trip them.
//   ORDERING   footers keep Good then Bad, authored before generated.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  IDENTITY_TRAITS,
  BLURB_ANCHORS,
  MU_CHART,
  RACES,
  CLASSES,
  SPELLS,
  STRIKE_DICE,
  FREE_SKILL,
  SUB_NOTE,
  RACE_NOTE,
  CLASS_NOTE,
} from "../../content/index.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { atLeastFor } from "../../engine/dice.js";
import {
  classNeed,
  weaponNeedMod,
  foeToHitVs,
  foeDie,
  strikeDie,
  schoolBonus,
  schoolAllowed,
  canLearn,
  spellEffectSquares,
  spellEffectRounds,
} from "../../engine/derived.js";
import { springTrap } from "../../engine/encounters.js";
import { newRun } from "../../engine/state.js";
import { identityEntries, footerLines } from "../../src/browser/identityFooter.js";
import { facesRangeText, rangeText, signedText } from "../../src/browser/rollRange.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const RACE_KEYS = Object.keys(RACES);
const SUB_KEYS = Object.values(CLASSES).flatMap((cls) => cls.subs);
const MU_SUBS = CLASSES["Magic User"].subs;
const SCHOOLS = new Set(SPELLS.map((sp) => sp.s));
const ALL = [...RACE_KEYS.map((k) => ["race", k]), ...SUB_KEYS.map((k) => ["sub", k])];

const MINUS = "−"; // U+2212
const EN_DASH = "–"; // U+2013
const D20 = STRIKE_DICE[0];
const range = (faces) => facesRangeText(faces, D20);

const hero = (sub, race = "Human") => newRun(1, [], { force: { sub, race } });
const blurbOf = (kind, key) => (kind === "sub" ? SUB_NOTE[key] : RACE_NOTE[key]);
const noteOf = (kind, key) => (kind === "race" ? RACES[key].note : undefined);

// ─── the checkers (their own edges are tested below) ─────────────────────

/** faceProblems(text) — everything TEXT-01 bans from an identity line. Whole words, any case. */
function faceProblems(text) {
  const out = [];
  if (/\bfaces?\b/i.test(text)) out.push(`says "face(s)": ${text}`);
  if (/\btalks? (?:to|anyone)\b/i.test(text)) out.push(`says "talk to": ${text}`);
  if (/\bsquares of\b/i.test(text)) out.push(`says "squares of": ${text}`);
  return out;
}

/** toHitProblems(text) — every "N to hit" is signed [+−]N with N >= 1, the minus being U+2212. */
function toHitProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\S*?)(\d+) to hit/g)) {
    const sign = m[1].slice(-1);
    if (sign !== "+" && sign !== MINUS) out.push(`unsigned or hyphen-signed to-hit "${m[0]}"`);
    if (Number(m[2]) === 0) out.push(`zero to-hit "${m[0]}"`);
  }
  return out;
}

/** hyphenProblems(text) — a negative number never uses the ASCII hyphen-minus. */
function hyphenProblems(text) {
  return [...String(text).matchAll(/(?:^|[\s(+])-\d/g)].map((m) => `hyphen-minus before a digit "${m[0].trim()}"`);
}

/** rangeProblems(text) — every "N–M on a d20" range uses the en dash, reads low to high and ends on the d20. */
function rangeProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\d+)([^\d\s])?(\d+)? on a d20/g)) {
    const lo = Number(m[1]);
    if (m[2] === undefined) {
      if (lo < 1 || lo > 20) out.push(`range "${m[0]}" is off the d20`);
      continue;
    }
    if (m[2] !== EN_DASH) out.push(`range "${m[0]}" is not written with an en dash`);
    if (!(lo < Number(m[3]))) out.push(`range "${m[0]}" does not read low to high`);
    if (Number(m[3]) !== 20) out.push(`range "${m[0]}" does not end on the d20`);
  }
  return out;
}

/** statedRanges(text) — every "N–20" range a text states on a d20. */
function statedRanges(text) {
  return [...String(text).matchAll(/(\d+–\d+) on a d20/g)].map((m) => m[1]);
}

/**
 * blurbProblems(kind, key, { blurb, note, anchors }) — the IDENT-12 blurb guard on one identity: every live
 * entry id has an anchor its blurb matches (and for a race its RACES note), no anchor is dead, and an empty or
 * missing blurb fails.
 */
function blurbProblems(kind, key, { blurb, note, anchors }) {
  const out = [];
  const ids = identityEntries(kind, key).map((e) => e.id);
  const has = (s) => typeof s === "string" && s.trim().length > 0;
  if (!has(blurb)) out.push(`${key}: the blurb is empty or missing`);
  if (kind === "race" && !has(note)) out.push(`${key}: the RACES note is empty or missing`);
  for (const id of ids) {
    const a = anchors && anchors[id];
    if (!a || !has(a.blurb)) {
      out.push(`${key}: no BLURB_ANCHORS entry for ${id}`);
      continue;
    }
    if (!new RegExp(a.blurb, "i").test(blurb || "")) out.push(`${key}: the blurb does not state ${id} (/${a.blurb}/i)`);
    if (kind === "race") {
      if (!has(a.note)) out.push(`${key}: no RACES note anchor for ${id}`);
      else if (!new RegExp(a.note, "i").test(note || "")) out.push(`${key}: the RACES note does not state ${id} (/${a.note}/i)`);
    }
  }
  for (const id of Object.keys(anchors || {})) {
    if (!ids.includes(id)) out.push(`${key}: BLURB_ANCHORS names ${id}, which is not a live entry`);
  }
  return out;
}

/** every string a player reads about an identity, tagged for the failure message. */
function everyIdentityText() {
  const out = [];
  for (const [kind, key] of ALL) {
    for (const e of identityEntries(kind, key)) out.push({ id: `${kind} ${key} / ${e.id}`, text: e.text });
    for (const line of footerLines(kind, key)) out.push({ id: `${kind} ${key} / footer line`, text: line });
  }
  for (const [k, v] of Object.entries(SUB_NOTE)) out.push({ id: `SUB_NOTE.${k}`, text: v });
  for (const [k, v] of Object.entries(RACE_NOTE)) out.push({ id: `RACE_NOTE.${k}`, text: v });
  for (const [k, v] of Object.entries(CLASS_NOTE)) out.push({ id: `CLASS_NOTE.${k}`, text: v });
  for (const [k, v] of Object.entries(RACES)) out.push({ id: `RACES.${k}.note`, text: v.note });
  return out;
}

// ─── the engine's own numbers ────────────────────────────────────────────

/** The Human foe's need against a Soldier hero: the yardstick every foe-side shift is measured from. */
const FOE_BASE = foeToHitVs(hero("Soldier"));
const foeShift = (sub, race = "Human") => foeToHitVs(hero(sub, race)) - FOE_BASE;

/** The trap dodge's winning range for a hero: a rolled 1 (the best draw) always avoids, and the event names the range. */
function trapRange(sub) {
  const state = hero(sub);
  const rng = { d: () => 1, pick: (a) => a[0], shuffle: (a) => a };
  const ev = springTrap(state, rng, []).find((e) => e.type === "trapAvoided");
  assert.ok(ev, `${sub}: a rolled 1 avoids the trap`);
  return rangeText(ev.atLeast, ev.dieN);
}

/** The crit range a Soldier foe crit and a Ninja's later strike share, read from the engine's own checks. */
function critRange() {
  const combat = stripJs(read("engine/combat.js"));
  assert.match(combat, /atLeastFor\(c\.sub === "Soldier" \? 2 : 1, dieN\)/, "the foe crit on a Soldier is the top two numbers");
  assert.match(combat, /c\.sub === "Ninja" && !opening && roll >= atLeastFor\(2, dieN\)/, "a Ninja's later crit is the top two numbers");
  return rangeText(atLeastFor(2, D20), D20);
}

/**
 * EXPECTED — per entry id, what the engine says the line must state (every token must appear in the entry's text).
 * A function of the identity so the same id on two races reads two numbers.
 */
const EXPECTED = {
  "sub:Guard:guard-hard": () => [`foes ${signedText(foeShift("Guard"))} to hit you`],
  "sub:Soldier:soldier-crit": () => [`${critRange()} on a d20`],
  "sub:Ninja:ninja-crit": () => [`${critRange()} on a d20`, "top two numbers of your strike die"],
  "sub:Cleric:cleric-hit": () => [`${signedText(classNeed({ cls: "Magic User", sub: "Cleric", race: "Human" }) - classNeed({ cls: "Magic User", sub: "Wizard", race: "Human" }))} to hit`, `${range(classNeed({ cls: "Magic User", sub: "Cleric", race: "Human" }))} on a d20`],
  "sub:Acrobat:acrobat-dodge": () => [`foes hit you only on a high roll (${range(foeToHitVs(hero("Acrobat")))} on a d20)`],
  "sub:Acrobat:acrobat-hit": () => [`${range(classNeed({ cls: "Thief", sub: "Acrobat", race: "Human" }))} on a d20`, `${range(classNeed({ cls: "Thief", sub: "Acrobat", race: "Human" }) + weaponNeedMod("Dagger"))} with the dagger`],
  "sub:Acrobat:acrobat-traps": () => [`${trapRange("Acrobat")} on a d20`, `not ${trapRange("Soldier")}`],
  "race:Elven:race-to-hit": () => [`${range(RACES.Elven.toHit)} on a d20`],
  "race:Elven:race-foe-to-hit": () => [`foes ${signedText(foeShift("Soldier", "Elven"))} to hit you`],
  "race:Elven:race-strike-step": () => [`a d${strikeDie({ ...hero("Soldier", "Elven").c, level: 1 })} at level 1, not a d${D20}`],
  "race:Dwarven:race-size-face": () => [`foes ${signedText(foeShift("Soldier", "Dwarven"))} to hit you`],
  "race:Dwarven:race-foe-strike-step": () => [`a d${foeDie({ race: "Dwarven" }, { lvl: 1 })} for a level 1 foe`],
  "race:Troll:race-size-face": () => [`foes ${signedText(foeShift("Soldier", "Troll"))} to hit you`],
};

/** Every d20 range the engine justifies, from the numbers above plus the class bases a blurb may name. */
function allowedRanges() {
  const set = new Set([
    critRange(),
    range(foeToHitVs(hero("Acrobat"))),
    range(classNeed({ cls: "Thief", sub: "Acrobat", race: "Human" })),
    range(classNeed({ cls: "Thief", sub: "Acrobat", race: "Human" }) + weaponNeedMod("Dagger")),
    range(classNeed({ cls: "Magic User", sub: "Cleric", race: "Human" })),
    range(RACES.Elven.toHit),
    trapRange("Acrobat"),
    trapRange("Soldier"),
  ]);
  for (const cls of Object.keys(CLASSES)) set.add(range(CLASSES[cls].toHit));
  return set;
}

// ─── TEXT-01: the wording ────────────────────────────────────────────────

test("TEXT-01: no identity line, trait, blurb, class note or race note says face(s), talk to or squares of", () => {
  const problems = everyIdentityText().flatMap((t) => faceProblems(t.text).map((p) => `${t.id}: ${p}`));
  assert.deepEqual(problems, []);
});

test("TEXT-01: every to-hit shift is signed, negatives are the U+2212 minus, and every d20 range is an en-dash range on the d20", () => {
  const problems = everyIdentityText().flatMap((t) => [...toHitProblems(t.text), ...hyphenProblems(t.text), ...rangeProblems(t.text)].map((p) => `${t.id}: ${p}`));
  assert.deepEqual(problems, []);
});

test("TEXT-01: a line that states a cap or a crit range names that range on a d20 (computed by rollRange from the engine)", () => {
  const needsRange = [
    ["sub", "Acrobat", "acrobat-dodge"],
    ["sub", "Acrobat", "acrobat-hit"],
    ["sub", "Acrobat", "acrobat-traps"],
    ["sub", "Soldier", "soldier-crit"],
    ["sub", "Ninja", "ninja-crit"],
    ["sub", "Cleric", "cleric-hit"],
    ["race", "Elven", "race-to-hit"],
  ];
  for (const [kind, key, id] of needsRange) {
    const e = identityEntries(kind, key).find((x) => x.id === id);
    assert.ok(e, `${key} has ${id}`);
    assert.match(e.text, /\d+–\d+ on a d20|\d+ on a d20/, `${key}/${id}: names its range on a d20: ${e.text}`);
  }
});

test("TEXT-01: the ruled wordings hold (Ninja, Acrobat, Elven, Troll)", () => {
  const text = (kind, key, id) => identityEntries(kind, key).find((x) => x.id === id).text;
  assert.equal(text("sub", "Ninja", "ninja-crit"), `after that, you crit on the top two numbers of your strike die (${critRange()} on a d20)`);
  assert.match(SUB_NOTE.Ninja, /top two numbers of your strike die/);
  assert.match(SUB_NOTE.Ninja, new RegExp(`${critRange()} on a d20`));
  assert.equal(text("sub", "Acrobat", "acrobat-dodge"), `foes hit you only on a high roll (${range(foeToHitVs(hero("Acrobat")))} on a d20)`);
  assert.match(SUB_NOTE.Acrobat, /foes hit you only on a high roll/);
  assert.doesNotMatch(SUB_NOTE.Acrobat, /top four/i);
  assert.equal(text("race", "Elven", "elven-humans"), "can always parley with Humans, +3 on that parley roll");
  assert.match(RACE_NOTE.Elven, /can always parley with Humans/);
  assert.match(RACE_NOTE.Elven, /\+3 on the roll/);
  assert.equal(text("race", "Troll", "race-flat-hp"), "starts with 75 HP whatever the class");
  assert.equal(text("race", "Troll", "race-dmg"), "+11 damage with every weapon (2 of it for being large)");
  assert.match(RACE_NOTE.Troll, /75 starting hit points/);
  assert.match(RACE_NOTE.Troll, /\+11 damage/);
  assert.match(RACE_NOTE.Troll, /Large \+2 inside the 11/);
  assert.match(RACES.Troll.note, /75 hp/);
  assert.match(RACES.Troll.note, /\+11 damage/);
});

test("TEXT-01: the six parley openers say what a parley is in their blurb, and every parley blurb says 'can always parley'", () => {
  const openers = [
    ["race", "Elven", "elven-humans"],
    ["race", "Wilmsry", "wilmsry-talk"],
    ["sub", "Woodsman", "woodsman-talk"],
    ["sub", "Con Artist", "con-artist-talk"],
    ["sub", "Bard", "bard-humans"],
    ["sub", "Court Mage", "court-mage-humans"],
  ];
  for (const [kind, key] of openers) {
    const blurb = blurbOf(kind, key);
    assert.match(blurb, /can always parley/i, `${key}: says can always parley`);
    assert.match(blurb, /talking (?:a fight|it|them) down/i, `${key}: says what a parley is`);
  }
});

test("TEXT-01: a +N to hit and a range sit on one line when the rule has both (Cleric), a count of one is '+1 to hit', and the same number reads the same way", () => {
  const cleric = identityEntries("sub", "Cleric").find((e) => e.id === "cleric-hit").text;
  assert.match(cleric, /^\+1 to hit over other Magic Users \(17–20 on a d20 at level 1\)$/);
  for (const t of everyIdentityText()) assert.doesNotMatch(t.text, /[+−]1 faces/, t.id);
  // two identities with the same number say it the same way
  const text = (kind, key, id) => identityEntries(kind, key).find((e) => e.id === id).text;
  assert.equal(text("sub", "Warlock", "chart-bonus-offense"), text("sub", "Sorcerer", "chart-bonus-offense"));
  assert.equal(text("sub", "Warlock", "chart-bonus-offense"), "+4 to hit with thrown offense spells");
  assert.equal(text("sub", "Wizard", "chart-bonus-offense"), "+3 to hit with thrown offense spells");
  assert.equal(text("sub", "Court Mage", "chart-bonus-offense"), "+2 to hit with thrown offense spells");
  assert.ok(text("race", "Elven", "race-foe-to-hit").startsWith("foes +1 to hit you"));
  assert.ok(text("race", "Troll", "race-size-face").includes("foes +1 to hit you"));
  assert.ok(text("sub", "Guard", "guard-hard").includes("foes −1 to hit you"));
  assert.ok(text("race", "Dwarven", "race-size-face").includes("foes −1 to hit you"));
});

test("TEXT-01 edge (empty): Human's one neutral line needs no range, and an identity with no to-hit rule states no range", () => {
  const human = identityEntries("race", "Human");
  assert.deepEqual(human.map((e) => e.id), ["human-neutral"]);
  assert.doesNotMatch(human[0].text, /d20|to hit/);
  for (const [kind, key] of [["sub", "Knight"], ["sub", "Barbarian"], ["sub", "Warlock"], ["race", "Wilmsry"], ["race", "Fridgian"]]) {
    const joined = [...identityEntries(kind, key).map((e) => e.text), blurbOf(kind, key)].join(" ");
    assert.deepEqual(statedRanges(joined), [], `${key}: no d20 range`);
  }
});

test("TEXT-01 edge (encoding): the face and talk-to checks match whole words in any case, so surface and interface never trip them; negatives and ranges are checked for their characters", () => {
  assert.deepEqual(faceProblems("a rough surface and an interface"), []);
  assert.deepEqual(faceProblems("surfaces"), []);
  assert.notDeepEqual(faceProblems("one face easier"), []);
  assert.notDeepEqual(faceProblems("Your top FACES hit"), []);
  assert.notDeepEqual(faceProblems("you can talk to Humans"), []);
  assert.notDeepEqual(faceProblems("Can Talk To anyone"), []);
  assert.notDeepEqual(faceProblems("squares of enemies"), []);
  assert.deepEqual(faceProblems("can always parley with Humans; can never talk a fight down"), []);
  assert.deepEqual(hyphenProblems("foes −1 to hit you"), []);
  assert.notDeepEqual(hyphenProblems("foes -1 to hit you"), []);
  assert.notDeepEqual(toHitProblems("foes -1 to hit you"), []);
  assert.notDeepEqual(toHitProblems("1 to hit"), []);
  assert.deepEqual(toHitProblems("+1 to hit and foes −2 to hit you"), []);
  assert.deepEqual(rangeProblems("17–20 on a d20"), []);
  assert.notDeepEqual(rangeProblems("17-20 on a d20"), []);
  assert.notDeepEqual(rangeProblems("20–17 on a d20"), []);
});

test("TEXT-01 edge (ordering): a footer reads Good then Bad, authored traits before generated lines, and the authored order is the table's", () => {
  for (const [kind, key] of ALL) {
    const lines = footerLines(kind, key);
    if (key === "Human") {
      assert.equal(lines.length, 1);
      continue;
    }
    assert.equal(lines.length, 2, key);
    assert.match(lines[0], /^Good: /, key);
    assert.match(lines[1], /^Bad: /, key);
    const entries = identityEntries(kind, key);
    const authored = IDENTITY_TRAITS[kind][key];
    const authoredIds = [...authored.good, ...authored.bad].map((t) => t.id);
    assert.deepEqual(entries.slice(0, authoredIds.length).map((e) => e.id), authoredIds, `${key}: authored first, in table order`);
    // inside the authored block every good comes before every bad (the footer prints Good then Bad)
    const authoredSides = entries.slice(0, authoredIds.length).map((e) => e.side);
    assert.deepEqual(authoredSides, [...authoredSides].sort((a, b) => (a === b ? 0 : a === "good" ? -1 : 1)), `${key}: authored goods then bads`);
  }
  // the authored order inside a side is the IDENTITY_TRAITS order, not alphabetical
  assert.deepEqual(identityEntries("sub", "Acrobat").slice(0, 3).map((e) => e.id), ["acrobat-dodge", "acrobat-hit", "acrobat-traps"]);
});

// ─── every number is the engine's ────────────────────────────────────────

test("numbers: every d20 range and shift an identity states is the one the engine computes (footer and, where it anchors the same id, the blurb)", () => {
  for (const [id, fn] of Object.entries(EXPECTED)) {
    const [kind, key, entryId] = id.split(":");
    const e = identityEntries(kind, key).find((x) => x.id === entryId);
    assert.ok(e, `${key} has the entry ${entryId}`);
    for (const token of fn()) assert.ok(e.text.includes(token), `${key}/${entryId}: "${e.text}" must state "${token}"`);
  }
});

test("numbers: a thrown-offense bonus line states the chart's own bonus for every Magic User", () => {
  for (const sub of MU_SUBS) {
    const e = identityEntries("sub", sub).find((x) => x.id === "chart-bonus-offense");
    const bonus = schoolBonus(sub, "offense");
    if (!schoolAllowed(sub, "offense") || bonus <= 0) {
      assert.equal(e, undefined, `${sub}: no offense bonus line`);
      continue;
    }
    assert.equal(e.text, `${signedText(bonus)} to hit with thrown offense spells`, sub);
    assert.match(SUB_NOTE[sub], new RegExp(`${signedText(bonus).replace("+", "\\+")} to hit`), `${sub}: the blurb states the same bonus`);
  }
});

test("numbers: the strike-die and foe-die lines read the dice the engine rolls", () => {
  assert.match(identityEntries("race", "Elven").find((e) => e.id === "race-strike-step").text, /^your strike die is one size smaller \(a d12 at level 1, not a d20\), so you hit more often$/);
  assert.equal(strikeDie({ ...hero("Soldier", "Elven").c, level: 1 }), 12);
  assert.equal(foeDie({ race: "Dwarven" }, { lvl: 1 }), 12);
  assert.match(identityEntries("race", "Dwarven").find((e) => e.id === "race-foe-strike-step").text, /^foes strike on a die one size smaller \(a d12 for a level 1 foe, never below a d8\), so they hit you more often$/);
  assert.equal(foeDie({ race: "Dwarven" }, { lvl: 9 }), 8, "never below a d8");
});

test("numbers: no d20 range in any identity text is a range the engine does not compute", () => {
  const allowed = allowedRanges();
  const bad = [];
  for (const t of everyIdentityText()) {
    for (const r of statedRanges(t.text)) if (!allowed.has(r)) bad.push(`${t.id}: ${r}`);
  }
  assert.deepEqual(bad, []);
});

test("numbers: class notes state the class's own level-1 range (CLASSES.toHit) in the TEXT-01 form", () => {
  const fighter = CLASSES.Fighter.toHit;
  const mu = CLASSES["Magic User"].toHit;
  assert.match(CLASS_NOTE.Fighter, new RegExp(`hit on ${range(fighter)} on the d20 at skill level I`));
  assert.equal((D20 - fighter) / D20, 3 / 4, "three swings in four miss");
  assert.match(CLASS_NOTE.Fighter, /three swings in four hit nothing/);
  assert.match(CLASS_NOTE["Magic User"], new RegExp(`hit only on ${range(mu)} on the d20 at skill level I`));
  assert.equal(D20 - mu, 17);
  assert.match(CLASS_NOTE["Magic User"], /seventeen swings in twenty are decorative/);
});

// ─── the unstated rules the audit closes as stated traits ───────────────

test("91-10 pin: a Cat Burglar, a Ninja and an Acrobat start with their free skill, and the footer names it (generated from FREE_SKILL)", () => {
  assert.deepEqual(FREE_SKILL, { "Cat Burglar": "Dirty Trick", "Acrobat": "Smoke", "Ninja": "Silent Step" });
  for (const [sub, skill] of Object.entries(FREE_SKILL)) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newRun(seed, [], { force: { sub } });
      assert.equal(s.c.skills[skill], 1, `${sub} seed ${seed} starts with ${skill}`);
    }
    const e = identityEntries("sub", sub).find((x) => x.id === "free-skill");
    assert.ok(e, `${sub}: a free-skill line`);
    assert.equal(e.side, "good");
    assert.ok(e.text.includes(skill), e.text);
    assert.ok(SUB_NOTE[sub].includes(skill), `${sub}: the blurb names ${skill}`);
  }
  for (const sub of SUB_KEYS.filter((k) => !(k in FREE_SKILL))) {
    assert.equal(identityEntries("sub", sub).some((x) => x.id === "free-skill"), false, `${sub}: no free skill`);
  }
});

test("91-10 pin: an Acrobat dodges a trap on a wider range than anyone else (acrobat-traps)", () => {
  assert.equal(trapRange("Acrobat"), "13–20");
  assert.equal(trapRange("Soldier"), "16–20");
  const e = identityEntries("sub", "Acrobat").find((x) => x.id === "acrobat-traps");
  assert.equal(e.side, "good");
  assert.ok(e.text.includes("13–20 on a d20") && e.text.includes("not 16–20"), e.text);
});

test("91-10 pin: a Fridgian can never be a Samurai (race-no-samurai), forced or rolled", () => {
  assert.throws(() => newRun(1, [], { force: { race: "Fridgian", sub: "Samurai" } }), /Fridgian Samurai/);
  for (let seed = 1; seed <= 60; seed++) {
    const s = newRun(seed, [], { force: { race: "Fridgian" } });
    assert.notEqual(s.c.sub, "Samurai", `seed ${seed}`);
  }
  const e = identityEntries("race", "Fridgian").find((x) => x.id === "race-no-samurai");
  assert.equal(e.side, "bad");
  assert.match(e.text, /Samurai/);
  assert.match(RACE_NOTE.Fridgian, /Samurai/);
});

test("91-10 pin: a Cleric starts in chain mail and every other Magic User in cloth (cleric-mail, Q2 A)", () => {
  assert.equal(hero("Cleric").c.armor, "Mail");
  for (const sub of MU_SUBS.filter((s) => s !== "Cleric")) assert.equal(hero(sub).c.armor, "Cloth", sub);
  const e = identityEntries("sub", "Cleric").find((x) => x.id === "cleric-mail");
  assert.equal(e.side, "good");
  assert.match(e.text, /chain mail/);
  assert.match(SUB_NOTE.Cleric, /chain mail/);
  assert.doesNotMatch(SUB_NOTE.Cleric, /shield/i, "the game has no shields (user 2026-10-01)");
  assert.doesNotMatch(SUB_NOTE.Woodsman, /shield/i, "the game has no shields (user 2026-10-01)");
});

test("91-10 pin: the Special spells stretch by the chart's own bonus, and the footer says how far (chart-stretch-special)", () => {
  const stretched = SPELLS.filter((sp) => sp.stretch);
  assert.ok(stretched.some((sp) => sp.stretch === "squares") && stretched.some((sp) => sp.stretch === "rounds"));
  const expected = { Sorcerer: [10, 1], Summoner: [10, 1], Illusionist: [40, 4] };
  for (const sub of MU_SUBS) {
    const e = identityEntries("sub", sub).find((x) => x.id === "chart-stretch-special");
    const [sq, rd] = expected[sub] || [0, 0];
    const fly = SPELLS.find((sp) => sp.n === "Fly");
    const stop = SPELLS.find((sp) => sp.n === "Stop Time");
    assert.equal(spellEffectSquares(sub, fly) - fly.act.effect, sq, `${sub}: squares`);
    assert.equal(spellEffectRounds(sub, stop, 0), rd, `${sub}: rounds`);
    if (!sq && !rd) {
      assert.equal(e, undefined, `${sub}: no stretch line`);
      continue;
    }
    assert.equal(e.side, "good", sub);
    assert.ok(e.text.includes(`${sq} squares longer`), `${sub}: ${e.text}`);
    assert.ok(e.text.includes(`${rd} round${rd === 1 ? "" : "s"} longer`), `${sub}: ${e.text}`);
    for (const sp of stretched.filter((x) => x.s === "special")) assert.ok(e.text.includes(sp.n), `${sub}: names ${sp.n}`);
    assert.match(SUB_NOTE[sub], new RegExp(`${sq} squares longer`), `${sub}: the blurb states the same stretch`);
  }
});

test("91-10 pin: only the Apprentice and the Illusionist learn Illusion; the Wizard never does (apprentice-illusion)", () => {
  const illusion = SPELLS.find((sp) => sp.s === "illusion");
  for (const sub of MU_SUBS) assert.equal(canLearn(sub, illusion), sub === "Apprentice" || sub === "Illusionist", sub);
  const e = identityEntries("sub", "Apprentice").find((x) => x.id === "apprentice-illusion");
  assert.equal(e.side, "good");
  assert.match(e.text, /Illusion/);
  assert.match(SUB_NOTE.Apprentice, /may learn Illusion/);
  assert.match(SUB_NOTE.Wizard, /never Illusion/);
});

// ─── IDENT-12: the blurb guard ───────────────────────────────────────────

test("IDENT-12: every identityEntries id of every race and sub-class has a BLURB_ANCHORS phrase its blurb (and a race's note) states, and no anchor is dead", () => {
  const problems = [];
  for (const [kind, key] of ALL) {
    problems.push(...blurbProblems(kind, key, { blurb: blurbOf(kind, key), note: noteOf(kind, key), anchors: BLURB_ANCHORS[kind][key] }));
  }
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.keys(BLURB_ANCHORS.sub).sort(), [...SUB_KEYS].sort(), "an anchor table row for every sub-class");
  assert.deepEqual(Object.keys(BLURB_ANCHORS.race).sort(), [...RACE_KEYS].sort(), "an anchor table row for every race");
});

test("IDENT-12 edge (empty): the guard fails an empty or missing blurb, a missing anchor and a dead anchor instead of passing them", () => {
  const anchors = { "knight-small": { blurb: "under 5 hp" }, "knight-big": { blurb: "20 hit points" } };
  assert.deepEqual(blurbProblems("sub", "Knight", { blurb: "Nothing under 5 hp, and 20 hit points or more.", anchors }), []);
  assert.notDeepEqual(blurbProblems("sub", "Knight", { blurb: "", anchors }), [], "an empty blurb fails");
  assert.notDeepEqual(blurbProblems("sub", "Knight", { blurb: undefined, anchors }), [], "a missing blurb fails");
  assert.notDeepEqual(blurbProblems("sub", "Knight", { blurb: "   ", anchors }), [], "a blank blurb fails");
  assert.ok(blurbProblems("sub", "Knight", { blurb: "Nothing under 5 hp.", anchors }).some((p) => /does not state knight-big/.test(p)), "a blurb that skips a trait fails");
  assert.ok(blurbProblems("sub", "Knight", { blurb: "x", anchors: { "knight-small": anchors["knight-small"] } }).some((p) => /no BLURB_ANCHORS entry for knight-big/.test(p)), "a trait with no anchor fails");
  assert.ok(blurbProblems("sub", "Knight", { blurb: "Nothing under 5 hp, 20 hit points.", anchors: { ...anchors, "knight-ghost": { blurb: "x" } } }).some((p) => /knight-ghost, which is not a live entry/.test(p)), "an anchor for a dead id fails");
  assert.ok(blurbProblems("sub", "Knight", { blurb: "x", anchors: undefined }).length >= 2, "no anchors at all fails");
  // a race needs its note too
  const raceAnchors = { "human-neutral": { blurb: "no advantages", note: "no advantages" } };
  assert.deepEqual(blurbProblems("race", "Human", { blurb: "No advantages.", note: "No advantages.", anchors: raceAnchors }), []);
  assert.ok(blurbProblems("race", "Human", { blurb: "No advantages.", note: "", anchors: raceAnchors }).some((p) => /RACES note is empty/.test(p)));
});

test("IDENT-12: every anchor is a case-insensitive regex source, and a blurb match is case-insensitive", () => {
  for (const kind of ["sub", "race"]) {
    for (const [key, ids] of Object.entries(BLURB_ANCHORS[kind])) {
      for (const [id, a] of Object.entries(ids)) {
        assert.doesNotThrow(() => new RegExp(a.blurb, "i"), `${key}/${id}`);
        if (kind === "race") assert.doesNotThrow(() => new RegExp(a.note, "i"), `${key}/${id} note`);
      }
    }
  }
  assert.ok(Object.isFrozen(BLURB_ANCHORS) && Object.isFrozen(BLURB_ANCHORS.sub) && Object.isFrozen(BLURB_ANCHORS.race));
});

test("IDENT-12: every Magic User blurb names the schools it can never learn; the Apprentice may learn Illusion; the Summoner states the Summon-from-level-1 exception", () => {
  for (const sub of MU_SUBS) {
    const closed = Object.keys(MU_CHART[sub]).filter((k) => SCHOOLS.has(k) && MU_CHART[sub][k] === null);
    const anchor = BLURB_ANCHORS.sub[sub]["chart-never"];
    if (!closed.length) {
      assert.equal(anchor, undefined, `${sub}: nothing is closed, so no never anchor`);
      continue;
    }
    assert.ok(anchor, `${sub}: an anchor for its never-learned schools`);
    for (const school of closed) {
      assert.match(SUB_NOTE[sub], new RegExp(`\\b${school}\\b`, "i"), `${sub}'s blurb names ${school}`);
      assert.match(anchor.blurb.toLowerCase(), new RegExp(school), `${sub}'s anchor names ${school}`);
    }
  }
  assert.match(SUB_NOTE.Apprentice, /may learn Illusion/);
  assert.match(SUB_NOTE.Summoner, /level 2/);
  assert.match(SUB_NOTE.Summoner, /very first day/);
  assert.ok(BLURB_ANCHORS.sub.Summoner["chart-override-Summon"], "the Summon exception has an anchor");
});

test("IDENT-12: the checkpoint's text-only rulings are written (Q2 A, Q3 B, Q6 A, the shield)", () => {
  assert.match(SUB_NOTE.Cleric, /chain mail/);
  assert.match(SUB_NOTE.Cleric, /\+1 to hit/);
  assert.match(SUB_NOTE.Cleric, /offense/i);
  assert.match(SUB_NOTE.Cleric, /a scroll will still fire one/);
  assert.match(RACE_NOTE.Fridgian, /second is simply lost with it/);
  assert.match(RACES.Fridgian.note, /lost if the first one fells its target/);
});
