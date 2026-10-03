// engine/abilities.js
//
// Phase 38 (ABIL-01/04) — useAbility { key }, the melee-active-abilities
// dispatcher: parallel to engine/magic.js#castSpell, this is the ONE engine
// action every ABILITIES submenu row (Plan 05) and every Joiner's
// class-driven use policy (Plan 04) will drive.
//
// Refusal ladder (CMB-01/CMB-02 discipline, mirroring castSpell): notFought
// (refuseIfPending, FIRST) -> unknown (not in the catalog, or not owned) ->
// notInCombat -> cooldown (or spent, a used once-per-fight ability — quick
// 260927-opf; Phase 91.1 plan 02: only Death Touch, Silent Step and Cutpurse
// are still once per fight) -> noTarget (structurally unreachable in combat,
// same reasoning castSpell's own comment documents — normalizeTarget always
// finds a live foe while state.combat exists) -> tooFewFoes (Sweep with
// fewer than SWEEP_MIN_FOES living foes, quick 260928-nrf) -> alreadyOn
// (Hamstring or Mark on a foe that already carries it, Phase 91.1 plan 02) ->
// notLowEnough (Last Stand's own gate). A refusal is a single event, spends no action, starts no timer,
// and never touches state.rngState (no draw ever happens before the ladder
// clears).
//
// Round economy (CONTEXT "Action economy: using an ability is the round's
// action"): a success resolves in the SAME dispatch and ends the round
// exactly once. The eight strike-modifying abilities (kata/feint/deathTouch/
// silentStep/overheadBlow/lastStand, since Phase 90 pommelStrike, and since
// Phase 91.1 plan 02 cutpurse) delegate ENTIRELY to
// combat.js#playerStrike — which already tail-calls afterPlayerAction — so
// this module must NEVER also call afterPlayerAction on that branch (a
// double call would double-run the foe's turn, RESEARCH's own named
// pitfall). Every other kind resolves its own effect directly and calls
// afterPlayerAction itself, exactly once, at its own tail.
//
// Cooldown model (Phase 36 c.timers, id = "ability:<key>"): an immediate
// (non-duration) ability is a plain startCooldown; a duration ability
// (sidestep/battleRoar/riposte/taunt/smoke) is a startEffect carrying its
// own `cd` and abilityEffectTicks' length (quick 260928-hrs: the stated
// rounds after the use round, plus the use round's own tick), so
// effects.js's own duration -> cooldown transition (tickRounds,
// already wired at foeTurn's tail since Phase 36) flips it the instant the
// effect runs out — no bespoke bookkeeping here. `cd: "fight"` maps to
// ONCE_A_FIGHT (999) rounds, cleared unconditionally by endCombat's existing
// clearRoundTimers, so every ability is READY at the start of every fight.
//
// The transient state.combat.abilityStrike descriptor and the three
// abilityEffectActive-driven foeToHitVs/foeToHitBreakdown need-shift terms
// (both Plan 02) already exist and are already read by playerStrike/
// derived.js — this module is simply the first thing that SETS them.
// applyPommel/applyDirtyTrick/applyPoison/applyHamstring/applyMark are
// exported as the shared foe-flag appliers Plan 04's Joiner policy reuses
// verbatim — a Joiner's own ability use sets the exact same flags on the
// exact same foe object shape.

import { ABILITY_BY_ID, ONCE_A_FIGHT } from "../content/index.js";
import { derivedRng } from "./rng.js";
import { startEffect, startCooldown, isReady } from "./effects.js";
import { refuseIfPending, normalizeTarget, playerStrike, afterPlayerAction, liveFoes, killFoe } from "./combat.js";
import { damageFoe } from "./foeDamage.js";
import { weaponDamage, DEATH_PANIC_THRESHOLD } from "./derived.js";
import { gainWilmst } from "./items.js";

/**
 * DURATION_ROUNDS — the duration abilities' effect-phase length (rounds).
 * Every ability NOT listed here is an "immediate" kind: a plain cooldown
 * with no effect phase of its own (its `cd` IS its readiness gate).
 * Exported (Plan 04, ABIL-05) so combat.js#resolveMemberAbility's own
 * startMemberAbilityTimer can apply the EXACT SAME mapping to a Joiner's own
 * sheet.timers, rather than duplicating the table.
 */
export const DURATION_ROUNDS = { sidestep: 2, battleRoar: 2, riposte: 1, taunt: 2, smoke: 2 };

/**
 * THIS_ROUND_ABILITIES — the duration abilities whose text counts the round
 * they are used in as the first of their rounds: Taunt ("every foe swings at
 * you this round and the next"). Phase 91.1 plan 02 (user ruling V8 B, 2026-10-01):
 * Taunt lasts two rounds, so its timer starts at DURATION_ROUNDS.taunt (2): the
 * foe turn that follows the use in the same dispatch, then the next one, and
 * the chip reads 1 right after the use.
 */
export const THIS_ROUND_ABILITIES = Object.freeze(new Set(["taunt"]));

/**
 * BRACE_BLOWS — Phase 91.1 plan 02 (user ruling V8 B, 2026-10-01): the landed
 * blows one Brace halves (was one). The count rides on the existing `braced`
 * combat flag (hero) and `ally.braced` (a Joiner): a number of blows left,
 * decremented by each blow that lands, gone at 0. A flag saved as `true` by an
 * older build reads as one blow left (Number(true) is 1).
 */
export const BRACE_BLOWS = 2;

/**
 * POISON_ROUNDS and POISON_DIE — Phase 91.1 plan 02 (user ruling V9 B,
 * 2026-10-01): Poisoned Edge ticks d4 + the user's level a round for three
 * rounds, no roll to hit. The die and the rounds are unchanged; the level
 * (the hero's `c.level`, a Joiner's own level) is stamped into the record's
 * `dmg.bonus` when the edge is applied, so rollDice adds it with no new draw.
 */
export const POISON_ROUNDS = 3;
export const POISON_DIE = 4;

/**
 * abilityEffectTicks(key) — quick 260928-hrs (user ruling 2026-09-28: "Smoke
 * ability says it lasts for 2 rounds, but whenever I use it, the chit shows
 * 1 rds"): the effect-phase length a duration ability's timer starts with.
 * Using an ability IS the round's action, so the same dispatch's foeTurn
 * swings (covered by the effect) and then ticks the fresh timer once (the
 * Phase 38 "one-tick-already-spent" invariant). A "for N rounds" ability
 * (Sidestep, Battle Roar, Smoke: two; Riposte: one) therefore starts at
 * N + 1: it covers the foes' swing in the round it was used, then N full
 * rounds after it, and its chip reads N right after use, counting down
 * N -> ... -> 1 -> gone. Before this ruling it started at N, so it covered
 * the use round plus only N - 1 more and the chip first read N - 1 (Smoke's
 * "1 rds"; a Riposte's chip never showed at all). A THIS_ROUND_ABILITIES
 * entry starts at its DURATION_ROUNDS (1): the use round only, unchanged.
 * 0 for a non-duration ability. Exported so combat.js#startMemberAbilityTimer
 * applies the same length to a Joiner's own sheet.timers. Pure, no rng.
 */
export function abilityEffectTicks(key) {
  const n = DURATION_ROUNDS[key];
  if (!n) return 0;
  return THIS_ROUND_ABILITIES.has(key) ? n : n + 1;
}

/**
 * SWEEP_MIN_FOES — quick 260928-nrf (user ruling 2026-09-28, "Sweep needs 2+
 * foes"): the fewest living foes a Sweep may be used against. The
 * 260928-abl audit found Sweep hit a single foe 73% of the time, which made
 * it a guaranteed half-damage strike that ignored the to-hit roll.
 */
export const SWEEP_MIN_FOES = 2;

/**
 * KATA_FEINT_NEED_SHIFT — quick 260928-nrf (user ruling 2026-09-28, "Kata
 * and Feint roll to hit"): the winning faces Kata and Feint ADD to the
 * strike roll, replacing their old auto-hit. The 260928-abl audit measured
 * plain level-1 swings landing about 17% (Fighter) and 34% (Thief) of the
 * time, which made a "cannot miss" strike most of the class's killing.
 * Shared with combat.js#resolveMemberAbility (a Joiner's Kata/Feint).
 */
export const KATA_FEINT_NEED_SHIFT = 3;

/**
 * abilityShortfall(key, liveCount) — the ONE ability-availability rule that
 * depends on the fight rather than the timers: `"tooFewFoes"` for Sweep
 * with fewer than SWEEP_MIN_FOES living foes, else `null`. The hero
 * (useAbility's refusal ladder), the combat menu, a Joiner
 * (combat.js#pickMemberAbility) and the bot (tuning-bot.mjs#chooseAbility)
 * all read this, so none of them re-derives the rule. Pure, no rng.
 */
export function abilityShortfall(key, liveCount) {
  if (key === "sweep" && liveCount < SWEEP_MIN_FOES) return "tooFewFoes";
  return null;
}

/**
 * abilityReadyAfter(key) — Phase 91.1 plan 02 (user rulings V1 to V5,
 * 2026-10-01): the rounds after the use round an ability is usable again, the
 * ONE read of "ready again N rounds after you use it" (the text guard, the
 * menu tests and the Joiner pins read this, never a number typed twice). An
 * ability used in round R is usable again in round R + N: the use round's own
 * foe turn ticks the fresh timer once, so a plain cooldown of `cd` rounds is
 * `cd`, and a duration ability (Smoke) runs its effect first (abilityEffectTicks
 * rounds) and its cooldown after, so it is the two added. `null` for a
 * once-per-fight ability (`cd: "fight"`: no wait, spent until the fight ends)
 * and for an id not in the catalog. Pure, no rng.
 */
export function abilityReadyAfter(key) {
  const meta = ABILITY_BY_ID[key];
  if (!meta || meta.cd === "fight") return null;
  return abilityEffectTicks(key) + meta.cd;
}

/**
 * abilityTargetShortfall(key, foe) — Phase 91.1 plan 02 (V5): `"alreadyOn"`
 * for Hamstring on a foe that is already hamstrung and Mark on a foe that is
 * already marked, else `null`. Hamstring and Mark come back 3 rounds after the
 * use, but only to work a foe that does not carry the effect yet (a second foe
 * in a crowd); the hero (useAbility), the combat menu, a Joiner
 * (combat.js#pickMemberAbility) and the bot all read this one rule. Reads the
 * foe's own flag, not the timer, so a flag a Joiner set counts too. Pure, no
 * rng.
 */
export function abilityTargetShortfall(key, foe) {
  if (!foe) return null;
  if (key === "hamstring" && foe.hamstrung) return "alreadyOn";
  if (key === "mark" && foe.marked) return "alreadyOn";
  return null;
}

/**
 * abilityUnavailableReason(state, key) — abilityShortfall against the
 * current fight's living foes. `null` outside a fight (the ladder's own
 * notInCombat refusal covers that). Pure, no rng.
 */
export function abilityUnavailableReason(state, key) {
  if (!state || !state.combat) return null;
  return abilityShortfall(key, liveFoes(state).length);
}

/**
 * startAbilityTimer(c, meta) — the ONE cooldown-dispatch site every
 * successful useAbility call runs, per this plan's cooldown_model.
 */
function startAbilityTimer(c, meta) {
  const id = `ability:${meta.id}`;
  const cd = meta.cd === "fight" ? ONCE_A_FIGHT : meta.cd;
  const ticks = abilityEffectTicks(meta.id);
  if (ticks) {
    startEffect(c, id, { rounds: ticks, cd });
  } else {
    startCooldown(c, id, { rounds: cd });
  }
}

/**
 * abilityRoundsLeft(c, key) — "how long until this is usable again" (Plan
 * 05's submenu cost string): the effect phase's remaining rounds PLUS its
 * own cooldown, or just the cooldown's remaining rounds when there is no
 * effect phase (an immediate ability, or a duration ability already ticked
 * into its cooldown phase). `0` when the ability is READY (no record).
 */
export function abilityRoundsLeft(c, key) {
  const rec = c.timers && c.timers[`ability:${key}`];
  if (!rec) return 0;
  return rec.phase === "effect" && rec.cd ? rec.left + rec.cd : rec.left;
}

/**
 * ABILITY_UNAVAILABLE_REASONS — Phase 94 (ASTATE-04): every reason
 * abilityState can give for an "unavailable" ability, in the refusal
 * ladder's own order (notFought first). Frozen; the view maps each to words.
 */
export const ABILITY_UNAVAILABLE_REASONS = Object.freeze(["notFought", "unknown", "notInCombat", "noTarget", "tooFewFoes", "alreadyOn", "notLowEnough"]);

/**
 * abilityState(state, sheet, key) — Phase 94 (ASTATE-04): the one derived
 * answer to "can this ability be used, and if not, why". Returns
 * `{ state, roundsLeft, reason }` with state one of "ready" | "recharging" |
 * "unavailable" | "spent": recharging carries the rounds left (reason
 * "cooldown"), spent is a once-per-fight ability used this fight (reason
 * "spent"), unavailable carries one of ABILITY_UNAVAILABLE_REASONS, ready has
 * roundsLeft 0 and reason null. It mirrors useAbility's refusal ladder rung
 * for rung, in the ladder's own order, so a tap always agrees with the label
 * (ROADMAP criterion 4); useAbility and the view both read it. Takes any
 * sheet: the hero (`state.c`, aimed at `combat.target`) or a Joiner
 * (`state.party[i]`, aimed at the first live foe as alliesTurn does, and its
 * Last Stand gated on its live combat entry's hp). Pure: no rng, writes
 * nothing (never retargets a dead `combat.target`), stores nothing (so no
 * `*Comparable()` carve-out). No class check (pickMemberAbility's filter) and
 * no heroOut check (that menu shape never shows ability rows). The view maps
 * it to words in src/browser/abilityStates.js (plan 94-03).
 */
export function abilityState(state, sheet, key) {
  const unavailable = (reason) => ({ state: "unavailable", roundsLeft: 0, reason });
  const C = state && state.combat;
  if (C && C.pending) return unavailable("notFought");
  const meta = typeof key === "string" ? ABILITY_BY_ID[key] : null;
  const owned = !!meta && !!sheet && Array.isArray(sheet.abilities) && sheet.abilities.includes(key);
  if (!owned) return unavailable("unknown");
  if (!C) return unavailable("notInCombat");
  if (!isReady(sheet, `ability:${key}`)) {
    if (meta.cd === "fight") return { state: "spent", roundsLeft: 0, reason: "spent" };
    return { state: "recharging", roundsLeft: abilityRoundsLeft(sheet, key), reason: "cooldown" };
  }
  // Never liveFoes(state) here: a combat with no foes array must not throw.
  const live = Array.isArray(C.foes) ? C.foes.filter((f) => f && f.alive) : [];
  const needsFoe = meta.target === "foe" || meta.target === "foes";
  if (needsFoe && !live.length) return unavailable("noTarget");
  if (abilityShortfall(key, live.length)) return unavailable(abilityShortfall(key, live.length));
  if (needsFoe) {
    // The hero's aim is combat.target when it is a live foe, else the first live foe (what
    // useAbility's normalizeTarget would settle on, computed here without moving it); a Joiner
    // is always handed the first live foe (combat.js#alliesTurn).
    const t = sheet === state.c ? C.foes[C.target] : null;
    const aimed = t && t.alive ? t : live[0];
    if (abilityTargetShortfall(key, aimed) === "alreadyOn") return unavailable("alreadyOn");
  }
  if (key === "lastStand") {
    let hp = sheet.wp;
    let max = sheet.maxWP;
    if (sheet !== state.c && Array.isArray(C.allies) && Array.isArray(state.party)) {
      const ally = C.allies.find((a) => a && state.party[a.partyIdx] === sheet);
      if (ally) {
        hp = ally.wp;
        max = ally.maxWP;
      }
    }
    if (hp > max * DEATH_PANIC_THRESHOLD) return unavailable("notLowEnough");
  }
  return { state: "ready", roundsLeft: 0, reason: null };
}

/** applyPommel(t) — Pommel Strike: the target loses its next turn (foeTurn's
 * f.asleep skip-turn pattern, Task 2). Since Phase 90 (ABIL-07) it is applied
 * by combat.js#playerStrike (the hero) and #memberStrike (a Joiner Fighter)
 * after a landed blow of a `stunOnHit` strike that leaves the target
 * standing, never by this module directly. */
export function applyPommel(t) {
  t.stunned = true;
}

/** applyDirtyTrick(t) — Dirty Trick: blinded for two rounds. Reuses the
 * EXISTING f.blind foeToHitVs/foeTurn hooks; f.blindFor is the NEW countdown
 * foeTurn ticks and clears (Task 2), restoring sight. Shared with Plan 04.
 * Phase 90 plan 04 (SPELL-12): a foe already blind with NO countdown (the
 * Blind spell's fight-long blindness) gets no countdown from a Dirty Trick,
 * so the trick can never restore its sight.
 * Phase 90 plan 10 (ABIL-06): returns the rounds the trick put on the foe: 2, or
 * 0 for a foe already blind for the fight (the trick adds nothing, so the
 * `dirtyTrickLanded` line says so instead of promising "two rounds"; the
 * countdown itself is combat.js#tickBlindFor). */
export function applyDirtyTrick(t) {
  const fightLong = t.blind === true && !t.blindFor;
  t.blind = true;
  if (!fightLong) t.blindFor = 2;
  return fightLong ? 0 : 2;
}

/** applyPoison(t, dot) — Poisoned Edge: a generic per-foe DOT record
 * ({ left, dmg, by }) ticked in foeTurn (Task 2) — the mechanism Phase 40's
 * spells will share (CONTEXT). Shared with Plan 04. */
export function applyPoison(t, dot) {
  t.dot = dot;
}

/**
 * poisonedEdgeDot(level) — Phase 91.1 plan 02 (V9): the DOT record Poisoned
 * Edge lays on a foe for a user of this level: POISON_ROUNDS ticks of d4 +
 * level. The ONE builder the hero (useAbility) and a Joiner
 * (combat.js#resolveMemberAbility) share. Pure, no rng.
 */
export function poisonedEdgeDot(level) {
  return { left: POISON_ROUNDS, dmg: { n: 1, sides: POISON_DIE, bonus: level }, by: "poisonedEdge" };
}

/** applyHamstring(t) — Hamstring: the target's own blows do half damage for
 * the rest of the fight (foeTurn's damage sites, Task 2). Shared with
 * Plan 04. */
export function applyHamstring(t) {
  t.hamstrung = true;
}

/**
 * applyMark(t, level) — Mark: every strike on this target adds the marker's
 * level in damage (was +2; Phase 91.1 plan 02, user ruling V10 B, 2026-10-01).
 * The flag carries the level (a number >= 1) so a Joiner's strike on a foe the
 * hero marked, and the hero's on a foe a Joiner marked, adds the level of
 * whoever laid the Mark. Shared with Plan 04. markBonus reads it back.
 */
export function applyMark(t, level) {
  t.marked = Math.max(1, Math.floor(level) || 1);
}

/**
 * markBonus(t) — the damage a Mark adds to a strike on `t`: the marker's
 * level, 0 for an unmarked foe. A flag saved as `true` by an older build reads
 * as the old +2. Pure, no rng; the ONE read both playerStrike and memberStrike
 * use.
 */
export function markBonus(t) {
  if (!t || !t.marked) return 0;
  return typeof t.marked === "number" ? t.marked : 2;
}

/**
 * cutpurseGold(state, rng, level, who) — Phase 91.1 plan 02 (V11): the gold a
 * landed Cutpurse strike lifts, d10 x the user's level, rolled ONLY when the
 * blow lands and from its own derived stream (`derivedRng(<main cursor>,
 * "cutpurse", <state.acts>, <who>)`), so the strike's own draws stay exactly
 * the plain strike's and the main cursor never moves for the gold. Pure of the
 * main rng.
 */
export function cutpurseGold(state, rng, level, who) {
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  const stream = derivedRng(cursor, "cutpurse", acts, who);
  return stream.d(10) * level; // roll:amount
}

/**
 * useAbility(state, key, rng, events) — see this module's header. Resolves
 * ABILITY_BY_ID[key] by kind, per 38-03-PLAN.md's ability_effects_spec.
 */
export function useAbility(state, key, rng, events = []) {
  // CMB-01 (Phase 31 precedent): refuseIfPending is the FIRST check, before
  // any other refusal.
  if (refuseIfPending(state, events, "abilityRefused", { key })) return events;
  const c = state.c;
  const C = state.combat;
  const meta = typeof key === "string" ? ABILITY_BY_ID[key] : null;
  const owned = !!meta && Array.isArray(c.abilities) && c.abilities.includes(key);
  if (!owned) {
    events.push({ type: "abilityRefused", key, reason: "unknown", name: meta ? meta.name : undefined });
    return events;
  }
  if (!C) {
    events.push({ type: "abilityRefused", key, reason: "notInCombat", name: meta.name });
    return events;
  }
  const id = `ability:${key}`;
  // Quick 260927-opf (user ruling 2026-09-27): a once-per-fight ability
  // (`cd: "fight"`) that has been used is SPENT until the fight ends — its
  // record is cleared only by endCombat, so it refuses with `spent`, never a
  // rounds count (the ONCE_A_FIGHT figure is bookkeeping, not a wait).
  if (!isReady(c, id)) {
    if (meta.cd === "fight") events.push({ type: "abilityRefused", key, reason: "spent", name: meta.name });
    else events.push({ type: "abilityRefused", key, reason: "cooldown", name: meta.name, left: abilityRoundsLeft(c, key) });
    return events;
  }
  // Phase 36 (TGT-01) precedent, same reasoning castSpell documents: a
  // targeted ability retargets a dead C.target onto the first live foe
  // before resolving, so `noTarget` is structurally unreachable while
  // state.combat exists (an empty encounter has already cleared). Proven
  // reachable only by a hand-built zero-foe combat (test-only).
  const needsFoe = meta.target === "foe" || meta.target === "foes";
  if (needsFoe) {
    normalizeTarget(C);
    if (!liveFoes(state).length) {
      events.push({ type: "abilityRefused", key, reason: "noTarget", name: meta.name });
      return events;
    }
  }
  // Quick 260928-nrf (user ruling 2026-09-28): Sweep with fewer than two
  // living foes refuses before anything is spent — no turn, no cooldown, no
  // draw — exactly like the spent/cooldown refusals above.
  const shortfall = abilityUnavailableReason(state, key);
  if (shortfall) {
    events.push({ type: "abilityRefused", key, reason: shortfall, name: meta.name, need: SWEEP_MIN_FOES, have: liveFoes(state).length });
    return events;
  }
  // Phase 91.1 plan 02 (V5): Hamstring and Mark only on a foe that does not
  // carry the effect yet; refused before anything is spent, like the rungs above.
  if (needsFoe) {
    const t = C.foes[C.target];
    if (abilityTargetShortfall(key, t) === "alreadyOn") {
      events.push({ type: "abilityRefused", key, reason: "alreadyOn", name: meta.name, target: t.name });
      return events;
    }
  }
  if (key === "lastStand" && c.wp > c.maxWP * DEATH_PANIC_THRESHOLD) {
    events.push({ type: "abilityRefused", key, reason: "notLowEnough", name: meta.name, have: c.wp, max: c.maxWP });
    return events;
  }

  events.push({ type: "abilityUsed", key, name: meta.name });
  startAbilityTimer(c, meta);

  switch (key) {
    // Quick 260928-nrf (user ruling 2026-09-28, "Kata and Feint roll to
    // hit"): three more winning faces on the strike roll (the mirror of
    // Overhead Blow's −2), not an auto-hit. A miss is an ordinary miss and
    // the once-per-fight use is still spent (startAbilityTimer ran above).
    case "kata":
    case "feint":
      C.abilityStrike = { key, needShift: KATA_FEINT_NEED_SHIFT, bonusDmg: c.level };
      playerStrike(state, rng, events);
      return events;
    case "deathTouch":
      C.abilityStrike = { key, forceCrit: true, finishUnder: 15 };
      playerStrike(state, rng, events);
      return events;
    case "silentStep":
      C.abilityStrike = { key, autoHit: true, forceCrit: true };
      playerStrike(state, rng, events);
      return events;
    case "overheadBlow":
      C.abilityStrike = { key, dmgMul: 2, needShift: -2 };
      playerStrike(state, rng, events);
      return events;
    case "lastStand":
      events.push({ type: "lastStandCalled", attacks: 3 });
      C.abilityStrike = { key, attacks: 3 };
      playerStrike(state, rng, events);
      return events;
    // Phase 90 (ABIL-07, report #4, user ruling 2026-09-30): Pommel Strike is
    // a real strike that also stuns. The hero swings as normal (the plain
    // strike's roll, weapon damage, crits and every extra attack) and
    // playerStrike's `stunOnHit` applies applyPommel after a landed blow that
    // leaves the target standing. No draw of its own: the stun is a flag.
    case "pommelStrike":
      C.abilityStrike = { key, stunOnHit: true };
      playerStrike(state, rng, events);
      return events;
    // Phase 91.1 plan 02 (V11): Cutpurse is a normal strike (the plain
    // strike's roll and damage) that also lifts d10 x level gold when a blow
    // lands, the way Pommel Strike also stuns; playerStrike pays the gold after
    // the blow's own events (cutpurseGold, a derived stream). Still once a fight.
    case "cutpurse":
      C.abilityStrike = { key, liftGold: true };
      playerStrike(state, rng, events);
      return events;
    case "dirtyTrick": {
      const t = C.foes[C.target];
      events.push({ type: "dirtyTrickLanded", target: t.name, rounds: applyDirtyTrick(t) });
      break;
    }
    case "poisonedEdge": {
      const t = C.foes[C.target];
      applyPoison(t, poisonedEdgeDot(c.level));
      events.push({ type: "poisonedEdgeApplied", target: t.name, rounds: POISON_ROUNDS, bonus: c.level });
      break;
    }
    case "hamstring": {
      const t = C.foes[C.target];
      applyHamstring(t);
      events.push({ type: "hamstrung", target: t.name });
      break;
    }
    case "mark": {
      const t = C.foes[C.target];
      applyMark(t, c.level);
      events.push({ type: "marked", target: t.name, bonus: c.level });
      break;
    }
    case "secondWind": {
      const heal = rng.d(8) + c.level; // roll:amount
      const amount = Math.min(heal, c.maxWP - c.wp);
      c.wp += amount;
      // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
      // actually added after the clamp to max (additive, zero draws).
      events.push({ type: "secondWindHealed", amount, rolled: heal, gained: amount });
      break;
    }
    case "sweep": {
      const dmg = Math.ceil(weaponDamage(c, rng) / 2);
      events.push({ type: "swept", dmg, count: liveFoes(state).length });
      for (const f of liveFoes(state).slice()) {
        const hit = damageFoe(state, f, dmg, { kind: "melee", casterClass: c.cls, casterSub: c.sub, crit: false }, rng, events);
        if (!hit.soaked) events.push({ type: "sweptFoe", target: f.name, dmg: hit.applied });
        if (f.wp <= 0) killFoe(state, f, rng, events);
      }
      break;
    }
    case "brace":
      C.braced = BRACE_BLOWS;
      events.push({ type: "braced", blows: BRACE_BLOWS });
      break;
    case "riposte":
      events.push({ type: "riposteReady", rounds: 1 });
      break;
    case "taunt":
      events.push({ type: "taunted", rounds: DURATION_ROUNDS.taunt });
      break;
    case "sidestep":
      events.push({ type: "sidestepped", rounds: 2 });
      break;
    case "battleRoar":
      events.push({ type: "battleRoarRaised", rounds: 2 });
      break;
    case "smoke":
      events.push({ type: "smokeThrown", rounds: 2 });
      break;
    default:
      break;
  }
  // Non-strike tail: one afterPlayerAction call, mirroring castSpell's own
  // tail-call pattern exactly. The strike-modifying branches above already
  // returned via playerStrike's own tail — this line is never reached twice
  // for one dispatch.
  if (state.combat) afterPlayerAction(state, rng, events);
  return events;
}
