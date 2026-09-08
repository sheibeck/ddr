// content/armors.js
//
// Pure-data port of mazeworld.html's ARMORS / MAGIC_ARMOR_TABLE tables
// (~line 555-562). Contains no dice closures in the prototype — ported
// verbatim. `priceFor(base, race)` is logic (race cost multiplier), not
// data — it moves to engine/character.js in plan 01-05.

export const ARMORS = [
  { name: "Cloth", cost: 300, wp: 12, ar: 3, cls: "FTM", min: 1 },
  { name: "Leather", cost: 500, wp: 15, ar: 6, cls: "FT", min: 1 },
  { name: "Studded", cost: 750, wp: 18, ar: 10, cls: "FT", min: 2 },
  { name: "Mail", cost: 1000, wp: 30, ar: 12, cls: "F", min: 3 },
  { name: "Plate", cost: 2000, wp: 45, ar: 15, cls: "F", min: 4 },
];

export const MAGIC_ARMOR_TABLE = [
  { ar: 4, wp: 30 },
  { ar: 2, wp: 20 },
  { ar: 1, wp: 10 },
  { ar: 1, wp: 10 },
  { ar: 2, wp: 15 },
  { ar: 1, wp: 5 },
];
