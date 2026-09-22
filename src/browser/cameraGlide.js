// src/browser/cameraGlide.js
//
// Phase 58 (MOTION-01) — the retargetable, cancellable ease-out camera
// tween for the map's keep-in-view nudge and the CENTRE action (D-02, D-04).
//
// This changes HOW the camera moves, never WHEN: the Phase 35 / 260918-vm3
// stationary-camera ruling is unchanged — the camera still only moves on
// drag / nudge / CENTRE / stairs / teleport / new run. This module gives
// the nudge and CENTRE paths an ~200ms ease-out instead of a snap; drag and
// pinch stay strictly 1:1 under the finger and never call into this module
// at all (D-02) — a pointer-down cancels any in-flight glide immediately,
// so the finger always wins.
//
// `cam` (mazeworld.html) is the grid point pinned under the viewport
// centre, in cell units, fractional — this module interpolates that point,
// never CSS pixels, so a zoom change mid-glide can never desync it.
//
// Pure, clock-free, DOM-free, like src/browser/controls.js's own house
// style: every clock/raf/cancelRaf/reduced predicate arrives as an
// argument. Imports nothing.

/** Ease-out camera glide duration (ms) — D-04's "~200ms ease-out". */
export const PAN_MS = 200;

/**
 * easeOutCubic(t) — clamps t to [0, 1], then returns 1 - (1 - t) ** 3.
 * @param {number} t
 * @returns {number}
 */
export function easeOutCubic(t) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - clamped) ** 3;
}

/**
 * glidePoint(from, to, t) — returns a NEW { x, y }: from plus (to minus
 * from) times easeOutCubic(t), per axis.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} t
 * @returns {{x:number,y:number}}
 */
export function glidePoint(from, to, t) {
  const eased = easeOutCubic(t);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

/**
 * createCameraGlide({ now, raf, cancelRaf, reduced, durationMs })
 *
 * Returns `{ to, cancel, finish, target, active }`, closing over a single
 * `run = null | { from, target, t0, apply, frame }`.
 *
 * @param {{
 *   now: () => number,
 *   raf: (fn: () => void) => any,
 *   cancelRaf: (id: any) => void,
 *   reduced: () => boolean,
 *   durationMs?: number,
 * }} deps
 */
export function createCameraGlide({ now, raf, cancelRaf, reduced, durationMs = PAN_MS }) {
  let run = null;

  function applySafely(apply, point) {
    try {
      apply(point);
    } catch {
      // a throwing apply must end the run instead of leaving a scheduled
      // frame behind — the caller's render failure is not this module's
      // problem to propagate.
    }
  }

  function cancelFrame() {
    if (run && run.frame !== null && run.frame !== undefined) {
      try {
        cancelRaf(run.frame);
      } catch {
        // a malformed cancelRaf must never throw into the caller.
      }
    }
  }

  function step() {
    if (!run) return;
    const { from, target, t0, apply } = run;
    const elapsed = now() - t0;
    if (reduced() || elapsed / durationMs >= 1) {
      const landed = { x: target.x, y: target.y };
      run = null;
      applySafely(apply, landed);
      return;
    }
    applySafely(apply, glidePoint(from, target, elapsed / durationMs));
    run.frame = raf(step);
  }

  function to(from, target, apply) {
    try {
      const fromCopy = { x: from.x, y: from.y };
      const targetCopy = { x: target.x, y: target.y };

      if (reduced() || durationMs <= 0) {
        cancelFrame();
        run = null;
        applySafely(apply, { x: targetCopy.x, y: targetCopy.y });
        return;
      }

      cancelFrame();
      run = { from: fromCopy, target: targetCopy, t0: now(), apply, frame: null };
      run.frame = raf(step);
    } catch {
      // a malformed caller must never throw upstream from a motion helper.
    }
  }

  function cancel() {
    try {
      cancelFrame();
      run = null;
    } catch {
      // never throw into the caller.
    }
  }

  function finish() {
    try {
      if (!run) return;
      const { target, apply } = run;
      cancelFrame();
      run = null;
      applySafely(apply, { x: target.x, y: target.y });
    } catch {
      // never throw into the caller.
    }
  }

  function target() {
    return run ? { x: run.target.x, y: run.target.y } : null;
  }

  function active() {
    return run !== null;
  }

  return { to, cancel, finish, target, active };
}
