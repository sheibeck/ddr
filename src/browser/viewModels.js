// src/browser/viewModels.js
//
// DOM-free, pure view-models locking the engine→screen data contract for the
// Wave-5 screens (04-08) before any DOM exists (UX-04, UX-05). Every binding
// reads the REAL GameState.c + engine/derived.js — per 04-RESEARCH.md
// Pitfall 1, never the design mockup's throwaway state-object field names.
// No DOM, no Math.random, no rng draws that touch the live state's rngState.

import { RACES, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, THRESHOLDS } from "../../content/index.js";
import { strikeDie, toHit, upkeep, skill, eff } from "../../engine/derived.js";

/**
 * skillTableFor(cls) — the special-skill description pool for a class
 * (mirrors engine/character.js's private skillTable()); Magic Users have no
 * table at all, matching rollSkills()'s early-return with an empty c.skills.
 */
function skillTableFor(cls) {
  return cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : null;
}

/**
 * damageBracket(c) — a deterministic [min, max] damage range for the
 * character's current weapon, mirroring engine/derived.js's weaponDamage()
 * modifier stack EXACTLY (level^2 + prof + magicWpn + race dmg/wpnBonus +
 * might + Kata/Heft skills + eff("dmg") + Guard/Sorcerer adjustments) but
 * resolving the weapon's dice notation as a [min, max] range instead of
 * drawing from an rng — so the sheet NEVER advances GameState.rngState
 * (T-04-06). Reads only `c`.
 */
function damageBracket(c) {
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const R = RACES[c.race];

  const diceMin = w.dice.n * 1 + w.dice.bonus;
  const diceMax = w.dice.n * w.dice.sides + w.dice.bonus;
  const baseMin = w.halve ? Math.ceil(diceMin / 2) : diceMin;
  const baseMax = w.halve ? Math.ceil(diceMax / 2) : diceMax;

  let flat = c.level * c.level + c.prof + c.magicWpn;
  if (R.dmg) flat += R.dmg;
  if (R.wpnBonus) flat += R.wpnBonus;
  if (c.might) flat += c.might;
  if (skill(c, "Kata")) flat += c.level;
  if (skill(c, "Heft")) flat += 2;
  flat += eff(c, "dmg");
  if (c.sub === "Guard" && c.level < 4) flat -= 4 - c.level;

  let min = Math.max(1, baseMin + flat);
  let max = Math.max(1, baseMax + flat);
  if (c.sub === "Sorcerer") {
    min = Math.min(min, 9);
    max = Math.min(max, 9);
  }
  if (max < min) max = min;
  return { min, max };
}

/** nextLevelValue(c) — the sp threshold for the next skill level, or "MAX" past the top of THRESHOLDS. */
function nextLevelValue(c) {
  if (c.level >= THRESHOLDS.length) return "MAX";
  return THRESHOLDS[c.level];
}

/**
 * snarkLine(c) — a static assembly of the real temperament/motive/phobia
 * fields (tone reference only; NOT a call into a copy generator — Phase 5
 * owns the real voice system). Deterministic string concatenation, no rng.
 */
function snarkLine(c) {
  return `${c.temperament}. Motivated by ${c.motive}. Terrified of ${c.phobia}.`;
}

/**
 * quirkText(c) — the character's real phobia rendered as the sheet's quirk
 * box copy (the closest real GameState field to the design mockup's
 * throwaway QUIRKS placeholder table, which this project does not port).
 */
function quirkText(c) {
  return c.phobiaType ? `Afraid of ${c.phobia} (${c.phobiaType}).` : `Afraid of ${c.phobia}.`;
}

/**
 * characterSheetViewModel(state) — the HERO tab's ("THE DOOMED") render-
 * ready data, bound to the real GameState. Returns a flat object: name,
 * level, classLabel, raceLabel, subLabel, snarkLine, stats[] (the 8 UI-SPEC
 * rows), winPotential {value,max,pct}, quirk {label,text}, skills[].
 */
export function characterSheetViewModel(state) {
  const c = state.c;
  const damage = damageBracket(c);

  const stats = [
    { key: "toStrike", label: "TO STRIKE", value: `d${strikeDie(c)}` },
    { key: "toHit", label: "TO HIT", value: `${toHit(state)}+` },
    { key: "damage", label: "DAMAGE", value: `${damage.min}–${damage.max}`, min: damage.min, max: damage.max },
    { key: "armor", label: "ARMOR", value: `${c.armor.toUpperCase()} · AR ${c.ar}` },
    { key: "intelligence", label: "INTELLIGENCE", value: c.intel },
    { key: "skillPoints", label: "SKILL POINTS", value: c.sp },
    { key: "nextLevel", label: "NEXT LEVEL", value: nextLevelValue(c) },
    { key: "upkeep", label: "UPKEEP", value: `${upkeep(c)} wp/day` },
  ];

  const winPotential = {
    value: c.wp,
    max: c.maxWP,
    pct: c.maxWP > 0 ? c.wp / c.maxWP : 0,
  };

  const skillsTable = skillTableFor(c.cls);
  const skills = skillsTable
    ? Object.keys(c.skills || {}).map((name) => {
        const tier = c.skills[name];
        const def = skillsTable[name] || {};
        const description = tier === 2 && def.txt2 ? def.txt2 : def.txt || "";
        return { name, description, tier };
      })
    : [];

  return {
    name: c.name,
    level: c.level,
    classLabel: c.cls,
    raceLabel: c.race,
    subLabel: c.sub,
    snarkLine: snarkLine(c),
    stats,
    winPotential,
    quirk: { label: "QUIRK", text: quirkText(c) },
    skills,
  };
}
