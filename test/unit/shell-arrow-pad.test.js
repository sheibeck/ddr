// test/unit/shell-arrow-pad.test.js
//
// Phase 78 (HUD-08), Plan 07 — the opt-in arrow pad's shell wiring in
// mazeworld.html (source pins plus small node:vm sandboxes over the real
// shipped code):
//   (a) the Settings rows: Movement (TAP TO MOVE / ARROWS) and Pad (BOTTOM
//       LEFT / BOTTOM RIGHT), the Pad row shown only for ARROWS
//   (b) the pad markup: a sibling of #mw-maze-viewport (never inside it),
//       four `data-step` buttons labelled from ARROW_PAD_COPY, sized with
//       the S/M/L scale, z-ordered under the rail
//   (c) syncArrowPad: hidden while dead / in an encounter / under a sheet /
//       in tap mode, the side from padSide, the keep-in-view call when the
//       pad's place changes, and (quick task 260927-s7b, replacing the Phase
//       78 rail lift) hidden in place while a rail card is shown, through the
//       REAL renderRail's every dismissal path and a relaunch
//   (d) presses: each click is ONE window.move(dir), the one choke point;
//       two quick presses are two calls in order; a press during a pending
//       rail decision pulses the card and never steps
//   (e) tapStep: no step and no rail line in arrow mode, a step in tap mode;
//       keyboard arrows still move in both modes
//   (f) keepPartyInView: in arrow mode with the pad shown it reads the pad's
//       rect as an edge through keepInViewRect; in tap mode it never does

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { ARROW_PAD_COPY, ARROW_PAD_DIRS, arrowPadModel } from "../../src/browser/arrowPad.js";
import { screenToCell, keepInViewAxis, keepInViewRect } from "../../src/browser/controls.js";
import { resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS } from "../../src/browser/tapStep.js";
import { RAIL_COPY, RAIL_HOLD, railPush, railLineCard, emptyRail, holdForCard } from "../../src/browser/rail.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { newRun } from "../../engine/state.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);
const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, "");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}
const count = (source, literal) => source.split(literal).length - 1;

// ─── (a) the Settings rows ──────────────────────────────────────────────────

test("(a) Settings: one Movement row (tap / arrows) and one Pad row (left / right), the Pad row starting hidden", () => {
  assert.equal(count(HTML, 'data-setting="movement"'), 1);
  assert.equal(count(HTML, 'data-setting="padSide"'), 1);
  const movement = sliceBetween(MARKUP, 'data-setting="movement"', "</div>");
  assert.match(movement, /data-value="tap">Tap to move</);
  assert.match(movement, /data-value="arrows">Arrows</);
  const pad = sliceBetween(MARKUP, 'id="mw-pad-side-row"', "</div>\n      </div>");
  assert.match(pad, /^id="mw-pad-side-row" hidden>/);
  assert.match(pad, /data-setting="padSide"/);
  assert.match(pad, /data-value="left">Bottom left</);
  assert.match(pad, /data-value="right">Bottom right</);
});

test("(a) renderSettingsSheet shows the Pad row only while Movement is ARROWS; a Movement/Pad write re-syncs the pad and keeps the party in view", () => {
  const render = sliceBetween(CODE, "function renderSettingsSheet()", "function openSettingsSheet()");
  assert.match(render, /const padRow = document\.getElementById\("mw-pad-side-row"\);/);
  assert.match(render, /if \(padRow\) padRow\.hidden = currentSettings\.movement !== "arrows";/);
  const handler = sliceBetween(CODE, 'document.getElementById("mw-settings-rows")?.addEventListener("click"', "function volSliderValue(");
  assert.match(handler, /if \(key === "movement" \|\| key === "padSide"\) \{\s*syncArrowPad\(\);\s*window\.mzKeepPartyInView\?\.\(\);\s*\}/);
  // applySettings re-syncs the pad on every apply (boot and every write), so
  // a switch takes effect at once, with no reload.
  const apply = sliceBetween(CODE, "function applySettings(settings) {", "let arrowPadKey");
  assert.match(apply, /syncArrowPad\(\);\s*\}/);
});

// ─── (b) the pad markup and CSS ─────────────────────────────────────────────

test("(b) the pad is a sibling of #mw-maze-viewport inside .mazebox, never inside the viewport (a press never reaches the pan/tap pipeline)", () => {
  assert.equal(count(MARKUP, 'id="mw-arrow-pad"'), 1);
  const between = sliceBetween(MARKUP, '<div class="mw-maze-viewport" id="mw-maze-viewport">', '<div class="mw-arrow-pad"');
  const opens = (between.match(/<div\b/g) || []).length;
  const closes = (between.match(/<\/div>/g) || []).length;
  assert.equal(opens, closes, "the viewport (and everything in it) is closed before the pad opens");
  // ... and the pad sits before the encounter overlay, inside .mazebox.
  const mazebox = sliceBetween(MARKUP, '<div class="mazebox">', '<section class="mw-overlay" id="enc-panel"');
  assert.ok(mazebox.includes('id="mw-arrow-pad"'));
});

test("(b) the pad: role=group named from ARROW_PAD_COPY, starts hidden, four data-step buttons N/E/S/W with their TalkBack labels", () => {
  const pad = sliceBetween(MARKUP, '<div class="mw-arrow-pad"', "</div>");
  assert.match(pad, new RegExp(`role="group" aria-label="${ARROW_PAD_COPY.pad}"`));
  assert.match(pad, /data-side="right" hidden>/);
  const buttons = [...pad.matchAll(/<button type="button" class="mw-arrow-btn" data-step="([NESW])" aria-label="([^"]+)">/g)];
  assert.deepEqual(
    buttons.map((m) => [m[1], m[2]]),
    ARROW_PAD_DIRS.map((d) => [d.dir, ARROW_PAD_COPY[d.dir]]),
  );
  // Each glyph is decorative (the label speaks).
  assert.equal((pad.match(/<span aria-hidden="true">/g) || []).length, 4);
});

test("(b) CSS: each button is max(48px, 3.25rem x the text scale) — 48px at S, 52px at M, 65px at L — and the glyph scales too", () => {
  const padRule = STYLE.match(/\.mw-arrow-pad\{([^}]*)\}/);
  assert.ok(padRule, ".mw-arrow-pad rule found");
  const m = padRule[1].match(/--mw-pad-btn:max\(48px, calc\(([\d.]+)rem \* var\(--mw-text-scale\)\)\)/);
  assert.ok(m, "the button size follows the S/M/L scale with a 48px floor");
  const rem = Number(m[1]);
  const size = (scale) => Math.max(48, rem * 16 * scale);
  const [s, mid, l] = [0.85, 1, 1.25].map(size);
  assert.ok(s >= 48, `S is at least 48px (${s})`);
  assert.ok(mid > s && l > mid, `the pad grows S ${s} < M ${mid} < L ${l}`);
  assert.deepEqual([s, mid, l], [48, 52, 65]);
  const btn = STYLE.match(/\.mw-arrow-btn\{([^}]*)\}/);
  assert.ok(btn);
  assert.match(btn[1], /width:var\(--mw-pad-btn\);height:var\(--mw-pad-btn\);min-width:48px;min-height:48px/);
  assert.match(btn[1], /font-size:calc\([\d.]+rem \* var\(--mw-text-scale\)\)/);
  assert.match(btn[1], /pointer-events:auto/);
  assert.match(padRule[1], /pointer-events:none/, "the container passes the map through its empty corners");
  assert.match(STYLE, /\.mw-arrow-pad\[hidden\]\{display:none\}/);
});

// Quick task 260927-s7b (user, 2026-09-27, Pixel 7): "when the rails show up
// on bottom it pushes the buttons up. Instead, hide the buttons while the
// bottom rails are visible. Once they are dismissed, the buttons should show
// again." Re-pinned from the Phase 78 lift (bottom:calc(12px +
// var(--mw-pad-lift, 0px))): the pad now stays at a fixed 12px, never moves,
// and a shown rail card hides it in place instead.
test("(b) CSS: the pad sits in the chosen bottom corner clear of the safe area, above the canvas and under the rail, at a fixed bottom (no lift: it never moves)", () => {
  const padRule = STYLE.match(/\.mw-arrow-pad\{([^}]*)\}/)[1];
  assert.match(padRule, /position:absolute;bottom:12px;z-index:3;/);
  assert.equal(count(HTML, "--mw-pad-lift"), 0, "the Phase 78 lift is gone from the CSS and the script");
  const railZ = Number(STYLE.match(/\.mw-rail\{[^}]*z-index:(\d+)/)[1]);
  const padZ = Number(padRule.match(/z-index:(\d+)/)[1]);
  assert.ok(padZ < railZ, `pad z ${padZ} < rail z ${railZ}`);
  assert.match(STYLE, /\.mw-arrow-pad\[data-side="right"\]\{right:calc\(12px \+ var\(--safe-area-inset-right, env\(safe-area-inset-right, 0px\)\)\)\}/);
  assert.match(STYLE, /\.mw-arrow-pad\[data-side="left"\]\{left:calc\(12px \+ var\(--safe-area-inset-left, env\(safe-area-inset-left, 0px\)\)\)\}/);
  // Reduced motion: the press feedback moves nothing (colour, border and
  // shadow only), and its one transition falls to the blanket rule.
  const active = STYLE.match(/\.mw-arrow-btn:active\{([^}]*)\}/);
  assert.ok(active);
  assert.doesNotMatch(active[1], /transform|animation/);
  assert.doesNotMatch(STYLE.match(/\.mw-arrow-btn\{([^}]*)\}/)[1], /animation|transform/);
  assert.equal(count(STYLE, "prefers-reduced-motion"), 1, "the one blanket rule covers the pad");
});

test("(b) CSS: while a rail card is shown (data-rail-up=\"1\") the pad is hidden in place, not tappable, and nothing reflows (visibility, never display or a position change)", () => {
  const up = STYLE.match(/\.mw-arrow-pad\[data-rail-up="1"\]\{([^}]*)\}/);
  assert.ok(up, "the rail-up rule exists");
  assert.equal(up[1], "visibility:hidden", "only visibility changes: the pad keeps its box, so nothing moves");
  const btns = STYLE.match(/\.mw-arrow-pad\[data-rail-up="1"\] \.mw-arrow-btn\{([^}]*)\}/);
  assert.ok(btns, "the rail-up button rule exists");
  assert.equal(btns[1], "pointer-events:none", "a hidden button can never take a tap");
  // The shown rule is the pad's own resting state: no rail-up="0" rule is needed.
  assert.doesNotMatch(STYLE, /\.mw-arrow-pad\[data-rail-up="0"\]/);
});

// ─── (c) syncArrowPad, run in a small vm over the shipped source ────────────

const SYNC_SRC = sliceBetween(CODE, 'let arrowPadKey = "";', "function renderSettingsSheet()");

function fakeEl(extra = {}) {
  const el = {
    hidden: false,
    dataset: {},
    attrs: {},
    listeners: {},
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
    ...extra,
  };
  return el;
}

/**
 * bootSync({ settings, state, encounter, sheet, railShown, railHeight }) —
 * runs the shipped syncArrowPad block (plus its click wiring) in a vm with a
 * fake pad/rail/stage and the REAL arrowPadModel. Returns the pad, the
 * sync function, and the recorded keep-in-view and move calls.
 */
function bootSync({ settings = { movement: "arrows", padSide: "right" }, state = { dead: false }, encounter = false, sheet = false, railShown = false, railHeight = 180, railEl = null, encounterFn = null, stateFn = null } = {}) {
  const buttons = Object.fromEntries(ARROW_PAD_DIRS.map((d) => [d.dir, fakeEl({ dataset: { step: d.dir } })]));
  const box = fakeEl({ getBoundingClientRect: () => ({ top: 100, bottom: 700, left: 0, right: 400, width: 400, height: 600 }) });
  const pad = fakeEl({
    parentElement: box,
    querySelector: (sel) => {
      const m = /\[data-step="([NESW])"\]/.exec(sel);
      return m ? buttons[m[1]] : null;
    },
  });
  // `railEl` (optional): a REAL #mw-rail from a shell sandbox, so the shipped
  // renderRail's own data-shown writes drive the pad (quick task 260927-s7b).
  const rail = railEl || fakeEl({ offsetHeight: railHeight, dataset: { shown: railShown ? "1" : "0" } });
  const stage = fakeEl({ getBoundingClientRect: () => ({ top: 60, bottom: 700, left: 0, right: 400, width: 400, height: 640 }) });
  const byId = { "mw-arrow-pad": pad, "mw-rail": rail, "mw-stage": stage };
  const env = { encounter, sheet, state };
  const keeps = [];
  const moves = [];
  const pulses = [];
  const win = {
    __mzState: { get: () => (stateFn ? stateFn() : env.state) },
    __mzSettings: settings,
    mzKeepPartyInView: () => keeps.push(true),
    move: (dir) => moves.push(dir),
    mzRailPulse: () => pulses.push(true),
  };
  const context = vm.createContext({
    window: win,
    document: {
      getElementById: (id) => byId[id] || null,
      querySelector: (sel) => (sel === ".mw-legend-sheet:not([hidden])" && env.sheet ? {} : null),
      querySelectorAll: () => [],
    },
    arrowPadModel,
    hasActiveEncounter: () => (encounterFn ? encounterFn() : env.encounter),
  });
  vm.runInContext(SYNC_SRC, context, { filename: "mazeworld.html#syncArrowPad" });
  const click = (dir) => {
    const target = { closest: () => buttons[dir] };
    for (const fn of pad.listeners.click || []) fn({ target });
  };
  return { pad, buttons, rail, env, win, keeps, moves, pulses, click, sync: () => context.syncArrowPad() };
}

test("(c) arrow mode with the map open: the pad shows on the chosen side, labelled from ARROW_PAD_COPY, and the camera re-checks once", () => {
  for (const side of ["left", "right"]) {
    const r = bootSync({ settings: { movement: "arrows", padSide: side } });
    r.sync();
    assert.equal(r.pad.hidden, false);
    assert.equal(r.pad.dataset.side, side);
    assert.equal(r.pad.attrs["aria-label"], ARROW_PAD_COPY.pad);
    for (const d of ARROW_PAD_DIRS) assert.equal(r.buttons[d.dir].attrs["aria-label"], ARROW_PAD_COPY[d.dir]);
    // Quick task 260927-s7b: no lift is ever written (re-pinned from "0px").
    assert.equal(r.pad.style.props["--mw-pad-lift"], undefined);
    assert.equal(r.pad.dataset.railUp, "0");
    assert.equal(r.keeps.length, 1, "the pad appearing re-runs keep-in-view");
    r.sync();
    assert.equal(r.keeps.length, 1, "an unchanged pad does not re-run it");
  }
});

test("(c) the pad is hidden while dead, in an encounter (combat, store, stair prompt), under a sheet, with no run, and in tap mode", () => {
  const cases = [
    ["dead", { state: { dead: true } }],
    ["encounter", { encounter: true }],
    ["sheet", { sheet: true }],
    ["no run", { state: null }],
    ["tap mode", { settings: { movement: "tap", padSide: "left" } }],
    ["unknown movement", { settings: { movement: "hover" } }],
    ["no settings", { settings: null }],
  ];
  for (const [name, opts] of cases) {
    const r = bootSync(opts);
    r.sync();
    assert.equal(r.pad.hidden, true, `${name} hides the pad`);
    assert.equal(r.keeps.length, 0, `${name}: no camera nudge for a hidden pad`);
  }
});

test("(c) a death, a fight or a sheet mid-run hides the pad; its end shows it again (and the camera re-checks)", () => {
  const r = bootSync();
  r.sync();
  assert.equal(r.pad.hidden, false);
  r.env.encounter = true;
  r.sync();
  assert.equal(r.pad.hidden, true);
  r.env.encounter = false;
  r.sync();
  assert.equal(r.pad.hidden, false);
  assert.equal(r.keeps.length, 2);
  r.env.sheet = true;
  r.sync();
  assert.equal(r.pad.hidden, true);
  r.env.sheet = false;
  r.env.state = { dead: true };
  r.sync();
  assert.equal(r.pad.hidden, true, "dead stays hidden");
});

// Quick task 260927-s7b (user, 2026-09-27): re-pinned from the Phase 78
// "a shown rail card lifts the pad above the card's resting top edge" (a
// 180px --mw-pad-lift here). The user saw that lift as the rail pushing the
// buttons up; the ruling is to hide them while a card shows instead.
test("(c) a shown rail card hides the pad in place (data-rail-up=\"1\"): it never moves, never un-lays-out, and the camera does not re-check; the card going shows it again", () => {
  const r = bootSync({ railShown: true, railHeight: 180 });
  r.sync();
  assert.equal(r.pad.hidden, false, "the pad keeps its box (hidden by visibility, not display), so the camera's pad edge is unchanged");
  assert.equal(r.pad.dataset.railUp, "1");
  assert.equal(r.pad.style.props["--mw-pad-lift"], undefined, "no lift: the pad never moves");
  assert.equal(r.keeps.length, 1, "the pad appearing re-runs keep-in-view once");
  r.rail.dataset.shown = "0";
  r.sync();
  assert.equal(r.pad.dataset.railUp, "0", "the card dismissed: the pad shows again");
  assert.equal(r.pad.hidden, false);
  assert.equal(r.keeps.length, 1, "nothing moved, so the camera does not re-check");
  r.rail.dataset.shown = "1";
  r.sync();
  assert.equal(r.pad.dataset.railUp, "1");
  assert.equal(r.keeps.length, 1);
});

test("(c) a pad hidden for another reason (an encounter, a sheet, dead, tap mode) never reads as rail-up", () => {
  for (const opts of [{ encounter: true }, { sheet: true }, { state: { dead: true } }, { settings: { movement: "tap" } }]) {
    const r = bootSync({ ...opts, railShown: true });
    r.sync();
    assert.equal(r.pad.hidden, true);
    assert.equal(r.pad.dataset.railUp, "0", JSON.stringify(opts));
  }
});

// ─── (c) the REAL renderRail drives the pad through every dismissal path ────

/**
 * bootRailPad(state) — the REAL classic renderRail (shellSandbox stubRail:
 * false, a fake clock so the hold timer fires) wired to the REAL shipped
 * syncArrowPad (bootSync over the sandbox's own #mw-rail and its real
 * hasActiveEncounter), exactly as the module script wires
 * window.mzSyncArrowPad. Quick task 260927-s7b.
 */
function bootRailPad(state) {
  const clock = createFakeClock({ start: 1_000_000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock, stubRail: false });
  sandbox.setState(state);
  const r = bootSync({
    railEl: doc.document.getElementById("mw-rail"),
    stateFn: () => vm.runInContext("S", sandbox.context),
    encounterFn: () => sandbox.context.hasActiveEncounter(),
  });
  sandbox.context.window.mzSyncArrowPad = r.sync;
  const w = sandbox.context.window;
  const pushCard = (title = "A TRAP") => {
    w.__mzRail = railPush(w.__mzRail || emptyRail(), railLineCard(title, "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  };
  const bodyTap = () => doc.document.getElementById("mw-rail").onclick({ target: { closest: () => null } });
  const shown = () => doc.document.getElementById("mw-rail").dataset.shown;
  return { clock, doc, sandbox, w, r, pushCard, bodyTap, shown, render: () => sandbox.context.renderRail() };
}

test("(c) real renderRail: a card showing hides the pad, and its hold running out shows it again", () => {
  const t = bootRailPad(newRun(21));
  t.render();
  assert.equal(t.shown(), "0");
  assert.equal(t.r.pad.hidden, false);
  assert.equal(t.r.pad.dataset.railUp, "0", "no card: the pad shows");
  t.pushCard();
  t.render();
  assert.equal(t.shown(), "1");
  assert.equal(t.r.pad.hidden, false, "still laid out");
  assert.equal(t.r.pad.dataset.railUp, "1", "a card is up: the pad is hidden in place");
  t.clock.advance(holdForCard(t.w.__mzRail.card) + 64);
  assert.equal(t.w.__mzRail.card, null, "the hold cleared the card");
  assert.equal(t.shown(), "0");
  assert.equal(t.r.pad.dataset.railUp, "0", "the hold ran out: the pad shows again");
});

test("(c) real renderRail: an armed tap dismissing the card shows the pad again; a card replacing a card keeps it hidden", () => {
  const t = bootRailPad(newRun(22));
  t.pushCard("A TRAP");
  t.render();
  assert.equal(t.r.pad.dataset.railUp, "1");
  t.pushCard("WELL THEN");
  t.render();
  assert.equal(t.r.pad.dataset.railUp, "1", "a card replacing a card: still hidden");
  t.clock.advance(ARM_DELAY_MS + 60);
  t.bodyTap();
  assert.equal(t.w.__mzRail.card, null, "the tap dismissed the card");
  assert.equal(t.shown(), "0");
  assert.equal(t.r.pad.dataset.railUp, "0", "dismissed by a tap: the pad shows again");
});

test("(c) real renderRail: a pending decision card hides the pad; the decision resolving (the next paint with no card) shows it", () => {
  const s = newRun(23);
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 1 };
  const t = bootRailPad(s);
  t.render();
  assert.equal(t.shown(), "1");
  assert.equal(t.r.pad.dataset.railUp, "1", "a decision card is up: the pad is hidden");
  t.clock.advance(ARM_DELAY_MS + 60);
  t.bodyTap();
  assert.equal(t.r.pad.dataset.railUp, "1", "a locked decision card is never tap-dismissed, so the pad stays hidden");
  vm.runInContext("S.pendingJoiner = null;", t.sandbox.context);
  t.render();
  assert.equal(t.shown(), "0");
  assert.equal(t.r.pad.dataset.railUp, "0", "the decision resolved: the pad shows again");
});

test("(c) relaunch: a run restored with no card shows the pad; one restored with its decision card up keeps it hidden; one restored into an open store hides it until the store closes, then it shows", () => {
  const plain = bootRailPad(newRun(24));
  plain.render();
  assert.equal(plain.r.pad.hidden, false);
  assert.equal(plain.r.pad.dataset.railUp, "0");

  const s = newRun(25);
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 1 };
  const decided = bootRailPad(s);
  decided.render();
  assert.equal(decided.r.pad.hidden, false);
  assert.equal(decided.r.pad.dataset.railUp, "1");

  const st = newRun(26);
  st.store = { stock: [], haggle: false, race: "Human" };
  const shop = bootRailPad(st);
  shop.render();
  assert.equal(shop.r.pad.hidden, true, "the store owns the screen: the pad is hidden");
  assert.equal(shop.r.pad.dataset.railUp, "0");
  vm.runInContext("S.store = null;", shop.sandbox.context);
  shop.render();
  assert.equal(shop.r.pad.hidden, false, "the store closed: the pad is back");
  assert.equal(shop.r.pad.dataset.railUp, "0", "and visible, no card being up");
});

test("(c) the classic renderRail (all three exits after its data-shown write) and renderEncounter re-sync the pad, always optional-chained", () => {
  const rail = sliceBetween(CODE, "function renderRail() {", "function syncRailLive(text)");
  // Phase 78 (HUD-06, 78-08): the stairs fade's hold branch is a third exit
  // after the data-shown write (was 2), and it re-syncs the pad too.
  assert.equal(count(rail, "window.mzSyncArrowPad?.();"), 3);
  const shownAt = rail.indexOf('railEl.dataset.shown = railEl.hidden ? "0" : "1";');
  assert.ok(shownAt !== -1 && rail.indexOf("window.mzSyncArrowPad?.();") > shownAt, "the syncs follow the data-shown write");
  assert.match(rail.trimEnd(), /window\.mzSyncArrowPad\?\.\(\);\s*\}$/);
  const enc = sliceBetween(CODE, "function renderEncounter() {", "const panel = document.getElementById(\"enc-panel\");");
  assert.match(enc, /window\.mzSyncArrowPad\?\.\(\);/);
  // Nothing in the classic script depends on the pad being there: every
  // classic reach for it is optional-chained.
  const classic = sliceBetween(CODE, "let S = null;", "import { readSettings");
  assert.equal(count(classic, "mzSyncArrowPad"), count(classic, "window.mzSyncArrowPad?.()"));
  assert.equal(count(CODE, "window.mzSyncArrowPad = syncArrowPad;"), 1);
});

// ─── (d) presses ────────────────────────────────────────────────────────────

test("(d) each press is ONE window.move(dir); two quick presses are two calls in order", () => {
  const r = bootSync();
  r.sync();
  r.click("N");
  assert.deepEqual(r.moves, ["N"]);
  r.click("E");
  r.click("E");
  assert.deepEqual(r.moves, ["N", "E", "E"]);
  for (const dir of ["S", "W"]) r.click(dir);
  assert.deepEqual(r.moves, ["N", "E", "E", "S", "W"]);
  // A click that lands off a button (the grid gap) steps nowhere.
  for (const fn of r.pad.listeners.click) fn({ target: { closest: () => null } });
  assert.equal(r.moves.length, 5);
});

test("(d) the press path is window.move only — no dispatch, no stepNow, no second movement path", () => {
  const wiring = sliceBetween(CODE, 'document.getElementById("mw-arrow-pad")?.addEventListener("click"', "if (typeof MutationObserver");
  assert.match(wiring, /if \(dir === "N" \|\| dir === "E" \|\| dir === "S" \|\| dir === "W"\) window\.move\(dir\);/);
  assert.doesNotMatch(wiring, /stepNow|stepWith|dispatch|act\(/);
  assert.equal(count(SYNC_SRC, "window.move("), 1);
  // No hold-to-repeat: nothing in the pad block schedules a timer.
  assert.doesNotMatch(SYNC_SRC, /setTimeout|setInterval|pointerdown/);
});

// The module's window.move (engineMove) run in a vm with its gates stubbed:
// the pad's press goes through every gate a tap step does.
function bootEngineMove({ encounter = false, settled = true, locked = false, exit = false } = {}) {
  const src = sliceBetween(CODE, "window.move = function engineMove(dir) {", "\n  window.mzUseTool");
  const calls = [];
  const win = { mzRailPulse: () => calls.push("pulse"), renderEncounter: () => calls.push("renderEncounter") };
  const context = vm.createContext({
    window: win,
    hasActiveEncounter: () => encounter,
    encounterSettled: () => settled,
    railLocked: () => locked,
    stepTargetsExit: () => exit,
    stepNow: (dir) => calls.push(`step:${dir}`),
  });
  vm.runInContext(src, context, { filename: "mazeworld.html#engineMove" });
  return { move: win.move, calls, win };
}

test("(d) a press during a pending rail decision (a wall/crevice card, a joiner, a find) pulses the card and never steps", () => {
  const r = bootSync();
  const em = bootEngineMove({ locked: true });
  r.win.move = em.move;
  r.sync();
  r.click("N");
  assert.deepEqual(em.calls, ["pulse"]);
});

test("(d) a press over an encounter or inside the settle window does nothing; a clear press steps once", () => {
  for (const [opts, expected] of [
    [{ encounter: true }, []],
    [{ settled: false }, []],
    [{ exit: true }, ["renderEncounter"]],
    [{}, ["step:W"]],
  ]) {
    const r = bootSync();
    const em = bootEngineMove(opts);
    r.win.move = em.move;
    r.sync();
    r.click("W");
    assert.deepEqual(em.calls, expected, JSON.stringify(opts));
  }
});

// ─── (e) tapStep in both modes; keyboard arrows in both modes ───────────────

/** bootTap(settings) — the REAL classic tapStep over a live run, party at {10,10}, camera on the party. */
function bootTap(settings) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  w.__mzControls = { screenToCell, keepInViewAxis, keepInViewRect };
  w.__mzTapStep = { resolveStep, inspectCell, HOLD_MS, TAP_MAX_TRAVEL_PX, DIR_VECTORS };
  w.__mzRailVM = { copy: RAIL_COPY };
  if (settings !== undefined) w.__mzSettings = settings;
  const moves = [];
  const lines = [];
  w.move = (dir) => moves.push(dir);
  w.mzRailLine = (...args) => lines.push(args);
  const state = newRun(1);
  state.floor.px = 10;
  state.floor.py = 10;
  for (const [x, y] of [[11, 10], [9, 10], [10, 11], [10, 9]]) {
    state.floor.g[y][x].wall = false;
    state.floor.g[y][x].seen = true;
  }
  sandbox.setState(state);
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0 });
  sandbox.context.centerMap();
  return { sandbox, w, moves, lines };
}

test("(e) tap mode (the default): a map tap one cell east steps east", () => {
  for (const settings of [undefined, { movement: "tap", padSide: "right" }, { movement: "hover" }]) {
    const r = bootTap(settings);
    r.sandbox.context.tapStep(200 + 28, 300);
    assert.deepEqual(r.moves, ["E"], `settings ${JSON.stringify(settings)}`);
  }
});

test("(e) arrow mode: a map tap never moves the party and says nothing (no rail line)", () => {
  const r = bootTap({ movement: "arrows", padSide: "left" });
  r.sandbox.context.tapStep(200 + 28, 300);
  r.sandbox.context.tapStep(200, 300); // the party's own cell: tap mode would say "here"
  assert.deepEqual(r.moves, []);
  assert.deepEqual(r.lines, []);
  // Switching back live restores tap-to-move on the very next tap.
  r.w.__mzSettings = { movement: "tap", padSide: "left" };
  r.sandbox.context.tapStep(200, 300 + 28);
  assert.deepEqual(r.moves, ["S"]);
});

test("(e) tapStep's arrow-mode gate sits after the encounter gate and before the rail pulse and resolveStep; hold, pan and pinch never read it", () => {
  const tap = sliceBetween(CODE, "function tapStep(clientX, clientY)", "function inspectAt(clientX, clientY)");
  const order = ["hasActiveEncounter()", "if (tapMovementOff()) return;", "railLocked()", "resolveStep(", "move(res.dir);"];
  let cursor = -1;
  for (const literal of order) {
    const idx = tap.indexOf(literal);
    assert.ok(idx > cursor, `"${literal}" in order`);
    cursor = idx;
  }
  const off = sliceBetween(CODE, "function tapMovementOff()", "function tapStep(clientX, clientY)");
  assert.match(off, /const settings = window\.__mzSettings;\s*return !!\(settings && settings\.movement === "arrows"\);/);
  const inspect = sliceBetween(CODE, "function inspectAt(clientX, clientY)", "(function initMazeViewportControls()");
  const viewport = sliceBetween(CODE, "(function initMazeViewportControls()", 'addEventListener("keydown"');
  for (const region of [inspect, viewport]) {
    assert.doesNotMatch(region, /tapMovementOff|movement|mw-arrow-pad/);
  }
});

test("(e) keyboard arrows and WASD step through window.move in BOTH modes (the keydown path reads no Movement setting)", () => {
  const keys = sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
  assert.match(keys, /const dirKeys = \{ arrowup:"N", w:"N", arrowdown:"S", s:"S", arrowleft:"W", a:"W", arrowright:"E", d:"E" \};/);
  assert.match(keys, /if \(dirKeys\[k\]\) \{ e\.preventDefault\(\); window\.move\(dirKeys\[k\]\); return; \}/);
  assert.doesNotMatch(keys, /tapMovementOff|movement|__mzSettings|mw-arrow-pad/);
});

// ─── (f) keepPartyInView: the pad is an edge ───────────────────────────────

const VIEWPORT = Object.freeze({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0 });
// A BOTTOM RIGHT pad, 164 x 164 px (three 52px buttons and two 4px gaps at
// M), 12px in from the viewport's right and bottom edges.
const PAD_RECT = Object.freeze({ left: 224, top: 424, right: 388, bottom: 588, width: 164, height: 164, x: 224, y: 424 });

/**
 * bootCamera({ settings, padHidden }) — the REAL classic keepPartyInView
 * over a live run (party at {16,13}, the camera snapped onto {10,10}'s
 * centre first), with __mzControls wired from the real controls.js through
 * recording spies and the pad's rect stubbed.
 */
function bootCamera({ settings, padHidden = false } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  const calls = { axis: [], rect: [] };
  w.__mzControls = {
    screenToCell,
    keepInViewAxis: (...args) => {
      calls.axis.push(args);
      return keepInViewAxis(...args);
    },
    keepInViewRect: (...args) => {
      calls.rect.push(args);
      return keepInViewRect(...args);
    },
  };
  if (settings !== undefined) w.__mzSettings = settings;
  const state = newRun(1);
  state.floor.px = 10;
  state.floor.py = 10;
  sandbox.setState(state);
  doc.document.getElementById("mw-maze-viewport").getBoundingClientRect = () => ({ ...VIEWPORT });
  const pad = doc.document.getElementById("mw-arrow-pad");
  pad.hidden = padHidden;
  pad.getBoundingClientRect = () => ({ ...PAD_RECT });
  sandbox.context.centerMap();
  // Walk the party into the pad's column, 1.43 cells above its top edge.
  state.floor.px = 16;
  state.floor.py = 13;
  // JSON round trip: plain objects of this realm (the vm's own Object
  // prototype would fail deepStrictEqual).
  const read = (expr) => JSON.parse(JSON.stringify(vm.runInContext(expr, sandbox.context)));
  const before = read("({ x: cam.x, y: cam.y })");
  calls.axis.length = 0;
  calls.rect.length = 0;
  return { sandbox, calls, read, before, keep: () => sandbox.context.keepPartyInView() };
}

test("(f) arrow mode with the pad shown: keepPartyInView calls keepInViewRect with the pad's rect in cells relative to the viewport, and the camera takes its answer", () => {
  const r = bootCamera({ settings: { movement: "arrows", padSide: "right" } });
  r.keep();
  assert.equal(r.calls.rect.length, 1, "keepInViewRect called once");
  const [base, party, span, obstacle] = JSON.parse(JSON.stringify(r.calls.rect[0]));
  const CELL = r.read("CELL");
  assert.deepEqual({ x: base.x, y: base.y }, r.before);
  assert.deepEqual(party, { x: 16.5, y: 13.5 });
  assert.deepEqual(span, { x: 400 / CELL, y: 600 / CELL });
  assert.deepEqual(obstacle, { left: 224 / CELL, top: 424 / CELL, right: 388 / CELL, bottom: 588 / CELL });
  const expected = keepInViewRect(r.before, { x: 16.5, y: 13.5 }, span, obstacle);
  assert.ok(expected.y > r.before.y, "the pad edge scrolls the camera down");
  assert.deepEqual(r.read("({ x: cam.x, y: cam.y })"), expected, "the camera lands on keepInViewRect's answer (reduced motion snaps)");
});

test("(f) tap mode: keepPartyInView runs keepInViewAxis per axis and never keepInViewRect (tap mode's camera is unchanged)", () => {
  for (const settings of [undefined, { movement: "tap", padSide: "right" }]) {
    const r = bootCamera({ settings });
    r.keep();
    assert.equal(r.calls.rect.length, 0, `settings ${JSON.stringify(settings)}: no keepInViewRect`);
    assert.equal(r.calls.axis.length, 2);
    const CELL = r.read("CELL");
    const expected = {
      x: keepInViewAxis(r.before.x, 16.5, 400 / CELL),
      y: keepInViewAxis(r.before.y, 13.5, 600 / CELL),
    };
    assert.deepEqual(r.read("({ x: cam.x, y: cam.y })"), expected);
  }
});

test("(f) arrow mode with the pad hidden (dead, an encounter, a sheet): the plain per-axis rule, no pad edge", () => {
  const r = bootCamera({ settings: { movement: "arrows", padSide: "right" }, padHidden: true });
  r.keep();
  assert.equal(r.calls.rect.length, 0);
  assert.equal(r.calls.axis.length, 2);
});

test("(f) source: keepPartyInView keeps its per-axis tap path verbatim and reads the pad through arrowPadCells; keepInViewRect is on the one controls bridge", () => {
  const keep = sliceBetween(CODE, "function keepPartyInView()", "window.mzKeepPartyInView = keepPartyInView;");
  assert.match(keep, /const padBox = C\.keepInViewRect \? arrowPadCells\(rect\) : null;/);
  assert.match(keep, /C\.keepInViewRect\(base, p, \{ x: rect\.width \/ CELL, y: rect\.height \/ CELL \}, padBox\)/);
  assert.match(keep, /C\.keepInViewAxis\(base\.x, p\.x, rect\.width \/ CELL\)/);
  assert.match(keep, /C\.keepInViewAxis\(base\.y, p\.y, rect\.height \/ CELL\)/);
  const cells = sliceBetween(CODE, "function arrowPadCells(rect)", "function keepPartyInView()");
  assert.match(cells, /if \(!tapMovementOff\(\)\) return null;/);
  assert.match(cells, /if \(!pad \|\| pad\.hidden\) return null;/);
  assert.match(cells, /left: \(r\.left - rect\.left\) \/ CELL,/);
  assert.match(cells, /top: \(r\.top - rect\.top\) \/ CELL,/);
  assert.equal(count(CODE, "window.__mzControls = { screenToCell, resolveTapDirection, classifyPointerGesture, keepInViewAxis, keepInViewRect };"), 1);
  assert.ok(count(HTML, "keepInViewRect") >= 2);
});
