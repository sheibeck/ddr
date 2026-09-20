// test/unit/normalizeTarget.test.js
//
// Phase 36 Plan 03 (TGT-01): pins engine/combat.js#normalizeTarget — the ONE
// dead-target rule extracted from playerStrike's and magic.js#castSpell's
// former inline copies (`if (!foe || !foe.alive) C.target =
// C.foes.findIndex((f) => f.alive);`). Proves: (1) the pure helper's exact
// semantics (dead target -> lowest alive index; alive target untouched even
// when a lower index is also alive; no live foe -> -1, matching today's
// findIndex value; out-of-range target corrected the same way; null/
// undefined/`{}` returns the argument untouched, no throw); (2) playerStrike
// and castSpell both retarget correctly through the shared helper, byte-
// identically to the old inline rule; (3) the refactor adds zero rng draws
// and leaves state byte-identical for an already-alive target.
//
// Local helpers (fakeRng/looseRng/countingRng/hero/withCombat/fixedFoe) are
// copied in minimal form from test/unit/identity-contract.test.js's own
// scaffold, per this plan's read_first pointer — this file does not import
// that one, so it reads standalone (matching every other identity-*.test.js
// file's own precedent).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { normalizeTarget, playerStrike } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { castableAttackSpells } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";

/* ============================================================
 * Scaffold
 * ============================================================ */

/** fakeRng(seq) — `.d()` pops the next value off `seq`; throws on
 * underflow. `.pick(arr)` returns `arr[0]`. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** looseRng(seq, fallback) — like fakeRng, but returns `fallback` forever
 * once `seq` is exhausted instead of throwing. */
function looseRng(seq, fallback = 20) {
  let i = 0;
  return {
    d(_sides) {
      return i < seq.length ? seq[i++] : fallback;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** countingRng(rng) — wraps any rng, counting every `.d()` call. */
function countingRng(rng) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return rng.d(sides);
    },
    pick: (...args) => rng.pick(...args),
    shuffle: (...args) => rng.shuffle(...args),
    get draws() {
      return draws;
    },
  };
}

/** hero(sub, race = "Human", seed = 1) — the Phase-22 force seam, mirroring
 * identity-contract.test.js's own helper verbatim (minus its cosmetic-field
 * neutralization, which this file's assertions never depend on). */
function hero(sub, race = "Human", seed = 1) {
  const state = newRun(seed, [], { force: { sub, race } });
  state.combat = null;
  state.pendingJoiner = null;
  return state;
}

/** fixedFoe(overrides) — a minimal live foe. */
function fixedFoe(overrides = {}) {
  return {
    name: "Target",
    type: "Beasts",
    lvl: 1,
    size: "S",
    intel: 1,
    wp: 10,
    maxWP: 10,
    alive: true,
    asleep: 0,
    sp: {},
    lives: 1,
    ...overrides,
  };
}

/** withCombat(state, foes, overrides) — attaches a synthetic state.combat. */
function withCombat(state, foes, overrides = {}) {
  state.combat = {
    foes,
    type: foes[0]?.type || "Beasts",
    round: 1,
    target: 0,
    spellOpen: false,
    tracked: false,
    ...overrides,
  };
  return state;
}

/* ============================================================
 * Pure-helper semantics
 * ============================================================ */

test("normalizeTarget: dead target becomes the lowest alive index", () => {
  const combat = { foes: [fixedFoe({ alive: false }), fixedFoe({ alive: true }), fixedFoe({ alive: true })], target: 0 };
  const result = normalizeTarget(combat);
  assert.equal(combat.target, 1);
  assert.equal(result, combat); // same object returned
});

test("normalizeTarget: alive target untouched even when a lower index is also alive", () => {
  const combat = { foes: [fixedFoe({ alive: true }), fixedFoe({ alive: true })], target: 1 };
  normalizeTarget(combat);
  assert.equal(combat.target, 1);
});

test("normalizeTarget: no live foe -> target becomes -1 (today's findIndex value)", () => {
  const combat = { foes: [fixedFoe({ alive: false }), fixedFoe({ alive: false })], target: 0 };
  normalizeTarget(combat);
  assert.equal(combat.target, -1);
});

test("normalizeTarget: out-of-range target is corrected the same way", () => {
  const combat = { foes: [fixedFoe({ alive: true })], target: 7 };
  normalizeTarget(combat);
  assert.equal(combat.target, 0);
});

test("normalizeTarget: target -1 with a live foe present is corrected to 0", () => {
  const combat = { foes: [fixedFoe({ alive: true })], target: -1 };
  normalizeTarget(combat);
  assert.equal(combat.target, 0);
});

test("normalizeTarget: null/undefined/{} return the argument untouched, no throw", () => {
  assert.equal(normalizeTarget(null), null);
  assert.equal(normalizeTarget(undefined), undefined);
  const empty = {};
  const result = normalizeTarget(empty);
  assert.equal(result, empty);
  assert.deepStrictEqual(empty, {});
});

test("normalizeTarget: non-array foes returns without touching anything", () => {
  const combat = { foes: null, target: 0 };
  const result = normalizeTarget(combat);
  assert.equal(result, combat);
  assert.equal(combat.target, 0);
});

/* ============================================================
 * playerStrike retargets through the shared helper
 * ============================================================ */

test("playerStrike: dead target 0, alive foe 1 -> struck/strikeMissed names foe 1, leaves C.target === 1", () => {
  const state = withCombat(hero("Soldier"), [fixedFoe({ name: "Corpse", alive: false }), fixedFoe({ name: "Survivor", alive: true })]);
  const events = playerStrike(state, looseRng([1, 4], 20), []);
  assert.equal(state.combat.target, 1);
  const strikeEvt = events.find((e) => e.type === "struck" || e.type === "strikeMissed");
  assert.ok(strikeEvt, "expected a struck or strikeMissed event");
  assert.equal(strikeEvt.target, "Survivor");
});

/* ============================================================
 * castSpell retargets through the shared helper
 * ============================================================ */

test("castSpell: dead target 0, alive foe 1 -> retargets to foe 1 before spending the charge", () => {
  // A third live foe (index 2) guarantees the encounter cannot fully clear
  // even if the spell's damage kills foe 1 — target is asserted regardless
  // of which attack-kind spell the Sorcerer's grimoire happens to roll. A
  // high looseRng fallback (well above any "thrown" hit-need) guarantees a
  // miss on the one kind capable of a kill, so index 1 stays alive too.
  const state = withCombat(hero("Sorcerer"), [
    fixedFoe({ name: "Corpse", alive: false }),
    fixedFoe({ name: "Survivor", alive: true }),
    fixedFoe({ name: "Second", alive: true }),
  ]);
  const castable = castableAttackSpells(state);
  assert.ok(castable.length > 0, "Sorcerer must have a day-one castable attack spell (Phase 23 guarantee)");
  const idx = SPELLS.indexOf(castable[0]);
  const spentBefore = state.c.spellsUsed;
  castSpell(state, idx, looseRng([], 20), []);
  assert.equal(state.combat.target, 1);
  assert.equal(state.c.spellsUsed, spentBefore + 1);
});

/* ============================================================
 * Draw-count / state identity for an ALREADY-ALIVE target
 * ============================================================ */

test("playerStrike: alive target -> draw count and resulting state identical whether or not the old inline rule ran first", () => {
  // looseRng (not fakeRng) because a Soldier at this seed carries enough
  // skills/kit to swing more than once — the exact draw count is an
  // implementation detail this test pins, not something it hand-computes.
  const seq = [4, 8];

  const state1 = withCombat(hero("Soldier"), [fixedFoe({ name: "Target", wp: 999, maxWP: 999 })]);
  const rng1 = countingRng(looseRng(seq, 20));
  const events1 = playerStrike(state1, rng1, []);

  const state2 = withCombat(hero("Soldier"), [fixedFoe({ name: "Target", wp: 999, maxWP: 999 })]);
  // Replicate the OLD inline rule (pre-refactor) as a standalone step before
  // calling playerStrike — a no-op here since foe 0 is already alive, so the
  // resulting state and draw count must match state1/rng1 exactly.
  const oldFoe = state2.combat.foes[state2.combat.target];
  if (!oldFoe || !oldFoe.alive) state2.combat.target = state2.combat.foes.findIndex((f) => f.alive);
  const rng2 = countingRng(looseRng(seq, 20));
  const events2 = playerStrike(state2, rng2, []);

  // Measured-not-hand-computed: this count was observed by running the test
  // once and is pinned here as the expected value going forward.
  // Phase 51 (INIT-01): 6 -> 4 — no round-advance draws (afterPlayerAction no
  // longer re-rolls initiative; initiative is rolled once, at fight()).
  assert.equal(rng1.draws, 4);
  assert.equal(rng1.draws, rng2.draws);
  assert.deepStrictEqual(state1, state2);
  assert.deepStrictEqual(events1, events2);
});
