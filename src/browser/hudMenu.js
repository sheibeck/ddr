// src/browser/hudMenu.js
//
// Phase 57 (LAYOUT-04/05), Plan 05 — USER MOCK RULING 2026-09-22: the chip
// band folds into a hamburger (☰) menu on the counters band (band 2),
// amending the 2026-09-21 four-band ruling that retired band 4 into a
// static chip strip. The user's own words: "re-arrange the header rails to
// save space; too many buttons; we don't need more rails on the top;
// consolidate the buttons into a hamburger menu."
//
// USER ICON RULE: the mock's glyphs (☰/◈/☾/⚙) are allowed ONLY in this
// menu — every other surface keeps the app's own PNG icons and wording.
//
// The first three row ids are the routing: they are the three legacy chip
// ids (btn-camp, mw-chip-marks, mw-gear-btn), kept so the shell's existing
// listener lines (openCampSheet, openMarksLegend, openSettingsSheet) route
// unchanged — a rename here would silently disconnect a handler. The two
// Phase 79.3 rows carry their own ids (mw-menu-report, mw-menu-notes) and
// handlers (79.3-05, 79.3-07).
//
// Phase 85 (85-01, ACCT-03): the user dropped the CENTRE MAP row and its
// wiring on 2026-09-28 and put MAKE CAMP first under the account block —
// the map re-centres on its own at the stairs, at a teleport, on a new run
// and on the boot paint, so a menu row for it was redundant.
//
// Phase 85 (85-01, ACCT-03): the ☰ face wears the handle's initials avatar
// while Compete is ON (src/browser/account.js#accountMenuView), and the
// plain ☰ glyph otherwise. Per D-06 the two quit rows (SAVE & QUIT and
// ABANDON THIS CHARACTER, NEW CHARACTER once the hero is dead) live in this
// menu too. Abandon has an in-row two-tap arm with no modal (abandonRowNext
// below); Settings › Confirm abandon governs the arm (draft DISC-1): On
// means two taps, Off means one. The shell owns the ABANDON_ARM_MS timer
// and feeds its expiry back in as a "timeout" event.
//
// Phase 70 (POLISH-03, D-08): the menu opens on every screen — the map,
// combat and every other encounter, the Oracle, all five tabs and while
// dead. Rows that cannot act in the current context are shown disabled
// (dimmed, not hidden, no action) by hudMenuRowStates below; the shell's
// syncHudMenuRows writes its answer onto the seven row buttons.
//
// Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): REPORT A BUG and PATCH NOTES join
// the dropdown after SETTINGS and before the split line. hudMenuRowStates
// returns x7, and both new rows are always enabled — never disabled, for
// any ctx, including a hostile one.
//
// Pure, DOM-free, timer-free, storage-free — same house shape as
// src/browser/hudBands.js. Bridged onto the shell as
// `{ next: hudMenuNext, rows: hudMenuRowStates }`.

/**
 * HUD_MENU_ITEMS — the five menu rows, frozen, in dropdown order: MAKE
 * CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES. The first three rows'
 * `id` is the legacy chip id the shell's existing listener already binds;
 * the two Phase 79.3 rows (report, notes) carry their own ids
 * (mw-menu-report, mw-menu-notes) and handlers (79.3-05, 79.3-07). `glyph`
 * is the mock's codepoint (written as a literal character so the source
 * stays readable); `color` and `size` (px) are the mock's own per-row glyph
 * style.
 *
 * Phase 85 (85-01, ACCT-03): MAKE CAMP moved to the first row under the
 * account block, above MARKS, and the CENTRE MAP row is gone entirely.
 *
 * Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): REPORT A BUG and PATCH NOTES sit
 * after SETTINGS and before the split line that starts the quit rows. Both
 * are always enabled (see hudMenuRowStates below) — never disabled, on any
 * screen, dead or alive.
 */
export const HUD_MENU_ITEMS = Object.freeze([
  Object.freeze({ key: "camp", id: "btn-camp", label: "MAKE CAMP", glyph: "☾", color: "#b9a4ef", size: 16 }),
  Object.freeze({ key: "marks", id: "mw-chip-marks", label: "MARKS", glyph: "◈", color: "#e8c97a", size: 13 }),
  Object.freeze({ key: "settings", id: "mw-gear-btn", label: "SETTINGS", glyph: "⚙", color: "#9a8f76", size: 15 }),
  Object.freeze({ key: "report", id: "mw-menu-report", label: "REPORT A BUG", glyph: "✎", color: "#d9826b", size: 14 }),
  Object.freeze({ key: "notes", id: "mw-menu-notes", label: "PATCH NOTES", glyph: "¶", color: "#8fb3c9", size: 15 }),
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
 * A toggle on a closed menu always opens it: Phase 70 D-08 lifted the
 * Phase 57 T-57-17 refusal, so the menu opens whatever the context. `ctx`
 * is no longer read; the parameter stays so every caller's shape is
 * unchanged (what a row can do in context is hudMenuRowStates' job). Total
 * over every `open`/`kind`/`ctx` shape — never throws, always returns a
 * strict boolean.
 */
export function hudMenuNext(open, kind, ctx) {
  const isOpen = open === true;
  if (kind === TOGGLE_EVENT) return !isOpen;
  // Every other kind — every listed HUD_MENU_EVENTS member besides "toggle",
  // and any unknown/missing kind — fail-closed: the menu can only ever end
  // up closed, never stranded open over the map.
  return false;
}

// ─── Phase 70 (D-03, D-06): the ☰ glyph and the quit rows ────────────────

/**
 * HUD_MENU_GLYPH — the ☰ codepoint (U+2630, 9776), written as an escape so
 * the source stays ASCII. The menu button's face while Compete is OFF; the
 * button wears the handle's initials avatar instead while Compete is ON
 * (src/browser/account.js#accountMenuView) — Phase 85 (85-01, ACCT-03).
 */
export const HUD_MENU_GLYPH = "☰";

/**
 * HUD_MENU_QUIT_COPY — the two quit rows' labels (D-06). `abandon` is the
 * live hero's row at rest, `armed` the same row after the first tap (the
 * second tap buries them), `newCharacter` the row once the hero is dead.
 */
export const HUD_MENU_QUIT_COPY = Object.freeze({
  saveQuit: "SAVE & QUIT",
  abandon: "ABANDON THIS CHARACTER",
  armed: "TAP AGAIN TO BURY THEM",
  newCharacter: "NEW CHARACTER",
});

/** ABANDON_ARM_MS — how long an armed Abandon row waits for its second tap. */
export const ABANDON_ARM_MS = 3000;

/**
 * ABANDON_ROW_EVENTS — the event kinds abandonRowNext() understands:
 *   - "tap"      the Abandon / New character row was tapped
 *   - "timeout"  the shell's ABANDON_ARM_MS timer ran out
 *   - "close"    the menu closed (any hudMenuNext close)
 */
export const ABANDON_ROW_EVENTS = Object.freeze(["tap", "timeout", "close"]);

const TAP_EVENT = ABANDON_ROW_EVENTS[0];

/** Read one ctx flag; a non-object or a hostile getter reads as undefined. */
function flag(ctx, key) {
  if (ctx === null || typeof ctx !== "object") return undefined;
  try {
    return ctx[key];
  } catch {
    return undefined;
  }
}

const REST = Object.freeze({ armed: false, act: null });
const ARMED = Object.freeze({ armed: true, act: null });
const ABANDON = Object.freeze({ armed: false, act: "abandon" });
const NEW_CHARACTER = Object.freeze({ armed: false, act: "newCharacter" });

/**
 * abandonRowNext(armed, kind, ctx) -> frozen { armed, act }
 *
 * The whole two-tap arm (D-06). ctx is { dead, confirm }:
 *   - a tap with the hero dead (ctx.dead strictly true) is NEW CHARACTER,
 *     whatever the arm state;
 *   - a live tap with confirm required arms the row, and a tap on an
 *     already-armed row (strictly true) abandons;
 *   - confirm is required unless ctx.confirm is strictly false (the player
 *     turned Settings › Confirm abandon Off) — a missing, hostile or
 *     non-boolean ctx is fail-safe, so the first tap only ever arms;
 *   - "timeout", "close" and any unknown or missing kind disarm.
 * act is null, "abandon" or "newCharacter". Total: never throws.
 */
export function abandonRowNext(armed, kind, ctx) {
  if (kind !== TAP_EVENT) return REST;
  if (flag(ctx, "dead") === true) return NEW_CHARACTER;
  const confirm = flag(ctx, "confirm") !== false;
  if (!confirm || armed === true) return ABANDON;
  return ARMED;
}

// ─── Phase 70 (D-08): the rows' availability in context ──────────────────

const QUIT_ROW_IDS = Object.freeze({ saveQuit: "mw-menu-save-quit", abandon: "mw-menu-abandon" });

/**
 * hudMenuRowStates(ctx) -> frozen [{ key, id, enabled }] x7, in dropdown
 * order: MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES
 * (HUD_MENU_ITEMS' ids), then SAVE & QUIT and ABANDON / NEW CHARACTER (the
 * 70-03 quit-row ids). Phase 85 (85-01, ACCT-03): the CENTRE MAP row is
 * gone, so it no longer appears here.
 *
 * ctx is { encounter, dead, hero } (D-08, planner ruling R-A):
 *   - SETTINGS, SAVE & QUIT and ABANDON are always enabled — the way back
 *     to the title never closes, dead or alive (HUD-02's no-trap rule);
 *   - REPORT A BUG and PATCH NOTES are always enabled (Phase 79.3 BUG-01
 *     D-08, NOTES-02 D-20) — on every screen, dead or alive, hostile ctx
 *     included; hudMenuRowStates must never disable them;
 *   - MARKS is disabled while the hero is dead (ctx.dead strictly true).
 *     Phase 78 (HUD-02, the user's words: "once the hero is dead ... camp,
 *     marks and centre-map are inert" — the centre-map disable retired with
 *     the row itself in Phase 85);
 *   - MAKE CAMP, the one engine-refused row, is enabled only with a hero
 *     (ctx.hero strictly true) who is not dead and not mid-encounter. Its
 *     short-on-food dim (Phase 25.1 DFB-06) is a separate shell state and
 *     never disables it.
 * A missing, null, non-object or hostile ctx never throws: MAKE CAMP reads
 * as disabled (fail-safe for the one dispatching row), every other row as
 * enabled. The ACCOUNT block is not a row here — it is always available.
 */
export function hudMenuRowStates(ctx) {
  const encounter = flag(ctx, "encounter") === true;
  const dead = flag(ctx, "dead") === true;
  const hero = flag(ctx, "hero") === true;
  const enabled = {
    camp: hero && !dead && !encounter,
    marks: !dead,
    settings: true,
    report: true,
    notes: true,
    saveQuit: true,
    abandon: true,
  };
  const rows = [
    ...HUD_MENU_ITEMS.map((item) => ({ key: item.key, id: item.id })),
    { key: "saveQuit", id: QUIT_ROW_IDS.saveQuit },
    { key: "abandon", id: QUIT_ROW_IDS.abandon },
  ];
  return Object.freeze(rows.map((r) => Object.freeze({ key: r.key, id: r.id, enabled: enabled[r.key] })));
}
