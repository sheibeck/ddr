// content/races.js
//
// Pure-data port of mazeworld.html's RACES / RACE_D8 tables (~line 723-736).
// Contains no dice closures in the prototype — ported verbatim.
//
// Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp; cosmetic,
// engine never reads these strings; the parity harness strips the reworded
// txt (comparables.js#REWORDED_TXT_ITEMS).

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
    // RULES-11 (Phase 75.2, "Race signatures and Joiners", user ruling
    // 2026-09-25): Small's harder-to-hit face axis would cancel this row's
    // own `foeToHit: 1` (thin-boned, easy to hit) trait, so the base size
    // step's face axis is dropped for Elven — the Small damage axis (-2)
    // still applies in full. Never read by name; the guard
    // (test/unit/hero-size.test.js) derives this exact mask from
    // SIZE_AXIS_TRAITS.face (`foeToHit`) and this row's own base step sign.
    sizeAxes: { face: false },
    // RULES-11 (Phase 75.2, Plan 04): states the net truth under the size
    // rule — the masked face axis leaves "easy to hit" exactly as it was;
    // the damage axis is NOT masked, so being small also costs 2 damage.
    note: "Strikes a die better and hits on 5 whatever the class — but thin-boned and easy to hit, and being small costs it 2 damage.",
  },
  "Dwarven": {
    // armorWear: fraction of a soaked blow charged to armour durability,
    // Math.ceil'd, read by applyFoeDamageToPlayer.
    size: "Small", upkeep: 1, dmg: 2, foeStrikeStep: 1, armorWear: 0.5,
    // RULES-11 (Phase 75.2, "Race signatures and Joiners", user ruling
    // 2026-09-25): Small's -2 damage axis would cancel this row's own `dmg:
    // 2` trait, so the base size step's damage axis is dropped for Dwarven —
    // the Small face axis (harder to hit) still applies in full. Never read
    // by name; the guard (test/unit/hero-size.test.js) derives this exact
    // mask from SIZE_AXIS_TRAITS.dmg (`dmg`/`wpnBonus`) and this row's own
    // base step sign.
    sizeAxes: { dmg: false },
    // RULES-11 (Phase 75.2, Plan 04): states the net truth under the size
    // rule — the masked damage axis leaves the +2 untouched; the face axis
    // is NOT masked, so being small also makes it one face harder to hit.
    note: "+2 damage and 1 hp/day upkeep; foes strike at a better die; armor wears at half the rate; being small makes it one face harder to hit.",
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
    // RULES-11 (Phase 75.2, Plan 04): Large points the SAME way as the
    // Troll's own +9 (dmg+wpnBonus) trait, so nothing is masked — both
    // axes stack in full: +11 damage total, and one face easier to hit.
    note: "75 hp regardless of class and +11 damage (being large adds 2), but eats two rations a night and is one face easier to hit.",
  },
};

// Random Race, d8, p.? — RACE_D8[d8-1] (Human appears 3x: indices 4, 7, 8)
export const RACE_D8 = ["Elven", "Dwarven", "Wilmsry", "Human", "Fridgian", "Troll", "Human", "Human"];

// RULES-11 (Phase 75.2, "Hero Size Matters", user ruling 2026-09-25): size is
// a real stat now — every RACES row's own `size` string is a STEP on a
// signed scale (Small -1, Human 0, Large +1, extended as items stack), and
// items add to it (engine/derived.js#itemSizeStep, `eff(c, "size")`). This
// block is frozen data + the ONE rule every future size-changing item or
// race edit must respect: a race's own BASE size step is dropped on
// whichever axis (SIZE_AXES) that race's own trait fields (SIZE_AXIS_TRAITS)
// already push the OPPOSITE direction — the size step then only ADDS, it
// never cancels a race's defining trait (`sizeAxes` on the row below, e.g.
// Dwarven/Elven). ITEM size steps are never masked — they always apply in
// full on both axes, on top of the resolved race base
// (engine/derived.js#sizeAxisStep is the one function that reads `sizeAxes`;
// it is content, never a name check).

/** SIZE_STEP_OF — a RACES row's own `size` string -> signed step. Human/
 * Wilmsry/Fridgian read "Human" (step 0); Elven/Dwarven read "Small" (-1);
 * Troll reads "Large" (+1). */
export const SIZE_STEP_OF = { Tiny: -2, Small: -1, Human: 0, Large: 1, Huge: 2, Giant: 3 };

/** SIZE_NAMES — the displayed size name at each step, indexed from
 * SIZE_NAME_ORIGIN (engine/derived.js#sizeName clamps beyond either end). */
export const SIZE_NAMES = ["Tiny", "Small", "Human", "Large", "Huge", "Giant"];

/** SIZE_NAME_ORIGIN — the index of "Human" (step 0) in SIZE_NAMES. */
export const SIZE_NAME_ORIGIN = 2;

/** SIZE_AXES — the two things a size step can move: `dmg` (weapon damage)
 * and `face` (how easily foes land a blow). */
export const SIZE_AXES = ["dmg", "face"];

/** SIZE_AXIS_TRAITS — which of a RACES row's own fields count as that row's
 * "defining trait" on each axis, for the signature-mask guard
 * (test/unit/hero-size.test.js): `dmg` reads `dmg` + `wpnBonus` (Dwarven's
 * +2, Troll's +6/+3); `face` reads `foeToHit` (Elven's +1, thin-boned). */
export const SIZE_AXIS_TRAITS = { dmg: ["dmg", "wpnBonus"], face: ["foeToHit"] };
