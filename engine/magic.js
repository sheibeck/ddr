// engine/magic.js
//
// The magic domain (ENG-01, ENG-05) — spellcasting across every SPELLS kind,
// potions, and scrolls. Ports mazeworld.html's castSpell/drinkPotion/
// readScroll (lines 2483-2794), replacing every D()/pick()-backed
// Math.random() draw with the injected engine rng (in the prototype's exact
// consumption order, including its short-circuiting `&&` guards that only
// sometimes roll — e.g. Noxious Vapor's per-foe d10, only rolled when the d6
// came up 4), every `sp.dmg()` closure call with `rollDice(rng, sp.dmg)`
// against the content module's plain dice-notation data, and every
// say()/evt() narration call with a pushed `{type, ...}` event. No DOM, no
// localStorage, no Math.random, no global S — every function here takes an
// explicit `state` (already a fresh applyAction clone) and mutates it
// directly, matching the applyAction seam.
//
// Offensive spells reuse combat.js's killFoe/liveFoes/afterPlayerAction —
// engine/combat.js's own header already documents that its playerStrike/
// foeTurn faithfully READ every field a spell can set (c.ward/c.regen/
// c.mirror/C.weakened/C.foeToHitPenalty); this module is the thing that
// finally SETS them.

import { eff, canCast, canLearn, spellClosed, schoolBonus, healBonusFor, wardBonusFor, schoolGate, spellTargetsFoe, spellLevelFor, afraidNeed, afraidDamage, applyCasterHealMul, scrollReaderOf, scrollReadBands, scrollReadOutcome, spellLevelSq, spellStrengthParts, strengthFields, spellEffectSquares } from "./derived.js";
import { rollDice, rollCheck, atLeastFor, rollFields } from "./dice.js";
import { die } from "./death.js";
import { liveFoes, killFoe, afterPlayerAction, refuseIfPending, normalizeTarget, shatterIfBest, foeResistsSpell, roomWeakenResists, freezeFoe, startSpellEffect, dozeFoes, stunFoe, iceStorm, stopTime, misdirectFoe, fleeRefusal, parleyBlockedReason, parley, doorIllusionEscape, behemothRoar } from "./combat.js";
import { maxCharges } from "./movement.js";
import { GW, GH } from "./maze.js";
import { SPELLS, RACES, ENC_TYPES } from "../content/index.js";
import { derivedRng } from "./rng.js";
import { resolveScrollFumble } from "./scrollFumble.js";
// Phase 40 (SPELL-01, Weaken): the ONE timer shape every v1.5 timer shares
// (Phase 36) — Weaken's duration lives on a rounds-cadence `spell:weaken`
// record, ticked by combat.js#foeTurn's shared tickRounds(c) tail exactly
// like an ability cooldown or an item effect. A cycle-free leaf import, no
// combat.js/magic.js cycle risk.
import { startEffect } from "./effects.js";
// Phase 18 (D-09/CANON-01/03/04): every damage-to-foe site below routes
// through the shared seam instead of decrementing foe.wp directly.
import { damageFoe } from "./foeDamage.js";
import { spellDamageFor } from "./difficulty.js";

// DELIBERATE RULES CHANGE (quick 260927-rsx, user ruling 2026-09-27: "Every
// spell cast on an enemy should have a chance to be resisted based on their
// intelligence"). Canon p.25 (mazeworld.html line 2509) let only an
// intel >= 12 target resist, and never a thrown spell. Now every foe a spell
// targets rolls combat.js#foeResistsSpell (derived.js#resistRoll, half-intel
// faces on a d20 — the hero's own scale too since quick 260928-hrs), thrown damage included; a resisted spell has
// no effect on that foe. Only derived.js#SPELL_SELF_KINDS (the caster's own
// body, side or map) is never resisted.
//
// Phase 90 plan 04 (SPELL-12, user ruling at the Phase 89 checkpoint,
// 2026-09-30: "rising resists on higher floors should apply to ALL spells ...
// remove the floor-12 special effects only"): that ONE resist is the
// depth-rising one (derived.js#risingResistFaces, rolled through
// foeResistsSpell = combat.js#foeResistsEffect). Its faces are the half-
// intelligence faces up to floor 12 and rise a floor at a time after it. It is
// the ONLY resist a spell rolls: the separate RULES-18 control resist
// (resistControl) and the three-round hold or cap past floor 12 are gone from
// every branch below, so a landed spell is its floor-1 effect at every depth.
//
// SINGLE_TARGET_KINDS — the foe-targeted kinds that land on ONE foe: its
// resist is rolled up front, before the kind branch, and a resist ends the
// cast right there (the turn and the charge are spent, nothing else draws —
// canon's own spellResisted shape). Each names the foe its own branch
// resolves: `target` is the hero's live target (C.target, normalized),
// `first` the first live foe. A single-target thrown spell (no `aoe`) is
// "target". Every other foe-targeted kind (status, weaken, shrink, quake,
// vapor, volley, turn, gate, blast, and a thrown `aoe: "all"`) resists per
// foe inside its own branch or its shared tail (Doze's per reached foe, Ice's
// per surviving foe after its damage).
// Phase 90 plan 05: Doze (status) left this table (it reaches d4 foes and rolls
// a resist for each, combat.js#dozeFoes), Stun joined it as "target" (it holds
// the picked foe only), and "dot" left it (Ice is the area "blast" now).
const SINGLE_TARGET_KINDS = Object.freeze({
  stupid: "target", // Phase 90 plan 04 (Q7 A): the picked foe; a dead pick falls to the first live foe
  stun: "target",
  death: "target", // Phase 90 plan 10 (Q7 A): the picked foe; a dead pick falls to the first live foe
  blind: "target",
  acid: "target",
  petrify: "target",
  insane: "target",
  thrown: "target",
  misdirect: "target", // Phase 90 plan 08 (SPELL-10): Senseless and Duplicate Foe aim at the picked foe
});

// The summon branch's ally name table (the pre-Phase-40 inline literal,
// unchanged; Phase 90 plan 06 removed the Lesser Summon table beside it).
const ALLY_NAMES = ["A horned thing", "Something with too many arms", "A shape that hurts to look at", "A tall grey silence"];

/**
 * castSpell(state, idx, rng, events, now) — resolves SPELLS[idx] by kind.
 * Ports mazeworld.html castSpell() (lines 2483-2672): the charge check,
 * grimoire/school gating (skipped for a scroll-cast spell), the Apprentice's
 * one-in-eight backfire, the intelligent-target resistance roll, and every
 * spell kind's effect (heal/ward/might/status/thrown/reveal/mirror/stun/
 * weaken/acid/blast/quake/vapor/volley/petrify/insane/summon/turn/gate/senses/
 * foresee/regen/death/stupid/blind/shrink). A bad `idx` (T-01-09a: no
 * validated range check upstream) is a safe no-op.
 *
 * Phase 40 (SPELL-01, research Pitfall 2): the thrown branch reads DATA
 * FLAGS, never a spell name — Freeze's own `onHit` flag (its damage-then-
 * freeze tail) and Lightning's own `aoe` flag (its every-foe case) — so a
 * content-table rename can never silently break either. See the thrown
 * branch below for the exact comparisons.
 *
 * Phase 91 (IDENT-17, plan 91-06): a sixth parameter `opts = {}` with
 * `{ free = false, afterRng = null }`. A Bard's song (combat.js#sing) is
 * "resolved as if cast by a Magic User of the Bard's level", so it is THIS
 * code path, not a second resolver. `free: true` skips the charge check, the
 * book / level / school refusal, the charge spend and the Apprentice backfire
 * draw (a song is never the caster's own book); every other branch runs
 * unchanged. `afterRng`, when given, is the rng the trailing foe turn
 * (`afterPlayerAction`) runs on, so a song's own rolls come from its derived
 * stream while the foe turn stays on the main rng exactly as after any other
 * action. A call without `opts` is byte-identical to before.
 */
export function castSpell(state, idx, rng, events = [], now = Date.now, opts = {}) {
  const sp = SPELLS[idx];
  if (!sp) return events;
  const free = opts.free === true;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "castRefused", { spell: sp.n })) return events;
  const c = state.c;
  const C = state.combat;

  if (!free && maxCharges(c) - c.spellsUsed <= 0) {
    events.push({ type: "noChargesLeft" });
    return events;
  }
  if (!free && !c.scrollCast && !canCast(state, sp)) {
    if (!c.grimoire || !c.grimoire.includes(sp.n)) {
      events.push({ type: "spellNotKnown", spell: sp.n });
    } else if (spellClosed(c.sub, sp)) {
      // Phase 90 plan 06 (SPELL-10): the book holds a spell whose school this
      // sub-class can NEVER learn (an old or tampered book — a dealt book is
      // gated at grant time). No level opens it, so the refusal names no level:
      // `need: null`, `forbidden: true`.
      events.push({ type: "spellSchoolLocked", spell: sp.n, school: sp.s, need: null, have: c.level, forbidden: true });
    } else if (spellLevelFor(c.sub, sp) > c.level) {
      // Phase 23 (IDENT-03/IDENT-04): one definition of "effective level" —
      // spellLevelFor honors the per-sub override table (Phase 90 plan 06: the
      // Summoner's Summon) so this diagnostic can never disagree with
      // canCast; byte-identical to the old `sp.lvl > c.level` check for
      // every (sub, spell) pair that has no override.
      events.push({ type: "spellAboveLevel", spell: sp.n, need: spellLevelFor(c.sub, sp), have: c.level });
    } else {
      events.push({ type: "spellSchoolLocked", spell: sp.n, school: sp.s, need: schoolGate(c.sub, sp.s), have: c.level });
    }
    return events;
  }

  // CMB-02 (Phase 31): a combatOnly spell cast outside combat — reachable
  // both from a direct cast (the Hero-tab Grimoire button is already
  // disabled by the shell for these, but the engine itself had no gate) and
  // from readScroll's free-form scroll cast (a scroll of Fireball read in a
  // corridor is still consumed by readScroll — the scroll and its narration
  // stay spent — but nothing fizzles, no Apprentice backfire draws, and
  // Earthquake can no longer self-damage a caster with no foes present).
  // NEVER guarded on combat.afraid — fear is a penalty, not a refusal
  // (user ruling 2026-09-16): an afraid caster casts normally, just worse.
  if (sp.combatOnly && !state.combat) {
    events.push({ type: "castRefused", spell: sp.n, reason: "combatOnly" });
    return events;
  }
  // Mirror playerStrike's dead-target retarget (combat.js:462): a targeted
  // spell (blind/acid/petrify/thrown/stupid/status/insane) should never
  // silently no-op on a corpse while still burning a charge. noTarget is
  // thereby unreachable in combat — every targeted kind always has a live
  // foe to retarget onto once combat.js#liveFoes is non-empty (and if it
  // isn't, the encounter has already cleared). Phase 36 (TGT-01): the rule
  // now lives in combat.js#normalizeTarget.
  if (C) normalizeTarget(C);

  // Phase 90 plan 09 (SPELL-10): a spell whose whole point cannot happen is
  // refused BEFORE the charge is spent, and says why (the fairness rule: a
  // refused Chameleon Tongue or Door Illusion never costs a charge unexplained).
  // The turn is not spent either (as the combatOnly refusal above). A scroll's
  // free cast of one is still consumed by readScroll (RULES-10), and the line
  // tells the reader why. Door Illusion reads the same never-flee predicate
  // flee() does; Chameleon Tongue reads the same parley predicate parley() does,
  // at the fluency the spell is about to give the fight.
  if (C && sp.kind === "door") {
    const why = fleeRefusal(state);
    if (why) {
      // Phase 91 plan 05 (IDENT-16): a Master of Arms' door refusal reads
      // "masterOfArmsStays" so it never borrows the Chameleon Tongue's
      // "masterOfArms" line (a Master of Arms cannot parley: a different rule).
      events.push({ type: "castRefused", spell: sp.n, reason: why === "masterOfArms" ? "masterOfArmsStays" : why });
      return events;
    }
  }
  if (C && sp.kind === "tongue") {
    const why = parleyBlockedReason(state, sp.fluency);
    if (why) {
      events.push({ type: "castRefused", spell: sp.n, reason: why });
      return events;
    }
  }

  if (!free) c.spellsUsed++; // IDENT-17: a song spends no charge
  if (C) C.spellOpen = false;

  // an Apprentice's spells go wrong one time in eight — Phase 73 (ROLL-05):
  // a natural-1 mishap gate is not mirrored (a 1 is always the worst face);
  // drawn ONLY for an Apprentice, on its own line so the guard can tag it —
  // the ternary preserves the old `&&` short-circuit exactly (a non-
  // Apprentice draws nothing here).
  // IDENT-17: a song (free) is never the caster's own book, so it never backfires.
  const apprenticeBackfireRoll = !free && c.sub === "Apprentice" ? rng.d(8) : null; // roll:mishap-on-1
  if (apprenticeBackfireRoll === 1) {
    events.push({ type: "spellBackfired", spell: sp.n, roll: apprenticeBackfireRoll, atLeast: 2, dieN: 8 });
    if (sp.dmg && sp.kind === "thrown") {
      const self = Math.ceil(rollDice(rng, sp.dmg) / 2);
      c.wp -= self;
      // Phase 43 (CLAR-01, additive): spell/sub name the cause for the
      // narration; fixtures compare state, so this moves none.
      events.push({ type: "backfireSelfDamage", amount: self, spell: sp.n, sub: c.sub });
      if (c.wp <= 0) {
        die(state, "backfire", null, rng, events, now);
        return events;
      }
    }
    if (state.combat) afterPlayerAction(state, opts.afterRng ?? rng, events);
    return events;
  }

  // Quick 260927-rsx (user ruling 2026-09-27): a single-target spell cast on
  // a foe — the foe its own branch below will resolve — rolls that foe's
  // intel resist here, in the position canon p.25's check sat. A resist
  // ends the cast (no effect; the turn and the charge are spent), exactly
  // as canon's spellResisted did; a failed resist is narrated and the
  // spell proceeds. The roll is drawn from a derived stream
  // (foeResistsSpell), so it never moves the main rng itself.
  // User ruling 2026-09-28: a Freeze is the exception — it rolls its intel
  // resist only after a hit's damage lands, and a resist stops just the
  // freeze (combat.js#freezeFoe, from the thrown branch below).
  const single =
    C && spellTargetsFoe(sp) && !(sp.kind === "thrown" && sp.aoe === "all") && sp.onHit !== "freeze" ? SINGLE_TARGET_KINDS[sp.kind] : undefined;
  if (single) {
    const aimed = C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
    const t = single === "first" ? liveFoes(state)[0] : aimed || liveFoes(state)[0];
    if (t && foeResistsSpell(state, t, sp.n, rng, events)) {
      afterPlayerAction(state, opts.afterRng ?? rng, events);
      return events;
    }
  }

  if (sp.kind === "summon") {
    const doubled = c.sub === "Summoner"; // a Summoner's creatures come doubled
    const lvl = Math.min(5, c.level + (doubled ? 1 : 0));
    // Phase 73 (ROLL-05): the same natural-1 mishap pattern as the
    // Apprentice backfire above — drawn ONLY when doubled (the ternary
    // preserves the old `&&` short-circuit), on its own tagged line.
    const doubledBackfireRoll = doubled ? rng.d(8) : null; // roll:mishap-on-1
    if (doubledBackfireRoll === 1) {
      const hurt = lvl * lvl + rng.d(6); // roll:amount
      c.wp -= hurt;
      // Phase 43 (CLAR-01, additive): spell/sub name the cause for the
      // narration; fixtures compare state, so this moves none.
      events.push({ type: "summonBackfired", amount: hurt, spell: sp.n, sub: c.sub, roll: doubledBackfireRoll, atLeast: 2, dieN: 8 });
      if (c.wp <= 0) {
        die(state, "summon", null, rng, events, now);
        return events;
      }
    } else {
      const ally = {
        lvl,
        rounds: (doubled ? 2 : 1) * rng.d(4) + 2, // roll:amount
        name: rng.pick(ALLY_NAMES),
      };
      if (C) {
        C.ally = ally;
        events.push({ type: "allySummoned", name: ally.name, rounds: ally.rounds, lvl: ally.lvl });
      } else {
        c.pendingAlly = ally;
        events.push({ type: "allyPending", name: ally.name, rounds: ally.rounds, lvl: ally.lvl });
      }
    }
  } else if (sp.kind === "stun") {
    // DELIBERATE RULES CHANGE (Phase 90 plan 05, SPELL-11, user 2026-09-30:
    // "Stun holds one foe for d4 rounds and a hit does not end it"): Stun and
    // Doze swapped. Stun is a single-target hold of the foe you picked (a dead
    // pick falls to the first live foe, like Stupidity): its one depth-rising
    // resist was rolled up front (SINGLE_TARGET_KINDS), and a landed Stun is
    // combat.js#stunFoe — a d4 on the main rng, then a "stunned" hold (the foe
    // skips that many turns; a hit does not end it; a longer hold stands). The
    // old d6 × max(1, level − 1) foes asleep d4 each, the spellDamageFor power
    // scaling of its reach and the `stunned { count }` line are gone.
    const aimedFoe = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
    const t = C && (aimedFoe || liveFoes(state)[0]);
    if (t) stunFoe(state, t, sp, rng, events);
  } else if (sp.kind === "weaken") {
    // Phase 40 (SPELL-01, Weaken): a scope x duration axis, stated in the
    // grimoire's own txt ("every foe, d4+1 rounds") — today undefined in
    // canon. A rounds-cadence `spell:weaken` timer names the duration;
    // combat.js#foeTurn's tail clears C.weakened/C.foeToHitPenalty and
    // narrates `weakenFaded` on its effect->null transition. ONE-TICK-
    // ALREADY-SPENT INVARIANT (38-03 SUMMARY): a cast IS the round's action,
    // so THIS SAME dispatch's own afterPlayerAction->foeTurn tail ticks the
    // freshly-started record once before castSpell returns — the caller
    // observes `left` one short of the full draw, never the full duration.
    // Re-casting mid-window overwrites the record (refresh), never stacks.
    // sp.combatOnly (true for Weaken) guarantees C exists whenever this
    // branch runs — the `if (C)` guard is defensive (engine V5 discipline),
    // not reachable-false in real play.
    const rounds = rng.d(4) + 1; // roll:amount
    // Quick 260927-rsx (user ruling 2026-09-27): every live foe rolls its
    // own resist (roomWeakenResists, C.foes order); when all resist, nothing
    // lands. Phase 89 plan 08 (ITEM-01, Q1): that resist is the depth-rising
    // one, and the separate room resist RULES-18 (Phase 75.3, audit C14) kept
    // past floor 12 is gone. A landed Weaken skips every foe that resisted
    // (f.weakenResisted, derived.js#foeWeakened). The d4 + 1 above is drawn
    // either way.
    if (!C || roomWeakenResists(state, sp.n, rng, events)) {
      if (C) {
        C.weakened = true;
        C.foeToHitPenalty = 3;
        startEffect(c, "spell:weaken", { rounds });
      }
      // Quick 260927-rsx: `spared` counts the live foes the landed Weaken
      // skips (they resisted it), so the line never says "every foe" when
      // it was not; absent when none did (additive, zero draws).
      const spared = C ? liveFoes(state).filter((f) => f.weakenResisted).length : 0;
      events.push({ type: "weakened", rounds, ...(spared ? { spared } : {}) });
    }
  } else if (sp.kind === "stupid") {
    // DELIBERATE RULES CHANGE (Phase 90 plan 04, SPELL-12, user 2026-09-30,
    // "Stupidity drops a foe's intelligence to 1 for the fight, weakening its
    // resists", and Q7 A: it aims at the foe you picked, a dead pick falling to
    // the first live foe). The one resist was rolled up front on the foe's OLD
    // intelligence (SINGLE_TARGET_KINDS); a landed Stupidity then sets the
    // foe's intelligence to 1, so every later resist it rolls is on 1 face (a
    // 20 on a d20 before the depth rise). The foe keeps acting and is no
    // easier to hit (no turn skip, no strike floor); `f.stupid` is the chip's
    // mark. A foe already at intelligence 1 still lands it and the line says
    // so (`was` 1). Zero draws.
    const aimedFoe = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
    const t = C && (aimedFoe || liveFoes(state)[0]);
    if (t) {
      const was = Number.isFinite(t.intel) ? t.intel : 0;
      t.intel = 1;
      t.stupid = true;
      events.push({ type: "stupefied", target: t.name, intel: 1, was });
    }
  } else if (sp.kind === "blind") {
    // DELIBERATE RULES CHANGE (Phase 90 plan 04, SPELL-12, user 2026-09-30:
    // "Blind limits a foe to its to-hit die's maximum roll and no crits, no
    // floor-12 language"): after the one resist, the target is blind for the
    // fight at EVERY depth (no three-round blindFor, no rounds on the event).
    // derived.js#foeSwingChain holds its winning faces to 1 as the LAST term
    // of a swing and combat.js never lets a blind foe crit. A Dirty Trick's
    // two-round countdown on the same foe is deleted (the blindness is now
    // fight-long). Zero draws.
    const t = C && C.foes[C.target];
    if (t && t.alive) {
      t.blind = true;
      delete t.blindFor;
      events.push({ type: "blinded", target: t.name });
    }
  } else if (sp.kind === "shrink") {
    const n = rng.d(6); // roll:amount
    const affected = liveFoes(state).slice(0, n);
    // Quick 260927-rsx: each affected foe rolls its own resist first (since
    // Phase 90 plan 04 the one depth-rising resist, no second control resist);
    // only those that did not resist are halved, and `count` counts the halved.
    let halved = 0;
    affected.forEach((f) => {
      if (foeResistsSpell(state, f, sp.n, rng, events)) return;
      f.wp = Math.ceil(f.wp / 2);
      f.maxWP = Math.ceil(f.maxWP / 2);
      f.shrunk = true;
      halved++;
    });
    events.push({ type: "shrunk", count: halved });
  } else if (sp.kind === "acid") {
    const t = C && C.foes[C.target];
    if (t && t.alive) {
      // Quick 260928-sq2 (user ruling 2026-09-28): `levelSq` is the caster's
      // level², added to the FIRST tick only (combat.js#foeTurn spends it)
      // — once per cast, like every other damage spell. Zero draws.
      t.acid = { rounds: rng.d(6), dmg: sp.dmg, levelSq: spellLevelSq(c) }; // roll:amount
      events.push({ type: "acidApplied", target: t.name, rounds: t.acid.rounds });
    }
  } else if (sp.kind === "blast") {
    // DELIBERATE RULES CHANGE (Phase 90 plan 05, SPELL-12 and Q5 A, user
    // 2026-09-30: "Ice is an area d10 to every foe with a chance to freeze each
    // target 1d4 rounds", "the area version of the level-1 Freeze"): the old
    // damage-over-time Ice (the `dot` kind, its f.dot record and foeTurn's
    // frozen-solid payoff) is gone. No to-hit roll and no up-front resist:
    // combat.js#iceStorm gives every live foe, in C.foes order, d10 + the
    // caster's level² (Strength's d10 under Q1 A), then freezes each survivor
    // for a d4 unless its one depth-rising resist stops the freeze.
    iceStorm(state, sp, rng, events);
  } else if (sp.kind === "quake") {
    // DELIBERATE RULES CHANGE (quick 260928-sq2, user ruling 2026-09-28):
    // every foe takes the ONE roll + the caster's level² ("each foe gets
    // it"), replacing the p.26 × max(1, level − spell level). The caster's
    // own backlash below is half the roll alone — self-inflicted damage
    // never adds level².
    // Phase 31 Afraid: post-roll arithmetic only — the dice are drawn
    // exactly as before (zero rng change); halves every point the hero
    // deals through Earthquake while combat.afraid > 0 (a no-op otherwise).
    // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1,
    // no-op) sits between the roll and afraidDamage.
    // Phase 90 (SPELL-09, Q1 A): a live Strength adds its d10 to this one roll
    // (every foe takes it); the caster's own backlash stays the dice alone.
    // Phase 92.2 plan 01 (user 2026-10-02): the Strength potion's flat bonus joins
    // the spell's d10 here (spellStrengthParts); the event reports both parts.
    const rolled = rollDice(rng, sp.dmg);
    const sParts = spellStrengthParts(c, rng);
    const d = afraidDamage(state, spellDamageFor(rolled + sParts.total + spellLevelSq(c), c));
    const backlash = afraidDamage(state, spellDamageFor(rolled, c));
    // Quick 260927-rsx: every live foe rolls its intel resist up front (in
    // C.foes order, before any damage lands); a foe that resists takes none.
    // The one damage roll above is the cast's own and is drawn first; the
    // caster's own backlash below is unchanged.
    const quakeHit = liveFoes(state).filter((f) => !foeResistsSpell(state, f, sp.n, rng, events));
    quakeHit.forEach((f) => {
      // Spell damage (CANON-04, D-11): per-foe multiplier/halfDmg/bypass —
      // the event below reports the single rolled base, not the per-foe
      // applied amount (each foe's own wp shows what actually landed).
      damageFoe(state, f, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
      if (f.wp <= 0) killFoe(state, f, rng, events);
    });
    events.push({ type: "earthquake", amount: d, ...strengthFields(sParts) });
    if (!c.ward) {
      const self = Math.ceil(backlash / 2);
      c.wp -= self;
      // Phase 43 (CLAR-01, additive): spell names the cause for the
      // narration; fixtures compare state, so this moves none.
      events.push({ type: "earthquakeSelfDamage", amount: self, spell: sp.n });
      if (c.wp <= 0) {
        die(state, "quake", null, rng, events, now);
        return events;
      }
    }
  } else if (sp.kind === "vapor") {
    const r = c.level >= 5 ? 4 : rng.d(6); // roll:selection
    events.push({ type: "vaporRolled", roll: r });
    // Quick 260927-rsx: each live foe rolls its intel resist first (after
    // the cast's own table roll above); a foe that resists is neither killed
    // nor put to sleep, and draws neither its d10 nor its d6.
    liveFoes(state).forEach((f) => {
      if (foeResistsSpell(state, f, sp.n, rng, events)) return;
      if (r === 4 && rng.d(10) !== 1) { // roll:mishap-on-1
        f.wp = 0;
        killFoe(state, f, rng, events);
      } else {
        // The sleep outcome's d6 + 2, drawn in its existing position (Phase 90
        // plan 04: no second control resist past floor 12 any more).
        const rolled = rng.d(6) + 2; // roll:amount
        f.asleep = Math.max(f.asleep, rolled);
      }
    });
  } else if (sp.kind === "volley") {
    const n = rng.d(8); // roll:amount
    const foes = liveFoes(state);
    // Quick 260927-rsx: every live foe rolls its intel resist once, up front
    // (C.foes order, after the bolt count); a bolt that comes round to a foe
    // that resisted does nothing and draws no damage.
    const shrugged = new Set(foes.filter((f) => foeResistsSpell(state, f, sp.n, rng, events)));
    // DELIBERATE RULES CHANGE (quick 260928-sq2, user ruling 2026-09-28,
    // "each foe gets it"): the FIRST bolt to strike each foe adds the
    // caster's level² to its dice; a later bolt on the same foe is its dice
    // alone (level² once per foe per cast, like Lightning and Earthquake).
    const levelSq = spellLevelSq(c);
    const struck = new Set();
    let tot = 0;
    // Phase 92.2 plan 01: the Strength parts of every bolt that was rolled, summed for the event.
    const sSum = { strength: 0, might: 0 };
    for (let k = 0; k < n && foes.length; k++) {
      const t = foes[k % foes.length];
      if (!t.alive || shrugged.has(t)) continue;
      const first = !struck.has(t);
      struck.add(t);
      // Phase 31 Afraid: halves each Volley bolt the hero deals (post-roll
      // arithmetic, zero rng change; a no-op unless combat.afraid > 0).
      // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1).
      // Phase 90 (SPELL-09, Q1 A): each bolt is its own damage roll, so a live
      // Strength adds its own d10 to every bolt.
      const dice = rollDice(rng, sp.dmg);
      const bolt = spellStrengthParts(c, rng);
      sSum.strength += bolt.strength;
      sSum.might += bolt.might;
      const d = afraidDamage(state, spellDamageFor(dice + bolt.total + (first ? levelSq : 0), c));
      // Spell damage (CANON-04, D-11): route through the seam; the volley
      // total sums APPLIED damage (post multiplier/halfDmg/bypass), not raw.
      const hit = damageFoe(state, t, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
      tot += hit.applied;
      if (t.wp <= 0) killFoe(state, t, rng, events);
    }
    events.push({ type: "volley", rolls: n, totalDamage: tot, ...strengthFields(sSum) });
  } else if (sp.kind === "petrify") {
    const t = C && C.foes[C.target];
    // DELIBERATE RULES CHANGE (Phase 90 plan 04, SPELL-12 and Q2 A, user
    // 2026-09-30: "Petrify turns one foe to stone, it dies, no loot, resist
    // still allowed, no floor-12 language"; "the stone foe pays its experience
    // like any kill and drops no coin or treasure"). After the one resist (the
    // foe may still resist: SINGLE_TARGET_KINDS), a landed Petrify ends BOTH
    // lives of a kill-twice foe and pays its experience through killFoe with
    // spoils off: no coin, no treasure offer, no bag drop, no cooking. No
    // hold at any depth. The old removal (alive false, no killFoe, no
    // experience) and the past-floor-12 stone hold are gone.
    if (t && t.alive) {
      events.push({ type: "petrified", target: t.name });
      t.lives = 1;
      t.frozen = true;
      killFoe(state, t, rng, events, { spoils: false });
    }
  } else if (sp.kind === "turn") {
    if (C && C.type === "Walking Dead") {
      // Quick 260927-rsx: each foe the turning reaches (level at or below
      // the caster's) rolls its intel resist; a foe that resists stays.
      const turned = liveFoes(state)
        .filter((f) => f.lvl <= c.level)
        .filter((f) => !foeResistsSpell(state, f, sp.n, rng, events));
      turned.forEach((f) => {
        f.alive = false;
        f.turned = true;
        f.wp = 0;
      });
      events.push({ type: "walkingDeadTurned", count: turned.length });
      liveFoes(state).forEach((f) => {
        f.fixated = true;
      });
    } else {
      events.push({ type: "nothingToTurn" });
    }
  } else if (sp.kind === "gate") {
    if (C && (C.type === "Walking Dead" || C.type === "Demons")) {
      // Quick 260927-rsx: each foe the gate reaches rolls its intel resist
      // (after the reach roll); a foe that resists stays on this plane.
      const gone = liveFoes(state)
        .slice(0, rng.d(6)) // roll:amount
        .filter((f) => !foeResistsSpell(state, f, sp.n, rng, events));
      gone.forEach((f) => {
        f.alive = false;
        f.turned = true;
        f.wp = 0;
      });
      events.push({ type: "planeGated", count: gone.length });
    } else {
      events.push({ type: "gateRefused" });
    }
  } else if (sp.kind === "senses") {
    c.senses = 1;
    events.push({ type: "sensesGained" });
  } else if (sp.kind === "reveal") {
    // Phase 40 (SPELL-05, Plan 04): Map the Floor is a TIME-BOXED reveal,
    // not the old permanent whole-floor sweep. Every not-yet-seen non-wall
    // cell is marked BOTH seen and spellSeen (the provenance flag) — a cell
    // already seen (walked earlier, or already spell-marked from an earlier
    // cast this window) is left alone, so a recast never double-marks and
    // the reported `cells` count is only the NEWLY-marked cells. Zero rng
    // draws.
    // Plan 76-06 (user ruling 2026-09-26): the window lasts until the hero's
    // first step (sp.squares is 1, and engine/movement.js#move is the one
    // tickSquares site). startEffect OVERWRITES any existing `spell:reveal`
    // record with the one-square record, so a recast keeps an open window
    // open and reopens a closed one. The event carries no squares count:
    // there is nothing left to count.
    const f = state.floor;
    let cells = 0;
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const cell = f.g[y][x];
        if (cell.wall || cell.seen) continue;
        cell.seen = true;
        cell.spellSeen = true;
        cells++;
      }
    startEffect(c, "spell:reveal", { squares: sp.squares });
    events.push({ type: "floorMapped", cells });
  } else if (sp.kind === "foresee") {
    c.foresight = true;
    const type = rng.pick(ENC_TYPES);
    events.push({ type: "senseDanger", nextEncounter: type });
  } else if (sp.kind === "mirror") {
    c.mirror = rng.d(6); // roll:amount
    events.push({ type: "mirrorSelf", rounds: c.mirror });
  } else if (sp.kind === "ward") {
    // RULES-14 (Phase 75, user 2026-09-25): a mirror spell (Bubble) raises
    // an ARMED mirror — pool 0, rounds null (never ticks until it pops; see
    // combat.js#applyFoeDamageToPlayer/foeTurn's tail tick) — instead of a
    // soak pool. Every other ward spell (Shield) is unchanged: no reflect
    // key is ever set again.
    if (sp.mirror) {
      // Phase 91.1 plan 03 (V18 B): the caster's protection bonus enlarges the Bubble's film (5 HP a point).
      const popPool = sp.popPool + wardBonusFor(c.sub);
      c.ward = { name: sp.n, mirror: true, pool: 0, popPool, rounds: null };
      events.push({ type: "wardRaised", spell: sp.n, pool: 0, mirror: true, popPool });
    } else {
      // ... and Shield's soak pool (the same 5 HP a point).
      const pool = sp.pool + wardBonusFor(c.sub);
      c.ward = { pool, rounds: sp.rounds, name: sp.n };
      events.push({ type: "wardRaised", spell: sp.n, pool });
    }
  } else if (sp.kind === "might") {
    // Phase 90 (SPELL-09, report #8, user 2026-09-30): Strength is a
    // spell-sourced timed effect, 100 squares from the cast: one
    // `spell:Strength` record (startSpellEffect). A recast restarts it and
    // never stacks; it grants no hit points and rolls nothing here (the extra
    // d10 is rolled on each damage roll, derived.js#strengthRoll).
    const prior = c.timers && c.timers["spell:" + sp.n];
    const restarted = !!(prior && prior.phase === "effect" && prior.left > 0);
    const rec = startSpellEffect(c, sp, events);
    events.push({ type: "strengthCast", squares: rec ? rec.left : 0, restarted });
  } else if (sp.kind === "timed") {
    // Phase 90 plan 07 (SPELL-10, user 2026-09-30, the slate accepted as
    // drafted; Q6 A): a spell-sourced timed effect (Open/Lock, Fly, Enchant
    // Character, Speed of Sound). One `spell:<name>` squares record of the
    // caster's STRETCHED window (derived.js#spellEffectSquares: the base plus
    // the school bonus times the ruled step), started through the one starter
    // (combat.js#startSpellEffect), which overwrites a live record: a recast
    // restarts the window and never stacks. Never resisted (a self kind), no
    // combatOnly refusal (usable anywhere), zero draws. The effect itself is
    // read back through derived.js#liveItemEffects, so this branch holds no
    // spell-specific rule.
    const prior = c.timers && c.timers["spell:" + sp.n];
    const restarted = !!(prior && prior.phase === "effect" && prior.left > 0);
    const rec = startSpellEffect(c, sp, events, { squares: spellEffectSquares(c.sub, sp) });
    events.push({ type: "spellEffectStarted", spell: sp.n, kind: sp.act.kind, squares: rec ? rec.left : 0, restarted });
  } else if (sp.kind === "timestop") {
    // Phase 90 plan 08 (SPELL-10, the accepted slate, Q6 A): Stop Time. Every
    // live foe rolls its own one depth-rising resist inside combat.js#stopTime;
    // each that fails is held kind "time" for the base rounds plus the caster's
    // Special school bonus. Combat-only. No main-rng draw.
    if (C) stopTime(state, sp, rng, events, { sub: c.sub });
  } else if (sp.kind === "misdirect") {
    // Phase 90 plan 08 (SPELL-10, Q6 A): Senseless and Duplicate Foe. The
    // picked foe's one resist was rolled up front (SINGLE_TARGET_KINDS); a landed
    // spell is combat.js#misdirectFoe, whose one main-rng draw is the duration
    // dice. Combat-only.
    const aimedFoe = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
    const t = C && (aimedFoe || liveFoes(state)[0]);
    if (t) misdirectFoe(state, t, sp, rng, events, { sub: c.sub });
  } else if (sp.kind === "door") {
    // Phase 90 plan 09 (SPELL-10, Door Illusion): the cleverest foe rolls the one
    // resist; if it fails, the fight is over (the Smoke flee path: no roll, no
    // parting blow, spoils left behind) and there is no turn left to spend. If
    // it resists, doorIllusionSeen is narrated and the turn falls through to the
    // foes' as usual. Combat-only. No main-rng draw.
    if (C && doorIllusionEscape(state, sp, rng, events)) return events;
  } else if (sp.kind === "tongue") {
    // Phase 90 plan 09 (SPELL-10, Chameleon Tongue): the spell IS the fight's one
    // parley, made at fluency 2 (the fight-scoped C.tongue that derived.js#fluency
    // reads). The refusal ladder above already proved the parley can happen, so
    // parley() rolls it; it pays what parley pays, ends the fight on a success,
    // and on a failure insults the room and runs the foes' turn itself, so this
    // branch returns without the shared tail (the foe turn never runs twice).
    if (C) {
      C.tongue = sp.fluency;
      events.push({ type: "tongueCast" });
      parley(state, rng, events);
      return events;
    }
  } else if (sp.kind === "behemoth") {
    // Phase 90 plan 09 (SPELL-10, Size of the Behemoth): every live foe rolls
    // its resist; a failer below the caster's level flees, any other failer
    // cowers for the fight. Combat-only. No main-rng draw.
    if (C) behemothRoar(state, sp, rng, events, { level: c.level });
  } else if (sp.kind === "regen") {
    c.regen = true;
    events.push({ type: "regenerationCast" });
  } else if (sp.kind === "insane") {
    const t = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : liveFoes(state)[0];
    if (!t) {
      events.push({ type: "insaneNoTarget" });
    } else {
      const r = rng.d(6); // roll:selection
      events.push({ type: "insaneRolled", target: t.name, roll: r });
      if (r === 1) {
        t.wp = 0;
        killFoe(state, t, rng, events);
      } else if (r === 2) {
        const o = liveFoes(state).find((f) => f !== t);
        if (o) {
          const d = t.lvl * t.lvl + rng.d(6); // roll:amount
          // A maddened foe's blow on its neighbour is physical (kind:"foe")
          // — the victim's own natural armor may soak it (gated d20, D-05);
          // no CANON-04 multiplier row applies (no player caster identity).
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
        // The nap's d4 (Phase 90 plan 04: no second control resist past floor 12).
        t.asleep = rng.d(4); // roll:amount
      } else if (r === 5) {
        t.frenzied = true;
      }
    }
  } else if (sp.kind === "heal") {
    // Phase 91.1 plan 03 (V18 B): the chart's healing bonus is added to every heal the caster casts (Cleric +4,
    // which replaces the old separate +3, Court Mage +1), before a heal2x race's doubling and the healMul.
    let amt = rollDice(rng, sp.dmg) + healBonusFor(c.sub);
    if (RACES[c.race].heal2x) amt *= 2;
    // RULES-03 (Phase 75, user 2026-09-25): the Summoner's healing weakness
    // — applyCasterHealMul reads the chart's healMul flag (never a name
    // check) and applies LAST, after the Cleric bonus and a heal2x race's
    // doubling, so a heal2x Summoner rolling 5 restores 5 (doubled to 10,
    // then halved). No new rng draw.
    const healed = applyCasterHealMul(c.sub, amt);
    const before = c.wp;
    c.wp = Math.min(c.maxWP, c.wp + healed);
    // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
    // actually added after the clamp to max (additive, zero draws).
    events.push({ type: "healed", amount: healed, spell: sp.n, ...(healed !== amt ? { halved: true } : {}), gained: c.wp - before });
  } else if (sp.kind === "death") {
    // Phase 43 (CLAR-01, additive): DEATH_SPELL_FEE names the cause for the
    // narration; fixtures compare state, so this moves none. Value-identical
    // to the prior literal 26/25 (fee + 1 / fee).
    const DEATH_SPELL_FEE = 25;
    if (c.wp <= DEATH_SPELL_FEE + 1) {
      events.push({ type: "deathSpellTooWeak", fee: DEATH_SPELL_FEE });
      if (free) {
        // IDENT-17: a sung Death the Bard cannot afford fizzles, and the song is
        // spent (it was never a charge to refund), so the round passes to the
        // foes as any other fizzled action would.
        if (state.combat) afterPlayerAction(state, opts.afterRng ?? rng, events);
        return events;
      }
      c.spellsUsed--;
      return events;
    }
    c.wp -= DEATH_SPELL_FEE;
    // Phase 90 plan 10 (SPELL-08, Q7 A, user 2026-09-30): Death kills the foe you
    // PICKED (the same foe whose resist was rolled up front), a dead pick falling
    // to the first live foe, like Stupidity, Blind, Acid and Petrify.
    const aimedFoe = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : null;
    const t = aimedFoe || liveFoes(state)[0];
    events.push({ type: "deathCast", cost: DEATH_SPELL_FEE });
    if (t) {
      t.wp = 0;
      killFoe(state, t, rng, events);
    }
  } else if (sp.kind === "status") {
    // DELIBERATE RULES CHANGE (Phase 90 plan 05, SPELL-11, Q3 A and Q4 A, user
    // 2026-09-30: "Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing
    // foe"): the first-live-foe single sleep is gone. combat.js#dozeFoes draws
    // the d4 reach, then each reached foe (the picked foe first) rolls its own
    // resist and its own d4, and is marked `dozing` so a hit wakes it.
    if (C) dozeFoes(state, sp, rng, events);
  } else {
    // thrown: d8, 4 winning faces, plus the offensive bonus from the
    // subclass chart. Phase 73 (ROLL-05): the school and throw bonuses fold
    // into the threshold via atLeastFor(faces + bonus, dieN), exactly like
    // every other per-target modifier — byte-identical to the old
    // `roll - bonus <= target`.
    const schoolMod = schoolBonus(c.sub, sp.s);
    const throwMod = eff(c, "throw");
    const bonus = schoolMod + throwMod;
    // Phase 40 (SPELL-01, research Pitfall 2): Lightning's own `aoe` data
    // flag drives the every-foe case below — replaces the old name-keyed
    // special case (a direct comparison against the literal spell name
    // "Lightning") so a rename can never silently break it.
    const targets = sp.aoe === "all" ? liveFoes(state) : [C ? C.foes[C.target] : null].filter(Boolean);
    if (!targets.length) {
      events.push({ type: "nothingToThrowAt" });
      return events;
    }
    for (const t of targets) {
      if (!t.alive) continue;
      // Quick 260927-rsx: an every-foe throw (Lightning) rolls each foe's
      // intel resist just before that foe's throw; a foe that resists takes
      // no throw and no damage. A one-foe throw already rolled its resist
      // before the kind branch (SINGLE_TARGET_KINDS).
      if (sp.aoe === "all" && foeResistsSpell(state, t, sp.n, rng, events)) continue;
      // Phase 40 (SPELL-01): Freeze's own `onHit` data flag drives the
      // freeze case below — replaces the old name-keyed check (a direct
      // comparison against the literal spell name "Freeze"), per research
      // Pitfall 2. Since the user rulings of 2026-09-28 that case is the
      // damage-then-d4-freeze tail (combat.js#freezeFoe).
      const freeze = sp.onHit === "freeze";
      const dieN = freeze ? 10 : 8;
      // Phase 31 Afraid — to-hit is a count of winning faces, so the target
      // SHRINKS (4 → 1, Freeze 6 → 3), never the roll; pure arithmetic, zero
      // rng; fixture-visible only on the declared cast-damage record, where
      // a mirrored top-face roll still lands under the narrowed threshold.
      const baseTarget = freeze ? 6 : 4;
      const target = afraidNeed(state, baseTarget);
      const afraidMods = target !== baseTarget ? [{ name: "afraid", delta: target - baseTarget }] : [];
      const schoolThrowMods = [
        ...(schoolMod ? [{ name: "school", delta: schoolMod }] : []),
        ...(throwMod ? [{ name: "throw", delta: throwMod }] : []),
      ];
      const mods = [...afraidMods, ...schoolThrowMods];
      const check = rollCheck(rng, dieN, atLeastFor(target + bonus, dieN));
      const roll = check.roll;
      events.push({ type: "spellThrown", spell: sp.n, target: t.name, ...rollFields(check), ...(mods.length ? { mods } : {}) });
      if (check.ok) {
        // Phase 72 (ROLL-01 (c)): a landed hero thrown attack spell on its
        // die's best face shatters a shatter-flagged foe (the Skeleton)
        // outright — skip the spell-damage roll.
        if (shatterIfBest(state, t, roll, dieN, "you", rng, events, { spell: sp.n })) continue;
        // DELIBERATE RULES CHANGE (quick 260928-sq2, user ruling 2026-09-28:
        // "square spell damage just like we do with weapons damage"): the
        // damage is the dice + the caster's level² (+ any spellDmg item
        // bonus), replacing canon p.26's × max(1, caster level − spell
        // level). Lightning's every-foe throw adds it to each foe it hits.
        // No new draw.
        const levelSq = spellLevelSq(c);
        // Phase 31 Afraid: halves the hero's thrown-spell damage (post-roll
        // arithmetic, zero rng change; a no-op unless combat.afraid > 0).
        // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1).
        // Phase 90 (SPELL-09, Q1 A): a live Strength adds its d10 to this damage
        // roll (each foe a Lightning throw reaches rolls its own).
        // Phase 92.2 plan 01: the Strength potion's flat bonus rides with the spell's d10.
        const dice = rollDice(rng, sp.dmg);
        const sParts = spellStrengthParts(c, rng);
        const dmg = afraidDamage(state, spellDamageFor(dice + sParts.total + levelSq + eff(c, "spellDmg"), c));
        // Spell damage (D-06): bypasses foe armor entirely; eligible for the
        // CANON-04 multiplier table. `levelSq` in the event is the level
        // term above (the narration says "the roll +N, for your level");
        // `dmg` is the APPLIED amount.
        const hit = damageFoe(state, t, dmg, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
        events.push({ type: "spellHit", target: t.name, dmg: hit.applied, levelSq, ...strengthFields(sParts), ...(afraidMods.length ? { afraid: true } : {}) });
        if (freeze) {
          // DELIBERATE RULES CHANGE (user rulings 2026-09-28): "freeze should
          // never kill outright. It should deal its damage and freeze an
          // enemy for 1d4 rounds." and "if it hits and resists, deal damage,
          // but no freeze." The frozen-solid kill (Phase 23's killFoe route
          // at or below the knee) and the RULES-18 knee hold
          // past it are both retired. The damage has landed (above); a blow
          // that drops the target to 0 hp is a normal kill (killFoe, no
          // frozenSolid). A survivor draws one new d4 (the hold's rounds,
          // right after the damage, resisted or not), then rolls its one
          // depth-rising resist (the 2026-09-27 derived stream, rolled HERE,
          // after the damage, never before the throw; Phase 90 plan 04: no
          // separate control resist past floor 12), then freezes for the d4's
          // rounds (combat.js#freezeFoe, shared with a Joiner's cast and the
          // Birch Staff). A miss rolls no resist at all.
          if (t.wp <= 0) {
            killFoe(state, t, rng, events);
            continue;
          }
          freezeFoe(state, t, sp.n, rng, events, { dmg: hit.applied });
          continue;
        }
        if (t.wp <= 0) {
          killFoe(state, t, rng, events);
          continue;
        }
      } else {
        events.push({ type: "spellMissed", target: t.name });
      }
    }
  }
  if (state.combat) afterPlayerAction(state, opts.afterRng ?? rng, events);
  return events;
}

/**
 * drinkPotion(state, rng, events) — consumes one carried healing potion.
 * Ports mazeworld.html drinkPotion() (lines 2674-2682). A no-op with zero
 * potions on hand.
 */
export function drinkPotion(state, rng, events = []) {
  const c = state.c;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "actionRefused", { action: "drinkPotion" })) return events;
  if (c.potions <= 0) return events;
  c.potions--;
  let amt = 2 * rng.d(10) + 5; // roll:amount
  if (RACES[c.race].heal2x) amt *= 2;
  const before = c.wp;
  c.wp = Math.min(c.maxWP, c.wp + amt);
  // Phase 25 (FEED-01, additive payload): narrate a heal2x race's double —
  // narration only, the doubling arithmetic above is untouched.
  // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): `gained` is the HP
  // actually added after the clamp to max (additive, zero draws).
  events.push({ type: "potionDrunk", amount: amt, remaining: c.potions, ...(RACES[c.race].heal2x ? { doubled: c.race } : {}), gained: c.wp - before });
  if (state.combat) afterPlayerAction(state, rng, events);
  return events;
}

/**
 * scrollReadRng(state, rng) — RULES-10 (Phase 75.1): the ONE derived rng
 * stream an "intel" reader's d20 draws from — `derivedRng(<main rng cursor,
 * or 0 for a test double with no getState>, "scrollRead", <state.acts when a
 * non-negative integer, else 0>)`. Mirrors `items.js#pilferFumbleRng`'s own
 * pattern exactly. Never touches the caller's main `rng` — the roll never
 * reorders the main stream, so a Magic User/Runes reader's draws (which
 * never call this) stay byte-identical to before this phase.
 */
export function scrollReadRng(state, rng) {
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  return derivedRng(cursor, "scrollRead", acts);
}

/**
 * RUNES_KEEP_FACES / RUNES_KEEP_DIE — Phase 91.1 plan 02 (user ruling V14 B,
 * 2026-10-01): a scroll read through Runes/Signs is spent only 5 times in 6. The
 * keep is one winning face of a d6 (roll-high: atLeastFor(1, 6)), rolled on its
 * own derived stream, so a Runes reader's main-rng draws never move.
 */
export const RUNES_KEEP_FACES = 1;
export const RUNES_KEEP_DIE = 6;

/**
 * scrollKeepRng(state, rng) — the ONE derived stream the Runes/Signs keep roll
 * draws from: `derivedRng(<main cursor, or 0 for a test double>, "scrollKeep",
 * <state.acts>)`. Mirrors scrollReadRng (own purpose, so the two never share a
 * draw); never touches the caller's main `rng`.
 */
export function scrollKeepRng(state, rng) {
  const cursor = typeof rng.getState === "function" ? rng.getState() : 0;
  const acts = Number.isInteger(state.acts) && state.acts >= 0 ? state.acts : 0;
  return derivedRng(cursor, "scrollKeep", acts);
}

/**
 * scrollFreeCast(state, sp, rng, events, now) — the "pays for itself and
 * ignores your book" free cast every successful scroll read takes, shared by
 * all three readers (magicUser/runes/a successful intel roll). Pushes
 * `scrollCast`, then casts with the caster's own charge count zeroed and
 * restored around the call — `castSpell` itself calls `afterPlayerAction`
 * when `state.combat` is set.
 */
function scrollFreeCast(state, sp, rng, events, now) {
  const c = state.c;
  events.push({ type: "scrollCast", spell: sp.n });
  const saved = c.spellsUsed;
  c.spellsUsed = 0;
  c.scrollCast = true; // a scroll pays for itself and ignores your book
  castSpell(state, SPELLS.indexOf(sp), rng, events, now);
  c.spellsUsed = saved;
  c.scrollCast = false;
}

/**
 * readScroll(state, rng, events, now) — unrolls one carried scroll. Ports
 * mazeworld.html readScroll() (lines 2776-2794): a random spell (capped by
 * floor depth), transferred straight into a Magic User's grimoire if it's
 * learnable AND already castable, otherwise cast for free (ignoring the
 * caster's own charge economy and grimoire/level gates via `scrollCast`).
 *
 * RULES-10 (Phase 75.1, user 2026-09-24/25): `canRead`'s blanket class/skill
 * gate (and the Pilfer's own lockout inside it) is GONE — anyone may attempt
 * any scroll, and the scroll is consumed on EVERY attempt, success or
 * failure. `scrollReaderOf(c)` picks the read path:
 *   - "magicUser": today's path, byte-identical (the grimoire-copy/
 *     scrollTooAdvanced dance below, then the free cast) — no roll, no
 *     scroll-stream draw.
 *   - "runes": straight to the free cast, no roll, no grimoire copy (the
 *     grimoire stays Magic-User-only).
 *   - "intel": one d20 via `scrollReadRng` against `scrollReadBands(c.intel)`
 *     — `scrollReadOutcome` picks "read" (casts free, `scrollDeciphered`),
 *     "garbled" (a plain failure — `scrollGarbled`, nothing casts, the
 *     reader's turn still spends in combat), or "fumbled" (`scrollFumbled`;
 *     outside combat it just fizzles — `fizzled: true`, nothing else
 *     changes; in combat `resolveScrollFumble` turns it against the reader/
 *     their side/the target foe, then the reader's turn spends unless they
 *     just died). A Pilfer reads under exactly this rule — the RULES-09 d10
 *     item-fumble blast never applies to a scroll.
 *
 * DELIBERATE RULES CHANGE (Phase 40, SPELL-07, 2026-09-18): the prototype's
 * copy-to-grimoire condition checked only the spell's raw PRINTED level
 * against the caster's own level — never `schoolGate`. Five reachable
 * level-1 (sub, spell) pairs (Warlock+Heal, Court Mage+Map the Floor,
 * Apprentice+Map the Floor, Illusionist+Shield, Summoner+Freeze —
 * 40-RESEARCH.md "Scroll Scribing Bug") got scribed into the grimoire
 * permanently uncastable: the "scroll copied" narration implied success, but
 * the entry could never be cast until the caster's level caught up to its
 * OWN school's gate, which readScroll never checked. The scribe gate is now
 * exactly `canCast`'s own two checks (`spellLevelFor(c.sub, sp) <= c.level &&
 * c.level >= schoolGate(c.sub, sp.s)`) — a spell is scribed if and only if it
 * is ALREADY castable, so a scribed spell is always usable immediately. When
 * the checks fail, the scroll is NOT scribed — it pushes `scrollTooAdvanced
 * { spell, need, have, school }` (need = the higher of the two checks) and
 * falls through to the existing free-cast path unchanged (the scroll still
 * pays for itself once). Old saves that already carry a scribed-but-
 * uncastable entry from before this phase are untouched (tolerant — no
 * migration): `canCast`'s existing `spellSchoolLocked`/`spellAboveLevel`
 * refusal already names the level needed the next time that spell is cast.
 */
export function readScroll(state, rng, events = [], now = Date.now) {
  const c = state.c;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "scrollRefused")) return events;
  // Phase 25 (FEED-02): a named refusal, never a silent no-op — zero draws,
  // no mutation. This is the ONLY remaining scrollRefused reason besides the
  // pending-fight one above (RULES-10 retires `canRead`'s "pilfer"/"noRunes"
  // reasons entirely).
  if (!c.scrolls) {
    events.push({ type: "scrollRefused", reason: "noScrolls" });
    return events;
  }
  c.scrolls--;
  const options = SPELLS.filter((sp) => sp.lvl <= Math.min(5, state.floor.depth + 1));
  const sp = rng.pick(options);
  const reader = scrollReaderOf(c);

  if (reader === "magicUser") {
    events.push({ type: "scrollRead", spell: sp.n, reader });
    // "Scrolls contain spells; transfer to grimoire erases scroll."
    if (canLearn(c.sub, sp) && !c.grimoire.includes(sp.n)) {
      const need = Math.max(spellLevelFor(c.sub, sp), schoolGate(c.sub, sp.s));
      if (spellLevelFor(c.sub, sp) <= c.level && c.level >= schoolGate(c.sub, sp.s)) {
        c.grimoire.push(sp.n);
        events.push({ type: "scrollCopiedToGrimoire", spell: sp.n });
        return events;
      }
      events.push({ type: "scrollTooAdvanced", spell: sp.n, need, have: c.level, school: sp.s });
      // falls through to the free-cast path below — the scroll still pays
      // for itself once, exactly as a spell the caster could never learn.
    }
    scrollFreeCast(state, sp, rng, events, now);
    return events;
  }

  if (reader === "runes") {
    events.push({ type: "scrollRead", spell: sp.n, reader });
    // Phase 91.1 plan 02 (V14): one read in six keeps the scroll (the d6 on its
    // own derived stream), put back before the free cast so the cast sees the
    // scroll it did not spend. The event comes before the cast it precedes.
    if (rollCheck(scrollKeepRng(state, rng), RUNES_KEEP_DIE, atLeastFor(RUNES_KEEP_FACES, RUNES_KEEP_DIE)).ok) {
      c.scrolls++;
      events.push({ type: "scrollKept", spell: sp.n });
    }
    scrollFreeCast(state, sp, rng, events, now);
    return events;
  }

  // "intel": one d20 on its own derived stream, against the reader's own
  // intelligence — no floor, no ceiling, everyone else reads this way.
  events.push({ type: "scrollRead", spell: sp.n, reader });
  const stream = scrollReadRng(state, rng);
  const bands = scrollReadBands(c.intel);
  const check = rollCheck(stream, bands.dieN, bands.atLeast);
  const outcome = scrollReadOutcome(check, bands);

  if (outcome === "read") {
    events.push({ type: "scrollDeciphered", spell: sp.n, ...rollFields(check), intel: c.intel });
    scrollFreeCast(state, sp, rng, events, now);
    return events;
  }
  if (outcome === "garbled") {
    events.push({ type: "scrollGarbled", spell: sp.n, ...rollFields(check), intel: c.intel, fumbleAtLeast: bands.fumbleAtLeast });
    if (state.combat) afterPlayerAction(state, rng, events);
    return events;
  }
  // "fumbled": a fizzle outside combat destroys nothing but the scroll
  // already spent above; in combat the resolver turns it against the
  // reader/their side/the foe, then the reader's turn spends (a no-op if
  // the resolver just killed the reader — die() nulls state.combat).
  const fizzled = !state.combat;
  events.push({
    type: "scrollFumbled",
    spell: sp.n,
    ...rollFields(check),
    intel: c.intel,
    fumbleAtLeast: bands.fumbleAtLeast,
    ...(fizzled ? { fizzled: true } : {}),
  });
  if (state.combat) {
    resolveScrollFumble(state, sp, stream, rng, events, now);
    afterPlayerAction(state, rng, events);
  }
  return events;
}
