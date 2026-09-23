// test/unit/gear-sheet-dom.test.js
//
// Phase 63 (GSCR-07..10, GRULE-02), Plan 02 — renderGearSheet's DOM suite:
// render shape/a11y, dispatch order, the DROP tap-again confirm, encoding,
// idempotency and the module contract. Mirrors test/unit/gear-tab-dom.test.js's
// own spy/fixture/contract patterns; cross-checks every rendered value
// against gearSheetModel's own output (Plan 01) rather than retyping rule
// literals, except the strings the plan's <behavior> pins exactly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { fixedStates } from "./harness/shellSandbox.js";
import {
  renderGearSheet,
  gearSheetModel,
  GEAR_SHEET_IDS,
  GEAR_SHEET_COPY,
} from "../../src/browser/gearSheet.js";
import { GEAR_WORN_ORDER, gearBagCardsModel } from "../../src/browser/gearTab.js";
import { newRun } from "../../engine/engine.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fixtures (mirrors test/unit/gear-sheet-model.test.js's own fixedChar) ─

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter",
    race: "Human",
    level: 1,
    weapon: "Axe",
    armor: "Mail",
    ar: 12,
    armorWP: 30,
    armorMax: 30,
    magicWpn: 0,
    gold: 250,
    items: [],
    worn: {},
    potions: 0,
    scrolls: 0,
    rations: 3,
    kills: 2,
    wp: 10,
    maxWP: 10,
    timers: {},
    ...overrides,
  };
}
const st = (c) => ({ c });

const RING_OF_POWER = { kind: "jewelry", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet" };
const GAUNTLET = { kind: "jewelry", n: "Gauntlet of the Giant", txt: "used, you are one size larger for fifty squares; mind the ceilings, then fifty squares of shrinking back" };

// The acceptance fixture (mirrors gear-sheet-model.test.js's own spikedStaffState).
function spikedStaffState(combat) {
  const state = newRun(7);
  state.c.level = 3;
  state.c.weapon = "Quarter Staff";
  state.c.prof = 0;
  state.c.magicWpn = 0;
  state.c.items = [{ kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" }];
  if (combat) state.combat = { pending: true };
  return state;
}

// ─── spy deps: one shared ordered log ──────────────────────────────────────

function makeDeps() {
  const log = [];
  const guarded = [];
  const deps = {
    guardTap: (btn, fn) => {
      btn.onclick = fn;
      guarded.push(btn);
    },
    closeGearSheet: () => log.push(["closeGearSheet"]),
    equipItem: (...args) => log.push(["equipItem", ...args]),
    unequip: (...args) => log.push(["unequip", ...args]),
    useItem: (...args) => log.push(["useItem", ...args]),
    dropItem: (...args) => log.push(["dropItem", ...args]),
  };
  return { deps, log, guarded };
}

function mountHost() {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("mw-gear-sheet");
  return { doc, host };
}

function actionButtons(doc) {
  return doc.document.getElementById(GEAR_SHEET_IDS.actions).children;
}

function findButton(doc, key) {
  return actionButtons(doc).find((b) => b.dataset.key === key);
}

// ═══════════════════════ Task 1: header, actions, a11y, dispatch ══════════

test("renderGearSheet: fills label/title/note/why from the model; #mw-gear-sheet-why is hidden when why is ''", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const target = { from: "worn", slot: "jewelry1" };
  const model = gearSheetModel(state, target);
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  const result = renderGearSheet(host, state, target, deps);
  assert.equal(result, true);
  assert.equal(doc.document.getElementById(GEAR_SHEET_IDS.label).textContent, model.label);
  assert.equal(doc.document.getElementById(GEAR_SHEET_IDS.title).textContent, model.title);
  assert.equal(doc.document.getElementById(GEAR_SHEET_IDS.note).textContent, model.note);
  const whyEl = doc.document.getElementById(GEAR_SHEET_IDS.why);
  assert.equal(whyEl.textContent, model.why);
  assert.equal(whyEl.hidden, !model.why);
});

test("Actions: one <button class=mw-gsheet-act> per model action in order, with data-key/aria-label and a matching sub-span id/aria-describedby", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const target = { from: "worn", slot: "jewelry1" };
  const model = gearSheetModel(state, target);
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const buttons = actionButtons(doc);
  assert.equal(buttons.length, model.actions.length);
  buttons.forEach((btn, index) => {
    const a = model.actions[index];
    assert.equal(btn.tagName, "button");
    assert.equal(btn.type, "button");
    assert.equal(btn.className, "mw-gsheet-act");
    assert.equal(btn.dataset.key, a.key);
    assert.equal(btn.getAttribute("aria-label"), a.label);
    const main = btn.children.find((n) => n.className === "mw-gsheet-act-main");
    const labelSpan = main.children.find((n) => n.className === "mw-gsheet-act-label");
    const subSpan = main.children.find((n) => n.className === "mw-gsheet-act-sub");
    assert.equal(labelSpan.textContent, a.label);
    assert.equal(subSpan.textContent, a.sub);
    assert.equal(subSpan.id, `mw-gear-sheet-sub-${index}`);
    assert.equal(btn.getAttribute("aria-describedby"), subSpan.id);
    const chev = btn.children.find((n) => n.className === "mw-gsheet-chev");
    assert.equal(chev.getAttribute("aria-hidden"), "true");
  });
});

test("Enabled actions: guardTap wires every enabled action plus CANCEL; USE/UNEQUIP/SWAP FOR each log closeGearSheet then their dispatch", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const target = { from: "worn", slot: "jewelry1" };
  const model = gearSheetModel(state, target);
  const enabledCount = model.actions.filter((a) => a.enabled).length;
  const { deps, log, guarded } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  assert.equal(guarded.length, enabledCount + 1, "expected guardTap once per enabled action plus CANCEL");

  findButton(doc, "use").onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"], ["useItem", { slot: "jewelry1" }]]);

  log.length = 0;
  findButton(doc, "unequip").onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"], ["unequip", "jewelry1"]]);

  log.length = 0;
  findButton(doc, "swap:0").onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"], ["equipItem", 0, "jewelry1"]]);
});

test("Weapon swap dispatch: equipItem is called with exactly one argument, no undefined second arg recorded", () => {
  const shortSword = { kind: "weapon", base: "Short Sword", bonus: 0, n: "Short Sword", txt: "d6+2" };
  const c = fixedChar({ weapon: "Axe", items: [shortSword] });
  const state = st(c);
  const target = { from: "worn", slot: "weapon" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  findButton(doc, "swap:0").onclick();
  assert.equal(log.length, 2);
  assert.deepStrictEqual(log[1], ["equipItem", 0]);
  assert.equal(log[1].length, 2);
});

test("Bag staff USE: logs closeGearSheet then useItem(i)", () => {
  const staff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const c = fixedChar({ cls: "Magic User", items: [staff] });
  const state = st(c);
  const target = { from: "bag", i: 0, n: "Poplar Staff" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  findButton(doc, "use").onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"], ["useItem", 0]]);
});

test("Greyed: the thief fixture's jewelry1 UNEQUIP (full bag) carries data-off/aria-disabled, has no click handler, and its sub reads the bag-full line", () => {
  const { thief } = fixedStates();
  const target = { from: "worn", slot: "jewelry1" };
  const { deps, guarded } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, thief, target, deps);
  const unequipBtn = findButton(doc, "unequip");
  assert.equal(unequipBtn.dataset.off, "1");
  assert.equal(unequipBtn.getAttribute("aria-disabled"), "true");
  assert.equal(unequipBtn.onclick, null);
  const main = unequipBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const subSpan = main.children.find((n) => n.className === "mw-gsheet-act-sub");
  assert.equal(subSpan.textContent, "Bag is full — free a slot first.");
  assert.ok(!guarded.includes(unequipBtn), "guardTap must never be called for a greyed action");
});

test("Combat: SWAP INTO WEAPON greys with the model's reason, DROP stays wired; outside combat both are wired and #mw-gear-sheet-why shows the explained line", () => {
  const combatState = spikedStaffState(true);
  const target = { from: "bag", i: 0, n: "Spiked Staff" };
  const combatModel = gearSheetModel(combatState, target);
  const { deps: deps1 } = makeDeps();
  const { doc: doc1, host: host1 } = mountHost();
  renderGearSheet(host1, combatState, target, deps1);
  const swapBtn = findButton(doc1, "slot:weapon");
  assert.equal(swapBtn.dataset.off, "1");
  const main = swapBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const subSpan = main.children.find((n) => n.className === "mw-gsheet-act-sub");
  assert.equal(subSpan.textContent, combatModel.actions.find((a) => a.key === "slot:weapon").reason);
  const dropBtn1 = findButton(doc1, "drop");
  assert.equal(typeof dropBtn1.onclick, "function");

  const freeState = spikedStaffState(false);
  const { deps: deps2 } = makeDeps();
  const { doc: doc2, host: host2 } = mountHost();
  renderGearSheet(host2, freeState, target, deps2);
  const swapBtn2 = findButton(doc2, "slot:weapon");
  assert.equal(swapBtn2.dataset.off, undefined);
  assert.equal(typeof swapBtn2.onclick, "function");
  const dropBtn2 = findButton(doc2, "drop");
  assert.equal(typeof dropBtn2.onclick, "function");
  const whyEl = doc2.document.getElementById(GEAR_SHEET_IDS.why);
  assert.equal(whyEl.hidden, false);
  assert.equal(whyEl.textContent, "d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade");
});

test("Vanished target: returns false and the actions container receives no new children", () => {
  const c = fixedChar();
  const state = st(c);
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  const before = doc.document.getElementById(GEAR_SHEET_IDS.actions).children.length;
  const result = renderGearSheet(host, state, { from: "bag", i: 99, n: "x" }, deps);
  assert.equal(result, false);
  assert.equal(doc.document.getElementById(GEAR_SHEET_IDS.actions).children.length, before);
});

test("Returns true for every resolvable target across the thief and mu fixtures (all five worn slots plus every bag card)", () => {
  const { thief, mu } = fixedStates();
  for (const state of [thief, mu]) {
    for (const slot of GEAR_WORN_ORDER) {
      const { deps } = makeDeps();
      const { host } = mountHost();
      assert.equal(renderGearSheet(host, state, { from: "worn", slot }, deps), true, `expected ${slot} to resolve`);
    }
    for (const card of gearBagCardsModel(state)) {
      const { deps } = makeDeps();
      const { host } = mountHost();
      assert.equal(renderGearSheet(host, state, { from: "bag", i: card.i, n: card.name }, deps), true, `expected bag card ${card.name} to resolve`);
    }
  }
});

test("CANCEL: reads CANCEL and is wired through guardTap to closeGearSheet", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const target = { from: "worn", slot: "jewelry1" };
  const { deps, log, guarded } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const cancelBtn = doc.document.getElementById(GEAR_SHEET_IDS.cancel);
  assert.equal(cancelBtn.textContent, GEAR_SHEET_COPY.cancel);
  assert.ok(guarded.includes(cancelBtn));
  cancelBtn.onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"]]);
});

test("No node under the six GEAR_SHEET_IDS carries an HTML-string write", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, { from: "worn", slot: "jewelry1" }, deps);
  const visit = (node, out) => {
    out.push(node);
    for (const child of node.children || []) visit(child, out);
    return out;
  };
  const nodes = Object.values(GEAR_SHEET_IDS).flatMap((id) => visit(doc.document.getElementById(id), []));
  for (const node of nodes) {
    if (node.nodeType === 3) continue;
    assert.notEqual(node._content.kind, "html");
  }
});

test("Every greyed action across the mu fixture's armor sheet carries data-off/aria-disabled and no handler; every enabled one is wired", () => {
  const { mu } = fixedStates();
  const target = { from: "worn", slot: "armor" };
  const model = gearSheetModel(mu, target);
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, mu, target, deps);
  for (const a of model.actions) {
    const btn = findButton(doc, a.key);
    if (a.enabled) {
      assert.equal(typeof btn.onclick, "function");
      assert.equal(btn.dataset.off, undefined);
    } else {
      assert.equal(btn.dataset.off, "1");
      assert.equal(btn.getAttribute("aria-disabled"), "true");
      assert.equal(btn.onclick, null);
    }
  }
});
