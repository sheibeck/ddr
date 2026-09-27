// test/unit/slider-gesture.test.js
//
// Phase 78 (HUD-05), Plan 02 — a volume slider moves ONLY on a deliberate
// sideways drag that starts on its track, or on a tap on the track. The
// 2026-09-24 device report: a vertical drag that began on a MASTER / MUSIC /
// EFFECTS slider scrubbed the volume while the player was only scrolling
// the Settings sheet.
//
// src/browser/sliderGesture.js is the pure decision: a classifier (pending
// until past SLIDER_SLOP_PX, then horizontal only when |dx| > |dy| strictly),
// a track-position-to-value map, and a gesture state machine that returns
// an effect — live, commit or restore — for the shell to act on. The last
// block pins the shell wiring by source.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  SLIDER_SLOP_PX,
  SLIDER_IDLE,
  classifySliderGesture,
  sliderValueAt,
  sliderGestureNext,
} from "../../src/browser/sliderGesture.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "sliderGesture.js"), "utf8");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

// ─── the classifier ────────────────────────────────────────────────────────

test("HUD-05 classifier: SLIDER_SLOP_PX is 8 and the threshold itself is still pending", () => {
  assert.equal(SLIDER_SLOP_PX, 8);
  assert.equal(classifySliderGesture(0, 0), "pending");
  assert.equal(classifySliderGesture(SLIDER_SLOP_PX, 0), "pending");
  assert.equal(classifySliderGesture(0, -SLIDER_SLOP_PX), "pending");
  assert.equal(classifySliderGesture(-SLIDER_SLOP_PX, SLIDER_SLOP_PX), "pending");
});

test("HUD-05 classifier: past the slop, strictly more sideways is horizontal; anything else is vertical, a tie included", () => {
  assert.equal(classifySliderGesture(SLIDER_SLOP_PX + 1, 0), "horizontal");
  assert.equal(classifySliderGesture(-20, 19), "horizontal");
  assert.equal(classifySliderGesture(0, SLIDER_SLOP_PX + 1), "vertical");
  assert.equal(classifySliderGesture(19, -20), "vertical");
  assert.equal(classifySliderGesture(12, 12), "vertical", "a tie is vertical");
  assert.equal(classifySliderGesture(-12, 12), "vertical", "a tie is vertical");
});

test("HUD-05 classifier: non-finite travel is pending (never a volume change)", () => {
  assert.equal(classifySliderGesture(NaN, 0), "pending");
  assert.equal(classifySliderGesture(Infinity, 0), "pending");
  assert.equal(classifySliderGesture(undefined, undefined), "pending");
});

// ─── the track map ─────────────────────────────────────────────────────────

const RECT = { left: 100, width: 200 };
const RANGE = { min: 0, max: 100, step: 1 };

test("HUD-05 sliderValueAt: left edge 0, right edge 100, centre 50, outside clamps", () => {
  assert.equal(sliderValueAt(100, RECT, RANGE), 0);
  assert.equal(sliderValueAt(300, RECT, RANGE), 100);
  assert.equal(sliderValueAt(200, RECT, RANGE), 50);
  assert.equal(sliderValueAt(0, RECT, RANGE), 0);
  assert.equal(sliderValueAt(999, RECT, RANGE), 100);
  assert.equal(sliderValueAt(151, RECT, RANGE), 26, "rounds to the step");
});

test("HUD-05 sliderValueAt: the defaults are 0-100 by 1, and an inset maps the thumb's travel", () => {
  assert.equal(sliderValueAt(200, RECT), 50);
  // A 28px thumb travels from left+14 to right-14 (a native range input).
  assert.equal(sliderValueAt(114, RECT, { ...RANGE, inset: 14 }), 0);
  assert.equal(sliderValueAt(286, RECT, { ...RANGE, inset: 14 }), 100);
  assert.equal(sliderValueAt(105, RECT, { ...RANGE, inset: 14 }), 0);
});

test("HUD-05 sliderValueAt: a zero-width rect or non-finite input is null", () => {
  assert.equal(sliderValueAt(100, { left: 100, width: 0 }, RANGE), null);
  assert.equal(sliderValueAt(100, { left: 100, width: 20 }, { ...RANGE, inset: 10 }), null);
  assert.equal(sliderValueAt(NaN, RECT, RANGE), null);
  assert.equal(sliderValueAt(150, { left: NaN, width: 200 }, RANGE), null);
  assert.equal(sliderValueAt(150, null, RANGE), null);
});

// ─── the state machine ─────────────────────────────────────────────────────

const down = (x, y, extra = {}) => ({ type: "down", pointerId: 1, x, y, startValue: 40, rect: RECT, range: RANGE, ...extra });
const move = (x, y, pointerId = 1) => ({ type: "move", pointerId, x, y });
const up = (x, y, pointerId = 1) => ({ type: "up", pointerId, x, y });
const cancel = (pointerId = 1) => ({ type: "cancel", pointerId });

function run(events) {
  let state = SLIDER_IDLE;
  const effects = [];
  for (const ev of events) {
    const next = sliderGestureNext(state, ev);
    state = next.state;
    if (next.effect) effects.push(next.effect);
  }
  return { state, effects };
}

test("HUD-05 machine: a tap (down, up, no travel) commits the tapped value", () => {
  const { state, effects } = run([down(250, 20), up(250, 20)]);
  assert.deepEqual(effects, [{ commit: 75 }]);
  assert.equal(state.phase, "idle");
});

test("HUD-05 machine: a tap within the slop still commits (tiny jitter is not a drag)", () => {
  const { effects } = run([down(250, 20), move(255, 25), up(255, 25)]);
  assert.deepEqual(effects, [{ commit: 78 }]);
});

test("HUD-05 machine: a sideways drag yields live values then ONE commit of the last value", () => {
  const { state, effects } = run([down(200, 20), move(220, 22), move(240, 21), move(260, 20), up(260, 20)]);
  assert.deepEqual(effects, [{ live: 60 }, { live: 70 }, { live: 80 }, { commit: 80 }]);
  assert.equal(state.phase, "idle");
});

test("HUD-05 machine: a drag that starts vertical restores the start value and never goes live or commits", () => {
  const { effects } = run([down(200, 20), move(203, 40), move(260, 45), move(290, 46), up(290, 46)]);
  assert.deepEqual(effects, [{ restore: 40 }], "vertical: one restore, then nothing — even when it later swings sideways");
  for (const e of effects) {
    assert.equal("commit" in e, false);
    assert.equal("live" in e, false);
  }
});

test("HUD-05 machine: a tie past the slop is vertical", () => {
  const { effects } = run([down(200, 20), move(212, 32), up(212, 32)]);
  assert.deepEqual(effects, [{ restore: 40 }]);
});

test("HUD-05 machine: pointercancel restores the start value and commits nothing; a later up is ignored", () => {
  const a = run([down(200, 20), move(240, 20), cancel(), up(240, 20)]);
  assert.deepEqual(a.effects, [{ live: 70 }, { restore: 40 }]);
  assert.equal(a.state.phase, "idle");
  const b = run([down(200, 20), cancel(), up(200, 20)]);
  assert.deepEqual(b.effects, [{ restore: 40 }]);
});

test("HUD-05 machine: a move or up with no matching down does nothing", () => {
  assert.deepEqual(run([move(240, 20), up(240, 20), cancel()]).effects, []);
  // A different pointer's move/up mid-gesture is ignored.
  const { effects } = run([down(200, 20), move(240, 20, 7), up(240, 20, 7), up(200, 20)]);
  assert.deepEqual(effects, [{ commit: 50 }]);
});

test("HUD-05 machine: a second pointer arriving mid-gesture cancels it (restore, no commit)", () => {
  const { state, effects } = run([down(200, 20), move(240, 20), down(260, 20, { pointerId: 2 }), move(280, 20), up(280, 20), up(260, 20, 2)]);
  assert.deepEqual(effects, [{ live: 70 }, { restore: 40 }]);
  assert.equal(state.phase, "idle");
});

test("HUD-05 machine: each gesture commits at most once", () => {
  const { effects } = run([down(200, 20), up(200, 20), up(200, 20), move(260, 20), up(260, 20)]);
  assert.equal(effects.filter((e) => "commit" in e).length, 1);
});

test("HUD-05 machine: an unusable down (no rect) never starts a gesture; an unknown event is ignored", () => {
  assert.deepEqual(run([down(200, 20, { rect: null }), up(200, 20)]).effects, []);
  const r = sliderGestureNext(SLIDER_IDLE, { type: "wiggle" });
  assert.equal(r.state, SLIDER_IDLE);
  assert.equal(r.effect, null);
});

test("HUD-05 machine: the idle state and returned states are frozen (pure, no mutation)", () => {
  assert.ok(Object.isFrozen(SLIDER_IDLE));
  const r = sliderGestureNext(SLIDER_IDLE, down(200, 20));
  assert.ok(Object.isFrozen(r.state));
  assert.equal(SLIDER_IDLE.phase, "idle");
});

// ─── purity ────────────────────────────────────────────────────────────────

test("HUD-05 purity: sliderGesture.js touches no DOM, window, timers or storage", () => {
  const code = SRC.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const banned of [/document\./, /window\./, /setTimeout|setInterval|requestAnimationFrame/, /localStorage|sessionStorage|storage\.js/, /\bimport\b/]) {
    assert.doesNotMatch(code, banned, `no ${banned}`);
  }
  assert.equal((SRC.match(/export function classifySliderGesture/g) || []).length, 1);
});

// ─── the shell wiring (source pins) ────────────────────────────────────────

test("HUD-05 shell: the range inputs take no pointer input; the row pans vertically natively", () => {
  const range = HTML.match(/^\.mw-vol-range\{[^}]*\}$/m);
  assert.ok(range, ".mw-vol-range rule");
  assert.match(range[0], /pointer-events:none/);
  const row = HTML.match(/^\.mw-vol-row\{[^}]*\}$/m);
  assert.ok(row, ".mw-vol-row rule");
  assert.match(row[0], /touch-action:pan-y/);
});

test("HUD-05 shell: the module imports the gesture module and feeds pointerdown/move/up/cancel through it", () => {
  assert.match(HTML, /import \{[^}]*sliderGestureNext[^}]*\} from "\.\/src\/browser\/sliderGesture\.js";/);
  for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
    assert.match(HTML, new RegExp(`getElementById\\("mw-vol-rows"\\)[\\s\\S]{0,4000}addEventListener\\("${ev}"`), `${ev} listener`);
  }
  // Effects route through the ONE live and ONE commit path the keyboard's
  // input/change listeners also use.
  assert.match(HTML, /effect\.live[\s\S]{0,200}volApplyLive\(/);
  assert.match(HTML, /effect\.commit[\s\S]{0,200}volCommit\(/);
  assert.match(HTML, /effect\.restore[\s\S]{0,200}volApplyLive\(/);
});

test("HUD-05 shell: exactly one range-input group exists in the shell (the three volume sliders)", () => {
  assert.equal((HTML.match(/type="range"/g) || []).length, 3);
});
