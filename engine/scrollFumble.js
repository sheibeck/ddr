// engine/scrollFumble.js
//
// RULES-10 (Phase 75.1): what a fumbled scroll does, in combat. The user's
// rulings ("a Fireball burns the reader", "an area damage scroll that
// fumbles hits the reader and everyone in his party", "a shield scroll with
// a fumble means you shield the target enemy instead") plus the
// fumble-severity rulings of 2026-09-25 (no fumble kills outright; disabling
// spells cost the hero turns, at most d4; a fumbled summon joins the foes).
//
// resolveScrollFumble(state, sp, srng, rng, events, now) reads
// content/scroll-fumbles.js#SCROLL_FUMBLE[sp.n] and NOTHING else to decide
// the fumble's side (harmful/area/helpful) and effect — every spell's own
// SPELLS row (`sp`, passed in by the caller) supplies the numbers (dmg/pool/
// rounds/popPool/mirror/lesser). Every draw this module makes of its own
// comes from `srng` (the caller's own fumble-stream rng, the SAME derived
// stream items.js#pilferFumbleRng and combat.js#fumbleHeavyBlow's own
// pattern establishes) — `fumbleHeavyBlow` itself still draws its d10 from
// ITS OWN separate derived stream, not from `srng`. `rng` (the MAIN rng) is
// passed through ONLY to `fumbleHeavyBlow` and `die()`, for the epitaph pick
// — a non-lethal resolution never advances the main rng's cursor.
//
// This module runs ONLY in combat (readScroll's in-combat fumble path,
// wired in 75.1-06) and NEVER calls afterPlayerAction — the caller does,
// exactly once, after this resolver returns.
//
// This resolver NEVER lowers a foe's wp: every helpful-branch effect either
// raises a foe's wp/maxWP (heal, Strength's one-time double) or sets a
// non-hp field (ward/regen/mirror/senses) — the ONLY hp gained or lost here
// belongs to the reader or their own side (party members, the summoned
// ally).

import { SCROLL_FUMBLE } from "../content/index.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { fumbleHeavyBlow, HERO_OUT_MAX } from "./combat.js";
import { startEffect } from "./effects.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * resolveHarmful(state, sp, entry, srng, rng, events, now) — a harmful spell
 * takes effect on the READER instead of its intended target, always
 * landing, with no armor or ward soak. Every effect kind the table can name:
 *
 *   - damage: the spell's dice, times max(1, reader level − spell level)
 *     (the same thrown-spell multiplier castSpell's own thrown branch
 *     applies), subtracted directly from c.wp. Real hp loss — CAN kill
 *     through the ordinary hp-reached-0 path, but this is never an
 *     INSTANT-kill mechanic (that is the "heavy" case below).
 *   - heavy: fumbleHeavyBlow (d10 + depth, unsoaked, plus Afraid) — the ONE
 *     replacement for every instant-kill fumble (Freeze, Petrify, Death).
 *     Its own event narrates the blow; nothing else is pushed here.
 *   - dot: sets C.selfDot (Acid, Ice) — `left` from the row's own `rounds`
 *     dice, `dmg` from the spell's own dice, `by` the spell's own name
 *     lowercased ("acid"/"ice" — the only two dot rows), carrying the row's
 *     `then: "heavy"` (Ice) so foeTurn's own tick hands off to
 *     fumbleHeavyBlow when the burn's last tick leaves the reader standing.
 *   - out: sets C.heroOut { kind, left, spell } — `left` the row's own `d4`,
 *     clamped to [1, HERO_OUT_MAX] (Doze, Stun, Stupidity, Insane).
 *   - blind: sets C.heroBlind (Blind) — no turns lost.
 *   - shrink: halves current hp rounding up (never to 0), sets C.heroShrunk
 *     — no turns lost.
 *   - weakened: the SAME spell:weaken timer castSpell's own weaken branch
 *     starts (C.weakened, C.foeToHitPenalty, startEffect), for the row's own
 *     `d4+1` rounds.
 *   - vapor: rolls castSpell's own vapor table on the READER — a 4 (forced
 *     at reader level 5+, else a rolled d6) draws a d10; anything but a 1
 *     lands the heavy blow (how "vapor"); a 1, OR a d6 that was never 4 to
 *     begin with, sets C.heroOut asleep for the row's own d4.
 *   - none: Turn Walking Dead, Plane Gate — changes nothing.
 */
function resolveHarmful(state, sp, entry, srng, rng, events, now) {
  const c = state.c;
  const C = state.combat;
  switch (entry.effect) {
    case "damage": {
      const mult = Math.max(1, c.level - sp.lvl);
      const amount = rollDice(srng, sp.dmg) * mult;
      c.wp -= amount;
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "damage", amount });
      if (c.wp <= 0) die(state, "scrollFumble", sp.n, rng, events, now);
      break;
    }
    case "heavy": {
      // its own event narrates the blow — nothing else pushed here.
      fumbleHeavyBlow(state, sp.n, entry.how, rng, events, now);
      break;
    }
    case "dot": {
      const left = rollDice(srng, entry.rounds);
      C.selfDot = {
        left,
        dmg: sp.dmg,
        by: sp.n.toLowerCase(),
        spell: sp.n,
        ...(entry.then ? { then: entry.then } : {}),
      };
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "dot", rounds: left });
      break;
    }
    case "out": {
      const left = clamp(rollDice(srng, entry.rounds), 1, HERO_OUT_MAX);
      C.heroOut = { kind: entry.kind, left, spell: sp.n };
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "out", kind: entry.kind, rounds: left });
      break;
    }
    case "blind": {
      C.heroBlind = true;
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "blind" });
      break;
    }
    case "shrink": {
      const before = c.wp;
      c.wp = Math.ceil(c.wp / 2);
      C.heroShrunk = true;
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "shrink", loss: before - c.wp });
      break;
    }
    case "weakened": {
      const rounds = rollDice(srng, entry.rounds);
      C.weakened = true;
      C.foeToHitPenalty = 3;
      startEffect(c, "spell:weaken", { rounds });
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "weakened", rounds });
      break;
    }
    case "vapor": {
      const r = c.level >= 5 ? 4 : srng.d(6); // roll:selection
      if (r === 4) {
        const face = srng.d(10); // roll:mishap-on-1
        if (face !== 1) {
          fumbleHeavyBlow(state, sp.n, "vapor", rng, events, now);
          break;
        }
      }
      const left = clamp(rollDice(srng, entry.rounds), 1, HERO_OUT_MAX);
      C.heroOut = { kind: "asleep", left, spell: sp.n };
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "vapor", kind: "asleep", rounds: left });
      break;
    }
    case "none": {
      events.push({ type: "fumbleOnReader", spell: sp.n, effect: "none" });
      break;
    }
  }
  return events;
}

/**
 * resolveScrollFumble(state, sp, srng, rng, events, now) — see the module
 * header. `sp` is the SPELLS row (content/spells.js) the reader fumbled;
 * `SCROLL_FUMBLE[sp.n]` is the ONE thing read to decide which branch runs,
 * and which of its effect kinds. Task 2 (this same plan) adds the area and
 * helpful branches below the harmful one; only "harmful" is wired so far.
 * Never called outside combat by design — a missing `state.combat` (or an
 * unclassified spell name, unreachable in real play — every scroll-castable
 * spell has a row) is a safe no-op.
 */
export function resolveScrollFumble(state, sp, srng, rng, events = [], now = Date.now) {
  if (!state.combat) return events;
  const entry = SCROLL_FUMBLE[sp.n];
  if (!entry) return events;
  if (entry.side === "harmful") return resolveHarmful(state, sp, entry, srng, rng, events, now);
  return events;
}
