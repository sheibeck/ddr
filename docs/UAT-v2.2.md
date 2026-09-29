# v2.2 Pixel 7 device round (milestone close)

**Build:** the debug APK 2.2.0 (versionCode 12), `android/app/build/outputs/apk/debug/app-debug.apk`, 13,798,019 bytes, sha256 `6d8690884110b0e481a31a7389cdb47c148b409d8caa2934a309fb15a08f5e60`, built from commit `616171775dad8cf3b2e0a588babc630f21bdd6ec` (86-01, right after Phase 85's last code landed). The Play release build (also versionCode 12) comes only after the user agrees the patch notes (section 0, step 1); until then this debug APK is the one build under test.

**Protocol:** the deferred-UAT protocol. Every device check the v2.2 phases (83-09, 84, 85, 86) deferred is batched here and walked in the user's own play sessions; results are recorded as the user states them (`pass`, `fail: <what you saw>`, `not reached`); failures become todos.

**Install note:** the Play build (2.1.0 from closed testing) and this debug APK have different signers; installing one over the other needs an uninstall, which deletes the current run, the local history, the settings, the @handle and the game ID. `adb install -r` of a debug APK over a debug install keeps them all. This build talks to the LIVE board: runs from the walk land on it stamped "2.2.0 (12)" (ERASE MY RUNS removes them afterwards if wanted). The first Compete-ON launch also sends, once, the runs finished on 2.1.0 since its release.

**Sources:** `.planning/phases/84-leaderboards-panel-v3/84-VERIFICATION.md` (13 `human_verification` items) and its plan SUMMARYs; `.planning/phases/85-play-games-out-our-board-in/85-VERIFICATION.md` (10 items) and its plan SUMMARYs; `.planning/phases/83-leaderboard-server/83-VERIFICATION.md` (3 items, 83-09); `86-01-SUMMARY.md` (the APK identity and build-level audit); `86-03-SUMMARY.md` (the release-checklist step numbers and `docs/LEADERBOARDS.md` section 16); `86-04-SUMMARY.md` (the Play Console Data safety user step); `docs/RELEASING.md`'s "Release 2.2.0: the ordered checklist"; STATE.md's Quick Tasks table (0 quick tasks landed since the 2.1.0 release commit `a897fd9c`).

## 0. User tasks (release, console, store and site) (8)

| # | Step | Result |
|---|------|--------|
| 0.1 | Agree `docs/patch-notes/2.2.0.md` with Claude and delete the paragraph starting `**DRAFT, not yet agreed.**` (docs/RELEASING.md step 1). (user) | passed (agreed by the user 2026-09-29) |
| 0.2 | Release build, versionCode 12 (`npm run android:release`, not `play:release`), then ask before the Play upload to the testing track (docs/RELEASING.md steps 2-3). (user) | passed (built 2026-09-29 from 66c4757e; the user uploaded it to the testing track; tags v2.2.0 and v2.2.0-play12) |
| 0.3 | When 2.2 reaches testers: deploy `firebase.json` (the final rules) and run `send-test-report.mjs --probe-rules` for ten PASS, recorded in `docs/BUG-REPORTS.md` — SRV-09's live proof (docs/RELEASING.md steps 4-5). (Claude, on the user's go) | passed (2026-09-29: final rules deployed after the user confirmed 2.2 is live on the testing track; ten PASS) |
| 0.4 | Delete the three transition files: `firebase/firestore.transition.rules`, `firebase.transition.json`, `test/unit/firestore-transition-rules.test.js` (docs/RELEASING.md step 6). (Claude, on the user's go) | passed (2026-09-29) |
| 0.5 | Deploy the website (`npm run deploy` in darktier-studio) and check `/privacy/apps`, `/privacy/delete-data`, the Terms and `/delve-die-repeat` live (docs/RELEASING.md step 7). (user) | passed (2026-09-29: deployed with the 2.2.0 patch notes; all five pages serve the new text) |
| 0.6 | Enter the Data safety answers and the full description from `store-listing/LISTING.md` in Play Console (docs/RELEASING.md step 8; this also closes UAT-v2.1 row 0.1). (user) | open |
| 0.7 | The Play Console Play Games cleanup, `docs/LEADERBOARDS.md` section 16 (the Season-1 boards and the Play Games configuration; docs/RELEASING.md step 9; this also closes UAT-v2.1 row 15.8). (user) | open |
| 0.8 | Once the Play build reaches the phone, walk docs/RELEASING.md's "First release after R8: Pixel 7 smoke" (docs/RELEASING.md). (user) | open |

At go-live (a later release, not 2.2): the Season 1 reset, `docs/LEADERBOARDS.md` section 10.

## 1. Phase 84: Leaderboards panel v3 (13)

Source: `.planning/phases/84-leaderboards-panel-v3/84-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 1.1 | DEAD tab with Compete ON opens LEADERBOARD ("Everyone's dead. Top ten shown.", SEASON OF THE ALPHA under the title); Compete OFF opens YOUR DEAD with a static INTERRED count (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.2 | YOURS › switches to YOUR DEAD (your run count); EVERYONE › and ◀ return to the board, EVERYONE › shows the board total (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.3 | RANK BY / RACE / SUB-CLASS sheets: CSS ▼ carets and ◆ marks; SUB-CLASS (25 rows) scrolls; YOUR DEAD shows counts and dims zero options (still tappable); LEADERBOARD shows none (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.4 | Rows: rank, initials avatar (LJ for @lanternjaw), handle or hero name, YOU tag, the name · race sub-class · level line, value + unit; leading row in the stat colour; tap opens killer name, epitaph, six chips and the "Died 28 Sep 2026 · 2.1.0 (11)" line; tap again closes (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.5 | Best run outside the top ten pinned under NOT IN THE TOP TEN · YOUR BEST with its real rank; standing card reads "{handle}'s best, of N interred as ..." or "None of yours on this board yet." (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.6 | A filter with no runs shows NOBODY YET + CLEAR FILTERS (the stat stays) (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.7 | Airplane mode: first LEADERBOARD open shows the unreachable note + SEE YOUR DEAD; after a successful look, offline shows cached rows + the stale line; YOUR DEAD opens instantly offline (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.8 | Title: no history + Compete OFF hides VIEW THE DEAD; Compete ON shows it; footer BACK TO TITLE / ROLL A NEW HERO or BACK TO THE DUNGEON; Android back mirrors ◀ (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.9 | A dead hero's DEAD tab still docks FINAL SHEET and BURY THEM (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.10 | RANK BY survives closing and reopening the panel; RACE and SUB-CLASS reset (84-08) | passed (user, Pixel 7, 2026-09-29) |
| 1.11 | First 2.2 launch over a 2.1.0 install: YOUR DEAD holds only runs from 2026-09-28 19:41 UTC on, each reading "2.1.0 (11)"; a new death shows the installed version (84-03) | open — upgrade path only; the Pixel 7 was reinstalled fresh (2026-09-29), check on a Play update over 2.1.0 |
| 1.12 | First death on 2.2 with an empty history shows the first-death line; a deeper later death shows NEW PERSONAL BEST with its board rows (84-03, 84-09) | passed (user, Pixel 7, 2026-09-29) |
| 1.13 | ☰ face and title chip avatars look unchanged after the helper move (84-09) | passed (user, Pixel 7, 2026-09-29) |

## 2. Phase 85: Play Games out, our board in (14)

Source: `.planning/phases/85-play-games-out-our-board-in/85-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 2.1 | ☰ opens on the account block, then MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON; MAKE CAMP dimmed in combat and while dead; stairs and a new run still centre the map (85-01) | passed (user, Pixel 7, 2026-09-29) |
| 2.2 | Fresh install in airplane mode: title chip and ☰ show a rolled @handle at once (initials avatar on the ☰ with Compete ON); no sign-in prompt or popup at launch (85-04, 85-06) | passed (user, Pixel 7, 2026-09-29) |
| 2.3 | ☰ block: @handle + avatar, COMPETE ON/OFF, RE-ROLL HANDLE (changes in place, repeatable, menu stays open), ERASE MY RUNS (TAP AGAIN TO ERASE, disarms after ~3 s or menu close; second tap closes the menu and the rail reports; disabled with Compete OFF) (85-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.4 | Title chip opens the account sheet with the same rows plus SETTINGS; an erase started on the title reports on the rail once in the dungeon (85-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.5 | Compete OFF with a per-app capture (PCAPdroid or similar, package com.darktierstudios.delvedierepeat): a full run and a death make zero requests; turning Compete OFF discards queued runs (85-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.6 | Compete ON: a death appears on LEADERBOARD; an offline death appears after reconnecting or reopening; backgrounding right after an offline death still delivers it on the next online launch (85-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.7 | Update over a 2.1.0 install with Compete ON at first launch: the 2.1.0 runs since its release appear on LEADERBOARD stamped "2.1.0 (11)"; runs played on 2.2 with Compete OFF never appear (85-02, 85-04) | open — upgrade path only; the Pixel 7 was reinstalled fresh (2026-09-29), check on a Play update over 2.1.0 |
| 2.8 | Online Compete-ON death: "You placed Nth of M." fades in on the death panel within seconds and N matches LEADERBOARD's DEPTH view; an airplane-mode death reports once as a rail card on the map after reconnecting; Compete OFF before the rank arrives shows no rank (85-05) | passed (user, Pixel 7, 2026-09-29) |
| 2.9 | The first run that reaches the board raises the welcome card naming the @handle, public deaths and how to turn Compete off; never again, not even after ERASE MY RUNS (85-05) | passed (user, Pixel 7, 2026-09-29) |
| 2.10 | Android Settings > Apps shows no Play Games permission or link; no game-service prompt on fresh install or upgrade (85-06) | passed (user, Pixel 7, 2026-09-29) |
| 2.11 | RE-ROLL HANDLE renames your runs on the board: re-roll, then open LEADERBOARD — your earlier runs now show the new handle, not the old one (COMP-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.12 | ERASE MY RUNS, two taps: your runs leave LEADERBOARD at once; YOUR DEAD still keeps them; the next Compete-ON death posts under the same handle (COMP-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.13 | Compete OFF in airplane mode: cold boot, walk a full run, take a death, and YOUR DEAD opens with no stall and no error (COMP-04) | passed (user, Pixel 7, 2026-09-29) |
| 2.14 | Runs played with Compete OFF are never uploaded: Compete OFF, die, turn Compete ON, die again — only the second run reaches LEADERBOARD, and no card ever proposes sending the first one (COMP-04, orchestrator correction 2026-09-29) | passed (user, Pixel 7, 2026-09-29) |

## 3. Phase 83: bug-report limits (83-09) (3)

Source: `.planning/phases/83-leaderboard-server/83-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 3.1 | REPORT A BUG: send twice quickly — the cooldown failed state reads naturally with the real wait filled in (83-09) | passed (user, Pixel 7, 2026-09-29) |
| 3.2 | REPORT A BUG: five sends in one day — the daily-cap failed state reads naturally with {cap}/{wait} filled in (83-09) | passed (user, Pixel 7, 2026-09-29) |
| 3.3 | REPORT A BUG with Compete OFF — the identity is created silently on tap and the send succeeds (83-09) | passed (user, Pixel 7, 2026-09-29) |

## 4. Phase 86: this build (4)

| # | Check | Result |
|---|-------|--------|
| 4.1 | Settings' version line reads "2.2.0 (12)" | passed (user, Pixel 7, 2026-09-29) |
| 4.2 | ☰ → PATCH NOTES shows the 2.2.0 notes with the DRAFT line (the release build drops it) | passed (user, Pixel 7, 2026-09-29) |
| 4.3 | Installing this APK over the 2.1.0 debug build opens the 2.2.0 notes once over the title | open — upgrade path only; the Pixel 7 was reinstalled fresh (2026-09-29), check on a Play update over 2.1.0 |
| 4.4 | A Compete-ON death on this build appears on LEADERBOARD and its expanded row's date line ends "2.2.0 (12)" | passed (user, Pixel 7, 2026-09-29) |

## Q. Quick tasks since 2.1.0 (0)

No quick tasks landed between 2.1.0 and this build.
