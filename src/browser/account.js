// src/browser/account.js
//
// Phase 67 (ACCT-01/02) — the account chip and its bottom sheet's pure view
// model. No DOM, storage, clock, randomness or network anywhere in this
// module. Every word comes from content/account.js; the avatar's initials
// and colour come from the Phase 66 port of the mock's INITIALS/AVATAR
// (src/browser/boardsView.js) and are never re-implemented here. The
// controller (67-07) owns every transition (sign-in, Stop competing, the
// Compete toggle, the welcomed flag); this module only reads a state:
//
//   { compete: boolean, status: "off" | "pending" | "signedIn" | "signedOut",
//     player: { id, displayName } | null, welcomed: boolean }
//
// Compete OFF always wins: a stale signed-in status under Compete OFF reads
// as "off", with no player. There is no sign-out row anywhere (D-03): Play
// Games has no programmatic sign-out, so a signed-in sheet offers STOP
// COMPETING plus the helper line pointing at the Play Games app.
//
// Phase 70 (POLISH-02, D-03): accountMenuView() gives the ☰ menu button the
// same avatar when signed in, and the plain ☰ glyph otherwise.
//
// Every export is total (never throws) and returns frozen objects.

import { initialsOf, avatarColour } from "./boardsView.js";
import { RAIL_HOLD } from "./rail.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { HUD_MENU_GLYPH } from "./hudMenu.js";

/** ACCOUNT_STATUS — the four account statuses the controller moves between. */
export const ACCOUNT_STATUS = Object.freeze({
  OFF: "off",
  PENDING: "pending",
  SIGNED_IN: "signedIn",
  SIGNED_OUT: "signedOut",
});

// The statuses valid while Compete is ON ("off" only exists with Compete OFF).
const ON_STATUSES = Object.freeze([ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.SIGNED_IN, ACCOUNT_STATUS.SIGNED_OUT]);

/** Read one field of an arbitrary value; a hostile getter reads as undefined. */
function field(obj, key) {
  if (obj === null || typeof obj !== "object") return undefined;
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

/** A string field, or "" for anything else. */
function str(obj, key) {
  const v = field(obj, key);
  return typeof v === "string" ? v : "";
}

/**
 * normalizeAccountState(input) — any value in, a frozen well-formed state out.
 * compete is true unless exactly false. Compete OFF forces status "off" and
 * no player. With Compete ON, an unknown, missing or "off" status reads as
 * "signedOut". A player is kept only for "signedIn", as a frozen
 * { id, displayName } of strings (empty strings when the profile is missing:
 * the chip then falls back to the unnamed line). welcomed is true only when
 * exactly true.
 */
export function normalizeAccountState(input) {
  const compete = field(input, "compete") !== false;
  const welcomed = field(input, "welcomed") === true;
  if (!compete) {
    return Object.freeze({ compete: false, status: ACCOUNT_STATUS.OFF, player: null, welcomed });
  }
  const raw = field(input, "status");
  const status = typeof raw === "string" && ON_STATUSES.includes(raw) ? raw : ACCOUNT_STATUS.SIGNED_OUT;
  let player = null;
  if (status === ACCOUNT_STATUS.SIGNED_IN) {
    const p = field(input, "player");
    player = Object.freeze({ id: str(p, "id"), displayName: str(p, "displayName") });
  }
  return Object.freeze({ compete: true, status, player, welcomed });
}

/** The name a signed-in player goes by: the trimmed display name, or the unnamed line. */
function nameOf(state) {
  const name = state.player ? state.player.displayName.trim() : "";
  return name || ACCOUNT_COPY.sheet.unnamed;
}

/** The face block shared by the chip and the sheet's identity line. */
function faceOf(state) {
  if (state.status === ACCOUNT_STATUS.SIGNED_IN) {
    const name = nameOf(state);
    return { face: "avatar", initials: initialsOf(name), bg: avatarColour(name), glyph: "" };
  }
  const face = state.status === ACCOUNT_STATUS.PENDING ? "pending" : "nobody";
  return { face, initials: "", bg: "", glyph: ACCOUNT_COPY.glyph };
}

/**
 * accountChipView(state) — { face, initials, bg, glyph, label }. Signed in
 * (Compete ON) gives the initials avatar; pending gives the "pending" face;
 * signed out and Compete OFF give the deliberate "nobody" glyph (D-07). Each
 * status has its own accessible label.
 */
export function accountChipView(input) {
  const state = normalizeAccountState(input);
  const face = faceOf(state);
  let label = ACCOUNT_COPY.chipLabel[state.status];
  if (state.status === ACCOUNT_STATUS.SIGNED_IN) {
    const name = nameOf(state);
    label = label.replace("{name}", () => name);
  }
  return Object.freeze({ ...face, label });
}

/**
 * accountMenuView(state) — the ☰ menu button's face, { face, initials, bg,
 * glyph, label } (Phase 70 D-03, superseding Phase 67 D-05's separate band-2
 * chip). Signed in (Compete ON) it is the same initials avatar the chip
 * wears — faceOf() does the maths, never re-implemented — with a label that
 * names the player. Signed out, signing in and Compete OFF all show the
 * plain ☰ glyph (face "menu") labelled "Menu": the "?" nobody face stays on
 * the title chip and the Leaderboards strip only (D-04).
 */
export function accountMenuView(input) {
  const state = normalizeAccountState(input);
  if (state.status === ACCOUNT_STATUS.SIGNED_IN) {
    const name = nameOf(state);
    const label = ACCOUNT_COPY.menuLabel.signedIn.replace("{name}", () => name);
    return Object.freeze({ ...faceOf(state), label });
  }
  return Object.freeze({ face: "menu", initials: "", bg: "", glyph: HUD_MENU_GLYPH, label: ACCOUNT_COPY.menuLabel.plain });
}

/** The single action row the sheet offers for a status, or null (D-10). */
function actionOf(status) {
  const s = ACCOUNT_COPY.sheet;
  if (status === ACCOUNT_STATUS.SIGNED_OUT) return Object.freeze({ id: "signIn", label: s.signIn, disabled: false });
  if (status === ACCOUNT_STATUS.SIGNED_IN) return Object.freeze({ id: "stopCompeting", label: s.stopCompeting, disabled: false });
  if (status === ACCOUNT_STATUS.PENDING) return Object.freeze({ id: "pending", label: s.signingIn, disabled: true });
  return null;
}

/** The helper line under the action row: the D-03 line when signed in, the offHelp line with Compete OFF. */
function helpOf(status) {
  if (status === ACCOUNT_STATUS.SIGNED_IN) return ACCOUNT_COPY.sheet.stopHelp;
  if (status === ACCOUNT_STATUS.OFF) return ACCOUNT_COPY.sheet.offHelp;
  return "";
}

/**
 * accountSheetView(state) — the bottom sheet's rows (D-10): the identity
 * line, the one action the status allows (Sign in / Stop competing / a
 * disabled SIGNING IN…, none with Compete OFF), the helper line, the Compete
 * toggle and Settings.
 */
export function accountSheetView(input) {
  const state = normalizeAccountState(input);
  const s = ACCOUNT_COPY.sheet;
  const signedIn = state.status === ACCOUNT_STATUS.SIGNED_IN;
  const identity = Object.freeze({
    ...faceOf(state),
    name: signedIn ? nameOf(state) : s.nobody,
    status: s.status[state.status],
  });
  const compete = Object.freeze({
    label: s.compete,
    on: state.compete,
    options: Object.freeze([
      Object.freeze({ value: true, label: s.on }),
      Object.freeze({ value: false, label: s.off }),
    ]),
  });
  return Object.freeze({
    title: s.title,
    identity,
    action: actionOf(state.status),
    help: helpOf(state.status),
    compete,
    settings: Object.freeze({ label: s.settings }),
  });
}

/**
 * accountCard(kind) — the two account rail cards, { title, line, tone, hold }.
 * "welcome" is the first-sign-in notice (D-04), a big update held long;
 * "failed" is the failure/decline card (D-11). Rail cards, never modals.
 * Any other kind gives null.
 */
export function accountCard(kind) {
  if (kind === "welcome") {
    const c = ACCOUNT_COPY.cards.welcome;
    return Object.freeze({ title: c.title, line: c.line, tone: "odd", hold: RAIL_HOLD.floor });
  }
  if (kind === "failed") {
    const c = ACCOUNT_COPY.cards.failed;
    return Object.freeze({ title: c.title, line: c.line, tone: "dull", hold: RAIL_HOLD.default });
  }
  return null;
}

/**
 * accountIdentity(state) — the Leaderboards identity strip's input (D-08):
 * { signedIn: true, player } only when Compete is ON and signed in, else
 * { signedIn: false, player: null }.
 */
export function accountIdentity(input) {
  const state = normalizeAccountState(input);
  if (state.status === ACCOUNT_STATUS.SIGNED_IN) return Object.freeze({ signedIn: true, player: state.player });
  return Object.freeze({ signedIn: false, player: null });
}
