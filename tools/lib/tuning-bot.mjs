// tools/lib/tuning-bot.mjs
//
// Dev-only, zero-dependency Node ESM module shared by tools/tune-difficulty.mjs
// and tools/tune-economy.mjs (Phase 21, TUNE-02, D-23) so the bot's D-05/D-06
// policy, D-07 tallies, and D-08 readout land exactly once instead of drifting
// across two near-duplicated scripts. NOT shipped, NOT a node:test file (no
// assertions, so `node --test` never picks it up).
//
// THIS IS A TUNING PROXY, NOT A PASS/FAIL GATE, and NOT a substitute for a
// human playtest (03-CONTEXT.md / 03-RESEARCH.md Pitfall 3 — a heuristic
// bot's play skill is arbitrary). Do not gate any build or CI check on this
// module's output; read the distributions as a rough sanity signal only.
//
// Talks to the engine through the public applyAction/newRun/makeRng surface,
// plus READ-ONLY helpers with an existing precedent (both tools already
// import canParley from engine/combat.js): canCast (engine/derived.js),
// maxCharges (engine/movement.js), SPELLS/RACES (content/index.js). There is
// exactly ONE write-path bypass — forceParty, below — which mirrors
// test/parity/harness/comparables.js's applyStartCombat precedent for
// calling an engine internal directly outside applyAction. HARNESS-ONLY:
// never shipped, never a pattern for UI/presentation code.

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { canParley } from "../../engine/combat.js";
import { canCast } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { meetJoiner, resolveJoiner } from "../../engine/encounters.js";
import { SPELLS, RACES } from "../../content/index.js";

// The four cardinal directions the movement domain understands. Defined
// locally so this module only ever talks to the engine through its public
// applyAction/newRun black-box surface, exactly as the real UI would.
export const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// Features a human player routes around when a route exists, rather than
// walking straight through (D-05 descend policy's hazard-avoidance rule).
export const HAZARD_FEATS = new Set(["climb", "gorge", "trap"]);

// D-08 readout shape: the reach-table floor thresholds and the caster-rate
// depth bands.
export const REACH_FLOORS = [5, 10, 20, 30, 50];
export const DEPTH_BANDS = [
  [1, 5],
  [6, 10],
  [11, 20],
  [21, 30],
  [31, 50],
  [51, Infinity],
];

/** bandLabel(depth) — the DEPTH_BANDS label a given depth falls in, e.g. "11-20" or "51+". */
export function bandLabel(depth) {
  for (const [lo, hi] of DEPTH_BANDS) {
    if (depth >= lo && depth <= hi) return hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
  }
  return `${depth}`;
}

// BOT_DEFAULTS — every proxy parameter the harness tunes, cited to its
// deciding CONTEXT.md decision so the ledger's "Bot:" line and this table
// never drift apart.
export const BOT_DEFAULTS = Object.freeze({
  fleeThreshold: 0.3, // D-06: flee/parley threshold vs a plain (non-caster) group
  casterFleeThreshold: 0.5, // D-06: flee/parley threshold vs any kit-bearing live foe
  potionThreshold: 0.5, // D-05 + Claude's Discretion: drink below this wp/maxWP ratio
  campThreshold: 0.5, // D-05 + Claude's Discretion: camp below this wp/maxWP ratio, rations permitting
  exploreBudget: 50, // D-05 + Claude's Discretion: actions explored per floor before heading to the exit
  maxActions: 20000, // Pitfall 4: hard safety stop, prevents a runaway loop from hanging the harness
  party: false, // D-12/D-20: --party forces one member at run start via forceParty
});

/**
 * canStep(f, x, y, dir) — mirrors movement.js's move() one-way-door guard
 * exactly: a step is illegal if the destination is a wall/out-of-bounds, OR
 * the destination is a "one" (one-way door) tile entered from the wrong
 * side, OR the CURRENT tile is a "one" tile departed in the wrong direction.
 */
export function canStep(f, x, y, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = x + dx;
  const ny = y + dy;
  const there = f.g[ny] && f.g[ny][nx];
  if (!there || there.wall) return false;
  if (there.feat === "one" && there.dir !== dir) return false;
  const here = f.g[y][x];
  if (here.feat === "one" && here.dir !== dir) return false;
  return true;
}

/** legalDirs(state) — cardinal directions that lead onto a real, enterable cell. */
export function legalDirs(state) {
  const f = state.floor;
  const legal = [];
  for (const dir of Object.keys(DIRS)) {
    if (canStep(f, f.px, f.py, dir)) legal.push(dir);
  }
  return legal;
}

/**
 * pickFallbackDir(state, policyRng) — a policyRng-picked legal direction,
 * used when neither BFS helper below finds a route. Falls back to any
 * cardinal direction in the (should-never-happen-on-a-generated-floor) case
 * of being fully boxed in.
 */
export function pickFallbackDir(state, policyRng) {
  const legal = legalDirs(state);
  return legal.length ? policyRng.pick(legal) : policyRng.pick(["N", "S", "E", "W"]);
}

/**
 * bfsFirstStep(state, isGoal, avoid) — a generalised breadth-first search
 * over the current floor's open cells from the player's position
 * (respecting one-way doors via canStep). `isGoal(cell, x, y)` decides
 * whether a dequeued (non-start) cell is the target; `avoid(cell)` (may be
 * null/omitted) excludes a cell from being ENTERED — the start cell is
 * exempt from `avoid` (it is never re-entered as a step). Returns the
 * first-step direction toward the nearest goal cell, or null if none is
 * reachable under the given `avoid` rule. No engine RNG involved — pure
 * grid search over state.floor.g.
 */
export function bfsFirstStep(state, isGoal, avoid = null) {
  const f = state.floor;
  const startKey = `${f.px},${f.py}`;
  const visited = new Set([startKey]);
  const queue = [{ x: f.px, y: f.py, first: null }];
  let qi = 0;
  while (qi < queue.length) {
    const { x, y, first } = queue[qi++];
    const isStart = x === f.px && y === f.py;
    const cell = f.g[y] && f.g[y][x];
    if (cell && !isStart && isGoal(cell, x, y)) return first;
    for (const dir of Object.keys(DIRS)) {
      if (!canStep(f, x, y, dir)) continue;
      const [dx, dy] = DIRS[dir];
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const there = f.g[ny][nx];
      if (avoid && avoid(there)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, first: first || dir });
    }
  }
  return null;
}

/**
 * nearestUnseenDir(state) — the first-step direction toward the nearest
 * still-unseen tile. Two-pass (Claude's Discretion, D-05): first a pass that
 * avoids entering any SEEN hazard cell (climb/gorge/trap — a human routes
 * around a visible ledge/gorge/trap when a route exists), then, only if that
 * pass finds nothing, a second pass with no avoidance at all (an unseen
 * hazard is not avoided — the bot only uses information a player has).
 */
export function nearestUnseenDir(state) {
  const unseenGoal = (cell) => !cell.seen;
  const seenHazard = (cell) => cell.seen && HAZARD_FEATS.has(cell.feat);
  return bfsFirstStep(state, unseenGoal, seenHazard) ?? bfsFirstStep(state, unseenGoal, null);
}

/** dirTowardExit(state) — the same two-pass BFS, targeting the floor's "exit" feature. */
export function dirTowardExit(state) {
  const exitGoal = (cell) => cell.feat === "exit";
  const seenHazard = (cell) => cell.seen && HAZARD_FEATS.has(cell.feat);
  return bfsFirstStep(state, exitGoal, seenHazard) ?? bfsFirstStep(state, exitGoal, null);
}

/** dotsRemaining(floor) — count of cells with feat === "dot" (encounters left on this floor). */
export function dotsRemaining(floor) {
  let n = 0;
  for (const row of floor.g) {
    for (const cell of row) {
      if (cell && cell.feat === "dot") n++;
    }
  }
  return n;
}

/** liveFoesHaveAbilities(state) — does the current encounter hold any live, kit-bearing foe? */
export function liveFoesHaveAbilities(state) {
  return !!state.combat && state.combat.foes.some((f) => f.alive && Array.isArray(f.abilities) && f.abilities.length > 0);
}

/**
 * findCastableAttackSpell(state) — the index in SPELLS of the highest-level
 * castable `kind: "thrown"` spell the character can cast right now, or null.
 * D-05's own decision text scopes this policy to Magic Users ("cast an
 * attack spell when the character has charges (Magic Users)"); engine/
 * derived.js#canCast itself has no class check (a non-caster class with a
 * spell name sitting in an empty grimoire array would otherwise still pass
 * the school-gate default), so the explicit `cls` guard below is required to
 * honor that decision, not merely an accident of what canCast happens to
 * allow.
 */
export function findCastableAttackSpell(state) {
  const c = state.c;
  if (c.cls !== "Magic User") return null;
  if (maxCharges(c) - c.spellsUsed <= 0) return null;
  let best = null;
  for (let i = 0; i < SPELLS.length; i++) {
    const sp = SPELLS[i];
    if (sp.kind !== "thrown") continue;
    if (!canCast(state, sp)) continue;
    if (best === null || sp.lvl > SPELLS[best].lvl) best = i;
  }
  return best;
}

/**
 * makeBotContext(opts) — per-run mutable bot state: resolved options, the
 * per-floor action counter, the full-bag flag, and `parleyBlocked` (Rule 1
 * fix — see decideAction).
 */
export function makeBotContext(opts = {}) {
  return { opts: { ...BOT_DEFAULTS, ...opts }, floorActions: 0, findFull: false, parleyBlocked: false };
}

/**
 * decideAction(state, policyRng, ctx) — the shared, deterministic auto-play
 * policy (D-05/D-06/D-12/D-20), in priority order:
 *   (a) in combat: caster-aware flee/parley threshold, then drink, then cast,
 *       then attack;
 *   (b) a pending Joiner is always declined — hiring policy is a Deferred
 *       Idea, `--party` is the only member source;
 *   (c) a pending find is taken unless the bag is currently full;
 *   (d) a store is always left immediately;
 *   (e) out of combat: drink, else camp (rations permitting);
 *   (f) the floor is cleared of dots, or the exploration budget is spent:
 *       head toward the exit;
 *   (g) otherwise: explore toward the nearest unseen tile.
 * `policyRng` is a SEPARATE rng stream from the engine's own (see playRun),
 * so harness decisions never perturb engine determinism.
 *
 * Bug found during the BEFORE readout (auto-fixed, Rule 1): `canParley`
 * stays true forever for a fluency-2 Wilmsry vs a Magical encounter, but
 * `parley()`'s `wilmsryVsMagical` branch REFUSES without ever setting
 * `C.parleyTried` (Phase 20, D-12 — a refusal is not a spent attempt, by
 * canon design). A bot that always prefers parley over flee below the flee
 * threshold therefore re-picks `{ type: "parley" }` forever, burning the
 * entire `maxActions` budget on a no-progress loop instead of fleeing — a
 * human player would simply try something else after being refused once.
 * `ctx.parleyBlocked` (set by `observe` on a `parleyRefused` event, cleared
 * on the next `encounterStarted`) makes the bot do exactly that: fall
 * through to flee for the REST of this encounter once a parley attempt has
 * been refused rather than spent.
 */
export function decideAction(state, policyRng, ctx) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold; // D-06
    if (ratio < fleeAt) {
      if (!ctx.parleyBlocked && canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    if (c.potions > 0 && ratio < ctx.opts.potionThreshold) return { type: "drinkPotion" }; // D-05
    const castIdx = findCastableAttackSpell(state);
    if (castIdx !== null) return { type: "castSpell", idx: castIdx }; // D-05
    return { type: "attack" };
  }
  if (state.pendingJoiner) return { type: "resolveJoiner", accept: false }; // D-20
  if (state.pendingFind) return ctx.findFull ? { type: "leaveFind" } : { type: "takeFind" };
  if (state.store) return { type: "leaveStore" };

  const c = state.c;
  const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
  if (ratio < ctx.opts.potionThreshold && c.potions > 0) return { type: "drinkPotion" }; // D-05
  if (ratio < ctx.opts.campThreshold && c.rations >= (RACES[c.race]?.eats || 1)) return { type: "camp" }; // D-05

  if (dotsRemaining(state.floor) === 0 || ctx.floorActions >= ctx.opts.exploreBudget) {
    const dir = dirTowardExit(state) || nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
    return { type: "move", dir };
  }
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}

/** makeTallies() — a fresh D-07 ability-tally accumulator. */
export function makeTallies() {
  return {
    foeCast: 0,
    foeBolted: 0,
    foeDrained: 0,
    foeDebuffed: 0,
    foeHealed: 0,
    foeSummoned: 0,
    heroResisted: 0,
    heroResistFailed: 0,
    abilityDmg: 0,
    meleeDmg: 0,
    encounters: 0,
    casterEncounters: 0,
    encountersByBand: {},
    casterEncountersByBand: {},
  };
}

/**
 * tallyEvents(tallies, events, stateAfter) — increments the D-07 counters
 * in place from one step's events. `foeBolted` counts abilityDmg only when
 * the event has NO `member` field (a hero-targeted bolt) — a member-targeted
 * bolt (engine/foeAbilities.js's pickFoeTarget branch) is party-member
 * damage, not damage taken by the hero this readout tracks. `foeSummoned`
 * counts only `pending: true` (the ability-cast telegraph), not the later
 * `pending: false` join event, so a single summon is tallied once.
 * `encounterStarted` also feeds the D-08 caster-encounter-rate-by-band
 * table: an encounter that ends inside the same action (e.g. a Knight/Con
 * Artist talkdown) reads `stateAfter.combat === null` and so counts as
 * non-caster.
 */
export function tallyEvents(tallies, events, stateAfter) {
  for (const e of events) {
    switch (e.type) {
      case "foeCast":
        tallies.foeCast++;
        break;
      case "foeBolted":
        tallies.foeBolted++;
        if (e.member === undefined) tallies.abilityDmg += e.dmg || 0;
        break;
      case "foeDrained":
        tallies.foeDrained++;
        break;
      case "foeDebuffed":
        tallies.foeDebuffed++;
        break;
      case "foeHealed":
        tallies.foeHealed++;
        break;
      case "foeSummoned":
        if (e.pending === true) tallies.foeSummoned++;
        break;
      case "heroResisted":
        tallies.heroResisted++;
        break;
      case "heroResistFailed":
        tallies.heroResistFailed++;
        break;
      case "struckByFoe":
        tallies.meleeDmg += e.dmg || 0;
        break;
      case "encounterStarted": {
        tallies.encounters++;
        const band = bandLabel(stateAfter.floor.depth);
        tallies.encountersByBand[band] = (tallies.encountersByBand[band] || 0) + 1;
        if (liveFoesHaveAbilities(stateAfter)) {
          tallies.casterEncounters++;
          tallies.casterEncountersByBand[band] = (tallies.casterEncountersByBand[band] || 0) + 1;
        }
        break;
      }
      default:
        break;
    }
  }
  return tallies;
}

/**
 * observe(ctx, events) — per-step bookkeeping the policy itself reads next
 * turn: the per-floor action counter resets on any `floorChanged` event
 * (else increments once), the full-bag flag tracks `bagFull` / `findTaken` /
 * `findLeft` so the bot never loops offering/declining a find against a
 * full bag, and `parleyBlocked` tracks a `parleyRefused` (see decideAction's
 * Rule-1 bugfix comment) — set the instant a refusal lands, cleared the
 * instant a fresh encounter starts.
 */
export function observe(ctx, events) {
  let floorChangedThisStep = false;
  for (const e of events) {
    if (e.type === "floorChanged") floorChangedThisStep = true;
    else if (e.type === "bagFull") ctx.findFull = true;
    else if (e.type === "findTaken" || e.type === "findLeft") ctx.findFull = false;
    else if (e.type === "parleyRefused") ctx.parleyBlocked = true;
    else if (e.type === "encounterStarted") ctx.parleyBlocked = false;
  }
  if (floorChangedThisStep) ctx.floorActions = 0;
  else ctx.floorActions++;
}

/**
 * forceParty(state) — the ONE write-path bypass (D-20; precedent:
 * applyStartCombat in test/parity/harness/comparables.js). HARNESS-ONLY —
 * never shipped, never a pattern for UI code. There is no hire action and no
 * way to force a Joiner through applyAction, so `--party` calls the
 * engine's own meetJoiner + resolveJoiner directly on a fresh newRun state.
 * These draws shift the run's trajectory, so `--party` is its own
 * distribution, not a paired diff against the solo seed list.
 */
export function forceParty(state) {
  const rng = makeRng(state.rngState);
  const events = [];
  meetJoiner(state, rng, events);
  resolveJoiner(state, true, events);
  state.rngState = rng.getState();
  return state;
}

/**
 * playRun(seed, opts, onStep) — the shared auto-play loop both tools use.
 * `policyRng = makeRng(seed ^ 0x9e3779b9)` is a SEPARATE stream from the
 * engine's own rngState, so the policy's own dice-rolling never perturbs the
 * engine's seeded determinism. `onStep(events, state)`, if supplied, lets a
 * caller layer its own per-tool tallies (e.g. the Phase 20 parley readout,
 * or tune-economy's gold readout) on top of the shared D-07 tallies below.
 */
export function playRun(seed, opts, onStep) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  let state = newRun(seed);
  if (opts.party) forceParty(state);
  const memberAtStart = opts.party ? state.party.length : 0;
  const ctx = makeBotContext(opts);
  const tallies = makeTallies();
  let actions = 0;
  while (!state.dead && !state.won && actions < ctx.opts.maxActions) {
    const action = decideAction(state, policyRng, ctx);
    let events;
    ({ state, events } = applyAction(state, action));
    tallyEvents(tallies, events, state);
    observe(ctx, events);
    if (onStep) onStep(events, state);
    actions++;
  }
  return {
    seed,
    state,
    actions,
    tallies,
    deathDepth: state.floor.depth,
    dead: state.dead,
    won: state.won,
    cause: state.deathNote || (state.won ? "walked out" : actions >= ctx.opts.maxActions ? "maxActionsHit" : "unknown"),
    actionsPerFloor: actions / Math.max(1, state.floor.depth),
    memberAtStart,
    memberAtEnd: state.party.length,
  };
}

// --- D-08 readout helpers (pure over an array of playRun-shaped results) ---

/** percentile(sortedArr, p) — moved verbatim from the tools' own copy. */
export function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length));
  return sortedArr[idx];
}

/** distribution(values) — moved verbatim from the tools' own copy. */
export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

/** reachTable(results) — % of runs (one decimal) with deathDepth >= each REACH_FLOORS entry. */
export function reachTable(results) {
  const out = {};
  const n = results.length || 1;
  for (const floor of REACH_FLOORS) {
    const count = results.filter((r) => r.deathDepth >= floor).length;
    out[String(floor)] = Math.round((count / n) * 1000) / 10;
  }
  return out;
}

/** actionsPerFloorDist(results) — distribution of each run's actions/deathDepth (rounded). */
export function actionsPerFloorDist(results) {
  return distribution(results.map((r) => Math.round(r.actionsPerFloor)));
}

/** casterRateByBand(results) — per-band { band, encounters, casterEncounters, rate } in DEPTH_BANDS order. */
export function casterRateByBand(results) {
  return DEPTH_BANDS.map(([lo, hi]) => {
    const band = hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
    let encounters = 0;
    let casterEncounters = 0;
    for (const r of results) {
      encounters += r.tallies.encountersByBand[band] || 0;
      casterEncounters += r.tallies.casterEncountersByBand[band] || 0;
    }
    return { band, encounters, casterEncounters, rate: encounters ? (casterEncounters / encounters) * 100 : 0 };
  });
}

/** abilitySummary(results) — the eight summed D-07 counters plus abilityDmg/meleeDmg/abilityShare. */
export function abilitySummary(results) {
  const out = {
    foeCast: 0,
    foeBolted: 0,
    foeDrained: 0,
    foeDebuffed: 0,
    foeHealed: 0,
    foeSummoned: 0,
    heroResisted: 0,
    heroResistFailed: 0,
    abilityDmg: 0,
    meleeDmg: 0,
  };
  for (const r of results) {
    const t = r.tallies;
    for (const k of Object.keys(out)) out[k] += t[k] || 0;
  }
  out.abilityShare = out.abilityDmg + out.meleeDmg > 0 ? out.abilityDmg / (out.abilityDmg + out.meleeDmg) : 0;
  return out;
}

/** partySummary(results) — { runs, memberAtStart, memberAtEnd } counts of runs with a member present. */
export function partySummary(results) {
  return {
    runs: results.length,
    memberAtStart: results.filter((r) => r.memberAtStart > 0).length,
    memberAtEnd: results.filter((r) => r.memberAtEnd > 0).length,
  };
}

/** sharedJson(results, opts) — the D-07/D-08 JSON block both tools splice into their own --json output. */
export function sharedJson(results, opts) {
  const out = {
    reach: reachTable(results),
    actionsPerFloor: actionsPerFloorDist(results),
    casterRateByBand: casterRateByBand(results),
    abilities: abilitySummary(results),
    bot: {
      exploreBudget: opts.exploreBudget,
      maxActions: opts.maxActions,
      party: opts.party,
      fleeThreshold: opts.fleeThreshold,
      casterFleeThreshold: opts.casterFleeThreshold,
      potionThreshold: opts.potionThreshold,
      campThreshold: opts.campThreshold,
    },
  };
  if (opts.party) out.party = partySummary(results);
  return out;
}

/**
 * printSharedReadout(results, opts) — the D-07/D-08 text blocks both tools
 * print after their own tool-specific report. Wording/order is kept STABLE
 * (the ledger transcribes this verbatim), including the final "Bot:" line's
 * two-space field separators — the ledger greps that exact line to prove
 * BEFORE/AFTER used identical parameters.
 */
export function printSharedReadout(results, opts) {
  const reach = reachTable(results);
  console.log("Reach table (% of runs reaching floor N):");
  console.log(
    `  >=5: ${reach["5"].toFixed(1)}%  >=10: ${reach["10"].toFixed(1)}%  >=20: ${reach["20"].toFixed(1)}%  >=30: ${reach["30"].toFixed(1)}%  >=50: ${reach["50"].toFixed(1)}%`,
  );

  const apf = actionsPerFloorDist(results);
  console.log("\nActions per floor (actions / death depth, per run):");
  console.log(`  min=${apf.min}  p50=${apf.p50}  p90=${apf.p90}  max=${apf.max}`);

  const bands = casterRateByBand(results);
  console.log("\nCaster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):");
  for (const b of bands) {
    console.log(`  ${b.band}: ${b.casterEncounters}/${b.encounters} (${b.rate.toFixed(1)}%)`);
  }

  const ab = abilitySummary(results);
  console.log("\nFoe abilities (D-07 readout — informational, not a gate):");
  console.log(
    `  foeCast=${ab.foeCast}  foeBolted=${ab.foeBolted}  foeDrained=${ab.foeDrained}  foeDebuffed=${ab.foeDebuffed}  foeHealed=${ab.foeHealed}  foeSummoned=${ab.foeSummoned}`,
  );
  console.log(`  heroResisted=${ab.heroResisted}  heroResistFailed=${ab.heroResistFailed}`);
  const sharePct = (ab.abilityShare * 100).toFixed(1);
  console.log(`  ability damage: ${ab.abilityDmg} of ${ab.abilityDmg + ab.meleeDmg} total damage taken (${sharePct}%)`);

  if (opts.party) {
    const ps = partySummary(results);
    const alivePct = ((ps.memberAtEnd / Math.max(1, ps.runs)) * 100).toFixed(1);
    console.log("\nParty (--party, D-12/D-20):");
    console.log(`  member forced at run start in ${ps.memberAtStart}/${ps.runs} runs; member alive at run end: ${ps.memberAtEnd} (${alivePct}%)`);
  }

  console.log(
    `\nBot: exploreBudget=${opts.exploreBudget}  maxActions=${opts.maxActions}  party=${opts.party ? "on" : "off"}  flee=${opts.fleeThreshold}/${opts.casterFleeThreshold}(caster)  potion<${opts.potionThreshold}  camp<${opts.campThreshold}`,
  );
}
