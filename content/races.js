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
    // ROLL-04 (Phase 79, Plan 03): the strike die scales with level, so the
    // to-hit floor speaks in faces (test/unit/identity-footer.test.js pins it
    // to this row's own toHit).
    // Phase 91 plan 10 (TEXT-01, IDENT-12): states every Elven trait the footer lists, in the "+N to hit" form.
    note: "Thin-boned and easy to hit (foes get +1 to hit it), with 60% of the usual HP, and being small costs it 2 damage; but it strikes on a smaller die and hits on at least the top five numbers of it (16–20 on a d20) whatever the class; store prices halved (torches, rope and ladders aside); can always parley with Humans (talking a fight down) at +3 on that parley roll.",
  },
  "Dwarven": {
    // armorWear: fraction of a soaked blow charged to armour durability,
    // Math.ceil'd, read by applyFoeDamageToPlayer.
    size: "Small", upkeep: 1, dmg: 3, foeStrikeStep: 1, armorWear: 0.5,
    // Phase 91.1 plan 03 (V16 B, user 2026-10-01): +3 damage (was +2).
    // RULES-11 (Phase 75.2, "Race signatures and Joiners", user ruling
    // 2026-09-25): Small's -2 damage axis would cancel this row's own `dmg:
    // 2` trait, so the base size step's damage axis is dropped for Dwarven —
    // the Small face axis (harder to hit) still applies in full. Never read
    // by name; the guard (test/unit/hero-size.test.js) derives this exact
    // mask from SIZE_AXIS_TRAITS.dmg (`dmg`/`wpnBonus`) and this row's own
    // base step sign.
    sizeAxes: { dmg: false },
    // RULES-11 (Phase 75.2, Plan 04): states the net truth under the size
    // rule — the masked damage axis leaves the +3 untouched; the face axis
    // is NOT masked, so being small also makes foes −1 to hit it (TEXT-01,
    // Phase 91 plan 10: no "faces").
    note: "+3 damage and 1 HP/night upkeep; foes strike on a smaller die; armour wears at half the rate; being small means foes get −1 to hit it; store prices halved (torches, rope and ladders aside).",
  },
  "Wilmsry": {
    size: "Human", upkeep: 4, heal2x: true, spMul: 0.5,
    note: "Heals twice as much (rest, potions, own healing spells) and gets half the experience; can always parley (talking a fight down) with anything but Magical foes and the Walking Dead, at +4 on every parley roll; store prices 30% off; refuses to take Magic Users on as Joiners.",
  },
  "Fridgian": {
    // hide: flat damage soaked from every blow, read by applyFoeDamageToPlayer
    // and (Phase 91 plan 09, Q7 A) by applyFoeDamageToMember for a Joiner of the race.
    size: "Human", upkeep: 4, noArmor: true, frenzy: true, slow: true, hide: 3,
    // Phase 91.1 plan 03 (V17 B, user 2026-10-01): the hide soaks 3 (was 2), hero and Joiner alike.
    note: "Never wears armour (so never a Samurai), never strikes first; half the time (a 4, 5 or 6 on a d6) a strike frenzies into a second, wilder swing at −1 to hit, lost if the first one fells its target; thick hide soaks 3 from every blow.",
  },
  "Troll": {
    size: "Large", upkeep: 15, flatWP: 75, dmg: 6, wpnBonus: 3, eats: 2,
    // RULES-11 (Phase 75.2, Plan 04): Large points the SAME way as the
    // Troll's own +9 (dmg+wpnBonus) trait, so nothing is masked — both
    // axes stack in full: +11 damage total, and foes +1 to hit you.
    note: "75 hp regardless of class and +11 damage (being large adds 2), but eats two rations a night, loses 15 HP on a night without them, and foes get +1 to hit it; store prices doubled (torches, rope and ladders aside).",
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
