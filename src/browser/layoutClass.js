// src/browser/layoutClass.js
//
// Phase 97 (SCREEN-03/04): the screen size classes, one pure constant source.
// No imports, no DOM, no storage, so node tests can load it.
//
// The classes, evaluated in this order (97-CONTEXT.md Area 3):
//   1. short    height < 480 CSS px (a phone turned sideways, a squat split-screen
//               pane): the rail sits beside the map, the tabs in a left rail.
//   2. compact  width < 600: today's single portrait column, unchanged.
//   3. medium   width 600-839: one column, centred and widened, the card rail
//               stays at the bottom.
//   4. expanded width >= 840 and height >= 480: map and rail side by side, the
//               tabs in a left rail, the map stays up while a tab is open.
// Short is tested first, so a screen that is both short and wide is short.
//
// Why 479.98 / 599.98 / 839.98: the CSS thresholds are written as max-* values
// just under the whole number so a fractional CSS-px size (a 2.625 dpr phone
// reports 411.43 px) never falls between two classes. layoutClassFor uses the
// same comparisons, so for every size the pure function and the media strings
// agree (test/unit/layout-class.test.js evaluates the strings against a grid).
// The one exception is the 0.02 px sliver under each whole-number threshold,
// where the "min-*: N" side of a neighbouring query cannot match; no real
// screen reports a size there, and the CSS default (compact) applies.
//
// CSS uses media queries with the exact LAYOUT_MEDIA strings, and JS reads the
// same strings through matchMedia (97-03 installs the shell's layout global),
// so the stylesheet and the script cannot disagree. The phone-only orientation
// rule is a separate DEVICE rule in src/browser/nativeChrome.js, not a size
// class.

/** Thresholds in CSS px. The max-* values sit just under the next whole px. */
export const LAYOUT_BREAKPOINTS = Object.freeze({
  shortMaxHeightPx: 479.98,
  compactMaxWidthPx: 599.98,
  mediumMaxWidthPx: 839.98,
  tallMinHeightPx: 480,
  mediumMinWidthPx: 600,
  expandedMinWidthPx: 840,
});

/**
 * The exact media-query strings. mazeworld.html must contain each one
 * byte-for-byte after "@media ". `side` is short OR expanded: the layouts that
 * put a side panel beside the map and the tabs in a left navigation rail.
 */
export const LAYOUT_MEDIA = Object.freeze({
  short: "(max-height: 479.98px)",
  compact: "(max-width: 599.98px) and (min-height: 480px)",
  medium: "(min-width: 600px) and (max-width: 839.98px) and (min-height: 480px)",
  expanded: "(min-width: 840px) and (min-height: 480px)",
  side: "(max-height: 479.98px), (min-width: 840px) and (min-height: 480px)",
});

/** The --mw-side-w value per side-by-side class (the rail's pane width). */
export const LAYOUT_SIDE_WIDTH = Object.freeze({
  short: "45%",
  expanded: "clamp(360px, 40%, 560px)",
});

/** Text and cards never grow wider than this on a big screen (CSS px). */
export const LAYOUT_READABLE_MAX_PX = 640;

/**
 * layoutClassFor(width, height) -> "short" | "compact" | "medium" | "expanded"
 * Pure; a bad size (NaN, undefined, zero, negative) reads "compact", today's
 * layout.
 */
export function layoutClassFor(width, height) {
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return "compact";
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) return "compact";
  if (height <= LAYOUT_BREAKPOINTS.shortMaxHeightPx) return "short";
  if (width <= LAYOUT_BREAKPOINTS.compactMaxWidthPx) return "compact";
  if (width <= LAYOUT_BREAKPOINTS.mediumMaxWidthPx) return "medium";
  return "expanded";
}

/**
 * currentLayoutClass(matchMediaFn) — the class the live media queries report.
 * Tests short, then expanded, then medium, and falls back to compact, so a
 * missing matchMedia (node, the shell sandbox) or a throwing one reads compact.
 */
export function currentLayoutClass(matchMediaFn) {
  try {
    if (typeof matchMediaFn !== "function") return "compact";
    if (matchMediaFn(LAYOUT_MEDIA.short)?.matches) return "short";
    if (matchMediaFn(LAYOUT_MEDIA.expanded)?.matches) return "expanded";
    if (matchMediaFn(LAYOUT_MEDIA.medium)?.matches) return "medium";
    return "compact";
  } catch {
    return "compact";
  }
}

/** railBesideMap(cls) — true when the rail sits beside the map (short, expanded). */
export function railBesideMap(cls) {
  return cls === "short" || cls === "expanded";
}

/** mapStaysUp(cls) — true when the map stays on screen while a tab is open. */
export function mapStaysUp(cls) {
  return cls === "expanded";
}
