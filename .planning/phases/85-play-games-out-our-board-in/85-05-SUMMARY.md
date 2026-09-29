---
phase: 85-play-games-out-our-board-in
plan: 05
subsystem: ui
tags: [placement, death-screen, board-sync, rail-card, welcome-card, tdd]

# Dependency graph
requires:
  - phase: 85-play-games-out-our-board-in
    provides: "85-04's shell scaffolding: liveDeathHash, window.__mzPlacement, parkPlacementCard/pendingPlacementCard (already renamed off the retired Play Games names), and createBoardSync's onPlacement/onAcked/liveHash seams left unwired for this plan"
  - phase: 85-play-games-out-our-board-in
    provides: "85-02's boardSync.js placement report shape ({ live, rest }) via rankOf(\"deep\", deepKey)/total(\"deep\") once a flush acknowledges a run, plus the boardAcked() welcome-card trigger boardSync's onAcked calls"
provides:
  - "content/placement.js and src/browser/placement.js rewritten for our own board: no standing band, no season-drop line, PLACEMENT_CARD names DEPTH instead of the retired DEEPEST leaderboard"
  - "placementOutcome({live, rest, liveHash, panelUp}) — the one pure rule that turns a boardSync placement report into either the death panel's fading rank line or one deferred rail card, never both for the same run"
  - "mazeworld.html's handlePlacement wired to createBoardSync's onPlacement/liveHash/onAcked options; the death panel's rank line, the deferred rail card and the first-run welcome card (via account.boardAcked()) all now run end to end"
affects: ["85-06 (RETIRE-02 sweep deletes the retired Play Games modules; this plan's shell already imports none of them)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "placementOutcome as the single pure rule deciding line-vs-card, so the shell's handlePlacement is a thin dispatcher (try/catch, DOM writes) with zero decision logic of its own"

key-files:
  created: []
  modified:
    - content/placement.js
    - src/browser/placement.js
    - test/unit/placement.test.js
    - test/unit/placement-copy.test.js
    - tools/lib/voice-corpus.mjs
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
    - mazeworld.html
    - src/browser/bridge.js
    - test/unit/shell-board.test.js
    - test/unit/shell-account.test.js

key-decisions:
  - "placementOutcome's merge rule for a live run that misses the panel: count = rest's count + 1, and the reported rank/total/hash is whichever of live/rest is the SMALLER (better) rank — matches the plan's behavior spec literally (\"best = the smaller rank among live and rest\")"
  - "handlePlacement is wrapped in its own try/catch even though placementOutcome itself never throws, per the plan's explicit defense-in-depth instruction (\"a bad report never breaks the queue\") — covers a future DOM failure in renderRankLine/parkPlacementCard, not just a bad report shape"
  - "PLACEMENT_CARD's one/many lines name the board \"DEPTH\" (the LEADERBOARD panel's own stat label from 84-05) rather than keeping \"DEEPEST\" (the retired Play Games leaderboard's title) — required by the plan's own acceptance grep (DEEP[E]ST must be absent from both placement files)"

patterns-established: []

requirements-completed: [ACCT-04]

coverage:
  - id: D1
    description: "content/placement.js and src/browser/placement.js rewritten for per-run DEPTH ranks: PLACEMENT_LINES loses the \"standing\" band, PLACEMENT_CARD loses oneStanding/manyStanding and names DEPTH instead of the retired DEEPEST board, SEASON_DROP_LINES is deleted entirely (no season-drop path in the new durable queue)"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "test/unit/placement.test.js, test/unit/placement-copy.test.js — 94/94 pass across the full voice/content suite run"
        status: pass
    human_judgment: false
  - id: D2
    description: "placementOutcome({live, rest, liveHash, panelUp}) — the one rule deciding the death panel's fading rank line vs. one deferred rail card from a boardSync placement report; frozen results, never throws on garbage"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "test/unit/placement.test.js (placementOutcome test block: matching live+panel-up draws the line and rest still parks its own card; panel-gone folds into one card with count+1 and the better rank; a mismatched live hash parks instead of drawing; garbage never throws)"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html's handlePlacement wires boardSync's onPlacement/liveHash/onAcked options end to end: the death panel's rank line via renderRankLine, the deferred rail card via parkPlacementCard, and the first-acknowledged-run welcome card via account.boardAcked(); Compete OFF clears any placement waiting on the death panel"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-board.test.js (S1/S1b/S1c SOURCE pins; H1-H5 BEHAVIOUR tests against the shipped handlePlacement with recording fakes), test/unit/shell-account.test.js (B2 extended, new C2)"
        status: pass
      - kind: other
        ref: "npm test (full suite): 8344 pass, 0 fail, 2 skipped (pre-existing), exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "On the Pixel 7: a Compete-ON death online shows \"You placed Nth of M.\" matching LEADERBOARD's DEPTH view; an offline death shows one rail card once back in the dungeon; the welcome card fires once on the first acknowledged run (never again, including after ERASE MY RUNS); Compete OFF before the rank arrives shows no rank line"
    verification: []
    human_judgment: true
    rationale: "Device-only checks (live board acknowledgement timing, airplane-mode-then-reconnect, the Pixel 7's own rendering) — deferred to the milestone-close Pixel 7 UAT batch per project convention (deferred UAT protocol)"

# Metrics
duration: ~40min
completed: 2026-09-29
status: complete
---

# Phase 85 Plan 05: "You Placed Nth of M" — Summary

**content/placement.js and src/browser/placement.js rewritten for our own board's per-run DEPTH ranks (no standing band, no season-drop line, a new placementOutcome line-vs-card rule), and mazeworld.html's handlePlacement wires boardSync's onPlacement/liveHash/onAcked into the death panel's rank line, the deferred rail card, and the first-run welcome card end to end.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- **content/placement.js:** Kept the four existing rank bands (first/ten/hundred/rest — they already read "You placed {rank} of {total}."), deleted the `standing` band and `SEASON_DROP_LINES` entirely (every submitted run has its own DEPTH rank now, so a run can never fail to "beat the best" the way the retired Play Games single-best-score model made possible; the new durable queue has no season-drop path). `PLACEMENT_CARD`'s `one`/`many` lines now name the board "DEPTH" instead of the retired "DEEPEST" leaderboard.
- **src/browser/placement.js:** `placementLine`/`deferredPlacementCard` drop their `newBest`/standing branches (an extra `newBest` field is now silently ignored); `seasonDropLine` is deleted. New `placementOutcome({live, rest, liveHash, panelUp})` — the one pure rule: a valid live run whose hash still matches the death panel's `liveDeathHash`, read while that panel is up, draws the fading rank line (and any valid `rest` still parks its own card); every other case (panel gone, hash mismatch, no live run) folds a valid live into one deferred card (`count = rest.count + 1`, the reported rank is whichever of live/rest is smaller/better); a lone valid `rest` parks its own card unchanged; nothing valid gives `{line: null, card: null}`; never throws.
- **mazeworld.html:** The placement import drops `placementLine`/`deferredPlacementCard`/`seasonDropLine` for the single `placementOutcome`. `createBoardSync({...})` gains `liveHash: () => liveDeathHash`, `onAcked: () => account?.boardAcked()` (the already-built 85-03/85-04 welcome-card machinery now actually fires on the first acknowledged run) and `onPlacement: handlePlacement`. New `handlePlacement(report)` calls `placementOutcome`, draws the rank line through the existing `renderRankLine(document.getElementById("cb-over"), window.__mzPlacement)` path when there's a line, and parks a card through the already-renamed `parkPlacementCard` when there's a card — wrapped in try/catch so a bad report never breaks the queue. `account.subscribe` now also clears `window.__mzPlacement` the instant Compete reads OFF, so a rank line never outlives consent.
- **src/browser/bridge.js:** `__mzPlacement`'s registry entry now names `handlePlacement` (set) and the `subscribe` callback (reset on Compete OFF) alongside the existing read/reset consumers, and drops the stale "DEEPEST" wording for "DEPTH."
- **Tests:** `test/unit/placement.test.js`/`placement-copy.test.js` rewritten (RED then GREEN — see TDD Gate Compliance below) for the new bank shape and `placementOutcome`. `tools/lib/voice-corpus.mjs`, `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js` drop `SEASON_DROP_LINES` from their registries/walks. `test/unit/shell-board.test.js` gets S1 extended (the three new `createBoardSync` options), new S1b/S1c SOURCE pins, and five new H1-H5 BEHAVIOUR tests exercising the shipped `handlePlacement` with recording fakes. `test/unit/shell-account.test.js` gets B2 extended (the Compete-OFF `__mzPlacement` clear) and a new C2 SOURCE pin for `onAcked -> account.boardAcked()`.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the full RED → GREEN gate sequence, confirmed in `git log`:
1. **RED** — `a5a5c55f` `test(85-05): failing tests for per-run DEPTH placement ranks (RED)`. Verified failing before implementation: 8 test failures (5 in `placement-copy.test.js` for the retired `standing`/`SEASON_DROP_LINES` shape, 1 import-level failure in `placement.test.js` for the not-yet-existing `placementOutcome`, 2 in `voice-corpus.test.js`'s completeness check for the now-unregistered `SEASON_DROP_LINES` export).
2. **GREEN** — `8ddef8b1` `feat(85-05): placement copy and views for per-run DEPTH ranks`. All 94 tests across `placement.test.js`, `placement-copy.test.js`, `voice-corpus.test.js`, `safety-scan.test.js`, `hp-not-wp.test.js` and `content-is-pure-data.test.js` pass.

No REFACTOR commit — the GREEN implementation needed no follow-up cleanup.

Task 2 (`type="auto"`, no `tdd` attribute) was committed as a single `feat` commit (`0974de0b`) per plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: placement copy and views for per-run ranks on our board** (TDD: RED + GREEN)
   - RED: `a5a5c55f` (test)
   - GREEN: `8ddef8b1` (feat)
2. **Task 2: wire placement reports and the welcome card into the shell** - `0974de0b` (feat)

**Plan metadata:** (this commit, docs only)

## Files Created/Modified

- `content/placement.js` - PLACEMENT_LINES (no standing band), PLACEMENT_CARD (no Standing variants, names DEPTH); SEASON_DROP_LINES deleted
- `src/browser/placement.js` - placementLine/deferredPlacementCard drop newBest branches; seasonDropLine deleted; new placementOutcome export
- `test/unit/placement.test.js` - Rewritten: standing/newBest tests dropped, new placementOutcome test block added
- `test/unit/placement-copy.test.js` - Rewritten: PLACEMENT_LINES standing/SEASON_DROP_LINES tests dropped, DEPTH/no-retired-board rendering guards added
- `tools/lib/voice-corpus.mjs` - SEASON_DROP_LINES bank row deleted; PLACEMENT_LINES description updated to "the DEPTH rank line"
- `test/voice/safety-scan.test.js` - SEASON_DROP_LINES import/walk-entry/completeness-check reference dropped
- `test/unit/hp-not-wp.test.js` - SEASON_DROP_LINES import/bank-list entry dropped
- `mazeworld.html` - placement import narrowed to placementOutcome; createBoardSync gains liveHash/onAcked/onPlacement; new handlePlacement function; account.subscribe clears __mzPlacement on Compete OFF
- `src/browser/bridge.js` - __mzPlacement registry entry updated for the new consumer set (handlePlacement, the subscribe callback) and DEPTH wording
- `test/unit/shell-board.test.js` - R9 extended; new S1b/S1c SOURCE pins; new H1-H5 BEHAVIOUR tests for handlePlacement
- `test/unit/shell-account.test.js` - B2 extended (Compete-OFF __mzPlacement clear); new C2 SOURCE pin (onAcked -> boardAcked())

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: the merge rule for a live run that misses the death panel folds it into the deferred card using whichever of live/rest has the better (smaller) rank; handlePlacement keeps its own try/catch as defense-in-depth beyond placementOutcome's own never-throws contract; PLACEMENT_CARD names "DEPTH" rather than the retired "DEEPEST" board name, required by the plan's own acceptance grep.

## Deleted Tests

Per the plan's output spec, every dropped test id/name from the two rewritten placement test files:

**test/unit/placement.test.js:**
- `placementLine: the D-13 worked example` (newBest-shaped call signature retired; folded into the new canonical-worked-example test with a plain `{rank, total, hash}` input)
- `placementLine: newBest false uses the standing band at any rank, including 1` (the standing band no longer exists)
- `placementLine: newBest null or missing uses the rank band` (superseded by the new "an extra newBest field is ignored" test, which covers the same ignored-field behavior for both `true`/`false`/missing)
- `deferredPlacementCard: newBest false uses oneStanding / manyStanding` (those variants no longer exist)
- `seasonDropLine: singular, plural with the count, and null below 1 or for a non-integer` (the whole `seasonDropLine` export is deleted)

**test/unit/placement-copy.test.js:**
- `PLACEMENT_LINES is deep-frozen with exactly first/ten/hundred/rest/standing` (replaced with the no-standing-band version)
- `PLACEMENT_LINES bank sizes: first/ten/hundred/standing at least 3, rest at least 4` (replaced, standing size check dropped)
- `The standing band never claims this run placed (it did not beat the best)` (the standing band no longer exists)
- `PLACEMENT_CARD is deep-frozen with the title, good tone and 12 s hold` (replaced with the exactly-title/tone/hold/one/many version)
- `PLACEMENT_CARD variants are non-empty arrays with the right tokens` — the `oneStanding`/`manyStanding` half of its loop is gone (only `one`/`many` remain; the test itself was rewritten in place, not fully deleted)
- `PLACEMENT_CARD pins the plan's lines verbatim` — the `oneStanding`/`manyStanding` assertions are gone (the test was rewritten in place to keep only `one`/`many`)
- `SEASON_DROP_LINES is deep-frozen { one, many }; many uses {count}, one uses no token` (the whole `SEASON_DROP_LINES` export is deleted)

Every other pre-existing test (ordinalText, placementBand boundaries, the rest-band/hundred-band/ahead-token mechanics, determinism, deferredPlacementCard's count/rank/total null cases, the frozen/token-shape/rendering guards) was kept, only re-pointed at the new `{rank, total, hash}` call signature (no `newBest` field) where it previously passed one.

## Deviations from Plan

None - plan executed exactly as written. `content/placement.js`'s header comment originally drafted a mention of "the retired Play Games leaderboard" for context, which was caught and removed before commit since it collided with the plan's own acceptance grep (`grep -ciE "DEEP[E]ST|play[ _-]?games" content/placement.js src/browser/placement.js` must be 0 for each file) — fixed inline during Task 1, before the GREEN commit, so no separate deviation entry or extra commit was needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan is pure client-side view logic and shell wiring, exercised entirely against the fakes 85-02's `boardSync.js` and this plan's own recording fakes already provide.

## Human verification (deferred to end of run)

Batched into the milestone-close Pixel 7 checklist (`docs/UAT-v2.2.md`, Phase 86):

1. A Compete-ON death online: within a few seconds the THAT IS THAT panel fades in "You placed Nth of M." with a quip, and N matches the run's place on LEADERBOARD's DEPTH view.
2. A Compete-ON death in airplane mode, BURY THEM, start a new hero, turn the network back on: one rail card reports the earlier death's place once on the map (never while the title or a death panel is up).
3. The very first run that reaches the board raises the welcome card naming your @handle, public deaths and how to turn Compete off; it never appears again (also not after ERASE MY RUNS).
4. Compete OFF on the death panel before the rank arrives: no rank line appears.

## Next Phase Readiness

- 85-06 (Play Games removal) can now delete the retired modules/tests outright: this plan's shell imports none of them, and `grep -ciE "play[ _-]?games|pgs|seasonDropLin[e]" mazeworld.html` is 0.
- ACCT-04 is fully delivered (per 85-01-PLAN.md's source-audit table, 85-05 is its last deliverer across 85-02/85-04/85-05) and marked complete in REQUIREMENTS.md.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/placement.test.js test/unit/placement-copy.test.js test/unit/voice-corpus.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js test/determinism/content-is-pure-data.test.js` — 94 pass, 0 fail. `node --test test/unit/shell-board.test.js test/unit/shell-account.test.js test/unit/shell-combat-over.test.js test/unit/shell-new-best.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js` — 102 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8344 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity` is empty.
**Acceptance-criteria greps:** all Task 1/2 greps in 85-05-PLAN.md pass (verified individually during execution).

---
*Phase: 85-play-games-out-our-board-in*
*Completed: 2026-09-29*

## Self-Check: PASSED

All key files found on disk (content/placement.js, src/browser/placement.js, mazeworld.html, src/browser/bridge.js, test/unit/shell-board.test.js, test/unit/shell-account.test.js, test/unit/placement.test.js, test/unit/placement-copy.test.js, this SUMMARY.md); all three commits (a5a5c55f, 8ddef8b1, 0974de0b) found in `git log`.
