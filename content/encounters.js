// content/encounters.js
//
// Pure-data port of mazeworld.html's ENCOUNTER_TABLES (~line 819-828): roll
// a d8 for the table, then a d10 on that table. No closures in the
// prototype — ported verbatim, order preserved exactly (index lookups
// depend on it).

export const ENCOUNTER_TABLES = [
  ["Lair Beast", "Magical", "Beasts", "Food", "Humans", "Magical", "Walking Dead", "Beasts", "Lair Beast", "Demons"],
  ["Lair Beast", "Misc Magic", "Beasts", "Walking Dead", "Joiner", "Demons", "Store", "Humans", "Magical", "Weapon"],
  ["Demons", "Walking Dead", "Lair Beast", "Misc Magic", "Beasts", "Teleport", "Disease", "Magical", "Humans", "Magic Armor"],
  ["+10 WP", "-10 WP", "Teleport", "+10 SP", "+25 WP", "+25 SP", "-15 WP", "Teleport", "+3000 WM", "-All armour"],
  ["Magic Weapon", "Lair Beast", "Misc Magic", "Humans", "Food", "Misc Magic", "Demons", "Walking Dead", "Beasts", "Magic Armor"],
  ["Beasts", "Grimoire", "Lair Beast", "Humans", "Demons", "Disease", "Store", "Misc Magic", "Magical", "Joiner"],
  ["Humans", "Faerie", "Demons", "Beasts", "Insanity", "Phobia", "Lair Beast", "Darkness", "Walking Dead", "Magical"],
  ["Misc Magic", "Beasts", "Faerie", "Magic Armor", "Walking Dead", "Lair Beast", "Demons", "Humans", "Magical", "Food"],
];
