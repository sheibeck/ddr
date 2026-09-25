// test/unit/harness/rollOdds.js
//
// Phase 72-02 (ROLL-01): the shared odds harness for
// test/unit/rollDirection.test.js (this plan) and
// test/unit/rollDirection-checks.test.js (72-03). Every builder here drives
// the REAL engine — no need/target/roll/dieN arithmetic is ever encoded in
// this module or its callers.
//
// TWO CONTRACTS, both load-bearing for Phase 73 (the roll-high mirror):
//
// (1) ODDS ONLY. A row's success is decided by reading EVENT TYPES and
//     OUTCOME BOOLEANS the real engine already pushes (`struck` vs
//     `strikeMissed`, `foeMissed` vs `memberStruck`/`struckByFoe`, `.critical`
//     on a landed-hit event, a foe's `.alive` flag after one call, ...) —
//     never by reading a `need`, `target`, `roll` or `dieN` field off an
//     event or piece of content, and never by calling a need/die-arithmetic
//     helper (`toHit`, `foeToHitVs`, `foeToHitBreakdown`, `fleeBreakdown`,
//     `afraidNeed`, `classNeed`, `memberToHit`, `strikeDie`, `foeDie`,
//     `weaponNeedMod`, `weaponCrit`). `faceOdds`/`jointOdds` drive the engine
//     once per face of the probed die and count only outcomes the `run`
//     closure itself derived from events/state booleans.
//
// (2) NO ROLL-CONVENTION NUMBER IS EVER WRITTEN INTO STATE OR CONTENT. Every
//     value a row needs comes from a real content row (BESTIARY/WEAPONS/
//     ARMORS/SPELLS), a real engine entry point (`newRun`, `rollCharacter`,
//     `startEffect`, `useAbility`, `castSpell`, ...), or is a plain flag/
//     count/level/stat the content itself already carries this way (e.g. a
//     foe's own `sp.toHit`, `c.senses`, `c.foesEffect`). No row ever assigns
//     a `need`, `target`, `toHit` or `ar` NUMBER meant to encode today's
//     roll-under convention.
//
// Phase 73 MUST be able to run every row in rollDirection.test.js and
// rollDirection-checks.test.js UNCHANGED after the engine mirrors to
// roll-high — that is the entire reason this harness reads outcomes instead
// of raw arithmetic.

import { newRun, addPartyMember } from "../../../engine/state.js";
import { rollCharacter } from "../../../engine/character.js";
import { BESTIARY } from "../../../content/index.js";

/**
 * probeRng({ face, isProbe, fill, pick }) — a deterministic rng surface that
 * returns `face` on every draw `isProbe(i, sides)` selects (throwing if
 * `face` exceeds that draw's own side count — a probe can never ask for a
 * face the die doesn't have), and a fill value (`fill(i, sides)`, clamped
 * into `[1, sides]`) on every other draw. Records every probed draw on
 * `.probed` (`{ i, sides }`) so `faceOdds`/`jointOdds` can prove a row
 * actually exercised the die it claims to.
 *
 * `isProbe` defaults to "the very first draw" (`(i) => i === 0`), the shape
 * every hero-strike/foe-vs-hero row in this file needs. `fill` defaults to
 * a flat `1` for every non-probed draw. `pick` defaults to `arr[0]`.
 * `shuffle` is the identity function — never reorders its argument.
 * `getState()` returns a constant (this rng never round-trips through
 * serialization). Never throws on running out of scripted draws — there is
 * nothing to run out of; every draw is computed from `i`/`sides` alone.
 */
export function probeRng({ face, isProbe = (i) => i === 0, fill = () => 1, pick } = {}) {
  let i = 0;
  const probed = [];
  return {
    d(sides) {
      const idx = i++;
      if (isProbe(idx, sides)) {
        probed.push({ i: idx, sides });
        if (face > sides) throw new Error(`probeRng: probed face ${face} exceeds die size d${sides} at draw ${idx}`);
        return face;
      }
      const raw = fill(idx, sides);
      return Math.min(sides, Math.max(1, raw));
    },
    pick: pick || ((arr) => arr[0]),
    shuffle: (a) => a,
    getState: () => 1,
    probed,
  };
}

/**
 * faceOdds(run, opts) — drives `run(rng)` once per face of the FIRST probed
 * draw's die (1..N), returning `{ wins, n }` — the count of faces for which
 * `run` reported a roller win, out of the die's own face count `n`. `run`
 * MUST clone its own base state per call (it is invoked once per face) and
 * return a plain boolean read off events/outcome fields, never a need/roll.
 *
 * VACUOUS-ROW GUARD: throws if a call probes nothing at all, or if the
 * probed draw's own side count changes between faces — the row is refused
 * rather than silently passing on a die it never actually exercised.
 */
export function faceOdds(run, opts = {}) {
  const { label } = opts;
  const tag = label ? ` [${label}]` : "";
  const priming = probeRng({ ...opts, face: 1 });
  run(priming);
  if (!priming.probed.length) throw new Error(`faceOdds${tag}: probed nothing — vacuous row`);
  const n = priming.probed[0].sides;
  let wins = 0;
  for (let face = 1; face <= n; face++) {
    const rng = probeRng({ ...opts, face });
    const win = !!run(rng);
    if (!rng.probed.length) throw new Error(`faceOdds${tag}: probed nothing on face ${face} — vacuous row`);
    const sides = rng.probed[0].sides;
    if (sides !== n) throw new Error(`faceOdds${tag}: probed die size changed (d${n} -> d${sides}) on face ${face}`);
    if (win) wins++;
  }
  return { wins, n };
}

/**
 * jointOdds(run, { isProbeA, isProbeB, fill, pick }) — enumerates every
 * (faceA, faceB) pair over TWO independently-probed draw positions (Philly's
 * "keep the lower of two dice", an initiative-style pair), returning
 * `{ wins, total }` (`total === sidesA * sidesB`). Same vacuous-row and
 * stable-die-size guards as faceOdds, applied to BOTH probed positions.
 */
export function jointOdds(run, opts = {}) {
  const { isProbeA, isProbeB, fill = () => 1, pick, label } = opts;
  const tag = label ? ` [${label}]` : "";
  function makeJointRng(faceA, faceB) {
    let i = 0;
    const probedA = [];
    const probedB = [];
    return {
      d(sides) {
        const idx = i++;
        if (isProbeA(idx, sides)) {
          probedA.push({ i: idx, sides });
          if (faceA > sides) throw new Error(`jointOdds${tag}: probed faceA ${faceA} exceeds d${sides} at draw ${idx}`);
          return faceA;
        }
        if (isProbeB(idx, sides)) {
          probedB.push({ i: idx, sides });
          if (faceB > sides) throw new Error(`jointOdds${tag}: probed faceB ${faceB} exceeds d${sides} at draw ${idx}`);
          return faceB;
        }
        const raw = fill(idx, sides);
        return Math.min(sides, Math.max(1, raw));
      },
      pick: pick || ((arr) => arr[0]),
      shuffle: (a) => a,
      getState: () => 1,
      probedA,
      probedB,
    };
  }

  const priming = makeJointRng(1, 1);
  run(priming);
  if (!priming.probedA.length || !priming.probedB.length) throw new Error(`jointOdds${tag}: did not probe both draws — vacuous row`);
  const sidesA = priming.probedA[0].sides;
  const sidesB = priming.probedB[0].sides;

  let wins = 0;
  const total = sidesA * sidesB;
  for (let a = 1; a <= sidesA; a++) {
    for (let b = 1; b <= sidesB; b++) {
      const rng = makeJointRng(a, b);
      const win = !!run(rng);
      if (!rng.probedA.length || !rng.probedB.length) throw new Error(`jointOdds${tag}: did not probe both draws on (${a},${b}) — vacuous row`);
      if (rng.probedA[0].sides !== sidesA || rng.probedB[0].sides !== sidesB)
        throw new Error(`jointOdds${tag}: probed die size changed on (${a},${b})`);
      if (win) wins++;
    }
  }
  return { wins, total };
}

/** denomOf(result) — module-private: `faceOdds` returns `{ wins, n }`,
 * `jointOdds` returns `{ wins, total }` — this reads whichever denominator
 * field a result carries so compareOdds/assertBonus/assertPenalty/assertSame
 * work uniformly over either shape. */
function denomOf(result) {
  return result.n !== undefined ? result.n : result.total;
}

/**
 * compareOdds(a, b) — the SIGN of `a.wins/denom(a) - b.wins/denom(b)`,
 * computed by cross-multiplication (`a.wins * denom(b)` vs `b.wins *
 * denom(a)`) so no float ever enters the comparison. Returns `1` (a > b),
 * `-1` (a < b) or `0` (equal odds).
 */
export function compareOdds(a, b) {
  const left = a.wins * denomOf(b);
  const right = b.wins * denomOf(a);
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/**
 * assertBonus(withMod, without, { strict, label }) — asserts the modifier
 * raised (or, when `strict` is false, never lowered) the ROLLER's odds:
 * `compareOdds(withMod, without) >= 0`, and `> 0` when `strict` is true (the
 * default). Throws with a message naming `label`.
 */
export function assertBonus(withMod, without, { strict = true, label } = {}) {
  const cmp = compareOdds(withMod, without);
  const ok = strict ? cmp > 0 : cmp >= 0;
  if (!ok) {
    throw new Error(
      `assertBonus${label ? ` [${label}]` : ""}: expected a${strict ? " strict" : ""} bonus (with ${withMod.wins}/${denomOf(withMod)} >= without ${without.wins}/${denomOf(without)}), got the opposite`,
    );
  }
}

/**
 * assertPenalty(withMod, without, { strict, label }) — the mirror of
 * assertBonus: `compareOdds(withMod, without) <= 0`, and `< 0` when `strict`
 * is true (the default).
 */
export function assertPenalty(withMod, without, { strict = true, label } = {}) {
  const cmp = compareOdds(withMod, without);
  const ok = strict ? cmp < 0 : cmp <= 0;
  if (!ok) {
    throw new Error(
      `assertPenalty${label ? ` [${label}]` : ""}: expected a${strict ? " strict" : ""} penalty (with ${withMod.wins}/${denomOf(withMod)} <= without ${without.wins}/${denomOf(without)}), got the opposite`,
    );
  }
}

/**
 * assertSame(withMod, without, { label }) — asserts the modifier changed
 * NOTHING for the roller: `compareOdds(withMod, without) === 0`. Used for
 * identity-dial probes and for a clamp that absorbs a modifier entirely
 * (e.g. an already-floored need, an untouchable foe).
 */
export function assertSame(withMod, without, { label } = {}) {
  const cmp = compareOdds(withMod, without);
  if (cmp !== 0) {
    throw new Error(
      `assertSame${label ? ` [${label}]` : ""}: expected identical odds (with ${withMod.wins}/${denomOf(withMod)} vs without ${without.wins}/${denomOf(without)}), got a difference`,
    );
  }
}

/**
 * heroState({ cls, sub, race, seed, level }) — a real chargen GameState via
 * `newRun(seed, [], { force: { cls, sub, race } })`. Lights the party's own
 * cell (tile `dark` false, `c.darkFor` 0) so every row starts in the light
 * unless it deliberately darkens the tile itself, and sets `c.level` when
 * given. No roll-convention number is ever assigned here — every field comes
 * straight out of the real chargen roll.
 */
export function heroState({ cls, sub, race, seed = 1, level } = {}) {
  const state = newRun(seed, [], { force: { cls, sub, race } });
  const cell = state.floor.g[state.floor.py] && state.floor.g[state.floor.py][state.floor.px];
  if (cell) cell.dark = false;
  state.c.darkFor = 0;
  if (level !== undefined) state.c.level = level;
  return state;
}

/**
 * foeFrom(type, tier, name, { wp } = {}) — copies a BESTIARY row the exact
 * way `engine/combat.js#startCombat` builds a live foe object: name, type,
 * `lvl` = tier, size, intel, wp/maxWP (the row's own `wp`, or an explicit
 * override — e.g. so a strike can never kill a probe outright), alive,
 * asleep 0, the row's own `sp` object, `lives` 2 when `sp.twice` else 1, and
 * `abilities` (sliced) only when the row carries one. Throws on an unknown
 * (type, tier, name) triple — a typo here must fail loudly, not silently
 * probe the wrong creature.
 */
export function foeFrom(type, tier, name, { wp } = {}) {
  const roster = BESTIARY[type] && BESTIARY[type][tier - 1];
  const picked = roster && roster.find((r) => r.n === name);
  if (!picked) throw new Error(`foeFrom: no "${name}" at BESTIARY.${type}[${tier - 1}]`);
  const w = wp !== undefined ? wp : picked.wp;
  return {
    name: picked.n,
    type,
    lvl: tier,
    size: picked.sz,
    intel: picked.i,
    wp: w,
    maxWP: w,
    alive: true,
    asleep: 0,
    sp: picked.sp || {},
    lives: picked.sp && picked.sp.twice ? 2 : 1,
    ...(picked.abilities ? { abilities: picked.abilities.slice() } : {}),
  };
}

/**
 * inCombat(state, foes, extra) — sets `state.combat` to a live, already-
 * joined encounter (`pending: false` — Fight! has already been tapped, so
 * every row can drive `playerStrike`/`foeTurn`/etc. directly with no
 * separate `fight()` call): `{ foes, type, round: 1, target: 0, spellOpen:
 * false, tracked: false, pending: false, ...extra }`. `type` defaults to the
 * first foe's own `type` field. `extra` lets a row add `allies`/`ally`/
 * `afraid`/`foeToHitPenalty`/`weakened`/`parleyInsulted` etc. — every one of
 * those is itself a plain flag/count the real engine already reads this way,
 * never a roll-convention number.
 */
export function inCombat(state, foes, extra = {}) {
  state.combat = {
    foes,
    type: (foes[0] && foes[0].type) || "Beasts",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
    pending: false,
    ...extra,
  };
  return state;
}

/**
 * withMember(state, { cls, sub, race, seed }) — adds a real
 * `rollCharacter()` sheet to `state.party` via `addPartyMember` and returns
 * its index (`0` — PARTY_CAP is 1). The sheet's own `level` is normalized to
 * `1` when chargen left it unset, matching `startCombat`'s own
 * `m.level ?? m.lvl ?? 1` read. A caller that needs the member IN a live
 * encounter builds `state.combat.allies` itself (a plain array of `{
 * partyIdx, name, lvl, sub, wp, maxWP }` — the exact shape
 * `engine/combat.js#startCombat` syncs from `state.party`), and starts any
 * of the member's own ability timers (Sidestep/Smoke/Taunt/Riposte) via
 * `engine/effects.js#startEffect(sheet, "ability:<key>", { rounds })` on
 * the RETURNED sheet (`state.party[idx]`), never on the hero's own `c`.
 */
export function withMember(state, { cls, sub, race, seed = 2 } = {}) {
  const rng = { d: () => 1, pick: (arr) => arr[0], shuffle: (a) => a, getState: () => 1 };
  const member = rollCharacter(rng, [], { cls, sub, race });
  if (member.level === undefined) member.level = 1;
  addPartyMember(state, member);
  return state.party.length - 1;
}
