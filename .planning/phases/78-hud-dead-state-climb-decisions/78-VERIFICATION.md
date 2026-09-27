---
phase: 78-hud-dead-state-climb-decisions
status: passed
verified: 2026-09-27
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 11/11 requirements
human_verification:
  - "Walk into a wall or crevice: a card offers CLIMB IT / LEAP IT with a d10 range, USE LADDER / USE ROPE only while carried, and TURN BACK. No dice until you commit. TURN BACK costs nothing (no step, no day tick, no fear). Map taps and arrow keys pulse the card, a relaunch mid-card brings the same card back, and it rolls the same."
  - "Band 1 reads 'Race Sub-class · Lvl N'. At S, M and L the level always shows, and the name ellipsizes first."
  - "A regained spell charge gets a rail line with the count. A fed new day that refills a spent book says so, with the count; an unfed day keeps 'Book stays empty.'"
  - "Die on the map: the death card offers REVIEW THE ORACLE, FINAL SHEET and BURY THEM. HERO and GEAR are dimmed; ORACLE and DEAD open. MAP shows where you died (drag and pinch only; tap, hold and arrows do nothing). In the ☰, MARKS, CENTRE MAP and MAKE CAMP are dimmed. FINAL SHEET lists stats, level, gear, the book and the epitaph, and has only Close."
  - "Text size S, M and L scale every screen, the combat screen included. In Settings a vertical drag starting on a volume slider scrolls the sheet and never changes a volume; a sideways drag or a track tap sets it."
  - "Stairs: the screen fades to black under the stairs sound, the new floor fades in, and the FLOOR card follows. Input is ignored during the fade. Remove-animations gives an instant cut; a teleport still snaps."
  - "Acute Hearing (a Thief): faint rings on unresolved encounter dots up to 3 squares away, through walls, never on traps or chests. Holding one says only that something is there. MARKS has a HEARD row. A hero without the skill never sees rings."
  - "Settings › Movement: TAP TO MOVE (the default) or ARROWS, with the pad bottom left or bottom right. Each press is one step and map taps don't step. The map scrolls before the party slips under the pad. The pad is inert while dead, in a fight, at the stair prompt or under a sheet. TalkBack reads 'Step north'."
  - "Full bag at text size L, find a weapon: the item, its stats and TAKE IT NOW / LEAVE IT stay visible, and the drop list scrolls inside the card with each row's stats."
  - "The full numbered list (37 items) is in 78-09-SUMMARY '## Phase 78 Pixel 7 checklist'."
---

# Phase 78: HUD, Dead State & Climb Decisions — Verification

**Verdict:** passed on automated evidence. The device checks are batched into the milestone-close Pixel 7 checklist.

## Requirement coverage

| Req | Evidence | Status |
|-----|----------|--------|
| CLIMB-01 | 78-01: the engine pre-roll decision (`pendingHazard`, the `hazardChoice` event, the validated `resolveHazard` action). The golden capture of 41 scenarios proves the commit replays the old roll draw for draw. The bot answers it; the save loader resumes it. 78-03: the rail card (`hazardCard.js`, `hazardOddsText` through rollRange) with the retry card retired. 78-04: the exposure guard (`hazard-exposure.test.js`) and a relaunch probe of 44 hazards with zero diffs | ✓ |
| CLIMB-02 | Same chain: TURN BACK is free, tools are spent with no roll, and Heights arms only on the commit | ✓ |
| HUD-01 | 78-05: band 1 "Race Sub-class · Lvl N". 78-06: the split span, so the level is never cut off at S, M or L (worst-case walk at 411px) | ✓ |
| HUD-02 | 78-06: the dead-state lockdown with the map viewable read-only (user ruling 2026-09-26) | ✓ |
| HUD-03 | 78-06: the read-only FINAL SHEET on the death card and the DEAD tab | ✓ |
| HUD-04 | 78-02: every font token and font-size follows `--mw-text-scale` on the root (148 sizes converted), with band caps; guarded by `text-scale.test.js` | ✓ |
| HUD-05 | 78-02: the slider gesture classifier (vertical scrolls, sideways or a tap sets) | ✓ |
| HUD-06 | 78-08: the stairs fade controller (0.6s out, 0.4s in, an instant cut for reduced motion), with input locked | ✓ |
| HUD-07 | 78-09: `heardSquares` (HEARING_RANGE 3, through walls, option A) and the heard ripple, its hold card and MARKS row | ✓ |
| HUD-08 | 78-07: the Movement/Pad settings and the arrow pad through the same step path, with tap-to-move off in arrow mode and `keepInViewRect` | ✓ |
| HUD-09 | 78-08: the full-bag find card as a height-capped column, where only the drop list shrinks and scrolls; the loot shelf is aligned with it | ✓ |

Also in this phase: the regained spell charge and book refill rail lines (78-05), crossings narrated like moves (78-06, from 78-03's follow-up), and the bridge docs.

## Automated gates (see the commit message for the master SHA)
- **Master 5134f28f at the phase close: `npm test` 7242/7242, parity 66/66, `boot:check` PASS.** Every plan's own worktree gate was green; 78-09's final worktree run was 7242/7242, parity 66/66, boot:check PASS.
- **Zero parity fixtures moved** (the hazard exposure is zero). 78-01 re-pinned 5 of 8 state pins, each traced to action-counter-keyed streams (a pause bumps the counter) with unchanged dead/depth/actions, and re-recorded only the pre-switch save's `expected.hash`.
- No bot balance runs, per the user ruling. The Phase 78 stub in DIFFICULTY-RETUNE.md points to Phase 79.1.
- **Process note:** 78-03's executor had its commit refused by the permission classifier. The user approved the orchestrator committing that work (7635a05e).
