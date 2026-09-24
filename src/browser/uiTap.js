// src/browser/uiTap.js
//
// Phase 71 (POLISH-10, D-15) — when the UI tap sound plays. Pure: no DOM
// globals, no window, no timers of its own and no imports. The shell hands
// in every dependency (the player, the one-shot counter, the beat probe,
// the guard probe and the one-task scheduler).
//
// D-15 — the click, not the touch. The shell used to tick from a
// capture-phase pointerdown on document, which fires the moment a finger
// lands, before the browser knows whether the gesture is a tap or a scroll.
// Starting a scroll on any button (gear rows, board rows, the Oracle,
// sheets) clicked. The audio unlock stays on pointerdown (it needs the
// earliest gesture); the tick moved to a capture-phase click listener on
// document, and a scroll ends in pointercancel, never in click. The map is a
// <canvas>, never a button, so a map tap never matches: a move plays its own
// walk clip through the dispatch seam. Keyboard and TalkBack activation
// (Enter/Space handlers calling el.click(), TalkBack's double-tap) fire
// click too, so they gain the sound; D-15 accepts that.
//
// R-24 — a guarded element follows its guard, not its marker. guardTap
// stamps aria-disabled="true" on every element it wraps, and the arm sweep
// only clears #enc-panel, #mw-rail and .mw-legend-sheet. paintConditions
// rebuilds #mm-conditions on every paint with a fresh guardTap per chip, and
// #mm-conditions is never swept, so every condition chip carries a stale
// aria-disabled="true" forever. A plain "silent when aria-disabled" rule
// would mute every chip for good. So the shell registers each guarded
// element with the same predicate its onclick checks (encArmed), and
// `armedFor(el)` answers true/false for it at click time (the same task as
// the handler, so the same answer). An element guardTap never wrapped
// answers null and is judged by its own `disabled` and aria-disabled (the
// gear sheet's greyed data-off rows, the ☰ menu's disabled rows).
// DISMISS_SETTLE_MS gates only window.move (the map canvas and keys), which
// never matches a button, so the settle guard has nothing to follow.
//
// R-25 — the skip tap is silent. While a round's beats play, a tap inside
// #enc-panel is D-06's skip: Phase 58's beatHurryTap catches it and it never
// acts, so it makes no tap sound. A locked action (data-locked on it or on
// #cb-act) is silent on its own account.
//
// R-26 — one sound per press. GO DOWN plays `stairs` and STRIKE plays the
// round's first beat; the old pointerdown tick sounded in front of both.
// The decision is made in the capture phase, before any handler runs: it
// snapshots the one-shot count and whether a beat is active, then schedules
// ONE task. The shell's schedule is setTimeout(fn, 0), a task, never a
// microtask: microtasks run between listeners of a user-dispatched event,
// so a microtask would read the count before the target's own handler ran.
// The tap plays only if no one-shot started and no round began in between.
// The title theme's loop is not a one-shot and never counts. A clip that
// starts later than that task (a later beat line) is a new sound, not a
// second one for this press.
//
// R-27 — a long press never clicks. 71-04's suppressor is a window
// capture-phase click listener, the first listener any click meets; after a
// fired long press it calls stopPropagation() on the trailing click, so the
// document capture-phase tap listener never runs. Where Android fires no
// click after a long press, the press is silent anyway.

/** UI_TAP_SELECTOR — the elements a tap sound can belong to (unchanged from Phase 56). */
export const UI_TAP_SELECTOR = 'button, [role="button"]';

function closestOf(el, selector) {
  return el && typeof el.closest === "function" ? el.closest(selector) : null;
}

/**
 * uiTapShouldPlay(target, { armedFor, beatActive }) — true when a click on
 * `target` is a real press on a button that can act. Never throws: any
 * throw answers false (silent).
 */
export function uiTapShouldPlay(target, deps) {
  try {
    const d = deps && typeof deps === "object" ? deps : {};
    if (!target || typeof target.closest !== "function") return false;
    const el = target.closest(UI_TAP_SELECTOR);
    if (!el) return false;
    if (el.disabled === true) return false;
    if (closestOf(el, "[data-locked]")) return false;
    if (typeof d.beatActive === "function" && d.beatActive() === true && closestOf(el, "#enc-panel")) return false;
    const armed = typeof d.armedFor === "function" ? d.armedFor(el) : null;
    if (armed === false) return false;
    if (armed === true) return true;
    const aria = typeof el.getAttribute === "function" ? el.getAttribute("aria-disabled") : null;
    return aria !== "true";
  } catch {
    return false;
  }
}

/**
 * createUiTapSound({ play, clipCount, beatActive, armedFor, schedule }) —
 * { onClick(e) }. onClick only reads: it never stops, prevents or
 * dispatches, and never throws into the click that carries the real action.
 */
export function createUiTapSound(deps) {
  const d = deps && typeof deps === "object" ? deps : {};
  const readCount = () => {
    const n = d.clipCount();
    if (typeof n !== "number") throw new Error("clipCount");
    return n;
  };
  const readBeat = () => (typeof d.beatActive === "function" ? d.beatActive() === true : false);

  function onClick(e) {
    try {
      const target = e ? e.target : null;
      if (!uiTapShouldPlay(target, { armedFor: d.armedFor, beatActive: d.beatActive })) return;
      const count0 = readCount();
      const beat0 = readBeat();
      d.schedule(() => {
        try {
          if (readCount() !== count0) return;
          if (!beat0 && readBeat()) return;
          d.play();
        } catch {
          // silent: a throw means no tap, never an error in the click task.
        }
      });
    } catch {
      // silent: a throwing dep never reaches the click's real handlers.
    }
  }

  return { onClick };
}
