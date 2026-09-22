// src/browser/hudMenu.js
//
// Phase 57 (LAYOUT-04/05), Plan 05 — USER MOCK RULING 2026-09-22: the chip
// band folds into a hamburger (☰) menu on the counters band (band 2),
// amending the 2026-09-21 four-band ruling that retired band 4 into a
// static chip strip. The user's own words: "re-arrange the header rails to
// save space; too many buttons; we don't need more rails on the top;
// consolidate the buttons into a hamburger menu."
//
// USER ICON RULE: the mock's glyphs (☰/◈/⊕/☾/⚙) are
// allowed ONLY in this menu — every other surface keeps the app's own PNG
// icons and wording. The one exception is the centre row's label: "CENTRE
// MAP" is the mock's wording, adopted by USER RULING 2026-09-22 (discovery
// C) in place of the shipped chip's "CENTRE" — the menu now opens from
// every tab, so the row names what it centres.
//
// The four row ids ARE the routing: they are the four legacy chip ids
// (mw-chip-marks, mw-chip-centre, btn-camp, mw-gear-btn), kept so the
// shell's existing listener lines (openMarksLegend, centerMap, openCampSheet,
// openSettingsSheet) route unchanged — a rename here would silently
// disconnect a handler.
//
// Pure, DOM-free, timer-free, storage-free — same house shape as
// src/browser/hudBands.js. Bridged onto the shell as `next: hudMenuNext`.

/**
 * HUD_MENU_ITEMS — the four menu rows, frozen, in the mock's own order:
 * MARKS, CENTRE MAP, MAKE CAMP, SETTINGS. Each row's `id` is the legacy chip
 * id the shell's existing listener already binds; `glyph` is the mock's
 * codepoint (written as a \u escape so the source file stays ASCII); `color`
 * and `size` (px) are the mock's own per-row glyph style.
 */
export const HUD_MENU_ITEMS = Object.freeze([
  Object.freeze({ key: "marks", id: "mw-chip-marks", label: "MARKS", glyph: "◈", color: "#e8c97a", size: 13 }),
  Object.freeze({ key: "centre", id: "mw-chip-centre", label: "CENTRE MAP", glyph: "⊕", color: "#8fb08a", size: 14 }),
  Object.freeze({ key: "camp", id: "btn-camp", label: "MAKE CAMP", glyph: "☾", color: "#b9a4ef", size: 16 }),
  Object.freeze({ key: "settings", id: "mw-gear-btn", label: "SETTINGS", glyph: "⚙", color: "#9a8f76", size: 15 }),
]);

/**
 * HUD_MENU_EVENTS — the six event kinds hudMenuNext() understands, each
 * naming the user action that raises it:
 *   - "toggle"    the ☰ button itself (open when closed, close when open)
 *   - "select"    a menu row was tapped (its own handler already ran; the
 *                 menu closes on the bubble)
 *   - "outside"   a tap landed on the scrim (anywhere but the menu)
 *   - "tab"       the active tab changed (by tap or window.__mzShowTab)
 *   - "encounter" an encounter/combat/death/stair overlay came up
 *   - "escape"    the Escape key, or the Android hardware back button
 */
export const HUD_MENU_EVENTS = Object.freeze(["toggle", "select", "outside", "tab", "encounter", "escape"]);

const TOGGLE_EVENT = HUD_MENU_EVENTS[0];

/**
 * hudMenuNext(open, kind, ctx) -> boolean
 *
 * The whole close policy, in one place: select, a ☰ re-tap, an outside
 * tap, a tab switch, an encounter starting and Escape all close the menu.
 * Opening is refused while an encounter is up (T-57-17). Total over every
 * `open`/`kind`/`ctx` shape — never throws, always returns a strict boolean.
 */
export function hudMenuNext(open, kind, ctx) {
  const isOpen = open === true;
  if (kind === TOGGLE_EVENT) {
    if (isOpen) return false;
    return !(ctx && ctx.encounter === true);
  }
  // Every other kind — every listed HUD_MENU_EVENTS member besides "toggle",
  // and any unknown/missing kind — fail-closed: the menu can only ever end
  // up closed, never stranded open over the map.
  return false;
}
