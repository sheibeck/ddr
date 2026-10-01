// test/unit/spell-skill-text-engine.test.js
//
// Phase 90 plan 12 (SPELL-08, ABIL-06, TEXT-01 close): the text-vs-engine guard
// for spells, abilities and skills. A spell's or skill's text is the promise to
// the player; this file fails the day a number in that text and the number the
// engine uses drift apart. It is the twin of test/unit/item-text-engine.test.js
// (Phase 89 plan 10).
//
// HOW IT WORKS
//   - `numbersIn(text)` finds every number a text states: digits, number words
//     (one to twelve, fifty, a hundred, once, twice, half, quarter, double,
//     halve), signed numbers (+10, U+2212 2 = -2), dice with or without a
//     leading 1 (d20, 2d6+2, d4+1) and d20 ranges ("19–20 on a d20", the bare
//     "5–10" after "hits on"), the range written with the one en dash (U+2013)
//     the formatter prints. Four idioms are NOT numbers and are excluded by
//     name: "at once" (Chameleon Tongue), "its double" (Duplicate Foe), "one
//     that fails" (Size of the Behemoth) and "one perfect form" (Kata).
//   - `SPELL_TEXT_FACTS` and `SKILL_TEXT_FACTS` map every spell, every catalog
//     ability and every table skill (and a skill's txt2) to a list of facts
//     `{ says: RegExp, value: () => ... }`. `says` has one `(#)` placeholder per
//     stated number and finds that exact number in the text; `value` reads the
//     same numbers off the ENGINE (a real castSpell, a real useAbility, a real
//     foe swing, the engine's own constants and helpers), never off the text.
//   - Completeness: every number numbersIn finds in a text must be captured by
//     exactly one fact, so a NEW number nobody pinned fails by name.
//   - Truth: each captured number must equal the engine's value, so a CHANGED
//     number fails.
//   - The checker is itself tested on doctored text (a changed number, an added
//     number, a vanished sentence) and on the parser's edges.
//
// The wording rules (no faces, signed shifts, d20 ranges) are
// test/unit/spell-skill-text-wording.test.js; the audit tables are
// test/unit/spell-audit.test.js and skill-audit.test.js. This file is the numbers.
//
// Per-file fixture copies (never imported cross-file, the harness aside), after
// test/unit/authored-ranges.test.js and spell-skill-text-wording.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import {
  foeSwingVsHero,
  foeToHitVs,
  risingResistFaces,
  strengthRoll,
  targetStrikeFaces,
  schoolBonus,
  toHit,
  moveCost,
  weaponDamage,
  weaponDamageTerms,
  heardSquares,
  upkeep,
  strikeDie,
} from "../../engine/derived.js";
import { castSpell } from "../../engine/magic.js";
import {
  foeTurn,
  playerStrike,
  parley,
  parleyBlockedReason,
  fight,
  alliesTurn,
  applyFoeDamageToPlayer,
  applyFoeDamageToMember,
  FREEZE_HOLD_DIE,
} from "../../engine/combat.js";
import { useAbility, abilityShortfall, DURATION_ROUNDS, KATA_FEINT_NEED_SHIFT, SWEEP_MIN_FOES } from "../../engine/abilities.js";
import { openChest } from "../../engine/encounters.js";
import { newDay } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { tickSquares, isReady } from "../../engine/effects.js";
import { SPELLS, ABILITIES, ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/index.js";
import { facesRangeText } from "../../src/browser/rollRange.js";
import { actsWhere } from "./harness/spellResistActs.js";
import { setIdentityDials } from "./harness/identityDials.js";

// DIALS ships fitted; the reads below (a foe's blow, a halving, a soak) are canon-mechanic numbers, so this file runs under the identity override.
setIdentityDials();

// ---------------------------------------------------------------------------
// numbersIn: every number a spell or skill text states
// ---------------------------------------------------------------------------

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  once: 1, twice: 2, half: 0.5, quarter: 0.25, double: 2, doubles: 2, doubling: 2, halve: 0.5, halves: 0.5, halved: 0.5,
};
const WORDS = Object.keys(WORD_NUM).sort((a, b) => b.length - a.length).join("|");
const TOKEN_RE = new RegExp(
  "(?<range>\\d+(?:\\u2013\\d+)? on a d\\d+)" +
    "|(?<dice>\\b\\d*d\\d+(?:[+\\u2212]\\d+)?)" +
    "|(?<signed>[+\\u2212]\\d+)" +
    "|(?<span>\\d+\\u2013\\d+)" +
    "|(?<digits>\\d+)" +
    // The four idioms that are not numbers: "at once", "its double", "one that", "one perfect form".
    `|(?<word>(?<!\\bat )(?<!\\bits )\\b(?:a hundred|${WORDS})\\b(?! that\\b)(?! perfect form\\b))`,
  "gi",
);

/**
 * numbersIn(text) — every number `text` states, in order, each
 * `{ raw, start, end, kind, value }`:
 *   word/digits -> a number (fifty = 50, a hundred = 100, twice = 2, half = 0.5);
 *   signed      -> a signed number ("+10" = 10, U+2212 "2" = -2);
 *   dice        -> { n, sides, bonus } with a leading 1 optional ("d4+1" = "1d4+1");
 *   range       -> { lo, hi, die } for "19–20 on a d20" (a lone "20 on a d20" is 20..20);
 *   span        -> { lo, hi } for the bare "5–10" (no die named).
 * A hyphen-minus sign or range separator is NOT a recognised sign or dash, so its
 * digits come out as separate unclaimed numbers and fail the guard.
 */
export function numbersIn(text) {
  const out = [];
  for (const m of String(text).matchAll(TOKEN_RE)) {
    const g = m.groups;
    let kind;
    let value;
    if (g.range !== undefined) {
      const r = /(\d+)(?:–(\d+))? on a d(\d+)/i.exec(g.range);
      kind = "range";
      value = { lo: Number(r[1]), hi: r[2] ? Number(r[2]) : Number(r[1]), die: Number(r[3]) };
    } else if (g.dice !== undefined) {
      const r = /(\d*)d(\d+)(?:([+−])(\d+))?/i.exec(g.dice);
      kind = "dice";
      value = { n: r[1] ? Number(r[1]) : 1, sides: Number(r[2]), bonus: r[3] ? (r[3] === "+" ? 1 : -1) * Number(r[4]) : 0 };
    } else if (g.signed !== undefined) {
      kind = "signed";
      value = (g.signed[0] === "+" ? 1 : -1) * Number(g.signed.slice(1));
    } else if (g.span !== undefined) {
      const r = /(\d+)–(\d+)/.exec(g.span);
      kind = "span";
      value = { lo: Number(r[1]), hi: Number(r[2]) };
    } else if (g.digits !== undefined) {
      kind = "digits";
      value = Number(g.digits);
    } else {
      kind = "word";
      const w = g.word.toLowerCase();
      value = w === "a hundred" ? 100 : WORD_NUM[w];
    }
    out.push({ raw: m[0], start: m.index, end: m.index + m[0].length, kind, value });
  }
  return out;
}

/** NUM_SRC — one number token of any kind, as a capture group; `(#)` in a fact's sentence stands for it. */
const NUM_SRC =
  String.raw`((?:\d+(?:–\d+)?(?: on a d\d+)?)|(?:\b\d*d\d+(?:[+−]\d+)?)|(?:[+−]\d+)|(?:\b(?:a hundred|` +
  WORDS +
  String.raw`)\b))`;
const expanded = new WeakMap();
/** sayRe(fact) — the fact's sentence with every `(#)` opened up to any number token, so a CHANGED number still finds its place (and then fails as untrue). */
export function sayRe(fact) {
  if (!expanded.has(fact)) expanded.set(fact, new RegExp(fact.says.source.replaceAll("(#)", NUM_SRC), "di"));
  return expanded.get(fact);
}

const show = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));

function sameValue(got, want) {
  if (typeof want === "number") return got === want;
  if (want && want.sides !== undefined) return !!got && got.n === want.n && got.sides === want.sides && got.bonus === want.bonus;
  if (want && want.lo !== undefined) {
    return !!got && got.lo === want.lo && got.hi === want.hi && (got.die === undefined || want.die === undefined || got.die === want.die);
  }
  return false;
}

/**
 * checkRow(name, text, facts) — every problem the guard finds in one row: a fact
 * whose sentence is gone, a stated number that is not the engine's, a number no
 * fact claims, a number two facts claim.
 */
export function checkRow(name, text, facts) {
  const problems = [];
  const toks = numbersIn(text);
  const claimed = toks.map(() => 0);
  for (const f of facts) {
    const m = sayRe(f).exec(text);
    if (!m) {
      problems.push(`${name}: the text no longer says ${f.says}`);
      continue;
    }
    const want = [].concat(f.value());
    if (want.length !== m.length - 1) {
      problems.push(`${name}: ${f.says} captures ${m.length - 1} numbers but the fact gives ${want.length} values`);
      continue;
    }
    for (let g = 1; g < m.length; g++) {
      const [s, e] = m.indices[g];
      const i = toks.findIndex((t) => t.start === s && t.end === e);
      if (i < 0) {
        problems.push(`${name}: "${m[g]}" in ${f.says} is not a number token`);
        continue;
      }
      claimed[i]++;
      if (!sameValue(toks[i].value, want[g - 1])) problems.push(`${name}: the text says "${m[g]}" but the engine says ${show(want[g - 1])}`);
    }
  }
  toks.forEach((t, i) => {
    if (claimed[i] === 0) problems.push(`${name}: unclaimed number "${t.raw}" (no fact pins it to the engine)`);
    if (claimed[i] > 1) problems.push(`${name}: number "${t.raw}" is claimed by ${claimed[i]} facts`);
  });
  return problems;
}

// ---------------------------------------------------------------------------
// fixtures (per-file copies)
// ---------------------------------------------------------------------------

/** rngBy(fn) — a recording rng: `.d(sides)` answers `fn(sides, drawIndex)` and notes the die it was asked for; the cursor is a fixed 0. */
function rngBy(fn = () => 2) {
  const sides = [];
  let i = 0;
  return {
    sides,
    d(s) {
      sides.push(s);
      return fn(s, i++);
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
  };
}

function fixedCaster(overrides = {}) {
  return {
    cls: "Magic User", sub: "Illusionist", race: "Human", level: 5, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    darkFor: 0, intel: 10, timers: {}, abilities: [],
    ...overrides,
  };
}

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function fixedState(cOverrides = {}, rest = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedCaster(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const byName = (n) => SPELLS.find((s) => s.n === n);
const IDX = Object.fromEntries(SPELLS.map((s, i) => [s.n, i]));

/** subFor(sp) — the Magic User sub-class whose chart gives the spell's school no bonus (a Wizard for healing and special, an Illusionist for the rest). */
const subFor = (sp) => (sp.s === "healing" || sp.s === "special" ? "Wizard" : "Illusionist");

/**
 * cast(n, opts) — a no-bonus caster's real castSpell of `n`. `foes` is a count or a
 * list; in a fight (the default) no foe resists (a derived-stream `acts` that makes
 * every foe fail its resist), `fn(sides, i)` answers every main-rng draw, and the
 * result carries the dice sides asked for in order.
 */
function cast(n, { level = 5, sub, foes = 1, foeOver = {}, fn = () => 2, c = {}, fight = true, type = "Humans", rest = {}, depth = 1 } = {}) {
  const sp = byName(n);
  const list = typeof foes === "number" ? Array.from({ length: foes }, (_, i) => fixedFoe({ name: `F${i + 1}`, type, ...foeOver })) : foes;
  const acts = fight ? actsWhere(n, list.map((_, i) => [i, false]), { intels: Object.fromEntries(list.map((f, i) => [i, f.intel ?? 1])) }) : 0;
  const state = fixedState(
    { sub: sub ?? subFor(sp), level, grimoire: [n], ...c },
    { combat: fight ? fixedCombat(list, { type }) : null, acts, floor: fixedFloor(depth), ...rest },
  );
  const rng = rngBy(fn);
  const events = castSpell(state, IDX[n], rng, []);
  return { state, events, rng, sides: rng.sides, foes: list };
}

const ev = (events, type) => events.find((e) => e.type === type);
const evs = (events, type) => events.filter((e) => e.type === type);
/** die(sides, bonus) — the dice object a value() returns for "dN" or "dN+k". */
const die = (sides, bonus = 0, n = 1) => ({ n, sides, bonus });
/** dice(row) — a content `dmg` or `rounds` literal as the same object. */
const dice = ({ n, sides, bonus }) => ({ n, sides, bonus: bonus || 0 });
/** d20(faces) — "N on a d20" / "lo–hi on a d20" for a count of winning faces. */
const d20 = (faces) => ({ lo: 21 - faces, hi: 20, die: 20 });

// @@MEASURES@@

// ---------------------------------------------------------------------------
// the engine's numbers: spells (every value() below reads one of these)
// ---------------------------------------------------------------------------

/** marked(f) — whether a cast left any mark on foe f (hit points, sleep, a hold, a flag, a changed intelligence). */
const marked = (f) => f.wp !== 999 || !f.alive || f.asleep > 0 || !!f.held || !!f.blind || !!f.stupid || !!f.shrunk || !!f.acid || !!f.misdirect || !!f.cowering || !!f.fled || !!f.frenzied || !!f.turned;
/** reach(n, opts) — how many of three foes a real cast of `n` marks. */
const reach = (n, opts = {}, pred = marked) => cast(n, { foes: 3, ...opts }).foes.filter(pred).length;

/** blowLoss(state) — the hit points one foe turn takes off the hero (every draw a raw 1: a landed blow). */
function blowLoss(state) {
  state.c.wp = 999;
  const events = [];
  foeTurn(state, rngBy(() => 1), events);
  return 999 - state.c.wp;
}
/** plainBlowLoss(foeOver) — the same foe's blow with nothing on it. */
const plainBlowLoss = (foeOver = {}) => blowLoss(fixedState({}, { combat: fixedCombat([fixedFoe({ name: "Biter", lvl: 3, ...foeOver })]) }));
/** halfOf(after, plain) — 0.5 when `after` is `plain` halved and rounded up (a blow of 4 or more), else the raw ratio. */
const halfOf = (after, plain) => (plain >= 4 && after === Math.ceil(plain / 2) ? 0.5 : after / plain);

/** foeFaces(state, foe) — the foe's winning faces against the hero, plain and insulted. */
function foeFaces(state, foe) {
  const plain = foeSwingVsHero(state, foe).faces;
  state.combat.parleyInsulted = true;
  const insulted = foeSwingVsHero(state, foe).faces;
  delete state.combat.parleyInsulted;
  return { plain, insulted };
}
/** capsOf(n, opts) — a foe's winning faces after a real cast of `n` (a foe of level 5 so a level-4 Behemoth cows it). */
function capsOf(n, opts = {}) {
  const r = cast(n, { foeOver: { lvl: 5, intel: 1 }, ...opts });
  return foeFaces(r.state, r.foes[0]);
}
const spanOf = (faces) => ({ lo: 21 - faces, hi: 20 });

/** sleepTick — the foe visits one dispatch spends on a sleeper before the caller looks (a cast IS the round's action). */
const SLEEP_TICK = (() => {
  const r = cast("Map the Floor", { foeOver: { asleep: 5 } });
  return 5 - r.foes[0].asleep;
})();

/** the school-bonus step of a timed spell: what one point of the chart's bonus adds to its squares or rounds. */
function squaresStep(n) {
  const sp = byName(n);
  const at = (sub) => ({ left: cast(n, { sub, fight: false }).state.c.timers[`spell:${n}`].left, bonus: schoolBonus(sub, sp.s) });
  const a = at("Wizard");
  const b = at("Illusionist");
  assert.ok(b.bonus > a.bonus, `${n}: the chart must give two sub-classes different ${sp.s} bonuses`);
  return (b.left - a.left) / (b.bonus - a.bonus);
}
function roundsStep() {
  const sp = byName("Stop Time");
  const at = (sub) => ({ rounds: ev(cast("Stop Time", { sub, foes: 2 }).events, "timeStopped").rounds, bonus: schoolBonus(sub, sp.s) });
  const a = at("Wizard");
  const b = at("Illusionist");
  return (b.rounds - a.rounds) / (b.bonus - a.bonus);
}

/** thrown(n) — the real to-hit a thrown spell rolls: the lowest winning number and the die, before any bonus. */
function thrown(n) {
  const e = ev(cast(n, { foes: 1, fn: () => 2 }).events, "spellThrown");
  assert.ok(e, `${n}: a spellThrown event`);
  assert.equal(e.mods, undefined, `${n}: the stated range is the one before any bonus`);
  return { span: { lo: e.atLeast, hi: e.dieN }, die: die(e.dieN) };
}
/** sampledDie(draw) — the d(sides)+bonus a derived-stream draw covers over many cursors. */
function sampledDie(draw) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let cursor = 0; cursor < 400; cursor++) {
    const v = draw(cursor);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return die(hi - lo + 1, lo - 1);
}

/** insaneFace(kind) — the d6 faces on which a real Insane does `kind` to the foe it hits. */
function insaneFaces() {
  const faces = { dies: [], hitsNext: [], flees: [], sleeps: [], frenzy: [] };
  for (let face = 1; face <= 6; face++) {
    const r = cast("Insane", { foes: 2, fn: (s, i) => (i === 0 ? face : 3) });
    const [a] = r.foes;
    if (evs(r.events, "insaneStruckAlly").length) faces.hitsNext.push(face);
    else if (a.fled) faces.flees.push(face);
    else if (!a.alive) faces.dies.push(face);
    else if (a.frenzied) faces.frenzy.push(face);
    else if (a.asleep > 0 || evs(r.events, "foeSlept").length) faces.sleeps.push(face);
  }
  return faces;
}
/** swingsOf(foeOver) — how many swings a foe takes in one turn. */
function swingsOf(foeOver) {
  const events = [];
  foeTurn(fixedState({}, { combat: fixedCombat([fixedFoe({ lvl: 3, ...foeOver })]) }), rngBy(() => 1), events);
  return evs(events, "struckByFoe").length + evs(events, "foeMissed").length;
}

/** vapor(face, d10) — a level-4 Noxious Vapor whose table shows `face` and whose foe's d10 shows `d10`. */
const vapor = (face, d10) => cast("Noxious Vapor", { level: 4, foes: 1, fn: (s, i) => (i === 0 ? face : s === 10 ? d10 : 2) });
const vaporKillFaces = () => [1, 2, 3, 4, 5, 6].filter((f) => !vapor(f, 2).foes[0].alive);
const vaporSpareFaces = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((k) => vapor(4, k).foes[0].alive);

/** wakesAfterBlows — the Open/Lock spell opens exactly one chest without a roll. */
function freeChests() {
  const r = cast("Open/Lock", { fight: false });
  const events = [];
  openChest(r.state, rngBy(() => 1), events);
  openChest(r.state, rngBy(() => 1), events);
  return evs(events, "chestOpened").filter((e) => e.reason === "openLock").length;
}
const timerLeft = (n, opts = {}) => cast(n, { fight: false, ...opts }).state.c.timers[`spell:${n}`].left;
function strengthRestart() {
  const r = cast("Strength", { fight: false });
  tickSquares(r.state.c, 40);
  castSpell(r.state, IDX.Strength, rngBy(), []);
  return r.state.c.timers["spell:Strength"].left;
}
const liveSpell = (n) => {
  const r = cast(n, { fight: false, ...(n === "Speed of Sound" ? { sub: "Illusionist" } : {}) });
  r.state.combat = fixedCombat([fixedFoe({ name: "Target" })]);
  return r.state;
};
const bareState = () => fixedState({ sub: "Illusionist", level: 5 }, { combat: fixedCombat([fixedFoe({ name: "Target" })]) });
function hastedBlows() {
  const state = liveSpell("Speed of Sound");
  const events = [];
  playerStrike(state, rngBy(() => 2), events);
  return evs(events, "struck").length + evs(events, "strikeMissed").length;
}
/** tongueBonus — what the cast adds to the parley roll: a Con Artist's parley with and without the spell, same foes. */
function tongueBonus() {
  const foes = () => [fixedFoe({ name: "Mark", lvl: 5, type: "Humans" })];
  const mk = () => fixedState({ cls: "Thief", sub: "Con Artist", level: 5, grimoire: ["Chameleon Tongue"] }, { combat: fixedCombat(foes(), { type: "Humans" }) });
  const plain = mk();
  const pe = [];
  parley(plain, rngBy(() => 20), pe);
  const spelled = mk();
  const se = castSpell(spelled, IDX["Chameleon Tongue"], rngBy(() => 20), []);
  const a = ev(pe, "parleyRolled");
  const b = ev(se, "parleyRolled");
  assert.ok(a && b, "both parleys roll");
  return a.atLeast - b.atLeast;
}
function parleysSpent() {
  const r = cast("Chameleon Tongue", { foes: 1, fn: () => 20, foeOver: { lvl: 5 } });
  assert.ok(r.state.combat, "a failed parley leaves the fight on");
  return parleyBlockedReason(r.state) === "parleySpent" ? 1 : 2;
}
const doorResists = () => {
  const foes = [fixedFoe({ name: "A", intel: 5 }), fixedFoe({ name: "B", intel: 12 }), fixedFoe({ name: "C", intel: 8 })];
  const r = cast("Door Illusion", { foes });
  return evs(r.events, "resistFailed").length + evs(r.events, "spellResisted").length;
};
const SP = (n) => byName(n);

// --- the facts: every number each spell's text states -----------------------

export const SPELL_TEXT_FACTS = {
  Heal: [{ says: / · you · (#) hp$/, value: () => dice(SP("Heal").dmg) }],
  Shield: [{ says: /soaks (#) hp for (#) rounds/, value: () => {
    const w = cast("Shield", { fight: false }).state.c.ward;
    return [w.pool, w.rounds];
  } }],
  Strength: [{ says: /for (#) squares, every damage roll you make \(each blow, each spell hit\) adds an extra (#); casting it again starts the (#) over/, value: () => [
    timerLeft("Strength"),
    sampledDie((cursor) => strengthRoll(cast("Strength", { fight: false }).state.c, { getState: () => cursor })),
    strengthRestart(),
  ] }],
  Doze: [{ says: /^control · (#) foes, your target first · asleep (#) rounds each/, value: () => {
    const r = cast("Doze", { foes: 3, fn: () => 3 });
    // The reach IS the first draw: a 2 on it sleeps exactly two of three foes.
    assert.equal(reach("Doze", { fn: (s, i) => (i === 0 ? 2 : 3) }), 2, "Doze reaches as many foes as its first draw");
    return [die(r.sides[0]), die(r.sides[1], r.foes[0].asleep + SLEEP_TICK - 3)];
  } }],
  Freeze: [{ says: /^burst · (#) foe · hits on (#) \((#)\) before bonuses, for (#) \+ your level² damage; unless it resists, a survivor is frozen for (#) rounds/, value: () => {
    const t = thrown("Freeze");
    return [reach("Freeze"), t.span, t.die, dice(SP("Freeze").dmg), die(cast("Freeze", { fn: () => 2 }).sides[2])];
  } }],
  "Map the Floor": [],
  "Mirror Self": [{ says: /only on their best roll \((#); (#) if you insulted them\), (#) rounds/, value: () => {
    const r = cast("Mirror Self", { fight: false, fn: () => 3 });
    r.state.combat = fixedCombat([fixedFoe()]);
    const f = foeFaces(r.state, r.state.combat.foes[0]);
    return [d20(f.plain), spanOf(f.insulted), die(r.sides[0])];
  } }],
  Stun: [{ says: /^control · (#) foe · held for (#) rounds, and hitting it/, value: () => [reach("Stun"), die(cast("Stun", { fn: () => 2 }).sides[0])] }],
  Weaken: [{ says: /a high roll \((#); (#) if you insulted them\) and do (#) damage, (#) rounds/, value: () => {
    const r = cast("Weaken", { foeOver: { lvl: 3 }, fn: () => 1 });
    const rounds = ev(r.events, "weakened").rounds;
    const f = foeFaces(r.state, r.foes[0]);
    return [d20(f.plain), spanOf(f.insulted), halfOf(blowLoss(r.state), plainBlowLoss({ lvl: 3 })), die(r.sides[0], rounds - 1)];
  } }],
  Acid: [{ says: /^damage over time · (#) foe · (#) a round, (#) rounds; the first round adds/, value: () => {
    const r = cast("Acid", { fn: () => 3 });
    // The rounds ARE the first draw: a 3 leaves 3 ticks, one of them already taken in the cast's own foe turn.
    assert.equal(r.foes[0].acid.rounds + evs(r.events, "acidTick").length, 3);
    return [reach("Acid"), dice(SP("Acid").dmg), die(r.sides[0])];
  } }],
  Stupidity: [{ says: /intelligence drops to (#) for the fight, so it resists almost nothing \(a (#), a little more as you go deeper\)/, value: () => {
    const r = cast("Stupidity", { foes: 3, foeOver: { intel: 10 } });
    const intel = r.foes[0].intel;
    return [intel, d20(risingResistFaces(1, intel))];
  } }],
  Blind: [{ says: /^control · (#) foe · blind for the fight: it hits only on its best roll \((#)\)/, value: () => {
    const r = cast("Blind", { foes: 3 });
    return [reach("Blind"), d20(foeFaces(r.state, r.foes[0]).plain)];
  } }],
  Shrink: [{ says: /^control · up to (#) foes · (#) hp and (#) damage, the fight/, value: () => {
    const r = cast("Shrink", { foeOver: { lvl: 3, wp: 40, maxWP: 40 }, fn: () => 2 });
    // The reach IS the first draw: a 2 shrinks exactly two of three foes.
    assert.equal(reach("Shrink", { foeOver: { wp: 40, maxWP: 40 }, fn: () => 2 }, (f) => !!f.shrunk), 2, "Shrink reaches as many foes as its first draw");
    return [die(r.sides[0]), halfOf(r.foes[0].wp, 40), halfOf(blowLoss(r.state), plainBlowLoss({ lvl: 3 }))];
  } }],
  Ice: [{ says: /^multi-target · every foe · (#) \+ your level² damage to each, no roll to hit; unless it resists, a survivor is frozen for (#) rounds/, value: () => [
    dice(SP("Ice").dmg),
    die(cast("Ice", { foes: 2, fn: () => 2 }).sides[1]),
  ] }],
  Earthquake: [{ says: /every foe and you · (#) \+ your level² damage to each foe; you get (#) the (#) unless warded/, value: () => {
    const r = cast("Earthquake", { foes: 2, fn: () => 2 });
    const rolled = SP("Earthquake").dmg.n * 2 + SP("Earthquake").dmg.bonus;
    return [dice(SP("Earthquake").dmg), halfOf(ev(r.events, "earthquakeSelfDamage").amount, rolled), dice(SP("Earthquake").dmg)];
  } }],
  "Noxious Vapor": [{ says: /^chaos · every foe · a (#) decides it: on a (#) each foe dies unless its own (#) shows a (#); any other number puts it to sleep for (#) rounds; from level (#) it is always the (#)$/, value: () => {
    const sleeper = vapor(2, 2);
    const lone = (level) => cast("Noxious Vapor", { level, foes: 1, fn: () => 2 });
    return [
      die(vapor(2, 2).sides[0]),
      vaporKillFaces()[0],
      die(vapor(4, 2).sides[1]),
      vaporSpareFaces()[0],
      die(sleeper.sides[1], sleeper.foes[0].asleep + SLEEP_TICK - 2), // the sleep draw was a raw 2
      [4, 5].find((level) => lone(level).sides[0] !== 6),
      ev(lone(5).events, "vaporRolled").roll,
    ];
  } }],
  Fireballs: [{ says: /^multi-target · (#) bolts · (#) damage each, spread across the foes, \+ your level² damage (#) to each foe struck$/, value: () => {
    const row = SP("Fireballs").dmg;
    // Three bolts at one foe: the level² is in the total once, not once a bolt.
    const r = cast("Fireballs", { foes: 1, fn: (s) => (s === 8 ? 3 : 1) });
    const perBolt = row.n + row.bonus;
    const levelSq = 25;
    return [die(r.sides[0]), dice(row), (999 - r.foes[0].wp - 3 * perBolt) / levelSq];
  } }],
  Petrify: [{ says: /^control · (#) foe · turns to stone/, value: () => reach("Petrify") }],
  Insane: [{ says: /^chaos · (#) foe · a (#) decides it: (#) it dies, (#) it hits the next foe, (#) or (#) it flees, (#) it sleeps (#) rounds, (#) it swings (#) for the fight$/, value: () => {
    const f = insaneFaces();
    const sleep = cast("Insane", { foes: 2, fn: (s, i) => (i === 0 ? 4 : 3) });
    return [reach("Insane", { fn: (s, i) => (i === 0 ? 3 : 1) }), die(cast("Insane", { fn: () => 2 }).sides[0]), f.dies[0], f.hitsNext[0], f.flees[0], f.flees[1], f.sleeps[0], die(sleep.sides[1]), f.frenzy[0], swingsOf({ frenzied: true })];
  } }],
  Summon: [{ says: /^summon · (#) ally · fights beside you (#) rounds$/, value: () => {
    const r = cast("Summon", { foes: 1, fn: () => 1 });
    return [r.state.combat.ally ? 1 : 0, die(r.sides[0], ev(r.events, "allySummoned").rounds - 1)];
  } }],
  Fireball: [{ says: /^burst · (#) foe · hits on (#) \((#)\) before bonuses, for (#) \+ your level² damage$/, value: () => {
    const t = thrown("Fireball");
    return [reach("Fireball"), t.span, t.die, dice(SP("Fireball").dmg)];
  } }],
  "Major Heal": [{ says: / · you · (#) hp$/, value: () => dice(SP("Major Heal").dmg) }],
  Bubble: [{ says: /then a (#) hp film/, value: () => cast("Bubble", { fight: false }).state.c.ward.popPool }],
  "Sense Danger": [],
  "Turn Walking Dead": [],
  "Plane Gate": [{ says: /^answer · (#) Demons or Walking Dead/, value: () => {
    // The reach IS the first draw: a 2 sends exactly two of three Walking Dead away.
    assert.equal(reach("Plane Gate", { type: "Walking Dead", fn: () => 2 }, (f) => !f.alive), 2, "Plane Gate reaches as many foes as its draw");
    return die(cast("Plane Gate", { type: "Walking Dead", foes: 3 }).sides[0]);
  } }],
  "Sense Presence": [],
  Lightning: [{ says: /^multi-target · every foe · hits each on (#) \((#)\) before bonuses, for (#) \+ your level² damage apiece$/, value: () => {
    const t = thrown("Lightning");
    return [t.span, t.die, dice(SP("Lightning").dmg)];
  } }],
  Regeneration: [{ says: /^healing · you · (#) hp a round, this fight$/, value: () => die(cast("Regeneration", { fn: () => 2 }).sides[0]) }],
  Mangle: [{ says: /^burst · (#) foe · hits on (#) \((#)\) before bonuses, for (#) \+ your level² damage$/, value: () => {
    const t = thrown("Mangle");
    return [reach("Mangle"), t.span, t.die, dice(SP("Mangle").dmg)];
  } }],
  Death: [{ says: /costs you (#) hp$/, value: () => ev(cast("Death", { foes: 2, foeOver: { intel: 1 } }).events, "deathCast").cost }],
  "Open/Lock": [{ says: /if you reach (#) within (#) squares, (#) squares per school bonus point/, value: () => [freeChests(), timerLeft("Open/Lock"), squaresStep("Open/Lock")] }],
  Fly: [{ says: /^utility · you · flight for (#) squares, (#) squares per school bonus point: .* water costs (#) square;/, value: () => [
    timerLeft("Fly"),
    squaresStep("Fly"),
    moveCost(liveSpell("Fly"), { water: true }),
  ] }],
  "Enchant Character": [{ says: /^buff · you · for (#) squares, (#) squares per school bonus point: (#) to hit, foes (#) to hit you/, value: () => {
    const on = liveSpell("Enchant Character");
    const off = bareState();
    return [timerLeft("Enchant Character"), squaresStep("Enchant Character"), toHit(on) - toHit(off), foeToHitVs(on) - foeToHitVs(off)];
  } }],
  "Speed of Sound": [{ says: /^buff · you · for (#) squares, (#) squares per school bonus point: (#) blows every time you swing/, value: () => [timerLeft("Speed of Sound"), squaresStep("Speed of Sound"), hastedBlows()] }],
  "Stop Time": [{ says: /stopped for (#) rounds, (#) round per school bonus point, unless it resists: .* at least the top (#) numbers of your die/, value: () => {
    const r = cast("Stop Time", { foes: 2 });
    return [ev(r.events, "timeStopped").rounds, roundsStep(), targetStrikeFaces(r.state.c, r.foes[0], 1)];
  } }],
  Senseless: [{ says: /^control · (#) foe · loses its senses for (#) rounds, (#) round per school bonus point/, value: () => {
    assert.equal(SP("Senseless").stretch, "rounds", "Senseless stretches in rounds, through the one spellEffectRounds");
    return [reach("Senseless", { fn: () => 3 }, (f) => !!f.misdirect), die(cast("Senseless", { foes: 2, fn: () => 1 }).sides[0]), roundsStep()];
  } }],
  "Duplicate Foe": [{ says: /^control · (#) foe · meets its double and fights it for (#) rounds, (#) round per school bonus point/, value: () => {
    assert.equal(SP("Duplicate Foe").stretch, "rounds", "Duplicate Foe stretches in rounds, through the one spellEffectRounds");
    const r = cast("Duplicate Foe", { foes: 1, fn: () => 1 });
    return [reach("Duplicate Foe", { fn: () => 3 }, (f) => !!f.misdirect), die(r.sides[0], ev(r.events, "foeMisdirected").rounds - 1), roundsStep()];
  } }],
  "Door Illusion": [{ says: /rolls (#) resist and may see through it/, value: () => doorResists() }],
  "Chameleon Tongue": [{ says: /at (#) to the roll, which even Magical foes will hear \(the Walking Dead still won't\); it spends the fight's (#) parley$/, value: () => [tongueBonus(), parleysSpent()] }],
  "Size of the Behemoth": [{ says: /a high roll \((#); (#) if you insulted them\) for (#) damage$/, value: () => {
    const r = cast("Size of the Behemoth", { level: 4, foeOver: { lvl: 5 } });
    const f = foeFaces(r.state, r.foes[0]);
    return [d20(f.plain), spanOf(f.insulted), halfOf(blowLoss(r.state), plainBlowLoss({ lvl: 5 }))];
  } }],
};

// ---------------------------------------------------------------------------
// the engine's numbers: abilities and skills
// ---------------------------------------------------------------------------

/** extremes(run) — the d(sides)+bonus a scalar result covers, from the result with every die on 1 and on its top face. */
function extremes(run) {
  const lo = run(() => 1);
  const hi = run((s) => s);
  return die(hi - lo + 1, lo - 1);
}

const THIEF = { cls: "Thief", sub: "Burglar" };
/** hero(role, over) — a level-3 fighter or thief with a Club, the abilities and skills named, and `foes` live foes; `opened2` skips every opening-blow rule. */
function fightState({ role = "Fighter", level = 3, abilities = [], skills = {}, c = {}, foes = 1, foeOver = {}, combat = {} } = {}) {
  const who = role === "Thief" ? THIEF : { cls: "Fighter", sub: "Woodsman" };
  const list = Array.from({ length: foes }, (_, i) => fixedFoe({ name: `F${i + 1}`, lvl: 3, ...foeOver }));
  return fixedState({ ...who, level, abilities, skills, weapon: "Club", ...c }, { combat: fixedCombat(list, { opened2: true, ...combat }) });
}
const strikeEvent = (events) => events.find((e) => e.type === "struck" || e.type === "strikeMissed");
const blows = (events) => evs(events, "struck").length + evs(events, "strikeMissed").length;
function use(id, opts = {}, fn = () => 2) {
  const role = ABILITY_BY_ID[id].cls;
  const state = fightState({ role, abilities: [id], ...opts });
  const rng = rngBy(fn);
  const events = useAbility(state, id, rng, []);
  return { state, events, rng };
}
function plain(opts = {}, fn = () => 2) {
  const state = fightState(opts);
  const events = [];
  playerStrike(state, rngBy(fn), events);
  return { state, events };
}
/** shiftOf(id) — the to-hit an ability's strike adds, signed from the hero's side: how many numbers lower the lowest winning one gets. */
const shiftOf = (id) => plain({ role: ABILITY_BY_ID[id].cls }, () => 2).events.find(strikeEventIs).atLeast - strikeEvent(use(id, {}, () => 2).events).atLeast;
function strikeEventIs(e) {
  return e.type === "struck" || e.type === "strikeMissed";
}
/** usesPerFight(id) — how many times the engine lets one fight use the ability. */
function usesPerFight(id, opts = {}) {
  const state = fightState({ role: ABILITY_BY_ID[id].cls, abilities: [id], ...opts });
  const events = [];
  for (let i = 0; i < 4; i++) useAbility(state, id, rngBy(() => 2), events);
  return evs(events, "abilityUsed").length;
}
/**
 * readyAfter(id) — Phase 91.1 plan 02 (V1 to V5): how many rounds after the use an ability is usable again, measured from the engine:
 * use it once, play plain rounds until the timer is gone, and count the rounds that passed since the use round (used in round R, ready in round R + N).
 */
function readyAfter(id, opts = {}) {
  const state = fightState({ role: ABILITY_BY_ID[id].cls, abilities: [id], foeOver: { wp: 9999, maxWP: 9999 }, ...opts });
  const start = state.combat.round;
  useAbility(state, id, rngBy(() => 2), []);
  for (let i = 0; i < 40 && !isReady(state.c, `ability:${id}`); i++) playerStrike(state, rngBy(() => 2), []);
  return state.combat.round - start;
}
/** liveRounds(id) — the rounds a duration ability's effect still has right after the use (the use round's foe turn already ticked it once). */
const liveRounds = (id) => use(id).state.c.timers[`ability:${id}`].left;
/** foeShift(id) — what a live ability puts on every foe's to-hit against the hero, signed from the foe's side. */
const ABILITY_TIMER = (key) => ({ [`ability:${key}`]: { cadence: "rounds", left: 2, phase: "effect", cd: 5 } });
const foeShift = (id) => foeToHitVs(fightState({ c: { timers: ABILITY_TIMER(id) } })) - foeToHitVs(fightState());

/** strikeDmg(events) — the damage of the first landed blow. */
const strikeDmg = (events) => evs(events, "struck")[0].dmg;
/** ratioOf(a, b) — a landed blow's damage against the plain one. */
const ratioOf = (after, plainDmg) => after / plainDmg;

function deathTouchFinish() {
  // The lowest foe hit points a landed Death Touch does NOT finish outright (the blow itself is far too small to kill any of them).
  for (let wp = 1; wp < 60; wp++) {
    const r = use("deathTouch", { foeOver: { wp, maxWP: wp, lvl: 3 } });
    if (!evs(r.events, "deathTouch").length) return wp;
  }
  return Infinity;
}
function lastStandQuarter() {
  let top = 0;
  for (let hp = 1; hp <= 100; hp++) {
    const r = use("lastStand", { c: { wp: hp, maxWP: 100 } });
    if (!evs(r.events, "abilityRefused").length) top = hp;
  }
  return top / 100;
}
function silentStepDoubling() {
  const light = use("silentStep", { c: { armor: "Leather" } });
  const heavy = use("silentStep", { c: { armor: "Plate" } });
  return strikeDmg(light.events) / strikeDmg(heavy.events);
}
function soakFaces(taunt) {
  const c = { ar: 3, armorWP: 50, armorMax: 50, armorMin: 0, armor: "Chain" };
  const state = fightState({ abilities: ["taunt"], c });
  const events = [];
  if (taunt) useAbility(state, "taunt", rngBy(() => 1), events);
  else foeTurn(state, rngBy(() => 1), events);
  const soak = ev(events, "armorSoaked");
  return 21 - soak.atLeast;
}
function braceHalf() {
  const r = use("brace", {}, () => 1);
  const lost = 999 - r.state.c.wp;
  return halfOf(lost, plainBlowLoss({ lvl: 3 }));
}
function hamstringHalf() {
  const r = use("hamstring", {}, () => 1);
  return halfOf(blowLoss(r.state), plainBlowLoss({ lvl: 3 }));
}
function sweepNumbers() {
  const r = use("sweep", { foes: 3 }, (s, i) => 2 + i);
  const swept = evs(r.events, "sweptFoe").map((e) => e.dmg);
  const full = weaponDamage(r.state.c, rngBy(() => 2));
  return { rolls: new Set(swept).size, half: halfOf(swept[0], full), minFoes: [0, 1, 2, 3].find((n) => abilityShortfall("sweep", n) === null) };
}
function markPlus() {
  const state = fightState({ role: "Thief", abilities: ["mark"] });
  useAbility(state, "mark", rngBy(() => 2), []);
  const marked = [];
  playerStrike(state, rngBy(() => 2), marked);
  return strikeDmg(marked) - strikeDmg(plain({ role: "Thief" }).events);
}
function poisonNumbers() {
  const r = use("poisonedEdge", { foeOver: { wp: 999 } }, () => 2);
  const f = r.state.combat.foes[0];
  const dmg = dice(f.dot.dmg);
  let ticks = evs(r.events, "dotTick").length;
  for (let i = 0; i < 6; i++) {
    const e = [];
    foeTurn(r.state, rngBy(() => 2), e);
    ticks += evs(e, "dotTick").length;
  }
  return { dmg, ticks };
}
function stealthNumbers() {
  const dieN = strikeDie(fightState().c);
  const crits = [];
  for (let raw = 1; raw <= dieN; raw++) {
    const state = fightState({ skills: { Stealth: 1 }, combat: { opened2: false } });
    const events = [];
    playerStrike(state, rngBy((s, i) => (i === 0 ? raw : 2)), events);
    if (evs(events, "stealthStrike").length) crits.push(raw);
  }
  return crits.length;
}
function hardinessNumbers() {
  const loss = (dmg) => {
    const state = fightState({ skills: { Hardiness: 1 } });
    applyFoeDamageToPlayer(state, state.combat.foes[0], rngBy(), [], { dmg, roll: 10, atLeast: 8, dieN: 20, mods: [] });
    return 999 - state.c.wp;
  };
  const joinerLoss = (dmg) => {
    const sheet = joinerFighter({ skills: { Hardiness: 1 }, wp: 100, maxWP: 100 });
    const s = partyFight([sheet], [fixedFoe({ name: "Brute" })]);
    applyFoeDamageToMember(s, s.combat.foes[0], s.combat.allies[0], rngBy(), [], { dmg, roll: 5, atLeast: 4, dieN: 8, mods: [], swing: 0 });
    return 100 - s.combat.allies[0].wp;
  };
  // Phobia: the shrug-off is the roll-high faces a d2 gives (the failed shrug's roll carries them).
  const state = fightState({ skills: { Hardiness: 1 }, c: { phobiaType: "Humans" }, combat: { pending: true, opened2: false } });
  const events = [];
  fight(state, rngBy(() => 2), events);
  const shrug = ev(events, "phobiaAfraid");
  return { hero: loss(10) - 10, floor: loss(2), joiner: 10 - joinerLoss(10), phobia: (shrug.dieN + 1 - shrug.atLeast) / shrug.dieN };
}

// A Joiner Fighter sheet and a live fight with a party (the shape test/unit/spell-skill-audit-fixes.test.js builds).
function joinerFighter(overrides = {}) {
  return {
    name: "Brom", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 40, maxWP: 40, status: "ok",
    weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0,
    potions: 0, worn: {},
    ...overrides,
  };
}
function partyFight(sheets, foes) {
  return fixedState(
    { cls: "Fighter", sub: "Soldier", level: 1, abilities: [] },
    {
      party: sheets,
      combat: fixedCombat(foes, { allies: sheets.map((s, i) => ({ partyIdx: i, name: s.name, lvl: s.level, sub: s.sub, wp: s.wp, maxWP: s.maxWP })) }),
    },
  );
}
function ambidextrousNumbers() {
  const hero = fightState({ skills: { Ambidextrous: 1 } });
  const e = [];
  playerStrike(hero, rngBy(() => 2), e);
  const s = partyFight([joinerFighter({ skills: { Ambidextrous: 1 } })], [fixedFoe({ name: "Tough", wp: 900, maxWP: 900 })]);
  const je = alliesTurn(s, rngBy(() => 1), []);
  return { hero: blows(e), joiner: evs(je, "allyMissed").length + evs(je, "allyStruck").length };
}
function cookingNumbers() {
  const fed = (maxWP) => {
    const state = fightState({ skills: { Cooking: 1 }, c: { wp: 100, maxWP: 999 }, foeOver: { type: "Beasts", wp: 1, maxWP } });
    const events = [];
    playerStrike(state, rngBy(() => 2), events);
    return ev(events, "cooked").wp;
  };
  return { quarter: fed(40) / 40, atLeast: fed(1) };
}
function lockSpan({ tier = 1, picks = false, intel = 10 } = {}) {
  const state = fixedState({ skills: { Locks: tier }, intel, items: picks ? [{ kind: "picks" }] : [] });
  const e = ev(openChest(state, rngBy(() => 20), []), "chestLockRolled");
  return { span: { lo: e.atLeast, hi: e.dieN }, die: die(e.dieN) };
}
function lockIntel() {
  const lo = (intel) => lockSpan({ intel }).span.lo;
  const up = (n) => [...Array(26).keys()].find((intel) => lo(intel) <= lo(1) - n);
  return { first: up(1), second: up(2), step: lo(up(1)) - lo(up(2)) === 1 ? 1 : NaN };
}
function sewingNumbers(tier) {
  const day = (fn, hurt) => {
    const state = fixedState({ skills: { Sewing: tier }, armor: "Leather", ar: 3, armorWP: 0, armorMax: 999, patches: hurt, rations: 9 });
    const events = [];
    newDay(state, true, rngBy(fn), events);
    return evs(events, "armorPatched");
  };
  // The die: the amount on every die 1 and on its top face (a d6, plus 3 for the second tier).
  const dieOf = extremes((fn) => day(fn, 0)[0].amount);
  // Once a day, and how many days in all before the patching stops.
  const state = fixedState({ skills: { Sewing: tier }, armor: "Leather", ar: 3, armorWP: 0, armorMax: 999, rations: 99 });
  let total = 0;
  let perDay = 0;
  for (let d = 0; d < 12; d++) {
    const events = [];
    state.c.armorWP = 0;
    newDay(state, true, rngBy(() => 1), events);
    const n = evs(events, "armorPatched").length;
    perDay = Math.max(perDay, n);
    total += n;
  }
  return { die: dieOf, perDay, total };
}
function acuteRange() {
  let far = 0;
  for (let k = 1; k <= 6; k++) {
    const state = fixedState({ skills: { "Acute Hearing": 1 } });
    state.floor.g[1][1 + k].feat = "dot";
    state.floor.g[1][1 + k].seen = false;
    if (heardSquares(state).length) far = k;
  }
  return far;
}
function heftNumbers() {
  const sheet = (skills) => fixedState({ cls: "Thief", sub: "Burglar", skills }).c;
  return {
    plus: weaponDamageTerms(sheet({ Heft: 1 })).bonus - weaponDamageTerms(sheet({})).bonus,
    half: upkeep(sheet({ Heft: 1 })) / upkeep(sheet({})),
  };
}

const AB = (id) => ABILITY_BY_ID[id];
const kataLike = (id) => [{ says: /: (#) to hit on this strike, and it adds your level in damage; ready again (#) rounds after you use it$/, value: () => [shiftOf(id), readyAfter(id)] }];

// --- the facts: every number each ability and skill text states ---------------

export const SKILL_TEXT_FACTS = {
  Kata: kataLike("kata"),
  Feint: kataLike("feint"),
  "Death Touch": [{ says: /^call it: (#) swing, rolled as normal; if it lands it (#) and finishes anything under (#) hp; (#) per fight$/, value: () => {
    const dt = use("deathTouch", { foeOver: { wp: 999 } });
    return [blows(dt.events), ratioOf(strikeDmg(dt.events), strikeDmg(plain().events)), deathTouchFinish(), usesPerFight("deathTouch")];
  } }],
  Sidestep: [{ says: /^(#) rounds of not being where the blade is: foes (#) to hit you$/, value: () => [liveRounds("sidestep"), foeShift("sidestep")] }],
  "Pommel Strike": [],
  "Battle Roar": [{ says: /for (#) rounds foes (#) to hit anyone on your side$/, value: () => [liveRounds("battleRoar"), foeShift("battleRoar")] }],
  "Second Wind": [{ says: /heal (#) \+ level; ready again (#) rounds after you use it$/, value: () => [
    extremes((fn) => ev(use("secondWind", { c: { wp: 1, maxWP: 999 } }, fn).events, "secondWindHealed").rolled - 3),
    readyAfter("secondWind", { c: { wp: 500, maxWP: 999 } }),
  ] }],
  Sweep: [{ says: /^(#) wide arc: every living foe takes (#) damage; needs (#) or more foes$/, value: () => {
    const s = sweepNumbers();
    return [s.rolls, s.half, s.minFoes];
  } }],
  Brace: [{ says: /^(#) the next blow that lands on you$/, value: () => braceHalf() }],
  Riposte: [{ says: /^for (#) round every foe that misses you eats your weapon damage$/, value: () => liveRounds("riposte") }],
  Taunt: [{ says: /your armour soaks (#)$/, value: () => soakFaces(true) / soakFaces(false) }],
  "Overhead Blow": [{ says: /^everything into (#) swing: (#) damage, but (#) to hit; ready again (#) rounds after you use it$/, value: () => {
    const oh = use("overheadBlow", { foeOver: { wp: 999 } }, () => 2);
    return [blows(oh.events), ratioOf(strikeDmg(oh.events), strikeDmg(plain().events)), shiftOf("overheadBlow"), readyAfter("overheadBlow")];
  } }],
  "Last Stand": [{ says: /^under a (#) hp: (#) attacks this round; ready again (#) rounds after you use it$/, value: () => [
    lastStandQuarter(),
    blows(use("lastStand", { c: { wp: 10, maxWP: 100 } }).events),
    readyAfter("lastStand", { c: { wp: 2400, maxWP: 10000 } }),
  ] }],
  "Silent Step": [{ says: /never misses and (#) its damage, any round; (#) per fight; .* lose the (#)$/, value: () => [silentStepDoubling(), usesPerFight("silentStep"), silentStepDoubling()] }],
  "Dirty Trick": [{ says: /blinded for (#) rounds, so it hits only on its best roll \((#)\) and never/, value: () => {
    const r = use("dirtyTrick");
    return [ev(r.events, "dirtyTrickLanded").rounds, d20(foeFaces(r.state, r.state.combat.foes[0]).plain)];
  } }],
  Smoke: [{ says: /for (#) rounds foes hit you only on their best roll \((#); (#) if you insulted them\), and a flee during it just works; ready again (#) rounds after you use it$/, value: () => {
    const r = use("smoke");
    const f = foeFaces(r.state, r.state.combat.foes[0]);
    return [liveRounds("smoke"), d20(f.plain), spanOf(f.insulted), readyAfter("smoke")];
  } }],
  Cutpurse: [{ says: /^lift (#) × level gold off the target mid-fight; it has other problems; (#) per fight$/, value: () => [
    extremes((fn) => ev(use("cutpurse", {}, fn).events, "cutpursed").amount / 3),
    usesPerFight("cutpurse"),
  ] }],
  "Poisoned Edge": [{ says: /weeps: (#) a round to the target for (#) rounds$/, value: () => {
    const p = poisonNumbers();
    return [p.dmg, p.ticks];
  } }],
  Hamstring: [{ says: /blows do (#) damage for the rest of the fight; ready again (#) rounds after you use it, on a foe that is not already hamstrung$/, value: () => [hamstringHalf(), readyAfter("hamstring")] }],
  Mark: [{ says: /adds (#) damage for the rest of the fight; ready again (#) rounds after you use it, on a foe that is not already marked$/, value: () => [markPlus(), readyAfter("mark")] }],
  Stealth: [{ says: /crits on the top (#) numbers of your die \((#)\)/, value: () => [stealthNumbers(), d20(stealthNumbers())] }],
  Hardiness: [{ says: /^(#) to every blow, bolt and trap that hurts you \(never below (#)\), and a Joiner with it takes (#) less from each blow; phobias (#)$/, value: () => {
    const h = hardinessNumbers();
    return [h.hero, h.floor, h.joiner, h.phobia];
  } }],
  Ambidextrous: [{ says: /^(#) swings every time you strike, each rolling to hit and for damage, and a Joiner with it swings (#) on a plain strike/, value: () => {
    const a = ambidextrousNumbers();
    return [a.hero, a.joiner];
  } }],
  Cooking: [{ says: /you heal a (#) of its max hp \(at least (#)\)/, value: () => {
    const k = cookingNumbers();
    return [k.quarter, k.atLeast];
  } }],
  "Runes/Signs": [],
  Locks: [{ says: /^(#) on (#) to open a lock, (#) with lockpicks; intelligence (#) and (#) each add (#) more number;/, value: () => {
    const intel = lockIntel();
    return [lockSpan().span, lockSpan().die, lockSpan({ picks: true }).span, intel.first, intel.second, intel.step];
  } }],
  "Locks#txt2": [{ says: /^(#) on (#) to open a lock, (#) with lockpicks; intelligence (#) and (#) each add (#) more number;/, value: () => {
    const intel = lockIntel();
    return [lockSpan({ tier: 2 }).span, lockSpan({ tier: 2 }).die, lockSpan({ tier: 2, picks: true }).span, intel.first, intel.second, intel.step];
  } }],
  Sewing: [{ says: /^(#) on each fed day's rest, patch hurt armour: (#) hp back, (#) times in all$/, value: () => {
    const s = sewingNumbers(1);
    return [s.perDay, s.die, s.total];
  } }],
  "Sewing#txt2": [{ says: /^(#) on each fed day's rest, patch hurt armour: (#) hp back, (#) times in all$/, value: () => {
    const s = sewingNumbers(2);
    return [s.perDay, s.die, s.total];
  } }],
  "Night Vision": [],
  Heft: [{ says: /^(#) damage, mail armour, (#) upkeep$/, value: () => {
    const h = heftNumbers();
    return [h.plus, h.half];
  } }],
  "Acute Hearing": [{ says: /up to (#) squares away/, value: () => acuteRange() }],
};

/** SKILL_ROWS — every ability and passive skill text the guard reads, as [key, text]. A table skill with an `active` marker IS its catalog ability (same text, tested below). */
const SKILL_ROWS = [
  ...ABILITIES.map((a) => [a.name, a.txt]),
  ...[...Object.entries(FIGHTER_SKILLS), ...Object.entries(THIEF_SKILLS)].flatMap(([name, r]) => (r.active ? [] : [[name, r.txt], ...(r.txt2 ? [[`${name}#txt2`, r.txt2]] : [])])),
];

test("every ability and skill text has an entry in SKILL_TEXT_FACTS, and no entry is for a text that is not in the game", () => {
  const keys = SKILL_ROWS.map(([k]) => k);
  for (const k of keys) assert.ok(k in SKILL_TEXT_FACTS, `${k}: no SKILL_TEXT_FACTS entry (an empty list says the text states no number)`);
  for (const k of Object.keys(SKILL_TEXT_FACTS)) assert.ok(keys.includes(k), `${k}: a fact for a text that is not in ABILITIES, FIGHTER_SKILLS or THIEF_SKILLS`);
  assert.equal(new Set(keys).size, keys.length, "no two rows share a key");
});

for (const [key, text] of SKILL_ROWS) {
  test(`${key}: every number the text states is claimed by one fact and equals the engine`, () => {
    assert.deepEqual(checkRow(key, text, SKILL_TEXT_FACTS[key]), []);
  });
}

test("a table skill and its catalog ability carry the very same text, so one fact table covers both", () => {
  for (const [name, r] of [...Object.entries(FIGHTER_SKILLS), ...Object.entries(THIEF_SKILLS)]) {
    if (!r.active) continue;
    assert.equal(ABILITY_BY_ID[r.active].name, name, `${name}: the active marker names its catalog ability`);
    assert.equal(r.txt, ABILITY_BY_ID[r.active].txt, `${name}: the table text is the catalog text`);
  }
});

// ---------------------------------------------------------------------------
// the dice rows the facts read from content are the dice the engine rolls
// ---------------------------------------------------------------------------

/**
 * rowRange(n) — the least and the most a real cast of `n` deals or heals (the level² term taken off), with every die on 1 and on its
 * top face. The to-hit draw of a thrown spell answers its best face either way; Fireballs rolls one bolt.
 */
function rowRange(n) {
  const sp = byName(n);
  const levelSq = 25; // a level-5 caster
  const run = (policy) => {
    const fn = (s, i) => {
      if (sp.kind === "thrown" && i === 0) return 1;
      if (sp.kind === "volley" && s === 8) return 1;
      return policy(s);
    };
    if (sp.kind === "heal") return ev(cast(n, { fight: false, fn }).events, "healed").amount;
    const r = cast(n, { foes: 1, fn });
    if (sp.kind === "thrown") return ev(r.events, "spellHit").dmg - levelSq;
    if (sp.kind === "blast") return ev(r.events, "spellHit").dmg - levelSq;
    if (sp.kind === "acid") return ev(r.events, "acidTick").dmg - levelSq;
    return 999 - r.foes[0].wp - levelSq; // quake and volley: the hit points one foe lost
  };
  return { min: run(() => 1), max: run((s) => s) };
}

test("every dice row a spell fact reads (Heal, Major Heal, Freeze, Acid, Ice, Earthquake, Fireballs, Fireball, Lightning, Mangle) is the dice the engine really rolls", () => {
  for (const n of ["Heal", "Major Heal", "Freeze", "Acid", "Ice", "Earthquake", "Fireballs", "Fireball", "Lightning", "Mangle"]) {
    const { n: count, sides, bonus } = byName(n).dmg;
    assert.deepEqual(rowRange(n), { min: count + (bonus || 0), max: count * sides + (bonus || 0) }, `${n}: ${count}d${sides}+${bonus || 0}`);
  }
});

test("the d4 an Ice freeze and a Freeze state is the engine's FREEZE_HOLD_DIE", () => {
  assert.equal(FREEZE_HOLD_DIE, 4);
  assert.equal(cast("Freeze", { fn: () => 2 }).sides[2], FREEZE_HOLD_DIE);
  assert.equal(cast("Ice", { foes: 2, fn: () => 2 }).sides[1], FREEZE_HOLD_DIE);
});

test("the constants the ability facts lean on are the numbers the texts state (a changed constant fails here first)", () => {
  assert.equal(KATA_FEINT_NEED_SHIFT, 3);
  assert.equal(SWEEP_MIN_FOES, 2);
  assert.deepEqual([DURATION_ROUNDS.sidestep, DURATION_ROUNDS.battleRoar, DURATION_ROUNDS.riposte, DURATION_ROUNDS.smoke], [2, 2, 1, 2]);
});

// ---------------------------------------------------------------------------
// the guard itself: the parser's edges and the checker on doctored text
// ---------------------------------------------------------------------------

const MINUS = "−"; // U+2212, the sign every negative shift uses
const EN_DASH = "–"; // U+2013, the dash every range uses
const toks = (t) => numbersIn(t).map((x) => [x.kind, x.value]);

test("numbersIn reads digits, number words, dice, signed numbers with U+2212 and ranges with the en dash (the SPELL-08 encoding edge)", () => {
  assert.deepEqual(toks("d10"), [["dice", { n: 1, sides: 10, bonus: 0 }]]);
  assert.deepEqual(toks("2d6+2"), [["dice", { n: 2, sides: 6, bonus: 2 }]]);
  assert.deepEqual(toks("d4+1 rounds"), [["dice", { n: 1, sides: 4, bonus: 1 }]]);
  assert.deepEqual(toks("100 squares"), [["digits", 100]]);
  assert.deepEqual(toks("for two rounds"), [["word", 2]]);
  assert.deepEqual(toks(`${MINUS}2 to hit`), [["signed", -2]], "the U+2212 minus is a sign: −2 to hit is -2");
  assert.deepEqual(toks("+10 squares"), [["signed", 10]]);
  assert.deepEqual(toks(`16${EN_DASH}20`), [["span", { lo: 16, hi: 20 }]], "the U+2013 en dash makes a range: 16–20 is 16 to 20");
  assert.deepEqual(toks(`18${EN_DASH}20 on a d20`), [["range", { lo: 18, hi: 20, die: 20 }]]);
  assert.deepEqual(toks("20 on a d20"), [["range", { lo: 20, hi: 20, die: 20 }]]);
  assert.deepEqual(toks("hits on 5–10 (d10)"), [["span", { lo: 5, hi: 10 }], ["dice", { n: 1, sides: 10, bonus: 0 }]]);
  assert.deepEqual(toks("half and doubles and a quarter"), [["word", 0.5], ["word", 2], ["word", 0.25]]);
});

test("a hyphen-minus sign and an ASCII-hyphen range are not numbers the parser pairs up: their digits fall out as separate numbers the guard then fails", () => {
  assert.deepEqual(toks("-2 to hit"), [["digits", 2]], "a hyphen-minus is not the U+2212 sign");
  assert.deepEqual(toks("16-20"), [["digits", 16], ["digits", 20]], "an ASCII hyphen is not the U+2013 dash");
});

test("the four idioms that are not numbers are not read as numbers: at once, its double, one that, one perfect form", () => {
  assert.deepEqual(toks("talk at once"), []);
  assert.deepEqual(toks("meets its double"), []);
  assert.deepEqual(toks("one that fails"), []);
  assert.deepEqual(toks("one perfect form"), []);
  assert.deepEqual(toks("one foe and once per fight"), [["word", 1], ["word", 1]], "a count of one is still a number");
});

const FAKE_FACTS = [{ says: /^hits (#) foes for (#) rounds, (#) to hit/, value: () => [3, die(4, 1), -2] }];
const FAKE_TEXT = `hits three foes for d4+1 rounds, ${MINUS}2 to hit`;

test("checkRow passes a text whose every number is claimed and true", () => {
  assert.deepEqual(checkRow("fake", FAKE_TEXT, FAKE_FACTS), []);
});

test("checkRow fails a CHANGED number (the engine says something else), by name", () => {
  const problems = checkRow("fake", `hits four foes for d4+1 rounds, ${MINUS}2 to hit`, FAKE_FACTS);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fake: the text says "four" but the engine says 3/);
  assert.match(checkRow("fake", FAKE_TEXT.replace("d4+1", "d6+1"), FAKE_FACTS)[0], /"d6\+1" but the engine says .*"sides":4/);
  assert.match(checkRow("fake", FAKE_TEXT.replace(MINUS, "+"), FAKE_FACTS)[0], /"\+2" but the engine says -2/);
});

test("checkRow fails an ADDED number nobody claims, naming it", () => {
  const problems = checkRow("fake", `${FAKE_TEXT}; once per fight`, FAKE_FACTS);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fake: unclaimed number "once" \(no fact pins it to the engine\)/);
  assert.match(checkRow("fake", FAKE_TEXT.replace("rounds", "rounds (5–8 on a d8)"), FAKE_FACTS).join("\n"), /unclaimed number "5–8 on a d8"/);
});

test("checkRow fails a VANISHED sentence, and a number two facts claim", () => {
  assert.match(checkRow("fake", "hits nobody", FAKE_FACTS)[0], /fake: the text no longer says/);
  const twice = [...FAKE_FACTS, { says: /^hits (#) foes/, value: () => 3 }];
  assert.match(checkRow("fake", FAKE_TEXT, twice).join("\n"), /number "three" is claimed by 2 facts/);
  const arity = [{ says: /^hits (#) foes for (#) rounds/, value: () => [3] }];
  assert.match(checkRow("fake", FAKE_TEXT, arity)[0], /captures 2 numbers but the fact gives 1 values/);
});

/** bump(token) — the same text with ONE stated number changed to a different one of the same kind. */
function bump(text, t) {
  let raw;
  if (t.kind === "digits") raw = String(t.value + 1);
  else if (t.kind === "signed") raw = `${t.raw[0]}${Number(t.raw.slice(1)) + 1}`;
  else if (t.kind === "dice") raw = t.raw.replace(/d(\d+)/, (m, s) => `d${Number(s) + 1}`);
  else if (t.kind === "span") raw = `${t.value.lo - 1}${EN_DASH}${t.value.hi}`;
  else if (t.kind === "range") raw = `${t.value.lo - 1}${t.value.lo === t.value.hi ? "" : `${EN_DASH}${t.value.hi}`} on a d${t.value.die}`;
  else raw = t.raw.toLowerCase() === "twelve" ? "eleven" : "twelve";
  return { text: text.slice(0, t.start) + raw + text.slice(t.end), raw };
}

const ALL_ROWS = [...SPELLS.map((sp) => [sp.n, sp.txt, SPELL_TEXT_FACTS[sp.n]]), ...SKILL_ROWS.map(([k, t]) => [k, t, SKILL_TEXT_FACTS[k]])];

test("every number in every spell, ability and skill text is bound to the engine: changing any one of them fails the guard on exactly that number", () => {
  let changed = 0;
  for (const [name, text, facts] of ALL_ROWS) {
    for (const t of numbersIn(text)) {
      const doctored = bump(text, t);
      const problems = checkRow(name, doctored.text, facts);
      assert.ok(problems.some((p) => p.includes(`the text says "${doctored.raw}"`)), `${name}: changing "${t.raw}" to "${doctored.raw}" was not caught (${problems.join(" | ") || "no problem"})`);
      changed++;
    }
  }
  assert.ok(changed >= 150, `the guard binds a lot of numbers, saw ${changed}`);
});

test("every number in every text is claimed: dropping any fact leaves an unclaimed number (no fact is decoration)", () => {
  for (const [name, text, facts] of ALL_ROWS) {
    for (let i = 0; i < facts.length; i++) {
      const rest = facts.filter((_, j) => j !== i);
      assert.ok(checkRow(name, text, rest).some((p) => /unclaimed number/.test(p) || /no longer says/.test(p)), `${name}: fact ${i} claims nothing`);
    }
  }
});

// ---------------------------------------------------------------------------
// the guard
// ---------------------------------------------------------------------------

test("every spell has an entry in SPELL_TEXT_FACTS, and no entry is for a spell that is not in the game", () => {
  for (const sp of SPELLS) assert.ok(sp.n in SPELL_TEXT_FACTS, `${sp.n}: no SPELL_TEXT_FACTS entry (an empty list says the text states no number)`);
  for (const n of Object.keys(SPELL_TEXT_FACTS)) assert.ok(byName(n), `${n}: a fact for a spell that is not in SPELLS`);
});

for (const sp of SPELLS) {
  test(`${sp.n}: every number the text states is claimed by one fact and equals the engine`, () => {
    assert.deepEqual(checkRow(sp.n, sp.txt, SPELL_TEXT_FACTS[sp.n]), []);
  });
}
