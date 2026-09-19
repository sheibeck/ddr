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

/**
 * The distance, in cells, from the party's cell centre to a visible edge of
 * the viewport, below which the camera scrolls to keep the party in view
 * ("within ~1-2 tiles" — quick task 260918-vm3, stationary-camera rule).
 */
export const EDGE_TRIGGER_CELLS = 2;

/**
 * keepInViewAxis(camAxis, partyAxis, spanCells)
 *
 * The one-axis stationary-camera rule: the camera only moves the MINIMUM
 * needed to keep the party inside a margin near a visible edge — it never
 * snaps to centre. `camAxis`/`partyAxis` are grid-point coordinates (cell
 * units, fractional) — the camera coordinate is the grid point pinned under
 * the viewport centre on this axis. The caller runs this once per axis (x
 * and y independently), zero DOM, zero randomness.
 *
 * rest = the margin (in cells) the party rests at from an edge once nudged —
 * at least EDGE_TRIGGER_CELLS + 1 so the party doesn't immediately re-trigger
 * the edge check, and at least a third of the visible span so the margin
 * scales with a larger viewport.
 *
 * If the viewport is too small to hold that margin on both sides (spanCells
 * <= 2 * rest), this axis always centres on the party instead — there's no
 * room for a stationary margin.
 *
 * @param {number} camAxis - current camera coordinate on this axis (cell units)
 * @param {number} partyAxis - the party's cell-centre coordinate on this axis
 * @param {number} spanCells - the visible viewport span on this axis, in cells
 * @returns {number} the camera coordinate to use on this axis
 */
export function keepInViewAxis(camAxis, partyAxis, spanCells) {
  const rest = Math.max(EDGE_TRIGGER_CELLS + 1, spanCells / 3);
  if (spanCells <= 2 * rest) return partyAxis;
  const half = spanCells / 2;
  if (partyAxis - (camAxis - half) < EDGE_TRIGGER_CELLS) return partyAxis - rest + half;
  if (camAxis + half - partyAxis < EDGE_TRIGGER_CELLS) return partyAxis + rest - half;
  return camAxis;
}
