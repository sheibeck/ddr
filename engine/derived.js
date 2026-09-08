// engine/derived.js
//
// Pure, state-scoped derived character numbers (ENG-01). Ports the prototype's
// strikeDie/toHit/weaponDamage/upkeep/foeDie/foeToHitVs/inDark/levelFromSP/eff/
// skill helpers (mazeworld.html lines 1444-1498, 628-629, 1872-1876) and the
// Magic-User school gate helpers (lines 879-887), replacing every global `S.c`
// read with an explicit passed `c` (character) or `state` parameter. No global
// S, no DOM, no Math.random — only pure reads and arithmetic.

import { CLASSES, RACES, WEAPONS, STRIKE_DICE, THRESHOLDS, MU_CHART } from "../content/index.js";
import { rollDice } from "./dice.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// --- skills (state-scoped, not global) -------------------------------------

/** skill(c, name) — does the character have skill `name` at all? */
export const skill = (c, n) => !!(c.skills && c.skills[n]);

/** skillTier(c, name) — 0 (none), 1, or 2 (raised). */
export const skillTier = (c, n) => (c.skills && c.skills[n]) || 0;

/** eff(c, key) — sum of the named effect across the character's items. */
export function eff(c, key) {
  let t = 0;
  for (const it of c.items || []) if (it.eff && it.eff[key]) t += it.eff[key];
  return t;
}

// --- die / hit numbers ------------------------------------------------------

/**
 * strikeDie(c) — the die the character strikes on (lower is better). Pure
 * read of the character; ports mazeworld.html strikeDie() (lines 1445-1451).
 */
export function strikeDie(c) {
  let idx = c.level - 1;
  const R = RACES[c.race];
  if (R.strikeStep) idx = Math.min(4, idx + R.strikeStep);
  if (c.sub === "Illusionist" && c.level < 3) idx = 0; // d20 until level three
  if (c.acute > 0) idx = 4; // Potion of Acuteness: strike on a d6
  return STRIKE_DICE[idx];
}

/**
 * inDark(state) — is the player standing on an unlit square? Reads state.floor;
 * ports mazeworld.html inDark() (lines 1463-1466).
 */
export function inDark(state) {
  const f = state.floor;
  return !!(f && f.g[f.py] && f.g[f.py][f.px] && f.g[f.py][f.px].dark);
}

/**
 * toHit(state) — the die value the player needs to land a blow. Reads state.c,
 * state.combat (inspired) and state.floor (darkness); ports mazeworld.html
 * toHit() (lines 1452-1462).
 */
export function toHit(state) {
  const c = state.c;
  const R = RACES[c.race];
  let h = CLASSES[c.cls].toHit;
  if (R.toHit) h = Math.max(h, R.toHit); // Elves strike at 5 whatever their class
  if (c.sub === "Acrobat") h = 5; // strikes as a fighter with the dagger
  if (c.sub === "Cleric") h = Math.max(h, 4); // Clerics roll 4, not 3
  if (skill(c, "Kata")) h = Math.max(h, c.cls === "Fighter" ? 6 : 5);
  if (state.combat && state.combat.inspired) h += state.combat.inspired;
  h += eff(c, "toHit");
  if (inDark(state) && !skill(c, "Night Vision") && !c.senses) h = Math.min(h, 2);
  return h;
}

/**
 * foeDie(c, foe) — the die a creature of the foe's level strikes on against
 * this character; never lower than a d8 (p.24). Ports mazeworld.html foeDie()
 * (lines 1469-1472).
 */
export function foeDie(c, f) {
  const R = RACES[c.race];
  const step = R.foeStrikeStep || 0;
  return Math.max(8, STRIKE_DICE[clamp(f.lvl - 1 + step, 0, 4)]);
}

/**
 * foeToHitVs(state) — what a creature needs to land on this character. Reads
 * state.c and state.floor; ports mazeworld.html foeToHitVs() (lines 1473-1483).
 */
export function foeToHitVs(state) {
  const c = state.c;
  const R = RACES[c.race];
  let h = 5;
  if (R.foeToHit) h += R.foeToHit;
  if (c.sub === "Acrobat") h = 3;
  if (skill(c, "Agility")) h -= 1;
  h += eff(c, "foeToHit");
  if (inDark(state) && skill(c, "Silence")) h = 1; // a silent thief in the dark
  if (c.mirror > 0) h = 1; // Mirror Self
  if (c.invis > 0) h = 1; // invisible
  return Math.max(1, h);
}

/**
 * weaponDamage(c, rng) — a single strike's damage. The weapon's dice notation
 * is resolved here via the injected rng (the ONLY randomness in this module),
 * so this stays deterministic given (c, rng). Ports mazeworld.html
 * weaponDamage() (lines 1484-1496), with the prototype's `w.d()` closure
 * replaced by the content weapon's `dice`/`halve` notation.
 */
export function weaponDamage(c, rng) {
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const R = RACES[c.race];
  const base = w.halve ? Math.ceil(rollDice(rng, w.dice) / 2) : rollDice(rng, w.dice);
  let d = c.level * c.level + base + c.prof + c.magicWpn;
  if (R.dmg) d += R.dmg;
  if (R.wpnBonus) d += R.wpnBonus;
  if (c.might) d += c.might;
  if (skill(c, "Kata")) d += c.level;
  if (skill(c, "Heft")) d += 2;
  d += eff(c, "dmg");
  if (c.sub === "Guard" && c.level < 4) d -= 4 - c.level;
  if (c.sub === "Sorcerer") d = Math.min(d, 9); // a Sorcerer's arm is not the point
  return Math.max(1, d);
}

/**
 * upkeep(c) — wp burned feeding the character each night. Ports mazeworld.html
 * upkeep() (line 1497).
 */
export function upkeep(c) {
  const R = RACES[c.race];
  return Math.max(1, Math.round(R.upkeep * (skill(c, "Heft") ? 0.5 : 1)) + eff(c, "upkeep"));
}

/**
 * levelFromSP(sp) — skill level for a given skill-point total. Ports
 * mazeworld.html levelFromSP() (line 1498).
 */
export function levelFromSP(sp) {
  let l = 1;
  for (let i = 4; i >= 0; i--)
    if (sp >= THRESHOLDS[i]) {
      l = i + 1;
      break;
    }
  return l;
}

// --- Magic-User school gates ------------------------------------------------

/** Ports mazeworld.html lines 879-887 (schoolAllowed/Gate/Bonus/canLearn/canCast). */
export function schoolAllowed(sub, school) {
  const c = MU_CHART[sub];
  return !!c && c[school] !== null && c[school] !== undefined;
}

export function schoolGate(sub, school) {
  const c = MU_CHART[sub];
  return (c && c.gate && c.gate[school]) || 1;
}

export function schoolBonus(sub, school) {
  const c = MU_CHART[sub];
  return c && typeof c[school] === "number" ? c[school] : 0;
}

export function canLearn(sub, sp) {
  return schoolAllowed(sub, sp.s);
}

export function canCast(state, sp) {
  const c = state.c;
  if (!c.grimoire || !c.grimoire.includes(sp.n)) return false;
  if (sp.lvl > c.level) return false;
  return c.level >= schoolGate(c.sub, sp.s);
}
