---
phase: 101-play-games-achievements-mirror
plan: 04
subsystem: shell-ui, play-games
tags: [play-games, achievements, sheet-button, compete-gate, layout-check]
requires:
  - phase: 101-03
    provides: achievementMirror (showAchievements, Compete-gated) in the shell
  - phase: 100-in-game-achievements-unlock-toasts-the-list
    provides: the ACHIEVEMENTS sheet and ACHIEVEMENTS_SHEET_COPY
provides:
  - "ACHIEVEMENTS_SHEET_COPY.play.view and .failed, registered in the safety-scan authored-string walk"
  - "mazeworld.html: #mw-achievements-play row (markup, five CSS rules, wiring) at the top of the ACHIEVEMENTS sheet"
  - "tools/layout-check.mjs: the row (and its failure line) shown and measured in 12 profiles and 7 boundary probes"
  - "docs/SHELL-MODULES.md: Play's screen opens from the sheet button, not a menu row"
affects: [101-05, 101-06]
tech-stack:
  added: []
  patterns: ["button wiring as a second labelled block after the pinned mirror block, with its own named account subscriber", "layout check shows the optional row with its widest content before measuring"]
key-files:
  created: []
  modified:
    - src/browser/achievementsSheet.js
    - test/voice/safety-scan.test.js
    - mazeworld.html
    - test/unit/play-achievements-shell.test.js
    - tools/layout-check.mjs
    - docs/SHELL-MODULES.md
    - test/unit/achievements-shell-a11y.test.js
key-decisions:
  - "The button wiring lives in its own block right after account.subscribe(onAccountForMirror), outside the pinned mirror block span (orchestrator rule), with its own named account subscriber"
  - "The layout check shows the failure line too, so the measurement is the row's widest case, and it fails (not skips) when the button is not visible"
requirements-completed: [AUI-04]
status: complete
completed: 2026-10-05
---

# Phase 101 Plan 04: VIEW IN PLAY GAMES button Summary

The ACHIEVEMENTS sheet now carries a VIEW IN PLAY GAMES button between its head and its scrolling list, present only while Compete is ON and Play sign-in is "in"; a tap opens Play's own achievements screen through the Compete-gated mirror, and a failed open reads as one deadpan line while the in-game list stays put.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 0137f522 | ACHIEVEMENTS_SHEET_COPY.play (view, failed) and the safety-scan registration test (RED first, then copy) |
| 2 | 4af26b17 | row markup, five CSS rules, import line, button wiring, shell anchors and harness |
| 3 | c7d1021d | layout check shows and measures the row; SHELL-MODULES.md sentence and section; declared pin update |

## Final copy strings (verbatim)

- Button label: `VIEW IN PLAY GAMES`
- Failure line: `Play Games would not open. Your achievements are all still here, taking themselves very seriously.`

Both live in `ACHIEVEMENTS_SHEET_COPY.play` (already a voice-corpus bank and walked by the safety scan; no registry edit). `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints 0. `ACCOUNT_COPY.sheet.onHelp` was already in the walk with the Play Games clause and is named in the new test.

## How it behaves

- Markup: `div#mw-achievements-play.mw-achievements-play[hidden]` holding `button#mw-achievements-play-btn` (no text in markup) and `span#mw-achievements-play-note[role=status][hidden]`; the sheet markup still carries only the Close label as text.
- Visibility: `competeIsOn() === true && account.state().signin === "in"`, synced once at wiring and on every account change through `account.subscribe(syncPlayAchievementsButton)`. Re-syncing hidden also clears the note.
- Tap: ignored while one is in flight; clears the note; `await achievementMirror.showAchievements()` (the only `.showAchievements(` call in the shell); any answer that is not ok and not reason `off` (or a throw) writes the failure line with `textContent` and unhides the note; the in-flight flag clears in a finally. With Compete OFF behind the button's back the mirror answers `off` and the note stays silent.
- CSS (end of the ACHIEVEMENTS block): five rules; button min-height 48px, no animation or transition, font sizes scaled rems via `--mw-text-scale`, no media query, no vh or dvh, explicit `[hidden]` rules.

## Tests (targeted only; no full suite, no bots, no Gradle)

| File | Tests | Pass |
|------|-------|------|
| test/voice/safety-scan.test.js (+1 Phase 101 copy test) | 13 | 13 |
| test/unit/achievements-sheet-model.test.js | 23 | 23 |
| test/unit/achievements-sheet-view.test.js | 24 | 24 |
| test/unit/achievements-sheet-render.test.js | 21 | 21 |
| test/unit/voice-corpus.test.js | 29 | 29 |
| test/unit/play-achievements-shell.test.js (was 26; +4 anchors, +10 harness, +1 docs) | 41 | 41 |
| test/unit/achievements-sheet-shell.test.js | 22 | 22 |
| test/unit/achievements-shell-a11y.test.js | 18 | 18 |
| test/unit/notes-sheet-shell.test.js | 15 | 15 |
| test/unit/text-scale.test.js | 12 | 12 |
| test/unit/layout-shell.test.js | 30 | 30 |
| test/unit/layout-check.test.js | 5 | 5 |
| test/unit/reduced-motion.test.js | 22 | 22 |
| test/unit/shell-board.test.js | 33 | 33 |
| test/unit/shell-account.test.js | 26 | 26 |
| test/unit/achievement-banner-shell.test.js | 35 | 35 |
| test/unit/shell-no-content-copies.test.js | 6 | 6 |
| test/unit/bridge-registry.test.js | 10 | 10 |
| test/unit/shell-tab-snapshots.test.js | 11 | 11 |
| test/unit/compliance-docs.test.js | 15 | 15 |
| test/unit/stale-terms.test.js | 6 | 6 |

The plan's final verification set (safety-scan, play-achievements-shell, achievements-sheet-shell, achievements-shell-a11y, text-scale, layout-shell, layout-check, shell-tab-snapshots, stale-terms): 158 of 158. No shell snapshot moved.

## Layout check (`npm run layout:check`, exit 0, first run; Chrome available)

| Profile | Size | Class | Scenes passed / run | Verdict |
| --- | --- | --- | --- | --- |
| phone-portrait | 412x915 | compact | 18 / 18 | PASS |
| phone-landscape | 915x412 | short | 18 / 18 | PASS |
| phone-landscape-360 | 800x360 | short | 18 / 18 | PASS |
| tablet7-portrait | 600x960 | medium | 18 / 18 | PASS |
| tablet7-landscape | 960x600 | expanded | 18 / 18 | PASS |
| tablet10-portrait | 800x1280 | medium | 18 / 18 | PASS |
| tablet10-landscape | 1280x800 | expanded | 18 / 18 | PASS |
| foldable-folded | 411x797 | compact | 18 / 18 | PASS |
| foldable-unfolded | 841x701 | expanded | 18 / 18 | PASS |
| foldable-unfolded-portrait | 701x841 | medium | 18 / 18 | PASS |
| chromebook-window | 1366x768 | expanded | 18 / 18 | PASS |
| chromebook-half | 683x768 | medium | 18 / 18 | PASS |

| Boundary probe | Expected | html[data-mw-layout] | Open sheet | Verdict |
| --- | --- | --- | --- | --- |
| 915x479 | short | short | PASS | PASS |
| 915x480 | expanded | expanded | PASS | PASS |
| 599x900 | compact | compact | PASS | PASS |
| 600x900 | medium | medium | PASS | PASS |
| 839x900 | medium | medium | PASS | PASS |
| 840x900 | expanded | expanded | PASS | PASS |
| 840x479 | short | short | PASS | PASS |

12/12 profiles, 7/7 probes. The achievements scene and each probe show the row and its failure line first, then require the button visible, inside the window, at least 48px tall, above the body's top, reading the label, with the body still scrolling vertically and never sideways. A screenshot of phone-portrait was eyeballed: label, note and list read cleanly.

## Declared pin updates

- `test/unit/achievements-shell-a11y.test.js`, "docs: the Phase 101 contract is stated": the assertion on the old "Play row sits beside the ACHIEVEMENTS row" sentence became an assertion that the Phase 100 list section contains "VIEW IN PLAY GAMES button at the top of this sheet" and does not say "Play row sits beside"; the title now names the user's ruling. Stricter, not looser.
- No other existing test file was edited except `test/unit/play-achievements-shell.test.js` (this plan's own file; the factory gained the `ACHIEVEMENTS_SHEET_COPY` parameter and a fake `getElementById`, and the plan 101-03 tests all still pass).

## Deviations from Plan

1. **[Placement, orchestrator rule] Button wiring sits after the pinned mirror block, not inside it.** The plan said "inside the Phase 101 block, before `account.subscribe(onAccountForMirror);`", but plan 101-03's pins bound that block by `const achievementMirror = createAchievementMirror({` and `account.subscribe(onAccountForMirror);` and require its five declared names exactly, and the run rules said to keep new statements outside the span. The wiring is a second labelled block immediately after it, with its own named subscriber `account.subscribe(syncPlayAchievementsButton)` instead of a last statement in `onAccountForMirror`. `onAccountForMirror` also returns early on Compete OFF, so a separate subscriber is the correct place for the hide. The harness evaluates both slices together. `account.subscribe(() => {` stays at count 1.
2. **[Rule 2, strengthening] The layout check fails rather than skips when the button is not visible.** The plan said to add checks "only when the button is visible"; both call sites pass `expectPlay`, so a missing or collapsed row is a failure. It also shows the failure line (the row's widest case) and checks the label.
3. Process: the harness-first RED run was confirmed for Tasks 1 and 2 (12 pass / 29 fail before the HTML change). The Task 3 docs test was committed with Task 3, not Task 2, so Task 2's commit stays green.

## Known Stubs

None.

## Threat Flags

None. No network, storage, Capacitor or `window.__mz*` surface added; the new block is pinned free of those tokens by an anchor test. T-101-18 to T-101-21 are mitigated as planned (hidden row, tap through the mirror's Compete gate with a forced-visible harness test, in-flight guard, registered copy).

## Human verification (deferred to end of run)

Precondition: the Pixel 7 account is on the PGS Testers list.

- [ ] On the Pixel 7 (debug APK and the release build): with Compete ON and signed in, VIEW IN PLAY GAMES shows at the top of the ACHIEVEMENTS sheet and opens Play's achievements screen with the game's achievements.
- [ ] Android back from Play's screen returns to the sheet.
- [ ] With Compete OFF, or signed out, the button is absent (and appears live if Compete or sign-in flips while the sheet is open).
- [ ] TalkBack reads the button's label once.
- [ ] With Play unavailable (airplane mode, or a build without the plugin) a tap shows the one failure line and leaves the list usable.

## Self-Check: PASSED

- Files exist and are committed: src/browser/achievementsSheet.js, test/voice/safety-scan.test.js, mazeworld.html, test/unit/play-achievements-shell.test.js, tools/layout-check.mjs, docs/SHELL-MODULES.md, test/unit/achievements-shell-a11y.test.js.
- Commits 0137f522, 4af26b17 and c7d1021d exist on master.
