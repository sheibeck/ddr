---
phase: 68-global-boards-submissions-you-placed-x
plan: 01
subsystem: play-games-leaderboards
status: complete
tags: [pgs, leaderboards, score-tag, encoding, season, pure-module]
requires:
  - engine/records.js RANKED_BOARDS
  - content/classes.js, content/season.js
  - docs/PLAY-GAMES-SETUP.md (67-02)
provides:
  - src/browser/scoreTag.js (TAG_VERSION, TAG_MAX_LENGTH, TAG_RACES, TAG_SUBS, TAG_CAUSES, TAG_FIELD_CAPS, TAG_UNKNOWN, classOfSub, tagName, fitName, encodeTag, decodeTag)
  - src/browser/boardScores.js (SUBMIT_BOARDS, SCORE_ORDER, SCORE_INPUT_CAP, boardScore, boardScores, scoreFallback, isRealLeaderboardId, leaderboardId, knownSeasons, devLeaderboardIds, leaderboardIdsFor, scoreOrdersFor)
  - content/leaderboards.js (LEADERBOARD_IDS, LEADERBOARD_PLACEHOLDER_PREFIX)
affects: [68-04 queue, 68-05 global boards, 68-06 panel, 68-07 dev provider, Phase 69 console runbook]
tech-stack:
  added: []
  patterns: [append-only literal index lists, versioned delimited tag, never-throw decoder, deep-frozen per-season content map]
key-files:
  created:
    - src/browser/scoreTag.js
    - src/browser/boardScores.js
    - content/leaderboards.js
    - test/unit/scoreTag.test.js
    - test/unit/boardScores.test.js
  modified:
    - docs/PLAY-GAMES-SETUP.md
    - test/unit/play-games-runbook.test.js
decisions:
  - "Score tag v1 is delimited plain text with append-only race/sub/cause index lists; the worst-case name budget is 16 (12 fields need 11 dots), correcting the research's 17"
  - "decodeTag also clamps decoded numbers to TAG_FIELD_CAPS, so a forged 6-digit field cannot display past the caps"
  - "LEANEST submits round(1000 x steps / max(floor, 1)) on a smaller-is-better board; equal rates tie regardless of floor (documented single-score limit)"
  - "LEADERBOARD_IDS season 1 ships with PLACEHOLDER_ ids; leaderboardId resolves them to null so native builds skip every board until Phase 69 fills the IDs"
metrics:
  duration: "~25 min"
  completed: 2026-09-24
  tasks: 3
  files: 7
---

# Phase 68 Plan 01: Score Tag, Board Scores and Season ID Map Summary

A deterministic 64-character URL-safe v1 score tag (race/sub/cause indices, seven capped numbers, a fitted name, no epitaph) with a never-throw decoder, the five D-16 per-board score encodings with a raw-score fallback, and a deep-frozen per-season leaderboard ID map whose placeholders resolve to null, guarded by a test that fails if SEASON has no entry.

## What shipped

**Task 1: `src/browser/scoreTag.js`** (TDD: `316559f` RED, `c75ceb5` GREEN)
- `encodeTag(summary)` builds `v1.race.sub.lvl.cause.floor.day.steps.kills.gold.sp.name`. Unknown race/sub/cause take the sentinels 9/99/99. Numbers are truncated and clamped to the caps (level 99, floor 999, day 9,999, steps 99,999, kills 9,999, gold/sp 999,999). The name goes through `tagName` (NFKD, whitespace to `_`, anything outside A-Z a-z 0-9 _ - dropped) and then `fitName` (full name, else `First_L.`, else the first word cut to the budget). The budget is 64 minus the prefix, and the prefix is at most 48, so the budget is never below 16.
- `decodeTag(tag)` returns null for a non-string, an empty tag, one over 64 characters, a character outside the charset, a version other than v1, fewer than 12 fields, or a number field that is not 1 to 6 digits. Otherwise it returns a frozen object with `v: 1`, `cls` from `classOfSub`, and `_` turned back into spaces. Out-of-range indices decode to "". The whole body sits in try/catch.
- Tests (27): the worked example `v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow`, the caps and one past them, junk numbers, the sentinels, the empty summary, a sweep over every name NAMES can produce at both typical values and all caps (1000+ names), the malformed-tag nulls, the list-set cross-checks against RACES, SUB_NOTE, CLASSES and CAUSE_TEXT, and a comment-stripped source pin (no epitaph/note/seed/hash/acts, no Date/Math.random/window/document/network).

**Task 2: `content/leaderboards.js` and `src/browser/boardScores.js`** (TDD: `e30ce47` RED, `c80b46f` GREEN)
- `LEADERBOARD_IDS = { 1: { deep: "PLACEHOLDER_DEEPEST_S1", lean: "PLACEHOLDER_LEANEST_S1", days: "PLACEHOLDER_LONGEST_S1", kills: "PLACEHOLDER_BUTCHERY_S1", purse: "PLACEHOLDER_PURSE_S1" } }` (deep-frozen, pure data).
- The D-16 encodings are exact: deep 6,999,569 for floor 7 / 431 steps; lean 125, 63, 333 and 7000; days 22,007; kills 19,007; purse 4,688. combo, yard and unknown boards return null. Every input is clamped to 0..999,999,999, and every output is a non-negative safe integer.
- `scoreFallback` inverts deep, days, kills and purse exactly (a 50-run LCG round-trip covers this) and gives `{ rate }` for lean.
- The ID helpers: `isRealLeaderboardId`, `leaderboardId` (null for placeholders, LINEAGE/GRAVEYARD, a missing season or a malformed map), `knownSeasons`, `devLeaderboardIds` (`dev_{board}_s{season}`), `leaderboardIdsFor({ native })` and `scoreOrdersFor`.
- Tests (25), including the D-15 guard: `LEADERBOARD_IDS[SEASON]` must exist.

**Task 3: runbook** (`c180a94`)
- `docs/PLAY-GAMES-SETUP.md` gains four sections. Section 7, "Leaderboards (one set of five per season)", has an ordering table (only LEANEST is Smaller is better), the scores in words, a note that the raw score is an ordering key, the LEANEST limit, and tamper protection left on. Section 8 is "Where the IDs go". Section 9, "Starting a new season", covers the D-15 steps and the 70-board / 14-season cap. Section 10, "How the score tag is built (Phase 68)", replaces the old "Engineering notes carried to Phase 68" section and records the 16-character budget correction. Section 6 no longer has the stale "confirm in Phase 68" LEANEST row and now points at sections 7 and 8.
- `test/unit/play-games-runbook.test.js` now also pins content/leaderboards.js, LEADERBOARD_IDS, content/season.js, Smaller is better, Larger is better, PLACEHOLDER, tamper and First L. The old-title guard is unchanged.

## Verification

- `node --test test/unit/scoreTag.test.js test/unit/boardScores.test.js test/determinism/content-is-pure-data.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js test/unit/play-games-runbook.test.js`: all pass.
- `npm test`: 4751 tests, 4744 pass, 7 fail. All 7 are the known CRLF doc-ledger artifacts (the class-pass ledger Outliers/AFTER/Handoff/v1.5 AFTER tests and the flee-ledger Modifier/Before-after tests). None are new.
- The engine is untouched: `git diff --stat 436acdf HEAD -- engine/ test/parity/` is empty.
- No Android build, APK or device step.

## Deviations from Plan

**1. [Rule 2 - Hardening] decodeTag clamps decoded numbers to TAG_FIELD_CAPS**
- **Found during:** Task 1
- **Issue:** The plan only requires 1 to 6 digits per number field. A forged tag could then show a floor of 999,999 on a global row.
- **Fix:** Decoded numbers are clamped to the same caps the encoder uses. Round-trips are unchanged, because encoded values are already capped. This backs up T-68-01.
- **Files:** src/browser/scoreTag.js
- **Commit:** c75ceb5

No other deviations.

## Notes for downstream plans

- `src/browser/playGames.js:46` (owned by 68-02) still says "See docs/PLAY-GAMES-SETUP.md's engineering notes". That content is now section 10, "How the score tag is built (Phase 68)". I did not touch it because it is outside this plan's files. The comment still points at the right document.
- The dev map is rebuilt on each `leaderboardIdsFor({ native: false })` call. The contents are equal every time but the object is new. Compare with deepEqual, or cache the result at the caller.

## Threat Flags

None. No new network, auth or storage surface: both modules are pure and the content file is data only.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md); do not pause for these:

1. In Play Console, create the five season-1 leaderboards (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) with the ordering in docs/PLAY-GAMES-SETUP.md section 7. Only LEANEST is Smaller is better. Leave tamper protection on.
2. Paste the five IDs into content/leaderboards.js `LEADERBOARD_IDS[1]`, replacing the `PLACEHOLDER_` values, then rebuild.
3. After one death on a Play build signed in with a tester account, confirm in the console's score view that the submitted score and its tag appear (a tag like `v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow`), and that the LEANEST score is the rate times 1,000.

## Self-Check: PASSED

- FOUND: src/browser/scoreTag.js, src/browser/boardScores.js, content/leaderboards.js, test/unit/scoreTag.test.js, test/unit/boardScores.test.js, docs/PLAY-GAMES-SETUP.md, test/unit/play-games-runbook.test.js
- FOUND commits: 316559f, c75ceb5, e30ce47, c80b46f, c180a94
