// src/browser/motion.js
//
// Phase 58 (MOTION-02/05) — the ONE reduced-motion predicate every JS-timed
// effect in the shell consults (D-17), its live change subscription, the
// pinned open/close durations shared by every panel/sheet/menu/tab surface
// (D-07), and the one shared, timer-driven close helper (D-08).
//
// This module is the JS twin of the blanket
// `@media (prefers-reduced-motion:reduce){*{transition:none!important;
// animation:none!important}}` CSS rule (mazeworld.html ~L867): that rule
// covers CSS, this module covers every effect driven from JS instead —
// typing (typewriter.js), the camera tween (cameraGlide.js), the combat
// beat, and this file's own panel close helper.
//
// createPanelMotion's close() is deliberately TIMER-driven, never a
// transition-end/animation-end listener: test/unit/shell-combat-screen.js's
// CSCR-08 rule forbids a completion-event listener anywhere in the shell,
// and the blanket reduced-motion rule above zeroes every transition/
// animation for a reduced-motion user, so such a listener would simply
// never fire for that user. D-08 asks for "hidden only after the close
// transition ends, with a timeout fallback" — a timer set to the CSS close
// duration plus one frame of slack satisfies both halves at once: `hidden`
// lands after the visual close has painted its last frame by construction,
// and the timer itself can never be stranded (see 58-01-PLAN.md's
// discovery note).
//
// Like src/browser/inputGuards.js, this module is DOM-free AND clock-free:
// every clock/scheduler/document/predicate arrives as an argument, never a
// read of the `window`/`document` globals, so `node --test` can drive every
// behaviour with a fake clock and plain objects. Imports nothing.

/** The one media query every reduced-motion read/subscription uses. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * prefersReducedMotion(win)
 *
 * The ONE live reduced-motion predicate for every JS-timed effect in the
 * shell (D-17). Calls `win.matchMedia(REDUCED_MOTION_QUERY)` FRESH on every
 * call (no caching) and returns that list's `matches` as a strict boolean,
 * so a change to the OS setting mid-session is seen by the very next read.
 *
 * Fail-to-instant: when `win` is falsy, `win.matchMedia` is not a function,
 * or anything throws, this returns true. An effect that cannot tell whether
 * motion is welcome resolves instantly to its end state, which is always
 * the correct behaviour (mirrors inputGuards.js's fail-open posture, but
 * inverted: here the safe default is "skip the motion", not "allow the
 * tap").
 *
 * @param {{matchMedia?: (q: string) => {matches: boolean}}} win
 * @returns {boolean}
 */
export function prefersReducedMotion(win) {
  try {
    if (!win || typeof win.matchMedia !== "function") return true;
    return !!win.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return true;
  }
}

/**
 * onReducedMotionChange(win, cb)
 *
 * Subscribes to the reduced-motion media-query list's change notification
 * and calls `cb(boolean)` with the new value whenever it fires. This is how
 * an effect already in flight can snap to its end state the instant the
 * user flips the OS preference mid-session.
 *
 * Returns an unsubscribe function. Prefers the modern
 * `addEventListener("change", handler)` API; falls back to the legacy
 * `addListener(handler)` API when that is all the list exposes. Returns a
 * no-op, callable unsubscribe function (and subscribes to nothing) when
 * `win`/`matchMedia`/both subscribe APIs are missing, or when anything
 * throws while wiring up. Never throws into the caller.
 *
 * @param {{matchMedia?: (q: string) => any}} win
 * @param {(matches: boolean) => void} cb
 * @returns {() => void}
 */
export function onReducedMotionChange(win, cb) {
  const noop = () => {};
  try {
    if (!win || typeof win.matchMedia !== "function") return noop;
    const list = win.matchMedia(REDUCED_MOTION_QUERY);
    if (!list) return noop;

    const handler = (event) => {
      try {
        cb(!!event?.matches);
      } catch {
        // a throwing subscriber must never break the subscription itself.
      }
    };

    if (typeof list.addEventListener === "function") {
      list.addEventListener("change", handler);
      return () => {
        try {
          list.removeEventListener("change", handler);
        } catch {
          // an already-torn-down list must never throw on unsubscribe.
        }
      };
    }
    if (typeof list.addListener === "function") {
      list.addListener(handler);
      return () => {
        try {
          list.removeListener?.(handler);
        } catch {
          // an already-torn-down list must never throw on unsubscribe.
        }
      };
    }
    return noop;
  } catch {
    return noop;
  }
}

/** Open duration (ms), ease-out — rail/sheets/tabs (D-07). */
export const OPEN_MS = 180;
/** The ☰ menu's own open duration (ms), matching the mock's `.16s` rise (D-07). */
export const MENU_OPEN_MS = 160;
/** Close duration (ms), ease-in — closing faster reads as responsive (D-07). */
export const CLOSE_MS = 120;
/** Slack (ms) added after CLOSE_MS before `hidden` lands — two 60Hz frames, so the hide lands after the CSS close has painted its last frame (D-08). */
export const CLOSE_SLACK_MS = 34;
/** CSS easing token for an opening surface (D-07). */
export const EASE_OUT_CSS = "ease-out";
/** CSS easing token for a closing surface (D-07). */
export const EASE_IN_CSS = "ease-in";

/**
 * createPanelMotion({ setTimeout, clearTimeout, reduced, closeMs, slackMs })
 *
 * The ONE shared close helper (D-08) every panel/sheet/menu/tab close
 * routes through. Returns `{ open, close, isClosing, finishAll }`, closing
 * over a Map from element to its pending `{ timer, onHidden }` record.
 *
 * @param {{
 *   setTimeout: (fn: () => void, ms: number) => any,
 *   clearTimeout: (id: any) => void,
 *   reduced: () => boolean,
 *   closeMs?: number,
 *   slackMs?: number,
 * }} deps
 */
export function createPanelMotion({ setTimeout: schedule, clearTimeout: unschedule, reduced, closeMs = CLOSE_MS, slackMs = CLOSE_SLACK_MS }) {
  const pending = new Map();

  function finish(el) {
    const record = pending.get(el);
    if (!record) return;
    pending.delete(el);
    try {
      delete el.dataset.motion;
    } catch {
      // a dataset write on a malformed fake element must never throw.
    }
    el.hidden = true;
    if (typeof record.onHidden === "function") {
      try {
        record.onHidden();
      } catch {
        // a throwing onHidden must never strand the record or rethrow.
      }
    }
  }

  function close(el, onHidden) {
    try {
      if (!el) return;
      if (pending.has(el)) return; // already closing — no second timer
      if (el.hidden === true) return; // already hidden, not pending — no-op

      if (reduced()) {
        el.hidden = true;
        if (typeof onHidden === "function") {
          try {
            onHidden();
          } catch {
            // never throw into the caller.
          }
        }
        return;
      }

      el.dataset.motion = "closing";
      const timer = schedule(() => finish(el), closeMs + slackMs);
      pending.set(el, { timer, onHidden });
    } catch {
      // a malformed element must never throw into the caller.
    }
  }

  function open(el) {
    try {
      if (!el) return;
      const record = pending.get(el);
      if (record) {
        unschedule(record.timer);
        pending.delete(el);
        try {
          delete el.dataset.motion;
        } catch {
          // never throw.
        }
      }
      el.hidden = false;
    } catch {
      // never throw into the caller.
    }
  }

  function isClosing(el) {
    return pending.has(el);
  }

  function finishAll() {
    for (const el of [...pending.keys()]) {
      const record = pending.get(el);
      if (record) unschedule(record.timer);
      finish(el);
    }
  }

  return { open, close, isClosing, finishAll };
}
