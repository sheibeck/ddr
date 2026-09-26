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
import { liveFoes, normalizeTarget, downMember, fumbleHeavyBlow, HERO_OUT_MAX } from "./combat.js";
import { startEffect } from "./effects.js";
import { buildReinforcement, SUMMON_MAX_LIVE } from "./foeAbilities.js";

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
 * resolveArea(state, sp, entry, srng, rng, events, now) — an area-damage
 * spell hits the reader AND everyone on the reader's side: every live party
 * member, then the summoned ally, then the reader, each as if targeted.
 * Earthquake (`entry.once`) rolls ONE amount for everyone; Lightning rolls
 * separately per victim. Fireballs (`entry.effect === "volley"`) spreads its
 * own d8 bolts round-robin over the SAME [members..., ally?, reader] order —
 * a victim already downed/unmade/dead when their slot comes up again spends
 * that bolt for nothing (no draw, mirroring castSpell's own volley `if
 * (!t.alive) continue;` precedent). A party member loses the hp and is
 * downed through downMember at 0; the summoned ally (no hit points) is
 * unmade by ANY hit, however small; the reader is resolved last, and a
 * lethal hit on the reader ends the resolution at once.
 */
function resolveArea(state, sp, entry, srng, rng, events, now) {
  const c = state.c;
  const C = state.combat;
  const mult = Math.max(1, c.level - sp.lvl);
  const members = (C.allies || []).filter((m) => m.wp > 0);
  const ally = C.ally || null;

  const hitMember = (member, amount) => {
    member.wp -= amount;
    events.push({ type: "fumbleOnSide", spell: sp.n, who: "member", name: member.name, amount });
    if (member.wp <= 0) downMember(state, member, events);
  };
  const hitAlly = () => {
    events.push({ type: "fumbleOnSide", spell: sp.n, who: "ally", name: C.ally.name, unmade: true });
    C.ally = null;
  };
  const hitReader = (amount) => {
    c.wp -= amount;
    events.push({ type: "fumbleOnSide", spell: sp.n, who: "reader", name: "you", amount });
    if (c.wp <= 0) {
      die(state, "scrollFumble", sp.n, rng, events, now);
      return true;
    }
    return false;
  };

  if (entry.effect === "damage") {
    if (entry.once) {
      const amount = rollDice(srng, sp.dmg) * mult;
      for (const m of members) hitMember(m, amount);
      if (ally) hitAlly();
      hitReader(amount);
    } else {
      for (const m of members) hitMember(m, rollDice(srng, sp.dmg) * mult);
      if (ally) hitAlly();
      hitReader(rollDice(srng, sp.dmg) * mult);
    }
    return events;
  }

  // volley (Fireballs): round-robin d8 bolts over [members..., ally?, reader]
  const order = [];
  for (const m of members) order.push({ kind: "member", ref: m });
  if (ally) order.push({ kind: "ally" });
  order.push({ kind: "reader" });
  const n = srng.d(8); // roll:amount
  let allyAlive = !!ally;
  for (let k = 0; k < n && order.length; k++) {
    const v = order[k % order.length];
    if (v.kind === "member" && v.ref.wp <= 0) continue;
    if (v.kind === "ally" && !allyAlive) continue;
    if (v.kind === "reader" && c.wp <= 0) continue;
    const amount = rollDice(srng, sp.dmg);
    if (v.kind === "member") {
      hitMember(v.ref, amount);
    } else if (v.kind === "ally") {
      hitAlly();
      allyAlive = false;
    } else if (hitReader(amount)) {
      return events; // the reader dying stops the rest
    }
  }
  return events;
}

/**
 * resolveHelpful(state, sp, entry, srng, rng, events, now) — a helpful spell
 * takes effect on the combat's CURRENT target (after normalizeTarget), using
 * the 75.1-03 foe-side field shapes and the spell row's own numbers:
 *
 *   - heal: restores the spell's dice, capped at maxWP.
 *   - regen: sets `regen`.
 *   - ward: Shield's plain pool/rounds, or Bubble's armed mirror
 *     (pool 0, rounds null, popPool) — the SAME two shapes
 *     engine/magic.js#castSpell's own ward branch raises on the hero.
 *   - might: sets `might` to the spell's own dice, doubling maxWP/wp once
 *     (a second fumble refreshes `might` but never doubles again).
 *   - mirror: sets `mirror` to the row's own `rounds` dice (Mirror Self has
 *     no `dmg` of its own — the fumble table names the d6 instead).
 *   - senses: sets `senses` — no further engine rule of its own.
 *   - summon: queues one Demons reinforcement (via the shared
 *     foeAbilities.js#buildReinforcement helper) at the summon's own tier
 *     (Lesser Summon: one under the reader's level, 1..3; Summon/Phantom
 *     Host: the reader's level, at most 5 — never doubled), UNLESS a summon
 *     is already pending or the room already holds SUMMON_MAX_LIVE live
 *     foes, in which case it wanders off instead.
 *   - wasted: Map the Floor, Sense Danger — changes nothing.
 *
 * With no live foe to target (every foe already fled/dead), pushes
 * fumbleOnFoe with a null target and effect "wasted" instead of throwing.
 */
function resolveHelpful(state, sp, entry, srng, rng, events, now) {
  const C = state.combat;
  normalizeTarget(C);
  const t = C.foes[C.target];
  if (!t) {
    events.push({ type: "fumbleOnFoe", spell: sp.n, target: null, effect: "wasted" });
    return events;
  }
  switch (entry.effect) {
    case "heal": {
      const amount = rollDice(srng, sp.dmg);
      const before = t.wp;
      t.wp = Math.min(t.maxWP, t.wp + amount);
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "heal", amount: t.wp - before });
      break;
    }
    case "regen": {
      t.regen = true;
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "regen" });
      break;
    }
    case "ward": {
      if (sp.mirror) {
        t.ward = { name: sp.n, mirror: true, pool: 0, popPool: sp.popPool, rounds: null };
        events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "ward", mirror: true, popPool: sp.popPool });
      } else {
        t.ward = { pool: sp.pool, rounds: sp.rounds, name: sp.n };
        events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "ward", pool: sp.pool, rounds: sp.rounds });
      }
      break;
    }
    case "might": {
      t.might = rollDice(srng, sp.dmg);
      if (!t.strengthBoost) {
        t.strengthBoost = t.maxWP;
        t.maxWP += t.strengthBoost;
        t.wp += t.strengthBoost;
      }
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "might", might: t.might });
      break;
    }
    case "mirror": {
      t.mirror = rollDice(srng, entry.rounds);
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "mirror", rounds: t.mirror });
      break;
    }
    case "senses": {
      t.senses = 1;
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "senses" });
      break;
    }
    case "summon": {
      const capped = (C.pendingFoes && C.pendingFoes.length) || liveFoes(state).length >= SUMMON_MAX_LIVE;
      if (capped) {
        events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "summon", joined: false });
      } else {
        const tier = sp.lesser ? Math.max(1, Math.min(3, state.c.level - 1)) : Math.min(5, state.c.level);
        const foe = buildReinforcement("Demons", tier, srng);
        C.pendingFoes = [{ by: "you", foe }];
        events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "summon", joined: true, reinforcement: foe.name });
      }
      break;
    }
    case "wasted": {
      events.push({ type: "fumbleOnFoe", spell: sp.n, target: t.name, effect: "wasted" });
      break;
    }
  }
  return events;
}

/**
 * resolveScrollFumble(state, sp, srng, rng, events, now) — see the module
 * header. `sp` is the SPELLS row (content/spells.js) the reader fumbled;
 * `SCROLL_FUMBLE[sp.n]` is the ONE thing read to decide which of the three
 * branches above runs, and which of their effect kinds. Never called outside
 * combat by design — a missing `state.combat` (or an unclassified spell
 * name, unreachable in real play — every scroll-castable spell has a row)
 * is a safe no-op.
 */
export function resolveScrollFumble(state, sp, srng, rng, events = [], now = Date.now) {
  if (!state.combat) return events;
  const entry = SCROLL_FUMBLE[sp.n];
  if (!entry) return events;
  if (entry.side === "harmful") return resolveHarmful(state, sp, entry, srng, rng, events, now);
  if (entry.side === "area") return resolveArea(state, sp, entry, srng, rng, events, now);
  return resolveHelpful(state, sp, entry, srng, rng, events, now);
}
