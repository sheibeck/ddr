// content/encounters.js
//
// Pure-data port of mazeworld.html's ENCOUNTER_TABLES (~line 819-828): roll
// a d8 for the table, then a d10 on that table. No closures in the
// prototype — ported verbatim, order preserved exactly (index lookups
// depend on it).
//
// DELIBERATE TEXT/CONTENT DIVERGENCES (04.2 Text batch, 2026-09-09):
//  - The affliction dispatch bucket was renamed "Disease" -> "Ailment"
//    (kind-neutral): the real diagnosis is a SECOND roll in catchAffliction
//    (Poison/Disease), so the bucket label must never contradict it (A1).
//  - Player-facing unit tokens were modernised in the Table-4 row: "WP"->"HP",
//    "SP"->"XP", "WM"->"wilmst" (E3/P2). These strings are DUAL-PURPOSE — each
//    is also the switch key in engine/encounters.js tableFour(); both were
//    changed atomically.
//  - ECON-09 (Phase 16, Economy E): the Table-4 gold row was renamed from the
//    number-baking "+3000 wilmst" to the generic "wilmst cache" (table idx 3,
//    cell idx 8), changed ATOMICALLY with the switch key in
//    engine/encounters.js tableFour(). The reward is now a depth-scaled FLAT
//    amount (~300 * depth, NO new rng), so a dual-purpose string that hard-codes
//    "3000" would lie about the payout; the actual amount is narrated at
//    runtime via the existing `goldGained` event (the row pushes no beat of its
//    own). Parity-safe: no parity fixture rolls this cell (verified Phase 16).
//  - "Teleport" is REMOVED from the encounter tables entirely (E1, user
//    directive 2026-09-09 "we already have teleport" — it exists as a spell +
//    an insanity outcome, so a red-dot teleport encounter was redundant). Both
//    surviving cells were replaced with existing dispatch keys, keeping each
//    d10 array length 10: the encounter-TYPE row (table idx 2, cell idx 5)
//    "Teleport"->"Misc Magic"; the Table-4 numeric row (table idx 3, cell idx 2)
//    "Teleport"->"-10 HP" (the earlier E1 pass had only replaced the numeric
//    row's SECOND teleport at idx 7). `encounterDot`'s `case "Teleport"` +
//    the teleport() import are kept (still used by goInsane's insanity table).
// The frozen parity master (test/parity/prototype-master.js.txt) keeps the old
// strings; these are DELIBERATE content divergences. Parity stays green because
// no parity fixture rolls these specific cells (verified by the suite) — the
// replaced cells would otherwise change dispatched state, so this is validated
// by running the full parity suite, not assumed.

export const ENCOUNTER_TABLES = [
  ["Lair Beast", "Magical", "Beasts", "Food", "Humans", "Magical", "Walking Dead", "Beasts", "Lair Beast", "Demons"],
  ["Lair Beast", "Misc Magic", "Beasts", "Walking Dead", "Joiner", "Demons", "Store", "Humans", "Magical", "Weapon"],
  ["Demons", "Walking Dead", "Lair Beast", "Misc Magic", "Beasts", "Misc Magic", "Ailment", "Magical", "Humans", "Magic Armor"],
  ["+10 HP", "-10 HP", "-10 HP", "+10 XP", "+25 HP", "+25 XP", "-15 HP", "-10 HP", "wilmst cache", "-All armour"],
  ["Magic Weapon", "Lair Beast", "Misc Magic", "Humans", "Food", "Misc Magic", "Demons", "Walking Dead", "Beasts", "Magic Armor"],
  ["Beasts", "Grimoire", "Lair Beast", "Humans", "Demons", "Ailment", "Store", "Misc Magic", "Magical", "Joiner"],
  ["Humans", "Faerie", "Demons", "Beasts", "Insanity", "Phobia", "Lair Beast", "Darkness", "Walking Dead", "Magical"],
  ["Misc Magic", "Beasts", "Faerie", "Magic Armor", "Walking Dead", "Lair Beast", "Demons", "Humans", "Magical", "Food"],
];
