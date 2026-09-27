// test/unit/arrow-pad.test.js
//
// Phase 78 (HUD-08), Plan 07 — the opt-in arrow pad's pure view model
// (src/browser/arrowPad.js). The pad shows only in arrow mode and only while
// the map takes input (a run exists, the hero lives, nothing is over the map,
// no sheet covers it); its side follows padSide; its four buttons are N, E,
// S, W, each with a TalkBack label from the frozen ARROW_PAD_COPY. Anything
// unknown reads as tap-to-move, so the pad hides.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { ARROW_PAD_COPY, ARROW_PAD_DIRS, ARROW_PAD_DEFAULT_SIDE, arrowPadModel } from "../../src/browser/arrowPad.js";

const OPEN = Object.freeze({ run: true, dead: false, encounter: false, sheet: false });
const ARROWS_RIGHT = Object.freeze({ movement: "arrows", padSide: "right" });
const ARROWS_LEFT = Object.freeze({ movement: "arrows", padSide: "left" });

test("ARROW_PAD_COPY: the four TalkBack labels and the pad's own name, frozen", () => {
  assert.equal(ARROW_PAD_COPY.N, "Step north");
  assert.equal(ARROW_PAD_COPY.E, "Step east");
  assert.equal(ARROW_PAD_COPY.S, "Step south");
  assert.equal(ARROW_PAD_COPY.W, "Step west");
  assert.equal(typeof ARROW_PAD_COPY.pad, "string");
  assert.ok(ARROW_PAD_COPY.pad.length > 0);
  assert.ok(Object.isFrozen(ARROW_PAD_COPY));
});

test("ARROW_PAD_DIRS: N, E, S, W in a cross (row/column 1-3), frozen", () => {
  assert.deepEqual(
    ARROW_PAD_DIRS.map((d) => d.dir),
    ["N", "E", "S", "W"],
  );
  const at = Object.fromEntries(ARROW_PAD_DIRS.map((d) => [d.dir, [d.row, d.col]]));
  assert.deepEqual(at, { N: [1, 2], E: [2, 3], S: [3, 2], W: [2, 1] });
  assert.ok(Object.isFrozen(ARROW_PAD_DIRS));
  for (const d of ARROW_PAD_DIRS) assert.ok(Object.isFrozen(d));
});

test("arrowPadModel: arrow mode with the map open shows the pad on the chosen side", () => {
  const right = arrowPadModel(ARROWS_RIGHT, OPEN);
  assert.equal(right.mode, "arrows");
  assert.equal(right.visible, true);
  assert.equal(right.side, "right");
  assert.equal(right.label, ARROW_PAD_COPY.pad);
  const left = arrowPadModel(ARROWS_LEFT, OPEN);
  assert.equal(left.visible, true);
  assert.equal(left.side, "left");
});

test("arrowPadModel: four buttons N, E, S, W, each labelled from ARROW_PAD_COPY", () => {
  const model = arrowPadModel(ARROWS_RIGHT, OPEN);
  assert.deepEqual(
    model.buttons.map((b) => [b.dir, b.label]),
    [
      ["N", "Step north"],
      ["E", "Step east"],
      ["S", "Step south"],
      ["W", "Step west"],
    ],
  );
  for (const b of model.buttons) {
    assert.ok(typeof b.glyph === "string" && b.glyph.length > 0, `${b.dir} has a glyph`);
    assert.ok(Number.isInteger(b.row) && Number.isInteger(b.col));
  }
});

test("arrowPadModel: tap mode (the default) hides the pad", () => {
  const model = arrowPadModel({ movement: "tap", padSide: "left" }, OPEN);
  assert.equal(model.mode, "tap");
  assert.equal(model.visible, false);
  assert.equal(model.side, "left", "the side still follows padSide, ready for a switch");
});

test("arrowPadModel: unknown or missing settings give the tap-mode model (hidden, default side)", () => {
  for (const settings of [undefined, null, {}, { movement: "hover" }, { movement: "ARROWS" }, { movement: 1, padSide: 7 }, "arrows"]) {
    const model = arrowPadModel(settings, OPEN);
    assert.equal(model.mode, "tap", `${JSON.stringify(settings)} reads as tap`);
    assert.equal(model.visible, false);
    assert.equal(model.side, ARROW_PAD_DEFAULT_SIDE);
  }
  assert.equal(ARROW_PAD_DEFAULT_SIDE, "right");
  // An unknown side alone falls back to the default side.
  assert.equal(arrowPadModel({ movement: "arrows", padSide: "centre" }, OPEN).side, "right");
});

test("arrowPadModel: hidden exactly when map taps are inert — dead, an encounter, a sheet, or no run", () => {
  for (const key of ["dead", "encounter", "sheet"]) {
    const model = arrowPadModel(ARROWS_RIGHT, { ...OPEN, [key]: true });
    assert.equal(model.visible, false, `${key} hides the pad`);
    assert.equal(model.mode, "arrows", `${key} keeps arrow mode (the pad returns afterwards)`);
  }
  assert.equal(arrowPadModel(ARROWS_RIGHT, { ...OPEN, run: false }).visible, false, "no run hides the pad");
  assert.equal(arrowPadModel(ARROWS_RIGHT, undefined).visible, false, "no context hides the pad");
  assert.equal(arrowPadModel(ARROWS_RIGHT, null).visible, false);
});

test("arrowPad.js is pure: no DOM, window, timers or storage", () => {
  const src = fs.readFileSync(new URL("../../src/browser/arrowPad.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const banned of [/\bdocument\b/, /\bwindow\b/, /\bsetTimeout\b/, /\blocalStorage\b/, /\bimport\b/]) {
    assert.doesNotMatch(code, banned);
  }
});
