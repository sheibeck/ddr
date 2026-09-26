---
created: 2026-09-26T00:00:00.000Z
title: Map the Floor lasts only until you move (focus breaks on the first step)
area: rules
resolves_phase: 76
files:
  - content/spells.js:92 (Map the Floor: kind "reveal", squares: 40, txt "mapped for 40 squares, then the map forgets")
  - engine/magic.js:389-409 (reveal cast: marks unseen cells seen+spellSeen, startEffect "spell:reveal" {squares})
  - engine/movement.js:496-508 (squares tick; on the spell:reveal effect→ transition, refogSpellSeen + revealFaded event)
  - engine/maze.js:245-251 (refogSpellSeen: re-fogs only never-walked spellSeen cells)
  - engine/derived.js:814-821 (reveal chip: remaining squares, cadence "squares")
  - content/scroll-fumbles.js:57 (scroll fumble mapping; unaffected)
---

## Problem

User (2026-09-26): "I think that revealing the dungeon spell should last only until you move. Then you lose focus and map stops being revealed. it's pretty powerful to be able to map your way around and move."

Today Map the Floor shows the whole floor for 40 squares of walking. That is enough to walk straight to the stairs or a treasure room with the full map visible. The user wants a snapshot, not a navigation aid: you study the map while standing still, then your first step breaks your concentration and the floor re-fogs.

## Solution

- The reveal window closes on the hero's FIRST step after the cast. Squares the hero actually walks through keep their normal `seen` state (refogSpellSeen already graduates walked cells), so the refog only takes back what the spell showed.
- The simplest seam: set Map the Floor to squares: 1 (or add a `untilMove` flag) so the existing tickSquares → refogSpellSeen → revealFaded path fires on the next step. No new expiry machinery is needed.
- Rewrite the text honestly, e.g. "sight · the whole floor · shown until you take a step, then your focus breaks and the map forgets". Update the reveal chip copy: no squares countdown, something like "Mapped · until you move". Update the revealFaded narration/rail line to fit "you lose focus" (the Oracle voice gets a sarcastic line about looking down at your feet).
- Check what else ends the window. Recommended: only movement ends it. Opening tabs, casting, resting and camping keep it, and a fight that starts on the same square keeps it too.
- Consequences to check:
  - bot and state pins (the bot casts Map the Floor); declare any moved fixtures and re-pin with the traced cause
  - the Apprentice/Sorcerer spell-value tables, if Map the Floor is priced by duration
  - EVENT_NARRATION entries
  - the balance effect, measured in the Phase 79.1 end-of-milestone bot pass, not per plan
- Candidate home: Phase 76 (Darkness Unification — the sight/fog phase, not yet executed). Otherwise Phase 79.
