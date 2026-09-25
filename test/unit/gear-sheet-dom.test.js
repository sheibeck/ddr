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
  SHEET_DROP_CONFIRM_MS,
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
  // Phase 74 (ROLL-02/03): the to-hit term now states which way it goes and
  // names the wielded weapon (Quarter Staff).
  assert.equal(whyEl.textContent, "d8 vs your d6 · −1 to hit, worse than your Quarter Staff · 4.1 vs 5.0 a swing · not an upgrade");
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

test("No node under the GEAR_SHEET_IDS roots (seven since Phase 71) carries an HTML-string write", () => {
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

// ═══════════════════════ Task 2: DROP confirm, CANCEL, encoding, idempotency ═

test("DROP first tap: arms in place — 'DROP IT? · tap again' label/aria-label, dataset.armed '1', no dispatch", () => {
  const state = spikedStaffState(false);
  const target = { from: "bag", i: 0, n: "Spiked Staff" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const dropBtn = findButton(doc, "drop");
  dropBtn.onclick();
  const main = dropBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const labelSpan = main.children.find((n) => n.className === "mw-gsheet-act-label");
  assert.equal(labelSpan.textContent, GEAR_SHEET_COPY.act.dropConfirm);
  assert.equal(dropBtn.getAttribute("aria-label"), GEAR_SHEET_COPY.act.dropConfirm);
  assert.equal(dropBtn.dataset.armed, "1");
  assert.deepStrictEqual(log, []);
});

test("DROP second tap within the window: logs close then dropItem(i); armed state clears", () => {
  const state = spikedStaffState(false);
  const target = { from: "bag", i: 0, n: "Spiked Staff" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const dropBtn = findButton(doc, "drop");
  dropBtn.onclick();
  dropBtn.onclick();
  assert.deepStrictEqual(log, [["closeGearSheet"], ["dropItem", 0]]);
  assert.equal(dropBtn.dataset.armed, undefined);
});

test("DROP reverts after SHEET_DROP_CONFIRM_MS: still armed at 2999ms, reverted at 3000ms with nothing dispatched", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = spikedStaffState(false);
  const target = { from: "bag", i: 0, n: "Spiked Staff" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const dropBtn = findButton(doc, "drop");
  dropBtn.onclick();
  t.mock.timers.tick(SHEET_DROP_CONFIRM_MS - 1);
  assert.equal(dropBtn.dataset.armed, "1");
  t.mock.timers.tick(1);
  assert.equal(dropBtn.dataset.armed, undefined);
  const main = dropBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const labelSpan = main.children.find((n) => n.className === "mw-gsheet-act-label");
  assert.equal(labelSpan.textContent, "DROP");
  assert.equal(dropBtn.getAttribute("aria-label"), "DROP");
  assert.deepStrictEqual(log, []);
});

test("Re-render while armed reverts: a fresh render's DROP reads DROP again, and a single tap only re-arms", () => {
  const state = spikedStaffState(false);
  const target = { from: "bag", i: 0, n: "Spiked Staff" };
  const { deps, log } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  findButton(doc, "drop").onclick();
  assert.equal(findButton(doc, "drop").dataset.armed, "1");

  renderGearSheet(host, state, target, deps);
  const freshDrop = findButton(doc, "drop");
  const main = freshDrop.children.find((n) => n.className === "mw-gsheet-act-main");
  const labelSpan = main.children.find((n) => n.className === "mw-gsheet-act-label");
  assert.equal(labelSpan.textContent, "DROP");
  assert.equal(freshDrop.dataset.armed, undefined);

  freshDrop.onclick();
  assert.equal(freshDrop.dataset.armed, "1");
  assert.deepStrictEqual(log, []);
});

const TRICKY_NAME = `Thief's "Lucky" <b>Ring</b> \u{1F3B2}`;

test("Edge GSCR-08/encoding: a hostile item name renders verbatim in the bag title, in a SWAP FOR label, and in a SWAP INTO sub", () => {
  // kind "jewel" (not the worn-row "jewelry") so engine/derived.js's slotFor
  // falls through to its kind-based fallback for a name SLOT_OF doesn't
  // recognize (a non-canonical item name, exactly this test's whole point).
  const bagChar = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [{ kind: "jewel", n: TRICKY_NAME, txt: "a strange ring" }] });
  const bagState = st(bagChar);

  const { doc: doc1, host: host1 } = mountHost();
  renderGearSheet(host1, bagState, { from: "bag", i: 0, n: TRICKY_NAME }, makeDeps().deps);
  assert.equal(doc1.document.getElementById(GEAR_SHEET_IDS.title).textContent, TRICKY_NAME);

  const { doc: doc2, host: host2 } = mountHost();
  renderGearSheet(host2, bagState, { from: "worn", slot: "jewelry1" }, makeDeps().deps);
  const swapBtn = findButton(doc2, "swap:0");
  const main2 = swapBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const labelSpan2 = main2.children.find((n) => n.className === "mw-gsheet-act-label");
  assert.equal(labelSpan2.textContent, "SWAP FOR " + TRICKY_NAME);

  const wornTrickyChar = fixedChar({ worn: { jewelry1: { kind: "jewelry", n: TRICKY_NAME, txt: "a strange ring" } }, items: [GAUNTLET] });
  const wornTrickyState = st(wornTrickyChar);
  const { doc: doc3, host: host3 } = mountHost();
  renderGearSheet(host3, wornTrickyState, { from: "bag", i: 0, n: "Gauntlet of the Giant" }, makeDeps().deps);
  const slotBtn = findButton(doc3, "slot:jewelry1");
  const main3 = slotBtn.children.find((n) => n.className === "mw-gsheet-act-main");
  const subSpan3 = main3.children.find((n) => n.className === "mw-gsheet-act-sub");
  assert.ok(subSpan3.textContent.startsWith(TRICKY_NAME));
});

test("Edge GSCR-08/encoding: no node under the GEAR_SHEET_IDS roots (seven since Phase 71) has _content.kind html", () => {
  const bagChar = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [{ kind: "jewel", n: TRICKY_NAME, txt: "a strange ring" }] });
  const { doc, host } = mountHost();
  renderGearSheet(host, st(bagChar), { from: "bag", i: 0, n: TRICKY_NAME }, makeDeps().deps);
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

test("Edge GSCR-09/ordering: closeGearSheet precedes every dispatch across the thief and Spiked Staff sheets, DROP via two taps included", () => {
  const cases = [
    { state: fixedStates().thief, target: { from: "worn", slot: "jewelry1" } },
    { state: spikedStaffState(false), target: { from: "bag", i: 0, n: "Spiked Staff" } },
  ];
  for (const { state, target } of cases) {
    const model = gearSheetModel(state, target);
    for (const a of model.actions) {
      if (!a.enabled) continue;
      const { deps, log } = makeDeps();
      const { doc, host } = mountHost();
      renderGearSheet(host, state, target, deps);
      const btn = findButton(doc, a.key);
      assert.ok(btn, `expected a button for ${a.key}`);
      btn.onclick();
      if (a.confirm) {
        assert.equal(log.length, 0, "the first tap of a confirm action must not dispatch");
        btn.onclick();
      }
      const closeIdx = log.findIndex((entry) => entry[0] === "closeGearSheet");
      const dispatchIdx = log.findIndex((entry) => entry[0] !== "closeGearSheet");
      assert.ok(closeIdx !== -1 && dispatchIdx !== -1, `expected both a close and a dispatch entry for ${a.key}`);
      assert.ok(closeIdx < dispatchIdx, `closeGearSheet must precede the dispatch for ${a.key}`);
    }
  }
});

test("Idempotency: rendering the same target twice on one host serializes every GEAR_SHEET_IDS root byte-identically", () => {
  const state = fixedStates().thief;
  const target = { from: "worn", slot: "jewelry1" };
  const { deps } = makeDeps();
  const { doc, host } = mountHost();
  renderGearSheet(host, state, target, deps);
  const first = doc.serializeElements(Object.values(GEAR_SHEET_IDS));
  renderGearSheet(host, state, target, deps);
  const second = doc.serializeElements(Object.values(GEAR_SHEET_IDS));
  assert.equal(second, first);
});

test("No WP: the serialized sheet for the thief's worn armor and bag sheets carries no standalone wp/WP token", () => {
  const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
  const { thief } = fixedStates();

  const { doc: doc1, host: host1 } = mountHost();
  renderGearSheet(host1, thief, { from: "worn", slot: "armor" }, makeDeps().deps);
  const text1 = doc1.serializeElements(Object.values(GEAR_SHEET_IDS));
  assert.equal(text1.match(PLAYER_WP), null, `unexpected wp/WP token: ${text1.match(PLAYER_WP) && text1.match(PLAYER_WP)[0]}`);

  const cards = gearBagCardsModel(thief);
  assert.ok(cards.length > 0, "expected the thief fixture to carry at least one bag card");
  const card = cards[0];
  const { doc: doc2, host: host2 } = mountHost();
  renderGearSheet(host2, thief, { from: "bag", i: card.i, n: card.name }, makeDeps().deps);
  const text2 = doc2.serializeElements(Object.values(GEAR_SHEET_IDS));
  assert.equal(text2.match(PLAYER_WP), null, `unexpected wp/WP token: ${text2.match(PLAYER_WP) && text2.match(PLAYER_WP)[0]}`);
});

// ─── Phase 71 (POLISH-06, D-04): the stats container ─────────────────────
//
// GEAR_SHEET_IDS grows from six roots to seven: `stats` is the one root the
// renderer creates itself (R-05 — no mazeworld.html edit in 71-02), inserted
// after #mw-gear-sheet-note and before #mw-gear-sheet-why inside the head.

/** mountSheetHead() — a host plus a real .mw-gsheet-head parent holding the
 * label/title/note/why roots in markup order, so the renderer's insertion
 * point can be observed (recordingDom's getElementById roots are otherwise
 * parentless). */
function mountSheetHead() {
  const { doc, host } = mountHost();
  const head = doc.document.createElement("div");
  head.className = "mw-gsheet-head";
  for (const key of ["label", "title", "note", "why"]) head.appendChild(doc.document.getElementById(GEAR_SHEET_IDS[key]));
  return { doc, host, head };
}

test("GEAR_SHEET_IDS: seven roots — the six markup roots plus the renderer-created stats container", () => {
  assert.equal(Object.keys(GEAR_SHEET_IDS).length, 7);
  assert.equal(GEAR_SHEET_IDS.stats, "mw-gear-sheet-stats");
  assert.ok(Object.isFrozen(GEAR_SHEET_IDS));
});

test("Stats: the container is created once, sits after the note and before why, and carries one mw-gsheet-note row per stat", () => {
  const c = fixedChar({ weapon: "Axe" });
  const state = st(c);
  const target = { from: "worn", slot: "weapon" };
  const model = gearSheetModel(state, target);
  assert.ok(model.stats.length >= 1);
  const { doc, host, head } = mountSheetHead();
  renderGearSheet(host, state, target, makeDeps().deps);

  const statsEl = doc.document.getElementById(GEAR_SHEET_IDS.stats);
  assert.deepStrictEqual(
    head.children.map((n) => n.id),
    [GEAR_SHEET_IDS.label, GEAR_SHEET_IDS.title, GEAR_SHEET_IDS.note, GEAR_SHEET_IDS.stats, GEAR_SHEET_IDS.why],
  );
  assert.equal(statsEl.parentNode, head);
  assert.equal(statsEl.hidden, false);
  assert.equal(statsEl.children.length, model.stats.length);
  statsEl.children.forEach((row, i) => {
    assert.ok(row.className.split(/\s+/).includes("mw-gsheet-note"), "each stat row reuses the note typography class");
    assert.equal(row.textContent, model.stats[i]);
    assert.notEqual(row._content.kind, "html");
  });

  // A second render reuses the same container and replaces its rows.
  renderGearSheet(host, state, target, makeDeps().deps);
  assert.equal(doc.document.getElementById(GEAR_SHEET_IDS.stats), statsEl);
  assert.equal(head.children.filter((n) => n.id === GEAR_SHEET_IDS.stats).length, 1);
  assert.equal(statsEl.children.length, model.stats.length);
});

test("Stats: an empty stat list hides the container and leaves it with no rows; re-targeting replaces, never appends", () => {
  const c = fixedChar({ weapon: "Axe", worn: {} });
  const state = st(c);
  const { doc, host } = mountSheetHead();
  renderGearSheet(host, state, { from: "worn", slot: "weapon" }, makeDeps().deps);
  const statsEl = doc.document.getElementById(GEAR_SHEET_IDS.stats);
  const weaponRows = statsEl.children.length;
  assert.ok(weaponRows > 0);

  assert.deepStrictEqual(gearSheetModel(state, { from: "worn", slot: "jewelry1" }).stats, []);
  renderGearSheet(host, state, { from: "worn", slot: "jewelry1" }, makeDeps().deps);
  assert.equal(statsEl.hidden, true);
  assert.equal(statsEl.children.length, 0);

  renderGearSheet(host, state, { from: "worn", slot: "weapon" }, makeDeps().deps);
  assert.equal(statsEl.hidden, false);
  assert.equal(statsEl.children.length, weaponRows);
});

test("Note: hidden when the model's note is empty (the stats carry it), shown otherwise", () => {
  const c = fixedChar({ worn: { jewelry1: RING_OF_POWER }, items: [GAUNTLET] });
  const state = st(c);
  const { doc, host } = mountSheetHead();
  renderGearSheet(host, state, { from: "worn", slot: "jewelry1" }, makeDeps().deps);
  const noteEl = doc.document.getElementById(GEAR_SHEET_IDS.note);
  assert.equal(noteEl.textContent, "");
  assert.equal(noteEl.hidden, true);
  renderGearSheet(host, state, { from: "worn", slot: "weapon" }, makeDeps().deps);
  assert.ok(noteEl.textContent.length > 0);
  assert.equal(noteEl.hidden, false);
});

// ─── Module contract (mirrors gear-tab-dom.test.js's own order-sensitive
// comment stripper) ──────────────────────────────────────────────────────

function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const GEAR_SHEET_STRIPPED = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearSheet.js"), "utf8").replace(/\r\n/g, "\n"));

test("Module contract: gearSheet.js reads no window/document global, reads ownerDocument at least once, and carries no HTML-string sink", () => {
  assert.doesNotMatch(GEAR_SHEET_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(GEAR_SHEET_STRIPPED, /\bdocument\./);
  assert.ok((GEAR_SHEET_STRIPPED.match(/ownerDocument/g) || []).length >= 1, "expected at least one ownerDocument read");
  // The three HTML-string sinks, built from split fragments so this test's
  // own source never contains the literal token (mirrors gear-tab-dom.test.js's
  // own encoding-pin discipline).
  const sinkNames = ["inner" + "HTML", "outer" + "HTML", "insertAdjacent" + "HTML"];
  for (const name of sinkNames) {
    assert.ok(!GEAR_SHEET_STRIPPED.includes(name), `gearSheet.js must not reference ${name}`);
  }
});
