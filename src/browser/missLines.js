// src/browser/missLines.js
//
// Phase 25 (FEED-05) — the fledgling-miss quip corpus. While a hero is still
// green (c.level <= QUIP_MAX_LEVEL), a plain strikeMissed event earns a short,
// deadpan, family-friendly quip appended after the Oracle's roll/miss
// sentence AND surfaced on the matching toast (25-03/25-04) — one assignment
// site (engineAdapter.js#dispatch), one quip, two consumers.
//
// PRESENTATION ONLY, pure module: no DOM access, no `import` from engine/,
// and — critically — NO Math.random/Date.now anywhere in this file. The
// rotation is a caller-supplied plain integer counter (missSeq, owned by
// engineAdapter.js), not the engine's seeded rng and not wall-clock time, so
// the quip a run sees is fully reproducible and never perturbs
// state.rngState (25-CONTEXT.md's "Miss corpus" decision). 25-05 adds a
// standing purity guard pointed at this module; the tests below already pin
// it.
//
// decorateMisses() never mutates the engine's own event objects — it returns
// shallow copies (`{ ...e, quip }`) for the events it decorates and passes
// every other event through by reference, so anything else reading `events`
// (noteCombat, haptics, lastStrike readers) never sees engine state change
// out from under it (T-25-09).

/**
 * MISS_LINES — the fledgling-miss quip corpus. >= 12 distinct entries, each
 * <= 40 characters, deadpan and family-friendly (no exclamation-mark
 * hysteria, no profanity/gore — test/voice/safety-scan.test.js scans every
 * entry). Order is the rotation order missLineAt() walks.
 */
export const MISS_LINES = Object.freeze([
  "A swing. Technically.",
  "The air takes the hit for it.",
  "You attack the general vicinity.",
  "That was practice. Probably.",
  "Nowhere near. Good effort though.",
  "A rehearsal, not a performance.",
  "Your weapon declines to participate.",
  "You miss. It looks surprised too.",
  "Wide. Impressively wide.",
  "Somewhere, a wall feels threatened.",
  "The floor was never the target.",
  "Ambitious. Also nowhere close.",
  "You swing at yesterday.",
  "That counts as a warning shot.",
  "The dungeon rates that a two.",
]);

/**
 * QUIP_MAX_LEVEL — the corpus decorates strikeMissed events ONLY while the
 * hero's c.level is at or below this value; from level 3 on, misses read
 * plainly ("You miss X.") with no quip. 25-CONTEXT.md's "Miss corpus"
 * decision.
 */
export const QUIP_MAX_LEVEL = 2;

/**
 * missLineAt(seq) — the corpus entry for rotation position `seq`, as a plain
 * integer modulo the corpus length. Negative-safe (`((seq % n) + n) % n`)
 * and never floating point, never the engine's rng or the disallowed global
 * randomness source — `seq` is always an integer the caller already owns.
 */
export function missLineAt(seq) {
  const n = MISS_LINES.length;
  return MISS_LINES[((seq % n) + n) % n];
}

/**
 * decorateMisses(events, level, seq) — pure. Returns `{ events, seq }`.
 *
 * When `events` is not an array, or `level > QUIP_MAX_LEVEL`, returns the
 * SAME array reference and the SAME seq, unchanged — an identity no-op the
 * caller can always safely call.
 *
 * Otherwise, maps `events` to a new array: every event with
 * `type === "strikeMissed"` and a falsy `untouchable` becomes a shallow copy
 * carrying `quip: missLineAt(seq++)`; every other event passes through by
 * reference (never copied, never mutated). The returned `seq` reflects how
 * many quips were stamped, so the caller's next decorateMisses() call
 * continues the rotation.
 */
export function decorateMisses(events, level, seq) {
  if (!Array.isArray(events) || level > QUIP_MAX_LEVEL) return { events, seq };
  let next = seq;
  const decorated = events.map((e) => {
    if (e.type === "strikeMissed" && !e.untouchable) {
      const quip = missLineAt(next++);
      return { ...e, quip };
    }
    return e;
  });
  return { events: decorated, seq: next };
}
