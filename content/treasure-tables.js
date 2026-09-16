// content/treasure-tables.js
//
// Pure-data port of mazeworld.html's treasure tables (~line 634-707):
// BLADE_NAMES, JEWELRY (d8, p.47), CLOAKS (d8, p.46), STAVES (d8, p.46),
// FAERIE (d8, p.48), MISC_MAGIC. No closures in the prototype — ported
// verbatim.

export const BLADE_NAMES = [
  "Whisper", "Grave Mark", "The Long Argument", "Tithe", "Old Patience",
  "Nine Teeth", "Casket", "Hush", "Wilmst-Bite", "Second Thoughts", "Last Tuesday",
];

export const JEWELRY = [
  { n: "Ring of Power", eff: { dmg: 1 }, txt: "+1 damage to all attacks" },
  { n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "one size larger" },
  { n: "Amulet of Light", eff: { sight: 1, light: 1 }, txt: "a standing light spell; dispels darkness" },
  { n: "Pendant of Fortitude", eff: {}, use: "half", every: 100, txt: "half damage from one attack, once every 100 squares" },
  { n: "Anklet of Invisibility", eff: { foeToHit: -2 }, txt: "unseen; foes need two better to land" },
  { n: "Helm of Knowledge", eff: { tongue: 1 }, txt: "perfect fluency in one language" },
  { n: "Bracelet of Flight", eff: { fly: 1 }, txt: "flight — walls and crevices are nothing" },
  { n: "Amulet of Stone", eff: {}, use: "stone", every: 200, aoe: 4, txt: "turns up to 4 squares of opponents to stone, once every 200 squares" },
];

export const CLOAKS = [
  { n: "Cloak of Healing", eff: { cloakHeal: 1 }, txt: "heals up to 10 wp every 20 squares" },
  { n: "Cloak of Strength", eff: { noCrit: 1 }, txt: "no critical damage ever lands on you" },
  { n: "Cloak of Invisibility", eff: {}, use: "invis", every: 100, txt: "invisible, once every 100 squares" },
  { n: "Cloak of Speed", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" },
  { n: "Cloak of Regeneration", eff: { cloakRegen: 1 }, txt: "d6 wp back every 20 squares" },
  // Phase 28 (ARMOR-04): states the rule plainly — AR 15, never wears, any
  // class — with a wink of the original "weighs nothing" flavor.
  { n: "Cloak of Armor", eff: { cloakArmor: 1 }, txt: "soaks as plate (AR 15) over whatever you wear — any class, never wears out, light as a rumor" },
  { n: "Cloak of Flying", eff: { fly: 1 }, txt: "flight for 20 squares, once every 50" },
  { n: "Cloak of Ether", eff: {}, use: "ether", every: 100, txt: "walk through walls, once every 100 squares" },
];

export const STAVES = [
  { n: "Rowan Staff", use: "dome", txt: "a protective dome of 100 wp" },
  { n: "Birch Staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely" },
  { n: "Walnut Staff", use: "weaken", txt: "all hits on the weakened do double damage" },
  { n: "Oak Staff", use: "stone", txt: "turns 2 squares of opponents to stone" },
  { n: "Crystal Staff", use: "invis", txt: "party invisible d10+5 squares; enemies need a 1" },
  { n: "Poplar Staff", use: "heal", txt: "1d20+10 wp to up to 6" },
  { n: "Pine Staff", use: "fire", txt: "d6 fireballs, automatic hits, 1d10+4 each" },
  { n: "Cedar Staff", use: "gas", txt: "knocks out 3 squares of enemies for a day" },
];

// FAERIE gift labels are DUAL-PURPOSE — each is also the switch key in
// engine/encounters.js meetFaerie(). The player-facing unit tokens were
// modernised here (04.2 Text batch: "Base WP"->"Base HP", "WM"->"wilmst",
// E3/P2) together with those switch comparisons, atomically. The frozen
// parity master keeps the old strings; the state effects are identical, so
// parity stays green (the gift string is an event field, never compared).
export const FAERIE = [
  "+1 Level", "+d20 Base HP", "Magic Weapon", "-d10 Base HP",
  "Miscellaneous Magic", "d10 x 100 wilmst", "Magic Armor", "+2 Level",
];

export const MISC_MAGIC = ["Cloak", "Potion", "Scroll", "Grimoire", "Potion", "Staff", "Cloak", "Jewelry", "Potion", "Scroll"];
