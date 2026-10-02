---
phase: 88-item-systems-effect-sources-heal-over-time-the-crit-proof-cloak
plan: 02
subsystem: engine
tags: [items, timers, effect-source, save-load, joiners, ITEM-02]
requires:
  - phase: 88-01
    provides: "src { slot, n } on timer records, endSourceEffects, endEffectEarly, SOURCE_SLOTS, sourceSlotItem, effectSourceOf"
provides:
  - "engine/saveState.js#reconcileItemSources, the one load-time reconciliation of the effect-source link"
  - "the link survives save, load and relaunch for the hero, every Joiner sheet and the wielded Crystal Staff"
  - "proof that src never reaches a parity compare (all three comparables)"
affects: [88-03, 88-04, 89]
tech-stack:
  added: []
  patterns:
    - "load-time reconciliation reuses the play-time end helper in quiet mode: no second slot rule"
key-files:
  created:
    - test/unit/item-effect-source-save.test.js
    - test/unit/item-source-comparables.test.js
  modified:
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "A linked source must name the record's own item (src.n === the id's key); a link naming a different item is treated as missing and relinked or ended, so a tampered save can never grant an effect the gear does not back."
  - "'Ends quietly' is the spent use (endEffectEarly: left + cd as a cooldown; the cd-less Crystal Staff record is removed, charges and the charges: record untouched), so a load never hands an item back sooner than play would."
  - "The reconciliation runs after reconcileWorn and sanitizeStaff in both load chains, so a legacy save's auto-worn cloak links and a staff the load un-wields ends its effect."
requirements-completed: [ITEM-02]
duration: ~25 min
completed: 2026-09-30
status: complete
---

# Phase 88 Plan 02: effect sources survive save and load (ITEM-02 persistence) Summary

**`reconcileItemSources` links a live, source-less item effect to the worn item (or wielded Crystal Staff) that backs it, or ends it quietly as the spent use, for the hero and every Joiner sheet on both load paths; a mid-effect save now relaunches with its source intact and still ends the moment the item comes off.**

## Accomplishments

- **The reconciliation.** `export function reconcileItemSources(sheet)` in `engine/saveState.js`. For each live (`phase: "effect"`, `left > 0`) `item:<key>` record whose key is a worn-family item (`SLOT_OF`) or a staff name and whose `src` is missing, malformed or names another item, it deletes the bad `src` and links to the first `SOURCE_SLOTS` key whose current item has that activation key (jewelry2 and the wielded Crystal Staff included); with no match it ends through `endEffectEarly` (spent use, no event). It then calls `endSourceEffects(null, sheet, [], { quiet: true })` so any linked record whose slot no longer holds its item (tampered, stale, a staff `sanitizeStaff` un-wielded) ends the same quiet way. Potions, the Torch and every cooldown-phase record are never touched; it never creates `timers` or `worn`, pushes no event, draws no rng and is idempotent.
- **Both load chains.** `validateSave` and `rehydrate` call it on the hero and on every party member right after `reconcileWorn`.
- **Crystal Staff.** A live `item:Crystal Staff` record links to a wielded staff (`src { slot: "weapon", n }`) and the Joiner's one-face defence follows; with the staff bagged (or un-wielded by `sanitizeStaff`) the record is removed with the staff's charges and its `charges:` record untouched, and the party-wide read goes back to ordinary faces.
- **Carve-out proof.** `test/unit/item-source-comparables.test.js`: one test per comparable (`movementComparable`, `combatComparable`, `economyComparable`) showing `c.timers` and any `src` never reach the compare. The `stripTimersField` doc comment names Phase 88's `src` (comment only).

## Task Commits

1. **Task 1 RED: failing tests for the reconciliation** - `475744bc` (test)
2. **Task 1 GREEN: reconcile item effect sources on load for the hero and every Joiner** - `b8cb6f2b` (feat)
3. **Task 2: pin src out of all three comparables, record zero drift** - `149460b5` (test)

## Fixture drift (ITEM-02 persistence)

Measured against the plan base `57071921` and recorded in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 88 plan 02: effect sources survive save and load (ITEM-02)"): **zero drift.**

- `node tools/fixture-inventory.mjs --json`: byte-identical to a `git archive` of the base run in a scratch directory.
- Parity `node --test "test/parity/**/*.test.js"`: 66 / 66 pass; no carve-out, no declared divergence. `test/parity/prototype-master.js.txt` untouched; `comparables.js` changed by one comment sentence.
- State pins (`roll-high-state-pins.test.js`) and the pre-switch save replay (`roll-high-save-compat.test.js`): 13 / 13 pass, every label and `expected.hash` unchanged (no pinned run or save carries a live worn-item record).
- Nothing was re-recorded: no fixture, state pin, save, golden or unit pin moved.

## Deviations from Plan

**1. [Rule 2 - Correctness] A linked `src` must name the record's own item.** The plan's reconciliation skips a record whose `effectSourceOf` is non-null. A tampered save could pair `item:Cloak of Flying` with a `src` naming a different (worn) cloak and keep the effect alive on gear that does not back it, which breaks the phase's "a load never grants an effect the gear does not back" prohibition. A `src.n` that differs from the id's key is now treated as missing (relinked to the true item or ended quietly). Pinned in the "malformed src" test (wrong-name case). No fixture impact.

Otherwise the plan ran as written.

## Tests

- New: `test/unit/item-effect-source-save.test.js` (21 tests: relaunch of a Cloak of Flying and of the wielded Crystal Staff, old-save link and jewelry2 order, old-save ended, tampered and stale sources, malformed src variants, untouched potion/Torch/cooldown records, no created fields, hostile timers, Crystal Staff wielded/bagged/tampered, Joiner sheets, ITEM-04 old-save cloak across a relaunch, idempotency, legacy no-worn-map save, no grant) and `test/unit/item-source-comparables.test.js` (3 tests).
- Full `npm test` on HEAD `149460b5`: **8,241 tests, 8,239 pass, 0 fail, 2 skipped** (base 8,217 / 8,215; +24 new). No worktree-only CRLF failures appeared.
- Acceptance greps: `export function reconcileItemSources` x1, `reconcileItemSources(` x6, `endSourceEffects(` x1, `STAFF_NAMES.includes` x3 in saveState.js; both node -e probes exit 0; `git diff` of `prototype-master.js.txt` empty; the `comparables.js` diff is comment-only.

## Known Stubs

None.

## Threat Flags

None. T-88-01 (a tampered `src`) is mitigated and tested; T-88-02 accepted (the reconciliation only removes or links, never grants).

## Human verification (deferred to end of run)

- [ ] Use a Cloak of Flying, Save & Quit, relaunch, take the cloak off: the flying stops with its line and the cloak shows cooling.
- [ ] A Magic User uses the wielded Crystal Staff, Save & Quit, relaunch, unwields it: the Oracle says the party is seen again.

## Self-Check: PASSED

- Commits `475744bc`, `b8cb6f2b`, `149460b5` exist; `test/unit/item-effect-source-save.test.js` and `test/unit/item-source-comparables.test.js` exist; every acceptance grep and probe passes; full suite green.
