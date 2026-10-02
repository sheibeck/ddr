// src/browser/account.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — the
// account layer for our own board: the player's Google Play Games name, the
// Compete toggle, the sign-in state and the two-tap erase. The name is the
// verified one the board session hands back (identity.snapshot().name); this
// module never makes one up and offers no way to change it.
//
//   { compete: boolean, name: string | null,
//     signin: "unknown" | "in" | "out" | "busy" | "unavailable",
//     erase: "idle" | "armed" | "busy", welcomed: boolean,
//     canSignIn: boolean }
//
// The title chip and the ☰ button's own face show the name's avatar only while
// Compete is ON (that face's whole job is to say whether you are on the board
// right now); the sheet and the ☰ block show the avatar once a name exists,
// ON or OFF. With Compete ON and the player not signed in, the sheet carries a
// visible SIGN IN WITH PLAY GAMES row (D-03); it is hidden otherwise, and it
// is hidden whenever sign-in cannot work on this build (canSignIn false, the
// identity's seamsReady(): Phase 92.1, a row that does nothing is worse than no
// row).
//
// ERASE MY RUNS is disabled while Compete is OFF, while there is no name, and
// while an erase is running: every board call is Compete-gated and the erase
// needs the account to be known.
//
// The avatar's initials and colour come from the same helpers the Leaderboards
// panel uses (nameInitials/avatarColour) and are never re-implemented here.
// Every export is total (never throws) and returns frozen objects. No DOM,
// storage, clock, randomness or network anywhere in this module.

import { nameInitials, avatarColour } from "./leaderboardView.js";
import { sanitizeBoardName } from "./boardName.js";
import { RAIL_HOLD } from "./rail.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { HUD_MENU_GLYPH } from "./hudMenu.js";

const ERASE_STATES = Object.freeze(["idle", "armed", "busy"]);
const SIGNIN_STATES = Object.freeze(["unknown", "in", "out", "busy", "unavailable"]);

/** Read one field of an arbitrary value; a hostile getter reads as undefined. */
function field(obj, key) {
  if (obj === null || typeof obj !== "object") return undefined;
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

/** fillName(template, name) — the only token this module ever fills, via a function replacer so a $-pattern name is never special-cased by String#replace. */
function fillName(template, name) {
  return template.replace("{name}", () => name);
}

/**
 * normalizeAccountState(input) — any value in, a frozen well-formed state
 * out. compete is true unless exactly false. name is a cleaned board name
 * (boardName.js#sanitizeBoardName) or null — a missing or unusable name always
 * reads as null, never thrown. signin is one of the five sign-in states, else
 * "unknown". erase is "idle", "armed" or "busy"; anything else reads as
 * "idle". welcomed is true only when exactly true. canSignIn is true unless
 * exactly false (an unknown reads as able; the controller says otherwise).
 */
export function normalizeAccountState(input) {
  const compete = field(input, "compete") !== false;
  const welcomed = field(input, "welcomed") === true;
  const name = sanitizeBoardName(field(input, "name"));
  const rawSignin = field(input, "signin");
  const signin = SIGNIN_STATES.includes(rawSignin) ? rawSignin : "unknown";
  const rawErase = field(input, "erase");
  const erase = ERASE_STATES.includes(rawErase) ? rawErase : "idle";
  const canSignIn = field(input, "canSignIn") !== false;
  return Object.freeze({ compete, name, signin, erase, welcomed, canSignIn });
}

/** The face block shared by the title chip and the ☰ button: the name's avatar while Compete is ON, the dim glyph otherwise. A name-less state is always "pending", whatever Compete reads. */
function chipFaceOf(state) {
  if (state.name === null) return Object.freeze({ face: "pending", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph });
  if (state.compete) return Object.freeze({ face: "avatar", initials: nameInitials(state.name), bg: avatarColour(state.name), glyph: "" });
  return Object.freeze({ face: "nobody", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph });
}

/**
 * accountChipView(state) — { face, initials, bg, glyph, label } for the
 * title chip. No name yet gives the pending face; Compete ON gives the name's
 * initials avatar; Compete OFF gives the dim glyph.
 */
export function accountChipView(input) {
  const state = normalizeAccountState(input);
  const face = chipFaceOf(state);
  let label = ACCOUNT_COPY.chipLabel.pending;
  if (state.name !== null) label = state.compete ? fillName(ACCOUNT_COPY.chipLabel.on, state.name) : ACCOUNT_COPY.chipLabel.off;
  return Object.freeze({ ...face, label });
}

/**
 * accountMenuView(state) — the ☰ menu button's face. Compete ON with a name
 * wears the same avatar the chip does; every other state (no name yet, or
 * Compete OFF) wears the plain ☰ glyph labelled "Menu".
 */
export function accountMenuView(input) {
  const state = normalizeAccountState(input);
  if (state.compete && state.name !== null) {
    return Object.freeze({ ...chipFaceOf(state), label: fillName(ACCOUNT_COPY.menuLabel.on, state.name) });
  }
  return Object.freeze({ face: "menu", initials: "", bg: "", glyph: HUD_MENU_GLYPH, label: ACCOUNT_COPY.menuLabel.plain });
}

/** The status line: Compete OFF, then the sign-in states that need saying, then the name's own state. */
function statusOf(state) {
  const st = ACCOUNT_COPY.sheet.status;
  if (!state.compete) return st.off;
  if (state.signin === "busy") return st.signingIn;
  if (state.signin === "out") return st.signedOut;
  if (state.signin === "unavailable") return st.unavailable;
  return state.name !== null ? st.on : st.pending;
}

/** The sheet/☰ identity block: the avatar once a name exists, else the pending face — never Compete-gated. */
function identityOf(state) {
  const s = ACCOUNT_COPY.sheet;
  const status = statusOf(state);
  if (state.name === null) {
    return { face: "pending", initials: "", bg: "", glyph: ACCOUNT_COPY.glyph, name: s.pending, status };
  }
  return { face: "avatar", initials: nameInitials(state.name), bg: avatarColour(state.name), glyph: "", name: state.name, status };
}

/**
 * accountSheetView(state) — the ☰ block / title sheet's rows: the identity
 * line, COMPETE, the help line, SIGN IN WITH PLAY GAMES (visible only with
 * Compete ON, sign-in able to work on this build, and the player signed out,
 * signing in, or Play Games unavailable)
 * and ERASE MY RUNS (the title sheet adds SETTINGS on top of this same view —
 * the renderer's job, not this module's).
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
  const signInBusy = state.signin === "busy";
  const signInVisible = state.compete && state.canSignIn && (state.signin === "out" || signInBusy || state.signin === "unavailable");
  return Object.freeze({
    title: s.title,
    identity: Object.freeze(identityOf(state)),
    compete,
    help: state.compete ? s.onHelp : s.offHelp,
    signIn: Object.freeze({
      id: "signin",
      label: signInBusy ? s.signingIn : s.signin,
      visible: signInVisible,
      disabled: signInBusy,
    }),
    erase: Object.freeze({
      id: "erase",
      label: eraseLabel,
      armed: state.erase === "armed",
      disabled: !state.compete || state.name === null || state.erase === "busy",
    }),
    settings: Object.freeze({ label: s.settings }),
  });
}

/**
 * accountCard(kind, name) — the account rail cards: "welcome" (once, naming
 * the player's Play Games name), "erased" (the erase-succeeded card, naming
 * it), "eraseFailed", "signinNeeded", "signinUnavailable" and "signinFailed"
 * (none takes a name).
 * "welcome"/"erased" with no usable name, or any other kind, gives null.
 */
export function accountCard(kind, name) {
  if (kind === "welcome" || kind === "erased") {
    const clean = sanitizeBoardName(name);
    if (clean === null) return null;
    const c = ACCOUNT_COPY.cards[kind];
    return Object.freeze({ title: c.title, line: fillName(c.line, clean), tone: kind === "welcome" ? "odd" : "dull", hold: kind === "welcome" ? RAIL_HOLD.floor : RAIL_HOLD.default });
  }
  if (kind === "eraseFailed" || kind === "signinNeeded" || kind === "signinUnavailable" || kind === "signinFailed") {
    const c = ACCOUNT_COPY.cards[kind];
    return Object.freeze({ title: c.title, line: c.line, tone: "dull", hold: RAIL_HOLD.default });
  }
  return null;
}
