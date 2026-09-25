---
created: 2026-09-25T00:00:00.000Z
title: Rail lines when a spell charge is regained and when a new day refills the book
area: ui
resolves_phase: 78
files:
  - engine/movement.js:502-505 (every 20 squares a Magic User regains one charge; pushes `spellChargeRecovered {charges, max}`)
  - src/browser/narrationLines.js:174 (ORACLE_ONLY — "spellChargeRecovered", // the grimoire/HUD charge display already shows this)
  - src/browser/eventNarration.js:224 (the Oracle line exists)
---

## Problem

User, 2026-09-25: "we're no longer getting a rail update when a spell charge is regained."

**Root cause (read from the code):**
- `spellChargeRecovered` has been in `ORACLE_ONLY` since Phase 25 (FEED-01). The reason given there is "the grimoire/HUD charge display already shows this".
- The HUD no longer shows spell charges; they live only in the Grimoire. So the exclusion's reason is stale.
- A regained charge is now visible only in the Oracle log. On the map, nothing tells the player.

## Second report (same day)

User, 2026-09-25: "I think there might be a bug in recharge magic charges. I had 1 charge left, moved only maybe 25-39 squares, then when combat started I had 12 charges. I'm level 5."

**Diagnosis: not a recharge bug.**
- Every 100 cumulative squares, `newDay` (engine/movement.js ~L631-634) runs. It sets `c.spellsUsed = 0` (a full book: 12/12 at level 5 = 2×5+2) and ALSO rolls the 8-hour wandering-monster check, which likely started that fight.
- Both happen on the same step, and neither the new day nor the refill is on the rail (`dayBegan` and `spellChargeRecovered` are ORACLE_ONLY). So a full refill looks like a glitch.

## Solution

- Remove `spellChargeRecovered` from `ORACLE_ONLY` and give it a `LINE_FOR` entry. Per the card-vs-toast ruling it is a minor event, so it gets a toast line (no card) in the voice, with the count, e.g. "A charge seeps back into the book. 3/6."
- Update the narration-lines coverage and snapshot tests.
- A new day gets a rail line naming the refill, e.g. "A new day. Your book is full again (12/12)." It shows before any wanderer the same day brings, and it's a toast unless a fight follows (then the fight's card leads and this line sits in its lead-in). Members' refills are summarised in the same line.
- Check `ORACLE_ONLY`'s other entries for the same stale "the HUD shows this" reasoning: `dayBegan` and `floorChanged` still have HUD fields. Fix any other entry whose reason no longer holds.
- This is presentation-only, so no engine change and no fixture moves.

**Pixel 7 check (milestone close):** as a Magic User with a spent charge, walk 20 squares. A rail line reports the charge coming back.
