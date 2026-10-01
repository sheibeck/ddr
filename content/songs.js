// content/songs.js
//
// Phase 91 (IDENT-17, plan 91-06): the Bard's song data. SING is a combat action
// a Bard hero takes once per fight (user, 2026-09-30: "Let's allow this to be
// used once per fight as a combat action."), and its effect is one random
// spell, at full strength, rolled and resolved as a Magic User of the Bard's
// level would cast it. The old fixed five-song table (Soothe the Savage,
// Inspire the Heart, Lullaby, Cry of Thunder, An Ode to Death, one per level)
// is retired: its five names live on here as sung TITLES.
//
// Claude's discretion (91-CONTEXT, "the sung-title list"): the list mixes the
// five old names, used as they stand, with templated titles holding a
// `{spell}` slot that engine/combat.js#sing fills with the picked spell's
// name, all in the house voice (sarcastic, family-friendly). "Defense" means
// the protection school, so SONG_SCHOOLS is offense plus protection; Special,
// Illusion, healing and divination spells are never sung.
//
// Pure data, no rng, no DOM. The title is picked from a derived stream in
// engine/combat.js#sing; a title is flavour only and never changes the spell.

/**
 * SONG_TITLES — every sung title. An entry with a `{spell}` slot names the
 * spell it echoes; an entry without one (the five old song names) is used as
 * is. Two titles for the same spell are two different songs, never merged.
 */
export const SONG_TITLES = Object.freeze([
  "Soothe the Savage",
  "Inspire the Heart",
  "Lullaby",
  "Cry of Thunder",
  "An Ode to Death",
  "An Ode to {spell}",
  "The Ballad of {spell}",
  "{spell}, in a Minor Key",
  "Ten Verses on {spell}",
  "The {spell} Blues",
  "{spell}: The Musical",
  "Hymn to {spell}, Slightly Flat",
  "Variations on {spell}, Mostly Loud",
  "{spell} (The Power Ballad)",
  "A Rousing Chorus of {spell}",
  "The Ill-Advised {spell} Medley",
]);

/**
 * SONG_SCHOOLS — the spell schools a song may echo: offense and protection
 * (the "defense" spells). A song's pool is every SPELLS row in these schools at
 * or below the Bard's level (engine/combat.js#songPool).
 */
export const SONG_SCHOOLS = Object.freeze(["offense", "protection"]);
