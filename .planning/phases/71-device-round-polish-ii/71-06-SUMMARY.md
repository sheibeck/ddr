---
phase: 71-device-round-polish-ii
plan: 06
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, combat, full-log, sheet, uat, milestone-v2.0]
requirements: [POLISH-07]
requires:
  - 71-05 what-happened strip (#cb-summary, renderRoundStrip, ROUND_STRIP_COPY)
  - src/browser/fightLog.js log shape (entries carry roll, round, show)
  - the .mw-legend-sheet family and window.__mzMotion (showPanel/hidePanel)
  - Phase 32 guardTap/encArmed and Phase 58 beatHurryTap
provides:
  - src/browser/fightLog.js fightLogByRound(log) and the sheet copy in ROUND_STRIP_COPY
  - window.__mzFightLogVM.byRound (module, sandbox mirror, bridge registry)
  - "#mw-fightlog-sheet (THE FIGHT SO FAR) with openFightLogSheet / closeFightLogSheet / fightLogSheetOpen"
  - renderFightLog(host) as the sheet's row builder
  - docs/UAT-v2.0.md section M (Phase 71 device checks) and its Source map block
affects:
  - the combat screen's strip (now a guarded button)
  - Android back (closeModal) and hasOpenModal
  - the keyboard handler while the sheet is open
  - 71-07 and 71-08 (append their rows to UAT section M)
tech-stack:
  added: []
  patterns:
    - "a body-level legend-family sheet over the combat screen, opened only when no beat is live"
    - "a JS open-state flag (fightLogSheetOpen) instead of reading the element's hidden"
key-files:
  created:
    - test/unit/fight-log-sheet.test.js
    - .planning/phases/71-device-round-polish-ii/71-06-SUMMARY.md
  modified:
    - src/browser/fightLog.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - docs/UAT-v2.0.md
    - test/unit/harness/shellSandbox.js
    - test/unit/fightLog.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/round-summary-band.test.js
decisions:
  - "R-22: THE FIGHT SO FAR is #mw-fightlog-sheet, a body-level .mw-legend-sheet (z 45) styled to the mock, not a layer inside the combat panel"
  - "R-23: a line reveals exactly its entry's own roll (the engine event's Oracle detail text); a line with no roll is plain and gets no handler; there is no dice-mode setting, so this is the mock's on-tap mode"
  - "renderFightLog was refactored, not retired: renderFightLog(host) is now the sheet's row builder (byRound groups, reveal toggle); openFightLogSheet is its one caller; its beat-view, typing and announcer code left with 71-05's move to the strip"
  - "The strip is a guardTap-wired button (role button, tabIndex 0, name 'Open the full fight log'); R-18 holds: mid-round beatHurryTap skips first, encArmed refuses, and openFightLogSheet is a no-op while a beat is live"
  - "Closing the sheet re-arms the combat screen (armEncounterButtons) and does not stamp lastDismissAt; the map is already parked in a fight and the encounter end stamps it"
  - "The sheet copy joins ROUND_STRIP_COPY as flat keys (openLog, sheetTitle, diceHint, close, roundHead, noRound 'OFF THE BOOKS'), bridged once as __mzFightLogVM.copy"
metrics:
  duration: "~55 min"
  completed: 2026-09-24
  tasks: 2
  files: 13
---

# Phase 71 Plan 06: THE FIGHT SO FAR, and the Phase 71 UAT fold Summary

Tapping the what-happened strip now opens THE FIGHT SO FAR, the full-log bottom sheet from the user's combat v2 mock. It lists every line of the fight, newest first, under ROUND n headers, and the list scrolls inside a panel capped at 74% of the screen. A line that carries dice shows its roll in gold on a tap and hides it on a second tap. A line without dice is plain. CLOSE, the scrim, Android back and Escape close it, and so does the fight ending. It never opens while a round is still resolving: that tap is a skip. Every Phase 71 device check (71-01 to 71-06) is now in docs/UAT-v2.0.md section M.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | THE FIGHT SO FAR, the full-log sheet the strip opens (D-07, D-06) | 26939df (RED), 92348a5 (GREEN) |
| 2 | Fold every Phase 71 device check into docs/UAT-v2.0.md section M, plus the phase gates (D-13) | 1f70eba |

## What was built

- **`fightLogByRound(log)`** (`src/browser/fightLog.js`) returns a frozen array of frozen `{ round, entries }` groups:
  - groups come newest first, ordered by each group's newest entry, and entries within a group come newest first;
  - each entry is `{ id, text, tone, roll, show }`;
  - all null-round entries form one `round: null` group;
  - null, empty or malformed logs give `[]`;
  - it is pure.
- **The sheet copy** joins `ROUND_STRIP_COPY`:
  - `openLog` "Open the full fight log";
  - `sheetTitle` "THE FIGHT SO FAR";
  - `diceHint` "TAP A LINE FOR ITS DICE";
  - `close` "CLOSE";
  - `roundHead` "ROUND {n}";
  - `noRound` "OFF THE BOOKS".

  The fightLog copy test voice-scans it, and hp-not-wp already walks this object.
- **Markup:** `#mw-fightlog-sheet.mw-legend-sheet[hidden]` sits after the Gear sheet. It holds a scrim, a panel (`role="dialog"`, `aria-modal`, `aria-label="The fight so far"`), a head (title with `tabindex=-1`, the hint, a CLOSE button) and `#mw-fightlog-sheet-rows`. It has no `aria-live`.
- **CSS, from the mock:**
  - the scrim is `rgba(10,8,6,.72)`;
  - the panel has `max-height:74%` and is a flex column with `overflow:hidden`, so only `.mw-fl-rows` scrolls (`padding:4px 12px 30px`);
  - the title is 7px #e8c97a, the hint is 6px #8f856f, and CLOSE is a 7px chip with a 2px #4a4032 border;
  - the ROUND n headers are 6px #8f856f;
  - rows reuse `.cb-log-*`, with the roll in gold `#e8c97a`;
  - focus rings are added for the strip and the reveal rows;
  - no motion of its own and no `aria-disabled` token.
- **`openFightLogSheet()`:**
  - It is a no-op while `__mzBeat.active()` or without `S.combat`.
  - It fills the title and CLOSE, calls `renderFightLog(rows)`, and shows the hint only when some row has a roll.
  - It sets the open flag, opens through `showPanel`, and focuses the title.
- **`closeFightLogSheet()`** clears the flag and closes through `hidePanel`. In a fight it re-arms the combat screen and returns focus to the strip.
- **Where it is wired:**
  - CLOSE and the scrim use `.onclick = closeFightLogSheet`, once at load.
  - The strip in `renderRoundStrip` is `role="button"`, `tabIndex 0`, named from the copy, with `guardTap(strip, openFightLogSheet)` and an Enter/Space `onkeydown`.
  - `closeModal` has `if (fightLogSheetOpen()) { closeFightLogSheet(); return; }` right after the ☰ return and before the Gear sheet. `hasOpenModal` includes `fightLogSheetOpen()`.
  - renderEncounter's inactive branch closes an open sheet.
  - The keydown handler swallows every key while the sheet is open, and Escape closes it.
  - The module import and `__mzFightLogVM` gain `byRound`, and so does the sandbox mirror.
  - bridge.js's consumers and purpose are updated, the bridge-doc table was regenerated, and docs/SHELL-MODULES.md has a new "THE FIGHT SO FAR" section (R-22, R-23).

## Rulings recorded

- **R-22 (where the sheet lives):** in the mock the sheet is an absolute layer inside the combat panel. Here it is a body-level member of the `.mw-legend-sheet` family (`#mw-fightlog-sheet`, z 45, like the Gear, Settings and MARKS sheets). From that family it takes the scrim, the rise, the closing state, the reduced-motion handling and the back-button pattern. It adds no listener to the render region (CSCR-08), and `#enc-panel` still has exactly one capture click listener. Visually it is the mock's bottom sheet.
- **R-23 (dice):** a row reveals exactly the `roll` string its fight-log entry carries. `fightLogLinesFor` set it from the engine event's own Oracle detail text. When `roll` is null the row is plain: no handler, no `cb-log-revealable`, and nothing invented. DR18 retired the dice-mode setting, so this is the mock's "on tap" mode.
- **renderFightLog was refactored, not retired.** `renderFightLog(host)` is now the sheet's row builder: `byRound` groups, headers from the copy, and the reveal toggle through `__mzFightLogVM.toggle(window.__mzFightLog, r.id)`. `openFightLogSheet` is its one caller. It no longer reads a beat view, types, or announces: the sheet is not a live region, and `renderRoundStrip` still feeds `#enc-round-live` with the whole log. Keeping the name kept every region anchor in the existing shell tests valid.
- **R-18 holds (D-06):**
  - Mid-round, a tap on the strip is caught by the capture-phase `beatHurryTap`, which skips.
  - The strip's `guardTap` handler also checks `encArmed()`, which is false while a beat is live.
  - `openFightLogSheet` returns early while a beat is live.

  fight-log-sheet (c) proves all three.

## Phase 71 UAT fold (D-13)

- **Section M, "Device-round polish II — Phase 71 (28)":**
  - 28 rows, M1 to M28, built from 31 source items: 71-01 (6), 71-02 (4), 71-03 (5), 71-04 (7), 71-05 (5) and 71-06 (4).
  - The walk order is sound, gear, lock and skip, chips, long press, strip, then the full-log sheet.
  - The lead paragraph tells 71-07 and 71-08 how to append (rows after M28, bump the heading count, add source lines at the end of the Source map).
- **Merges:**
  - 71-03-S3 (foe or log tap mid-round), 71-05-S2's strip-tap clause and 71-06-S3 (strip tap mid-round) are one row, M13.
  - 71-05-S4 (the card above the strip) merged into 71-04-S3 (M17).
  - 71-03-S5 (☰ mid-round) merged into L22, with a still-holds clause in M11.
  - 71-02's two "also worth a look" notes are folded into M9 and M10.
- **Re-worded: L1.** At MUSIC_GAIN 0.9 the theme is clearly audible and still sits under a UI tap or footstep, and the MUSIC slider scales it (see M1, M3). Its source line [51h-S1] now reads "re-worded for Phase 71 (M1)".
- **Superseded: none.** Sections A to L were checked for claims Phase 71 moved: the fight log's place, the foe card meta, combat prompts, store rows and sheet contents. L1 was the only one; L22 still stands as written.
- **Other sections updated:**
  - Sources gained the six Phase 71 SUMMARYs with their counts.
  - Suggested order step 4 now includes section M after L (no console setup needed).
  - The Source map has 31 `[71-PP-Sk]` lines, each exactly once, as its last block.
  - The Tally line covers the Phase 71 fold.
  - The **Build:** line was left for the orchestrator.

## Phase gates

- `npm test`: **5406 tests, 5399 pass, 7 fail.** The 7 are the known worktree CRLF doc-ledger failures: Outliers, AFTER/Outliers/Handoff, Handoff to Phase 27, v1.5 AFTER, and the three flee-table rows. There are no other failures.
- `node tools/bridge-doc.mjs --check` exits 0.
- Phase-wide diff from `dd06b3f` (the parent of the first 71-01 commit, fd43016) to HEAD:
  - engine/: **0** files;
  - content/: **0** files;
  - test/parity/ (including prototype-master.js.txt): **0** files (byte-identical);
  - sfx/: **0** files;
  - test/unit/fixtures/: **4** files, exactly 71-02's declared snapshots (`thief.gear-sheet-bag`, `thief.gear-sheet-worn`, `thief-store.store`, `mu-store.store`).
- `git diff --quiet HEAD -- engine test/parity content sfx` exits 0.
- 71-06 is not the phase's last plan (71-07 and 71-08 follow), so these gates don't close the phase.

## Deviations from Plan

1. **[Rule 2 - Correctness] No key reaches the combat actions under the sheet.** The combat keydown path clicks the grid buttons for digits 1 to 4, which would act under a modal sheet. While `fightLogSheetOpen()`, the handler swallows every key, and Escape closes the sheet. The guard sits right after the ☰ Escape line, so that line stays first. Commit 92348a5.
2. **[Rule 2 - Correctness] Close re-arms instead of stamping the settle.** The plan's family pattern stamps `lastDismissAt`, but that breaks the settle-stamp count pins in shell-map-hud and shell-map-invariants (4 stamps). It also protects nothing here, because the map is already parked in a fight. Instead, `closeFightLogSheet` calls `armEncounterButtons()` while `S.combat` is set, so the second half of a double tap on CLOSE or the scrim can never land on an action. Commit 92348a5.
3. **[Rule 3 - Blocking] The open state is a flag.** `fightLogSheetOpen()` reads a `fightLogSheetShown` flag, the equivalent of the Gear sheet's `gearSheetTarget`, not the element's `hidden`. A fresh sandbox element is not hidden, and a flag keeps `hasOpenModal`, `closeModal` and the encounter-end close exact. Commit 92348a5.
4. **[Rule 3 - Blocking] CLOSE and the scrim use `.onclick`.** The recording DOM's `addEventListener` is a no-op, so an `.onclick` wiring is what lets fight-log-sheet (d) prove CLOSE and the scrim for real (the harness notes say to invoke handlers through `.onclick`). The "outside the render region" pin checks that neither is wired inside renderFightLog, renderRoundStrip, renderEncounter or openFightLogSheet. The CSCR-08 slice runs from renderFightLog to the module's noteCombat, so it covers the whole classic tail and can't express "outside". Commit 92348a5 (test adjusted in the same commit).
5. **[Rule 2 - Accessibility] Keyboard and TalkBack reach.** The strip gets an Enter/Space `onkeydown`. Reveal rows get `role="button"` and `aria-expanded`. Focus moves to the sheet title on open and back to the strip on close. Because the strip is a named button, TalkBack reads "Open the full fight log" instead of its lines. The round text still reaches TalkBack through `#enc-round-live`. That trade-off is device check M28 (71-06-S4, a fourth human check beyond the plan's three).
6. The sheet copy went into `ROUND_STRIP_COPY` as flat keys, the object the plan calls "fightLog.js's frozen copy". hp-not-wp already walks it, so registering it there was a comment update.
7. The round-summary-band (c) pin "the strip carries no tap handler (71-06 adds the sheet)" now asserts the strip's wired open tap. The skip assertions around it are unchanged.

## Threat model check

- **T-71-11 (a stray act):** mitigated. The strip's open tap goes through guardTap, and `beatHurryTap` stops the tap first mid-beat. The sheet only reads the log and flips a presentation-only `show` flag. Keys are swallowed while it is open, and closing re-arms the combat screen. fight-log-sheet (c) proves the mid-round refusal.
- **T-71-12 (invented dice):** mitigated. A reveal shows only the entry's own roll, and rows with no roll get no handler. fight-log-sheet (b) and fightLog.test (the roll kept or null) pin this.
- No new surface: no network, storage, schema or engine change.

## Known Stubs

None.

## Human verification (deferred)

These are deferred to the Phase 71 device round and are folded into docs/UAT-v2.0.md section M (M13, M26, M27, M28):

1. After a few rounds, tap the what-happened strip. THE FIGHT SO FAR rises with every line of the fight, newest first, under ROUND n headers, and it scrolls.
2. Tap a line that shows dice: its roll appears in gold, and tapping again hides it. Lines without dice do nothing. CLOSE, a tap on the dark area, or Android back closes the sheet, and the fight is exactly as it was.
3. Tap the strip while a round is still resolving: the round lands, and the sheet does not open.
4. With TalkBack on, the strip reads "Open the full fight log" and a double-tap opens the sheet, and a line with dice reads as a button that shows and hides its roll. With Android's remove-animations setting on, the sheet opens and closes instantly.

## Self-Check: PASSED

- FOUND: src/browser/fightLog.js, mazeworld.html, test/unit/fight-log-sheet.test.js, docs/UAT-v2.0.md, docs/SHELL-MODULES.md
- FOUND commits: 26939df, 92348a5, 1f70eba
