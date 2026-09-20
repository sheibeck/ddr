---
phase: 47-shell-modularisation
plan: 03
subsystem: ui
tags: [dom-carve, gear-tab, bridge-registry, source-pins, shell-modularisation]

requires:
  - phase: 47-01
    provides: "test/unit/harness/shellSandbox.js + shell-tab-snapshots.test.js (the DOM-snapshot lock this carve had to stay byte-equal against)"
  - phase: 47-02
    provides: "src/browser/bridge.js registry + bridge-registry.test.js (the gate this carve's __mzTabs/__mzCarriedList addition and six-bridge deletion had to satisfy)"
provides:
  - "src/browser/gearTab.js — renderGearTab(host, state, deps), renderCarriedList(container, state, items, opts, deps), bagUsage, GEAR_COPY, emptySlotRows, ITEM_STATE_COPY, itemRowState"
  - "test/unit/gearTab.test.js — the module's own 10-test source-pin suite"
  - "mazeworld.html's tabDeps() — the 12-key deps object every tab module receives (docs/SHELL-MODULES.md#Contract)"
  - "window.__mzTabs (gear only) + window.__mzCarriedList — the module-assigned, classic-read mount bridges Plans 04/05 extend"
affects: [47-04, 47-05]

tech-stack:
  added: []
  patterns:
    - "a tab module owns its full render surface (view models + DOM writers) behind ONE mount call (window.__mzTabs.<tab>(host, S, tabDeps())); the classic script never rebuilds that DOM itself again"
    - "tabDeps() — one classic-script function returning action closures over window.mz* bridges, so a module never touches window/document directly, only host/host.ownerDocument/deps"
    - "a bridge whose only reader moved into the module it bridges to is deleted, not kept with an empty consumer list — verified live via node tools/ident-sweep.mjs before deletion"

key-files:
  created:
    - test/unit/gearTab.test.js
  modified:
    - src/browser/gearTab.js
    - src/browser/viewModels.js
    - src/browser/combatMenu.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - mazeworld.html
    - test/unit/harness/shellSandbox.js
    - test/unit/itemRowState.test.js
    - test/unit/gear-panels.test.js
    - test/unit/lootCompare.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/shell-clarity-43.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-loot-screen.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/shell-armor-display.test.js
    - test/unit/shell-fight-gate.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-company-panel.test.js
    - test/unit/shell-combat-over.test.js
    - test/unit/bridge-registry.test.js

key-decisions:
  - "sellPriceFor's `price != null` ternary kept verbatim in gearTab.js's Sell row even though the direct import can never return null (only the old window.__mzSellPrice bridge-presence check could) — preserves the exact byte-for-byte label text/branch shape the snapshot lock and existing pins expect, at zero behavioural cost."
  - "Two files outside this task's stated <files> list required Rule 3 fixes because the plan's own required edits (pruning the shared viewModels.js/derived.js import lines in Task 1, and moving renderCarriedList's call site literal in Task 2) broke their pins: test/unit/shell-armor-display.test.js + test/unit/shell-gear-39.test.js (Task 1, the combined import-line pin) and test/unit/shell-combat-over.test.js (Task 2, the loot branch's renderCarriedList( call-site literal). All three are re-pointed, not deleted, and documented below rather than silently folded in."
  - "GEAR_SRC (a stripComments'd read of src/browser/gearTab.js) is the new region source every re-homed pin reads from, mirroring the existing CODE-from-mazeworld.html pattern exactly — no new stripping logic, tools/ident-sweep.mjs's stripJs is reused in gearTab.test.js itself per the plan's own read_first note."
  - "docs/SHELL-MODULES.md's bridge-registry `>= 50` live-count floor (set in Plan 02, before any tab carve existed) lowered to `>= 45` to reflect the real post-carve count (49) — a hard-coded regression-only floor, not a semantic assertion; comment records the exact math (53 - 6 + 2 = 49)."

patterns-established:
  - "Verbatim carve substitution table (used for every future tab carve, Plans 04/05): document -> host.ownerDocument; window.__mz<X> bridge read -> the direct import it bridged; window.mz<Action>?.(...) -> deps.<action>?.(...); guardTap(...) -> deps.guardTap(...)."

requirements-completed: [SHELL-01]

coverage:
  - id: D1
    description: "The Gear tab (ON YOU/ALSO ON YOU/BAG panels, equip/use/drop/swap confirms) renders from src/browser/gearTab.js#renderGearTab behind exactly one window.__mzTabs.gear(...) mount call; mazeworld.html's paint() builds none of that DOM itself any more"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "test/unit/gearTab.test.js (10 tests: exports, no window/document, id-containment, confirm-trio ownership, the mount pin, no classic renderCarriedList, __mzCarriedList reachability, __mzTabs assignment ordering, tabDeps() key coverage, GEAR_COPY/ITEM_STATE_COPY voice safety)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js (10 tests — 7 fixtures compared byte-equal, SHELL-03 idempotency, determinism, guard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six bridges whose only readers moved into gearTab.js (__mzGear, __mzItemRowState, __mzWornSlots, __mzWornKeysOf, __mzSlotFor, __mzSellPrice) are deleted from the shell, the registry and the harness in the same commits; __mzTabs + __mzCarriedList are registered"
    requirement: "SHELL-04"
    verification:
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10 pass); node tools/ident-sweep.mjs \"<name>\\b\" for each of the six retired names (0 hits each)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pin that read moved Gear code is re-homed to gearTab.js's source; zero test files deleted, zero assertions deleted"
    verification:
      - kind: unit
        ref: "npm test (3265/3265 pass); git diff --stat --diff-filter=D -- test/ (empty, both commits); per-file `^test(` counts unchanged except shell-clarity-43.test.js (+1 intentional new pin)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Gear tab's ON YOU/BAG rows, equip/use/drop/swap confirms, and the loot card's Stow/Equip now/Leave rows look and behave exactly as before on a real device"
    verification: []
    human_judgment: true
    rationale: "Verification agents are off for this milestone; deferred to the milestone-close Pixel 7 batch per project convention. The byte-equal DOM snapshot (test/unit/shell-tab-snapshots.test.js) is the automated proxy — any visual/behavioural regression this carve introduced would first show up there as a fixture diff, and none did."

duration: ~2h
completed: 2026-09-20
status: complete
---

# Phase 47 Plan 03: Gear Tab Carve — src/browser/gearTab.js Summary

**The Gear tab (ON YOU/ALSO ON YOU/BAG, equip/use/drop/swap confirms) now renders from `src/browser/gearTab.js#renderGearTab` behind one `window.__mzTabs.gear(...)` mount call; six dead `window.__mz*` bridges are deleted, `mazeworld.html` shrank from 6,330 to 5,980 lines, and all seven DOM snapshots compare byte-equal.**

## Performance

- **Duration:** ~2h (two task commits, `28c259f` and `b4ceeb8`; investigation/read-first time before the first commit not separately timed)
- **Tasks:** 2 completed
- **Files modified:** 23 (1 created: `test/unit/gearTab.test.js`; 22 modified)

## Accomplishments

- **Task 1 (pure move):** the five Gear-only view models (`bagUsage`, `GEAR_COPY`, `emptySlotRows`, `ITEM_STATE_COPY`, `itemRowState`) moved out of `src/browser/viewModels.js` into a new `src/browser/gearTab.js`, bodies and doc comments byte-identical. `combatMenu.js`'s `itemRowState` import re-pointed; the classic module script gained one new `gearTab.js` import line beside the two pruned `viewModels.js` lines.
- **Task 2 (the render carve):** `renderGearTab(host, state, deps)` and `renderCarriedList(container, state, items, opts, deps)` moved verbatim out of `paint()`/the classic `renderCarriedList` — `host.ownerDocument` replaces every `document` read, `deps.<action>?.(...)` replaces every `window.mz<Action>?.(...)` call, and direct imports (`canRead`, `maxCharges`, `sellPriceFor`, `slotFor`, `WORN_SLOTS`, `WORN_KEYS_OF`, `armorDisplay`, `bagArmorText`, `lootCompare`) replace the six retired bridges.
- `mazeworld.html` gained one new classic function, `tabDeps()`, immediately above `paint()` — a 12-key deps object (`guardTap` + 11 action closures over `window.mz*`) every tab module receives; Plans 04/05 reuse it unchanged for Hero/Store.
- `paint()` now makes exactly one call for the whole Gear surface: `window.__mzTabs.gear(document.getElementById("screen-gear"), S, tabDeps());`. The classic confirm trios (`DROP_CONFIRM_MS`/`SWAP_CONFIRM_MS` + their revert functions), `function renderCarriedList(`, and `function canRead()` are deleted from the classic script — `node tools/ident-sweep.mjs` confirms zero remaining references to any of them outside `gearTab.js`.
- The loot card and the store's sell list now reach the shared list through `window.__mzCarriedList(container, S, items, opts, tabDeps())` instead of calling the classic `renderCarriedList` directly.
- `src/browser/bridge.js` + `docs/SHELL-MODULES.md`: `__mzTabs` and `__mzCarriedList` added; `__mzGear`, `__mzItemRowState`, `__mzWornSlots`, `__mzWornKeysOf`, `__mzSlotFor`, `__mzSellPrice` deleted (53 -> 49 live bridges).
- `test/unit/harness/shellSandbox.js`'s `wireBridges` twinned to the new surface (six bridge lines removed, `__mzTabs`/`__mzCarriedList` added) — the DOM-snapshot harness now exercises the real carved module, not a stand-in.
- `test/unit/gearTab.test.js` — the module's own 10-test source-pin suite (exports, no-window/document, id-containment inside `#screen-gear`, confirm-trio ownership, the paint() mount pin, no classic `renderCarriedList`, `__mzCarriedList` reachability, `__mzTabs` assignment-before-boot ordering, `tabDeps()`'s 12-key coverage, voice safety).
- Ten pre-existing `shell-*.test.js` files re-pointed at `gearTab.js`'s source wherever their pin's subject moved (ledger below); one additional file outside this plan's stated scope (`shell-combat-over.test.js`) required the same treatment as a Rule 3 fix.

## Task Commits

1. **Task 1: move the Gear-tab view models to src/browser/gearTab.js (pure move, tests follow)** - `28c259f` (refactor)
2. **Task 2: src/browser/gearTab.js owns the Gear tab — paint() mounts it through window.__mzTabs.gear; renderCarriedList + confirms move; dead bridges deleted** - `b4ceeb8` (refactor)

No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP/REQUIREMENTS update is the final commit for this plan.

## Files Created/Modified

- `src/browser/gearTab.js` - the GEAR tab module: `renderGearTab`, `renderCarriedList`, `bagUsage`, `GEAR_COPY`, `emptySlotRows`, `ITEM_STATE_COPY`, `itemRowState`
- `src/browser/viewModels.js` - the five Gear exports removed; import block pruned to what remains
- `src/browser/combatMenu.js` - `itemRowState` import re-pointed to `./gearTab.js`
- `src/browser/bridge.js` + `docs/SHELL-MODULES.md` - `__mzTabs`/`__mzCarriedList` added, six retired names removed
- `mazeworld.html` - `tabDeps()`, the one Gear mount call, `window.__mzCarriedList` call sites, six classic declarations deleted (confirm trios, `renderCarriedList`, `canRead`), six bridge assignments deleted, gearTab.js import line extended
- `test/unit/harness/shellSandbox.js` - `wireBridges` twinned to the new surface
- `test/unit/gearTab.test.js` - new, the module's source-pin suite
- `test/unit/itemRowState.test.js`, `test/unit/gear-panels.test.js`, `test/unit/lootCompare.test.js`, `test/unit/hp-not-wp.test.js` - import re-points (Task 1)
- `test/unit/shell-clarity-43.test.js`, `test/unit/shell-worn-slots.test.js`, `test/unit/shell-gear-toolbar.test.js`, `test/unit/shell-gear-39.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-spells-40.test.js`, `test/unit/shell-armor-display.test.js`, `test/unit/shell-fight-gate.test.js`, `test/unit/shell-input-guards.test.js`, `test/unit/shell-company-panel.test.js`, `test/unit/shell-combat-over.test.js` - pins re-homed to `gearTab.js`'s source
- `test/unit/bridge-registry.test.js` - the live-count floor lowered from `>= 50` to `>= 45` (53 -> 49 real bridges)

## Re-pointed Pin Ledger

| File | What moved | Assertions re-targeted |
|---|---|---|
| `test/unit/itemRowState.test.js` | `itemRowState`, `ITEM_STATE_COPY` import | 1 import line |
| `test/unit/gear-panels.test.js` | `emptySlotRows`, `GEAR_COPY` import (dropShelfItems stays) | 1 import line |
| `test/unit/lootCompare.test.js` | `bagUsage` import (lootCompare/bagArmorText stay) | 1 import line |
| `test/unit/hp-not-wp.test.js` | `ITEM_STATE_COPY`, `GEAR_COPY` import; new module-scan test (f) added | 1 import line + 1 new test |
| `test/unit/shell-clarity-43.test.js` | GEAR_COPY import + the two viewModels import-line pins + the four bridge-order pins + the carry-region/kit-region/WORN_SLOTS-loop pins | ~10 assertions across 8 tests |
| `test/unit/shell-armor-display.test.js` (Task 1 Rule-3 fix) | the combined old viewModels import-line pin | 1 assertion |
| `test/unit/shell-gear-39.test.js` (Task 1 Rule-3 fix, Task 2) | the combined import-line pin; the wornSlotRow/renderCarriedList row-builder region; `__mzItemRowState` bridge-count pin | 4 assertions |
| `test/unit/shell-worn-slots.test.js` | SWAP-trio ordering; the confirm-mechanics region; the equip-branch region; both worn-row region pins; the module-bridges test | 6 tests fully rewritten |
| `test/unit/shell-gear-toolbar.test.js` | DROP_CONFIRM_MS ordering; the gear-action-row/drop-confirm region; the non-gear-drop/guard-ternary region; the Yes-dispatch region; the gearRow:true call-site pin; the Use-button pin | 7 tests |
| `test/unit/shell-loot-screen.test.js` | the module-bridge import-line pin; the renderCarriedList region (subFor/loot actions); the loot-branch's `renderCarriedList(` call-site literal; the paint-carry-region readout/freeRide pins; the derived.js import-line pin | 6 tests |
| `test/unit/shell-spells-40.test.js` | the Shield-row pin; the Mirror Self/Sense Presence/Sense Danger/Map the Floor region | 2 tests |
| `test/unit/shell-fight-gate.test.js` | the Use-button gate pin | 1 test |
| `test/unit/shell-input-guards.test.js` | the renderCarriedList `opts.guard` region | 1 test |
| `test/unit/shell-company-panel.test.js` | the DROP_CONFIRM_MS-untouched cross-check | 1 test |
| `test/unit/shell-combat-over.test.js` (Task 2 Rule-3 fix, outside stated scope) | the loot branch's `renderCarriedList(` region match + literal-list entry | 2 assertions |

Zero test files deleted, zero assertions deleted — every change above is a re-target of an existing assertion at `gearTab.js`'s own source (a new `GEAR_SRC` constant, mirroring each file's existing `CODE`-from-`mazeworld.html` pattern) or a small ordering/count fix required by the six-bridge deletion.

## Decisions Made

- `sellPriceFor`'s `price != null` ternary is kept verbatim in the moved Sell-row builder even though a direct import can never return `null` — preserves the exact branch/label shape the snapshot lock expects at zero behavioural cost, rather than simplifying to an always-true path that would be a gratuitous divergence from the plan's "verbatim move" instruction.
- Two files outside this plan's own `<files>` lists required fixes their own task's required edits broke: `shell-armor-display.test.js` and `shell-gear-39.test.js` (Task 1 — both pinned the old combined `viewModels.js` import line the `bagUsage`/`itemRowState` removal changed) and `shell-combat-over.test.js` (Task 2 — pinned the classic loot branch's `renderCarriedList(` call-site literal, which is now `window.__mzCarriedList(`). All three are documented here rather than silently folded into the "expected" file list.
- `bridge-registry.test.js`'s hard-coded `>= 50` live-bridge floor (set before any tab carve existed) is lowered to `>= 45` with a comment recording the exact math — a regression-only floor, not a claim about a specific future count.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pointed `test/unit/shell-armor-display.test.js` and `test/unit/shell-gear-39.test.js`'s combined-import-line pins (Task 1)**
- **Found during:** Task 1's own verification pass (`npm test` after the view-model move)
- **Issue:** Both files pinned the exact string `import { characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage, itemRowState } from "./src/browser/viewModels.js";`. Task 1's own required action (moving `bagUsage`/`itemRowState` off that line) broke both pins, even though neither file is in Task 1's stated `<files>` list.
- **Fix:** Updated both pins to match the pruned `viewModels.js` line plus a new assertion for the `gearTab.js` import line (`shell-gear-39.test.js` also needed its `__mzItemRowState` bridge-count/import-line pins updated in Task 2, tracked separately below).
- **Files modified:** `test/unit/shell-armor-display.test.js`, `test/unit/shell-gear-39.test.js`
- **Verification:** `npm test` — fail 0 after both fixes.
- **Committed in:** `28c259f` (Task 1 commit)

**2. [Rule 3 - Blocking] Re-pointed `test/unit/shell-combat-over.test.js`'s `renderCarriedList(` call-site pin (Task 2)**
- **Found during:** Task 2's own verification pass (`npm test` after the carve)
- **Issue:** The file pinned `renderCarriedList(wrap.querySelector("#loot-list")` and the bare literal `"renderCarriedList("` in a literal-checklist array, asserting the classic loot branch calls the function directly. Task 2's required change (the loot card now calls `window.__mzCarriedList(...)`) broke both, even though this file is not in Task 2's stated `<files>` list.
- **Fix:** Updated both to `window.__mzCarriedList(`.
- **Files modified:** `test/unit/shell-combat-over.test.js`
- **Verification:** `npm test` — fail 0.
- **Committed in:** `b4ceeb8` (Task 2 commit)

**3. [Rule 1 - Bug/plan's own truth] Lowered `bridge-registry.test.js`'s live-count floor from >= 50 to >= 45**
- **Found during:** Task 2's own verification pass (`node --test test/unit/bridge-registry.test.js`)
- **Issue:** `test("SHELL-04 teeth: diffing the real live set against an EMPTY registry reports every live name unlisted", ...)` hard-codes `assert.ok(live.length >= 50, ...)`, set in Plan 02 before any tab carve existed. This plan's own required six-bridge deletion (net -4, 53 -> 49) tripped that floor.
- **Fix:** Lowered the floor to `>= 45` with a comment recording the exact arithmetic, matching the same defensive-margin style the original `>= 50` (vs. an actual 53) used.
- **Files modified:** `test/unit/bridge-registry.test.js`
- **Verification:** `node --test test/unit/bridge-registry.test.js` — 10/10 pass.
- **Committed in:** `b4ceeb8` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3/Rule 1 — direct, required consequences of this plan's own named moves, none touching `engine/`, `content/`, or `test/parity/`).
**Impact on plan:** No scope creep. All three fixes were required to keep `npm test` at fail 0 after this plan's own stated actions; none widen the carve beyond the Gear tab.

## Issues Encountered

- `tools/shell-sweep.mjs refs` throws `Error: classic <script> line not found` against this Windows checkout's CRLF-terminated `mazeworld.html` (the tool's `findRegions()` does an exact `=== "<script>"` line match with no `\r`-stripping) — confirmed this is a pre-existing environment condition, not a regression: it reproduces identically against the Task-1-only commit (`28c259f`, before any Task 2 edit). Worked around by writing an LF-normalized scratch copy and running `node tools/shell-sweep.mjs refs <names> --file <scratch>`, which produced the exact proof the plan's verification step calls for: `refs renderCarriedList: 2` (the `gearTab.js` import binding + the `window.__mzCarriedList = renderCarriedList;` assignment — precisely the plan-sanctioned exception) and `refs <name>: 0` for `wornSlotRow`, `revertDropConfirm`, `revertSwapConfirm`, `DROP_CONFIRM_MS`, `SWAP_CONFIRM_MS`, `canRead`. `node tools/ident-sweep.mjs "<name>\b"` (which does its own CRLF-tolerant regex read) independently confirms all six retired bridge names are 0 references anywhere outside `src/browser/bridge.js` doc-comment prose. Scratch file deleted after verification; no repo file left behind.

## User Setup Required

None - no external service configuration required.

## Gate Results

- `npm test` -> `# pass 3265`, `# fail 0` (baseline after Plan 02 was 3253; +12 = 2 new `hp-not-wp.test.js` module-scan assertions + gearTab.test.js's 10)
- `npm run build:www` -> exit 0
- `npm run boot:check` -> `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/shell-tab-snapshots.test.js` -> `# pass 10`, `# fail 0`; `git diff --stat -- test/unit/fixtures/` -> empty at every commit (all 7 fixtures byte-equal, both tasks)
- `node --test test/unit/bridge-registry.test.js` -> `# pass 10`, `# fail 0`; `node tools/bridge-doc.mjs --check` -> exit 0
- `node --test test/unit/gearTab.test.js` -> `# pass 10`, `# fail 0`
- Bridge delta: 53 -> 49 (+2 `__mzTabs`/`__mzCarriedList`, -6 `__mzGear`/`__mzItemRowState`/`__mzWornSlots`/`__mzWornKeysOf`/`__mzSlotFor`/`__mzSellPrice`); `node -e "import('./src/browser/bridge.js').then(m => console.log(m.bridgeNames().length))"` -> `49`
- `node tools/ident-sweep.mjs "<name>\b"` for each of the six retired names -> `0` hits, exit 0, for all six
- `node tools/shell-sweep.mjs refs ... --file <LF-scratch-copy>` (see Issues Encountered for the CRLF workaround) -> `refs renderCarriedList: 2` (exactly the plan-sanctioned exception), `refs <other-five>: 0` each
- `wc -l mazeworld.html`: before (pre-Plan-03, commit `bbb6503`) 6,330 -> after (this plan's HEAD) 5,980 (-350 lines, exceeds the plan's >= 300 floor)
- Engine fence: `git status --porcelain engine/ content/ test/parity/` -> empty; `git hash-object test/parity/prototype-master.js.txt` -> `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- Post-commit deletion check on both task commits: `git diff --diff-filter=D --name-only HEAD~1 HEAD` -> empty for both `28c259f` and `b4ceeb8` (no unexpected file deletions)
- `git diff --stat --diff-filter=D -- test/` -> empty (no test file deleted, either commit)

## Human verification (deferred to end of run)

Deferred to the milestone-close Pixel 7 batch (verification agents are off for this milestone; per-plan on-device checks are not run). When that batch runs, check on a real device:

- **Gear tab layout:** ON YOU (WIELDED weapon row, WORN armor row, worn jewelry/cloak rows, empty-slot rows in voice) and BAG (carried items with Use/Equip/Drop) render identically to before this carve — no missing rows, no layout shift, m-gold and the ALSO ON YOU panel (Potions/Scrolls/Rations/Wilmst/Spell charges/Kills and the conditional rows) unchanged.
- **Equip/Unequip/Use taps** on worn and bagged items still dispatch correctly (no dead buttons, no double-fires).
- **The Drop two-tap confirm** ("Drop it? Yes/No") and **the jewelry/cloak swap confirm** ("Swap for X?" / "Swap for which?" with per-slot buttons) still arm, revert on timeout, revert on outside-tap, and dispatch correctly.
- **The victory loot card's** Stow/Equip now/Leave rows (via the now-shared `window.__mzCarriedList`) still render and dispatch identically, including the bag-full drop shelf.
- **The store's sell list** (also via `window.__mzCarriedList`) still shows Sell buttons with correct prices and, when the bag is full, a Drop button alongside Sell.

No code-level regression risk expected here — the DOM-snapshot lock (`test/unit/shell-tab-snapshots.test.js`) already proves byte-identical rendered output for the Gear tab, both confirm states, and the store, across both a Thief and a Magic User fixture. This device round is a UX-feel confirmation, not a functional-regression hunt.

## Next Phase Readiness

- Plan 04 (`heroTab.js`) can reuse `tabDeps()` unchanged — its 12 keys already cover every action a Hero-tab surface would need, per `docs/SHELL-MODULES.md#Contract`.
- Plan 04/05 extend `window.__mzTabs` (currently `Object.freeze({ gear: renderGearTab })`) to add `hero`/`store` — `gearTab.test.js`'s pin on the exact literal `window.__mzTabs = Object.freeze({ gear: renderGearTab });` will need re-pointing when that happens (already flagged in the test's own comment).
- `window.__mzCarriedList`'s call count in the classic script is 2 (loot card + store sell list); Plan 05 tightens this to 1 when it moves the store's sell-list call into `storeScreen.js`.
- `mazeworld.html` is 5,980 lines — still above the SHELL-04 `< 5,000` target; Plans 04/05's Hero/Store carves (each removing several hundred more lines per 47-CONTEXT.md's line-budget estimate) are required to close SHELL-04.
- SHELL-01 is marked complete in `REQUIREMENTS.md` (its full statement — the Gear tab module + its own source-pin suite + paint()-only-mounts — is satisfied). SHELL-04 stays pending until Plan 05's line-budget half closes.
- No blockers.

---
*Phase: 47-shell-modularisation*
*Completed: 2026-09-20*

## Self-Check: PASSED

All 3 key files found on disk (`src/browser/gearTab.js`, `test/unit/gearTab.test.js`, this SUMMARY); both task commits (`28c259f`, `b4ceeb8`) found in git log.
