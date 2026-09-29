---
phase: 86-compliance-device-close
plan: 05
subsystem: docs
tags: [uat, device-testing, play-games-retirement, leaderboards, release-checklist]

# Dependency graph
requires:
  - phase: 86-compliance-device-close
    provides: "86-01's debug APK identity (2.2.0, versionCode 12, byte size, sha256, build commit); 86-03's ordered docs/RELEASING.md checklist and docs/LEADERBOARDS.md section 16 (Play Console cleanup); 86-04's store-listing/LISTING.md Data safety user step"
  - phase: 84-leaderboards-panel-v3
    provides: "84-VERIFICATION.md's 13-item human_verification list (the v3 panel)"
  - phase: 85-play-games-out-our-board-in
    provides: "85-VERIFICATION.md's 10-item human_verification list (account block, submission, erase, Compete OFF)"
  - phase: 83-leaderboard-server
    provides: "83-VERIFICATION.md's 3-item human_verification list (83-09's bug-report limit states)"
provides:
  - "docs/UAT-v2.2.md — the milestone's one batched Pixel 7 checklist, every Result open"
  - "docs/UAT-v2.1.md rows 0.3, 15.1-15.4, 15.8 marked superseded, pointing at docs/UAT-v2.2.md"
  - "docs/UAT-v2.0.md's F1 and 31 other Play Games rows (32 total) marked superseded, pointing at docs/UAT-v2.2.md"
affects: ["the eventual 2.2.0 release walk (the user's own Pixel 7 sessions against docs/UAT-v2.2.md)"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - docs/UAT-v2.2.md
  modified:
    - docs/UAT-v2.1.md
    - docs/UAT-v2.0.md

key-decisions:
  - "No 85-VERIFICATION human_verification item described a card proposing to send runs played while Compete was off, so nothing needed to be left out per the 2026-09-29 orchestrator correction — a positive row (2.14) was added instead, stating the correct behavior and its absence explicitly."
  - "Section 0 combines docs/RELEASING.md steps 2-3 (release build + ask-before-upload) into one row (0.2) and steps 4-5 (rules deploy + probe) into one row (0.3), matching the plan's 'one row per checklist step... or steps N-M for a combined row' instruction; each of the 8 rows still cites its RELEASING.md step number(s) individually."
  - "Section 2 (Phase 85) adds four COMP-04 rows (2.11-2.14) beyond the 10 VERIFICATION items: RE-ROLL HANDLE renaming board runs, ERASE MY RUNS' board-vs-YOUR-DEAD asymmetry, Compete OFF in airplane mode with a full run and death, and the explicit 'never uploaded' two-death check — none of these four exact behaviors were already covered by the 10-item list (checked line by line against every 85-*-SUMMARY.md's Human verification section, which duplicate rather than extend the VERIFICATION list)."
  - "No pointer row to a longer numbered SUMMARY device checklist was needed for section 1 or 2: 84-08-SUMMARY.md's 10-item list and 84-09-SUMMARY.md's 2 extras, and 85-01/04/05/06's 3+8+4+3 items, all map one-to-one into 84-VERIFICATION.md's 13 items and 85-VERIFICATION.md's 10 items respectively — confirmed by reading every plan SUMMARY's Human verification section."

requirements-completed: [COMP-04, COMP-03]

coverage:
  - id: D1
    description: "docs/UAT-v2.2.md assembled: header (Build/Protocol/Install note/Sources), section 0 (8 user tasks in RELEASING.md order), section 1 (13 Phase 84 rows), section 2 (14 Phase 85 rows, 10 from VERIFICATION + 4 COMP-04 additions), section 3 (3 Phase 83 rows), section 4 (4 rows for this build), section Q (0 quick tasks since 2.1.0); every Result open"
    requirement: COMP-04
    verification:
      - kind: unit
        ref: "all acceptance-criteria greps from 86-05-PLAN.md Task 1 run individually during execution: headings present once each, sha256/app-debug.apk/2.2.0 (versionCode 12) in header, every data row ends '| open |', section 0 carries --probe-rules/firebase.json/BUG-REPORTS.md/firestore-transition-rules.test.js/npm run deploy/LISTING.md/LEADERBOARDS.md/Season 1 reset, RELEASING.md cited 9 times, COMP-04 coverage terms all present, 'offer' count 0, section 3 has 3 rows, section 1 (13) and section 2 (14) each meet or exceed their VERIFICATION item counts"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/UAT-v2.1.md rows 0.3, 15.1, 15.2, 15.3, 15.4 and 15.8 marked superseded with a 'docs/UAT-v2.2.md §N' pointer; rows 15.5-15.7 and every other row left untouched"
    requirement: COMP-03
    verification:
      - kind: unit
        ref: "grep -E \"^\\| (0\\.3|15\\.1|15\\.2|15\\.3|15\\.4|15\\.8) \\|\" docs/UAT-v2.1.md | grep -c \"| superseded |$\" -> 6; same rows grep -c \"docs/UAT-v2.2.md\" -> 6; grep -E \"^\\| 15\\.(5|6|7) \\|\" docs/UAT-v2.1.md | grep -c \"| open |$\" -> 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/UAT-v2.0.md's F1 and every row needing Play Games sign-in, boards, console setup or the profile delete steps (32 rows total) marked superseded with a pointer; E1/E4/B17 (already superseded by Phase 70) left as-is; the header's 'Sign-in and leaderboard rows' paragraph gets one added sentence"
    requirement: COMP-03
    verification:
      - kind: unit
        ref: "grep -E \"^\\| F1 \\|\" docs/UAT-v2.0.md | grep -c \"| superseded |$\" -> 1 and contains docs/UAT-v2.2.md; grep -c \"Superseded by 2.2 (Play Games removed)\" docs/UAT-v2.0.md -> 32; grep -c \"Superseded in 2.2: Play Games is removed\" docs/UAT-v2.0.md -> 1; git diff --stat confirms exactly 32*2+2 = 66 changed lines in UAT-v2.0.md (no stray edits)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rebuild check: no shipped-code change landed after 86-01's build commit, so no rebuild is owed"
    verification:
      - kind: other
        ref: "git diff --name-only 616171775dad8cf3b2e0a588babc630f21bdd6ec HEAD -- mazeworld.html src content engine android/app/src -> empty; git status --porcelain -- engine test/parity -> empty"
        status: pass
    human_judgment: false

duration: ~38min
completed: 2026-09-29
status: complete
---

# Phase 86 Plan 05: docs/UAT-v2.2.md Batched Milestone-Close Checklist Summary

**docs/UAT-v2.2.md assembled last from 84/85/83's VERIFICATION human_verification lists plus four COMP-04 additions (re-roll renaming board runs, erase's board-vs-YOUR-DEAD split, Compete-OFF airplane mode, and the explicit never-uploaded check), section 0 built from docs/RELEASING.md's nine-step order; 32 old Play Games rows across UAT-v2.1.md and UAT-v2.0.md marked superseded pointing at it; no rebuild owed.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-09-29T18:35:00Z
- **Completed:** 2026-09-29T19:13:38Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `docs/UAT-v2.2.md` created: header names the debug APK (2.2.0, versionCode 12, 13,798,019 bytes, sha256 `6d8690884110b0e481a31a7389cdb47c148b409d8caa2934a309fb15a08f5e60`, commit `616171775dad8cf3b2e0a588babc630f21bdd6ec`); **section 0** (8 rows) walks `docs/RELEASING.md`'s nine-step release checklist in order (patch notes → release build/upload → rules cutover + probe → transition-file deletion → website deploy → Data safety/description → Play Console cleanup → the Pixel-7 R8 smoke), each row naming who acts and the RELEASING.md step(s) it covers, plus the go-live Season 1 reset note; **section 1** (13 rows) batches every 84-VERIFICATION.md human_verification item (the v3 panel, views, sheets, rows, standing card, empty state, offline states, title routing, FINAL SHEET/BURY THEM, RANK BY persistence, the 2.1.0 history cutoff, avatar continuity); **section 2** (14 rows) batches every 85-VERIFICATION.md item (the ☰ menu order, fresh-install handle with no popup, the ☰ block's RE-ROLL/ERASE mechanics, the title-chip sheet, the Compete-OFF network capture, submission and offline delivery, the 2.1.0-update backfill, "You placed Nth of M." and its deferred rail card, the once-only welcome card, and the Android-Settings absence of Play Games) plus four COMP-04 additions this checklist alone required (2.11-2.14: RE-ROLL HANDLE renaming existing board runs, ERASE MY RUNS leaving LEADERBOARD but keeping YOUR DEAD and reusing the same handle next run, Compete OFF surviving a full run and death in airplane mode with no stall, and the explicit two-death "only the second reaches LEADERBOARD, no card ever proposes sending the first" check per the 2026-09-29 orchestrator correction); **section 3** (3 rows) batches 83-VERIFICATION.md's 83-09 bug-report limit states; **section 4** (4 rows) covers this build's own version stamp, patch notes, first-install notes card and the LEADERBOARD date-line version tag; **section Q** records that 0 quick tasks landed between the 2.1.0 release commit `a897fd9c` and this build.
- `docs/UAT-v2.1.md`: rows 0.3, 15.1, 15.2, 15.3, 15.4 and 15.8 (6 rows) prefixed `**Superseded by 2.2 (Play Games removed): see \`docs/UAT-v2.2.md\` §N.**` and their Result set to `superseded` (0.3 and 15.1-15.4 → §2 for the account/board content, 15.8 → §0 for the console cleanup, now folded into UAT-v2.2 row 0.7). Rows 15.5-15.7 (2.1.0's still-live local panel checks) left untouched.
- `docs/UAT-v2.0.md`: F1 (RELEASE-BLOCKING, superseded regardless per the plan) plus every other row whose check needs Play Games sign-in/out, boards/FRIENDS, console/debug-keystore setup, the welcome/failure cards or score tag, or the profile delete steps — 32 rows total (0.1, 0.8, 0.9, 0.10, B13-B16, D1-D5, E5, F1-F3, G1-G3, H1-H5, J3, K2, K3, L10-L12, L28) — same prefix-and-supersede treatment, routed to §0 (console/store), §1 (the panel/boards) or §2 (sign-in/account/queue/"you placed") by topic. E1, E4 and B17 (already superseded by Phase 70, pointing at L9/L16/L28) were left exactly as they were, per the plan's instruction — even though L28 itself is now also marked superseded, the historical chain stays intact. One sentence appended to the header's "Sign-in and leaderboard rows" paragraph naming the 2.2 supersession.
- Rebuild check: `git diff --name-only 616171775dad8cf3b2e0a588babc630f21bdd6ec HEAD -- mazeworld.html src content engine android/app/src` returned nothing — no shipped code changed since 86-01's debug build, so **no rebuild is owed**; the one debug APK from 86-01 remains the milestone's build under test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/UAT-v2.2.md from the phase verification lists** - `240d3f08` (docs)
2. **Task 2: Mark the old Play Games rows superseded and confirm no rebuild is owed** - `65d6cfef` (docs)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `docs/UAT-v2.2.md` - new: the milestone's one batched Pixel 7 checklist, 42 device-check rows + 8 user-task rows, every Result `open`
- `docs/UAT-v2.1.md` - 6 rows (0.3, 15.1-15.4, 15.8) marked superseded with a docs/UAT-v2.2.md §N pointer
- `docs/UAT-v2.0.md` - F1 + 31 other Play Games rows (32 total) marked superseded; header sentence added

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: no 85 item described a since-reversed "send runs played while Compete was off" card, so nothing was omitted — a positive row was added instead stating the correct (never-uploaded) behavior; docs/RELEASING.md steps 2-3 and 4-5 were each combined into one section-0 row, per the plan's own "or steps N-M for a combined row" allowance; four COMP-04 rows were added to section 2 after confirming, against every 84/85-plan SUMMARY's own Human verification section, that none of those four specific behaviors (re-roll renaming board runs, erase's board-vs-history split, Compete-OFF-in-airplane-mode's full-run/death/no-stall check, and the explicit two-death never-uploaded proof) were already covered by the 10 VERIFICATION items.

## Deviations from Plan

None - plan executed exactly as written. Every acceptance-criteria grep from the plan's Task 1 and Task 2 passed on the first pass; the only mid-task correction was re-deriving one `Edit` `old_string` for UAT-v2.0.md's L11/L12 boundary after an initial exact-match miss (a mechanical tool-call retry, not a plan deviation — no content was affected).

## Issues Encountered

An `Edit` call against docs/UAT-v2.0.md's L11→L12 row boundary failed on the first attempt (exact-string match miss, likely an em-dash/ellipsis rendering artifact between the Read and Edit calls). Re-read the exact current line and re-issued the edit with a shorter, precisely-copied anchor string; it succeeded on the second attempt with no content change beyond the intended prefix/Result edit.

## User Setup Required

None from this plan directly. The whole assembled `docs/UAT-v2.2.md` is a checklist for the user's own future play sessions and console/store/site work — nothing in this plan itself required external configuration.

## Human verification (deferred to end of run)

The entire batched checklist, `docs/UAT-v2.2.md` (42 device-check rows across sections 1-4, section Q, plus 8 user-task rows in section 0), is the user's to walk in their own Pixel 7 sessions and release-time work — this plan wrote and committed it, it did not walk it, per the deferred-UAT protocol and this plan's own `<output>` instruction.

## Next Phase Readiness

- COMP-04 is fully delivered: one batched Pixel 7 checklist, `docs/UAT-v2.2.md`, covers the panel, submission, the handle, erasing your runs and Compete OFF in airplane mode, against the one debug APK built after the last code landed (86-01, confirmed still current by this plan's rebuild check).
- COMP-03's remaining user step (the Play Console Play Games cleanup) is listed in section 0, row 0.7, which also closes UAT-v2.1 row 15.8.
- Phase 86 (Compliance & Device Close) is now fully delivered: 86-01 (build), 86-02 (site pages, pushed not deployed), 86-03 (docs retirement + release checklist), 86-04 (LISTING.md Data safety) and 86-05 (this plan) together satisfy COMP-01 through COMP-04.
- No blockers. The next work on this checklist is entirely the user's: agreeing the patch notes (section 0, row 0.1) is the first gate before any release build.

## Self-Check: PASSED

- FOUND: `docs/UAT-v2.2.md`
- FOUND: `docs/UAT-v2.1.md` (modified, 6 superseded rows confirmed via grep)
- FOUND: `docs/UAT-v2.0.md` (modified, 32 superseded rows + header sentence confirmed via grep)
- FOUND commit `240d3f08` in `git log --oneline`
- FOUND commit `65d6cfef` in `git log --oneline`

---
*Phase: 86-compliance-device-close*
*Completed: 2026-09-29*
