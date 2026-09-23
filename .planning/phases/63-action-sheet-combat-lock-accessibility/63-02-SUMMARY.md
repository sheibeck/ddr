---
phase: 63-action-sheet-combat-lock-accessibility
plan: 02
subsystem: ui
tags: [gear, action-sheet, dom-renderer, accessibility, dispatch-order, drop-confirm, mazeworld]

# Dependency graph
requires:
  - phase: 63-action-sheet-combat-lock-accessibility
    provides: "gearSheetModel(state, target) + GEAR_SHEET_COPY (src/browser/gearSheet.js, Plan 01) — the pure header/actions view model this renderer turns into DOM, unchanged"
provides:
  - "renderGearSheet(host, state, target, deps): the sheet's DOM renderer — fills GEAR_SHEET_IDS from the model alone via createElement/textContent/setAttribute/dataset only"
  - "GEAR_SHEET_IDS: the six frozen DOM root ids Plan 04's markup must declare inside #mw-gear-sheet"
  - "SHEET_DROP_CONFIRM_MS/revertSheetDrop: DROP's module-local tap-again confirm state"
affects: [63-03-engine-agreement-sweep, 63-04-shell-lifecycle, 63-05-row-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every enabled action closes the sheet (deps.closeGearSheet) BEFORE dispatching exactly one tabDeps() bridge (dispatchRun) — proven in an ordered shared-log spy across every action type, DROP's second tap included"
    - "A greyed action (a.enabled === false) gets data-off/aria-disabled and literally no click handler assigned — not a disabled-but-wired button"
    - "DROP's tap-again confirm mirrors gearTab.js's DROP_CONFIRM_MS/dropConfirmRevert pattern under distinct names (SHEET_DROP_CONFIRM_MS/sheetDropRevert/revertSheetDrop) so the two modules' once-each source pins never collide"

key-files:
  created: []
  modified:
    - src/browser/gearSheet.js
    - test/unit/gear-sheet-dom.test.js

key-decisions:
  - "Task 1 shipped every enabled action (including DROP) as a plain close-then-dispatch handler with a no-op revertSheetDrop() stub; Task 2 replaced only the stub and added the a.confirm branch — this kept both commits' behavior exactly matching their own test scope"
  - "GEAR_SHEET_IDS elements are addressed via doc.getElementById(id) directly (never host.querySelector), mirroring gearTab.js's own head()/el() id-driven style, since Plan 04's markup declares these ids inside #mw-gear-sheet but the renderer never assumes DOM containment"
  - "A hostile item name used to prove GSCR-08 encoding in a BAG-card slot (not a worn row) needs kind:\"jewel\" (engine/derived.js's slotFor kind-based fallback), not kind:\"jewelry\" — SLOT_OF only resolves canonical in-game item names by string; a worn-row placement of the same tricky name works with either kind since worn rows are read by fixed key, never through slotFor"

requirements-completed: [GSCR-07, GSCR-08, GSCR-09, GSCR-10, GRULE-02]

coverage:
  - id: D1
    description: "renderGearSheet(host, state, target, deps) fills the six GEAR_SHEET_IDS from gearSheetModel via createElement/textContent only and returns true; returns false and touches nothing for a vanished/unresolvable target"
    requirement: "GSCR-07"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — renderGearSheet: fills label/title/note/why... / Vanished target: returns false... / Returns true for every resolvable target..."
        status: pass
    human_judgment: false
  - id: D2
    description: "Every action is a real <button type=button class=mw-gsheet-act> in model order with aria-label, a label span, a sub span (id mw-gear-sheet-sub-<n>) named by aria-describedby, and an aria-hidden chevron"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — Actions: one <button class=mw-gsheet-act> per model action in order..."
        status: pass
    human_judgment: false
  - id: D3
    description: "A greyed action carries data-off/aria-disabled and no click handler; an enabled action is wired through deps.guardTap; #mw-gear-sheet-why shows the model's why and is hidden when empty"
    requirement: "GRULE-02"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — Greyed: the thief fixture's jewelry1 UNEQUIP... / Combat: SWAP INTO WEAPON greys with the model's reason... / Every greyed action across the mu fixture's armor sheet..."
        status: pass
    human_judgment: false
  - id: D4
    description: "Every enabled non-confirm action calls deps.closeGearSheet() then exactly one dispatch dep with the model's run arguments (equipItem/unequip/useItem/dropItem), equipItem never passing an explicit undefined second arg"
    requirement: "GSCR-09"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — Enabled actions:... / Weapon swap dispatch:... / Bag staff USE:... / Edge GSCR-09/ordering:..."
        status: pass
    human_judgment: false
  - id: D5
    description: "DROP is a tap-again confirm: first tap arms in place (relabels, dataset.armed, dispatches nothing); second tap within 3000ms reverts+closes+dispatches; a 3000ms timeout or any re-render reverts an armed DROP; the armed state is module-local, never on state"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — DROP first tap:... / DROP second tap within the window:... / DROP reverts after SHEET_DROP_CONFIRM_MS:... / Re-render while armed reverts:..."
        status: pass
    human_judgment: false
  - id: D6
    description: "CANCEL reads CANCEL and is wired through deps.guardTap to deps.closeGearSheet()"
    requirement: "GSCR-10"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — CANCEL: reads CANCEL and is wired through guardTap to closeGearSheet"
        status: pass
    human_judgment: false
  - id: D7
    description: "A hostile item name (apostrophe, quotes, markup, emoji) renders verbatim through textContent in the bag title, SWAP FOR/EQUIP labels and SWAP INTO/comes-off subs; no node under the six ids carries an HTML-string write; the file has zero HTML-string sinks and no window/document global"
    requirement: "GSCR-08"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — Edge GSCR-08/encoding:... (x2) / No node under the six GEAR_SHEET_IDS carries an HTML-string write / Module contract:..."
        status: pass
    human_judgment: false
  - id: D8
    description: "Rendering the same target twice on one host serializes byte-identically; the serialized sheet carries no standalone wp/WP token; engine/content/parity/mazeworld.html/gearTab.js/fixtures untouched; full suite green modulo the documented worktree CRLF ledger noise"
    verification:
      - kind: unit
        ref: "test/unit/gear-sheet-dom.test.js — Idempotency:... / No WP:... ; npm run build:www && npm test (4154 tests, 4147 pass, 7 known ledger false-fails)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-23
status: complete
---

# Phase 63 Plan 02: Gear Action-Sheet DOM Renderer Summary

**`renderGearSheet(host, state, target, deps)` — turns Plan 01's `gearSheetModel` into the sheet's DOM: one real accessible `<button>` per action, greyed rows that explain and never dispatch, DROP's tap-again confirm, and a close-then-dispatch order proven for every action shape.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-23T14:45:00Z (approx, from worktree base commit)
- **Completed:** 2026-09-23T15:30:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/browser/gearSheet.js` gains `GEAR_SHEET_IDS` (the six frozen DOM root ids), `renderGearSheet(host, state, target, deps)`, `dispatchRun`, `buildActionButton`, `SHEET_DROP_CONFIRM_MS`/`revertSheetDrop`/`makeConfirmHandler` — every write via `createElement`/`textContent`/`setAttribute`/`dataset` only, no HTML-string sink anywhere in the file.
- Every action is a real `<button type="button" class="mw-gsheet-act">` with `aria-label`, a label span, a sub span (`id="mw-gear-sheet-sub-<n>"`) named by `aria-describedby`, and an `aria-hidden` chevron.
- A greyed action (`!a.enabled`) carries `data-off="1"`/`aria-disabled="true"` and literally no click handler — tapping it does nothing, matching GSCR-09's "never a hidden live button" prohibition.
- Every enabled non-confirm action closes the sheet, THEN dispatches exactly one existing `tabDeps()` bridge (`equipItem`/`unequip`/`useItem`/`dropItem`) with the model's exact `run` arguments — proven ordered across every action shape including DROP's second tap (Edge GSCR-09/ordering).
- DROP is a tap-again confirm: first tap relabels to "DROP IT? · tap again" and arms (`dataset.armed="1"`, dispatches nothing); second tap within 3000ms reverts, closes, then dispatches; a 3000ms timeout or any fresh render reverts an armed DROP automatically. The armed state lives on the DOM node, never on `state`.
- `test/unit/gear-sheet-dom.test.js` (new, 22 tests): render shape/a11y, dispatch order, greyed-inert behavior, combat greying, the full resolvable-target sweep, the DROP confirm's first/second tap and mock-timer revert, re-render-while-armed, GSCR-08 encoding (hostile item name verbatim, no HTML sink), GSCR-09 ordering, idempotency, no-WP, and the module contract (no window/document, `ownerDocument` present, no `innerHTML`/`outerHTML`/`insertAdjacentHTML`).

## Task Commits

Each task was committed atomically:

1. **Task 1: renderGearSheet — header, action buttons, greyed a11y, dispatch order** - `6e1ac38` (feat) — `src/browser/gearSheet.js` + `test/unit/gear-sheet-dom.test.js` (12 tests)
2. **Task 2: DROP tap-again confirm, CANCEL, encoding, idempotency and contract pins** - `a693ab1` (test) — extended both files (22 tests total), ran `npm run build:www && npm test`

## Files Created/Modified

- `src/browser/gearSheet.js` — adds `GEAR_SHEET_IDS`, `renderGearSheet(host, state, target, deps)`, `dispatchRun`, `buildActionButton`, `SHEET_DROP_CONFIRM_MS`/`revertSheetDrop`/`makeConfirmHandler` after Plan 01's `gearSheetModel`/`GEAR_SHEET_COPY` (unchanged, byte-stable exports)
- `test/unit/gear-sheet-dom.test.js` — new 22-test DOM suite (render shape/a11y, dispatch order, the DROP confirm, GSCR-08/09 edges, idempotency, no-WP, module contract)

## Exact DOM Shape (for Plan 04)

Six roots, filled directly via `doc.getElementById(id)` (never `host.querySelector`):

```
GEAR_SHEET_IDS = {
  label: "mw-gear-sheet-label",     // textContent = model.label
  title: "mw-gear-sheet-title",     // textContent = model.title
  note:  "mw-gear-sheet-note",      // textContent = model.note
  why:   "mw-gear-sheet-why",       // textContent = model.why; .hidden = !model.why
  actions: "mw-gear-sheet-actions", // replaceChildren(...one <button> per model.actions)
  cancel: "mw-gear-sheet-cancel",   // textContent = GEAR_SHEET_COPY.cancel
}
```

Per-action button (order = `model.actions` order):

```
<button type="button" class="mw-gsheet-act" data-key="<a.key>" aria-label="<a.label>"
        [data-off="1" aria-disabled="true"]           <- only when !a.enabled
        aria-describedby="mw-gear-sheet-sub-<index>">
  <span class="mw-gsheet-act-main">
    <span class="mw-gsheet-act-label">a.label</span>
    <span class="mw-gsheet-act-sub" id="mw-gear-sheet-sub-<index>">a.sub</span>
  </span>
  <span class="mw-gsheet-chev" aria-hidden="true">GEAR_COPY.chevron</span>
</button>
```

`deps` keys read: `guardTap(btn, fn)` (falls back to plain `onclick` when absent), `closeGearSheet()`, `equipItem(i[, slot])`, `unequip(slot)`, `useItem(i | { slot })`, `dropItem(i)`. Plan 04 supplies `openGearSheet`/`closeGearSheet` and mounts this renderer through a `window.__mzGearSheet` bridge; no markup/CSS/shell wiring exists yet.

## Decisions Made

- Task 1 wired every enabled action — DROP included — through the plain close-then-dispatch handler, with `revertSheetDrop()` as a documented no-op stub; Task 2 replaced only the stub and added the `a.confirm` branch (`makeConfirmHandler`). This kept each commit's behavior exactly matching its own task's test scope, per the plan's own "Task 2 adds the confirm handler" instruction.
- `GEAR_SHEET_IDS` elements are addressed via `doc.getElementById(id)` directly rather than `host.querySelector`, mirroring `gearTab.js`'s own `head()`/`el()` id-driven style — the renderer never assumes the ids are DOM descendants of `host`, matching how Plan 04's eventual markup declares them.
- Proving GSCR-08 encoding for a hostile item name used as a BAG-card action target required `kind: "jewel"` (not `"jewelry"`) so `engine/derived.js`'s `slotFor` falls through to its kind-based fallback — `SLOT_OF` only resolves canonical in-game item names by exact string match, and the tricky test name isn't one. A worn-row placement of the same tricky name needed no such care, since worn rows are read by fixed key (`jewelry1`/`jewelry2`), never through `slotFor`.

## Deviations from Plan

None - plan executed exactly as written. All `<action>` pseudocode (`GEAR_SHEET_IDS`, `renderGearSheet`, `dispatchRun`, `buildActionButton`, the DROP confirm state and `makeConfirmHandler`) was implemented as specified; every `<behavior>` bullet and `must_haves.truths` entry has a corresponding passing test.

## Issues Encountered

- A fresh worktree checkout has no `node_modules/`; `npm run build:www` initially failed with "@capacitor/core is not installed". Ran `npm install --prefer-offline` per the plan's project rules (confirmed `package.json`/`package-lock.json` unchanged via `git status --short`), then the build and full suite ran clean.
- First draft of the GSCR-08/encoding test used `kind: "jewelry"` for a bag-placed hostile-name item (copying the worn-row test's `kind`), which made `gearBagCardsModel` resolve `family: null` (no `SWAP INTO`/`EQUIP TO` action existed to click) — a test-authoring correction (`kind: "jewel"`), not a renderer bug; verified by direct `node -e` reproduction against `engine/derived.js#slotFor` before and after the fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `renderGearSheet`/`GEAR_SHEET_IDS`/`SHEET_DROP_CONFIRM_MS` are ready for Plan 03 (the engine-agreement sweep), Plan 04 (shell lifecycle: markup, CSS, the `window.__mzGearSheet` bridge, `openGearSheet`/`closeGearSheet`, back-button/TalkBack/motion wiring), and Plan 05 (row integration) to read directly.
- No blockers. `npm run build:www && npm test`: 4154 tests, 4147 pass, 7 known CRLF-checkout false-fails in `test/unit/class-pass-ledger.test.js`/`test/unit/flee-ledger.test.js` (both files confirmed byte-identical to the worktree's base commit via `git diff --stat` — pre-existing worktree noise, not caused by this plan). No byte changes to `engine/`, `content/`, `test/parity/`, `mazeworld.html`, `gearTab.js`, or any snapshot fixture (confirmed via `git diff --stat` against those paths — empty).

---
*Phase: 63-action-sheet-combat-lock-accessibility*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: src/browser/gearSheet.js
- FOUND: test/unit/gear-sheet-dom.test.js
- FOUND: .planning/phases/63-action-sheet-combat-lock-accessibility/63-02-SUMMARY.md
- FOUND commit: 6e1ac38 (feat(63-02): renderGearSheet header, action buttons, a11y and dispatch order)
- FOUND commit: a693ab1 (test(63-02): DROP tap-again confirm, CANCEL, encoding, idempotency, module contract)
