// content/treasure-tables.js
//
// Pure-data port of mazeworld.html's treasure tables (~line 634-707):
// BLADE_NAMES, JEWELRY (d8, p.47), CLOAKS (d8, p.46), STAVES (d8, p.46),
// FAERIE (d8, p.48), MISC_MAGIC. No closures in the prototype — ported
// verbatim.
//
// Phase 37 (GEAR-03): a `slot` field is authored on every JEWELRY/CLOAKS/
// STAVES row (module-private *_ROWS arrays below) per the locked worn-slot
// taxonomy, but the exported JEWELRY/CLOAKS/STAVES tables are derived from
// those rows WITH the `slot` key stripped — byte-identical to the
// pre-Phase-37 row objects. This mirrors the ECON-08 precedent
// (engine/economy.js TREASURE_BASE_VALUES, lines 55-60): keep new per-item
// data OUT of the row objects so every `Object.assign({ kind }, ROW)`
// construction site (engine/items.js rollJewel/rollCloak/rollStaff,
// engine/character.js's Thief starting cloak, engine/encounters.js's find
// offers) keeps producing byte-identical item shapes. A `slot` key spread
// onto a rolled item would break the frozen parity gate three ways: chargen
// seeds 2/3/4 (Thief starting cloaks — test/parity/chargen-parity.test.js
// deepStrictEqual on c.items), the combat flee fixture (seed 17's Cloak of
// Armor in the bag), and test/parity/fixtures/action-script.economy.json's
// DECLARED after.items (a Cloak of Ether with no slot key — a frozen
// fixture that must never be edited). `SLOT_OF` (display name -> slot) is
// the runtime lookup engine/derived.js#slotFor consults instead — `slot`
// must never be spread onto an item object anywhere in the engine.

export const BLADE_NAMES = [
  "Whisper", "Grave Mark", "The Long Argument", "Tithe", "Old Patience",
  "Nine Teeth", "Casket", "Hush", "Wilmst-Bite", "Second Thoughts", "Last Tuesday",
];

const JEWELRY_ROWS = [
  { n: "Ring of Power", slot: "ring", eff: { dmg: 1 }, txt: "+1 damage to all attacks" },
  { n: "Gauntlet of the Giant", slot: "helm", eff: { size: 1 }, txt: "one size larger" },
  { n: "Amulet of Light", slot: "amulet", eff: { sight: 1, light: 1 }, txt: "a standing light spell; dispels darkness" },
  { n: "Pendant of Fortitude", slot: "amulet", eff: {}, use: "half", every: 100, txt: "half damage from one attack, once every 100 squares" },
  { n: "Anklet of Invisibility", slot: "bracelet", eff: { foeToHit: -2 }, txt: "unseen; foes need two better to land" },
  { n: "Helm of Knowledge", slot: "helm", eff: { tongue: 1 }, txt: "perfect fluency in one language" },
  { n: "Bracelet of Flight", slot: "bracelet", eff: { fly: 1 }, txt: "flight — walls and crevices are nothing" },
  { n: "Amulet of Stone", slot: "amulet", eff: {}, use: "stone", every: 200, aoe: 4, txt: "turns up to 4 squares of opponents to stone, once every 200 squares" },
];

const CLOAKS_ROWS = [
  { n: "Cloak of Healing", slot: "cloak", eff: { cloakHeal: 1 }, txt: "heals up to 10 wp every 20 squares" },
  { n: "Cloak of Strength", slot: "cloak", eff: { noCrit: 1 }, txt: "no critical damage ever lands on you" },
  { n: "Cloak of Invisibility", slot: "cloak", eff: {}, use: "invis", every: 100, txt: "invisible, once every 100 squares" },
  { n: "Cloak of Speed", slot: "cloak", eff: {}, use: "haste", every: 50, txt: "double attacks, once every 50 squares" },
  { n: "Cloak of Regeneration", slot: "cloak", eff: { cloakRegen: 1 }, txt: "d6 wp back every 20 squares" },
  // Phase 28 (ARMOR-04): states the rule plainly — AR 15, never wears, any
  // class — with a wink of the original "weighs nothing" flavor.
  { n: "Cloak of Armor", slot: "cloak", eff: { cloakArmor: 1 }, txt: "soaks as plate (AR 15) over whatever you wear — any class, never wears out, light as a rumor" },
  { n: "Cloak of Flying", slot: "cloak", eff: { fly: 1 }, txt: "flight for 20 squares, once every 50" },
  { n: "Cloak of Ether", slot: "cloak", eff: {}, use: "ether", every: 100, txt: "walk through walls, once every 100 squares" },
];

const STAVES_ROWS = [
  { n: "Rowan Staff", slot: "staff", use: "dome", txt: "a protective dome of 100 wp" },
  { n: "Birch Staff", slot: "staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely" },
  { n: "Walnut Staff", slot: "staff", use: "weaken", txt: "all hits on the weakened do double damage" },
  { n: "Oak Staff", slot: "staff", use: "stone", txt: "turns 2 squares of opponents to stone" },
  { n: "Crystal Staff", slot: "staff", use: "invis", txt: "party invisible d10+5 squares; enemies need a 1" },
  { n: "Poplar Staff", slot: "staff", use: "heal", txt: "1d20+10 wp to up to 6" },
  { n: "Pine Staff", slot: "staff", use: "fire", txt: "d6 fireballs, automatic hits, 1d10+4 each" },
  { n: "Cedar Staff", slot: "staff", use: "gas", txt: "knocks out 3 squares of enemies for a day" },
];

/** dropSlot(row) — strips the authored `slot` key, keeping every other field
 * (and its original value) byte-identical to the pre-Phase-37 row literal. */
function dropSlot(row) {
  const { slot, ...rest } = row;
  return rest;
}

export const JEWELRY = JEWELRY_ROWS.map(dropSlot);
export const CLOAKS = CLOAKS_ROWS.map(dropSlot);
export const STAVES = STAVES_ROWS.map(dropSlot);

/** SLOT_OF — display name (`.n`) -> worn slot, derived from the *_ROWS
 * arrays above; the name-keyed runtime lookup engine/derived.js#slotFor
 * falls back on when an item carries no own `slot` key. Frozen; exactly 24
 * entries (8 JEWELRY + 8 CLOAKS + 8 STAVES, per the locked taxonomy). */
export const SLOT_OF = Object.freeze(
  Object.fromEntries([...JEWELRY_ROWS, ...CLOAKS_ROWS, ...STAVES_ROWS].map((row) => [row.n, row.slot])),
);

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
