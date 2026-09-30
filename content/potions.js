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
    // RULES-11 (Phase 75.2, Plan 02, user ruling 2026-09-25): Enlarge is
    // exactly ONE size step — its separate might-kind damage payload is
    // gone. `act.eff.size: 1` applies through the same seam a used
    // Gauntlet of the Giant does (engine/derived.js#itemSizeStep), never
    // masked by a race's own signature; the text states exactly what a
    // step does and nothing more (no overhead-clearance promise).
    //
    // Phase 89 plan 02 (ITEM-05, report #6, user ruling 2026-09-30): the step
    // alone was a trap (+2 damage for foes +1 to hit you). Enlarge is now
    // Troll-sized: eleven damage in all, the step's +2 (SIZE_DAMAGE_PER_STEP)
    // plus +9 bulk carried as activation data (`eff.dmg`, the same term the
    // Ring of Power's +1 rides), in line with a Troll's own +11 (its +9 and
    // Large +2). The cost stays one size step (foes +1 to hit you, from
    // SIZE_FACES_PER_STEP), 50 squares, price 75 -> 150 so it does not
    // undercut Strength (+8 for 25 squares at 100). Phase 92 may retune it.
    n: "Enlarge", col: "Brown", uses: { n: 1, sides: 6, bonus: 0 }, price: 150, eff: "enlarge",
    txt: "one size larger for fifty squares: +11 damage, and foes +1 to hit you",
    act: { kind: "enlarge", effect: 50, eff: { size: 1, dmg: 9 } },
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
    txt: "invisible for a day: foes hit you only on their die's top face (the top two faces if you insulted them)",
    act: { kind: "invis", effect: 100 },
  },
];

/** POTION_ACTIVATION_OF — POTIONS row `n` -> activation record, for every row
 * that carries an authored `act` (the five duration potions). Frozen. Merged
 * into `content/activations.js#ACTIVATION_OF`. */
export const POTION_ACTIVATION_OF = Object.freeze(
  Object.fromEntries(POTIONS.filter((p) => p.act).map((p) => [p.n, Object.freeze({ ...p.act })])),
);
