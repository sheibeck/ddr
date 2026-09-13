// content/damage-multipliers.js
//
// Pure lookup table for CANON-04 (Phase 18, D-11): damage-source x
// creature-type multipliers. Consulted ONLY by engine/foeDamage.js (the
// single foe-damage seam) — the matching function (`multiplierFor`) lives
// there, not here, because content must stay function-free
// (test/determinism/content-is-pure-data.test.js forbids function-typed
// leaves under content/).
//
// "Magic"/spell damage means SPELL damage only — a magic weapon (c.magicWpn)
// does NOT count as magic for these rows; rows match on `source.kind`
// ("spell" vs "melee"/etc.), never on whether the wielded weapon is +N.
//
// The Fighter-vs-Trachea row is HERO-ONLY in this phase (D-20): party
// members carry no `cls` field on C.allies entries, so `source.casterClass`
// is only ever populated for the hero's own melee strikes.
//
// Rulebook citations:
//   - row 1: p.37 "Gremlin/Demons" — Cleric-cast spells do double damage to
//     Demons.
//   - row 2: p.39 "Google/Walking Dead" — any spell damage ("even magical")
//     does double damage to the Walking Dead.
//   - row 3: p.38 "Lair Beasts" Trachea entry — fighters do double melee
//     damage to the Trachea.
//
// Every row shares the same five keys (`null` = wildcard) so the shape is
// uniform and the table round-trips through JSON cleanly.

export const DAMAGE_MULTIPLIERS = [
  // p.37: Cleric-cast spells do double damage to Demons.
  { sourceKind: "spell", casterSub: "Cleric", casterClass: null, foeType: "Demons", foeName: null, mult: 2 },
  // p.39: any spell damage does double damage to the Walking Dead.
  { sourceKind: "spell", casterSub: null, casterClass: null, foeType: "Walking Dead", foeName: null, mult: 2 },
  // p.38: Fighter melee does double damage to the Trachea (hero-only, D-20).
  { sourceKind: "melee", casterSub: null, casterClass: "Fighter", foeType: null, foeName: "Trachea", mult: 2 },
];
