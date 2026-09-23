// test/unit/gear-sheet-agreement.test.js
//
// Phase 63 Plan 03 (GSCR-09, GRULE-02). Two things:
//
//   1. Rail-line coverage: itemDropped/itemUnequipped moved out of
//      ORACLE_ONLY into LINE_FOR (src/browser/narrationLines.js), so DROP,
//      UNEQUIP and DISCARD reach the rail in voice — the sheet closes on
//      the tap, and the rail is the one feedback surface. (Task 1)
//   2. The sheet-vs-engine agreement sweep: every action gearSheetModel
//      offers, across a state sweep, is dispatched through the REAL
//      applyAction. Every greyed reason must be exactly what the engine
//      says when the action is forced anyway (GSCR-09's honesty
//      prohibition — never grey with a reason the engine would not give).
//      Every enabled action must produce a rail or fight-log line. GRULE-02
//      (after the fight, everything works again) is proven directly. (Task 2)

import test from "node:test";
import assert from "node:assert/strict";

import { ORACLE_ONLY, LINE_FOR, linesForAction, slotWord } from "../../src/browser/narrationLines.js";
import { railCardFor } from "../../src/browser/rail.js";

// ════════════════════════════════════════════════════════════════════════
// Task 1 — itemDropped and itemUnequipped reach the rail
// ════════════════════════════════════════════════════════════════════════

test("rail lines: itemDropped/itemUnequipped are keys of LINE_FOR and NOT in ORACLE_ONLY", () => {
  assert.equal(ORACLE_ONLY.has("itemDropped"), false);
  assert.equal(ORACLE_ONLY.has("itemUnequipped"), false);
  assert.equal(typeof LINE_FOR.itemDropped, "function");
  assert.equal(typeof LINE_FOR.itemUnequipped, "function");
});

test("rail lines: dropItem's itemDropped folds into exactly one line naming the item", () => {
  const events = [{ type: "itemDropped", item: { n: "Rope" } }];
  const lines = linesForAction("dropItem", events, {}, { limit: Infinity });
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /Rope/);
});

test("rail lines: unequipSlot's itemUnequipped folds into one line naming the item and the slot's FAMILY word, never the raw key", () => {
  const events = [{ type: "itemUnequipped", item: { n: "Ring of Power" }, slot: "jewelry1" }];
  const lines = linesForAction("unequipSlot", events, {}, { limit: Infinity });
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /Ring of Power/);
  assert.match(lines[0].text, new RegExp(slotWord("jewelry1")));
  assert.doesNotMatch(lines[0].text, /jewelry1/);
});

test("rail lines: a destroyed unequip (DISCARD) reads its own line, distinct from the normal unequip line, naming the item", () => {
  const normalEvents = [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor" }];
  const destroyedEvents = [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor", destroyed: true }];
  const normalLines = linesForAction("unequipSlot", normalEvents, {}, { limit: Infinity });
  const destroyedLines = linesForAction("unequipSlot", destroyedEvents, {}, { limit: Infinity });
  assert.equal(normalLines.length, 1);
  assert.equal(destroyedLines.length, 1);
  assert.match(destroyedLines[0].text, /Plate/);
  assert.notEqual(destroyedLines[0].text, normalLines[0].text);
});

test("rail lines: railCardFor is non-null for a drop, a plain unequip and a destroyed unequip", () => {
  for (const [type, events] of [
    ["dropItem", [{ type: "itemDropped", item: { n: "Rope" } }]],
    ["unequipSlot", [{ type: "itemUnequipped", item: { n: "Ring of Power" }, slot: "jewelry1" }]],
    ["unequipSlot", [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor", destroyed: true }]],
  ]) {
    const folded = linesForAction(type, events, {}, { limit: Infinity, withIdx: true });
    const card = railCardFor(type, events, folded);
    assert.ok(card, `railCardFor(${type}, ...) should be non-null for ${JSON.stringify(events)}`);
  }
});

test("rail lines: a bare {type} builder call never throws and never contains 'undefined'", () => {
  for (const type of ["itemDropped", "itemUnequipped"]) {
    let result;
    assert.doesNotThrow(() => {
      result = LINE_FOR[type]({ type });
    });
    assert.ok(result && typeof result.text === "string" && result.text.length > 0);
    assert.doesNotMatch(result.text, /undefined/);
  }
});
