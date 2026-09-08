// content/potions.js
//
// Pure-data port of mazeworld.html's POTIONS table (~line 666-677), d10.
// Every `uses: () => D(n)` closure is converted to dice-notation
// ({n,sides,bonus}) per Pattern 1.

export const POTIONS = [
  { n: "Healing", col: "Blue", uses: { n: 1, sides: 8, bonus: 0 }, price: 150, eff: "heal", txt: "+d10+2 wp" },
  { n: "Cure Poison", col: "Green", uses: { n: 1, sides: 6, bonus: 0 }, price: 100, eff: "poison", txt: "cures poison" },
  { n: "Speed", col: "Yellow", uses: { n: 1, sides: 6, bonus: 0 }, price: 500, eff: "speed", txt: "double attacks, 50 squares" },
  { n: "Xtra Healing", col: "Blue", uses: { n: 1, sides: 2, bonus: 0 }, price: 500, eff: "full", txt: "heal to maximum" },
  { n: "Strength", col: "Red", uses: { n: 1, sides: 4, bonus: 0 }, price: 100, eff: "strength", txt: "+8 damage, 25 squares" },
  { n: "Cure Disease", col: "Aqua", uses: { n: 1, sides: 6, bonus: 0 }, price: 100, eff: "disease", txt: "cures disease" },
  { n: "Enlarge", col: "Brown", uses: { n: 1, sides: 6, bonus: 0 }, price: 75, eff: "enlarge", txt: "one size up, +4 damage, 50 squares" },
  { n: "Acuteness", col: "White", uses: { n: 1, sides: 4, bonus: 0 }, price: 800, eff: "acute", txt: "strike on a d6 for d8 rounds" },
  { n: "Death", col: "??", uses: { n: 1, sides: 4, bonus: 0 }, price: 50, eff: "death", txt: "your dead!" },
  { n: "Invisible", col: "Clear", uses: { n: 1, sides: 4, bonus: 0 }, price: 250, eff: "invis", txt: "invisible for a day" },
];
