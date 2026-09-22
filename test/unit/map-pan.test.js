// test/unit/map-pan.test.js
//
// Phase 58 (MOTION-01) — sandbox BEHAVIOUR proof for the map camera's
// keep-in-view nudge and CENTRE glide: the nudge/CENTRE ease `cam` over
// window.__mzCameraGlide's ~200ms ease-out (D-01/D-04), a second nudge
// mid-flight re-aims from the glide's own in-flight target rather than
// freezing short, a snap (window.mzCenterMap) cancels an in-flight glide
// synchronously, and the canvas transform + the party ring stay in lockstep
// from the SAME positionCanvas() call. Every animated-path test here uses
// `loadShellSandbox({ doc, reducedMotion: false, clock })` — a real engine
// state from engine/state.js#newRun, the viewport's getBoundingClientRect
// overridden to a fixed 400x600 rect, and test/unit/harness/fakeClock.js's
// deterministic `advance(ms)` — never a real sleep.
//
// window.__mzControls is NOT one of shellSandbox.js#wireBridges' bridges
// (its own header comment lists it among the three snapshot surfaces'
// bridges deliberately left unwired) — this file wires it itself, directly
// from the real src/browser/controls.js#keepInViewAxis, exactly mirroring
// test/unit/rail-dismiss.test.js's own "wire one extra bridge myself"
// pattern for window.__mzRailVM.
//
// `cam`, `CELL`, `S`, `zoom` are classic-script `let`/`const` bindings —
// NOT vm-context-global properties (see rail-dismiss.test.js's own header
// comment for why) — so this file never reads them directly. It reads the
// camera indirectly, through the classic script's own exported functions
// (all plain `function` declarations, which ARE vm-context globals):
// partyCentre()/cameraPan() derive the live `cam` exactly (no rounding);
// the canvas element's own `style.transform` (read via the SAME recording
// document this file built, `doc.document.getElementById("maze")` — the
// identical object the classic script's own `const cv` closed over) is the
// one place `cam` is ever written out as CSS. CELL is the classic script's
// declared default (`let CELL = 28;`, mazeworld.html) — never recomputed by
// this harness since `fit()` (the only thing that reassigns it) is never
// called here.

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { keepInViewAxis } from "../../src/browser/controls.js";
import { glidePoint, PAN_MS } from "../../src/browser/cameraGlide.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const RECT = Object.freeze({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600, x: 0, y: 0 });

function transformXY(str) {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\)/.exec(str || "");
  assert.ok(m, `expected a translate3d(...) transform, got: ${JSON.stringify(str)}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

function expectedTransformStr(camPoint, dpr) {
  const tx = RECT.width / 2 - camPoint.x * CELL;
  const ty = RECT.height / 2 - camPoint.y * CELL;
  const X = Math.round(tx * dpr) / dpr;
  const Y = Math.round(ty * dpr) / dpr;
  return `translate3d(${X}px, ${Y}px, 0)`;
}

function approxEqual(a, b, msg, eps = 1e-6) {
  assert.ok(Math.abs(a - b) < eps, `${msg}: expected ${a} to be within ${eps} of ${b}`);
}

/**
 * buildScenario({ reducedMotion, clock, dpr }) — a fresh sandbox, a real
 * newRun(1) state (party pinned at floor {40,40} so every test starts from
 * the same deterministic position), the viewport rect overridden to
 * RECT, and window.__mzControls wired from the real keepInViewAxis.
 */
function buildScenario({ reducedMotion = false, clock = null, dpr = 1 } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock });
  sandbox.context.window.__mzControls = { keepInViewAxis };
  sandbox.context.window.devicePixelRatio = dpr;
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ ...RECT });
  const cv = doc.document.getElementById("maze");
  const ring = doc.document.getElementById("mw-party-pulse");

  const state = newRun(1);
  state.floor.px = 40;
  state.floor.py = 40;
  sandbox.setState(state);

  return { sandbox, state, cv, ring, context: sandbox.context };
}

/**
 * triggerLeftEdgeNudge(scn) — anchors cam on the party (the SNAP), then
 * moves the party 6 cells left of that anchor: with RECT's 400px width and
 * CELL 28, the party lands 1.14 cells from the (now-stale) left edge —
 * inside EDGE_TRIGGER_CELLS (2) — so the next keepPartyInView() call is
 * genuinely owed a leftward nudge. Returns { before, target }.
 */
function triggerLeftEdgeNudge(scn) {
  scn.context.centerMap();
  const before = scn.context.partyCentre();
  scn.state.floor.px -= 6;
  const partyX = scn.state.floor.px + 0.5;
  const target = { x: keepInViewAxis(before.x, partyX, RECT.width / CELL), y: before.y };
  assert.notEqual(target.x, before.x, "scenario setup must actually trigger a nudge");
  return { before, target };
}

// ─── (1) a nudge glides ─────────────────────────────────────────────────

test("map-pan (1): keepPartyInView() glides cam to its target over ~200ms ease-out, not synchronously", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const { before, target } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  assert.equal(scn.cv.style.transform, expectedTransformStr(before, 1), "cam must not land on the target synchronously");
  assert.equal(scn.context.window.__mzCameraGlide.active(), true);

  clock.advance(100);
  const mid = glidePoint(before, target, 100 / PAN_MS);
  assert.equal(scn.cv.style.transform, expectedTransformStr(mid, 1), "cam must lie at the eased midpoint at 100ms");
  assert.notEqual(mid.x, before.x);
  assert.notEqual(mid.x, target.x);

  clock.advance(PAN_MS - 100 + 16); // 200ms plus one frame of slack
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1), "cam must equal keepInViewAxis's target exactly");
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);
});

// ─── (2) a second nudge mid-flight re-aims from the displayed camera ────

test("map-pan (2): a second nudge mid-flight re-aims from the glide's in-flight TARGET (no backward jump), landing on the new target 200ms later", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const { before, target: target1 } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  clock.advance(100);
  const mid1 = glidePoint(before, target1, 100 / PAN_MS);
  assert.equal(scn.cv.style.transform, expectedTransformStr(mid1, 1));

  // Find a party position that is genuinely distinguishing: NOT owed a
  // nudge relative to target1 (the glide's own in-flight destination — the
  // correct base) but WOULD be owed one relative to mid1 (the currently-
  // displayed, only-halfway-there camera — the wrong base a bug might
  // read instead). Once triggered, keepInViewAxis's returned value doesn't
  // depend on the base at all (only on partyAxis/rest/half) — so the ONLY
  // way base can be observed to matter is through this trigger/no-trigger
  // boundary. A correct base=target1 implementation therefore schedules
  // NOTHING new here (target === base) and the ALREADY-in-flight glide
  // keeps sailing to target1 undisturbed; a buggy base=mid1 implementation
  // would instead schedule a brand new glide toward a different value.
  const span = RECT.width / CELL;
  const half = span / 2;
  let partyX2 = null;
  for (let candidate = target1.x - half; candidate <= target1.x + half; candidate += 0.01) {
    const viaTarget1 = keepInViewAxis(target1.x, candidate, span);
    const viaMid1 = keepInViewAxis(mid1.x, candidate, span);
    if (viaTarget1 === target1.x && viaMid1 !== mid1.x) {
      partyX2 = candidate;
      break;
    }
  }
  assert.ok(partyX2 !== null, "could not find a distinguishing party position — scenario tuning needed");
  scn.state.floor.px = partyX2 - 0.5;

  scn.context.keepPartyInView();
  // No backward jump: cam is still exactly at mid1 immediately after the
  // second call (whether or not anything new was scheduled, no frame has
  // run yet).
  assert.equal(scn.cv.style.transform, expectedTransformStr(mid1, 1));

  clock.advance(PAN_MS + 16);
  assert.equal(
    scn.cv.style.transform,
    expectedTransformStr(target1, 1),
    "the already-in-flight glide must sail on to target1 undisturbed — proving the second call's base was the in-flight TARGET, not the displayed camera",
  );
});

// ─── (3) a nudge that is not owed schedules nothing ──────────────────────

test("map-pan (3): a nudge that is not owed (party mid-viewport) schedules nothing and leaves cam untouched", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  scn.context.centerMap(); // cam = partyCentre exactly — no edge is near
  const before = scn.context.partyCentre();
  const beforeTransform = scn.cv.style.transform;
  assert.equal(beforeTransform, expectedTransformStr(before, 1));

  scn.context.keepPartyInView();
  assert.equal(scn.cv.style.transform, beforeTransform, "cam must be untouched");
  assert.equal(scn.context.window.__mzCameraGlide.active(), false, "nothing must be scheduled");
  assert.equal(clock.pending(), 0);
});

// ─── (4) window.mzCenterMap() mid-glide snaps synchronously ─────────────

test("map-pan (4): window.mzCenterMap() mid-glide snaps cam to the party centre synchronously; advancing the clock applies no further frame", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  triggerLeftEdgeNudge(scn);
  scn.context.keepPartyInView();
  clock.advance(50);
  assert.equal(scn.context.window.__mzCameraGlide.active(), true, "the glide must still be in flight");

  scn.context.window.mzCenterMap();
  const snappedTo = scn.context.partyCentre();
  const snappedTransform = expectedTransformStr(snappedTo, 1);
  assert.equal(scn.cv.style.transform, snappedTransform, "centerMap must snap cam to the party centre synchronously");
  assert.equal(scn.context.window.__mzCameraGlide.active(), false, "the snap must cancel the in-flight glide");
  assert.equal(clock.pending(), 0, "no frame/timer may remain scheduled after the snap");

  clock.advance(PAN_MS + 16);
  assert.equal(scn.cv.style.transform, snappedTransform, "no further frame may land after the snap cancelled the glide");
});

// ─── (5) glideCenterMap() glides to the party centre over 200ms ─────────

test("map-pan (5): glideCenterMap() glides cam to the party centre over ~200ms ease-out", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  // cam starts at its classic-script default {x:0,y:0} — never touched yet
  // in this fresh sandbox. Call positionCanvas() once directly to establish
  // a known baseline transform (nothing else has painted yet).
  scn.context.positionCanvas();
  const before = { x: 0, y: 0 };
  const target = scn.context.partyCentre(); // {40.5, 40.5}
  assert.equal(scn.cv.style.transform, expectedTransformStr(before, 1));

  scn.context.glideCenterMap();
  assert.equal(scn.cv.style.transform, expectedTransformStr(before, 1), "must not land synchronously");

  clock.advance(100);
  const mid = glidePoint(before, target, 100 / PAN_MS);
  assert.equal(scn.cv.style.transform, expectedTransformStr(mid, 1));

  clock.advance(PAN_MS - 100 + 16);
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);
});

// ─── (6) the pointerdown cancel ──────────────────────────────────────────
//
// recordingDom.js's addEventListener is an unconditional no-op (never
// records a listener) and is out of this plan's files_modified — extending
// it would risk moving test/unit/shell-tab-snapshots.test.js's committed
// fixture output (its own header comment names this exact risk). This test
// therefore takes the plan's documented "otherwise" route: a source-anchor
// proof, on the real shipped mazeworld.html, that the viewport's
// pointerdown handler's FIRST statement cancels the glide — the cancel's
// own behaviour (freezing `run` exactly where it is) is already pinned by
// test/unit/camera-glide.test.js's cancel() coverage.

test("map-pan (6): the viewport pointerdown handler's first statement cancels the camera glide (source anchor — see this test's own header note)", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const marker = 'vp.addEventListener("pointerdown"';
  const pdStart = stripped.indexOf(marker);
  assert.ok(pdStart !== -1, "viewport pointerdown listener not found");
  const pmStart = stripped.indexOf('vp.addEventListener("pointermove"', pdStart);
  assert.ok(pmStart !== -1 && pmStart > pdStart, "viewport pointermove listener not found after pointerdown");
  const region = stripped.slice(pdStart, pmStart);
  const cancelIdx = region.indexOf("window.__mzCameraGlide?.cancel?.();");
  const encounterIdx = region.indexOf("hasActiveEncounter()");
  assert.ok(cancelIdx !== -1, "pointerdown handler must cancel the camera glide");
  assert.ok(encounterIdx !== -1, "pointerdown handler must still guard on hasActiveEncounter()");
  assert.ok(cancelIdx < encounterIdx, "the cancel must be the FIRST statement — before every other guard");
});

// ─── (7) positionCanvas() rounds to whole device pixels; the ring stays ──
// ─── in lockstep from the SAME call ──────────────────────────────────────

test("map-pan (7): positionCanvas() writes a translate3d whose px values are whole multiples of 1/devicePixelRatio (dpr 2.625, the Pixel 7's); the ring's left/top equal viewport-centre-plus-cameraPan() from the SAME call", () => {
  const dpr = 2.625; // the Pixel 7's devicePixelRatio
  const scn = buildScenario({ reducedMotion: true, dpr });
  // An arbitrary, non-cell-aligned anchor offset so tx/ty land on a
  // fractional CSS px before rounding — a real proof of the rounding step,
  // not a coincidental whole-pixel value.
  scn.context.anchorCamOnParty({ x: 37, y: -19 });
  scn.context.positionCanvas();

  const { x: tx, y: ty } = transformXY(scn.cv.style.transform);
  approxEqual(Math.round(tx * dpr), tx * dpr, "tx must be a whole multiple of 1/devicePixelRatio");
  approxEqual(Math.round(ty * dpr), ty * dpr, "ty must be a whole multiple of 1/devicePixelRatio");
  assert.equal(scn.cv.style.transform, expectedTransformStr(camFromPan(scn), dpr), "the transform must match the exact rounding formula");

  const p = scn.context.cameraPan();
  const expectedLeft = `${RECT.width / 2 + p.x - CELL / 2}px`;
  const expectedTop = `${RECT.height / 2 + p.y - CELL / 2}px`;
  assert.equal(scn.ring.style.left, expectedLeft);
  assert.equal(scn.ring.style.top, expectedTop);
});

function camFromPan(scn) {
  const partyCentre = scn.context.partyCentre();
  const pan = scn.context.cameraPan();
  return { x: partyCentre.x - pan.x / CELL, y: partyCentre.y - pan.y / CELL };
}
