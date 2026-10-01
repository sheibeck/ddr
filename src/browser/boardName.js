// src/browser/boardName.js
//
// Phase 91.2 (BOARD-31/32). The board's one name rule on the client side:
// the longest a board name may be and how a raw name is cleaned. It is a
// byte-for-byte copy of functions/board-names/core.js#sanitizeName (the
// function that writes the trusted names/{uid} record), because the function
// is deployed alone and cannot import from src/. test/unit/nameClient.test.js
// runs one table of inputs through both copies and fails if they drift.
//
// The fake board server, the run document validation and the identity layer
// import it from here. Pure: no imports, no DOM, no storage, no player-facing
// text.

export const BOARD_NAME_MAX_CHARS = 64;

/**
 * sanitizeBoardName(raw) — NFC, control and format characters dropped,
 * whitespace runs collapsed to one space, trimmed, cut to 64 UTF-16 units
 * without splitting a surrogate pair. Null for a non-string or an empty result.
 */
export function sanitizeBoardName(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFC");
  s = s.replace(/[\p{Cc}\p{Cf}]/gu, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > BOARD_NAME_MAX_CHARS) {
    let end = BOARD_NAME_MAX_CHARS;
    const last = s.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    s = s.slice(0, end).trim();
  }
  return s === "" ? null : s;
}
