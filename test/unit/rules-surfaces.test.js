// test/unit/rules-surfaces.test.js
//
// Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05; CONTEXT 'Where the exact numbers
// live'): one rule on every surface. The flavour shows and an item with no
// flavour renders as today (the exact old text once sat in a collapsed body; see
// the Phase 97.1 paragraph below for what this file pins now).
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
//
// Phase 97.1 (FLAVOR-07): declared re-pin. The RULES control is retired, and so is the
// "Always show the rules" switch. This file used to pin the layering rule (flavour first,
// the exact text behind a RULES control, an Always switch). It now pins, per surface, that
// the flavour is shown, that a row with no flavour keeps today's text, that no rules
// control or body exists on the surface, and that the model still carries the exact text
// (row.rules, card.lines[0].rules, gearSheetModel().rules, storeRowLayer().rules, the
// content tables), so no rules sentence or number loses its guard.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { flavorOfItem, flavorOfIdentity, flavorOfAbility, flavorOfSkill } from "../../src/browser/flavorText.js";
import { renderHeroTab, grimoireViewModel } from "../../src/browser/heroTab.js";
// Phase 96 (FLAVOR-04): the ability and skill surface cases read the Hero view model, the skill tables and the Final Sheet.
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/index.js";
import { die } from "../../engine/death.js";
import { finalSheetViewModel, renderFinalSheet } from "../../src/browser/finalSheet.js";
import { footerLines } from "../../src/browser/identityFooter.js";
import { RACES, RACE_NOTE, CLASS_NOTE, SUB_NOTE } from "../../content/index.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { SPELLS, NICHE_LABELS, ABILITY_BY_ID } from "../../content/index.js";
import { SPELL_FLAVOR } from "../../content/spells.js";
import { newRun } from "../../engine/state.js";
import { rollJewel, rollBlade, rollMailPiece, stowItem, toolItem } from "../../engine/items.js";
import { BAG_ITEMS, BAG_ORDER } from "../../content/index.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { renderGearTab, GEAR_COPY, gearWornModel, gearConsumablesModel, bagUsage, renderCarriedList } from "../../src/browser/gearTab.js";
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

// Phase 97.1 (FLAVOR-07): declared re-pin. The retired control's tap helper is gone; this finder replaces it. A node is a rules
// control or body when any of its classes starts with "mw-rules-" (the toggle, the body, a line, the wrapper), the root included.
const RULES_CLASS = /(^|\s)mw-rules-/;
function rulesNodes(root) {
  return [root, ...walk(root)].filter((el) => RULES_CLASS.test(String(el.className || "")));
}
function assertNoRulesControls(root, label = "this surface") {
  assert.deepEqual(rulesNodes(root).map((el) => el.className), [], `${label} draws no rules control or body`);
}

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

// Phase 97.1 (FLAVOR-07): declared re-pin. The Grimoire row's italic is the niche label and the flavour; the RULES button and body
// are gone. The exact txt and the resist sentence stay on the view model (the next test), drawn nowhere.
test("(a) Grimoire: the italic line is niche label + flavour with no digit; the exact old text is not drawn and no rules control exists", () => {
  const { doc } = paintGrimoire();
  const heal = SPELLS.find((s) => s.n === "Heal");
  const info = grimInfo(doc, "Heal");
  const italic = italicOf(info);
  assert.ok(!/\d/.test(italic), `no digit on the flavour line: ${italic}`);
  assert.ok(italic.includes(SPELL_FLAVOR.Heal), italic);
  assert.ok(italic.startsWith(`${NICHE_LABELS[heal.niche]} · `), "the niche label stays as the leading category tag");

  // Phase 97.1 (FLAVOR-07): declared re-pin. Was: a collapsed RULES toggle and body holding Heal's txt.
  assertNoRulesControls(info, "the Grimoire row");
  assert.ok(!String(info.innerHTML).includes(heal.txt), "Heal's exact txt is not drawn");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the RULES body carried the txt and the resist sentence in the old order. The pin moves to
// the view model that still carries both; the painted row shows neither.
test("(a) Grimoire: a foe-targeted spell's view-model row still carries the txt and the resist sentence; the painted row draws neither", () => {
  const { doc, state } = paintGrimoire(["Doze"]);
  const doze = SPELLS.find((s) => s.n === "Doze");
  const row = grimoireViewModel(state).rows.find((r) => r.name === "Doze");
  assert.ok(row, "Doze is on the view model");
  assert.equal(row.txt, doze.txt, "the exact txt is still on the model");
  assert.ok(typeof row.resistNote === "string" && row.resistNote.length > 0, "the resist sentence is still on the model");
  const info = grimInfo(doc, "Doze");
  assert.ok(!String(info.innerHTML).includes(doze.txt), "the txt is not drawn");
  assert.ok(!String(info.innerHTML).includes(row.resistNote), "the resist sentence is not drawn");
  assertNoRulesControls(info, "the Doze row");
});

// ─── (b) the combat SPELLS rows ───────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Each SPELLS row is the bare cb-row button now (no wrapper, no sibling toggle, no body). The
// desc slot is the row's lead; the row model still carries the exact rules text, distinct from what is drawn.
test("(b) combat SPELLS: each row's desc leads with its niche label and flavour; the row is a bare button with no rules control", () => {
  const state = fightState();
  const { list } = openMenu(state, "spells");
  const rows = combatMenuViewModel(state).submenus.spells.rows;
  assert.equal(list.children.length, 2);
  for (const [i, rowBtn] of list.children.entries()) {
    const vmRow = rows[i];
    const sp = SPELLS.find((s) => s.n.toUpperCase() === vmRow.label);
    assert.equal(rowBtn.id, `cb-row-${vmRow.id}`, `${vmRow.label} is the bare row button`);
    assert.ok(hasClass(rowBtn, "cb-row"));
    const desc = textOf(findAll(rowBtn, "cb-row-desc")[0]);
    assert.ok(desc.startsWith(`${NICHE_LABELS[sp.niche]} · ${SPELL_FLAVOR[sp.n]}`), desc);
    assert.equal(desc, vmRow.lead, "the desc slot shows the lead");
    assert.equal(textOf(findAll(rowBtn, "cb-row-cost")[0]), vmRow.cost, "the functional tag stays");
    assert.ok(typeof vmRow.rules === "string" && vmRow.rules.length > 0, "the model still carries the exact rules text");
    assert.notEqual(vmRow.rules, desc, "the rules text is not what is drawn");
  }
  assertNoRulesControls(list, "the SPELLS list");
  const freeze = textOf(findAll(list.children[0], "cb-row-desc")[0]);
  assert.ok(freeze.includes("Cave Rat resists on"), "the live resist hint stays visible on a foe-targeted spell");
});

// ─── (c) the combat ITEMS rows ────────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. POTION and SCROLL are bare buttons; the scroll's exact rules are pinned on the model.
test("(c) combat ITEMS: the POTION and SCROLL rows are bare buttons with their n LEFT tags; the scroll's exact rules stay on the model only", () => {
  const state = fightState();
  const { list } = openMenu(state, "items");
  const byLabel = (label) => list.children.find((w) => textOf(findAll(w, "cb-row-label")[0]) === label);
  const potion = byLabel("POTION");
  const scroll = byLabel("SCROLL");
  for (const [row, tag] of [[potion, "2 LEFT"], [scroll, "1 LEFT"]]) {
    assert.ok(row && hasClass(row, "cb-row"), "a bare row button");
    assert.equal(textOf(findAll(row, "cb-row-cost")[0]), tag);
  }
  const rows = combatMenuViewModel(state).submenus.items.rows;
  assert.equal(textOf(findAll(potion, "cb-row-desc")[0]), rows.find((r) => r.id === "potion").lead);
  assert.equal(textOf(findAll(scroll, "cb-row-desc")[0]), rows.find((r) => r.id === "scroll").lead);
  const scrollRules = rows.find((r) => r.id === "scroll").rules;
  assert.ok(typeof scrollRules === "string" && scrollRules.length > 0, "the model still carries the scroll's exact rules");
  assert.ok(!textOf(scroll).includes(scrollRules), "the scroll's exact rules are not drawn");
  assertNoRulesControls(list, "the ITEMS list");
});

test("(c) combat ITEMS: a not-equipped reason row is a bare button and keeps its reason text", () => {
  const state = fightState({
    items: [{ n: "Ring of Power", kind: "jewel", eff: { dmg: 1 }, txt: "+1 damage" }],
    worn: { jewelry1: null, jewelry2: null, cloak: null },
  });
  const { list } = openMenu(state, "items");
  const reason = list.children.find((el) => el.id === "cb-row-item-0");
  assert.ok(reason, "the reason row is a bare row button");
  assert.ok(hasClass(reason, "cb-row"));
  // Phase 97.1 (FLAVOR-07): declared re-pin. Was: no toggle on the reason row. Now: no rules control anywhere in the list.
  assertNoRulesControls(list, "the ITEMS list");
});

// Phase 96 (FLAVOR-04): declared re-pin, again re-pinned by Phase 97.1 (FLAVOR-07). The ABILITIES rows (and the Bard's SING row) carry
// flavour: the row button keeps its id, data-state and state label in the cost slot byte for byte; its desc slot reads the flavour
// line. The ability's exact txt is pinned on the row model (vmRow.rules); it is not drawn and there is no wrapper, toggle or body.
test("(c) combat ABILITIES: an ability row is a bare button; the cost keeps its state word, the desc is the flavour, the model keeps the txt", () => {
  const state = fightState({ cls: "Fighter", sub: "Soldier", grimoire: [], abilities: ["kata", "brace"] });
  const { list } = openMenu(state, "abilities");
  const rows = combatMenuViewModel(state).submenus.abilities.rows;
  assert.equal(list.children.length, 2);
  for (const [i, rowBtn] of list.children.entries()) {
    const vmRow = rows[i];
    assert.equal(rowBtn.id, `cb-row-${vmRow.id}`);
    assert.ok(hasClass(rowBtn, "cb-row"));
    assert.equal(rowBtn.dataset.state, vmRow.state, "the data-state edge is unchanged");
    assert.equal(textOf(findAll(rowBtn, "cb-row-cost")[0]), vmRow.cost, "the state label stays in the cost slot");
    assert.equal(textOf(findAll(rowBtn, "cb-row-cost")[0]), "READY");
    const desc = textOf(findAll(rowBtn, "cb-row-desc")[0]);
    assert.equal(desc, flavorOfAbility(ABILITY_BY_ID[vmRow.id.slice("ability-".length)].name), "the desc slot reads the flavour line");
    assert.ok(!/[0-9]/.test(desc), "the flavour line carries no digit");
    assert.equal(vmRow.rules, ABILITY_BY_ID[vmRow.id.slice("ability-".length)].txt, "the model still carries the ability's exact txt");
  }
  assertNoRulesControls(list, "the ABILITIES list");
});

test("(c) combat ABILITIES: the Bard's SING row is a bare button; its model keeps singDesc", () => {
  const state = fightState({ cls: "Fighter", sub: "Bard", grimoire: [], abilities: ["kata"] });
  const { list } = openMenu(state, "abilities");
  const rowBtn = list.children[0];
  assert.equal(rowBtn.id, "cb-row-sing");
  assert.equal(textOf(findAll(rowBtn, "cb-row-cost")[0]), "READY");
  assert.equal(textOf(findAll(rowBtn, "cb-row-desc")[0]), flavorOfAbility("Sing"));
  const vmRow = combatMenuViewModel(state).submenus.abilities.rows.find((r) => r.id === "sing");
  assert.equal(vmRow.rules, COMBAT_MENU_COPY.singDesc, "the model still carries singDesc");
  assertNoRulesControls(list, "the SING list");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the 95-02 lock rule made the RULES toggle inert. With no toggle the lock rule covers the
// bare row buttons alone: the page's combat lock rule still names .cb-row, the page names no mw-rules class, and a locked ability row
// is the bare button carrying data-locked.
test("(c) combat ABILITIES: the lock rule covers the bare row buttons while a round's beats play, and the page names no mw-rules class", () => {
  const lockRule = '#cb-act[data-locked="1"] .cb-btn,#cb-act[data-locked="1"] .cb-row,#cb-act[data-locked="1"] .cb-chip{opacity:.45;box-shadow:none;pointer-events:none';
  assert.ok(HTML.includes(lockRule), "the lock rule that makes a locked #cb-act's rows pointer-inert");
  assert.equal(HTML.includes("mw-rules"), false, "the page names no mw-rules class");
  const state = fightState({ cls: "Fighter", sub: "Soldier", grimoire: [], abilities: ["kata"] });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.context.window.__mzCombatMenu = { open: "abilities" };
  sandbox.context.window.__mzBeat = { active: () => true, view: () => null };
  sandbox.context.renderEncounter();
  const act = doc.document.getElementById("cb-act");
  assert.equal(act.getAttribute("data-locked"), "1");
  const row = doc.document.getElementById("cb-sub-list").children[0];
  assert.ok(hasClass(row, "cb-row"));
  assert.equal(row.getAttribute("data-locked"), "1", "the row button is locked");
});

// ─── (d) the find card ────────────────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a RULES toggle outside the typed lines held the old text. Now the item line reads
// name · flavour and the old text is drawn nowhere on the card.
test("(d) find card: the item line reads name · flavour, and the old text is not on the card; no rules control exists", () => {
  const jewel = rollJewel(makeRng(5));
  const flavor = flavorOfItem(jewel);
  assert.ok(flavor.length > 0, "the rolled jewel has a flavour line");
  const { lines } = paintFind(jewel);
  const itemLine = lines.children.filter((el) => hasClass(el, "mw-rail-line")).find((el) => textOf(el).startsWith(`${jewel.n} · `));
  assert.ok(itemLine, `an item line for ${jewel.n}`);
  assert.ok(textOf(itemLine).includes(flavor), textOf(itemLine));
  assert.ok(!textOf(itemLine).includes(jewel.txt), "the rules text is not on the typed line");
  assertNoRulesControls(lines, "the find card");
  assert.ok(!textOf(lines).includes(jewel.txt), "the jewel's exact txt is drawn nowhere on the card");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a RULES tap never reaches the rail's dismiss handler. There is no such tap now, so the
// pin is that the rail's tap handler names no rules class.
test("(d) find card: the rail's dismiss handler names no mw-rules class", () => {
  const handler = HTML.slice(HTML.indexOf('document.getElementById("mw-rail").onclick'));
  const armAt = handler.indexOf("isArmed(railShownAt");
  assert.ok(armAt > 0, "the arm check is still in the handler");
  assert.equal(handler.slice(0, armAt).includes("mw-rules"), false, "no rules early return ahead of the arm window");
});

// ─── (e) tolerant load ────────────────────────────────────────────────────

test("(e) Tolerant load: a removed item an old save may hold shows name · its own text and no rules control", () => {
  const { lines } = paintFind({ kind: "jewel", n: "Cloak of Healing", txt: "an old cloak's text" });
  const itemLine = lines.children.filter((el) => hasClass(el, "mw-rail-line")).find((el) => textOf(el).startsWith("Cloak of Healing"));
  assert.ok(itemLine, "an item line for the removed cloak");
  assert.ok(textOf(itemLine).startsWith("Cloak of Healing · an old cloak's text"), textOf(itemLine));
  // Phase 97.1 (FLAVOR-07): declared re-pin. Was: no toggle and no body, looked up by the retired control's class names.
  assertNoRulesControls(lines, "the removed item's find card");
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

// ─── (f) Gear tab: WORN rows ──────────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the Always-on half showed the exact old line statically. Now the exact line is drawn
// nowhere; the worn list has no rules control or body at all.
test("(f) Gear WORN: a flavoured row shows its flavour; the armour row keeps its wear note; the exact old line is not drawn and no rules control exists", () => {
  const state = { c: gearChar({ worn: { jewelry1: RING } }) };
  const doc = paintGear(state);
  const jewel = wornLi(doc, "jewelry1");
  assert.equal(textOf(noteOf(jewel)), MAGIC_ITEM_FLAVOR["Ring of Power"]);
  assert.doesNotMatch(textOf(noteOf(jewel)), /\d/, "the flavour line has no digit");
  assert.equal(textOf(noteOf(wornLi(doc, "weapon"))), WEAPON_FLAVOR["Long Sword"]);
  const armourNote = gearWornModel(state).rows.find((r) => r.key === "armor").note;
  assert.equal(textOf(noteOf(wornLi(doc, "armor"))), armourNote, "the armour row keeps its live wear note");
  assert.match(armourNote, /\d/, "the wear note is state, with numbers");
  const worn = doc.document.getElementById("gear-worn");
  assertNoRulesControls(worn, "the WORN list");
  assert.ok(!textOf(worn).includes(RING.txt), "the ring's exact txt is not drawn");
  assert.ok(!textOf(worn).includes(GEAR_COPY.weaponMundane), "the weapon's voice line is not drawn");
});

// ─── (g) Gear tab: BAG cards ──────────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the Always-on half showed the exact old desc. Now it is drawn nowhere.
test("(g) Gear BAG: a card shows its flavour (plus the usable-by tag for armour); the exact old desc is not drawn and no rules control exists", () => {
  const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const state = { c: gearChar({ items: [ANKLET, studded] }) };
  const doc = paintGear(state);
  const usable = usableBy(studded, state.c);
  assert.equal(textOf(descOf(bagLi(doc, 0))), MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]);
  assert.equal(textOf(descOf(bagLi(doc, 1))), usable ? `${ARMOR_FLAVOR.Studded} ${usable}` : ARMOR_FLAVOR.Studded);
  const bag = doc.document.getElementById("gear-bag");
  assertNoRulesControls(bag, "the BAG list");
  assert.ok(!textOf(bag).includes(ANKLET.txt), "the Anklet's exact txt is not drawn");
  assert.ok(!textOf(bag).includes("AR 10 · 18/18 hp"), "the armour's exact stat line is not drawn");
});

// ─── (h) Gear tab: CONSUMABLES ────────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a collapsed RULES toggle held the exact text, a tap revealed it, a repaint kept it open.
// Now the rows show the flavour and the exact text is pinned on the model's `rules` field, drawn nowhere.
test("(h) Gear CONSUMABLES: each row shows its flavour and the READ button; the exact text stays on the model's rules field and is not drawn", () => {
  const state = { c: gearChar({ scrolls: 2 }) };
  const doc = paintGear(state);
  const heal = consLi(doc, "heal");
  assert.equal(textOf(descOf(heal)), POTION_FLAVOR.Healing);
  const scroll = consLi(doc, "scroll");
  assert.equal(textOf(descOf(scroll)), SCROLL_FLAVOR);
  assert.ok(scroll.children.some((n) => hasClass(n, "mw-gear-cons-btn")), "the READ button is unchanged");

  const rows = gearConsumablesModel(state).rows;
  assert.equal(rows.find((r) => r.key === "heal").rules, GEAR_COPY.healingDesc, "the model keeps the heal text");
  const scrollRules = `${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}`;
  assert.equal(rows.find((r) => r.key === "scroll").rules, scrollRules, "the model keeps the scroll text and the reader's odds");

  assertNoRulesControls(consLi(doc, "heal"), "the heal row");
  assertNoRulesControls(scroll, "the scroll row");
  assert.ok(!textOf(heal).includes(GEAR_COPY.healingDesc), "the heal rules text is not drawn");
  assert.ok(!textOf(scroll).includes(GEAR_COPY.scrollDesc), "the scroll rules text is not drawn");
});

// ─── (i) Gear tab: tolerant load ──────────────────────────────────────────

test("(i) Tolerant load: a bagged removed item an old save may hold shows its own text and no rules control or body", () => {
  const state = { c: gearChar({ items: [OLD_CLOAK] }) };
  const doc = paintGear(state);
  assert.equal(textOf(descOf(bagLi(doc, 0))), "an old cloak's text");
  assertNoRulesControls(bagLi(doc, 0), "the old cloak's row");
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

// Phase 97.1 (FLAVOR-07): declared re-pin. User rulings: numbers yes, rulebook sentences no. The Anklet's only stat row is its effect
// row (the item's own txt sentence, which is rules text), so a flavoured Anklet's sheet draws no stat row and hides the container. The
// model still carries the sentence (stats, rules) and says which key each row is (statKeys). Was: a RULES body held it and a tap opened it.
test("(j) Gear sheet, bag: the note shows the flavour; the Anklet's effect sentence is not drawn (the container hides); the model keeps it", () => {
  const state = { c: gearChar({ items: [ANKLET] }) };
  const target = { from: "bag", i: 0, n: "Anklet of Invisibility" };
  const oldStats = itemStatLines(ANKLET, state.c).map((l) => l.text);
  assert.ok(oldStats.length > 0, "the Anklet has stat lines");
  const model = gearSheetModel(state, target);
  assert.deepEqual(model.stats, oldStats, "the effect sentence is still on the model");
  assert.deepEqual(model.rules, oldStats, "the model's rules array still carries it");
  assert.deepEqual(model.statKeys, ["effect"], "its only row is the effect row");

  const sheet = openSheet(state, target);
  assert.equal(textOf(sheet.get("note")), MAGIC_ITEM_FLAVOR["Anklet of Invisibility"]);
  assert.equal(sheet.get("note").hidden, false);
  const statsEl = sheet.get("stats");
  assert.equal(statsEl.hidden, true, "no row is left, so the container hides");
  assert.equal(statsEl.children.length, 0);
  assert.ok(!textOf(statsEl).includes(ANKLET.txt), "the effect sentence is not drawn");
  assertNoRulesControls(statsEl, "the stats container");

  sheet.render();
  assert.equal(sheet.get("stats").hidden, true, "still hidden when the sheet re-renders");
  assert.equal(sheet.get("stats").children.length, 0);
});

// ─── (k) the worn weapon's sheet ──────────────────────────────────────────

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the RULES body held the old voice line then every stat line. Now the numeric stat rows
// are drawn as plain rows (one p.mw-gsheet-note.mw-gsheet-stat per stats entry, in order) and the voice line is drawn nowhere; the model's
// rules array still holds [voice line, ...stats].
test("(k) Gear sheet, worn weapon: the note shows the weapon flavour; the numeric stat rows are plain rows; the old voice line is not drawn", () => {
  const state = { c: gearChar() };
  const stats = itemStatLines(wornItemFor(state.c, "weapon"), state.c).map((l) => l.text);
  assert.ok(stats.length > 0);
  assert.deepEqual(gearSheetModel(state, { from: "worn", slot: "weapon" }).rules, [GEAR_COPY.weaponMundane, ...stats], "the model keeps the voice line then every stat line");
  const sheet = openSheet(state, { from: "worn", slot: "weapon" });
  assert.equal(textOf(sheet.get("note")), WEAPON_FLAVOR["Long Sword"]);
  const statsEl = sheet.get("stats");
  assert.equal(statsEl.hidden, false, "a weapon shows its numbers");
  assert.equal(statsEl.children.length, stats.length);
  statsEl.children.forEach((row, i) => {
    assert.equal(String(row.tagName).toLowerCase(), "p");
    assert.ok(hasClass(row, "mw-gsheet-note") && hasClass(row, "mw-gsheet-stat"), "a plain stat row");
    assert.equal(textOf(row), stats[i]);
    assert.equal(RULES_CLASS.test(String(row.className)), false, "no rules class on a stat row");
  });
  assert.ok(!textOf(statsEl).includes(GEAR_COPY.weaponMundane), "the old voice line is not drawn");
  assertNoRulesControls(statsEl, "the stats container");
});

// Phase 97.1 (FLAVOR-07): new case. A flavoured armour in the bag: its rows are exactly the itemStatLines texts, plain and visible, none of
// them an effect row.
test("(j2) Gear sheet, bagged armour: the AR, wear and usable-by rows are drawn as plain rows; none is an effect row", () => {
  const studded = { kind: "armor", n: "Studded", ar: 10, wp: 18, left: 18, cls: "FT" };
  const state = { c: gearChar({ items: [studded] }) };
  const target = { from: "bag", i: 0, n: "Studded" };
  const lines = itemStatLines(studded, state.c);
  assert.ok(lines.length >= 2, "AR and wear at least");
  assert.ok(lines.every((l) => l.key !== "effect"), "an armour has no effect row");
  const sheet = openSheet(state, target);
  assert.equal(textOf(sheet.get("note")), gearSheetModel(state, target).lead);
  const statsEl = sheet.get("stats");
  assert.equal(statsEl.hidden, false);
  assert.deepEqual(statsEl.children.map(textOf), lines.map((l) => l.text));
  for (const row of statsEl.children) {
    assert.ok(hasClass(row, "mw-gsheet-note") && hasClass(row, "mw-gsheet-stat"));
  }
  assertNoRulesControls(statsEl, "the stats container");
});

// ─── (l) candidate subs and tolerant load ─────────────────────────────────

test("(l) Gear sheet: a jewel SWAP FOR candidate's sub is that jewel's flavour; an old save's removed item renders note and stats as before with no rules control", () => {
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
  const s = openSheet(old, target);
  assert.equal(textOf(s.get("note")), before.note);
  assert.deepEqual(findAll(s.get("stats"), "mw-gsheet-stat").map(textOf), before.stats);
  assertNoRulesControls(s.get("stats"), "the old cloak's stats");
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

/** The stock button whose name span starts with `name`. Phase 97.1 (FLAVOR-07): declared re-pin. Every stock row is a bare button on the shelf now. */
function stockButton(shelf, name) {
  const b = shelf.children.find((x) => String(x.innerHTML).includes(`<span class="g-n">${name}`));
  assert.ok(b, `a stock row for ${name}`);
  return b;
}

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

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the exact old stat line sat behind a RULES toggle that was a sibling of BUY. Now a flavoured
// row is a bare BUY button whose italic starts with the flavour; the exact line is pinned on storeRowLayer (the test above) and is not drawn.
test("(m) store: a flavoured stock row is a bare button that leads with its flavour and keeps count/compare/reason; no rules control exists", () => {
  const state = fixedStates().thiefStore;
  const { shelf } = paintStore(state);

  const heal = stockButton(shelf, "Healing potion");
  assert.equal(String(heal.tagName).toLowerCase(), "button", "the Healing potion row is the bare BUY button");
  const lead = italicIn(heal);
  assert.ok(lead.startsWith(POTION_FLAVOR.Healing), lead);
  assert.ok(!/\d/.test(lead.split(" · ")[0]), "no digit before the first separator");
  assert.ok(!String(heal.innerHTML).includes("+d10+2 hp"), "the exact old stat text is not drawn");

  // The compare line (advice) stays visible in the italic.
  const weapon = state.store.stock.find((l) => l.effectId === "buyWeapon");
  const wb = stockButton(shelf, weapon.n);
  assert.match(italicIn(wb), /(upgrade|not an upgrade)(?= ·|$)/);

  // Rations are bare and unchanged.
  const rations = stockButton(shelf, "Rations (+1 ration)");
  assert.match(italicIn(rations), /^\d+ left$/);
  assert.ok(shelf.children.includes(rations), "Rations are appended bare");

  assertNoRulesControls(shelf, "the store shelf");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the Sealed scroll's RULES body held the scroll's rules. The pin moves to the row layer
// that still carries them; the row shows the scroll flavour and not GEAR_COPY.scrollDesc.
test("(n) store: the Sealed scroll row shows the scroll flavour; storeRowLayer still carries the scroll's rules as the Gear SCROLLS row states them", () => {
  const state = fixedStates().muStore;
  const { shelf } = paintStore(state);
  const b = stockButton(shelf, "Sealed scroll");
  assert.ok(italicIn(b).startsWith(SCROLL_FLAVOR), italicIn(b));
  assert.ok(!String(b.innerHTML).includes(GEAR_COPY.scrollDesc), "the scroll rules text is not drawn");
  const line = state.store.stock.find((l) => String(l.n).startsWith("Sealed scroll"));
  assert.ok(line, "the Sealed scroll stock line");
  const layer = storeRowLayer(line, state.c, state, false, "");
  assert.ok(layer, "the Sealed scroll row has a layer");
  assert.equal(layer.rules, `${GEAR_COPY.scrollDesc} ${scrollReadOdds(state)}`);
  assertNoRulesControls(shelf, "the store shelf");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a collapsed toggle held the exact old line; a tap opened it and a repaint kept it open.
// Now each flavoured row shows its flavour alone, an unflavoured row keeps its old text, and no rules control exists.
test("(o) Your gear sell list: each flavoured row shows its flavour only; an unflavoured row keeps its old text; no rules control exists", () => {
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
      return;
    }
    flavoured++;
    assert.equal(textOf(italic), flavor);
    if (old) assert.ok(!textOf(li).includes(old), `${it.n}: the exact old line is not drawn`);
  });
  assert.ok(flavoured >= 3, "the fixture sells several flavoured items");
  assertNoRulesControls(first.sell, "the sell list");
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

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a flavoured row was a RULES wrapper around the Drop button, the body held the stat line and the
// toggle never dropped. Now every row, flavoured or not, is the bare Drop button; a flavoured row shows its flavour (and the usable-by tag)
// and not its stat line; a clean tap drops that row's true index.
test("(p) drop shelf (find card): every row is a bare Drop button; a flavoured row shows its flavour and no stat line; a tap drops its true index", () => {
  const state = fullBagState();
  const rows = dropShelfRows(state.c);
  const { region, drops } = findShelf(state, rollBlade(makeRng(5), 4, true));
  assert.equal(region.children.length, rows.length);
  let flavoured = 0;
  region.children.forEach((el, n) => {
    const row = rows[n];
    const flavor = flavorOfItem(row.it);
    assert.equal(el.tagName, "button", `row ${n} is the bare button`);
    assert.ok(hasClass(el, "goods"));
    if (!flavor) return;
    flavoured++;
    const tag = usableBy(row.it, state.c);
    assert.equal(italicOf(el), tag ? `${flavor} ${tag}` : flavor);
    assert.ok(!String(el.innerHTML).includes(row.stats), `row ${n}: the exact stat line is not drawn`);
  });
  assert.ok(flavoured >= 3, "the fixture bag holds several flavoured items");
  assertNoRulesControls(region, "the drop shelf");

  // A clean tap on the button drops that row's true index.
  const n = region.children.findIndex((el, k) => flavorOfItem(rows[k].it));
  assert.ok(n >= 0);
  region.children[n].onclick();
  assert.deepEqual(drops, [rows[n].i]);
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

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: the exact old line sat behind RULES in each row and a toggle tap opened it. Now the flavour is
// the first italic, the advice stays on its own second italic, a jewel has no advice, and the exact old line is drawn nowhere.
test("(q) loot list: a flavoured row shows its flavour, the take-or-leave advice on its own line, and the exact old line is not drawn", () => {
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
  assert.ok(!textOf(bladeLi).includes(oldBlade), "the exact old blade line is not drawn");

  const jewelItalics = italicsOf(jewelLi);
  assert.equal(textOf(jewelItalics[0]), flavorOfItem(jewel));
  assert.equal(jewelItalics.length, 1, "a jewel has no advice, so no second line");
  assert.ok(!textOf(jewelLi).includes(jewel.txt), "the jewel's exact txt is not drawn");

  // The Take and Leave buttons are still the row's own buttons.
  assert.ok(bladeLi.children.some((n) => n.tagName === "button" && textOf(n) === "Leave"));
  assertNoRulesControls(list, "the loot list");
});

// Phase 97.1 (FLAVOR-07): declared re-pin. One pass (the Always on/off loop is gone with the setting).
test("(r) tolerant: a bagged old-save Cloak of Healing appears on the drop shelf and the loot list exactly as before, with no rules control", () => {
  const state = fullBagState({ extra: [OLD_CLOAK] });
  const rows = dropShelfRows(state.c);
  const n = rows.findIndex((r) => r.it.n === "Cloak of Healing");
  assert.ok(n >= 0, "the old cloak is on the drop shelf");
  const { region } = findShelf(structuredClone(state), rollBlade(makeRng(5), 4, true));
  const el = region.children[n];
  assert.equal(el.tagName, "button", "bare button");
  assertNoRulesControls(el, "the old cloak's drop row");
  assert.ok(String(el.innerHTML).includes("Cloak of Healing"));

  const loot = newRun(9, [], { force: { cls: "Fighter" } });
  loot.pendingLoot = [OLD_CLOAK];
  const { list } = paintLoot(loot);
  const li = list.children[0];
  assertNoRulesControls(li, "the old cloak's loot row");
  assert.equal(textOf(italicsOf(li)[0]), lootCompare(loot.c, OLD_CLOAK).line);
});

// Phase 97.1 (FLAVOR-07): declared re-pin. The 2.4.0 DRAFT no longer names a RULES tap or the Always switch; it says the exact rules sit
// behind the scenes, in the voice, and still validates.
test("patch notes: 2.4.0 is a DRAFT that validates, and its Interface bullets say the exact rules sit behind the scenes, old → new", () => {
  const md = fs.readFileSync(path.join(__dirname, "..", "..", "docs", "patch-notes", "2.4.0.md"), "utf8").replace(/\r\n/g, "\n");
  assert.match(md, /\*\*DRAFT, not yet agreed\.\*\*/, "2.4.0 stays a DRAFT");
  assert.deepStrictEqual(validatePatchNotes(md, "2.4.0"), []);
  const start = md.indexOf("## Interface\n");
  assert.ok(start !== -1, "the Interface category is present");
  const next = md.indexOf("\n## ", start + 1);
  const lines = md.slice(start, next === -1 ? md.length : next).split("\n");
  const flavour = lines.filter((l) => l.startsWith("- Spell, scroll, weapon, armour"));
  assert.equal(flavour.length, 1, "exactly one flavour-layer bullet");
  for (const needle of ["→", "behind the scenes"]) assert.ok(flavour[0].includes(needle), `the flavour bullet carries "${needle}"`);
  // Phase 96 (plan 96-11): the identity, ability, special-skill and chip lines get their own old → new bullet, rules unchanged.
  const identity = lines.filter((l) => l.startsWith("- Race, sub-class and class blurbs"));
  assert.equal(identity.length, 1, "exactly one identity, ability and chip bullet");
  for (const needle of ["→", "behind the scenes", "ability and special-skill descriptions", "condition-chip explanations", "every rule and number unchanged"]) {
    assert.ok(identity[0].includes(needle), `the identity bullet carries "${needle}"`);
  }
  for (const line of md.split("\n")) {
    assert.ok(!line.includes("RULES"), `no line names RULES: ${line.slice(0, 60)}`);
    assert.ok(!line.includes("Always show the rules"), `no line names the Always switch: ${line.slice(0, 60)}`);
  }
  assert.equal(lines.filter((l) => l.startsWith("- Settings:")).length, 0, "no Settings bullet in the Interface category");
});

// ─── Phase 96 (FLAVOR-03): the Hero dossier and trait line ────────────────
//
// Phase 97.1 (FLAVOR-07): declared re-pin. The dossier (Race, Class, Subclass) and the trait line show the flavour only. Today's note and the
// unchanged footer are drawn nowhere (RACE_NOTE, CLASS_NOTE, SUB_NOTE and the identity footers stay in code for the guards), and an identity
// with no flavour line renders as today. Extended by 96-06 and 96-07.

function paintHero(sub, race) {
  const { document } = createRecordingDocument();
  const state = newRun(1, [], { force: { sub, race } });
  const host = document.getElementById("screen-hero");
  renderHeroTab(host, state, {});
  return { document, host, state, repaint: () => renderHeroTab(host, state, {}) };
}

const dossSections = (document) => document.getElementById("doss").children;

test("(s) Dossier: each section is the heading, the name and one digit-free flavour line; the note and footer are drawn nowhere", () => {
  const { document, state } = paintHero("Cat Burglar", "Wilmsry");
  const c = state.c;
  const expected = [
    ["race", c.race, [RACE_NOTE[c.race], ...footerLines("race", c.race)]],
    ["class", c.cls, [CLASS_NOTE[c.cls]]],
    ["sub", c.sub, [SUB_NOTE[c.sub], ...footerLines("sub", c.sub)]],
  ];
  const secs = dossSections(document);
  assert.equal(secs.length, 3);
  expected.forEach(([kind, key, absent], i) => {
    const sec = secs[i];
    assert.equal(sec.children.length, 3, `${kind}: h3, p.who and the flavour paragraph, nothing else`);
    const [h3, who, flavor] = sec.children;
    assert.equal(String(h3.tagName).toLowerCase(), "h3");
    assert.ok(hasClass(who, "who"));
    assert.equal(textOf(flavor), flavorOfIdentity(kind, key), `${kind}: the visible paragraph is the flavour line`);
    assert.doesNotMatch(textOf(flavor), /\d/, `${kind}: the flavour line carries no digit`);
    for (const child of sec.children) assert.equal(/(^|\s)doss-rules/.test(String(child.className || "")), false, `${kind}: no doss-rules class on a child`);
    assertNoRulesControls(sec, `the ${kind} section`);
    const visible = sec.children.map(textOf).join("\n");
    for (const line of absent) assert.ok(!visible.includes(line), `${kind}: "${String(line).slice(0, 40)}" is drawn nowhere`);
  });
});

test("(t) Trait line: the sentence keeps temperament, motive and phobia; the race note is drawn nowhere", () => {
  const { document, state } = paintHero("Cat Burglar", "Wilmsry");
  const c = state.c;
  const trait = document.getElementById("s-trait");
  const visible = String(trait.innerHTML).replace(/<[^>]+>/g, "");
  assert.equal(visible, `${c.temperament}, driven by ${c.motive.toLowerCase()}, afraid of ${c.phobia.toLowerCase()}.`);
  assert.doesNotMatch(visible, /\d/, "no number in the visible trait line");
  assert.ok(!String(trait.innerHTML).includes(RACES[c.race].note), "the race note is not in the visible markup");
  assertNoRulesControls(trait, "the trait line");
});

test("(u) tolerant: a sub-class with no flavour line renders its section as before, with no rules control and no throw", () => {
  const view = paintHero("Cat Burglar", "Wilmsry");
  view.state.c.sub = "Mystery Sub";
  assert.doesNotThrow(() => view.repaint());
  const secs = dossSections(view.document);
  assert.equal(secs.length, 3);
  const sub = secs[2];
  assert.equal(String(sub.innerHTML), `<h3>Subclass</h3><p class="who">Mystery Sub</p><p></p>`, "today's markup, nothing more");
  assertNoRulesControls(sub, "the unknown sub-class section");
  assert.equal(secs[0].children.length, 3, "the known race section is flavour-only");
  assertNoRulesControls(secs[0], "the race section");
  assert.equal(String(view.document.getElementById("doss-who").textContent), `${view.state.c.race} Mystery Sub`);
});

// ─── Phase 96 (FLAVOR-04): the Hero ability and skill lists, and the Final Sheet's tricks ───
//
// Phase 97.1 (FLAVOR-07): declared re-pin. The Hero tab's ability and passive-skill lists show the flavour line, with the state span and
// data-state untouched, and no rules control or body. The exact txt is pinned by the skill-table and ability guards, not by this surface.
// The read-only Final Sheet shows the flavour and no control of any kind.

const abilityLis = (document) => document.getElementById("s-abilities").children;
const skillLis = (document) => document.getElementById("s-skills").children;
const lisChild = (li, tag) => li.children.find((el) => String(el.tagName).toLowerCase() === tag);

test("(v) Hero abilities: each row reads its flavour line with no digit and its state span; no rules control exists", () => {
  for (const sub of ["Soldier", "Cat Burglar"]) {
    const view = paintHero(sub, "Wilmsry");
    const rows = characterSheetViewModel(view.state).abilities;
    const lis = abilityLis(view.document);
    assert.ok(rows.length >= 1 && lis.length === rows.length, `${sub}: one list item per ability`);
    rows.forEach((row, i) => {
      const li = lis[i];
      const flavor = flavorOfAbility(row.name);
      assert.ok(flavor, `${row.name} has a flavour line`);
      assert.equal(textOf(lisChild(li, "i")), flavor, `${row.name}: the italic line is the flavour`);
      assert.doesNotMatch(textOf(lisChild(li, "i")), /[0-9]/, `${row.name}: no digit in the flavour line`);
      assert.equal(textOf(lisChild(li, "span")), row.state, `${row.name}: the state span is unchanged`);
      assertNoRulesControls(li, `${row.name}'s row`);
      assert.ok(!textOf(li).includes(ABILITY_BY_ID[row.id].txt), `${row.name}: the exact txt is drawn nowhere`);
    });
  }
});

test("(v) Hero abilities: in a fight the row keeps its data-state and state words, and still draws no rules control after a repaint", () => {
  const view = paintHero("Soldier", "Wilmsry");
  view.state.combat = { foes: [foe()], type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you", pending: false };
  view.repaint();
  const rows = characterSheetViewModel(view.state).abilities;
  const lis = abilityLis(view.document);
  rows.forEach((row, i) => {
    assert.equal(lis[i].dataset.state, row.stateKind, `${row.name}: data-state unchanged`);
    assert.equal(textOf(lisChild(lis[i], "span")), row.state, `${row.name}: state words unchanged`);
    assertNoRulesControls(lis[i], `${row.name}'s row`);
  });
});

test("(w) Hero skills: a passive row shows the skill flavour and nothing else; a Magic User and an empty list render as before", () => {
  const fighter = paintHero("Soldier", "Wilmsry");
  const owned = Object.keys(fighter.state.c.skills);
  assert.ok(owned.length >= 1);
  skillLis(fighter.document).forEach((li, i) => {
    const name = owned[i];
    assert.equal(textOf(lisChild(li, "i")), flavorOfSkill(name), `${name}: the italic line is the skill flavour`);
    assert.doesNotMatch(textOf(lisChild(li, "i")), /[0-9]/);
    assertNoRulesControls(li, `${name}'s row`);
  });

  const thief = paintHero("Cat Burglar", "Wilmsry");
  thief.state.c.skills = { Locks: 2, Sewing: 1 };
  thief.repaint();
  const [locks, sewing] = skillLis(thief.document);
  assert.equal(textOf(lisChild(locks, "b")), "Locks ✦", "level two keeps its mark");
  assertNoRulesControls(locks, "the Locks row");
  assertNoRulesControls(sewing, "the Sewing row");

  const mu = newRun(1, [], { force: { cls: "Magic User" } });
  const muDoc = createRecordingDocument().document;
  renderHeroTab(muDoc.getElementById("screen-hero"), mu, {});
  assert.equal(textOf(skillLis(muDoc)[0]), "A Magic User has spells instead.");
  fighter.state.c.skills = {};
  fighter.repaint();
  assert.equal(textOf(skillLis(fighter.document)[0]), "No skills bought.");
  assertNoRulesControls(fighter.document.getElementById("s-skills"), "the skills list");
});

function deadSheet(cls) {
  const state = newRun(3, [], { force: { cls } });
  if (cls === "Fighter") state.c.abilities = ["secondWind", "taunt"];
  die(state, "trap", null, makeRng(2), [], () => 1);
  const vm = finalSheetViewModel(state);
  const { document } = createRecordingDocument();
  const host = document.createElement("div");
  renderFinalSheet(host, vm);
  return { vm, host };
}

test("(x) Final Sheet: the flavour shows, no control exists, no rules text is present and no rules control or body exists", () => {
  for (const cls of ["Fighter", "Thief"]) {
    const { vm, host } = deadSheet(cls);
    const withFlavor = vm.tricks.rows.filter((r) => r.flavor);
    assert.ok(withFlavor.length >= 1, `${cls}: at least one trick has a flavour line`);
    const all = walk(host);
    const texts = all.map(textOf);
    for (const r of withFlavor) {
      assert.ok(texts.includes(r.flavor), `${cls}: ${r.name} shows its flavour`);
      assert.ok(!texts.includes(r.description), `${cls}: ${r.name}'s exact text is absent`);
    }
    for (const n of all) {
      assert.notEqual(n.tagName, "button");
      assert.equal(n.onclick, null);
    }
    // Phase 97.1 (FLAVOR-07): declared re-pin. Was: no body and no button with the setting off, a static body with it on.
    assertNoRulesControls(host, `${cls}'s Final Sheet`);
  }
});

// Phase 96 (FLAVOR-04): declared re-pin. Case (y) used to pin "active rows keep today's markup" (an active skill
// had no skill flavour, so its row printed the rules text in the open). Every active skill now has a line, so that half of
// the case moves to the new case below; case (y) keeps the tolerant half (an unknown ability id, an unknown skill name).
test("(y) tolerant: an ability id absent from the catalog is dropped, and a skill with no flavour renders its txt with no rules control", () => {
  const fighter = paintHero("Soldier", "Wilmsry");
  fighter.state.c.abilities = ["noSuchAbility", "taunt"];
  assert.doesNotThrow(() => fighter.repaint());
  const lis = abilityLis(fighter.document);
  assert.equal(lis.length, 1, "the unknown id is silently dropped");
  assert.equal(textOf(lisChild(lis[0], "b")), ABILITY_BY_ID.taunt.name);

  const thief = paintHero("Cat Burglar", "Wilmsry");
  thief.state.c.skills = { "Mystery Skill": 1 };
  assert.doesNotThrow(() => thief.repaint());
  const [mystery] = skillLis(thief.document);
  assert.equal(flavorOfSkill("Mystery Skill"), "", "an unknown skill has no line");
  assert.equal(String(mystery.innerHTML), "<b>Mystery Skill</b><i></i>", "today's markup for an unknown skill");
  assertNoRulesControls(thief.document.getElementById("s-skills"), "the skills list");
});

// Phase 96 (FLAVOR-04), plan 96-12: an ACTIVE special skill reads like a passive one: its own flavour line. Phase 97.1 (FLAVOR-07):
// declared re-pin. Was: the exact txt behind a RULES toggle. Now no rules control or body, for every active skill.
test("(y2) Hero skills: a bought active skill shows its skill flavour and no rules control, for every active skill", () => {
  for (const [sub, table] of [["Soldier", FIGHTER_SKILLS], ["Cat Burglar", THIEF_SKILLS]]) {
    const active = Object.keys(table).filter((k) => table[k].active);
    assert.ok(active.length >= 4, `${sub}: the table has active skills`);
    const view = paintHero(sub, "Wilmsry");
    view.state.c.skills = Object.fromEntries(active.map((k) => [k, 1]));
    assert.doesNotThrow(() => view.repaint());
    skillLis(view.document).forEach((li, i) => {
      const name = active[i];
      assert.ok(flavorOfSkill(name), `${name}: has a skill line`);
      assert.equal(textOf(lisChild(li, "i")), flavorOfSkill(name), `${name}: the italic line is the skill flavour`);
      assert.doesNotMatch(textOf(lisChild(li, "i")), /[0-9]/);
      assertNoRulesControls(li, `${name}'s row`);
    });
  }
});

// ─── Phase 96 (FLAVOR-04): the chip tap cards and the UP YOUR SLEEVE card ───
//
// The chip cards are driven through the REAL classic paint (paintConditions on
// the HUD strip, renderYourLot in a fight) and the REAL renderRail; the module
// script's entry points (window.mzRailLine, window.mzConditionCard) are not in
// the sandbox, so this rig installs mirrors of their bodies built on the real
// railLineCard and conditionCard with the trailing flavour argument (the source
// pins hold the module's real bodies to that shape). The rig is copied by value
// from status-chit-combat.test.js and your-lot-chips.test.js.

import { createFakeClock } from "./harness/fakeClock.js";
import { railPush, railLineCard, conditionCard, abilityPoolCard, abilityPoolFlavor, RAIL_HOLD } from "../../src/browser/rail.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { flavorOf, flavorOfChip } from "../../src/browser/flavorText.js";
import { applyAction } from "../../engine/engine.js";
import { vignetteFor, waiverFor } from "../../src/browser/darknessView.js";
import { inDark, revealRadius, mapViewRadius, darkWaiver } from "../../engine/derived.js";

function chipState() {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, timers: {},
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

const chipFoe = (name, extra = {}) => ({ name, type: "Beasts", lvl: 2, size: "S", intel: 4, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" }, lives: 1, ...extra });

function chipFightState({ afraid = 2 } = {}) {
  const s = chipState();
  s.combat = { foes: [chipFoe("Wolf"), chipFoe("Cave Bear", { size: "L", wp: 25, maxWP: 25 })], type: "Beasts", round: 2, target: 1, spellOpen: false, tracked: false, first: "you", afraid };
  return s;
}

function chipRig({ reducedMotion = true } = {}) {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion });
  const w = sandbox.context.window;
  w.mzRailLine = (title, line, tone, hold, icon, iconKey = null, flavor = null) => {
    w.__mzRail = railPush(w.__mzRail, railLineCard(title, line, tone, hold, icon, iconKey, flavor));
    w.renderRail?.();
  };
  w.mzConditionCard = (title, text, flavor = null) => {
    const live = w.__mzState?.get?.();
    if (!live || !(live.combat || w.__mzBeat?.active?.())) return;
    w.__mzRail = railPush(w.__mzRail, conditionCard(title, text, flavor));
    w.renderRail?.();
  };
  const railEl = () => doc.document.getElementById("mw-rail");
  const chip = (key) => doc.document.getElementById("mm-conditions").children.find((c) => c.className === "mw-cond" && c.dataset.key === key);
  const descriptor = (key) => w.__mzConditionsOf(w.__mzState.get()).find((cn) => cn.key === key);
  const show = (state) => { w.__mzState.set(state); sandbox.paint(); };
  return { clock, doc, sandbox, w, ctx: sandbox.context, railEl, chip, descriptor, show, renderRail: () => sandbox.context.renderRail() };
}

/** The rail's typed lead lines, read off the real #mw-rail-lines. Phase 97.1 (FLAVOR-07): declared re-pin. The toggles and body it used to return are gone; assertNoRulesControls(lines) pins their absence. */
function readRailCard(r) {
  const lines = r.doc.document.getElementById("mw-rail-lines");
  return {
    lines,
    leads: lines.children.filter((el) => hasClass(el, "mw-rail-line")),
  };
}

const noDigit = (s) => !/[0-9]/.test(String(s));

/**
 * Phase 97.1 (FLAVOR-07): declared re-pin. Was: assert the raised card leads with `lead` and holds `exact` behind a collapsed RULES
 * toggle outside the typed lines. Now: the raised card leads with `lead` and the model still carries `exact` on lines[0].rules (the
 * guard), and after a real repaint the rail draws the lead alone: no toggle, no body, and `exact` is drawn nowhere.
 */
function assertFlavourFirstCard(r, { lead, exact, kind }) {
  const card = r.w.__mzRail.card;
  assert.equal(card.kind, kind);
  assert.equal(card.lines.length, 1);
  assert.equal(card.lines[0].text, lead);
  assert.equal(card.lines[0].rules, exact);
  assert.equal(noDigit(lead), true, `the lead carries no digit: ${lead}`);
  r.renderRail();
  const { lines, leads } = readRailCard(r);
  assert.deepEqual(leads.map(textOf), [lead]);
  assertNoRulesControls(lines, "the rail card");
  assert.ok(!textOf(lines).includes(exact), "the exact text is not drawn on the rail");
  return card;
}

// Phase 97.1 (FLAVOR-07): declared re-pin. Was: a RULES tap held the card up, a repaint kept the body open and Always on dropped the toggle.
// With no control, only the plain chip-tap assertions remain.
test("(z1) HUD strip out of a fight: a harmful and two helpful chips lead with flavour; the whole tap text stays on the card model, drawn nowhere", () => {
  const cases = [
    ["darkness", (s) => { s.c.darkFor = 9; }],
    ["might", (s) => { s.c.might = 2; }],
    ["senses", (s) => { s.c.senses = true; }],
  ];
  for (const [key, setup] of cases) {
    const r = chipRig();
    const s = chipState();
    setup(s);
    r.show(s);
    const cn = r.descriptor(key);
    const label = r.ctx.conditionLabel(cn);
    const lead = flavorOfChip(cn);
    assert.ok(lead, `${key} has a flavour line`);
    const exact = r.ctx.conditionTapText(cn, label, s);
    const el = r.chip(key);
    assert.ok(el, `the ${key} chip`);
    assert.ok(textOf(el).startsWith(label), "the chip label is untouched");
    assert.ok(!textOf(el).includes(lead), "the flavour is on the card, never on the chip");
    r.clock.advance(ARM_DELAY_MS + 10);
    el.onclick();
    assertFlavourFirstCard(r, { lead, exact, kind: undefined });
    assert.equal(r.w.__mzRail.card.title, label.toUpperCase());
  }
});

test("(z1) HUD strip: the measured effect, the explanation and the how-long tail all stay on the card model, byte for byte", () => {
  const r = chipRig();
  const s = chipState();
  s.c.might = 2;
  r.show(s);
  const cn = r.descriptor("might");
  r.clock.advance(ARM_DELAY_MS + 10);
  r.chip("might").onclick();
  const exact = r.w.__mzRail.card.lines[0].rules;
  assert.equal(exact, `${r.ctx.explainCondition(cn, "Strong")} Until the day ends, from your fear.`);
  assert.equal(exact, r.ctx.conditionTapText(cn, "Strong", s));
});

test("(z2) in a fight: the combat condition card leads with flavour and keeps the exact text on its model; the aim is unchanged", () => {
  const r = chipRig();
  const s = chipFightState();
  s.c.might = 2;
  r.show(s);
  const target = s.combat.target;
  for (const key of ["afraid", "might"]) {
    const cn = r.descriptor(key);
    const label = r.ctx.conditionLabel(cn);
    const lead = flavorOfChip(cn);
    assert.ok(lead, `${key} has a flavour line`);
    const exact = r.ctx.conditionTapText(cn, label, s);
    r.clock.advance(ARM_DELAY_MS + 10);
    r.chip(key).onclick();
    assertFlavourFirstCard(r, { lead, exact, kind: "cond" });
    assert.equal(r.railEl().hidden, false);
    assert.equal(r.railEl().dataset.over, "combat");
    assert.equal(s.combat.target, target, "the aim is unchanged");
  }
  // The harmful chip's lead still says something is wrong.
  assert.match(flavorOfChip(r.descriptor("afraid")), /Fear|fear|nerve/);
});

function lotRig() {
  const r = chipRig();
  r.dispatched = [];
  for (const name of ["mzAttack", "mzCastSpell", "mzSing", "mzDrinkPotion", "mzReadScroll", "mzUseAbility", "mzUseItem", "mzFlee", "mzParley", "mzLoseTurn", "mzFight"]) {
    r.w[name] = (...args) => { r.dispatched.push({ name, args }); };
  }
  return r;
}

function lotHero(overrides = {}) {
  return {
    cls: "Thief", sub: "Burglar", race: "Human", level: 3, sp: 0, maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
    might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, abilities: ["smoke"], timers: {},
    ...overrides,
  };
}

function lotFightState({ c = {}, party = [], combat = {} } = {}) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 5, c: lotHero(c), floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: [{ name: "Stone Ox", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 900, maxWP: 900, alive: true, asleep: 0, sp: {}, lives: 1 }],
      type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you", ...combat,
    },
  };
}

function lotCardsOf(r) {
  return Array.from(r.doc.document.getElementById("enc-body").querySelectorAll(".cb-lot-card"));
}

function lotChipsOf(card) {
  const row = card.children.find((el) => el.className === "cb-lot-chips");
  return row ? row.children.filter((el) => el.className === "cb-lot-chip") : [];
}

test("(z3) YOUR LOT: the hero's Smoke chip and a Joiner's Sidestep chip raise the flavour-first card; the member wording sits in the card model's exact text only", () => {
  const r = lotRig();
  const used = applyAction(lotFightState(), { type: "useAbility", key: "smoke" }).state;
  const state = lotFightState({
    c: used.c,
    party: [{ name: "Joiner", cls: "Fighter", sub: "Soldier", lvl: 1, wp: 30, maxWP: 30, status: "ok", timers: { "ability:sidestep": { cadence: "rounds", left: 1, phase: "effect", cd: 4 } } }],
    combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30 }] },
  });
  state.rngState = used.rngState;
  r.w.__mzState.set(state);
  r.ctx.renderEncounter();
  const cards = lotCardsOf(r);
  assert.ok(cards.length >= 2, "hero and member cards");

  // The hero's chip.
  const heroChip = lotChipsOf(cards[0])[0];
  assert.equal(textOf(heroChip), "Smoke · 2", "the chip label and count are untouched");
  const heroCn = r.w.__mzConditionsOf(state).find((cn) => cn.key === "ability" && cn.ability === "smoke");
  r.clock.advance(ARM_DELAY_MS + 10);
  heroChip.onclick();
  const heroLead = flavorOfAbility("Smoke");
  assert.ok(heroLead);
  const heroExact = r.ctx.conditionTapText(heroCn, "Smoke", state, { member: false });
  assertFlavourFirstCard(r, { lead: heroLead, exact: heroExact, kind: "cond" });
  assert.match(heroExact, /from your Smoke\.$/);

  // The Joiner's chip: "their" belongs to the card model's exact text, never to the flavour lead.
  const memberChip = lotChipsOf(cards[1])[0];
  assert.equal(textOf(memberChip), "Sidestep · 1");
  const memberCn = r.w.__mzMemberConditionsOf(state, 0).find((cn) => cn.key === "ability");
  r.clock.advance(ARM_DELAY_MS + 10);
  memberChip.onclick();
  const memberLead = flavorOfAbility("Sidestep");
  assert.ok(memberLead);
  const memberExact = r.ctx.conditionTapText(memberCn, "Sidestep", state, { member: true });
  assertFlavourFirstCard(r, { lead: memberLead, exact: memberExact, kind: "cond" });
  assert.match(memberExact, /from their Sidestep\.$/);
  assert.doesNotMatch(memberLead, /their/, "the member wording is in the exact text only");
  assert.deepEqual(r.dispatched, [], "a chip tap never dispatches");
});

test("(z4) an ability chip leads with that ability's own flavour line; its card model carries the ability's txt sentence", () => {
  const r = lotRig();
  const used = applyAction(lotFightState(), { type: "useAbility", key: "smoke" }).state;
  r.w.__mzState.set(used);
  r.ctx.renderEncounter();
  const cn = r.w.__mzConditionsOf(used).find((x) => x.key === "ability" && x.ability === "smoke");
  r.clock.advance(ARM_DELAY_MS + 10);
  lotChipsOf(lotCardsOf(r)[0])[0].onclick();
  const card = r.w.__mzRail.card;
  assert.equal(card.lines[0].text, flavorOfAbility(ABILITY_BY_ID.smoke.name));
  const txt = ABILITY_BY_ID.smoke.txt;
  assert.ok(card.lines[0].rules.includes(txt[0].toUpperCase() + txt.slice(1)), "the ability's own txt sentence is in the exact text");
  assert.equal(card.lines[0].rules, r.ctx.conditionTapText(cn, "Smoke", used));
});

test("(z5) a darkness waiver keeps the waiver-led sentence in the card model; dazed, weakened and a mirror Bubble lead with their own lines", () => {
  // Darkness with Night Vision holding it back.
  const dark = chipRig();
  const ds = chipState();
  ds.c.darkFor = 9;
  ds.c.skills = { "Night Vision": 1 };
  // The waiver reads the engine's one answer through the module script's bridge (darkness-vignette.test.js#darknessBridge).
  dark.w.__mzDarkness = { inDark, revealRadius, mapViewRadius, darkWaiver, vignetteFor, waiverFor };
  dark.show(ds);
  const dcn = dark.descriptor("darkness");
  dark.clock.advance(ARM_DELAY_MS + 10);
  dark.chip("darkness").onclick();
  const dcard = dark.w.__mzRail.card;
  assert.equal(dcard.lines[0].text, flavorOf("chip", "darkness"));
  assert.ok(dcard.lines[0].rules.startsWith("The dark is on you, but "), dcard.lines[0].rules);
  assert.equal(dcard.lines[0].rules, dark.ctx.conditionTapText(dcn, dark.ctx.conditionLabel(dcn), ds));

  // The kind-specific foe effects.
  for (const [kind, key] of [["dazed", "foeEffect/dazed"], ["weakened", "foeEffect/weakened"]]) {
    const r = chipRig();
    const s = chipFightState({ afraid: 0 });
    s.c.foeEffect = { kind, rounds: 2 };
    r.show(s);
    const cn = r.descriptor("foeEffect");
    r.clock.advance(ARM_DELAY_MS + 10);
    r.chip("foeEffect").onclick();
    const card = r.w.__mzRail.card;
    assert.equal(card.lines[0].text, flavorOf("chip", key), kind);
    assert.equal(card.lines[0].rules, r.ctx.conditionTapText(cn, r.ctx.conditionLabel(cn), s));
  }

  // An armed Bubble mirror.
  const m = chipRig();
  const ms = chipFightState({ afraid: 0 });
  ms.c.ward = { pool: 0, rounds: null, name: "Bubble", mirror: true };
  m.show(ms);
  const mcn = m.descriptor("ward");
  assert.equal(mcn.mirror, true);
  m.clock.advance(ARM_DELAY_MS + 10);
  m.chip("ward").onclick();
  assert.equal(m.w.__mzRail.card.lines[0].text, flavorOf("chip", "ward/mirror"));
  assert.equal(m.w.__mzRail.card.lines[0].rules, m.ctx.conditionTapText(mcn, m.ctx.conditionLabel(mcn), ms));
});

test("(z6) tolerant: a chip descriptor with an unknown key raises today's card with no rules control and no throw", () => {
  const r = chipRig();
  const s = chipState();
  s.c.might = 2;
  const real = r.w.__mzConditionsOf;
  r.w.__mzConditionsOf = (st) => [...real(st), { key: "mysteryBrew", polarity: "good" }];
  assert.doesNotThrow(() => r.show(s));
  const cn = r.descriptor("mysteryBrew");
  assert.ok(cn, "the unknown chip was enumerated");
  assert.equal(flavorOfChip(cn), "");
  const el = r.chip("mysteryBrew");
  assert.ok(el, "the unknown chip drew");
  r.clock.advance(ARM_DELAY_MS + 10);
  el.onclick();
  const card = r.w.__mzRail.card;
  assert.equal(card.lines[0].text, r.ctx.conditionTapText(cn, r.ctx.conditionLabel(cn), s), "today's card text");
  assert.equal("rules" in card.lines[0], false, "no rules property");
  r.renderRail();
  // Phase 97.1 (FLAVOR-07): declared re-pin. Was: toggles.length 0 and no body, read off the retired control's classes.
  assertNoRulesControls(readRailCard(r).lines, "the unknown chip's card");
});

test("(z6) the entry points forward the flavour spec to the real card builders", () => {
  assert.match(HTML, /window\.mzRailLine = \(title, line, tone, hold, icon, iconKey = null, flavor = null\) => \{\n\s+window\.__mzRail = railPush\(window\.__mzRail, railLineCard\(title, line, tone, hold, icon, iconKey, flavor\)\);/);
  assert.match(HTML, /window\.mzConditionCard = \(title, text, flavor = null\) => \{/);
  assert.match(HTML, /conditionCard\(title, text, flavor\)/);
  assert.match(HTML, /railInfo: \(title, text, flavor\) => window\.mzRailLine\?\.\(title, text, "info", 8400, "·", null, flavor\)/);
});

function poolCard(r, state) {
  // The mirror of the module script's surfaceAbilityPool (pinned to its source below).
  const card = abilityPoolCard(state.c);
  if (!card) return null;
  const flavor = abilityPoolFlavor(state.c);
  r.w.mzRailLine(card.title, card.line, card.tone, card.hold, card.icon, null, flavor);
  return { card, flavor };
}

test("(z7) UP YOUR SLEEVE: a fresh Fighter and Thief read 'New trick: <name> — <flavour>' with the exact old line on the card model only; a Magic User raises no card", () => {
  for (const cls of ["Fighter", "Thief"]) {
    const r = chipRig();
    const state = newRun(9, [], { force: { cls } });
    r.w.__mzState.set(state);
    r.sandbox.setState(state);
    r.w.__mzPendingNarration = null;
    const { card, flavor } = poolCard(r, state);
    const id = state.c.abilities.find((a) => ABILITY_BY_ID[a] && ABILITY_BY_ID[a].source === "pool");
    const meta = ABILITY_BY_ID[id];
    const own = flavorOfAbility(meta.name);
    assert.ok(own, `${meta.name} has a flavour line`);
    const lead = `New trick: ${meta.name} — ${own}`;
    assert.equal(flavor.line, lead);
    assert.equal(card.title, "UP YOUR SLEEVE");
    assert.equal(card.hold, RAIL_HOLD.level);
    const raised = r.w.__mzRail.card;
    assert.equal(raised.lines[0].text, lead);
    assert.equal(raised.lines[0].rules, `New trick: ${meta.name} — ${meta.txt}`, "the exact old line, still on the card model");
    assert.equal(noDigit(lead), true, lead);
    r.renderRail();
    const read = readRailCard(r);
    assert.deepEqual(read.leads.map(textOf), [lead]);
    // Phase 97.1 (FLAVOR-07): declared re-pin. Was: one collapsed toggle and a body equal to the exact line. Now neither is drawn and the
    // exact line is not on the rail.
    assertNoRulesControls(read.lines, "the UP YOUR SLEEVE card");
    assert.ok(!textOf(read.lines).includes(raised.lines[0].rules), "the exact old line is drawn nowhere");
  }
  const mu = newRun(9, [], { force: { cls: "Magic User" } });
  assert.equal(abilityPoolCard(mu.c), null);
  assert.equal(abilityPoolFlavor(mu.c), null);
});

test("(z7) surfaceAbilityPool forwards abilityPoolFlavor to the rail and logs the flavour line, the old line when there is none", () => {
  const start = HTML.indexOf("function surfaceAbilityPool(state) {");
  assert.ok(start > 0);
  const region = HTML.slice(start, HTML.indexOf("\n  }", start));
  assert.match(region, /const flavor = abilityPoolFlavor\(state\.c\);/);
  assert.match(region, /window\.mzRailLine\?\.\(card\.title, card\.line, card\.tone, card\.hold, card\.icon, null, flavor\);/);
  assert.match(region, /window\.logLine\?\.\(flavor \? flavor\.line : card\.line\);/);
});
