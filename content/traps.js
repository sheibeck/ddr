// content/traps.js
//
// Pure-data port of mazeworld.html's TRAPS table (~line 683-692), d8 —
// avoided on 1-5 with a d20. Every `dmg: () => D(n)` closure is converted
// to dice-notation. "Spike" (`() => D(10) * 5`) carries its base d10
// notation plus a `times: 5` multiplier flag the engine applies after
// rolling.

export const TRAPS = [
  { n: "Poison Arrow", dmg: { n: 1, sides: 8, bonus: 0 }, poison: true },
  { n: "Falling Rocks", dmg: { n: 1, sides: 20, bonus: 0 } },
  { n: "Darts", dmg: { n: 1, sides: 6, bonus: 0 } },
  { n: "Darts", dmg: { n: 1, sides: 6, bonus: 0 } },
  { n: "Arrows", dmg: { n: 1, sides: 10, bonus: 0 } },
  { n: "Arrows", dmg: { n: 1, sides: 10, bonus: 0 } },
  { n: "Pit", dmg: { n: 1, sides: 20, bonus: 0 } },
  { n: "Spike", dmg: { n: 1, sides: 10, bonus: 0 }, times: 5 },
];
