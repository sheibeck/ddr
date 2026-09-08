// content/classes.js
//
// Pure-data port of mazeworld.html's CLASSES table (~line 499-515).
//
// baseWP is now `{ base, dice }` — the engine computes maxWP as
// `base + rollDice(rng, dice)` (a flat class like Thief uses a zero-value
// dice notation, so the formula stays uniform: base + 0).
//
// gain[level] entries (index 1-4; index 0 is always null, matching the
// prototype's 1-indexed skill-level gain table) are dice-notation objects
// the engine resolves via rollDice() on level-up.

export const CLASSES = {
  "Magic User": {
    toHit: 3,
    baseWP: { base: 25, dice: { n: 1, sides: 10, bonus: 0 } },
    armorCap: 0,
    subs: ["Wizard", "Warlock", "Sorcerer", "Summoner", "Cleric", "Illusionist", "Court Mage", "Apprentice"],
    gain: [
      null,
      { n: 1, sides: 8, bonus: 0 },
      { n: 1, sides: 8, bonus: 0 },
      { n: 1, sides: 8, bonus: 2 },
      { n: 1, sides: 8, bonus: 3 },
    ],
  },
  "Fighter": {
    toHit: 5,
    baseWP: { base: 50, dice: { n: 1, sides: 8, bonus: 0 } },
    armorCap: 2,
    subs: ["Knight", "Guard", "Woodsman", "Soldier", "Barbarian", "Master of Arms", "Samurai", "Bard"],
    gain: [
      null,
      { n: 1, sides: 8, bonus: 0 },
      { n: 1, sides: 6, bonus: 0 },
      { n: 1, sides: 6, bonus: 0 },
      { n: 1, sides: 6, bonus: 0 },
    ],
  },
  "Thief": {
    toHit: 4,
    baseWP: { base: 40, dice: { n: 0, sides: 0, bonus: 0 } },
    armorCap: 1,
    subs: ["Pickpocket", "Pilfer", "Cat Burglar", "Cutthroat", "Cloaker", "Ninja", "Con Artist", "Acrobat"],
    gain: [
      null,
      { n: 1, sides: 8, bonus: 0 },
      { n: 1, sides: 6, bonus: 0 },
      { n: 1, sides: 6, bonus: 0 },
      { n: 1, sides: 6, bonus: 2 },
    ],
  },
};
