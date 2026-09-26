// test/unit/reader-fumble-mechanics.test.js
//
// RULES-10 (Phase 75.1, plan 04, Task 1) — the reader's burn (`C.selfDot`),
// `fumbleHeavyBlow` (the ONE replacement for every instant-kill fumble —
// user ruling 2026-09-25: "no scroll fumble kills outright"), and the
// `scrollFumble` death cause. Both mechanics are engine-only today — no
// resolver sets `selfDot` yet (that lands in 75.1-05) — so every test here
// builds the field directly on a fixture combat, mirroring
// test/unit/foe-fumble-mechanics.test.js's own direct-construction pattern.
//
// Local fixtures mirror test/unit/foe-fumble-mechanics.test.js verbatim, per
// this suite's established per-file convention (no cross-import of test
// helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { foeTurn, fumbleHeavyBlow } from "../../engine/combat.js";
import { AFRAID_ROUNDS } from "../../engine/derived.js";
import { derivedRng, makeRng } from "../../engine/rng.js";
import { CAUSE_TEXT, CAUSE_TEXT_TOKENS, EPITAPHS } from "../../content/epitaphs.js";
import { TAG_CAUSES } from "../../src/browser/scoreTag.js";

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
// The reader's burn (C.selfDot)
// ══════════════════════════════════════════════════════════════════════════

test("foeTurn: a bonus-only selfDot burns a flat amount on each of three foeTurns, then removes itself", () => {
  const state = fixedState();
  state.combat = fixedCombat([], {
    selfDot: { left: 3, dmg: { n: 0, sides: 6, bonus: 5 }, by: "acid", spell: "Acid" },
  });

  const t1 = foeTurn(state, fakeRng([]), []);
  assert.deepEqual(t1.find((e) => e.type === "selfDotTick"), { type: "selfDotTick", spell: "Acid", by: "acid", amount: 5, left: 2 });
  assert.equal(state.c.wp, 50);

  const t2 = foeTurn(state, fakeRng([]), []);
  assert.deepEqual(t2.find((e) => e.type === "selfDotTick"), { type: "selfDotTick", spell: "Acid", by: "acid", amount: 5, left: 1 });
  assert.equal(state.c.wp, 45);

  const t3 = foeTurn(state, fakeRng([]), []);
  assert.deepEqual(t3.find((e) => e.type === "selfDotTick"), { type: "selfDotTick", spell: "Acid", by: "acid", amount: 5, left: 0 });
  assert.equal(state.c.wp, 40);
  assert.equal(state.combat.selfDot, undefined, "the burn removes itself once left reaches 0");
});

test("foeTurn: the burn bypasses a Shield ward and armor entirely — no soak, no wear", () => {
  const state = fixedState({ c: { ward: { name: "Shield", pool: 999, rounds: 5 }, ar: 15, armorWP: 45, armorMax: 45 } });
  state.combat = fixedCombat([], {
    selfDot: { left: 1, dmg: { n: 0, sides: 6, bonus: 5 }, by: "acid", spell: "Acid" },
  });
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(state.c.wp, 50);
  assert.equal(state.c.ward.pool, 999, "the ward pool is untouched — the burn never reaches applyFoeDamageToPlayer");
  assert.equal(state.c.armorWP, 45, "armor is untouched — no soak, no wear");
  assert.ok(events.some((e) => e.type === "selfDotTick"));
});

test("foeTurn: a burn that reaches 0 hp kills through die(), and no foe acts after the death", () => {
  const foe = fixedFoe();
  const state = fixedState({ c: { wp: 5 } });
  state.combat = fixedCombat([foe], {
    selfDot: { left: 1, dmg: { n: 0, sides: 6, bonus: 5 }, by: "acid", spell: "Acid" },
  });
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(state.dead, true);
  assert.equal(state.deathNote, "undone by their own Acid scroll");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "scrollFumble"));
  assert.equal(events.some((e) => e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "foeBolted"), false, "no foe acts after the death");
});

test("foeTurn: an Ice selfDot with then 'heavy' fires fumbleHeavyBlow (how 'frozen') when the last tick leaves the hero standing", () => {
  const state = fixedState({ acts: 7, c: { wp: 50 }, floor: { depth: 4 } });
  state.combat = fixedCombat([], {
    round: 1,
    selfDot: { left: 1, dmg: { n: 0, sides: 6, bonus: 5 }, by: "ice", spell: "Ice", then: "heavy" },
  });
  const events = foeTurn(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "selfDotTick" && e.left === 0));
  const blow = events.find((e) => e.type === "fumbleHeavyBlow");
  assert.deepEqual(blow, { type: "fumbleHeavyBlow", spell: "Ice", how: "frozen", amount: 11, depth: 4, afraid: AFRAID_ROUNDS });
  assert.equal(state.combat.selfDot, undefined);
  assert.equal(state.c.wp, 50 - 5 - 11);
  // Afraid is set to AFRAID_ROUNDS by fumbleHeavyBlow, then this SAME
  // foeTurn call's own tail ticks it down by one before returning — exactly
  // the existing "a foes-first opener that triggers Afraid ticks it 2 -> 1
  // inside this same call" precedent (engine/combat.js#fight's own JSDoc).
  assert.equal(state.combat.afraid, AFRAID_ROUNDS - 1);
});

test("foeTurn: the burn itself killing the hero on the last tick ends the fight before the heavy blow ever fires", () => {
  const state = fixedState({ c: { wp: 5 } });
  state.combat = fixedCombat([], {
    selfDot: { left: 1, dmg: { n: 0, sides: 6, bonus: 5 }, by: "ice", spell: "Ice", then: "heavy" },
  });
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(state.dead, true);
  assert.equal(events.some((e) => e.type === "fumbleHeavyBlow"), false);
});

test("foeTurn: the burn draws only from its own derived stream — the main rng cursor is untouched, whatever the burn's dice shape", () => {
  const runWith = (dmg) => {
    const state = fixedState();
    state.combat = fixedCombat([], { selfDot: { left: 1, dmg, by: "acid", spell: "Acid" } });
    const rng = makeRng(12345);
    const before = rng.getState();
    foeTurn(state, rng, []);
    return { before, after: rng.getState() };
  };
  const flat = runWith({ n: 0, sides: 6, bonus: 5 });
  const dicey = runWith({ n: 3, sides: 6, bonus: 0 });
  assert.equal(flat.after, flat.before, "a bonus-only burn draws nothing from the main rng");
  assert.equal(dicey.after, dicey.before, "a dice-rolled burn ALSO draws nothing from the main rng — only its own derived stream");
});

test("foeTurn: inertness — a combat with no selfDot narrates nothing for it", () => {
  const state = fixedState();
  state.combat = fixedCombat([]);
  const events = foeTurn(state, makeRng(999), []);
  assert.equal(events.some((e) => e.type === "selfDotTick"), false);
  assert.equal(events.some((e) => e.type === "fumbleHeavyBlow"), false);
});

// ══════════════════════════════════════════════════════════════════════════
// fumbleHeavyBlow — the ONE replacement for every instant-kill fumble
// ══════════════════════════════════════════════════════════════════════════

test("fumbleHeavyBlow: depth 4, the stream's d10 showing 7, takes exactly 11 hp, ignoring ward/armor/Hardiness, and raises Afraid", () => {
  const state = fixedState({
    acts: 7,
    c: { wp: 50, skills: { Hardiness: true }, ward: { name: "Shield", pool: 999, rounds: 5 }, ar: 15, armorWP: 45, armorMax: 45 },
    floor: { depth: 4 },
  });
  state.combat = fixedCombat([], { round: 1 });
  const events = [];
  const result = fumbleHeavyBlow(state, "Ice", "frozen", fakeRng([]), events);
  assert.equal(result.died, false);
  assert.equal(state.c.wp, 39, "50 - (7 + depth 4)");
  assert.equal(state.c.ward.pool, 999, "the ward is untouched — the blow never reaches applyFoeDamageToPlayer");
  assert.equal(state.c.armorWP, 45, "armor is untouched — no soak roll, no wear, Hardiness never consulted");
  assert.equal(state.combat.afraid, AFRAID_ROUNDS);
  assert.deepEqual(events, [{ type: "fumbleHeavyBlow", spell: "Ice", how: "frozen", amount: 11, depth: 4, afraid: AFRAID_ROUNDS }]);
});

test("fumbleHeavyBlow: raises Afraid to at least AFRAID_ROUNDS, never lowering an already-higher value", () => {
  const state = fixedState({ acts: 7, floor: { depth: 4 } });
  state.combat = fixedCombat([], { round: 1, afraid: AFRAID_ROUNDS + 5 });
  fumbleHeavyBlow(state, "Death", "a hard knock", fakeRng([]), []);
  assert.equal(state.combat.afraid, AFRAID_ROUNDS + 5);
});

test("fumbleHeavyBlow boundary: exactly `amount` hp dies through the normal death path; one more hp survives at 1", () => {
  const dead = fixedState({ acts: 7, c: { wp: 11 }, floor: { depth: 4 } });
  dead.combat = fixedCombat([], { round: 1 });
  const deadEvents = [];
  const deadResult = fumbleHeavyBlow(dead, "Ice", "frozen", fakeRng([]), deadEvents);
  assert.equal(deadResult.died, true);
  assert.equal(dead.dead, true);
  assert.equal(dead.deathNote, "undone by their own Ice scroll");
  assert.ok(deadEvents.some((e) => e.type === "died" && e.cause === "scrollFumble"));

  const alive = fixedState({ acts: 7, c: { wp: 12 }, floor: { depth: 4 } });
  alive.combat = fixedCombat([], { round: 1 });
  const aliveResult = fumbleHeavyBlow(alive, "Ice", "frozen", fakeRng([]), []);
  assert.equal(aliveResult.died, false);
  assert.equal(alive.c.wp, 1);
});

test("fumbleHeavyBlow: a hero with 11 + depth hp can never die of it, whatever the d10 shows (max roll pinned)", () => {
  const depth = 3;
  const state = fixedState({ acts: 27, c: { wp: 11 + depth }, floor: { depth } });
  state.combat = fixedCombat([], { round: 1 });
  const events = [];
  const result = fumbleHeavyBlow(state, "Death", "a hard knock", fakeRng([]), events);
  assert.equal(result.died, false);
  assert.equal(state.c.wp, 1, "the max possible blow (d10=10 + depth) leaves exactly 1 hp");
  const blow = events.find((e) => e.type === "fumbleHeavyBlow");
  assert.equal(blow.amount, 10 + depth);
});

// ══════════════════════════════════════════════════════════════════════════
// content: the scrollFumble death cause
// ══════════════════════════════════════════════════════════════════════════

test("content: CAUSE_TEXT.scrollFumble names {foe}; EPITAPHS.scrollFumble is non-empty; TAG_CAUSES ends with pilferFumble, scrollFumble", () => {
  assert.ok(CAUSE_TEXT.scrollFumble.includes("{foe}"));
  assert.deepEqual(CAUSE_TEXT_TOKENS.scrollFumble, ["foe"]);
  assert.ok(Array.isArray(EPITAPHS.scrollFumble) && EPITAPHS.scrollFumble.length > 0);
  assert.deepEqual(TAG_CAUSES.slice(-2), ["pilferFumble", "scrollFumble"]);
});
