// engine/foeAbilities.js
//
// Phase 19 (FOE-01..09) — the foe-side ability resolver: readiness (every/
// uses/heal/summon caps), the per-visit cooldown tick, and the five effect
// kinds (bolt/drain/debuff/heal/summon), including the hero's Intelligence
// resistance (via engine/derived.js#resistRoll) and party-member targeting
// (via engine/combat.js#pickFoeTarget). Pure: every function here takes an
// explicit `state`/`f`/`rng`/`events` — no DOM, no Math.random, no Date, no
// localStorage — and every rng draw is gated behind a foe's own `abilities`
// kit (content/foe-abilities.js), so an ability-less foe never reaches this
// module at all (engine/combat.js#foeTurn's `if (f.abilities && ...)` gate).
//
// Assumption-delta (this plan): the noun "spellcaster" transitions singular
// -> plural. This module is a SEPARATE, foe-shaped resolver (kit order,
// cooldowns, per-encounter uses, no charges/grimoire) placed NEXT TO
// engine/magic.js#castSpell, sharing exactly one primitive (`resistRoll`)
// and the existing damage/targeting seams — castSpell itself is never
// generalized (FOE-01's explicit boundary).
//
// Import direction (D-17): engine/combat.js -> engine/foeAbilities.js ->
// engine/derived.js. This module imports FROM engine/combat.js (pickFoeTarget,
// applyFoeDamageToPlayer, downMember, liveFoes) — an ESM cycle of the same
// shape engine/items.js <-> engine/combat.js already has; only function
// declarations cross it, resolved at call time, so the cycle is inert.

import { FOE_ABILITIES, BESTIARY } from "../content/index.js";
import { rollDice } from "./dice.js";
import { resistRoll } from "./derived.js";
import { difficultyCurve, abilityCadenceFor } from "./difficulty.js";
import { pickFoeTarget, applyFoeDamageToPlayer, downMember, liveFoes } from "./combat.js";

const BY_ID = new Map(FOE_ABILITIES.map((a) => [a.id, a]));
// The three kinds p.25's resistance check can ever apply to (FOE-07/D-07) —
// heal and summon are unresisted/untargeted by design (D-02/D-12).
const RESISTIBLE = new Set(["bolt", "drain", "debuff"]);
const SUMMON_MAX_LIVE = 4; // FOE-04/D-12: a room never holds more than 4 live foes

/**
 * tickAbilityCooldowns(state, f) — advances every `every`-bearing kit
 * entry's cooldown by one visit (D-20/A3): lazily initializes `f.cd[id]` to
 * `abilityCadenceFor(a, curve).every` on the FIRST evaluation, then
 * decrements (floored at 0). An `every: N` ability is therefore ready on
 * the foe's Nth visit, resets to N on cast (resolveFoeAbility), and fires
 * again on the (N*2)th. Entries without `every` (uses-only or unbounded
 * abilities) and unknown ids are skipped. Pure arithmetic — 0 rng draws,
 * always.
 *
 * DELIBERATE RULES CHANGE (Phase 21, TUNE-01, D-03/D-18): the signature
 * grew a `state` parameter so the lazy-init can read `abilityThreat` off
 * the curve — deep floors shorten `every` (raise `uses`, read at the
 * resolveFoeAbility/firstReadyAbility call sites); the kits in
 * content/foe-abilities.js are unchanged data. At `abilityThreat === 1`
 * (depth <= 5, D-19) this reproduces `a.every` exactly, so every D-15
 * pinned cooldown number is untouched.
 */
export function tickAbilityCooldowns(state, f) {
  const curve = difficultyCurve(state.floor.depth);
  for (const id of f.abilities) {
    const a = BY_ID.get(id);
    if (!a || a.every === undefined) continue;
    if (!f.cd) f.cd = {};
    if (f.cd[id] === undefined) f.cd[id] = abilityCadenceFor(a, curve).every; // D-20 lazy init
    f.cd[id] = Math.max(0, f.cd[id] - 1);
  }
}

/**
 * firstReadyAbility(state, f) — the FIRST descriptor in `f.abilities` order
 * that is ready to fire this visit (D-04 kit-order cast priority), or `null`
 * if nothing is. Not ready when: the id is unknown (skipped silently, never
 * throws); `every` is defined and the cooldown (post-tick) is still above 0;
 * `uses` is defined and the remaining-uses counter (scaled by
 * `abilityCadenceFor`, D-03) has reached 0; the kind is `heal` and the foe
 * is already at full wp; or the kind is `summon` and either a summon is
 * already pending or the room already holds `SUMMON_MAX_LIVE` live foes. A
 * capped summon/heal never wastes the foe's turn — it simply falls through
 * to the next kit entry (or the melee path). Pure read — 0 rng draws.
 */
export function firstReadyAbility(state, f) {
  const curve = difficultyCurve(state.floor.depth);
  for (const id of f.abilities) {
    const a = BY_ID.get(id);
    if (!a) continue; // unknown id: skip silently
    if (a.every !== undefined && f.cd && f.cd[id] > 0) continue;
    if (a.uses !== undefined && (f.uses?.[id] ?? abilityCadenceFor(a, curve).uses) <= 0) continue;
    if (a.kind === "heal" && f.wp >= f.maxWP) continue;
    if (a.kind === "summon") {
      const C = state.combat;
      if (C.pendingFoes && C.pendingFoes.length) continue;
      if (liveFoes(state).length >= SUMMON_MAX_LIVE) continue;
    }
    return a;
  }
  return null;
}

/**
 * heroResist(rng, c, f, a, events) — FOE-07/D-07: the ONE resist check every
 * hero-targeted bolt/drain/debuff runs, via the shared `resistRoll` helper
 * (engine/derived.js). Pushes `heroResisted`/`heroResistFailed` only when a
 * roll actually happened (hero intel >= 12 — resistRoll's own gate); returns
 * `true` when the effect is fully resisted (0 further effect, no further
 * draw). Never called for heal/summon or a member-targeted bolt/drain. Phase
 * 73 (ROLL-05): both events carry resistRoll's { roll, atLeast, dieN } triple
 * alongside `intel`.
 */
function heroResist(rng, c, f, a, events) {
  const res = resistRoll(rng, c.intel);
  if (res.rolled && res.resisted) {
    events.push({ type: "heroResisted", name: f.name, ability: a.id, roll: res.roll, atLeast: res.atLeast, dieN: res.dieN, intel: c.intel });
  } else if (res.rolled) {
    events.push({ type: "heroResistFailed", name: f.name, ability: a.id, roll: res.roll, atLeast: res.atLeast, dieN: res.dieN, intel: c.intel });
  }
  return res.rolled && res.resisted;
}

/**
 * resolveFoeAbility(state, f, a, rng, events) — fires a ready ability
 * (D-06: `foeCast` telegraph pushed first, always, before any effect event),
 * marks its cooldown/uses usage, then dispatches by kind:
 *
 *   - heal (D-02): `rollDice(rng, a.dmg)` amount, `f.wp` capped at
 *     `f.maxWP` by direct assignment (never the foeDamage seam) —
 *     `foeHealed { name, ability, amount, wp, maxWP }` (`amount` is what was
 *     ACTUALLY gained, i.e. clamped).
 *   - summon (D-12): one gated `rng.pick` over the bestiary tier; queues
 *     `state.combat.pendingFoes = [{ by, foe }]` (no `abilities` key on the
 *     summoned foe — no recursion) and pushes `foeSummoned{..., pending:
 *     true}`; the actual join happens at the top of the NEXT foeTurn
 *     (engine/combat.js).
 *   - debuff (D-09/D-10, hero-only): a resist check, then (on failure) a
 *     BRAND NEW `c.foeEffect = { kind, rounds: rng.d(4) }` (same kind
 *     refreshes, different kind replaces) + `foeDebuffed`.
 *   - bolt / drain (D-02/D-11/D-13/D-18): `pickFoeTarget` first — a live
 *     party member takes `rollDice` damage straight off `member.wp` (no
 *     resist/ward/armor/Hardiness), downed via `downMember` at 0; otherwise
 *     the hero resists, then the damage runs through
 *     `applyFoeDamageToPlayer` (a drain forces `ignoresArmor: true`). A
 *     landed drain then heals the foe by the amount ACTUALLY applied
 *     (`hit.applied`, post-ward/soak), capped at `maxWP`, via
 *     `foeDrained{stolen, wp, maxWP}` — never on a lethal hit, never when
 *     nothing landed.
 *
 * Returns `{ died }`, mirroring applyFoeDamageToPlayer's own contract: a
 * lethal hero-targeted bolt/drain has already run `die()` (which nulls
 * `state.combat`) — the caller (engine/combat.js#foeTurn) MUST return
 * immediately without touching `state.combat`/`C` again.
 *
 * Draws (see 19-03-PLAN.md's dice-budget table): heal/debuff/bolt/drain each
 * draw their own dice (`a.dmg`/`d4`), plus one gated `resistRoll` d20 (hero
 * intel >= 12 only) and one gated `pickFoeTarget` die (a live party member
 * only); summon draws exactly one `rng.pick`.
 *
 * DELIBERATE RULES CHANGE (Phase 21, TUNE-01, D-03/D-18): the cooldown
 * reset and uses decrement now go through `abilityCadenceFor` (curve-scaled
 * `every`/`uses`) instead of the descriptor's own raw numbers. The summon
 * literal's hit points are deliberately NOT scaled here (Claude's
 * Discretion: reinforcements are already tier-limited weak foes; scaling
 * them is a 21-04 option only if the DR round asks).
 */
export function resolveFoeAbility(state, f, a, rng, events) {
  const c = state.c;
  const cad = abilityCadenceFor(a, difficultyCurve(state.floor.depth));
  events.push({ type: "foeCast", name: f.name, ability: a.id, kind: a.kind, txt: a.txt });
  if (a.every !== undefined) {
    if (!f.cd) f.cd = {};
    f.cd[a.id] = cad.every;
  }
  if (a.uses !== undefined) {
    f.uses = f.uses || {};
    f.uses[a.id] = (f.uses[a.id] ?? cad.uses) - 1;
  }

  if (a.kind === "heal") {
    const amt = rollDice(rng, a.dmg);
    const before = f.wp;
    f.wp = Math.min(f.maxWP, f.wp + amt);
    events.push({ type: "foeHealed", name: f.name, ability: a.id, amount: f.wp - before, wp: f.wp, maxWP: f.maxWP });
    return { died: false };
  }

  if (a.kind === "summon") {
    const roster = BESTIARY[a.effect.type][a.effect.tier - 1];
    const picked = rng.pick(roster);
    const foe = {
      name: picked.n,
      type: a.effect.type,
      // WR-01 (19-REVIEW.md): lvl must match the roster TIER the stats were
      // drawn from, not the summoner's own level — the summoner's level was
      // silently inflating the reinforcement's to-hit die, melee damage, and
      // XP payout (all keyed off f.lvl elsewhere in the engine) to the
      // summoner's own tier instead of the declared weak tier.
      lvl: a.effect.tier,
      size: picked.sz,
      intel: picked.i,
      wp: picked.wp,
      maxWP: picked.wp,
      alive: true,
      asleep: 0,
      sp: picked.sp || {},
      lives: picked.sp && picked.sp.twice ? 2 : 1,
    };
    state.combat.pendingFoes = [{ by: f.name, foe }];
    events.push({ type: "foeSummoned", name: foe.name, by: f.name, pending: true });
    return { died: false };
  }

  if (a.kind === "debuff") {
    // hero-only (D-09/D-10) — never pickFoeTarget.
    if (RESISTIBLE.has(a.kind) && heroResist(rng, c, f, a, events)) return { died: false };
    c.foeEffect = { kind: a.effect, rounds: rng.d(4) };
    events.push({ type: "foeDebuffed", name: f.name, ability: a.id, kind: a.effect, rounds: c.foeEffect.rounds });
    return { died: false };
  }

  // bolt / drain
  const member = pickFoeTarget(state, rng);
  if (member) {
    const dmg = rollDice(rng, a.dmg);
    member.wp -= dmg;
    events.push({
      type: "foeBolted",
      name: f.name,
      ability: a.id,
      dmg,
      ignoresArmor: a.kind === "drain" || !!(f.sp && f.sp.noArmor),
      member: member.name,
    });
    if (a.kind === "drain") {
      const before = f.wp;
      f.wp = Math.min(f.maxWP, f.wp + dmg);
      events.push({ type: "foeDrained", name: f.name, ability: a.id, stolen: f.wp - before, wp: f.wp, maxWP: f.maxWP });
    }
    if (member.wp <= 0) downMember(state, member, events);
    return { died: false };
  }

  if (RESISTIBLE.has(a.kind) && heroResist(rng, c, f, a, events)) return { died: false };
  const dmg = rollDice(rng, a.dmg);
  const hit = applyFoeDamageToPlayer(
    state,
    f,
    rng,
    events,
    a.kind === "drain" ? { dmg, ignoresArmor: true, ability: a.id } : { dmg, ability: a.id },
  );
  if (a.kind === "drain" && !hit.died && hit.applied > 0) {
    const before = f.wp;
    f.wp = Math.min(f.maxWP, f.wp + hit.applied);
    events.push({ type: "foeDrained", name: f.name, ability: a.id, stolen: f.wp - before, wp: f.wp, maxWP: f.maxWP });
  }
  return { died: !!hit.died };
}
