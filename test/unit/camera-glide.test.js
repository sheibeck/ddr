// test/unit/camera-glide.test.js
//
// Phase 58 (MOTION-01), Plan 01, Task 2 — pins src/browser/cameraGlide.js's
// easing math and the retargetable, cancellable camera tween. One named
// test per <behavior> bullet in 58-01-PLAN.md, plus the two stripped-source
// checks shared with motion.js.
//
// Uses an inline fake clock/raf: advance(ms) steps in 16ms frames and runs
// whatever is currently queued at each step, matching the plan's own
// discovery note for a rAF-driven tween.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  PAN_MS,
  easeOutCubic,
  glidePoint,
  createCameraGlide,
} from "../../src/browser/cameraGlide.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fake clock + raf ─────────────────────────────────────────────────────
function makeFakeClock() {
  let now = 0;
  let nextId = 1;
  let queue = [];
  return {
    now: () => now,
    raf(fn) {
      const id = nextId++;
      queue.push({ id, fn });
      return id;
    },
    cancelRaf(id) {
      queue = queue.filter((e) => e.id !== id);
    },
    queueLength: () => queue.length,
    advance(ms) {
      let remaining = ms;
      while (remaining > 0) {
        const step = Math.min(16, remaining);
        now += step;
        remaining -= step;
        const due = queue;
        queue = [];
        for (const entry of due) entry.fn();
      }
    },
  };
}

// ─── 1. PAN_MS + easeOutCubic ─────────────────────────────────────────────

test("PAN_MS is 200; easeOutCubic pins its three sample values and clamps out-of-range input", () => {
  assert.equal(PAN_MS, 200);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(0.5), 0.875);
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(4), 1);
});

// ─── 2. glidePoint ────────────────────────────────────────────────────────

test("glidePoint: t=1 lands exactly on 'to'; t=0 equals 'from'", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: -4 };
  assert.deepEqual(glidePoint(from, to, 1), { x: 10, y: -4 });
  assert.deepEqual(glidePoint(from, to, 0), { x: 0, y: 0 });
});

// ─── 3. to(): synchronous no-op, one scheduled frame, monotonic glide, exact landing ──

test("createCameraGlide: to() applies nothing synchronously, schedules one frame, glides monotonically, and lands exactly on target", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  assert.equal(applied.length, 0);
  assert.equal(clock.queueLength(), 1);

  clock.advance(200);

  assert.ok(applied.length > 0);
  for (let i = 1; i < applied.length; i++) {
    assert.ok(applied[i].x >= applied[i - 1].x, `frame ${i} moved backward: ${applied[i].x} < ${applied[i - 1].x}`);
  }
  for (let i = 0; i < applied.length - 1; i++) {
    assert.ok(applied[i].x > 0 && applied[i].x < 10, `intermediate frame ${i} not strictly between 0 and 10: ${applied[i].x}`);
  }
  const last = applied[applied.length - 1];
  assert.deepEqual(last, { x: 10, y: 0 });
  assert.equal(glide.active(), false);
  assert.equal(clock.queueLength(), 0);
});

// ─── 4. retarget mid-flight ───────────────────────────────────────────────

test("createCameraGlide: retargeting mid-flight continues from the passed 'from', never jumps backward, and lands on the new target", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  clock.advance(100); // partway through the first glide

  const lastApplied = applied[applied.length - 1];
  assert.ok(lastApplied.x > 0 && lastApplied.x < 10);

  const appliedAfterRetarget = [];
  glide.to(lastApplied, { x: 20, y: 0 }, (p) => appliedAfterRetarget.push(p));
  assert.deepEqual(glide.target(), { x: 20, y: 0 });

  clock.advance(250);

  assert.ok(appliedAfterRetarget.length > 0);
  assert.ok(appliedAfterRetarget[0].x >= lastApplied.x, "first post-retarget frame jumped backward");
  for (let i = 1; i < appliedAfterRetarget.length; i++) {
    assert.ok(appliedAfterRetarget[i].x >= appliedAfterRetarget[i - 1].x, `post-retarget frame ${i} moved backward`);
  }
  const last = appliedAfterRetarget[appliedAfterRetarget.length - 1];
  assert.deepEqual(last, { x: 20, y: 0 });
  assert.equal(glide.active(), false);
});

// ─── 5. cancel() ──────────────────────────────────────────────────────────

test("createCameraGlide: cancel() mid-flight stops applying, active() is false, target() is null", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  clock.advance(64);
  const countBeforeCancel = applied.length;

  glide.cancel();
  assert.equal(glide.active(), false);
  assert.equal(glide.target(), null);

  clock.advance(400);
  assert.equal(applied.length, countBeforeCancel, "cancel() must stop further apply calls");
});

// ─── 6. finish() ──────────────────────────────────────────────────────────

test("createCameraGlide: finish() mid-flight applies the target exactly once, synchronously, leaving no frame", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  clock.advance(48);
  const countBeforeFinish = applied.length;

  glide.finish();
  assert.equal(applied.length, countBeforeFinish + 1);
  assert.deepEqual(applied[applied.length - 1], { x: 10, y: 0 });
  assert.equal(clock.queueLength(), 0);
  assert.equal(glide.active(), false);
});

// ─── 7. reduced=true at to() ──────────────────────────────────────────────

test("createCameraGlide: reduced true — to() applies the target synchronously once, schedules no frame", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => true });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  assert.deepEqual(applied, [{ x: 10, y: 0 }]);
  assert.equal(clock.queueLength(), 0);
  assert.equal(glide.active(), false);
});

// ─── 8. reduced flips true mid-flight ─────────────────────────────────────

test("createCameraGlide: reduced flipping true mid-flight lands the target on the very next frame and stops", () => {
  const clock = makeFakeClock();
  const applied = [];
  let reducedFlag = false;
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => reducedFlag });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  clock.advance(32);
  assert.ok(applied.length > 0);
  assert.ok(applied[applied.length - 1].x < 10);

  reducedFlag = true;
  clock.advance(16);

  assert.deepEqual(applied[applied.length - 1], { x: 10, y: 0 });
  assert.equal(glide.active(), false);
  assert.equal(clock.queueLength(), 0);
});

// ─── 9. durationMs 0 behaves like reduced ─────────────────────────────────

test("createCameraGlide: durationMs 0 lands synchronously, like reduced motion", () => {
  const clock = makeFakeClock();
  const applied = [];
  const glide = createCameraGlide({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, durationMs: 0 });

  glide.to({ x: 0, y: 0 }, { x: 10, y: 0 }, (p) => applied.push(p));
  assert.deepEqual(applied, [{ x: 10, y: 0 }]);
  assert.equal(clock.queueLength(), 0);
  assert.equal(glide.active(), false);
});

// ─── source assertions ────────────────────────────────────────────────────

const CAMERA_GLIDE_SRC_STRIPPED = stripJs(
  fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "cameraGlide.js"), "utf8"),
);

test("cameraGlide.js source: holds no completion-event listener of any kind", () => {
  assert.doesNotMatch(CAMERA_GLIDE_SRC_STRIPPED, /transitionend/i);
  assert.doesNotMatch(CAMERA_GLIDE_SRC_STRIPPED, /animationend/i);
});

test("cameraGlide.js source: never reads the window or document global directly", () => {
  assert.doesNotMatch(CAMERA_GLIDE_SRC_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(CAMERA_GLIDE_SRC_STRIPPED, /\bdocument\./);
});
