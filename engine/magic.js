// engine/magic.js
//
// The magic domain (ENG-01, ENG-05) — spellcasting across every SPELLS kind,
// potions, and scrolls. Ports mazeworld.html's castSpell/drinkPotion/
// canRead/readScroll (lines 2483-2794), replacing every D()/pick()-backed
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

import { skill, eff, canCast, canLearn, schoolBonus, schoolGate, resistRoll, spellLevelFor, afraidNeed, afraidDamage } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { liveFoes, killFoe, afterPlayerAction, refuseIfPending, normalizeTarget } from "./combat.js";
import { maxCharges } from "./movement.js";
import { GW, GH } from "./maze.js";
import { SPELLS, RACES, ENC_TYPES } from "../content/index.js";
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

// p.25: a non-thrown spell can be resisted by an intelligent target. These
// kinds are immune to that resistance check — ports mazeworld.html's inline
// array literal (line 2509) verbatim as a named set.
const RESIST_IMMUNE_KINDS = new Set(["thrown", "ward", "might", "regen", "heal", "reveal", "foresee", "summon", "mirror"]);

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
 * (its frozen-solid kill), Lightning's own `aoe` flag (its every-foe case),
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

  // an Apprentice's spells go wrong one time in eight
  if (c.sub === "Apprentice" && rng.d(8) === 1) {
    events.push({ type: "spellBackfired", spell: sp.n });
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

  // p.25: a non-thrown spell can be resisted by an intelligent target.
  // Phase 19 FOE-07 (D-07/D-17): the intel>=12 gate and the single d20 now
  // live in derived.js's resistRoll, shared with engine/foeAbilities.js's
  // hero-side check; byte-identical control flow and events (the gate is
  // the same boolean, relocated), so parity's cast-damage fixture (Shriek,
  // intel 1) never enters the rolled branch on either side.
  if (C && !RESIST_IMMUNE_KINDS.has(sp.kind)) {
    const t = liveFoes(state)[0];
    if (t) {
      const res = resistRoll(rng, t.intel);
      if (res.rolled) {
        if (res.resisted) {
          events.push({ type: "spellResisted", target: t.name, spell: sp.n, roll: res.roll, intel: t.intel });
          afterPlayerAction(state, rng, events);
          return events;
        }
        events.push({ type: "resistFailed", target: t.name, roll: res.roll });
      }
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
    if (doubled && rng.d(8) === 1) {
      const hurt = lvl * lvl + rng.d(6);
      c.wp -= hurt;
      // Phase 43 (CLAR-01, additive): spell/sub name the cause for the
      // narration; fixtures compare state, so this moves none.
      events.push({ type: "summonBackfired", amount: hurt, spell: sp.n, sub: c.sub });
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
        rounds: lesser ? rng.d(4) : (doubled ? 2 : 1) * rng.d(4) + 2,
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
    const n = spellDamageFor(rng.d(6) * Math.max(1, c.level - sp.lvl), c);
    const affected = liveFoes(state).slice(0, n);
    affected.forEach((f) => {
      f.asleep = Math.max(f.asleep, rng.d(4));
    });
    events.push({ type: "stunned", count: Math.min(n, liveFoes(state).length) });
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
    const rounds = rng.d(4) + 1;
    if (C) {
      C.weakened = true;
      C.foeToHitPenalty = 3;
      startEffect(c, "spell:weaken", { rounds });
    }
    events.push({ type: "weakened", rounds });
  } else if (sp.kind === "stupid") {
    const t = C && liveFoes(state)[0];
    if (t) {
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
    if (t && t.alive) {
      t.blind = true;
      events.push({ type: "blinded", target: t.name });
    }
  } else if (sp.kind === "shrink") {
    const n = rng.d(6);
    const affected = liveFoes(state).slice(0, n);
    affected.forEach((f) => {
      f.wp = Math.ceil(f.wp / 2);
      f.maxWP = Math.ceil(f.maxWP / 2);
      f.shrunk = true;
    });
    events.push({ type: "shrunk", count: affected.length });
  } else if (sp.kind === "acid") {
    const t = C && C.foes[C.target];
    if (t && t.alive) {
      t.acid = { rounds: rng.d(6), dmg: sp.dmg };
      events.push({ type: "acidApplied", target: t.name, rounds: t.acid.rounds });
    }
  } else if (sp.kind === "dot") {
    // Phase 40 (SPELL-01, Ice): the real per-round damage-over-time the
    // spell's txt has always promised — the exact `f.dot = { left, dmg, by }`
    // shape Poisoned Edge (Phase 38) and combat.js#foeTurn's existing tick
    // already read; this module never freezes anything itself — foeTurn's
    // own payoff does that when the last tick leaves the foe standing. One
    // draw (the duration); no to-hit roll, like Acid; resistible ("dot" is
    // absent from RESIST_IMMUNE_KINDS, so an intel >= 12 foe still gets its
    // d20 above); recasting on a foe already carrying an ice dot REFRESHES
    // `left` (overwrite), never stacks. T-40-03: guarded on `sp.dmg` — a
    // tampered/unknown dot row missing it never writes a broken record.
    const t = C && C.foes[C.target];
    if (t && t.alive && sp.dmg) {
      t.dot = { left: rng.d(4) + 1, dmg: sp.dmg, by: "ice" };
      events.push({ type: "iceApplied", target: t.name, rounds: t.dot.left });
    }
  } else if (sp.kind === "quake") {
    const mult = Math.max(1, c.level - sp.lvl);
    // Phase 31 Afraid: post-roll arithmetic only — the dice are drawn
    // exactly as before (zero rng change); halves every point the hero
    // deals through Earthquake while combat.afraid > 0 (a no-op otherwise).
    // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1,
    // no-op) sits between the roll and afraidDamage.
    const d = afraidDamage(state, spellDamageFor(rollDice(rng, sp.dmg) * mult, c));
    liveFoes(state).forEach((f) => {
      // Spell damage (CANON-04, D-11): per-foe multiplier/halfDmg/bypass —
      // the event below reports the single rolled base, not the per-foe
      // applied amount (each foe's own wp shows what actually landed).
      damageFoe(state, f, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
      if (f.wp <= 0) killFoe(state, f, rng, events);
    });
    events.push({ type: "earthquake", amount: d });
    if (!c.ward) {
      const self = Math.ceil(d / 2);
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
    const r = c.level >= 5 ? 4 : rng.d(6);
    events.push({ type: "vaporRolled", roll: r });
    liveFoes(state).forEach((f) => {
      if (r === 4 && rng.d(10) !== 1) {
        f.wp = 0;
        killFoe(state, f, rng, events);
      } else {
        f.asleep = Math.max(f.asleep, rng.d(6) + 2);
      }
    });
  } else if (sp.kind === "volley") {
    const n = rng.d(8);
    const foes = liveFoes(state);
    let tot = 0;
    for (let k = 0; k < n && foes.length; k++) {
      const t = foes[k % foes.length];
      if (!t.alive) continue;
      // Phase 31 Afraid: halves each Volley bolt the hero deals (post-roll
      // arithmetic, zero rng change; a no-op unless combat.afraid > 0).
      // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1).
      const d = afraidDamage(state, spellDamageFor(rollDice(rng, sp.dmg), c));
      // Spell damage (CANON-04, D-11): route through the seam; the volley
      // total sums APPLIED damage (post multiplier/halfDmg/bypass), not raw.
      const hit = damageFoe(state, t, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
      tot += hit.applied;
      if (t.wp <= 0) killFoe(state, t, rng, events);
    }
    events.push({ type: "volley", rolls: n, totalDamage: tot });
  } else if (sp.kind === "petrify") {
    const t = C && C.foes[C.target];
    if (t && t.alive) {
      t.alive = false;
      t.frozen = true;
      t.wp = 0;
      events.push({ type: "petrified", target: t.name });
    }
  } else if (sp.kind === "turn") {
    if (C && C.type === "Walking Dead") {
      const turned = liveFoes(state).filter((f) => f.lvl <= c.level);
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
      const gone = liveFoes(state).slice(0, rng.d(6));
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
    // the reported `cells` count is only the NEWLY-marked cells. startEffect
    // OVERWRITES any existing `spell:reveal` record, so a recast mid-window
    // simply refreshes the timer back to sp.squares. Zero rng draws.
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
    events.push({ type: "floorMapped", squares: sp.squares, cells });
  } else if (sp.kind === "foresee") {
    c.foresight = true;
    const type = rng.pick(ENC_TYPES);
    events.push({ type: "senseDanger", nextEncounter: type });
  } else if (sp.kind === "mirror") {
    c.mirror = rng.d(6);
    events.push({ type: "mirrorSelf", rounds: c.mirror });
  } else if (sp.kind === "ward") {
    c.ward = { pool: sp.pool, rounds: sp.rounds, reflect: !!sp.reflect, name: sp.n };
    events.push({ type: "wardRaised", spell: sp.n, pool: sp.pool, reflect: !!sp.reflect });
  } else if (sp.kind === "might") {
    c.might = rollDice(rng, sp.dmg);
    if (!c.strengthBoost) {
      c.strengthBoost = c.maxWP;
      c.maxWP += c.strengthBoost;
      c.wp += c.strengthBoost;
    }
    events.push({ type: "strengthCast", might: c.might });
  } else if (sp.kind === "regen") {
    c.regen = true;
    events.push({ type: "regenerationCast" });
  } else if (sp.kind === "insane") {
    const t = C && C.foes[C.target] && C.foes[C.target].alive ? C.foes[C.target] : liveFoes(state)[0];
    if (!t) {
      events.push({ type: "insaneNoTarget" });
    } else {
      const r = rng.d(6);
      events.push({ type: "insaneRolled", target: t.name, roll: r });
      if (r === 1) {
        t.wp = 0;
        killFoe(state, t, rng, events);
      } else if (r === 2) {
        const o = liveFoes(state).find((f) => f !== t);
        if (o) {
          const d = t.lvl * t.lvl + rng.d(6);
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
        t.asleep = rng.d(4);
      } else if (r === 5) {
        t.frenzied = true;
      }
    }
  } else if (sp.kind === "heal") {
    let amt = rollDice(rng, sp.dmg) + (c.sub === "Cleric" ? 3 : 0);
    if (RACES[c.race].heal2x) amt *= 2;
    c.wp = Math.min(c.maxWP, c.wp + amt);
    events.push({ type: "healed", amount: amt, spell: sp.n });
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
      t.asleep = rng.d(4);
      events.push({ type: "dozed", target: t.name, rounds: t.asleep });
    }
  } else {
    // thrown: d8, 4 to hit, plus the offensive bonus from the subclass chart
    const bonus = schoolBonus(c.sub, sp.s) + eff(c, "throw");
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
      // Phase 40 (SPELL-01): Freeze's own `onHit` data flag drives the
      // frozen-solid case below — replaces the old name-keyed check (a
      // direct comparison against the literal spell name "Freeze"), per
      // research Pitfall 2. The frozenSolid/killFoe/revive machinery below
      // is byte-identical to before this phase.
      const freeze = sp.onHit === "freeze";
      const dieN = freeze ? 10 : 8;
      // Phase 31 Afraid — to-hit is a LOW range, so the target SHRINKS
      // (4 → 1, Freeze 6 → 3), never the roll; pure arithmetic, zero rng;
      // fixture-visible only on the declared cast-damage record, where
      // d10 = 1 still lands (need 6 → 3, roll 1 still <= 3).
      const baseTarget = freeze ? 6 : 4;
      const target = afraidNeed(state, baseTarget);
      const afraidMods = target !== baseTarget ? [{ name: "afraid", delta: target - baseTarget }] : [];
      const roll = rng.d(dieN);
      events.push({ type: "spellThrown", spell: sp.n, target: t.name, roll, need: target, bonus, ...(afraidMods.length ? { needMods: afraidMods } : {}) });
      if (roll - bonus <= target) {
        // p.26: area, duration and effect are multiplied by (caster level − spell level)
        const mult = Math.max(1, c.level - sp.lvl);
        // Phase 31 Afraid: halves the hero's thrown-spell damage (post-roll
        // arithmetic, zero rng change; a no-op unless combat.afraid > 0).
        // Phase 54 (BAND-02, USER RULING D): spellDamageFor (identity 1).
        const dmg = afraidDamage(state, spellDamageFor(rollDice(rng, sp.dmg) * mult + eff(c, "spellDmg"), c));
        // Spell damage (D-06): bypasses foe armor entirely; eligible for the
        // CANON-04 multiplier table. `mult` in the event stays the level
        // multiplier above (unrelated to the seam's own multiplier); `dmg`
        // switches to the APPLIED amount.
        const hit = damageFoe(state, t, dmg, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
        events.push({ type: "spellHit", target: t.name, dmg: hit.applied, mult, ...(afraidMods.length ? { afraid: true } : {}) });
        if (freeze) {
          // DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, user decision): Freeze kills awarded nothing in the prototype — a bug, not a rule.
          // The prototype marked a frozen foe dead (alive=false, frozen=true, wp=0) and
          // never called killFoe — a Freeze kill paid no experience, coin, treasure
          // roll, kill count, or party split, even though Ice (level 3, the same
          // "thrown, then frozen" flavor) was never special-cased this way. Now the
          // same frozenSolid event and t.frozen flag still narrate the kill, but the
          // kill itself routes through killFoe like any other, so it pays like a
          // melee kill. Determinism: the extra draws (killFoe's d6 sp roll, d10 coin
          // roll, d20 treasure check, and the Beasts cooking d6) happen ONLY after a
          // successful Freeze hit — a miss draws exactly as before, and nothing draws
          // outside this branch. The only parity scenario that casts Freeze is
          // action-script.magic.json's cast-damage scenario (seed 8), declared under
          // FID-06 in this phase's Plan 04. Kill-twice note: a lives-2 creature now
          // shrugs off a Freeze once, per canon ("you have to kill it twice") — the
          // prototype let Freeze bypass the lives rule entirely.
          t.frozen = true;
          events.push({ type: "frozenSolid", target: t.name });
          killFoe(state, t, rng, events);
          if (t.alive) t.frozen = false; // killFoe's kill-twice `lives` rule revived it — a standing foe is not frozen
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
  let amt = 2 * rng.d(10) + 5;
  if (RACES[c.race].heal2x) amt *= 2;
  c.wp = Math.min(c.maxWP, c.wp + amt);
  // Phase 25 (FEED-01, additive payload): narrate a heal2x race's double —
  // narration only, the doubling arithmetic above is untouched.
  events.push({ type: "potionDrunk", amount: amt, remaining: c.potions, ...(RACES[c.race].heal2x ? { doubled: c.race } : {}) });
  if (state.combat) afterPlayerAction(state, rng, events);
  return events;
}

/**
 * canRead(state) — can this character make use of a scroll at all? Ports
 * mazeworld.html canRead() (lines 2772-2775). A Pilfer never gets to use a
 * magic item; everyone else needs to be a Magic User or carry Runes/Signs.
 */
export function canRead(state) {
  const c = state.c;
  if (c.sub === "Pilfer") return false;
  return c.cls === "Magic User" || skill(c, "Runes/Signs");
}

/**
 * readScroll(state, rng, events) — unrolls one carried scroll. Ports
 * mazeworld.html readScroll() (lines 2776-2794): a random spell (capped by
 * floor depth), transferred straight into a Magic User's grimoire if it's
 * learnable AND already castable, otherwise cast for free (ignoring the
 * caster's own charge economy and grimoire/level gates via `scrollCast`).
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
export function readScroll(state, rng, events = []) {
  const c = state.c;
  // CMB-01 (Phase 31): refuseIfPending is the FIRST check.
  if (refuseIfPending(state, events, "scrollRefused")) return events;
  // Phase 25 (FEED-02): the combined guard is split so each refusal names
  // its own reason instead of failing silently — zero draws, no mutation,
  // both checks sit BEFORE `c.scrolls--` and the rng.pick below.
  if (!c.scrolls) {
    events.push({ type: "scrollRefused", reason: "noScrolls" });
    return events;
  }
  if (!canRead(state)) {
    events.push({ type: "scrollRefused", reason: c.sub === "Pilfer" ? "pilfer" : "noRunes" });
    return events;
  }
  c.scrolls--;
  const options = SPELLS.filter((sp) => sp.lvl <= Math.min(5, state.floor.depth + 1));
  const sp = rng.pick(options);
  events.push({ type: "scrollRead", spell: sp.n });
  // "Scrolls contain spells; transfer to grimoire erases scroll."
  if (c.cls === "Magic User" && canLearn(c.sub, sp) && !c.grimoire.includes(sp.n)) {
    const need = Math.max(spellLevelFor(c.sub, sp), schoolGate(c.sub, sp.s));
    if (spellLevelFor(c.sub, sp) <= c.level && c.level >= schoolGate(c.sub, sp.s)) {
      c.grimoire.push(sp.n);
      events.push({ type: "scrollCopiedToGrimoire", spell: sp.n });
      return events;
    }
    events.push({ type: "scrollTooAdvanced", spell: sp.n, need, have: c.level, school: sp.s });
    // falls through to the free-cast path below — the scroll still pays for
    // itself once, exactly as a spell the caster could never learn at all.
  }
  events.push({ type: "scrollCast", spell: sp.n });
  const saved = c.spellsUsed;
  c.spellsUsed = 0;
  c.scrollCast = true; // a scroll pays for itself and ignores your book
  castSpell(state, SPELLS.indexOf(sp), rng, events);
  c.spellsUsed = saved;
  c.scrollCast = false;
  return events;
}
