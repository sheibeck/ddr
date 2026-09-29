// content/account.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1) — every word the account
// surfaces show: the title chip, its sheet, the ☰ block's own copy of the
// same rows, and the three rail cards a handle earns from the board (going
// up for the first time, being swept clean of it, or the erase call not
// landing). The account is your rolled @handle and the Compete toggle —
// there is no login flow, no account-creation screen and no third-party
// identity of any kind, and this table carries none of that wording. The
// handle exists from the moment the app first launches
// (identity.ensureHandle(), fully offline); nothing is created anywhere
// until the first run reaches the board.
//
// The previous phases' account block — its own welcome/failure cards and a
// linked, provider-backed identity this app no longer has — is retired in
// full; every row here is new copy for our own board, not a rename of the
// old one.
//
// The chip sits in the title's corner and opens the sheet; in the dungeon
// the same rows live inside the ☰ dropdown (the account block). Both read
// from this one table through src/browser/account.js, never a literal of
// their own.
//
// `content/` holds pure data only: the `{handle}` placeholder below is
// filled by src/browser/account.js, never here.

export const ACCOUNT_COPY = Object.freeze({
  // The dim question mark inside the hollow pending/off-board square.
  glyph: "?",
  // The title chip's accessible label, one per face.
  chipLabel: Object.freeze({
    on: "Account: {handle}",
    off: "Account: Compete is off",
    pending: "Account: rolling your handle",
  }),
  // The ☰ menu button's accessible label — naming the handle once Compete
  // is on and the handle is known, plain otherwise.
  menuLabel: Object.freeze({
    on: "Menu — {handle}",
    plain: "Menu",
  }),
  sheet: Object.freeze({
    title: "ACCOUNT",
    // The identity name shown before a handle exists (a beat, offline).
    pending: "Rolling your handle…",
    status: Object.freeze({
      on: "ON THE BOARD",
      off: "COMPETE OFF",
      pending: "ROLLING YOUR HANDLE…",
    }),
    compete: "COMPETE",
    on: "ON",
    off: "OFF",
    onHelp: "Every death from here goes on the board under this handle, for anyone to find. Turn it off any time, right here.",
    offHelp: "Nothing leaves this phone. Compete must be on to reach the board — and so to erase anything already sitting there.",
    reroll: "RE-ROLL HANDLE",
    erase: "ERASE MY RUNS",
    eraseArmed: "TAP AGAIN TO ERASE",
    erasing: "ERASING…",
    settings: "SETTINGS",
  }),
  cards: Object.freeze({
    welcome: Object.freeze({
      title: "ON THE BOARD",
      line: "{handle} just went on the board. Every death from here is public record. Turn Compete off any time from the menu in the corner.",
    }),
    erased: Object.freeze({
      title: "SWEPT CLEAN",
      line: "Every run {handle} ever posted is off the board now. The handle stays; the record does not.",
    }),
    eraseFailed: Object.freeze({
      title: "THE BOARD DIDN'T ANSWER",
      line: "Nothing was erased. The board did not answer this time. Try again from the menu in the corner.",
    }),
  }),
});
