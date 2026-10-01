// test/unit/item-text-wording.test.js
//
// Phase 89 plan 09 (TEXT-01 for items, user 2026-09-30): the wording guard over
// every item surface that speaks in rules words:
//   - every JEWELRY, CLOAKS, STAVES, POTIONS and TOOLS row `txt` (plus the
//     upgrade-bag texts),
//   - EVENT_NARRATION.itemEffectStarted and LINE_FOR.itemEffectStarted (the
//     Oracle and the rail), rendered for every activation kind, the hero's and
//     a Joiner's,
//   - the item chip explanations: every CONDITION_EXPLAIN key whose chip source
//     is "item" (src/browser/heroConditions.js), read out of mazeworld.html.
//
// The rules (89-CONTEXT "TEXT-01 for items"):
//   - nobody speaks in faces: a shift is a signed to-hit ("foes −2 to hit you",
//     "foes +1 to hit you", "+2 to the parley roll"); a hard cap names its range
//     on a d20 ("20 on a d20", "19–20 if you insulted them");
//   - no "squares of" opponents or enemies: an area effect says how many foes;
//   - the Helm of Knowledge says it lets you always parley and what a parley is;
//   - an effect a foe can resist never promises more than the engine does;
//   - the Death potion reads "you're dead!".
//
// The four TEXT-01 probe edges (fallback probes, 89-09-PLAN truths):
//   ADJACENCY  a shift of exactly one reads "+1"/"−1 to hit", never "one face";
//              a cap of one face reads a single number ("20 on a d20"), two
//              faces a range ("19–20").
//   EMPTY      an item with no to-hit change prints no to-hit clause (the Ring
//              of Power, the Cloak of Speed); an item with no text of its own (a
//              weapon, an armour) keeps its stat lines.
//   ENCODING   the guard matches the minus sign U+2212 and the en dash U+2013
//              exactly, and rejects a hyphen-minus in a to-hit or in a range.
//   ORDERING   a range reads low to high, and the plain reach is stated before
//              any insult or depth exception.
//
// What the numbers ARE is pinned against the engine elsewhere
// (test/unit/authored-ranges.test.js, test/unit/roll-sign-consistency.test.js);
// this file is only the wording.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { POTIONS, JEWELRY, CLOAKS, STAVES, TOOLS, BAG_ITEMS, ACTIVATION_OF } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { HERO_CONDITIONS } from "../../src/browser/heroConditions.js";
import { itemStatLines } from "../../src/browser/viewModels.js";
import { WEAPONS, ARMORS } from "../../content/index.js";

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

const plain = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// --- the checkers (exported behaviour is tested below, edge by edge) --------

/** toHitProblems(text) — every "N to hit" token must be [+−]N, N >= 1, with U+2212 for minus. */
function toHitProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\S*?)(\d+) to hit/g)) {
    const sign = m[1].slice(-1);
    const n = Number(m[2]);
    if (sign !== "+" && sign !== "−") out.push(`unsigned or hyphen-signed to-hit "${m[0]}"`);
    if (n === 0) out.push(`zero to-hit "${m[0]}"`);
  }
  return out;
}

/** rangeProblems(text) — every "… on a d20" range is one number, or lo–hi with U+2013, low to high, on the d20. */
function rangeProblems(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\d+)(?:([^\d\s])(\d+))? on a d20/g)) {
    const lo = Number(m[1]);
    if (m[2] === undefined) {
      if (lo < 1 || lo > 20) out.push(`range "${m[0]}" is off the d20`);
      continue;
    }
    const hi = Number(m[3]);
    if (m[2] !== "–") out.push(`range "${m[0]}" is not written with an en dash`);
    if (!(lo < hi)) out.push(`range "${m[0]}" does not read low to high`);
    if (lo < 1 || hi > 20) out.push(`range "${m[0]}" is off the d20`);
  }
  return out;
}

/** wordingProblems(text) — everything TEXT-01 bans from an item surface. */
function wordingProblems(text) {
  const t = plain(text);
  const out = [...toHitProblems(t), ...rangeProblems(t)];
  if (/\bfaces?\b/i.test(t)) out.push(`says "face(s)": ${t}`);
  if (/squares of (?:opponents?|enemies|enemy|foes?)/i.test(t)) out.push(`says "squares of" foes: ${t}`);
  if (/understand them/i.test(t)) out.push(`says "understand them": ${t}`);
  if (/\bundefined\b|\bNaN\b/.test(t)) out.push(`leaks a bad value: ${t}`);
  return out;
}

// --- the surfaces ----------------------------------------------------------

const rows = [
  ...JEWELRY.map((r) => ({ id: `JEWELRY.${r.n}`, text: r.txt })),
  ...CLOAKS.map((r) => ({ id: `CLOAKS.${r.n}`, text: r.txt })),
  ...STAVES.map((r) => ({ id: `STAVES.${r.n}`, text: r.txt })),
  ...POTIONS.map((r) => ({ id: `POTIONS.${r.n}`, text: r.txt })),
  ...Object.values(TOOLS).map((r) => ({ id: `TOOLS.${r.n}`, text: r.txt })),
  ...Object.values(BAG_ITEMS).map((r) => ({ id: `BAG_ITEMS.${r.n}`, text: r.txt })),
];
const rowText = (id) => rows.find((r) => r.id === id).text;

/** Every activation kind the content declares, plus the kinds with their own start-line fields. */
const KINDS = [...new Set(Object.values(ACTIVATION_OF).map((a) => a.kind))];
const startEvent = (kind, over = {}) => ({
  type: "itemEffectStarted", kind, item: "An Item", left: 50, cadence: "squares",
  size: "Large", step: 1, sizeDmg: 2, dmgTotal: 2, might: 8, every: 10, ticks: 3, heal: { n: 1, sides: 6, bonus: 0 },
  ...over,
});
const startLines = [];
for (const kind of KINDS) {
  for (const member of [undefined, "Joiny"]) {
    const e = startEvent(kind, member ? { member } : {});
    const who = member ? "Joiner" : "hero";
    startLines.push({ id: `Oracle ${kind} (${who})`, text: EVENT_NARRATION.itemEffectStarted(e) });
    startLines.push({ id: `rail ${kind} (${who})`, text: LINE_FOR.itemEffectStarted(e, {}).text });
  }
}

/** CONDITION_EXPLAIN, read out of mazeworld.html's classic script. */
function conditionExplain() {
  const start = html.indexOf("const CONDITION_EXPLAIN = {");
  assert.ok(start >= 0, "mazeworld.html should declare CONDITION_EXPLAIN");
  const end = html.indexOf("\n};", start);
  const out = {};
  for (const m of html.slice(start, end).matchAll(/^\s*(\w+): "((?:[^"\\]|\\.)*)",?\s*$/gm)) out[m[1]] = m[2];
  return out;
}
const EXPLAIN = conditionExplain();
const ITEM_CHIP_KEYS = [...new Set([...HERO_CONDITIONS.filter((h) => h.source === "item").map((h) => h.key), "might"])];
const chipLines = ITEM_CHIP_KEYS.map((k) => ({ id: `CONDITION_EXPLAIN.${k}`, text: EXPLAIN[k] }));

test("the guard reads every surface it names (so it cannot pass by reading nothing)", () => {
  assert.ok(rows.length >= 8 + 7 + 8 + 10 + 3, `rows: ${rows.length}`);
  assert.ok(KINDS.length >= 15, `activation kinds: ${KINDS.join(", ")}`);
  assert.ok(startLines.length >= KINDS.length * 4);
  for (const k of ["invis", "unseen", "giant", "tongue", "enlarge", "might"]) assert.ok(ITEM_CHIP_KEYS.includes(k), `item chip key ${k}`);
  for (const c of chipLines) assert.equal(typeof c.text, "string", `${c.id} should be a sentence in mazeworld.html`);
});

test("no item row, item start line (Oracle or rail) or item chip sentence speaks in faces, squares of foes, or 'understand them'", () => {
  for (const s of [...rows, ...startLines, ...chipLines]) assert.deepEqual(wordingProblems(s.text), [], `${s.id}: ${plain(s.text)}`);
});

test("every item surface that names a to-hit shift signs it with + or U+2212, never zero", () => {
  const seen = new Set();
  for (const s of [...rows, ...startLines, ...chipLines]) {
    assert.deepEqual(toHitProblems(plain(s.text)), [], s.id);
    for (const m of plain(s.text).matchAll(/[+−]\d+ to hit/g)) seen.add(m[0]);
  }
  assert.ok(seen.has("−2 to hit") && seen.has("+1 to hit"), `the Anklet and the Gauntlet state their shifts, saw ${[...seen]}`);
});

test("every d20 range an item surface states is one number or low–high with an en dash, on the d20", () => {
  let stated = 0;
  for (const s of [...rows, ...startLines, ...chipLines]) {
    assert.deepEqual(rangeProblems(plain(s.text)), [], s.id);
    stated += [...plain(s.text).matchAll(/ on a d20/g)].length;
  }
  assert.ok(stated >= 6, `the invisibility items and the Walnut Staff name ranges, saw ${stated}`);
});

// --- ADJACENCY, EMPTY, ENCODING, ORDERING (the four probe edges) ------------

test("ADJACENCY: a shift of one reads +1/−1 to hit; a cap of one face is a single number, two faces a range", () => {
  assert.match(rowText("JEWELRY.Gauntlet of the Giant"), /foes \+1 to hit you/);
  assert.match(rowText("POTIONS.Enlarge"), /foes \+1 to hit you/);
  assert.match(rowText("JEWELRY.Anklet of Invisibility"), /foes are −2 to hit you/);
  for (const id of ["CLOAKS.Cloak of Invisibility", "POTIONS.Invisible", "STAVES.Crystal Staff"]) {
    assert.match(rowText(id), /only on their best roll \(20 on a d20; 19–20 if you insulted them\)/, id);
  }
  assert.match(rowText("STAVES.Walnut Staff"), /\(18–20 on a d20; 17–20 if you insulted them\)/);
  // The checkers themselves: one face is never "one face", and "20–20" is not a range.
  assert.deepEqual(rangeProblems("only on 20 on a d20"), []);
  assert.deepEqual(rangeProblems("only on 19–20 on a d20"), []);
  assert.notDeepEqual(rangeProblems("only on 20–20 on a d20"), []);
  assert.notDeepEqual(wordingProblems("one face easier for foes to hit"), []);
});

test("EMPTY: an item with no to-hit change prints no to-hit clause; an item with no text keeps its stat lines", () => {
  for (const id of ["JEWELRY.Ring of Power", "CLOAKS.Cloak of Speed", "CLOAKS.Cloak of Strength", "POTIONS.Healing", "POTIONS.Strength"]) {
    assert.doesNotMatch(rowText(id), /to hit/, id);
  }
  // A weapon and an armour have no txt of their own; their stat lines survive (and a to-hit shift of zero prints nothing).
  const club = itemStatLines({ kind: "weapon", n: "Club", base: "Club" }).map((l) => l.text);
  assert.ok(club.includes(WEAPONS.Club.lab), `Club lines: ${club}`);
  assert.ok(!club.some((t) => /to hit/.test(t)), `a Club has no to-hit shift: ${club}`);
  const cloth = itemStatLines({ kind: "armor", n: "Cloth", armor: "Cloth", ar: 3, wp: 12, left: 12, cls: "FTM" }).map((l) => l.text);
  assert.ok(cloth.includes("AR 3") && cloth.includes("12/12 hp"), `Cloth lines: ${cloth}`);
  assert.ok(!cloth.some((t) => /climb/.test(t)), `Cloth is not bulky: ${cloth}`);
  for (const l of [...club, ...cloth]) assert.deepEqual(wordingProblems(l), [], l);
});

test("ENCODING: the guard wants U+2212 and U+2013 exactly, and rejects a hyphen-minus in a to-hit or a range", () => {
  assert.deepEqual(toHitProblems("foes −2 to hit you"), []);
  assert.deepEqual(toHitProblems("foes +1 to hit you"), []);
  assert.notDeepEqual(toHitProblems("foes -2 to hit you"), [], "a hyphen-minus is rejected");
  assert.notDeepEqual(toHitProblems("foes –2 to hit you"), [], "an en dash is not a minus");
  assert.notDeepEqual(toHitProblems("foes 2 to hit you"), [], "an unsigned shift is rejected");
  assert.notDeepEqual(toHitProblems("foes +0 to hit you"), [], "+0 is rejected");
  assert.notDeepEqual(toHitProblems("foes −0 to hit you"), [], "−0 is rejected");
  assert.deepEqual(rangeProblems("19–20 on a d20"), []);
  assert.notDeepEqual(rangeProblems("19-20 on a d20"), [], "a hyphen-minus range is rejected");
  assert.notDeepEqual(rangeProblems("19−20 on a d20"), [], "a minus sign is not a range separator");
  assert.equal("−".charCodeAt(0), 0x2212);
  assert.equal("–".charCodeAt(0), 0x2013);
});

test("ORDERING: a range reads low to high, and the plain reach is stated before any insult or depth exception", () => {
  assert.notDeepEqual(rangeProblems("20–19 on a d20"), [], "high to low is rejected");
  for (const s of [...rows, ...startLines, ...chipLines]) {
    const t = plain(s.text);
    const insult = t.search(/if (?:you |they )?insulted|if insulted/);
    if (insult < 0) continue;
    const reach = t.search(/\d+(?:–\d+)? on a d20/);
    assert.ok(reach >= 0 && reach < insult, `${s.id}: the plain range comes before the insult exception: ${t}`);
  }
  // The depth exception ("the deeper the floor, the likelier it does") follows "each foe may resist".
  for (const id of ["STAVES.Birch Staff", "STAVES.Oak Staff", "STAVES.Cedar Staff", "STAVES.Pine Staff", "STAVES.Walnut Staff", "JEWELRY.Amulet of Stone"]) {
    const t = rowText(id);
    assert.ok(t.indexOf("may resist") >= 0 && t.indexOf("may resist") < t.indexOf("the deeper the floor"), `${id}: ${t}`);
  }
});

// --- the specific rulings ----------------------------------------------------

test("the Helm of Knowledge says it lets you always parley and what a parley is, without restating parley's rewards", () => {
  const helm = rowText("JEWELRY.Helm of Knowledge");
  assert.match(helm, /always parley/);
  assert.match(helm, /a parley is talking your way out of the fight instead of swinging/);
  assert.match(helm, /\+2/);
  assert.doesNotMatch(helm, /experience|loot|wilmst|reward/i, "PARLEY-01 (Phase 91) owns parley's rewards");
  assert.match(EXPLAIN.tongue, /always parley/);
  assert.match(EXPLAIN.tongue, /instead of swinging/);
  assert.match(EXPLAIN.tongue, /\+2/);
});

test("area effects say how many foes: the Amulet of Stone, Birch, Oak and Cedar Staves", () => {
  assert.match(rowText("JEWELRY.Amulet of Stone"), /up to 4 foes/);
  assert.match(rowText("STAVES.Birch Staff"), /up to 2 foes/);
  assert.match(rowText("STAVES.Oak Staff"), /up to 2 foes/);
  assert.match(rowText("STAVES.Cedar Staff"), /every foe in the fight to sleep for the rest of it \(a fight holds at most 3\)/);
});

test("the floor-12 limits are gone from item text: stone kills, gas sleeps the fight, the resist rises with depth (89-08, Q1)", () => {
  for (const id of ["JEWELRY.Amulet of Stone", "STAVES.Oak Staff", "STAVES.Cedar Staff", "STAVES.Birch Staff", "STAVES.Walnut Staff"]) {
    assert.doesNotMatch(rowText(id), /floor 12|three rounds|a day is/i, id);
  }
});

test("an effect a foe can resist never promises more than the engine does: its text says it may resist", () => {
  for (const id of ["JEWELRY.Amulet of Stone", "STAVES.Birch Staff", "STAVES.Walnut Staff", "STAVES.Oak Staff", "STAVES.Pine Staff", "STAVES.Cedar Staff"]) {
    assert.match(rowText(id), /may resist/, id);
    assert.match(rowText(id), /the deeper the floor, the likelier it does/, id);
  }
});

test("the Walnut Staff casts Weaken: half damage and a cap on the foes' to-hit, for the whole fight", () => {
  const t = rowText("STAVES.Walnut Staff");
  assert.match(t, /casts Weaken/);
  assert.match(t, /half damage/);
  assert.match(t, /for the whole fight/);
  assert.doesNotMatch(t, /double/i);
});

test("every staff text states its charges and its recharge", () => {
  for (const s of STAVES) {
    const act = ACTIVATION_OF[s.n];
    assert.match(s.txt, new RegExp(`${act.charges} charges?, (?:one )?back every ${act.recharge} squares`), `${s.n}: ${s.txt}`);
  }
});

test("the Death potion reads \"you're dead!\"", () => {
  assert.equal(POTIONS.find((p) => p.n === "Death").txt, "you're dead!");
});

test("the house voice and the family-friendly line hold: no profanity words in the reworded rows", () => {
  const banned = /\b(damn|hell|crap|shit|fuck|bastard|bitch|ass)\b/i;
  for (const s of [...rows, ...startLines, ...chipLines]) assert.doesNotMatch(plain(s.text), banned, s.id);
});

test("weapons state their to-hit and crit, armour its bulk, a bag its caps (ITEM-AUDIT fix text rows)", () => {
  const lines = (it) => itemStatLines(it).map((l) => l.text);
  assert.ok(lines({ kind: "weapon", n: "Bardiche", base: "Bardiche" }).includes("−2 to hit"));
  assert.ok(lines({ kind: "weapon", n: "Mace", base: "Mace" }).includes("−1 to hit"));
  assert.ok(lines({ kind: "weapon", n: "Rapier", base: "Rapier" }).includes("+1 to hit"));
  assert.ok(lines({ kind: "weapon", n: "Rapier", base: "Rapier" }).includes("crits on the top 2 numbers of your strike die"));
  assert.ok(!lines({ kind: "weapon", n: "Whip", base: "Whip" }).some((t) => /crits on/.test(t)), "a one-number crit is not stated (it is every weapon's ordinary top number)");
  const plate = ARMORS.find((a) => a.name === "Plate");
  assert.ok(lines({ kind: "armor", n: "Plate", armor: "Plate", ar: plate.ar, wp: plate.wp, left: plate.wp, cls: "F" }).includes("−2 to climb, leap and flee rolls"));
  assert.ok(lines({ kind: "bag", tier: "large", n: "Large bag" }).includes("carries up to 8000 wilmst and 40 rations"));
});
