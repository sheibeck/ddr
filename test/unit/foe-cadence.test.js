// test/unit/foe-cadence.test.js
//
// Phase 52 (CAD-01/CAD-02/CAD-03) — these pin rules that are UNCHANGED by
// Phase 52 (the cadence was already right once Phase 51 removed the
// per-round initiative re-roll's pre-emptive foe turn); they are the
// standing proof for ROADMAP SC1/SC2/SC3. This file adds NO new engine
// behaviour — every test below passes on the untouched engine.
//
// CAD-01 (D-01, SC1): the swing-count rule `swings = (f.frenzied ? 2 : 1) *
// ((f.sp && f.sp.atk) || 1)` (engine/combat.js#foeTurn) is pinned for the
// four shapes the todo/roadmap named: plain (1), sp.atk:2 (2), frenzied
// plain (2), frenzied sp.atk:2 (4).
//
// CAD-02 (D-02, SC2): the ability gate `continue`s after
// `resolveFoeAbility`, so an ability turn (foeCast + its effect event) NEVER
// carries an ordinary swing event, and a melee turn (no foeCast) fires at
// most `sp.atk` swings — the Stalka Beast resolver is exercised directly
// (the creature in the user's pasted "two hits + a bolt" log) to prove that
// shape cannot happen in a single `foeTurn` call.
//
// CAD-03 (D-03, SC3): attacks-per-player-action, driven through the REAL
// startCombat/fight/playerStrike (not a fixed foeTurn call), for the two
// creatures the user's log named — Bat/Rat and China Wolf — at depth 5.
//
// Shared vocabulary: a foe "attack" is any of `foeMissed`, `struckByFoe`,
// `armorSoaked`, `memberStruck` — the same four event types
// `tools/cadence-audit.mjs` (Task 2) counts. `attacksPerAction` below is the
// one helper both this file and that tool implement (independently — a
// report tool never imports a test file) so a future drift between the two
// vocabularies is caught by a human reading both, not silently diverging.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { foeTurn, startCombat, fight, playerStrike } from "../../engine/combat.js";
import { BESTIARY } from "../../content/index.js";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow, which doubles as a "no more rng draws expected" assertion.
 * Copied verbatim from test/unit/foe-abilities.test.js's mould. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/** sweepRng(d6, tv) — an UNBOUNDED variant of fakeRng for CAD-02's (c)
 * impossibility sweep only: the branch taken (bolt vs melee) legitimately
 * consumes a different number of draws, and the sweep asserts structural
 * event-type invariants, not an exact draw count, so it must never throw
 * "sequence exhausted" on the melee branch's extra dice. */
function sweepRng(d6, tv) {
  const seq = [d6];
  for (let i = 0; i < 12; i++) seq.push(tv, 4);
  let i = 0;
  return {
    d(_sides) {
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** attacksPerAction(events) — counts the vocabulary of a landed-or-missed
 * ordinary swing: `foeMissed` + `struckByFoe` + `armorSoaked` +
 * `memberStruck`. Deliberately excludes `foeCast`/`foeBolted`/`foeHealed`/
 * `foeSummoned`/`foeDebuffed`/`foeDrained` — an ability turn replaces every
 * swing, so its own events are never counted as a "swing". */
function attacksPerAction(events) {
  return events.filter(
    (e) => e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "armorSoaked" || e.type === "memberStruck",
  ).length;
}

// --- CAD-01 (SC1): swing-count pins ------------------------------------

test("CAD-01 (SC1): a plain foe swings exactly once per foe turn", () => {
  const state = fixedState();
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([20]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
  assert.equal(attacksPerAction(events), 1);
});

test("CAD-01 (SC1): an sp.atk: 2 foe swings exactly twice per foe turn", () => {
  const state = fixedState();
  const foe = fixedFoe({ sp: { atk: 2 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([20, 20]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed", "foeMissed"]);
  assert.equal(attacksPerAction(events), 2);
});

test("CAD-01 (SC1): a frenzied plain foe swings exactly twice per foe turn", () => {
  const state = fixedState();
  const foe = fixedFoe({ frenzied: true });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([20, 20]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed", "foeMissed"]);
  assert.equal(attacksPerAction(events), 2);
});

test("CAD-01 (SC1): a frenzied sp.atk: 2 foe swings exactly four times per foe turn", () => {
  const state = fixedState();
  const foe = fixedFoe({ frenzied: true, sp: { atk: 2 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([20, 20, 20, 20]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed", "foeMissed", "foeMissed", "foeMissed"]);
  assert.equal(attacksPerAction(events), 4);
});

// --- CAD-02 (SC2): the Stalka Beast resolver ----------------------------
//
// The foe's `sp`/`abilities` are copied from the LIVE BESTIARY row (found by
// `n === "Stalka Beast"`, never by index) so a future content edit to this
// row is exercised by these pins, not a stale literal.

function stalkaRow() {
  const row = BESTIARY.Beasts[4].find((f) => f.n === "Stalka Beast");
  if (!row) throw new Error("Stalka Beast row not found in BESTIARY.Beasts tier 5");
  return row;
}

function stalkaFoe(overrides = {}) {
  const row = stalkaRow();
  return fixedFoe({
    name: "Stalka Beast",
    lvl: 5,
    wp: 94,
    maxWP: 94,
    sp: { ...row.sp },
    abilities: [...row.abilities],
    ...overrides,
  });
}

test("CAD-02 (SC2): an ability turn is exactly foeCast + its effect event, zero swings, 2 draws", () => {
  const state = fixedState({ c: { wp: 999, maxWP: 999 } });
  const foe = stalkaFoe();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([4, 6]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.equal(events[0].ability, "stalkaFreeze");
  assert.equal(events[1].dmg, 6);
  assert.equal(attacksPerAction(events), 0);
});

test("CAD-02 (SC2): a melee turn is at most 2 swings, zero foeCast, 3 draws", () => {
  const state = fixedState({ c: { wp: 999, maxWP: 999 } });
  const foe = stalkaFoe();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([5, 20, 20]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed", "foeMissed"]);
  assert.equal(events.filter((e) => e.type === "foeCast").length, 0);
  assert.equal(attacksPerAction(events), 2);
});

test("CAD-02 (SC2): the impossibility sweep — two hits + a bolt in one foe turn is impossible", () => {
  for (const d6 of [1, 2, 3, 4, 5, 6]) {
    for (const tv of [1, 20]) {
      const state = fixedState({ c: { wp: 999, maxWP: 999 } });
      const foe = stalkaFoe();
      state.combat = fixedCombat([foe]);
      const events = foeTurn(state, sweepRng(d6, tv), []);
      const castCount = events.filter((e) => e.type === "foeCast").length;
      const swingCount = attacksPerAction(events);
      if (castCount > 0) {
        assert.equal(swingCount, 0, "two hits + a bolt in one foe turn is impossible");
      } else {
        assert.ok(swingCount <= 2, "two hits + a bolt in one foe turn is impossible");
      }
    }
  }
});

test("CAD-02 (SC2): a later visit with stalkaLightning ready casts it, zero swings", () => {
  const state = fixedState({ c: { wp: 999, maxWP: 999 } });
  const foe = stalkaFoe();
  foe.cd = { stalkaHeal: 1, stalkaLightning: 1, stalkaFireball: 1 };
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([4, 5]), []);
  assert.equal(events[0].type, "foeCast");
  assert.equal(events[0].ability, "stalkaLightning");
  assert.equal(attacksPerAction(events), 0);
});

// --- CAD-03 (SC3): attacks-per-player-action, real engine ---------------
//
// Driven through the real startCombat/fight/playerStrike (not a fixed
// foeTurn call) — a real chargen'd hero (via newRun(seed)) at depth 5,
// wandering=true (forces n=1, a single foe) so every segment count is per
// the ONE targeted creature. `state.floor.depth` is set DIRECTLY (never
// newRun's `startDepth` option, which levels the hero to 5 and makes tier
// 1/2 unreachable).

const CAD03_SEEDS = 40;

function seedFor(i) {
  return i * 7919 + 1;
}

test("CAD-03 (SC3): Bat/Rat floor-5 fights never exceed 2 attacks per player action", () => {
  let sampled = 0;
  for (let i = 0; i < CAD03_SEEDS; i++) {
    const seed = seedFor(i);
    const state = newRun(seed);
    state.floor.depth = 5;
    const rng = makeRng(state.rngState);
    const encEvents = [];
    startCombat(state, true, "Beasts", rng, encEvents);
    if (!state.combat || state.combat.foes[0].name !== "Bat/Rat") continue;
    sampled++;
    const seg0 = [];
    fight(state, rng, seg0);
    assert.ok(attacksPerAction(seg0) <= 2, `seed ${seed}: opener attacked more than 2 times`);
    let attacks = 0;
    while (state.combat && !state.dead && attacks < 60) {
      const seg = [];
      playerStrike(state, rng, seg);
      assert.ok(attacksPerAction(seg) <= 2, `seed ${seed}: action ${attacks} attacked more than 2 times`);
      attacks++;
    }
  }
  assert.ok(sampled >= 5, `expected at least 5 Bat/Rat fights sampled, got ${sampled}`);
});

test("CAD-03 (SC3): China Wolf floor-5 fights never exceed 2 attacks per player action", () => {
  let sampled = 0;
  for (let i = 0; i < CAD03_SEEDS; i++) {
    const seed = seedFor(i);
    const state = newRun(seed);
    state.floor.depth = 5;
    state.c.level = 2; // tier 2 needs hero level >= 2
    const rng = makeRng(state.rngState);
    const encEvents = [];
    startCombat(state, true, "Humans", rng, encEvents);
    if (!state.combat || state.combat.foes[0].name !== "China Wolf") continue;
    sampled++;
    const seg0 = [];
    fight(state, rng, seg0);
    assert.ok(attacksPerAction(seg0) <= 2, `seed ${seed}: opener attacked more than 2 times`);
    let attacks = 0;
    while (state.combat && !state.dead && attacks < 60) {
      const seg = [];
      playerStrike(state, rng, seg);
      assert.ok(attacksPerAction(seg) <= 2, `seed ${seed}: action ${attacks} attacked more than 2 times`);
      attacks++;
    }
  }
  assert.ok(sampled >= 5, `expected at least 5 China Wolf fights sampled, got ${sampled}`);
});
