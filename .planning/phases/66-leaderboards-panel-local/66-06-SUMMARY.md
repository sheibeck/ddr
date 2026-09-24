---
phase: 66-leaderboards-panel-local
plan: 06
subsystem: ui
tags: [dom-wiring, modular-shell, boards-panel, leaderboards, bridge-registry, shell-sandbox]

# Dependency graph
requires:
  - phase: 66-01-records-comparator-graveyard-seam
    provides: "engine/records.js's re-ranked LEANEST comparator and sanitizeBests, and src/browser/engineAdapter.js's getBests()/getGraveyard() synchronous in-memory read seam"
  - phase: 66-03-boardsPanel-view-model
    provides: "src/browser/boardsPanel.js's renderBoardsPanel/createBoardsPanel controller ({ openFromTab, openFromTitle, onDeadTab, back, isTitleOpen, centreRail, refresh, state })"
  - phase: 66-04-boardsView-pure-view-model
    provides: "src/browser/boardsView.js's boardsView(input) pure view model"
  - phase: 66-05-boards-css
    provides: "the .mw-bd-* CSS block and #screen-dead's edge-to-edge layout reset in mazeworld.html"
provides:
  - "mazeworld.html: the DEAD tab renders the Leaderboards panel — #screen-dead emptied, the classic graveyard screen/renderers/copy deleted, showTab('dead') routed through window.__mzBoards.onDeadTab"
  - "mazeworld.html: readBoardsData()/boardsPrefs() feed the panel from the adapter's getBests()/getGraveyard(), never storage directly"
  - "mazeworld.html: routeFromBoards(action, { hasHero }) — the panel's dock/back routing (title/dungeon/roll)"
  - "mazeworld.html: refreshTitleDead() gates the title's VIEW THE DEAD button on getGraveyard()'s lifetime total instead of the retired classic __mzGravesCount bridge"
  - "src/browser/bridge.js + docs/SHELL-MODULES.md: the __mzBoards registry entry (and the Leaderboards panel module doc section), __mzGravesCount removed"
  - "test/unit/harness/shellSandbox.js: a `boards` option wiring the REAL createBoardsPanel/boardsView over the sandbox's own #screen-dead and fake localStorage, returned as boardsPanel/boardsRoutes"
  - "test/unit/shell-boards-panel.test.js: 20 tests proving the DEAD tab end to end (sandbox rendering, board memory, row tap-expand, empty state, routeFromBoards, deletion pins, zero-network pin)"
affects: ["66-07-loader-retirement", "67-play-games-integration", "68-global-boards-submission"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-source-injection sandbox wiring (the dressing.js precedent): loadShellSandbox's `boards` option feeds the REAL createBoardsPanel/boardsView, never a stubbed bridge — only the data source (readData's return value) is test-controlled"
    - "routeFromBoards as a module-level function declared right after window.mzReturnToTitle, hoisted so the panel-creation block earlier in the same module script can reference it before its own textual declaration"

key-files:
  created:
    - test/unit/shell-boards-panel.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/roller.test.js

key-decisions:
  - "Deleted `.mw-error .mw-empty-head{color:var(--stamp)}` alongside the classic stone renderer: it had no other user in the shell (unlike `.mw-empty`/`.mw-empty-head`/`.mw-empty-body`, which gearTab.js's bag-empty state still uses and which were therefore kept)"
  - "The title's VIEW THE DEAD button (`mw-title-dead`'s onclick) is untouched by this plan — it still calls `hideTitleScreen(); window.__mzShowTab?.(\"dead\")`, which now opens the panel in TAB mode (no chevron, tab bar visible), not the title-mode chevron/dock chrome `openFromTitle` implements. This matches the plan's own success_criteria, which scopes BOARD-01 to \"(tab half)\" only in this plan — wiring the title button to `openFromTitle` is left to a later plan"
  - "routeFromBoards is a plain `function` declaration (not a const/arrow) specifically so it is hoisted and can be referenced by the panel-creation block that appears earlier in the module script's source order"

requirements-completed: [BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-06, BOARD-07, BOARD-08]

coverage:
  - id: D1
    description: "The DEAD tab opens the Leaderboards panel in #screen-dead: game tab bar visible, DEAD active, no chevron, dock hidden, no title-entry body marker"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(A1)/(A4)/(A5) — one .mw-bd root, tab-entered, zero .mw-bd-back, hidden .mw-bd-dock, no body[data-boards-entry]"
        status: pass
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js#(13) — HUD/condition-strip off-tab on DEAD, #screen-dead's safe-area padding untouched"
        status: pass
    human_judgment: false
  - id: D2
    description: "The DEAD tab opens on the board last viewed (ddr.boards.last.v1), else DEEPEST, with the local list and no row open"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(A2) default DEEPEST active; #(B1)/(B2) LEANEST chip sets and remembers the board across a map detour"
        status: pass
    human_judgment: false
  - id: D3
    description: "The panel reads only the adapter's in-memory bests/graveyard (getBests()/getGraveyard()) through readBoardsData(), never storage — the classic per-tab loadGraves()/renderGraves() re-fetch is gone"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(F1)/(F2) — renderGravesLoading/renderGraves/graves-count bridge gone; showTab's dead branch calls window.__mzBoards?.onDeadTab?.(); the three Phase 66 import lines present"
        status: pass
    human_judgment: false
  - id: D4
    description: "INTERRED in the header reads the adapter's lifetime total, never fewer than the stones held"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(A1) INTERRED reads \"37\" against 12 folded runs/graves; #(D1) empty data reads \"0\""
        status: pass
    human_judgment: false
  - id: D5
    description: "The old classic graveyard screen (#yard/#yard-count markup, .yard*/.stone* CSS, the loading placeholder and stone renderers, the 'Showing last' copy) is deleted outright, no dual path"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(F1) — every deleted identifier/selector/copy absent; #screen-dead has no children"
        status: pass
      - kind: unit
        ref: "test/unit/hud-menu-layout.test.js, test/unit/shell-tab-snapshots.test.js, test/unit/boards-css.test.js (full suites re-run green after the deletion)"
        status: pass
    human_judgment: false
  - id: D6
    description: "window.__mzBoards is the one registered bridge between the classic tab switch and the module-owned panel; it is listed in src/browser/bridge.js and the regenerated docs/SHELL-MODULES.md table, and the retired __mzGravesCount bridge is removed from both"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js, test/unit/stale-terms.test.js, test/unit/shell-no-content-copies.test.js, test/unit/dressing-shell.test.js (32/32 pass)"
        status: pass
      - kind: other
        ref: "node tools/bridge-doc.mjs --check (exit 0)"
        status: pass
    human_judgment: false
  - id: D7
    description: "routeFromBoards routes 'title' to the map then the title screen (allowResume preserved), 'dungeon' to the map plus the one-shot load report, and 'roll' to the character roller"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(E1)-(E5) — every action extracted from the shipped source and evaluated against a fake window/showTitleScreen/surfaceWornReconcile"
        status: pass
    human_judgment: false
  - id: D8
    description: "Row tap-expand: one row open at a time (cause/epitaph + six stat chips), toggling the same row closes it"
    requirement: "BOARD-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(C1)/(C2)/(C3)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every board has a deliberate empty state (INTERRED 0, an in-voice empty line, NO ENTRY standing card) — no board is hidden"
    requirement: "BOARD-07"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(D1)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The shell makes zero network calls for the panel (BOARD-08)"
    requirement: "BOARD-08"
    verification:
      - kind: unit
        ref: "test/unit/shell-boards-panel.test.js#(F3) — no fetch(/XMLHttpRequest/WebSocket/EventSource/sendBeacon in the comment-stripped shell"
        status: pass
    human_judgment: false
  - id: D11
    description: "Existing shell behaviour holds and the full suite stays green: HUD/condition strip still hide on DEAD, every other tab renders as before, engine/content/parity untouched"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "npm test — 4449/4456 pass; the 7 failures are the documented pre-existing worktree CRLF doc-ledger fixtures (class-pass-ledger, v1.5 AFTER section, flee-ledger), unchanged from the pre-execution baseline"
        status: pass
    human_judgment: false
  - id: D12
    description: "The title's VIEW THE DEAD button appears after a first death mid-session, gated on the adapter's lifetime total (refreshTitleDead reading getGraveyard()) rather than the classic bridge"
    requirement: "BOARD-01"
    verification:
      - kind: other
        ref: "test/unit/shell-boards-panel.test.js#(F2) source pin (refreshTitleDead calls getGraveyard()); no behavioural sandbox test drives the title screen's mw-title-dead hidden toggle in this plan"
        status: pass
    human_judgment: true
    rationale: "This plan proves refreshTitleDead's source now reads getGraveyard() (a correct, mechanical re-point) but did not add a behavioural sandbox test exercising the title screen's own show/hide toggle end to end. The plan's own <output> instructions list this exact check ('the title's View the Dead appears after the first-ever death without a restart') for the Phase 69 batched device UAT round — deferring the live confirmation there rather than duplicating a new harness test outside this plan's Task 3 scope."

duration: ~60min
completed: 2026-09-23
status: complete
---

# Phase 66 Plan 06: DEAD Tab Wiring Summary

**The DEAD tab now renders the module-owned Leaderboards panel end to end — the classic graveyard screen is deleted outright, `window.__mzBoards` is the one registered bridge, and 20 new shell-sandbox tests prove rendering, board memory, row tap-expand, the empty state, and `routeFromBoards`' dock/back routing against the real panel and view model.**

## Performance

- **Duration:** ~60 min
- **Tasks:** 3 completed
- **Files modified:** 6 (1 created)

## Accomplishments

- `#screen-dead` is now an empty mount point; the classic `#yard`/`#yard-count` markup, the `.yard*`/`.stone*` CSS, the `renderGravesLoading`/`renderGraves` functions, and the "Showing last 5 of N" / "NOBODY'S DOWN THERE YET" / "THE LEDGER WON'T OPEN" copy are all deleted — no dual path. `window.__mzClassicBoot` drops the loading-placeholder/render calls; `loadGraves()`/`saveGraves()` stay only as the sentinel block 66-07 will retire.
- `showTab`'s DEAD branch is now `if (name === "dead") window.__mzBoards?.onDeadTab?.();` — the classic script's per-tab graveyard re-fetch is gone; the panel reads the adapter's already-current in-memory state instead.
- The module script creates one `createBoardsPanel` instance over `#screen-dead`, fed by `readBoardsData()` (wrapping `getBests()`/`getGraveyard()`) and `boardsPrefs()` (a try/catch'd `window.localStorage` read for the D-04 per-viewer convenience key), and assigns `window.__mzBoards = Object.freeze({ onDeadTab: boardsPanel.onDeadTab })`.
- `routeFromBoards(action, { hasHero })` implements D-01's dock/back routing: "title" shows the map then the title screen with `allowResume` preserved; "dungeon" shows the map then surfaces the one-shot worn-reconciliation report; "roll" opens the character roller.
- `refreshTitleDead()` now gates the title's VIEW THE DEAD button on `getGraveyard()`'s lifetime total instead of the classic `window.__mzGravesCount` bridge, which is deleted along with its `src/browser/bridge.js` registry entry; `__mzBoards` is added in its place (alphabetically, after `__mzBeat`), and `docs/SHELL-MODULES.md` gets a new "Leaderboards panel (Phase 66)" section plus a regenerated bridge table (`node tools/bridge-doc.mjs --write`, `--check` passes).
- `test/unit/harness/shellSandbox.js` gains a `boards` option that wires the REAL `createBoardsPanel`/`boardsView` over the sandbox's own `#screen-dead` and fake `localStorage` (never a stub), returning `boardsPanel`/`boardsRoutes` on the sandbox result — the same data-source-injection pattern the sandbox already uses for `dressing`.
- New `test/unit/shell-boards-panel.test.js` (20 tests): DEAD-tab rendering (root/INTERRED/rail/rows/chevron/dock/no-title-marker/HUD-off-tab), board memory via `ddr.boards.last.v1` across a map detour, row tap-expand (open one/switch/close), the empty-data state, `routeFromBoards` extracted from the shipped module-script source and evaluated against a fake `window`/`showTitleScreen`/`surfaceWornReconcile`, the full set of deletion pins, and the zero-network pin (BOARD-08).

## Task Commits

Each task was committed atomically:

1. **Task 1: empty #screen-dead, delete the classic graveyard screen, and hook showTab's DEAD branch to the bridge** - `a5f6d43` (feat)
2. **Task 2: the module-side panel: imports, instance, routeFromBoards, window.__mzBoards, the title gate on getGraveyard, and the bridge registry and docs** - `b881c2e` (feat)
3. **Task 3: wire the real panel into the shell sandbox and pin the DEAD tab end to end** - `78c6a65` (test)

**Plan metadata:** (this commit) — SUMMARY.md only (STATE.md/ROADMAP.md are owned by the orchestrator, per this plan's worktree instructions)

## Files Created/Modified

- `mazeworld.html` - Task 1: emptied `#screen-dead`, deleted the classic graveyard markup/CSS/renderers/copy, rewired `showTab`'s DEAD branch. Task 2: three new Phase 66 module imports, the `createBoardsPanel` instance + `readBoardsData()`/`boardsPrefs()`, `routeFromBoards`, `window.__mzBoards`, and `refreshTitleDead()`'s re-point to `getGraveyard()` (with the classic `__mzGravesCount` bridge and its comment deleted)
- `src/browser/bridge.js` - adds the `__mzBoards` entry (alphabetical, after `__mzBeat`), removes `__mzGravesCount`, appends `routeFromBoards` to `__mzShowTab`'s consumers
- `docs/SHELL-MODULES.md` - new "Leaderboards panel (Phase 66)" section; intro paragraph mentions `boardsPanel.js`/`boardsView.js`; bridge table regenerated via `tools/bridge-doc.mjs --write`
- `test/unit/harness/shellSandbox.js` - imports `createBoardsPanel`/`boardsView`; `loadShellSandbox` gains a `boards` option; wires the real panel over the sandbox's `#screen-dead`/`localStorage`; returns `boardsPanel`/`boardsRoutes`
- `test/unit/shell-boards-panel.test.js` (new) - 20 tests covering every behaviour bullet in the plan's Task 3
- `test/unit/roller.test.js` - re-pinned test m5's `window.mzStartRoll()` call-count assertion from 2 to 3 (see Deviations below)

## Decisions Made

- `.mw-error .mw-empty-head{color:var(--stamp)}` was deleted alongside the classic stone renderer's error state (its only user); `.mw-empty`/`.mw-empty-head`/`.mw-empty-body` themselves were kept — `gearTab.js`'s bag-empty state (`#gear-bag .mw-empty-head`/`#gear-bag .mw-empty-body` and `gearTab.js`'s own `li.className = "none mw-empty"` / `el("b", "mw-empty-head", ...)`) is still a live user.
- The title's `#mw-title-dead` button's onclick is untouched by this plan (still `hideTitleScreen(); window.__mzShowTab?.("dead")`), so tapping VIEW THE DEAD from the title opens the panel in **tab** mode (tab bar visible, no chevron) rather than the title-mode chevron/dock chrome `boardsPanel.js`'s `openFromTitle` already implements. This is a deliberate scope boundary, not an oversight: the plan's own `success_criteria` frames this plan as "BOARD-01 (tab half)" only, and `openFromTitle`/`isTitleOpen`/`back()` are exercised by 66-03's own unit tests but never referenced by this plan's task list. Wiring the title button (and the Android back-button mirror, D-03) to `openFromTitle` is left to a later plan.
- `routeFromBoards` is a `function` declaration (not `const`/arrow) specifically so the panel-creation block — which appears earlier in the module script's source order and passes `onRoute: routeFromBoards` — can reference it before its own textual declaration, relying on function-declaration hoisting within the same module-script scope (verified: the full sandbox-backed test suite runs the whole module region without a `ReferenceError`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-pinned a stale test-suite assertion that this plan's own new behaviour legitimately broke**
- **Found during:** Task 3, `npm test` full-suite verification
- **Issue:** `test/unit/roller.test.js`'s "m5" test asserted `window.mzStartRoll()` is called exactly twice across the classic+module scripts (title ENTER, the dead Hero tab's New Character). `routeFromBoards`'s "roll" branch (the title-opened panel's ROLL A NEW HERO dock button, required by D-01/66-CONTEXT) is a legitimate third call site this plan adds.
- **Fix:** Updated the assertion from `2` to `3` and reworded the test's title to name the new call site.
- **Files modified:** `test/unit/roller.test.js`
- **Verification:** `node --test test/unit/roller.test.js` (19/19 pass); full `npm test` re-run confirms the failing-test set returned to exactly the 7 pre-existing worktree CRLF fixtures.
- **Committed in:** `78c6a65` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — stale test re-pin)
**Impact on plan:** Necessary correctness fix for a test whose hardcoded count this plan's own required behaviour legitimately moved. No scope creep — the new call site (`window.mzStartRoll()` from `routeFromBoards`) was explicitly specified by the plan's Task 2 action item 3.

## Issues Encountered

None beyond the deviation above.

## Human verification (deferred to end of run)

Per project convention (verification agents off; UAT batched at the Phase 69 milestone close), these device/visual checks are recorded here for that batch rather than gating this plan:

1. The DEAD tab shows the panel with the tab bar visible and DEAD lit, no chevron.
2. After a death, the DEAD tab lists the new run at once and INTERRED went up by one.
3. The tab reopens on the last board viewed.
4. Every board renders, empty or not, with the panel working in airplane mode.
5. The title's View the Dead appears after the first-ever death without a restart.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `window.__mzBoards`, `routeFromBoards`, and the panel's `readBoardsData()`/`boardsPrefs()` seams are all in place and tested; 66-07 (the classic `loadGraves()`/`saveGraves()` loader retirement) can now safely delete that sentinel block since nothing downstream of this plan reads it any more (only its own module-internal `graves`/`gravesTotal`/`window.__mzGravesCount`, and the last of those was deleted in this plan's Task 2).
- The title-mode entry chrome (`openFromTitle`, the chevron, the dock, `body[data-boards-entry="title"]`) is implemented in `boardsPanel.js`/CSS from 66-03/66-05 but is **not yet wired** to `#mw-title-dead`'s onclick or the Android back-button mirror (D-03) — a later plan should point the title button at `boardsPanel.openFromTitle({ hasHero })` and gate `showTab`'s tab-bar/rail visibility accordingly, or confirm this is intentionally sequenced into 66-07/67.
- No blockers for Phase 67 (Play Games integration) or Phase 68 (global boards) — both build behind the same `boardsView`/`readData` seam this plan wired live.

---
*Phase: 66-leaderboards-panel-local*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/shell-boards-panel.test.js
- FOUND: test/unit/roller.test.js
- FOUND: .planning/phases/66-leaderboards-panel-local/66-06-SUMMARY.md
- FOUND commit: a5f6d43 (Task 1)
- FOUND commit: b881c2e (Task 2)
- FOUND commit: 78c6a65 (Task 3)
- `npm test`: 4456 tests, 4449 pass, 7 fail — the 7 failures are exactly the pre-existing worktree CRLF doc-ledger failures named in the project notes (class-pass-ledger, v1.5 AFTER section, flee-ledger), unchanged from the pre-execution baseline. No regressions.
