// content/armors.js
//
// Pure-data port of mazeworld.html's ARMORS / MAGIC_ARMOR_TABLE tables
// (~line 555-562). Contains no dice closures in the prototype — ported
// verbatim. `priceFor(base, race)` is logic (race cost multiplier), not
// data — it moves to engine/character.js in plan 01-05.
//
// Phase 39 (GEAR-01, 39-01-PLAN.md): a `bulk` axis (0|1|2) added to every
// row — AR/WP stay the soak axis (what damage the armor stops); bulk is what
// you PAY for that soak everywhere agility matters. `bulk` is added to the
// climb/leap roll comparison (engine/movement.js, mirroring the existing
// heightsPenalty/waterPenalty terms), subtracted from the flee roll
// (engine/combat.js#flee), and `bulk >= 2` replaces the old hard-coded Plate
// name checks in the Thief Stealth/backstab gates (engine/combat.js) — a
// generalization, not a new rule: Studded/Mail (bulk 1) behave exactly as
// they always did (their names never matched the old hard-coded list
// either), only Plate (bulk 2) denies. Every other field (cost/wp/ar/cls/
// min) is unchanged from before this phase.

export const ARMORS = [
  { name: "Cloth", cost: 300, wp: 12, ar: 3, cls: "FTM", min: 1, bulk: 0 },
  { name: "Leather", cost: 500, wp: 15, ar: 6, cls: "FT", min: 1, bulk: 0 },
  { name: "Studded", cost: 750, wp: 18, ar: 10, cls: "FT", min: 2, bulk: 1 },
  { name: "Mail", cost: 1000, wp: 30, ar: 12, cls: "F", min: 3, bulk: 1 },
  { name: "Plate", cost: 2000, wp: 45, ar: 15, cls: "F", min: 4, bulk: 2 },
];

export const MAGIC_ARMOR_TABLE = [
  { ar: 4, wp: 30 },
  { ar: 2, wp: 20 },
  { ar: 1, wp: 10 },
  { ar: 1, wp: 10 },
  { ar: 2, wp: 15 },
  { ar: 1, wp: 5 },
];

// Phase 95 (FLAVOR-02; CONTEXT 'Data shape and guards' and 'Tone'): one player
// line per armour type, keyed by the ARMORS name, in ARMORS order. A warded
// piece shares its type's line, so no line implies magic. The generated stat
// line stays the rules layer, shown under RULES. Each line is one sentence of
// about 90 characters or fewer that hints at protection and weight without a
// number, die or percentage (test/unit/flavor-layer.test.js), and is reviewed on
// docs/narrative-pass/review.html.
export const ARMOR_FLAVOR = Object.freeze({
  "Cloth": "Soft and light enough for any adventurer, and it stops about as much as a stern look.",
  "Leather": "Supple hide that creaks, smells faintly of cow and turns the odd glancing blow.",
  "Studded": "Leather with metal studs added for confidence, and a little extra weight to go with it.",
  "Mail": "A shirt of linked rings that jingles like a cutlery drawer: sturdy, heavy and best left to fighters.",
  "Plate": "Gleaming metal head to toe: superb protection and all the grace of a falling wardrobe.",
});
