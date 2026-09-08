// content/races.js
//
// Pure-data port of mazeworld.html's RACES / RACE_D8 tables (~line 723-736).
// Contains no dice closures in the prototype — ported verbatim.

export const RACES = {
  "Human": { size: "Human", upkeep: 4, note: "No advantages, no penalties. The maze's default." },
  "Elven": {
    size: "Small", upkeep: 4, wpMul: 0.6, strikeStep: 1, foeToHit: -1, toHit: 5,
    note: "Strikes a die better and hits on 5 whatever the class — but thin-boned and easy to hit.",
  },
  "Dwarven": {
    size: "Small", upkeep: 1, dmg: 2, foeStrikeStep: 1,
    note: "+2 damage and 1 wp/day upkeep; foes strike at a better die.",
  },
  "Wilmsry": {
    size: "Human", upkeep: 4, heal2x: true, spMul: 0.5,
    note: "Heals twice as fast, learns half as quickly. Magic Users despise them.",
  },
  "Fridgian": {
    size: "Human", upkeep: 4, noArmor: true, frenzy: true, slow: true,
    note: "Never wears armor, strikes last, frenzies into a second wild swing.",
  },
  "Troll": {
    size: "Large", upkeep: 15, flatWP: 75, dmg: 6, wpnBonus: 3, eats: 2,
    note: "75 wp regardless of class and +9 damage, but eats two rations a night.",
  },
};

// Random Race, d8, p.? — RACE_D8[d8-1] (Human appears 3x: indices 4, 7, 8)
export const RACE_D8 = ["Elven", "Dwarven", "Wilmsry", "Human", "Fridgian", "Troll", "Human", "Human"];
