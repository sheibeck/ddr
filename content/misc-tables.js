// content/misc-tables.js
//
// Pure-data port of mazeworld.html's remaining small rules tables:
// STRIKE_DICE/THRESHOLDS/ROMAN (~line 495-497), WEAPON_BONUS_TABLE
// (~line 553), SPELL_LEVEL_TABLE (~line 708), CLIMB_TABLE (~line 709-713),
// LEAP_TABLE (~line 714-719), DIRECTION_TABLE (~line 720), INSANITY
// (~line 910-913).
//
// WEAPON_BONUS_TABLE's `()=>D(6)`/`()=>2` closures are converted to
// dice-notation. CLIMB_TABLE's per-surface `fall: () => D(n)` closures are
// converted the same way.

export const STRIKE_DICE = [20, 12, 10, 8, 6]; // skill level I..V
export const THRESHOLDS = [0, 201, 501, 901, 1501];
export const ROMAN = ["I", "II", "III", "IV", "V"];

// d6-indexed bonus-roll table (the sixth face rolls a d10)
export const WEAPON_BONUS_TABLE = [
  { n: 1, sides: 6, bonus: 0 },
  { n: 0, sides: 0, bonus: 2 },
  { n: 0, sides: 0, bonus: 1 },
  { n: 0, sides: 0, bonus: 1 },
  { n: 0, sides: 0, bonus: 4 },
  { n: 1, sides: 10, bonus: 0 },
];

export const SPELL_LEVEL_TABLE = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]; // Level Table, d10, p.46

export const CLIMB_TABLE = {
  "rope": { success: 7, fall: { n: 1, sides: 6, bonus: 0 } },
  "rock": { success: 6, fall: { n: 1, sides: 8, bonus: 0 } },
  "wood": { success: 7, fall: { n: 1, sides: 6, bonus: 0 } },
};

export const LEAP_TABLE = [
  { ft: "3-4 feet", F: 10, T: 10, M: 9 },
  { ft: "5-8 feet", F: 8, T: 7, M: 6 },
  { ft: "8-12 feet", F: 6, T: 5, M: 4 },
  { ft: "12-15 feet", F: 4, T: 3, M: 1 },
];

export const DIRECTION_TABLE = ["N", "N", "E", "E", "S", "S", "W", "W"]; // 2d8, p.49

export const INSANITY = [
  "turns the blade on itself", "strikes the nearest of its own",
  "bolts into the dark", "stands perfectly still", "froths and swings twice", "kneels and surrenders",
];
