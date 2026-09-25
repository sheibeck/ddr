// src/browser/foeDetails.js
//
// Phase 71 (POLISH-08; D-09, D-12) — the long-press foe card's view model.
// The user asked: "long pressing an enemy should pop up a rail with detailed
// enemy information." foeDetailsCard(i, state) turns ONE foe of
// state.combat.foes into a rail card (src/browser/rail.js's card shape plus
// `kind: "foe"` and `foe: i`, which the shell's renderRail uses to keep the
// card live while the fight goes on — D-10/R-15).
//
// D-09, lines in this order (each { text, roll: null }):
//   1. family and size            6. abilities (FOE_ABILITIES names) + the note
//   2. HP cur / max, or DOWN      7. INT, DAMAGE_MULTIPLIERS rows, lives left
//   3. defence (omitted if none)  8. current effects (foeConditions.js, D-14)
//   4. odds (omitted if no hero)  9. one deadpan flavour line
//   5. attack and damage range
//
// Phase 74 (ROLL-02/03): "4" is the two-way "right now" odds line, right
// after the defence line (or right after HP when there is no defence line)
// — "You hit it on 17–20 (d20) · it hits you on 16–20 (d20)", read ONLY
// from rollOdds.js (heroHitOddsVs/foeHitOddsVs), never a restated formula.
// The old static "Hit only on a {n} or under" defence label became this
// real range (74-CONTEXT). It is omitted for any state without a full hero
// (oddsLine returns null quietly; the card never throws).
//
// Phase 71 (D-16, R-30): "7" is one line PER current effect, in
// foeConditionChips order, each "<chip text> — <chip desc>" — the long-press
// card is where a foe condition is explained (a tap on a foe card, chips
// included, only aims). The text and the description both come from the
// chips, never re-derived here. With no effects it is the one noEffects line.
//
// Only what the player could plausibly know. Deliberately LEFT OUT, because
// the rules keep them hidden: sp.fleesBelow (the Djinni's flee threshold),
// sp.every and every ability `every`/`uses` cadence, the foe's live ability
// cooldowns and use counts (f.cd, f.uses), sp.caster (inert flavour), every
// rng detail, and each flag the bestiary note does not already say in
// words (pursues, seesInvis, breaks, and so on — the note carries those).
//
// The damage range goes ONLY through the engine's own exported pure helpers
// (engine/combat.js foeLevelBase, engine/difficulty.js difficultyCurve and
// foeHitFor): per swing, [foeHitFor(base + diceMin), foeHitFor(base +
// diceMax)] at the current depth, before armour, crits and effects. The
// formula is never restated here; a Frenzied foe's doubled swings show
// through its effect chip, not a recomputed count.
//
// R-16 (HP never WP): the bestiary notes go through combatPanel.js's
// playerNote, the same normaliser the foe card meta line uses. This module
// imports combatPanel.js; combatPanel.js never imports this one.
//
// D-12: PRESENTATION ONLY, pure module: no DOM/window access, no timers, no
// rng, no mutation of the foe or the state. Every read is guarded, so a
// malformed, unknown or hostile foe yields a fallback card and never throws.

import { ENC_TYPES } from "../../content/bestiary.js";
import { FOE_ABILITIES } from "../../content/foe-abilities.js";
import { DAMAGE_MULTIPLIERS } from "../../content/damage-multipliers.js";
import { foeLevelBase } from "../../engine/combat.js";
import { difficultyCurve, foeHitFor } from "../../engine/difficulty.js";
import { foeConditionChips } from "./foeConditions.js";
import { FOE_GLYPHS, playerNote } from "./combatPanel.js";
import { RAIL_HOLD } from "./rail.js";
import { heroHitOddsVs, foeHitOddsVs } from "./rollOdds.js";

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === "object") deepFreeze(v);
  return Object.freeze(o);
}

/** FOE_DETAILS_COPY — every literal string the card emits (voice-scanned by
 * test/unit/foeDetails.test.js, walked by test/unit/hp-not-wp.test.js). */
export const FOE_DETAILS_COPY = deepFreeze({
  something: "SOMETHING",
  familyUnknown: "FAMILY UNKNOWN",
  family: "{family} · SIZE {size}",
  hp: "HP {cur} / {max}",
  hpUnknown: "HP ?",
  down: "DOWN",
  ar: "AR {n}",
  magicOnly: "Only magic touches it",
  daggerOnly: "Only a dagger or magic touches it",
  halfDmg: "Takes half damage",
  // Phase 74 (ROLL-02/03): the two-way "right now" odds line, right after
  // the defence line — the engine's own heroHitOddsVs/foeHitOddsVs
  // (src/browser/rollOdds.js), never a restated formula. Replaces the old
  // static `toHit` defence label above.
  oddsYou: "You hit it on {range}",
  oddsUntouchable: "You cannot touch it",
  oddsIt: "it hits you on {range}",
  swing: "1 swing",
  swings: "{n} swings",
  flat: "a flat {n}",
  hitsFor: "hits for {lo}–{hi} before armour",
  hitsForOne: "hits for {n} before armour",
  ignoresArmour: "your armour is no help",
  noMelee: "Never swings; casts instead",
  noTricks: "No tricks worth mentioning",
  int: "INT {n}",
  spells: "Spells",
  spellsBy: "{who} spells",
  blows: "Blows",
  blowsBy: "{who} blows",
  double: "{who} do double",
  times: "{who} do ×{n}",
  lives: "Kill it twice · {n} lives left",
  noEffects: "Nothing on it yet. Give it time.",
  details: "Details: {name}",
  abilityUnknown: "Something unpleasant",
  // The player's word for each FOE_ABILITIES kind, keyed by the id's tail
  // ("krupkeWeaken" → Weaken). Never the raw id.
  abilities: {
    Weaken: "Weaken",
    Freeze: "Freeze",
    Lightning: "Lightning",
    Fireball: "Fireball",
    Daze: "Daze",
    Summon: "Raises the dead",
    Drain: "Life drain",
    Heal: "Heals itself",
    Breath: "Fire breath",
  },
  flavour: {
    Beasts: "It does not want your gold. It wants you gone, or it wants lunch.",
    Demons: "Older than the maze, and twice as smug about it.",
    Humans: "Somebody's cousin, probably. Nobody is coming to claim them.",
    "Lair Beasts": "You are standing in its living room. It has noticed the boots.",
    Magical: "It follows rules. Not yours, and it will not explain them.",
    "Walking Dead": "Already dead once. It did not take the hint.",
    default: "Nobody has written this one down yet. Be the first, and survive it.",
  },
});

const C = FOE_DETAILS_COPY;
const ABILITY_IDS = new Set(FOE_ABILITIES.map((a) => a.id));

/** fill(template, vars) — "{key}" placeholders filled from vars. */
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** rd(obj, key) — obj[key], or undefined on a null obj or a throwing getter. */
function rd(obj, key) {
  try {
    return obj == null ? undefined : obj[key];
  } catch {
    return undefined;
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const num = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);
const posInt = (n) => (Number.isInteger(n) && n > 0 ? n : null);
const line = (text) => ({ text, roll: null });
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * detailsLabel(name) — the D-11 accessible name for a foe card's hidden
 * Details button: "Details: <name>", with SOMETHING for a missing name.
 */
export function detailsLabel(name) {
  const n = name == null || name === "" ? C.something : String(name);
  return fill(C.details, { name: n });
}

/** diceOf(sp) — { n, sides, bonus } for sp.dmg, or the engine's default d6 when absent. */
function diceOf(sp) {
  const dmg = rd(sp, "dmg");
  if (!dmg || typeof dmg !== "object") return { n: 1, sides: 6, bonus: 0 };
  const n = num(rd(dmg, "n"));
  const sides = num(rd(dmg, "sides"));
  const bonus = num(rd(dmg, "bonus")) ?? 0;
  if (n === null || sides === null) return null;
  return { n, sides, bonus };
}

function diceLabel(d) {
  if (d.n <= 0) return fill(C.flat, { n: d.bonus });
  const core = `${d.n === 1 ? "" : d.n}d${d.sides}`;
  return d.bonus > 0 ? `${core}+${d.bonus}` : d.bonus < 0 ? `${core}-${-d.bonus}` : core;
}

function familyLine(type, size) {
  const known = typeof type === "string" && ENC_TYPES.includes(type);
  const sz = typeof size === "string" && size ? size : "?";
  return fill(C.family, { family: known ? type.toUpperCase() : C.familyUnknown, size: sz });
}

function hpLine(foe) {
  if (rd(foe, "alive") === false) return C.down;
  const cur = num(rd(foe, "wp"));
  const max = num(rd(foe, "maxWP"));
  if (cur === null || max === null) return C.hpUnknown;
  return fill(C.hp, { cur: Math.max(0, cur), max });
}

function defenceLine(sp) {
  const parts = [];
  const ar = num(rd(sp, "ar"));
  if (ar !== null && ar > 0) parts.push(fill(C.ar, { n: ar }));
  // Phase 74 (ROLL-02): sp.toHit no longer carries its own static label —
  // it now shows through as a real range on the odds line (oddsLine below).
  if (rd(sp, "magicOnly")) parts.push(C.magicOnly);
  if (rd(sp, "daggerOnly")) parts.push(C.daggerOnly);
  if (rd(sp, "halfDmg")) parts.push(C.halfDmg);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * oddsLine(foe, sp, state) — Phase 74 (ROLL-02): the long-press card's
 * two-way "right now" odds against the hero, read ONLY from rollOdds.js
 * (heroHitOddsVs/foeHitOddsVs), never a restated formula. Returns null
 * unless state.c is an object; the whole computation runs inside safe(),
 * so a bare/minimal `c` (missing race/cls/sub/level/weapon) quietly drops
 * the line instead of throwing. The you-part reads oddsUntouchable when
 * the target-trait terms zero the hero's faces out (magicOnly/daggerOnly
 * without the right weapon); the it-part is omitted for a never_melee foe
 * (it never swings, so there is no "it hits you" side).
 */
function oddsLine(foe, sp, state) {
  return safe(() => {
    if (!state || typeof state.c !== "object" || state.c === null) return null;
    const hero = heroHitOddsVs(state, foe);
    const parts = [hero.untouchable ? C.oddsUntouchable : fill(C.oddsYou, { range: hero.text })];
    if (!rd(sp, "never_melee")) {
      parts.push(fill(C.oddsIt, { range: foeHitOddsVs(state, foe).text }));
    }
    return parts.join(" · ");
  }, null);
}

function attackLine(foe, sp, state) {
  if (rd(sp, "never_melee")) return C.noMelee;
  const parts = [];
  const swings = posInt(rd(sp, "atk")) || 1;
  parts.push(swings === 1 ? C.swing : fill(C.swings, { n: swings }));
  const d = diceOf(sp);
  if (d) {
    parts.push(diceLabel(d));
    const range = safe(() => {
      const lvl = num(rd(foe, "lvl"));
      const strikesAs = num(rd(sp, "strikesAs"));
      if (lvl === null && strikesAs === null) return null;
      // The engine's own helpers, fed plain sanitized values (never the live foe).
      const base = foeLevelBase({ lvl, sp: strikesAs !== null ? { strikesAs } : {} });
      const curve = difficultyCurve(rd(rd(state, "floor"), "depth"));
      const lo = foeHitFor(base + d.n + d.bonus, curve);
      const hi = foeHitFor(base + d.n * d.sides + d.bonus, curve);
      return Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : null;
    }, null);
    if (range) parts.push(range.lo === range.hi ? fill(C.hitsForOne, { n: range.lo }) : fill(C.hitsFor, range));
  }
  if (rd(sp, "noArmor")) parts.push(C.ignoresArmour);
  return capFirst(parts.join(" · "));
}

function abilityLabel(id) {
  if (typeof id !== "string" || !ABILITY_IDS.has(id)) return C.abilityUnknown;
  const tail = /[A-Z][a-z]*$/.exec(id);
  return (tail && C.abilities[tail[0]]) || C.abilityUnknown;
}

function abilitiesLine(foe, sp) {
  const parts = [];
  const kit = rd(foe, "abilities");
  if (Array.isArray(kit)) {
    for (const id of kit) {
      const label = abilityLabel(id);
      if (!parts.includes(label)) parts.push(label);
    }
  }
  const note = rd(sp, "note");
  if (typeof note === "string" && note) parts.push(playerNote(note));
  return parts.length ? capFirst(parts.join(" · ")) : C.noTricks;
}

function multWho(row) {
  const who = row.casterSub || row.casterClass;
  if (row.sourceKind === "spell") return who ? fill(C.spellsBy, { who }) : C.spells;
  return who ? fill(C.blowsBy, { who }) : C.blows;
}

function resistLine(foe, type, name) {
  const parts = [];
  const intel = num(rd(foe, "intel"));
  parts.push(fill(C.int, { n: intel === null ? "?" : intel }));
  for (const row of DAMAGE_MULTIPLIERS) {
    const hit = (row.foeType && row.foeType === type) || (row.foeName && row.foeName === name);
    if (!hit) continue;
    parts.push(row.mult === 2 ? fill(C.double, { who: multWho(row) }) : fill(C.times, { who: multWho(row), n: row.mult }));
  }
  const lives = posInt(rd(foe, "lives"));
  if (lives !== null && lives > 1) parts.push(fill(C.lives, { n: lives }));
  return parts.join(" · ");
}

/** effectLines(foe, state) — Phase 71 (D-16, R-30): one "<text> — <desc>"
 * line per foeConditionChips chip, in table order, or [noEffects]. */
function effectLines(foe, state) {
  const chips = safe(() => foeConditionChips(foe, state), []);
  if (!chips.length) return [C.noEffects];
  return chips.map((c) => (c.desc ? `${c.text} — ${c.desc}` : c.text));
}

function fallbackCard(i) {
  return {
    kind: "foe",
    foe: Number.isInteger(i) ? i : -1,
    icon: FOE_GLYPHS.default,
    iconKey: null,
    title: C.something,
    tone: "info",
    hold: RAIL_HOLD.default,
    lines: [line(familyLine(null, null)), line(C.hpUnknown), line(C.noEffects), line(C.flavour.default)],
  };
}

/**
 * foeDetailsCard(i, state) — the D-09 rail card for state.combat.foes[i]:
 * { kind: "foe", foe: i, icon, iconKey: null, title, tone: "info",
 *   hold: RAIL_HOLD.default, lines }. A missing state, an out-of-range
 * index or a non-object foe gives the SOMETHING fallback card. Never
 * throws, never mutates.
 */
export function foeDetailsCard(i, state) {
  const foes = rd(rd(state, "combat"), "foes");
  if (!Array.isArray(foes) || !Number.isInteger(i) || i < 0 || i >= foes.length) return fallbackCard(i);
  const foe = rd(foes, i);
  if (!foe || typeof foe !== "object") return fallbackCard(i);

  const rawName = rd(foe, "name");
  const name = typeof rawName === "string" && rawName ? rawName : null;
  const rawType = rd(foe, "type");
  const type = typeof rawType === "string" && ENC_TYPES.includes(rawType) ? rawType : null;
  const rawSp = rd(foe, "sp");
  const sp = rawSp && typeof rawSp === "object" ? rawSp : {};

  const lines = [line(familyLine(type, rd(foe, "size"))), line(hpLine(foe))];
  const defence = defenceLine(sp);
  if (defence) lines.push(line(defence));
  const odds = oddsLine(foe, sp, state);
  if (odds) lines.push(line(odds));
  lines.push(line(attackLine(foe, sp, state)));
  lines.push(line(abilitiesLine(foe, sp)));
  lines.push(line(resistLine(foe, type, name)));
  for (const text of effectLines(foe, state)) lines.push(line(text));
  lines.push(line((type && C.flavour[type]) || C.flavour.default));

  return {
    kind: "foe",
    foe: i,
    icon: (type && FOE_GLYPHS[type]) || FOE_GLYPHS.default,
    iconKey: null,
    title: name ? name.toUpperCase() : C.something,
    tone: "info",
    hold: RAIL_HOLD.default,
    lines,
  };
}
