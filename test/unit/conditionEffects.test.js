// test/unit/conditionEffects.test.js
//
// Phase 74 (ROLL-02/03), plan 74-07 — coverage for
// src/browser/conditionEffects.js: the hero condition chip's effect
// sentence, measured against the engine's own derived functions (never a
// restated formula) and formatted only through src/browser/rollRange.js.
//
// fixedFighter/fixedFloor/fixedState/fixedFoe mirror
// test/unit/rollOdds.test.js's own fixtures verbatim (this repo's
// established per-file-fixture convention — never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { conditionEffectText, WHAT_IF, CONDITION_EFFECT_COPY } from "../../src/browser/conditionEffects.js";
import { startEffect } from "../../engine/effects.js";
import { toHit, afraidNeed, strikeDie, foeToHitVs } from "../../engine/derived.js";

// ─── fixed* helpers, mirroring test/unit/rollOdds.test.js verbatim ────────

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

// ─── module surface ─────────────────────────────────────────────────────

test("CONDITION_EFFECT_COPY/WHAT_IF are frozen", () => {
  assert.equal(Object.isFrozen(CONDITION_EFFECT_COPY), true);
  assert.equal(Object.isFrozen(WHAT_IF), true);
});

// ─── afraid ──────────────────────────────────────────────────────────────
//
// CMBUI-13 (Phase 77, plan 77-03): every to-hit lead in this file was
// re-pinned from Phase 74's "(now 19–20)" to CONTEXT's Dazed honesty shape
// "(19–20 instead of 16–20)" — the live range, then the range without the
// effect, both read through heroHitOdds (live and what-if). The deltas are
// unchanged; only the parenthesis gained the what-if range.

test("afraid: a level-1 Human Fighter reads the Afraid penalty against the engine's own faces", () => {
  const state = fixedState({ combat: { afraid: 2 } });
  const text = conditionEffectText({ key: "afraid", remaining: 2 }, state);
  assert.equal(text, "−3 to hit (19–20 instead of 16–20)");

  // Prove it against the engine directly, not a hardcoded expectation.
  const whatIf = { ...state, combat: { ...state.combat, afraid: 0 } };
  const liveFaces = afraidNeed(state, toHit(state));
  const whatIfFaces = afraidNeed(whatIf, toHit(whatIf));
  assert.equal(liveFaces, 2);
  assert.equal(whatIfFaces, 5);
});

test("afraid: a level-1 Human Magic User reads a single-face range", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard" }, combat: { afraid: 2 } });
  assert.equal(conditionEffectText({ key: "afraid", remaining: 2 }, state), "−2 to hit (20 instead of 18–20)");
});

test("afraid: a missing combat is defensive (no throw, no effect)", () => {
  const state = fixedState({ combat: null });
  assert.equal(conditionEffectText({ key: "afraid", remaining: 2 }, state), null);
});

// ─── foeEffect (dazed / weakened) ───────────────────────────────────────

test("foeEffect: a dazed hero reads the engine's own to-hit penalty", () => {
  const state = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 2 } } });
  assert.equal(
    conditionEffectText({ key: "foeEffect", kind: "dazed", remaining: 2 }, state),
    "−2 to hit (18–20 instead of 16–20)"
  );
});

test("foeEffect: a weakened hero moves no to-hit term, so the chip reads null", () => {
  const state = fixedState({ c: { foeEffect: { kind: "weakened", rounds: 2 } } });
  assert.equal(conditionEffectText({ key: "foeEffect", kind: "weakened", remaining: 2 }, state), null);
});

// ─── darkness ────────────────────────────────────────────────────────────

test("darkness: a lit-tile hero with a live darkFor counter reads the dark cap being lifted", () => {
  const state = fixedState({ c: { darkFor: 5 } });
  assert.equal(conditionEffectText({ key: "darkness", remaining: 5 }, state), "−3 to hit (19–20 instead of 16–20)");
});

test("darkness: Night Vision waives the dark cap either way, so the chip reads null", () => {
  const state = fixedState({ c: { darkFor: 5, skills: { "Night Vision": true } } });
  assert.equal(conditionEffectText({ key: "darkness", remaining: 5 }, state), null);
});

// ─── senses ──────────────────────────────────────────────────────────────

test("senses: a dark-tile hero with Sense Presence reads the dark cap being lifted", () => {
  const state = fixedState({ c: { senses: true }, floor: { dark: true } });
  assert.equal(conditionEffectText({ key: "senses", remaining: undefined }, state), "+3 to hit (16–20 instead of 19–20)");
});

// ─── heroBlind (RULES-10, Phase 75.1, plan 09) ──────────────────────────

test("heroBlind: a level-1 Human Fighter reads the one-face range against the engine's own faces", () => {
  const state = fixedState({ combat: { heroBlind: true } });
  const text = conditionEffectText({ key: "heroBlind" }, state);
  assert.equal(text, "−4 to hit (20 instead of 16–20)");

  // Prove it against the engine directly, not a hardcoded expectation.
  const whatIf = { ...state, combat: { ...state.combat, heroBlind: false } };
  const liveFaces = afraidNeed(state, toHit(state));
  const whatIfFaces = afraidNeed(whatIf, toHit(whatIf));
  assert.equal(liveFaces, 1);
});

test("heroBlind: a missing combat is defensive (no throw, no effect)", () => {
  const state = fixedState({ combat: null });
  assert.equal(conditionEffectText({ key: "heroBlind" }, state), null);
});

// ─── mirror / unseen (their roll) ───────────────────────────────────────

test("mirror: a plain Human Soldier reads foes needing far more to land a blow", () => {
  const state = fixedState({ c: { mirror: 2 } });
  assert.equal(conditionEffectText({ key: "mirror", remaining: 2 }, state), "+4 vs their swings");

  // Prove it against the engine directly.
  const liveFoe = foeToHitVs(state);
  const whatIfFoe = foeToHitVs({ ...state, c: { ...state.c, mirror: 0 } });
  assert.equal(liveFoe, 1);
  assert.equal(whatIfFoe, 5);
});

test("unseen: a live Anklet of Invisibility item effect reads a smaller +2", () => {
  const state = fixedState();
  startEffect(state.c, "item:Anklet of Invisibility", { squares: 50 });
  const chip = { key: "unseen", polarity: "good", remaining: 50, cadence: "squares", source: "Anklet of Invisibility" };
  assert.equal(conditionEffectText(chip, state), "+2 vs their swings");
});

// ─── acute (die swap) ────────────────────────────────────────────────────

test("acute: a live Acuteness item effect swaps the strike die and states the new range", () => {
  const state = fixedState();
  startEffect(state.c, "item:Acuteness", { rounds: 5 });
  assert.equal(strikeDie(state.c), 6);
  const chip = { key: "acute", polarity: "good", remaining: 5, cadence: "rounds", source: "Acuteness" };
  assert.equal(conditionEffectText(chip, state), "Hit 2–6 (d6)");
});

// ─── no-effect chips (haste, might, ward, regen, flight, cooldowns) ─────

test("haste, might, ward, regen, flight, itemCooldown, staffCharges and an unknown key all give null", () => {
  const hasteState = fixedState();
  startEffect(hasteState.c, "item:Speed", { squares: 50 });
  assert.equal(
    conditionEffectText({ key: "haste", polarity: "good", remaining: 50, cadence: "squares", source: "Speed" }, hasteState),
    null
  );

  const mightSpellState = fixedState({ c: { might: 8 } });
  assert.equal(conditionEffectText({ key: "might", polarity: "good" }, mightSpellState), null);

  const mightPotionState = fixedState();
  startEffect(mightPotionState.c, "item:Strength", { squares: 25 });
  assert.equal(
    conditionEffectText(
      { key: "might", polarity: "good", remaining: 25, cadence: "squares", source: "Strength", might: 8 },
      mightPotionState
    ),
    null
  );

  const wardState = fixedState({ c: { ward: { pool: 50, rounds: 5, name: "Shield" } } });
  assert.equal(
    conditionEffectText({ key: "ward", polarity: "good", pool: 50, remaining: 5, name: "Shield" }, wardState),
    null
  );

  const regenState = fixedState({ c: { regen: true } });
  assert.equal(conditionEffectText({ key: "regen", polarity: "good" }, regenState), null);

  const flightState = fixedState();
  startEffect(flightState.c, "item:Bracelet of Flight", { squares: 20 });
  assert.equal(
    conditionEffectText(
      { key: "flight", polarity: "good", flight: "charged", remaining: 20, cadence: "squares", source: "Bracelet of Flight" },
      flightState
    ),
    null
  );

  const cooldownState = fixedState();
  assert.equal(
    conditionEffectText({ key: "itemCooldown", polarity: "good", item: "Speed", remaining: 10 }, cooldownState),
    null
  );

  const staffState = fixedState();
  assert.equal(
    conditionEffectText({ key: "staffCharges", polarity: "good", item: "Staff of X", charges: 2, max: 5, remaining: 10 }, staffState),
    null
  );

  assert.equal(conditionEffectText({ key: "bogus" }, fixedState()), null);
});

// ─── malformed input / never throws / never mutates ─────────────────────

test("a malformed descriptor or a state without c gives null and never throws", () => {
  const state = fixedState();
  assert.equal(conditionEffectText(null, state), null);
  assert.equal(conditionEffectText(undefined, state), null);
  assert.equal(conditionEffectText({}, state), null);
  assert.equal(conditionEffectText({ key: 42 }, state), null);
  assert.equal(conditionEffectText({ key: "" }, state), null);
  assert.equal(conditionEffectText({ key: "afraid" }, null), null);
  assert.equal(conditionEffectText({ key: "afraid" }, undefined), null);
  assert.equal(conditionEffectText({ key: "afraid" }, {}), null);
  assert.equal(conditionEffectText({ key: "afraid" }, { c: null }), null);
  assert.equal(conditionEffectText({ key: "afraid" }, "not an object"), null);
  assert.equal(conditionEffectText("not an object", state), null);
});

test("a deep-frozen state is never mutated, and two calls return the same string", () => {
  const state = fixedState({ combat: { afraid: 2 } });
  Object.freeze(state.c);
  Object.freeze(state.combat);
  Object.freeze(state.floor);
  Object.freeze(state);

  const first = conditionEffectText({ key: "afraid", remaining: 2 }, state);
  const second = conditionEffectText({ key: "afraid", remaining: 2 }, state);
  assert.equal(first, "−3 to hit (19–20 instead of 16–20)");
  assert.equal(first, second);

  // Never mutated: still frozen, still the same values.
  assert.equal(Object.isFrozen(state), true);
  assert.equal(state.combat.afraid, 2);
});

// ─── CMBUI-13 (Phase 77, plan 77-03): the new chips' measured effects ────
//
// Each new WHAT_IF key drops only its own effect in a shallow what-if and
// is read through heroHitOdds/foeToHitVs like every other chip; the
// expected strings are cross-checked against the engine's own numbers.

function inFight(overrides = {}) {
  const { combat = {}, ...rest } = overrides;
  return fixedState({ ...rest, combat: { foes: [], round: 1, target: 0, ...combat } });
}

const liveAbility = (left = 2) => ({ cadence: "rounds", left, phase: "effect", cd: 4 });

test("CMBUI-13 ability: a live Sidestep and a live Battle Roar each read '+2 vs their swings'", () => {
  for (const id of ["sidestep", "battleRoar"]) {
    const state = inFight({ c: { timers: { [`ability:${id}`]: liveAbility() } } });
    assert.equal(conditionEffectText({ key: "ability", ability: id, polarity: "good", remaining: 2, cadence: "rounds" }, state), "+2 vs their swings", id);
  }
});

test("CMBUI-13 ability: Smoke reads the measured plus from its override (every foe finds you only on its die's top face)", () => {
  const state = inFight({ c: { cls: "Thief", sub: "Pilfer", timers: { "ability:smoke": liveAbility() } } });
  const without = foeToHitVs({ ...state, c: { ...state.c, timers: {} } });
  assert.equal(foeToHitVs(state), 1);
  assert.ok(without > 1);
  assert.equal(conditionEffectText({ key: "ability", ability: "smoke", polarity: "good", remaining: 2 }, state), `+${without - 1} vs their swings`);
});

test("CMBUI-13 ability: Riposte and Taunt move no roll, so they read null; an ability with no live record reads null", () => {
  for (const id of ["riposte", "taunt"]) {
    const state = inFight({ c: { timers: { [`ability:${id}`]: liveAbility(1) } } });
    assert.equal(conditionEffectText({ key: "ability", ability: id, polarity: "good", remaining: 1 }, state), null, id);
  }
  assert.equal(conditionEffectText({ key: "ability", ability: "sidestep", remaining: 2 }, inFight()), null);
  assert.equal(conditionEffectText({ key: "ability", remaining: 2 }, inFight({ c: { timers: { "ability:sidestep": liveAbility() } } })), null);
});

test("CMBUI-13 ability: the what-if never touches the caller's timers", () => {
  const state = inFight({ c: { timers: { "ability:sidestep": liveAbility() } } });
  const before = JSON.stringify(state);
  conditionEffectText({ key: "ability", ability: "sidestep", remaining: 2 }, state);
  assert.equal(JSON.stringify(state), before);
  assert.ok(state.c.timers["ability:sidestep"]);
});

test("CMBUI-13 inspired: the song's to-hit plus, with the range it gives and the range without it", () => {
  const state = inFight({ combat: { inspired: 1 } });
  const text = conditionEffectText({ key: "inspired", polarity: "good", amount: 1 }, state);
  assert.equal(text, "+1 to hit (15–20 instead of 16–20)");
  assert.equal(toHit(state), toHit({ ...state, combat: { ...state.combat, inspired: 0 } }) + 1);
});

test("CMBUI-13 fightDark: the dark cap's to-hit change; nightVision: the to-hit it saves", () => {
  const dark = inFight({ floor: { dark: true } });
  assert.equal(conditionEffectText({ key: "fightDark", polarity: "bad" }, dark), "−3 to hit (19–20 instead of 16–20)");
  const nv = inFight({ floor: { dark: true }, c: { skills: { "Night Vision": 1 } } });
  assert.equal(conditionEffectText({ key: "nightVision", polarity: "good" }, nv), "+3 to hit (16–20 instead of 19–20)");
  // A lit torch also holds the dark back, so Night Vision saves nothing more.
  const both = inFight({ floor: { dark: true }, c: { skills: { "Night Vision": 1 } } });
  startEffect(both.c, "item:Torch", { squares: 40 });
  assert.equal(conditionEffectText({ key: "nightVision", polarity: "good" }, both), null);
});

test("CMBUI-13 null effects: braced, halfNext, selfDot, insulted and strengthBoost move no roll the chip reads", () => {
  const state = inFight({
    c: { halfNext: true, strengthBoost: 30 },
    combat: { braced: true, parleyInsulted: true, selfDot: { left: 2, dmg: "1d6", by: "acid", spell: "Acid" } },
  });
  assert.equal(conditionEffectText({ key: "braced", polarity: "good" }, state), null);
  assert.equal(conditionEffectText({ key: "halfNext", polarity: "good" }, state), null);
  assert.equal(conditionEffectText({ key: "selfDot", polarity: "bad", remaining: 2, by: "acid", spell: "Acid" }, state), null);
  assert.equal(conditionEffectText({ key: "insulted", polarity: "bad" }, state), null);
  assert.equal(conditionEffectText({ key: "strengthBoost", polarity: "good", amount: 30 }, state), null);
});

test("CMBUI-13 dazed honesty: '−2 to hit (<live> instead of <without>)' from heroHitOdds live and what-if", () => {
  const state = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 2 } } });
  const text = conditionEffectText({ key: "foeEffect", kind: "dazed", remaining: 2 }, state);
  const cleared = { ...state, c: { ...state.c, foeEffect: null } };
  assert.equal(afraidNeed(state, toHit(state)), 3);
  assert.equal(afraidNeed(cleared, toHit(cleared)), 5);
  assert.equal(text, "−2 to hit (18–20 instead of 16–20)");
});

test("CMBUI-13 formatting: every lead uses U+2212 for a minus and U+2013 for a range; malformed input reads null", () => {
  const texts = [
    conditionEffectText({ key: "fightDark" }, inFight({ floor: { dark: true } })),
    conditionEffectText({ key: "afraid", remaining: 2 }, fixedState({ combat: { afraid: 2 } })),
    conditionEffectText({ key: "inspired", amount: 1 }, inFight({ combat: { inspired: 1 } })),
  ];
  for (const t of texts) {
    assert.ok(typeof t === "string" && t.includes(" instead of "), t);
    assert.ok(!/-\d/.test(t) && !/\d-\d/.test(t), `ASCII hyphen in "${t}"`);
    assert.ok(/\d–\d/.test(t), `an en-dash range in "${t}"`);
  }
  assert.ok(texts[0].startsWith("−") && texts[1].startsWith("−"));
  for (const key of ["ability", "inspired", "fightDark", "nightVision"]) {
    assert.doesNotThrow(() => conditionEffectText({ key }, { c: {} }));
    assert.equal(conditionEffectText({ key }, null), null);
    assert.equal(conditionEffectText({ key, ability: 7 }, { c: { timers: "x" } }), null);
  }
});

test("CMBUI-13 WHAT_IF: the new keys sit in the one what-if map beside the Phase 74/75.1 keys", () => {
  for (const key of ["afraid", "foeEffect", "darkness", "mirror", "senses", "heroBlind", "ability", "inspired", "fightDark", "nightVision"]) {
    assert.equal(typeof WHAT_IF[key], "function", key);
  }
});
