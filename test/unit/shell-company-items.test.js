// test/unit/shell-company-items.test.js
//
// Phase 89 plan 07 (ITEM-07, player side). The Hero tab's Company panel shows
// what each Joiner carries (armour, healing potions, worn items with their
// state), its live item chips, and, outside a fight, DRINK and USE that run the
// engine action memberUseItem through the same dispatch-with-narration seam as
// DISMISS. mazeworld.html has no module surface a test can import, so (like
// shell-company-panel.test.js) this reads the shipped source with fs, and it
// also drives the real renderHeroTab through the recording document.
//   1. renderPartyRoster's order: name/sub, class/level, HP, Weapon, Eats,
//      Armour, chips, items, then DISMISS;
//   2. DRINK and USE call deps.memberUseItem with the two ref shapes, and the
//      rendered buttons really do (recording DOM);
//   3. the bridge dispatches { type: "memberUseItem", i, potion | slot }
//      through dispatchWithNarration in the mzDismissJoiner order, rail only;
//   4. tabDeps forwards memberUseItem and memberChipsFor; chips come from the
//      engine's memberConditionsOf through conditionLabel / conditionTapText;
//   5. in a fight there are no buttons and one line says so;
//   6. HP wording, escText, the new CSS once each with no transition/animation;
//   7. the build artefact carries the bridge (skipped when www/ is absent).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import * as heroTab from "../../src/browser/heroTab.js";
import { newRun } from "../../engine/state.js";
import { CLOAKS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

function stripComments(source) {
  const noLine = source.split("\n").map((l) => { const i = l.indexOf("//"); return i === -1 ? l : l.slice(0, i); }).join("\n");
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}
const HERO_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n"));
const CODE = stripComments(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}
function regionOf(startMarker) {
  const start = HERO_SRC.indexOf(startMarker);
  const end = HERO_SRC.indexOf("\n}\n", start);
  assert.ok(start !== -1 && end > start, `${startMarker} region found`);
  return HERO_SRC.slice(start, end);
}

// ─── recording-DOM scenes ───────────────────────────────────────────────────

const cloak = { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Strength") };
const flying = { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Flying") };

function sheet(over = {}) {
  return {
    name: "Brom <b>", sub: "Knight", cls: "Fighter", race: "Human", level: 1, lvl: 1, weapon: "Club",
    wp: 20, maxWP: 40, potions: 2, status: "ok",
    armor: "Leather", ar: 6, armorMin: 0, armorWP: 12, armorMax: 15,
    worn: { cloak }, timers: {},
    ...over,
  };
}

function scene(member, { combat = null, deps = {} } = {}) {
  const { document } = createRecordingDocument();
  const run = newRun(1, []);
  run.party = [member];
  run.combat = combat;
  heroTab.renderHeroTab(document.getElementById("screen-hero"), run, deps);
  const card = document.getElementById("hero-party-list").children[0];
  return { document, card };
}

function walk(node, out = []) {
  if (!node || node.nodeType === 3) return out;
  out.push(node);
  for (const c of node.children || []) walk(c, out);
  return out;
}
const buttons = (card) => walk(card).filter((el) => el.tagName === "button");
const byClass = (card, cls) => walk(card).filter((el) => (el.className || "").split(/\s+/).includes(cls));
const textOf = (el) => (el._content && el._content.value) || el.textContent || "";

test("render: the card shows armour, the potion row and a worn row, in order, before DISMISS", () => {
  const { card } = scene(sheet());
  assert.match(card.innerHTML, /Armour: Leather · AR 6 · 12\/15 hp/);
  const kids = card.children.map((c) => c.className);
  const iItems = kids.indexOf("mw-party-items");
  const iDismiss = kids.findIndex((c) => String(c).includes("mw-party-dismiss"));
  assert.ok(iItems !== -1, "the item rows are drawn");
  assert.ok(iDismiss > iItems, "DISMISS stays last");
  const rows = byClass(card, "mw-party-item");
  assert.equal(rows.length, 2, "one potion row and one worn row");
  assert.match(textOf(rows[0].children[0]), /Healing potions/);
  assert.match(textOf(rows[1].children[0]), /Cloak of Strength/);
});

test("render: a Joiner's name is escaped wherever it is drawn", () => {
  const { card } = scene(sheet());
  assert.ok(card.innerHTML.includes("Brom &lt;b&gt;"));
  assert.ok(!card.innerHTML.includes("Brom <b>"));
});

test("render: DRINK and USE call deps.memberUseItem with the two ref shapes", () => {
  const calls = [];
  const { card } = scene(sheet(), { deps: { memberUseItem: (i, ref) => calls.push([i, ref]) } });
  const bts = buttons(card).filter((b) => b.textContent === "DRINK" || b.textContent === "USE");
  assert.deepEqual(bts.map((b) => b.textContent), ["DRINK", "USE"]);
  bts[0].onclick();
  bts[1].onclick();
  assert.deepEqual(calls, [[0, { potion: true }], [0, { slot: "cloak" }]]);
});

test("render: a disabled control shows its one-line reason instead of a button", () => {
  const full = scene(sheet({ wp: 40, worn: { cloak: flying } }));
  assert.equal(buttons(full.card).filter((b) => b.textContent === "DRINK" || b.textContent === "USE").length, 0);
  const hints = byClass(full.card, "mw-party-hint").map((h) => h.textContent);
  assert.deepEqual(hints, [heroTab.COMPANY_COPY.reason.fullHealth, heroTab.COMPANY_COPY.reason.leaderOnly]);
  const cooling = scene(sheet({ timers: { "item:Cloak of Strength": { cadence: "squares", left: 12, phase: "cooldown" } } }));
  assert.deepEqual(byClass(cooling.card, "mw-party-hint").map((h) => h.textContent), [heroTab.COMPANY_COPY.reason.cooling.replace("{n}", 12)]);
  assert.match(cooling.card.children.find((c) => c.className === "mw-party-items").children[1].children[0].innerHTML, /cooling 12 sq/);
});

test("render: in a fight there are no DRINK or USE and one line says the fight is automatic", () => {
  const { card } = scene(sheet(), { combat: { foes: [], allies: [] } });
  assert.equal(buttons(card).filter((b) => b.textContent === "DRINK" || b.textContent === "USE").length, 0);
  assert.equal(byClass(card, "mw-party-hint").length, 0);
  const note = byClass(card, "mw-party-line").filter((el) => el.textContent === heroTab.COMPANY_COPY.inFight);
  assert.equal(note.length, 1);
  assert.equal(card.children.some((c) => String(c.className).includes("mw-party-dismiss")), false, "no DISMISS in a fight (unchanged)");
});

test("render: chips come from deps.memberChipsFor and a tap raises the text on the rail (deps.railInfo) only", () => {
  const tapped = [];
  const chips = [{ text: "Crit-proof · 30 sq", tone: "good", label: "Crit-proof", tapText: () => "No crits land on them." }];
  const asked = [];
  const { card } = scene(sheet(), { deps: { memberChipsFor: (i) => { asked.push(i); return chips; }, railInfo: (title, text) => tapped.push([title, text]) } });
  assert.deepEqual(asked, [0]);
  const row = byClass(card, "mw-party-chips");
  assert.equal(row.length, 1);
  const chip = row[0].children[0];
  assert.equal(chip.textContent, "Crit-proof · 30 sq");
  assert.equal(chip.dataset.tone, "good");
  chip.onclick();
  assert.deepEqual(tapped, [["CRIT-PROOF", "No crits land on them."]]);
});

test("render: no chips, or no seam, draws no chip row", () => {
  assert.equal(byClass(scene(sheet()).card, "mw-party-chips").length, 0);
  assert.equal(byClass(scene(sheet(), { deps: { memberChipsFor: () => [] } }).card, "mw-party-chips").length, 0);
});

// ─── source assertions ──────────────────────────────────────────────────────

test("Source: renderPartyRoster draws the fields in order: name, sub, class, HP, Weapon, Eats, Armour, chips, items, DISMISS", () => {
  const region = regionOf("function renderPartyRoster(doc, state, deps) {");
  const at = (needle) => { const i = region.indexOf(needle); assert.ok(i !== -1, `find ${needle}`); return i; };
  const order = ["mw-party-name", "mw-party-sub", "mw-party-line", "HP <b>", "mw-map-hptrack", "Weapon: ", "escText(eatsText)", "mw-party-armour", "appendCompanyChips(", "appendCompanyItems(", '"DISMISS"'].map(at);
  for (let k = 1; k < order.length; k++) assert.ok(order[k - 1] < order[k], `field ${k} follows field ${k - 1}`);
});

test("Source: every sheet string in the new rows goes through escText; the region and helpers never say WP", () => {
  const items = regionOf("function appendCompanyItems(");
  assert.match(items, /escText\(w\.name\)/);
  assert.match(items, /escText\(w\.statusText\)/);
  assert.match(items, /escText\(w\.effect\)/);
  assert.match(regionOf("function renderPartyRoster(doc, state, deps) {"), /escText\(armourLineFor\(carried\.armour\)\)/);
  for (const r of [items, regionOf("function appendCompanyChips("), regionOf("function armourLineFor(")]) {
    assert.doesNotMatch(r, /\bWP\b/);
  }
});

test("Source: DRINK and USE call deps.memberUseItem; the result is the rail's, never the panel's", () => {
  assert.equal((HERO_SRC.match(/deps\.memberUseItem\?\.\(idx, \{ potion: true \}\)/g) || []).length, 1);
  assert.equal((HERO_SRC.match(/deps\.memberUseItem\?\.\(idx, \{ slot: w\.slot \}\)/g) || []).length, 1);
  const region = regionOf("function appendCompanyItems(");
  assert.doesNotMatch(region, /memberPotionDrunk|itemUsed|useRefused/);
  assert.doesNotMatch(region, new RegExp("mzTo" + "ast"));
});

test("Bridge: window.mzMemberUseItem dispatches memberUseItem through dispatchWithNarration in the mzDismissJoiner order", () => {
  assert.equal((CODE.match(/window\.mzMemberUseItem = function memberUseItemBridge\(/g) || []).length, 1);
  const region = sliceBetween(CODE, "window.mzMemberUseItem = function memberUseItemBridge(", "\n  };");
  assert.match(region, /\{ type: "memberUseItem", i: idx, potion: true \}/);
  assert.match(region, /\{ type: "memberUseItem", i: idx, slot: ref && ref\.slot \}/);
  const iDispatch = region.indexOf("dispatchWithNarration(action)");
  const iSet = region.indexOf("window.__mzState.set(state);");
  const iLog = region.indexOf("window.logLine(line)");
  const iPaint = region.indexOf("window.paint();");
  const iEnc = region.indexOf("window.renderEncounter();");
  assert.ok(iDispatch !== -1 && iDispatch < iSet && iSet < iLog && iLog < iPaint && iPaint < iEnc, "bridge steps in order");
});

test("tabDeps forwards memberUseItem, memberChipsFor and railInfo; chips read memberConditionsOf through conditionLabel and conditionTapText", () => {
  assert.equal((CODE.match(/memberUseItem: \(i, ref\) => window\.mzMemberUseItem\?\.\(i, ref\),/g) || []).length, 1);
  assert.equal((CODE.match(/memberChipsFor: \(i\) => memberChipsFor\(i\),/g) || []).length, 1);
  assert.equal((CODE.match(/railInfo: \(title, text\) => window\.mzRailLine\?\.\(title, text, "info", 8400, "·"\),/g) || []).length, 1);
  const region = sliceBetween(CODE, "function memberChipsFor(i) {", "\n}\n");
  assert.match(region, /window\.__mzMemberConditionsOf\?\.\(S, i\)/);
  assert.match(region, /conditionLabel\(cn\)/);
  assert.match(region, /conditionTapText\(cn, label, S, \{ member: true \}\)/);
});

test("CSS: the new Company item rules exist once each, with no transition, animation or aria-disabled token", () => {
  const styleBlock = sliceBetween(HTML, "<style>", "</style>");
  assert.doesNotMatch(styleBlock, /aria-disabled/);
  for (const sel of [".mw-party-chips", ".mw-party-items", ".mw-party-item", ".mw-party-item-text", ".mw-party-effect", ".mw-party-item-btn", ".mw-party-hint"]) {
    const re = new RegExp("^" + sel.replace(/\./g, "\\.") + "\\{[^}]*\\}", "gm");
    const found = HTML.match(re) || [];
    assert.equal(found.length, 1, `${sel} defined once`);
    assert.doesNotMatch(found[0], /transition|animation/i, `${sel} has no motion`);
  }
});

test("Build artefact: www/index.html carries mzMemberUseItem (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) return;
  assert.match(fs.readFileSync(wwwPath, "utf8"), /mzMemberUseItem/);
});
