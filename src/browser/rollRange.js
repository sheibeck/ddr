// src/browser/rollRange.js
//
// Phase 73 (ROLL-05): the ONE place a winning range is written. Every
// event-driven roll line the mirror plans (73-04 through 73-09) add to
// eventNarration.js, narrationLines.js and rail.js formats its range
// through rangeText/rollVsText here, so no two surfaces ever write a range
// differently.
//
// Phase 74 (ROLL-02/03, "Roll Display & Modifier Honesty"): extends this
// module with the ONE player-side signed-modifier formatter. The sign rule
// (74-CONTEXT "Modifier signs everywhere", user-accepted 2026-09-25): every
// displayed modifier is signed from the PLAYER's side — + is always better
// for the player, − is always worse. The engine's own `mods` deltas stay
// signed for the ROLLER (a hero/ally roll's delta reads as-is; a foe roll's
// delta must be negated so a bonus to the foe still reads as a minus to the
// player). This module is the ONE place that flip happens; the stored event
// `mods` values themselves are NEVER mutated by any function here.
// Consumers: 74-03 (Oracle/fight-log/dice-reveal/rail), 74-04 (hero
// sheet/combat menu ranges), 74-05 (item/loot/store/find comparisons),
// 74-06 (foe details), 74-07 (condition chips) — and, later, Phase 77's
// CMBUI-13 effect indicators reuse this same formatter rather than
// re-deriving one.
//
// Pure, no DOM, no imports, no Math.random/Date.now — the same import-free
// purity discipline src/browser/upgradeWhy.js holds itself to, so any
// consumer can format the same range/modifier without pulling in engine/ or
// content/.
//
// Two different characters, two different jobs, never interchanged:
//   - The range separator is ALWAYS U+2013 (en dash), matching the repo's
//     existing "1–2" ranges ("16–20"). It is never the ASCII hyphen-minus.
//   - A negative signed modifier is ALWAYS U+2212 (minus sign), matching
//     upgradeWhy.js's signedNeed() convention ("−2"). It is never the ASCII
//     hyphen-minus either — a range is not a negative number, and a signed
//     modifier is not a range.

/**
 * rangeText(atLeast, dieN) — the winning-face range on a dieN-sided die
 * whose lowest winning face is atLeast, written the one way every surface
 * uses:
 *   - not a finite number for either argument -> "?"
 *   - atLeast > dieN -> "nothing" (no face wins)
 *   - atLeast === dieN -> String(dieN) (a single winning face)
 *   - otherwise -> `${Math.max(1, atLeast)}–${dieN}` (an atLeast at or below
 *     1 reads as the full die, "1–N")
 *
 * Examples: (16, 20) "16–20"; (18, 20) "18–20"; (20, 20) "20";
 * (21, 20) "nothing"; (1, 20) and (-3, 20) "1–20"; (2, 6) "2–6";
 * (2, 2) "2"; (1, 2) "1–2".
 */
export function rangeText(atLeast, dieN) {
  if (!Number.isFinite(atLeast) || !Number.isFinite(dieN)) return "?";
  if (atLeast > dieN) return "nothing";
  if (atLeast === dieN) return String(dieN);
  return `${Math.max(1, atLeast)}–${dieN}`;
}

/**
 * rollVsText(roll, atLeast, dieN) — Phase 74's final roll line core, joining
 * the drawn face and its winning range: "17 vs 18–20". `roll` reads "?" when
 * it is not a finite number (a missing/undefined event field); the range
 * itself still goes through rangeText's own "?"/"nothing" rules.
 */
export function rollVsText(roll, atLeast, dieN) {
  const rollPart = Number.isFinite(roll) ? String(roll) : "?";
  return `${rollPart} vs ${rangeText(atLeast, dieN)}`;
}

/**
 * ROLLERS — the frozen set of roller identities every re-signing function
 * below accepts: "you" (the hero's own roll), "ally" (a party member or
 * summon's own roll) and "foe" (a foe's roll against the hero/an ally). Only
 * "foe" flips the engine's stored, roller-signed delta; "you"/"ally" (and a
 * missing/unknown roller, which reads as "you") pass the delta through
 * unchanged.
 */
export const ROLLERS = Object.freeze({ you: "you", ally: "ally", foe: "foe" });

/**
 * signedText(n) — the ONE signed-number formatter for a player-signed
 * delta: "+2" for a positive number, the U+2212 minus sign for a negative
 * one ("−2"), "0" for zero (including negative zero — it never prints
 * "−0"), and "?" for anything that is not a finite number (NaN, undefined).
 */
export function signedText(n) {
  if (!Number.isFinite(n)) return "?";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * playerDelta(delta, roller) — the ONE place an engine mod's roller-signed
 * delta is flipped to the player's side. "foe" negates the delta (a bonus
 * to the foe becomes a minus for the player); "you", "ally", or a missing
 * roller (reads as "you") pass the delta through unchanged. A negated zero
 * is normalised back to plain 0, never -0.
 */
export function playerDelta(delta, roller) {
  const r = roller === undefined ? ROLLERS.you : roller;
  if (r === ROLLERS.foe) {
    const v = -delta;
    return v === 0 ? 0 : v;
  }
  return delta;
}

/**
 * MOD_LABEL — the frozen relabel map for the two engine mod names a player
 * cannot read as written: "penalty" (the Weaken cap, C.foeToHitPenalty) to
 * "Weaken", and "overhead" (the Overhead Blow ability's needShift) to
 * "Overhead Blow". Every other mod name is displayed as-is.
 */
export const MOD_LABEL = Object.freeze({ penalty: "Weaken", overhead: "Overhead Blow" });

/**
 * modLabel(name) — looks up MOD_LABEL by OWN property only (never the
 * inherited Object.prototype chain, so a mod literally named "constructor"
 * or "toString" reads back as its own name, not a built-in). Falls back to
 * String(name) for any name not in the map, and to "?" when name is
 * missing (undefined/null).
 */
export function modLabel(name) {
  if (name === undefined || name === null) return "?";
  if (Object.prototype.hasOwnProperty.call(MOD_LABEL, name)) return MOD_LABEL[name];
  return String(name);
}

/**
 * modText(mod, roller) — one modifier entry, player-signed and relabelled:
 * "Sidestep +2", "Weaken +2", "afraid −3".
 */
export function modText(mod, roller) {
  return `${modLabel(mod && mod.name)} ${signedText(playerDelta(mod && mod.delta, roller))}`;
}

/**
 * modsText(mods, roller) — every modifier entry, ", "-joined and
 * player-signed: "Sidestep +2, insulted −1". A non-array or empty list
 * (including null/undefined) reads "".
 */
export function modsText(mods, roller) {
  if (!Array.isArray(mods) || mods.length === 0) return "";
  return mods.map((m) => modText(m, roller)).join(", ");
}

/**
 * modsClause(mods, roller) — modsText wrapped in the trailing parenthetical
 * clause every roll line appends after its range: " (Sidestep +2, insulted
 * −1)". An empty/absent mods list adds no clause at all — never empty
 * parentheses.
 */
export function modsClause(mods, roller) {
  const t = modsText(mods, roller);
  return t ? ` (${t})` : "";
}

/**
 * ROLL_COPY — the frozen copy bank for this module's own short templates.
 * `toHit` is filled by toHitText.
 */
export const ROLL_COPY = Object.freeze({ toHit: "{signed} to hit" });

/**
 * toHitText(delta) — "−2 to hit" / "+1 to hit". `delta` here is already
 * player-signed (the caller has already run it through playerDelta, or it
 * is a display-only value such as an item's flat to-hit bonus that is
 * always written from the player's side).
 */
export function toHitText(delta) {
  return ROLL_COPY.toHit.replace("{signed}", signedText(delta));
}
