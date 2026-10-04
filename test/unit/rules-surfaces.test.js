// test/unit/rules-surfaces.test.js
//
// Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05; CONTEXT 'Where the exact numbers
// live'): one rule on every surface. The flavour shows, the exact old text sits
// in a collapsed RULES body beside or under it, "Always show the rules" expands
// it with no toggle, a revealed body survives a repaint, and an item with no
// flavour renders as today.
//
// Plan 05 wires three surfaces and this file pins all three through the REAL
// classic paint()/renderEncounter()/renderRail() (test/unit/harness/
// shellSandbox.js) into a recording document:
//   - the Hero tab's Grimoire (src/browser/heroTab.js#renderGrimoire)
//   - the combat SPELLS and ITEMS rows (mazeworld.html#renderActionArea over
//     src/browser/combatMenu.js rows that carry lead / rules / rulesId)
//   - the find card's item line (mazeworld.html#renderRail's find branch)
//
// Extended by 95-06 (Gear) and 95-07 (store, sell, loot, drop): each adds its
// surface here so the layering rule stays pinned in one place.

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { clearRulesOpen, setAlwaysRules } from "../../src/browser/rulesLayer.js";
import { flavorOfItem, flavorOfIdentity } from "../../src/browser/flavorText.js";
import { renderHeroTab } from "../../src/browser/heroTab.js";
import { footerLines } from "../../src/browser/identityFooter.js";
import { RACES, RACE_NOTE, CLASS_NOTE, SUB_NOTE } from "../../content/index.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { SPELLS, NICHE_LABELS } from "../../content/index.js";
import { SPELL_FLAVOR } from "../../content/spells.js";
import { newRun } from "../../engine/state.js";
import { rollJewel, rollBlade, rollMailPiece, stowItem, toolItem } from "../../engine/items.js";
import { BAG_ITEMS, BAG_ORDER } from "../../content/index.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { renderGearTab, GEAR_COPY, gearWornModel, bagUsage, renderCarriedList } from "../../src/browser/gearTab.js";
import { usableBy, itemStatLines, wornItemFor, bagArmorText, dropShelfRows, lootCompare } from "../../src/browser/viewModels.js";
import { storeRowLayer } from "../../src/browser/storeScreen.js";
import { renderGearSheet, gearSheetModel, GEAR_SHEET_IDS } from "../../src/browser/gearSheet.js";
import { scrollReadOdds } from "../../src/browser/rollOdds.js";
import { WEAPON_FLAVOR } from "../../content/weapons.js";
import { ARMOR_FLAVOR } from "../../content/armors.js";
import { POTION_FLAVOR } from "../../content/potions.js";
import { validatePatchNotes } from "../../tools/lib/patch-notes.mjs";
import { SCROLL_FLAVOR } from "../../content/spells.js";
import { MAGIC_ITEM_FLAVOR } from "../../content/treasure-tables.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(__dirname, "..", "..", "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

beforeEach(() => {
  clearRulesOpen();
  setAlwaysRules(false);
});

// ─── helpers ──────────────────────────────────────────────────────────────

function walk(node, out = []) {
  for (const child of node.children || []) {
    if (child.nodeType === 3) continue;
    out.push(child);
    walk(child, out);
  }
  return out;
}

const hasClass = (el, name) => String(el.className || "").split(/\s+/).includes(name);
const textOf = (el) => String(el.textContent ?? "");
const findAll = (root, name) => walk(root).filter((el) => hasClass(el, name));
const tap = (button) => button.onclick({ stopPropagation() {} });

/** The text of the first <i>…</i> in a Grimoire row's innerHTML. */
const italicOf = (info) => /<i>([\s\S]*?)<\/i>/.exec(String(info.innerHTML))[1];

function paintGrimoire(book = ["Heal", "Doze"]) {
  const state = fixedStates().mu;
  state.c.grimoire = book;
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return { doc, sandbox, state };
}

const grimInfo = (doc, name) => {
  const ul = doc.document.getElementById("s-grimoire");
  const info = ul.children.map((li) => li.children[0]).find((i) => String(i.innerHTML).includes(`</span>${name}</b>`));
  assert.ok(info, `a Grimoire row for ${name}`);
  return info;
};

function foe(overrides = {}) {
  return { name: "Cave Rat", type: "Beasts", lvl: 1, size: "S", intel: 10, wp: 40, maxWP: 40, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** A mid-fight Magic User with a potion, a scroll and two spells, below full hp so the potion row is enabled. */
function fightState(cOverrides = {}) {
  const state = fixedStates().mu;
  Object.assign(state.c, {
    level: 3, wp: 20, maxWP: 40, potions: 2, scrolls: 1, grimoire: ["Heal", "Freeze"], spellsUsed: 0, items: [], abilities: [], ...cOverrides,
  });
  state.combat = { foes: [foe()], type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you", pending: false };
  return state;
}

function openMenu(state, which) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.context.window.__mzCombatMenu = { open: which };
  sandbox.context.renderEncounter();
  return { doc, sandbox, list: doc.document.getElementById("cb-sub-list") };
}

function paintFind(pendingFind, cls = "Fighter") {
  const state = newRun(9, [], { force: { cls } });
  if (pendingFind) state.pendingFind = pendingFind;
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  return { doc, sandbox, state, lines: doc.document.getElementById("mw-rail-lines") };
}

// ─── (a) the Grimoire ─────────────────────────────────────────────────────

test("(a) Grimoire: the italic line is niche label + flavour with no digit; the exact old text sits in a collapsed RULES body", () => {
  const { doc } = paintGrimoire();
  const heal = SPELLS.find((s) => s.n === "Heal");
  const info = grimInfo(doc, "Heal");
  const italic = italicOf(info);
  assert.ok(!/\d/.test(italic), `no digit on the flavour line: ${italic}`);
  assert.ok(italic.includes(SPELL_FLAVOR.Heal), italic);
  assert.ok(italic.startsWith(`${NICHE_LABELS[heal.niche]} · `), "the niche label stays as the leading category tag");

  const [button] = findAll(info, "mw-rules-btn");
  assert.ok(button, "a RULES toggle under the flavour");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  const [body] = findAll(info, "mw-rules-body");
  assert.equal(body.hidden, true);
  assert.equal(textOf(findAll(body, "mw-rules-line")[0]), heal.txt, "the body holds exactly Heal's txt");
});

test("(a) Grimoire: a foe-targeted spell's RULES body carries the txt and the resist sentence, in the old order", () => {
  const { doc } = paintGrimoire(["Doze"]);
  const doze = SPELLS.find((s) => s.n === "Doze");
  const info = grimInfo(doc, "Doze");
  const body = findAll(info, "mw-rules-body")[0];
  assert.match(textOf(findAll(body, "mw-rules-line")[0]), new RegExp(`^${doze.txt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · a foe may resist this on its intelligence`));
});

test("(a) Grimoire: tapping RULES opens the body, and a repaint keeps it open", () => {
  const { doc, sandbox } = paintGrimoire();
  const button = findAll(grimInfo(doc, "Heal"), "mw-rules-btn")[0];
  tap(button);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(findAll(grimInfo(doc, "Heal"), "mw-rules-body")[0].hidden, false);

  sandbox.paint();
  const again = grimInfo(doc, "Heal");
  assert.equal(findAll(again, "mw-rules-btn")[0].getAttribute("aria-expanded"), "true", "still open after a repaint");
  assert.equal(findAll(again, "mw-rules-body")[0].hidden, false);
  // the other row was never opened
  assert.equal(findAll(grimInfo(doc, "Doze"), "mw-rules-body")[0].hidden, true);
});

test("(a) Grimoire: with Always show the rules on there is no toggle and the body is visible", () => {
  setAlwaysRules(true);
  const { doc } = paintGrimoire();
  const info = grimInfo(doc, "Heal");
  assert.equal(findAll(info, "mw-rules-btn").length, 0);
  const body = findAll(info, "mw-rules-body")[0];
  assert.equal(body.hidden, false);
  assert.equal(textOf(findAll(body, "mw-rules-line")[0]), SPELLS.find((s) => s.n === "Heal").txt);
});

// ─── (b) the combat SPELLS rows ───────────────────────────────────────────

test("(b) combat SPELLS: each row's desc leads with its niche label and flavour, and the toggle is a sibling of the row button", () => {
  const state = fightState();
  const { list } = openMenu(state, "spells");
  const rows = combatMenuViewModel(state).submenus.spells.rows;
  assert.equal(list.children.length, 2);
  for (const [i, wrap] of list.children.entries()) {
    const vmRow = rows[i];
    const sp = SPELLS.find((s) => s.n.toUpperCase() === vmRow.label);
    assert.ok(hasClass(wrap, "mw-rules-wrap"), `${vmRow.label} is wrapped`);
    const [rowBtn, toggle, body] = wrap.children;
    assert.equal(rowBtn.id, `cb-row-${vmRow.id}`);
    assert.ok(hasClass(toggle, "mw-rules-btn"), "the toggle is the row button's sibling");
    assert.equal(findAll(rowBtn, "mw-rules-btn").length, 0, "the toggle is not inside the row button");
    const desc = textOf(findAll(rowBtn, "cb-row-desc")[0]);
    assert.ok(desc.startsWith(`${NICHE_LABELS[sp.niche]} · ${SPELL_FLAVOR[sp.n]}`), desc);
    assert.equal(desc, vmRow.lead, "the desc slot shows the lead");
    assert.equal(textOf(findAll(rowBtn, "cb-row-cost")[0]), vmRow.cost, "the functional tag stays");
    assert.equal(textOf(findAll(body, "mw-rules-line")[0]), vmRow.rules, "the body is the row's rules");
  }
  const freeze = textOf(findAll(list.children[0], "cb-row-desc")[0]);
  assert.ok(freeze.includes("Cave Rat resists on"), "the live resist hint stays visible on a foe-targeted spell");
});

test("(b) combat SPELLS: a revealed body survives a repaint; Always show the rules drops the toggle", () => {
  const state = fightState();
  const first = openMenu(state, "spells");
  const toggle = first.list.children[0].children[1];
  tap(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");

  first.sandbox.context.renderEncounter();
  const repainted = first.doc.document.getElementById("cb-sub-list").children[0];
  assert.equal(repainted.children[1].getAttribute("aria-expanded"), "true", "open across a repaint");

  setAlwaysRules(true);
  first.sandbox.context.renderEncounter();
  const always = first.doc.document.getElementById("cb-sub-list").children[0];
  assert.equal(findAll(always, "mw-rules-btn").length, 0);
  assert.equal(findAll(always, "mw-rules-body")[0].hidden, false);
});

// ─── (c) the combat ITEMS rows ────────────────────────────────────────────

test("(c) combat ITEMS: the POTION and SCROLL rows are wrapped and keep their n LEFT tags", () => {
  const state = fightState();
  const { list } = openMenu(state, "items");
  const byLabel = (label) => list.children.find((w) => textOf(findAll(w, "cb-row-label")[0]) === label);
  const potion = byLabel("POTION");
  const scroll = byLabel("SCROLL");
  for (const [wrap, tag] of [[potion, "2 LEFT"], [scroll, "1 LEFT"]]) {
    assert.ok(wrap && hasClass(wrap, "mw-rules-wrap"), "wrapped");
    assert.equal(textOf(findAll(wrap.children[0], "cb-row-cost")[0]), tag);
    assert.ok(hasClass(wrap.children[1], "mw-rules-btn"));
    assert.equal(findAll(wrap.children[0], "mw-rules-btn").length, 0, "the toggle is outside the row button");
  }
  const rows = combatMenuViewModel(state).submenus.items.rows;
  assert.equal(textOf(findAll(potion.children[0], "cb-row-desc")[0]), rows.find((r) => r.id === "potion").lead);
  assert.equal(textOf(findAll(scroll.children[0], "cb-row-desc")[0]), rows.find((r) => r.id === "scroll").lead);
  assert.equal(textOf(findAll(scroll.children[2], "mw-rules-line")[0]), rows.find((r) => r.id === "scroll").rules);
});

test("(c) combat ITEMS: a not-equipped reason row is not wrapped and keeps its reason text", () => {
  const state = fightState({
    items: [{ n: "Ring of Power", kind: "jewel", eff: { dmg: 1 }, txt: "+1 damage" }],
    worn: { jewelry1: null, jewelry2: null, cloak: null },
  });
  const { list } = openMenu(state, "items");
  const reason = list.children.find((el) => el.id === "cb-row-item-0");
  assert.ok(reason, "the reason row is a bare row button, not a wrapper");
  assert.ok(hasClass(reason, "cb-row"));
  assert.equal(findAll(reason, "mw-rules-btn").length, 0);
});

test("(c) combat ABILITIES: an ability row is not wrapped", () => {
  const state = fightState({ cls: "Fighter", sub: "Soldier", grimoire: [], abilities: ["kata"] });
  const { list } = openMenu(state, "abilities");
  assert.ok(list.children.length >= 1);
  for (const el of list.children) {
    assert.ok(!hasClass(el, "mw-rules-wrap"), "no wrapper on an ability row");
    assert.ok(hasClass(el, "cb-row"));
  }
  assert.equal(findAll(list, "mw-rules-btn").length, 0);
});

// ─── (d) the find card ────────────────────────────────────────────────────

test("(d) find card: the item line reads name · flavour, and a RULES toggle outside the typed lines holds the old text", () => {
  const jewel = rollJewel(makeRng(5));
  const flavor = flavorOfItem(jewel);
  assert.ok(flavor.length > 0, "the rolled jewel has a flavour line");
  const { lines } = paintFind(jewel);
  const itemLine = lines.children.filter((el) => hasClass(el, "mw-rail-line")).find((el) => textOf(el).startsWith(`${jewel.n} · `));
  assert.ok(itemLine, `an item line for ${jewel.n}`);
  assert.ok(textOf(itemLine).includes(flavor), textOf(itemLine));
  assert.ok(!textOf(itemLine).includes(jewel.txt), "the rules text is not on the typed line");

  const toggles = lines.children.filter((el) => hasClass(el, "mw-rules-btn"));
  assert.equal(toggles.length, 1);
  assert.ok(!hasClass(toggles[0], "mw-rail-line") && !hasClass(toggles[0], "mw-rail-roll"), "the toggle is not a typed line element");
  assert.equal(toggles[0].getAttribute("aria-expanded"), "false");
  const body = lines.children.find((el) => hasClass(el, "mw-rules-body"));
  assert.equal(body.hidden, true);
  assert.equal(textOf(findAll(body, "mw-rules-line")[0]), jewel.txt);
});

test("(d) find card: tapping RULES opens the body and survives a repaint; Always show the rules expands it", () => {
  const jewel = rollJewel(makeRng(5));
  const { lines, sandbox, doc } = paintFind(jewel);
  tap(lines.children.find((el) => hasClass(el, "mw-rules-btn")));
  sandbox.context.renderRail();
  const again = doc.document.getElementById("mw-rail-lines");
  assert.equal(again.children.find((el) => hasClass(el, "mw-rules-btn")).getAttribute("aria-expanded"), "true");
  assert.equal(again.children.find((el) => hasClass(el, "mw-rules-body")).hidden, false);

  clearRulesOpen();
  setAlwaysRules(true);
  sandbox.context.renderRail();
  const always = doc.document.getElementById("mw-rail-lines");
  assert.equal(always.children.filter((el) => hasClass(el, "mw-rules-btn")).length, 0);
  assert.equal(always.children.find((el) => hasClass(el, "mw-rules-body")).hidden, false);
});

test("(d) find card: a RULES tap never reaches the rail's dismiss handler (stopPropagation, plus an early return ahead of the arm check)", () => {
  const { lines } = paintFind(rollJewel(makeRng(5)));
  const toggle = lines.children.find((el) => hasClass(el, "mw-rules-btn"));
  let stopped = false;
  toggle.onclick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true, "the toggle stops the tap from bubbling to the card");

  const handler = HTML.slice(HTML.indexOf('document.getElementById("mw-rail").onclick'));
  const guardAt = handler.indexOf('closest(".mw-rules-btn")');
  const armAt = handler.indexOf("isArmed(railShownAt");
  assert.ok(guardAt > 0 && armAt > 0 && guardAt < armAt, "the RULES early return sits before the arm window, the typewriter completion and the pulse");
});

// ─── (e) tolerant load ────────────────────────────────────────────────────

test("(e) Tolerant load: a removed item an old save may hold shows name · its own text and no toggle", () => {
  const { lines } = paintFind({ kind: "jewel", n: "Cloak of Healing", txt: "an old cloak's text" });
  const itemLine = lines.children.filter((el) => hasClass(el, "mw-rail-line")).find((el) => textOf(el).startsWith("Cloak of Healing"));
  assert.ok(itemLine, "an item line for the removed cloak");
  assert.ok(textOf(itemLine).startsWith("Cloak of Healing · an old cloak's text"), textOf(itemLine));
  assert.equal(lines.children.filter((el) => hasClass(el, "mw-rules-btn") || hasClass(el, "mw-rules-body")).length, 0, "no toggle, no body");
});

// ─── Gear tab (Plan 06, Task 1): helpers copied by value from gear-tab-dom.test.js ───

function gearChar(overrides = {}) {
  return {
    cls: "Fighter",
    race: "Human",
    level: 1,
    weapon: "Long Sword",
    armor: "Leather",
    ar: 8,
    armorWP: 20,
    armorMax: 20,
    magicWpn: 0,
    gold: 250,
    items: [],
    worn: {},
    bag: "small",
    potions: 2,
    scrolls: 0,
    rations: 3,
    kills: 2,
    wp: 4,
    maxWP: 10,
    timers: {},
    ...overrides,
  };
}

const RING = { kind: "jewel", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet", eff: { dmg: 1 } };
const ANKLET = { kind: "jewel", n: "Anklet of Invisibility", txt: "used, foes aim at -2 for fifty squares; then fifty squares of visibility", eff: { foeToHit: -2 } };
const OLD_CLOAK = { kind: "jewel", n: "Cloak of Healing", txt: "an old cloak's text" };

function gearDeps() {
  const spy = () => Object.assign((...a) => spy.calls.push(a), { calls: [] });
  return { useItem: spy(), unequip: spy(), equipItem: spy(), dropItem: spy(), drinkPotion: spy(), readScroll: spy(), openGearSheet: spy() };
}

function paintGear(state, doc = createRecordingDocument()) {
  renderGearTab(doc.document.getElementById("screen-gear"), state, gearDeps());
  return doc;
}

const wornLi = (doc, slot) => doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === slot);
const mainOf = (li) => li.children.find((n) => hasClass(n, "mw-gear-main") || hasClass(n, "mw-gear-card-main"));
const noteOf = (li) => mainOf(li).children.find((n) => hasClass(n, "mw-gear-note"));
const descOf = (li) => mainOf(li).children.find((n) => hasClass(n, "mw-gear-desc"));
const bagLi = (doc, i) => doc.document.getElementById("gear-bag").children.find((li) => li.dataset.i === String(i));
const consLi = (doc, key) => doc.document.getElementById("gear-cons").children.find((li) => li.dataset.key === key);
const rulesLinesOf = (main) => findAll(main, "mw-rules-line").map(textOf);

// ─── (f) Gear tab: WORN rows ──────────────────────────────────────────────

test("(f) Gear WORN: a flavoured row shows its flavour and no toggle; the armour row keeps its wear note; Always on shows the exact old line statically", () => {
  const state = { c: gearChar({ worn: { jewelry1: RING } }) };
  const doc = paintGear(state);
  const jewel = wornLi(doc, "jewelry1");
  assert.equal(textOf(noteOf(jewel)), MAGIC_ITEM_FLAVOR["Ring of Power"]);
  assert.doesNotMatch(textOf(noteOf(jewel)), /\d/, "the flavour line has no digit");
  assert.equal(textOf(noteOf(wornLi(doc, "weapon"))), WEAPON_FLAVOR["Long Sword"]);
  const armourNote = gearWornModel(state).rows.find((r) => r.key === "armor").note;
  assert.equal(textOf(noteOf(wornLi(doc, "armor"))), armourNote, "the armour row keeps its live wear note");
  assert.match(armourNote, /\d/, "the wear note is state, with numbers");
  assert.equal(findAll(doc.document.getElementById("gear-worn"), "mw-rules-btn").length, 0, "WORN rows are openers: no toggle");
  assert.equal(findAll(doc.document.getElementById("gear-worn"), "mw-rules-body").length, 0);

  setAlwaysRules(true);
  const again = paintGear(state);
  const jewelOn = wornLi(again, "jewelry1");
  assert.deepEqual(rulesLinesOf(mainOf(jewelOn)), [RING.txt]);
  assert.equal(findAll(mainOf(jewelOn), "mw-rules-body")[0].hidden, false);
  assert.equal(findAll(again.document.getElementById("gear-worn"), "mw-rules-btn").length, 0);
  assert.deepEqual(rulesLinesOf(mainOf(wornLi(again, "weapon"))), [GEAR_COPY.weaponMundane]);
  assert.equal(findAll(mainOf(wornLi(again, "armor")), "mw-rules-body").length, 0, "the armour row carries no rules body");
  assert.ok(jewelOn.children.every((n) => n.className !== "mw-rules-body"), "the body is inside main, never a direct child of the li");
});

// ─── (g) Gear tab: BAG cards ──────────────────────────────────────────────

test("(g) Gear BAG: a card shows its flavour (plus the usable-by tag for armour), no toggle; Always on shows the exact old desc", () => {
  const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const state = { c: gearChar({ items: [ANKLET, studded] }) };
  const doc = paintGear(state);
  const usable = usableBy(studded, state.c);
  assert.equal(textOf(descOf(bagLi(doc, 0))), MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]);
  assert.equal(textOf(descOf(bagLi(doc, 1))), usable ? `${ARMOR_FLAVOR.Studded} ${usable}` : ARMOR_FLAVOR.Studded);
  assert.equal(findAll(doc.document.getElementById("gear-bag"), "mw-rules-btn").length, 0);

  setAlwaysRules(true);
  const again = paintGear(state);
  assert.deepEqual(rulesLinesOf(mainOf(bagLi(again, 0))), [ANKLET.txt]);
  assert.deepEqual(rulesLinesOf(mainOf(bagLi(again, 1))), [usable ? `AR 10 · 18/18 hp ${usable}` : "AR 10 · 18/18 hp"]);
  assert.equal(findAll(again.document.getElementById("gear-bag"), "mw-rules-btn").length, 0);
});

// ─── (h) Gear tab: CONSUMABLES ────────────────────────────────────────────

test("(h) Gear CONSUMABLES: each row shows flavour then a collapsed RULES toggle with the exact old text; a tap reveals it and a repaint keeps it open", () => {
  const state = { c: gearChar({ scrolls: 2 }) };
  const doc = paintGear(state);
  const heal = consLi(doc, "heal");
  assert.equal(textOf(descOf(heal)), POTION_FLAVOR.Healing);
  const main = mainOf(heal);
  const btn = findAll(main, "mw-rules-btn")[0];
  const body = findAll(main, "mw-rules-body")[0];
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(body.hidden, true);
  assert.deepEqual(rulesLinesOf(main), [GEAR_COPY.healingDesc]);
  assert.ok(main.children.indexOf(btn) > main.children.indexOf(descOf(heal)), "the toggle sits after the description");
  tap(btn);
  assert.equal(body.hidden, false);
  const fresh = paintGear(state);
  assert.equal(findAll(mainOf(consLi(fresh, "heal")), "mw-rules-body")[0].hidden, false, "a repaint keeps it revealed");

  const scroll = consLi(doc, "scroll");
  assert.equal(textOf(descOf(scroll)), SCROLL_FLAVOR);
  assert.deepEqual(rulesLinesOf(mainOf(scroll)), [`${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}`]);
  assert.ok(scroll.children.some((n) => hasClass(n, "mw-gear-cons-btn")), "the READ button is unchanged");

  clearRulesOpen();
  setAlwaysRules(true);
  const on = paintGear(state);
  assert.equal(findAll(on.document.getElementById("gear-cons"), "mw-rules-btn").length, 0);
  assert.equal(findAll(mainOf(consLi(on, "heal")), "mw-rules-body")[0].hidden, false);
});

// ─── (i) Gear tab: tolerant load ──────────────────────────────────────────

test("(i) Tolerant load: a bagged removed item an old save may hold shows its own text and no rules body, even with Always on", () => {
  const state = { c: gearChar({ items: [OLD_CLOAK] }) };
  for (const on of [false, true]) {
    setAlwaysRules(on);
    const doc = paintGear(state);
    assert.equal(textOf(descOf(bagLi(doc, 0))), "an old cloak's text");
    assert.equal(findAll(bagLi(doc, 0), "mw-rules-btn").length + findAll(bagLi(doc, 0), "mw-rules-body").length, 0);
  }
});

// ─── Gear sheet (Plan 06, Task 2) ─────────────────────────────────────────

function openSheet(state, target) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("mw-gear-sheet");
  const render = () => renderGearSheet(host, state, target, {});
  assert.equal(render(), true);
  return { doc, render, get: (id) => doc.document.getElementById(GEAR_SHEET_IDS[id]) };
}

// ─── (j) the bagged Anklet's sheet ────────────────────────────────────────

test("(j) Gear sheet, bag: the note shows the flavour; RULES sit around the stats (collapsed, exact old stats), a tap opens it, a re-render keeps it open; Always on shows the body with no button", () => {
  const state = { c: gearChar({ items: [ANKLET] }) };
  const target = { from: "bag", i: 0, n: "Anklet of Invisibility" };
  const oldStats = itemStatLines(ANKLET, state.c).map((l) => l.text);
  assert.ok(oldStats.length > 0, "the Anklet has stat lines to hide");
  const sheet = openSheet(state, target);
  assert.equal(textOf(sheet.get("note")), MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]);
  assert.equal(sheet.get("note").hidden, false);
  const statsEl = sheet.get("stats");
  const btn = findAll(statsEl, "mw-rules-btn")[0];
  const body = findAll(statsEl, "mw-rules-body")[0];
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(body.hidden, true);
  assert.deepEqual(findAll(body, "mw-rules-line").map(textOf), oldStats);
  assert.ok(findAll(body, "mw-rules-line").every((p) => hasClass(p, "mw-gsheet-note") && hasClass(p, "mw-gsheet-stat")));
  tap(btn);
  assert.equal(body.hidden, false);
  sheet.render();
  assert.equal(findAll(sheet.get("stats"), "mw-rules-body")[0].hidden, false, "a revealed body stays open when the sheet re-renders");

  clearRulesOpen();
  setAlwaysRules(true);
  const on = openSheet(state, target);
  assert.equal(findAll(on.get("stats"), "mw-rules-btn").length, 0);
  assert.equal(findAll(on.get("stats"), "mw-rules-body")[0].hidden, false);
  assert.deepEqual(findAll(on.get("stats"), "mw-rules-line").map(textOf), oldStats);
});

// ─── (k) the worn weapon's sheet ──────────────────────────────────────────

test("(k) Gear sheet, worn weapon: the note shows the weapon flavour; the RULES body holds the exact old voice line then every stat line", () => {
  const state = { c: gearChar() };
  const stats = itemStatLines(wornItemFor(state.c, "weapon"), state.c).map((l) => l.text);
  const sheet = openSheet(state, { from: "worn", slot: "weapon" });
  assert.equal(textOf(sheet.get("note")), WEAPON_FLAVOR["Long Sword"]);
  assert.deepEqual(findAll(sheet.get("stats"), "mw-rules-line").map(textOf), [GEAR_COPY.weaponMundane, ...stats]);
});

// ─── (l) candidate subs and tolerant load ─────────────────────────────────

test("(l) Gear sheet: a jewel SWAP FOR candidate's sub is that jewel's flavour; an old save's removed item renders note and stats as before with no toggle", () => {
  const state = { c: gearChar({ worn: { jewelry1: RING }, items: [ANKLET] }) };
  const model = gearSheetModel(state, { from: "worn", slot: "jewelry1" });
  const swap = model.actions.find((a) => a.key === "swap:0");
  assert.equal(swap.sub, MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]);
  const sheet = openSheet(state, { from: "worn", slot: "jewelry1" });
  assert.ok(findAll(sheet.get("actions"), "mw-gsheet-act-sub").map(textOf).includes(MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]));

  const old = { c: gearChar({ items: [OLD_CLOAK] }) };
  const target = { from: "bag", i: 0, n: "Cloak of Healing" };
  const before = gearSheetModel(old, target);
  assert.ok(!("lead" in before) && !("rules" in before) && !("rulesId" in before));
  for (const on of [false, true]) {
    setAlwaysRules(on);
    const s = openSheet(old, target);
    assert.equal(textOf(s.get("note")), before.note);
    assert.deepEqual(findAll(s.get("stats"), "mw-gsheet-stat").map(textOf), before.stats);
    assert.equal(findAll(s.get("stats"), "mw-rules-btn").length + findAll(s.get("stats"), "mw-rules-body").length, 0);
  }
});

// ─── Plan 07: the store, the Sealed scroll and the Your gear sell list ────

/** Paints the store the way the shell does: setState, then renderEncounter(). */
function paintStore(state, existing = null) {
  const doc = existing ? existing.doc : createRecordingDocument();
  const sandbox = existing ? existing.sandbox : loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.renderEncounter();
  return { doc, sandbox, shelf: doc.document.getElementById("shelf"), sell: doc.document.getElementById("sell-list") };
}

const italicIn = (el) => {
  const m = /<i>([\s\S]*?)<\/i>/.exec(String(el.innerHTML));
  return m ? m[1] : null;
};

/** The stock button whose name span starts with `name`. */
function stockButton(shelf, name) {
  const buttons = shelf.children.flatMap((n) => (hasClass(n, "mw-rules-wrap") ? [n.children[0]] : [n]));
  const b = buttons.find((x) => String(x.innerHTML).includes(`<span class="g-n">${name}`));
  assert.ok(b, `a stock row for ${name}`);
  return b;
}

/** The mw-rules-wrap a stock button sits in, or null when it is appended bare. */
const wrapOf = (shelf, button) => shelf.children.find((n) => hasClass(n, "mw-rules-wrap") && n.children[0] === button) || null;

test("(m0) storeRowLayer: food, rations and repairs return null; a potion leads with its flavour and hides the exact old stat text", () => {
  const c = fixedStates().thiefStore.c;
  const state = fixedStates().thiefStore;
  assert.equal(storeRowLayer({ n: "Bread", effectId: "eatRation", effectParams: { wp: 5 }, sub: null }, c, state, true, null), null);
  assert.equal(storeRowLayer({ n: "Rations (+1 ration)", effectId: "buyRations", effectParams: { amount: 1 } }, c, state, true, "3 left"), null);
  assert.equal(storeRowLayer({ n: "Repair your leather", effectId: "repairArmor", effectParams: null }, c, state, true, "4 points"), null);
  assert.equal(storeRowLayer({ n: "Mystery", effectId: "givePotion", effectParams: { item: { kind: "potion", n: "Mystery potion", eff2: "nope" } } }, c, state, true, "x"), null);
  const potion = state.store.stock.find((l) => l.effectId === "givePotion" && l.effectParams.item.eff2 === "heal");
  const layer = storeRowLayer(potion, c, state, false, "+d10+2 hp");
  assert.equal(layer.lead, POTION_FLAVOR.Healing);
  assert.equal(layer.rules, "+d10+2 hp");
});

test("(m) store: a flavoured stock row leads with its flavour, keeps count/compare/reason, and its exact old stat line sits behind a RULES toggle that is a sibling of BUY", () => {
  const state = fixedStates().thiefStore;
  const { shelf } = paintStore(state);

  const heal = stockButton(shelf, "Healing potion");
  const healWrap = wrapOf(shelf, heal);
  assert.ok(healWrap, "the Healing potion row is wrapped");
  const lead = italicIn(heal);
  assert.ok(lead.startsWith(POTION_FLAVOR.Healing), lead);
  assert.ok(!/\d/.test(lead.split(" · ")[0]), "no digit before the first separator");
  assert.equal(findAll(heal, "mw-rules-btn").length, 0, "the toggle is never inside the BUY button");
  const [btn] = findAll(healWrap, "mw-rules-btn");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.ok(healWrap.children.includes(btn) && healWrap.children[0] === heal, "the toggle is the BUY button's sibling");
  const [body] = findAll(healWrap, "mw-rules-body");
  assert.equal(body.hidden, true);
  assert.deepEqual(findAll(body, "mw-rules-line").map(textOf), ["+d10+2 hp"]);

  // The compare line (advice) stays visible in the italic.
  const weapon = state.store.stock.find((l) => l.effectId === "buyWeapon");
  const wb = stockButton(shelf, weapon.n);
  assert.match(italicIn(wb), /(upgrade|not an upgrade)(?= ·|$)/);
  assert.ok(wrapOf(shelf, wb), "weapon rows are wrapped too");

  // Rations are unwrapped and unchanged.
  const rations = stockButton(shelf, "Rations (+1 ration)");
  assert.equal(wrapOf(shelf, rations), null);
  assert.match(italicIn(rations), /^\d+ left$/);
  assert.ok(shelf.children.includes(rations), "Rations are appended bare");

  tap(btn);
  assert.equal(body.hidden, false);
});

test("(m) store: a revealed body survives a repaint; Always on shows every body with no toggle", () => {
  const state = fixedStates().thiefStore;
  const first = paintStore(state);
  const heal = stockButton(first.shelf, "Healing potion");
  tap(findAll(wrapOf(first.shelf, heal), "mw-rules-btn")[0]);
  const second = paintStore(state, first);
  const wrap2 = wrapOf(second.shelf, stockButton(second.shelf, "Healing potion"));
  assert.equal(findAll(wrap2, "mw-rules-body")[0].hidden, false, "still open after the repaint");

  clearRulesOpen();
  setAlwaysRules(true);
  const on = paintStore(state);
  const wrap = wrapOf(on.shelf, stockButton(on.shelf, "Healing potion"));
  assert.equal(findAll(wrap, "mw-rules-btn").length, 0);
  assert.equal(findAll(wrap, "mw-rules-body")[0].hidden, false);
});

test("(n) store: the Sealed scroll row shows the scroll flavour; its RULES hold the scroll's rules as the Gear SCROLLS row states them", () => {
  const state = fixedStates().muStore;
  const { shelf } = paintStore(state);
  const b = stockButton(shelf, "Sealed scroll");
  assert.ok(italicIn(b).startsWith(SCROLL_FLAVOR), italicIn(b));
  const wrap = wrapOf(shelf, b);
  assert.ok(wrap, "the Sealed scroll row is wrapped");
  assert.deepEqual(findAll(wrap, "mw-rules-line").map(textOf), [`${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}`]);
  assert.equal(findAll(wrap, "mw-rules-body")[0].hidden, true);
});

test("(o) Your gear sell list: each flavoured row shows its flavour with a collapsed toggle holding the exact old line; a tap opens it and a repaint keeps it open", () => {
  const state = fixedStates().thiefStore;
  const first = paintStore(state);
  const lis = first.sell.children;
  assert.equal(lis.length, state.c.items.length);
  let flavoured = 0;
  lis.forEach((li, i) => {
    const it = state.c.items[i];
    const flavor = flavorOfItem(it);
    const old = it.kind === "armor" ? bagArmorText(it) : (it.txt ?? "");
    const [italic] = li.children.filter((n) => n.tagName === "I" || n.tagName === "i");
    if (!flavor) {
      assert.equal(textOf(italic), old);
      assert.equal(findAll(li, "mw-rules-btn").length, 0);
      return;
    }
    flavoured++;
    assert.equal(textOf(italic), flavor);
    const [btn] = findAll(li, "mw-rules-btn");
    const [body] = findAll(li, "mw-rules-body");
    assert.equal(btn.getAttribute("aria-expanded"), "false");
    assert.equal(body.hidden, true);
    assert.deepEqual(findAll(body, "mw-rules-line").map(textOf), [old]);
  });
  assert.ok(flavoured >= 3, "the fixture sells several flavoured items");

  tap(findAll(lis[0], "mw-rules-btn")[0]);
  const second = paintStore(state, first);
  assert.equal(findAll(second.sell.children[0], "mw-rules-body")[0].hidden, false, "open after a second renderEncounter");
});

// ─── Plan 07: the bag-full drop shelf and the loot card's list ────────────

// bagState and findScenario are copied by value from find-card-full-bag.test.js (the drop shelf's real find card).
function fullBagState({ seed = 7, extra = [] } = {}) {
  const state = newRun(seed, [], { force: { cls: "Fighter" } });
  const largest = BAG_ORDER[BAG_ORDER.length - 1];
  stowItem(state, { ...BAG_ITEMS[largest] }, [], true);
  const rng = makeRng(31);
  const makers = [() => rollBlade(rng, 3, true), () => rollMailPiece(rng), () => rollJewel(rng), () => toolItem("rope"), () => rollBlade(rng, 5, false)];
  for (const it of extra) stowItem(state, it, [], true);
  let k = 0;
  while (bagUsage(state.c).slots - bagUsage(state.c).have > 0) {
    stowItem(state, makers[k++ % makers.length](), [], true);
    assert.ok(k < 100, "the bag fills");
  }
  return state;
}

function findShelf(state, find) {
  offerFind(state, find, []);
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  const drops = [];
  sandbox.context.window.mzDropItem = (i) => drops.push(i);
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  const linesEl = doc.document.getElementById("mw-rail-lines");
  const region = linesEl.children.find((el) => hasClass(el, "mw-find-drop"));
  assert.ok(region, "the drop region is rendered");
  return { doc, sandbox, region, drops };
}

test("(p) drop shelf (find card): a flavoured row is a RULES wrapper around the Drop button; the flavour is in the button, the body holds the stat line, the toggle never drops", () => {
  const state = fullBagState();
  const rows = dropShelfRows(state.c);
  const { region, drops } = findShelf(state, rollBlade(makeRng(5), 4, true));
  assert.equal(region.children.length, rows.length);
  let flavoured = 0;
  region.children.forEach((el, n) => {
    const row = rows[n];
    const flavor = flavorOfItem(row.it);
    if (!flavor) {
      assert.equal(el.tagName, "button", "an unflavoured row is the bare button, as before");
      return;
    }
    flavoured++;
    assert.ok(hasClass(el, "mw-rules-wrap"), `row ${n} is wrapped`);
    const [button, toggle, body] = el.children;
    assert.ok(hasClass(button, "goods"));
    const tag = usableBy(row.it, state.c);
    assert.equal(italicOf(button), tag ? `${flavor} ${tag}` : flavor);
    assert.equal(findAll(button, "mw-rules-btn").length, 0, "the toggle is never inside the Drop button");
    assert.ok(hasClass(toggle, "mw-rules-btn"));
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(body.hidden, true);
    assert.deepEqual(findAll(body, "mw-rules-line").map(textOf), [row.stats]);
  });
  assert.ok(flavoured >= 3, "the fixture bag holds several flavoured items");

  // A toggle tap opens the body and drops nothing; a clean tap on the button drops that row's true index.
  const wrap = region.children.find((el) => hasClass(el, "mw-rules-wrap"));
  tap(wrap.children[1]);
  assert.equal(wrap.children[2].hidden, false);
  assert.deepEqual(drops, []);
  wrap.children[0].onclick();
  assert.deepEqual(drops, [rows[region.children.indexOf(wrap)].i]);

  clearRulesOpen();
  setAlwaysRules(true);
  const on = findShelf(fullBagState(), rollBlade(makeRng(5), 4, true));
  const w2 = on.region.children.find((el) => hasClass(el, "mw-rules-wrap"));
  assert.equal(findAll(w2, "mw-rules-btn").length, 0);
  assert.equal(w2.children[1].hidden, false);
});

/**
 * The loot card's list. The recording document cannot parse the card's innerHTML (the host the branch queries for #loot-list), so the sandbox cannot
 * reach the loot branch; renderCarriedList is called directly with the SAME options object the branch passes, read from mazeworld.html's source
 * (not retyped), evaluated with the branch's own `c` and window.__mzLootCompare.
 */
function lootOptions(c) {
  const head = 'window.__mzCarriedList(wrap.querySelector("#loot-list"), S, S.pendingLoot, ';
  const from = HTML.indexOf(head);
  assert.ok(from >= 0, "the loot branch's options object is in mazeworld.html");
  const start = from + head.length;
  const end = HTML.indexOf(", tabDeps());", start);
  const literal = HTML.slice(start, end);
  assert.ok(literal.startsWith("{") && literal.endsWith("}") && literal.includes("adviceFor"), "the options literal");
  const window = { __mzLootCompare: lootCompare };
  return new Function("window", "c", "return (" + literal + ");")(window, c);
}

function paintLoot(state) {
  const doc = createRecordingDocument();
  const list = doc.document.createElement("ul");
  list.id = "loot-list";
  const deps = { guardTap: (button, fn) => { button.onclick = fn; } };
  renderCarriedList(list, state, state.pendingLoot, lootOptions(state.c), deps);
  return { doc, list };
}

const italicsOf = (li) => li.children.filter((n) => String(n.tagName).toLowerCase() === "i");

test("(q) loot list: a flavoured row shows its flavour, the take-or-leave advice on its own line, and the exact old line behind RULES", () => {
  const state = newRun(9, [], { force: { cls: "Fighter" } });
  const blade = rollBlade(makeRng(5), 4, true);
  const jewel = rollJewel(makeRng(6));
  state.pendingLoot = [blade, jewel];
  const { list } = paintLoot(state);
  assert.equal(list.children.length, 2);

  const [bladeLi, jewelLi] = list.children;
  const cmp = lootCompare(state.c, blade);
  const oldBlade = (cmp.sub ? `${cmp.line} · ${cmp.sub}` : cmp.line) + (cmp.usable ? ` ${cmp.usable}` : "");
  const bladeItalics = italicsOf(bladeLi);
  assert.equal(textOf(bladeItalics[0]), flavorOfItem(blade));
  assert.equal(bladeItalics.length, 2, "the advice sits on its own second line");
  assert.equal(textOf(bladeItalics[1]), [cmp.line, cmp.usable].filter(Boolean).join(" "));
  assert.match(textOf(bladeItalics[1]), /upgrade|can't use/);
  assert.deepEqual(findAll(bladeLi, "mw-rules-line").map(textOf), [oldBlade]);
  assert.equal(findAll(bladeLi, "mw-rules-body")[0].hidden, true);

  const jewelItalics = italicsOf(jewelLi);
  assert.equal(textOf(jewelItalics[0]), flavorOfItem(jewel));
  assert.equal(jewelItalics.length, 1, "a jewel has no advice, so no second line");
  assert.deepEqual(findAll(jewelLi, "mw-rules-line").map(textOf), [jewel.txt]);

  // The Take and Leave buttons are still the row's own buttons, after the toggle and body.
  assert.ok(bladeLi.children.some((n) => n.tagName === "button" && textOf(n) === "Leave"));
  tap(findAll(bladeLi, "mw-rules-btn")[0]);
  assert.equal(findAll(bladeLi, "mw-rules-body")[0].hidden, false);
});

test("(r) tolerant: a bagged old-save Cloak of Healing appears on the drop shelf and the loot list exactly as before, with no toggle", () => {
  const state = fullBagState({ extra: [OLD_CLOAK] });
  const rows = dropShelfRows(state.c);
  const n = rows.findIndex((r) => r.it.n === "Cloak of Healing");
  assert.ok(n >= 0, "the old cloak is on the drop shelf");
  for (const on of [false, true]) {
    setAlwaysRules(on);
    const { region } = findShelf(structuredClone(state), rollBlade(makeRng(5), 4, true));
    const el = region.children[n];
    assert.equal(el.tagName, "button", "bare button, no wrapper");
    assert.equal(findAll(el, "mw-rules-btn").length, 0);
    assert.ok(String(el.innerHTML).includes("Cloak of Healing"));
  }

  setAlwaysRules(false);
  const loot = newRun(9, [], { force: { cls: "Fighter" } });
  loot.pendingLoot = [OLD_CLOAK];
  const { list } = paintLoot(loot);
  const li = list.children[0];
  assert.equal(findAll(li, "mw-rules-btn").length + findAll(li, "mw-rules-body").length, 0);
  assert.equal(textOf(italicsOf(li)[0]), lootCompare(loot.c, OLD_CLOAK).line);
});

test("patch notes: 2.4.0 is a DRAFT that validates, and its Interface bullets name the flavour layer and the Always show the rules switch, old → new", () => {
  const md = fs.readFileSync(path.join(__dirname, "..", "..", "docs", "patch-notes", "2.4.0.md"), "utf8").replace(/\r\n/g, "\n");
  assert.match(md, /\*\*DRAFT, not yet agreed\.\*\*/, "2.4.0 stays a DRAFT");
  assert.deepStrictEqual(validatePatchNotes(md, "2.4.0"), []);
  const start = md.indexOf("## Interface\n");
  assert.ok(start !== -1, "the Interface category is present");
  const next = md.indexOf("\n## ", start + 1);
  const lines = md.slice(start, next === -1 ? md.length : next).split("\n");
  const flavour = lines.filter((l) => l.startsWith("- Spell, scroll, weapon, armour"));
  assert.equal(flavour.length, 1, "exactly one flavour-layer bullet");
  for (const needle of ["→", "RULES"]) assert.ok(flavour[0].includes(needle), `the flavour bullet carries "${needle}"`);
  const setting = lines.filter((l) => l.startsWith("- Settings:"));
  assert.equal(setting.length, 1, "exactly one Settings bullet");
  for (const needle of ["→", "Always show the rules", "Off by default"]) assert.ok(setting[0].includes(needle), `the Settings bullet carries "${needle}"`);
});

// ─── Phase 96 (FLAVOR-03): the Hero dossier and trait line ────────────────
//
// The dossier (Race, Class, Subclass) and the trait line follow the one rule:
// the flavour leads, today's note and the unchanged footer sit behind RULES,
// Always on shows them open with no toggle, an opened body survives a repaint,
// and an identity with no flavour line renders as today. Extended by 96-06 and
// 96-07.

function paintHero(sub, race) {
  const { document } = createRecordingDocument();
  const state = newRun(1, [], { force: { sub, race } });
  const host = document.getElementById("screen-hero");
  renderHeroTab(host, state, {});
  return { document, host, state, repaint: () => renderHeroTab(host, state, {}) };
}

const dossSections = (document) => document.getElementById("doss").children;
const sectionParts = (sec) => ({
  flavor: sec.children[2],
  button: sec.children.find((el) => hasClass(el, "mw-rules-btn")),
  body: sec.children.find((el) => hasClass(el, "mw-rules-body")),
});
const bodyLines = (body) => body.children.map((p) => textOf(p));

test("(s) Dossier: each section leads with a digit-free flavour line; the note and footer sit behind a collapsed RULES body", () => {
  const { document, state } = paintHero("Cat Burglar", "Wilmsry");
  const c = state.c;
  const expected = [
    ["race", c.race, [RACE_NOTE[c.race], ...footerLines("race", c.race)]],
    ["class", c.cls, [CLASS_NOTE[c.cls]]],
    ["sub", c.sub, [SUB_NOTE[c.sub], ...footerLines("sub", c.sub)]],
  ];
  const secs = dossSections(document);
  assert.equal(secs.length, 3);
  expected.forEach(([kind, key, lines], i) => {
    const { flavor, button, body } = sectionParts(secs[i]);
    assert.equal(textOf(flavor), flavorOfIdentity(kind, key), `${kind}: the visible paragraph is the flavour line`);
    assert.doesNotMatch(textOf(flavor), /\d/, `${kind}: the flavour line carries no digit`);
    assert.ok(button, `${kind}: a RULES button`);
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(body.hidden, true);
    assert.deepEqual(bodyLines(body), lines, `${kind}: the body is the old note then the unchanged footer`);
  });
});

test("(s) Dossier: a tap opens one body without acting, a repaint keeps it open, and Always on shows every body with no toggle", () => {
  const view = paintHero("Cat Burglar", "Wilmsry");
  const before = JSON.stringify(view.state);
  const raceSec = dossSections(view.document)[0];
  tap(sectionParts(raceSec).button);
  assert.equal(sectionParts(raceSec).body.hidden, false, "the tapped body opens");
  assert.equal(JSON.stringify(view.state), before, "a RULES tap never touches the game state");

  view.repaint();
  const after = dossSections(view.document);
  assert.equal(sectionParts(after[0]).body.hidden, false, "the opened body survives a repaint");
  assert.equal(sectionParts(after[1]).body.hidden, true, "the other bodies stay closed");
  assert.equal(sectionParts(after[0]).button.getAttribute("aria-expanded"), "true");

  setAlwaysRules(true);
  view.repaint();
  for (const sec of dossSections(view.document)) {
    const { button, body } = sectionParts(sec);
    assert.equal(button, undefined, "no toggle with Always on");
    assert.equal(body.hidden, false);
  }
});

test("(t) Trait line: the sentence keeps temperament, motive and phobia; the race note sits alone behind a RULES toggle", () => {
  const { document, state } = paintHero("Cat Burglar", "Wilmsry");
  const c = state.c;
  const trait = document.getElementById("s-trait");
  const visible = String(trait.innerHTML).replace(/<[^>]+>/g, "");
  assert.equal(visible, `${c.temperament}, driven by ${c.motive.toLowerCase()}, afraid of ${c.phobia.toLowerCase()}.`);
  assert.doesNotMatch(visible, /\d/, "no number in the visible trait line");
  assert.ok(!String(trait.innerHTML).includes(RACES[c.race].note), "the race note is not in the visible markup");
  const button = trait.children.find((el) => hasClass(el, "mw-rules-btn"));
  const body = trait.children.find((el) => hasClass(el, "mw-rules-body"));
  assert.ok(button && body, "a RULES toggle and body");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(body.hidden, true);
  assert.deepEqual(bodyLines(body), [RACES[c.race].note], "the toggle holds exactly the race note");
});

test("(u) tolerant: a sub-class with no flavour line renders its section as before, with no toggle and no throw", () => {
  const view = paintHero("Cat Burglar", "Wilmsry");
  view.state.c.sub = "Mystery Sub";
  assert.doesNotThrow(() => view.repaint());
  const secs = dossSections(view.document);
  assert.equal(secs.length, 3);
  const sub = secs[2];
  assert.equal(String(sub.innerHTML), `<h3>Subclass</h3><p class="who">Mystery Sub</p><p></p>`, "today's markup, nothing more");
  assert.equal(sub.children.filter((el) => hasClass(el, "mw-rules-btn") || hasClass(el, "mw-rules-body")).length, 0);
  assert.ok(sectionParts(secs[0]).button, "the known race still has its toggle");
  assert.equal(String(view.document.getElementById("doss-who").textContent), `${view.state.c.race} Mystery Sub`);
});
