// engine/combat.js
//
// The combat domain (ENG-01, ENG-05) — the heaviest rule domain in the maze.
// Ports mazeworld.html's encounter setup, initiative, player strikes, kills,
// foe turns, allies, and the flee/parley/sing exits (lines 2257-2903),
// replacing every D()/pick()-backed Math.random() draw with the injected
// engine rng (in the prototype's exact consumption order — including its
// short-circuiting ternary re-rolls) and every say()/evt() narration call
// with a pushed `{type, ...}` event. No DOM, no localStorage, no Math.random,
// no global S — every function here takes an explicit `state` (already a
// fresh applyAction clone) and mutates it directly, matching the applyAction
// seam.
//
// castSpell (magic) is its own rule domain and is intentionally NOT ported
// here — Wizard's spell-refusal check and the "magic user in combat" gates
// are preserved verbatim (they read `c.spellsUsed`/`maxCharges`, which exist
// on every character regardless of whether a spell has ever been cast), but
// no spell effect itself (ward/regen/mirror/weaken/etc.) is SET by anything
// in this module — those fields simply stay at their rollCharacter defaults
// until a later magic-domain plan lands castSpell. foeTurn/playerStrike still
// faithfully READ them (c.ward, c.regen, c.mirror, C.weakened,
// C.foeToHitPenalty) so combat is correct once magic lands, without this
// plan needing to implement magic itself.
//
// Most BESTIARY creature `sp.*` flags (poison/disease/steals/enthrall/awe/
// grapple/entangle/possess/raise/shriek/quills/loot/song/pack/
// age/pursues/seesInvis/noTurn/never_melee/dark/
// caster/breaks/every, etc.) are flavor-only in the frozen prototype — grep
// confirms none of them are ever read anywhere in mazeworld.html's live
// logic (only `sp.note` feeds the UI). Only `sp.atk`, `sp.dmg`, `sp.toHit`,
// `sp.fast`, `sp.magicOnly`, `sp.noArmor`, `sp.twice` (via `lives`),
// `sp.shatterOnBest` (Phase 72, ROLL-01 (c) — see shatterIfBest below),
// `sp.daggerOnly` (Phase 72, ROLL-01, finding F3 — the Shadow's "only a
// dagger or magic touches it" was inert in the frozen prototype; a DECLARED
// CANON DIVERGENCE makes it real, mirroring magicOnly exactly), and —
// since Phase 52 (DMG-02) — `sp.strikesAs` have any mechanical effect, and
// this module implements exactly those, matching
// the prototype's ACTUAL behavior rather than the aspirational flavor text
// (fidelity rule: port what the prototype DOES, not what its comments imply).
// Since Phase 18 (CANON-01/03/05), `sp.ar` and `sp.halfDmg` (plus the
// CANON-04 damage-source x creature-type multipliers) are applied by
// engine/foeDamage.js#damageFoe, and `sp.slow` by playerStrike's to-hit
// roll below — every other flag in the list above stays flavor-only until
// Phase 19.
//
// Since Phase 19 (FOE-01..09, CANON-02), a handful more of those flags turn
// mechanical: the `abilities` kit (content/foe-abilities.js ids, resolved by
// engine/foeAbilities.js), `never_melee` (the caster never falls back to a
// swing), `pursues` (a Spectre-style flee-punishing melee strike, see
// `pursuitStrike` below), and `fleesBelow` (a caster who leaves the fight
// once its own wp drops under a fraction of maxWP). The Drake's cooldown is
// read from the drakeBreath descriptor's own `every` field
// (content/foe-abilities.js) — `sp.every` on the bestiary row stays inert,
// unread by any engine code. `sp.caster` remains exactly what it always
// was: an inert flavor flag.

import { healBonusFor, wardBonusFor, skill, eff, strikeDie, toHit, toHitBreakdown, weaponDamage, foeDie, darkLimited, armorSoak, DEATH_PANIC_THRESHOLD, AFRAID_ROUNDS, AFRAID_TO_HIT_PENALTY, AFRAID_DMG_DIV, DAZED_TO_HIT_PENALTY, afraidNeed, afraidDamage, fluency, killSpFor, castableAttackSpells, memberToHit, bestAttackSpell, schoolBonus, foeRisingResistCheck, foeWeakened, abilityEffectActive, weaponCrit, armorBulk, itemEffectActive, fleeBreakdown, neverFlees, targetStrikeFaces, foeSwingVsHero, foeSwingVsMember, foeSwingVsFoe, spellEffectRounds, weaponRow, applyCasterHealMul, controlResistCheck, spellLevelSq, strengthRoll, critWardOf, WORN_SLOTS, activationFor, itemTimerId, canCast, spellLevelFor, spellEffectSquares } from "./derived.js";
import { damageFoe } from "./foeDamage.js";
import { rollDice, isBestFace, rollCheck, atLeastFor, rollFields } from "./dice.js";
import { derivedRng } from "./rng.js";
import { die, forfeitLoot } from "./death.js";
import { checkLevel } from "./character.js";
import { offerLoot, pickpocketExtra, bagUpgradeTier, bagItemFor, gainWilmst, rollTreasureItem, LOOT_DIVISOR, narrateTimerTransitions, memberDrinkPotion, memberUseWorn, MEMBER_LEADER_KINDS } from "./items.js";
// Phase 89 (ITEM-07, plan 06): alliesTurn's Joiner item policy calls
// memberDrinkPotion / memberUseWorn and reads MEMBER_LEADER_KINDS from
// items.js. This is the same runtime-only items.js <-> combat.js cycle the
// line above already rides on: items.js imports combat.js functions and this
// module imports items.js ones, and neither reads the other's binding while
// the modules evaluate (only inside function bodies, alliesTurn and
// pickMemberItem below), so the cycle is safe.
import { maxCharges } from "./movement.js";
import { firstReadyAbility, tickAbilityCooldowns, resolveFoeAbility } from "./foeAbilities.js";
import { difficultyCurve, foeCountFor, foeCountMinFor, foeWpFor, foeHitFor, foeTierFor, roundDamageCapFor, tierSpreadFor, heroSpFor, lootFor, classKillSpeedFor, parleyNeedModFor, spellDamageFor } from "./difficulty.js";
import { tickRounds, clearRoundTimers, startEffect, startCooldown, isReady } from "./effects.js";
import { BESTIARY, ENC_TYPES, RACES, SPELLS, WEAPON_MAX, STRIKE_DICE, BAG_DROP_FACES, ABILITY_BY_ID, ONCE_A_FIGHT, ELITE_TITLES, SONG_TITLES, SONG_SCHOOLS } from "../content/index.js";
// Phase 91 (IDENT-17, plan 91-06): a Bard's song resolves its picked spell through
// castSpell's free mode. Same runtime-only combat.js <-> magic.js cycle as the
// items.js one above: magic.js imports combat.js functions and this module
// reads castSpell only inside sing's body, never while the modules evaluate.
import { castSpell } from "./magic.js";
// Phase 38 (ABIL-05): a Joiner's own ability use reuses abilities.js's
// effect-length mapping (abilityEffectTicks) and foe-flag appliers verbatim — the SAME
// combat.js <-> foeAbilities.js cycle precedent above applies here
// (abilities.js imports several combat.js functions; neither module reads
// the other's binding at top-level module-evaluation time, only inside
// function bodies, so the cycle is safe).
import { abilityEffectTicks, abilityShortfall, abilityTargetShortfall, KATA_FEINT_NEED_SHIFT, BRACE_BLOWS, DURATION_ROUNDS, POISON_ROUNDS, poisonedEdgeDot, markBonus, cutpurseGold, applyPommel, applyDirtyTrick, applyPoison, applyHamstring, applyMark } from "./abilities.js";

/**
 * STEALTH_CRIT_FACES — Phase 91.1 plan 02 (user ruling V12 B, 2026-10-01): the
 * top numbers of the strike die the Stealth skill crits on, on the first landed
 * blow of a fight (was two): the top three, 18–20 on a d20. Never in plate, in
 * the dark or for a Guard or Soldier. The hero's strike and a Joiner's own both
 * read it; the text guard reads it too.
 */
export const STEALTH_CRIT_FACES = 3;
import { checkDeathPhobia } from "./phobias.js";

/**
 * CON_ARTIST_LEAVE_FACES — Phase 91.1 plan 03 part B (user ruling V25 B, 2026-10-01): the faces of a
 * d6 (out of six) on which a foe of that level leaves a Con Artist before the fight: a level 1 foe
 * four faces (two times in three, unchanged), a level 2 foe two faces (one time in three, new, so the
 * rule reaches floors 2 to 5). A foe level not listed here never leaves. Data read by startCombat; the
 * footer, the blurb and the pins read it too, so the text never types the number.
 * CON_ARTIST_LEAVE_MAX_LVL is the highest foe level the table covers.
 */
export const CON_ARTIST_LEAVE_FACES = Object.freeze({ 1: 4, 2: 2 });
export const CON_ARTIST_LEAVE_MAX_LVL = 2;

/**
 * SONG_GAP_ROUNDS and SONGS_PER_FIGHT — Phase 91.1 plan 03 part B (user ruling V7 B, 2026-10-01): a
 * Bard (hero or Joiner) may sing a second song 5 rounds after the first: a long fight gets two songs,
 * never a third. `songDue(sang, sangAt, round)` is the one test: no song yet is always due; after the
 * first song one is due when the fight's round has reached the first song's round plus the gap; after
 * the second (`sangAt` null) none is.
 */
export const SONG_GAP_ROUNDS = 5;
export const SONGS_PER_FIGHT = 2;
export function songDue(sang, sangAt, round) {
  if (!sang) return true;
  if (!Number.isFinite(sangAt)) return false;
  return Number.isFinite(round) && round >= sangAt + SONG_GAP_ROUNDS;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const TALKATIVE = ["Humans", "Demons", "Lair Beasts", "Beasts"];

/** liveFoes(state) — the still-standing foes in the current encounter. */
export function liveFoes(state) {
  return state.combat ? state.combat.foes.filter((f) => f.alive) : [];
}

/**
 * shiftedFaces(faces, shift, dieN) — an ability's need shift applied to a
 * strike's winning-face count, shared by the hero (playerStrike) and a
 * Joiner (memberStrike). Floors at 1 (Overhead Blow's −2). Quick 260928-nrf
 * (user ruling 2026-09-28): a POSITIVE shift (Kata and Feint, +3) is capped
 * at the die — every face wins, the need never reads 0 or below — and never
 * lowers a count already past the die. Callers skip a 0-face (untouchable)
 * strike, so a shift never revives one. Pure, zero rng.
 */
export function shiftedFaces(faces, shift, dieN) {
  const s = Math.max(1, faces + shift);
  return shift > 0 ? Math.max(faces, Math.min(dieN, s)) : s;
}

/**
 * normalizeTarget(combat) — Phase 36 (TGT-01): the ONE dead-target rule,
 * extracted from playerStrike (formerly inline at the strike) and
 * magic.js#castSpell (formerly inline at the cast), byte-for-byte the same
 * semantics: when `combat.target` does not point at a live foe, it becomes
 * the index of the lowest-indexed live foe — which is -1 when nothing is
 * alive, exactly as before; a live target is never moved; null/undefined
 * `combat` or a non-array `foes` returns untouched.
 * Zero rng. Also called by the shell after every combat dispatch, before the
 * re-render (mazeworld.html engineCombatAction), which is the sanctioned
 * Phase 34 presentation mutation — there is still no engine action for
 * choosing a target.
 */
export function normalizeTarget(combat) {
  if (!combat || !Array.isArray(combat.foes)) return combat;
  const foe = combat.foes[combat.target];
  if (!foe || !foe.alive) combat.target = combat.foes.findIndex((f) => f.alive);
  return combat;
}

/**
 * knightFacesBigFoe(state) — true when a Knight is up against something with
 * real heft this encounter: any still-live foe with maxWP >= 20. Exported so
 * resolveInitiative and startCombat's encounterStarted flag share one
 * definition instead of two copies of the same read.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): backs the
 * Knight's "everything over 20 comes straight at you" bad — see
 * resolveInitiative below. Pure read of already-rolled foe data; 0 draws.
 *
 * DELIBERATE RULES CHANGE (Phase 51, INIT-01, 2026-09-20): read once, at the
 * single Fight!-time roll — not re-evaluated round to round (there is no
 * "round to round" anymore; initiative holds for the whole fight).
 */
export function knightFacesBigFoe(state) {
  return state.c.sub === "Knight" && !!state.combat && state.combat.foes.some((f) => f.alive && f.maxWP >= 20);
}

/**
 * eliteName(name, rank) — RULES-17 (Phase 75.3, user ruling 2026-09-25): an
 * elite foe's title-then-bestiary-name. `rank <= 0` returns `name`
 * unchanged (a plain foe never carries a title). `rank > 0` prefixes
 * `ELITE_TITLES[min(rank, ELITE_TITLES.length) - 1]` and a space — rank
 * above the title table's own length reuses its last (most dire) title.
 * Pure; 0 draws.
 */
export function eliteName(name, rank) {
  if (!rank || rank <= 0) return name;
  const title = ELITE_TITLES[Math.min(rank, ELITE_TITLES.length) - 1];
  return `${title} ${name}`;
}

/**
 * resolveInitiative(state, rng) — a fresh d20 each side; a Samurai/Fridgian is
 * last unless foreseen; foresight/Acute Hearing move first. Ports
 * mazeworld.html rollInitiative() (lines 2317-2327), minus its narration
 * string (a presentation concern — see the module header). Returns the full
 * detail form `{ first, mine, theirs, why }` so `fight()` can carry the dice
 * and the verdict on `combatJoined` for Plan 03's narration.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): extends the
 * never-first clause with two more zero-draw cases, both still overridden
 * AFTER the two d20s above are drawn (never skipped, never re-rolled):
 * a Knight facing any live foe with maxWP >= 20 (`knightFacesBigFoe`) and a
 * Court Mage in round 1 ("you talk first" — foes act first at encounter
 * start). A foreseen character still always goes first, exactly as the
 * Samurai/Fridgian case already does.
 *
 * DELIBERATE RULES CHANGE (Phase 40, SPELL-02, 2026-09-18): Sense Presence's
 * canon "never surprised" (`c.senses`) had no engine read before this phase
 * — only the in-dark to-hit waiver (derived.js#toHit) consulted it. It now
 * ALSO waives every forced foe-first rule above (Samurai/Fridgian
 * slow/Knight-vs-big-foe/Court Mage round 1) for as long as `c.senses` is
 * truthy — until the fight it is active in ends (combat.js#endCombat's
 * unconditional `c.senses = 0` reset; a narrated `sensesFaded` fires there
 * too, see endCombat below).
 *
 * DELIBERATE RULES CHANGE (RULES-05, Phase 75, 2026-09-25): Phase 40's waiver
 * only stopped a forced-foe-first override — a sensed character could still
 * LOSE the fair d20 roll and go second (a device report: a depth-8 Court
 * Mage with senses up lost initiative 2 vs 17 in the dark and died), which
 * contradicts the spell's own "nothing gets the jump on you" text. `c.senses`
 * now joins `foreseen`/`acuteHearing` in the unconditional "you go first"
 * branch of the `C.first` ternary below. The two d20s are STILL ALWAYS
 * drawn — this is a branch change, never a draw-count change, so no fixture
 * moves. A foreseen character still always goes first regardless of senses
 * (the `foreseen` check is unchanged and evaluated first in the `why`
 * chain).
 *
 * DELIBERATE RULES CHANGE (Phase 51, INIT-01, 2026-09-20): this used to be
 * called once per round from `afterPlayerAction` (canon p.24's "a fresh d20
 * each round"), which meant the foe could act at the end of one round and
 * again at the start of the next with no chance to respond in between. It is
 * now called EXACTLY ONCE per fight — from `fight()` only, at the Fight! gate
 * — and `C.first` holds for the whole encounter. Knight-vs-big-foe therefore
 * narrows to the opener (a Knight who kills every maxWP>=20 foe still opens
 * against them if they were live at Fight! time; the check is not
 * re-evaluated mid-fight) and Court Mage's `C.round === 1` guard is now
 * trivially true at the only call site (kept as-is — harmless, and it
 * documents the original "you talk first" intent). `why` is derived from the
 * same branch order the ternary already uses below: the first true of
 * samurai/slow/knightBig/courtMage when the forced-foe branch is taken, else
 * foreseen/Acute Hearing, else senses (only when senses is what flipped a
 * would-be-forced-foe roll to "you" — the same condition the existing
 * `senses: true` event spread already checks), else `undefined` (the dice
 * decided, and Plan 03's narration bare-words it).
 *
 * DELIBERATE RULES CHANGE (Phase 90 plan 07, SPELL-10, user 2026-09-30: Speed
 * of Sound "you act first in every fight it covers"): a live spell-sourced
 * effect carrying a `first` payload (`eff(c, "first") > 0`) joins foresight
 * and senses in the unconditional "you go first" branch AND waives every
 * forced foe-first rule. `why` reads "speed" when it is what decided (foresight
 * and Acute Hearing name themselves first). Still a branch change only: the two
 * d20s are drawn either way, so no draw count moves.
 */
export function resolveInitiative(state, rng) {
  const C = state.combat;
  if (!C) return undefined;
  const c = state.c;
  const R = RACES[c.race];
  const mine = rng.d(20); // roll:already-high
  const theirs = rng.d(20); // roll:already-high
  const samurai = c.sub === "Samurai";
  const slow = !!R.slow;
  const knightBig = knightFacesBigFoe(state);
  const courtMage = c.sub === "Court Mage" && C.round === 1;
  const foreseen = c.foresight;
  const acuteHearing = skill(c, "Acute Hearing");
  // Phase 90 plan 07 (SPELL-10): a live Speed of Sound (a `first` payload on a
  // spell-sourced timed effect, read through eff) joins foresight and senses in
  // beating every forced foe-first rule: you arrive before the noise you make.
  const speedy = eff(c, "first") > 0;
  const forcedFoe = (samurai || slow || knightBig || courtMage) && !foreseen && !c.senses && !speedy;
  c.foresight = false;
  // RULES-05 (Phase 75): c.senses joins the unconditional "you" branch.
  C.first = forcedFoe ? "foe" : foreseen || acuteHearing || c.senses || speedy ? "you" : mine >= theirs ? "you" : "foe";
  let why;
  if (forcedFoe) {
    why = samurai ? "samurai" : slow ? "slow" : knightBig ? "knight" : "courtMage";
  } else if (foreseen) {
    why = "foreseen";
  } else if (acuteHearing) {
    why = "acuteHearing";
  } else if (c.senses && C.first === "you") {
    why = "senses";
  } else if (speedy) {
    why = "speed";
  }
  return { first: C.first, mine, theirs, why };
}

/**
 * rollInitiative(state, rng) — thin wrapper over `resolveInitiative` kept for
 * every direct-call test/site that only wants the winner string (identity-
 * combat, identity-contract, spell-utility, combat.test.js's non-fight()
 * direct calls). See resolveInitiative's JSDoc for the Phase 51 rules
 * change; this wrapper's contract (a string return) is unchanged.
 */
export function rollInitiative(state, rng) {
  return resolveInitiative(state, rng)?.first;
}

/**
 * startCombat(state, wandering, forced, rng, events) — builds `state.combat`
 * from the BESTIARY: encounter type, level-scaled foe count/roster,
 * Warlock's walking-dead boost, Knight/Con Artist/Court Mage foe removals,
 * phobia freeze, ally join, and first-move via rollInitiative. Ports
 * mazeworld.html startCombat() (lines 2257-2315).
 *
 * DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21, USER RULING D):
 * foe level is a function of DEPTH (`curve.foeLevel`, via `foeLevelFor`),
 * never of the hero's level — out-leveling the dungeon is how a strong run
 * breaks away. Reads the ONE global curve for this encounter
 * (`difficultyCurve`, 0 draws) and applies: `foeCountFor` (the canon d4/d4
 * draw shape, no level-keyed cap, reshaped by depth per RULES-16 below), a
 * copy-time wp scale (`foeWpFor`), and the tier bleed via `tierSpreadFor()`.
 * The old `dmgBonus` key/whole-lvl-base scaling is retired — `foeHitFor`
 * scales the WHOLE hit at the damage sites instead (see foeTurn/
 * pursuitStrike below).
 *
 * DELIBERATE RULES CHANGE (Phase 75.3, RULES-16, user ruling 2026-09-25):
 * the foe count grows with depth — floors 1-4 unchanged, floors 5-9 solo
 * only on a first d4 of 1, floors 10-19 never start a fight solo, floors
 * 20+ always bring at least 3 — via `foeCountFor`'s third argument
 * (`state.floor.depth`), with the SAME one-or-two d4 draws as before. A
 * wandering fight draws no count die at all and sizes itself at
 * `foeCountMinFor(state.floor.depth)` (the depth floor, whole) in place of
 * the old fixed 1.
 */
export function startCombat(state, wandering, forced, rng, events = []) {
  const c = state.c;
  const curve = difficultyCurve(state.floor.depth);
  const type = forced || rng.pick(ENC_TYPES);
  // Phase 38 (ABIL-02): the retired Tracking read — `tracked` stays a real
  // field (flee's round-1 clean-withdrawal branch and the `trackable` event
  // both still read it) but nothing sets it true anymore; it is dormant
  // until a future source assigns it.
  let tracked = false;
  // RULES-16 (Phase 75.3): the SAME one-or-two d4 selection draws as always
  // (foeCountFor's own thunk still fires only when the first roll is > 2,
  // exactly like the retired `D(4) <= 2 ? 1 : D(4) <= 3 ? 2 : 3` ternary),
  // now reshaped by the floor depth (foeCountFor's third argument): solo
  // fights fade with depth (floors 1-4 unchanged, 5-9 solo only on a first
  // roll of 1, 10-19 never solo, 20+ always at least 3). A wandering
  // encounter (engine/movement.js#newDay) draws nothing here and takes the
  // depth minimum whole (foeCountMinFor) instead of a fixed 1; every other
  // caller (engine/encounters.js#encounterDot, every dot and Lair Beast
  // cell) draws the count normally.
  const n = wandering ? foeCountMinFor(state.floor.depth) : foeCountFor(rng.d(4), () => rng.d(4), state.floor.depth); // roll:selection
  const foes = [];
  for (let i = 0; i < n; i++) {
    // Phase 73 (ROLL-05): the tier-bleed d4 mirrors — "one tier lower" fires
    // on the SAME faces (tierSpreadFor()), read as the top faces of the d4
    // instead of the bottom ones; byte-identical for every raw draw.
    const bled = rollCheck(rng, 4, atLeastFor(tierSpreadFor(), 4)).ok;
    // RULES-17 (Phase 75.3): the SAME bleed check now also lowers an
    // elite's rank before its tier (foeTierFor's own JSDoc has the full
    // formula) — no new draw, the tier-5 roster is still the one BESTIARY
    // draws from once a foe's level would pass 5.
    const { lvl, eliteRank } = foeTierFor(state.floor.depth, bled);
    // LO-02: no `||` fallback needed here — `lvl` is always clamped to
    // [1,5] above, and every BESTIARY category has exactly 5 tiers
    // (confirmed by 01-VERIFICATION.md's creature count audit), so
    // BESTIARY[type][lvl - 1] can never be undefined.
    const roster = BESTIARY[type][lvl - 1];
    const picked = rng.pick(roster);
    // RULES-17 (Phase 75.3): an elite's wp carries the per-rank HP bonus and
    // its name carries the rank's title — the SAME draws, a titled/scaled
    // copy of the SAME picked bestiary row.
    const wp = foeWpFor(picked.wp, curve, eliteRank);
    foes.push({
      name: eliteName(picked.n, eliteRank),
      type,
      lvl,
      size: picked.sz,
      intel: picked.i,
      wp,
      maxWP: wp,
      alive: true,
      asleep: 0,
      sp: picked.sp || {},
      lives: picked.sp && picked.sp.twice ? 2 : 1,
      // DETERMINISM GATE (Phase 19, FOE-01/D-01/D-14): the kit key is added
      // ONLY for the eight caster rows that carry one in content/bestiary.js
      // — every fixture-exposed creature lacks it, so this foe object stays
      // byte-identical for parity. `f.abilities` (present vs absent) is the
      // structural zero-draw gate foeTurn reads below.
      ...(picked.abilities ? { abilities: picked.abilities.slice() } : {}),
      // RULES-17 (Phase 75.3): `elite` is present ONLY for an elite
      // (eliteRank > 0) — absent on every plain foe, so a pre-Phase-75.3
      // fixture (floor 1, well below the first elite floor) never carries
      // this key at all.
      ...(eliteRank > 0 ? { elite: eliteRank } : {}),
    });
  }
  // CMB-01 (Phase 31): the ENCOUNTER step ends here with `pending: true` —
  // nothing from rollInitiative onward (initiative, the phobia trigger,
  // combatInDark, a pre-emptive foeTurn) runs until the new `fight` action
  // below is dispatched. `encounterStarted` (just below) carries every flag
  // computable at encounter time (samuraiNeverFirst/fridgianSlow/
  // acuteHearing/knightBigFoe/courtMageTalksFirst — all zero-draw), but NOT
  // `first`, which requires rollInitiative's two d20s and is now carried by
  // `fight`'s own `combatJoined {first}` event instead.
  state.combat = { foes, type, round: 1, target: 0, spellOpen: false, tracked, pending: true };
  const R = RACES[c.race];
  events.push({
    type: "encounterStarted",
    wandering: !!wandering,
    combatType: type,
    // DELIBERATE RULES CHANGE (audit-bugs, 2026-09-09, E4): additive field —
    // this event previously mapped foes to {name, lvl, wp} only, dropping
    // maxWP. Nothing in the live render path was actually found to depend on
    // this event for its foe hp display (mazeworld.html's renderEncounter
    // reads state.combat.foes directly, which always carries the real,
    // stable starting maxWP), but a foe's starting hp is exactly the kind of
    // value a narration/summary consumer would reasonably expect this event
    // to carry, and dropping it silently is a footgun for any future
    // consumer (e.g. a combat-start rail card or report) that reads this event
    // instead of live state. Safe/additive: no existing event-shape
    // assertion pins this array to exactly {name, lvl, wp}.
    // RULES-17 (Phase 75.3): `elite` carried the SAME conditional way as the
    // foe literal above — present only for an elite.
    foes: foes.map((f) => ({ name: f.name, lvl: f.lvl, wp: f.wp, maxWP: f.maxWP, ...(f.elite ? { elite: f.elite } : {}) })),
    // CMB-01 (Phase 31): `first` is no longer known at encounter time — it
    // moved to `fight`'s `combatJoined` event (see above).
    samuraiNeverFirst: c.sub === "Samurai",
    fridgianSlow: !!R.slow,
    acuteHearing: skill(c, "Acute Hearing"),
    // Phase 24 (IDENT-05): additive narration flags for rollInitiative's two
    // new never-first cases — see rollInitiative's JSDoc. No test pins this
    // event's exact key set.
    knightBigFoe: knightFacesBigFoe(state),
    courtMageTalksFirst: c.sub === "Court Mage",
  });
  if (tracked) events.push({ type: "trackable" });
  if (c.pendingAlly) {
    state.combat.ally = c.pendingAlly;
    c.pendingAlly = null;
    events.push({ type: "allyJoined", name: state.combat.ally.name });
  }

  // PARTY-03/PARTY-04 (Phase 8): sync the persistent roster (state.party) into
  // a COMBAT-SCOPED C.allies list, exactly the way `c.pendingAlly → C.ally`
  // hands the summon into combat just above. Each entry MIRRORS a persistent
  // member (its own in-fight `wp` this fight) and back-references it via
  // `partyIdx` so endCombat can sync surviving hp out and drop the downed.
  //
  // DETERMINISM GATE (the dominant constraint): this is a pure data copy — it
  // draws ZERO rng — and, critically, the `state.combat.allies` KEY is only
  // ever ADDED when `state.party?.length` is truthy. An empty party (every
  // parity fixture) leaves `state.combat` WITHOUT an `allies` field at all, so
  // the combat object stays byte-identical to the frozen master and never
  // reaches a compared-field mismatch (mirrors the null-`C.ally` precedent:
  // absent, not empty). All downstream party rng draws (alliesTurn, foeTurn
  // target selection, killFoe split) are likewise gated on `C.allies`.
  if (state.party?.length) {
    state.combat.allies = state.party.map((m, i) => ({
      partyIdx: i,
      name: m.name,
      lvl: clamp(m.level ?? m.lvl ?? 1, 1, 5),
      sub: m.sub,
      wp: m.wp,
      maxWP: m.maxWP ?? m.wp,
    }));
  }

  // a Warlock props up every walking dead thing in the room, whether he means
  // to or not
  if (c.sub === "Warlock" && type === "Walking Dead") {
    const boost = c.level;
    foes.forEach((f) => {
      f.wp += boost;
      f.maxWP += boost;
    });
    events.push({ type: "warlockBoost", amount: boost });
  }

  // a Knight is beneath the notice of small things; a Con Artist is not
  // worth the trouble
  for (const f of foes.slice()) {
    if (c.sub === "Knight" && f.maxWP < 5) {
      f.alive = false;
      f.fled = true;
      events.push({ type: "foeFled", name: f.name, reason: "knight" });
    } else if (c.sub === "Con Artist" && f.lvl <= CON_ARTIST_LEAVE_MAX_LVL) {
      // Phase 73 (ROLL-05): the die is drawn under the exact same
      // short-circuited condition as before (Con Artist, foe lvl <= 1); only
      // the winning face moved from the bottom 4 faces to the top 4.
      // Phase 91.1 plan 03 part B (V25 B, 2026-10-01): a level 2 foe now leaves one time in three
      // (2 faces of the d6), so the rule reaches floors 2 to 5. The level 1 draw stays on the MAIN
      // rng, byte-identical to before; the level 2 draw is a NEW roll and comes from the derived
      // stream derivedRng(<main cursor>, "conArtistLeave", <acts>, <foe index>), so no existing
      // draw moves for any run (a level 2 foe used to draw nothing here).
      const leaveRng = f.lvl <= 1 ? rng : derivedRng(typeof rng.getState === "function" ? rng.getState() : 0, "conArtistLeave", Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0, foes.indexOf(f));
      const conArtistCheck = rollCheck(leaveRng, 6, atLeastFor(CON_ARTIST_LEAVE_FACES[f.lvl] ?? 0, 6));
      if (conArtistCheck.ok) {
        f.alive = false;
        f.fled = true;
        events.push({ type: "foeFled", name: f.name, reason: "conArtist", ...rollFields(conArtistCheck) });
      }
      // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-06): the
      // Court Mage's boredom kill widens from a 1-in-12 chance to 1-in-6
      // (2 of 12 faces) — same single draw, nothing else in this branch
      // changes. Phase 73 (ROLL-05): now the top 2 faces of the d12.
    } else if (c.sub === "Court Mage") {
      const courtMageCheck = rollCheck(rng, 12, atLeastFor(2, 12));
      if (courtMageCheck.ok) {
        f.lives = 1;
        events.push({ type: "foeBored", name: f.name, ...rollFields(courtMageCheck) });
        killFoe(state, f, rng, events);
      }
    }
  }
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    state.combat = null;
    return events;
  }
  return events;
}

/**
 * fight(state, rng, events) — CMB-01 (Phase 31, user ruling 2026-09-16): the
 * FIGHT step split from startCombat at the roster/`pending` cut line —
 * resolves everything from `resolveInitiative` onward, in the EXACT
 * prototype draw order: the two initiative d20s (`resolveInitiative`, which
 * also consumes `c.foresight` — spent at Fight! time now, not at the moment
 * the encounter was glimpsed; a zero-draw, fixture-invisible timing shift),
 * the phobia trigger's conditional Hardiness `rng.d(2)` (same site, same
 * condition — now applies the Afraid PENALTY, see below, never a lost
 * action), `combatInDark` (0 draws), and the pre-emptive `foeTurn` only when
 * the foes win initiative (`foeTurn`'s own draws, unchanged internally).
 * Idempotent and zero-draw on a null or already-joined (non-pending) combat
 * — a replayed Fight! tap can never reroll initiative (T-31-02). A
 * foes-first opener that triggers Afraid ticks it 2 -> 1 inside this same
 * call (the foeTurn tail runs before this call returns), exactly like a
 * pre-cast ward.
 *
 * DELIBERATE RULES CHANGE (Phase 51, INIT-01/INIT-02, 2026-09-20): this is
 * now the ONLY place initiative is ever resolved for a fight (see
 * resolveInitiative's own JSDoc) — `afterPlayerAction` no longer re-rolls.
 * `combatJoined` is extended with the dice (`mine`/`theirs`) and, when an
 * override decided the roll, `why`; and, for a single-foe encounter, `foe`
 * (the live foe's name) so Plan 03's narration can say "Stalka Beast" instead
 * of the generic "them". All three are additive — a plain win with no
 * override and a foe group both omit the field entirely, so this event's
 * shape for those cases (parity fixtures included) is unchanged apart from
 * the always-present `mine`/`theirs`. `combatJoined` still fires exactly
 * once per fight (structural: `fight()` runs once per encounter, gated by
 * `C.pending`), so "the dice are shown once, not per round" falls out for
 * free — no new pin is needed to prove it beyond the existing once-per-fight
 * shape.
 */
export function fight(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.pending) return events;
  const c = state.c;
  const type = C.type;
  const { first, mine, theirs, why } = resolveInitiative(state, rng);
  delete C.pending; // the joined combat object's key set stays byte-identical to the prototype's — deleted, never set false
  const live = liveFoes(state);
  // Phase 40 (SPELL-02): `senses` is additive — spread only when Sense
  // Presence is up AND it actually decided the roll (first === "you") — so a
  // plain combatJoined event (no senses, or senses that merely rode along
  // with a normal win) stays byte-identical to the pre-Phase-40 shape.
  events.push({
    type: "combatJoined", first, mine, theirs,
    ...(why ? { why } : {}),
    ...(live.length === 1 ? { foe: live[0].name } : {}),
    ...(c.senses && first === "you" ? { senses: true } : {}),
  });

  // DELIBERATE RULES CHANGE (04.1-05/04.1-06, 2026-09-09, PHOBIA-01): the
  // phobia trigger fires on THREE mutually-exclusive conditions per
  // character (a character carries exactly one `c.phobia` value, and only
  // Darkness/Death ever have `phobiaType: null` in the PHOBIAS catalog) — a
  // type-matched phobia (`c.phobiaType === type`), Darkness-in-the-dark
  // (`darkLimited(state)` since DARK-01, Phase 76 — in the dark with no
  // light: Night Vision, a live Amulet or a lit torch stop it; with a waiver
  // live the gated Hardiness d2 below is not drawn), or a Death-phobic character at/below
  // DEATH_PANIC_THRESHOLD (25%) of `c.maxWP` (`nearDeathPanic`) — so this
  // can never double-trigger or double-roll Hardiness for a single
  // character. Because the left side of the `&&` short-circuits,
  // `rng.d(2)` is drawn ONLY when one of the three conditions is already
  // true AND the character has Hardiness — never for a non-phobic or
  // non-triggered character. WR-02 (19-REVIEW.md): DEATH_PANIC_THRESHOLD
  // lives as a single source of truth in engine/derived.js, so this check
  // and conditionsOf's afraid chip can never drift out of sync.
  //
  // DELIBERATE RULES CHANGE (Phase 31, user ruling 2026-09-16: "Phobia
  // should be penalties, never a no actions state"): the prototype froze
  // the hero here and spent the first strike shaking it off (`frozen`/
  // `shookOffFrozen`). The engine now sets `combat.afraid = AFRAID_ROUNDS`
  // (a shrunk to-hit range and halved damage on the player's strikes, see
  // engine/derived.js's `afraidNeed`/`afraidDamage`) with ZERO new rng
  // draws (no shake-off roll) — the trigger condition and the single
  // conditional Hardiness `rng.d(2)` above are byte-identical to before.
  // The three fixtures that reach this branch (combat/lose,
  // combat/lose-apprentice, magic/cast-damage) carry declared action-path
  // divergence records (see the fixture JSON files under test/parity/fixtures).
  const nearDeathPanic = c.phobia === "Death" && c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD;
  // DELIBERATE RULES CHANGE (Phase 41, TERR-05, user-ratified Key Decision
  // 2026-09-18: "arm Afraid for the next fight"): the FOURTH OR-condition —
  // a terrain phobia trigger (engine/phobias.js) armed `c.fearArmed` on a
  // fresh region entry since the last fight. `armed` is computed and the
  // flag CONSUMED here, BEFORE the trigger check, whether or not this fight
  // actually ends up Afraid (a Hardiness shrug-off still spends the arm —
  // the arm is a one-shot "your next fight opens Afraid" ticket, not a
  // standing condition) and whether or not `c.phobia` even still matches the
  // armed phobia (a `newPhobia` reroll between the trigger and this fight
  // drops a now-stale arm here too, via the `armed` phobia-match guard
  // itself). Deliberately survives `endCombat`/`descend` (see
  // engine/phobias.js's own header) — only `fight()` ever clears it.
  const armed = !!(c.fearArmed && typeof c.fearArmed === "object" && c.fearArmed.phobia === c.phobia);
  const armedTrigger = armed ? c.fearArmed.trigger : null;
  if ("fearArmed" in c) delete c.fearArmed;
  // Phase 73 (ROLL-05): the phobia trigger condition is computed once (pure,
  // 0 draws); the Hardiness shrug d2 is then drawn ONLY when that condition
  // holds AND the hero has Hardiness — same single gated draw as before, now
  // reading the top face (2 of 2) as the shrug instead of the bottom one.
  const phobiaCondition = c.phobiaType === type || (c.phobia === "Darkness" && darkLimited(state)) || nearDeathPanic || armed;
  const hardinessShrug = phobiaCondition && skill(c, "Hardiness") ? rollCheck(rng, 2, atLeastFor(1, 2)) : null;
  if (phobiaCondition && !(hardinessShrug && hardinessShrug.ok)) {
    state.combat.afraid = AFRAID_ROUNDS;
    // additive spread: byte-identical `{type, rounds}` shape when not armed
    // (every parity fixture — none ever carries fearArmed); an armed trigger
    // adds `trigger` so the shell can narrate "Still rattled from ...", and a
    // drawn (but failed) Hardiness shrug adds the roll-high triple.
    events.push({
      type: "phobiaAfraid",
      rounds: AFRAID_ROUNDS,
      ...(armedTrigger ? { trigger: armedTrigger } : {}),
      ...(hardinessShrug ? rollFields(hardinessShrug) : {}),
    });
  }
  // RULES-05 (Phase 75): Sense Presence is "full skill in the dark" — an
  // active senses waiver stops this line firing, mirroring derived.js#toHit's
  // existing dark-cap waiver. DARK-01 (Phase 76, user ruling 2026-09-25
  // "combat too"): the line reads the one darkness waiver (darkLimited), so
  // a lit torch or a live Amulet lifts it exactly like Night Vision.
  if (darkLimited(state) && !c.senses) events.push({ type: "combatInDark" });
  if (first === "foe") {
    foeTurn(state, rng, events);
    // BUG FIX (Phase 26 gap closure, 2026-09-15): the opening foe turn can
    // KILL the last foe without touching the hero — a ward reflecting its own
    // blow back (Bubble) or an acid tick — and this was the one foeTurn call
    // site with no cleared-encounter check after it (afterPlayerAction has
    // one at both of its foeTurn calls). Combat stayed open with nothing
    // alive to fight: the AFTER matrix found Fighter/Samurai/Dwarven seed
    // 197976 stranded for 4,600 no-op actions behind a dead Shadow. Mirror
    // the afterPlayerAction check exactly. Zero rng — endCombat draws none —
    // and unreachable on every parity fixture (none has a foe die during the
    // opener; the suite stays 33/33 byte-identical).
    if (state.combat && !liveFoes(state).length) {
      events.push({ type: "encounterCleared" });
      endCombat(state, events);
    }
  }
  return events;
}

/**
 * refuseIfPending(state, events, type, extra) — CMB-01 (Phase 31): the ONE
 * `notFought` guard. Every player combat action other than `fight` calls
 * this as its FIRST check (before any other refusal, and before its own
 * `!state.combat` return): while `state.combat.pending` is truthy, pushes
 * `{ type, ...extra, reason: "notFought" }` and returns `true` (the caller
 * returns immediately, mutating nothing and drawing nothing); otherwise
 * returns `false` and the caller proceeds untouched. A single shared
 * implementation means a future notFought wording/shape change never has to
 * be repeated at eight call sites.
 */
export function refuseIfPending(state, events, type, extra = {}) {
  if (!state.combat || !state.combat.pending) return false;
  events.push({ type, ...extra, reason: "notFought" });
  return true;
}

/**
 * playerStrike(state, rng, events) — the player's attack action. Ports
 * mazeworld.html playerStrike() (lines 2331-2408): Wizard's melee refusal
 * while an attack spell is castable right now, the Afraid to-hit/damage
 * penalty (Phase 31 — never a lost action, see below), the attack count
 * (Barbarian/Ambidextrous/haste/Fridgian frenzy — the second wild swing
 * always targets the live foe; see the Phase 24 note below), per-attack
 * toHit vs strikeDie, all the critical-strike rules (Stealth/Cat
 * Burglar/Cutthroat/Ninja/Guard/Soldier no-crit), weaponDamage, and killFoe
 * on lethal.
 *
 * Phase 38 (ABIL-02, strike_descriptor_spec): Death Touch and Silent Step are
 * now descriptor-driven, not standing passives — `useAbility` (Plan 03) sets
 * a transient `state.combat.abilityStrike` descriptor (`{ key, autoHit?,
 * forceCrit?, finishUnder?, bonusDmg?, dmgMul?, needShift?, attacks?,
 * stunOnHit? }`; Phase 90's `stunOnHit` is Pommel Strike's: after the
 * attack loop, if any blow landed and the target still stands, applyPommel
 * and one `pommelStruck`)
 * immediately before calling this function, and this function clears it
 * again after its own attack loop — every read below is additive and
 * zero-draw (it only reinterprets the roll this function already makes).
 */
export function playerStrike(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check, before any other
  // refusal or the `!C` return below — every player combat action refuses
  // with `notFought` while Fight! has not yet been pressed.
  if (refuseIfPending(state, events, "strikeRefused")) return events;
  if (!C) return events;
  // DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-01): the prototype
  // (mazeworld.html lines 2331-2408) refused a Wizard's melee strike while
  // ANY spell charge remained, even if the whole grimoire was Heal/Shield —
  // a Wizard could be left with nothing to do (Phase 22's ledger recorded
  // this as the "cannot act" state). The new rule: refuse to melee only
  // while a charge remains AND an attack-kind spell is castable RIGHT NOW
  // (known, level-legal, school-legal, override-aware via
  // castableAttackSpells) — a Wizard holding only utility spells, or one who
  // has spent every attack spell for the day, fights with the staff. The
  // event now names the spell the Wizard should cast instead, so a later UI
  // pass can tell the player exactly what to do.
  if (c.sub === "Wizard" && maxCharges(c) - c.spellsUsed > 0) {
    const castable = castableAttackSpells(state);
    if (castable.length) {
      events.push({ type: "strikeRefused", reason: "wizard", spell: castable[0].n });
      return events;
    }
  }
  // Phase 36 (TGT-01): shared rule, see normalizeTarget.
  normalizeTarget(C);
  const t = C.foes[C.target];
  if (!t) return events;
  // Phase 38 (ABIL-02): the transient descriptor Plan 03's useAbility sets
  // immediately before calling this function, taken once. `null` for every
  // ordinary STRIKE dispatch (every pre-Phase-38 fixture and caller).
  const AS = C.abilityStrike || null;

  const R = RACES[c.race];
  let attacks = 1;
  if (c.sub === "Barbarian") attacks = 2;
  if (skill(c, "Ambidextrous")) attacks = Math.max(attacks, 2);
  // Phase 39 (GEAR-02): the retired c.haste counter — a live "haste" item
  // effect (Cloak/potion of Speed) reads through c.timers.
  if (itemEffectActive(c, "haste")) attacks = Math.max(attacks, 2);
  if (AS && AS.attacks) attacks = Math.max(attacks, AS.attacks);
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, race pass / IDENT-08): the
  // prototype's frenzy could roll a d10 <= 5 against a dead foe and waste
  // BOTH swings on a corpse (mazeworld.html playerStrike, the wasted-swing
  // branch). The new rule: a Fridgian's frenzy always spends its second wild
  // swing on the live target `t` (the attack loop below already targets `t`,
  // never a corpse) — no corpse lookup, no whiff roll. This REMOVES one
  // rng.d(10) draw whenever a Fridgian frenzies with a dead foe present; the
  // sole parity consequence is the declared combat/lose (seed 14) divergence.
  let frenzyFired = false;
  // IDENT-20 (Phase 91 plan 09, user 2026-09-30): "each swing, a 4-6 on a d6
  // gives a second swing". ONE check per strike action, through the ONE
  // roll-high check helper: the top three faces of a d6 win (atLeastFor(3, 6)
  // = 4: a 4, 5 or 6 frenzies, a 1, 2 or 3 does not). It is a changed die at
  // the old d8's draw position, not a new roll (one draw either way, so every
  // later draw of the strike keeps its place) and needs no derived stream.
  // The old "never wastes itself on a corpse" promise is gone from the text.
  // Q6 A (user 2026-09-30): the frenzy swing is the SECOND pass of the attack
  // loop below, which runs only while `t.alive`, so a first swing that kills
  // its foe ends the strike: the second swing is lost, it does not carry to
  // the next live foe. The frenzy never adds a third swing (`max(attacks, 2)`).
  if (R.frenzy) {
    const frenzyCheck = rollCheck(rng, 6, atLeastFor(3, 6));
    if (frenzyCheck.ok) {
      attacks = Math.max(attacks, 2);
      frenzyFired = true;
      events.push({ type: "frenzy", ...rollFields(frenzyCheck) });
    }
  }

  // CMBUI-13 (Phase 77, plan 77-07, "Dazed honesty"): the live condition
  // terms toHit applied (inspired, dazed, the dark cap, hero Blind), named
  // once per strike from the same state toHit reads. Payload only: the
  // faces below still come from toHit itself, so no roll, face or draw
  // changes. The frenzy second swing (toHit − 1) reads the same entries.
  const conditionMods = toHitBreakdown(state).mods;

  // Phase 90 (ABIL-07): set when a blow of THIS strike hit the target and
  // reached the damage seam (a soaked hit still counts as a hit); read once
  // after the loop for the descriptor's `stunOnHit`.
  let blowLanded = false;
  for (let a = 0; a < attacks && t.alive; a++) {
    const dieN = strikeDie(c);
    // Phase 73 (ROLL-05): the need chain is pure arithmetic (zero rng) and
    // now sits ABOVE the strike draw, since atLeastFor(faces, dieN) must be
    // ready before rollCheck fires. Locals renamed to the roll-high
    // reading: the old `need` (a count of winning faces) is now `faces`;
    // the combined need-modifier list is now `mods`.
    //
    // DELIBERATE RULES CHANGE (Phase 72, ROLL-01 (b), user ruling
    // 2026-09-24): the 1994 rules hard-set the frenzy swing's need to a
    // constant that ignored the dark cap and dazed. The swing is now the
    // hero's normal to-hit narrowed by one face (floor 1): a fighter's
    // frenzy swing improves on canon, a magic user's worsens. Zero rng
    // change. Declared in test/parity/FIXTURE-INVENTORY.md (Phase 72, Plan
    // 05). F4 (user ruling 2026-09-24, applied here in the same edit): the
    // narrowed need applies ONLY to the actual frenzy swing — `frenzyFired`
    // this call — never to a Fridgian's other second attack (Barbarian
    // extra attack, haste, Ambidextrous, Last Stand), which keeps the
    // normal to-hit.
    let faces = a === 1 && frenzyFired ? Math.max(1, toHit(state) - 1) : toHit(state);
    // Phase 74 (ROLL-02): the five per-target terms (dozing/stupid floor,
    // sp.toHit cap, sp.fast, magicOnly, daggerOnly) plus (Phase 75.1,
    // RULES-10) the sixth Mirror Self cap now live in the ONE helper
    // engine/derived.js#targetStrikeFaces — see its JSDoc for the full
    // per-term rationale (Phase 40 Stupidity, Phase 72 F3 daggerOnly).
    const preTargetFaces = faces;
    faces = targetStrikeFaces(c, t, faces);
    // RULES-10 (Phase 75.1, foe Mirror Self): targetStrikeFaces already
    // applied the cap as its own sixth (and final) term above — this only
    // NAMES it for the strike event, by recomputing what faces would have
    // been WITHOUT the mirror term (a second, zero-draw call to the same
    // pure helper). Pushed only when the mirror term itself actually
    // changed the result — never for a magic-only foe already zeroed by an
    // earlier term (mirror is a no-op there, per targetStrikeFaces' own
    // floor).
    let mirrorMods = [];
    if (t.mirror > 0) {
      const withoutMirror = targetStrikeFaces(c, { ...t, mirror: 0 }, preTargetFaces);
      if (faces !== withoutMirror) mirrorMods = [{ name: "Mirror Self", delta: faces - withoutMirror }];
    }
    // Phase 38 (ABIL-02, need_shift_spec): Overhead Blow's party-agnostic
    // "your die has two fewer faces that land it" self-penalty — a transient descriptor
    // term, zero draws, applied BEFORE Afraid so Afraid's own penalty stacks
    // on top of it like any other need rule. Floors at 1 (never revives an
    // untouchable need-0 foe, mirroring Afraid's own floor below); a no-op
    // (faces unchanged) when magicOnly has already zeroed faces.
    //
    // Quick 260928-nrf (user ruling 2026-09-28, "Kata and Feint roll to
    // hit"): Kata and Feint carry needShift +3 — three MORE winning faces —
    // instead of an auto-hit. shiftedFaces caps a positive shift at the die
    // (every face wins, never a need of 0 or below). The mod is named for the
    // ability ("Kata"/"Feint"); Overhead Blow keeps its "overhead" name,
    // which rollRange.js#MOD_LABEL relabels.
    let abilityMods = [];
    if (AS && AS.needShift && faces > 0) {
      const before = faces;
      faces = shiftedFaces(faces, AS.needShift, dieN);
      const name = AS.key === "overheadBlow" ? "overhead" : (ABILITY_BY_ID[AS.key]?.name ?? AS.key);
      abilityMods = faces !== before ? [{ name, delta: faces - before }] : [];
    }
    // Phase 31 Afraid — pure arithmetic on the winning-face count, zero rng;
    // false (afraidMods empty) for every non-phobia fixture. The LAST
    // modifier, after every other need rule; never revives an untouchable
    // (0 faces) foe.
    const facesBeforeAfraid = faces;
    faces = afraidNeed(state, faces);
    const afraidMods = faces !== facesBeforeAfraid ? [{ name: "afraid", delta: faces - facesBeforeAfraid }] : [];
    // CMBUI-13 (Phase 77): the condition entries come first, in toHit's
    // own order, then the per-target Mirror Self, Overhead Blow and Afraid.
    const mods = [...conditionMods, ...mirrorMods, ...abilityMods, ...afraidMods];
    // Phase 38 (ABIL-02, strike_descriptor_spec): `subAuto` is the ORIGINAL
    // sub-class auto-hit (Cat Burglar/Ninja opener, which also claims
    // C.opened); `auto` additionally honours a descriptor's autoHit without
    // ever touching C.opened — an ability auto-hit never burns the sub's own
    // free opener.
    const subAuto = (c.sub === "Cat Burglar" || c.sub === "Ninja") && !C.opened;
    if (subAuto) C.opened = true;
    const auto = subAuto || !!(AS && AS.autoHit);

    // Phase 73 (ROLL-05): the ONE roll-high check helper reads the strike
    // die. `faces` converts to the lowest winning face via atLeastFor; the
    // draw happens in exactly the same position the previous draw sat, so
    // every seed resolves identically.
    let check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
    // CANON-05 (D-12, p.36): Philly's `slow` gives the player two dice, and
    // keeps the HIGHER of the two mirrored faces — byte-identical to the old
    // rule, which kept the lower raw face of the two (a lower raw face
    // mirrors to a higher roll-high face). DETERMINISM GATE: the second die is drawn
    // ONLY when `t.sp.slow` is truthy; Philly is the sole carrier and is not
    // fixture-exposed, so every other strike draws exactly one die, unchanged.
    if (t.sp && t.sp.slow) {
      const second = rollCheck(rng, dieN, check.atLeast);
      const better = Math.max(check.roll, second.roll);
      check = { roll: better, atLeast: check.atLeast, dieN, ok: better >= check.atLeast };
    }
    const roll = check.roll;

    // faces === 0 gives atLeast = dieN + 1, which no roll can ever reach —
    // this IS the old `need > 0` gate, folded into check.ok.
    const hit = auto || check.ok;
    if (!hit) {
      events.push({
        type: "strikeMissed",
        target: t.name,
        ...rollFields(check),
        untouchable: faces === 0,
        ...(mods.length ? { mods } : {}),
        ...(AS ? { via: AS.key } : {}),
      });
      continue;
    }

    // Phase 72 (ROLL-01 (c)): a landed strike on its die's best face
    // shatters a shatter-flagged foe (the Skeleton) outright — skip the
    // damage roll entirely. Excludes a Con Artist's opening warning blow
    // (`!C.opened2` here reads the SAME "is this the opener" state
    // `opening` below computes, before this call sets it) — that blow deals
    // no injury by rule, so there is nothing to shatter on.
    if (!(c.sub === "Con Artist" && !C.opened2) && shatterIfBest(state, t, roll, dieN, "you", rng, events)) {
      C.opened2 = true;
      continue;
    }

    let dmg = weaponDamage(c, rng);
    if (AS && AS.bonusDmg) dmg += AS.bonusDmg;
    // The hero's OWN crit ban: Guard/Soldier ("your blows never crit") and
    // the dark. Quick 260928-cos (user-approved fix 2026-09-28): the Phase 15
    // (ECON-08) fourth clause, `eff(c, "noCrit") > 0`, is gone. It read the
    // Cloak of Strength ("no critical damage lands on you") as a ban on the
    // WEARER's own crits, so the cloak stopped your crits and not the foe's.
    // The cloak's payload is now `critWard`, read only at the foe-crit sites
    // (foeTurn's hero and member branches, pursuitStrike) through
    // derived.js#critWardOf. Pure read, no rng.
    // RULES-05 (Phase 75): Sense Presence waives the dark no-crit ban too —
    // "full skill in the dark," matching toHit's existing dark-cap waiver.
    // DARK-01 (Phase 76): the dark term reads the one darkness waiver
    // (darkLimited), so a lit torch or a live Amulet restores crits too.
    const noCrit = c.sub === "Guard" || c.sub === "Soldier" || (darkLimited(state) && !c.senses);
    // Phase 39 (GEAR-01): the crit RANGE is now weapon-driven — a precise
    // blade (Rapier/Katana/Wakazashi/Ninja-to/Dagger, crit:2) doubles on the
    // die's top TWO faces; every other weapon still doubles only on the top
    // face (weaponCrit(c) defaults to 1 for an unrecognized/Fists weapon, so
    // this mirrors the old `roll === 1` rule to the top face for every
    // weapon that is not one of the five precise blades).
    let crit = roll >= atLeastFor(weaponCrit(c), dieN) && !noCrit;
    // Phase 25 (FEED-01, additive payload): why THIS crit is a crit, so the
    // Oracle can name the reason instead of a bare "Critical!"; later
    // assignments win (most-specific reason, matching code order below).
    let critBy = crit ? "roll" : null;
    // Phase 73 (ROLL-05): the lowest winning face for the crit that landed —
    // only set for a die-driven crit (critBy "roll"/"stealth"/"ninja");
    // backstab/cutthroat/a forced crit are unconditional and carry no
    // threshold of their own.
    let critAtLeast = crit ? atLeastFor(weaponCrit(c), dieN) : undefined;
    const opening = !C.opened2;
    C.opened2 = true;

    // Phase 38 (ABIL-02, strike_descriptor_spec item 4): Death Touch's finish
    // — a descriptor-driven replacement for the retired Death-touch passive.
    // finishUnder ignores noCrit (a Guard's Death Touch still finishes under
    // 15, it just never doubles) and fires unconditionally on the descriptor,
    // not gated on a natural 1.
    if (AS && AS.finishUnder && t.wp < AS.finishUnder) {
      events.push({ type: "deathTouch", target: t.name, via: AS.key });
      t.wp = 0;
      killFoe(state, t, rng, events);
      continue;
    }
    // "Heavy armor negates any advantages they may gain for stealthiness"
    // Phase 39 (GEAR-01): generalized to armorBulk(c) >= 2 — the old
    // hard-coded list's two lighter-armor strings never matched any real
    // ARMORS row name, so only Plate (bulk 2) ever actually denied; this is
    // byte-identical behaviour for every armor that exists, generalized so a
    // future bulk-2 armor also denies without another hard-coded name.
    const heavy = c.cls === "Thief" && armorBulk(c) >= 2;
    let heavyBackstabDenied = false;
    if (opening && heavy) {
      events.push({ type: "backstabDenied", reason: "heavyArmor" });
      heavyBackstabDenied = true;
    }
    // opening strike: Stealth, Silence, and the plain Thief backstab.
    // DELIBERATE FIX (04.2 Bugs B, E7): a Con Artist's opening blow is a
    // deliberate no-damage "warning" (the `conArtistOpener` bail below emits
    // no `struck` and `continue`s without applying damage). Emitting a
    // backstab/silence/stealth crit here made the game announce "A blade in
    // the back. Critical." for a hit that dealt nothing. Skipping this whole
    // block for a Con Artist opener leaves `conArtistOpener` as the only
    // opener event. No rng change (crit only doubles already-rolled damage
    // that is then discarded by the bail), so determinism/parity are intact.
    if (opening && !noCrit && !heavy && c.sub !== "Con Artist") {
      if (skill(c, "Stealth") && roll >= atLeastFor(STEALTH_CRIT_FACES, dieN) && armorBulk(c) < 2) {
        crit = true;
        critBy = "stealth";
        critAtLeast = atLeastFor(STEALTH_CRIT_FACES, dieN);
        events.push({ type: "stealthStrike" });
      } else if (c.cls === "Thief") {
        crit = true;
        critBy = "backstab";
        critAtLeast = undefined;
        events.push({ type: "backstab" });
      }
    }
    if (c.sub === "Ninja" && !opening && roll >= atLeastFor(2, dieN)) {
      crit = true;
      critBy = "ninja";
      critAtLeast = atLeastFor(2, dieN);
    }
    // a Con Artist's first blow is a warning, not an injury
    if (opening && c.sub === "Con Artist") {
      events.push({ type: "conArtistOpener" });
      continue;
    }
    if (c.sub === "Ninja" && subAuto) {
      // RULES-13 (Phase 75): a Ninja is a Thief and can never wield a magic
      // staff (equipItem's staff branch is MU-only), so this fallback is
      // defensive, not reachable in play — kept via weaponRow anyway, so a
      // tampered/stale c.weapon naming a staff still resolves to its 8, not
      // the bare-hands 6.
      dmg = c.level * c.level + (WEAPON_MAX[c.weapon] || weaponRow(c.weapon)?.max || 6) + c.prof;
      events.push({ type: "ninjaFirstStrike" });
    }
    if (c.sub === "Cutthroat" && !C.cut) {
      crit = true;
      critBy = "cutthroat";
      critAtLeast = undefined;
      C.cut = true;
    }
    // Phase 38 (ABIL-02, strike_descriptor_spec item 5): a forced crit obeys
    // the Guard/Soldier/dark rule exactly like a natural 1 (a
    // Guard's Death Touch still finishes under 15 above, but does not
    // double). Silent Step's crit is specifically denied by heavy armour,
    // like the old Silence branch — the strike still auto-hits (autoHit is
    // independent of forceCrit) — but only pushes ONE backstabDenied for
    // this attack even when the opening-strike heavy check above already did.
    if (AS && AS.forceCrit) {
      const deniedByHeavy = AS.key === "silentStep" && heavy;
      if (!noCrit && !deniedByHeavy) {
        crit = true;
        critBy = AS.key;
        critAtLeast = undefined;
      } else if (deniedByHeavy && !heavyBackstabDenied) {
        events.push({ type: "backstabDenied", reason: "heavyArmor" });
        heavyBackstabDenied = true;
      }
    }
    if (crit) dmg *= 2;
    // Phase 54 (BAND-02, USER RULING D): CLASS_MITIGATION killSpeed — ONE
    // call site covers both rows: a Thief's killSpeed applies only to the
    // opening backstab (critBy === "backstab"); a Fighter's applies to
    // every melee strike regardless of opener (the helper decides which
    // row, if either, applies to this character). Identity 1 for both rows
    // is a structural no-op.
    const killSpeed = classKillSpeedFor(c, { opener: critBy === "backstab" });
    if (killSpeed !== 1) dmg = Math.max(1, Math.round(dmg * killSpeed));
    if (AS && AS.dmgMul) dmg *= AS.dmgMul;
    // Phase 91.1 plan 02 (V10): a Mark adds its marker's level, not +2.
    dmg += markBonus(t);
    // Phase 19 D-10: weakened is the hero-side mirror of the foe-side
    // C.weakened halving below (same ceil rounding, opposite direction) —
    // pure read, 0 draws, false for every fixture.
    if (c.foeEffect && c.foeEffect.kind === "weakened" && c.foeEffect.rounds > 0) dmg = Math.ceil(dmg / 2);
    // RULES-10 (Phase 75.1, hero Shrink): a fumbled Shrink halves the hero's
    // OWN landed weapon damage for the rest of the fight — the mirror of a
    // shrunk FOE's own halved blows (foeTurn's hero/member branches).
    // Current hp only; max hp never changes (75.1-CONTEXT's flagged
    // assumption). Pure read, 0 draws; false on every fixture.
    if (C.heroShrunk) dmg = Math.ceil(dmg / 2);
    // Phase 31 Afraid — pure arithmetic on already-rolled values, zero rng;
    // false (afraidMods empty, dmg unchanged) for every non-phobia fixture.
    dmg = afraidDamage(state, dmg);
    // CANON-01/03/04 (D-05..D-11): route the hero's weapon hit through the
    // seam. `casterClass`/`casterSub` let the multiplier table identify a
    // Fighter's melee vs Trachea (D-11/D-20 — hero-only); `crit` lets a
    // critical bypass the armor soak (D-07). On a soak the seam's own
    // `foeArmorSoaked` is the only narration for this blow — no `struck`.
    blowLanded = true;
    const landed = damageFoe(state, t, dmg, { kind: "melee", casterClass: c.cls, casterSub: c.sub, crit }, rng, events);
    if (!landed.soaked)
      events.push({
        type: "struck",
        target: t.name,
        ...rollFields(check),
        dmg: landed.applied,
        critical: crit,
        ...(crit && critBy ? { critBy } : {}),
        ...(crit && critBy && critAtLeast != null ? { critAtLeast } : {}),
        ...(mods.length ? { mods } : {}),
        ...(afraidMods.length ? { afraid: true } : {}),
        ...(auto ? { auto: true } : {}),
        ...(landed.soak ? { soak: landed.soak } : {}),
        ...(AS ? { via: AS.key } : {}),
      });
    if (t.wp <= 0) killFoe(state, t, rng, events);
  }
  // Phase 90 (ABIL-07, report #4): Pommel Strike's stun. A landed blow that
  // leaves the target standing costs it its next turn, once however many
  // blows landed (a double strike stuns once); a killing blow stuns nobody.
  // After the strike's own hit events, so the Oracle reads blow, then stun.
  // A flag, no draw.
  if (AS && AS.stunOnHit && blowLanded && t.alive) {
    applyPommel(t);
    events.push({ type: "pommelStruck", target: t.name });
  }
  // Phase 91.1 plan 02 (V11, user 2026-10-01): Cutpurse is a normal strike that
  // also lifts d10 x level gold when a blow lands, once however many blows
  // landed, after the blow's own events. The d10 is rolled only on a landed
  // blow and from a derived stream (cutpurseGold), so the strike's own draws
  // are exactly the plain strike's. A miss lifts nothing.
  if (AS && AS.liftGold && blowLanded) {
    const amount = cutpurseGold(state, rng, c.level, "you");
    events.push({ type: "cutpursed", target: t.name, amount });
    gainWilmst(state, amount, "cutpurse", rng, events);
  }
  // Phase 38 (ABIL-02, strike_descriptor_spec item 8): the descriptor is
  // transient — never present on state.combat once this function returns,
  // so afterPlayerAction (and anything after it) never sees it.
  if (C.abilityStrike) delete C.abilityStrike;
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * foeSpoils(state, f, rng, events, opts) — Phase 91 plan 05 (PARLEY-01): the
 * spoils a foe pays, extracted from killFoe with no change of statement or
 * draw order so a kill is byte-identical: the coin purse (`rng.d(10)`, scaled
 * by level and the purse of its type, `gainWilmst` with `opts.why`, default
 * "off the body"), then the item-drop check (`rollCheck` on a d20 against
 * `2 + lvl` faces), `rollTreasureItem`, the bag-upgrade check when a tier is
 * open, and `offerLoot` into the pending pile. killFoe calls it with the main
 * rng; a won parley calls it for every live foe with a derived stream
 * (`derivedRng(cursor, the parleySpoils key, acts)`), so the parley never moves the
 * main cursor for the spoils. The Cooking ration a slain beast gives stays in
 * killFoe (a parleyed beast walks away alive). Returns `{ gold, items }`: the
 * wilmst credited to the hero and the number of items offered (0 or 1; 2 for a
 * Pickpocket, whose extra item IDENT-18 follows the regular drop).
 *
 * Phase 91 plan 08 (IDENT-18, user 2026-09-30): "whenever you gain an item from
 * a chest or a monster, you gain one extra item as well" - a Pickpocket's
 * passing drop check offers a second, separate pile entry (`pickpocketExtra`,
 * `lootDropped { pickpocket: true }`) rolled from
 * `derivedRng(cursor, "pickpocket", acts, pile length)`. The Pickpocket's old
 * extra gold take (Q1 B) is gone from `gainWilmst`.
 *
 * DETERMINISM GATE (Phase 29, LOOT-01/05): the gate d20 and every
 * rollTreasureItem draw are UNCHANGED and still sit first, in the same order
 * — only the destination changes, from the legacy auto-take to the pending
 * pile (offerLoot). The bag-swap d20 fires ONLY when bagUpgradeTier(state) is
 * non-null (depth >= 2 with an upgrade tier available). Phase 73 (ROLL-05):
 * both gates read roll-high through rollCheck — same draws, same positions,
 * same short-circuit. offerLoot's optional 4th argument carries the roll-high
 * triple(s) for the parity invariant/Oracle.
 */
export function foeSpoils(state, f, rng, events = [], opts = {}) {
  const c = state.c;
  const goldBefore = c.gold;
  const purse = { Humans: 12, Demons: 8, Magical: 8, "Walking Dead": 6, "Lair Beasts": 3, Beasts: 1 }[f.type] || 4;
  // Phase 54 (BAND-02, USER RULING D): LOOT_SCALE, applied POST-DRAW —
  // identity (1) is a no-op.
  const coin = lootFor(Math.round((rng.d(10) * f.lvl * purse) / LOOT_DIVISOR)); // roll:amount
  if (coin > 0) gainWilmst(state, coin, opts.why ?? "off the body", rng, events);
  let items = 0;
  const lootCheck = rollCheck(rng, 20, atLeastFor(2 + f.lvl, 20));
  if (lootCheck.ok) {
    let drop = rollTreasureItem(rng, state.floor.depth, c);
    const tier = bagUpgradeTier(state);
    const bagCheck = tier ? rollCheck(rng, 20, atLeastFor(BAG_DROP_FACES, 20)) : null;
    if (bagCheck && bagCheck.ok) drop = bagItemFor(tier);
    offerLoot(state, drop, events, { ...rollFields(lootCheck), ...(bagCheck ? { bag: rollFields(bagCheck) } : {}) });
    items = 1;
    // Phase 91 plan 08 (IDENT-18, user 2026-09-30): a Pickpocket gains one extra
    // item whenever a monster gives it one, right behind the regular drop, from
    // the derived "pickpocket" stream (the main rng is not touched). A kill and
    // a won parley both reach this line; a failed drop check never does.
    items += pickpocketExtra(state, rng, events);
  }
  return { gold: c.gold - goldBefore, items };
}

/**
 * partyXpShares(state) — the number of ways an experience award splits: the hero
 * plus every Joiner still on its feet in the fight (`combat.allies` with hp
 * left), at least 1. The ONE rule killFoe's kill split and parley's won-fight
 * split both read (Phase 91 plan 09, orchestrator amendment, user 2026-10-01:
 * a won parley's experience is split with Joiners exactly as a kill's is). Pure,
 * no rng; 1 with no Joiner, so a solo hero's award is untouched.
 */
export function partyXpShares(state) {
  const liveMembers = state.combat && state.combat.allies ? state.combat.allies.filter((a) => a.wp > 0) : [];
  return 1 + liveMembers.length;
}

/**
 * killFoe(state, f, rng, events) — a foe's death: lives (kill-twice), the
 * skill-point formula (d6 x level x mul, with spMul/Barbarian/Apprentice
 * modifiers), coin via gainWilmst, treasure via rollTreasureItem, offered
 * into the pending loot pile (Phase 29, LOOT-01 — replaces the legacy
 * auto-take), cooking, and checkLevel. Ports mazeworld.html killFoe() (lines
 * 2410-2443).
 *
 * Phase 90 plan 04 (SPELL-12, Q2 A, user 2026-09-30): `opts.spoils === false`
 * is a kill that pays its experience (the d6, the party split, checkLevel)
 * and nothing else: no coin, no treasure gate or bag gate, no cooking. Only
 * Petrify passes it ("a statue carries nothing"); the skipped draws (the coin
 * d10, the treasure d20, the bag d20, the cooking d6) are not taken, so a
 * Petrify's main-rng cursor moves less than a normal kill's.
 */
export function killFoe(state, f, rng, events = [], opts = {}) {
  const c = state.c;
  if (f.lives > 1) {
    f.lives--;
    f.wp = f.maxWP;
    events.push({ type: "foeRevived", name: f.name });
    return events;
  }
  f.alive = false;
  f.wp = 0;
  c.kills = (c.kills || 0) + 1;
  const roll = rng.d(6); // roll:amount
  // PARLEY-01 / D-01 (Phase 20): same draw, same call site, same arithmetic —
  // now shared with parley() via engine/derived.js#killSpFor.
  const gained = killSpFor(c, f, roll);
  // PARTY-06 (Phase 8): canon splits the XP award among participants (hero +
  // members present). Members are hired muscle in v1 (no XP progression), so
  // their shares are simply DISCARDED — the split's only effect is to damp the
  // hero's gain, the built-in counterweight to a party's faster clears. Loot
  // and wilmst (below) stay 100% the hero's.
  //
  // DETERMINISM GATE: the `rng.d(6)` that produced `roll` above is UNCHANGED
  // and still drawn unconditionally (it must be — every combat fixture pins it).
  // The split is pure post-draw arithmetic, applied ONLY when `shares > 1`
  // (i.e. live members are present). With no members `shares === 1` and
  // `heroShare === gained` exactly, so both `c.sp` and the `foeKilled` event
  // are byte-identical to today.
  const shares = partyXpShares(state);
  const heroShare = shares > 1 ? Math.round(gained / shares) : gained;
  // Phase 54 (BAND-02, USER RULING D): HERO_SP_SCALE paces every SP grant —
  // identity (1) is a no-op here.
  const spGained = heroSpFor(heroShare);
  c.sp += spGained;
  events.push({ type: "foeKilled", name: f.name, spGained });

  // Phase 90 plan 04 (Q2 A): a kill with no spoils (Petrify) stops here, after
  // the experience and before the coin, treasure, bag and cooking steps.
  if (opts.spoils === false) {
    checkLevel(state, rng, events);
    return events;
  }

  // creatures carry things, and the things are worth wilmst: the coin purse and
  // the item-drop check (Phase 91 plan 05, PARLEY-01: extracted unchanged into
  // foeSpoils so a won parley rolls the very same spoils).
  foeSpoils(state, f, rng, events);

  if (f.type === "Beasts" || f.type === "Lair Beasts") {
    if (skill(c, "Cooking")) {
      const fed = Math.max(1, Math.round(f.maxWP / 4));
      const before = c.wp;
      c.wp = Math.min(c.maxWP, c.wp + fed);
      c.rations++;
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
      // actually added after the clamp to max (additive, zero draws).
      events.push({ type: "cooked", wp: fed, rations: 1, gained: c.wp - before });
    } else if (rng.d(6) >= 4) { // roll:already-high
      c.rations++;
      events.push({ type: "cooked", wp: 0, rations: 1 });
    }
  }
  checkLevel(state, rng, events);
  return events;
}

/**
 * resistControl(state, foe, effect, source, idx, rng, events) — RULES-18
 * (Phase 75.3, user ruling 2026-09-25): the past-the-knee control resist.
 * Phase 89 plan 08 moved every item effect and the Freeze and Weaken tails
 * onto `foeResistsEffect`, the depth-rising resist, and Phase 90 plan 04 moved
 * every spell (the hero's, a scroll's, a Joiner's) onto it too; Phase 91 plan
 * 06 (IDENT-17) moved the last caller, the Bard's `sing` (two sleeps, audit id
 * C13), onto castSpell's free mode (the one shared rising resist), so NOTHING
 * in the engine calls this any more; it stays exported for the RULES-18 unit
 * pins that still exercise it directly. Reads
 * `engine/derived.js#controlResistCheck` — a derived-stream, roll-high check
 * that draws NOTHING from the caller's own `rng` (the main cursor is
 * untouched either way) and returns `false` with no roll and no event at or
 * below `CONTROL_AT_DEPTH.kneeDepth` (floor 12 and shallower stay exactly as
 * today). On a resist: marks `foe.resisted = effect` (read by
 * src/browser/foeConditions.js's Unmoved chip) and pushes `{ type:
 * "controlResisted", target: foe.name, effect, source, roll, atLeast, dieN,
 * depth }`, then returns `true` — the caller MUST stop there (the foe stands,
 * untouched by the control). On a miss (rolled and failed, or never rolled
 * at all): returns `false` with no mutation and no event — the caller
 * proceeds to land the control (or, for an indefinite one, to `holdFoe`
 * below).
 */
export function resistControl(state, foe, effect, source, idx, rng, events) {
  const depth = state.floor?.depth;
  const result = controlResistCheck(state, rng, `${effect}:${source}`, idx);
  if (!result.rolled) return false;
  if (result.resisted) {
    foe.resisted = effect;
    events.push({ type: "controlResisted", target: foe.name, effect, source, roll: result.roll, atLeast: result.atLeast, dieN: result.dieN, depth });
    return true;
  }
  return false;
}

/**
 * foeResistsSpell(state, foe, spell, rng, events, by) — user ruling
 * 2026-09-27 (quick 260927-rsx): "Every spell cast on an enemy should have a
 * chance to be resisted based on their intelligence ... I want the resist
 * rolls noted in the Oracle, too." The ONE gate every spell cast on a foe
 * calls, once per targeted foe, BEFORE anything of the spell touches that
 * foe: the hero's castSpell (every kind except derived.js#SPELL_SELF_KINDS,
 * which includes a scroll's free cast), a Joiner's allyCast, and a staff or
 * amulet activation that lays a spell on foes (engine/items.js). Rolls
 * derived.js#foeRisingResistCheck (a derived stream, so the check never moves
 * the main rng) and ALWAYS narrates: `spellResisted` on a resist (the
 * caller then gives that foe NO effect — damage included) or
 * `resistFailed` on a miss, each carrying `{ target, spell, roll, atLeast,
 * dieN, intel, faces }` plus `by` (the caster's name) when a Joiner cast
 * it. Returns `true` when the foe resisted.
 *
 * Phase 90 plan 04 (SPELL-12, user ruling at the Phase 89 checkpoint, 2026-09-30:
 * "rising resists on higher floors should apply to ALL spells ... remove the
 * floor-12 special effects only"): this IS `foeResistsEffect` below, the ONE
 * depth-rising resist (`derived.js#risingResistFaces`). Every spell a foe can
 * resist rolls it once per targeted foe; there is no second, separate control
 * resist after it and no hold, cap or three-round limit on a landed spell.
 * At or below floor 12 the rising faces ARE the half-intelligence faces, byte
 * for byte, so nothing at those depths moves. (`resistControl` above survives
 * for nothing now: the Bard's songs moved onto this gate in Phase 91 plan 06.)
 */
export function foeResistsSpell(state, foe, spell, rng, events, by, extra) {
  return foeResistsEffect(state, foe, spell, rng, events, by, extra);
}

/**
 * foeResistsEffect(state, foe, source, rng, events, by, extra) — Phase 89 plan
 * 08 (ITEM-01, user ruling Q1, 2026-09-30): THE depth-rising resist gate, the
 * twin of `foeResistsSpell` above. One roll per foe the effect reaches, on
 * `derived.js#risingResistFaces` (the foe's half-intel faces plus the faces
 * the floor adds past floor 12, capped at 19), from a derived stream (the
 * main rng never moves), always narrated (`spellResisted` / `resistFailed`,
 * carrying `depthFaces` when the floor added any). There is NO second control
 * resist and NO hold after it: a foe that fails this roll takes the effect's
 * floor-1 form at every depth. Returns `true` when the foe resisted.
 *
 * Every item and staff effect a foe can resist goes through here (the Birch
 * Staff's freeze via `freezeFoe`, the Walnut Staff's weaken via
 * `roomWeakenResists`, the Oak Staff and Amulet of Stone's stone, the Pine
 * Staff's fire, the Cedar Staff's gas), and since Phase 90 plan 04 every
 * spell too (`foeResistsSpell` above is this gate under its spell name).
 */
export function foeResistsEffect(state, foe, source, rng, events, by, extra) {
  const C = state.combat;
  const idx = C && Array.isArray(C.foes) ? C.foes.indexOf(foe) : -1;
  const intel = Number.isFinite(foe.intel) ? foe.intel : 0;
  const res = foeRisingResistCheck(state, rng, source, idx, intel, by || "you");
  return pushResist(res, foe, source, events, by, intel, extra, res.depthFaces);
}

/**
 * pushResist(res, foe, spell, events, by, intel, extra, depthFaces) — the one
 * resist line both gates share: pushes `spellResisted` or `resistFailed` and
 * returns whether the foe resisted. User ruling 2026-09-28: `extra`
 * (optional) rides on the event — a Freeze's post-damage resist carries
 * `{ freeze: true }` (freezeFoe below), so the line says the damage landed and
 * only the ice was shrugged off. `depthFaces` (optional, > 0 only) is the
 * rising resist's floor bonus, additive.
 */
function pushResist(res, foe, spell, events, by, intel, extra, depthFaces) {
  const payload = {
    target: foe.name,
    spell,
    ...(by ? { by } : {}),
    roll: res.roll,
    atLeast: res.atLeast,
    dieN: res.dieN,
    intel,
    faces: res.faces,
    ...(depthFaces > 0 ? { depthFaces } : {}),
    ...(extra || {}),
  };
  events.push({ type: res.resisted ? "spellResisted" : "resistFailed", ...payload });
  return res.resisted;
}

/**
 * roomWeakenResists(state, spell, rng, events, by) — a room-wide Weaken (the
 * hero's spell, a Joiner's, the Walnut Staff) under the per-foe rule of quick
 * 260927-rsx: every live foe rolls its own resist (foeResistsEffect, in
 * C.foes order). When every one resists, nothing lands (returns false).
 * Phase 89 plan 08 (ITEM-01, user ruling Q1, 2026-09-30): that resist IS the
 * depth-rising one (`derived.js#risingResistFaces`); the old extra room
 * resist past floor 12 (one `resistControl` keyed on the aimed foe, which
 * marked every live foe Unmoved) is gone, and so is the `aimed` argument it
 * needed. When the Weaken lands (returns true), a foe
 * that resisted is marked `weakenResisted` — but only if no Weaken was
 * already running (a resist shrugs off the new cast, not an old one that
 * already took) — and every foe that did not resist loses the mark; the
 * CALLER then sets `C.weakened`/`C.foeToHitPenalty`/its timer, which
 * derived.js#foeWeakened reads per foe.
 */
export function roomWeakenResists(state, spell, rng, events, by) {
  const C = state.combat;
  const live = liveFoes(state);
  const shrugged = new Set(live.filter((f) => foeResistsEffect(state, f, spell, rng, events, by)));
  if (shrugged.size === live.length) return false;
  const already = !!C.weakened;
  for (const f of live) {
    if (!shrugged.has(f)) delete f.weakenResisted;
    else if (!already) f.weakenResisted = true;
  }
  return true;
}

/**
 * holdFoe(state, foe, kind, source, events, opts) — the ONE hold: sets
 * `foe.held = { kind, left: opts.rounds }` and pushes `{ type: "controlHeld",
 * target: foe.name, kind, rounds: left, source }`. `kind` is "frozen" (a
 * Freeze's or Ice's d4 freeze) or "stunned" (Stun's d4 hold); both read the
 * same: `foeTurn`'s held skip below counts it down one foe visit at a time,
 * `derived.js#targetStrikeFaces` hits a held foe on at least 5 winning faces,
 * and nothing a blow does ends it (src/browser/foeConditions.js reads `kind`
 * for the Held chip).
 *
 * Phase 90 plan 05 (SPELL-11): `opts.rounds` is REQUIRED, a positive integer
 * (the old RULES-18 `controlHoldRoundsFor` depth default is gone: nothing
 * holds for a depth-fixed count any more). A new hold NEVER SHORTENS a longer
 * one still running: when the foe already holds with more rounds left than
 * `opts.rounds`, the longer hold (its kind and its rounds) stands, and the
 * line is still pushed for the new cast, carrying the hold that is in force.
 * Optional `opts`: `freeze: true` (the event carries `freeze: true`, so the
 * line reads "frozen for N rounds"), `dmg` (the damage the same hit landed,
 * with `freeze`), `by` (a Joiner's name).
 *
 * Returns the rounds now in force.
 */
export function holdFoe(state, foe, kind, source, events, opts = {}) {
  const { rounds, freeze, dmg, by } = opts;
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error("holdFoe: opts.rounds must be a positive integer");
  if (!(foe.held && foe.held.left > rounds)) foe.held = { kind, left: rounds };
  events.push({
    type: "controlHeld",
    target: foe.name,
    kind: foe.held.kind,
    rounds: foe.held.left,
    source,
    ...(by ? { by } : {}),
    ...(freeze ? { freeze: true, ...(Number.isFinite(dmg) ? { dmg } : {}) } : {}),
  });
  return foe.held.left;
}

/**
 * FREEZE_HOLD_DIE — user ruling 2026-09-28: "freeze should never kill
 * outright. It should deal its damage and freeze an enemy for 1d4 rounds."
 * The die a landed, unresisted Freeze rolls for its hold (freezeFoe below).
 */
export const FREEZE_HOLD_DIE = 4;

/**
 * freezeFoe(state, t, source, rng, events, opts) — user rulings 2026-09-28:
 * the freeze tail every Freeze shares — the hero's cast (a scroll's free
 * cast included), a Joiner's allyCast and the Birch Staff's freeze power.
 * The caller has already landed the hit and its damage (none for the staff),
 * and `t` is still standing (a Freeze whose damage kills is a normal kill,
 * never frozen solid). In order:
 *   1. one NEW main-rng draw, rng.d(FREEZE_HOLD_DIE) — the hold's rounds,
 *      taken right after the damage, whenever the foe survives, resisted or
 *      not (the RULES-18 main-draw parity: a resisted and a landed freeze
 *      take the same main draws, like Doze's d4);
 *   2. the foe's depth-rising resist (foeResistsEffect: the 2026-09-27
 *      derived-stream resist, its faces rising with the floor since Phase 89
 *      plan 08). A resist stops only the freeze: the damage already landed.
 *      When the hit did damage (`opts.dmg` set) the event carries
 *      `freeze: true` so the line says so;
 *   3. otherwise a frozen hold (holdFoe, kind "frozen") for the rolled
 *      rounds, at every depth.
 * Phase 89 plan 08 (ITEM-01, user ruling Q1): the separate RULES-18 control
 * resist that used to sit between 2 and 3 past floor 12 is gone; the one
 * resist rises with depth instead. It is a derived stream, so it never moves
 * the main rng. Returns the rounds held, or 0 when the foe resisted.
 */
export function freezeFoe(state, t, source, rng, events, opts = {}) {
  const { by, dmg } = opts;
  const hasDmg = Number.isFinite(dmg);
  const rounds = rng.d(FREEZE_HOLD_DIE); // roll:amount
  if (foeResistsEffect(state, t, source, rng, events, by, hasDmg ? { freeze: true } : undefined)) return 0;
  holdFoe(state, t, "frozen", source, events, { rounds, freeze: true, ...(hasDmg ? { dmg } : {}), ...(by ? { by } : {}) });
  return rounds;
}

/**
 * dozeFoes(state, sp, rng, events, caster) — Phase 90 plan 05 (SPELL-11, user
 * 2026-09-30: "Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing
 * foe"; Q4 A: exactly d4 foes, your target first). The ONE Doze tail: the
 * hero's cast (a scroll's free cast included) and a Joiner's allyCast both
 * call it. In order:
 *   1. the reach, one d4 on the main rng, drawn first (no level multiplier);
 *   2. the reached foes: the current target when it is alive, then the other
 *      live foes in C.foes order, the first `reach` of them (a reach larger
 *      than the live foes sleeps every live foe once);
 *   3. per reached foe, in that order: the one depth-rising resist
 *      (foeResistsSpell, a derived stream); a foe that resists stays awake and
 *      draws nothing; else its OWN d4 on the main rng, `f.asleep = max(f.asleep,
 *      d4)` (a longer sleep it already has stands), `f.dozing = true` (the mark
 *      damageFoe reads to wake it on a hit, and that foeTurn clears when the
 *      sleep runs out) and one `dozed { target, rounds, by? }` line;
 *   4. when nobody slept, one closing `dozeFailed { by? }` line.
 * `caster` is `{ by }` (a Joiner's name; the hero's when absent): it only
 * names the caster on the resist and sleep lines, since Doze's reach does not
 * scale with level.
 */
export function dozeFoes(state, sp, rng, events, caster = {}) {
  const C = state.combat;
  if (!C) return 0;
  const by = caster.by;
  const reach = rng.d(4); // roll:amount
  const live = liveFoes(state);
  const aimed = C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
  const order = aimed ? [aimed, ...live.filter((f) => f !== aimed)] : live;
  let slept = 0;
  for (const f of order.slice(0, reach)) {
    if (foeResistsSpell(state, f, sp.n, rng, events, by)) continue;
    const rolled = rng.d(4); // roll:amount
    f.asleep = Math.max(f.asleep || 0, rolled);
    f.dozing = true;
    slept++;
    events.push({ type: "dozed", target: f.name, rounds: f.asleep, ...(by ? { by } : {}) });
  }
  if (!slept) events.push({ type: "dozeFailed", spell: sp.n, ...(by ? { by } : {}) });
  return slept;
}

/**
 * stunFoe(state, t, sp, rng, events, caster) — Phase 90 plan 05 (SPELL-11,
 * user 2026-09-30: "Stun holds one foe for d4 rounds and a hit does not end
 * it"). The ONE Stun tail, shared by the hero's cast and a Joiner's allyCast:
 * the caller has already rolled the target's one depth-rising resist and the
 * foe did not resist. One d4 on the main rng (the hold's rounds), then
 * holdFoe kind "stunned": the foe skips that many of its turns, is hit on at
 * least 5 winning faces, a hit does not end the hold, and a new hold never
 * shortens a longer live one. Returns the rounds now in force.
 */
export function stunFoe(state, t, sp, rng, events, caster = {}) {
  const rounds = rng.d(4); // roll:amount
  return holdFoe(state, t, "stunned", sp.n, events, { rounds, ...(caster.by ? { by: caster.by } : {}) });
}

/**
 * stopTime(state, sp, rng, events, caster) — Phase 90 plan 08 (SPELL-10, the
 * accepted slate: "Stop Time: every foe stops for 2 rounds"; Q6 A: +1 round per
 * school bonus point). The ONE Stop Time tail, shared by the hero's cast (a
 * scroll's free cast included) and, later, a Joiner's: for each live foe in
 * C.foes order, the one depth-rising resist (foeResistsSpell, a derived
 * stream); a foe that fails it is held kind "time" (holdFoe) for
 * `spellEffectRounds(sub, sp, sp.holdRounds)` rounds: it skips that many turns,
 * a blow does not end or restart the hold, strikes against it land on at least
 * the top five faces (derived.js#targetStrikeFaces, as for a sleeper), and a
 * longer live hold stands. One closing `timeStopped { count, rounds, by? }`
 * line (count 0 when every foe resisted). Draws nothing on the main rng.
 * `caster` is `{ by, sub }` (a Joiner's name and sub-class; the hero's when
 * absent). Returns the number of foes held.
 */
export function stopTime(state, sp, rng, events, caster = {}) {
  const C = state.combat;
  if (!C) return 0;
  const by = caster.by;
  const sub = caster.sub !== undefined ? caster.sub : state.c.sub;
  const rounds = spellEffectRounds(sub, sp, sp.holdRounds);
  let count = 0;
  for (const f of liveFoes(state)) {
    if (foeResistsSpell(state, f, sp.n, rng, events, by)) continue;
    holdFoe(state, f, "time", sp.n, events, { rounds, ...(by ? { by } : {}) });
    count++;
  }
  events.push({ type: "timeStopped", count, rounds, ...(by ? { by } : {}) });
  return count;
}

/**
 * misdirectFoe(state, t, sp, rng, events, caster) — Phase 90 plan 08 (SPELL-10,
 * Senseless at Illusion 2 and Duplicate Foe at Illusion 5; the slate's wiring C,
 * the one genuinely new combat system). The ONE tail both spells share, for the
 * hero's cast (a scroll's free cast included) and, later, a Joiner's: the
 * target `t` swings at the wrong side for a few rounds. `sp.at` is "friends"
 * (Senseless: the first other live foe in C.foes order) or "self" (Duplicate
 * Foe: itself); `sp.rounds` is the duration dice. The hero's cast rolled the
 * target's one depth-rising resist up front (magic.js SINGLE_TARGET_KINDS); a
 * Joiner's cast (`caster.by`) rolls it here. One main-rng draw: the duration dice
 * (the cast's own), plus `spellEffectRounds` (Q6 A: +1 round per school bonus
 * point of the caster's Illusion). The record is `t.misdirect = { at, left }`,
 * counted down once per turn the foe actually takes (resolveMisdirectedTurn);
 * a held, sleeping or stunned turn spends none. A new cast never shortens a
 * longer live one (the longer record, its `at` and its rounds, stands; the
 * line still reports what is in force, as holdFoe does). Returns the rounds
 * now in force, or 0 when a Joiner's target resisted.
 */
export function misdirectFoe(state, t, sp, rng, events, caster = {}) {
  const by = caster.by;
  if (by && foeResistsSpell(state, t, sp.n, rng, events, by)) return 0;
  const sub = caster.sub !== undefined ? caster.sub : state.c.sub;
  const rounds = spellEffectRounds(sub, sp, rollDice(rng, sp.rounds));
  if (!(t.misdirect && t.misdirect.left > rounds)) t.misdirect = { at: sp.at, left: rounds };
  events.push({ type: "foeMisdirected", target: t.name, at: t.misdirect.at, rounds: t.misdirect.left, ...(by ? { by } : {}) });
  return t.misdirect.left;
}

/**
 * resolveMisdirectedTurn(state, f, rng, events, curve) — Phase 90 plan 08
 * (SPELL-10): the whole turn of a foe whose `misdirect.left > 0` (Senseless,
 * Duplicate Foe). Called from foeTurn right after the held, asleep and stunned
 * skips (a turn those take never spends `left`) and before the flee check and
 * the ability gate (the whole turn is misdirected, so a caster does not cast).
 * Every swing the foe has (`frenzied` doubles, `sp.atk` multiplies, as its
 * normal turn) is aimed at a foe, NEVER at the hero or a Joiner (pickFoeTarget
 * is not called): itself (`at: "self"`) or the first other live foe in C.foes
 * order (`at: "friends"`, as Insane's strike-an-ally picks, so no draw). With no
 * such foe the foe swings at the air once (`foeSwingsAtAir`) and the turn is
 * lost. A swing draws exactly what the foe's own swing would, in the same
 * positions: the to-hit die on the main rng (rollCheck on `foeDie(null, f)`
 * against derived.js#foeSwingVsFoe's faces, no body's defences, blind caps it
 * to the top face), then, on a hit, the damage dice (a top-face crit doubles
 * them unless the foe is blind); damage is the normal chain (foeLevelBase, the
 * curve and elite, Weaken's, Shrink's and Hamstring's halving; no per-round
 * ceiling, which guards the hero's side only) dealt through damageFoe as a
 * foe's blow (kind "foe": the victim's natural armour may soak it) and a kill
 * through killFoe, so the hero is paid its experience and spoils. After the
 * swings `left` counts down; at 0 the record goes with one `foeMisdirectEnded`
 * line.
 */
function resolveMisdirectedTurn(state, f, rng, events, curve) {
  const C = state.combat;
  const m = f.misdirect;
  const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);
  const dieN = foeDie(null, f);
  for (let s = 0; s < swings; s++) {
    if (!f.alive) break;
    const victim = m.at === "self" ? f : liveFoes(state).find((o) => o !== f);
    if (!victim) {
      events.push({ type: "foeSwingsAtAir", name: f.name });
      break;
    }
    const self = victim === f;
    const { faces } = foeSwingVsFoe(state, f);
    const check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
    const { roll, atLeast } = check;
    if (!check.ok) {
      events.push({ type: "foeMisdirectedMiss", name: f.name, target: victim.name, self, roll, atLeast, dieN });
      continue;
    }
    const crit = !f.blind && isBestFace(roll, dieN);
    const dice = f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6); // roll:amount
    let dmg = foeHitFor(foeLevelBase(f) + (crit ? 2 * dice : dice), curve, f.elite || 0);
    if (foeWeakened(C, f)) dmg = Math.ceil(dmg / 2);
    if (f.shrunk) dmg = Math.ceil(dmg / 2);
    if (f.hamstrung) dmg = Math.ceil(dmg / 2);
    const hit = damageFoe(state, victim, dmg, { kind: "foe", crit }, rng, events);
    if (!hit.soaked) {
      events.push({ type: "foeMisdirectedHit", name: f.name, target: victim.name, dmg: hit.applied, self, roll, atLeast, dieN, ...(crit ? { crit: true } : {}) });
    }
    if (victim.wp <= 0) killFoe(state, victim, rng, events);
  }
  if (f.alive && f.misdirect === m && --m.left <= 0) {
    delete f.misdirect;
    events.push({ type: "foeMisdirectEnded", name: f.name, at: m.at });
  }
}

/**
 * iceStorm(state, sp, rng, events, caster) — Phase 90 plan 05 (SPELL-12, user
 * 2026-09-30: "Ice is an area d10 to every foe with a chance to freeze each
 * target 1d4 rounds"; Q5 A: no to-hit roll, each foe its own d10 + the
 * caster's level², a survivor frozen d4 rounds unless it resists, the resist
 * stopping only the freeze). The ONE Ice tail, shared by the hero's cast (a
 * scroll's free cast included) and a Joiner's allyCast. `caster` is
 * `{ by, sheet, level, sub }`; with no `by` it is the hero (`state.c`).
 *
 * One `iceCast` line, then for each live foe in C.foes order: its damage dice,
 * a live Strength's extra d10 (Q1 A), the caster's level² and any spellDmg item
 * bonus, through Afraid's halving and the difficulty seam (the hero's own
 * damage, as a thrown spell's), then damageFoe (kind "spell", school "blast")
 * and a `spellHit` (a Joiner's: `allySpellHit` with effect "damage"); a foe
 * the damage kills is a normal kill (killFoe, no freeze); a survivor then goes
 * through freezeFoe (a d4, the resist, a frozen hold), foe by foe, before the
 * next foe is touched. A damaging hit wakes a dozing foe (damageFoe).
 */
export function iceStorm(state, sp, rng, events, caster = {}) {
  const C = state.combat;
  if (!C) return;
  const by = caster.by;
  const sheet = caster.sheet || state.c;
  const level = Number.isFinite(caster.level) ? caster.level : sheet.level;
  const sub = caster.sub !== undefined ? caster.sub : sheet.sub;
  const levelSq = spellLevelSq({ level });
  const targets = liveFoes(state);
  events.push({ type: "iceCast", spell: sp.n, foes: targets.length, ...(by ? { by } : {}) });
  for (const f of targets) {
    if (!f.alive) continue;
    const raw = rollDice(rng, sp.dmg) + strengthRoll(sheet, rng) + levelSq + eff(sheet, "spellDmg");
    const dmg = by ? raw : afraidDamage(state, spellDamageFor(raw, sheet));
    const hit = damageFoe(state, f, dmg, { kind: "spell", school: sp.kind, casterSub: sub, ...(by ? { by } : {}) }, rng, events);
    if (by) events.push({ type: "allySpellHit", name: by, spell: sp.n, target: f.name, effect: "damage", dmg: hit.applied });
    else events.push({ type: "spellHit", spell: sp.n, target: f.name, dmg: hit.applied, levelSq, ...(C.afraid > 0 ? { afraid: true } : {}) });
    if (f.wp <= 0) {
      killFoe(state, f, rng, events);
      continue;
    }
    freezeFoe(state, f, sp.n, rng, events, { dmg: hit.applied, ...(by ? { by } : {}) });
  }
}

/**
 * shatterIfBest(state, t, roll, dieN, by, rng, events, extra = {}) — Phase 72
 * (ROLL-01 (c), user ruling 2026-09-24): "rolling max on your dice triggers
 * the shatter." Any to-hit roll aimed at a shatter-flagged foe (`t.sp.shatterOnBest`,
 * the Skeleton) that shows the striking die's best face (`isBestFace`)
 * destroys it outright, both lives — see docs/ROLL-LEDGER.md `## Skeleton
 * shatter scope` for exactly which strikers count. Returns `false` (a no-op)
 * unless the target is a live, shatter-flagged foe AND the roll is the die's
 * best face; a caller MUST check the to-hit already LANDED before calling
 * this (a Con Artist's no-injury opener is excluded by its own caller, not
 * here). On a shatter: pushes `{ type: "foeShattered", target: t.name, by,
 * roll, atLeast: dieN, dieN, ...extra }` (every caller now passes the
 * mirrored roll-high roll; the lowest winning face for a shatter IS the top
 * face, `dieN`), sets `t.lives = 1` (so `killFoe` takes both the current and
 * the kill-twice life in the same call) and `t.wp = 0`, calls `killFoe`, and
 * returns `true`. Draws NO weapon-damage or spell-damage dice — the caller
 * MUST skip its own damage roll on a shatter.
 */
export function shatterIfBest(state, t, roll, dieN, by, rng, events, extra = {}) {
  if (!t || !t.alive || !t.sp || !t.sp.shatterOnBest || !isBestFace(roll, dieN)) return false;
  events.push({ type: "foeShattered", target: t.name, by, roll, atLeast: dieN, dieN, ...extra });
  t.lives = 1;
  t.wp = 0;
  killFoe(state, t, rng, events);
  return true;
}

/**
 * foeLevelBase(f) — the `lvl^2` term of a foe's melee damage formula, shared
 * by `pursuitStrike`, the member branch and the hero branch of `foeTurn`.
 *
 * DELIBERATE RULES CHANGE (Phase 52, DMG-02, 2026-09-20): a level-base term
 * is what "strikes as a level five" (Herman's rulebook note) literally means
 * — when a foe carries `sp.strikesAs`, its level-base term reads
 * `strikesAs^2` instead of its own `lvl^2` (Herman is a tier-4/5 body that
 * hits like a level-5 one). Since Phase 54 (BAND-02, USER RULING D), the
 * curve's whole-hit scale (`foeHitFor`, applied at the three call sites
 * below) is keyed to DEPTH, not to this term — this stays a pure read of the
 * foe's own level-base, 0 draws.
 *
 * RULES-10 (Phase 75.1, foe Strength): a foe carrying `might` (a fumbled
 * Strength) adds it flat, ONCE per landed blow, on top of the level-base
 * term — never crit-doubled (the crit doubling at each call site applies
 * only to the dice term added alongside this base). `f.might` is `0` on
 * every foe today (only 75.1-05's resolver will ever set it), and
 * `src/browser/foeDetails.js`'s synthetic `{ lvl, sp }` foes carry no
 * `might` key at all — `f.might || 0` reads `0` for both, so this is a
 * pure, additive, zero-draw no-op absent the field.
 */
export function foeLevelBase(f) {
  const base = f.sp && f.sp.strikesAs ? f.sp.strikesAs * f.sp.strikesAs : f.lvl * f.lvl;
  return base + (f.might || 0);
}

/**
 * pursuitStrike(state, rng, events) — CANON-02/D-08/D-19: a live `sp.pursues`
 * foe (the Spectre) gets ONE hero-targeted melee strike as the hero leaves,
 * mirroring foeTurn's own hero swing exactly (foeDie/foeToHitVs, blind/
 * foeToHitPenalty overrides, sp.dmg-or-d6 damage, C.weakened halving, crit
 * doubling) — but with no `pickFoeTarget` (the hero is the one leaving, so a
 * party member can never be the pursuit's target). Module-private: `flee`
 * calls this on the tracked-withdrawal and ordinary-escape exits (91.1 V27: not the unseen Cloaker's free vanish), before pushing `fled`.
 *
 * DETERMINISM GATE: `!pursuer` returns `{ died: false }` immediately, 0
 * draws — no fixture-exposed foe carries `sp.pursues`.
 *
 * Returns `{ died }` (mirroring applyFoeDamageToPlayer's contract): a lethal
 * strike already ran `die()` (which nulls `state.combat`) — the caller MUST
 * return without pushing `fled`/calling `endCombat` again.
 */
function pursuitStrike(state, rng, events) {
  const pursuer = liveFoes(state).find((f) => f.sp && f.sp.pursues);
  if (!pursuer) return { died: false };
  events.push({ type: "foePursued", name: pursuer.name });
  const c = state.c;
  const C = state.combat;
  const dieN = foeDie(c, pursuer);
  // Phase 74 (ROLL-02): the base need, the passive breakdown and the
  // blind/penalty/insulted post-mods chain now live in the ONE helper
  // engine/derived.js#foeSwingVsHero — see its JSDoc for the full ordering
  // rationale (Phase 72 ROLL-01 (a): insulted is applied last).
  const { faces, mods } = foeSwingVsHero(state, pursuer);
  // Phase 73 (ROLL-05): the ONE roll-high check helper reads the to-hit die,
  // in the same draw position the previous draw sat.
  const check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
  const { roll, atLeast } = check;
  if (!check.ok) {
    events.push({ type: "foeMissed", name: pursuer.name, roll, atLeast, dieN, ...(mods.length ? { mods } : {}) });
    return { died: false };
  }
  // Phase 21 (D-02): flat foePower bonus on the lvl*lvl base — absent at depth <= 5, 0 draws
  // DELIBERATE RULES CHANGE (Phase 52, DMG-02, 2026-09-20): the crit doubles
  // the DAMAGE DICE only, not the whole lvl^2 + dmgBonus + dice sum (the old
  // rule produced a cliff: a tier-5 d6 crit read 52-62, and a flat-25 Herman
  // read 82/100 against a level-5 hero's ~30 max HP). The dice are drawn into
  // a local BEFORE the crit decision is applied to the sum — the SAME single
  // draw, in the SAME position, so the draw count/shape is unchanged; only
  // whether it is added once or twice into the final sum changes.
  // Phase 73 (ROLL-05): the mirrored crit rule — the top face always crits,
  // the top TWO faces crit for a Soldier — byte-identical to the old
  // `roll === 1 || (roll <= 2 && Soldier)`.
  // Quick 260928-cos: a live Cloak of Strength (critWardOf) turns the crit
  // into an ordinary hit — the roll and the dice draw are unchanged, only
  // the doubling is dropped (see foeTurn's hero branch).
  // Phase 90 plan 04 (SPELL-12): a blind foe never lands a critical — its one
  // winning face (foeSwingChain) is an ordinary hit (the Dirty Trick's
  // blindness included: it is the same flag).
  const rolledCrit = !pursuer.blind && roll >= atLeastFor(c.sub === "Soldier" ? 2 : 1, dieN);
  const critWarded = rolledCrit && wardCrit(c, pursuer, roll, dieN, events);
  const crit = rolledCrit && !critWarded;
  const dice = pursuer.sp && pursuer.sp.dmg ? rollDice(rng, pursuer.sp.dmg) : rng.d(6); // roll:amount
  const curve = difficultyCurve(state.floor.depth);
  // RULES-17 (Phase 75.3): an elite pursuer's parting strike carries its own
  // per-rank hit bonus too — `pursuer.elite || 0` is 0 for every plain foe.
  let dmg = foeHitFor(foeLevelBase(pursuer) + (crit ? 2 * dice : dice), curve, pursuer.elite || 0);
  if (foeWeakened(C, pursuer)) dmg = Math.ceil(dmg / 2);
  // Phase 40 (SPELL-01, Shrink) — a shrunk pursuer's parting strike is
  // halved too, same rule as its ordinary melee swing.
  if (pursuer.shrunk) dmg = Math.ceil(dmg / 2);
  // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING, a FRESH budget
  // (pursuitStrike is a single strike, never part of foeTurn's per-visit
  // budget) — Infinity at the identity value (0, off), a structural no-op.
  dmg = Math.min(dmg, Math.max(0, roundDamageCapFor(c.level)));
  return applyFoeDamageToPlayer(state, pursuer, rng, events, { dmg, roll, atLeast, dieN, mods, critWarded });
}

/**
 * wardCrit(body, foe, roll, dieN, events, member) — quick 260928-cos
 * (user-approved fix 2026-09-28, "the cloak of strength is supposed to stop
 * critical hits"): called at a foe-crit site ONLY when the foe's swing has
 * already rolled a critical against `body` (the hero's `c`, or a Joiner's
 * own persistent sheet). When `body` has a live critWard item (the Cloak of
 * Strength, derived.js#critWardOf), pushes ONE `critWarded { name, item,
 * roll, dieN, member? }` event — told before the blow lands, so it reads
 * even when armour then soaks the ordinary hit — and returns true; the
 * caller drops the crit's doubling. Otherwise returns false and pushes
 * nothing. No rng: the crit roll already happened and the damage dice are
 * drawn exactly as before, so the draw shape never changes.
 */
function wardCrit(body, foe, roll, dieN, events, member = null) {
  const item = critWardOf(body);
  if (!item) return false;
  events.push({ type: "critWarded", name: foe.name, item, roll, dieN, ...(member ? { member } : {}) });
  return true;
}

/**
 * fleeRefusal(state) — Phase 90 plan 09 (SPELL-10): THE never-flee predicate.
 * Returns the reason this hero can never leave a fight ("samurai": a Samurai
 * never runs; "masterOfArms": a Master of Arms never leaves a fight once it
 * starts, Phase 91 plan 05, IDENT-16) or null. `flee` reads it for its refusal
 * (and with it Smoke, the tracked withdrawal and every later exit) and Door
 * Illusion reads it so a hero who may not flee may not conjure an exit either
 * (castSpell refuses the cast before the charge is spent; a scroll's free cast
 * is refused the same way and the scroll stays spent, RULES-10). Which subs
 * never leave is engine/derived.js#neverFlees, the one predicate the combat
 * menu and the bot read too. Pure, zero rng.
 */
export function fleeRefusal(state) {
  if (!neverFlees(state.c)) return null;
  return state.c.sub === "Samurai" ? "samurai" : "masterOfArms";
}

/**
 * doorIllusionEscape(state, sp, rng, events) — Phase 90 plan 09 (SPELL-10, Door
 * Illusion at Illusion 1): the hero conjures a door that is not there and walks
 * through it. The fight's CLEVEREST live foe (highest `intel`; the first in
 * C.foes order on a tie) rolls the one depth-rising resist
 * (foeResistsSpell, a derived stream). When it resists it sees through the
 * door: `doorIllusionSeen { foe }` is pushed, nothing else changes and the
 * caller spends the turn (returns false). Otherwise the fight ends through the
 * flee path Smoke uses: no flee roll, no parting blow (pursuitStrike is never
 * called), the pending spoils forfeited (`forfeitLoot "fled"`), `fled { reason:
 * "door" }`, `endCombat` (a Joiner in the party leaves with the hero, as in any
 * flee). Returns true when the fight is over. Zero main-rng draws.
 */
export function doorIllusionEscape(state, sp, rng, events) {
  const C = state.combat;
  if (!C) return false;
  const live = liveFoes(state);
  if (!live.length) return false;
  let clever = live[0];
  for (const f of live) {
    const a = Number.isFinite(f.intel) ? f.intel : 0;
    const b = Number.isFinite(clever.intel) ? clever.intel : 0;
    if (a > b) clever = f;
  }
  if (foeResistsSpell(state, clever, sp.n, rng, events)) {
    events.push({ type: "doorIllusionSeen", foe: clever.name });
    return false;
  }
  forfeitLoot(state, "fled", events);
  events.push({ type: "fled", reason: "door" });
  endCombat(state, events);
  return true;
}

/**
 * behemothRoar(state, sp, rng, events, caster) — Phase 90 plan 09 (SPELL-10, Size
 * of the Behemoth at Illusion 4): the caster looks enormous. The ONE tail, for
 * the hero's cast (a scroll's free cast included) and, in 90-10, a Joiner's.
 * Each live foe in C.foes order rolls the one depth-rising resist
 * (foeResistsSpell, a derived stream); one that resists is untouched. A foe that
 * fails and is BELOW the caster's level flees: `alive = false`, `fled = true`
 * (Insane's flee outcome: no experience, no spoils, no foeKilled) and one
 * `foeRouted { name }`. Any other foe that fails cowers for the rest of the
 * fight: `f.cowering = true` (a per-foe flag, derived.js#foeSwingChain caps its
 * swings at its die's top three numbers and #foeWeakened halves its damage; a
 * Weaken's expiry never clears it) and one `foeCowers { name }`. Then one
 * `behemothCast { routed, cowering, by? }` (both 0 when every foe resisted).
 * `caster` is `{ by, level }` (a Joiner's name and level; the hero's when
 * absent). If the rout empties the room the fight is over: the encounter clears
 * through the same path every other routing uses. Zero main-rng draws.
 * Returns `{ routed, cowering }`.
 */
export function behemothRoar(state, sp, rng, events, caster = {}) {
  const C = state.combat;
  if (!C) return { routed: 0, cowering: 0 };
  const by = caster.by;
  const level = Number.isFinite(caster.level) ? caster.level : state.c.level;
  let routed = 0;
  let cowering = 0;
  for (const f of liveFoes(state)) {
    if (foeResistsSpell(state, f, sp.n, rng, events, by)) continue;
    if (f.lvl < level) {
      f.alive = false;
      f.fled = true;
      routed++;
      events.push({ type: "foeRouted", name: f.name });
    } else {
      f.cowering = true;
      cowering++;
      events.push({ type: "foeCowers", name: f.name });
    }
  }
  events.push({ type: "behemothCast", routed, cowering, ...(by ? { by } : {}) });
  return { routed, cowering };
}

/**
 * flee(state, rng, events) — the escape action. Ports mazeworld.html flee()
 * (lines 2684-2697): Samurai never runs (nor, since Phase 91 plan 05, IDENT-16,
 * does a Master of Arms), a Cloaker gets away for free while
 * unseen, a tracked round-1 withdrawal is clean, otherwise a raw d20 vs
 * `atLeast = 14 - fleeBreakdown(c).bonus`
 * (Phase 73, ROLL-05: flee was ALREADY roll-high — no mirror, only the
 * bonus folding into the threshold), with every modifier named in
 * fleeRolled (DELIBERATE RULES CHANGE, Phase 42, 2026-09-18,
 * FLEE-01/FLEE-02, docs/FLEE.md — was "d20 (+5 Thief) vs 11"); failure is
 * unchanged: it triggers a foeTurn and advances the round. Phase 19
 * (CANON-02/D-19): a live pursuing foe gets one
 * melee strike on every success exit but the unseen Cloaker's free vanish (V27), BEFORE the `fled` event; a lethal
 * strike returns without `endCombat`. Phase 19 (CANON-02/D-03) also adds a
 * cleared-check after a failed flee's foeTurn, since a fleesBelow caster can
 * now leave the fight mid-turn and would otherwise strand the combat screen.
 *
 * DECISION ORDER (Phase 24, IDENT-05/IDENT-07; Phase 91 plan 05, IDENT-16):
 * never-flee refusal first (fleeRefusal: the Samurai and the Master of Arms,
 * zero draws, every round, which also shuts Smoke and the withdrawal for them)
 * -> Cloaker free vanish while `!C.opened2` (denied + narrated once seen) ->
 * tracked round-1 clean withdrawal -> Smoke -> the ordinary d20 roll.
 *
 * Phase 29 (LOOT-06, CONTEXT §Pending pile): every success exit (cloaker,
 * tracked, escaped) forfeits a non-empty pending loot pile with ONE
 * narrated `lootForfeited` BEFORE the `fled` event — fleeing honestly costs
 * the spoils. The fleeFailed path and the post-foeTurn encounterCleared
 * path do NOT forfeit (the pile still shows normally there).
 */
export function flee(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "fleeRefused")) return events;
  if (!C) return events;
  // Phase 91 plan 05 (IDENT-16): `fleeRefused { reason: "samurai" }` or
  // `fleeRefused { reason: "masterOfArms" }`, in every round, with no draw.
  const refusal = fleeRefusal(state);
  if (refusal) {
    events.push({ type: "fleeRefused", reason: refusal });
    return events;
  }
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-07): the Cloaker's
  // free vanish only works before it has struck this fight — "you can
  // always vanish, as long as nobody has seen your face". Once `C.opened2`
  // is set (playerStrike's first LANDED blow), a Cloaker narrates the
  // denial and falls through to the ordinary flee roll below instead of
  // returning here. Zero new draws; `opened2` already exists.
  if (c.sub === "Cloaker" && !C.opened2) {
    // Phase 91.1 plan 03 part B (V27 B, user 2026-10-01: "Cloaker ability should work on
    // specter, too"): the vanish is FREE against a pursuing Spectre as well: no parting
    // blow, no `foePursued`, no draw. A Cloaker who has struck (the denial below) and every
    // other exit still takes pursuitStrike.
    forfeitLoot(state, "fled", events);
    events.push({ type: "fled", reason: "cloaker" });
    endCombat(state, events);
    return events;
  }
  if (c.sub === "Cloaker") events.push({ type: "vanishDenied", reason: "seen" });
  // Phase 51 (INIT-01): C.round now only ever advances in afterPlayerAction's
  // trailing `round++` or flee's own `round++` below — initiative no longer
  // re-rolls per round, so "round 1" still means exactly what it always did:
  // before the first full cycle completes.
  if (C.tracked && C.round === 1) {
    // Phase 91 plan 05 (IDENT-16): the Master of Arms branch that used to sit
    // here (a denied withdrawal that fell through to the roll) is gone — a
    // Master of Arms never reaches this line, fleeRefusal above refuses it in
    // every round. Every other Fighter's clean exit is byte-identical (same
    // three statements, same order).
    if (pursuitStrike(state, rng, events).died) return events;
    forfeitLoot(state, "fled", events);
    events.push({ type: "fled", reason: "tracked" });
    endCombat(state, events);
    return events;
  }
  // Phase 38 (ABIL-01, Smoke) — "a flee during it just works": no roll, no
  // pursuit strike, unconditional escape while the effect is active. False
  // on every fixture (only useAbility's "smoke" case ever starts this
  // timer).
  if (abilityEffectActive(c, "smoke")) {
    forfeitLoot(state, "fled", events);
    events.push({ type: "fled", reason: "smoke" });
    endCombat(state, events);
    return events;
  }
  // Phase 42 (FLEE-01/FLEE-02): fleeBreakdown(c) is the ONE source of the
  // flee need/modifiers — every surface (this event, the fight log,
  // the rail, the combat submenu) reads the SAME `mods` list rather than
  // re-deriving the formula.
  // Phase 73 (ROLL-05): flee is ALREADY roll-high (today's `roll + bonus >=
  // need` reads high-is-good with no mirror needed) — only the bonus moves,
  // folded into the threshold instead of added to the roll. `atLeast = need
  // - bonus` is byte-identical arithmetic: `roll + bonus >= need` <=>
  // `roll >= need - bonus`. `total`/`need` are retired from the event.
  const { need, mods, bonus } = fleeBreakdown(c);
  const roll = rng.d(20); // roll:already-high
  const atLeast = need - bonus;
  events.push({ type: "fleeRolled", roll, atLeast, dieN: 20, mods });
  if (roll >= atLeast) {
    if (pursuitStrike(state, rng, events).died) return events;
    forfeitLoot(state, "fled", events);
    events.push({ type: "fled", reason: "escaped" });
    endCombat(state, events);
    return events;
  }
  events.push({ type: "fleeFailed" });
  foeTurn(state, rng, events);
  // DELIBERATE RULES CHANGE (Phase 19, CANON-02/D-03): a Djinni (or any
  // fleesBelow caster) can now leave the fight during this foeTurn — mirrors
  // afterPlayerAction's own post-foeTurn cleared-check so the player is never
  // stranded on a combat screen with no live foe left. Pure read; cannot
  // fire on any fixture (no fixture foe leaves mid-foeTurn).
  if (state.combat && !liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  if (!state.dead) C.round++;
  return events;
}

/**
 * canParley(state) — can the current encounter be talked down? Ports
 * mazeworld.html canParley() (lines 2701-2714).
 *
 * DELIBERATE RULES CHANGE (Phase 20, LANG-01/LANG-02/PARLEY-02, D-05/D-09/
 * D-10/D-11): the Phase 15 boolean "Language skill OR Helm of Knowledge"
 * gate line is REPLACED by a graduated `fluency(c)` read
 * (engine/derived.js#fluency) that feeds BOTH this availability gate and
 * parley()'s bonus term — a Language/Helm carrier is never balanced twice.
 * fluency 1 opens the existing TALKATIVE set; fluency 2 (full fluency, both
 * skill AND item) additionally opens Magical for EVERY race/sub, including
 * Con Artist. Walking Dead is refused unconditionally, for everyone,
 * regardless of fluency (canon, unchanged). `C.parleyTried` (D-05) hides the
 * button once the encounter's one attempt is spent. Pure read (no rng):
 * canParley is a boolean gate; parley() only draws rng once talking is
 * attempted, so this never shifts the rng stream for a non-carrier.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05/IDENT-06): two more
 * decision-order lines, both zero-draw. Right after `C.parleyTried` (the sub
 * gate wins over every other rule, including fluency): a Ninja or a Master
 * of Arms can never parley, for any encounter type, at any fluency. Right
 * after the Bard-vs-Humans line: a Court Mage can always parley Humans
 * ("courtly manners"), even at fluency 0.
 *
 * This function is the ONLY canParley — the shell reaches it through the
 * engine bridge; there is no duplicate to keep in step.
 *
 * Phase 38 (ABIL-02): the Language skill is dropped outright — `fluency(c)`
 * (engine/derived.js) now comes ENTIRELY from a tongue-effect item (the Helm
 * of Knowledge), so its ceiling is 1, not 2. The fluency-2 `talkable`/Magical
 * branch below is therefore unreachable until a future fluency source
 * exists; it is left in place (a data-driven threshold, not a dead read) per
 * docs/ABILITIES.md.
 */
export function canParley(state, fluencyOverride) {
  if (!state.combat) return false;
  const c = state.c;
  const C = state.combat;
  const t = C.type;
  if (C.parleyTried) return false; // D-05: the encounter's one attempt is spent
  if (c.sub === "Ninja" || c.sub === "Master of Arms") return false; // Phase 24 IDENT-05: a Ninja never speaks; a Master of Arms attacks without question
  if (t === "Walking Dead") return false; // canon, unconditional, for everyone
  // Phase 90 plan 09 (SPELL-10): the fight-scoped Chameleon Tongue (C.tongue) is
  // a second fluency source, so the fluency-2 Magical branch below is reachable.
  // `fluencyOverride` (optional) is the fluency a cast is ABOUT to give the
  // fight (parleyBlockedReason), read as if it were already set.
  const flu = Math.max(fluency(c, C), Number.isInteger(fluencyOverride) ? fluencyOverride : 0);
  if (t === "Magical" && flu < 2) return false; // D-11: Magical opens ONLY at full fluency
  if (c.sub === "Con Artist") return true;
  if (c.sub === "Woodsman" && (t === "Beasts" || t === "Lair Beasts")) return true;
  if (c.sub === "Bard" && t === "Humans") return true;
  if (c.sub === "Court Mage" && t === "Humans") return true; // Phase 24 IDENT-06: courtly manners
  // D-10/D-11: replaces the old boolean skill-or-Helm gate line — fluency 1
  // opens TALKATIVE, fluency 2 additionally opens Magical (even for a
  // Wilmsry, which is exactly why a fluency-2 Wilmsry vs Magical reaches
  // this branch instead of the racial one below — see D-12 in parley()).
  const talkable = flu >= 2 ? [...TALKATIVE, "Magical"] : TALKATIVE;
  if (flu >= 1 && talkable.includes(t)) return true;
  // "All good and evil creatures recognize the Wilmsry and often desire to barter with them."
  if (c.race === "Wilmsry" && t !== "Magical") return true;
  // "Most humans treasure the sighting of an elf as a good omen."
  if (c.race === "Elven" && t === "Humans") return true;
  return false;
}

/**
 * parleyBlockedReason(state, fluencyOverride) — Phase 90 plan 09 (SPELL-10): THE
 * one reader of "why can this fight not be parleyed right now", or null when it
 * can. In parley()'s own order: "parleySpent" (the fight's one attempt is used),
 * "ninja" and "masterOfArms" (a sub-class that never speaks), "walkingDead"
 * (canon: never, at any fluency), "noTalk" (canParley's gate says no at this
 * fluency: this hero cannot open this kind of foe) and "wilmsryVsMagical" (the
 * D-12 refusal: a Wilmsry never parleys Magical foes even at fluency 2).
 * `fluencyOverride` is the fluency a Chameleon Tongue cast is about to give the
 * fight (2), read as if already set, so castSpell and the combat menu can refuse
 * or grey the spell BEFORE any charge is spent. `parley` reads this for its
 * refusals (its behaviour is unchanged) and castSpell reads it for the Tongue.
 * Phase 91's PARLEY-01/IDENT-16 edit this one place. Pure, zero rng.
 */
export function parleyBlockedReason(state, fluencyOverride) {
  const C = state.combat;
  if (!C) return "noTalk";
  const c = state.c;
  if (C.parleyTried) return "parleySpent";
  if (c.sub === "Ninja") return "ninja";
  if (c.sub === "Master of Arms") return "masterOfArms";
  if (C.type === "Walking Dead") return "walkingDead";
  if (!canParley(state, fluencyOverride)) return "noTalk";
  if (c.race === "Wilmsry" && C.type === "Magical") return "wilmsryVsMagical";
  return null;
}

/**
 * parley(state, rng, events) — talk the encounter down. Ports mazeworld.html
 * parley() (lines 2715-2734): a d20 read roll-high (Phase 73, ROLL-05) vs
 * the top `9+bonus` faces, awarding the skill points (and a
 * Humans-only bonus payout) on success, ending combat cleanly.
 *
 * DELIBERATE RULES CHANGE (Phase 91 plan 05, 2026-10-01, PARLEY-01; user:
 * "We should definitely"): a won parley pays what winning the fight would. FULL
 * experience (the same killSpFor sum a kill of every live foe pays, not half),
 * and for every live foe the spoils a kill of it would roll (foeSpoils: its
 * coin purse, its item-drop check, the bag-upgrade check) into the pending
 * loot pile, with the Humans tip still on top. DRAW LAYOUT: the main rng's
 * draws are unchanged and in the same order (the d20, the experience d6 per
 * live foe, then for Humans the tip d6 and its amount d6); the spoils draw
 * ONLY from `derivedRng(<main cursor>, the parleySpoils key, <state.acts>)`. One new
 * event, `parleyWon { count, sp, gold, items }`, summarises the pay after the
 * spoils and before the fight ends. A Chameleon Tongue's parley is this parley.
 *
 * DELIBERATE RULES CHANGE (Phase 20, PARLEY-01/02/03, D-01..D-08): the
 * literal `x 2.5` SP multiplier is retired in favor of a STRUCTURAL half of
 * killFoe's own combat-equivalent (killSpFor, D-01/D-02); the Humans wilmst
 * bonus now fires on a natural 6 instead of >= 4 (D-03); the Con Artist
 * bonus drops from +6 to +4 (D-07, still the best talker: need 13 at even
 * level vs a solo foe, ~65%); `need` is clamped to <= 17 so no bonus stack is
 * an auto-win (D-08); one attempt per encounter is enforced via
 * `C.parleyTried` (D-05), and a failed attempt insults the group
 * (`C.parleyInsulted`, D-06) for the rest of the fight (foeTurn's `need`/
 * `mNeed += 1`, below). See test/parity/FIXTURE-INVENTORY.md's Phase 20
 * section and the 20-01 scenario-scoped carve-out (stripParleyDivergence)
 * for the seed-303 fixture's documented before/after.
 */
export function parley(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "parleyRefused")) return events;
  if (!C) return events;
  // Phase 90 plan 09 (SPELL-10): every refusal below reads the ONE predicate
  // (parleyBlockedReason), in the order the checks always ran.
  const blocked = parleyBlockedReason(state);
  if (blocked === "parleySpent") {
    // D-05: a re-sent action after the encounter's one attempt (canParley is
    // already false once tried, hiding the button — this is the direct-
    // dispatch rejection for an action that bypassed the button). Zero draws.
    events.push({ type: "parleyExhausted" });
    return events;
  }
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): a Ninja or a
  // Master of Arms narrates a direct refusal (same posture as the Wilmsry-
  // vs-Magical refusal below — BEFORE `C.parleyTried` is set, so a refusal
  // never spends the encounter's one attempt) rather than falling through to
  // canParley's silent no-op path. Zero draws.
  if (blocked === "ninja" || blocked === "masterOfArms") {
    events.push({ type: "parleyRefused", reason: blocked });
    return events;
  }
  if (blocked && blocked !== "wilmsryVsMagical") return events; // unchanged silent path for never-eligible cases
  // LO-03: guard the empty-foes edge defensively. Currently unreachable
  // (state.combat is nulled the instant liveFoes empties on every path that
  // could produce it), but Math.max(...[]) === -Infinity would otherwise
  // inflate `bonus` below to +Infinity and make parley un-failable if that
  // invariant is ever changed.
  const foes = liveFoes(state);
  if (!foes.length) return events;
  const top = Math.max(...foes.map((f) => f.lvl));
  if (blocked === "wilmsryVsMagical") {
    // PARLEY-04 / D-12: now REACHABLE — a fluency-2 Wilmsry passes canParley
    // for Magical (the fluency branch above, not this racial branch). Zero
    // draws, and this deliberately sits BEFORE C.parleyTried is set: a
    // refusal never consumes the one attempt.
    events.push({ type: "parleyRefused", reason: "wilmsryVsMagical" });
    return events;
  }
  C.parleyTried = true; // D-05: the one attempt is spent here — lazily written, never initialised in startCombat
  const flu = fluency(c, C);
  const bonus =
    (c.sub === "Con Artist" ? 4 : 0) + // D-07: was 6
    (c.sub === "Woodsman" ? 3 : 0) +
    (c.race === "Wilmsry" ? 4 : 0) + // noted for their bargaining
    (c.race === "Elven" && C.type === "Humans" ? 3 : 0) + // a good omen
    2 * flu + // D-10
    c.level -
    top;
  // Phase 72 (ROLL-01, finding F5): parley succeeds on the top `faces` of
  // the d20, so the dial is subtracted — a positive value is harder, as
  // documented; identity 0 is a structural no-op. (The Phase 54 BAND-02 USER
  // RULING D wiring added the dial instead, which made a positive value
  // EASIER — the opposite of its own JSDoc; fixed without a ruling per
  // CONTEXT's text-backed/local rule, since the dial is 0 at identity and no
  // fixture moves.) Phase 73 (ROLL-05): `faces` is the SAME number the old
  // `need` was — a count of winning faces — now read via rollCheck/
  // atLeastFor, at the exact same draw position.
  const faces = Math.min(9 + bonus, 17) - parleyNeedModFor(); // D-08: an 85% ceiling — no stack is an auto-win
  const check = rollCheck(rng, 20, atLeastFor(faces, 20));
  events.push({ type: "parleyRolled", ...rollFields(check), fluency: flu });
  if (check.ok) {
    // D-01/D-02: parley's experience is STRUCTURALLY the same combat-equivalent
    // killFoe pays (killSpFor), not a second formula. PARLEY-01 (Phase 91 plan
    // 05, user: "We should definitely"): the Phase 20 half is gone, so a won
    // parley pays the FULL sum a kill of every live foe pays (never doubled:
    // a foe already slain paid when it died and is not live here).
    const talked = liveFoes(state);
    // Phase 91 plan 09 (orchestrator amendment, user 2026-10-01): the experience is
    // SPLIT with the Joiners the way a kill's is (killFoe: each foe's award is
    // divided by the hero plus every live Joiner, rounded per foe, and the hero keeps
    // its share; a Joiner's share is discarded). A solo hero has one share, so its
    // pay is the plain sum, byte-identical to before. The draws are unchanged.
    const shares = partyXpShares(state);
    const combatEquivalent = talked.reduce((sum, f) => {
      const gained = killSpFor(c, f, rng.d(6)); // roll:amount
      return sum + (shares > 1 ? Math.round(gained / shares) : gained);
    }, 0);
    const sp = heroSpFor(Math.round(combatEquivalent));
    c.sp += sp;
    events.push({ type: "spGained", amount: sp, reason: "parley" });
    let tip = 0;
    if (C.type === "Humans" && rng.d(6) === 6) { // roll:already-high
      // D-03: was >= 4 (50%); the AMOUNT formula stays untouched (economy owns it).
      // PARLEY-01: the tip stays ON TOP of the spoils below, draws unmoved.
      const wm = rng.d(6) * 100 * state.floor.depth; // roll:amount
      c.gold += wm;
      tip = wm;
      events.push({ type: "goldGained", amount: wm, why: "parley" });
    }
    // PARLEY-01: each live foe's normal spoils (its coin purse and its item-drop
    // check, the bag-upgrade check included) go to the pending loot pile, rolled
    // from ONE derived stream keyed on the main cursor after every main draw
    // above, so the parley's main-rng draws are exactly the d20, the experience
    // d6 per foe and (Humans) the tip's two d6, in that order, as before.
    const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
    const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
    const spoilsRng = derivedRng(cursor, "parleySpoils", acts);
    let spoilsGold = 0;
    let spoilsItems = 0;
    for (const f of talked) {
      const got = foeSpoils(state, f, spoilsRng, events, { why: "parley spoils" });
      spoilsGold += got.gold;
      spoilsItems += got.items;
    }
    events.push({ type: "parleyWon", count: talked.length, sp, gold: spoilsGold + tip, items: spoilsItems });
    checkLevel(state, rng, events);
    endCombat(state, events);
    return events;
  }
  events.push({ type: "parleyFailed" });
  // D-06: the group takes it personally for the rest of the fight — the flag
  // dies with state.combat at endCombat/die (D-19: never persisted).
  C.parleyInsulted = true;
  events.push({ type: "parleyInsulted" });
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * songPool(level) — Phase 91 (IDENT-17, plan 91-06): the spells a Bard's song
 * may echo at `level`: every offense and protection spell whose printed level
 * is at or below it, in SPELLS order (so a derived pick index is stable). Phase
 * 90's reworked offense and protection spells are in it; Special, Illusion,
 * healing and divination spells never are. A Bard has no per-sub level
 * override, so the printed `lvl` is the gate. Pure, no rng; never empty at
 * level 1.
 */
export function songPool(level) {
  return SPELLS.filter((sp) => SONG_SCHOOLS.includes(sp.s) && sp.lvl <= level);
}

/**
 * songReady(state) — IDENT-17 (Phase 91, plan 91-06), user 2026-09-30: "Let's
 * allow this to be used once per fight as a combat action." True only for a
 * Bard in a live, joined fight (not pending, before FIGHT) that has not yet
 * sung (`state.combat.sang` unset). The flag lives on the fight, so it can
 * never leak into the next one; squares walked no longer matter. This
 * supersedes the prototype's "a song every 100 squares" (mazeworld.html
 * songReady(), lines 2743-2745), a declared canon divergence.
 */
export function songReady(state) {
  // Phase 91.1 plan 03 part B (V7 B, 2026-10-01): a second song is due SONG_GAP_ROUNDS (5) rounds after
  // the first (songDue), never a third: `combat.sang` is true once a song has been sung, `combat.sangAt`
  // the round of the FIRST song, and null once the second is sung.
  const C = state.combat;
  return state.c.sub === "Bard" && !!C && !C.pending && songDue(C.sang, C.sangAt, C.round);
}

/**
 * sing(state, rng, events, now) — the Bard's action, once per fight. IDENT-17
 * (Phase 91, plan 91-06), user 2026-09-30: the song's effect is one spell
 * picked uniformly from songPool(level) and resolved at full strength exactly
 * as a Magic User of the Bard's level would cast it (castSpell's free mode:
 * same dice, the one shared rising resist, durations, self-costs; no charge, no
 * book, no Apprentice backfire). The pick, the sung title and every roll the
 * spell makes come from ONE derived stream, `derivedRng(<main cursor>, "song",
 * <acts>)`; the foe turn after the song runs on the main rng as after any
 * other action, so the main rng draws nothing for the song itself. Events: a
 * `sang { title, spell, level }`, then the spell's own events, then the foe
 * turn. A second song in the fight is `actionRefused { action: "sing", reason:
 * "sungThisFight" }` with no draw; a non-Bard is "wrongClass"; before FIGHT it
 * is "notFought". Replaces the port of mazeworld.html sing() (lines 2746-2770)
 * and its five fixed per-level songs (RULES-18's resistControl x2 and
 * controlCapRounds are no longer used here).
 */
export function sing(state, rng, events = [], now = Date.now) {
  const c = state.c;
  const C = state.combat;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "actionRefused", { action: "sing" })) return events;
  if (!C) return events;
  // CMB-02 (Phase 31): each refusal names its own reason (never fear-related;
  // this is a class / once-per-fight gate, not a phobia refusal).
  if (c.sub !== "Bard") {
    events.push({ type: "actionRefused", action: "sing", reason: "wrongClass" });
    return events;
  }
  if (!songDue(C.sang, C.sangAt, C.round)) {
    // V7 B: after the second song (sangAt null) it is "sungThisFight"; between the two (fewer than
    // SONG_GAP_ROUNDS rounds since the first) it is "songResting", with how many rounds are left.
    if (C.sang && Number.isFinite(C.sangAt)) {
      events.push({ type: "actionRefused", action: "sing", reason: "songResting", rounds: C.sangAt + SONG_GAP_ROUNDS - C.round });
    } else {
      events.push({ type: "actionRefused", action: "sing", reason: "sungThisFight" });
    }
    return events;
  }
  // The first song records the round it was sung in; the second closes the fight's songs.
  C.sangAt = C.sang ? null : C.round;
  C.sang = true;
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  const songRng = derivedRng(cursor, "song", acts);
  const { sp, title } = pickSong(c.level, songRng);
  events.push({ type: "sang", title, spell: sp.n, level: sp.lvl });
  castSpell(state, SPELLS.indexOf(sp), songRng, events, now, { free: true, afterRng: rng });
  return events;
}

/**
 * pickSong(level, stream) — Phase 91 (IDENT-17, plan 91-07): THE one song pick,
 * shared by the hero's sing() and a Joiner Bard's turn (alliesTurn): one spell
 * uniformly from songPool(level), then one sung title uniformly from
 * SONG_TITLES (a `{spell}` slot filled with the spell's name), both drawn from
 * `stream` (a derived stream, never the main rng) in that order. Returns `{ sp,
 * title }`. The draw order is the order sing() always had, so the hero's song is
 * byte-identical to before this helper existed.
 */
export function pickSong(level, stream) {
  const pool = songPool(level);
  const sp = pool[stream.d(pool.length) - 1]; // roll:selection
  const raw = SONG_TITLES[stream.d(SONG_TITLES.length) - 1]; // roll:selection
  return { sp, title: raw.replace("{spell}", sp.n) };
}

/**
 * endCombat(state, events) — clears combat and the encounter-scoped magic
 * fields. Ports mazeworld.html endCombat() (lines 2796-2804), minus
 * paint()/save(). NOTE: this unconditionally sets `c.senses = 0`, adding
 * that field to the character the first time ANY combat ends — matching the
 * prototype's own side effect exactly (fidelity: `S.c.senses = 0;` runs even
 * on a character that never had a `senses` field before), so a save/parity
 * comparison after the FIRST fight stays byte-identical on both sides.
 */
export function endCombat(state, events = []) {
  // PARTY-05 (Phase 8): sync surviving party members' in-fight `wp` back to the
  // persistent roster, then drop any member that was downed this fight (its
  // combat entry was already spliced out of C.allies by downMember, and it was
  // flagged `status:"downed"` on state.party). GATE: this whole block only runs
  // when `C.allies` exists — i.e. a non-empty party was synced in at
  // startCombat. An empty party never gets a `C.allies`, so this is skipped
  // entirely and endCombat stays byte-identical to today for solo fixtures.
  const C = state.combat;
  if (C && C.allies && Array.isArray(state.party)) {
    for (const ally of C.allies) {
      if (typeof ally.partyIdx === "number" && state.party[ally.partyIdx]) {
        const sheet = state.party[ally.partyIdx];
        sheet.wp = ally.wp;
        // Phase 38 (ABIL-05, post-research ruling): a surviving member's own
        // ability cooldowns clear at endCombat exactly like the hero's — same
        // rounds-cadence-only clear, same unconditional-when-timers-present
        // guard. `C.allies` only ever holds SURVIVING members here (downMember
        // splices a downed one out the instant it happens), so this loop
        // never needs its own "is this member downed" check.
        if (sheet.timers) clearRoundTimers(sheet);
      }
    }
    state.party = state.party.filter((m) => m.status !== "downed");
  }
  state.combat = null; // Phase 31: this also clears combat.afraid — the fear ends with the fight, not with a fearPassed line
  // Phase 40 (SPELL-02): narrate the expiry of every utility effect still
  // live when the fight ends, BEFORE the unconditional resets just below
  // wipe them — order regenFaded, sensesFaded, mirrorFaded. A mirror that
  // already ran out mid-fight (combat.js#foeTurn's own per-round countdown)
  // already pushed its own mirrorFaded there and is 0 here, so this never
  // double-narrates; only a STILL-RUNNING mirror at fight-end reaches this.
  if (state.c.regen) events.push({ type: "regenFaded" });
  if (state.c.senses) events.push({ type: "sensesFaded" });
  if (state.c.mirror > 0) events.push({ type: "mirrorFaded" });
  state.c.regen = false;
  state.c.ward = null;
  state.c.mirror = 0;
  state.c.senses = 0;
  // Phase 39 (GEAR-02): the retired c.acute clear — Acuteness is now a
  // rounds-cadence c.timers effect record, and every rounds-cadence record
  // (this one included) is already cleared unconditionally by
  // clearRoundTimers below.
  // Phase 19 D-09: combat-scoped, never leaks between fights; CONDITIONAL so
  // the key is never ADDED to a character that never had a debuff (unlike
  // `senses` above) — keeps every solo parity fixture's `c` byte-identical
  // without touching the per-file parity comparables; the harness strippers
  // (19-02) cover the case where it IS set.
  if (state.c.foeEffect) state.c.foeEffect = null;
  // Phase 36 (BAL foundation) — rounds-cadence engine/effects.js records are
  // combat-scoped and clear unconditionally at endCombat (the Phase 31
  // ward/afraid precedent); squares-cadence records survive. Conditional so
  // the key is never added to a character that never had one.
  if (state.c.timers) clearRoundTimers(state.c);
  events.push({ type: "combatEnded" });
  return events;
}

/**
 * afterPlayerAction(state, rng, events) — the post-action turn sequence:
 * check for a cleared encounter, run the ally's turn, run the foe's turn,
 * then (if nobody died) advance the round — initiative holds for the whole
 * fight (Phase 51). Ports mazeworld.html afterPlayerAction() (lines
 * 2806-2822), minus paint()/save().
 *
 * DELIBERATE RULES CHANGE (Phase 51, INIT-01, 2026-09-20): this function
 * used to re-roll initiative every round (canon p.24's "a fresh d20 each
 * round") and, when the foes won that reroll, run a SECOND foe turn in the
 * same cycle — meaning a foe could act at the end of one round and again at
 * the start of the next with no player action in between. Both the re-roll
 * and the pre-emptive foeTurn are gone: `C.first` is set once, in `fight()`,
 * and holds for the whole encounter. A round is one full cycle (every
 * entity acts once); the foe's turn already run above (line ~1327) is the
 * ONLY foe turn this cycle, and `round++` below is the only round advance —
 * it draws zero rng. The old "ROUND-COUNT FIX" comment that explained why
 * the pre-emptive turn must not double-advance the counter is moot: there is
 * no pre-emptive turn anymore. `C.round === 1` reads elsewhere (Court Mage's
 * `courtMage` guard in resolveInitiative, `C.tracked && C.round === 1` at the
 * flee site) are unaffected — they still see the single roll / round 1
 * exactly as before.
 */
export function afterPlayerAction(state, rng, events = []) {
  const C = state.combat;
  if (!C) return events;
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  allyTurn(state, rng, events);
  // PARTY-04 (Phase 8): the party members act in the SAME slot the summon ally
  // does, right after it. GATE: alliesTurn is an immediate no-op (zero rng) on
  // an empty/absent C.allies, so for solo fixtures this call is invisible and
  // the shared clear-check below is byte-identical to today.
  alliesTurn(state, rng, events);
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  foeTurn(state, rng, events);
  // A foe can DIE during foeTurn (an acid-over-time tick, or a ward reflecting a
  // blow back onto it) — not just on the player's own strike. Re-check for a
  // cleared encounter here too, or combat stays open with nothing left to fight
  // and the player is stranded on the combat screen. (The pre-foeTurn checks
  // above only catch kills from the player's action / the ally's turn.)
  if (state.combat && !liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  if (!state.dead && state.combat) {
    state.combat.round++;
  }
  return events;
}

/**
 * allyTurn(state, rng, events) — a summoned ally's strike (if any). Ports
 * mazeworld.html allyTurn() (lines 2824-2836).
 */
export function allyTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.ally) return events;
  const t = liveFoes(state)[0];
  if (!t) return events;
  const dieN = STRIKE_DICE[C.ally.lvl - 1];
  // Phase 72 (ROLL-01, finding F1, user ruling 2026-09-24): a summoned
  // ally's strike now obeys the same per-target to-hit rules
  // playerStrike/memberStrike apply — same order, applied to the flat
  // need-5 baseline this function has always used. A summon carries no
  // weapon of its own, so magicOnly/daggerOnly always leave it untouchable
  // against a flagged foe (it has no magic weapon or dagger to touch one
  // with).
  // Phase 73 (ROLL-05): the need chain is pure arithmetic (zero rng) and now
  // sits above the strike draw, since atLeastFor(faces, dieN) must be ready
  // before rollCheck fires. `need` -> `faces`.
  let faces = 5;
  if (t.asleep > 0 || t.held) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or held — a Freeze) creature
  if (t.sp && t.sp.toHit !== undefined) faces = Math.min(faces, t.sp.toHit); // hard to hit
  if (t.sp && t.sp.fast) faces = Math.max(1, faces - 1); // "roll 1 higher to strike"
  if (t.sp && t.sp.magicOnly) faces = 0; // only magic touches it
  if (t.sp && t.sp.daggerOnly) faces = 0; // only a dagger or magic touches it
  if (t.mirror > 0) faces = Math.min(faces, 1); // RULES-10 (Phase 75.1): Mirror Self — the top face only
  // Phase 73 (ROLL-05): the ONE roll-high check helper reads the strike die,
  // in the same draw position the previous draw sat — the strike die, then
  // (for Philly) a second draw, same as before.
  let check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
  // CANON-05 (D-12, p.36): Philly's `slow` gives two dice and keeps the
  // HIGHER of the two mirrored faces — byte-identical to the old rule,
  // which kept the lower raw face of the two.
  if (t.sp && t.sp.slow) {
    const second = rollCheck(rng, dieN, check.atLeast);
    const better = Math.max(check.roll, second.roll);
    check = { roll: better, atLeast: check.atLeast, dieN, ok: better >= check.atLeast };
  }
  const roll = check.roll;
  if (check.ok) {
    // Phase 72 (ROLL-01 (c)): a landed summoned-ally strike on its die's
    // best face shatters a shatter-flagged foe (the Skeleton) outright —
    // skip the damage roll. The `--C.ally.rounds` countdown below still
    // runs either way.
    if (!shatterIfBest(state, t, roll, dieN, C.ally.name, rng, events)) {
      const d = C.ally.lvl * C.ally.lvl + rng.d(6); // roll:amount
      // D-06/D-20: an ally's blow is physical (soakable) and never matches a
      // multiplier row (no cls on a summoned/party ally this phase).
      const hit = damageFoe(state, t, d, { kind: "ally", crit: false }, rng, events);
      if (!hit.soaked)
        events.push({
          type: "allyStruck",
          name: C.ally.name,
          target: t.name,
          dmg: hit.applied,
          ...rollFields(check),
          ...(hit.soak ? { soak: hit.soak } : {}),
        });
      if (t.wp <= 0) killFoe(state, t, rng, events);
    }
  } else {
    events.push({ type: "allyMissed", name: C.ally.name, target: t.name, ...rollFields(check) });
  }
  if (--C.ally.rounds <= 0) {
    events.push({ type: "allyDeparted", name: C.ally.name });
    C.ally = null;
  }
  return events;
}

/**
 * alliesTurn(state, rng, events) — every persistent party member's strike this
 * round (PARTY-04). Generalizes allyTurn's single-`C.ally` striker over the
 * combat-scoped `C.allies` roster synced in at startCombat. The summon
 * `C.ally` path (allyTurn) is left entirely untouched and still fires
 * independently.
 *
 * DFB-05 (Phase 25.1): a live member now fights BY CLASS, read from its
 * persistent sheet (`state.party[ally.partyIdx]`) — a Fighter swings its
 * real weapon on the class/race to-hit and crits on a natural 1
 * (memberStrike below), a Thief opens the fight with a backstab, and a
 * Magic User casts its best castable attack spell on its own daily charges
 * (allyCast below) before falling back to a staff swing. A `C.allies` entry
 * whose persistent sheet is missing or lacks a recognized `cls`/`race` (the
 * defensive fallback — every real member has one) takes the pre-25.1 LEGACY
 * strike verbatim.
 *
 * DETERMINISM GATE: the guard `!C.allies || !C.allies.length` returns
 * IMMEDIATELY drawing ZERO rng when there is no party — modeled on allyTurn's
 * own null-`C.ally` early return. An empty party (every parity fixture) never
 * enters the loop, so the seeded cursor is untouched and parity stays
 * byte-identical. EVERY new draw added by DFB-05 (memberStrike's/allyCast's
 * dice) sits strictly inside this same gate — no new draw site exists
 * outside the `for` loop below.
 *
 * LOOP SAFETY (PARTY-07): a bounded `for` over a SNAPSHOT (`C.allies.slice()`),
 * never a `while`; re-checks `liveFoes()` every iteration and BREAKS the
 * instant foes clear; skips a downed member (`wp <= 0`) rather than retrying —
 * so it can never spin.
 *
 * Phase 89 (ITEM-07, plan 06) — the Joiner ITEM policy (CONTEXT "In combat
 * (automatic, on the Joiner's turn)"), for a classed member, before the class
 * policy: in ROUND 1 pickMemberItem's ready worn item is used as a free use
 * (memberUseWorn), then the turn goes on; at or below one third of its hp, a
 * Joiner with potions drinks one (memberDrinkPotion) INSTEAD of swinging,
 * casting or using an ability. A Joiner under its own live Speed swings twice
 * on a plain strike at the one target (playerStrike's haste mirror); casts and
 * abilities are single. The decisions draw ZERO rng; the potion and a Pilfer
 * fumble roll from derived streams, so a solo fight (no C.allies) and every
 * Joiner with nothing worn or no potions are byte-identical to before.
 */
export function alliesTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.allies || !C.allies.length) return events;
  for (const ally of C.allies.slice()) {
    if (ally.wp <= 0) continue; // a downed member takes no swing
    const foes = liveFoes(state);
    if (!foes.length) break; // nothing left to hit — end the party's turn

    const sheet = Array.isArray(state.party) ? state.party[ally.partyIdx] : null;
    const classed = !!(sheet && sheet.cls && RACES[sheet.race]);
    if (!classed) {
      // pre-25.1 LEGACY strike — an entry with no persistent sheet
      // (defensive; every real member has one).
      const t = foes[0];
      const legacyDieN = STRIKE_DICE[clamp(ally.lvl, 1, 5) - 1];
      // Phase 72 (ROLL-01, finding F1, user ruling 2026-09-24): a legacy
      // ally's strike now obeys the same per-target to-hit rules
      // playerStrike/memberStrike apply — same order, applied to the flat
      // need-5 baseline this branch has always used. A legacy entry has no
      // weapon of its own, so magicOnly/daggerOnly always leave it
      // untouchable against a flagged foe.
      // Phase 73 (ROLL-05): the need chain is pure arithmetic (zero rng) and
      // now sits above the strike draw. `need` -> `faces`.
      let faces = 5;
      if (t.asleep > 0 || t.held) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or held — a Freeze) creature
      if (t.sp && t.sp.toHit !== undefined) faces = Math.min(faces, t.sp.toHit); // hard to hit
      if (t.sp && t.sp.fast) faces = Math.max(1, faces - 1); // "roll 1 higher to strike"
      if (t.sp && t.sp.magicOnly) faces = 0; // only magic touches it
      if (t.sp && t.sp.daggerOnly) faces = 0; // only a dagger or magic touches it
      if (t.mirror > 0) faces = Math.min(faces, 1); // RULES-10 (Phase 75.1): Mirror Self — the top face only
      // Phase 73 (ROLL-05): the ONE roll-high check helper reads the strike
      // die, then (for Philly) a second draw — same draw order as before.
      let check = rollCheck(rng, legacyDieN, atLeastFor(faces, legacyDieN));
      if (t.sp && t.sp.slow) {
        const second = rollCheck(rng, legacyDieN, check.atLeast);
        const better = Math.max(check.roll, second.roll);
        check = { roll: better, atLeast: check.atLeast, dieN: legacyDieN, ok: better >= check.atLeast };
      }
      const roll = check.roll;
      if (check.ok) {
        // Phase 72 (ROLL-01 (c)): a landed legacy-ally strike on its die's
        // best face shatters a shatter-flagged foe (the Skeleton) outright —
        // skip the damage roll.
        if (shatterIfBest(state, t, roll, legacyDieN, ally.name, rng, events)) continue;
        const d = ally.lvl * ally.lvl + rng.d(6); // roll:amount
        // D-06/D-20: a party member's blow is physical (soakable) and never
        // matches a multiplier row (no cls on a legacy C.allies entry).
        const hit = damageFoe(state, t, d, { kind: "ally", crit: false }, rng, events);
        if (!hit.soaked)
          events.push({
            type: "allyStruck",
            name: ally.name,
            target: t.name,
            dmg: hit.applied,
            ...rollFields(check),
            ...(hit.soak ? { soak: hit.soak } : {}),
          });
        if (t.wp <= 0) killFoe(state, t, rng, events);
      } else {
        events.push({ type: "allyMissed", name: ally.name, target: t.name, ...rollFields(check) });
      }
      continue;
    }

    const view = memberView(sheet, ally);

    // Phase 89 (ITEM-07, plan 06; user 2026-09-30: "let joiners use items they
    // have ... Just like players."): the Joiner's own item policy, ahead of the
    // class policy below. ROUND 1: the first ready worn item with a timed
    // effect is used as a FREE use (the hero's item uses cost no action), then
    // the turn goes on. At or below ONE THIRD of its hp (exact integer test,
    // wp*3 <= maxWP) it drinks one of its own potions INSTEAD of swinging,
    // casting or using an ability (the hero's potion costs the hero's turn).
    // Both decisions draw nothing; the potion and a Pilfer fumble roll from
    // derived streams inside items.js, so the main rng only ever sees strikes.
    if (C.round === 1) {
      const slot = pickMemberItem(state, ally.partyIdx);
      if (slot) {
        memberUseWorn(state, ally.partyIdx, slot, rng, events);
        if (ally.wp <= 0) continue; // a Pilfer fumble can drop it: no more turn
        if (!liveFoes(state).length) break;
      }
    }
    if ((sheet.potions || 0) > 0 && ally.wp * 3 <= ally.maxWP) {
      memberDrinkPotion(state, ally.partyIdx, rng, events);
      continue;
    }

    // Phase 91 (IDENT-17, plan 91-07; CONTEXT "Joiner Bards sing once per fight,
    // automatically on their turn"): a Joiner Bard's FIRST turn of the fight is
    // its song (a saving potion above comes first), before any ability, cast or
    // strike: `ally.sang` (the fight's own ally entry, so it never leaks into the
    // next fight) marks it sung. The pick (pickSong over songPool at the JOINER's
    // level), the title and every roll of the spell come from ONE derived stream,
    // derivedRng(<main cursor>, memberSong, <party index>, <acts>); the main rng
    // draws nothing for the song. The spell resolves through the Joiner cast path
    // (allyCast) in its free mode: no charge on any sheet, "you" the Joiner.
    if (sheet.sub === "Bard" && songDue(ally.sang, ally.sangAt, C.round)) {
      // V7 B (2026-10-01): the same two-song rule as the hero's: the second song comes 5 rounds after the first.
      ally.sangAt = ally.sang ? null : C.round;
      ally.sang = true;
      const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
      const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
      const songRng = derivedRng(cursor, "memberSong", ally.partyIdx, acts);
      const { sp, title } = pickSong(ally.lvl, songRng);
      events.push({ type: "sang", title, spell: sp.n, level: sp.lvl, member: ally.name });
      const cur = C.foes[C.target];
      allyCast(state, ally, sheet, view, sp, cur && cur.alive ? cur : foes[0], songRng, events, { free: true });
      continue;
    }

    // Phase 38 (ABIL-05) — a classed Fighter/Thief member fights by class
    // AND by kit: a READY ability matching pickMemberAbility's policy
    // (an opener in round 1; else a damage ability against a foe above half
    // hp; else a defensive ability while the member itself is below half)
    // is used instead of a plain strike, checked BEFORE the Magic User cast
    // branch below. Structural guard (FID-02): a sheet with no `abilities`
    // key, an empty list, or nothing ready/matching draws ZERO rng for the
    // decision itself and falls through to today's cast/strike path
    // byte-identically — false on every fixture (no fixture has a party).
    if (sheet.abilities && sheet.abilities.length) {
      const meta = pickMemberAbility(sheet, ally, C.round, foes[0], foes.length);
      if (meta) {
        resolveMemberAbility(state, ally, sheet, view, meta, foes[0], rng, events);
        continue;
      }
    }

    if (sheet.cls === "Magic User") {
      // Phase 90 plan 10 (SPELL-10, 90-CONTEXT "Joiner Magic Users cast the new
      // spells when useful"): the policy pick comes FIRST (a heal when low, a
      // room control against three or more foes, a round-1 buff, a single
      // control on a strong foe: pickMemberSpell, pure), then today's best
      // attack spell (Ice included), then the staff.
      const pick = pickMemberSpell(state, sheet, ally, view, C.round, foes);
      const cur = C.foes[C.target];
      const aimed = cur && cur.alive ? cur : foes[0];
      if (pick) {
        // a self or room pick has no foe of its own: the hero's current target
        // stands in (Doze reaches it first)
        allyCast(state, ally, sheet, view, pick.sp, pick.target || aimed, rng, events);
        continue;
      }
      const sp = bestAttackSpell({ c: view });
      if (sp && maxCharges(view) - view.spellsUsed > 0) {
        allyCast(state, ally, sheet, view, sp, aimed, rng, events);
        continue;
      }
      // no castable attack spell or no charge left — fall through to the
      // staff swing below, on the Magic User's own to-hit.
    }
    // Phase 89 (ITEM-07, plan 06): a Joiner under its OWN live Speed swings
    // twice on a plain strike, as playerStrike's haste does (`attacks =
    // max(attacks, 2)`): the loop keeps the one target and skips the second
    // swing once it has fallen. Casts and abilities above `continue` before
    // here and stay single, as the hero's are.
    // Phase 90 plan 10 (ABIL-06, Q10 A, user 2026-09-30: "Joiners use ...
    // Ambidextrous ... as the text describes"): a Joiner Fighter with
    // Ambidextrous swings twice on a plain strike, the hero's rule
    // (playerStrike: `attacks = max(attacks, 2)`), the same two-swing loop as
    // its Speed (the two do not stack). Abilities and casts stay single.
    const swings = itemEffectActive(sheet, "haste") || skill(view, "Ambidextrous") ? 2 : 1;
    const target = foes[0];
    for (let s = 0; s < swings && target.alive; s++) {
      memberStrike(state, ally, sheet, view, target, rng, events);
    }
  }
  return events;
}

/**
 * MEMBER_COMBAT_KINDS — Phase 89 (ITEM-07, plan 06): the worn-item activation
 * kinds a Joiner uses on its own in round 1 of a fight. It is the bot's own
 * round-1 buff list (tools/lib/tuning-bot.mjs: haste = Cloak of Speed,
 * critWard = Cloak of Strength, plate = Cloak of Armor, unseen = Anklet of
 * Invisibility, power = Ring of Power, giant = Gauntlet of the Giant) plus
 * invis (Cloak of Invisibility) and half (Pendant of Fortitude). Left out on
 * purpose: knit (Cloak of Regeneration) heals only by walking, and every
 * MEMBER_LEADER_KINDS kind (ruling Q2: fly, ether, glow, tongue, stone stay the
 * leader's, so the Amulet of Stone is not here). Frozen; a test pins the list.
 */
export const MEMBER_COMBAT_KINDS = Object.freeze(["haste", "critWard", "plate", "unseen", "power", "giant", "invis", "half"]);

/**
 * pickMemberItem(state, idx) — Phase 89 (ITEM-07, plan 06; CONTEXT "In combat
 * (automatic, on the Joiner's turn)": "in round 1 it uses a ready worn item's
 * timed effect", mirroring pickMemberAbility's round-1 opener): the worn slot
 * of party member `idx` whose item the Joiner should use now, or null. The
 * first WORN_SLOTS key (jewelry1, jewelry2, cloak) whose worn item is of a
 * MEMBER_COMBAT_KINDS kind (never a MEMBER_LEADER_KINDS kind), is READY (its
 * `item:<key>` record is not cooling or live) and whose effect is not already
 * live on the Joiner: another item of the same kind counts (a live Speed
 * potion blocks the Cloak of Speed, as the bot skips an active kind) and an
 * armed Pendant counts for the Pendant. Every item it could use is one the
 * player can see the Joiner wear. Pure, no rng, no mutation.
 */
export function pickMemberItem(state, idx) {
  const sheet = state && Array.isArray(state.party) ? state.party[idx] : null;
  if (!sheet || typeof sheet !== "object" || !sheet.worn || typeof sheet.worn !== "object") return null;
  for (const slot of WORN_SLOTS) {
    const it = sheet.worn[slot];
    if (!it) continue;
    const act = activationFor(it);
    if (!act || !MEMBER_COMBAT_KINDS.includes(act.kind) || MEMBER_LEADER_KINDS.includes(act.kind)) continue;
    const id = itemTimerId(it);
    if (!id || !isReady(sheet, id)) continue;
    if (act.kind === "half" ? sheet.halfNext : itemEffectActive(sheet, act.kind)) continue;
    return slot;
  }
  return null;
}

/**
 * startSpellEffect(sheet, sp, events, opts) — Phase 90 (SPELL-09): THE one
 * starter of a spell-sourced timed effect (a SPELLS row carrying an `act`
 * record, content/spells.js). Starts one `spell:<sp.n>` squares record of
 * `opts.squares ?? sp.act.effect` on `sheet` (the hero's sheet now; a Joiner's
 * own sheet and the SPELL-10 slate next; 90-07's school bonus stretch passes
 * `opts.squares`) through effects.js#startEffect, which OVERWRITES a live
 * record: a recast restarts the window and never stacks a second one. Returns
 * the record, or null when the row has no usable `act.effect` (a positive
 * integer) or the sheet cannot hold timers. It pushes nothing: the caller
 * narrates its own cast event, and expiry is told by items.js#
 * narrateTimerTransitions (spellEffectFaded). Pure bookkeeping, zero rng.
 */
export function startSpellEffect(sheet, sp, events, opts = {}) {
  if (!sp || !sp.act || !Number.isInteger(sp.act.effect) || sp.act.effect <= 0) return null;
  const squares = Number.isInteger(opts.squares) && opts.squares > 0 ? opts.squares : sp.act.effect;
  return startEffect(sheet, "spell:" + sp.n, { squares });
}

/**
 * memberView(sheet, ally) — Phase 38 (ABIL-05): today's `view` literal
 * (DFB-05, Phase 25.1) factored out unchanged — a READ view of a party
 * member's persistent sheet, the combat level winning (`ally.lvl`), every
 * field weaponDamage/maxCharges/canCast/memberToHit/strikeDie touch
 * defaulted so a sparse sheet never produces NaN (T-25.1-14). Used by
 * alliesTurn (the class/kit policy + strike/cast dispatch) and foeTurn's
 * member-branch Riposte counter. Writes go to `sheet` (the persistent
 * object) or `ally` (the transient combat entry), never to this view.
 */
function memberView(sheet, ally) {
  return {
    ...sheet,
    level: ally.lvl,
    prof: sheet.prof ?? 0,
    magicWpn: sheet.magicWpn ?? 0,
    might: sheet.might ?? 0,
    items: sheet.items ?? [],
    skills: sheet.skills ?? {},
    grimoire: sheet.grimoire ?? [],
    spellsUsed: sheet.spellsUsed ?? 0,
  };
}

/**
 * pickMemberAbility(sheet, ally, round, target) — Phase 38 (ABIL-05): the
 * Joiner class-driven use policy (38-CONTEXT.md "Joiners"). Pure, no rng —
 * the pick itself never draws:
 *   - round 1: the first READY ability tagged "opener" (`sheet.abilities`
 *     order breaks ties).
 *   - else a live `target` above half hp: the first READY ability tagged
 *     "damage" (Last Stand excluded unless the member itself is at/below
 *     the death-panic threshold — it is a desperation move, not a plain
 *     damage pick).
 *   - else the member itself below half hp: the first READY ability tagged
 *     "defensive".
 *   - else `null` (falls through to today's plain strike/cast).
 * "READY" means owned (`sheet.abilities` includes the id), the id resolves
 * in the catalog for THIS member's own class (T-38-09: an id belonging to
 * the other class, or an unknown id, is silently ignored), and
 * `isReady(sheet, "ability:"+id)` (Phase 36 `sheet.timers`).
 *
 * Quick 260928-nrf (user ruling 2026-09-28): `liveCount` is the fight's
 * living-foe count; an ability abilities.js#abilityShortfall refuses at that
 * count (Sweep below two foes) is not READY. Omitted (a direct test call),
 * no shortfall applies.
 *
 * Phase 91.1 plan 02 (user rulings V1 to V5, 2026-10-01): Kata, Feint,
 * Overhead Blow, Last Stand, Second Wind, Smoke, Hamstring and Mark are
 * cooldown abilities now (they were once per fight), so a Joiner reads their
 * `isReady` on its own sheet like every other numeric cooldown; Hamstring and
 * Mark are also not READY against a `target` that already carries the effect
 * (abilities.js#abilityTargetShortfall).
 */
export function pickMemberAbility(sheet, ally, round, target, liveCount) {
  const owned = Array.isArray(sheet.abilities) ? sheet.abilities : [];
  const ready = owned
    .filter(
      (id) =>
        ABILITY_BY_ID[id] &&
        ABILITY_BY_ID[id].cls === sheet.cls &&
        isReady(sheet, `ability:${id}`) &&
        !(Number.isInteger(liveCount) && abilityShortfall(id, liveCount)) &&
        // Phase 91.1 plan 02 (V5): Hamstring and Mark never on a foe that
        // already carries the effect (the hero's own refusal rule).
        !abilityTargetShortfall(id, target),
    )
    .map((id) => ABILITY_BY_ID[id]);
  if (round === 1) {
    const opener = ready.find((m) => m.tag === "opener");
    if (opener) return opener;
  }
  if (target && target.wp > target.maxWP / 2) {
    const dmg = ready.find((m) => m.tag === "damage" && (m.id !== "lastStand" || ally.wp <= ally.maxWP * DEATH_PANIC_THRESHOLD));
    if (dmg) return dmg;
  }
  if (ally.wp < ally.maxWP / 2) {
    const def = ready.find((m) => m.tag === "defensive");
    if (def) return def;
  }
  return null;
}

/**
 * MEMBER_ROOM_CONTROL_KINDS / MEMBER_BUFF_ACT_KINDS / MEMBER_SINGLE_CONTROL_KINDS
 * — Phase 90 plan 10 (SPELL-10): the three spell families a Joiner Magic User
 * picks on policy (pickMemberSpell below), by SPELLS `kind` (and, for the buffs,
 * the timed row's `act.kind`). Keyed by engine kinds and act kinds, never by
 * display name. Frozen; a test pins the lists.
 */
export const MEMBER_ROOM_CONTROL_KINDS = Object.freeze(["timestop", "behemoth", "status"]);
export const MEMBER_BUFF_ACT_KINDS = Object.freeze(["haste", "enchant"]);
export const MEMBER_SINGLE_CONTROL_KINDS = Object.freeze(["misdirect", "stun"]);

/**
 * pickMemberSpell(state, sheet, ally, view, round, foes) — Phase 90 plan 10
 * (SPELL-10, 90-CONTEXT "Joiner Magic Users cast the new spells when useful";
 * the Magic User twin of pickMemberAbility's round-1 opener and half-hit-point
 * defensive rules). The spell a Joiner Magic User should cast now, as
 * `{ sp, target }` (`target` is the foe a single-control pick aims at, else
 * null), or `null` when the policy has no pick and the caller falls through to
 * `bestAttackSpell` (Ice included) and then the staff. PURE: no rng, no
 * mutation, nothing drawn. `view` is memberView(sheet, ally); `foes` the live
 * foes; `round` the fight's round; `state` is read only for the hero's current
 * target. Every candidate comes from the Joiner's OWN book through
 * `canCast({ c: view }, sp)` (so the school gates and levels hold) and needs a
 * charge left on its OWN sheet (`maxCharges(view) - spellsUsed`).
 *
 * The order (the first step with a castable pick wins; inside a step the higher
 * EFFECTIVE level wins, then SPELLS order):
 *   1. at or below HALF its hit points (`ally.wp * 2 <= ally.maxWP`): a castable
 *      healing spell (kind `heal`) on itself;
 *   2. three or more live foes: the room control among Stop Time (`timestop`),
 *      Size of the Behemoth (`behemoth`) and Doze (`status`), unless it is
 *      already in force on every live foe (all held in time, all cowering, all
 *      asleep);
 *   3. ROUND 1: a self buff among the `timed` rows whose act kind is `haste`
 *      (Speed of Sound) or `enchant` (Enchant Character) that is not already live
 *      on its sheet (a live Speed potion or cloak counts for `haste`);
 *   4. a live foe at or above the Joiner's level with more than half its hit
 *      points: a single-foe control among Duplicate Foe and Senseless
 *      (`misdirect`) and Stun (`stun`) not already on it (held, misdirected or
 *      stunned); Senseless needs another live foe to turn it on, so it is skipped
 *      against a lone foe. The hero's current target is looked at first;
 *   5. else `null`.
 * NEVER picked, each for its reason (docs/SPELL-AUDIT.md, "Joiner casters"): Door
 * Illusion (`door`) and Chameleon Tongue (`tongue`) and Summon (`summon`) are the
 * HERO's decisions (leaving the fight, the fight's one parley, the one summoned
 * ally); Open/Lock and Fly (`timed` with act `unlock` or `fly`), Map the Floor
 * (`reveal`), Sense Danger (`foresee`) and Sense Presence (`senses`) are maze and
 * sight tools whose effect the party's leader reads; Shield and Bubble (`ward`),
 * Mirror Self (`mirror`) and Regeneration (`regen`) have no member-side read or
 * countdown in the engine (a Joiner takes blows through applyFoeDamageToMember,
 * which has no ward, and ticks no mirror or regen); Strength (`might`) adds its d10
 * to the HERO's damage rolls only. A kind that is none of the four steps above
 * simply never matches.
 */
export function pickMemberSpell(state, sheet, ally, view, round, foes) {
  if (!view || !ally || !Array.isArray(foes) || foes.length === 0) return null;
  if (maxCharges(view) - (view.spellsUsed || 0) <= 0) return null;
  const sub = view.sub;
  const book = SPELLS.filter((sp) => canCast({ c: view }, sp));
  if (!book.length) return null;
  const best = (list) => list.reduce((b, sp) => (!b || spellLevelFor(sub, sp) > spellLevelFor(sub, b) ? sp : b), null);

  // 1. low: heal itself
  if (ally.wp * 2 <= ally.maxWP) {
    const heal = best(book.filter((sp) => sp.kind === "heal"));
    if (heal) return { sp: heal, target: null };
  }

  // 2. a crowd: the best room control that is not already in force on everyone
  if (foes.length >= 3) {
    const room = book.filter((sp) => {
      if (!MEMBER_ROOM_CONTROL_KINDS.includes(sp.kind)) return false;
      if (sp.kind === "timestop") return !foes.every((f) => f.held && f.held.kind === "time");
      if (sp.kind === "behemoth") return !foes.every((f) => f.cowering);
      return !foes.every((f) => f.asleep > 0); // Doze
    });
    const pick = best(room);
    if (pick) return { sp: pick, target: null };
  }

  // 3. round 1: a self buff not already live on the sheet
  if (round === 1) {
    const buff = best(
      book.filter((sp) => sp.kind === "timed" && sp.act && MEMBER_BUFF_ACT_KINDS.includes(sp.act.kind) && !itemEffectActive(view, sp.act.kind)),
    );
    if (buff) return { sp: buff, target: null };
  }

  // 4. a strong foe: a single control it is not already under
  const C = state && state.combat;
  const aimed = C && Array.isArray(C.foes) && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
  const order = aimed ? [aimed, ...foes.filter((f) => f !== aimed)] : foes;
  const singles = book.filter((sp) => MEMBER_SINGLE_CONTROL_KINDS.includes(sp.kind));
  if (singles.length) {
    for (const f of order) {
      if (!(f.lvl >= ally.lvl && f.wp * 2 > f.maxWP)) continue;
      const fit = singles.filter((sp) => {
        if (sp.kind === "stun") return !f.held && !f.stunned;
        if (f.misdirect && f.misdirect.left > 0) return false;
        return sp.at === "self" || foes.some((o) => o !== f); // Senseless needs a friend to hit
      });
      const pick = best(fit);
      if (pick) return { sp: pick, target: f };
    }
  }
  return null;
}

/**
 * startMemberAbilityTimer(sheet, meta) — the member-sheet analog of
 * abilities.js#useAbility's own startAbilityTimer: the EXACT SAME
 * abilityEffectTicks/ONCE_A_FIGHT mapping, applied to a Joiner's own
 * `sheet.timers` (Phase 36) instead of the hero's `c.timers`.
 */
function startMemberAbilityTimer(sheet, meta) {
  const id = `ability:${meta.id}`;
  const cd = meta.cd === "fight" ? ONCE_A_FIGHT : meta.cd;
  // Quick 260928-hrs: abilities.js#abilityEffectTicks (the stated rounds
  // AFTER the use round, plus the use round's own tick), the hero's length.
  const ticks = abilityEffectTicks(meta.id);
  if (ticks) {
    startEffect(sheet, id, { rounds: ticks, cd });
  } else {
    startCooldown(sheet, id, { rounds: cd });
  }
}

/**
 * resolveMemberAbility(state, ally, sheet, view, meta, t, rng, events) —
 * Phase 38 (ABIL-05): a Joiner's own ability use, mirroring
 * abilities.js#useAbility's resolution switch one-for-one but on the
 * member's OWN combat entry (`ally`) and persistent sheet (`sheet`), never
 * the hero's `state.c`/`state.combat`. `applyPommel`/`applyDirtyTrick`/
 * `applyPoison`/`applyHamstring`/`applyMark` (Plan 03) are reused verbatim —
 * a Joiner's foe-flag ability sets the exact same fields on the exact same
 * foe object shape the hero's does. Every Plan 03 activation/effect event
 * this switch reuses gains an additive `member` field naming the actor.
 */
function resolveMemberAbility(state, ally, sheet, view, meta, t, rng, events) {
  events.push({
    type: "memberAbilityUsed",
    name: ally.name,
    key: meta.id,
    ability: meta.name,
    ...(meta.target === "foe" ? { target: t.name } : {}),
  });
  startMemberAbilityTimer(sheet, meta);

  switch (meta.id) {
    case "kata":
    case "feint":
      // Quick 260928-nrf: +3 winning faces, not an auto-hit (the hero's own
      // KATA_FEINT_NEED_SHIFT descriptor).
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, needShift: KATA_FEINT_NEED_SHIFT, bonusDmg: ally.lvl });
      return;
    case "deathTouch":
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, forceCrit: true, finishUnder: 15 });
      return;
    case "silentStep":
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, autoHit: true, forceCrit: true });
      return;
    case "overheadBlow":
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, dmgMul: 2, needShift: -2 });
      return;
    case "lastStand": {
      events.push({ type: "lastStandCalled", attacks: 3, member: ally.name });
      const mod = { key: meta.id };
      for (let i = 0; i < 3 && t.alive; i++) memberStrike(state, ally, sheet, view, t, rng, events, mod);
      return;
    }
    case "pommelStrike":
      // Phase 90 (ABIL-07): a real strike that also stuns, the hero's rule;
      // memberStrike applies the stun after a landed blow that leaves the
      // target standing.
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, stunOnHit: true });
      return;
    case "dirtyTrick":
      events.push({ type: "dirtyTrickLanded", target: t.name, rounds: applyDirtyTrick(t), member: ally.name });
      return;
    case "poisonedEdge":
      applyPoison(t, poisonedEdgeDot(ally.lvl));
      events.push({ type: "poisonedEdgeApplied", target: t.name, rounds: POISON_ROUNDS, bonus: ally.lvl, member: ally.name });
      return;
    case "hamstring":
      applyHamstring(t);
      events.push({ type: "hamstrung", target: t.name, member: ally.name });
      return;
    case "mark":
      applyMark(t, ally.lvl);
      events.push({ type: "marked", target: t.name, bonus: ally.lvl, member: ally.name });
      return;
    // Phase 91.1 plan 02 (V11): a normal strike that also lifts d10 x level gold
    // into the hero's purse when a blow lands (memberStrike's `liftGold`).
    case "cutpurse":
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, liftGold: true });
      return;
    case "secondWind": {
      const heal = rng.d(8) + ally.lvl; // roll:amount
      const before = ally.wp;
      ally.wp = Math.min(ally.maxWP, ally.wp + heal);
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` (the
      // member's HP actually added) and `rolled` (the heal before the clamp)
      // — additive, zero draws. `amount` already was the clamped value.
      events.push({ type: "memberSecondWind", name: ally.name, amount: ally.wp - before, rolled: heal, gained: ally.wp - before });
      return;
    }
    case "sweep": {
      const dmg = Math.ceil(weaponDamage(view, rng) / 2);
      const foesNow = liveFoes(state);
      events.push({ type: "memberSwept", name: ally.name, dmg, count: foesNow.length });
      for (const f of foesNow.slice()) {
        const hit = damageFoe(state, f, dmg, { kind: "ally", crit: false }, rng, events);
        if (!hit.soaked) events.push({ type: "sweptFoe", target: f.name, dmg: hit.applied });
        if (f.wp <= 0) killFoe(state, f, rng, events);
      }
      return;
    }
    case "brace":
      // Phase 38 (ABIL-05): a transient combat-entry flag, exactly like
      // `ally.backstabUsed` — never synced to the sheet, rebuilt per fight.
      ally.braced = BRACE_BLOWS;
      events.push({ type: "braced", blows: BRACE_BLOWS, member: ally.name });
      return;
    case "riposte":
      events.push({ type: "riposteReady", rounds: 1, member: ally.name });
      return;
    case "taunt":
      events.push({ type: "taunted", rounds: DURATION_ROUNDS.taunt, member: ally.name });
      return;
    case "sidestep":
      events.push({ type: "sidestepped", rounds: 2, member: ally.name });
      return;
    case "battleRoar":
      events.push({ type: "battleRoarRaised", rounds: 2, member: ally.name });
      return;
    case "smoke":
      events.push({ type: "smokeThrown", rounds: 2, member: ally.name });
      return;
    default:
      return;
  }
}

/**
 * memberStrike(state, ally, sheet, view, t, rng, events, mod = null) — DFB-05:
 * a party member's melee swing (a Fighter's weapon, a Thief's dagger/
 * backstab, or a Magic User's staff when it has nothing left to cast).
 * Mirrors playerStrike's to-hit/crit/heavy-armor-denies-backstab shapes
 * exactly (VERBATIM heavy-armor list), but always deals physical
 * `kind: "ally"` damage (a member never takes the hero-only
 * Fighter-vs-Trachea multiplier row, D-20).
 *
 * DELIBERATE RULES CHANGE (Phase 25.1, 2026-09-15, DFB-05): members fight by
 * class. `backstabUsed` is transient COMBAT state on the `C.allies` entry
 * (`ally`) — rebuilt by every startCombat, never synced to the persistent
 * sheet (endCombat only syncs `wp` out), and nulled with combat on load
 * (T-25.1-15: no new field on the persistent member sheet).
 *
 * Phase 38 (ABIL-05): `mod` is the member analog of playerStrike's transient
 * `C.abilityStrike` descriptor — passed in directly by resolveMemberAbility
 * rather than stashed on `ally`/`state.combat` (a Joiner never dispatches
 * `useAbility`; there is no shared combat-scoped slot to clash over). `null`
 * (the default) leaves every line below BYTE-IDENTICAL to before this plan.
 * With a `mod`: `attacks` is never read here (a multi-attack ability's own
 * loop, e.g. Last Stand, is the CALLER's — resolveMemberAbility); `needShift`
 * shifts `need` before the roll (floor 1); `autoHit` skips the miss branch
 * entirely; `bonusDmg` is added right after `weaponDamage`; `finishUnder`
 * mirrors playerStrike's own gate exactly (ignores `noCrit`; the
 * `weaponDamage` roll just taken is discarded, not skipped — same draw
 * order as an ordinary strike); Phase 90's `stunOnHit` (Pommel Strike) stuns
 * the target after a landed blow that leaves it standing (applyPommel and a
 * `pommelStruck` carrying `member`, no draw); `forceCrit` sets `crit` subject to the
 * member's own Guard/Soldier `noCrit` rule, with Silent Step specifically
 * denied by the heavy-armor list (mirrors `AS.forceCrit`'s `deniedByHeavy`);
 * `dmgMul` applies after the crit doubling; `allyMissed`/`allyStruck` gain
 * an additive `via: mod.key`. `t.marked`'s bonus (markBonus: the marker's
 * level since Phase 91.1 plan 02, V10; was +2) applies UNCONDITIONALLY, `mod`
 * or not — a marked foe takes it from every striker, hero or member alike;
 * Phase 91.1 plan 02 (V11): `liftGold` (Cutpurse) lifts d10 x level gold after
 * a landed blow, from a derived stream.
 */
function memberStrike(state, ally, sheet, view, t, rng, events, mod = null) {
  const dieN = strikeDie(view);
  // Phase 72 (ROLL-01, finding F1, user ruling 2026-09-24): a party member's
  // strike now obeys the SAME per-target to-hit rules playerStrike applies
  // to the hero — every bestiary note promising one of these terms is
  // written for "a strike", not "the hero's strike specifically". Same
  // order as playerStrike: dozing/stupid, sp.toHit, sp.fast, magicOnly,
  // daggerOnly (F3), and finally the ability descriptor's own needShift —
  // mirroring playerStrike's Overhead Blow, which also applies AFTER the
  // per-target terms.
  // Phase 73 (ROLL-05): the need chain is pure arithmetic (zero rng) and now
  // sits above the strike draw. `need` -> `faces`.
  let faces = memberToHit(view);
  if (t.asleep > 0 || t.held) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or held — a Freeze) creature
  if (t.sp && t.sp.toHit !== undefined) faces = Math.min(faces, t.sp.toHit); // hard to hit
  if (t.sp && t.sp.fast) faces = Math.max(1, faces - 1); // "roll 1 higher to strike"
  if (t.sp && t.sp.magicOnly && !view.magicWpn) faces = 0; // only magic touches it
  if (t.sp && t.sp.daggerOnly && !view.magicWpn && view.weapon !== "Dagger") faces = 0; // only a dagger or magic touches it
  if (t.mirror > 0) faces = Math.min(faces, 1); // RULES-10 (Phase 75.1): Mirror Self — the top face only
  // Quick 260928-nrf: the SAME shiftedFaces the hero's strike uses, and the
  // same `faces > 0` guard — a need shift never revives an untouchable foe
  // (before this, a Joiner's Overhead Blow lifted a 0 to 1).
  if (mod && mod.needShift && faces > 0) faces = shiftedFaces(faces, mod.needShift, dieN);
  // Phase 73 (ROLL-05): the ONE roll-high check helper reads the strike die,
  // then (for Philly) a second draw — same draw order as before (the strike
  // die, then Philly's).
  let check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
  if (t.sp && t.sp.slow) {
    const second = rollCheck(rng, dieN, check.atLeast);
    const better = Math.max(check.roll, second.roll);
    check = { roll: better, atLeast: check.atLeast, dieN, ok: better >= check.atLeast };
  }
  const roll = check.roll;
  const weapon = sheet.weapon;
  const auto = !!(mod && mod.autoHit);
  if (!auto && !check.ok) {
    events.push({
      type: "allyMissed",
      name: ally.name,
      target: t.name,
      ...rollFields(check),
      ...(weapon ? { weapon } : {}),
      ...(mod ? { via: mod.key } : {}),
    });
    return;
  }
  // Phase 72 (ROLL-01 (c)): a landed member strike on its die's best face
  // shatters a shatter-flagged foe (the Skeleton) outright — skip the
  // damage roll.
  if (shatterIfBest(state, t, roll, dieN, ally.name, rng, events)) {
    ally.opened = true;
    return;
  }
  let dmg = weaponDamage(view, rng);
  if (mod && mod.bonusDmg) dmg += mod.bonusDmg;
  const noCrit = view.sub === "Guard" || view.sub === "Soldier";
  // Phase 90 plan 10 (ABIL-06, Q10 A): the Joiner's OWN opening landed blow, the
  // transient combat entry's `opened` flag (like `backstabUsed`, never synced
  // to the sheet), read by Stealth below. A flag, no draw.
  const opening = !ally.opened;
  ally.opened = true;
  // Phase 73 (ROLL-05): a member's natural-best crit is the die's top face
  // (isBestFace), not a fixed "natural 1" — byte-identical odds, mirrored.
  let crit = isBestFace(roll, dieN) && !noCrit;
  // Phase 73 (ROLL-05): the lowest winning face for the crit that landed —
  // only set for the die-driven crit above; backstab/a forced crit are
  // unconditional and carry no threshold of their own (reset below).
  let critAtLeast = crit ? dieN : undefined;
  // Phase 38 (ABIL-05): Death Touch's finish, mirroring playerStrike's own
  // gate exactly.
  if (mod && mod.finishUnder && t.wp < mod.finishUnder) {
    events.push({ type: "deathTouch", target: t.name, via: mod.key, member: ally.name });
    t.wp = 0;
    killFoe(state, t, rng, events);
    return;
  }
  let backstab = false;
  // "Heavy armor negates any advantages they may gain for stealthiness" —
  // the hero's exact rule (playerStrike), copied verbatim. Phase 39
  // (GEAR-01): armorBulk(view) >= 2, mirroring the hero-side generalization.
  const heavy = view.cls === "Thief" && armorBulk(view) >= 2;
  if (mod && mod.forceCrit) {
    const deniedByHeavy = mod.key === "silentStep" && heavy;
    if (!noCrit && !deniedByHeavy) {
      crit = true;
      critAtLeast = undefined;
    }
  }
  if (!mod && view.cls === "Thief" && !ally.backstabUsed && !heavy) {
    crit = true;
    critAtLeast = undefined;
    backstab = true;
    ally.backstabUsed = true; // the transient combat entry, not the sheet
  }
  // Phase 90 plan 10 (ABIL-06, Q10 A, user 2026-09-30): a Joiner's Stealth, the
  // hero's rule (playerStrike): the Joiner's OPENING landed blow of the fight
  // crits on a roll in its die's top STEALTH_CRIT_FACES numbers (three since
  // Phase 91.1 plan 02, V12), never in plate (armorBulk) and
  // never in the dark (the party's light is the leader's, darkLimited, unless
  // the leader's Sense Presence is up), and never for a Guard or Soldier (their
  // blows never crit). A pure read of the roll already made, zero draws; the
  // doubling below is the one every crit takes (a natural crit never doubles
  // twice).
  if (opening && !noCrit && skill(view, "Stealth") && armorBulk(view) < 2 && !(darkLimited(state) && !state.c.senses && !ally.senses) && roll >= atLeastFor(STEALTH_CRIT_FACES, dieN)) {
    crit = true;
    critAtLeast = atLeastFor(STEALTH_CRIT_FACES, dieN);
    events.push({ type: "stealthStrike", member: ally.name });
  }
  if (crit) dmg *= 2;
  if (mod && mod.dmgMul) dmg *= mod.dmgMul;
  dmg += markBonus(t); // Phase 91.1 plan 02 (V10): the marker's level, whoever swings
  const hit = damageFoe(state, t, dmg, { kind: "ally", crit, by: ally.name }, rng, events);
  if (!hit.soaked)
    events.push({
      type: "allyStruck",
      name: ally.name,
      target: t.name,
      dmg: hit.applied,
      ...rollFields(check),
      ...(weapon ? { weapon } : {}),
      ...(crit ? { crit: true } : {}),
      ...(critAtLeast !== undefined ? { critAtLeast } : {}),
      ...(backstab ? { backstab: true } : {}),
      ...(auto ? { auto: true } : {}),
      ...(mod ? { via: mod.key } : {}),
      ...(hit.soak ? { soak: hit.soak } : {}),
    });
  if (t.wp <= 0) killFoe(state, t, rng, events);
  // Phase 90 (ABIL-07): Pommel Strike's stun, the hero's rule (playerStrike):
  // a landed blow that leaves the target standing costs it its next turn. A
  // flag, no draw; one blow per call, so one stun per use.
  if (mod && mod.stunOnHit && t.alive) {
    applyPommel(t);
    events.push({ type: "pommelStruck", target: t.name, member: ally.name });
  }
  // Phase 91.1 plan 02 (V11): Cutpurse's gold, the hero's rule (playerStrike):
  // a landed blow lifts d10 x the Joiner's level, after the blow's own events,
  // rolled on a derived stream (no draw on the main rng), into the hero's purse.
  if (mod && mod.liftGold) {
    const amount = cutpurseGold(state, rng, ally.lvl, ally.name);
    events.push({ type: "cutpursed", target: t.name, amount, member: ally.name });
    gainWilmst(state, amount, "cutpurse", rng, events);
  }
}

/**
 * allyCast(state, ally, sheet, view, sp, t, rng, events) — DFB-05: a Magic
 * User party member casting its best attack spell at the hero's current
 * live target. SELF-CONTAINED (magic.js already imports combat.js, so a
 * back-import here would be a cycle) — mirrors castSpell's dice shapes
 * exactly: thrown = d8 vs 4 (Freeze d10 vs 6) with the subclass school bonus
 * + eff(throw), damage = rollDice(sp.dmg) + level² (quick 260928-sq2) +
 * eff(spellDmg) through damageFoe kind "spell" (no armor draw), Freeze
 * lands its damage and then freezes a survivor for d4 rounds through
 * freezeFoe, exactly like the hero's cast (user rulings 2026-09-28). Phase
 * 90 plan 05: Ice (blast), Doze (status) and Stun (stun) are the hero's rules
 * through the shared tails below (iceStorm: d10 + the Joiner's level² to every
 * foe then a freeze for each survivor; dozeFoes: d4 foes, the target first,
 * each its own d4, marked dozing; stunFoe: the target held d4 rounds after its
 * resist), the Joiner's name on every line; a Weaken rolls per live foe through
 * roomWeakenResists (quick 260927-rsx: every targeted foe rolls the one
 * depth-rising resist) and sets the party's `C.weakened`/`C.foeToHitPenalty`.
 * The persistent sheet pays the charge (`sheet.spellsUsed++`), never the
 * transient `view`.
 *
 * Phase 90 plan 10 (SPELL-10, Q8 A): a Joiner's `thrown` spell with `aoe: "all"`
 * (Lightning) reaches EVERY live foe, each on its own resist, its own to-hit
 * roll and its own damage roll, exactly as the hero's cast (magic.js): the
 * per-foe order is resist (a derived stream), then the to-hit die, then (on a
 * hit) the damage dice. And the policy kinds pickMemberSpell can choose resolve
 * through the hero's own shared tails, the Joiner's name (`by`/`member`) on
 * every event and the charge paid from its own sheet: `heal` (the spell's dice
 * from a DERIVED stream, the Cleric's +3, a heal2x race's doubling, then the
 * caster's healMul, clamped to the Joiner's own maximum: `memberHealed`),
 * `timed` (a `spell:<name>` record on the Joiner's own sheet, stretched by its
 * own school bonus: `spellEffectStarted` with `member`), `timestop` (stopTime),
 * `misdirect` (misdirectFoe, the Joiner's own resist inside) and `behemoth`
 * (behemothRoar, the Joiner's level). A self or room spell has no foe `t`.
 *
 * Phase 91 plan 07 (IDENT-17, the Joiner half of the Bard's song): `opts.free`
 * is a charge-free cast (a Joiner Bard's song: no charge from any sheet, the
 * hero's castSpell free mode's twin), and the cast now resolves EVERY kind the
 * song pool holds, so a sung spell is one Joiner cast path, not a second
 * resolver: a ward (Shield, Bubble) is `ally.ward` (the Joiner's own combat
 * entry, read by applyFoeDamageToMember where the hero's ward is read, ticked
 * and faded in foeTurn's tail), Strength a `spell:Strength` record on the
 * Joiner's own sheet (memberView and strengthRoll pick it up), Sense Presence
 * `ally.senses`, Earthquake's backlash and Death's fee come out of `ally.wp`
 * (Earthquake can down the Joiner through downMember; Death refuses at 26 hp or
 * less, as the hero's does, so its fee never downs it), and the foe-side kinds
 * (Acid, Stupidity, Blind, Shrink, Noxious Vapor, Fireballs, Petrify, Insane,
 * Turn Walking Dead, Plane Gate) are the hero's rules at the Joiner's level.
 * "You" in a spell's text is the Joiner; nothing here writes the hero's sheet.
 */
function allyCast(state, ally, sheet, view, sp, t, rng, events, opts = {}) {
  if (!opts.free) sheet.spellsUsed = (sheet.spellsUsed || 0) + 1;
  // Self and room spells: no single foe is the target, so no `allyCast` line
  // (the sibling event below names the Joiner and the spell).
  if (sp.kind === "heal") {
    const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
    const healRng = derivedRng(cursor, "memberHeal", state.combat ? state.combat.round : 0, ally.partyIdx, sheet.spellsUsed);
    // Phase 91.1 plan 03 (V18 B): the chart's healing bonus, the hero's own rule (Cleric +4, Court Mage +1).
    let amt = rollDice(healRng, sp.dmg) + healBonusFor(view.sub);
    if (RACES[view.race] && RACES[view.race].heal2x) amt *= 2;
    const healed = applyCasterHealMul(view.sub, amt);
    const before = ally.wp;
    ally.wp = Math.min(ally.maxWP, ally.wp + healed);
    events.push({ type: "memberHealed", name: ally.name, spell: sp.n, amount: healed, ...(healed !== amt ? { halved: true } : {}), gained: ally.wp - before });
    return;
  }
  if (sp.kind === "timed") {
    const prior = sheet.timers && sheet.timers["spell:" + sp.n];
    const restarted = !!(prior && prior.phase === "effect" && prior.left > 0);
    const rec = startSpellEffect(sheet, sp, events, { squares: spellEffectSquares(view.sub, sp) });
    events.push({ type: "spellEffectStarted", spell: sp.n, kind: sp.act.kind, squares: rec ? rec.left : 0, restarted, member: ally.name });
    return;
  }
  // Phase 91 plan 07 (IDENT-17): the self kinds of the song pool. "You" is the
  // Joiner: the ward is its own combat entry's, Strength its own sheet's record,
  // Sense Presence its own flag (the hero's `c.ward`, `c.timers` and `c.senses`
  // are never written here).
  if (sp.kind === "ward") {
    // Shield's soak pool and rounds, or Bubble's armed mirror (pool 0, never ticks
    // until it pops), exactly the hero's records (magic.js's ward branch).
    // Phase 91.1 plan 03 (V18 B): the Joiner's own protection bonus enlarges it, as the hero's does.
    const wardHp = wardBonusFor(view.sub);
    ally.ward = sp.mirror
      ? { name: sp.n, mirror: true, pool: 0, popPool: sp.popPool + wardHp, rounds: null }
      : { pool: sp.pool + wardHp, rounds: sp.rounds, name: sp.n };
    events.push(
      sp.mirror
        ? { type: "wardRaised", spell: sp.n, pool: 0, mirror: true, popPool: sp.popPool + wardHp, member: ally.name }
        : { type: "wardRaised", spell: sp.n, pool: sp.pool + wardHp, member: ally.name },
    );
    return;
  }
  if (sp.kind === "might") {
    // Strength: one `spell:Strength` squares record (100 squares), a recast restarts it.
    const prior = sheet.timers && sheet.timers["spell:" + sp.n];
    const restarted = !!(prior && prior.phase === "effect" && prior.left > 0);
    const rec = startSpellEffect(sheet, sp, events);
    events.push({ type: "strengthCast", squares: rec ? rec.left : 0, restarted, member: ally.name });
    return;
  }
  if (sp.kind === "senses") {
    // The Joiner has no darkness read of its own beyond its Stealth crit, and a sung
    // song comes on its first turn, after any ambush is over: the flag is read by
    // memberStrike's Stealth test (the dark costs the Joiner nothing).
    ally.senses = true;
    events.push({ type: "sensesGained", member: ally.name });
    return;
  }
  const casterTail = { by: ally.name, sheet: view, level: view.level, sub: view.sub };
  if (sp.kind === "timestop") {
    stopTime(state, sp, rng, events, casterTail);
    return;
  }
  if (sp.kind === "behemoth") {
    behemothRoar(state, sp, rng, events, casterTail);
    return;
  }
  const base = { name: ally.name, spell: sp.n, target: t.name };
  if (sp.kind === "misdirect") {
    // Senseless and Duplicate Foe: the target's one resist is rolled inside
    // misdirectFoe for a Joiner (`by`), then the duration dice.
    events.push({ type: "allyCast", ...base });
    misdirectFoe(state, t, sp, rng, events, casterTail);
    return;
  }
  if (sp.kind === "thrown" && sp.aoe === "all") {
    // Q8 A: every live foe, in C.foes order, each its own resist, to-hit and damage.
    for (const f of liveFoes(state)) allyThrow(state, ally, view, sp, f, rng, events);
    return;
  }
  if (sp.kind === "thrown") {
    allyThrow(state, ally, view, sp, t, rng, events);
    return;
  }
  // Phase 91 plan 07 (IDENT-17): the foe-side kinds of the song pool, the hero's
  // rules (magic.js, the same draws in the same order) at the Joiner's level, the
  // Joiner's name on the cast line and every resist, with no Afraid and no
  // spellDamageFor on the damage (a Joiner is neither; iceStorm's Joiner reading).
  // One-foe kinds roll the target's one depth-rising resist up front; room kinds
  // roll it per foe inside.
  const levelSq = spellLevelSq(view);
  const bySource = { kind: "spell", school: sp.kind, casterSub: view.sub, by: ally.name };
  if (["acid", "stupid", "blind", "petrify", "insane", "death"].includes(sp.kind)) {
    events.push({ type: "allyCast", ...base });
    if (foeResistsSpell(state, t, sp.n, rng, events, ally.name)) return;
    if (sp.kind === "acid") {
      // the dissolve ticks in foeTurn; level² rides the first tick only, once per cast
      t.acid = { rounds: rng.d(6), dmg: sp.dmg, levelSq }; // roll:amount
      events.push({ type: "acidApplied", target: t.name, rounds: t.acid.rounds });
    } else if (sp.kind === "stupid") {
      const was = Number.isFinite(t.intel) ? t.intel : 0;
      t.intel = 1;
      t.stupid = true;
      events.push({ type: "stupefied", target: t.name, intel: 1, was });
    } else if (sp.kind === "blind") {
      t.blind = true;
      delete t.blindFor;
      events.push({ type: "blinded", target: t.name });
    } else if (sp.kind === "petrify") {
      events.push({ type: "petrified", target: t.name });
      t.lives = 1;
      t.frozen = true;
      killFoe(state, t, rng, events, { spoils: false });
    } else if (sp.kind === "insane") {
      const r = rng.d(6); // roll:selection
      events.push({ type: "insaneRolled", target: t.name, roll: r });
      if (r === 1) {
        t.wp = 0;
        killFoe(state, t, rng, events);
      } else if (r === 2) {
        const o = liveFoes(state).find((f) => f !== t);
        if (o) {
          const d = t.lvl * t.lvl + rng.d(6); // roll:amount
          const hit = damageFoe(state, o, d, { kind: "foe", crit: false }, rng, events);
          if (!hit.soaked) events.push({ type: "insaneStruckAlly", target: o.name, dmg: hit.applied });
          if (o.wp <= 0) killFoe(state, o, rng, events);
        }
      } else if (r === 3 || r === 6) {
        t.alive = false;
        t.wp = 0;
        t.fled = true;
        events.push({ type: "insaneFled", target: t.name });
      } else if (r === 4) {
        t.asleep = rng.d(4); // roll:amount
      } else if (r === 5) {
        t.frenzied = true;
      }
    } else {
      // death: the fee is the Joiner's own hit points. Like the hero's, it refuses at
      // the fee plus one or less (the spell will not be what downs its caster), so the
      // fee can never down the Joiner; in a paid (non-free) cast the charge is refunded.
      const DEATH_SPELL_FEE = 25;
      if (ally.wp <= DEATH_SPELL_FEE + 1) {
        events.push({ type: "deathSpellTooWeak", fee: DEATH_SPELL_FEE, member: ally.name });
        if (!opts.free) sheet.spellsUsed--;
        return;
      }
      ally.wp -= DEATH_SPELL_FEE;
      events.push({ type: "deathCast", cost: DEATH_SPELL_FEE, member: ally.name });
      t.wp = 0;
      killFoe(state, t, rng, events);
    }
    return;
  }
  if (["shrink", "quake", "vapor", "volley", "turn", "gate"].includes(sp.kind)) {
    events.push({ type: "allyCast", ...base });
    if (sp.kind === "shrink") {
      const n = rng.d(6); // roll:amount
      let halved = 0;
      liveFoes(state)
        .slice(0, n)
        .forEach((f) => {
          if (foeResistsSpell(state, f, sp.n, rng, events, ally.name)) return;
          f.wp = Math.ceil(f.wp / 2);
          f.maxWP = Math.ceil(f.maxWP / 2);
          f.shrunk = true;
          halved++;
        });
      events.push({ type: "shrunk", count: halved });
    } else if (sp.kind === "quake") {
      // every foe takes the one roll + a live Strength's d10 + level²; the backlash is
      // half the dice alone, and none to a warded Joiner (the hero's rule: c.ward).
      const rolled = rollDice(rng, sp.dmg);
      const d = rolled + strengthRoll(view, rng) + levelSq;
      const quakeHit = liveFoes(state).filter((f) => !foeResistsSpell(state, f, sp.n, rng, events, ally.name));
      quakeHit.forEach((f) => {
        damageFoe(state, f, d, bySource, rng, events);
        if (f.wp <= 0) killFoe(state, f, rng, events);
      });
      events.push({ type: "earthquake", amount: d });
      if (!ally.ward) {
        const self = Math.ceil(rolled / 2);
        ally.wp -= self;
        events.push({ type: "earthquakeSelfDamage", amount: self, spell: sp.n, member: ally.name });
        if (ally.wp <= 0) downMember(state, ally, events);
      }
    } else if (sp.kind === "vapor") {
      const r = view.level >= 5 ? 4 : rng.d(6); // roll:selection
      events.push({ type: "vaporRolled", roll: r });
      liveFoes(state).forEach((f) => {
        if (foeResistsSpell(state, f, sp.n, rng, events, ally.name)) return;
        if (r === 4 && rng.d(10) !== 1) { // roll:mishap-on-1
          f.wp = 0;
          killFoe(state, f, rng, events);
        } else {
          const rolled = rng.d(6) + 2; // roll:amount
          f.asleep = Math.max(f.asleep, rolled);
        }
      });
    } else if (sp.kind === "volley") {
      const n = rng.d(8); // roll:amount
      const foes = liveFoes(state);
      const shrugged = new Set(foes.filter((f) => foeResistsSpell(state, f, sp.n, rng, events, ally.name)));
      const struck = new Set();
      let tot = 0;
      for (let k = 0; k < n && foes.length; k++) {
        const f = foes[k % foes.length];
        if (!f.alive || shrugged.has(f)) continue;
        const first = !struck.has(f);
        struck.add(f);
        const d = rollDice(rng, sp.dmg) + strengthRoll(view, rng) + (first ? levelSq : 0);
        const hit = damageFoe(state, f, d, bySource, rng, events);
        tot += hit.applied;
        if (f.wp <= 0) killFoe(state, f, rng, events);
      }
      events.push({ type: "volley", rolls: n, totalDamage: tot });
    } else if (sp.kind === "turn") {
      // Walking Dead of the Joiner's level or lower, each on its own resist. The hero's
      // fixation (survivors swing only at the caster) is a hero-only targeting rule in
      // pickFoeTarget, so a Joiner's song never sets it: it never aims the dead at the hero.
      if (state.combat && state.combat.type === "Walking Dead") {
        const turned = liveFoes(state)
          .filter((f) => f.lvl <= view.level)
          .filter((f) => !foeResistsSpell(state, f, sp.n, rng, events, ally.name));
        turned.forEach((f) => {
          f.alive = false;
          f.turned = true;
          f.wp = 0;
        });
        events.push({ type: "walkingDeadTurned", count: turned.length });
      } else {
        events.push({ type: "nothingToTurn" });
      }
    } else if (state.combat && (state.combat.type === "Walking Dead" || state.combat.type === "Demons")) {
      // gate: d6 foes, each on its own resist
      const gone = liveFoes(state)
        .slice(0, rng.d(6)) // roll:amount
        .filter((f) => !foeResistsSpell(state, f, sp.n, rng, events, ally.name));
      gone.forEach((f) => {
        f.alive = false;
        f.turned = true;
        f.wp = 0;
      });
      events.push({ type: "planeGated", count: gone.length });
    } else {
      events.push({ type: "gateRefused" });
    }
    return;
  }
  // blast / status / stun / weaken — the only other ATTACK_SPELL_KINDS.
  events.push({ type: "allyCast", ...base });
  // Phase 90 plan 05 (SPELL-11, SPELL-12): the Joiner's Ice, Doze and Stun are
  // the hero's rules through the same shared tails (iceStorm, dozeFoes,
  // stunFoe), the Joiner's name on every line. Ice has no up-front resist (each
  // survivor rolls it after its damage, inside the tail); Doze rolls one per
  // reached foe inside its tail; Stun rolls the target's one resist here.
  const caster = { by: ally.name, sheet: view, level: view.level, sub: view.sub };
  if (sp.kind === "blast") {
    iceStorm(state, sp, rng, events, caster);
    return;
  }
  if (sp.kind === "status") {
    dozeFoes(state, sp, rng, events, caster);
    return;
  }
  if (sp.kind === "stun") {
    if (foeResistsSpell(state, t, sp.n, rng, events, ally.name)) return;
    stunFoe(state, t, sp, rng, events, caster);
    return;
  }
  // Quick 260927-rsx: the foe's resist (a derived stream, and since Phase 90
  // plan 04 the one depth-rising resist, with no second control resist after
  // it) comes first, per targeted foe. A Weaken's d4+1 is drawn before its
  // room resists.
  if (sp.kind === "weaken") {
    // Phase 40 (SPELL-01): a member's own Weaken cast starts the SAME
    // `spell:weaken` rounds-cadence record, on the HERO's own `state.c`
    // (party-wide duration lives in one place) — its own d4+1 draw.
    const rounds = rng.d(4) + 1; // roll:amount
    // Quick 260927-rsx: every live foe rolls its own resist; since Phase 89
    // plan 08 that is the one depth-rising resist and the old extra room
    // roll past floor 12 is gone — see roomWeakenResists.
    if (!roomWeakenResists(state, sp.n, rng, events, ally.name)) return;
    const C = state.combat;
    if (C) {
      C.weakened = true;
      C.foeToHitPenalty = 3;
      startEffect(state.c, "spell:weaken", { rounds });
    }
    events.push({ type: "allySpellHit", ...base, effect: "weakened", rounds });
  }
}

/**
 * allyThrow(state, ally, view, sp, t, rng, events) — a Joiner's `thrown` spell
 * at ONE foe `t` (Freeze, Fireball, Mangle, and each foe of Lightning): the
 * foe's resist, the to-hit die, then (on a hit) the damage dice, in the hero's
 * order. Split out of allyCast (Phase 90 plan 10) so the area spell can call it
 * per foe; byte-identical draws and events for a one-foe throw.
 */
function allyThrow(state, ally, view, sp, t, rng, events) {
  const base = { name: ally.name, spell: sp.n, target: t.name };
  {
    // Phase 40 (SPELL-01): the THIRD name-keyed Freeze check (a member cast)
    // — repointed to the data flag alongside magic.js's own two sites
    // (research Pitfall 2).
    const freeze = sp.onHit === "freeze";
    // Quick 260927-rsx (user ruling 2026-09-27): the target rolls its intel
    // resist before the throw; a resisted spell does nothing to it (no
    // to-hit, no damage draw) and the charge is still spent. User ruling
    // 2026-09-28: a Freeze is the exception — it rolls the resist only after
    // a hit's damage lands, and a resist stops just the freeze (freezeFoe).
    if (!freeze && foeResistsSpell(state, t, sp.n, rng, events, ally.name)) return;
    const dieN = freeze ? 10 : 8;
    // Phase 73 (ROLL-05): `need` -> `faces`; the school and throw bonuses
    // fold into the threshold the same way every other per-target term does
    // — `atLeastFor(faces + bonus, dieN)` is byte-identical to the old
    // `roll - bonus <= need`.
    const faces = freeze ? 6 : 4;
    const schoolMod = schoolBonus(view.sub, sp.s);
    const throwMod = eff(view, "throw");
    const bonus = schoolMod + throwMod;
    const mods = [
      ...(schoolMod ? [{ name: "school", delta: schoolMod }] : []),
      ...(throwMod ? [{ name: "throw", delta: throwMod }] : []),
    ];
    const check = rollCheck(rng, dieN, atLeastFor(faces + bonus, dieN));
    const roll = check.roll;
    events.push({ type: "allyCast", ...base, ...rollFields(check), ...(mods.length ? { mods } : {}) });
    if (check.ok) {
      // Phase 72 (ROLL-01 (c)): a landed member thrown attack spell on its
      // die's best face shatters a shatter-flagged foe (the Skeleton)
      // outright — skip the spell-damage roll.
      if (shatterIfBest(state, t, roll, dieN, ally.name, rng, events, { spell: sp.n })) return;
      // Quick 260928-sq2 (user ruling 2026-09-28): the dice + the JOINER's
      // own level² (view.level is ally.lvl), replacing × max(1, level −
      // spell level) — the hero's rule. No new draw.
      // Phase 91 (IDENT-17, plan 91-07): a live Strength on the Joiner's own sheet
      // (a sung Strength) adds its d10 to this roll, as the hero's thrown spell
      // does; 0, and no draw, for any Joiner without one.
      const dmg = rollDice(rng, sp.dmg) + strengthRoll(view, rng) + spellLevelSq(view) + eff(view, "spellDmg");
      const hit = damageFoe(state, t, dmg, { kind: "spell", school: sp.kind, casterSub: view.sub }, rng, events);
      if (freeze) {
        // User rulings 2026-09-28: "freeze should never kill outright. It
        // should deal its damage and freeze an enemy for 1d4 rounds." — and
        // "if it hits and resists, deal damage, but no freeze." The damage
        // lands (above); a blow that drops the target to 0 hp is a normal
        // kill. A survivor rolls its intel resist, then the RULES-18 control
        // resist past the knee, then freezes for d4 rounds (freezeFoe) — the
        // same tail as the hero's cast. No frozen-solid kill at any depth.
        events.push({ type: "allySpellHit", ...base, effect: "damage", dmg: hit.applied });
        if (t.wp <= 0) {
          killFoe(state, t, rng, events);
          return;
        }
        freezeFoe(state, t, sp.n, rng, events, { by: ally.name, dmg: hit.applied });
        return;
      }
      events.push({ type: "allySpellHit", ...base, effect: "damage", dmg: hit.applied });
      if (t.wp <= 0) killFoe(state, t, rng, events);
    } else {
      events.push({ type: "allySpellMissed", ...base, resisted: false });
    }
    return;
  }
}

/**
 * downMember(state, member, events) — a party member reaches 0 wp (PARTY-05).
 * It is pulled from the combat roster (`C.allies`) so no foe/ally targets it
 * again, and flagged `status:"downed"` on the persistent `state.party` so
 * endCombat drops it from the run. It emits a `memberDowned` event and — the
 * critical fork — NEVER calls die() (that terminator ends the HERO's run); a
 * companion falling must not end the run.
 *
 * Exported for engine/foeAbilities.js's member-targeted bolt/drain (D-13),
 * exactly as pickFoeTarget/applyFoeDamageToPlayer were exported in Phase 17.
 */
export function downMember(state, member, events) {
  member.wp = 0;
  const C = state.combat;
  if (C && Array.isArray(C.allies)) {
    const ci = C.allies.indexOf(member);
    if (ci >= 0) C.allies.splice(ci, 1);
  }
  if (typeof member.partyIdx === "number" && Array.isArray(state.party) && state.party[member.partyIdx]) {
    state.party[member.partyIdx].status = "downed";
  }
  events.push({ type: "memberDowned", name: member.name });
}

/**
 * pickFoeTarget(state, rng) — chooses which live combatant a foe's swing
 * targets: `null` means the hero, a `C.allies` member object means that party
 * member. Pure extraction of the former inline block at the top of foeTurn's
 * swing loop (formerly foeTurn lines 860-865, Phase 8 PARTY-04/05) — no
 * behavior change.
 *
 * DETERMINISM GATE (unchanged from the inline version this replaces): the
 * `rng.d(pool)` roll is drawn ONLY when at least one live party member
 * exists. An absent `C.allies` key, an empty `allies` array, or an allies
 * array whose members are all at wp<=0 all yield an empty pool — this
 * function returns `null` immediately WITHOUT touching `rng`, byte-identical
 * to every solo/empty-party parity fixture today. Only when at least one
 * live member exists is the single `rng.d(liveMembers.length + 1)` draw
 * taken (result 1 => hero, 2..N+1 => that live member, in `C.allies` order).
 *
 * Phase 19's foe-ability resolver (`engine/foeAbilities.js`) reuses this
 * helper so `bolt`/`drain`-style abilities target the same pool as a melee
 * swing.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): "creatures too
 * stupid to know better come for you first" — a Bard's party bad. Added a
 * third, OPTIONAL `foe` argument (only foeTurn's melee swing passes it;
 * engine/foeAbilities.js's bolt/drain call stays two-argument and unchanged
 * — an ability-casting foe is not "too stupid to know better"). Any zero-
 * draw reinterpretation that merely BIASES the (n+1)-sided pick toward the
 * hero would have to take a slot from one specific member (asymmetric); the
 * only symmetric zero-draw design is "the dumb creature goes for the Bard
 * outright" when a live party stands beside them — so an intel<=3 foe
 * targets the Bard unconditionally instead of drawing normally. The pool/
 * draw code above this line is byte-identical, and `pick` is still consumed
 * (the party-mode rng stream is unchanged) even when this clause overrides
 * its result.
 */
export function pickFoeTarget(state, rng, foe = null) {
  const C = state.combat;
  if (!C) return null;
  const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
  if (!liveMembers.length) return null;
  // Phase 38 (ABIL-01, Taunt) — "every foe swings at you this round": while
  // active, a member is never picked — no target die is drawn at all (0
  // draws), matching FID-02's own zero-draw structural-guard precedent.
  // False on every fixture (only useAbility's "taunt" case ever starts this
  // timer).
  if (abilityEffectActive(state.c, "taunt")) return null;
  // Phase 38 (ABIL-05) — a member's OWN Taunt makes every foe swing at THAT
  // member this round, zero draws, checked before the pool die (mirrors the
  // hero's own Taunt bypass immediately above). False on every fixture (only
  // resolveMemberAbility's "taunt" case ever starts this timer on a member's
  // own sheet).
  const taunter = liveMembers.find((m) => {
    const s = state.party?.[m.partyIdx];
    return s && abilityEffectActive(s, "taunt");
  });
  // Phase 90 plan 10 (SPELL-08, Q9 B, user 2026-09-30, canon against the
  // recommended default; rulebook p.30 Turn Walking Dead): a Walking Dead the
  // spell failed to turn is FIXATED (`foe.fixated`) and swings only at the
  // caster, the hero, for the rest of the fight: a Joiner is never picked while
  // one lives, not even by its own Taunt. The draws are exactly as before (no
  // draw under a Taunt, the pick die otherwise), so the party-mode rng stream
  // does not move; only the result is overridden, as the Bard clause below does.
  const fixated = !!(foe && foe.fixated);
  if (taunter) return fixated ? null : taunter;
  const pick = rng.d(liveMembers.length + 1); // roll:selection
  if (fixated) return null;
  if (foe && foe.intel <= 3 && state.c?.sub === "Bard") return null;
  return pick > 1 ? liveMembers[pick - 2] : null;
}

/**
 * applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, atLeast, dieN,
 * mods }) — the hero-damage pipeline a landed foe swing runs through.
 * RULES-14 (Phase 75): an armed Bubble mirror is checked FIRST, ahead of
 * everything below — see the mirror early-return at the top of this
 * function's body. From there onward: Hardiness reduction, the Pendant of
 * Fortitude's single-charge `c.halfNext` halving, ward absorb/shatter (the
 * OLD reflect-the-soaked-share path is gone — a mirror-reflected blow can
 * still kill the FOE instead of the hero, but that now happens only via the
 * top-of-function mirror branch), armor soak (a roll-high check against
 * `soakAr`'s top faces via `armorSoak(c)`, gated on worn/effective armour),
 * the `struckByFoe` event, and `die()` on lethal.
 * Verbatim port of foeTurn's former hero-damage branch (formerly
 * lines 904-981) — the to-hit roll, raw damage computation, weakened
 * halving, and critical doubling stay inline in foeTurn and are passed in
 * via `{ dmg, roll, atLeast, dieN, mods }` (Phase 73, ROLL-05: `need`/
 * `needMods` -> `atLeast`+`dieN`/`mods`; the caller's own `roll` is already
 * the mirrored, high-is-good face).
 *
 * Returns `{ died, onArmour }`:
 *   - `died: true` fires ONLY on the `c.wp <= 0` branch, after `die()` has
 *     already run (which sets `state.combat = null`) — the caller MUST
 *     `return events` immediately as the very next statement, exactly
 *     matching today's early-return-on-death control flow (it must not read
 *     `state.combat`/`C` again on this path).
 *   - A ward-reflect kill of the FOE (not the hero) returns
 *     `{ died: false, onArmour: false }` so `foeTurn`'s swing loop continues
 *     to the next swing/foe and still runs the end-of-turn ward/mirror tick
 *     — `died` is never set on this branch.
 *   - `onArmour: true` is informational for callers (e.g. Phase 19
 *     narration); `foeTurn` only branches on `died`, since every other
 *     outcome already falls through to the next swing.
 *
 * Gated draws: the `rng.d(20)` armor-soak roll is drawn ONLY when
 * `av.wp > 0 && av.ar > 0 && !ignores`; `killFoe`/`die` draw only on their
 * own branches (a ward-reflect kill, or the lethal hero-death path). The
 * simplified member-damage branch (`foeTurn`'s `if (member) { ... }` block,
 * no ward/armor/Hardiness/die) is deliberately NOT routed through this
 * helper — that asymmetry is intentional (Phase 17 CONTEXT.md), not an
 * oversight.
 *
 * Phase 19 (D-02/D-18) additive options — existing callers pass neither and
 * read neither:
 *   - `ignoresArmor` (boolean|undefined): an explicit `true`/`false`
 *     overrides the foe's own `sp.noArmor` flag; `undefined` keeps today's
 *     behaviour of reading `foe.sp.noArmor`.
 *   - `ability` (string|undefined): when set, the landed event is
 *     `foeBolted { name, ability, dmg, ignoresArmor }` instead of
 *     `struckByFoe` (a foe-ability bolt has no to-hit roll, so there is no
 *     `roll`/`need` to narrate — RESEARCH Pitfall 2).
 *   - `critWarded` (boolean|undefined, quick 260928-cos): the caller's
 *     wardCrit turned this blow's rolled crit into an ordinary hit (a live
 *     Cloak of Strength); `struckByFoe` then carries `critical: false`, no
 *     soldierCrit/critAtLeast, and `critWarded: true`. `dmg` already arrives
 *     undoubled.
 *   - `applied` (additive return field, on EVERY branch): the amount
 *     actually subtracted from `c.wp` this call (0 on every early-return
 *     branch — reflect-kill, `dmg <= 0`, armor-soaked — and the final landed
 *     `dmg` on both tail returns).
 */
export function applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, atLeast, dieN, mods, ignoresArmor, ability, critWarded }) {
  const c = state.c;
  const R = RACES[c.race];

  // RULES-14 (Phase 75, user 2026-09-25): Bubble's one-shot mirror sits
  // ahead of EVERYTHING else in this pipeline — Hardiness, the Fridgian
  // hide, the Pendant of Fortitude's halfNext, and Brace — so the full blow
  // reflects and no single-charge buffer is spent on a mirrored blow. An
  // armed mirror (`c.ward.mirror`) reflects the WHOLE incoming `dmg` at the
  // attacker through the one damageFoe seam (`kind: "reflect"`), the caster
  // takes none of it, then the ward pops into a plain `popPool`-hp pool for
  // the rest of THIS round only (`rounds: 1` — the foeTurn tail tick below
  // always fades it at the end of the same foe turn it popped in). A reflect
  // that kills the attacker still runs killFoe and the swing loop continues
  // to the next foe, exactly like the old reflect-kill contract.
  if (c.ward && c.ward.mirror && dmg > 0) {
    const bounce = damageFoe(state, foe, dmg, { kind: "reflect", crit: false }, rng, events);
    if (!bounce.soaked) events.push({ type: "wardReflected", target: foe.name, amount: bounce.applied, mirror: true });
    c.ward = { name: c.ward.name, pool: c.ward.popPool, rounds: 1 };
    if (foe.wp <= 0) {
      killFoe(state, foe, rng, events);
    }
    return { died: false, onArmour: false, applied: 0 };
  }

  // Phase 25 (FEED-01, additive payload): what passive soak actually reduced
  // this blow — only the keys that fired, each the integer amount removed.
  // Narration-only bookkeeping; every reduction below was already computed
  // by the existing arithmetic, this just records the delta.
  const soaked = {};
  if (skill(c, "Hardiness")) {
    const before = dmg;
    dmg = Math.max(1, dmg - 3);
    if (before - dmg > 0) soaked.hardiness = before - dmg;
  }
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, race pass / IDENT-09): a
  // Fridgian's hide soaks 2 flat from every blow that reaches this pipeline
  // (foe swing, pursuit strike, foe ability bolt), stacking with Hardiness's
  // -3 above and flooring at 1 exactly like Hardiness — content/races.js
  // `hide` flag, zero rng draws.
  if (R.hide) {
    const before = dmg;
    dmg = Math.max(1, dmg - R.hide);
    if (before - dmg > 0) soaked.hide = before - dmg;
  }

  // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Pendant of
  // Fortitude (content/treasure-tables.js, use:"half") sets `c.halfNext`
  // (items.js:"half" case) but the flag was READ NOWHERE. Wired here: it
  // halves ONE incoming landed blow (this hero-damage branch only runs on a
  // successful foe hit), then clears — a single-charge damage buffer. Pure
  // (no rng): `c.halfNext` is only ever set by USING the Pendant, so it is
  // falsy on every parity fixture and this block never runs for them.
  if (c.halfNext) {
    dmg = Math.ceil(dmg / 2);
    c.halfNext = false;
    events.push({ type: "damageHalved", name: foe.name });
  }

  // Phase 38 (ABIL-01, Brace) — "halve the next blow that lands on you": a
  // single-charge buffer, consumed by the first landed blow that reaches
  // this pipeline (foe swing, pursuit strike, foe ability bolt), then
  // clears — mirrors the Pendant of Fortitude's c.halfNext pattern exactly.
  // Pure (no rng); false on every fixture (only useAbility's "brace" case
  // ever sets it).
  // Phase 91.1 plan 02 (V8 B): Brace now halves the next TWO blows that land
  // (BRACE_BLOWS): `braced` is the number of blows left, a flag saved as true by
  // an older build reads as one.
  if (state.combat && state.combat.braced && dmg > 0) {
    const before = dmg;
    dmg = Math.ceil(dmg / 2);
    const left = Math.max(0, Number(state.combat.braced) - 1);
    state.combat.braced = left > 0 ? left : false;
    soaked.brace = before - dmg;
    events.push({ type: "braceHeld", name: foe.name, soaked: before - dmg, left });
  }

  // a ward eats the blow before armour or flesh does. RULES-14 (Phase 75):
  // the old "reflect the ward's soaked SHARE" branch here is deleted
  // outright (greenfield) — reflection is now the mirror-only early return
  // above; this block is left handling exactly what Shield (and a popped
  // Bubble pool) have always done: absorb, then shatter.
  let warded = 0;
  if (c.ward && c.ward.pool > 0) {
    warded = Math.min(c.ward.pool, dmg);
    c.ward.pool -= warded;
    dmg -= warded;
    // Phase 25 (FEED-01, additive payload): the ward's share of this blow.
    if (warded > 0) soaked.ward = warded;
    if (warded > 0) events.push({ type: "wardAbsorbed", amount: warded, remaining: c.ward.pool });
    if (c.ward.pool <= 0) {
      events.push({ type: "wardShattered" });
      c.ward = null;
    }
  }
  if (dmg <= 0) return { died: false, onArmour: false, applied: 0 };

  // p.44: roll d20 — at or above the mirrored AR threshold (atLeastFor
  // (soakAr, 20), Phase 73 ROLL-05) the blow lands on the armour instead
  // of you.
  let onArmour = false;
  let blocked = 0;
  let wear = 0;
  // Phase 28 (ARMOR-05, additive payload): true when the blow was soaked but
  // at/under the armour's min (no wear charged) — a distinct outcome from a
  // magic-plate soak, which also produces wear: 0 but for a different
  // reason (av.magic below). Flags only, set from the SAME condition the
  // wear-charge branch already tests — see the armorSoaked push below.
  let underMin = false;
  // Phase 19 (D-18): an explicit true/false override wins over the foe's own
  // flag; `undefined` keeps today's behaviour exactly (reads foe.sp.noArmor).
  const ignores = ignoresArmor ?? (foe.sp && foe.sp.noArmor);
  // E8: read EFFECTIVE armour (worn armour, or PLATE when the Cloak of
  // Armor is carried — see engine/derived.js armorSoak). For any character
  // WITHOUT the cloak av === the worn c.ar/c.armorWP/c.armorMin values, so
  // the soak roll fires exactly as before (no new rng draw). A cloak-bearer
  // soaks as plate; the magical plate never wears out (av.magic), so no
  // worn-armour durability is consumed and armorDestroyed never fires.
  const av = armorSoak(c);
  // Phase 38 (ABIL-01, Taunt) — "your armour soaks double" while active; the
  // av.ar > 0 GATE below is unchanged (Taunt cannot grant armour to a
  // character with none) — only the soak roll's target number doubles,
  // capped at 20 (a d20's own ceiling). Identity (soakAr === av.ar) on every
  // fixture.
  const soakAr = abilityEffectActive(c, "taunt") ? Math.min(20, av.ar * 2) : av.ar;
  // Phase 73 (ROLL-05): the soak die reads roll-high through rollCheck; the
  // gate and soakAr's Taunt doubling above are unchanged, so the draw fires
  // in exactly the same position for exactly the same characters. `soakCheck`
  // stays null when the draw is skipped, and carries the failed check when
  // the blow gets through (struckByFoe narrates it via `soak` below).
  let soakCheck = null;
  if (av.wp > 0 && av.ar > 0 && !ignores) {
    soakCheck = rollCheck(rng, 20, atLeastFor(soakAr, 20));
    if (soakCheck.ok) {
      onArmour = true;
      blocked = dmg;
      // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, race pass / IDENT-09):
      // a Dwarf's armour is built to be hit — it wears at half the rate. A
      // soaked blow charges only Math.ceil(dmg * armorWear) durability
      // instead of the full dmg (content/races.js `armorWear` flag); every
      // other race's expression is value-identical to before (dmg * 1,
      // unrounded by Math.ceil on an already-integer dmg).
      if (!av.magic && dmg > av.min) {
        // Phase 25 (FEED-01, additive payload): `wear` is the durability
        // ACTUALLY subtracted this blow (never more than what remained),
        // narrating what today's Math.max(0, ...) expression already does —
        // that expression itself is untouched below.
        const rawWear = R.armorWear ? Math.ceil(dmg * R.armorWear) : dmg;
        wear = Math.min(c.armorWP, rawWear);
        c.armorWP = Math.max(0, c.armorWP - rawWear);
      } else if (!av.magic) underMin = true;
      dmg = 0;
      if (!av.magic && c.armorWP <= 0) events.push({ type: "armorDestroyed" });
    }
  }
  if (onArmour) {
    // Phase 28 (ARMOR-05, additive payload): `underMin` = soaked but the
    // blow was at/under the armour's min (no wear); `magic` = the Cloak of
    // Armor's plate took it (never wears). Flags only — the soak/wear
    // expressions above are byte-identical to before.
    events.push({
      type: "armorSoaked",
      name: foe.name,
      amount: blocked,
      wear,
      ...(R.armorWear && wear > 0 ? { halved: true } : {}),
      ...(underMin ? { underMin: true } : {}),
      ...(av.magic ? { magic: true } : {}),
      // Phase 73 (ROLL-05): the soak die's own triple — additive, narration
      // only.
      ...rollFields(soakCheck),
    });
    return { died: false, onArmour: true, applied: 0 };
  }
  c.wp -= dmg;
  if (ability) {
    // Phase 19 (D-02/D-18): a foe-ability bolt has no to-hit roll, so it
    // narrates as foeBolted instead of struckByFoe (never both).
    events.push({
      type: "foeBolted",
      name: foe.name,
      ability,
      dmg,
      ignoresArmor: !!ignores,
      ...(Object.keys(soaked).length ? { soaked } : {}),
    });
  } else {
    // Phase 73 (ROLL-05): the mirrored crit rule — `critical` is the top
    // face for ANY foe (byte-identical to the old `roll === 1`); a Soldier's
    // second-highest face is its own `soldierCrit`, byte-identical to the
    // old `roll === 2 && Soldier`. `critAtLeast` (the top-face threshold this
    // foe needed) is only narrated when one of the two fired.
    // Quick 260928-cos: a crit the caller's wardCrit turned aside (a live
    // Cloak of Strength) is an ordinary hit — neither flag fires, and the
    // line carries `critWarded: true` instead (additive; absent otherwise).
    // Phase 90 plan 04 (SPELL-12): a blind foe never crits, so its top-face hit
    // is an ordinary hit on the line too (the damage was never doubled).
    const critical = !critWarded && !foe.blind && isBestFace(roll, dieN);
    const soldierCrit = !critWarded && !foe.blind && roll === dieN - 1 && c.sub === "Soldier";
    events.push({
      type: "struckByFoe",
      name: foe.name,
      roll,
      atLeast,
      dieN,
      dmg,
      ignoresArmor: !!ignores,
      critical,
      // Phase 25 (FEED-01, additive payload): conditional trailing fields —
      // absent for a plain hero, so the pinned key order/shape above never
      // moves for the parity/combat.test.js fixtures.
      ...(Object.keys(soaked).length ? { soaked } : {}),
      // Phase 73 (ROLL-05): the failed soak die's own triple, when one was
      // drawn — absent when armour never rolled (no armour, or ignoresArmor).
      ...(soakCheck ? { soak: rollFields(soakCheck) } : {}),
      ...(mods && mods.length ? { mods } : {}),
      ...(critical || soldierCrit ? { critAtLeast: atLeastFor(c.sub === "Soldier" ? 2 : 1, dieN) } : {}),
      ...(soldierCrit ? { soldierCrit: true } : {}),
      ...(critWarded ? { critWarded: true } : {}),
    });
  }
  if (c.wp <= 0) {
    die(state, "combat", foe.name, rng, events);
    return { died: true, onArmour: false, applied: dmg };
  }
  return { died: false, onArmour: false, applied: dmg };
}

/**
 * applyFoeDamageToMember(state, foe, member, rng, events, { dmg, roll,
 * atLeast, dieN, mods, critical, critAtLeast, critWarded, ignoresArmor,
 * ability, swing }) — Phase 89 plan 04 (ITEM-07, user 2026-09-30: "let their
 * armor soak damage. Just like players."): the Joiner's twin of
 * applyFoeDamageToPlayer, so a Joiner has ONE damage pipeline the way the
 * hero does. It serves foeTurn's member branch (a landed swing) and
 * engine/foeAbilities.js's member bolt/drain.
 *
 * It mirrors the hero's order after the to-hit and the damage roll (the
 * round-damage ceiling stays with the caller, before this, exactly as the
 * hero's): the Joiner's OWN armed Pendant of Fortitude (`sheet.halfNext`)
 * halves the blow (`damageHalved`), its Brace (`member.braced`) halves it
 * again (`braceHeld`), then its OWN armour soaks it: a d20 against
 * `armorSoak(sheet)` (the Cloak of Armor's plate and the Fighter armour
 * multiplier included, doubled to a cap of 20 under the Joiner's own Taunt)
 * soaks the whole blow at or above the threshold, wearing the Joiner's
 * `sheet.armorWP` by the blow (half for a Dwarven Joiner, none at or under
 * the armour's min, none for the Cloak's plate); armour worn to 0 is
 * destroyed (`armorDestroyed`). A drain, a no-armour foe and a blow
 * `ignoresArmor` draw no soak die at all, and neither does a Joiner with no
 * armour (AR 0, 0 durability, a Fridgian).
 *
 * The soak die comes from a DERIVED stream keyed on the run's cursor, the
 * round, the foe's index, the swing and the Joiner's party index, so the
 * main stream never moves (a solo fight draws exactly what it drew before).
 *
 * Since Phase 91 plan 09 (IDENT-20, Q7 A) the Fridgian hide IS part of it
 * (-2 per landed blow, floor 1, right after Hardiness). Since Phase 90 plan 10
 * (Q10 A) Hardiness is part of it: -3 per landed blow, floor 1, ahead of the Pendant.
 * Since Phase 91 plan 07 (IDENT-17) a Joiner's own sung ward is too: an armed
 * Bubble mirror (`member.ward.mirror`) reflects the whole blow first, a Shield
 * pool (`member.ward.pool`) eats what is left after the Pendant and Brace, both
 * with the Joiner's name in `member` on their events. A missing sheet reads as a blank
 * body (no Pendant, no armour).
 *
 * Events carry the Joiner's name in `member` (additive), so the Oracle and
 * rail lines can name it. An unsoaked blow pushes `memberStruck` (or
 * `foeBolted` for `ability`), carrying `soak` (the failed die) when one was
 * drawn; a Joiner at 0 HP is downed via downMember (never die()).
 *
 * Returns `{ downed, soaked, applied }`: `applied` is the hp actually taken
 * (0 when soaked).
 */
export function applyFoeDamageToMember(state, foe, member, rng, events, { dmg, roll, atLeast, dieN, mods, critical, critAtLeast, critWarded, ignoresArmor, ability, swing }) {
  const C = state.combat;
  const sheet = Array.isArray(state.party) ? state.party[member.partyIdx] : null;
  const body = sheet || {};

  // Phase 91 plan 07 (IDENT-17): a Joiner Bard's sung Bubble (`member.ward.mirror`) sits
  // ahead of EVERYTHING else in this pipeline, as the hero's does (RULES-14): the whole
  // blow goes back at the attacker, the Joiner takes none of it, no single-charge buffer
  // is spent, and the ward pops into a plain film for the rest of THIS round (rounds: 1,
  // faded by foeTurn's tail). A reflect that kills the attacker runs killFoe.
  if (member.ward && member.ward.mirror && dmg > 0) {
    const bounce = damageFoe(state, foe, dmg, { kind: "reflect", crit: false }, rng, events);
    if (!bounce.soaked) events.push({ type: "wardReflected", target: foe.name, amount: bounce.applied, mirror: true, member: member.name });
    member.ward = { name: member.ward.name, pool: member.ward.popPool, rounds: 1 };
    if (foe.wp <= 0) killFoe(state, foe, rng, events);
    return { downed: false, soaked: true, applied: 0 };
  }

  // Phase 90 plan 10 (ABIL-06, Q10 A, user 2026-09-30: "Joiners use ...
  // Hardiness ... as the text describes"): a Joiner with Hardiness takes 3 less
  // from every landed blow that reaches this pipeline (a swing or a foe
  // ability's bolt), floor 1, BEFORE its Pendant and Brace, the hero's order
  // (applyFoeDamageToPlayer). A zero-damage blow (the round ceiling spent) stays
  // zero. Pure, no draw.
  if (sheet && dmg > 0 && skill(sheet, "Hardiness")) dmg = Math.max(1, dmg - 3);
  // Phase 91 plan 09 (IDENT-20, Q7 A, user 2026-09-30: a Joiner's own race
  // traits that protect its body apply like the hero's; Phase 89's hand-off
  // "a Joiner gets no Hardiness or Fridgian hide soak"): a Fridgian Joiner's
  // thick hide soaks `RACES.Fridgian.hide` (2) from every landed blow that
  // reaches this pipeline, floor 1, right after Hardiness and before the
  // Pendant and Brace, exactly where applyFoeDamageToPlayer reads the hero's.
  // A race with no `hide` soaks nothing extra. A zero-damage blow (the round
  // ceiling spent) stays zero. Pure, no draw.
  const joinerHide = sheet ? (RACES[sheet.race] || {}).hide : 0;
  if (joinerHide && dmg > 0) dmg = Math.max(1, dmg - joinerHide);

  // The Joiner's own armed Pendant of Fortitude: one landed blow, halved.
  if (body.halfNext && dmg > 0) {
    dmg = Math.ceil(dmg / 2);
    body.halfNext = false;
    events.push({ type: "damageHalved", name: foe.name, member: member.name });
  }

  // The Joiner's own Brace: halves the next blow after the Pendant, as the hero's.
  if (member.braced && dmg > 0) {
    const before = dmg;
    dmg = Math.ceil(dmg / 2);
    const left = Math.max(0, Number(member.braced) - 1);
    member.braced = left > 0 ? left : false;
    events.push({ type: "braceHeld", name: foe.name, member: member.name, soaked: before - dmg, left });
  }

  // Phase 91 plan 07 (IDENT-17): a Joiner's own Shield (a Bard's sung ward) eats the blow
  // after the Pendant and Brace and before its armour, where the hero's ward sits
  // (applyFoeDamageToPlayer): absorb, then shatter when the pool is spent.
  if (member.ward && member.ward.pool > 0 && dmg > 0) {
    const warded = Math.min(member.ward.pool, dmg);
    member.ward.pool -= warded;
    dmg -= warded;
    events.push({ type: "wardAbsorbed", amount: warded, remaining: member.ward.pool, member: member.name });
    if (member.ward.pool <= 0) {
      events.push({ type: "wardShattered", member: member.name });
      member.ward = null;
    }
    if (dmg <= 0) return { downed: false, soaked: true, applied: 0 };
  }

  const ignores = ignoresArmor ?? !!(foe.sp && foe.sp.noArmor);
  let soakCheck = null;
  if (sheet && dmg > 0) {
    const av = armorSoak(sheet);
    const soakAr = abilityEffectActive(sheet, "taunt") ? Math.min(20, av.ar * 2) : av.ar;
    if (av.wp > 0 && av.ar > 0 && !ignores) {
      const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
      const foeIdx = C && Array.isArray(C.foes) ? C.foes.indexOf(foe) : -1;
      soakCheck = rollCheck(
        derivedRng(cursor, "memberSoak", C ? C.round : 0, foeIdx, swing ?? -1, member.partyIdx),
        20,
        atLeastFor(soakAr, 20),
      );
      if (soakCheck.ok) {
        const R = RACES[sheet.race] || {};
        let wear = 0;
        let underMin = false;
        if (!av.magic && dmg > av.min) {
          const rawWear = R.armorWear ? Math.ceil(dmg * R.armorWear) : dmg;
          wear = Math.min(sheet.armorWP, rawWear);
          sheet.armorWP = Math.max(0, sheet.armorWP - rawWear);
        } else if (!av.magic) underMin = true;
        events.push({
          type: "armorSoaked",
          name: foe.name,
          member: member.name,
          amount: dmg,
          wear,
          ...(R.armorWear && wear > 0 ? { halved: true } : {}),
          ...(underMin ? { underMin: true } : {}),
          ...(av.magic ? { magic: true } : {}),
          ...rollFields(soakCheck),
        });
        if (!av.magic && sheet.armorWP <= 0) events.push({ type: "armorDestroyed", member: member.name });
        return { downed: false, soaked: true, applied: 0 };
      }
    }
  }

  member.wp -= dmg;
  if (ability) {
    events.push({
      type: "foeBolted",
      name: foe.name,
      ability,
      dmg,
      ignoresArmor: !!ignores,
      member: member.name,
      ...(soakCheck ? { soak: rollFields(soakCheck) } : {}),
    });
  } else {
    events.push({
      type: "memberStruck",
      name: foe.name,
      member: member.name,
      dmg,
      roll,
      atLeast,
      dieN,
      critical: !!critical,
      ...(critical ? { critAtLeast } : {}),
      ...(soakCheck ? { soak: rollFields(soakCheck) } : {}),
      ...(mods && mods.length ? { mods } : {}),
      ...(critWarded ? { critWarded: true } : {}),
    });
  }
  const downed = member.wp <= 0;
  if (downed) downMember(state, member, events);
  return { downed, soaked: false, applied: dmg };
}

/**
 * HERO_OUT_MAX — RULES-10 (Phase 75.1, user ruling 2026-09-25, second
 * ruling): every turn-loss scroll fumble (Doze, Stun, Stupidity, Insane, and
 * Noxious Vapor's sleep) lasts AT MOST this many hero turns — a deliberate,
 * scroll-fumble-only exception to Phase 31's "penalties, never a no-actions
 * state" ruling. `loseTurn` below clamps `C.heroOut.left` into `[1,
 * HERO_OUT_MAX]` on every call, so a tampered or miscomputed value can never
 * outlast the fight.
 */
export const HERO_OUT_MAX = 4;

/**
 * fumbleHeavyBlow(state, spell, how, rng, events, now) — RULES-10 (Phase
 * 75.1, user ruling 2026-09-25): "no scroll fumble kills outright." The ONE
 * replacement for every instant-kill fumble effect (Death, Petrify, Freeze's
 * frozen-solid payoff, Noxious Vapor's kill-on-a-face) — a heavy, UNSOAKED
 * blow (a d10 from its own derived stream, plus the current floor's depth —
 * never the main rng) plus the Afraid condition, raised to at least
 * AFRAID_ROUNDS (never lowered — a hero already more Afraid than this stays
 * that way). The blow bypasses armor, ward and Hardiness entirely (it never
 * touches applyFoeDamageToPlayer's pipeline above) and is real hp loss
 * through the normal death path — it CAN still kill an already-wounded
 * reader, but never on its own account: a hero with more than `10 +
 * state.floor.depth` hp always survives it, whatever the d10 shows.
 *
 * `how` names what actually happened for the event/narration (e.g.
 * "frozen") — the fumble table's own flavor, not a new mechanic per spell.
 * Returns `{ died }`, mirroring every other lethal-branch contract in this
 * module.
 */
export function fumbleHeavyBlow(state, spell, how, rng, events = [], now = Date.now) {
  const c = state.c;
  const C = state.combat;
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const blowRng = derivedRng(cursor, "fumbleBlow", state.acts || 0, (C && C.round) || 0);
  const amount = blowRng.d(10) + state.floor.depth; // roll:amount
  c.wp -= amount;
  if (C) C.afraid = Math.max(C.afraid || 0, AFRAID_ROUNDS);
  events.push({ type: "fumbleHeavyBlow", spell, how, amount, depth: state.floor.depth, afraid: C ? C.afraid : AFRAID_ROUNDS });
  if (c.wp <= 0) {
    die(state, "scrollFumble", spell, rng, events, now);
    return { died: true };
  }
  return { died: false };
}

/**
 * loseTurn(state, rng, events) — RULES-10 (Phase 75.1, user rulings
 * 2026-09-25): the ONE action a hero who cannot act (`C.heroOut`) may take.
 * Mirrors the rules a FOE's own asleep/stupid skip already follows: nothing
 * in the engine ever wakes a sleeping/stunned/stupid foe on a hit, so the
 * hero's own `heroOut` is likewise never shortened by a foe's swing — only
 * this action's own countdown ever clears it. Foes hit an out hero exactly
 * as they would an acting one (no easier-hit bonus) — see
 * derived.js#foeSwingVsHero/foeToHitVs, neither of which reads `heroOut` at
 * all.
 *
 * Without `C.heroOut` (in or out of combat), pushes `actionRefused { action:
 * "loseTurn", reason: "notOut" }` and returns, drawing and changing nothing.
 * Otherwise: clamps `left` into `[1, HERO_OUT_MAX]`, pushes `heroLostTurn`
 * naming the kind/spell and the turns left AFTER this one, spends the turn,
 * and — when `left` reaches 0 — clears `C.heroOut` and pushes `heroCameTo`.
 * Then runs `afterPlayerAction` exactly like every other player combat
 * action, so the summon, the party and the foes all still take their turns —
 * "the fight must stay resolvable" (75.1-CONTEXT) falls out of this call
 * being, in every way that matters, just another action that reaches
 * afterPlayerAction. Zero rng draws, whether refused or spent.
 */
export function loseTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.heroOut) {
    events.push({ type: "actionRefused", action: "loseTurn", reason: "notOut" });
    return events;
  }
  const { kind, spell } = C.heroOut;
  const left = clamp(C.heroOut.left, 1, HERO_OUT_MAX) - 1;
  if (left <= 0) {
    delete C.heroOut;
    events.push({ type: "heroLostTurn", kind, spell, left: 0 });
    events.push({ type: "heroCameTo", kind });
  } else {
    C.heroOut.left = left;
    events.push({ type: "heroLostTurn", kind, spell, left });
  }
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * tickBlindFor(f, events) — Phase 90 plan 10 (ABIL-06, docs/SKILL-AUDIT.md Dirty
 * Trick row, "fix engine"): the Dirty Trick's two-round blindness (`f.blindFor`,
 * set by abilities.js#applyDirtyTrick) counts down once per foe VISIT, at the
 * end of every visit a LIVE foe's turn takes, whatever the foe did with it:
 * swung, or lost it to a hold, a sleep, a stun, a misdirection, a cast ability
 * or an empty spell kit. (Before this, only a visit that reached its swings
 * counted, so a blinded foe that lost turns stayed blind longer than the two
 * rounds the text promises.) At 0 the foe sees again (`foeSightReturned`). A
 * spell-blinded foe has no `blindFor` and stays blind for the fight; a dead foe
 * counts nothing. Pure bookkeeping, zero rng.
 */
function tickBlindFor(f, events) {
  if (!f.alive || !f.blindFor) return;
  f.blindFor--;
  if (f.blindFor <= 0) {
    delete f.blindFor;
    f.blind = false;
    events.push({ type: "foeSightReturned", name: f.name });
  }
}

/**
 * foeTurn(state, rng, events) — every live foe's attack. Step order (Phase
 * 19 additions marked *NEW*, Phase 38 additions marked *ABIL*, Phase 40
 * additions marked *SPELL*): *NEW* a queued summon joins C.foes -> regen tick
 * -> per foe: acid-over-time tick, *ABIL* the f.dot tick (Poisoned Edge, the
 * acid template — *SPELL* shares the SAME record shape for Ice, plus its own
 * frozen/killFoe payoff when an ice dot's last tick leaves the foe standing),
 * alive check, sleep, *SPELL* the f.stupid skip (Stupidity — the asleep
 * template, no counter, lasts the fight), *ABIL* the f.stunned skip (Pommel
 * Strike, the same template), *NEW* fleesBelow check, *NEW* the ability gate
 * (cast or fall through to melee), the melee swings (per-swing foeDie vs
 * foeToHitVs with blind/weakened/*SPELL* shrunk/*ABIL* hamstrung overrides,
 * sp.dmg dice, criticals, *ABIL* a hero-branch miss's Riposte counter,
 * Hardiness reduction, *ABIL* Brace's single-charge halving, a ward's
 * absorb/reflect/shatter, *ABIL* Taunt's doubled armor-soak target, armor
 * soak, die() on wp<=0) -> *ABIL* the f.blindFor countdown (Dirty Trick) at
 * the end of each foe's own visit -> ward/mirror ticks -> *NEW* the
 * c.foeEffect tick -> *ABIL/SPELL* the engine/effects.js rounds tick (Phase
 * 36 ability cooldowns; Phase 40's `spell:weaken` record clears
 * C.weakened/C.foeToHitPenalty and narrates weakenFaded on its own
 * effect->null transition, off the SAME tick call). Ports
 * mazeworld.html foeTurn() (lines 2838-2903). Uses pickFoeTarget (*ABIL*:
 * Taunt bypasses it entirely, 0 draws) for target selection and
 * applyFoeDamageToPlayer (Hardiness onward, *ABIL*: Brace/Taunt) for the
 * hero-damage pipeline.
 */
export function foeTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C) return events;
  const c = state.c;
  // Phase 54 (BAND-02, USER RULING D): the ONE global curve for this round,
  // read once per foeTurn (0 draws) — foeHitFor's whole-hit scale at every
  // damage site below reads THIS curve, never a fresh difficultyCurve() call
  // per swing.
  const curve = difficultyCurve(state.floor.depth);
  // Phase 19 (D-09/A8): identity guard for the end-of-turn foeEffect tick —
  // captured BEFORE anything this turn could set/refresh it, so a debuff
  // applied THIS turn never ticks down on the same turn it landed.
  const foeEffectAtStart = c.foeEffect;
  // Phase 19 (FOE-04/D-12): a queued summon joins at the very top of the
  // NEXT foeTurn — before c.regen, before any foe acts — so it never acts
  // mid-loop the turn it was queued. 0 draws; the newcomer's identity was
  // already picked at queue time; absent on every fixture.
  if (C.pendingFoes && C.pendingFoes.length) {
    for (const p of C.pendingFoes) {
      C.foes.push(p.foe);
      events.push({ type: "foeSummoned", name: p.foe.name, by: p.by, pending: false });
    }
    C.pendingFoes = null;
  }
  // RULES-10 (Phase 75.1, foe-side Bubble rebound): a blow the hero's side
  // threw at a foe's armed mirror was caught and stored as `f.rebound`
  // (engine/foeDamage.js#damageFoe) — thrown back at the TOP of this foe's
  // very next turn, ignoring armor, through the same hero-damage pipeline
  // any other foe swing uses (so the hero's own ward, Hardiness and death
  // path all apply). Checked before the regen tick and before any foe acts.
  // A foe that died before its next turn drops its rebound silently — no
  // event, no damage. A lethal rebound returns at once, mirroring every
  // other lethal branch in this function.
  for (const f of C.foes) {
    if (!f.rebound) continue;
    const amount = f.rebound;
    delete f.rebound;
    if (!f.alive) continue;
    events.push({ type: "foeBubbleRebound", name: f.name, amount });
    const hit = applyFoeDamageToPlayer(state, f, rng, events, { dmg: amount, ignoresArmor: true, ability: "Bubble" });
    if (hit.died) return events;
  }
  if (c.regen) {
    const r = rng.d(8); // roll:amount
    if (c.wp < c.maxWP) {
      // RULES-03 (Phase 75, user 2026-09-25): the Summoner's healing
      // weakness applies to its own Regeneration tick too, through the same
      // chart-driven helper — the draw itself is unchanged.
      const regen = applyCasterHealMul(c.sub, r);
      const before = c.wp;
      c.wp = Math.min(c.maxWP, c.wp + regen);
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
      // actually added after the clamp to max (additive, zero draws).
      events.push({ type: "regenerated", amount: regen, ...(regen !== r ? { halved: true } : {}), gained: c.wp - before });
    }
  }
  // RULES-10 (Phase 75.1, the reader's burn): a fumbled Acid or Ice landing
  // on the READER (not a foe) burns c.wp directly once per foeTurn — no
  // armor, ward or Hardiness soak (this is poison working from the inside,
  // not a blow landing on you), drawn from its own derived stream, never the
  // main rng, so a fight with no selfDot draws and narrates identically to
  // before. Placed right after the hero's own regeneration tick, one tier up
  // from the per-foe acid/dot ticks immediately below (the hero's own
  // condition ticks first, mirroring c.regen's own position above it).
  if (C.selfDot && C.selfDot.left > 0) {
    const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
    const selfDotRng = derivedRng(cursor, "selfDot", C.round);
    const burn = rollDice(selfDotRng, C.selfDot.dmg);
    c.wp -= burn;
    C.selfDot.left--;
    events.push({ type: "selfDotTick", spell: C.selfDot.spell, by: C.selfDot.by, amount: burn, left: C.selfDot.left });
    if (c.wp <= 0) {
      die(state, "scrollFumble", C.selfDot.spell, rng, events);
      return events;
    }
    // Phase 90 plan 05: the burn just ends (Acid's). Ice's old "then heavy"
    // hand-off is gone: a fumbled Ice is an area damage row now.
    if (C.selfDot.left <= 0) delete C.selfDot;
  }
  for (const f of C.foes) {
    if (f.acid && f.acid.rounds > 0) {
      // Quick 260928-sq2 (user ruling 2026-09-28): the first tick adds the
      // caster's level² (stashed on the record by magic.js's acid branch),
      // then spends it; every later tick is the dice alone. Zero draws.
      const d = rollDice(rng, f.acid.dmg) + (f.acid.levelSq || 0);
      delete f.acid.levelSq;
      // Acid is spell damage (bypasses armor, D-06; eligible for the
      // Walking Dead / Cleric-vs-Demons rows, D-11). `c.sub` is read live at
      // tick time — the hero cannot change class mid-fight — so no caster
      // identity is stashed on `f.acid` (D-17: no new serialized field).
      const tick = damageFoe(state, f, d, { kind: "spell", school: "acid", casterSub: c.sub }, rng, events);
      f.acid.rounds--;
      events.push({ type: "acidTick", target: f.name, dmg: tick.applied });
      if (f.wp <= 0 && f.alive) {
        killFoe(state, f, rng, events);
        continue;
      }
    }
    // Phase 38 (ABIL-01, Poisoned Edge) — a generic per-foe DOT record, the
    // exact f.acid tick template above (`f.dot = { left, dmg, by }`). Poison
    // bypasses armour like acid (kind "spell"). Absent on every fixture — only
    // useAbility's "poisonedEdge" case ever sets f.dot. Phase 90 plan 05: no
    // spell sets it any more (Ice, the one that did, is the area freeze now),
    // so the old ice payoff and its level² first tick are gone with it.
    if (f.dot && f.dot.left > 0 && f.alive) {
      const d = rollDice(rng, f.dot.dmg);
      const tick = damageFoe(state, f, d, { kind: "spell", school: f.dot.by, casterSub: c.sub }, rng, events);
      const by = f.dot.by;
      f.dot.left--;
      const dotRanOut = f.dot.left <= 0;
      events.push({ type: "dotTick", target: f.name, dmg: tick.applied, by, left: f.dot.left });
      if (dotRanOut) delete f.dot;
      if (f.wp <= 0 && f.alive) {
        killFoe(state, f, rng, events);
        continue;
      }
    }
    if (!f.alive) continue;
    // RULES-18 (Phase 75.3): a held foe (holdFoe: a Freeze's or Ice's frozen
    // hold, or Stun's stunned hold) skips exactly `left` of its own visits, its
    // asleep count running down alongside so two controls never stack end to end
    // (checked after the dead-foe skip, before the asleep skip below). A hit
    // never ends the hold (damageFoe does not touch `held`).
    if (f.held) {
      if (f.asleep > 0) f.asleep--;
      if (!(f.asleep > 0)) delete f.dozing;
      f.held.left--;
      if (f.held.left > 0) {
        events.push({ type: "foeStillHeld", name: f.name, kind: f.held.kind, left: f.held.left });
      } else {
        events.push({ type: "foeHoldBroken", name: f.name, kind: f.held.kind });
        delete f.held;
      }
      tickBlindFor(f, events);
      continue;
    }
    // RULES-10 (Phase 75.1, foe Regeneration): a live foe carrying `regen`
    // (a fumbled Regeneration) regains a d8 each of its own foeTurn visits,
    // capped at `maxWP`, drawn from a PER-FOE derived stream keyed on the
    // round and this foe's own index in `C.foes` — never the main rng, so a
    // regen-less fight's draw sequence is untouched. An asleep or stupid or
    // stunned foe (checked below) still regenerates — this sits BEFORE
    // every one of those skips, mirroring the acid/dot ticks above it.
    // Nothing is drawn at full hp.
    if (f.regen && f.wp < f.maxWP) {
      const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
      const foeRegenRng = derivedRng(cursor, "foeRegen", C.round, C.foes.indexOf(f));
      const amount = Math.min(f.maxWP - f.wp, foeRegenRng.d(8)); // roll:amount
      f.wp += amount;
      events.push({ type: "foeRegenerated", name: f.name, amount, wp: f.wp, maxWP: f.maxWP });
    }
    if (f.asleep > 0) {
      f.asleep--;
      // Phase 90 plan 05: the dozing mark goes with the sleep when it runs out.
      if (f.asleep <= 0) delete f.dozing;
      events.push({ type: "foeSlept", name: f.name });
      tickBlindFor(f, events);
      continue;
    }
    // Phase 90 plan 04 (SPELL-12, user 2026-09-30): Stupidity no longer
    // skips the foe's turns. It drops the foe's intelligence to 1 for the
    // fight (magic.js), so it keeps swinging and only resists almost nothing;
    // the `f.stupid` flag is the chip's mark and nothing in a turn reads it.
    // Phase 38 (ABIL-01, Pommel Strike) — f.asleep's own skip-turn pattern,
    // reused verbatim: a stunned foe loses this ONE turn, then the flag
    // clears (no counter needed — a single stun, not a duration). Absent on
    // every fixture — only useAbility's "pommelStrike" case ever sets it.
    if (f.stunned) {
      f.stunned = false;
      events.push({ type: "foeStunned", name: f.name });
      tickBlindFor(f, events);
      continue;
    }
    // Phase 90 plan 08 (SPELL-10, Senseless and Duplicate Foe): a misdirected
    // foe spends this turn swinging at a foe (its own side, or itself), never
    // at the hero's side and never casting (resolveMisdirectedTurn). It sits
    // after the held, asleep and stunned skips, so only a turn the foe really
    // takes counts against `misdirect.left`.
    if (f.misdirect && f.misdirect.left > 0) {
      resolveMisdirectedTurn(state, f, rng, events, curve);
      tickBlindFor(f, events);
      continue;
    }
    // Phase 19 (CANON-02/D-03): a caster that has dropped below its own
    // flee threshold leaves without a swing and without XP — the
    // Knight/Con-Artist fled-without-XP shape, checked at the start of the
    // foe's own visit (after the asleep check, before the ability gate). 0
    // draws; strict `<` (exactly at the threshold still fights).
    if (f.sp && f.sp.fleesBelow && f.wp < f.maxWP * f.sp.fleesBelow) {
      f.alive = false;
      f.fled = true;
      events.push({ type: "foeFled", name: f.name, reason: "lowHp" });
      continue;
    }
    // Phase 19 (FOE-01..09, D-04): the ability gate — a structural
    // zero-draw guard (FID-02): a foe lacking a non-empty `abilities` key
    // runs the exact pre-Phase-19 melee path below with zero extra draws.
    // The tick happens BEFORE readiness (D-20/A3). The d6 cast check is
    // drawn ONLY when something is ready AND the foe is not never_melee
    // (RESEARCH Pitfall 3); the ability REPLACES the whole melee turn (every
    // sp.atk swing) when it fires; `.died` mirrors the `hit.died` contract
    // applyFoeDamageToPlayer already uses.
    // Phase 21 (D-18) — the tick now takes `state` so the cadence can read
    // the curve; still 0 draws.
    if (f.abilities && f.abilities.length) {
      tickAbilityCooldowns(state, f);
      const ready = firstReadyAbility(state, f);
      const neverMelee = !!(f.sp && f.sp.never_melee);
      // Phase 73 (ROLL-05): the gate is drawn under the exact same
      // short-circuited condition as before (ready AND not never_melee) —
      // `gate` is null (no draw) when never_melee short-circuits it, exactly
      // like the old `neverMelee ||` skip. resolveFoeAbility spreads the
      // gate's roll-high triple onto foeCast when it fired.
      const gate = ready && !neverMelee ? rollCheck(rng, 6, atLeastFor(4, 6)) : null;
      if (ready && (neverMelee || gate.ok)) {
        if (resolveFoeAbility(state, f, ready, rng, events, gate).died) return events;
        tickBlindFor(f, events);
        continue;
      }
      if (neverMelee) {
        events.push({ type: "foeOutOfSpells", name: f.name });
        tickBlindFor(f, events);
        continue;
      }
    }
    const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);
    // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING's budget — what
    // this ONE foe may deal across every swing of THIS visit (hero OR member
    // targets both draw from the same pool), reset per foe. Infinity at the
    // identity value (0, off) makes every clamp below a structural no-op.
    let dealtThisVisit = 0;
    for (let s = 0; s < swings; s++) {
      if (!f.alive) break;

      // PARTY-04/PARTY-05 (Phase 8): each foe swing chooses a target from the
      // pool [hero] + live party members, via pickFoeTarget's DETERMINISM
      // GATE (the single hottest parity loop in the engine) — see its JSDoc
      // above for the exact zero-draw rationale this call preserves. Phase
      // 24 (IDENT-05): passing `f` lets the Bard's low-wit clause fire only
      // for this melee swing, not foeAbilities.js's bolt/drain call.
      const member = pickFoeTarget(state, rng, f);
      if (member) {
        // Member branch: the to-hit and damage roll here, then the Joiner's
        // own pipeline (applyFoeDamageToMember: Pendant, Brace, its own
        // armour soak and wear, the hit). No ward/mirror/Hardiness/hide
        // (hero-only machinery), no die(); a member at 0 wp is downed +
        // departs.
        // Phase 79 (quick fix 79-02b, user ruling 2026-09-27, "Joiners use
        // only their own defences against foe swings"): a Joiner is its own
        // body, built by the hero's rule. The foe die reads the Joiner's OWN
        // race (a Dwarven Joiner's better foe die; the hero's never reaches
        // it), and the faces/mods come from derived.js#foeSwingVsMember —
        // foeToHitVs(state, "member", sheet) on the Joiner's own race trait,
        // size, sub-class, gear, evasion, Sidestep/Smoke, Mirror Self and
        // invisibility, plus the party-wide Battle Roar and Crystal Staff,
        // then the SAME blind / Weaken cap / insult-LAST chain the hero's
        // swing takes (PARLEY-02 + Phase 72 ROLL-01 (a): the insult is the
        // last term on every foe swing). None of the hero's personal
        // defences (Acrobat, Guard, gear, Mirror Self, invisibility, race
        // or size) reach a Joiner. Pure reads of the member's persistent
        // sheet; a missing sheet, or one with no known race row (a
        // hand-built or damaged save's Joiner — tolerant load), reads as a
        // blank body (foe die step 0), never the hero's. Zero draws: the
        // strike draw below keeps its position (Phase 73, ROLL-05).
        const mSheet = Array.isArray(state.party) ? state.party[member.partyIdx] : null;
        const mDieN = foeDie(mSheet && RACES[mSheet.race] ? mSheet : null, f);
        const { faces: mFaces, mods: mMods } = foeSwingVsMember(state, f, mSheet);
        // Phase 73 (ROLL-05): the ONE roll-high check helper reads the to-hit
        // die, in the same draw position the previous draw sat.
        const mCheck = rollCheck(rng, mDieN, atLeastFor(mFaces, mDieN));
        const { roll: mRoll, atLeast: mAtLeast } = mCheck;
        if (!mCheck.ok) {
          // name the member as the intended target so a whiff at a party
          // member reads distinctly from a whiff at the hero (PARTY: Oracle
          // shows who was targeted). `member` field is additive + only set in
          // this live-member branch, which never runs in solo parity fixtures.
          events.push({
            type: "foeMissed",
            name: f.name,
            roll: mRoll,
            atLeast: mAtLeast,
            dieN: mDieN,
            member: member.name,
            ...(mMods.length ? { mods: mMods } : {}),
          });
          // Phase 38 (ABIL-05, Riposte) — "for one round every foe that
          // misses you eats your weapon damage": a miss on THIS member with
          // that member's OWN Riposte active counters it — a miss on the
          // hero or a different member never triggers this branch. False on
          // every fixture (only resolveMemberAbility's "riposte" case ever
          // starts this timer on a member's own sheet).
          if (mSheet && abilityEffectActive(mSheet, "riposte")) {
            const rd = weaponDamage(memberView(mSheet, member), rng);
            const hit = damageFoe(state, f, rd, { kind: "ally", crit: false }, rng, events);
            if (!hit.soaked) events.push({ type: "memberRiposted", name: member.name, target: f.name, dmg: hit.applied });
            if (f.wp <= 0) {
              killFoe(state, f, rng, events);
              break;
            }
          }
          continue;
        }
        // Phase 21 (D-02): flat foePower bonus on the lvl*lvl base — absent at depth <= 5, 0 draws
        // DELIBERATE RULES CHANGE (Phase 52, DMG-02, 2026-09-20): the crit
        // doubles the DAMAGE DICE only, not the whole lvl^2 + dmgBonus + dice
        // sum — see foeLevelBase's JSDoc above and the hero-branch twin below
        // for the full rationale. Same single draw, same position — 0 draw-
        // shape change.
        // Phase 73 (ROLL-05): the mirrored crit rule — the top face of the
        // member's own strike die always crits, byte-identical to the old
        // `mRoll === 1`.
        // Quick 260928-cos: the Joiner's OWN live Cloak of Strength (its own
        // sheet's timers — never the hero's) turns the crit aside, exactly
        // like the hero branch below; same draws.
        // Phase 90 plan 04 (SPELL-12): a blind foe never crits, Joiner side too.
        const mRolledCrit = !f.blind && isBestFace(mRoll, mDieN);
        const mCritWarded = mRolledCrit && !!mSheet && wardCrit(mSheet, f, mRoll, mDieN, events, member.name);
        const mCritical = mRolledCrit && !mCritWarded;
        const mDice = f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6); // roll:amount
        // RULES-17 (Phase 75.3): an elite's blow carries its own per-rank
        // hit bonus too — `f.elite || 0` is 0 for every plain foe.
        let mDmg = foeHitFor(foeLevelBase(f) + (mCritical ? 2 * mDice : mDice), curve, f.elite || 0);
        if (foeWeakened(C, f)) mDmg = Math.ceil(mDmg / 2);
        // Phase 40 (SPELL-01, Shrink) — a shrunk foe's own blows are halved
        // too (a shrunk-AND-weakened foe is quartered, ceil applied twice —
        // both are independent post-roll halvings). Pure read, 0 draws;
        // false on every fixture.
        if (f.shrunk) mDmg = Math.ceil(mDmg / 2);
        // Phase 38 (ABIL-01, Hamstring) — this specific foe's own blows do
        // half damage for the rest of the fight, member side. Pure read, 0
        // draws; false on every fixture (only useAbility's "hamstring" case
        // ever sets it).
        if (f.hamstrung) mDmg = Math.ceil(mDmg / 2);
        // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING, applied
        // after every existing halving, before the Joiner's pipeline — the
        // same spot the hero's ceiling sits (Phase 89 plan 04 moved the
        // Brace into the pipeline below, after the Pendant, as the hero's).
        mDmg = Math.min(mDmg, Math.max(0, roundDamageCapFor(c.level) - dealtThisVisit));
        dealtThisVisit += mDmg;
        // Phase 89 plan 04 (ITEM-07): the Joiner's own pipeline — Pendant,
        // Brace, then its own armour soak and wear, then the hit.
        applyFoeDamageToMember(state, f, member, rng, events, {
          dmg: mDmg,
          roll: mRoll,
          atLeast: mAtLeast,
          dieN: mDieN,
          mods: mMods,
          critical: mCritical,
          critAtLeast: mCritical ? mDieN : undefined,
          critWarded: mCritWarded,
          swing: s,
        });
        continue;
      }

      const dieN = foeDie(c, f);
      // Phase 74 (ROLL-02): the base need, the passive breakdown and the
      // blind/penalty/insulted post-mods chain now live in the ONE helper
      // engine/derived.js#foeSwingVsHero — see its JSDoc for the full
      // ordering rationale (Phase 72 ROLL-01 (a): insulted is applied last).
      const { faces, mods } = foeSwingVsHero(state, f);
      // Phase 73 (ROLL-05): the ONE roll-high check helper reads the to-hit
      // die, in the same draw position the previous draw sat.
      const check = rollCheck(rng, dieN, atLeastFor(faces, dieN));
      const { roll, atLeast } = check;
      if (!check.ok) {
        events.push({ type: "foeMissed", name: f.name, roll, atLeast, dieN, ...(mods.length ? { mods } : {}) });
        // Phase 38 (ABIL-01, Riposte) — "for one round every foe that misses
        // you eats your weapon damage": hero-branch misses ONLY (a miss on a
        // member never triggers this — that branch `continue`s well above,
        // before this point is ever reached). abilityEffectActive is false
        // on every fixture (only useAbility's "riposte" case ever starts
        // this timer), so this never fires or draws for a non-carrier.
        if (abilityEffectActive(c, "riposte")) {
          const rd = weaponDamage(c, rng);
          const hit = damageFoe(state, f, rd, { kind: "melee", casterClass: c.cls, casterSub: c.sub, crit: false }, rng, events);
          if (!hit.soaked) events.push({ type: "riposted", target: f.name, dmg: hit.applied });
          if (f.wp <= 0) {
            killFoe(state, f, rng, events);
            break;
          }
        }
        continue;
      }
      // Phase 21 (D-02): flat foePower bonus on the lvl*lvl base — absent at depth <= 5, 0 draws
      // DELIBERATE RULES CHANGE (Phase 52, DMG-02, 2026-09-20): the crit
      // doubles the DAMAGE DICE only, not the whole lvl^2 + dmgBonus + dice
      // sum — the old rule produced a cliff (a tier-5 d6 crit read 52-62; a
      // flat-25 Herman read 82/100 against a level-5 hero's ~30 max HP). The
      // crit decision is made BEFORE the damage line so the SAME single dice
      // draw (in the SAME position, right after the to-hit roll) is reused
      // whether it is added once or twice — 0 draw-shape change. The
      // weakened/shrunk/hamstrung halvings and the applyFoeDamageToPlayer
      // pipeline (Hardiness/hide/halfNext/ward/soak) keep their existing
      // order, untouched.
      // Phase 73 (ROLL-05): the mirrored crit rule — the top face always
      // crits, the top TWO faces crit for a Soldier — byte-identical to the
      // old `roll === 1 || (roll <= 2 && Soldier)`.
      // Quick 260928-cos (user-approved fix 2026-09-28): a live Cloak of
      // Strength on the hero turns a rolled crit into an ordinary hit
      // (wardCrit narrates it). The crit roll is the to-hit roll above and
      // the dice draw below is unchanged — only the doubling is dropped.
      // Phase 90 plan 04 (SPELL-12): a blind foe never crits (see pursuitStrike).
      const rolledCrit = !f.blind && roll >= atLeastFor(c.sub === "Soldier" ? 2 : 1, dieN);
      const critWarded = rolledCrit && wardCrit(c, f, roll, dieN, events);
      const crit = rolledCrit && !critWarded;
      const dice = f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6); // roll:amount
      // RULES-17 (Phase 75.3): an elite's blow carries its own per-rank hit
      // bonus too — `f.elite || 0` is 0 for every plain foe.
      let dmg = foeHitFor(foeLevelBase(f) + (crit ? 2 * dice : dice), curve, f.elite || 0);
      if (foeWeakened(C, f)) dmg = Math.ceil(dmg / 2);
      // Phase 40 (SPELL-01, Shrink) — a shrunk foe's own blows are halved
      // too, hero side (see the member-branch twin above for the
      // shrunk+weakened quartering note). Pure read, 0 draws; false on every
      // fixture.
      if (f.shrunk) dmg = Math.ceil(dmg / 2);
      // Phase 38 (ABIL-01, Hamstring) — this specific foe's own blows do
      // half damage for the rest of the fight, hero side. Pure read, 0
      // draws; false on every fixture.
      if (f.hamstrung) dmg = Math.ceil(dmg / 2);
      // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING, applied
      // after every existing halving, before applyFoeDamageToPlayer.
      dmg = Math.min(dmg, Math.max(0, roundDamageCapFor(c.level) - dealtThisVisit));
      dealtThisVisit += dmg;

      const hit = applyFoeDamageToPlayer(state, f, rng, events, { dmg, roll, atLeast, dieN, mods, critWarded });
      if (hit.died) return events;
    }
    // Phase 38 (ABIL-01, Dirty Trick) — the blindFor countdown, at the END
    // of this foe's own visit (after its swings): a spell-blinded foe (no
    // blindFor) stays blind indefinitely, exactly as before. Absent on every
    // fixture. Phase 90 plan 10: every other way a live foe's visit can end
    // (held, asleep, stunned, misdirected, a cast ability, out of spells)
    // counts it down too, through the same helper (tickBlindFor).
    tickBlindFor(f, events);
  }
  // RULES-14 (Phase 75): an ARMED mirror carries `rounds: null` and never
  // ticks here — it stays armed until a blow lands (see the mirror branch in
  // applyFoeDamageToPlayer) or the fight ends (endCombat still clears every
  // ward). A POPPED pool always carries `rounds: 1`, so this always fades it
  // at the end of the SAME foe turn it popped in — "a pool for the rest of
  // that round," literally. Shield's own `rounds` countdown is unchanged.
  if (c.ward && typeof c.ward.rounds === "number" && --c.ward.rounds <= 0) {
    events.push({ type: "wardFaded" });
    c.ward = null;
  }
  if (c.mirror > 0 && --c.mirror <= 0) events.push({ type: "mirrorFaded" });
  // Phase 91 plan 07 (IDENT-17): a Joiner's own sung ward counts down in the same
  // tail, in roster order, with its own name on the fade. An armed Bubble
  // (`rounds: null`) never ticks; a Shield and a popped film (numeric `rounds`) do.
  if (C.allies) {
    for (const a of C.allies) {
      if (a.ward && typeof a.ward.rounds === "number" && --a.ward.rounds <= 0) {
        events.push({ type: "wardFaded", member: a.name });
        a.ward = null;
      }
    }
  }
  // RULES-10 (Phase 75.1, foe-side ward tick): each LIVE foe's OWN ward
  // ticks down beside the hero's, in the very same tail. An armed Bubble
  // mirror (`foe.ward.mirror`) is never ticked here — it stays armed until
  // a blow lands (engine/foeDamage.js#damageFoe) or the fight ends; only a
  // plain or popped pool (a numeric `rounds`) counts down, fading with
  // foeWardFaded at 0.
  for (const f of C.foes) {
    if (!f.alive) continue;
    if (f.ward && !f.ward.mirror && typeof f.ward.rounds === "number" && --f.ward.rounds <= 0) {
      events.push({ type: "foeWardFaded", name: f.name });
      delete f.ward;
    }
  }
  // RULES-10 (Phase 75.1, foe Mirror Self tick): each LIVE foe's own Mirror
  // Self (`foe.mirror`) ticks down independently, beside the ward tick
  // above and the hero's own c.mirror tick, fading with foeMirrorFaded.
  for (const f of C.foes) {
    if (f.alive && f.mirror > 0 && --f.mirror <= 0) events.push({ type: "foeMirrorFaded", name: f.name });
  }
  // Phase 39 (GEAR-02): the retired per-foeTurn c.acute countdown —
  // Acuteness is now a rounds-cadence c.timers effect record, ticked by the
  // shared tickRounds(c) call below (with the rest of the tail) and cleared
  // unconditionally at endCombat by clearRoundTimers.
  // Phase 19 (D-09/A8): ticks once per foeTurn like ward/mirror, but never
  // on the turn that applied/refreshed it (resolveFoeAbility always assigns
  // a NEW object to c.foeEffect), so `rounds: 1` is never a no-op.
  if (c.foeEffect && c.foeEffect === foeEffectAtStart && --c.foeEffect.rounds <= 0) {
    // CMBUI-13 (Phase 77, plan 77-07): a fading daze names the to-hit delta
    // it takes back, from the engine's own constant; payload only.
    events.push({ type: "foeEffectFaded", kind: c.foeEffect.kind, ...(c.foeEffect.kind === "dazed" ? { toHit: -DAZED_TO_HIT_PENALTY } : {}) });
    c.foeEffect = null;
  }
  // Phase 31 (Afraid ruling, user ruling 2026-09-16): the Afraid countdown —
  // LAST in the tail (after ward/mirror/foeEffect), ticks once per foeTurn
  // call exactly like those, and never adds the key to a combat that lacks
  // it (a combat with no triggered phobia this fight simply never has
  // `C.afraid`).
  if (C.afraid > 0 && --C.afraid <= 0) events.push({ type: "fearPassed" });
  // Phase 36 (BAL foundation) — the rounds tick for engine/effects.js
  // records, LAST in the tail after ward/mirror/foeEffect/afraid, once per
  // foeTurn call exactly like ward (a round where the foes win initiative
  // ticks twice, as ward does); guarded on c.timers; zero draws. Phase 39
  // (GEAR-02): the returned transitions are mapped to events below
  // (itemEffectFaded/itemCooled/staffRecharged).
  // Phase 40 (SPELL-01, Weaken) — the ONE tickRounds(c) call for this tail:
  // the same transitions list feeds BOTH the generic item/ability narration
  // (narrateTimerTransitions, unchanged) AND this spell-specific expiry
  // check, so a round never ticks the timers map twice. On the
  // `spell:weaken` record's effect->null transition, clear the same
  // C.weakened/C.foeToHitPenalty fields the cast set and narrate
  // `weakenFaded` — clearRoundTimers at endCombat already drops a still-live
  // record when the fight ends first.
  if (c.timers) {
    const trans = tickRounds(c);
    narrateTimerTransitions(state, trans, events);
    if (C && trans.some((t) => t.id === "spell:weaken" && t.from === "effect")) {
      C.weakened = false;
      C.foeToHitPenalty = 0;
      // Quick 260927-rsx: the per-foe resist marks go with the Weaken.
      C.foes.forEach((f) => delete f.weakenResisted);
      events.push({ type: "weakenFaded" });
    }
  }
  // Phase 38 (ABIL-05, post-research ruling): every LIVE party member's own
  // ability cooldowns tick beside the hero's, same cadence, same call —
  // a downed member (wp <= 0) is skipped (it is about to leave the roster at
  // endCombat, never mid-fight); a sheet without timers is a no-op. Guarded
  // on `C.allies` existing at all; false/inert on every fixture (no fixture
  // carries a party).
  for (const ally of C.allies || []) {
    if (ally.wp <= 0) continue;
    const s = Array.isArray(state.party) ? state.party[ally.partyIdx] : null;
    if (s && s.timers) tickRounds(s);
  }
  // Phase 41 (TERR-04): the in-combat half of the Death trigger — a foe's
  // blows can cross the 25%/50% hp lines mid-fight, not just at fight()'s
  // own start-of-combat nearDeathPanic check. Zero draws; a no-op for every
  // non-Death-phobic hero (every parity fixture).
  checkDeathPhobia(state, events);
  return events;
}
