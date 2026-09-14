// content/spell-level-overrides.js
//
// DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-03/IDENT-04): the
// prototype casts Summon at spell level 2 and Phantom Host at spell level 3
// for EVERY Magic User sub-class, so a level-1 Summoner could not summon at
// all and a level-1 Illusionist could only stall (Mirror Self) with no
// damage source of its own. This table lowers the EFFECTIVE level of a
// spell for ONE sub-class without editing content/spells.js — Summon stays
// spell level 2 and Phantom Host stays spell level 3 for every OTHER
// sub-class. It is read by exactly one engine helper,
// engine/derived.js#spellLevelFor, which canCast and rollGrimoire both
// consume. Pure data so Phase 24 can add rows here with no engine edit.
//
// Spell-name keys MUST equal SPELLS[].n exactly (see content/spells.js).

export const SPELL_LEVEL_OVERRIDES = {
  Summoner: { Summon: 1 },
  Illusionist: { "Phantom Host": 1 },
};
