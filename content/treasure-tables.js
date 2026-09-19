// content/treasure-tables.js
//
// Pure-data port of mazeworld.html's treasure tables (~line 634-707):
// BLADE_NAMES, JEWELRY (d8, p.47), CLOAKS (d7 — the dropped healing cloak was
// removed by the user on 2026-09-18, quick 260918-w4n; every roll draws
// `rng.d(CLOAKS.length)`), STAVES (d8, p.46), FAERIE (d8, p.48), MISC_MAGIC.
// No closures in the prototype — ported verbatim.
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
//
// Phase 39 (GEAR-02): an `act` field is authored on every activatable
// JEWELRY/CLOAKS/STAVES row, following `slot`'s exact reasoning — it is
// NEVER spread onto a rolled item object (would break the same three parity
// sites named above). `dropAuthored(row)` strips BOTH `slot` AND `act`, so
// the exported JEWELRY/CLOAKS/STAVES tables stay byte-identical to the
// pre-Phase-39 literals. `TREASURE_ACTIVATION_OF` (display name -> a
// normalized `{ kind, effect, cd }` or `{ kind, charges, recharge, effect? }`
// record) is the runtime lookup engine/derived.js#activationFor consults
// instead — merged with `content/potions.js`'s `POTION_ACTIVATION_OF` into
// `content/activations.js`'s `ACTIVATION_OF`.
//
// ONCE-A-DAY RULE (user, 2026-09-18, binding): 100 squares is one day; every
// item must be usable at least once a day — `effect + cd <= 100` squares for
// every duration+cooldown activation, `recharge <= 100` squares per charge
// for every staff. Three treasure rows were re-authored to fit (both `every`
// AND `txt`, so the flavor text stays true): Amulet of Stone 200 -> 100;
// Cloak of Invisibility 100/100 -> 50 effect / 50 cd; Cloak of Ether 20+100
// -> 20+80. See docs/GEAR-BALANCE.md's "Item activation model (GEAR-02)"
// section for the full numbers ledger.
//
// USE-ACTIVATED ONLY (user ruling 2026-09-18, quick 260918-w4n): "Items that
// are equipable must be equipped to be used. Items that are not equipable
// can be used from the bag." Every JEWELRY/CLOAKS/STAVES row now carries an
// `act` block — there are no passive rows left. An `eff` map is a PAYLOAD
// applied only while the item's OWN `item:<name>` c.timers record is live
// (engine/derived.js#eff sums it there, and nowhere else) — a bagged or
// worn-but-unused item grants nothing. There is no auto-activation: a Cloak
// of Flying no longer starts its own flight window on a climb/gorge tile
// (engine/movement.js) — only `useItem` on a WORN item starts the record,
// which then starts the cooldown.
//
// The dropped healing cloak amendment (user, 2026-09-18): "Drop Cloak of
// Healing" — the item is removed from the game outright. CLOAKS is now 7
// rows; every cloak roll (the Thief starting cloak, the Cloak find, and
// `rollCloak`) draws `rng.d(CLOAKS.length)` instead of a literal 8 — still
// ONE `gen.next()` draw, so the rng cursor never shifts, only the row a given
// draw lands on can change. A save carrying the dropped cloak loads it as an
// inert cloak: `slotFor` still resolves it by kind, but `activationFor` is
// null (no Use button, no effect, no throw).
//
// The staff amendment (user, 2026-09-18): "A magic staff is a usable item,
// but not equipable... Staff should not be an equipment slot." A staff's
// authored `slot` key is deleted from every STAVES_ROWS entry — a staff has
// no worn slot anywhere; `SLOT_OF` is built from JEWELRY_ROWS + CLOAKS_ROWS
// only (15 entries). A staff lives in `c.items` (one bag slot) and is used
// by bag index; its charges+recharge model is unchanged.
//
// The jewelry-merge ruling (user, 2026-09-18, quick 260918-wy1): "We should
// not have ring/bracelet/amulet as separate equipment slots. We should have
// jewelry as a slot. Let's allow us to slot up to 2 pieces of jewelry: any
// combination of rings, bracelets, amulets, and helms." Every JEWELRY_ROWS
// entry's authored `slot` is now the single family value `jewelry` (not a
// concrete worn key — `engine/derived.js#WORN_KEYS_OF` maps the family to
// its two concrete keys, `jewelry1`/`jewelry2`). The cloak keeps its own
// single-key family, unchanged.

export const BLADE_NAMES = [
  "Whisper", "Grave Mark", "The Long Argument", "Tithe", "Old Patience",
  "Nine Teeth", "Casket", "Hush", "Wilmst-Bite", "Second Thoughts", "Last Tuesday",
];

const JEWELRY_ROWS = [
  {
    // Use-activated (260918-w4n): worn + used, +1 damage for 50 squares, 50
    // squares to catch its breath.
    n: "Ring of Power", slot: "jewelry", eff: { dmg: 1 },
    txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet",
    act: { kind: "power", effect: 50, cd: 50 },
  },
  {
    // Use-activated (260918-w4n): worn + used, one size larger for 50
    // squares, 50 to recover.
    n: "Gauntlet of the Giant", slot: "jewelry", eff: { size: 1 },
    txt: "used, you are one size larger for fifty squares; mind the ceilings, then fifty squares of shrinking back",
    act: { kind: "giant", effect: 50, cd: 50 },
  },
  {
    // Use-activated (260918-w4n): worn + used, light + sight for 50 squares,
    // dispels darkness the instant it is used.
    n: "Amulet of Light", slot: "jewelry", eff: { sight: 1, light: 1 },
    txt: "used, it lights fifty squares and tells the dark to leave at once; then it sulks for fifty",
    act: { kind: "glow", effect: 50, cd: 50 },
  },
  {
    n: "Pendant of Fortitude", slot: "jewelry", eff: {}, use: "half", every: 100,
    txt: "half damage from one attack, once every 100 squares",
    act: { kind: "half", effect: 0 },
  },
  {
    // Use-activated (260918-w4n): worn + used, foes need two better to land
    // for 50 squares, 50 to fade back into view.
    n: "Anklet of Invisibility", slot: "jewelry", eff: { foeToHit: -2 },
    txt: "used, foes need two better to land a blow on you for fifty squares; then fifty squares back in plain sight",
    act: { kind: "unseen", effect: 50, cd: 50 },
  },
  {
    // Use-activated (260918-w4n): worn + used, perfect fluency for 50
    // squares, 50 to forget it again.
    n: "Helm of Knowledge", slot: "jewelry", eff: { tongue: 1 },
    txt: "used, you understand them perfectly for fifty squares; then fifty squares of forgetting again",
    act: { kind: "tongue", effect: 50, cd: 50 },
  },
  {
    // Use-activated (260918-w4n): worn + used, mirrors the Cloak of Flying —
    // twenty squares of flight, fifty to catch its breath.
    n: "Bracelet of Flight", slot: "jewelry", eff: { fly: 1 },
    txt: "used, twenty squares of flight when you ask; fifty to catch its breath",
    act: { kind: "fly", effect: 20, cd: 50 },
  },
  {
    // Once-a-day rule: every 200 -> 100 (the AoE stone effect itself is
    // instant, so effect+cd is just the cd).
    n: "Amulet of Stone", slot: "jewelry", eff: {}, use: "stone", every: 100, aoe: 4,
    txt: "turns up to 4 squares of opponents to stone, once every 100 squares",
    act: { kind: "stone", effect: 0 },
  },
];

// Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp in the two
// rows below; cosmetic, engine never reads these strings; the parity
// harness strips the reworded txt (comparables.js#REWORDED_TXT_ITEMS,
// generalized from the Phase 28 stripCloakArmorTxt carve-out).
const CLOAKS_ROWS = [
  {
    // Use-activated (260918-w4n): worn + used, no critical lands on you for
    // 50 squares, 50 to leave itself vulnerable again.
    n: "Cloak of Strength", slot: "cloak", eff: { noCrit: 1 },
    txt: "used, no critical damage lands on you for fifty squares; then fifty squares of ordinary luck",
    act: { kind: "brace", effect: 50, cd: 50 },
  },
  {
    // Once-a-day rule: 100 effect / 100 cd -> 50 effect / 50 cd (50+50 = one day).
    n: "Cloak of Invisibility", slot: "cloak", eff: {}, use: "invis", every: 50,
    txt: "invisible for 50 squares, once every 100",
    act: { kind: "invis", effect: 50 },
  },
  {
    n: "Cloak of Speed", slot: "cloak", eff: {}, use: "haste", every: 50,
    txt: "double attacks, once every 50 squares",
    act: { kind: "haste", effect: 50 },
  },
  {
    // Use-activated (260918-w4n): worn + used, a flat d6 hp back at once,
    // then twenty squares of rest — the once-per-use faithful reading of the
    // frozen prototype's "d6 hp back every 20 squares".
    n: "Cloak of Regeneration", slot: "cloak", eff: { cloakRegen: 1 },
    txt: "used, a d6 hp back at once; then twenty squares of rest before it works again",
    act: { kind: "knit", effect: 0, cd: 20 },
  },
  // Phase 28 (ARMOR-04): states the rule plainly — AR 15, never wears, any
  // class — with a wink of the original "weighs nothing" flavor. Use-
  // activated (260918-w4n): worn + used, plated for 50 squares, 50 to
  // recover.
  {
    n: "Cloak of Armor", slot: "cloak", eff: { cloakArmor: 1 },
    txt: "used, it soaks as plate (AR 15) for fifty squares over whatever you wear — any class, never wears out; then fifty squares of ordinary cloth",
    act: { kind: "plate", effect: 50, cd: 50 },
  },
  {
    // Use-activated (260918-w4n): the auto-activation on a climb/gorge tile
    // is REMOVED (engine/movement.js) — a ready-but-unstarted Cloak of
    // Flying is not flying; only `useItem` on the worn cloak starts the
    // effect. `act.cd` is the explicit cooldown source since there is no
    // row `every` to fall back on. `txt` is left untouched (byte-identical
    // to the frozen prototype) — this row is NOT one of the 9 converted
    // rows this task rewords; it already carried an `act` before this task.
    n: "Cloak of Flying", slot: "cloak", eff: { fly: 1 }, txt: "flight for 20 squares, once every 50",
    act: { kind: "fly", effect: 20, cd: 50 },
  },
  {
    // Once-a-day rule: 20 effect + 100 cd -> 20 effect + 80 cd (still "once
    // every 100 squares" total cycle — txt stays true unedited).
    n: "Cloak of Ether", slot: "cloak", eff: {}, use: "ether", every: 80,
    txt: "walk through walls, once every 100 squares",
    act: { kind: "ether", effect: 20 },
  },
];

// Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp in the two
// rows below; cosmetic, engine never reads these strings; the parity
// harness strips the reworded txt (comparables.js#REWORDED_TXT_ITEMS).
const STAVES_ROWS = [
  {
    n: "Rowan Staff", use: "dome", txt: "a protective dome of 100 hp",
    act: { kind: "dome", charges: 2, recharge: 100 },
  },
  {
    n: "Birch Staff", use: "freeze", txt: "freezes up to 2 squares of opponents indefinitely",
    act: { kind: "freeze", charges: 2, recharge: 100 },
  },
  {
    n: "Walnut Staff", use: "weaken", txt: "all hits on the weakened do double damage",
    act: { kind: "weaken", charges: 2, recharge: 80 },
  },
  {
    n: "Oak Staff", use: "stone", txt: "turns 2 squares of opponents to stone",
    act: { kind: "stone", charges: 1, recharge: 100 },
  },
  {
    n: "Crystal Staff", use: "invis", txt: "party invisible d10+5 squares; enemies need a 1",
    act: { kind: "invis", charges: 2, recharge: 100, effect: { n: 1, sides: 10, bonus: 5 } },
  },
  {
    n: "Poplar Staff", use: "heal", txt: "1d20+10 hp to up to 6",
    act: { kind: "heal", charges: 3, recharge: 60 },
  },
  {
    n: "Pine Staff", use: "fire", txt: "d6 fireballs, automatic hits, 1d10+4 each",
    act: { kind: "fire", charges: 1, recharge: 100 },
  },
  {
    n: "Cedar Staff", use: "gas", txt: "knocks out 3 squares of enemies for a day",
    act: { kind: "gas", charges: 1, recharge: 100 },
  },
];

/** dropAuthored(row) — strips the authored `slot` AND `act` keys, keeping
 * every other field (and its original value) byte-identical to the
 * pre-Phase-39 row literal. */
function dropAuthored(row) {
  const { slot, act, ...rest } = row;
  return rest;
}

export const JEWELRY = JEWELRY_ROWS.map(dropAuthored);
export const CLOAKS = CLOAKS_ROWS.map(dropAuthored);
export const STAVES = STAVES_ROWS.map(dropAuthored);

/** SLOT_OF — display name (`.n`) -> slot FAMILY (jewelry | cloak), derived
 * from JEWELRY_ROWS + CLOAKS_ROWS ONLY (260918-w4n, staff amendment: a staff
 * has no slot — it is a bag item used by index, so STAVES_ROWS is
 * deliberately excluded); the name-keyed runtime lookup
 * engine/derived.js#slotFor falls back on when an item carries no own `slot`
 * key. A FAMILY, not a concrete worn key — engine/derived.js#WORN_KEYS_OF
 * maps a family to its concrete worn keys (jewelry holds two: jewelry1,
 * jewelry2; cloak holds one). Frozen; exactly 15 entries whose values are
 * only jewelry/cloak (260918-wy1, jewelry-merge ruling — the former
 * ring/bracelet/amulet/helm sub-slots are gone). */
export const SLOT_OF = Object.freeze(
  Object.fromEntries([...JEWELRY_ROWS, ...CLOAKS_ROWS].map((row) => [row.n, row.slot])),
);

/** buildActivation(row) — module-private: normalizes an authored `act` block
 * into the shape `content/activations.js#ACTIVATION_OF` exposes — a
 * duration+cooldown record `{ kind, effect, cd, eff? }` (cd defaults to the
 * row's own `every` when `act.cd` is not given) for a JEWELRY/CLOAKS row, or
 * a charges+recharge record `{ kind, charges, recharge, effect? }` for a
 * STAVES row (`effect` present only when the staff's use has its own
 * duration, e.g. the Crystal Staff's d10+5-squares invisibility). 260918-w4n:
 * the row's own `eff` map (its while-live payload, engine/derived.js#eff) is
 * copied onto BOTH branches as `eff`, but ONLY when it carries at least one
 * key — a row with `eff: {}` (Cloak of Speed, Pendant, Amulet of Stone,
 * every staff/potion) stays byte-identical to before this task. */
function buildActivation(row) {
  if (!row.act) return null;
  const { act } = row;
  const hasEff = row.eff && typeof row.eff === "object" && Object.keys(row.eff).length > 0;
  if (act.charges !== undefined) {
    const entry = { kind: act.kind, charges: act.charges, recharge: act.recharge };
    if (act.effect !== undefined) entry.effect = act.effect;
    if (hasEff) entry.eff = row.eff;
    return Object.freeze(entry);
  }
  const entry = { kind: act.kind, effect: act.effect, cd: act.cd ?? row.every };
  if (hasEff) entry.eff = row.eff;
  return Object.freeze(entry);
}

/** TREASURE_ACTIVATION_OF — display name -> normalized activation record,
 * for every JEWELRY/CLOAKS/STAVES row that carries an authored `act`. Frozen;
 * never spread onto an item object — see the header comment. Merged into
 * `content/activations.js#ACTIVATION_OF` alongside `content/potions.js`'s
 * `POTION_ACTIVATION_OF`. */
export const TREASURE_ACTIVATION_OF = Object.freeze(
  Object.fromEntries(
    [...JEWELRY_ROWS, ...CLOAKS_ROWS, ...STAVES_ROWS]
      .filter((row) => row.act)
      .map((row) => [row.n, buildActivation(row)]),
  ),
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
