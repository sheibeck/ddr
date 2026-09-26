// test/unit/hero-out.test.js
//
// RULES-10 (Phase 75.1, plan 04, Task 2) — the hero-cannot-act state
// (`C.heroOut`), the `loseTurn` action, hero Blind (`C.heroBlind`) and hero
// Shrink (`C.heroShrunk`). Every mechanic is engine-only today — no resolver
// sets these fields yet (that lands in 75.1-05) — so every test here builds
// the field directly on a fixture combat, mirroring
// test/unit/foe-fumble-mechanics.test.js's own direct-construction pattern.
//
// Local fixtures mirror test/unit/foe-fumble-mechanics.test.js verbatim, per
// this suite's established per-file convention (no cross-import of test
// helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { loseTurn, HERO_OUT_MAX, applyFoeDamageToPlayer, foeTurn, playerStrike, endCombat } from "../../engine/combat.js";
import { toHit, foeSwingVsHero, conditionsOf } from "../../engine/derived.js";
import { heroHitOdds } from "../../src/browser/rollOdds.js";
import { applyAction } from "../../engine/engine.js";

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
    version: 1, seed: 1, rngState: 1, acts: 0,
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
// loseTurn — the turn-loss countdown, its d4 bound, and the notOut refusal
// ══════════════════════════════════════════════════════════════════════════

test("loseTurn: counts down C.heroOut.left by one per call, narrating heroLostTurn then heroCameTo, and never wakes on a hit", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } });

  const e1 = loseTurn(state, fakeRng([]), []);
  assert.deepEqual(e1.find((e) => e.type === "heroLostTurn"), { type: "heroLostTurn", kind: "asleep", spell: "Doze", left: 1 });
  assert.equal(state.combat.heroOut.left, 1);
  assert.equal(e1.some((e) => e.type === "heroCameTo"), false);

  const e2 = loseTurn(state, fakeRng([]), []);
  assert.deepEqual(e2.find((e) => e.type === "heroLostTurn"), { type: "heroLostTurn", kind: "asleep", spell: "Doze", left: 0 });
  assert.deepEqual(e2.find((e) => e.type === "heroCameTo"), { type: "heroCameTo", kind: "asleep" });
  assert.equal(state.combat.heroOut, undefined);
});

test("loseTurn: a tampered left (9) is clamped to HERO_OUT_MAX (4) before it counts down", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "stupefied", left: 9, spell: "Stupidity" } });
  const events = loseTurn(state, fakeRng([]), []);
  assert.equal(state.combat.heroOut.left, HERO_OUT_MAX - 1);
  assert.deepEqual(events.find((e) => e.type === "heroLostTurn"), { type: "heroLostTurn", kind: "stupefied", spell: "Stupidity", left: HERO_OUT_MAX - 1 });
});

test("loseTurn: with no C.heroOut (in or out of combat), refuses with actionRefused/notOut, drawing and changing nothing", () => {
  const inCombat = fixedState();
  inCombat.combat = fixedCombat([fixedFoe()]);
  const before = JSON.stringify(inCombat);
  const events = loseTurn(inCombat, fakeRng([]), []);
  assert.deepEqual(events, [{ type: "actionRefused", action: "loseTurn", reason: "notOut" }]);
  assert.equal(JSON.stringify(inCombat), before, "nothing changed");

  const outOfCombat = fixedState();
  const events2 = loseTurn(outOfCombat, fakeRng([]), []);
  assert.deepEqual(events2, [{ type: "actionRefused", action: "loseTurn", reason: "notOut" }]);
});

test("loseTurn: with a party member, a summoned ally and two live foes, one call produces events from the summon, the member and the foes, and advances C.round by one", () => {
  const foes = [fixedFoe({ name: "Foe1", stupid: true }), fixedFoe({ name: "Foe2", stupid: true })];
  const state = fixedState();
  state.combat = fixedCombat(foes, {
    heroOut: { kind: "asleep", left: 2, spell: "Doze" },
    ally: { name: "Summon", lvl: 1, rounds: 5 },
    allies: [{ partyIdx: 0, name: "Ada", lvl: 1, wp: 20, maxWP: 20 }],
  });
  const roundBefore = state.combat.round;
  const events = loseTurn(state, fakeRng([999, 999]), []);
  assert.ok(events.some((e) => e.type === "heroLostTurn"));
  assert.ok(events.some((e) => e.type === "allyMissed" && e.name === "Summon"), "the summon acted");
  assert.ok(events.some((e) => e.type === "allyMissed" && e.name === "Ada"), "the party member acted");
  assert.ok(events.some((e) => e.type === "foeStupefied" && e.name === "Foe1"), "the foes acted");
  assert.ok(events.some((e) => e.type === "foeStupefied" && e.name === "Foe2"), "the foes acted");
  assert.equal(state.combat.round, roundBefore + 1);
});

// ══════════════════════════════════════════════════════════════════════════
// Foes hit an out hero normally; nothing wakes it on a hit
// ══════════════════════════════════════════════════════════════════════════

test("applyFoeDamageToPlayer: a foe's landed hit on an out hero never shortens C.heroOut.left", () => {
  const foe = fixedFoe();
  const state = fixedState({ c: { wp: 50 } });
  state.combat = fixedCombat([foe], { heroOut: { kind: "asleep", left: 3, spell: "Doze" } });
  applyFoeDamageToPlayer(state, foe, fakeRng([]), [], { dmg: 10 });
  assert.equal(state.combat.heroOut.left, 3);
  assert.equal(state.c.wp, 40);
});

test("foeSwingVsHero: identical faces/mods whether or not the hero is heroOut — no easier-hit bonus", () => {
  const foe = fixedFoe();
  const normalState = fixedState();
  normalState.combat = fixedCombat([foe]);
  const normal = foeSwingVsHero(normalState, foe);

  const outState = fixedState();
  outState.combat = fixedCombat([foe], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } });
  const out = foeSwingVsHero(outState, foe);

  assert.deepEqual(normal, out);
});

// ══════════════════════════════════════════════════════════════════════════
// The action conversion — every hero combat action becomes loseTurn
// ══════════════════════════════════════════════════════════════════════════

test("applyAction: every hero combat action becomes loseTurn while C.heroOut is set", () => {
  const CONVERTED = ["attack", "castSpell", "drinkPotion", "readScroll", "useItem", "useAbility", "flee", "parley", "sing"];
  const FORBIDDEN_BY_TYPE = {
    attack: ["struck", "strikeMissed"],
    drinkPotion: ["potionDrunk"],
    readScroll: ["scrollRead"],
    useItem: ["itemUsed"],
    useAbility: ["abilityUsed"],
    flee: ["fled"],
  };
  const actionFor = (type) => {
    if (type === "castSpell") return { type, idx: 0 };
    if (type === "useItem") return { type, i: 0 };
    if (type === "useAbility") return { type, key: "kata" };
    return { type };
  };
  for (const type of CONVERTED) {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } });
    const { events } = applyAction(state, actionFor(type));
    assert.ok(events.some((e) => e.type === "heroLostTurn"), `${type}: expected heroLostTurn`);
    for (const forbidden of FORBIDDEN_BY_TYPE[type] || []) {
      assert.equal(events.some((e) => e.type === forbidden), false, `${type}: unexpected ${forbidden}`);
    }
  }
});

test("applyAction: loseTurn itself is a known action, and dispatches through engine/combat.js#loseTurn", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } });
  const { events } = applyAction(state, { type: "loseTurn" });
  assert.ok(events.some((e) => e.type === "heroLostTurn"));
});

// ══════════════════════════════════════════════════════════════════════════
// No soft-lock — the three drivers
// ══════════════════════════════════════════════════════════════════════════

test("soft-lock driver (a): a lone hero, every foe stupefied — repeating applyAction(loseTurn) reaches an acting hero after exactly 4 calls", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "stupefied", left: 4, spell: "Stupidity" } });
  let current = state;
  for (let i = 0; i < 4; i++) {
    assert.ok(current.combat && current.combat.heroOut, `still out before call ${i + 1}`);
    const result = applyAction(current, { type: "loseTurn" });
    current = result.state;
  }
  assert.ok(current.combat, "combat still open — the single harmless foe never dies");
  assert.equal(current.combat.heroOut, undefined, "the hero can act again after exactly 4 calls");
});

test("soft-lock driver (b): a lone low-hp hero against a foe that hits — reaches death or an acting hero within 4 calls", () => {
  const state = fixedState({ c: { wp: 10 } });
  state.combat = fixedCombat([fixedFoe()], { heroOut: { kind: "asleep", left: 4, spell: "Doze" } });
  let current = state;
  let resolved = false;
  for (let i = 0; i < 4 && !resolved; i++) {
    const result = applyAction(current, { type: "loseTurn" });
    current = result.state;
    if (current.dead || !current.combat || !current.combat.heroOut) resolved = true;
  }
  assert.ok(resolved, "reached death or an acting hero within 4 calls");
});

test("soft-lock driver (c): a hero with a strong party — reaches a cleared fight or an acting hero within 4 calls", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 5, maxWP: 5 })], {
    heroOut: { kind: "asleep", left: 4, spell: "Doze" },
    allies: [{ partyIdx: 0, name: "Ada", lvl: 5, wp: 100, maxWP: 100 }],
  });
  let current = state;
  let resolved = false;
  for (let i = 0; i < 4 && !resolved; i++) {
    const result = applyAction(current, { type: "loseTurn" });
    current = result.state;
    if (!current.combat || !current.combat.heroOut) resolved = true;
  }
  assert.ok(resolved, "reached a cleared fight or an acting hero within 4 calls");
});

// ══════════════════════════════════════════════════════════════════════════
// endCombat drops heroOut/heroBlind/heroShrunk with the rest of the combat
// ══════════════════════════════════════════════════════════════════════════

test("endCombat: clears C.heroOut, C.heroBlind and C.heroShrunk along with the rest of the combat", () => {
  const state = fixedState();
  state.combat = fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" }, heroBlind: true, heroShrunk: true });
  endCombat(state, []);
  assert.equal(state.combat, null);
});

// ══════════════════════════════════════════════════════════════════════════
// Hero Blind — a fumbled Blind, working on the hero the way Blind works on a foe
// ══════════════════════════════════════════════════════════════════════════

test("toHit: with C.heroBlind, the hero's weapon to-hit is exactly 1 winning face, overriding class/race/gear/dark", () => {
  const state = fixedState();
  state.combat = fixedCombat([], {});
  const before = toHit(state);
  assert.notEqual(before, 1, "sanity: the Fighter's normal need really is not 1");
  state.combat.heroBlind = true;
  assert.equal(toHit(state), 1);
});

test("heroHitOdds: reflects C.heroBlind as a one-face range", () => {
  const state = fixedState();
  state.combat = fixedCombat([], { heroBlind: true });
  const odds = heroHitOdds(state);
  assert.equal(odds.faces, 1);
});

test("playerStrike: with C.heroBlind, a swing against an awake foe lands only on the die's top face", () => {
  const missFoe = fixedFoe({ wp: 999, maxWP: 999 });
  const missState = fixedState();
  missState.combat = fixedCombat([missFoe], { heroBlind: true });
  // raw 2 -> a mirrored roll one below the top face -> misses the top-face-only threshold;
  // raw 999 on the foe's own counter-swing -> a guaranteed miss back (harmless padding).
  const missEvents = playerStrike(missState, fakeRng([2, 999]), []);
  assert.ok(missEvents.some((e) => e.type === "strikeMissed"));

  // A low-wp foe dies on the very first landed blow, so the fight clears
  // before any counter-swing needs a draw.
  const hitFoe = fixedFoe({ wp: 1, maxWP: 1 });
  const hitState = fixedState();
  hitState.combat = fixedCombat([hitFoe], { heroBlind: true });
  const hitEvents = playerStrike(hitState, fakeRng([1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), []);
  assert.ok(hitEvents.some((e) => e.type === "struck"));
});

// ══════════════════════════════════════════════════════════════════════════
// Hero Shrink — a fumbled Shrink, working on the hero the way Shrink works
// on a foe: halved current-hp landed weapon damage, max hp untouched
// ══════════════════════════════════════════════════════════════════════════

test("playerStrike: with C.heroShrunk, a landed weapon blow is halved (Math.ceil); max hp is untouched", () => {
  const seq = [1, 5, 999]; // strike roll (guaranteed hit), one weapon-damage draw, a harmless counter-swing miss
  const foeWp = 999;

  const normalState = fixedState();
  normalState.combat = fixedCombat([fixedFoe({ wp: foeWp, maxWP: foeWp })], {});
  const normalEvents = playerStrike(normalState, fakeRng([...seq]), []);
  const normalStruck = normalEvents.find((e) => e.type === "struck");

  const shrunkState = fixedState();
  shrunkState.combat = fixedCombat([fixedFoe({ wp: foeWp, maxWP: foeWp })], { heroShrunk: true });
  const shrunkEvents = playerStrike(shrunkState, fakeRng([...seq]), []);
  const shrunkStruck = shrunkEvents.find((e) => e.type === "struck");

  assert.ok(normalStruck && shrunkStruck);
  assert.equal(shrunkStruck.dmg, Math.ceil(normalStruck.dmg / 2));
  assert.equal(shrunkState.c.maxWP, 55);
});

// ══════════════════════════════════════════════════════════════════════════
// conditionsOf — the chip data
// ══════════════════════════════════════════════════════════════════════════

test("conditionsOf: lists heroOut (kind, remaining), heroBlind and heroShrunk while set; nothing when absent", () => {
  const state = fixedState();
  state.combat = fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" }, heroBlind: true, heroShrunk: true });
  const conds = conditionsOf(state);
  assert.deepEqual(conds.find((c) => c.key === "heroOut"), { key: "heroOut", polarity: "bad", kind: "asleep", remaining: 2 });
  assert.deepEqual(conds.find((c) => c.key === "heroBlind"), { key: "heroBlind", polarity: "bad" });
  assert.deepEqual(conds.find((c) => c.key === "heroShrunk"), { key: "heroShrunk", polarity: "bad" });

  const clean = fixedState();
  clean.combat = fixedCombat([], {});
  const cleanConds = conditionsOf(clean);
  assert.equal(cleanConds.some((c) => ["heroOut", "heroBlind", "heroShrunk"].includes(c.key)), false);
});
