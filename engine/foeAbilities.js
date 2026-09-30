// engine/foeAbilities.js
//
// Phase 19 (FOE-01..09) — the foe-side ability resolver: readiness (every/
// uses/heal/summon caps), the per-visit cooldown tick, and the five effect
// kinds (bolt/drain/debuff/heal/summon), including the hero's Intelligence
// resistance (via engine/derived.js#resistRoll, the half-intel scale a foe
// also resists on since quick 260928-hrs) and party-member targeting
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
// applyFoeDamageToPlayer, applyFoeDamageToMember, liveFoes) — an ESM cycle of the same
// shape engine/items.js <-> engine/combat.js already has; only function
// declarations cross it, resolved at call time, so the cycle is inert.

import { FOE_ABILITIES, BESTIARY } from "../content/index.js";
import { rollDice, rollFields } from "./dice.js";
import { resistRoll, DAZED_TO_HIT_PENALTY } from "./derived.js";
import { difficultyCurve, abilityCadenceFor } from "./difficulty.js";
import { pickFoeTarget, applyFoeDamageToPlayer, applyFoeDamageToMember, liveFoes } from "./combat.js";

const BY_ID = new Map(FOE_ABILITIES.map((a) => [a.id, a]));
// The three kinds the hero's resistance check can ever apply to (FOE-07/D-07) —
// heal and summon are unresisted/untargeted by design (D-02/D-12).
const RESISTIBLE = new Set(["bolt", "drain", "debuff"]);
// FOE-04/D-12: a room never holds more than 4 live foes. Exported (Phase
// 75.1, RULES-10) so engine/scrollFumble.js#resolveScrollFumble's helpful
// branch shares the SAME cap when a fumbled Summon/Phantom Host/Lesser
// Summon joins the foes as a reinforcement.
export const SUMMON_MAX_LIVE = 4;

/**
 * buildReinforcement(type, tier, rng) — RULES-10 (Phase 75.1): the shared
 * reinforcement-foe-record builder, extracted from resolveFoeAbility's own
 * summon branch (below) so engine/scrollFumble.js's fumbled-Summon helpful
 * branch can build a byte-identical record from the SAME bestiary tier —
 * same fields, same values, same one `rng.pick` draw. `type` is a BESTIARY
 * key (e.g. "Demons"), `tier` is the 1-based roster tier (BESTIARY[type][tier
 * - 1]). No `abilities` key on the returned record — no recursion, exactly
 * like the pre-extraction inline build.
 */
export function buildReinforcement(type, tier, rng) {
  const roster = BESTIARY[type][tier - 1];
  const picked = rng.pick(roster);
  return {
    name: picked.n,
    type,
    // WR-01 (19-REVIEW.md): lvl must match the roster TIER the stats were
    // drawn from, not the summoner's own level.
    lvl: tier,
    size: picked.sz,
    intel: picked.i,
    wp: picked.wp,
    maxWP: picked.wp,
    alive: true,
    asleep: 0,
    sp: picked.sp || {},
    lives: picked.sp && picked.sp.twice ? 2 : 1,
  };
}

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
 * (engine/derived.js). User ruling 2026-09-28 (quick 260928-hrs, "Use the
 * same half-intel scale for heroes now"): the hero rolls on the SAME scale a
 * foe does against the hero's spells — `resistFaces(intel)` =
 * `max(1, round(intel / 2))` winning faces of a d20, roll-high — and EVERY
 * hero rolls (canon p.25's intel >= 12 gate is retired). The d20 comes from
 * the MAIN rng, at the position canon's gated draw always sat (after the
 * `foeCast` telegraph, before the effect's own dice), so a hero with intel
 * 12+ draws exactly where it always did; a hero below 12 now draws one d20
 * there too. Pushes `heroResisted` or `heroResistFailed` every time; returns
 * `true` when the effect is fully resisted (0 further effect, no further
 * draw). Never called for heal/summon or a member-targeted bolt/drain. Both
 * events carry resistRoll's { roll, atLeast, dieN } triple alongside `intel`
 * and `faces`.
 */
function heroResist(rng, c, f, a, events) {
  const res = resistRoll(rng, c.intel);
  const fields = { name: f.name, ability: a.id, roll: res.roll, atLeast: res.atLeast, dieN: res.dieN, intel: c.intel, faces: res.faces };
  events.push({ type: res.resisted ? "heroResisted" : "heroResistFailed", ...fields });
  return res.resisted;
}

/**
 * memberResist(state, rng, member, f, a, events) — quick 260928-nrf (user
 * ruling 2026-09-28, Joiners resist: "Yes, same scale"): the Joiner's mirror
 * of heroResist. A bolt or drain `pickFoeTarget` aims at a live party member
 * rolls the SAME `resistRoll` on the member's OWN intel (its persistent
 * sheet, `state.party[member.partyIdx]`; a sheet with no intel reads 0, one
 * face), from the MAIN rng, in the slot matching the hero's: after the
 * ability gate and the target pick, before the effect's own dice. A resist
 * blocks what a hero's resist blocks — the whole effect: no damage, no
 * drain, no further draw. Pushes `memberResisted` or `memberResistFailed`
 * every time, carrying heroResist's fields plus `member` (the Joiner's name;
 * `name` stays the foe's, like foeBolted). Returns `true` on a resist.
 */
function memberResist(state, rng, member, f, a, events) {
  const sheet = state.party?.[member.partyIdx];
  const intel = sheet && Number.isFinite(sheet.intel) ? sheet.intel : 0;
  const res = resistRoll(rng, intel);
  const fields = { name: f.name, ability: a.id, member: member.name, roll: res.roll, atLeast: res.atLeast, dieN: res.dieN, intel, faces: res.faces };
  events.push({ type: res.resisted ? "memberResisted" : "memberResistFailed", ...fields });
  return res.resisted;
}

/**
 * resolveFoeAbility(state, f, a, rng, events, gate) — fires a ready ability
 * (D-06: `foeCast` telegraph pushed first, always, before any effect event),
 * marks its cooldown/uses usage, then dispatches by kind:
 *
 * Phase 73 (ROLL-05): the optional 6th argument `gate` is the foeTurn
 * ability-gate's own rollCheck result (engine/combat.js), or `null` for a
 * never_melee foe (whose ability always fires with no gate draw) or a
 * direct test/tool call that bypasses the gate entirely. When present, its
 * roll-high triple is spread onto `foeCast` for the parity invariant/Oracle.
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
 *     party member rolls its own resist (memberResist, quick 260928-nrf),
 *     then takes `rollDice` damage through `applyFoeDamageToMember` (the
 *     Joiner's one damage pipeline: its own Pendant, Brace and armour soak,
 *     a drain ignoring armour; Phase 89 plan 04), downed at 0; otherwise
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
 * draw their own dice (`a.dmg`/`d4`), plus one `resistRoll` d20 whenever the
 * effect lands on the hero (every hero since quick 260928-hrs) or on a
 * Joiner (every Joiner since quick 260928-nrf), and one gated
 * `pickFoeTarget` die (a live party member only); summon draws exactly one
 * `rng.pick`.
 *
 * DELIBERATE RULES CHANGE (Phase 21, TUNE-01, D-03/D-18): the cooldown
 * reset and uses decrement now go through `abilityCadenceFor` (curve-scaled
 * `every`/`uses`) instead of the descriptor's own raw numbers. The summon
 * literal's hit points are deliberately NOT scaled here (Claude's
 * Discretion: reinforcements are already tier-limited weak foes; scaling
 * them is a 21-04 option only if the DR round asks).
 */
export function resolveFoeAbility(state, f, a, rng, events, gate = null) {
  const c = state.c;
  const cad = abilityCadenceFor(a, difficultyCurve(state.floor.depth));
  events.push({ type: "foeCast", name: f.name, ability: a.id, kind: a.kind, txt: a.txt, ...(gate ? rollFields(gate) : {}) });
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
    // RULES-10 (Phase 75.1): the record build now lives in the shared,
    // exported buildReinforcement helper (above) — byte-identical fields,
    // values and one `rng.pick` draw to the pre-extraction inline build.
    const foe = buildReinforcement(a.effect.type, a.effect.tier, rng);
    state.combat.pendingFoes = [{ by: f.name, foe }];
    events.push({ type: "foeSummoned", name: foe.name, by: f.name, pending: true });
    return { died: false };
  }

  if (a.kind === "debuff") {
    // hero-only (D-09/D-10) — never pickFoeTarget.
    if (RESISTIBLE.has(a.kind) && heroResist(rng, c, f, a, events)) return { died: false };
    c.foeEffect = { kind: a.effect, rounds: rng.d(4) }; // roll:amount
    // CMBUI-13 (Phase 77, plan 77-07, "the onset line names the effect"): a
    // daze carries toHit's own delta so the line states it; payload only.
    events.push({
      type: "foeDebuffed",
      name: f.name,
      ability: a.id,
      kind: a.effect,
      rounds: c.foeEffect.rounds,
      ...(a.effect === "dazed" ? { toHit: -DAZED_TO_HIT_PENALTY } : {}),
    });
    return { died: false };
  }

  // bolt / drain
  const member = pickFoeTarget(state, rng);
  if (member) {
    // Quick 260928-nrf: the Joiner resists, in the hero's slot (after the
    // target pick, before the damage dice).
    if (memberResist(state, rng, member, f, a, events)) return { died: false };
    const dmg = rollDice(rng, a.dmg);
    // Phase 89 plan 04 (ITEM-07): the Joiner's one damage pipeline (its own
    // Pendant, Brace and armour soak; a drain and a no-armour foe ignore the
    // armour, as for the hero). The foe's bolt has no swing index.
    const hit = applyFoeDamageToMember(state, f, member, rng, events, {
      dmg,
      ability: a.id,
      ignoresArmor: a.kind === "drain" || !!(f.sp && f.sp.noArmor),
    });
    if (a.kind === "drain" && hit.applied > 0) {
      const before = f.wp;
      f.wp = Math.min(f.maxWP, f.wp + hit.applied);
      events.push({ type: "foeDrained", name: f.name, ability: a.id, stolen: f.wp - before, wp: f.wp, maxWP: f.maxWP });
    }
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
