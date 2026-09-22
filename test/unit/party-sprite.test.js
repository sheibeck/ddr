// test/unit/party-sprite.test.js
//
// Phase 59 (ANIM-01/02/03), Plan 01 — pins src/browser/partySprite.js's
// pure presentation core: the idle/step frame schedule, the canvas-
// lockstep placement math, the art-fallback choice (Task 1), and the
// retargetable step-glide controller built on Phase 58's camera glide
// (Task 2). One named test per <behavior> bullet in 59-01-PLAN.md, plus
// the stripped-source checks (no window/document/matchMedia reads, single
// import specifier).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  PARTY_FRAME_ICONS,
  IDLE_FRAMES,
  IDLE_FRAME_MS,
  IDLE_CYCLE_MS,
  STEP_FRAMES,
  STEP_GLIDE_MS,
  idleFrameDelaysMs,
  stepFrameAt,
  snapToDevicePx,
  spriteBoxPx,
  spriteArt,
  createPartySprite,
} from "../../src/browser/partySprite.js";
import { PAN_MS, easeOutCubic } from "../../src/browser/cameraGlide.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── 1. constants: frame schedule ──────────────────────────────────────────

test("constants: IDLE_FRAMES/IDLE_FRAME_MS/IDLE_CYCLE_MS/STEP_FRAMES/STEP_GLIDE_MS pin the frame schedule; STEP_GLIDE_MS is PAN_MS", () => {
  assert.equal(IDLE_FRAMES, 4);
  assert.equal(IDLE_FRAME_MS, 280);
  assert.equal(IDLE_CYCLE_MS, 1120);
  assert.equal(IDLE_CYCLE_MS, IDLE_FRAMES * IDLE_FRAME_MS);
  assert.equal(STEP_FRAMES, 4);
  assert.equal(STEP_GLIDE_MS, PAN_MS);
  assert.equal(STEP_GLIDE_MS, 200);
});

// ─── 2. PARTY_FRAME_ICONS ───────────────────────────────────────────────────

test("PARTY_FRAME_ICONS: exactly the 8 shipped frame stems, idle 1..4 then step 1..4, each backed by a real PNG in icons/optimized/", () => {
  assert.deepEqual(PARTY_FRAME_ICONS, [
    "party_idle_1",
    "party_idle_2",
    "party_idle_3",
    "party_idle_4",
    "party_step_1",
    "party_step_2",
    "party_step_3",
    "party_step_4",
  ]);
  assert.equal(Object.isFrozen(PARTY_FRAME_ICONS), true);
  for (const stem of PARTY_FRAME_ICONS) {
    const p = path.join(REPO_ROOT, "icons", "optimized", `${stem}.png`);
    assert.ok(fs.existsSync(p), `missing icon file: icons/optimized/${stem}.png`);
  }
});

// ─── 3. idleFrameDelaysMs ────────────────────────────────────────────────────

test("idleFrameDelaysMs(): returns [0,-840,-560,-280]", () => {
  assert.deepEqual(idleFrameDelaysMs(), [0, -840, -560, -280]);
});

test("idleFrameDelaysMs(): returns a fresh array each call", () => {
  const a = idleFrameDelaysMs();
  const b = idleFrameDelaysMs();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});

test("idleFrameDelaysMs(): the 4 frames tile the 1120ms cycle with no gap and no overlap, sampled every 10ms", () => {
  const delays = idleFrameDelaysMs();
  for (let t = 0; t < IDLE_CYCLE_MS; t += 10) {
    const visible = [];
    for (let k = 1; k <= IDLE_FRAMES; k++) {
      const delay = delays[k - 1];
      const phase = ((t - delay) % IDLE_CYCLE_MS + IDLE_CYCLE_MS) % IDLE_CYCLE_MS;
      if (phase >= 0 && phase < IDLE_FRAME_MS) visible.push(k);
    }
    assert.equal(visible.length, 1, `t=${t}: expected exactly one visible frame, got [${visible.join(",")}]`);
    const expectedFrame = Math.floor(t / IDLE_FRAME_MS) + 1;
    assert.equal(visible[0], expectedFrame, `t=${t}: expected frame ${expectedFrame} visible, got ${visible[0]}`);
  }
});

// ─── 4. stepFrameAt ──────────────────────────────────────────────────────────

test("stepFrameAt: pins boundary values, negative elapsed, non-positive duration, and the default frames arg", () => {
  assert.equal(stepFrameAt(0, 200, 4), 1);
  assert.equal(stepFrameAt(49, 200, 4), 1);
  assert.equal(stepFrameAt(50, 200, 4), 2);
  assert.equal(stepFrameAt(149, 200, 4), 3);
  assert.equal(stepFrameAt(150, 200, 4), 4);
  assert.equal(stepFrameAt(199, 200, 4), 4);
  assert.equal(stepFrameAt(500, 200, 4), 4);
  assert.equal(stepFrameAt(-5, 200, 4), 1);
  assert.equal(stepFrameAt(10, 0, 4), 4);
  // default frames arg is STEP_FRAMES
  assert.equal(stepFrameAt(50, 200), stepFrameAt(50, 200, STEP_FRAMES));
  assert.equal(stepFrameAt(50, 200), 2);
});

test("stepFrameAt: non-finite elapsed/duration are handled per the total contract", () => {
  assert.equal(stepFrameAt(NaN, 200, 4), 1);
  assert.equal(stepFrameAt(50, NaN, 4), 4);
  assert.equal(stepFrameAt(50, -1, 4), 4);
});

// ─── 5. snapToDevicePx ────────────────────────────────────────────────────────

test("snapToDevicePx: matches Math.round(v*dpr)/dpr; non-finite/non-positive dpr behaves as 1", () => {
  assert.equal(snapToDevicePx(-94, 2.625), Math.round(-94 * 2.625) / 2.625);
  assert.equal(snapToDevicePx(12.3, 1), 12);
  assert.equal(snapToDevicePx(12.3, NaN), Math.round(12.3));
  assert.equal(snapToDevicePx(12.3, 0), Math.round(12.3));
  assert.equal(snapToDevicePx(12.3, -2), Math.round(12.3));
  assert.equal(snapToDevicePx(12.3, Infinity), Math.round(12.3));
});

// ─── 6. spriteBoxPx ────────────────────────────────────────────────────────────

test("spriteBoxPx: places the sprite in lockstep with the canvas's own rounded origin", () => {
  const box = spriteBoxPx({
    vw: 400,
    vh: 600,
    cam: { x: 10.5, y: 7.25 },
    shown: { x: 11.5, y: 9.5 },
    cell: 28,
    pad: 0,
    dpr: 2.625,
  });
  const expectedX = snapToDevicePx(200 - 294, 2.625) + 11 * 28;
  const expectedY = snapToDevicePx(300 - 203, 2.625) + 9 * 28;
  assert.equal(box.x, expectedX);
  assert.equal(box.y, expectedY);
  assert.equal(box.size, 28);
});

test("spriteBoxPx: at dpr 1 with an integer origin, x/y equal the ring's own formula (vw/2 + (shown-cam)*cell - cell/2)", () => {
  const vw = 400, vh = 600, cell = 28;
  const cam = { x: 10, y: 7 };
  const shown = { x: 11, y: 9 };
  const box = spriteBoxPx({ vw, vh, cam, shown, cell, pad: 0, dpr: 1 });
  const ringX = vw / 2 + (shown.x - cam.x) * cell - cell / 2;
  const ringY = vh / 2 + (shown.y - cam.y) * cell - cell / 2;
  assert.equal(box.x, ringX);
  assert.equal(box.y, ringY);
});

test("spriteBoxPx: a mid-glide 'shown' gives an x strictly between the two rest positions", () => {
  const vw = 400, vh = 600, cell = 28;
  const cam = { x: 10, y: 7 };
  const restA = spriteBoxPx({ vw, vh, cam, shown: { x: 11, y: 9 }, cell, dpr: 1 });
  const restB = spriteBoxPx({ vw, vh, cam, shown: { x: 12, y: 9 }, cell, dpr: 1 });
  const mid = spriteBoxPx({ vw, vh, cam, shown: { x: 11.2, y: 9 }, cell, dpr: 1 });
  assert.ok(mid.x > restA.x && mid.x < restB.x, `mid.x=${mid.x} not strictly between ${restA.x} and ${restB.x}`);
});

// ─── 7. spriteArt ────────────────────────────────────────────────────────────

test("spriteArt: 'frames' when all 8 frames decoded", () => {
  assert.equal(spriteArt({ framesReady: new Array(8).fill(true), staticReady: true }), "frames");
  assert.equal(spriteArt({ framesReady: new Array(8).fill(true), staticReady: false }), "frames");
});

test("spriteArt: any false frame (or a wrong-length array) falls back to 'static' when staticReady, else 'none'", () => {
  const oneFalse = new Array(8).fill(true);
  oneFalse[3] = false;
  assert.equal(spriteArt({ framesReady: oneFalse, staticReady: true }), "static");
  assert.equal(spriteArt({ framesReady: oneFalse, staticReady: false }), "none");

  const shortArray = new Array(7).fill(true);
  assert.equal(spriteArt({ framesReady: shortArray, staticReady: true }), "static");
  assert.equal(spriteArt({ framesReady: shortArray, staticReady: false }), "none");

  const longArray = new Array(9).fill(true);
  assert.equal(spriteArt({ framesReady: longArray, staticReady: true }), "static");

  assert.equal(spriteArt({ framesReady: null, staticReady: true }), "static");
  assert.equal(spriteArt({ framesReady: undefined, staticReady: false }), "none");
});

// ─── createPartySprite: Task 2 ─────────────────────────────────────────────
//
// Driven by createFakeClock (test/unit/harness/fakeClock.js, landed 58-03).
// makeController() wires a fresh fake clock + a render spy that records the
// controller's own state (and, when `extra` is given, a caller-chosen probe
// such as `displayed(to).x`) on every render call.

function makeController({ reduced = () => false, durationMs = 200, extra = () => undefined } = {}) {
  const clock = createFakeClock();
  const renderLog = [];
  let controller;
  const render = () => {
    renderLog.push({
      t: clock.now(),
      pose: controller.pose(),
      frame: controller.frame(),
      active: controller.active(),
      extra: extra(controller),
    });
  };
  controller = createPartySprite({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced,
    render,
    durationMs,
  });
  return { clock, controller, renderLog };
}

test("createPartySprite: stepTo() (reduced false) renders exactly once synchronously; at that moment (read from WITHIN the render callback itself, like the real shell's call site) displayed(to) reads the 'from' point, pose 'step', frame 1, active true", () => {
  const from = { x: 1.5, y: 1.5 };
  const to = { x: 2.5, y: 1.5 };
  // `extra` reads displayed(to) FROM INSIDE the render callback, exactly
  // like the shell's real render() will (positionPartySprite reads
  // sprite.displayed(realPos) from inside the render it was handed) — this
  // is what makes the "glide started before render" ordering observable:
  // if glide.to() has not yet run when render() fires, glide.active() is
  // still false and displayed() would wrongly self-heal to `to` instead of
  // returning `from`.
  const { controller, renderLog } = makeController({
    reduced: () => false,
    extra: (c) => c.displayed(to),
  });
  controller.stepTo(from, to);
  assert.equal(renderLog.length, 1);
  assert.deepEqual(renderLog[0].extra, from);
  assert.equal(controller.pose(), "step");
  assert.equal(controller.frame(), 1);
  assert.equal(controller.active(), true);
});

test("createPartySprite: advancing the clock moves displayed().x monotonically, strictly between 'from' and 'to' before landing, and frame() matches stepFrameAt at every applied frame", () => {
  const from = { x: 1.5, y: 1.5 };
  const to = { x: 2.5, y: 1.5 };
  const { clock, controller, renderLog } = makeController({
    reduced: () => false,
    extra: (c) => c.displayed(to).x,
  });
  controller.stepTo(from, to);
  renderLog.length = 0; // drop the synchronous stepTo render

  clock.advance(200);

  assert.ok(renderLog.length > 0);
  for (let i = 1; i < renderLog.length; i++) {
    assert.ok(renderLog[i].extra >= renderLog[i - 1].extra, `render ${i} moved backward: ${renderLog[i].extra} < ${renderLog[i - 1].extra}`);
  }
  for (let i = 0; i < renderLog.length - 1; i++) {
    assert.ok(
      renderLog[i].extra > 1.5 && renderLog[i].extra < 2.5,
      `intermediate render ${i} not strictly between bounds: ${renderLog[i].extra}`,
    );
  }
  // frame() at every render (t0 = 0, since stepTo ran at clock time 0)
  for (const entry of renderLog) {
    const expectedFrame = entry === renderLog[renderLog.length - 1] ? 0 : stepFrameAt(entry.t, 200, 4);
    assert.equal(entry.frame, expectedFrame, `t=${entry.t}: expected frame ${expectedFrame}, got ${entry.frame}`);
  }
});

test("createPartySprite: the first frame at or after 200ms lands displayed(to) exactly on target, active false, idle, frame 0, one render, nothing pending", () => {
  const from = { x: 1.5, y: 1.5 };
  const to = { x: 2.5, y: 1.5 };
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  controller.stepTo(from, to);
  renderLog.length = 0;

  clock.advance(200);

  assert.deepEqual(controller.displayed(to), to);
  assert.equal(controller.active(), false);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.frame(), 0);
  assert.equal(renderLog[renderLog.length - 1].pose, "idle");
  assert.equal(clock.pending(), 0);
});

test("createPartySprite: retargeting mid-flight re-aims from the displayed point, never jumps backward, resets frame to 1, and lands exactly on the new target 200ms after the retarget", () => {
  const A = { x: 1.5, y: 1.5 };
  const B = { x: 2.5, y: 1.5 };
  const C = { x: 4.5, y: 1.5 };
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  controller.stepTo(A, B);
  clock.advance(100);
  const midB = controller.displayed(B);
  assert.ok(midB.x > A.x && midB.x < B.x);

  renderLog.length = 0;
  controller.stepTo(midB, C);
  assert.equal(renderLog.length, 1); // the synchronous retarget render
  const afterRetarget = controller.displayed(C);
  assert.ok(afterRetarget.x >= midB.x, "retarget must never jump backward");
  assert.equal(controller.frame(), 1);

  clock.advance(200);
  assert.deepEqual(controller.displayed(C), C);
  assert.equal(controller.pose(), "idle");
});

test("createPartySprite: the eased progress matches cameraGlide.js's easeOutCubic exactly at every applied frame (lockstep with the camera)", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const { clock, controller, renderLog } = makeController({
    reduced: () => false,
    extra: (c) => c.displayed(to).x,
  });
  controller.stepTo(from, to);
  renderLog.length = 0;

  clock.advance(200);

  for (const entry of renderLog) {
    const expectedRatio = easeOutCubic(entry.t / 200);
    const actualRatio = (entry.extra - from.x) / (to.x - from.x);
    assert.ok(
      Math.abs(actualRatio - expectedRatio) < 1e-12,
      `t=${entry.t}: ratio ${actualRatio} !== easeOutCubic(${entry.t}/200)=${expectedRatio}`,
    );
  }
});

test("createPartySprite: self-heal — displayed(D) with D !== B ends the in-flight glide, active() false, idle, and no more renders fire on further advance", () => {
  const A = { x: 1.5, y: 1.5 };
  const B = { x: 2.5, y: 1.5 };
  const D = { x: 9, y: 9 };
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  controller.stepTo(A, B);
  clock.advance(64);
  renderLog.length = 0;

  const result = controller.displayed(D);
  assert.deepEqual(result, D);
  assert.equal(controller.active(), false);
  assert.equal(controller.pose(), "idle");
  assert.equal(renderLog.length, 0, "self-heal must not itself call render");

  clock.advance(400);
  assert.equal(renderLog.length, 0, "no more renders should fire after self-heal cancelled the glide");
});

test("createPartySprite: stepTo(p, p) (the same point) lands at once — render once, idle, nothing scheduled", () => {
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  const p = { x: 3, y: 3 };
  controller.stepTo(p, p);
  assert.equal(renderLog.length, 1);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.active(), false);
  assert.equal(clock.pending(), 0);
});

test("createPartySprite: reduced true — stepTo lands synchronously with one render, displayed(to) === to, idle, frame 0, nothing pending; the 'from' point is never rendered", () => {
  const from = { x: 1, y: 1 };
  const to = { x: 5, y: 1 };
  const { clock, controller, renderLog } = makeController({
    reduced: () => true,
    extra: (c) => c.displayed(to).x,
  });
  controller.stepTo(from, to);
  assert.equal(renderLog.length, 1);
  assert.equal(renderLog[0].extra, to.x, "the 'from' point must never be the rendered value");
  assert.deepEqual(controller.displayed(to), to);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.frame(), 0);
  assert.equal(clock.pending(), 0);
});

test("createPartySprite: reduced flipping true mid-flight lands the very next frame exactly on the target, idle", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  let reducedFlag = false;
  const { clock, controller, renderLog } = makeController({ reduced: () => reducedFlag });
  controller.stepTo(from, to);
  clock.advance(32);
  assert.ok(controller.displayed(to).x < 10);

  reducedFlag = true;
  renderLog.length = 0;
  clock.advance(16);

  assert.deepEqual(controller.displayed(to), to);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.active(), false);
  assert.equal(clock.pending(), 0);
});

test("createPartySprite: finish() mid-flight lands on the target once, synchronously, idle, nothing pending", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  controller.stepTo(from, to);
  clock.advance(48);
  renderLog.length = 0;

  controller.finish();

  assert.equal(renderLog.length, 1);
  assert.deepEqual(controller.displayed(to), to);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.active(), false);
  assert.equal(clock.pending(), 0);
});

test("createPartySprite: cancel() mid-flight ends the glide idle with one render, and a later displayed(to) returns to", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const { clock, controller, renderLog } = makeController({ reduced: () => false });
  controller.stepTo(from, to);
  clock.advance(48);
  renderLog.length = 0;

  controller.cancel();

  assert.equal(renderLog.length, 1);
  assert.equal(controller.pose(), "idle");
  assert.equal(controller.active(), false);
  assert.deepEqual(controller.displayed(to), to);
});

test("createPartySprite: displayed(real) with no glide ever started returns real and never calls render; box is spriteBoxPx itself", () => {
  const { controller, renderLog } = makeController({ reduced: () => false });
  const real = { x: 7, y: 2 };
  assert.deepEqual(controller.displayed(real), real);
  assert.equal(renderLog.length, 0);
  assert.equal(controller.box, spriteBoxPx);
});

test("createPartySprite: a throwing render callback at stepTo() ends the glide cleanly (no frame left pending) and never throws out of stepTo", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const clock = createFakeClock();
  const controller = createPartySprite({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced: () => false,
    render: () => {
      throw new Error("boom");
    },
  });
  assert.doesNotThrow(() => controller.stepTo(from, to));
  assert.equal(clock.pending(), 0, "no frame left pending after a throwing render");
  assert.equal(controller.active(), false);
});

test("createPartySprite: a throwing render callback during an in-flight frame update also ends the glide cleanly and never throws (landed-API note below)", () => {
  // Landed-API note: cameraGlide.js's step() (Phase 58) reads its own
  // closed-over `run` again immediately AFTER this module's onPoint/apply
  // callback returns. A synchronous glide.cancel() from WITHIN that
  // callback would null cameraGlide's `run` out from under it and crash on
  // the very next line — so this controller intentionally does NOT cancel
  // the underlying glide when a throw (or a reentrant self-heal) is
  // detected mid-callback; it only clears its OWN state, which makes every
  // future onPoint tick a no-op. The background glide therefore keeps
  // ticking harmlessly (clock.pending() > 0) until it lands naturally on
  // its own schedule — this controller is already inert by then.
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };
  const clock = createFakeClock();
  let callCount = 0;
  let renderCallsAfterThrow = 0;
  const controller = createPartySprite({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced: () => false,
    render: () => {
      callCount++;
      if (callCount > 1) {
        renderCallsAfterThrow++;
        throw new Error("boom");
      }
    },
  });
  controller.stepTo(from, to);
  assert.doesNotThrow(() => clock.advance(16));
  assert.equal(controller.active(), false);
  assert.equal(controller.pose(), "idle");
  assert.equal(renderCallsAfterThrow, 1, "the throwing render fires exactly once, never again");

  // The background glide is still silently ticking (this controller no-ops
  // it); it never throws, and eventually lands and stops on its own.
  assert.doesNotThrow(() => clock.advance(400));
  assert.equal(clock.pending(), 0, "the stale glide lands naturally and clears its own pending frame");
  assert.equal(renderCallsAfterThrow, 1, "no further render calls after the controller settled");
});

test("createPartySprite: self-heal reentrant from within an active glide's own render callback (T-59-01: a teleport detected on the very next in-flight frame) never crashes cameraGlide.js's step()", () => {
  const A = { x: 1.5, y: 1.5 };
  const B = { x: 2.5, y: 1.5 };
  const teleportedTo = { x: 9, y: 9 };
  const clock = createFakeClock();
  let teleported = false;
  let selfHealResult = null;
  let controller;
  const render = () => {
    // Simulates the shell's real render(): on the SECOND render (the first
    // in-flight frame after stepTo's own synchronous one), pretend a
    // teleport just moved the party to `teleportedTo` without a matching
    // stepTo() call, and read displayed() for it right here — reentrant,
    // from inside onPoint's own call stack, exactly like T-59-01 describes.
    if (teleported) {
      selfHealResult = controller.displayed(teleportedTo);
      teleported = false;
    }
  };
  controller = createPartySprite({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced: () => false,
    render,
  });
  controller.stepTo(A, B); // synchronous render #1 (teleported still false)
  teleported = true;
  assert.doesNotThrow(() => clock.advance(16)); // render #2 self-heals reentrantly
  assert.deepEqual(selfHealResult, teleportedTo);
  assert.equal(controller.active(), false);
  assert.equal(controller.pose(), "idle");

  // The stale glide (still silently ticking toward B) never crashes on
  // later frames — `teleported` is already false, so render() is a no-op.
  assert.doesNotThrow(() => clock.advance(400));
});

// ─── node check (acceptance criterion) ──────────────────────────────────────

test("acceptance: STEP_GLIDE_MS === PAN_MS === 200, IDLE_CYCLE_MS === 1120, idleFrameDelaysMs() JSON-stringifies to [0,-840,-560,-280]", () => {
  assert.equal(STEP_GLIDE_MS === PAN_MS && PAN_MS === 200 && IDLE_CYCLE_MS === 1120, true);
  assert.equal(JSON.stringify(idleFrameDelaysMs()), "[0,-840,-560,-280]");
});

// ─── source assertions ────────────────────────────────────────────────────

const PARTY_SPRITE_SRC_RAW = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "partySprite.js"), "utf8");
const PARTY_SPRITE_SRC_STRIPPED = stripJs(PARTY_SPRITE_SRC_RAW);

test("partySprite.js source: never reads the window or document global directly", () => {
  assert.doesNotMatch(PARTY_SPRITE_SRC_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(PARTY_SPRITE_SRC_STRIPPED, /\bdocument\./);
});

test("partySprite.js source: never calls matchMedia", () => {
  assert.doesNotMatch(PARTY_SPRITE_SRC_STRIPPED, /matchMedia/);
});

test("partySprite.js source: the only import specifier is ./cameraGlide.js", () => {
  const specifiers = [...PARTY_SPRITE_SRC_STRIPPED.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["./cameraGlide.js"]);
});
