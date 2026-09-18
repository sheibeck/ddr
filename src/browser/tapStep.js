// src/browser/tapStep.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 (MAP-02) — tap-to-step direction
// resolution and hold-inspect copy: the "step toward a distant tap"
// function src/browser/controls.js never had. controls.js's own
// screenToCell/resolveTapDirection stay the SINGLE shared screen->cell
// transform and exact-adjacency building block (untouched by this plan);
// this module adds the missing piece — given the party's position and any
// tapped cell anywhere on the grid, resolve ONE adjacent step toward it
// (dominant axis first, the other axis as fallback), never a diagonal,
// never the raw tap coordinate. controls.js's own TAP_MAX_DURATION_MS
// (350 ms, pinned by test/unit/controls.test.js) is the legacy tap/drag
// split and is left untouched; this module's HOLD_MS (450 ms) is the NEW
// tap/hold boundary the shell wiring (Plans 02-04) uses on top of it.
//
// PRESENTATION ONLY, pure module: no DOM/window/timer/storage access
// anywhere in this file.

import { RAIL_COPY, RAIL_HOLD } from "./rail.js";

/** DIR_VECTORS — the four cardinal step vectors, [dx, dy]. */
export const DIR_VECTORS = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });

/** TAP_MAX_TRAVEL_PX — total pointer travel (CSS px) at/below which a pointer cycle is still a tap or a hold. */
export const TAP_MAX_TRAVEL_PX = 10;

/** HOLD_MS — duration (ms) a pointer must stay down, within TAP_MAX_TRAVEL_PX, to classify as a hold-inspect. */
export const HOLD_MS = 450;

/**
 * resolveStep(pos, target, isOpen) — one adjacent step toward `target` from
 * `pos`: the dominant axis (the larger |delta|; ties prefer the horizontal
 * axis) is tried first; if that candidate cell fails `isOpen`, the other
 * axis is tried ONLY when its own delta is non-zero (a zero-delta axis has
 * no fallback direction to offer). Returns `{kind:"here"}` when `target`
 * equals `pos`, `{kind:"step", dir}` for the first open candidate
 * ("N"/"E"/"S"/"W"), or `{kind:"blocked"}` when every candidate fails (or
 * the inputs are not finite numbers) — never a diagonal, never a raw tap
 * coordinate.
 *
 * @param {{x:number,y:number}} pos - the party's current cell
 * @param {{x:number,y:number}} target - the tapped cell (anywhere on the grid)
 * @param {(x:number, y:number) => boolean} isOpen - predicate: is this cell open to step onto
 * @returns {{kind:"here"}|{kind:"step", dir:"N"|"E"|"S"|"W"}|{kind:"blocked"}}
 */
export function resolveStep(pos, target, isOpen) {
  if (
    !pos ||
    !target ||
    !Number.isFinite(pos.x) ||
    !Number.isFinite(pos.y) ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  ) {
    return { kind: "blocked" };
  }
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  if (dx === 0 && dy === 0) return { kind: "here" };

  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const firstAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const otherAxis = firstAxis === "x" ? "y" : "x";
  const otherDelta = otherAxis === "x" ? dx : dy;

  const candidates = [firstAxis];
  if (otherDelta !== 0) candidates.push(otherAxis);

  const open = typeof isOpen === "function" ? isOpen : () => false;
  for (const axis of candidates) {
    const nx = pos.x + (axis === "x" ? sx : 0);
    const ny = pos.y + (axis === "y" ? sy : 0);
    if (open(nx, ny)) {
      const dir = axis === "x" ? (sx === 1 ? "E" : "W") : sy === 1 ? "S" : "N";
      return { kind: "step", dir };
    }
  }
  return { kind: "blocked" };
}

/**
 * inspectCell(cell, legendFor) — the four hold-inspect cards: a null/
 * undefined cell or a seen wall is SOLID ROCK; an unseen cell is UNWALKED
 * (checked BEFORE the wall test so fog never reveals rock); a seen,
 * non-wall cell with a `feat` that resolves through `legendFor` shows that
 * mark's legend name/description (tone odd, RAIL_HOLD.mark); everything
 * else (a walked, featureless — or unrecognized-feat — cell) is EMPTY
 * CORRIDOR.
 *
 * @param {{seen?:boolean, wall?:boolean, feat?:string|null}|null|undefined} cell
 * @param {(feat: unknown) => {name:string, desc:string}|null} legendFor
 * @returns {{title:string, line:string, tone:"dull"|"odd", hold:number}}
 */
export function inspectCell(cell, legendFor) {
  if (!cell) return { title: RAIL_COPY.rock.title, line: RAIL_COPY.rock.line, tone: "dull", hold: RAIL_HOLD.dull };
  if (!cell.seen) return { title: RAIL_COPY.unwalked.title, line: RAIL_COPY.unwalked.line, tone: "dull", hold: RAIL_HOLD.dull };
  if (cell.wall) return { title: RAIL_COPY.rock.title, line: RAIL_COPY.rock.line, tone: "dull", hold: RAIL_HOLD.dull };
  if (cell.feat) {
    const row = typeof legendFor === "function" ? legendFor(cell.feat) : null;
    if (row) return { title: row.name, line: row.desc, tone: "odd", hold: RAIL_HOLD.mark };
  }
  // Phase 41 (TERR-01/02), Plan 04 — a seen, non-wall, feat-less water cell
  // names itself and its cost on a hold. Checked AFTER the feat branch (a
  // water cell that somehow carries a feature keeps the feature's own
  // legend row) and BEFORE the EMPTY CORRIDOR fallback.
  if (cell.water) return { title: RAIL_COPY.water.title, line: RAIL_COPY.water.line, tone: "odd", hold: RAIL_HOLD.mark };
  return { title: RAIL_COPY.empty.title, line: RAIL_COPY.empty.line, tone: "dull", hold: RAIL_HOLD.dull };
}
