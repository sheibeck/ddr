---
phase: 86-compliance-device-close
status: passed
verified: 2026-09-29
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 5/5
human_verification:
  - "Walk docs/UAT-v2.2.md on the Pixel 7 against the 2.2.0 (12) debug APK (sha256 6d869088…5e60): 42 device-check rows across Phases 83-85 and this build (86-05)"
  - "Release-time user tasks in docs/UAT-v2.2.md section 0 / docs/RELEASING.md: agree the DRAFT docs/patch-notes/2.2.0.md; release build with npm run android:release; Play upload (ask first); when 2.2 reaches testers: deploy firebase.json (final rules) + --probe-rules ten PASS (SRV-09 live proof) + delete the transition files; npm run deploy in darktier-studio; Play Console Data safety form; Play Console Play Games cleanup"
---

# Phase 86: Compliance & Device Close — Verification

**Goal:** Every store, policy and website text matches what the game now sends, and the milestone's device checks are batched against one debug APK.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Data safety answers in LISTING.md describe our board's data and no longer mention Play Games | 86-04: own User IDs row (anonymous game ID), Other actions (handle + every run field), bug-report rows, collected-not-shared, Compete-OFF never uploaded; audits refreshed from 86-01's build facts; `store-listing.test.js` re-pinned (9 tests) | ✓ |
| 2 | darktierstudios.com /privacy/apps, /privacy/delete-data and the Terms describe our own leaderboard | 86-02: four pages rewritten ("one small database on Google Firebase…"), built clean, pushed to darktier-studio main (82912a92), **not deployed** (release step, user ruling) | ✓ |
| 3 | PLAY-GAMES-SETUP.md retired for the leaderboard runbook; Play Console cleanup a listed user step | 86-03: 20-line retirement notice; LEADERBOARDS.md §16 cleanup (five Season-1 board IDs), §6 cutover; RELEASING.md ordered 2.2.0 checklist; `compliance-docs.test.js` replaces the old runbook pin | ✓ |
| 4 | One batched Pixel 7 checklist, docs/UAT-v2.2.md, against one debug APK built after the last code | 86-01 built app-debug.apk 2.2.0 (12) from 61617177 (no shipped code changed since — 86-05 checked); 86-05 wrote UAT-v2.2.md (§0 user tasks, §1 Phase 84 ×13, §2 Phase 85 ×14, §3 Phase 83 ×3, §4 build ×4) and superseded 38 old Play Games rows in UAT-v2.1/v2.0 | ✓ |
| 5 | The bug-report rules swap is a listed release step | RELEASING.md 2.2.0 checklist steps + LEADERBOARDS.md §6 + BUG-REPORTS.md pending release-day probe table + UAT-v2.2 §0 | ✓ |

## Requirements

COMP-01 ✓ · COMP-02 ✓ · COMP-03 ✓ · COMP-04 ✓ (SRV-09 stays pending until the release-day probes, by user ruling)

## Execution notes

- 86-02 and 86-03 ran in parallel worktrees alongside 86-01 on master; merged cleanly. Full `npm test` at 86-04: 8068 pass / 0 fail / 2 skipped.
- The version is now 2.2.0 (12); the 2.2.0 release build must use `npm run android:release` (play:release would bump to 13). Patch notes are a DRAFT awaiting the user.
- Engine untouched this milestone, so no milestone-end bot run is needed (bots-only-at-milestone-end rule).
