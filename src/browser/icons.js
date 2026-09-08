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
 * DR5 ("One-way-door icon rotates to its passable direction"): the base
 * onewaydoor.png is drawn pointing East/right. The engine's one-way-door
 * cells (engine/maze.js) carry a `.dir` field ("N"/"E"/"S"/"W" — the axis
 * the door opens along) that mazeworld.html's draw() passes through to
 * drawFeatureIcon below. Degrees are clockwise (canvas ctx.rotate()'s own
 * convention, since the canvas y-axis points down — a positive rotation
 * visually turns the image clockwise on screen), so E (already pointing
 * right) needs 0°, S needs a quarter-turn clockwise (90°), W needs a
 * half-turn (180°), and N needs a quarter-turn counter-clockwise (270°).
 * Any `dir` value NOT in this map (including undefined, used by every
 * OTHER feature icon + the player marker) fails open — drawFeatureIcon
 * falls through to the plain, unrotated draw path below, exactly as it did
 * before this map existed.
 */
const ONEWAYDOOR_ROTATION_DEG = { N: 270, E: 0, S: 90, W: 180 };

/**
 * drawFeatureIcon(ctx, img, dx, dy, size, dir) — draws a preloaded icon
 * centered within a `size`x`size` cell whose top-left is (dx, dy), at
 * Math.round(size * 1.08) — device-review round 4 ("Icons even bigger":
 * 04-CONTEXT.md/04-DR4) bumped this again from round 2's 0.94 factor so a
 * feature icon fills/slightly overflows the cell instead of merely nearly
 * filling it, matching the mock's big, unmissable map marks. A factor above
 * 1.0 means the icon is intentionally drawn a little larger than its cell
 * (centered, so it overflows evenly on all 4 sides into the neighboring
 * grid lines) rather than inset within it. Operates entirely in CSS-px
 * space — `ctx` must already have the DPR transform applied by the caller
 * (canvasSizing.js), so no manual device-pixel-ratio multiplication happens
 * here.
 *
 * `dir` (optional, DR5) — when it's a recognized ONEWAYDOOR_ROTATION_DEG
 * key, the icon is rotated about the cell's center by that many degrees
 * before drawing. Omit it (or pass an unrecognized value) to draw
 * unrotated, exactly as every non-door icon and the player marker do.
 */
export function drawFeatureIcon(ctx, img, dx, dy, size, dir) {
  const iconSize = Math.round(size * 1.08);
  const rotationDeg = dir !== undefined ? ONEWAYDOOR_ROTATION_DEG[dir] : undefined;
  if (rotationDeg !== undefined) {
    const cx = dx + size / 2, cy = dy + size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(img, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    ctx.restore();
    return;
  }
  const ix = dx + (size - iconSize) / 2;
  const iy = dy + (size - iconSize) / 2;
  ctx.drawImage(img, ix, iy, iconSize, iconSize);
}
