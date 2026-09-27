// test/unit/find-card-full-bag.test.js
//
// Phase 78 (HUD-09), Plan 08, Task 3 — the full-bag find card keeps the
// found item and TAKE / LEAVE in view (the user's 2026-09-25 report: "if
// you have a larger bag, you only see what's in your bag to drop, and you
// can't scroll the rail back up to see the item you are trying to loot").
//
//   (a) viewModels.js#dropShelfRows(c): one row per dropShelfItems(c) entry,
//       in bag order, with the true c.items index, the name and the stat
//       line from itemStatLines (the one formatter), built from real engine
//       states (the largest bag, filled through stowItem)
//   (b) the real renderRail over a real full bag: the found item's lines
//       first, then the bounded drop region (one row per bag item, each a
//       name, its stat line and a Drop control on the true index), and TAKE
//       IT NOW / LEAVE IT in the actions row outside that region
//   (c) adjacency and the bag-free rule: one slot short, or a potion on a
//       full bag, is the plain TAKE IT / LEAVE IT card with no drop region
//   (d) ordering after a drop
//   (e) CSS: the region is bounded by the viewport and the text scale and
//       scrolls; the rail never grows past the stage; rows wrap
//   (f) the audit: the loot screen's drop shelf uses the same region

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { dropShelfRows, dropShelfItems, itemStatLines } from "../../src/browser/viewModels.js";
import { bagUsage } from "../../src/browser/gearTab.js";
import { BAGS, BAG_ITEMS, BAG_ORDER, POTIONS } from "../../content/index.js";
import { newRun } from "../../engine/state.js";
import { stowItem, rollBlade, rollMailPiece, rollJewel, toolItem, dropItem } from "../../engine/items.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { RAIL_COPY } from "../../src/browser/rail.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const LARGEST = BAG_ORDER[BAG_ORDER.length - 1];

/**
 * bagState({ spare, potion }) — a real run carrying the largest bag, filled
 * through stowItem with a rolled mix of weapons, armour, jewels and tools
 * until `spare` slots remain (0: exactly full). `potion` also stows a
 * bag-free special potion in c.items, which never takes a slot and never
 * appears in the drop list.
 */
function bagState({ spare = 0, potion = false, seed = 7 } = {}) {
  const state = newRun(seed, [], { force: { cls: "Fighter" } });
  const events = [];
  stowItem(state, { ...BAG_ITEMS[LARGEST] }, events, true);
  assert.equal(state.c.bag, LARGEST);
  const rng = makeRng(31);
  const makers = [
    () => rollBlade(rng, 3, true),
    () => rollMailPiece(rng),
    () => rollJewel(rng),
    () => toolItem("rope"),
    () => rollBlade(rng, 5, false),
  ];
  if (potion) {
    const p = POTIONS[0];
    stowItem(state, { kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 }, events, true);
  }
  let k = 0;
  while (bagUsage(state.c).slots - bagUsage(state.c).have > spare) {
    stowItem(state, makers[k++ % makers.length](), events, true);
    assert.ok(k < 100, "the bag fills");
  }
  return state;
}

function statText(it, c) {
  return itemStatLines(it, c)
    .map((l) => l.text)
    .join(" · ");
}

// ─── (a) the view model ─────────────────────────────────────────────────────

test("(a) dropShelfRows: one row per bag-slot item, in bag order, with the true index, the name and the itemStatLines stat line", () => {
  const state = bagState({ potion: true });
  const c = state.c;
  assert.equal(bagUsage(c).full, true);
  const rows = dropShelfRows(c);
  const entries = dropShelfItems(c);
  assert.equal(rows.length, BAGS[LARGEST].slots);
  assert.equal(rows.length, entries.length);
  rows.forEach((row, n) => {
    assert.equal(row.i, entries[n].i);
    assert.equal(row.it, c.items[row.i]);
    assert.equal(row.name, c.items[row.i].n);
    assert.equal(row.stats, statText(c.items[row.i], c));
  });
  const idx = rows.map((r) => r.i);
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b), "bag order");
  assert.ok(!rows.some((r) => r.it.kind === "potion"), "a bag-free potion is never a drop row");
  assert.ok(rows.some((r) => r.it.kind === "weapon" && r.stats.length), "a weapon row carries its stat line");
  assert.ok(rows.some((r) => r.it.kind === "armor" && r.stats.length), "an armour row carries its stat line");
});

test("(a) dropShelfRows: an empty bag and a missing hero give [], a one-item bag gives exactly one row; c is never mutated", () => {
  assert.deepEqual(dropShelfRows(null), []);
  assert.deepEqual(dropShelfRows({}), []);
  const state = newRun(9, [], { force: { cls: "Fighter" } });
  state.c.items = [];
  assert.deepEqual(dropShelfRows(state.c), []);
  stowItem(state, toolItem("rope"), [], true);
  const before = JSON.stringify(state.c);
  const rows = dropShelfRows(state.c);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].i, 0);
  assert.equal(JSON.stringify(state.c), before);
});

// ─── (b)..(d) the real find card ────────────────────────────────────────────

function findScenario(state, find) {
  offerFind(state, find, []);
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  const drops = [];
  sandbox.context.window.mzDropItem = (i) => drops.push(i);
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  const linesEl = doc.document.getElementById("mw-rail-lines");
  const actionsEl = doc.document.getElementById("mw-rail-actions");
  const region = linesEl.children.find((el) => String(el.className).includes("mw-find-drop")) || null;
  return { doc, sandbox, linesEl, actionsEl, region, drops };
}

function actionLabels(actionsEl) {
  return actionsEl.children.map((b) => b.textContent);
}

test("(b) the largest bag full, a weapon found: item lines first, then the bounded drop region, then TAKE IT NOW / LEAVE IT outside it", () => {
  const state = bagState();
  const find = rollBlade(makeRng(5), 4, true);
  const r = findScenario(state, find);
  const kids = r.linesEl.children;
  assert.ok(r.region, "the drop region is rendered");
  assert.equal(kids.indexOf(r.region), kids.length - 1, "the drop region comes after every line");
  assert.ok(String(kids[0].textContent).startsWith(find.n), "the found item's name is the first line");
  const fullText = RAIL_COPY.find.full.replace("{have}", BAGS[LARGEST].slots).replace("{slots}", BAGS[LARGEST].slots);
  assert.ok(kids.some((el) => el.textContent === fullText), "the bag-full line heads the region");
  assert.ok(kids.findIndex((el) => el.textContent === fullText) < kids.indexOf(r.region));

  const rows = dropShelfRows(state.c);
  assert.equal(r.region.children.length, rows.length);
  r.region.children.forEach((rowEl, n) => {
    assert.ok(rowEl.innerHTML.includes(rows[n].name), `row ${n} names ${rows[n].name}`);
    assert.ok(rowEl.innerHTML.includes(rows[n].stats), `row ${n} carries its stat line`);
    rowEl.onclick();
  });
  assert.deepEqual(r.drops, rows.map((row) => row.i), "each row drops its own item by its true index");

  assert.deepEqual(actionLabels(r.actionsEl), [RAIL_COPY.find.takeNow, RAIL_COPY.find.leave]);
  assert.ok(!r.region.children.some((el) => el.id === "a-find-take" || el.id === "a-find-leave"), "TAKE / LEAVE are never inside the region");
});

test("(c) one slot short of full: the plain TAKE IT / LEAVE IT card, no drop region", () => {
  const state = bagState({ spare: 1 });
  const r = findScenario(state, rollBlade(makeRng(5), 4, true));
  assert.equal(r.region, null);
  assert.deepEqual(actionLabels(r.actionsEl), [RAIL_COPY.find.take, RAIL_COPY.find.leave]);
});

test("(c) a potion found on a full bag: the plain card, no drop region (quick 260918-vvt)", () => {
  const state = bagState();
  const p = POTIONS[0];
  const r = findScenario(state, { kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 });
  assert.equal(r.region, null);
  assert.deepEqual(actionLabels(r.actionsEl), [RAIL_COPY.find.take, RAIL_COPY.find.leave]);
});

test("(d) after a drop the card re-renders with the found item still first and the remaining rows in bag order", () => {
  const state = bagState();
  const find = rollMailPiece(makeRng(8));
  offerFind(state, find, []);
  const before = dropShelfRows(state.c).map((r) => r.name);
  dropItem(state, dropShelfRows(state.c)[2].i, []);
  // Room again, so the card would be plain; a new rope fills the slot back
  // and the drop list returns in the new bag order (the rope last).
  const rope = toolItem("rope");
  stowItem(state, rope, [], true);
  const after = dropShelfRows(state.c);
  assert.deepEqual(after.map((r) => r.name), [...before.slice(0, 2), ...before.slice(3), rope.n]);
  const r = findScenario(state, find);
  assert.ok(String(r.linesEl.children[0].textContent).startsWith(find.n), "the found item is still first");
  assert.equal(r.region.children.length, after.length);
  r.region.children.forEach((el, n) => assert.ok(el.innerHTML.includes(after[n].name), `row ${n} is ${after[n].name}`));
});

// ─── (e) CSS ────────────────────────────────────────────────────────────────

function rule(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}");
  const m = STYLE.match(re);
  assert.ok(m, `rule not found: ${selector}`);
  return m[1];
}

test("(e) the drop region is bounded by the viewport and the text scale, scrolls inside the card, and keeps the scroll to itself", () => {
  const region = rule(".mw-find-drop");
  assert.match(region, /max-height:min\(\d+vh, ?calc\([\d.]+rem \* var\(--mw-text-scale\)\)\)/);
  assert.match(region, /overflow-y:auto/);
  assert.match(region, /overscroll-behavior:contain/);
});

test("(e) the map-side rail never grows past the stage; rows wrap (no nowrap or ellipsis on a row's name or stats)", () => {
  assert.match(rule("#mw-rail"), /max-height:100%/);
  assert.match(rule("#mw-rail"), /overflow-y:auto/);
  const names = rule(".mw-find-drop .g-n");
  assert.match(names, /overflow-wrap:anywhere/);
  assert.match(names, /min-width:0/);
  const all = [...STYLE.matchAll(/\.mw-find-drop[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join(";");
  assert.doesNotMatch(all, /white-space:nowrap|text-overflow:ellipsis/);
});

// ─── (f) the audit ──────────────────────────────────────────────────────────

test("(f) the loot screen's bag-full drop shelf uses the same bounded region and the same rows", () => {
  assert.match(CODE, /<div class="shelf mw-find-drop" id="loot-drop-shelf"><\/div>/);
  assert.match(CODE, /window\.__mzDropShelfItems = dropShelfRows;/);
  const shelf = CODE.slice(CODE.indexOf("function renderDropShelf("), CODE.indexOf("\nfunction ", CODE.indexOf("function renderDropShelf(") + 1));
  assert.match(shelf, /stats/);
});
