// src/browser/handles.js
//
// Phase 83 (SRV-05). The rolled @handle: `@` + two words drawn from the
// content/handles.js word tables. Pure, DOM-free, and never imports from
// engine/ — the handle is always rolled with shell-side randomness (an
// injected random function, defaulting to Math.random), never the engine
// rng, per CONTEXT "Identity & the @handle".

import { HANDLE_FIRST, HANDLE_SECOND } from "../../content/handles.js";

export const HANDLE_PREFIX = "@";

const longest = (words) => words.reduce((max, w) => Math.max(max, w.length), 0);

export const HANDLE_MAX_CHARS = HANDLE_PREFIX.length + longest(HANDLE_FIRST) + longest(HANDLE_SECOND);

let cachedPattern = null;

/** handlePatternSource() — the anchored alternation string the deployed rules (83-02) embed, built from the two tables in table order. */
export function handlePatternSource() {
  if (cachedPattern === null) {
    cachedPattern = `^${HANDLE_PREFIX}(${HANDLE_FIRST.join("|")})(${HANDLE_SECOND.join("|")})$`;
  }
  return cachedPattern;
}

let cachedRegex = null;

function handleRegex() {
  if (cachedRegex === null) cachedRegex = new RegExp(handlePatternSource());
  return cachedRegex;
}

/** isValidHandle(h) — h is a string matching handlePatternSource() exactly. */
export function isValidHandle(h) {
  if (typeof h !== "string") return false;
  return handleRegex().test(h);
}

function pickIndex(r, length) {
  const n = Number.isFinite(r) ? r : 0;
  const idx = Math.floor(n * length);
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

/**
 * rollHandle(random, previous) — "@" + a first word + a second word, picked
 * via two calls to `random` (defaults to Math.random). When the rolled
 * handle equals `previous`, the second word advances by one (wrapping) so a
 * re-roll always returns a different handle. Never throws.
 */
export function rollHandle(random = Math.random, previous = null) {
  const i = pickIndex(random(), HANDLE_FIRST.length);
  let j = pickIndex(random(), HANDLE_SECOND.length);
  let handle = HANDLE_PREFIX + HANDLE_FIRST[i] + HANDLE_SECOND[j];
  if (handle === previous) {
    j = (j + 1) % HANDLE_SECOND.length;
    handle = HANDLE_PREFIX + HANDLE_FIRST[i] + HANDLE_SECOND[j];
  }
  return handle;
}
