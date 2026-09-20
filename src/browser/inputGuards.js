// src/browser/inputGuards.js
//
// The single home of the two Phase 32 tap-safety timing guards (CMBUI-04/05):
// an arm-delay for freshly rendered decision buttons, and a dismiss-settle
// window after an encounter overlay disappears. Both are plain millisecond
// comparisons — this module
// is DOM-free AND clock-free. Callers pass the current millisecond reading
// as `now` (typically Date.now() at the call site) so the two predicates
// below stay pure and unit-testable without a DOM or a real clock, exactly
// like src/browser/controls.js's own zero-import sibling constants.
//
// Neither guard may ever be re-implemented as a CSS transition/animation:
// the blanket prefers-reduced-motion rule at mazeworld.html ~L773 sets
// `transition:none!important;animation:none!important` for those users,
// which would silently zero a transition-based guard. A Date.now()-style
// comparison has no such escape hatch.

/**
 * Milliseconds a freshly rendered decision button ignores taps after
 * renderEncounter() builds it (CMBUI-04).
 */
export const ARM_DELAY_MS = 250;

/**
 * Milliseconds window.move refuses input after the encounter overlay
 * dismisses (CMBUI-05).
 */
export const DISMISS_SETTLE_MS = 250;

/**
 * stampOf(v)
 *
 * Coerces a timestamp argument to a finite millisecond value, treating any
 * non-finite or missing value (undefined, NaN, etc.) as 0.
 *
 * @param {*} v
 * @returns {number}
 */
function stampOf(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * isArmed(renderedAt, now)
 *
 * True once at least ARM_DELAY_MS have elapsed since renderedAt (the
 * moment renderEncounter() built the button), false while a tap would
 * still be arriving from the gesture that triggered the render itself.
 * True at exactly the threshold, not one ms before it.
 *
 * Fail-open: a non-finite/missing renderedAt (a never-rendered button, or
 * a fresh page with no recorded stamp yet) counts as already armed — the
 * one failure mode this guard must never produce is a permanently
 * unusable button, so "we don't know when it rendered" resolves to
 * "treat it as armed", not to "block forever".
 *
 * @param {number} renderedAt
 * @param {number} now
 * @returns {boolean}
 */
export function isArmed(renderedAt, now) {
  if (!Number.isFinite(renderedAt)) return true;
  return stampOf(now) - renderedAt >= ARM_DELAY_MS;
}

/**
 * isSettled(lastDismissAt, now)
 *
 * True once at least DISMISS_SETTLE_MS have elapsed since lastDismissAt
 * (the moment hasActiveEncounter() transitioned true -> false), false
 * while a movement tap would still be arriving from the gesture that
 * dismissed the encounter overlay itself. True at exactly the threshold,
 * not one ms before it.
 *
 * Fail-open: a non-finite/missing lastDismissAt (no encounter has ever
 * been dismissed yet this session) counts as already settled, for the
 * same reason isArmed above fails open on renderedAt.
 *
 * @param {number} lastDismissAt
 * @param {number} now
 * @returns {boolean}
 */
export function isSettled(lastDismissAt, now) {
  if (!Number.isFinite(lastDismissAt)) return true;
  return stampOf(now) - lastDismissAt >= DISMISS_SETTLE_MS;
}
