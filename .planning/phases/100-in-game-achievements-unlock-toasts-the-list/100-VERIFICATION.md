---
phase: 100
status: passed
verified: 2026-10-05
method: orchestrator (verifier agents off per config; deferred-UAT protocol)
human_verification:
  - "☰ ACHIEVEMENTS row after MARKS with a star glyph and 'N / 77' count; never dimmed, including the death screen"
  - "List: Pixel 7 portrait one column, landscape centred column scrolling on its own, no sideways scroll; 7\" and 10\" tablet emulators two columns in both orientations"
  - "A tiered track expands and folds without the list jumping; TalkBack reads rows and the expandable track, skips icons and the I–IV ladder"
  - "Android back closes the sheet in one press; with remove-animations on, no motion"
  - "A real unlock raises the card (icon, ACHIEVEMENT, name, line), holds ~2x, tap dismisses, TalkBack announces once"
  - "An unlock earned in a fight shows no card until the last-round playback ends"
  - "Floor-1 death: Special Snowflake in the EARNED, POSTHUMOUSLY strip above BURY THEM, both buttons reachable"
  - "Icons present in the installed debug APK (list, card, strip)"
---

# Phase 100 Verification

**Status: passed** on automated evidence; device rows deferred to the milestone-close checklist.

| Criterion | Evidence |
|---|---|
| 1. Unlock shows a rail card (not a decision card) with name + line; never blocks a fight, store or death screen | achievement-card (8), card-queue (19), banner-shell (35); fight hold + death Earned strip |
| 2. Several unlocks at once stay readable, none lost | queue property test; >3 collapse into one summary card that opens the list |
| 3. ☰ list with icons, earned dates, greyed locked rows, progress, secret teasers | sheet model/view/render (23+24+21), sheet-shell (22); 35 track rows in 7 blocks |
| 4. Fits every layout class, sheet conventions, back, TalkBack, reduced motion | `npm run layout:check` 12/12 profiles × 18 scenes + 7/7 boundary probes; achievements-shell-a11y (18) |

Full suite at phase close: 11,066 tests — first run 3 failures (bot-isolation walk reaching the pure tracker via tools/layout-check.mjs; narrative-review ledger index shift from the new ☰ row; text-scale glyph allowlist), all three fixed in the phase-close commit and re-run green (bot-isolation 4/4, narrative-review 11/11, text-scale 12/12).
