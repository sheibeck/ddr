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
