---
phase: 61-gear-rules-store-purchase-fix
plan: 01
subsystem: engine
tags: [combat, gear, inventory, narration, parity]

requires: []
provides:
  - "gearLockReason(state) — the read-only combat-gear-lock predicate Phase 63's action sheet will grey rows with"
  - "gearRefused engine event — equipItem/unequipSlot/takeFind/takeLoot/takeAllLoot refuse mid-fight"
  - "GRULE-01 standing parity guard proving the lock moves zero fixtures"
affects: [62-gear-tab-layout-rebuild, 63-action-sheet-combat-lock-accessibility]

tech-stack:
  added: []
  patterns:
    - "refuseGear(state, verb, extra, events) — a shared module-private gate called FIRST in every combat-gated verb, before any read that could matter"

key-files:
  created:
    - test/unit/combat-gear-lock.test.js
    - .planning/phases/61-gear-rules-store-purchase-fix/deferred-items.md
  modified:
    - engine/items.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/narrationLinesCoverage.test.js
    - test/voice/safety-scan.test.js
    - test/unit/armor-durability.test.js
    - test/parity/divergence-records.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/GEAR-SLOTS.md

key-decisions:
  - "Forced encounter category for the gear-lock fixture is 'Demons', not the plan's suggested 'Beasts' — seed 6's rolled Beasts roster is entirely maxWP<5, and the fixture's Knight sub auto-flees every such foe inside startCombat itself, so 'Beasts' never reaches a pending fight for this seed (measured directly; Demons/Humans/Magical/Walking Dead all stay pending)."
  - "Fixed a genuine regression in test/unit/armor-durability.test.js: its A1 destroyed-armor-unequip test dispatched unequipSlot while state.combat was still set from an earlier assertion in the same test, which the new combat gear lock now correctly refuses. Cleared state.combat before the unequip call rather than weakening the new gate — the test's real subject (destroyed armor vanishes on unequip) is orthogonal to being mid-fight."
  - "16 pre-existing npm test failures (CRLF-related parity-guard false negatives, stale doc/DOM snapshots) are confirmed identical before and after this plan (verified against the pre-edit base commit via git archive) and logged to deferred-items.md rather than fixed, per the scope boundary."

requirements-completed: [GRULE-01]

coverage:
  - id: D1
    description: "equipItem/unequipSlot/takeFind/takeLoot/takeAllLoot refuse with one gearRefused {reason:'combat'} event, zero rng draws, state untouched, while state.combat is set (pending Fight! preview included)"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/unit/combat-gear-lock.test.js — equipItem/unequipSlot/takeLoot/takeAllLoot/takeFind refusal tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "After endCombat, every gated verb works exactly as before this phase"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/unit/combat-gear-lock.test.js#after endCombat: equipItem/unequipSlot/takeLoot(equip)/takeFind all succeed exactly as before"
        status: pass
    human_judgment: false
  - id: D3
    description: "No dispatchable ACTION_TYPES entry can move worn gear (c.weapon/magicWpn/prof/armor/ar/armorMax/worn) while state.combat is set — property test over every action type x payload variant, pending and live"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/unit/combat-gear-lock.test.js#property: PENDING/LIVE — no ACTION_TYPES entry x payload variant moves the gear snapshot mid-fight"
        status: pass
    human_judgment: false
  - id: D4
    description: "USE, potions, scrolls, spells (Shield included) and Drop stay live mid-fight — never refused with gearRefused"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/unit/combat-gear-lock.test.js#useItem/drinkPotion/readScroll/castSpell/dropItem never refused with gearRefused"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both narration tables voice the refusal in the house voice (rail/fight-log block line + Oracle line), and the coverage/voice/hp-not-wp scans pass"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/unit/combat-gear-lock.test.js narration tests; test/unit/narrationLinesCoverage.test.js; test/voice/safety-scan.test.js; test/unit/hp-not-wp.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "The combat gear lock moves zero parity fixtures — measured (both scans, parity suite, git diff on fixtures/master hash) and pinned by a standing GRULE-01 guard"
    requirement: GRULE-01
    verification:
      - kind: unit
        ref: "test/parity/divergence-records.test.js#GRULE-01 (Phase 61)"
        status: pass
      - kind: other
        ref: "node tools/worn-fixture-scan.mjs / initiative-fixture-scan.mjs diff (empty modulo pre-existing CRLF checkout artifact, verified content-identical via diff --strip-trailing-cr)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The tuning bot's output is byte-identical before and after (node tools/tune-difficulty.mjs --seeds=20 --json)"
    requirement: GRULE-01
    verification:
      - kind: other
        ref: "cmp against a pre-edit base-commit run, exit 0"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-23
status: complete
---

# Phase 61 Plan 01: Combat Gear Lock (GRULE-01) Summary

**Engine-level combat gear lock: equipItem/unequipSlot/takeFind/takeLoot/takeAllLoot refuse with one `gearRefused {reason:"combat"}` event while a fight is up, proven by a property test over every ACTION_TYPES entry, with zero moved parity fixtures.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-09-23
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified), plus 1 deferred-items.md tracking artifact

## Accomplishments

- Closed the combat gear hole (GRULE-01, the user's Pixel 7 report "I didn't think we should allow changing equipped gear during combat"): `gearLockReason(state)` returns `"combat"` while `state.combat` is set (the pending Fight! preview included) and `null` otherwise; a shared `refuseGear` helper gates `equipItem`, `unequipSlot`, `takeFind`, `takeLoot` and `takeAllLoot` — each refusal is exactly one `gearRefused` event, zero rng draws, state byte-identical.
- Proved by property test (`test/unit/combat-gear-lock.test.js`, 22 passing tests, 162 action x payload x combat-state checks) that no dispatchable action of any of the 29 `ACTION_TYPES` can move worn gear (`weapon`/`magicWpn`/`prof`/`armor`/`ar`/`armorMax`/`worn`) while `state.combat` is set.
- Voiced the refusal in both narration tables: `src/browser/eventNarration.js` (Oracle: "Not the moment to change outfits." / "The spoils can wait until the fight is over.") and `src/browser/narrationLines.js` (rail/fight-log, `PRIORITY.block` → a dull refusal entry), covered by the coverage, voice-safety and hp-not-wp scans.
- Measured the fixture impact directly rather than assuming it: zero parity fixtures move (both fixture scans, the parity suite, `git diff` on `test/parity/fixtures/`, and the master hash all confirm), pinned by a new `GRULE-01 (Phase 61)` standing guard in `test/parity/divergence-records.test.js`, and recorded in `test/parity/FIXTURE-INVENTORY.md`.
- Fixed a genuine regression surfaced by the new lock in `test/unit/armor-durability.test.js` (a pre-existing test was dispatching `unequipSlot` mid-combat, which the new gate now correctly refuses).

## Task Commits

1. **Task 1: Engine combat gate + gearRefused narration + unit suite** - `108ea89` (feat)
   - Deviation fix folded in: `ed82b82` (fix) — clear `state.combat` before the post-combat destroyed-armor unequip test
2. **Task 2: Measure zero fixture moves, standing guard, inventory record, docs, bot smoke** - `b103c06` (docs)

_Note: the deviation fix (`ed82b82`) landed as its own atomic commit between Task 1 and Task 2 rather than being folded into either task's commit, since it was discovered while validating Task 1 against the full suite._

## Files Created/Modified

- `engine/items.js` — `gearLockReason(state)` (exported predicate), `refuseGear` (module-private gate), the five gated call sites
- `src/browser/eventNarration.js` — `EVENT_NARRATION.gearRefused`
- `src/browser/narrationLines.js` — `LINE_FOR.gearRefused`, `FEATURE_EVENTS` entry, `GEAR_LOCK_LOOT_VERBS` set
- `test/unit/combat-gear-lock.test.js` — new unit suite (22 tests): per-verb refusal, after-fight success, the every-ACTION_TYPES property test, narration
- `test/unit/narrationLinesCoverage.test.js` — `"gearRefused"` added to the legibility-event list
- `test/voice/safety-scan.test.js` — `{verb:"takeLoot"}`/`{verb:"unequipSlot"}` added to BRANCH_TOGGLES
- `test/unit/armor-durability.test.js` — cleared `state.combat` before an unequip call the new lock now (correctly) refuses
- `test/parity/divergence-records.test.js` — new `GRULE-01 (Phase 61)` standing guard
- `test/parity/FIXTURE-INVENTORY.md` — `## Phase 61` / `### Plan 01` measured-zero record
- `docs/GEAR-SLOTS.md` — §4 combat-gear-lock rule + refusal-vocabulary row
- `.planning/phases/61-gear-rules-store-purchase-fix/deferred-items.md` — 16 pre-existing, unrelated `npm test` failures logged (not fixed)

## Decisions Made

- **Fixture forced category: "Demons", not "Beasts".** The plan's suggested seed-scan (first `newRun(seed)` Fighter, non-noArmor race, non-Woodsman sub, seeds 1..200) lands on seed 6 (a Troll Knight). "Beasts" ends the encounter INSIDE `startCombat` for this seed — the Knight's "beneath the notice of small things" rule auto-flees every rolled Beasts foe (all maxWP < 5) before `combat.pending` is ever set. Measured directly: Demons/Humans/Magical/Walking Dead all leave `combat.pending === true`; Beasts and Lair Beasts do not. Used "Demons" and documented the substitution in the test file's own comment, per the plan's own "If Beasts ends at initiative for the chosen seed, pick another category and note it" instruction.
- **armor-durability.test.js fix, not a weaker gate.** The A1 "destroyed armor still vanishes on unequip" test called `unequipSlot` while `state.combat` was still set from an earlier assertion in the same test. GRULE-01 deliberately gates EVERY slot (including a destroyed one) while `state.combat` is set, with no carve-out — the CONTEXT and plan behavior spec are explicit that `unequipSlot` on any slot, occupied or not, refuses mid-fight. Rather than exempt destroyed armor from the new lock, the test was updated to clear `state.combat` before the unequip call, since its actual subject (the A1 rule) is orthogonal to being mid-fight.
- **16 pre-existing npm test failures — logged, not fixed.** Confirmed via `git archive` of the pre-edit base commit that all 16 remaining `npm test` failures (2 CRLF-related parity-guard false negatives, 4 stale milestone-ledger snapshots, 3 flee-ledger table drifts, 7 DOM-snapshot drifts) are present identically before and after this plan's changes. Per the scope boundary, these are logged to `deferred-items.md` rather than fixed here. The CRLF root cause (missing `.gitattributes eol=lf` pin on the two `tools/*-scan-output.txt` files) is already tracked in `.planning/STATE.md`'s deferred-items ledger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleared `state.combat` before the post-combat destroyed-armor unequip assertion**
- **Found during:** Task 1's full-suite verification (`npm test`)
- **Issue:** `test/unit/armor-durability.test.js`'s "combat-destroyed armor (A1) still vanishes on unequip" test dispatched `unequipSlot(state, "armor", [])` while `state.combat` was still set (from an earlier `applyFoeDamageToPlayer` call in the same test) — the new combat gear lock now correctly refuses this with `gearRefused`, so the test's own downstream assertions (bag empties, `c.armor` becomes "Nothing", `itemUnequipped {destroyed:true}` fires) failed.
- **Fix:** Set `state.combat = null` immediately before the `unequipSlot` call, with a comment explaining the Phase 61 gate now covers this path and that the test's real subject (the A1 destroyed-armor-vanishes rule) is unaffected by being pre- or post-combat.
- **Files modified:** `test/unit/armor-durability.test.js`
- **Verification:** `node --test test/unit/armor-durability.test.js` — 15/15 pass
- **Committed in:** `ed82b82`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary correctness fix for a test that predated this phase's rule change; no scope creep — the fix touches only the one test whose fixture setup collided with the new gate.

## Issues Encountered

- `test/parity/divergence-records.test.js`'s existing `HEDGE-03`/`INIT-01` tests fail on this Windows checkout due to a pre-existing CRLF/LF mismatch between the checked-in `tools/*-scan-output.txt` files and the scan scripts' own LF output — confirmed present on the unedited base commit, unrelated to this plan. Both fixture scans are content-identical (`diff --strip-trailing-cr` empty) before and after. Logged, not fixed.
- 16 total pre-existing `npm test` failures (the above two plus 14 unrelated doc/DOM-snapshot drifts) — see `deferred-items.md` for the full accounting and root-cause notes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `gearLockReason(state)` is exported and ready for Phase 63's action sheet to grey the EQUIP/SWAP/UNEQUIP rows with the engine's own reason.
- Plan 02 (STORE-02/STORE-03, running in parallel) touches `engine/derived.js`, `src/browser/viewModels.js`, `src/browser/upgradeWhy.js` and `mazeworld.html` — no file overlap with this plan's edits.
- Plans 03/04 should confirm whether any Gear/Store DOM-snapshot regeneration they need is pre-existing drift (see `deferred-items.md`) before assuming their own edit caused it.

---
*Phase: 61-gear-rules-store-purchase-fix*
*Plan: 01*
*Completed: 2026-09-23*
