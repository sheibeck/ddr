// engine/movement.js
//
// The movement domain (ENG-01, ENG-05) — the first rule domain routed
// through applyAction, and the walking skeleton's proof slice. Ports
// mazeworld.html's move/newDay/makeCamp/teleport/bestTeleportDir/descend
// (lines 1614-1868), replacing every D()/pick()-backed Math.random()
// draw with the injected engine rng (in the prototype's exact consumption
// order), and every say()/evt()/beginEvent() narration call with a pushed
// `{type, ...}` event. No DOM, no localStorage, no Math.random, no global S
// — every function here takes an explicit `state` (already a fresh
// applyAction clone) and mutates it directly, matching the applyAction seam.
//
// Feature-tile dispatch on the destination cell ("dot"/"trap"/"chest"/
// "tele"/"exit"/"gate") is fully wired as of 01-10: "dot"/"trap"/"chest" now
// call the real encounterDot/springTrap/openChest handlers from
// engine/encounters.js (the 01-07/01-09 stubs that only pushed a "pending*"
// event are gone), alongside the already-complete "tele" (teleport) path.
// As of 03-02 (endless descent, RUN-02/RUN-04): genFloor never emits "gate"
// anymore, so "exit" is the only descent tile a freshly-generated floor can
// have; the "gate" branch survives ONLY as legacy-save compatibility — an
// in-flight save from before this change may still hold a "gate" tile, and
// stepping onto it now routes to descend(), so permadeath is the sole run
// terminator (Phase 46, DEAD-04: the unreachable win path is gone entirely).
// Circular import with engine/encounters.js
// (encounterDot/springTrap/openChest call back into teleport() here;
// move()/teleport() call them) is safe — see engine/encounters.js's header
// comment for why.

import { GW, GH, genFloor, reveal, refogSpellSeen } from "./maze.js";
import { difficultyCurve, scaleHazard, heroSpFor, heroRegenFor, campHealFor, wanderWakeFacesFor } from "./difficulty.js";
import { skill, skillTier, upkeep, eff, revealRadius, isFlying, armorBulk, itemEffectActive, activationFor, hasTool, moveCost, inStone } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { checkLevel } from "./character.js";
import { startCombat } from "./combat.js";
import { encounterDot, springTrap, openChest } from "./encounters.js";
import { moved, floorChanged, floorRegen } from "./events.js";
import { CLIMB_TABLE, LEAP_TABLE, DIRECTION_TABLE, RACES, TOOLS, ACTIVATION_OF } from "../content/index.js";
import { tickSquares } from "./effects.js";
import { narrateTimerTransitions, toolIndex } from "./items.js";
import { isDeadEnd, checkTerrainPhobias, noteHeightsAttempt, resetFloorPhobiaRegions } from "./phobias.js";

/** DIRV — the four cardinal direction vectors. Ports mazeworld.html line 1615. */
export const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// DELIBERATE RULES CHANGE (04.1-06, 2026-09-09, PHOBIA-01): the Heights and
// Bodies-of-water phobias (both `t: null` in content/flavor.js's PHOBIAS
// catalog — inert per 04.1-RESEARCH.md's audit) get a documented, DETERMINISTIC
// penalty added to the climb/leap roll COMPARISON (`r`) below, never a new
// rng draw — the plan-checker's own design constraint, kept so the movement
// path stays trivially parity/determinism-safe. Hardiness halves the
// magnitude (rounded), mirroring the "phobias halved" mitigation the 5
// type-matched combat phobias already use, just applied as a deterministic
// value here instead of a 50%-chance mitigation roll (there is no rng draw
// in this path to mitigate).
const HEIGHTS_PHOBIA_PENALTY = 2;
const WATER_PHOBIA_PENALTY = 2;
/** heightsPenalty(c) — added to the climb roll `r` for a Heights-phobic character. */
const heightsPenalty = (c) =>
  c.phobia === "Heights" ? (skill(c, "Hardiness") ? Math.round(HEIGHTS_PHOBIA_PENALTY / 2) : HEIGHTS_PHOBIA_PENALTY) : 0;
/** waterPenalty(c) — added to the gorge/crevice leap roll `r` for a Bodies-of-water-phobic character. */
const waterPenalty = (c) =>
  c.phobia === "Bodies of water" ? (skill(c, "Hardiness") ? Math.round(WATER_PHOBIA_PENALTY / 2) : WATER_PHOBIA_PENALTY) : 0;

// DELIBERATE RULES CHANGE (04.1-06, 2026-09-09, PHOBIA-01): the Being-trapped
// phobia (also `t: null`, also inert) gets a fear reaction on a genuine ENTRY
// into an enclosed (dead-end) tile — one with exactly one non-wall orthogonal
// neighbor. Debounced per the plan's explicit WARNING via a marker on the
// TILE ITSELF (`there.trapPanicked`), not a new chargen field — so a player
// who leaves and later re-enters the identical dead-end tile never re-fires
// the penalty ("a second consecutive attempt at the same dead-end" in the
// plan's own language), and no new save-shape/parity carve-out is needed
// (the marker only ever appears on a tile a Being-trapped-phobic character
// has actually panicked in — every other character's save/parity surface is
// untouched). No rng draw either way.
const TRAPPED_PHOBIA_PANIC = 4;

// 260918-w4n: the old Cloak of Healing / Cloak of Regeneration per-step tick
// (CLOAK_TICK_SQUARES/CLOAK_HEAL_PER_TICK) is REMOVED — the dropped healing
// cloak no longer exists, and the Cloak of Regeneration is now use-activated
// (a flat d6 on use, engine/items.js#useItem's "knit" case) rather than an
// automatic per-step tick.
// isDeadEnd(f, x, y) — does (x,y) have exactly one (or zero) non-wall
// orthogonal neighbor? MOVED to engine/phobias.js (Phase 41, TERR-04) since
// the new phobia region model needs it too (its own leave-check for Being
// trapped) — imported above, still used by trappedPanic's entry check below
// exactly as before.

/** maxCharges(c) — a Magic User's spell charges. Ports mazeworld.html line 914. */
export const maxCharges = (c) => 2 * c.level + 2 + eff(c, "charges");

/**
 * resolveEtherEnd(state, rng, events, now) — 260919-00d (user ruling
 * 2026-09-19: "if your movement ends when you are in a wall, you die"): the
 * ONE home of the entombment rule. A no-op (returns `events` unchanged)
 * unless the party's CURRENT cell is solid rock (`inStone(state)`) or the
 * state is already dead; otherwise pushes an entombed event and calls
 * the same permadeath terminator every other death cause funnels through —
 * `die(state, "entombed", null, rng, events, now)` (mirrors starve/fall/
 * gorge exactly: forfeits pending loot, fills `state.deathNote` from
 * `CAUSE_TEXT.entombed`, draws the epitaph from `EPITAPHS.entombed` via the
 * injected rng's own pick, pushes `died`).
 *
 * Today the ONLY caller is `move`'s per-step `c.timers` tick block below,
 * the instant an `ether`-kind item effect transitions out of its "effect"
 * phase — but this is deliberately its own exported function, not inlined
 * there: any FUTURE early-end path (a dispel, the cloak destroyed, a rule
 * that clears `c.timers` directly) must call THIS function rather than
 * re-implementing the in-stone check, so the entombment rule never drifts
 * out of sync across two call sites.
 */
export function resolveEtherEnd(state, rng, events = [], now = Date.now) {
  if (state.dead || !inStone(state)) return events;
  events.push({ type: "entombed" });
  die(state, "entombed", null, rng, events, now);
  return events;
}

/* ---------------- movement ---------------- */

/**
 * move(state, dir, rng, events, now, opts) — the core traversal action.
 * Ports mazeworld.html move() (lines 1618-1715). Mutates `state` (a fresh
 * applyAction clone) in place and pushes structured events; returns
 * `events`. A wall/out-of-bounds move, or a one-way door entered/exited from
 * the wrong side, is a no-op: no state mutation beyond (for the door case) a
 * pushed event.
 *
 * Phase 39 (GEAR-05): `opts.tool` ("ladder"|"rope") is the ONE extra
 * caller-facing knob, set ONLY by `useTool` below (never passed directly by
 * `applyAction`'s "move" case) — the tile/bag are already validated by the
 * time it arrives, so the climb/gorge block's tool branch does no further
 * legality checking, only the spend. Every plain `move(state, dir, rng,
 * events, now)` call (every fixture, the bot, every existing caller) passes
 * no fifth argument, so `opts` defaults to `{}` and the tool branch never
 * runs for them — byte-identical to before this plan.
 */
export function move(state, dir, rng, events = [], now = Date.now, opts = {}) {
  if (state.combat || state.store || state.dead) return events;

  const f = state.floor;
  const [dx, dy] = DIRV[dir];
  const nx = f.px + dx;
  const ny = f.py + dy;
  if (!f.g[ny] || !f.g[ny][nx]) return events;
  // DELIBERATE RULES CHANGE (260919-00d, user ruling 2026-09-19 — "the
  // Cloak of Ether should literally let you traverse through the stone
  // walls... you are not limited to the paths and travel on any squares"):
  // a wall destination (the 21x21 border ring included) is refused ONLY
  // when no `ether` item effect is currently live (itemEffectActive reads
  // ONLY a running `item:<name>` c.timers record — a bagged/worn-but-unused
  // Cloak of Ether is never live). Every fixture (none carries a `timers`
  // key, none ever calls `useItem`) takes the exact same byte-identical
  // refusal as before this plan; the accepted wall step below draws
  // nothing (zero rng), so parity/determinism are unaffected for everyone
  // else. One-way doors (below) are unaffected either way — ether does not
  // override a door, and a wall cell has `feat: null` so the approach check
  // never fires there.
  if (f.g[ny][nx].wall && !itemEffectActive(state.c, "ether")) return events;

  const here = f.g[f.py][f.px];
  const there = f.g[ny][nx];
  if (there.feat === "one" && there.dir !== dir) {
    events.push({ type: "oneWayBlocked", side: "approach" });
    return events;
  }
  if (here.feat === "one" && here.dir !== dir) {
    events.push({ type: "oneWayBlocked", side: "departure" });
    return events;
  }

  // p.49: climbing is a d10 per ten feet by wall type; leaping is a d10 by
  // distance and class.
  if (there.feat === "climb" || there.feat === "gorge") {
    const climbing = there.feat === "climb";
    // 260918-w4n (use-activated-only, user ruling 2026-09-18): flight
    // (a LIVE `fly`-kind item effect — the Cloak of Flying or the Bracelet
    // of Flight, whichever was actually used) skips the climb/leap roll AND
    // all fall-damage math entirely — "walls and crevices are nothing" and
    // "flight ... once every 50" — but ONLY while a record is already live.
    // The old auto-activation (a Cloak-only character starting a fresh
    // flight record right here, the moment isFlying returned true for a
    // merely-READY item) is REMOVED: nothing starts a record but `useItem`
    // on a WORN item. flyOver is now pure bookkeeping for an already-live
    // window; the per-step tick burns it down exactly as before.
    const flyOver = () => {
      events.push({ type: "flownOver" });
      there.feat = null;
    };
    if (opts.tool) {
      // Phase 39 (GEAR-05): reached ONLY from `useTool` below, which has
      // already validated the tile and the bag — this branch does the
      // spend, nothing else. `isFlying` is checked FIRST even here: flight
      // is unconditional/free, a tool is a spent resource, so a flying hero
      // tapping USE LADDER/USE ROPE still flies over for free and keeps the
      // tool (mirrors the plain-flight branch below exactly, via the same
      // `flyOver` closure).
      if (isFlying(state)) {
        flyOver();
      } else {
        const i = toolIndex(state.c, opts.tool);
        const [used] = state.c.items.splice(i, 1);
        events.push({ type: "toolUsed", tool: opts.tool, feat: there.feat, item: used });
        there.feat = null;
        state.pendingHazard = null;
      }
    } else if (isFlying(state)) {
      flyOver();
    } else if (itemEffectActive(state.c, "ether")) {
      // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08 §8 design call):
      // while the Cloak of Ether's "item:Cloak of Ether" effect is live
      // (itemEffectActive(state.c, "ether"), a c.timers record since Phase
      // 39), you phase through the wall/crevice with no climb/leap roll and
      // no fall damage — mirroring isFlying. Deliberately NOT touching
      // the Cloak-of-Flying effect record (ether is its own item:Cloak of
      // Ether window). No rng draw either way on this branch, so
      // determinism/parity are unaffected for every character with no live
      // ether effect (every parity fixture — ether is only ever raised by
      // USING the cloak).
      events.push({ type: "phasedThrough" });
      there.feat = null;
    } else {
      // Phase 39 (GEAR-05): the hazard pre-roll pending-decision pre-check
      // (CONTEXT Area 1) — a character carrying the matching tool gets ONE
      // pause before the roll: `state.pendingHazard` is stashed and a
      // `hazardChoice` event fires, WITHOUT moving or rolling (return below,
      // zero draws, zero mutation besides the pending record). A second
      // `move(dir)` at the SAME tile/direction (the "CLIMB IT"/"LEAP IT"
      // button) flips `declined: true` in place and falls through to the
      // roll below — the pending record deliberately stays on the tile
      // (never cleared here) so a failed roll's retry card can offer both
      // buttons again with no second prompt; only a genuine successful
      // step/tool-use/teleport/descend clears it (see below/teleport/
      // descend). A character without the matching tool never enters either
      // branch — `hasTool` false, `pendingHazard` stays whatever it already
      // was (usually null) — so the roll runs immediately, exactly as
      // before this plan.
      const toolFor = climbing ? "ladder" : "rope";
      const pend = state.pendingHazard;
      if (pend && pend.dir === dir && pend.feat === there.feat) {
        pend.declined = true;
      } else if (hasTool(state.c, toolFor)) {
        state.pendingHazard = { feat: there.feat, dir, tool: toolFor, declined: false };
        events.push({ type: "hazardChoice", feat: there.feat, dir, tool: toolFor });
        return events;
      }
      // DELIBERATE RULES CHANGE (Phase 41, TERR-04/05, user-ratified Key
      // Decision 2026-09-18: "arm Afraid for the next fight"): Heights fires
      // on the ATTEMPT, before the roll — a fresh tile (or a fresh return to
      // one more than one square away) narrates and arms c.fearArmed here;
      // heightsPenalty/waterPenalty below still land on the roll itself
      // (a different roll from the next fight's Afraid — no double count,
      // per 41-RESEARCH.md Pitfall 2). No-op for every non-Heights-phobic
      // character (noteHeightsAttempt gates on c.phobia itself).
      noteHeightsAttempt(state, nx, ny, events);
      let ok = true;
      let hurt = 0;
      if (climbing) {
        const hPenalty = heightsPenalty(state.c);
        // Phase 43 (CLAR-01, additive): penalty names the cause for the
        // narration; fixtures compare state, so this moves none.
        if (hPenalty) events.push({ type: "heightsFear", penalty: hPenalty });
        const kind = rng.pick(["rope", "rock", "wood"]);
        const tbl = CLIMB_TABLE[kind];
        const feet = 10 * (1 + rng.d(2));
        for (let ft = 0; ft < feet && ok; ft += 10) {
          // Phase 38 (ABIL-02): the retired climb bonus — no term subtracted here anymore.
          // Phase 39 (GEAR-01): armor bulk is a deterministic penalty on the
          // roll comparison, exactly like hPenalty above — no new rng draw.
          const r = rng.d(10) + hPenalty + armorBulk(state.c);
          if (r <= tbl.success) continue;
          ok = false;
          for (let g = 0; g <= ft; g += 10) if (rng.d(20) > 2) hurt += rollDice(rng, tbl.fall);
          // Phase 38 (ABIL-02): the retired climb and leap fall-damage halving — gone for everyone.
        }
      } else {
        const wPenalty = waterPenalty(state.c);
        // Phase 43 (CLAR-01, additive): penalty names the cause for the
        // narration; fixtures compare state, so this moves none.
        if (wPenalty) events.push({ type: "waterFear", penalty: wPenalty });
        const row = LEAP_TABLE[rng.d(4) - 1];
        const need = state.c.cls === "Fighter" ? row.F : state.c.cls === "Thief" ? row.T : row.M;
        // Phase 38 (ABIL-02): the retired leap bonus — no term subtracted here anymore.
        // Phase 39 (GEAR-01): armor bulk penalty, same as the climb branch above.
        const r = rng.d(10) + wPenalty + armorBulk(state.c);
        if (r > need) {
          ok = false;
          hurt = rng.d(6) + rng.d(6);
          // Phase 38 (ABIL-02): the retired climb and leap fall-damage halving — gone for everyone.
        }
      }
      // DELIBERATE RULES CHANGE (Phase 54, 2026-09-21, user bug-fix ruling):
      // walls and crevices are ONE AND DONE — one roll per feature; a failed
      // roll hurts and STILL crosses (the retry-and-hurt-again loop is gone;
      // the heights-phobia repeat-fall spiral with it). Success crosses
      // clean; failure takes the (curve-scaled) fall damage, and — if the
      // hero survives — still ends up on the far side (`there.feat = null`,
      // then falls through to the SAME clean-step tail below: cost/
      // position/reveal/cadence). A fatal fall still dies in place (no
      // move, feat kept). Draw count per attempt is unchanged (same rolls,
      // same order) — only what happens after a failed roll changed.
      if (!ok) {
        // Phase 54 (USER RULING D): hazardScale — post-draw arithmetic, 0
        // new draws; the global HAZARD_SCALE dial, literal 1 at identity.
        hurt = scaleHazard(hurt, difficultyCurve(state.floor.depth));
        state.c.wp -= hurt;
        events.push({ type: climbing ? "fellClimbing" : "fellInGorge", hurt });
        if (state.c.wp <= 0) {
          die(state, climbing ? "fall" : "gorge", null, rng, events, now);
          return events;
        }
        events.push({ type: "draggedOver", feat: there.feat });
      } else {
        events.push({ type: climbing ? "climbedOver" : "leaptOver" });
      }
      there.feat = null;
    }
  }

  // DELIBERATE RULES CHANGE (Phase 41, TERR-02, user-ratified Key Decision
  // 2026-09-18: "one tap, two squares of time"): a single step's cost in
  // `state.steps` — and therefore every squares-cadence system below that
  // reads `crossings(...)` or is fed `cost` directly — is `moveCost(state,
  // there)`: 1 for a normal cell, 2 for water (flight/ether exempt, see
  // moveCost's own doc in engine/derived.js). Every per-square system this
  // cost widens, in one dispatch: the HUD SQUARES counter (state.steps
  // itself); the affliction's own per-N cadence; c.darkFor; both
  // Cloak-of-Healing/Regeneration 20-square ticks; c.timers (tickSquares(c,
  // cost), engine/effects.js — ability/item/spell-reveal timers, once per
  // step, never twice, per 41-RESEARCH.md Pitfall 3); the Magic User
  // 20-square spell-charge recovery; the 100-square newDay. Note for
  // CONTEXT.md's own phrasing: "the encounter clock"/"member timers" have no
  // separate per-square counterpart anywhere in this engine (verified — the
  // wandering-monster check IS newDay's own crossings(100) roll, and party
  // members carry no squares-cadence state of their own), so the list above
  // is the complete set.
  const cost = moveCost(state, there);
  f.px = nx;
  f.py = ny;
  // Phase 39 (GEAR-05): a genuine step anywhere resolves the hazard
  // decision — mirrors the same reset in teleport()/descend() below.
  state.pendingHazard = null;
  const stepsBefore = state.steps;
  state.steps += cost;
  // crossings(n) — how many multiples of `n` this step's `state.steps`
  // advance crossed. For cost 1 this is exactly the old `state.steps % n
  // === 0` cadence test (0 or 1 — a +1 step can cross at most one boundary),
  // so every cost-1 step stays byte-identical to before this plan. For cost
  // 2 (or any future cost > 1) a crossed boundary fires exactly once and is
  // never skipped: 99 -> 101 still rolls the day, 19 -> 21 still recovers a
  // spell charge / heals a cloak tick.
  const crossings = (n) => Math.floor(state.steps / n) - Math.floor(stepsBefore / n);
  reveal(f, revealRadius(state));
  events.push(moved({ x: nx, y: ny }));
  // Phase 41 (TERR-02): narrate entering water ONCE per wade, not once per
  // step — `here` (captured before the position update, still the same cell
  // object) is the departure cell, so a water -> water re-step stays silent
  // (an 8-cell pool never stacks eight rail lines) and only the entry step
  // narrates. The HUD counter still carries the per-step cost regardless.
  if (cost > 1 && !here.water) events.push({ type: "waded", cost });

  const c = state.c;

  // DELIBERATE RULES CHANGE (04.1-06, 2026-09-09, PHOBIA-01): Being-trapped
  // panic on a genuine, not-yet-panicked entry into a dead-end tile — see
  // isDeadEnd/TRAPPED_PHOBIA_PANIC above for the full rationale. `there` is
  // still the same cell object as `f.g[ny][nx]` (feature dispatch may have
  // cleared `.feat` above, but never replaced the object), so this stays a
  // direct in-place mutation, exactly like every other per-step tick below.
  // The loss is clamped to leave at least 1 wp — a fear reaction should
  // never itself be the killing blow — mirroring the affliction-tick clamp
  // immediately below.
  if (c.phobia === "Being trapped" && !there.trapPanicked && isDeadEnd(f, nx, ny)) {
    there.trapPanicked = true;
    const raw = skill(c, "Hardiness") ? Math.round(TRAPPED_PHOBIA_PANIC / 2) : TRAPPED_PHOBIA_PANIC;
    const loss = Math.min(raw, Math.max(0, c.wp - 1));
    c.wp -= loss;
    // Phase 43 (CLAR-01, additive): phobia names the cause for the
    // narration; fixtures compare state, so this moves none.
    events.push({ type: "trappedPanic", loss, phobia: c.phobia });
  }

  if (c.affliction) {
    const af = c.affliction;
    // Phase 41 (TERR-02): a cost>1 step can cross the affliction's own
    // per-N cadence more than once in one dispatch (a per:1 affliction
    // crosses TWICE on a 2-cost water step) — the crossings helper above,
    // called against `af.per`, counts exactly how many boundaries this step
    // crossed, and the loop below runs the EXISTING tick body once per
    // crossing, stopping the instant
    // the affliction clears inside it (an affliction that already burned
    // out on the first tick this step must never tick a second time).
    const afflictionTicks = crossings(af.per);
    for (let i = 0; i < afflictionTicks && c.affliction; i++) {
      const l = Math.min(rollDice(rng, af.loss), Math.max(0, c.wp - 1));
      c.wp -= l;
      // DELIBERATE RULES CHANGE (audit-bugs, 2026-09-09, E5): the clamp above
      // floors the affliction at 1 hp (it should never itself be the killing
      // blow) — but at 1 hp every subsequent tick draws `l === 0` forever,
      // and the old code only ever cleared the affliction via the DURATION
      // counter (`--af.left <= 0`), which kept counting down while still
      // re-emitting the same loss-0 "has taken everything it can" line every
      // tick until it happened to hit zero — the reported infinite loop.
      // Once a tick can take nothing more, clear the affliction immediately
      // instead of waiting for the duration to run out, and skip the loss-0
      // tick event entirely so this reads as the affliction burning itself
      // out (afflictionPassed) rather than repeating the no-op loop line.
      // The normal duration-based clear (`--af.left <= 0`) is unchanged for
      // every tick that still has room to deal damage.
      if (l === 0) {
        c.affliction = null;
        events.push({ type: "afflictionPassed", kind: af.kind });
      } else {
        events.push({ type: "afflictionTick", kind: af.kind, loss: l });
        if (--af.left <= 0) {
          c.affliction = null;
          events.push({ type: "afflictionPassed", kind: af.kind });
        }
      }
    }
  }
  // DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): the persistent
  // darkness counter (see engine/encounters.js fallDark, engine/derived.js
  // inDark) decrements per step, exactly like the affliction tick above —
  // a plain decrement, no rng — and clears at zero with a narrated
  // "darkness lifts" event.
  if (c.darkFor > 0) {
    // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Amulet of
    // Light (content/treasure-tables.js, eff:{sight:1,light:1}) already grants
    // the reveal-radius bonus via `sight` (derived.js revealRadius); its
    // `light` half ("dispels darkness") was inert — READ NOWHERE. Wired here:
    // carrying a light source (eff("light") > 0) DISPELS the persistent
    // darkness counter (c.darkFor, set by encounters.js fallDark) outright
    // rather than merely ticking it down, so inDark()/revealRadius/the in-dark
    // to-hit cap all clear immediately. Pure read of eff() + a plain field
    // clear (no rng). GATED behind c.darkFor > 0 AND eff("light"): a
    // non-carrier falls to the byte-identical decrement branch, so parity is
    // unaffected for every fixture (none carry the Amulet).
    if (eff(c, "light") > 0) {
      c.darkFor = 0;
      events.push({ type: "darknessDispelled" });
    } else {
      // Phase 41 (TERR-02): decrement by this step's cost, not a bare 1, so
      // a water step burns the darkness counter down twice as fast — same
      // clamp-at-0-with-one-event discipline as before.
      c.darkFor = Math.max(0, c.darkFor - cost);
      if (c.darkFor === 0) events.push({ type: "darknessLifted" });
    }
  }
  // Phase 39 (GEAR-02): the retired haste/invis/ether/acute per-step
  // decrements — every item effect ticks through the shared c.timers
  // squares-tick below instead (its expiry is mapped to events there).
  // 260918-w4n: the old per-step Cloak of Healing / Cloak of Regeneration
  // tick is REMOVED — the dropped healing cloak no longer exists, and the
  // Cloak of Regeneration's d6 now fires once, on USE (engine/items.js
  // #useItem's "knit" case), not automatically every 20 squares while
  // merely carried. Walking hurt with an unused Cloak of Regeneration worn
  // changes nothing here any more.
  // The Cloak of Flying's effect/cooldown rides the same c.timers squares
  // tick below like every other item.

  // Phase 36 (BAL foundation) — the squares tick for engine/effects.js
  // records; GUARDED on the lazily-created c.timers so every fixture, bot
  // run and pre-Phase-36 save (none carries the key) is byte-identical.
  // Phase 41 (TERR-02): this now passes the step's OWN cost (1 normally, 2
  // on water) — ONE call, called once per step (research Pitfall 3: never
  // call tickSquares twice to "double" a tick — `n` already carries the
  // full cost). Phase 39 (GEAR-02): the returned transition list is mapped
  // to events (itemEffectFaded/itemCooled/staffRecharged) below.
  if (c.timers) {
    const trans = tickSquares(c, cost);
    narrateTimerTransitions(state, trans, events);
    // Phase 40 (SPELL-05, Plan 04): the ONE sweep that re-fogs whatever Map
    // the Floor's window never graduated (research Pitfall 4) — reacts to
    // the transition itself, never a per-step poll of the record. This
    // step's own reveal() call above has already graduated THIS step's
    // cells before this runs, so a cell just walked onto never re-fogs even
    // on the exact step the window closes.
    if (trans.some((t) => t.id === "spell:reveal" && t.from === "effect")) {
      const cells = refogSpellSeen(f);
      events.push({ type: "revealFaded", cells });
    }
    // 260919-00d (user ruling 2026-09-19): an `ether`-kind item effect
    // ending on THIS step's own tick — kind-keyed (never name-keyed,
    // mirrors narrateTimerTransitions' own ACTIVATION_OF lookup, so a
    // future second ether-granting item is covered for free) — hands off to
    // resolveEtherEnd, the ONE place that decides whether ending inside
    // rock is fatal. `itemEffectFaded` has already been pushed above by
    // narrateTimerTransitions; entombed/died (if any) are pushed after it.
    const etherEnded = trans.some(
      (t) => t.from === "effect" && t.id.startsWith("item:") && ACTIVATION_OF[t.id.slice("item:".length)]?.kind === "ether",
    );
    if (etherEnded) resolveEtherEnd(state, rng, events, now);
  }
  // Mirrors the fall/gorge death path's own early return immediately after
  // the hazard that could have killed — the spell-charge recovery, newDay
  // and feature dispatch below must never run against a state die() has
  // already finalized (state.dead, wp 0, combat cleared).
  if (state.dead) return events;

  // the book recharges a Magic User every hundred squares; a solo caster
  // needs it oftener.
  if (c.cls === "Magic User" && crossings(20) > 0 && c.spellsUsed > 0) {
    c.spellsUsed--;
    events.push({ type: "spellChargeRecovered", charges: maxCharges(c) - c.spellsUsed, max: maxCharges(c) });
  }

  if (crossings(100) > 0) newDay(state, false, rng, events, now);
  if (state.dead) return events;

  // DELIBERATE RULES CHANGE (Phase 41, TERR-04/05, user-ratified Key
  // Decision 2026-09-18: "arm Afraid for the next fight"): the hero's
  // fresh-entry phobia region check. Runs AFTER every per-square hp/dark
  // tick of this step (so the Death crossing and the darkFor-driven Darkness
  // region both read this step's already-settled state) and BEFORE feature
  // dispatch below (so a pending combat started by newDay's wandering-
  // monster roll or by the dot/trap dispatch already sees c.fearArmed set).
  // No-op for a character whose phobia is not one of the five terrain
  // phobias (checkTerrainPhobias gates on TERRAIN_PHOBIAS itself).
  checkTerrainPhobias(state, events);

  const cell = f.g[ny][nx];
  if (state.combat) return events; // a wandering monster already found you (01-08)
  // 260919-00d: nothing is ever placed in rock — genFloor only scatters
  // features onto carved (non-wall) cells, so a wall cell's `feat` is
  // always null anyway; this gate STATES the rule explicitly (rather than
  // leaving it to that scatter) since a wall cell is now reachable at all,
  // and only while ethereal.
  if (cell.wall) return events;
  if (cell.feat === "dot") {
    cell.feat = null;
    encounterDot(state, rng, events);
  } else if (cell.feat === "trap") {
    cell.feat = null;
    springTrap(state, rng, events);
  } else if (cell.feat === "chest") {
    cell.feat = null;
    openChest(state, rng, events);
  } else if (cell.feat === "tele") {
    cell.feat = null;
    teleport(state, rng, events);
  } else if (cell.feat === "exit") {
    descend(state, rng, events);
  } else if (cell.feat === "gate") {
    // Legacy-save compatibility (RUN-04): genFloor no longer ever emits a
    // "gate" tile (Plan 02, engine/maze.js), but an in-flight save generated
    // by the OLD genFloor may still have one on its current floor. Route it
    // to descend() — continue deeper, never win — so permadeath (die) stays
    // the ONLY run terminator even for a legacy save mid-floor.
    descend(state, rng, events);
  }

  return events;
}

/**
 * useTool(state, tool, dir, rng, events, now) — Phase 39 (GEAR-05): spends
 * a ladder/rope carried tool at a climbable wall/gorge in `dir`, passing the
 * tile with no roll and no fall damage. The torch is NOT reachable here — it
 * is a `useItem` activatable (engine/items.js), not a movement-tile tool.
 * The full refusal ladder, every step BEFORE any mutation: combat/store/
 * dead (silent no-op, mirrors `move`'s own guard) -> `unknown` (`tool`
 * is not a recognized hazard tool — `validateAction` already rejects
 * anything but "ladder"/"rope", so this only ever fires for a `TOOLS[tool]`
 * lookup miss on a tampered/malformed call) -> `noTool` (not carried) ->
 * `noHazard` (the target tile is missing/a wall/not the matching feat).
 * Once past every refusal, delegates to `move(state, dir, rng, events, now,
 * { tool })` — the SAME climb/gorge block, tool branch (isFlying still wins
 * there, per that block's own header comment).
 */
export function useTool(state, tool, dir, rng, events = [], now = Date.now) {
  if (state.combat || state.store || state.dead) return events;
  const feat = TOOLS[tool]?.feat;
  if (!feat) {
    events.push({ type: "toolRefused", tool, reason: "unknown" });
    return events;
  }
  if (!hasTool(state.c, tool)) {
    events.push({ type: "toolRefused", tool, reason: "noTool" });
    return events;
  }
  const f = state.floor;
  const [dx, dy] = DIRV[dir];
  const nx = f.px + dx;
  const ny = f.py + dy;
  const there = f.g[ny] && f.g[ny][nx];
  if (!there || there.wall || there.feat !== feat) {
    events.push({ type: "toolRefused", tool, reason: "noHazard" });
    return events;
  }
  return move(state, dir, rng, events, now, { tool });
}

/* ---------------- day cycle / camp ---------------- */

/**
 * eatsFor(sheet) — Phase 43 (CLAR-03/05): THE appetite read — value-identical
 * to the three inline `RACES[...].eats || 1` reads it replaces (the hero's
 * plain read in nightlyEats and the two optional-chained member reads in
 * nightlyEats/makeCamp). Read by nightlyEats/newDay/makeCamp and, read-only,
 * by src/browser/viewModels.js#rationsViewModel and the shell's Joiner/
 * Company surfaces (Plan 04) — one read, every consumer agrees.
 */
export function eatsFor(sheet) {
  return (sheet && RACES[sheet.race] && RACES[sheet.race].eats) || 1;
}

/**
 * nightlyEats(state) — Phase 25.1 (DFB-06): the ONE definition of "how much
 * this party eats per night", read by newDay AND makeCamp (and, read-only,
 * by the shell's camp button through window.__mzNightlyEats), so the camp
 * gate and the automatic new day can never disagree. Pure read, zero rng;
 * with no party it equals the hero's own appetite exactly as before.
 */
export function nightlyEats(state) {
  const c = state.c;
  let eats = eatsFor(c);
  if (state.party?.length) {
    for (const m of state.party) eats += eatsFor(m);
  }
  return eats;
}

/**
 * newDay(state, camped, rng, events, now) — ports mazeworld.html newDay()
 * (lines 1717-1772). Advances the day counter, resolves upkeep/rations
 * (starving into `die("starve")` when unfed and out of wp), rests, and rolls
 * the 8-hour wandering-monster check, starting a forced-random encounter via
 * combat.js's startCombat when at least one hour is disturbed (01-08).
 */
export function newDay(state, camped, rng, events = [], now = Date.now) {
  const c = state.c;
  state.day++;
  c.spellsUsed = 0;
  c.might = 0;
  if (c.strengthBoost) {
    c.maxWP -= c.strengthBoost;
    c.wp = Math.min(c.wp, c.maxWP);
    c.strengthBoost = 0;
  }
  const R = RACES[c.race];
  let cost = upkeep(c);
  const eats = nightlyEats(state);
  // PARTY-10 (Phase 11, party-LOCAL balance): a joiner is a real resource cost,
  // not free power — the canon counterweight is that a party EATS MORE. Each
  // LIVE party member folds its own hunger into the daily food math: the
  // member's rations into `eats` (a fed party drains rations faster, now via
  // nightlyEats — shared with makeCamp, DFB-06) and the member's `upkeep()`
  // into `cost` (an unfed party burns the hero's wp faster, starving into the
  // same die("starve") path). Members are full rollCharacter()-shaped sheets
  // and are already pruned to LIVE-only in endCombat (downed/departed members
  // are removed from state.party), so every member present here genuinely
  // eats. Reuses upkeep()/`R.eats` for consistency with the hero's own model
  // — pure post-state arithmetic, NO rng.
  //
  // DETERMINISM GATE: gated behind `state.party?.length`. With no party the
  // loop never runs and `cost`/`eats`/`c.rations` stay byte-identical to the
  // pre-party baseline (596/596 parity). The GLOBAL engine/difficulty.js curve
  // retune is DEFERRED to the consolidated Economy & Monster balance pass — it
  // is deliberately NOT touched here (it also carries a parity guard).
  if (state.party?.length) {
    for (const m of state.party) {
      cost += upkeep(m);
      // DFB-05 (Phase 25.1): a member's spell charges recover per day, like
      // the hero's `c.spellsUsed = 0` above. Conditional so a sheet without
      // the field (a Fighter/Thief member) never gains one — no new
      // serialized field on a member that was never a Magic User.
      if (m.spellsUsed) m.spellsUsed = 0;
    }
  }
  events.push({ type: "dayBegan", day: state.day, camped: !!camped });

  if (c.rations >= eats) {
    c.rations -= eats;
    // Phase 43 (CLAR-01/03/05, additive): rations eaten is a narrated cost —
    // one event per fed night naming every eater; fixtures compare state,
    // so this moves none. `eaters` is built right here so it always agrees
    // with the `eats` charge just made above.
    const eaters = [
      { name: c.name, race: c.race, eats: eatsFor(c), hero: true },
      ...(state.party ?? []).map((m) => ({ name: m.name, race: m.race, eats: eatsFor(m) })),
    ];
    events.push({ type: "rationsEaten", eats, left: c.rations, eaters });
    // DELIBERATE RULES CHANGE (Phase 54, USER RULING D): a rested night
    // heals a fraction of maxWP (CAMP_HEAL_FRACTION) — hero-keyed, no depth
    // term; the d10 stays as variance so the draw count is unchanged.
    let heal = campHealFor(c.maxWP, rng.d(10));
    // Phase 25 (FEED-01, additive payload): who doubled the heal, if anyone
    // — a Soldier's label wins for a Wilmsry Soldier (matches `heal *= 2`'s
    // own `||` precedence below, which is untouched). Narration only.
    const doubledBy = c.sub === "Soldier" ? "Soldier" : R.heal2x ? c.race : null;
    if (R.heal2x || c.sub === "Soldier") heal *= 2;
    const before = c.wp;
    c.wp = Math.min(c.maxWP, c.wp + heal);
    if (c.wp > before) events.push({ type: "rested", amount: c.wp - before, ...(doubledBy ? { doubled: doubledBy } : {}) });

    // DELIBERATE RULES CHANGE (audit-batch1, 2026-09-09, A3): resting used to
    // auto-cure any affliction unconditionally, no roll, every fed night.
    // Per the audit, this is now a real d20 cure roll — ~50% base
    // (10-or-under on a d20) plus a Hardiness bonus — mirroring the
    // armor-patch fix's (04.1-02) determinism-safe pattern: this rng.d draw
    // fires ONLY for a character who currently HAS an affliction, so RNG
    // consumption order/parity are completely unaffected for everyone else.
    // A failed roll leaves the affliction lingering (new `afflictionLingers`
    // event) rather than curing it outright.
    if (c.affliction) {
      const af = c.affliction;
      if (rng.d(20) <= 10 + (skill(c, "Hardiness") ? 4 : 0)) {
        c.affliction = null;
        events.push({ type: "afflictionCured", kind: af.kind });
      } else {
        events.push({ type: "afflictionLingers", kind: af.kind });
      }
    }

    // Patching armour by the fire: Sewing for thieves, Master of Arms for
    // fighters.
    // DELIBERATE RULES CHANGE (04.1-02, 2026-09-09, RULE-02): the prototype's
    // condition reads `S.c.dr`, a field `rollCharacter()` never sets anywhere
    // in mazeworld.html — this branch was unreachable dead code in the
    // shipped prototype (mazeworld.html lines 1737-1754), silently disabling
    // both the Thief Sewing skill and the Fighter subclass Master of Arms'
    // repair bonus. Per the phase-04.1 rules audit, the dead `c.dr > 0` gate
    // is deliberately replaced with a real capability check —
    // `skillTier(c, "Sewing") || c.sub === "Master of Arms"` — so these two
    // character-sheet capabilities actually fire. The bare `else { d4 }`
    // fallback that only ever ran under the dead gate is removed entirely
    // (it must NOT patch armour for characters lacking both capabilities —
    // see the T-04.1-03 threat in 04.1-02-PLAN.md). This adds a new rng.d
    // draw inside newDay, but ONLY for Sewing/Master-of-Arms characters with
    // damaged armour; no chargen RNG draw is added or reordered, so
    // determinism/parity are unaffected.
    if (c.armorWP < c.armorMax && (skillTier(c, "Sewing") || c.sub === "Master of Arms")) {
      const tier = skillTier(c, "Sewing");
      const maxPatch = tier === 2 ? 6 : 4;
      if (tier && c.patches < maxPatch) {
        const amt = tier === 2 ? rng.d(6) + 3 : rng.d(6);
        c.armorWP = Math.min(c.armorMax, c.armorWP + amt);
        c.patches++;
        events.push({ type: "armorPatched", amount: amt, by: "Sewing" });
      } else if (c.sub === "Master of Arms") {
        const amt = rng.d(6) + 3;
        c.armorWP = Math.min(c.armorMax, c.armorWP + amt);
        events.push({ type: "armorPatched", amount: amt, by: "Master of Arms" });
      }
    }
    // DELIBERATE RULES CHANGE (04-DR12, 2026-09-08): the prototype's Warlock
    // duplicates a potion once a week (`state.day - dupAt >= 7`, see
    // test/parity/prototype-master.js.txt line ~1311 and content/flavor.js's
    // subclass blurb). Per explicit user design direction this cadence is
    // intentionally changed to DAILY here — every newDay tick, not every 7th.
    // This is a canon rules deviation, not a fidelity bug: the frozen
    // prototype reference is left untouched (parity tests never drive a
    // Warlock through multiple newDay ticks, so no fixture assumes the old
    // cadence). `dupAt` is retained for save-shape stability even though the
    // weekly gate it backed no longer applies.
    if (c.sub === "Warlock" && c.potions > 0) {
      c.dupAt = state.day;
      c.potions++;
      events.push({ type: "potionDuplicated" });
    }
  } else {
    c.wp -= cost;
    // Phase 43 (CLAR-01/03/05, additive): hunger names need/have/mouths and
    // the Heft halving; fixtures compare state, so this moves none.
    events.push({ type: "wentHungry", cost, need: eats, have: c.rations, mouths: 1 + (state.party?.length ?? 0), ...(skill(c, "Heft") ? { heft: true } : {}) });
    if (c.wp <= 0) {
      die(state, "starve", null, rng, events, now);
      return events;
    }
  }

  // wandering monsters: d20 per hour slept, a 1 wakes you
  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): a Bard's
  // "creatures too stupid to know better come for you first" bad — camping
  // draws wandering monsters twice as often. Same eight per-hour d20 draws
  // in the same order; only the hit widens from ===1 to <=2 for a Bard.
  // Every other sub wakes only on a bare 1, byte-identical to before.
  // Phase 54 (BAND-02, USER RULING D): WANDER_RATE — the SAME eight draws,
  // just a wider (or narrower) face count that wakes the party; identity
  // (1) reproduces the canon "===1" rule exactly, and the Bard's own +1 is
  // additive on top of the dial (capped at 20), never doubled by it.
  const wakeOn = wanderWakeFacesFor(c.sub);
  let woke = 0;
  for (let h = 0; h < 8; h++) if (rng.d(20) <= wakeOn) woke++;
  // 260919-00d (user ruling 2026-09-19): nothing wanders through solid
  // stone — reachable only while ethereal (a camp, or a 100th step taken,
  // inside rock). The eight d20 draws above still happen in the same order
  // either way (the day's own clock; rng cursor unchanged) — only the
  // resulting forced-random encounter is skipped.
  if (woke && !inStone(state)) {
    events.push({ type: "wanderingMonster", hours: woke, bard: c.sub === "Bard" });
    startCombat(state, true, null, rng, events);
  }
  return events;
}

/**
 * makeCamp(state, rng, events, now) — ports mazeworld.html makeCamp() (lines
 * 1774-1785). Refuses to camp without enough rations for the night; otherwise
 * runs a `camped` newDay.
 */
export function makeCamp(state, rng, events = [], now = Date.now) {
  if (state.combat || state.store || state.dead) return events;
  // DELIBERATE RULES CHANGE, Phase 25.1, 2026-09-15 (DFB-06): the gate now
  // counts every live member's appetite exactly as newDay does (the old
  // gate counted the hero only, so a hero with a member could pass the gate
  // and still go hungry). The refusal states the numbers; solo heroes keep
  // need === RACES[race].eats||1 so every fixture's camp is byte-identical;
  // `members` is spread in only when a party exists so the solo event shape
  // stays exactly `{ type, reason, need, have }`.
  const need = nightlyEats(state);
  const have = state.c.rations;
  if (have < need) {
    const members = (state.party ?? []).map((m) => ({ name: m.name, eats: eatsFor(m) }));
    events.push({ type: "campFailed", reason: "noRations", need, have, ...(members.length ? { members } : {}) });
    return events;
  }
  return newDay(state, true, rng, events, now);
}

/* ---------------- teleport ---------------- */

/**
 * teleport(state, rng, events) — ports mazeworld.html teleport() (lines
 * 1787-1832). An Illusionist chooses the best direction and travels a fixed
 * 12 squares; everyone else rolls 2d8 for direction (contradictory rolls
 * favor the first) and d20 for distance, falling back toward the nearest
 * open square (never off the map) if the full distance would leave the maze.
 */
export function teleport(state, rng, events = []) {
  const c = state.c;
  const illusionist = c.sub === "Illusionist";
  let dir;
  let other = null;
  if (illusionist) {
    dir = bestTeleportDir(state);
  } else {
    const a = DIRECTION_TABLE[rng.d(8) - 1];
    const b = DIRECTION_TABLE[rng.d(8) - 1];
    dir = a;
    other = b;
  }
  const dist = illusionist ? 12 : rng.d(20);
  const f = state.floor;

  let x = f.px;
  let y = f.py;
  let travelled = 0;
  let used = dir;
  const tryDir = (dd) => {
    const [ax, ay] = DIRV[dd];
    for (let d = dist; d >= 1; d--) {
      const nx = f.px + ax * d;
      const ny = f.py + ay * d;
      if (nx < 1 || ny < 1 || nx > GW - 2 || ny > GH - 2) continue; // never off the map
      if (f.g[ny][nx].wall) continue; // land on floor, not in stone
      return [nx, ny, d];
    }
    return null;
  };
  // the rolled direction first, then the second roll, then whatever the maze
  // allows — a teleport square always moves you somewhere.
  const order = [dir, other, "N", "S", "E", "W"].filter((d, i, a) => d && a.indexOf(d) === i);
  let hit = null;
  for (const d of order) {
    hit = tryDir(d);
    if (hit) {
      used = d;
      break;
    }
  }
  if (hit) {
    x = hit[0];
    y = hit[1];
    travelled = hit[2];
  }
  f.px = x;
  f.py = y;
  // Phase 39 (GEAR-05): a teleport resolves any pending hazard decision too.
  state.pendingHazard = null;
  reveal(f, revealRadius(state));
  events.push({ type: "teleported", dir, other, dist, used, travelled, to: { x, y } });
  // Phase 41 (TERR-04/05): a teleport landing is a fresh entry too.
  checkTerrainPhobias(state, events);

  const cell = f.g[y][x];
  if (cell.feat === "dot") {
    cell.feat = null;
    encounterDot(state, rng, events);
  }
  if (cell.feat === "trap") {
    cell.feat = null;
    springTrap(state, rng, events);
  }
  return events;
}

/**
 * bestTeleportDir(state) — the longest clear run from where you stand (an
 * Illusionist's teleport is a choice, not a roll). Ports mazeworld.html
 * bestTeleportDir() (lines 1834-1844). No RNG.
 */
export function bestTeleportDir(state) {
  const f = state.floor;
  let best = "N";
  let bestRun = -1;
  for (const d of ["N", "S", "E", "W"]) {
    const [dx, dy] = DIRV[d];
    let x = f.px;
    let y = f.py;
    let run = 0;
    while (run < 12) {
      const nx = x + dx;
      const ny = y + dy;
      if (!f.g[ny] || !f.g[ny][nx] || f.g[ny][nx].wall) break;
      x = nx;
      y = ny;
      run++;
    }
    if (run > bestRun) {
      bestRun = run;
      best = d;
    }
  }
  return best;
}

/* ---------------- descend / win ---------------- */

/**
 * cutthroatMurderCheck(state, rng, events) — DELIBERATE RULES CHANGE (Phase
 * 36, 2026-09-17, CUT-02): the Cutthroat's Joiner risk, made real now that
 * Joiners travel with a Cutthroat (CUT-01). Once per descent, a natural 1 on
 * a d20 (one descent in twenty — the blurb states the odds in plain words)
 * means the Joiner does not reach the next floor.
 *
 * GATE: `state.c.sub === "Cutthroat" && Array.isArray(state.party) &&
 * state.party.length > 0` — the d20 is drawn ONLY inside the gate, so every
 * fixture (lose-plain seed 1119 is a Cutthroat with party []), every bot run
 * (the bot declines every Joiner) and every pre-Phase-36 save (a Cutthroat
 * could never have accepted one) draws nothing and stays byte-identical.
 *
 * Victim = `state.party.splice(0, 1)[0]` (index 0 — PARTY_CAP is 1; FIFO if
 * it ever rises); pushes `joinerMurdered` with `name`, `sub`,
 * `depth: state.floor.depth`. Returns events.
 */
export function cutthroatMurderCheck(state, rng, events = []) {
  if (state.c.sub === "Cutthroat" && Array.isArray(state.party) && state.party.length > 0) {
    if (rng.d(20) === 1) {
      const victim = state.party.splice(0, 1)[0];
      events.push({ type: "joinerMurdered", name: victim.name, sub: victim.sub, depth: state.floor.depth });
    }
  }
  return events;
}

/**
 * descend(state, rng, events) — ports mazeworld.html descend() (lines
 * 1846-1856). Awards the depth-scaled skill-point bonus, checks for a level
 * up, then generates and reveals the next floor. No depth ceiling — descent
 * is endless (RUN-02): genFloor(state.floor.depth + 1, rng) always succeeds
 * and always yields another "exit" tile, so this can be called indefinitely.
 *
 * WR-01: the SP bonus formula routes state.floor.depth through
 * difficultyCurve()'s safeDepth() guard (rather than using the raw field
 * directly) so a corrupted/negative/non-integer/NaN save-derived depth can
 * never produce a nonsensical (e.g. negative) SP grant here. For any valid
 * depth >= 1 this is a no-op — difficultyCurve(depth).depth === depth.
 */
export function descend(state, rng, events = []) {
  const safeFloorDepth = difficultyCurve(state.floor.depth).depth;
  // Phase 54 (BAND-02, USER RULING D): HERO_SP_SCALE paces every SP grant —
  // identity (1) is a no-op here.
  const bonus = heroSpFor(40 + 30 * safeFloorDepth);
  state.c.sp += bonus;
  events.push({ type: "spGained", amount: bonus, reason: "descend" });
  checkLevel(state, rng, events);
  // Phase 40 (SPELL-05, Plan 04): the mapped floor is behind you — a live
  // spell:reveal record has no meaning for a floor that no longer exists.
  // Deleted silently (no revealFaded, no sweep — the whole floor object is
  // about to be replaced below, so there is nothing left to re-fog); the
  // chip simply disappears with the floor, by design.
  if (state.c.timers && state.c.timers["spell:reveal"]) delete state.c.timers["spell:reveal"];
  state.floor = genFloor(state.floor.depth + 1, rng);
  // Phase 39 (GEAR-05): a descent resolves any pending hazard decision too
  // (a new floor has no meaning for a decision tied to the old one's tile).
  state.pendingHazard = null;
  reveal(state.floor, revealRadius(state));
  events.push(floorChanged(state.floor.depth));
  // Phase 54 (BAND-02, USER RULING D): HERO_REGEN_PER_FLOOR — a fraction of
  // maxWP restored once, on arriving at the new floor (hero only, 0 draws).
  // Identity (0) never pushes an event; a loaded save resumes on its
  // current floor with no regen owed (`descend` is the only arrival path
  // and runs once per floor by construction, so there is no "regen applied"
  // marker to track).
  const regen = heroRegenFor(state.c.maxWP);
  if (regen > 0) {
    const before = state.c.wp;
    state.c.wp = Math.min(state.c.maxWP, state.c.wp + regen);
    if (state.c.wp > before) events.push(floorRegen(state.c.wp - before));
  }
  // Phase 41 (TERR-04/05): floor-bound phobia regions die with the floor —
  // Death (hp-based) and any still-pending c.fearArmed both survive.
  resetFloorPhobiaRegions(state.c);
  // CUT-02 (Phase 36): LAST — after checkLevel and genFloor (both draw) and
  // after floorChanged, so the murder is narrated on the new floor and the
  // new floor is identical with or without the draw.
  cutthroatMurderCheck(state, rng, events);
  return events;
}
