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
// Pure: no DOM, no rng, no mutation. Numbers go through rollRange.js
// (signedText, U+2212); face counts are words. The strings reach the DOM
// through textContent only (heroTab.js, roller.js).

import { IDENTITY_TRAITS, MU_CHART, SPELL_LEVEL_OVERRIDES, RACES, SPELLS, STRIKE_DICE } from "../../content/index.js";
import {
  schoolAllowed,
  schoolGate,
  schoolBonus,
  healMulFor,
  spellLevelFor,
  sizeAxisStep,
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
} from "../../engine/derived.js";
import { signedText } from "./rollRange.js";

// ─── module-private helpers ─────────────────────────────────────────────

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const countWord = (n) => WORDS[n] ?? String(n);
const faces = (n) => `${countWord(n)} face${n === 1 ? "" : "s"}`;
const fractionWord = (x) => (x === 0.5 ? "half" : `${Math.round(x * 100)}%`);

/** The spell schools, from SPELLS itself (MU_CHART rows also carry gate/healMul). */
const SCHOOLS = new Set(SPELLS.map((sp) => sp.s));

/** The schools a chart bonus actually reaches: those with a thrown spell. */
const BONUS_SCHOOLS = new Set(SPELLS.filter((sp) => sp.kind === "thrown").map((sp) => sp.s));

function orList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

const entry = (id, side, text) => ({ id, side, text });

// ─── Magic User chart lines ─────────────────────────────────────────────

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
      out.push(entry(`chart-bonus-${school}`, "good", `your thrown ${school} spells land on ${countWord(bonus)} more face${bonus === 1 ? "" : "s"}`));
    }
    const gate = schoolGate(sub, school);
    if (gate > 1) out.push(entry(`chart-gate-${school}`, "bad", `no ${school} spells until level ${gate}`));
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
  if (face > 0) out.push(entry("race-size-face", "bad", `being ${word} makes you ${faces(face)} easier to hit`));
  if (face < 0) out.push(entry("race-size-face", "good", `being ${word} makes you ${faces(-face)} harder to hit`));
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
  strikeStep: (row) => {
    const n = row.strikeStep;
    if (!n) return [];
    const die = STRIKE_DICE[Math.min(STRIKE_DICE.length - 1, Math.max(0, n))];
    return [entry("race-strike-step", n > 0 ? "good" : "bad", `strikes on a die ${countWord(Math.abs(n))} size${Math.abs(n) === 1 ? "" : "s"} ${n > 0 ? "better" : "worse"} (a d${die} at level 1, not a d${STRIKE_DICE[0]})`)];
  },
  toHit: (row) => [entry("race-to-hit", "good", `at least your top ${faces(row.toHit)} hit, whatever the class`)],
  foeToHit: (row) => {
    const n = row.foeToHit;
    if (!n) return [];
    return [entry("race-foe-to-hit", n > 0 ? "bad" : "good", `foes land on ${faces(Math.abs(n))} ${n > 0 ? "more" : "fewer"} against you`)];
  },
  foeStrikeStep: (row) => {
    const n = row.foeStrikeStep;
    if (!n) return [];
    return [entry("race-foe-strike-step", n > 0 ? "bad" : "good", `foes strike on a die ${countWord(Math.abs(n))} size${Math.abs(n) === 1 ? "" : "s"} ${n > 0 ? "better" : "worse"}`)];
  },
  armorWear: (row) => (row.armorWear < 1 ? [entry("race-armor-wear", "good", `armour wears at ${fractionWord(row.armorWear)} the rate`)] : []),
  heal2x: (row) => (row.heal2x ? [entry("race-heal2x", "good", "rest, potions and your own healing spells heal twice as much")] : []),
  spMul: (row) => (row.spMul < 1 ? [entry("race-sp-mul", "bad", `${fractionWord(row.spMul)} the experience from every kill`)] : []),
  noArmor: (row) => (row.noArmor ? [entry("race-no-armor", "bad", "can never wear armour")] : []),
  // The five-in-eight odds are engine/combat.js's frenzy check,
  // rollCheck(rng, 8, atLeastFor(5, 8)); test/unit/identity-footer.test.js
  // pins that source so the number cannot drift.
  frenzy: (row) => (row.frenzy ? [entry("race-frenzy", "good", "five times in eight, a frenzy adds a second swing that never wastes itself on a corpse")] : []),
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
 * identityFooter(kind, key) — `kind` is "sub" or "race". Returns
 * { good: string[], bad: string[] } (plus `neutral: string` for the one
 * neutral race, Human). Authored traits first, in table order, then the
 * generated lines; an entry id already taken is skipped. An unknown kind or
 * key returns { good: [], bad: [] } and never throws.
 */
export function identityFooter(kind, key) {
  const authored = (IDENTITY_TRAITS[kind] && Object.prototype.hasOwnProperty.call(IDENTITY_TRAITS[kind], key) && IDENTITY_TRAITS[kind][key]) || null;
  const generated = kind === "sub" ? chartLines(key) : kind === "race" ? raceLines(key) : [];
  if (!authored && !generated.length) return { good: [], bad: [] };
  const out = { good: [], bad: [] };
  if (authored && authored.neutral) out.neutral = authored.neutral.text;
  const seen = new Set();
  for (const sideName of ["good", "bad"]) {
    for (const t of (authored && authored[sideName]) || []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out[sideName].push(t.text);
    }
  }
  for (const e of generated) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out[e.side].push(e.text);
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
