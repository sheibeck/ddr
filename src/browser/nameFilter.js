// src/browser/nameFilter.js
//
// Phase 91.2 (BOARD-31), D-08. The matcher that flags a player's Play Games
// name when it contains a word on the family-friendly safety list
// (content/safety-wordlist.js), so the board can show a neutral placeholder
// instead (91.2-07) and `boards-admin names --flagged` can list the names for
// a moderator. Google moderates gamer names, but they are player-chosen and
// reach a public board in a PEGI 3 game, so the game applies its own list too.
//
// Two rules, both case- and accent-blind:
//   1. TOKEN. The name is split into tokens (any run of non-letters and
//      non-digits, camelCase humps, and letter/digit boundaries). A token that
//      equals a safety-list term flags the name, and so does a run of tokens
//      that spells a multi-word term. A token that is itself an ALLOWLIST word
//      (a word the game genuinely uses) never flags.
//   2. EMBEDDED. The letters-only form of the whole name (so "x.y.z", fused
//      words and punctuation tricks collapse) is searched for any safety-list
//      term of FOUR or more letters. An occurrence that sits inside an
//      ALLOWLIST word's occurrence is explained and skipped. Terms shorter
//      than four letters only match as whole tokens (rule 1), so a short term
//      buried in an ordinary name never flags it.
// The embedded rule is deliberately blunt: a real name that happens to hide a
// listed term is masked on the board (a placeholder, not a ban), and the admin
// can override the name. That is the cheaper mistake for a family-friendly
// board.
//
// Pure: imports only the data lists, no DOM, no storage. It exports no copy
// and never spells a listed term out (the list file is the one place allowed
// to; a test pins that for this file).

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const MIN_EMBEDDED_LETTERS = 4;

// Compatibility-decompose and drop combining marks so accents cannot hide a term.
function fold(s) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "");
}

/**
 * nameTokens(name) — lowercase tokens split on any non-letter-or-digit,
 * camelCase humps and letter/digit boundaries. Non-strings give [].
 */
export function nameTokens(name) {
  if (typeof name !== "string") return [];
  const tokens = [];
  for (const piece of fold(name).split(/[^\p{L}\p{N}]+/u)) {
    if (piece === "") continue;
    const parts = piece
      .replace(/(?<=\p{Ll})(?=\p{Lu})/gu, " ")
      .replace(/(?<=\p{Lu})(?=\p{Lu}\p{Ll})/gu, " ")
      .replace(/(?<=\p{L})(?=\p{N})/gu, " ")
      .replace(/(?<=\p{N})(?=\p{L})/gu, " ")
      .split(" ");
    for (const part of parts) if (part !== "") tokens.push(part.toLowerCase());
  }
  return tokens;
}

function lettersOnly(s) {
  return fold(s).toLowerCase().replace(/[^\p{L}]/gu, "");
}

// The compiled form of a (banned, allowlist) pair, cached per banned array.
const compiled = new WeakMap();

function compile(banned, allowlist) {
  const cached = compiled.get(banned);
  if (cached && cached.allowlist === allowlist) return cached.value;
  const words = new Set();
  const phrases = [];
  const embedded = new Set();
  for (const term of banned) {
    if (typeof term !== "string") continue;
    const tokens = nameTokens(term);
    if (tokens.length === 1) words.add(tokens[0]);
    else if (tokens.length > 1) phrases.push(tokens);
    const letters = lettersOnly(term);
    if (letters.length >= MIN_EMBEDDED_LETTERS) embedded.add(letters);
  }
  const allowTokens = new Set();
  const allowLetters = new Set();
  for (const word of allowlist) {
    if (typeof word !== "string") continue;
    for (const t of nameTokens(word)) allowTokens.add(t);
    const letters = lettersOnly(word);
    if (letters !== "") allowLetters.add(letters);
  }
  const value = { words, phrases, embedded: [...embedded], allowTokens, allowLetters: [...allowLetters] };
  compiled.set(banned, { allowlist, value });
  return value;
}

function occurrences(haystack, needle) {
  const spots = [];
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) spots.push(i);
  return spots;
}

function hasPhrase(tokens, phrase) {
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (phrase.every((p, j) => tokens[i + j] === p)) return true;
  }
  return false;
}

/**
 * nameFlagged(name, { banned, allowlist }) — true when the name contains a
 * safety-list word by the token or embedded rule above. The second argument
 * is for tests; it defaults to the real lists.
 */
export function nameFlagged(name, { banned = BANNED, allowlist = ALLOWLIST } = {}) {
  if (typeof name !== "string") return false;
  const c = compile(banned, allowlist);
  const tokens = nameTokens(name);
  if (tokens.length === 0) return false;

  for (const token of tokens) {
    if (c.words.has(token) && !c.allowTokens.has(token)) return true;
  }
  for (const phrase of c.phrases) {
    if (hasPhrase(tokens, phrase)) return true;
  }

  const joined = lettersOnly(name);
  const explained = [];
  for (const allow of c.allowLetters) {
    for (const start of occurrences(joined, allow)) explained.push([start, start + allow.length]);
  }
  for (const term of c.embedded) {
    for (const start of occurrences(joined, term)) {
      const end = start + term.length;
      if (!explained.some(([a, b]) => start >= a && end <= b)) return true;
    }
  }
  return false;
}
