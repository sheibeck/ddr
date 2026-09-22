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
} from "../../src/browser/partySprite.js";
import { PAN_MS } from "../../src/browser/cameraGlide.js";
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
