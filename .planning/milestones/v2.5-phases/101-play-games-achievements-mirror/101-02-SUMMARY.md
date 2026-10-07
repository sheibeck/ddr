---
phase: 101-play-games-achievements-mirror
plan: 02
subsystem: play-games-mirror
tags: [play-games, achievements, ledger, idempotent-sync, compete-gate]
requires:
  - phase: 99-engine-facts-lifetime-stats-tracker
    provides: progressFor and the lifetime record
  - phase: 100-in-game-achievements-unlock-toasts-the-list
    provides: the achievement bus the mirror subscribes to (wired in plan 101-03)
provides:
  - "src/browser/playAchievements.js: resource names, one legal op per entry, tolerant ledger, record-minus-ledger diff, the gated single-flight mirror"
affects: [101-03]
tech-stack:
  added: []
  patterns: ["record-derived ledger (diff, not an event queue)", "absolute at-least steps", "gate-first, total, single-flight flush (runQueue.js shape)"]
key-files:
  created:
    - src/browser/playAchievements.js
    - test/unit/play-achievements.test.js
    - test/unit/play-achievements-flush.test.js
  modified: []
key-decisions:
  - "Trailing pass reuses the identity the chain just verified, so three wakes together make one status() even when a trailing pass has work"
  - "A batch whose every answer is config sets a session no-op flag and marks every pending id skipped (resource file absent, PGS-10)"
  - "snapshot() only reads storage while Compete is ON; with Compete OFF and nothing loaded it answers the empty ledger"
requirements-completed: [PGS-07, PGS-08, PGS-09, PGS-10, PGS-11]
duration: about 45 min
completed: 2026-10-05
status: complete
---

# Phase 101 Plan 02: Play mirror core Summary

A pure, never-throwing Play mirror: the record is diffed against a durable ledger (ddr.pgsAch.v1) and sent as idempotent batches of at most 20, with Compete OFF meaning zero seam calls, zero ledger access and no timers.

## Exported surface as built (src/browser/playAchievements.js)

- Constants: `PGS_ACH_KEY` ("ddr.pgsAch.v1"), `BATCH_MAX` (20), `UNLOCK_DELAY_MS` (1500), `PROGRESS_DELAY_MS` (60000).
- Pure: `achievementResourceName(entry)`, `playOpFor(entry)`, `emptyLedger()`, `sanitizeLedger(raw, catalog)`, `pendingOps(record, ledger, catalog, skip)` (frozen ops `{ id, kind, resource, n? }`, ordered reveals, steps, unlocks, each by listOrder then id).
- `createAchievementMirror({ storage, playIdentity, competeOn, online, getRecord, catalog, now, setTimer, clearTimer, log })` returns a frozen `{ kick, wake, flush, cancel, showAchievements, snapshot, waitForPending }`.
- Imports only `content/achievements.js`, `./achievementTracker.js` (progressFor) and `./runQueue.js` (backoffMs). No playIdentity import; the seam is injected. No edits outside the three files.

## Flush result reasons

`flush`/`wake` resolve `{ ok: true, sent, skipped, remaining }` or `{ ok: false, reason }` with reason one of `off`, `notready`, `offline`, `backoff`, `signin`, `network`, `error` (a mid-run failure also carries `sent`). Per-op or call-level `unavailable` and garbage map to `error`; `network` maps to `network`; `signin` is a hold with no backoff. `showAchievements()` answers `{ ok: true }` or `{ ok: false, reason }` with reason `off` or one of the seam's closed set (anything else becomes `error`).

## Tests (targeted, no full suite, no bots)

| File | Tests |
|------|-------|
| test/unit/play-achievements.test.js | 29 pass |
| test/unit/play-achievements-flush.test.js | 54 pass |
| test/unit/achievement-bus.test.js | 13 pass |
| test/unit/runQueue.test.js | 34 pass |
| test/unit/achievements-bot-isolation.test.js | 4 pass |
| test/unit/stale-terms.test.js | 6 pass |

The plan's verify command: 140 tests, 140 pass, 0 fail. Also run as a sanity check: bridge-registry, build-www-vendoring, identity-audit (37 pass).

PGS-11 coverage: all 77 derived resource names exist in `achievements/games-ids.xml`, none missing, none unused, all distinct, all values non-empty and distinct, `app_id` equals `PLAY_GAMES_CONFIG.appId`.

## Task Commits

1. Task 1 (pure core and coverage proof): `2caf3407`. This commit also carried the full `createAchievementMirror` implementation, because the module was written as one file.
2. Task 2 (mirror tests): `c9b9a926` (test file only; no implementation change was needed after the tests ran, apart from two wrong expectations in the tests themselves, fixed before the commit).
3. SUMMARY: committed separately after this file was written.

## Deviations from Plan

None to the rules. One process note: RED-before-GREEN was not split into separate commits; the module and its pure tests landed together in the Task 1 commit and the mirror tests in the Task 2 commit.

## Known Stubs

None.

## Threat Flags

None. The module adds no network, auth or file surface; log lines carry only reason codes and counts (tested against ids, resource names, Play ids and player ids).

## Human verification (deferred to end of run)

Nothing in this plan is device-reachable on its own. The device rows (signed-in Pixel 7 unlock with card and Play popup, airplane-mode round, Compete OFF round, release-build shrinker check, force-stop during a sync) are listed by plan 101-03.

## Self-Check: PASSED

- src/browser/playAchievements.js, test/unit/play-achievements.test.js, test/unit/play-achievements-flush.test.js exist and are committed.
- Commits 2caf3407 and c9b9a926 exist on the worktree branch.
