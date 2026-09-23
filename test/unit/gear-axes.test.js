// test/unit/gear-axes.test.js
//
// Phase 39 (GEAR-01, 39-01-PLAN.md) — the gear-axes contract suite. Task 1
// pins the eight content-table behaviours (weapon need/crit, armor bulk, the
// pinned key order/cls strings, WEAPON_MAX consistency, store band role
// coverage, KIT weapon existence, and the Magic User cost ceiling). Task 2
// appends the engine-read behaviours (classNeed/weaponNeedMod/weaponCrit/
// armorBulk/expectedStrike/toHit/crit/Stealth-bulk/flee-bulk/climb-leap-bulk/
// weaponUpgradeDelta/lootCompare) directly below this section.

import test from "node:test";
import assert from "node:assert/strict";

import { WEAPONS, WEAPON_MAX, ARMORS, CLASSES, KIT } from "../../content/index.js";
import { storeWeaponPool } from "../../engine/economy.js";
import { GW, GH } from "../../engine/maze.js";
import {
  classNeed,
  weaponNeedMod,
  weaponCrit,
  armorBulk,
  expectedStrike,
  toHit,
} from "../../engine/derived.js";
import { playerStrike, flee } from "../../engine/combat.js";
import { move } from "../../engine/movement.js";
import { weaponUpgradeDelta, takeItem } from "../../engine/items.js";
import { lootCompare } from "../../src/browser/viewModels.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

const CLASS_LETTER = { "Fighter": "F", "Thief": "T", "Magic User": "M" };

// --- Task 1: content-table axes -------------------------------------------

test("Test 1: WEAPONS key order and cls strings are pinned byte-for-byte", () => {
  const expectedOrder = [
    "Axe", "Bastard Sword", "Battle Axe", "Broadsword", "Claymore", "Dagger", "Katana",
    "Kopesh Sword", "Long Sword", "Ninja-to", "Rapier", "Short Sword", "Wakazashi", "Club",
    "Flail", "Mace", "Morning Star", "Quarter Staff", "Spiked Staff", "Whip", "Awl Pike",
    "Bardiche", "Naganita", "Spear",
  ];
  assert.deepStrictEqual(Object.keys(WEAPONS), expectedOrder);

  const expectedCls = {
    "Axe": "FTM", "Bastard Sword": "F", "Battle Axe": "F", "Broadsword": "F", "Claymore": "F",
    "Dagger": "FTM", "Katana": "FT", "Kopesh Sword": "F", "Long Sword": "FT", "Ninja-to": "FT",
    "Rapier": "FTM", "Short Sword": "FTM", "Wakazashi": "FT", "Club": "FTM", "Flail": "FT",
    "Mace": "FT", "Morning Star": "FT", "Quarter Staff": "FTM", "Spiked Staff": "FTM", "Whip": "FT",
    "Awl Pike": "FT", "Bardiche": "F", "Naganita": "F", "Spear": "FTM",
  };
  for (const [name, cls] of Object.entries(expectedCls)) {
    assert.equal(WEAPONS[name].cls, cls, `${name}.cls`);
  }
});

test("Test 2: every WEAPONS row carries need in {-2,-1,0,1} and crit in {1,2}; the precise-blade/Bardiche pins hold", () => {
  const preciseBlades = ["Rapier", "Katana", "Wakazashi", "Ninja-to", "Dagger"];
  let critTwoCount = 0;
  let needMinusTwoCount = 0;
  for (const [name, w] of Object.entries(WEAPONS)) {
    assert.ok(Number.isInteger(w.need) && [-2, -1, 0, 1].includes(w.need), `${name}.need`);
    assert.ok([1, 2].includes(w.crit), `${name}.crit`);
    if (w.crit === 2) critTwoCount++;
    if (w.need === -2) needMinusTwoCount++;
  }
  for (const name of preciseBlades) assert.equal(WEAPONS[name].crit, 2, `${name} must crit on 1-2`);
  assert.equal(critTwoCount, preciseBlades.length, "exactly the five precise blades crit on 1-2");
  assert.equal(needMinusTwoCount, 1, "exactly one weapon carries need: -2");
  assert.equal(WEAPONS["Bardiche"].need, -2);
  assert.equal(WEAPONS["Bardiche"].cls, "F");
});

test("Test 3: floor guarantee — no legal (class, weapon) pair yields a base need below 2", () => {
  for (const [clsName, letter] of Object.entries(CLASS_LETTER)) {
    for (const [wname, w] of Object.entries(WEAPONS)) {
      if (!w.cls.includes(letter)) continue;
      const base = CLASSES[clsName].toHit + w.need;
      assert.ok(base >= 2, `${clsName} with ${wname}: base need ${base} must be >= 2`);
    }
  }
});

test("Test 4: WEAPON_MAX matches the dice (halve -> ceil(max/2))", () => {
  for (const [name, w] of Object.entries(WEAPONS)) {
    const raw = w.dice.n * w.dice.sides + w.dice.bonus;
    const expected = w.halve ? Math.ceil(raw / 2) : raw;
    assert.equal(WEAPON_MAX[name], expected, `${name} WEAPON_MAX`);
  }
});

test("Test 5: every store band offers a heavy/neutral/light pick per class", () => {
  for (const letter of ["F", "T"]) {
    for (let tier = 0; tier < 4; tier++) {
      const pool = storeWeaponPool(letter, tier);
      const needs = pool.map((w) => WEAPONS[w].need);
      assert.ok(needs.some((n) => n < 0), `${letter} tier ${tier}: no heavy (need<0) pick`);
      assert.ok(needs.some((n) => n === 0), `${letter} tier ${tier}: no neutral (need 0) pick`);
      assert.ok(needs.some((n) => n > 0), `${letter} tier ${tier}: no light (need>0) pick`);
    }
  }
  for (const tier of [0, 1, 3]) {
    const pool = storeWeaponPool("M", tier);
    const needs = pool.map((w) => WEAPONS[w].need);
    assert.ok(needs.some((n) => n < 0), `M tier ${tier}: no heavy pick`);
    assert.ok(needs.some((n) => n === 0), `M tier ${tier}: no neutral pick`);
    assert.ok(needs.some((n) => n > 0), `M tier ${tier}: no light pick`);
  }
  const tier2 = storeWeaponPool("M", 2);
  const distinctNeeds = new Set(tier2.map((w) => WEAPONS[w].need));
  assert.ok(distinctNeeds.size >= 2, "M tier 2 must offer at least two distinct need values");
});

test("Test 6: every KIT starting weapon exists in WEAPONS", () => {
  for (const [sub, [weapon]] of Object.entries(KIT)) {
    assert.ok(Object.prototype.hasOwnProperty.call(WEAPONS, weapon), `KIT[${sub}][0] = "${weapon}" must be a WEAPONS key`);
  }
});

test("Test 7: ARMORS names/order/fields unchanged; bulk is 0,0,1,1,2", () => {
  const expected = [
    { name: "Cloth", cost: 300, wp: 12, ar: 3, cls: "FTM", min: 1, bulk: 0 },
    { name: "Leather", cost: 500, wp: 15, ar: 6, cls: "FT", min: 1, bulk: 0 },
    { name: "Studded", cost: 750, wp: 18, ar: 10, cls: "FT", min: 2, bulk: 1 },
    { name: "Mail", cost: 1000, wp: 30, ar: 12, cls: "F", min: 3, bulk: 1 },
    { name: "Plate", cost: 2000, wp: 45, ar: 15, cls: "F", min: 4, bulk: 2 },
  ];
  assert.equal(ARMORS.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.deepStrictEqual(ARMORS[i], expected[i], `ARMORS[${i}]`);
  }
});

test("Test 8: every Magic User-legal weapon still costs <= 250 (keeps store-roll's M tier-3 fallback pin true)", () => {
  const legal = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes("M"));
  for (const w of legal) assert.ok(WEAPONS[w].cost <= 250, `${w} (M-legal) must cost <= 250`);
});

// --- Task 2: engine-read behaviours -----------------------------------------
//
// Local fixture helpers mirror test/unit/ability-strike.test.js's and
// test/unit/movement.test.js's per-file-fixture convention (never imported
// cross-file).

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless overridden. */
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
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const { dark = false, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...rest };
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
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const FILL = new Array(24).fill(20);

test("classNeed(c): Fighter 5, Thief 4, Magic User 3; Elven max(...,5); Acrobat 5; Cleric max(...,4)", () => {
  assert.equal(classNeed({ cls: "Fighter", race: "Human", sub: "Knight" }), 5);
  assert.equal(classNeed({ cls: "Thief", race: "Human", sub: "Pickpocket" }), 4);
  assert.equal(classNeed({ cls: "Magic User", race: "Human", sub: "Wizard" }), 3);
  assert.equal(classNeed({ cls: "Magic User", race: "Elven", sub: "Wizard" }), 5);
  assert.equal(classNeed({ cls: "Thief", race: "Human", sub: "Acrobat" }), 5);
  assert.equal(classNeed({ cls: "Magic User", race: "Human", sub: "Cleric" }), 4);
});

test("weaponNeedMod(x): accepts a base name or a character; 0 for Fists/unknown", () => {
  assert.equal(weaponNeedMod("Rapier"), 1);
  assert.equal(weaponNeedMod("Flail"), -1);
  assert.equal(weaponNeedMod({ weapon: "Bardiche" }), -2);
  assert.equal(weaponNeedMod("Fists"), 0);
  assert.equal(weaponNeedMod(undefined), 0);
});

test("weaponCrit(c): WEAPONS[c.weapon].crit or 1", () => {
  assert.equal(weaponCrit({ weapon: "Rapier" }), 2);
  assert.equal(weaponCrit({ weapon: "Axe" }), 1);
  assert.equal(weaponCrit({ weapon: "Fists" }), 1);
});

test("armorBulk(c): ARMORS.find by name, 0 default; a Warded piece resolves by c.armor's base name", () => {
  assert.equal(armorBulk({ armor: "Plate" }), 2);
  assert.equal(armorBulk({ armor: "Studded" }), 1);
  assert.equal(armorBulk({ armor: "Nothing" }), 0);
  assert.equal(armorBulk({ armor: "Leather" }), 0);
  assert.equal(armorBulk({}), 0);
});

test("toHit(state): Fighter+Rapier 6, Fighter+Flail 4, Fighter+Bardiche 3, Magic User+Spiked Staff 2 (floor 1)", () => {
  const mk = (cls, weapon) => fixedState({ c: fixedFighter({ cls, sub: null, weapon }) });
  assert.equal(toHit(mk("Fighter", "Rapier")), 6);
  assert.equal(toHit(mk("Fighter", "Flail")), 4);
  assert.equal(toHit(mk("Fighter", "Bardiche")), 3);
  assert.equal(toHit(mk("Magic User", "Spiked Staff")), 2);
});

test("crit: with roll 2 a Dagger crits and an Axe does not, for a non-opening Thief strike", () => {
  const daggerState = fixedState({ c: fixedFighter({ cls: "Thief", sub: "Pilfer", weapon: "Dagger" }) });
  daggerState.combat = fixedCombat([fixedFoe()], { opened: true, opened2: true });
  const daggerEvents = playerStrike(daggerState, fakeRng([2, 4, ...FILL]), []);
  const daggerStruck = daggerEvents.find((e) => e.type === "struck");
  assert.ok(daggerStruck, "a roll of 2 must hit (Thief+Dagger need 5)");
  assert.equal(daggerStruck.critical, true, "a Dagger (crit:2) must crit on a roll of 2");

  const axeState = fixedState({ c: fixedFighter({ cls: "Thief", sub: "Pilfer", weapon: "Axe" }) });
  axeState.combat = fixedCombat([fixedFoe()], { opened: true, opened2: true });
  const axeEvents = playerStrike(axeState, fakeRng([2, 4, ...FILL]), []);
  const axeStruck = axeEvents.find((e) => e.type === "struck");
  assert.ok(axeStruck, "a roll of 2 must hit (Thief+Axe need 4)");
  assert.equal(axeStruck.critical, false, "an Axe (crit:1) must not crit on a roll of 2");
});

test("crit: a Guard with a Dagger never crits, even on a roll of 1", () => {
  const state = fixedState({ c: fixedFighter({ cls: "Fighter", sub: "Guard", weapon: "Dagger" }) });
  state.combat = fixedCombat([fixedFoe()], { opened: true, opened2: true });
  const events = playerStrike(state, fakeRng([1, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, false, "Guard's noCrit rule beats even a natural 1 on a precise blade");
});

test("crit: a roll of 1 crits with any weapon (non-noCrit)", () => {
  const state = fixedState({ c: fixedFighter({ cls: "Fighter", sub: "Knight", weapon: "Axe" }) });
  state.combat = fixedCombat([fixedFoe()], { opened: true, opened2: true });
  const events = playerStrike(state, fakeRng([1, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
});

test("Stealth/backstab gates read armorBulk: Studded (bulk 1) still backstabs, Plate (bulk 2) is denied", () => {
  const studdedState = fixedState({ c: fixedFighter({ cls: "Thief", sub: "Pilfer", weapon: "Dagger", armor: "Studded" }) });
  studdedState.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const studdedEvents = playerStrike(studdedState, fakeRng([3, 4, ...FILL]), []);
  assert.ok(!studdedEvents.some((e) => e.type === "backstabDenied"), "Studded (bulk 1) must not deny the backstab");
  assert.ok(studdedEvents.some((e) => e.type === "backstab" || e.type === "struck"));

  const plateState = fixedState({ c: fixedFighter({ cls: "Thief", sub: "Pilfer", weapon: "Dagger", armor: "Plate" }) });
  plateState.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const plateEvents = playerStrike(plateState, fakeRng([3, 4, ...FILL]), []);
  assert.ok(plateEvents.some((e) => e.type === "backstabDenied"), "Plate (bulk 2) must deny the backstab");
});

test("flee: fleeRolled carries mods (not bulk/bonus); success is roll + mods >= 14 (a Fighter in Plate needs a natural 16)", () => {
  // Phase 42 (FLEE-01/FLEE-02): need is 14 (was 11); the old bulk/bonus
  // fields are gone from the event — every modifier (armor included) is
  // now named in `mods`, mirroring foeToHitBreakdown's shape.
  const state = fixedState({ c: fixedFighter({ cls: "Fighter", sub: "Knight", armor: "Plate" }) });
  state.combat = fixedCombat([fixedFoe()], { tracked: false });
  // a failed flee runs a full foeTurn afterward, so pad with filler draws.
  const events = flee(state, fakeRng([12, ...FILL]), []);
  const rolled = events.find((e) => e.type === "fleeRolled");
  assert.ok(rolled);
  assert.deepStrictEqual(rolled.mods, [{ name: "Plate", delta: -2 }]);
  assert.equal(rolled.total, 10);
  assert.equal(rolled.need, 14);
  assert.ok(events.some((e) => e.type === "fleeFailed"), "roll 12 - 2 = 10 < 14: fails");

  const state2 = fixedState({ c: fixedFighter({ cls: "Fighter", sub: "Knight", armor: "Plate" }) });
  state2.combat = fixedCombat([fixedFoe()], { tracked: false });
  const events2 = flee(state2, fakeRng([16]), []);
  assert.ok(events2.some((e) => e.type === "fled"), "roll 16 - 2 = 14 >= 14: succeeds");
});

test("climb: armorBulk(state.c) is added to r — a stubbed d10 that a Leather wearer passes fails for a Plate wearer", () => {
  function wallGrid() {
    const g = [];
    for (let y = 0; y < GH; y++) {
      g.push([]);
      for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
    }
    return g;
  }
  function climbState(armor) {
    const g = wallGrid();
    g[4][5] = { wall: false, seen: false, feat: "climb" };
    return {
      version: 1, seed: 1, rngState: 1,
      c: fixedFighter({ armor }),
      floor: { g, px: 5, py: 5, depth: 1 },
      day: 1, steps: 0, combat: null, store: null, beats: null,
      dead: false, deathNote: "", epitaph: "",
    };
  }
  // pick(["rope","rock","wood"]) -> "rope" (success 7); d(2)=1 -> feet=20 (two
  // 10ft rungs); each rung's roll of 6 passes for Leather (bulk 0: r=6) but
  // fails for Plate (bulk 2: r=8) on the FIRST rung.
  const leather = climbState("Leather");
  const leatherEvents = move(leather, "N", fakeRng([1, 6, 6]), []);
  assert.ok(leatherEvents.some((e) => e.type === "climbedOver"), "Leather (bulk 0) must pass a roll of 6 (need <= 7)");
  assert.equal(leather.c.wp, 55, "no fall damage on a clean climb");

  const plate = climbState("Plate");
  const plateEvents = move(plate, "N", fakeRng([1, 6, 15, 4]), []);
  assert.ok(plateEvents.some((e) => e.type === "fellClimbing"), "Plate (bulk 2) must fail the same roll of 6 (r=8 > 7)");
  assert.equal(plate.c.wp, 51, "took 4 wp of fall damage");
});

test("expectedStrike(c, base, bonus, prof): level-1 Human Fighter tier-0 picks land within 20% of each other", () => {
  const c = { cls: "Fighter", sub: null, race: "Human", level: 1, prof: 0, magicWpn: 0, might: 0, skills: {}, items: [] };
  const rapier = expectedStrike(c, "Rapier", 0, 0);
  const flail = expectedStrike(c, "Flail", 0, 0);
  const shortSword = expectedStrike(c, "Short Sword", 0, 0);
  assert.ok(Math.abs(rapier - 1.8) < 0.01, `Rapier expectedStrike ${rapier} !~= 1.80`);
  assert.ok(Math.abs(flail - 2.125) < 0.01, `Flail expectedStrike ${flail} !~= 2.125`);
  assert.ok(Math.abs(shortSword - 1.95) < 0.01, `Short Sword expectedStrike ${shortSword} !~= 1.95`);
  assert.ok(Math.abs(rapier - shortSword) / Math.max(rapier, shortSword) < 0.2, "Rapier vs Short Sword within 20%");
  assert.ok(Math.abs(flail - shortSword) / Math.max(flail, shortSword) < 0.2, "Flail vs Short Sword within 20%");
});

test("weaponUpgradeDelta(c, it) is expectedStrike-based, rounded to 2 decimals; takeItem still refuses notBetter on <= 0", () => {
  const c = { cls: "Fighter", sub: null, race: "Human", level: 1, prof: 0, magicWpn: 0, might: 0, skills: {}, items: [], weapon: "Flail", armor: "Nothing", ar: 0 };
  const it = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const delta = weaponUpgradeDelta(c, it);
  const expected = Math.round((expectedStrike(c, "Rapier", 0, 0) - expectedStrike(c, "Flail", 0, 0)) * 100) / 100;
  assert.equal(delta, expected);
  const state = { c: structuredClone(c) };
  const events = takeItem(state, it, []);
  const rejected = events.find((e) => e.type === "itemRejected");
  if (delta <= 0) assert.equal(rejected?.reason, "notBetter");
  else assert.ok(events.some((e) => e.type === "itemTaken"));
});

test("lootCompare(c, weaponItem).line ends ' · upgrade' exactly when delta > 0 and ' · not an upgrade' otherwise, and contains ' a swing'", () => {
  // Phase 61 (STORE-03): the line now explains itself (the "why"), so it no
  // longer reads as a bare "+{delta} a swing" — it always ends with the
  // verdict word and always contains the per-swing numbers.
  const c = { cls: "Fighter", sub: null, race: "Human", level: 1, prof: 0, magicWpn: 0, might: 0, skills: {}, items: [], weapon: "Flail", armor: "Nothing", ar: 0 };
  const upgrade = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const cmp = lootCompare(c, upgrade);
  assert.match(cmp.line, / a swing/);
  if (cmp.upgrade) {
    assert.ok(cmp.line.endsWith(" · upgrade"), cmp.line);
  } else {
    assert.ok(cmp.line.endsWith(" · not an upgrade"), cmp.line);
  }
});
