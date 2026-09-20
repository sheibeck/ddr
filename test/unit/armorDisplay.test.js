// test/unit/armorDisplay.test.js
//
// Phase 28 (ARMOR-02/04/05) — the toast<->panel reproduction pin, the shared
// armor formatter, and the four-outcome copy. Local helpers mirror
// test/unit/combat.test.js (fakeRng/fixedFighter/fixedFloor/fixedState/
// fixedFoe/fixedCombat — those are file-private there, so they are
// replicated here rather than imported) and test/unit/
// characterSheetViewModel.test.js (statByKey).
//
// The FIRST test below is the ARMOR-02 acceptance evidence CONTEXT.md
// specifies: it drives applyFoeDamageToPlayer with scripted rng and asserts
// the armorSoaked toast's `wear` equals the durability delta the shared
// armorDisplay(c) formatter now shows — the toast and the panel can no
// longer disagree because both read the same c.armorWP through one source.

import test from "node:test";
import assert from "node:assert/strict";

import { armorDisplay, bagArmorText } from "../../src/browser/viewModels.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { applyFoeDamageToPlayer } from "../../engine/combat.js";
import { newRun } from "../../engine/engine.js";
import { CLOAKS } from "../../content/treasure-tables.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/combat.test.js's
 * helper verbatim). */
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
    flightLeft: 0, flightCooldown: 0,
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
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
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

function statByKey(vm, key) {
  const row = vm.stats.find((s) => s.key === key);
  assert.ok(row, `expected a stats[] row with key "${key}"`);
  return row;
}

// --- ARMOR-02: toast/panel agreement -----------------------------------------

test("ARMOR-02 reproduction: the armorSoaked toast's wear equals the durability delta on the displayed armor", () => {
  const state = fixedState({ c: { armor: "Plate", ar: 15, armorMin: 2, armorWP: 45, armorMax: 45 } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const before = armorDisplay(state.c).current;
  assert.equal(before, 45);

  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([10]), events, { dmg: 39, roll: 3, need: 5 });

  const soaked = events.find((e) => e.type === "armorSoaked");
  assert.ok(soaked, "expected an armorSoaked event");
  assert.equal(soaked.wear, 39);

  const after = armorDisplay(state.c);
  assert.equal(before - after.current, soaked.wear);
  assert.equal(after.current, 6);
  assert.equal(after.sub, "AR 15 · 6/45 hp");
  assert.equal(after.line, "Plate · AR 15 · 6/45 hp");

  assert.match(LINE_FOR.armorSoaked(soaked).text, /wear 39/);
  assert.match(EVENT_NARRATION.armorSoaked(soaked), /39/);
});

// --- armorDisplay formatter ---------------------------------------------------

test("armorDisplay(c): a bare character (Nothing, ar 0, no cloak)", () => {
  const c = fixedFighter();
  const d = armorDisplay(c);
  assert.equal(d.label, "Nothing");
  assert.equal(d.sub, "AR 0");
  assert.equal(d.wornSub, "AR 0");
  assert.equal(d.line, "Nothing · AR 0");
  assert.equal(d.worn, false);
  assert.equal(d.destroyed, false);
  assert.equal(d.magic, false);
  assert.equal(d.under, null);
  assert.equal(d.ar, 0);
  assert.equal(d.current, 0);
  assert.equal(d.max, 0);
});

test("armorDisplay(c): a destroyed worn piece", () => {
  const c = fixedFighter({ armor: "Plate", ar: 15, armorWP: 0, armorMax: 45 });
  const d = armorDisplay(c);
  assert.equal(d.worn, true);
  assert.equal(d.destroyed, true);
  assert.equal(d.sub, "AR 15 · destroyed");
  assert.equal(d.line, "Plate · AR 15 · destroyed");
});

// 260918-w4n (use-activated-only, deviation — the plan did not list this
// file, but its Cloak of Armor fixtures asserted the RETIRED
// "carried == magic" rule): the cloak's plate now applies ONLY while its
// own item:Cloak of Armor record is LIVE (worn AND used) — a bagged/idle
// copy of the SAME item shape grants nothing. `liveCloakArmor()` builds the
// c.timers record buildActivation authors for it ({ kind: "plate", effect:
// 50, cd: 50 }).
function liveCloakArmor() {
  return { "item:Cloak of Armor": { cadence: "squares", left: 50, cd: 50, phase: "effect" } };
}

test("armorDisplay(c): the Cloak of Armor carried over damaged Leather", () => {
  const cloak = { n: "Cloak of Armor", eff: { cloakArmor: 1 } };
  const c = fixedFighter({
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 9, armorMax: 15,
    items: [cloak], timers: liveCloakArmor(),
  });
  const d = armorDisplay(c);
  assert.equal(d.label, "Cloak of Armor");
  assert.equal(d.magic, true);
  assert.equal(d.ar, 15);
  assert.equal(d.sub, "AR 15 · magic plate, never wears");
  assert.equal(d.wornSub, "AR 6 · 9/15 hp");
  assert.equal(d.under, "under the cloak: Leather 9/15 hp");
  assert.equal(d.line, "Cloak of Armor · AR 15 · magic plate, never wears");
  assert.equal(d.current, 9);
  assert.equal(d.max, 15);

  // Identical result regardless of the cloak's bag index.
  const c2 = fixedFighter({
    armor: "Leather", ar: 6, armorMin: 1, armorWP: 9, armorMax: 15,
    items: [{ kind: "weapon", n: "Dagger", base: "Dagger", bonus: 0 }, cloak],
    timers: liveCloakArmor(),
  });
  assert.deepEqual(armorDisplay(c2), d);
});

test("armorDisplay(c): the Cloak of Armor carried over a BETTER worn piece", () => {
  const cloak = { n: "Cloak of Armor", eff: { cloakArmor: 1 } };
  const c = fixedFighter({ armor: "Plate", ar: 17, armorWP: 50, armorMax: 50, items: [cloak], timers: liveCloakArmor() });
  const d = armorDisplay(c);
  assert.equal(d.ar, 17);
  assert.equal(d.sub, "AR 17 · magic plate, never wears");
  assert.equal(d.label, "Cloak of Armor");
});

test("armorDisplay(c): the Cloak of Armor carried over nothing", () => {
  const cloak = { n: "Cloak of Armor", eff: { cloakArmor: 1 } };
  const c = fixedFighter({ items: [cloak], timers: liveCloakArmor() });
  const d = armorDisplay(c);
  assert.equal(d.magic, true);
  assert.equal(d.worn, false);
  assert.equal(d.ar, 15);
  assert.equal(d.sub, "AR 15 · magic plate, never wears");
  assert.equal(d.under, "under the cloak: nothing");
});

test("armorDisplay(c): the Cloak of Armor carried over a destroyed worn piece", () => {
  const cloak = { n: "Cloak of Armor", eff: { cloakArmor: 1 } };
  const c = fixedFighter({ armor: "Plate", ar: 15, armorWP: 0, armorMax: 45, items: [cloak], timers: liveCloakArmor() });
  const d = armorDisplay(c);
  assert.equal(d.under, "under the cloak: Plate, destroyed");
  assert.equal(d.destroyed, true);
});

// --- bagArmorText -------------------------------------------------------------

test("bagArmorText(it): full/partial/destroyed bag armor rows", () => {
  assert.equal(bagArmorText({ ar: 15, wp: 45, left: 45 }), "AR 15 · 45/45 hp");
  assert.equal(bagArmorText({ ar: 15, wp: 45 }), "AR 15 · 45/45 hp");
  assert.equal(bagArmorText({ ar: 15, wp: 45, left: 20 }), "AR 15 · 20/45 hp");
  assert.equal(bagArmorText({ ar: 15, wp: 45, left: 0 }), "AR 15 · destroyed");
});

// --- unit-token audit -----------------------------------------------------

test("no formatter string ever contains the old two-letter durability unit token", () => {
  const cloak = { n: "Cloak of Armor", eff: { cloakArmor: 1 } };
  const samples = [
    armorDisplay(fixedFighter()),
    armorDisplay(fixedFighter({ armor: "Plate", ar: 15, armorWP: 6, armorMax: 45 })),
    armorDisplay(fixedFighter({ armor: "Plate", ar: 15, armorWP: 0, armorMax: 45 })),
    armorDisplay(fixedFighter({ armor: "Leather", ar: 6, armorMin: 1, armorWP: 9, armorMax: 15, items: [cloak], timers: liveCloakArmor() })),
    armorDisplay(fixedFighter({ items: [cloak], timers: liveCloakArmor() })),
    armorDisplay(fixedFighter({ armor: "Plate", ar: 15, armorWP: 0, armorMax: 45, items: [cloak], timers: liveCloakArmor() })),
  ];
  for (const d of samples) {
    for (const key of ["label", "sub", "wornSub", "under", "line"]) {
      const v = d[key];
      if (typeof v === "string") assert.doesNotMatch(v, /\bwp\b/, `${key}: "${v}"`);
    }
  }
  assert.doesNotMatch(bagArmorText({ ar: 15, wp: 45, left: 20 }), /\bwp\b/);
});

// --- character sheet ARMOR stat --------------------------------------------

test("characterSheetViewModel(newRun(42)): ARMOR stat reads through the shared formatter", () => {
  const state = newRun(42);
  const vm = characterSheetViewModel(state);
  assert.equal(statByKey(vm, "armor").value, "STUDDED · AR 10 · 18/18 hp");
});

test("characterSheetViewModel(newRun(1)): a no-armor Fridgian reads NOTHING · AR 0", () => {
  const state = newRun(1);
  const vm = characterSheetViewModel(state);
  assert.equal(statByKey(vm, "armor").value, "NOTHING · AR 0");
});

// --- four-outcome toast copy ------------------------------------------------

test("LINE_FOR.armorSoaked: the four outcomes render distinct text", () => {
  const wearText = LINE_FOR.armorSoaked({ type: "armorSoaked", amount: 12, wear: 12 }).text;
  const underMinText = LINE_FOR.armorSoaked({ type: "armorSoaked", amount: 3, wear: 0, underMin: true }).text;
  const magicText = LINE_FOR.armorSoaked({ type: "armorSoaked", amount: 20, wear: 0, magic: true }).text;
  const halvedText = LINE_FOR.armorSoaked({ type: "armorSoaked", amount: 5, wear: 3, halved: true }).text;
  const destroyedText = LINE_FOR.armorDestroyed({ type: "armorDestroyed" }).text;

  assert.equal(wearText, "Armour takes 12 · wear 12");
  assert.equal(underMinText, "Armour shrugs off 3 · under its min, no wear");
  assert.equal(magicText, "The cloak's plate takes 20 · never wears");
  assert.equal(halvedText, "Armour takes 5 · wear 3 (Dwarven, halved)");
  assert.equal(destroyedText, "Your armour gives out.");

  const texts = [wearText, underMinText, magicText, halvedText, destroyedText];
  assert.equal(new Set(texts).size, texts.length, "all five texts must be pairwise distinct");
});

// --- four-outcome Oracle narration ------------------------------------------

test("EVENT_NARRATION.armorSoaked: the four outcomes narrate distinctly", () => {
  const underMinLine = EVENT_NARRATION.armorSoaked({ amount: 3, wear: 0, underMin: true, name: "Dante" });
  assert.match(underMinLine, /no wear/i);
  assert.match(underMinLine, /Dante/);

  const magicLine = EVENT_NARRATION.armorSoaked({ amount: 20, wear: 0, magic: true, name: "Dante" });
  assert.match(magicLine, /never wears/i);
  assert.match(magicLine, /cloak/i);

  const wearLine = EVENT_NARRATION.armorSoaked({ amount: 12, wear: 12, name: "Dante" });
  assert.match(wearLine, /costs the armour 12/);

  const bareLine = EVENT_NARRATION.armorSoaked({ type: "armorSoaked" });
  assert.equal(typeof bareLine, "string");
  assert.ok(bareLine.length > 0);
});

// --- destroyed-unequip narration --------------------------------------------

test("EVENT_NARRATION.itemUnequipped: a destroyed piece is narrated honestly", () => {
  const destroyedLine = EVENT_NARRATION.itemUnequipped({ item: { n: "Plate" }, slot: "armor", destroyed: true });
  assert.match(destroyedLine, /Plate/);
  assert.doesNotMatch(destroyedLine, /back in the bag/);

  const normalLine = EVENT_NARRATION.itemUnequipped({ item: { n: "Plate" }, slot: "armor" });
  assert.match(normalLine, /back in the bag/);
});

// --- Cloak of Armor item text ------------------------------------------------

test("CLOAKS: the Cloak of Armor's txt states the rule plainly", () => {
  const cloak = CLOAKS.find((k) => k.n === "Cloak of Armor");
  assert.ok(cloak, "expected a Cloak of Armor entry");
  // 260918-w4n: use-activated — the txt now states the activation duration
  // and cooldown, not a passive "always soaks" claim.
  assert.match(cloak.txt, /plate \(AR 15\)/);
  assert.match(cloak.txt, /fifty squares/);
});
