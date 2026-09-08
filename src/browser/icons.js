// src/browser/icons.js
//
// Feature→PNG-icon mapping (UX-03/UX-08) + preloader/draw helper for the
// user-provided 9 map icons (icons/*.png; see STATE.md "Provided Assets").
// Replaces mazeworld.html draw()'s procedural vector glyphs (lines ~1388-
// 1430) AND the design mockup's Unicode glyphs (CONTEXT.md decision).
//
// FEATURE_ICONS/featureKeyForCell are pure and DOM-free (unit-tested under
// node --test, see test/unit/tutorial.test.js). preloadIcons/drawFeatureIcon
// touch the DOM (Image/CanvasRenderingContext2D) — they are only ever
// INVOKED from browser code, never at this module's top level, so importing
// this module under node --test never throws (no Image() is constructed
// until preloadIcons() actually runs). Fail-open per 04-RESEARCH.md Code
// Example #3: a missing/broken icon just resolves without drawing, never
// blocks boot.

/** The 9 user-provided map icons (icons/*.png), including the player marker. */
export const FEATURE_ICONS = [
  "chest",
  "crevice",
  "descent",
  "encounter",
  "onewaydoor",
  "party",
  "teleport",
  "trap",
  "wall",
];

/** The PNG key used for the player/party marker (not a feature-tile feat). */
export const PLAYER_MARKER_ICON = "party";

/**
 * featureKeyForCell(cell) — maps an engine feat value to one of
 * FEATURE_ICONS, per STATE.md's Provided Assets mapping: dot->encounter,
 * tele->teleport, one->onewaydoor, trap->trap, chest->chest, climb->wall,
 * gorge->crevice, exit/gate->descent. Accepts either the bare feat string or
 * a real engine/maze.js floor-cell shape (g[y][x] = {feat, dir, seen, dark}).
 * Returns null for an unfeatured/unrecognized cell — no icon drawn, never a
 * crash.
 */
export function featureKeyForCell(cell) {
  const feat = typeof cell === "string" ? cell : cell && cell.feat;
  switch (feat) {
    case "dot":
      return "encounter";
    case "tele":
      return "teleport";
    case "one":
      return "onewaydoor";
    case "trap":
      return "trap";
    case "chest":
      return "chest";
    case "climb":
      return "wall";
    case "gorge":
      return "crevice";
    case "exit":
    case "gate":
      return "descent";
    default:
      return null;
  }
}

/**
 * preloadIcons(basePath) — loads every FEATURE_ICONS PNG once at boot,
 * fail-open (a missing/broken icon just resolves without drawing, never
 * blocks boot). Browser-only: constructs `Image()`, so callers must only
 * invoke this after DOM/window exist.
 */
export function preloadIcons(basePath) {
  const map = {};
  const loaded = FEATURE_ICONS.map(
    (name) =>
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => resolve(); // fail-open: never blocks boot
        img.src = `${basePath}/${name}.png`;
        map[name] = img;
      })
  );
  return Promise.all(loaded).then(() => map);
}

/**
 * drawFeatureIcon(ctx, img, dx, dy, size) — draws a preloaded icon centered
 * within a `size`x`size` cell whose top-left is (dx, dy), at
 * Math.round(size * 0.6) per the UI-SPEC's glyph-sizing rule (04-RESEARCH.md
 * Code Example #3). Operates entirely in CSS-px space — `ctx` must already
 * have the DPR transform applied by the caller (canvasSizing.js), so no
 * manual device-pixel-ratio multiplication happens here.
 */
export function drawFeatureIcon(ctx, img, dx, dy, size) {
  const iconSize = Math.round(size * 0.6);
  const ix = dx + (size - iconSize) / 2;
  const iy = dy + (size - iconSize) / 2;
  ctx.drawImage(img, ix, iy, iconSize, iconSize);
}
