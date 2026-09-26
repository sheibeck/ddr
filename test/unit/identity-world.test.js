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
import { canEquipArmor, armorRefusalReason, takeItem, equipItem, useItem } from "../../engine/items.js";
import { openStore } from "../../engine/economy.js";
import { newDay } from "../../engine/movement.js";
import { potionMight } from "../../engine/derived.js";
import { ARMORS } from "../../content/index.js";

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
    dead: false, deathNote: "", epitaph: "", pendingJoiner: null,
    ...rest,
  };
}

/* ============================================================
 * Task 1 — Joiners refuse a Cutthroat; Magic User Joiners refuse a Wilmsry
 * ============================================================ */

test("meetJoiner: a Cutthroat's Joiner is rolled exactly as usual and OFFERED — pendingJoiner set, joinerMet fires, no joinerRefused (Phase 36 CUT-01)", () => {
  const cutthroat = fixedState({ c: { sub: "Cutthroat" } });
  const events = meetJoiner(cutthroat, makeRng(555), []);
  assert.ok(cutthroat.pendingJoiner, "a candidate is stashed for a Cutthroat");
  assert.equal(cutthroat.pendingJoiner.name, cutthroat.c.joiner.name);

  const control = fixedState({ c: { sub: "Soldier" } });
  meetJoiner(control, makeRng(555), []);
  assert.deepEqual(cutthroat.c.joiner, control.c.joiner, "the joiner is rolled identically regardless of sub");

  const met = events.find((e) => e.type === "joinerMet");
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(met, "joinerMet still fires");
  assert.ok(!refused, "no joinerRefused for a Cutthroat anymore");
});

test("meetJoiner: a Cutthroat's OFFER consumes NO extra rng (cursor matches the 4-draw control)", () => {
  const ctrl = makeRng(777);
  ctrl.d(10);
  rollCharacter(ctrl);
  ctrl.d(20);
  ctrl.d(20);
  const ctrlNext = ctrl.d(20);

  const state = fixedState({ c: { sub: "Cutthroat" } });
  const rng = makeRng(777);
  meetJoiner(state, rng, []);
  assert.equal(rng.d(20), ctrlNext, "the draw following a Cutthroat's meetJoiner offer is unchanged");
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

/* ============================================================
 * Task 2 — Woodsman armour gate (canEquipArmor/takeItem/equipItem/store) +
 * Pilfer heal-only useItem
 * ============================================================ */

const STUDDED = ARMORS.find((a) => a.name === "Studded");
const MAIL = ARMORS.find((a) => a.name === "Mail");
const PLATE = ARMORS.find((a) => a.name === "Plate");
const LEATHER = ARMORS.find((a) => a.name === "Leather");

test("armorRefusalReason / canEquipArmor: a Woodsman may wear Studded/Leather but not Mail/Plate", () => {
  const woodsman = { race: "Human", cls: "Fighter", sub: "Woodsman", skills: {} };
  assert.equal(armorRefusalReason(woodsman, STUDDED), null);
  assert.equal(armorRefusalReason(woodsman, LEATHER), null);
  assert.equal(armorRefusalReason(woodsman, MAIL), "woodsman");
  assert.equal(armorRefusalReason(woodsman, PLATE), "woodsman");
  assert.equal(canEquipArmor(woodsman, STUDDED), true);
  assert.equal(canEquipArmor(woodsman, MAIL), false);
  assert.equal(canEquipArmor(woodsman, PLATE), false);
  assert.equal(canEquipArmor(woodsman, LEATHER), true);
});

test("armorRefusalReason: tooHeavy for a Thief without Heft, noArmor for a Fridgian, null for a Soldier", () => {
  const thief = { race: "Human", cls: "Thief", sub: "Pilfer", skills: {} };
  assert.equal(armorRefusalReason(thief, MAIL), "tooHeavy");
  const fridgian = { race: "Fridgian", cls: "Fighter", sub: "Soldier", skills: {} };
  assert.equal(armorRefusalReason(fridgian, LEATHER), "noArmor");
  const soldier = { race: "Human", cls: "Fighter", sub: "Soldier", skills: {} };
  assert.equal(armorRefusalReason(soldier, MAIL), null);
});

test("takeItem: a Woodsman is refused Mail (reason woodsman), armour untouched; a Soldier takes it", () => {
  const woodsman = fixedState({ c: { sub: "Woodsman", cls: "Fighter" } });
  const events = takeItem(
    woodsman,
    { kind: "armor", n: "Mail", armor: "Mail", ar: MAIL.ar, cls: MAIL.cls, min: MAIL.min, wp: MAIL.wp },
    [],
  );
  assert.ok(events.some((e) => e.type === "itemRejected" && e.reason === "woodsman"));
  assert.equal(woodsman.c.armor, "Nothing", "armour left untouched");

  const soldier = fixedState({ c: { sub: "Soldier", cls: "Fighter" } });
  const events2 = takeItem(
    soldier,
    { kind: "armor", n: "Mail", armor: "Mail", ar: MAIL.ar, cls: MAIL.cls, min: MAIL.min, wp: MAIL.wp },
    [],
  );
  assert.ok(events2.some((e) => e.type === "itemTaken"));
  assert.equal(soldier.c.armor, "Mail");
});

test("takeItem: a Woodsman takes Studded (ar <= 10) normally — the gate only blocks heavier pieces", () => {
  const woodsman = fixedState({ c: { sub: "Woodsman", cls: "Fighter" } });
  const events = takeItem(
    woodsman,
    { kind: "armor", n: "Studded", armor: "Studded", ar: STUDDED.ar, cls: STUDDED.cls, min: STUDDED.min, wp: STUDDED.wp },
    [],
  );
  assert.ok(events.some((e) => e.type === "itemTaken"));
  assert.equal(woodsman.c.armor, "Studded");
});

test("takeItem: a Woodsman is also refused Plate (reason woodsman)", () => {
  const woodsman = fixedState({ c: { sub: "Woodsman", cls: "Fighter" } });
  const events = takeItem(
    woodsman,
    { kind: "armor", n: "Plate", armor: "Plate", ar: PLATE.ar, cls: PLATE.cls, min: PLATE.min, wp: PLATE.wp },
    [],
  );
  assert.ok(events.some((e) => e.type === "itemRejected" && e.reason === "woodsman"));
  assert.equal(woodsman.c.armor, "Nothing");
});

test("equipItem: a Woodsman equips Leather normally, swapping the previously-worn piece back into the bag", () => {
  const woodsman = fixedState({
    c: {
      sub: "Woodsman",
      cls: "Fighter",
      armor: "Cloth",
      ar: 3,
      armorMax: 12,
      armorWP: 12,
      items: [{ kind: "armor", n: "Leather", armor: "Leather", ar: LEATHER.ar, cls: LEATHER.cls, min: LEATHER.min, wp: LEATHER.wp }],
    },
  });
  const events = equipItem(woodsman, 0, []);
  assert.ok(events.some((e) => e.type === "itemEquipped"));
  assert.equal(woodsman.c.armor, "Leather");
  assert.equal(woodsman.c.items[0].armor, "Cloth", "the old Cloth drops back into the freed slot");
});

test("equipItem: a Woodsman is refused Mail (equipRejected reason woodsman)", () => {
  const woodsman = fixedState({
    c: {
      sub: "Woodsman",
      cls: "Fighter",
      items: [{ kind: "armor", n: "Mail", armor: "Mail", ar: MAIL.ar, cls: MAIL.cls, min: MAIL.min, wp: MAIL.wp }],
    },
  });
  const events = equipItem(woodsman, 0, []);
  assert.ok(events.some((e) => e.type === "equipRejected" && e.reason === "woodsman"));
  assert.equal(woodsman.c.armor, "Nothing");
});

test("openStore: a Woodsman wearing Studded gets no armour line; a Soldier in Studded does; other lines match", () => {
  const woodsman = fixedState({
    c: { sub: "Woodsman", cls: "Fighter", armor: "Studded", ar: STUDDED.ar, armorMax: STUDDED.wp, armorWP: STUDDED.wp },
  });
  openStore(woodsman, makeRng(1), []);
  const woodsmanArmourLines = woodsman.store.stock.filter((s) => s.effectId === "buyArmor");
  assert.equal(woodsmanArmourLines.length, 0, "no armour line for a Woodsman who cannot upgrade legally");

  const soldier = fixedState({
    c: { sub: "Soldier", cls: "Fighter", armor: "Studded", ar: STUDDED.ar, armorMax: STUDDED.wp, armorWP: STUDDED.wp },
  });
  openStore(soldier, makeRng(1), []);
  const soldierArmourLines = soldier.store.stock.filter((s) => s.effectId === "buyArmor");
  assert.equal(soldierArmourLines.length, 1, "a Soldier in Studded still sees the Mail upgrade");

  const woodsmanWeapons = woodsman.store.stock.filter((s) => s.effectId === "buyWeapon").map((s) => s.n);
  const soldierWeapons = soldier.store.stock.filter((s) => s.effectId === "buyWeapon").map((s) => s.n);
  assert.deepEqual(woodsmanWeapons, soldierWeapons, "the weapon roll is identical for both — only the armour line differs");
});

test("openStore: a Woodsman wearing Leather still sees Studded offered (the gate blocks only heavier pieces)", () => {
  const woodsman = fixedState({ c: { sub: "Woodsman", cls: "Fighter", armor: "Leather", ar: LEATHER.ar, armorMax: LEATHER.wp, armorWP: LEATHER.wp } });
  openStore(woodsman, makeRng(1), []);
  const armourLines = woodsman.store.stock.filter((s) => s.effectId === "buyArmor");
  assert.equal(armourLines.length, 1, "Studded is still a legal upgrade from Leather");
  assert.equal(armourLines[0].n, "Studded");
});

test("useItem: a Pilfer may drink a Healing (heal) or Xtra Healing (full) potion normally", () => {
  const healing = { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 };
  const state = fixedState({ c: { sub: "Pilfer", wp: 10, maxWP: 55, items: [healing] } });
  const events = useItem(state, 0, fakeRng([3]), []);
  assert.ok(state.c.wp > 10, "healed");
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(!events.some((e) => e.type === "useRefused"));

  const full = { kind: "potion", n: "Xtra Healing potion", eff2: "full", uses: 1 };
  const state2 = fixedState({ c: { sub: "Pilfer", wp: 10, maxWP: 55, items: [full] } });
  useItem(state2, 0, fakeRng([]), []);
  assert.equal(state2.c.wp, 55, "healed to max");
});

// RULES-09 (Phase 75.1, user 2026-09-24/25): superseded — the heal-only
// refusal is gone. A Pilfer's non-heal potion now takes effect exactly as
// it would for anyone; the fumble risk (a d20 draw on a 1) applies only to
// use-activated jewelry/cloaks/staves, never to a potion.
test("useItem: a Pilfer using a Strength potion now takes effect, exactly as it does for anyone — no fumble draw", () => {
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
  const state = fixedState({ c: { sub: "Pilfer", might: 0, items: [strength] } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  assert.ok(!events.some((e) => e.type === "useRefused"), "no refusal");
  assert.ok(!events.some((e) => e.type === "pilferFumbled"), "a potion never fumbles, even for a Pilfer");
  // Phase 39 (GEAR-02): the retired c.might += 8 write is now a timed
  // c.timers effect record read through potionMight(c) — same as the Cat
  // Burglar case just below.
  assert.equal(potionMight(state.c), 8);
});

test("useItem: a Cat Burglar using the same Strength potion is NOT refused", () => {
  const strength = { kind: "potion", n: "Strength potion", eff2: "strength", uses: 1 };
  const state = fixedState({ c: { sub: "Cat Burglar", might: 0, items: [strength] } });
  const events = useItem(state, 0, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "itemUsed"));
  // Phase 39 (GEAR-02): the retired c.might += 8 write is now a timed
  // c.timers effect record read through potionMight(c).
  assert.equal(potionMight(state.c), 8);
});

test("canRead: a Pilfer still cannot read scrolls (unchanged)", async () => {
  const { canRead } = await import("../../engine/magic.js");
  const state = fixedState({ c: { sub: "Pilfer", cls: "Thief", scrolls: 1 } });
  assert.equal(canRead(state), false);
});

/* ============================================================
 * Task 3 — Bard camp wake roll (double), wanderingMonster.bard flag
 * ============================================================ */

// heal d(10)=5, then eight wake draws (only the 8th, a 2, hits a Bard's
// widened <=2 gate), then the forced-random combat's own draws: a foe-level
// d(4)=3 (not a 1, no downgrade) and two initiative d(20)s (15 >= 10, the
// player moves first, so no foeTurn draws follow).
const BARD_WAKE_SEQ = [5, 3, 3, 3, 3, 3, 3, 3, 2, 3, 15, 10];

test("newDay: a Bard wakes on a 1 OR a 2 — the eighth hour (a 2) starts a wandering encounter, flagged bard", () => {
  const bard = fixedState({ c: { sub: "Bard", cls: "Fighter" } });
  const events = newDay(bard, false, fakeRng(BARD_WAKE_SEQ), []);
  const wm = events.find((e) => e.type === "wanderingMonster");
  assert.ok(wm, "a Bard's wandering-monster check fires on a 2");
  assert.equal(wm.hours, 1, "only the eighth hour rolled <=2");
  assert.equal(wm.bard, true);
  assert.ok(events.some((e) => e.type === "encounterStarted"), "combat actually starts");
});

test("newDay: a Soldier with the SAME eight-draw sequence does NOT wake (a 2 never wakes a non-Bard)", () => {
  const soldier = fixedState({ c: { sub: "Soldier", cls: "Fighter" } });
  const events = newDay(soldier, false, fakeRng(BARD_WAKE_SEQ), []);
  assert.ok(!events.some((e) => e.type === "wanderingMonster"), "a Soldier only wakes on a bare 1");
  assert.ok(!events.some((e) => e.type === "encounterStarted"));
});

test("newDay: a Bard whose eight draws are all 3s wakes on none, no further draws needed", () => {
  const bard = fixedState({ c: { sub: "Bard", cls: "Fighter" } });
  const events = newDay(bard, false, fakeRng([5, 3, 3, 3, 3, 3, 3, 3, 3]), []);
  assert.ok(!events.some((e) => e.type === "wanderingMonster"));
});

test("newDay: exactly eight wake draws are consumed for a Bard — a 9th draw is never taken when nothing wakes", () => {
  // Only 9 entries total (heal + 8 wake draws, all misses under <=2). If the
  // wake loop ever drew a 9th die, or startCombat fired, fakeRng would throw
  // "sequence exhausted" — it doesn't, proving exactly eight draws.
  const bard = fixedState({ c: { sub: "Bard", cls: "Fighter" } });
  const events = newDay(bard, false, fakeRng([5, 3, 3, 3, 3, 3, 3, 3, 3]), []);
  assert.ok(!events.some((e) => e.type === "wanderingMonster"));
});
