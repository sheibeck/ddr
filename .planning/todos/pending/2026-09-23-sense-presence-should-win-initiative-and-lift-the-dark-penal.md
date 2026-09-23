---
created: 2026-09-23T04:37:49.776Z
title: Sense Presence should win initiative and lift the dark penalties
area: engine
files:
  - engine/combat.js:176-205 (resolveInitiative — `c.senses` only waives the forced foe-first rules; the d20s still decide)
  - engine/combat.js:489 (combatInDark event — fires with senses up; "You cannot see what you are fighting.")
  - engine/combat.js:673 (no-crit-in-dark — ignores senses)
  - engine/derived.js:1063 (toHit dark cap — already waived by senses; the one read that honours it)
  - content/spells.js:113 (Sense Presence txt — "fight in the dark at full skill and nothing gets the jump on you, till your next fight ends")
  - src/browser/eventNarration.js:359, src/browser/narrationLines.js:1113 (combatInDark copy)
---

## Problem

Reported from a device run (2026-09-23), in the user's words: "I cast sense presence which gave me the 'senses' condition. Nothing was supposed to get the jump on me until the end of my next combat. I encountered combat and lost the initiative. It seems like I should have auto-won the initiative with senses."

The run: depth 8, Human Court Mage, dark square. Log: "You cannot see what you are fighting." → "Initiative — you 2, Blumble 17. They go first." → "2 vs 5. Blumble hits you for 14 hp." → "You have died."

Root cause: Phase 40 (SPELL-02) read "nothing gets the jump on you" as only WAIVING the forced foe-first rules (Samurai, Fridgian slow, Knight vs a big foe, Court Mage round 1): `forcedFoe = (...) && !foreseen && !c.senses`. After the waiver the roll still decides (`mine >= theirs`), so a Court Mage with senses up loses on 2 vs 17. The spell text promises more than the engine delivers.

Two related slips in the same fight: with senses up, the engine still emits `combatInDark` ("You cannot see what you are fighting.", combat.js:489), and the no-crit-in-dark rule (combat.js:673) ignores senses. Only `toHit`'s dark cap (derived.js:1063) honours it, although the spell says "fight in the dark at full skill".

## Solution

Engine rule change (declared; the user's reading of the spell text is the ruling to confirm):
1. `resolveInitiative`: senses joins the foreseen / Acute Hearing branch, so `C.first = forcedFoe ? "foe" : foreseen || acuteHearing || c.senses ? "you" : …`, with `why: "senses"` narrated ("You felt them coming."). Both d20s are still drawn, so the draw count is unchanged.
2. `combatInDark` (combat.js:489) and the no-crit-in-dark clause (combat.js:673) both add `&& !c.senses`, so "full skill in the dark" means no dark to-hit cap, no dark crit ban and no "cannot see" line. Optionally narrate a senses line in its place.
3. Update the Phase 40 JSDoc and `docs/SPELLS.md` to state the new rule.

Fixtures: no parity fixture carries `senses` (grep of `test/parity/fixtures/*.json` is clean), so none should move; confirm with the fixture scan. The tuning bot does not cast Sense Presence (no reference in `tools/lib/tuning-bot.mjs`), so the curve is unaffected. Unit tests: a Court Mage with senses wins initiative on any roll; no `combatInDark` with senses in the dark; crits allowed in the dark with senses. Fits backlog 999.6 (engine rules fixes from the device rounds) or an engine quick task between phases. Pixel 7 check: cast Sense Presence, walk into a fight on a dark square, and confirm "you go first" with no "cannot see" line.
