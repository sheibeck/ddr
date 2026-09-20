---
phase: 47-shell-modularisation
plan: 01
subsystem: testing
tags: [node-vm, dom-snapshot, test-harness, shell-modularisation, regression-lock]

requires: []
provides:
  - "test/unit/harness/recordingDom.js — createRecordingDocument() (element stub + deterministic serializeElements(doc, ids))"
  - "test/unit/harness/shellSandbox.js — loadShellSandbox({ doc }) running mazeworld.html's classic <script> under node:vm with the real window.__mz* bridges wired, plus fixedStates()/SNAPSHOT_IDS"
  - "test/unit/shell-tab-snapshots.test.js — the standing 3-screen DOM smoke (Gear/Hero/Store)"
  - "test/unit/fixtures/shell-snapshots/*.txt — the seven committed BEFORE fixtures Plans 03-05 carve against"
affects: [47-02, 47-03, 47-04, 47-05]

tech-stack:
  added: []
  patterns:
    - "node:vm sandbox for the classic <script> (mirrors test/parity/harness/sandboxPrototype.js), with the module script's window.__mz* bridges wired from the SAME source imports rather than a dummy stub"
    - "recording-document DOM stub: ids are recorded ROOTS (no HTML parser), with a stable sorted serializer for byte-for-byte fixture comparison"
    - "MZ_SNAPSHOT_UPDATE=1 write-gate — fixtures are captured exactly once, compared on every other run"

key-files:
  created:
    - test/unit/harness/recordingDom.js
    - test/unit/harness/shellSandbox.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-confirms.txt
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/mu.gear.txt
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt
  modified: []

key-decisions:
  - "Jewelry equip order interleaved (stow jewel -> equip immediately -> stow next) rather than stow-all-three-then-equip-two, because a Thief's small (4-slot) bag cannot hold weapon+armor+3 jewels+tool simultaneously — equipping each jewel right after it lands in the bag keeps every stow within cap while still leaving the third jewel in the bag for the swap-confirm fixture."
  - "extractScriptRegions' slice bounds exclude the '<script>'/'</script>' tag lines themselves (offset by the marker string's own length, not +1 like the sibling shell-no-content-copies.test.js) — that sibling only regex-scans its extracted text, so a leading tag line is harmless there; here the text is fed directly to vm.runInContext as JS source, so the tag markup must never be included."

patterns-established:
  - "A4 iteration surfaced two real recordingDom.js bugs (not test-authoring mistakes) rather than just missing stubs — see Deviations."

requirements-completed: [SHELL-01, SHELL-02, SHELL-03]

coverage:
  - id: D1
    description: "The Gear tab DOM (#m-gold/#s-kit/#s-carry-n/#s-onyou/#s-carry) for two fixed states is captured BEFORE any body moves and committed as fixtures; a plain test run compares byte-for-byte"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js#SHELL-01: thief.gear / SHELL-01: mu.gear / SHELL-01: thief.gear-confirms / SHELL-01: mu-store.store / SHELL-01: thief-store.store"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Hero tab DOM (s-level..doss, s-grimoire, hero-party-list) for two fixed states is captured and committed the same way, compared byte-for-byte"
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js#SHELL-01/02: thief.hero / SHELL-02: mu.hero"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rendering the store twice from the same state (two renderEncounter() calls) serializes byte-equal to a single render, with no duplicate #shelf/#sell-list rows"
    requirement: "SHELL-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js#SHELL-03: rendering the store twice from the same state serializes byte-equal (no duplicate rows)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The recording document serializes with a stable order (sorted attribute/data/style keys, insertion-ordered children) so two renders of the same state always serialize identically"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js#determinism: two independent sandboxes painting the same fixed state serialize identically"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every fixture is produced only under MZ_SNAPSHOT_UPDATE=1; a plain node --test run never writes a fixture and fails hard on a missing/empty one"
    verification:
      - kind: unit
        ref: "test/unit/shell-tab-snapshots.test.js#guard: all seven fixtures exist and are non-empty (a plain run never writes one)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-09-19
status: complete
---

# Phase 47 Plan 01: DOM-Snapshot Harness + BEFORE Fixtures Summary

**A node:vm harness runs mazeworld.html's real classic paint()/renderEncounter() against a recording DOM to lock the Gear/Hero/Store tabs' exact rendered markup as seven committed BEFORE fixtures, before Plans 02-05 carve a single line out of the shell.**

## Performance

- **Duration:** ~45 min (task commits span 19:18:31–19:39:29 local; investigation/reading time before the first commit is not separately timed)
- **Tasks:** 3 completed
- **Files modified:** 9 (2 harness files + 1 test file + 7 fixtures — none of them `mazeworld.html`, `engine/`, `content/`, or `test/parity/`)

## Accomplishments

- `test/unit/harness/recordingDom.js` — a from-scratch recording DOM: element stub covering every API the three surfaces call (innerHTML/textContent as accessor properties, classList/dataset/style/attributes, appendChild/insertBefore/removeChild/replaceChildren/replaceWith, `#id`/`.class`/tag/`:scope > tag` query support, a no-op 2D canvas context) plus a deterministic, sorted-key serializer.
- `test/unit/harness/shellSandbox.js` — loads mazeworld.html's classic `<script>` under `node:vm` (same technique as `test/parity/harness/sandboxPrototype.js`), wires 26 real `window.__mz*` bridges from their real source imports, wires the BEFORE-only Grimoire seam (`wireLegacyGrimoire`, marked for Plan 04 deletion), and builds four deterministic, engine-only GameStates (`thief`, `mu`, `thiefStore`, `muStore`) exercising worn rows, empty-slot rows, the bag-full store line, and the jewelry swap confirm.
- `test/unit/shell-tab-snapshots.test.js` — 10 tests: 7 fixture captures/compares, the SHELL-03 store-idempotency proof, a paint()/serializer determinism check, and a guard against a missing/empty fixture ever silently passing.
- Seven BEFORE fixtures committed under `test/unit/fixtures/shell-snapshots/` (sizes below) — the lock Plans 03-05 carve against.

### Fixture sizes (`wc -c`)

| Fixture | Bytes |
|---|---|
| thief.hero.txt | 3,290 |
| thief.gear.txt | 4,453 |
| thief.gear-confirms.txt | 2,533 |
| thief-store.store.txt | 4,610 |
| mu.hero.txt | 5,414 |
| mu.gear.txt | 1,568 |
| mu-store.store.txt | 2,970 |
| **Total** | **24,838** |

### Wired bridges (26, twin of the module script's bridge block)

`__mzTables`, `__mzNightlyEats`, `__mzPartyCap`, `__mzSellPrice`, `__mzConditionsOf`, `__mzEther`, `__mzMapView`, `__mzAbilities`, `__mzEff`, `__mzSlotFor`, `__mzWornSlots`, `__mzWornKeysOf`, `__mzInputGuards`, `__mzArmorDisplay`, `__mzBagUsage`, `__mzTakesBagSlot`, `__mzLootCompare`, `__mzHasTool`, `__mzToolIndex`, `__mzToHit`, `__mzStrikeDie`, `__mzItemRowState`, `__mzUsableBy`, `__mzRations`, `__mzDropShelfItems`, `__mzGear`.

Deliberately NOT wired (the three snapshot surfaces never reach them; `draw()`/`renderRail()` are stubbed no-ops instead): `__mzRailVM`, `__mzFightLogVM`, `__mzCombatVM`, `__mzIconMap`, `__mzMapMarks`, `__mzCanvasSizing`, `__mzTapStep`, `__mzControls`, `__mzIconsApi`, `__mzHaptics`, `__mzSettings`. The `window.mz*` action bridges (`mzUseItem`, `mzEquipItem`, `mzDropItem`, `mzUnequip`, `mzSellItem`, `mzBuyItem`, `mzLeaveStore`, …) are also unwired — every call site in the shell is optional-chained (`window.mzDropItem?.(i)`), so tapping Drop/Equip in the gear-confirms test arms the confirm UI without throwing.

### A4 stub-iteration additions (each a real fix, found by actually running the harness — not pre-guessed)

1. **`extractScriptRegions` slice bounds** (shellSandbox.js) — the sibling `shell-no-content-copies.test.js`'s `classicStart + 1` boundary includes the literal `"<script>\n"` tag text (harmless for that file's regex-only scanning); fed to `vm.runInContext` as JS source it is a `SyntaxError: Unexpected token '<'`. Fixed by offsetting past the marker string's own length instead.
2. **`appendChild`/`insertBefore` detach-from-old-parent** (recordingDom.js, found during Task 2's functional probe) — `mazeworld.html`'s `renderCarriedList` gearRow block re-parents already-appended `<button>` elements into a new `.mw-gear-actions` row div via `row.appendChild(b)`; a real DOM automatically unlinks a node from its previous parent on `appendChild`, but the stub did not, so every gear row's action buttons were serializing twice (once under the `<li>`, once under the new row div). Fixed by detaching from `parentNode.children` before inserting.
3. **innerHTML id-invalidation** (recordingDom.js, found while capturing the `thief-store`/`mu-store` fixtures and running the SHELL-03 idempotency test) — `recordingDom` deliberately never parses an innerHTML string into real child elements (ids are recorded roots, not nested-by-parse), but `renderEncounter()`'s store branch writes markup containing `id="shelf"`/`id="sell-head"`/`id="sell-list"`/`id="a-leave"` and immediately looks each one up via `getElementById`. In a real DOM that re-parse always yields a fresh element; without invalidating those ids, a second `renderEncounter()` call kept appending onto the FIRST call's stale `#shelf` root — the exact bug SHELL-03's idempotency assertion exists to catch. Fixed by scanning the assigned HTML string for `id="..."` attributes and deleting exactly those keys from the shared `elementsById` map on every `.innerHTML =` write.

## Task Commits

1. **Task 1: recordingDom.js — a recording fake document with a stable serializer** - `cf587bb` (test)
2. **Task 2: shellSandbox.js — run the classic script under node:vm with the module-script bridge twin, plus the fixed states** - `75c15ee` (test) — also carries the appendChild/insertBefore fix (found during this task's own functional verification)
3. **Task 3: shell-tab-snapshots.test.js — capture the seven BEFORE fixtures, then prove the standing test compares (never writes)** - `18a425f` (test) — also carries the innerHTML id-invalidation fix (found while writing this task's SHELL-03 idempotency test)

No separate plan-metadata commit — this SUMMARY/STATE/ROADMAP update is the final commit for this plan.

## Files Created/Modified

- `test/unit/harness/recordingDom.js` - the recording fake document + deterministic serializer
- `test/unit/harness/shellSandbox.js` - node:vm classic-script loader, real bridge wiring, fixed-state builder
- `test/unit/shell-tab-snapshots.test.js` - the 10-test standing 3-screen DOM smoke
- `test/unit/fixtures/shell-snapshots/{thief.hero,thief.gear,thief.gear-confirms,thief-store.store,mu.hero,mu.gear,mu-store.store}.txt` - the seven committed BEFORE fixtures

## Decisions Made

- Jewelry equip order interleaved (stow → equip immediately → stow next) rather than stow-all-three-then-equip-two, because a Thief's small (4-slot) bag cannot hold weapon+armor+3 jewels+tool at once — see key-decisions in frontmatter.
- `extractScriptRegions`'s slice bounds differ from the sibling `shell-no-content-copies.test.js` (offset by the marker's own length, not `+1`) because this file's extracted text is executed as JS, not just regex-scanned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `appendChild`/`insertBefore` did not detach a re-parented node from its previous parent**
- **Found during:** Task 2 (functional probe painting all four fixed states)
- **Issue:** `renderCarriedList`'s gearRow block re-parents already-appended buttons into a new `.mw-gear-actions` row div; the stub left the old reference in place, serializing every gear row's buttons twice.
- **Fix:** `appendChild`/`insertBefore` now detach `child` from its current `parentNode.children` before inserting into the new parent.
- **Files modified:** `test/unit/harness/recordingDom.js`
- **Verification:** re-ran the Task 2 functional probe — `thief.gear`'s bag rows show each action button exactly once, nested under `.mw-gear-actions`.
- **Committed in:** `75c15ee` (Task 2 commit)

**2. [Rule 1 - Bug] innerHTML assignment did not invalidate ids described in the new markup**
- **Found during:** Task 3 (capturing `thief-store.store.txt` and writing the SHELL-03 idempotency test)
- **Issue:** `renderEncounter()`'s store branch declares `id="shelf"`/`id="sell-head"`/`id="sell-list"`/`id="a-leave"` inside a template string assigned to `body.innerHTML`, then immediately looks each up via `getElementById`. `recordingDom` never parses that string, so the SAME memoised element kept accumulating stock rows across repeated `renderEncounter()` calls instead of starting fresh.
- **Fix:** the `innerHTML` setter now scans the assigned string for `id="..."` attributes and deletes exactly those keys from the shared `elementsById` map, forcing the next `getElementById` for that id to create a fresh element (matching a real DOM's re-parse).
- **Files modified:** `test/unit/harness/recordingDom.js`
- **Verification:** `SHELL-03: rendering the store twice from the same state serializes byte-equal (no duplicate rows)` passes; `class="goods` count is identical (13) across both renders.
- **Committed in:** `18a425f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the harness code written earlier in this same plan, caught by the plan's own verification steps before any commit).
**Impact on plan:** Both fixes are internal to the new test harness (`test/unit/harness/recordingDom.js`); neither touches `mazeworld.html`, `engine/`, `content/`, or `test/parity/`. No scope creep — both were required for the plan's own SHELL-03 truth to hold.

## Issues Encountered

None beyond the two auto-fixed harness bugs above — both were caught by the plan's own verification steps (the Task 2 functional probe and the Task 3 SHELL-03 test) before any commit, not discovered later.

## User Setup Required

None - no external service configuration required.

## Gate Results

- `node --test test/unit/shell-tab-snapshots.test.js` → `# pass 10`, `# fail 0` (plain compare run, zero fixtures written)
- `npm test` → `# pass 3243`, `# fail 0` (baseline was 3,231; +12 = 2 harness "file loaded" tests (`recordingDom.js`, `shellSandbox.js`) + 10 `shell-tab-snapshots.test.js` tests)
- `npm run build:www` → exit 0
- `npm run boot:check` → `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- Engine fence: `git status --porcelain engine/ content/ test/parity/` → empty; `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `git diff --stat HEAD~3 -- mazeworld.html` → empty (mazeworld.html untouched by this plan's three commits)

## Human verification (deferred to end of run)

None — this plan is test-harness-and-fixtures only. Nothing user-visible changed: `mazeworld.html` and `src/browser/` were not modified, so there is no new on-device behavior for a Pixel 7 round to check. The fixtures captured here become the byte-for-byte lock Plans 03-05 verify against; any user-visible Gear/Hero/Store change from those later plans would show up as a fixture diff first, long before a device check.

## Next Phase Readiness

- Plan 02 (bridge registry) and Plans 03-05 (gearTab.js/heroTab.js/storeScreen.js carves) can now run `node --test test/unit/shell-tab-snapshots.test.js` after each carve — a diff means the carve moved rendered DOM, never that a fixture needs updating.
- No blockers. The seven fixtures cover: empty-slot rows (mu), worn rows + drop confirm + jewelry swap confirm (thief), the bag-full store line, the "nothing to sell" hidden sell-head path (mu-store), and the Magic User's Grimoire/Company-panel Hero-tab rows. Per the plan's flagged assumptions, NOT covered by any snapshot: a Fighter sheet, a destroyed armor row, a bag-less dev character, a downed joiner, and in-combat ability states — those rows are locked by the existing re-pointed `shell-*.test.js` source pins instead, not by a DOM snapshot.

---
*Phase: 47-shell-modularisation*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 10 created files found on disk; all 3 task commits (`cf587bb`, `75c15ee`, `18a425f`) found in git log.
