// src/browser/account.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1) — the account layer for our own
// board: the rolled @handle, the Compete toggle, re-rolling and the two-tap
// erase. No login flow of any kind — the account is the handle, and the
// handle exists from the first launch (identity.ensureHandle(), the
// controller's own concern, not this module's).
//
//   { compete: boolean, handle: string | null, erase: "idle" | "armed" | "busy",
//     welcomed: boolean }
//
// The sheet and the ☰ block always show the handle's avatar once a handle
// exists, whether Compete is ON or OFF (85-CONTEXT: "the handle is yours
// with Compete ON or OFF") — identity.face is "avatar" with a handle, else
// "pending", never a Compete-gated dim look; that distinction lives only on
// the title chip and the ☰ button's own face (accountChipView,
// accountMenuView), which fall back to the dim glyph while Compete is OFF.
//
// ERASE MY RUNS is disabled while Compete is OFF: every board call is
// Compete-gated, so there is nothing to reach from off the board.
//
// The avatar's initials and colour come from the same helpers the v3
// Leaderboards panel uses (handleInitials/avatarColour, Phase 84) and are
// never re-implemented here. Every export is total (never throws) and
// returns frozen objects. No DOM, storage, clock, randomness or network
// anywhere in this module.

import { handleInitials, avatarColour } from "./leaderboardView.js";
import { isValidHandle } from "./handles.js";
import { RAIL_HOLD } from "./rail.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { HUD_MENU_GLYPH } from "./hudMenu.js";

const ERASE_STATES = Object.freeze(["idle", "armed", "busy"]);

/** Read one field of an arbitrary value; a hostile getter reads as undefined. */
function field(obj, key) {
  if (obj === null || typeof obj !== "object") return undefined;
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

/** fillHandle(template, handle) — the only token this module ever fills, via a function replacer so a $-pattern handle is never special-cased by String#replace. */
function fillHandle(template, handle) {
  return template.replace("{handle}", () => handle);
}

/**
 * normalizeAccountState(input) — any value in, a frozen well-formed state
 * out. compete is true unless exactly false. handle is a valid handle
 * (handles.js#isValidHandle) or null — an invalid or missing handle always
 * reads as null, never thrown. erase is "idle", "armed" or "busy"; anything
 * else reads as "idle". welcomed is true only when exactly true.
 */
export function normalizeAccountState(input) {
  const compete = field(input, "compete") !== false;
  const welcomed = field(input, "welcomed") === true;
  const rawHandle = field(input, "handle");
  const handle = isValidHandle(rawHandle) ? rawHandle : null;
  const rawErase = field(input, "erase");
  const erase = ERASE_STATES.includes(rawErase) ? rawErase : "idle";
  return Object.freeze({ compete, handle, erase, welcomed });
}

/** The face block shared by the title chip and the ☰ button: the handle's avatar while Compete is ON, the dim glyph otherwise. A handle-less state is always "pending", whatever Compete reads. */
function chipFaceOf(state) {
  if (state.handle === null) return Object.freeze({ face: "pending", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph });
  if (state.compete) return Object.freeze({ face: "avatar", initials: handleInitials(state.handle), bg: avatarColour(state.handle), glyph: "" });
  return Object.freeze({ face: "nobody", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph });
}

/**
 * accountChipView(state) — { face, initials, bg, glyph, label } for the
 * title chip. No handle yet gives the pending face; Compete ON gives the
 * handle's initials avatar; Compete OFF gives the dim glyph — the handle
 * stays yours either way, but the chip's whole job is to say whether you
 * are on the board right now.
 */
export function accountChipView(input) {
  const state = normalizeAccountState(input);
  const face = chipFaceOf(state);
  let label = ACCOUNT_COPY.chipLabel.pending;
  if (state.handle !== null) label = state.compete ? fillHandle(ACCOUNT_COPY.chipLabel.on, state.handle) : ACCOUNT_COPY.chipLabel.off;
  return Object.freeze({ ...face, label });
}

/**
 * accountMenuView(state) — the ☰ menu button's face. Compete ON with a
 * handle wears the same avatar the chip does; every other state (no handle
 * yet, or Compete OFF) wears the plain ☰ glyph labelled "Menu".
 */
export function accountMenuView(input) {
  const state = normalizeAccountState(input);
  if (state.compete && state.handle !== null) {
    return Object.freeze({ ...chipFaceOf(state), label: fillHandle(ACCOUNT_COPY.menuLabel.on, state.handle) });
  }
  return Object.freeze({ face: "menu", initials: "", bg: "", glyph: HUD_MENU_GLYPH, label: ACCOUNT_COPY.menuLabel.plain });
}

/** The sheet/☰ identity block: the avatar once a handle exists, else the pending face — never Compete-gated (85-CONTEXT: the handle is yours ON or OFF). */
function identityOf(state) {
  const s = ACCOUNT_COPY.sheet;
  if (state.handle === null) {
    return { face: "pending", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph, name: s.pending, status: s.status.pending };
  }
  return {
    face: "avatar",
    initials: handleInitials(state.handle),
    bg: avatarColour(state.handle),
    glyph: "",
    name: state.handle,
    status: state.compete ? s.status.on : s.status.off,
  };
}

/**
 * accountSheetView(state) — the ☰ block / title sheet's rows: the identity
 * line, COMPETE, the help line, RE-ROLL HANDLE and ERASE MY RUNS (the
 * title sheet adds SETTINGS on top of this same view — the renderer's job,
 * not this module's).
 */
export function accountSheetView(input) {
  const state = normalizeAccountState(input);
  const s = ACCOUNT_COPY.sheet;
  const compete = Object.freeze({
    label: s.compete,
    on: state.compete,
    options: Object.freeze([
      Object.freeze({ value: true, label: s.on }),
      Object.freeze({ value: false, label: s.off }),
    ]),
  });
  const eraseLabel = state.erase === "armed" ? s.eraseArmed : state.erase === "busy" ? s.erasing : s.erase;
  return Object.freeze({
    title: s.title,
    identity: Object.freeze(identityOf(state)),
    compete,
    help: state.compete ? s.onHelp : s.offHelp,
    reroll: Object.freeze({ id: "reroll", label: s.reroll, disabled: state.handle === null }),
    erase: Object.freeze({
      id: "erase",
      label: eraseLabel,
      armed: state.erase === "armed",
      disabled: !state.compete || state.handle === null || state.erase === "busy",
    }),
    settings: Object.freeze({ label: s.settings }),
  });
}

/**
 * accountCard(kind, handle) — the account rail cards: "welcome" (once,
 * naming the handle), "erased" (the erase-succeeded card, naming the
 * handle) and "eraseFailed" (no token). "welcome"/"erased" with an invalid
 * handle, or any other kind, gives null.
 */
export function accountCard(kind, handle) {
  if (kind === "welcome" || kind === "erased") {
    if (!isValidHandle(handle)) return null;
    const c = ACCOUNT_COPY.cards[kind];
    return Object.freeze({ title: c.title, line: fillHandle(c.line, handle), tone: kind === "welcome" ? "odd" : "dull", hold: kind === "welcome" ? RAIL_HOLD.floor : RAIL_HOLD.default });
  }
  if (kind === "eraseFailed") {
    const c = ACCOUNT_COPY.cards.eraseFailed;
    return Object.freeze({ title: c.title, line: c.line, tone: "dull", hold: RAIL_HOLD.default });
  }
  return null;
}
