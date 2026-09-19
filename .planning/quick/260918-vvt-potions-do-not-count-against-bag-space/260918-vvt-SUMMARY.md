---
phase: quick-260918-vvt
plan: 01
subsystem: inventory
tags: [vanilla-js, rules-engine, inventory, bag-capacity, potions, scrolls, single-helper]

requires: []
provides:
  - "engine/derived.js#takesBagSlot(it) + BAG_FREE_KINDS — the one bag-free predicate (potion, scroll, bag)"
  - "slotItems, stowItem, dropShelfItems, and the shell's find-card/loot needsSlot all route through takesBagSlot"
  - "find card, loot screen, Gear header, store line all agree with the engine on what is bag-free"
affects: [inventory, gear-panel, loot-screen, store, find-card]

tech-stack:
  added: []
  patterns:
    - "Single predicate + bridge pattern (window.__mz*) reused for a shell-side capacity check, matching the existing window.__mzBagUsage/__mzDropShelfItems precedent"

key-files:
  created: []
  modified:
    - engine/derived.js
    - engine/items.js
    - src/browser/viewModels.js
    - mazeworld.html
    - test/unit/bag-cap-gate.test.js
    - test/unit/gear-panels.test.js
    - test/unit/shell-loot-screen.test.js

key-decisions:
  - "GEAR_COPY.freeRide and the viewModels.js dropShelfItems filter use the file's real 2-space object-literal indent (not the plan's literal 4-space verify-grep assumption) — functionally identical, verified by the full test suite rather than the plan's own indent-sensitive grep"
  - "The Task 3 negative sweep is scoped to the four specific bag-CAPACITY call sites (slotItems/stowItem/dropShelfItems/needsSlot), not a blanket 'kind !== potion' grep — engine/items.js#itemReady, viewModels.js#itemRowState, and mazeworld.html's dead classic itemReady mirror keep their own unrelated, pre-existing 'is this item activatable' potion check, which is a different mechanism and out of this task's scope"
  - "buyFrom's Sealed-scroll purchase needed no code change — buyScroll was never in STOWING_EFFECTS (scrolls are a c.scrolls scalar), so the full-bag purchase already succeeded; the Task 1 test locks this as a defensive regression pin"

requirements-completed: [QUICK-260918-vvt]

coverage:
  - id: D1
    description: "engine/derived.js#takesBagSlot + BAG_FREE_KINDS is the one bag-free predicate; slotItems/stowItem/dropShelfItems all route through it"
    requirement: "QUICK-260918-vvt"
    verification:
      - kind: unit
        ref: "test/unit/bag-cap-gate.test.js (takesBagSlot/BAG_FREE_KINDS, slotItems, stowItem sections)"
        status: pass
      - kind: unit
        ref: "test/unit/gear-panels.test.js (dropShelfItems scroll case + lock-step test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A potion or scroll found on a full bag never triggers the bag-full line, drop shelf, or TAKE IT NOW — the find-card leak is fixed"
    requirement: "QUICK-260918-vvt"
    verification:
      - kind: unit
        ref: "test/unit/shell-loot-screen.test.js quick 260918-vvt (c)"
        status: pass
    human_judgment: true
    rationale: "Visual rail-card behavior (which button label renders, whether the drop shelf appears) needs an on-device look, per the deferred-UAT protocol — the source-assertion test proves the code path but not the rendered result"
  - id: D3
    description: "A full-bag store visit still sells potions and Sealed scrolls without a bagFull event or gold loss"
    requirement: "QUICK-260918-vvt"
    verification:
      - kind: unit
        ref: "test/unit/bag-cap-gate.test.js buyFrom potion/Sealed-scroll tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gear tab BAG header and store bag-full line say the exemption out loud in voice (GEAR_COPY.freeRide / 'Potions and scrolls still ride free.')"
    requirement: "QUICK-260918-vvt"
    verification:
      - kind: unit
        ref: "test/unit/gear-panels.test.js GEAR_COPY pin; test/unit/shell-loot-screen.test.js quick 260918-vvt (e)/(f)"
        status: pass
    human_judgment: true
    rationale: "Copy placement/wrapping on a real device screen is a visual check, per the deferred-UAT protocol"

duration: 45min
completed: 2026-09-18
status: complete
---

# Quick Task 260918-vvt: Potions Do Not Count Against Bag Space — Summary

**Single `takesBagSlot(it)` predicate in engine/derived.js now gates every bag-capacity check (engine + shell); the find card's bag-full leak for potions/scrolls is fixed.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 7

## Ground Truth (from the plan)

The engine has exempted `kind:"potion"` items from bag capacity since Phase 29 (LOOT-04) via `engine/derived.js#slotItems` → `engine/items.js#canStow`/`stowItem`, and every stow path (`takeFind`, `takeLoot`, `takeAllLoot`, `unequipSlot`, `economy.js#buyFrom` via `STOWING_EFFECTS`) already funnels through `stowItem`. Scrolls are a scalar `c.scrolls` (`encounters.js#findMisc`'s Scroll branch, `economy.js`'s `STORE_EFFECTS.buyScroll`) and never enter `c.items` at all — `buyScroll` was never in `STOWING_EFFECTS`, so a Sealed-scroll purchase on a full bag already worked with zero code change needed. Two things were actually wrong: (1) the potion exemption was an inline `it.kind !== "potion"` inequality copy-pasted into four places; (2) the find decision card in mazeworld.html read the aggregate `usage.full` with no per-item check, so a potion (or, after the amendment, a scroll-kind item) found on a full bag showed the bag-full line, a drop shelf, and "TAKE IT NOW" even though the engine would accept it unconditionally.

## Accomplishments

1. **Task 1 (engine):** Added `BAG_FREE_KINDS` (`Set(["potion", "scroll", "bag"])`) and `takesBagSlot(it)` to `engine/derived.js` — the one bag-free predicate. `slotItems` now filters through it; `engine/items.js#stowItem`'s capacity gate reads it. Locked with new tests: `takesBagSlot`/`BAG_FREE_KINDS` unit tests, `slotItems`/`stowItem` scroll-kind defensives, a Sealed-scroll `buyFrom` on a full bag, and `findMisc` Scroll/Potion-then-`takeFind` on a full bag.
2. **Task 2 (view-models):** `src/browser/viewModels.js#dropShelfItems` now filters through the same `takesBagSlot`, proven in lock-step with `slotItems` (a scroll-kind entry excluded by both). Added `GEAR_COPY.freeRide` ("potions & scrolls ride free") as the one home of the Gear header's in-voice note; re-pinned the frozen `GEAR_COPY` shape.
3. **Task 3 (shell):** Bridged `window.__mzTakesBagSlot = takesBagSlot`. Fixed the find-card leak — `full` is now `usage.full && window.__mzTakesBagSlot(it)`, so a potion or scroll found on a full bag gets the plain card and `takeFind` accepts it. The loot screen's `needsSlot` now routes through the same bridge instead of its own inline kind checks. The Gear header appends `gearCopy.freeRide` for a capped bag; the store's bag-full line ends "Potions and scrolls still ride free." Added a new source-assertion test section (8) in `shell-loot-screen.test.js` pinning every edit, plus a scoped negative sweep proving the four bag-capacity inline inequalities are gone.

## Task Commits

1. **Task 1: ENGINE — `takesBagSlot`/`BAG_FREE_KINDS`, `slotItems`/`stowItem` routed through it** — `ecaac28` (feat)
2. **Task 2: VIEW-MODELS — `dropShelfItems` reads `takesBagSlot`; `GEAR_COPY.freeRide`** — `63ea217` (feat)
3. **Task 3: SHELL — bridge, find-card fix, loot `needsSlot`, BAG header + store notes, section 8** — `dbe7dea` (feat)

## Files Created/Modified

- `engine/derived.js` — `BAG_FREE_KINDS` + `takesBagSlot(it)`; `slotItems` routed through it
- `engine/items.js` — `stowItem`'s capacity gate reads `takesBagSlot(it)`
- `src/browser/viewModels.js` — `dropShelfItems` routed through `takesBagSlot`; `GEAR_COPY.freeRide` added
- `mazeworld.html` — new `takesBagSlot` import + `window.__mzTakesBagSlot` bridge; find-card `full` gated per item; loot `needsSlot` via the bridge; Gear header + store bag-full line append the in-voice note
- `test/unit/bag-cap-gate.test.js` — `takesBagSlot`/`BAG_FREE_KINDS` unit tests, scroll-kind defensives, Sealed-scroll `buyFrom`, `findMisc` Scroll/Potion tests
- `test/unit/gear-panels.test.js` — re-pinned `GEAR_COPY` (freeRide leaf); scroll case added to `dropShelfItems` section
- `test/unit/shell-loot-screen.test.js` — new section 8 (bridge/import pins, find-card/loot/gear-header/store source pins, scoped negative sweep, behavior tie-test)

## Decisions Made

- The `GEAR_COPY.freeRide` leaf and the `dropShelfItems` filter line were written matching the file's real 2-space object-literal indentation, not the plan's own literal 4-space verify-grep assumption (`^    freeRide: ...`). The plan's automated verify command for that one grep would report 0 matches against the actual, correctly-indented code; the full functional test suite (gear-panels.test.js, lootCompare.test.js, safety-scan.test.js — all passing) is the authoritative confirmation instead.
- Scoped the Task 3 negative sweep to the four specific bag-capacity call sites the plan named (slotItems/stowItem/dropShelfItems/needsSlot) rather than a blanket "no `kind !== \"potion\"` anywhere" sweep. `engine/items.js#itemReady`, `src/browser/viewModels.js#itemRowState`, and mazeworld.html's dead classic `itemReady`/`useItem` mirror all keep their own pre-existing, unrelated "is this item activatable" `kind !== "potion"` check — a completely different mechanism (item readiness to trigger a `use` effect, not bag capacity) that predates this task and is out of its scope. Rewriting those to `takesBagSlot` would have been semantically wrong and outside the plan's file list.
- Confirmed (no code change): `buyFrom`'s Sealed-scroll purchase (`effectId: "buyScroll"`) was never gated by `STOWING_EFFECTS` — scrolls are the `c.scrolls` scalar and never touch `c.items`, so a full-bag Sealed-scroll buy already succeeded before this task. Locked as a defensive regression test rather than a code fix.

## Deviations from Plan

None requiring Rule 4 (no architectural changes). Two Rule-1-adjacent scope corrections, both documented above under Decisions Made:

**1. [Scope correction] Negative sweep narrowed to avoid a false positive on unrelated dead/live code**
- **Found during:** Task 3 (writing the section-8 negative sweep)
- **Issue:** A blanket sweep for `kind !== "potion"` across all four files matched `engine/items.js#itemReady` (line ~1008), `src/browser/viewModels.js#itemRowState` (line ~424), and mazeworld.html's dead classic `itemReady()` (line ~3927) — none of which are bag-capacity checks; they gate whether an item can be activated via `useItem`.
- **Fix:** Scoped the sweep's regexes to the exact four historical capacity-gate literals (the old `slotItems` filter body, `stowItem`'s gate, `dropShelfItems`' filter, and the loot screen's `needsSlot`), each already replaced by `takesBagSlot`.
- **Files modified:** test/unit/shell-loot-screen.test.js (test-only; no source change)
- **Verification:** `npm test` 3200/3200, 0 fail
- **Committed in:** dbe7dea (Task 3 commit)

**Total deviations:** 0 auto-fixed source changes; 1 test-scoping correction to avoid a false-positive test.
**Impact on plan:** None — every must_have truth and artifact in the plan landed as specified; the correction only affects a test's own assertion precision.

## Issues Encountered

None beyond the test-scoping correction above.

## Gate Results

- `node --test test/unit/bag-cap-gate.test.js test/unit/inventory-actions.test.js test/unit/loot-pile.test.js test/unit/tools.test.js test/unit/economy.test.js test/unit/worn-slots.test.js` — 206/206 pass
- `node --test "test/parity/**/*.test.js" "test/roundtrip/**/*.test.js" "test/persistence/**/*.test.js"` — 106/106 pass
- `node --test test/unit/gear-panels.test.js test/unit/lootCompare.test.js test/unit/shell-clarity-43.test.js test/unit/shell-gear-39.test.js test/unit/shell-worn-slots.test.js test/voice/safety-scan.test.js` — 83/83 pass
- `node --test test/unit/shell-loot-screen.test.js test/unit/shell-combat-over.test.js test/unit/shell-clarity-43.test.js test/unit/shell-gear-39.test.js test/unit/shell-worn-slots.test.js test/unit/shell-map-rail.test.js` — 104/104 pass
- **`npm test`: 3200/3200 pass, 0 fail** (baseline was 3184; +16 new tests, zero regressions)
- `npm run build:www` — exit 0
- `git diff --stat -- content test/parity` — empty (zero fixture drift)
- `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- No `npm run android:debug` / `adb` command run (deferred-UAT protocol)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Code-complete. The five-step browser sanity check below is ready to fold into the next batched Pixel 7 UAT round (per the deferred-UAT protocol — no device pause here).

## Human verification

Executed as part of the next batched Pixel 7 device round (debug APK built from this commit or later):

1. Serve the repo root over http (`npx serve .` or any static server — the ESM module needs http, not `file://`) and open `mazeworld.html`; start a new run; go Hero → Gear: the BAG header reads `n / m · potions & scrolls ride free`.
2. Fill the bag to `m / m` (play normally, or use the dev start-at-depth harness), then find a Potion: the rail find card shows only the item line — no "Your bag is full" line, no drop shelf, button reads TAKE IT. Tap it: the potion appears in the BAG list; the header still reads `m / m · potions & scrolls ride free`.
3. With the bag still full, find gear (weapon/armor/jewel/etc.): the card DOES show the bag-full line + drop shelf + TAKE IT NOW (unchanged from before this task).
4. Enter a store with a full bag: the rust line ends "Potions and scrolls still ride free." Buying a potion (and, as a Magic User, a Sealed scroll) succeeds and deducts wilmst; buying a Set of lockpicks is refused with the bagFull toast and no gold spent.
5. Load a v1.5 save: bag/potions/scrolls intact, no console errors.

## Self-Check: PASSED

All three task commits (ecaac28, 63ea217, dbe7dea) verified present in `git log`; all seven files_modified paths verified present on disk (engine/derived.js, engine/items.js, src/browser/viewModels.js, mazeworld.html, test/unit/bag-cap-gate.test.js, test/unit/gear-panels.test.js, test/unit/shell-loot-screen.test.js).

---
*Phase: quick-260918-vvt*
*Completed: 2026-09-18*
