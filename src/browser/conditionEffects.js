// src/browser/conditionEffects.js
//
// Phase 74 (ROLL-02/03), plan 74-07 — the hero condition chips' effect from
// the player's side, with the resulting range where one exists (74-CONTEXT
// "Condition chips state their effect from your side, with the resulting
// range where one exists: 'Afraid: −3 to hit (now 19–20)'").
//
// The effect is MEASURED, not restated: for each chip, a SHALLOW what-if
// copy of the state drops only that one condition, and the live and
// what-if states are read through the engine's own derived functions
// (rollOdds.js#heroHitOdds for the hero's own roll, engine/derived.js#
// foeToHitVs for a foe's roll against the hero) — never a re-derived
// formula. The difference is formatted through src/browser/rollRange.js's
// ONE formatter (toHitText/signedText/playerDelta/ROLLERS), so this module
// can never disagree with any other roll surface in this phase.
//
// This design is also the hook Phase 77 (CMBUI-13) needs: adding an ability
// timer key to WHAT_IF gives Smoke/Sidestep/Battle Roar indicators their
// effect text for free. This plan does NOT add those keys.
//
// Pure presentation module: no DOM, no rng, no mutation of the state/c
// passed in — every what-if is built as a NEW shallow-copied state/c, never
// an assignment onto the caller's own objects. conditionEffectText never
// throws (the chip-tap paint call must never crash the shell).

import { heroHitOdds } from "./rollOdds.js";
import { foeToHitVs } from "../../engine/derived.js";
import { toHitText, signedText, playerDelta, ROLLERS } from "./rollRange.js";

/**
 * CONDITION_EFFECT_COPY — the frozen copy bank for this module's own two
 * effect-sentence shapes and the joiner between them. `toHitNow` fills
 * `{toHit}` with a signed toHitText delta and `{range}` with the LIVE
 * (current, with the condition still active) faces range; `dieSwap` fills
 * `{range}` with the live heroHitOdds `text` (which already carries its own
 * die, e.g. "2–6 (d6)"); `theirs` fills `{signed}` with a player-signed
 * delta on a foe's swing at the hero.
 */
export const CONDITION_EFFECT_COPY = Object.freeze({
  toHitNow: "{toHit} (now {range})",
  dieSwap: "Hit {range}",
  theirs: "{signed} vs their swings",
  sep: "; ",
});

/**
 * withC(state, patch) — a shallow what-if copy of `state` with `state.c`
 * shallow-copied and `patch` merged over it. Never touches the original
 * `state`/`state.c` objects (safe against a deep-frozen state).
 */
function withC(state, patch) {
  return { ...state, c: { ...state.c, ...patch } };
}

/**
 * itemSourceWhatIf(source, state) — the generic builder for any chip that
 * carries a `source` (a live item-effect record, e.g. the Acuteness potion's
 * "acute" chip or the Anklet of Invisibility's "unseen" chip): a shallow
 * copy of `c.timers` with the `"item:" + source` record removed, so the
 * what-if state reads as though that one item effect were not live. A
 * missing/malformed `c.timers`, or a source with no matching record, yields
 * the state unchanged (the resulting zero diff reads as "no effect", never
 * a thrown error).
 */
function itemSourceWhatIf(source, state) {
  const timers = state.c && state.c.timers;
  if (!timers || typeof timers !== "object") return state;
  const id = `item:${source}`;
  if (!Object.prototype.hasOwnProperty.call(timers, id)) return state;
  const nextTimers = { ...timers };
  delete nextTimers[id];
  return withC(state, { timers: nextTimers });
}

/**
 * WHAT_IF — the frozen key-to-builder map for every hero condition chip
 * whose to-hit effect this plan measures. Each builder returns a SHALLOW
 * what-if copy of the state with only that one condition dropped, never
 * mutating the state/c passed in:
 *   - afraid: state.combat.afraid -> 0 (the chip only exists while
 *     state.combat does, but a missing combat is handled defensively)
 *   - foeEffect: c.foeEffect -> null (covers both the "dazed" and
 *     "weakened" kinds — weakened moves no to-hit term, so its diff is
 *     naturally zero)
 *   - darkness: c.darkFor -> 0
 *   - mirror: c.mirror -> 0
 *   - senses: c.senses -> false
 *   - heroBlind: state.combat.heroBlind -> false (RULES-10, Phase 75.1,
 *     plan 09) — the hero's own Blind chip reads the live one-face range
 *     against the unblinded one, the SAME way afraid's own faces diff
 *     works, since derived.js#toHit reads C.heroBlind as its LAST term
 *     (overriding every other modifier).
 *
 * Phase 77 (CMBUI-13) is expected to add its own ability-timer keys here
 * (Smoke/Sidestep/Battle Roar) rather than inventing a second what-if map.
 */
export const WHAT_IF = Object.freeze({
  afraid: (state) => (state.combat ? { ...state, combat: { ...state.combat, afraid: 0 } } : state),
  foeEffect: (state) => withC(state, { foeEffect: null }),
  darkness: (state) => withC(state, { darkFor: 0 }),
  mirror: (state) => withC(state, { mirror: 0 }),
  senses: (state) => withC(state, { senses: false }),
  // RULES-10 (Phase 75.1, plan 09): mirrors the afraid builder above exactly
  // — a shallow what-if combat with heroBlind dropped.
  heroBlind: (state) => (state.combat ? { ...state, combat: { ...state.combat, heroBlind: false } } : state),
});

/**
 * buildWhatIf(cn, state) — resolves the what-if state for chip descriptor
 * `cn`: the WHAT_IF[cn.key] builder when one exists, else the generic
 * item-source builder when `cn.source` is a live item effect's name, else
 * `null` (no measurable what-if for this chip — e.g. ward, regen, a spell
 * "might" chip, itemCooldown/staffCharges, or an unrecognized key).
 */
function buildWhatIf(cn, state) {
  const builder = WHAT_IF[cn.key];
  if (typeof builder === "function") return builder(state);
  if (typeof cn.source === "string" && cn.source) return itemSourceWhatIf(cn.source, state);
  return null;
}

/**
 * conditionEffectText(cn, state) — the chip-tap effect sentence for
 * condition descriptor `cn` (one entry from engine/derived.js#conditionsOf)
 * against the current `state`, or `null` when the chip moves no to-hit
 * term either way (haste, might, ward, regen, flight, the item-cooldown and
 * staff-charges chips, a weakening foeEffect, or an unrecognized key).
 *
 * Your roll: heroHitOdds(state) vs heroHitOdds(whatIf) (rollOdds.js, 74-04).
 * A change in strike die (e.g. a live Acuteness effect) reports as
 * `dieSwap` with the live "Hit {range} (dN)" text; otherwise a change in
 * winning-faces count reports as `toHitNow`, signed from the player's side
 * via toHitText, with the LIVE range.
 *
 * Their roll: foeToHitVs(state) vs foeToHitVs(whatIf) (engine/derived.js).
 * A non-zero difference reports as `theirs`, run through playerDelta with
 * ROLLERS.foe so a chip that makes foes WORSE at hitting the hero (Anklet
 * of Invisibility, Mirror Self) always reads as a plus.
 *
 * The whole body is wrapped in try/catch: a malformed descriptor, a state
 * missing `c`, or any unexpected shape from a tampered/partial state
 * returns `null` rather than throwing — the chip-tap paint call must never
 * crash the shell.
 */
export function conditionEffectText(cn, state) {
  try {
    if (!cn || typeof cn !== "object" || typeof cn.key !== "string" || !cn.key) return null;
    if (!state || typeof state !== "object" || !state.c || typeof state.c !== "object") return null;

    const whatIf = buildWhatIf(cn, state);
    if (!whatIf) return null;

    const parts = [];

    const liveHit = heroHitOdds(state);
    const whatIfHit = heroHitOdds(whatIf);
    if (liveHit.dieN !== whatIfHit.dieN) {
      parts.push(CONDITION_EFFECT_COPY.dieSwap.replace("{range}", liveHit.text));
    } else if (liveHit.faces !== whatIfHit.faces) {
      const delta = liveHit.faces - whatIfHit.faces;
      parts.push(
        CONDITION_EFFECT_COPY.toHitNow.replace("{toHit}", toHitText(delta)).replace("{range}", liveHit.range)
      );
    }

    const liveFoe = foeToHitVs(state);
    const whatIfFoe = foeToHitVs(whatIf);
    const foeDelta = liveFoe - whatIfFoe;
    if (foeDelta !== 0) {
      parts.push(CONDITION_EFFECT_COPY.theirs.replace("{signed}", signedText(playerDelta(foeDelta, ROLLERS.foe))));
    }

    if (parts.length === 0) return null;
    return parts.join(CONDITION_EFFECT_COPY.sep);
  } catch {
    return null;
  }
}
