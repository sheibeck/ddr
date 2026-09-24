// src/browser/longPress.js
//
// Phase 71 (POLISH-08, D-08) — the long-press recognizer for the combat foe
// cards. It is D-08's gesture: fire once the pointer has stayed down for the
// hold, and cancel on move (travel past the limit), on a scroll, on a
// pointercancel, or on a second finger.
//
// The thresholds mirror the map's hold-inspect constants: HOLD_MS (450 ms)
// and TAP_MAX_TRAVEL_PX (10 px) come from src/browser/tapStep.js, imported,
// never retyped, so a foe card and a map cell hold for the same time.
//
// The click-suppression contract (D-08, R-17): a long press must never also
// fire the short tap. After a press fires, the browser still delivers a
// click when the finger lifts. The shell's ONE window capture-phase click
// listener asks consumeClick() first; it answers true exactly once after a
// fired press, and the listener then stops that click before any other
// listener (the foe card's aim, #enc-panel's beatHurryTap) can see it. The
// answer is bounded (CLICK_SUPPRESS_MS after the lift) and cleared by the
// next down, so a click the browser never sent can never swallow a later
// tap.
//
// PRESENTATION ONLY, pure factory: no DOM, window or clock access except
// through the injected setTimeout/clearTimeout/now. Never throws on a
// missing or malformed pointer.

import { HOLD_MS, TAP_MAX_TRAVEL_PX } from "./tapStep.js";

/** CLICK_SUPPRESS_MS — how long after the lift a fired press still swallows its trailing click. */
export const CLICK_SUPPRESS_MS = 700;

const finite = (n) => typeof n === "number" && Number.isFinite(n);

/** ptr(p) — { id, x, y, foe } for a usable pointer record, else null. */
function ptr(p) {
  if (!p || typeof p !== "object") return null;
  if (!finite(p.x) || !finite(p.y)) return null;
  return { id: p.id, x: p.x, y: p.y, foe: p.foe };
}

/**
 * createLongPress(opts) — { down, move, up, cancel, consumeClick }.
 *   opts.holdMs       the hold (default HOLD_MS)
 *   opts.maxTravel    the travel limit in CSS px (default TAP_MAX_TRAVEL_PX)
 *   opts.setTimeout / opts.clearTimeout / opts.now   the injected clock
 *   opts.onLongPress(foe)   called once when a press fires
 * Pointer records are { id, x, y, foe }.
 */
export function createLongPress(opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const holdMs = finite(o.holdMs) ? o.holdMs : HOLD_MS;
  const maxTravel = finite(o.maxTravel) ? o.maxTravel : TAP_MAX_TRAVEL_PX;
  const setT = typeof o.setTimeout === "function" ? o.setTimeout : null;
  const clearT = typeof o.clearTimeout === "function" ? o.clearTimeout : () => {};
  const now = typeof o.now === "function" ? o.now : () => 0;
  const onLongPress = typeof o.onLongPress === "function" ? o.onLongPress : () => {};

  let active = null; // { id, x0, y0, foe, timer, fired }
  let suppress = null; // { at } while a fired press's trailing click is owed

  function clearTimer() {
    if (active && active.timer != null) {
      try {
        clearT(active.timer);
      } catch {
        /* a failing clearTimeout must not break the gesture */
      }
      active.timer = null;
    }
  }

  function cancel() {
    clearTimer();
    active = null;
    suppress = null;
  }

  function down(p) {
    const q = ptr(p);
    suppress = null; // a new gesture owns its own click
    if (active) {
      // A second finger (or a stray repeat): cancel both, nothing fires.
      cancel();
      return;
    }
    if (!q || !setT) return;
    const press = { id: q.id, x0: q.x, y0: q.y, foe: q.foe, timer: null, fired: false };
    active = press;
    try {
      press.timer = setT(() => {
        if (active !== press) return;
        press.timer = null;
        press.fired = true;
        suppress = { at: now() };
        try {
          onLongPress(press.foe);
        } catch {
          /* the hook's failure must not unsettle the recognizer */
        }
      }, holdMs);
    } catch {
      active = null;
    }
  }

  function move(p) {
    const q = ptr(p);
    if (!active || !q || q.id !== active.id || active.fired) return;
    if (Math.hypot(q.x - active.x0, q.y - active.y0) > maxTravel) {
      clearTimer();
      active = null;
    }
  }

  function up(p) {
    if (!active) return { fired: false };
    const q = ptr(p);
    if (q && q.id !== active.id) return { fired: false };
    const fired = active.fired;
    clearTimer();
    active = null;
    if (fired && suppress) suppress = { at: now() };
    return { fired };
  }

  function consumeClick() {
    const owed = suppress;
    suppress = null;
    if (!owed) return false;
    return now() - owed.at <= CLICK_SUPPRESS_MS;
  }

  return { down, move, up, cancel, consumeClick };
}
