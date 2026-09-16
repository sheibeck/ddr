// content/races.js
//
// Pure-data port of mazeworld.html's RACES / RACE_D8 tables (~line 723-736).
// Contains no dice closures in the prototype — ported verbatim.

export const RACES = {
  "Human": { size: "Human", upkeep: 4, note: "No advantages, no penalties. The dungeon's default." },
  "Elven": {
    size: "Small", upkeep: 4, wpMul: 0.6, strikeStep: 1,
    // DELIBERATE RULES CHANGE (Phase 31, user decision 2026-09-16, audit
    // Finding 1): the prototype's foeToHit −1 ADDS into foeToHitVs's need
    // (foe lands on roll ≤ need), so −1 made Elves HARDER to hit — the
    // opposite of this row's own note / flavor.js / CLASS-PASS ("easy to
    // hit"). +1 raises the foe's need 5→6: Elves are genuinely easier to
    // hit now. Zero rng change; no fixture has an Elven hero in combat
    // (chargen seed 13, encounters/faerie seed 38 never reach foeToHitVs),
    // so no divergence record — prototype-master.js.txt keeps −1 untouched.
    foeToHit: 1, toHit: 5,
    note: "Strikes a die better and hits on 5 whatever the class — but thin-boned and easy to hit.",
  },
  "Dwarven": {
    // armorWear: fraction of a soaked blow charged to armour durability,
    // Math.ceil'd, read by applyFoeDamageToPlayer.
    size: "Small", upkeep: 1, dmg: 2, foeStrikeStep: 1, armorWear: 0.5,
    note: "+2 damage and 1 wp/day upkeep; foes strike at a better die; armor wears at half the rate.",
  },
  "Wilmsry": {
    size: "Human", upkeep: 4, heal2x: true, spMul: 0.5,
    note: "Heals twice as fast, learns half as quickly. Magic Users despise them.",
  },
  "Fridgian": {
    // hide: flat damage soaked from every blow, read by applyFoeDamageToPlayer.
    size: "Human", upkeep: 4, noArmor: true, frenzy: true, slow: true, hide: 2,
    note: "Never wears armor, strikes last, frenzies into a second wild swing that never wastes itself on a corpse; thick hide soaks 2 from every blow.",
  },
  "Troll": {
    size: "Large", upkeep: 15, flatWP: 75, dmg: 6, wpnBonus: 3, eats: 2,
    note: "75 wp regardless of class and +9 damage, but eats two rations a night.",
  },
};

// Random Race, d8, p.? — RACE_D8[d8-1] (Human appears 3x: indices 4, 7, 8)
export const RACE_D8 = ["Elven", "Dwarven", "Wilmsry", "Human", "Fridgian", "Troll", "Human", "Human"];
