// Phase 24 Plan 05 — the world-side sub-class/race identity pass
// (IDENT-05/IDENT-07): Joiner refusals (Cutthroat, Wilmsry-vs-Magic-User),
// the Woodsman armour gate (canEquipArmor/takeItem/equipItem/store), a
// Pilfer's heal-only useItem, and a Bard's doubled camp wake roll. Every
// mechanic here is zero-draw — see each engine module's own "DELIBERATE
// RULES CHANGE (Phase 24, 2026-09-14, ...)" comment for the exact
// draw-order proof. Local fixture helpers mirror
// test/unit/joiner-acquisition.test.js / items.test.js / economy.test.js /
// movement.test.js's own conventions (this file intentionally does not
// import theirs, to stay independently readable).

import test from "node:test";
import assert from "node:assert/strict";

import { meetJoiner } from "../../engine/encounters.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (doubles as a "no more rng
 * draws expected" assertion). `.pick(arr)` returns `arr[0]` unless a picker
 * is supplied. */
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

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 100000, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
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
    dead: false, won: false, deathNote: "", epitaph: "", pendingJoiner: null,
    ...rest,
  };
}

/* ============================================================
 * Task 1 — Joiners refuse a Cutthroat; Magic User Joiners refuse a Wilmsry
 * ============================================================ */

test("meetJoiner: a Cutthroat's Joiner is rolled exactly as usual, then refused (reason cutthroat), pendingJoiner stays null", () => {
  const cutthroat = fixedState({ c: { sub: "Cutthroat" } });
  const events = meetJoiner(cutthroat, makeRng(555), []);
  assert.equal(cutthroat.pendingJoiner, null, "no candidate is stashed for a Cutthroat");

  const control = fixedState({ c: { sub: "Soldier" } });
  meetJoiner(control, makeRng(555), []);
  assert.deepEqual(cutthroat.c.joiner, control.c.joiner, "the joiner is rolled identically regardless of sub");

  const met = events.find((e) => e.type === "joinerMet");
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(met, "joinerMet still fires");
  assert.ok(refused, "joinerRefused fires");
  assert.equal(refused.reason, "cutthroat");
  assert.equal(refused.name, cutthroat.c.joiner.name, "refusal names the rolled joiner");
  assert.equal(events.indexOf(met) < events.indexOf(refused), true, "joinerRefused is pushed after joinerMet");
});

test("meetJoiner: a Cutthroat's refusal consumes NO extra rng (cursor matches the 4-draw control)", () => {
  const ctrl = makeRng(777);
  ctrl.d(10);
  rollCharacter(ctrl);
  ctrl.d(20);
  ctrl.d(20);
  const ctrlNext = ctrl.d(20);

  const state = fixedState({ c: { sub: "Cutthroat" } });
  const rng = makeRng(777);
  meetJoiner(state, rng, []);
  assert.equal(rng.d(20), ctrlNext, "the draw following a refused meetJoiner is unchanged");
});

test("meetJoiner: a Wilmsry refuses a Magic User Joiner (pinned seed 1) — reason wilmsry, pendingJoiner null", () => {
  const state = fixedState({ c: { sub: "Soldier", race: "Wilmsry" } });
  const events = meetJoiner(state, makeRng(1), []);
  assert.equal(state.c.joiner.cls, "Magic User", "pinned seed rolls a Magic User joiner");
  assert.equal(state.pendingJoiner, null);
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(refused, "joinerRefused fires");
  assert.equal(refused.reason, "wilmsry");
  assert.equal(refused.cls, "Magic User");
});

test("meetJoiner: a Wilmsry accepts a non-Magic-User Joiner (pinned seed 5) — pendingJoiner set, no refusal", () => {
  const state = fixedState({ c: { sub: "Soldier", race: "Wilmsry" } });
  const events = meetJoiner(state, makeRng(5), []);
  assert.notEqual(state.c.joiner.cls, "Magic User", "pinned seed rolls a non-Magic-User joiner");
  assert.ok(state.pendingJoiner, "pendingJoiner is set");
  assert.ok(!events.some((e) => e.type === "joinerRefused"), "no refusal for a non-Magic-User joiner");
});

test("meetJoiner: a Human is neutral — the same Magic-User-joiner seed (1) sets pendingJoiner, no refusal", () => {
  const state = fixedState({ c: { sub: "Soldier", race: "Human" } });
  const events = meetJoiner(state, makeRng(1), []);
  assert.equal(state.c.joiner.cls, "Magic User");
  assert.ok(state.pendingJoiner, "a Human meeting the same Magic User joiner still recruits it");
  assert.ok(!events.some((e) => e.type === "joinerRefused"));
});
