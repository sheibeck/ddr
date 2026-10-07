---
phase: 101-play-games-achievements-mirror
plan: 06
subsystem: compliance
tags: [privacy, data-safety, play-games, achievements, store-listing]
requires: []
provides:
  - "darktierstudios.com apps and delete-data privacy pages disclosing achievements sent to Google Play Games (committed in darktier-studio, not pushed, not deployed)"
  - "store-listing/LISTING.md Answers for 2.5.0 and the Reconciled for 2.5.0 privacy record"
affects: [release-2.5.0, play-console-data-safety]
key-files:
  created: []
  modified:
    - C:/projects/darktier-studio/src/pages/privacy/apps.astro
    - C:/projects/darktier-studio/src/pages/privacy/delete-data.astro
    - store-listing/LISTING.md
    - test/unit/store-listing.test.js
key-decisions:
  - "No new Data safety data type: achievements ride the existing App activity -> Other actions row"
  - "Effective date for the policy is October 5, 2026 (date of the edit)"
requirements-completed: [COMP-05]
status: complete
---

# Phase 101 Plan 06: Privacy pages and Data safety answers for achievements Summary

The darktierstudios.com privacy pages and LISTING.md's Data safety answers now say that, with Compete on and the player signed in, achievement unlocks, reveals and progress counts go to Google Play Games (including ones earned while Compete was off), that ERASE MY RUNS does not delete them, and that no new Data safety data type is involved.

## Results

- **darktier-studio commit:** `7d4ad754c8860f73042e879917b08b219797521f` on `main`, touching exactly `src/pages/privacy/apps.astro` and `src/pages/privacy/delete-data.astro`. Local only: not pushed, not deployed.
- **Effective date used:** October 5, 2026.
- **Site build:** `npm run build` in darktier-studio passed (17 pages built, including `/privacy/apps` and `/privacy/delete-data`).
- **Mazeworld commit (Task 2):** `717ccc14` (LISTING.md and its test).
- **Tests (targeted):** `node --test test/unit/store-listing.test.js test/unit/compliance-docs.test.js test/unit/stale-terms.test.js`: 42 tests, 42 pass, 0 fail (store-listing.test.js grew from 15 to 22 tests; RED run had 8 failing before the LISTING edits).

## What changed

apps.astro: header comment (describes 2.5), meta description, "Data we collect" closing paragraph, the Google Play Games section (the "sign-in only" claim is gone; it now states the achievement sending, the earned-while-off/signed-out/offline wait, no Google leaderboards or saved games, and that ERASE MY RUNS does not remove Play-side achievements), "Data stored on your device", "One small database", "Permissions", "Children", "Your rights", "Data safety summary", effective date. delete-data.astro: "Google's side" paragraph says ERASE MY RUNS does not delete achievements sent to Google Play Games; they are Google's data.

LISTING.md: Answers for 2.5.0 opening, the Other actions row (achievements named once), the "Unlocked achievements" mapping bullet replacing "sign-in only", every-other-data-type paragraph, Deletion bullet, Why optional, Shared finding, a 2.5.0 console-step bullet (assumption A6), a "2.5.0 adds no package" line, and the Privacy section's "Reconciled for 2.5.0" with the website SHA.

## Website files checked and left unchanged

- `src/data/ddr-compete.ts` and `src/components/CompeteOff.astro` (shared Compete-off wording: "Nothing is sent..." stays true; no achievement claim)
- `src/pages/delve-die-repeat/terms.astro` (leaderboard only)
- `src/pages/delve-die-repeat/index.astro` (line 18: "turn it off and nothing is sent" stays true)

## Declared pin updates

| File | Test | Change | Why |
|------|------|--------|-----|
| test/unit/store-listing.test.js | "Data safety section carries the ... answers" | needle `Answers for 2.3.0` became `Answers for 2.5.0`; title updated | Data safety section is retitled for 2.5.0 (COMP-05) |

New pins (not updates): Other actions row covers achievements (once), "sign-in only" gone and "Unlocked achievements" present, Why optional achievements clause, Deletion sentence once, Shared finding sentence, 2.5.0 console note and no-new-package line, Privacy section one "Reconciled for 2.5.0" plus two website commits including `7d4ad754...`.

## Deviations from Plan

None in substance. Additions beyond the plan's list, for consistency (same disclosure surfaces): the "Children" section of apps.astro said Compete "is the only thing that uses Google Play Games", reworded to include achievements. Test-authoring slip fixed in the same task (a `\b` regex escape mangled by a script; corrected before commit).

## Threat flags

None.

## User steps (non-blocking)

1. Push the darktier-studio commit `7d4ad754` and deploy the site (`npm run deploy` in `C:/projects/darktier-studio`), with the 2.5.0 release. Nothing in this phase waits on it.
2. Play Console > Delve, Die, Repeat > Policy and programs > App content > Data safety: re-read the form against LISTING.md's 2.5.0 answers and resubmit if anything differs; confirm the Other actions row covers achievements (RESEARCH assumption A6).

## Human verification (deferred to end of run)

| Check | Type |
|-------|------|
| After the user's deploy, https://darktierstudios.com/privacy/apps and /privacy/delete-data show the new achievements text and the October 5, 2026 effective date | backstop |
| Play Console Data safety form matches LISTING.md's 2.5.0 answers | backstop (user step) |

## Self-Check: PASSED

- darktier-studio commit 7d4ad754 exists on main, local only, two files, trailers present.
- Mazeworld commit 717ccc14 exists; LISTING.md and store-listing.test.js modified; targeted tests 42/42.
