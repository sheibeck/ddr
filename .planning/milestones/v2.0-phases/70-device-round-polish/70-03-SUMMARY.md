---
phase: 70-device-round-polish
plan: 03
subsystem: browser-shell (HUD ☰ menu, Play Games account, quit actions)
status: complete
tags: [vanilla-js, presentation-only, hud, hamburger-menu, play-games, account, quit-actions, milestone-v2.0]
requirements: [POLISH-02, POLISH-03]
requires:
  - "70-01 pure layer: HUD_MENU_GLYPH, HUD_MENU_QUIT_COPY, ABANDON_ARM_MS, abandonRowNext, accountMenuView, renderMenuFace, renderAccountMenu, controller menuView()"
  - "70-02 LINEAGE edits in mazeworld.html (createBoardsPanel options block, .mw-bd-* CSS), left intact"
  - "260924-51h title-music block and the four title functions, left byte-identical"
provides:
  - "the ☰ button wears the account face (renderMenuFace(#mw-hud-menu-btn, account.menuView()))"
  - "the ACCOUNT block (#mw-hud-menu-acct) as the ☰ dropdown's first child"
  - "#mw-menu-save-quit and #mw-menu-abandon rows, with the in-row two-tap arm"
  - "classic closeMenuThen(fn): every ☰ row closes the menu before its action (D-07)"
affects:
  - "plan 70-04 (lifts the ☰ encounter/dead gate, disables rows by context, raises the z-ladder, per D-08)"
tech-stack:
  added: []
  patterns:
    - "one renderAccountSurfaces() paints the title chip, the ☰ face and the ACCOUNT block from the controller's views"
    - "CSS-only label switch driven by data-armed / data-dead on the row"
key-files:
  created:
    - test/unit/shell-menu-quit.test.js
  modified:
    - mazeworld.html
    - src/browser/heroTab.js
    - docs/SHELL-MODULES.md
    - test/unit/hud-menu-layout.test.js
    - test/unit/account-layout.test.js
    - test/unit/shell-account.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/heroTab.test.js
    - test/unit/harness/shellSandbox.js
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
decisions:
  - "DISC-1 (carried): the in-row arm is the Confirm-before-quit confirm. On (default) = two taps, Off = one tap; the abandon dialog is removed"
  - "DISC-2 (carried): Save & quit's confirm dialog is removed; the action is non-destructive"
  - "DISC-3: RESOLVED by D-08 in plan 70-04 (the ☰ opens while dead there, which makes the NEW CHARACTER row reachable); not an open issue"
  - "DISC-4 / DISC-5 (carried from 70-01): copy only; no new copy added here"
  - "Planner ruling, dead-state Save & quit: mzAbandonRun calls showTitleScreen({ allowResume: hasActiveDelveSave() }); a live hero resumes on ENTER, a dead hero's Save & quit arms no resume (matches the relaunch path for a dead save)"
  - "Dropdown max-height = 100vh − 180px − both safe-area insets (header worst case at text size L ≈ 98px + 7px offset + 66px tab bar + a small margin)"
  - "The ACCOUNT block's rows reuse the sheet's .mw-acct-* rules; the host adds only a 14px inset and a divider before MARKS"
metrics:
  duration: "~70 min"
  completed: 2026-09-24
  tasks: 2
  files: 13
---

# Phase 70 Plan 03: the ☰ as the account surface and the one place to quit Summary

The ☰ button now shows the player's initials avatar when they are signed in to Play Games, and the plain ☰ otherwise. Its dropdown opens on an ACCOUNT block (identity, Sign in / Stop competing / SIGNING IN…, the helper line, Compete ON/OFF), then MARKS, CENTRE MAP, MAKE CAMP and SETTINGS, then SAVE & QUIT, then ABANDON THIS CHARACTER in red. Every row closes the menu before it acts. The band-2 account chip and the HERO tab's Delve panel are gone, and band 2 has its old width budget back.

## What shipped

**Task 1: the ☰ wears the account face (72be16f)**
- Band 2 is the counters, then the ☰ wrap. The Phase 67 chip button and its `.mw-hud-actions` wrapper are gone, and the counters' gap is back to 8px. The width budget (hud-menu-layout (14)) now computes S 336.4 / M 377.8 / L 446.8px from `textScaleForSize`, and pins all three.
- The static ☰ face carries `data-state="menu"`. `.mw-hud-menu-face[data-state="avatar"]` adds `border:0` and the chip avatar's gold on-ring, so the 34px box never changes between faces.
- `#mw-hud-menu-acct` (role=group, aria-label "Play Games account") is the dropdown's first child. The dropdown is `min(288px, 100vw − 40px)` wide, scrolls inside itself (`overflow-y:auto`, `overscroll-behavior:contain`) and has a `max-height` derived from the header and tab bar at text size L. The dead `.mw-hud-menu-item:first-child` border reset is removed.
- In the module, `renderAccountSurfaces()` replaces `renderAccountChips()`. It paints three surfaces:
  - the title chip, with `chipView`;
  - the ☰ face, with `renderMenuFace` and `menuView`;
  - the ACCOUNT block, with `renderAccountMenu` and `sheetView`. Each of its three handlers raises `hudMenuEvent("select")` before it calls the controller.

  It runs on every account change and once before boot.
- `openAccountSheet()` takes no options and has no encounter guard. Only the title chip opens the sheet.
- `.mw-acct-chip` declares `margin:0` itself, so `.mw-title-acct` no longer overrides it.

**Task 2: Save & quit and Abandon move into the ☰ (aaa9fdd)**
- **The two rows.** `#mw-menu-save-quit` and `#mw-menu-abandon` follow SETTINGS.
  - Both use the `mw-hud-menu-quit` class. SAVE & QUIT adds `mw-hud-menu-split`, which draws a 4px divider above it.
  - ABANDON adds `mw-danger-btn` and starts with `data-armed="0" data-dead="0"`.
  - ABANDON holds three `data-when` labels (idle / armed / dead). CSS shows exactly one of them by toggling `display` only.
  - The labels line up with the glyph rows (padding-left 42px).
  - `button.mw-danger-btn`'s hover and active rules outrank the generic ones, and no menu-item hover/active rule exists that could win over them.
- **The classic script.**
  - `setHudMenuOpen(true)` stamps `data-dead` from `window.__mzState?.get?.()?.dead`. Every close writes `data-armed="0"`.
  - `closeMenuThen(fn)` is declared right after `hudMenuEvent`, and MARKS, CENTRE MAP and MAKE CAMP are wrapped in it. The camp line is still one `onclick =` assignment.
- **The module.**
  - SETTINGS is wrapped in `closeMenuThen`.
  - The quit-row block (`let abandonArmTimer` … before `DEV_LONG_PRESS_MS`) sits right after the account-sheet listeners. Both rows call `stopPropagation()`.
  - SAVE & QUIT raises select, then calls `mzAbandonRun()`.
  - ABANDON feeds `abandonRowNext(armed, "tap", { dead, confirm: shouldConfirmQuit(currentSettings) })`. It (re)starts one `ABANDON_ARM_MS` timer on an arm. Otherwise it raises select, then calls `mzStartRoll()` or `mzAbandonCharacter()`.
- **The bridges.**
  - `mzAbandonRun` is now just `showTitleScreen({ allowResume: hasActiveDelveSave() })`.
  - `mzAbandonCharacter` keeps its `hasActiveDelveSave()` guard and the abandon dispatch, minus the dialog.
  - The comment-stripped shell contains no `confirm(` call.
- **Retired.** The HERO tab's Delve panel, its two buttons, their classic onclick blocks and heroTab.js's DR16 label flip are all removed.

## Declared fixture movement

Only `test/unit/fixtures/shell-snapshots/mu.hero.txt` and `thief.hero.txt` moved: each lost its 3-line `## #btn-abandon-character` block. `SNAPSHOT_IDS.hero` no longer lists the id. No other fixture moved. The regeneration touched six other fixtures' line endings only, and those were restored.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 72be16f | feat(70-03): the ☰ wears the account face |
| 2 | aaa9fdd | feat(70-03): Save & quit and Abandon move into the ☰ |

## Verification

- Task 1 verify set (hud-menu-layout, account-layout, shell-map-hud, shell-account, accountChip-dom, bridge-registry, stale-terms, hp-not-wp, shell-no-content-copies, title-music-shell): 144/144 pass. `bridge-doc --check` exits 0. The grep gates return 0 band-2 chip ids, 0 `.mw-hud-actions` and 1 `#mw-hud-menu-acct`.
- Task 2 verify set (shell-menu-quit, hud-menu-layout, heroTab, shell-tab-snapshots, shell-account, shell-map-hud, shell-gear-toolbar, hp-not-wp, title-music-shell, shell-map-invariants): 174/174 pass. `bridge-doc --check` exits 0. The grep gates return 0 legacy quit-button ids in mazeworld.html and 0 `getElementById("btn-abandon-character")` in heroTab.js.
- `npm test`: 5187 tests, 5180 pass. The 7 failures are the known worktree CRLF doc-ledger artifacts: class-pass-ledger ×4 and flee-ledger ×3.
- `git diff --stat 120ae52 HEAD` touches nothing under `engine/`, `content/` or `test/parity/`. No new `window.__mz` name was added (bridge-registry is green and unchanged).
- title-music-shell (11) is green, so the 51h block and the four title functions are unchanged. The 70-02 `createBoardsPanel` options block and the `.mw-bd-*` CSS are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shell-map-invariants.test.js pinned the four legacy listener lines verbatim**
- **Found during:** Task 2
- **Issue:** The plan listed the listener-line pins in shell-account (F2) and shell-map-hud (~540), but `MAP-08: the four map chips' listeners exist exactly once each` in shell-map-invariants.test.js pins the same four lines. It would have failed once they moved to the `closeMenuThen(...)` form.
- **Fix:** Re-pinned its four `countOf` literals to the `closeMenuThen(...)` form, with a Phase 70 D-07 comment.
- **Files modified:** test/unit/shell-map-invariants.test.js
- **Commit:** aaa9fdd

**2. [Rule 3 - Blocking] docs/SHELL-MODULES.md line endings**
- **Issue:** `bridge-doc --check` failed on the worktree's CRLF checkout before any edit (the known artifact).
- **Fix:** Saved the doc with LF endings, as the orchestrator instructed. There was no content change beyond the plan's edits.

Two small comment accuracy edits were also made: the title-screen CSS comment and the roller-mount comment no longer name the HERO tab as the Save & quit / New Character caller, and SHELL-MODULES.md's roller section was updated the same way. No behaviour changed.

## Known Stubs

None. The ☰ still refuses to open during encounters and while dead: that is this plan's declared scope boundary, and plan 70-04 lifts it per D-08. Until then the dead-state NEW CHARACTER row and the dead Save & quit ruling exist and are tested, but a player cannot reach them yet.

## Threat Flags

None. The shell adds no HTML-string assignment: the face and the ACCOUNT block are written only by the 70-01 renderers (T-70-09). The abandon row is guarded by the fail-safe reducer, the 3 s expiry, disarm-on-close, the danger styling and the heavier divider (T-70-10). All of these are pinned by shell-menu-quit and hud-menu-layout (17)/(18). There is no new network identifier (shell-account F3 is green).

## Human verification (deferred to end of run)

For the Phase 70 device round (docs/UAT-v2.0.md, folded by plan 70-04), on the Pixel 7:

1. The ☰ shows the initials avatar when signed in, and the plain ☰ when signed out, signing in or Compete OFF. The button doesn't change size between faces. Band 2 at text sizes S/M/L shows Depth/Day/Squares/Rations with the ☰ flush right. TalkBack reads "Menu — signed in as {name}" when signed in and "Menu" otherwise.
2. The dropdown shows the ACCOUNT block first:
   - Sign in works from it.
   - Compete OFF flips the ☰ back to the glyph.
   - After the block come MARKS, CENTRE MAP, MAKE CAMP and SETTINGS, then SAVE & QUIT, then a red ABANDON THIS CHARACTER.
   - Nothing clips at 411px wide, and the dropdown scrolls if it runs too tall at L.
   - Every row closes the menu as it acts.
3. SAVE & QUIT goes straight to the title with no dialog, and ENTER resumes the run.
4. ABANDON:
   - One tap shows TAP AGAIN TO BURY THEM. Waiting about 3 s, or closing the menu, reverts it.
   - Two quick taps bury the hero with no dialog.
   - With Settings › Confirm before quit Off, one tap buries the hero.
   - Once 70-04 opens the ☰ while dead, the row reads NEW CHARACTER and rolls a new hero, and a dead Save & quit's ENTER rolls a new hero too.
5. The HERO tab has no Delve panel. The title chip and the account sheet still work from the title.

## Self-Check: PASSED

- FOUND: test/unit/shell-menu-quit.test.js (created)
- FOUND: mazeworld.html, src/browser/heroTab.js, docs/SHELL-MODULES.md and the two hero fixtures (modified)
- FOUND commits: 72be16f, aaa9fdd
