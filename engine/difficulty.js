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

/**
 * deepFreeze(obj) — Object.freeze is shallow; DIALS carries nested
 * `{ base, perDepth }` / `DOT_HP_FRACTION` / `DOT_MIX` / `CLASS_MITIGATION`
 * objects that must be just as immutable as their parent. Not exported —
 * internal helper only.
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
   * the moment the hero out-leveled the dungeon, around floor 3). Landed at
   * the starting map `{ base: 0.6, perDepth: 0.2 }`, whose map(1) = 1 keeps
   * every floor-1 fight identical to canon (parity). Direction: ↑ = harder
   * (foes hit like a higher tier sooner). */
  FOE_LEVEL: { base: 0.6, perDepth: 0.2 },
  /** TIER_SPREAD — the d4 "one tier lower" bleed threshold (canon: a roll of
   * 1 on a d4 knocks the tier down by one). Identity: 1 (unchanged from
   * canon `rng.d(4) === 1`). Direction: ↑ = more low-tier bleed (softer). */
  TIER_SPREAD: 1,
  /** FOE_HIT_SCALE — scales the WHOLE foe hit (`foeLevelBase + dice`, crit
   * included) at the hero/member/pursuit sites, post-roll. Identity:
   * `{ base: 1, perDepth: 0 }` (canon — the dominant damage term untouched).
   * Direction: ↑ = harder. */
  FOE_HIT_SCALE: { base: 1, perDepth: 0 },
  /** FOE_HP_SCALE — scales a foe's starting wp/maxWP at copy time. Identity:
   * `{ base: 1, perDepth: 0 }`. Direction: ↑ = longer fights (harder). */
  FOE_HP_SCALE: { base: 1, perDepth: 0 },
  /** FOE_COUNT_SKEW — an index into FOE_COUNT_TABLE (below) shifting
   * P(1/2/3 foes) once the canon d4 roll is > 2; row 0 is canon. Identity: 0
   * (canon draw shape, no level-keyed cap). Direction: ↑ = more bodies. */
  FOE_COUNT_SKEW: 0,
  /** ROUND_DAMAGE_CEILING — a fraction of a level-appropriate hero's MEAN
   * max HP that ONE foe may deal per foeTurn visit, across all its swings
   * (frenzy/sp.atk included); 0 = off. Identity: 0 (no ceiling — canon
   * cliffs stay cliffs until this dial is released). Direction: ↑ = a
   * softer ceiling (0 is the hardest/uncapped setting; a small positive
   * value is SOFTER than 0). */
  ROUND_DAMAGE_CEILING: 0,
  /** ABILITY_THREAT — the caster-cadence scalar (abilityCadenceFor).
   * Identity: `{ base: 1, perDepth: 0 }`. Direction: ↑ = casters act more
   * often (harder). */
  ABILITY_THREAT: { base: 1, perDepth: 0 },
  /** HERO_HP_SCALE — multiplies the hero's rolled maxWP at chargen AND every
   * level-up gain (through `heroMaxWpFor`, which also folds in a class's
   * CLASS_MITIGATION.hpMul). Identity: 1 (canon). Direction: ↑ = tankier
   * hero (easier). */
  HERO_HP_SCALE: 1,
  /** HERO_REGEN_PER_FLOOR — a fraction of maxWP restored once, on arriving
   * at a new floor (`descend`, hero only). Identity: 0 (no regen — canon has
   * none). Direction: ↑ = easier. */
  HERO_REGEN_PER_FLOOR: 0,
  /** HERO_SP_SCALE — scales every SP grant (kill share, parley, the descend
   * bonus, the table-four +10/+25 XP dots). Identity: 1 (canon). Direction:
   * ↑ = faster leveling (paces HERO_HP_SCALE's payoff sooner). */
  HERO_SP_SCALE: 1,
  /** CAMP_HEAL_FRACTION — a rested night heals `round(fraction * maxWP) +
   * d10 - 5` (the SAME d10 draw canon always made, re-centered). No
   * identity exists (canon was `d10 + 2*level`, a level term, not a
   * fraction of maxWP) — mean-matched at level 1: mean maxWP 41.67, so
   * `round(0.17 * 41.67) + d10 - 5` has mean 7.6 vs canon's `d10 + 2` mean
   * 7.5. Direction: ↑ = easier. */
  CAMP_HEAL_FRACTION: 0.17,
  /** DOT_HP_FRACTION — Table-4's ±HP dots (p.45) as fractions of the hero's
   * OWN maxWP (small/mid/large), so a dot is the same relative risk on every
   * floor, at every hero HP scale. No identity exists (canon was flat 10 /
   * 15 / 25) — mean-matched at level 1 (÷ 41.67): 10/41.67≈0.24,
   * 15/41.67≈0.36, 25/41.67≈0.6. Direction: n/a (a risk/reward dot, not a
   * monotone difficulty axis). */
  DOT_HP_FRACTION: { small: 0.24, mid: 0.36, large: 0.6 },
  /** FOOD_CLOCK — a multiplier on the class's canon starting-ration count.
   * Identity: 1 (canon). Direction: ↑ = more starting rations (easier). */
  FOOD_CLOCK: 1,
  /** ENCOUNTER_DOTS — `{ base, perDepth }`; non-breather dots =
   * `round(base + perDepth*depth)`. Identity: `{ base: 9, perDepth: 1 }`
   * (= canon `9 + depth`, no cap). Direction: ↑ = more attrition
   * (harder). */
  ENCOUNTER_DOTS: { base: 9, perDepth: 1 },
  /** HAZARD_SCALE — post-draw fall/trap/leap damage scale (scaleHazard),
   * floor 1 included. Identity: `{ base: 1, perDepth: 0 }` (canon).
   * Direction: ↑ = harder. */
  HAZARD_SCALE: { base: 1, perDepth: 0 },
  /** DARK_BLOBS — `{ base, perDepth }`, `clamp(round(base+perDepth*depth), 0,
   * DARK_BLOB_CAP)` on a non-breather floor (0 on a breather). Identity:
   * `{ base: -0.4, perDepth: 0.7 }` reproduces canon's floors 1/2/4/5+
   * exactly; floor 3 reads 2 where the retired floor-hold ramp (see this
   * module's header history paragraph) used to read 1 (not fixture-exposed).
   * Direction: ↑ = more darkness (harder). */
  DARK_BLOBS: { base: -0.4, perDepth: 0.7 },
  /** DARK_BLOB_CAP — the hard ceiling on darkBlobs. Identity: 3 (canon). */
  DARK_BLOB_CAP: 3,
  /** DARK_RADIUS — `{ base, perDepth }`, `min(round(base+perDepth*depth),
   * DARK_RADIUS_CAP)`. Identity: `{ base: 3, perDepth: 1 }` (= canon
   * `3+depth`, capped). Direction: ↑ = larger dark zones (harder). */
  DARK_RADIUS: { base: 3, perDepth: 1 },
  /** DARK_RADIUS_CAP — the hard ceiling on darkRadius. Identity: 7
   * (= today exactly — the Phase 27 easing value, kept as this dial's
   * identity since it is what every current save/fixture already sees). */
  DARK_RADIUS_CAP: 7,
  /** STORE_TIER — `{ base, perDepth }`, `clamp(round(base+perDepth*depth),
   * 0, 3)`; reproduces today's BAG_FLOORS ladder exactly (map 1..12 =
   * "011122223333"). Consumer hook lands in 54-06. Identity:
   * `{ base: 0, perDepth: 0.3 }`. Direction: ↑ = richer stores sooner
   * (easier economy). */
  STORE_TIER: { base: 0, perDepth: 0.3 },
  /** LOOT_SCALE — 54-06's economy multiplier (gold/treasure). Identity: 1
   * (canon). Held at identity this plan; consumer hook lands in 54-06. */
  LOOT_SCALE: 1,
  /** FOE_ACCURACY — 54-06's to-hit modifier. Identity: 0 (canon, no
   * modifier). Held at identity this plan. */
  FOE_ACCURACY: 0,
  /** DOT_MIX — 54-06's Table-4 category weighting (fight/harm/loot/help).
   * Identity: all 1.0 (canon mix). Held at identity this plan. */
  DOT_MIX: { fight: 1, harm: 1, loot: 1, help: 1 },
  /** WANDER_RATE — 54-06's wandering-monster check multiplier. Identity: 1
   * (canon). Held at identity this plan. */
  WANDER_RATE: 1,
  /** FLEE_NEED_MOD — 54-06's flee-roll modifier. Identity: 0 (canon). Held
   * at identity this plan. */
  FLEE_NEED_MOD: 0,
  /** PARLEY_NEED_MOD — 54-06's parley-roll modifier. Identity: 0 (canon).
   * Held at identity this plan. */
  PARLEY_NEED_MOD: 0,
  /** STARTING_GOLD — 54-06's chargen gold. Identity: 50 (canon). Held at
   * identity this plan. */
  STARTING_GOLD: 50,
  /** STARTING_POTION_BONUS — 54-06's chargen potion bonus. Identity: 0
   * (canon). Held at identity this plan. */
  STARTING_POTION_BONUS: 0,
  /** CLASS_MITIGATION — 54-06's per-class mitigation rows; `Fighter.hpMul`
   * is already read by `heroMaxWpFor` below (identity 1, a no-op multiplier
   * on top of HERO_HP_SCALE). `Thief.fleeBonus` is seeded from
   * content/flee.js's own canon `FLEE_THIEF_BONUS` (5) so this table is
   * never out of sync with the existing flee-modifier table it will one day
   * replace. Held at identity this plan; every other consumer hook lands in
   * 54-06. */
  CLASS_MITIGATION: {
    Fighter: { hpMul: 1, armorMul: 1, killSpeed: 1 },
    Thief: { evasion: 0, fleeBonus: FLEE_THIEF_BONUS, trapAvoid: 0, killSpeed: 1 },
    "Magic User": { spellPower: 1 },
  },
});

/** Every BREATHER_EVERY-th floor after floor 1 is a lighter "breather" floor. */
export const BREATHER_EVERY = 5;

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
 * what makes FOE_HIT_SCALE/FOE_HP_SCALE/HAZARD_SCALE/ABILITY_THREAT's
 * identity column structural, not a rounding accident). Not exported —
 * internal helper only.
 */
function scaleField(dial, d) {
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
 * foeCountFor(firstRoll, drawSecond) — USER RULING D: replaces the retired
 * level-keyed `cap = c.level <= 2 ? 2 : 3` ternary chain with a weighted
 * pick that keeps the CANON DRAW SHAPE verbatim: `drawSecond` (a thunk) is
 * called ONLY when `firstRoll > 2` — one d4 on the common path, two only
 * when the first roll warrants it, exactly like the retired
 * `rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3` ternary.
 */
export function foeCountFor(firstRoll, drawSecond) {
  if (firstRoll <= 2) return 1;
  return FOE_COUNT_TABLE[live.FOE_COUNT_SKEW][drawSecond() - 1];
}

/**
 * foeWpFor(baseWp, curve) — copy-time wp/maxWP scaling. The strict `=== 1`
 * fast path (via curve.foeHpScale) makes identity structural even for a
 * non-integer wp.
 */
export function foeWpFor(baseWp, curve) {
  return curve.foeHpScale === 1 ? baseWp : Math.max(1, Math.round(baseWp * curve.foeHpScale));
}

/**
 * foeHitFor(raw, curve) — USER RULING D: scales the WHOLE foe hit
 * (`foeLevelBase(f) + (crit ? 2*dice : dice)`) at the hero/member/pursuit
 * damage sites, replacing the retired flat-bonus helper this module's header
 * history paragraph names (which only scaled the `lvl^2` term, leaving the
 * dominant dice terms — Werebeast 2xd10, Dante x3, Drake 2d10+4 —
 * untouched, so the old ladder saturated).
 */
export function foeHitFor(raw, curve) {
  return curve.foeHitScale === 1 ? raw : Math.max(1, Math.round(raw * curve.foeHitScale));
}

/**
 * heroMeanMaxWpFor(level) — the unweighted mean, over the three CLASSES, of
 * a level-`level` hero's maxWP at HERO_HP_SCALE 1 (the level-appropriate
 * "mean hero" ROUND_DAMAGE_CEILING/CAMP_HEAL_FRACTION/DOT_HP_FRACTION are
 * mean-matched against). Pinned: 41.67 / 46.17 / 50.00 / 54.50 / 60.00 for
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
 * dotHpFor(kind, maxWP) — Table-4's ±HP dots as a fraction of the hero's OWN
 * maxWP (`kind` in "small" | "mid" | "large"). `Math.max(1, ...)` guarantees
 * a dot never rounds to 0.
 */
export function dotHpFor(kind, maxWP) {
  return Math.max(1, Math.round(live.DOT_HP_FRACTION[kind] * maxWP));
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
 * classEvasionFor(c) — CLASS_MITIGATION.Thief.evasion, added to the foe's
 * to-hit need ONLY for `vs === "hero"` (the hero's own body, never a party
 * member) and ONLY for a Thief (engine/derived.js#foeToHitVs/
 * #foeToHitBreakdown). Identity: 0 (canon). Direction: negative = easier to
 * dodge (the first candidate manual notch is -1 — "the base Thief has no
 * innate evasion today").
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
 * parleyNeedModFor() — PARLEY_NEED_MOD, added to engine/combat.js#parley's
 * `need` (after its own `Math.min(9 + bonus, 17)` ceiling). Identity: 0
 * (canon). Direction: up = harder.
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
