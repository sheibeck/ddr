---
phase: 33-ui-feel-store-polish
plan: 02
subsystem: ui
tags: [shell, gear-panel, drop-confirm, settings, toolbar]

# Dependency graph
requires:
  - phase: 33-ui-feel-store-polish
    plan: 01
    provides: "state.storeRoll landed but independent of this plan — 33-02 is shell/settings-only and has no engine dependency on it"
provides:
  - "GEAR tab carried rows: a real side-by-side action row (.mw-gear-actions) with Use/Equip left, Drop pinned far right"
  - "An inline two-tap Drop confirm ('Drop it? [Yes] [No]') that reverts on a 3s setTimeout, on No, or on any pointerdown outside the confirm — dispatches the existing window.mzDropItem bridge, no new engine action"
  - "MAKE CAMP moved into the Marks/Centre chip row as its far-right .mw-chip; the control bar (.mazefoot) now holds only the centered D-pad"
  - "The Handedness settings option removed end to end: markup row, #app[data-handedness] CSS, applySettings' setAttribute, settings.js's handedness field/comment — a stored handedness value is now ignored silently (not migrated, not erased)"
affects: [33-03-map-zoom-recenter-storecopy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-local drop-confirm state (dropConfirmRevert closure), never on S — exactly one row armed at a time via a document-level capture pointerdown listener + a setTimeout revert (never a CSS transition)"
    - "opts.gearRow as an opt-in flag on the shared renderCarriedList() component — re-parents already-appended buttons into a new .mw-gear-actions flex row post-loop rather than reordering the actions array, keeping every non-gear host (store sell list, combat use-list, loot card) byte-identical"

key-files:
  created:
    - test/unit/shell-gear-toolbar.test.js
  modified:
    - mazeworld.html
    - src/browser/settings.js
    - test/unit/settings.test.js

key-decisions:
  - "Drop confirm's Yes handler reverts the armed row BEFORE dispatching mzDropItem, so the paint() re-render triggered by the drop never finds a stale armed confirm; a re-render that happens while still armed just drops the detached wrap node (wrap.isConnected guard) and the pending timer's later revert becomes a no-op."
  - "The gearRow re-parent step runs AFTER the existing per-action mkBtn() loop and moves already-created buttons into a new .mw-gear-actions <div>, rather than changing how/when buttons are built — every pinned mkBtn literal (Use, non-gear Drop, the guard ternary) stays byte-identical for the other three renderCarriedList hosts."
  - "writeSetting('handedness', ...) is now a no-op (unrecognized key) rather than a schema migration — a persisted blob that still carries the old key is never read back into the returned settings object (readSettings only merges SETTINGS_DEFAULTS keys) and is never rewritten by a write to the removed key."

requirements-completed: [UIF-01, UIF-05]

coverage:
  - id: D1
    description: "GEAR tab carried rows show one flex action row (Use/Equip immediately left of Drop, Drop pinned far right, all >=48dp) instead of stacked buttons"
    requirement: "UIF-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: the gear action row + drop-confirm building blocks are all present, once each"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: .mw-gear-actions carries display:flex, width:100% and touch-action:manipulation; no transition/animation token"
        status: pass
    human_judgment: false
  - id: D2
    description: "Drop arms an inline two-tap confirm ('Drop it? [Yes] [No]') that reverts after ~3s, on No, or on any outside tap; Yes dispatches the existing dropItem action for any bag item including potions; only one row can be armed at a time"
    requirement: "UIF-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: the setTimeout revert lives inside the renderCarriedList region, once"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: Yes dispatches through the existing mzDropItem bridge (no new engine action)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: engine/actions.js still whitelists dropItem (no new engine action added)"
        status: pass
    human_judgment: true
    rationale: "The revert-on-outside-tap and revert-on-second-row-arm behaviors are timer/DOM-event driven; the source pins prove the wiring exists and is singular, but the actual felt behavior (does a real tap correctly revert, does the confirm visually replace Drop in place on a Pixel 7) needs a device pass — see Human verification below."
  - id: D3
    description: "Equipped weapon/armor rows keep the Unequip path (no Drop on a worn slot); store sell list, combat use-list and loot card render byte-identically (gearRow:true passed at exactly the GEAR call site)"
    requirement: "UIF-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: gearRow:true is passed at exactly the GEAR call site"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-01: guard:true still occurs exactly twice (Phase 32's ratified list unchanged)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-input-guards.test.js, test/unit/shell-loot-screen.test.js, test/unit/shell-fight-gate.test.js (unedited, green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "MAKE CAMP is the far-right chip of the Marks/Centre row above the map; the control bar below the map holds only the centered D-pad"
    requirement: "UIF-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-05: the chip row holds Marks, Centre, then the camp chip, in that order"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-05: the control bar's own markup (before the D-pad) holds no button"
        status: pass
      - kind: unit
        ref: "test/unit/shell-party-camp.test.js (unedited, green — onclick/short-state wiring intact)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Handedness option is removed end to end (settings row, data-handedness attribute/CSS, applySettings, settings.js field) and a stored handedness value is ignored silently, never migrated or erroring"
    requirement: "UIF-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-05: no trace of the former handed-layout option remains in the shell"
        status: pass
      - kind: unit
        ref: "test/unit/shell-gear-toolbar.test.js#UIF-05: settings.js has no trace of handedness and exposes exactly 5 fields, in order"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#Phase 33 (UIF-05): a stored handed-layout key is ignored silently"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-16
status: complete
---

# Phase 33 Plan 02: UIF-01 gear action row + Drop confirm, UIF-05 Make Camp/Handedness Summary

**GEAR rows get one flex action row (Use/Equip left, Drop far right) with an inline two-tap Drop confirm dispatching the existing `dropItem` bridge; Make Camp moved into the Marks/Centre chip row and the Handedness option is fully removed.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-09-16T19:00:00Z (approx.)
- **Completed:** 2026-09-16T19:18:00Z
- **Tasks:** 3
- **Files modified:** 3 modified, 1 created

## Accomplishments
- `mazeworld.html#renderCarriedList`: a new `opts.gearRow` branch re-parents each row's already-built buttons into a `.mw-gear-actions` flex `<div>` (Use/Equip left, `.mw-gear-drop` pushed to the far right via `margin-left:auto`) — passed `true` at exactly one call site, the GEAR tab's `renderCarriedList(carry, items, {...})`
- The inline two-tap Drop confirm: `mkDropConfirm(i)` replaces the row's Drop button in place with a `.mw-drop-confirm` span ("Drop it?" + Yes/No), armed via `DROP_CONFIRM_MS = 3000` `setTimeout` and a document-level capture `pointerdown` listener that reverts on any tap outside the confirm; `revertDropConfirm()` is the single disarm path (module-level `dropConfirmRevert` closure ensures only one row is ever armed); Yes reverts first, then dispatches `window.mzDropItem?.(i)` — the pre-existing engine bridge, no new engine action
- MAKE CAMP markup moved from `.mazefoot` into `.mw-viewport-chips` as its last `.mw-chip` child (`margin-left:auto`); `.mazefoot` now holds only the centered D-pad; the button keeps its `id="btn-camp"` so the existing `onclick`/short-state (`campBtn.dataset.short`) wiring needed zero changes
- The Handedness option removed everywhere: the settings-sheet row, `#app[data-handedness]` attribute + its two CSS rules, `applySettings()`'s `setAttribute` call, and `src/browser/settings.js`'s `handedness` field/`ALLOWED_VALUES` entry — `readSettings()`'s existing "only merge recognized keys" mechanism makes a stale persisted `handedness` value inert with zero migration code
- `test/unit/shell-gear-toolbar.test.js` (new, 16 tests): pins the gear action row, the drop-confirm building blocks, the single `gearRow:true` call site, the untouched non-gear Drop/guard-ternary/Use literals, the camp-chip DOM order and markup, the empty control-bar region, and the complete absence of `handedness` from both `mazeworld.html` and `settings.js`

## Task Commits

Each task was committed atomically:

1. **Task 1: GEAR rows — the .mw-gear-actions flex row and the inline two-tap Drop confirm with a setTimeout revert** - `8673daf` (feat)
2. **Task 2: Make Camp into the Marks/Centre row, D-pad centered, Handedness removed end to end** - `962a13d` (feat)
3. **Task 3: test/unit/shell-gear-toolbar.test.js — pin the gear row, the confirm, the camp chip and the handedness removal** - `ff8cef6` (test)

## Files Created/Modified
- `mazeworld.html` - `DROP_CONFIRM_MS`/`revertDropConfirm()` above `renderCarriedList`; `mkDropConfirm()` + the `opts.gearRow` drop branch and post-loop re-parent block inside it; `.mw-gear-actions`/`.mw-drop-confirm` CSS beside `ul.skills li i`; `gearRow: true` at the GEAR call site; `#btn-camp` moved into `.mw-viewport-chips` as a `.mw-chip`; `.mw-viewport-chips{...right:8px}` + `.mw-viewport-chips #btn-camp{margin-left:auto}`; the two `#btn-camp:hover/:active` rules and both `#app[data-handedness=...]` rules deleted; the Handedness settings row, `#app`'s `data-handedness` attribute and `applySettings`' `setAttribute` line deleted
- `src/browser/settings.js` - `handedness` removed from `SETTINGS_DEFAULTS` and `ALLOWED_VALUES`; header/field-count comments rewritten to five fields
- `test/unit/settings.test.js` - re-pinned to the five remaining fields (round-trip, invalid-value, partial-blob tests); the "defaults to 'left'" test deleted; new "a stored handed-layout key is ignored silently" test added
- `test/unit/shell-gear-toolbar.test.js` (new) - the full UIF-01/UIF-05 pin suite (16 tests)

## Decisions Made
See `key-decisions` in frontmatter — no decisions deviated from the plan's specified approach; these are implementation-detail rationales worth surfacing for future readers.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep/line-order check in the plan (constant counts, region-scoped CSS checks, pinned literal counts, `git diff --stat` scoping) passed on the first implementation pass; no auto-fixes were needed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UIF-01 and UIF-05 are code-complete and covered by source-assertion tests; no engine/content/parity change from this plan (verified: `git diff --stat 97a0e8a..HEAD -- engine content test/parity` lists only Plan 01's files).
- Plan 03 (UIF-02/03 map recenter/zoom + STORE-01 header copy) has no dependency on this plan's shell changes and can proceed independently.
- No blockers.

## Human verification (deferred to end of run)

UAT is deferred to the end of the autonomous run per this plan's execution context — never paused for a device check. Record these Pixel 7 items for the end-of-run verification pass:

1. **Gear tab with a potion, a spare weapon and a treasure in the bag** — each row shows the name/detail line and beneath it Use (or Equip) immediately left of Drop, Drop flush to the right edge, all buttons visibly tappable (>=48dp).
2. **Tap Drop** — the button becomes "Drop it? [Yes] [No]" in place; wait ~3s — it reverts back to Drop; tap Drop then tap anywhere else on screen — it reverts; tap Drop then No — it reverts; tap Drop then Yes on the potion — the potion leaves the bag (existing toast/Oracle line as today).
3. **Tap Drop on one row then Drop on another row** — only the second row stays armed; the first reverts automatically.
4. **The worn weapon/armor rows** — still show Unequip, never Drop.
5. **Open a store with a full bag** — the Sell/Drop rows look exactly as before (no confirm, stacked as today).
6. **Map tab** — MAKE CAMP is the right-most chip of the Marks/Centre strip above the map; the D-pad is centered alone under the map; camp still visibly dims when short on food and still camps on tap; the transient top-center flash label never permanently covers the chips.
7. **Settings** — no Handedness row present; text size / sound / haptics / confirm-before-quit still round-trip correctly.

## Self-Check

**Files exist:**
- FOUND: test/unit/shell-gear-toolbar.test.js
- FOUND: mazeworld.html, src/browser/settings.js, test/unit/settings.test.js (all modified, verified via `git diff --stat`)

**Commits exist:**
- FOUND: 8673daf (feat(33-02): GEAR rows ...)
- FOUND: 962a13d (feat(33-02): Make Camp joins the Marks/Centre row ...)
- FOUND: ff8cef6 (test(33-02): pin the GEAR action row ...)

**Test counts:**
- `npm test` -> `# tests 1941`, `# pass 1941`, `# fail 0` (baseline 1925 + 16 new from shell-gear-toolbar.test.js; settings.test.js's own count is unchanged — one test removed, one added)
- `git status --porcelain test/unit/shell-party-camp.test.js test/unit/shell-input-guards.test.js test/unit/shell-loot-screen.test.js test/unit/shell-armor-display.test.js test/unit/shell-fight-gate.test.js test/unit/shell-round-card.test.js test/unit/shell-toast-wiring.test.js` -> empty (all unedited on disk)
- `grep -ci handedness mazeworld.html` -> 0; `grep -ci handedness src/browser/settings.js` -> 0
- `git diff --stat 97a0e8a..HEAD -- engine content test/parity` -> only Plan 01's files (content/index.js, content/store-stock.js, engine/economy.js, engine/saveState.js, engine/state.js, test/parity/{combat,magic,movement}-parity.test.js, test/parity/harness/comparables.js) — nothing from this plan

## Self-Check: PASSED

---
*Phase: 33-ui-feel-store-polish*
*Completed: 2026-09-16*
