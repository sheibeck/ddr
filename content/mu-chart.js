// content/mu-chart.js
//
// Pure-data port of mazeworld.html's MU_CHART table (~line 869-878). Maps
// Magic User subclass -> per-school thrown-spell bonus / gate. No closures
// in the prototype — ported verbatim. `schoolAllowed`/`schoolGate`/
// `schoolBonus`/`canLearn`/`canCast` are logic, not data — they move to
// engine/character.js in plan 01-05.

export const MU_CHART = {
  // DELIBERATE RULES CHANGE (Phase 90 plan 06, SPELL-12, user ruling
  // 2026-09-30; rulebook p.17): Illusion spells are the Illusionist's, and the
  // Apprentice's ("even Illusionist spells") — the Wizard never learns that
  // school. `illusion: null` means never learned (schoolAllowed false;
  // identityFooter generates "never learns illusion spells").
  "Wizard": { offense: 3, protection: 0, healing: 0, divination: 0, special: 0, illusion: null },
  // Phase 91.1 plan 03 (V18 B, user ruling 2026-10-01): a divination bonus changes no roll (no divination
  // spell has a number to stretch), so every divination number below is 0. A protection bonus is 5 HP per
  // point on the caster's Shield soak and Bubble film (engine/derived.js#wardBonusFor); a healing bonus is
  // added to every heal the caster casts (derived.js#healBonusFor); the Illusion bonus (V19 B) stretches
  // Senseless and Duplicate Foe by that many rounds.
  "Warlock": {
    offense: 4, protection: 0, healing: 0, divination: 0, special: null, illusion: null,
    gate: { protection: 4, healing: 3 },
  },
  "Sorcerer": {
    offense: 4, protection: 1, healing: 0, divination: 0, special: 1, illusion: null,
    gate: { healing: 4 },
  },
  "Court Mage": {
    offense: 2, protection: 2, healing: 1, divination: 0, special: null, illusion: null,
    gate: { divination: 4 },
  },
  "Illusionist": {
    offense: 0, protection: 0, healing: null, divination: 0, special: 4, illusion: 1,
    gate: { protection: 3 },
  },
  // DELIBERATE RULES CHANGE (Phase 91 plan 02, IDENT-15, user ruling
  // 2026-09-30: "cannot cast offensive spells, because they gain more hit
  // points"): the Cleric never learns the OFFENSE school (including its buff,
  // Strength). `offense: null` means never learned, the same gate data Phase 90
  // wrote for the Wizard's Illusion: canLearn / grantableAt / findGrimoire /
  // the scribe gate (canCast) / the combat menu all follow it, and no Cleric
  // name check exists anywhere. The prototype's MU_CHART (offense +0) is left
  // untouched. A scroll that rolls an offense spell still free-casts for a
  // Cleric (Q3 B, RULES-10): the ban is the book's, not the scroll's. Phase 91.1 plan 03 (V20 B, user
  // 2026-10-01): ONE exception, named in MU_SPELL_EXCEPTIONS below: the Cleric may learn Strength (a buff,
  // not an attack). The school's gate (null) is unchanged for every other offense spell.
  "Cleric": {
    offense: null, protection: 3, healing: 4, divination: 0, special: null, illusion: null,
    gate: { divination: 3 },
  },
  // RULES-03, Phase 75, user 2026-09-25: the offense gate is removed — a
  // level-1 Summoner rolls and casts offense normally. The trade-off is the
  // summon backfire (one Summon in eight turns turns on you), plus (75-10)
  // a healing weakness: healMul is read by engine/derived.js#healMulFor,
  // which halves (floor, minimum 1) any healing-school spell the Summoner
  // itself casts (Heal/Major Heal, and its own Regeneration tick). This is
  // a chart data flag, never a name check — no other row carries healMul,
  // so healMulFor(sub) defaults to 1 for everyone else.
  "Summoner": {
    offense: 0, protection: 2, healing: 0, divination: 0, special: 1, illusion: null,
    healMul: 0.5,
  },
  "Apprentice": {
    offense: 0, protection: 0, healing: 0, divination: 0, special: 0, illusion: 0,
    gate: { divination: 3 },
  },
};

/**
 * MU_SPELL_EXCEPTIONS — Phase 91.1 plan 03 (V20 B, user 2026-10-01): the NAMED spells a sub-class may learn
 * although its chart closes their school (the Summoner's level exception is content/spell-level-overrides.js;
 * this is its sibling for a closed school). Read by exactly one engine helper, derived.js#spellException, which
 * canLearn and spellClosed consume; no sub-class name check exists in engine code. Keys are MU_CHART rows whose
 * school is closed; test/unit/school-gates.test.js guards the table. Pure data.
 */
export const MU_SPELL_EXCEPTIONS = Object.freeze({
  Cleric: Object.freeze(["Strength"]),
});
