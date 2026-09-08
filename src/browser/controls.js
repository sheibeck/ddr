// src/browser/controls.js
//
// Pure, DOM-free touch-control math: tap-to-cell hit-testing and pointer
// gesture classification (tap vs. pan-drag). Zero DOM/canvas reads, zero
// randomness of any kind — every input is a plain argument, per ENG-02
// purity applied to presentation code (04-01-PLAN.md).
//
// CONTRACT (04-RESEARCH.md Pattern 1 / Anti-Patterns): this module is the
// SINGLE shared source for the cs/pan/DPR affine transform. The Wave-3
// canvas wiring (04-06) MUST import screenToCell from here rather than
// re-deriving the transform inside draw()/the tap handler — computing this
// math twice is guaranteed to drift the moment text-size or pan changes.
//
// screenToCell operates entirely in CSS-px space (the same space every
// ctx.* draw call operates in once ctx.setTransform(dpr,0,0,dpr,0,0) has
// been applied) — callers must NOT multiply/divide by devicePixelRatio
// again here; that scale is already absorbed by the canvas transform.

/** Total pointer travel (px) at/below which a pointerdown->up cycle is a tap. */
export const TAP_MOVE_THRESHOLD_PX = 10;

/** Duration (ms) at/below which a low-travel pointer cycle is a tap. */
export const TAP_MAX_DURATION_MS = 350;

/**
 * screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad)
 *
 * Inverts the SAME forward transform the renderer uses to place the player
 * at the viewport center:
 *   tx = vw/2 - (pos.x + 0.5) * cs - canvasPad + pan.x
 *   ty = vh/2 - (pos.y + 0.5) * cs - canvasPad + pan.y
 *   screenX = tx + cellX * cs   (CSS px)
 *
 * @param {number} clientX - pointer event clientX (CSS px, viewport-relative)
 * @param {number} clientY - pointer event clientY (CSS px, viewport-relative)
 * @param {{left:number, top:number, width:number, height:number}} viewportRect
 * @param {{x:number, y:number}} pos - player's current cell position
 * @param {{x:number, y:number}} pan - camera pan offset (CSS px)
 * @param {number} cs - cell size in CSS px (pre-DPR)
 * @param {number} canvasPad - canvas padding in CSS px
 * @returns {{x:number, y:number}} the integer grid cell under the pointer
 */
export function screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad) {
  const vw = viewportRect.width;
  const vh = viewportRect.height;
  const localX = clientX - viewportRect.left;
  const localY = clientY - viewportRect.top;
  const tx = vw / 2 - (pos.x + 0.5) * cs - canvasPad + pan.x;
  const ty = vh / 2 - (pos.y + 0.5) * cs - canvasPad + pan.y;
  const cellX = Math.floor((localX - tx) / cs);
  const cellY = Math.floor((localY - ty) / cs);
  return { x: cellX, y: cellY };
}

/**
 * resolveTapDirection(pos, tappedCell, isSeen)
 *
 * Returns "N"/"E"/"S"/"W" ONLY when tappedCell is orthogonally adjacent to
 * pos (|dx|+|dy|===1) AND isSeen(tappedCell.x, tappedCell.y) is truthy.
 * Returns null for the same cell, diagonals, distance>1, or unseen cells.
 *
 * isSeen is a predicate (x, y) => boolean, NOT a Set. The live wiring in
 * 04-06 passes `(x, y) => !!(floor.g[y] && floor.g[y][x] && floor.g[y][x].seen)`
 * against the REAL engine/maze.js floor shape (engine/state.js's GameState.floor,
 * g[y][x] = {wall, seen, feat}) — never the design mockup's placeholder Set
 * keyed on "x,y" strings (04-RESEARCH.md Pitfall 1).
 *
 * @param {{x:number, y:number}} pos - player's current cell position
 * @param {{x:number, y:number}} tappedCell - the cell the tap resolved to
 * @param {(x:number, y:number) => boolean} isSeen - seen-cell predicate
 * @returns {"N"|"E"|"S"|"W"|null}
 */
export function resolveTapDirection(pos, tappedCell, isSeen) {
  const dx = tappedCell.x - pos.x;
  const dy = tappedCell.y - pos.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null; // diagonal, same cell, or distance>1
  if (!isSeen(tappedCell.x, tappedCell.y)) return null;
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 0 && dy === 1) return "S";
  if (dx === 0 && dy === -1) return "N";
  return null; // unreachable given the |dx|+|dy|===1 guard above
}

/**
 * classifyPointerGesture(downEvt, upEvt, totalDeltaPx)
 *
 * Returns "tap" when totalDeltaPx <= TAP_MOVE_THRESHOLD_PX AND
 * (upEvt.timeStamp - downEvt.timeStamp) <= TAP_MAX_DURATION_MS; else "drag".
 * A long-press (low travel, over-duration) also classifies as "drag" —
 * v1 reserves long-press with no bound action (04-RESEARCH.md Pattern 2).
 *
 * @param {{timeStamp:number}} downEvt - pointerdown event (or event-shaped object)
 * @param {{timeStamp:number}} upEvt - pointerup event (or event-shaped object)
 * @param {number} totalDeltaPx - total pointer travel distance in CSS px
 * @returns {"tap"|"drag"}
 */
export function classifyPointerGesture(downEvt, upEvt, totalDeltaPx) {
  const duration = upEvt.timeStamp - downEvt.timeStamp;
  if (totalDeltaPx <= TAP_MOVE_THRESHOLD_PX && duration <= TAP_MAX_DURATION_MS) return "tap";
  return "drag";
}
