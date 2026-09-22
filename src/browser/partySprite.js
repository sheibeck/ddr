// src/browser/partySprite.js
//
// Phase 59 (ANIM-01/02/03) — the living party marker's pure presentation
// core: the idle frame schedule, the step-glide frame schedule, the
// canvas-lockstep placement math, the art-fallback choice, and a
// retargetable step-glide controller built on Phase 58's camera glide.
//
// Four rules, per D-01, D-02, D-03 and D-05 (59-CONTEXT.md):
//
//   1. The marker is a DOM sprite over the canvas (like the retired
//      `#mw-party-pulse` ring before it), placed in lockstep with the
//      canvas's OWN pixel-rounded origin (`spriteBoxPx`, mirroring
//      mazeworld.html's `positionCanvas()`). `party.png` stays the
//      fallback and first frame (`spriteArt`).
//   2. The idle loop is a CSS frame cycle of four opacity-animated images,
//      phase-shifted by `idleFrameDelaysMs()` so exactly one is opaque at
//      any instant — composited-only, per the 2026-09-17 UAT PERF rule (see
//      this file's discovery notes in 59-01-PLAN.md): no non-composited
//      property may drive this loop.
//   3. The step glide is Phase 58's own camera tween (`createCameraGlide`
//      from `./cameraGlide.js`), applied to the marker's displayed point
//      instead of retyping a second easing curve or duration constant.
//      `STEP_GLIDE_MS` IS `PAN_MS` by construction, so the marker and the
//      camera always glide for the same duration.
//   4. Reduced motion is read through ONE injected predicate, `reduced()`
//      — never a second `matchMedia` call or a hard-coded media query. The
//      shell wires it to Phase 58's `prefersReducedMotion(window)`.
//
// Pure, clock-free, DOM-free, like cameraGlide.js/motion.js/inputGuards.js's
// own house style: every clock/raf/cancelRaf/reduced/render dependency
// arrives as an argument, never a read of the `window`/`document` globals.
// Imports nothing but `./cameraGlide.js`.

import { PAN_MS, createCameraGlide } from "./cameraGlide.js";

/**
 * The 8 shipped frame stems, idle 1..4 then step 1..4, in the order
 * Plan 59-03's markup lists them (`icons/optimized/<name>.png`).
 */
export const PARTY_FRAME_ICONS = Object.freeze([
  "party_idle_1",
  "party_idle_2",
  "party_idle_3",
  "party_idle_4",
  "party_step_1",
  "party_step_2",
  "party_step_3",
  "party_step_4",
]);

/** Number of idle frames in the breathing loop (D-02). */
export const IDLE_FRAMES = 4;
/** Milliseconds each idle frame is visible (D-02's "~280ms per frame"). */
export const IDLE_FRAME_MS = 280;
/** Full idle loop duration (ms) — a ~1.1s gentle breathing cycle. */
export const IDLE_CYCLE_MS = IDLE_FRAMES * IDLE_FRAME_MS;
/** Number of step frames played once per glide (D-03). */
export const STEP_FRAMES = 4;
/**
 * The step glide's duration (ms) — IS Phase 58's `PAN_MS`, imported rather
 * than retyped, so the marker and the camera always glide for the same
 * duration (D-03).
 */
export const STEP_GLIDE_MS = PAN_MS;

/**
 * idleFrameDelaysMs()
 *
 * Returns a fresh 4-entry array of CSS animation delays (ms) that
 * phase-shift one shared idle keyframe so exactly one idle frame is the
 * visible (opaque) one at any instant across the IDLE_CYCLE_MS loop. Frame
 * k (1-based) is visible on [(k-1)*IDLE_FRAME_MS, k*IDLE_FRAME_MS); its
 * delay is 0 for k=1, else `(k-1)*IDLE_FRAME_MS - IDLE_CYCLE_MS` (a
 * negative delay starts that frame's own animation already partway/wrapped
 * into its opaque window at t=0).
 *
 * Under the blanket `prefers-reduced-motion` CSS rule every animation is
 * removed, so each frame falls back to its base (non-animated) style —
 * only frame 1's base style is opaque, which is D-05's "idle freezes on
 * frame 1" with no JS involved at all.
 *
 * @returns {number[]}
 */
export function idleFrameDelaysMs() {
  const delays = [];
  for (let k = 1; k <= IDLE_FRAMES; k++) {
    delays.push(k === 1 ? 0 : (k - 1) * IDLE_FRAME_MS - IDLE_CYCLE_MS);
  }
  return delays;
}

/**
 * stepFrameAt(elapsedMs, durationMs, frames = STEP_FRAMES)
 *
 * Maps step-glide progress to a 1-based step frame. Total: a non-finite or
 * non-positive `durationMs` returns the last frame (the glide is already
 * "done"); a non-finite or non-positive `elapsedMs` returns 1 (the glide
 * has not started). Otherwise frame `1 + floor(frames * elapsedMs /
 * durationMs)`, clamped to `frames`.
 *
 * @param {number} elapsedMs
 * @param {number} durationMs
 * @param {number} [frames]
 * @returns {number}
 */
export function stepFrameAt(elapsedMs, durationMs, frames = STEP_FRAMES) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return frames;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1;
  return Math.min(frames, 1 + Math.floor((frames * elapsedMs) / durationMs));
}

/**
 * snapToDevicePx(v, dpr)
 *
 * The SAME rounding rule mazeworld.html's `positionCanvas()` uses for the
 * canvas transform (`Math.round(v * dpr) / dpr`) — the sprite MUST use
 * this one rule so the two can never disagree. A non-finite or non-positive
 * `dpr` behaves as 1.
 *
 * @param {number} v
 * @param {number} dpr
 * @returns {number}
 */
export function snapToDevicePx(v, dpr) {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.round(v * d) / d;
}

/**
 * spriteBoxPx({ vw, vh, cam, shown, cell, pad = 0, dpr = 1 })
 *
 * Places the sprite in lockstep with the canvas (D-01). `ox`/`oy` are the
 * canvas's own rounded origin (mirroring `positionCanvas()`'s `tx`/`ty` and
 * device-pixel rounding exactly); the sprite then sits at that rounded
 * origin plus the cell offset of the displayed point, with NO second
 * rounding — at rest (`shown` a cell centre) the sprite covers exactly the
 * canvas cell the engine says the party is on, and mid-glide it moves
 * continuously (no snapping) between cells.
 *
 * @param {{vw:number,vh:number,cam:{x:number,y:number},shown:{x:number,y:number},cell:number,pad?:number,dpr?:number}} args
 * @returns {{x:number,y:number,size:number}}
 */
export function spriteBoxPx({ vw, vh, cam, shown, cell, pad = 0, dpr = 1 }) {
  const ox = snapToDevicePx(vw / 2 - cam.x * cell - pad, dpr);
  const oy = snapToDevicePx(vh / 2 - cam.y * cell - pad, dpr);
  return {
    x: ox + (shown.x - 0.5) * cell,
    y: oy + (shown.y - 0.5) * cell,
    size: cell,
  };
}

/**
 * spriteArt({ framesReady, staticReady })
 *
 * Picks the sprite's art state (D-01): "frames" when all
 * `PARTY_FRAME_ICONS.length` frame images decoded (`framesReady` is an
 * array of EXACTLY that length, every entry true), else "static" when the
 * shipped `party.png` fallback decoded, else "none" (a plain gold dot, so
 * the party is never invisible).
 *
 * @param {{framesReady:boolean[],staticReady:boolean}} args
 * @returns {"frames"|"static"|"none"}
 */
export function spriteArt({ framesReady, staticReady }) {
  if (
    Array.isArray(framesReady) &&
    framesReady.length === PARTY_FRAME_ICONS.length &&
    framesReady.every((v) => v === true)
  ) {
    return "frames";
  }
  if (staticReady) return "static";
  return "none";
}

/**
 * createPartySprite({ now, raf, cancelRaf, reduced, render, durationMs })
 *
 * The marker's retargetable step-glide controller (D-03), built on Phase
 * 58's `createCameraGlide`. Returns `{ stepTo, displayed, pose, frame,
 * active, finish, cancel, box }` (`box` is `spriteBoxPx` itself).
 *
 * Retarget contract (D-03): the CALLER passes the currently displayed
 * point as `from` on every `stepTo` call (never the previous logical
 * target) — this is what makes a rapid second step re-aim from wherever
 * the marker visually is, with no queue and no stutter. `stepTo` starts a
 * `durationMs` (default `STEP_GLIDE_MS`) ease-out glide, renders `from`
 * at once in the step pose on frame 1 (order matters: the glide is started
 * BEFORE that render, so a render that reads `displayed()` mid-call
 * already sees an active glide, never a stale/self-healed one), advances
 * the step frame with the glide's own eased progress, and settles to the
 * idle pose exactly on arrival.
 *
 * Self-heal (D-01's lockstep guarantee): `displayed(real)` returns the
 * in-flight point while a glide heads for `real`; if a glide is heading
 * somewhere else (a teleport, floor change, new run or load moved the
 * party without a step), it ends that glide on the very next `displayed`
 * call and returns `real` — the marker can never drift to a stale square,
 * with no extra hook anywhere else.
 *
 * Reduced motion (D-05): under the injected `reduced()`, `stepTo` lands on
 * `to` synchronously in the idle pose with exactly one render and nothing
 * scheduled; the `from` point is never rendered. A live flip to reduced
 * mid-glide lands the very next scheduled frame on the target (handled by
 * `createCameraGlide` itself, which reads `reduced()` live on every step).
 * `finish()` lands an in-flight glide at once (the shell's
 * `settleAllMotion`).
 *
 * Every public method is wrapped so it can never throw into a caller,
 * including a throwing `render` callback, which ends the glide cleanly
 * instead of leaving a stranded frame.
 *
 * @param {{
 *   now: () => number,
 *   raf: (fn: () => void) => any,
 *   cancelRaf: (id: any) => void,
 *   reduced: () => boolean,
 *   render?: () => void,
 *   durationMs?: number,
 * }} deps
 */
export function createPartySprite({ now, raf, cancelRaf, reduced, render = () => {}, durationMs = STEP_GLIDE_MS }) {
  const glide = createCameraGlide({ now, raf, cancelRaf, reduced, durationMs });

  /** @type {null | { target: {x:number,y:number}, t0: number }} */
  let run = null;
  /** @type {null | {x:number,y:number}} */
  let current = null;
  let poseNow = "idle";
  let frameNow = 0;
  // True for the exact duration of an onPoint(p) call — i.e. while this
  // module is executing INSIDE cameraGlide.js's own step() call stack (see
  // endGlide's doc comment below for why this matters).
  let inOnPoint = false;

  function samePoint(a, b) {
    return !!a && !!b && a.x === b.x && a.y === b.y;
  }

  /**
   * endGlide(useFinish) — the ONE place this module ever calls
   * `glide.cancel()`/`glide.finish()`.
   *
   * Landed-API adaptation (discovery note, this module's own head comment):
   * cameraGlide.js's step() (Phase 58, landed, out of this plan's scope to
   * modify) reads its OWN closed-over `run` variable again immediately
   * AFTER calling the `apply` callback (`run.frame = raf(step)`, on the
   * non-landing branch). `apply` is this module's `onPoint`. If `onPoint` —
   * or anything `onPoint` calls, directly or indirectly (this module's own
   * `render()` throwing, or `render()` itself reentrantly calling
   * `displayed()` with a stale point, which is EXACTLY T-59-01's teleport-
   * mid-glide self-heal path) — calls `glide.cancel()`/`glide.finish()`
   * synchronously, that nulls cameraGlide's `run` out from under it, and
   * `step()`'s very next line throws `Cannot set properties of null`.
   *
   * While `inOnPoint` is true, this function skips the real glide call
   * instead. That loses nothing observable: this module's OWN `run` is
   * always cleared by the caller right after (via `settle`), so every
   * future `onPoint` tick for the stale glide is already a no-op (its
   * first line is `if (!run) return;`); the background glide finishes
   * itself invisibly on its own schedule; and any later `stepTo()`
   * supersedes it safely regardless, since cameraGlide's own `to()` always
   * cancels its prior frame before starting a new one.
   */
  function endGlide(useFinish) {
    if (inOnPoint) return;
    try {
      if (useFinish) glide.finish();
      else glide.cancel();
    } catch {
      // never throw into the caller.
    }
  }

  function settle(callRender) {
    run = null;
    current = null;
    poseNow = "idle";
    frameNow = 0;
    if (callRender) {
      try {
        render();
      } catch {
        // a throwing render must never strand this controller's state.
      }
    }
  }

  function onPoint(p) {
    if (!run) return;
    inOnPoint = true;
    try {
      current = { x: p.x, y: p.y };
      if (samePoint(p, run.target)) {
        settle(true);
        return;
      }
      frameNow = stepFrameAt(now() - run.t0, durationMs);
      try {
        render();
      } catch {
        endGlide(false);
        settle(false);
      }
    } finally {
      inOnPoint = false;
    }
  }

  function stepTo(from, to) {
    try {
      if (!from || !to) return;
      if (samePoint(from, to)) {
        endGlide(false);
        settle(true);
        return;
      }
      run = { target: { x: to.x, y: to.y }, t0: now() };
      if (reduced()) {
        // Lands synchronously inside glide.to(); onPoint settles with one
        // render. The "from" point is deliberately never rendered.
        glide.to(from, to, onPoint);
        return;
      }
      current = { x: from.x, y: from.y };
      poseNow = "step";
      frameNow = 1;
      // Start the glide FIRST: a render() call below (or by the caller
      // immediately after) that reads displayed() must already see an
      // active glide, or it would self-heal the glide it is starting.
      glide.to(from, to, onPoint);
      try {
        render();
      } catch {
        endGlide(false);
        settle(false);
      }
    } catch {
      // never throw into the caller.
    }
  }

  function displayed(real) {
    try {
      if (run && glide.active() && samePoint(run.target, real)) {
        return { x: current.x, y: current.y };
      }
      if (run) {
        // Self-heal (T-59-01): the glide is inactive or heading somewhere
        // other than `real` — end it now. No render here; the caller is
        // already rendering (it just asked where to draw the marker). See
        // endGlide's doc comment: this is routinely called reentrantly
        // from inside an active glide's own render callback (a teleport
        // detected on the very next in-flight frame), which is exactly why
        // it must go through endGlide rather than call glide.cancel()
        // directly.
        endGlide(false);
        settle(false);
        return real;
      }
      return real;
    } catch {
      return real;
    }
  }

  function pose() {
    return poseNow;
  }

  function frame() {
    return frameNow;
  }

  function active() {
    return run !== null;
  }

  function finish() {
    try {
      if (run) {
        endGlide(true);
      }
      if (run) {
        // onPoint above should have already settled; this is a safety net
        // in case some edge case left `run` set (including endGlide
        // skipping the real glide.finish() call during reentrancy).
        settle(true);
      }
    } catch {
      // never throw into the caller.
    }
  }

  function cancel() {
    try {
      endGlide(false);
      if (run) settle(true);
    } catch {
      // never throw into the caller.
    }
  }

  return { stepTo, displayed, pose, frame, active, finish, cancel, box: spriteBoxPx };
}
