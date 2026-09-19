// content/potions.js
//
// Pure-data port of mazeworld.html's POTIONS table (~line 666-677), d10.
// Every `uses: () => D(n)` closure is converted to dice-notation
// ({n,sides,bonus}) per Pattern 1.
//
// Phase 39 (GEAR-02): the five potions with a duration carry an authored
// `act` field — UNLIKE content/treasure-tables.js's JEWELRY/CLOAKS/STAVES
// rows, this is NOT stripped on export: a potion ITEM is built field-by-field
// (engine/economy.js's store line, engine/encounters.js's find offer), never
// `Object.assign`-spread from a POTIONS row, so there is no parity risk in
// keeping `act` on the exported row. `POTION_ACTIVATION_OF` (row `n` ->
// activation record) is merged into `content/activations.js#ACTIVATION_OF`
// alongside `content/treasure-tables.js`'s `TREASURE_ACTIVATION_OF`.

// Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp; cosmetic,
// engine never reads these strings; the parity harness strips the reworded
// txt (comparables.js#REWORDED_TXT_ITEMS). The economy fixture's declared
// `after.items[1].txt` record is re-measured for this row (Task 3).
export const POTIONS = [
  { n: "Healing", col: "Blue", uses: { n: 1, sides: 8, bonus: 0 }, price: 150, eff: "heal", txt: "+d10+2 hp" },
  { n: "Cure Poison", col: "Green", uses: { n: 1, sides: 6, bonus: 0 }, price: 100, eff: "poison", txt: "cures poison" },
  {
    n: "Speed", col: "Yellow", uses: { n: 1, sides: 6, bonus: 0 }, price: 500, eff: "speed",
    txt: "double attacks, 50 squares",
    act: { kind: "haste", effect: 50 },
  },
  { n: "Xtra Healing", col: "Blue", uses: { n: 1, sides: 2, bonus: 0 }, price: 500, eff: "full", txt: "heal to maximum" },
  {
    n: "Strength", col: "Red", uses: { n: 1, sides: 4, bonus: 0 }, price: 100, eff: "strength",
    txt: "+8 damage, 25 squares",
    act: { kind: "might", effect: 25, might: 8 },
  },
  { n: "Cure Disease", col: "Aqua", uses: { n: 1, sides: 6, bonus: 0 }, price: 100, eff: "disease", txt: "cures disease" },
  {
    n: "Enlarge", col: "Brown", uses: { n: 1, sides: 6, bonus: 0 }, price: 75, eff: "enlarge",
    txt: "one size up, +4 damage, 50 squares",
    act: { kind: "might", effect: 50, might: 4 },
  },
  {
    n: "Acuteness", col: "White", uses: { n: 1, sides: 4, bonus: 0 }, price: 800, eff: "acute",
    txt: "strike on a d6 for d8 rounds",
    act: { kind: "acute", effect: { n: 1, sides: 8, bonus: 0 }, cadence: "rounds" },
  },
  { n: "Death", col: "??", uses: { n: 1, sides: 4, bonus: 0 }, price: 50, eff: "death", txt: "your dead!" },
  {
    // The canon text says "a day"; the prototype set 100 squares — kept.
    n: "Invisible", col: "Clear", uses: { n: 1, sides: 4, bonus: 0 }, price: 250, eff: "invis",
    txt: "invisible for a day",
    act: { kind: "invis", effect: 100 },
  },
];

/** POTION_ACTIVATION_OF — POTIONS row `n` -> activation record, for every row
 * that carries an authored `act` (the five duration potions). Frozen. Merged
 * into `content/activations.js#ACTIVATION_OF`. */
export const POTION_ACTIVATION_OF = Object.freeze(
  Object.fromEntries(POTIONS.filter((p) => p.act).map((p) => [p.n, Object.freeze({ ...p.act })])),
);
