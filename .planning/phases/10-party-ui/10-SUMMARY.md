---
phase: "10"
name: Party UI
status: complete (built; device visual-check pending — see below)
completed: 2026-09-09
tests: 596/596 (UI-only; no engine/parity impact)
requirements: [PARTY-07, PARTY-01 (UI half)]
---

# Phase 10: Party UI — SUMMARY

**Complete 2026-09-09**, UI-only in `mazeworld.html`. `npm test` = **596/596** (no engine/parity files touched). **BUILD SUCCESSFUL** (www + cap sync + assembleDebug). **Device deploy PENDING** — the Pixel 7 dropped off wireless adb (port rotated + offline); needs the user to re-enable wireless debugging, then deploy. The Phase-10 visual checkpoint on the Pixel 7 is the one remaining item.

## What landed (all `mazeworld.html`)
- **Party rail** — `.mw-party-rail` CSS (784-795, reuses the map HP-bar + Phase-4 status-chip treatments), DOM under the hero HUD (1236), `renderPartyRail()` (4438-4477) called from `paint()` (2856): one card per `S.party` member (name, `sub · <roman lvl>`, HP bar, "Downed" chip), hidden when solo, written for N members though cap=1.
- **Accept/Decline prompt** — in `renderEncounter()` (4543-4558), gated `S.pendingJoiner && !S.combat && !S.store`; reuses the encounter overlay styling; "Take them along" → `window.mzResolveJoiner(true)`, "Leave them" → `false`; ≥48dp, separated (UX-02). `hasActiveEncounter()` (~4353) now true for `S.pendingJoiner` so the overlay hosts the prompt.
- **Bridge** — `window.mzResolveJoiner(accept)` (5676-5684), mirrors `window.mzLeaveStore`/`mzBuyItem`: `dispatch({type:"resolveJoiner", accept})` → `__mzState.set` → Oracle log → `paint()`. No new global state.

## Requirements: PARTY-07 ✅ (rail), PARTY-01 UI half ✅ (accept/decline prompt). Engine half was Phase 9.
## Pending: Pixel 7 deploy + visual checkpoint (blocked on wireless adb). Next: Phase 11 (balance) — see sequencing note in STATE/ROADMAP.
