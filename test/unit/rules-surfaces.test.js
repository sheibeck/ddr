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
import { flavorOfItem } from "../../src/browser/flavorText.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { SPELLS, NICHE_LABELS } from "../../content/index.js";
import { SPELL_FLAVOR } from "../../content/spells.js";
import { newRun } from "../../engine/state.js";
import { rollJewel } from "../../engine/items.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { renderGearTab, GEAR_COPY, gearWornModel } from "../../src/browser/gearTab.js";
import { usableBy } from "../../src/browser/viewModels.js";
import { scrollReadOdds } from "../../src/browser/rollOdds.js";
import { WEAPON_FLAVOR } from "../../content/weapons.js";
import { ARMOR_FLAVOR } from "../../content/armors.js";
import { POTION_FLAVOR } from "../../content/potions.js";
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
