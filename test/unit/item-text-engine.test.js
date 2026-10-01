// test/unit/item-text-engine.test.js
//
// Phase 89 plan 10 (ITEM-01, ITEM-06, TEXT-01 item share): the text-vs-engine
// guard. An item's text is the promise to the player; this file fails the day
// a number in that text and the number the engine uses drift apart.
//
// HOW IT WORKS
//   - `numbersIn(text)` finds every number an item text states: digits, number
//     words (fifty, a hundred, once, twice, half, double), signed numbers
//     (+11, U+2212 2), dice with or without a leading 1 (d20+10, 1d10+4) and
//     d20 ranges ("19–20 on a d20", the bare "19–20" after it) with the one
//     en dash (U+2013) the formatter prints.
//   - `ITEM_TEXT_FACTS` maps every item row to a list of facts
//     `{ says: RegExp, value: () => ... }`. `says` has one capture group per
//     stated number and finds that exact number in the text; `value` reads
//     the same numbers off the ENGINE (a real useItem, a real strike, a real
//     foe swing, the activation record), never off the text.
//   - Completeness: every number numbersIn finds in a row's text must be
//     captured by exactly one fact, so a NEW number nobody pinned fails.
//   - Truth: each captured number must equal the engine's value, so a CHANGED
//     number fails.
//   - The checker is itself tested on doctored text (a changed number, an
//     added number, a vanished sentence).
//
// THE SURFACES (the game builds the text more ways than one): the jewel, cloak
// and staff the rollers build, the store's potion and tool lines, the found
// potion, and `viewModels.js#itemStatLines` all carry the row's text; every
// weapon's label matches its dice and every armour's stat lines match ARMORS.
//
// PARTY-WIDE: every item whose text names the party or every Joiner reaches
// every Joiner in the engine, and every PARTY_WIDE_ITEM_EFFECTS key's text
// names the party.
//
// Gaps found at the close (engine drift no text, ruling or audit row covers)
// are NOT fixed here: they are `todo` tests naming the row. None at 89-10.
//
// Per-file fixture copies (never imported cross-file), after
// test/unit/authored-ranges.test.js and spell-mechanics.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import {
  foeToHitVs,
  foeSwingVsHero,
  strikeDie,
  weaponDamageTerms,
  sizeAxisStep,
  activationFor,
  itemTimerId,
  armorSoak,
  clampCarry,
  PARTY_WIDE_ITEM_EFFECTS,
  heroStrikeFacesVs,
} from "../../engine/derived.js";
import { playerStrike, parley, canParley, foeTurn, applyFoeDamageToPlayer } from "../../engine/combat.js";
import {
  useItem,
  itemReady,
  rollJewel,
  rollCloak,
  rollStaff,
  toolItem,
  narrateTimerTransitions,
  tickHealOverTime,
  TARGETED_KINDS,
} from "../../engine/items.js";
import { tickSquares } from "../../engine/effects.js";
import { useTool } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { openStore } from "../../engine/economy.js";
import { findMisc } from "../../engine/encounters.js";
import { FOE_COUNT_TABLE } from "../../engine/difficulty.js";
import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { itemStatLines, ITEM_STAT_COPY } from "../../src/browser/viewModels.js";
import { gearBagMeterModel, GEAR_COPY } from "../../src/browser/gearTab.js";
import { facesRangeText, signedText } from "../../src/browser/rollRange.js";
import {
  JEWELRY,
  CLOAKS,
  STAVES,
  POTIONS,
  TOOLS,
  TOOL_ORDER,
  BAG_ITEMS,
  BAGS,
  WEAPONS,
  WEAPON_MAX,
  ARMORS,
  ACTIVATION_OF,
  STORE_POTION_POOL,
  MISC_MAGIC,
} from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

// DIALS ships fitted; the reads below (a foe's blow, the soak multiplier) are
// canon-mechanic numbers, so this file runs under the identity override.
setIdentityDials();

// ---------------------------------------------------------------------------
// numbersIn: every number an item text states
// ---------------------------------------------------------------------------

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  once: 1, twice: 2, half: 0.5, double: 2,
};
const WORDS = Object.keys(WORD_NUM).join("|");
const TOKEN_RE = new RegExp(
  "(?<range>\\d+(?:\\u2013\\d+)? on a d\\d+)" +
    "|(?<dice>\\b\\d*d\\d+(?:[+\\u2212]\\d+)?)" +
    "|(?<signed>[+\\u2212]\\d+)" +
    "|(?<span>\\d+\\u2013\\d+)" +
    "|(?<digits>\\d+)" +
    `|(?<word>(?<!\\bat )\\b(?:a hundred|${WORDS})\\b)`,
  "gi",
);

/**
 * numbersIn(text) — every number `text` states, in order, each
 * `{ raw, start, end, kind, value }`:
 *   word/digits -> a number (fifty = 50, a hundred = 100, twice = 2, half = 0.5);
 *   signed      -> a signed number ("+11" = 11, U+2212 "2" = -2);
 *   dice        -> { n, sides, bonus } with a leading 1 optional ("d20+10" = "1d20+10");
 *   range       -> { lo, hi, die } for "19–20 on a d20" (a lone "20 on a d20" is 20..20);
 *   span        -> { lo, hi } for the bare "19–20" (no die named).
 * A hyphen-minus sign or range separator is NOT a recognised sign or dash, so
 * its digits come out as separate unclaimed numbers and fail the guard.
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
 * checkRow(name, text, facts) — every problem the guard finds in one row:
 * a fact whose sentence is gone, a stated number that is not the engine's, a
 * number no fact claims, a number two facts claim.
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

function fakeRng(seq, fill) {
  let i = 0;
  return {
    d(_sides) {
      if (i < seq.length) return seq[i++];
      if (fill !== undefined) return fill;
      throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** recordingRng(cursor) — every draw returns 1 and notes the die it was asked for. */
function recordingRng(cursor = 1) {
  const draws = [];
  return {
    draws,
    d(sides) {
      draws.push(sides);
      return 1;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => cursor,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, intel: 10, timers: {},
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState(cOverrides = {}, rest = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, acts: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** A live `item:<name>` effect record (the c.timers shape a used item leaves). */
const itemTimer = (name) => ({ [`item:${name}`]: { cadence: "squares", left: 10, phase: "effect", cd: 0 } });

const d20Range = (faces) => ({ lo: 21 - faces, hi: 20, die: 20 });
const insultedRange = (faces) => ({ lo: 21 - faces, hi: 20 });

const memo = new Map();
const once = (key, fn) => {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
};

// ---------------------------------------------------------------------------
// sessions: an item in the hand that uses it, the way the game builds it
// ---------------------------------------------------------------------------

const rowOf = (name) => [...JEWELRY, ...CLOAKS, ...STAVES].find((r) => r.n === name);
const familyOf = (name) => {
  if (JEWELRY.some((r) => r.n === name)) return "jewel";
  if (CLOAKS.some((r) => r.n === name)) return "cloak";
  if (STAVES.some((r) => r.n === name)) return "staff";
  if (POTIONS.some((p) => p.n === name)) return "potion";
  if (name === "Torch") return "torch";
  throw new Error(`no family for ${name}`);
};

/** session(name, o) — a state holding the item as the game would (worn, wielded, bagged), foes for a targeted kind. */
function session(name, o = {}) {
  const fam = familyOf(name);
  let item;
  let ref;
  let c = {};
  if (fam === "jewel") {
    item = { kind: "jewel", ...rowOf(name) };
    c = { worn: { jewelry1: item } };
    ref = { slot: "jewelry1" };
  } else if (fam === "cloak") {
    item = { kind: "cloak", ...rowOf(name) };
    c = { worn: { cloak: item } };
    ref = { slot: "cloak" };
  } else if (fam === "staff") {
    const i = STAVES.findIndex((r) => r.n === name);
    item = rollStaff(fakeRng([i + 1]));
    c = { cls: "Magic User", sub: "Wizard", weapon: name, staff: item, worn: {} };
    ref = { slot: "weapon" };
  } else if (fam === "potion") {
    const p = POTIONS.find((r) => r.n === name);
    item = { kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 };
    c = { items: [item], wp: 10 };
    ref = 0;
  } else {
    item = toolItem("torch");
    c = { items: [item], darkFor: 5 };
    ref = 0;
  }
  const act = activationFor(item);
  const foeCount = o.foes ?? (act && TARGETED_KINDS.has(act.kind) ? 5 : 0);
  const foes = Array.from({ length: foeCount }, (_, i) => fixedFoe({ name: `Foe${i}`, intel: 1 }));
  const state = fixedState({ ...c, ...(o.c || {}) }, { combat: foeCount ? fixedCombat(foes) : null, party: o.party ?? [], ...(o.rest || {}) });
  return { state, item, ref, act };
}

const use = (s, rng = makeRng(1)) => useItem(s.state, s.ref, rng, [], () => 1);

/** cycle(name) — a real use, then every square ticked until the item is ready: { effect, cooldown, total }. */
function cycle(name) {
  return once(`cycle:${name}`, () => {
    const s = session(name);
    const events = use(s);
    assert.ok(events.some((e) => e.type === "itemUsed"), `${name} was used: ${events.map((e) => e.type)}`);
    const id = itemTimerId(s.item);
    assert.ok(s.state.c.timers[id], `${name} left a timer record`);
    let effect = 0;
    let cooldown = 0;
    for (let i = 0; i < 400 && s.state.c.timers[id]; i++) {
      const phase = s.state.c.timers[id].phase;
      tickSquares(s.state.c, 1);
      if (phase === "effect") effect++;
      else cooldown++;
    }
    return { effect, cooldown, total: effect + cooldown };
  });
}
const E = (name) => cycle(name).effect;
const CD = (name) => cycle(name).cooldown;

/** usesPerCycle(name) — not ready one square short of the cycle, ready at it: one use per cycle. */
function usesPerCycle(name) {
  return once(`uses:${name}`, () => {
    const s = session(name);
    use(s);
    const { total } = cycle(name);
    for (let i = 0; i < total - 1; i++) tickSquares(s.state.c, 1);
    const early = itemReady(s.state, s.item);
    tickSquares(s.state.c, 1);
    const atEnd = itemReady(s.state, s.item);
    return !early && atEnd ? 1 : early ? 2 : 0;
  });
}

/** staffStats(name) — the charges the game builds the staff with, and how many come back after how many squares. */
function staffStats(name) {
  return once(`staff:${name}`, () => {
    const s = session(name);
    const charges = s.item.charges;
    use(s);
    assert.equal(s.item.charges, charges - 1, `${name}: one charge spent`);
    const before = s.item.charges;
    let squares = 0;
    while (squares < 400 && s.item.charges === before) {
      narrateTimerTransitions(s.state, tickSquares(s.state.c, 1), []);
      squares++;
    }
    return { charges, squares, restored: s.item.charges - before };
  });
}

const dmgDelta = (name) =>
  weaponDamageTerms(fixedFighter({ timers: itemTimer(name) })).bonus - weaponDamageTerms(fixedFighter()).bonus;
const foeToHitDelta = (name) => foeToHitVs(fixedState({ timers: itemTimer(name) })) - foeToHitVs(fixedState({}));
const sizeStep = (name) => sizeAxisStep(fixedFighter({ timers: itemTimer(name) }), "dmg");

/** foeFaces(cOverrides) — the winning faces a foe has against the hero, plain and insulted. */
function foeFaces(cOverrides, combatOverrides = {}) {
  const foe = fixedFoe();
  const plain = fixedState(cOverrides, { combat: fixedCombat([foe], combatOverrides) });
  const insulted = fixedState(cOverrides, { combat: fixedCombat([foe], { ...combatOverrides, parleyInsulted: true }) });
  return { plain: foeSwingVsHero(plain, foe).faces, insulted: foeSwingVsHero(insulted, foe).faces };
}
const invisFaces = (name) => once(`invis:${name}`, () => foeFaces({ timers: itemTimer(name) }));

/** foesReached(name) — how many of five live foes a real use rolls a resist for. */
function foesReached(name) {
  return once(`reach:${name}`, () => {
    const s = session(name, { foes: 5 });
    const events = use(s);
    assert.ok(events.some((e) => e.type === "itemUsed"), `${name} was used: ${events.map((e) => e.type)}`);
    return events.filter((e) => e.type === "spellResisted" || e.type === "resistFailed").length;
  });
}

/** diceOfUse(name, read) — the dice an item rolls, found by drawing 1 everywhere and noting each die asked for. */
function diceOfUse(name, read) {
  return once(`dice:${name}`, () => {
    const s = session(name);
    const rng = recordingRng();
    const events = useItem(s.state, s.ref, rng, [], () => 1);
    assert.ok(events.some((e) => e.type === "itemUsed"), `${name} was used`);
    const result = read(s, events);
    return { n: rng.draws.length, sides: rng.draws[0], bonus: result - rng.draws.length };
  });
}

/** weakenState() — a real Walnut Staff use that landed: the room's flags as the engine set them. */
function weakenState() {
  return once("weaken", () => {
    for (let cursor = 1; cursor < 400; cursor++) {
      const s = session("Walnut Staff");
      useItem(s.state, s.ref, makeRng(cursor), [], () => 1);
      if (s.state.combat && s.state.combat.weakened) return s.state.combat;
    }
    throw new Error("the Walnut Staff never landed in 400 tries");
  });
}

/** foeBlow(combatFlags) — the damage one fixed foe blow does under the room flags (a raw 3 to hit, a raw 6 on the damage die). */
function foeBlow(flags) {
  const foe = fixedFoe({ name: "Target", lvl: 4 });
  const state = fixedState({}, { combat: fixedCombat([foe], flags) });
  const events = foeTurn(state, fakeRng([3, 6]), []);
  return events.find((e) => e.type === "struckByFoe").dmg;
}

/** swings(timers) — how many swings the hero's one strike makes. */
function swings(timers) {
  const state = fixedState({ timers }, { combat: fixedCombat([fixedFoe({ wp: 9999, maxWP: 9999 })]) });
  const events = [];
  playerStrike(state, fakeRng([], 2), events);
  return events.filter((e) => e.type === "struck" || e.type === "strikeMissed").length;
}

/** pendantStats() — a real armed Pendant: the share of a blow it lets through, and how many blows it halves. */
function pendantStats() {
  return once("pendant", () => {
    const s = session("Pendant of Fortitude");
    use(s);
    assert.ok(s.state.c.halfNext, "the Pendant armed the next blow");
    const foe = fixedFoe();
    s.state.combat = fixedCombat([foe]);
    let halved = 0;
    let ratio = null;
    for (let blow = 0; blow < 3; blow++) {
      const before = s.state.c.wp;
      applyFoeDamageToPlayer(s.state, foe, fakeRng([], 20), [], { dmg: 10, roll: 20, atLeast: 5, dieN: 20, mods: [] });
      const lost = before - s.state.c.wp;
      if (lost < 10) halved++;
      if (ratio === null) ratio = lost / 10;
    }
    return { ratio, halved };
  });
}

/** parleyStats() — under a live Helm: how many tries a fight allows, and the roll's bonus. */
function parleyStats() {
  return once("parley", () => {
    const stateWith = (timers) => fixedState({ race: "Wilmsry", timers }, { combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }) });
    const atLeast = (timers) => parley(stateWith(timers), fakeRng([], 20), []).find((e) => e.type === "parleyRolled").atLeast;
    const bonus = atLeast({}) - atLeast(itemTimer("Helm of Knowledge"));
    const state = stateWith(itemTimer("Helm of Knowledge"));
    let tries = 0;
    while (canParley(state) && tries < 5) {
      parley(state, fakeRng([], 20), []);
      tries++;
    }
    return { bonus, tries };
  });
}

/** regenStats() — a real Cloak of Regeneration walk: ticks, the squares between them, the die's low and high. */
function regenStats() {
  return once("regen", () => {
    const amounts = [];
    let tickSquaresAt = null;
    for (let base = 0; base < 160; base++) {
      const s = session("Cloak of Regeneration", { c: { wp: 1, maxWP: 999 }, rest: { steps: base * 40 } });
      use(s, makeRng(1));
      const rng = recordingRng(7);
      const at = [];
      for (let step = 1; step <= 40; step++) {
        s.state.steps = base * 40 + step;
        const events = tickHealOverTime(s.state, 1, rng, [], undefined);
        for (const e of events) if (e.type === "healTick") {
          amounts.push(e.amount);
          at.push(step);
        }
        tickSquares(s.state.c, 1);
      }
      if (base === 0) tickSquaresAt = at;
    }
    return {
      ticks: tickSquaresAt.length,
      every: tickSquaresAt[1] - tickSquaresAt[0],
      min: Math.min(...amounts),
      max: Math.max(...amounts),
    };
  });
}

/** poplarRange() — the lowest and highest heal over many uses (the dice come from a derived stream). */
function poplarRange() {
  return once("poplar", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let cursor = 0; cursor < 600; cursor++) {
      const s = session("Poplar Staff", { c: { wp: 1, maxWP: 999 } });
      const rng = { d() { throw new Error("the main rng is never drawn"); }, pick: (a) => a[0], shuffle: (a) => a, getState: () => cursor };
      useItem(s.state, s.ref, rng, [], () => 1);
      const gained = s.state.c.wp - 1;
      min = Math.min(min, gained);
      max = Math.max(max, gained);
    }
    return { n: 1, sides: max - (min - 1), bonus: min - 1 };
  });
}

/** pineStats() — the fireball count die, the damage die and the damage of one fireball. */
function pineStats() {
  return once("pine", () => {
    for (let cursor = 1; cursor < 400; cursor++) {
      const s = session("Pine Staff");
      const rng = recordingRng(cursor);
      const events = useItem(s.state, s.ref, rng, [], () => 1);
      const burned = events.find((e) => e.type === "itemBurned");
      if (burned && burned.total > 0) {
        return {
          count: { n: 1, sides: rng.draws[0], bonus: 0 },
          damage: { n: 1, sides: rng.draws[1], bonus: burned.total - 1 },
        };
      }
    }
    throw new Error("the Pine Staff never burned anyone in 400 tries");
  });
}

/** birchDie() — the die a freeze rolls for its rounds, once per foe reached. */
function birchDie() {
  return once("birch", () => {
    const s = session("Birch Staff");
    const rng = recordingRng();
    useItem(s.state, s.ref, rng, [], () => 1);
    assert.equal(rng.draws.length, 2, "one die per foe reached");
    assert.ok(rng.draws.every((x) => x === rng.draws[0]));
    return { n: 1, sides: rng.draws[0], bonus: 0 };
  });
}

/** domePool() — the hit points a used Rowan Staff's dome soaks. */
function domePool() {
  return once("dome", () => {
    const s = session("Rowan Staff");
    use(s);
    return s.state.c.ward.pool;
  });
}

/** torchUses() — how many times one Torch lights the dark: consumed on the first. */
function torchUses() {
  return once("torch", () => {
    const s = session("Torch");
    const before = s.state.c.items.length;
    use(s);
    return before - s.state.c.items.length;
  });
}

/** toolStats(key) — a real useTool across the hazard: how many tools it spends and how many tiles it crosses. */
function toolStats(key) {
  return once(`tool:${key}`, () => {
    const g = [];
    for (let y = 0; y < GH; y++) {
      g.push([]);
      for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
    }
    g[5][5] = { wall: false, seen: false, feat: null };
    g[5][6] = { wall: false, seen: false, feat: TOOLS[key].feat };
    const state = fixedState({ items: [toolItem(key)] }, { pendingHazard: null });
    state.floor = { g, px: 5, py: 5, depth: 1 };
    const events = useTool(state, key, "E", fakeRng([]), []);
    assert.ok(events.some((e) => e.type === "toolUsed"), `${key} was spent: ${events.map((e) => e.type)}`);
    return { spent: 1 - state.c.items.filter((it) => it.tool === key).length, crossed: state.floor.px - 5 };
  });
}

/** bagCaps(tier) — what a bag of that tier holds, found by cramming a hero past every cap. */
function bagCaps(tier) {
  return once(`bag:${tier}`, () => {
    const c = fixedFighter({ bag: tier, items: Array.from({ length: 40 }, (_, i) => ({ kind: "tool", n: `Junk ${i}` })), gold: 999999, rations: 999 });
    clampCarry(c);
    return { slots: c.items.length, wilmst: c.gold, rations: c.rations };
  });
}

/** soakAr(name) — the armour rating a live Cloak of Armor soaks as. */
const soakAr = (name) => armorSoak(fixedFighter({ timers: itemTimer(name) })).ar;

// ---------------------------------------------------------------------------
// ITEM_TEXT_FACTS: every row's stated numbers, read off the engine
// ---------------------------------------------------------------------------

const range = (name) => [d20Range(invisFaces(name).plain), insultedRange(invisFaces(name).insulted)];

export const ITEM_TEXT_FACTS = {
  // --- jewellery ---
  "Ring of Power": [
    { says: /adds (#) damage/d, value: () => dmgDelta("Ring of Power") },
    { says: /for (#) squares;/d, value: () => E("Ring of Power") },
    { says: /then (#) squares of quiet/d, value: () => CD("Ring of Power") },
  ],
  "Gauntlet of the Giant": [
    { says: /you are (#) size larger/d, value: () => sizeStep("Gauntlet of the Giant") },
    { says: /for (#) squares:/d, value: () => E("Gauntlet of the Giant") },
    { says: /(#) damage/d, value: () => dmgDelta("Gauntlet of the Giant") },
    { says: /foes (#) to hit you/d, value: () => foeToHitDelta("Gauntlet of the Giant") },
    { says: /then (#) squares before/d, value: () => CD("Gauntlet of the Giant") },
  ],
  "Amulet of Light": [
    { says: /lights (#) squares/d, value: () => E("Amulet of Light") },
    { says: /sulks for (#)$/d, value: () => CD("Amulet of Light") },
  ],
  "Pendant of Fortitude": [
    {
      says: /^(#) damage from (#) attack, (#) every (#) squares$/d,
      value: () => [pendantStats().ratio, pendantStats().halved, usesPerCycle("Pendant of Fortitude"), cycle("Pendant of Fortitude").total],
    },
  ],
  "Anklet of Invisibility": [
    { says: /for (#) squares foes/d, value: () => E("Anklet of Invisibility") },
    { says: /foes are (#) to hit you/d, value: () => foeToHitDelta("Anklet of Invisibility") },
    { says: /then (#) squares back in plain sight/d, value: () => CD("Anklet of Invisibility") },
  ],
  "Helm of Knowledge": [
    { says: /for (#) squares you can always parley/d, value: () => E("Helm of Knowledge") },
    { says: /, (#) try per fight/d, value: () => parleyStats().tries },
    { says: /and (#) to the parley roll/d, value: () => parleyStats().bonus },
    { says: /then (#) squares of forgetting/d, value: () => CD("Helm of Knowledge") },
  ],
  "Bracelet of Flight": [
    { says: /used, (#) squares of flight/d, value: () => E("Bracelet of Flight") },
    { says: /; (#) to catch its breath/d, value: () => CD("Bracelet of Flight") },
  ],
  "Amulet of Stone": [
    { says: /up to (#) foes/d, value: () => foesReached("Amulet of Stone") },
    { says: /, (#) every (#) squares/d, value: () => [usesPerCycle("Amulet of Stone"), cycle("Amulet of Stone").total] },
  ],

  // --- cloaks ---
  "Cloak of Strength": [
    { says: /for (#) squares;/d, value: () => E("Cloak of Strength") },
    { says: /then (#) squares of ordinary luck/d, value: () => CD("Cloak of Strength") },
  ],
  "Cloak of Invisibility": [
    {
      says: /invisible for (#) squares, (#) every (#):/d,
      value: () => [E("Cloak of Invisibility"), usesPerCycle("Cloak of Invisibility"), cycle("Cloak of Invisibility").total],
    },
    { says: /\((#); (#) if you insulted them\)/d, value: () => range("Cloak of Invisibility") },
  ],
  "Cloak of Speed": [
    {
      says: /you swing (#) a round for (#) squares; then (#) squares/d,
      value: () => [swings(itemTimer("Cloak of Speed")), E("Cloak of Speed"), CD("Cloak of Speed")],
    },
  ],
  "Cloak of Regeneration": [
    {
      says: /a (#) hp back every (#) squares you walk, (#) times; then (#) squares/d,
      value: () => [{ n: 1, sides: regenStats().max - (regenStats().min - 1), bonus: regenStats().min - 1 }, regenStats().every, regenStats().ticks, CD("Cloak of Regeneration")],
    },
  ],
  "Cloak of Armor": [
    { says: /\(AR (#)\) for (#) squares/d, value: () => [soakAr("Cloak of Armor"), E("Cloak of Armor")] },
    { says: /then (#) squares of ordinary cloth/d, value: () => CD("Cloak of Armor") },
  ],
  "Cloak of Flying": [{ says: /flight for (#) squares; then (#) squares/d, value: () => [E("Cloak of Flying"), CD("Cloak of Flying")] }],
  "Cloak of Ether": [
    { says: /for (#) squares \(/d, value: () => E("Cloak of Ether") },
    { says: /then (#) squares/d, value: () => CD("Cloak of Ether") },
  ],

  // --- staves ---
  "Rowan Staff": [
    { says: /soaks the first (#) hp/d, value: () => domePool() },
    { says: /; (#) charges, (#) back every (#) squares$/d, value: () => [staffStats("Rowan Staff").charges, staffStats("Rowan Staff").restored, staffStats("Rowan Staff").squares] },
  ],
  "Birch Staff": [
    { says: /freezes up to (#) foes for (#) rounds apiece/d, value: () => [foesReached("Birch Staff"), birchDie()] },
    { says: /; (#) charges, (#) back every (#) squares$/d, value: () => [staffStats("Birch Staff").charges, staffStats("Birch Staff").restored, staffStats("Birch Staff").squares] },
  ],
  "Walnut Staff": [
    {
      says: /does (#) damage and hits you only on a high roll \((#); (#) if you insulted them\)/d,
      value: () => {
        const real = weakenState();
        const flags = { weakened: real.weakened, foeToHitPenalty: real.foeToHitPenalty };
        const faces = foeFaces({}, flags);
        return [foeBlow(flags) / foeBlow({}), d20Range(faces.plain), insultedRange(faces.insulted)];
      },
    },
    { says: /; (#) charges, (#) back every (#) squares$/d, value: () => [staffStats("Walnut Staff").charges, staffStats("Walnut Staff").restored, staffStats("Walnut Staff").squares] },
  ],
  "Oak Staff": [
    { says: /up to (#) foes/d, value: () => foesReached("Oak Staff") },
    { says: /; (#) charge, back every (#) squares$/d, value: () => [staffStats("Oak Staff").charges, staffStats("Oak Staff").squares] },
  ],
  "Crystal Staff": [
    { says: /invisible for (#) squares/d, value: () => diceOfUse("Crystal Staff", (s) => s.state.c.timers["item:Crystal Staff"].left) },
    { says: /\((#); (#) if you insulted them\)/d, value: () => range("Crystal Staff") },
    { says: /; (#) charges, (#) back every (#) squares$/d, value: () => [staffStats("Crystal Staff").charges, staffStats("Crystal Staff").restored, staffStats("Crystal Staff").squares] },
  ],
  "Poplar Staff": [
    { says: /every Joiner with you (#) hp each/d, value: () => poplarRange() },
    { says: /; (#) charges, (#) back every (#) squares$/d, value: () => [staffStats("Poplar Staff").charges, staffStats("Poplar Staff").restored, staffStats("Poplar Staff").squares] },
  ],
  "Pine Staff": [
    { says: /^(#) fireballs, (#) each/d, value: () => [pineStats().count, pineStats().damage] },
    { says: /; (#) charge, back every (#) squares$/d, value: () => [staffStats("Pine Staff").charges, staffStats("Pine Staff").squares] },
  ],
  "Cedar Staff": [
    { says: /\(a fight holds at most (#)\)/d, value: () => FOE_COUNT_MAX },
    { says: /; (#) charge, back every (#) squares$/d, value: () => [staffStats("Cedar Staff").charges, staffStats("Cedar Staff").squares] },
  ],

  // --- potions ---
  Healing: [{ says: /^\+(#) hp$/d, value: () => diceOfUse("Healing", (s) => s.state.c.wp - 10) }],
  "Cure Poison": [],
  Speed: [
    {
      says: /^(#) attacks, (#) squares$/d,
      value: () => [swings(itemTimer("Speed")) / swings({}), E("Speed")],
    },
  ],
  "Xtra Healing": [],
  Strength: [{ says: /^(#) damage, (#) squares$/d, value: () => [dmgDelta("Strength"), E("Strength")] }],
  "Cure Disease": [],
  Enlarge: [
    {
      says: /^(#) size larger for (#) squares: (#) damage, and foes (#) to hit you$/d,
      value: () => [sizeStep("Enlarge"), E("Enlarge"), dmgDelta("Enlarge"), foeToHitDelta("Enlarge")],
    },
  ],
  Acuteness: [
    {
      says: /^your strike die becomes a (#) for (#) rounds$/d,
      value: () => [
        { n: 1, sides: strikeDie(fixedFighter({ timers: itemTimer("Acuteness") })), bonus: 0 },
        diceOfUse("Acuteness", (s) => s.state.c.timers["item:Acuteness"].left),
      ],
    },
  ],
  Death: [],
  Invisible: [
    {
      says: /^invisible for a day \((#) squares\): foes hit you only on their best roll \((#); (#) if you insulted them\)$/d,
      value: () => [E("Invisible"), ...range("Invisible")],
    },
  ],

  // --- tools ---
  Torch: [{ says: /lights the dark (#), and keeps it off for (#) squares/d, value: () => [torchUses(), E("Torch")] }],
  Rope: [{ says: /crevice\. (#)\./d, value: () => toolStats("rope").spent }],
  Ladder: [{ says: /^(#) climbable wall, no climbing\. (#)\.$/d, value: () => [toolStats("ladder").crossed, toolStats("ladder").spent] }],
};

/** The rows the guard covers, with their text. */
const ROWS = [
  ...JEWELRY.map((r) => ({ name: r.n, text: r.txt })),
  ...CLOAKS.map((r) => ({ name: r.n, text: r.txt })),
  ...STAVES.map((r) => ({ name: r.n, text: r.txt })),
  ...POTIONS.map((r) => ({ name: r.n, text: r.txt })),
  ...TOOL_ORDER.map((k) => ({ name: TOOLS[k].n, text: TOOLS[k].txt })),
];

// The most foes a fight holds (the Cedar Staff's "a fight holds at most 3").
const FOE_COUNT_MAX = Math.max(...FOE_COUNT_TABLE.flat());

// Bags have their own table: "6 slots, 5000 wilmst and 20 rations."
const BAG_FACTS = {
  medium: [{ says: /^(#) slots, (#) wilmst and (#) rations\./d, value: () => [bagCaps("medium").slots, bagCaps("medium").wilmst, bagCaps("medium").rations] }],
  large: [{ says: /^(#) slots, (#) wilmst and (#) rations\./d, value: () => [bagCaps("large").slots, bagCaps("large").wilmst, bagCaps("large").rations] }],
  exlarge: [{ says: /^(#) slots, (#) wilmst and (#) rations\./d, value: () => [bagCaps("exlarge").slots, bagCaps("exlarge").wilmst, bagCaps("exlarge").rations] }],
};

// ---------------------------------------------------------------------------
// tests: numbersIn
// ---------------------------------------------------------------------------

test("numbersIn: number words, a hundred, dice with and without a leading 1, ranges, signed numbers", () => {
  const v = (text) => numbersIn(text).map((t) => t.value);
  assert.deepEqual(v("fifty squares"), [50]);
  assert.deepEqual(v("a hundred squares"), [100]);
  assert.deepEqual(v("d20+10"), [{ n: 1, sides: 20, bonus: 10 }]);
  assert.deepEqual(v("1d20+10"), [{ n: 1, sides: 20, bonus: 10 }]);
  assert.deepEqual(v("1d10+4 each"), [{ n: 1, sides: 10, bonus: 4 }]);
  assert.deepEqual(v("a d6 hp"), [{ n: 1, sides: 6, bonus: 0 }]);
  assert.deepEqual(v("(19–20 on a d20)"), [{ lo: 19, hi: 20, die: 20 }]);
  assert.deepEqual(v("(20 on a d20; 19–20 if you insulted them)"), [{ lo: 20, hi: 20, die: 20 }, { lo: 19, hi: 20 }]);
  assert.deepEqual(v("+11 damage"), [11]);
  assert.deepEqual(v("foes −2 to hit you"), [-2]);
  assert.deepEqual(v("twice a round, once every 100, half damage, double attacks"), [2, 1, 100, 0.5, 2]);
  assert.deepEqual(v("2 charges, one back every 60 squares"), [2, 1, 60]);
});

test("numbersIn: words inside other words are not numbers, and a hyphen-minus is not a sign or a dash", () => {
  assert.deepEqual(numbersIn("stone, none, someone, often, the honest way"), []);
  // The hyphen forms are NOT recognised as a sign or a range: their digits surface as plain numbers, which the completeness rule then fails.
  assert.deepEqual(numbersIn("foes -2 to hit you").map((t) => t.value), [2]);
  const hyphenRange = numbersIn("19-20 on a d20");
  assert.deepEqual(hyphenRange.map((t) => t.kind), ["digits", "range"], "a hyphen range is a stray 19 and a lone 20: never a span");
  assert.equal("−".charCodeAt(0), 0x2212);
  assert.equal("–".charCodeAt(0), 0x2013);
});

// ---------------------------------------------------------------------------
// tests: completeness and truth
// ---------------------------------------------------------------------------

test("ITEM_TEXT_FACTS has an entry for every JEWELRY, CLOAKS, STAVES, POTIONS and TOOLS row, and no other", () => {
  assert.deepEqual(Object.keys(ITEM_TEXT_FACTS).sort(), ROWS.map((r) => r.name).sort());
  assert.equal(ROWS.length, JEWELRY.length + CLOAKS.length + STAVES.length + POTIONS.length + TOOL_ORDER.length);
});

test("completeness: every number in every row's text is claimed by exactly one fact (an unclaimed number fails with the row and the number)", () => {
  for (const r of ROWS) {
    const toks = numbersIn(r.text);
    const facts = ITEM_TEXT_FACTS[r.name];
    // A row with numbers has facts; a row with none has none (so a number added to a numberless row fails here too).
    assert.equal(facts.length > 0, toks.length > 0, `${r.name}: ${toks.length} numbers in "${r.text}" and ${facts.length} facts`);
    const claimed = new Set();
    for (const f of facts) {
      const m = sayRe(f).exec(r.text);
      assert.ok(m, `${r.name}: the text no longer says ${f.says}`);
      for (let g = 1; g < m.length; g++) {
        const [s, e] = m.indices[g];
        const i = toks.findIndex((t) => t.start === s && t.end === e);
        assert.ok(i >= 0, `${r.name}: "${m[g]}" is not a number token`);
        assert.ok(!claimed.has(i), `${r.name}: "${toks[i].raw}" is claimed twice`);
        claimed.add(i);
      }
    }
    const missed = toks.filter((_, i) => !claimed.has(i)).map((t) => t.raw);
    assert.deepEqual(missed, [], `${r.name}: unclaimed numbers in "${r.text}"`);
  }
});

test("truth: every stated number equals the engine's, for every row", () => {
  for (const r of ROWS) assert.deepEqual(checkRow(r.name, r.text, ITEM_TEXT_FACTS[r.name]), [], r.name);
});

test("truth: the upgrade bags state their slots, wilmst and rations as the engine caps them", () => {
  for (const [tier, facts] of Object.entries(BAG_FACTS)) {
    const bag = BAG_ITEMS[tier];
    assert.deepEqual(checkRow(bag.n, bag.txt, facts), [], bag.n);
    assert.deepEqual(bagCaps(tier), BAGS[tier], `${bag.n}: the content caps are what clampCarry enforces`);
  }
});

test("the guard fails a CHANGED number, an ADDED number and a VANISHED sentence (it is not vacuous)", () => {
  const ring = ITEM_TEXT_FACTS["Ring of Power"];
  const text = JEWELRY.find((r) => r.n === "Ring of Power").txt;
  assert.deepEqual(checkRow("Ring of Power", text, ring), []);
  // changed: fifty -> sixty, +1 -> +2
  assert.match(checkRow("Ring of Power", text.replace("for fifty squares", "for sixty squares"), ring).join("\n"), /says "sixty" but the engine says 50/);
  assert.match(checkRow("Ring of Power", text.replace("+1 damage", "+2 damage"), ring).join("\n"), /says "\+2" but the engine says 1/);
  // added: a number no fact claims
  assert.match(checkRow("Ring of Power", `${text}; 7 charges`, ring).join("\n"), /unclaimed number "7"/);
  assert.match(checkRow("Ring of Power", `${text} (d20+10 of them)`, ring).join("\n"), /unclaimed number "d20\+10"/);
  // vanished: the sentence the fact pins is gone
  assert.match(checkRow("Ring of Power", text.replace("then fifty squares of quiet", "then a nap"), ring).join("\n"), /no longer says/);
  // a number on a row that stated none
  assert.match(checkRow("Cure Poison", "cures poison for 2 days", ITEM_TEXT_FACTS["Cure Poison"]).join("\n"), /unclaimed number "2"/);
  // a changed d20 range and a changed dice
  const cloak = CLOAKS.find((r) => r.n === "Cloak of Invisibility").txt;
  assert.match(checkRow("Cloak of Invisibility", cloak.replace("19–20 if", "18–20 if"), ITEM_TEXT_FACTS["Cloak of Invisibility"]).join("\n"), /engine says/);
  const poplar = STAVES.find((r) => r.n === "Poplar Staff").txt;
  assert.match(checkRow("Poplar Staff", poplar.replace("d20+10", "d20+5"), ITEM_TEXT_FACTS["Poplar Staff"]).join("\n"), /engine says/);
  // a hyphen-minus in a to-hit or a range is not accepted
  const anklet = JEWELRY.find((r) => r.n === "Anklet of Invisibility").txt;
  assert.notDeepEqual(checkRow("Anklet", anklet.replace("−2", "-2"), ITEM_TEXT_FACTS["Anklet of Invisibility"]), []);
  assert.notDeepEqual(checkRow("Cloak", cloak.replace("19–20", "19-20"), ITEM_TEXT_FACTS["Cloak of Invisibility"]), []);
});

/** bump(token) — a different number written the same way, so the sentence still reads and only the value is wrong. */
function bump(t) {
  switch (t.kind) {
    case "word":
      return t.value === 90 ? "eighty" : "ninety";
    case "digits":
      return String(t.value + 7);
    case "signed":
      return `${t.value < 0 ? "−" : "+"}${Math.abs(t.value) + 7}`;
    case "dice":
      return `${t.raw.startsWith("1d") ? "1" : ""}d${t.value.sides}+${Math.abs(t.value.bonus) + 3}`;
    case "range":
      return `${Math.max(1, t.value.lo - 3)}${t.value.hi !== t.value.lo ? `–${t.value.hi}` : ""} on a d${t.value.die}`;
    default:
      return `${Math.max(1, t.value.lo - 3)}–${t.value.hi}`;
  }
}

test("every stated number is live: changing ANY ONE of them in ANY row fails the guard with the engine's value (no number is read off the text)", () => {
  let checked = 0;
  for (const r of ROWS) {
    for (const t of numbersIn(r.text)) {
      const doctored = r.text.slice(0, t.start) + bump(t) + r.text.slice(t.end);
      const problems = checkRow(r.name, doctored, ITEM_TEXT_FACTS[r.name]);
      assert.ok(problems.some((p) => /engine says/.test(p)), `${r.name}: changing "${t.raw}" to "${bump(t)}" should fail on the engine's value, got ${JSON.stringify(problems)}`);
      checked++;
    }
  }
  assert.ok(checked >= 80, `the guard mutated ${checked} stated numbers`);
});

test("the text and the activation record agree for the rows the audit hands to this guard (effect, cooldown, charges, recharge, dice)", () => {
  for (const [name, act] of Object.entries(ACTIVATION_OF)) {
    if (act.charges !== undefined) {
      const st = staffStats(name);
      assert.equal(st.charges, act.charges, `${name}: charges`);
      assert.equal(st.squares, act.recharge, `${name}: recharge`);
      assert.equal(st.restored, 1, `${name}: one charge back at a time`);
    } else if (act.cd !== undefined && typeof act.effect === "number") {
      assert.equal(E(name), act.effect, `${name}: effect`);
      assert.equal(CD(name), act.cd, `${name}: cooldown`);
    }
  }
});

// ---------------------------------------------------------------------------
// tests: the surfaces carry the row's text
// ---------------------------------------------------------------------------

const effectLine = (item) => itemStatLines(item).find((l) => l.key === "effect");

test("surfaces: the rolled jewel, cloak and staff carry the row's text, and itemStatLines prints it as the effect", () => {
  JEWELRY.forEach((row, i) => {
    const it = rollJewel(fakeRng([i + 1]));
    assert.equal(it.n, row.n);
    assert.equal(it.txt, row.txt, `${row.n}: the rolled jewel`);
    assert.equal(effectLine(it).text, row.txt, `${row.n}: the stat line`);
  });
  CLOAKS.forEach((row, i) => {
    const it = rollCloak(fakeRng([i + 1]));
    assert.equal(it.n, row.n);
    assert.equal(it.txt, row.txt, `${row.n}: the rolled cloak`);
    assert.equal(effectLine(it).text, row.txt, `${row.n}: the stat line`);
  });
  STAVES.forEach((row, i) => {
    const it = rollStaff(fakeRng([i + 1]));
    assert.equal(it.n, row.n);
    assert.equal(it.txt, row.txt, `${row.n}: the rolled staff`);
    assert.equal(it.charges, ACTIVATION_OF[row.n].charges, `${row.n}: built with its charge pool`);
    assert.equal(effectLine(it).text, row.txt, `${row.n}: the stat line`);
    const charges = itemStatLines(it).find((l) => l.key === "charges");
    assert.equal(charges.text, `${ACTIVATION_OF[row.n].charges}/${ACTIVATION_OF[row.n].charges} charges`, `${row.n}: the charges line`);
  });
});

/** storeLines(effectId) — every store line of that kind seen across classes, depths and seeds. */
function storeLines(effectId) {
  const out = [];
  for (const cls of ["Fighter", "Thief", "Magic User"]) {
    for (const depth of [1, 3, 6, 10]) {
      for (let seed = 1; seed <= 12; seed++) {
        const state = newRun(seed, [], { force: { cls } });
        state.floor.depth = depth;
        state.storeRoll = true;
        openStore(state, makeRng(state.rngState), []);
        for (const line of state.store.stock) if (line.effectId === effectId) out.push(line);
      }
    }
  }
  return out;
}

test("surfaces: the store's potion line and the item it hands over carry the row's text, for every potion the store can stock", () => {
  const seen = new Set();
  for (const line of storeLines("givePotion")) {
    const row = POTIONS.find((p) => line.effectParams.item.eff2 === p.eff);
    assert.ok(row, `${line.n}: a potion row`);
    assert.equal(line.n, `${row.n} potion`);
    assert.equal(line.sub, row.txt, `${row.n}: the store's sub line`);
    assert.equal(line.effectParams.item.txt, row.txt, `${row.n}: the item's text`);
    assert.equal(effectLine(line.effectParams.item).text, row.txt, `${row.n}: the stat line`);
    seen.add(row.n);
  }
  for (const e of STORE_POTION_POOL) assert.ok(seen.has(e.n), `${e.n} was stocked in the sweep`);
  assert.ok(seen.has("Healing"), "the fixed healing line");
  assert.ok(!seen.has("Death"), "the trap potion is never sold");
});

test("surfaces: the store's tool lines and the tools the game builds carry the row's text", () => {
  const seen = new Set();
  for (const line of storeLines("giveTool")) {
    const row = TOOLS[line.effectParams.item.tool];
    assert.equal(line.sub, row.txt, `${row.n}: the store's sub line`);
    assert.equal(line.effectParams.item.txt, row.txt, `${row.n}: the item's text`);
    seen.add(row.n);
  }
  for (const key of TOOL_ORDER) {
    assert.equal(toolItem(key).txt, TOOLS[key].txt);
    assert.equal(effectLine(toolItem(key)).text, TOOLS[key].txt);
  }
  for (const n of ["Torch", "Rope", "Ladder"]) assert.ok(seen.has(n), `${n} was stocked in the sweep`);
});

test("surfaces: the found potion offer carries the row's text, for every potion the Misc Magic table can hand out", () => {
  const potionSlot = MISC_MAGIC.indexOf("Potion") + 1;
  POTIONS.forEach((row, i) => {
    const state = fixedState({}, {});
    findMisc(state, fakeRng([potionSlot, i + 1]), []);
    const found = state.pendingFind;
    assert.equal(found.kind, "potion");
    assert.equal(found.n, `${row.n} potion (${row.col.toLowerCase()})`);
    assert.equal(found.txt, row.txt, `${row.n}: the found potion's text`);
    assert.equal(effectLine(found).text, row.txt, `${row.n}: the stat line`);
  });
});

test("surfaces: the Misc Magic cloak, staff and jewel finds carry the row's text", () => {
  const slotOf = (what) => MISC_MAGIC.indexOf(what) + 1;
  CLOAKS.forEach((row, i) => {
    const state = fixedState({}, {});
    findMisc(state, fakeRng([slotOf("Cloak"), i + 1]), []);
    assert.equal(state.pendingFind.txt, row.txt, `${row.n}: found cloak`);
  });
  STAVES.forEach((row, i) => {
    const state = fixedState({}, {});
    findMisc(state, fakeRng([slotOf("Staff"), i + 1]), []);
    assert.equal(state.pendingFind.txt, row.txt, `${row.n}: found staff`);
  });
  JEWELRY.forEach((row, i) => {
    const state = fixedState({}, {});
    findMisc(state, fakeRng([slotOf("Jewelry"), i + 1]), []);
    assert.equal(state.pendingFind.txt, row.txt, `${row.n}: found jewel`);
  });
});

// ---------------------------------------------------------------------------
// tests: weapons and armour (no txt of their own: the labels and stat lines)
// ---------------------------------------------------------------------------

test("weapons: every label is its dice (and halve flag), WEAPON_MAX is the dice maximum, and the stat lines state the row's to-hit and crit", () => {
  const labelOf = (w) => `${w.dice.n > 1 ? w.dice.n : ""}d${w.dice.sides}${w.dice.bonus ? `+${w.dice.bonus}` : ""}${w.halve ? "/2" : ""}`;
  for (const [name, w] of Object.entries(WEAPONS)) {
    assert.equal(w.lab, labelOf(w), `${name}: label`);
    const top = w.dice.n * w.dice.sides + w.dice.bonus;
    assert.equal(WEAPON_MAX[name], w.halve ? Math.ceil(top / 2) : top, `${name}: WEAPON_MAX`);
    const lines = itemStatLines({ kind: "weapon", n: name, base: name });
    assert.equal(lines.find((l) => l.key === "damage").text, w.lab, `${name}: damage line`);
    const toHit = lines.find((l) => l.key === "toHit");
    if (w.need === 0) assert.equal(toHit, undefined, `${name}: no to-hit line at zero`);
    else assert.equal(toHit.text, `${signedText(w.need)} to hit`, `${name}: to-hit line`);
    const crit = lines.find((l) => l.key === "crit");
    if (w.crit > 1) assert.equal(crit.text, ITEM_STAT_COPY.text.crit.replace("{n}", w.crit), `${name}: crit line`);
    else assert.equal(crit, undefined, `${name}: no crit line for the one ordinary top number`);
  }
  assert.equal(Object.keys(WEAPON_MAX).join("|"), Object.keys(WEAPONS).join("|"), "WEAPON_MAX covers every weapon in order");
});

test("weapons: the hero's real swing agrees with the stated to-hit (the face change the engine applies)", () => {
  const faces = (weapon) => heroStrikeFacesVs(fixedState({ weapon, cls: "Fighter", sub: "Knight" }, { combat: fixedCombat([fixedFoe()]) }), fixedFoe());
  for (const [name, w] of Object.entries(WEAPONS)) assert.equal(faces(name) - faces("Club"), w.need, `${name}: the engine's face change`);
});

test("armour: itemStatLines states the row's AR, durability and bulk, and the store's armour line states the same AR and hp", () => {
  for (const a of ARMORS) {
    const lines = itemStatLines({ kind: "armor", n: a.name, armor: a.name, ar: a.ar, wp: a.wp, left: a.wp, cls: a.cls });
    assert.equal(lines.find((l) => l.key === "ar").text, `AR ${a.ar}`, `${a.name}: AR`);
    assert.equal(lines.find((l) => l.key === "wear").text, `${a.wp}/${a.wp} hp`, `${a.name}: durability`);
    const bulk = lines.find((l) => l.key === "bulk");
    if (a.bulk > 0) assert.equal(bulk.text, `${signedText(-a.bulk)} to climb, leap and flee rolls`, `${a.name}: bulk`);
    else assert.equal(bulk, undefined, `${a.name}: no bulk line`);
  }
  const seen = new Set();
  for (const line of storeLines("buyArmor")) {
    const a = ARMORS.find((x) => x.name === line.effectParams.item.armor);
    assert.equal(line.sub, `AR ${a.ar}, ${a.wp} hp`, `${a.name}: the store's sub line`);
    assert.equal(line.effectParams.item.txt, `AR ${a.ar}`, `${a.name}: the item's text`);
    seen.add(a.name);
  }
  assert.ok(seen.size >= 3, `the store stocked ${[...seen]}`);
});

// ---------------------------------------------------------------------------
// tests: party-wide reach matches the words
// ---------------------------------------------------------------------------

/** partyProblems(rows) — every row whose text names the party or every Joiner must reach every Joiner. */
function partyProblems(rows) {
  const out = [];
  for (const r of rows) {
    if (!/\bparty\b|\bJoiners?\b/i.test(r.text)) continue;
    const act = ACTIVATION_OF[r.name];
    if (!PARTY_WIDE_ITEM_EFFECTS.includes(r.name) && act?.kind !== "partyHeal") out.push(`${r.name}: its text names the party but the engine gives it no party reach`);
  }
  for (const key of PARTY_WIDE_ITEM_EFFECTS) {
    const row = rows.find((r) => r.name === key);
    if (!row) out.push(`${key}: a PARTY_WIDE_ITEM_EFFECTS key with no item row`);
    else if (!/\bparty\b/i.test(row.text)) out.push(`${key}: reaches the party but its text does not say so`);
  }
  return out;
}

const joiner = (name, wp, maxWP) => ({ name, cls: "Fighter", sub: "Soldier", race: "Human", level: 1, wp, maxWP, timers: {}, worn: {}, items: [], halfNext: false, skills: {} });

test("party-wide: every item whose text names the party or every Joiner reaches every Joiner, and every PARTY_WIDE key's text names the party", () => {
  assert.deepEqual(partyProblems(ROWS), []);
  const named = ROWS.filter((r) => /\bparty\b|\bJoiners?\b/i.test(r.text)).map((r) => r.name).sort();
  assert.deepEqual(named, ["Crystal Staff", "Poplar Staff"], "the items that promise the party");
  // The guard is not vacuous: a row that promises the party with no reach, and a key whose text is silent, both fail.
  assert.match(partyProblems([...ROWS, { name: "Ring of Power", text: "the whole party swings twice" }]).join("\n"), /no party reach/);
  assert.match(partyProblems(ROWS.map((r) => (r.name === "Crystal Staff" ? { ...r, text: "invisible for a while" } : r))).join("\n"), /does not say so/);
});

test("party-wide reach, Crystal Staff: its live invisibility covers the hero and a Joiner; a personal cloak covers the hero only", () => {
  const mate = joiner("Grum", 30, 30);
  const withEffect = (name) => fixedState({ timers: itemTimer(name) }, { party: [mate] });
  const crystal = withEffect("Crystal Staff");
  assert.equal(foeToHitVs(crystal, "hero"), 1);
  assert.equal(foeToHitVs(crystal, "member", mate), 1, "the Joiner is covered");
  const cloak = withEffect("Cloak of Invisibility");
  assert.equal(foeToHitVs(cloak, "hero"), 1);
  assert.ok(foeToHitVs(cloak, "member", mate) > 1, "the cloak says you: the Joiner is not covered");
  assert.ok(foeToHitVs(fixedState({}, { party: [mate] }), "member", mate) > 1, "nothing live, nobody covered");
});

test("party-wide reach, Poplar Staff: a real use heals the hero and every Joiner, each by its own d20+10", () => {
  const mates = [joiner("Grum", 5, 80), joiner("Hilda", 9, 80)];
  const s = session("Poplar Staff", { c: { wp: 3, maxWP: 80 }, party: mates });
  const events = useItem(s.state, s.ref, { d() { throw new Error("main rng untouched"); }, pick: (a) => a[0], shuffle: (a) => a, getState: () => 11 }, [], () => 1);
  const healed = events.find((e) => e.type === "partyHealed");
  assert.deepEqual(healed.heals.map((h) => h.name), ["Test Delver", "Grum", "Hilda"], "the hero, then each Joiner in party order");
  for (const h of healed.heals) assert.ok(h.gained >= 11 && h.gained <= 30, `${h.name}: gained ${h.gained}`);
  assert.equal(s.state.c.wp, 3 + healed.heals[0].gained);
  assert.equal(mates[0].wp, 5 + healed.heals[1].gained);
  assert.equal(mates[1].wp, 9 + healed.heals[2].gained);
});

// ---------------------------------------------------------------------------
// tests: bags (the small starting bag has no item text; the Gear tab meter states it)
// ---------------------------------------------------------------------------

test("bags: the Gear tab's bag meter and the bag's stat lines state the slots, wilmst and rations the engine caps, for every tier including the small starting bag", () => {
  for (const tier of ["small", "medium", "large", "exlarge"]) {
    const caps = bagCaps(tier);
    const meter = gearBagMeterModel({ c: fixedFighter({ bag: tier }) });
    assert.equal(meter.slots, caps.slots, `${tier}: the meter's slot count`);
    assert.equal(
      meter.capsLine,
      GEAR_COPY.bagCaps.replace("{wilmst}", caps.wilmst).replace("{rations}", caps.rations),
      `${tier}: the meter's caps line`,
    );
    const lines = itemStatLines({ kind: "bag", tier, n: `${tier} bag` });
    assert.equal(lines.find((l) => l.key === "slots").text, `${caps.slots} slots`, `${tier}: the stat line's slots`);
    assert.equal(
      lines.find((l) => l.key === "carry").text,
      `carries up to ${caps.wilmst} wilmst and ${caps.rations} rations`,
      `${tier}: the stat line's caps`,
    );
  }
});
