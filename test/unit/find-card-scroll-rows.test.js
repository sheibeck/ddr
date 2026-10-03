// test/unit/find-card-scroll-rows.test.js
//
// Quick task 260928-fcs (user, 2026-09-27, Pixel 7): "the Something Worth
// Taking rail needs to be scrollable. And with the expanded equipment
// descriptions, the equipment is running together on that rail."
//
// Measured first (headless Edge over CDP, 412x915, the largest bag full,
// text size L): every drop row was exactly 48px tall however long its text.
// The rows are <button>s, and the app-wide `button{min-height:48px}` rule
// replaces a flex item's automatic minimum, so inside the bounded drop
// region (a column flex box, .shelf) each row shrank to 48px and its
// wrapped stat line spilled over the next row: the rows ran together, and
// the region's own scroll height only covered the squashed rows. The found
// item's lines and the drop list also shared one lines column, so on a
// short stage three scrollers nested (the rail, its lines column and the
// drop region).
//
//   (a) the real renderRail at the largest bag, full: the found item's lines
//       sit in their own bounded head (.mw-find-head), then the drop region;
//       TAKE IT NOW / LEAVE IT stay in the actions row outside both
//   (b) CSS: the drop region is a bounded, touch-scrolling region
//       (overflow-y:auto, overscroll-behavior:contain, touch-action:pan-y)
//       that gives way before the head does; the head is bounded too
//   (c) CSS: the rows never shrink, each has a divider and padding, the
//       name is the bold first line and the stat line under it is clamped
//       to two lines; token colours only
//   (d) a drag on the list is never a tap: it doesn't press a row, and it
//       doesn't dismiss or pulse the card; a clean tap still drops
//   (e) a same-card re-render keeps the list's scroll position

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { dropShelfRows } from "../../src/browser/viewModels.js";
import { bagUsage } from "../../src/browser/gearTab.js";
import { flavorOfItem } from "../../src/browser/flavorText.js";
import { BAG_ITEMS, BAG_ORDER } from "../../content/index.js";
import { newRun } from "../../engine/state.js";
import { stowItem, rollBlade, rollMailPiece, rollJewel, toolItem } from "../../engine/items.js";
import { offerFind } from "../../engine/encounters.js";
import { makeRng } from "../../engine/rng.js";
import { RAIL_COPY } from "../../src/browser/rail.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const LARGEST = BAG_ORDER[BAG_ORDER.length - 1];
const TEXT_L = "1.25"; // settings.js#textScaleForSize("L")

function fullBag(seed = 7) {
  const state = newRun(seed, [], { force: { cls: "Fighter" } });
  stowItem(state, { ...BAG_ITEMS[LARGEST] }, [], true);
  const rng = makeRng(31);
  const makers = [
    () => rollBlade(rng, 3, true),
    () => rollMailPiece(rng),
    () => rollJewel(rng),
    () => toolItem("rope"),
    () => rollBlade(rng, 5, false),
  ];
  let k = 0;
  while (bagUsage(state.c).slots - bagUsage(state.c).have > 0) {
    stowItem(state, makers[k++ % makers.length](), [], true);
    assert.ok(k < 100, "the bag fills");
  }
  assert.equal(bagUsage(state.c).full, true);
  return state;
}

function scenario() {
  const state = fullBag();
  const find = rollBlade(makeRng(5), 4, true);
  offerFind(state, find, []);
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  const w = sandbox.context.window;
  // Text size L, as the settings screen applies it.
  doc.document.documentElement?.style?.setProperty?.("--mw-text-scale", TEXT_L);
  const drops = [];
  w.mzDropItem = (i) => drops.push(i);
  sandbox.setState(state);
  // recordingDom has no <template> parser; the narration here is plain text.
  sandbox.context.htmlToPlain = (h) => String(h ?? "");
  w.__mzPendingNarration = ["You kick through a heap of bones and something glints, which is more than the last owner managed."];
  sandbox.context.renderRail();
  const get = (id) => doc.document.getElementById(id);
  const parts = () => {
    const linesEl = get("mw-rail-lines");
    return {
      linesEl,
      head: linesEl.children.find((el) => String(el.className).split(/\s+/).includes("mw-find-head")) || null,
      region: linesEl.children.find((el) => String(el.className).split(/\s+/).includes("mw-find-drop")) || null,
    };
  };
  return { state, find, doc, sandbox, w, drops, get, parts };
}

function rule(selector) {
  const re = new RegExp("(?:^|\\})\\s*" + selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}", "m");
  const m = STYLE.match(re);
  assert.ok(m, `rule not found: ${selector}`);
  return m[1];
}

// ─── (a) the card's structure ──────────────────────────────────────────────

test("(a) largest bag full, text L: the lines column holds the bounded head (narration, the found item, its comparison, the bag-full line), then the drop region, and nothing else", () => {
  const r = scenario();
  const { linesEl, head, region } = r.parts();
  assert.ok(head, "the found item's lines sit in their own .mw-find-head");
  assert.ok(region, "the drop region is rendered");
  assert.deepEqual(linesEl.children, [head, region], "head first, then the drop region");
  const texts = head.children.map((el) => el.textContent);
  assert.ok(texts[0].startsWith("You kick through"), "the narration heads the card");
  assert.ok(texts[1].startsWith(r.find.n), "then the found item's name, stats and description");
  const fullText = RAIL_COPY.find.full.replace("{have}", bagUsage(r.state.c).slots).replace("{slots}", bagUsage(r.state.c).slots);
  assert.equal(texts[texts.length - 1], fullText, "the bag-full line closes the head, right above the list it heads");
  assert.equal(region.children.length, dropShelfRows(r.state.c).length, "one row per bag item");
});

test("(a) TAKE IT NOW / LEAVE IT live in the actions row, outside the head and the scrolling list", () => {
  const r = scenario();
  const actions = r.get("mw-rail-actions");
  assert.deepEqual(actions.children.map((b) => b.textContent), [RAIL_COPY.find.takeNow, RAIL_COPY.find.leave]);
  const { head, region } = r.parts();
  for (const box of [head, region]) {
    assert.ok(!box.children.some((el) => el.id === "a-find-take" || el.id === "a-find-leave"));
  }
  // The rail's own markup: the actions row is a sibling of the lines row,
  // never inside #mw-rail-lines.
  assert.match(HTML, /<div class="mw-rail-lines" id="mw-rail-lines"><\/div>[\s\S]*?<\/div>\s*<span class="mw-rail-peek"[\s\S]*?<div class="mw-rail-actions" id="mw-rail-actions"><\/div>/);
});

test("(a) a find with room (or any other card) gets no head wrapper: its lines stay direct children of the lines column", () => {
  const state = newRun(9, [], { force: { cls: "Fighter" } });
  offerFind(state, rollBlade(makeRng(5), 4, true), []);
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false });
  sandbox.setState(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  const kids = doc.document.getElementById("mw-rail-lines").children;
  assert.ok(kids.length > 0);
  // Phase 95 (FLAVOR-02/05): declared re-pin: the found item's line now carries a RULES toggle and its body as direct children of the lines column too (no head wrapper still).
  assert.ok(kids.every((el) => /mw-rail-(line|roll)|mw-rules-(btn|body)/.test(String(el.className))), "plain lines (and the RULES toggle and body) only");
  assert.ok(!kids.some((el) => /mw-find-head/.test(String(el.className))), "no head wrapper");
});

// ─── (b) the scroll regions ───────────────────────────────────────────────

test("(b) the drop region is a bounded touch-scroll region that keeps its scroll to itself", () => {
  const region = rule(".mw-find-drop");
  assert.match(region, /max-height:min\(\d+vh, ?calc\([\d.]+rem \* var\(--mw-text-scale\)\)\)/, "bounded by the screen and the text scale");
  assert.match(region, /overflow-y:auto/);
  assert.match(region, /overscroll-behavior:contain/);
  assert.match(region, /touch-action:pan-y/);
  assert.match(region, /-webkit-overflow-scrolling:touch/);
});

test("(b) on the rail, the list gives way before the found item does, down to a floor of about two rows; the head is bounded and scrolls only past its own floor", () => {
  const drop = rule("#mw-rail .mw-rail-lines>.mw-find-drop");
  assert.match(drop, /flex:0 100 auto/, "the list gives way first; the head only once the list is at its floor");
  assert.match(drop, /min-height:calc\(8rem \* var\(--mw-text-scale\)\)/);
  const head = rule("#mw-rail .mw-rail-lines>.mw-find-head");
  assert.match(head, /flex:0 1 auto/);
  assert.match(head, /min-height:calc\(7rem \* var\(--mw-text-scale\)\)/);
  assert.match(head, /overflow-y:auto/);
  assert.match(head, /overscroll-behavior:contain/);
  assert.match(head, /touch-action:pan-y/);
  // The actions row never shrinks, so TAKE IT NOW / LEAVE IT stay put.
  assert.match(rule("#mw-rail>.mw-rail-actions"), /flex:none/);
});

// ─── (c) the rows ─────────────────────────────────────────────────────────

test("(c) rows never shrink (the 48px button floor squashed them), and each has a divider and padding", () => {
  const row = rule(".mw-find-drop>.goods");
  assert.match(row, /flex:none/, "a row keeps its full height inside the bounded region");
  assert.match(row, /border-bottom:1px solid var\(--rule\)/, "a divider under every row");
  assert.match(row, /padding:\d+px \d+px/);
  assert.match(rule(".mw-find-drop>.goods:first-child"), /border-top:1px solid var\(--rule\)/, "the first row is ruled off from the line above");
  assert.match(rule(".mw-find-drop"), /gap:0/, "the divider is the separation; no loose gap");
});

test("(c) the name is a bold first line; the stat and description line under it is clamped to two lines", () => {
  const name = rule(".mw-find-drop .g-n");
  assert.match(name, /font-weight:700/);
  assert.match(name, /overflow-wrap:anywhere/);
  assert.match(name, /min-width:0/);
  const sub = rule(".mw-find-drop .g-n i");
  assert.match(sub, /font-weight:400/);
  assert.match(sub, /display:-webkit-box/);
  assert.match(sub, /-webkit-box-orient:vertical/);
  assert.match(sub, /-webkit-line-clamp:2/);
  assert.match(sub, /overflow:hidden/);
});

test("(c) every row is still one tap target: a single <button> per item, the name and stats inside it", () => {
  const r = scenario();
  const { region } = r.parts();
  const rows = dropShelfRows(r.state.c);
  region.children.forEach((el, n) => {
    // Phase 95 (FLAVOR-02/05), Plan 07: declared re-pin: a flavoured row is a div.mw-rules-wrap whose FIRST child is the one Drop button; the name and
    // the flavour are inside that button, the stat line sits in the wrap's RULES body, and the toggle is the button's sibling, never inside it.
    const wrapped = String(el.className).split(/\s+/).includes("mw-rules-wrap");
    const btn = wrapped ? el.children[0] : el;
    assert.equal(btn.tagName, "button");
    assert.ok(btn.innerHTML.startsWith(`<span class="g-n">${rows[n].name}<i>`), `row ${n}: the name first`);
    if (wrapped) {
      assert.ok(String(btn.className).split(/\s+/).includes("goods"), `row ${n}: the first child is the Drop button`);
      assert.ok(!btn.innerHTML.includes("mw-rules-btn"), `row ${n}: the toggle is never inside the button`);
      assert.ok(btn.innerHTML.includes(flavorOfItem(rows[n].it)), `row ${n}: its flavour`);
      const body = el.children.find((x) => String(x.className).split(/\s+/).includes("mw-rules-body"));
      assert.deepEqual(body.children.map((p) => p.textContent), [rows[n].stats], `row ${n}: its stat line in the RULES body`);
    } else {
      assert.ok(btn.innerHTML.includes(rows[n].stats), `row ${n}: its stat line`);
    }
  });
});

test("(c) the new find-card rules use token colours only", () => {
  const rules = [...STYLE.matchAll(/(?:^|\})\s*([^{}]*\.mw-find-(?:drop|head)[^{}]*)\{([^}]*)\}/gm)].map((m) => m[2]).join(";");
  assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgba?\(/i, "no literal colour in the find-card rules");
});

// ─── (d) a drag is never a tap ────────────────────────────────────────────

function drag(region, dy) {
  region.onpointerdown({ clientX: 200, clientY: 600 });
  region.onpointermove({ clientX: 201, clientY: 600 - dy });
  region.scrollTop += dy;
  region.onscroll?.();
}

test("(d) a drag that scrolls the list never presses a row; a clean tap afterwards still drops", () => {
  const r = scenario();
  const { region } = r.parts();
  assert.equal(typeof region.onpointerdown, "function");
  assert.equal(typeof region.onpointermove, "function");
  assert.equal(typeof region.onscroll, "function");
  // Phase 95 (FLAVOR-02/05), Plan 07: declared re-pin: the row the test presses is the Drop button inside the row's RULES wrapper.
  const press = () => {
    const el = region.children[3];
    (String(el.className).split(/\s+/).includes("mw-rules-wrap") ? el.children[0] : el).onclick();
  };
  drag(region, 80);
  press();
  assert.deepEqual(r.drops, [], "the click a drag leaves behind is swallowed");
  // A scroll alone (the browser took the gesture, no pointermove) also counts.
  region.onpointerdown({ clientX: 200, clientY: 600 });
  region.scrollTop += 40;
  region.onscroll();
  press();
  assert.deepEqual(r.drops, []);
  // A clean tap: down and up in place.
  region.onpointerdown({ clientX: 200, clientY: 600 });
  region.onpointermove({ clientX: 203, clientY: 604 });
  press();
  assert.deepEqual(r.drops, [dropShelfRows(r.state.c)[3].i]);
});

test("(d) a tap or drag inside the list never reaches the rail's body-tap dismiss: the card stays and doesn't pulse", async () => {
  const r = scenario();
  await new Promise((res) => setTimeout(res, 320)); // past the rail's arm window
  const railEl = r.get("mw-rail");
  railEl.classList.remove("mw-rail-pulse");
  const before = r.w.__mzRail;
  const title = r.get("mw-rail-title").textContent;
  const { region } = r.parts();
  drag(region, 60);
  railEl.onclick({ target: { closest: (sel) => (sel === ".mw-find-drop" ? region : null) } });
  assert.equal(r.w.__mzRail, before, "the rail view-model is untouched");
  assert.equal(r.get("mw-rail-title").textContent, title, "the card is still up");
  assert.equal(railEl.dataset.shown, "1");
  assert.ok(!railEl.classList.contains("mw-rail-pulse"), "no pulse either");
  // A body tap outside the list still pulses the locked card, as before.
  railEl.onclick({ target: { closest: () => null } });
  assert.ok(railEl.classList.contains("mw-rail-pulse"));
});

// ─── (e) scroll survives a re-render ──────────────────────────────────────

test("(e) a same-card re-render keeps the list's and the head's scroll positions", () => {
  const r = scenario();
  const first = r.parts();
  first.region.scrollTop = 137;
  first.head.scrollTop = 22;
  r.sandbox.context.renderRail();
  const again = r.parts();
  assert.notEqual(again.region, first.region, "the list was rebuilt");
  assert.equal(again.region.scrollTop, 137);
  assert.equal(again.head.scrollTop, 22);
});
