// test/unit/party-glide.test.js
//
// Phase 59 (ANIM-02), Plan 04 — the step glide's shell BEHAVIOUR proof:
// each genuine step glides the marker square to square over ~200ms
// (matching Phase 58's camera glide) while playing its step frames, settles
// to idle exactly on arrival, retargets from the currently-displayed point
// with no backward jump and no queue, stays in lockstep with a simultaneous
// camera nudge, self-heals off a stale target on a jump, and is untouched
// by a camera-only cancel (anchorCamOnParty, the pinch/snap path).
//
// Every test drives test/unit/harness/shellSandbox.js's
// loadShellSandbox({ doc, reducedMotion: false, clock }) — a real
// engine/state.js#newRun state, test/unit/harness/fakeClock.js's
// deterministic advance(ms), and the viewport's getBoundingClientRect
// overridden to a fixed 400x600 rect (mirroring map-pan.test.js/
// reduced-motion.test.js's own scenario shape). A "step" in these tests is
// exactly the sequence stepWith performs around its dispatch: read
// `from = partyShown()` BEFORE the state changes, then move the party to an
// open 4-neighbour and call `glideParty(from)` — never a real engine
// dispatch (this file proves presentation only, never rules).
//
// `cam`, `CELL`, `S` are classic-script `let`/`const` bindings — NOT
// vm-context-global properties (see map-pan.test.js's own header comment
// for why) — so `cam` is read back indirectly via `camFromPan()`, exactly
// mirroring map-pan.test.js's own `camFromPan` helper.

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { keepInViewAxis } from "../../src/browser/controls.js";
import { PAN_MS } from "../../src/browser/cameraGlide.js";
import { spriteBoxPx, stepFrameAt } from "../../src/browser/partySprite.js";

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const RECT = Object.freeze({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600, x: 0, y: 0 });

function transformXY(str) {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\)/.exec(str || "");
  assert.ok(m, `expected a translate3d(...) transform, got: ${JSON.stringify(str)}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

/**
 * buildScenario({ clock, dpr }) — a fresh sandbox, a real newRun(1) state,
 * the viewport rect overridden to RECT, and cam anchored on the party
 * (centerMap()) so every test starts from the same known baseline.
 */
function buildScenario({ clock = null, dpr = 1 } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  sandbox.context.window.__mzControls = { keepInViewAxis };
  sandbox.context.window.devicePixelRatio = dpr;
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ ...RECT });
  const cv = doc.document.getElementById("maze");
  const ring = doc.document.getElementById("mw-party-pulse");
  const sprite = doc.document.getElementById("mw-party-sprite");

  const state = newRun(1);
  sandbox.setState(state);
  sandbox.context.centerMap(); // cam = partyCentre() exactly — the known baseline

  return { sandbox, state, cv, ring, sprite, context: sandbox.context };
}

/** camFromPan(scn) — reconstructs the live `cam` indirectly, exactly like
 * map-pan.test.js's own helper: cam = partyCentre() - cameraPan()/CELL,
 * an identity that holds regardless of the party's current position. */
function camFromPan(scn) {
  const partyCentre = scn.context.partyCentre();
  const pan = scn.context.cameraPan();
  return { x: partyCentre.x - pan.x / CELL, y: partyCentre.y - pan.y / CELL };
}

function expectedSpriteBox(scn, shown, dpr = 1) {
  const cam = camFromPan(scn);
  return spriteBoxPx({ vw: RECT.width, vh: RECT.height, cam, shown, cell: CELL, pad: 0, dpr });
}

function spriteTransformStr(box) {
  return `translate3d(${box.x}px, ${box.y}px, 0)`;
}

/** openNeighbor(g, px, py) — the first open (non-wall) 4-neighbour of
 * (px,py), per this plan's discovery note ("a fresh floor starts at (1,1);
 * pick an open 4-neighbour to step to"). Direction order is fixed so the
 * chosen neighbour (and therefore the axis that changes) is deterministic
 * for a given floor. */
function openNeighbor(g, px, py) {
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]) {
    const nx = px + dx;
    const ny = py + dy;
    if (ny < 0 || ny >= g.length || nx < 0 || nx >= g[0].length) continue;
    if (!g[ny][nx].wall) return { x: nx, y: ny };
  }
  throw new Error("party-glide test: no open 4-neighbour found for the current cell");
}

/** anyOtherOpenCell(g, ax, ay) — any open cell other than (ax,ay), for the
 * "jump" test's simulated teleport (deliberately far, never a step). */
function anyOtherOpenCell(g, ax, ay) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y].length; x++) {
      if (!g[y][x].wall && (x !== ax || y !== ay)) return { x, y };
    }
  }
  throw new Error("party-glide test: no alternate open cell found");
}

/**
 * doStep(scn) — exactly the sequence stepWith performs around its
 * dispatch: read `from` BEFORE the state changes, move the party to an
 * open 4-neighbour, `setState` the clone, then `glideParty(from)`. Returns
 * { from, to }.
 */
function doStep(scn) {
  const from = scn.context.partyShown();
  const clone = structuredClone(scn.state);
  const nb = openNeighbor(clone.floor.g, clone.floor.px, clone.floor.py);
  clone.floor.px = nb.x;
  clone.floor.py = nb.y;
  scn.state = clone;
  scn.sandbox.setState(clone);
  scn.context.glideParty(from);
  return { from, to: scn.context.partyCentre() };
}

// ─── (1) a step glides ────────────────────────────────────────────────────

test("party-glide (1): a step glides — synchronously on the OLD cell in the step pose, strictly between the two cells at 100ms, exactly on the NEW cell (idle, no frame, nothing pending) at/after 200ms", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  const { from, to } = doStep(scn);

  const fromBox = expectedSpriteBox(scn, from);
  assert.equal(scn.sprite.style.transform, spriteTransformStr(fromBox), "synchronously on the OLD cell");
  assert.equal(scn.sprite.dataset.pose, "step");
  assert.equal(scn.sprite.dataset.frame, "1");

  clock.advance(100);
  const midXY = transformXY(scn.sprite.style.transform);
  const toBox = expectedSpriteBox(scn, to);
  const axis = fromBox.x !== toBox.x ? "x" : "y";
  const lo = Math.min(fromBox[axis], toBox[axis]);
  const hi = Math.max(fromBox[axis], toBox[axis]);
  assert.ok(midXY[axis] > lo && midXY[axis] < hi, `mid-glide ${axis} (${midXY[axis]}) must lie strictly between ${lo} and ${hi}`);

  clock.advance(PAN_MS - 100 + 16); // 200ms total plus one frame of slack
  const landedXY = transformXY(scn.sprite.style.transform);
  assert.ok(Math.abs(landedXY.x - toBox.x) < 1e-9, "must land exactly on the new cell (x)");
  assert.ok(Math.abs(landedXY.y - toBox.y) < 1e-9, "must land exactly on the new cell (y)");
  assert.equal(scn.sprite.dataset.pose, "idle");
  assert.equal(scn.sprite.dataset.frame, undefined);
  assert.equal(clock.pending(), 0);
});

// ─── (2) step frames ──────────────────────────────────────────────────────

test("party-glide (2): step frames — data-frame matches stepFrameAt(elapsed, 200) inside each of the four 50ms windows", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  doStep(scn);

  const samples = [25, 75, 125, 175]; // one representative elapsed value per 50ms window
  let elapsed = 0;
  for (const target of samples) {
    clock.advance(target - elapsed);
    elapsed = target;
    const expected = String(stepFrameAt(elapsed, PAN_MS));
    assert.equal(scn.sprite.dataset.frame, expected, `data-frame at elapsed ${elapsed}ms`);
  }
});

// ─── (3) retarget ─────────────────────────────────────────────────────────

test("party-glide (3): retarget — a second step at 100ms starts from the currently-displayed point (no backward jump), restarts data-frame at 1, and lands exactly on the SECOND cell 200ms after the retarget", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  doStep(scn);
  clock.advance(100);
  const midBeforeRetarget = transformXY(scn.sprite.style.transform);

  const second = doStep(scn);
  assert.equal(scn.sprite.dataset.frame, "1", "the retarget must restart the step frame at 1");
  const rightAfterRetarget = transformXY(scn.sprite.style.transform);
  assert.deepEqual(rightAfterRetarget, midBeforeRetarget, "no backward jump: the retarget must render exactly where the marker already was");

  clock.advance(PAN_MS + 16);
  const landedXY = transformXY(scn.sprite.style.transform);
  const toBox = expectedSpriteBox(scn, second.to);
  assert.ok(Math.abs(landedXY.x - toBox.x) < 1e-9, "must land exactly on the second cell (x)");
  assert.ok(Math.abs(landedXY.y - toBox.y) < 1e-9, "must land exactly on the second cell (y)");
  assert.equal(scn.sprite.dataset.pose, "idle");
  assert.equal(clock.pending(), 0);
});

// ─── (4) the glow follows ─────────────────────────────────────────────────

test("party-glide (4): the glow follows — the ring's left minus the sprite's x (and top minus y) stays constant across every sampled glide frame, within 1/devicePixelRatio", () => {
  const clock = createFakeClock();
  const dpr = 1;
  const scn = buildScenario({ clock, dpr });
  doStep(scn);

  function diffXY() {
    const ringXY = { x: parseFloat(scn.ring.style.left), y: parseFloat(scn.ring.style.top) };
    const spriteXY = transformXY(scn.sprite.style.transform);
    return { x: ringXY.x - spriteXY.x, y: ringXY.y - spriteXY.y };
  }

  const d0 = diffXY();
  let elapsed = 0;
  for (const step of [50, 50, 50, 66]) {
    clock.advance(step);
    elapsed += step;
    const d = diffXY();
    assert.ok(Math.abs(d.x - d0.x) <= 1 / dpr + 1e-9, `x offset drifted at elapsed ${elapsed}ms`);
    assert.ok(Math.abs(d.y - d0.y) <= 1 / dpr + 1e-9, `y offset drifted at elapsed ${elapsed}ms`);
  }
});

// ─── (5) marker and map together ───────────────────────────────────────────

/** triggerRightEdgeNudge(scn) — moves the party 6 cells right of the
 * anchored cam: with RECT's 400px width and CELL 28, this lands the party
 * inside EDGE_TRIGGER_CELLS (2) of the (now-stale) right edge, so the next
 * keepPartyInView() call is genuinely owed a rightward nudge. Mirrors
 * map-pan.test.js's own triggerLeftEdgeNudge, flipped. */
function triggerRightEdgeNudge(scn) {
  const before = scn.context.partyCentre(); // cam is already anchored here (buildScenario's centerMap())
  const clone = structuredClone(scn.state);
  clone.floor.px += 6;
  const partyX = clone.floor.px + 0.5;
  const target = { x: keepInViewAxis(before.x, partyX, RECT.width / CELL), y: before.y };
  assert.notEqual(target.x, before.x, "scenario setup must actually trigger a nudge");
  return { before, target, clone };
}

test("party-glide (5): marker and map move together — keepPartyInView() then glideParty(from) in the same tick keep the SAME eased progress on every frame", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  const from = scn.context.partyShown(); // === before, the sprite is at rest
  const { before: cam0, target: camTarget, clone } = triggerRightEdgeNudge(scn);

  scn.state = clone;
  scn.sandbox.setState(clone);
  const to = scn.context.partyCentre(); // the clone's new (real) cell

  scn.context.keepPartyInView();
  scn.context.glideParty(from);

  function progress() {
    const cam = camFromPan(scn);
    const shown = scn.context.partyShown();
    return {
      cam: (cam.x - cam0.x) / (camTarget.x - cam0.x),
      party: (shown.x - from.x) / (to.x - from.x),
    };
  }

  for (const step of [0, 50, 50, PAN_MS + 16]) {
    if (step) clock.advance(step);
    const p = progress();
    assert.ok(Math.abs(p.cam - p.party) < 1e-9, `camera/marker progress must match (cam=${p.cam}, party=${p.party})`);
  }

  const finalP = progress();
  assert.equal(finalP.cam, 1, "the camera must have fully landed");
  const finalBox = expectedSpriteBox(scn, to);
  assert.equal(scn.sprite.style.transform, spriteTransformStr(finalBox), "the sprite must be exactly on its cell at the end");
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);
  assert.equal(clock.pending(), 0);
});

// ─── (6) a jump ends a stale glide ─────────────────────────────────────────

test("party-glide (6): a jump ends a stale glide — window.mzCenterMap() lands the sprite on the teleported cell at once, idle; advancing the clock moves nothing further", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  const { to } = doStep(scn); // mid-glide toward `to`
  clock.advance(80); // still in flight

  // A simulated teleport: jumps never glide (stepWith's !jumped guard), so
  // this deliberately skips glideParty entirely and calls window.mzCenterMap
  // directly, exactly as stepWith's jumped branch does.
  const clone = structuredClone(scn.state);
  const far = anyOtherOpenCell(clone.floor.g, clone.floor.px, clone.floor.py);
  clone.floor.px = far.x;
  clone.floor.py = far.y;
  scn.state = clone;
  scn.sandbox.setState(clone);

  scn.context.window.mzCenterMap();

  const finalShown = scn.context.partyCentre(); // the real, teleported cell
  assert.notDeepEqual(finalShown, to, "sanity: the teleport target must differ from the stale glide's target");
  const box = expectedSpriteBox(scn, finalShown);
  assert.equal(scn.sprite.style.transform, spriteTransformStr(box));
  assert.equal(scn.sprite.dataset.pose, "idle");
  assert.equal(scn.sprite.dataset.frame, undefined);

  const settledTransform = scn.sprite.style.transform;
  clock.advance(PAN_MS + 32);
  assert.equal(scn.sprite.style.transform, settledTransform, "no stale frame may land after the jump self-healed the glide");
});

// ─── (7) a step mid-drag ────────────────────────────────────────────────────

test("party-glide (7): a step mid-drag — anchorCamOnParty (58-03's pinch/snap cancel-first path) never touches the marker's OWN step glide, which still lands exactly on its cell", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  const { to } = doStep(scn);
  clock.advance(50);
  assert.equal(scn.sprite.dataset.pose, "step", "sanity: still gliding before the drag");

  // Mirrors 58-03's own drag-start discipline: anchorCamOnParty cancels the
  // CAMERA glide as its first statement — window.__mzCameraGlide is a
  // DIFFERENT controller from window.__mzPartySprite; this must never
  // reach into (or crash) the party's own in-flight step glide.
  assert.doesNotThrow(() => scn.context.anchorCamOnParty({ x: 11, y: -7 }));

  clock.advance(PAN_MS - 50 + 16);
  const landedXY = transformXY(scn.sprite.style.transform);
  const box = expectedSpriteBox(scn, to);
  assert.ok(Math.abs(landedXY.x - box.x) < 1e-9);
  assert.ok(Math.abs(landedXY.y - box.y) < 1e-9);
  assert.equal(scn.sprite.dataset.pose, "idle");
});

// ─── (8) reentrancy safety (run convention 4) ──────────────────────────────
//
// KNOWN LATENT BUG (58-01/59-01, unmodified cameraGlide.js): step() reads
// its own closed-over `run` again immediately AFTER calling its `apply`
// callback — a synchronous glide.cancel()/glide.finish() call from WITHIN
// that callback throws. createPartySprite (59-01) already guards its own
// case (the inOnPoint/endGlide pattern) — these two tests prove THIS
// plan's shell wiring (glideParty/stepWith/window.mzPositionParty) never
// reaches that guard from a NEW angle: a retarget or a finish() triggered
// reentrantly from inside the controller's own render callback (a live
// frame update) must never throw.

test("party-glide (8): a retarget triggered reentrantly from within the render callback (an in-flight frame update) never throws", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  doStep(scn);

  let reentered = false;
  const originalRender = scn.context.window.mzPositionParty;
  scn.context.window.mzPositionParty = () => {
    originalRender();
    if (!reentered && scn.context.window.__mzPartySprite.active()) {
      reentered = true;
      const from2 = scn.context.partyShown();
      const clone2 = structuredClone(scn.state);
      const nb2 = openNeighbor(clone2.floor.g, clone2.floor.px, clone2.floor.py);
      clone2.floor.px = nb2.x;
      clone2.floor.py = nb2.y;
      scn.state = clone2;
      scn.sandbox.setState(clone2);
      scn.context.glideParty(from2); // reentrant, from inside cameraGlide.js's own step() call stack
    }
  };

  assert.doesNotThrow(() => clock.advance(400));
  assert.ok(reentered, "sanity: the reentrant retarget must actually have fired mid-flight");
});

test("party-glide (8b): finish() triggered reentrantly from within the render callback (an in-flight frame update) never throws (the settleAllMotion path)", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ clock });
  doStep(scn);

  let finishedOnce = false;
  const originalRender = scn.context.window.mzPositionParty;
  scn.context.window.mzPositionParty = () => {
    originalRender();
    if (!finishedOnce && scn.context.window.__mzPartySprite.active()) {
      finishedOnce = true;
      assert.doesNotThrow(() => scn.context.window.__mzPartySprite.finish());
    }
  };

  assert.doesNotThrow(() => clock.advance(400));
  assert.ok(finishedOnce, "sanity: the reentrant finish() must actually have fired mid-flight");
  assert.equal(scn.context.window.__mzPartySprite.active(), false);
});
