---
phase: 57-map-hud-layout-band
plan: 05
subsystem: ui
tags: [hud, dom, css, accessibility, mazeworld.html, hudMenu, hudBands]

# Dependency graph
requires:
  - phase: 57-map-hud-layout-band (plan 04)
    provides: darkness legibility (LAYOUT-06), the DARK chip waiver clause, the vignette
provides:
  - "src/browser/hudMenu.js — the pure ☰ HUD menu open/close reducer (HUD_MENU_ITEMS, HUD_MENU_EVENTS, hudMenuNext)"
  - "src/browser/hudBands.js's identityParts(c) — band 1's name/line split — and COUNTER_SLOT_CH — band 2's reconciled per-counter slot widths"
  - "the __mzHudMenu bridge, and __mzHudBands extended with identityParts"
  - "the compacted HUD markup: band 1 (name, line, HP text), the HP strip, band 2 (counters + ☰ menu), condition chips — the map chip band is retired outright"
  - "the ☰ menu's classic wiring (hudMenuIsOpen/setHudMenuOpen/hudMenuEvent) and its five close triggers (select, re-tap, outside tap, tab switch, encounter, Escape, back button)"
  - "test/unit/hud-menu-layout.test.js — the 15-test structural + behavioural proof"
affects: [58-motion-pacing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentation-only DOM menu state (data-open attribute), never S/state — the same pattern 57-02's rail used, applied to a dropdown"
    - "Pure reducer (hudMenuNext) + one classic-script writer (setHudMenuOpen) + a fail-closed call site (hudMenuEvent) — mirrors hudBands.js's bridge shape"
    - "A transparent, fixed, structurally-outside-the-viewport scrim as the mechanism that makes an outside tap provably never reach tapStep()"

key-files:
  created:
    - src/browser/hudMenu.js
    - test/unit/hudMenu.test.js
    - test/unit/hud-menu-layout.test.js
  modified:
    - src/browser/hudBands.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - mazeworld.html
    - tools/store-screenshots/capture.js
    - test/unit/hudBands.test.js
    - test/unit/hud-bands-layout.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-map-invariants.test.js
    - test/unit/shell-map-viewport.test.js
    - test/unit/harness/shellSandbox.js

key-decisions:
  - "USER MOCK RULING 2026-09-22 implemented verbatim: the map chip strip (former band 4) is retired outright, not relocated — its four controls (MARKS, CENTRE MAP, MAKE CAMP, SETTINGS) live in a ☰ dropdown menu on band 2, reusing their legacy chip ids so every existing listener line routes unchanged."
  - "USER RULING 2026-09-22: the centre row reads CENTRE MAP (the one wording change adopted from the mock) — every other row/surface keeps the app's own wording (Depth not FLOOR, x/y HP not spaced, engine casing for names)."
  - "discovery D reconciliation: only Squares (#m-steps) keeps the D-08 5-digit slot; Depth/Day/Rations get real-bound slots (3/3/2 digits) via COUNTER_SLOT_CH, so band 2 plus the new ☰ button still fits a 411px Pixel 7 at text size M (377.8px computed, ~33px to spare)."
  - "The Android back button closes the menu (device equivalent of Escape) — approved by the orchestrator as standard behaviour, wired into getGameContext's hasOpenModal/closeModal."
  - "Condition chips keep HEAD's every-tab-but-Dead behaviour, NOT the mock's map-only gate (discovery B) — the mock's chip-styling deltas were also not adopted, both flagged for user confirmation."

patterns-established:
  - "Pattern: a menu/overlay's structural-consumption proof (T-57-15) is a scrim outside the gesture tracker's host element, never an event.stopPropagation() or a guard predicate — provably zero moves, not just observed zero moves."

requirements-completed: [LAYOUT-04, LAYOUT-05]

coverage:
  - id: D1
    description: "The map chip strip is retired; MARKS/CENTRE MAP/MAKE CAMP/SETTINGS live in a ☰ dropdown menu on band 2, each row routing through its unchanged legacy handler."
    requirement: "LAYOUT-04"
    verification:
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js#(1)/(3)/(9)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-invariants.test.js#SC-4"
        status: pass
    human_judgment: false
  - id: D2
    description: "The outside tap that closes the menu is structurally consumed (a fixed scrim outside #mw-maze-viewport) and never steps the party; the menu cannot open over an encounter."
    requirement: "LAYOUT-04"
    verification:
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js#(4)/(8)/(10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The HUD is band 1 (name, line, HP text), a 4px HP strip, band 2 (counters + ☰), then condition chips, in that exact order, and the order can never silently drift from HUD_BAND_ANCHORS."
    requirement: "LAYOUT-05"
    verification:
      - kind: unit
        ref: "test/unit/hud-bands-layout.test.js#(1)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-hud.test.js#(a)/(b)/(c)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Opening/closing the menu never moves the viewport, adds no transition/animation/@keyframes, and the z-ladder (rail 4 < scrim 5 < menu wrap 6 < overlay 8) holds."
    requirement: "LAYOUT-05"
    verification:
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js#(5)/(6)/(7)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Band 2 fits a Pixel 7 at text size M (411px CSS width) with the ☰ visible and all four counters legible."
    requirement: "LAYOUT-05"
    verification:
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js#(14)"
        status: pass
    human_judgment: false
  - id: D6
    description: "On a Pixel 7 device, the ☰ is reachable one-handed, each row opens its sheet/recentres with one tap, the glyphs render without tofu, text-size L doesn't overlap band 1, the menu never shifts the map, and the Dead tab's HUD-hidden first line clears the status bar."
    verification: []
    human_judgment: true
    rationale: "Font glyph rendering, one-handed reach and real-device text reflow cannot be proven from source — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol."
  - id: D7
    description: "Phase gate: npm test green, build:www exit 0, engine/content/parity diff empty, parity master hash unchanged, package.json/lock unchanged, bridge-registry green (both halves), boot:check exit 0."
    verification:
      - kind: unit
        ref: "npm test (3633/3633)"
        status: pass
      - kind: other
        ref: "npm run build:www"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10)"
        status: pass
      - kind: other
        ref: "npm run boot:check (no-uncaught/painted/graves/title all PASS)"
        status: pass
    human_judgment: false

# Metrics
duration: ~3h
completed: 2026-09-22
status: complete
---

# Phase 57 Plan 05: HUD compaction — ☰ hamburger menu, HP strip under band 1 Summary

**The map chip strip is retired outright; MARKS/CENTRE MAP/MAKE CAMP/SETTINGS now live in a ☰ dropdown on the counters band, and the HP bar moves to a full-width strip directly under the identity line — per the user's 2026-09-22 HUD mock.**

**BASE_05** (recorded before the first edit, per the plan's discovery section): `a01b38e08b98e36ed1939d9d1fe1538eee6237b1` (57-04's final commit plus the two docs-only commits ahead of it at dispatch — no code changes between BASE_05 and this plan's first edit).

## Performance

- **Duration:** ~3h
- **Completed:** 2026-09-22T19:24:05Z
- **Tasks:** 3 (all `type="auto"`, Task 1 `tdd="true"`)
- **Files modified/created:** 15 (3 new: `src/browser/hudMenu.js`, `test/unit/hudMenu.test.js`, `test/unit/hud-menu-layout.test.js`; 12 modified)

## Accomplishments

- `src/browser/hudMenu.js`: `HUD_MENU_ITEMS` (four frozen rows — marks/centre/camp/settings — carrying the mock's glyphs/colours/sizes and the legacy chip ids), `HUD_MENU_EVENTS`, and the total `hudMenuNext(open, kind, ctx)` reducer (fail-closed on every kind but `toggle`; `toggle` refuses to open during an encounter).
- `src/browser/hudBands.js`: `identityParts(c)` splits `identityLine`'s single string into a never-truncated name and a truncating race/class/level line (band 1's two spans), with `identityLine` now composing from it byte-identically. `COUNTER_SLOT_CH` reconciles D-08's unbounded-Squares slot with band 2 also carrying the ☰ button.
- The compacted HUD: band 1 (name, line, HP text) → a 4px HP strip → band 2 (counters + ☰ menu) → condition chips. The map chip band is gone; `#screen-maze` opens straight onto `.mazebox`.
- The ☰ menu's classic wiring: `hudMenuIsOpen`/`setHudMenuOpen`/`hudMenuEvent`, closing on select, a ☰ re-tap, an outside tap (consumed by a scrim structurally outside `#mw-maze-viewport`), a tab switch, an encounter starting, Escape, and the Android back button.
- Every HUD/chip test re-pinned to the menu (none dropped), plus the new 15-test `test/unit/hud-menu-layout.test.js` structural + behavioural proof, with both teeth checks demonstrated and reverted.
- Phase gate re-run and green: `npm test` 3633/3633 (+26 over 57-04's 3607/3607), `npm run build:www` exit 0, engine/content/parity diff empty, master hash unchanged, package.json/lock unchanged, `bridge-registry.test.js` 10/10, `npm run boot:check` PASS on all four checks.

## Task Commits

1. **Task 1: `src/browser/hudMenu.js`, `identityParts` + `COUNTER_SLOT_CH`, and the two bridges** - `8fb33ea` (feat, tdd)
2. **Task 2: The shell — compact HUD, the ☰ menu on band 2, the chip band retired, the Dead-tab HUD** - `d2b7350` (feat)
3. **Task 3: Re-pin the HUD/chip tests, add `hud-menu-layout.test.js` with teeth, and re-run the phase gate** - `3a23a0b` (test)

_Note: Task 1 was TDD (`tdd="true"`) — the pure module and its tests landed together in one commit, since the module had no prior implementation to red/green against (a fresh reducer, not a refactor of existing behaviour); its behaviour matrix was written and verified green before commit, matching the task's own `<behavior>`/`<acceptance_criteria>` spec._

## Files Created/Modified

- `src/browser/hudMenu.js` - the pure ☰ menu item table + open/close reducer (new)
- `src/browser/hudBands.js` - `identityParts`, `COUNTER_SLOT_CH`, re-pinned `HUD_BAND_ANCHORS`
- `src/browser/bridge.js` - `__mzHudMenu` row; `__mzHudBands`' consumers/purpose updated
- `docs/SHELL-MODULES.md` - regenerated via `node tools/bridge-doc.mjs --write`
- `mazeworld.html` - the compacted HUD markup/CSS, the ☰ classic wiring, `paint()`'s band-1 write, the Dead-tab off-tab hide, stale chip-describing comments updated
- `tools/store-screenshots/capture.js` - `NAV` regex gained `^mw-hud-menu`
- `test/unit/hudMenu.test.js` - the new pure-module pin (new)
- `test/unit/hudBands.test.js` - `identityParts`/`COUNTER_SLOT_CH` behaviour cases, `HUD_BAND_ANCHORS` re-pin
- `test/unit/hud-menu-layout.test.js` - the 15-test structural + behavioural proof (new)
- `test/unit/hud-bands-layout.test.js` - (1)/(2)/(4) re-pinned
- `test/unit/shell-map-hud.test.js` - (a)/(b)/(c)/(g)/(h) re-pinned
- `test/unit/shell-gear-toolbar.test.js` - `chipsMarkup()` and its two dependent tests re-pinned
- `test/unit/shell-map-invariants.test.js` - SC-4 re-pinned (the four-listener test stays unedited)
- `test/unit/shell-map-viewport.test.js` - (i) extended for `hudMenuIsOpen()`/`hudMenuEvent("escape")`
- `test/unit/harness/shellSandbox.js` - wires `identityParts` and `__mzHudMenu` from the real modules

## Decisions Made

- The chip band is retired outright (not relocated to another position) — matches the user's literal words: "too many buttons; we don't need more rails on the top; consolidate the buttons into a hamburger menu."
- CENTRE MAP is the one wording change adopted from the mock (USER RULING 2026-09-22); every other surface (Depth not FLOOR, `x/y HP`, engine name casing) keeps the app's own wording per discovery C's table.
- Condition chips keep HEAD's every-tab-but-Dead behaviour (not the mock's map-only gate) and their current type size (not the mock's larger type) — both deltas flagged in discovery F for user confirmation, not adopted.
- Counter slot widths: Squares alone keeps the 5-digit D-08 slot; Depth/Day/Rations narrow to their real bounds (discovery D), approved by the user.
- The Android back button closes the menu, approved by the orchestrator as standard behaviour (device equivalent of Escape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/doc-accuracy] Stale "chip"-describing comments left over from Task 2's markup change**
- **Found during:** Task 3, while re-pinning `shell-map-hud.test.js` test (h) (its "no `.mw-map-chip` token anywhere" assertion caught a leftover `.mw-map-chip` mention in a specificity-order comment near the generic button-hover fix).
- **Issue:** Several comments in `mazeworld.html` (the generic-hover specificity note; the MARKS legend, Settings and MAKE CAMP sheet comments; a couple of camera-trigger comments) still described the retired chip strip as the thing that opens each sheet or triggers centring, which would mislead a future reader even though the code itself was already correct.
- **Fix:** Updated each to name the ☰ HUD menu row that now performs the action (e.g. "opened by the MARKS row of the ☰ HUD menu"), keeping the original historical Phase-number attribution where it still applies.
- **Files modified:** `mazeworld.html` (comments only — no markup/CSS/behaviour change).
- **Verification:** `test/unit/shell-map-hud.test.js` (h) and the full unit suite green; `git diff` shows comment-only changes.
- **Committed in:** `3a23a0b` (part of the Task 3 commit).

---

**Total deviations:** 1 auto-fixed (Rule 1, doc-accuracy)
**Impact on plan:** Comment-only fix, caught by the plan's own re-pinned test rather than skipped past it. No scope creep, no behaviour change.

## Issues Encountered

- The plan's `hud-menu-layout.test.js` "15 named tests" acceptance criterion required consolidating what would otherwise have been ~21 natural `test()` calls (per behaviour case) into single tests per numbered item (9's five close-trigger cases plus its source pins; 13's behaviour plus its structural pins) — resolved by grouping related assertions under one `test()` call per plan-numbered item, landing at exactly 15.
- `stale-terms.test.js` (DOCS-01/03, the retired-term sweep) flagged a local test variable named `bandPaddingH` as containing the retired substring "dpad" (case-insensitive, mid-word) — renamed to `bandHPadding`; no functional change, caught before commit.
- `fnRegion`'s "next `\nfunction `" end-marker convention (borrowed from sibling test files) doesn't terminate cleanly on `(function initMazeViewportControls() {` (an IIFE, not a named declaration) — switched that one slice to `sliceBetween(..., "\n})();")`, matching `hud-bands-layout.test.js`'s own precedent for the same region.

## Teeth Checks (run after the Task 3 commit `3a23a0b`, per this run's teeth-check-safety convention)

**(i) — the scrim's structural consumption.** Temporarily changed the scrim's onclick wiring to `() => { hudMenuEvent("outside"); window.move("N"); };` (adding a move call the real code never makes). `node --test test/unit/hud-menu-layout.test.js` → **test 8 FAILED** ("(8) BEHAVIOUR: the ☰ onclick opens the menu, and with the menu open, the scrim's onclick closes it while a counting window.move stub records zero calls" — `moveCalls` was 1, expected 0). Reverted with `git checkout -- mazeworld.html`; `git status --short mazeworld.html` confirmed empty afterward; `node --test test/unit/hud-menu-layout.test.js` confirmed green again (15/15).

**(ii) — the z-ladder.** Temporarily changed `.mw-hud-menu-wrap{position:relative;flex:none;z-index:6}` to `z-index:3` (below the rail). `node --test test/unit/hud-menu-layout.test.js` → **test 5 FAILED** ("(5) the z-ladder: rail (4) < scrim (5) < menu wrap (6) < overlay (8); ..." — assertion `rail(4) < scrim(5) < wrap(3) < overlay(8)` false). Reverted with `git checkout -- mazeworld.html`; `git status --short mazeworld.html` confirmed empty afterward; `node --test test/unit/hud-menu-layout.test.js` confirmed green again (15/15).

## Phase Gate (re-run after 57-04's, Task 3)

1. `npm test` — **3633/3633** (fail 0). Delta from 57-04's recorded 3607/3607: **+26**.
2. `npm run build:www` — exit 0.
3. `git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/` — empty.
4. `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
5. `git diff 4d43edf..HEAD -- package.json package-lock.json` — empty.
6. `node --test test/unit/bridge-registry.test.js` — **10/10** (set-equality AND doc-sync both green).
7. `npm run boot:check` — **PASS** on all four checks (no-uncaught / painted / graves / title). This run's environment did NOT reproduce 57-04's recorded Phase 50 environment-block note — a clean pass here.

No test dropped: a script comparing every touched test file's `^test(` count against BASE_05 (`a01b38e`) and the phase base (`4d43edf`) or the file's own creation commit confirms every file is at or above both floors (`test/unit/hudMenu.test.js` 7 new; `test/unit/hudBands.test.js` 19 vs 15; `test/unit/hud-menu-layout.test.js` 15 new; `test/unit/hud-bands-layout.test.js` 5 vs 5; `test/unit/shell-map-hud.test.js` 21 vs 21; `test/unit/shell-gear-toolbar.test.js` 15 vs 15; `test/unit/shell-map-invariants.test.js` 38 vs 38; `test/unit/shell-map-viewport.test.js` 36 vs 36).

`git diff --stat BASE_05..HEAD -- .planning/todos/ .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md` — empty (this plan touched none of them, as prohibited).

## human_verification (Phase 60 batched Pixel 7 session)

This list SUPERSEDES 57-04's "tapping each of MARKS / CENTRE / MAKE CAMP / gear" item — that item is now: **with the party one or two cells below band 2, open the ☰, tap each row, and confirm zero movement.**

1. On the Pixel 7, the ☰ can be reached and operated one-handed, and each of the four rows opens its sheet (or recentres) with a single tap.
2. ☰, ◈, ⊕, ☾ and ⚙ render on the Pixel 7 as text glyphs in their mock colours, with no tofu boxes and no colour-emoji substitution.
3. At text size L, nothing in band 1 overlaps (name, identity line, HP text). The ☰ is always fully visible, and band 2's counters clip only at their right edge (the width budget predicts ~34px of Rations clipped at L on a 411px screen, vs ~68px at HEAD today).
4. With the menu open, tapping the map closes the menu and the party does not move; tapping a tab closes the menu and a second tap switches tab; the map does not shift when the menu opens or closes.
5. On the Dead tab the HUD is gone and the Dead screen's first line clears the status bar.
6. **(Supersedes 57-04's chip-tap item.)** With the party one or two cells below band 2, open the ☰, tap each row (MARKS, CENTRE MAP, MAKE CAMP, SETTINGS), and confirm zero movement.

## For the orchestrator

LAYOUT-05's requirement text ("…then conditions, then chips"), ROADMAP Phase 57 success criteria 4 and 5, and `57-CONTEXT.md`'s D-05/D-06 still describe a chip band — this plan did not edit `.planning/REQUIREMENTS.md`/`.planning/ROADMAP.md`/`57-CONTEXT.md` (prohibited by this plan's own frontmatter). The orchestrator should amend those to cite the 2026-09-22 mock's ☰-menu shape when it closes the phase.

**Flagged for user confirmation** (discoveries C and F, not acted on beyond what's recorded):
- The wording table (discovery C): every mock glyph/label change adopted is limited to the ☰ menu itself, with CENTRE MAP as the one label change outside it.
- The slot-width decision (discovery D): Squares alone keeps the 5-digit slot; Depth/Day/Rations narrow to 3/3/2 digits.
- Two mock deltas NOT adopted (discovery F): the condition chips' larger mock type size, and the mock's map-only condition-chip gate (kept as HEAD's every-tab-but-Dead behaviour instead).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 57 (Map & HUD Layout Band) has no further plans queued under this phase directory beyond this one — LAYOUT-01 through LAYOUT-06 are all implemented and gated green. The orchestrator's requirement-text/ROADMAP amendment (see "For the orchestrator" above) is the only remaining phase-close housekeeping.
- Phase 58 (Motion Pacing) is already being planned concurrently (untracked `.planning/phases/58-motion-pacing/58-0N-PLAN.md` files present at dispatch, left untouched by this plan per the run's own instruction). This plan's resting-state CSS (`.mw-hud-menu[data-open="1"]`/`.mw-hud-menu-scrim[data-open="1"]`/`[aria-expanded="true"]`, all opacity/visibility/transform/pointer-events/colour only) is exactly the shape MOTION-02 needs to add a transition onto — no structural rework anticipated.
- No blockers.

## Self-Check: PASSED

All created files verified present on disk (`src/browser/hudMenu.js`, `test/unit/hudMenu.test.js`, `test/unit/hud-menu-layout.test.js`, this SUMMARY.md); all four commits (`8fb33ea`, `d2b7350`, `3a23a0b`, `9e1eca0`) verified present in `git log`. No missing items.

---
*Phase: 57-map-hud-layout-band*
*Completed: 2026-09-22*
