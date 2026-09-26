// test/unit/foe-fumble-mechanics.test.js
//
// RULES-10 (Phase 75.1, plan 03, Task 1) — the foe ward (Shield pool) and
// armed Bubble (catch/pop/rebound) in the one foe-damage seam and foeTurn's
// tail. Every mechanic is engine-only today — no resolver sets these fields
// yet (that lands in 75.1-05) — so every test here builds the field directly
// on a fixture foe/state, mirroring test/unit/bubble-mirror.test.js's own
// direct-construction pattern for the hero's mirror equivalent. Task 2 (foe
// Mirror Self / Strength / Regeneration) appends its own tests below this
// file's Task 1 section in a later commit.
//
// Local fixtures mirror test/unit/bubble-mirror.test.js verbatim, per this
// suite's established per-file convention (no cross-import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { damageFoe } from "../../engine/foeDamage.js";
import { foeTurn } from "../../engine/combat.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. Throws if the sequence underflows — this doubles
 * as a "no more rng draws expected" assertion. */
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
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ══════════════════════════════════════════════════════════════════════════
// Task 1: the foe ward (Shield) and armed Bubble in the damage seam, the
// rebound, and the ward tick.
// ══════════════════════════════════════════════════════════════════════════

// --- Shield pool -------------------------------------------------------

test("damageFoe: a foe ward pool absorbs a blow smaller than the pool, narrated with amount/left, no wp loss", () => {
  const foe = fixedFoe({ wp: 10, maxWP: 10, ward: { name: "Shield", pool: 50, rounds: 5 } });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 20, { kind: "melee" }, fakeRng([]), events);
  assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 });
  assert.equal(foe.ward.pool, 30);
  assert.equal(foe.wp, 10, "no wp lost — the pool ate the whole blow");
  assert.deepEqual(events, [{ type: "foeWardSoaked", name: "Target", amount: 20, left: 30 }]);
});

test("damageFoe: ward pool boundary — an exact blow shatters it clean, one over lets the remainder through, one under leaves 1", () => {
  const cases = [
    { dmg: 30, applied: 0, poolAfter: null },
    { dmg: 31, applied: 1, poolAfter: null },
    { dmg: 29, applied: 0, poolAfter: 1 },
  ];
  for (const { dmg, applied, poolAfter } of cases) {
    const foe = fixedFoe({ wp: 10, maxWP: 10, ward: { name: "Shield", pool: 30, rounds: 5 } });
    const state = fixedState();
    const events = [];
    const result = damageFoe(state, foe, dmg, { kind: "melee" }, fakeRng([]), events);
    assert.equal(result.applied, applied, `dmg ${dmg}: applied`);
    assert.equal(foe.wp, 10 - applied, `dmg ${dmg}: wp`);
    if (poolAfter === null) {
      assert.equal(foe.ward, undefined, `dmg ${dmg}: ward removed`);
      assert.ok(events.some((e) => e.type === "foeWardBroken" && e.name === "Target"), `dmg ${dmg}: foeWardBroken`);
    } else {
      assert.equal(foe.ward.pool, poolAfter, `dmg ${dmg}: pool remaining`);
      assert.equal(events.some((e) => e.type === "foeWardBroken"), false, `dmg ${dmg}: ward survives`);
    }
  }
});

test("damageFoe: order — the multiplier and halfDmg apply BEFORE the ward pool, and the natural-armor soak only ever sees the remainder", () => {
  const foe = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 999, maxWP: 999, sp: { halfDmg: true, ar: 12 }, ward: { name: "Shield", pool: 3, rounds: 5 } });
  const state = fixedState();
  const events = [];
  // raw melee 10 from a Fighter vs Trachea -> CANON-04 x2 = 20; halfDmg
  // ceils 20/2 = 10; the pool (3) absorbs 3, leaving 7 to face the
  // natural-armor soak (ar 12 -> atLeastFor(12,20)=9; raw draw 5 mirrors to
  // face 16, well past 9 -> soaked).
  const result = damageFoe(state, foe, 10, { kind: "melee", casterClass: "Fighter" }, fakeRng([5]), events);
  assert.deepEqual(events[0], { type: "foeWardSoaked", name: "Trachea", amount: 3, left: 0 });
  assert.ok(events.some((e) => e.type === "foeWardBroken"));
  assert.deepEqual(events[2], { type: "foeArmorSoaked", name: "Trachea", amount: 7, roll: 16, atLeast: 9, dieN: 20 });
  assert.equal(result.applied, 0);
  assert.equal(result.soaked, true);
  assert.equal(foe.wp, 999, "the armor soak absorbed the remainder — no wp lost");
});

test("foeTurn: a foe ward with rounds 2 lasts two foeTurns, fading with foeWardFaded on the second tail tick", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Shield", pool: 10, rounds: 2 } });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  // a huge raw draw mirrors to a deeply negative roll-high face — guaranteed miss.
  let events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward.rounds, 1);
  assert.equal(events.some((e) => e.type === "foeWardFaded"), false);
  events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward, undefined);
  assert.ok(events.some((e) => e.type === "foeWardFaded" && e.name === "Target"));
});

// --- Armed Bubble: catch, pop, rebound ----------------------------------

test("damageFoe: an armed foe Bubble catches the first blow in full, pops into a popPool pool that then soaks the NEXT blow the same round", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
  const state = fixedState();
  const events1 = [];
  const caught = damageFoe(state, foe, 18, { kind: "melee" }, fakeRng([]), events1);
  assert.deepEqual(caught, { applied: 0, soaked: true, mult: 1 });
  assert.deepEqual(events1, [{ type: "foeBubbleCaught", name: "Target", amount: 18 }]);
  assert.deepEqual(foe.ward, { name: "Bubble", pool: 25, rounds: 1 });
  assert.equal(foe.rebound, 18);
  assert.equal(foe.wp, 999, "the catch never touched hp");

  const events2 = [];
  const soaked = damageFoe(state, foe, 10, { kind: "melee" }, fakeRng([]), events2);
  assert.deepEqual(soaked, { applied: 0, soaked: true, mult: 1 });
  assert.deepEqual(events2, [{ type: "foeWardSoaked", name: "Target", amount: 10, left: 15 }]);
  // Adjacency: the caught blow and the popped pool never apply to the same
  // blow — each of these two blows produced exactly one narrated outcome.
  assert.equal(foe.wp, 999, "neither blow ever reached the foe's own hp");

  // the popped pool always fades at THIS round's own foeTurn tail.
  delete foe.rebound;
  state.combat = fixedCombat([foe]);
  const events3 = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward, undefined);
  assert.ok(events3.some((e) => e.type === "foeWardFaded"));
});

test("damageFoe: an armed foe Bubble absorbs an ally- or foe-sourced catch but stores no rebound", () => {
  for (const kind of ["ally", "foe"]) {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
    const state = fixedState();
    const events = [];
    const result = damageFoe(state, foe, 12, { kind }, fakeRng([]), events);
    assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 }, kind);
    assert.equal(foe.rebound, undefined, `${kind}: no rebound stored`);
    assert.deepEqual(foe.ward, { name: "Bubble", pool: 25, rounds: 1 }, kind);
  }
});

test("damageFoe: an armed foe Bubble catches a spell and an item blow too, both stored as a rebound", () => {
  for (const kind of ["spell", "item", "reflect"]) {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
    const state = fixedState();
    const result = damageFoe(state, foe, 9, { kind }, fakeRng([]), []);
    assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 }, kind);
    assert.equal(foe.rebound, 9, `${kind}: rebound stored`);
  }
});

test("foeTurn: a hero-side blow caught by a foe Bubble is thrown back at the TOP of the foe's next turn, ignoring armor", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 20 });
  const state = fixedState({ c: { armor: "Plate", ar: 10, armorWP: 50, armorMax: 50, armorMin: 0 } });
  state.combat = fixedCombat([foe]);
  // no draw for the rebound itself (dmg is passed directly); the ONE value
  // below is spent on the foe's OWN ordinary swing later this same visit.
  const events = foeTurn(state, fakeRng([999]), []);
  const rebound = events.find((e) => e.type === "foeBubbleRebound");
  assert.deepEqual(rebound, { type: "foeBubbleRebound", name: "Target", amount: 20 });
  assert.equal(foe.rebound, undefined, "the rebound is deleted once thrown");
  assert.equal(state.c.wp, 55 - 20, "armor never rolled for it — ignoresArmor true");
  assert.ok(events.some((e) => e.type === "foeBolted" && e.ability === "Bubble" && e.ignoresArmor === true && e.dmg === 20));
});

test("foeTurn: a lethal rebound kills the hero and foeTurn returns at once", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 60 });
  const state = fixedState({ c: { wp: 40, maxWP: 40 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "foeBubbleRebound"));
  assert.equal(state.dead, true);
  assert.equal(state.combat, null);
});

test("foeTurn: a foe that died before its next turn drops its stored rebound silently — no event, no damage, no draw", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 30, alive: false });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(foe.rebound, undefined);
  assert.equal(events.some((e) => e.type === "foeBubbleRebound"), false);
  assert.equal(state.c.wp, 55);
});

test("foeTurn: an ARMED foe Bubble mirror is never ticked down by the tail — it stays armed until a blow lands", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([999]), []);
  assert.deepEqual(foe.ward, { name: "Bubble", mirror: true, popPool: 25 });
  assert.equal(events.some((e) => e.type === "foeWardFaded"), false);
});

// --- Inertness (Task 1) --------------------------------------------------

test("inertness: a plain foe (no ward/rebound) takes damage through damageFoe exactly as before — zero new draws, no new events", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999 });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([]), events);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
  assert.equal(foe.wp, 992);
  assert.deepEqual(events, []);
});
