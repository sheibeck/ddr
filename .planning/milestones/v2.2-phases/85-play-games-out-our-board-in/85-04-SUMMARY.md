---
phase: 85-play-games-out-our-board-in
plan: 04
subsystem: ui
tags: [shell, mazeworld-html, account, board-sync, firebase-auth, compete-gate, hud-menu]

# Dependency graph
requires:
  - phase: 85-play-games-out-our-board-in
    provides: "85-01's five-row ☰ menu (MAKE CAMP first, no centring row) the account block lands on top of without touching the same lines twice"
  - phase: 85-play-games-out-our-board-in
    provides: "85-02's src/browser/boardSync.js (createBoardSync -> boot/record/flush/purge/reroll/erase/waitForPending) and firebaseAuth.js#setHandle, the board-side engine room this plan wires up"
  - phase: 85-play-games-out-our-board-in
    provides: "85-03's src/browser/accountChip.js (createAccountController, renderAccountChip/Sheet/Menu/MenuFace) and content/account.js/src/browser/account.js's handle-and-Compete view model"
  - phase: 84-leaderboards-panel-v3
    provides: "84-08's competeIsOn()/boardFetchFn()/boardClient/boardFeed/boardsPanel wiring this plan extends with boardFetch/boardIdentity and swaps the account block onto"
provides:
  - "mazeworld.html's module script running our own identity and board: one competeIsOn() gate read by the board client, both identities and boardSync; boardFetch created once and shared by the client and boardSync; boardIdentity() (sharedIdentity() on native, a dev-prefixed separate identity in the browser dev loop)"
  - "createBoardSync({...}) wired to death/resume/online/boot/pause: onRunRecorded -> boardSync.record(summary); the online listener forces a flush; boardSync's own visibilitychange listener kept FIRST in the file; account.boot() then boardSync.boot({history: getRunHistory()}) at launch, neither awaited; the native pause path awaits boardSync.waitForPending() alongside the adapter's"
  - "account = createAccountController({identity: boardIdentity(), board: boardSync, settings, notify: parkAccountCard, compete}) driving the ☰ block, the title sheet and the ☰ face; COMPETE/RE-ROLL keep the ☰ open, the confirming ERASE tap closes it; an armed erase row also disarms when the ☰/sheet closes"
  - "settings.js: SETTINGS_DEFAULTS drops pgsWelcomed/pgsDevSignedIn, gains boardWelcomed (default false) in their old slot; a stored blob carrying either retired key loses it on the next write"
  - "The dev row's Play Games sign-in group is gone from mazeworld.html (keeps #mw-dev-perf and the start-depth controls); the .mw-acct-action[data-action=\"erase\"] danger-palette CSS; account aria-label=\"Account\" on the title chip and the ☰ host"
  - "The whole Phase 67/68 Play Games provider/submission-queue/global-boards block is deleted from mazeworld.html; its imports (playGames.js, pgsQueue.js, globalBoards.js, boardScores.js) are gone"
  - "test/unit/shell-board.test.js (replaces shell-pgs.test.js): R1-R10 (the THAT IS THAT rank line, unchanged behavior) plus new SOURCE/BEHAVIOUR pins for the boardSync wiring and the renamed card parking (pendingPlacementCard/parkPlacementCard)"
affects: ["85-05 (the death screen's placement wiring lands on this plan's boardSync/parkPlacementCard/window.__mzPlacement scaffolding)", "85-06 (deletes the retired modules this plan's shell no longer imports; the RETIRE-02 sweep proves it)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One Compete gate (competeIsOn) read by every board-side seam (the board client, sharedIdentity, boardIdentity, boardSync) instead of each seam carrying its own copy or a hardcoded stub — a Compete flip is synchronous and instant everywhere"
    - "boardIdentity() splits by window.Capacitor?.isNativePlatform?.(): native returns the SAME sharedIdentity() a bug report uses; the browser dev loop gets a separate createIdentity() over the shared dev-loop fetch with every storage key prefixed \"dev.\" — dev-loop board play can never touch the live bug-report identity or sign up a live account"
    - "A MutationObserver on #mw-hud-menu's data-open attribute disarms an in-progress ERASE MY RUNS row the instant the menu closes by any path (a row tap, the scrim, Escape, the Android back mirror) — one observer covers every close route instead of threading a disarm call through each"

key-files:
  created:
    - test/unit/shell-board.test.js
  modified:
    - src/browser/settings.js
    - mazeworld.html
    - src/browser/bridge.js
    - test/unit/settings.test.js
    - test/unit/account-layout.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-account.test.js
    - test/unit/title-music-shell.test.js
    - test/unit/report-sheet-shell.test.js
  deleted:
    - test/unit/shell-pgs.test.js

key-decisions:
  - "competeIsOn() falls back to currentSettings?.compete === true only before `account` exists (module boot); once the controller exists it is the single source of truth (account.state().compete === true) — this matches 85-CONTEXT's 'one Compete gate' requirement (T-85-05) without a temporal-dead-zone hazard, since `account` starts null and the fallback covers the gap"
  - "boardFetch is read ONCE (const boardFetch = boardFetchFn();) and shared by the board client and boardSync, rather than each calling boardFetchFn() separately — in the browser dev loop this keeps both seams on the SAME in-memory fake board instance (a second call would seed a second, disconnected fake)"
  - "Every renderAccountMenu handler (onCompete/onReroll/onErase) calls event.stopPropagation() first, per 85-CONTEXT's Claude's-discretion note that COMPETE/RE-ROLL should keep the ☰ open — stopping propagation prevents the ☰'s own outside-tap close listener from firing on the same click"
  - "onErase reads account.state().erase BEFORE calling account.eraseTap(), then raises hudMenuEvent(\"select\") only when the row was already armed — this closes the ☰ on the CONFIRMING tap (armed -> busy) but leaves it open on the arming tap (idle -> armed), exactly matching the two-tap ABANDON THIS CHARACTER precedent this row mirrors"
  - "pendingPgsCard/pgsCardTimer/parkPgsCard renamed pendingPlacementCard/placementCardTimer/parkPlacementCard now (not deferred to 85-05) since the delivery machinery itself is generic rail-card parking with no Play Games meaning left in the names; 85-05 only has to wire boardSync's onPlacement callback to the already-renamed parkPlacementCard"
  - "shell-boards-panel.test.js needed no edits: its H1/H2 SOURCE pins check boardFetchFn's native-gate behavior and the panel's seam set, neither of which pins the literal `fetchFn: boardFetchFn()` call-site text this plan changed to `fetchFn: boardFetch` — confirmed by running the file after Task 2, still 28/28 green"

patterns-established:
  - "A shell test file whose SOURCE region needs to run as executable JS (via `new Function`) must slice through to a marker AFTER the target function's own closing brace, never a bare \"\\n  }\" pattern that stops one indent level short of the function boundary — a bare \"\\n  }\" is safe for `.match()`-only regex pins (never executed) but syntactically truncates the function when the region is actually run"

requirements-completed: [ACCT-05, ACCT-06, RETIRE-03]

coverage:
  - id: D1
    description: "The ☰ account block and the title sheet's ERASE MY RUNS runs a real two-tap arm/confirm through the account controller's board.erase() seam (85-02's boardSync.erase, Compete ON only) and closes the ☰ only on the confirming tap; an armed row also disarms when the ☰/sheet closes by any path"
    requirement: "ACCT-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-account.test.js (D4, G1, G2)"
        status: pass
      - kind: unit
        ref: "test/unit/accountChip.test.js (85-03's own eraseTap/disarmErase suite, unchanged by this plan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Compete OFF is read by one gate (competeIsOn) shared by the board client, both identities and boardSync; boardSync.purge() runs on the OFF transition, making zero network calls thereafter"
    requirement: "ACCT-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-account.test.js (C1) — SOURCE pin for competeIsOn's controller fallback"
        status: pass
      - kind: unit
        ref: "test/unit/boardSync.test.js (85-02) — Compete OFF purge/zero-network behavior, unchanged by this plan"
        status: pass
      - kind: unit
        ref: "test/unit/accountChip.test.js (85-03) — setCompete(false) calls board.purge() once"
        status: pass
    human_judgment: false
  - id: D3
    description: "RETIRE-03: settings.js drops pgsWelcomed/pgsDevSignedIn from SETTINGS_DEFAULTS, adds boardWelcomed in their slot; a stored blob carrying either retired key loses it on the next write while compete survives untouched"
    requirement: "RETIRE-03"
    verification:
      - kind: unit
        ref: "test/unit/settings.test.js (RETIRE-03 tests: the stored-blob-carrying-retired-keys read, the writeSetting write-drops-them test, the pgsWelcomed-is-a-no-op test, the boardWelcomed-persists test)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js (UIF-05) — the 12-field key-order pin"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every non-dev, Compete-ON death reaches our board through boardSync's own durable queue (onRunRecorded -> boardSync.record); flushes on enqueue, resume (visible) and online (forced); boardSync.boot runs the bounded backfill once at launch; the native pause path awaits boardSync.waitForPending()"
    verification:
      - kind: unit
        ref: "test/unit/shell-board.test.js (S1-S6, D1, D2)"
        status: pass
      - kind: unit
        ref: "test/unit/title-music-shell.test.js (9)(10) — the pause path and visibilitychange-ordering pins"
        status: pass
    human_judgment: false
  - id: D5
    description: "The dev row, settings markup and account aria-labels carry no game-service name or sign-on wording; the erase row gets a danger-palette CSS treatment"
    verification:
      - kind: unit
        ref: "test/unit/account-layout.test.js (2)(5), hud-menu-layout.test.js (16)"
        status: pass
      - kind: unit
        ref: "grep -ciE \"pgs|play[ _-]?games|sign(ed|ing)?[ -]?(in|out)\" over settings.js and mazeworld.html — both 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "On the Pixel 7: the ☰ block/title sheet show a rolled @handle with no network at first launch; COMPETE/RE-ROLL/ERASE behave as designed; Compete OFF makes zero board network calls; a Compete-ON death reaches LEADERBOARD; a 2.1.0-cutoff backfill and an offline-then-reconnect death both post correctly"
    verification: []
    human_judgment: true
    rationale: "Device-only checks (airplane mode packet capture, actual Play Console upload/backfill timing, the Pixel 7's own rendering) — deferred to the milestone-close Pixel 7 UAT batch per project convention (deferred UAT protocol)"

# Metrics
duration: ~80min
completed: 2026-09-29
status: complete
---

# Phase 85 Plan 04: The Shell Switch to Our Board Summary

**mazeworld.html's module script now runs our own @handle-and-Compete account and Firebase board end to end (one Compete gate, a shared board fetch, a native/dev-loop identity split, boardSync wired to every death/resume/online/boot/pause trigger) with the entire Phase 67/68 Play Games provider/queue/global-boards block deleted.**

## Performance

- **Duration:** ~80 min
- **Completed:** 2026-09-29
- **Tasks:** 3
- **Files modified:** 12 (1 created, 10 modified, 1 deleted)

## Accomplishments

- **settings.js (RETIRE-03):** `SETTINGS_DEFAULTS` drops `pgsWelcomed`/`pgsDevSignedIn`, adds `boardWelcomed` (default false) in their old slot right after `compete`; the tolerant-merge posture means a stored blob carrying either retired key loses it silently on the next `writeSetting` call, while `compete` keeps its Phase 67 meaning untouched. The dev row's Play Games sign-in group is deleted from the markup (keeps `#mw-dev-perf` and the start-depth controls); a dead CSS spacing rule for that group is deleted with it. New `.mw-acct-action[data-action="erase"]` CSS gives ERASE MY RUNS the danger palette (`button.mw-danger-btn`'s colours) with a stronger `[data-armed="1"]` state. The title chip and the ☰ account host's `aria-label` are now `"Account"`.
- **The module script (ACCT-03/04/05/06, RETIRE-02 shell-out):** `competeIsOn()` is the ONE Compete gate — the board client, `sharedIdentity()` and the new `boardIdentity()` all read it (falling back to the settings mirror only before `account` exists). `boardFetch` is read once and shared by the board client and `boardSync`. `boardIdentity()` returns `sharedIdentity()` on a native platform; in the browser dev loop it creates a SEPARATE identity over the shared dev-loop fetch with every storage key prefixed `"dev."`, so dev-loop board play can never sign up a live account or touch the live bug-report identity. `createBoardSync({...})` replaces the whole retired submission-queue/global-boards block; `account = createAccountController({identity: boardIdentity(), board: boardSync, settings, notify: parkAccountCard, compete})` drives the ☰ block, the title sheet and the ☰ face. `onRunRecorded` calls `boardSync.record(summary)`; the online listener forces a flush; boardSync's own `visibilitychange` listener is kept the FIRST one in the file (the title-music observer is added after it on purpose); `account.boot()` then `boardSync.boot({history: getRunHistory()})` run at launch, neither awaited; the native pause path awaits `boardSync.waitForPending()` alongside the adapter's own.
- **Account surfaces:** COMPETE and RE-ROLL handlers call `event.stopPropagation()` and never close the ☰ (85-CONTEXT "Claude's discretion" — the player sees the new state and can re-roll again); ERASE reads `account.state().erase` before calling `eraseTap()` and raises `hudMenuEvent("select")` only on the confirming (already-armed) tap. A `MutationObserver` on `#mw-hud-menu`'s `data-open` attribute disarms an in-progress erase the instant the ☰ closes by ANY path (row tap, scrim, Escape, Android back). `closeAccountSheet()` calls the same `account?.disarmErase()` for the title sheet's row.
- **Deleted:** the entire Phase 67/68 Play Games provider construction, `createSubmissionQueue`, `createGlobalBoards`, `onRunRecorded`'s old body, `handlePgsFlush`, `notePgsSeasonDrop`, `onAccountForPgs`, and their imports (`playGames.js`, `pgsQueue.js`, `globalBoards.js`, `boardScores.js`). `pendingPgsCard`/`pgsCardTimer`/`parkPgsCard` renamed `pendingPlacementCard`/`placementCardTimer`/`parkPlacementCard` now (not deferred) — 85-05 only has to wire `boardSync`'s `onPlacement` callback into the already-renamed function.
- **Tests:** `test/unit/shell-account.test.js` rewritten (A1-A4, B1, C1, D4, F3, G1 updated; A5/B2/D1/D2/D5/E1-E7/F1/F2 kept verbatim; G2 added for the disarm-on-close `MutationObserver`). `test/unit/shell-pgs.test.js` deleted; `test/unit/shell-board.test.js` created — R1-R10 moved over (R9/R10 updated for the new consumers list and no `S.pgs*` field), new S1-S6 SOURCE pins for `boardSync`'s wiring, D1/D2 BEHAVIOUR for `onRunRecorded` → `boardSync.record`, C1-C6 ported for `parkPlacementCard`/`pendingPlacementCard`. `title-music-shell.test.js` (9)/(10) and `report-sheet-shell.test.js` (D4c) repinned for the new `waitForPending`/`competeOn` wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1: settings.js drops the two retired keys, gains boardWelcomed; the dev row and account markup/CSS** - `42e08e57` (feat)
2. **Task 2: the module script — one Compete gate, board identity/fetch, boardSync, the new account controller and surfaces, death/resume/online/boot/pause wiring** - `6527b1ec` (feat)
3. **Task 3: shell tests — shell-account rewritten, shell-pgs replaced by shell-board, title-music-shell and report-sheet-shell repinned** - `1da8472e` (test)

**Plan metadata:** (this commit, docs only)

## Files Created/Modified

- `src/browser/settings.js` - SETTINGS_DEFAULTS/ALLOWED_VALUES without the two retired keys, with `boardWelcomed`; header/doc comments rewritten
- `test/unit/settings.test.js` - Repinned defaults/key-order tests; the Phase 67 retired-key tests rewritten into RETIRE-03 tests
- `mazeworld.html` - Account aria-labels, the dev row, the erase-row CSS, the whole module-script account/board wiring rewrite, the retired imports/functions deleted
- `test/unit/account-layout.test.js` - (2) aria-label="Account"; (5) rewritten for the game-service-free dev row
- `test/unit/hud-menu-layout.test.js` - (16) aria-label="Account"
- `test/unit/shell-gear-toolbar.test.js` - UIF-05's SETTINGS_DEFAULTS key-order pin repinned (12 fields; deviation, see below)
- `src/browser/bridge.js` - `__mzPlacement`'s registry entry text rewritten for the post-Task-2 consumer set
- `test/unit/shell-account.test.js` - Rewritten (see Deviations/Decisions for the per-test breakdown)
- `test/unit/shell-board.test.js` - New (replaces shell-pgs.test.js)
- `test/unit/shell-pgs.test.js` - Deleted
- `test/unit/title-music-shell.test.js` - (9)(10) repinned for boardSync's waitForPending/visibilitychange ordering
- `test/unit/report-sheet-shell.test.js` - (D4c) repinned for sharedIdentity's `competeOn: competeIsOn`

## Decisions Made

See `key-decisions` in the frontmatter for the full list. Highlights: `competeIsOn()`'s pre-boot fallback to the settings mirror (no TDZ hazard since `account` starts `null`); `boardFetch` read once and shared to keep the dev-loop fake board a single instance; every ACCOUNT handler stops click propagation so COMPETE/RE-ROLL can keep the ☰ open per 85-CONTEXT; the placement-card rename (`parkPgsCard` → `parkPlacementCard`) landed now rather than deferred to 85-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test/unit/shell-gear-toolbar.test.js's SETTINGS_DEFAULTS key-order pin broke from Task 1's settings.js change**
- **Found during:** Task 1's own verification pass (a file outside this plan's declared `files_modified`, not covered by Task 1's own verify command)
- **Issue:** `shell-gear-toolbar.test.js`'s UIF-05 test pinned the OLD 13-key `SETTINGS_DEFAULTS` order including `pgsWelcomed`/`pgsDevSignedIn` by literal array — Task 1's settings.js change (dropping those two keys, adding `boardWelcomed`) broke this pin even though the file is not in 85-04-PLAN.md's `files_modified` list.
- **Fix:** Updated the pinned array to the new 12-key order (`boardWelcomed` replacing the two retired keys) and its comment.
- **Files modified:** test/unit/shell-gear-toolbar.test.js
- **Verification:** `node --test test/unit/shell-gear-toolbar.test.js` passes; confirmed again in the full `npm test` run at plan close (8330 pass, 0 fail)
- **Committed in:** 42e08e57 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, collateral test breakage from an in-scope source change)
**Impact on plan:** No scope creep beyond a one-file test repin forced by Task 1's own settings.js edit; necessary to keep `npm test` green.

## Issues Encountered

One test-authoring correction during Task 3: a new `shell-board.test.js` BEHAVIOUR helper (`runRecordedFns`) initially sliced `onRunRecorded`'s source region up to (but excluding) its own closing brace, using the same `"\n  }"` marker pattern this file's other SOURCE-only regex pins use safely — but this region is *executed* as real JS via `new Function`, so the missing closing brace produced a `SyntaxError: Unexpected token ')'` when run. Fixed by extending the end marker to the next statement after the function (`"\n  window.__mzControls = {"`), matching the pattern the old `pgsFns()` helper already used for the same reason. See `patterns-established` in the frontmatter.

## Old shell-account.test.js / shell-pgs.test.js test disposition

Per this plan's acceptance criteria, every pre-existing test id from both files is accounted for below.

**shell-account.test.js** (rewritten in place; all 23 old ids resolved):

| Old id | Fate |
|---|---|
| A1 | Rewritten — pins the accountChip.js/boardSync.js import lines instead of playGames.js |
| A2 | Rewritten — now pins boardIdentity()'s native/dev-loop split and the shared boardFetch |
| A3 | Rewritten — broadened to check every retired-provider/plugin pattern, not just the npm package name |
| A4 | Rewritten — pins the new createAccountController({identity, board, settings, notify, compete}) call |
| A5 | Kept verbatim |
| B1 | Rewritten — now also pins boardSync.boot() running right after account.boot() |
| B2 | Kept verbatim |
| C1 | Rewritten — now also pins competeIsOn()'s controller-state fallback |
| D1 | Kept verbatim |
| D2 | Kept verbatim |
| D4 | Rewritten — the fake account's handler set is now setCompete/reroll/eraseTap/disarmErase; closeAccountSheet's disarmErase() call is pinned |
| D5 | Kept verbatim |
| E1-E7 | Kept (rail-card-parking logic unchanged); the fixture constant FAILED renamed RANKED (no Play Games wording) |
| F1 | Kept verbatim |
| F2 | Kept verbatim |
| F3 | Rewritten — region start marker updated (no more `const pgsNative =`) |
| G1 | Rewritten — the handler contract changed from onSignIn/onStopCompeting/onCompete (all closing the ☰) to onCompete/onReroll/onErase (only a confirming erase closes it), and every handler now stops the click event's propagation |
| G2 | New — BEHAVIOUR test for the ☰-close MutationObserver's disarmErase() call |

**shell-pgs.test.js** (file deleted; every id's fate below, replaced by shell-board.test.js):

| Old id | Fate |
|---|---|
| R1-R8 | Moved verbatim to shell-board.test.js (the THAT IS THAT rank line's rendering/CSS/bridge-reset behavior is unchanged) |
| R9 | Moved + rewritten — the __mzPlacement consumers list now names onRunRecorded instead of the retired handlePgsFlush |
| R10 | Moved verbatim (still forbids S.placement/S.rank/S.pgs* — remains true) |
| S1 | Deleted — pinned the retired module import lines; superseded by shell-board.test.js's new S1-S6 |
| S2 | Deleted — pinned the four retired `let` declarations and the panel's retired-seam absence (the panel-seam half is already proven by shell-boards-panel.test.js's own H1) |
| S3 | Deleted — pinned createSubmissionQueue/createGlobalBoards construction; superseded by shell-board.test.js's S1 (createBoardSync) and S2 (onRunRecorded/boardSync.record) |
| S4 | Deleted — pinned the retired pgsIds/pgsProvider construction (no longer exists) |
| S5 | Rewritten into shell-board.test.js's new S5 — the pause path's waitForPending now names boardSync |
| S6 | Rewritten into shell-board.test.js's new S6 — checks no retired-module import instead of the plugin package name |
| S7 | Deleted — the SOURCE ordering pin (pendingAccountCard before pendingPgsCard in flushAccountCard) is superseded by the still-present C3 BEHAVIOUR test in both shell-account.test.js and shell-board.test.js, which functionally requires the same account-before-placement order to pass |
| D1-D8 | Deleted — tested the retired handlePgsFlush's rank-line/card-folding logic; that logic now lives inside boardSync.js (already covered by 85-02's boardSync.test.js) and 85-05 wires its onPlacement output into the shell with its own new tests |
| O1-O2 | Deleted — tested the retired notePgsSeasonDrop; boardSync.js's own backfill/season handling is covered by 85-02's boardSync.test.js |
| A1-A5 | Deleted — tested the retired onAccountForPgs Compete-transition logic; the same purge-on-OFF/flush-on-ON behavior now lives inside accountChip.js's createAccountController#setCompete, already covered by 85-03's accountChip.test.js |
| C1-C6 | Moved + rewritten into shell-board.test.js's new C1-C6 — parkPgsCard/PGS_CARD renamed parkPlacementCard/PLACEMENT_CARD, same behavior |

## User Setup Required

None - no external service configuration required. This plan is pure client-side shell wiring, exercised entirely against the fakes 85-02/85-03 already proved boardSync/accountChip against; the browser dev loop's board play runs on `src/browser/fakeBoardServer.js` under a dev-prefixed identity that never touches the live project.

## Human verification (deferred to end of run)

Batched into the milestone-close Pixel 7 checklist (`docs/UAT-v2.2.md`, Phase 86):

1. Fresh install in airplane mode: the title chip and the ☰ show a rolled @handle at once (initials avatar on the ☰ with Compete ON); no sign-in prompt or account popup appears at launch
2. ☰ block: @handle + avatar, COMPETE ON/OFF, RE-ROLL HANDLE, ERASE MY RUNS; RE-ROLL changes the handle in place and can be tapped again; the menu stays open
3. ERASE MY RUNS: the first tap reads TAP AGAIN TO ERASE, it disarms after about 3 s or when the menu closes; the second tap closes the menu and a rail line reports the outcome; with Compete OFF the row is dimmed
4. The title chip opens the sheet with the same rows plus SETTINGS; an erase started on the title reports on the rail once you are in the dungeon
5. Compete OFF with the network on and a per-app capture (PCAPdroid, package com.darktierstudios.delvedierepeat): a full run and a death make zero requests; turning Compete OFF discards queued runs
6. Compete ON: a death appears on LEADERBOARD; a death offline appears after the phone comes back online or the app is reopened
7. An existing 2.1.0 install updated to this build with Compete ON: the runs played on 2.1.0 since its release appear on LEADERBOARD stamped "2.1.0 (11)"; a run played on this build with Compete OFF never appears, even after turning Compete ON and relaunching
8. Backgrounding the app right after a Compete-ON death offline, then relaunching online: the run still reaches the board

## Next Phase Readiness

- 85-05 (the death screen's placement rewrite) can now wire `boardSync`'s `liveHash`/`onAcked`/`onPlacement` options straight into the `createBoardSync({...})` call this plan already has, and hand its deferred rail card to the already-renamed `parkPlacementCard`/`pendingPlacementCard` — no shell scaffolding left to build first.
- 85-06's RETIRE-02 sweep can now delete `src/browser/playGames.js`, `pgsQueue.js`, `globalBoards.js`, `boardScores.js`, `content/leaderboards.js` and their tests outright: this plan proved the shell no longer imports or calls any of them (`grep -ciE "play[ _-]?games|pgs|globalBoards|boardScores|scoreTag" mazeworld.html` is 0).
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/shell-account.test.js test/unit/shell-board.test.js test/unit/title-music-shell.test.js test/unit/report-sheet-shell.test.js test/unit/shell-boards-panel.test.js test/unit/shell-boards-entry.test.js test/unit/hud-menu-layout.test.js test/unit/account-layout.test.js test/unit/stale-terms.test.js test/unit/voice-corpus.test.js` — 188 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8330 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity` is empty.
**Acceptance-criteria greps:** all Task 1/2/3 greps in 85-04-PLAN.md pass (verified individually during execution).

---
*Phase: 85-play-games-out-our-board-in*
*Completed: 2026-09-29*

## Self-Check: PASSED

All created/modified files found on disk (src/browser/settings.js, mazeworld.html, src/browser/bridge.js, test/unit/shell-board.test.js, test/unit/shell-account.test.js, this SUMMARY.md); test/unit/shell-pgs.test.js confirmed deleted; all three task commits (42e08e57, 6527b1ec, 1da8472e) found in `git log`.
