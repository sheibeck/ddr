// test/unit/cast-refusals.test.js
//
// CMB-02 (Phase 31, Plan 02) — the castSpell/scroll/sing refusal ladder:
// order (notFought -> noChargesLeft -> spellNotKnown -> spellAboveLevel ->
// spellSchoolLocked -> combatOnly), the dead-target retarget (mirrors
// playerStrike), sing's cooldown/wrongClass split, a combatOnly scroll cast
// outside combat, and the negative pin that an afraid caster/reader is NEVER
// refused for fear. Copies test/unit/magic.test.js's fakeRng/fixedState
// helpers verbatim (same discipline as afraid.test.js).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell, readScroll } from "../../engine/magic.js";
import { sing } from "../../engine/combat.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — verbatim copy of test/unit/magic.test.js's helper. */
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

function fixedWizard(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 31, wp: 31, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster", songAt: -999,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedWizard(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- guard-ladder order: notFought -> noChargesLeft -> spellNotKnown -> ---
// --- spellAboveLevel -> spellSchoolLocked -> combatOnly -------------------

test("castSpell ladder: zero charges reports noChargesLeft regardless of combatOnly", () => {
  const state = fixedState({ c: { grimoire: ["Doze"], spellsUsed: 4 } }); // maxCharges(lvl1) = 4
  const events = castSpell(state, SPELL_IDX.Doze, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "noChargesLeft"));
  assert.equal(events.some((e) => e.type === "castRefused"), false);
  assert.equal(state.c.spellsUsed, 4, "no charge consumed");
});

test("castSpell ladder: a KNOWN combatOnly spell above level reports spellAboveLevel, not combatOnly — even outside combat", () => {
  const state = fixedState({ c: { grimoire: ["Mangle"], level: 1 }, combat: null }); // Mangle is lvl 5, combatOnly:true
  const events = castSpell(state, SPELL_IDX.Mangle, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "spellAboveLevel" && e.spell === "Mangle"));
  assert.equal(events.some((e) => e.type === "castRefused"), false, "the diagnostic fires before the combatOnly guard is ever reached");
  assert.equal(state.c.spellsUsed, 0);
});

test("castSpell ladder: an UNKNOWN combatOnly spell outside combat reports spellNotKnown, not combatOnly", () => {
  const state = fixedState({ c: { grimoire: [] }, combat: null }); // Doze is combatOnly:true, but unknown
  const events = castSpell(state, SPELL_IDX.Doze, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "spellNotKnown" && e.spell === "Doze"));
  assert.equal(events.some((e) => e.type === "castRefused"), false);
});

test("castSpell ladder: a school the subclass may not yet work is refused spellSchoolLocked, not combatOnly, even outside combat", () => {
  // Sorcerer's healing school is gated to skill level 4 (MU_CHART) — Heal
  // itself is NOT combatOnly, so this pins the ladder position rather than
  // a combatOnly interaction, but confirms the diagnostics still precede it.
  const state = fixedState({ c: { sub: "Sorcerer", grimoire: ["Heal"], level: 1 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "spellSchoolLocked"));
  assert.equal(events.some((e) => e.type === "castRefused"), false);
});

test("castSpell ladder: a combatOnly spell that clears every diagnostic finally hits combatOnly outside combat", () => {
  const state = fixedState({ c: { grimoire: ["Doze"], level: 1 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Doze, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "castRefused" && e.spell === "Doze" && e.reason === "combatOnly"));
  assert.equal(state.c.spellsUsed, 0, "no charge consumed");
});

// --- the dead-target retarget (mirrors playerStrike) ------------------------

test("castSpell retargets off a dead C.target onto the first live foe, mirroring playerStrike — noTarget is unreachable in combat", () => {
  const dead = fixedFoe({ name: "Corpse", alive: false, wp: 0 });
  const alive = fixedFoe({ name: "Survivor", wp: 20, maxWP: 20 });
  const state = fixedState({ c: { grimoire: ["Acid"], level: 2 } });
  state.combat = fixedCombat([dead, alive], { target: 0 }); // target points at the corpse
  // Acid: rounds d6=3; the SAME foeTurn tail ticks the freshly-applied acid
  // (2d6+2=4 dmg, well short of Survivor's 20 wp) before its own swing
  // misses (roll 20 vs need 5); no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Acid, fakeRng([3, 1, 1, 20]), []);
  assert.equal(state.combat.target, 1, "C.target retargeted to the live foe's index");
  assert.ok(events.some((e) => e.type === "acidApplied" && e.target === "Survivor"));
  assert.equal(events.some((e) => e.type === "nothingToThrowAt"), false);
});

// --- sing: cooldown/wrongClass split (mirrors CMB-02's actionRefused vocab) -

test("sing: a non-Bard is refused wrongClass, zero draws", () => {
  const state = fixedState({ c: { sub: "Wizard" } }); // any non-Bard
  state.combat = fixedCombat([fixedFoe()]);
  const events = sing(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "actionRefused" && e.action === "sing" && e.reason === "wrongClass"));
  assert.equal("left" in events.find((e) => e.type === "actionRefused"), false);
});

test("sing: a Bard still cooling down is refused cooldown with a positive integer left", () => {
  const state = fixedState({ c: { sub: "Bard", level: 1, songAt: 0 } });
  state.steps = 0; // steps - songAt = 0 -> 100 squares left
  state.combat = fixedCombat([fixedFoe()]);
  const events = sing(state, fakeRng([]), []);
  const refusal = events.find((e) => e.type === "actionRefused" && e.action === "sing");
  assert.ok(refusal);
  assert.equal(refusal.reason, "cooldown");
  assert.equal(refusal.left, 100);
  assert.ok(Number.isInteger(refusal.left) && refusal.left > 0);
});

test("sing: a ready Bard sings normally (sang, not actionRefused)", () => {
  const state = fixedState({ c: { sub: "Bard", level: 1, songAt: -999 } });
  state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { type: "Beasts" });
  const events = sing(state, fakeRng([]), []); // level-1 song has no further draws (Beasts-soothed branch)
  assert.ok(events.some((e) => e.type === "sang"));
  assert.equal(events.some((e) => e.type === "actionRefused"), false);
});

// --- a combatOnly scroll cast outside combat --------------------------------

test("readScroll: a scroll that unrolls a combatOnly spell outside combat is consumed and refused combatOnly — spellsUsed restored", () => {
  // A non-Magic-User Runes/Signs reader forces the scrollCast path (skips
  // the free grimoire-copy shortcut, which only fires for cls==="Magic User").
  const state = fixedState({
    c: { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 }, scrolls: 1, grimoire: [], spellsUsed: 1 },
  });
  const doze = SPELLS.find((sp) => sp.n === "Doze");
  const events = readScroll(state, fakeRng([], { pick: (arr) => arr.find((sp) => sp.n === "Doze") ?? arr[0] }), []);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.spell === "Doze"));
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Doze"));
  assert.ok(events.some((e) => e.type === "castRefused" && e.spell === "Doze" && e.reason === "combatOnly"));
  assert.equal(state.c.scrolls, 0, "the scroll is still consumed");
  assert.equal(state.c.spellsUsed, 1, "spellsUsed restored to its pre-scroll value, not left at castSpell's temporary 0");
  assert.equal(doze.combatOnly, true, "sanity: Doze really is combatOnly");
});

// --- Phase 40 (SPELL-07): the scroll scribe-gate refusal --------------------

test("readScroll: a scroll's spell not yet gated in scribes nothing — scrollTooAdvanced names the level, then still casts for free", () => {
  // Warlock: healing gated to 3; Heal is lvl 1 healing — spellLevelFor(1) <=
  // level(1), but level(1) < schoolGate(3), so it is NOT scribed.
  const state = fixedState({ c: { sub: "Warlock", level: 1, grimoire: [], scrolls: 1, wp: 10, maxWP: 40 } });
  const events = readScroll(state, fakeRng([6], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.ok(events.some((e) => e.type === "scrollTooAdvanced" && e.spell === "Heal" && e.need === 3 && e.have === 1 && e.school === "healing"));
  assert.equal(events.some((e) => e.type === "scrollCopiedToGrimoire"), false);
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Heal"));
  assert.equal(state.c.grimoire.includes("Heal"), false);
});

// --- negative pin: an afraid caster/reader is NEVER refused for fear -------

test("negative pin: with combat.afraid = 2, castSpell (thrown) and readScroll both proceed — no castRefused/scrollRefused for fear", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999 });

  const castState = fixedState({ c: { sub: "Illusionist", level: 3, grimoire: ["Fireball"] } });
  castState.combat = fixedCombat([foe], { afraid: 2 });
  // roll d8=4 (need shrinks to 1, misses); tail: foe miss(7) — no
  // round-advance draws, initiative is rolled once, Phase 51.
  const castEvents = castSpell(castState, SPELL_IDX.Fireball, fakeRng([4, 7]), []);
  assert.ok(castEvents.some((e) => e.type === "spellThrown"));
  assert.equal(castEvents.some((e) => e.type === "castRefused"), false);

  const scrollFoe = fixedFoe({ wp: 999, maxWP: 999 });
  const scrollState = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 }, scrolls: 1, grimoire: [] } });
  scrollState.combat = fixedCombat([scrollFoe], { afraid: 2 });
  // rng.pick returns Heal (lvl1); heal die d10=8; tail: foe miss(7) — no
  // round-advance draws, initiative is rolled once, Phase 51.
  const scrollEvents = readScroll(scrollState, fakeRng([8, 7]), []);
  assert.equal(scrollEvents.some((e) => e.type === "scrollRefused"), false);
  assert.ok(scrollEvents.some((e) => e.type === "healed"));
});
