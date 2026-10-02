---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 09
subsystem: boards
tags: [leaderboards, long-press, filter-menu, talkback, BOARD-29]
requires:
  - phase: 84-07
    provides: "createLeaderboardPanel controller, RACE/SUB-CLASS sheet picks"
  - phase: 71-04
    provides: "createLongPress recognizer (HOLD_MS, travel cancel, one-shot click suppression)"
provides:
  - "row.who / row.race / row.sub / row.filterLabel on every YOUR DEAD and LEADERBOARD row"
  - "the 'row' sheet (FILTER BY race / sub-class / both + CANCEL) built from validated content ids"
  - "controller openRowMenu(key), onRowMenu, menu state, picker focus after a filter pick"
  - "shell boardRowLongPress wiring on #screen-dead"
affects: [87-10]
tech-stack:
  added: []
  patterns:
    - "one shared window capture click suppressor asks every long-press recognizer (each reports true only for its own fired press)"
    - "TalkBack announcement by moving focus to the changed picker instead of a sixth skeleton section"
key-files:
  created:
    - test/unit/board-row-menu-shell.test.js
  modified:
    - content/boards.js
    - src/browser/leaderboardView.js
    - src/browser/leaderboardPanel.js
    - mazeworld.html
    - test/unit/leaderboardView.test.js
    - test/unit/leaderboard-copy.test.js
    - test/unit/leaderboardPanel.test.js
    - test/unit/leaderboardPanel-dom.test.js
    - test/unit/leaderboard-css.test.js
key-decisions:
  - "The TalkBack announcement is focus movement: after any RACE or SUB-CLASS filter pick (row menu and the existing sheets alike) focus moves to the changed picker (race for race or both, sub for sub), so TalkBack reads e.g. 'RACE, DWARVEN'. No sixth skeleton section; the five-section pin stays."
  - "The row filter menu validates twice: the view-model drops any race/sub that is not a RACE_IDS/SUB_IDS id, and the controller re-validates when it builds the menu and again on every pick (a forged option value is ignored, the menu stays open)."
  - "The board-row trailing-click suppression is folded into the foe block's single window click listener (foeLongPress.consumeClick() then boardRowLongPress.consumeClick()) because ui-tap-shell pins exactly one window click listener."
requirements-completed: [BOARD-29]
duration: ~45 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 09: leaderboard row race/sub-class detail and long-press filter menu (BOARD-29) Summary

**An expanded leaderboard row now states "Dwarven · Wizard (Magic User)", and a long press on any row (YOUR DEAD or LEADERBOARD) opens a FILTER LIKE THIS sheet with FILTER BY race, sub-class, both, and CANCEL; picking one filters the board exactly like a RACE or SUB-CLASS sheet pick and puts TalkBack focus on the changed picker. A FILTER LIKE THIS button inside the detail reaches the same menu without the gesture. Shell-only: no engine, server or firebase/ change.**

## What was built

- **Copy** (`content/boards.js`): `LEADERBOARD_COPY.who` and a frozen `rowMenu` group (title, open, race, sub, both, cancel, one-line sub-lines in the house voice).
- **View-model** (`src/browser/leaderboardView.js`): every row carries `who` (built from content-validated ids; an unknown race or sub-class is dropped from the line, "" when neither is known), `race`, `sub` (a known id or null) and `filterLabel`. `leaderboardView` accepts `sheet: "row"` with `menu: { race, sub }` and builds options race, sub, both, cancel from the validated values only; null when nothing validates.
- **Renderer/controller** (`src/browser/leaderboardPanel.js`): `.mw-lb-detail-who` (first child of the detail) and a `.mw-lb-detail-filter` button (stops propagation, never toggles the row). Controller: `openRowMenu(key)`, `handlers.onRowMenu`, `menu` state (in `state()`), the `"row"` branch of `onSheetPick`, a shared `applyFilterPick` tail (re-query on LEADERBOARD, local re-filter on YOUR DEAD, body scroll reset) and `focusPicker` (try/catch, courtesy only). `menu` clears wherever `sheet` clears (close, back, every pick, view switch, every open).
- **Shell** (`mazeworld.html`): `boardRowLongPress` (createLongPress, injected timers, light haptic then `boardsPanel.openRowMenu(key)`), pointerdown on `#screen-dead` arming only on `.mw-lb-row[data-key]`, document capture move/up/cancel/scroll, contextmenu prevented on rows, `.mw-lb-row` no-callout/no-select, CSS for the two new classes (44px filter button, text-scale font sizes, no animation). No new `window.__mz` name.

## Task commits

| Task | Commit | Notes |
|------|--------|-------|
| 1 | `bc021aee` | view-model, copy, pins |
| 2 | `37d3e19b` | renderer, controller, CSS, pins |
| 3 | `f700a4a8` | shell long press, board-row-menu-shell.test.js |
| 3 (follow-up) | `0106c325` | fold click suppression into the one window listener (see deviation) |

## Moved pins (before/after)

No existing assertion needed rewriting; the deep-equal pins on rows and `state()` did not exist in a form the new fields broke. Additions only:

| Pin | Before | After |
|-----|--------|-------|
| `leaderboard-copy.test.js` TOKEN_PATHS | 11 token leaves | + `who`, `rowMenu.race/sub/both`, `rowMenu.raceLine/subLine` (bothLine, cancelLine token-free) |
| `leaderboard-css.test.js` 44px list | 8 selectors | + `.mw-lb-detail-filter` |
| `leaderboardPanel-dom.test.js` kitchen-sink class walk | rows without who/filter | row now carries who and filterLabel, so both new classes are walked against LEADERBOARD_CLASSES |
| `LEADERBOARD_CLASSES` | 64 names | + `mw-lb-detail-who`, `mw-lb-detail-filter` |
| `state()` | 9 keys (entry, mode, stat, race, sub, open, sheet, hasHero, dead) | + `menu` |

No engine fixture, parity file or bot fixture moved (engine untouched). `git diff --stat 14a581e7 HEAD -- engine/ firebase/ src/browser/runDoc.js tools/` prints nothing.

## Deviations from Plan

**1. [Rule 3 - Blocking] One window click listener, not two**
- **Found during:** Task 3 full `npm test`
- **Issue:** the plan's "window capture-phase click suppressor" for the board row added a second `window.addEventListener("click"`, which `ui-tap-shell.test.js` ("71-04's suppressor is still on window", pins exactly one) and `foe-inspect-shell.test.js` (first-occurrence slice) forbid.
- **Fix:** the foe block's single listener now reads `if (!foeLongPress.consumeClick() && !boardRowLongPress.consumeClick()) return;` (each recognizer reports true only for its own fired press, so at most one swallows a click); the board-row block sits after the foe block so the foe pin's first-occurrence slice is unchanged; `board-row-menu-shell.test.js` pins the shared listener. `grep -c "boardRowLongPress.consumeClick()" mazeworld.html` is 1 as the plan requires.
- **Files modified:** `mazeworld.html`, `test/unit/board-row-menu-shell.test.js`
- **Commit:** `0106c325`

**2. [Minor] Picker lookup without an attribute selector**
- `focusPicker` finds the picker via `host.querySelectorAll(".mw-lb-picker").find(b => b.dataset.picker === id)` rather than `.mw-lb-picker[data-picker="…"]`, because the recording DOM harness supports only `#id`, `.class`, tag and `:scope > tag` selectors (an unsupported selector throws by design). Same behaviour in the WebView.

**3. [Minor] Shell test drives the real recognizer**
- The recording DOM's `addEventListener` is a no-op, so `board-row-menu-shell.test.js` drives the real `createLongPress` (fake clock) against the real controller for the hold/tap/move behaviour and pins the listener wiring as source regions, the same split `foe-inspect-shell.test.js` uses.

The one plan acceptance line `grep -c "openRowMenu" src/browser/leaderboardPanel.js` (at least 2) is met via the header comment plus the API entry (the function itself is `openMenu`, exported as `openRowMenu`).

Trailers: every commit carries both the Co-Authored-By and Claude-Session lines.

## Verification

- Full `npm test`: **8169 pass / 0 fail / 2 skipped** (8171 tests; baseline 8147 pass after 87-07).
- Targeted: leaderboardView, leaderboard-copy, voice-corpus, safety-scan, leaderboardPanel, leaderboardPanel-dom, leaderboard-css, shell-boards-panel/-entry, board-row-menu-shell, foe-inspect-shell, ui-tap-shell, bridge-registry, reduced-motion all green.
- No bot balance runs, no live backend action.

## Threat model

- T-87-12 (row race/sub feeding the filter): mitigated in three places (view-model `normRace`/`normSub`, controller menu build against `RACE_IDS`/`SUB_IDS`, and the pick handler ignoring any value the menu does not carry); pinned by tests that inject forged option values and junk race/sub strings.
- T-87-13 (XSS): who line and menu labels go through `textContent` only; the leaderboardPanel source pin (no HTML-string assignment) stays green, and a hostile who line test renders as text.

## Known Stubs

None.

## Threat Flags

None.

## Human verification (deferred to end of run)

1. [ ] Leaderboards, ALL and ME: tap a row open; the detail shows e.g. "Dwarven · Wizard (Magic User)" with a FILTER LIKE THIS button.
2. [ ] Long-press a row: a light haptic, the FILTER LIKE THIS sheet rises, and the row does not open or close.
3. [ ] Pick "FILTER BY <RACE> <SUB-CLASS>": the RACE and SUB-CLASS pickers show both values and the board reloads; on another press pick CANCEL: nothing changes.
4. [ ] Start a long press and scroll the list: no menu opens. Text on the row does not get selected and no Android context menu appears.
5. [ ] With TalkBack on: open a row, activate FILTER LIKE THIS, pick a filter; TalkBack reads the new RACE or SUB-CLASS value. The back button closes the menu.
6. [ ] Foe long-press in combat (Phase 71) still opens the foe card and still swallows its trailing click (shared click suppressor).

## Self-Check: PASSED

- content/boards.js, src/browser/leaderboardView.js, src/browser/leaderboardPanel.js, mazeworld.html, test/unit/board-row-menu-shell.test.js: present.
- Commits bc021aee, 37d3e19b, f700a4a8, 0106c325: present in git log.
