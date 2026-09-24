// content/account.js
//
// Phase 67 (ACCT-01/02) — every word the account chip, its bottom sheet and
// its two rail cards show. The chip sits in the top bar beside the menu
// button (D-05); signed in it wears the initials avatar, otherwise the
// deliberate "nobody" glyph (D-07). The sheet lists an identity line, the one
// action the current state allows, the Compete toggle and Settings (D-10).
// There is no sign-out wording anywhere: Play Games has no programmatic
// sign-out, so STOP COMPETING only turns Compete off, and the helper line
// sends the player to the Play Games app for a real disconnect (D-03). The
// welcome card is the first-sign-in notice (D-04); the failed card covers a
// failed or declined sign-in (D-11). Both are rail cards, never modals.
//
// Phase 70 (POLISH-02): in play, the ☰ menu button now wears the account face
// (70 D-03): the initials avatar when signed in, the plain ☰ otherwise, with
// menuLabel as its accessible label. The dropdown carries the ACCOUNT block
// (identity, action, helper line, Compete; no title and no Settings row). The
// title keeps its own chip and account sheet (70 D-04). The failed card now
// points at "the menu in the corner", since the band-2 face it named is gone.
//
// `content/` holds pure data only: the `{name}` placeholder below is filled
// by src/browser/account.js, never here.

export const ACCOUNT_COPY = Object.freeze({
  // D-07: the dim question mark inside the hollow "nobody" square.
  glyph: "?",
  // The chip's accessible label, one per face.
  chipLabel: Object.freeze({
    signedIn: "Play Games account: {name}",
    signedOut: "Play Games account: nobody signed in",
    pending: "Play Games account: signing in",
    off: "Play Games account: Compete is off",
  }),
  // Phase 70 (D-03): the ☰ menu button's accessible label — naming the
  // player when signed in, plain otherwise.
  menuLabel: Object.freeze({
    signedIn: "Menu — signed in as {name}",
    plain: "Menu",
  }),
  sheet: Object.freeze({
    title: "PLAY GAMES",
    status: Object.freeze({
      signedIn: "PLAY GAMES · SIGNED IN",
      signedOut: "PLAY GAMES · SIGNED OUT",
      pending: "PLAY GAMES · SIGNING IN",
      off: "PLAY GAMES · COMPETE OFF",
    }),
    nobody: "Nobody in particular",
    unnamed: "A player with no name",
    signIn: "SIGN IN",
    signingIn: "SIGNING IN…",
    stopCompeting: "STOP COMPETING",
    stopHelp: "To forget you entirely, disconnect this game in the Play Games app. It will pretend not to miss you.",
    offHelp: "Nothing leaves this phone. Nobody is keeping score but you, and you were always going to.",
    compete: "COMPETE",
    on: "ON",
    off: "OFF",
    settings: "SETTINGS",
  }),
  cards: Object.freeze({
    welcome: Object.freeze({
      title: "ON THE PUBLIC RECORD",
      line: "Play Games is watching now. Every death goes on the public record. Turn Compete off from the little face in the corner.",
    }),
    failed: Object.freeze({
      title: "PLAY GAMES DID NOT ANSWER",
      line: "Sign-in failed, or was declined. You stay unrecorded and fully playable. Try again, or turn Compete off, from the menu in the corner.",
    }),
  }),
});
