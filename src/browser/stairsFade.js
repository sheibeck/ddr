// src/browser/stairsFade.js
//
// Phase 78 (HUD-06) — the stairs descent's fade to black. The user's
// 2026-09-24 request: "taking the stairs down should feel like a descent,
// not a hard cut". CONTEXT: the screen fades to black in about 0.6s under
// the stairs sound, the new floor is swapped in while it is dark, then it
// fades in over about 0.4s. With reduced motion there is an instant cut and
// the sound still plays (the sound is the caller's business, never this
// module's).
//
// This module owns only the TIMING. The caller (mazeworld.html's module
// script, bridged as window.__mzStairsFade) supplies:
//   - setPhase(phase): writes "out" | "in" | "idle" onto the #mw-fade
//     overlay, whose CSS transitions do the actual darkening;
//   - reduced(): the live reduced-motion predicate (src/browser/motion.js);
//   - schedule(fn, ms) / cancel(id): the timer pair.
//
// While `holding()` is true (the fade-out) the caller keeps the OLD floor on
// the canvas; `active()` (out or in) is the caller's input lock and the
// rail's "not yet" flag. start(onDark, onDone) runs onDark at the dark point
// (draw and centre the new floor) and onDone once the fade-in has finished
// (reveal the rail card). Neither callback ever runs twice, and a restart or
// a cancel never loses an onDark, so the newest floor is always drawn.
//
// Pure, clock-free, DOM-free (the house style of cameraGlide.js and
// motion.js): every dependency arrives as an argument. Imports nothing.

/** The fade's two legs (ms): about 0.6s out, about 0.4s in (HUD-06). */
export const STAIRS_FADE_MS = Object.freeze({ out: 600, in: 400 });

function safely(fn) {
  if (typeof fn !== "function") return;
  try {
    fn();
  } catch {
    // a throwing draw or rail render must never strand the fade.
  }
}

/**
 * createStairsFade({ setPhase, reduced, schedule, cancel, outMs, inMs })
 *
 * Returns `{ start, cancel, active, holding }`, closing over a single
 * `run = null | { phase: "out" | "in", onDark, onDone, darkRan, timer }`.
 *
 * @param {{
 *   setPhase: (phase: "out" | "in" | "idle") => void,
 *   reduced: () => boolean,
 *   schedule: (fn: () => void, ms: number) => any,
 *   cancel: (id: any) => void,
 *   outMs?: number,
 *   inMs?: number,
 * }} deps
 */
export function createStairsFade({
  setPhase,
  reduced,
  schedule,
  cancel: unschedule,
  outMs = STAIRS_FADE_MS.out,
  inMs = STAIRS_FADE_MS.in,
}) {
  let run = null;

  function phaseTo(phase) {
    safely(() => setPhase(phase));
  }

  function isReduced() {
    try {
      return !!reduced();
    } catch {
      return true; // fail to instant, like motion.js#prefersReducedMotion
    }
  }

  function clearTimer(r) {
    if (r && r.timer !== null && r.timer !== undefined) {
      try {
        unschedule(r.timer);
      } catch {
        // a malformed cancel must never throw into the caller.
      }
      r.timer = null;
    }
  }

  function toIdle() {
    if (!run) return;
    const r = run;
    r.timer = null;
    run = null;
    phaseTo("idle");
    safely(r.onDone);
  }

  function toIn() {
    if (!run) return;
    const r = run;
    r.timer = null;
    // Leave the hold BEFORE onDark, so the caller's draw() paints the new
    // floor instead of holding the old one.
    r.phase = "in";
    r.darkRan = true;
    safely(r.onDark);
    if (run !== r) return; // onDark restarted or cancelled the fade
    phaseTo("in");
    r.timer = schedule(toIdle, inMs);
  }

  // Retire an in-flight run for a restart: its onDark still runs (at once)
  // if it had not, so the newest floor is drawn; its onDone is dropped.
  function retire() {
    if (!run) return;
    const r = run;
    clearTimer(r);
    run = null;
    if (!r.darkRan) {
      r.darkRan = true;
      safely(r.onDark);
    }
  }

  function start(onDark, onDone) {
    try {
      retire();
      if (isReduced() || outMs <= 0) {
        phaseTo("idle");
        safely(onDark);
        safely(onDone);
        return;
      }
      const r = { phase: "out", onDark, onDone, darkRan: false, timer: null };
      run = r;
      phaseTo("out");
      r.timer = schedule(toIn, outMs);
    } catch {
      // a malformed scheduler must never throw into the caller; end clean.
      run = null;
      phaseTo("idle");
    }
  }

  function cancel() {
    try {
      if (!run) return;
      const r = run;
      clearTimer(r);
      run = null;
      if (!r.darkRan) {
        r.darkRan = true;
        safely(r.onDark);
      }
      phaseTo("idle");
      safely(r.onDone);
    } catch {
      // never throw into the caller.
    }
  }

  function active() {
    return run !== null;
  }

  function holding() {
    return run !== null && run.phase === "out";
  }

  return { start, cancel, active, holding };
}
