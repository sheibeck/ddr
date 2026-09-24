---
phase: 68-global-boards-submissions-you-placed-x
plan: 05
subsystem: play-games-leaderboards
status: complete
tags: [pgs, leaderboards, global-boards, friends, cache, consent]
requires:
  - src/browser/scoreTag.js decodeTag (68-01)
  - src/browser/boardScores.js leaderboardId, devLeaderboardIds, scoreOrdersFor (68-01)
  - src/browser/playGames.js loadTopScores / loadPlayerScore / friendsAccess and the fake store (68-02)
provides:
  - src/browser/globalBoards.js (GLOBAL_TTL_MS, GLOBAL_RETRY_MS, TOP_N, LINEAGE_SAMPLE_N, toGlobalEntry, snapshotOf, createGlobalBoards)
  - The GlobalSnapshot / GlobalEntry data contract that 68-06's boardsView consumes
affects: [68-06 panel view, 68-07 dev provider wiring, Phase 69 UAT batch]
tech-stack:
  added: []
  patterns:
    - "synchronous cache read with a background fetch: view() never awaits, onChange asks for a redraw"
    - "a generation counter plus an entry-identity check discards fetches that settle after clear() or after a consent grant"
    - "one shared in-flight promise for the consent request"
key-files:
  created:
    - src/browser/globalBoards.js
    - test/unit/globalBoards.test.js
  modified: []
decisions:
  - "A fetch counts as successful when loadTopScores succeeds. If only loadPlayerScore fails, the rows still show and you is null."
  - "The generation counter lives in each controller's closure, not at module level, so one controller's clear() cannot discard another controller's fetches."
  - "When playerId() is empty, the player score's own playerId marks the matching top entry as you."
  - "Consent snapshots follow the same 5-minute TTL, so after it expires a silent friendsAccess check picks up consent granted outside the app."
  - "A fetch discarded because the player went inactive deletes a 'loading' entry. For a refresh it only clears the in-flight mark, and the cached snapshot stays."
metrics:
  duration: "~30 min"
  completed: 2026-09-24
  tasks: 2
  files: 2
---

# Phase 68 Plan 05: Global Boards Fetch-and-Cache Controller Summary

`createGlobalBoards` is the controller that feeds the panel's ALL, FRIENDS and LINEAGE views. It answers every `view({ board, scope, season })` call synchronously from an in-memory cache. It starts at most one Play Games fetch per (season, board, scope). A result is served for 5 minutes, then refreshed in the background. After a failed fetch it serves the last result marked stale, or an "unreachable" snapshot when there is no cached result, and retries after 30 seconds. Rows are decoded from their score tags. While the player is signed out or Compete is OFF it never calls the provider.

## What shipped

**Task 1: pure builders** (TDD: `12437de` RED, `a5e3681` GREEN)
- Constants: `GLOBAL_TTL_MS = 300000`, `GLOBAL_RETRY_MS = 30000`, `TOP_N = 10`, `LINEAGE_SAMPLE_N = 25`.
- `toGlobalEntry(score, index, { meId, scope })` returns a frozen `{ key, rank, handle, playerId, you, friend, rawScore, run }`:
  - The key is `g:<playerId|anon>:<index>`.
  - `you` is true when playerId equals meId. An empty id never matches.
  - In the friends scope, every row that is not the player's is marked friend.
  - `run` is `decodeTag(tag)`, or null for a malformed tag. The row is still kept.
  - The rank must be an integer of 1 or more, otherwise it is null. rawScore must be finite, otherwise it is 0. A handle that is not a string becomes "". These checks cover T-68-07.
- `snapshotOf({...})` returns a deep-frozen GlobalSnapshot with defaults. `entries` is forced to [] unless the status is "ready". Entries keep the order Play Games returned and are never re-sorted.

**Task 2: `createGlobalBoards({ provider, ids, isActive, playerId, onChange, now })`** (TDD: `4ed0f73` RED, `b928b42` GREEN). It returns a frozen `{ view, requestFriendsAccess, clear }`.
- **Returns null:** while inactive, for GRAVEYARD (`yard`), for the `local` scope, and for any unknown board or scope. None of these touch the provider.
- **"closed":** a missing or placeholder id (resolved with `leaderboardId`) gives a cached "closed" snapshot with zero calls. LINEAGE resolves the DEEPEST id, so a placeholder DEEPEST closes LINEAGE too (D-14).
- **First view:** returns "loading" and starts `loadTopScores({ collection: "public", maxResults: 10 })` plus `loadPlayerScore`. Asking again while the fetch is in flight starts nothing new. When the fetch settles, the controller caches "ready" and calls onChange.
- **Player's own score:** `you` is the player's own score with key `g:you` and `you: true`. The matching top-10 row is also marked you (D-05).
- **TTL:** the same snapshot object is returned for up to 300000 ms. At +300001 the controller returns it and starts exactly one refresh.
- **Failures:** a failed refresh keeps the last ready snapshot with `stale: true`. A failure with no cached result gives "unreachable". The next retry comes only after 30 seconds (D-07).
- **LINEAGE (`combo`):** calls `loadTopScores` on the DEEPEST id with `maxResults: 25`, sets `sampled` to the number of entries read, and loads the player's DEEPEST score as you (D-09).
- **FRIENDS (D-06):**
  - It first calls `friendsAccess({ request: false })`.
  - "required" caches a "consent" snapshot with no score call.
  - "unavailable" is treated as a failure.
  - "granted" fetches the friends top 10 and the player's friends score.
- **requestFriendsAccess():** the only `request: true` in the module. It shares one in-flight promise. "granted" drops the friends snapshots and calls onChange. A decline resolves "required" and leaves the consent snapshot as it was. While inactive it resolves "unavailable".
- **Discarded fetches:** a fetch that settles after `clear()` or after `isActive()` turns false writes nothing and calls no onChange.
- **onChange:** it runs inside try/catch, so a throwing onChange cannot break the controller.

## Verification

- `node --test test/unit/globalBoards.test.js test/unit/playGames.test.js`: 111 pass. globalBoards alone has 42 tests (the plan asks for at least 24), in a 763-line file (the minimum is 220).
- `npm test`: 4832 tests, 4825 pass, 7 fail. The 7 are the known pre-existing CRLF doc-ledger failures (class-pass-ledger 1004/1005/1006/1014, flee-ledger 1769/1770/1771). No new failures.
- Acceptance greps: each of `export function toGlobalEntry`, `export function snapshotOf` and `export function createGlobalBoards` appears once. `provider.loadTopScores(` and `decodeTag(` are present.
- A source-pin test checks the comment-stripped module. It contains no `window.`, `document.`, `localStorage`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `Preferences` or `__mz`, and exactly one `request: true`.
- Only `src/browser/globalBoards.js` and `test/unit/globalBoards.test.js` changed. No edits to engine/, test/parity/, STATE.md, ROADMAP.md or REQUIREMENTS.md.
- No Android build, APK or device step.

## TDD Gate Compliance

Both tasks ran RED then GREEN. `test(68-05)` 12437de comes before `feat(68-05)` a5e3681, and `test(68-05)` 4ed0f73 comes before `feat(68-05)` b928b42. Both RED runs failed on the missing exports. No refactor commit was needed.

## Deviations from Plan

None that change behaviour. Four choices were within the plan's discretion:
- The plan calls for a "module-private generation counter". It is scoped to each controller's closure, so separate controllers (for example in tests) never invalidate each other.
- Success depends on `loadTopScores` alone. If the player-score call fails, the snapshot is still "ready" with `you: null` rather than "unreachable".
- A cache entry is also dropped if it was replaced while its fetch was in flight (for example by a consent grant), not only when the generation changes.
- During GREEN I fixed a test fixture: a seed score of 985 ranked third, not second, so it became 995. Only the test changed.

## Known Stubs

None. Nothing is wired into the panel yet. That is 68-06 (the view) and 68-07 (the wiring), as planned.

## Threat Flags

None. There is no new surface beyond the plan's threat model. Every read goes through the injected provider. Nothing is persisted, and friends consent is requested from one function only.

## Notes for downstream plans

- 68-06: a snapshot's `status` is one of loading, ready, unreachable, consent or closed. A stale snapshot is `status: "ready"` with `stale: true`. `you` can be non-null while the player is also in `entries`. Check `entries.some(e => e.you)` to decide whether to pin the "NOT IN THE TOP TEN" row.
- 68-07: `ids` should be `leaderboardIdsFor({ native })`. For the fake provider's `orders`, cache that map once, because the dev map is rebuilt on each call. Call `clear()` on sign-out or when Compete turns OFF, to drop remote rows from memory.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md, Pixel 7). Do not pause for these:

1. On the Pixel 7, signed in with Compete ON, open the Leaderboards panel on ALL. The global top rows fill within a few seconds, and the local rows stay usable while they load.
2. With airplane mode on, reopen the panel or change the board or scope. A board fetched earlier shows its last result. A board never fetched shows the in-voice "the world is unreachable" note. Nothing blocks.
3. On a fresh account without friends-list consent, switch to FRIENDS. The consent note and its button appear. The Play Games consent screen appears only after the button is tapped. Declining leaves the note in place, with no rail card and no modal.

## Self-Check: PASSED

- FOUND: src/browser/globalBoards.js
- FOUND: test/unit/globalBoards.test.js
- FOUND commits: 12437de, a5e3681, 4ed0f73, b928b42
