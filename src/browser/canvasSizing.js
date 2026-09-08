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

const CELL_SIZE_BY_TEXT_SCALE = { S: 28, M: 34, L: 40 };
const DEFAULT_CELL_SIZE = 34; // M default, per 04-UI-SPEC.md

/**
 * cellSizeForTextScale(size)
 *
 * Maps the S/M/L text-size setting to a maze-canvas cell size in CSS px
 * (pre-DPR), per 04-UI-SPEC.md "Maze canvas cell size". Unknown/missing
 * input falls back to the M default (34).
 *
 * @param {"S"|"M"|"L"|*} size
 * @returns {number}
 */
export function cellSizeForTextScale(size) {
  return CELL_SIZE_BY_TEXT_SCALE[size] ?? DEFAULT_CELL_SIZE;
}
