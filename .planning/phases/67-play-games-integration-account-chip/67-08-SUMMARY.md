---
phase: 67-play-games-integration-account-chip
plan: 08
subsystem: browser-shell / Play Games account wiring
status: complete
tags: [account, play-games, shell, rail, back-button, leaderboards, debug-apk]
requires:
  - src/browser/playGames.js createPlayGames / createFakePlayGames (67-02)
  - src/browser/settings.js compete / pgsWelcomed / pgsDevSignedIn (67-02)
  - src/browser/boardsPanel.js identity() seam (67-04)
  - mazeworld.html chip, sheet and dev-row markup (67-05)
  - the vendored plugin and APP_ID placeholder (67-06)
  - src/browser/accountChip.js renderers and createAccountController (67-07)
provides:
  - the running shell's Play Games account (both chips, the sheet, the rail cards, the Leaderboards identity strip, the non-blocking launch sign-in)
  - docs/SHELL-MODULES.md "Play Games account (Phase 67)" section
  - test/unit/shell-account.test.js
  - the phase's last-wave debug APK
affects:
  - Phase 68 (reads Compete from the settings mirror; subscribes to the same controller)
  - Phase 69 (the device batch in docs/UAT-v2.0.md)
tech-stack:
  added: []
  patterns: [module-scope controller declared before its first consumer (TDZ-safe seam), presentation-only card parking with a visibility predicate, microtask-deferred flush after same-tap screen changes]
key-files:
  created:
    - test/unit/shell-account.test.js
  modified:
    - mazeworld.html
    - docs/SHELL-MODULES.md
    - test/unit/shell-boards-entry.test.js
    - test/unit/shell-boards-panel.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-map-viewport.test.js
decisions:
  - "The flush at hideTitleScreen and at the roller's onCommit is deferred one microtask: ENTER opens the roller and VIEW THE DEAD opens the title-mode panel in the same tap right after hideTitleScreen(), and the roller hides its own screen only after onCommit returns"
  - "accountSheetOpen() is one helper, read by both getGameContext's hasOpenModal and closeModal's first statement"
  - "closeAccountSheet() keeps the settings sheet's mzKeepPartyInView call, so the pinned keep-in-view call-site count moves from 7 to 8"
metrics:
  duration: ~45 min
  completed: 2026-09-24
  tasks: 2
  files: 7
---

# Phase 67 Plan 08: Wire the Play Games account into the shell Summary

The shell now builds the Play Games provider by platform: the real plugin wrapper on native, and the dev-seeded in-memory fake in the browser. It runs one account controller whose launch sign-in starts after the title is set up and is never awaited. Both chips and the Leaderboards identity strip update on every account change. The account sheet opens from either chip, and the two account cards reach the rail only once the map is showing.

## What shipped

**Task 1: module wiring (mazeworld.html, commit 06dbc5f)**
- **Imports.** `playGames.js` and `accountChip.js` each have their own import line after the Phase 66 lines. The pinned engineAdapter line is byte-identical.
- **D-08 identity.** `let account = null;` is declared before the Leaderboards panel instance. `createBoardsPanel({ ..., identity: () => (account ? account.identity() : { signedIn: false, player: null }) })`.
- **D-12 provider.** `pgsNative = !!window.Capacitor?.isNativePlatform?.()`. Native gets `createPlayGames()`, and the browser gets `createFakePlayGames({ signedIn: currentSettings?.pgsDevSignedIn === true })`. The seed is read once, after `applySettings(await readSettings())`. The shell never names the plugin package.
- **Controller.** `account = createAccountController({ provider: pgsProvider, settings: { read: readSettings, write: writeAccountSetting }, notify: parkAccountCard })`. `writeAccountSetting` awaits `writeSetting`, then calls `applySettings(next)`, so the settings mirror stays coherent for Phase 68.
- **Chips (D-05..D-07).** `renderAccountChips()` renders `account.chipView()` into both `#mw-acct-chip` and `#mw-title-acct-chip`. It runs once before boot (the pending face) and on every account change. Each change also re-renders the sheet when it is open and calls `boardsPanel.refresh()`.
- **Sheet (D-09/D-10).** `openAccountSheet({ fromHud })` refuses on the HUD chip while `window.__mzState && hasActiveEncounter()`, then renders the sheet view and calls `panelMotion.open`. The rows call `signIn`, `stopCompeting` and `setCompete(v)`. Settings calls `closeAccountSheet()` and then `openSettingsSheet()`. `closeAccountSheet()` calls `panelMotion.close`, then `mzKeepPartyInView`. The scrim and Close are wired to it.
- **Cards (D-04/D-11).** `dungeonVisible()` is true only when the title screen and the roller are hidden and the body is not in boards title mode. `parkAccountCard` stores the latest card and tries a flush. `flushAccountCard` clears the slot, then calls `window.mzRailLine?.(card.title, card.line, card.tone, card.hold)`. It is flushed from `hideTitleScreen` (microtask), the roller's `onCommit` (microtask) and routeFromBoards' dungeon branch (direct). Nothing modal, no toast.
- **Android back button.** `accountSheetOpen()` is ORed into `hasOpenModal`, and closeModal's first statement is `if (accountSheetOpen()) { closeAccountSheet(); return; }`, ahead of the Phase 66 boards branch and the ☰ escape.
- **Boot (D-01/D-02).** `account.boot().catch(() => {});` runs directly after the initTitleScreen IIFE and is not awaited. With Compete OFF the controller calls no provider method (proven by 67-07's Proxy test).
- **Unchanged.** No new `window.__mz` name. The ☰ menu markup, HUD_MENU_ITEMS and the four legacy listener lines are untouched.

**Task 2: docs, tests, APK (commit ed58654)**
- `docs/SHELL-MODULES.md`: the intro names `playGames.js`, `account.js` and `accountChip.js`. A new "### Play Games account (Phase 67)" section after the Leaderboards panel section covers the seam, the view model, the controller and the shell wiring, and states that no new bridge was added. `node tools/bridge-doc.mjs --check` exits 0.
- `test/unit/shell-account.test.js`: 23 tests. They cover:
  - source pins: imports, provider selection, plugin name absent, controller wiring, boot order and no await, subscribe fan-out, the `let account` order and the identity seam, chip and scrim listeners, the back button, and the three flush sites;
  - region-evaluated behaviour: `writeAccountSetting` ordering; sheet open/refuse, row routing and Settings order; card parking (title, latest-wins, delivered once, null, boards title mode, roller, direct delivery); and the ENTER-then-roller microtask case;
  - cross-checks: every `ACCOUNT_CLASSES` entry has a CSS rule, the ☰ menu is unchanged, and there is no bridge assignment and no network call.
- **Debug APK:** `npm run android:debug` exited 0 (`BUILD SUCCESSFUL in 3m 28s`, 304 actionable tasks, including `:modbender-capacitor-play-games:assembleDebug`). The output is `C:\projects\mazeworld\.claude\worktrees\agent-a9482151f445fadec\android\app\build\outputs\apk\debug\app-debug.apk` (11,786,261 bytes). `android/gradle.properties` is unchanged. `cap sync` touched only the line endings of `android/app/capacitor.build.gradle` and `android/capacitor.settings.gradle` (the content diff was empty), and both were restored with `git checkout --`. `android/local.properties` was copied from the main checkout and is not committed. There was no device install and no release/AAB build.

## Verification

- `node --test test/unit/hud-menu-layout.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js test/unit/shell-no-content-copies.test.js test/unit/account-layout.test.js` passes.
- `node --test test/unit/shell-account.test.js test/unit/shell-boards-entry.test.js test/unit/shell-boards-panel.test.js` passes (23 + 32).
- `node tools/bridge-doc.mjs --check` exits 0.
- `npm test`: 4691 tests, 4684 pass, 7 fail. The 7 are the known pre-existing CRLF doc-ledger failures (class-pass-ledger 979/980/981/989 and flee-ledger 1744/1745/1746), so the failing set did not grow.
- Acceptance greps: each import line appears once, `notify: parkAccountCard` 1, `account.boot().catch(` 1, `function flushAccountCard` 1, `identity: () =>` 1, and the pinned engineAdapter line 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The flush is deferred one microtask at hideTitleScreen and the roller's onCommit**
- **Found during:** Task 1
- **Issue:** `roller.commit()` calls `onCommit(state)` before it hides `#mw-roller-screen`, so a direct flush there would always see the roller up and never deliver. Likewise, ENTER calls `hideTitleScreen()` and then `window.mzStartRoll()`, and VIEW THE DEAD calls `hideTitleScreen()` and then `openFromTitle()`. A direct flush in hideTitleScreen would have delivered the card just before the roller or the title-mode panel covered the map, which breaks D-04/D-11.
- **Fix:** Both sites call `queueMicrotask(flushAccountCard)`. routeFromBoards' dungeon branch flushes directly, because the panel has already cleared its marker. Test E7 covers this.
- **Files modified:** mazeworld.html
- **Commit:** 06dbc5f

**2. [Rule 3 - Blocking] Existing pins moved by the new wiring (updated in the Task 1 commit so every commit is green)**
- `test/unit/shell-boards-entry.test.js`: B1 now pins the boards branch as the first statement after the Phase 67 account-sheet branch. The closeModal factory threads the `accountSheetOpen`/`closeAccountSheet` seams, which default to a closed sheet. This was planned for Task 2 and moved to Task 1's commit.
- `test/unit/shell-boards-panel.test.js`, not in the plan's file list: the routeFromBoards factory threads `flushAccountCard`, and E3 expects it after `surfaceWornReconcile`.
- `test/unit/shell-map-store-polish.test.js` and `test/unit/shell-map-viewport.test.js`, not in the plan's file list: the `mzKeepPartyInView` call-site count moves from 7 to 8 for `closeAccountSheet()`, which the plan specifies. A comment was added.
- **Commit:** 06dbc5f

**3. [Worktree artifact] docs/SHELL-MODULES.md was saved with LF endings**
- With the CRLF working copy, `node tools/bridge-doc.mjs --check` reported a table mismatch. The content was identical and the difference was only line endings. The working file was normalized to LF, and the index stays LF as before.

## TDD Gate Compliance

Task 2 is `tdd="true"`, but its subject (the Task 1 wiring) had already landed in the Task 1 `feat` commit, as the plan's task order requires. So `shell-account.test.js` was written against existing code and passed on its first run: there is no RED commit. The behaviour tests evaluate the exact shipped source, and E7 fails if the hideTitleScreen flush is made synchronous.

## Known Stubs

None. The native APP_ID is still the 67-06 placeholder (`000000000000`), so on a device native sign-in fails gracefully until the user's console setup (docs/PLAY-GAMES-SETUP.md). This is planned, not a stub.

## Flagged assumptions (carried from the plan)

- A card raised during combat is handed to the rail as usual, and the rail's own combat hiding decides whether it is seen before it expires. Both cards come from boot, a Compete toggle or a Sign in tap, and the HUD chip cannot open mid-fight, so only a slow launch attempt can land here.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md), on the Pixel 7, using the debug APK above or a rebuild from master. Do not pause for a device:

1. The band-2 chip sits left of ☰ and the title chip sits in the top-right corner. At first launch, with the placeholder APP_ID, both show the nobody glyph, and one "PLAY GAMES DID NOT ANSWER" rail card appears after ENTER (not over the title or the roller).
2. After the console setup, auto sign-in on a tester account shows the initials on both chips, the welcome card once, and the Leaderboards strip with PLAY GAMES · SIGNED IN.
3. Declining the interactive Sign in (the sheet's Sign in row, then cancel) shows the failure card and nothing modal.
4. With no Play Games profile on the device, the game is fully playable.
5. Stop competing flips both chips and the strip to nobody. With Compete OFF, a cold boot makes no Play Games leaderboard or sign-in traffic from the game (capture). Google's SDK init at launch is expected per D-20.
6. The account sheet's Settings row, opened from the title chip, opens the settings sheet above the title screen.
7. The Android back button closes the account sheet first, whether it sits over the title, the title-mode Leaderboards panel or the map.
8. The band-2 chip is ignored during combat (and any encounter); the title chip is unaffected.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 06dbc5f | feat(67-08): wire the Play Games account into the shell |
| 2 | ed58654 | test(67-08): pin the shell account wiring and document the Play Games account |

## Self-Check: PASSED

- FOUND: test/unit/shell-account.test.js
- FOUND: docs/SHELL-MODULES.md section "Play Games account (Phase 67)"
- FOUND: android/app/build/outputs/apk/debug/app-debug.apk
- FOUND: 06dbc5f, ed58654
