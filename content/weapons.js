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
//
// Phase 39 (GEAR-01, 39-01-PLAN.md): two new axes, re-priced/re-diced rows.
// `need` (-2|-1|0|1) is a to-hit MODIFIER on the NEED, not the roll — the
// game's to-hit is a LOW range (a strike lands on roll <= need), so a light
// weapon's bonus is `need: +1` (raises the need, easier to hit) and a heavy
// weapon's penalty is `need: -1` or `-2` (lowers the need, harder to hit).
// This is the exact arithmetic direction the Phase 31 `afraidNeed` penalty
// already uses ("penalties shrink the need") — the user's "+ to hit as a
// penalty" framing is the SAME rule read from the die's side: a bigger
// number to roll under is a bonus, a smaller one is a penalty. Every class's
// base need floors at 1 after this modifier (engine/derived.js#toHit); no
// legal (class, weapon) pair ever produces a base need below 2 — proved by
// test/unit/gear-axes.test.js's floor-guarantee test. `crit` (1|2) sets the
// die-roll range that doubles damage: precise blades (Rapier, Katana,
// Wakazashi, Ninja-to, Dagger) crit on a roll of 1 OR 2; every other weapon
// (including the Whip, a light weapon that is NOT a blade) crits only on a
// natural 1, unchanged from before this phase.
//
// The 24 keys, their object-literal ORDER, and every `cls` string are kept
// byte-for-byte identical to the pre-phase table — this is load-bearing, not
// cosmetic: engine/economy.js#openStore shuffles Object.keys(WEAPONS) and
// engine/items.js#rollBlade does rng.pick(Object.keys(WEAPONS)), so any
// reorder/rename/add/remove would move the store roll and the premium blade
// roll on every seed. Only `dice`/`lab`/`cost` and the two new axes changed.

export const WEAPONS = {
  // Cutting
  "Axe": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 50, cls: "FTM", need: 0, crit: 1 },
  "Bastard Sword": { dice: { n: 2, sides: 8, bonus: 1 }, lab: "2d8+1", cost: 650, cls: "F", need: -1, crit: 1 },
  "Battle Axe": { dice: { n: 2, sides: 6, bonus: 1 }, lab: "2d6+1", cost: 325, cls: "F", need: -1, crit: 1 },
  "Broadsword": { dice: { n: 1, sides: 10, bonus: 2 }, lab: "d10+2", cost: 550, cls: "F", need: 0, crit: 1 },
  "Claymore": { dice: { n: 1, sides: 12, bonus: 2 }, lab: "d12+2", cost: 800, cls: "F", need: 0, crit: 1 },
  "Dagger": { dice: { n: 1, sides: 6, bonus: 0 }, halve: true, lab: "d6/2", cost: 75, cls: "FTM", need: 1, crit: 2 },
  "Katana": { dice: { n: 1, sides: 10, bonus: 1 }, lab: "d10+1", cost: 650, cls: "FT", need: 1, crit: 2 },
  "Kopesh Sword": { dice: { n: 1, sides: 12, bonus: 3 }, lab: "d12+3", cost: 500, cls: "F", need: -1, crit: 1 },
  "Long Sword": { dice: { n: 1, sides: 8, bonus: 2 }, lab: "d8+2", cost: 400, cls: "FT", need: 0, crit: 1 },
  "Ninja-to": { dice: { n: 1, sides: 8, bonus: 1 }, lab: "d8+1", cost: 475, cls: "FT", need: 1, crit: 2 },
  "Rapier": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 200, cls: "FTM", need: 1, crit: 2 },
  "Short Sword": { dice: { n: 1, sides: 6, bonus: 2 }, lab: "d6+2", cost: 250, cls: "FTM", need: 0, crit: 1 },
  "Wakazashi": { dice: { n: 1, sides: 6, bonus: 1 }, lab: "d6+1", cost: 350, cls: "FT", need: 1, crit: 2 },
  // Bludgeoning
  "Club": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 25, cls: "FTM", need: 0, crit: 1 },
  "Flail": { dice: { n: 1, sides: 10, bonus: 2 }, lab: "d10+2", cost: 250, cls: "FT", need: -1, crit: 1 },
  "Mace": { dice: { n: 1, sides: 8, bonus: 1 }, lab: "d8+1", cost: 125, cls: "FT", need: -1, crit: 1 },
  "Morning Star": { dice: { n: 1, sides: 8, bonus: 2 }, lab: "d8+2", cost: 175, cls: "FT", need: -1, crit: 1 },
  "Quarter Staff": { dice: { n: 1, sides: 6, bonus: 0 }, lab: "d6", cost: 25, cls: "FTM", need: 0, crit: 1 },
  "Spiked Staff": { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cost: 100, cls: "FTM", need: -1, crit: 1 },
  "Whip": { dice: { n: 1, sides: 6, bonus: 0 }, halve: true, lab: "d6/2", cost: 35, cls: "FT", need: 1, crit: 1 },
  // Pole arms
  "Awl Pike": { dice: { n: 2, sides: 6, bonus: 2 }, lab: "2d6+2", cost: 400, cls: "FT", need: -1, crit: 1 },
  "Bardiche": { dice: { n: 2, sides: 10, bonus: 2 }, lab: "2d10+2", cost: 900, cls: "F", need: -2, crit: 1 },
  "Naganita": { dice: { n: 2, sides: 8, bonus: 2 }, lab: "2d8+2", cost: 750, cls: "F", need: -1, crit: 1 },
  "Spear": { dice: { n: 1, sides: 8, bonus: 0 }, lab: "d8", cost: 150, cls: "FTM", need: 0, crit: 1 },
};

export const WEAPON_MAX = {
  "Axe": 6, "Bastard Sword": 17, "Battle Axe": 13, "Broadsword": 12, "Claymore": 14, "Dagger": 3,
  "Katana": 11, "Kopesh Sword": 15, "Long Sword": 10, "Ninja-to": 9, "Rapier": 6, "Short Sword": 8,
  "Wakazashi": 7, "Club": 6, "Flail": 12, "Mace": 9, "Morning Star": 10, "Quarter Staff": 6,
  "Spiked Staff": 8, "Whip": 3, "Awl Pike": 14, "Bardiche": 22, "Naganita": 18, "Spear": 8,
};

export const WEAPON_TYPE_TABLE = ["Pole Arm", "Bludgeoning", "Cutting", "Cutting", "Thrown", "Explosive"];
