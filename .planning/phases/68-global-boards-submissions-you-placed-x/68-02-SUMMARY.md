---
phase: 68-global-boards-submissions-you-placed-x
plan: 02
subsystem: play-games-provider
status: complete
tags: [play-games, leaderboards, provider-seam, fake, timeouts]
requires:
  - 67-02 provider seam (src/browser/playGames.js)
  - "@modbender/capacitor-play-games 0.5.0 (installed by 67-06; read-only)"
provides:
  - PROVIDER_METHODS (nine)
  - PLUGIN_METHODS_USED (the telemetry-free plugin allow-list)
  - normalizeScore(s)
  - createPlayGames leaderboard methods (submitScore, loadTopScores, loadPlayerScore, loadStanding, friendsAccess)
  - createFakePlayGames leaderboard store (boards, orders, online, friendsConsent, submissions(), setOnline())
affects:
  - 68-04 (queue flush submits through submitScore)
  - 68-05 (global ALL/FRIENDS/LINEAGE reads, friends consent)
  - 68-06/68-07 (DEEPEST rank line via loadStanding; browser dev loop on the fake)
  - docs/SHELL-MODULES.md still names the retired reserved list (68-07 updates it)
tech-stack:
  added: []
  patterns:
    - "timed(call, failure): ready() + plugin call raced against an injected setTimer; failure shape on reject/throw/timeout"
    - "validate before touching the plugin; frozen result objects; shared FAILED constant"
key-files:
  created: []
  modified:
    - src/browser/playGames.js
    - test/unit/playGames.test.js
decisions:
  - "friendsAccess reads a loadFriends result as granted (resolutionRequired false), required (true) or unavailable (rejection/garbage); only request === true sends resolve: true, and that request is untimed"
  - "The call timer covers ready() as well as the plugin call, so a hung initialize() also times out"
  - "submitScore requires tag to be a string (empty allowed); a missing tag is invalid input"
  - "The fake gates every leaderboard call on signed-in AND online; signed out resolves { ok: false } / unavailable, matching the plugin's reject-when-signed-out behaviour"
  - "The fake's friends collection ranks friends plus the player among themselves; seeded entries without a valid score are dropped"
metrics:
  duration: ~35 min
  completed: 2026-09-24
  tasks: 2
  files: 2
---

# Phase 68 Plan 02: Play Games leaderboard provider methods Summary

This plan puts the five Phase 68 leaderboard calls behind the Phase 67 provider seam, in both the native provider and the in-memory fake. `submitScore` validates its input, sends `scoreTag` and reports the all-time `newBest`. `loadTopScores` and `loadPlayerScore` read the all-time window of the public or friends collection, with `maxResults` clamped to 1..25. `loadStanding` reloads the board and reads the DEEPEST rank and score count. `friendsAccess` checks friends consent silently and shows the consent screen only on `request: true`. Every method resolves and none rejects. Every call except the consent request is raced against an injected 15-second timer. Every score is normalized to `{ rank, rawScore, tag, handle, playerId, friend }`, with no image URL.

## What shipped

- **`PROVIDER_METHODS`** now lists nine methods: init, isAuthenticated, signIn, getPlayer, submitScore, loadTopScores, loadPlayerScore, loadStanding and friendsAccess.
- **`PLUGIN_METHODS_USED`** lists the only nine plugin methods ever called: initialize, signIn, isSignedIn, getPlayer, submitScore, loadTopScores, loadCurrentPlayerScore, loadLeaderboard and loadFriends. It replaces the retired Phase 67 reserved list. That export and its test are gone, and nothing in `src/` or `test/` names it any more.
- **`normalizeScore(s)`** returns a frozen object with six keys. A missing or non-integer rank becomes null. The handle falls back from `scoreHolderDisplayName` to `scoreHolder.displayName` and then to `""`. `friend` is `friendStatus === "friend"`.
- **The native provider** is `createPlayGames({ loadPlugin, callTimeoutMs = 15000, setTimer, clearTimer })`. A private `timed()` runs `ready()` and then the plugin call. If the call settles first, the timer is cleared. On a rejection, a throw or the timeout it resolves the failure shape, and a late settlement is ignored. Plugin results are always mapped to frozen plain objects, never the proxy, so the thenable trap cannot fire.
- **The fake provider** is `createFakePlayGames({ ..., boards, orders, online, friendsConsent })`. It keeps a best-score-per-player store: larger-is-better by default, or `"smallerIsBetter"` per id, with ties kept in insertion order. It serves public and friends collections, and its consent modes are granted, required (a request with interactive accept grants it) and decline. It also has an online switch (`setOnline`), a `submissions()` log and `calls()` for every method.

## Tasks and commits

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Native provider leaderboard methods, normalization, validation, call timeout | 60f5caa (test, RED), 166187f (feat, GREEN) |
| 2 | Fake provider in-memory leaderboard store | 25f4518 (test, RED, 15 failing), 642a2a7 (feat, GREEN) |

## Verification

- `node --test test/unit/playGames.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js`: all pass (playGames alone: 69 tests).
- `npm test`: 4730 tests, 4723 pass, 7 fail. The 7 failures are the known pre-existing CRLF doc-ledger failures (class-pass-ledger 979/980/981/989 and flee-ledger 1744/1745/1746). No new failures.
- Acceptance greps:
  - `PLUGIN_METHODS_USED` appears 2 times in `src/browser/playGames.js`.
  - `export function normalizeScore` appears 1 time.
  - `RESERVED_LEADERBOARD_METHODS` appears in no file under `src/` or `test/`.
  - `src/browser/playGames.js` is still the only file in `src/` that names the plugin package, and it names it exactly once in code.
- Source pins: no network identifier, no `window.`/`document.`/`__mz` reference, and the string "Url" never appears in the comment-stripped code. Every `PlayGames.x(` call site is in `PLUGIN_METHODS_USED`, and every name in that list has a call site.
- The test file has 1183 lines (the plan's minimum is 300).
- No edits to `engine/`, `test/parity/`, STATE.md, ROADMAP.md or REQUIREMENTS.md.

## TDD Gate Compliance

Both tasks followed RED then GREEN. Each `test(68-02)` commit comes before its `feat(68-02)` commit. Task 1's tests were written against the new contract and committed before the implementation. Task 2's RED run showed 15 failing tests before the fake was extended. No refactor commit was needed.

## Deviations from Plan

None. The plan was executed as written. Three choices fell within the plan's discretion:

- The call timer also covers `ready()`, so a hung `initialize()` times out too.
- A non-string or missing tag counts as invalid input.
- The fake treats signed out the same as offline for reads: `{ ok: false }`, or `"unavailable"` from friendsAccess.

## Flagged assumptions (carried from the plan, still unverified on device)

- `loadStanding` reads `loadLeaderboard({ forceReload: true })` right after the submit resolves. If the reloaded variant lags behind, the rank line shows the previous rank. It never shows an error.
- `maxResults` is clamped to 25 because the plugin binds no paging. LINEAGE's global sample is therefore the top 25 DEEPEST scores.
- Before consent is granted, `loadTopScores` on the friends collection might reject or might resolve empty. 68-05 checks `friendsAccess` first, so either behaviour is handled.
- The native `loadFriends` code (`PlayersModule.kt`) confirms that a refused consent resolves `resolutionRequired: true`. So `friendsAccess({ request: true })` resolves `"required"` on a refusal, as the plan specifies.

## Known Stubs

None.

## Threat Flags

None. No new surface beyond the plan: every leaderboard call goes through the existing plugin allow-list, and no image URL leaves the module.

## Human verification (deferred to end of run)

These are for the Phase 69 batch (`docs/UAT-v2.0.md`, Pixel 7). Do not pause for them.

1. A score submitted from a Compete-ON death appears on the Play Games leaderboard (Play Games app or the native board UI), and its score tag is attached. For example, the tag is visible through the dev loop or through `loadTopScores` returning it.
2. The friends-list consent screen appears only after the in-panel consent button is tapped. Opening the panel, changing boards or scopes, and background fetches never show it.
3. (Optional) After a submit, the DEEPEST rank line reflects the new score and not the previous one. This covers the forceReload lag assumption above.

## Self-Check: PASSED

- FOUND: src/browser/playGames.js
- FOUND: test/unit/playGames.test.js
- FOUND: 60f5caa, 166187f, 25f4518, 642a2a7
