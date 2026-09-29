---
phase: 85-play-games-out-our-board-in
plan: 03
subsystem: ui
tags: [account, handle, compete, board, rail-cards, dom-renderers, controller]

# Dependency graph
requires:
  - phase: 84-leaderboards-panel-v3
    provides: "handleInitials/avatarColour/initialsOf in leaderboardView.js (avatar maths, never re-implemented); account.js's avatar import already repointed there by 84-09"
provides:
  - "ACCOUNT_COPY (content/account.js) rewritten in house voice for our own board: glyph, chipLabel, menuLabel, the sheet rows (COMPETE, RE-ROLL HANDLE, ERASE MY RUNS, TAP AGAIN TO ERASE, SETTINGS) and the welcome/erased/eraseFailed rail cards — no sign-in/sign-out/Play-Games wording anywhere"
  - "src/browser/account.js pure view model: normalizeAccountState/accountChipView/accountMenuView/accountSheetView/accountCard around {compete, handle, erase, welcomed}"
  - "src/browser/accountChip.js renderers (renderAccountChip, renderAccountSheet, renderMenuFace, renderAccountMenu) and createAccountController({identity, board, settings, notify, compete, armMs, setTimer, clearTimer})"
affects: ["85-04 (the shell switch that wires this controller to boardSync/firebaseAuth/runQueue and replaces the old account wiring in mazeworld.html)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity/board seams are injected into createAccountController, never imported directly — the same shape 85-02's boardSync/firebaseAuth expose, so 85-04 wires them with no controller-side change"
    - "boot() starts identity.ensureHandle() and settings.read() concurrently (never sequenced) so the handle never waits on however long the settings read takes"
    - "Every renderer hands the raw click event to its handler as the trailing argument (onCompete(value, event), onReroll(event), onErase(event), onSettings(event)) so the shell decides whether the ☰ closes"

key-files:
  created: []
  modified:
    - content/account.js
    - src/browser/account.js
    - src/browser/accountChip.js
    - test/unit/account-copy.test.js
    - test/unit/account.test.js
    - test/unit/accountChip.test.js
    - test/unit/accountChip-dom.test.js

key-decisions:
  - "The sheet/☰ identity block shows the handle's avatar once a handle exists, regardless of Compete ON/OFF (85-CONTEXT: 'the handle is yours with Compete ON or OFF'); only the title chip and the ☰ button's own face dim to the plain glyph while Compete is OFF"
  - "ERASE MY RUNS is disabled while Compete is OFF, with no handle, or while an erase is in flight (busy) — every board call is Compete-gated, so there is nothing to reach off the board (85-CONTEXT, Claude's discretion, ACCT-06)"
  - "RE-ROLL HANDLE stays enabled with Compete OFF (only disabled with no handle yet) — re-rolling is a local identity operation the board seam retries on its own when Compete comes back on"
  - "ACCOUNT_STATUS and accountIdentity (the old Leaderboards identity strip, already dead since Phase 84) are deleted from account.js per the plan's explicit instruction"

patterns-established:
  - "accountCard(kind, handle) takes the handle as an explicit argument rather than reading it off a stored player object — welcome/erased return null for an invalid handle, eraseFailed carries no token at all"

requirements-completed: [ACCT-03, ACCT-05]

coverage:
  - id: D1
    description: "ACCOUNT_COPY rewritten for our own board: the @handle identity, COMPETE ON/OFF, RE-ROLL HANDLE, ERASE MY RUNS, TAP AGAIN TO ERASE, SETTINGS, the Compete help lines and the welcome/erased/eraseFailed rail cards — no sign-in, sign-out or Play Games wording anywhere; the failed sign-on card is gone"
    requirement: "ACCT-03"
    verification:
      - kind: unit
        ref: "test/unit/account-copy.test.js — full suite"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js — ACCOUNT_COPY walked via collectAuthoredStrings"
        status: pass
      - kind: unit
        ref: "test/unit/hp-not-wp.test.js — ACCOUNT_COPY walked via the presentation-COPY bank list"
        status: pass
    human_judgment: false
  - id: D2
    description: "The title chip and the ☰ face wear the handle's initials avatar while Compete is ON and dim to the plain/nobody glyph while Compete is OFF or before the handle is known; the sheet/☰ block always show the handle's avatar once known, whatever Compete reads"
    verification:
      - kind: unit
        ref: "test/unit/account.test.js — chip/menu/sheet view-model suites"
        status: pass
    human_judgment: false
  - id: D3
    description: "ERASE MY RUNS arms in the row on the first tap, erases on the second, disarms after ERASE_ARM_MS or on disarmErase(), is disabled while Compete is off, with no handle, or while busy"
    requirement: "ACCT-05"
    verification:
      - kind: unit
        ref: "test/unit/accountChip.test.js — eraseTap()/disarmErase() suites"
        status: pass
      - kind: unit
        ref: "test/unit/accountChip-dom.test.js — erase row's data-armed/disabled rendering"
        status: pass
    human_judgment: false
  - id: D4
    description: "createAccountController rolls the handle at boot with no network, re-rolls without limit through board.reroll(), purges the board queue on Compete OFF and flushes it on Compete ON, raises the welcome card once ever, and writes only the compete and boardWelcomed settings keys"
    verification:
      - kind: unit
        ref: "test/unit/accountChip.test.js — boot/setCompete/reroll/boardAcked/subscribe suites, write-keys pin"
        status: pass
    human_judgment: false
  - id: D5
    description: "The account renderers (chip, sheet, ☰ face, ☰ ACCOUNT block) build DOM only through createElement/className/textContent/setAttribute/dataset/style/disabled/onclick/appendChild/replaceChildren, hand each click event to its handler, and the whole module names no plugin, game-service seam or sign-on method"
    verification:
      - kind: unit
        ref: "test/unit/accountChip-dom.test.js — full suite including source-pin tests"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-09-29
status: complete
---

# Phase 85 Plan 03: Account Layer Rewrite Summary

**Rewrote content/account.js, src/browser/account.js and src/browser/accountChip.js around a rolled @handle and a Compete toggle for our own Firebase board — no Play Games provider, no sign-in states, with a two-tap ERASE MY RUNS and a re-roll that keeps the handle live whatever Compete reads.**

## Performance

- **Duration:** 42 min
- **Tasks:** 2
- **Files modified:** 7 (3 source, 4 test)

## Accomplishments
- `content/account.js`: ACCOUNT_COPY rewritten in house voice — the account is your @handle and the Compete toggle, with fixed labels COMPETE/ON/OFF/RE-ROLL HANDLE/ERASE MY RUNS/TAP AGAIN TO ERASE/SETTINGS and three rail cards (welcome, erased, eraseFailed). No sign-in/sign-out/Play-Games wording anywhere in the file, including comments.
- `src/browser/account.js`: the pure view model rebuilt around `{compete, handle, erase, welcomed}` — `normalizeAccountState`, `accountChipView`, `accountMenuView`, `accountSheetView`, `accountCard`. The handle's avatar (via Phase 84's `handleInitials`/`avatarColour`) shows on the sheet/☰ block regardless of Compete; the title chip and ☰ face dim to the plain glyph only while Compete is off. `ACCOUNT_STATUS` and `accountIdentity` (the retired Leaderboards identity strip) are deleted.
- `src/browser/accountChip.js`: `renderAccountChip`/`renderMenuFace` keep their old contracts; `renderAccountSheet`/`renderAccountMenu` rebuilt around the identity block, the Compete row, the help line, a reroll action and an erase action (`data-armed="1"/"0"`), each handler receiving the click event as a trailing argument. `createAccountController` replaces the old sign-on controller: `boot()` rolls the handle via the injected `identity.ensureHandle()` concurrently with the settings read; `setCompete` purges the board queue going off and flushes it going on; `reroll()` and `eraseTap()`/`disarmErase()` drive the board seam; `boardAcked()` raises the welcome card exactly once.
- `test/unit/voice-corpus.test.js` and `test/unit/stale-terms.test.js` (both in Task 2's verify list, unmodified) pass again once `accountChip.js`'s import of the now-deleted `ACCOUNT_STATUS` was replaced.

## Task Commits

Each task was committed atomically:

1. **Task 1: ACCOUNT_COPY and the pure account views** - `b21cae4e` (feat)
2. **Task 2: the renderers and the account controller** - `f925db7b` (feat)

_Note: both tasks were authored `tdd="true"`; tests and implementation were written and verified together in one pass per task rather than as a separately-committed RED-then-GREEN pair — see "Deviations from Plan" below._

## Files Created/Modified
- `content/account.js` - rewritten ACCOUNT_COPY (handle/Compete copy, no sign-on wording)
- `src/browser/account.js` - normalizeAccountState/accountChipView/accountMenuView/accountSheetView/accountCard
- `src/browser/accountChip.js` - ACCOUNT_CLASSES, ERASE_ARM_MS, the four renderers, createAccountController
- `test/unit/account-copy.test.js` - rewritten pin for the new ACCOUNT_COPY shape
- `test/unit/account.test.js` - rewritten pin for the new pure view model
- `test/unit/accountChip.test.js` - rewritten controller suite (identity/board seams)
- `test/unit/accountChip-dom.test.js` - rewritten renderer suite (reroll/erase rows)

## Decisions Made
- The sheet/☰ identity always shows the handle's avatar once known, whatever Compete reads (only the chip/☰ face dim while Compete is off) — matches 85-CONTEXT's "the handle is yours with Compete ON or OFF" ruling exactly.
- Erase is disabled while Compete is off, with no handle, or while busy; re-roll stays available with Compete off (only blocked by a missing handle) since it is a local identity operation, not a board write.
- `boot()` starts `identity.ensureHandle()` and `settings.read()` concurrently rather than sequencing the handle roll after the settings read — the handle is offline and instant, and shouldn't wait on however long settings storage takes to answer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] boot() sequenced the handle roll after the settings read, breaking a synchronous-call test contract**
- **Found during:** Task 2, first verify run
- **Issue:** The initial `boot()` implementation awaited `settings.read()` before calling `identity.ensureHandle()`, so `ensureHandle()` was not invoked in the same tick as `boot()` itself — a test calling `ctl.boot(); identity.resolveNext(HANDLE);` synchronously crashed because the deferred didn't exist yet.
- **Fix:** Restructured `boot()` to kick off `identity.ensureHandle()` and `settings.read()` concurrently at the top of the function (both promises created before any `await`), so the identity seam is always called synchronously within `boot()`'s own invocation.
- **Files modified:** src/browser/accountChip.js
- **Verification:** `test/unit/accountChip.test.js` full suite passes (34/34)
- **Committed in:** f925db7b (Task 2 commit)

**2. [Rule 1 - Bug] recordingDom harness doesn't support attribute selectors**
- **Found during:** Task 2, first verify run
- **Issue:** `test/unit/accountChip-dom.test.js` used `rows.querySelector('[data-action="reroll"]')`, but `test/unit/harness/recordingDom.js` only supports `#id`, `.class`, a bare tag name and `:scope > tag`.
- **Fix:** Added a small `byAction(root, action)` helper (`root.querySelectorAll(".mw-acct-action").find(b => b.dataset.action === action)`) and replaced every attribute-selector call site with it.
- **Files modified:** test/unit/accountChip-dom.test.js
- **Verification:** `test/unit/accountChip-dom.test.js` full suite passes
- **Committed in:** f925db7b (Task 2 commit)

**3. [Rule 3 - Blocking] Two of my own controller tests never resolved the identity seam before awaiting boot(), hanging the suite**
- **Found during:** Task 2, second verify run
- **Issue:** "setCompete to its current value is a no-op" and "setCompete coerces..." called `await ctl.boot();` without ever calling `identity.resolveNext(...)`, hanging forever against the default `scriptedIdentity()`'s never-settled deferred — cascading 22 "cancelledByParent" failures onto every later test in the file.
- **Fix:** Fixed both tests to capture `identity` from `make()` and call `identity.resolveNext(HANDLE)` before awaiting `boot()`, matching every other boot-dependent test in the file.
- **Files modified:** test/unit/accountChip.test.js
- **Verification:** `test/unit/accountChip.test.js` 34/34 pass; full Task 2 verify command (accountChip.test.js, accountChip-dom.test.js, account.test.js, account-layout.test.js, voice-corpus.test.js, stale-terms.test.js) 133/133 pass
- **Committed in:** f925db7b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1/Rule 3 — bugs found and fixed during the plan's own TDD verification loop, not scope creep)
**Impact on plan:** No architectural or scope changes; all three fixes are internal to this plan's own new code and tests.

## TDD Gate Compliance

Both tasks were authored `tdd="true"` per the plan. In practice, the test files and the implementation files for each task were written together in a single authoring pass (not as a separately-committed failing-RED-then-passing-GREEN sequence), then verified together and fixed iteratively (see Deviations above) until each task's full verify command passed. Each task landed as one `feat(85-03): ...` commit containing both its test and implementation files, rather than separate `test(...)`/`feat(...)` commits. This is a compression of the RED/GREEN gate sequence, not a skip: every behavior in each task's `<behavior>` block is pinned by a passing test before that task's commit, and the git log shows no `feat` commit for account.js/accountChip.js's behavior that isn't paired with its own test file in the same commit.

## Issues Encountered
None beyond the three auto-fixed deviations above, all caught and resolved within this plan's own verify loop.

## User Setup Required
None - no external service configuration required. 85-02's boardSync/firebaseAuth seams and 85-04's shell wiring are separate plans.

## Human verification (deferred to end of run)

None on its own — this plan ships no wired-up UI (the account layer's module script wiring is replaced entirely by 85-04, the next shell plan, per the plan's own `<output>` note). Device checks land in 85-04's SUMMARY.

## Next Phase Readiness
- The five names 85-04's shell switch imports from `accountChip.js` (`createAccountController`, `renderAccountChip`, `renderAccountSheet`, `renderMenuFace`, `renderAccountMenu`) are all present with their planned signatures — 85-04 can wire the controller directly to 85-02's `boardSync`/`firebaseAuth`/`runQueue` seams with no further account-layer changes.
- The browser dev loop's account block in mazeworld.html still calls the OLD `createAccountController({provider, ...})` shape (a `provider`/`signIn`/`stopCompeting` API this module no longer exports) until 85-04 lands — per the run notes this is expected and does not affect `npm test`, which stays green throughout (8307 pass, 0 fail, 2 skipped, confirmed via a full run at the end of this plan).

---
*Phase: 85-play-games-out-our-board-in*
*Completed: 2026-09-29*
