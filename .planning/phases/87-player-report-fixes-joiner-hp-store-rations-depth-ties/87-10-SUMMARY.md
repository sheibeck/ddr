---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 10
subsystem: boards
tags: [leaderboards, css, safe-area, bottom-sheet, BOARD-30]
requires:
  - phase: 87-09
    provides: "the FILTER LIKE THIS row menu, which reuses the .mw-lb-sheet classes"
provides:
  - "every .mw-lb-sheet option list clears the bottom system inset on the title-opened panel"
  - "the BOARD-30 CSS pin"
affects: []
tech-stack:
  added: []
  patterns:
    - "the house inset idiom var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) applied once per layout chain"
key-files:
  created: []
  modified:
    - mazeworld.html
    - test/unit/leaderboard-css.test.js
key-decisions:
  - "The inset is applied exactly once along each entry path. Base rule adds it (title-opened panel, where the tab bar is hidden and nothing else pads it); an in-game override resets to the plain 26px because the tab bar below the stage already pads it."
requirements-completed: [BOARD-30]
duration: ~15 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 10: leaderboard sheets clear the navigation bar (BOARD-30) Summary

**One CSS rule change: `.mw-lb-sheet-opts` now pads its bottom by `calc(26px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))`, so WILMST and its rule line clear the navigation bar on the title-opened panel, and the list still scrolls inside the capped panel. CSS only: no engine, server, JS module or animation change.**

## Layout-chain finding

- Every sheet (RANK BY, RACE, SUB-CLASS, and the 87-09 FILTER LIKE THIS menu) is built by the one sheet builder in `src/browser/leaderboardPanel.js` (`mw-lb-sheet-panel` > `mw-lb-sheet-opts`). One options class, so one rule covers all four.
- `.mw-lb-sheet` is `position:absolute; inset:0` inside `.mw-lb` (`height:100%`), so its bottom edge is the bottom edge of `.mw-lb`, and it covers the dock. `#screen-dead` zeroes its own bottom padding.
- **In-game (DEAD tab):** `.mw-lb` lives in `#mw-screens` inside `.mw-stage`; `#mw-tabbar` is a flex sibling below the stage and already pads `8px + safe-area-inset-bottom`. The sheet's bottom is above the tab bar, so the inset is already applied once, by the tab bar.
- **Title-opened panel:** `body[data-boards-entry="title"] #mw-tabbar{display:none}` (and the rail and HUD are hidden), so nothing between the sheet and the screen edge pads the inset. The dock pads it for itself, but the sheet covers the dock. This is where the option list ran under the navigation bar.
- Fix: the base `.mw-lb-sheet-opts` rule adds the inset (covers any host that does not pad it, including the title path); `body:not([data-boards-entry]) .mw-lb-sheet-opts{padding-bottom:26px}` resets it in-game so the inset is not applied twice (would leave a 24 to 48px dead band above the tab bar). Panel `max-height:78%` and `flex:1; min-height:0; overflow-y:auto` are unchanged, so at the largest text scale the list scrolls rather than growing past the screen. No content-driven height problem was found, so the panel rule was not touched.

## Task commits

| Task | Commit | Notes |
|------|--------|-------|
| 1 | `0c17c167` | CSS rule, in-game override, BOARD-30 pin (TDD: pin written first, failed, then passed) |

## Deviations from Plan

The plan's grep acceptance (`.mw-lb-sheet-opts{...calc(26px + ...)}` count 1) holds for the base rule. The plan allowed the inset to be added only where missing; the additional `body:not([data-boards-entry]) .mw-lb-sheet-opts{padding-bottom:26px}` line is that provision applied (in-game path already padded by the tab bar), pinned in the same test. No other deviations.

## Tests

- `node --test test/unit/leaderboard-css.test.js test/unit/leaderboardPanel-dom.test.js test/unit/reduced-motion.test.js`: 76 pass / 0 fail.
- Full `npm test`: 8172 tests, **8170 pass / 0 fail / 2 skipped** (baseline after 87-09: 8169 pass; +1 new BOARD-30 pin).
- No fixtures regenerated, no engine change. `git diff --stat` for `src/ engine/ firebase/ tools/` is empty. No bot runs, no live backend actions. Commit trailers present on the task commit.

## Known Stubs

None.

## Threat Flags

None.

## Human verification (deferred to end of run)

- [ ] Leaderboards, tap RANK BY (opened from the title screen AND from the in-game DEAD tab): WILMST and its description sit fully above the navigation bar with gesture navigation on the Pixel 7.
- [ ] Same check with 3-button navigation.
- [ ] Settings text size at its largest: RANK BY, RACE and SUB-CLASS sheets still show, or scroll to, their last option in full (WILMST and its rule line visible, both navigation modes).
- [ ] The FILTER LIKE THIS menu (BOARD-29, long press on a row) shows CANCEL in full above the navigation bar.
- [ ] In-game DEAD tab: no visible extra dead band between the last option and the tab bar (confirms the inset is applied once).

## Self-Check: PASSED

- mazeworld.html contains the new rule and the in-game override; test/unit/leaderboard-css.test.js contains the BOARD-30 pin; commit 0c17c167 exists.
