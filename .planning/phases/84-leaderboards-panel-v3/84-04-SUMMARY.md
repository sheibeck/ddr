---
phase: 84-leaderboards-panel-v3
plan: 04
subsystem: infra
tags: [firestore, leaderboard-client, board-feed, caching, own-runs]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-01: src/browser/runDoc.js's rankKeyOf(stat, run)/BOARD_STATS and the note/when run-doc contract this plan's fixtures build against"
  - phase: 83-leaderboard-server
    provides: "83-04: src/browser/boardClient.js's createBoardClient (topTen/total/rankOf, 5-minute cache, stale fallback), src/browser/fakeBoardServer.js's createFakeBoardFetch, src/browser/firebaseAuth.js's identity.snapshot()"
provides:
  - "boardClient.ownRuns(uid) and OWN_RUNS_MAX_PAGES = 10 — a paged, cached, public (no Authorization header) read of one player's own board runs, reusing the same gate/cache/single-flight/stale-fallback machinery as topTen/total/rankOf"
  - "src/browser/boardFeed.js — createBoardFeed({client, identity, now, ttlMs, season}) -> {load, cached, clear}, the LEADERBOARD view's single async data source: one frozen BoardSnapshot per {stat, race, sub} query (rows, unfiltered total, filtered total, your best run with its real rank, and honest loading/stale/unreachable/off states)"
affects: [84-05, 84-06, 84-07, 84-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "boardFeed.js fires topTen/total(/filteredTotal)/ownRuns together (Promise.all over safeCall-wrapped client calls) so a throwing client can never reject load(); rankOf is only awaited afterward, and only when your best sits outside the top ten"
    - "'Your best' is picked entirely client-side from ownRuns(uid)'s own-runs read, filtered locally by season/race/sub and ranked by runDoc.js#rankKeyOf, with a when-then-id tie rule — the server is asked for a rank (rankOf) only once the local candidate is already chosen, never to help choose it"

key-files:
  created:
    - src/browser/boardFeed.js
    - test/unit/boardFeed.test.js
  modified:
    - src/browser/boardClient.js
    - test/unit/boardClient.test.js

key-decisions:
  - "The unfiltered EVERYONE total() and the filtered standing-card total() both always pass stat 'deep' to client.total(), never the RANK BY stat in scope — total() is stat-independent (it only counts docs matching season/race/sub), so every RANK BY switch reuses the same cached count instead of paying for a fresh read per stat, matching CONTEXT's 'one total() read, cached' rule"
  - "ownRuns(uid) is public and unauthenticated (no bearer token) — own-runs are the player's own board rows, which are already public board data by design (Compete ON consent); this mirrors T-84-06's disposition in the plan's threat register (accept, low severity)"
  - "boardFeed never itself calls rankOf to search for the best run — it always determines the local candidate first from ownRuns' rows via rankKeyOf, then asks rankOf exactly once for that single candidate's rank, keeping the count-read budget at topTen + total + (filteredTotal) + (rankOf), never per-candidate"

requirements-completed: []  # BOARD-19, BOARD-23, BOARD-25 are in this plan's frontmatter `requirements` field but NONE are marked complete in REQUIREMENTS.md — per the phase source-audit table in 84-01-PLAN.md, this plan is not the last deliverer for any of the three (BOARD-19 needs 84-08, BOARD-23 needs 84-05, BOARD-25 needs 84-08). See "Requirement Coverage" below.

coverage:
  - id: D1
    description: "boardClient.ownRuns(uid) reads one player's runs from the board through ownRunsQuery pages of 50 (at most OWN_RUNS_MAX_PAGES = 10 pages / 500 rows), public and unauthenticated, cached for 5 minutes with the same stale fallback and single-flight joining as topTen/total/rankOf, and makes zero calls with Compete OFF or an invalid uid"
    requirement: "BOARD-19"
    verification:
      - kind: unit
        ref: "test/unit/boardClient.test.js — ownRuns section (14 tests): exact-runs read, 3-page (50/50/20) paging, OWN_RUNS_MAX_PAGES capping at 500 rows, request bodies equal ownRunsQuery paging, no Authorization header, API key on every URL, 5-minute cache expiry, concurrent-call single-flight, clear() refetch, stale fallback with a cached copy, offline with no cache, Compete OFF / invalid uid / unavailable zero-call gates"
        status: pass
    human_judgment: false
  - id: D2
    description: "boardFeed.load({stat, race, sub}) resolves one frozen BoardSnapshot: the top ten in server order, the unfiltered current-season total, the filtered total, and your best run under that stat and those filters with its real rank (listed index+1, or rankOf's rank when outside the top ten)"
    requirement: "BOARD-23"
    verification:
      - kind: unit
        ref: "test/unit/boardFeed.test.js (18 tests): the core your-best flow (not listed, real rankOf-derived rank), listed-in-top-ten (no rankOf call), race/sub filtering (filteredTotal restricted, total unfiltered, other-race owned runs excluded), season exclusion, the when-then-id tie rule, identity edge cases (null identity, uid null, snapshot() throws — all youKnown true, zero ownRuns calls), ownRuns failing with no cache (youKnown false), cached()/clear(), an older-shape doc passthrough, purity"
        status: pass
    human_judgment: false
  - id: D3
    description: "boardFeed degrades honestly: no cache -> unreachable; a failed refresh over a cached copy -> ready+stale with the cached fetchedAt; Compete OFF -> off with zero network calls; load never rejects, even when the client's own methods throw synchronously"
    requirement: "BOARD-25"
    verification:
      - kind: unit
        ref: "test/unit/boardFeed.test.js — offline-before-any-load (status unreachable, reason offline, rows []), offline-after-ready-load-with-expired-cache (status ready, stale true, fetchedAt equal to the earlier load's), Compete OFF (status off, zero calls) plus a synchronously-throwing stub client asserted with assert.doesNotReject"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 04: Board Read Client's ownRuns and the LEADERBOARD BoardSnapshot Feed Summary

**boardClient.ownRuns(uid) (paged/cached/public own-runs read) plus boardFeed.js's createBoardFeed, turning topTen/total/ownRuns/rankOf into one frozen BoardSnapshot per query with your real-rank best and honest loading/stale/unreachable/off states**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-29T09:24:15-04:00 (prior plan's close)
- **Completed:** 2026-09-29T09:49:25-04:00
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `src/browser/boardClient.js#ownRuns(uid)`: a paged (LIST_LIMIT_MAX=50 per page, `OWN_RUNS_MAX_PAGES=10` cap = 500 rows), cached (5-minute TTL, stale fallback, single-flight), public (no Authorization header) read of one player's own board runs, reusing `runRead`'s exact cache/in-flight/stale-fallback pipeline the other reads use. Gate order: `competeOn` → config/fetchFn → uid validation (string, 1..128 chars) → cache → in-flight → network.
- `src/browser/boardFeed.js`: `createBoardFeed({client, identity, now, ttlMs, season})` → frozen `{load, cached, clear}`. `load({stat, race, sub})` fires `topTen`/unfiltered `total("deep")`/`ownRuns(uid)` together (each wrapped so a throwing client method can never reject `load()`), picks "your best" locally from your own runs (filtered by season/race/sub, ranked by `runDoc.js#rankKeyOf` with a when-then-id tie rule), and asks `rankOf` exactly once — only when the local best sits outside the top ten. Assembles one frozen `BoardSnapshot`: `status`/`reason`/`stale`/`fetchedAt` (oldest of every read that fed it)/`rows`/`total`/`filteredTotal`/`you`/`youKnown`/`uid`.
- The feed reads the player's uid only through `identity().snapshot()` — never creates an identity, and makes zero `ownRuns` calls when no uid is available (null identity, a snapshot with `uid: null`, or a throwing `snapshot()` — all resolve `you: null, youKnown: true, uid: null`).
- `cached(query)` answers synchronously: the last ready, non-stale snapshot for the exact `{stat, race, sub}` query within `ttlMs`, else `null` — the panel can skip its loading note on a repeat view.
- `npm test`: 8404 pass, 0 fail, 2 skipped (pre-existing), exit 0. `git status --porcelain -- engine test/parity content` empty.

## Task Commits

Each task was committed atomically (TDD RED confirmed for both tasks before implementation):

1. **Task 1: boardClient.ownRuns(uid) — paged, cached, public own-runs read** - `e95417a2` (feat)
2. **Task 2: src/browser/boardFeed.js — one snapshot per query for the LEADERBOARD view** - `90a67e07` (feat)

_TDD RED was confirmed for both tasks by running the new/extended test files before implementation existed (`OWN_RUNS_MAX_PAGES` import failure for Task 1; `ERR_MODULE_NOT_FOUND` on `src/browser/boardFeed.js` for Task 2), then GREEN implementation landed in the same commit as its already-written test, matching this plan set's established precedent (84-01/84-02/84-03)._

## Files Created/Modified

- `src/browser/boardClient.js` - `OWN_RUNS_MAX_PAGES` export, `ownRuns(uid)`, added to the frozen return object; header comment updated
- `test/unit/boardClient.test.js` - 14 new `ownRuns` tests (exact-runs, paging, cap, request bodies/headers, cache/expiry/single-flight/clear, stale fallback, offline, off/invalid/unavailable gates)
- `src/browser/boardFeed.js` - new: `createBoardFeed` (`load`/`cached`/`clear`), `bestOwnedRun`/`pickBetter`/`whenOf` tie-break helpers
- `test/unit/boardFeed.test.js` - new: 18 tests covering the core your-best flow, filters, season exclusion, ties, identity edge cases, offline/stale/off, `cached()`/`clear()`, an older-shape doc passthrough, purity

## Decisions Made

- Both `total()` reads (unfiltered and, when a filter is set, filtered) always pass stat `"deep"` to `client.total(...)`, never the in-scope RANK BY stat — `total()`'s count is stat-independent, so this keeps every RANK BY switch sharing one cached count per CONTEXT's "one total() read, cached" rule
- `ownRuns(uid)` carries no Authorization header — own-runs are public board data by design (Compete ON consent), matching the threat register's T-84-06 disposition (accept, low severity, the uid is an anonymous identity never linked to a person)
- `boardFeed` never calls `rankOf` to search for the best run — the local candidate is always chosen first from `ownRuns`' own-runs rows via `rankKeyOf`, then `rankOf` is asked exactly once for that one candidate, keeping the count-read budget fixed regardless of how many runs a player owns

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria (test exits, grep pins, `npm test`, engine/parity untouched) passed after fixing test-fixture-only constraint violations discovered while writing `test/unit/boardFeed.test.js` (see below — these are corrections to this plan's own new test file, not production code, and not outside `files_modified`).

### Test-fixture corrections (within this plan's own new test file)

While authoring `test/unit/boardFeed.test.js`'s RED tests, several hand-built fixtures violated `runDoc.js#validateRunDoc`'s existing bounds (`kills <= steps`, `floor <= FLOOR_MAX=200`, and `season === SEASON` for anything built through `buildRunDoc`) — these are correctly-enforced constraints from Phase 83/84-01, not bugs in this plan's production code. Fixed by adjusting the test fixtures' `steps`/`floor` values to satisfy the bounds, and by seeding the "another season" fixture as a raw `{id, doc}` pair (bypassing `buildRunDoc`'s validation, matching the file's own established "older-shape doc" seeding pattern) since `buildRunDoc` cannot itself construct a doc for a season other than the current one. No production code was touched by these corrections.

## Issues Encountered

None beyond the test-fixture corrections above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

None for this plan on its own — it ships no UI surface (pure client/data modules with unit tests only). The panel's device checks are listed in 84-08's SUMMARY, per this plan's own `<output>` instruction.

## Requirement Coverage

This plan's frontmatter lists `requirements: [BOARD-19, BOARD-23, BOARD-25]`, but none are marked complete in `REQUIREMENTS.md`. Per the phase source-audit table in `84-01-PLAN.md`:
- BOARD-19 also needs 84-05, 84-07, **84-08** (last deliverer)
- BOARD-23 also needs **84-05** (last deliverer)
- BOARD-25 also needs 84-02, 84-05, 84-07, **84-08** (last deliverer)

This plan delivers the full data layer those UI plans need (the own-runs read, the BoardSnapshot's rank/total/state machinery) — partial coverage, correctly left `[ ]` pending until their respective last-deliverer plans land.

## Next Phase Readiness

- `boardClient.ownRuns(uid)` and `boardFeed.js`'s full `{load, cached, clear}` API are ready for 84-05's pure LEADERBOARD view model to consume directly — one `load()` call per query, one synchronous `cached()` check per repeat view.
- No blockers for 84-05 through 84-09.

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created files verified present on disk (`src/browser/boardFeed.js`, `test/unit/boardFeed.test.js`); both task commits (`e95417a2`, `90a67e07`) verified present in `git log`.
