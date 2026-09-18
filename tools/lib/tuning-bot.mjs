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
// maxCharges (engine/movement.js), songReady/liveFoes (engine/combat.js,
// Phase 22 HARN-02), canRead (engine/magic.js, Phase 22 HARN-02),
// SPELLS/RACES (content/index.js). There is exactly ONE write-path bypass —
// forceParty, below — which mirrors test/parity/harness/comparables.js's
// applyStartCombat precedent for calling an engine internal directly outside
// applyAction. HARNESS-ONLY: never shipped, never a pattern for UI/
// presentation code.

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { canParley, songReady, liveFoes } from "../../engine/combat.js";
import { canCast, expectedStrike, armorBulk } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { canRead } from "../../engine/magic.js";
import { canEquipWeapon, canEquipArmor, weaponUpgradeDelta, armorUpgradeDelta } from "../../engine/items.js";
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
  startDepth: 1, // HARN-04: reuses newRun's dev-only start-at-depth option exactly as the Settings toggle does; no extra kit/gear grants
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

/** expectedDamage(sp) — mean damage of a spell's dice notation (no dmg field -> 0). */
function expectedDamage(sp) {
  return sp.dmg ? (sp.dmg.n * (sp.dmg.sides + 1)) / 2 + sp.dmg.bonus : 0;
}

/**
 * bestCastableSummonIdx(state) — the index of the highest-lvl castable
 * `kind: "summon"` spell (Summon or Phantom Host), or null. Shared by
 * decideAction's in-combat and out-of-combat Summon branches (HARN-02).
 */
function bestCastableSummonIdx(state) {
  let best = null;
  for (let i = 0; i < SPELLS.length; i++) {
    const sp = SPELLS[i];
    if (sp.kind !== "summon") continue;
    if (!canCast(state, sp)) continue;
    if (best === null || sp.lvl > SPELLS[best].lvl) best = i;
  }
  return best;
}

/**
 * lowestCastableUtilitySpellIdx(state) — HARN-02's Wizard-fallback pick: the
 * lowest-lvl castable spell that is not `kind` quake (self-damage) or death
 * (a refused-strike Wizard reacting like a human burns whatever charge is
 * cheapest, not the riskiest one). Ties keep the lowest SPELLS index (first
 * found), matching chooseSpell's own tie-break direction.
 */
function lowestCastableUtilitySpellIdx(state) {
  let best = null;
  for (let i = 0; i < SPELLS.length; i++) {
    const sp = SPELLS[i];
    if (sp.kind === "quake" || sp.kind === "death") continue;
    if (!canCast(state, sp)) continue;
    if (best === null || sp.lvl < SPELLS[best].lvl) best = i;
  }
  return best;
}

/**
 * chooseSpell(state, ctx) — HARN-02: the ONE scoring table replacing
 * findCastableAttackSpell's thrown-only rule. Evaluates every castable spell
 * and returns the highest-scoring pick as `{ idx, tier, score }`, or `null`
 * if nothing is worth casting. Gated to Magic Users with charges remaining
 * (D-05's own scoping — engine/derived.js#canCast itself has no class
 * check).
 *
 * NUMBERS LIVE HERE — the ledger's Bot proxy section (Plan 22-04) transcribes
 * this table verbatim. Per 22-02-PLAN.md's flagged_planner_assumption, these
 * thresholds/constants are Claude's discretion, NOT a verified balance
 * target; only "every branch fires under a synthetic state" is asserted.
 *
 *   KILL    (400+): "Freeze" 410 (frozenSolid on hit); `kind==="death"` 405
 *           only when the post-cost wp stays above the flee line
 *           (`c.wp - 25 > fleeAt * c.maxWP` — the engine itself refuses at
 *           wp<=26 anyway); `kind==="turn"` 402 only vs Walking Dead;
 *           `kind==="gate"` 402 only vs Demons/Walking Dead.
 *   DAMAGE  (300 + expected damage, ties -> higher sp.lvl): expected(sp) =
 *           sp.dmg.n * (sp.dmg.sides + 1) / 2 + sp.dmg.bonus.
 *           `kind==="thrown"` (Mangle/Lightning/Fireball/Ice — Freeze is
 *           already KILL): Lightning's expected is multiplied by
 *           liveFoes(state).length (it hits every foe). `kind==="volley"`
 *           (Fireballs) x4.5 (mean d8 balls). `kind==="acid"` (Acid) x2 (a
 *           documented "two rounds of ticks" constant — NOTE: this makes
 *           Acid score 318 vs 1 foe, not the 309 a plain-expected reading of
 *           22-02-PLAN.md's illustrative "Resulting order" text would give;
 *           the x2 multiplier is this function's actual, documented
 *           behavior — Claude's Discretion per the flagged assumption above);
 *           skipped when the current target already carries `acid`.
 *   DISABLE (200+, only when liveFoes(state).length >= 2): `kind==="stun"`
 *           230, `kind==="weaken"` 220 (skipped when `C.weakened`),
 *           `kind==="shrink"` 215, `kind==="status"` (Doze) 210,
 *           `kind==="stupid"` 205.
 *   HEAL    (100 + expected heal, only when `c.wp / c.maxWP <
 *           ctx.opts.potionThreshold` — potions are drunk earlier in
 *           decideAction, so this fires once potions run out): `kind==="heal"`
 *           (Major Heal 3d10 outranks Heal d10).
 *   WARD-OPENER (50, only when `C.round === 1` and `!c.ward`): `kind==="ward"`
 *           (Shield, Bubble) — sits below every other tier, including KILL,
 *           so an Illusionist who can also learn Freeze still opens with the
 *           kill spell if one is castable (Mirror Self's own opener rule in
 *           decideAction handles the "must go first" illusion case instead).
 *
 * Never auto-cast (no branch below ever scores them): quake (self-damage),
 * vapor/insane (random outcome table), blind, petrify, might, regen, reveal,
 * foresee, senses, summon and mirror (handled by decideAction's opener rules,
 * not this table). On equal scores, prefer the higher `sp.lvl`, then the
 * lower SPELLS index (first found is kept).
 */
export function chooseSpell(state, ctx) {
  const c = state.c;
  const C = state.combat;
  if (c.cls !== "Magic User") return null;
  if (maxCharges(c) - c.spellsUsed <= 0) return null;
  const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold; // D-06
  const target = C ? C.foes[C.target] : null;
  const nFoes = liveFoes(state).length;
  let best = null;
  for (let i = 0; i < SPELLS.length; i++) {
    const sp = SPELLS[i];
    if (!canCast(state, sp)) continue;
    let score;
    let tier;
    if (sp.n === "Freeze") {
      score = 410;
      tier = "kill";
    } else if (sp.kind === "death") {
      if (!C || !(c.wp - 25 > fleeAt * c.maxWP)) continue;
      score = 405;
      tier = "kill";
    } else if (sp.kind === "turn") {
      if (!C || C.type !== "Walking Dead") continue;
      score = 402;
      tier = "kill";
    } else if (sp.kind === "gate") {
      if (!C || (C.type !== "Demons" && C.type !== "Walking Dead")) continue;
      score = 402;
      tier = "kill";
    } else if (sp.kind === "thrown" || sp.kind === "volley" || sp.kind === "acid") {
      if (sp.kind === "acid" && target && target.acid) continue; // already ticking
      let expected = expectedDamage(sp);
      if (sp.n === "Lightning") expected *= Math.max(1, nFoes);
      else if (sp.kind === "volley") expected *= 4.5;
      else if (sp.kind === "acid") expected *= 2; // two rounds of ticks
      score = 300 + expected;
      tier = "damage";
    } else if (sp.kind === "stun" || sp.kind === "weaken" || sp.kind === "shrink" || sp.kind === "status" || sp.kind === "stupid") {
      if (!C || nFoes < 2) continue;
      if (sp.kind === "weaken" && C.weakened) continue;
      score = { stun: 230, weaken: 220, shrink: 215, status: 210, stupid: 205 }[sp.kind];
      tier = "disable";
    } else if (sp.kind === "heal") {
      if (!(c.maxWP > 0 && c.wp / c.maxWP < ctx.opts.potionThreshold)) continue;
      score = 100 + expectedDamage(sp);
      tier = "heal";
    } else if (sp.kind === "ward") {
      if (!C || C.round !== 1 || c.ward) continue;
      score = 50;
      tier = "ward-opener";
    } else {
      continue; // never auto-cast (see JSDoc list above)
    }
    if (best === null || score > best.score || (score === best.score && sp.lvl > SPELLS[best.idx].lvl)) {
      best = { idx: i, tier, score };
    }
  }
  return best;
}

/**
 * isTalkFirst(state) — HARN-02: is the current combatant's identity one that
 * tries talking BEFORE fighting (round 1), regardless of wp? `canParley`
 * still decides whether the attempt is actually AVAILABLE (fluency, Walking
 * Dead's unconditional refusal, etc.) — this only names WHO talks first:
 * Con Artist (any talkable encounter), Woodsman vs Beasts/Lair Beasts, Bard
 * vs Humans, Wilmsry vs anything non-Magical, Elven vs Humans.
 */
export function isTalkFirst(state) {
  if (!state.combat) return false;
  const c = state.c;
  const C = state.combat;
  if (c.sub === "Con Artist") return true;
  if (c.sub === "Woodsman" && (C.type === "Beasts" || C.type === "Lair Beasts")) return true;
  if (c.sub === "Bard" && C.type === "Humans") return true;
  if (c.race === "Wilmsry" && C.type !== "Magical") return true;
  if (c.race === "Elven" && C.type === "Humans") return true;
  return false;
}

/**
 * makeBotContext(opts) — per-run mutable bot state: resolved options, the
 * per-floor action counter, the full-bag flag, `parleyBlocked` (Rule 1 fix)
 * and `fleeBlocked`/`strikeBlocked` (HARN-02 Rule-1 fixes — see decideAction).
 */
export function makeBotContext(opts = {}) {
  return {
    opts: { ...BOT_DEFAULTS, ...opts },
    floorActions: 0,
    findFull: false,
    parleyBlocked: false,
    fleeBlocked: false,
    strikeBlocked: false,
  };
}

// GOLD_RESERVE — Phase 39 (GEAR-01, 39-02-PLAN.md Task 1): wilmst
// chooseStorePurchase always keeps in reserve, never spent on a buy. Keeps
// the bot from walking out of a store with 0 gold before a later repair/food
// need in the same run.
export const GOLD_RESERVE = 50;

/**
 * chooseStorePurchase(state, ctx) — Phase 39 (GEAR-01, 39-02-PLAN.md Task 1):
 * the store buy/equip policy that replaces the pre-Phase-39 "always leave a
 * store" step (l) below. Deliberately reads the engine's OWN
 * legality/upgrade rules — canEquipWeapon/canEquipArmor and
 * weaponUpgradeDelta/armorUpgradeDelta (engine/items.js, the latter rebased
 * on engine/derived.js#expectedStrike) — so a line this function picks is
 * NEVER refused `notBetter` by the engine's own takeItem (T-39-04: a bad
 * pick here would re-offer the same refused line forever and stall the
 * matrix). `ctx` is accepted for call-shape symmetry with every other
 * decideAction helper but is not read — the policy is a pure function of
 * `state.c`/`state.store.stock`.
 *
 * Weapon pass (checked FIRST): among unsold `buyWeapon`/`buyPremium`
 * (`effectParams.item.kind === "weapon"`) lines, legal via canEquipWeapon,
 * affordable (`cost <= c.gold - GOLD_RESERVE`), and a genuine upgrade
 * (`weaponUpgradeDelta(c, item) > 0`) — picks the highest
 * `expectedStrike(c, item.base, item.bonus || 0, 0)`, ties broken by the
 * lower cost. Returns immediately on a weapon hit — `decideAction` dispatches
 * the `buyItem`, and the CALLER's next `decideAction` invocation (the bought
 * line is now `sold`) is what lets the armor pass below ever run.
 *
 * Armor pass (only reached once the weapon pass finds nothing): among unsold
 * `buyArmor`/`buyPremium` (`item.kind === "armor"`) lines, legal via
 * canEquipArmor, affordable, a genuine upgrade
 * (`armorUpgradeDelta(c, item) > 0`) — a Thief additionally skips any line
 * whose `armorBulk({ armor: item.armor }) > 1` (the CONTEXT.md GEAR-01
 * ruling: heavy armor is a Thief's own "bad") — picks the highest `item.ar`,
 * ties broken by the lower cost.
 *
 * Returns `null` when nothing qualifies (including a missing/empty
 * `state.store.stock`) — `decideAction`'s step (l) falls back to
 * `{ type: "leaveStore" }`, exactly the pre-Phase-39 behaviour.
 */
export function chooseStorePurchase(state, ctx) {
  const stock = state.store && Array.isArray(state.store.stock) ? state.store.stock : null;
  if (!stock) return null;
  const c = state.c;
  const budget = c.gold - GOLD_RESERVE; // GOLD_RESERVE kept back, never spent

  let weaponIdx = null;
  let weaponScore = -Infinity;
  for (let i = 0; i < stock.length; i++) {
    const line = stock[i];
    if (line.sold || line.cost > budget) continue;
    if (line.effectId !== "buyWeapon" && line.effectId !== "buyPremium") continue;
    const item = line.effectParams && line.effectParams.item;
    if (!item || item.kind !== "weapon") continue;
    if (!canEquipWeapon(c, item)) continue;
    if (weaponUpgradeDelta(c, item) <= 0) continue;
    const score = expectedStrike(c, item.base, item.bonus || 0, 0);
    if (weaponIdx === null || score > weaponScore || (score === weaponScore && line.cost < stock[weaponIdx].cost)) {
      weaponIdx = i;
      weaponScore = score;
    }
  }
  if (weaponIdx !== null) return { type: "buyItem", idx: weaponIdx };

  let armorIdx = null;
  let armorScore = -Infinity;
  for (let i = 0; i < stock.length; i++) {
    const line = stock[i];
    if (line.sold || line.cost > budget) continue;
    if (line.effectId !== "buyArmor" && line.effectId !== "buyPremium") continue;
    const item = line.effectParams && line.effectParams.item;
    if (!item || item.kind !== "armor") continue;
    if (!canEquipArmor(c, item)) continue;
    if (armorUpgradeDelta(c, item) <= 0) continue;
    if (c.cls === "Thief" && armorBulk({ armor: item.armor }) > 1) continue;
    const score = item.ar;
    if (armorIdx === null || score > armorScore || (score === armorScore && line.cost < stock[armorIdx].cost)) {
      armorIdx = i;
      armorScore = score;
    }
  }
  if (armorIdx !== null) return { type: "buyItem", idx: armorIdx };

  return null;
}

/**
 * decideAction(state, policyRng, ctx) — the shared, deterministic auto-play
 * policy (D-05/D-06/D-12/D-20, extended HARN-02). In combat, priority order:
 *   (a) caster-aware flee/parley threshold (D-06): parley if available, else
 *       flee — UNLESS the character is a Samurai (canon: never flees) or a
 *       flee attempt was already refused this encounter (`ctx.fleeBlocked`),
 *       in which case fall through to fight instead of looping the refusal;
 *   (b) drink below potionThreshold (D-05);
 *   (c) talk-first (HARN-02): the identity talkers (`isTalkFirst`) try
 *       parley once at round 1, before anything else;
 *   (d) sing (HARN-02): a Bard's song, once ready, every round 1 (level 1
 *       only vs Beasts/Lair Beasts — the level-1 song does nothing else);
 *   (e) Summon in combat (HARN-02): round 1, no ally yet, charges remain;
 *   (f) Mirror Self opener (HARN-02): round 1, no active mirror — must
 *       precede the scoring table because an Illusionist can also learn
 *       Freeze (a KILL-tier spell);
 *   (g) Wizard fallback (HARN-02 Rule-1 fix): a strike-refused Wizard casts
 *       something else while charges remain (any castable non-quake/death
 *       spell — a human would rather burn a charge than stand still),
 *       otherwise flees (unless flee is also blocked, in which case attack —
 *       once charges hit 0 the melee refusal lifts on its own);
 *   (h) the scoring table (`chooseSpell`, HARN-02);
 *   (i) attack.
 * Out of combat: (j) decline every pending Joiner (D-20); (k) take/leave a
 * pending find; (l) buy the best affordable weapon/armor upgrade via
 * `chooseStorePurchase` (Phase 39, GEAR-01), else leave the store;
 * (m) drink below potionThreshold;
 * (n) camp below campThreshold (rations permitting); (o) Summon out of
 * combat (HARN-02) when no ally is pending and charges exceed half of
 * maxCharges; (p) read a carried scroll when able (Claude's Discretion —
 * `useItem` is deliberately NOT used for potions: found potions are
 * unidentified, one of the ten is Death, so a blind quaff is not
 * human-like); (q) head to the exit once the floor's dots are cleared or the
 * exploration budget is spent; (r) otherwise explore toward the nearest
 * unseen tile. `policyRng` is a SEPARATE rng stream from the engine's own
 * (see playRun), so harness decisions never perturb engine determinism.
 *
 * Two refusal-loop bugs found during the BEFORE readout (both auto-fixed,
 * Rule 1 — see 22-02-PLAN.md's stuck-investigation writeup):
 *   1. `canParley` stays true forever for a fluency-2 Wilmsry vs a Magical
 *      encounter, but `parley()`'s `wilmsryVsMagical` branch REFUSES without
 *      ever setting `C.parleyTried` (Phase 20, D-12 — a refusal is not a
 *      spent attempt, by canon design). `ctx.parleyBlocked` (set by
 *      `observe` on `parleyRefused`, cleared on the next `encounterStarted`)
 *      makes the bot fall through to flee for the rest of the encounter.
 *   2. A Samurai below the flee threshold picks flee; `flee()` emits
 *      `fleeRefused` (reason samurai) WITHOUT a foe turn — the bot re-picks
 *      flee forever. A Wizard with charges left and no castable attack spell
 *      picks attack; `playerStrike` emits `strikeRefused` (reason wizard),
 *      also without a foe turn — same shape. Both refusals return with NO
 *      foe turn, so a bot that repeats the refused action loops until the
 *      action cap. `ctx.fleeBlocked`/`ctx.strikeBlocked` (set by `observe`
 *      on `fleeRefused`/`strikeRefused`, cleared on `encounterStarted`) make
 *      the bot react like a human would instead: a Samurai simply fights
 *      (step a's explicit `c.sub === "Samurai"` check also handles this
 *      structurally, not just reactively); a blocked Wizard casts something
 *      else or flees (step g).
 */
export function decideAction(state, policyRng, ctx) {
  if (state.combat) {
    // CMB-01 (Phase 31): the bot presses Fight! like a player would.
    if (state.combat.pending) return { type: "fight" };
    const c = state.c;
    const C = state.combat;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold; // D-06
    const chargesLeft = c.cls === "Magic User" ? maxCharges(c) - c.spellsUsed : 0;

    // (a)
    if (ratio < fleeAt) {
      if (!ctx.parleyBlocked && canParley(state)) return { type: "parley" };
      if (!(c.sub === "Samurai" || ctx.fleeBlocked)) return { type: "flee" };
      // Samurai never runs (canon); a flee refused this encounter is not
      // retried (Rule-1 fix) — fall through to the rest of the chain below.
    }

    // (b) D-05
    if (c.potions > 0 && ratio < ctx.opts.potionThreshold) return { type: "drinkPotion" };

    // (c) HARN-02 talk-first
    if (C.round === 1 && isTalkFirst(state) && !ctx.parleyBlocked && canParley(state)) return { type: "parley" };

    // (d) HARN-02 sing
    if (songReady(state) && (c.level >= 2 || C.type === "Beasts" || C.type === "Lair Beasts")) return { type: "sing" };

    // (e) HARN-02 Summon in combat
    if (C.round === 1 && !C.ally && chargesLeft > 0) {
      const summonIdx = bestCastableSummonIdx(state);
      if (summonIdx !== null) return { type: "castSpell", idx: summonIdx };
    }

    // (f) HARN-02 Mirror Self opener — chargesLeft > 0 is required here (not
    // just canCast, which never checks charges): without it, a
    // charges-exhausted caster whose grimoire still contains Mirror Self
    // would have castSpell refuse with `noChargesLeft` (no foe turn, round
    // never advances) and decideAction would re-pick the same action forever
    // — the exact refusal-loop shape this plan's other Rule-1 fixes target.
    if (C.round === 1 && !(c.mirror > 0) && chargesLeft > 0) {
      const mirrorIdx = SPELLS.findIndex((sp) => sp.kind === "mirror" && canCast(state, sp));
      if (mirrorIdx !== -1) return { type: "castSpell", idx: mirrorIdx };
    }

    // (g) HARN-02 Wizard fallback (Rule-1 fix)
    if (ctx.strikeBlocked && chargesLeft > 0) {
      const utilIdx = lowestCastableUtilitySpellIdx(state);
      if (utilIdx !== null) return { type: "castSpell", idx: utilIdx };
      return ctx.fleeBlocked ? { type: "attack" } : { type: "flee" };
    }

    // (h) HARN-02 scoring table
    const pick = chooseSpell(state, ctx);
    if (pick) return { type: "castSpell", idx: pick.idx };

    // (i)
    return { type: "attack" };
  }
  if (state.pendingJoiner) return { type: "resolveJoiner", accept: false }; // D-20
  if (state.pendingFind) return ctx.findFull ? { type: "leaveFind" } : { type: "takeFind" };
  // Phase 39 (GEAR-05): a pending hazard the bot is already carrying the
  // matching tool for is answered in one dispatch (spend it) rather than
  // declining and re-rolling — a pending-STATE handler, not a timing tactic
  // (WHEN to pop an item is Phase 42's bot-tactics scope; this only answers
  // a decision the engine itself already parked). A DECLINED pending record
  // (the retry card) falls through — the bot has already said no once, so
  // the normal movement/action chain below re-issues the same `move` and the
  // roll runs.
  if (state.pendingHazard && !state.pendingHazard.declined) {
    return { type: "useTool", tool: state.pendingHazard.tool, dir: state.pendingHazard.dir };
  }
  if (state.store) return chooseStorePurchase(state, ctx) ?? { type: "leaveStore" };

  const c = state.c;
  const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
  if (ratio < ctx.opts.potionThreshold && c.potions > 0) return { type: "drinkPotion" }; // D-05
  if (ratio < ctx.opts.campThreshold && c.rations >= (RACES[c.race]?.eats || 1)) return { type: "camp" }; // D-05

  // HARN-02: Summon out of combat — bank charges for the fight unless there
  // is plenty to spare (no pendingAlly, more than half of maxCharges left).
  if (c.cls === "Magic User" && !c.pendingAlly) {
    const chargesLeft = maxCharges(c) - c.spellsUsed;
    if (chargesLeft > maxCharges(c) / 2) {
      const summonIdx = bestCastableSummonIdx(state);
      if (summonIdx !== null) return { type: "castSpell", idx: summonIdx };
    }
  }
  // HARN-02 / Claude's Discretion: read a carried scroll out of combat when
  // able. `useItem` is deliberately NOT used for potions here — found
  // potions are unidentified (one of the ten is Death), so a blind quaff is
  // not human-like; kept simple per 22-CONTEXT.md.
  if (c.scrolls > 0 && canRead(state)) return { type: "readScroll" };

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
 * full bag, and `parleyBlocked`/`fleeBlocked`/`strikeBlocked` track a
 * `parleyRefused`/`fleeRefused`/`strikeRefused` event (see decideAction's
 * Rule-1 bugfix comment — both refusals return WITHOUT a foe turn, so a bot
 * that repeats the refused action loops until the action cap, the exact
 * shape of the v1.1 wilmsryVsMagical parley loop) — set the instant a
 * refusal lands, cleared the instant a fresh encounter starts.
 */
export function observe(ctx, events) {
  let floorChangedThisStep = false;
  for (const e of events) {
    if (e.type === "floorChanged") floorChangedThisStep = true;
    else if (e.type === "bagFull") ctx.findFull = true;
    else if (e.type === "findTaken" || e.type === "findLeft") ctx.findFull = false;
    else if (e.type === "parleyRefused") ctx.parleyBlocked = true;
    else if (e.type === "fleeRefused") ctx.fleeBlocked = true;
    else if (e.type === "strikeRefused") ctx.strikeBlocked = true;
    else if (e.type === "encounterStarted") {
      ctx.parleyBlocked = false;
      ctx.fleeBlocked = false;
      ctx.strikeBlocked = false;
    }
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
 *
 * `opts.startDepth`/`opts.force` (HARN-04, 22-CONTEXT.md "Start-at-depth for
 * the bot") pass straight through to `newRun` unchanged — a deep-start
 * character is exactly what the dev Settings toggle already produces (SP set
 * to the depth's threshold -> level via checkLevel, capped at 5; a
 * depth-scaled purse); no extra kit or gear grants. `startDepth`/`force`
 * omitted (or `startDepth: 1`, `force: undefined`) is byte-identical to the
 * old bare `newRun(seed)` call, since `newRun` itself defaults both.
 * `startDepth` on the RETURNED result is the SANITIZED value (`state.floor.depth`
 * right after `newRun`, before any action runs) — not the raw requested number.
 *
 * Result gains four new fields beyond the pre-Phase-22 shape:
 *   `stuck` — true iff the run hit `maxActions` without dying or winning (its
 *     own outcome bucket, excluded from every depth-stat readout below);
 *   `outcome` — one of "dead" | "won" | "stuck" | "unknown" (`cause` is
 *     UNCHANGED — stuck runs keep `cause: "maxActionsHit"` for any older
 *     consumer reading that field);
 *   `floorsGained` — `state.floor.depth - startDepth` (a deep-start run's own
 *     "how far did it get FROM there" reading, HARN-04);
 *   `encountersSurvived` — `tallies.encounters` minus one iff the run's final
 *     death happened while `state.combat` was non-null at the top of that
 *     step (computed from the PRE-action state each step, since `die()`
 *     nulls `state.combat` before this loop can inspect it after the fact).
 */
export function playRun(seed, opts, onStep) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  let state = newRun(seed, [], { startDepth: opts.startDepth, force: opts.force });
  const startDepth = state.floor.depth; // the sanitized value newRun actually used
  if (opts.party) forceParty(state);
  const memberAtStart = opts.party ? state.party.length : 0;
  const ctx = makeBotContext(opts);
  const tallies = makeTallies();
  let actions = 0;
  let diedInCombat = false;
  while (!state.dead && !state.won && actions < ctx.opts.maxActions) {
    const action = decideAction(state, policyRng, ctx);
    const inCombat = !!state.combat;
    let events;
    ({ state, events } = applyAction(state, action));
    if (state.dead && inCombat) diedInCombat = true;
    tallyEvents(tallies, events, state);
    observe(ctx, events);
    if (onStep) onStep(events, state);
    actions++;
  }
  const stuck = !state.dead && !state.won && actions >= ctx.opts.maxActions;
  const outcome = state.dead ? "dead" : state.won ? "won" : stuck ? "stuck" : "unknown";
  return {
    seed,
    state,
    actions,
    tallies,
    deathDepth: state.floor.depth,
    dead: state.dead,
    won: state.won,
    stuck,
    outcome,
    startDepth,
    floorsGained: state.floor.depth - startDepth,
    encountersSurvived: tallies.encounters - (diedInCombat ? 1 : 0),
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

/**
 * reachTable(results) — % of runs (one decimal) with deathDepth >= each
 * REACH_FLOORS entry. HARN-02: a `stuck` run (action cap hit, no
 * death/win) is EXCLUDED first — its depth is a mid-run action-cap
 * measurement, not a death depth, and folding it in would corrupt this
 * readout (a run missing `stuck` entirely, e.g. an older synthetic-state
 * fixture, is treated as not-stuck and counted normally).
 */
export function reachTable(results) {
  const counted = results.filter((r) => !r.stuck);
  const out = {};
  const n = counted.length || 1;
  for (const floor of REACH_FLOORS) {
    const count = counted.filter((r) => r.deathDepth >= floor).length;
    out[String(floor)] = Math.round((count / n) * 1000) / 10;
  }
  return out;
}

/**
 * actionsPerFloorDist(results) — distribution of each run's
 * actions/deathDepth (rounded), excluding `stuck` runs (same rationale as
 * reachTable — a stuck run's actions-per-floor is dominated by the action
 * cap, not real progress).
 */
export function actionsPerFloorDist(results) {
  return distribution(
    results
      .filter((r) => !r.stuck)
      .map((r) => Math.round(r.actionsPerFloor)),
  );
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

/**
 * sharedJson(results, opts) — the D-07/D-08 JSON block both tools splice
 * into their own --json output. `stuck`/`completed` (HARN-02) are top-level
 * counts so a machine consumer never has to re-derive the stuck bucket from
 * `results` itself; `bot.startDepth` (HARN-04) rounds out the parameter
 * block so BEFORE/AFTER JSON snapshots record it too.
 */
export function sharedJson(results, opts) {
  const stuckCount = results.filter((r) => r.stuck).length;
  const out = {
    reach: reachTable(results),
    actionsPerFloor: actionsPerFloorDist(results),
    casterRateByBand: casterRateByBand(results),
    abilities: abilitySummary(results),
    stuck: stuckCount,
    completed: results.length - stuckCount,
    bot: {
      exploreBudget: opts.exploreBudget,
      maxActions: opts.maxActions,
      party: opts.party,
      fleeThreshold: opts.fleeThreshold,
      casterFleeThreshold: opts.casterFleeThreshold,
      potionThreshold: opts.potionThreshold,
      campThreshold: opts.campThreshold,
      startDepth: opts.startDepth,
    },
  };
  if (opts.party) out.party = partySummary(results);
  return out;
}

/**
 * botLine(opts) — HARN-04: the single emitter of the ledger's grep-stable
 * "Bot:" parameter line, so tune-difficulty/tune-economy/tune-classes can
 * never drift out of sync. The original D-08 prefix stays byte-for-byte;
 * `seeds`/`workers` (tune-classes' worker_threads flags) are appended ONLY
 * when present on `opts` (so tune-difficulty/tune-economy's line, which
 * never sets `workers`, stays unchanged apart from the new trailing
 * `startDepth`), and `startDepth` is always appended last.
 */
export function botLine(opts) {
  let line = `Bot: exploreBudget=${opts.exploreBudget}  maxActions=${opts.maxActions}  party=${opts.party ? "on" : "off"}  flee=${opts.fleeThreshold}/${opts.casterFleeThreshold}(caster)  potion<${opts.potionThreshold}  camp<${opts.campThreshold}`;
  if (opts.seeds !== undefined) line += `  seeds=${opts.seeds}`;
  if (opts.workers !== undefined) line += `  workers=${opts.workers}`;
  line += `  startDepth=${opts.startDepth}`;
  return line;
}

/**
 * printSharedReadout(results, opts) — the D-07/D-08 text blocks both tools
 * print after their own tool-specific report. Wording/order is kept STABLE
 * (the ledger transcribes this verbatim), including the final "Bot:" line's
 * two-space field separators — the ledger greps that exact line to prove
 * BEFORE/AFTER used identical parameters. HARN-02 adds a "Stuck:" line
 * directly before it, reporting the excluded-from-depth-stats bucket.
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

  const stuckCount = results.filter((r) => r.stuck).length;
  console.log(
    `\nStuck: ${stuckCount} of ${results.length} runs hit maxActions=${opts.maxActions} (own bucket; excluded from depth stats)`,
  );

  console.log(`\n${botLine(opts)}`);
}
