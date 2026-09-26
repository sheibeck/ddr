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

import { skill, eff, strikeDie, toHit, weaponDamage, foeDie, foeToHitVs, foeToHitBreakdown, inDark, armorSoak, DEATH_PANIC_THRESHOLD, AFRAID_ROUNDS, AFRAID_TO_HIT_PENALTY, AFRAID_DMG_DIV, afraidNeed, afraidDamage, fluency, killSpFor, castableAttackSpells, memberToHit, bestAttackSpell, schoolBonus, resistRoll, abilityEffectActive, weaponCrit, armorBulk, itemEffectActive, fleeBreakdown, targetStrikeFaces, foeSwingVsHero, weaponRow, applyCasterHealMul } from "./derived.js";
import { damageFoe } from "./foeDamage.js";
import { rollDice, isBestFace, rollCheck, atLeastFor, rollFields } from "./dice.js";
import { derivedRng } from "./rng.js";
import { die, forfeitLoot } from "./death.js";
import { checkLevel } from "./character.js";
import { offerLoot, bagUpgradeTier, bagItemFor, gainWilmst, rollTreasureItem, LOOT_DIVISOR, narrateTimerTransitions } from "./items.js";
import { maxCharges } from "./movement.js";
import { firstReadyAbility, tickAbilityCooldowns, resolveFoeAbility } from "./foeAbilities.js";
import { difficultyCurve, foeCountFor, foeWpFor, foeHitFor, roundDamageCapFor, tierSpreadFor, heroSpFor, lootFor, classKillSpeedFor, parleyNeedModFor } from "./difficulty.js";
import { tickRounds, clearRoundTimers, startEffect, startCooldown, isReady } from "./effects.js";
import { BESTIARY, ENC_TYPES, RACES, WEAPON_MAX, STRIKE_DICE, BAG_DROP_FACES, ABILITY_BY_ID, ONCE_A_FIGHT } from "../content/index.js";
// Phase 38 (ABIL-05): a Joiner's own ability use reuses abilities.js's
// DURATION_ROUNDS mapping and foe-flag appliers verbatim — the SAME
// combat.js <-> foeAbilities.js cycle precedent above applies here
// (abilities.js imports several combat.js functions; neither module reads
// the other's binding at top-level module-evaluation time, only inside
// function bodies, so the cycle is safe).
import { DURATION_ROUNDS, applyPommel, applyDirtyTrick, applyPoison, applyHamstring, applyMark } from "./abilities.js";
import { checkDeathPhobia } from "./phobias.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const TALKATIVE = ["Humans", "Demons", "Lair Beasts", "Beasts"];

// The Bard's song bank (mazeworld.html lines 2736-2742). Not yet extracted to
// content/*.js (nothing else in the engine needs it) — kept local, pure data.
const SONGS = [
  { lvl: 1, n: "Soothe the Savage", txt: "calms beasts" },
  { lvl: 2, n: "Inspire the Heart", txt: "+1 to hit this fight" },
  { lvl: 3, n: "Lullaby", txt: "d6 foes sleep" },
  { lvl: 4, n: "Cry of Thunder", txt: "d12 foes frozen d8 rounds" },
  { lvl: 5, n: "An Ode to Death", txt: "equals reduced to 1 wp" },
];

/** liveFoes(state) — the still-standing foes in the current encounter. */
export function liveFoes(state) {
  return state.combat ? state.combat.foes.filter((f) => f.alive) : [];
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
  const forcedFoe = (samurai || slow || knightBig || courtMage) && !foreseen && !c.senses;
  c.foresight = false;
  // RULES-05 (Phase 75): c.senses joins the unconditional "you" branch.
  C.first = forcedFoe ? "foe" : foreseen || acuteHearing || c.senses ? "you" : mine >= theirs ? "you" : "foe";
  let why;
  if (forcedFoe) {
    why = samurai ? "samurai" : slow ? "slow" : knightBig ? "knight" : "courtMage";
  } else if (foreseen) {
    why = "foreseen";
  } else if (acuteHearing) {
    why = "acuteHearing";
  } else if (c.senses && C.first === "you") {
    why = "senses";
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
 * draw shape, no level-keyed cap), a copy-time wp scale (`foeWpFor`), and
 * the tier bleed via `tierSpreadFor()`. The old `dmgBonus` key/whole-lvl-base
 * scaling is retired — `foeHitFor` scales the WHOLE hit at the damage sites
 * instead (see foeTurn/pursuitStrike below).
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
  const maxLvl = curve.foeLevel;
  // NOTE: this call can consume ONE or TWO d4 rolls, exactly like the
  // retired `D(4) <= 2 ? 1 : D(4) <= 3 ? 2 : 3` ternary — the second D(4) is
  // only rolled if the first roll was > 2 (foeCountFor's own thunk). A
  // wandering encounter still draws nothing here.
  const n = wandering ? 1 : foeCountFor(rng.d(4), () => rng.d(4)); // roll:selection
  const foes = [];
  for (let i = 0; i < n; i++) {
    // Phase 73 (ROLL-05): the tier-bleed d4 mirrors — "one tier lower" fires
    // on the SAME faces (tierSpreadFor()), read as the top faces of the d4
    // instead of the bottom ones; byte-identical for every raw draw.
    const lvl = clamp(maxLvl - (rollCheck(rng, 4, atLeastFor(tierSpreadFor(), 4)).ok ? 1 : 0), 1, 5);
    // LO-02: no `||` fallback needed here — `lvl` is always clamped to
    // [1,5] above, and every BESTIARY category has exactly 5 tiers
    // (confirmed by 01-VERIFICATION.md's creature count audit), so
    // BESTIARY[type][lvl - 1] can never be undefined.
    const roster = BESTIARY[type][lvl - 1];
    const picked = rng.pick(roster);
    const wp = foeWpFor(picked.wp, curve);
    foes.push({
      name: picked.n,
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
    foes: foes.map((f) => ({ name: f.name, lvl: f.lvl, wp: f.wp, maxWP: f.maxWP })),
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
    } else if (c.sub === "Con Artist" && f.lvl <= 1) {
      // Phase 73 (ROLL-05): the die is drawn under the exact same
      // short-circuited condition as before (Con Artist, foe lvl <= 1); only
      // the winning face moved from the bottom 4 faces to the top 4.
      const conArtistCheck = rollCheck(rng, 6, atLeastFor(4, 6));
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
  // (`inDark(state)`), or a Death-phobic character at/below
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
  const phobiaCondition = c.phobiaType === type || (c.phobia === "Darkness" && inDark(state)) || nearDeathPanic || armed;
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
  // existing dark-cap waiver.
  if (inDark(state) && !skill(c, "Night Vision") && !c.senses) events.push({ type: "combatInDark" });
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
 * forceCrit?, finishUnder?, bonusDmg?, dmgMul?, needShift?, attacks? }`)
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
  // Phase 73 (ROLL-05): the frenzy trigger reads roll-high through the ONE
  // check helper — 5 of the d8's 8 faces still win (atLeastFor(5, 8) = 4),
  // the same odds as the old `rng.d(8) <= 5`, one draw, same position.
  if (R.frenzy) {
    const frenzyCheck = rollCheck(rng, 8, atLeastFor(5, 8));
    if (frenzyCheck.ok) {
      attacks = Math.max(attacks, 2);
      frenzyFired = true;
      events.push({ type: "frenzy", ...rollFields(frenzyCheck) });
    }
  }

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
    // "you need two better to land it" self-penalty — a transient descriptor
    // term, zero draws, applied BEFORE Afraid so Afraid's own penalty stacks
    // on top of it like any other need rule. Floors at 1 (never revives an
    // untouchable need-0 foe, mirroring Afraid's own floor below); a no-op
    // (faces unchanged) when magicOnly has already zeroed faces.
    let abilityMods = [];
    if (AS && AS.needShift && faces > 0) {
      const before = faces;
      faces = Math.max(1, faces + AS.needShift);
      abilityMods = faces !== before ? [{ name: "overhead", delta: faces - before }] : [];
    }
    // Phase 31 Afraid — pure arithmetic on the winning-face count, zero rng;
    // false (afraidMods empty) for every non-phobia fixture. The LAST
    // modifier, after every other need rule; never revives an untouchable
    // (0 faces) foe.
    const facesBeforeAfraid = faces;
    faces = afraidNeed(state, faces);
    const afraidMods = faces !== facesBeforeAfraid ? [{ name: "afraid", delta: faces - facesBeforeAfraid }] : [];
    const mods = [...mirrorMods, ...abilityMods, ...afraidMods];
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
    // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Cloak of
    // Strength (content/treasure-tables.js, eff:{noCrit:1}, "no critical
    // damage ever lands on you") was inert — the prototype's noCrit was
    // class-only (Guard/Soldier/dark) and never read eff(c,"noCrit"). This
    // flag ("no critical damage lands ON YOU") reads as PLAYER protection, but
    // the same field name is reused here as the player's OWN crit-suppression
    // (the only noCrit hook in combat), matching the prototype's Guard/Soldier
    // "your blows never crit" seam. Pure read (no rng), so parity is unaffected
    // for every character not carrying the cloak (eff noCrit === 0).
    // RULES-05 (Phase 75): Sense Presence waives the dark no-crit ban too —
    // "full skill in the dark," matching toHit's existing dark-cap waiver.
    const noCrit =
      c.sub === "Guard" ||
      c.sub === "Soldier" ||
      (inDark(state) && !skill(c, "Night Vision") && !c.senses) ||
      eff(c, "noCrit") > 0;
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
      if (skill(c, "Stealth") && roll >= atLeastFor(2, dieN) && armorBulk(c) < 2) {
        crit = true;
        critBy = "stealth";
        critAtLeast = atLeastFor(2, dieN);
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
    // the Guard/Soldier/dark/noCrit-gear rule exactly like a natural 1 (a
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
    if (t.marked) dmg += 2;
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
  // Phase 38 (ABIL-02, strike_descriptor_spec item 8): the descriptor is
  // transient — never present on state.combat once this function returns,
  // so afterPlayerAction (and anything after it) never sees it.
  if (C.abilityStrike) delete C.abilityStrike;
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * killFoe(state, f, rng, events) — a foe's death: lives (kill-twice), the
 * skill-point formula (d6 x level x mul, with spMul/Barbarian/Apprentice
 * modifiers), coin via gainWilmst, treasure via rollTreasureItem, offered
 * into the pending loot pile (Phase 29, LOOT-01 — replaces the legacy
 * auto-take), cooking, and checkLevel. Ports mazeworld.html killFoe() (lines
 * 2410-2443).
 */
export function killFoe(state, f, rng, events = []) {
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
  const liveMembers = state.combat && state.combat.allies ? state.combat.allies.filter((a) => a.wp > 0) : [];
  const shares = 1 + liveMembers.length;
  const heroShare = shares > 1 ? Math.round(gained / shares) : gained;
  // Phase 54 (BAND-02, USER RULING D): HERO_SP_SCALE paces every SP grant —
  // identity (1) is a no-op here.
  const spGained = heroSpFor(heroShare);
  c.sp += spGained;
  events.push({ type: "foeKilled", name: f.name, spGained });

  // creatures carry things, and the things are worth wilmst
  const purse = { Humans: 12, Demons: 8, Magical: 8, "Walking Dead": 6, "Lair Beasts": 3, Beasts: 1 }[f.type] || 4;
  // Phase 54 (BAND-02, USER RULING D): LOOT_SCALE, applied POST-DRAW —
  // identity (1) is a no-op.
  const coin = lootFor(Math.round((rng.d(10) * f.lvl * purse) / LOOT_DIVISOR)); // roll:amount
  if (coin > 0) gainWilmst(state, coin, "off the body", rng, events);
  // DETERMINISM GATE (Phase 29, LOOT-01/05): the gate d20 and every
  // rollTreasureItem draw below are UNCHANGED and still sit first, in the
  // same order — only the destination changes, from the legacy auto-take to
  // the pending pile (offerLoot). The bag-swap d20 is the ONE new draw this
  // phase adds: it sits AFTER them and before the cooking check, and fires
  // ONLY when bagUpgradeTier(state) is non-null (depth >= 2 with an upgrade
  // tier available) — never true on a depth-1 fixture (RESEARCH "LOOT-05
  // guard safety"), so every parity fixture draws exactly as before.
  // Phase 73 (ROLL-05): both gates now read roll-high through rollCheck —
  // same draws, same positions, same short-circuit (the bag gate only draws
  // when `tier` is truthy). offerLoot's optional 4th argument carries the
  // roll-high triple(s) for the parity invariant/Oracle.
  const lootCheck = rollCheck(rng, 20, atLeastFor(2 + f.lvl, 20));
  if (lootCheck.ok) {
    let drop = rollTreasureItem(rng, state.floor.depth, c);
    const tier = bagUpgradeTier(state);
    const bagCheck = tier ? rollCheck(rng, 20, atLeastFor(BAG_DROP_FACES, 20)) : null;
    if (bagCheck && bagCheck.ok) drop = bagItemFor(tier);
    offerLoot(state, drop, events, { ...rollFields(lootCheck), ...(bagCheck ? { bag: rollFields(bagCheck) } : {}) });
  }

  if (f.type === "Beasts" || f.type === "Lair Beasts") {
    if (skill(c, "Cooking")) {
      const fed = Math.max(1, Math.round(f.maxWP / 4));
      c.wp = Math.min(c.maxWP, c.wp + fed);
      c.rations++;
      events.push({ type: "cooked", wp: fed, rations: 1 });
    } else if (rng.d(6) >= 4) { // roll:already-high
      c.rations++;
      events.push({ type: "cooked", wp: 0, rations: 1 });
    }
  }
  checkLevel(state, rng, events);
  return events;
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
 * calls this on all three success exits, before pushing `fled`.
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
  const crit = roll >= atLeastFor(c.sub === "Soldier" ? 2 : 1, dieN);
  const dice = pursuer.sp && pursuer.sp.dmg ? rollDice(rng, pursuer.sp.dmg) : rng.d(6); // roll:amount
  const curve = difficultyCurve(state.floor.depth);
  let dmg = foeHitFor(foeLevelBase(pursuer) + (crit ? 2 * dice : dice), curve);
  if (C.weakened) dmg = Math.ceil(dmg / 2);
  // Phase 40 (SPELL-01, Shrink) — a shrunk pursuer's parting strike is
  // halved too, same rule as its ordinary melee swing.
  if (pursuer.shrunk) dmg = Math.ceil(dmg / 2);
  // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING, a FRESH budget
  // (pursuitStrike is a single strike, never part of foeTurn's per-visit
  // budget) — Infinity at the identity value (0, off), a structural no-op.
  dmg = Math.min(dmg, Math.max(0, roundDamageCapFor(c.level)));
  return applyFoeDamageToPlayer(state, pursuer, rng, events, { dmg, roll, atLeast, dieN, mods });
}

/**
 * flee(state, rng, events) — the escape action. Ports mazeworld.html flee()
 * (lines 2684-2697): Samurai never runs, a Cloaker gets away for free while
 * unseen, a tracked round-1 withdrawal is clean (denied for a Master of
 * Arms), otherwise a raw d20 vs `atLeast = 14 - fleeBreakdown(c).bonus`
 * (Phase 73, ROLL-05: flee was ALREADY roll-high — no mirror, only the
 * bonus folding into the threshold), with every modifier named in
 * fleeRolled (DELIBERATE RULES CHANGE, Phase 42, 2026-09-18,
 * FLEE-01/FLEE-02, docs/FLEE.md — was "d20 (+5 Thief) vs 11"); failure is
 * unchanged: it triggers a foeTurn and advances the round. Phase 19
 * (CANON-02/D-19): a live pursuing foe gets one
 * melee strike on every success exit, BEFORE the `fled` event; a lethal
 * strike returns without `endCombat`. Phase 19 (CANON-02/D-03) also adds a
 * cleared-check after a failed flee's foeTurn, since a fleesBelow caster can
 * now leave the fight mid-turn and would otherwise strand the combat screen.
 *
 * DECISION ORDER (Phase 24, IDENT-05/IDENT-07): Samurai refusal first ->
 * Cloaker free vanish while `!C.opened2` (denied + narrated once seen) ->
 * tracked round-1 clean withdrawal (denied + narrated for a Master of
 * Arms, who falls through) -> the ordinary d20 roll.
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
  if (c.sub === "Samurai") {
    events.push({ type: "fleeRefused", reason: "samurai" });
    return events;
  }
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-07): the Cloaker's
  // free vanish only works before it has struck this fight — "you can
  // always vanish, as long as nobody has seen your face". Once `C.opened2`
  // is set (playerStrike's first LANDED blow), a Cloaker narrates the
  // denial and falls through to the ordinary flee roll below instead of
  // returning here. Zero new draws; `opened2` already exists.
  if (c.sub === "Cloaker" && !C.opened2) {
    if (pursuitStrike(state, rng, events).died) return events;
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
    // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): "you attack
    // creatures without question" — a Master of Arms gets no clean
    // round-1 tracked withdrawal; they narrate the denial and fall through
    // to the ordinary flee roll below like any other Fighter past round 1.
    // Every other Fighter's clean exit stays byte-identical (same three
    // statements, same order).
    if (c.sub === "Master of Arms") {
      events.push({ type: "withdrawalDenied", reason: "masterOfArms" });
    } else {
      if (pursuitStrike(state, rng, events).died) return events;
      forfeitLoot(state, "fled", events);
      events.push({ type: "fled", reason: "tracked" });
      endCombat(state, events);
      return events;
    }
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
export function canParley(state) {
  if (!state.combat) return false;
  const c = state.c;
  const C = state.combat;
  const t = C.type;
  if (C.parleyTried) return false; // D-05: the encounter's one attempt is spent
  if (c.sub === "Ninja" || c.sub === "Master of Arms") return false; // Phase 24 IDENT-05: a Ninja never speaks; a Master of Arms attacks without question
  if (t === "Walking Dead") return false; // canon, unconditional, for everyone
  const flu = fluency(c);
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
 * parley(state, rng, events) — talk the encounter down. Ports mazeworld.html
 * parley() (lines 2715-2734): a d20 read roll-high (Phase 73, ROLL-05) vs
 * the top `9+bonus` faces, awarding half the skill points (and a
 * Humans-only bonus payout) on success, ending combat cleanly.
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
  if (C.parleyTried) {
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
  if (c.sub === "Ninja") {
    events.push({ type: "parleyRefused", reason: "ninja" });
    return events;
  }
  if (c.sub === "Master of Arms") {
    events.push({ type: "parleyRefused", reason: "masterOfArms" });
    return events;
  }
  if (!canParley(state)) return events; // unchanged silent path for never-eligible cases
  // LO-03: guard the empty-foes edge defensively. Currently unreachable
  // (state.combat is nulled the instant liveFoes empties on every path that
  // could produce it), but Math.max(...[]) === -Infinity would otherwise
  // inflate `bonus` below to +Infinity and make parley un-failable if that
  // invariant is ever changed.
  const foes = liveFoes(state);
  if (!foes.length) return events;
  const top = Math.max(...foes.map((f) => f.lvl));
  if (c.race === "Wilmsry" && C.type === "Magical") {
    // PARLEY-04 / D-12: now REACHABLE — a fluency-2 Wilmsry passes canParley
    // for Magical (the fluency branch above, not this racial branch). Zero
    // draws, and this deliberately sits BEFORE C.parleyTried is set: a
    // refusal never consumes the one attempt.
    events.push({ type: "parleyRefused", reason: "wilmsryVsMagical" });
    return events;
  }
  C.parleyTried = true; // D-05: the one attempt is spent here — lazily written, never initialised in startCombat
  const flu = fluency(c);
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
    // D-01/D-02: parley's payout is now STRUCTURALLY half of the same
    // combat-equivalent killFoe pays (killSpFor), not a second formula.
    const combatEquivalent = liveFoes(state).reduce((sum, f) => sum + killSpFor(c, f, rng.d(6)), 0); // roll:amount
    const sp = heroSpFor(Math.round(combatEquivalent * 0.5));
    c.sp += sp;
    events.push({ type: "spGained", amount: sp, reason: "parley" });
    if (C.type === "Humans" && rng.d(6) === 6) { // roll:already-high
      // D-03: was >= 4 (50%); the AMOUNT formula stays untouched (economy owns it).
      const wm = rng.d(6) * 100 * state.floor.depth; // roll:amount
      c.gold += wm;
      events.push({ type: "goldGained", amount: wm, why: "parley" });
    }
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
 * songReady(state) — a Bard's song comes back every 100 squares. Ports
 * mazeworld.html songReady() (lines 2743-2745).
 */
export function songReady(state) {
  return state.c.sub === "Bard" && state.steps - (state.c.songAt ?? -999) >= 100;
}

/**
 * sing(state, rng, events) — the Bard's action, picking the highest song the
 * character's level allows. Ports mazeworld.html sing() (lines 2746-2770).
 */
export function sing(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "actionRefused", { action: "sing" })) return events;
  if (!C) return events;
  // CMB-02 (Phase 31): songReady() bundles "not a Bard" and "still cooling
  // down" into one silent no-op — split so each refusal names its own reason
  // (never fear-related; this is a class/cooldown gate, not a phobia refusal).
  if (!songReady(state)) {
    events.push({
      type: "actionRefused",
      action: "sing",
      reason: c.sub === "Bard" ? "cooldown" : "wrongClass",
      ...(c.sub === "Bard" ? { left: 100 - (state.steps - (c.songAt ?? -999)) } : {}),
    });
    return events;
  }
  const song = SONGS.filter((s) => s.lvl <= c.level).pop();
  c.songAt = state.steps;
  events.push({ type: "sang", song: song.n, level: song.lvl });
  const foes = liveFoes(state);
  if (song.lvl === 1) {
    if (C.type === "Beasts" || C.type === "Lair Beasts") {
      foes.forEach((f) => {
        f.alive = false;
        f.fled = true;
      });
      events.push({ type: "beastsSoothed", count: foes.length });
    } else {
      events.push({ type: "songIgnored" });
    }
  } else if (song.lvl === 2) {
    C.inspired = 1;
  } else if (song.lvl === 3) {
    const n = rng.d(6); // roll:amount
    foes.slice(0, n).forEach((f) => {
      if (f.lvl <= c.level) f.asleep = 24;
    });
    events.push({ type: "lullabyRolled", n });
  } else if (song.lvl === 4) {
    const n = rng.d(12); // roll:amount
    const r = rng.d(8); // roll:amount
    foes.slice(0, n).forEach((f) => {
      if (f.lvl <= c.level) f.asleep = r;
    });
    events.push({ type: "thunderRolled", n, r });
  } else {
    foes.forEach((f) => {
      if (f.lvl <= c.level) f.wp = 1;
    });
  }
  afterPlayerAction(state, rng, events);
  return events;
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
  if (t.asleep > 0 || t.stupid) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or stupid) creature
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
      if (t.asleep > 0 || t.stupid) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or stupid) creature
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
      const meta = pickMemberAbility(sheet, ally, C.round, foes[0]);
      if (meta) {
        resolveMemberAbility(state, ally, sheet, view, meta, foes[0], rng, events);
        continue;
      }
    }

    if (sheet.cls === "Magic User") {
      const sp = bestAttackSpell({ c: view });
      if (sp && maxCharges(view) - view.spellsUsed > 0) {
        const cur = C.foes[C.target];
        const target = cur && cur.alive ? cur : foes[0];
        allyCast(state, ally, sheet, view, sp, target, rng, events);
        continue;
      }
      // no castable attack spell or no charge left — fall through to the
      // staff swing below, on the Magic User's own to-hit.
    }
    memberStrike(state, ally, sheet, view, foes[0], rng, events);
  }
  return events;
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
 */
export function pickMemberAbility(sheet, ally, round, target) {
  const owned = Array.isArray(sheet.abilities) ? sheet.abilities : [];
  const ready = owned
    .filter((id) => ABILITY_BY_ID[id] && ABILITY_BY_ID[id].cls === sheet.cls && isReady(sheet, `ability:${id}`))
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
 * startMemberAbilityTimer(sheet, meta) — the member-sheet analog of
 * abilities.js#useAbility's own startAbilityTimer: the EXACT SAME
 * DURATION_ROUNDS/ONCE_A_FIGHT mapping, applied to a Joiner's own
 * `sheet.timers` (Phase 36) instead of the hero's `c.timers`.
 */
function startMemberAbilityTimer(sheet, meta) {
  const id = `ability:${meta.id}`;
  const cd = meta.cd === "fight" ? ONCE_A_FIGHT : meta.cd;
  const durationRounds = DURATION_ROUNDS[meta.id];
  if (durationRounds) {
    startEffect(sheet, id, { rounds: durationRounds, cd });
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
      memberStrike(state, ally, sheet, view, t, rng, events, { key: meta.id, autoHit: true, bonusDmg: ally.lvl });
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
      applyPommel(t);
      events.push({ type: "pommelStruck", target: t.name, member: ally.name });
      return;
    case "dirtyTrick":
      applyDirtyTrick(t);
      events.push({ type: "dirtyTrickLanded", target: t.name, rounds: 2, member: ally.name });
      return;
    case "poisonedEdge":
      applyPoison(t, { left: 3, dmg: { n: 1, sides: 4, bonus: 0 }, by: "poisonedEdge" });
      events.push({ type: "poisonedEdgeApplied", target: t.name, rounds: 3, member: ally.name });
      return;
    case "hamstring":
      applyHamstring(t);
      events.push({ type: "hamstrung", target: t.name, member: ally.name });
      return;
    case "mark":
      applyMark(t);
      events.push({ type: "marked", target: t.name, member: ally.name });
      return;
    case "cutpurse": {
      const amount = rng.d(10) * ally.lvl; // roll:amount
      events.push({ type: "cutpursed", target: t.name, amount, member: ally.name });
      gainWilmst(state, amount, "cutpurse", rng, events);
      return;
    }
    case "secondWind": {
      const heal = rng.d(8) + ally.lvl; // roll:amount
      const before = ally.wp;
      ally.wp = Math.min(ally.maxWP, ally.wp + heal);
      events.push({ type: "memberSecondWind", name: ally.name, amount: ally.wp - before });
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
      ally.braced = true;
      events.push({ type: "braced", member: ally.name });
      return;
    case "riposte":
      events.push({ type: "riposteReady", rounds: 1, member: ally.name });
      return;
    case "taunt":
      events.push({ type: "taunted", rounds: 1, member: ally.name });
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
 * order as an ordinary strike); `forceCrit` sets `crit` subject to the
 * member's own Guard/Soldier `noCrit` rule, with Silent Step specifically
 * denied by the heavy-armor list (mirrors `AS.forceCrit`'s `deniedByHeavy`);
 * `dmgMul` applies after the crit doubling; `allyMissed`/`allyStruck` gain
 * an additive `via: mod.key`. `t.marked`'s +2 (playerStrike's own rule)
 * applies UNCONDITIONALLY, `mod` or not — a marked foe takes +2 from every
 * striker, hero or member alike; false on every fixture (no foe is ever
 * marked before this plan's Mark ability exists).
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
  if (t.asleep > 0 || t.stupid) faces = Math.max(faces, 5); // p.27: 5 to hit a dozing (or stupid) creature
  if (t.sp && t.sp.toHit !== undefined) faces = Math.min(faces, t.sp.toHit); // hard to hit
  if (t.sp && t.sp.fast) faces = Math.max(1, faces - 1); // "roll 1 higher to strike"
  if (t.sp && t.sp.magicOnly && !view.magicWpn) faces = 0; // only magic touches it
  if (t.sp && t.sp.daggerOnly && !view.magicWpn && view.weapon !== "Dagger") faces = 0; // only a dagger or magic touches it
  if (t.mirror > 0) faces = Math.min(faces, 1); // RULES-10 (Phase 75.1): Mirror Self — the top face only
  if (mod && mod.needShift) faces = Math.max(1, faces + mod.needShift);
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
  if (shatterIfBest(state, t, roll, dieN, ally.name, rng, events)) return;
  let dmg = weaponDamage(view, rng);
  if (mod && mod.bonusDmg) dmg += mod.bonusDmg;
  const noCrit = view.sub === "Guard" || view.sub === "Soldier";
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
  if (crit) dmg *= 2;
  if (mod && mod.dmgMul) dmg *= mod.dmgMul;
  if (t.marked) dmg += 2;
  const hit = damageFoe(state, t, dmg, { kind: "ally", crit }, rng, events);
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
}

/**
 * allyCast(state, ally, sheet, view, sp, t, rng, events) — DFB-05: a Magic
 * User party member casting its best attack spell at the hero's current
 * live target. SELF-CONTAINED (magic.js already imports combat.js, so a
 * back-import here would be a cycle) — mirrors castSpell's dice shapes
 * exactly: thrown = d8 vs 4 (Freeze d10 vs 6) with the subclass school bonus
 * + eff(throw), damage = rollDice(sp.dmg) * max(1, level - sp.lvl) +
 * eff(spellDmg) through damageFoe kind "spell" (no armor draw), Freeze
 * freezes and routes through killFoe with the kill-twice unfreeze exactly
 * like the hero's Phase 23 rule; status/stun/weaken resist-check first
 * (resistRoll — only an intel >= 12 target draws) then sleep the target
 * (max(asleep, d4) rounds) or weaken the party's `C.weakened`/
 * `C.foeToHitPenalty`. The persistent sheet pays the charge
 * (`sheet.spellsUsed++`), never the transient `view`.
 */
function allyCast(state, ally, sheet, view, sp, t, rng, events) {
  sheet.spellsUsed = (sheet.spellsUsed || 0) + 1;
  const base = { name: ally.name, spell: sp.n, target: t.name };
  if (sp.kind === "thrown") {
    // Phase 40 (SPELL-01): the THIRD name-keyed Freeze check (a member cast)
    // — repointed to the data flag alongside magic.js's own two sites
    // (research Pitfall 2).
    const freeze = sp.onHit === "freeze";
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
      const mult = Math.max(1, view.level - sp.lvl);
      const dmg = rollDice(rng, sp.dmg) * mult + eff(view, "spellDmg");
      const hit = damageFoe(state, t, dmg, { kind: "spell", school: sp.kind, casterSub: view.sub }, rng, events);
      events.push({ type: "allySpellHit", ...base, effect: freeze ? "frozen" : "damage", dmg: hit.applied });
      if (freeze) {
        t.frozen = true;
        killFoe(state, t, rng, events);
        if (t.alive) t.frozen = false; // kill-twice revived it — a standing foe is not frozen
        return;
      }
      if (t.wp <= 0) killFoe(state, t, rng, events);
    } else {
      events.push({ type: "allySpellMissed", ...base, resisted: false });
    }
    return;
  }
  // status / stun / weaken — the only other ATTACK_SPELL_KINDS.
  events.push({ type: "allyCast", ...base });
  const res = resistRoll(rng, t.intel);
  if (res.rolled && res.resisted) {
    // Phase 73 (ROLL-05): resistRoll's own draw is roll-high; carry its
    // { roll, atLeast, dieN } triple alongside the existing resisted flag.
    events.push({ type: "allySpellMissed", ...base, resisted: true, roll: res.roll, atLeast: res.atLeast, dieN: res.dieN });
    return;
  }
  if (sp.kind === "weaken") {
    // Phase 40 (SPELL-01): a member's own Weaken cast starts the SAME
    // `spell:weaken` rounds-cadence record, on the HERO's own `state.c`
    // (party-wide duration lives in one place) — its own d4+1 draw, after
    // the resist roll above.
    const C = state.combat;
    const rounds = rng.d(4) + 1; // roll:amount
    if (C) {
      C.weakened = true;
      C.foeToHitPenalty = 3;
      startEffect(state.c, "spell:weaken", { rounds });
    }
    events.push({ type: "allySpellHit", ...base, effect: "weakened", rounds });
  } else {
    t.asleep = Math.max(t.asleep || 0, rng.d(4)); // roll:amount
    events.push({ type: "allySpellHit", ...base, effect: "asleep", rounds: t.asleep });
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
  if (taunter) return taunter;
  const pick = rng.d(liveMembers.length + 1); // roll:selection
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
 *   - `applied` (additive return field, on EVERY branch): the amount
 *     actually subtracted from `c.wp` this call (0 on every early-return
 *     branch — reflect-kill, `dmg <= 0`, armor-soaked — and the final landed
 *     `dmg` on both tail returns).
 */
export function applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, atLeast, dieN, mods, ignoresArmor, ability }) {
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
  if (state.combat && state.combat.braced && dmg > 0) {
    const before = dmg;
    dmg = Math.ceil(dmg / 2);
    state.combat.braced = false;
    soaked.brace = before - dmg;
    events.push({ type: "braceHeld", name: foe.name, soaked: before - dmg });
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
    const critical = isBestFace(roll, dieN);
    const soldierCrit = roll === dieN - 1 && c.sub === "Soldier";
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
    });
  }
  if (c.wp <= 0) {
    die(state, "combat", foe.name, rng, events);
    return { died: true, onArmour: false, applied: dmg };
  }
  return { died: false, onArmour: false, applied: dmg };
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
      c.wp = Math.min(c.maxWP, c.wp + regen);
      events.push({ type: "regenerated", amount: regen, ...(regen !== r ? { halved: true } : {}) });
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
    if (C.selfDot.left <= 0) {
      const { spell, then } = C.selfDot;
      delete C.selfDot;
      // "then 'heavy'" (Ice): the last tick leaves the hero standing, so the
      // promised freeze lands as the heavy blow instead of an automatic
      // death — never both a burn AND a separate kill for the same fumble.
      if (then === "heavy") {
        const blow = fumbleHeavyBlow(state, spell, "frozen", rng, events);
        if (blow.died) return events;
      }
    }
  }
  for (const f of C.foes) {
    if (f.acid && f.acid.rounds > 0) {
      const d = rollDice(rng, f.acid.dmg);
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
    // exact f.acid tick template above, so Phase 40's spells can share the
    // same `f.dot = { left, dmg, by }` shape. Poison bypasses armour like
    // acid (kind "spell"). Absent on every fixture — only useAbility's
    // "poisonedEdge" case ever sets f.dot.
    if (f.dot && f.dot.left > 0 && f.alive) {
      const d = rollDice(rng, f.dot.dmg);
      const tick = damageFoe(state, f, d, { kind: "spell", school: f.dot.by, casterSub: c.sub }, rng, events);
      // Captured before the delete below — `by` is the switch the ice payoff
      // reads (Phase 40, SPELL-01), so Poisoned Edge's own dot is unaffected.
      const by = f.dot.by;
      f.dot.left--;
      const dotRanOut = f.dot.left <= 0;
      events.push({ type: "dotTick", target: f.name, dmg: tick.applied, by, left: f.dot.left });
      if (dotRanOut) delete f.dot;
      if (f.wp <= 0 && f.alive) {
        killFoe(state, f, rng, events);
        continue;
      }
      // Phase 40 (SPELL-01, Ice) — the promised "then frozen solid": when the
      // ICE dot's last tick leaves the foe still standing, it freezes solid
      // and dies through killFoe (pays like any other kill), mirroring the
      // thrown Freeze branch's own frozen/killFoe/revive lines exactly.
      // Zero extra draws before killFoe's own.
      if (dotRanOut && by === "ice" && f.alive) {
        f.frozen = true;
        events.push({ type: "frozenSolid", target: f.name });
        killFoe(state, f, rng, events);
        if (f.alive) f.frozen = false; // kill-twice revived it — a standing foe is not frozen
        continue;
      }
    }
    if (!f.alive) continue;
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
      events.push({ type: "foeSlept", name: f.name });
      continue;
    }
    // Phase 40 (SPELL-01, Stupidity) — a stupid foe skips EVERY turn for the
    // rest of the fight: no counter (f.stupid never clears itself — only the
    // foe's own death or the fight's end retires it), placed directly after
    // the asleep block, mirroring Pommel Strike's f.stunned skip immediately
    // below. A foe cannot be both asleep and stupid-skipped the same turn
    // (the asleep branch's own `continue` already exited).
    if (f.stupid) {
      events.push({ type: "foeStupefied", name: f.name });
      continue;
    }
    // Phase 38 (ABIL-01, Pommel Strike) — f.asleep's own skip-turn pattern,
    // reused verbatim: a stunned foe loses this ONE turn, then the flag
    // clears (no counter needed — a single stun, not a duration). Absent on
    // every fixture — only useAbility's "pommelStrike" case ever sets it.
    if (f.stunned) {
      f.stunned = false;
      events.push({ type: "foeStunned", name: f.name });
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
        continue;
      }
      if (neverMelee) {
        events.push({ type: "foeOutOfSpells", name: f.name });
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
        // SIMPLIFIED member branch: no ward/armor/mirror/Hardiness (all
        // hero-only machinery), no die(). Same to-hit shape, then straight to
        // the member's own `wp`; a member at 0 wp is downed + departs.
        const mDieN = foeDie(c, f);
        // Phase 38 (ABIL-02): a party member is its own body — Battle Roar
        // (party-wide) still applies, but Sidestep/Smoke (the hero's own
        // body) do not, hence `vs = "member"`.
        // Phase 73 (ROLL-05): the need chain is pure arithmetic (zero rng)
        // and now sits above the strike draw. `mNeed` -> `mFaces`,
        // `mNeedMods` -> `mMods`.
        let mFaces = foeToHitVs(state, "member");
        // Phase 25 (FEED-01, additive payload): same breakdown + post-mods
        // pattern as the hero branch below — narration only, 0 new draws.
        const mMods = foeToHitBreakdown(state, "member").mods.slice();
        if (f.blind) {
          const before = mFaces;
          mFaces = 1;
          if (mFaces !== before) mMods.push({ name: "blind", delta: mFaces - before });
        }
        if (C.foeToHitPenalty) {
          const before = mFaces;
          mFaces = Math.min(mFaces, C.foeToHitPenalty);
          if (mFaces !== before) mMods.push({ name: "penalty", delta: mFaces - before });
        }
        // Phase 38 (ABIL-05): a member is its own body — its OWN Sidestep/
        // Smoke shift its own need, exactly like the hero's equivalent terms
        // in foeToHitVs("hero") (which this "member" vs never reads). Pure
        // reads of the member's own persistent sheet.timers; false on every
        // fixture (no fixture carries a party).
        const mSheet = Array.isArray(state.party) ? state.party[member.partyIdx] : null;
        if (mSheet && abilityEffectActive(mSheet, "sidestep")) {
          const before = mFaces;
          mFaces = Math.max(1, mFaces - 2);
          if (mFaces !== before) mMods.push({ name: "Sidestep", delta: mFaces - before });
        }
        if (mSheet && abilityEffectActive(mSheet, "smoke")) {
          const before = mFaces;
          mFaces = 1;
          if (mFaces !== before) mMods.push({ name: "Smoke", delta: mFaces - before });
        }
        if (C.parleyInsulted) {
          // PARLEY-02 / D-06 / D-20 + Phase 72 ROLL-01 (a), user ruling
          // 2026-09-24: the insult is the LAST need term on every foe swing
          // (hero branch, member branch and pursuitStrike), so an override
          // (Smoke / Mirror / invisible / blind) resets the need first and
          // the insult then adds its one face on top. Post-draw arithmetic,
          // zero draws.
          const before = mFaces;
          mFaces += 1;
          mMods.push({ name: "insulted", delta: mFaces - before });
        }
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
        const mCritical = isBestFace(mRoll, mDieN);
        const mDice = f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6); // roll:amount
        let mDmg = foeHitFor(foeLevelBase(f) + (mCritical ? 2 * mDice : mDice), curve);
        if (C.weakened) mDmg = Math.ceil(mDmg / 2);
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
        // Phase 38 (ABIL-05, Brace) — a single-charge buffer on the member's
        // OWN transient combat entry, mirroring applyFoeDamageToPlayer's
        // `state.combat.braced` pattern exactly. Pure (no rng); false on
        // every fixture (only resolveMemberAbility's "brace" case ever sets
        // it).
        if (member.braced && mDmg > 0) {
          const before = mDmg;
          mDmg = Math.ceil(mDmg / 2);
          member.braced = false;
          events.push({ type: "braceHeld", name: f.name, member: member.name, soaked: before - mDmg });
        }
        // Phase 54 (BAND-02, USER RULING D): ROUND_DAMAGE_CEILING, applied
        // after every existing halving, before the member's wp is touched.
        mDmg = Math.min(mDmg, Math.max(0, roundDamageCapFor(c.level) - dealtThisVisit));
        dealtThisVisit += mDmg;
        member.wp -= mDmg;
        events.push({
          type: "memberStruck",
          name: f.name,
          member: member.name,
          dmg: mDmg,
          roll: mRoll,
          atLeast: mAtLeast,
          dieN: mDieN,
          critical: mCritical,
          ...(mCritical ? { critAtLeast: mDieN } : {}),
          ...(mMods.length ? { mods: mMods } : {}),
        });
        if (member.wp <= 0) downMember(state, member, events);
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
      const crit = roll >= atLeastFor(c.sub === "Soldier" ? 2 : 1, dieN);
      const dice = f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6); // roll:amount
      let dmg = foeHitFor(foeLevelBase(f) + (crit ? 2 * dice : dice), curve);
      if (C.weakened) dmg = Math.ceil(dmg / 2);
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

      const hit = applyFoeDamageToPlayer(state, f, rng, events, { dmg, roll, atLeast, dieN, mods });
      if (hit.died) return events;
    }
    // Phase 38 (ABIL-01, Dirty Trick) — the blindFor countdown, at the END
    // of this foe's own visit (after its swings, whether it swung or was
    // asleep/stunned/dot-killed above): a spell-blinded foe (no blindFor)
    // stays blind indefinitely, exactly as before. Absent on every fixture.
    if (f.blindFor) {
      f.blindFor--;
      if (f.blindFor <= 0) {
        delete f.blindFor;
        f.blind = false;
        events.push({ type: "foeSightReturned", name: f.name });
      }
    }
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
    events.push({ type: "foeEffectFaded", kind: c.foeEffect.kind });
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
