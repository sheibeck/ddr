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

import { eff, canCast, canLearn, schoolBonus, schoolGate, spellTargetsFoe, spellLevelFor, afraidNeed, afraidDamage, applyCasterHealMul, scrollReaderOf, scrollReadBands, scrollReadOutcome, spellLevelSq } from "./derived.js";
import { rollDice, rollCheck, atLeastFor, rollFields } from "./dice.js";
import { die } from "./death.js";
import { liveFoes, killFoe, afterPlayerAction, refuseIfPending, normalizeTarget, shatterIfBest, resistControl, holdFoe, foeResistsSpell, roomWeakenResists, freezeFoe } from "./combat.js";
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
import { spellDamageFor, controlHoldRoundsFor } from "./difficulty.js";

// DELIBERATE RULES CHANGE (quick 260927-rsx, user ruling 2026-09-27: "Every
// spell cast on an enemy should have a chance to be resisted based on their
// intelligence"). Canon p.25 (mazeworld.html line 2509) let only an
// intel >= 12 target resist, and never a thrown spell. Now every foe a spell
// targets rolls combat.js#foeResistsSpell (derived.js#foeSpellResistRoll,
// half-intel faces on a d20), thrown damage included; a resisted spell has
// no effect on that foe. Only derived.js#SPELL_SELF_KINDS (the caster's own
// body, side or map) is never resisted.
//
// SINGLE_TARGET_KINDS — the foe-targeted kinds that land on ONE foe: its
// resist is rolled up front, before the kind branch, and a resist ends the
// cast right there (the turn and the charge are spent, nothing else draws —
// canon's own spellResisted shape). Each names the foe its own branch
// resolves: `target` is the hero's live target (C.target, normalized),
// `first` the first live foe. A single-target thrown spell (no `aoe`) is
// "target". Every other foe-targeted kind (stun, weaken, shrink, quake,
// vapor, volley, turn, gate, and a thrown `aoe: "all"`) resists per foe
// inside its own branch.
const SINGLE_TARGET_KINDS = Object.freeze({
  stupid: "first",
  status: "first",
  death: "first",
  blind: "target",
  acid: "target",
  dot: "target",
  petrify: "target",
  insane: "target",
  thrown: "target",
});

// Phase 40 (SPELL-01/SPELL-04): the summon branch's two ally name tables,
// moved to module consts (byte-identical strings, same order) so both the
// full Summon/Phantom Host table and the new Lesser Summon table live in one
// place. ALLY_NAMES is the pre-Phase-40 inline literal, unchanged.
const ALLY_NAMES = ["A horned thing", "Something with too many arms", "A shape that hurts to look at", "A tall grey silence"];
const LESSER_ALLY_NAMES = [
  "A thing with one horn, mostly",
  "Something with nearly enough arms",
  "A small grey sulk",
  "A shape that is mildly upsetting to look at",
];

/**
 * castSpell(state, idx, rng, events, now) — resolves SPELLS[idx] by kind.
 * Ports mazeworld.html castSpell() (lines 2483-2672): the charge check,
 * grimoire/school gating (skipped for a scroll-cast spell), the Apprentice's
 * one-in-eight backfire, the intelligent-target resistance roll, and every
 * spell kind's effect (heal/ward/might/status/thrown/reveal/mirror/stun/
 * weaken/acid/dot/quake/vapor/volley/petrify/insane/summon/turn/gate/senses/
 * foresee/regen/death/stupid/blind/shrink). A bad `idx` (T-01-09a: no
 * validated range check upstream) is a safe no-op.
 *
 * Phase 40 (SPELL-01, research Pitfall 2): the thrown branch and the summon
 * branch read DATA FLAGS, never a spell name — Freeze's own `onHit` flag
 * (its damage-then-freeze tail), Lightning's own `aoe` flag (its every-foe case),
 * Lesser Summon's own `lesser` flag (its no-doubling/no-backfire rule) — so a
 * content-table rename can never silently break any of the three. See the
 * thrown branch and the summon branch below for the exact comparisons.
 */
export function castSpell(state, idx, rng, events = [], now = Date.now) {
  const sp = SPELLS[idx];
  if (!sp) return events;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "castRefused", { spell: sp.n })) return events;
  const c = state.c;
  const C = state.combat;

  if (maxCharges(c) - c.spellsUsed <= 0) {
    events.push({ type: "noChargesLeft" });
    return events;
  }
  if (!c.scrollCast && !canCast(state, sp)) {
    if (!c.grimoire || !c.grimoire.includes(sp.n)) {
      events.push({ type: "spellNotKnown", spell: sp.n });
    } else if (spellLevelFor(c.sub, sp) > c.level) {
      // Phase 23 (IDENT-03/IDENT-04): one definition of "effective level" —
      // spellLevelFor honors the per-sub override table (Summoner/Summon,
      // Illusionist/Phantom Host) so this diagnostic can never disagree with
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

  c.spellsUsed++;
  if (C) C.spellOpen = false;

  // an Apprentice's spells go wrong one time in eight — Phase 73 (ROLL-05):
  // a natural-1 mishap gate is not mirrored (a 1 is always the worst face);
  // drawn ONLY for an Apprentice, on its own line so the guard can tag it —
  // the ternary preserves the old `&&` short-circuit exactly (a non-
  // Apprentice draws nothing here).
  const apprenticeBackfireRoll = c.sub === "Apprentice" ? rng.d(8) : null; // roll:mishap-on-1
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
    if (state.combat) afterPlayerAction(state, rng, events);
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
      afterPlayerAction(state, rng, events);
      return events;
    }
  }

  if (sp.kind === "summon") {
    // Phase 40 (SPELL-04): `sp.lesser === true` (Lesser Summon, the new
    // level-1 row) is a data flag, never a spell name — the Summoner's
    // doubled-creature and one-in-eight backfire rules NEVER apply to it (it
    // is the safe, small trick the user ruling asked for). `doubled` stays
    // exactly the pre-Phase-40 Summoner rule for every OTHER summon kind
    // (Summon, Phantom Host).
    const lesser = sp.lesser === true;
    const doubled = c.sub === "Summoner" && !lesser; // a Summoner's FULL creatures come doubled
    const lvl = lesser ? Math.max(1, Math.min(3, c.level - 1)) : Math.min(5, c.level + (doubled ? 1 : 0));
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
        // Lesser Summon: a plain d4, never doubled, never the +2 tacked onto
        // the full table's roll — shorter, and never lengthened by a
        // Summoner's own doubling (it isn't doubled here at all).
        rounds: lesser ? rng.d(4) : (doubled ? 2 : 1) * rng.d(4) + 2, // roll:amount
        name: rng.pick(lesser ? LESSER_ALLY_NAMES : ALLY_NAMES),
      };
      if (C) {
        C.ally = ally;
        events.push({ type: "allySummoned", name: ally.name, rounds: ally.rounds, lvl: ally.lvl, ...(lesser ? { lesser: true } : {}) });
      } else {
        c.pendingAlly = ally;
        events.push({ type: "allyPending", name: ally.name, rounds: ally.rounds, lvl: ally.lvl, ...(lesser ? { lesser: true } : {}) });
      }
    }
  } else if (sp.kind === "stun") {
    // Phase 54 (BAND-02, USER RULING D): spellDamageFor scales an MU's
    // offensive spell POWER — here, how many foes the stun affects.
    // Identity 1 (spellPowerFor) is a structural no-op.
    // Quick 260928-sq2: the p.26 multiplier keeps scaling Stun's REACH (not
    // damage), so this count is untouched by the level² damage ruling.
    const n = spellDamageFor(rng.d(6) * Math.max(1, c.level - sp.lvl), c); // roll:amount
    const affected = liveFoes(state).slice(0, n);
    // RULES-18 (Phase 75.3, audit C8): past the knee each affected foe gets
    // its own resist; its d4 is drawn in the same position either way, and
    // `count` is the number that actually slept (every affected foe at or
    // below the knee, exactly as before).
    // Quick 260927-rsx: each affected foe first rolls its own intel resist
    // (a derived stream); a foe that resists sleeps not at all and draws no
    // d4. The foe count (the d6 above) is the cast's own and is drawn first.
    let slept = 0;
    affected.forEach((f) => {
      if (foeResistsSpell(state, f, sp.n, rng, events)) return;
      const rolled = rng.d(4); // roll:amount
      if (resistControl(state, f, "sleep", sp.n, C.foes.indexOf(f), rng, events)) return;
      f.asleep = Math.max(f.asleep, rolled);
      slept++;
    });
    events.push({ type: "stunned", count: slept });
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
    // own intel resist (roomWeakenResists, C.foes order); when all resist,
    // nothing lands. Otherwise RULES-18 (Phase 75.3, audit C14) keeps its
    // one depth resist for the whole room, keyed on the foe the caster aimed
    // at (the current target, else the first live foe); a depth resist
    // marks every live foe Unmoved and starts nothing. A landed Weaken skips
    // every foe that resisted (f.weakenResisted, derived.js#foeWeakened).
    // The d4 + 1 above is drawn either way.
    const aimed = C && (C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : liveFoes(state)[0]);
    if (!C || roomWeakenResists(state, aimed, sp.n, rng, events)) {
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
    const t = C && liveFoes(state)[0];
    // RULES-18 (Phase 75.3, audit C17): past the knee a resist first, then a
    // stupid HOLD for controlHoldRoundsFor(depth) rounds instead of the
    // fight-long flag; at or below the knee exactly as before.
    if (t && resistControl(state, t, "stupid", sp.n, C.foes.indexOf(t), rng, events)) {
      // shaken off: the foe keeps its wits (resistControl narrated it)
    } else if (t && controlHoldRoundsFor(state.floor.depth) > 0) {
      holdFoe(state, t, "stupid", sp.n, events);
    } else if (t) {
      t.stupid = true;
      // DELIBERATE RULES CHANGE (Phase 40, SPELL-01, CONTEXT "Stupidity
      // (single, the fight)"): the old rng.d(10) nap is retired — Stupidity
      // now disables the target for the REST OF THE FIGHT via
      // combat.js#foeTurn's f.stupid skip (it never reaches its own melee/
      // ability turn again) instead of a timed sleep. Zero draws.
      events.push({ type: "stupefied", target: t.name });
    }
  } else if (sp.kind === "blind") {
    const t = C && C.foes[C.target];
    // RULES-18 (Phase 75.3, audit C18): past the knee a resist first, then a
    // timed blind (the existing blindFor countdown, controlHoldRoundsFor
    // rounds) instead of blind for the whole fight; at or below the knee
    // exactly as before.
    if (t && t.alive && !resistControl(state, t, "blind", sp.n, C.foes.indexOf(t), rng, events)) {
      t.blind = true;
      const hold = controlHoldRoundsFor(state.floor.depth);
      if (hold > 0) {
        t.blindFor = hold;
        events.push({ type: "blinded", target: t.name, rounds: hold });
      } else {
        events.push({ type: "blinded", target: t.name });
      }
    }
  } else if (sp.kind === "shrink") {
    const n = rng.d(6); // roll:amount
    const affected = liveFoes(state).slice(0, n);
    // RULES-18 (Phase 75.3, audit C19): past the knee each affected foe gets
    // its own resist; only those that did not resist are halved, and `count`
    // counts the halved (every affected foe at or below the knee).
    // Quick 260927-rsx: the intel resist comes first, per affected foe.
    let halved = 0;
    affected.forEach((f) => {
      if (foeResistsSpell(state, f, sp.n, rng, events)) return;
      if (resistControl(state, f, "shrink", sp.n, C.foes.indexOf(f), rng, events)) return;
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
  } else if (sp.kind === "dot") {
    // Phase 40 (SPELL-01, Ice): the real per-round damage-over-time the
    // spell's txt has always promised — the exact `f.dot = { left, dmg, by }`
    // shape Poisoned Edge (Phase 38) and combat.js#foeTurn's existing tick
    // already read; this module never freezes anything itself — foeTurn's
    // own payoff does that when the last tick leaves the foe standing. One
    // draw (the duration); no to-hit roll, like Acid; resistible (a
    // SINGLE_TARGET_KINDS entry, so the target rolls its intel resist
    // above); recasting on a foe already carrying an ice dot REFRESHES
    // `left` (overwrite), never stacks. T-40-03: guarded on `sp.dmg` — a
    // tampered/unknown dot row missing it never writes a broken record.
    const t = C && C.foes[C.target];
    if (t && t.alive && sp.dmg) {
      // Quick 260928-sq2: the caster's level² rides the record to its first
      // tick (as Acid's does); Poisoned Edge's dot never carries one.
      t.dot = { left: rng.d(4) + 1, dmg: sp.dmg, by: "ice", levelSq: spellLevelSq(c) }; // roll:amount
      events.push({ type: "iceApplied", target: t.name, rounds: t.dot.left, levelSq: t.dot.levelSq });
    }
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
    const rolled = rollDice(rng, sp.dmg);
    const d = afraidDamage(state, spellDamageFor(rolled + spellLevelSq(c), c));
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
    events.push({ type: "earthquake", amount: d });
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
        // RULES-18 (Phase 75.3, audit C10): the sleep outcome's d6 + 2 is
        // drawn in its existing position, then a per-foe resist past the knee.
        const rolled = rng.d(6) + 2; // roll:amount
        if (resistControl(state, f, "sleep", sp.n, C.foes.indexOf(f), rng, events)) return;
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
    for (let k = 0; k < n && foes.length; k++) {
      const t = foes[k % foes.length];
      if (!t.alive || shrugged.has(t)) continue;
      const first = !struck.has(t);
      struck.add(t);
      // Phase 31 Afraid: halves each Volley bolt the hero deals (post-roll
      // arithmetic, zero rng change; a no-op unless combat.afraid > 0).
      // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1).
      const d = afraidDamage(state, spellDamageFor(rollDice(rng, sp.dmg) + (first ? levelSq : 0), c));
      // Spell damage (CANON-04, D-11): route through the seam; the volley
      // total sums APPLIED damage (post multiplier/halfDmg/bypass), not raw.
      const hit = damageFoe(state, t, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
      tot += hit.applied;
      if (t.wp <= 0) killFoe(state, t, rng, events);
    }
    events.push({ type: "volley", rolls: n, totalDamage: tot });
  } else if (sp.kind === "petrify") {
    const t = C && C.foes[C.target];
    // RULES-18 (Phase 75.3, audit C5): past the knee a resist first, then a
    // stone HOLD (the foe stays in the fight) instead of the removal; at or
    // below the knee exactly as before (removed, no spoils).
    if (t && t.alive && resistControl(state, t, "stone", sp.n, C.foes.indexOf(t), rng, events)) {
      // shaken off: the foe stays flesh (resistControl narrated it)
    } else if (t && t.alive && controlHoldRoundsFor(state.floor.depth) > 0) {
      holdFoe(state, t, "stone", sp.n, events);
    } else if (t && t.alive) {
      t.alive = false;
      t.frozen = true;
      t.wp = 0;
      events.push({ type: "petrified", target: t.name });
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
      c.ward = { name: sp.n, mirror: true, pool: 0, popPool: sp.popPool, rounds: null };
      events.push({ type: "wardRaised", spell: sp.n, pool: 0, mirror: true, popPool: sp.popPool });
    } else {
      c.ward = { pool: sp.pool, rounds: sp.rounds, name: sp.n };
      events.push({ type: "wardRaised", spell: sp.n, pool: sp.pool });
    }
  } else if (sp.kind === "might") {
    c.might = rollDice(rng, sp.dmg);
    const before = c.wp;
    if (!c.strengthBoost) {
      c.strengthBoost = c.maxWP;
      c.maxWP += c.strengthBoost;
      c.wp += c.strengthBoost;
    }
    // VOX-05 (Phase 79, plan 79-08): `gained` is the HP the cast added (the
    // doubling happens once a day, so a recast adds 0) and `maxWP` the new
    // ceiling, so the cast line can state the boost. Additive, zero draws.
    events.push({ type: "strengthCast", might: c.might, gained: c.wp - before, maxWP: c.maxWP });
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
        // RULES-18 (Phase 75.3, audit C11): the d4 is drawn in its existing
        // position, then a resist past the knee.
        const rolled = rng.d(4); // roll:amount
        if (!resistControl(state, t, "sleep", sp.n, C.foes.indexOf(t), rng, events)) t.asleep = rolled;
      } else if (r === 5) {
        t.frenzied = true;
      }
    }
  } else if (sp.kind === "heal") {
    let amt = rollDice(rng, sp.dmg) + (c.sub === "Cleric" ? 3 : 0);
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
      c.spellsUsed--;
      return events;
    }
    c.wp -= DEATH_SPELL_FEE;
    const t = liveFoes(state)[0];
    events.push({ type: "deathCast", cost: DEATH_SPELL_FEE });
    if (t) {
      t.wp = 0;
      killFoe(state, t, rng, events);
    }
  } else if (sp.kind === "status") {
    const t = C && liveFoes(state)[0];
    if (t) {
      // RULES-18 (Phase 75.3, audit C7): the d4 is drawn in its existing
      // position, then a resist past the knee (a resisted Doze sleeps nobody).
      const rolled = rng.d(4); // roll:amount
      if (!resistControl(state, t, "sleep", sp.n, C.foes.indexOf(t), rng, events)) {
        t.asleep = rolled;
        events.push({ type: "dozed", target: t.name, rounds: t.asleep });
      }
    }
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
        const dmg = afraidDamage(state, spellDamageFor(rollDice(rng, sp.dmg) + levelSq + eff(c, "spellDmg"), c));
        // Spell damage (D-06): bypasses foe armor entirely; eligible for the
        // CANON-04 multiplier table. `levelSq` in the event is the level
        // term above (the narration says "the roll +N, for your level");
        // `dmg` is the APPLIED amount.
        const hit = damageFoe(state, t, dmg, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
        events.push({ type: "spellHit", target: t.name, dmg: hit.applied, levelSq, ...(afraidMods.length ? { afraid: true } : {}) });
        if (freeze) {
          // DELIBERATE RULES CHANGE (user rulings 2026-09-28): "freeze should
          // never kill outright. It should deal its damage and freeze an
          // enemy for 1d4 rounds." and "if it hits and resists, deal damage,
          // but no freeze." The frozen-solid kill (Phase 23's killFoe route
          // at or below the knee) and the RULES-18 controlHoldRoundsFor hold
          // past it are both retired. The damage has landed (above); a blow
          // that drops the target to 0 hp is a normal kill (killFoe, no
          // frozenSolid). A survivor draws one new d4 (the hold's rounds,
          // right after the damage, resisted or not), then rolls its intel
          // resist (the 2026-09-27 derived stream, rolled HERE, after the
          // damage, never before the throw), then the RULES-18 control resist
          // past the knee, then freezes for the d4's rounds
          // (combat.js#freezeFoe, shared with a Joiner's cast and the Birch
          // Staff). A miss rolls no resist at all.
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
  if (state.combat) afterPlayerAction(state, rng, events);
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
