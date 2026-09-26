// engine/difficulty.js
//
// The single source of difficulty truth for endless descent (RUN-03). A pure
// difficultyCurve(depth) — no rng, no DOM, no side effects — that every
// consumer (engine/combat.js, engine/character.js, engine/movement.js,
// engine/encounters.js, engine/maze.js) reads through the exported pure
// helpers below, never a raw constant.
//
// History: Phase 21 (TUNE-01, D-01) first gave this module the combat-scaling
// knobs; Phase 27 (TUNE-06) added the foe-grace/hazard-ramp early-floor
// levers and the COMBAT_SCALE_FROM_DEPTH deep ramp; Phase 54 (BAND-01/02,
// 2026-09-21) built and then abandoned a five-rung floor-range KNOT LADDER
// (commits b0facb6..1cb56c6, rungs 1-5) chasing a per-floor survival curve —
// USER RULING D ("remove one-off hacks and bandaids that try to get bands by
// floor ranges, and establish dials that work on the dungeon as a whole")
// retires every one of those constants (COMBAT_SCALE_FROM_DEPTH, FOE_CAP_*,
// FOE_POWER_*, ABILITY_THREAT_BASE/MAX/SOFT_K, FOE_LVL_BIAS, FOE_GRACE_AT_*,
// HAZARD_FROM_DEPTH, HAZARD_SCALE_AT_*, WALL_*/BREAKAWAY_*/ENDGAME_*,
// ENCOUNTER_DOT_BASE/CAP/SOFT_K, DENSITY_CANON_THROUGH_DEPTH,
// DARK_HOLD_THROUGH_DEPTH, DARK_RADIUS_BASE, softCap/softCapFloat/bandLerp/
// knotFoePowerFor/knotHazardFor/knotAbilityThreatFor/foeDmgBonusFor) in favor
// of the GLOBAL DIFFICULTY MODEL below: one frozen `DIALS` object, every dial
// ONE number or `{ base, perDepth }` (a smooth slope over depth, never a
// floor-range knot), evaluated by `difficultyCurve(depth)`. Full ledger —
// the remove list as landed, the identity column, what moved at identity and
// why, the curve table — lives in docs/DIFFICULTY-RETUNE.md's
// "#### Identity commit" section, not here.
//
// Governing principle (USER RULING D, verbatim): FOE-side power keys to
// DEPTH; HERO-side power keys to the hero's LEVEL (paced by HERO_SP_SCALE);
// the ECONOMY keys to depth through foe tier (LOOT_SCALE, wired in 54-06).
//
// This module still consumes NO rng and touches NO DOM — every export here
// is a pure function of its arguments (or of the frozen/live DIALS object),
// so calling any of them can never perturb the seeded RNG cursor that
// genFloor/combat/movement and every parity/round-trip/determinism test
// depend on.

import { FLEE_THIEF_BONUS } from "../content/flee.js";
import { CLASSES } from "../content/classes.js";
import { ENCOUNTER_TABLES } from "../content/encounters.js";

/**
 * deepFreeze(obj) — Object.freeze is shallow; DIALS carries nested
 * `{ base, perDepth }` / `DOT_MIX` / `CLASS_MITIGATION` objects that must be
 * just as immutable as their parent. Not exported — internal helper only.
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Object.isFrozen(val)) deepFreeze(val);
  }
  return obj;
}

/**
 * DIALS — the ONE frozen source of every global difficulty dial (USER
 * RULING D, BAND-02). Every key is ONE number or `{ base, perDepth }` (a
 * smooth slope over depth, never a floor-range knot). Landed AT IDENTITY
 * where an identity exists (see each JSDoc below); the 54-06 dials
 * (LOOT_SCALE .. CLASS_MITIGATION) are added here at their own identity
 * values so this object's key set is complete from this commit — their
 * consumer hooks land in 54-06. `setDialsForTuning` (below) is the ONE
 * harness-only way to evaluate a candidate set; every run reads THIS object
 * by default.
 */
export const DIALS = deepFreeze({
  /** FOE_LEVEL — foeLevelFor(depth) = clamp(round(base + perDepth*depth), 1, 5).
   * DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21, USER RULING D):
   * no identity exists — this REPLACES `min(c.level, depth)` (foe level was a
   * function of the HERO's level, so difficulty stopped scaling with depth
   * the moment the hero out-leveled the dungeon, around floor 3). Direction:
   * ↑ = harder (foes hit like a higher tier sooner).
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): identity/start
   * {0.6,0.2}/{0.9,0.26} -> { base: 0.9, perDepth: 0.29 } —
   * fit/fit-log.jsonl #13 (score 2.7113, PASS). map(1) = round(0.9+0.29) =
   * 1 — floor 1 stays identical to canon (parity). */
  FOE_LEVEL: { base: 0.9, perDepth: 0.29 },
  /** TIER_SPREAD — the d4 "one tier lower" bleed threshold (canon: a roll of
   * 1 on a d4 knocks the tier down by one). Identity: 1 (unchanged from
   * canon `rng.d(4) === 1`). Direction: ↑ = more low-tier bleed (softer).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 1 (= identity, "available, canon"). */
  TIER_SPREAD: 1,
  /** FOE_HIT_SCALE — scales the WHOLE foe hit (`foeLevelBase + dice`, crit
   * included) at the hero/member/pursuit sites, post-roll. Identity:
   * `{ base: 1, perDepth: 0 }` (canon — the dominant damage term untouched).
   * Direction: ↑ = harder.
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): identity/start
   * {1,0}/{0.6,0.02} -> { base: 0.6, perDepth: 0.01 } — fit/fit-log.jsonl
   * #13 (score 2.7113, PASS); the walk moved `perDepth` down from the
   * cycle-2 start's 0.02 to 0.01 (evaluation #11), a small easing on the
   * dominant damage term's depth slope.
   * RULES-17 (Phase 75.3, user ruling 2026-09-25): a second, steeper slope
   * from `kneeDepth` — `scaleField` (below) evaluates
   * `base + perDepth*kneeDepth + perDepthAfter*(d - kneeDepth)` once `d` is
   * past `kneeDepth`, else the SAME expression as before (byte-identical for
   * every d <= kneeDepth). Identity: `perDepthAfter === perDepth` (or a
   * missing knee pair entirely, HAZARD_SCALE/ABILITY_THREAT's own shape) —
   * the knee never engages, so the single-slope expression runs at every
   * depth with no drift. Direction: ↑ (perDepthAfter) = harder past the
   * knee. `kneeDepth: 12`: user-ruled 2026-09-25 (floor 13 is the first
   * harder floor — the Phase 54 fit boundary) — NEVER searched by any fit.
   * `perDepthAfter: 0.02`: set by 75.3-06's checkpointed tail sweep; this
   * plan's start value is twice the pre-knee slope (0.01), deliberately
   * mild. */
  FOE_HIT_SCALE: { base: 0.6, perDepth: 0.01, kneeDepth: 12, perDepthAfter: 0.02 },
  /** FOE_HP_SCALE — scales a foe's starting wp/maxWP at copy time. Identity:
   * `{ base: 1, perDepth: 0 }`. Direction: ↑ = longer fights (harder).
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): base identity/
   * start 1/0.8 -> 0.9 — fit/fit-log.jsonl #13 (score 2.7113, PASS).
   * perDepth: held (available) — Phase 54 fit did not search this dial;
   * shipped at its start value 0.015.
   * RULES-17 (Phase 75.3, user ruling 2026-09-25): the SAME knee shape as
   * FOE_HIT_SCALE above (see its JSDoc for the formula/identity/direction).
   * `kneeDepth: 12`: user-ruled 2026-09-25; NEVER searched. `perDepthAfter:
   * 0.03`: set by 75.3-06's checkpointed tail sweep; this plan's start value
   * is twice the pre-knee slope (0.015). */
  FOE_HP_SCALE: { base: 0.9, perDepth: 0.015, kneeDepth: 12, perDepthAfter: 0.03 },
  /** FOE_COUNT_SKEW — an index into FOE_COUNT_TABLE (below) shifting
   * P(1/2/3 foes) once the canon d4 roll is > 2; row 0 is canon. Identity: 0
   * (canon draw shape, no level-keyed cap). Direction: ↑ = more bodies.
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 1 (0..4 if released). */
  FOE_COUNT_SKEW: 1,
  /** FOE_COUNT_DEPTH — RULES-16 (Phase 75.3, user ruling 2026-09-25):
   * "Solo fights fade with depth" — floors 1-4 stay exactly as today
   * (canon draw shape via FOE_COUNT_TABLE); floors 5-9 are solo only on a
   * first d4 of 1 (a first roll of 2 is raised to 2 foes); floors 10-19
   * never start a fight solo (raised to at least 2); floors 20+ always
   * bring at least 3 (the table already tops out at 3, so this is exactly
   * 3). Three rungs, each a depth threshold: `soloOnlyOnOneFrom` (a first
   * roll of 2 stops being solo from this depth), `atLeastTwoFrom` (the
   * count floor rises to 2), `atLeastThreeFrom` (the count floor rises to
   * 3). Identity: `{ soloOnlyOnOneFrom: 0, atLeastTwoFrom: 0,
   * atLeastThreeFrom: 0 }` (0 = "this rung never applies" — every rung off
   * reproduces today's count at every depth, since a threshold of 0 is
   * never `>= 1`). Direction: ↓ (lower thresholds) = more bodies sooner.
   * held (available) — user-ruled values, not fitted (75.3-CONTEXT
   * Deferred: "Fitting the thresholds with the tuning bot: possible later
   * as a dial; not requested now"). */
  FOE_COUNT_DEPTH: { soloOnlyOnOneFrom: 5, atLeastTwoFrom: 10, atLeastThreeFrom: 20 },
  /** FOE_ELITE — RULES-17 (Phase 75.3, user ruling 2026-09-25): "the roster
   * keeps escalating past the level-5 tier" — the bestiary has exactly 5
   * tiers per family, so a foe whose FOE_LEVEL line would pass 5 becomes a
   * tier-5 foe of ELITE RANK (level above 5) instead of raising a clamp
   * (`foeTierFor` below). `maxRank` caps the rank a foe may reach; `hpPerRank`/
   * `hitPerRank` are the PER-RANK multipliers `foeWpFor`/`foeHitFor` (below)
   * apply on top of the depth curve's own `foeHpScale`/`foeHitScale`.
   * Identity: `{ maxRank: 0, hpPerRank: 0, hitPerRank: 0 }` (`maxRank: 0`
   * switches elites off entirely — `foeTierFor` reproduces today's tier pick
   * at every depth). Direction: ↑ = harder (more/stronger elites).
   * held (available) — `maxRank`/`hitPerRank` are start values, not fitted;
   * `hpPerRank` is searched by 75.3-06's checkpointed tail sweep. Start
   * values 10 / 0.1 / 0.05: a mild elite bonus on top of the knee. */
  FOE_ELITE: { maxRank: 10, hpPerRank: 0.1, hitPerRank: 0.05 },
  /** CONTROL_AT_DEPTH — RULES-18 (Phase 75.3, user ruling 2026-09-25): "from
   * floor 12, foes increasingly RESIST control" — Freeze, Stone, Doze/Sleep,
   * Weaken, Stupid and the like. Past `kneeDepth`, `controlResistFacesFor`
   * (below) grows the resist check's winning faces by `resistPerDepth` per
   * floor past the knee, capped at `resistCap` (and, structurally, at 19 —
   * control can always land on a d20's top face); `controlHoldRoundsFor`
   * gives an "indefinite" control (a Freeze/Stone kill, Stupidity, Blind,
   * the Walnut Staff's weaken, the Birch/Cedar staves' 99-round sleep, the
   * Lullaby's 24) `holdRounds` turns past the knee instead. Design rulings
   * (user, 2026-09-25, 75.3-CONTEXT "Design rulings after planning"): a
   * landed Freeze, Ice's last tick, Petrify and the stone staves HOLD the
   * foe for `holdRounds` (3 at the start value) instead of killing it past
   * the knee; the knee is the SAME as RULES-17's (`kneeDepth: 12` — floor 12
   * stays exactly as tuned, floor 13 is the first harder floor, the Phase 54
   * fit boundary). Identity: `{ kneeDepth: 12, resistPerDepth: 0, resistCap:
   * 0, holdRounds: 0 }` — `resistPerDepth`/`resistCap`/`holdRounds` all 0
   * means `controlResistFacesFor` is 0 at every depth (no roll, ever) and
   * `controlHoldRoundsFor` is 0 at every depth (no cap, ever) — the knee
   * itself never needs to switch off since both dependent dials already are.
   * Direction: ↑ (resistPerDepth/resistCap) = harder to control past the
   * knee; ↓ (holdRounds) = a landed control lasts fewer turns.
   * `kneeDepth`/`holdRounds`: user-ruled, NEVER searched. `resistCap`: held
   * (available), a start value. `resistPerDepth`: searched by 75.3-06's
   * checkpointed tail sweep. */
  CONTROL_AT_DEPTH: { kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 },
  /** ROUND_DAMAGE_CEILING — a fraction of a level-appropriate hero's MEAN
   * max HP that ONE foe may deal per foeTurn visit, across all its swings
   * (frenzy/sp.atk included); 0 = off. Identity: 0 (no ceiling — canon
   * cliffs stay cliffs until this dial is released). Direction: ↑ = a
   * softer ceiling (0 is the hardest/uncapped setting; a small positive
   * value is SOFTER than 0).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0.5 ([0.3, 1.0] if released). TUNE-08's roster-under-
   * the-ceiling table reads this value. */
  ROUND_DAMAGE_CEILING: 0.5,
  /** ABILITY_THREAT — the caster-cadence scalar (abilityCadenceFor).
   * Identity: `{ base: 1, perDepth: 0 }`. Direction: ↑ = casters act more
   * often (harder).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value { base: 1.0, perDepth: 0 } (= identity; base [0.6, 1.2]
   * if released). */
  ABILITY_THREAT: { base: 1, perDepth: 0 },
  /** HERO_HP_SCALE — multiplies the hero's rolled maxWP at chargen AND every
   * level-up gain (through `heroMaxWpFor`, which also folds in a class's
   * CLASS_MITIGATION.hpMul). Identity: 1 (canon). Direction: ↑ = tankier
   * hero (easier).
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): identity/start
   * 1/1.25 -> 1.25 (unmoved from the cycle-2 start this cycle) —
   * fit/fit-log.jsonl #13 (score 2.7113, PASS). */
  HERO_HP_SCALE: 1.25,
  /** HERO_REGEN_PER_FLOOR — a fraction of maxWP restored once, on arriving
   * at a new floor (`descend`, hero only). Identity: 0 (no regen — canon has
   * none). Direction: ↑ = easier.
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): identity/start
   * 0/0.25 -> 0.25 (unmoved from the cycle-2 start this cycle) —
   * fit/fit-log.jsonl #13 (score 2.7113, PASS). */
  HERO_REGEN_PER_FLOOR: 0.25,
  /** HERO_SP_SCALE — scales every SP grant (kill share, parley, the descend
   * bonus, the table-four +10/+25 XP dots). Identity: 1 (canon). Direction:
   * ↑ = faster leveling (paces HERO_HP_SCALE's payoff sooner).
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): identity/start
   * 1/0.28 -> 0.28 (unmoved from the cycle-2 start this cycle; evaluations
   * #6-7 probed 0.33/0.23 and both scored worse) — fit/fit-log.jsonl #13
   * (score 2.7113, PASS). */
  HERO_SP_SCALE: 0.28,
  /** CAMP_HEAL_FRACTION — a rested night heals `round(fraction * maxWP) +
   * d10 - 5` (the SAME d10 draw canon always made, re-centered). No
   * identity exists (canon was `d10 + 2*level`, a level term, not a
   * fraction of maxWP) — mean-matched at level 1: mean maxWP 41.67, so
   * `round(0.17 * 41.67) + d10 - 5` has mean 7.6 vs canon's `d10 + 2` mean
   * 7.5. Direction: ↑ = easier.
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0.2 ([0.15, 0.5] if released). */
  CAMP_HEAL_FRACTION: 0.2,
  /** FOOD_CLOCK — a multiplier on the class's canon starting-ration count.
   * Identity: 1 (canon). Direction: ↑ = more starting rations (easier).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 1.5 ([1.0, 1.6] if released). */
  FOOD_CLOCK: 1.5,
  /** ENCOUNTER_DOTS — `{ base, perDepth }`; non-breather dots =
   * `round(base + perDepth*depth)`. Identity: `{ base: 9, perDepth: 1 }`
   * (= canon `9 + depth`, no cap). Direction: ↑ = more attrition
   * (harder).
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): base identity/
   * start 9/7 -> 7 (unmoved from the cycle-2 start this cycle) —
   * fit/fit-log.jsonl #13 (score 2.7113, PASS). perDepth: held (available)
   * — Phase 54 fit did not search this dial; shipped at its start value
   * 0.3. */
  ENCOUNTER_DOTS: { base: 7, perDepth: 0.3 },
  /** HAZARD_SCALE — post-draw fall/trap/leap damage scale (scaleHazard),
   * floor 1 included. Identity: `{ base: 1, perDepth: 0 }` (canon).
   * Direction: ↑ = harder.
   * Fitted (Phase 54, USER RULING G cycle 3, 2026-09-21): base identity/
   * start 1/0.6 -> 0.6 (unmoved from the cycle-2 start this cycle) —
   * fit/fit-log.jsonl #13 (score 2.7113, PASS). perDepth: held (available)
   * — Phase 54 fit did not search this dial; shipped at its start value
   * 0.02. */
  HAZARD_SCALE: { base: 0.6, perDepth: 0.02 },
  /** DARK_BLOBS — `{ base, perDepth }`, `clamp(round(base+perDepth*depth), 0,
   * DARK_BLOB_CAP)` on a non-breather floor (0 on a breather). Identity:
   * `{ base: -0.4, perDepth: 0.7 }` reproduces canon's floors 1/2/4/5+
   * exactly; floor 3 reads 2 where the retired floor-hold ramp (see this
   * module's header history paragraph) used to read 1 (not fixture-exposed).
   * Direction: ↑ = more darkness (harder).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value { base: -0.4, perDepth: 0.7 } (= identity; perDepth
   * [0.3, 1.0] if released). */
  DARK_BLOBS: { base: -0.4, perDepth: 0.7 },
  /** DARK_BLOB_CAP — the hard ceiling on darkBlobs. Identity: 3 (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 3 (= identity). */
  DARK_BLOB_CAP: 3,
  /** DARK_RADIUS — `{ base, perDepth }`, `min(round(base+perDepth*depth),
   * DARK_RADIUS_CAP)`. Identity: `{ base: 3, perDepth: 1 }` (= canon
   * `3+depth`, capped). Direction: ↑ = larger dark zones (harder).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value { base: 3, perDepth: 1 } (= identity). */
  DARK_RADIUS: { base: 3, perDepth: 1 },
  /** DARK_RADIUS_CAP — the hard ceiling on darkRadius. Identity: 7
   * (= today exactly — the Phase 27 easing value, kept as this dial's
   * identity since it is what every current save/fixture already sees).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 7 (= identity). */
  DARK_RADIUS_CAP: 7,
  /** STORE_TIER — `{ base, perDepth }`, `clamp(round(base+perDepth*depth),
   * 0, 3)`; reproduces today's BAG_FLOORS ladder exactly (map 1..12 =
   * "011122223333"). Consumer hook lands in 54-06. Identity:
   * `{ base: 0, perDepth: 0.3 }`. Direction: ↑ = richer stores sooner
   * (easier economy).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value { base: 0, perDepth: 0.3 } (= identity; perDepth
   * [0.15, 0.6] if released). */
  STORE_TIER: { base: 0, perDepth: 0.3 },
  /** LOOT_SCALE — 54-06's economy multiplier (gold/treasure). Identity: 1
   * (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0.8 ([0.4, 1.5] if released). */
  LOOT_SCALE: 0.8,
  /** FOE_ACCURACY — 54-06's to-hit modifier. Identity: 0 (canon, no
   * modifier).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0 (= identity; -3..+3 if released). */
  FOE_ACCURACY: 0,
  /** DOT_MIX — 54-06's Table-4 category weighting (fight/harm/loot/help).
   * Identity: all 1.0 (canon mix).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value { fight: 1.0, harm: 1.0, loot: 1.0, help: 1.0 } (=
   * identity; `fight` [0.6, 1.2] if released, harm/loot/help "available,
   * canon"). */
  DOT_MIX: { fight: 1, harm: 1, loot: 1, help: 1 },
  /** WANDER_RATE — 54-06's wandering-monster check multiplier. Identity: 1
   * (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 1 (= identity; {0, 1, 2} if released). */
  WANDER_RATE: 1,
  /** FLEE_NEED_MOD — 54-06's flee-roll modifier. Identity: 0 (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0 (= identity, "available, canon"). */
  FLEE_NEED_MOD: 0,
  /** PARLEY_NEED_MOD — 54-06's parley-roll modifier. Identity: 0 (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0 (= identity, "available, canon"). */
  PARLEY_NEED_MOD: 0,
  /** STARTING_GOLD — 54-06's chargen gold. Identity: 50 (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 50 (= identity, "available, canon"). */
  STARTING_GOLD: 50,
  /** STARTING_POTION_BONUS — 54-06's chargen potion bonus. Identity: 0
   * (canon).
   * held (available) — Phase 54 fit did not search this dial; shipped at
   * its start value 0 (= identity, "available, canon"). */
  STARTING_POTION_BONUS: 0,
  /** CLASS_MITIGATION — 54-06's per-class mitigation rows; `Fighter.hpMul`
   * is already read by `heroMaxWpFor` below (identity 1, a no-op multiplier
   * on top of HERO_HP_SCALE). `Thief.fleeBonus` is seeded from
   * content/flee.js's own canon `FLEE_THIEF_BONUS` (5) so this table is
   * never out of sync with the existing flee-modifier table it will one day
   * replace.
   * held (available) — Phase 54 fit did not search this dial (USER RULING
   * G, cycle 3: the ["Magic User", "spellPower"] leaf was briefly promoted
   * to a searched coordinate by Ruling F's cycle-2 "Adjustment 1", then
   * dropped again — it proved a structural no-op across 200 seeds); shipped
   * at its identity/start values (every row 1, "available" — the fit's
   * every candidate in cycle 3 satisfied the class-pool constraints without
   * a manual notch, so this stays untouched). */
  CLASS_MITIGATION: {
    Fighter: { hpMul: 1, armorMul: 1, killSpeed: 1 },
    Thief: { evasion: 0, fleeBonus: FLEE_THIEF_BONUS, trapAvoid: 0, killSpeed: 1 },
    "Magic User": { spellPower: 1 },
  },
});

/** Every BREATHER_EVERY-th floor after floor 1 is a lighter "breather" floor. */
export const BREATHER_EVERY = 5;

/**
 * DOT_HP_BASE — Table-4's ±HP dots (p.45), canon flat values (small/mid/
 * large = 10/15/25). DELIBERATE RULES CHANGE (Phase 54, BAND-02,
 * 2026-09-21, USER RULING G): retires 54-05's `DOT_HP_FRACTION` (a fraction
 * of the hero's CURRENT maxWP), which COMPOUNDED — the "+25 HP" row's
 * `c.maxWP += dotHpFor("large", c.maxWP)` fed the dot's own OUTPUT back into
 * its NEXT INPUT (`maxWP`), so each pull was a permanent ×1.6 on top of the
 * last (three pulls ≈ ×4; a Pixel 7 on-device run showed a 140-hp "-15 HP"
 * toll on floor 6). `dotHpFor` (below) now reads this FLAT table, scaled
 * ONCE by `HERO_HP_SCALE` — never by the hero's own prior pulls — so a dot
 * is a fixed hp swing at the CURRENT hero-scale, with zero feedback into
 * itself. Not a `DIALS` key (no fit coordinate, no held-dial row): the flat
 * canon numbers are content, not a tunable dial — `HERO_HP_SCALE` is the
 * dial that already scales them fairly, same as every other maxWP-anchored
 * value in this module.
 */
export const DOT_HP_BASE = Object.freeze({ small: 10, mid: 15, large: 25 });

// --- Phase 41 (TERR-01): water pool knobs -----------------------------------
// Unchanged by Phase 54 — water is a rhythm knob, not a difficulty dial (the
// user's "dials that work on the dungeon as a whole" ruling covers the
// combat/attrition/hero axes above; water pool count/size stays exactly as
// Phase 41 landed it).

/** WATER_POOL_MIN — the pool count on floor 1 and on every breather floor. */
export const WATER_POOL_MIN = 1;
/** WATER_POOL_CAP — the pool count ceiling water eases toward by depth. */
export const WATER_POOL_CAP = 3;
/** WATER_POOL_GROWTH_EVERY — pool count rises by one every this-many depths
 * past floor 1. */
export const WATER_POOL_GROWTH_EVERY = 4;
/** WATER_POOL_SIZE_MIN — a single pool's minimum cell count (inclusive). */
export const WATER_POOL_SIZE_MIN = 3;
/** WATER_POOL_SIZE_MAX — a single pool's maximum cell count (inclusive). */
export const WATER_POOL_SIZE_MAX = 8;

/**
 * live — a module-private, possibly-overridden copy of DIALS. Every helper
 * and difficultyCurve() below reads THIS, never DIALS directly, so
 * setDialsForTuning's override is visible everywhere with zero consumer
 * changes.
 */
let live = DIALS;

/**
 * setDialsForTuning(overrides) — USER RULING D / 54-06/54-07's fit tool: the
 * ONE harness-only hook that deep-merges a partial DIALS shape into a NEW
 * frozen `live` copy. HARNESS-ONLY (like `forceParty`): never referenced by
 * `src/`, `mazeworld.html` or any other engine module — pinned by grep in
 * test/difficulty/difficulty.test.js. Throws on an unknown top-level key (a
 * typo guard — a silently-ignored override would waste a fit iteration).
 * Returns a restore function that puts `live` back to `DIALS` exactly.
 */
export function setDialsForTuning(overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (!(key in DIALS)) throw new Error(`setDialsForTuning: unknown dial "${key}"`);
  }
  const next = {};
  for (const key of Object.keys(DIALS)) {
    const base = DIALS[key];
    const over = overrides[key];
    if (over === undefined) {
      next[key] = base;
    } else if (base && typeof base === "object" && !Array.isArray(base) && over && typeof over === "object") {
      next[key] = { ...base, ...over };
    } else {
      next[key] = over;
    }
  }
  live = deepFreeze(next);
  return function restore() {
    live = DIALS;
  };
}

/**
 * safeDepth(depth) — clamps an arbitrary input to a positive integer BEFORE
 * any arithmetic runs, so a corrupted/non-integer/non-positive save-derived
 * floor.depth (Security Domain V5; threat T-03-01) can never poison this
 * module's output with NaN/Infinity. Not exported — internal guard only.
 */
function safeDepth(depth) {
  const d = Math.floor(depth);
  return Number.isFinite(d) ? Math.max(1, d) : 1;
}

/**
 * isBreatherOfSafeDepth(d) — the breather-cadence check itself, assuming `d`
 * has ALREADY been through safeDepth(). Not exported — internal helper only.
 */
function isBreatherOfSafeDepth(d) {
  return d > 1 && (d - 1) % BREATHER_EVERY === 0;
}

/**
 * isBreather(depth) — every BREATHER_EVERY-th floor after floor 1 is a
 * breather (depths 6, 11, 16, 21, ...). Pure, no RNG. Public entry point:
 * sanitizes `depth` itself.
 */
export function isBreather(depth) {
  return isBreatherOfSafeDepth(safeDepth(depth));
}

/**
 * scaleField(dial, d) — evaluates a `{ base, perDepth }` dial at depth `d`.
 * `perDepth === 0` returns `base` EXACTLY (no arithmetic drift — this is
 * what makes HAZARD_SCALE/ABILITY_THREAT's identity column structural, not a
 * rounding accident).
 *
 * RULES-17 (Phase 75.3, user ruling 2026-09-25): a dial MAY also carry a
 * knee (`kneeDepth`, `perDepthAfter` — FOE_HIT_SCALE/FOE_HP_SCALE today).
 * Only when BOTH knee fields are finite, `perDepthAfter !== perDepth` (the
 * identity/no-op case) and `d > kneeDepth` does the join fire:
 * `base + perDepth*kneeDepth + perDepthAfter*(d - kneeDepth)` — the SAME
 * value the single-slope expression would give AT `d === kneeDepth` (the two
 * branches meet exactly there, no jump), then a steeper (or shallower) slope
 * beyond it. Every other case — no knee fields on the dial at all
 * (HAZARD_SCALE/ABILITY_THREAT), `perDepthAfter === perDepth` (identity,
 * e.g. `setDialsForTuning`'s tuning override), or `d <= kneeDepth` — falls
 * through to the existing single-slope expression, including its
 * `perDepth === 0` fast path, byte-identical to before this dial ever
 * carried a knee. Not exported — internal helper only.
 */
function scaleField(dial, d) {
  if (
    Number.isFinite(dial.kneeDepth) &&
    Number.isFinite(dial.perDepthAfter) &&
    dial.perDepthAfter !== dial.perDepth &&
    d > dial.kneeDepth
  ) {
    return dial.base + dial.perDepth * dial.kneeDepth + dial.perDepthAfter * (d - dial.kneeDepth);
  }
  return dial.perDepth === 0 ? dial.base : dial.base + dial.perDepth * d;
}

/**
 * foeLevelFor(depth) — USER RULING D: foe level is a function of DEPTH, not
 * the hero's level (replaces the retired `min(c.level, depth)`). Consumed by
 * engine/combat.js's `startCombat` (`maxLvl`).
 */
export function foeLevelFor(depth) {
  const d = safeDepth(depth);
  return Math.max(1, Math.min(5, Math.round(live.FOE_LEVEL.base + live.FOE_LEVEL.perDepth * d)));
}

/**
 * tierSpreadFor() — exposes live.TIER_SPREAD to engine/combat.js's d4
 * "one tier lower" bleed check (`rng.d(4) <= tierSpreadFor()`), so 54-06/
 * 54-07's fit tool can move it through setDialsForTuning.
 */
export function tierSpreadFor() {
  return live.TIER_SPREAD;
}

/**
 * foeTierFor(depth, bled) — RULES-17 (Phase 75.3, user ruling 2026-09-25):
 * the roster keeps escalating past the level-5 tier as ELITE variants of
 * tier-5 foes (the bestiary has exactly 5 tiers per family — no new
 * authoring), rather than raising the level clamp. `bled` is the SAME
 * tier-bleed d4 check `startCombat` already rolls (`rollCheck(rng, 4,
 * atLeastFor(tierSpreadFor(), 4)).ok`) — this function draws NOTHING itself.
 *
 * Reads FOE_LEVEL's own line UNCLAMPED (`raw`) to find how far past 5 it
 * would go; `rankBeforeBleed` clamps that overflow to `live.FOE_ELITE.
 * maxRank` (0 switches elites off — the identity value). When
 * `rankBeforeBleed` is 0 (either `raw <= 5`, i.e. depths 1-15 at the shipped
 * dials, or `maxRank` is 0), this returns EXACTLY today's tier pick —
 * `{ lvl: clamp(foeLevelFor(d) - (bled ? 1 : 0), 1, 5), eliteRank: 0 }` — the
 * SAME bleed-lowers-the-LEVEL rule that has always applied. Once an elite is
 * in play (`rankBeforeBleed > 0`), the foe's tier stays 5 (it never drops a
 * tier again) and the SAME bleed check instead lowers its RANK by one
 * (floored at 0) — "the tier-bleed d4 now lowers an elite's rank before its
 * tier." Pure; 0 draws.
 */
export function foeTierFor(depth, bled) {
  const d = safeDepth(depth);
  const raw = Math.round(live.FOE_LEVEL.base + live.FOE_LEVEL.perDepth * d);
  const rankBeforeBleed = Math.min(Math.max(0, raw - 5), live.FOE_ELITE.maxRank);
  if (rankBeforeBleed <= 0) {
    return { lvl: Math.max(1, Math.min(5, foeLevelFor(d) - (bled ? 1 : 0))), eliteRank: 0 };
  }
  return { lvl: 5, eliteRank: bled ? Math.max(0, rankBeforeBleed - 1) : rankBeforeBleed };
}

/**
 * controlResistFacesFor(depth) — RULES-18 (Phase 75.3, user ruling
 * 2026-09-25): the resist check's winning faces on a d20 (roll-high),
 * `min(resistCap, 19, max(0, round(resistPerDepth * (depth - kneeDepth))))`
 * at or below `kneeDepth`, else 0. The `19` ceiling is structural, not a dial
 * — a d20's own top face always wins for the controller no matter how far
 * `resistCap` is released, so control can never become impossible. Pure, no
 * rng. `safeDepth` first, so a corrupted/non-integer depth never poisons this
 * with NaN/Infinity.
 */
export function controlResistFacesFor(depth) {
  const d = safeDepth(depth);
  const K = live.CONTROL_AT_DEPTH;
  if (d <= K.kneeDepth) return 0;
  return Math.min(K.resistCap, 19, Math.max(0, Math.round(K.resistPerDepth * (d - K.kneeDepth))));
}

/**
 * controlHoldRoundsFor(depth) — RULES-18: the number of rounds an
 * "indefinite" control (a Freeze/Stone kill, Stupidity, Blind, the Walnut
 * Staff's weaken, the Birch/Cedar staves' 99-round sleep, the Lullaby's 24)
 * holds for past `kneeDepth`, instead of lasting the whole fight (or ending
 * it outright) — `CONTROL_AT_DEPTH.holdRounds` past the knee, else 0. Pure,
 * no rng.
 */
export function controlHoldRoundsFor(depth) {
  const d = safeDepth(depth);
  const K = live.CONTROL_AT_DEPTH;
  return d > K.kneeDepth ? K.holdRounds : 0;
}

/**
 * controlCapRounds(depth, n) — RULES-18: caps an indefinite control's
 * duration `n` at `controlHoldRoundsFor(depth)` rounds once that cap is live
 * (> 0); returns `n` unchanged at or below the knee (cap 0, "no cap" — never
 * `Math.min(n, 0)`, which would zero out a landed control's duration
 * entirely). A control with its own SHORT rolled duration (Doze/Stun/Weaken/
 * Vapor's sleep/Insane's sleep/Thunder) never calls this — only the
 * "would have lasted the whole fight" rows do. Pure, no rng.
 */
export function controlCapRounds(depth, n) {
  const hold = controlHoldRoundsFor(depth);
  return hold > 0 ? Math.min(n, hold) : n;
}

/**
 * FOE_COUNT_TABLE — row = FOE_COUNT_SKEW, column = the SECOND d4's face
 * (1-4) -> foe count, for the branch where the canon roll's FIRST d4 was
 * > 2. Row 0 is canon: P(1,2,3) = .500/.375/.125 (faces 1-3 -> 2 foes, face
 * 4 -> 3 foes).
 */
export const FOE_COUNT_TABLE = Object.freeze([
  Object.freeze([2, 2, 2, 3]),
  Object.freeze([1, 2, 2, 3]),
  Object.freeze([1, 2, 2, 2]),
  Object.freeze([1, 1, 2, 2]),
  Object.freeze([1, 1, 1, 2]),
]);

/**
 * rungLiveAt(threshold, d) — a FOE_COUNT_DEPTH rung is live when its
 * threshold is above 0 (0 means "this rung never applies", the identity
 * value) AND the already-sanitised depth `d` has reached it. Not exported —
 * internal helper only.
 */
function rungLiveAt(threshold, d) {
  return threshold > 0 && d >= threshold;
}

/**
 * foeCountFor(firstRoll, drawSecond, depth = 1) — USER RULING D: replaces
 * the retired level-keyed `cap = c.level <= 2 ? 2 : 3` ternary chain with a
 * weighted pick that keeps the CANON DRAW SHAPE verbatim: `drawSecond` (a
 * thunk) is called ONLY when `firstRoll > 2` — one d4 on the common path,
 * two only when the first roll warrants it, exactly like the retired
 * `rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3` ternary.
 *
 * RULES-16 (Phase 75.3, user ruling 2026-09-25): `depth` reshapes the SAME
 * two draws, never adding a third. Floors 1-4 (no FOE_COUNT_DEPTH rung
 * live): unchanged — `firstRoll <= 2` is always 1, `firstRoll > 2` reads the
 * table as-is. From `soloOnlyOnOneFrom`, a `firstRoll` of 2 stops being solo
 * (raised to 2, no draw added) and a table result is raised to at least 2 as
 * well; from `atLeastTwoFrom` the WHOLE result floors at 2 via
 * `foeCountMinFor`; from `atLeastThreeFrom` it floors at 3. `depth` defaults
 * to 1 (omitting it, as every pre-Phase-75.3 two-argument caller does, keeps
 * today's count exactly — test/parity/divergence-records.test.js's BAND-02
 * guard calls this with two arguments and must keep passing untouched).
 */
export function foeCountFor(firstRoll, drawSecond, depth = 1) {
  const d = safeDepth(depth);
  const soloOnlyOnOne = rungLiveAt(live.FOE_COUNT_DEPTH.soloOnlyOnOneFrom, d);
  let result;
  if (firstRoll <= 2) { // roll:selection — a table pick on an already-drawn face, not a magnitude check
    result = !soloOnlyOnOne || firstRoll === 1 ? 1 : 2;
  } else {
    result = FOE_COUNT_TABLE[live.FOE_COUNT_SKEW][drawSecond() - 1];
    if (soloOnlyOnOne) result = Math.max(2, result);
  }
  return Math.max(result, foeCountMinFor(d));
}

/**
 * foeCountMinFor(depth) — RULES-16 (Phase 75.3): the floor EVERY count
 * (drawn or wandering) may never fall below at this depth — 3 once
 * `atLeastThreeFrom` is live, else 2 once `atLeastTwoFrom` is live, else 1.
 * Pure, no rng. Two uses: `foeCountFor`'s own final clamp above, and a
 * wandering fight's WHOLE size (engine/combat.js#startCombat draws no count
 * die for a wandering encounter at all — this is its entire roster size).
 */
export function foeCountMinFor(depth) {
  const d = safeDepth(depth);
  if (rungLiveAt(live.FOE_COUNT_DEPTH.atLeastThreeFrom, d)) return 3;
  if (rungLiveAt(live.FOE_COUNT_DEPTH.atLeastTwoFrom, d)) return 2;
  return 1;
}

/**
 * foeWpFor(baseWp, curve, eliteRank = 0) — copy-time wp/maxWP scaling. The
 * strict `=== 1` fast path (via curve.foeHpScale) makes identity structural
 * even for a non-integer wp, at `eliteRank` 0 (the default — every
 * pre-Phase-75.3 two-argument caller keeps this exact behavior).
 *
 * RULES-17 (Phase 75.3, user ruling 2026-09-25): an elite (`eliteRank > 0`,
 * from `foeTierFor`) multiplies the depth-scaled wp by
 * `(1 + FOE_ELITE.hpPerRank * eliteRank)` INSIDE the one `Math.round`, still
 * floored at 1 — one rounding, never two.
 */
export function foeWpFor(baseWp, curve, eliteRank = 0) {
  if (eliteRank > 0) return Math.max(1, Math.round(baseWp * curve.foeHpScale * (1 + live.FOE_ELITE.hpPerRank * eliteRank)));
  return curve.foeHpScale === 1 ? baseWp : Math.max(1, Math.round(baseWp * curve.foeHpScale));
}

/**
 * foeHitFor(raw, curve, eliteRank = 0) — USER RULING D: scales the WHOLE foe
 * hit (`foeLevelBase(f) + (crit ? 2*dice : dice)`) at the hero/member/pursuit
 * damage sites, replacing the retired flat-bonus helper this module's header
 * history paragraph names (which only scaled the `lvl^2` term, leaving the
 * dominant dice terms — Werebeast 2xd10, Dante x3, Drake 2d10+4 —
 * untouched, so the old ladder saturated). `eliteRank` defaults to 0 (every
 * pre-Phase-75.3 two-argument caller keeps this exact behavior).
 *
 * RULES-17 (Phase 75.3, user ruling 2026-09-25): an elite (`eliteRank > 0`)
 * multiplies by `(1 + FOE_ELITE.hitPerRank * eliteRank)` INSIDE the one
 * `Math.round`, still floored at 1 — one rounding, never two.
 * `ROUND_DAMAGE_CEILING` (roundDamageCapFor) still caps one foe's damage per
 * visit AFTER this.
 */
export function foeHitFor(raw, curve, eliteRank = 0) {
  if (eliteRank > 0) return Math.max(1, Math.round(raw * curve.foeHitScale * (1 + live.FOE_ELITE.hitPerRank * eliteRank)));
  return curve.foeHitScale === 1 ? raw : Math.max(1, Math.round(raw * curve.foeHitScale));
}

/**
 * heroMeanMaxWpFor(level) — the unweighted mean, over the three CLASSES, of
 * a level-`level` hero's maxWP at HERO_HP_SCALE 1 (the level-appropriate
 * "mean hero" ROUND_DAMAGE_CEILING/CAMP_HEAL_FRACTION are mean-matched
 * against — DOT_HP_BASE, USER RULING G, is a flat canon table scaled by
 * HERO_HP_SCALE directly, not mean-matched). Pinned: 41.67 / 46.17 / 50.00 / 54.50 / 60.00 for
 * levels 1..5 (2 dp) — see docs/DIFFICULTY-RETUNE.md's Identity commit
 * section for the derivation. Not draw-based — reads content/classes.js's
 * static dice tables only.
 */
export function heroMeanMaxWpFor(level) {
  const meanDice = (d) => (d.n * (d.sides + 1)) / 2 + d.bonus;
  const classMean = (cls) => {
    let wp = CLASSES[cls].baseWP.base + meanDice(CLASSES[cls].baseWP.dice);
    for (let lvl = 2; lvl <= level; lvl++) wp += meanDice(CLASSES[cls].gain[lvl - 1]);
    return wp;
  };
  const classes = Object.keys(CLASSES);
  const total = classes.reduce((sum, cls) => sum + classMean(cls), 0);
  return (total / classes.length) * live.HERO_HP_SCALE;
}

/**
 * roundDamageCapFor(level) — USER RULING D: the ROUND_DAMAGE_CEILING dial,
 * evaluated against the level-appropriate MEAN hero's max HP. `Infinity`
 * (no clamp) at the identity value (0, off) — every cliff (Werebeast,
 * Dante, Drake, Herman) stays exactly as lethal as canon until this dial is
 * released.
 */
export function roundDamageCapFor(level) {
  return live.ROUND_DAMAGE_CEILING > 0 ? Math.max(1, Math.round(live.ROUND_DAMAGE_CEILING * heroMeanMaxWpFor(level))) : Infinity;
}

/**
 * heroMaxWpFor(rolled, cls) — HERO_HP_SCALE (and the class's own
 * CLASS_MITIGATION.hpMul, identity 1) applied to a chargen roll OR a
 * level-up gain. The strict `=== 1` fast path keeps identity structural.
 */
export function heroMaxWpFor(rolled, cls) {
  const classMit = live.CLASS_MITIGATION[cls];
  const m = live.HERO_HP_SCALE * ((classMit && classMit.hpMul) || 1);
  return m === 1 ? rolled : Math.max(1, Math.round(rolled * m));
}

/**
 * heroRegenFor(maxWP) — HERO_REGEN_PER_FLOOR, evaluated once per floor
 * arrival (engine/movement.js#descend, hero only). 0 at identity (no
 * regen).
 */
export function heroRegenFor(maxWP) {
  return live.HERO_REGEN_PER_FLOOR === 0 ? 0 : Math.max(0, Math.round(live.HERO_REGEN_PER_FLOOR * maxWP));
}

/**
 * heroSpFor(amount) — HERO_SP_SCALE applied to every SP grant (kill share,
 * parley, the descend bonus, the table-four XP dots). Identity `=== 1` fast
 * path returns `amount` unchanged.
 */
export function heroSpFor(amount) {
  return live.HERO_SP_SCALE === 1 ? amount : Math.round(amount * live.HERO_SP_SCALE);
}

/**
 * campHealFor(maxWP, d10) — CAMP_HEAL_FRACTION, keeping the SAME d10 draw in
 * the SAME position as canon's `d10 + 2*level` (re-centered: `-5` keeps the
 * variance term zero-mean around the fraction term). `Math.max(1, ...)`
 * guarantees a fed night always heals at least 1 hp.
 */
export function campHealFor(maxWP, d10) {
  return Math.max(1, Math.round(live.CAMP_HEAL_FRACTION * maxWP) + d10 - 5);
}

/**
 * dotHpFor(kind) — Table-4's ±HP dots (`kind` in "small" | "mid" | "large"),
 * DOT_HP_BASE's flat canon value scaled ONCE by live.HERO_HP_SCALE — USER
 * RULING G: never a fraction of the hero's OWN (mutable) maxWP, which is
 * what let the "+25 HP" row compound (see DOT_HP_BASE's own JSDoc).
 * `Math.max(1, ...)` guarantees a dot never rounds to 0. The strict `=== 1`
 * fast path keeps HERO_HP_SCALE identity structural.
 */
export function dotHpFor(kind) {
  return live.HERO_HP_SCALE === 1 ? DOT_HP_BASE[kind] : Math.max(1, Math.round(DOT_HP_BASE[kind] * live.HERO_HP_SCALE));
}

/**
 * startingRationsFor(canon) — FOOD_CLOCK applied to the class's canon
 * starting-ration count. Identity `=== 1` fast path returns `canon`
 * unchanged.
 */
export function startingRationsFor(canon) {
  return live.FOOD_CLOCK === 1 ? canon : Math.max(1, Math.round(canon * live.FOOD_CLOCK));
}

// --- 54-06 (BAND-02, USER RULING D): economy / class / accuracy / exposed
// dial helpers. Every one below is a pure function of `live` (+ its
// arguments) with a strict `=== 1` / `=== 0` structural identity fast path —
// zero rng, zero DOM, zero mutation.

/**
 * lootFor(coin) — LOOT_SCALE, applied POST-DRAW at the four coin sites (the
 * kill purse — engine/combat.js#killFoe, the chest and the wilmst cache —
 * engine/encounters.js#openChest/#tableFour, and the faerie's d10x100 —
 * engine/encounters.js#meetFaerie). Never applied to the Pickpocket extra,
 * the cutpurse ability, the grimoire's flat 150, or the dev-start purse
 * (engine/items.js#gainWilmst itself is untouched). Identity: 1 (canon).
 * Direction: up = easier (more coin per source).
 */
export function lootFor(coin) {
  return live.LOOT_SCALE === 1 ? coin : Math.round(coin * live.LOOT_SCALE);
}

/**
 * foeAccuracyFor() — FOE_ACCURACY, an integer added to the foe's to-hit
 * need at both foeToHitVs/foeToHitBreakdown call sites (vs "hero" AND
 * "member" — engine/derived.js). The `Math.max(1, h)` floor in both
 * functions is respected as-is; this helper only ever contributes the raw
 * delta. Identity: 0 (canon, no modifier). Direction: up = harder (the foe
 * is more likely to land a blow).
 */
export function foeAccuracyFor() {
  return live.FOE_ACCURACY;
}

/**
 * classEvasionFor(c) — CLASS_MITIGATION.Thief.evasion, subtracted from the
 * foe's to-hit need ONLY for `vs === "hero"` (the hero's own body, never a
 * party member) and ONLY for a Thief (engine/derived.js#foeToHitVs/
 * #foeToHitBreakdown). Identity: 0 (canon). Direction: up = the Thief is
 * harder to hit (the foe lands on fewer faces); the first candidate manual
 * notch is +1. Phase 72, ROLL-01 (d), user ruling 2026-09-24 — a positive
 * evasion value now makes the Thief harder to hit, not easier.
 */
export function classEvasionFor(c) {
  if (!c || c.cls !== "Thief") return 0;
  const t = live.CLASS_MITIGATION.Thief;
  return (t && t.evasion) || 0;
}

/**
 * classTrapAvoidFor(c) — CLASS_MITIGATION.Thief.trapAvoid, added to
 * engine/encounters.js#springTrap's dodge threshold (`nimble`) for a Thief
 * only. Identity: 0 (canon). Direction: up = easier (a higher dodge
 * threshold means more d20 faces avoid the trap).
 */
export function classTrapAvoidFor(c) {
  if (!c || c.cls !== "Thief") return 0;
  const t = live.CLASS_MITIGATION.Thief;
  return (t && t.trapAvoid) || 0;
}

/**
 * classKillSpeedFor(c, { opener }) — CLASS_MITIGATION's per-class combat-
 * speed multiplier, ONE call site covering BOTH rows (engine/combat.js
 * #playerStrike, right after the crit doubling): a Thief's killSpeed
 * applies ONLY to the opening backstab strike (`opener: critBy ===
 * "backstab"`); a Fighter's killSpeed applies to EVERY melee strike
 * regardless of `opener`. Every other class returns 1 (untouched). Identity:
 * 1 for both rows (canon). Direction: per row — a Thief's killSpeed >= 1
 * (faster opener), a Fighter's <= 1 (slower per-swing, canon combat-speed
 * design intent per the dial table).
 */
export function classKillSpeedFor(c, { opener = false } = {}) {
  if (!c) return 1;
  const classMit = live.CLASS_MITIGATION[c.cls];
  if (!classMit) return 1;
  if (c.cls === "Thief") return opener ? classMit.killSpeed : 1;
  if (c.cls === "Fighter") return classMit.killSpeed;
  return 1;
}

/**
 * classArmorMulFor(c) — CLASS_MITIGATION.Fighter.armorMul, read by
 * engine/derived.js#armorSoak on the `ar` (soak-roll target number) it
 * returns — Fighter only. Identity: 1 (canon). Direction: up = a Fighter
 * soaks more often (easier).
 */
export function classArmorMulFor(c) {
  if (!c || c.cls !== "Fighter") return 1;
  const f = live.CLASS_MITIGATION.Fighter;
  return (f && f.armorMul) || 1;
}

/**
 * spellPowerFor(c) — CLASS_MITIGATION["Magic User"].spellPower, the
 * multiplier `spellDamageFor` (below) applies. Magic User only — every other
 * class returns 1. Identity: 1 (canon). Direction: up = harder (an MU's
 * offensive spells hit harder).
 */
export function spellPowerFor(c) {
  if (!c || c.cls !== "Magic User") return 1;
  const m = live.CLASS_MITIGATION["Magic User"];
  return (m && m.spellPower) || 1;
}

/**
 * spellDamageFor(n, c) — engine/magic.js's ONE offensive-spell-damage
 * scaling helper: every rolled offensive amount (the stun spell's affected-
 * count roll, the quake/volley/thrown bolt damage) flows through this before
 * (quake/volley/thrown) or in place of (stun) any further post-roll
 * arithmetic (afraidDamage, etc). Healing and self-inflicted backfire
 * damage are NEVER scaled (spellPowerFor is an offensive-only lever).
 * Identity `=== 1` fast path returns `n` unchanged; otherwise rounds and
 * floors at 0 (never negative).
 */
export function spellDamageFor(n, c) {
  const p = spellPowerFor(c);
  return p === 1 ? n : Math.max(0, Math.round(n * p));
}

/**
 * fleeNeedModFor() — FLEE_NEED_MOD, added to content/flee.js#FLEE_NEED
 * inside engine/derived.js#fleeBreakdown's returned `need`. Identity: 0
 * (canon). Direction: up = harder (a higher need means fewer rolls clear
 * it).
 */
export function fleeNeedModFor() {
  return live.FLEE_NEED_MOD;
}

/**
 * parleyNeedModFor() — PARLEY_NEED_MOD, subtracted from engine/combat.js
 * #parley's `need` (after its own `Math.min(9 + bonus, 17)` ceiling), since
 * parley succeeds on `roll <= need`. Identity: 0 (canon). Direction: up =
 * harder (fewer faces succeed). Phase 72 (ROLL-01, finding F5): was
 * mistakenly ADDED, which made a positive value easier — fixed to match
 * this JSDoc's own documented direction.
 */
export function parleyNeedModFor() {
  return live.PARLEY_NEED_MOD;
}

/**
 * startingGoldFor() — STARTING_GOLD, engine/character.js#rollCharacter's
 * chargen `gold` field. Identity: 50 (canon). Direction: up = easier.
 */
export function startingGoldFor() {
  return live.STARTING_GOLD;
}

/**
 * startingPotionsFor(canon) — STARTING_POTION_BONUS, added to the class's
 * canon starting-potion roll (engine/character.js#rollCharacter). Floored at
 * 0 (a negative bonus can never produce a negative potion count). Identity:
 * 0 (canon, `+0`). Direction: up = easier.
 */
export function startingPotionsFor(canon) {
  return Math.max(0, canon + live.STARTING_POTION_BONUS);
}

// --- 54-06 (BAND-02, USER RULING D): the late dials with the SAME draw
// counts as today — DOT_MIX/FIGHT_SHARE (the encounter-table d8xd10 remap,
// post-roll, no third draw) and WANDER_RATE (the wake-check face count, the
// eight d20 draws unchanged).

/**
 * DOT_MIX_FAMILIES — every one of ENCOUNTER_TABLES' 80 cells belongs to
 * EXACTLY one family (pinned by test): `fight` (the six monster-type
 * strings ENC_ALIAS resolves — 43 of 80, FIGHT_SHARE = DOT_MIX.fight),
 * `harm` (the -HP/status rows), `loot` (the treasure rows), `help` (food/
 * store/joiner/+HP/+XP). "Teleport" is listed for completeness even though
 * content/encounters.js's header documents its removal from every live cell
 * (0 occurrences today — a future content change could reintroduce it
 * without this table needing an update).
 */
export const DOT_MIX_FAMILIES = Object.freeze({
  fight: Object.freeze(["Lair Beast", "Magical", "Beasts", "Humans", "Walking Dead", "Demons"]),
  harm: Object.freeze(["-10 HP", "-15 HP", "-All armour", "Ailment", "Insanity", "Phobia", "Darkness", "Teleport"]),
  loot: Object.freeze(["Weapon", "Magic Weapon", "Magic Armor", "Misc Magic", "Grimoire", "wilmst cache", "Faerie"]),
  help: Object.freeze(["Food", "Store", "Joiner", "+10 HP", "+25 HP", "+10 XP", "+25 XP"]),
});

/** familyOf(cell) — which DOT_MIX_FAMILIES bucket a raw ENCOUNTER_TABLES
 * cell string belongs to, or `null` for an unrecognized cell (defensive —
 * every real cell is covered, pinned by test). Not exported — internal. */
function familyOf(cell) {
  for (const name of Object.keys(DOT_MIX_FAMILIES)) {
    if (DOT_MIX_FAMILIES[name].includes(cell)) return name;
  }
  return null;
}

/**
 * conversionTableFor(mix) — USER RULING D / 54-06: the ONE encounter-mix
 * remap, memoised on `mix`'s own object identity (so repeated calls against
 * the SAME live.DOT_MIX object are free, and the table is byte-identical
 * across calls — `conversionTableFor` called twice on the same `mix` MUST
 * return equal Maps). At every family ratio === 1 (or undefined) the
 * returned Map is EMPTY — structural identity, zero conversions.
 *
 * For a family `f` with `mix[f] < 1` ("shrink f"): `k = round((1 - mix[f])
 * * n_f)` of family `f`'s own cells, taken in ROW-MAJOR order (row 0's
 * columns left to right, then row 1, ...), are each converted to the NEXT
 * cell to the right in the SAME ROW (wrapping) that is NOT of family `f` —
 * the family's own footprint shrinks toward its row-neighbours.
 *
 * For a family `f` with `mix[f] > 1` ("grow f"): `k = round((mix[f] - 1) *
 * n_f)` cells are converted TO family `f`, sourced row by row (row-major):
 * within each row, the DOMINANT non-`f` family present (most cells, ties
 * broken by DOT_MIX_FAMILIES's own key order) donates its cells (left to
 * right first); each donated cell becomes the nearest `f`-family cell to
 * its right in that row (wrapping). A row with no `f` cell to copy from (or
 * no non-`f` cell to donate) is skipped — the walk continues into the next
 * row until `k` conversions land or every row has been tried.
 */
const conversionCache = new WeakMap();

export function conversionTableFor(mix) {
  const cached = conversionCache.get(mix);
  if (cached) return cached;
  const table = new Map();
  for (const family of Object.keys(DOT_MIX_FAMILIES)) {
    const ratio = mix[family];
    if (ratio === undefined || ratio === 1) continue;
    const members = DOT_MIX_FAMILIES[family];

    if (ratio < 1) {
      const cellsOfFamily = [];
      ENCOUNTER_TABLES.forEach((row, t) => {
        row.forEach((cell, r) => {
          if (members.includes(cell)) cellsOfFamily.push({ t, r });
        });
      });
      const k = Math.round((1 - ratio) * cellsOfFamily.length);
      let converted = 0;
      for (const { t, r } of cellsOfFamily) {
        if (converted >= k) break;
        const row = ENCOUNTER_TABLES[t];
        let rr = (r + 1) % row.length;
        let steps = 0;
        while (members.includes(row[rr]) && steps < row.length) {
          rr = (rr + 1) % row.length;
          steps++;
        }
        if (members.includes(row[rr])) continue; // defensive: an all-family row has no valid target
        table.set(`${t},${r}`, row[rr]);
        converted++;
      }
    } else {
      let cellsOfFamily = 0;
      ENCOUNTER_TABLES.forEach((row) => row.forEach((cell) => { if (members.includes(cell)) cellsOfFamily++; }));
      const k = Math.round((ratio - 1) * cellsOfFamily);
      let converted = 0;
      for (let t = 0; t < ENCOUNTER_TABLES.length && converted < k; t++) {
        const row = ENCOUNTER_TABLES[t];
        const familyPositions = [];
        row.forEach((cell, r) => {
          if (members.includes(cell)) familyPositions.push(r);
        });
        if (!familyPositions.length) continue; // nothing in this row to copy toward
        const counts = {};
        row.forEach((cell) => {
          if (members.includes(cell)) return;
          const fam = familyOf(cell);
          if (fam) counts[fam] = (counts[fam] || 0) + 1;
        });
        const dominant = Object.keys(DOT_MIX_FAMILIES)
          .filter((f) => f !== family && counts[f])
          .reduce((best, f) => (best === null || counts[f] > counts[best] ? f : best), null);
        if (!dominant) continue;
        const dominantMembers = DOT_MIX_FAMILIES[dominant];
        for (let r = 0; r < row.length && converted < k; r++) {
          if (!dominantMembers.includes(row[r])) continue;
          let rr = (r + 1) % row.length;
          let steps = 0;
          while (!familyPositions.includes(rr) && steps < row.length) {
            rr = (rr + 1) % row.length;
            steps++;
          }
          if (!familyPositions.includes(rr)) continue;
          table.set(`${t},${r}`, row[rr]);
          converted++;
        }
      }
    }
  }
  conversionCache.set(mix, table);
  return table;
}

/**
 * remapEncounterResult(t, r, result) — engine/encounters.js#encounterDot's
 * ONE remap hook, called AFTER both draws (the d8 table index `t` [1-based]
 * and the d10 cell index `r` [1-based]) with the cell's own already-resolved
 * `result` string. Zero new draws — a pure lookup against
 * `conversionTableFor(live.DOT_MIX)`, keyed by the SAME zero-based
 * `(t-1, r-1)` coordinates the table itself uses.
 */
export function remapEncounterResult(t, r, result) {
  return conversionTableFor(live.DOT_MIX).get(`${t - 1},${r - 1}`) ?? result;
}

/**
 * wanderWakeFacesFor(sub) — WANDER_RATE, the d20 face count (out of the
 * SAME eight per-hour draws newDay already makes) that wakes a sleeping
 * party to a wandering-monster fight. A Bard's canon +1 face is additive on
 * TOP of the dial, capped at 20 (a d20's own ceiling) — the multiplier form
 * this dial could have taken would double a Bard's bonus too, which canon
 * never intended.
 */
export function wanderWakeFacesFor(sub) {
  const base = live.WANDER_RATE;
  return sub === "Bard" ? Math.min(20, base + 1) : base;
}

/**
 * difficultyCurve(depth) — the single source of truth every consumer reads.
 * Pure function of `depth` only: no RNG parameter, no RNG consumed, no side
 * effects, no module-level mutable state besides the harness-only `live`
 * override above. Returns the 12-key global shape (USER RULING D — no
 * `mazeSize` field; MAZE_SIZE is cut from Phase 54, GW/GH stay 21):
 *   - depth: the clamped, effective integer depth used to compute this curve
 *   - breather: whether this is a BREATHER_EVERY breather floor
 *   - dots: encounter-dot count (ENCOUNTER_DOTS, floored to `base` on a
 *     breather floor)
 *   - darkBlobs: dark-zone blob count (DARK_BLOBS, clamped to
 *     DARK_BLOB_CAP; zeroed on a breather floor)
 *   - darkRadius: per-blob BFS reveal radius (DARK_RADIUS, clamped to
 *     DARK_RADIUS_CAP)
 *   - waterPools: Phase 41 (TERR-01) — unchanged formula
 *   - storeTier: STORE_TIER, clamped 0..3 (54-06 consumer)
 *   - foeLevel: foeLevelFor(d)
 *   - foeHitScale: FOE_HIT_SCALE evaluated at d
 *   - foeHpScale: FOE_HP_SCALE evaluated at d
 *   - hazardScale: HAZARD_SCALE evaluated at d
 *   - abilityThreat: ABILITY_THREAT evaluated at d
 */
export function difficultyCurve(depth) {
  const d = safeDepth(depth);
  const breather = isBreatherOfSafeDepth(d);

  const dots = breather ? live.ENCOUNTER_DOTS.base : Math.max(1, Math.round(live.ENCOUNTER_DOTS.base + live.ENCOUNTER_DOTS.perDepth * d));

  const darkBlobs = breather
    ? 0
    : Math.max(0, Math.min(live.DARK_BLOB_CAP, Math.round(live.DARK_BLOBS.base + live.DARK_BLOBS.perDepth * d)));

  const darkRadius = Math.min(Math.round(live.DARK_RADIUS.base + live.DARK_RADIUS.perDepth * d), live.DARK_RADIUS_CAP);

  const waterPools = breather
    ? WATER_POOL_MIN
    : Math.min(WATER_POOL_MIN + Math.floor((d - 1) / WATER_POOL_GROWTH_EVERY), WATER_POOL_CAP);

  const storeTier = Math.max(0, Math.min(3, Math.round(live.STORE_TIER.base + live.STORE_TIER.perDepth * d)));

  return {
    depth: d,
    breather,
    dots,
    darkBlobs,
    darkRadius,
    waterPools,
    storeTier,
    foeLevel: foeLevelFor(d),
    foeHitScale: scaleField(live.FOE_HIT_SCALE, d),
    foeHpScale: scaleField(live.FOE_HP_SCALE, d),
    hazardScale: scaleField(live.HAZARD_SCALE, d),
    abilityThreat: scaleField(live.ABILITY_THREAT, d),
  };
}

/**
 * scaleHazard(amount, curve) — post-draw trap/wall-fall damage scaling. The
 * strict `=== 1` fast path makes identity structural; `amount <= 0` is
 * passed through unscaled. Zero rng draws either way — pure arithmetic on
 * an already-rolled number.
 */
export function scaleHazard(amount, curve) {
  return curve.hazardScale === 1 || amount <= 0 ? amount : Math.max(1, Math.round(amount * curve.hazardScale));
}

/**
 * abilityCadenceFor(a, curve) — scales a kit descriptor's `every`/`uses` by
 * the curve's `abilityThreat`. At `abilityThreat === 1` both fields are the
 * descriptor's own numbers (`undefined` stays `undefined`).
 */
export function abilityCadenceFor(a, curve) {
  const t = curve.abilityThreat;
  return {
    every: a.every === undefined ? undefined : Math.max(1, Math.round(a.every / t)),
    uses: a.uses === undefined ? undefined : Math.max(1, Math.round(a.uses * t)),
  };
}
