// test/unit/hudBands.test.js
//
// Phase 57 (LAYOUT-05), Plan 01, Task 1 — the pure module pin for
// src/browser/hudBands.js: identityLine()'s four rules, counterSlots()'
// fixed-width overflow behaviour, HUD_BAND_ANCHORS' shape, and a purity
// check that the module is frozen where the plan calls for it.

import test from "node:test";
import assert from "node:assert/strict";

import {
  HUD_BAND_ANCHORS,
  COUNTER_DIGIT_SLOT,
  COUNTER_OVERFLOW,
  identityLine,
  counterSlots,
} from "../../src/browser/hudBands.js";

// ─── identityLine() ────────────────────────────────────────────────────

test("identityLine: a full character renders Name — Race Class (Sub) · Lvl N", () => {
  const line = identityLine({ name: "Ardwin", race: "Human", cls: "Thief", sub: "Guard", level: 3 });
  assert.equal(line, "Ardwin — Human Thief (Guard) · Lvl 3");
});

test("identityLine: a falsy sub omits the parenthesised group and its leading space", () => {
  const line = identityLine({ name: "Ardwin", race: "Human", cls: "Thief", sub: null, level: 3 });
  assert.equal(line, "Ardwin — Human Thief · Lvl 3");
  assert.doesNotMatch(line, /\(\)/);
  assert.doesNotMatch(line, /  /, "no double space where the sub group would have been");
});

test("identityLine: a falsy name substitutes a non-empty placeholder", () => {
  const line = identityLine({ name: "", race: "Human", cls: "Thief", sub: "Guard", level: 3 });
  assert.ok(line.length > 0);
  assert.match(line, /^Nameless — /);
});

test("identityLine: a falsy level renders Lvl 1", () => {
  const line = identityLine({ name: "Ardwin", race: "Human", cls: "Thief", sub: "Guard", level: 0 });
  assert.match(line, /Lvl 1$/);
  const lineUndef = identityLine({ name: "Ardwin", race: "Human", cls: "Thief", sub: "Guard" });
  assert.match(lineUndef, /Lvl 1$/);
});

test("identityLine: a missing or null character returns the placeholder-only form and never throws", () => {
  assert.equal(identityLine(null), "Nameless");
  assert.equal(identityLine(undefined), "Nameless");
  assert.doesNotThrow(() => identityLine());
});

test("identityLine: a long name/race/class/sub combination is one single-line string with no newline", () => {
  const line = identityLine({
    name: "Sir Reginald Ashworth-Blackwood the Unfortunately Named",
    race: "Half-Giant",
    cls: "Battlemage",
    sub: "Wandering Exorcist",
    level: 12,
  });
  assert.equal(typeof line, "string");
  assert.doesNotMatch(line, /\n/);
});

test("identityLine: player-facing string is HP-clean — no standalone WP token", () => {
  const line = identityLine({ name: "Ardwin", race: "Human", cls: "Thief", sub: "Guard", level: 3 });
  assert.doesNotMatch(line, /(?<![\w.$-])(wp|WP)(?![\w:])/);
});

// ─── counterSlots() ────────────────────────────────────────────────────

test("counterSlots: 999, 1000 and 99999 all report over:false with text equal to the plain digits", () => {
  for (const steps of [999, 1000, 99999]) {
    const slots = counterSlots({ floor: { depth: 2 }, day: 4, steps, c: { rations: 5 } });
    const stepsSlot = slots.find((s) => s.id === "m-steps");
    assert.equal(stepsSlot.over, false, `steps=${steps} should not overflow`);
    assert.equal(stepsSlot.text, String(steps));
  }
});

test("counterSlots: at 100000 and beyond, over:true and text is COUNTER_OVERFLOW with length COUNTER_DIGIT_SLOT + 1", () => {
  for (const steps of [100000, 4321098]) {
    const slots = counterSlots({ floor: { depth: 2 }, day: 4, steps, c: { rations: 5 } });
    const stepsSlot = slots.find((s) => s.id === "m-steps");
    assert.equal(stepsSlot.over, true, `steps=${steps} should overflow`);
    assert.equal(stepsSlot.text, COUNTER_OVERFLOW);
    assert.equal(stepsSlot.text.length, COUNTER_DIGIT_SLOT + 1);
  }
});

test("counterSlots: order is Depth, Day, Squares, Rations with the kept ids and Depth's label text", () => {
  const slots = counterSlots({ floor: { depth: 7 }, day: 12, steps: 50, c: { rations: 3 } });
  assert.deepStrictEqual(
    slots.map((s) => s.id),
    ["m-floor", "m-day", "m-steps", "m-rations"],
  );
  assert.equal(slots.find((s) => s.id === "m-floor").label, "Depth");
  assert.equal(slots.find((s) => s.id === "m-floor").text, "7");
  assert.equal(slots.find((s) => s.id === "m-day").text, "12");
  assert.equal(slots.find((s) => s.id === "m-rations").text, "3");
});

test("counterSlots: a missing/partial state yields zeroes rather than throwing", () => {
  assert.doesNotThrow(() => counterSlots(undefined));
  const slots = counterSlots({});
  for (const s of slots) {
    assert.equal(s.text, "0");
    assert.equal(s.over, false);
  }
  const partial = counterSlots({ day: 5 });
  assert.equal(partial.find((s) => s.id === "m-day").text, "5");
  assert.equal(partial.find((s) => s.id === "m-floor").text, "0");
});

// ─── HUD_BAND_ANCHORS ──────────────────────────────────────────────────

test("HUD_BAND_ANCHORS has exactly four entries in the ruled order", () => {
  assert.equal(HUD_BAND_ANCHORS.length, 4);
  assert.deepStrictEqual(HUD_BAND_ANCHORS, [
    'id="mw-hud-name"',
    'class="mw-hud-counters"',
    'id="mm-conditions"',
    'id="mw-map-chips"',
  ]);
});

// ─── purity / frozen exports ────────────────────────────────────────────

test("module exports are frozen: HUD_BAND_ANCHORS and a counterSlots() result cannot be mutated", () => {
  assert.ok(Object.isFrozen(HUD_BAND_ANCHORS));
  const slots = counterSlots({ floor: { depth: 1 }, day: 1, steps: 1, c: { rations: 1 } });
  assert.ok(Object.isFrozen(slots));
  assert.ok(Object.isFrozen(slots[0]));
});

// ─── teeth check: assertions must key off COUNTER_DIGIT_SLOT, not a
// hardcoded 5, except this one explicit pin ─────────────────────────────

test("COUNTER_DIGIT_SLOT is pinned to 5 (the one hardcoded reference in this file)", () => {
  assert.equal(COUNTER_DIGIT_SLOT, 5);
});

test("teeth: the overflow boundary tracks COUNTER_DIGIT_SLOT, not a hardcoded literal", () => {
  const atCap = Number("9".repeat(COUNTER_DIGIT_SLOT));
  const pastCap = atCap + 1;
  const capSlots = counterSlots({ floor: { depth: 1 }, day: 1, steps: atCap, c: { rations: 1 } });
  const pastSlots = counterSlots({ floor: { depth: 1 }, day: 1, steps: pastCap, c: { rations: 1 } });
  assert.equal(capSlots.find((s) => s.id === "m-steps").over, false);
  assert.equal(pastSlots.find((s) => s.id === "m-steps").over, true);
});
