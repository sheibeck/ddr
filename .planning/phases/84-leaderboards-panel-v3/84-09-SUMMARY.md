---
phase: 84-leaderboards-panel-v3
plan: 09
subsystem: ui
tags: [leaderboards, boards-v3, copy-cleanup, voice-corpus, retirement]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "84-08: the shell already runs the v3 Leaderboards panel (createLeaderboardPanel over leaderboardView); nothing but src/browser/account.js (avatarColour/initialsOf) and the old panel's own tests still imported the old modules"
provides:
  - "One Leaderboards panel in the tree: src/browser/boardsView.js and boardsPanel.js are deleted with their five test files (boardsView.test.js 82, boardsPanel.test.js 46, boardsPanel-dom.test.js 31, boards-css.test.js 17, board-global-trace.test.js 11 — 187 tests), and the .mw-bd-* CSS block is gone from mazeworld.html"
  - "src/browser/account.js's avatar helpers (avatarColour/initialsOf) now come from leaderboardView.js — the account chip and ☰ face are unaffected"
  - "content/boards.js trimmed to LEADERBOARD_COPY (the only panel copy bank), BOARD_COPY (deep/days/kills/purse, title/unit/unitOne only — the four NEW PERSONAL BEST rows), NEW_BEST_HEAD/NEW_BEST_LINES/FIRST_DEATH_LINES; BOARDS_PANEL_COPY, BOARD_FOOTNOTES, STANDING_LINES and GLOBAL_STANDING_LINES are deleted"
  - "src/browser/newBest.js's LINEAGE (combo) branch and the yard special-case are gone — the retired ids fall out of the BOARD_COPY-keyed filter naturally"
  - "tools/lib/voice-corpus.mjs, test/voice/safety-scan.test.js and test/unit/hp-not-wp.test.js no longer reference the deleted banks or modules; the boards surface holds 157 entries (floor 145)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A retired copy bank's historical why-ledger rows (docs/narrative-pass/why/*.json) are marked after:\"\" — the same convention the ledger already used for 79-02c's engine-side deletions — so the Phase 79 VOX-05 live tripwire (every ledger 'after' must be a line the game prints today) stays true instead of chasing a line that no longer exists"

key-files:
  created: []
  modified:
    - content/boards.js
    - src/browser/newBest.js
    - src/browser/account.js
    - mazeworld.html
    - test/unit/newBest.test.js
    - test/unit/boards-copy.test.js
    - test/unit/bests-adapter.test.js
    - test/unit/account.test.js
    - test/unit/leaderboard-css.test.js
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
    - tools/lib/voice-corpus.mjs
    - docs/narrative-pass/why/79-06.json
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "BOARD_COPY is trimmed to only the fields newBest.js actually reads (title, unit, unitOne) — mark/col/unitLabel/rule/tab are gone along with the rail-only rendering that used them"
  - "newBestView's id filter changed from `id !== \"yard\" && known.has(id)` to plain `known.has(id)` — since combo and yard are no longer BOARD_COPY keys, Object.keys(BOARD_COPY) already excludes them, so the special case was redundant"
  - "test/unit/bests-adapter.test.js's shared-board-table test now compares BOARD_COPY's keys against engine/records.js RANKED_BOARDS (was BOARD_IDS, the six-board list including the two now-retired ids)"

requirements-completed: [BOARD-20]  # per the phase source-audit table in 84-01-PLAN.md, 84-09 is BOARD-20's last deliverer (84-01, 84-05, 84-06, 84-09). BOARD-18's last deliverer was 84-08 and is already marked complete — not re-touched here.

coverage:
  - id: D1
    description: "src/browser/boardsView.js and boardsPanel.js (the board rail, LEANEST/LINEAGE/GRAVEYARD boards, the ME/ALL/FRIENDS strip, the Play Games global seam and its scoreFallback import) are deleted with their five test files, and the .mw-bd-* CSS is removed from mazeworld.html — one Leaderboards panel remains"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test ! -e src/browser/boardsView.js && test ! -e src/browser/boardsPanel.js && test ! -e test/unit/boardsView.test.js && test ! -e test/unit/boardsPanel.test.js && test ! -e test/unit/boardsPanel-dom.test.js && test ! -e test/unit/boards-css.test.js && test ! -e test/unit/board-global-trace.test.js"
        status: pass
      - kind: unit
        ref: "grep -c '^\\.mw-lb' mazeworld.html (84, >= 40) and grep -c '^#screen-dead{padding-left:0;padding-right:0;padding-bottom:0;height:100%}' mazeworld.html (1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "content/boards.js keeps only what the game still shows: LEADERBOARD_COPY, NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES and a BOARD_COPY trimmed to deep/days/kills/purse carrying the NEW PERSONAL BEST row titles and units; BOARDS_PANEL_COPY, BOARD_FOOTNOTES, STANDING_LINES and GLOBAL_STANDING_LINES are deleted"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "node -e \"import('./content/boards.js').then(m=>console.log(Object.keys(m).sort().join(',')))\" -> BOARD_COPY,FIRST_DEATH_LINES,LEADERBOARD_COPY,NEW_BEST_HEAD,NEW_BEST_LINES"
        status: pass
      - kind: unit
        ref: "test/unit/boards-copy.test.js (8 tests, rewritten)"
        status: pass
    human_judgment: false
  - id: D3
    description: "NEW PERSONAL BEST still renders for every history-based new best (deep, days, kills, purse) with its existing titles and units; the retired combo/yard ids fall through to \"\" instead of throwing"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test/unit/newBest.test.js (13 tests, rewritten)"
        status: pass
    human_judgment: false
  - id: D4
    description: "account.js takes avatarColour and initialsOf from leaderboardView.js (the same ported helpers), so the account chip and ☰ face look exactly as before"
    verification:
      - kind: unit
        ref: "test/unit/account.test.js — 'source: imports the avatar helpers from leaderboardView.js and the copy from content/account.js'"
        status: pass
    human_judgment: true
    rationale: "Pixel-identical avatar rendering (hash-based colour, initials) after a pure import-path swap is proven by the source pin and the unchanged helper functions, but the visual look is deferred to the batched device UAT round per project convention (see Human verification below)."
  - id: D5
    description: "The voice corpus, safety scan and HP-not-WP walks no longer reference the deleted banks or modules, and the boards surface stays at or above its floor of 145 entries (157 measured)"
    requirement: "BOARD-20"
    verification:
      - kind: unit
        ref: "test/unit/voice-corpus.test.js — 'floors: every surface and the text total stay above their floors'"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js and test/unit/hp-not-wp.test.js (full suites, both green)"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-29
status: complete
---

# Phase 84 Plan 09: Retire the Old Leaderboards Panel Summary

**Deleted the old boardsView.js/boardsPanel.js panel (187 tests) and its .mw-bd-* CSS, trimmed content/boards.js to the four NEW PERSONAL BEST rows plus LEADERBOARD_COPY, and cleaned every voice/safety/HP-not-WP registration that referenced the retired banks and modules.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 22 (7 deleted, 15 modified)

## Accomplishments

- Deleted `src/browser/boardsView.js` and `src/browser/boardsPanel.js` (the board rail, LEANEST/LINEAGE/GRAVEYARD boards, the ME/ALL/FRIENDS strip and the Play Games global seam) along with their five test files
- Removed the `.mw-bd-*` CSS block from `mazeworld.html`, keeping the `#screen-dead` rules the v3 panel also relies on and merging the edge-to-edge note into the `.mw-lb` block's own comment
- Repointed `src/browser/account.js`'s avatar helper import (`avatarColour`/`initialsOf`) from the retired `boardsView.js` to `leaderboardView.js`
- Trimmed `content/boards.js` down to `LEADERBOARD_COPY` (the only remaining panel copy bank), `BOARD_COPY` (deep/days/kills/purse, `title`/`unit`/`unitOne` only), `NEW_BEST_HEAD`, `NEW_BEST_LINES` and `FIRST_DEATH_LINES`; deleted `BOARDS_PANEL_COPY`, `BOARD_FOOTNOTES`, `STANDING_LINES` and `GLOBAL_STANDING_LINES`
- Dropped the LINEAGE (`combo`) branch from `newBest.js#newBestValueText` and simplified `newBestView`'s id filter — the retired `combo`/`yard` ids now fall out naturally since they are no longer `BOARD_COPY` keys
- Cleaned `tools/lib/voice-corpus.mjs`'s `BANK_REGISTRY`, `RAW_SURFACES` and `OWNER_RULES` of the retired banks and the two deleted module paths, and dropped the `boardsView.js#LINEAGE_SUBS` `NON_COPY_EXPORTS` row
- Cleaned the same retired-bank imports and walks from `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js`, repointing their Phase 68 label checks at `LEADERBOARD_COPY`

## Task Commits

Each task was committed atomically:

1. **Task 1: delete the old view, panel, CSS and their tests; repoint account.js** - `1007b7c6` (feat)
2. **Task 2: trim content/boards.js to what the game still shows and clean the corpus, safety and HP-not-WP registrations** - `dfefd692` (feat)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

## Files Created/Modified

- `src/browser/boardsView.js` - deleted (980 lines)
- `src/browser/boardsPanel.js` - deleted (990 lines)
- `test/unit/boardsView.test.js` - deleted (82 tests, 1318 lines)
- `test/unit/boardsPanel.test.js` - deleted (46 tests, 1098 lines)
- `test/unit/boardsPanel-dom.test.js` - deleted (31 tests, 787 lines)
- `test/unit/boards-css.test.js` - deleted (17 tests, 210 lines)
- `test/unit/board-global-trace.test.js` - deleted (11 tests, 440 lines)
- `mazeworld.html` - removed the `.mw-bd-*` CSS block and its old comment; merged the edge-to-edge note into `.mw-lb`'s comment
- `src/browser/account.js` - avatar helper import repointed to `leaderboardView.js`; comment updated
- `test/unit/account.test.js` - import and source-pin test updated to match
- `test/unit/leaderboard-css.test.js` - its own placeholder test ("the old .mw-bd-* block still has at least 50 lines ... 84-09 removes it") now asserts zero `.mw-bd` lines remain (Rule 3 deviation, see below)
- `content/boards.js` - trimmed to `LEADERBOARD_COPY`/`BOARD_COPY`/`NEW_BEST_*`/`FIRST_DEATH_LINES`; header comment and `LEADERBOARD_COPY`'s own comment rewritten
- `src/browser/newBest.js` - LINEAGE branch and yard special-case removed; comments updated
- `test/unit/newBest.test.js` - rewritten: combo cases removed, retired-id cases (`lean`, `combo`, `yard`, `bogus`) all return `""`, `BOARD_COPY` key-order pin updated to `["deep","days","kills","purse"]`
- `test/unit/boards-copy.test.js` - rewritten: 27 old-panel tests deleted, 8 new tests pin `BOARD_COPY`'s trimmed shape and `NEW_BEST_HEAD`/`NEW_BEST_LINES`/`FIRST_DEATH_LINES`
- `test/unit/bests-adapter.test.js` - shared-board-table test retargeted at `RANKED_BOARDS`
- `tools/lib/voice-corpus.mjs` - `BANK_REGISTRY` rows for the four retired banks removed; `RAW_SURFACES`/`OWNER_RULES` module lists and `NON_COPY_EXPORTS` cleaned of the two deleted files
- `test/voice/safety-scan.test.js` - retired imports/walks removed; Phase 68 label test repointed at `LEADERBOARD_COPY`
- `test/unit/hp-not-wp.test.js` - retired imports/walks removed; Phase 68 `BOARDS_PANEL_COPY.global` test replaced with a `LEADERBOARD_COPY.scope`/`.state` equivalent
- `docs/narrative-pass/why/79-06.json` - the 4 ledger rows for the deleted banks marked `after:""` (deviation, see below)
- `docs/NARRATIVE-PASS.md`, `docs/narrative-pass/review.html` - regenerated via `node tools/narrative-review.mjs`

## Decisions Made

- Trimmed `BOARD_COPY` to exactly the three fields `newBest.js` reads (`title`, `unit`, `unitOne`) rather than keeping the unused `mark`/`col`/`unitLabel`/`rule`/`tab` fields around — nothing in the tree reads them once the rail renderer that consumed them (`boardsView.js`) is deleted
- Left the `test/unit/bests-adapter.test.js` import switch from `BOARD_IDS` to `RANKED_BOARDS` as a plain rename rather than importing both, since nothing else in that file used `BOARD_IDS`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `test/unit/leaderboard-css.test.js`'s self-invalidating placeholder test**
- **Found during:** Task 1 verification
- **Issue:** The test was authored in 84-06 with the name "CSS: the old .mw-bd-* block still has at least 50 lines (untouched, 84-09 removes it)" — a deliberate tripwire documenting that this exact plan would remove the block, which it now failed against (0 lines found, not >= 50)
- **Fix:** Rewrote the test to assert the block is gone (0 `.mw-bd` lines), matching the file's own stated intent
- **Files modified:** test/unit/leaderboard-css.test.js
- **Verification:** `node --test test/unit/leaderboard-css.test.js` passes
- **Committed in:** `1007b7c6` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed the Phase 79 narrative-pass live tripwire broken by the copy deletion**
- **Found during:** `npm test` at the end of Task 2
- **Issue:** `test/unit/narrative-review.test.js`'s "live (VOX-05 prohibition): every before is a phase-base line and every after is a line the game prints now" failed — `docs/narrative-pass/why/79-06.json` recorded four historical ledger rows (`bank:BOARD_COPY.yard.rule`, `bank:BOARDS_PANEL_COPY.scope.ranked`, `bank:STANDING_LINES.rest.2`, `bank:GLOBAL_STANDING_LINES.ten.0`) whose "after" text no longer exists in the live corpus now that those banks are deleted
- **Fix:** Marked all four rows `after: ""` (the standing convention the ledger already used for 79-02c's engine-side deletions) with an updated `why` noting the Phase 84 retirement, then regenerated `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` via `node tools/narrative-review.mjs`
- **Files modified:** docs/narrative-pass/why/79-06.json, docs/NARRATIVE-PASS.md, docs/narrative-pass/review.html (none of these are in the plan's `files_modified` list, but the fix is required for `npm test` to pass)
- **Verification:** `node --test test/unit/narrative-review.test.js` passes; full `npm test` run afterward shows 0 failures (8327 pass, 2 skip)
- **Committed in:** `dfefd692` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-name mismatch, 1 blocking cross-cutting historical-audit break)
**Impact on plan:** Both fixes were required for the plan's own stated `npm test exits 0` acceptance criterion. No scope creep beyond what was necessary to make the deletion land cleanly.

## Issues Encountered

None beyond the two deviations above.

## Known Stubs

None.

## Threat Flags

None — this plan only deletes copy/view surface, it introduces no new network endpoints, auth paths, file access patterns or schema changes.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

- The ☰ face and title chip avatars look unchanged (avatarColour/initialsOf now imported from leaderboardView.js instead of the deleted boardsView.js — same hash function, same initials rule, proven by source pin and unit tests, but pixel appearance is a device check)
- A new personal best on the death card still lists DEEPEST DESCENT / LONGEST HELD OUT / MOST KILLS / RICHEST CORPSE rows (proven by test/unit/newBest.test.js against the trimmed BOARD_COPY, but the on-device THAT IS THAT panel rendering is a device check)

## Next Phase Readiness

- Phase 84 (Leaderboards Panel v3) is now fully closed: the v3 panel is the only Leaderboards surface in the tree, and BOARD-20 is complete
- The Play Games modules (globalBoards.js, boardScores.js, scoreTag.js, pgsQueue.js, playGames.js, the account rewrite) remain in the tree for Phase 85 to remove, per the phase boundary in 84-CONTEXT.md
- No blockers

---
*Phase: 84-leaderboards-panel-v3*
*Completed: 2026-09-29*

## Self-Check: PASSED
