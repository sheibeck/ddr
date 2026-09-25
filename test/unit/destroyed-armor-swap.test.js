// test/unit/destroyed-armor-swap.test.js
//
// Phase 75 (RULES-08), Plan 04 Tasks 2-3 — pins the additive `discarded`/
// `destroyed` payload on every armor-replacing path (equipItem, takeLoot's
// equip-now branch, takeItem's store delivery) when the worn piece being
// swapped out is destroyed (armor set and not "Nothing", ar > 0, armorWP <=
// 0), plus the paired Oracle/rail lines and the Gear sheet's worn-slot note.
// One live-piece control per path proves the no-payload event stays
// byte-identical to today, and unequipSlot's own destroyed event (the
// existing precedent, test/unit/armor-durability.test.js) stays unchanged.
// Fixture helpers mirror test/unit/loot-pile.test.js's fixedChar/fixedState
// shape (this file spans the same items.js surface, no floor/combat fields
// needed beyond `combat` itself for the gear-lock cases).

import test from "node:test";
import assert from "node:assert/strict";

import { equipItem, takeLoot, takeItem, unequipSlot } from "../../engine/items.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { gearSheetModel, GEAR_SHEET_COPY } from "../../src/browser/gearSheet.js";

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    weapon: "Broadsword", prof: 0, magicWpn: 0,
    armor: "Studded", ar: 15, armorMin: 2, armorWP: 20, armorMax: 20, patches: 0,
    skills: {}, gold: 50, rations: 6, scrolls: 0, maxWP: 55, wp: 40,
    bag: "small", // 4 slots
    items: [],
    worn: {},
    timers: {},
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: { depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    party: [], pendingJoiner: null, pendingFind: null, pendingLoot: [],
    dead: false,
    ...rest,
  };
}

const ARMOR = (name, ar, cls = "FTM", extra = {}) => ({ kind: "armor", n: name, armor: name, ar, wp: 20, min: 1, cls, txt: `AR ${ar}`, ...extra });

const DESTROYED = { armorWP: 0 }; // Studded, ar 15, armorWP 0 — the destroyed worn piece
const LIVE = {}; // Studded, ar 15, armorWP 20 — the default live worn piece

// ─── Task 2: the engine payload ─────────────────────────────────────────────

test("equipItem over a destroyed worn piece: itemEquipped carries destroyed true and a discarded descriptor naming the old piece at left 0; no bag copy", () => {
  const state = fixedState({ c: { ...DESTROYED, items: [ARMOR("Plate", 20)] } });
  const events = equipItem(state, 0, []);
  assert.equal(state.c.armor, "Plate");
  assert.equal(state.c.items.length, 0, "the destroyed Studded piece vanished, not stowed");
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.ok(evt);
  assert.equal(evt.destroyed, true);
  assert.deepStrictEqual(evt.discarded, { kind: "armor", n: "Studded", armor: "Studded", ar: 15, left: 0 });
});

test("equipItem over a LIVE worn piece: no discarded/destroyed keys, event unchanged from today", () => {
  const plate = ARMOR("Plate", 20);
  const state = fixedState({ c: { ...LIVE, items: [plate] } });
  const events = equipItem(state, 0, []);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.deepStrictEqual(evt, { type: "itemEquipped", item: plate, slot: "armor" });
  assert.equal("discarded" in evt, false);
  assert.equal("destroyed" in evt, false);
});

test("takeLoot(i, true) over a destroyed worn piece: same payload on itemEquipped; the pile loses the item; no bag copy", () => {
  const state = fixedState({ c: { ...DESTROYED }, pendingLoot: [ARMOR("Plate", 20)] });
  const events = takeLoot(state, 0, true, []);
  assert.equal(state.c.armor, "Plate");
  assert.deepStrictEqual(state.pendingLoot, [], "the pile loses the taken item");
  assert.deepStrictEqual(state.c.items, [], "no bag copy of the destroyed piece");
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.ok(evt);
  assert.equal(evt.destroyed, true);
  assert.deepStrictEqual(evt.discarded, { kind: "armor", n: "Studded", armor: "Studded", ar: 15, left: 0 });
});

test("takeLoot(i, true) over a LIVE worn piece: no discarded/destroyed keys, event unchanged from today", () => {
  const state = fixedState({ c: { ...LIVE }, pendingLoot: [ARMOR("Plate", 20)] });
  const events = takeLoot(state, 0, true, []);
  const evt = events.find((e) => e.type === "itemEquipped");
  assert.equal("discarded" in evt, false);
  assert.equal("destroyed" in evt, false);
});

test("takeItem (store delivery) over a destroyed worn piece: itemTaken carries the payload and no `replaced`", () => {
  const state = fixedState({ c: { ...DESTROYED } });
  const events = takeItem(state, ARMOR("Plate", 20), []);
  assert.equal(state.c.armor, "Plate");
  const evt = events.find((e) => e.type === "itemTaken");
  assert.ok(evt);
  assert.equal(evt.destroyed, true);
  assert.deepStrictEqual(evt.discarded, { kind: "armor", n: "Studded", armor: "Studded", ar: 15, left: 0 });
  assert.equal("replaced" in evt, false, "the outgoing piece is destroyed, never a `replaced` trade-in");
});

test("takeItem over a LIVE worn piece: no discarded/destroyed keys, `replaced` names the live piece exactly as today", () => {
  const state = fixedState({ c: { ...LIVE } });
  const events = takeItem(state, ARMOR("Plate", 20), []);
  const evt = events.find((e) => e.type === "itemTaken");
  assert.equal("discarded" in evt, false);
  assert.equal("destroyed" in evt, false);
  assert.equal(evt.replaced.armor, "Studded");
});

test("unequipSlot over a destroyed piece: itemUnequipped event is unchanged from today (the existing precedent)", () => {
  const state = fixedState({ c: { ...DESTROYED, items: [] } });
  const events = unequipSlot(state, "armor", []);
  const evt = events.find((e) => e.type === "itemUnequipped");
  assert.deepStrictEqual(evt, {
    type: "itemUnequipped",
    item: { kind: "armor", n: "Studded", armor: "Studded", ar: 15, left: 0 },
    slot: "armor",
    destroyed: true,
  });
});

test("in combat, each armor-replacing path is refused by the gear lock first and carries no payload", () => {
  const combat = { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false };

  const s1 = fixedState({ c: { ...DESTROYED, items: [ARMOR("Plate", 20)] }, combat });
  const e1 = equipItem(s1, 0, []);
  assert.ok(e1.some((e) => e.type === "gearRefused"));
  assert.equal(e1.some((e) => e.type === "itemEquipped"), false);
  assert.equal(s1.c.armor, "Studded", "state untouched");

  const s2 = fixedState({ c: { ...DESTROYED }, pendingLoot: [ARMOR("Plate", 20)], combat });
  const e2 = takeLoot(s2, 0, true, []);
  assert.ok(e2.some((e) => e.type === "gearRefused"));
  assert.equal(e2.some((e) => e.type === "itemEquipped"), false);
  assert.equal(s2.c.armor, "Studded", "state untouched");
});

// ─── Task 3: the paired Oracle/rail lines ───────────────────────────────────

test("EVENT_NARRATION.itemEquipped with destroyed/discarded: names the old piece as already in pieces, pairs in voice with the destroyed-unequip line", () => {
  const text = EVENT_NARRATION.itemEquipped({
    item: { n: "Plate" }, slot: "armor",
    destroyed: true, discarded: { kind: "armor", n: "Leather", armor: "Leather", ar: 6, left: 0 },
  });
  assert.match(text, /Leather/);
  assert.match(text, /already in pieces|pieces|destroyed/i);
});

test("EVENT_NARRATION.itemEquipped without the payload: byte-identical to today", () => {
  const withReplaced = EVENT_NARRATION.itemEquipped({ item: { n: "Plate" }, slot: "armor", replaced: { n: "Leather" } });
  assert.equal(
    withReplaced,
    `<span class="hit">Equipped:</span> Plate (armor). Whether that was wise is between you and the maze. Leather goes back in the bag — the maze is not a jeweller.`,
  );
  const bare = EVENT_NARRATION.itemEquipped({ item: { n: "Plate" }, slot: "armor" });
  assert.doesNotMatch(bare, /pieces|destroyed/i);
});

test("LINE_FOR.itemEquipped with destroyed/discarded: names the new piece and that the old one is gone", () => {
  const line = LINE_FOR.itemEquipped({
    item: { n: "Plate" }, slot: "armor",
    destroyed: true, discarded: { kind: "armor", n: "Leather", armor: "Leather", ar: 6, left: 0 },
  });
  assert.match(line.text, /Plate/);
  assert.match(line.text, /Leather/);
  assert.match(line.text, /gone|pieces|destroyed/i);
});

test("EVENT_NARRATION.itemTaken and LINE_FOR.itemTaken with the payload: say the same; the shopkeeper clause does not appear", () => {
  const evtText = EVENT_NARRATION.itemTaken({
    item: { n: "Plate" }, destroyed: true,
    discarded: { kind: "armor", n: "Leather", armor: "Leather", ar: 6, left: 0 },
  });
  assert.match(evtText, /Leather/);
  assert.doesNotMatch(evtText, /shopkeeper/);

  const lineText = LINE_FOR.itemTaken({
    item: { n: "Plate" }, destroyed: true,
    discarded: { kind: "armor", n: "Leather", armor: "Leather", ar: 6, left: 0 },
  }).text;
  assert.match(lineText, /Leather/);
  assert.doesNotMatch(lineText, /shopkeeper/);
});

test("itemTaken without the payload: byte-identical to today (both tables)", () => {
  assert.equal(
    EVENT_NARRATION.itemTaken({ item: { n: "Plate" } }),
    `<span class="hit">Equipped:</span> Plate.`,
  );
  assert.equal(LINE_FOR.itemTaken({ item: { n: "Plate" } }).text, "Equipped: Plate.");
});

// ─── Task 3: the Gear sheet worn-slot note ──────────────────────────────────

test("gearSheetModel WORN armor slot, destroyed worn piece, a fitting bag armor card: SWAP FOR sub states the worn armor is destroyed, then the comparison line", () => {
  const c = fixedChar({ ...DESTROYED, items: [{ kind: "armor", n: "Chain", armor: "Chain", ar: 12, wp: 24, left: 24, cls: "FTM" }] });
  const model = gearSheetModel({ c }, { from: "worn", slot: "armor" });
  const swapAction = model.actions.find((a) => a.key && a.key.startsWith("swap:"));
  assert.ok(swapAction, "a SWAP FOR candidate exists");
  assert.ok(swapAction.enabled, "Chain is a legal armor swap");
  assert.match(swapAction.sub, /destroyed/i, "leads with the discarded warning");
  assert.equal(swapAction.sub.startsWith(GEAR_SHEET_COPY.sub.discarded), true);
});

test("gearSheetModel WORN armor slot, LIVE worn piece: SWAP FOR sub reads exactly as today (no discarded prefix)", () => {
  const c = fixedChar({ ...LIVE, items: [{ kind: "armor", n: "Chain", armor: "Chain", ar: 12, wp: 24, left: 24, cls: "FTM" }] });
  const model = gearSheetModel({ c }, { from: "worn", slot: "armor" });
  const swapAction = model.actions.find((a) => a.key && a.key.startsWith("swap:"));
  assert.ok(swapAction);
  assert.equal(swapAction.sub.startsWith(GEAR_SHEET_COPY.sub.discarded), false);
});
