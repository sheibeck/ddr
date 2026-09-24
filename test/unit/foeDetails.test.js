// test/unit/foeDetails.test.js
//
// Phase 71 (POLISH-08; D-09, D-12) — the long-press foe card's pure view
// model, src/browser/foeDetails.js.
//
// Sections:
//   (a) the every-creature sweep: every creature in every BESTIARY family,
//       built the way engine/combat.js#startCombat builds a foe, yields a
//       card whose title is its name, whose family line names its family,
//       and whose every line is clear of a standalone WP and of BANNED;
//   (b) the line order and one hand-checked damage range, computed here
//       from the SAME exported engine helpers (never retyped numbers);
//   (c) nothing hidden: fleesBelow, sp.every and the ability cadences never
//       appear;
//   (d) the effects lines agree with foeConditionChips (D-14's one table),
//       one line per effect with its description (Phase 71 D-16, R-30);
//   (e) malformed, unknown and hostile inputs give a fallback card, no throw;
//   (f) purity: two calls deep-equal, the state is never mutated;
//   (g) FOE_DETAILS_COPY is frozen and voice-safe; detailsLabel (D-11).

import test from "node:test";
import assert from "node:assert/strict";

import { foeDetailsCard, FOE_DETAILS_COPY, detailsLabel } from "../../src/browser/foeDetails.js";
import { foeConditionChips } from "../../src/browser/foeConditions.js";
import { FOE_GLYPHS } from "../../src/browser/combatPanel.js";
import { RAIL_HOLD } from "../../src/browser/rail.js";
import { BESTIARY, ENC_TYPES } from "../../content/bestiary.js";
import { FOE_ABILITIES } from "../../content/foe-abilities.js";
import { foeLevelBase } from "../../engine/combat.js";
import { difficultyCurve, foeHitFor } from "../../engine/difficulty.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

// The hp-not-wp guard's own regex, verbatim (test/unit/hp-not-wp.test.js).
const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function bannedIn(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = String(text).match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push(term);
  }
  return hits;
}

// ─── fixtures ──────────────────────────────────────────────────────────────

/** foeFrom(picked, type, tier) — a foe built as engine/combat.js#startCombat builds one. */
function foeFrom(picked, type, tier, over = {}) {
  return {
    name: picked.n,
    type,
    lvl: tier + 1,
    size: picked.sz,
    intel: picked.i,
    wp: picked.wp,
    maxWP: picked.wp,
    alive: true,
    asleep: 0,
    sp: picked.sp || {},
    lives: picked.sp && picked.sp.twice ? 2 : 1,
    ...(picked.abilities ? { abilities: picked.abilities.slice() } : {}),
    ...over,
  };
}

function stateWith(foes, over = {}) {
  return {
    c: { name: "Test Delver", wp: 40, maxWP: 40, timers: {} },
    floor: { depth: 3 },
    combat: { foes, type: foes[0]?.type ?? "Beasts", round: 1, target: 0 },
    ...over,
  };
}

function pick(type, name) {
  for (let t = 0; t < BESTIARY[type].length; t++) {
    const p = BESTIARY[type][t].find((x) => x.n === name);
    if (p) return foeFrom(p, type, t);
  }
  throw new Error(`no ${name} in ${type}`);
}

const texts = (card) => card.lines.map((l) => l.text);

// ─── (a) every creature ────────────────────────────────────────────────────

test("(a) every creature in every BESTIARY family yields a named card, clear of WP and BANNED", () => {
  let n = 0;
  for (const type of ENC_TYPES) {
    BESTIARY[type].forEach((tier, t) => {
      for (const picked of tier) {
        const foe = foeFrom(picked, type, t);
        const card = foeDetailsCard(0, stateWith([foe]));
        n++;
        assert.equal(card.kind, "foe");
        assert.equal(card.foe, 0);
        assert.equal(card.title, picked.n.toUpperCase(), `${picked.n}: title is the creature's name`);
        assert.equal(card.icon, FOE_GLYPHS[type], `${picked.n}: the family glyph`);
        assert.equal(card.iconKey, null);
        assert.equal(card.tone, "info");
        assert.equal(card.hold, RAIL_HOLD.default);
        assert.ok(card.lines[0].text.includes(type.toUpperCase()), `${picked.n}: the family line names ${type}`);
        for (const l of card.lines) {
          assert.equal(l.roll, null);
          assert.equal(typeof l.text, "string");
          assert.ok(l.text.length > 0, `${picked.n}: no empty line`);
          assert.ok(!PLAYER_WP.test(l.text), `${picked.n}: "${l.text}" says WP`);
          assert.deepEqual(bannedIn(l.text), [], `${picked.n}: "${l.text}" hits BANNED`);
          assert.ok(!/undefined|NaN|null|\[object/.test(l.text), `${picked.n}: "${l.text}" leaks a code value`);
        }
      }
    });
  }
  assert.ok(n > 50, `swept ${n} creatures`);
});

test("(a) the two 'wp' bestiary notes read HP on the card (R-16)", () => {
  const bat = foeDetailsCard(0, stateWith([pick("Beasts", "Bat/Rat")]));
  const viper = foeDetailsCard(0, stateWith([pick("Beasts", "Viper")]));
  assert.ok(texts(bat).some((t) => t.includes("1 HP each")), texts(bat).join(" | "));
  assert.ok(texts(viper).some((t) => t.includes("2 HP a round")), texts(viper).join(" | "));
});

// ─── (b) line order and the damage range ───────────────────────────────────

test("(b) line order: family, HP, defence, attack, abilities, resistances, effects, flavour", () => {
  const krupke = pick("Humans", "Krupke"); // ar 12, dmg 1d6+2, abilities
  krupke.wp = 11;
  const state = stateWith([krupke], { floor: { depth: 4 } });
  const card = foeDetailsCard(0, state);
  const t = texts(card);
  assert.equal(t.length, 8, t.join(" | "));
  assert.equal(t[0], "HUMANS · SIZE H");
  assert.equal(t[1], `HP 11 / ${krupke.maxWP}`);
  assert.ok(t[2].includes("AR 12"), t[2]);
  // attack: swings, the dice label and the per-swing range from the engine's own helpers
  const curve = difficultyCurve(4);
  const base = foeLevelBase(krupke);
  const lo = foeHitFor(base + 1 + 2, curve);
  const hi = foeHitFor(base + 6 + 2, curve);
  assert.ok(t[3].includes("1 swing"), t[3]);
  assert.ok(t[3].includes("d6+2"), t[3]);
  assert.ok(t[3].includes(`${lo}–${hi}`), `${t[3]} should carry ${lo}–${hi}`);
  assert.ok(t[3].includes("before armour"), t[3]);
  // abilities: the kit's player names plus the note
  assert.ok(t[4].includes("Weaken") && t[4].includes("Freeze"), t[4]);
  assert.ok(t[4].includes("a sorcerer in mail with a long sword"), t[4]);
  assert.ok(t[5].startsWith("INT 8"), t[5]);
  assert.equal(t[6], FOE_DETAILS_COPY.noEffects);
  assert.equal(t[7], FOE_DETAILS_COPY.flavour.Humans);
});

test("(b) the defence line is omitted when nothing applies; the default d6 and a flat 1 have ranges", () => {
  const ned = pick("Humans", "Ned");
  const card = foeDetailsCard(0, stateWith([ned]));
  const t = texts(card);
  assert.equal(t.length, 7, t.join(" | "));
  const curve = difficultyCurve(3);
  const base = foeLevelBase(ned);
  assert.ok(t[2].includes("d6"), t[2]);
  assert.ok(t[2].includes(`${foeHitFor(base + 1, curve)}–${foeHitFor(base + 6, curve)}`), t[2]);

  const bat = pick("Beasts", "Bat/Rat");
  const bt = texts(foeDetailsCard(0, stateWith([bat])));
  const flat = foeHitFor(foeLevelBase(bat) + 1, curve);
  assert.ok(bt[2].includes("2 swings"), bt[2]);
  assert.ok(bt[2].includes(`${flat}–${flat}`) || bt[2].includes(`hits for ${flat} `), bt[2]);
});

test("(b) defence labels: to-hit, magic-only, dagger-only, half damage; strikesAs feeds the range", () => {
  const zit = texts(foeDetailsCard(0, stateWith([pick("Beasts", "Zit")])));
  assert.ok(zit[2].includes("4 or under"), zit[2]);
  const ghost = texts(foeDetailsCard(0, stateWith([pick("Demons", "Ghost")])));
  assert.ok(ghost[2].includes(FOE_DETAILS_COPY.magicOnly), ghost[2]);
  const shadow = texts(foeDetailsCard(0, stateWith([pick("Magical", "Shadow")])));
  assert.ok(shadow[2].includes(FOE_DETAILS_COPY.daggerOnly), shadow[2]);
  const sterling = texts(foeDetailsCard(0, stateWith([pick("Beasts", "Sterling")])));
  assert.ok(sterling[2].includes(FOE_DETAILS_COPY.halfDmg), sterling[2]);

  const herman = pick("Humans", "Herman");
  const h = texts(foeDetailsCard(0, stateWith([herman])));
  const curve = difficultyCurve(3);
  const base = foeLevelBase(herman); // strikesAs 5 → 25
  assert.equal(base, 25);
  assert.ok(h.some((x) => x.includes(`${foeHitFor(base + 1, curve)}–${foeHitFor(base + 6, curve)}`)), h.join(" | "));
});

test("(b) resistances: DAMAGE_MULTIPLIERS rows by type and by name, and kill-it-twice with lives left", () => {
  const demon = texts(foeDetailsCard(0, stateWith([pick("Demons", "Gremlin")])));
  assert.ok(demon.some((x) => /Cleric spells do double/i.test(x)), demon.join(" | "));
  const dead = texts(foeDetailsCard(0, stateWith([pick("Walking Dead", "Google")])));
  assert.ok(dead.some((x) => /Spells do double/i.test(x)), dead.join(" | "));
  const trachea = texts(foeDetailsCard(0, stateWith([pick("Lair Beasts", "Trachea")])));
  assert.ok(trachea.some((x) => /Fighter blows do double/i.test(x)), trachea.join(" | "));
  const wolf = texts(foeDetailsCard(0, stateWith([pick("Beasts", "Wolf")])));
  assert.ok(!wolf.some((x) => /double/i.test(x)), wolf.join(" | "));

  const philly = pick("Walking Dead", "Philly");
  const p2 = texts(foeDetailsCard(0, stateWith([philly])));
  assert.ok(p2.some((x) => x.includes("2 lives left")), p2.join(" | "));
  philly.lives = 1;
  const p1 = texts(foeDetailsCard(0, stateWith([philly])));
  assert.ok(!p1.some((x) => x.includes("lives left")), p1.join(" | "));
});

test("(b) every FOE_ABILITIES id resolves to a named player label", () => {
  for (const a of FOE_ABILITIES) {
    const foe = pick("Humans", "Ned");
    foe.abilities = [a.id];
    const t = texts(foeDetailsCard(0, stateWith([foe])));
    const line = t[3];
    assert.ok(!line.includes(a.id), `${a.id} must show a player label, not the id: ${line}`);
    assert.ok(Object.values(FOE_DETAILS_COPY.abilities).some((label) => line.includes(label)), `${a.id}: ${line}`);
  }
});

test("(b) a dead foe reads DOWN; never_melee reads no swing and no range", () => {
  const dead = pick("Humans", "Ned");
  dead.alive = false;
  dead.wp = 0;
  assert.equal(texts(foeDetailsCard(0, stateWith([dead])))[1], FOE_DETAILS_COPY.down);

  const drudge = texts(foeDetailsCard(0, stateWith([pick("Magical", "Drudge")])));
  assert.ok(drudge.some((x) => x.includes(FOE_DETAILS_COPY.noMelee)), drudge.join(" | "));
  assert.ok(!drudge.some((x) => x.includes("before armour")), drudge.join(" | "));
});

// ─── (c) nothing hidden ────────────────────────────────────────────────────

test("(c) hidden rules values never appear: fleesBelow, sp.every, ability cadences and uses", () => {
  const djinni = pick("Demons", "Djinni");
  djinni.cd = { djinniFireball: 1 };
  djinni.uses = { djinniFireball: 3 };
  const card = foeDetailsCard(0, stateWith([djinni]));
  const all = [card.title, ...texts(card)].join(" | ");
  assert.ok(!all.includes("0.25"), all);
  assert.ok(!/25\s*%|flee/i.test(all), all);
  assert.ok(!/every \d|cooldown|uses/i.test(all), all);

  const drake = texts(foeDetailsCard(0, stateWith([pick("Beasts", "Drake")]))).join(" | ");
  // the note says "every four rounds" (the player reads that on the foe card already); no numeric cadence is added
  assert.ok(!/every 4\b/.test(drake), drake);
});

// ─── (d) the conditions line ───────────────────────────────────────────────

// Phase 71 (D-16, R-30): the long-press card is where a foe condition is
// explained, so the one joined effects line became one line per current
// effect, "<chip text> — <chip desc>", in foeConditionChips order.
const effectLines = (card) => {
  const t = texts(card);
  // family, HP, [defence], attack, abilities, resistances, ...effects, flavour
  const hasDefence = t.length > 0 && !/swing|Never swings/.test(t[2]);
  const first = hasDefence ? 6 : 5;
  return t.slice(first, t.length - 1);
};

test("(d) the effects are one line per foeConditionChips chip, '<text> — <desc>', from the same table", () => {
  const f = pick("Beasts", "Wolf");
  f.hamstrung = true;
  f.marked = true;
  f.blind = true;
  f.blindFor = 2;
  const state = stateWith([f]);
  state.combat.weakened = true;
  state.c.timers["spell:weaken"] = { left: 3 };
  const chips = foeConditionChips(f, state);
  const expected = chips.map((c) => `${c.text} — ${c.desc}`);
  assert.ok(expected[0].startsWith("Blind · 2 — "), expected[0]);
  assert.equal(chips.length, 4);
  for (const c of chips) assert.ok(typeof c.desc === "string" && c.desc.length > 0, `${c.key} desc`);
  assert.deepEqual(effectLines(foeDetailsCard(0, state)), expected);
});

test("(d) a Hamstrung foe Blind for 2 rounds yields exactly two effect lines, in table order", () => {
  const f = pick("Beasts", "Wolf");
  f.hamstrung = true;
  f.blind = true;
  f.blindFor = 2;
  const state = stateWith([f]);
  const lines = effectLines(foeDetailsCard(0, state));
  assert.equal(lines.length, 2, lines.join(" | "));
  const [blind, ham] = foeConditionChips(f, state);
  assert.equal(lines[0], `Blind · 2 — ${blind.desc}`);
  assert.equal(lines[1], `Hamstrung — ${ham.desc}`);
});

test("(d) a Weakened fight adds its line on every foe", () => {
  const a = pick("Beasts", "Wolf");
  const b = pick("Humans", "Ned");
  const state = stateWith([a, b]);
  state.combat.weakened = true;
  state.c.timers["spell:weaken"] = { left: 2 };
  for (const i of [0, 1]) {
    const [weak] = foeConditionChips(state.combat.foes[i], state);
    const lines = effectLines(foeDetailsCard(i, state));
    assert.deepEqual(lines, [`Weakened · 2 — ${weak.desc}`], `foe ${i}`);
  }
});

test("(d) no effects still reads the one noEffects line", () => {
  const state = stateWith([pick("Beasts", "Wolf")]);
  assert.deepEqual(effectLines(foeDetailsCard(0, state)), [FOE_DETAILS_COPY.noEffects]);
});

// ─── (e) malformed, unknown, hostile ───────────────────────────────────────

test("(e) malformed and unknown input yields a fallback card with no throw", () => {
  const cases = [
    [0, null],
    [0, undefined],
    [0, {}],
    [0, { combat: null }],
    [0, { combat: { foes: null } }],
    [5, stateWith([pick("Humans", "Ned")])],
    [-1, stateWith([pick("Humans", "Ned")])],
    ["x", stateWith([pick("Humans", "Ned")])],
    [0, stateWith([null])],
    [0, stateWith([{}])],
    [0, stateWith([{ name: "Mystery", type: "Some New Thing", wp: "lots", maxWP: {}, alive: true }])],
    [0, stateWith([{ name: "NoSp", type: "Beasts", lvl: 1, wp: 3, maxWP: 3, alive: true }])],
  ];
  for (const [i, s] of cases) {
    let card;
    assert.doesNotThrow(() => {
      card = foeDetailsCard(i, s);
    }, `case ${JSON.stringify(i)}`);
    assert.equal(card.kind, "foe");
    assert.ok(Array.isArray(card.lines) && card.lines.length >= 3);
    for (const l of card.lines) assert.ok(!/undefined|NaN|\[object/.test(l.text), `${l.text}`);
  }
  const empty = foeDetailsCard(0, null);
  assert.equal(empty.title, FOE_DETAILS_COPY.something);
  assert.ok(empty.lines[0].text.includes(FOE_DETAILS_COPY.familyUnknown));
  assert.ok(empty.lines.some((l) => l.text === FOE_DETAILS_COPY.hpUnknown));

  const mystery = foeDetailsCard(0, stateWith([{ name: "Mystery", type: "Some New Thing", wp: "lots", maxWP: {}, alive: true }]));
  assert.equal(mystery.title, "MYSTERY");
  assert.ok(mystery.lines[0].text.includes(FOE_DETAILS_COPY.familyUnknown));
  assert.ok(mystery.lines.some((l) => l.text === FOE_DETAILS_COPY.hpUnknown));
  assert.equal(mystery.icon, FOE_GLYPHS.default);
  assert.equal(mystery.lines[mystery.lines.length - 1].text, FOE_DETAILS_COPY.flavour.default);
});

test("(e) a hostile getter never throws", () => {
  const hostile = {};
  for (const k of ["name", "type", "lvl", "size", "intel", "wp", "maxWP", "alive", "sp", "lives", "abilities"]) {
    Object.defineProperty(hostile, k, { get() { throw new Error("boom"); }, enumerable: true });
  }
  const state = stateWith([{ type: "Beasts" }]);
  state.combat.foes[0] = hostile;
  let card;
  assert.doesNotThrow(() => {
    card = foeDetailsCard(0, state);
  });
  assert.equal(card.kind, "foe");
  const hostileState = {};
  Object.defineProperty(hostileState, "combat", { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => foeDetailsCard(0, hostileState));
});

// ─── (f) purity ────────────────────────────────────────────────────────────

test("(f) pure: two calls deep-equal, the state is never mutated", () => {
  const f = pick("Walking Dead", "Vampire");
  f.frenzied = true;
  const state = stateWith([f, pick("Humans", "Ned")]);
  const before = JSON.stringify(state);
  const a = foeDetailsCard(0, state);
  const b = foeDetailsCard(0, state);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(state), before);
  const second = foeDetailsCard(1, state);
  assert.equal(second.foe, 1);
  assert.equal(second.title, "NED");
});

// ─── (g) copy ──────────────────────────────────────────────────────────────

function leaves(obj, at = "") {
  if (typeof obj === "string") return [[at, obj]];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));
}

test("(g) FOE_DETAILS_COPY: frozen (deep), six family flavours plus a fallback, voice-safe, no WP", () => {
  assert.ok(Object.isFrozen(FOE_DETAILS_COPY));
  for (const v of Object.values(FOE_DETAILS_COPY)) if (v && typeof v === "object") assert.ok(Object.isFrozen(v));
  for (const type of ENC_TYPES) assert.ok(typeof FOE_DETAILS_COPY.flavour[type] === "string" && FOE_DETAILS_COPY.flavour[type].length > 0, type);
  assert.ok(FOE_DETAILS_COPY.flavour.default);
  assert.equal(FOE_DETAILS_COPY.details, "Details: {name}");
  for (const [at, value] of leaves(FOE_DETAILS_COPY)) {
    assert.ok(value.length > 0, at);
    assert.ok(!PLAYER_WP.test(value), `${at} says WP`);
    assert.deepEqual(bannedIn(value), [], `${at} ("${value}") hits BANNED`);
  }
});

test("(g) detailsLabel fills the D-11 accessible name", () => {
  assert.equal(detailsLabel("DRAKE"), "Details: DRAKE");
  assert.equal(detailsLabel(""), "Details: " + FOE_DETAILS_COPY.something);
  assert.equal(detailsLabel(undefined), "Details: " + FOE_DETAILS_COPY.something);
});
