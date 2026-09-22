// test/unit/reduced-motion.test.js
//
// Phase 58's MOTION-05 ledger — one section per timed shell effect, each
// proving the effect reaches its end state SYNCHRONOUSLY, with nothing
// lost, whenever `prefers-reduced-motion: reduce` is in force — including
// a live flip of the OS preference mid-session. Plans 58-04..58-07 each
// append their own effect's section below the marker comment; 58-07's own
// audit checks every section named in MOTION-05's requirement text is
// present.
//
// Every test in this file drives test/unit/harness/shellSandbox.js's
// `loadShellSandbox({ doc, reducedMotion, clock })` — reduced-motion state
// lives entirely in that sandbox's own `matchMedia` stub (or a live
// reassignment of it, for the "flip mid-session" tests), never a
// hand-rolled predicate.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { keepInViewAxis } from "../../src/browser/controls.js";
import { REDUCED_MOTION_QUERY } from "../../src/browser/motion.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const RECT = Object.freeze({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600, x: 0, y: 0 });

function expectedTransformStr(camPoint, dpr = 1) {
  const tx = RECT.width / 2 - camPoint.x * CELL;
  const ty = RECT.height / 2 - camPoint.y * CELL;
  const X = Math.round(tx * dpr) / dpr;
  const Y = Math.round(ty * dpr) / dpr;
  return `translate3d(${X}px, ${Y}px, 0)`;
}

function buildScenario({ reducedMotion, clock = null } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock });
  sandbox.context.window.__mzControls = { keepInViewAxis };
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ ...RECT });
  const cv = doc.document.getElementById("maze");

  const state = newRun(1);
  state.floor.px = 40;
  state.floor.py = 40;
  sandbox.setState(state);

  return { sandbox, state, cv, context: sandbox.context };
}

/** Anchors cam on the party, then moves the party 6 cells left of that
 * anchor — inside EDGE_TRIGGER_CELLS of the (now-stale) left edge, so the
 * next keepPartyInView() call is genuinely owed a nudge. */
function triggerLeftEdgeNudge(scn) {
  scn.context.centerMap();
  const before = scn.context.partyCentre();
  scn.state.floor.px -= 6;
  const partyX = scn.state.floor.px + 0.5;
  const target = { x: keepInViewAxis(before.x, partyX, RECT.width / CELL), y: before.y };
  assert.notEqual(target.x, before.x, "scenario setup must actually trigger a nudge");
  return { before, target };
}

// ═══════════════════════════════════════════════════════════════════════
// ─── pan (MOTION-01, Plan 58-03) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("reduced-motion/pan: with the default (reduced) sandbox, keepPartyInView() lands cam on its target synchronously", () => {
  const scn = buildScenario({ reducedMotion: true });
  const { target } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false, "reduced motion must never leave a run in flight");
});

test("reduced-motion/pan: with the default (reduced) sandbox, glideCenterMap() lands cam on the party centre synchronously", () => {
  const scn = buildScenario({ reducedMotion: true });
  scn.context.positionCanvas(); // establish the {0,0} baseline transform
  const target = scn.context.partyCentre();

  scn.context.glideCenterMap();
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);
});

test("reduced-motion/pan: prefersReducedMotion is read LIVE — flipping the OS preference to reduced mid-session lands the very next nudge synchronously", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const { before, target: target1 } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  clock.advance(50);
  assert.equal(scn.context.window.__mzCameraGlide.active(), true, "the first nudge must still be easing (reducedMotion was false)");
  const midTransform = scn.cv.style.transform;
  assert.notEqual(midTransform, expectedTransformStr(before, 1));
  assert.notEqual(midTransform, expectedTransformStr(target1, 1));

  // Flip the stub's answer live — mirrors a real OS "Remove animations"
  // toggle firing mid-session. prefersReducedMotion(window) calls
  // window.matchMedia FRESH on every call (no caching, per motion.js's own
  // doc comment) — a plain reassignment of the sandbox's matchMedia is
  // therefore enough; no change-event/subscription plumbing is needed for
  // the classic camera path itself (only settleAllMotion's own module-
  // script subscription, covered by the source-anchor test below, needs
  // the change EVENT — the classic reads are call-time, always live).
  scn.context.window.matchMedia = (q) => ({
    matches: q === REDUCED_MOTION_QUERY,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  });

  // A second nudge is now owed (move the party further left, same as
  // map-pan.test.js's own retarget scenario).
  scn.state.floor.px -= 3;
  const partyX2 = scn.state.floor.px + 0.5;
  const target2 = { x: keepInViewAxis(target1.x, partyX2, RECT.width / CELL), y: target1.y };
  assert.notEqual(target2.x, target1.x, "scenario setup must actually trigger a second nudge");

  scn.context.keepPartyInView();
  // Landed SYNCHRONOUSLY — no clock.advance() call between the trigger and
  // this assertion.
  assert.equal(scn.cv.style.transform, expectedTransformStr(target2, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);

  // And nothing further ever lands, proving the run really did finish
  // rather than merely being mid-flight at a coincidentally-matching point.
  clock.advance(500);
  assert.equal(scn.cv.style.transform, expectedTransformStr(target2, 1));
});

test("reduced-motion/pan: source anchors — the camera instance reads prefersReducedMotion(window), settleAllMotion() finishes it, and the mid-session subscription is wired exactly once", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const glideIdx = stripped.indexOf("window.__mzCameraGlide = createCameraGlide(");
  assert.ok(glideIdx !== -1, "window.__mzCameraGlide = createCameraGlide( not found");
  const glideCloseIdx = stripped.indexOf(");", glideIdx);
  const glideCallSlice = stripped.slice(glideIdx, glideCloseIdx);
  assert.match(glideCallSlice, /reduced:\s*\(\)\s*=>\s*prefersReducedMotion\(window\)/);

  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /window\.__mzCameraGlide\?\.finish\?\.\(\);/);

  const subscribeMatches = stripped.match(/onReducedMotionChange\(window,/g) || [];
  assert.equal(subscribeMatches.length, 1, "onReducedMotionChange(window, must be wired exactly once");
});

// ═══════════════════════════════════════════════════════════════════════
// ─── panels (MOTION-02, Plan 58-04) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("reduced-motion/panels: with the default (reduced) sandbox, closeMarksLegend()/closeCampSheet() set hidden synchronously and write no data-motion", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const legend = doc.document.getElementById("mw-legend-sheet");
  sandbox.context.openMarksLegend();
  sandbox.context.closeMarksLegend();
  assert.equal(legend.hidden, true, "reduced motion must resolve the close synchronously");
  assert.equal(legend.dataset.motion, undefined);

  const camp = doc.document.getElementById("mw-camp-sheet");
  sandbox.context.openCampSheet();
  sandbox.context.closeCampSheet();
  assert.equal(camp.hidden, true);
  assert.equal(camp.dataset.motion, undefined);
});

test("reduced-motion/panels: with the default (reduced) sandbox, renderEncounter's close sets #enc-panel hidden synchronously with no data-motion", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const panel = doc.document.getElementById("enc-panel");
  sandbox.context.window.__mzStair = {};
  sandbox.context.renderEncounter();
  assert.equal(panel.hidden, false);

  sandbox.context.window.__mzStair = null;
  sandbox.context.renderEncounter();
  assert.equal(panel.hidden, true, "reduced motion must resolve the close synchronously");
  assert.equal(panel.dataset.motion, undefined);
});

test("reduced-motion/panels: with the default (reduced) sandbox, showTab's outgoing screen hides synchronously and writes no inline transform", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const maze = doc.document.getElementById("screen-maze");
  const hero = doc.document.getElementById("screen-hero");
  sandbox.context.window.__mzShowTab("hero");
  assert.equal(hero.hidden, false);
  assert.equal(maze.hidden, true, "reduced motion must hide the outgoing screen synchronously");
  assert.equal(maze.dataset.motion, undefined);
  assert.equal(maze.style.transform, "", "reduced motion must write no inline leaving transform");
});

test("reduced-motion/panels: source anchor — settleAllMotion()'s body drains the panel-close helper via panelMotion.finishAll()", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /panelMotion\.finishAll\(\);/);
});
