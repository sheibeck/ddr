// content/spell-level-overrides.js
//
// The NAMED EXCEPTIONS to a spell's printed level: a row here lowers the
// EFFECTIVE level of one spell for ONE sub-class without editing
// content/spells.js. It is read by exactly one engine helper,
// engine/derived.js#spellLevelFor, which canCast, rollGrimoire's usableNow,
// castSpell's spellAboveLevel, the Grimoire and combat-menu view models and
// identityFooter's generated chart-override lines all consume. Pure data, so
// a later phase adds a row here with no engine edit, and NO sub-class name
// check is ever written in engine code.
//
// Spell-name keys MUST equal SPELLS[].n exactly (content/spells.js); the
// sub-class keys MUST be MU_CHART rows whose chart can learn the spell's
// school (test/unit/school-gates.test.js's content guard fails otherwise).
//
// HISTORY. Phase 23 (2026-09-14, IDENT-03/IDENT-04) lowered Summoner/Summon and
// Illusionist/Phantom Host to level 1. Phase 40 (SPELL-04, 2026-09-18) retired
// the Summoner row for a separate level-1 spell, Lesser Summon. Phase 90 plan
// 06 (SPELL-12, 2026-09-30) removed Lesser Summon and Phantom Host and ruled
// the Summoner's Summon back to level 1:
//
// DELIBERATE RULES CHANGE (Phase 90 plan 06, SPELL-12, user 2026-09-30): "The
// Summoner may cast the level-2 Summon from level 1, as an exception to the
// school gates." Summon stays spell level 2 for every other sub-class. The
// Illusionist's Phantom Host row went with the spell.

export const SPELL_LEVEL_OVERRIDES = {
  Summoner: { Summon: 1 },
};
