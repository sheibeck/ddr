// test/unit/special-timed-spells.test.js
//
// Phase 90 plan 07 (SPELL-10, the Special spells that buff and travel; user
// 2026-09-30: "Accepted as drafted" for 90-SPELL-SLATE-DRAFT.md): Open/Lock
// (level 1), Fly (2), Enchant Character (4) and Speed of Sound (5), built on
// 90-03's spell-sourced timed effect (an `act` record on the SPELLS row, one
// `spell:<name>` squares record, read back through derived.js#liveItemEffects),
// stretched by the caster's school bonus (Q6 A: +10 squares per point on a
// square-timed spell), gated by the school chart with no extra code.
//
// Edge probes (fallback SPELL-10), where each lives:
//   adjacency ... "adjacency: Fly and a live Cloak of Flying are two records ...",
//                 "adjacency: Speed of Sound with a Speed potion ...",
//                 "adjacency: Enchant Character and a Cloak of Strength ..."
//   empty ....... "empty: an Open/Lock window that meets no chest fades ...",
//                 "empty: Fly cast in a fight ...", "empty: Speed of Sound whose
//                 window holds no fight just fades"
//   ordering .... "ordering: the four rows are appended after Death ...",
//                 "ordering: a recast overwrites the record in place ..."

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { openChest } from "../../engine/encounters.js";
import { playerStrike, foeTurn, resolveInitiative } from "../../engine/combat.js";
import { move } from "../../engine/movement.js";
import { applyAction } from "../../engine/engine.js";
import { tickSquares, startEffect } from "../../engine/effects.js";
import { useItem, unequipSlot, narrateTimerTransitions } from "../../engine/items.js";
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import {
  SCHOOL_STRETCH_SQUARES, spellEffectSquares, spellEffectRounds, SPELL_ACT_OF, SPELL_SELF_KINDS,
  toHit, foeToHitVs, critWardOf, eff, isFlying, moveCost, canCast, conditionsOf, liveItemEffects, itemEffectActive,
} from "../../engine/derived.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS, NICHE_LABELS, SCROLL_FUMBLE, FUMBLE_EFFECTS } from "../../content/index.js";
import { MU_CHART } from "../../content/mu-chart.js";
import { GW, GH } from "../../engine/maze.js";
import { resolveStep } from "../../src/browser/tapStep.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const ROW = (n) => SPELLS.find((sp) => sp.n === n);
const NEW_FOUR = ["Open/Lock", "Fly", "Enchant Character", "Speed of Sound"];

/** mkRng(seq) — `.d()` pops the next scripted value; throws on underflow, so an
 * exhausted script doubles as a "no further draw" assertion. */
function mkRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`mkRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    getState: () => 0,
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    get draws() {
      return i;
    },
  };
}

/** recordingRng(seed) — the real stream, logging the sides of every d() call. */
function recordingRng(seed) {
  const real = makeRng(seed);
  const sides = [];
  return {
    ...real,
    d(n) {
      sides.push(n);
      return real.d(n);
    },
    sides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 5, py: 5, depth: 1 };
}

function fixedHero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0, intel: 10,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

/** fixedCaster(sub) — a level-5 Magic User of `sub` whose book holds the four. */
function fixedCaster(sub = "Wizard", overrides = {}) {
  return fixedHero({
    cls: "Magic User", sub, level: 5, maxWP: 60, wp: 60, weapon: "Dagger", potions: 2, scrolls: 1,
    grimoire: [...NEW_FOUR], ...overrides,
  });
}

function fixedState(c, rest = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c,
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Wolf", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 500, maxWP: 500, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const cast = (state, name, events = []) => {
  castSpell(state, SPELL_IDX[name], mkRng([]), events);
  return events;
};
const startedOf = (events) => events.filter((e) => e.type === "spellEffectStarted");

// --- the rows -----------------------------------------------------------------

test("ordering: the four rows are appended after Death, in the ruled order, with the ruled fields", () => {
  assert.deepEqual(SPELLS.slice(-4).map((sp) => sp.n), NEW_FOUR);
  assert.equal(SPELLS[SPELLS.length - 5].n, "Death", "no earlier row moved");
  const want = [
    ["Open/Lock", 1, "unlock", 100, "utility"],
    ["Fly", 2, "fly", 30, "utility"],
    ["Enchant Character", 4, "enchant", 50, "buff"],
    ["Speed of Sound", 5, "haste", 50, "buff"],
  ];
  for (const [n, lvl, kind, effect, niche] of want) {
    const sp = ROW(n);
    assert.equal(sp.lvl, lvl, `${n} level`);
    assert.equal(sp.s, "special", `${n} school`);
    assert.equal(sp.kind, "timed", `${n} kind`);
    assert.equal(sp.act.kind, kind, `${n} act kind`);
    assert.equal(sp.act.effect, effect, `${n} window`);
    assert.equal(sp.stretch, "squares", `${n} stretch`);
    assert.equal(sp.roll, "derived", `${n} roll`);
    assert.equal(sp.combatOnly, false, `${n} is usable anywhere`);
    assert.equal(sp.niche, niche);
    assert.ok(sp.txt.startsWith(NICHE_LABELS[niche] + " · "), `${n} txt starts with its niche label`);
    assert.match(sp.txt, /\+10 squares per school bonus point/, `${n} states the school stretch (Q6 A)`);
    assert.equal(SPELL_ACT_OF[n], sp.act, `${n} is a spell-sourced timed effect`);
  }
  assert.deepEqual(ROW("Enchant Character").act.eff, { toHit: 2, foeToHit: -2, critWard: 1 });
  assert.deepEqual(ROW("Speed of Sound").act.eff, { first: 1 });
  assert.equal(NICHE_LABELS.utility, "utility");
  assert.ok(SPELL_SELF_KINDS.has("timed"), "a timed self spell is never resisted");
});

// --- the school stretch (Q6 A) --------------------------------------------------

test("stretch: each school bonus point adds the ruled 10 squares to the base window", () => {
  assert.equal(SCHOOL_STRETCH_SQUARES, 10);
  const fly = ROW("Fly");
  assert.equal(spellEffectSquares("Wizard", fly), 30, "+0");
  assert.equal(spellEffectSquares("Apprentice", fly), 30, "+0");
  assert.equal(spellEffectSquares("Sorcerer", fly), 40, "+1");
  assert.equal(spellEffectSquares("Summoner", fly), 40, "+1");
  assert.equal(spellEffectSquares("Illusionist", fly), 70, "+4");
  assert.equal(spellEffectSquares("Illusionist", ROW("Open/Lock")), 140);
  assert.equal(spellEffectSquares("Illusionist", ROW("Enchant Character")), 90);
  assert.equal(spellEffectSquares("Illusionist", ROW("Speed of Sound")), 90);
  assert.equal(spellEffectSquares("Knight", fly), 30, "a free scroll cast by a non-Magic-User gets the base");
  assert.equal(MU_CHART.Illusionist.special, 4);
});

test("stretch: a round-timed spell is stretched by +1 round a point, a square-timed one is not", () => {
  const roundTimed = { n: "Probe", s: "special", stretch: "rounds", act: { effect: 3 } };
  assert.equal(spellEffectRounds("Illusionist", roundTimed, 3), 7);
  assert.equal(spellEffectRounds("Sorcerer", roundTimed, 3), 4);
  assert.equal(spellEffectRounds("Wizard", roundTimed, 3), 3);
  assert.equal(spellEffectRounds("Illusionist", ROW("Fly"), 3), 3, "a squares-stretched spell leaves rounds alone");
  assert.equal(spellEffectSquares("Illusionist", roundTimed), 3, "a rounds-stretched spell leaves squares alone");
});

test("stretch: casting stretches the record and the event, per sub-class", () => {
  for (const [sub, want] of [["Wizard", 30], ["Sorcerer", 40], ["Illusionist", 70]]) {
    const state = fixedState(fixedCaster(sub));
    const events = cast(state, "Fly");
    assert.equal(state.c.timers["spell:Fly"].left, want, sub);
    assert.deepEqual(startedOf(events), [{ type: "spellEffectStarted", spell: "Fly", kind: "fly", squares: want, restarted: false }], sub);
    assert.equal(state.c.spellsUsed, 1);
  }
});

test("gates: the four obey the school chart with no extra code", () => {
  for (const sub of ["Wizard", "Sorcerer", "Illusionist", "Summoner", "Apprentice"]) {
    const state = fixedState(fixedCaster(sub));
    for (const n of NEW_FOUR) assert.equal(canCast(state, ROW(n)), true, `${sub} casts ${n}`);
  }
  for (const sub of ["Warlock", "Court Mage", "Cleric"]) {
    assert.equal(MU_CHART[sub].special, null, `${sub} has no Special school`);
    const state = fixedState(fixedCaster(sub));
    for (const n of NEW_FOUR) assert.equal(canCast(state, ROW(n)), false, `${sub} never casts ${n}`);
  }
});

// --- Open/Lock ---------------------------------------------------------------

test("Open/Lock: the next chest opens with no lock roll and no lock draw, and spends the spell", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Open/Lock");
  assert.deepEqual(state.c.timers["spell:Open/Lock"], { cadence: "squares", left: 100, phase: "effect" });
  const rng = recordingRng(7);
  const events = openChest(state, rng, []);
  assert.equal(events.some((e) => e.type === "chestLockRolled"), false, "no lock roll event");
  assert.deepEqual(events.filter((e) => e.type === "chestOpened"), [{ type: "chestOpened", reason: "openLock" }]);
  assert.equal(rng.sides[0], 10, "the first draw is the gold d10: no lock d20 or d10 before it");
  assert.equal("spell:Open/Lock" in state.c.timers, false, "the spell is spent on that chest");
  // The same hero with no spell rolls the bare d20 lock first.
  const bare = fixedState(fixedCaster("Wizard"));
  const bareRng = recordingRng(7);
  const bareEvents = openChest(bare, bareRng, []);
  assert.equal(bareRng.sides[0], 20);
  assert.ok(bareEvents.some((e) => e.type === "chestLockRolled"));
});

test("Open/Lock: it opens any class's chest, lockpicks or none", () => {
  for (const c of [fixedHero({ cls: "Fighter", sub: "Knight" }), fixedHero({ cls: "Thief", sub: "Cat Burglar", items: [{ kind: "tool", tool: "lockpicks", n: "Lockpicks" }] })]) {
    const state = fixedState(c);
    startEffect(state.c, "spell:Open/Lock", { squares: 100 });
    const rng = recordingRng(3);
    const events = openChest(state, rng, []);
    assert.equal(events.some((e) => e.type === "chestLockRolled"), false, c.sub);
    assert.ok(events.some((e) => e.type === "chestOpened" && e.reason === "openLock"), c.sub);
    assert.equal(rng.sides[0], 10, c.sub);
  }
});

test("Open/Lock: a Pilfer's free open never spends it", () => {
  const state = fixedState(fixedHero({ cls: "Thief", sub: "Pilfer" }));
  startEffect(state.c, "spell:Open/Lock", { squares: 100 });
  const events = openChest(state, recordingRng(5), []);
  assert.deepEqual(events.filter((e) => e.type === "chestOpened"), [{ type: "chestOpened", reason: "pilfer" }]);
  assert.deepEqual(state.c.timers["spell:Open/Lock"], { cadence: "squares", left: 100, phase: "effect" }, "the record is still there");
});

test("Open/Lock: walking onto a chest through the real step opens it with no lock roll", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Open/Lock");
  state.floor.g[4][5] = { wall: false, dark: false, seen: true, feat: "chest" };
  const events = move(state, "N", makeRng(11), []);
  assert.equal(events.some((e) => e.type === "chestLockRolled"), false);
  assert.ok(events.some((e) => e.type === "chestOpened" && e.reason === "openLock"));
  assert.equal(Object.keys(state.c.timers || {}).includes("spell:Open/Lock"), false);
});

test("Open/Lock: recasting restarts the window and never stacks; it fades with its line when no chest comes", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Open/Lock");
  tickSquares(state.c, 40);
  assert.equal(state.c.timers["spell:Open/Lock"].left, 60);
  const events = cast(state, "Open/Lock");
  assert.deepEqual(startedOf(events), [{ type: "spellEffectStarted", spell: "Open/Lock", kind: "unlock", squares: 100, restarted: true }]);
  assert.equal(state.c.timers["spell:Open/Lock"].left, 100);
  assert.deepEqual(Object.keys(state.c.timers), ["spell:Open/Lock"]);
  const trans = tickSquares(state.c, 100);
  const told = [];
  narrateTimerTransitions(state.c, trans, told);
  assert.deepEqual(told, [{ type: "spellEffectFaded", spell: "Open/Lock", kind: "unlock" }]);
  assert.equal(itemEffectActive(state.c, "unlock"), false);
});

test("empty: an Open/Lock window that meets no chest fades, and the next chest rolls the lock as ever", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Open/Lock");
  tickSquares(state.c, 100);
  const events = openChest(state, recordingRng(9), []);
  assert.ok(events.some((e) => e.type === "chestLockRolled"));
});

// --- Fly ------------------------------------------------------------------------

test("Fly: a flying hero reads isFlying and pays one square for water, with no item", () => {
  const state = fixedState(fixedCaster("Wizard"));
  state.floor.g[4][5].water = true;
  assert.equal(isFlying(state), false);
  assert.equal(moveCost(state, state.floor.g[4][5]), 2);
  cast(state, "Fly");
  assert.equal(isFlying(state), true);
  assert.equal(moveCost(state, state.floor.g[4][5]), 1);
});

for (const feat of ["climb", "gorge"]) {
  test(`Fly: ${feat} is flown over with no roll when the arrow pad dispatches a move`, () => {
    const state = fixedState(fixedCaster("Wizard"));
    cast(state, "Fly");
    state.floor.g[4][5].feat = feat;
    const { state: after, events } = applyAction(state, { type: "move", dir: "N" });
    assert.ok(events.some((e) => e.type === "flownOver"), "flown over");
    assert.equal(events.some((e) => ["hazardChoice", "climbedOver", "leaptOver", "fellClimbing", "fellInGorge", "draggedOver"].includes(e.type)), false, "no card, no roll");
    assert.equal(after.pendingHazard ?? null, null);
    assert.deepEqual([after.floor.px, after.floor.py], [5, 4]);
  });

  test(`Fly: ${feat} is flown over with no roll when a tap past it steps the same move`, () => {
    const state = fixedState(fixedCaster("Wizard"));
    cast(state, "Fly");
    state.floor.g[4][5].feat = feat;
    const g = state.floor.g;
    const isOpen = (x, y) => !!(g[y] && g[y][x] && !g[y][x].wall);
    const step = resolveStep({ x: state.floor.px, y: state.floor.py }, { x: 5, y: 1 }, isOpen);
    assert.equal(step.kind, "step");
    assert.equal(step.dir, "N");
    const { state: after, events } = applyAction(state, { type: "move", dir: step.dir });
    assert.ok(events.some((e) => e.type === "flownOver"));
    assert.equal(events.some((e) => e.type === "hazardChoice"), false);
    assert.deepEqual([after.floor.px, after.floor.py], [5, 4]);
  });
}

test("Fly: without the spell the same step still pauses on the decision card (the control)", () => {
  const state = fixedState(fixedCaster("Wizard"));
  state.floor.g[4][5].feat = "climb";
  const { events } = applyAction(state, { type: "move", dir: "N" });
  assert.ok(events.some((e) => e.type === "hazardChoice"));
});

test("Fly: the flight ends after its squares and the line says so", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Fly");
  const trans = tickSquares(state.c, 30);
  const told = [];
  narrateTimerTransitions(state.c, trans, told);
  assert.deepEqual(told, [{ type: "spellEffectFaded", spell: "Fly", kind: "fly" }]);
  assert.equal(isFlying(state), false);
});

test("empty: Fly cast in a fight starts its record, costs the charge and changes nothing in the fight", () => {
  const state = fixedState(fixedCaster("Wizard"), { combat: fixedCombat([fixedFoe()]) });
  const before = JSON.stringify(state.combat.foes);
  const events = [];
  castSpell(state, SPELL_IDX.Fly, mkRng([1, 1, 1, 1, 1, 1]), events);
  assert.equal(state.c.spellsUsed, 1, "the charge is spent");
  assert.ok(state.c.timers["spell:Fly"], "the record starts");
  assert.equal(startedOf(events).length, 1);
  assert.equal(JSON.stringify(state.combat.foes[0].alive), "true");
  assert.equal(state.combat.foes[0].wp, JSON.parse(before)[0].wp, "the foe is untouched");
});

test("adjacency: Fly and a live Cloak of Flying are two records; taking the cloak off ends only the item record", () => {
  const cloak = { kind: "cloak", n: "Cloak of Flying", txt: "" };
  const state = fixedState(fixedCaster("Wizard", { worn: { cloak } }));
  assert.ok(useItem(state, { slot: "cloak" }, mkRng([]), []).some((e) => e.type === "itemEffectStarted"));
  cast(state, "Fly");
  assert.deepEqual(Object.keys(state.c.timers).filter((id) => id.startsWith("item:") || id.startsWith("spell:")).sort(), ["item:Cloak of Flying", "spell:Fly"]);
  unequipSlot(state, "cloak", [], mkRng([]));
  assert.equal("item:Cloak of Flying" in state.c.timers && state.c.timers["item:Cloak of Flying"].phase === "effect", false, "the item record is gone from the live effects");
  assert.equal(isFlying(state), true, "the hero keeps flying on the spell");
  assert.equal(state.c.timers["spell:Fly"].left, 30);
});

// --- Enchant Character ------------------------------------------------------------

test("Enchant Character: +2 to hit, foes -2 to hit you, and crits are warded, named for the spell", () => {
  const state = fixedState(fixedCaster("Wizard"));
  const hitBefore = toHit(state);
  const foeBefore = foeToHitVs(state);
  assert.equal(critWardOf(state.c), null);
  cast(state, "Enchant Character");
  assert.equal(toHit(state), hitBefore + 2);
  assert.equal(foeToHitVs(state), foeBefore - 2);
  assert.equal(critWardOf(state.c), "Enchant Character");
  assert.equal(eff(state.c, "toHit"), 2);
  assert.equal(eff(state.c, "foeToHit"), -2);
});

test("Enchant Character: a foe's top-face roll against you is an ordinary hit", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Enchant Character");
  state.combat = fixedCombat([fixedFoe({ lvl: 5 })]);
  const events = foeTurn(state, mkRng([1, 6]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.critical, false);
  assert.ok(events.some((e) => e.type === "critWarded" && e.item === "Enchant Character"));
});

test("adjacency: Enchant Character and a Cloak of Strength both ward crits, and either alone does", () => {
  const cloak = { kind: "cloak", n: "Cloak of Strength", eff: { critWard: 1 }, txt: "" };
  const both = fixedState(fixedCaster("Wizard", { worn: { cloak } }));
  useItem(both, { slot: "cloak" }, mkRng([]), []);
  assert.equal(critWardOf(both.c), "Cloak of Strength");
  cast(both, "Enchant Character");
  assert.ok(critWardOf(both.c), "warded");
  unequipSlot(both, "cloak", [], mkRng([]));
  assert.equal(critWardOf(both.c), "Enchant Character", "the spell alone still wards");
  const cloakOnly = fixedState(fixedCaster("Wizard", { worn: { cloak } }));
  useItem(cloakOnly, { slot: "cloak" }, mkRng([]), []);
  assert.equal(critWardOf(cloakOnly.c), "Cloak of Strength", "the cloak alone still wards");
});

// --- Speed of Sound ----------------------------------------------------------------

test("Speed of Sound: two blows every time you swing", () => {
  const blows = (state) => {
    state.combat = fixedCombat([fixedFoe()]);
    const events = [];
    playerStrike(state, mkRng(new Array(40).fill(1)), events); // raw 1 is the die's best face (roll-high)
    return events.filter((e) => e.type === "struck").length;
  };
  const plain = fixedState(fixedCaster("Wizard"));
  const fast = fixedState(fixedCaster("Wizard"));
  cast(fast, "Speed of Sound");
  assert.equal(blows(plain), 1);
  assert.equal(blows(fast), 2);
});

test("Speed of Sound: you act first in every fight it covers, beating every forced foe-first rule", () => {
  const withSpeed = (c, foe = fixedFoe()) => {
    const state = fixedState(c, { combat: fixedCombat([foe]) });
    startEffect(state.c, "spell:Speed of Sound", { squares: 50 });
    return state;
  };
  // The foe rolls 20, mine is 1: the dice alone would give the foe the first blow.
  const dice = [1, 20];
  for (const [label, c, foe] of [
    ["Samurai", fixedHero({ sub: "Samurai", level: 5 }), fixedFoe()],
    ["Wizard", fixedCaster("Wizard"), fixedFoe()],
    ["Knight facing a big foe", fixedHero({ sub: "Knight", level: 5 }), fixedFoe({ maxWP: 40 })],
    ["Court Mage", fixedCaster("Court Mage"), fixedFoe()],
  ]) {
    const res = resolveInitiative(withSpeed(c, foe), mkRng(dice));
    assert.equal(res.first, "you", label);
    assert.equal(res.why, "speed", label);
  }
  // The controls: no spell, the same hero loses the same dice.
  for (const [label, c, foe] of [
    ["Samurai", fixedHero({ sub: "Samurai", level: 5 }), fixedFoe()],
    ["Wizard", fixedCaster("Wizard"), fixedFoe()],
    ["Knight facing a big foe", fixedHero({ sub: "Knight", level: 5 }), fixedFoe({ maxWP: 40 })],
  ]) {
    const state = fixedState(c, { combat: fixedCombat([foe]) });
    assert.equal(resolveInitiative(state, mkRng(dice)).first, "foe", "the control: " + label);
  }
});

test("Speed of Sound: foresight still names its own reason first, and the two d20s are drawn either way", () => {
  const state = fixedState(fixedCaster("Wizard", { foresight: true }), { combat: fixedCombat([fixedFoe()]) });
  startEffect(state.c, "spell:Speed of Sound", { squares: 50 });
  const rng = mkRng([1, 20]);
  assert.equal(resolveInitiative(state, rng).why, "foreseen");
  assert.equal(rng.draws, 2, "the initiative dice are still both drawn");
});

test("adjacency: Speed of Sound with a Speed potion still gives two blows, not three", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Speed of Sound");
  startEffect(state.c, "item:Speed", { squares: 50 });
  const hasted = liveItemEffects(state.c).filter((e) => e.act.kind === "haste");
  assert.equal(hasted.length, 2, "two haste records");
  state.combat = fixedCombat([fixedFoe()]);
  const events = [];
  playerStrike(state, mkRng(new Array(60).fill(1)), events);
  assert.equal(events.filter((e) => e.type === "struck").length, 2, "the second haste source adds no third blow");
});

test("empty: Speed of Sound whose window holds no fight just fades", () => {
  const state = fixedState(fixedCaster("Wizard"));
  cast(state, "Speed of Sound");
  const trans = tickSquares(state.c, 50);
  const told = [];
  narrateTimerTransitions(state.c, trans, told);
  assert.deepEqual(told, [{ type: "spellEffectFaded", spell: "Speed of Sound", kind: "haste" }]);
});

// --- recast and ordering ---------------------------------------------------------

test("recast: each of the four restarts to its full stretched window with one record, in place", () => {
  for (const [sub, windows] of [["Wizard", [100, 30, 50, 50]], ["Illusionist", [140, 70, 90, 90]]]) {
    const state = fixedState(fixedCaster(sub));
    for (const n of NEW_FOUR) cast(state, n);
    const order = Object.keys(state.c.timers);
    assert.deepEqual(order, NEW_FOUR.map((n) => "spell:" + n), "records start in cast order");
    tickSquares(state.c, 10);
    NEW_FOUR.forEach((n, i) => assert.equal(state.c.timers["spell:" + n].left, windows[i] - 10, `${sub} ${n} ticked`));
    for (const n of NEW_FOUR) {
      const events = cast(state, n);
      assert.equal(startedOf(events)[0].restarted, true, `${sub} ${n} restarted`);
    }
    NEW_FOUR.forEach((n, i) => assert.equal(state.c.timers["spell:" + n].left, windows[i], `${sub} ${n} full again`));
    assert.deepEqual(Object.keys(state.c.timers), order, "ordering: a recast overwrites the record in place, so chips keep their order");
  }
});

test("chips: the live spell effects name the spell and its squares left", () => {
  const state = fixedState(fixedCaster("Wizard"));
  for (const n of NEW_FOUR) cast(state, n);
  const chips = conditionsOf(state);
  const by = (key) => chips.filter((cn) => cn.key === key);
  assert.deepEqual(by("unlock").map((cn) => [cn.source, cn.remaining]), [["Open/Lock", 100]]);
  assert.deepEqual(by("flight").map((cn) => [cn.source, cn.remaining]), [["Fly", 30]]);
  assert.deepEqual(by("enchant").map((cn) => [cn.source, cn.remaining]), [["Enchant Character", 50]]);
  assert.deepEqual(by("haste").map((cn) => [cn.source, cn.remaining]), [["Speed of Sound", 50]]);
});

// --- scrolls and fumbles -----------------------------------------------------------

test("fumbles: every one of the four has a scroll fumble row; Speed of Sound frenzies the foe, the rest are wasted", () => {
  for (const n of NEW_FOUR) assert.ok(SCROLL_FUMBLE[n], `${n} has a row`);
  for (const n of ["Open/Lock", "Fly", "Enchant Character"]) assert.deepEqual({ ...SCROLL_FUMBLE[n] }, { side: "helpful", effect: "wasted" }, n);
  assert.deepEqual({ ...SCROLL_FUMBLE["Speed of Sound"] }, { side: "helpful", effect: "frenzy" });
  assert.ok(FUMBLE_EFFECTS.helpful.includes("frenzy"));
});

test("fumbles: a fumbled Speed of Sound makes the target foe swing twice a turn; the others only waste the scroll", () => {
  const state = fixedState(fixedCaster("Wizard"), { combat: fixedCombat([fixedFoe(), fixedFoe({ name: "Rat" })]) });
  const events = [];
  resolveScrollFumble(state, ROW("Speed of Sound"), mkRng([1, 1, 1, 1]), mkRng([1, 1, 1, 1]), events, Date.now);
  assert.equal(state.combat.foes[0].frenzied, true, "the target foe is frenzied");
  assert.ok(events.some((e) => e.type === "fumbleOnFoe" && e.effect === "frenzy"));
  for (const n of ["Open/Lock", "Fly", "Enchant Character"]) {
    const s = fixedState(fixedCaster("Wizard"), { combat: fixedCombat([fixedFoe()]) });
    const ev = [];
    resolveScrollFumble(s, ROW(n), mkRng([1, 1, 1, 1]), mkRng([1, 1, 1, 1]), ev, Date.now);
    assert.equal(s.combat.foes[0].frenzied, undefined, `${n} does nothing to the foe`);
    assert.ok(ev.some((e) => e.type === "fumbleOnFoe" && e.effect === "wasted"), `${n} is wasted`);
  }
});

test("scroll pool: every depth band holds the new Special spells whose level is allowed there", () => {
  for (const [depth, expected] of [[1, ["Open/Lock", "Fly"]], [2, ["Open/Lock", "Fly"]], [3, ["Open/Lock", "Fly", "Enchant Character"]], [4, NEW_FOUR], [8, NEW_FOUR]]) {
    const state = fixedState(fixedCaster("Wizard", { scrolls: 1, grimoire: [] }));
    state.floor.depth = depth;
    let pool = null;
    const rng = { ...mkRng([]), pick(arr) { pool = arr; return arr[0]; } };
    readScroll(state, rng, [], Date.now);
    assert.ok(pool, `depth ${depth}: the scroll rolled from a pool`);
    const names = new Set(pool.map((sp) => sp.n));
    for (const n of expected) assert.ok(names.has(n), `depth ${depth}: the scroll pool holds ${n}`);
    for (const n of NEW_FOUR) if (!expected.includes(n)) assert.equal(names.has(n), false, `depth ${depth}: ${n} is above this band`);
  }
});
