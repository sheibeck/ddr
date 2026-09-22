// src/browser/darknessView.js
//
// Phase 57 (LAYOUT-06) — gives Table-7's `c.darkFor` counter a face on the
// map. This module turns the engine's OWN `inDark(state)`/`revealRadius(state)`
// (and the render filter's own `mapViewRadius(state)`) answers into a
// vignette state. It RECEIVES those values as arguments and never computes
// the rule itself — duplicating a rule in two places is how it drifts
// (D-12; see engine/derived.js#inDark/revealRadius/mapViewRadius, which stay
// the single source of truth). This module is pure and free of any browser
// global, so it can be unit-tested with no shell/vm harness.
//
// The Phase 41 (TERR-03) render filter in engine/derived.js
// (mapViewRadius/inViewWindow) is a SEPARATE, correct, and untouched
// mechanism — it already hides cells outside a 3x3 area whenever the
// party is in the dark with no waiver. This module is additive legibility
// on top of it, not a replacement: see mazeworld.html's paintVignette(),
// which calls vignetteFor() directly after paintConditions() so the DARK
// chip and the vignette can never land on different frames.
//
// Why this module takes `mapViewRadius`, not `revealRadius` (USER RULING
// 2026-09-22, 57-CONTEXT.md correction 3): `revealRadius` ports the 1994
// `reveal()` line verbatim and is waived ONLY by Night Vision; `mapViewRadius`
// is Phase 41's own render filter, waived by Night Vision, a live Amulet of
// Light, AND a lit torch. The two disagree under a torch or Amulet — a lit
// torch leaves `revealRadius` at 1 while `mapViewRadius` is `Infinity` — and
// this vignette exists to explain what the map is RENDERING, which
// `mapViewRadius` governs. Driving the vignette off `revealRadius` would dim
// the screen while the map showed everything, which is the exact
// contradiction LAYOUT-06 removes.
//
// Unifying the two mechanisms so they always agree is tracked as backlog
// 999.8 (out of scope here — it would widen `revealRadius`, which changes
// which cells enter `seen`, moving parity fixtures). When 999.8 lands,
// `vignetteFor`'s second argument collapses back to a single radius and
// `waiverFor`'s three-way split becomes two-way (Night Vision only).

/**
 * VIGNETTE_LEVELS — the only three level strings `vignetteFor` can return,
 * in ascending order of severity. A fourth level appearing anywhere is a
 * bug; test/unit/darkness-vignette.test.js pins this array's length at 3.
 */
export const VIGNETTE_LEVELS = Object.freeze(["off", "near", "close"]);

/**
 * vignetteFor(inDark, mapViewRadius) — returns a frozen `{ on, radius, level }`.
 *
 * `on` is exactly `inDark` coerced to a boolean.
 *
 * `radius` is a display-friendly value: `mapViewRadius` coerced to a finite
 * integer with a floor of 1 (a non-finite — Infinity/NaN — or missing
 * radius yields 1, never NaN). This field is always finite; it never carries
 * the raw Infinity a waived run produces.
 *
 * `level` is the three-way split this module exists for:
 *   - OFF  — `on` is false, OR the RAW `mapViewRadius` argument is
 *            non-finite (a waiver is open: Night Vision, a live Amulet of
 *            Light, or a lit torch all make `mapViewRadius` return
 *            `Infinity` — see engine/derived.js#mapViewRadius). The map is
 *            rendering everything, so dimming it would lie.
 *   - CLOSE — `on` is true AND the raw radius is finite and <= 1 (no
 *             waiver — the map really is showing only the 3x3 area).
 *   - NEAR  — `on` is true, the raw radius is finite, and it is > 1 (in the
 *             dark with a widened-but-still-finite area; not reachable
 *             from the shipped engine today, kept for forward
 *             compatibility with any future intermediate waiver).
 *
 * Total: every input combination, including undefined/NaN arguments, yields
 * a member of VIGNETTE_LEVELS and never throws.
 */
export function vignetteFor(inDark, mapViewRadius) {
  const on = !!inDark;
  const rawFinite = Number.isFinite(mapViewRadius);
  const radius = rawFinite ? Math.max(1, Math.floor(mapViewRadius)) : 1;
  let level;
  if (!on || !rawFinite) {
    level = VIGNETTE_LEVELS[0]; // off
  } else if (mapViewRadius <= 1) {
    level = VIGNETTE_LEVELS[2]; // close
  } else {
    level = VIGNETTE_LEVELS[1]; // near
  }
  return Object.freeze({ on, radius, level });
}

/**
 * WAIVERS — the stable keys `waiverFor` can return, in fixed precedence
 * order (first live wins) so the chip's named clause is deterministic when
 * more than one waiver happens to be true at once. Night Vision first (an
 * innate racial/skill trait — the most durable reason), then a live Amulet
 * of Light (a worn item effect), then a lit torch (the shortest-lived of
 * the three, a consumable-fuelled effect) — most-durable-first, so the
 * chip names the reason least likely to expire mid-conversation.
 */
const WAIVER_PRECEDENCE = Object.freeze(["nightVision", "amuletLight", "litTorch"]);

/**
 * waiverFor(flags) — USER RULING 2026-09-22 (waiver visibility). Returns
 * the stable key (a WAIVER_PRECEDENCE member) naming which waiver is
 * holding the dark back, or `null` when none is. RECEIVES the three
 * already-computed booleans as an argument object
 * (`{ nightVision, amuletLight, litTorch }`) — this function never inspects
 * a character record itself, mirroring `vignetteFor`'s receives-answers
 * discipline. A missing/malformed argument yields `null`, never throws.
 */
export function waiverFor(flags) {
  if (!flags || typeof flags !== "object") return null;
  for (const key of WAIVER_PRECEDENCE) {
    if (flags[key]) return key;
  }
  return null;
}
