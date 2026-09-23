---
phase: 62-gear-tab-layout-rebuild
plan: 03
subsystem: testing
tags: [gear-tab, cross-screen-agreement, gscr-11, source-guard, docs]

# Dependency graph
requires:
  - phase: 62-gear-tab-layout-rebuild (Plan 01)
    provides: "GEAR_WORN_ORDER and the eight pure Gear-tab view models (gearHeaderModel/gearUseCell/gearWornModel/gearBagMeterModel/gearBagCardsModel/gearConsumablesModel/gearKitRows) this plan proves against combatMenuViewModel"
  - phase: 62-gear-tab-layout-rebuild (Plan 02)
    provides: "#screen-gear's ten-id skeleton and renderGearTab wired to the Plan 01 models — this plan proves the SHIPPED DOM wiring, not just the pure models"
provides:
  - "test/unit/gear-agreement.test.js — a 14-test cross-screen agreement sweep (7 states, 17 USE-cell/item pairs), a no-fork source guard, and the five named Edge GSCR-11 truths (adjacency/empty/ordering/idempotency/concurrency)"
  - "docs/SHELL-MODULES.md's 14-key tabDeps() contract (drinkPotion/readScroll) and the Gear-tab view models under 'What stays shared'"
  - "dated Phase 62 supersession notes in docs/CLARITY.md, docs/SPELLS.md, docs/GEAR-SLOTS.md"
  - "GSCR-11 marked complete in REQUIREMENTS.md"
affects: [63-gear-action-sheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-screen agreement proved by rendering through the REAL classic paint()/renderEncounter() harness (test/unit/harness/shellSandbox.js), never by re-deriving the same rule twice — every assertion compares the RENDERED DOM against combatMenuViewModel/dropShelfItems/bagUsage, not the Plan 01 models directly (Plan 01's own gear-view-models.test.js already covers those)"
    - "No-fork source guard: comment-stripped, marker-sliced regions of gearTab.js scanned for forbidden lower-level engine calls (bagCap/canStow/slotItems/isReady/remaining/activationFor/itemTimerId/chargesTimerId/armorSoak/weaponUpgradeDelta/expectedStrike/usedAt) — a future edit that re-derives a shared rule inside the Gear tab fails this test, not a runtime bug report"

key-files:
  created:
    - test/unit/gear-agreement.test.js
  modified:
    - docs/SHELL-MODULES.md
    - docs/CLARITY.md
    - docs/SPELLS.md
    - docs/GEAR-SLOTS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Marked GSCR-11 complete in REQUIREMENTS.md (checkbox + Traceability row) as part of this plan's own commit, even though it isn't in the plan's declared files_modified — the project's standing ruling ('When the agreement sweep proves GSCR-11, mark GSCR-11 complete in REQUIREMENTS.md') is explicit and this plan's Task 1 is the sweep that proves it"
  - "The USE-cell agreement sweep compares the RENDERED DOM (paint()'s real output) against combatMenuViewModel, not the Plan 01 models in isolation — proves the shipped wiring survives, not just that the pure functions agree with each other"
  - "Four of the seven sweep states are thief-based clones (not fresh newRun states) specifically because the thief fixture's two worn, always-activatable jewelry pieces guarantee combatMenuViewModel's ITEMS submenu never collapses to its 'NOTHING TO USE' placeholder regardless of potions/HP — every clone in the sweep always has a real potion row and real worn rows to compare against"

requirements-completed: [GSCR-11]

coverage:
  - id: D1
    description: "Cross-screen USE-cell agreement (Edge GSCR-11/adjacency): every rendered .mw-gear-use cell's data-phase and the paired combat ITEMS row's cost agree with itemRowState, across a 7-state sweep (17 (item, state) pairs); a timer-decrement pair proves both surfaces move together"
    requirement: "GSCR-11"
    verification:
      - kind: unit
        ref: "test/unit/gear-agreement.test.js — 'Edge GSCR-11/adjacency: every rendered .mw-gear-use cell...' and 'Edge GSCR-11/adjacency: advancing jewelry1's timer...'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Heal-button agreement: the Gear HEALING POTION button's disabled flag and qty text agree with the combat ITEMS potion row's enabled flag and c.potions, across the sweep (both an enabled and a potions:0-disabled case exercised)"
    requirement: "GSCR-11"
    verification:
      - kind: unit
        ref: "test/unit/gear-agreement.test.js — 'heal agreement: the Gear HEALING POTION button's disabled flag...'"
        status: pass
    human_judgment: false
  - id: D3
    description: "bagUsage agreement: the Gear BAG head count equals bagUsage(c).text across the sweep; the full thiefStore fixture reads mw-gear-full on the Gear tab AND 'Bag full (' on the store screen from the same state"
    requirement: "GSCR-11"
    verification:
      - kind: unit
        ref: "test/unit/gear-agreement.test.js — 'bagUsage agreement: the Gear BAG head count equals bagUsage(c).text...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edge GSCR-11/empty, /ordering, /idempotency, /concurrency: the empty-bag Magic User fixture's Gear+store agreement, the bag-card data-i order matching dropShelfItems, byte-identical double-paint, and the one-armed-confirm invariant"
    requirement: "GSCR-11"
    verification:
      - kind: unit
        ref: "test/unit/gear-agreement.test.js — the four named Edge GSCR-11/empty, /ordering, /idempotency, /concurrency tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "No-fork source guard: the Plan 01 model region and the renderGearTab region of gearTab.js never call a lower-level shared rule directly; combatMenu.js/storeScreen.js/mazeworld.html keep importing/bridging the ONE shared functions; renderCarriedList still reads itemRowState/lootCompare"
    requirement: "GSCR-11"
    verification:
      - kind: unit
        ref: "test/unit/gear-agreement.test.js — the six 'no-fork source guard: ...' tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "Docs catch up: docs/SHELL-MODULES.md's 14-key tabDeps() contract and Gear-tab view models; dated Phase 62 notes in docs/CLARITY.md, docs/SPELLS.md, docs/GEAR-SLOTS.md; GSCR-11 marked complete in REQUIREMENTS.md"
    verification:
      - kind: other
        ref: "grep -c checks: drinkPotion/readScroll/gearWornModel in SHELL-MODULES.md; Phase 62 in CLARITY.md; gearKitRows in SPELLS.md; GEAR_WORN_ORDER in GEAR-SLOTS.md — all >= 1"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase-final gates: node --test bridge-registry.test.js + gear-agreement.test.js green (24/24); npm test 4090/4097 (7 documented pre-existing failures); npm run build:www exits 0; npm run boot:check all 4 checks pass; engine/content/test-parity untouched phase-wide; the prototype master hash unchanged"
    verification:
      - kind: unit
        ref: "npm test — 4090/4097 (class-pass-ledger.test.js x4, flee-ledger.test.js x3, identical to the untouched wave base commit b124348)"
        status: pass
      - kind: other
        ref: "npm run build:www — exits 0"
        status: pass
      - kind: other
        ref: "npm run boot:check — all 4 checks (no-uncaught/painted/graves/title) PASS"
        status: pass
    human_judgment: false

# Metrics
duration: ~1h
completed: 2026-09-23
status: complete
---

# Phase 62 Plan 03: GSCR-11 Proof — Cross-Screen Agreement, No-Fork Source Guard, Docs Catch-Up Summary

**A 14-test agreement sweep (7 states, 17 rendered USE-cell/item pairs, 5 named Edge GSCR-11 truths) plus a comment-stripped no-fork source guard proves the Gear tab, the ITEMS combat submenu, the loot drop shelf and the store can never disagree — docs caught up to the rebuilt tab and GSCR-11 closed; the phase closes at npm test 4090/4097 (7 documented pre-existing failures), build:www and boot:check both green, engine/content/test-parity byte-identical to the wave's base commit.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 6 (1 created)

## Accomplishments
- Authored `test/unit/gear-agreement.test.js` (14 tests, 466 lines): a cross-screen USE-cell agreement sweep over 7 real-rendered states (17 (item, state) pairs — the thief/mu fixtures plus five hand-built clones: a jewelry timer clone, a Magic User staff+torch clone, and three heal-agreement clones), comparing the SHIPPED `renderGearTab` DOM output against `combatMenuViewModel`'s ITEMS submenu, `dropShelfItems`, and `bagUsage` — never re-deriving the rule, only proving the rendered wiring agrees with it.
- Proved all five named Edge GSCR-11 truths as their own tests: `/adjacency` (USE-cell data-phase + combat cost agreement, plus a timer-decrement pair showing both move together), `/empty` (the mu fixture's bag-empty state + the muStore's hidden `#sell-head`), `/ordering` (bag-card `data-i` sequence equals `dropShelfItems(c).map(e => e.i)`, ascending), `/idempotency` (double-`paint()` byte-identical `SNAPSHOT_IDS.gear` serialization), `/concurrency` (arming Drop on card A then card B leaves exactly one confirm and restores card A; a fresh `paint()` clears every confirm).
- Built a comment-stripped, marker-sliced no-fork source guard (6 tests): the Plan 01 model region (`GEAR_WORN_ORDER`..`DROP_CONFIRM_MS`) and the `renderGearTab` region of `gearTab.js` never call a lower-level engine primitive directly (`bagCap`/`canStow`/`slotItems`/`isReady`/`remaining`/`activationFor`/`itemTimerId`/`chargesTimerId`/`armorSoak`/`weaponUpgradeDelta`/`expectedStrike`/`usedAt`); `combatMenu.js` still imports `itemRowState` from `./gearTab.js`; `storeScreen.js` still imports `bagUsage` from `./gearTab.js` and `storeRowState` from `./viewModels.js`; `mazeworld.html` still bridges `window.__mzBagUsage`/`window.__mzLootCompare`; `renderCarriedList` still reads `itemRowState(state, it)`/`lootCompare(state.c, it).equipNow`.
- Caught docs up to the rebuilt tab: `docs/SHELL-MODULES.md`'s Contract `deps` bullet now names all 14 `tabDeps()` keys (`drinkPotion`/`readScroll` added) and "What stays shared" gained a paragraph naming the eight Gear-tab view models and reaffirming `itemRowState`/`bagUsage` as the shared rules; `docs/CLARITY.md`, `docs/SPELLS.md` and `docs/GEAR-SLOTS.md` each gained a dated "Phase 62 update (2026-09-23, v1.9)" note superseding their two-panel/kit-row/worn-order descriptions without rewriting the historical text.
- Marked GSCR-11 complete in `.planning/REQUIREMENTS.md` (checkbox + Traceability row) — this plan's own sweep is the proof.
- Ran the phase's final gates: `npm test` 4090/4097 (the same 7 pre-existing `class-pass-ledger.test.js`/`flee-ledger.test.js` CRLF-checkout failures Plans 01 and 02 already reproduced identically on the untouched wave base commit); `npm run build:www` exits 0; `npm run boot:check` — all 4 checks (no-uncaught/painted/graves/title) PASS; the phase-wide `git diff --stat b124348..HEAD -- engine/ content/ test/parity/` prints nothing; `git hash-object test/parity/prototype-master.js.txt` prints `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross-screen agreement sweep, no-fork source guard, idempotency and one-armed-confirm checks** - `1321428` (test)
2. **Task 2: Docs catch up to the new tab; phase-final gates** - `9a30020` (docs)

## Files Created/Modified
- `test/unit/gear-agreement.test.js` (new) - 14-test GSCR-11 agreement suite: USE-cell adjacency sweep (7 states, 17 pairs), timer-decrement pair, heal-button agreement, bagUsage agreement (+thiefStore full/store-line), the five named Edge GSCR-11 tests, and the six no-fork source-guard tests
- `docs/SHELL-MODULES.md` - Contract `deps` bullet extended to 14 keys (`drinkPotion`/`readScroll`); "What stays shared" gained the Gear-tab view models paragraph
- `docs/CLARITY.md` - dated Phase 62 update note in the "Gear screen (CLAR-04)" section, superseding the two-panel description
- `docs/SPELLS.md` - dated Phase 62 update note in "The Hero-tab kit rows", pointing at `#gear-kit`/`gearKitRows`
- `docs/GEAR-SLOTS.md` - dated Phase 62 update note after the Phase 43 bullet, naming `GEAR_WORN_ORDER`'s display order and the bagged-equippable no-USE rule
- `.planning/REQUIREMENTS.md` - GSCR-11 checkbox and Traceability row flipped to complete

## Decisions Made
- Included `.planning/REQUIREMENTS.md` in Task 2's commit even though it isn't in the plan's declared `files_modified` — the project's standing ruling explicitly requires marking GSCR-11 complete once the sweep proves it, and this plan's Task 1 IS that proof.
- Designed the USE-cell agreement sweep to compare the REAL rendered DOM (via `paint()`) against `combatMenuViewModel`, not the Plan 01 pure models directly — Plan 01's own `gear-view-models.test.js` already proves the models agree with each other; this suite's job is to prove the SHIPPED wiring (renderGearTab's actual DOM output) still agrees once it's on screen.
- Built four of the seven sweep states as `structuredClone(fixedStates().thief)` variants (never a bare `newRun`) specifically so every clone keeps the thief fixture's two worn, real-content jewelry pieces — this guarantees `combatMenuViewModel`'s ITEMS submenu never degrades to its "nothing to use" placeholder regardless of the potions/HP edit each clone makes, so the heal-agreement and USE-cell checks always have a real combat row to compare against.

## Deviations from Plan

None — plan executed exactly as written. Every `<behavior>` bullet, edge-case name and acceptance criterion (14 tests >= 12, 17 pairs >= 10, both grep counts >= 1, 466 lines >= 180) is met without loosening any assertion.

## Issues Encountered
- This fresh worktree had no `node_modules/` — ran `npm install --prefer-offline` per the project's standing ruling; confirmed `package.json`/`package-lock.json` unchanged afterward (`git status --short` empty on both).
- Full-suite `npm test` reproduces the same 7 pre-existing failures Plans 01 and 02 already identified (`test/unit/class-pass-ledger.test.js` x4, `test/unit/flee-ledger.test.js` x3) — these files were last touched in Phase 45 (per `git log`), untouched by any of this phase's three plans, so the identical failure set on this branch is the same CRLF-checkout environment noise already declared, not a new regression.

## Next Phase Readiness
- GSCR-11 is proven and closed. Phase 62's own requirements (GSCR-01..06, GSCR-11) are all complete; GSCR-07..10 and GSCR-12 remain Phase 63/64 work (the bottom action sheet, greyed combat rows, back-button close, TalkBack, and the Pixel 7 UAT batch) — out of this phase's scope by design.
- No blockers. `engine/`, `content/`, `test/parity/` and every declared snapshot fixture are byte-identical to the phase's base commit (`b1243485e93e4131e90cae0e35c4edda2ff8502c`).

---
*Phase: 62-gear-tab-layout-rebuild*
*Completed: 2026-09-23*
