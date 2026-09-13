// engine/foeDamage.js
//
// The ONE foe-damage seam (Phase 18, D-09; CANON-01/03/04). Every path that
// deals damage to a foe — hero weapon strike, ally/party-member strike, a
// foe striking another foe, spell damage (including acid ticks), a ward
// reflecting a blow back at its source, or an item effect — is meant to
// route through `damageFoe`. Kill accounting (`killFoe`, `foe.alive`,
// `foeKilled`) stays entirely with the caller; this module only computes and
// applies the damage number.
//
// This module's only rng draw is the natural-armor d20 soak, and it is
// gated so that any creature without `sp.ar` set — including all four
// fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante) — draws nothing,
// keeping the parity suite byte-identical (no call site is routed through
// this seam yet in this plan; 18-03/18-04 do that wiring).
//
// Pure, deterministic, no DOM/Math.random/localStorage. Imports only the
// content barrel — never `./combat.js` (combat.js/magic.js/items.js will
// import this seam; importing back would create a cycle).

import { DAMAGE_MULTIPLIERS } from "../content/index.js";

/**
 * multiplierFor(source, foe) — CANON-04 (D-11) pure lookup over
 * DAMAGE_MULTIPLIERS. A row matches when its `sourceKind` equals
 * `source.kind` AND every other row field is either `null` (wildcard) or
 * equal to the corresponding `source`/`foe` field. `foe.type` and
 * `foe.name` are the fields `startCombat` puts on every combat foe.
 *
 * Returns the MAXIMUM `mult` across every matching row (never the product —
 * two overlapping rows on the same hit do not compound), or `1` when no row
 * matches (also true when `source` is missing a field a row requires:
 * `undefined` never equals a non-null row value).
 */
export function multiplierFor(source, foe) {
  let best = 1;
  for (const row of DAMAGE_MULTIPLIERS) {
    if (row.sourceKind !== source.kind) continue;
    if (row.casterSub !== null && row.casterSub !== source.casterSub) continue;
    if (row.casterClass !== null && row.casterClass !== source.casterClass) continue;
    if (row.foeType !== null && row.foeType !== foe.type) continue;
    if (row.foeName !== null && row.foeName !== foe.name) continue;
    if (row.mult > best) best = row.mult;
  }
  return best;
}

/**
 * damageFoe(state, foe, rawDmg, source, rng, events) — the seam.
 *
 * `source` contract:
 *   - `kind`: one of "melee" (the hero's own weapon strike — the only kind
 *     eligible for the Fighter-vs-Trachea row), "ally" (a summoned ally or
 *     party member striking), "foe" (a foe struck by another foe), "spell"
 *     (any cast spell effect, including acid ticks), "reflect" (a ward
 *     bouncing a blow back at its source), or "item" (an item effect such
 *     as the fire staff).
 *   - `crit` (optional boolean): a critical hit, per D-07.
 *   - `casterClass` / `casterSub` (optional): the hero's `c.cls` / `c.sub`
 *     when the hero is the source of the damage.
 *   - `school` (optional): informational only.
 *
 * Order (locked): (1) CANON-04 damage-source x creature-type multiplier,
 * (2) Sterling's CANON-03 halfDmg ceil-halving, (3) the CANON-01
 * natural-armor d20 soak (with its crit/spell bypasses), (4) the wp
 * decrement. Returns `{ applied, soaked, mult }` and NEVER calls killFoe,
 * touches `foe.alive`, or emits `foeKilled` — kill accounting is the
 * caller's job (D-09).
 */
export function damageFoe(state, foe, rawDmg, source, rng, events) {
  // (0) A non-positive raw hit changes nothing — no draw, no mutation.
  if (!(rawDmg > 0)) return { applied: 0, soaked: false, mult: 1 };

  // (1) CANON-04: damage-source x creature-type multiplier.
  const mult = multiplierFor(source, foe);
  let dmg = mult === 1 ? rawDmg : Math.round(rawDmg * mult);

  // (2) CANON-03 (D-10): Sterling's halfDmg halves ALL damage the foe
  // takes, rounding UP, after the multiplier and before the soak.
  if (foe.sp && foe.sp.halfDmg) dmg = Math.ceil(dmg / 2);

  // (3) CANON-01 (D-05/D-06/D-07): natural-armor d20 soak. Mirrors the
  // canon player rule (rulebook p.44 "Using Armor") — no durability pool
  // for foes (D-05). Physical = every kind except "spell" (D-06); a crit
  // ignores the soak (D-07).
  const physical = source.kind !== "spell";
  //
  // DETERMINISM GATE: this `rng.d(20)` is the module's ONLY rng draw, and it
  // fires ONLY when ALL THREE of these hold: (a) the damage is physical
  // (not a spell), (b) the source is not a critical hit, and (c) the foe
  // has `sp.ar > 0`. Every fixture-exposed creature (Bat/Rat, Shriek,
  // Viper, Dante) lacks `sp.ar`, so this branch draws zero rng for them —
  // the parity suite stays byte-identical with no call site routed here.
  if (physical && !source.crit && foe.sp && foe.sp.ar > 0) {
    const roll = rng.d(20);
    if (roll <= foe.sp.ar) {
      events.push({ type: "foeArmorSoaked", name: foe.name, amount: dmg });
      return { applied: 0, soaked: true, mult };
    }
  }

  // (4) The blow lands. The seam pushes no event of its own here — callers
  // own their own damage event (struck/allyStruck/spellHit/...) and should
  // skip pushing it when `soaked` came back true (18-03/18-04 wire that).
  foe.wp -= dmg;
  return { applied: dmg, soaked: false, mult };
}
