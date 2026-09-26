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
// SPELLS/RACES (content/index.js). Phase 42 (BAL-01 second half) adds:
// isReady (engine/effects.js); itemReady/toolIndex/TARGETED_KINDS
// (engine/items.js); inDark/itemEffectActive/activationFor/
// DEATH_PANIC_THRESHOLD (engine/derived.js); ABILITY_BY_ID (content/index.js).
// There are exactly TWO write-path bypasses — forceParty (below), which
// mirrors test/parity/harness/comparables.js's applyStartCombat precedent
// for calling an engine internal directly outside applyAction, and playRun's
// combat-target selection before a useAbility dispatch, which mirrors the
// shell's own foe-card tap. HARNESS-ONLY: never shipped, never a pattern for
// UI/presentation code.

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { canParley, songReady, liveFoes } from "../../engine/combat.js";
import { canCast, expectedStrike, armorBulk, DEATH_PANIC_THRESHOLD, inDark, itemEffectActive, activationFor, WORN_SLOTS, wieldedStaff } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { canRead } from "../../engine/magic.js";
import { canEquipWeapon, canEquipArmor, weaponUpgradeDelta, armorUpgradeDelta, itemReady, toolIndex, TARGETED_KINDS } from "../../engine/items.js";
import { isReady } from "../../engine/effects.js";
import { meetJoiner, resolveJoiner } from "../../engine/encounters.js";
import { SPELLS, RACES, ABILITY_BY_ID, WEAPONS } from "../../content/index.js";

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
  fleeThreshold: 0.4, // USER RULING D (54-CONTEXT.md, 2026-09-21): flee/parley threshold vs a plain (non-caster) group (was D-06's 0.3)
  casterFleeThreshold: 0.6, // USER RULING D (54-CONTEXT.md, 2026-09-21): flee/parley threshold vs any kit-bearing live foe (was D-06's 0.5)
  potionThreshold: 0.6, // USER RULING D (54-CONTEXT.md, 2026-09-21): drink below this wp/maxWP ratio (was D-05's 0.5)
  campThreshold: 0.5, // USER RULING D (54-CONTEXT.md, 2026-09-21): camp below this wp/maxWP ratio, rations permitting — UNCHANGED from D-05 + Claude's Discretion
  exploreBudget: 50, // D-05 + Claude's Discretion: actions explored per floor before heading to the exit
  maxActions: 20000, // Pitfall 4: hard safety stop, prevents a runaway loop from hanging the harness
  party: false, // D-12/D-20: --party forces one member at run start via forceParty
  startDepth: 1, // HARN-04: reuses newRun's dev-only start-at-depth option exactly as the Settings toggle does; no extra kit/gear grants
});

/**
 * BOT_TACTICS — Phase 42 (BAL-01 second half, 42-02-PLAN.md): the ability/
 * item/spell TACTICS constants — Claude's discretion, NOT a verified balance
 * target and NOT part of the frozen `Bot:` line (`botLine`/`BOT_DEFAULTS`
 * stay byte-identical to the BEFORE pin's `meta.bot` — see the parameter-
 * parity gate this separation exists to satisfy). Transcribed verbatim into
 * docs/CLASS-PASS.md by Plan 03.
 *   hardFoeLvl      — a live foe at/above this level makes `hardFight` true
 *                      (buff-before-a-hard-fight gate).
 *   staffMinFoes    — a worn targeted-kind staff (freeze/weaken/stone/fire/
 *                      gas) is fired only at/above this many live foes.
 *   dotToughMargin  — consumed by Plan 03's spell-by-niche rules (a DOT spell
 *                      prefers a foe at least this many levels tougher than
 *                      the party's own).
 *   mapBankRatio    — consumed by Plan 03's Map the Floor timing rule (cast
 *                      only when spell charges banked exceed this fraction).
 */
export const BOT_TACTICS = Object.freeze({
  hardFoeLvl: 3,
  staffMinFoes: 2,
  dotToughMargin: 1,
  mapBankRatio: 0.5,
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
 * hardestFoeIndex(state) — Phase 42 (BAL-01 second half): the live foe a
 * once-a-fight, foe-targeted ability (mark/hamstring/cutpurse/lastStand)
 * should be aimed at — the highest `lvl`, ties broken by higher `wp`, then
 * the lowest index. Returns `null` with no live foe. Pure, no rng.
 */
export function hardestFoeIndex(state) {
  const C = state.combat;
  if (!C || !Array.isArray(C.foes)) return null;
  let best = -1;
  let bestFoe = null;
  for (let i = 0; i < C.foes.length; i++) {
    const f = C.foes[i];
    if (!f || !f.alive) continue;
    if (
      !bestFoe ||
      f.lvl > bestFoe.lvl ||
      (f.lvl === bestFoe.lvl && f.wp > bestFoe.wp)
    ) {
      best = i;
      bestFoe = f;
    }
  }
  return best === -1 ? null : best;
}

/**
 * chooseAbility(state, ctx) — Phase 42 (BAL-01 second half): mirrors
 * engine/combat.js#pickMemberAbility's exact Joiner class-driven use policy
 * (round-1 opener; else an above-half-hp damage ability, Last Stand gated on
 * the hero's own death-panic threshold; else a below-half-hp defensive
 * ability; else null) — with `sheet = ally = state.c` (the hero uses its own
 * kit by the same rule a Joiner's own kit follows). Returns `null` outside
 * combat, for a Magic User, with no/empty `c.abilities`, when every owned
 * ability is on cooldown, or when nothing matches the policy. A once-a-fight
 * (`cd === "fight"`) FOE-targeted ability carries `target: hardestFoeIndex(state)`;
 * a self/cooldown-only ability carries no `target`. Pure, no rng.
 */
export function chooseAbility(state, ctx) {
  const C = state.combat;
  if (!C) return null;
  const c = state.c;
  if (c.cls !== "Fighter" && c.cls !== "Thief") return null;
  const owned = Array.isArray(c.abilities) ? c.abilities : [];
  const ready = owned
    .filter(
      (id) =>
        ABILITY_BY_ID[id] &&
        ABILITY_BY_ID[id].cls === c.cls &&
        isReady(c, `ability:${id}`) &&
        !ctx.abilityBlocked.has(id),
    )
    .map((id) => ABILITY_BY_ID[id]);
  if (!ready.length) return null;

  const cur = C.foes[C.target];
  const target = cur && cur.alive ? cur : liveFoes(state)[0];

  let meta = null;
  if (C.round === 1) {
    meta = ready.find((m) => m.tag === "opener") || null;
  }
  if (!meta && target && target.wp > target.maxWP / 2) {
    meta = ready.find((m) => m.tag === "damage" && (m.id !== "lastStand" || c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD)) || null;
  }
  if (!meta && c.wp < c.maxWP / 2) {
    meta = ready.find((m) => m.tag === "defensive") || null;
  }
  if (!meta) return null;

  const result = { key: meta.id };
  if (meta.cd === "fight" && meta.target === "foe") {
    result.target = hardestFoeIndex(state);
  }
  return result;
}

/** expectedDamage(sp) — mean damage of a spell's dice notation (no dmg field -> 0). */
function expectedDamage(sp) {
  return sp.dmg ? (sp.dmg.n * (sp.dmg.sides + 1)) / 2 + sp.dmg.bonus : 0;
}

/**
 * bestBurstExpected(state) — Phase 42 (BAL-01 second half): the highest
 * `expectedDamage(sp)` over every CASTABLE `niche === "burst"` spell that
 * also carries a `dmg` field (Death has no `dmg` field and is excluded) — 0
 * when none qualify. Feeds chooseSpell's DOT-vs-burst toughness rule (a DOT
 * is skipped against a foe a burst spell could simply finish) and that same
 * burst spell's own finish-score bonus. Pure, no rng.
 */
function bestBurstExpected(state) {
  let best = 0;
  for (const sp of SPELLS) {
    if (sp.niche !== "burst" || !sp.dmg) continue;
    if (!canCast(state, sp)) continue;
    const expected = expectedDamage(sp);
    if (expected > best) best = expected;
  }
  return best;
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
 * MODE (USER RULING D, 54-CONTEXT.md, 2026-09-21): before scoring, this
 * function computes `mode` = "defensive" when `c.maxWP > 0 && c.wp / c.maxWP
 * < ctx.opts.potionThreshold`, OR when `liveFoes(state).length >= 2` and no
 * KILL-tier (400+) spell is currently castable (`hasCastableKillTier`) —
 * else "offensive". `ctx.lastSpellMode` is set to this value every call so
 * `playRun`'s identity tallies can count defensive vs offensive casts. In
 * `defensive` mode the HEAL/DISABLE/WARD tiers below are re-ranked ABOVE the
 * DAMAGE tier (HEAL 460, DISABLE 420-450, WARD 410 — all three still gated on
 * their own existing conditions, only their SCORE changes); the DAMAGE and
 * KILL tiers are byte-identical in both modes. In `offensive` mode every
 * tier is exactly as documented below (today's table, unchanged).
 *
 *   KILL    (400+): Freeze's own `onHit` data flag (Phase 40 SPELL-01, never
 *           the spell's name, per research Pitfall 2) 410 (frozenSolid on
 *           hit); `kind==="death"` 405 only when the post-cost wp stays
 *           above the flee line
 *           (`c.wp - 25 > fleeAt * c.maxWP` — the engine itself refuses at
 *           wp<=26 anyway); `kind==="turn"` 402 only vs Walking Dead;
 *           `kind==="gate"` 402 only vs Demons/Walking Dead.
 *   DAMAGE  (300 + expected damage, ties -> higher sp.lvl): expected(sp) =
 *           sp.dmg.n * (sp.dmg.sides + 1) / 2 + sp.dmg.bonus.
 *           `kind==="thrown"` (Mangle/Lightning/Fireball — Freeze is already
 *           KILL) or `kind==="dot"` (Ice, Phase 40): Lightning's own `aoe`
 *           data flag (never the spell's name) multiplies the expected
 *           damage by liveFoes(state).length (it hits every foe).
 *           `kind==="volley"` (Fireballs) x4.5 (mean d8 balls). `kind==="acid"`
 *           (Acid) x2 (a documented "two rounds of ticks" constant — NOTE:
 *           this makes Acid score 318 vs 1 foe, not the 309 a plain-expected
 *           reading of 22-02-PLAN.md's illustrative "Resulting order" text
 *           would give; the x2 multiplier is this function's actual,
 *           documented behavior — Claude's Discretion per the flagged
 *           assumption above); skipped when the current target already
 *           carries `acid`. `kind==="dot"` (Ice, Phase 40 SPELL-01) x3 — the
 *           mean tick count of the real `d4+1` duration (3.5, rounded to a
 *           documented constant like Acid's own x2); skipped when the
 *           current target already carries `dot`.
 *
 *           Phase 42 (BAL-01 second half, CONTEXT.md "DOT on a tough single
 *           foe, burst on a weak single foe") — both rules below are keyed
 *           on `sp.niche`, never a spell name or `sp.kind` alone:
 *             - DOT-vs-toughness: a `niche==="dot"` spell (Acid, Ice) is
 *               SKIPPED when the target won't outlast the party's own best
 *               castable `niche==="burst"` spell — `target.wp <=
 *               bestBurstExpected(state) + BOT_TACTICS.dotToughMargin`. A
 *               DOT is only worth its multi-round tail against a foe tough
 *               enough to survive a burst outright.
 *             - Burst-finish: a `niche==="burst"` spell with a `dmg` field
 *               whose plain `expected` damage already meets or exceeds the
 *               target's current `wp` scores `350 + expected` instead of the
 *               usual `300 + expected` — a likely one-shot kill outranks
 *               every other DAMAGE-tier pick (but never a KILL-tier spell,
 *               scored 400+).
 *   DISABLE (200+ offensive / 420-450 defensive, only when
 *           liveFoes(state).length >= 2): `kind==="stun"` 230/450,
 *           `kind==="weaken"` 220/440 (skipped when `C.weakened`),
 *           `kind==="shrink"` 215/435, `kind==="status"` (Doze) 210/430,
 *           `kind==="stupid"` 205/425.
 *   HEAL    (100 defensive: 460 + expected heal, only when `c.wp / c.maxWP <
 *           ctx.opts.potionThreshold` — potions are drunk earlier in
 *           decideAction, so this fires once potions run out): `kind==="heal"`
 *           (Major Heal 3d10 outranks Heal d10).
 *   WARD-OPENER (50 offensive / 410 defensive): `kind==="ward"` (Shield,
 *           Bubble) — offensive mode keeps the existing `C.round === 1 &&
 *           !c.ward` gate (sits below every other tier, including KILL, so an
 *           Illusionist who can also learn Freeze still opens with the kill
 *           spell if one is castable — Mirror Self's own opener rule in
 *           decideAction handles the "must go first" illusion case instead);
 *           defensive mode lifts the round-1 restriction — only `!c.ward` is
 *           required, since a ward popped mid-fight while going badly is
 *           still worth it.
 *
 * Never auto-cast (no branch below ever scores them): quake (self-damage),
 * vapor/insane (random outcome table), blind, petrify, might, regen, reveal,
 * foresee, senses, summon and mirror (handled by decideAction's opener rules,
 * not this table). On equal scores, prefer the higher `sp.lvl`, then the
 * lower SPELLS index (first found is kept).
 */
/**
 * hasCastableKillTier(state, ctx) — USER RULING D: is any of chooseSpell's
 * own KILL-tier (400+) branches currently castable? A read-only pre-pass
 * over the exact same four KILL conditions the main scoring loop below
 * checks (never re-derived, never a spell name) — feeds chooseSpell's own
 * defensive/offensive MODE decision (a caster with a one-shot kill in hand
 * stays offensive even against 2+ foes). Pure, no rng.
 */
function hasCastableKillTier(state, ctx) {
  const c = state.c;
  const C = state.combat;
  const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold;
  for (const sp of SPELLS) {
    if (!canCast(state, sp)) continue;
    if (sp.onHit === "freeze") return true;
    if (sp.kind === "death" && C && c.wp - 25 > fleeAt * c.maxWP) return true;
    if (sp.kind === "turn" && C && C.type === "Walking Dead") return true;
    if (sp.kind === "gate" && C && (C.type === "Demons" || C.type === "Walking Dead")) return true;
  }
  return false;
}
export function chooseSpell(state, ctx) {
  const c = state.c;
  const C = state.combat;
  if (c.cls !== "Magic User") return null;
  if (maxCharges(c) - c.spellsUsed <= 0) return null;
  const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold; // D-06
  const target = C ? C.foes[C.target] : null;
  const nFoes = liveFoes(state).length;
  const burstBest = bestBurstExpected(state); // Phase 42 (BAL-01 second half)
  // USER RULING D: defensive/offensive MODE, computed once per call — a
  // DEFENSIVE cast (heal/ward/disable) outranks a DAMAGE cast when the fight
  // is going badly (below the potion threshold, or 2+ live foes with no
  // castable one-shot); OFFENSIVE otherwise. ctx.lastSpellMode is set for
  // playRun's identity tallies (castsDefensive/castsOffensive).
  const belowPotion = c.maxWP > 0 && c.wp / c.maxWP < ctx.opts.potionThreshold;
  const outnumberedNoKill = nFoes >= 2 && !hasCastableKillTier(state, ctx);
  const mode = belowPotion || outnumberedNoKill ? "defensive" : "offensive";
  ctx.lastSpellMode = mode;
  let best = null;
  for (let i = 0; i < SPELLS.length; i++) {
    const sp = SPELLS[i];
    if (!canCast(state, sp)) continue;
    let score;
    let tier;
    if (sp.onHit === "freeze") {
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
    } else if (sp.kind === "thrown" || sp.kind === "volley" || sp.kind === "acid" || sp.kind === "dot") {
      if (sp.kind === "acid" && target && target.acid) continue; // already ticking
      if (sp.kind === "dot" && target && target.dot) continue; // already ticking (Phase 40)
      // Phase 42 (BAL-01 second half): a DOT (niche "dot" — Acid/Ice) is
      // skipped against a foe the party's own best castable burst spell
      // could simply finish this turn — see bestBurstExpected/chooseSpell's
      // JSDoc above.
      if (sp.niche === "dot" && target && target.wp <= burstBest + BOT_TACTICS.dotToughMargin) continue;
      let expected = expectedDamage(sp);
      if (sp.aoe === "all") expected *= Math.max(1, nFoes);
      else if (sp.kind === "volley") expected *= 4.5;
      else if (sp.kind === "acid") expected *= 2; // two rounds of ticks
      // Phase 40 (SPELL-01): Ice is now a real per-round DOT
      // (engine/magic.js#castSpell's `dot` branch + combat.js#foeTurn's own
      // f.dot tick/freeze payoff) — scored with the same "documented mean
      // tick count" constant Acid uses, per its own d4+1 duration (mean 3.5).
      else if (sp.kind === "dot") expected *= 3;
      // Phase 42 (BAL-01 second half): a burst spell (niche "burst") whose
      // plain expected damage already meets/exceeds the target's current wp
      // outranks every other DAMAGE-tier pick — a likely finish beats a
      // slower DOT or a multi-target spread, but never a KILL-tier spell.
      if (sp.niche === "burst" && sp.dmg && target && expected >= target.wp) {
        score = 350 + expected;
      } else {
        score = 300 + expected;
      }
      tier = "damage";
    } else if (sp.kind === "stun" || sp.kind === "weaken" || sp.kind === "shrink" || sp.kind === "status" || sp.kind === "stupid") {
      if (!C || nFoes < 2) continue;
      if (sp.kind === "weaken" && C.weakened) continue;
      // USER RULING D: defensive mode re-ranks DISABLE above DAMAGE.
      score = mode === "defensive"
        ? { stun: 450, weaken: 440, shrink: 435, status: 430, stupid: 425 }[sp.kind]
        : { stun: 230, weaken: 220, shrink: 215, status: 210, stupid: 205 }[sp.kind];
      tier = "disable";
    } else if (sp.kind === "heal") {
      if (!(c.maxWP > 0 && c.wp / c.maxWP < ctx.opts.potionThreshold)) continue;
      // USER RULING D: defensive mode re-ranks HEAL above DAMAGE (this
      // branch's own gate already implies belowPotion === true, so `mode`
      // is "defensive" whenever this branch is reachable — written as an
      // explicit ternary anyway so the score is never silently coupled to
      // an assumption about the gate above).
      score = (mode === "defensive" ? 460 : 100) + expectedDamage(sp);
      tier = "heal";
    } else if (sp.kind === "ward") {
      // USER RULING D: defensive mode lifts the round-1 restriction (only
      // `!c.ward` gates it) and re-ranks WARD above DAMAGE at 410.
      if (!C || c.ward) continue;
      if (mode !== "defensive" && C.round !== 1) continue;
      score = mode === "defensive" ? 410 : 50;
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
 * Phase 42 (BAL-01 second half): `abilityBlocked`/`itemBlocked` are the
 * matching Rule-1 safety nets for a refused ability/item — a refusal returns
 * with NO state change, so a bot that re-picks the same key/label loops to
 * `maxActions`; both sets are cleared on `encounterStarted` (`itemBlocked`
 * also on `floorChanged`, see `observe`). `mappedDepth` (Phase 42, BAL-01
 * second half) is the depth Map the Floor was last cast on this run (`null`
 * until the first cast) — set by `observe` on the spell's `floorMapped`
 * event.
 */
export function makeBotContext(opts = {}) {
  return {
    opts: { ...BOT_DEFAULTS, ...opts },
    floorActions: 0,
    findFull: false,
    parleyBlocked: false,
    fleeBlocked: false,
    strikeBlocked: false,
    abilityBlocked: new Set(),
    itemBlocked: new Set(),
    mappedDepth: null,
  };
}

// GOLD_RESERVE — Phase 39 (GEAR-01, 39-02-PLAN.md Task 1): wilmst
// chooseStorePurchase always keeps in reserve, never spent on a buy. Keeps
// the bot from walking out of a store with 0 gold before a later repair/food
// need in the same run.
export const GOLD_RESERVE = 50;

/**
 * RUN_FLAGS — the bot plays the shipped run rules: `storeRoll` enables the
 * depth-rolled store stock. The worn-slot model needs no flag since Phase 45
 * (HEDGE-01) — `newRun` always creates `c.worn`, so a Thief starts with its
 * cloak worn. `meta.runFlags` records this object; the v1.5 AFTER readouts
 * (`docs/class-pass/v15-after*.json`) recorded the two-flag era and are
 * frozen history — never regenerated to match.
 */
export const RUN_FLAGS = Object.freeze({ storeRoll: true });

/**
 * readyWornOfKind(state, ctx, kinds, opts) — 260918-w4n (use-activated-only),
 * rewritten 260918-wy1 (jewelry-merge): the ONE "does this hero have a
 * worn, ready, not-yet-blocked activatable of one of these kinds, in ANY
 * worn key" read every item tactic below shares — family-agnostic: a glow/
 * tongue/fly/knit item is found whether it sits in jewelry1, jewelry2, or
 * the cloak key, never by a hard-coded slot name. Scans `WORN_SLOTS` in
 * order and returns `{ slot, it }` for the FIRST key whose worn item's
 * `activationFor(it).kind` is a member of `kinds`, `itemReady(state, it)` is
 * true, and `it` is not already in `ctx.itemBlocked` (by its own label) —
 * else `null`. `opts.skipIfActive` (default false) additionally skips a
 * candidate whose kind is already live (`itemEffectActive`) — the round-1
 * buff tier's own "don't re-trigger an already-active buff" rule, which
 * must keep scanning the REMAINING worn keys rather than stopping at the
 * first (possibly-already-live) match. Pure.
 */
function readyWornOfKind(state, ctx, kinds, opts = {}) {
  const c = state.c;
  if (!c.worn) return null;
  for (const slot of WORN_SLOTS) {
    const it = c.worn[slot];
    if (!it) continue;
    const act = activationFor(it);
    if (!act || !kinds.includes(act.kind)) continue;
    if (opts.skipIfActive && itemEffectActive(c, act.kind)) continue;
    if (ctx.itemBlocked.has(itemLabel(it))) continue;
    if (itemReady(state, it)) return { slot, it };
  }
  return null;
}

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
 * itemLabel(it) — Phase 42 (BAL-01 second half): the `ctx.itemBlocked` label
 * for item `it` — `potion:<eff2>` for a potion, `tool:<tool>` for a tool,
 * else the item's own display name `.n` (a cloak/staff/jewel). Exported so
 * Plan 03's usage tallies can key off the exact same label `observe` blocks
 * on. Pure, null-safe.
 */
export function itemLabel(it) {
  if (!it || typeof it !== "object") return "";
  if (it.kind === "potion") return `potion:${it.eff2}`;
  if (it.kind === "tool") return `tool:${it.tool}`;
  return it.n;
}

/**
 * hardFight(state) — Phase 42 (BAL-01 second half): true when the current
 * encounter holds any kit-bearing live foe OR any live foe at/above
 * `BOT_TACTICS.hardFoeLvl` — the "pop a buff before this one" gate. Pure.
 */
export function hardFight(state) {
  if (liveFoesHaveAbilities(state)) return true;
  return liveFoes(state).some((f) => f.lvl >= BOT_TACTICS.hardFoeLvl);
}

/**
 * chooseCombatItem(state, ctx) — Phase 42 (BAL-01 second half) + 260918-w4n
 * (use-activated-only): the bot's in-combat item policy, checked only while
 * `state.combat` exists. Returns `{ action, reason }` or `null`:
 *   (1) "heal" — below the flee line, a bag Healing/Xtra Healing potion
 *       (Xtra Healing preferred) drunk BEFORE the flee/parley decision;
 *   (2) "buff" — round 1 of a `hardFight`, a bag Speed/Strength/Enlarge
 *       potion (in that preference order) whose activation kind is not
 *       already active, or the first ready worn buff (haste/brace/plate/
 *       unseen/power/giant, in WORN_SLOTS order) whose kind is not already
 *       live;
 *   (3) "staff" — a Magic User's ready WIELDED staff (RULES-13, Phase 75,
 *       Plan 09: the 260918-w4n "no worn slot" amendment is reversed — a
 *       staff equips into the weapon slot, `wieldedStaff(c)`, dispatched by
 *       `{ slot: "weapon" }`; a bagged staff's power is inert, so this never
 *       reads one): a targeted kind at `staffMinFoes`+ live foes, `dome` or
 *       `heal` below `potionThreshold`.
 * Every candidate passes `itemReady` (covers the death-potion/no-charges/
 * cooldown cases) and is skipped when `ctx.itemBlocked` already carries its
 * `itemLabel`. RULES-09 (Phase 75.1, superseded 260918-w4n note): a Pilfer
 * buffs like anyone now — potions never fumble, and a worn buff risks the
 * RULES-09 fumble, which a human bot-stand-in would accept for the round-1
 * edge it buys. All reads go through `activationFor(it).kind` — never
 * `it.use`. Pure, no rng.
 */
export function chooseCombatItem(state, ctx) {
  const c = state.c;
  const C = state.combat;
  if (!C) return null;
  const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
  const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold;
  const items = Array.isArray(c.items) ? c.items : [];
  const eligible = (it) => !!it && !ctx.itemBlocked.has(itemLabel(it)) && itemReady(state, it);

  // (1) heal below the flee line — Xtra Healing ("full") preferred over
  // Healing ("heal").
  if (ratio < fleeAt) {
    let bestIdx = -1;
    let bestFull = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || it.kind !== "potion" || (it.eff2 !== "heal" && it.eff2 !== "full")) continue;
      if (!eligible(it)) continue;
      const isFull = it.eff2 === "full";
      if (bestIdx === -1 || (isFull && !bestFull)) {
        bestIdx = i;
        bestFull = isFull;
      }
    }
    if (bestIdx !== -1) return { action: { type: "useItem", i: bestIdx }, reason: "heal" };
  }

  // (2) round-1 buff before a hard fight. RULES-09 (Phase 75.1): the Pilfer
  // skip that used to sit here is gone — potions never fumble for anyone,
  // and this tier's worn buffs (haste/brace/plate/unseen/power/giant) carry
  // the same RULES-09 fumble risk for a Pilfer that any other use does.
  if (C.round === 1 && hardFight(state)) {
    for (const eff2 of ["speed", "strength", "enlarge"]) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || it.kind !== "potion" || it.eff2 !== eff2) continue;
        if (!eligible(it)) continue;
        const act = activationFor(it);
        if (act && itemEffectActive(c, act.kind)) continue;
        return { action: { type: "useItem", i }, reason: "buff" };
      }
    }
    // 260918-w4n: the first ready worn combat buff, in WORN_SLOTS order,
    // among the kinds a round-1 buff should ever fire for — haste (Cloak of
    // Speed), brace (Cloak of Strength), plate (Cloak of Armor), unseen
    // (Anklet of Invisibility), power (Ring of Power), giant (Gauntlet of
    // the Giant) — skipped when that kind is already live. 260918-wy1:
    // readyWornOfKind itself now scans WORN_SLOTS (jewelry1/jewelry2/cloak)
    // and (via skipIfActive) keeps scanning past an already-live match, so
    // this collapses to a single call — the first ready, not-yet-live buff
    // in EITHER jewelry key or the cloak.
    const buffKinds = ["haste", "brace", "plate", "unseen", "power", "giant"];
    const buffFound = readyWornOfKind(state, ctx, buffKinds, { skipIfActive: true });
    if (buffFound) return { action: { type: "useItem", slot: buffFound.slot }, reason: "buff" };
  }

  // (3) a Magic User's ready WIELDED staff (RULES-13, Phase 75, Plan 09: a
  // bagged staff's power is inert now — the bot only ever wields staves out
  // of combat (the out-of-combat equip-a-staff step in `decideAction`), so
  // this reads `wieldedStaff(c)` and dispatches by slot, never by bag index;
  // a bagged staff is simply never picked here).
  if (c.cls === "Magic User") {
    const staff = wieldedStaff(c);
    if (staff && eligible(staff)) {
      const kind = activationFor(staff)?.kind;
      if (TARGETED_KINDS.has(kind) && liveFoes(state).length >= BOT_TACTICS.staffMinFoes) {
        return { action: { type: "useItem", slot: "weapon" }, reason: "staff" };
      }
      if (kind === "dome" && ratio < ctx.opts.potionThreshold && !c.ward) {
        return { action: { type: "useItem", slot: "weapon" }, reason: "staff" };
      }
      if (kind === "heal" && ratio < ctx.opts.potionThreshold) {
        return { action: { type: "useItem", slot: "weapon" }, reason: "staff" };
      }
    }
  }

  return null;
}

/**
 * chooseFieldItem(state, ctx) — Phase 42 (BAL-01 second half) + 260918-w4n
 * (use-activated-only): the bot's out-of-combat field item policy:
 *   (1) dark with no live light source (`lit` OR `glow`): a bag torch first
 *       (`kind === "tool"`, activation kind "lit"); else a ready worn Amulet
 *       of Light (kind "glow");
 *   (2) hurt below `potionThreshold`: a ready worn Cloak of Regeneration
 *       (kind "knit") — a free heal tried BEFORE a potion or camp (the
 *       caller places this call above both).
 * Rope/ladder stay on the existing `pendingHazard` answer (a decision the
 * engine already parked, not a timing tactic). All reads go through
 * `activationFor(it).kind` — never `it.use`. Pure, no rng.
 */
export function chooseFieldItem(state, ctx) {
  const c = state.c;
  if (inDark(state) && !itemEffectActive(c, "lit") && !itemEffectActive(c, "glow")) {
    const i = toolIndex(c, "torch");
    if (i !== -1) {
      const it = c.items[i];
      if (!ctx.itemBlocked.has(itemLabel(it)) && itemReady(state, it)) return { type: "useItem", i };
    }
    // 260918-wy1: a ready glow item (Amulet of Light) is found in EITHER
    // jewelry key — readyWornOfKind is family-agnostic.
    const glow = readyWornOfKind(state, ctx, ["glow"]);
    if (glow) return { type: "useItem", slot: glow.slot };
  }
  const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
  const knit = readyWornOfKind(state, ctx, ["knit"]);
  if (ratio < ctx.opts.potionThreshold && knit) {
    return { type: "useItem", slot: knit.slot };
  }
  return null;
}

/**
 * preHazardFlight(state, dir) — 260918-w4n (use-activated-only), rewritten
 * 260918-wy1 (jewelry-merge): when the chosen movement direction `dir`
 * targets a climb/gorge tile, no `fly`-kind effect is currently live, and a
 * ready worn fly-kind item exists (a Bracelet of Flight in either jewelry
 * key, or a Cloak of Flying in the cloak key), returns `{ type: "useItem",
 * slot }` instead of the move — the NEXT decideAction call re-derives the
 * same `dir` and flies over for free. Returns `null` when none of that
 * applies (the caller then dispatches the plain `move`). Pure, no rng.
 */
function preHazardFlight(state, ctx, dir) {
  const c = state.c;
  if (itemEffectActive(c, "fly")) return null;
  const f = state.floor;
  const [dx, dy] = DIRS[dir];
  const there = f.g[f.py + dy] && f.g[f.py + dy][f.px + dx];
  if (!there || (there.feat !== "climb" && there.feat !== "gorge")) return null;
  const fly = readyWornOfKind(state, ctx, ["fly"]);
  if (fly) return { type: "useItem", slot: fly.slot };
  return null;
}

/**
 * decideAction(state, policyRng, ctx) — the shared, deterministic auto-play
 * policy (D-05/D-06/D-12/D-20, extended HARN-02). In combat, `chooseCombatItem`
 * is computed once up front; priority order:
 *   (a0) Phase 42 (BAL-01 second half): a "heal" pick from `chooseCombatItem`
 *       — a bag Healing/Xtra Healing potion drunk BEFORE the flee/parley
 *       decision below, so a hero who could simply heal doesn't run instead;
 *   (a) caster-aware flee/parley threshold (D-06): parley if available, else
 *       flee — UNLESS the character is a Samurai (canon: never flees) or a
 *       flee attempt was already refused this encounter (`ctx.fleeBlocked`),
 *       in which case fall through to fight instead of looping the refusal;
 *   (b) drink below potionThreshold (D-05);
 *   (b2)/(b3) Phase 42 (BAL-01 second half): a "buff" or "staff" pick from
 *       `chooseCombatItem` — a round-1 Speed/Strength/Enlarge potion (or a
 *       ready worn Cloak of Speed) before a hard fight, or a Magic User's
 *       ready worn staff;
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
 *   (h2) a ready ability (`chooseAbility`, Phase 42 BAL-01 second half) — a
 *       Fighter/Thief uses its own kit by the exact policy a Joiner's own
 *       kit follows (opener round 1; damage above half hp; defensive below
 *       half); a once-a-fight foe-targeted pick aims at the hardest live foe;
 *   (i) attack.
 * Out of combat: (loot) Phase 42 (BAL-01 second half): a non-empty
 * `state.pendingLoot` — `takeAllLoot` unless `ctx.findFull`, then
 * `leaveAllLoot` — checked FIRST, before even a pending Joiner (the victory
 * loot pile the bot has ignored since v1.3); (j) decline every pending
 * Joiner (D-20); (k) take/leave a pending find; (l) buy the best affordable
 * weapon/armor upgrade via `chooseStorePurchase` (Phase 39, GEAR-01), else
 * leave the store; (staff) RULES-13 (Phase 75, Plan 09): a Magic User with a
 * bagged staff and none currently wielded equips it (`equipItem`) —
 * "first staff wins," checked right after the store step, before the field-
 * item/potion/camp checks; (m) drink below potionThreshold; (n) camp below
 * campThreshold (rations permitting); (torch) Phase 42 (BAL-01 second half):
 * `chooseFieldItem` — light a carried torch while in the dark; (o) Summon out
 * of combat (HARN-02) when no ally is pending and charges exceed half of
 * maxCharges; (p) read a carried scroll when able (Claude's Discretion —
 * `useItem` is deliberately NOT used for potions: found potions are
 * unidentified, one of the ten is Death, so a blind quaff is not
 * human-like); (p2) Phase 42 (BAL-01 second half): Map the Floor — a Magic
 * User on a floor it hasn't mapped yet (`state.floor.depth !== ctx.mappedDepth`)
 * with spell charges to spare (`> maxCharges(c) * BOT_TACTICS.mapBankRatio`)
 * casts the castable `kind==="reveal"` spell; (q) head to the exit once the
 * floor's dots are cleared or the exploration budget is spent; (r) otherwise
 * explore toward the nearest unseen tile. `policyRng` is a SEPARATE rng
 * stream from the engine's own (see playRun), so harness decisions never
 * perturb engine determinism.
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
    // RULES-10 (Phase 75.1): the hero cannot act while heroOut is set — a
    // safety rule, not a strategy choice. The bot never reads a scroll in
    // combat itself (75.1-06), so it can never fumble one of these onto
    // itself, but must still handle heroOut if something else ever applies
    // it (a future readout, a hand-built fixture, a save from a real run).
    if (state.combat.heroOut) return { type: "loseTurn" };
    const c = state.c;
    const C = state.combat;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    const fleeAt = liveFoesHaveAbilities(state) ? ctx.opts.casterFleeThreshold : ctx.opts.fleeThreshold; // D-06
    const chargesLeft = c.cls === "Magic User" ? maxCharges(c) - c.spellsUsed : 0;
    const itemPick = chooseCombatItem(state, ctx); // Phase 42 (BAL-01 second half)

    // (a0) Phase 42: heal before the flee/parley decision below
    if (itemPick && itemPick.reason === "heal") return itemPick.action;

    // (a)
    if (ratio < fleeAt) {
      if (!ctx.parleyBlocked && canParley(state)) return { type: "parley" };
      // 260918-w4n: wants to parley but can't (fluency 0) and a ready worn
      // tongue-kind item (Helm of Knowledge) is available in either jewelry
      // key — use it first; the next decideAction then parleys with
      // fluency 1. 260918-wy1: readyWornOfKind is family-agnostic.
      const tongueBeforeFlee = !ctx.parleyBlocked && !canParley(state) && !itemEffectActive(c, "tongue")
        ? readyWornOfKind(state, ctx, ["tongue"])
        : null;
      if (tongueBeforeFlee) {
        return { type: "useItem", slot: tongueBeforeFlee.slot };
      }
      if (!(c.sub === "Samurai" || ctx.fleeBlocked)) return { type: "flee" };
      // Samurai never runs (canon); a flee refused this encounter is not
      // retried (Rule-1 fix) — fall through to the rest of the chain below.
    }

    // (b) D-05
    if (c.potions > 0 && ratio < ctx.opts.potionThreshold) return { type: "drinkPotion" };

    // (b2)/(b3) Phase 42: a round-1 buff before a hard fight, or a Magic
    // User's ready worn staff
    if (itemPick && (itemPick.reason === "buff" || itemPick.reason === "staff")) return itemPick.action;

    // (c) HARN-02 talk-first
    if (C.round === 1 && isTalkFirst(state) && !ctx.parleyBlocked) {
      if (canParley(state)) return { type: "parley" };
      // 260918-w4n: same tongue-item assist as branch (a) above.
      // 260918-wy1: readyWornOfKind is family-agnostic.
      if (!itemEffectActive(c, "tongue")) {
        const tongue = readyWornOfKind(state, ctx, ["tongue"]);
        if (tongue) return { type: "useItem", slot: tongue.slot };
      }
    }

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

    // (h2) Phase 42 (BAL-01 second half): a ready ability by the Joiner
    // policy, checked after the spell table and before the plain attack
    // fallback — never fires for a Magic User (chooseAbility itself gates on
    // c.cls).
    const ab = chooseAbility(state, ctx);
    if (ab) return ab.target === undefined ? { type: "useAbility", key: ab.key } : { type: "useAbility", key: ab.key, target: ab.target };

    // (i)
    return { type: "attack" };
  }
  // Phase 42 (BAL-01 second half): the victory loot pile — take it (or leave
  // it against a full bag), before even a pending Joiner. The bot has
  // ignored state.pendingLoot entirely since v1.3.
  if (Array.isArray(state.pendingLoot) && state.pendingLoot.length) {
    return ctx.findFull ? { type: "leaveAllLoot" } : { type: "takeAllLoot" };
  }
  // USER RULING D (54-CONTEXT.md, 2026-09-21): D-20 superseded — a pending
  // Joiner is accepted when the party is empty, declined when it already
  // holds a member (a moved instrument is unreadable otherwise: the bot's
  // fair-play policy accepts exactly one companion, never stacks a party).
  if (state.pendingJoiner) return { type: "resolveJoiner", accept: (state.party?.length ?? 0) === 0 };
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
  // RULES-13 (Phase 75, Plan 09): out of combat, a Magic User carrying a
  // BAGGED staff with none currently wielded equips it — "first staff wins"
  // (75-CONTEXT.md's flagged assumption, Claude's Discretion): the bot keeps
  // the FIRST staff it finds and never swaps it for a second bagged one, and
  // never swaps a wielded staff away for a mundane weapon (a staff's d8
  // already matches the best MU-legal weapon, plus its charged power) —
  // `chooseStorePurchase`'s weapon pass never fires while wielding one
  // either (`economy.js#gearUpgrades`), so this is the bot's only staff-
  // equip path.
  if (c.cls === "Magic User" && !wieldedStaff(c) && Array.isArray(c.items)) {
    const staffIdx = c.items.findIndex((it) => it && it.kind === "staff");
    if (staffIdx !== -1) return { type: "equipItem", i: staffIdx };
  }
  // Phase 42 (BAL-01 second half) + 260918-w4n: light a carried torch (or a
  // ready worn Amulet of Light) while in the dark, and try a free ready worn
  // Cloak of Regeneration BEFORE a potion or a camp — moved ahead of the
  // drinkPotion/camp checks below so the free heal is tried first.
  const field = chooseFieldItem(state, ctx);
  if (field) return field;
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

  // Phase 42 (BAL-01 second half): Map the Floor, once per floor, when
  // charges are plentiful — a Magic User banks the rest for combat
  // otherwise. `ctx.mappedDepth` is set by `observe` on the spell's own
  // `floorMapped` event, so a second decideAction on the same floor after
  // the cast never re-casts, and a floor change re-arms it.
  if (c.cls === "Magic User" && state.floor.depth !== ctx.mappedDepth) {
    const left = maxCharges(c) - c.spellsUsed;
    if (left > maxCharges(c) * BOT_TACTICS.mapBankRatio) {
      const i = SPELLS.findIndex((sp) => sp.kind === "reveal" && canCast(state, sp));
      if (i !== -1) return { type: "castSpell", idx: i };
    }
  }

  if (dotsRemaining(state.floor) === 0 || ctx.floorActions >= ctx.opts.exploreBudget) {
    const dir = dirTowardExit(state) || nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
    // 260918-w4n: a ready worn flight item is used BEFORE stepping onto a
    // climb/gorge tile instead of rolling it — the next decideAction
    // re-derives the same dir and flies over for free.
    return preHazardFlight(state, ctx, dir) ?? { type: "move", dir };
  }
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return preHazardFlight(state, ctx, dir) ?? { type: "move", dir };
}

/**
 * makeTallies() — a fresh D-07 ability-tally accumulator. `usage` (Phase 42,
 * BAL-02) is the per-run pick-rate source `tallyUsage` fills in place:
 * `{ abilities: {}, spells: {}, items: {} }`, each a label -> use-count map.
 */
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
    usage: { abilities: {}, spells: {}, items: {} },
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
 * tallyUsage(tallies, action, events, before, after) — Phase 42 (BAL-02): the
 * per-run pick-rate tally (`tallies.usage`) BAL-02's "pick-rates for every
 * new spell/ability" number is rendered from — see
 * tools/lib/class-matrix.mjs#formatUsageMarkdown. In place, increments:
 *   - `usage.abilities[key]` on an `abilityUsed { key }` event;
 *   - `usage.items[itemLabel(item)]` on an `itemUsed { item }` event (a
 *     potion -> `potion:<eff2>`, a torch/tool -> `tool:<tool>`, a
 *     staff/cloak/jewel -> its own `.n`);
 *   - `usage.items["tool:" + tool]` on a `toolUsed { tool }` event (a
 *     rope/ladder hazard-tool spend, engine/movement.js);
 *   - `usage.items.scroll` on a `scrollCast { spell }` event — a scroll is an
 *     ITEM use, never a spell use (readScroll saves/restores `c.spellsUsed`
 *     around its own free `castSpell` call, so the spellsUsed-delta check
 *     below never fires for it);
 *   - `usage.spells[SPELLS[action.idx].n]` when `action.type === "castSpell"`
 *     AND `after.c.spellsUsed === before.c.spellsUsed + 1` — the ONE signal
 *     that a cast actually happened (there is no standalone "spell cast"
 *     event; a refused cast, e.g. `noChargesLeft`/`spellResisted`, never
 *     bumps `spellsUsed` and is correctly NOT tallied).
 * Pure bookkeeping, no rng, no mutation beyond `tallies` itself.
 */
export function tallyUsage(tallies, action, events, before, after) {
  const u = tallies.usage;
  for (const e of events) {
    if (e.type === "abilityUsed") {
      u.abilities[e.key] = (u.abilities[e.key] || 0) + 1;
    } else if (e.type === "itemUsed") {
      const label = itemLabel(e.item);
      u.items[label] = (u.items[label] || 0) + 1;
    } else if (e.type === "toolUsed") {
      const label = `tool:${e.tool}`;
      u.items[label] = (u.items[label] || 0) + 1;
    } else if (e.type === "scrollCast") {
      u.items.scroll = (u.items.scroll || 0) + 1;
    }
  }
  if (action.type === "castSpell" && after.c.spellsUsed === before.c.spellsUsed + 1) {
    const sp = SPELLS[action.idx];
    if (sp) u.spells[sp.n] = (u.spells[sp.n] || 0) + 1;
  }
  return tallies;
}

/**
 * observe(ctx, events, stateAfter) — per-step bookkeeping the policy itself
 * reads next turn: the per-floor action counter resets on any `floorChanged`
 * event (else increments once), the full-bag flag tracks `bagFull` /
 * `findTaken` / `findLeft` so the bot never loops offering/declining a find
 * against a full bag, and `parleyBlocked`/`fleeBlocked`/`strikeBlocked` track
 * a `parleyRefused`/`fleeRefused`/`strikeRefused` event (see decideAction's
 * Rule-1 bugfix comment — both refusals return WITHOUT a foe turn, so a bot
 * that repeats the refused action loops until the action cap, the exact
 * shape of the v1.1 wilmsryVsMagical parley loop) — set the instant a
 * refusal lands, cleared the instant a fresh encounter starts. Phase 42 (BAL-01
 * second half): `abilityRefused { key }` adds `key` to `ctx.abilityBlocked`;
 * `useRefused { item }` adds `itemLabel(item)` to `ctx.itemBlocked` (same
 * Rule-1 shape — a refused ability/item returns with NO state change);
 * `lootTaken`/`lootLeft` clear `findFull` the same way `findTaken`/
 * `findLeft` do; `abilityBlocked` clears on `encounterStarted`, `itemBlocked`
 * on EITHER `encounterStarted` OR `floorChanged` (a torch/staff/cloak
 * refusal doesn't survive a floor change either). `stateAfter` is the
 * OPTIONAL post-action state (defaults to `null` so every pre-existing
 * two-argument call site — including every test in this repo — keeps
 * working unchanged); it is read ONLY on a `floorMapped` event, guarded on
 * its own presence, to set `ctx.mappedDepth = stateAfter.floor.depth`
 * (Phase 42, BAL-01 second half — Map the Floor's once-per-floor gate).
 * `playRun` passes the real post-action state; a caller with no state to
 * offer simply omits the third argument and Map the Floor's own
 * decideAction branch never re-fires from a stale `mappedDepth`.
 */
export function observe(ctx, events, stateAfter = null) {
  let floorChangedThisStep = false;
  for (const e of events) {
    if (e.type === "floorChanged") floorChangedThisStep = true;
    else if (e.type === "bagFull") ctx.findFull = true;
    else if (e.type === "findTaken" || e.type === "findLeft") ctx.findFull = false;
    else if (e.type === "lootTaken" || e.type === "lootLeft") ctx.findFull = false; // Phase 42
    else if (e.type === "parleyRefused") ctx.parleyBlocked = true;
    else if (e.type === "fleeRefused") ctx.fleeBlocked = true;
    else if (e.type === "strikeRefused") ctx.strikeBlocked = true;
    else if (e.type === "abilityRefused") ctx.abilityBlocked.add(e.key);
    else if (e.type === "useRefused") ctx.itemBlocked.add(itemLabel(e.item)); // Phase 42
    else if (e.type === "floorMapped") {
      if (stateAfter) ctx.mappedDepth = stateAfter.floor.depth; // Phase 42
    } else if (e.type === "encounterStarted") {
      ctx.parleyBlocked = false;
      ctx.fleeBlocked = false;
      ctx.strikeBlocked = false;
      ctx.abilityBlocked.clear();
      ctx.itemBlocked.clear();
    }
  }
  if (floorChangedThisStep) {
    ctx.floorActions = 0;
    ctx.itemBlocked.clear(); // Phase 42: a torch/staff/cloak refusal doesn't survive a floor change either
  } else ctx.floorActions++;
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
 * makeIdentityTallies() — USER RULING D (54-CONTEXT.md, 2026-09-21): a fresh
 * per-run CLASS IDENTITY accumulator, consumed by band-readout.mjs's
 * classIdentityReadout (pooled by class pool ONLY — never race/sub). All
 * fields are additive counts/sums over the whole run; see tallyIdentity for
 * what feeds each one.
 */
export function makeIdentityTallies() {
  return {
    fights: 0,
    rounds: 0,
    dmgTaken: 0,
    foeSwings: 0,
    foeMisses: 0,
    castsDefensive: 0,
    castsOffensive: 0,
    potionsUsed: 0,
    backstabs: 0,
    flees: 0,
  };
}

// USER RULING D: the five dispatch types that count as one "hero turn" for
// the identity readout's roundsPerFight — the pending {type:"fight"} press
// itself is not a turn.
const IDENTITY_ROUND_ACTIONS = new Set(["attack", "castSpell", "useAbility", "flee", "parley"]);

/**
 * tallyIdentity(identity, ctx, action, dispatched, inCombat, events, before,
 * after) — USER RULING D: increments the identity accumulator (in place)
 * from one playRun step.
 *   `rounds`   — one hero-turn dispatch (IDENTITY_ROUND_ACTIONS) while
 *                `state.combat` was live BEFORE the dispatch.
 *   `fights`   — one per `encounterStarted` event (mirrors tallies.encounters,
 *                its own copy so band-readout never has to cross-reference).
 *   `dmgTaken`/`foeSwings` — every HERO-targeted `struckByFoe` (always the
 *                hero) or `foeBolted` with no `.member` field (a foe-ability
 *                bolt at the hero, not a party member — same discriminator
 *                tallyEvents' own foeBolted branch uses).
 *   `foeMisses`/`foeSwings` — a HERO-targeted `foeMissed` (no `.member`
 *                field — combat.js's member-branch always sets one).
 *   `castsDefensive`/`castsOffensive` — a successful cast
 *                (`after.c.spellsUsed === before.c.spellsUsed + 1`, the same
 *                success check tallyUsage uses) keyed on `ctx.lastSpellMode`
 *                at that instant — chooseSpell sets it fresh every call, so
 *                a step-h cast is always tagged with the mode that picked it.
 *   `potionsUsed` — a successful `potionDrunk` event (the drinkPotion action)
 *                OR an `itemUsed` event whose item is a heal/full potion
 *                (chooseCombatItem's "heal" reason, a worn/bag potion spent
 *                via useItem).
 *   `backstabs`/`flees` — the engine's own `backstab`/`fled` events. The bot
 *                does nothing special to earn either — this only observes
 *                what the engine already rolled (a Thief's opener crit, a
 *                successful flee roll).
 * Pure bookkeeping beyond the `identity` mutation itself.
 */
export function tallyIdentity(identity, ctx, action, dispatched, inCombat, events, before, after) {
  if (inCombat && IDENTITY_ROUND_ACTIONS.has(dispatched.type)) identity.rounds++;
  for (const e of events) {
    if (e.type === "encounterStarted") identity.fights++;
    else if (e.type === "struckByFoe") {
      identity.dmgTaken += e.dmg || 0;
      identity.foeSwings++;
    } else if (e.type === "foeBolted" && e.member === undefined) {
      identity.dmgTaken += e.dmg || 0;
      identity.foeSwings++;
    } else if (e.type === "foeMissed" && e.member === undefined) {
      identity.foeMisses++;
      identity.foeSwings++;
    } else if (e.type === "backstab") identity.backstabs++;
    else if (e.type === "fled") identity.flees++;
    else if (e.type === "potionDrunk") identity.potionsUsed++;
    else if (e.type === "itemUsed" && e.item && e.item.kind === "potion" && (e.item.eff2 === "heal" || e.item.eff2 === "full")) {
      identity.potionsUsed++;
    }
  }
  if (action.type === "castSpell" && after.c.spellsUsed === before.c.spellsUsed + 1) {
    if (ctx.lastSpellMode === "defensive") identity.castsDefensive++;
    else if (ctx.lastSpellMode === "offensive") identity.castsOffensive++;
  }
}

/**
 * snapshotFloor(s, afraidTriggers, diedAfraid) — USER RULING D: one row of
 * playRun's own `floorSnapshots` — the pace instrument band-readout.mjs's
 * paceReadout aggregates per floor. `ar`/`weaponCost` are read straight off
 * the sheet (`c.ar`, `WEAPONS[c.weapon].cost` — the weapon-TIER proxy, not
 * its raw dice), never re-derived.
 */
function snapshotFloor(s, afraidTriggers, diedAfraid) {
  const c = s.c;
  return {
    depth: s.floor.depth,
    level: c.level,
    gold: c.gold,
    ar: c.ar || 0,
    weaponCost: WEAPONS[c.weapon]?.cost ?? 0,
    maxWP: c.maxWP,
    potions: c.potions,
    afraidTriggers,
    diedAfraid,
  };
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
 *   `stuck` — true iff the run hit `maxActions` without dying (its
 *     own outcome bucket, excluded from every depth-stat readout below);
 *   `outcome` — one of "dead" | "stuck" | "unknown" (`cause` is
 *     UNCHANGED — stuck runs keep `cause: "maxActionsHit"` for any older
 *     consumer reading that field);
 *   `floorsGained` — `state.floor.depth - startDepth` (a deep-start run's own
 *     "how far did it get FROM there" reading, HARN-04);
 *   `encountersSurvived` — `tallies.encounters` minus one iff the run's final
 *     death happened while `state.combat` was non-null at the top of that
 *     step (computed from the PRE-action state each step, since `die()`
 *     nulls `state.combat` before this loop can inspect it after the fact).
 *
 * USER RULING D (54-CONTEXT.md, 2026-09-21): the run record gains four more
 * fields, harness-only (never written back onto `state`):
 *   `cls`/`sub`/`race` — `state.c.cls`/`.sub`/`.race` at the FINAL state, so
 *     band-readout's classIdentityReadout can pool by class without
 *     re-reading the state object.
 *   `floorSnapshots` — one `snapshotFloor` row per floor the run reached,
 *     pushed the instant `state.floor.depth` changes (captured off the
 *     PRE-change `before` state, so a floor's row reflects the level/gold/
 *     gear the hero LEFT that floor with), plus a final row for the death/
 *     stuck floor when the loop ends.
 *   `identity` — the `makeIdentityTallies`/`tallyIdentity` accumulator
 *     (fights/rounds/dmgTaken/foeSwings/foeMisses/castsDefensive/
 *     castsOffensive/potionsUsed/backstabs/flees), consumed by
 *     classIdentityReadout.
 *
 * Phase 42 (BAL-01 second half): a SECOND harness-only write-path bypass
 * (after `forceParty`) — when `decideAction` picks a once-a-fight
 * foe-targeted ability (`{ type: "useAbility", key, target }`), this loop
 * assigns the combat target field from the action's own `target` BEFORE
 * dispatching, then dispatches the bare `{ type: "useAbility", key }` (no
 * `target` field — `useAbility`/`validateAction` only require `key`). This
 * mirrors `mazeworld.html`'s own foe-card tap handler (`S.combat.target = i`)
 * — a presentation-layer target selection, never an rng-bearing mutation.
 * `decideAction` itself never mutates `state` — this write happens here, in
 * the harness loop, exactly once per dispatch.
 */
export function playRun(seed, opts, onStep) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  let state = newRun(seed, [], { startDepth: opts.startDepth, force: opts.force, ...RUN_FLAGS });
  const startDepth = state.floor.depth; // the sanitized value newRun actually used
  if (opts.party) forceParty(state);
  const memberAtStart = opts.party ? state.party.length : 0;
  const ctx = makeBotContext(opts);
  const tallies = makeTallies();
  const identity = makeIdentityTallies(); // USER RULING D
  const floorSnapshots = []; // USER RULING D
  let afraidTriggersThisFloor = 0;
  let wasAfraidBeforeStep = false;
  let actions = 0;
  let diedInCombat = false;
  while (!state.dead && actions < ctx.opts.maxActions) {
    const action = decideAction(state, policyRng, ctx);
    const inCombat = !!state.combat;
    const before = state; // Phase 42 (BAL-02): pre-action state — applyAction returns a NEW object, so this reference stays valid after the reassignment below
    wasAfraidBeforeStep = !!(before.combat && before.combat.afraid > 0);
    let dispatched = action;
    if (action.type === "useAbility" && Number.isInteger(action.target) && state.combat) {
      state.combat.target = action.target;
      dispatched = { type: "useAbility", key: action.key };
    }
    let events;
    ({ state, events } = applyAction(state, dispatched));
    if (state.dead && inCombat) diedInCombat = true;
    tallyEvents(tallies, events, state);
    tallyUsage(tallies, action, events, before, state); // Phase 42 (BAL-02)
    tallyIdentity(identity, ctx, action, dispatched, inCombat, events, before, state); // USER RULING D
    for (const e of events) if (e.type === "phobiaAfraid") afraidTriggersThisFloor++;
    observe(ctx, events, state); // Phase 42 (BAL-01 second half): stateAfter for floorMapped
    if (onStep) onStep(events, state);
    actions++;
    // USER RULING D: one floorSnapshot row per floor LEFT, captured off the
    // PRE-change `before` state — its level/gold/gear is what the hero left
    // that floor with.
    if (state.floor.depth !== before.floor.depth) {
      floorSnapshots.push(snapshotFloor(before, afraidTriggersThisFloor, false));
      afraidTriggersThisFloor = 0;
    }
  }
  const stuck = !state.dead && actions >= ctx.opts.maxActions;
  const outcome = state.dead ? "dead" : stuck ? "stuck" : "unknown";
  // USER RULING D: a final floorSnapshot row for the death/stuck floor.
  floorSnapshots.push(snapshotFloor(state, afraidTriggersThisFloor, state.dead && wasAfraidBeforeStep));
  return {
    seed,
    state,
    actions,
    tallies,
    deathDepth: state.floor.depth,
    dead: state.dead,
    stuck,
    outcome,
    startDepth,
    floorsGained: state.floor.depth - startDepth,
    encountersSurvived: tallies.encounters - (diedInCombat ? 1 : 0),
    cause: state.deathNote || (actions >= ctx.opts.maxActions ? "maxActionsHit" : "unknown"),
    actionsPerFloor: actions / Math.max(1, state.floor.depth),
    memberAtStart,
    memberAtEnd: state.party.length,
    // USER RULING D (54-CONTEXT.md, 2026-09-21): class identity + pace inputs.
    cls: state.c.cls,
    sub: state.c.sub,
    race: state.c.race,
    floorSnapshots,
    identity,
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
