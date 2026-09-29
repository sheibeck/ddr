---
phase: 85-play-games-out-our-board-in
status: passed
verified: 2026-09-29
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 5/5
human_verification:
  - "☰ opens on the account block, then MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON; MAKE CAMP dimmed in combat and while dead; stairs and a new run still centre the map (85-01)"
  - "Fresh install in airplane mode: title chip and ☰ show a rolled @handle at once (initials avatar on the ☰ with Compete ON); no sign-in prompt or popup at launch (85-04, 85-06)"
  - "☰ block: @handle + avatar, COMPETE ON/OFF, RE-ROLL HANDLE (changes in place, repeatable, menu stays open), ERASE MY RUNS (TAP AGAIN TO ERASE, disarms after ~3 s or menu close; second tap closes the menu and the rail reports; disabled with Compete OFF) (85-04)"
  - "Title chip opens the account sheet with the same rows plus SETTINGS; an erase started on the title reports on the rail once in the dungeon (85-04)"
  - "Compete OFF with a per-app capture (PCAPdroid): a full run and a death make zero requests; turning Compete OFF discards queued runs (85-04)"
  - "Compete ON: a death appears on LEADERBOARD; an offline death appears after reconnecting or reopening; backgrounding right after an offline death still delivers it on the next online launch (85-04)"
  - "Update over a 2.1.0 install with Compete ON at first launch: the 2.1.0 runs since its release appear on LEADERBOARD stamped \"2.1.0 (11)\"; runs played on 2.2 with Compete OFF never appear (85-02, 85-04)"
  - "Online Compete-ON death: \"You placed Nth of M.\" fades in on the death panel within seconds and N matches LEADERBOARD's DEPTH view; an airplane-mode death reports once as a rail card on the map after reconnecting; Compete OFF before the rank arrives shows no rank (85-05)"
  - "The first run that reaches the board raises the welcome card naming the @handle, public deaths and how to turn Compete off; never again, not even after ERASE MY RUNS (85-05)"
  - "Android Settings > Apps shows no Play Games permission or link; no game-service prompt on fresh install or upgrade (85-06)"
---

# Phase 85: Play Games Out, Our Board In — Verification

**Goal:** Play Games is gone from the app and every Compete-ON death reaches our board; the ☰ account block and title chip carry Compete plus your handle.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Plugin, APP_ID meta-data and games-ids.xml gone from the Android build; no Play Games call or sign-in popup | 85-06: `npm uninstall @modbender/capacitor-play-games`, cap sync regenerated gradle includes, APP_ID meta-data + `games-ids.xml` + proguard rule + build-www vendoring removed; `retire-sweep.test.js` checks package.json/lock and android text sources. Device check listed (merged manifest in 86-01) | ✓ |
| 2 | Every Play Games module, test, copy and doc deleted or rewritten; a sweep proves no identifier remains in shipped code | 85-06 deleted 6 modules + 7 test files; `test/unit/retire-sweep.test.js` (src/, content/, mazeworld.html, tools/build-www.mjs, android sources; self-check against vacuous passes). Docs retirement (`PLAY-GAMES-SETUP.md`, its runbook test) is Phase 86-03 by plan | ✓ |
| 3 | Old stored data loads tolerantly and is dropped silently; graveyard and bests untouched | `boardSync.boot` removes `ddr.pgsqueue.v1` (RETIRED_KEYS); `SETTINGS_DEFAULTS` drops `pgsWelcomed`/`pgsDevSignedIn` (85-04); old graveyard/bests keys untouched (84-03 history import reads them only) | ✓ |
| 4 | ☰ block and title chip show the @handle and Compete toggle, ☰ face wears the avatar while competing; no sign-in/Play Games wording | 85-03 account layer (ACCOUNT_COPY, views, controller, two-tap erase) + 85-04 shell wiring + 85-01 ☰ order (CENTRE MAP out, MAKE CAMP first); ACCT-03 wording check in the sweep | ✓ |
| 5 | Every non-dev Compete-ON death queued and submitted; "you placed X" DEPTH rank once acknowledged (next flush offline); erase from the ☰ behind two taps (new identity next run); Compete OFF = zero network + discard queue | `boardSync` (85-02) record/flush/erase (same handle kept)/boot (2.1.0 backfill decided at the first 2.2 launch; Compete OFF then = skipped for good) wired at death/resume/online/boot/pause (85-04); `placementOutcome` + deferred rail card + welcome card (85-05); one `competeIsOn()` gate (85-04) | ✓ |

## Requirements

ACCT-03 ✓ · ACCT-04 ✓ · ACCT-05 ✓ · ACCT-06 ✓ · RETIRE-01 ✓ · RETIRE-02 ✓ · RETIRE-03 ✓

## Execution notes

- Wave 1 (85-01, 85-02, 85-03) ran in parallel git worktrees (user-approved) and merged cleanly into master; full `npm test` on the merge: 8341 pass / 0 fail. 85-04..06 ran sequentially.
- `npm test` at 85-06 close: 8099 pass, 0 fail, 2 skipped (≈250 Play Games tests deleted with their modules).
- Engine gate: `engine/`, `test/parity/` untouched.
- One metadata commit (b4edd185, 85-05) lacks the attribution trailers; left as-is rather than rewrite history.
- Google Play Console Play Games boards/config are intentionally untouched (user, 2026-09-29): removed only after 2.2 reaches testers (Phase 86 release step).
