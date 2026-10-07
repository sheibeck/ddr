---
phase: 101-play-games-achievements-mirror
plan: 03
subsystem: shell-wiring, play-games
tags: [play-games, achievements, shell, compete-gate, wake-ups]
requires:
  - phase: 101-01
    provides: the Play seam's syncAchievements and showAchievements and the fake
  - phase: 101-02
    provides: createAchievementMirror
  - phase: 100-in-game-achievements-unlock-toasts-the-list
    provides: achievementEvents fan-out and the banner subscriber
provides:
  - "mazeworld.html: the Phase 101 mirror block (one mirror, bus subscription, visibility and online wake-ups, account hook) and the boot wake"
  - "test/unit/play-achievements-shell.test.js: source anchors, a behaviour harness over the shipped block, docs pin"
  - "docs/SHELL-MODULES.md: Play Games achievements mirror (Phase 101) section"
affects: [101-04]
tech-stack:
  added: []
  patterns: ["comment-stripped block sliced and rebuilt with new Function over the real mirror and bus", "named account subscriber instead of a second literal account.subscribe block"]
key-files:
  created:
    - test/unit/play-achievements-shell.test.js
  modified:
    - mazeworld.html
    - docs/SHELL-MODULES.md
key-decisions:
  - "Death wake is a microtask after each bus payload that checks window.__mzState.get().dead; onRunRecorded untouched (its harness pin)"
  - "Native pause path unchanged: the ledger is rebuilt from the record and every op is idempotent, so a lost ledger write only causes a harmless resend"
  - "Account hook tracks previous compete and signin; off cancels timers; off-to-on or signin turning to in (while on) wakes forced with the account check"
requirements-completed: [PGS-07, PGS-08, PGS-09]
status: complete
completed: 2026-10-05
---

# Phase 101 Plan 03: Wire the Play mirror into the shell Summary

The shell now creates one achievement mirror over its one lazy Play seam and its one Compete gate, feeds it from the achievement fan-out beside the banner, and wakes it from visibility, online, death, Compete ON, sign-in and boot; with Compete OFF every trigger provably reaches nothing, and a Play failure provably cannot reach the banner.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | e4b801ad | import, mirror block, boot wake in mazeworld.html; shell test (anchors + harness) |
| 2 | 2a1688b7 | SHELL-MODULES.md section and its docs pin |

## The block as built (mazeworld.html, module script)

- Import: `import { createAchievementMirror } from "./src/browser/playAchievements.js";` on its own line after the achievementBus import.
- Block right after boardSync's visibilitychange listener: `const achievementMirror = createAchievementMirror({ storage: window.mzStorage, playIdentity: playIdentity(), competeOn: competeIsOn, online: () => navigator.onLine !== false, getRecord: getAchievementRecord })` (a reference; `getAchievementRecord(` count stays 2).
- `function onAchievementMirror(payload)`: `achievementMirror.kick(payload)` plus a queued microtask that calls `achievementMirror.wake()` when the hero is dead, all in try/catch. `achievementEvents.subscribe(onAchievementMirror);` (after the banner, before `await boot(`).
- Triggers: `visibilitychange` (either direction) calls `wake()`; `online` calls `wake({ force: true })`; `onAccountForMirror` (named, `let mirrorCompete`, `let mirrorSignin`): Compete OFF calls `cancel()`; off-to-on or signin turning to "in" while on calls `wake({ force: true, checkPlayer: true })`. `account.subscribe(onAccountForMirror);` is the block's last statement.
- Boot: after `boardSync.boot({ history: getRunHistory() }).catch(() => {});`, `achievementMirror.wake({ checkPlayer: true });` (not awaited).
- New top-level names: `achievementMirror`, `onAchievementMirror`, `onAccountForMirror`, `mirrorCompete`, `mirrorSignin`. No `window.__mz` name added. mazeworld.html diff: 76 insertions, no deletions.

## Pins: no existing test file was edited

boardSync's visibilitychange listener is still the first; its online line, `onSession` and the native pause `waitForPending` line are byte-identical; the first `account.subscribe(() => {` block is untouched (count 1); `setAchievementListener(` count 1; `getAchievementRecord(` count 2; `onRunRecorded` untouched.

## Tests (targeted only; no full suite, no bots, no Gradle)

| File | Tests | Pass |
|------|-------|------|
| test/unit/play-achievements-shell.test.js (new: 9 anchors, 14 harness, 3 docs) | 26 | 26 |
| achievement-banner-shell | 35 | 35 |
| shell-board | 33 | 33 |
| shell-account | 26 | 26 |
| title-music-shell | 13 | 13 |
| achievements-sheet-shell | 22 | 22 |
| achievements-shell-a11y | 18 | 18 |
| shell-no-content-copies | 6 | 6 |
| bridge-registry | 10 | 10 |
| shell-resume-line | 6 | 6 |
| shell-tab-snapshots | 11 | 11 |
| stale-terms | 6 | 6 |
| compliance-docs | 15 | 15 |

`node tools/bridge-doc.mjs --check` exits 0. No shell snapshot fixture moved.

## Deviations from Plan

None. Process note: RED/GREEN were not split into separate commits (test file and wiring landed together in the Task 1 commit). Harness note: the mirror's own wake is observed with a settle tick (setImmediate) after a manual microtask drain, since the mirror's timers and the death microtask are injected and everything else is real promises.

## Known Stubs

None.

## Threat Flags

None. The block adds no network, storage, Capacitor or window.__mz surface (pinned by source test).

## For plan 101-04

- `achievementMirror` is a top-level const in the module script and is in scope for the VIEW IN PLAY GAMES button; call `achievementMirror.showAchievements()` (answers `{ ok: true }` or `{ ok: false, reason }`; reason `off` when Compete is OFF). The shell test already forbids any `.showAchievements(` call that is not `achievementMirror.showAchievements(`, and any `.syncAchievements(` call in the file.
- The shell test file `test/unit/play-achievements-shell.test.js` is yours to extend; its CODE slice helper (`BLOCK`) is bounded by `const achievementMirror = createAchievementMirror({` and `account.subscribe(onAccountForMirror);`, so keep any new statement outside that span.
- `docs/SHELL-MODULES.md` still says "The Play row sits beside the ACHIEVEMENTS row in the ☰ menu" in the Phase 100 list section (pinned by achievements-shell-a11y.test.js "Play row sits beside the ACHIEVEMENTS row"); the plan assigns that correction to 101-04, together with updating the pin.
- `window.mzStorage` and `playIdentity()` were read at block time; the mirror is created before `await boot(`.

## Human verification (deferred to end of run)

Precondition: the Pixel 7 account is on the PGS Testers list (Play Games Services > Setup and management > Testers; documented in docs/ACHIEVEMENTS.md by plan 101-05).

- [ ] Signed in on the Pixel 7 with a PGS tester account and Compete ON: earning a standard achievement shows the in-game card and then Play's own unlock popup with XP.
- [ ] An incremental step and a reveal reach Play.
- [ ] Airplane mode, earn, reconnect: it syncs with no popup storm.
- [ ] Compete OFF, earn: `adb logcat` shows no Games calls from the app.
- [ ] Compete back ON: it syncs.
- [ ] A force-stop in the middle of a sync and a relaunch leaves nothing lost and nothing doubled: the next launch's boot wake resends only what the ledger never acknowledged.

## Self-Check: PASSED

- mazeworld.html, test/unit/play-achievements-shell.test.js and docs/SHELL-MODULES.md exist and are committed; the plan touched only those three files plus this SUMMARY.
- Commits e4b801ad and 2a1688b7 exist on master.
