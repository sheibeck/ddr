---
phase: 63-action-sheet-combat-lock-accessibility
plan: 04
subsystem: ui
tags: [gear, action-sheet, shell-wiring, dialog, back-button, bridge, motion, mazeworld]

# Dependency graph
requires:
  - phase: 63-action-sheet-combat-lock-accessibility
    provides: "GEAR_SHEET_IDS + renderGearSheet(host, state, target, deps) (src/browser/gearSheet.js, Plan 02) — the sheet's DOM renderer this plan mounts into the shell"
provides:
  - "#mw-gear-sheet markup (a role=dialog/aria-modal/aria-labelledby panel on the shared legend-sheet chrome) + the .mw-gsheet-* CSS block, scaling with --mw-text-scale, no motion or ARIA-state selector of its own"
  - "openGearSheet(target, openerId) / refreshGearSheet() / closeGearSheet() on the camp-sheet pattern: showPanel/hidePanel motion, armEncounterButtons + guardTap's ghost-tap arm, the lastDismissAt settle stamp, focus to the title on open and back to the opener on close"
  - "paint()'s gearSheetTarget-gated refreshGearSheet() call: an open sheet re-reads S every frame — greyed in place the instant a fight starts (GRULE-02), closed the instant its target vanishes"
  - "the scrim tap, CANCEL and the Android back button (closeModal's first branch, one layer per press) all close the sheet; armEncounterButtons' arm sweep excludes [data-off] rows so a greyed reason stays announced"
  - "window.__mzGearSheet bridge: registered in bridge.js, generated into docs/SHELL-MODULES.md, wired in the module script and in test/unit/harness/shellSandbox.js (wireBridges + SNAPSHOT_IDS.gearSheet)"
  - "tabDeps() at 16 keys (openGearSheet/closeGearSheet added)"
  - "test/unit/gear-sheet-shell.test.js (new, 20 tests) + two declared snapshot fixtures (thief.gear-sheet-bag, thief.gear-sheet-worn)"
affects: [63-05-row-integration, 64-device-batch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The sheet's target/opener presentation state (gearSheetTarget/gearSheetOpenerId) lives as classic top-level `let`s declared directly above tabDeps(), never on S — mirrors every other Phase 58 presentation-only bridge state in this file"
    - "refreshGearSheet() is the ONE re-render path paint() and openGearSheet/closeGearSheet's own callers all share — it re-derives from S and the stored target on every call, closing itself (never leaving stale DOM) the instant window.__mzGearSheet returns false"
    - "The module script's closeModal reads the classic script's gearSheetTarget/closeGearSheet by bare identifier — the same cross-script global-environment resolution S and closeCampSheet already rely on, no new bridge needed for it"

key-files:
  created:
    - test/unit/gear-sheet-shell.test.js
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/gearTab.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-map-invariants.test.js

key-decisions:
  - "The GRULE-02 combat re-render test drives context.refreshGearSheet() directly rather than sandbox.paint() — the plan's own documented fallback. paint() also mounts hero/gear tabs and renderEncounter() for the WHOLE screen, which for a combat.pending fixture pulls in pending-Fight!-preview rendering this harness has no existing coverage building for; refreshGearSheet() is the exact call paint() itself makes once gearSheetTarget is non-null (proven by its own source pin), so the test exercises the real production code path with no unrelated risk."
  - "The new test file's own 'no aria- token' CSS check is bounded to a precise, self-controlled slice (the Phase 63 header comment through the next rule this plan did not add, .mw-roller-screen{) rather than a generic 'next /* ---------- header' search — the next such header in the file sits well past </style>, inside body markup that legitimately carries aria-hidden/aria-label attributes, which a naive generic bound would have falsely flagged."
  - "Rule 1 (auto-fixed bugs, three pre-existing regression-guard tests): this plan's own must_have paint()/closeGearSheet() changes necessarily grew two literal-count pins these tests hard-code. Re-pinned reduced-motion.test.js's paint()-modularity SHA-256 (the one gearSheetTarget-gated refreshGearSheet() statement) on the exact precedent Phase 59 Plan 05 already set for draw()'s own re-pin, and bumped shell-map-hud.test.js's/shell-map-invariants.test.js's lastDismissAt-stamp counts from 3 to 4 (closeGearSheet()'s own stamp, on the closeCampSheet/closeMarksLegend pattern those tests already lock)."

requirements-completed: [GSCR-07, GSCR-08, GSCR-10, GRULE-02]

coverage:
  - id: D1
    description: "#mw-gear-sheet markup (hidden .mw-legend-sheet, scrim, role=dialog/aria-modal/aria-labelledby panel, tabindex=-1 title, a real CANCEL button, every GEAR_SHEET_IDS id exactly once) + the .mw-gsheet-* CSS block (every font-size scales with --mw-text-scale, no transition/animation of its own, no ARIA-state selector, [data-off] greys the row and hides the chevron)"
    requirement: "GSCR-07"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — markup:... / CSS:... (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "openGearSheet/refreshGearSheet/closeGearSheet on the camp-sheet pattern: motion (showPanel/hidePanel, reduced-motion snaps instantly), armEncounterButtons' ghost-tap arm, the lastDismissAt settle stamp, focus to the title on open and back to the opener on close (a 0ms timer after the dispatch-driven repaint)"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — sandbox open:.../sandbox close under reduced motion:.../sandbox close under motion:.../sandbox CANCEL:.../sandbox unresolvable:..."
        status: pass
    human_judgment: false
  - id: D3
    description: "The sheet closes on a scrim tap, CANCEL and the Android back button — closeModal closes it first, one layer per press, before the stair/camp/legend/beats/store handling; hasOpenModal ORs in its visibility; closeGearSheet is idempotent"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — source pin: the scrim tap closes the sheet / hasOpenModal ORs in.../closeModal closes the Gear sheet first..."
        status: pass
    human_judgment: false
  - id: D4
    description: "paint()'s gearSheetTarget-gated refreshGearSheet() call: a fight starting while the sheet is open greys the affected action in place with the Phase 61 gearRefused line; ending the fight makes it live again; a vanished target closes the sheet on the next paint()"
    requirement: "GRULE-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-shell.test.js — sandbox combat re-render (GRULE-02):... / sandbox vanish:..."
        status: pass
    human_judgment: false
  - id: D5
    description: "window.__mzGearSheet bridge registered in bridge.js and regenerated into docs/SHELL-MODULES.md; tabDeps() at 16 keys (openGearSheet/closeGearSheet); the harness (shellSandbox.js) mirrors the real bridge with no existing snapshot moved"
    requirement: "GSCR-07"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js / test/unit/gearTab.test.js — ...names all 16 deps keys / test/unit/gear-sheet-shell.test.js — source pin: window.__mzGearSheet = renderGearSheet; precedes await boot("
        status: pass
    human_judgment: false
  - id: D6
    description: "Two new declared sheet snapshots (thief.gear-sheet-bag: the bagged third jewel with both SWAP INTO slots + DROP; thief.gear-sheet-worn: jewelry1 with UNEQUIP greyed by the full bag), byte-safe via the renderer's own createElement/textContent-only encoding (GSCR-08, inherited from Plan 02); every pre-existing fixture stays byte-identical"
    requirement: "GSCR-08"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js — SHELL-01 (Phase 63): thief.gear-sheet-bag.../thief.gear-sheet-worn... / guard: all nine fixtures exist and are non-empty"
        status: pass
    human_judgment: false
  - id: D7
    description: "GSCR-10's device-level confirmation: how TalkBack actually reads the sheet's dialog/labelledby/focus semantics, and how the Android hardware back button feels on a Pixel 7"
    requirement: "GSCR-10"
    verification: []
    human_judgment: true
    rationale: "Per this plan's own flagged assumption (must_haves.assumptions), the close paths, motion paths and dialog semantics ARE proven automatically (D1-D3 above); only the actual TalkBack narration and the hardware back button's real-device feel are carried to Phase 64's GSCR-12 device batch, never auto-backstopped."
  - id: D8
    description: "GRULE-02's in-hand device check: opening the Gear tab mid-fight, seeing the greyed rows, then seeing them live again after the fight ends, on an actual device"
    requirement: "GRULE-02"
    verification: []
    human_judgment: true
    rationale: "Per this plan's own flagged assumption (must_haves.assumptions), the model (Plan 01), the engine sweep (Plan 03) and this plan's own live re-render (D4 above) prove the logic automatically; the tactile in-hand confirmation is carried to Phase 64's device batch."

duration: 35min
completed: 2026-09-23
status: complete
---

# Phase 63 Plan 04: Shell Wiring Summary

**Mounts the GEAR action sheet in the shell on the existing camp-sheet pattern — `#mw-gear-sheet` markup/CSS, `openGearSheet`/`refreshGearSheet`/`closeGearSheet`, a `paint()` re-render that greys the sheet in place when a fight starts, scrim/CANCEL/back-button close paths, the `window.__mzGearSheet` bridge, and two new declared DOM snapshots.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-23T10:53:21-04:00 (worktree base commit)
- **Completed:** 2026-09-23T11:28:11-04:00
- **Tasks:** 3
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments

- `#mw-gear-sheet` declared as a hidden-by-default `.mw-legend-sheet` dialog (scrim + `role="dialog"`/`aria-modal="true"`/`aria-labelledby="mw-gear-sheet-title"` panel, a `tabindex="-1"` `<h2>` title, a real `<button type="button">` CANCEL) holding every `GEAR_SHEET_IDS` id, plus the `.mw-gsheet-*` CSS block — every font-size `calc(<rem> * var(--mw-text-scale))`, no transition/animation of its own (the rise/fade/close ride the shared legend chrome), no ARIA-state selector anywhere in the block.
- `openGearSheet(target, openerId)` / `refreshGearSheet()` / `closeGearSheet()` on the camp-sheet pattern: `showPanel`/`hidePanel` motion (reduced motion snaps instantly), `armEncounterButtons()` restarts the 250ms ghost-tap guard on every open/refresh, `lastDismissAt` is stamped at close's call time, focus moves to the title on open and back to the opener on close (a 0ms timer, after the dispatch-driven repaint rebuilds the row). An unresolvable target opens nothing.
- `paint()` gained exactly one guarded statement — `if (gearSheetTarget !== null) refreshGearSheet();` — directly after the gear-tab mount: an open sheet re-reads `S` and the stored target every frame, greying the affected action in place the instant a fight starts (GRULE-02) and closing itself the instant its target vanishes.
- `armEncounterButtons`' arm sweep now excludes `[data-off]` rows (`:not([data-off])`) so a greyed Gear-sheet action keeps its disabled state and reason for TalkBack, while live actions still lose their arm marker after `ARM_DELAY_MS`.
- The Android back button's `closeModal` closes the Gear sheet first and returns — one layer per press, before the stair/camp/legend/beats/store handling; `hasOpenModal` ORs in the sheet's visibility.
- `window.__mzGearSheet` bridge: registered in `bridge.js` (alphabetical), regenerated into `docs/SHELL-MODULES.md`'s bridge table via `tools/bridge-doc.mjs --write`, assigned in the module script before the first `boot()`, and wired into `test/unit/harness/shellSandbox.js` (`wireBridges` + `SNAPSHOT_IDS.gearSheet`). `tabDeps()` is now 16 keys.
- `test/unit/gear-sheet-shell.test.js` (new, 20 tests): markup, CSS (font-size scaling, no transition/animation, no `aria-` token, `[data-off]` greying), nine source pins (`tabDeps`, the `paint()` region, the lets' declaration order, the arm-sweep exclusion, the scrim wiring, `hasOpenModal`/`closeModal` ordering, the bridge assignment before `boot()`), and eight sandbox lifecycle tests: open (title, action keys, focus), an unresolvable target, close under reduced motion and under real motion (the 0ms focus-return timer), CANCEL, DROP's close-before-dispatch order (GSCR-09), the vanish-close, and the GRULE-02 live combat re-render.
- Two new declared snapshot fixtures — `thief.gear-sheet-bag.txt` (the bagged third jewel, both SWAP INTO slots + DROP) and `thief.gear-sheet-worn.txt` (jewelry1, UNEQUIP greyed by the full bag) — captured with `MZ_SNAPSHOT_UPDATE=1 node --test --test-name-pattern="gear-sheet"`; confirmed as the ONLY untracked fixture files, and every pre-existing fixture stays byte-identical (`git diff --stat` empty).

## Task Commits

Each task was committed atomically:

1. **Task 1: #mw-gear-sheet markup and the Phase 63 sheet CSS block** - `b9df0e4` (feat) — `mazeworld.html`
2. **Task 2: Classic lifecycle, paint() refresh, tabDeps, arm-sweep, back button, bridge, registry and harness** - `3ad592b` (feat) — `mazeworld.html`, `src/browser/bridge.js`, `docs/SHELL-MODULES.md`, `test/unit/harness/shellSandbox.js`, `test/unit/reduced-motion.test.js` (Rule 1 re-pin)
3. **Task 3: Shell suite, two declared sheet snapshots, tabDeps pin and the SHELL-MODULES contract** - `9748c13` (test) — `test/unit/gear-sheet-shell.test.js`, `test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt`, `test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt`, `test/unit/gearTab.test.js`, `test/unit/shell-tab-snapshots.test.js`, `docs/SHELL-MODULES.md`, `test/unit/shell-map-hud.test.js` (Rule 1 re-pin), `test/unit/shell-map-invariants.test.js` (Rule 1 re-pin)

## Files Created/Modified

- `mazeworld.html` — `#mw-gear-sheet` markup + `.mw-gsheet-*` CSS; `gearSheetTarget`/`gearSheetOpenerId` lets; `tabDeps()`'s two new keys; `paint()`'s `refreshGearSheet()` call; `armEncounterButtons`' arm-sweep exclusion; `openGearSheet`/`refreshGearSheet`/`closeGearSheet` + the scrim listener; `hasOpenModal`/`closeModal`'s Gear-sheet branch; the module script's `renderGearSheet` import + `window.__mzGearSheet` assignment
- `src/browser/bridge.js` — `__mzGearSheet` entry (alphabetical)
- `docs/SHELL-MODULES.md` — `gearSheet.js` in the module list; the 16-key deps contract naming `openGearSheet`/`closeGearSheet`; a new "Gear action sheet (Phase 63)" subsection; the regenerated bridge table
- `test/unit/harness/shellSandbox.js` — `renderGearSheet` import, `w.__mzGearSheet` wiring, `SNAPSHOT_IDS.gearSheet`
- `test/unit/gear-sheet-shell.test.js` — new, 20 tests (markup/CSS/source pins/sandbox lifecycle)
- `test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt`, `thief.gear-sheet-worn.txt` — two new declared fixtures
- `test/unit/gearTab.test.js` — tabDeps key pin, 14 -> 16 keys
- `test/unit/shell-tab-snapshots.test.js` — two new fixture-capturing tests, the guard test's list/title (seven -> nine fixtures), the header comment
- `test/unit/reduced-motion.test.js` — Rule 1: re-pinned the `paint()`-modularity SHA-256 (renamed `PRE58_PAINT_SHA256` -> `PAINT_SHA256`)
- `test/unit/shell-map-hud.test.js`, `test/unit/shell-map-invariants.test.js` — Rule 1: re-pinned the `lastDismissAt = Date.now()` count (3 -> 4)

## Decisions Made

- The GRULE-02 combat re-render test drives `context.refreshGearSheet()` directly rather than `sandbox.paint()` — the plan's own documented fallback for exactly this case. `paint()` also mounts the hero/gear tabs and `renderEncounter()` for the whole screen, which for a `combat.pending` fixture pulls in pending-Fight!-preview rendering this harness has no existing coverage building for; `refreshGearSheet()` is the exact call `paint()` itself makes once `gearSheetTarget` is non-null (proven by its own source pin in the new suite), so the test exercises the real production code path with no unrelated risk.
- The new test file's "no `aria-` token" CSS check is bounded to a precise, self-controlled slice (the Phase 63 header comment through `.mw-roller-screen{`, the next rule this plan did not add) rather than a generic "next `/* ----------` header" search — the next such header in the file sits well past `</style>`, inside body markup that legitimately carries `aria-hidden`/`aria-label` attributes, which a naive generic bound would have falsely flagged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing paint()-modularity SHA-256 pin blocked this plan's own must_have paint() change**
- **Found during:** Task 2 (paint()'s `refreshGearSheet()` call)
- **Issue:** `reduced-motion.test.js` hard-pinned `paint()`'s comment-stripped body to a SHA-256 computed before Phase 58, asserting no later plan may grow it — this plan's own must_have (`if (gearSheetTarget !== null) refreshGearSheet();`) legitimately does.
- **Fix:** Re-pinned the constant (renamed `PRE58_PAINT_SHA256` to `PAINT_SHA256`) to the SHA-256 of `paint()`'s new body, on the exact precedent Phase 59 Plan 05 already set for `draw()`'s own re-pin in this same file; updated the comment and test title to describe the Phase 63 addition.
- **Files modified:** `test/unit/reduced-motion.test.js`
- **Verification:** `node --test test/unit/reduced-motion.test.js` green (120/120 across the Task 2 verify list)
- **Committed in:** `3ad592b` (Task 2 commit)

**2. [Rule 1 - Bug] Two pre-existing lastDismissAt count-pins blocked this plan's own must_have closeGearSheet() stamp**
- **Found during:** Task 3 (`npm test` full-suite run)
- **Issue:** `shell-map-hud.test.js` and `shell-map-invariants.test.js` each hard-pinned `lastDismissAt = Date.now()`'s literal occurrence count to 3 — this plan's own must_have `closeGearSheet()` (mirroring `closeCampSheet`/`closeMarksLegend`) legitimately adds a fourth.
- **Fix:** Bumped both pins from 3 to 4, with a comment naming the Phase 63 addition.
- **Files modified:** `test/unit/shell-map-hud.test.js`, `test/unit/shell-map-invariants.test.js`
- **Verification:** `npm test` — the only two genuinely new failures cleared; the remaining 7 failures are the documented pre-existing worktree-CRLF ledger noise (`class-pass-ledger.test.js`/`flee-ledger.test.js`, confirmed byte-identical to the worktree's base commit)
- **Committed in:** `9748c13` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing regression-guard tests this plan's own must_have changes legitimately grew, each re-pinned on an established same-file precedent).
**Impact on plan:** Both fixes were necessary to land the plan's own explicitly required `paint()`/`closeGearSheet()` changes. No scope creep — no behavior changed beyond what the plan specifies; only test literal pins were updated to match.

## Issues Encountered

- A plan acceptance-criteria grep (`grep -c "w.__mzGearSheet = renderGearSheet;" test/unit/harness/shellSandbox.js` = 1) initially returned 2 because my own explanatory comment above the assignment happened to end in text containing the same substring (`window.__mzGearSheet = renderGearSheet;` — "windo" + "w.__mzGearSheet..." collides). Reworded the comment to remove the incidental substring match; re-verified the count is exactly 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The sheet opens, refreshes and closes programmatically end to end. Plan 05 (row integration) wires the Gear tab's WORN rows and BAG cards to call `openGearSheet` and removes the Phase 62 interim in-row actions this sheet replaces.
- `npm run build:www && npm test`: 4176 tests (4154 baseline + 22 new), 4169 pass, 7 known pre-existing CRLF-checkout false-fails (`class-pass-ledger.test.js`/`flee-ledger.test.js`, confirmed byte-identical to the worktree's base commit). `npm run boot:check`: all four checks (no-uncaught, painted, graves, title) passed on the first run — no re-run needed for the documented graves-timing flake.
- No byte changes to `engine/`, `content/` or `test/parity/` (confirmed via `git diff --stat` against those paths — empty).
- GSCR-10's TalkBack narration and Android hardware back-button feel, and GRULE-02's in-hand mid-fight check, are carried forward to Phase 64's device batch per this plan's own flagged assumptions (D7/D8 in the coverage block above) — not auto-backstopped here.

---
*Phase: 63-action-sheet-combat-lock-accessibility*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/gear-sheet-shell.test.js
- FOUND: test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt
- FOUND: test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt
- FOUND: test/unit/gearTab.test.js
- FOUND: test/unit/shell-tab-snapshots.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/shell-map-hud.test.js
- FOUND: test/unit/shell-map-invariants.test.js
- FOUND: .planning/phases/63-action-sheet-combat-lock-accessibility/63-04-SUMMARY.md
- FOUND commit: b9df0e4 (feat(63-04): #mw-gear-sheet markup and the Phase 63 sheet CSS block)
- FOUND commit: 3ad592b (feat(63-04): classic lifecycle, paint() refresh, tabDeps, arm-sweep, back button, bridge, registry and harness)
- FOUND commit: 9748c13 (test(63-04): shell suite, two declared sheet snapshots, tabDeps pin and the SHELL-MODULES contract)
