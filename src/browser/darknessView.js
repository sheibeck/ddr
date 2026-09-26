// src/browser/darknessView.js
//
// Phase 57 (LAYOUT-06) — gives Table-7's `c.darkFor` counter a face on the
// map. This module turns the engine's OWN `inDark(state)` and
// `mapViewRadius(state)` answers into a vignette state, and the engine's own
// `darkWaiver(c)` answer into the DARK chip's waiver key. It RECEIVES those
// values as arguments and never computes the rule itself — duplicating a
// rule in two places is how it drifts (D-12; engine/derived.js stays the
// single source of truth). This module is pure and free of any browser
// global, so it can be unit-tested with no shell/vm harness.
//
// Phase 76 (DARK-01/02) — one rule, one radius. engine/derived.js#darkWaiver
// names the light holding the dark back (Night Vision, a live Amulet of
// Light, a lit torch, in that precedence), and `darkLimited(state)` is "in
// the dark with none of them". That one predicate drives what you reveal as
// you walk (revealRadius), what the map renders (mapViewRadius and so
// inViewWindow), the fight's dark penalties, and every darkness surface the
// shell paints: the DARK chip and its tap card, this vignette, and draw()'s
// per-tile dark painting. revealRadius and mapViewRadius can no longer
// disagree, so the vignette reads the one radius and the chip names exactly
// the key the engine reports. Sense Presence (`c.senses`) is a fight-only
// relief, not a light, so it is never a waiver key here.
//
// The Phase 41 (TERR-03) render filter in engine/derived.js
// (mapViewRadius/inViewWindow) is the mechanism that hides cells; this
// module is additive legibility on top of it, not a replacement: see
// mazeworld.html's paintVignette(), which calls vignetteFor() directly after
// paintConditions() so the DARK chip and the vignette can never land on
// different frames.

import { DARK_WAIVERS } from "../../engine/derived.js";

/**
 * VIGNETTE_LEVELS — the only three level strings `vignetteFor` can return,
 * in ascending order of severity. A fourth level appearing anywhere is a
 * bug; test/unit/darkness-vignette.test.js pins this array's length at 3.
 */
export const VIGNETTE_LEVELS = Object.freeze(["off", "near", "close"]);

/**
 * vignetteFor(inDark, mapViewRadius) — returns a frozen `{ on, radius, level }`.
 *
 * The radius it reads is engine/derived.js#mapViewRadius. Since Phase 76
 * (DARK-01/02) that radius shares its one waiver (darkWaiver) with
 * revealRadius, so there is one radius and no choice of source: the
 * vignette is `close` exactly when the hero is in the dark with no light
 * holding it back (`darkLimited`), and `off` otherwise.
 *
 * `on` is exactly `inDark` coerced to a boolean.
 *
 * `radius` is a display-friendly value: `mapViewRadius` coerced to a finite
 * integer with a floor of 1 (a non-finite — Infinity/NaN — or missing
 * radius yields 1, never NaN). This field is always finite; it never carries
 * the raw Infinity a waived run produces.
 *
 * `level`:
 *   - OFF   — `on` is false, OR the RAW radius is non-finite (a light is
 *             holding the dark back, so mapViewRadius is `Infinity` and the
 *             map shows everything; dimming it would lie).
 *   - CLOSE — `on` is true AND the raw radius is finite and <= 1 (the dark
 *             limits you to the 3x3 area around you).
 *   - NEAR  — `on` is true, the raw radius is finite, and it is > 1. Not
 *             reachable from the shipped engine; kept so the level split
 *             stays total for any future intermediate radius.
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
 * waiverFor(waiver) — DARK-02 (Phase 76). Takes the engine's single answer,
 * engine/derived.js#darkWaiver(c), and returns it when it is a DARK_WAIVERS
 * key (`"nightVision"`, `"amuletLight"` or `"litTorch"`), else `null`. Two
 * outcomes only: waived by that key, or not waived. Precedence lives in the
 * engine alone (darkWaiver reports the first live light), so the chip names
 * exactly what the reveal, the render window and the fight read. Anything
 * else (null, undefined, an unknown string, an object) is `null`; it never
 * throws.
 */
export function waiverFor(waiver) {
  return typeof waiver === "string" && DARK_WAIVERS.includes(waiver) ? waiver : null;
}
