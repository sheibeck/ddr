// src/browser/arrowPad.js
//
// Phase 78 (HUD-08, the user's 2026-09-25 request), Plan 07 — the opt-in
// on-screen arrow pad's copy and pure view model. Settings › Movement picks
// TAP TO MOVE (the default, and complete on its own) or ARROWS; in arrow
// mode a four-way pad sits over the map in the bottom corner Settings ›
// Pad names (settings.js#SETTINGS_DEFAULTS `movement`/`padSide`). Each
// press is ONE step through window.move, the same choke point a tap step
// and a keyboard arrow use; the shell (mazeworld.html) owns that wiring and
// the pad's placement. Nothing else depends on the pad.
//
// PRESENTATION ONLY, pure module: no DOM/window/timer/storage access
// anywhere in this file, and no imports (the tapStep.js house style:
// frozen constants plus pure functions over plain arguments).

/**
 * ARROW_PAD_COPY — the pad's TalkBack labels: one per button, plus the
 * pad's own accessible name (its role="group" label).
 */
export const ARROW_PAD_COPY = Object.freeze({
  pad: "Arrow pad",
  N: "Step north",
  E: "Step east",
  S: "Step south",
  W: "Step west",
});

/**
 * ARROW_PAD_DIRS — the four buttons in DOM (and TalkBack) order N, E, S, W,
 * each with its place in the 3 x 3 cross (row/col 1-3) and its arrow glyph.
 */
export const ARROW_PAD_DIRS = Object.freeze([
  Object.freeze({ dir: "N", row: 1, col: 2, glyph: "▲" }),
  Object.freeze({ dir: "E", row: 2, col: 3, glyph: "▶" }),
  Object.freeze({ dir: "S", row: 3, col: 2, glyph: "▼" }),
  Object.freeze({ dir: "W", row: 2, col: 1, glyph: "◀" }),
]);

/** ARROW_PAD_DEFAULT_SIDE — BOTTOM RIGHT (a right thumb's corner); one constant to change. */
export const ARROW_PAD_DEFAULT_SIDE = "right";

/**
 * arrowPadModel(settings, ctx) — what the shell renders for the pad.
 *
 * `mode` is "arrows" only when `settings.movement === "arrows"`; anything
 * else (missing, unknown, tampered) reads as "tap". `side` follows
 * `settings.padSide` ("left" | "right", else ARROW_PAD_DEFAULT_SIDE).
 * `visible` is true only in arrow mode while the map takes input: `ctx.run`
 * is not false (a run exists), the hero is not dead, nothing is over the
 * map (`ctx.encounter`: combat, a store, the stair prompt, any over-map
 * overlay) and no sheet covers it (`ctx.sheet`) — exactly when a map tap
 * would act. A missing ctx hides the pad.
 *
 * @param {{movement?: string, padSide?: string}|null|undefined} settings
 * @param {{run?: boolean, dead?: boolean, encounter?: boolean, sheet?: boolean}|null|undefined} ctx
 * @returns {{mode: "tap"|"arrows", visible: boolean, side: "left"|"right", label: string,
 *   buttons: Array<{dir: "N"|"E"|"S"|"W", label: string, glyph: string, row: number, col: number}>}}
 */
export function arrowPadModel(settings, ctx) {
  const s = settings && typeof settings === "object" ? settings : {};
  const mode = s.movement === "arrows" ? "arrows" : "tap";
  const side = s.padSide === "left" || s.padSide === "right" ? s.padSide : ARROW_PAD_DEFAULT_SIDE;
  const open = !!ctx && typeof ctx === "object" && ctx.run !== false && !ctx.dead && !ctx.encounter && !ctx.sheet;
  return {
    mode,
    visible: mode === "arrows" && open,
    side,
    label: ARROW_PAD_COPY.pad,
    buttons: ARROW_PAD_DIRS.map((d) => ({ dir: d.dir, label: ARROW_PAD_COPY[d.dir], glyph: d.glyph, row: d.row, col: d.col })),
  };
}
