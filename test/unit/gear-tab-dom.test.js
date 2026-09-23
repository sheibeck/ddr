// test/unit/gear-tab-dom.test.js
//
// Phase 62 (GSCR-01..06), Plan 02 — the rebuilt Gear tab's DOM + CSS pin
// suite. Task 1 covers the CSS block (every .mw-gear-*/#gear-* font-size
// scales with --mw-text-scale, no transition/animation, the retired Phase
// 43 rules are gone) and the tabDeps() drinkPotion/readScroll closures.
// Task 2 adds the render section (renderGearTab against the Plan 01 models).
// Mirrors gearTab.test.js's own HTML read (CRLF-normalized) and its
// stripComments/extractScriptRegions helpers.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { fixedStates, SNAPSHOT_IDS } from "./harness/shellSandbox.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import {
  renderGearTab,
  renderCarriedList,
  bagUsage,
  GEAR_COPY,
  GEAR_WORN_ORDER,
  gearHeaderModel,
  gearUseCell,
  gearWornModel,
  gearBagMeterModel,
  gearBagCardsModel,
  gearConsumablesModel,
  gearKitRows,
} from "../../src/browser/gearTab.js";
import { armorDisplay, dropShelfItems } from "../../src/browser/viewModels.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { itemTimerId } from "../../engine/derived.js";
import { toolItem } from "../../engine/items.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const HTML_RAW = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as gearTab.test.js:
// line comments first, THEN block comments) ────────────────────────────────
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

function extractScriptRegions(raw) {
  const classicStart = raw.indexOf("\n<script>\n");
  assert.ok(classicStart !== -1, "column-0 <script> tag not found");
  const classicEnd = raw.indexOf("\n</script>\n", classicStart + 1);
  assert.ok(classicEnd !== -1, "classic </script> tag not found");
  return { classic: raw.slice(classicStart + 1, classicEnd) };
}

const { classic: CLASSIC_RAW } = extractScriptRegions(HTML_RAW);
const CLASSIC = stripComments(CLASSIC_RAW);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// The <style> block: everything between the first "<style>" that opens the
// theme's :root token block and its matching "</style>" — this file's own
// pins only care about the :root-token style block (where every .mw-gear-*/
// #gear-* rule lives), never the tiny head-of-file resets.
function styleBlock() {
  const start = HTML_RAW.indexOf(":root{");
  assert.ok(start !== -1, ":root token block not found");
  const end = HTML_RAW.indexOf("</style>", start);
  assert.ok(end !== -1, "</style> not found after :root");
  return HTML_RAW.slice(start, end);
}

// ─── (a)/(b): every .mw-gear-*/#gear- font-size line scales with
// --mw-text-scale, and none carries a transition/animation token ──────────

function gearStyleLines() {
  const block = styleBlock();
  return block
    .split("\n")
    .filter((line) => /^\s*(\.mw-gear-[^{]*|#gear-[^{]*)\{/.test(line));
}

test("CSS: every Gear-tab font-size declaration scales with var(--mw-text-scale)", () => {
  const lines = gearStyleLines();
  assert.ok(lines.length >= 20, `expected at least 20 .mw-gear-/#gear- style lines, found ${lines.length}`);
  let fontSizeCount = 0;
  for (const line of lines) {
    // A font-size declaration is terminated by either ";" (another
    // declaration follows) or "}" (it's the rule's last declaration).
    const m = line.match(/font-size:([^;}]+)[;}]/);
    if (!m) continue;
    fontSizeCount++;
    assert.match(m[1], /var\(--mw-text-scale\)/, `expected ${line.trim()} to scale with var(--mw-text-scale)`);
  }
  assert.ok(fontSizeCount >= 20, `expected at least 20 font-size declarations, found ${fontSizeCount}`);
});

test("CSS: no Gear-tab rule carries a transition or animation token", () => {
  const lines = gearStyleLines();
  for (const line of lines) {
    assert.doesNotMatch(line, /transition/i, `unexpected transition in ${line.trim()}`);
    assert.doesNotMatch(line, /animation/i, `unexpected animation in ${line.trim()}`);
  }
});

// ─── (c): five anchor rules appear exactly once each ──────────────────────

test("CSS: .mw-gear-row{, .mw-gear-card{, .mw-gear-head{, .mw-gear-use-btn{ and .mw-gear-pip{ each appear exactly once", () => {
  const block = styleBlock();
  for (const sel of [".mw-gear-row{", ".mw-gear-card{", ".mw-gear-head{", ".mw-gear-use-btn{", ".mw-gear-pip{"]) {
    const re = new RegExp("^" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m");
    const count = (block.match(new RegExp(re.source, "gm")) || []).length;
    assert.equal(count, 1, `expected exactly one ${sel} rule, found ${count}`);
  }
});

// ─── (d): the three retired Phase 43 rules and .mw-wilmst are gone ────────

test("CSS: the retired Phase 43 gear rules and .mw-wilmst are gone", () => {
  const block = styleBlock();
  for (const sel of [".mw-onyou-head{", ".mw-worn-empty{", ".mw-kit-head{", ".mw-wilmst{"]) {
    const re = new RegExp("^" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "m");
    assert.equal((block.match(new RegExp(re.source, "gm")) || []).length, 0, `expected zero ${sel} rules`);
  }
});

// ─── (e): tabDeps names drinkPotion and readScroll ─────────────────────────

test("tabDeps() names drinkPotion and readScroll, mapped to window.mzDrinkPotion?.() / window.mzReadScroll?.()", () => {
  const region = sliceBetween(CLASSIC, "function tabDeps() {", "\nfunction paint() {");
  assert.match(region, /drinkPotion: \(\) => window\.mzDrinkPotion\?\.\(\),/);
  assert.match(region, /readScroll: \(\) => window\.mzReadScroll\?\.\(\),/);
});

// ═══════════════════════ Task 2: render section ═══════════════════════════
//
// renderGearTab(host, state, deps) is exercised directly against
// createRecordingDocument() — no mazeworld.html classic-script sandbox
// needed here (that's shell-tab-snapshots.test.js's job). States are either
// the real engine-built fixtures from harness/shellSandbox.js#fixedStates
// (thief: full small bag, two worn jewels, a third bagged for the swap
// confirm; mu: every worn slot empty) or a local `{ c }` fixture
// (fixedChar, mirroring gear-view-models.test.js's own pattern) for cases
// needing exact control (cooldown timers, a bag-less character, a Pilfer).
// Assertions cross-check the rendered DOM against the SAME model function
// renderGearTab reads, rather than restating game-rule literals — this
// proves the wiring, while Plan 01's gear-view-models.test.js already
// proves the model's own rules.

const GEAR_IDS = SNAPSHOT_IDS.gear;
const states = fixedStates();

function spy() {
  const fn = (...args) => fn.calls.push(args);
  fn.calls = [];
  return fn;
}

function gearDeps() {
  return {
    useItem: spy(),
    unequip: spy(),
    equipItem: spy(),
    dropItem: spy(),
    drinkPotion: spy(),
    readScroll: spy(),
  };
}

function renderFresh(state, deps = gearDeps()) {
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-gear");
  renderGearTab(host, state, deps);
  return { doc, deps };
}

function walkAllNodes(doc, ids) {
  const out = [];
  const visit = (node) => {
    out.push(node);
    for (const child of node.children || []) visit(child);
  };
  for (const id of ids) visit(doc.document.getElementById(id));
  return out;
}

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

// A rich, hand-built state: two worn jewels (both jewelry keys occupied —
// exercises the multi-choice swap confirm on a bagged third jewel), a
// bag-only tool (Rope, no tag/USE), a bag-only staff (Rowan Staff — fresh,
// so its USE cell reads READY), a bagged jewel (both keys worn, so its
// card gets the "· SWAP" tag), and two same-named buff potions (the
// CONSUMABLES buff-group row). Bag: "small" (4 slots) with 3 slot-consuming
// items (rope/staff/jewel — potions are slot-exempt) — one under cap.
const ROPE_ITEM = toolItem("rope");
const STAFF_ITEM = { kind: "staff", n: "Rowan Staff", txt: "a protective dome of 100 hp" };
const BAGGED_JEWEL = { kind: "jewelry", n: "Amulet of Light", txt: "used, it lights fifty squares and tells the dark to leave at once; then it sulks for fifty" };
const BUFF_A = { kind: "potion", n: "Potion of Fire Breath", txt: "breathes fire, once", eff2: "fireBreath" };
const BUFF_B = { kind: "potion", n: "Potion of Fire Breath", txt: "breathes fire, once", eff2: "fireBreath" };

function richChar(overrides = {}) {
  return fixedChar({
    bag: "small",
    worn: {
      cloak: null,
      jewelry1: { kind: "jewelry", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet" },
      jewelry2: { kind: "jewelry", n: "Gauntlet of the Giant", txt: "used, you are one size larger for fifty squares; mind the ceilings, then fifty squares of shrinking back" },
    },
    items: [ROPE_ITEM, STAFF_ITEM, BAGGED_JEWEL, BUFF_A, BUFF_B],
    potions: 2,
    wp: 4,
    maxWP: 10,
    scrolls: 0,
    ...overrides,
  });
}

// ─── header ─────────────────────────────────────────────────────────────

test("header: #gear-stats holds two .mw-gear-stat children matching gearHeaderModel", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const model = gearHeaderModel(state);
  const stats = doc.document.getElementById("gear-stats");
  assert.equal(stats.children.length, 2);
  stats.children.forEach((stat, i) => {
    const num = stat.children.find((n) => n.tagName === "b");
    const label = stat.children.find((n) => n.tagName === "span");
    assert.equal(num.className, "mw-gear-stat-num");
    assert.equal(num.textContent, model.stats[i].text);
    assert.equal(label.className, "mw-gear-stat-label");
    assert.equal(label.textContent, model.stats[i].label);
  });
});

// ─── WORN ───────────────────────────────────────────────────────────────

test("WORN: #gear-worn-head reads WORN plus the count; #gear-worn holds exactly 5 rows in GEAR_WORN_ORDER order", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const headTitle = doc.document.getElementById("gear-worn-head").children.find((n) => n.className === "mw-gear-head-title");
  assert.equal(headTitle.textContent, GEAR_COPY.worn);
  const wornEl = doc.document.getElementById("gear-worn");
  assert.equal(wornEl.children.length, 5);
  assert.deepStrictEqual(wornEl.children.map((li) => li.dataset.slot), GEAR_WORN_ORDER);
});

test("WORN: the mu fixture (a fresh Magic User) renders its unequipped cloak/jewelry1/jewelry2 rows empty in-voice, and every row (filled or not) carries an aria-hidden chevron", () => {
  const { doc } = renderFresh(states.mu);
  const wornEl = doc.document.getElementById("gear-worn");
  for (const li of wornEl.children) {
    const chev = li.children.find((n) => n.className === "mw-gear-chev");
    assert.ok(chev, "expected a chevron on every row");
    assert.equal(chev.getAttribute("aria-hidden"), "true");
  }
  // A fresh Magic User starts with a Quarter Staff/Cloth (weapon/armor
  // filled by chargen) — only cloak/jewelry1/jewelry2 are unequipped.
  for (const slot of ["cloak", "jewelry1", "jewelry2"]) {
    const li = wornEl.children.find((row) => row.dataset.slot === slot);
    assert.match(li.className, /\bmw-gear-row-empty\b/);
    const main = li.children.find((n) => n.className === "mw-gear-main");
    const note = main.children.find((n) => n.className === "mw-gear-note");
    assert.equal(note.textContent, GEAR_COPY.empty[slot]);
  }
});

test("Edge GSCR-03/ordering: a filled WORN row orders slot, main, value, USE, chevron, then actions", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const wornEl = doc.document.getElementById("gear-worn");
  const jewelry1 = wornEl.children.find((li) => li.dataset.slot === "jewelry1");
  const classes = jewelry1.children.map((c) => c.className);
  assert.deepStrictEqual(classes, ["mw-gear-slot", "mw-gear-main", "mw-gear-val", "mw-gear-use", "mw-gear-chev", "mw-gear-actions"]);
});

test("WORN USE cell: a worn jewel with a cooling record renders COOLING/12 SQ, and its click dispatches useItem({ slot })", () => {
  const state = { c: richChar({ timers: { [itemTimerId({ n: "Ring of Power" })]: { left: 12 } } }) };
  const { doc, deps } = renderFresh(state);
  const wornEl = doc.document.getElementById("gear-worn");
  const jewelry1 = wornEl.children.find((li) => li.dataset.slot === "jewelry1");
  const useCell = jewelry1.children.find((n) => n.className === "mw-gear-use");
  assert.equal(useCell.dataset.phase, "cooldown");
  const btn = useCell.children.find((n) => n.tagName === "button");
  assert.equal(btn.textContent, GEAR_COPY.use.cooling);
  const sub = useCell.children.find((n) => n.className === "mw-gear-use-sub");
  assert.equal(sub.textContent, "12 SQ");
  btn.onclick();
  assert.deepStrictEqual(deps.useItem.calls, [[{ slot: "jewelry1" }]]);
});

test("WORN unequip: enabled on a non-full bag, dispatches unequip(slot); disabled 'Bag full' on a full bag", () => {
  // Non-full: richChar (3/4 slots).
  {
    const state = { c: richChar() };
    const { doc, deps } = renderFresh(state);
    const jewelry1 = doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === "jewelry1");
    const actions = jewelry1.children.find((n) => n.className === "mw-gear-actions");
    const btn = actions.children[0];
    assert.equal(btn.textContent, GEAR_COPY.act.unequip);
    assert.equal(btn.disabled, false);
    btn.onclick();
    assert.deepStrictEqual(deps.unequip.calls, [["jewelry1"]]);
  }
  // Full bag: the thief fixture.
  {
    const { doc } = renderFresh(states.thief);
    const jewelry1 = doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === "jewelry1");
    const actions = jewelry1.children.find((n) => n.className === "mw-gear-actions");
    const btn = actions.children[0];
    assert.equal(btn.textContent, GEAR_COPY.act.bagFull);
    assert.equal(btn.disabled, true);
  }
});

// ─── BAG meter ──────────────────────────────────────────────────────────

test("BAG meter: a full bag (thief fixture) shows the red count/pips, the BAG FULL line and the free-ride note", () => {
  const { doc } = renderFresh(states.thief);
  const model = gearBagMeterModel(states.thief);
  assert.equal(model.full, true);
  const headCount = doc.document.getElementById("gear-bag-head").children.find((n) => n.tagName === "b");
  assert.equal(headCount.textContent, model.countText);
  assert.match(headCount.className, /\bmw-gear-full\b/);
  const meter = doc.document.getElementById("gear-bag-meter");
  const pips = meter.children.find((n) => n.tagName === "div");
  assert.equal(pips.children.length, model.pips.length);
  assert.ok(pips.children.every((p) => /\bmw-gear-pip-on\b/.test(p.className)));
  assert.match(pips.className, /\bmw-gear-full\b/);
  const fullLine = meter.children.find((n) => n.className === "mw-gear-full-line");
  assert.equal(fullLine.textContent, GEAR_COPY.bagFull);
  const freeLine = meter.children.find((n) => n.className === "mw-gear-free");
  assert.equal(freeLine.textContent, GEAR_COPY.freeRide);
});

test("BAG meter: one under cap (richChar) shows no BAG FULL line and no mw-gear-full class", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const model = gearBagMeterModel(state);
  assert.equal(model.full, false);
  const meter = doc.document.getElementById("gear-bag-meter");
  assert.ok(!meter.children.some((n) => n.className === "mw-gear-full-line"));
  const headCount = doc.document.getElementById("gear-bag-head").children.find((n) => n.tagName === "b");
  assert.doesNotMatch(headCount.className, /mw-gear-full/);
});

test("BAG meter: a bag-less character shows no pips and no free-ride note", () => {
  const state = { c: richChar({ bag: undefined }) };
  const { doc } = renderFresh(state);
  const model = gearBagMeterModel(state);
  assert.equal(model.slots, null);
  const meter = doc.document.getElementById("gear-bag-meter");
  assert.ok(!meter.children.some((n) => n.tagName === "div"), "no pips container for a bag-less character");
  assert.ok(!meter.children.some((n) => n.className === "mw-gear-free"));
});

// ─── BAG cards ──────────────────────────────────────────────────────────

test("BAG cards: one li.mw-gear-card per gearBagCardsModel entry, data-i the true c.items index", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const model = gearBagCardsModel(state);
  const bagEl = doc.document.getElementById("gear-bag");
  assert.equal(bagEl.children.length, model.length);
  bagEl.children.forEach((li, idx) => {
    assert.equal(li.className, "mw-gear-card");
    assert.equal(li.dataset.i, String(model[idx].i));
  });
});

test("BAG cards: a jewel with both keys worn gets 'JEWELRY · SWAP' (tag-swap); the rope card carries no tag", () => {
  const state = { c: richChar() };
  const { doc } = renderFresh(state);
  const bagEl = doc.document.getElementById("gear-bag");
  const jewelCard = bagEl.children.find((li) => li.dataset.i === String(state.c.items.indexOf(BAGGED_JEWEL)));
  const top = jewelCard.children.find((n) => n.className === "mw-gear-card-main").children.find((n) => n.className === "mw-gear-card-top");
  const tag = top.children.find((n) => n.className.includes("mw-gear-tag"));
  assert.equal(tag.textContent, "JEWELRY" + GEAR_COPY.swap);
  assert.match(tag.className, /\bmw-gear-tag-swap\b/);

  const ropeCard = bagEl.children.find((li) => li.dataset.i === String(state.c.items.indexOf(ROPE_ITEM)));
  const ropeTop = ropeCard.children.find((n) => n.className === "mw-gear-card-main").children.find((n) => n.className === "mw-gear-card-top");
  assert.ok(!ropeTop.children.some((n) => n.className.includes("mw-gear-tag")), "expected no .mw-gear-tag on the rope card");
});

test("BAG cards: a bag-only staff carries a USE cell (READY, dispatches useItem(index)); a bagged jewel carries none", () => {
  const state = { c: richChar() };
  const { doc, deps } = renderFresh(state);
  const bagEl = doc.document.getElementById("gear-bag");
  const staffI = state.c.items.indexOf(STAFF_ITEM);
  const staffCard = bagEl.children.find((li) => li.dataset.i === String(staffI));
  const useCell = staffCard.children.find((n) => n.className === "mw-gear-use");
  assert.ok(useCell, "expected a USE cell on the bag-only staff card");
  const btn = useCell.children.find((n) => n.tagName === "button");
  assert.equal(btn.textContent, GEAR_COPY.use.use);
  btn.onclick();
  assert.deepStrictEqual(deps.useItem.calls, [[staffI]]);

  const jewelI = state.c.items.indexOf(BAGGED_JEWEL);
  const jewelCard = bagEl.children.find((li) => li.dataset.i === String(jewelI));
  assert.ok(!jewelCard.children.some((n) => n.className === "mw-gear-use"), "expected no USE cell on a bagged, worn-slot-family jewel");
});

test("BAG cards: harvested Drop confirm ('Drop it?') and the multi-choice swap confirm ('Swap for which?')", () => {
  const state = { c: richChar() };
  const { doc, deps } = renderFresh(state);
  const bagEl = doc.document.getElementById("gear-bag");
  const ropeCard = bagEl.children.find((li) => li.dataset.i === String(state.c.items.indexOf(ROPE_ITEM)));
  const dropBtn = ropeCard.querySelector(".mw-gear-drop");
  assert.ok(dropBtn, "expected the rope card's harvested Drop button");
  dropBtn.onclick();
  assert.ok(ropeCard.querySelector(".mw-drop-confirm").textContent.includes("Drop it?") || ropeCard.textContent.includes("Drop it?"));

  const jewelI = state.c.items.indexOf(BAGGED_JEWEL);
  const jewelCard = bagEl.children.find((li) => li.dataset.i === String(jewelI));
  const equipBtn = jewelCard.querySelector(".mw-gear-actions button");
  // Find the actual Equip button (the harvested actions row's first button
  // when no swap is armed yet is Equip, since neither Drop nor Use precede
  // it in this card's action set — actions: ["equip", "drop"]).
  const actionsRow = jewelCard.children.find((n) => n.className === "mw-gear-actions");
  const equip = actionsRow.children.find((b) => b.textContent === "Equip");
  assert.ok(equip, "expected the bagged jewel's Equip button");
  equip.onclick();
  assert.ok(jewelCard.textContent.includes("Swap for which?"));
});

test("BAG empty state: #gear-bag renders NOTHING LEFT TO CARRY when the bag is empty", () => {
  const state = { c: fixedChar({ bag: "small", items: [], worn: {} }) };
  const { doc } = renderFresh(state);
  const bagEl = doc.document.getElementById("gear-bag");
  assert.equal(bagEl.children.length, 1);
  const empty = bagEl.children[0];
  assert.equal(empty.className, "mw-empty");
  const head = empty.children.find((n) => n.className === "mw-empty-head");
  const body = empty.children.find((n) => n.className === "mw-empty-body");
  assert.equal(head.textContent, GEAR_COPY.bagEmptyHead);
  assert.equal(body.textContent, GEAR_COPY.bagEmptyBody);
});

// ─── CONSUMABLES ────────────────────────────────────────────────────────

test("CONSUMABLES: a ×0 heal is disabled with mw-gear-qty-zero; an enabled heal click dispatches drinkPotion()", () => {
  // ×0 heal, disabled.
  {
    const state = { c: fixedChar({ potions: 0, wp: 5, maxWP: 10 }) };
    const { doc } = renderFresh(state);
    const consEl = doc.document.getElementById("gear-cons");
    const healLi = consEl.children.find((li) => li.dataset.key === "heal");
    const top = healLi.children.find((n) => n.className === "mw-gear-card-main").children.find((n) => n.className === "mw-gear-card-top");
    const qty = top.children.find((n) => n.className.includes("mw-gear-qty"));
    assert.match(qty.className, /\bmw-gear-qty-zero\b/);
    const btn = healLi.children.find((n) => n.tagName === "button");
    assert.equal(btn.disabled, true);
  }
  // Enabled heal.
  {
    const state = { c: richChar() };
    const { doc, deps } = renderFresh(state);
    const healLi = doc.document.getElementById("gear-cons").children.find((li) => li.dataset.key === "heal");
    const btn = healLi.children.find((n) => n.tagName === "button");
    assert.equal(btn.disabled, false);
    btn.onclick();
    assert.deepStrictEqual(deps.drinkPotion.calls, [[]]);
  }
});

test("CONSUMABLES: a buff-potion group click dispatches useItem(firstIndex)", () => {
  const state = { c: richChar() };
  const { doc, deps } = renderFresh(state);
  const consEl = doc.document.getElementById("gear-cons");
  const buffLi = consEl.children.find((li) => li.dataset.key === `potion:${BUFF_A.n}`);
  assert.ok(buffLi, "expected a buff-potion group row");
  const btn = buffLi.children.find((n) => n.tagName === "button");
  btn.onclick();
  assert.deepStrictEqual(deps.useItem.calls, [[state.c.items.indexOf(BUFF_A)]]);
});

test("CONSUMABLES: a Magic User's scroll READ dispatches readScroll(); a Pilfer's READ is disabled with the engine's refusal line", () => {
  // Magic User — enabled READ.
  {
    const state = { c: fixedChar({ cls: "Magic User", scrolls: 2 }) };
    const { doc, deps } = renderFresh(state);
    const scrollLi = doc.document.getElementById("gear-cons").children.find((li) => li.dataset.key === "scroll");
    const btn = scrollLi.children.find((n) => n.tagName === "button");
    assert.equal(btn.textContent, GEAR_COPY.use.read);
    assert.equal(btn.disabled, false);
    btn.onclick();
    assert.deepStrictEqual(deps.readScroll.calls, [[]]);
  }
  // Pilfer — disabled READ with the engine's own reason line.
  {
    const state = { c: fixedChar({ cls: "Thief", sub: "Pilfer", scrolls: 3 }) };
    const { doc } = renderFresh(state);
    const scrollLi = doc.document.getElementById("gear-cons").children.find((li) => li.dataset.key === "scroll");
    const btn = scrollLi.children.find((n) => n.tagName === "button");
    assert.equal(btn.disabled, true);
    const reasonEl = scrollLi.children.find((n) => n.className === "mw-gear-card-main").children.find((n) => n.className === "mw-gear-cons-tag");
    assert.equal(reasonEl.textContent, LINE_FOR.scrollRefused({ reason: "pilfer" }).text);
  }
});

// ─── ALSO ON YOU ────────────────────────────────────────────────────────

test("ALSO ON YOU: #gear-kit-head reads ALSO ON YOU; #gear-kit renders one li per gearKitRows row (label text node, value span)", () => {
  const state = { c: richChar({ might: 5 }) };
  const { doc } = renderFresh(state);
  const headTitle = doc.document.getElementById("gear-kit-head").children.find((n) => n.className === "mw-gear-head-title");
  assert.equal(headTitle.textContent, GEAR_COPY.alsoOnYou);
  const rows = gearKitRows(state);
  const kitEl = doc.document.getElementById("gear-kit");
  assert.equal(kitEl.children.length, rows.length);
  kitEl.children.forEach((li, idx) => {
    const textNode = li.children.find((n) => n.nodeType === 3);
    const span = li.children.find((n) => n.nodeType === 1 && n.tagName === "span");
    assert.equal(textNode.textContent, rows[idx].label);
    assert.equal(span.textContent, rows[idx].value);
  });
});

// ─── encoding (Edge GSCR-02/GSCR-05) ───────────────────────────────────

const TRICKY_NAME = `Thief's "Lucky" <b>Ring</b> \u{1F3B2}`;

test("Edge GSCR-02/encoding: a worn jewel named with an apostrophe, quotes, markup and an emoji renders verbatim via textContent", () => {
  const state = { c: richChar({ worn: { cloak: null, jewelry1: { kind: "jewelry", n: TRICKY_NAME, txt: "a strange ring" }, jewelry2: null } }) };
  const { doc } = renderFresh(state);
  const jewelry1 = doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === "jewelry1");
  const name = jewelry1.children.find((n) => n.className === "mw-gear-main").children.find((n) => n.className === "mw-gear-name");
  assert.equal(name.textContent, TRICKY_NAME);
});

test("Edge GSCR-05/encoding: a bagged item named the same way renders verbatim via textContent", () => {
  const state = { c: richChar({ items: [{ kind: "tool", n: TRICKY_NAME, txt: "a strange thing" }] }) };
  const { doc } = renderFresh(state);
  const bagEl = doc.document.getElementById("gear-bag");
  const card = bagEl.children[0];
  const name = card.children.find((n) => n.className === "mw-gear-card-main").children.find((n) => n.className === "mw-gear-card-top").children.find((n) => n.className === "mw-gear-name");
  assert.equal(name.textContent, TRICKY_NAME);
});

test("Edge GSCR-02/GSCR-05/encoding: no node under the ten gear ids carries an HTML-string write, and renderGearTab's region has zero HTML-string assignments", () => {
  const state = { c: richChar({ worn: { cloak: null, jewelry1: { kind: "jewelry", n: TRICKY_NAME, txt: "a strange ring" }, jewelry2: null } }) };
  const { doc } = renderFresh(state);
  const nodes = walkAllNodes(doc, GEAR_IDS);
  for (const node of nodes) {
    if (node.nodeType === 3) continue;
    assert.notEqual(node._content.kind, "html", `unexpected innerHTML write on a ${node.tagName} under #${GEAR_IDS.join("/#")}`);
  }
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n");
  const stripped = stripJs(src);
  const region = stripped.slice(stripped.indexOf("export function renderGearTab("));
  assert.doesNotMatch(region, /\.innerHTML\s*=/);
});

// ─── idempotency / no-WP ────────────────────────────────────────────────

test("idempotency: rendering renderGearTab twice on the same host serializes byte-identically", () => {
  const state = { c: richChar() };
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-gear");
  const deps = gearDeps();
  renderGearTab(host, state, deps);
  const first = doc.serializeElements(GEAR_IDS);
  renderGearTab(host, state, deps);
  const second = doc.serializeElements(GEAR_IDS);
  assert.equal(second, first);
});

test("no WP: the serialized Gear tab text carries no standalone wp/WP token", () => {
  const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;
  const { doc } = renderFresh(states.thief);
  const text = doc.serializeElements(GEAR_IDS);
  const m = text.match(PLAYER_WP);
  assert.equal(m, null, `unexpected wp/WP token: ${m && m[0]}`);
});
