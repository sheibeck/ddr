// src/browser/identityFooter.js
//
// VOX-04 (Phase 79, Plan 03): the mechanical footer under every sub-class
// and race blurb.
//
// CONTEXT decision (user accepted 2026-09-25): "keep each SUB_NOTE/
// RACE_NOTE's sarcastic prose, and add a compact MECHANICAL FOOTER under
// each blurb, generated FROM the rules tables so prose and rules can never
// drift." REQUIREMENTS VOX-04 as amended 2026-09-25: RULES-03 removed the
// Summoner's offense gate, so the Summoner's footer names its half-strength
// healing and its summon backfire and claims no offense gate (MU_CHART no
// longer carries one, so none is generated).
//
// Sources, in the order each footer side reads them:
//   1. content/identity.js#IDENTITY_TRAITS — rules that live in engine code
//      keyed on a sub-class or race name, each tied to the test that proves
//      it (table order).
//   2. For a Magic User sub-class, MU_CHART read through the engine's own
//      helpers (schoolAllowed/schoolGate/schoolBonus/healMulFor/
//      spellLevelFor): "every school from level 1", then per school in
//      MU_CHART order the bonus (good), the gate above level 1 (bad) and the
//      never-learned schools (bad, one entry at the first one), then the
//      healMul weakness (bad), then every SPELL_LEVEL_OVERRIDES row (good).
//   3. For a race, every RACES field in the row's own key order, phrased by
//      RACE_FIELD_LINES. A field equal to the Human row's value says nothing.
//
// Deliberate: a school bonus only reaches the dice through a THROWN spell
// (engine/magic.js and engine/combat.js read schoolBonus in their thrown
// branches only, and every thrown spell is offense school). A bonus on a
// school with no thrown spell changes no roll, so it is not stated as an
// advantage; the footer never claims a rule the engine does not enforce.
// test/unit/identity-footer.test.js pins the engine's schoolBonus readers so
// this has to be revisited if a new one appears.
//
// Phase 91 plan 10 (TEXT-01, user 2026-09-30): the "faces" wording of ROLL-04
// is superseded. A shift reads "+N to hit" or "foes −N to hit you"; a hard cap
// or a crit range names its range on a d20 (computed here by rollRange.js from
// the engine's own number, never typed); "can talk to X" is "can always parley
// with X". test/unit/identity-text.test.js guards the wording and reads every
// number back through the engine.
//
// Pure: no DOM, no rng, no mutation. Numbers go through rollRange.js
// (signedText, U+2212; facesRangeText, the en dash); count words are words. The
// strings reach the DOM through textContent only (heroTab.js, roller.js).

import { IDENTITY_TRAITS, MU_CHART, SPELL_LEVEL_OVERRIDES, RACES, SPELLS, STRIKE_DICE, FREE_SKILL } from "../../content/index.js";
import {
  schoolAllowed,
  schoolGate,
  schoolBonus,
  healMulFor,
  spellLevelFor,
  spellEffectSquares,
  spellEffectRounds,
  foeDie,
  sizeAxisStep,
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
} from "../../engine/derived.js";
import { signedText, facesRangeText } from "./rollRange.js";

// ─── module-private helpers ─────────────────────────────────────────────

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const countWord = (n) => WORDS[n] ?? String(n);
const fractionWord = (x) => (x === 0.5 ? "half" : `${Math.round(x * 100)}%`);

/** The spell schools, from SPELLS itself (MU_CHART rows also carry gate/healMul). */
const SCHOOLS = new Set(SPELLS.map((sp) => sp.s));

/** The schools a chart bonus actually reaches: those with a thrown spell. */
const BONUS_SCHOOLS = new Set(SPELLS.filter((sp) => sp.kind === "thrown").map((sp) => sp.s));

function orList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function andList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const entry = (id, side, text) => ({ id, side, text });

// ─── Magic User chart lines ─────────────────────────────────────────────

/**
 * stretchLine(sub, school) — Phase 91 plan 10 (the audit's unstated Special stretch, Phase 90 Q6 A): a school
 * bonus lengthens the timed spells of its school, by the engine's own helpers (`spellEffectSquares` for the
 * square-timed spells, `spellEffectRounds` for the round-timed ones). Returns "" when the bonus stretches
 * nothing (a Wizard's Special +0).
 */
function stretchLine(sub, school) {
  const bySquares = new Map();
  const byRounds = new Map();
  for (const sp of SPELLS) {
    if (sp.s !== school || !sp.stretch) continue;
    if (sp.stretch === "squares") {
      const d = spellEffectSquares(sub, sp) - (sp.act && Number.isInteger(sp.act.effect) ? sp.act.effect : 0);
      if (d > 0) bySquares.set(d, [...(bySquares.get(d) || []), sp.n]);
    } else if (sp.stretch === "rounds") {
      const d = spellEffectRounds(sub, sp, 0);
      if (d > 0) byRounds.set(d, [...(byRounds.get(d) || []), sp.n]);
    }
  }
  const parts = [];
  for (const [d, names] of bySquares) parts.push(`your ${andList(names)} last ${d} squares longer`);
  for (const [d, names] of byRounds) parts.push(`${parts.length ? "" : "your "}${andList(names)} ${names.length === 1 ? "lasts" : "last"} ${d} round${d === 1 ? "" : "s"} longer`);
  return parts.join(", and ");
}

function chartLines(sub) {
  const row = MU_CHART[sub];
  if (!row) return [];
  const schools = Object.keys(row).filter((k) => SCHOOLS.has(k));
  const out = [];
  if (schools.every((s) => schoolAllowed(sub, s) && schoolGate(sub, s) <= 1)) {
    out.push(entry("chart-open", "good", "every school of magic from level 1"));
  }
  const never = schools.filter((s) => !schoolAllowed(sub, s));
  let neverDone = false;
  for (const school of schools) {
    if (!schoolAllowed(sub, school)) {
      if (!neverDone) {
        out.push(entry("chart-never", "bad", `never learns ${orList(never)} spells`));
        neverDone = true;
      }
      continue;
    }
    const bonus = schoolBonus(sub, school);
    if (bonus > 0 && BONUS_SCHOOLS.has(school)) {
      out.push(entry(`chart-bonus-${school}`, "good", `${signedText(bonus)} to hit with thrown ${school} spells`));
    }
    const gate = schoolGate(sub, school);
    if (gate > 1) out.push(entry(`chart-gate-${school}`, "bad", `no ${school} spells until level ${gate}`));
    const stretch = stretchLine(sub, school);
    if (stretch) out.push(entry(`chart-stretch-${school}`, "good", stretch));
  }
  const mul = healMulFor(sub);
  if (mul < 1) out.push(entry("chart-healmul", "bad", `healing spells you cast heal at ${fractionWord(mul)} strength`));
  for (const [name, lvl] of Object.entries(SPELL_LEVEL_OVERRIDES[sub] || {})) {
    const sp = SPELLS.find((s) => s.n === name);
    if (!sp || spellLevelFor(sub, sp) === sp.lvl) continue;
    const better = lvl < sp.lvl;
    out.push(entry(`chart-override-${name}`, better ? "good" : "bad", `${name} castable from level ${lvl} (level ${sp.lvl} for everyone else)`));
  }
  return out;
}

// ─── race field lines ───────────────────────────────────────────────────

const HUMAN = RACES.Human || {};

/** Both size axes, read through the engine's own sizeAxisStep (signature mask included). */
function sizeLines(row, race) {
  const out = [];
  const word = String(row.size || "").toLowerCase();
  // The damage axis joins the race's own damage line when it has one
  // (damageLines), so the player reads one net number.
  const dmg = ownDamage(row) === 0 ? SIZE_DAMAGE_PER_STEP * sizeAxisStep({ race }, "dmg") : 0;
  if (dmg > 0) out.push(entry("race-size-dmg", "good", `being ${word} adds ${dmg} damage`));
  if (dmg < 0) out.push(entry("race-size-dmg", "bad", `being ${word} costs ${-dmg} damage`));
  const face = SIZE_FACES_PER_STEP * sizeAxisStep({ race }, "face");
  if (face > 0) out.push(entry("race-size-face", "bad", `being ${word} means foes ${signedText(face)} to hit you`));
  if (face < 0) out.push(entry("race-size-face", "good", `being ${word} means foes ${signedText(face)} to hit you`));
  return out;
}

/** The race's own weapon damage: dmg and wpnBonus both add straight to every blow. */
function ownDamage(row) {
  return (row.dmg || 0) + (row.wpnBonus || 0);
}

/**
 * dmg, wpnBonus and the size damage axis read as one net number, with the
 * size share named ("+11 damage with every weapon (2 of it for being
 * large)"); a masked axis adds nothing (the Dwarven +2 stays +2).
 */
function damageLines(row, race) {
  const own = ownDamage(row);
  if (own === 0) return [];
  const size = SIZE_DAMAGE_PER_STEP * sizeAxisStep({ race }, "dmg");
  const total = own + size;
  const word = String(row.size || "").toLowerCase();
  const share = size > 0 ? ` (${size} of it for being ${word})` : size < 0 ? ` (${-size} less for being ${word})` : "";
  return [entry("race-dmg", total > 0 ? "good" : "bad", `${signedText(total)} damage with every weapon${share}`)];
}

/**
 * RACE_FIELD_LINES — RACES field -> phrase(row, race) returning
 * [{ id, side, text }]. One entry per non-cosmetic field; fields that the
 * player reads as one number share a phrase and an id (dmg/wpnBonus,
 * size/sizeAxes), and identityFooter keeps the first. RACE_COSMETIC_FIELDS
 * lists the fields that carry no rule (`note`: the blurb itself).
 */
export const RACE_FIELD_LINES = Object.freeze({
  size: sizeLines,
  sizeAxes: sizeLines,
  dmg: damageLines,
  wpnBonus: damageLines,
  upkeep: (row) => {
    const v = row.upkeep;
    const h = HUMAN.upkeep;
    if (v === h || !Number.isFinite(v)) return [];
    const text = `a night without rations costs ${v < h ? "only " : ""}${v} HP (a Human's costs ${h})`;
    return [entry("race-upkeep", v < h ? "good" : "bad", text)];
  },
  flatWP: (row) => [entry("race-flat-hp", "good", `starts with ${row.flatWP} HP whatever the class`)],
  wpMul: (row) => (row.wpMul === 1 ? [] : [entry("race-hp-mul", row.wpMul < 1 ? "bad" : "good", `${Math.round(row.wpMul * 100)}% of the usual HP, at every level`)]),
  // A smaller strike die hits more often (the winning numbers count down from the top of the die), so "one size
  // better" is "one size smaller": the die is named at level 1, from the engine's own STRIKE_DICE.
  strikeStep: (row) => {
    const n = row.strikeStep;
    if (!n) return [];
    const die = STRIKE_DICE[Math.min(STRIKE_DICE.length - 1, Math.max(0, n))];
    const sizes = `${countWord(Math.abs(n))} size${Math.abs(n) === 1 ? "" : "s"}`;
    return [entry("race-strike-step", n > 0 ? "good" : "bad", `your strike die is ${sizes} ${n > 0 ? "smaller" : "bigger"} (a d${die} at level 1, not a d${STRIKE_DICE[0]}), so you hit ${n > 0 ? "more" : "less"} often`)];
  },
  toHit: (row) => [entry("race-to-hit", "good", `you hit on at least the top ${row.toHit === 1 ? "number" : `${countWord(row.toHit)} numbers`} of your strike die (${facesRangeText(row.toHit, STRIKE_DICE[0])} on a d${STRIKE_DICE[0]}), whatever the class`)],
  foeToHit: (row) => {
    const n = row.foeToHit;
    if (!n) return [];
    return [entry("race-foe-to-hit", n > 0 ? "bad" : "good", `foes ${signedText(n)} to hit you`)];
  },
  // foeDie reads the race row itself (never below a d8), so the level 1 die and the floor are the engine's own.
  foeStrikeStep: (row, race) => {
    const n = row.foeStrikeStep;
    if (!n) return [];
    const sizes = `${countWord(Math.abs(n))} size${Math.abs(n) === 1 ? "" : "s"}`;
    const dieNote = race ? ` (a d${foeDie({ race }, { lvl: 1 })} for a level 1 foe, never below a d${foeDie({ race }, { lvl: 99 })})` : "";
    return [entry("race-foe-strike-step", n > 0 ? "bad" : "good", `foes strike on a die ${sizes} ${n > 0 ? "smaller" : "bigger"}${n > 0 ? dieNote : ""}, so they hit you ${n > 0 ? "more" : "less"} often`)];
  },
  armorWear: (row) => (row.armorWear < 1 ? [entry("race-armor-wear", "good", `armour wears at ${fractionWord(row.armorWear)} the rate`)] : []),
  heal2x: (row) => (row.heal2x ? [entry("race-heal2x", "good", "rest, potions and your own healing spells heal twice as much")] : []),
  spMul: (row) => (row.spMul < 1 ? [entry("race-sp-mul", "bad", `${fractionWord(row.spMul)} the experience from every kill`)] : []),
  // A Samurai starts in plate, so a race that never wears armour can never be one (engine/character.js rerolls the
  // sub and refuses a forced pair): the second line is the audit's unstated no-Samurai rule, now stated.
  noArmor: (row) => (row.noArmor ? [entry("race-no-armor", "bad", "can never wear armour"), entry("race-no-samurai", "bad", "can never be a Samurai (the job comes with plate)")] : []),
  // The 4-6 on a d6 is engine/combat.js's frenzy check,
  // rollCheck(rng, 6, atLeastFor(3, 6)) (IDENT-20); test/unit/fridgian-frenzy.test.js
  // and test/unit/identity-footer.test.js pin that source so the number cannot
  // drift. The extra swing is one step narrower than the hero's own (-1 to hit,
  // the user's 2026-09-24 ruling); U+2212 minus and an en dash in "4–6".
  frenzy: (row) => (row.frenzy ? [entry("race-frenzy", "good", "each time you strike, a 4–6 on a d6 gives you a second, wilder swing (−1 to hit)")] : []),
  slow: (row) => (row.slow ? [entry("race-slow", "bad", "never wins initiative")] : []),
  hide: (row) => (row.hide > 0 ? [entry("race-hide", "good", `thick hide soaks ${row.hide} from every blow`)] : []),
  eats: (row) => (row.eats > 1 ? [entry("race-eats", "bad", `eats ${countWord(row.eats)} rations a night`)] : []),
});

/** RACE_COSMETIC_FIELDS — RACES fields no rule reads (the row's own blurb). */
export const RACE_COSMETIC_FIELDS = Object.freeze(["note"]);

/**
 * unphrasedRaceFields(races) — every non-cosmetic field used by any row of
 * `races` that RACE_FIELD_LINES does not phrase. The standing coverage
 * guard: a new RACES field fails the footer test until it is phrased.
 */
export function unphrasedRaceFields(races = RACES) {
  const missing = new Set();
  for (const row of Object.values(races)) {
    for (const field of Object.keys(row)) {
      if (RACE_COSMETIC_FIELDS.includes(field)) continue;
      if (!Object.prototype.hasOwnProperty.call(RACE_FIELD_LINES, field)) missing.add(field);
    }
  }
  return [...missing];
}

/**
 * subLines(sub) — the lines a sub-class's own data states outside the Magic User chart: the free starting skill
 * (content/kit.js#FREE_SKILL, read by engine/character.js#rollSkills; Phase 91 plan 10 states the audit's
 * unstated free-skill rows). One good line for a sub-class with an entry, nothing otherwise.
 */
function subLines(sub) {
  const skill = Object.prototype.hasOwnProperty.call(FREE_SKILL, sub) ? FREE_SKILL[sub] : null;
  return skill ? [entry("free-skill", "good", `starts with the ${skill} skill for free`)] : [];
}

function raceLines(race) {
  const row = RACES[race];
  if (!row) return [];
  const out = [];
  for (const field of Object.keys(row)) {
    if (RACE_COSMETIC_FIELDS.includes(field)) continue;
    if (Object.prototype.hasOwnProperty.call(HUMAN, field) && row[field] === HUMAN[field]) continue;
    const phrase = RACE_FIELD_LINES[field];
    if (phrase) out.push(...phrase(row, race));
  }
  return out;
}

// ─── the footer ─────────────────────────────────────────────────────────

/**
 * identityEntries(kind, key) — the ordered `[{ id, side, text }]` list the
 * footer is built from (Phase 91 plan 01, IDENT-11: the identity audit reads
 * it to know every row an identity must have). Authored traits first, good
 * then bad, in table order; then the generated lines (a Magic User's chart
 * lines, a race's field lines); an id already taken is skipped, so an
 * authored trait and a generated line with the same id are ONE entry. Human's
 * neutral line is one entry `{ id: "human-neutral", side: "neutral", text }`,
 * placed first. An unknown kind or key returns []. Pure: no rng, no mutation.
 */
export function identityEntries(kind, key) {
  const authored = (IDENTITY_TRAITS[kind] && Object.prototype.hasOwnProperty.call(IDENTITY_TRAITS[kind], key) && IDENTITY_TRAITS[kind][key]) || null;
  const generated = kind === "sub" ? [...chartLines(key), ...subLines(key)] : kind === "race" ? raceLines(key) : [];
  const out = [];
  const seen = new Set();
  if (authored && authored.neutral) {
    seen.add(authored.neutral.id);
    out.push(entry(authored.neutral.id, "neutral", authored.neutral.text));
  }
  for (const sideName of ["good", "bad"]) {
    for (const t of (authored && authored[sideName]) || []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(entry(t.id, sideName, t.text));
    }
  }
  for (const e of generated) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/**
 * identityFooter(kind, key) — `kind` is "sub" or "race". Returns
 * { good: string[], bad: string[] } (plus `neutral: string` for the one
 * neutral race, Human). Authored traits first, in table order, then the
 * generated lines; an entry id already taken is skipped. An unknown kind or
 * key returns { good: [], bad: [] } and never throws. Built on
 * identityEntries, byte-identical to the pre-audit output.
 */
export function identityFooter(kind, key) {
  const entries = identityEntries(kind, key);
  if (!entries.length) return { good: [], bad: [] };
  const out = { good: [], bad: [] };
  for (const e of entries) {
    if (e.side === "neutral") out.neutral = e.text;
    else out[e.side].push(e.text);
  }
  return out;
}

/**
 * footerLines(kind, key) — the footer as displayed lines: "Good: a; b." then
 * "Bad: c; d." (a side with no entries is left out), or the neutral line
 * alone. An unknown key returns [].
 */
export function footerLines(kind, key) {
  const f = identityFooter(kind, key);
  if (f.neutral) return [f.neutral];
  const lines = [];
  if (f.good.length) lines.push(`Good: ${f.good.join("; ")}.`);
  if (f.bad.length) lines.push(`Bad: ${f.bad.join("; ")}.`);
  return lines;
}
