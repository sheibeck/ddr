// src/browser/canvasSizing.js
//
// Pure DPR canvas-sizing math, extracted from mazeworld.html's existing
// fit() (lines ~1325-1335) without rewriting its DPR mechanism. Zero DOM
// reads of any kind — the caller passes the measured CSS px and the device
// pixel ratio in; this module only does the arithmetic.
//
// CONTRACT (04-RESEARCH.md Code Example #1 / Pattern 1): this is the SINGLE
// shared source for the backing-store invariant (cv.width/cv.height =
// cssPx * dpr, cv.style.width/height = cssPx). The Wave-3 canvas wiring
// (04-06) MUST call computeCanvasBacking from here rather than re-deriving
// the DPR math inline — every ctx.* draw call after ctx.setTransform(dpr,
// 0, 0, dpr, 0, 0) then operates purely in CSS-px space (see controls.js's
// screenToCell, which shares that same CSS-px space for hit-testing).

/**
 * computeCanvasBacking(cssPx, dpr)
 *
 * @param {number} cssPx - the canvas's CSS (style) size, unscaled
 * @param {number} dpr - the device pixel ratio (may be fractional, e.g. 2.625)
 * @returns {{backing:number, style:number}} backing === style * dpr, always
 */
export function computeCanvasBacking(cssPx, dpr) {
  return { backing: cssPx * dpr, style: cssPx };
}

// Device-review revision (04-CONTEXT.md "Device-review revisions
// (2026-09-08)" #1): the original 04-UI-SPEC.md values (28/34/40) read too
// small on-device (Pixel 7) — the viewport pans/crops the full grid, so
// fewer, larger cells (+ PNG icons, which scale with CELL) around the
// player is the intended feel. Bumped to 48/60/72, M(60) still the default.
const CELL_SIZE_BY_TEXT_SCALE = { S: 48, M: 60, L: 72 };
const DEFAULT_CELL_SIZE = 60; // M default, per device-review revision above

/**
 * cellSizeForTextScale(size)
 *
 * Maps the S/M/L text-size setting to a maze-canvas cell size in CSS px
 * (pre-DPR), per the device-review revision above (supersedes the original
 * 04-UI-SPEC.md "Maze canvas cell size" values). Unknown/missing input
 * falls back to the M default (60).
 *
 * @param {"S"|"M"|"L"|*} size
 * @returns {number}
 */
export function cellSizeForTextScale(size) {
  return CELL_SIZE_BY_TEXT_SCALE[size] ?? DEFAULT_CELL_SIZE;
}

// Phase 97 (SCREEN-04, 97-CONTEXT.md Area 3 "Map scale on big screens"): a
// bigger screen gets bigger cells. The screen scale rides on top of the S/M/L
// cell and the pinch zoom; fog still limits what is seen, so difficulty does
// not move. Curve and cap are Claude's Discretion "Cell scaling".
//
//   - WINDOW_CELL_BASE_PX 412: a Pixel 7's shorter side, the size today's cells
//     were tuned on. A screen whose shorter side is 412 or less scales by 1, so
//     every phone's cell is byte-for-byte what it was.
//   - The scale follows the SHORTER side, so rotating never changes it (a
//     rotation re-lays out without resizing the map) and folding does.
//   - CELL_MAX_PX 144: today's largest cell (L 72 at ZOOM_MAX 2.0). Capping
//     here keeps a tablet's canvas backing store no larger than a phone's
//     already is, since the canvas is CELL x 21 CSS px square times dpr.
export const WINDOW_CELL_BASE_PX = 412;
export const WINDOW_CELL_SLOPE_PX = 800;
export const WINDOW_CELL_SCALE_MAX = 1.5;
export const CELL_MAX_PX = 144;

/**
 * cellScaleForWindow(width, height) — 1 up to a 412 px shorter side, then
 * 1 + (shorter - 412) / 800, capped at 1.5. A bad size reads 1.
 */
export function cellScaleForWindow(width, height) {
  const shorter = Math.min(width, height);
  if (typeof shorter !== "number" || !Number.isFinite(shorter) || shorter <= 0) return 1;
  return Math.min(WINDOW_CELL_SCALE_MAX, Math.max(1, 1 + (shorter - WINDOW_CELL_BASE_PX) / WINDOW_CELL_SLOPE_PX));
}

/**
 * cellPxFor(baseCell, zoom, windowScale) — the maze cell in CSS px:
 * Math.max(6, Math.min(CELL_MAX_PX, Math.round(baseCell * zoom * scale))). A
 * scale that is not a positive finite number reads 1, which is exactly the
 * pre-Phase-97 Math.max(6, Math.round(baseCell * zoom)) for any phone-sized
 * cell (the cap only bites above today's largest cell, 144).
 */
export function cellPxFor(baseCell, zoom, windowScale) {
  const s = Number.isFinite(windowScale) && windowScale > 0 ? windowScale : 1;
  return Math.max(6, Math.min(CELL_MAX_PX, Math.round(baseCell * zoom * s)));
}
