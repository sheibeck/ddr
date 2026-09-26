// src/browser/rollOdds.js
//
// Phase 74 (ROLL-02/03, "Roll Display & Modifier Honesty"): the ONE place
// every non-event "right now" odds reading is computed. Every function here
// is a pure read of the engine's own derived functions
// (engine/derived.js — toHit, afraidNeed, strikeDie, foeDie, fleeBreakdown,
// heroStrikeFacesVs, foeSwingVsHero, scrollReaderOf, scrollReadBands) —
// NEVER a re-derived formula (per 74-CONTEXT, "MUST NOT compute a displayed
// range from a restated to-hit formula"). Every string is formatted only
// through src/browser/rollRange.js (facesRangeText/hitRangeText/modsText/
// rangeText/bottomRangeText/dieText/ROLLERS, 74-02/75.1-06) — the same
// range/sign rules every other roll surface in this phase uses, so this
// module and the engine's own events can never disagree.
//
// Consumers: 74-04 (the hero sheet's TO HIT row and the combat menu's
// STRIKE/FLEE rows), 74-06 (foe details' "right now" odds line), 74-07
// (the hero condition-chip effects). 75.1-07 (RULES-10) adds
// scrollReadOdds — the Gear tab's SCROLLS row and the combat ITEMS SCROLL
// row both append it to their description. Phase 77's CMBUI-13 effect
// indicators are expected to reuse this module too rather than re-deriving
// anything.
//
// The only arithmetic in this file is fleeOdds's `need − bonus` (converted
// to a winning-faces count for facesRangeText), which mirrors
// engine/combat.js#flee's own threshold line exactly (`atLeast = need −
// bonus`; the check is `roll >= atLeast`, since fleeBreakdown's mods are
// already summed into `bonus`) — every other value here is a direct
// pass-through of the engine's own faces/mods.
//
// Pure, no DOM, no rng, no mutation of state/c/foe anywhere in this file.

import { toHit, afraidNeed, strikeDie, foeDie, fleeBreakdown, heroStrikeFacesVs, foeSwingVsHero, scrollReaderOf, scrollReadBands } from "../../engine/derived.js";
import { facesRangeText, hitRangeText, modsText, rangeText, bottomRangeText, dieText, ROLLERS } from "./rollRange.js";

/**
 * heroHitOdds(state) — the hero's own "right now" to-hit range on their
 * current strike die: `afraidNeed(state, toHit(state))` winning faces on
 * `strikeDie(state.c)`, formatted "16–20 (d20)". Includes every term
 * toHit/afraidNeed already apply (dazed, dark cap, inspired, the weapon's
 * own need modifier, and the live Afraid penalty) — this is the value the
 * hero sheet's TO HIT row and the combat menu's STRIKE row both read, so the
 * two surfaces can never disagree.
 */
export function heroHitOdds(state) {
  const faces = afraidNeed(state, toHit(state));
  const dieN = strikeDie(state.c);
  return { faces, dieN, range: facesRangeText(faces, dieN), text: hitRangeText(faces, dieN) };
}

/**
 * heroHitOddsVs(state, foe) — the hero's normal (non-frenzy, non-ability)
 * swing odds against a specific `foe` right now: `heroStrikeFacesVs(state,
 * foe)` (74-01) on `strikeDie(state.c)`. `untouchable` is true when the
 * target-trait terms (magicOnly/daggerOnly without the right weapon) zero
 * the faces out — a caller shows the foe's own rule line instead of a
 * misleading "nothing" range in that case.
 */
export function heroHitOddsVs(state, foe) {
  const faces = heroStrikeFacesVs(state, foe);
  const dieN = strikeDie(state.c);
  return {
    faces,
    dieN,
    range: facesRangeText(faces, dieN),
    text: hitRangeText(faces, dieN),
    untouchable: faces <= 0,
  };
}

/**
 * foeHitOddsVs(state, foe) — `foe`'s swing odds against the hero right now:
 * `foeSwingVsHero(state, foe)` (74-01) on `foeDie(state.c, foe)`. `text`
 * carries the modifier clause, signed from the player's side via
 * `ROLLERS.foe` (74-CONTEXT "Modifier signs everywhere" — a foe roll's
 * engine-stored, roller-signed delta is negated so a bonus to the foe always
 * reads as a minus for the player, and vice versa); `plainText` is the same
 * range with no modifier clause, for a surface that lists mods separately.
 */
export function foeHitOddsVs(state, foe) {
  const { faces, mods } = foeSwingVsHero(state, foe);
  const dieN = foeDie(state.c, foe);
  return {
    faces,
    dieN,
    mods,
    range: facesRangeText(faces, dieN),
    text: hitRangeText(faces, dieN, { mods, roller: ROLLERS.foe }),
    plainText: hitRangeText(faces, dieN),
  };
}

/**
 * fleeOdds(c) — the character's flee-check winning range on a d20:
 * `fleeBreakdown(c)` gives `{ need, mods, bonus }`; the flee threshold
 * (mirroring engine/combat.js#flee's own `atLeast = need − bonus` — the
 * check is `roll >= atLeast`) converts to a winning-faces count
 * (`dieN + 1 − atLeast`) so it can go through the SAME facesRangeText/
 * hitRangeText conversion every other range in this module uses.
 * `modsText` is the standalone, player-signed modifier list ("Thief +5")
 * for a surface (the combat menu's FLEE desc) that shows it apart from the
 * range; `text` itself carries no modifier clause.
 */
export function fleeOdds(c) {
  const fb = fleeBreakdown(c);
  const atLeast = fb.need - fb.bonus;
  const dieN = 20;
  const faces = dieN + 1 - atLeast;
  return {
    atLeast,
    dieN,
    mods: fb.mods,
    range: facesRangeText(faces, dieN),
    text: hitRangeText(faces, dieN),
    modsText: modsText(fb.mods, ROLLERS.you),
  };
}

/**
 * SCROLL_ODDS_COPY — RULES-10 (Phase 75.1): the frozen templates
 * scrollReadOdds fills below. `autoMagicUser`/`autoRunes` are the two
 * automatic-reader sentences (no roll at all — engine/derived.js#
 * scrollReaderOf's "magicUser"/"runes" paths); `intel` is the roll-high
 * reading-range clause every other reader gets, and `fumbleClause` is
 * appended to it only when a fumble band actually exists (never an empty
 * "; nothing backfires").
 */
export const SCROLL_ODDS_COPY = Object.freeze({
  autoMagicUser: "Reads without fail (Magic User).",
  autoRunes: "Reads without fail (Runes/Signs).",
  intel: "Reads on {range} ({die}, intel {intel})",
  fumbleClause: "; {range} backfires",
});

/**
 * scrollReadOdds(state) — RULES-10 (Phase 75.1): the ONE place a scroll
 * reader's own odds are computed, read purely off
 * `engine/derived.js#scrollReaderOf(c)`/`scrollReadBands(c.intel)` and
 * formatted only through `rollRange.js`'s `rangeText`/`bottomRangeText`/
 * `dieText` — never a re-derived formula, exactly like every other function
 * in this module. A `magicUser` or `runes` reader always reads "without
 * fail", naming which; every other reader (an "intel" reader, including a
 * Pilfer — the reader reads exactly like anyone else under this rule) gets
 * "Reads on {range} (d20, intel {n})", with a trailing "; {range} backfires"
 * clause appended only when the fumble band is non-empty (an intel of 20
 * shows no fumble band at all; a missing/absent intel reads as 0, the worst
 * possible reader). The two SCROLLS rows (gearTab.js's CONSUMABLES row and
 * combatMenu.js's ITEMS row) both append this text to their existing
 * description, so the two surfaces can never disagree.
 */
export function scrollReadOdds(state) {
  const c = (state && state.c) || {};
  const reader = scrollReaderOf(c);
  if (reader === "magicUser") return SCROLL_ODDS_COPY.autoMagicUser;
  if (reader === "runes") return SCROLL_ODDS_COPY.autoRunes;
  const intel = Number.isFinite(c.intel) ? c.intel : 0;
  const bands = scrollReadBands(c.intel);
  const range = rangeText(bands.atLeast, bands.dieN);
  const die = dieText(bands.dieN);
  const base = SCROLL_ODDS_COPY.intel.replace("{range}", range).replace("{die}", die).replace("{intel}", String(intel));
  const fumbleRange = bottomRangeText(bands.fumbleAtLeast);
  const fumble = fumbleRange === "nothing" ? "" : SCROLL_ODDS_COPY.fumbleClause.replace("{range}", fumbleRange);
  return `${base}${fumble}.`;
}
