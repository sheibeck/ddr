---
phase: 45-collapse-the-phase-37-hedges
plan: 02
subsystem: engine
tags: [engine, worn-model, save-migration, parity-harness, fixtures, declared-divergence, single-path]

requires:
  - phase: 45-01
    provides: "tools/worn-fixture-scan.mjs + the committed BEFORE readout (MOVED SET (13))"
provides:
  - "newRun(seed) always creates c.worn via reconcileWorn — no wornSlots option, zero rng draws"
  - "validateSave/rehydrate always reconcile c.worn — one return shape, wornReport: [] when nothing moved"
  - "test/parity/harness/comparables.js#dropEmptyWorn — replaces the Phase 37 stripWornField carve-out"
  - "test/parity/divergence-records.test.js — declared-set == measured-set (MOVED SET) standing guard"
  - "13 MOVED SET fixture records extended with items/worn before/after"
affects: [45-03]

tech-stack:
  added: []
  patterns:
    - "dropEmptyWorn(c): an empty c.worn map is the engine's spelling of the prototype's 'no worn model' and is dropped; a populated map reaches the diff and must be declared"
    - "Omission rule: a field one side never carries (prototype's worn) is declared by omitting it from that side's before/after map — diffState's key-set comparison keeps it honest"

key-files:
  created:
    - test/parity/divergence-records.test.js
  modified:
    - engine/state.js
    - engine/saveState.js
    - engine/derived.js
    - src/browser/engineAdapter.js
    - tools/lib/tuning-bot.mjs
    - test/parity/harness/comparables.js
    - test/parity/chargen-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.economy.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/fixtures/action-script.movement.json
    - test/parity/fixtures/action-script.schema.md
    - test/unit/worn-migration.test.js
    - test/unit/engineAdapter.test.js
    - test/unit/bot-tactics.test.js
    - test/unit/class-pass-ledger.test.js
    - test/unit/item-activation.test.js
    - test/unit/worn-model.test.js
    - test/unit/worn-slots.test.js
    - test/unit/save-validation.test.js
    - test/unit/loot-pile.test.js

key-decisions:
  - "Exempted kind:'action-path' records from divergence-records.test.js's per-field notDeepStrictEqual check — pre-existing combat.json records (lose-apprentice, parley) legitimately declare end-state fields that coincide with the prototype despite a genuinely different action path; the field-level 'must differ' invariant only makes sense for field-strip (kind-less) records"
  - "illegalOldSave() (worn-migration.test.js) and its ordering/cap-proof siblings now explicitly delete s.c.worn after newRun(1) to simulate a genuine v1.4-era save — newRun always creates c.worn now, so the fixture helper must strip it back off to exercise the load-time migration path at all"
  - "loot-pile.test.js's reconcilePendingLoot comparison tests (not in the plan's files_modified list) needed re-pinning: newRun(3)'s Thief now starts with c.worn (cloak worn, jewelry free), so the real takeItem call inside reconcilePendingLoot auto-wears a given jewel into jewelry1/jewelry2 instead of leaving it bagged — the 'already given' comparison side was updated to set c.worn directly instead of appending to c.items"

requirements-completed: [HEDGE-01, HEDGE-02, HEDGE-03]

coverage:
  - id: D1
    description: "newRun(seed) with no options always creates c.worn (Thief's starting cloak worn, {} for Fighter/Magic User), zero added rng draws"
    requirement: "HEDGE-01"
    verification:
      - kind: unit
        ref: "test/unit/worn-migration.test.js#HEDGE-01: newRun(2) with no options wears the Thief's starting cloak — c.worn.cloak set, c.items empty, every other field and rngState untouched"
        status: pass
      - kind: unit
        ref: "test/unit/chargen-rng-pin.test.js (unedited, zero-draw proof)"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateSave/rehydrate always reconcile c.worn with no option — one return shape, wornReport: [] when nothing moved or already migrated; a v1.4-era save with two rings + two cloaks + a potion loads legally"
    requirement: "HEDGE-02"
    verification:
      - kind: unit
        ref: "test/unit/worn-migration.test.js#HEDGE-02: a v1.4-era save (no c.worn, two rings + two cloaks + a potion stacked in the bag) loads through validateSave/rehydrate with NO option — both rings and the first cloak worn, the second cloak bagged, wornReport returned once"
        status: pass
      - kind: unit
        ref: "test/unit/worn-migration.test.js#HEDGE-02 ordering: three identical Rings of Power — the first two in bag order wear jewelry1/jewelry2, the third stays bagged, reported once"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 13 fixture sites the collapse measurably moves are declared (items/worn before/after) and exactly match the scan's MOVED SET; every other fixture byte-identical; scan re-run is byte-identical to the committed BEFORE readout"
    requirement: "HEDGE-03"
    verification:
      - kind: unit
        ref: "test/parity/divergence-records.test.js#HEDGE-03: the holders declaring worn are exactly the scan's MOVED SET"
        status: pass
      - kind: other
        ref: "node tools/worn-fixture-scan.mjs > after.txt && diff after.txt tools/worn-fixture-scan-output.txt — empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "No wornSlots option or option-keyed branch survives in engine/src/mazeworld.html/tools/test; RUN_FLAGS = { storeRoll: true }"
    verification:
      - kind: other
        ref: "grep -rn wornSlots engine/ src/ mazeworld.html tools/ test/ | wc -l == 0; node tools/shell-sweep.mjs refs wornSlots == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm test fail 0 (3242/3242) and npm run build:www green at the single commit; master hash unchanged; engine diff exactly the 3 fenced files"
    verification:
      - kind: unit
        ref: "npm test — # pass 3242, # fail 0"
        status: pass
      - kind: other
        ref: "npm run build:www — exit 0"
        status: pass
    human_judgment: false

duration: ~3h
completed: 2026-09-19
status: complete
---

# Phase 45 Plan 02: Collapse the Phase 37 hedges Summary

**`newRun` always wears the Thief's starting cloak, `validateSave`/`rehydrate` always reconcile with one return shape, `dropEmptyWorn` replaces the Phase 37 carve-out in the parity harness, and exactly the 13 measured MOVED SET fixture sites declare their `items`/`worn` divergence — landed as one green commit with zero `wornSlots` references left anywhere in the repo.**

## Performance

- **Duration:** ~3h
- **Tasks:** 3 (Task 1 + Task 2 uncommitted by design; Task 3 makes the plan's ONE commit)
- **Files modified:** 27 (26 modified + 1 new: `test/parity/divergence-records.test.js`)

## Accomplishments
- `engine/state.js#newRun` drops the `wornSlots` option entirely; `reconcileWorn(c)` runs unconditionally after `grantLevelAbilities`, before `genFloor` — zero added rng draws (proven by the unedited `test/unit/chargen-rng-pin.test.js`).
- `engine/saveState.js#validateSave` always reconciles (`reconcileWorn(value.c) ?? []`) and always returns `{ ok: true, value, wornReport }` — one shape, never a conditional key. `rehydrate(obj)` drops its `options` parameter and reconciles unconditionally too.
- `src/browser/engineAdapter.js#boot`/`startNewRun` drop their option arguments; `bootWornReport = check.wornReport` (never `?? null` — the shape is fixed).
- `tools/lib/tuning-bot.mjs`'s `RUN_FLAGS` is now `Object.freeze({ storeRoll: true })` — the worn-slot model needs no flag since `newRun` always creates it.
- `test/parity/harness/comparables.js#dropEmptyWorn` replaces the deleted `stripWornField`: an empty `c.worn` (the engine's spelling of the prototype's "no worn model") is dropped; a populated one reaches the diff and must be declared. Wired into all three shared comparable chains and all four parity-test local mirrors (combat/magic/movement/chargen) plus `full-suite.test.js`.
- `chargenShiftDiffs`/`pickFields` gained the omission rule: a measured `undefined` value is skipped rather than assigned, so a field one side never carries (the prototype's `worn`) is declared by omitting it — `diffState`'s key-set comparison still catches a misdeclared field.
- Exactly the 13 MOVED SET sites (measured by Plan 01's committed scan) got their fixture records extended with `items`/`worn` before/after values, `HEDGE-03` added to `requirements`, `phase` suffixed `+45`, and a Phase 45 rationale paragraph appended — no other fixture byte moved.
- New `test/parity/divergence-records.test.js`: a fixture-wide standing guard proving every declared divergence record (across all six fixture files) is narrow and well-formed, and that the holders declaring `worn` are exactly the scan's MOVED SET (`assert.deepStrictEqual` on the two sorted id sets).
- Every test pinning the option-off/legacy `wornSlots` behaviour was re-pinned to the single path (see the full table below); the two ROADMAP success-criterion pins (`HEDGE-01: newRun(2)` no-option cloak worn; `HEDGE-02`: v1.4-era save reconciled with no option) now live in `test/unit/worn-migration.test.js`.
- `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` prints `0` lines; `node tools/shell-sweep.mjs refs wornSlots` reports `0`.
- The AFTER re-run of `tools/worn-fixture-scan.mjs` is byte-identical to Plan 01's committed BEFORE readout — the collapse moved exactly the measured set, nothing more, nothing less.

## Task Commits

Per the plan's explicit commit discipline, Tasks 1 and 2 were NOT committed on their own (the suite is red between them by construction — the engine moves before the pins/records catch up). The single commit for this plan lands at the end of Task 3, once every gate passes:

1. **Task 1 (engine/adapter/bot collapse) + Task 2 (harness + fixture records) + Task 3 (re-pinned tests + gates)** — `9d8d9a7` (refactor)

**Plan metadata:** committed separately per `<final_commit>` below.

## Files Created/Modified
- `engine/state.js` - `newRun` signature drops `wornSlots`; `reconcileWorn(c)` unconditional
- `engine/saveState.js` - `validateSave`/`rehydrate` unconditional reconcile, one return shape
- `engine/derived.js` - `reconcileWorn`'s JSDoc rewritten (callers now `newRun` + both load chains, all unconditional)
- `src/browser/engineAdapter.js` - `boot`/`startNewRun` drop the option argument
- `tools/lib/tuning-bot.mjs` - `RUN_FLAGS = Object.freeze({ storeRoll: true })`
- `test/parity/harness/comparables.js` - `dropEmptyWorn` replaces `stripWornField`; omission rule in `chargenShiftDiffs`/`pickFields`
- `test/parity/chargen-parity.test.js`, `full-suite.test.js` - `"worn"` joins `CHARACTER_FIELDS`; `dropEmptyWorn` applied engine-side
- `test/parity/combat-parity.test.js`, `magic-parity.test.js`, `movement-parity.test.js` - local mirrors updated (drop `worn` destructure, wrap with `dropEmptyWorn`)
- `test/parity/fixtures/action-script.{chargen,combat,economy,encounters,movement}.json` - 13 MOVED SET records extended with `items`/`worn`
- `test/parity/fixtures/action-script.schema.md` - documents the omission rule and `worn` as a declarable field
- `test/parity/divergence-records.test.js` - **new** — fixture-wide well-formedness + MOVED SET identity guard
- `test/unit/worn-migration.test.js` - rewritten: HEDGE-01/HEDGE-02 pins, option-free throughout
- `test/unit/engineAdapter.test.js`, `bot-tactics.test.js`, `class-pass-ledger.test.js`, `item-activation.test.js`, `worn-model.test.js`, `worn-slots.test.js`, `save-validation.test.js` - re-pinned to the single path (see table below)
- `test/unit/loot-pile.test.js` - A-5 discovery: `reconcilePendingLoot` comparison tests re-pinned (see Deviations)

## Moved fixtures (MOVED SET, 13 of 31 replay sites)

Per Plan 01's committed scan (`tools/worn-fixture-scan-output.txt`), every site below is now declared with `items`/`worn` before/after values pasted verbatim from the scan's `## Record values` section (chargen/movement/combat via `chargenDivergence`; economy also extends its `divergence` action-path record). No `seed`/`seeds`/`actions`/`scenarios` byte moved in any fixture.

| Holder | Record kind | Cloak (worn) | before.items → after.items |
|---|---|---|---|
| `action-script.chargen.json#seed-2` | `divergences["2"]` | Cloak of Armor | `[Cloak of Regeneration]` → `[]` |
| `action-script.chargen.json#seed-3` | `divergences["3"]` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.chargen.json#seed-4` | `divergences["4"]` | Cloak of Regeneration | `[Cloak of Regeneration]` → `[]` |
| `action-script.movement.json#script` | top-level `chargenDivergence` | Cloak of Strength | `[Cloak of Healing]` → `[]` |
| `action-script.combat.json#win` | scenario `chargenDivergence` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.combat.json#lose-plain` | scenario `chargenDivergence` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.combat.json#flee` | scenario `chargenDivergence` | Cloak of Flying | `[Cloak of Armor]` → `[]` |
| `action-script.combat.json#parley` | scenario `chargenDivergence` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.economy.json#script` | top-level `chargenDivergence` + `divergence` (action-path, end-state) | Cloak of Ether | chargen `[Cloak of Ether]` → `[]`; end `[Cloak of Ether, potion, picks]` → `[potion, picks, Speed potion]` |
| `action-script.encounters.json#chest` | scenario `chargenDivergence` | Cloak of Armor | `[Cloak of Regeneration]` → `[]` |
| `action-script.encounters.json#tablefour` | scenario `chargenDivergence` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.encounters.json#faerie` | scenario `chargenDivergence` | Cloak of Ether | `[Cloak of Ether]` → `[]` |
| `action-script.encounters.json#affliction` | scenario `chargenDivergence` | Cloak of Armor | `[Cloak of Regeneration]` → `[]` |

Every record's rationale carries the shared paragraph: *"Phase 45 (HEDGE-01/03, 2026-09-19): newRun now wears the Thief's starting cloak at chargen (`c.worn.cloak`), so `c.items` loses it and `c.worn` is populated; zero rng draws; measured by `tools/worn-fixture-scan.mjs` (BEFORE readout committed in 45-01)."*

## Scan AFTER

```
node tools/worn-fixture-scan.mjs > after.txt && diff after.txt tools/worn-fixture-scan-output.txt
```
Output: empty (byte-identical to the committed BEFORE readout).

```
MOVED SET (13): action-script.chargen.json#seed-2, action-script.chargen.json#seed-3, action-script.chargen.json#seed-4, action-script.movement.json#script, action-script.combat.json#win, action-script.combat.json#lose-plain, action-script.combat.json#flee, action-script.combat.json#parley, action-script.economy.json#script, action-script.encounters.json#chest, action-script.encounters.json#tablefour, action-script.encounters.json#faerie, action-script.encounters.json#affliction
WORN EXPOSURE: 13 of 31 replay sites
```

## Tests re-pinned or deleted

| File | Kind | Reason |
|---|---|---|
| `test/unit/worn-migration.test.js` | rewritten (whole file) | Every `newRun`/`validateSave`/`rehydrate` option argument deleted; header comment rewritten for the single path; new HEDGE-01 pins (newRun(2) cloak-worn, Fighter/Magic User empty worn, every chargen seed); new HEDGE-02 pins (v1.4-era save with rings/cloaks, three-ring ordering, idempotency); `illegalOldSave()` and its cap-proof/ordering siblings now `delete s.c.worn` to simulate a genuine pre-Phase-45 save |
| `test/unit/engineAdapter.test.js` | re-pinned | Fresh-boot-fallback and corrupt-save tests now assert `"worn" in state.c` (true, since `initRun` always reconciles) instead of false; the two-/three-rings boot-migration tests now `delete original.c.worn`; the "already carries worn" test drops the option and asserts `wornReport` deep-equals `[]` (A-4); `startNewRun`/`initRun` test renamed and both now assert `"worn" in getState().c` |
| `test/unit/bot-tactics.test.js` | re-pinned | `RUN_FLAGS` pin updated to `{ storeRoll: true }`; test names stop spelling the retired option identifier |
| `test/unit/class-pass-ledger.test.js` | re-pinned (reworded, not "fixed") | The two literal `runFlags` pins against the FROZEN v1.5 AFTER readouts are reworded to assert what's true of the stored files (`storeRoll: true`, both readouts agree, exactly 2 keys) without spelling the retired identifier — `docs/class-pass/*.json` themselves are untouched |
| `test/unit/item-activation.test.js` | re-pinned | Dropped the option, renamed the test |
| `test/unit/worn-model.test.js` | re-pinned | `"worn" in c` assertions inverted to `typeof c.worn === "object"`; chargen-shape and rng-invariance tests renamed and inverted to prove `c.worn` is ALWAYS created / never grows beyond chargen's own reconcile; a pre-existing, unlisted test (`rollJewel/rollCloak/rollStaff...`) needed a Rule-1 fix — see Deviations |
| `test/unit/worn-slots.test.js` | 2 deleted, 2 rewritten | Deleted the two "Task 3 sweep" tests (`equipItem`/`useItem` on a legacy `newRun(3)` state) — `newRun` can no longer produce a worn-less state; rewrote the `takeFind`/`takeLoot` "legacy state" tests to the single-path outcome (a ring wears into the now-empty `jewelry1`), event lists mirrored from this file's own `hero({ c: { worn: {} } })` pins |
| `test/unit/save-validation.test.js` | re-pinned | Both hand-built old-save `deepStrictEqual(state.c, ...)` pins gained `worn: {}` in the expected spread |
| `test/unit/loot-pile.test.js` (A-5 extra, not in plan frontmatter) | re-pinned | `reconcilePendingLoot`'s comparison tests built a "same jewel already given" S2 by appending to `c.items`; since `newRun(3)`'s Thief now carries `c.worn` (cloak worn, jewelry free), the real `takeItem` call inside `reconcilePendingLoot` auto-wears the jewel via `autoWearSlot` (gated on `"worn" in c`) instead of leaving it bagged — S2 now sets `c.worn.jewelry1`/`jewelry2` directly to match |

## Declared consequences

- **A-4:** `takeBootWornReport()` now returns `[]` (not `null`) for a valid save that was already migrated, because `validateSave` has one return shape. Rendering is identical (`wornReconcileCard([])` is `null` — the rail card filters on `bagged.length`). `test/unit/engineAdapter.test.js`'s "already carries worn" test is re-pinned to `[]` with that rationale. No consumer branching on `null` vs `[]` was found during this plan.
- The ledger test's stored-file assertion (`test/unit/class-pass-ledger.test.js`) is REWORDED to what's true of the frozen `docs/class-pass/v15-after*.json` files without spelling the retired identifier — **those JSON files themselves are never regenerated**.

## Gate outputs

```
npm test
# tests 3242
# suites 0
# pass 3242
# fail 0
```

```
npm run build:www
[build-www] done
```

```
grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/ | wc -l
0
```

```
node tools/shell-sweep.mjs refs wornSlots
refs wornSlots: 0
```

```
node tools/worn-fixture-scan.mjs > after.txt && diff after.txt tools/worn-fixture-scan-output.txt
(empty)
```

```
git hash-object test/parity/prototype-master.js.txt
a1f4d0dc29782218d8e5aab65bc5989c33f917f0
```

```
git status --porcelain test/parity/fixtures
 M test/parity/fixtures/action-script.chargen.json
 M test/parity/fixtures/action-script.combat.json
 M test/parity/fixtures/action-script.economy.json
 M test/parity/fixtures/action-script.encounters.json
 M test/parity/fixtures/action-script.movement.json
 M test/parity/fixtures/action-script.schema.md
```

```
git diff --stat -- engine/ content/
 engine/derived.js   |  9 +++---
 engine/saveState.js | 92 +++++++++++++++++++++--------------------------------
 engine/state.js     | 33 +++++++------------
 3 files changed, 52 insertions(+), 82 deletions(-)
```

```
git diff --stat -- test/unit/chargen-rng-pin.test.js docs/class-pass/
(empty)
```

```
git log -1 --format=%s
refactor(45-02): collapse the Phase 37 hedges — newRun always wears, load always reconciles, no run/load option; measured fixtures declared, tests re-pinned to the single path (HEDGE-01/02/03)
```

## Decisions Made
- Exempted `kind: "action-path"` divergence records from `divergence-records.test.js`'s per-field `notDeepStrictEqual` check — measured that combat.json's pre-existing `lose-apprentice` and `parley` action-path records legitimately declare end-state fields (`wp`/`sp`/`gold`/`kills`/`rations`) that coincide with the prototype despite a genuinely different mid-scenario draw sequence; the "before != after" invariant only holds for field-strip (kind-less) records, whose entire purpose IS a field that changed.
- `illegalOldSave()` and its ordering/cap-proof test siblings in `worn-migration.test.js` explicitly `delete s.c.worn` after `newRun(1)` — since `newRun` now always creates `c.worn`, simulating a genuine v1.4-era save (the entire point of Pitfall 8's fixture) requires stripping the key back off before hand-building the illegal bag contents.
- `loot-pile.test.js`'s `reconcilePendingLoot` tests (outside this plan's frontmatter `files_modified` list) needed re-pinning per A-5 — documented above and in Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `worn-model.test.js`'s tripwire test asserted a Thief's bag is non-empty, which Phase 45 makes false**
- **Found during:** Task 3 (`npm test` authority run)
- **Issue:** `"rollJewel/rollCloak/rollStaff and a Thief's starting cloak never carry a slot key (tripwire)"` asserted `thief.items.length > 0` for `newRun(2)` — true before this plan (cloak bagged), false after (cloak now worn, `c.items` is `[]`).
- **Fix:** Split the assertion: `c.items` now asserted `[]`; the "no slot key" check moved to `c.worn.cloak` (the cloak's new home), with the original bag-scan loop kept (now vacuously true, harmless).
- **Files modified:** `test/unit/worn-model.test.js`
- **Verification:** `node --test test/unit/worn-model.test.js` — 26/26 pass.
- **Committed in:** `9d8d9a7` (the plan's single commit)

**2. [Rule 1 - Bug] `worn-migration.test.js`'s `illegalOldSave()`/ordering/cap-proof tests silently stopped exercising the migration path**
- **Found during:** Task 3 (rewriting the file)
- **Issue:** `newRun(1)` now returns `c.worn = {}` (an OWN key) by default; `reconcileWorn` is a no-op on a `c` that already owns `worn`, even an empty one — so hand-building an "illegal" bag on top of a fresh `newRun(1)` without first deleting `c.worn` produced a save that skipped the whole migration, silently breaking three tests (wrong `worn`/`items`/report values).
- **Fix:** Added `delete s.c.worn;` immediately after each `newRun(1)` call in `illegalOldSave()`, the three-ring ordering test, and the cap-proof test.
- **Files modified:** `test/unit/worn-migration.test.js`
- **Verification:** `node --test test/unit/worn-migration.test.js` — 24/24 pass.
- **Committed in:** `9d8d9a7`

**3. [Rule 1 - Bug] `loot-pile.test.js`'s `reconcilePendingLoot` comparison tests (not in the plan's files_modified list)**
- **Found during:** Task 3 (`npm test` full-suite run, after all listed files were re-pinned)
- **Issue:** Two tests compared a `reconcilePendingLoot`-reconciled state (S1) against a hand-built "same item already given" state (S2, built by appending to `c.items`). Since `newRun(3)`'s Thief now starts with `c.worn` populated (cloak worn, jewelry keys free), the real `takeItem` call inside `reconcilePendingLoot` now auto-wears a given jewel into the first free jewelry key (`autoWearSlot`, gated on `"worn" in c`) — S1 ends with the jewel worn, S2 (still hand-appending to `c.items`) does not, producing a `c.items.length` mismatch.
- **Fix:** S2 now sets `c.worn.jewelry1`/`c.worn.jewelry2` directly (mirroring the real auto-wear outcome) instead of appending to `c.items`.
- **Files modified:** `test/unit/loot-pile.test.js`
- **Verification:** `node --test test/unit/loot-pile.test.js` — 40/40 pass; full `npm test` — 3242/3242.
- **Committed in:** `9d8d9a7`

---

**Total deviations:** 3 auto-fixed (3 bug fixes, all A-5 fallout from `npm test`'s authority run, all in files touched by the phase's own re-pin work or immediately adjacent to it — `loot-pile.test.js` is the one file outside the plan's frontmatter list)
**Impact on plan:** All three necessary for `npm test` to reach `# fail 0`. No scope creep — every fix is a direct, mechanical consequence of `newRun` always creating `c.worn`, not a new feature or architectural change.

## Issues Encountered

None beyond the three auto-fixed deviations above — all were anticipated in kind by the plan's own A-5 flagged assumption ("every failing test must be one of two kinds... anything else is a bug in this plan's edits, not a pin to move") and resolved without architectural changes.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

- A fresh Thief starts with the cloak in the WORN row of the Gear tab (not the bag) — verify on the next on-device UAT batch.
- Resuming the current on-device save shows the reconciliation card once (or no card if already migrated) — a `wornReport` with `bagged.length > 0` entries renders the card; `[]` renders nothing, matching pre-Phase-45 behavior for an already-migrated save.
- Nothing else is user-visible — this plan is an internal single-path collapse with no new gameplay rule.

## Next Phase Readiness

- Plan 03 can regenerate `test/parity/FIXTURE-INVENTORY.md`'s Phase 45 section from this plan's committed scan output and declared records, correct `docs/GEAR-SLOTS.md`'s stale "no fixture ever creates c.worn" prose, and run the bot smoke (`RUN_FLAGS` byte-equal check, 143-cell x 3-seed, 0 stuck).
- No blockers. `wornSlots` is fully retired from `engine/`, `src/`, `mazeworld.html`, `tools/`, and `test/` — Phase 46's NAME-02 zero-straggler grep should find nothing left to catch from this phase's edits (Phase 48's repo-wide comment sweep for stray "flag-off" prose elsewhere is unaffected).

---
*Phase: 45-collapse-the-phase-37-hedges*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: engine/state.js
- FOUND: engine/saveState.js
- FOUND: engine/derived.js
- FOUND: src/browser/engineAdapter.js
- FOUND: tools/lib/tuning-bot.mjs
- FOUND: test/parity/harness/comparables.js
- FOUND: test/parity/divergence-records.test.js
- FOUND: test/unit/worn-migration.test.js
- FOUND: .planning/phases/45-collapse-the-phase-37-hedges/45-02-SUMMARY.md
- FOUND: commit 9d8d9a7 (refactor: collapse the Phase 37 hedges)
