// test/unit/spell-effect-records.test.js
//
// Phase 90 plan 03 (SPELL-09): the GENERAL spell-sourced timed effect that
// Strength is built on and the SPELL-10 slate (Fly, Enchant Character, Speed
// of Sound, Open/Lock) reuses. A SPELLS row carrying an `act` record starts a
// `spell:<n>` squares record (engine/combat.js#startSpellEffect);
// engine/derived.js#liveItemEffects reads the live record back through
// SPELL_ACT_OF and tags every entry `source: "spell" | "item"`, so eff,
// itemEffectActive, critWardOf and conditionsOf need no spell-specific code;
// engine/items.js#narrateTimerTransitions tells the expiry as
// `spellEffectFaded`; Phase 88's endSourceEffects (item: ids only) never
// touches a spell record.
//
// No other SPELLS row carries an `act` yet, so the payload-reading tests
// borrow Strength's act object and give it a test-local `eff` for the span of
// one test (restored in `finally`), standing in for a slate row.

import test from "node:test";
import assert from "node:assert/strict";

import { SPELLS, ACTIVATION_OF } from "../../content/index.js";
import { startSpellEffect } from "../../engine/combat.js";
import { startEffect, tickSquares } from "../../engine/effects.js";
import { endSourceEffects, narrateTimerTransitions } from "../../engine/items.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { SPELL_ACT_OF, liveItemEffects, itemEffectActive, eff, critWardOf, conditionsOf } from "../../engine/derived.js";

const STRENGTH = SPELLS.find((sp) => sp.n === "Strength");

function hero(overrides = {}) {
  return { cls: "Fighter", sub: "Knight", race: "Human", level: 1, maxWP: 50, wp: 50, name: "Tester", worn: {}, items: [], ...overrides };
}

/** withSlateEff(payload, fn) — give Strength's act a test-local `eff` (and
 * the stand-in activation kind) for one test, then restore it. */
function withSlateEff(payload, fn) {
  const act = SPELL_ACT_OF.Strength;
  const had = Object.prototype.hasOwnProperty.call(act, "eff");
  const before = act.eff;
  act.eff = payload;
  try {
    return fn(act);
  } finally {
    if (had) act.eff = before;
    else delete act.eff;
  }
}

test("SPELL_ACT_OF: exactly the SPELLS rows that carry an act, frozen", () => {
  const rows = SPELLS.filter((sp) => sp.act).map((sp) => sp.n);
  assert.deepStrictEqual(Object.keys(SPELL_ACT_OF), rows);
  assert.ok(rows.includes("Strength"));
  assert.equal(Object.isFrozen(SPELL_ACT_OF), true);
});

test("startSpellEffect: starts spell:<n> for act.effect squares, overwrites a live record, pushes nothing", () => {
  const c = hero();
  const events = [];
  const rec = startSpellEffect(c, STRENGTH, events);
  assert.deepStrictEqual(rec, { cadence: "squares", left: 100, phase: "effect" });
  assert.deepStrictEqual(c.timers["spell:Strength"], rec);
  assert.deepStrictEqual(events, [], "the caller narrates, never this");
  tickSquares(c, 30);
  const again = startSpellEffect(c, STRENGTH, events);
  assert.equal(again.left, 100);
  assert.equal(Object.keys(c.timers).length, 1);
});

test("startSpellEffect: opts.squares stretches the window (the school bonus passes it); a row with no act starts nothing", () => {
  const c = hero();
  assert.equal(startSpellEffect(c, STRENGTH, [], { squares: 110 }).left, 110);
  const none = hero();
  assert.equal(startSpellEffect(none, SPELLS.find((sp) => sp.n === "Heal"), []), null);
  assert.equal(none.timers, undefined, "nothing was created");
  assert.equal(startSpellEffect(none, null, []), null);
});

test("liveItemEffects: a live spell record is tagged source spell, an item record source item, in timers order", () => {
  const c = hero();
  startEffect(c, "item:Strength", { squares: 25 });
  startEffect(c, "spell:Strength", { squares: 100 });
  const live = liveItemEffects(c);
  assert.deepStrictEqual(live.map((e) => [e.key, e.source]), [["Strength", "item"], ["Strength", "spell"]]);
  assert.equal(live[0].act, ACTIVATION_OF.Strength);
  assert.equal(live[1].act, SPELL_ACT_OF.Strength);
  assert.equal(live[1].rec, c.timers["spell:Strength"]);
});

test("liveItemEffects: a spell record whose name has no act (weaken, reveal) or that is not live is ignored", () => {
  const c = hero({
    timers: {
      "spell:weaken": { cadence: "rounds", left: 3, phase: "effect" },
      "spell:reveal": { cadence: "squares", left: 1, phase: "effect" },
      "spell:Heal": { cadence: "squares", left: 5, phase: "effect" },
      "spell:Strength": { cadence: "squares", left: 5, phase: "cooldown" },
      "spell:constructor": { cadence: "squares", left: 5, phase: "effect" },
      "spell:": { cadence: "squares", left: 5, phase: "effect" },
    },
  });
  assert.deepStrictEqual(liveItemEffects(c), []);
});

test("eff, itemEffectActive and critWardOf read a live spell effect's act payload", () => {
  withSlateEff({ dmg: 3, critWard: 1 }, () => {
    const c = hero();
    assert.equal(eff(c, "dmg"), 0);
    assert.equal(critWardOf(c), null);
    startEffect(c, "spell:Strength", { squares: 10 });
    assert.equal(eff(c, "dmg"), 3);
    assert.equal(critWardOf(c), "Strength", "the spell's name is the ward's source");
    assert.equal(itemEffectActive(c, "strength"), true);
    assert.equal(itemEffectActive(c, "fly"), false);
    tickSquares(c, 10);
    assert.equal(eff(c, "dmg"), 0, "gone with the record");
    assert.equal(itemEffectActive(c, "strength"), false);
  });
});

test("conditionsOf: a live spell effect rides the generic chip loop with the spell as its source", () => {
  const c = hero();
  startEffect(c, "spell:Strength", { squares: 12 });
  assert.deepStrictEqual(conditionsOf({ c, combat: null }), [
    { key: "strength", polarity: "good", remaining: 12, cadence: "squares", source: "Strength" },
  ]);
});

test("narrateTimerTransitions: a spell effect running out pushes spellEffectFaded; weaken and reveal stay silent", () => {
  const c = hero();
  startEffect(c, "spell:Strength", { squares: 1 });
  startEffect(c, "spell:reveal", { squares: 1 });
  const state = { c, party: [], combat: null };
  const events = narrateTimerTransitions(state, tickSquares(c, 1), []);
  assert.deepStrictEqual(events, [{ type: "spellEffectFaded", spell: "Strength", kind: "strength" }]);
});

test("narrateTimerTransitions: a Joiner's own sheet names the member", () => {
  const joiner = hero({ name: "Brann" });
  startEffect(joiner, "spell:Strength", { squares: 1 });
  const state = { c: hero(), party: [joiner], combat: null };
  const events = narrateTimerTransitions(state, tickSquares(joiner, 1), [], joiner);
  assert.deepStrictEqual(events, [{ type: "spellEffectFaded", spell: "Strength", kind: "strength", member: "Brann" }]);
});

test("narration: spellEffectFaded names the spell, says what stops, never prints undefined, and falls back for an unknown kind", () => {
  const strength = { type: "spellEffectFaded", spell: "Strength", kind: "strength" };
  const oracle = EVENT_NARRATION.spellEffectFaded(strength).replace(/<[^>]+>/g, "");
  assert.match(oracle, /Strength/);
  assert.match(oracle, /d10/);
  assert.match(LINE_FOR.spellEffectFaded(strength).text, /Strength wears off/);
  // a Joiner's own effect names the Joiner
  const joiner = { ...strength, member: "Brann" };
  assert.match(EVENT_NARRATION.spellEffectFaded(joiner).replace(/<[^>]+>/g, ""), /^Brann's Strength wears off/);
  assert.match(LINE_FOR.spellEffectFaded(joiner).text, /^Brann's Strength wears off/);
  // a kind with no clause just wears off; a bare payload never prints "undefined"
  const unknown = { type: "spellEffectFaded", spell: "Fly", kind: "mystery" };
  assert.equal(EVENT_NARRATION.spellEffectFaded(unknown).replace(/<[^>]+>/g, ""), "Your Fly wears off.");
  assert.equal(LINE_FOR.spellEffectFaded(unknown).text, "Your Fly wears off.");
  for (const bare of [{ type: "spellEffectFaded" }, {}, { spell: "Fly" }]) {
    for (const text of [EVENT_NARRATION.spellEffectFaded(bare).replace(/<[^>]+>/g, ""), LINE_FOR.spellEffectFaded(bare).text]) {
      assert.doesNotMatch(text, /undefined|null|NaN/);
    }
  }
});

test("endSourceEffects: Phase 88's early end never touches a spell record, on any slot", () => {
  const c = hero();
  startEffect(c, "spell:Strength", { squares: 80 });
  const rec = c.timers["spell:Strength"];
  const state = { c, party: [] };
  for (const slots of [["cloak"], ["jewelry1"], ["jewelry2"], ["weapon"]]) {
    const events = endSourceEffects(state, c, [], { slots, why: "swap" });
    assert.deepStrictEqual(events, []);
  }
  endSourceEffects(state, c, []);
  assert.equal(c.timers["spell:Strength"], rec, "same record, untouched");
  assert.equal(rec.left, 80);
});
