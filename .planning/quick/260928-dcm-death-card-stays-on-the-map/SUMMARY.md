---
quick_id: 260928-dcm
status: complete
date: 2026-09-28
---

# Quick 260928-dcm: the death card stays on the map (summary)

(Written by the orchestrator from the executor's returned text.)

**Result:** whenever the MAP tab shows while the hero is dead, the death card (THAT IS THAT: REVIEW THE ORACLE, FINAL SHEET, BURY THEM) is up. That holds after leaving the map for ORACLE, DEAD or the ☰ and returning, and after a relaunch. This supersedes HUD-02's put-aside (user ruling 2026-09-27). UI-only. Commits 2f07cdc0 (fix and tests) and 9435c43b (the todo move).

## Fix (mazeworld.html)
- `mwDeadMapAside` and all four reads are removed.
- showTab no longer sets it, and syncDeadTabLock no longer clears it. renderEncounter's put-aside branch is deleted, so a dead state always reaches the `S.dead` death branch.
- `deadMapLookOnly()` is now `return !!(S && S.dead);`: the viewport gate still allows only a drag or pinch on the dead map.
- Taps, holds, keys, HERO/GEAR and the dimmed ☰ rows stay locked. paint()/draw() are untouched, and no CSS was added.

## Tests
- dead-lockdown.test.js has an `assertDeathCardUp` helper (title, the three buttons in order, each live) and cases for:
  - just died;
  - returning from ORACLE and from DEAD;
  - the ☰ on the map and from ORACLE;
  - a relaunch;
  - the flag being gone;
  - drag and pinch at the input gate;
  - tap and hold staying inert.
- The old put-aside tests were re-pinned or removed with the ruling as the reason. shell-map-viewport.test.js (f) re-pinned.

## Gates (worktree)
npm test 7,506/7,506; parity 66/66; build:www + boot:check PASS.

## Open design point (raised with the user)
The death card is the full `#enc-panel` overlay with a solid background, so while it's up the map is NOT visible behind it on the phone, and a finger lands on the card. The 2026-09-26 "look at the map where you died" ruling now conflicts with "always show the card". Satisfying both needs the death card to become a shorter, bottom-anchored card over the map.

## Pixel 7 check
1. Die, open ORACLE, return to MAP: the card and its three buttons are there.
2. Repeat via DEAD and via the ☰.
3. Relaunch while dead: the card shows.
4. Each button works.

## User ruling on the open point (2026-09-28)
"No need for the map when you're dead. Full screen." The full-screen death card stays as merged. The 2026-09-26 "look at the map where you died" ruling is retired; the input-gate drag/pinch path is harmless and stays.
