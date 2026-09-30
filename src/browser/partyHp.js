// src/browser/partyHp.js
//
// Phase 87 (PARTY-11, player report #5) — the ONE read of a Joiner's hp for
// every party display (YOUR LOT in the combat panel, the Hero tab's Company
// panel). During a fight the engine subtracts a foe hit (and adds a heal)
// on the fight's roster entry, `state.combat.allies[k]`, and syncs it back
// to the persistent sheet `state.party[i].wp` only at endCombat. A display
// that read the sheet therefore showed the stale pre-fight number ("Cave
// Bear turns on Zell Bonecrack for 11 hp", card still 30/30).
//
// PRESENTATION ONLY, pure module: plain state in, plain numbers out. No DOM,
// no engine import, no mutation, no rng.

/**
 * memberLiveWp(state, partyIdx) — { wp, maxWP, down } for `state.party[partyIdx]`.
 *
 * - During a fight, wp/maxWP come from the roster entry whose `partyIdx`
 *   matches (looked up by partyIdx, never by array position: downMember
 *   splices a downed member out, so positions shift).
 * - Outside a fight, or in a solo fight (no `allies` key), or when no roster
 *   entry matches, they come from the persistent sheet.
 * - A sheet flagged `status: "downed"` reads wp 0 / down true whatever the
 *   stale sheet wp says (the entry is already gone from the roster).
 * - A missing state, party, or sheet reads { wp: 0, maxWP: 1, down: true }.
 *   Never throws.
 */
export function memberLiveWp(state, partyIdx) {
  const sheet = Array.isArray(state?.party) ? state.party[partyIdx] : null;
  if (!sheet || typeof sheet !== "object") return { wp: 0, maxWP: 1, down: true };
  const sheetMax = sheet.maxWP || 1;
  if (sheet.status === "downed") return { wp: 0, maxWP: sheetMax, down: true };
  const allies = state?.combat?.allies;
  const entry = Array.isArray(allies) ? allies.find((a) => a && a.partyIdx === partyIdx) : undefined;
  if (entry) {
    const wp = Math.max(0, Number(entry.wp) || 0);
    return { wp, maxWP: entry.maxWP || sheetMax, down: wp <= 0 };
  }
  const wp = Math.max(0, Number(sheet.wp) || 0);
  return { wp, maxWP: sheetMax, down: wp <= 0 };
}
