// content/weapons.js
//
// Pure-data port of mazeworld.html's WEAPONS / WEAPON_MAX / WEAPON_TYPE_TABLE
// tables (~line 517-552). Every embedded `d: () => D(n)` closure is replaced
// by a `dice: {n, sides, bonus}` notation object the engine resolves via
// engine/dice.js's rollDice(). The Dagger and Whip's `Math.ceil(D(6)/2)`
// halving is preserved as a `halve: true` flag alongside the base d6
// notation — the engine applies `Math.ceil(rollDice(rng, dice) / 2)` when
// `halve` is set. `lab` label strings are preserved unchanged.
//
// WEAPON_BONUS_TABLE (the d6-indexed bonus-roll table) lives in
// content/misc-tables.js per the plan's artifact placement.

export const WEAPONS = {
  // Cutting
  "Axe": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 50, cls: "FTM" },
  "Bastard Sword": { dice: { n: 2, sides: 6, bonus: 0 }, lab: "2d6", cost: 675, cls: "F" },
  "Battle Axe": { dice: { n: 1, sides: 6, bonus: 1 }, lab: "d6+1", cost: 250, cls: "F" },
  "Broadsword": { dice: { n: 1, sides: 10, bonus: 2 }, lab: "d10+2", cost: 500, cls: "F" },
  "Claymore": { dice: { n: 1, sides: 12, bonus: 0 }, lab: "d12", cost: 800, cls: "F" },
  "Dagger": { dice: { n: 1, sides: 6, bonus: 0 }, halve: true, lab: "d6/2", cost: 75, cls: "FTM" },
  "Katana": { dice: { n: 1, sides: 10, bonus: 0 }, lab: "d10", cost: 525, cls: "FT" },
  "Kopesh Sword": { dice: { n: 1, sides: 10, bonus: 0 }, lab: "d10", cost: 525, cls: "F" },
  "Long Sword": { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cost: 500, cls: "FT" },
  "Ninja-to": { dice: { n: 1, sides: 8, bonus: 1 }, lab: "d8+1", cost: 450, cls: "FT" },
  "Rapier": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 200, cls: "FTM" },
  "Short Sword": { dice: { n: 1, sides: 6, bonus: 1 }, lab: "d6+1", cost: 250, cls: "FTM" },
  "Wakazashi": { dice: { n: 1, sides: 6, bonus: 1 }, lab: "d6+1", cost: 300, cls: "FT" },
  // Bludgeoning
  "Club": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 25, cls: "FTM" },
  "Flail": { dice: { n: 1, sides: 8, bonus: 2 }, lab: "d8+2", cost: 175, cls: "FT" },
  "Mace": { dice: { n: 1, sides: 6, bonus: 2 }, lab: "d6+2", cost: 125, cls: "FT" },
  "Morning Star": { dice: { n: 1, sides: 8, bonus: 1 }, lab: "d8+1", cost: 150, cls: "FT" },
  "Quarter Staff": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 25, cls: "FTM" },
  "Spiked Staff": { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cost: 150, cls: "FTM" },
  "Whip": { dice: { n: 1, sides: 6, bonus: 0 }, halve: true, lab: "d6/2", cost: 35, cls: "FT" },
  // Pole arms
  "Awl Pike": { dice: { n: 1, sides: 8, bonus: 2 }, lab: "d8+2", cost: 400, cls: "FT" },
  "Bardiche": { dice: { n: 2, sides: 8, bonus: 0 }, lab: "2d8", cost: 900, cls: "F" },
  "Naganita": { dice: { n: 2, sides: 6, bonus: 1 }, lab: "2d6+1", cost: 600, cls: "F" },
  "Spear": { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cost: 150, cls: "FTM" },
};

export const WEAPON_MAX = {
  "Axe": 6, "Bastard Sword": 12, "Battle Axe": 7, "Broadsword": 12, "Claymore": 12, "Dagger": 3,
  "Katana": 10, "Kopesh Sword": 10, "Long Sword": 8, "Ninja-to": 9, "Rapier": 6, "Short Sword": 7,
  "Wakazashi": 7, "Club": 6, "Flail": 10, "Mace": 8, "Morning Star": 9, "Quarter Staff": 6,
  "Spiked Staff": 8, "Whip": 3, "Awl Pike": 10, "Bardiche": 16, "Naganita": 13, "Spear": 8,
};

export const WEAPON_TYPE_TABLE = ["Pole Arm", "Bludgeoning", "Cutting", "Cutting", "Thrown", "Explosive"];
