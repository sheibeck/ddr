---
phase: 57-map-hud-layout-band
plan: 03
subsystem: ui
tags: [shell, rail, layout, vanilla-js, input-guards]

requires:
  - phase: 57-map-hud-layout-band (plan 02)
    provides: "the rail as a transform/visibility-driven overlay with data-shown, and #mw-stage's flex chain — this plan's dismiss handler and timer build directly on top with zero further structural change"
provides:
  - "src/browser/rail.js: RAIL_HOLD/WORN_RECONCILE_HOLD exactly doubled (2026-09-15 toast ruling applied to the rail); HOLD_PER_LINE (900)/HOLD_MIN (4400)/HOLD_MAX (16000) + holdForCard(card) — a pure, line-scaled, bounded hold function"
  - "src/browser/rail.js: RAIL_DISMISS_KINDS (['dismissible','locked']) + railDismissKind(locked, buttonCount) — a total two-kind classifier"
  - "mazeworld.html: a guarded, one-time #mw-rail.onclick body-tap dismiss handler (four ordered checks: button-target passthrough, arm-window guard via isArmed(railShownAt, now), locked-card pulse, otherwise dismiss+re-render)"
  - "mazeworld.html: renderRail()'s auto-clear setTimeout now keys its delay on the bridged holdForCard(rail.card) instead of the raw rail.card.hold literal"
  - "window.__mzRailVM gains holdForCard/dismissKind (no new bridge name — bridge-registry.test.js's set-equality untouched, docs/SHELL-MODULES.md regenerated)"
  - "test/unit/rail-dismiss.test.js — a dedicated shell-sandbox loader (loadRailDismissSandbox) that runs the classic script with a REAL, never-stubbed renderRail(), proving all four dismiss-handler branches plus the never-shown resting case"
affects: [58-motion]

tech-stack:
  added: []
  patterns:
    - "A test that needs the classic script's REAL renderRail() (not shellSandbox.js's stubbed one) writes its own sibling loader rather than trying to un-stub loadShellSandbox's context after the fact — S/railShownAt/lastRailKeyShown/railTimer are per-vm-execution `let` bindings, not context-global properties, so a second vm.runInContext call in the same context throws 'already declared' on any repeated top-level `let`, and there is no way to recover the original function reference once loadShellSandbox's own stub line overwrites it."
    - "A one-time element listener (#mw-rail.onclick) is wired once at classic-script top-level, right beside the other rail globals (window.renderRail/window.mzRailPulse assignments) — not rebuilt inside renderRail() itself, so it survives every re-render untouched and is unaffected by whichever bridges happen to be wired at wiring time (it only reads window.__mz* bridges lazily, inside its own closure, at tap time)."

key-files:
  created:
    - test/unit/rail-dismiss.test.js
  modified:
    - src/browser/rail.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/rail.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-abilities.test.js (unplanned — see Deviations)
    - test/unit/shell-worn-slots.test.js (unplanned — see Deviations, actually required no edit; see note)
    - test/unit/shell-gear-39.test.js (unplanned — see Deviations)
    - tools/stale-terms.mjs (unplanned — see Deviations)

key-decisions:
  - "holdForCard(null) returns HOLD_MIN via an explicit early-return special case (`if (!card) return HOLD_MIN;`), not by falling through the base/lineCount computation — the plan's own literal algorithm (base defaults to RAIL_HOLD.default=8400 for a missing card, one line, no scaling) would have yielded 8400 for a null card, not HOLD_MIN=4400, which the plan's own acceptance check requires. Resolved by reading 'a null card yields HOLD_MIN' as its own documented floor case."
  - "railDismissKind is NOT wired through guardTap (per the plan's own Task 2 note and the 57-CONTEXT correction 2): guardTap stamps aria-disabled on its own target while the arm sweep's clearing selector is a DESCENDANT selector (#mw-rail [aria-disabled=\"true\"]) that would never reach an attribute placed on #mw-rail itself, and it gates on the shared encRenderedAt stamp, stale for a no-button card. The handler instead reuses isArmed(railShownAt, now) directly against a rail-specific stamp."
  - "Section B of rail-dismiss.test.js needed its own sibling sandbox loader (loadRailDismissSandbox), not a caller of test/unit/harness/shellSandbox.js#loadShellSandbox: that harness stubs draw()/renderRail() to no-ops immediately AFTER the classic script runs. Empirically confirmed (a throwaway vm repro) that top-level `let` bindings in one vm.runInContext execution are invisible to a second, separate vm.runInContext call on the same context and cannot be redeclared without a SyntaxError — so once the stub overwrites the one reference to the real renderRail(), there is no way to 'capture it before the stub or reassign it back' short of re-running the whole classic script fresh. loadRailDismissSandbox mirrors shellSandbox.js's sandbox+wireBridges construction by hand (kept in sync via a pointer comment in each file) but never stubs draw()/renderRail(), and additionally wires window.__mzRailVM (deliberately absent from wireBridges, since its own callers never reach for it)."
  - "The module script's rail.js import list was reordered so holdForCard/railDismissKind land BEFORE wornReconcileCard/abilityPoolCard rather than after — this kept two pre-existing test pins (shell-abilities.test.js, shell-worn-slots.test.js) that assert the exact literal import-statement suffix `wornReconcileCard, abilityPoolCard } from \"./src/browser/rail.js\";` passing with zero edits to either file."

requirements-completed: [LAYOUT-02, LAYOUT-03]

coverage:
  - id: D1
    description: "RAIL_HOLD's eight named keys and WORN_RECONCILE_HOLD are each exactly doubled from their pre-phase 4d43edf values (default 8400, dull 4800, dullShort 4400, mark 6800, day 6000, floor 10000, camp 10400, level 12000, WORN_RECONCILE_HOLD 12000), proven against the base commit's own module, not merely asserted in prose"
    requirement: LAYOUT-03
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#RAIL_HOLD and WORN_RECONCILE_HOLD: every named hold is pinned to its exact doubled 2026-09-22 value"
        status: pass
    human_judgment: false
  - id: D2
    description: "holdForCard(card) scales a card's hold by HOLD_PER_LINE (900ms) per line beyond the first, floored at HOLD_MIN (4400ms, exactly the doubled dullShort — never shorter than today's minimum) and capped at HOLD_MAX (16000ms); never throws on a missing/malformed card"
    requirement: LAYOUT-03
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#holdForCard: a one-line/four-line/forty-line/null card"
        status: pass
      - kind: unit
        ref: "test/unit/rail-dismiss.test.js#Section A: holdForCard — floor/per-line-scaling/cap"
        status: pass
    human_judgment: false
  - id: D3
    description: "railDismissKind(locked, buttonCount) is a total two-kind classifier (RAIL_DISMISS_KINDS.length === 2) — locked when locked is truthy OR buttonCount coerces to a finite number > 0, dismissible otherwise, over every tested input including undefined/NaN/negative/missing"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js#railDismissKind: totality sweep"
        status: pass
      - kind: unit
        ref: "test/unit/rail-dismiss.test.js#Section A: railDismissKind totality"
        status: pass
    human_judgment: false
  - id: D4
    description: "The guarded #mw-rail body-tap handler: a tap on a rail action button routes to the button and is never a body tap; a tap inside the arm window is swallowed; a locked card (railLocked() true OR a live action row) pulses and stays present; otherwise the card dismisses and the rail ends idle/hidden; the never-shown resting case throws nothing"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "test/unit/rail-dismiss.test.js#Section B (1)-(5)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-map-rail.test.js#(f) renderRail: ...one setTimeout whose delay comes from holdForCard"
        status: pass
    human_judgment: false
  - id: D5
    description: "No rail tap reaches tapStep() — #mw-rail is structurally not a descendant of #mw-maze-viewport, and the gesture tracker (initMazeViewportControls) binds pointerdown to the viewport element alone"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "structural node check: #mw-maze-viewport's element slice does not contain id=\"mw-rail\" (ad hoc verification script, equivalent assertion carried forward from the plan's own acceptance criterion; not persisted as a named test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No new window.__mz* bridge name was created — holdForCard/dismissKind join the existing __mzRailVM object; bridge-registry.test.js's set-equality and doc-sync both hold, docs/SHELL-MODULES.md regenerated in the same commit"
    requirement: LAYOUT-02
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (all 10 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On a Pixel 7, the longer hold plus tap-to-dismiss reads as an improvement (not a stuck screen): a decision card visibly resists a body tap and pulses; a plain card visibly clears on tap; the rise/pulse animation still plays (no visible regression from the doubled hold before Phase 58 adds real transition tuning)"
    verification: []
    human_judgment: true
    rationale: "Deferred-UAT protocol (standing rule for this run) — device-only visual/interaction check, batched for Phase 60's Pixel 7 session. The automated half (classifier totality, hold bounds, all four handler branches, structural tap-through proof) is D1-D5 above."

duration: ~50min
completed: 2026-09-22
status: complete
---

# Phase 57 Plan 03: Rail Tap-to-Dismiss + Doubled/Line-Scaled Holds (LAYOUT-02/03) Summary

**Guarded `#mw-rail` body-tap dismiss (four ordered checks: button routes through, unarmed taps are swallowed, locked cards pulse, otherwise dismiss+re-render) paired with a doubled, line-scaled, bounded rail hold (`holdForCard`, floor 4400ms, cap 16000ms) — tap-to-dismiss is what makes the longer hold cheap.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-22T18:02:00Z
- **Tasks:** 3 of 3
- **Files modified:** 6 planned + 4 unplanned (test-pin fixes, see Deviations)

## Accomplishments

- `src/browser/rail.js`: every named `RAIL_HOLD` key and `WORN_RECONCILE_HOLD` exactly doubled (default 8400, dull 4800, dullShort 4400, mark 6800, day 6000, floor 10000, camp 10400, level 12000, WORN_RECONCILE_HOLD 12000) — proven exactly-2x against the phase-base (`4d43edf`) module, key sets included.
- `HOLD_PER_LINE` (900ms), `HOLD_MIN` (4400ms — exactly the doubled `dullShort`, never shorter than today's floor), `HOLD_MAX` (16000ms — the named cap), and `holdForCard(card)`: base (card's own hold, falling back to `RAIL_HOLD.default`) plus `HOLD_PER_LINE` per line beyond the first, clamped to `[HOLD_MIN, HOLD_MAX]`; `holdForCard(null)` returns `HOLD_MIN` as a documented special case.
- `RAIL_DISMISS_KINDS` (`["dismissible", "locked"]`) and `railDismissKind(locked, buttonCount)`: total over every input tested (booleans, undefined, null, NaN, negative counts) — locked when `locked` is truthy or `buttonCount` coerces to a positive finite number, dismissible otherwise.
- `mazeworld.html`: a one-time `#mw-rail.onclick` handler wired next to `window.mzRailPulse` — button-target passthrough (via a synthetic `.closest(".mw-rail-btn")` check), the arm-window guard (`window.__mzInputGuards.isArmed(railShownAt, Date.now())`), the locked-card pulse branch, and the dismiss branch (`clearTimeout` + `railVM.clear` + `renderRail()`). Deliberately not wired through `guardTap` — see Decisions.
- `renderRail()`'s `isNew` branch now stamps `railShownAt = Date.now()` (a new module-scope `let`, beside `lastRailKeyShown`) and the auto-clear `setTimeout`'s delay is now `vm.holdForCard ? vm.holdForCard(rail.card) : 8400` instead of `rail.card.hold || 4200`.
- `window.__mzRailVM` gains `holdForCard`/`dismissKind` (no new bridge name); `src/browser/bridge.js`'s `__mzRailVM` consumers list and `docs/SHELL-MODULES.md` (`node tools/bridge-doc.mjs --write`) updated in the same commit.
- Doubled the four literal `mzRailLine` hold call sites: the condition-chip explain card (4200→8400), the two hold-inspect refusal cards ("here" 2200→4400, "blocked" 2400→4800), and the quit card (4200→8400).
- `test/unit/rail-dismiss.test.js` (new, 10 named tests): Section A restates the classifier totality and hold bounds as the LAYOUT-02/03 acceptance; Section B (`loadRailDismissSandbox`, a deliberate sibling of `shellSandbox.js#loadShellSandbox` — see Decisions) drives the REAL, never-stubbed `renderRail()` through all four dismiss-handler branches plus the never-shown resting case.
- Re-pinned `test/unit/rail.test.js` (37 tests, +6 over the 31 baseline: the exact doubled-table pin, four `holdForCard` tests, one `railDismissKind` totality sweep) and `test/unit/shell-map-rail.test.js` test (f) (19 tests, unchanged count — the timer pin now asserts the `holdForCard`-routed delay expression; test (m) gained a one-line comment recording why it stays byte-identical).
- **Both plan-mandated teeth checks performed and reverted:** (1) inverted the handler's locked branch (`if (kind === "dismissible")` instead of `"locked"`) — confirmed `rail-dismiss.test.js` Section B tests 3a/3b **FAILED** as expected, reverted via `git checkout -- mazeworld.html`. (2) temporarily raised `HOLD_MAX` to `999999` — confirmed the Section A cap test **FAILED** as expected, reverted via `git checkout -- src/browser/rail.js`. `git status --short` on both files was clean after each revert.

## Task Commits

Each task was committed atomically:

1. **Task 1: rail.js — doubled, line-scaled, bounded holds and a total dismiss classifier** - `503e33a` (feat)
2. **Task 2: The guarded body-tap dismiss handler and the line-scaled auto-clear timer** - `8c15d86` (feat)
3. **Task 3: test/unit/rail-dismiss.test.js and the re-pinned renderRail source test** (also fixed 3 unplanned test-pin breaks, see Deviations) - `8f8a11d` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/browser/rail.js` - `RAIL_HOLD`/`WORN_RECONCILE_HOLD` doubled; `HOLD_PER_LINE`/`HOLD_MIN`/`HOLD_MAX`/`holdForCard`/`RAIL_DISMISS_KINDS`/`railDismissKind` added
- `mazeworld.html` - `railShownAt` stamp; the guarded `#mw-rail.onclick` handler; the `holdForCard`-routed auto-clear timer; `__mzRailVM` extended; four literal holds doubled; rail.js import reordered (see Decisions)
- `src/browser/bridge.js` - `__mzRailVM`'s consumers list extended for `holdForCard`/`dismissKind`
- `docs/SHELL-MODULES.md` - regenerated (`node tools/bridge-doc.mjs --write`)
- `test/unit/rail-dismiss.test.js` - new: 10 named tests (Section A pure/Section B shell handler)
- `test/unit/rail.test.js` - re-pinned to the doubled table + `HOLD_MIN`/`HOLD_MAX` ranges; 6 new tests (31 → 37)
- `test/unit/shell-map-rail.test.js` - test (f) re-pinned to the `holdForCard`-routed timer delay; test (m) gained an explanatory comment; count unchanged (19)
- `test/unit/shell-abilities.test.js`, `test/unit/shell-worn-slots.test.js` - needed no direct edit (fixed via the mazeworld.html import reorder, see Decisions) — required investigation and are listed for traceability
- `test/unit/shell-gear-39.test.js` - re-pinned the condition-chip explain hold literal (4200→8400)
- `tools/stale-terms.mjs` - two new `ALLOWED` entries excusing `rail.js`'s own historical "toast ruling" doc comment from the DOCS-01/03 stale-term tripwire

## Decisions Made

See `key-decisions` in the frontmatter above (holdForCard(null) special case; guardTap deliberately not used; the Section B sibling sandbox loader; the import-list reorder). All four are load-bearing technical decisions, not style preferences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tools/stale-terms.mjs`'s DOCS-01/03 tripwire flagged `rail.js`'s own new doc comment**
- **Found during:** Task 1, first full `npm test` run
- **Issue:** `RAIL_HOLD`'s doubled-values doc comment explains the "2026-09-15 toast ruling" by name (twice) — `tools/stale-terms.mjs` enforces "toast" as a retired-surface term across the whole repo (Phase 46's toast-host retirement), and the explanatory prose tripped it.
- **Fix:** Added two `ALLOWED` entries to `tools/stale-terms.mjs` (matching the existing precedent for `src/browser/narrationLines.js`'s own historical "toast" mention), per the tool's own "how to add a survivor" instructions — never weakened the `TERMS` regex.
- **Files modified:** `tools/stale-terms.mjs`
- **Verification:** `node --test test/unit/stale-terms.test.js` green.
- **Committed in:** `503e33a` (Task 1 commit)

**2. [Rule 1 - Bug] Two pre-existing tests pinned the exact rail.js import-statement suffix**
- **Found during:** Task 3, full `npm test` run after Task 2's changes
- **Issue:** `test/unit/shell-abilities.test.js` and `test/unit/shell-worn-slots.test.js` both assert the literal regex `/wornReconcileCard, abilityPoolCard \} from "\.\/src\/browser\/rail\.js";/` against the module script's import line — appending `holdForCard, railDismissKind` after `abilityPoolCard` (as originally written) broke the pinned suffix.
- **Fix:** Reordered the import list so `holdForCard, railDismissKind` land BEFORE `wornReconcileCard, abilityPoolCard`, restoring the pinned literal suffix byte-for-byte. Zero edits needed to either test file.
- **Files modified:** `mazeworld.html`
- **Verification:** `node --test test/unit/shell-abilities.test.js test/unit/shell-worn-slots.test.js` green.
- **Committed in:** `8f8a11d` (Task 3 commit)

**3. [Rule 1 - Bug] A pre-existing test pinned the pre-doubling literal hold at a call site**
- **Found during:** Task 3, full `npm test` run
- **Issue:** `test/unit/shell-gear-39.test.js` pinned the exact literal `"info", 4200, "·"` at the condition-chip explain call site, which Task 2 doubled to 8400 per the plan's own instruction.
- **Fix:** Re-pinned the assertion to `8400` with a comment naming the Phase 57 (LAYOUT-03) doubling.
- **Files modified:** `test/unit/shell-gear-39.test.js`
- **Verification:** `node --test test/unit/shell-gear-39.test.js` green.
- **Committed in:** `8f8a11d` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/breaks the current task's own changes caused in pre-existing pinned tests, plus the stale-terms tripwire).
**Impact on plan:** All three are necessary consequences of the plan's own required changes (the doubled holds, the new doc comment, the extended import list) landing correctly; none represent scope creep or an architectural change.

## Issues Encountered

- **`design/Mazeworld Map.dc.html` is modified in the working tree but was never touched by this plan's work** (no Read/Edit/Write tool call ever targeted it during this session; the diff is a design-mockup markup change — HUD identity/menu markup — unrelated to `src/browser/rail.js` or `mazeworld.html`'s rail machinery). Left untouched and unstaged per the destructive-git prohibition (no `git checkout --`/reset on files outside this plan's scope) — flagged here rather than silently absorbed into a commit or silently reverted. `git status --short` at the end of this plan therefore shows exactly this one pre-existing, out-of-scope file; every file this plan actually touched is committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The rail now has a guarded tap-to-dismiss and a doubled, line-scaled, bounded hold — Phase 58 (MOTION-01..05) can add the actual slide/pulse transition tuning on top of `data-shown` and the pulse/rise classes without further structural change here.
- 57-04 (darkness legibility, LAYOUT-06) is the last plan in the phase — this plan touched no darkness/vignette code and made no `engine/`/`content/` changes.
- Gates at this commit: engine gate empty (`git diff --stat 4d43edf..HEAD -- engine/ content/ test/parity/`), `npm test` **3575/3575** (green; grew by exactly the 6 + 10 = 16 tests this plan added over the 57-02 baseline of 3559), `npm run build:www` exit 0, `node --test test/unit/bridge-registry.test.js` green (10/10, both set-equality and doc-sync).
- Deferred device check (D7 above — the guarded dismiss and the longer hold read well on a real Pixel 7) is recorded for the Phase 60 batched Pixel 7 session per the standing deferred-UAT protocol.

---
*Phase: 57-map-hud-layout-band*
*Completed: 2026-09-22*

## Self-Check: PASSED

All created/modified files and referenced commits verified present on disk / in git log.
