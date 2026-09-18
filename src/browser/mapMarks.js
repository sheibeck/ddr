// src/browser/mapMarks.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 (MAP-07) — the canvas palette, the
// colored mark glyphs and the legend rows the renderer and the MARKS sheet
// both read.
//
// Orchestrator decision 3 (2026-09-16, user-authored, a deliberate
// reversal of the Phase 4 icon decision): coloured text glyphs replace the
// image-based marks on the canvas and the legend rows. The image assets
// and their loader/draw pipeline in src/browser/icons.js stay on disk,
// unreferenced by the map renderer and legend from this phase forward — no
// asset deletion, just an unused pipeline. This module imports ONLY the
// pure feat->key mapper from that sibling module; it never touches the
// image-loading half of that file.
//
// PRESENTATION ONLY, pure module: no DOM/window/timer/storage access
// anywhere in this file.

import { featureKeyForCell } from "./icons.js";

/**
 * MAP_PALETTE — the canvas chrome palette (35-CONTEXT.md's Viewport &
 * movement bullet). `floorDark` is Claude's discretion for a `.dark` tile —
 * the mock has no dark-tile sample of its own.
 */
export const MAP_PALETTE = Object.freeze({
  fog: "#0b0a08",
  wall: "#2c261c",
  wallLight: "#4a3f2c",
  wallDark: "#16120c",
  floor: "#645c48",
  floorDark: "#3d372a",
  floorInset: "#554d3b",
  // Phase 40 (SPELL-05), Plan 05: a spell-revealed cell (cell.spellSeen,
  // engine/maze.js#reveal) — a cool "borrowed sight" tint distinct from
  // every other floor hex, so the player can see what will re-fog when the
  // reveal window expires (draw()'s own sweep never runs early; the cell
  // simply reads P.floor again once `seen` reverts to false).
  floorSpell: "#4e5a6a",
  // Phase 41 (TERR-01), Plan 04: a water cell (cell.water) — `water` for a
  // lit pool, `waterDark` for a pool on a `.dark` tile (the Phase 40
  // spellSeen tint still takes priority over either — see draw()'s water
  // override line). Distinct from floor/floorDark/floorSpell so a pool
  // reads as water at a glance, never mistaken for ordinary or borrowed-
  // sight floor.
  water: "#2f5f7a",
  waterDark: "#1f3a4a",
  border: "#443a26",
  party: "#f4dc94",
  partyGlow: "rgba(232,201,122,.55)",
});

/** MARK_SCALE — a mark glyph draws at 60% of the cell. */
export const MARK_SCALE = 0.6;

/**
 * ONEWAY_ROTATION_DEG — the one-way-door glyph (▲) points NORTH at rest, so
 * (unlike icons.js's PNG-based table, which points EAST at rest) N is the
 * zero-rotation case here: N 0°, E 90°, S 180°, W 270° (clockwise, matching
 * canvas ctx.rotate()'s convention).
 */
export const ONEWAY_ROTATION_DEG = Object.freeze({ N: 0, E: 90, S: 180, W: 270 });

/** MARK_GLYPHS — glyph + colour per mark key (35-CONTEXT.md's colour table). */
export const MARK_GLYPHS = Object.freeze({
  encounter: Object.freeze({ glyph: "●", color: "#e05a48" }),
  teleport: Object.freeze({ glyph: "◆", color: "#a78ce8" }),
  onewaydoor: Object.freeze({ glyph: "▲", color: "#8ec06a" }),
  trap: Object.freeze({ glyph: "✕", color: "#e05a48" }),
  chest: Object.freeze({ glyph: "▪", color: "#d3c49f" }),
  crevice: Object.freeze({ glyph: "⧗", color: "#d3c49f" }),
  descent: Object.freeze({ glyph: "▼", color: "#d3c49f" }),
  // Not in the CONTEXT colour table (climb/wall tiles never draw a mark on
  // the canvas today) — chosen from the Geometric Shapes block for
  // font-fallback safety, matching the family's other glyphs.
  wall: Object.freeze({ glyph: "▤", color: "#d3c49f" }),
  party: Object.freeze({ glyph: "●", color: "#f4dc94" }),
});

/**
 * MARKS_LEGEND — the nine legend rows moved verbatim from mazeworld.html's
 * prior MARKS_LEGEND table (name/desc byte-identical), keyed by `key`
 * (a MARK_GLYPHS key) in place of the old PNG-filename `icon` field.
 */
export const MARKS_LEGEND = Object.freeze([
  Object.freeze({ key: "encounter", name: "ENCOUNTER", desc: "Something gets rolled for you the moment you touch it." }),
  Object.freeze({ key: "teleport", name: "TELEPORT", desc: "Thrown a d20 of squares somewhere you did not choose." }),
  Object.freeze({ key: "onewaydoor", name: "ONE-WAY DOOR", desc: "Go where the arrow points. There is no coming back." }),
  Object.freeze({ key: "trap", name: "TRAP", desc: "A d6 out of you, before you knew it was there." }),
  Object.freeze({ key: "chest", name: "LOCKED BOX", desc: "1–5 on a d10 opens it. The rest costs you a pick." }),
  Object.freeze({ key: "crevice", name: "CREVICE", desc: "Climb it, or fall, and be grateful for half the fall." }),
  Object.freeze({ key: "descent", name: "DESCENT", desc: "The floor below, which is worse in every way." }),
  Object.freeze({
    key: "wall",
    name: "WALL",
    desc: "Climb it on a d10 under your class's number, or fall and eat the difference.",
  }),
  Object.freeze({ key: "party", name: "YOU", desc: "The party marker. Whatever is nearby has already noticed you." }),
]);

/**
 * markForCell(cell) — the {key, glyph, color} to draw for `cell` (a bare
 * feat string or a real floor-cell shape, same acceptance as
 * featureKeyForCell), or null for an unfeatured/unrecognized cell.
 */
export function markForCell(cell) {
  const key = featureKeyForCell(cell);
  return key && MARK_GLYPHS[key] ? { key, ...MARK_GLYPHS[key] } : null;
}

/**
 * legendFor(feat) — the MARKS_LEGEND row for `feat` (mapped through
 * featureKeyForCell first), or null when `feat` doesn't resolve to a known
 * mark key.
 */
export function legendFor(feat) {
  const key = featureKeyForCell(feat);
  if (!key) return null;
  return MARKS_LEGEND.find((row) => row.key === key) || null;
}
