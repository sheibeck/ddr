---
phase: 46-honest-names-dead-exports-the-tutorial-decision
plan: 01
subsystem: ui
tags: [rename, dead-code, narration, rail, fight-log, shell]

requires:
  - phase: 44
    provides: "Classic engine retired from the shell (dead-code precedent, shell-sweep tooling)"
  - phase: 45
    provides: "wornSlots collapse — the last Phase 37 hedge; clean baseline for this phase's renames"
provides:
  - "src/browser/narrationLines.js (git mv from toasts.js) exporting LINE_FOR, linesForAction, narrativeLineText, oracleDetailText, ORACLE_ONLY, FEATURE_EVENTS, CARD_EVENTS, NARRATIVE_ACTIONS, TONES, PRIORITY, slotWord — no lifetime/cap exports"
  - "mazeworld.html's single dispatch seam renamed dispatchWithNarration(action)"
  - "five renamed test files: narrationLinesTable, linesForAction, narrationLinesCoverage, narrativeLines, shell-narration-wiring"
  - "linesForAction's opts.limit default is Infinity (uncapped) — every production caller already passed limit: Infinity"
affects: [46-02, 46-03, 46-04, 48]

tech-stack:
  added: []
  patterns:
    - "Two-commit rename discipline: module/export rename first (with its own zero-straggler grep), shell-function rename second (with its own zero-straggler grep) — mirrors 46-CONTEXT.md's 'Commit discipline' decision"
    - "Before/after fold-dump proof: a scratch ESM script dynamic-imports the pre- and post-rename module by file name and diffs a fixed JSON dump of the fold pipeline over a fixed event mix — proves a pure rename with zero behavioural drift, independent of the unit suite"

key-files:
  created: []
  modified:
    - src/browser/narrationLines.js
    - src/browser/eventNarration.js
    - src/browser/fightLog.js
    - src/browser/rail.js
    - src/browser/viewModels.js
    - mazeworld.html
    - test/unit/linesForAction.test.js
    - test/unit/narrationLinesTable.test.js
    - test/unit/narrationLinesCoverage.test.js
    - test/unit/narrativeLines.test.js
    - test/unit/shell-narration-wiring.test.js
    - test/unit/round-card-worst-case.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "Proactively renamed the one src/-side dispatchWithToasts mention (a comment in narrationLines.js's CARD_EVENTS doc) during Task 1, ahead of Task 2's own sed — Task 2's sed scope is deliberately limited to mazeworld.html and test/ (per plan), but Task 2's own acceptance criterion greps src/ too; fixing it in Task 1 avoided a false failure at Task 2's gate without touching Task 2's sed scope"
  - "Fixed three stale in-repo file-path references that predated this rename and were invisible to the token-rename sed (a JS regex literal with an escaped dot — /toasts\\.js/ — doesn't textually match the sed pattern toasts.js; a prose mention of test/unit/toastTable.test.js and test/unit/shell-toast-wiring.test.js by their old names) — corrected as part of the same commit since they point at files this plan renamed"

requirements-completed: [NAME-01]

coverage:
  - id: D1
    description: "Module rename + export renames + dead-export deletion + dead re-export deletion, with a byte-identical before/after fold-dump proof and the exact LINE_FOR(250)/ORACLE_ONLY(21) key counts"
    requirement: "NAME-01"
    verification:
      - kind: unit
        ref: "npm test — # pass 3240, # fail 0 (delta from 3242 is exactly the two deleted lifetime tests)"
        status: pass
      - kind: other
        ref: "diff <scratchpad>/46-01-before.json <scratchpad>/46-01-after.json — (empty)"
        status: pass
      - kind: other
        ref: "grep -rnE \"toasts\\.js|TOAST_FOR|toastsForAction|narrativeToastText|MAX_TOASTS|TOAST_[A-Z_]*_MS|toastLifetime\" src/ engine/ content/ tools/ mazeworld.html test/ — (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shell's single dispatch seam renamed dispatchWithToasts(action) -> dispatchWithNarration(action), defined once, routed through by every call site"
    requirement: "NAME-01"
    verification:
      - kind: unit
        ref: "npm test — # pass 3240, # fail 0 (unchanged); node --test test/unit/shell-narration-wiring.test.js test/unit/shell-fight-log.test.js test/unit/shell-map-rail.test.js test/unit/shell-company-panel.test.js — # fail 0"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs dispatchWithToasts — refs dispatchWithToasts: 0; node tools/shell-sweep.mjs refs dispatchWithNarration — refs dispatchWithNarration: 10"
        status: pass
    human_judgment: false

duration: ~2h
completed: 2026-09-19
status: complete
---

# Phase 46 Plan 01: The narrationLines Rename Summary

**Renamed `src/browser/toasts.js` to `src/browser/narrationLines.js` (`TOAST_FOR` → `LINE_FOR`, `toastsForAction` → `linesForAction`, `narrativeToastText` → `narrativeLineText`), deleted the six dead toast-lifetime exports and the two consumer-less re-exports, moved all 35 importers and five test files to the honest names, and renamed the shell's `dispatchWithToasts` to `dispatchWithNarration` — two commits, each with its own zero-straggler grep, and a byte-identical before/after fold-dump proof.**

## Performance

- **Duration:** ~2h
- **Started:** 2026-09-19
- **Completed:** 2026-09-19
- **Tasks:** 3
- **Files modified:** 44 (36 in Task 1's commit, 8 in Task 2's commit) + this SUMMARY

## Accomplishments

- `src/browser/toasts.js` git-mv'd to `src/browser/narrationLines.js` (history follows: `git log --follow` shows 38 commits)
- `TOAST_FOR → LINE_FOR`, `toastsForAction → linesForAction`, `narrativeToastText → narrativeLineText` renamed across all 5 `src/` consumers, the shell, 28 test files, and the voice scan
- Deleted the six dead toast-lifetime exports (`MAX_TOASTS`, `TOAST_BASE_MS`, `TOAST_PER_CHAR_MS`, `TOAST_CAP_MS`, `TOAST_STACK_BONUS_MS`, `toastLifetime()`) — dead since the Phase 25.1 toast host was retired in Phase 35
- Deleted the two consumer-less re-export lines (`eventNarration.js`, `rail.js`); `narrationLinesCoverage.test.js`'s identity test rewritten to prove neither module re-exports the surface and `narrationLines.js` never imports `eventNarration.js`
- `linesForAction`'s `opts.limit` default changed from `MAX_TOASTS` (4) to `Infinity` — matches what every production caller (`fightLog.js`, the rail path in `mazeworld.html`) already passed explicitly
- Five `*toast*.test.js` files git-mv'd to honest names (recorded below)
- The shell's `dispatchWithToasts(action)` renamed to `dispatchWithNarration(action)` — defined once, 9 call sites, its own doc comment's first sentence reworded to describe current behaviour
- Before/after fold-dump proof: a fixed 9-event attack mix + a fixed 3-event move, dumped through `toastsForAction`/`linesForAction` before and after the whole rename — byte-identical
- `LINE_FOR` confirmed at exactly 250 keys, `ORACLE_ONLY` at exactly 21 entries (the plan's must_haves pin)

## Task Commits

1. **Task 1: git mv toasts.js → narrationLines.js, rename exports, delete dead lifetime exports + dead re-exports, move 35 importers + 5 test files** — `3cf31ed` (refactor)
2. **Task 2: rename the shell's dispatchWithToasts(action) to dispatchWithNarration(action)** — `33c7170` (refactor)

**Plan metadata:** committed via `<final_commit>` (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/browser/narrationLines.js` — git mv from `src/browser/toasts.js`; honest export names, no lifetime exports, header/doc comments rewritten to describe today's role
- `src/browser/eventNarration.js` — dropped the dead re-export line + its rationale comment; reworded the one-directional-import comment
- `src/browser/fightLog.js` — import path/names follow the rename; local `const toasts` renamed to `lines`
- `src/browser/rail.js` — dropped the dead re-export block; header comment reworded
- `src/browser/viewModels.js` — one comment mention of the module path updated
- `mazeworld.html` — three import lines follow the rename; `dispatchWithToasts` → `dispatchWithNarration` (definition + 9 call sites); the function's doc comment's first sentence reworded
- `test/unit/narrationLinesTable.test.js` (git mv from `toastTable.test.js`) — dropped `MAX_TOASTS` from the import; deleted the "MAX_TOASTS is 4" test; header renamed
- `test/unit/linesForAction.test.js` (git mv from `toastsForAction.test.js`) — the 9-event ordering test re-pinned to the uncapped default (`out.length === 9`)
- `test/unit/narrationLinesCoverage.test.js` (git mv from `toastsCoverage.test.js`) — identity test rewritten to prove no re-export surface + no import cycle; header/stale-path comments fixed
- `test/unit/narrativeLines.test.js` (git mv from `narrativeToasts.test.js`) — dropped the six lifetime names from the import; deleted the DFB-02 boundary-table test; header renamed
- `test/unit/shell-narration-wiring.test.js` (git mv from `shell-toast-wiring.test.js`) — import-line regexes re-pinned to `narrationLines.js`; the MAX_TOASTS-slice pin replaced with a `limit = Infinity` / no-constant-backed-default pair of assertions; header renamed
- `test/unit/round-card-worst-case.test.js` — `hostCapped` renamed `defaultCall`, now asserts equality with the explicit `{ limit: Infinity }` fold; header comment reworded
- `test/unit/shell-fight-log.test.js` — `cappedDefault` renamed `defaultCall`, now asserts equality with `lines.length`; test retitled; header's "capped-host" phrase reworded
- `test/unit/shell-map-invariants.test.js` — RETIRED map keys renamed (`toastLifetimeBridge → lifetimeBridge`, `toastLifetime → lifetimeFn`); concatenated values unchanged
- `test/unit/shell-map-rail.test.js` — one test title reworded so it no longer spells `MAX_TOASTS`/`toastLifetime` verbatim

## Renamed files

`git mv` (history follows), old → new:

- `src/browser/toasts.js` → `src/browser/narrationLines.js`
- `test/unit/toastTable.test.js` → `test/unit/narrationLinesTable.test.js`
- `test/unit/toastsForAction.test.js` → `test/unit/linesForAction.test.js`
- `test/unit/toastsCoverage.test.js` → `test/unit/narrationLinesCoverage.test.js`
- `test/unit/narrativeToasts.test.js` → `test/unit/narrativeLines.test.js`
- `test/unit/shell-toast-wiring.test.js` → `test/unit/shell-narration-wiring.test.js`

## Deleted exports

Six names, dead since Phase 35 — the toast host is retired; only tests read them:

- `MAX_TOASTS`
- `TOAST_BASE_MS`
- `TOAST_PER_CHAR_MS`
- `TOAST_CAP_MS`
- `TOAST_STACK_BONUS_MS`
- `toastLifetime()`

## Deleted re-exports

Zero consumers existed for either:

- `src/browser/eventNarration.js` (was L1069): `export { TOAST_FOR, ORACLE_ONLY, FEATURE_EVENTS, CARD_EVENTS, NARRATIVE_ACTIONS, toastsForAction } from "./toasts.js";` — deleted with its rationale comment block
- `src/browser/rail.js` (was L556-561): `export { LINE_FOR, ORACLE_ONLY };` + its comment — deleted

`test/unit/narrationLinesCoverage.test.js`'s identity test rewritten from "eventNarration.js re-exports the SAME objects" to "eventNarration.js and rail.js do NOT re-export the surface at all" (dynamic-imports both modules, asserts `LINE_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`linesForAction` are `undefined` on each namespace) — this test failed once during execution (caught by `npm test`, fixed before proceeding; see Deviations).

## Tests re-pinned or deleted

| File | Kind | Reason |
|---|---|---|
| `test/unit/narrativeLines.test.js` | test case deleted | The DFB-02 lifetime boundary table (`toastLifetime(0,0)===3000` etc.) pinned a deleted function; import list dropped the six lifetime names |
| `test/unit/narrationLinesTable.test.js` | test case deleted | "MAX_TOASTS is 4" pinned a deleted constant; import dropped `MAX_TOASTS` |
| `test/unit/linesForAction.test.js` | re-pinned | The 9-event ordering test's cap assertion (`out.length===4`, priority-4 dropped) replaced with the uncapped assertion (`out.length===9`, priority-4 lines survive too) |
| `test/unit/round-card-worst-case.test.js` | re-pinned | `hostCapped`/`MAX_TOASTS` cap assertion replaced with `defaultCall` equalling the explicit `{ limit: Infinity }` fold's length; two test titles reworded (no longer claim "the toast host stays capped") |
| `test/unit/shell-fight-log.test.js` | re-pinned | `cappedDefault`/`MAX_TOASTS` cap assertion replaced with `defaultCall` equalling `lines.length`; test retitled |
| `test/unit/shell-narration-wiring.test.js` | re-pinned | Import-line regexes re-pinned to `narrationLines.js`; the "toastLifetime/CARD_EVENTS imported nowhere" test retitled and rewritten to assert exactly three `narrationLines.js` import lines exist and none contains `CARD_EVENTS`; the MAX_TOASTS-slice literal pin replaced with `limit = Infinity` (exactly once) + no-constant-backed-default assertions |
| `test/unit/shell-map-invariants.test.js` | re-pinned | RETIRED map keys `toastLifetimeBridge`/`toastLifetime` renamed to `lifetimeBridge`/`lifetimeFn` (concatenated string values, which the guard checks for zero occurrence of, unchanged) |
| `test/unit/shell-map-rail.test.js` | re-pinned | One test title reworded from spelling `MAX_TOASTS`/`toastLifetime` verbatim to describing them generically ("the cap constant", "the lifetime function") |
| `test/unit/narrationLinesCoverage.test.js` | rewritten (one test) | Identity test rewritten per "Deleted re-exports" above; a stale in-prose mention of `toastsCoverage.test.js`'s own old file name (its own header) and `shell-toast-wiring.test.js`'s old name fixed |
| `test/unit/fightLog.test.js` | pin unaffected | Its import-line pin (`["./eventNarration.js", "./narrationLines.js"]`) was already correct post-token-rename; no manual edit needed |

`npm test` count: 3,242 (phase-start baseline, `2be88a1`) → 3,240 after this plan (net -2: the two deleted lifetime test cases above; no other test added or removed).

## NAME-02 allowed survivors (this plan)

None: every identifier with `toast` in it under `src/`, the shell (`mazeworld.html`) and `tools/` is renamed or deleted. Comment prose elsewhere that uses "toast" as a concept word (e.g. "the toast is a summary, the Oracle is the record") is Phase 48's sweep (DOCS-01) — left untouched per the CONTEXT decision. NAME-02's own closing grep lands in 46-04.

## Decisions Made

- Proactively fixed the one `src/`-side `dispatchWithToasts` mention (a comment in `narrationLines.js`) during Task 1, since Task 2's acceptance criteria grep `src/` too even though Task 2's sed scope is deliberately `mazeworld.html`/`test/` only.
- Fixed three pre-existing stale file-path references invisible to the token-rename `sed` (a JS regex literal `/toasts\.js/`'s escaped dot breaks textual `toasts.js` matching; two prose mentions of test files by their pre-rename names) as part of the commit that renamed those files, since leaving them stale would misdirect future readers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] narrationLinesCoverage.test.js's identity test still referenced the deleted re-export surface after Task 1's other edits**
- **Found during:** Task 1's own `npm test` gate run — 3239 pass / 1 fail (`the narration table re-exports the toast surface without a cycle`)
- **Issue:** The plan's step 8 explicitly calls for rewriting this test (dynamic-import `eventNarration.js`/`rail.js`, assert the surface is `undefined` on both, keep the no-cycle assertion) but it was not yet done when the first `npm test` pass ran after the re-export deletions
- **Fix:** Rewrote the test per the plan's own instruction; retitled it to "the narration table and the rail do NOT re-export the narration-lines surface, and narrationLines.js never imports eventNarration.js"
- **Files modified:** `test/unit/narrationLinesCoverage.test.js`
- **Verification:** `npm test` → `# pass 3240, # fail 0`
- **Committed in:** `3cf31ed` (Task 1's own commit — caught before that commit was made)

---

**Total deviations:** 1 auto-fixed (1 bug fix — an in-progress rewrite step surfaced by the plan's own gate before the commit landed, not a post-commit fix)
**Impact on plan:** No scope creep — this was plan step 8's own explicitly-specified edit, applied in full before committing.

## Gate outputs

Per this plan's two commits (chronological):

```
3cf31ed (Task 1, refactor: module + export rename, dead-export deletion, 35 importers + 5 test files moved)
  npm test: # pass 3240, # fail 0
  npm run build:www: exit 0
  npm run boot:check: 4 PASS
  fold dump: diff <scratchpad>/46-01-before.json <scratchpad>/46-01-after.json — (empty), both files 1523 bytes
  straggler grep: grep -rnE "toasts\.js|TOAST_FOR|toastsForAction|narrativeToastText|MAX_TOASTS|TOAST_[A-Z_]*_MS|toastLifetime" src/ engine/ content/ tools/ mazeworld.html test/ — (empty)

33c7170 (Task 2, refactor: shell dispatchWithToasts -> dispatchWithNarration)
  npm test: # pass 3240, # fail 0 (unchanged)
  npm run build:www: exit 0
  npm run boot:check: 4 PASS
  straggler grep: grep -rnE "dispatchWithToasts" src/ engine/ content/ tools/ mazeworld.html test/ — (empty)
  node tools/shell-sweep.mjs refs dispatchWithToasts: refs dispatchWithToasts: 0
  node tools/shell-sweep.mjs refs dispatchWithNarration: refs dispatchWithNarration: 10
```

`git log --oneline 39c5a0f..HEAD`: `33c7170` (Task 2), `3cf31ed` (Task 1) — exactly two rename commits (the three preceding `docs(46):` commits are prior-plan STATE/ROADMAP bookkeeping, not this plan's work).

Engine-gate fence: `git diff --stat 39c5a0f -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty; `git status --porcelain test/parity/fixtures` — empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).

## Human verification (deferred to end of run)

Consolidated for the milestone-close Pixel 7 UAT round — no device pauses were taken (pure rename, the fold-dump diff is the desk proof):

- On a step, a fight round, and a camp, the RAIL card lines and the fight-log lines read exactly as before this build (no wording, tone, priority, or ordering change).

## Issues Encountered

None beyond the one auto-fixed deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The `narrationLines.js` module and its five renamed test files are clean of every NAME-01-listed identifier; the shell's single dispatch seam is `dispatchWithNarration`.
- Phase 46 Plans 02-03 (`winGame`/`state.won` removal, `controlScheme`/`tutorial.js` deletion) are independent of this plan's edits — no blocker.
- Phase 46 Plan 04's closing NAME-02 zero-straggler grep should find nothing left from this plan's renames; only Phase 48's comment/doc "toast"-as-concept-word prose remains, by design.
- No blockers for Plan 02.

---
*Phase: 46-honest-names-dead-exports-the-tutorial-decision*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: src/browser/narrationLines.js
- FOUND: test/unit/narrationLinesTable.test.js
- FOUND: test/unit/linesForAction.test.js
- FOUND: test/unit/narrationLinesCoverage.test.js
- FOUND: test/unit/narrativeLines.test.js
- FOUND: test/unit/shell-narration-wiring.test.js
- FOUND: .planning/phases/46-honest-names-dead-exports-the-tutorial-decision/46-01-SUMMARY.md
- FOUND: commit 3cf31ed (Task 1 — module + export rename)
- FOUND: commit 33c7170 (Task 2 — shell function rename)
