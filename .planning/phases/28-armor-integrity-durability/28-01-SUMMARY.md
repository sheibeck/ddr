---
phase: 28-armor-integrity-durability
plan: 01
subsystem: engine
tags: [armor, durability, parity, engine, combat, inventory]

# Dependency graph
requires: []
provides:
  - "wornArmorItem carries a swapped-out armor piece's remaining durability (`left`) and patch count (`patches`) instead of always rebuilding it at full"
  - "equipItem restores `c.armorWP`/`c.patches` from `it.left`/`it.patches` (tolerant `??` read for fresh/legacy items) instead of resetting to full — closes the unequip -> swap -> re-equip full-repair exploit"
  - "wornArmorItem returns null for a destroyed piece (armorWP <= 0), and unequipSlot bares the slot with no bag copy on a destroyed piece — 'destroyed armor is gone' (ARMOR-03)"
  - "applyFoeDamageToPlayer's armorSoaked event carries two new additive flags: underMin (soaked at/under the armor's min, no wear) and magic (Cloak of Armor plate soak, never wears)"
  - "stripBagArmorFields(c) nested-array parity carve-out wired into movementComparable/combatComparable/economyComparable"
affects: [28-02-presentation-formatter, 28-03-shell-wiring]

tech-stack:
  added: []
  patterns:
    - "Nested-array parity strip helper (stripBagArmorFields) — the first comparables.js helper to strip a field from inside c.items[] elements rather than a top-level c.* key"
    - "Additive armorSoaked payload flags (underMin/magic) mirroring the existing halved flag precedent"

key-files:
  created:
    - test/unit/armor-durability.test.js
  modified:
    - engine/items.js
    - engine/combat.js
    - test/unit/feedback-payload.test.js
    - test/parity/harness/comparables.js

key-decisions:
  - "Assumption A1 accepted as-is: combat's armorDestroyed path still leaves c.ar/c.armor/c.armorMax untouched; the destroyed-armor guard lives entirely in wornArmorItem + unequipSlot"
  - "rollMailPiece's txt unit token changed from 'wp' to 'hp' for consistency (parity-safe via comparables.js's existing normalizeHpUnit)"

requirements-completed: [ARMOR-01, ARMOR-03, ARMOR-05]

coverage:
  - id: D1
    description: "Re-equip no longer repairs armor — durability/patches carried on the bag item, verified idempotent across multiple unequip/equip cycles and index-stable swaps"
    requirement: "ARMOR-03"
    verification:
      - kind: unit
        ref: "test/unit/armor-durability.test.js#equipItem: exploit closed — re-equip does not repair a partially-worn piece"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js#unequip -> equip -> unequip -> equip is idempotent — no drift in durability/patches"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js#equipItem: index-stable swap — the stowed piece lands at the SAME bag index"
        status: pass
    human_judgment: false
  - id: D2
    description: "Destroyed armor (armorWP <= 0) is gone — no bag copy on unequip or swap, including a piece destroyed mid-combat (A1) or while the bag is full"
    requirement: "ARMOR-03"
    verification:
      - kind: unit
        ref: "test/unit/armor-durability.test.js#unequipSlot: destroyed armor (armorWP 0) is gone — no bag copy, even on a full bag"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js#equipItem: swapping onto destroyed armor leaves no bag copy of the destroyed piece"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js#applyFoeDamageToPlayer + unequipSlot: combat-destroyed armor (A1) still vanishes on unequip"
        status: pass
    human_judgment: false
  - id: D3
    description: "armorSoaked event carries underMin/magic additive flags distinguishing all four soak outcomes (wear, no-wear-under-min, magic-never-wears, destroyed)"
    requirement: "ARMOR-05"
    verification:
      - kind: unit
        ref: "test/unit/armor-durability.test.js#applyFoeDamageToPlayer: underMin flag — dmg at or under armorMin charges no wear"
        status: pass
      - kind: unit
        ref: "test/unit/armor-durability.test.js#applyFoeDamageToPlayer: magic flag — the Cloak of Armor's plate soak never wears, bag-position independent"
        status: pass
      - kind: unit
        ref: "test/unit/feedback-payload.test.js#applyFoeDamageToPlayer: magic plate (Cloak of Armor) never wears — wear: 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "New bag-item fields (left/patches) carved out of all three parity comparables — structural tripwire, byte-identical fixture/master"
    requirement: "ARMOR-03"
    verification:
      - kind: unit
        ref: "test/unit/armor-durability.test.js#parity comparables strip left/patches from every armor bag item, leaving other kinds untouched"
        status: pass
      - kind: integration
        ref: "npm test (full suite) — 1463/1463 passing"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-15
status: complete
---

# Phase 28 Plan 01: Engine Durability-on-Item Summary

**Armor durability now rides the bag item (killing the unequip->re-equip full-repair exploit), destroyed armor is truly gone (no bag copy), and `armorSoaked` gains additive `underMin`/`magic` outcome flags — all parity-safe with the full 1463/1463 suite green and the frozen master untouched.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-15
- **Tasks:** 3 (all `type="auto"`, Tasks 1-2 `tdd="true"`)
- **Files modified:** 4 (1 new test file, 3 modified)

## Accomplishments

- Closed the unequip -> swap -> re-equip full-repair exploit: `wornArmorItem` now carries `left`/`patches` (the piece's remaining durability and patch count) instead of always rebuilding at full; `equipItem` restores those values via a tolerant `it.left ?? it.wp` / `it.patches ?? 0` read (so fresh pieces and pre-v1.3 legacy saves still equip at full).
- Closed the adjacent destroyed-armor gap (RESEARCH.md finding + assumption A1): `wornArmorItem`'s null-guard now also checks `c.armorWP <= 0`, and `unequipSlot` gained a dedicated destroyed-armor branch that bares the slot with **no bag copy** and **no bag-cap check**, emitting an additive `itemUnequipped.destroyed: true` flag. Verified this holds even for a piece destroyed mid-combat (combat's `armorDestroyed` path deliberately still leaves `c.ar`/`c.armor`/`c.armorMax` untouched — assumption A1 accepted by design).
- Added the two additive `armorSoaked` outcome flags Plan 02 needs: `underMin: true` (soaked, `dmg <= armorMin`, no wear) and `magic: true` (Cloak of Armor plate soak, never wears) — both follow the exact `...(condition ? {flag:true} : {})` spread idiom already used for `halved`. The soak/wear math itself is byte-identical to before (grep-gated in the acceptance criteria).
- Unified `rollMailPiece`'s bag-armor `txt` unit label from `wp` to `hp`.
- Added `stripBagArmorFields(c)` to `test/parity/harness/comparables.js` — the first nested-array carve-out in the file (every prior strip helper stripped a top-level `c.*` key; this one maps `c.items[]` and rebuilds each `kind:"armor"` element without `left`/`patches`). Wired into all three comparables per the Engine Gate. A structural tripwire (no fixture currently drives `equipItem`/`unequipSlot`), matching the `stripFoeAbilityState` precedent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the engine pin tests FIRST (RED)** - `700414c` (test)
2. **Task 2: Carry durability on the item, guard destroyed armor, add armorSoaked flags (GREEN)** - `fc0a40e` (feat)
3. **Task 3: Parity carve-out for the new bag-item fields + full-suite gate** - `14522b2` (test)

_Tasks 1 and 2 form the RED/GREEN TDD gate; no REFACTOR commit was needed (the implementation matched the target shape on the first GREEN pass)._

## Files Created/Modified

- `test/unit/armor-durability.test.js` (new) - 15 engine pin tests: exploit-closed, idempotent round-trip, index-stable swap, legacy tolerant read, destroyed-armor guard (unequip/swap/combat-then-unequip), roundtrip safety, underMin/magic/cap/Dwarven/roll-edge armorSoaked cases, and the new parity-comparables carve-out
- `engine/items.js` - `wornArmorItem` carries `left`/`patches` and null-guards a destroyed piece (`c.armorWP <= 0`); `equipItem`'s armor branch restores `left`/`patches` instead of resetting to full; `unequipSlot` gained a destroyed-armor branch (bares the slot, no bag copy, `destroyed: true`); `rollMailPiece`'s `txt` unit token is now `hp`
- `engine/combat.js` - `applyFoeDamageToPlayer`'s `armorSoaked` payload gains `underMin`/`magic` additive flags; soak/wear math lines themselves are unchanged (grep-verified byte-identical)
- `test/unit/feedback-payload.test.js` - two additive assertions (magic plate test now also asserts `soaked.magic === true` and `"underMin" in soaked === false`; the Human wear test now also asserts absence of both new flags)
- `test/parity/harness/comparables.js` - new `stripBagArmorFields(c)` helper wired into `movementComparable`/`combatComparable`/`economyComparable`

## Decisions Made

- Assumption A1 (RESEARCH.md) accepted as-is: combat's `armorDestroyed` path keeps zeroing only `c.armorWP`, never `c.ar`/`c.armor`/`c.armorMax` — the "destroyed armor is gone" rule is enforced entirely by `wornArmorItem`'s guard + `unequipSlot`'s destroyed branch, per CONTEXT.md's locked minimal-diff scope.
- No REFACTOR commit was needed for the TDD tasks — Task 2's implementation matched the target shape (per RESEARCH.md's exact-location guidance) on the first GREEN pass.

## Deviations from Plan

**1. [Doc-comment wording, no behavior change] Reworded two JSDoc comments to avoid literal grep-count collisions with the plan's own acceptance criteria.**
- **Found during:** Task 2 verification (grep gates) and Task 3 verification (grep gates)
- **Issue:** My first-draft JSDoc prose for `wornArmorItem` literally contained the substring `` `left: c.armorWP` `` and `unequipSlot`'s destroyed-branch prose literally contained `` `destroyed: true` ``, both of which are also the exact code lines the plan's acceptance criteria grep for with `== 1`. The prose match doubled the count to 2, failing the exact-count gate. Similarly, `stripBagArmorFields`'s doc heading (`/** stripBagArmorFields(c) — ...`) doubled the `grep -c "stripBagArmorFields("` count to 5 instead of the required 4 (1 definition + 3 call sites), and the implementation used `it.kind !== "armor"` (negated) where the acceptance criteria grepped for the positive `it.kind === "armor"`.
- **Fix:** Reworded the JSDoc prose to describe the same facts without reproducing the exact literal code strings (e.g. "durability (`left`, sourced from c.armorWP)" instead of "`left: c.armorWP`"), dropped the `(c)` from `stripBagArmorFields`'s doc heading (mirroring the existing parenless `stripFoeAbilityState` heading precedent in the same file), and rewrote the map callback to use the ternary form `it && it.kind === "armor" ? (...) : it` from RESEARCH.md's own sketch instead of an early-return negation.
- **Files modified:** `engine/items.js`, `test/parity/harness/comparables.js` (same commits as the Task 2/3 code changes — no separate commit)
- **Verification:** All grep-gate acceptance criteria now match exactly; behavior is unchanged (confirmed by re-running the full relevant test suites after each rewording).

---

**Total deviations:** 1 auto-fixed (doc-comment wording only, no behavior/logic change)
**Impact on plan:** Zero functional impact — purely satisfying the plan's own literal grep-count acceptance criteria. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (presentation formatter + four-outcome copy) can now build `armorDisplay(c)`/`bagArmorText(it)` against `armorSoaked`'s `underMin`/`magic` flags and the bag item's `left`/`patches` fields — both are stable, tested, and parity-carved.
- Plan 03 (shell wiring + Key Decision) has no blockers from this plan; the Key Decision row for ARMOR-01 (soak-vs-wear ruling) is still Plan 03's job, unaffected by anything here.
- Full `npm test`: **1463/1463 passing, 0 failures**. Parity: all 6 `test/parity/*.test.js` suites green; `git status --porcelain test/parity/` empty; `git hash-object test/parity/prototype-master.js.txt` unchanged at `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`. Engine purity + roundtrip guards green.

## Self-Check: PASSED

- FOUND: test/unit/armor-durability.test.js
- FOUND: engine/items.js
- FOUND: engine/combat.js
- FOUND: test/parity/harness/comparables.js
- FOUND: test/unit/feedback-payload.test.js
- FOUND commit: 700414c
- FOUND commit: fc0a40e
- FOUND commit: 14522b2
- npm test: 1463/1463 passing, 0 failures
- Parity master hash unchanged: a1f4d0dc29782218d8e5aab65bc5989c33f917f0

---
*Phase: 28-armor-integrity-durability*
*Completed: 2026-09-15*
