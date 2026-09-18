// content/spell-level-overrides.js
//
// DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-03/IDENT-04): the
// prototype casts Summon at spell level 2 and Phantom Host at spell level 3
// for EVERY Magic User sub-class, so a level-1 Summoner could not summon at
// all and a level-1 Illusionist could only stall (Mirror Self) with no
// damage source of its own. This table lowers the EFFECTIVE level of a
// spell for ONE sub-class without editing content/spells.js. It is read by
// exactly one engine helper, engine/derived.js#spellLevelFor, which canCast
// and rollGrimoire both consume. Pure data so a later phase can add rows
// here with no engine edit.
//
// SUPERSEDED BY PHASE 40 (SPELL-04, 2026-09-18, DELIBERATE RULES CHANGE —
// user ruling verbatim, 40-CONTEXT.md Area 3): "Give the summoner a level 1
// summon. Summoning less strong than the level 2 summon. Then you can keep
// level 1 spells without the bad gate." The Summoner's level-1 summon is now
// its OWN row (Lesser Summon, content/spells.js row 32, `roll: "derived"`,
// `lesser: true`) rather than an override on Summon's effective level — so
// the `Summoner: { Summon: 1 }` row is RETIRED here. Summon is spell level 2
// for every sub-class again, including the Summoner; the Summoner's offense
// gate stays 3 (test/unit/identity-contract.test.js's locked "bad" is
// untouched — the user's own point: "keep level 1 spells without the bad
// gate", i.e. add a new safe spell, don't touch the existing gate). The
// Illusionist's Phantom Host override is unaffected.
//
// Spell-name keys MUST equal SPELLS[].n exactly (see content/spells.js).

export const SPELL_LEVEL_OVERRIDES = {
  Illusionist: { "Phantom Host": 1 },
};
