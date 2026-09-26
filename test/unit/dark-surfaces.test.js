// test/unit/dark-surfaces.test.js
//
// Phase 76 (DARK-02), Plan 02 — every darkness surface the player sees reads
// the engine's ONE predicate (engine/derived.js#darkWaiver, bridged on
// window.__mzDarkness): the DARK chip, the map vignette and draw()'s
// per-tile dark painting. Drives the REAL paint() and draw() through
// test/unit/harness/shellSandbox.js (`stubDraw: false` + a recording canvas)
// and reads the fillStyle in effect at each cell's full-cell fillRect.
//
//   - no light: the party's dark cell fills floorDark, a lit neighbour fills
//     floor, a seen cell two squares away is not drawn;
//   - a lit torch: the dark cell fills floorDarkLit, the lit neighbour still
//     fills floor, and the far seen cell is drawn;
//   - a dark pool: waterDark with no light, waterDarkLit under a light; a
//     spellSeen cell fills floorSpell either way;
//   - the every-surface agreement table across {no waiver, Night Vision, a
//     live Amulet, a lit torch, a cooling torch};
//   - the bridge withheld: draw() throws nothing and dark cells fill full
//     floorDark (fail-open to the old look).

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { newRun } from "../../engine/state.js";
import { inDark, revealRadius, mapViewRadius, darkWaiver, DARK_VIEW_RADIUS } from "../../engine/derived.js";
import { vignetteFor, waiverFor } from "../../src/browser/darknessView.js";
import { MAP_PALETTE } from "../../src/browser/mapMarks.js";

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const PX = 5, PY = 5;

const TORCH_LIT = { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } };
const TORCH_COOLING = { "item:Torch": { cadence: "squares", left: 0, cd: 40, phase: "cooldown" } };
const AMULET_ITEMS = [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }];
const AMULET_LIVE = { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } };

// The shell's WAIVER_LABEL copy (mazeworld.html), restated as the expected
// chip text.
const LABEL = { nightVision: "your night vision", amuletLight: "your Amulet of Light", litTorch: "your torch" };

const WAIVER_CASES = [
  { name: "no waiver", c: {}, key: null },
  { name: "Night Vision", c: { skills: { "Night Vision": 1 } }, key: "nightVision" },
  { name: "a live Amulet of Light", c: { items: AMULET_ITEMS, timers: AMULET_LIVE }, key: "amuletLight" },
  { name: "a lit torch", c: { timers: TORCH_LIT }, key: "litTorch" },
  { name: "a cooling torch", c: { timers: TORCH_COOLING }, key: null },
];

function bridge() {
  return { inDark, revealRadius, mapViewRadius, darkWaiver, vignetteFor, waiverFor };
}

/**
 * darkState(cExtra) — a real newRun state with the party at (PX, PY) on a
 * seen `.dark` floor cell, darkFor 30, and Night Vision stripped (so the
 * "no waiver" case really has none), then `cExtra` merged onto the hero.
 * Around the party:
 *   (PX+1, PY) a seen LIT floor cell (distance 1)
 *   (PX+2, PY) a seen DARK floor cell (distance 2, outside the dark window)
 *   (PX, PY+1) a seen dark pool
 *   (PX-1, PY) a seen dark cell revealed by Map the Floor (spellSeen)
 *   (PX, PY-1) a seen lit pool
 */
function darkState(cExtra = {}) {
  const state = newRun(1);
  const g = state.floor.g;
  for (let y = PY - 3; y <= PY + 3; y++) {
    for (let x = PX - 3; x <= PX + 3; x++) {
      g[y][x] = { ...g[y][x], wall: false, seen: false, feat: null, dark: false, water: false, spellSeen: false };
    }
  }
  const set = (x, y, extra) => { g[y][x] = { ...g[y][x], seen: true, ...extra }; };
  set(PX, PY, { dark: true });
  set(PX + 1, PY, { dark: false });
  set(PX + 2, PY, { dark: true });
  set(PX, PY + 1, { dark: true, water: true });
  set(PX - 1, PY, { dark: true, spellSeen: true });
  set(PX, PY - 1, { dark: false, water: true });
  state.floor.px = PX;
  state.floor.py = PY;
  state.combat = null;
  state.c.darkFor = 30;
  state.c.skills = { ...(state.c.skills || {}) };
  delete state.c.skills["Night Vision"];
  state.c.timers = {};
  Object.assign(state.c, structuredClone(cExtra));
  return state;
}

/**
 * render(state, { withBridge }) — REAL paint() then a fresh REAL draw() over
 * a recording canvas whose fillRect also records the fillStyle in effect.
 * Returns the per-cell fill map, the vignette level and the chip detail.
 */
function render(state, { withBridge = true } = {}) {
  const doc = createRecordingDocument();
  const ctx = createRecordingContext();
  const fills = [];
  const rawFillRect = ctx.fillRect;
  ctx.fillRect = (...args) => {
    fills.push({ args, style: ctx.fillStyle });
    return rawFillRect(...args);
  };
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw: false, canvasContext: ctx });
  if (withBridge) sandbox.context.window.__mzDarkness = bridge();
  sandbox.setState(state);
  sandbox.paint();
  fills.length = 0;
  sandbox.context.draw();
  const fillAt = (x, y) => {
    const hit = fills.find((f) => f.args[0] === x * CELL && f.args[1] === y * CELL && f.args[2] === CELL && f.args[3] === CELL);
    return hit ? hit.style : null;
  };
  const host = doc.document.getElementById("mm-conditions");
  const chip = host.children.find((el) => el.dataset && el.dataset.key === "darkness") || null;
  const detailEl = chip && chip.children.find((el) => el.className === "mw-cond-detail");
  return {
    fillAt,
    vignette: doc.document.getElementById("mw-vignette").dataset.dark,
    detail: detailEl ? detailEl.textContent : null,
  };
}

// ─── per-tile painting ────────────────────────────────────────────────────

test("DARK-02 no light: the party's dark cell fills floorDark, a lit neighbour fills floor, a seen cell two squares away is not drawn", () => {
  const r = render(darkState());
  assert.equal(r.fillAt(PX, PY), MAP_PALETTE.floorDark);
  assert.equal(r.fillAt(PX + 1, PY), MAP_PALETTE.floor, "a lit cell beside a dark one paints by its own flag");
  assert.equal(r.fillAt(PX + 2, PY), null, "outside the dark window, a seen cell is not drawn");
});

test("DARK-02 adjacency: with the dark limiting vision, distance DARK_VIEW_RADIUS is drawn and DARK_VIEW_RADIUS + 1 is not", () => {
  assert.equal(DARK_VIEW_RADIUS, 1);
  const r = render(darkState());
  assert.notEqual(r.fillAt(PX + DARK_VIEW_RADIUS, PY), null);
  assert.equal(r.fillAt(PX + DARK_VIEW_RADIUS + 1, PY), null);
});

test("DARK-02 a lit torch: the dark cell fills floorDarkLit, the lit neighbour still fills floor, and the far seen cell is drawn", () => {
  const r = render(darkState({ timers: TORCH_LIT }));
  assert.equal(r.fillAt(PX, PY), MAP_PALETTE.floorDarkLit);
  assert.notEqual(r.fillAt(PX, PY), MAP_PALETTE.floor, "a waived dark tile never paints like ordinary lit floor");
  assert.equal(r.fillAt(PX + 1, PY), MAP_PALETTE.floor);
  assert.equal(r.fillAt(PX + 2, PY), MAP_PALETTE.floorDarkLit, "the far dark cell is drawn, tinted");
});

test("DARK-02 water: a dark pool fills waterDark with no light and waterDarkLit under a light; a lit pool fills water either way", () => {
  const dark = render(darkState());
  assert.equal(dark.fillAt(PX, PY + 1), MAP_PALETTE.waterDark);
  assert.equal(dark.fillAt(PX, PY - 1), MAP_PALETTE.water);
  const lit = render(darkState({ timers: TORCH_LIT }));
  assert.equal(lit.fillAt(PX, PY + 1), MAP_PALETTE.waterDarkLit);
  assert.equal(lit.fillAt(PX, PY - 1), MAP_PALETTE.water);
});

test("DARK-02 spellSeen: a spell-revealed dark cell fills floorSpell with or without a light", () => {
  assert.equal(render(darkState()).fillAt(PX - 1, PY), MAP_PALETTE.floorSpell);
  assert.equal(render(darkState({ timers: TORCH_LIT })).fillAt(PX - 1, PY), MAP_PALETTE.floorSpell);
});

// ─── every-surface agreement ──────────────────────────────────────────────

test("DARK-02 agreement table: the vignette, the chip's named waiver and the dark cell's fill all agree with darkWaiver(S.c)", () => {
  for (const wc of WAIVER_CASES) {
    const state = darkState(wc.c);
    const key = darkWaiver(state.c);
    assert.equal(key, wc.key, `${wc.name}: the engine's answer`);
    const r = render(state);
    if (key === null) {
      assert.equal(r.vignette, "close", `${wc.name}: vignette`);
      assert.doesNotMatch(r.detail, /holding/, `${wc.name}: the chip names no waiver`);
      assert.equal(r.fillAt(PX, PY), MAP_PALETTE.floorDark, `${wc.name}: dark cell fill`);
    } else {
      assert.equal(r.vignette, "off", `${wc.name}: vignette`);
      assert.ok(r.detail.includes(`${LABEL[key]} is holding it back`), `${wc.name}: the chip names ${LABEL[key]}, got ${r.detail}`);
      assert.equal(r.fillAt(PX, PY), MAP_PALETTE.floorDarkLit, `${wc.name}: dark cell fill`);
    }
  }
});

// ─── fail-open ────────────────────────────────────────────────────────────

test("DARK-02 empty: the bridge withheld, so draw() throws nothing and dark cells fill full floorDark (today's look), even under a lit torch", () => {
  let r;
  assert.doesNotThrow(() => { r = render(darkState({ timers: TORCH_LIT }), { withBridge: false }); });
  assert.equal(r.fillAt(PX, PY), MAP_PALETTE.floorDark);
  assert.equal(r.fillAt(PX, PY + 1), MAP_PALETTE.waterDark);
  assert.equal(r.vignette, "off");
  assert.doesNotMatch(r.detail, /holding/);
});
