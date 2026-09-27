// src/browser/sliderGesture.js
//
// Phase 78 (HUD-05), Plan 02 — when a pointer on a volume slider may move
// the volume. The 2026-09-24 device report: dragging the Settings sheet up
// or down with a finger that happened to start on a MASTER / MUSIC /
// EFFECTS slider scrubbed that volume, because a native range input takes
// every pointer that lands on it. The rule (78-CONTEXT HUD-05): a vertical
// drag anywhere on the sheet scrolls it; a slider moves ONLY on a deliberate
// sideways drag that STARTS on its track, or on a tap on its track; a drag
// that starts vertical never changes a volume.
//
// The shell turns the range inputs' own pointer input off (they stay
// focusable, so the keyboard and TalkBack keep their `input` / `change`
// path) and feeds each row's pointer events through sliderGestureNext,
// which answers with one effect:
//   { live: n }    — apply level n now, in memory only (Phase 71 R-02);
//   { commit: n }  — persist level n once (the EFFECTS preview tap follows);
//   { restore: n } — put the level back to n: no storage, no sound;
//   null           — nothing to do.
//
// PRESENTATION ONLY, pure module (the src/browser/tapStep.js house shape):
// frozen constants and pure functions, no DOM, window, timer or storage.

/** SLIDER_SLOP_PX — travel (CSS px, per axis) at or below which a gesture is still undecided. */
export const SLIDER_SLOP_PX = 8;

/** SLIDER_IDLE — the state with no gesture in progress. */
export const SLIDER_IDLE = Object.freeze({ phase: "idle" });

const finite = (n) => typeof n === "number" && Number.isFinite(n);

/**
 * classifySliderGesture(dx, dy) -> "pending" | "horizontal" | "vertical".
 * Within SLIDER_SLOP_PX on both axes (the threshold itself included) the
 * gesture is "pending". Past it, the gesture is "horizontal" only when its
 * sideways travel is STRICTLY greater than its vertical travel; anything
 * else, a tie included, is "vertical" (the sheet's scroll wins). Non-finite
 * travel is "pending": it can never move a volume.
 */
export function classifySliderGesture(dx, dy) {
  if (!finite(dx) || !finite(dy)) return "pending";
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax <= SLIDER_SLOP_PX && ay <= SLIDER_SLOP_PX) return "pending";
  return ax > ay ? "horizontal" : "vertical";
}

/**
 * sliderValueAt(clientX, rect, { min, max, step, inset }) -> number | null.
 * The level at a horizontal position on a track whose box is `rect`
 * ({ left, width }). `inset` (default 0) trims each end — a native range
 * input's thumb centre travels from left + thumb/2 to right - thumb/2 — so
 * the level under the finger matches the thumb. Positions outside the
 * track clamp to min / max; the level rounds to `step`. A zero-width track
 * (after the inset) or any non-finite input returns null.
 */
export function sliderValueAt(clientX, rect, { min = 0, max = 100, step = 1, inset = 0 } = {}) {
  if (!rect || !finite(clientX) || !finite(rect.left) || !finite(rect.width)) return null;
  if (!finite(min) || !finite(max) || !finite(step) || !finite(inset) || step <= 0 || max < min) return null;
  const span = rect.width - 2 * inset;
  if (!(span > 0)) return null;
  const t = Math.min(1, Math.max(0, (clientX - rect.left - inset) / span));
  const raw = min + Math.round((t * (max - min)) / step) * step;
  return Math.min(max, Math.max(min, raw));
}

function gesture(fields) {
  return Object.freeze(fields);
}

/**
 * sliderGestureNext(state, event) -> { state, effect }.
 * `event.type` is "down" | "move" | "up" | "cancel" with a `pointerId`;
 * "down" also carries `x`, `y`, `startValue` (the level before the
 * gesture), `rect` and `range` (sliderValueAt's options); "move" and "up"
 * carry `x`, `y`.
 *   - idle: a usable "down" starts a pending gesture; anything else is
 *     ignored (a move or release with no matching down does nothing).
 *   - any "down" while a gesture is in progress (a second pointer) cancels
 *     it: restore, no commit.
 *   - a move or release from any other pointer is ignored.
 *   - pending: a move classifies the travel from the down point; horizontal
 *     goes live at the finger's level, vertical restores the start level
 *     and the gesture is then inert until it ends; a release while still
 *     pending is a tap and commits the level under the finger.
 *   - horizontal: each move goes live; the release commits the last live
 *     level, once.
 *   - vertical: nothing ever changes; the release ends it quietly.
 *   - "cancel" restores the start level and commits nothing.
 */
export function sliderGestureNext(state, event) {
  const s = state && typeof state.phase === "string" ? state : SLIDER_IDLE;
  const type = event?.type;
  const none = (next = s) => ({ state: next, effect: null });

  if (s.phase === "idle") {
    if (type !== "down") return none(SLIDER_IDLE);
    const range = event.range || {};
    const probe = sliderValueAt(event.x, event.rect, range);
    if (probe === null || !finite(event.y) || !finite(event.startValue)) return none(SLIDER_IDLE);
    return none(
      gesture({
        phase: "pending",
        pointerId: event.pointerId,
        x0: event.x,
        y0: event.y,
        startValue: event.startValue,
        rect: Object.freeze({ left: event.rect.left, width: event.rect.width }),
        range: Object.freeze({ ...range }),
        lastValue: null,
      }),
    );
  }

  const restore = () => ({ state: SLIDER_IDLE, effect: { restore: s.startValue } });

  if (type === "down") return restore();
  if (type !== "move" && type !== "up" && type !== "cancel") return none();
  if (event.pointerId !== s.pointerId) return none();
  if (type === "cancel") return restore();

  const valueAt = (x) => sliderValueAt(x, s.rect, s.range);

  if (s.phase === "pending") {
    if (type === "up") {
      const v = valueAt(finite(event.x) ? event.x : s.x0);
      return v === null ? restore() : { state: SLIDER_IDLE, effect: { commit: v } };
    }
    const kind = classifySliderGesture(event.x - s.x0, event.y - s.y0);
    if (kind === "pending") return none();
    if (kind === "vertical") return { state: gesture({ ...s, phase: "vertical" }), effect: { restore: s.startValue } };
    const v = valueAt(event.x);
    if (v === null) return none(gesture({ ...s, phase: "horizontal" }));
    return { state: gesture({ ...s, phase: "horizontal", lastValue: v }), effect: { live: v } };
  }

  if (s.phase === "horizontal") {
    if (type === "up") {
      const v = s.lastValue ?? valueAt(event.x);
      return v === null ? restore() : { state: SLIDER_IDLE, effect: { commit: v } };
    }
    const v = valueAt(event.x);
    if (v === null || v === s.lastValue) return none();
    return { state: gesture({ ...s, lastValue: v }), effect: { live: v } };
  }

  // vertical: inert until it ends.
  if (type === "up") return none(SLIDER_IDLE);
  return none();
}
