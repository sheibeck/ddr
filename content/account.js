// content/account.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — every
// word the account surfaces show: the title chip, its sheet, the ☰ block's own
// copy of the same rows, and the rail cards the board earns a player (going up
// for the first time, being swept clean, the erase call not landing, and runs
// waiting on a sign-in).
//
// The account is your Google Play Games name and the Compete toggle. The board
// shows that name to everyone, so the table says so out loud. The name is never
// chosen or changed in the game (D-11); with Compete on and the player not
// signed in, the account block offers SIGN IN WITH PLAY GAMES (D-03) and the
// runs wait in the queue until it is done. With Compete off nothing leaves the
// phone and Play Games is never asked for anything.
//
// The chip sits in the title's corner and opens the sheet; in the dungeon the
// same rows live inside the ☰ dropdown (the account block). Both read from this
// one table through src/browser/account.js, never a literal of their own.
//
// `content/` holds pure data only: the name placeholder below is filled by
// src/browser/account.js, never here.

export const ACCOUNT_COPY = Object.freeze({
  // The dim question mark inside the hollow pending/off-board square.
  glyph: "?",
  // The title chip's accessible label, one per face.
  chipLabel: Object.freeze({
    on: "Account: {name}",
    off: "Account: Compete is off",
    pending: "Account: waiting on Play Games",
  }),
  // The ☰ menu button's accessible label — naming the player once Compete is
  // on and the name is known, plain otherwise.
  menuLabel: Object.freeze({
    on: "Menu — {name}",
    plain: "Menu",
  }),
  sheet: Object.freeze({
    title: "ACCOUNT",
    // The identity line shown before a name exists (a beat, or never signed in).
    pending: "Waiting on your Play Games name…",
    status: Object.freeze({
      on: "ON THE BOARD",
      off: "COMPETE OFF",
      pending: "NAME PENDING…",
      signedOut: "NOT SIGNED IN",
      signingIn: "SIGNING IN…",
      unavailable: "PLAY GAMES UNAVAILABLE",
    }),
    compete: "COMPETE",
    on: "ON",
    off: "OFF",
    onHelp: "Every death from here goes on the board under your Play Games name, for anyone to find. Turn it off any time, right here.",
    offHelp: "Nothing leaves this phone, and Compete off means no Play Games sign-in. Turning it off takes full effect the next time you open the game: Play Games stays signed in until the app closes, and nothing reaches the board. Compete must be on to reach the board, and so to erase anything already sitting there.",
    signin: "SIGN IN WITH PLAY GAMES",
    signingIn: "SIGNING IN…",
    erase: "ERASE MY RUNS",
    eraseArmed: "TAP AGAIN TO ERASE",
    erasing: "ERASING…",
    settings: "SETTINGS",
  }),
  cards: Object.freeze({
    welcome: Object.freeze({
      title: "ON THE BOARD",
      line: "The board shows {name}, your Play Games name, to everyone. Every death from here is public record. Turn Compete off any time from the menu in the corner.",
    }),
    erased: Object.freeze({
      title: "SWEPT CLEAN",
      line: "Every run {name} ever posted is off the board now. The name stays yours; the record does not.",
    }),
    eraseFailed: Object.freeze({
      title: "THE BOARD DIDN'T ANSWER",
      line: "Nothing was erased. The board did not answer this time. Try again from the menu in the corner.",
    }),
    signinNeeded: Object.freeze({
      title: "RUNS ARE WAITING",
      line: "Your dead are queued up and going nowhere until Play Games knows who you are. SIGN IN WITH PLAY GAMES is in the menu in the corner.",
    }),
    // Phase 92.1: a sign-in tap (or Compete turned back on) that Play Games
    // could not take up. One card per failed attempt, with a plain reason.
    signinUnavailable: Object.freeze({
      title: "PLAY GAMES ISN'T HOME",
      line: "Sign-in is not available on this phone right now. Your dead wait here, safe, and go on the board once it is. Nothing is lost, only delayed.",
    }),
    signinFailed: Object.freeze({
      title: "THE SIGN-IN FELL OVER",
      line: "Play Games did not sign you in this time, and it is not saying why. Your dead wait here, safe. Try the sign-in row in the menu again in a moment.",
    }),
  }),
});
